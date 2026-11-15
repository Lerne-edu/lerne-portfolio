import { redirect } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/AdminNav'
import { notifyFamily } from '@/lib/notify'

async function rollover(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'lerne_admin') redirect('/')

  const schoolId = String(formData.get('school_id'))
  const year = String(formData.get('academic_year'))
  const promoteRest = formData.get('promote_rest') === 'on'
  const file = formData.get('file') as File | null
  const status = new Map<string, string>() // Lerne ID -> promoted | left
  if (file && file.size > 0) {
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' })
    for (const r of XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: '' })) {
      status.set(String(r.lerne_id).trim().toUpperCase(), String(r.status).trim().toLowerCase())
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const byGrade: Record<number, string[]> = {}
  const leftIds: string[] = [], gradIds: string[] = [], gradStudents: string[] = []
  let unlisted = 0
  const seen = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('enrollments').select('id, grade, student_id, students(lerne_id)')
      .eq('school_id', schoolId).is('left_on', null).range(from, from + 999)
    for (const e of (data ?? []) as any[]) {
      const lid = e.students.lerne_id as string
      seen.add(lid)
      const action = status.get(lid) ?? (promoteRest ? 'promoted' : '')
      if (action === 'left') leftIds.push(e.id)
      else if (action === 'promoted') { if (e.grade >= 12) { gradIds.push(e.id); gradStudents.push(e.student_id) } else (byGrade[e.grade] ??= []).push(e.id) }
      else unlisted++
    }
    if (!data || data.length < 1000) break
  }
  const chunks = (a: string[]) => Array.from({ length: Math.ceil(a.length / 200) }, (_, i) => a.slice(i * 200, i * 200 + 200))
  for (const [g, ids] of Object.entries(byGrade))
    for (const c of chunks(ids)) await supabase.from('enrollments').update({ grade: Number(g) + 1, academic_year: year }).in('id', c)
  for (const c of chunks([...leftIds, ...gradIds])) await supabase.from('enrollments').update({ left_on: today }).in('id', c)

  await notifyFamily(gradStudents, 'Congratulations on finishing Grade 12', 'The student now takes over the account: parents lose access once the student has their own login. The student can also link the verified record to Getprofily.')
  const promoted = Object.values(byGrade).reduce((t, a) => t + a.length, 0)
  const unknown = [...status.keys()].filter((k) => !seen.has(k)).length
  redirect(`/admin/rollover?p=${promoted}&l=${leftIds.length}&g=${gradIds.length}&u=${unlisted}&x=${unknown}`)
}

export default async function Rollover({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'lerne_admin') redirect('/')
  const { data: schools } = await supabase.from('schools').select('id, school_code, name').order('school_code')
  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-2 text-2xl font-semibold">Yearly rollover</h1>
      <p className="mb-4 text-sm text-gray-600">
        Send each school its student list to confirm. Upload the confirmed file with two columns, <b>lerne_id</b> and <b>status</b> (promoted or left).
        Promoted students move up a grade; Grade 12 promoted students graduate. New students come through &quot;Upload student list&quot;.
        Students who left appear under Moves.
      </p>
      <form action={rollover} className="grid gap-2 rounded border p-4">
        <select name="school_id" required className="rounded border p-2">
          <option value="">Choose school</option>
          {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}
        </select>
        <input name="academic_year" placeholder="New academic year, e.g. 2027-28" required className="rounded border p-2" />
        <input name="file" type="file" accept=".xlsx,.xls,.csv" className="rounded border p-2" />
        <label className="text-sm"><input type="checkbox" name="promote_rest" /> Promote every student not listed in the file</label>
        <button className="rounded bg-blue-600 p-2 text-white">Run rollover</button>
      </form>
      {sp.p !== undefined && (
        <p className="mt-6 rounded border p-4 text-sm">
          Promoted: {sp.p} · Left: {sp.l} · Graduated (Grade 12): {sp.g} · Not changed: {sp.u} · IDs in file not found at this school: {sp.x}
        </p>
      )}
    </main>
  )
}
