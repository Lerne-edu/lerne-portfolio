import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="state-page">
      <div className="code">404</div>
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist or has moved.</p>
      <Link href="/" className="btn-primary">Go to the home page</Link>
    </main>
  )
}
