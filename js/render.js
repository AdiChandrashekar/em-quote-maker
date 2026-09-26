// Draws one quote image onto a 2D context sized W×H: backdrop, then quote, attribution and footer.
import { BRAND } from './presets.js';
import { keepRects, planLayout, quoteZone } from './layout.js';
import { derivePalette } from './palette.js';
import { BACKDROPS } from './backdrops.js';

export function measureWith(ctx) {
  return (text, cssFont) => {
    ctx.font = cssFont;
    return ctx.measureText(text).width;
  };
}

// state: { quote, name, role, backdropKey, colour, photo, fx, fy }.
// cache (optional): { key, canvas } reused across calls so heavy backdrops are not redrawn on every keystroke.
export function renderQuote(ctx, state, assets, cache = null) {
  const { width: W, height: H } = ctx.canvas;
  const plan = planLayout({ W, H, quote: state.quote, name: state.name, role: state.role }, measureWith(ctx));
  const p = derivePalette(state.colour);
  const key = Object.prototype.hasOwnProperty.call(BACKDROPS, state.backdropKey) ? state.backdropKey : 'plain';
  const env = {
    p, u: plan.u, plan, zone: quoteZone(plan), keep: keepRects(plan),
    photo: state.photo, fx: state.fx ?? 0.5, fy: state.fy ?? 0.5,
  };

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  drawBackdrop(ctx, W, H, key, env, cache);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  drawMark(ctx, plan.mark, p);
  drawQuote(ctx, plan.quote, p);
  drawDivider(ctx, plan.divider, p);
  if (plan.name) drawLine(ctx, plan.name, p.name);
  if (plan.role) drawLine(ctx, plan.role, p.role);
  drawFooter(ctx, plan.footer, p, assets.emblem, plan.u);
  ctx.restore();

  return { fits: plan.quote.fits };
}

const photoIds = new WeakMap();
let nextPhotoId = 1;
function photoId(photo) {
  if (!photo) return 0;
  if (!photoIds.has(photo)) photoIds.set(photo, nextPhotoId++);
  return photoIds.get(photo);
}

function drawBackdrop(ctx, W, H, key, env, cache) {
  const backdrop = BACKDROPS[key];
  if (!cache) {
    ctx.save();
    backdrop.draw(ctx, W, H, env);
    ctx.restore();
    return;
  }
  const z = env.zone;
  const id = [
    key, env.p.base, W, H,
    backdrop.usesZone ? [z.x, z.y, z.w, z.h, env.plan.quote.size].map((v) => Math.round(v)).join(',') : '',
    key === 'photo' ? `${photoId(env.photo)}:${env.fx.toFixed(4)}:${env.fy.toFixed(4)}` : '',
  ].join('|');
  if (cache.key !== id || !cache.canvas) {
    cache.canvas = cache.canvas || document.createElement('canvas');
    cache.canvas.width = W;
    cache.canvas.height = H;
    backdrop.draw(cache.canvas.getContext('2d', { willReadFrequently: true }), W, H, env);
    cache.key = id;
  }
  ctx.drawImage(cache.canvas, 0, 0);
}

function drawMark(ctx, mark, p) {
  ctx.font = mark.font;
  ctx.fillStyle = p.mark;
  ctx.textBaseline = 'alphabetic';
  // Put the top of the glyph (not the em box) at mark.y.
  const ascent = ctx.measureText('“').actualBoundingBoxAscent;
  ctx.fillText('“', mark.x, mark.y + ascent);
}

function drawScaled(ctx, text, x, y, scaleX) {
  if (scaleX >= 1) {
    ctx.fillText(text, x, y);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scaleX, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawQuote(ctx, q, p) {
  ctx.font = q.font;
  ctx.fillStyle = p.text;
  ctx.textBaseline = 'middle';
  q.lines.forEach((line, i) => drawScaled(ctx, line.text, q.x, q.top + (i + 0.5) * q.lineHeight, line.scaleX));
}

function drawLine(ctx, line, colour) {
  ctx.font = line.font;
  ctx.fillStyle = colour;
  ctx.textBaseline = 'middle';
  drawScaled(ctx, line.text, line.x, line.y, line.scaleX);
}

function drawDivider(ctx, d, p) {
  const t = d.thickness;
  ctx.fillStyle = p.rule;
  ctx.fillRect(d.x - d.halfWidth, d.y - t / 2, d.halfWidth - d.hole, t);
  ctx.fillRect(d.x + d.hole, d.y - t / 2, d.halfWidth - d.hole, t);
  ctx.fillStyle = p.dot;
  ctx.beginPath();
  ctx.arc(d.x, d.y, d.dotR, 0, Math.PI * 2);
  ctx.fill();
}

function pillPath(ctx, x, y, w, h) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
}

function drawFooter(ctx, f, p, emblem, u) {
  const { pill } = f;
  pillPath(ctx, pill.x, pill.y, pill.w, pill.h);
  ctx.fillStyle = BRAND.white;
  ctx.fill();
  if (p.pillBorder) {
    ctx.lineWidth = Math.max(2, 2 * u);
    ctx.strokeStyle = p.pillBorder;
    ctx.stroke();
  }
  if (emblem) ctx.drawImage(emblem, f.emblem.x, f.emblem.y, f.emblem.size, f.emblem.size);

  ctx.font = f.wordmark.font;
  ctx.fillStyle = BRAND.red;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(BRAND.wordmark, f.wordmark.x, f.wordmark.y);

  ctx.textAlign = 'center';
  ctx.font = f.site.font;
  ctx.fillStyle = p.text;
  ctx.fillText(BRAND.site, f.site.x, f.site.y);
}
