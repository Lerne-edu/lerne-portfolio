import Link from 'next/link'
import { redirect } from 'next/navigation'
import { flash } from '@/lib/flash'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/AdminNav'

async function resolve(formData: FormData) {
  'use server'
  const supabase = await createClient()
  await supabase.from('school_change_reports').update({ resolved: true }).eq('id', String(formData.get('id')))
  await flash('Done.')
  revalidatePath('/admin/moves')
}

async function resolveFlag(formData: FormData) {
  'use server'
  const supabase = await createClient()
  await supabase.from('inactivity_flags').update({ resolved: true }).eq('id', String(formData.get('id')))
  await flash('Marked as checked.')
  revalidatePath('/admin/moves')
}

async function enroll(formData: FormData) {
  'use server'
  const supabase = await createClient()
  await supabase.from('enrollments').insert({
    student_id: String(formData.get('student_id')), school_id: String(formData.get('school_id')),
    grade: Number(formData.get('grade')), academic_year: String(formData.get('academic_year')),
  })
  await flash('Student enrolled.')
  revalidatePath('/admin/moves')
}

export default async function Moves() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'lerne_admin') redirect('/')

  const { data: reports } = await supabase.from('school_change_reports')
    .select('id, kind, new_school_name, new_city, created_at, students(full_name, lerne_id)').eq('resolved', false).neq('kind', 'same').order('created_at', { ascending: false })
  const { data: schools } = await supabase.from('schools').select('id, name, school_code').order('name')
  const { data: movedTo } = await supabase.from('school_change_reports').select('new_school_name').eq('kind', 'changed').not('new_school_name', 'is', null)
  const counts = new Map<string, number>()
  ;(movedTo ?? []).forEach((m: any) => { const k = String(m.new_school_name).trim().toLowerCase(); counts.set(k, (counts.get(k) ?? 0) + 1) })
  const priority = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  const { data: quiet } = await supabase.from('inactivity_flags').select('id, students(full_name, lerne_id)').eq('resolved', false).order('created_at')
  const { data: leftRows } = await supabase.from('enrollments')
    .select('student_id, left_on, grade, schools(name), students(full_name, lerne_id)').not('left_on', 'is', null).order('left_on', { ascending: false }).limit(200)
  const ids = [...new Set((leftRows ?? []).map((r: any) => r.student_id))]
  const { data: open } = ids.length ? await supabase.from('enrollments').select('student_id').is('left_on', null).in('student_id', ids) : { data: [] }
  const stillIn = new Set((open ?? []).map((o: any) => o.student_id))
  const left = (leftRows ?? []).filter((r: any, i, a) => !stillIn.has(r.student_id) && a.findIndex((x: any) => x.student_id === r.student_id) === i)

  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-4 text-2xl font-semibold">Moves</h1>
      <h2 className="mb-2 font-medium">New schools receiving our students (priority leads)</h2>
      <ul className="mb-8 text-sm">
        {priority.map(([name, n]) => <li key={name} className="capitalize">{name}: <b>{n}</b> {n === 1 ? 'student' : 'students'}</li>)}
        {priority.length === 0 && <li className="text-gray-500">None yet.</li>}
      </ul>
      <h2 className="mb-2 font-medium">Reported by parents (follow-up leads)</h2>
      <ul className="mb-8 space-y-2">
        {(reports ?? []).map((r: any) => (
          <li key={r.id} className="rounded border p-3 text-sm">
            <b>{r.students?.full_name}</b> ({r.students?.lerne_id}) · {r.kind}
            {r.new_school_name && <> · new school: {r.new_school_name}{r.new_city ? `, ${r.new_city}` : ''}</>}
            <form action={resolve} className="mt-1"><input type="hidden" name="id" value={r.id} /><button className="text-blue-600 underline">Mark done</button></form>
          </li>
        ))}
        {(reports ?? []).length === 0 && <li className="text-sm text-gray-500">None.</li>}
      </ul>
      <h2 className="mb-2 font-medium">No activity or login for 6 months (check with the school)</h2>
      <ul className="mb-8 space-y-2">
        {(quiet ?? []).map((q: any) => (
          <li key={q.id} className="rounded border p-3 text-sm">
            <Link href={`/admin/students/${q.students?.lerne_id}`} className="text-blue-600 underline">{q.students?.full_name}</Link> ({q.students?.lerne_id})
            <form action={resolveFlag} className="mt-1"><input type="hidden" name="id" value={q.id} /><button className="text-blue-600 underline">Mark checked</button></form>
          </li>
        ))}
        {(quiet ?? []).length === 0 && <li className="text-sm text-gray-500">None.</li>}
      </ul>
      <h2 className="mb-2 font-medium">Left a school and not enrolled anywhere</h2>
      <ul className="space-y-2">
        {left.map((r: any) => (
          <li key={r.student_id} className="rounded border p-3 text-sm">
            <b>{r.students?.full_name}</b> ({r.students?.lerne_id}) · left {r.schools?.name} on {r.left_on}
            <form action={enroll} className="mt-2 flex flex-wrap gap-2">
              <input type="hidden" name="student_id" value={r.student_id} />
              <select name="school_id" required className="rounded border p-1"><option value="">Enroll at partner school</option>
                {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <input name="grade" type="number" min={1} max={12} defaultValue={Math.min(12, (r.grade ?? 1))} className="w-20 rounded border p-1" />
              <input name="academic_year" placeholder="2027-28" required className="w-28 rounded border p-1" />
              <button className="rounded border px-2">Enroll</button>
            </form>
          </li>
        ))}
        {left.length === 0 && <li className="text-sm text-gray-500">None.</li>}
      </ul>
    </main>
  )
}
