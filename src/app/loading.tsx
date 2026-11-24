// Shown in the page area while the next page loads: a small spinner, so the screen is never an empty gap
export default function Loading() {
  return (
    <main role="status" aria-label="Loading" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <style>{`@keyframes lerneSpin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ width: 36, height: 36, border: '3px solid rgba(92,61,46,0.2)', borderTopColor: '#C1622D', borderRadius: '50%', animation: 'lerneSpin 0.8s linear infinite' }} />
    </main>
  )
}