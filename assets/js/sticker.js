/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — the sticker the shop prints
   A design's sticker, flat, to print and stick on the real trophy: 300 dpi,
   its real size in cm (the 3D model works in cm), cut to its own outline.

   On a panel design only the body is cut from acrylic; everything laid on it
   is printed. The owner, of Gem's red panel, its gold frame and its star
   medallion: "all the second layer you see in trophies are stickers" -- "and
   the other trophies too" (6 Nov 2026). Before that the white panel ("the
   whole picture not transparent") and Colour Round's rainbow ("this whole
   rainbow color is sticker too") had joined the face. So the design sticker
   is every layer as the 3D trophy wears it: the body's whole front when the
   wording is on the body, else cut round all the layers together
   (sticker-cuts.js), pieces standing apart -- Gem's medallion, Crown Panel's
   stars -- each with its own cut line on the one sheet.

   The wording is not printed on it: "the wording are transparent sticker too"
   (6 Nov). It is a sticker of its own, printed ink on clear film, laid on the
   design sticker where the 3D trophy wears it. So one design sticker serves
   every trophy of that design; only the wording changes from order to order.
   ══════════════════════════════════════════════════════════════ */
import { buildTrophy, disposeGroup, cutOutline, DESIGNS, MATERIALS, SCHEMES, DECALS, FONTS, stickerCanvas } from './trophy.js?v=202611091458';
import { CUTS } from './sticker-cuts.js?v=202611091458';

export const STICKER_DPI = 300;
const PXCM = STICKER_DPI / 2.54;          // pixels per cm
const PAD = Math.round(0.12 * PXCM);      // round the cut, so the cut line drawn on it is not clipped

/* How a layer's finish prints: flat colour (gloss, and a panel with its gold
   rule, as the shop has printed them), or the finish itself from the design's
   art -- foil, glitter, frost, crystal, wood, facets, brush, ribbon. */
const FLAT = new Set(['gloss', 'panel']);

/* Print colours: design_art.py's COL, with white the sticker's own white. */
const INK = {
  white: '#FFFFFF', black: '#1A1A1B', navy: '#172661', blue: '#1C4AA8', sky: '#59A6DE', red: '#C22424',
  wine: '#7A1A2B', green: '#1A7A42', yellow: '#EDC21F', orange: '#E07A17', tan: '#E6D6B0', wood: '#8A592E',
  gold: '#D4AB4D', silver: '#C7CCD4', frost: 'rgba(242,245,247,.8)',
};

/* ───────────── a design's paths, as rings (trophy-designs.py writes polygons: M L Z) ───────────── */

const ringsOf = d => d.split('M').slice(1).map(sp => {
  const n = (sp.match(/-?\d*\.?\d+/g) || []).map(Number);
  const r = [];
  for (let i = 0; i + 1 < n.length; i += 2) r.push([n[i], n[i + 1]]);
  return r;
}).filter(r => r.length > 2);

const area = r => Math.abs(r.reduce((s, [x, y], i) => { const [u, v] = r[(i + 1) % r.length]; return s + x * v - u * y; }, 0)) / 2;
const outerRing = d => ringsOf(d).reduce((b, r) => (area(r) > area(b) ? r : b));

/* ───────────────────────── what the sticker covers ───────────────────────── */

/* The sheet's colour, where the sticker prints it: never a clear, mirror or
   wood-grain sheet, which show through instead. */
function sheetInk(cfg, D) {
  const key = MATERIALS[cfg.material] ? cfg.material : D.sheet;
  const m = MATERIALS[key];
  if (!m || m.kind !== 'sheet' || key === 'wood') return null;
  return key === 'white' ? INK.white : '#' + m.color.toString(16).padStart(6, '0');
}

/* -> { members, cut, fill, clear }: every layer, the lowest level first. The
   cut: the body's whole front when the wording sits on the body, else round
   all the layers (sticker-cuts.py). Where the cut takes in some of the body --
   a gap closed, what a ring holds -- the sheet's colour is printed, or that
   part is left clear on a clear, mirror or wood sheet, as is frost on one. */
