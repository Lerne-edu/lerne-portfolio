import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/AdminNav'

export default async function Audit({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'lerne_admin') redirect('/')

  const { data: log } = await supabase.from('audit_log').select('id, actor, action, table_name, row_id, at').order('at', { ascending: false }).range((page - 1) * 100, page * 100 - 1)
  const actors = [...new Set((log ?? []).map((l) => l.actor).filter(Boolean))] as string[]
  const { data: people } = actors.length ? await supabase.from('profiles').select('id, full_name, role').in('id', actors) : { data: [] }
  const who = new Map((people ?? []).map((p) => [p.id, `${p.full_name} (${p.role})`]))

  return (
    <main className="mx-auto max-w-4xl p-6">
      <AdminNav />
      <h1 className="mb-4 text-2xl font-semibold">Audit log (page {page})</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-gray-600"><th>When</th><th>Who</th><th>Action</th><th>Item</th></tr></thead>
        <tbody>
          {(log ?? []).map((l) => (
            <tr key={l.id} className="border-t">
              <td className="py-1 pr-2">{new Date(l.at).toLocaleString('en-IN')}</td>
              <td className="pr-2">{l.actor ? who.get(l.actor) ?? l.actor : 'system'}</td>
              <td className="pr-2">{l.action}</td>
              <td>{l.table_name ? `${l.table_name} ${l.row_id ?? ''}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-sm">
        {page > 1 && <a href={`/admin/audit?page=${page - 1}`} className="mr-4 text-blue-600 underline">Newer</a>}
        {(log ?? []).length === 100 && <a href={`/admin/audit?page=${page + 1}`} className="text-blue-600 underline">Older</a>}
      </p>
    </main>
  )
}
