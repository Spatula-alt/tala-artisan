/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — the sticker the shop prints
   A design's sticker, flat, to print and stick on the real trophy: 300 dpi,
   its real size in cm (the 3D model works in cm), cut to its own outline.

   On a panel design the sticker is the whole printed face, not the wording
   alone. The owner pointed at the white panel -- "the trophy white is the
   whole picture not transparent" -- and at Colour Round's rim: "this whole
   rainbow color is sticker too". So it is the face layer with everything
   printed on or round it: its gold double rule, a black rule laid on it, the
   rainbow's faceted segments, then the wording where the 3D trophy wears it.
   Gold and silver (mirror and glitter acrylic), frost, crystal and wood stay
   pieces of their own, laid on top of it.
   ══════════════════════════════════════════════════════════════ */
import { buildTrophy, disposeGroup, cutOutline, DESIGNS, MATERIALS, SCHEMES, DECALS, FONTS, stickerCanvas } from './trophy.js?v=202611050158';

export const STICKER_DPI = 300;
const PXCM = STICKER_DPI / 2.54;          // pixels per cm
const PAD = Math.round(0.12 * PXCM);      // round the cut, so the cut line drawn on it is not clipped

/* What a layer's finish says it is: printed (flat colour, or a pattern drawn
   from the design's art), or a piece cut from its own sheet. */
const PRINTED = new Set(['panel', 'gloss', 'facets', 'brush', 'ribbon']);
const PATTERN = new Set(['facets', 'brush', 'ribbon']);

