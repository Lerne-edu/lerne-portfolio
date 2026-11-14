import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadSchoolData, PROGRAMS, type Filters } from '@/lib/schoolData'
import { analyse, currentAcademicYear } from '@/lib/strengths'
import StrengthsCharts from '@/components/StrengthsCharts'

const LEVELS = ['school', 'district', 'state', 'national', 'international']
const label = (p: string) => p.replace(/_/g, ' ')

export default async function School({ searchParams }: { searchParams: Promise<Filters> }) {
  const sp = await searchParams
  const page = Math.max(1, Number((sp as Record<string, string | undefined>).page) || 1)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role, school_id').eq('id', user!.id).single()
  const isTeacher = me?.role === 'teacher'
  if (me?.role !== 'school_admin' && !isTeacher) redirect('/')

  const { data: school } = await supabase.from('schools').select('name').eq('id', me.school_id).single()
  const d = await loadSchoolData(supabase, sp)
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== 'page') as [string, string][]).toString()
  const school_view = analyse(d.pool, currentAcademicYear(), null, null, true)

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">{school?.name ?? 'School'} dashboard</h1>{!isTeacher && <a href="/school/teachers" className="text-sm text-blue-600 underline">Manage teachers</a>}</div>
      </div>

      <form className="mb-6 grid grid-cols-2 gap-2 rounded border p-4 text-sm md:grid-cols-6">
        <select name="grade" defaultValue={sp.grade ?? ''} className="rounded border p-2">
          <option value="">All grades</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
        </select>
        <input name="section" defaultValue={sp.section ?? ''} placeholder="Section" className="rounded border p-2" />
        <select name="program" defaultValue={sp.program ?? ''} className="rounded border p-2">
          <option value="">All programs</option>
          {PROGRAMS.map((p) => <option key={p} value={p}>{label(p)}</option>)}
        </select>
        <select name="level" defaultValue={sp.level ?? ''} className="rounded border p-2">
          <option value="">All levels</option>
          {LEVELS.map((l) => <option key={l}>{l}</option>)}
        </select>
        <input name="year" defaultValue={sp.year ?? ''} placeholder="Year, e.g. 2026-27" className="rounded border p-2" />
        <input name="q" defaultValue={sp.q ?? ''} placeholder="Search name, admission no, Lerne ID" className="rounded border p-2 md:col-span-4" />
        <button className="rounded bg-blue-600 p-2 text-white md:col-span-1">Apply</button>
        {!isTeacher && (
        <div className="flex gap-2">
          <a href={`/school/export?${qs}`} className="rounded border p-2 text-center">Excel</a>
          <a href={`/school/export-pdf?${qs}`} className="rounded border p-2 text-center">PDF</a>
        </div>
        )}
      </form>

      <div className="mb-8 grid grid-cols-3 gap-3 text-center">
        {[['Students', d.totals.students], ['Taking part', d.totals.participating], ['Verified achievements', d.totals.records]].map(([k, v]) => (
          <div key={k} className="rounded border p-4"><div className="text-2xl font-semibold">{v}</div><div className="text-sm text-gray-600">{k}</div></div>
        ))}
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 font-medium">Participation by program</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-600"><th>Program</th><th>Students</th><th>Records</th></tr></thead>
            <tbody>{d.programs.map((p) => <tr key={p.program} className="border-t"><td className="py-1 capitalize">{label(p.program)}</td><td>{p.students}</td><td>{p.records}</td></tr>)}</tbody>
          </table>
        </div>
        <div>
          <h2 className="mb-2 font-medium">Top performers</h2>
          <ol className="list-decimal pl-5 text-sm">
            {d.top.map((r) => <li key={r.id}><a href={`/school/students/${r.lerneId}`} className="text-blue-600 underline">{r.name}</a> · {r.points} points · {r.wins} wins</li>)}
            {d.top.length === 0 && <li className="list-none text-gray-500">Nothing to show yet.</li>}
          </ol>
        </div>
      </div>

      <h2 className="mb-2 font-medium">School strengths and progress</h2>
      <p className="mb-4 rounded bg-blue-50 p-3 text-sm">{school_view.summary}</p>
      <div className="mb-10"><StrengthsCharts radar={school_view.radar} yearly={school_view.yearlyData} trend={[]} subjects={[]} /></div>

      <h2 className="mb-2 font-medium">Students ({d.rows.length})</h2>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-gray-600"><th>Name</th><th>Lerne ID</th><th>Grade</th><th>Adm. no</th><th>Records</th><th>Highest level</th></tr></thead>
        <tbody>
          {d.rows.slice((page - 1) * 100, page * 100).map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-1"><a href={`/school/students/${r.lerneId}`} className="text-blue-600 underline">{r.name}</a></td>
              <td>{r.lerneId}</td><td>{r.grade}{r.section}</td><td>{r.admissionNo}</td><td>{r.records.length}</td><td>{r.highest}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-sm">
        {page > 1 && <a href={`/school?${qs}&page=${page - 1}`} className="mr-4 text-blue-600 underline">Previous</a>}
        {d.rows.length > page * 100 && <a href={`/school?${qs}&page=${page + 1}`} className="text-blue-600 underline">Next</a>}
      </p>
    </main>
  )
}
