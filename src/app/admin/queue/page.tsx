import { redirect } from 'next/navigation'
import { flash } from '@/lib/flash'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { audit } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyFamily } from '@/lib/notify'
import AdminNav from '@/components/AdminNav'

async function review(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const id = String(formData.get('id'))
  const outcome = String(formData.get('outcome'))
  const skills = formData.getAll('skills').map(String)
  if (outcome === 'verified' && skills.length === 0) return flash('Pick at least one skill area before approving.', 'error')
  const { error } = await supabase.from('achievements').update({
    status: outcome,
    review_note: String(formData.get('note') || ''),
    verified_by: user?.id,
    verified_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return flash('Could not save the decision. Please try again.', 'error')
  await audit(supabase, `verify_${outcome}`, 'achievements', id)
  const { data: ach } = await supabase.from('achievements').select('student_id, title').eq('id', id).single()
  if (ach && !error) {
    const note = String(formData.get('note') || '')
    const msg = outcome === 'verified'
      ? ['Achievement verified', `"${ach.title}" is now verified by Lerne.`]
      : outcome === 'needs_more_proof'
        ? ['More proof needed', `"${ach.title}": ${note || 'please add more proof.'}`]
        : ['Achievement not approved', `"${ach.title}": ${note || 'it could not be verified.'}`]
    await notifyFamily([ach.student_id], msg[0], msg[1])
  }
  if (!error && outcome === 'verified') {
    await supabase.from('achievement_skills').upsert(skills.map((skill_code) => ({ achievement_id: id, skill_code })))
  }
  await flash('Decision saved and the family notified.')
  revalidatePath('/admin/queue')
}

export default async function Queue() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'lerne_admin') redirect('/')

  const { data: items } = await supabase
    .from('achievements')
    .select('id, title, external_type, level, result, achieved_on, organiser, description, proof_url, proof_path, created_at, students(full_name, lerne_id)')
    .eq('status', 'pending')
    .order('created_at')
  const { data: skills } = await supabase.from('skill_areas').select('code, name')
  const admin = createAdminClient()
  const signed = new Map<string, string>()
  await Promise.all((items ?? []).filter((a: any) => a.proof_path).map(async (a: any) => {
    const { data } = await admin.storage.from('proofs').createSignedUrl(a.proof_path, 3600)
    if (data) signed.set(a.id, data.signedUrl)
  }))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-4 text-2xl font-semibold">Verification queue ({items?.length ?? 0})</h1>
      {(items ?? []).map((a: any) => (
        <form key={a.id} action={review} className="mb-6 rounded border p-4">
          <input type="hidden" name="id" value={a.id} />
          <div className="font-medium">{a.title}</div>
          {(() => { const d = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400000); return <span className={`badge ${d > 14 ? 'badge-late' : 'badge-pending'}`}>{d === 0 ? 'Today' : `Waiting ${d} day${d === 1 ? '' : 's'}`}{d > 14 ? ' · past 14 days' : ''}</span> })()}
          <div className="text-sm text-gray-600">
            {a.students?.full_name} ({a.students?.lerne_id}) · {a.external_type} · {a.level} · {a.result} · {a.achieved_on}
          </div>
          <p className="my-2 text-sm">{a.description}</p>
          {a.proof_url && <a href={a.proof_url} target="_blank" rel="noreferrer" className="mr-4 text-sm text-blue-600 underline">Open proof link</a>}
          {signed.get(a.id) && <a href={signed.get(a.id)} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">Open uploaded file</a>}
          <fieldset className="my-3 text-sm">
            <legend className="mb-1 font-medium">Skill areas (required to verify)</legend>
            {(skills ?? []).map((s) => (
              <label key={s.code} className="mr-4 inline-block">
                <input type="checkbox" name="skills" value={s.code} /> {s.name}
              </label>
            ))}
          </fieldset>
          <input name="note" placeholder="Note to family (needed for more proof / reject)" className="mb-3 w-full rounded border p-2" />
          <button name="outcome" value="verified" className="mr-2 rounded bg-green-600 px-3 py-1 text-white">Approve</button>
          <button name="outcome" value="needs_more_proof" className="mr-2 rounded border px-3 py-1">Ask for more proof</button>
          <button name="outcome" value="rejected" className="rounded border px-3 py-1 text-red-600">Reject</button>
        </form>
      ))}
      {(items ?? []).length === 0 && <p className="text-gray-500">Nothing waiting for review.</p>}
    </main>
  )
}
