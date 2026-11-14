'use client'

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto mt-24 max-w-md p-6 text-center">
      <h1 className="mb-2 text-xl font-semibold">Something went wrong</h1>
      <p className="mb-4 text-sm text-gray-600">Please try again. If it keeps happening, contact the Lerne team.</p>
      <button onClick={reset} className="rounded bg-blue-600 px-4 py-2 text-white">Try again</button>
    </main>
  )
}
