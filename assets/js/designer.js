/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — trophy designer
   Structural changes rebuild the model; typing, print colours and the
   dropped photo only repaint the sticker, so the preview keeps up.
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { createViewer, webglAvailable } from './viewer.js?v=202610251536';
import {
  buildTrophy, disposeGroup, setSticker,
  SHAPES, MATERIALS, SIZES, MOTIFS, DECALS, SCHEMES, LAMINATES, FONTS,
  BASES, BASE_FINISHES, PHOTO_FITS,
  OCCASIONS, SPEEDS, ZONES, PAYMENTS, QTY_TIERS,
  quote, peso, fmtDate, setCustomOutline, outlinePath, setVariant, variantsOf, groupsOf, groupOf, isStyled,
} from './trophy.js?v=202610251536';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* ───────────────────────── state ───────────────────────── */

const cfg = {
  shape: 'lady', variant: 0, material: 'white', size: 'l',
  baseKind: 'goldbar', baseFinish: 'gold',
  decal: 'rect', scheme: 'black', laminate: 'gloss', font: 'script', motif: 'crown',
  org: 'Mutya ng Calapan', title: '1st Runner-Up',
  name: 'Maria C. Lualhati', date: '2026',
  photoImg: null, photoFit: 'badge', photoTarget: 'sticker',
  place: null,            // the customer's own sticker placement, or null for the design's box
  cutArt: null, cutPrint: true, cutMode: null, cutAspect: null,   // "Your art" cut from a picture
  extraSticker: false, logo: false, qty: 6,
  speed: 'standard', zone: 'province', payment: 'cash',
  needBy: '', _occasion: 'pageant',
};

const TEXT_FIELDS = { fOrg: 'org', fTitle: 'title', fName: 'name', fDate: 'date' };

/* Glyphs for the sticker MOTIFS — printed clip art, not cut shapes. The cut
   shape tiles draw the real outline instead (see outlinePath). */
const ICON_GOWN = 'M20 5a3.4 3.4 0 1 1 0 6.8A3.4 3.4 0 0 1 20 5Zm-2.6 7.6h5.2c.6 2.4 1.9 3.4 3.4 4.2l1.2 8.4-1.9.3-1-7v3.1L31 44H9l6.7-27.4v-3.1l-1 7-1.9-.3 1.2-8.4c1.5-.8 2.8-1.8 3.4-4.2Z';
const ICON_SUIT = 'M20 5a3.4 3.4 0 1 1 0 6.8A3.4 3.4 0 0 1 20 5Zm-2.8 7.6h5.6c2.2.5 3.6 1.5 4.3 3.1l1.4 10.5-1.9.3-1.3-8.6v4.4L27 44h-4.3l-1.6-11.8V44h-2.2V32.2L17.3 44H13l1.7-21.7v-4.4l-1.3 8.6-1.9-.3 1.4-10.5c.7-1.6 2.1-2.6 4.3-3.1Z';
const FIG_CUSTOM = 'M8 10h24v24H8Zm3 3v18h18V13Zm2.6 14.4 4.6-6 3.4 4.2 2.8-3.2 4 5Z';

const MOTIF_ICONS = {
  none:   '',
  star:   'M20 8l2.4 7.3L30 13l-3.6 7L34 22l-7.6 2 3.6 7-7.6-2.3L20 36l-2.4-7.3L10 31l3.6-7L6 22l7.6-2L10 13l7.6 2.3Z',
  laurel: 'M20 8v28M20 14c-5-4-9-3-11 0 2 4 7 4 11 0Zm0 8c-5-4-9-3-11 0 2 4 7 4 11 0Zm0-8c5-4 9-3 11 0-2 4-7 4-11 0Zm0 8c5-4 9-3 11 0-2 4-7 4-11 0Z',
  crown:  'M6 34 8 12l7 8 5-11 5 11 7-8 2 22Z',
  gown:   ICON_GOWN,
  suit:   ICON_SUIT,
  pair:   'M11 7.6a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2ZM8.8 14.2h4.4c2.5.7 3.7 2.2 3.7 5v7.4L15.5 39h-3.6l-1-9.2-1 9.2H6.3L4.9 26.6v-7.4c0-2.8 1.2-4.3 3.9-5ZM29 7.6a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Zm-2 6.6h4c.7 2.8 1.4 4.4.9 6.7L37 39H21l5.1-18.1c-.5-2.3.2-3.9.9-6.7Z',
  heart:  'M20 34S7 25.5 7 17.5C7 13 10.4 10 14.3 10c2.6 0 4.7 1.4 5.7 3.4 1-2 3.1-3.4 5.7-3.4 3.9 0 7.3 3 7.3 7.5C33 25.5 20 34 20 34Z',
};

const OCC_ICONS = {
  pageant:   'M6 31 8 11l7 7 5-10 5 10 7-7 2 20Zm0 3h28v4H6Z',
  liga:      'M20 6a14 14 0 1 1 0 28 14 14 0 0 1 0-28Zm0 3a11 11 0 0 0-11 11h22A11 11 0 0 0 20 9Zm-11 14a11 11 0 0 0 22 0ZM20 6v28',
  school:    'M20 8 36 15l-16 7-16-7Zm-9 11v8c0 3 4 5 9 5s9-2 9-5v-8l-9 4Zm22-3v10',
  fiesta:    'M20 4l3.4 9.6L33 10l-3.6 9.4L39 23l-9.6 1.6L33 34l-9.6-3.6L20 40l-3.4-9.6L7 34l3.6-9.4L1 23l9.6-1.6L7 10l9.6 3.4Z',
  contest:   'M20 6v26M20 13c-6-5-11-4-13 0 2 5 8 5 13 0Zm0 9c-6-5-11-4-13 0 2 5 8 5 13 0Zm0-9c6-5 11-4 13 0-2 5-8 5-13 0Zm0 9c6-5 11-4 13 0-2 5-8 5-13 0Z',
  corporate: 'M7 34V10h12v24ZM21 34V17h12v17ZM10 14h6M10 19h6M10 24h6M24 21h6M24 26h6',
};

const DECAL_ICONS = {
  rect:   'M7 11h26a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V14a3 3 0 0 1 3-3Z',
  oval:   'M20 10c9 0 16 4.5 16 10s-7 10-16 10S4 25.5 4 20s7-10 16-10Z',
  shield: 'M6 9h28v12c0 7-7 12-14 15C13 33 6 28 6 21Z',
  circle: 'M20 7a13 13 0 1 1 0 26 13 13 0 0 1 0-26Z',
};

const BASE_ICONS = {
  goldbar: 'M8 30h24l-3-12H11Z',
  octbox:  'M14 15h12l6 6v7l-6 6H14l-6-6v-7Z',
  utilbox: 'M8 17h24v14H8Z',
  block:   'M6 26h28v6H6Zm4-8h20v8H10Z',
};

/* Where a dropped image goes. On the figures it can be printed over the
   whole cut shape; everywhere else it belongs in the sticker. */
const PHOTO_TARGETS = {
  sticker: { label: 'In the sticker', hint: 'Inside the name plate' },
  figure:  { label: 'On the figure',  hint: 'Printed over the whole cut shape' },
};

const hex = n => '#' + n.toString(16).padStart(6, '0');
function materialSwatch(spec) {
  if (spec.kind === 'glass')  return 'linear-gradient(135deg,#eaf4f6,#aac4cc)';
  if (spec.kind === 'mirror') return `linear-gradient(135deg,${hex(spec.color)},#ffffff 42%,${hex(spec.color)})`;
  return hex(spec.color);
}
const finishSwatch = f => f.metal
  ? `linear-gradient(135deg,${hex(f.color)},#ffffff 45%,${hex(f.color)})`
  : hex(f.color);
