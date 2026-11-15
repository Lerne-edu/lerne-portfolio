import * as XLSX from 'xlsx'
import { requireAdmin } from '@/lib/guards'
import { audit } from '@/lib/audit'

export async function GET(req: Request) {
  const supabase = await requireAdmin()
  const u = new URL(req.url)
  const school = u.searchParams.get('school') ?? ''
  const year = u.searchParams.get('year') ?? ''
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? u.origin

  const out: Record<string, string>[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('achievements')
      .select('id, title, level, result, achieved_on, students!inner(full_name, lerne_id, enrollments!inner(school_id))')
      .eq('source', 'lerne_program').eq('status', 'verified').eq('academic_year', year)
      .eq('students.enrollments.school_id', school).range(from, from + 999)
    for (const a of (data ?? []) as any[]) {
      out.push({
        'Lerne ID': a.students.lerne_id, Name: a.students.full_name, Title: a.title, Level: a.level,
        Result: a.result, Date: a.achieved_on, 'Verify link': `${site}/verify/${a.id}`, 'QR image': `${site}/verify/${a.id}/qr`,
      })
    }
    if (!data || data.length < 1000) break
  }
  await audit(supabase, 'export_certificate_links', 'schools', school)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out), 'Certificates')
  return new Response(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="lerne-certificate-links.xlsx"',
    },
  })
}
