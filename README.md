# Education Mirror Quote Maker

Make branded Education Mirror quote images in Hindi and English, sized for social media.

**Use it:** https://adichandrashekar.github.io/em-quote-maker/

1. Type the quote (Hindi, English or both). Add a name and role if you like.
2. Pick a size (Instagram, Story/WhatsApp Status, Facebook/LinkedIn, X) and a style.
3. Optional: choose a photo for the background and drag the preview to position it.
4. Tap **Share** (phone) or **Download PNG**.

Everything happens in your browser; quotes and photos are never uploaded.

## Develop

No build step. Serve the folder and open it:

```bash
python -m http.server 8765
```

Run the unit tests (Node 18+):

```bash
npm test
```

- Brand colours and sizes: `js/presets.js`
- Layout constants: `LAYOUT` in `js/layout.js`
- Design spec: `docs/superpowers/specs/2026-09-26-quote-maker-design.md`

Fonts: Mukta and Noto Serif, SIL Open Font License 1.1 (see `assets/fonts/OFL-*.txt`).