function planOf(D, key, cfg) {
  const ground = sheetInk(cfg, D);
  const members = D.layers.map((_, i) => i).sort((a, b) => D.layers[a].level - D.layers[b].level || a - b);
  const c = D.face.on >= 0 && CUTS[key];
  if (!c) return { members, cut: D.body, fill: ground, clear: !ground };
  const frosted = D.layers.some(L => L.fin === 'frost');
  return { members, cut: c.d, fill: ground, clear: !ground && (c.gaps || frosted) };
}

/* ───────────────────────── drawing ───────────────────────── */

const ARTS = new Map();
function artImage(src) {
  if (!ARTS.has(src)) {
    ARTS.set(src, new Promise(resolve => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = new URL('../' + src, import.meta.url).href;
    }));
  }
  return ARTS.get(src);
}

/* design_art.py's rule_overlay: a gold band 3.2-4.4 units inside the face's
   edge and a fainter one at 6.0-6.6, in its foil gradient. Strokes centred on
   the edge and clipped to the face, widest first, each narrower one in the
   face's colour, leave exactly those bands. */
function goldRule(g, p, ring, ground) {
  const xs = ring.map(q => q[0]), ys = ring.map(q => q[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), a = Math.PI / 6;
  const span = (Math.max(...xs) - x0) * Math.cos(a) + (Math.max(...ys) - y0) * Math.sin(a);
  const gold = g.createLinearGradient(x0, y0, x0 + span * Math.cos(a), y0 + span * Math.sin(a));
  gold.addColorStop(0, '#F9DF91'); gold.addColorStop(0.5, '#D6A847'); gold.addColorStop(1, '#987127');
  g.save();
  g.clip(p, 'evenodd');
  g.lineJoin = 'round';
  for (const [inset, ink, alpha] of [[6.6, gold, 0.85], [6.0, ground, 1], [4.4, gold, 1], [3.2, ground, 1]]) {
    g.globalAlpha = alpha;
    g.strokeStyle = ink;
    g.lineWidth = inset * 2;
    g.stroke(p);
  }
  g.restore();
}

function paintLayer(g, D, i, art) {
  const L = D.layers[i], p = new Path2D(L.d);
  if (!FLAT.has(L.fin) && art) {
    // the finish as the 3D trophy wears it: the design's art, through its box, cut sharp on the layer's edge
    const [x0, y0, x1, y1] = D.art.box;
    g.save();
    g.clip(p, 'evenodd');
    g.drawImage(art, x0, y0, x1 - x0, y1 - y0);
    g.restore();
  } else {
    g.fillStyle = INK[L.mat] || '#888888';
    g.fill(p, 'evenodd');
  }
  // the gold rule, as design_art.py prints it on a white or cream face
  if (i === D.face.on && (L.mat === 'white' || L.mat === 'tan')) goldRule(g, p, outerRing(L.d), INK[L.mat]);
}

/* The design sticker: the layers, without the wording. Drawn in path units
   (frame: the body's { k, cx, maxY }, see pathToShape). */
function designSticker(D, dims, plan, art) {
  const { k } = dims.frame;
  const s = k * PXCM;                     // px per path unit
  const pts = ringsOf(plan.cut).flat();
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((x1 - x0) * s) + 2 * PAD;
  canvas.height = Math.ceil((y1 - y0) * s) + 2 * PAD;
  const toPx = new DOMMatrix([s, 0, 0, s, PAD - x0 * s, PAD - y0 * s]);
  const g = canvas.getContext('2d');
  g.setTransform(toPx);
  const cut = new Path2D(plan.cut);
  g.clip(cut, 'evenodd');
  if (plan.fill) { g.fillStyle = plan.fill; g.fill(cut, 'evenodd'); }
  for (const i of plan.members) paintLayer(g, D, i, art);
  const path = new Path2D();
  path.addPath(cut, toPx);
  return { canvas, path, w: (x1 - x0) * k, h: (y1 - y0) * k, clear: plan.clear };
}

/* The wording, cut to the decal's shape, at its size on the trophy: a figure's
   base plate, or on a layered design the clear sticker laid on the design's.
   Clear wherever nothing is printed (a printed-ink scheme has no ground). */
function wordingSticker(cfg, dims, words) {
  const W = Math.round(dims.dw * PXCM), H = Math.round(dims.dh * PXCM);
  const path = new Path2D();
  (DECALS[cfg.decal] || DECALS.rect).build(dims.dw, dims.dh).getPoints(120).forEach((q, i) => {
    const x = PAD + (q.x / dims.dw + 0.5) * W, y = PAD + (0.5 - q.y / dims.dh) * H;
    if (i) path.lineTo(x, y); else path.moveTo(x, y);
  });
  path.closePath();
  const canvas = document.createElement('canvas');
  canvas.width = W + 2 * PAD; canvas.height = H + 2 * PAD;
  const g = canvas.getContext('2d');
  g.clip(path);
  g.drawImage(words, PAD, PAD, W, H);
  return { canvas, path, w: dims.dw, h: dims.dh, clear: !!SCHEMES[cfg.scheme]?.print };
}

/* Where a photo the customer is still to send goes: a grey stand-in, so the
   sticker is laid out round it as it will be printed. */
function photoStandIn(fit) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#CFCAC0';
  g.fillRect(0, 0, 512, 512);
  if (fit !== 'cover') {                  // behind the whole sticker the word would sit under the wording
    g.fillStyle = '#7D776C';
    g.font = '600 92px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('PHOTO', 256, 262);
  }
  c.naturalWidth = c.naturalHeight = 512; // stickerCanvas sizes a photo by these
  return c;
}

