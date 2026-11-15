import { createAdminClient } from '@/lib/supabase/admin'
import { notifyFamily } from '@/lib/notify'

// Runs daily from Vercel Cron (see vercel.json). Vercel sends: Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Not allowed', { status: 401 })
  }
  const admin = createAdminClient()
  const now = new Date()
  const done: string[] = []

  // 1 June: ask every family to confirm their child's school for the new year
  if (now.getUTCMonth() === 5 && now.getUTCDate() === 1) {
    const ids: string[] = []
    for (let from = 0; ; from += 1000) {
      const { data } = await admin.from('enrollments').select('student_id').is('left_on', null).range(from, from + 999)
      ids.push(...(data ?? []).map((e) => e.student_id as string))
      if (!data || data.length < 1000) break
    }
    await notifyFamily([...new Set(ids)], "Please confirm your child's school",
      "Tell us whether your child is in the same school this year, has changed school or has discontinued. Open Records and use the 'Changed school?' form.")
    done.push(`yearly message: ${new Set(ids).size} students`)
  }

  // Mondays: flag students with no new records and no parent login for 6 months
  if (now.getUTCDay() === 1) {
    const { data } = await admin.rpc('inactive_students', { p_months: 6 })
    const rows = ((data ?? []) as { student_id: string }[]).slice(0, 500).map((r) => ({ student_id: r.student_id }))
    if (rows.length) await admin.from('inactivity_flags').insert(rows)
    done.push(`inactivity flags: ${rows.length}`)
  }
  // Turning 18: tell the student and parents 30 days before and on the day
  for (const offset of [30, 0]) {
    const { data } = await admin.rpc('students_turning_18', { p_offset_days: offset })
    const ids = ((data ?? []) as { student_id: string }[]).map((r) => r.student_id)
    await notifyFamily(ids,
      offset ? 'Turning 18 soon' : 'The student is 18 today',
      offset
        ? 'In 30 days the student takes over the account, and parents lose access once the student has their own login. Please set up the student login under Records if it is not done.'
        : 'The student now controls consent, public visibility and data requests. Parents no longer have access if the student has a login.')
    done.push(`turning 18 (${offset} days): ${ids.length}`)
  }

  // 1 February: tell Grade 12 students and parents about linking to Getprofily
  if (now.getUTCMonth() === 1 && now.getUTCDate() === 1) {
    const ids: string[] = []
    for (let from = 0; ; from += 1000) {
      const { data } = await admin.from('enrollments').select('student_id').is('left_on', null).eq('grade', 12).range(from, from + 999)
      ids.push(...(data ?? []).map((e) => e.student_id as string))
      if (!data || data.length < 1000) break
    }
    await notifyFamily([...new Set(ids)], 'After Grade 12: link your Lerne record to Getprofily',
      'After Grade 12, or at 18, you can choose to link your verified Lerne record to Getprofily to carry it into college and career. It is optional. The student does this under Link to Getprofily once 18.')
    done.push(`grade 12 message: ${new Set(ids).size}`)
  }
  await admin.from('rate_limits').delete().lt('window_start', new Date(Date.now() - 86400000).toISOString())
  return Response.json({ ok: true, done })
}