/* Print colours: design_art.py's COL, with white the sticker's own white. */
const INK = {
  white: '#FFFFFF', black: '#1A1A1B', navy: '#172661', blue: '#1C4AA8', sky: '#59A6DE', red: '#C22424',
  wine: '#7A1A2B', green: '#1A7A42', yellow: '#EDC21F', orange: '#E07A17', tan: '#E6D6B0', wood: '#8A592E',
  gold: '#D4AB4D', silver: '#C7CCD4',
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
const ringPath = r => r.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ') + ' Z';

function inRing([x, y], r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function toRing([px, py], r) {
  let m = Infinity;
  for (let i = 0; i < r.length; i++) {
    const [ax, ay] = r[i], [bx, by] = r[(i + 1) % r.length];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
    m = Math.min(m, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return m;
}
const NEAR = 1.5;                         // path units: a point this close to an edge is on it
// inside a layer: its holes are not (even-odd, as pathToShape reads them)
const onLayer = (p, rings) => rings.some(r => toRing(p, r) < NEAR) || rings.filter(r => inRing(p, r)).length % 2 === 1;
const covers = (o, q) => q.every(p => inRing(p, o) || toRing(p, o) < NEAR);
const gap = (A, B) => Math.min(...A.flatMap(a => B.map(b => Math.min(...a.map(p => toRing(p, b)), ...b.map(p => toRing(p, a))))));

function hull(pts) {
  const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => list.reduce((h, p) => {
    while (h.length > 1 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
    h.push(p);
    return h;
  }, []);
  const lo = half(P), hi = half([...P].reverse());
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

/* ───────────────────────── what the sticker covers ───────────────────────── */

/* The face, and the printed layers that join it: one laid straight on a
   member (Pentagon's black rule, the Crown Panel's navy hexagon), or a printed
   pattern beside one on its own level (Colour Round's rainbow segments). A
   plain coloured piece beside the face -- the Wing Frame's black frame -- is
   acrylic, as gold is. `start` -1 is the body. */
function grow(D, start) {
  const layer = i => (i < 0 ? { d: D.body, level: 0 } : D.layers[i]);
  const rings = new Map();
  const ringsAt = i => { if (!rings.has(i)) rings.set(i, ringsOf(layer(i).d)); return rings.get(i); };
  const members = [start];
  for (let grew = true; grew;) {
    grew = false;
    D.layers.forEach((L, i) => {
      if (members.includes(i) || !PRINTED.has(L.fin)) return;
      const under = members.filter(j => layer(j).level === L.level - 1);
      const sits = under.length && ringsAt(i).every(r => r.every(p => under.some(j => onLayer(p, ringsAt(j)))));
      const beside = PATTERN.has(L.fin) && members.some(j => layer(j).level === L.level && gap(ringsAt(i), ringsAt(j)) < 3);
      if (sits || beside) { members.push(i); grew = true; }
    });
  }
  return members.filter(i => i >= 0).sort((a, b) => D.layers[a].level - D.layers[b].level || a - b);
}

/* The sheet's colour, where the sticker prints it: never a clear, mirror or
   wood-grain sheet, which show through instead. */
function sheetInk(cfg, D) {
  const key = MATERIALS[cfg.material] ? cfg.material : D.sheet;
  const m = MATERIALS[key];
  if (!m || m.kind !== 'sheet' || key === 'wood') return null;
  return key === 'white' ? INK.white : '#' + m.color.toString(16).padStart(6, '0');
}

/* -> { members, cut, fill, clear }, or null when the sticker is the wording
   alone: a frosted or mirror face, or a clear sheet with nothing printed on it. */
function planOf(D, cfg) {
  const ground = sheetInk(cfg, D);
  if (D.face.on >= 0) {
    if (!PRINTED.has(D.layers[D.face.on].fin)) return null;
    const members = grow(D, D.face.on);
    const outers = members.map(i => outerRing(D.layers[i].d));
    // cut round the member that holds the rest; a rim of separate segments is cut round its hull,
    // the sheet's colour printed in the gaps between them
    const lead = outers.find(o => outers.every(q => q === o || covers(o, q)));
    return lead
      ? { members, cut: ringPath(lead), fill: null, clear: false }
      : { members, cut: ringPath(hull(outers.flat())), fill: ground, clear: !ground };
  }
  // the wording sits on the body: the sticker is the body's whole front
  const members = grow(D, -1);
  if (!members.length && !ground) return null;
  return { members, cut: D.body, fill: ground, clear: !ground };
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
  if (PATTERN.has(L.fin) && art) {
    // the pattern as the 3D trophy wears it: the design's art, through its box
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

/* The wording, as the 3D trophy wears it: at its spot on the face, its size,
   turned as the customer turned it, cut to the decal's shape. Drawn in path
   units (frame: the body's { k, cx, maxY }, see pathToShape). */
function paintWords(g, cfg, dims, words) {
  const { k, cx, maxY } = dims.frame;
  const { dw, dh, at } = dims;
  const edge = new Path2D();
  (DECALS[cfg.decal] || DECALS.rect).build(dw, dh).getPoints(120)
    .forEach((q, i) => (i ? edge.lineTo(q.x / k, -q.y / k) : edge.moveTo(q.x / k, -q.y / k)));
  edge.closePath();
  g.save();
  g.translate(at.x / k + cx, maxY - at.y / k);
  g.rotate(-(at.r || 0));                 // turned the other way: the canvas runs y down
  g.clip(edge);
  g.drawImage(words, -dw / k / 2, -dh / k / 2, dw / k, dh / k);
  g.restore();
}

function faceSticker(D, cfg, dims, words, plan, art) {
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
  paintWords(g, cfg, dims, words);
  const path = new Path2D();
  path.addPath(cut, toPx);
  return { canvas, path, w: (x1 - x0) * k, h: (y1 - y0) * k, clear: plan.clear };
}

/* The wording alone, cut to the decal's shape: a figure's base plate, a
   frosted or mirror face, a clear sheet with nothing else printed. */
function decalSticker(cfg, dims, words) {
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

/* -> { canvas, path, w, h, clear, standIn }: the sticker at 300 dpi, the cut
   line on it in its pixels, its size in cm, whether any of it is left clear,
   and whether a stand-in holds the place of a photo still to come. */
export async function stickerArt(cfg) {
  const standIn = !!(cfg.photo && !cfg.photoImg && cfg.photoTarget !== 'figure');
  if (standIn) cfg = { ...cfg, photoImg: photoStandIn(cfg.photoFit) };
  const art = await stickerOf(cfg);
  if (art) art.standIn = standIn;
  return art;
}

async function stickerOf(cfg) {
  const model = buildTrophy(cfg);
  const dims = model.userData.dims;
  disposeGroup(model);
  if (!dims?.dw || !dims?.dh) return null;
  const f = FONTS[cfg.font] || FONTS.classic;
  try {
    await Promise.all([`${f.titleW || 400} 40px ${f.title}`, `${f.nameStyle || 'normal'} 40px ${f.name}`, `40px ${f.small}`]
      .map(s => document.fonts.load(s)));
  } catch { /* draw with what has loaded */ }
  // drawn larger than it prints for a small sticker, so the lettering stays sharp
  const words = stickerCanvas(cfg, dims.dw / dims.dh, Math.max(1024, dims.dw * PXCM));
  const D = DESIGNS[cfg.shape];
  const plan = D && dims.at && dims.frame ? planOf(D, cfg) : null;
  if (!plan) return decalSticker(cfg, dims, words);
  const art = plan.members.some(i => PATTERN.has(D.layers[i].fin)) ? await artImage(D.art.src) : null;
  return faceSticker(D, cfg, dims, words, plan, art);
}

/* What is printed on the cut piece itself, flat and cut along its outline at
   its real size: the customer's own picture on "Your art" -- the original file
   they send, cropped where the designer cropped it (`cutBox`) -- or their
   photo printed over a whole figure. `img` is that file, as an <img>.
   -> as stickerArt, or null when the piece's outline is not known. */
export function pieceArt(cfg, img) {
  const d = cutOutline(cfg);
  if (!d || !img?.naturalWidth) return null;
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
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (cfg.shape === 'custom' && Array.isArray(cfg.cutBox) && cfg.cutAspect > 0) {
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
  return { canvas, path, w: (u1 - u0) * k, h: (v1 - v0) * k, clear: false };
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
