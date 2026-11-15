import { headers } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function clientIp() {
  const h = await headers()
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
}

// Returns false once the limit is exceeded. If the check itself fails, the request is let through.
export async function allow(supabase: SupabaseClient, key: string, limit: number, windowSeconds: number) {
  const { data, error } = await supabase.rpc('rate_limit_hit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds })
  return error ? true : data !== false
}
