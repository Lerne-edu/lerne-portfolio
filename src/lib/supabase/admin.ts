import { createClient } from '@supabase/supabase-js'

// Server only. Uses the service key, which bypasses row level security.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}
