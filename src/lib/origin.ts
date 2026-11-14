// Rejects cross-site POST requests (CSRF). Browsers always send an Origin header on a POST; it must match this site.
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (!origin || !host) return false
  try { return new URL(origin).host === host } catch { return false }
}
