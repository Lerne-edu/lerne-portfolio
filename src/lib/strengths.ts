// Strengths scoring: only verified records are passed in. Points = level x result.
export type Ach = {
  category: string; level: string; result: string; achieved_on: string; academic_year: string; title: string
  subject_scores: Record<string, number> | null
  achievement_skills: { skill_code: string }[]
}

export const SKILL_NAMES: Record<string, string> = {
  research_science: 'Research & Science',
  writing_comm: 'Writing & Communication',
  innovation: 'Innovation & Problem-solving',
  maths_logic: 'Maths & Logic',
  academics: 'Academics',
  creativity_arts: 'Creativity & Arts',
  leadership: 'Leadership & Teamwork',
  sports: 'Sports & Fitness',
}
export const LEVEL_ORDER = ['school', 'district', 'state', 'national', 'international']
export const LEVEL_POINTS: Record<string, number> = { school: 1, district: 2, state: 3, national: 4, international: 5 }
export const RESULT_MULT: Record<string, number> = { participation: 1, selected_published: 2, winner: 3 }
const SUBJECT_NAMES: Record<string, string> = { maths: 'Maths', science: 'Science', english: 'English', social_studies: 'Social Studies' }

const FIELDS: Record<string, string> = {
  research_science: 'pure and applied sciences, medicine and life sciences, research careers',
  maths_logic: 'engineering, data science, statistics, economics, chartered accountancy',
  writing_comm: 'law, journalism, mass communication, literature, public policy',
  innovation: 'engineering, product design, entrepreneurship',
  creativity_arts: 'design, architecture, fine and performing arts, media',
  leadership: 'management, law, civil services, social work',
}
const EXAMS: Record<string, string> = {
  research_science: 'NEET UG for medicine and life sciences; CUET or university tests for pure sciences',
  maths_logic: 'JEE Main for engineering; CUET for statistics and economics; CA Foundation for chartered accountancy',
  writing_comm: 'CLAT for law; CUET and media institute tests',
  innovation: 'JEE Main; UCEED or NID DAT for product design',
  creativity_arts: 'UCEED, NID DAT, NATA (architecture)',
  leadership: 'CUET; IPMAT for integrated management',
}
const NEXT_PROGRAM: Record<string, string> = {
  research_science: 'submit to the Scientific Journal',
  writing_comm: 'submit to the Scientific Journal or Publications',
  innovation: 'join the Innovation and Patent Cell',
  maths_logic: 'take the next Grand Test and maths Challenges',
  academics: 'take the next Grand Test',
  creativity_arts: 'send work to the magazine through Publications',
  leadership: 'join a team Challenge',
  sports: 'add sports achievements through Add Achievement',
}

const prevYear = (y: string) => `${parseInt(y) - 1}-${String(parseInt(y) % 100).padStart(2, '0')}`

