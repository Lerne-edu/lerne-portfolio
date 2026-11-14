// Checks what a file really is by its first bytes, not by the name or type the browser claims.
export type FileKind = 'pdf' | 'png' | 'jpg'
export const MIME: Record<FileKind, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg' }

export async function sniffKind(file: File): Promise<FileKind | null> {
  const b = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  return null
}
