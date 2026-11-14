// WhatsApp messages through Meta's WhatsApp Cloud API. Business-started messages must use a template
// that Meta has approved; the parameters are filled in order ({{1}}, {{2}}, ...).
// Needs WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and a template name; does nothing without them.
export async function sendWhatsApp(mobiles: string[], templateName: string | undefined, params: string[]) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneId || !templateName || mobiles.length === 0) return
  const version = process.env.WHATSAPP_API_VERSION ?? 'v21.0'
  const lang = process.env.WHATSAPP_TEMPLATE_LANG ?? 'en'
  const numbers = [...new Set(mobiles.map((m) => m.replace(/\D/g, '').slice(-10)).filter((n) => n.length === 10))].map((n) => '91' + n)

  const send = (to: string) =>
    fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to, type: 'template',
        template: {
          name: templateName, language: { code: lang },
          components: params.length ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] : [],
        },
      }),
    }).catch(() => null)

  // There is no batch endpoint, so send in small groups
  for (let i = 0; i < numbers.length; i += 10) await Promise.all(numbers.slice(i, i + 10).map(send))
}
