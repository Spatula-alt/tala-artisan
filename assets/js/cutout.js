/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — cut a shape from the customer's own picture
   Loaded only when someone uses "Your art". Runs entirely in the browser.

   picture -> mask (background removed) -> cleaned for cutting -> traced path

   Background, three ways:
     alpha  a PNG that is already transparent: its own alpha, as-is
     plain  logos and clip art on a flat background: flood the background in
            from the border, by colour distance -- instant, no download
     photo  real photographs: U²-Net (u2netp, Apache-2.0, 4.6 MB, self-hosted)
            run with onnxruntime-web, fetched only the first time it is used

   Cleaned for the cutter, as trace-figure.py does for the reference art:
   one solid piece (the largest, with small specks dropped), small holes filled,
   big ones kept as real cut-outs, nothing thinner than 3 mm at the finished
   size, the edge smoothed. Output path is normalised to a 300-tall box, y down,
   cropped to the shape -- the same frame as every traced figure.
   ══════════════════════════════════════════════════════════════ */

const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/';
const MODEL = 'assets/models/u2netp.onnx';
const MAX = 900;                       // work at up to 900 px on the long side

/* ── image in ── */
export function readImage(file) {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => ok({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); bad(new Error('Could not read that picture.')); };
    img.src = url;
  });
}

function toCanvas(img) {
  const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/* ── background ── */
export function hasTransparency(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let clear = 0;
  for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 128) clear++;
  return clear > d.length / 4 / 7 * 0.02;
}

/* Is the picture's border one flat colour (a logo on white), or a scene (a
   photo)? Spread of the border pixels' colour: clip art sits under ~20,
   the kitchen behind a portrait well over 40. */
export function borderIsFlat(c) {
  const W = c.width, H = c.height;
  const d = c.getContext('2d').getImageData(0, 0, W, H).data;
  const px = [];
  for (let x = 0; x < W; x += 3) px.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y += 3) px.push(y * W, y * W + W - 1);
  let spread = 0;
  for (let ch = 0; ch < 3; ch++) {
    const v = px.map(i => d[i * 4 + ch]);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    spread += Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  }
  return spread / 3 < 28;
}

function maskFromAlpha(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const m = new Uint8Array(c.width * c.height);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] >= 128 ? 1 : 0;
  return m;
}

/* flood the background in from the border: anything connected to the edge
   and close in colour to the border's median colour. Interior white (a logo's
   inner white) is kept, because the flood never reaches it. */
function maskPlain(c, tol = 38) {
  const W = c.width, H = c.height;
  const d = c.getContext('2d').getImageData(0, 0, W, H).data;
  const border = [];
  for (let x = 0; x < W; x += 2) border.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y += 2) border.push(y * W, y * W + W - 1);
  const med = ch => { const v = border.map(i => d[i * 4 + ch]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const bg = [med(0), med(1), med(2)];
  const near = i => Math.hypot(d[i * 4] - bg[0], d[i * 4 + 1] - bg[1], d[i * 4 + 2] - bg[2]) <= tol
                    || d[i * 4 + 3] < 128;
  const seen = new Uint8Array(W * H), stack = [];
  for (const i of border) if (!seen[i] && near(i)) { seen[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i / W) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1])
      if (j >= 0 && !seen[j] && near(j)) { seen[j] = 1; stack.push(j); }
  }
  const m = new Uint8Array(W * H);
  for (let i = 0; i < m.length; i++) m[i] = seen[i] ? 0 : 1;
  return m;
}

let session = null;
function loadScript(src) {
  return new Promise((ok, bad) => {
    if (window.ort) return ok();
    const s = document.createElement('script');
    s.src = src; s.crossOrigin = 'anonymous';
    s.onload = ok; s.onerror = () => bad(new Error('Could not load the photo cut-out tool.'));
    document.head.append(s);
  });
}
async function u2net(onStatus) {
  if (session) return session;
  onStatus?.('Downloading the photo cut-out tool (one time, about 7 MB)…');
  await loadScript(ORT + 'ort.min.js');
  window.ort.env.wasm.wasmPaths = ORT;
  window.ort.env.wasm.numThreads = 1;          // no cross-origin isolation on a static host
  session = await window.ort.InferenceSession.create(MODEL, { executionProviders: ['wasm'] });
  return session;
}

