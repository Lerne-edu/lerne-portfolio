# Coverage of "Lerne Portfolio: Complete Plan and Workflow"

Section by section. "Done" means written and checked as far as possible offline (compile, dead-link and button audit, logic tests);
nothing has been run against a live database, so every item still needs the tests in `TEST-PLAN.md`.

| Plan section | Status |
|---|---|
| 1. What it is: records from Lerne programs (auto) and external achievements (verified), roles, Getprofily link | Done |
| 2. Principles: school pays and student owns (record kept, free view for life); verified only; schools cannot edit or verify; parent consent first with a clear Decline; no Aadhaar; minimal data; public profile off by default | Done |
| 3. Tech: portal on a subdomain with a Student Login button on the main site | Done, but built on **Vercel + Supabase instead of Zoho Creator** (your decision). Subdomain and DNS steps are in `SETUP-GUIDE.md` |
| 4. User roles: Lerne admin, school admin, teacher, parent, student, public visitor | Done |
| 5. Lerne ID `LERNE-2026-00001`; duplicate check on name, date of birth, parent name, optional birth certificate number or PEN; near-matches flagged | Done (PEN and birth certificate number can be entered in the student list, the family's profile, or by the Lerne admin) |
| 5. Logins: admin, school admin, teacher, parent by mobile OTP **or mobile and password**, student by Lerne ID and password set by the parent; account recovery | Done. Parents can set a backup password (and an email) in their profile, then sign in with their mobile number **or email** and the password |
| 6. Workflow steps 1 to 8 (school joins, list upload, IDs, invite, consent, account live, records added, everyone views) | Done, including invites by SMS, WhatsApp and email |
| 7. Student dashboard: home with photo, name, ID, school and grade, "Where you're shining", latest activities; My Records as a year-by-year timeline with a tab per area; Add Achievement with status; Strengths and Next Steps; Profile | Done |
| 7. Parent dashboard: child switch, consent and public visibility, upload for the child, student login, notifications (verified, results out, **new Challenge open**), "Changed school?" | Done. "New Challenge open" is sent by the Lerne admin from the Announce page |
| 7. School admin dashboard: overview, filters (grade, section, program, level, year), search, view-only student record, Excel and PDF export, teachers | Done |
| 7. Lerne admin: verification queue with proof, bulk upload, schools, students and duplicate flags, moves as sales leads (with the schools receiving several students ranked first) | Done |
| 7. Public profile: state, school, exact ID, verified items only | Done |
| 8. Profile and record fields (including photo, school history, aspirations, goals) | Done |
| 9. Verification: automatic for Lerne results; queue with approve, ask for more proof, reject | Done, plus resubmit and delete for families |
| 10. Strengths: eight skill areas, points = level x result, charts (radar, yearly bars, Grand Test lines, highest level), plain-language summary, private "Areas to grow", suggestions by grade, parent year-end PDF; AI-assisted summaries; optional paid mentor session | Done. The mentor session is a paid add-on: parents pay in the app (set `MENTOR_SESSION_PRICE_INR`) and the Lerne team schedules it from the Mentor sessions page |
| 11. Yearly rollover; finding out about a move (school, parent, inactivity flag); individual plan; old school sees only its years; new school needs partnership and parent agreement; warm leads | Done. Journals, magazines and books can be bought one at a time in the app's Store (the Lerne admin adds items; buyers pay by Razorpay, then open the content) |
| 12. Getprofily link: message near the end of Grade 12, student takes over at 18, optional link with a consent screen | Done. After Grade 12 or from age 18, control passes to the student (once the student has their own login) and the student can link to Getprofily |
| 13. Phases 1, 2 and 3 | All built together |

## Landing page content document
All sections are built from `portfolio lerne - Landing Page Content.docx`: header, hero with Sign in and Create an account, What it does
(Record, Verify, Discover), Who it's for, external uploads (14 days), Verify a record, For schools (links to lerne.co.in/Partners),
Your data is safe, and the footer with contact details. Grades 1 to 12 are supported as the document says.
The Privacy Policy, Terms of Use and "How we use your data" pages are short summaries that need your lawyer's final text.

## Review checklist (account flow and admin)
| Point | Status |
|---|---|
| Parent: "Is this your child?" then consent with date and time; both parents' numbers link to the same child | Done (each parent has their own record and mobile) |
| SMS provider and DLT | Setup task, see `PROVIDER-CHECKLIST.md` |
| Student login from a Lerne ID | Done (hidden address made from the ID); Grades 1 to 5 use the parent's login |
| School admin and teacher starting passwords | Done: must be changed at first sign-in |
| Accounts created only on the server | Done: the secret service key is used only in server code (Next.js server actions and routes), never in the browser |
| Individual sign-ups | Done (Create an account) |
| Verification queue: Ask for more proof; days waiting | Done |
| Delete: confirmation, audit log, soft delete first | Done |
| Consent records and withdrawals visible to admin | Done (Consents page) |
| Row Level Security: parents, schools, teachers, areas to grow, approvals | Rules are in `schema.sql`; `supabase/rls-tests.sql` tests them (not yet run) |

## Still open (decisions and tasks, not code)
Final product name; verification turnaround and who handles the queue; whether verification is charged per upload or included in the
school package; whether Grades 6 to 8 get their own login (optional in the app); individual plan price; whether students who move can
still enter Grand Test and Challenges individually at a higher fee; getting Namecheap access; accounts and paid plans; SMS provider and
DLT; legal review of consent text and privacy notice; and the first live run and testing.
