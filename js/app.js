// Page wiring: inputs → state → preview, photo upload and drag, share and download.
import { SAMPLE, SIZES, STYLES } from './presets.js';
import { dragFocus, exportName, fitWithin } from './layout.js';
import { renderQuote } from './render.js';
import { readSettings, writeSettings } from './settings.js';

const MSG = {
  loading: 'Loading fonts… · फ़ॉन्ट लोड हो रहे हैं…',
  fontFail: 'फ़ॉन्ट लोड नहीं हो पाए — हिंदी सही न दिखे / Fonts did not load — Hindi may look wrong',
  tooLong: 'यह कोट इस साइज़ के लिए बहुत लंबा है — छोटा करें या बड़ा साइज़ चुनें / Quote too long for this size — shorten it or pick a taller size',
  badFile: 'यह फ़ाइल खुल नहीं पाई / Could not open this file',
  saveFail: 'इमेज नहीं बन पाई — फिर कोशिश करें / Could not create the image — try again',
  empty: 'Type a quote to save the image · इमेज सेव करने के लिए कोट लिखें',
};
const PHOTO_MAX_EDGE = 2400;

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const el = {
  quote: $('quote'), name: $('name'), role: $('role'), sizes: $('sizes'), styles: $('styles'),
  photo: $('photo'), removePhoto: $('remove-photo'), status: $('status'), hint: $('drag-hint'),
  share: $('share'), download: $('download'),
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
  sizeKey: saved.sizeKey, styleKey: saved.styleKey, plainStyleKey: saved.styleKey,
  photo: null, fx: 0.5, fy: 0.5,
};
const assets = { emblem: null };
const ui = {
  ready: false, fontFail: false, notice: '', noticeTimer: 0, frame: 0,
  readyFile: null, prepTimer: 0, prepToken: 0, drag: null,
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
  const { fits } = renderQuote(ctx, shown, assets);

  const warnings = [ui.fontFail && MSG.fontFail, ui.notice, !fits && MSG.tooLong].filter(Boolean);
  setStatus(warnings.length ? warnings.join('\n') : empty ? MSG.empty : '', warnings.length > 0);
  el.download.disabled = empty;
  el.share.disabled = empty;

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
  writeSettings(storage, { sizeKey: state.sizeKey, styleKey: state.plainStyleKey, name: state.name, role: state.role });
}

function showNotice(text) {
  ui.notice = text;
  clearTimeout(ui.noticeTimer);
  ui.noticeTimer = setTimeout(() => {
    ui.notice = '';
    schedule();
  }, 6000);
  schedule();
}

function buildChoices(container, group, table, withDims) {
  for (const [key, item] of Object.entries(table)) {
    const label = document.createElement('label');
    label.className = 'choice';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = group;
    input.value = key;
    input.className = 'visually-hidden';
    const text = document.createElement('span');
    text.className = 'choice__text';
    if (!withDims) {
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.dataset.style = key;
      text.append(swatch);
    }
    text.append(item.label);
    if (withDims) {
      const dims = document.createElement('small');
      dims.textContent = `${item.w} × ${item.h}`;
      text.append(dims);
    }
    label.append(input, text);
    container.append(label);
  }
}

function syncControls() {
  for (const r of el.sizes.querySelectorAll('input')) r.checked = r.value === state.sizeKey;
  for (const r of el.styles.querySelectorAll('input')) {
    r.checked = r.value === state.styleKey;
    if (r.value === 'photo') r.disabled = !state.photo;
  }
  const photoMode = state.styleKey === 'photo' && Boolean(state.photo);
  el.removePhoto.hidden = !state.photo;
  el.hint.hidden = !photoMode;
  canvas.classList.toggle('is-draggable', photoMode);
}

function setStyle(key) {
  state.styleKey = key;
  if (key !== 'photo') state.plainStyleKey = key;
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
el.styles.addEventListener('change', (e) => setStyle(e.target.value));

el.photo.addEventListener('change', async () => {
  const file = el.photo.files && el.photo.files[0];
  el.photo.value = ''; // lets the same file be chosen again
  if (!file) return;
  try {
    state.photo = await loadPhoto(file);
    state.fx = 0.5;
    state.fy = 0.5;
    setStyle('photo');
  } catch {
    showNotice(MSG.badFile);
  }
});

el.removePhoto.addEventListener('click', () => {
  state.photo = null;
  setStyle(state.plainStyleKey);
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
    if (!err || err.name !== 'AbortError') downloadFile(file);
  }
});

// Drag on the preview to move the photo.
canvas.addEventListener('pointerdown', (e) => {
  if (state.styleKey !== 'photo' || !state.photo) return;
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

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

buildChoices(el.sizes, 'size', SIZES, true);
buildChoices(el.styles, 'style', STYLES, false);
el.name.value = state.name;
el.role.value = state.role;
el.share.hidden = !canShareFiles();
syncControls();
setStatus(MSG.loading, false);

Promise.all([
  loadFonts().then(() => false, () => true),
  loadImage('assets/img/emblem.png').catch(() => null),
]).then(([fontFail, emblem]) => {
  ui.fontFail = fontFail;
  assets.emblem = emblem;
  ui.ready = true;
  schedule();
});