const schemeSwatch = s => `linear-gradient(135deg,${s.bg},${s.bg2 || s.bg})`;

/* ───────────────────────── 3D ───────────────────────── */

const viz = $('#dzViz'), canvas = $('#dzCanvas');
let viewer = null, model = null;

function rebuild() {
  // clear and white sheet need a dark ground or they read as empty
  viz?.classList.toggle('is-dark', cfg.material === 'clear' || cfg.material === 'white');
  if (!viewer) return;
  if (model) { viewer.scene.remove(model); disposeGroup(model); }
  model = buildTrophy(cfg);
  if (cfg.place && !placementFits(cfg.place)) {
    cfg.place = null;                       // e.g. a bigger sticker shape no longer fits
    disposeGroup(model);
    model = buildTrophy(cfg);
  }
  viewer.scene.add(model);
  viewer.frameObject(model);
  viewer.invalidate();
  placeUi();
}

function repaintSticker() {
  if (!viewer || !model) return;
  setSticker(model, cfg);
  viewer.invalidate();
}

function showViewerError(text) {
  if (!viz || viz.querySelector('.viz__err')) return;
  const p = document.createElement('p');
  p.className = 'viz__err';
  p.textContent = text;
  viz.append(p);
}

async function boot3D() {
  if (!viz || !canvas || !webglAvailable()) {
    showViewerError('Your browser could not start 3D. Everything else here still works — send us the wording and we will proof it for you.');
    return;
  }
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* fallback fonts */ } }
  viewer = createViewer(canvas, {
    autoRotate: true, capture: true, maxDpr: 2,
    grab: grabSticker,
    wheel: wheelSticker,
    hover: e => { canvas.style.cursor = onSticker(e) ? 'move' : ''; },
  });
  rebuild();
  viz.classList.add('is-live');
}

/* ───────────────────────── sticker placement ─────────────────────────
   Drag the sticker on the 3D face; scroll over it, or use the sliders, to size
   and turn it. It is printed vinyl applied to flat acrylic, so it must stay on
   the face -- not over an edge, a cut-out or the gold accent pieces -- with a
   small margin. A move that would break that is refused and a hint shows.
   While dragging only the sticker mesh moves; nothing is rebuilt.            */

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const MARGIN = 0.25;                                // cm of clear acrylic round it

function aim(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, viewer.camera);
}
function stickerMesh() { return model?.userData.face ? model.getObjectByName('sticker') : null; }
function onSticker(e) {
  const st = stickerMesh();
  if (!st) return false;
  aim(e);
  return ray.intersectObject(st, false).length > 0;
}
function onFace(e) {
  const f = model.userData.face;
  aim(e);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -f.z), p) ? p : null;
}

function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/* the current placement, filled in from the design's own sticker box */
function placement() {
  const f = model?.userData.face;
  const b = f ? f.box : { x: 0, y: 0.5 };
  const P = cfg.place || {};
  return { x: P.x ?? b.x ?? 0, y: P.y ?? b.y, s: P.s ?? 1, r: P.r ?? 0 };
}

/* the sticker's outline on the face for a placement, in face x/y */
function outline(P) {
  const f = model.userData.face;
  let dw = f.base.w * P.s, dh = f.base.h * P.s;
  const spec = DECALS[cfg.decal] || DECALS.rect;
  if (spec.ratio === 1) dw = dh = Math.min(dw, dh);
  const cx = f.w * 2 * P.x, cy = f.by + f.h * P.y;
  const cos = Math.cos(P.r), sin = Math.sin(P.r);
  return spec.build(dw, dh).getPoints(24).map(p => [cx + p.x * cos - p.y * sin, cy + p.x * sin + p.y * cos]);
}

function placementFits(P) {
  const f = model?.userData.face;
  if (!f) return true;
  P = { ...placement(), ...P };
  const pts = outline(P);
  const cx = f.w * 2 * P.x, cy = f.by + f.h * P.y;
  for (const [x, y] of pts) {
    const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1;
    const ox = x + dx / L * MARGIN, oy = y + dy / L * MARGIN;   // the margin, pushed outwards
    if (!inPoly(ox, oy, f.poly)) return false;
    for (const hole of f.holes)  if (inPoly(x, y, hole) || inPoly(ox, oy, hole)) return false;
    for (const acc of f.accents) if (inPoly(x, y, acc) || inPoly(ox, oy, acc)) return false;
  }
  // and no accent or cut-out reaching INTO the sticker between its sample points
  for (const ring of [...f.accents, ...f.holes]) for (const [x, y] of ring) if (inPoly(x, y, pts)) return false;
  return true;
}

let blockTimer = 0;
function blocked() {
  if (!viz.querySelector('.viz__block')) {
    const t = document.createElement('div');
    t.className = 'viz__block'; t.setAttribute('role', 'status');
    t.textContent = 'Keep the sticker on the flat acrylic';
    viz.append(t);
  }
  viz.classList.add('is-blocked');
  clearTimeout(blockTimer);
  blockTimer = setTimeout(() => viz.classList.remove('is-blocked'), 1200);
}

/* move the existing mesh to a placement, without a rebuild. The mesh was
   built at size s0; scale is relative to that. */
function showPlacement(P) {
  const st = stickerMesh(), f = model.userData.face;
  const s0 = st.userData.s0 || 1;
  st.position.x = f.w * 2 * P.x;
  st.position.y = f.by + f.h * P.y;
  st.scale.set(P.s / s0, P.s / s0, 1);
  st.rotation.z = P.r;
  viewer.invalidate();
}

/* try a placement: apply it if it fits, otherwise keep the old one and say why */
function tryPlace(next) {
  const P = { ...placement(), ...next };
  if (Math.abs(P.x) < 0.015) P.x = 0;               // snap to the centre line
  if (!placementFits(P)) { blocked(); return false; }
  cfg.place = P;
  showPlacement(P);
  placeUi(false);
  return true;
}

function grabSticker(e) {
  if (!onSticker(e)) return null;
  const f = model.userData.face, P = placement();
  const hit = onFace(e);
  if (!hit) return null;
  const off = { x: hit.x - f.w * 2 * P.x, y: hit.y - (f.by + f.h * P.y) };
  canvas.style.cursor = 'grabbing';
  let moved = false;
  return {
    move(ev) {
      const p = onFace(ev);
      if (!p) return;
      if (tryPlace({ x: (p.x - off.x) / (f.w * 2), y: (p.y - off.y - f.by) / f.h })) moved = true;
    },
    end() {
      canvas.style.cursor = '';
      if (moved) { custom(); sync(); }
    },
  };
}

function wheelSticker(e) {
  if (!onSticker(e)) return false;
  const P = placement();
  tryPlace({ s: Math.min(1.6, Math.max(0.5, P.s * (1 - e.deltaY * 0.0012))) });
  custom(); sync();
  return true;
}

