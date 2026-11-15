// Supabase "Send SMS" auth hook: sends the login OTP through MSG91 (Supabase has no built-in MSG91 option).
// Setup: supabase functions deploy sms-hook --no-verify-jwt
//   secrets: SEND_SMS_HOOK_SECRET (from the hook page), MSG91_AUTH_KEY, MSG91_OTP_TEMPLATE_ID, MSG91_OTP_VAR (default OTP)
// Then Authentication > Hooks > Send SMS hook > HTTPS > this function's URL.
// Check the payload and response shapes against Supabase's current "Send SMS hook" docs before going live.
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

Deno.serve(async (req) => {
  const payload = await req.text()
  const secret = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '')
  let data: { user: { phone: string }; sms: { otp: string } }
  try {
    data = new Webhook(secret).verify(payload, Object.fromEntries(req.headers)) as typeof data
  } catch {
    return new Response(JSON.stringify({ error: { http_code: 401, message: 'Bad signature' } }), { status: 401 })
  }

  const mobile = '91' + data.user.phone.replace(/\D/g, '').slice(-10)
  const template = Deno.env.get('MSG91_OTP_TEMPLATE_ID')
  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: { authkey: Deno.env.get('MSG91_AUTH_KEY')!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_id: template, flow_id: template,
      recipients: [{ mobiles: mobile, [Deno.env.get('MSG91_OTP_VAR') ?? 'OTP']: data.sms.otp }],
    }),
  })
  if (!res.ok) return new Response(JSON.stringify({ error: { http_code: 500, message: 'SMS failed' } }), { status: 500 })
  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
