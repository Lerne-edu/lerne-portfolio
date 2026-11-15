import type { SupabaseClient } from '@supabase/supabase-js'

// Records who did what. Never blocks the action if logging fails.
export async function audit(supabase: SupabaseClient, action: string, table?: string, rowId?: string) {
  try { await supabase.rpc('log_audit', { p_action: action, p_table: table ?? null, p_row: rowId ?? null }) } catch {}
}
