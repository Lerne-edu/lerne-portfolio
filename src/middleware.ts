import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }))
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const path = req.nextUrl.pathname
  const publicPaths = ['/login', '/parent-login', '/student-login', '/individual-login', '/forgot-password', '/reset-password', '/auth', '/signin', '/signup', '/privacy', '/terms', '/data-use', '/public', '/verify', '/api/getprofily', '/api/razorpay', '/api/cron', '/.well-known', '/robots.txt']
  const isPublic = path === '/' || publicPaths.some((p) => path.startsWith(p))
  if (!user && !isPublic) return NextResponse.redirect(new URL('/login', req.url))
  // Accounts created with a starting password must choose their own before doing anything else
  if (user && path !== '/change-password' && path !== '/logout' && !path.startsWith('/api')) {
    const { data: me } = await supabase.from('profiles').select('must_change_password, role').eq('id', user.id).maybeSingle()
    if (me?.must_change_password) return NextResponse.redirect(new URL('/change-password', req.url))
    // Signed-in people never see the empty home page: go straight to their own page
    if (path === '/') {
      if (me?.role === 'lerne_admin') return NextResponse.redirect(new URL('/admin/queue', req.url))
      if (me?.role === 'school_admin' || me?.role === 'teacher') return NextResponse.redirect(new URL('/school', req.url))
      if (me?.role === 'parent' || me?.role === 'student') return NextResponse.redirect(new URL('/records', req.url))
    }
    // Two-step check (authenticator app) for the Lerne team and school admins, once switched on with REQUIRE_ADMIN_MFA=true
    if (process.env.REQUIRE_ADMIN_MFA === 'true' && path !== '/mfa' && (path.startsWith('/admin') || path.startsWith('/school')) &&
        (me?.role === 'lerne_admin' || me?.role === 'school_admin')) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal && aal.currentLevel !== 'aal2') return NextResponse.redirect(new URL('/mfa', req.url))
    }
  }
  return res
}

// Images in /public (logo, icon) must load on the login pages too, so they skip the login check
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)'] }