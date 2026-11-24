# portfolio@lerne: set up, run, deploy

Follow the parts in order. Parts 1 to 6 get it running and tested on your computer (about 1 to 2 hours the first time).
Parts 7 to 9 put it online. Part 10 adds the optional services. Part 11 is the go-live checklist.
Use a **separate test Supabase project** first, and a new one for real students later.

Menus on websites change names now and then. If a label differs slightly, look for the nearest match.

---

## Part 1. Install the tools (once)
1. **Node.js 20 or newer**: nodejs.org > download the LTS version > install with the defaults.
2. **Git**: git-scm.com > download > install with the defaults.
3. **VS Code** (optional, to read files): code.visualstudio.com.
4. Open a terminal and check: `node -v` (must show v20 or higher) and `git --version`.
   - Windows: search "PowerShell" or "Windows Terminal". Mac: search "Terminal".

## Part 2. Open the project
1. Unzip `lerne-portfolio-final.zip`. You get a folder `lerne-portfolio`.
2. Open a terminal **inside that folder**:
   - Windows: open the folder in File Explorer, click the address bar, type `powershell`, press Enter.
   - Mac: right-click the folder > Services > New Terminal at Folder (or type `cd ` then drag the folder into Terminal).
3. Run: `npm install`. It takes a few minutes. Warnings are normal; red "ERR!" lines are not (see Part 12).

## Part 3. Create the database (Supabase)
1. Go to **supabase.com**, sign up, and click **New project**.
   - Name: `lerne-portfolio-test`. Database password: make a strong one and save it in a password manager.
   - Region: the closest to India (Mumbai if offered, otherwise Singapore). Create the project and wait until it finishes.
2. Open **SQL Editor** (left menu) > **New query**.
3. Open `supabase/schema.sql` from the folder in VS Code or Notepad, **select all, copy**, paste into the query box, click **Run**.
   - Supabase may warn about a "destructive operation": that is expected. The script rebuilds the app's own tables and stops by itself
     if student data already exists.
   - It must end with "Success". If you see an error, copy the full message and send it to me.
   - If it says `type "user_role" already exists`, the script ran before: just run it again.
4. Check **Storage**: you should see three buckets, `proofs`, `photos` and `store`, all marked private.
5. **Authentication** (left menu):
   - Sign In / Providers > **Email** is enabled. Turn on **Confirm email**.
   - Leave Phone for Part 10 (it needs an SMS provider).

## Part 4. Get your environment values
Copy `.env.example` to a new file named `.env.local` in the same folder (Windows: `copy .env.example .env.local`, Mac: `cp .env.example .env.local`),
then fill in the values below. Open it in VS Code or Notepad.

| Value | Required | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase > your project > **Project Settings** (gear) > **API** (or API Keys). Copy **Project URL**, like `https://abcdefghij.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Same page. Copy the **anon public** key (or the **publishable** key if that is what the page shows) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Same page. Reveal and copy the **service_role** key (or the **secret** key). **Private**: never post it, never put it in a message or in browser code |
| `NEXT_PUBLIC_SITE_URL` | Yes | `http://localhost:3000` on your computer. Later: `https://portfolio.lerne.co.in` |
| `CRON_SECRET` | Yes | Any long random text. In the terminal run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the result |
| `CSP_ENFORCE`, `REQUIRE_ADMIN_MFA` | No | Keep `false` for now (Part 11 explains when to turn them on) |
| `RESEND_API_KEY`, `NOTIFY_FROM` | No | resend.com > **API Keys** > Create API Key. `NOTIFY_FROM` is like `Lerne <noreply@lerne.co.in>` and needs your domain verified in Resend (Part 10) |
| `INDIVIDUAL_PLAN_PRICE_INR`, `MENTOR_SESSION_PRICE_INR` | No | Your own prices in rupees. Leave empty until decided |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | No | Razorpay dashboard > **Account & Settings** > **API Keys** > Generate (use **Test mode** first). The secret is shown once: save it |
| `RAZORPAY_WEBHOOK_SECRET` | No | Razorpay > **Settings** > **Webhooks** > Add. You type this secret yourself (Part 10) |
| `MSG91_*` | No | MSG91 dashboard: **Authkey** under your profile or API settings; template IDs under **SMS > Templates** (Part 10) |
| `WHATSAPP_*` | No | Meta for Developers > your app > WhatsApp > **API Setup** (phone number ID, access token) and approved template names |
| `ANTHROPIC_API_KEY` | No | console.anthropic.com > **API Keys** > Create key |

