// SMS through MSG91's flow API. India needs a DLT-approved template, so the message is a template with one variable.
// Check the request shape and the variable name against your MSG91 dashboard before going live.
export async function sendSms(mobiles: string[], text: string, templateId?: string) {
  const authkey = process.env.MSG91_AUTH_KEY
  const template = templateId ?? process.env.MSG91_TEMPLATE_ID
  if (!authkey || !template || mobiles.length === 0) return
  const varName = process.env.MSG91_VAR_NAME ?? 'VAR1'
  const numbers = [...new Set(mobiles.map((m) => m.replace(/\D/g, '').slice(-10)).filter((n) => n.length === 10))].map((n) => '91' + n)
  for (let i = 0; i < numbers.length; i += 100) {
    await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: template,
        flow_id: template,
        short_url: '0',
        recipients: numbers.slice(i, i + 100).map((mobiles) => ({ mobiles, [varName]: text.slice(0, 30) })),
      }),
    })
  }
}
