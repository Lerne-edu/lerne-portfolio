import QRCode from 'qrcode'

// PNG QR code that opens the "Verified by Lerne" page for one record
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Bad id', { status: 400 })
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
  const png = await QRCode.toBuffer(`${site}/verify/${id}`, { width: 300, margin: 1 })
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } })
}
