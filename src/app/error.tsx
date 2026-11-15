'use client'

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="state-page">
      <div className="code">Oops</div>
      <h1>Something went wrong</h1>
      <p>Please try again. If it keeps happening, contact the Lerne team at connect@lerne.co.in.</p>
      <button onClick={reset} className="bg-blue-600 text-white">Try again</button>
    </main>
  )
}
