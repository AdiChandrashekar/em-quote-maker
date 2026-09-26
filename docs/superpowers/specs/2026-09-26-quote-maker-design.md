# Education Mirror Quote Maker — Design

**Date:** 2026-09-26
**Owner:** Adi (for Virjesh, Education Mirror)
**Status:** Draft for review

## Purpose

Virjesh types a quote (Hindi, English or mixed), optionally uploads a photo, picks a social-media size and a style, and gets a branded PNG he can post straight away. It must work equally well on his phone and his laptop, and every image must look unmistakably like Education Mirror.

**Success looks like:** Virjesh opens one URL, makes a correct-looking Hindi quote image in under a minute, and shares it to WhatsApp or Instagram from his phone without any other app.

## Decisions (agreed in chat)

| Topic | Decision |
|---|---|
| Hosting | Static page on GitHub Pages: public repo `AdiChandrashekar/em-quote-maker`, served at `https://adichandrashekar.github.io/em-quote-maker/`. This folder is the repo root. |
| Rendering | Plain JavaScript drawing on `<canvas>`. No framework, no build step, no html-to-image library (their Devanagari shaping is unreliable). |
| Devices | Phone and laptop equally. |
| Uploaded image | Used as a full-bleed **background** photo with a navy tint. |
| Styles | Navy, Light, Red (no photo) and Photo (when an image is uploaded). |
| Attribution | Optional name and optional role line. |

## Brand source

Taken from the Education Mirror site project (`C:\Users\adich\Local Sites\educationmirror`, `DESIGN.md`):

- Colours: navy `#0A2159`, red `#D71920`, white `#FFFFFF`, mist `#F5F6FA`, text `#1B2233`, text-2 `#5A6275`, hairline `#E3E6EE`, dark-mode text-2 `#AEB6C8`. **No other hues.**
- Fonts: Mukta 400/700/800 (Devanagari + Latin) for everything; Noto Serif 700 (Latin) for the "Education Mirror" wordmark only.
- Rule (owner requirement): the "Education Mirror" wordmark is always red `#D71920` on a white capsule.
- Signature motif: a red horizontal rule broken by a red centre dot (from the logo).
- Emblem: `app/public/wp-content/themes/education-mirror-journal/assets/img/emblem-512.png` (swirl "e", navy tile, red frame). Copied into this repo.

## The tool page

Branded in light mode only (it is a workspace): mist page, white panels, navy text, Mukta, white capsule header with the emblem and the red wordmark. Tap targets ≥ 44px. No horizontal scroll at 375px.

- **Phone (< 768px):** live preview on top (scaled to screen width), inputs below, a sticky bottom bar with **Share** and **Download**.
- **Laptop (≥ 768px):** inputs in a left column (~380px), large live preview on the right, buttons under the preview.

### Inputs

1. **Quote** — multi-line textarea. Line breaks the user types are kept as hard breaks.
2. **Name** — optional, one line.
3. **Role** — optional, one line.
4. **Size** — segmented choice:

   | Label | Pixels |
   |---|---|
   | Instagram Square | 1080 × 1080 |
   | Instagram Portrait | 1080 × 1350 |
   | Story / Reel / WhatsApp Status | 1080 × 1920 |
   | Facebook / LinkedIn | 1200 × 630 |
   | X / Twitter | 1600 × 900 |

5. **Style** — Navy / Light / Red / Photo. Photo is disabled until an image is uploaded; uploading an image selects Photo automatically. Removing the image returns to the previous plain style.
6. **Photo** — file input (`accept="image/*"`) plus a **Remove** button. Dragging (mouse or touch) on the preview moves the photo's focal point.

The preview re-renders on every input change, at most once per animation frame.

## The image

All geometry scales with `u = min(W, H) / 1080`. All text is centred horizontally.

### Layout, top to bottom

