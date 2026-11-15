// A round "Verified by Lerne" stamp. The ring of text turns slowly (see .seal-ring in brand.css).
export default function Seal({ size = 120, uid = 'a', className = '' }: { size?: number; uid?: string; className?: string }) {
  const path = `seal-path-${uid}`
  return (
    <svg className={`seal ${className}`} width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Verified by Lerne">
      <defs><path id={path} d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0" /></defs>
      <circle cx="100" cy="100" r="98" fill="var(--gold)" />
      <g className="seal-ring">
        <text fill="var(--brand)" fontSize="15" fontWeight="700" fontFamily="var(--font-sans)">
          <textPath href={`#${path}`} textLength="498" lengthAdjust="spacing">VERIFIED BY LERNE · VERIFIED BY LERNE · </textPath>
        </text>
      </g>
      <circle cx="100" cy="100" r="50" fill="var(--brand)" />
      <path d="M78 101l16 16 30-32" fill="none" stroke="var(--gold)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
