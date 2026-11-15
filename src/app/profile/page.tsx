import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { flash } from '@/lib/flash'
import { sniffKind, MIME, type FileKind } from '@/lib/upload'

async function save(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const f = (k: string) => String(formData.get(k) || '').trim() || null
  const { error: opError } = await supabase.from('students').update({
    bio: f('bio'), interests: f('interests'), languages: f('languages'), aspiration: f('aspiration'), goals: f('goals'),
    birth_cert_no: f('birth_cert_no'), pen: f('pen'),
  }).eq('id', String(formData.get('student_id')))
  if (opError) return flash('Could not save. Please try again.', 'error')
  await flash('Saved.')
  revalidatePath('/profile')
}

async function uploadPhoto(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const sid = String(formData.get('student_id'))
  const file = formData.get('photo') as File | null
  if (!file || file.size === 0 || !['png', 'jpg'].includes((await sniffKind(file)) ?? '') || file.size > 2 * 1024 * 1024) {
    return flash('Use a JPG or PNG photo up to 2 MB.', 'error')
  }
  // Row level security returns this student only to their parent or themself
  const { data: mine } = await supabase.from('students').select('id, photo_path').eq('id', sid).single()
  if (!mine) return flash('Not allowed.', 'error')
  const admin = createAdminClient()
  const path = `${sid}/${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`
  const { error } = await admin.storage.from('photos').upload(path, file, { contentType: MIME[(await sniffKind(file)) as FileKind] })
  if (error) return flash('Could not upload the photo. Please try again.', 'error')
  await admin.from('students').update({ photo_path: path }).eq('id', sid)
  if (mine.photo_path) await admin.storage.from('photos').remove([mine.photo_path])
  await flash('Photo saved.')
  revalidatePath('/profile')
  revalidatePath('/records')
}

async function setBackupPassword(formData: FormData) {
  'use server'
  const password = String(formData.get('password'))
  if (password.length < 8) return flash('Use a password of 8 or more characters.', 'error')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'parent') return flash('Only a parent account can set this.', 'error')
  const email = String(formData.get('email') || '').trim().toLowerCase()
  // The parent is already signed in by OTP, so the email is added without a confirmation message
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user!.id, { password, ...(email ? { email, email_confirm: true } : {}) })
  if (error) return flash('Could not save. The email may already be used by another account.', 'error')
  if (email) await admin.from('parents').update({ email }).eq('user_id', user!.id)
  await flash('Saved. You can now sign in with your mobile number or email and this password.')
  revalidatePath('/profile')
}

// Students edit their own profile; parents edit their children's. Row level security decides who is allowed.
export default async function Profile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const { data: myParent } = await supabase.from('parents').select('email').maybeSingle()
  const { data: students } = await supabase.from('students').select('id, full_name, bio, interests, languages, aspiration, goals, birth_cert_no, pen').order('full_name')
  const inp = 'rounded border p-2'
  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/records" className="text-sm text-blue-600 underline">Back to records</Link>
      <h1 className="my-4 text-2xl font-semibold">Profile</h1>
      {(students ?? []).map((s) => (
        <div key={s.id} className="mb-8">
          <form action={uploadPhoto} className="mb-3 grid gap-2 rounded border p-4 text-sm">
            <b className="text-base">{s.full_name}: photo</b>
            <input type="hidden" name="student_id" value={s.id} />
            <input name="photo" type="file" accept=".jpg,.jpeg,.png" required className={inp} />
            <button className="rounded border px-3 py-2">Save photo</button>
          </form>
          <form action={save} className="grid gap-2 rounded border p-4 text-sm">
            <input type="hidden" name="student_id" value={s.id} />
            <textarea name="bio" defaultValue={s.bio ?? ''} placeholder="A short bio" className={inp} />
            <input name="interests" defaultValue={s.interests ?? ''} placeholder="Hobbies and interests" className={inp} />
            <input name="languages" defaultValue={s.languages ?? ''} placeholder="Languages known" className={inp} />
            <input name="aspiration" defaultValue={s.aspiration ?? ''} placeholder="Dream career or field of interest (update yearly)" className={inp} />
            <textarea name="goals" defaultValue={s.goals ?? ''} placeholder="Goals for this year" className={inp} />
            <input name="birth_cert_no" defaultValue={s.birth_cert_no ?? ''} placeholder="Birth certificate registration number (optional, helps avoid duplicates)" className={inp} />
            <input name="pen" defaultValue={s.pen ?? ''} placeholder="PEN, Permanent Education Number (optional)" className={inp} />
            <button className="rounded bg-blue-600 p-2 text-white">Save</button>
          </form>
        </div>
      ))}
      {me?.role === 'parent' && (
        <form action={setBackupPassword} className="grid gap-2 rounded border p-4 text-sm">
          <b className="text-base">Backup password</b>
          <p className="text-gray-600">Set a password so you can also sign in with your mobile number or email and the password, if an OTP does not arrive.</p>
          <input name="email" type="email" defaultValue={myParent?.email ?? ''} placeholder="Email (to sign in with email)" className={inp} />
          <input name="password" type="password" minLength={8} required placeholder="New password (8+ characters)" className={inp} />
          <button className="rounded border px-3 py-2">Save password</button>
        </form>
      )}
    </main>
  )
}
