import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFile } from 'fs/promises'
import path from 'path'

// Text in Latin, Tamil and Devanagari is drawn with Noto fonts found in src/fonts (see src/fonts/README.txt).
// Without the font files, characters outside Latin print as "?".
const FONT_DIR = path.join(process.cwd(), 'src', 'fonts')
type Script = 'latin' | 'tamil' | 'deva'
const scriptOf = (ch: string): Script => (/[\u0B80-\u0BFF]/.test(ch) ? 'tamil' : /[\u0900-\u097F]/.test(ch) ? 'deva' : 'latin')

export async function newPdf(footer: string) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const tryFont = async (file: string) => {
    try { return await pdf.embedFont(await readFile(path.join(FONT_DIR, file)), { subset: true }) } catch { return null }
  }
  const std = await pdf.embedFont(StandardFonts.Helvetica)
  const stdBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const latin = (await tryFont('NotoSans-Regular.ttf')) ?? std
  const latinBold = (await tryFont('NotoSans-Bold.ttf')) ?? (latin !== std ? latin : stdBold)
  const scripts: Record<'tamil' | 'deva', PDFFont | null> = {
    tamil: await tryFont('NotoSansTamil-Regular.ttf'),
    deva: await tryFont('NotoSansDevanagari-Regular.ttf'),
  }

  const pick = (s: Script, bold: boolean) => (s === 'latin' ? (bold ? latinBold : latin) : scripts[s] ?? (bold ? latinBold : latin))
  const prep = (t: string, f: PDFFont) => (f === std || f === stdBold ? t.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?') : t)
  const split = (text: string) => {
    const out: { text: string; script: Script }[] = []
    let cur: Script = 'latin'
    let buf = ''
    for (const ch of text) {
      const sc = ch === ' ' ? cur : scriptOf(ch)
      if (sc !== cur && buf) { out.push({ text: buf, script: cur }); buf = '' }
      cur = sc
      buf += ch
    }
    if (buf) out.push({ text: buf, script: cur })
    return out
  }
  const measure = (t: unknown, bold: boolean, size: number) =>
    split(String(t ?? '')).reduce((w, r) => { const f = pick(r.script, bold); return w + f.widthOfTextAtSize(prep(r.text, f), size) }, 0)
  const draw = (page: PDFPage, t: unknown, x: number, y: number, size: number, bold = false, color = rgb(0, 0, 0)) => {
    for (const r of split(String(t ?? ''))) {
      const f = pick(r.script, bold)
      const s = prep(r.text, f)
      page.drawText(s, { x, y, size, font: f, color })
      x += f.widthOfTextAtSize(s, size)
    }
  }

  const W = 595, H = 842, M = 50, CW = W - 2 * M
  const grey = rgb(0.4, 0.4, 0.4)
  let page: PDFPage = pdf.addPage([W, H])
  let y = H - M
  // Owl logo at the top right of the first page (skipped if public/logo.png is missing)
  try {
    const logo = await pdf.embedPng(await readFile(path.join(process.cwd(), 'public', 'logo.png')))
    page.drawImage(logo, { x: W - M - 56, y: H - M - 50, width: 56, height: 56 })
  } catch {}

  const ensure = (h: number) => { if (y - h < M + 20) { page = pdf.addPage([W, H]); y = H - M } }
  const wrap = (t: string, bold: boolean, size: number, width: number) => {
    const lines: string[] = []
    let line = ''
    for (const w of String(t ?? '').split(/\s+/)) {
      const next = line ? line + ' ' + w : w
      if (measure(next, bold, size) > width && line) { lines.push(line); line = w } else line = next
    }
    if (line) lines.push(line)
    return lines
  }
  const fit = (t: unknown, bold: boolean, size: number, width: number) => {
    let chars = Array.from(String(t ?? ''))
    if (measure(chars.join(''), bold, size) <= width) return chars.join('')
    while (chars.length > 2 && measure(chars.join('') + '..', bold, size) > width) chars = chars.slice(0, -1)
    return chars.join('') + '..'
  }

  return {
    title(t: string, sub?: string) {
      y -= 22; draw(page, t, M, y, 22, true, rgb(0.36, 0.24, 0.18))
      if (sub) { y -= 18; draw(page, sub, M, y, 11, false, grey) }
      y -= 10
    },
    heading(t: string) {
      ensure(30); y -= 22; draw(page, t, M, y, 13, true); y -= 4
    },
    text(t: string, o: { size?: number; bold?: boolean; indent?: number } = {}) {
      const size = o.size ?? 10
      for (const line of wrap(t, !!o.bold, size, CW - (o.indent ?? 0))) {
        ensure(size + 4); y -= size + 3
        draw(page, line, M + (o.indent ?? 0), y, size, !!o.bold)
      }
      y -= 3
    },
    bars(items: { label: string; value: number }[]) {
      const max = Math.max(1, ...items.map((i) => i.value))
      for (const it of items) {
        ensure(16); y -= 14
        draw(page, fit(it.label, false, 9, 175), M, y, 9)
        const w = (it.value / max) * 250
        if (w > 0) page.drawRectangle({ x: M + 185, y: y - 2, width: w, height: 9, color: rgb(0.757, 0.384, 0.176) })
        draw(page, String(it.value), M + 190 + w, y, 9)
      }
      y -= 4
    },
    table(headers: string[], rows: string[][], widths: number[]) {
      const row = (cells: string[], bold: boolean) => {
        ensure(14); y -= 12
        let x = M
        cells.forEach((c, i) => { draw(page, fit(c, bold, 9, widths[i] - 6), x, y, 9, bold); x += widths[i] })
      }
      row(headers, true)
      page.drawLine({ start: { x: M, y: y - 3 }, end: { x: M + CW, y: y - 3 }, thickness: 0.5, color: grey })
      rows.forEach((r) => row(r, false))
      y -= 6
    },
    async finish() {
      const pages = pdf.getPages()
      pages.forEach((p, i) => draw(p, `${footer}    Page ${i + 1} of ${pages.length}`, M, 25, 8, false, grey))
      return pdf.save()
    },
  }
}

export const pdfResponse = (bytes: Uint8Array, filename: string) =>
  new Response(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` },
  })
