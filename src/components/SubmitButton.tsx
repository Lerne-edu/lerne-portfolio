'use client'
import { useFormStatus } from 'react-dom'

// A submit button that reacts at once: it turns brown, shows a short message, and cannot be pressed twice while the page works.
export default function SubmitButton({ children, pendingText = 'Please wait…', className = 'bg-blue-600 text-white' }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className}${pending ? ' is-pending' : ''}`}>
      {pending ? pendingText : children}
    </button>
  )
}
