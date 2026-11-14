import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/guards'
import { audit } from '@/lib/audit'
import { sendSms } from '@/lib/sms'
import { sendWhatsApp } from '@/lib/whatsapp'
import { sendEmail } from '@/lib/email'
import AdminNav from '@/components/AdminNav'

// Invites go to parents of a school's current students who have not logged in yet,
// and not to anyone invited in the last 7 days.
async function sendInvites(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const schoolId = String(formData.get('school_id'))
  const weekAgo = Date.now() - 7 * 86400000

  const found = new Map<string, { id: string; mobile: string | null; email: string | null }>()
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('enrollments')
      .select('students(student_parents(parents(id, mobile, email, user_id, invited_at)))')
      .eq('school_id', schoolId).is('left_on', null).range(from, from + 999)
    for (const e of (data ?? []) as any[]) {
      for (const sp of e.students?.student_parents ?? []) {
        const p = sp.parents
        if (p && !p.user_id && p.mobile && (!p.invited_at || new Date(p.invited_at).getTime() < weekAgo)) found.set(p.id, p)
      }
    }
    if (!data || data.length < 1000) break
  }

  const parents = [...found.values()]
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/parent-login`
  const mobiles = parents.map((p) => p.mobile as string)
  // The SMS template has one short variable, so it carries the site address only
  await sendSms(mobiles, link.replace(/^https?:\/\//, '').replace('/parent-login', ''), process.env.MSG91_INVITE_TEMPLATE_ID)
  await sendWhatsApp(mobiles, process.env.WHATSAPP_INVITE_TEMPLATE_NAME, [link])
  await sendEmail(parents.map((p) => p.email ?? ''), "Your child's portfolio@lerne is ready",
    `Your child's verified achievement record is ready. Sign in with the mobile number you gave your school: ${link}`)

  for (let i = 0; i < parents.length; i += 200) {
    await supabase.from('parents').update({ invited_at: new Date().toISOString() }).in('id', parents.slice(i, i + 200).map((p) => p.id))
  }
  await audit(supabase, 'send_parent_invites', 'schools', schoolId)
  redirect(`/admin/invites?n=${parents.length}`)
}

export default async function Invites({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { n } = await searchParams
  const supabase = await requireAdmin()
  const { data: schools } = await supabase.from('schools').select('id, school_code, name').order('school_code')
  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-2 text-2xl font-semibold">Parent invites</h1>
      <p className="mb-4 text-sm text-gray-600">
        After a school&apos;s student list is uploaded, invite its parents. Each parent who has not logged in yet gets the
        sign-in link by SMS, WhatsApp and email, whichever channels you have set up. Nobody is invited twice in 7 days.
      </p>
      <form action={sendInvites} className="grid gap-2 rounded border p-4">
        <select name="school_id" required className="rounded border p-2">
          <option value="">Choose school</option>
          {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}
        </select>
        <button className="rounded bg-blue-600 p-2 text-white">Send invites</button>
      </form>
      {n !== undefined && <p className="mt-6 rounded border p-4 text-sm">Invites sent to {n} parents.</p>}
    </main>
  )
}
