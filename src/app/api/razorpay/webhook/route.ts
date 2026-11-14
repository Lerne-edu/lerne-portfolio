import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// In the Razorpay dashboard add a webhook to this URL for payment.captured and order.paid,
// with the same secret as RAZORPAY_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const body = await req.text()
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  const sig = req.headers.get('x-razorpay-signature') ?? ''
  if (!secret) return new Response('Not set up', { status: 500 })
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return new Response('Bad signature', { status: 401 })

  const ev = JSON.parse(body)
  if (ev.event !== 'payment.captured' && ev.event !== 'order.paid') return new Response('ok')
  const pay = ev.payload?.payment?.entity
  const notes = pay?.notes ?? {}
  // Only our own orders; the same Razorpay account may also be used by the Lerne website
  if (!pay?.id || notes.app !== 'lerne-portfolio') return new Response('ok')

  const admin = createAdminClient()
  const kind: string = notes.kind ?? 'plan'
  const { error } = await admin.from('plan_payments').insert({
    payment_id: pay.id, student_id: notes.student_id ?? null, amount_paise: pay.amount, kind,
    user_id: notes.user_id ?? null, item_id: notes.item_id ?? null,
  })
  if (error) return new Response('ok') // already processed

  if (kind === 'mentor' && notes.student_id) {
    await admin.from('mentor_sessions').insert({ student_id: notes.student_id, payment_id: pay.id })
  } else if (kind === 'item' && notes.item_id && notes.user_id) {
    await admin.from('purchases').insert({ user_id: notes.user_id, item_id: notes.item_id, payment_id: pay.id })
  } else if (kind === 'plan' && notes.student_id) {
    // Extend from today, or from the current end date if the plan is still running
    const { data: cur } = await admin.from('individual_plans').select('active_until').eq('student_id', notes.student_id).maybeSingle()
    const base = cur && new Date(cur.active_until) > new Date() ? new Date(cur.active_until) : new Date()
    base.setFullYear(base.getFullYear() + 1)
    await admin.from('individual_plans').upsert({ student_id: notes.student_id, active_until: base.toISOString().slice(0, 10) })
  }
  return new Response('ok')
}
