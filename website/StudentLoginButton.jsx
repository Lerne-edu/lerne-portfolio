// For the main Lerne website (lerne.co.in, React on Vercel).
// 1. Copy this file into the website's components folder.
// 2. Add <StudentLoginButton /> to the navigation component.
// Use the Zoho/Vercel address first if portfolio.lerne.co.in is not connected yet.
const PORTAL_URL = 'https://portfolio.lerne.co.in'

export default function StudentLoginButton() {
  return (
    <a
      href={PORTAL_URL}
      style={{ padding: '8px 16px', borderRadius: 6, background: '#2563eb', color: '#fff', textDecoration: 'none', fontWeight: 600 }}
    >
      Student Login
    </a>
  )
}
