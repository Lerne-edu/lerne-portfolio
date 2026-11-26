import Link from 'next/link'
import { requireAdmin } from '@/lib/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from '@/components/AdminNav'

// Lerne admin only: who has signed in, split into Students, Parents, Individuals, School and Lerne team.
const GROUPS: [string, string][] = [['all', 'All'], ['student', 'Students'], ['parent', 'Parents'], ['individual', 'Individuals'], ['school', 'School / Team'], ['team', 'Lerne team']]
const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'Never'

export default async function SignIns({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  await requireAdmin()
  const who = (await searchParams).who ?? 'all'
  const admin = createAdminClient()

  // every login (Supabase keeps the last sign-in time)
  const users: { id: string; email?: string; created_at: string; last_sign_in_at?: string | null }[] = []
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    users.push(...(data?.users ?? []))
    if ((data?.users ?? []).length < 1000) break
  }

  const [{ data: profiles }, { data: schools }, { data: students }, { data: parents }, { data: links }, { data: enrols }] = await Promise.all([
    admin.from('profiles').select('id, role, full_name, school_id'),
    admin.from('schools').select('id, name'),
    admin.from('students').select('id, user_id, lerne_id'),
    admin.from('parents').select('id, user_id'),
    admin.from('student_parents').select('student_id, parent_id'),
    admin.from('enrollments').select('student_id'),
  ])
  const schoolName = new Map((schools ?? []).map((s) => [s.id, s.name]))
  const lerneId = new Map((students ?? []).filter((s) => s.user_id).map((s) => [s.user_id, s.lerne_id]))
  const enrolled = new Set((enrols ?? []).map((e) => e.student_id))
  const parentOf = new Map((parents ?? []).map((p) => [p.user_id, p.id]))
  // a parent is an "individual" when none of their children is enrolled in a partner school
  const kids = new Map<string, string[]>()
  for (const l of links ?? []) kids.set(l.parent_id, [...(kids.get(l.parent_id) ?? []), l.student_id])
  const byId = new Map(users.map((u) => [u.id, u]))

  const rows = (profiles ?? []).map((p) => {
    const u = byId.get(p.id)
    let group = 'team'
    if (p.role === 'student') group = 'student'
    else if (p.role === 'school_admin' || p.role === 'teacher') group = 'school'
    else if (p.role === 'parent') {
      const mine = kids.get(parentOf.get(p.id) ?? '') ?? []
      group = mine.some((s) => enrolled.has(s)) ? 'parent' : 'individual'
    }
    return {
      id: p.id, group, name: p.full_name, role: p.role as string,
      login: p.role === 'student' ? lerneId.get(p.id) ?? u?.email ?? '' : u?.email ?? '',
      school: p.school_id ? schoolName.get(p.school_id) ?? '' : '',
      last: u?.last_sign_in_at ?? null, joined: u?.created_at ?? null,
    }
  }).sort((a, b) => (b.last ?? '').localeCompare(a.last ?? ''))

  const now = Date.now()
  const count = (g: string, days: number) => rows.filter((r) => (g === 'all' || r.group === g) && r.last && now - new Date(r.last).getTime() < days * 864e5).length
  const total = (g: string) => rows.filter((r) => g === 'all' || r.group === g).length
  const shown = rows.filter((r) => who === 'all' || r.group === who)

  return (
    <main className="mx-auto max-w-5xl p-6">
      <AdminNav />
      <h1 className="mb-1 text-2xl font-semibold">Sign-in activity</h1>
      <p className="mb-4 text-sm text-gray-600">Who has signed in, grouped by type. Times are in India time.</p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {GROUPS.filter(([k]) => k !== 'all').map(([k, label]) => (
          <Link key={k} href={`/admin/signins?who=${k}`} className="rounded border p-3 hover:bg-gray-50">
            <p className="text-xs text-gray-600">{label}</p>
            <p className="text-xl font-semibold">{total(k)}</p>
            <p className="text-xs text-gray-600">{count(k, 1)} today · {count(k, 7)} this week</p>
          </Link>
        ))}
      </div>

      <div className="tabs">
        {GROUPS.map(([k, label]) => <Link key={k} href={`/admin/signins?who=${k}`} className={`tab ${who === k ? 'active' : ''}`}>{label}</Link>)}
      </div>

      <table className="w-full text-sm">
        <thead><tr className="text-left text-gray-600"><th>Name</th><th>Type</th><th>Login (email / Lerne ID)</th><th>School</th><th>Last sign-in</th><th>Created</th></tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-1 pr-2">{r.name}</td>
              <td className="pr-2">{GROUPS.find(([k]) => k === r.group)?.[1]}{r.role === 'teacher' ? ' (teacher)' : r.role === 'school_admin' ? ' (admin)' : ''}</td>
              <td className="pr-2">{r.login}</td>
              <td className="pr-2">{r.school}</td>
              <td className="pr-2">{fmt(r.last)}</td>
              <td>{fmt(r.joined)}</td>
            </tr>
          ))}
          {shown.length === 0 && <tr><td colSpan={6} className="py-3 text-gray-600">No one in this group yet.</td></tr>}
        </tbody>
      </table>
    </main>
  )
}