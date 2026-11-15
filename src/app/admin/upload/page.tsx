import * as XLSX from 'xlsx'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/guards'
import { audit } from '@/lib/audit'
import { attachRow } from '@/lib/enrol'
import AdminNav from '@/components/AdminNav'

type Row = Record<string, string>

async function upload(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const schoolId = String(formData.get('school_id'))
  const year = String(formData.get('academic_year'))
  const file = formData.get('file') as File
  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]], { raw: false, dateNF: 'yyyy-mm-dd', defval: '' })

  let created = 0, linked = 0, review = 0
  const errs: string[] = []
  for (const [i, r] of rows.entries()) {
    const line = i + 2
    const name = String(r.student_name).trim()
    const dob = String(r.dob).trim()
    const p1 = String(r.parent1_name).trim()
    const grade = Number(r.grade)
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || !p1 || !(grade >= 1 && grade <= 12)) {
      errs.push(`row ${line}: needs student_name, dob (YYYY-MM-DD), grade 1-12, parent1_name`)
      continue
    }
    const { data, error } = await supabase.rpc('create_or_link_student', { p_name: name, p_dob: dob, p_parent_name: p1, p_birth_cert: String(r.birth_cert_no ?? '').trim() || null, p_pen: String(r.pen ?? '').trim() || null })
    if (error || !data) { errs.push(`row ${line}: ${error?.message ?? 'failed'}`); continue }
    if (data.status === 'review') {
      review++
      // Keep the whole row so the team can finish it from the Duplicates page
      await supabase.from('duplicate_flags').update({ submitted: { name, dob, parent: p1, row: r, school_id: schoolId, year } }).eq('id', data.flag_id)
      continue
    }
    if (data.status === 'created') created++; else linked++
    const problem = await attachRow(supabase, data.student_id, r, schoolId, year)
    if (problem) errs.push(`row ${line}: ${name} ${problem}`)
  }

  await audit(supabase, 'upload_student_list', 'schools', schoolId)
  const more = errs.length > 8 ? ` (+${errs.length - 8} more)` : ''
  redirect(`/admin/upload?c=${created}&l=${linked}&r=${review}&n=${errs.length}&e=${encodeURIComponent(errs.slice(0, 8).join(' | ') + more)}`)
}

export default async function Upload({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const supabase = await requireAdmin()
  const { data: schools } = await supabase.from('schools').select('id, school_code, name').order('school_code')
  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-2 text-2xl font-semibold">Upload student list</h1>
      <p className="mb-4 text-sm text-gray-600">
        Excel or CSV in Lerne&apos;s template. <a href="/admin/upload/template" className="text-blue-600 underline">Download template</a>.
        Each student gets a Lerne ID (or is linked to an existing one), their parents are saved, and a consent request is created.
        Near-matches wait on the Duplicates page.
      </p>
      <form action={upload} className="grid gap-2 rounded border p-4">
        <select name="school_id" required className="rounded border p-2">
          <option value="">Choose school</option>
          {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}
        </select>
        <input name="academic_year" defaultValue="2026-27" required className="rounded border p-2" />
        <input name="file" type="file" accept=".xlsx,.xls,.csv" required className="rounded border p-2" />
        <button className="rounded bg-blue-600 p-2 text-white">Upload</button>
      </form>
      {sp.c !== undefined && (
        <div className="mt-6 rounded border p-4 text-sm">
          <p>New Lerne IDs: {sp.c} · Linked to existing: {sp.l} · Near-matches to check: {sp.r} · Problems: {sp.n}</p>
          {sp.e && <p className="mt-2 text-red-600">{sp.e}</p>}
        </div>
      )}
    </main>
  )
}
