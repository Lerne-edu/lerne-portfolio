import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Opens a store item for someone who bought it. The access link and file stay on the server.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const { data: bought } = await supabase.from('purchases').select('id').eq('item_id', id).maybeSingle()
  if (!bought) return new Response('You have not bought this item.', { status: 403 })

  const admin = createAdminClient()
  const { data: item } = await admin.from('store_items').select('access_url, file_path').eq('id', id).single()
  if (item?.file_path) {
    const { data } = await admin.storage.from('store').createSignedUrl(item.file_path, 300)
    if (data) return NextResponse.redirect(data.signedUrl)
  }
  if (item?.access_url) return NextResponse.redirect(item.access_url)
  return new Response('This item has no content yet. Please contact Lerne.', { status: 404 })
}
