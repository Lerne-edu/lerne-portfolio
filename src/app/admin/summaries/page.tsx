import { revalidatePath } from 'next/cache'
import { flash } from '@/lib/flash'
import { requireAdmin } from '@/lib/guards'
import { audit } from '@/lib/audit'
import { analyse, type Ach } from '@/lib/strengths'
import AdminNav from '@/components/AdminNav'

function currentAcademicYear() {
  const d = new Date()
  const start = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

async function loadAnalysis(supabase: Awaited<ReturnType<typeof requireAdmin>>, studentId: string) {
  const { data: s } = await supabase.from('students')
    .select('aspiration, enrollments(grade, left_on), achievements(category, level, result, achieved_on, academic_year, title, status, subject_scores, achievement_skills(skill_code))')
    .eq('id', studentId).single()
  if (!s) return null
  const verified = (s.achievements as unknown as (Ach & { status: string })[]).filter((a) => a.status === 'verified')
  const grade = (s.enrollments as { grade: number; left_on: string | null }[]).find((e) => e.left_on === null)?.grade ?? null
  return { grade, aspiration: s.aspiration, r: analyse(verified, currentAcademicYear(), grade, s.aspiration) }
}

// Only scores and the plain-language summary go to the AI: no name, school, Lerne ID or contact details.
async function generate(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const sid = String(formData.get('student_id'))
  const a = await loadAnalysis(supabase, sid)
  if (!a || !process.env.ANTHROPIC_API_KEY) return flash('Could not make a draft. Check ANTHROPIC_API_KEY and try again.', 'error')
  const facts = JSON.stringify({ grade: a.grade, interest: a.aspiration, summary: a.r.summary, points: a.r.radar, suggestions: a.r.tips })
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-5-5', max_tokens: 500,
      system: 'You write a short, warm, plain-language progress summary (about 120 words) for a school student and their parents, from the facts given. Use only the facts. Never invent achievements. Never use the words weak or poor; say "areas to grow" and "not yet explored". End by saying it reflects only activities recorded in portfolio@lerne and is guidance, not a final judgement.',
      messages: [{ role: 'user', content: facts }],
    }),
  })
  const out = await res.json()
  const text = out?.content?.[0]?.text
  if (!text) return flash('Could not make a draft. Check ANTHROPIC_API_KEY and try again.', 'error')
  await supabase.from('ai_summaries').upsert({ student_id: sid, academic_year: currentAcademicYear(), text, approved: false })
  await audit(supabase, 'ai_summary_generated', 'students', sid)
  await flash('Draft created.')
  revalidatePath('/admin/summaries')
}

async function save(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const sid = String(formData.get('student_id'))
  const approve = formData.get('decision') === 'approve'
  await supabase.from('ai_summaries').upsert({ student_id: sid, academic_year: currentAcademicYear(), text: String(formData.get('text')), approved: approve })
  await audit(supabase, approve ? 'ai_summary_approved' : 'ai_summary_saved', 'students', sid)
  await flash('Saved.')
  revalidatePath('/admin/summaries')
}

export default async function Summaries({ searchParams }: { searchParams: Promise<{ lerne?: string }> }) {
  const { lerne } = await searchParams
  const supabase = await requireAdmin()
  const { data: s } = lerne ? await supabase.from('students').select('id, full_name, lerne_id').eq('lerne_id', lerne.trim().toUpperCase()).maybeSingle() : { data: null }
  const a = s ? await loadAnalysis(supabase, s.id) : null
  const { data: draft } = s ? await supabase.from('ai_summaries').select('text, approved').eq('student_id', s.id).eq('academic_year', currentAcademicYear()).maybeSingle() : { data: null }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <AdminNav />
      <h1 className="mb-2 text-2xl font-semibold">AI summaries</h1>
      <p className="mb-4 text-sm text-gray-600">Generate a draft, edit it, and approve it. Families only see approved summaries.</p>
      <form className="mb-6 flex gap-2">
        <input name="lerne" defaultValue={lerne ?? ''} placeholder="Lerne ID" className="flex-1 rounded border p-2" />
        <button className="rounded bg-blue-600 px-4 text-white">Open</button>
      </form>
      {lerne && !s && <p className="text-sm text-gray-600">No student with that Lerne ID.</p>}
      {s && a && (
        <>
          <p className="mb-2 text-sm"><b>{s.full_name}</b> · {s.lerne_id}</p>
          <p className="mb-4 rounded bg-blue-50 p-3 text-sm">{a.r.summary}</p>
          <form action={generate} className="mb-4"><input type="hidden" name="student_id" value={s.id} /><button className="rounded border px-3 py-2 text-sm">{draft ? 'Generate a new draft' : 'Generate draft'}</button></form>
          {draft && (
            <form action={save} className="grid gap-2">
              <input type="hidden" name="student_id" value={s.id} />
              <textarea name="text" defaultValue={draft.text} rows={8} className="rounded border p-2 text-sm" />
              <p className="text-xs text-gray-500">{draft.approved ? 'Approved: families can see this.' : 'Draft: not visible to families.'}</p>
              <div className="flex gap-2">
                <button name="decision" value="approve" className="rounded bg-green-600 px-3 py-2 text-sm text-white">Save and approve</button>
                <button name="decision" value="draft" className="rounded border px-3 py-2 text-sm">Save as draft</button>
              </div>
            </form>
          )}
        </>
      )}
    </main>
  )
}
