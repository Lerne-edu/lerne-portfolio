import Link from 'next/link'
import LoginTabs from '@/components/LoginTabs'

// The split-screen frame for every sign-in and sign-up page: brand story on the left, the form on the right.
// Compact on purpose: the form fits on one screen. Styles live in src/app/auth.css.
type Props = {
  mode: 'signin' | 'signup'
  role?: 'parent' | 'student' | 'school'
  plain?: boolean // hides the Sign in / Create account switch (for example the change-password page)
  wide?: boolean // two-column form card (used by the long sign-up form)
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function AuthShell({ mode, role, plain, wide, title, subtitle, children }: Props) {
  return (
    <main className="auth">
      <aside className="auth-side">
        <a href="/" className="auth-brand"><img src="/logo.png" alt="" /><span>LERNE</span></a>
        <div className="auth-copy">
          <p className="eyebrow-light">portfolio@lerne</p>
          <h2>{mode === 'signin' ? 'Welcome back.' : 'Start a record that lasts.'}</h2>
          <p className="auth-lead">
            {mode === 'signin'
              ? 'Pick up where you left off: your verified achievements, your strengths, your next steps.'
              : 'From Grade 1 to Grade 12, keep every achievement in one trusted place, checked by Lerne.'}
          </p>
          <ul className="auth-points">
            <li><span>✓</span><div><b>Verified</b> by Lerne before it appears</div></li>
            <li><span>✓</span><div><b>Private</b> by default, with parent consent first</div></li>
            <li><span>✓</span><div><b>Yours</b> for life, even after you leave a school</div></li>
          </ul>
        </div>
        <p className="auth-foot">Need help? connect@lerne.co.in</p>
        <i className="auth-orb o1" /><i className="auth-orb o2" />
      </aside>
      <section className="auth-panel">
        <div className={`auth-box${wide ? ' wide' : ''}`}>
          {!plain && (
            <div className="seg" role="tablist">
              <Link href="/signin" className={mode === 'signin' ? 'on' : ''}>Sign in</Link>
              <Link href="/signup" className={mode === 'signup' ? 'on' : ''}>Create account</Link>
            </div>
          )}
          {!plain && mode === 'signin' && role && <LoginTabs active={role} />}
          <h1>{title}</h1>
          {subtitle && <p className="auth-sub">{subtitle}</p>}
          {children}
        </div>
      </section>
    </main>
  )
}