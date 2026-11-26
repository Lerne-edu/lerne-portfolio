import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import { toE164India } from '@/lib/phone'
import { allow, clientIp } from '@/lib/ratelimit'

// Parents sign in with a 6-digit code sent to the EMAIL their school has on file (free).
// Sign-in by mobile SMS code stays available but is hidden until PARENT_SMS_LOGIN=true (it needs DLT registration in India).
const smsOn = () => process.env.PARENT_SMS_LOGIN === 'true'
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

async function sendEmailOtp(formData: FormData) {
  'use server'
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!validEmail(email)) redirect('/parent-login?error=email')
  const supabase = await createClient()
  if (!(await allow(supabase, `eotp:${email}`, 3, 900)) || !(await allow(supabase, `eotpip:${await clientIp()}`, 20, 3600))) redirect('/parent-login?error=limit')
  const { data: registered } = await supabase.rpc('parent_email_registered', { p_email: email })
  if (!registered) redirect(`/parent-login?error=noacc&tried=${encodeURIComponent(email)}`)
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) {
    console.error('[parent-login] signInWithOtp failed:', error.message, error.status)
    redirect('/parent-login?error=send')
  }
  redirect(`/parent-login?email=${encodeURIComponent(email)}`)
}

async function verifyEmail(formData: FormData) {
  'use server'
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const supabase = await createClient()
  if (!(await allow(supabase, `everify:${email}`, 10, 900))) redirect(`/parent-login?email=${encodeURIComponent(email)}&error=limit`)
  const { error } = await supabase.auth.verifyOtp({ email, token: String(formData.get('token')).trim(), type: 'email' })
  if (error) redirect(`/parent-login?email=${encodeURIComponent(email)}&error=1`)
  await supabase.rpc('claim_parent_account')
  redirect('/')
}

async function sendOtp(formData: FormData) {
  'use server'
  if (!smsOn()) redirect('/parent-login')
  const phone = toE164India(String(formData.get('phone')))
  if (phone) {
    const supabase = await createClient()
    if (!(await allow(supabase, `otp:${phone}`, 3, 900)) || !(await allow(supabase, `otpip:${await clientIp()}`, 20, 3600))) redirect('/parent-login?via=phone&error=limit')
    const { data: registered } = await supabase.rpc('parent_phone_registered', { p_phone: phone })
    if (!registered) redirect(`/parent-login?via=phone&error=noacc&tried=${encodeURIComponent(phone)}`)
    const { error } = await supabase.auth.signInWithOtp({ phone })
    if (error) redirect('/parent-login?via=phone&error=send')
    redirect(`/parent-login?phone=${encodeURIComponent(phone)}`)
  }
  redirect('/parent-login?via=phone&error=phone')
}

async function verify(formData: FormData) {
  'use server'
  const phone = String(formData.get('phone'))
  const supabase = await createClient()
  if (!(await allow(supabase, `verify:${phone}`, 10, 900))) redirect(`/parent-login?phone=${encodeURIComponent(phone)}&error=limit`)
  const { error } = await supabase.auth.verifyOtp({ phone, token: String(formData.get('token')).trim(), type: 'sms' })
  if (error) redirect(`/parent-login?phone=${encodeURIComponent(phone)}&error=1`)
  await supabase.rpc('claim_parent_account')
  redirect('/')
}

async function signInPassword(formData: FormData) {
  'use server'
  const id = String(formData.get('id')).trim()
  const isEmail = id.includes('@')
  const phone = isEmail ? null : toE164India(id)
  if (!isEmail && !phone) redirect('/parent-login?error=pwd')
  const key = isEmail ? id.toLowerCase() : (phone as string)
  const supabase = await createClient()
  if (!(await allow(supabase, `pwd:${key}`, 10, 900)) || !(await allow(supabase, `pwdip:${await clientIp()}`, 30, 3600))) redirect('/parent-login?error=limit')
  const password = String(formData.get('password'))
  const { error } = await supabase.auth.signInWithPassword(isEmail ? { email: key, password } : { phone: phone as string, password })
  if (error) redirect('/parent-login?error=pwd')
  redirect('/')
}

type SP = { email?: string; phone?: string; via?: string; error?: string; tried?: string }

