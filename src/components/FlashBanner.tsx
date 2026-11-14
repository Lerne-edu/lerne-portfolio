'use client'
import { useEffect, useState } from 'react'

export default function FlashBanner({ message, kind }: { message: string; kind: 'ok' | 'error' }) {
  const [show, setShow] = useState(true)
  useEffect(() => {
    document.cookie = 'flash=; Max-Age=0; path=/' // show it once
    const t = setTimeout(() => setShow(false), 7000)
    return () => clearTimeout(t)
  }, [])
  if (!show) return null
  return (
    <div role="status" className={`flash flash-${kind}`}>
      <span>{message}</span>
      <button onClick={() => setShow(false)} aria-label="Close message">×</button>
    </div>
  )
}
