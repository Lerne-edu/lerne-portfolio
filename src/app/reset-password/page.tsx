import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { flash } from '@/lib/flash'
import AuthShell from '@/components/AuthShell'
import SubmitButton from '@/components/SubmitButton'

async function save(formData: FormData) {
  'use server'
  const password = String(formData.get('password'))
  if (password.length < 8 || password !== String(formData.get('again'))) return flash('Use 8 or more characters, and type the same password twice.', 'error')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/forgot-password?error=link')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return flash('Could not change the password. Please request a new link and try again.', 'error')
  await flash('Password changed. You are signed in.')
  redirect('/')
}

export default async function ResetPassword() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/forgot-password?error=link')
  return (
    <AuthShell mode="signin" plain title="Choose a new password" subtitle="Pick a password you have not used before.">
      <form action={save} className="flex flex-col gap-4">
        <label className="field"><span>New password (8+ characters)</span><input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
        <label className="field"><span>Type it again</span><input name="again" type="password" minLength={8} required autoComplete="new-password" /></label>
        <SubmitButton>Save password</SubmitButton>
      </form>
    </AuthShell>
  )
}