/* U²-Net: 320x320, ImageNet-normalised, one saliency map out */
async function maskPhoto(c, onStatus) {
  const s = await u2net(onStatus);
  onStatus?.('Finding the subject…');
  const N = 320, t = document.createElement('canvas');
  t.width = t.height = N;
  t.getContext('2d').drawImage(c, 0, 0, N, N);
  const px = t.getContext('2d').getImageData(0, 0, N, N).data;
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  const input = new Float32Array(3 * N * N);
  let mx = 0;
  for (let i = 0; i < N * N; i++) for (let ch = 0; ch < 3; ch++) {
    const v = px[i * 4 + ch] / 255; if (v > mx) mx = v;
  }
  mx = mx || 1;
  for (let i = 0; i < N * N; i++) for (let ch = 0; ch < 3; ch++)
    input[ch * N * N + i] = (px[i * 4 + ch] / 255 / mx - mean[ch]) / std[ch];
  const feeds = { [s.inputNames[0]]: new window.ort.Tensor('float32', input, [1, 3, N, N]) };
  const out = (await s.run(feeds))[s.outputNames[0]].data;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < N * N; i++) { lo = Math.min(lo, out[i]); hi = Math.max(hi, out[i]); }
  // scale the 320x320 map back up to the picture, bilinear, then threshold
  const W = c.width, H = c.height, m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = x / W * (N - 1), fy = y / H * (N - 1), x0 = fx | 0, y0 = fy | 0;
    const x1 = Math.min(N - 1, x0 + 1), y1 = Math.min(N - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
    const v = (out[y0 * N + x0] * (1 - ax) + out[y0 * N + x1] * ax) * (1 - ay)
            + (out[y1 * N + x0] * (1 - ax) + out[y1 * N + x1] * ax) * ay;
    m[y * W + x] = (v - lo) / (hi - lo || 1) > 0.5 ? 1 : 0;
  }
  return m;
}

/* ── mask clean-up ── */
function label(m, W, H) {
  const lab = new Int32Array(W * H); let n = 0; const sizes = [0];
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || lab[i]) continue;
    n++; let size = 0; const st = [i]; lab[i] = n;
    while (st.length) {
      const p = st.pop(); size++;
      const x = p % W, y = (p / W) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1])
        if (q >= 0 && m[q] && !lab[q]) { lab[q] = n; st.push(q); }
    }
    sizes.push(size);
  }
  return { lab, sizes, n };
}

function blur(src, W, H, r) {                        // box blur, horizontal then vertical
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H), d = 2 * r + 1;
  for (let y = 0; y < H; y++) { let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) { tmp[y * W + x] = acc / d;
      acc += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)]; } }
  for (let x = 0; x < W; x++) { let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) { out[y * W + x] = acc / d;
      acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
  return out;
}

/* chamfer distance (1, √2) from every pixel where `src` is 1 to the nearest
   pixel where it is 0 */
function distance(src, W, H) {
  const INF = 1e9, D = new Float32Array(W * H), R2 = Math.SQRT2;
  for (let i = 0; i < D.length; i++) D[i] = src[i] ? INF : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!D[i]) continue;
    let v = D[i];
    if (x > 0) v = Math.min(v, D[i - 1] + 1);
    if (y > 0) { v = Math.min(v, D[i - W] + 1);
      if (x > 0) v = Math.min(v, D[i - W - 1] + R2);
      if (x < W - 1) v = Math.min(v, D[i - W + 1] + R2); }
    D[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; if (!D[i]) continue;
    let v = D[i];
    if (x < W - 1) v = Math.min(v, D[i + 1] + 1);
    if (y < H - 1) { v = Math.min(v, D[i + W] + 1);
      if (x < W - 1) v = Math.min(v, D[i + W + 1] + R2);
      if (x > 0) v = Math.min(v, D[i + W - 1] + R2); }
    D[i] = v;
  }
  return D;
}

function maxFilter(a, W, H, r) {                     // separable square max
  const t = new Float32Array(W * H), o = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0; for (let k = Math.max(0, x - r); k <= Math.min(W - 1, x + r); k++) v = Math.max(v, a[y * W + k]);
    t[y * W + x] = v;
  }
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    let v = 0; for (let k = Math.max(0, y - r); k <= Math.min(H - 1, y + r); k++) v = Math.max(v, t[k * W + x]);
    o[y * W + x] = v;
  }
  return o;
}

