import './globals.css'
import './brand.css'
import './auth.css'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import FlashBanner from '@/components/FlashBanner'
import SiteHeader from '@/components/SiteHeader'

export const metadata: Metadata = {
  title: 'portfolio@lerne',
  description: "A verified record of every student's achievements",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let flash: { message: string; kind: 'ok' | 'error' } | null = null
  try {
    const raw = (await cookies()).get('flash')?.value
    if (raw) flash = JSON.parse(decodeURIComponent(raw))
  } catch {}
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@500;600&family=Playfair+Display:wght@500;600;700;800&family=Quicksand:wght@600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/png" href="/favicon.png" />
      </head>
      <body>
        <SiteHeader />
        {flash && <FlashBanner key={flash.message} message={flash.message} kind={flash.kind} />}
        {children}
        <footer className="site-footer">
          <div className="footer-grid">
            <div>
              <strong>portfolio@lerne</strong>
              <p>A verified record of every student&apos;s achievements.</p>
            </div>
            <div className="footer-links">
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms">Terms of Use</a>
              <a href="/data-use">How we use your data</a>
              <a href="mailto:connect@lerne.co.in">Contact</a>
              <a href="/#verify">Verify a record</a>
            </div>
            <div>
              <a href="mailto:connect@lerne.co.in">connect@lerne.co.in</a><br />
              <a href="tel:+918667666311">+91-8667666311</a>
            </div>
          </div>
          <p className="footer-copy">© 2026 Lerne. All rights reserved.</p>
        </footer>
      </body>
    </html>
  )
}