import { redirect } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { audit } from '@/lib/audit'
import { notifyFamily } from '@/lib/notify'
import AdminNav from '@/components/AdminNav'

type Row = Record<string, string>

const CATEGORIES = ['grand_test', 'skill_labs', 'challenges', 'scientific_journal', 'publications', 'innovation_patent_cell']
const LEVELS = ['school', 'district', 'state', 'national', 'international']
const SKILLS = ['research_science', 'writing_comm', 'innovation', 'maths_logic', 'academics', 'creativity_arts', 'leadership', 'sports']
const RESULTS: Record<string, string> = {
  participation: 'participation', participated: 'participation', participant: 'participation',
  selected: 'selected_published', published: 'selected_published', selected_published: 'selected_published',
  winner: 'winner', won: 'winner', top: 'winner',
}
// Lerne programs are tagged automatically; the skill_areas column overrides this
const DEFAULT_SKILLS: Record<string, string[]> = {
  grand_test: ['academics'],
  skill_labs: ['writing_comm'],
  challenges: ['innovation'],
  scientific_journal: ['research_science', 'writing_comm'],
  publications: ['writing_comm'],
  innovation_patent_cell: ['innovation', 'research_science'],
}
const SUBJECTS = ['maths', 'science', 'english', 'social_studies']

function academicYear(d: string) {
  const dt = new Date(d)
  const start = dt.getMonth() >= 5 ? dt.getFullYear() : dt.getFullYear() - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}
const keyOf = (a: { student_id: string; category: string; title: string; achieved_on: string }) =>
  `${a.student_id}|${a.category}|${a.title}|${a.achieved_on}`

async function upload(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'lerne_admin') redirect('/')

  const schoolId = String(formData.get('school_id'))
  const file = formData.get('file') as File
  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]], { raw: false, dateNF: 'yyyy-mm-dd', defval: '' })
  const errs: string[] = []

  // Students in this file who are enrolled at the chosen school
  const ids = [...new Set(rows.map((r) => String(r.lerne_id).trim().toUpperCase()).filter(Boolean))]
  const students = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from('students').select('id, lerne_id, enrollments(school_id)').in('lerne_id', ids.slice(i, i + 200))
    data?.forEach((s) => {
      if ((s.enrollments as { school_id: string }[]).some((e) => e.school_id === schoolId)) students.set(s.lerne_id, s.id)
    })
  }

  const records: Record<string, unknown>[] = []
  const skillsByKey = new Map<string, string[]>()
  rows.forEach((r, i) => {
    const line = i + 2
    const lid = String(r.lerne_id).trim().toUpperCase()
    const category = String(r.category).trim().toLowerCase()
    const level = String(r.level).trim().toLowerCase()
    const result = RESULTS[String(r.result).trim().toLowerCase()]
    const date = String(r.achieved_on).trim()
    const title = String(r.title).trim()
    const sid = students.get(lid)
    if (!sid) return void errs.push(`row ${line}: ${lid || 'no Lerne ID'} not found at this school`)
    if (!CATEGORIES.includes(category)) return void errs.push(`row ${line}: category must be one of ${CATEGORIES.join(', ')}`)
    if (!LEVELS.includes(level)) return void errs.push(`row ${line}: level must be one of ${LEVELS.join(', ')}`)
    if (!result) return void errs.push(`row ${line}: result must be participation, selected_published or winner`)
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return void errs.push(`row ${line}: needs title and achieved_on (YYYY-MM-DD)`)

    // Grand Test stores marks per subject
    const max = Number(r.max_marks) || 100
    const scores: Record<string, number> = {}
    for (const sub of SUBJECTS) {
      const v = String(r['score_' + sub] ?? '').trim()
      if (v !== '' && !isNaN(Number(v))) scores[sub] = Number(v)
    }
    if (category === 'grand_test' && Object.keys(scores).length === 0) {
      return void errs.push(`row ${line}: Grand Test needs subject marks (score_maths, score_science, ...)`)
    }

    let skills = String(r.skill_areas).split(/[;,]/).map((x) => x.trim()).filter(Boolean)
    if (skills.length === 0) skills = [...DEFAULT_SKILLS[category], ...(category === 'grand_test' && 'maths' in scores ? ['maths_logic'] : [])]
    const bad = skills.find((x) => !SKILLS.includes(x))
    if (bad) return void errs.push(`row ${line}: unknown skill area "${bad}"`)

    const rec = {
      student_id: sid, category, title, level, result, achieved_on: date, academic_year: academicYear(date),
      organiser: String(r.organiser).trim() || null, description: String(r.description).trim() || null,
      subject_scores: Object.keys(scores).length ? { ...scores, max } : null,
      source: 'lerne_program', created_by: user!.id,
    }
    records.push(rec)
    skillsByKey.set(keyOf(rec as never), skills)
  })

  let inserted = 0, skipped = 0
  const notified = new Set<string>()
  for (let i = 0; i < records.length; i += 200) {
    const chunk = records.slice(i, i + 200)
    const { data, error } = await supabase.from('achievements')
      .upsert(chunk, { onConflict: 'student_id,category,title,achieved_on', ignoreDuplicates: true })
      .select('id, student_id, category, title, achieved_on')
    if (error || !data) { errs.push(`save failed: ${error?.message}`); continue }
    inserted += data.length
    data.forEach((a) => notified.add(a.student_id))
    skipped += chunk.length - data.length
    const tags = data.flatMap((a) => (skillsByKey.get(keyOf(a)) ?? []).map((skill_code) => ({ achievement_id: a.id, skill_code })))
    if (tags.length) await supabase.from('achievement_skills').upsert(tags, { onConflict: 'achievement_id,skill_code', ignoreDuplicates: true })
  }

  await notifyFamily([...notified], 'Results are out', "New results have been added to your child's portfolio.")
  await audit(supabase, 'upload_program_results', 'schools', schoolId)
  const more = errs.length > 8 ? ` (+${errs.length - 8} more)` : ''
  redirect(`/admin/results?i=${inserted}&s=${skipped}&n=${errs.length}&e=${encodeURIComponent(errs.slice(0, 8).join(' | ') + more)}`)
}

export default async function Results({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'lerne_admin') redirect('/')
  const { data: schools } = await supabase.from('schools').select('id, school_code, name').order('school_code')

  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-2 text-2xl font-semibold">Upload program results</h1>
      <p className="mb-2 text-sm text-gray-600">
        One Excel or CSV per school. <a href="/admin/results/template" className="text-blue-600 underline">Download template</a>.
        Results are marked Verified by Lerne and tagged to skill areas automatically. Re-uploading the same file adds nothing twice.
      </p>
      <p className="mb-4 text-xs text-gray-500">
        category: {CATEGORIES.join(', ')} · level: {LEVELS.join(', ')} · result: participation, selected_published, winner ·
        Grand Test rows need marks per subject.
      </p>
      <form action={upload} className="grid gap-2 rounded border p-4">
        <select name="school_id" required className="rounded border p-2">
          <option value="">Choose school</option>
          {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}
        </select>
        <input name="file" type="file" accept=".xlsx,.xls,.csv" required className="rounded border p-2" />
        <button className="rounded bg-blue-600 p-2 text-white">Upload results</button>
      </form>
      {sp.i !== undefined && (
        <div className="mt-6 rounded border p-4 text-sm">
          <p>Added: {sp.i} · Already there, skipped: {sp.s} · Problems: {sp.n}</p>
          {sp.e && <p className="mt-2 text-red-600">{sp.e}</p>}
        </div>
      )}
    </main>
  )
}
