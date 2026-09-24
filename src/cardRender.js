// Composites one 2026-27 credential card.
//
// Every coordinate below is in the template PNG's own pixel space (638x1013)
// and was measured off the artwork and off the finished reference card, not
// chosen by eye. A transform maps that space onto the printed canvas, so the
// numbers here can be checked against the template in any image editor.
//
// Printing. The Magicard driver's CR80 page is 2.14 x 3.38in, marginally larger
// than a physical card, and a test print at 642x1014 came back exactly 1:1 with
// the artwork reaching all four edges. That is why the canvas is 642x1014 and
// not the nominal 637.5x1012.5.
//
// Safe margin. A printed test card carrying five 0.02in colour bands lost, at
// worst, the outer 0.04in on the left and about 0.02in on the right, with the
// top and bottom losing almost nothing. SAFE is set to 0.05in, which clears the
// worst side. Background artwork still runs full bleed — that is wanted, it is
// what stops a white line appearing along an edge — but nothing that has to be
// read may sit inside SAFE.

export const TPL_W = 638;
export const TPL_H = 1013;

// 2.14 x 3.38in at 300dpi: the driver's page, proven 1:1 on a real card.
export const CARD_W = 642;
export const CARD_H = 1014;

/** 0.05in keep-out, measured on a printed card rather than assumed. */
export const SAFE = 15;

export const TEMPLATE_URL = "/card-template.png";

// The template is transparent exactly here — one solid rectangle, 366x346 — so
// the photo is drawn first and the template laid over it. The window's black
// border belongs to the artwork and frames the photo for free.
export const HOLE = { x: 136, y: 570, w: 366, h: 346 };

// The reference card sets its program line across x 51..583. This box is a
// little wider and still leaves 41px to each edge, far outside SAFE.
const TEXT_BOX_W = 560;

// The chevron's last red pixel is at y=452, and the reference card starts its
// program text at y=454. Text begins there and grows downward.
const PROGRAM_TOP = 454;
const PROGRAM_MAX_H = 58;   // two lines at 28px, clearing the photo border at 557
const PROGRAM_MAX_SIZE = 46;
const PROGRAM_MIN_ONE_LINE = 32;
const PROGRAM_TWO_LINE_MAX = 28;
const PROGRAM_MIN_SIZE = 18;

const NAME_GAP = 6;
const NAME_SIZE = 34;       // reference cap height is 24px, which implies ~34px

// The template has EXPIRES: 01/09/2027 baked in. Every row from y=940 to the
// bottom edge is pure white apart from that text, full width, so painting the
// band white erases it invisibly and the real date can be drawn on top. That is
// why no second template file is needed.
const EXPIRY_BAND_TOP = 940;
const EXPIRY_TOP = 950;
const EXPIRY_SIZE = 48;
const EXPIRY_COLOR = "#cb2026";   // sampled from the artwork, 3189 pixels of it

const TEXT_COLOR = "#000000";

