import { cookies } from 'next/headers'

// Shows a short message at the top of the next page: "Saved", or what went wrong.
// Call it from a server action, then redirect or revalidate as usual.
export async function flash(message: string, kind: 'ok' | 'error' = 'ok') {
  ;(await cookies()).set('flash', encodeURIComponent(JSON.stringify({ message, kind })), { path: '/', maxAge: 30 })
}