/* the controls in the Sticker step; `full` after a rebuild */
function placeUi(full = true) {
  const block = $('#placeBlock');
  if (!block) return;
  const on = !!model?.userData.face;
  block.hidden = !on;
  if (!on) return;
  const P = placement();
  if (full) { const st = stickerMesh(); if (st) st.userData.s0 = P.s; }
  $('#placeSize').value = Math.round(P.s * 100);
  $('#placeSizeOut').textContent = Math.round(P.s * 100) + '%';
  $('#placeRot').value = Math.round(P.r * 180 / Math.PI);
  $('#placeRotOut').textContent = Math.round(P.r * 180 / Math.PI) + '°';
}
$('#placeSize')?.addEventListener('input', e => {
  if (!tryPlace({ s: +e.target.value / 100 })) placeUi(false);
  custom(); sync();
});
$('#placeRot')?.addEventListener('input', e => {
  if (!tryPlace({ r: +e.target.value * Math.PI / 180 })) placeUi(false);
  custom(); sync();
});
/* for tests/designer-check.js: does every design's own sticker box fit its face? */
window.__talaPlace = { fits: () => placementFits(placement()), placement, cfg };
$('#placeCentre')?.addEventListener('click', () => { tryPlace({ x: 0 }); custom(); sync(); });
$('#placeReset')?.addEventListener('click', () => { cfg.place = null; rebuild(); custom(); sync(); });

/* ───────────────────────── cut from your picture ─────────────────────────
   The customer's picture, background removed, becomes the cut shape.
   Two ways: Automatic (cutout.js picks transparency, a flat background or
   the photo model) and Edit by hand -- the automatic mask on the preview,
   with an Erase / Keep brush. Every finished cut goes onto the trophy at
   once. cutout.js is only fetched when this is used. An SVG with a path
   still works the old way: its outline is the cut.                         */

const cut = {
  img: null, url: null, c: null, m: null, auto: null, mode: null,
  detail: 0, result: null, busy: false,     // 0 = smoothest edge; the owner found more detail only roughened it
  hand: false, brush: 'erase', size: 18, history: [], future: [],
};
let cutMod = null;
const cutLib = async () => cutMod || (cutMod = await import('./cutout.js?v=202610251536'));

function cutNote(text, bad = false) {
  const el = $('#cutMsg');
  if (el) { el.textContent = text || ''; el.className = 'drop__msg' + (bad ? ' bad' : ''); }
}

function bladeHeightCm() {
  const size = SIZES[cfg.size] || SIZES.m;
  return size.total - size.baseH * 1.35;            // the figure's own height above its base
}

/* where the working picture sits inside the preview canvas */
function cutView() {
  const S = $('#cutPrev').width, c = cut.c;
  const k = Math.min((S - 16) / c.width, (S - 16) / c.height);
  return { S, k, ox: (S - c.width * k) / 2, oy: (S - c.height * k) / 2 };
}

/* the preview: Automatic shows the cut piece; Edit by hand shows the whole
   picture, with what will be cut away faded, so there is something to paint */
let fadeCanvas = null;
function drawCutPreview() {
  const cv = $('#cutPrev'), r = cut.result;
  if (!cv || !cut.c) return;
  const g = cv.getContext('2d'), { S, k, ox, oy } = cutView();
  g.clearRect(0, 0, S, S);
  const W = cut.c.width, H = cut.c.height;
  // the traced cut line, in preview pixels
  let path = null;
  if (r) {
    const s = r.art.height * k / 300;
    path = new Path2D();
    for (const ring of r.d.split('Z')) {
      const pts = [...ring.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)]
        .map(m => [ox + r.x0 * k + +m[1] * s, oy + r.y0 * k + +m[2] * s]);
      if (!pts.length) continue;
      path.moveTo(...pts[0]); for (const q of pts.slice(1)) path.lineTo(...q); path.closePath();
    }
  }
  if (cut.hand && (painting || !path)) {
    // mid-stroke: show the paint itself, so the brush answers at once
    fadeCanvas = fadeCanvas || document.createElement('canvas');
    fadeCanvas.width = W; fadeCanvas.height = H;
    const fx = fadeCanvas.getContext('2d');
    fx.drawImage(cut.c, 0, 0);
    const id = fx.getImageData(0, 0, W, H);
    for (let i = 0; i < cut.m.length; i++) if (!cut.m[i]) id.data[i * 4 + 3] = 55;
    fx.putImageData(id, 0, 0);
    g.drawImage(fadeCanvas, ox, oy, W * k, H * k);
  } else if (cut.hand) {
    // after a stroke: show what will really be cut. Holes too small to cut
    // cleanly are filled back and thin parts thickened, so the raw paint is
    // not the truth -- the finished outline is.
    g.globalAlpha = 0.22;
    g.drawImage(cut.c, ox, oy, W * k, H * k);
    g.globalAlpha = 1;
    g.save(); g.clip(path, 'evenodd');
    g.drawImage(cut.c, ox, oy, W * k, H * k);
    g.restore();
  } else if (r && $('#cutPrint')?.checked) {
    g.drawImage(r.art, ox + r.x0 * k, oy + r.y0 * k, r.art.width * k, r.art.height * k);
  }
  if (path) {
    if (!cut.hand && !$('#cutPrint')?.checked) { g.fillStyle = 'rgba(21,20,15,.18)'; g.fill(path, 'evenodd'); }
    if (!(cut.hand && painting)) { g.lineWidth = 2; g.strokeStyle = '#c0392b'; g.setLineDash([6, 4]); g.stroke(path); g.setLineDash([]); }
  }
  cv.hidden = false;
  $('#cutHint').hidden = true;
  cv.classList.toggle('is-painting', cut.hand);
}

/* mask -> cut -> trophy */
async function finishAndApply() {
  const lib = await cutLib();
  try {
    const r = lib.finishCut(cut.c, cut.m, cut.mode, { detail: cut.detail, heightCm: bladeHeightCm() });
    cut.result = r;
    applyCut(r);
    drawCutPreview();
    const how = { alpha: 'its own transparency', plain: 'the plain background removed',
                  photo: 'the photo background removed' }[cut.mode];
    cutNote((cut.hand ? 'Your trophy is now cut to your edited shape.' : `Your trophy is now cut to this shape (${how}).`)
      + ' Anything thinner than 3 mm was thickened so it will not snap.'
      + (r.holes ? ` ${r.holes} hole${r.holes > 1 ? 's' : ''} will be cut right through the acrylic.` : '')
      + (cut.hand ? ' Erasing inside the shape cuts a hole; marks too small to cut are filled back in.' : ''));
  } catch (err) {
    cutNote(err.message || 'Nothing would be left to cut. Undo, or paint some of it back with Keep.', true);
  }
}

async function runAuto() {
  if (!cut.img || cut.busy) return;
  cut.busy = true;
  try {
    const lib = await cutLib();
    const { c, m, mode } = await lib.autoMask(cut.img, 'auto', t => cutNote(t));
    cut.c = c; cut.m = m; cut.auto = m.slice(); cut.mode = mode; cut.history = []; cut.future = []; undoState();
    await finishAndApply();
    $('#cutOpts').hidden = false;
  } catch (err) {
    console.warn('[tala] cut-out failed:', err);
    cutNote(err.message || 'That picture could not be cut. Try another picture.', true);
  } finally { cut.busy = false; }
}

function setCutMode(k) {
  cut.hand = k === 'hand';
  $$('#optCutMode .opt').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.key === k)));
  $('#cutTools').hidden = !cut.hand;
  if (!cut.hand && cut.auto) { cut.m = cut.auto.slice(); cut.history = []; cut.future = []; undoState(); finishAndApply(); }
  else drawCutPreview();
  if (cut.hand) cutNote('Paint on the picture: Erase cuts background away, Keep brings a part back.');
}

