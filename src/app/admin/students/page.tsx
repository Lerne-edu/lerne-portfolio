import { requireAdmin } from '@/lib/guards'
import AdminNav from '@/components/AdminNav'

export default async function Students({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const supabase = await requireAdmin()
  const term = (q ?? '').replace(/[,()%]/g, '').trim()
  const { data } = term
    ? await supabase.from('students').select('lerne_id, full_name, dob').or(`full_name.ilike.%${term}%,lerne_id.ilike.%${term}%`).order('full_name').limit(50)
    : { data: [] }
  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-4 text-2xl font-semibold">Find a student</h1>
      <form className="mb-6 flex gap-2">
        <input name="q" defaultValue={q ?? ''} placeholder="Name or Lerne ID" className="flex-1 rounded border p-2" />
        <button className="rounded bg-blue-600 px-4 text-white">Search</button>
      </form>
      <ul className="space-y-2">
        {(data ?? []).map((s) => (
          <li key={s.lerne_id} className="rounded border p-3 text-sm">
            <a href={`/admin/students/${s.lerne_id}`} className="text-blue-600 underline">{s.full_name}</a> · {s.lerne_id} · {s.dob}
          </li>
        ))}
      </ul>
    </main>
  )
}
