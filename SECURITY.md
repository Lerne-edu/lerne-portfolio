# Security

What protects portfolio@lerne, what you must switch on, and what is not covered. This is a student-data platform, so treat the
"to do" column as required before real families sign in.

## Built into the app
| Area | Control |
|---|---|
| Who can see what | Row Level Security rules in the database on every table (parents see their own child, schools their own students and only verified records for the years the student was there, teachers their grades, "areas to grow" never reaches schools). `supabase/rls-tests.sql` tests them. |
| Server-only secrets | The service key is used only in server code, never sent to the browser |
| Sign-in abuse | Rate limits on every sign-in, OTP request, OTP check, password check and sign-up, stored in the database |
| Passwords | Accounts created with a starting password must change it at first sign-in; the Lerne team can reset logins |
| Sessions | Cookies are HttpOnly, SameSite=Lax and Secure (in production), so page scripts cannot read them |
| Cross-site requests | Server actions are origin-checked by Next.js; sign-out and payment routes also check the request comes from this site |
| Uploads | Real file type checked from the file's first bytes (PDF, JPG, PNG only), 4 MB limit, private storage buckets, links that expire in minutes |
| Public pages | Only what a parent chose to share; no names or contact details on the Verify page; sign-in pages never reveal whether a number is registered |
| Browser protections | Security headers on every page: frame blocking, no content sniffing, referrer policy, HTTPS-only (HSTS) and a Content Security Policy |
| Search engines | `robots.txt` keeps private pages out; `/.well-known/security.txt` gives researchers a contact |
| Accountability | Audit log of views, exports, verifications, uploads, deletions and consent changes; payments verified by signature |
| Deleting data | Two steps (hide, then delete permanently) with a typed confirmation, all logged |
| Two-step sign-in | Authenticator-app check for Lerne admins and school admins. Built, switched off until you set `REQUIRE_ADMIN_MFA=true` |

## To do before real families (settings, not code)
1. **Content Security Policy:** it starts in report-only mode. Open every page and the payment window with the browser console open;
   when nothing is reported, set `CSP_ENFORCE=true` and redeploy.
2. **Two-step sign-in:** in Supabase, enable MFA (TOTP) under Authentication. Each admin signs in once and sets up the authenticator app
   at `/mfa` (turn `REQUIRE_ADMIN_MFA` on only after every admin has done so, or you can lock yourself out).
3. **Supabase Auth settings:** minimum password length 10 or more; turn on leaked-password protection (Pro plan); email confirmation on;
   short session lifetime for staff if you prefer; set SMS and email rate limits; add CAPTCHA for sign-up if abuse appears.
4. **Accounts:** two-step login on Supabase, Vercel, GitHub, Namecheap and Razorpay; unique strong passwords; the fewest people possible with the service key.
5. **Backups:** Supabase Pro daily backups; practise restoring one.
6. **Keys:** never commit `.env.local`; rotate the service key if it was ever shared.
7. **Monitoring:** check the audit log, Vercel logs and Supabase logs weekly; decide who is told first if something looks wrong.
8. **Legal:** consent text, privacy notice and a breach-response plan reviewed for India's DPDP Act, 2023.

## Not covered
Penetration testing, a web application firewall, bot protection beyond rate limits, encrypted-at-rest keys managed by you (Supabase encrypts
storage and databases at rest by default), and malware scanning of uploaded files. Consider an independent security review before a wide launch.
