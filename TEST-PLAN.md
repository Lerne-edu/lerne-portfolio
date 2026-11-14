# Test plan

Run this on a fresh Supabase project with fake data before any real student. The code has never been run, so expect to
fix some errors first. Tick each line. The "must fail" tests matter most: they protect children's data.

## 1. Set up test accounts
First run `npm run check`; make the admin with `npm run create-admin`. Then the other accounts:
In Supabase Authentication > Users (tick auto-confirm), create: `admin@test`, `schoolA@test`, `schoolB@test`, `teacher@test`.
Then in the SQL editor (replace the ids; add the two schools first from the app's Schools page):
```sql
insert into profiles (id, role, full_name) values ('ADMIN-ID','lerne_admin','Test Admin');
insert into profiles (id, role, full_name, school_id) values
  ('SCHOOLA-ID','school_admin','Principal A',(select id from schools where school_code='SCH-TN-0001')),
  ('SCHOOLB-ID','school_admin','Principal B',(select id from schools where school_code='SCH-TN-0002'));
```
Create the teacher from the school A admin's Teachers page (Grade 8, Section A).
Parents sign in with phone OTP (use Supabase's test phone numbers, or a real SMS provider once set up).

Sample student list for School A (save as CSV and upload as the Lerne admin; use a different list for School B):
```
student_name,dob,grade,section,admission_no,parent1_name,parent1_mobile,parent2_name,parent2_mobile,parent_email
Asha Kumar,2013-04-02,8,A,1001,Meena Kumar,9000000001,,,meena@test.com
Ravi Kumar,2015-08-19,6,B,1002,Meena Kumar,9000000001,,,meena@test.com
Divya Rao,2012-01-11,9,A,1003,Sunil Rao,9000000002,,,
```

## 2. Normal flows (must work)
- [ ] Upload the list: new Lerne IDs created; re-upload links the same IDs and adds nothing twice
- [ ] Upload a near-duplicate (same date of birth, similar name): it lands on Duplicates; "same student" and "different student" both finish the row
- [ ] Parent OTP login with the saved mobile; siblings Asha and Ravi appear under one login
- [ ] Parent agrees to consent; Decline hides everything; Withdraw consent hides it again; Agree again restores it
- [ ] Parent adds an external achievement with a link, then with a PDF; it shows Pending
- [ ] Admin queue: open the uploaded file, tag skills, approve; parent gets a notification and the entry shows Verified
- [ ] Admin sends one back with a note; family adds proof; it returns to the queue; delete works on a pending entry
- [ ] Results upload (with Grand Test marks): records appear as Verified; uploading the same file again adds nothing
- [ ] Strengths page: charts show, summary reads well, "Areas to grow" never says weak or poor
- [ ] Portfolio PDF and year-end PDF open; a Tamil student name prints correctly (after adding the fonts)
- [ ] School admin dashboard: filters, search, student view, Excel and PDF export
- [ ] Teacher sees only Grade 8 Section A students and can add an endorsement; family sees it
- [ ] Parent creates a student login; the student signs in with Lerne ID and password
- [ ] Public profile: parent switches it on and chooses records; `/public` finds the student by school and exact ID
- [ ] QR link (`/verify/<record id>`) shows Verified by Lerne; a made-up id shows "not found"
- [ ] Yearly rollover: promoted students move up; Grade 12 graduate; left students appear under Moves
- [ ] Parent "changed school" report appears under Moves; enroll the student at School B; School B sees nothing until the parent agrees
- [ ] Individual plan: a student with no school cannot add records; payment in Razorpay test mode activates the plan
- [ ] Audit log shows views, exports, verifications and uploads
- [ ] Profile: upload a photo (it appears on the records page), save PEN, set a parent backup password and sign in with mobile and password
- [ ] Records page: area tabs filter the list, items group by academic year, "Where you're shining" shows after verified records
- [ ] Announce: a message reaches only families who consented; mentor session request appears under Data requests
- [ ] A Grade 12 student who graduated (before 18) can create the Getprofily link; an under-18 current student cannot
- [ ] Every button shows a message at the top of the page (saved, or why it failed)
- [ ] Parent sets a backup password and email, then signs in with mobile + password and with email + password
- [ ] Store: admin adds an item (link and PDF); a parent buys it in Razorpay test mode and can open it; a non-buyer gets "not bought"; the access link never appears in the page source
- [ ] Mentor session: with a price set the parent pays and the session shows under Mentor sessions; the admin schedules it and the family is notified
- [ ] A payment from another Lerne product on the same Razorpay account is ignored by the webhook

- [ ] Landing page opens without signing in; "Sign in" shows the three choices; the Verify box accepts a certificate code and a Lerne ID
- [ ] Individual sign-up: create an account, confirm the email, sign in; the account is completed and consent follows; a child whose details match an existing record is NOT linked automatically (it appears under Data requests)
- [ ] First sign-in of a new school admin or teacher forces a password change; nothing else opens until it is done
- [ ] Parent's first screen asks "Is this your child?" before the consent question; "No" creates a Data request
- [ ] Verification queue shows days waiting and turns red after 14 days
- [ ] Hide a student (disappears for family, school and public), restore it, hide again, then delete permanently (only works when hidden)
- [ ] Consent records page lists who agreed and when, and shows a withdrawal as declined
- [ ] A Grade 1 student: no student-login form for the parent; records, strengths and PDFs work

- [ ] Sign in and Create account share one screen; the three sign-in tabs (Parent, Student, School / Team) all work
- [ ] Admin pages show the sidebar with the right page highlighted; on a phone it becomes a scrolling bar

## 3. Must fail (access control)
- [ ] Parent 2 cannot see parent 1's children anywhere, including `/records/pdf?student=<other id>` (expect not allowed or not found)
- [ ] School A admin cannot open `/school/students/<a School B Lerne ID>` and sees no School B students in search or exports
- [ ] School admin and teacher never see "Areas to grow", "Not yet explored", or suggestions, on screen or in PDFs
- [ ] A school sees no student whose parent declined or withdrew consent
- [ ] A school sees no pending or rejected entries, only Verified ones
- [ ] An old school sees only the years the student studied there
- [ ] A teacher cannot see students outside their grade and section, and cannot export
- [ ] A student cannot switch the public profile on while under 18; a parent can
- [ ] A parent cannot verify, edit status, or change a Lerne ID or the student's school
- [ ] After a student turns 18 **or finishes Grade 12** (rollover) and has a login: the parent loses access, the student gains control
- [ ] Not logged in: `/records`, `/school`, `/admin/*` all redirect to login; `/public` and `/verify/*` stay open
- [ ] `/api/cron/daily` without the secret returns 401; `/api/razorpay/webhook` with a bad signature returns 401;
      `/api/getprofily/export` without a code returns 401, and with a revoked code returns 401
- [ ] The private `proofs` storage bucket cannot be opened by a direct link
- [ ] Rate limits: a 4th OTP request for one number within 15 minutes, and 11 wrong passwords, are blocked

## 4. After any fix
Re-run the "must fail" list. Keep notes of what failed and how it was fixed.

## 5. Already checked by running the code (offline, with sample data)
- Scoring and summaries (`src/lib/strengths.ts`): points, top strengths, growth line, areas to grow from marks, grade-based
  tips, school view without private sections, empty-record message, phone number cleaning: 19 checks passed.
- PDF layout (`src/lib/pdf.ts`): a 3-page PDF with a long table, long labels, and Tamil/Hindi/rupee characters generated and
  read back correctly (title, ID, headings, footers on every page, page breaks). Tamil shaping with the Noto fonts is not yet checked.
- `schema.sql`: quotes, brackets, statement endings and function bodies are well formed; definition order is correct.
Not checked: anything that needs a live Supabase, Next.js, SMS, payment, email, WhatsApp or AI service.

## 6. Security checks
- [ ] Browser developer tools > Application > Cookies: the sign-in cookies show HttpOnly and SameSite=Lax (and Secure on the live site)
- [ ] Response headers on any page include X-Frame-Options DENY, X-Content-Type-Options nosniff, Strict-Transport-Security and a Content Security Policy (report-only until `CSP_ENFORCE=true`)
- [ ] The browser console shows no security-policy reports on every page, including the Razorpay payment window; then set `CSP_ENFORCE=true`
- [ ] Rename a .exe or .html file to .pdf and upload it as proof: it is refused
- [ ] A made-up POST to `/logout` or `/api/plan/order` from another website address is refused
- [ ] `/robots.txt` hides the private pages; `/.well-known/security.txt` opens
- [ ] Two-step sign-in: with MFA enabled and `REQUIRE_ADMIN_MFA=true`, an admin is sent to `/mfa` and cannot open `/admin` until the code is entered
