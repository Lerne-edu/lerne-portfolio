import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import SubmitButton from '@/components/SubmitButton'
import { allow, clientIp } from '@/lib/ratelimit'

// Sends a password-reset link to the email on the account (individual, school admin, teacher, Lerne team).
async function sendLink(formData: FormData) {
  'use server'
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect('/forgot-password?error=email')
  const supabase = await createClient()
  if (!(await allow(supabase, `forgot:${email}`, 3, 900)) || !(await allow(supabase, `forgotip:${await clientIp()}`, 20, 3600))) redirect('/forgot-password?error=limit')
  // student logins use a made-up address with no inbox: they ask their parent instead
  if (email.endsWith('@students.lerne.co.in')) redirect('/forgot-password?error=student')
  const { data: registered } = await supabase.rpc('parent_email_registered', { p_email: email })
  if (!registered) redirect(`/forgot-password?error=noacc&tried=${encodeURIComponent(email)}`)
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` })
  if (error) {
    console.error('[forgot-password] failed:', error.message, error.status)
    redirect('/forgot-password?error=send')
  }
  redirect(`/forgot-password?sent=1&tried=${encodeURIComponent(email)}`)
}

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; tried?: string }> }) {
  const { sent, error, tried } = await searchParams
  return (
    <AuthShell mode="signin" plain title="Forgot password" subtitle="Enter the email you sign in with and we will send you a link to choose a new password.">
      {sent ? (
        <p className="auth-hint">We sent a password reset link to <b>{tried}</b>. Check your spam folder too. The link works for a short time only.</p>
      ) : (
        <form action={sendLink} className="flex flex-col gap-4">
          <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required defaultValue={tried ?? ''} placeholder="you@example.com" /></label>
          {error === 'email' && <p className="form-error" role="alert">Please enter a valid email address.</p>}
          {error === 'limit' && <p className="form-error" role="alert">Too many attempts. Please wait a few minutes.</p>}
          {error === 'noacc' && <p className="form-error" role="alert">This email is not registered. Check the email, or <Link href="/signup">create an account</Link>.</p>}
          {error === 'student' && <p className="form-error" role="alert">Student logins have no email. Ask your parent to set a new password from the Records page.</p>}
          {error === 'send' && <p className="form-error" role="alert">We could not send the email right now. Please try again in a little while.</p>}
          {error === 'link' && <p className="form-error" role="alert">That reset link has expired or was already used. Please request a new one.</p>}
          <SubmitButton>Send reset link</SubmitButton>
        </form>
      )}
      <Link href="/signin" className="back-link">← Back to sign in</Link>
    </AuthShell>
  )
}