const boldFont = (px) =>
  `700 ${px}px "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;

/**
 * The season a date falls in ends on 1 September, so a card issued in
 * September 2026 expires 01/09/2027.
 */
export function seasonEndYear(on = new Date()) {
  return on.getMonth() >= 8 ? on.getFullYear() + 1 : on.getFullYear();
}

export function expiryText(year) {
  return `EXPIRES: 01/09/${year}`;
}

/** Greedy word wrap against the current ctx.font. */
function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    // A single word wider than the box still gets its own line and overflows;
    // the caller shrinks the size until that stops happening.
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Picks the largest size the program name can be set at.
 *
 * One line is always preferred: of the 250 programs on file, 90% fit on one
 * line by 34px and 97% by 30px. The rest — mostly long French school names and
 * "Michael Power St. Joseph High School Varsity Cheer Team", the widest at
 * 1309px — need two lines, and two lines at 28px hold every one of them.
 */
export function fitProgram(ctx, text) {
  const t = String(text || "").trim();
  if (!t) return { size: PROGRAM_MAX_SIZE, lines: [] };

  for (let size = PROGRAM_MAX_SIZE; size >= PROGRAM_MIN_ONE_LINE; size -= 2) {
    ctx.font = boldFont(size);
    if (ctx.measureText(t).width <= TEXT_BOX_W) return { size, lines: [t] };
  }
  for (let size = PROGRAM_TWO_LINE_MAX; size >= PROGRAM_MIN_SIZE; size -= 1) {
    if (size * 2 > PROGRAM_MAX_H) continue;
    ctx.font = boldFont(size);
    const lines = wrap(ctx, t, TEXT_BOX_W);
    if (lines.length <= 2) return { size, lines };
  }
  ctx.font = boldFont(PROGRAM_MIN_SIZE);
  return { size: PROGRAM_MIN_SIZE, lines: wrap(ctx, t, TEXT_BOX_W).slice(0, 2) };
}

/**
 * The default crop: fill the photo window completely, centred, without
 * distorting. Phase 4's face framing replaces this with a box around the face;
 * the shape of the return value is the same either way.
 */
export function coverCrop(imgW, imgH, boxW = HOLE.w, boxH = HOLE.h) {
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const sw = boxW / scale;
  const sh = boxH / scale;
  return { sx: (imgW - sw) / 2, sy: (imgH - sh) / 2, sw, sh };
}

/** Clamps a crop box so it cannot run off the edge of the source image. */
export function clampCrop(crop, imgW, imgH) {
  const sw = Math.min(crop.sw, imgW);
  const sh = Math.min(crop.sh, imgH);
  return {
    sx: Math.max(0, Math.min(crop.sx, imgW - sw)),
    sy: Math.max(0, Math.min(crop.sy, imgH - sh)),
    sw,
    sh,
  };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });
}

/**
 * Draws a finished card onto `ctx`, which must be 642x1014.
 *
 * Order matters: the photo goes down first so the template's transparent window
 * reveals it, then the template covers everything else, and only then the text,
 * which has to sit on top of the opaque artwork.
 */
export function drawCard(ctx, {
  template,
  photo = null,
  crop = null,
  program = "",
  firstName = "",
  lastName = "",
  expiryYear = seasonEndYear(),
}) {
  ctx.save();
  ctx.setTransform(CARD_W / TPL_W, 0, 0, CARD_H / TPL_H, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, TPL_W, TPL_H);

  if (photo) {
    const c = clampCrop(
      crop || coverCrop(photo.naturalWidth || photo.width, photo.naturalHeight || photo.height),
      photo.naturalWidth || photo.width,
      photo.naturalHeight || photo.height
    );
    ctx.drawImage(photo, c.sx, c.sy, c.sw, c.sh, HOLE.x, HOLE.y, HOLE.w, HOLE.h);
  }

  ctx.drawImage(template, 0, 0, TPL_W, TPL_H);

  // Erase the template's baked-in expiry, then set the real one.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, EXPIRY_BAND_TOP, TPL_W, TPL_H - EXPIRY_BAND_TOP);
  ctx.fillStyle = EXPIRY_COLOR;
  ctx.font = boldFont(EXPIRY_SIZE);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(expiryText(expiryYear), TPL_W / 2, EXPIRY_TOP);

  ctx.fillStyle = TEXT_COLOR;
  const fit = fitProgram(ctx, program);
  ctx.font = boldFont(fit.size);
  fit.lines.forEach((line, i) => {
    ctx.fillText(line, TPL_W / 2, PROGRAM_TOP + i * fit.size);
  });

  const name = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();
  if (name) {
    let nameSize = NAME_SIZE;
    ctx.font = boldFont(nameSize);
    while (nameSize > 18 && ctx.measureText(name).width > TEXT_BOX_W) {
      nameSize -= 1;
      ctx.font = boldFont(nameSize);
    }
    const top = PROGRAM_TOP + fit.lines.length * fit.size + NAME_GAP;
    ctx.fillText(name, TPL_W / 2, top);
  }

  ctx.restore();
  return fit;
}

/** Convenience for the print screen: a finished card on its own canvas. */
export async function renderCardCanvas(spec, template = null) {
  const tpl = template || (await loadImage(TEMPLATE_URL));
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  drawCard(canvas.getContext("2d"), { ...spec, template: tpl });
  return canvas;
}
