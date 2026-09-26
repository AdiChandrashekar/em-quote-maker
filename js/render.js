// Draws one quote image onto a 2D context sized W×H. All positions come from planLayout().
import { BRAND, STYLES } from './presets.js';
import { coverRect, planLayout } from './layout.js';

export function measureWith(ctx) {
  return (text, cssFont) => {
    ctx.font = cssFont;
    return ctx.measureText(text).width;
  };
}

export function renderQuote(ctx, state, assets) {
  const { width: W, height: H } = ctx.canvas;
  const style = STYLES[state.styleKey] || STYLES.navy;
  const plan = planLayout({ W, H, quote: state.quote, name: state.name, role: state.role }, measureWith(ctx));

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, W, H, style, state);
  ctx.textAlign = 'center';
  drawMark(ctx, plan.mark, style);
  drawQuote(ctx, plan.quote, style);
  drawDivider(ctx, plan.divider, style);
  if (plan.name) drawLine(ctx, plan.name, style.name);
  if (plan.role) drawLine(ctx, plan.role, style.role);
  drawFooter(ctx, plan.footer, style, assets.emblem, plan.u);
  ctx.restore();

  return { fits: plan.quote.fits };
}

function drawBackground(ctx, W, H, style, state) {
  if (style.photo && state.photo) {
    const p = state.photo;
    const r = coverRect(p.width, p.height, W, H, state.fx, state.fy);
    ctx.drawImage(p, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);
    const tint = ctx.createLinearGradient(0, 0, 0, H);
    tint.addColorStop(0, style.overlayTop);
    tint.addColorStop(1, style.overlayBottom);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, W, H);
  if (style.lift) {
    const cy = H * 0.42;
    const glow = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, Math.max(W, H) * 0.7);
    glow.addColorStop(0, style.lift);
    glow.addColorStop(1, style.bg);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawMark(ctx, mark, style) {
  ctx.font = mark.font;
  ctx.fillStyle = style.mark;
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

function drawQuote(ctx, q, style) {
  ctx.font = q.font;
  ctx.fillStyle = style.text;
  ctx.textBaseline = 'middle';
  q.lines.forEach((line, i) => drawScaled(ctx, line.text, q.x, q.top + (i + 0.5) * q.lineHeight, line.scaleX));
}

function drawLine(ctx, line, color) {
  ctx.font = line.font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  drawScaled(ctx, line.text, line.x, line.y, line.scaleX);
}

function drawDivider(ctx, d, style) {
  const t = d.thickness;
  ctx.fillStyle = style.rule;
  ctx.fillRect(d.x - d.halfWidth, d.y - t / 2, d.halfWidth - d.hole, t);
  ctx.fillRect(d.x + d.hole, d.y - t / 2, d.halfWidth - d.hole, t);
  ctx.fillStyle = style.dot;
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

function drawFooter(ctx, f, style, emblem, u) {
  const { pill } = f;
  pillPath(ctx, pill.x, pill.y, pill.w, pill.h);
  ctx.fillStyle = BRAND.white;
  ctx.fill();
  if (style.pillBorder) {
    ctx.lineWidth = Math.max(2, 2 * u);
    ctx.strokeStyle = style.pillBorder;
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
  ctx.fillStyle = style.role;
  ctx.fillText(BRAND.site, f.site.x, f.site.y);
}