/* Grow only the parts narrower than `px` up to that width -- what
   trace-figure.py's enforce_min_width does. A pixel is in a thin part when no
   point within half the width of it is that far from the edge; those pixels,
   and only those, are dilated by half the width. Thick parts are untouched. */
function thicken(m, W, H, px) {
  const half = Math.max(1, px / 2), r = Math.ceil(half);
  const dt = distance(m, W, H);
  const near = maxFilter(dt, W, H, r);
  const thin = new Uint8Array(W * H);
  let any = false;
  for (let i = 0; i < m.length; i++) if (m[i] && near[i] < half) { thin[i] = 1; any = true; }
  if (!any) return m;
  const notThin = new Uint8Array(W * H);
  for (let i = 0; i < m.length; i++) notThin[i] = thin[i] ? 0 : 1;
  const toThin = distance(notThin, W, H);           // distance to the nearest thin pixel
  const out = m.slice();
  for (let i = 0; i < m.length; i++) if (toThin[i] <= half) out[i] = 1;
  return out;
}

function clean(m, W, H, o) {
  let { lab, sizes, n } = label(m, W, H);
  if (!n) return null;
  let big = 1; for (let k = 2; k <= n; k++) if (sizes[k] > sizes[big]) big = k;
  let out = new Uint8Array(W * H);
  for (let i = 0; i < out.length; i++) out[i] = lab[i] === big ? 1 : 0;
  const area = sizes[big];

  // holes: background components not touching the border. Small ones are filled;
  // big ones (>1.5% of the piece, an arm against a body) are kept as cut-outs.
  const inv = new Uint8Array(W * H); for (let i = 0; i < inv.length; i++) inv[i] = out[i] ? 0 : 1;
  const bl = label(inv, W, H), edge = new Set();
  for (let x = 0; x < W; x++) { edge.add(bl.lab[x]); edge.add(bl.lab[(H - 1) * W + x]); }
  for (let y = 0; y < H; y++) { edge.add(bl.lab[y * W]); edge.add(bl.lab[y * W + W - 1]); }
  for (let i = 0; i < out.length; i++) {
    const L = bl.lab[i];
    if (L && !edge.has(L) && bl.sizes[L] < area * 0.015) out[i] = 1;
  }

  out = thicken(out, W, H, o.minPx);
  const sm = blur(Float32Array.from(out), W, H, Math.max(1, Math.round(o.smooth)));
  for (let i = 0; i < out.length; i++) out[i] = sm[i] >= 0.5 ? 1 : 0;
  // the smoothing can split off specks again; keep the main piece
  ({ lab, sizes, n } = label(out, W, H));
  big = 1; for (let k = 2; k <= n; k++) if (sizes[k] > sizes[big]) big = k;
  for (let i = 0; i < out.length; i++) out[i] = lab[i] === big ? 1 : 0;
  return out;
}

/* ── trace ── */
function contour(m, W, H, startAt) {            // Moore-neighbour walk
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x];
  let start = startAt;
  if (!start) { outer: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) { start = [x, y]; break outer; } }
  if (!start) return [];
  let p = start, b = 4; const pts = [start];
  for (let guard = 0; guard < W * H * 4; guard++) {
    let q = null, i = 0;
    for (let k = 0; k < 8; k++) {
      i = (b + 1 + k) % 8;
      const c = [p[0] + dirs[i][0], p[1] + dirs[i][1]];
      if (at(c[0], c[1])) { q = c; break; }
    }
    if (!q) break;
    pts.push(q); b = (i + 5) % 8; p = q;
    if (p[0] === start[0] && p[1] === start[1] && pts.length > 3) break;
  }
  return pts;
}

function simplify(P, tol) {                     // Douglas-Peucker
  if (P.length < 3) return P;
  const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
  const st = [[0, P.length - 1]];
  while (st.length) {
    const [i, j] = st.pop(); if (j <= i + 1) continue;
    const [ax, ay] = P[i], [bx, by] = P[j], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    let best = -1, k = -1;
    for (let t = i + 1; t < j; t++) {
      // a closed ring starts and ends on the same point: then the "line" has
      // no length, and the distance that matters is to that point
      const dist = L > 1e-9 ? Math.abs(dx * (P[t][1] - ay) - dy * (P[t][0] - ax)) / L
                            : Math.hypot(P[t][0] - ax, P[t][1] - ay);
      if (dist > best) { best = dist; k = t; }
    }
    if (best > tol) { keep[k] = 1; st.push([i, k], [k, j]); }
  }
  return P.filter((_, n) => keep[n]);
}

