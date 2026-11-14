import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Called by Getprofily with: Authorization: Bearer <link code the student created>
export async function GET(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return new Response('Missing code', { status: 401 })
  const hash = '\\x' + createHash('sha256').update(token).digest('hex')

  const admin = createAdminClient()
  const { data: link } = await admin.from('getprofily_links').select('student_id').eq('token_hash', hash).is('revoked_at', null).maybeSingle()
  if (!link) return new Response('Invalid or revoked code', { status: 401 })

  const { data: s } = await admin.from('students')
    .select('full_name, lerne_id, achievements(title, category, level, result, achieved_on, organiser, description, status, achievement_skills(skill_code))')
    .eq('id', link.student_id).single()
  if (!s) return new Response('Not found', { status: 404 })
  await admin.from('audit_log').insert({ action: 'getprofily_export', table_name: 'students', row_id: link.student_id })

  const records = (s.achievements as any[]).filter((a) => a.status === 'verified').map((a) => ({
    title: a.title, program: a.category, level: a.level, result: a.result, date: a.achieved_on,
    organiser: a.organiser, description: a.description, skills: a.achievement_skills.map((k: any) => k.skill_code),
    verified_by: 'Lerne',
  }))
  return Response.json({ name: s.full_name, lerne_id: s.lerne_id, records })
}
