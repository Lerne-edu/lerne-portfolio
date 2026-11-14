# Lerne Portfolio

Next.js (Vercel) + Supabase (Postgres, login, files). Not yet run or tested: expect to fix small errors on first run.

## Quick start (full steps with screenshots-free detail in `SETUP-GUIDE.md`)
This is a complete Next.js project: no create-next-app, nothing to copy.
```
npm install                  # once
cp .env.example .env.local   # Windows: copy .env.example .env.local, then fill it in (SETUP-GUIDE.md Part 4)
npm run check                # tests your values, tables and buckets
npm run create-admin         # makes your first Lerne admin
npm run dev                  # http://localhost:3000
```
Before that, create a Supabase project and run `supabase/schema.sql` in its SQL Editor (SETUP-GUIDE.md Part 3).
Deploying to Vercel and your own address is Parts 7 to 9; optional services are Part 10; go-live is Part 11.

## What is built
- Login: email (team and school), parent mobile OTP, student Lerne ID + password (set by the parent)
- Lerne admin: school admin accounts, student search and editing (details, parents, enrollment, login resets),
  duplicate review, data requests, schools, student-list upload (Lerne ID + duplicate check, parents, consent requests, enrollment),
  program-results upload (auto-verified, auto skill tags, Grand Test subject marks), verification queue,
  yearly rollover, moves (parent reports and students who left), audit log (views of student records by schools,
  PDF and Excel exports, verification decisions, consent decisions, uploads, Getprofily exports)
- Parents and students: consent screen, records, add external achievement (link or uploaded PDF/JPG/PNG proof), edit profile and goals, withdraw consent and send correction/deletion requests, strengths and next steps page with charts,
  portfolio PDF and year-end report PDF, student login, "changed school?" form, public profile switch and per-record visibility
- PDFs in English, Tamil and Hindi: add the Noto font files to `src/fonts` (see `src/fonts/README.txt`);
  without them other scripts print as "?"
