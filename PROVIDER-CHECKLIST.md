# Provider checklist

What was checked against provider documentation (Oct 2026) and what still needs you. Re-check before launch:
providers change their APIs and prices.

## Razorpay (payments): matches the code
- Orders are created with `POST https://api.razorpay.com/v1/orders` (key id and secret as basic auth), with `amount`
  in paise, `currency`, `receipt` (40 characters at most) and `notes`. The code does this.
- The webhook events `payment.captured` and `order.paid` exist and the signature arrives in `X-Razorpay-Signature`.
  The code handles both and verifies the signature.
- To do: in the Razorpay dashboard add a webhook to `https://portfolio.lerne.co.in/api/razorpay/webhook`, tick those two
  events, and put the same secret in `RAZORPAY_WEBHOOK_SECRET`. Test a payment in Razorpay test mode first.
- If the Lerne website already uses this Razorpay account, that is fine: orders from this app are tagged `app=lerne-portfolio` and the webhook ignores every other payment. Use a separate webhook URL entry for this app.
- Not done: the browser success callback is not signature-checked (fine, because the plan activates only from the webhook).

## MSG91 (SMS): code changed after checking
- Flow API is `POST https://control.msg91.com/api/v5/flow/` with the `authkey` header and a `recipients` list whose items
  carry `mobiles` and the variables. Older docs use `flow_id`, newer ones `template_id`; the code now sends both.
- Variable names are case-sensitive and must match your template exactly (docs show `VAR1`). Set `MSG91_VAR_NAME`.
- India needs DLT registration and an approved template before anything is delivered.
- To do: create the notification template (one variable) and, if you use MSG91 for OTP, a second template for OTPs.

## Supabase phone OTP: important finding
- Supabase's built-in phone providers are MessageBird, Twilio, Vonage and TextLocal (community supported).
  **MSG91 is not built in.**
- Choose one: (a) use a built-in provider (Twilio and Vonage also need DLT registration for India), or
  (b) keep MSG91 and deploy `supabase/functions/sms-hook` as a "Send SMS" auth hook (Authentication > Hooks).
  The function is written from the documented pattern but has not been run; verify it against Supabase's current hook docs.
- Supabase's own advice: adjust the project's SMS rate limits and consider CAPTCHA to control SMS cost. The app also
  limits OTP requests (3 per number per 15 minutes, 20 per IP per hour).
- OTP expires after 60 seconds by default.

## WhatsApp (Meta Cloud API): matches the documented request
- Template messages are sent with `POST https://graph.facebook.com/<version>/<phone-number-id>/messages`, type `template`,
  with body parameters filled in order. The code does this; the API version is set by `WHATSAPP_API_VERSION`.
- To do: a WhatsApp Business account, a phone number, and Meta-approved templates (one for notifications and one for the
  invite, each with a single {{1}} parameter). Messages outside the 24-hour window must use a template. Check Meta's current
  pricing per conversation before turning it on for every notification.

## Not verified here (check yourself)
- Resend: `POST https://api.resend.com/emails/batch` (up to 100 emails per call) and domain verification.
- Vercel: Pro plan for commercial use; cron frequency limits for your plan; `vercel.json` cron path and `CRON_SECRET`.
- Anthropic API: `anthropic-version` header, model name `claude-sonnet-5-5` and response shape; decide whether sending
  anonymous scores of students to an external AI is acceptable.
- SheetJS install URL `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` and the `create-next-app@15` options.
- Supabase: the private `proofs` storage bucket is created by `schema.sql`; confirm it exists and is not public.
- Getprofily: confirm their side calls `/api/getprofily/export` with `Authorization: Bearer <code>`.
