import type { SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, string>

// Saves the parents, the consent request and the enrollment for one student-list row.
// Returns a problem message, or null when everything was saved.
export async function attachRow(supabase: SupabaseClient, sid: string, r: Row, schoolId: string, year: string): Promise<string | null> {
  async function ensureParent(name: string, rawMobile: string, email: string | null) {
    const mobile = rawMobile.replace(/\D/g, '').slice(-10) // keep the last 10 digits so every spelling matches
    if (mobile) {
      const { data } = await supabase.from('parents').select('id').eq('mobile', mobile).limit(1)
      if (data?.[0]) return data[0].id as string
    }
    const { data } = await supabase.from('parents').insert({ full_name: name, mobile: mobile || null, email }).select('id').single()
    return data?.id as string | undefined
  }

  const p1 = String(r.parent1_name).trim()
  const p1id = await ensureParent(p1, String(r.parent1_mobile).trim(), String(r.parent_email).trim() || null)
  const p2name = String(r.parent2_name).trim()
  const p2id = p2name ? await ensureParent(p2name, String(r.parent2_mobile).trim(), null) : undefined
  if (!p1id) return 'could not save parent'

  for (const [pid, rel, primary] of [[p1id, 'Parent 1', true], [p2id, 'Parent 2', false]] as [string | undefined, string, boolean][]) {
    if (pid) await supabase.from('student_parents').upsert({ student_id: sid, parent_id: pid, relationship: rel, is_primary: primary }, { onConflict: 'student_id,parent_id', ignoreDuplicates: true })
  }
  const { data: hasConsent } = await supabase.from('consents').select('id').eq('student_id', sid).eq('parent_id', p1id).limit(1)
  if (!hasConsent?.length) await supabase.from('consents').insert({ student_id: sid, parent_id: p1id })

  const { data: open } = await supabase.from('enrollments').select('school_id').eq('student_id', sid).is('left_on', null)
  if (open?.some((e) => e.school_id !== schoolId)) return 'is enrolled at another school (handle under Moves once the old school marks them left)'
  if (!open?.length) {
    await supabase.from('enrollments').insert({
      student_id: sid, school_id: schoolId, grade: Number(r.grade), section: String(r.section).trim() || null,
      admission_no: String(r.admission_no).trim() || null, academic_year: year,
    })
  }
  return null
}