async function chooseCutFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) return cutNote('That needs to be a picture file.', true);
  if (file.size > 8 * 1024 * 1024) return cutNote('Too large — keep it under 8 MB.', true);
  if (file.type === 'image/svg+xml' && await readOutline(file)) {     // an outline already
    cut.result = null; cfg.cutArt = null; cfg.cutAspect = null;
    outlineReady = true; useCustomShape();
    return cutNote('Outline read from your SVG — it is now the cut shape.');
  }
  if (cut.url) URL.revokeObjectURL(cut.url);
  try {
    const { readImage } = await cutLib();
    const { img, url } = await readImage(file);
    cut.img = img; cut.url = url;
    setCutMode('auto');
    await runAuto();
  } catch (err) { cutNote(err.message, true); }
}

function useCustomShape() {
  cfg.shape = 'custom'; cfg.variant = 0; cfg.place = null;
  setVariant('custom', 0); poseTiles(); buildTiles(); markTiles(); custom(); rebuild(); sync();
}

/* A finished cut goes onto the trophy at once. */
function applyCut(r) {
  setCustomOutline(r.d);
  cfg.cutArt = r.art;
  cfg.cutPrint = $('#cutPrint').checked;
  cfg.cutMode = cut.hand ? cut.mode + '+hand' : r.mode;
  cfg.cutAspect = r.aspect;                 // height / width, for the price
  outlineReady = true;
  useCustomShape();
}