1. **Top padding** `0.09·H` for portrait and square sizes, `0.08·H` for landscape sizes. **Side padding** `0.08·W`. **Story (H/W ≥ 1.7):** top and bottom padding are `0.132·H` (≈253px of 1920) so the quote mark and footer stay clear of the Instagram/WhatsApp top bar and reply box.
2. **Opening quote mark** “ — Noto Serif 700, `180u`, centred, drawn in the style's *mark* colour.
3. **Quote block** — Mukta 700, auto-fitted (see below), in the style's *text* colour.
4. **Divider** — `max(2, 3u)`px line in the style's *rule* colour, width `0.32·W`, with a centre gap holding a dot of radius `8u` in the style's *dot* colour. The gap is 24u on each side of the dot centre. It sits `40u` below the quote block.
5. **Attribution** — `32u` below the divider:
   - **Name:** Mukta 700 at `40u`, *name* colour.
   - **Role:** Mukta 400 at `30u`, *role* colour.
   - If both are empty, the divider is still drawn and no attribution space is reserved.
6. **Footer** — bottom-centred, bottom margin `0.06·H`.
   - A white pill (`#FFFFFF`) of height `88u`.
   - Inside the pill: the emblem at `64u`, a `16u` gap, then "Education Mirror" in Noto Serif 700 at `36u`, colour `#D71920`.
   - Below the pill: `educationmirror.org` in Mukta 400 at `26u`, *footnote* colour.
   - On Light, the pill gets a 2px `#E3E6EE` border.

The quote block, divider and attribution are grouped and centred vertically in the space between the quote mark and the footer.

### Styles

| Style | Background | text | mark | rule / dot | name | role / footnote |
|---|---|---|---|---|---|---|
| Navy | `#0A2159`, with a soft radial lift to `#12307A` behind the quote | `#FFFFFF` | `#D71920` | `#D71920` / `#D71920` | `#FFFFFF` | `#AEB6C8` |
| Light | `#F5F6FA` | `#0A2159` | `#D71920` | `#D71920` / `#D71920` | `#1B2233` | `#5A6275` |
| Red | `#D71920` | `#FFFFFF` | `#0A2159` | `#FFFFFF` / `#0A2159` | `#FFFFFF` | `rgba(255,255,255,0.85)` |
| Photo | Photo, "cover"-fitted at the focal point, then a vertical navy gradient from `rgba(10,33,89,0.55)` at the top to `rgba(10,33,89,0.88)` at the bottom | `#FFFFFF` | `#D71920` | `#D71920` / `#D71920` | `#FFFFFF` | `#E9ECF4` |

`#12307A` is a lighter navy used only for the tonal lift. It is not a new hue.

### Auto-fit

- Font size tries from `maxSize = 96u` down to `minSize = 40u` in steps of `2u`.
- At each size the quote is wrapped to the box width `W − 2·sidePadding`.
- The first size whose wrapped height fits the available box height wins.
- If nothing fits at `minSize`, the image is drawn at `minSize`, the text is clipped with a trailing `…`, and the page shows a warning. The warning reads: "यह कोट इस साइज़ के लिए बहुत लंबा है — छोटा करें या बड़ा साइज़ चुनें / Quote too long for this size — shorten it or pick a taller size". Share and Download still work.
- **Line height:** `1.5 ×` font size when the quote contains Devanagari (U+0900–U+097F), otherwise `1.3 ×`.

### Wrapping rules (Hindi safety)

- Lines break only at whitespace. Words are split with `Intl.Segmenter(undefined, {granularity: 'word'})` where available, with a whitespace split as the fallback. Breaks happen only between segments that follow a space.
- A word is never split inside a grapheme cluster, so conjuncts (क्ष, त्र, श्र) and matras stay intact.
- A single word wider than the line (e.g. a URL) is drawn on its own line, horizontally scaled down to fit the width. It is never broken.
- Hard line breaks typed by the user start a new line. Empty lines are kept, but consecutive empty lines collapse to one.
- Leading and trailing whitespace is trimmed. Internal runs of spaces collapse to one.

### Fonts

- Mukta (Devanagari + Latin subsets, weights 400/700/800) and Noto Serif (Latin, weight 700) are fetched once from Fontsource (SIL OFL 1.1). They're committed as WOFF2 under `assets/fonts/` with the licence file, and declared with `@font-face`.
- Before the first render, the app awaits `document.fonts.load()` for every face/weight it draws with, using a Hindi and a Latin sample string. The preview shows "Loading fonts…" until then.
- If loading fails after 8 seconds, the app renders with the fallback stack and shows a warning, since Hindi may look wrong.

## Saving

