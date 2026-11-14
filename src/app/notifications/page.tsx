import { revalidatePath } from 'next/cache'
import { flash } from '@/lib/flash'
import { createClient } from '@/lib/supabase/server'

async function markRead() {
  'use server'
  const supabase = await createClient()
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  await flash('All marked as read.')
  revalidatePath('/notifications')
}

export default async function Notifications() {
  const supabase = await createClient()
  const { data } = await supabase.from('notifications').select('id, title, body, link, read_at, created_at').order('created_at', { ascending: false }).limit(50)
  return (
    <main className="mx-auto max-w-2xl p-6">
      <a href="/records" className="text-sm text-blue-600 underline">Back to records</a>
      <div className="my-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <form action={markRead}><button className="text-sm text-blue-600 underline">Mark all as read</button></form>
      </div>
      <ul className="space-y-2">
        {(data ?? []).map((n) => (
          <li key={n.id} className={`rounded border p-3 text-sm ${n.read_at ? '' : 'bg-blue-50'}`}>
            <div className="font-medium">{n.title}</div>
            {n.body && <div>{n.body}</div>}
            <div className="mt-1 text-xs text-gray-500">{new Date(n.created_at).toLocaleString('en-IN')}{n.link && <> · <a href={n.link} className="text-blue-600 underline">Open</a></>}</div>
          </li>
        ))}
        {(data ?? []).length === 0 && <li className="text-sm text-gray-500">Nothing yet.</li>}
      </ul>
    </main>
  )
}