Save the file. Then test it:
```
npm run check
```
It lists what is right and what to fix (wrong URL, tables missing, bucket public, and so on). Run it again after each fix until it says
"All required checks passed".

## Part 5. Make your admin account and start the app
1. Create the first Lerne admin (no SQL needed):
   ```
   npm run create-admin
   ```
   Type your email, your name, and a password of 10 or more characters (hidden as you type).
2. Start the app:
   ```
   npm run dev
   ```
3. Open **http://localhost:3000**. You see the landing page. Click **Sign in**, then the **School / Team** tab, and sign in with your admin email and password.
   You land on the **Verification queue** with the admin sidebar.
4. Optional: add the font files in `src/fonts` (see `src/fonts/README.txt`) so PDFs can print Tamil and Hindi names.

### Who signs in where
| Person | Page | Sign in with | Lands on |
|---|---|---|---|
| Lerne admin | Sign in > School / Team | email and password | Verification queue |
| School admin | Sign in > School / Team | email and password (must change the starting password) | School dashboard |
| Teacher | Sign in > School / Team | email and password (must change it) | School dashboard (own grades) |
| Parent | Sign in > Parent | mobile number and OTP, or mobile/email and password | Records |
| Student | Sign in > Student | Lerne ID and the password the parent set | Records |
| New family (school not a partner) | Create account | email and password | Records after consent |

How accounts get made: the Lerne admin creates school admins (Admin > School admins); a school admin creates teachers (Dashboard > Manage teachers);
parents come from the school's student list (Admin > Upload students) and sign in by OTP; the parent sets the student's password on the Records page.

### Try everything without an SMS provider
1. Admin > **Schools**: add a school. Admin > **Upload students**: download the template, add 2 or 3 fake students, upload.
2. Admin > **School admins**: create a principal; sign out and sign in as that school admin (School / Team tab) and change the password.
3. A test parent: in Supabase > **Authentication > Users > Add user** (tick Auto confirm), copy the new **User UID**, then in the **SQL Editor** run:
   `insert into profiles (id, role, full_name) values ('PASTE-UID', 'parent', 'Test Parent');`
   `update parents set user_id = 'PASTE-UID' where mobile = '9000000001';` (use a mobile from your test list)
   Sign in on the School / Team tab with that email and password, answer "Is this your child?" and the consent question.
4. On the Records page the parent sets a password for the student, who then signs in on the Student tab with the Lerne ID (like LERNE-2026-00001).

## Part 6. Test it properly
1. Supabase SQL Editor: run `supabase/rls-tests.sql`. It prints a PASS/FAIL table for the access rules (every row must say PASS).
   Then run `supabase/rls-cleanup.sql`.
