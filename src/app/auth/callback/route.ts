import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// The reset link in the email lands here: it turns the one-time code into a short sign-in, then sends the person to choose a new password.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL('/reset-password', url.origin))
  }
  return NextResponse.redirect(new URL('/forgot-password?error=link', url.origin))
}