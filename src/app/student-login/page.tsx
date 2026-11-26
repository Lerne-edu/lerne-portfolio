import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthShell from '@/components/AuthShell'
import { allow, clientIp } from '@/lib/ratelimit'

async function signIn(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const lerneId = String(formData.get('lerne_id')).trim().toLowerCase()
  if (!(await allow(supabase, `student:${lerneId}`, 10, 900)) || !(await allow(supabase, `studentip:${await clientIp()}`, 30, 3600))) redirect('/student-login?error=limit')
  const { error } = await supabase.auth.signInWithPassword({
    email: `${lerneId}@students.lerne.co.in`,
    password: String(formData.get('password')),
  })
  if (error) redirect('/student-login?error=1')
  redirect('/')
}

export default async function StudentLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <AuthShell mode="signin" role="student" title="Student sign in" subtitle="Use your Lerne ID and the password your parent set for you.">
      <form action={signIn} className="flex flex-col gap-4">
        <label className="field"><span>Lerne ID</span><input name="lerne_id" required autoComplete="username" placeholder="LERNE-2026-00001" /></label>
        <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required placeholder="Your password" /></label>
        {error && <p className="form-error" role="alert">{error === 'limit' ? 'Too many attempts. Please wait a few minutes.' : 'Wrong Lerne ID or password.'}</p>}
        <button className="bg-blue-600 text-white">Sign in</button>
      </form>
      <p className="auth-hint"><b>Forgot your password?</b> Ask your parent to set a new one from the Records page after they sign in, or write to connect@lerne.co.in.</p>
      <p className="auth-hint">Students in Grades 1 to 5 sign in through their parent&apos;s account.</p>
    </AuthShell>
  )
}