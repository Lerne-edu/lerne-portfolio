'use client'
import { useState } from 'react'

declare global { interface Window { Razorpay: any } }

type Props = { kind?: 'plan' | 'mentor' | 'item'; studentId?: string; itemId?: string; label?: string }

export default function PayButton({ kind = 'plan', studentId, itemId, label = 'Pay now' }: Props) {
  const [msg, setMsg] = useState('')
  async function pay() {
    setMsg('')
    const res = await fetch('/api/plan/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, studentId, itemId }) })
    const order = await res.json()
    if (!res.ok) return setMsg(order.error ?? 'Could not start payment')
    await new Promise<void>((resolve) => {
      if (window.Razorpay) return resolve()
      const s = document.createElement('script')
      s.src = 'https://checkout.razorpay.com/v1/checkout.js'
      s.onload = () => resolve()
      document.body.appendChild(s)
    })
    new window.Razorpay({
      key: order.key, amount: order.amount, currency: 'INR', order_id: order.orderId, name: 'portfolio@lerne',
      handler: () => setMsg('Payment received. It is confirmed in a minute; refresh this page.'),
    }).open()
  }
  return (
    <div>
      <button onClick={pay} className="rounded bg-blue-600 px-4 py-2 text-white">{label}</button>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </div>
  )
}
