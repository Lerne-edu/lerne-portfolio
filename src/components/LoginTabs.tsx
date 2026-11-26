import Link from 'next/link'

// The four ways to sign in, shown at the top of every sign-in page
export default function LoginTabs({ active }: { active: 'parent' | 'student' | 'school' | 'individual' }) {
  const tabs: [string, string, string][] = [['parent', '/parent-login', 'Parent'], ['student', '/student-login', 'Student'], ['individual', '/individual-login', 'Individual'], ['school', '/login', 'School / Team']]
  return (
    <div className="tabs" style={{ justifyContent: 'center' }}>
      {tabs.map(([k, href, label]) => <Link key={k} href={href} className={`tab ${active === k ? 'active' : ''}`}>{label}</Link>)}
    </div>
  )
}
