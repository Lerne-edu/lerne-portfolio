import { redirect } from 'next/navigation'
import { flash } from '@/lib/flash'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function schoolAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role, school_id').eq('id', user?.id ?? '').single()
  if (me?.role !== 'school_admin') redirect('/')
  return { supabase, schoolId: me.school_id as string }
}

async function createTeacher(formData: FormData) {
  'use server'
  const { schoolId } = await schoolAdmin()
  const password = String(formData.get('password'))
  const grades = String(formData.get('grades')).split(/[,\s]+/).map(Number).filter((g) => g >= 1 && g <= 12)
  if (password.length < 8 || grades.length === 0) return flash('Could not create the teacher. Enter grades 1 to 12, a password of 8+ characters and a new email.', 'error')
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({ email: String(formData.get('email')).trim(), password, email_confirm: true })
  if (error || !data.user) return flash('Could not create the teacher. Enter grades 1 to 12, a password of 8+ characters and a new email.', 'error')
  await admin.from('profiles').insert({ id: data.user.id, role: 'teacher', must_change_password: true, full_name: String(formData.get('name')).trim(), school_id: schoolId })
  const section = String(formData.get('section') || '').trim() || null
  await admin.from('teacher_assignments').insert(grades.map((grade) => ({ teacher_id: data.user!.id, grade, section })))
  await flash('Teacher created.')
  revalidatePath('/school/teachers')
}

async function resetPassword(formData: FormData) {
  'use server'
  const { supabase } = await schoolAdmin()
  const id = String(formData.get('id'))
  const password = String(formData.get('password'))
  // Row level security returns this teacher only if they belong to the caller's school
  const { data: t } = await supabase.from('profiles').select('id').eq('id', id).eq('role', 'teacher').single()
  if (!t || password.length < 8) return flash('Could not reset. Use a password of 8 or more characters.', 'error')
  const admin2 = createAdminClient()
  await admin2.auth.admin.updateUserById(id, { password })
  await admin2.from('profiles').update({ must_change_password: true }).eq('id', id)
  await flash('Password updated.')
}

async function removeAssignment(formData: FormData) {
  'use server'
  const { supabase } = await schoolAdmin()
  const tid = String(formData.get('teacher_id'))
  // Row level security returns this teacher only if they belong to the caller's school
  const { data: t } = await supabase.from('profiles').select('id').eq('id', tid).eq('role', 'teacher').single()
  if (!t) return flash('Could not change the assignment.', 'error')
  await createAdminClient().from('teacher_assignments').delete().eq('id', String(formData.get('id'))).eq('teacher_id', tid)
  await flash('Assignment removed.')
  revalidatePath('/school/teachers')
}

async function addAssignment(formData: FormData) {
  'use server'
  const { supabase } = await schoolAdmin()
  const tid = String(formData.get('teacher_id'))
  const grade = Number(formData.get('grade'))
  const { data: t } = await supabase.from('profiles').select('id').eq('id', tid).eq('role', 'teacher').single()
  if (!t || !(grade >= 1 && grade <= 12)) return flash('Could not add the grade (1 to 12).', 'error')
  await createAdminClient().from('teacher_assignments').insert({ teacher_id: tid, grade, section: String(formData.get('section') || '').trim() || null })
  await flash('Grade added.')
  revalidatePath('/school/teachers')
}

export default async function Teachers() {
  const { supabase } = await schoolAdmin()
  const { data: teachers } = await supabase.from('profiles').select('id, full_name, teacher_assignments(id, grade, section)').eq('role', 'teacher').order('full_name')
  return (
    <main className="mx-auto max-w-2xl p-6">
      <a href="/school" className="text-sm text-blue-600 underline">Back to dashboard</a>
      <h1 className="my-4 text-2xl font-semibold">Teachers</h1>
      <form action={createTeacher} className="mb-8 grid gap-2 rounded border p-4 text-sm">
        <input name="name" placeholder="Teacher name" required className="rounded border p-2" />
        <input name="email" type="email" placeholder="Email" required className="rounded border p-2" />
        <input name="password" type="password" minLength={8} placeholder="Starting password (8+ characters)" required className="rounded border p-2" />
        <input name="grades" placeholder="Grades, e.g. 8, 9" required className="rounded border p-2" />
        <input name="section" placeholder="Section (leave blank for all sections)" className="rounded border p-2" />
        <button className="rounded bg-blue-600 p-2 text-white">Create teacher login</button>
      </form>
      <ul className="space-y-2">
        {(teachers ?? []).map((t: any) => (
          <li key={t.id} className="rounded border p-3 text-sm">
            <b>{t.full_name}</b>
            <div className="my-1 flex flex-wrap gap-3">
              {t.teacher_assignments.map((a: any) => (
                <form key={a.id} action={removeAssignment}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="teacher_id" value={t.id} />
                  <span className="rounded border px-2 py-1">Grade {a.grade}{a.section ?? ''}</span>{' '}
                  <button className="text-xs text-red-600 underline">remove</button>
                </form>
              ))}
            </div>
            <form action={addAssignment} className="mt-1 flex gap-2">
              <input type="hidden" name="teacher_id" value={t.id} />
              <input name="grade" type="number" min={1} max={12} placeholder="Grade" required className="w-20 rounded border p-1" />
              <input name="section" placeholder="Section (optional)" className="rounded border p-1" />
              <button className="rounded border px-2">Add grade</button>
            </form>
            <form action={resetPassword} className="mt-2 flex gap-2">
              <input type="hidden" name="id" value={t.id} />
              <input name="password" type="password" minLength={8} placeholder="New password" required className="rounded border p-1" />
              <button className="rounded border px-2">Reset password</button>
            </form>
          </li>
        ))}
        {(teachers ?? []).length === 0 && <li className="text-sm text-gray-500">No teachers yet.</li>}
      </ul>
    </main>
  )
}
