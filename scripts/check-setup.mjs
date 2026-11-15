// Checks your setup before you run or deploy: environment values, the Supabase connection, the database tables,
// the storage buckets and the first admin. Run it with:  npm run check
import { readFileSync, existsSync } from 'node:fs'

function loadEnv(file) {
  if (!existsSync(file)) return {}
  const out = {}
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    let v = line.slice(i + 1).trim()
    if (!/^["']/.test(v)) v = v.replace(/\s+#.*$/, '') // inline comment
    out[line.slice(0, i).trim()] = v.replace(/^["']|["']$/g, '')
  }
  return out
}

const env = { ...loadEnv('.env.local'), ...process.env }
let failed = 0
const ok = (m) => console.log('  \u2713 ' + m)
const bad = (m, fix) => { failed++; console.log('  \u2717 ' + m + (fix ? '\n      Fix: ' + fix : '')) }
const warn = (m) => console.log('  ! ' + m)
const head = (m) => console.log('\n' + m)

console.log('portfolio@lerne setup check')
if (!existsSync('.env.local')) console.log('\n  Note: there is no .env.local file here. Copy .env.example to .env.local and fill it in.')

head('1. Required values')
const need = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SITE_URL', 'CRON_SECRET']
for (const k of need) (env[k] && !/^(your-|https:\/\/YOUR)/i.test(env[k])) ? ok(k) : bad(k + ' is missing or still the example text', 'see "Get your environment values" in SETUP-GUIDE.md')
const url = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
if (url && !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) bad('NEXT_PUBLIC_SUPABASE_URL does not look like https://xxxx.supabase.co', 'copy the Project URL from Supabase, without any path after .co')
if (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY === env.NEXT_PUBLIC_SUPABASE_ANON_KEY) bad('The service key and the anon key are the same', 'the service (secret) key is the other, longer, private one')
if (env.CRON_SECRET && env.CRON_SECRET.length < 24) warn('CRON_SECRET is short; use a long random value')
if (env.NEXT_PUBLIC_SITE_URL && !/^https?:\/\//.test(env.NEXT_PUBLIC_SITE_URL)) bad('NEXT_PUBLIC_SITE_URL must start with http:// or https://')

if (failed) { console.log(`\n${failed} problem(s) above. Fix them and run "npm run check" again.\n`); process.exit(1) }

const get = async (path, key, anon) => {
  const res = await fetch(url + path, { headers: { apikey: key, Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(12000) })
  let body = null
  try { body = await res.json() } catch {}
  return { status: res.status, body }
}

head('2. Supabase connection')
let settings = null
try {
  const r = await get('/auth/v1/settings', env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (r.status === 200) { ok('The project URL and the anon key work'); settings = r.body }
  else bad('Supabase answered ' + r.status + ' to the anon key', 'check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
} catch (e) { bad('Could not reach ' + url + ' (' + (e.cause?.code || e.message) + ')', 'check your internet connection and the project URL') }

if (settings) {
  head('3. Database and storage')
  try {
    const t = await get('/rest/v1/schools?select=id&limit=1', env.SUPABASE_SERVICE_ROLE_KEY)
    if (t.status === 200) ok('The database tables exist (schema.sql was run)')
    else if (t.status === 401 || t.status === 403) bad('The service key was refused', 'copy the service_role (secret) key again')
    else bad('The tables are missing (' + (t.body?.code || t.status) + ')', 'run supabase/schema.sql in the Supabase SQL Editor')

    const a = await get('/rest/v1/profiles?role=eq.lerne_admin&select=id&limit=1', env.SUPABASE_SERVICE_ROLE_KEY)
    if (a.status === 200 && Array.isArray(a.body) && a.body.length) ok('A Lerne admin account exists')
    else if (t.status === 200) bad('No Lerne admin yet', 'run: npm run create-admin')

    const b = await get('/storage/v1/bucket', env.SUPABASE_SERVICE_ROLE_KEY)
    if (b.status === 200 && Array.isArray(b.body)) {
      for (const name of ['proofs', 'photos', 'store']) {
        const bucket = b.body.find((x) => x.name === name)
        if (!bucket) bad('Storage bucket "' + name + '" is missing', 're-run supabase/schema.sql')
        else if (bucket.public) bad('Storage bucket "' + name + '" is PUBLIC', 'in Supabase > Storage, make it private')
        else ok('Storage bucket "' + name + '" exists and is private')
      }
    } else warn('Could not read storage buckets (' + b.status + ')')
  } catch (e) { bad('Database check failed: ' + e.message) }

  head('4. Sign-in options in Supabase')
  const ext = settings.external || {}
  ext.email ? ok('Email sign-in is on') : bad('Email sign-in is off', 'Supabase > Authentication > Sign In / Providers > Email')
  if (env.PARENT_SMS_LOGIN === 'true') ext.phone ? ok('Phone (OTP) sign-in is on') : bad('PARENT_SMS_LOGIN is true but Phone sign-in is off in Supabase', 'Supabase > Authentication > Sign In / Providers > Phone, plus an SMS provider (see SETUP-GUIDE.md)')
  else console.log('    - Parents sign in with an emailed code (mobile SMS login is off: set PARENT_SMS_LOGIN=true after DLT and an SMS provider are ready)')
  settings.mailer_autoconfirm ? warn('Email confirmation is OFF: turn on "Confirm email" so sign-ups prove their address') : ok('Email confirmation is on')
}

head('5. Optional services (blank is fine until you need them)')
const group = (name, keys) => { const have = keys.filter((k) => env[k] && !/^$/.test(env[k])); have.length === keys.length ? ok(name + ': set') : have.length ? warn(name + ': only partly set (' + keys.filter((k) => !have.includes(k)).join(', ') + ' missing)') : console.log('    - ' + name + ': not set') }
group('Email (Resend)', ['RESEND_API_KEY', 'NOTIFY_FROM'])
group('Payments (Razorpay)', ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'])
group('Plan price', ['INDIVIDUAL_PLAN_PRICE_INR'])
group('SMS notifications (MSG91)', ['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID'])
group('WhatsApp', ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_TEMPLATE_NAME'])
group('AI summaries', ['ANTHROPIC_API_KEY'])
console.log('    Security switches: CSP_ENFORCE=' + (env.CSP_ENFORCE || 'false') + ', REQUIRE_ADMIN_MFA=' + (env.REQUIRE_ADMIN_MFA || 'false'))

console.log(failed ? `\n${failed} problem(s) found. Fix them and run "npm run check" again.\n` : '\nAll required checks passed. Next: npm run dev\n')
process.exit(failed ? 1 : 0)
