import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/guards'
import { audit } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { flash } from '@/lib/flash'
import { sniffKind } from '@/lib/upload'
import AdminNav from '@/components/AdminNav'

async function addItem(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const admin = createAdminClient()
  const title = String(formData.get('title')).trim()
  const price = Number(formData.get('price_inr'))
  if (!title || !(price > 0)) return flash('Add a title and a price.', 'error')
  let filePath: string | null = null
  const file = formData.get('file') as File | null
  if (file && file.size > 0) {
    if ((await sniffKind(file)) !== 'pdf' || file.size > 4 * 1024 * 1024) return flash('Upload a PDF up to 4 MB, or use a link instead.', 'error')
    filePath = `${crypto.randomUUID()}.pdf`
    const { error } = await admin.storage.from('store').upload(filePath, file, { contentType: 'application/pdf' })
    if (error) return flash('Could not upload the file.', 'error')
  }
  const accessUrl = String(formData.get('access_url') || '').trim() || null
  if (!filePath && !accessUrl) return flash('Add a link or a PDF so buyers can open it.', 'error')
  const { error } = await admin.from('store_items').insert({
    title, kind: String(formData.get('kind')), description: String(formData.get('description') || '').trim() || null,
    price_inr: Math.round(price), access_url: accessUrl, file_path: filePath,
  })
  if (error) return flash('Could not add the item.', 'error')
  await audit(supabase, 'store_item_added', 'store_items', title)
  await flash('Item added.')
  revalidatePath('/admin/store')
}

async function toggleItem(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const id = String(formData.get('id'))
  await createAdminClient().from('store_items').update({ active: formData.get('on') === '1' }).eq('id', id)
  await audit(supabase, 'store_item_toggled', 'store_items', id)
  await flash('Updated.')
  revalidatePath('/admin/store')
}

export default async function AdminStore() {
  await requireAdmin()
  const { data: items } = await createAdminClient().from('store_items').select('id, title, kind, price_inr, active, access_url, file_path').order('created_at', { ascending: false })
  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-4 text-2xl font-semibold">Store items</h1>
      <form action={addItem} className="mb-8 grid gap-2 rounded border p-4 text-sm">
        <input name="title" required placeholder="Title" className="rounded border p-2" />
        <select name="kind" className="rounded border p-2"><option value="journal">Journal</option><option value="magazine">Magazine</option><option value="book">Book</option></select>
        <textarea name="description" placeholder="Short description" className="rounded border p-2" />
        <input name="price_inr" type="number" min={1} required placeholder="Price in rupees" className="rounded border p-2" />
        <input name="access_url" placeholder="Link to the content (or upload a PDF below)" className="rounded border p-2" />
        <input name="file" type="file" accept=".pdf" className="rounded border p-2" />
        <button className="rounded bg-blue-600 p-2 text-white">Add item</button>
      </form>
      <ul className="space-y-2">
        {(items ?? []).map((i) => (
          <li key={i.id} className="rounded border p-3 text-sm">
            <b>{i.title}</b> · {i.kind} · ₹{i.price_inr} · {i.active ? 'for sale' : 'hidden'} · {i.file_path ? 'PDF' : 'link'}
            <form action={toggleItem} className="mt-1">
              <input type="hidden" name="id" value={i.id} /><input type="hidden" name="on" value={i.active ? '0' : '1'} />
              <button className="text-blue-600 underline">{i.active ? 'Hide from store' : 'Show in store'}</button>
            </form>
          </li>
        ))}
        {(items ?? []).length === 0 && <li className="text-sm text-gray-500">No items yet.</li>}
      </ul>
    </main>
  )
}
