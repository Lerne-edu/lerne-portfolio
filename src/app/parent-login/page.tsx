import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import { toE164India } from '@/lib/phone'
import { allow, clientIp } from '@/lib/ratelimit'

async function sendOtp(formData: FormData) {
  'use server'
  const phone = toE164India(String(formData.get('phone')))
  if (phone) {
    const supabase = await createClient()
    if (!(await allow(supabase, `otp:${phone}`, 3, 900)) || !(await allow(supabase, `otpip:${await clientIp()}`, 20, 3600))) redirect('/parent-login?error=limit')
    const { data: registered } = await supabase.rpc('parent_phone_registered', { p_phone: phone })
    if (registered) await supabase.auth.signInWithOtp({ phone })
  }
  // Same response either way, so the page does not reveal which numbers are registered
  redirect(`/parent-login?phone=${encodeURIComponent(phone ?? '')}`)
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

export default async function ParentLogin({ searchParams }: { searchParams: Promise<{ phone?: string; error?: string }> }) {
  const { phone, error } = await searchParams
  return (
    <AuthShell mode="signin" role="parent" title="Parent sign in" subtitle={phone ? 'Enter the 6-digit code we sent you.' : "Use the mobile number registered with your child's school."}>
      {error === 'limit' && <p className="form-error" role="alert">Too many attempts. Please wait a few minutes.</p>}
      {!phone ? (
        <>
          <form action={sendOtp} className="flex flex-col gap-4">
            <label className="field"><span>Mobile number</span><input name="phone" type="tel" autoComplete="tel" required placeholder="98765 43210" /></label>
            <button className="bg-blue-600 text-white">Send OTP</button>
          </form>
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
      ) : (
        <>
          <p className="auth-hint">If this number is registered, we sent a 6-digit code to it.</p>
          <form action={verify} className="flex flex-col gap-4">
            <input type="hidden" name="phone" value={phone} />
            <label className="field"><span>6-digit code</span><input name="token" inputMode="numeric" autoComplete="one-time-code" required placeholder="123456" /></label>
            {error === '1' && <p className="form-error" role="alert">That code did not work. Try again.</p>}
            <button className="bg-blue-600 text-white">Verify and sign in</button>
          </form>
          <a href="/parent-login" className="back-link">← Use a different number</a>
        </>
      )}
    </AuthShell>
  )
}