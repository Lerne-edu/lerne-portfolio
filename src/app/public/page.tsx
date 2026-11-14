import { createClient } from '@/lib/supabase/server'

type Search = { school?: string; id?: string }

export default async function PublicProfile({ searchParams }: { searchParams: Promise<Search> }) {
  const { school, id } = await searchParams
  const supabase = await createClient()
  const { data: schools } = await supabase.rpc('public_schools')
  const { data: p } = school && id ? await supabase.rpc('public_profile', { p_school_code: school, p_lerne_id: id }) : { data: null }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Verify a portfolio</h1>
      <p className="mb-6 text-sm text-gray-600">Choose the school and enter the student&apos;s exact Lerne ID. Only profiles the family has made public are shown.</p>
      <form className="mb-8 grid gap-2">
        <select name="school" defaultValue={school ?? ''} required className="rounded border p-2">
          <option value="">Choose state and school</option>
          {(schools ?? []).map((s: any) => <option key={s.school_code} value={s.school_code}>{s.state} - {s.name}</option>)}
        </select>
        <input name="id" defaultValue={id ?? ''} placeholder="Lerne ID, e.g. LERNE-2026-00001" required className="rounded border p-2" />
        <button className="rounded bg-blue-600 p-2 text-white">View</button>
      </form>
      {school && id && !p && <p className="text-sm text-gray-600">No public profile found for these details.</p>}
      {p && (
        <section>
          <h2 className="text-xl font-semibold">{p.name}</h2>
          <p className="mb-4 text-sm text-gray-600">{p.lerne_id} · {p.school}, {p.state}</p>
          <ul className="space-y-2">
            {p.achievements.map((a: any, i: number) => (
              <li key={i} className="rounded border p-3 text-sm">
                <div className="font-medium">{a.title} <span className="text-green-700">· Verified by Lerne</span></div>
                <div className="text-gray-600">{String(a.category).replace(/_/g, ' ')} · {a.level} · {String(a.result).replace(/_/g, ' ')} · {a.date}</div>
              </li>
            ))}
            {p.achievements.length === 0 && <li className="text-sm text-gray-500">No records have been made public yet.</li>}
          </ul>
        </section>
      )}
    </main>
  )
}
