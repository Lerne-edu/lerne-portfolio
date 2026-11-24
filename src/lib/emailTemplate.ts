// Lerne email layout: cream page, white card, brown button, Marcellus headings and Figtree text (same as lerne.co.in; Georgia and Arial are the fallbacks for mail apps that block web fonts). Inline styles only, because mail apps drop <style> rules.
const C = { bg: '#F0E3CA', card: '#FFFFFF', ink: '#2E1B12', ink2: '#4A3326', muted: '#7A6552', brand: '#5C3D2E', accent: '#C1622D', gold: '#D9A441', line: '#E4D2AC' }
const SERIF = "Marcellus, Georgia, 'Times New Roman', serif"
const SANS = "Figtree, 'Segoe UI', Arial, Helvetica, sans-serif"

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function emailHtml(opts: { title: string; body: string; button?: { label: string; url: string }; site?: string }) {
  const site = (opts.site ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://portfolio.lerne.co.in').replace(/\/$/, '')
  const paras = opts.body.split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.65;color:${C.ink2};">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
  const button = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;"><tr><td style="background:${C.brand};border-radius:8px;">
         <a href="${esc(opts.button.url)}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:600;color:${C.bg};text-decoration:none;">${esc(opts.button.label)}</a>
       </td></tr></table>`
    : ''
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Marcellus&display=swap" rel="stylesheet">
<title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
    <tr><td align="center" style="padding-bottom:20px;">
      <a href="${site}" style="text-decoration:none;"><img src="${site}/logo-email.png" width="96" height="96" alt="Lerne" style="display:block;border:0;"></a>
    </td></tr>
    <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:8px;padding:36px 32px;">
      <h1 style="margin:0 0 18px;font-family:${SERIF};font-size:28px;line-height:1.2;font-weight:400;color:${C.brand};">${esc(opts.title)}</h1>
      ${paras}${button}
    </td></tr>
    <tr><td style="background:${C.brand};height:6px;border-radius:0 0 8px 8px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td align="center" style="padding:20px 8px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted};">
      Lerne &middot; a verified record of every student&rsquo;s achievements<br>
      <a href="mailto:connect@lerne.co.in" style="color:${C.accent};text-decoration:none;">connect@lerne.co.in</a> &middot; +91-8667666311
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
}