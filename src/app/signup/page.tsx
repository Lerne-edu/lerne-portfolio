import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allow, clientIp } from '@/lib/ratelimit'
import { flash } from '@/lib/flash'
import AuthShell from '@/components/AuthShell'

// For families whose child is not at a Lerne partner school (partner-school families are invited from the school's list).
async function signUp(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const f = (k: string) => String(formData.get(k) ?? '').trim()
  const email = f('email').toLowerCase()
  const password = String(formData.get('password') ?? '')
  const dob = f('dob')
  if (!f('parent_name') || !f('child_name') || !email.includes('@') || password.length < 8 || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || formData.get('agree') !== 'on') {
    return flash('Please fill in every field, use a password of 8 or more characters, and tick the box.', 'error')
  }
  if (!(await allow(supabase, `signup:${await clientIp()}`, 5, 3600))) return flash('Too many attempts. Please wait a while and try again.', 'error')

  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/signin` : undefined } })
  if (error || !data.user) {
    // Shows up in Vercel > Logs, so the real cause (usually the email sender) is visible
    console.error('[signup] supabase.auth.signUp failed:', error?.message, error?.status)
    const m = (error?.message ?? '').toLowerCase()
    if (m.includes('rate limit') || m.includes('sending') || m.includes('smtp')) {
      return flash('We could not send the confirmation email right now. Please try again in a little while.', 'error')
    }
    return flash('Could not create the account. Please check the details and try again.', 'error')
  }
  if (data.user.identities?.length === 0) return flash('An account with this email already exists. Please sign in instead.', 'error')

  await createAdminClient().from('pending_signups').upsert({
    user_id: data.user.id,
    data: { parent_name: f('parent_name'), email, mobile: f('mobile'), child_name: f('child_name'), dob, school_text: [f('school'), f('city')].filter(Boolean).join(', ') },
  })
  if (data.session) redirect('/') // email confirmation is switched off: signed in already
  await flash('Almost done. Check your email to confirm your address, then sign in.')
  redirect('/signin')
}

export default function SignUp() {
  return (
    <AuthShell mode="signup" wide title="Create your account" subtitle="For students whose school is not a Lerne partner. Partner-school parents: use the Sign in tab.">
      <form action={signUp} className="flex flex-col gap-4">
        <p className="group-label">Parent or guardian</p>
        <label className="field"><span>Full name</span><input name="parent_name" required autoComplete="name" /></label>
        <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="email" /></label>
        <label className="field"><span>Mobile (optional)</span><input name="mobile" type="tel" autoComplete="tel" /></label>
        <label className="field"><span>Password (8+ characters)</span><input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
        <p className="group-label">Student</p>
        <label className="field"><span>Student&apos;s full name</span><input name="child_name" required /></label>
        <label className="field"><span>Date of birth</span><input name="dob" type="date" required /></label>
        <label className="field"><span>Current school (optional)</span><input name="school" /></label>
        <label className="field"><span>School city (optional)</span><input name="city" /></label>
        <label className="check"><input name="agree" type="checkbox" required /> <span>I am the student&apos;s parent or guardian. I have read <Link href="/data-use">how we use data</Link>, and I understand the student&apos;s record is created only after I give consent on the next screen.</span></label>
        <button className="bg-blue-600 text-white">Create account</button>
      </form>
    </AuthShell>
  )
}