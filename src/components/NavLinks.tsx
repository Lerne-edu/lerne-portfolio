'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavItem = { href: string; label: string; badge?: number }

export default function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname()
  return (
    <>
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={path === i.href || (i.href !== '/' && path.startsWith(i.href + '/')) ? 'active' : ''}>
          {i.label}
          {!!i.badge && <span className="pill-dot">{i.badge}</span>}
        </Link>
      ))}
    </>
  )
}
