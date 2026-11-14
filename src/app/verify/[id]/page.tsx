import { createClient } from '@/lib/supabase/server'

export default async function Verify({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: r } = /^[0-9a-f-]{36}$/i.test(id) ? await supabase.rpc('verify_record', { p_id: id }) : { data: null }
  return (
    <main className="mx-auto mt-16 max-w-md p-6">
      {r ? (
        <div className="rounded border border-green-600 p-6">
          <p className="mb-3 text-lg font-semibold text-green-700">Verified by Lerne</p>
          <p className="text-xl font-semibold">{r.title}</p>
          <p className="mt-2 text-sm">Issued to: {String(r.name).split(' ').filter(Boolean).map((w: string) => w[0].toUpperCase()).join('.')}.</p>
          <p className="text-sm text-gray-600">{String(r.category).replace(/_/g, ' ')} · {r.level} · {String(r.result).replace(/_/g, ' ')} · {r.date}</p>
          {r.organiser && <p className="text-sm text-gray-600">Organised by {r.organiser}</p>}
        </div>
      ) : (
        <div className="rounded border p-6">
          <p className="font-semibold">Record not found</p>
          <p className="text-sm text-gray-600">This code does not match a verified Lerne record.</p>
        </div>
      )}
    </main>
  )
}
