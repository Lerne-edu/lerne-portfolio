import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { completePendingSignup } from '@/lib/signup'

const Icon = ({ d }: { d: string }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)

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
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">portfolio@lerne</p>
            <h1>Every achievement, verified and in one place.</h1>
            <p className="lead">From Grade 1 to Grade 12, portfolio@lerne keeps a lifelong record of everything a student achieves: in school, in Lerne programs, and beyond.</p>
            <div className="hero-actions">
              <a href="/signin" className="btn-primary">Sign in</a>
              <a href="/signup" className="btn-outline">Create an account</a>
            </div>
            <p className="hero-note">Parents: use the mobile number registered with your child&apos;s school.</p>
          </div>
          <div className="sample" aria-hidden="true">
            <div className="sample-tag">Sample record</div>
            <div className="sample-head"><div className="sample-avatar">A</div><div><b>Asha K.</b><span>Grade 8 · LERNE-2026-00001</span></div></div>
            <ul>
              <li><div><b>State Innovation Challenge</b><span>State · Winner · Dec 2026</span></div><em className="badge badge-verified">Verified by Lerne</em></li>
              <li><div><b>Science Journal paper</b><span>National · Published · Oct 2026</span></div><em className="badge badge-verified">Verified by Lerne</em></li>
              <li><div><b>District chess open</b><span>District · Participation · Aug 2026</span></div><em className="badge badge-pending">Pending</em></li>
            </ul>
            <div className="sample-strip">Where you&apos;re shining: <b>Innovation · Research</b></div>
          </div>
        </div>
      </section>

      {/* WHAT IT DOES */}
      <section className="section">
        <h2 className="section-title">What it does</h2>
        <div className="card-grid three">
          <article className="feature"><span className="feature-icon"><Icon d="M4 6h16M4 12h10M4 18h16" /></span><h3>Record</h3><p>Every competition, publication, project and award is kept in a single timeline, year by year.</p></article>
          <article className="feature"><span className="feature-icon"><Icon d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3zM9 12l2 2 4-4" /></span><h3>Verify</h3><p>Each achievement is checked by Lerne before it appears, so the record is one you can trust.</p></article>
          <article className="feature"><span className="feature-icon"><Icon d="M12 3a9 9 0 100 18 9 9 0 000-18zM15.5 8.5l-2 5-5 2 2-5 5-2z" /></span><h3>Discover</h3><p>See where you shine, how you&apos;ve grown, and which paths to explore next.</p></article>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="section">
        <h2 className="section-title">Who it&apos;s for</h2>
        <div className="card-grid three">
          <article className="audience a-orange"><h3>Students</h3><p>Build a portfolio that grows with you and is ready when opportunities come.</p></article>
          <article className="audience a-green"><h3>Parents</h3><p>Follow your child&apos;s progress and achievements anytime.</p></article>
          <article className="audience a-gold"><h3>Schools</h3><p>See every student&apos;s achievements across all grades in one dashboard.</p></article>
        </div>
      </section>

      {/* EXTERNAL UPLOADS */}
      <section className="band">
        <div className="band-inner">
          <div>
            <h2>Add achievements from anywhere</h2>
            <p>Won a competition, published an article, or set a record outside school? Upload it with your certificate or proof. Lerne verifies it within 14 days, and it then becomes part of the record.</p>
          </div>
          <a href="/signup" className="btn-light">Create an account</a>
        </div>
      </section>

      {/* VERIFY */}
      <section className="section" id="verify">
        <div className="verify-card">
          <h2>Verify a record</h2>
          <p>Have a Lerne certificate or student record to check?</p>
          <form action="/verify" className="verify-form">
            <input name="q" required placeholder="Enter Lerne ID or certificate code" aria-label="Lerne ID or certificate code" />
            <button className="bg-blue-600 text-white">Verify</button>
          </form>
          <small>Shows verified achievements only. No personal or contact details are displayed.</small>
        </div>
      </section>

      {/* SCHOOL PARTNERSHIP */}
      <section className="section">
        <div className="school-card">
          <div>
            <h2>For schools</h2>
            <p>Give every student a complete, verified portfolio across all Lerne programs, available only through a Lerne partner school.</p>
          </div>
          <a href="https://lerne.co.in/Partners" className="btn-primary">Partner with Lerne →</a>
        </div>
      </section>

      {/* PRIVACY */}
      <section className="section">
        <h2 className="section-title">Your data is safe</h2>
        <p className="section-lead">Accounts go live only after parent consent. Records are private by default, and only the parent can choose to make a profile public. We never ask for Aadhaar numbers.</p>
        <div className="card-grid three">
          <article className="chip"><b>Consent first</b><span>Nothing goes live until a parent agrees.</span></article>
          <article className="chip"><b>Private by default</b><span>Only the parent can make a profile public.</span></article>
          <article className="chip"><b>No Aadhaar</b><span>We never ask for Aadhaar numbers.</span></article>
        </div>
      </section>
    </>
  )
}