/* ── the brush ── */
function paintAt(e) {
  const cv = $('#cutPrev'), rect = cv.getBoundingClientRect();
  const { k, ox, oy } = cutView();
  const px = ((e.clientX - rect.left) * cv.width / rect.width - ox) / k;
  const py = ((e.clientY - rect.top) * cv.height / rect.height - oy) / k;
  const W = cut.c.width, H = cut.c.height;
  const r = cut.size / k;                    // brush size is in preview pixels
  const val = cut.brush === 'keep' ? 1 : 0;
  const x0 = Math.max(0, Math.floor(px - r)), x1 = Math.min(W - 1, Math.ceil(px + r));
  const y0 = Math.max(0, Math.floor(py - r)), y1 = Math.min(H - 1, Math.ceil(py + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
    if ((x - px) ** 2 + (y - py) ** 2 <= r * r) cut.m[y * W + x] = val;
}
let painting = false, paintQueued = false;
$('#cutPrev')?.addEventListener('pointerdown', e => {
  if (!cut.hand || !cut.m) return;
  e.preventDefault();
  painting = true;
  remember();
  $('#cutPrev').setPointerCapture(e.pointerId);
  paintAt(e); drawCutPreview();
});
$('#cutPrev')?.addEventListener('pointermove', e => {
  if (!painting) return;
  paintAt(e);
  if (!paintQueued) { paintQueued = true; requestAnimationFrame(() => { paintQueued = false; drawCutPreview(); }); }
});
let justPainted = false;
const endPaint = () => {
  if (!painting) return;
  painting = false; justPainted = true; setTimeout(() => { justPainted = false; }, 0);
  finishAndApply();
};
$('#cutPrev')?.addEventListener('pointerup', endPaint);
$('#cutPrev')?.addEventListener('pointercancel', endPaint);

$$('#optBrush .opt').forEach(b => b.addEventListener('click', () => {
  cut.brush = b.dataset.key;
  $$('#optBrush .opt').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
}));
$('#cutBrush')?.addEventListener('input', e => { cut.size = +e.target.value; $('#cutBrushOut').textContent = e.target.value; });
/* undo / redo: a new edit clears what could be redone */
function undoState() {
  const u = $('#cutUndo'), r = $('#cutRedo');
  if (u) u.disabled = !cut.history.length;
  if (r) r.disabled = !cut.future.length;
}
function remember() {
  cut.history.push(cut.m.slice()); if (cut.history.length > 15) cut.history.shift();
  cut.future = []; undoState();
}
$('#cutUndo')?.addEventListener('click', () => {
  if (!cut.history.length) return;
  cut.future.push(cut.m); cut.m = cut.history.pop(); undoState(); finishAndApply();
});
$('#cutRedo')?.addEventListener('click', () => {
  if (!cut.future.length) return;
  cut.history.push(cut.m); cut.m = cut.future.pop(); undoState(); finishAndApply();
});
$('#cutRestart')?.addEventListener('click', () => {
  if (!cut.auto) return;
  remember(); cut.m = cut.auto.slice(); finishAndApply();
});

$('#cutInput')?.addEventListener('change', e => chooseCutFile(e.target.files[0]));
$('#cutDrop')?.addEventListener('dragover', e => { e.preventDefault(); });
$('#cutDrop')?.addEventListener('drop', e => { e.preventDefault(); chooseCutFile(e.dataTransfer.files[0]); });
$('#cutDrop')?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#cutInput').click(); } });
/* The box is a plain element, not a <label> for the file input: as a label,
   the end of every brush stroke counted as a click on it, opened the file
   chooser and threw the page to the top. It opens the chooser itself, and
   never while painting. */
$('#cutDrop')?.addEventListener('click', e => {
  if (justPainted || (cut.hand && e.target.id === 'cutPrev')) return;
  if (e.target.id === 'cutInput') return;
  $('#cutInput').click();
});
$$('#optCutMode .opt').forEach(b => b.addEventListener('click', () => setCutMode(b.dataset.key)));
$('#cutPrint')?.addEventListener('change', () => {
  drawCutPreview();
  if (cfg.shape === 'custom' && cfg.cutArt) { cfg.cutPrint = $('#cutPrint').checked; rebuild(); sync(); }
});

/* ───────────────────────── option tiles ───────────────────────── */

function tiles(hostSel, entries, onPick, render) {
  const host = $(hostSel);
  if (!host) return;
  host.replaceChildren();
  for (const [key, item] of entries) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.dataset.key = key;
    b.innerHTML = render(key, item);
    b.addEventListener('click', () => { onPick(key); markTiles(); sync(); });
    host.append(b);
  }
}

/* One place that re-reads state, so a preset lights up every group at once. */
const GROUPS = [
  ['#optOccasion',   () => cfg._occasion],
  ['#optShape',      () => cfg.shape],
  ['#optVersion',    () => groupOf(cfg.shape, cfg.variant)?.label],
  ['#optVariant',    () => String(cfg.variant)],
  ['#optMaterial',   () => cfg.material],
  ['#optSize',       () => cfg.size],
  ['#optBaseKind',   () => cfg.baseKind],
  ['#optBaseFinish', () => cfg.baseFinish],
  ['#optDecal',      () => cfg.decal],
  ['#optScheme',     () => cfg.scheme],
  ['#optFont',       () => cfg.font],
  ['#optLaminate',   () => cfg.laminate],
  ['#optMotif',      () => cfg.motif],
  ['#optPhotoTarget',() => cfg.photoTarget],
  ['#optPhotoFit',   () => cfg.photoFit],
  ['#optSpeed',      () => cfg.speed],
  ['#optZone',       () => cfg.zone],
  ['#optPayment',    () => cfg.payment],
];
function markTiles() {
  for (const [sel, get] of GROUPS) {
    const now = get();
    for (const b of $$(`${sel} .opt`)) b.setAttribute('aria-pressed', String(b.dataset.key === now));
  }
}

const custom = () => { cfg._occasion = null; };

/* Some cut shapes are offered in more than one pose. The row only appears when
   the chosen shape has any, and each tile draws ITS OWN pose rather than the
   one currently selected — hence the third argument to outlinePath. */
function poseTiles() {
  const row = $('#poseRow');
  const names = variantsOf(cfg.shape);
  if (!row) return;
  const vrow = $('#versionRow');
  const groups = groupsOf(cfg.shape);
  if (vrow) {
    vrow.hidden = !groups;
    if (groups) {
      /* Men / Women: switching keeps the same pose slot where the other
         group has one, so Spike stays a spike. */
      tiles('#optVersion', groups.map(g => [g.label, g]),
        k => {
          const from = groupOf(cfg.shape, cfg.variant), to = groups.find(g => g.label === k);
          const slot = Math.min(cfg.variant - from.from, to.to - to.from - 1);
          cfg.variant = to.from + slot; setVariant(cfg.shape, cfg.variant);
          poseTiles(); custom(); rebuild();
        },
        (k) => `<b>${k}</b>`);
    } else $('#optVersion')?.replaceChildren();
  }
  if (!names) { row.hidden = true; $('#optVariant')?.replaceChildren(); return; }
  row.hidden = false;
  const styled = isStyled(cfg.shape);
  if ($('#poseHead')) $('#poseHead').textContent = styled ? 'Style' : 'Pose';
  if ($('#notePose')) $('#notePose').textContent = styled
    ? 'Layered: gold accent pieces cut separately and set on the front. Classic: the plain cut.'
    : 'Same cut, different stance.';
  const g = groupOf(cfg.shape, cfg.variant);
  const idx = names.map((n, i) => i).filter(i => !g || (i >= g.from && i < g.to));
  tiles('#optVariant', idx.map(i => [String(i), { label: names[i], i }]),
    k => { cfg.variant = +k; cfg.place = null; setVariant(cfg.shape, +k); custom(); rebuild(); },
    (k, v) => {
      const d = outlinePath(cfg.shape, { x: 1, y: 3, w: 38, h: 39 }, v.i);
      return `<svg viewBox="0 0 40 50" aria-hidden="true"><path d="${d}" fill-rule="evenodd"/>` +
             `<rect x="5" y="44" width="30" height="4" rx="1"/></svg><b>${v.label}</b>`;
    });
  markTiles();
}

function buildTiles() {
  tiles('#optOccasion', Object.entries(OCCASIONS),
    k => applyOccasion(k),
    (k, v) => `<svg class="occ" viewBox="0 0 40 40" aria-hidden="true"><path d="${OCC_ICONS[k]}"/></svg><b>${v.label}</b><span>${v.hint}</span>`);

  // no "Your art" tile: the upload box under the tiles makes the cut shape
  tiles('#optShape', Object.entries(SHAPES).filter(([k]) => k !== 'custom'),
    k => {
      if (k === 'custom' && !outlineReady) {
        $('#cutDrop')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        $('#cutDrop')?.focus({ preventScroll: true });
        cutNote('Choose a picture below and we will cut the trophy to its shape.');
        return;
      }
      cfg.shape = k; cfg.variant = 0; cfg.place = null; setVariant(k, 0); poseTiles(); custom(); rebuild();
    },
    (k, v) => {
      const d = k === 'custom' ? (outlineReady && outlinePath(k, { x: 1, y: 3, w: 38, h: 39 }) || FIG_CUSTOM)
                             : outlinePath(k, { x: 1, y: 3, w: 38, h: 39 });
      return `<svg viewBox="0 0 40 50" aria-hidden="true"><path d="${d}" fill-rule="evenodd"/>` +
             `<rect x="5" y="44" width="30" height="4" rx="1"/></svg><b>${v.label}</b>`;
    });

  tiles('#optMaterial', Object.entries(MATERIALS),
    k => { cfg.material = k; custom(); rebuild(); },
    (k, v) => `<span class="sw" style="background:${materialSwatch(v)}"></span><b>${v.short}</b>`);

  tiles('#optSize', Object.entries(SIZES),
    k => { cfg.size = k; custom(); rebuild(); },
    (k, v) => `<b>${v.label}</b><span>${v.total} cm</span>`);

  tiles('#optBaseKind', Object.entries(BASES),
    k => { cfg.baseKind = k; custom(); rebuild(); },
    (k, v) => `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="${BASE_ICONS[k]}"/></svg><b>${v.label}</b><span>${v.hint}</span>`);

  tiles('#optBaseFinish', Object.entries(BASE_FINISHES),
    k => { cfg.baseFinish = k; custom(); rebuild(); },
    (k, v) => `<span class="sw" style="background:${finishSwatch(v)}"></span><b>${v.label}</b>`);

  tiles('#optDecal', Object.entries(DECALS),
    k => { cfg.decal = k; custom(); rebuild(); },
    (k, v) => `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="${DECAL_ICONS[k]}"/></svg><b>${v.label}</b>`);

  tiles('#optScheme', Object.entries(SCHEMES),
    k => { cfg.scheme = k; custom(); repaintSticker(); },
    (k, v) => `<span class="sw" style="background:${schemeSwatch(v)}"></span><b>${v.label}</b>`);

  tiles('#optFont', Object.entries(FONTS),
    k => { cfg.font = k; custom(); repaintSticker(); },
    (k, v) => `<span class="fp" data-font="${k}">Aa</span><b>${v.label}</b>`);

  tiles('#optLaminate', Object.entries(LAMINATES),
    k => { cfg.laminate = k; custom(); repaintSticker(); },
    (k, v) => `<b>${v.label}</b>`);

  tiles('#optMotif', Object.entries(MOTIFS),
    k => { cfg.motif = k; custom(); repaintSticker(); },
    (k, v) => k === 'none'
      ? `<svg viewBox="0 0 40 44" aria-hidden="true"></svg><b>None</b>`
      : `<svg viewBox="0 0 40 44" aria-hidden="true"><path d="${MOTIF_ICONS[k]}"/></svg><b>${v.label}</b>`);

  tiles('#optPhotoTarget', Object.entries(PHOTO_TARGETS),
    k => { cfg.photoTarget = k; rebuild(); },
    (k, v) => `<b>${v.label}</b><span>${v.hint}</span>`);

  tiles('#optPhotoFit', Object.entries(PHOTO_FITS),
    k => { cfg.photoFit = k; repaintSticker(); },
    (k, v) => `<b>${v.label}</b>`);

  tiles('#optSpeed', Object.entries(SPEEDS),
    k => { cfg.speed = k; },
    (k, v) => `<b>${v.label}</b><span>${v.hint}</span>`);

  tiles('#optZone', Object.entries(ZONES),
    k => { cfg.zone = k; },
    (k, v) => `<b>${v.label}</b><span>${v.hint}</span>`);

  tiles('#optPayment', Object.entries(PAYMENTS),
    k => { cfg.payment = k; },
    (k, v) => `<b>${v.label}</b>`);
}

function applyOccasion(key) {
  const o = OCCASIONS[key];
  if (!o) return;
  Object.assign(cfg, o.cfg);
  cfg._occasion = key;
  cfg.variant = cfg.variant || 0;
  setVariant(cfg.shape, cfg.variant);
  poseTiles();
  for (const [id, prop] of Object.entries(TEXT_FIELDS)) {
    const el = $('#' + id);
    if (el) { el.value = cfg[prop] ?? ''; countField(id); }
  }
  rebuild();
}

/* ───────────────────────── dropped photo ───────────────────────── */

/* The file is read in the browser with an object URL and drawn straight
   onto the sticker canvas. Nothing is uploaded anywhere. */
let photoUrl = null;
let outlineReady = false;

function photoNote(text, bad = false) {
  const el = $('#photoMsg');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'drop__msg' + (bad ? ' bad' : '');
}

function clearPhoto() {
  if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = null; }
  cfg.photoImg = null;
  $('#dropZone')?.classList.remove('has');
  const prev = $('#photoPrev');
  if (prev) { prev.removeAttribute('src'); prev.hidden = true; }
  const opts = $('#photoOpts');
  if (opts) opts.hidden = true;
  photoNote('');
  if (cfg.photoTarget === 'figure') rebuild(); else repaintSticker();
  sync();
}

