// Page wiring: inputs → state → preview, photo upload and drag, share and download.
import { SAMPLE, SIZES, SWATCHES } from './presets.js';
import { BACKDROPS } from './backdrops.js';
import { dragFocus, exportName, fitWithin } from './layout.js';
import { renderQuote } from './render.js';
import { readSettings, writeSettings } from './settings.js';

const MSG = {
  loading: 'Loading fonts… · फ़ॉन्ट लोड हो रहे हैं…',
  fontFail: 'फ़ॉन्ट लोड नहीं हो पाए — हिंदी सही न दिखे / Fonts did not load — Hindi may look wrong',
  tooLong: 'यह कोट इस साइज़ के लिए बहुत लंबा है — छोटा करें या बड़ा साइज़ चुनें / Quote too long for this size — shorten it or pick a taller size',
  badFile: 'यह फ़ाइल खुल नहीं पाई / Could not open this file',
  saveFail: 'इमेज नहीं बन पाई — फिर कोशिश करें / Could not create the image — try again',
  shareAgain: 'फिर से शेयर दबाएँ / Tap Share again',
  copied: 'इमेज कॉपी हो गई — पेस्ट करें (Ctrl+V / ⌘V) / Image copied — paste it (Ctrl+V / ⌘V)',
  copyFail: 'कॉपी नहीं हो पाई — इमेज डाउनलोड कर दी गई है, उसे अटैच करें / Could not copy — the image was downloaded instead, attach it',
  instagram: 'इमेज डाउनलोड हो गई — Instagram में Create (+) दबाकर चुनें / Image downloaded — in Instagram click Create (+) and choose it',
  empty: 'Type a quote to save the image · इमेज सेव करने के लिए कोट लिखें',
};
const PHOTO_MAX_EDGE = 2400;

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const el = {
  quote: $('quote'), name: $('name'), role: $('role'), sizes: $('sizes'),
  backdrops: $('backdrops'), swatches: $('swatches'), custom: $('custom-colour'), customChoice: $('custom-choice'),
  photo: $('photo'), removePhoto: $('remove-photo'), status: $('status'), hint: $('drag-hint'),
  share: $('share'), download: $('download'), copy: $('copy-image'), print: $('print'),
  dests: [...document.querySelectorAll('[data-dest]')], printImage: $('print-image'),
};

// Laptop shortcuts: the image is copied, then the site's post box opens for pasting.
// Instagram's website cannot take a pasted image, so it gets a download instead.
const DESTINATIONS = {
  whatsapp: { label: 'WhatsApp', url: 'https://web.whatsapp.com/', how: 'paste' },
  facebook: { label: 'Facebook', url: 'https://www.facebook.com/', how: 'paste' },
  linkedin: { label: 'LinkedIn', url: 'https://www.linkedin.com/feed/?shareActive=true', how: 'paste' },
  x: { label: 'X', url: 'https://x.com/compose/post', how: 'paste' },
  instagram: { label: 'Instagram', url: 'https://www.instagram.com/', how: 'upload' },
};

const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})() || { getItem: () => null, setItem() {} };

const saved = readSettings(storage);
const state = {
  quote: '', name: saved.name, role: saved.role,
  sizeKey: saved.sizeKey,
  backdropKey: saved.backdropKey, colour: saved.colour,
  // What to return to when the photo is removed.
  plainBackdropKey: saved.backdropKey, plainColour: saved.colour,
  photo: null, fx: 0.5, fy: 0.5,
};
const assets = { logo: null };
const ui = {
  ready: false, fontFail: false, notice: '', noticeTimer: 0, frame: 0,
  readyFile: null, prepTimer: 0, prepToken: 0, drag: null,
  backdropCache: { key: '', canvas: null },
};

// ---------- rendering ----------

function schedule() {
  if (!ui.frame) ui.frame = requestAnimationFrame(draw);
}

function setStatus(text, warn) {
  if (el.status.textContent !== text) el.status.textContent = text;
  el.status.classList.toggle('is-warning', warn);
}

