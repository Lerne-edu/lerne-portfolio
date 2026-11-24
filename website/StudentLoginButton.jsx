// For the main Lerne website (lerne.co.in, React on Vercel).
// 1. Copy this file into the website's components folder.
// 2. Add <StudentLoginButton /> to the navigation component.
// Colours and fonts match the portfolio: deep brown button on the cream page, Inter text.
// Use the Zoho/Vercel address first if portfolio.lerne.co.in is not connected yet.
const PORTAL_URL = 'https://portfolio.lerne.co.in'

export default function StudentLoginButton() {
  return (
    <a
      href={PORTAL_URL}
      style={{ padding: '9px 20px', borderRadius: 8, background: '#5C3D2E', color: '#F0E3CA', textDecoration: 'none', fontWeight: 600, fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}
    >
      Student Login
    </a>
  )
}