/* An SVG can do something a photo cannot: give us the outline to cut to.
   Pull the path data out and hand it to the model, so "Your art" becomes a
   real cut shape. Arcs (A) and smooth curves (S/T) are not read — flatten
   those to lines or cubics before exporting. */
async function readOutline(file) {
  if (file.type !== 'image/svg+xml') return false;
  try {
    const text = await file.text();
    const ds = [...text.matchAll(/<path[^>]*\sd="([^"]+)"/gi)].map(m => m[1]);
    if (!ds.length) return false;
    if (/[AaSsTt]/.test(ds.join(' '))) {
      photoNote('That SVG uses arcs or smooth curves, which we cannot read. Flatten them and re-export.', true);
      return false;
    }
    setCustomOutline(ds.join(' '));
    return true;
  } catch { return false; }
}

function loadPhoto(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) return photoNote('That needs to be an image file.', true);
  if (file.size > 8 * 1024 * 1024) return photoNote('Too large — keep it under 8 MB.', true);

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = url;
    cfg.photoImg = img;
    const prev = $('#photoPrev');
    if (prev) { prev.src = url; prev.hidden = false; }
    $('#dropZone')?.classList.add('has');
    const opts = $('#photoOpts');
    if (opts) opts.hidden = false;
    const small = img.naturalWidth < 600;
    photoNote(`${img.naturalWidth} × ${img.naturalHeight} px${small ? ' — a bit small, it may print soft.' : ''}`, small);
    if (cfg.photoTarget === 'figure') rebuild(); else repaintSticker();
    sync();
  };
  img.onerror = () => { URL.revokeObjectURL(url); photoNote('Could not read that image.', true); };
  img.src = url;
}

function wirePhoto() {
  const zone = $('#dropZone'), input = $('#photoInput');
  if (!zone || !input) return;

  zone.addEventListener('click', e => {
    if (e.target.closest('[data-act="clear"]')) return;
    input.click();
  });
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => { loadPhoto(input.files?.[0]); input.value = ''; });

  for (const ev of ['dragenter', 'dragover']) {
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('over'); });
  }
  for (const ev of ['dragleave', 'dragend']) {
    zone.addEventListener(ev, () => zone.classList.remove('over'));
  }
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('over');
    loadPhoto(e.dataTransfer?.files?.[0]);
  });

  $('#photoClear')?.addEventListener('click', e => { e.stopPropagation(); clearPhoto(); });
}

/* ───────────────────────── text fields ───────────────────────── */

function countField(id) {
  const el = $('#' + id), counter = $(`[data-count="${id}"]`);
  if (!el || !counter) return;
  const max = Number(el.getAttribute('maxlength')) || 40;
  counter.textContent = `${el.value.length}/${max}`;
  counter.classList.toggle('over', el.value.length >= max);
}

let textTimer = 0;
function bindText(id, key) {
  const el = $('#' + id);
  if (!el) return;
  el.addEventListener('input', () => {
    cfg[key] = el.value;
    custom();
    countField(id);
    clearTimeout(textTimer);
    textTimer = setTimeout(() => { repaintSticker(); markTiles(); sync(); }, 140);
  });
  cfg[key] = el.value;
  countField(id);
}

/* ───────────────────────── quantity ───────────────────────── */

function buildTiers() {
  const host = $('#tiers');
  if (!host) return;
  host.replaceChildren();
  for (const t of [...QTY_TIERS].reverse()) {
    const row = document.createElement('div');
    row.dataset.min = String(t.min);
    row.innerHTML = `<span>${t.label} pieces</span><span>${t.mult === 1 ? 'standard' : `−${Math.round((1 - t.mult) * 100)}%`}</span>`;
    host.append(row);
  }
}

function setQty(n) {
  cfg.qty = Math.max(1, Math.min(2000, Math.floor(n) || 1));
  const el = $('#fQty');
  if (el && Number(el.value) !== cfg.qty) el.value = cfg.qty;
  sync();
}

/* ───────────────────────── sync ───────────────────────── */

function sync() {
  const shape = SHAPES[cfg.shape], mat = MATERIALS[cfg.material], size = SIZES[cfg.size];
  const q = quote(cfg);
  const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };

  set('vOccasion', cfg._occasion ? OCCASIONS[cfg._occasion].label : 'Custom');
  const pose = variantsOf(cfg.shape);
  const grp = groupOf(cfg.shape, cfg.variant);
  set('vShape', shape.label + (grp ? ' · ' + grp.label : '') + (pose ? ' · ' + pose[cfg.variant] : ''));
  set('vMaterial', mat.label);
  set('vSize', `${size.label} · ${size.total} cm`);
  set('vBase', `${BASES[cfg.baseKind].label} · ${BASE_FINISHES[cfg.baseFinish].label}`);
  set('vSticker', `${DECALS[cfg.decal].label} · ${SCHEMES[cfg.scheme].label} · ${FONTS[cfg.font].label}`);
  set('noteShape', shape.note);
  set('noteMaterial', mat.note);
  set('noteBase', BASES[cfg.baseKind].note);
  set('noteFont', FONTS[cfg.font].note);
  set('noteLaminate', LAMINATES[cfg.laminate].note);
  set('noteSpeed', q.speed.note);

  // the figures carry their name plate on the base; the body stays bare
  // acrylic unless the customer gives us artwork for it
  const onBase = !!shape.decal.onBase;
  set('stickerWhere', onBase
    ? 'This is a cut figure, so the name plate goes on the base. Drop in an image below and you can print it over the figure itself.'
    : 'The sticker is applied to the front face of the acrylic.');

  const tgtBlock = $('#photoTargetBlock');
  if (tgtBlock) tgtBlock.hidden = !onBase;
  const fitBlock = $('#photoFitBlock');
  if (fitBlock) fitBlock.hidden = onBase && cfg.photoTarget === 'figure';
  if (!onBase && cfg.photoTarget === 'figure') cfg.photoTarget = 'sticker';

  const lines = ['org', 'title', 'name', 'date'].filter(k => (cfg[k] || '').trim()).length;
  set('vWording', lines ? `${lines} line${lines > 1 ? 's' : ''}` : 'Blank');
  set('vQty', `${cfg.qty} piece${cfg.qty > 1 ? 's' : ''}`);
  set('vDelivery', `${q.speed.label} · ${q.zone.label}`);

  set('dzBadge', `${mat.short} · ${shape.label} · ${size.label}`);
  set('dzDims', `${size.total} × ${(size.w * 2).toFixed(1)} cm · ${(size.t * 10).toFixed(0)} mm sheet`);

  set('tMakeLbl', `Trophies — ${peso(q.unit)} × ${q.qty}`);
  set('tMake', peso(q.make));
  $('#tRushRow').hidden = q.rushAdj === 0;
  set('tRushLbl', q.rushAdj > 0 ? `Rush (+${q.rushAdj}%)` : `Economy (${q.rushAdj}%)`);
  set('tRush', 'in the unit price');
  $('#tSetupRow').hidden = !q.setup;
  set('tSetup', peso(q.setup));
  $('#tShipRow').hidden = !q.shipping && cfg.zone === 'pickup';
  set('tShipLbl', `Shipping — ${q.zone.label}`);
  set('tShip', q.shipping ? peso(q.shipping) : 'Free');
  $('#tFeeRow').hidden = !q.payFee;
  set('tFee', peso(q.payFee));
  set('tTotal', peso(q.total));

  set('tArrive', fmtDate(q.arrival));
  set('tDays', `${q.days} working days from approval`);
  checkNeedBy(q);

  for (const row of $$('#tiers div')) row.classList.toggle('on', Number(row.dataset.min) === q.tier.min);
}

