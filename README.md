# Education Mirror Quote Maker

Make branded Education Mirror quote images in Hindi and English, sized for social media.

**Use it:** https://adichandrashekar.github.io/em-quote-maker/

1. Type the quote (Hindi, English or both). Add a name and role if you like.
2. Pick a size (Instagram, Story/WhatsApp Status, Facebook/LinkedIn, X) and a backdrop: Plain or one of 16 patterns (Kolam, Jaali, Block print, Warli, Truck art, Swiss, De Stijl, Op Art, Halftone, Letterpress, Notebook, Blueprint, Aurora, Grainy, Memphis, Brutal).
3. Pick a colour: the brand swatches, or Custom for any colour. Text and accents adjust automatically so the quote stays readable.
4. Optional: choose a photo for the background (the colour becomes its tint) and drag the preview to position it.
5. Tap **Share** (phone) or **Download PNG**.

Everything happens in your browser; quotes and photos are never uploaded.

## Develop

No build step. Serve the folder and open it:

```bash
python -m http.server 8765
```

Run the unit tests (Node 21+):

```bash
npm test
```

- Brand swatches and sizes: `js/presets.js`
- Backdrops: `js/backdrops.js` · colour rules: `js/palette.js`
- Layout constants: `LAYOUT` in `js/layout.js`
- Design spec: `docs/superpowers/specs/2026-09-26-quote-maker-design.md`

Fonts: Mukta and Noto Serif, SIL Open Font License 1.1 (see `assets/fonts/OFL-*.txt`).
