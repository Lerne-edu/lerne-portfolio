// Creates the first Lerne admin (or turns an existing login into one). Run it with:  npm run create-admin
// It uses the service key from .env.local on YOUR computer only, so nothing secret goes through a web page.
import { readFileSync, existsSync } from 'node:fs'
import * as readline from 'node:readline/promises'

function loadEnv(file) {
  if (!existsSync(file)) return {}
  const out = {}
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    let v = line.slice(i + 1).trim()
    if (!/^["']/.test(v)) v = v.replace(/\s+#.*$/, '')
    out[line.slice(0, i).trim()] = v.replace(/^["']|["']$/g, '')
  }
  return out
}
const env = { ...loadEnv('.env.local'), ...process.env }
const url = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('\nFill NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first (see SETUP-GUIDE.md).\n'); process.exit(1) }

function askHidden(q) {
  return new Promise((resolve) => {
    process.stdout.write(q)
    const stdin = process.stdin
    if (!stdin.isTTY) { const rl = readline.createInterface({ input: stdin }); rl.question('').then((a) => { rl.close(); resolve(a) }); return }
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8')
    let s = ''
    const on = (c) => {
      if (c === '\u0003') process.exit(1)
      if (c === '\r' || c === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', on); process.stdout.write('\n'); resolve(s) }
      else if (c === '\u007f' || c === '\b') s = s.slice(0, -1)
      else s += c
    }
    stdin.on('data', on)
  })
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const email = (process.argv[2] || (await rl.question('Admin email: '))).trim().toLowerCase()
const name = (process.argv[3] || (await rl.question('Full name: '))).trim()
rl.close()
const password = process.env.ADMIN_PASSWORD || (await askHidden('Password (10 or more characters, not shown): '))
if (!email.includes('@') || !name || password.length < 10) { console.error('\nNeeds a valid email, a name, and a password of 10 or more characters.\n'); process.exit(1) }

const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }
const call = async (path, opts = {}) => {
  const res = await fetch(url + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) }, signal: AbortSignal.timeout(15000) })
  const text = await res.text()
  let body = null; try { body = JSON.parse(text) } catch {}
  return { status: res.status, body, text }
}

let id
const created = await call('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) })
if (created.status === 200 || created.status === 201) id = created.body.id
else if (created.status === 422 || /already/i.test(created.text)) {
  const list = await call('/auth/v1/admin/users?per_page=1000')
  id = list.body?.users?.find((u) => u.email?.toLowerCase() === email)?.id
  if (!id) { console.error('\nThat email already exists but could not be found. Use the Supabase dashboard > Authentication > Users.\n'); process.exit(1) }
  await call('/auth/v1/admin/users/' + id, { method: 'PUT', body: JSON.stringify({ password, email_confirm: true }) })
  console.log('\nThat login already existed: its password was reset to the one you typed.')
} else { console.error('\nCould not create the login (' + created.status + '): ' + created.text + '\n'); process.exit(1) }

const profile = await call('/rest/v1/profiles?on_conflict=id', {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ id, role: 'lerne_admin', full_name: name, must_change_password: false }),
})
if (profile.status >= 300) {
  console.error('\nThe login was created but the admin role could not be saved (' + profile.status + '): ' + profile.text)
  console.error('Most likely schema.sql has not been run yet. Run it in the Supabase SQL Editor, then run this command again.\n')
  process.exit(1)
}
console.log(`\nDone. ${email} is now a Lerne admin.\nStart the app with "npm run dev", open http://localhost:3000/login and sign in.\n`)
