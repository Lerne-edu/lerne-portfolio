import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// "Verify a record": a certificate code goes to that record; a Lerne ID shows only what the family has made public.
export default async function Verify({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const code = (q ?? '').trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code)) redirect(`/verify/${code}`)

  const supabase = await createClient()
  const isId = /^LERNE-\d{4}-\d{5}$/i.test(code)
  const { data: r } = isId ? await supabase.rpc('public_by_lerne_id', { p_lerne_id: code }) : { data: null }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1>Verify a record</h1>
      <form className="verify-form my-6">
        <input name="q" defaultValue={code} required placeholder="Enter Lerne ID or certificate code" aria-label="Lerne ID or certificate code" />
        <button className="bg-blue-600 text-white">Verify</button>
      </form>
      {code && !isId && <p className="text-sm text-gray-600">Enter a Lerne ID like LERNE-2026-00001, or the code printed with a certificate.</p>}
      {isId && !r && <p className="text-sm text-gray-600">No public record found for this Lerne ID. Records are private unless the family chooses to share them.</p>}
      {r && (
        <>
          <p className="mb-3 text-sm text-gray-600">Verified achievements the family has chosen to share. No personal or contact details are shown.</p>
          <ul className="space-y-2" style={{ listStyle: 'none', padding: 0 }}>
            {r.achievements.map((a: any, i: number) => (
              <li key={i} className="rounded border p-3 text-sm">
                <div className="font-medium">{a.title} <span className="badge badge-verified">Verified by Lerne</span></div>
                <div className="text-gray-600">{String(a.category).replace(/_/g, ' ')} · {a.level} · {String(a.result).replace(/_/g, ' ')} · {a.date}</div>
              </li>
            ))}
            {r.achievements.length === 0 && <li className="text-sm text-gray-500">The family has not chosen to share any records yet.</li>}
          </ul>
        </>
      )}
    </main>
  )
}
