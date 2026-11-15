import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/guards'
import { audit } from '@/lib/audit'
import { notifyFamily } from '@/lib/notify'
import { flash } from '@/lib/flash'
import AdminNav from '@/components/AdminNav'

async function schedule(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const id = String(formData.get('id'))
  const when = String(formData.get('scheduled_for')).trim()
  if (!when) return flash('Enter the date and time.', 'error')
  const { data: s } = await supabase.from('mentor_sessions').update({ status: 'scheduled', scheduled_for: when }).eq('id', id).select('student_id').single()
  if (s) await notifyFamily([s.student_id], 'Your mentor session is scheduled', `Your one-to-one session with a Lerne mentor is set for ${when}.`, '/strengths')
  await audit(supabase, 'mentor_scheduled', 'mentor_sessions', id)
  await flash('Scheduled and the family notified.')
  revalidatePath('/admin/mentor')
}

async function complete(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const id = String(formData.get('id'))
  await supabase.from('mentor_sessions').update({ status: 'done' }).eq('id', id)
  await audit(supabase, 'mentor_done', 'mentor_sessions', id)
  await flash('Marked as done.')
  revalidatePath('/admin/mentor')
}

export default async function Mentor() {
  const supabase = await requireAdmin()
  const { data } = await supabase.from('mentor_sessions').select('id, status, scheduled_for, created_at, students(full_name, lerne_id)').neq('status', 'done').order('created_at')
  const { data: requests } = await supabase.from('data_requests').select('id, note, students(full_name, lerne_id)').eq('resolved', false).like('note', 'Mentor session request:%')
  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-4 text-2xl font-semibold">Mentor sessions</h1>
      <h2 className="mb-2 font-medium">Paid sessions to schedule</h2>
      <ul className="mb-8 space-y-2">
        {(data ?? []).map((m: any) => (
          <li key={m.id} className="rounded border p-3 text-sm">
            <b>{m.students?.full_name}</b> ({m.students?.lerne_id}) · paid {new Date(m.created_at).toLocaleDateString('en-IN')} · {m.status}{m.scheduled_for ? `: ${m.scheduled_for}` : ''}
            <form action={schedule} className="mt-2 flex flex-wrap gap-2">
              <input type="hidden" name="id" value={m.id} />
              <input name="scheduled_for" placeholder="Date and time, e.g. 12 Dec, 5 pm" className="rounded border p-1" />
              <button className="rounded border px-2">Schedule and notify</button>
            </form>
            <form action={complete} className="mt-1"><input type="hidden" name="id" value={m.id} /><button className="text-blue-600 underline">Mark as done</button></form>
          </li>
        ))}
        {(data ?? []).length === 0 && <li className="text-sm text-gray-500">None.</li>}
      </ul>
      <h2 className="mb-2 font-medium">Requests without payment (when no price is set)</h2>
      <ul className="space-y-2 text-sm">
        {(requests ?? []).map((r: any) => <li key={r.id} className="rounded border p-3"><b>{r.students?.full_name}</b> ({r.students?.lerne_id}): {r.note} (close it under Data requests)</li>)}
        {(requests ?? []).length === 0 && <li className="text-gray-500">None.</li>}
      </ul>
    </main>
  )
}