2. Work through `TEST-PLAN.md` (the "must fail" tests protect children's data).
3. `npm run build` then `npm start`: the build must finish without errors.
4. Send me every error message exactly as shown.

## Part 7. Put the code on GitHub
1. github.com > sign up > **New repository** > name `lerne-portfolio` > **Private** > create.
2. In the terminal inside the project folder:
   ```
   git init
   git add .
   git commit -m "portfolio@lerne"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/lerne-portfolio.git
   git push -u origin main
   ```
   (Use the address GitHub shows. `.env.local` is ignored by git, so your secrets are not uploaded. Check that it is not listed in the repository.)

## Part 8. Deploy on Vercel
1. vercel.com > sign up with GitHub > **Add New > Project** > import `lerne-portfolio`. Framework: Next.js (detected). Leave the settings.
2. Open **Environment Variables** and add **every value from your `.env.local`** (name and value, one by one; the Supabase values must be for the project you want live).
   Set `NEXT_PUBLIC_SITE_URL` to `https://portfolio.lerne.co.in` (or the `xxxx.vercel.app` address first).
3. Click **Deploy**. When it finishes, open the address Vercel shows and check the landing page and the sign-in.
4. Changed a variable later? Vercel > **Settings > Environment Variables**, edit, then **Deployments > Redeploy**.
5. The free Hobby plan is not allowed for commercial use: upgrade to **Pro** before real families use it (it also allows the daily job).

## Part 9. Your own address: portfolio.lerne.co.in
1. Vercel > the project > **Settings > Domains** > add `portfolio.lerne.co.in`. Vercel shows a record to add (usually a CNAME).
2. Namecheap > **Domain List** > **Manage** next to lerne.co.in > **Advanced DNS** > **Add New Record**:
   Type **CNAME**, Host `portfolio`, Value = what Vercel showed, TTL Automatic. Save.
3. Wait a few minutes to a few hours until Vercel shows the domain as valid (HTTPS is added automatically).
4. Supabase > **Authentication > URL Configuration**: set **Site URL** to `https://portfolio.lerne.co.in` and add it to **Redirect URLs**.
5. Make sure `NEXT_PUBLIC_SITE_URL` in Vercel is `https://portfolio.lerne.co.in`, then redeploy.
6. On lerne.co.in add the Student Login button (`website/StudentLoginButton.jsx`).

## Part 10. Optional services (set up when you need them)
- **Parent OTP by SMS (needed for parents to sign in by mobile):** Supabase > Authentication > Sign In / Providers > **Phone** > enable and pick an SMS provider
  (Twilio, Vonage, MessageBird or TextLocal are built in; for MSG91 deploy `supabase/functions/sms-hook`). In India register with **DLT** and get message templates approved first (this takes days).
  While testing you can add test phone numbers with fixed codes in the same Phone settings.
- **Sign-up confirmation emails:** Supabase > Authentication > **SMTP Settings**: use Resend's SMTP details so confirmation emails come from your domain.
- **Email notifications (Resend):** resend.com > **Domains** > add `lerne.co.in` > add the DNS records Resend shows in Namecheap (Advanced DNS) > wait until verified > create an API key.
- **Payments (Razorpay):** Test mode first. Dashboard > **Settings > Webhooks > Add new webhook**: URL `https://portfolio.lerne.co.in/api/razorpay/webhook`,
  events `payment.captured` and `order.paid`, a secret you choose (put the same in `RAZORPAY_WEBHOOK_SECRET`). Set the prices in Vercel.
- **SMS and WhatsApp messages, AI summaries:** see `PROVIDER-CHECKLIST.md`.
- **Daily job:** nothing to install: `vercel.json` schedules it; it needs `CRON_SECRET` set in Vercel and the Pro plan. Check Vercel > Logs the next day.

## Part 11. Security switches and go-live
Read `SECURITY.md`, then:
1. Open every page and the payment window with the browser console open. When no security-policy reports appear, set `CSP_ENFORCE=true` in Vercel and redeploy.
2. Supabase > Authentication: turn on MFA (TOTP). Each admin signs in once and sets up the authenticator app at `/mfa`. Only then set `REQUIRE_ADMIN_MFA=true`.
3. Supabase password rules: minimum length 10 or more; leaked-password protection (Pro plan).
4. Create a **new Supabase project for real data**: run `schema.sql`, `npm run create-admin` (with that project's keys in the Production environment), point Vercel's **Production** variables at it.
5. Upgrade Supabase to **Pro** (backups, no pausing) and Vercel to **Pro**.
6. Two-step login on Supabase, Vercel, GitHub, Namecheap and Razorpay. Strong unique passwords.
7. Run `TEST-PLAN.md` again on the live site with fake data, then delete it (Admin > Students > hide, then delete permanently).
8. Complete `LAUNCH-CHECKLIST.md` (consent text and privacy notice reviewed for India's DPDP Act, 2023; support contact; who watches the audit log).
9. Pilot with **one** school: Admin > Schools > School admins > Upload students > Duplicates > Parent invites. Fix issues before adding more.

## Part 12. Updating and troubleshooting
**Updating:** change the code, then `git add .`, `git commit -m "change"`, `git push`; Vercel redeploys by itself. Database changes: write a new SQL file and run it in the
SQL Editor. **Never re-run all of `schema.sql` on a database that has real data** (it refuses, on purpose).

| What you see | What to do |
|---|---|
| `relation "public.students" does not exist` or `relation "schools" does not exist` | `schema.sql` did not finish, so the tables were never created. Use the current `schema.sql` (the start-of-script check was fixed), run it alone first and wait for "Success", then run `rls-tests.sql`. |
| `type "user_role" already exists` | The script ran before. Run the current `schema.sql` again (it clears the test tables first). |
| `npm install` errors | Check `node -v` shows v20 or higher, you are online, and you are inside the project folder. Delete the `node_modules` folder and run it again. |
| `npm run check` says tables are missing | Run `supabase/schema.sql` in the SQL Editor. |
| `npm run check` says service key refused | Copy the service_role (secret) key again into `.env.local`. |
| Page says "Invalid API key" or sign-in loops | Wrong Supabase values in `.env.local` or Vercel. Fix, restart `npm run dev` (or redeploy). |
| `npm run create-admin` says role could not be saved | `schema.sql` was not run yet. Run it, then try again. |
| OTP never arrives | SMS provider not set up, DLT templates not approved, or the 3-requests-per-15-minutes limit. |
| Build fails on Vercel | Open the build log, copy the first red error, and send it to me. |
| PDF shows "?" for Tamil | Add the Noto font files to `src/fonts`. |
| Upload refused | Only PDF, JPG or PNG up to 4 MB are accepted; the message at the top of the page says why. |
| Locked out after turning on admin two-step sign-in | In Vercel set `REQUIRE_ADMIN_MFA=false` and redeploy, then fix the setup. |

---

## Parent sign-in by emailed code (free; no SMS or DLT needed)

Parents sign in at `/parent-login` with a 6-digit code sent to the email address their school entered
(the `parent_email` column of the student list). Mobile SMS login stays in the code but is hidden until
you set `PARENT_SMS_LOGIN=true` (it needs DLT registration and an SMS provider).

1. **SQL (existing project):** run `supabase/email-otp.sql` once in the Supabase SQL Editor. (A new project already
   gets it from `schema.sql`.) It adds `parent_email_registered()` and updates `claim_parent_account()`.
2. **Custom email sender:** Authentication > SMTP Settings. Without it Supabase only emails your own team.
   Use Resend (`smtp.resend.com`, port 465, username `resend`, password = API key, sender on your verified domain).
3. **Email templates (Lerne look):** Authentication > Emails > Templates. For each tab below, set the subject and paste the
   whole file from `supabase/email-templates/` as the body, then Save:

   | Supabase tab | Subject | File |
   |---|---|---|
   | Confirm signup | Confirm your Lerne account | `confirm-signup.html` |
   | Magic Link | Your Lerne sign-in code | `magic-link.html` |
   | Reset Password | Reset your Lerne password | `recovery.html` |
   | Invite user | You are invited to Lerne portfolio | `invite.html` |
   | Change Email Address | Confirm your new email | `email-change.html` |
   | Reauthentication | Your Lerne confirmation code | `reauthentication.html` |

   Open `supabase/email-templates/preview.html` in a browser to see all six without sending anything.
   (Confirm signup and Magic Link are both needed: a first-time parent gets Confirm signup, a returning one gets Magic Link.)

   **Links pointing to localhost:** the button in these emails goes to the **Site URL** set in Supabase, so set it to the live address:
   Authentication > **URL Configuration** > **Site URL** = `https://portfolio.lerne.co.in` (or your `xxxx.vercel.app` address until the
   domain is connected). Under **Redirect URLs** add `https://portfolio.lerne.co.in/**` and, for testing, `http://localhost:3000/**`.
   Also set `NEXT_PUBLIC_SITE_URL` in Vercel to the same address and redeploy. The logo in the emails loads from this address too.
4. Authentication > Rate Limits: raise the email limit to match your expected sign-ins.
5. Test: put your own email on a parent in a test student list, then sign in with it at `/parent-login`.

Parents whose school did not enter an email cannot use this; they can use "Use a password instead",
or the school can add the email and re-upload the list.
