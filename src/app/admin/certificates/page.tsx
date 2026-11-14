import { requireAdmin } from '@/lib/guards'
import AdminNav from '@/components/AdminNav'

export default async function Certificates() {
  const supabase = await requireAdmin()
  const { data: schools } = await supabase.from('schools').select('id, school_code, name').order('school_code')
  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-2 text-2xl font-semibold">Certificate QR links</h1>
      <p className="mb-4 text-sm text-gray-600">
        Download an Excel with each verified program result and its verification link and QR image link.
        Use it to add the QR to certificates (for example with a mail merge). The link opens a &quot;Verified by Lerne&quot; page.
      </p>
      <form action="/admin/certificates/export" className="grid gap-2 rounded border p-4">
        <select name="school" required className="rounded border p-2">
          <option value="">Choose school</option>
          {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}
        </select>
        <input name="year" placeholder="Academic year, e.g. 2026-27" required className="rounded border p-2" />
        <button className="rounded bg-blue-600 p-2 text-white">Download Excel</button>
      </form>
    </main>
  )
}
