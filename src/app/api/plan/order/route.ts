import { createClient } from '@/lib/supabase/server'
import { sameOrigin } from '@/lib/origin'

// Creates a Razorpay order for: the individual plan, a mentor session, or a store item.
// Orders are tagged app=lerne-portfolio so the webhook ignores payments that belong to other Lerne products.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'Not allowed' }, { status: 403 })
  const { kind = 'plan', studentId, itemId } = await req.json()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Sign in first' }, { status: 401 })

  const notes: Record<string, string> = { app: 'lerne-portfolio', kind, user_id: user.id }
  let price = 0

  if (kind === 'plan' || kind === 'mentor') {
    const { data: ok } = await supabase.rpc('can_control', { sid: studentId }) // the parent, or the student once independent
    if (!ok) return Response.json({ error: 'Not allowed' }, { status: 403 })
    price = Number(kind === 'plan' ? process.env.INDIVIDUAL_PLAN_PRICE_INR : process.env.MENTOR_SESSION_PRICE_INR)
    notes.student_id = studentId
  } else if (kind === 'item') {
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const { data: independent } = await supabase.rpc('getprofily_eligible')
    if (me?.role !== 'parent' && !independent) return Response.json({ error: 'Ask a parent to buy this' }, { status: 403 })
    const { data: item } = await supabase.from('store_items').select('id, price_inr').eq('id', itemId).eq('active', true).single()
    if (!item) return Response.json({ error: 'Item not found' }, { status: 404 })
    price = item.price_inr
    notes.item_id = item.id
  } else {
    return Response.json({ error: 'Unknown order' }, { status: 400 })
  }

  const id = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET
  if (!price || !id || !secret) return Response.json({ error: 'Payments are not set up yet' }, { status: 400 })

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: price * 100, currency: 'INR', receipt: `${kind}-${Date.now()}`, notes }),
  })
  const order = await res.json()
  if (!res.ok) return Response.json({ error: 'Could not create the order' }, { status: 502 })
  return Response.json({ orderId: order.id, amount: order.amount, key: id })
}
