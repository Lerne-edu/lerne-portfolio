import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import SubmitButton from '@/components/SubmitButton'
import { allow, clientIp } from '@/lib/ratelimit'

async function signIn(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const email = String(formData.get('email')).trim().toLowerCase()
  if (!(await allow(supabase, `login:${email}`, 10, 900)) || !(await allow(supabase, `loginip:${await clientIp()}`, 30, 3600))) redirect('/login?error=limit')
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  })
  if (error) redirect('/login?error=1')
  redirect('/')
}

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <AuthShell mode="signin" role="school" title="School and team sign in" subtitle="For school admins, teachers and the Lerne team.">
      <form action={signIn} className="flex flex-col gap-4">
        <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required placeholder="you@school.edu" /></label>
        <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required placeholder="Your password" /></label>
        {error && <p className="form-error" role="alert">{error === 'limit' ? 'Too many attempts. Please wait a few minutes.' : 'Wrong email or password.'}</p>}
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <p className="auth-hint"><Link href="/forgot-password">Forgot password?</Link></p>
    </AuthShell>
  )
}
