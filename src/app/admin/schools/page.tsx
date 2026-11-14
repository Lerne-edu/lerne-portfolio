import { redirect } from 'next/navigation'
import { flash } from '@/lib/flash'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/AdminNav'

async function createSchool(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { error: opError } = await supabase.from('schools').insert({
    school_code: String(formData.get('school_code')).trim(),
    name: String(formData.get('name')).trim(),
    state: String(formData.get('state')).trim(),
    district: String(formData.get('district') || '').trim() || null,
  })
  if (opError) return flash('Could not add the school. The School ID may already exist.', 'error')
  await flash('School added.')
  revalidatePath('/admin/schools')
}

export default async function Schools() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'lerne_admin') redirect('/')
  const { data: schools } = await supabase.from('schools').select('id, school_code, name, state, district').order('school_code')

  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-4 text-2xl font-semibold">Schools</h1>
      <form action={createSchool} className="mb-8 grid gap-2 rounded border p-4">
        <input name="school_code" placeholder="School ID, e.g. SCH-TN-0001" required className="rounded border p-2" />
        <input name="name" placeholder="School name" required className="rounded border p-2" />
        <input name="state" placeholder="State" required className="rounded border p-2" />
        <input name="district" placeholder="District" className="rounded border p-2" />
        <button className="rounded bg-blue-600 p-2 text-white">Add school</button>
      </form>
      <ul className="space-y-2">
        {(schools ?? []).map((s) => (
          <li key={s.id} className="rounded border p-3">
            <span className="font-medium">{s.name}</span>
            <span className="text-sm text-gray-600"> · {s.school_code} · {s.district ? s.district + ', ' : ''}{s.state}</span>
          </li>
        ))}
        {(schools ?? []).length === 0 && <li className="text-sm text-gray-500">No schools yet.</li>}
      </ul>
    </main>
  )
}
