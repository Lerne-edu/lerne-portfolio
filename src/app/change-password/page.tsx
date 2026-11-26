import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { flash } from '@/lib/flash'
import AuthShell from '@/components/AuthShell'
import SubmitButton from '@/components/SubmitButton'

async function change(formData: FormData) {
  'use server'
  const password = String(formData.get('password'))
  if (password.length < 8 || password !== String(formData.get('again'))) return flash('Use 8 or more characters, and type the same password twice.', 'error')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return flash('Could not change the password. Please try again.', 'error')
  await createAdminClient().from('profiles').update({ must_change_password: false }).eq('id', user.id)
  await flash('Password changed. Welcome!')
  redirect('/')
}

export default function ChangePassword() {
  return (
    <AuthShell mode="signin" plain title="Choose your password" subtitle="You signed in with a starting password. Please choose your own to continue.">
      <form action={change} className="flex flex-col gap-4">
        <label className="field"><span>New password (8+ characters)</span><input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
        <label className="field"><span>Type it again</span><input name="again" type="password" minLength={8} required autoComplete="new-password" /></label>
        <SubmitButton>Save and continue</SubmitButton>
      </form>
    </AuthShell>
  )
}
