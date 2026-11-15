import { createAdminClient } from '@/lib/supabase/admin'

// Finishes an account that a family created on its own (child not at a partner school).
// Returns true when an account was completed.
export async function completePendingSignup(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: p } = await admin.from('pending_signups').select('data').eq('user_id', userId).maybeSingle()
  if (!p) return false
  const d = p.data as { parent_name: string; email: string; mobile?: string; child_name: string; dob: string; school_text?: string }

  const { data: r, error } = await admin.rpc('create_or_link_student', { p_name: d.child_name, p_dob: d.dob, p_parent_name: d.parent_name })
  if (error || !r) return false

  let studentId: string | null = null
  let existingId: string | null = null
  if (r.status === 'created') studentId = r.student_id
  else if (r.status === 'review') {
    // A near match was flagged for the Lerne team; this family still gets its own record
    const f = await admin.rpc('create_or_link_student', { p_name: d.child_name, p_dob: d.dob, p_parent_name: d.parent_name, p_force: true })
    studentId = f.data?.student_id ?? null
  } else existingId = r.student_id // a record with these details already exists: the Lerne team must verify before anyone is linked

  await admin.from('profiles').insert({ id: userId, role: 'parent', full_name: d.parent_name })
  const mobile = (d.mobile ?? '').replace(/\D/g, '').slice(-10) || null
  const { data: par } = await admin.from('parents').insert({ user_id: userId, full_name: d.parent_name, mobile, email: d.email }).select('id').single()

  if (studentId && par) {
    await admin.from('student_parents').upsert({ student_id: studentId, parent_id: par.id, relationship: 'Parent', is_primary: true })
    await admin.from('consents').insert({ student_id: studentId, parent_id: par.id })
    if (d.school_text) await admin.from('students').update({ outside_school: d.school_text }).eq('id', studentId)
  } else if (existingId) {
    await admin.from('data_requests').insert({
      student_id: existingId, requested_by: userId, kind: 'other',
      note: `Individual sign-up claims this existing record (${d.parent_name}, ${d.email}). Verify the parent before linking.`,
    })
  }
  await admin.from('pending_signups').delete().eq('user_id', userId)
  return true
}
