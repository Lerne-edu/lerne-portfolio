import { notFound, redirect } from 'next/navigation'
import { flash } from '@/lib/flash'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/guards'
import { audit } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from '@/components/AdminNav'

// Writes use the server key because families' update rights are limited by column.
async function updateStudent(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const id = String(formData.get('id'))
  await createAdminClient().from('students').update({
    full_name: String(formData.get('full_name')).trim(), dob: String(formData.get('dob')), gender: String(formData.get('gender') || '') || null,
    birth_cert_no: String(formData.get('birth_cert_no') || '').trim() || null, pen: String(formData.get('pen') || '').trim() || null,
  }).eq('id', id)
  await audit(supabase, 'admin_edit_student', 'students', id)
  await flash('Student details saved.')
  revalidatePath('/admin/students')
}

async function updateParent(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const admin = createAdminClient()
  const id = String(formData.get('id'))
  const reset = formData.get('reset') === 'on'
  const { data: p } = await admin.from('parents').select('user_id').eq('id', id).single()
  await admin.from('parents').update({
    full_name: String(formData.get('full_name')).trim(), mobile: String(formData.get('mobile') || '').replace(/\D/g, '').slice(-10) || null,
    email: String(formData.get('email') || '') || null, ...(reset ? { user_id: null } : {}),
  }).eq('id', id)
  // Reset login: unlink first, then remove the old login so the parent can sign in again by OTP on the new number
  if (reset && p?.user_id) await admin.auth.admin.deleteUser(p.user_id)
  await audit(supabase, reset ? 'admin_edit_parent_reset_login' : 'admin_edit_parent', 'parents', id)
  await flash('Parent details saved.')
  revalidatePath('/admin/students')
}

async function updateEnrollment(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const id = String(formData.get('id'))
  await supabase.from('enrollments').update({
    grade: Number(formData.get('grade')), section: String(formData.get('section') || '') || null,
    admission_no: String(formData.get('admission_no') || '') || null,
  }).eq('id', id)
  await audit(supabase, 'admin_edit_enrollment', 'enrollments', id)
  await flash('Enrollment saved.')
  revalidatePath('/admin/students')
}

async function resetStudentPassword(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const password = String(formData.get('password'))
  if (password.length < 8) return flash('Could not reset. Use a password of 8 or more characters.', 'error')
  await createAdminClient().auth.admin.updateUserById(String(formData.get('user_id')), { password })
  await audit(supabase, 'admin_reset_student_password', 'students', String(formData.get('student_id')))
  await flash('Password updated.')
}

// Step 1 of deletion: hide the record from everyone (consent is switched off and cannot be switched back on by the family).
async function hideStudent(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const id = String(formData.get('id'))
  const admin = createAdminClient()
  await admin.from('students').update({ hidden_at: new Date().toISOString() }).eq('id', id)
  await admin.from('consents').update({ status: 'declined', decided_at: new Date().toISOString() }).eq('student_id', id)
  await audit(supabase, 'student_hidden', 'students', String(formData.get('lerne_id')))
  await flash('The record is now hidden from everyone. You can delete it permanently, or restore it.')
  revalidatePath('/admin/students')
}

async function unhideStudent(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  await createAdminClient().from('students').update({ hidden_at: null }).eq('id', String(formData.get('id')))
  await audit(supabase, 'student_restored', 'students', String(formData.get('lerne_id')))
  await flash('Restored. The family can agree to consent again.')
  revalidatePath('/admin/students')
}

// Permanent deletion, used after a confirmed deletion request. The Lerne ID is never reused.
async function deleteStudent(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const id = String(formData.get('id'))
  const lerneId = String(formData.get('lerne_id'))
  if (String(formData.get('confirm')).trim().toUpperCase() !== lerneId.toUpperCase() || formData.get('checked') !== 'on') return flash('Not deleted. Type the Lerne ID exactly and tick the box.', 'error')

  const admin = createAdminClient()
  const { data: s } = await admin.from('students').select('user_id, hidden_at, student_parents(parent_id)').eq('id', id).single()
  if (!s) return flash('Not deleted. Type the Lerne ID exactly and tick the box.', 'error')
  if (!s.hidden_at) return flash('Hide the record first, then delete it permanently.', 'error')
  const parentIds = (s.student_parents as { parent_id: string }[]).map((p) => p.parent_id)

  // 1. uploaded proof files
  const { data: files } = await admin.storage.from('proofs').list(id, { limit: 1000 })
  if (files?.length) await admin.storage.from('proofs').remove(files.map((f) => `${id}/${f.name}`))

  // 2. the student; records, consents, enrollments and links are removed with it
  const { error } = await admin.from('students').delete().eq('id', id)
  if (error) return flash('Not deleted. Type the Lerne ID exactly and tick the box.', 'error')
  for (const pid of parentIds) {
    const { count } = await admin.from('student_parents').select('parent_id', { count: 'exact', head: true }).eq('parent_id', pid)
    if (!count) {
      const { data: p } = await admin.from('parents').select('user_id').eq('id', pid).single()
      await admin.from('parents').delete().eq('id', pid)
      if (p?.user_id) await admin.auth.admin.deleteUser(p.user_id)
    }
  }

  // 4. the student's own login
  if (s.user_id) await admin.auth.admin.deleteUser(s.user_id)
  await audit(supabase, 'delete_student', 'students', lerneId)
  redirect('/admin/students')
}

