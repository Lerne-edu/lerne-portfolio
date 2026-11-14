import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/guards'
import { audit } from '@/lib/audit'
import { notifyFamily } from '@/lib/notify'
import { flash } from '@/lib/flash'
import AdminNav from '@/components/AdminNav'

// Sends a message to the families of all current students (or one school): for example "New Challenge open".
// Only families whose parent agreed to consent are reached.
async function announce(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const title = String(formData.get('title')).trim()
  const message = String(formData.get('message')).trim()
  const schoolId = String(formData.get('school_id') || '')
  if (!title || !message) return flash('Add a title and a message.', 'error')

  const ids = new Set<string>()
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('enrollments').select('student_id').is('left_on', null).range(from, from + 999)
    if (schoolId) q = q.eq('school_id', schoolId)
    const { data } = await q
    ;(data ?? []).forEach((e) => ids.add(e.student_id as string))
    if (!data || data.length < 1000) break
  }
  await notifyFamily([...ids], title, message, String(formData.get('link') || '/records'))
  await audit(supabase, 'announce', 'schools', schoolId || 'all')
  await flash(`Sent to the families of ${ids.size} students.`)
  redirect('/admin/announce')
}

export default async function Announce() {
  const supabase = await requireAdmin()
  const { data: schools } = await supabase.from('schools').select('id, name').order('name')
  return (
    <main className="mx-auto max-w-2xl p-6">
      <AdminNav />
      <h1 className="mb-2 text-2xl font-semibold">Announce</h1>
      <p className="mb-4 text-sm text-gray-600">Tell families about a new Challenge, a result date or any news. It appears in their notifications and goes out by email, SMS and WhatsApp where those are set up.</p>
      <form action={announce} className="grid gap-2 rounded border p-4 text-sm">
        <select name="school_id" className="rounded border p-2"><option value="">All schools</option>{(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input name="title" required placeholder="Title, e.g. New Challenge open" className="rounded border p-2" />
        <textarea name="message" required placeholder="Message" className="rounded border p-2" />
        <input name="link" defaultValue="/records" className="rounded border p-2" />
        <button className="rounded bg-blue-600 p-2 text-white">Send to families</button>
      </form>
    </main>
  )
}
