import { createClient } from '@/lib/supabase/server'
import NavLinks, { type NavItem } from '@/components/NavLinks'
import Link from 'next/link'

// One header for the whole app: the links change with who is signed in.
export default async function SiteHeader() {
  let items: NavItem[] = [{ href: 'https://lerne.co.in', label: 'Website', external: true }, { href: '/signin', label: 'Sign in', cta: true }]
  let signedIn = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // both lookups run at the same time, so the header adds only one wait, not two
      const [{ data: me }, { count }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user.id).single(),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
      ])
      signedIn = true
      if (me?.role === 'lerne_admin') items = [{ href: '/admin/queue', label: 'Admin' }]
      else if (me?.role === 'school_admin') items = [{ href: '/school', label: 'Dashboard' }, { href: '/school/teachers', label: 'Teachers' }]
      else if (me?.role === 'teacher') items = [{ href: '/school', label: 'Dashboard' }]
      else if (me?.role === 'parent' || me?.role === 'student') {
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
      <Link href="/" className="site-logo">
        <img src="/logo.png" alt="" width={42} height={42} />
        <span><span className="word">LERNE</span><span className="sub">portfolio@lerne</span></span>
      </Link>
      <NavLinks items={items} signedIn={signedIn} />
    </header>
  )
}
