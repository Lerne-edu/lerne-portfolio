# Launch checklist

## Accounts and plans
- [ ] Supabase project on the Pro plan (no pausing, backups on), nearest region
- [ ] Vercel on Pro (the free plan is not for commercial use), project linked to the GitHub repo
- [ ] GitHub repo for the app (private)
- [ ] Namecheap access for lerne.co.in; add `portfolio` as a CNAME to the address Vercel shows; add the domain in Vercel
- [ ] SMS provider for the login OTP (Twilio, Vonage, MessageBird or TextLocal, or MSG91 through the SMS hook) with DLT registration
- [ ] MSG91 (or other) approved template for notifications, if you want notification SMS
- [ ] Resend account and a verified sending domain (needed for the sign-up confirmation emails, and for notifications)
- [ ] WhatsApp Business account, number and approved templates (optional)
- [ ] Razorpay account and webhook (optional until the individual plan is priced)
- [ ] Anthropic API key (optional, for AI summary drafts)

## Environment values (Vercel > Settings > Environment Variables, and `.env.local` locally)
| Name | What it is | Needed |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY | from Supabase Project Settings > API | yes |
| SUPABASE_SERVICE_ROLE_KEY | server only, never in browser code | yes |
| NEXT_PUBLIC_SITE_URL | https://portfolio.lerne.co.in | yes |
| CRON_SECRET | long random string; the daily job needs it | yes |
| RESEND_API_KEY, NOTIFY_FROM | email to parents | optional |
| MSG91_AUTH_KEY, MSG91_TEMPLATE_ID, MSG91_VAR_NAME | SMS notifications | optional |
| INDIVIDUAL_PLAN_PRICE_INR, MENTOR_SESSION_PRICE_INR, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET | individual plan, mentor sessions, store | optional |
| ANTHROPIC_API_KEY | AI summary drafts | optional |

## Before the first real family
- [ ] `schema.sql` run once on the live project; the `proofs`, `photos` and `store` buckets exist and are private
- [ ] Noto font files added to `src/fonts`
- [ ] Every item in `TEST-PLAN.md` passed, including all "must fail" tests
- [ ] `PROVIDER-CHECKLIST.md` items checked against current provider documentation
- [ ] Your own admin account created; no shared passwords; strong passwords for school admins
- [ ] Consent screen text and privacy notice reviewed by a lawyer for India's DPDP Act, 2023
- [ ] Partnership agreement clause: schools tell Lerne when they issue a Transfer Certificate
- [ ] Decisions made: product name, verification turnaround and who handles the queue, whether verification is charged,
      Grades 6-8 logins, individual plan price, whether AI summaries are used
- [ ] Support contact shown to parents; a person named to check the audit log, data requests and Duplicates pages each week
- [ ] Backups confirmed in Supabase; a written plan for what to do if something goes wrong
- [ ] "Student Login" button added on lerne.co.in (file in `website/`)
- [ ] One pilot school, its admin trained, a short guide for parents

## Day one
- [ ] Create the school and its admin; upload the student list; check the Duplicates page
- [ ] Send parents the `portfolio.lerne.co.in/parent-login` link
- [ ] Watch the audit log and your error logs in Vercel for the first week