export default async function EditStudent({ params }: { params: Promise<{ lerneId: string }> }) {
  const { lerneId } = await params
  const supabase = await requireAdmin()
  const { data: s } = await supabase.from('students')
    .select('id, lerne_id, full_name, dob, gender, birth_cert_no, pen, hidden_at, user_id, student_parents(relationship, parents(id, full_name, mobile, email, user_id)), enrollments(id, grade, section, admission_no, left_on, schools(name))')
    .eq('lerne_id', decodeURIComponent(lerneId)).single()
  if (!s) notFound()
  const box = 'mb-6 grid gap-2 rounded border p-4 text-sm'
  const inp = 'rounded border p-2'

  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-1 text-2xl font-semibold">{s.full_name}</h1>
      <p className="mb-4 text-sm text-gray-600">{s.lerne_id} (the ID never changes)</p>

      <form action={updateStudent} className={box}>
        <b>Student details</b>
        <input type="hidden" name="id" value={s.id} />
        <input name="full_name" defaultValue={s.full_name} required className={inp} />
        <input name="dob" type="date" defaultValue={s.dob} required className={inp} />
        <input name="gender" defaultValue={s.gender ?? ''} placeholder="Gender (optional)" className={inp} />
        <input name="birth_cert_no" defaultValue={s.birth_cert_no ?? ''} placeholder="Birth certificate registration number (optional)" className={inp} />
        <input name="pen" defaultValue={s.pen ?? ''} placeholder="PEN (optional)" className={inp} />
        <button className="rounded border px-3 py-2">Save</button>
      </form>

      {(s.student_parents as any[]).map((sp) => (
        <form key={sp.parents.id} action={updateParent} className={box}>
          <b>{sp.relationship ?? 'Parent'}</b> {sp.parents.user_id ? '(has logged in)' : '(not logged in yet)'}
          <input type="hidden" name="id" value={sp.parents.id} />
          <input name="full_name" defaultValue={sp.parents.full_name} required className={inp} />
          <input name="mobile" defaultValue={sp.parents.mobile ?? ''} placeholder="Mobile" className={inp} />
          <input name="email" defaultValue={sp.parents.email ?? ''} placeholder="Email" className={inp} />
          <label><input type="checkbox" name="reset" /> Reset login (tick when the parent changed number or lost access, after confirming who they are)</label>
          <button className="rounded border px-3 py-2">Save parent</button>
        </form>
      ))}

      {(s.enrollments as any[]).map((e) => (
        <form key={e.id} action={updateEnrollment} className={box}>
          <b>{e.schools?.name}</b> {e.left_on ? `(left ${e.left_on})` : '(current)'}
          <input type="hidden" name="id" value={e.id} />
          <div className="flex gap-2">
            <input name="grade" type="number" min={1} max={12} defaultValue={e.grade} className={inp + ' w-24'} />
            <input name="section" defaultValue={e.section ?? ''} placeholder="Section" className={inp + ' w-24'} />
            <input name="admission_no" defaultValue={e.admission_no ?? ''} placeholder="Admission no" className={inp + ' flex-1'} />
          </div>
          <button className="rounded border px-3 py-2">Save enrollment</button>
        </form>
      ))}

      {s.user_id && (
        <form action={resetStudentPassword} className={box}>
          <b>Student login</b>
          <input type="hidden" name="user_id" value={s.user_id} />
          <input type="hidden" name="student_id" value={s.id} />
          <input name="password" type="password" minLength={8} placeholder="New password" required className={inp} />
          <button className="rounded border px-3 py-2">Reset student password</button>
        </form>
      )}
      <form action={s.hidden_at ? unhideStudent : hideStudent} className="mt-10 grid gap-2 rounded border p-4 text-sm">
        <b>{s.hidden_at ? `Hidden since ${new Date(s.hidden_at).toLocaleDateString('en-IN')}` : 'Hide this record (step 1 of deleting)'}</b>
        <p className="text-gray-600">{s.hidden_at ? 'The record is invisible to the family, the school and the public. Restore it if this was a mistake.' : 'Hiding removes the record from view everywhere but keeps the data, so a mistake can be undone. Permanent deletion is the second step.'}</p>
        <input type="hidden" name="id" value={s.id} />
        <input type="hidden" name="lerne_id" value={s.lerne_id} />
        <button className="rounded border px-3 py-2">{s.hidden_at ? 'Restore this record' : 'Hide this record'}</button>
      </form>
      <form action={deleteStudent} className="mt-6 grid gap-2 rounded border border-red-300 p-4 text-sm">
        <b className="text-red-700">Delete this student&apos;s record</b>
        <p>
          Removes the student, their records, consents, uploaded files, student login, and any parent who has no other child
          in Lerne. This cannot be undone. Use it only after a confirmed deletion request. The Lerne ID is never reused.
        </p>
        <input type="hidden" name="id" value={s.id} />
        <input type="hidden" name="lerne_id" value={s.lerne_id} />
        <input name="confirm" placeholder={`Type ${s.lerne_id} to confirm`} required className={inp} />
        <label><input type="checkbox" name="checked" required /> I have confirmed who is asking and why</label>
        <button disabled={!s.hidden_at} className="rounded bg-red-600 px-3 py-2 text-white" style={{ opacity: s.hidden_at ? 1 : 0.45 }}>Delete permanently</button>
        {!s.hidden_at && <p className="text-gray-600">Hide the record first. This button works only on a hidden record.</p>}
      </form>
    </main>
  )
}
