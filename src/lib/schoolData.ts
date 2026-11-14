import type { SupabaseClient } from '@supabase/supabase-js'
import { LEVEL_ORDER, LEVEL_POINTS, RESULT_MULT, type Ach } from '@/lib/strengths'

export type Filters = { grade?: string; section?: string; program?: string; level?: string; year?: string; q?: string }
export const PROGRAMS = ['grand_test', 'skill_labs', 'challenges', 'scientific_journal', 'publications', 'innovation_patent_cell', 'external']

type Enr = { grade: number; section: string | null; admission_no: string | null; left_on: string | null }

// Row level security already limits this to current students of the school admin's own school,
// with verified records from the years they studied there.
export async function loadSchoolData(supabase: SupabaseClient, f: Filters) {
  const all: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('students')
      .select('id, lerne_id, full_name, enrollments(grade, section, admission_no, left_on), achievements(category, level, result, achieved_on, academic_year, title, status, subject_scores, achievement_skills(skill_code))')
      .order('full_name')
      .range(from, from + 999)
    all.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const q = (f.q ?? '').trim().toLowerCase()
  const rows = all.map((s) => {
    const e = (s.enrollments as Enr[]).find((x) => x.left_on === null)
    const records = (s.achievements as (Ach & { status: string })[]).filter((a) =>
      a.status === 'verified' &&
      (!f.program || a.category === f.program) &&
      (!f.level || a.level === f.level) &&
      (!f.year || a.academic_year === f.year))
    const points = records.reduce((t, a) => t + (LEVEL_POINTS[a.level] ?? 1) * (RESULT_MULT[a.result] ?? 1), 0)
    const best = records.reduce((m, a) => Math.max(m, LEVEL_ORDER.indexOf(a.level)), -1)
    return {
      id: s.id as string, lerneId: s.lerne_id as string, name: s.full_name as string,
      grade: e?.grade ?? null, section: e?.section ?? '', admissionNo: e?.admission_no ?? '',
      records, points, wins: records.filter((a) => a.result === 'winner').length,
      highest: best >= 0 ? LEVEL_ORDER[best] : '',
    }
  }).filter((r) =>
    (!f.grade || String(r.grade) === f.grade) &&
    (!f.section || r.section.toLowerCase() === f.section.trim().toLowerCase()) &&
    (!q || r.name.toLowerCase().includes(q) || r.admissionNo.toLowerCase().includes(q) || r.lerneId.toLowerCase().includes(q)))

  const pool = rows.flatMap((r) => r.records)
  const programs = PROGRAMS.map((p) => {
    const rec = rows.flatMap((r) => r.records.filter((a) => a.category === p).map(() => r.id))
    return { program: p, records: rec.length, students: new Set(rec).size }
  })
  return {
    rows,
    pool,
    programs,
    totals: { students: rows.length, participating: rows.filter((r) => r.records.length > 0).length, records: pool.length },
    top: [...rows].filter((r) => r.points > 0).sort((a, b) => b.points - a.points).slice(0, 10),
  }
}
