import { revalidatePath } from 'next/cache'
import { flash } from '@/lib/flash'
import { requireAdmin } from '@/lib/guards'
import { audit } from '@/lib/audit'
import AdminNav from '@/components/AdminNav'

async function done(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const id = String(formData.get('id'))
  await supabase.from('data_requests').update({ resolved: true }).eq('id', id)
  await audit(supabase, 'data_request_resolved', 'data_requests', id)
  await flash('Marked as done.')
  revalidatePath('/admin/requests')
}

export default async function Requests() {
  const supabase = await requireAdmin()
  const { data } = await supabase.from('data_requests').select('id, kind, note, created_at, students(full_name, lerne_id)').eq('resolved', false).order('created_at')
  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-4 text-2xl font-semibold">Data requests ({data?.length ?? 0})</h1>
      {(data ?? []).map((r: any) => (
        <form key={r.id} action={done} className="mb-3 rounded border p-4 text-sm">
          <input type="hidden" name="id" value={r.id} />
          <div><b>{r.students?.full_name}</b> ({r.students?.lerne_id}) · <b>{r.kind}</b> · {new Date(r.created_at).toLocaleDateString('en-IN')}</div>
          <p className="my-2">{r.note}</p>
          <a href={`/admin/students/${r.students?.lerne_id}`} className="mr-4 text-blue-600 underline">Open student</a>
          <button className="text-blue-600 underline">Mark done</button>
        </form>
      ))}
      {(data ?? []).length === 0 && <p className="text-gray-500">No open requests.</p>}
    </main>
  )
}