/* -> { canvas, path, w, h, clear, standIn, words? }: the sticker at 300 dpi,
   the cut line on it in its pixels, its size in cm, whether any of it is left
   clear, and whether a stand-in holds the place of a photo still to come. On a
   layered design it is the design sticker, and `words` the wording's own
   sticker (as these, the photo in it) to lay on it. */
export async function stickerArt(cfg) {
  const standIn = !!(cfg.photo && !cfg.photoImg && cfg.photoTarget !== 'figure');
  if (standIn) cfg = { ...cfg, photoImg: photoStandIn(cfg.photoFit) };
  const art = await stickerOf(cfg);
  if (art) art.standIn = standIn;
  return art;
}

// the trophy measured for its sticker (its size and place come from the 3D model), and the fonts loaded
async function measure(cfg) {
  const model = buildTrophy(cfg);
  const dims = model.userData.dims;
  disposeGroup(model);
  if (!dims?.dw || !dims?.dh) return null;
  const f = FONTS[cfg.font] || FONTS.classic;
  try {
    await Promise.all([`${f.titleW || 400} 40px ${f.title}`, `${f.nameStyle || 'normal'} 40px ${f.name}`, `40px ${f.small}`]
      .map(s => document.fonts.load(s)));
  } catch { /* draw with what has loaded */ }
  return dims;
}
// drawn larger than it prints for a small sticker, so the lettering stays sharp
const wordsOf = (cfg, dims) => wordingSticker(cfg, dims, stickerCanvas(cfg, dims.dw / dims.dh, Math.max(1024, dims.dw * PXCM)));

/* The wording sticker of each trophy in a list (design.names: a different title
   and name on each, owner 7 Nov): the same size and place on all of them, so the
   trophy is measured once. Each is handed to `each(art, i)` and then let go, so
   fifty of them never sit in memory together at 300 dpi. -> how many were made */
export async function eachWording(cfg, rows, each) {
  if (cfg.photo && !cfg.photoImg && cfg.photoTarget !== 'figure') cfg = { ...cfg, photoImg: photoStandIn(cfg.photoFit) };
  const dims = await measure(cfg);
  if (!dims) return 0;
  for (let i = 0; i < rows.length; i++) {
    const art = wordsOf({ ...cfg, title: rows[i].title, name: rows[i].name }, dims);
    await each(art, i);
    art.canvas.width = art.canvas.height = 0;
  }
  return rows.length;
}

