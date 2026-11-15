# Design notes

**After copying this version, run `npm install` once** (it adds two self-hosted font packages), then `npm run dev`.

## The look
- Flat and solid: no gradients, blur or shadows. Only the Lerne palette, set once at the top of `src/app/brand.css` (`:root`):
  cream `#F0E3CA`, deep brown `#5C3D2E`, terracotta `#C1622D`, green `#8A9B6E`, gold `#D9A441`, tan `#E4D2AC`, text `#2E1B12`.
- Playfair Display for headings, Inter for text, both installed with the app (nothing loads from Google).
- Interest comes from composition, type and motion, not from boxes: flat colour shapes, a turning "Verified by Lerne" seal, a scrolling ticker, big numbers, and lines that draw in.

## Motion (all plain CSS, no extra JavaScript)
- Home page headline: words rise into place. The three achievement tickets slide in, and two of them switch from "Pending" to "Verified" one after the other.
- The seal turns slowly; the ticker of categories scrolls and pauses when the mouse is over it.
- On scroll: sections fade up, the numbers (12 / 14 / 100%) count up, and the lines above the steps and privacy items draw across.
  These scroll effects work in current Chrome, Edge and Safari 26; in other browsers the final state is simply shown.
- Hover: audience rows fill brown, buttons fill with colour and the arrow moves, the nav links underline.
- The sign-in pages carry the seal; the header's small "portfolio@lerne" line fades away as you scroll.
- People who set "reduce motion" on their device see none of it, only the finished layout.
- To change copy or speed: `src/app/page.tsx` (ticker words are the `TICKER` list) and the keyframes in `src/app/brand.css`.

## No loading screen
- `src/app/loading.tsx` (the white "Loading..." box) is deleted, and links use Next.js `Link`, so pages change without a browser reload.
- A slim terracotta line runs across the top while a page is fetched (`src/components/NavProgress.tsx`).
  To remove it, delete `<NavProgress />` and its import in `src/app/layout.tsx`.

## Files
- `src/app/brand.css`: the design system. `src/app/auth.css`: compact sign-in and sign-up pages. `src/components/Seal.tsx`: the stamp.
- All mentions of Aadhaar were removed from the pages, the privacy policy and the notes.
