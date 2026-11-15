import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PayButton from '@/components/PayButton'

// Journals, magazines and books bought one at a time. Anyone signed in can see the list;
// parents (and students once independent) can buy, and then open what they bought.
export default async function Store() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const { data: independent } = await supabase.rpc('getprofily_eligible')
  const canBuy = me?.role === 'parent' || !!independent
  const { data: items } = await supabase.from('store_items').select('id, title, kind, description, price_inr').eq('active', true).order('kind').order('title')
  const { data: bought } = await supabase.from('purchases').select('item_id')
  const owned = new Set((bought ?? []).map((b) => b.item_id))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/records" className="text-sm text-blue-600 underline">Back to records</Link>
      <h1 className="my-4 text-2xl font-semibold">Store</h1>
      <p className="mb-6 text-sm text-gray-600">Journals, magazines and books from Lerne, bought one at a time.</p>
      {!canBuy && <p className="mb-4 rounded bg-amber-50 p-3 text-sm">Ask a parent to buy. Students can open what their parent has bought.</p>}
      <ul className="space-y-3" style={{ listStyle: 'none', padding: 0 }}>
        {(items ?? []).map((it) => (
          <li key={it.id} className="rounded border p-4">
            <div className="text-xs uppercase text-gray-600">{it.kind}</div>
            <div className="text-lg font-semibold">{it.title}</div>
            {it.description && <p className="mb-2 text-sm">{it.description}</p>}
            {owned.has(it.id)
              ? <a href={`/store/${it.id}/open`} className="rounded border px-3 py-2 text-sm">Open</a>
              : canBuy
                ? <div><p className="mb-2 text-sm font-medium">₹{it.price_inr}</p><PayButton kind="item" itemId={it.id} label="Buy" /></div>
                : <p className="text-sm font-medium">₹{it.price_inr}</p>}
          </li>
        ))}
        {(items ?? []).length === 0 && <li className="text-sm text-gray-500">Nothing in the store yet.</li>}
      </ul>
    </main>
  )
}