function checkNeedBy(q) {
  const el = $('#fNeed'), out = $('#needMsg');
  if (!el || !out) return;
  cfg.needBy = el.value;
  if (!el.value) { out.textContent = ''; out.className = 'need__msg'; return; }

  const want = new Date(el.value + 'T23:59:59');
  if (Number.isNaN(want.getTime())) { out.textContent = ''; return; }

  if (want >= q.arrival) {
    const slack = Math.round((want - q.arrival) / 86400000);
    out.textContent = slack > 0
      ? `Comfortable — that is ${slack} day${slack > 1 ? 's' : ''} of slack.`
      : 'That lands exactly on your date. Consider Rush for a margin.';
    out.className = 'need__msg ok';
  } else {
    const short = Math.ceil((q.arrival - want) / 86400000);
    const fix = cfg.speed === 'rush'
      ? 'Even Rush will not make it — talk to us before ordering.'
      : 'Try Rush, or collect from the studio to save the courier days.';
    out.textContent = `${short} day${short > 1 ? 's' : ''} short of your date. ${fix}`;
    out.className = 'need__msg bad';
  }
}

/* ───────────────────────── actions ───────────────────────── */

function specText() {
  const shape = SHAPES[cfg.shape], mat = MATERIALS[cfg.material], size = SIZES[cfg.size];
  const q = quote(cfg);
  const r = (k, v) => `${k.padEnd(16)}${v}`;
  return [
    'TROPHY DESIGN — built on the website',
    '',
    r('Occasion', cfg._occasion ? OCCASIONS[cfg._occasion].label : 'Custom'),
    r('Cut shape', shape.label + (groupOf(cfg.shape, cfg.variant) ? ' — ' + groupOf(cfg.shape, cfg.variant).label : '') +
        (variantsOf(cfg.shape) ? ' — ' + variantsOf(cfg.shape)[cfg.variant] + (isStyled(cfg.shape) ? ' style' : ' pose') : '')),
    r('Sheet', `${mat.label}, ${(size.t * 10).toFixed(0)} mm`),
    r('Size', `${size.label} — ${size.total} cm tall, ${(size.w * 2).toFixed(1)} cm wide`),
    r('Base', `${BASES[cfg.baseKind].label}, ${BASE_FINISHES[cfg.baseFinish].label}`),
    '',
    'PRINTED STICKER',
    r('  Position', shape.decal.onBase ? 'On the base front'
      : cfg.place ? `On the acrylic face, placed by the customer: ${Math.round(cfg.place.x * 100)}% from centre, `
        + `${Math.round(cfg.place.y * 100)}% up, size ${Math.round(cfg.place.s * 100)}%, `
        + `turned ${Math.round(cfg.place.r * 180 / Math.PI)}°`
      : 'On the acrylic face'),
    r('  Cut shape', DECALS[cfg.decal].label),
    r('  Colours', SCHEMES[cfg.scheme].label),
    r('  Font', FONTS[cfg.font].label),
    r('  Laminate', LAMINATES[cfg.laminate].label),
    r('  Motif', MOTIFS[cfg.motif]?.label ?? 'None'),
    cfg.shape === 'custom' && cfg.cutArt ? r('  Your art', `Cut from the customer's picture (`
      + `${{ alpha: 'transparent PNG', plain: 'plain background removed', photo: 'photo background removed' }[(cfg.cutMode || '').replace('+hand', '')] || 'background removed'}`
      + `${(cfg.cutMode || '').includes('+hand') ? ', then edited by hand' : ''}), `
      + (cfg.cutPrint ? 'picture printed on the cut piece' : 'bare acrylic') + '. Please send the original file.') : null,
    shape.decal.onBase ? r('  Figure', cfg.photoImg && cfg.photoTarget === 'figure'
        ? 'customer image printed over the whole cut shape'
        : 'bare acrylic') : null,
    cfg.photoImg ? r('  Photo', cfg.photoTarget === 'figure'
        ? 'customer supplied, printed over the figure — TO BE SENT'
        : `customer supplied, ${PHOTO_FITS[cfg.photoFit].label.toLowerCase()} — TO BE SENT`) : null,
    r('  Extra sticker', cfg.extraSticker ? 'Yes' : 'No'),
    r('  Logo', cfg.logo ? 'Yes — artwork to follow' : 'No'),
    '',
    'WORDING',
    r('  Line 1', cfg.org || '(blank)'),
    r('  Line 2', cfg.title || '(blank)'),
    r('  Line 3', cfg.name || '(blank)'),
    r('  Line 4', cfg.date || '(blank)'),
    '',
    'ORDER',
    r('Quantity', String(cfg.qty)),
    r('Turnaround', `${q.speed.label} — ${q.speed.hint}`),
    r('Delivery', q.zone.label),
    r('Payment', q.pay.label),
    cfg.needBy ? r('Needed by', cfg.needBy) : null,
    '',
    r('Unit', peso(q.unit)),
    r('Trophies', peso(q.make)),
    q.setup ? r('Artwork setup', peso(q.setup)) : null,
    q.shipping ? r('Shipping', peso(q.shipping)) : null,
    q.payFee ? r('Payment fee', peso(q.payFee)) : null,
    r('ESTIMATED TOTAL', peso(q.total)),
    r('Est. arrival', `${fmtDate(q.arrival)} (${q.days} working days)`),
    '',
    cfg.photoImg ? 'NOTE: the photo is only on my own screen — please tell me where to send the file.' : null,
    'Please confirm the price and send a proof.',
  ].filter(Boolean).join('\n');
}

function saveImage() {
  if (!viewer) return;
  try {
    viewer.renderNow();
    const a = document.createElement('a');
    a.href = viewer.renderer.domElement.toDataURL('image/png');
    a.download = `tala-trophy-${cfg.shape}-${cfg.material}-${cfg.size}.png`;
    document.body.append(a); a.click(); a.remove();
  } catch (err) {
    console.warn('[tala] could not save the preview:', err);
  }
}

/* The machine-readable spec, saved with a request so the shop can rebuild the
   exact piece; the customer's photo and cut-out picture are never included. */
function designSpec() {
  const design = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (k.startsWith('_') || k === 'photoImg' || v == null || typeof v === 'object') continue;
    design[k] = v;
  }
  return design;
}

function sendToStudio() {
  try {
    const design = designSpec();
    sessionStorage.setItem('tala.spec', JSON.stringify({ text: specText(), qty: cfg.qty, item: 'Trophy', design }));
  } catch { /* private mode — the quote form still opens, just empty */ }
  location.href = './#quote';
}

/* ───────────────────────── guided tour ───────────────────────── */

