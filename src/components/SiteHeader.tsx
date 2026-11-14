import { createClient } from '@/lib/supabase/server'
import NavLinks, { type NavItem } from '@/components/NavLinks'

// One header for the whole app: the links change with who is signed in.
export default async function SiteHeader() {
  let items: NavItem[] = [{ href: 'https://lerne.co.in', label: 'Home (lerne.co.in)' }, { href: '/signin', label: 'Sign in' }]
  let signedIn = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      signedIn = true
      if (me?.role === 'lerne_admin') items = [{ href: '/admin/queue', label: 'Admin' }]
      else if (me?.role === 'school_admin') items = [{ href: '/school', label: 'Dashboard' }, { href: '/school/teachers', label: 'Teachers' }]
      else if (me?.role === 'teacher') items = [{ href: '/school', label: 'Dashboard' }]
      else if (me?.role === 'parent' || me?.role === 'student') {
        const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
        items = [
          { href: '/records', label: 'Records' }, { href: '/strengths', label: 'Strengths' }, { href: '/profile', label: 'Profile' },
          { href: '/store', label: 'Store' }, { href: '/notifications', label: 'Notifications', badge: count ?? 0 },
          ...(me.role === 'student' ? [{ href: '/getprofily', label: 'Getprofily' }] : []),
        ]
      } else items = [{ href: '/', label: 'Home' }]
    }
  } catch {}
  return (
    <header className="site-header">
      <a href="/" className="site-logo">
        <img src="/logo.png" alt="" />
        <span><span className="word">LERNE</span><span className="sub">portfolio@lerne</span></span>
      </a>
      <nav className="site-nav" aria-label="Main">
        <NavLinks items={items} />
        {signedIn && (
          <form action="/logout" method="post"><button className="signout">Sign out</button></form>
        )}
      </nav>
    </header>
  )
}
