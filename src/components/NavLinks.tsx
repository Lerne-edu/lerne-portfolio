'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export type NavItem = { href: string; label: string; badge?: number; cta?: boolean; external?: boolean }

// The whole navigation: links on a wide screen, a menu button and dropdown on a phone.
export default function NavLinks({ items, signedIn }: { items: NavItem[]; signedIn: boolean }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [path])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button type="button" className="nav-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((o) => !o)}>
        <span /><span /><span />
      </button>
      <nav id="site-nav" className={`site-nav${open ? ' open' : ''}`} aria-label="Main">
        {items.map((i) => {
          const active = path === i.href || (i.href !== '/' && path.startsWith(i.href + '/'))
          const cls = [i.cta ? 'nav-cta' : '', active ? 'active' : ''].filter(Boolean).join(' ')
          return i.external
            ? <a key={i.href} href={i.href} className={cls}>{i.label}</a>
            : <Link key={i.href} href={i.href} className={cls}>{i.label}{!!i.badge && <span className="pill-dot">{i.badge}</span>}</Link>
        })}
        {signedIn && (
          <form action="/logout" method="post"><button className="signout">Sign out</button></form>
        )}
      </nav>
    </>
  )
}
