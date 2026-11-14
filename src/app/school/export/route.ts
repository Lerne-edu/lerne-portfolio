import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { audit } from '@/lib/audit'
import { loadSchoolData } from '@/lib/schoolData'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Not signed in', { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'school_admin') return new Response('Not allowed', { status: 403 })
  await audit(supabase, 'school_export_excel')

  const f = Object.fromEntries(new URL(req.url).searchParams)
  const d = await loadSchoolData(supabase, f)
  const sheet = XLSX.utils.json_to_sheet(d.rows.map((r) => ({
    'Lerne ID': r.lerneId, Name: r.name, Grade: r.grade, Section: r.section, 'Admission no': r.admissionNo,
    'Verified achievements': r.records.length, Wins: r.wins, Points: r.points, 'Highest level': r.highest,
  })))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Students')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="lerne-school-report.xlsx"',
    },
  })
}
