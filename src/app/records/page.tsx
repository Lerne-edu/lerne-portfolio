import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { flash } from '@/lib/flash'
import { Fragment } from 'react'
import { createClient } from '@/lib/supabase/server'
import { sniffKind, MIME, type FileKind } from '@/lib/upload'
import { analyse, currentAcademicYear } from '@/lib/strengths'
import { audit } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'

const LEVELS = ['school', 'district', 'state', 'national', 'international']
const RESULTS = [['participation', 'Participated'], ['selected_published', 'Selected / published'], ['winner', 'Winner / top position']]
const LABEL: Record<string, string> = {
  verified: 'Verified by Lerne', pending: 'Pending', needs_more_proof: 'Needs more proof', rejected: 'Rejected',
}

function academicYear(d: string) {
  const dt = new Date(d)
  const start = dt.getMonth() >= 5 ? dt.getFullYear() : dt.getFullYear() - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

async function decide(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { error: opError } = await supabase.from('consents')
    .update({ status: String(formData.get('status')), decided_at: new Date().toISOString() })
    .eq('id', String(formData.get('id')))
  await audit(supabase, `consent_${String(formData.get('status'))}`, 'consents', String(formData.get('id')))
  if (opError) return flash('Could not save your choice. Please try again.', 'error')
  await flash('Consent updated.')
  revalidatePath('/records')
}

async function addAchievement(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const date = String(formData.get('achieved_on'))
  const sid = String(formData.get('student_id'))
  let proofPath: string | null = null
  const file = formData.get('proof_file') as File | null
  if (file && file.size > 0) {
    // PDF, JPG or PNG up to 4 MB
    if (!(await sniffKind(file)) || file.size > 4 * 1024 * 1024) return flash('Could not add the entry. Files must be PDF, JPG or PNG up to 4 MB.', 'error')
    const { data: mine } = await supabase.from('students').select('id').eq('id', sid).single()
    if (!mine) return flash('Could not add the entry. Files must be PDF, JPG or PNG up to 4 MB.', 'error')
    proofPath = `${sid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await createAdminClient().storage.from('proofs').upload(proofPath, file, { contentType: MIME[(await sniffKind(file)) as FileKind] })
    if (error) return flash('Could not add the entry. Files must be PDF, JPG or PNG up to 4 MB.', 'error')
  }
  const { error: opError } = await supabase.from('achievements').insert({
    student_id: String(formData.get('student_id')),
    category: 'external',
    external_type: String(formData.get('external_type')),
    title: String(formData.get('title')),
    level: String(formData.get('level')),
    result: String(formData.get('result')),
    achieved_on: date,
    academic_year: academicYear(date),
    organiser: String(formData.get('organiser') || ''),
    description: String(formData.get('description') || ''),
    proof_url: String(formData.get('proof_url') || ''),
    proof_path: proofPath,
    source: 'external',
    created_by: user?.id,
  })
  if (opError) return flash('Could not add the entry. Please check the details.', 'error')
  await flash('Submitted for verification.')
  revalidatePath('/records')
}

async function setStudentLogin(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const sid = String(formData.get('student_id'))
  const password = String(formData.get('password'))
  if (password.length < 8) return flash('Could not save the student login. Use a password of 8 or more characters.', 'error')
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  // Row level security returns this student only if the caller is their parent
  const { data: s } = await supabase.from('students').select('id, lerne_id, full_name, user_id').eq('id', sid).single()
  if (!s || me?.role !== 'parent') return flash('Could not save the student login. Use a password of 8 or more characters.', 'error')
  const admin = createAdminClient()
  if (s.user_id) {
    await admin.auth.admin.updateUserById(s.user_id, { password })
  } else {
    const email = `${s.lerne_id.toLowerCase()}@students.lerne.co.in`
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error || !data.user) return flash('Could not save the student login. Use a password of 8 or more characters.', 'error')
    await admin.from('profiles').insert({ id: data.user.id, role: 'student', full_name: s.full_name })
    await admin.from('students').update({ user_id: data.user.id }).eq('id', sid)
  }
  await flash('Student login saved.')
  revalidatePath('/records')
}

async function setPublicProfile(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { error: opError } = await supabase.from('students').update({ public_profile: formData.get('on') === '1' }).eq('id', String(formData.get('student_id')))
  if (opError) return flash('Could not change this. Please try again.', 'error')
  await flash('Public profile updated.')
  revalidatePath('/records')
}

async function toggleRecord(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { error: opError } = await supabase.rpc('set_record_public', { p_id: String(formData.get('id')), p_public: formData.get('on') === '1' })
  if (opError) return flash('Could not change this record.', 'error')
  await flash('Visibility updated.')
  revalidatePath('/records')
}

async function reportSchoolChange(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error: opError } = await supabase.from('school_change_reports').insert({
    student_id: String(formData.get('student_id')), reported_by: user!.id, kind: String(formData.get('kind')),
    new_school_name: String(formData.get('new_school_name') || '') || null, new_city: String(formData.get('new_city') || '') || null,
  })
  if (opError) return flash('Could not send this. Please try again.', 'error')
  await flash('Thank you, we have noted this.')
  revalidatePath('/records')
}

async function resubmitAchievement(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const id = String(formData.get('id'))
  const { data: a } = await supabase.from('achievements').select('student_id').eq('id', id).single()
  if (!a) return flash('Could not send this. Files must be PDF, JPG or PNG up to 4 MB.', 'error')
  let proofPath: string | null = null
  const file = formData.get('proof_file') as File | null
  if (file && file.size > 0) {
    if (!(await sniffKind(file)) || file.size > 4 * 1024 * 1024) return flash('Could not send this. Files must be PDF, JPG or PNG up to 4 MB.', 'error')
    proofPath = `${a.student_id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await createAdminClient().storage.from('proofs').upload(proofPath, file, { contentType: MIME[(await sniffKind(file)) as FileKind] })
    if (error) return flash('Could not send this. Files must be PDF, JPG or PNG up to 4 MB.', 'error')
  }
  const { error: opError } = await supabase.rpc('resubmit_achievement', {
    p_id: id, p_description: String(formData.get('description') || ''),
    p_proof_url: String(formData.get('proof_url') || ''), p_proof_path: proofPath,
  })
  await audit(supabase, 'resubmit_achievement', 'achievements', id)
  if (opError) return flash('Could not send this entry again. Please try again.', 'error')
  await flash('Sent for verification again.')
  revalidatePath('/records')
}

async function deleteAchievement(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const id = String(formData.get('id'))
  const { error: opError } = await supabase.rpc('delete_achievement', { p_id: id })
  await audit(supabase, 'delete_achievement', 'achievements', id)
  if (opError) return flash('Could not delete this entry.', 'error')
  await flash('Entry deleted.')
  revalidatePath('/records')
}

async function confirmChild(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { error } = await supabase.from('consents').update({ identity_confirmed_at: new Date().toISOString() }).eq('id', String(formData.get('id')))
  if (error) return flash('Could not save. Please try again.', 'error')
  await audit(supabase, 'child_confirmed', 'consents', String(formData.get('id')))
  await flash('Thank you. Next, please read and answer the consent question.')
  revalidatePath('/records')
}

async function notMyChild(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('data_requests').insert({
    student_id: String(formData.get('student_id')), requested_by: user!.id, kind: 'correction',
    note: 'The parent says this is NOT their child. Please check the school list and the parent link.',
  })
  if (error) return flash('Could not send this. Please try again.', 'error')
  await flash('Thank you. The Lerne team will check this and contact you.')
  revalidatePath('/records')
}

async function decideSchool(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { error: opError } = await supabase.from('school_consents').update({ status: String(formData.get('status')), decided_at: new Date().toISOString() }).eq('id', String(formData.get('id')))
  await audit(supabase, `school_consent_${String(formData.get('status'))}`, 'school_consents', String(formData.get('id')))
  if (opError) return flash('Could not save your choice. Please try again.', 'error')
  await flash('Saved.')
  revalidatePath('/records')
}

async function requestData(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error: opError } = await supabase.from('data_requests').insert({
    student_id: String(formData.get('student_id')), requested_by: user!.id,
    kind: String(formData.get('kind')), note: String(formData.get('note') || ''),
  })
  if (opError) return flash('Could not send the request. Please try again.', 'error')
  await flash('Request sent to the Lerne team.')
  revalidatePath('/records')
}

// Row level security in the database decides which students and records appear:
// a parent sees their children, a student sees themself.
export default async function Records({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isParent = me?.role === 'parent'
  const { count: unread } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, lerne_id, user_id, dob, outside_school, enrollments(grade, left_on, schools(name)), photo_path, public_profile, consents(id, status, identity_confirmed_at, decided_at), school_consents(id, status, schools(name)), endorsements(text, teacher_name, created_at), achievements(id, title, level, result, achieved_on, status, review_note, is_public, description, proof_url, category, academic_year, subject_scores, achievement_skills(skill_code))')
    .order('full_name')

  // Profile photos (private storage, short-lived links)
  const photoUrls = new Map<string, string>()
  await Promise.all((students ?? []).filter((st) => st.photo_path).map(async (st) => {
    const { data } = await createAdminClient().storage.from('photos').createSignedUrl(st.photo_path as string, 3600)
    if (data) photoUrls.set(st.id, data.signedUrl)
  }))

  // Can this student add records now? (partner school, or an active individual plan)
  const access = new Map<string, boolean>()
  await Promise.all((students ?? []).map(async (st) => {
    const { data } = await supabase.rpc('can_add_records', { sid: st.id })
    access.set(st.id, !!data)
  }))

  return (
    <main className="mx-auto max-w-3xl p-6">
      {(students ?? []).map((s) => {
        const consent = s.consents?.[0]
        // control passes to the student at 18 or after Grade 12
        const adult = new Date(s.dob) <= new Date(new Date().setFullYear(new Date().getFullYear() - 18)) || ((s.enrollments ?? []) as any[]).some((e) => e.grade === 12 && e.left_on)
        const ctl = isParent || adult // parent, or the student once 18
        const verifiedList = (s.achievements ?? []).filter((a) => a.status === 'verified')
        const shining = analyse(verifiedList as any, currentAcademicYear(), null, null, true).topNames.slice(0, 2)
        const achList = [...(s.achievements ?? [])]
          .filter((a) => !area || a.category === area)
          .sort((a, b) => b.achieved_on.localeCompare(a.achieved_on))
        return (
          <section key={s.id} className="mb-10">
            <div className="profile-hero">
              {photoUrls.get(s.id)
                ? <img src={photoUrls.get(s.id)} alt="" className="avatar" />
                : <div className="avatar avatar-empty">{s.full_name.slice(0, 1)}</div>}
              <div className="ph-main">
                <h2>{s.full_name}</h2>
                <div className="ph-chips">
                  <span>{s.lerne_id}</span>
                  {((s.enrollments ?? []) as any[]).find((e) => !e.left_on) && <span>{((s.enrollments ?? []) as any[]).find((e) => !e.left_on)?.schools?.name} · Grade {((s.enrollments ?? []) as any[]).find((e) => !e.left_on)?.grade}</span>}
                  {(s as any).outside_school && <span>{(s as any).outside_school}</span>}
                </div>
                {shining.length > 0 && <p className="ph-shine">Where you&apos;re shining: <b>{shining.join(' · ')}</b></p>}
              </div>
              <div className="ph-actions">
                <a href={`/records/pdf?student=${s.id}&mode=portfolio`}>Portfolio PDF</a>
                <a href={`/records/pdf?student=${s.id}&mode=yearend`}>Year-end report</a>
              </div>
            </div>
            {ctl && (
              <form action={setPublicProfile} className="mb-3 text-sm">
                <input type="hidden" name="student_id" value={s.id} />
                <input type="hidden" name="on" value={s.public_profile ? '0' : '1'} />
                Public profile is <b>{s.public_profile ? 'ON' : 'off'}</b>.{' '}
                <button className="text-blue-600 underline">{s.public_profile ? 'Turn off' : 'Turn on'}</button>
                <span className="text-gray-500"> Visitors need the school and exact Lerne ID, and see only verified records you choose to show.</span>
              </form>
            )}

            {ctl && consent?.status === 'pending' && !consent.identity_confirmed_at && (
              <div className="mb-4 rounded border bg-amber-50 p-5 text-sm">
                <h3 className="mb-2 text-lg">Is this your child?</h3>
                <p className="mb-1"><b>{s.full_name}</b></p>
                <p className="mb-3 text-gray-600">
                  {((s.enrollments ?? []) as any[]).find((e) => !e.left_on)?.schools?.name ?? 'School not listed'}
                  {((s.enrollments ?? []) as any[]).find((e) => !e.left_on) ? `, Grade ${((s.enrollments ?? []) as any[]).find((e) => !e.left_on).grade}` : ''} · {s.lerne_id}
                </p>
                <div className="flex flex-wrap gap-2">
                  <form action={confirmChild}><input type="hidden" name="id" value={consent.id} /><button className="rounded bg-green-600 px-4 py-2 text-white">Yes, this is my child</button></form>
                  <form action={notMyChild}><input type="hidden" name="student_id" value={s.id} /><button className="rounded border px-4 py-2">No, this is not my child</button></form>
                </div>
              </div>
            )}
            {((consent?.status === 'pending' && consent.identity_confirmed_at) || consent?.status === 'declined') && (
              <form action={decide} className="mb-4 rounded border bg-amber-50 p-4">
                <p className="mb-3 text-sm">
                  Lerne keeps your child&apos;s name, school, grade and verified achievements to build a portfolio.
                  Parents and the school can view it. We never collect religion, caste, home address or health details.
                  You can decline, and your child will still join Lerne programs.
                </p>
                <input type="hidden" name="id" value={consent.id} />
                <button name="status" value="agreed" className="mr-2 rounded bg-green-600 px-3 py-1 text-white">Agree</button>
                <button name="status" value="declined" className="rounded border px-3 py-1">Decline</button>
              </form>
            )}

            {(s.endorsements ?? []).length > 0 && (
              <div className="mb-4">
                <h3 className="mb-1 font-medium">Teacher endorsements</h3>
                <ul className="space-y-1 text-sm">{(s.endorsements ?? []).map((n, i) => <li key={i} className="rounded border p-2">{n.text} <span className="text-xs text-gray-500">· {n.teacher_name}</span></li>)}</ul>
              </div>
            )}
            <div className="mb-3 flex flex-wrap gap-2">
              {[['', 'All'], ['grand_test', 'Grand Test'], ['skill_labs', 'Skill Labs'], ['challenges', 'Challenges'], ['scientific_journal', 'Scientific Journal'], ['publications', 'Publications'], ['innovation_patent_cell', 'Innovation & Patent Cell'], ['external', 'External']].map(([v, l]) => (
                <Link key={v} href={v ? `/records?area=${v}` : '/records'} className={`area-tab ${(area ?? '') === v ? 'active' : ''}`}>{l}</Link>
              ))}
            </div>
            <ul className="timeline mb-4 space-y-2">
              {achList.map((a, i, arr) => (
                <Fragment key={a.id}>
                {(i === 0 || arr[i - 1].academic_year !== a.academic_year) && <li className="year-head">{a.academic_year}</li>}
                <li className="rounded border p-3">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-sm text-gray-600">{a.level} · {a.result} · {a.achieved_on}</div>
                  <div className="mt-1 text-sm"><span className={`badge badge-${a.status}`}>{LABEL[a.status]}</span>{a.review_note ? <span className="ml-2">{a.review_note}</span> : null}</div>
                  {ctl && s.public_profile && a.status === 'verified' && (
                    <form action={toggleRecord} className="mt-1 text-xs">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="on" value={a.is_public ? '0' : '1'} />
                      <button className="text-blue-600 underline">{a.is_public ? 'Hide from public profile' : 'Show on public profile'}</button>
                    </form>
                  )}
                  {['pending', 'needs_more_proof'].includes(a.status) && (
                    <form action={resubmitAchievement} className="mt-2 grid gap-1 text-sm">
                      <input type="hidden" name="id" value={a.id} />
                      <textarea name="description" defaultValue={a.description ?? ''} placeholder="What did you do?" className="rounded border p-1" />
                      <input name="proof_url" defaultValue={a.proof_url ?? ''} placeholder="Proof link" className="rounded border p-1" />
                      <input name="proof_file" type="file" accept=".pdf,.jpg,.jpeg,.png" className="rounded border p-1" />
                      <button className="rounded border px-2 py-1">{a.status === 'needs_more_proof' ? 'Send more proof' : 'Update entry'}</button>
                    </form>
                  )}
                  {['pending', 'needs_more_proof', 'rejected'].includes(a.status) && (
                    <form action={deleteAchievement} className="mt-1">
                      <input type="hidden" name="id" value={a.id} />
                      <button className="text-xs text-red-600 underline">Delete this entry</button>
                    </form>
                  )}
                </li>
                </Fragment>
              ))}
              {achList.length === 0 && <li className="text-sm text-gray-500">No records yet.</li>}
            </ul>

            {ctl && (s.school_consents ?? []).filter((c) => c.status === 'pending').map((c) => (
              <form key={c.id} action={decideSchool} className="mb-4 rounded border bg-amber-50 p-4 text-sm">
                <input type="hidden" name="id" value={c.id} />
                <p className="mb-2">{(c.schools as any)?.name} is a new school for {s.full_name}. May it see the portfolio?</p>
                <button name="status" value="agreed" className="mr-2 rounded bg-green-600 px-3 py-1 text-white">Agree</button>
                <button name="status" value="declined" className="rounded border px-3 py-1">Decline</button>
              </form>
            ))}
            {ctl && consent?.status === 'agreed' && (
              <form action={decide} className="mb-4 text-sm">
                <input type="hidden" name="id" value={consent.id} />
                <button name="status" value="declined" className="text-red-600 underline">Withdraw consent</button>
                <span className="text-gray-500"> You agreed on {consent.decided_at ? new Date(consent.decided_at).toLocaleString('en-IN') : 'an earlier date'}. If you withdraw, your child&apos;s portfolio is hidden from everyone except the Lerne team until you agree again.</span>
              </form>
            )}
            {ctl && (
              <form action={requestData} className="mb-4 grid gap-2 rounded border p-4 text-sm">
                <input type="hidden" name="student_id" value={s.id} />
                <span className="font-medium">Correct or delete my child&apos;s data</span>
                <select name="kind" className="rounded border p-2">
                  <option value="correction">Correct something</option>
                  <option value="deletion">Delete my child&apos;s record</option>
                  <option value="other">Other</option>
                </select>
                <textarea name="note" placeholder="Tell us what you need" required className="rounded border p-2" />
                <button className="rounded border px-3 py-2">Send request</button>
              </form>
            )}
            {isParent && (((s.enrollments ?? []) as any[]).find((e) => !e.left_on)?.grade ?? 12) >= 6 && (
              <form action={setStudentLogin} className="mb-4 flex flex-wrap items-center gap-2 rounded border p-4 text-sm">
                <input type="hidden" name="student_id" value={s.id} />
                <span className="w-full">
                  Student login (suggested for Grades 9-12). Sign-in ID: <b>{s.lerne_id}</b>. {s.user_id ? 'Login exists; set a new password below.' : 'Set a password to create it.'}
                </span>
                <input name="password" type="password" minLength={8} placeholder="Password (8+ characters)" required className="rounded border p-2" />
                <button className="rounded border px-3 py-2">{s.user_id ? 'Reset password' : 'Create student login'}</button>
              </form>
            )}

            {isParent && (
              <form action={reportSchoolChange} className="mb-4 grid gap-2 rounded border p-4 text-sm">
                <input type="hidden" name="student_id" value={s.id} />
                <span className="font-medium">Changed school?</span>
                <select name="kind" className="rounded border p-2">
                  <option value="same">Same school this year</option>
                  <option value="changed">Changed school</option>
                  <option value="discontinued">Discontinued</option>
                </select>
                <input name="new_school_name" placeholder="New school name (if changed)" className="rounded border p-2" />
                <input name="new_city" placeholder="New school city" className="rounded border p-2" />
                <button className="rounded border px-3 py-2">Tell Lerne</button>
              </form>
            )}

            {ctl && !access.get(s.id) && consent?.status === 'agreed' && (
              <div className="mb-4 rounded border bg-blue-50 p-4 text-sm">
                Your record stays free to view and download. To keep adding and verifying achievements, get the{' '}
                <Link href={`/plan/${s.id}`} className="text-blue-600 underline">individual plan</Link>.
              </div>
            )}
            {access.get(s.id) && consent?.status !== 'pending' && consent?.status !== 'declined' && (
              <form action={addAchievement} className="grid gap-2 rounded border p-4">
                <h3 className="font-medium">Add achievement</h3>
                <input type="hidden" name="student_id" value={s.id} />
                <input name="title" placeholder="Title" required className="rounded border p-2" />
                <select name="external_type" className="rounded border p-2">
                  {['publication', 'record title', 'competition', 'sports', 'arts', 'certification', 'volunteering', 'other'].map((t) => <option key={t}>{t}</option>)}
                </select>
                <select name="level" className="rounded border p-2">{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
                <select name="result" className="rounded border p-2">{RESULTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <input name="achieved_on" type="date" required className="rounded border p-2" />
                <input name="organiser" placeholder="Organised / issued by" className="rounded border p-2" />
                <textarea name="description" placeholder="What did you do? (2-3 lines)" className="rounded border p-2" />
                <input name="proof_url" placeholder="Proof link (certificate, DOI, etc.)" className="rounded border p-2" />
                <input name="proof_file" type="file" accept=".pdf,.jpg,.jpeg,.png" className="rounded border p-2" />
                <span className="text-xs text-gray-500">Or upload the certificate: PDF, JPG or PNG up to 4 MB.</span>
                <button className="rounded bg-blue-600 p-2 text-white">Submit for verification</button>
              </form>
            )}
          </section>
        )
      })}
      {(students ?? []).length === 0 && <p>No student record is linked to this account yet. If you have just created your account and a record for this student may already exist, the Lerne team will verify it and link it to you.</p>}
    </main>
  )
}
