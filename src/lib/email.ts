import { emailHtml } from '@/lib/emailTemplate'

// Branded email through Resend (up to 100 per call): Lerne-styled HTML plus a plain-text copy.
// Does nothing without RESEND_API_KEY and NOTIFY_FROM.
export async function sendEmail(to: string[], subject: string, text: string, button?: { label: string; url: string }) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.NOTIFY_FROM
  const list = [...new Set(to.filter(Boolean))]
  if (!key || !from || list.length === 0) {
    if (list.length > 0) console.error('[email] skipped: RESEND_API_KEY or NOTIFY_FROM is not set')
    return
  }
  const html = emailHtml({ title: subject, body: text, button })
  const plain = button ? `${text}\n\n${button.label}: ${button.url}` : text
  for (let i = 0; i < list.length; i += 100) {
    await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(list.slice(i, i + 100).map((address) => ({ from, to: address, subject, text: plain, html }))),
    }).then(async (res) => {
      if (!res.ok) console.error('[email] Resend rejected the batch:', res.status, await res.text().catch(() => ''))
    }).catch((e) => console.error('[email] Resend request failed:', e))
  }
}