function draw() {
  ui.frame = 0;
  if (!ui.ready) return;
  const { w, h } = SIZES[state.sizeKey];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const empty = state.quote.trim() === '';
  const shown = empty
    ? { ...state, quote: SAMPLE.quote, name: state.name || state.role ? state.name : SAMPLE.name }
    : state;
  const { fits } = renderQuote(ctx, shown, assets, ui.backdropCache);

  const warnings = [ui.fontFail && MSG.fontFail, ui.notice, !fits && MSG.tooLong].filter(Boolean);
  setStatus(warnings.length ? warnings.join('\n') : empty ? MSG.empty : '', warnings.length > 0);
  for (const b of [el.download, el.share, el.copy, el.print, ...el.dests]) b.disabled = empty;

  // Prepare the PNG ahead of time so Share can call navigator.share inside the tap (iOS Safari).
  ui.readyFile = null;
  ui.prepToken += 1;
  clearTimeout(ui.prepTimer);
  if (!empty) ui.prepTimer = setTimeout(prepareFile, 250);
}

// ---------- export ----------

function canvasFile() {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG export failed'));
        return;
      }
      resolve(new File([blob], exportName(new Date(), canvas.width, canvas.height), { type: 'image/png' }));
    }, 'image/png');
  });
}

function prepareFile() {
  const token = ui.prepToken;
  canvasFile().then((file) => {
    if (token === ui.prepToken) ui.readyFile = file;
  }, () => {});
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canShareFiles() {
  try {
    const probe = new File([new Blob(['x'])], 'x.png', { type: 'image/png' });
    return Boolean(navigator.canShare && navigator.canShare({ files: [probe] }));
  } catch {
    return false;
  }
}

// ---------- photo ----------

async function loadPhoto(file) {
  if (file.type && !file.type.startsWith('image/')) throw new Error('not an image');
  let source = null;
  let url = '';
  try {
    if ('createImageBitmap' in window) {
      try {
        source = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        source = null;
      }
    }
    if (!source) {
      url = URL.createObjectURL(file);
      source = new Image();
      source.src = url;
      await source.decode();
    }
    const w0 = source.naturalWidth || source.width;
    const h0 = source.naturalHeight || source.height;
    if (!w0 || !h0) throw new Error('empty image');
    const { w, h } = fitWithin(w0, h0, PHOTO_MAX_EDGE);
    const photo = document.createElement('canvas');
    photo.width = w;
    photo.height = h;
    photo.getContext('2d').drawImage(source, 0, 0, w, h);
    return photo;
  } finally {
    if (source && typeof source.close === 'function') source.close();
    if (url) URL.revokeObjectURL(url);
  }
}

// ---------- controls ----------

function persist() {
  const inPhoto = state.backdropKey === 'photo';
  writeSettings(storage, {
    sizeKey: state.sizeKey,
    backdropKey: state.plainBackdropKey,
    colour: inPhoto ? state.plainColour : state.colour,
    name: state.name,
    role: state.role,
  });
}

function showNotice(text, ms = 6000) {
  ui.notice = text;
  clearTimeout(ui.noticeTimer);
  ui.noticeTimer = setTimeout(() => {
    ui.notice = '';
    schedule();
  }, ms);
  schedule();
}

function buildSizes(container, table) {
  for (const [key, item] of Object.entries(table)) {
    const label = document.createElement('label');
    label.className = 'choice';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'size';
    input.value = key;
    input.className = 'visually-hidden';
    const text = document.createElement('span');
    text.className = 'choice__text';
    const dims = document.createElement('small');
    dims.textContent = `${item.w} × ${item.h}`;
    text.append(item.label, dims);
    label.append(input, text);
    container.append(label);
  }
}

const THUMB = { w: 160, h: 200 };

function buildBackdrops() {
  for (const [key, b] of Object.entries(BACKDROPS)) {
    const label = document.createElement('label');
    label.className = 'backdrop';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'backdrop';
    input.value = key;
    input.className = 'visually-hidden';
    const tile = document.createElement('span');
    tile.className = 'backdrop__tile';
    const thumb = document.createElement('canvas');
    thumb.width = THUMB.w;
    thumb.height = THUMB.h;
    thumb.dataset.backdrop = key;
    const name = document.createElement('span');
    name.className = 'backdrop__name';
    name.textContent = b.label;
    tile.append(thumb, name);
    label.append(input, tile);
    el.backdrops.append(label);
  }
}

// Thumbnails show each backdrop in its natural colour: what a tap will give.
function drawThumbnail(key) {
  const thumb = el.backdrops.querySelector(`canvas[data-backdrop="${key}"]`);
  if (!thumb) return;
  renderQuote(thumb.getContext('2d'), {
    quote: SAMPLE.quote, name: '', role: '', backdropKey: key, colour: BACKDROPS[key].natural,
    photo: key === 'photo' ? state.photo : null, fx: 0.5, fy: 0.5,
  }, assets);
}

function buildSwatches() {
  for (const sw of SWATCHES) {
    const label = document.createElement('label');
    label.className = 'swatch-choice';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'colour';
    input.value = sw.hex;
    input.className = 'visually-hidden';
    const dotEl = document.createElement('span');
    dotEl.className = 'swatch-dot';
    dotEl.style.background = sw.hex;
    label.append(input, dotEl, sw.label);
    el.swatches.insertBefore(label, el.customChoice);
  }
}

function syncControls() {
  for (const r of el.sizes.querySelectorAll('input')) r.checked = r.value === state.sizeKey;
  for (const r of el.backdrops.querySelectorAll('input')) {
    r.checked = r.value === state.backdropKey;
    if (r.value === 'photo') r.disabled = !state.photo;
  }
  const colour = state.colour.toUpperCase();
  let brand = false;
  for (const r of el.swatches.querySelectorAll('input[name="colour"]')) {
    r.checked = r.value.toUpperCase() === colour;
    brand = brand || r.checked;
  }
  el.customChoice.classList.toggle('is-active', !brand);
  if (el.custom.value.toUpperCase() !== colour) el.custom.value = colour.toLowerCase();
  const photoMode = state.backdropKey === 'photo' && Boolean(state.photo);
  el.removePhoto.hidden = !state.photo;
  el.hint.hidden = !photoMode;
  canvas.classList.toggle('is-draggable', photoMode);
}

// Choosing a backdrop jumps to its natural colour; the colour row can change it afterwards.
function setBackdrop(key) {
  if (key === 'photo' && state.backdropKey !== 'photo') state.plainColour = state.colour;
  state.backdropKey = key;
  state.colour = BACKDROPS[key].natural;
  if (key !== 'photo') {
    state.plainBackdropKey = key;
    state.plainColour = state.colour;
  }
  persist();
  syncControls();
  schedule();
}

function setColour(hex) {
  state.colour = hex.toUpperCase();
  if (state.backdropKey !== 'photo') state.plainColour = state.colour;
  persist();
  syncControls();
  schedule();
}

el.quote.addEventListener('input', () => {
  state.quote = el.quote.value;
  schedule();
});
el.name.addEventListener('input', () => {
  state.name = el.name.value;
  persist();
  schedule();
});
el.role.addEventListener('input', () => {
  state.role = el.role.value;
  persist();
  schedule();
});
el.sizes.addEventListener('change', (e) => {
  state.sizeKey = e.target.value;
  persist();
  schedule();
});
el.backdrops.addEventListener('change', (e) => setBackdrop(e.target.value));
el.swatches.addEventListener('change', (e) => {
  if (e.target.name === 'colour') setColour(e.target.value);
});
el.custom.addEventListener('input', () => setColour(el.custom.value));

el.photo.addEventListener('change', async () => {
  const file = el.photo.files && el.photo.files[0];
  el.photo.value = ''; // lets the same file be chosen again
  if (!file) return;
  try {
    state.photo = await loadPhoto(file);
    state.fx = 0.5;
    state.fy = 0.5;
    drawThumbnail('photo');
    setBackdrop('photo');
  } catch {
    showNotice(MSG.badFile);
  }
});

el.removePhoto.addEventListener('click', () => {
  state.photo = null;
  drawThumbnail('photo');
  state.backdropKey = state.plainBackdropKey;
  state.colour = state.plainColour;
  persist();
  syncControls();
  schedule();
});

el.download.addEventListener('click', async () => {
  try {
    downloadFile(ui.readyFile || (await canvasFile()));
  } catch {
    showNotice(MSG.saveFail);
  }
});

el.share.addEventListener('click', async () => {
  let file;
  try {
    // With a prepared file there is no await before navigator.share, so the tap still counts.
    file = ui.readyFile || (await canvasFile());
  } catch {
    showNotice(MSG.saveFail);
    return;
  }
  try {
    await navigator.share({ files: [file] });
  } catch (err) {
    const name = err && err.name;
    if (name === 'AbortError') return;
    // iOS drops the tap if the PNG had to be made first; the redraw re-prepares it, so a second tap works.
    if (name === 'NotAllowedError') {
      showNotice(MSG.shareAgain);
      return;
    }
    downloadFile(file);
  }
});

// Clipboard write starts inside the click (a pending blob is allowed), so it keeps the user gesture.
function copyImage() {
  if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') {
    return Promise.reject(new Error('clipboard unavailable'));
  }
  const png = ui.readyFile || canvasFile();
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

function downloadInstead() {
  const file = ui.readyFile;
  return (file ? Promise.resolve(file) : canvasFile()).then(downloadFile);
}

el.copy.addEventListener('click', () => {
  copyImage().then(() => showNotice(MSG.copied, 8000), () => downloadInstead().then(() => showNotice(MSG.copyFail, 10000)));
});

for (const button of el.dests) {
  button.addEventListener('click', () => {
    const dest = DESTINATIONS[button.dataset.dest];
    if (dest.how === 'upload') {
      downloadInstead().then(() => showNotice(MSG.instagram, 12000), () => showNotice(MSG.saveFail));
      window.open(dest.url, '_blank', 'noopener');
      return;
    }
    const copied = copyImage();
    window.open(dest.url, '_blank', 'noopener'); // must open inside the click or it is blocked as a pop-up
    copied.then(
      () => showNotice(`${dest.label}: ${MSG.copied}`, 12000),
      () => downloadInstead().then(() => showNotice(`${dest.label}: ${MSG.copyFail}`, 12000)),
    );
  });
}

el.print.addEventListener('click', () => {
  const img = el.printImage;
  img.onload = () => {
    img.onload = null;
    window.print();
  };
  img.removeAttribute('src');
  img.src = canvas.toDataURL('image/png');
});

// Drag on the preview to move the photo.
canvas.addEventListener('pointerdown', (e) => {
  if (state.backdropKey !== 'photo' || !state.photo) return;
  ui.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // Synthetic or already-released pointers cannot be captured; dragging still works.
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!ui.drag || e.pointerId !== ui.drag.id || !state.photo) return;
  const k = canvas.width / canvas.getBoundingClientRect().width;
  const next = dragFocus(
    state.fx, state.fy, (e.clientX - ui.drag.x) * k, (e.clientY - ui.drag.y) * k,
    state.photo.width, state.photo.height, canvas.width, canvas.height,
  );
  state.fx = next.fx;
  state.fy = next.fy;
  ui.drag.x = e.clientX;
  ui.drag.y = e.clientY;
  schedule();
});
const endDrag = (e) => {
  if (ui.drag && e.pointerId === ui.drag.id) ui.drag = null;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---------- boot ----------

function loadFonts() {
  const faces = ['400 40px Mukta', '700 40px Mukta', '700 40px "Noto Serif"'];
  const jobs = faces.flatMap((f) => [document.fonts.load(f, 'शिक्षा'), document.fonts.load(f, 'Education “')]);
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('font timeout')), 8000));
  return Promise.race([Promise.all(jobs), timeout]);
}

// onload rather than decode(): Chromium defers decode() while the tab is in the background.
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

buildSizes(el.sizes, SIZES);
buildBackdrops();
buildSwatches();
el.name.value = state.name;
el.role.value = state.role;
el.share.hidden = !canShareFiles();
document.body.classList.toggle('has-native-share', !el.share.hidden);
syncControls();
setStatus(MSG.loading, false);

Promise.all([
  loadFonts().then(() => false, () => true),
  loadImage('assets/img/logo.png').catch(() => null),
]).then(([fontFail, logo]) => {
  ui.fontFail = fontFail;
  assets.logo = logo;
  ui.ready = true;
  for (const key of Object.keys(BACKDROPS)) drawThumbnail(key);
  schedule();
});
