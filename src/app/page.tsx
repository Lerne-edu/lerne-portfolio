import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { completePendingSignup } from '@/lib/signup'
import Seal from '@/components/Seal'

const d = (i: number) => ({ '--i': i }) as React.CSSProperties
const to = (n: number) => ({ '--to': n }) as React.CSSProperties
// Splits a headline into words that rise into view one after another
const Words = ({ text, from = 0 }: { text: string; from?: number }) => (
  <>{text.split(' ').map((w, i) => (<span key={i}><span className="w"><span style={d(from + i)}>{w}</span></span>{' '}</span>))}</>
)
const TICKER = ['Science', 'Sports', 'Arts', 'Research', 'Innovation', 'Leadership', 'Debate', 'Music', 'Community', 'Entrepreneurship']

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    let { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    // A family that signed up on its own gets its account finished on first sign-in
    if (!profile && (await completePendingSignup(user.id))) redirect('/records')
    const role = profile?.role
    if (role === 'lerne_admin') redirect('/admin/queue')
    if (role === 'school_admin' || role === 'teacher') redirect('/school')
    if (role === 'parent' || role === 'student') redirect('/records')
    return <main className="mx-auto max-w-xl p-6"><h1>Your account is not ready</h1><p className="mt-3 text-sm">It has no role yet. Please contact the Lerne team at connect@lerne.co.in.</p></main>
  }

  return (
    <main className="home">
      {/* HERO */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow rise" style={d(0)}>portfolio@lerne</p>
            <h1><Words text="Every achievement, verified and in one place." from={1} /></h1>
            <p className="lead rise" style={d(9)}>From Grade 1 to Grade 12, portfolio@lerne keeps a lifelong record of everything a student achieves: in school, in Lerne programs, and beyond.</p>
            <div className="hero-actions rise" style={d(10)}>
              <Link href="/signin" className="btn-primary">Sign in <span className="arr" aria-hidden="true">→</span></Link>
              <Link href="/signup" className="btn-outline">Create an account</Link>
            </div>
            <ul className="trust rise" style={d(11)}>
              <li>Verified by Lerne</li>
              <li>Private by default</li>
              <li>Parent consent first</li>
            </ul>
            <p className="hero-note rise" style={d(12)}>Parents: sign in with the email address your child&apos;s school has for you.</p>
          </div>
          <div className="stack" aria-hidden="true">
            <i className="shape s-circle" /><i className="shape s-dot" /><i className="shape s-half" />
            <Seal size={128} uid="hero" className="stack-seal" />
            <article className="tk t1" style={{ '--k': 0, '--vd': '2.2s' } as React.CSSProperties}>
              <div><b>State Innovation Challenge</b><small>State · Winner · Dec 2026</small></div>
              <span className="vb"><span className="p">Pending</span><span className="v">✓ Verified</span></span>
            </article>
            <article className="tk t2" style={{ '--k': 1, '--vd': '3.4s' } as React.CSSProperties}>
              <div><b>Science Journal paper</b><small>National · Published · Oct 2026</small></div>
              <span className="vb"><span className="p">Pending</span><span className="v">✓ Verified</span></span>
            </article>
            <article className="tk t3" style={{ '--k': 2 } as React.CSSProperties}>
              <div><b>District chess open</b><small>District · Participation · Aug 2026</small></div>
              <span className="vb"><span className="p still">Pending</span></span>
            </article>
            <p className="stack-note">Where you&apos;re shining: <b>Innovation · Research</b></p>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map((n) => (
            <ul key={n}>{TICKER.map((t) => (<li key={t + n}>{t}</li>))}</ul>
          ))}
        </div>
      </div>

      {/* FACTS */}
      <section className="sec">
        <div className="wrap facts reveal">
          <div className="fact"><span className="num"><span className="count" style={to(12)}>12</span></span><p>grades, one lifelong record</p></div>
          <div className="fact"><span className="num"><span className="count" style={to(14)}>14</span></span><p>days for Lerne to verify an achievement</p></div>
          <div className="fact"><span className="num"><span className="count" style={to(100)}>100</span><span className="unit">%</span></span><p>private until a parent says otherwise</p></div>
        </div>
      </section>

      {/* WHAT IT DOES */}
      <section className="sec">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">What it does</span>
            <h2 className="sec-title">One trusted record, from the first grade to the last.</h2>
          </div>
          <div className="steps">
            <article className="step"><span className="step-num">01</span><h3>Record</h3><p>Every competition, publication, project and award is kept in a single timeline, year by year.</p></article>
            <article className="step"><span className="step-num">02</span><h3>Verify</h3><p>Each achievement is checked by Lerne before it appears, so the record is one you can trust.</p></article>
            <article className="step"><span className="step-num">03</span><h3>Discover</h3><p>See where you shine, how you&apos;ve grown, and which paths to explore next.</p></article>
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="sec">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">Who it&apos;s for</span>
            <h2 className="sec-title">Built for the whole circle around a student.</h2>
          </div>
          <div className="aud-list reveal">
            <div className="aud-row"><h3>Students</h3><p>Build a portfolio that grows with you and is ready when opportunities come.</p><span className="go" aria-hidden="true">→</span></div>
            <div className="aud-row"><h3>Parents</h3><p>Follow your child&apos;s progress and achievements anytime.</p><span className="go" aria-hidden="true">→</span></div>
            <div className="aud-row"><h3>Schools</h3><p>See every student&apos;s achievements across all grades in one dashboard.</p><span className="go" aria-hidden="true">→</span></div>
          </div>
        </div>
      </section>

      {/* EXTERNAL UPLOADS */}
      <section className="band">
        <i className="band-ring" aria-hidden="true" /><i className="band-dot" aria-hidden="true" />
        <div className="wrap band-inner">
          <div className="reveal">
            <h2>Add achievements from anywhere</h2>
            <p>Won a competition, published an article, or set a record outside school? Upload it with your certificate or proof. Lerne verifies it within 14 days, and it then becomes part of the record.</p>
          </div>
          <Link href="/signup" className="btn-light">Create an account <span className="arr" aria-hidden="true">→</span></Link>
        </div>
      </section>

      {/* VERIFY */}
      <section className="sec verify" id="verify">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">Verify a record</span>
            <h2 className="sec-title">Have a Lerne certificate to check?</h2>
            <p className="sec-lead">Enter the Lerne ID or the code printed on the certificate.</p>
          </div>
          <form action="/verify" className="searchbar reveal">
            <input name="q" required placeholder="Lerne ID or certificate code" aria-label="Lerne ID or certificate code" autoComplete="off" />
            <button className="bg-blue-600 text-white">Verify</button>
          </form>
          <small>Shows verified achievements only. No personal or contact details are displayed.</small>
        </div>
      </section>

      {/* SCHOOL PARTNERSHIP */}
      <section className="sec">
        <div className="wrap">
          <div className="schools reveal">
            <i className="schools-shape" aria-hidden="true" />
            <div>
              <span className="kicker">For schools</span>
              <h2>A complete, verified portfolio for every student.</h2>
              <p>Across all Lerne programs, available only through a Lerne partner school.</p>
            </div>
            <a href="https://lerne.co.in/Partners" className="btn-primary">Partner with Lerne <span className="arr" aria-hidden="true">→</span></a>
          </div>
        </div>
      </section>

      {/* PRIVACY */}
      <section className="sec">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">Privacy</span>
            <h2 className="sec-title">Your data is safe.</h2>
            <p className="sec-lead">Accounts go live only after parent consent. Records are private by default, and only the parent can choose to make a profile public.</p>
          </div>
          <div className="safe-grid">
            <article className="safe-item"><h3>Consent first</h3><p>Nothing goes live until a parent agrees.</p></article>
            <article className="safe-item"><h3>Private by default</h3><p>Only the parent can make a profile public.</p></article>
            <article className="safe-item"><h3>Verified only</h3><p>Public pages show verified achievements, never contact details.</p></article>
          </div>
        </div>
      </section>
    </main>
  )
}