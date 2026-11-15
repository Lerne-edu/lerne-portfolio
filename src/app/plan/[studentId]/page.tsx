import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PayButton from '@/components/PayButton'

export default async function Plan({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params
  const supabase = await createClient()
  const { data: s } = await supabase.from('students').select('id, full_name').eq('id', studentId).single()
  if (!s) notFound()
  const { data: plan } = await supabase.from('individual_plans').select('active_until').eq('student_id', s.id).maybeSingle()
  const price = Number(process.env.INDIVIDUAL_PLAN_PRICE_INR)
  const active = plan && new Date(plan.active_until) >= new Date()
  return (
    <main className="mx-auto max-w-xl p-6">
      <Link href="/records" className="text-sm text-blue-600 underline">Back to records</Link>
      <h1 className="my-4 text-2xl font-semibold">Individual plan for {s.full_name}</h1>
      <p className="mb-4 text-sm">
        Your record stays free to view, download and share for life. The plan lets you keep adding achievements,
        have them verified, and get an updated strengths summary and portfolio PDF.
        Journal, magazine and book access can be bought one at a time in the <Link href="/store" className="text-blue-600 underline">store</Link>.
      </p>
      {active ? <p className="rounded border bg-green-50 p-4 text-sm">Active until {plan!.active_until}.</p>
        : price ? <><p className="mb-4 font-medium">₹{price} per year</p><PayButton kind="plan" studentId={s.id} /></>
        : <p className="text-sm text-gray-600">The plan price has not been set yet.</p>}
    </main>
  )
}
