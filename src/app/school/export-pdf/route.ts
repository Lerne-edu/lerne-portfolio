import { createClient } from '@/lib/supabase/server'
import { audit } from '@/lib/audit'
import { loadSchoolData } from '@/lib/schoolData'
import { analyse, currentAcademicYear } from '@/lib/strengths'
import { newPdf, pdfResponse } from '@/lib/pdf'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Not signed in', { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role, school_id').eq('id', user.id).single()
  if (me?.role !== 'school_admin') return new Response('Not allowed', { status: 403 })
  await audit(supabase, 'school_export_pdf')
  const { data: school } = await supabase.from('schools').select('name').eq('id', me.school_id).single()

  const f = Object.fromEntries(new URL(req.url).searchParams)
  const d = await loadSchoolData(supabase, f)
  const s = analyse(d.pool, currentAcademicYear(), null, null, true) // school view: no private sections

  const pdf = await newPdf(`Verified by Lerne - generated ${new Date().toISOString().slice(0, 10)}`)
  pdf.title(school?.name ?? 'School', 'portfolio@lerne school report')
  const active = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')
  pdf.text(active ? `Filters: ${active}` : 'All students, all programs')
  pdf.heading('Overview')
  pdf.text(`Students: ${d.totals.students}   |   Taking part: ${d.totals.participating}   |   Verified achievements: ${d.totals.records}`)
  pdf.heading('Participation by program')
  pdf.table(['Program', 'Students', 'Records'], d.programs.map((p) => [p.program.replace(/_/g, ' '), String(p.students), String(p.records)]), [200, 100, 100])
  pdf.heading('Top performers')
  pdf.table(['Name', 'Lerne ID', 'Points', 'Wins'], d.top.map((r) => [r.name, r.lerneId, String(r.points), String(r.wins)]), [200, 130, 70, 70])
  pdf.heading('School strengths and progress')
  pdf.text(s.summary)
  pdf.bars(s.radar.map((x) => ({ label: x.skill, value: x.points })))
  pdf.heading('Students')
  pdf.table(['Name', 'Lerne ID', 'Grade', 'Records', 'Highest level'],
    d.rows.map((r) => [r.name, r.lerneId, `${r.grade ?? ''}${r.section}`, String(r.records.length), r.highest]), [190, 120, 50, 55, 80])

  return pdfResponse(await pdf.finish(), 'lerne-school-report.pdf')
}
