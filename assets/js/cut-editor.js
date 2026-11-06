/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — the Admin Deck's picture cutter, for a shop trophy made
   from a picture. The owner, 6 Nov 2026: a drop box under "Make it from a
   picture"; the base a photographed trophy stands on cut off ("analyze the
   picture and only cut the cut shape ... not the base", since the site gives
   every trophy its own); editing "what to keep and erase like the one from
   the design your own trophy"; and "a scale bar for zooming".

   cutout.js takes the background off (its mask: 1 = keep) and finds the
   base. Here the mask is trimmed at the base line, painted by hand, and cut
   again (finishCut) after every change; the cut goes back through onCut.
   ══════════════════════════════════════════════════════════════ */
import { readImage, autoMask, maskPlain, finishCut, findBase, fillHoles } from './cutout.js?v=202611070056';

const TYPES = /^image\/(png|jpeg|webp)$/;
const MAX_MB = 10;
const ZOOM_MAX = 8;
const HISTORY = 15;
const UPLOAD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';

/* -> { choose, clear, destroy }. o: { heightCm() the cut piece's height,
   say(text), onPicture(file) when one is taken in, onCut(result, { img, c })
   after every cut } */
export function mountCutEditor(box, o) {
  box.innerHTML = `
    <div class="cutx__drop" tabindex="0" role="button" aria-label="Choose a picture to make the trophy from">
      <input type="file" accept="image/png,image/jpeg,image/webp" hidden>
      <canvas class="cutx__cv" width="720" height="720" data-tool="move" hidden></canvas>
      <span class="cutx__hint">${UPLOAD}<b>Drop a picture here</b><span>or click to browse · JPG, PNG or WebP · up to ${MAX_MB} MB</span></span>
    </div>
    <div class="cutx__tools" hidden>
      <div class="cutx__row"><span>Zoom</span>
        <button type="button" class="cutx__step" data-zoom="out" aria-label="Zoom out">−</button>
        <input type="range" class="cutx__zoom" min="1" max="${ZOOM_MAX}" step="any" value="1" aria-label="Zoom">
        <button type="button" class="cutx__step" data-zoom="in" aria-label="Zoom in">+</button>
        <output class="cutx__out" data-out="zoom">100%</output>
        <button type="button" class="btn btn--line btn--sm" data-zoom="fit">Fit</button></div>
      <div class="cutx__row"><span>Base</span>
        <input type="range" class="cutx__base" min="0" max="50" step="1" value="0" aria-label="How much of the bottom of the picture to cut off">
        <output class="cutx__out cutx__out--wide" data-out="base">none cut off</output></div>
      <div class="cutx__tool" role="group" aria-label="What dragging on the picture does">
        <button type="button" data-tool="move" aria-pressed="true"><b>Move</b><span>Drag the picture</span></button>
        <button type="button" data-tool="erase" aria-pressed="false"><b>Erase</b><span>Cut a part away</span></button>
        <button type="button" data-tool="keep" aria-pressed="false"><b>Keep</b><span>Bring a part back</span></button></div>
      <div class="cutx__row"><span>Brush</span>
        <input type="range" class="cutx__size" min="4" max="60" value="18" aria-label="Brush size">
        <output class="cutx__out" data-out="size">18</output></div>
      <div class="cutx__btns">
        <button type="button" class="btn btn--line btn--sm" data-act="undo" disabled>Undo</button>
        <button type="button" class="btn btn--line btn--sm" data-act="redo" disabled>Redo</button>
        <button type="button" class="btn btn--line btn--sm" data-act="fill">Fill holes</button>
        <button type="button" class="btn btn--line btn--sm" data-act="restart">Start over</button>
        <button type="button" class="btn btn--line btn--sm" data-act="another">Another picture</button></div>
      <p class="cutx__note">Faded parts are cut away. Below the red line is the base in the picture: it is cut off too, since the trophy gets its own base.</p>
    </div>`;
  const q = s => box.querySelector(s);
  const drop = q('.cutx__drop'), input = q('input[type=file]'), cv = q('.cutx__cv'), tools = q('.cutx__tools');
  const zoomIn = q('.cutx__zoom'), baseIn = q('.cutx__base'), sizeIn = q('.cutx__size');
  const out = k => q(`[data-out="${k}"]`);
  const S = cv.width;
  /* m: the mask as it stands -- the automatic one for the base line (autoAt), with
     the hand edits (edits: 1 keep, -1 erase) over it, so moving the line keeps them */
  const st = { img: null, url: null, c: null, m: null, auto: null, autoRow: null, autoAtRow: null, edits: null, mode: null,
               top: 0, foot: 0, base: 0, base0: 0, r: null,
               zoom: 1, cx: 0, cy: 0, tool: 'move', size: 18, history: [], future: [], token: 0 };
  let painting = false, dragging = null, queued = false, fade = null;

  /* where the picture sits in the frame: fitted, times the zoom, round the point in view */
  function view() {
    const W = st.c.width, H = st.c.height, k = Math.min((S - 16) / W, (S - 16) / H) * st.zoom;
    const keep = (v, n) => (n * k <= S ? n / 2 : Math.min(n - S / 2 / k, Math.max(S / 2 / k, v)));
    st.cx = keep(st.cx, W); st.cy = keep(st.cy, H);
    return { k, ox: S / 2 - st.cx * k, oy: S / 2 - st.cy * k, W, H };
  }
  // the base line: rows from here down are the base in the picture
  const cutRow = () => st.foot + 1 - Math.round(st.base / 100 * (st.foot - st.top + 1));
  const kept = () => { const m = st.m.slice(); m.fill(0, Math.max(0, cutRow() * st.c.width)); return m; };
  /* the automatic mask with the base cut off at `row`. On a plain background the
     flood runs again with the base as background, so the gap it closed in (between
     a star's points, above the block) opens up instead of staying in the piece. */
  function autoAt(row) {
    if (st.mode !== 'plain' || row > st.foot) return st.auto;
    if (st.autoRow !== row) { st.autoRow = row; st.autoAtRow = maskPlain(st.c, 38, row); }
    return st.autoAtRow;
  }
  function rebuild() {
    const a = autoAt(cutRow()), e = st.edits;
    st.m = a.slice();
    for (let i = 0; i < e.length; i++) if (e[i]) st.m[i] = e[i] > 0 ? 1 : 0;
  }

  function draw() {
    if (!st.c) return;
    const g = cv.getContext('2d'), { k, ox, oy, W, H } = view(), r = st.r;
    g.clearRect(0, 0, S, S);
    let path = null;
    if (r) {
      const s = r.art.height * k / 300;
      path = new Path2D();
      for (const ring of r.d.split('Z')) {
        const pts = [...ring.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(p => [ox + r.x0 * k + +p[1] * s, oy + r.y0 * k + +p[2] * s]);
        if (!pts.length) continue;
        path.moveTo(...pts[0]); for (const p of pts.slice(1)) path.lineTo(...p); path.closePath();
      }
    }
    if (painting || !path) {
      // mid-stroke: the paint itself, so the brush answers at once
      fade ||= document.createElement('canvas');
      if (fade.width !== W || fade.height !== H) { fade.width = W; fade.height = H; }
      const fx = fade.getContext('2d', { willReadFrequently: true });
      fx.clearRect(0, 0, W, H);
      fx.drawImage(st.c, 0, 0);
      const id = fx.getImageData(0, 0, W, H), m = st.m, from = cutRow() * W;
      for (let i = 0; i < m.length; i++) if (!m[i] || i >= from) id.data[i * 4 + 3] = 55;
      fx.putImageData(id, 0, 0);
      g.drawImage(fade, ox, oy, W * k, H * k);
    } else {
      // after it: what will really be cut -- small holes filled, thin parts thickened
      g.globalAlpha = 0.22; g.drawImage(st.c, ox, oy, W * k, H * k); g.globalAlpha = 1;
      g.save(); g.clip(path, 'evenodd'); g.drawImage(st.c, ox, oy, W * k, H * k); g.restore();
    }
    if (path && !painting) { g.lineWidth = 2; g.strokeStyle = '#c0392b'; g.setLineDash([6, 4]); g.stroke(path); g.setLineDash([]); }
    if (st.base > 0) {
      const y = oy + cutRow() * k;
      g.fillStyle = 'rgba(192,57,43,.10)';
      g.fillRect(ox, y, W * k, oy + (st.foot + 1) * k - y);
      g.strokeStyle = '#c0392b'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(ox, y); g.lineTo(ox + W * k, y); g.stroke();
    }
  }
  const redraw = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; draw(); }); } };

  function apply(note) {
    if (!st.c) return;
    try {
      st.r = finishCut(st.c, kept(), st.mode, { detail: 0, heightCm: o.heightCm() });
      draw();
      if (note) o.say(note);
      o.onCut(st.r, st);
    } catch (err) {
      st.r = null; draw();
      o.say(err.message || 'Nothing would be left to cut. Undo, or bring some of it back with Keep.');
    }
  }

  async function load(file) {
    if (!file) return;
    if (!TYPES.test(file.type)) { o.say('That needs to be a JPG, PNG or WebP picture.'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { o.say(`Too large: keep it under ${MAX_MB} MB.`); return; }
    const token = ++st.token;
    o.say('Reading your picture…');
    try {
      const { img, url } = await readImage(file);
      const { c, m, mode } = await autoMask(img, 'auto', t => { if (token === st.token) o.say(t); });
      if (token !== st.token) { URL.revokeObjectURL(url); return; }
      if (st.url) URL.revokeObjectURL(st.url);
      const b = findBase(m, c.width, c.height, mode === 'plain' ? c : null);
      Object.assign(st, { img, url, c, auto: m, autoRow: null, autoAtRow: null, edits: new Int8Array(m.length), mode, r: null,
        history: [], future: [], top: b ? b.top : 0, foot: b ? b.foot : c.height - 1, cx: c.width / 2, cy: c.height / 2 });
      // kept exact (the bar shows it rounded): a row short and the base's top edge would stay in
      st.base0 = st.base = b?.cut != null ? (b.foot + 1 - b.cut) / (b.foot - b.top + 1) * 100 : 0;
      baseIn.value = st.base; showBase();
      rebuild();
      cv.hidden = false; q('.cutx__hint').hidden = true; tools.hidden = false; drop.classList.add('has');
      undoState(); setZoom(1);
      o.onPicture?.(file);
      apply(st.base0
        ? 'Cut out, and the base in the picture cut off below the red line. Move the Base bar to change where it is cut.'
        : 'Cut out. Nothing at the bottom of the cut looks like a base: if one is still in it, move the Base bar to cut it off.');
    } catch (err) {
      console.warn('[tala] picture cut-out:', err);
      if (token === st.token) o.say(err.message || 'That picture could not be cut. Try another one.');
    }
  }

  /* ── the picture: pick, drop ── */
  drop.addEventListener('click', e => { if (!st.c && e.target !== input) input.click(); });
  drop.addEventListener('keydown', e => { if (!st.c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); input.click(); } });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); load(e.dataTransfer?.files?.[0]); });
  input.addEventListener('change', () => { load(input.files?.[0]); input.value = ''; });

  /* ── zoom ── */
  function setZoom(z) {
    st.zoom = Math.min(ZOOM_MAX, Math.max(1, z));
    zoomIn.value = st.zoom;
    out('zoom').textContent = `${Math.round(st.zoom * 100)}%`;
    draw();
  }
  zoomIn.addEventListener('input', () => setZoom(+zoomIn.value));
  box.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => {
    if (!st.c) return;
    if (b.dataset.zoom === 'fit') { st.cx = st.c.width / 2; st.cy = st.c.height / 2; setZoom(1); }
    else setZoom(st.zoom * (b.dataset.zoom === 'in' ? 1.25 : 0.8));
  }));

  /* ── the base line ── */
  function showBase() { out('base').textContent = st.base ? `bottom ${Math.round(st.base)}% cut off` : 'none cut off'; }
  baseIn.addEventListener('input', () => { st.base = +baseIn.value; showBase(); redraw(); });
  baseIn.addEventListener('change', () => { rebuild(); apply(); });

  /* ── move, erase, keep ── */
  box.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
    st.tool = cv.dataset.tool = b.dataset.tool;
    box.querySelectorAll('[data-tool]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  sizeIn.addEventListener('input', () => { st.size = +sizeIn.value; out('size').textContent = sizeIn.value; });
  let last = null;                              // the stroke's previous point: the brush runs along the line between
  function paint(e) {
    const rect = cv.getBoundingClientRect(), { k, ox, oy, W, H } = view();
    const px = ((e.clientX - rect.left) * S / rect.width - ox) / k, py = ((e.clientY - rect.top) * S / rect.height - oy) / k;
    const rad = st.size / k, v = st.tool === 'keep' ? 1 : 0;       // the brush is the same size on screen at any zoom
    const from = last || [px, py], steps = Math.max(1, Math.ceil(Math.hypot(px - from[0], py - from[1]) / Math.max(1, rad / 2)));
    for (let s = 1; s <= steps; s++) {
      const x = from[0] + (px - from[0]) * s / steps, y = from[1] + (py - from[1]) * s / steps;
      const x0 = Math.max(0, Math.floor(x - rad)), x1 = Math.min(W - 1, Math.ceil(x + rad));
      const y0 = Math.max(0, Math.floor(y - rad)), y1 = Math.min(H - 1, Math.ceil(y + rad));
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++)
        if ((xx - x) ** 2 + (yy - y) ** 2 <= rad * rad) { st.m[yy * W + xx] = v; st.edits[yy * W + xx] = v ? 1 : -1; }
    }
    last = [px, py];
  }
  cv.addEventListener('pointerdown', e => {
    if (!st.c) return;
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    if (st.tool === 'move') {
      dragging = { x: e.clientX, y: e.clientY, cx: st.cx, cy: st.cy, per: S / cv.getBoundingClientRect().width / view().k };
      return;
    }
    remember(); painting = true; last = null; paint(e); draw();
  });
  cv.addEventListener('pointermove', e => {
    if (dragging) {
      st.cx = dragging.cx - (e.clientX - dragging.x) * dragging.per;
      st.cy = dragging.cy - (e.clientY - dragging.y) * dragging.per;
      redraw();
    } else if (painting) { paint(e); redraw(); }
  });
  const end = () => {
    if (dragging) { dragging = null; return; }
    if (painting) { painting = false; apply(); }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  /* ── undo, redo, start over ── */
  function undoState() { q('[data-act=undo]').disabled = !st.history.length; q('[data-act=redo]').disabled = !st.future.length; }
  function remember() { st.history.push(st.edits.slice()); if (st.history.length > HISTORY) st.history.shift(); st.future = []; undoState(); }
  const act = (k, fn) => q(`[data-act=${k}]`).addEventListener('click', () => { if (st.c) fn(); });
  act('undo', () => { if (!st.history.length) return; st.future.push(st.edits); st.edits = st.history.pop(); undoState(); rebuild(); apply(); });
  act('redo', () => { if (!st.future.length) return; st.history.push(st.edits); st.edits = st.future.pop(); undoState(); rebuild(); apply(); });
  act('fill', () => {
    remember();
    // above the base line only: the gap between a star's points and the base it stands on is no hole
    const from = Math.max(0, cutRow() * st.c.width), filled = fillHoles(kept(), st.c.width, st.c.height);
    for (let i = 0; i < from; i++) if (filled[i] && !st.m[i]) st.edits[i] = 1;
    rebuild();
    apply('Holes filled: the clear panel inside a frame is part of the piece now. Undo to cut them out again.');
  });
  act('restart', () => {
    remember(); st.edits = new Int8Array(st.auto.length); st.base = st.base0; baseIn.value = st.base; showBase(); rebuild(); apply();
  });
  act('another', () => input.click());

  function clear() {
    st.token++;
    if (st.url) URL.revokeObjectURL(st.url);
    Object.assign(st, { img: null, url: null, c: null, m: null, auto: null, autoRow: null, autoAtRow: null, edits: null, r: null, history: [], future: [] });
    cv.hidden = true; q('.cutx__hint').hidden = false; tools.hidden = true; drop.classList.remove('has');
  }
  return { choose: () => input.click(), clear, destroy() { clear(); box.innerHTML = ''; } };
}