export function analyse(achs: Ach[], currentYear: string, grade: number | null, aspiration: string | null, forSchool = false) {
  const points: Record<string, number> = {}
  const count: Record<string, number> = {}
  const perYear: Record<string, Record<string, number>> = {}
  const bestLevel: Record<string, number> = {}
  const yearly: Record<string, { activities: number; wins: number }> = {}
  let highest = -1

  for (const a of achs) {
    const pts = (LEVEL_POINTS[a.level] ?? 1) * (RESULT_MULT[a.result] ?? 1)
    const lvl = LEVEL_ORDER.indexOf(a.level)
    highest = Math.max(highest, lvl)
    const y = (yearly[a.academic_year] ??= { activities: 0, wins: 0 })
    y.activities++
    if (a.result === 'winner') y.wins++
    for (const { skill_code: s } of a.achievement_skills) {
      points[s] = (points[s] ?? 0) + pts
      count[s] = (count[s] ?? 0) + 1
      ;(perYear[s] ??= {})[a.academic_year] = (perYear[s][a.academic_year] ?? 0) + 1
      bestLevel[s] = Math.max(bestLevel[s] ?? -1, lvl)
    }
  }

  const skills = Object.keys(SKILL_NAMES)
  const radar = skills.map((s) => ({ skill: SKILL_NAMES[s], points: points[s] ?? 0 }))
  const top = skills.filter((s) => (points[s] ?? 0) > 0).sort((a, b) => points[b] - points[a]).slice(0, 3)
  const yearlyData = Object.keys(yearly).sort().map((y) => ({ year: y, activities: yearly[y].activities, wins: yearly[y].wins }))
  const highestByArea = skills.filter((s) => s in bestLevel).map((s) => ({ area: SKILL_NAMES[s], level: LEVEL_ORDER[bestLevel[s]] }))

  // Growth: most improvement this year compared with last year
  let growing: string | null = null
  let bestDiff = 1
  for (const s of skills) {
    const cur = perYear[s]?.[currentYear] ?? 0
    const prev = perYear[s]?.[prevYear(currentYear)] ?? 0
    if (cur - prev > bestDiff) { bestDiff = cur - prev; growing = `${SKILL_NAMES[s]} (${cur} activities this year, ${prev} last year)` }
  }

  // Grand Test subject trend; "areas to grow" come only from measured marks
  const tests = achs.filter((a) => a.category === 'grand_test' && a.subject_scores).sort((a, b) => a.achieved_on.localeCompare(b.achieved_on))
  const trend = tests.map((t) => {
    const sc = t.subject_scores!
    const max = sc.max || 100
    const row: Record<string, string | number> = { test: t.title }
    for (const sub of Object.keys(SUBJECT_NAMES)) if (sub in sc) row[SUBJECT_NAMES[sub]] = Math.round((sc[sub] / max) * 100)
    return row
  })
  const avg: Record<string, number> = {}
  for (const sub of Object.values(SUBJECT_NAMES)) {
    const vals = trend.map((r) => r[sub]).filter((v): v is number => typeof v === 'number')
    if (vals.length) avg[sub] = vals.reduce((x, y) => x + y, 0) / vals.length
  }
  const mean = Object.values(avg).reduce((x, y) => x + y, 0) / (Object.keys(avg).length || 1)
  const toGrow = Object.keys(avg).length >= 2
    ? Object.keys(avg).filter((s) => avg[s] < mean - 10).sort((a, b) => avg[a] - avg[b]).slice(0, 2)
    : []
  const notExplored = skills.filter((s) => !count[s]).map((s) => SKILL_NAMES[s])

  // Summary in plain language
  const parts: string[] = []
  if (top.length) parts.push(`Top strengths: ${top.slice(0, 2).map((s) => SKILL_NAMES[s]).join(' and ')}.`)
  if (growing) parts.push(`Growing fast: ${growing}.`)
  if (highest >= 0) parts.push(`Highest level: ${LEVEL_ORDER[highest]}.`)
  if (!forSchool && toGrow.length) parts.push(`Areas to grow: ${toGrow.join(', ')} (Grand Test marks are lower than in other subjects).`)
  if (!forSchool && notExplored.length) parts.push(`Not yet explored: ${notExplored.slice(0, 3).join(', ')}.`)
  const summary = achs.length === 0
    ? 'No verified records yet. Strengths will appear here as achievements are verified.'
    : parts.join(' ')

  // Suggestions by grade
  const tips: string[] = []
  if (grade !== null && grade <= 8) {
    tips.push('Explore widely. Try a Lerne program in an area you have not explored yet.')
    for (const s of skills.filter((x) => !count[x] && NEXT_PROGRAM[x]).slice(0, 2)) tips.push(`${SKILL_NAMES[s]}: ${NEXT_PROGRAM[s]}.`)
  } else if (grade !== null && grade <= 10) {
    const streams: string[] = []
    if (top.some((s) => ['research_science', 'maths_logic'].includes(s))) streams.push('Science')
    if (top.some((s) => ['maths_logic', 'leadership'].includes(s))) streams.push('Commerce')
    if (top.some((s) => ['writing_comm', 'creativity_arts', 'leadership'].includes(s))) streams.push('Humanities')
    tips.push(streams.length ? `Streams worth exploring: ${[...new Set(streams)].join(', ')}, based on your strengths and Grand Test marks.` : 'Keep adding activities; stream guidance appears once there are strengths to compare.')
  } else if (grade !== null) {
    for (const s of top.slice(0, 2)) if (FIELDS[s]) tips.push(`${SKILL_NAMES[s]}: ${FIELDS[s]}. Related exams: ${EXAMS[s]}. Check current exam details before planning.`)
  }
  if (aspiration) tips.push(`Your interest: ${aspiration}. Keep it in mind when choosing the next activity.`)
  for (const s of top.slice(0, 2)) if (NEXT_PROGRAM[s]) tips.push(`Strong in ${SKILL_NAMES[s]}: ${NEXT_PROGRAM[s]}.`)

  return { radar, topNames: top.map((s) => SKILL_NAMES[s]), yearlyData, trend, subjects: Object.values(SUBJECT_NAMES).filter((s) => s in avg), summary, highestByArea,
    // The school never receives the private sections
    toGrow: forSchool ? [] : toGrow, notExplored: forSchool ? [] : notExplored, tips: forSchool ? [] : tips }
}

export function currentAcademicYear() {
  const d = new Date()
  const start = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}
