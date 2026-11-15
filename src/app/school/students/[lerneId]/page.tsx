import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { flash } from '@/lib/flash'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { audit } from '@/lib/audit'
import { analyse, currentAcademicYear, type Ach } from '@/lib/strengths'
import StrengthsCharts from '@/components/StrengthsCharts'

async function endorse(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user!.id).single()
  const text = String(formData.get('text')).trim()
  if (me?.role !== 'teacher' || !text) return flash('Could not add the endorsement.', 'error')
  await supabase.from('endorsements').insert({ student_id: String(formData.get('student_id')), teacher_id: user!.id, teacher_name: me.full_name, text })
  await flash('Endorsement added.')
  revalidatePath('/school/students')
}

// View only. The school sees strengths and progress, never "Areas to grow" or suggestions.
export default async function StudentView({ params }: { params: Promise<{ lerneId: string }> }) {
  const { lerneId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isTeacher = me?.role === 'teacher'
  if (me?.role !== 'school_admin' && !isTeacher) redirect('/')

  const { data: s } = await supabase
    .from('students')
    .select('id, full_name, lerne_id, enrollments(grade, section, admission_no, left_on), achievements(category, level, result, achieved_on, academic_year, title, status, subject_scores, achievement_skills(skill_code))')
    .eq('lerne_id', decodeURIComponent(lerneId))
    .single()
  if (!s) notFound()
  await audit(supabase, 'school_view_student', 'students', s.lerne_id)

  const e = (s.enrollments as { grade: number; section: string | null; admission_no: string | null; left_on: string | null }[]).find((x) => x.left_on === null)
  const { data: ends } = await supabase.from('endorsements').select('text, teacher_name, created_at').eq('student_id', s.id).order('created_at', { ascending: false })
  const verified = (s.achievements as unknown as (Ach & { status: string })[]).filter((a) => a.status === 'verified')
  const r = analyse(verified, currentAcademicYear(), e?.grade ?? null, null, true)

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/school" className="text-sm text-blue-600 underline">Back to dashboard</Link>
      <h1 className="mt-4 text-2xl font-semibold">{s.full_name}</h1>
      <p className="mb-4 text-sm text-gray-600">{s.lerne_id} · Grade {e?.grade}{e?.section} · Admission no {e?.admission_no}</p>
      <p className="mb-6 rounded bg-blue-50 p-4 text-sm">{r.summary}</p>
      <StrengthsCharts radar={r.radar} yearly={r.yearlyData} trend={r.trend} subjects={r.subjects} />
      <h2 className="mb-2 mt-8 font-medium">Teacher endorsements</h2>
      <ul className="mb-3 space-y-2">
        {(ends ?? []).map((n, i) => (
          <li key={i} className="rounded border p-3 text-sm">{n.text}<div className="mt-1 text-xs text-gray-500">{n.teacher_name} · {new Date(n.created_at).toLocaleDateString('en-IN')}</div></li>
        ))}
        {(ends ?? []).length === 0 && <li className="text-sm text-gray-500">None yet.</li>}
      </ul>
      {isTeacher && (
        <form action={endorse} className="mb-4 grid gap-2 text-sm">
          <input type="hidden" name="student_id" value={s.id} />
          <textarea name="text" required placeholder="Write a short, positive endorsement" className="rounded border p-2" />
          <button className="rounded border px-3 py-2">Add endorsement</button>
        </form>
      )}
      <h2 className="mb-2 mt-8 font-medium">Records</h2>
      <ul className="space-y-2">
        {[...verified].sort((a, b) => b.achieved_on.localeCompare(a.achieved_on)).map((a, i) => (
          <li key={i} className="rounded border p-3 text-sm">
            <div className="font-medium">{a.title}</div>
            <div className="text-gray-600">{a.category.replace(/_/g, ' ')} · {a.level} · {a.result.replace(/_/g, ' ')} · {a.achieved_on}</div>
          </li>
        ))}
        {verified.length === 0 && <li className="text-sm text-gray-500">No verified records yet.</li>}
      </ul>
    </main>
  )
}
