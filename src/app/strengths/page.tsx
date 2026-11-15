import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { flash } from '@/lib/flash'
import { createClient } from '@/lib/supabase/server'
import { analyse, type Ach } from '@/lib/strengths'
import StrengthsCharts from '@/components/StrengthsCharts'
import PayButton from '@/components/PayButton'

function currentAcademicYear() {
  const d = new Date()
  const start = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

// For students and parents only: this page includes the private "Areas to grow" section.
async function requestMentor(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('data_requests').insert({
    student_id: String(formData.get('student_id')), requested_by: user!.id, kind: 'other',
    note: 'Mentor session request: ' + (String(formData.get('note') || '').trim() || 'please contact me'),
  })
  if (error) return flash('Could not send the request. Please try again.', 'error')
  await flash('Thank you. The Lerne team will contact you about a mentor session.')
  revalidatePath('/strengths')
}

export default async function Strengths() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'parent' && me?.role !== 'student') redirect('/')

  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, aspiration, enrollments(grade, left_on), achievements(category, level, result, achieved_on, academic_year, title, status, subject_scores, achievement_skills(skill_code))')
    .order('full_name')
  const mentorPrice = Number(process.env.MENTOR_SESSION_PRICE_INR)
  const { data: sessions } = await supabase.from('mentor_sessions').select('student_id, status, scheduled_for')
  const { data: ai } = await supabase.from('ai_summaries').select('student_id, text').eq('approved', true).order('academic_year', { ascending: false })

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/records" className="text-sm text-blue-600 underline">Back to records</Link>
      <h1 className="my-4 text-2xl font-semibold">Strengths &amp; next steps</h1>
      {(students ?? []).map((s) => {
        const verified = ((s.achievements ?? []) as unknown as (Ach & { status: string })[]).filter((a) => a.status === 'verified')
        const grade = (s.enrollments as { grade: number; left_on: string | null }[] | null)?.find((e) => e.left_on === null)?.grade ?? null
        const r = analyse(verified, currentAcademicYear(), grade, s.aspiration)
        return (
          <section key={s.id} className="mb-12">
            <h2 className="mb-3 text-xl font-semibold">{s.full_name}</h2>
            {ai?.find((x) => x.student_id === s.id) && <p className="mb-4 rounded border p-4 text-sm">{ai.find((x) => x.student_id === s.id)!.text}</p>}
            <p className="mb-6 rounded bg-blue-50 p-4 text-sm">{r.summary}</p>
            <StrengthsCharts radar={r.radar} yearly={r.yearlyData} trend={r.trend} subjects={r.subjects} />

            {r.highestByArea.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-2 font-medium">Highest level reached</h3>
                <ul className="text-sm">{r.highestByArea.map((h) => <li key={h.area}>{h.area}: {h.level}</li>)}</ul>
              </div>
            )}

            <div className="mt-8 rounded border p-4">
              <h3 className="mb-2 font-medium">Areas to grow &amp; not yet explored (private to you)</h3>
              {r.toGrow.length > 0 && <p className="text-sm">Areas to grow: {r.toGrow.join(', ')}. This comes from Grand Test marks.</p>}
              {r.notExplored.length > 0 && <p className="text-sm">Not yet explored: {r.notExplored.join(', ')}.</p>}
              {r.toGrow.length === 0 && r.notExplored.length === 0 && <p className="text-sm text-gray-500">Nothing to show yet.</p>}
            </div>

            <div className="mt-6">
              <h3 className="mb-2 font-medium">Suggested next steps</h3>
              <ul className="list-disc pl-5 text-sm">{r.tips.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <p className="mt-6 text-xs text-gray-500">
              This reflects only activities recorded in portfolio@lerne and is guidance, not a final judgement.
            </p>
            {me?.role === 'parent' && (
              <div className="mt-6 grid gap-2 rounded border p-4 text-sm">
                <b>One-to-one session with a Lerne mentor (optional, paid)</b>
                <p className="text-gray-600">Talk through this report with a mentor. After payment the Lerne team contacts you to fix a time.</p>
                {(sessions ?? []).filter((x) => x.student_id === s.id).map((x, i) => (
                  <p key={i} className="rounded bg-blue-50 p-2">Session {x.status === 'paid' ? 'paid, waiting to be scheduled' : x.status === 'scheduled' ? `scheduled: ${x.scheduled_for}` : 'done'}</p>
                ))}
                {mentorPrice > 0 ? (
                  <div><p className="mb-2 font-medium">₹{mentorPrice} per session</p><PayButton kind="mentor" studentId={s.id} label="Book a session" /></div>
                ) : (
                  <form action={requestMentor} className="grid gap-2">
                    <input type="hidden" name="student_id" value={s.id} />
                    <input name="note" placeholder="Anything you would like to discuss (optional)" className="rounded border p-2" />
                    <button className="rounded border px-3 py-2">Request a session</button>
                  </form>
                )}
              </div>
            )}
          </section>
        )
      })}
      {(students ?? []).length === 0 && <p>No student record found for this account.</p>}
    </main>
  )
}