export default async function ParentLogin({ searchParams }: { searchParams: Promise<SP> }) {
  const { email, phone, via, error, tried } = await searchParams
  const sms = smsOn()
  const codeStep = Boolean(email) || Boolean(phone)
  const subtitle = codeStep
    ? 'Enter the 6-digit code we sent you.'
    : via === 'phone' && sms
      ? "Use the mobile number registered with your child's school."
      : "Use the email address your child's school has for you."

  return (
    <AuthShell mode="signin" role="parent" title="Parent sign in" subtitle={subtitle}>
      {error === 'limit' && <p className="form-error" role="alert">Too many attempts. Please wait a few minutes.</p>}
      {error === 'email' && <p className="form-error" role="alert">Please enter a valid email address.</p>}
      {error === 'phone' && <p className="form-error" role="alert">Please enter a valid 10-digit mobile number.</p>}
      {error === 'send' && <p className="form-error" role="alert">We could not send the code right now. Please try again in a little while.</p>}
      {error === 'noacc' && (
        <p className="form-error" role="alert">
          No account found{tried ? <> for <b>{tried.replace(/^\+91/, '')}</b></> : null}. {via === 'phone' ? 'Check the number, or use the mobile number your school has for you.' : 'Check the email address, or use the email your school has for you.'}{' '}
          Not signed up yet? <Link href="/signup">Create an account</Link>.
        </p>
      )}

      {email ? (
        <>
          <p className="auth-hint">We sent a 6-digit code to <b>{email}</b>. Check your spam folder too.</p>
          <form action={verifyEmail} className="flex flex-col gap-4">
            <input type="hidden" name="email" value={email} />
            <label className="field"><span>6-digit code</span><input name="token" inputMode="numeric" autoComplete="one-time-code" required placeholder="123456" /></label>
            {error === '1' && <p className="form-error" role="alert">That code did not work. Try again, or request a new one.</p>}
            <button className="bg-blue-600 text-white">Verify and sign in</button>
          </form>
          <Link href="/parent-login" className="back-link">← Use a different email</Link>
        </>
      ) : phone ? (
        <>
          <p className="auth-hint">We sent a 6-digit code to <b>{phone}</b>.</p>
          <form action={verify} className="flex flex-col gap-4">
            <input type="hidden" name="phone" value={phone} />
            <label className="field"><span>6-digit code</span><input name="token" inputMode="numeric" autoComplete="one-time-code" required placeholder="123456" /></label>
            {error === '1' && <p className="form-error" role="alert">That code did not work. Try again.</p>}
            <button className="bg-blue-600 text-white">Verify and sign in</button>
          </form>
          <Link href="/parent-login?via=phone" className="back-link">← Use a different number</Link>
        </>
      ) : (
        <>
          {via === 'phone' && sms ? (
            <form action={sendOtp} className="flex flex-col gap-4">
              <label className="field"><span>Mobile number</span><input name="phone" type="tel" autoComplete="tel" required placeholder="98765 43210" /></label>
              <button className="bg-blue-600 text-white">Send OTP</button>
            </form>
          ) : (
            <form action={sendEmailOtp} className="flex flex-col gap-4">
              <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
              <button className="bg-blue-600 text-white">Send code</button>
            </form>
          )}
          {sms && (
            <Link href={via === 'phone' ? '/parent-login' : '/parent-login?via=phone'} className="back-link">
              {via === 'phone' ? 'Use email instead' : 'Use mobile number instead'}
            </Link>
          )}
          <p className="auth-hint">Created your own account (child not at a partner school)? Sign in on the <Link href="/individual-login">Individual tab</Link>.</p>
          <details className="pw-toggle" open={error === 'pwd'}>
            <summary>Use a password instead</summary>
            {error === 'pwd' && <p className="form-error" role="alert">Wrong mobile number, email or password.</p>}
            <form action={signInPassword} className="flex flex-col gap-4">
              <label className="field"><span>Mobile number or email</span><input name="id" required autoComplete="username" placeholder="Mobile number or email" /></label>
              <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required placeholder="Your password" /></label>
              <button className="border">Sign in with password</button>
            </form>
          </details>
        </>
      )}
    </AuthShell>
  )
}