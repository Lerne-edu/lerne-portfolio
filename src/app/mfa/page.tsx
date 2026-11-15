import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { allow } from '@/lib/ratelimit'
import { flash } from '@/lib/flash'
import AuthShell from '@/components/AuthShell'

// Two-step sign-in with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy...).
// Written to Supabase's documented MFA (TOTP) API; switched on for admins with REQUIRE_ADMIN_MFA=true.
async function verifyCode(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!(await allow(supabase, `mfa:${user.id}`, 10, 900))) return flash('Too many attempts. Please wait a few minutes.', 'error')
  const factorId = String(formData.get('factor_id'))
  const { data: challenge, error: e1 } = await supabase.auth.mfa.challenge({ factorId })
  if (e1 || !challenge) return flash('Could not start the check. Please try again.', 'error')
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: String(formData.get('code')).trim() })
  if (error) return flash('That code did not work. Check the time on your phone and try again.', 'error')
  await flash('Verified.')
  redirect('/')
}

export default async function Mfa() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: factors } = await supabase.auth.mfa.listFactors()
  const verified = factors?.totp?.find((f) => f.status === 'verified')

  if (verified) {
    return (
      <AuthShell mode="signin" plain title="Two-step check" subtitle="Enter the 6-digit code from your authenticator app.">
        <form action={verifyCode} className="flex flex-col gap-4">
          <input type="hidden" name="factor_id" value={verified.id} />
          <label className="field"><span>6-digit code</span><input name="code" inputMode="numeric" autoComplete="one-time-code" required placeholder="123456" /></label>
          <button className="bg-blue-600 text-white">Verify</button>
        </form>
      </AuthShell>
    )
  }

  // First time: clear unfinished attempts and make a fresh setup
  for (const f of factors?.all ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
  const { data: enr, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'portfolio@lerne' })
  if (error || !enr) {
    return (
      <AuthShell mode="signin" plain title="Two-step setup" subtitle="We could not start the setup.">
        <p className="form-error">Two-step sign-in (MFA) may not be switched on for this Supabase project. In Supabase, open Authentication and enable multi-factor authentication (TOTP), then reload.</p>
      </AuthShell>
    )
  }
  return (
    <AuthShell mode="signin" plain title="Set up two-step sign-in" subtitle="Scan this code with an authenticator app, then enter the 6-digit code it shows.">
      <div className="qr-box"><img src={enr.totp.qr_code} alt="QR code for your authenticator app" /></div>
      <p className="auth-hint">Cannot scan? Enter this key in the app: <b style={{ wordBreak: 'break-all' }}>{enr.totp.secret}</b></p>
      <form action={verifyCode} className="flex flex-col gap-4" style={{ marginTop: 16 }}>
        <input type="hidden" name="factor_id" value={enr.id} />
        <label className="field"><span>6-digit code</span><input name="code" inputMode="numeric" autoComplete="one-time-code" required placeholder="123456" /></label>
        <button className="bg-blue-600 text-white">Turn on two-step sign-in</button>
      </form>
    </AuthShell>
  )
}
