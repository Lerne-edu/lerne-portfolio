// Plain-text email through Resend (up to 100 per call). Does nothing without RESEND_API_KEY and NOTIFY_FROM.
export async function sendEmail(to: string[], subject: string, text: string) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.NOTIFY_FROM
  const list = [...new Set(to.filter(Boolean))]
  if (!key || !from || list.length === 0) return
  for (let i = 0; i < list.length; i += 100) {
    await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(list.slice(i, i + 100).map((address) => ({ from, to: address, subject, text }))),
    }).catch(() => null)
  }
}