async function stickerOf(cfg) {
  const dims = await measure(cfg);
  if (!dims) return null;
  const words = wordsOf(cfg, dims);
  const D = DESIGNS[cfg.shape];
  const plan = D && dims.frame ? planOf(D, cfg.shape, cfg) : null;
  if (!plan) return words;
  const art = plan.members.some(i => !FLAT.has(D.layers[i].fin)) ? await artImage(D.art.src) : null;
  return { ...designSticker(D, dims, plan, art), words };
}

/* What is printed on the cut piece itself, flat and cut along its outline at
   its real size: the customer's own picture on "Your art" -- the original file
   they send, cropped where the designer cropped it (`cutBox`) -- or their
   photo printed over a whole figure. `img` is that file, as an <img>.
   -> as stickerArt, or null when the piece's outline is not known. */
export function pieceArt(cfg, img, box = null) {
  const d = cutOutline(cfg);
  if (!d || !(img?.naturalWidth || img?.width)) return null;
  const model = buildTrophy(cfg);
  const dims = model.userData.dims;
  const geo = model.getObjectByName('blade')?.geometry;
  geo?.computeBoundingBox();
  const bb = geo?.boundingBox?.clone();
  disposeGroup(model);
  if (!dims?.frame || !bb) return null;
  const { k, cx, maxY } = dims.frame;
  // the cut's box, in its outline's units (the blade's own frame: x from the centroid, y up from the foot)
  const u0 = bb.min.x / k + cx, u1 = bb.max.x / k + cx, v0 = maxY - bb.max.y / k, v1 = maxY - bb.min.y / k;
  const s = k * PXCM;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((u1 - u0) * s) + 2 * PAD;
  canvas.height = Math.ceil((v1 - v0) * s) + 2 * PAD;
  const toPx = new DOMMatrix([s, 0, 0, s, PAD - u0 * s, PAD - v0 * s]);
  const g = canvas.getContext('2d');
  g.setTransform(toPx);
  const cut = new Path2D(d);
  g.clip(cut, 'evenodd');
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (box) {
    // a figure's own print (owner, 8 Nov): where polish-figure.py laid it, its box in the cut's units,
    // inside a clear border -- the dashed line is the acrylic's cut, round it
    const [x0, y0, x1, y1] = box;
    g.drawImage(img, x0, y0, x1 - x0, y1 - y0);
  } else if (cfg.shape === 'custom' && Array.isArray(cfg.cutBox) && cfg.cutAspect > 0) {
    // cutout.js scales its crop to 300 units tall, from the crop's top left corner
    const [bx, by, bw, bh] = cfg.cutBox;
    g.drawImage(img, bx * iw, by * ih, bw * iw, bh * ih, 0, 0, 300 / cfg.cutAspect, 300);
  } else {
    // over the blade's box, as the 3D model prints it: object-fit cover
    const x0 = cx - dims.w / k, y0 = maxY - dims.h / k, bw = 2 * dims.w / k, bh = dims.h / k;
    const f = Math.max(bw / iw, bh / ih);
    g.drawImage(img, x0 + (bw - iw * f) / 2, y0 + (bh - ih * f) / 2, iw * f, ih * f);
  }
  const path = new Path2D();
  path.addPath(cut, toPx);
  return { canvas, path, w: (u1 - u0) * k, h: (v1 - v0) * k, clear: !!box };
}

let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* A PNG that carries its own resolution (a pHYs chunk after IHDR), so a photo
   app prints it at its real size. The browser's PNG has none: printed as it
   is, a 7 cm sticker came out about 22 cm wide. */
export async function pngAtDpi(canvas, dpi = STICKER_DPI) {
  const png = new Uint8Array(await (await new Promise(r => canvas.toBlob(r, 'image/png'))).arrayBuffer());
  const chunk = new Uint8Array(21), v = new DataView(chunk.buffer), ppm = Math.round(dpi / 0.0254);
  v.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4);                  // "pHYs"
  v.setUint32(8, ppm); v.setUint32(12, ppm); chunk[16] = 1; // pixels per metre, across and down
  v.setUint32(17, crc32(chunk.subarray(4, 17)));
  return new Blob([png.subarray(0, 33), chunk, png.subarray(33)], { type: 'image/png' });
}
