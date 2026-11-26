import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import { allow, clientIp } from '@/lib/ratelimit'

// For families who created their own account on this site (child not at a Lerne partner school).
async function signIn(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!(await allow(supabase, `ind:${email}`, 10, 900)) || !(await allow(supabase, `indip:${await clientIp()}`, 30, 3600))) redirect('/individual-login?error=limit')
  const { data: registered } = await supabase.rpc('parent_email_registered', { p_email: email })
  if (!registered) redirect(`/individual-login?error=noacc&tried=${encodeURIComponent(email)}`)
  const { error } = await supabase.auth.signInWithPassword({ email, password: String(formData.get('password') ?? '') })
  if (error) redirect(`/individual-login?error=pwd&tried=${encodeURIComponent(email)}`)
  redirect('/')
}

export default async function IndividualLogin({ searchParams }: { searchParams: Promise<{ error?: string; tried?: string }> }) {
  const { error, tried } = await searchParams
  return (
    <AuthShell mode="signin" role="individual" title="Individual sign in" subtitle="For families who created their own account (child not at a partner school).">
      <form action={signIn} className="flex flex-col gap-4">
        <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required defaultValue={tried ?? ''} placeholder="you@example.com" /></label>
        <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required placeholder="Your password" /></label>
        {error === 'limit' && <p className="form-error" role="alert">Too many attempts. Please wait a few minutes.</p>}
        {error === 'noacc' && <p className="form-error" role="alert">No account found for <b>{tried}</b>. Check the email, or <Link href="/signup">create an account</Link>.</p>}
        {error === 'pwd' && <p className="form-error" role="alert">Wrong password. If you just signed up, confirm your email first (check spam).</p>}
        <button className="bg-blue-600 text-white">Sign in</button>
      </form>
      <p className="auth-hint"><Link href="/forgot-password">Forgot password?</Link></p>
      <p className="auth-hint">No account yet? <Link href="/signup">Create an account</Link>. Child at a partner school? Use the Parent tab.</p>
    </AuthShell>
  )
}