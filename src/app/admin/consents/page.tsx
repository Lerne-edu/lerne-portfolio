import Link from 'next/link'
import { requireAdmin } from '@/lib/guards'
import AdminNav from '@/components/AdminNav'

// Who agreed, who declined or withdrew, and when. Withdrawals hide the record immediately.
export default async function Consents({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const supabase = await requireAdmin()
  let q = supabase.from('consents')
    .select('id, status, decided_at, identity_confirmed_at, students(full_name, lerne_id), parents(full_name, mobile)')
    .order('decided_at', { ascending: false, nullsFirst: true }).range((page - 1) * 100, page * 100 - 1)
  if (sp.status) q = q.eq('status', sp.status)
  const { data } = await q
  const { data: pendingSchool } = await supabase.from('school_consents').select('id, students(full_name, lerne_id), schools(name)').eq('status', 'pending').limit(50)
  const qs = (p: number) => `/admin/consents?${sp.status ? `status=${sp.status}&` : ''}page=${p}`

  return (
    <main className="mx-auto max-w-5xl p-6">
      <AdminNav />
      <h1>Consent records</h1>
      <div className="tabs" style={{ margin: '1rem 0' }}>
        {[['', 'All'], ['agreed', 'Agreed'], ['pending', 'Waiting'], ['declined', 'Declined or withdrawn']].map(([v, l]) => (
          <Link key={v} href={v ? `/admin/consents?status=${v}` : '/admin/consents'} className={`tab ${(sp.status ?? '') === v ? 'active' : ''}`}>{l}</Link>
        ))}
      </div>
      <table>
        <thead><tr><th>Student</th><th>Parent</th><th>Status</th><th>Child confirmed</th><th>Decision date</th></tr></thead>
        <tbody>
          {(data ?? []).map((c: any) => (
            <tr key={c.id} className="border-t">
              <td><Link href={`/admin/students/${c.students?.lerne_id}`} className="text-blue-600 underline">{c.students?.full_name}</Link><br /><small>{c.students?.lerne_id}</small></td>
              <td>{c.parents?.full_name}<br /><small>{c.parents?.mobile}</small></td>
              <td><span className={`badge ${c.status === 'agreed' ? 'badge-verified' : c.status === 'pending' ? 'badge-pending' : 'badge-rejected'}`}>{c.status === 'declined' ? 'declined / withdrawn' : c.status}</span></td>
              <td>{c.identity_confirmed_at ? new Date(c.identity_confirmed_at).toLocaleDateString('en-IN') : '-'}</td>
              <td>{c.decided_at ? new Date(c.decided_at).toLocaleString('en-IN') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(data ?? []).length === 0 && <p className="text-gray-500">No consent records match.</p>}
      <p className="mt-4 text-sm">
        {page > 1 && <Link href={qs(page - 1)} className="mr-4 text-blue-600 underline">Newer</Link>}
        {(data ?? []).length === 100 && <Link href={qs(page + 1)} className="text-blue-600 underline">Older</Link>}
      </p>
      <h2 className="mt-10 text-xl">New-school agreements waiting for a parent</h2>
      <ul className="mt-3 space-y-2 text-sm" style={{ listStyle: 'none', padding: 0 }}>
        {(pendingSchool ?? []).map((p: any) => <li key={p.id} className="rounded border p-3">{p.students?.full_name} ({p.students?.lerne_id}) · {p.schools?.name}</li>)}
        {(pendingSchool ?? []).length === 0 && <li className="text-gray-500">None.</li>}
      </ul>
    </main>
  )
}
