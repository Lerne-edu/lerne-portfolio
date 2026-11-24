import '@fontsource/marcellus'
import '@fontsource-variable/figtree'
import './globals.css'
import './brand.css'
import './auth.css'
import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import FlashBanner from '@/components/FlashBanner'
import NavProgress from '@/components/NavProgress'
import SiteHeader from '@/components/SiteHeader'

export const metadata: Metadata = {
  title: 'portfolio@lerne',
  description: "A verified record of every student's achievements",
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F0E3CA' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let flash: { message: string; kind: 'ok' | 'error' } | null = null
  try {
    const raw = (await cookies()).get('flash')?.value
    if (raw) flash = JSON.parse(decodeURIComponent(raw))
  } catch {}
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
      </head>
      <body>
        <Suspense fallback={null}><NavProgress /></Suspense>
        <SiteHeader />
        {flash && <FlashBanner key={flash.message} message={flash.message} kind={flash.kind} />}
        {children}
        <footer className="site-footer">
          <div className="wrap">
            <div className="footer-grid">
              <div>
                <div className="footer-brand"><img src="/logo.png" alt="" width={44} height={44} /><b>LERNE</b></div>
                <p>A verified record of every student&apos;s achievements, from Grade 1 to Grade 12 and beyond.</p>
              </div>
              <div>
                <h4>Explore</h4>
                <div className="footer-links">
                  <Link href="/signin">Sign in</Link>
                  <Link href="/signup">Create an account</Link>
                  <Link href="/#verify">Verify a record</Link>
                  <a href="https://lerne.co.in">lerne.co.in</a>
                </div>
              </div>
              <div>
                <h4>Legal and contact</h4>
                <div className="footer-links">
                  <Link href="/privacy">Privacy Policy</Link>
                  <Link href="/terms">Terms of Use</Link>
                  <Link href="/data-use">How we use your data</Link>
                  <a href="mailto:connect@lerne.co.in">connect@lerne.co.in</a>
                  <a href="tel:+918667666311">+91-8667666311</a>
                </div>
              </div>
            </div>
            <p className="footer-copy">© 2026 Lerne. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  )
}