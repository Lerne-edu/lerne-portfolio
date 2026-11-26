import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import { allow, clientIp } from '@/lib/ratelimit'

// Sends a password-reset link to the email on the account (individual, school admin, teacher, Lerne team).
async function sendLink(formData: FormData) {
  'use server'
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect('/forgot-password?error=email')
  const supabase = await createClient()
  if (!(await allow(supabase, `forgot:${email}`, 3, 900)) || !(await allow(supabase, `forgotip:${await clientIp()}`, 20, 3600))) redirect('/forgot-password?error=limit')
  // student logins use a made-up address with no inbox: they ask their parent instead
  if (!email.endsWith('@students.lerne.co.in')) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` })
    if (error) console.error('[forgot-password] failed:', error.message, error.status)
  }
  // same answer whether or not the email has an account
  redirect('/forgot-password?sent=1')
}

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams
  return (
    <AuthShell mode="signin" plain title="Forgot password" subtitle="Enter the email you sign in with and we will send you a link to choose a new password.">
      {sent ? (
        <p className="auth-hint">If this email has an account, we sent a reset link to it. Check your spam folder too. The link works for a short time only.</p>
      ) : (
        <form action={sendLink} className="flex flex-col gap-4">
          <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
          {error === 'email' && <p className="form-error" role="alert">Please enter a valid email address.</p>}
          {error === 'limit' && <p className="form-error" role="alert">Too many attempts. Please wait a few minutes.</p>}
          {error === 'link' && <p className="form-error" role="alert">That reset link has expired or was already used. Please request a new one.</p>}
          <button className="bg-blue-600 text-white">Send reset link</button>
        </form>
      )}
      <Link href="/signin" className="back-link">← Back to sign in</Link>
    </AuthShell>
  )
}