import { revalidatePath } from 'next/cache'
import { flash } from '@/lib/flash'
import { requireAdmin } from '@/lib/guards'
import { audit } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from '@/components/AdminNav'

async function createSchoolAdmin(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const password = String(formData.get('password'))
  if (password.length < 8) return flash('Could not create the login. Use a password of 8+ characters and an email not used before.', 'error')
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({ email: String(formData.get('email')).trim(), password, email_confirm: true })
  if (error || !data.user) return flash('Could not create the login. Use a password of 8+ characters and an email not used before.', 'error')
  await admin.from('profiles').insert({ id: data.user.id, role: 'school_admin', must_change_password: true, full_name: String(formData.get('name')).trim(), school_id: String(formData.get('school_id')) })
  await audit(supabase, 'create_school_admin', 'profiles', data.user.id)
  await flash('School admin created.')
  revalidatePath('/admin/school-admins')
}

async function resetPassword(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const password = String(formData.get('password'))
  if (password.length < 8) return flash('Could not reset. Use a password of 8 or more characters.', 'error')
  const id = String(formData.get('id'))
  const admin2 = createAdminClient()
  await admin2.auth.admin.updateUserById(id, { password })
  await admin2.from('profiles').update({ must_change_password: true }).eq('id', id)
  await audit(supabase, 'reset_school_admin_password', 'profiles', id)
  await flash('Password updated.')
}

export default async function SchoolAdmins() {
  const supabase = await requireAdmin()
  const { data: schools } = await supabase.from('schools').select('id, name').order('name')
  const { data: admins } = await supabase.from('profiles').select('id, full_name, schools(name)').eq('role', 'school_admin').order('full_name')
  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-4 text-2xl font-semibold">School admins</h1>
      <form action={createSchoolAdmin} className="mb-8 grid gap-2 rounded border p-4">
        <select name="school_id" required className="rounded border p-2"><option value="">Choose school</option>{(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input name="name" placeholder="Principal / coordinator name" required className="rounded border p-2" />
        <input name="email" type="email" placeholder="Official school email" required className="rounded border p-2" />
        <input name="password" type="password" minLength={8} placeholder="Starting password (8+ characters)" required className="rounded border p-2" />
        <button className="rounded bg-blue-600 p-2 text-white">Create school admin</button>
      </form>
      <ul className="space-y-2">
        {(admins ?? []).map((a: any) => (
          <li key={a.id} className="rounded border p-3 text-sm">
            <b>{a.full_name}</b> · {a.schools?.name}
            <form action={resetPassword} className="mt-2 flex gap-2">
              <input type="hidden" name="id" value={a.id} />
              <input name="password" type="password" minLength={8} placeholder="New password" required className="rounded border p-1" />
              <button className="rounded border px-2">Reset password</button>
            </form>
          </li>
        ))}
        {(admins ?? []).length === 0 && <li className="text-sm text-gray-500">None yet.</li>}
      </ul>
    </main>
  )
}
