import Link from 'next/link'

// The three ways to sign in, shown at the top of every sign-in page
export default function LoginTabs({ active }: { active: 'parent' | 'student' | 'school' }) {
  const tabs: [string, string, string][] = [['parent', '/parent-login', 'Parent'], ['student', '/student-login', 'Student'], ['school', '/login', 'School / Team']]
  return (
    <div className="tabs" style={{ justifyContent: 'center' }}>
      {tabs.map(([k, href, label]) => <Link key={k} href={href} className={`tab ${active === k ? 'active' : ''}`}>{label}</Link>)}
    </div>
  )
}
