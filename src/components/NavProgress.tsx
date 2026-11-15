'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// A slim line at the top of the screen that runs while the next page is being fetched.
// It replaces the old full-page "Loading..." box. To remove it, delete <NavProgress /> in app/layout.tsx.
export default function NavProgress() {
  const path = usePathname()
  const search = useSearchParams().toString()
  const [state, setState] = useState<'idle' | 'run' | 'done'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The page arrived: finish the line
  useEffect(() => {
    setState((s) => (s === 'run' ? 'done' : s))
    timer.current = setTimeout(() => setState('idle'), 700)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [path, search])

  // A link to another page was pressed: start the line
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin) return
      if (url.pathname === location.pathname && url.search === location.search) return
      if (timer.current) clearTimeout(timer.current)
      setState('idle')
      requestAnimationFrame(() => setState('run'))
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return <div className={`nav-progress ${state === 'idle' ? '' : state}`} aria-hidden="true" />
}