- **Rendering:** always at full size on an offscreen canvas of exactly W×H. The on-screen preview is the same canvas, scaled with CSS.
- **Encoding:** `canvas.toBlob(cb, 'image/png')`.
- **Filename:** `education-mirror-quote-YYYYMMDD-HHMM-<W>x<H>.png`, in local time.
- **Share button:** shown only when `navigator.canShare?.({files: [file]})` is true. It calls `navigator.share({files: [file]})`. If the share fails, the app falls back to Download, except when the user cancels (`AbortError`), which is ignored.
- **Download:** uses an object URL with an `<a download>` click, then revokes the URL.
- **Remembered settings:** style (excluding Photo), size, name and role are saved in `localStorage` under the key `em-quote-maker:v1`, inside try/catch. The quote text and the photo are never stored.

## Photo handling

- The file is read with `createImageBitmap(file, {imageOrientation: 'from-image'})` where supported, and `<img>` + object URL otherwise.
- Photos whose longer edge exceeds 2400px are downscaled to 2400px once, on load.
- If the file is not an image or fails to decode, the app shows the error "यह फ़ाइल खुल नहीं पाई / Could not open this file" and keeps the previous state.
- The focal point `(fx, fy)` ∈ [0,1]² defaults to (0.5, 0.5) and resets on each new upload. Drag deltas on the preview are converted to canvas pixels and clamped so the photo always covers the frame.
- The photo never leaves the device.

## Code structure

```
index.html              markup, font preloads, script tags (ES modules)
css/app.css             tool page styling
js/presets.js           SIZES and STYLES tables (data only)
js/layout.js            pure: normaliseQuote, segmentWords, wrapLines, fitQuote, hasDevanagari, coverRect
js/render.js            renderQuote(ctx, state, assets) — draws one image using layout.js + presets.js
js/app.js               DOM wiring, font loading, photo input + drag, preview loop, share/download, localStorage
assets/fonts/*.woff2    Mukta + Noto Serif, OFL.txt
assets/img/emblem.png   copied from the site theme (512px)
assets/img/favicon-32.png
tests/layout.test.mjs   node --test
README.md               what it is, URL, how to run locally, how to deploy
```

### Unit interfaces

- `layout.js`, pure functions with no DOM access:
  - `wrapLines(text, maxWidth, measure)`: `measure(str) => number` is injected. Returns `{ lines: [{text, width, scaleX}], overflowWord: boolean }`.
  - `fitQuote(text, box, measureAt, opts)` returns `{ size, lineHeight, lines, fits }`.
  - `coverRect(imgW, imgH, W, H, fx, fy)` returns the source crop rectangle.
- `render.js` depends only on a 2D context, the state object `{ quote, name, role, sizeKey, styleKey, photo, fx, fy }` and preloaded assets. It returns `{ fits }`.

## Testing

- **Unit (Node 18+ `node --test`, no dependencies)**, with a fake `measure` (fixed width per grapheme):
  - English wrap
  - Hindi wrap (the conjunct क्ष stays whole)
  - mixed Hindi/English
  - a hard line break
  - collapsed blank lines
  - a very long single word (one line, `scaleX < 1`)
  - an empty quote (0 lines, fits)
  - fitQuote picks a smaller size for a longer quote
  - fitQuote reports `fits:false` at `minSize`
  - `coverRect` for portrait-into-landscape and landscape-into-portrait at focal points 0, 0.5 and 1
- **Browser (the in-app browser, local static server):**
  1. Each style × each size renders without errors.
  2. The exported PNG's natural size equals W×H.
  3. Hindi sample "शिक्षा वह शस्त्र है जिससे आप दुनिया बदल सकते हैं।" is visibly shaped correctly (screenshot check).
  4. Mixed Hindi/English and a long quote show the too-long warning on 1200×630.
  5. Photo mode with a tall image in 1600×900 can be dragged.
  6. The page has no horizontal scroll at 375px.
  7. With localStorage blocked the page still works.
- **Live:** after GitHub Pages deploys, open the public URL and export one image.

## Deployment

1. `git init` in this folder and commit.
2. Create the **public** repo `AdiChandrashekar/em-quote-maker` with `gh repo create`, then push `main`.
3. Enable Pages from `main` / root with `gh api`.

Steps 2–3 publish content publicly, so they are confirmed with Adi at that point before running.

## Out of scope

Font picker, free text positioning, custom colours, quote history, multiple quotes per image, video/animated output, dark mode for the tool page, any server or analytics.
