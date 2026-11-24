import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/sms'
import { sendWhatsApp } from '@/lib/whatsapp'
import { emailHtml } from '@/lib/emailTemplate'

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

// Tells the family of each student: an in-app notification for parents and students who have logged in,
// plus an email to the parent email on file (when RESEND_API_KEY and NOTIFY_FROM are set).
// Only students whose parent agreed to consent are notified. Never blocks the main action.
export async function notifyFamily(studentIds: string[], title: string, body: string, link = '/records') {
  if (studentIds.length === 0) return
  try {
    const admin = createAdminClient()

    const agreed: string[] = []
    for (const c of chunk(studentIds, 200)) {
      const { data } = await admin.from('consents').select('student_id').eq('status', 'agreed').in('student_id', c)
      agreed.push(...(data ?? []).map((r) => r.student_id as string))
    }

    const users = new Set<string>()
    const emails = new Set<string>()
    const mobiles = new Set<string>()
    for (const c of chunk([...new Set(agreed)], 200)) {
      const { data } = await admin.from('students').select('user_id, student_parents(parents(user_id, email, mobile))').in('id', c)
      for (const s of (data ?? []) as any[]) {
        if (s.user_id) users.add(s.user_id)
        for (const sp of s.student_parents) {
          if (sp.parents?.user_id) users.add(sp.parents.user_id)
          if (sp.parents?.email) emails.add(sp.parents.email)
          if (sp.parents?.mobile) mobiles.add(sp.parents.mobile)
        }
      }
    }

    for (const c of chunk([...users], 500)) {
      await admin.from('notifications').insert(c.map((user_id) => ({ user_id, title, body, link })))
    }

    await sendSms([...mobiles], title)
    await sendWhatsApp([...mobiles], process.env.WHATSAPP_TEMPLATE_NAME, [title])

    const key = process.env.RESEND_API_KEY
    const from = process.env.NOTIFY_FROM
    if (key && from) {
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
      const html = emailHtml({ title, body, button: { label: 'Open portfolio', url: `${site}${link}` }, site })
      for (const c of chunk([...emails], 100)) {
        await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(c.map((to) => ({ from, to, subject: title, text: `${body}\n\n${site}${link}`, html }))),
        })
      }
    }
  } catch (e) {
    console.error('notify failed', e)
  }
}
