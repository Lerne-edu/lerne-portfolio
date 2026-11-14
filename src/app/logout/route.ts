import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sameOrigin } from '@/lib/origin'

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response('Not allowed', { status: 403 })
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', req.url), 303)
}