- Delete a student (Lerne admin, on the student's page): removes the record, files, logins and orphaned parents;
  needs the Lerne ID typed to confirm; logged in the audit log
- Safety: login and OTP rate limits (stored in the database), friendly error, loading and not-found pages,
  paged audit log and school student list
- Parent invites (Lerne admin): after a list upload, send the sign-in link to a school's parents who have not logged in,
  by SMS, WhatsApp and email (whichever are set up); nobody is invited twice in 7 days
- WhatsApp messages (optional, Meta Cloud API): notifications and invites, using approved templates
- Design: split-screen sign-in and sign-up in one frame, admin sidebar, profile header and timeline on the records page, shared header with role-aware links
- Landing page (from your content document), sign-in chooser with Parent / Student / School tabs, and individual sign-up for
  families whose school is not a Lerne partner (a record with matching details is never linked automatically: the Lerne team verifies first)
- "Is this your child?" step before consent; the consent date and time are shown and recorded
- Starting passwords (school admins, teachers) must be changed at first sign-in
- Verify a record (public): certificate code, or a Lerne ID for records the family chose to share; no personal details shown
- Admin: consent records page, days-waiting badge on the verification queue (red after 14 days), two-step delete (hide, then delete permanently)
- Grades 1 to 12 (students in Grades 1 to 5 use the parent's login)
- Resubmit flow: when the team asks for more proof, the family adds a link or file and the entry returns to the queue;
  pending entries can be edited, and pending, sent-back or rejected entries can be deleted
- Look: matches lerne.co.in (cream page, deep brown pill buttons, terracotta links, Playfair Display headings, owl logo). All colours and fonts are in `src/app/brand.css`; the header and footer are in `src/app/layout.tsx`
- Birthday and Grade 12 notices (daily job): 30 days before and on a student's 18th birthday, and on 1 February
  for Grade 12 (about linking to Getprofily)
- Teachers: the school admin creates teacher logins limited to grades/sections; teachers see their students
  (view only) and add endorsements, which families and the school can read (never counted in scores)
- Individual plan: students outside partner schools keep viewing free; adding records needs a yearly plan paid
  through Razorpay (set the price and keys in env; add the webhook /api/razorpay/webhook)
- New-school consent: when a student moves to another school, that school sees nothing until the parent agrees
- At 18, with a student login: parents lose access and the student controls consent, visibility and requests
- AI summaries (Lerne admin): draft from scores only (no names), edit, approve; families see approved ones only
- Notifications: in-app inbox plus email (optional, Resend) and SMS (optional, MSG91) when an achievement is verified, needs proof or is
  rejected, and when program results are uploaded. Sent only for students whose parent consented
- School admin: dashboard with filters, search, student view, Excel and PDF export (no private sections)
- QR verification: each verified record has a public "Verified by Lerne" page (`/verify/<id>`) and a QR image
  (`/verify/<id>/qr`); the Certificate QR admin page exports the links per school and year for certificates
- Daily job (Vercel Cron, needs CRON_SECRET): on 1 June asks every family to confirm their child's school;
  on Mondays flags students with no new records and no parent login for 6 months (shown under Moves)
- Public page `/public`: school + exact Lerne ID, only profiles the parent turned on
- Getprofily: students aged 18+ create a one-time link code; `GET /api/getprofily/export` with
  `Authorization: Bearer <code>` returns their verified records as JSON (Getprofily must call it; revocable)
- `website/StudentLoginButton.jsx` for the main lerne.co.in site

## Not built
Other Indian scripts in PDFs (each needs its own Noto font and a small change in `src/lib/pdf.ts`),
and anything marked as unverified in `PROVIDER-CHECKLIST.md`. Complex-script shaping in PDFs (Tamil, Hindi) has not been
visually checked: look at a test PDF with a Tamil name.

`PLAN-COVERAGE.md` maps every section of the original plan to what was built.
`SETUP-GUIDE.md` has every step to run, deploy and go live (including where to find each environment value).

## Testing and launch
`TEST-PLAN.md` lists every flow and every access rule to test (the "must fail" list protects children's data).
`LAUNCH-CHECKLIST.md` lists accounts, environment values, legal and operations tasks. `PROVIDER-CHECKLIST.md` lists what was
checked against provider documentation.

## Before real students
1. Upgrade Supabase to Pro (no pausing, backups) and Vercel to Pro. The free Vercel plan is not for commercial use.
2. Test every role's access with real test accounts: a parent must never see another family's child.
3. Deploy to Vercel (import the GitHub repo, add the three env values), then add `portfolio.lerne.co.in`
   in Vercel > Domains and the CNAME it shows in Namecheap.
4. Add the Student Login button on lerne.co.in.
5. Get written consent text and privacy notice reviewed (India's DPDP Act, 2023) before inviting parents.

## Security
See `SECURITY.md`: what is built in, the settings to switch on (security policy, two-step sign-in, Supabase password rules) and what is not covered.

## Access-rule tests
After running `schema.sql` on a test project, run `supabase/rls-tests.sql` in the SQL Editor: it creates fake people and shows a
PASS/FAIL table for what each can read or change (parents, schools, teacher, admin). Then run `supabase/rls-cleanup.sql`.

## Status
All planned features are written except WhatsApp messages. **None of it has been run.** The code compiles under a stubbed
type check and `schema.sql` was checked for ordering, but expect a round of fixes on first run: start a fresh Supabase
project, run `schema.sql`, follow the steps above, then work through `TEST-PLAN.md` and `LAUNCH-CHECKLIST.md`.
Known limits: uploads are 4 MB at most (Vercel), PDFs need the Noto font files for Tamil and Hindi, SMS/payment/AI/email
code follows the providers' documented APIs but was not run (see `PROVIDER-CHECKLIST.md`).