const TOUR = [
  { sel: '#stepOccasion', title: 'Start from the occasion',
    body: 'Pick what the award is for and we set a sensible shape, colour, base and sticker in one go. Everything stays editable afterwards.' },
  { sel: '#stepShape', title: 'Choose the cut shape',
    body: 'All of these are cut from flat acrylic sheet, in one solid piece. Lady and Gentleman are the pageant figures — their name plate goes on the base, and the figure itself stays bare acrylic unless you give us artwork for it.' },
  { sel: '#stepMaterial', title: 'Pick the sheet colour',
    body: 'Thin cast acrylic, 5 to 8 mm depending on size. Solid colours all cost the same; clear and mirrored cost a little more.' },
  { sel: '#stepBase', title: 'Then the base',
    body: 'The gold bar is shaped wood. The octagon and utility boxes are PVC electrical boxes we spray — cheap, light, and they look far better than they sound.' },
  { sel: '#stepSticker', title: 'Design the sticker',
    body: 'This is the part we print. Full colour, so team and school colours are free. Drop in a photo or logo and — on the Lady and Gentleman shapes — you can print it over the whole cut figure. Your file stays on your own computer.' },
  { sel: '#stepWording', title: 'Type the real wording',
    body: 'Not placeholder text — the actual names. Watch the counters: when text shrinks to fit, that is a warning you are past a comfortable length.' },
  { sel: '#stepDelivery', title: 'Set your date and payment',
    body: 'Rush, Standard or Economy changes both the price and the arrival date. Enter the date you need them and we will tell you straight away if it will not make it.' },
  { sel: '#dzViz', title: 'Check it from every angle',
    body: 'Drag to turn, scroll to zoom, arrow keys work too. Save the image for your approvers, then send the spec to us for a free proof.' },
];

function startTour() {
  let i = 0;
  const hi = document.createElement('div'); hi.className = 'tour-hi';
  const tip = document.createElement('div'); tip.className = 'tour-tip';
  tip.setAttribute('role', 'dialog');
  tip.setAttribute('aria-label', 'Designer walkthrough');
  document.body.append(hi, tip);
  document.body.classList.add('tour-on');

  const done = () => {
    hi.remove(); tip.remove();
    document.body.classList.remove('tour-on');
    removeEventListener('keydown', onKey);
    removeEventListener('resize', place);
    removeEventListener('scroll', place);
    $('#dzTour')?.focus();
  };

  function place() {
    const el = $(TOUR[i].sel);
    if (!el) return;
    const r = el.getBoundingClientRect(), pad = 6;
    hi.style.cssText = `top:${r.top - pad}px;left:${r.left - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
    const below = r.bottom + 16;
    const fits = below + 200 < innerHeight;
    tip.style.top = (fits ? below : Math.max(16, r.top - 216)) + 'px';
    tip.style.left = Math.min(innerWidth - 312, Math.max(16, r.left)) + 'px';
  }

  function show() {
    const step = TOUR[i], el = $(step.sel);
    if (el?.tagName === 'DETAILS') el.open = true;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    tip.innerHTML = `<b></b><p></p>
      <div class="tour-tip__f">
        <span class="tour-tip__n">${i + 1} of ${TOUR.length}</span>
        <button class="btn btn--line btn--sm" data-act="back"${i ? '' : ' disabled'}>Back</button>
        <button class="btn btn--solid btn--sm" data-act="next">${i === TOUR.length - 1 ? 'Done' : 'Next'}</button>
      </div>`;
    tip.querySelector('b').textContent = step.title;
    tip.querySelector('p').textContent = step.body;
    tip.querySelector('[data-act="back"]').addEventListener('click', () => { if (i) { i--; show(); } });
    tip.querySelector('[data-act="next"]').addEventListener('click', () => {
      if (i === TOUR.length - 1) return done();
      i++; show();
    });
    setTimeout(place, 340);
    place();
  }

  const onKey = e => {
    if (e.key === 'Escape') done();
    else if (e.key === 'ArrowRight' && i < TOUR.length - 1) { i++; show(); }
    else if (e.key === 'ArrowLeft' && i) { i--; show(); }
  };
  addEventListener('keydown', onKey);
  addEventListener('resize', place);
  addEventListener('scroll', place, { passive: true });
  show();
}

/* ───────────────────────── Admin Deck hand-off ─────────────────────────
   admin.html opens design.html?admin=1 to design a shop trophy, with
   &from=<design> to start from the trophy's current one. The stage bar then
   gets "Use in the Admin Deck", which hands the design back through
   localStorage (the deck's tab hears the storage event) and closes the tab. */
const adminQ = new URLSearchParams(location.search);
const ADMIN_MODE = adminQ.get('admin') === '1';
if (ADMIN_MODE) {
  try {
    const from = JSON.parse(adminQ.get('from') || 'null');
    if (from && typeof from === 'object' && SHAPES[from.shape] && from.shape !== 'custom') {
      for (const [k, v] of Object.entries(from)) if (k in cfg && (v === null || typeof v !== 'object')) cfg[k] = v;
      cfg._occasion = null;
      cfg.variant = cfg.variant || 0;
      setVariant(cfg.shape, cfg.variant);
      for (const [id, prop] of Object.entries(TEXT_FIELDS)) { const el = $('#' + id); if (el) el.value = cfg[prop] ?? ''; }
    }
  } catch { /* a bad link just opens the default design */ }
  const bar = $('.stage__bar');
  const use = document.createElement('button');
  use.type = 'button'; use.className = 'btn btn--solid btn--sm'; use.id = 'dzAdmin';
  use.textContent = 'Use in the Admin Deck';
  bar?.prepend(use);
  use.addEventListener('click', () => {
    if (cfg.shape === 'custom') { use.textContent = 'Pick a cut shape first — a picture cut cannot go in the shop'; return; }
    const design = designSpec();
    for (const k of ['qty', 'speed', 'zone', 'payment', 'needBy', 'logo', 'extraSticker', 'cutPrint', 'cutMode', 'cutAspect', 'photoFit', 'photoTarget']) delete design[k];
    try { localStorage.setItem('tala.admin.design', JSON.stringify(design)); }
    catch { use.textContent = 'This browser blocked the hand-off'; return; }
    use.textContent = 'Sent ✓ — back to the Admin Deck';
    setTimeout(() => window.close(), 700);
  });
}

/* ───────────────────────── wire up ───────────────────────── */

buildTiles();
poseTiles();
buildTiers();
wirePhoto();
for (const [id, key] of Object.entries(TEXT_FIELDS)) bindText(id, key);

$('#fExtraSticker')?.addEventListener('change', e => { cfg.extraSticker = e.target.checked; sync(); });
$('#fLogo')?.addEventListener('change', e => { cfg.logo = e.target.checked; sync(); });

$('#fQty')?.addEventListener('input', e => setQty(e.target.value));
$('#qtyUp')?.addEventListener('click', () => setQty(cfg.qty + 1));
$('#qtyDown')?.addEventListener('click', () => setQty(cfg.qty - 1));
$('#fNeed')?.addEventListener('change', () => sync());
$('#fNeed')?.addEventListener('input', () => sync());

$('#dzReset')?.addEventListener('click', () => viewer?.reset());
$('#dzSave')?.addEventListener('click', saveImage);
$('#dzSend')?.addEventListener('click', sendToStudio);
$('#dzTour')?.addEventListener('click', startTour);

const need = $('#fNeed');
if (need) {
  const t = new Date();
  need.min = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

markTiles();
sync();
boot3D().catch(err => {
  console.warn('[tala] designer 3D failed:', err);
  showViewerError('The 3D preview could not load. Everything else here still works — send us the wording and we will proof it for you.');
});
