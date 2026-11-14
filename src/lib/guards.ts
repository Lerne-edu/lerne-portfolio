import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Use at the top of every Lerne-admin page and action. Returns the user's own client.
export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  if (me?.role !== 'lerne_admin') redirect('/')
  return supabase
}
