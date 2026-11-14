import { createClient } from '@/lib/supabase/server'
import { audit } from '@/lib/audit'
import { analyse, type Ach } from '@/lib/strengths'
import { newPdf, pdfResponse } from '@/lib/pdf'

function currentAcademicYear() {
  const d = new Date()
  const start = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}
const words = (s: string) => s.replace(/_/g, ' ')

// ?student=<id>&mode=portfolio|yearend&year=2026-27
// portfolio: shareable record (no private sections). yearend: parent report with the full summary.
export async function GET(req: Request) {
  const u = new URL(req.url)
  const sid = u.searchParams.get('student')
  const mode = u.searchParams.get('mode') === 'yearend' ? 'yearend' : 'portfolio'
  const year = u.searchParams.get('year') || currentAcademicYear()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !sid) return new Response('Not allowed', { status: 403 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'parent' && me?.role !== 'student') return new Response('Not allowed', { status: 403 })

  // Row level security returns the student only if this is their parent or the student
  const { data: s } = await supabase
    .from('students')
    .select('full_name, lerne_id, aspiration, enrollments(grade, section, left_on, schools(name)), achievements(category, level, result, achieved_on, academic_year, title, status, subject_scores, achievement_skills(skill_code))')
    .eq('id', sid)
    .single()
  if (!s) return new Response('Not found', { status: 404 })
  await audit(supabase, `pdf_${mode}`, 'students', sid)

  const enr = (s.enrollments as unknown as { grade: number; section: string | null; left_on: string | null; schools: { name: string } | null }[]).find((e) => e.left_on === null)
  const verified = (s.achievements as unknown as (Ach & { status: string })[]).filter((a) => a.status === 'verified')
  const r = analyse(verified, year, enr?.grade ?? null, s.aspiration)

  const pdf = await newPdf(`Verified by Lerne - generated ${new Date().toISOString().slice(0, 10)}`)
  pdf.title('portfolio@lerne', mode === 'yearend' ? `Year-end report ${year}` : 'Verified achievement record')
  pdf.text(`${s.full_name}   |   ${s.lerne_id}`, { size: 12, bold: true })
  pdf.text(`${enr?.schools?.name ?? ''}${enr ? `   |   Grade ${enr.grade}${enr.section ?? ''}` : ''}`)

  pdf.heading('Summary')
  pdf.text(r.summary)
  pdf.heading('Strengths (points from verified records)')
  pdf.bars(r.radar.map((x) => ({ label: x.skill, value: x.points })))

  if (mode === 'yearend') {
    pdf.heading('Activities and wins per year')
    pdf.table(['Year', 'Activities', 'Wins'], r.yearlyData.map((y) => [y.year, String(y.activities), String(y.wins)]), [120, 100, 100])
    if (r.trend.length) {
      pdf.heading('Grand Test subject marks (% of marks)')
      const w = Math.floor((495 - 150) / Math.max(1, r.subjects.length))
      pdf.table(['Test', ...r.subjects], r.trend.map((t) => [String(t.test), ...r.subjects.map((x) => String(t[x] ?? ''))]), [150, ...r.subjects.map(() => w)])
    }
    pdf.heading('Areas to grow and not yet explored')
    if (r.toGrow.length) pdf.text(`Areas to grow: ${r.toGrow.join(', ')}.`)
    if (r.notExplored.length) pdf.text(`Not yet explored: ${r.notExplored.join(', ')}.`)
    pdf.heading('Suggested next steps')
    r.tips.forEach((t) => pdf.text('- ' + t, { indent: 8 }))
  }

  const list = (mode === 'yearend' ? verified.filter((a) => a.academic_year === year) : verified)
    .sort((a, b) => b.achieved_on.localeCompare(a.achieved_on))
  pdf.heading(mode === 'yearend' ? `Verified records in ${year}` : 'All verified records')
  pdf.table(['Date', 'Title', 'Program', 'Level', 'Result'],
    list.map((a) => [a.achieved_on, a.title, words(a.category), a.level, words(a.result)]), [62, 196, 100, 62, 75])
  pdf.text('This reflects only activities recorded in portfolio@lerne and is guidance, not a final judgement.', { size: 8 })

  return pdfResponse(await pdf.finish(), `${s.lerne_id}-${mode}.pdf`)
}
