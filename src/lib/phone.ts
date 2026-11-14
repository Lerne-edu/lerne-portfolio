// Indian mobile numbers: keep the last 10 digits and add +91
export function toE164India(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  return digits.length >= 10 ? '+91' + digits.slice(-10) : null
}