/* the whole run. `o.mode`: 'auto' | 'alpha' | 'plain' | 'photo'
   `o.detail` 0..1 (1 = keep the most detail), `o.heightCm` the finished height */
export async function cutFromPicture(img, o = {}, onStatus) {
  const { c, m, mode } = await autoMask(img, o.mode, onStatus, o.tol);
  return finishCut(c, m, mode, o);
}

/* Step 1: the picture at working size and its background mask (1 = keep).
   The designer keeps both, so a customer can correct the mask by hand. */
export async function autoMask(img, mode = 'auto', onStatus, tol = 38) {
  const c = img.getContext ? img : toCanvas(img);
  if (!mode || mode === 'auto') mode = hasTransparency(c) ? 'alpha' : borderIsFlat(c) ? 'plain' : 'photo';
  onStatus?.(mode === 'photo' ? 'Preparing…' : 'Removing the background…');
  const m = mode === 'alpha' ? maskFromAlpha(c) : mode === 'photo' ? await maskPhoto(c, onStatus) : maskPlain(c, tol);
  return { c, m, mode };
}

export { toCanvas };

/* Step 2: a mask -- automatic or painted by hand -- made fit to cut, traced,
   and the picture cropped to it for printing. */
export function finishCut(c, mask, mode, o = {}) {
  const W = c.width, H = c.height;
  let m = mask.slice();

  // the subject's own box, for the finished size: px per cm along its height
  let y0 = H, y1 = -1;
  for (let i = 0; i < m.length; i++) if (m[i]) { const y = (i / W) | 0; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (y1 < 0) throw new Error('Nothing was left after removing the background.');
  const pxPerCm = (y1 - y0 + 1) / (o.heightCm || 20);
  const detail = o.detail ?? 0.6;
  m = clean(m, W, H, { minPx: 0.3 * pxPerCm, smooth: (1 - detail) * 0.35 * pxPerCm + 1 });
  if (!m) throw new Error('Nothing was left after removing the background.');

  // crop to the cleaned piece
  let x0 = W, x1 = -1; y0 = H; y1 = -1;
  for (let i = 0; i < m.length; i++) if (m[i]) {
    const x = i % W, y = (i / W) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const sc = 300 / ch;
  const norm = ([x, y]) => [(x - x0) * sc, (y - y0) * sc];
  const tol = 0.35 + (1 - detail) * 1.2;

  const ring = r => simplify(r.map(norm), tol);
  const rings = [ring(contour(m, W, H))];
  // big holes kept by clean(): trace each
  const inv = new Uint8Array(W * H); for (let i = 0; i < inv.length; i++) inv[i] = m[i] ? 0 : 1;
  const bl = label(inv, W, H), edge = new Set();
  for (let x = 0; x < W; x++) { edge.add(bl.lab[x]); edge.add(bl.lab[(H - 1) * W + x]); }
  for (let y = 0; y < H; y++) { edge.add(bl.lab[y * W]); edge.add(bl.lab[y * W + W - 1]); }
  for (let L = 1; L <= bl.n; L++) {
    if (edge.has(L) || bl.sizes[L] < 64) continue;
    const hm = new Uint8Array(W * H); let s0 = null;
    for (let i = 0; i < hm.length; i++) if (bl.lab[i] === L) { hm[i] = 1; if (!s0) s0 = [i % W, (i / W) | 0]; }
    const r = ring(contour(hm, W, H, s0));
    if (r.length > 6) rings.push(r);
  }
  const d = rings.map(r => r.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + ' Z').join(' ');

  // the picture with its background removed, cropped to the same box, for printing
  const art = document.createElement('canvas');
  art.width = cw; art.height = ch;
  const ax = art.getContext('2d');
  ax.drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
  const id = ax.getImageData(0, 0, cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++)
    if (!m[(y + y0) * W + x + x0]) id.data[(y * cw + x) * 4 + 3] = 0;
  ax.putImageData(id, 0, 0);

  return { d, art, mode, aspect: ch / cw, holes: rings.length - 1, points: rings.reduce((a, r) => a + r.length, 0),
           x0, y0 };                              // where the crop sits in the working picture
}
