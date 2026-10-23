/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — trophy model
   A trophy is a shape CUT FROM THIN COLOURED ACRYLIC SHEET, standing
   in a base, with a full-colour printed sticker applied to it.
   Every shape here is flat-cuttable: no cups, no thin protrusions,
   nothing that would have to be bent or moulded.
   Units are centimetres; 1 unit = 1 cm.
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

/* ───────────────────────── cut shapes ───────────────────────── */

function archShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w, 0); s.lineTo(-w, h - w);
  s.absarc(0, h - w, w, Math.PI, 0, true);
  s.lineTo(w, 0); s.closePath();
  return s;
}

function shieldShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w * 0.58, 0);
  s.bezierCurveTo(-w, h * 0.20, -w, h * 0.54, -w, h * 0.80);
  s.quadraticCurveTo(-w, h, -w * 0.70, h);
  s.lineTo(w * 0.70, h);
  s.quadraticCurveTo(w, h, w, h * 0.80);
  s.bezierCurveTo(w, h * 0.54, w, h * 0.20, w * 0.58, 0);
  s.closePath();
  return s;
}

function monolithShape(w, h) {
  const c = w * 0.26;
  const s = new THREE.Shape();
  s.moveTo(-w, 0); s.lineTo(-w, h - c); s.lineTo(-w + c, h);
  s.lineTo(w - c, h); s.lineTo(w, h - c); s.lineTo(w, 0);
  s.closePath();
  return s;
}

function facetShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w * 0.52, 0); s.lineTo(w * 0.52, 0);
  s.lineTo(w, h * 0.26); s.lineTo(w, h * 0.74);
  s.lineTo(w * 0.52, h); s.lineTo(-w * 0.52, h);
  s.lineTo(-w, h * 0.74); s.lineTo(-w, h * 0.26);
  s.closePath();
  return s;
}

function ovalShape(w, h) {
  const s = new THREE.Shape();
  s.absellipse(0, h / 2, w, h / 2, 0, Math.PI * 2, false);
  return s;
}

function waveShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w, 0); s.lineTo(-w, h * 0.66);
  s.bezierCurveTo(-w, h * 0.94, -w * 0.34, h * 1.00, 0, h * 0.90);
  s.bezierCurveTo(w * 0.34, h * 0.80, w, h * 0.96, w, h * 0.64);
  s.lineTo(w, 0); s.closePath();
  return s;
}

function plaqueShape(w, h) {
  const r = Math.min(w, h) * 0.12;
  const s = new THREE.Shape();
  s.moveTo(-w + r, 0);
  s.lineTo(w - r, 0);  s.quadraticCurveTo(w, 0, w, r);
  s.lineTo(w, h - r);  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, r);     s.quadraticCurveTo(-w, 0, -w + r, 0);
  s.closePath();
  return s;
}

/* ───────────────────── figures, authored as path data ─────────────────────
   Hand-tuning bezier numbers in JS was the wrong tool for drawing people, so
   the figures are written as SVG path data in a 100 x 300 box (y down, the
   way you would draw them) and converted to THREE.Shape here. The first
   subpath is the outline; every later subpath is an interior cut.
   `customOutline()` takes the same thing from a file the customer drops in,
   so the shop can use its own artwork instead of ours.
   ------------------------------------------------------------------------ */


/* Minimal absolute-command SVG path reader: M L H V C Q Z. Enough for the
   figures below and for clean exported artwork. */
function readPath(d) {
  const subs = [];
  let cur = null, x = 0, y = 0;
  const re = /([MLHVCQZmlhvcqz])([^MLHVCQZmlhvcqz]*)/g;
  let m;
  while ((m = re.exec(d))) {
    const cmd = m[1];
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    const n = (m[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);

    if (up === 'Z') { cur = null; continue; }
    for (let i = 0; i < n.length;) {
      if (up === 'M') {
        x = rel ? x + n[i] : n[i]; y = rel ? y + n[i + 1] : n[i + 1]; i += 2;
        cur = [[x, y]]; subs.push(cur);
      } else if (up === 'L') {
        x = rel ? x + n[i] : n[i]; y = rel ? y + n[i + 1] : n[i + 1]; i += 2;
        cur && cur.push([x, y]);
      } else if (up === 'H') {
        x = rel ? x + n[i] : n[i]; i += 1; cur && cur.push([x, y]);
      } else if (up === 'V') {
        y = rel ? y + n[i] : n[i]; i += 1; cur && cur.push([x, y]);
      } else if (up === 'C') {
        const c = rel
          ? [x + n[i], y + n[i + 1], x + n[i + 2], y + n[i + 3], x + n[i + 4], y + n[i + 5]]
          : n.slice(i, i + 6);
        cur && cur.push(['C', ...c]);
        x = c[4]; y = c[5]; i += 6;
      } else if (up === 'Q') {
        const c = rel
          ? [x + n[i], y + n[i + 1], x + n[i + 2], y + n[i + 3]]
          : n.slice(i, i + 4);
        cur && cur.push(['Q', ...c]);
        x = c[2]; y = c[3]; i += 4;
      } else { i = n.length; }
    }
  }
  return subs;
}

/* Fit the drawing to the blade height, keeping its own proportions, and flip
   to y-up. Scaling x and y independently (to fill the blade box) is what made
   naturally drawn figures come out fat — a person is not the shape of a
   plaque, so the drawing drives the width, not the other way round. */
function pathToShape(d, w, h, frame) {
  const subs = readPath(d).filter(sp => sp.length > 1);
  if (!subs.length) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const sp of subs) {
    for (const seg of sp) {
      const nums = typeof seg[0] === 'number' ? seg : seg.slice(1);
      for (let i = 0; i < nums.length; i += 2) {
        minX = Math.min(minX, nums[i]);     maxX = Math.max(maxX, nums[i]);
        minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
      }
    }
  }
  let k = h / Math.max(1e-6, maxY - minY);

  /* Centre on the CENTROID of the cut -- its centre of area.

     This has now been wrong in both directions. Centring on the BOUNDING BOX
     stood the striking footballer on the corner of his own base, because he
     reaches a long way to one side and the middle of his drawing is out in
     empty air. Centring on the FOOT fixed that and broke the opposite case:
     the guarding boxer's feet are nearly together while his body and gloves
     lean well off to one side, so his feet sat dead centre and the whole
     figure hung off the left of the base. Measured over every shape and pose,
     foot-centring left the boxer's Ready stance 3.1 units off centre and the
     Volley footballer 6.9, on pieces only 7.7 and 16.8 wide.

     The centroid is right for the same reason in both cases, and it is not a
     compromise between them: this is a flat sheet standing in a slot, so the
     slot has to sit under its centre of mass or the piece topples, and for a
     uniform sheet the centre of mass IS the centre of area. Holes subtract.
     Shoelace over the anchor points; every traced figure is a polyline, and
     for the handful of authored shapes that use curves the handles sit close
     enough to their anchors not to move the answer. */
  const ringArea = sp => {
    const pts = [];
    for (const seg of sp) {
      const nums = typeof seg[0] === 'number' ? seg : seg.slice(1);
      for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    }
    let a2 = 0, mx = 0;
    for (let i = 0, n = pts.length; i < n; i++) {
      const [px, py] = pts[i], [qx, qy] = pts[(i + 1) % n];
      const cr = px * qy - qx * py;
      a2 += cr; mx += (px + qx) * cr;
    }
    return a2 === 0 ? null : { area: Math.abs(a2) / 2, cx: mx / (3 * a2) };
  };
  let area = 0, moment = 0;
  subs.forEach((sp, i) => {
    const r = ringArea(sp);
    if (!r) return;
    const sign = i === 0 ? 1 : -1;        // subs[0] is the outline, the rest are holes
    area += sign * r.area; moment += sign * r.area * r.cx;
  });
  let cx = area > 1e-6 ? moment / area : (minX + maxX) / 2;

  /* Layered designs: the accent pieces are traced in the SAME frame as their
     panel, and must be placed by the panel's scale and centre, not their own. */
  if (frame) ({ k, cx, maxY } = frame);

  const X = v => (v - cx) * k;
  const Y = v => (maxY - v) * k;

  const build = (sp, Ctor) => {
    const o = new Ctor();
    sp.forEach((seg, i) => {
      if (typeof seg[0] === 'number') {
        i ? o.lineTo(X(seg[0]), Y(seg[1])) : o.moveTo(X(seg[0]), Y(seg[1]));
      } else if (seg[0] === 'C') {
        o.bezierCurveTo(X(seg[1]), Y(seg[2]), X(seg[3]), Y(seg[4]), X(seg[5]), Y(seg[6]));
      } else {
        o.quadraticCurveTo(X(seg[1]), Y(seg[2]), X(seg[3]), Y(seg[4]));
      }
    });
    o.closePath();
    return o;
  };

  const shape = build(subs[0], THREE.Shape);
  for (let i = 1; i < subs.length; i++) shape.holes.push(build(subs[i], THREE.Path));
  shape.userData = { frame: { k, cx, maxY } };
  return shape;
}


/* ───────────────────────── layered designs ─────────────────────────
   A main panel in the customer's sheet colour, with contrasting accent pieces
   -- gold swooshes, a fan, crest wings -- cut separately and laid on its front.
   Traced from the owner's reference photos with trace-layered.py, both layers
   in ONE frame so the accents land where they sit on the panel. Each replaces
   the plain cut as the default look of its shape; the plain cut stays as
   "Classic". `decal` keeps the sticker on the clear part of each panel, clear
   of the accents (x is an offset from centre, as a fraction of the width). */
const FLAME_BODY = `M52.8 0.0 L55.1 0.8 L56.2 3.4 L56.2 28.8 L58.5 31.2 L66.2 34.4 L71.3 33.9 L91.2 23.3
  L103.0 18.4 L107.4 17.7 L109.1 18.6 L110.4 22.6 L109.6 43.6 L108.1 45.9 L100.4 50.4 L100.2 53.6
  L120.5 72.8 L130.7 85.8 L142.0 105.5 L151.0 128.8 L155.5 148.0 L157.6 162.5 L158.3 177.9 L157.8 194.7
  L159.3 200.3 L159.3 205.2 L157.8 222.1 L150.1 257.3 L145.9 269.9 L141.2 270.3 L141.0 298.7 L131.4 300.0
  L-50.4 300.0 L-59.3 299.2 L-59.3 284.6 L-50.6 276.1 L-45.7 274.0 L-44.0 272.0 L-55.9 220.6 L-58.9 194.5
  L-58.2 158.6 L-53.8 135.2 L-47.6 114.0 L-41.8 99.9 L-32.4 82.2 L-20.7 64.5 L-9.4 50.2 L7.7 32.9
  L21.8 20.7 L36.8 9.2 L52.8 0.0 Z`;
const FLAME_ACCENTS = [
  `M52.8 0.0 L55.1 0.8 L56.2 3.4 L55.8 26.9 L55.1 29.3 L26.1 51.7 L4.9 73.0 L-15.6 100.6
  L-21.3 110.2 L-29.0 126.8 L-38.0 158.9 L-42.0 185.8 L-42.0 225.7 L-40.1 242.6 L-37.3 255.4 L-35.8 255.0
  L-35.4 251.8 L-35.8 227.4 L-33.3 198.4 L-29.9 179.1 L-26.0 163.3 L-20.0 144.6 L-12.6 127.0 L-8.9 121.1
  L-1.7 106.3 L6.9 93.1 L21.8 74.3 L39.3 57.0 L53.9 45.3 L70.1 34.4 L89.3 24.3 L104.2 18.1
  L107.4 17.7 L108.9 18.4 L110.4 22.6 L109.6 43.6 L107.6 46.3 L88.0 55.5 L73.1 64.5 L60.2 73.9
  L47.6 84.6 L29.1 104.4 L20.3 115.9 L8.6 134.1 L-6.2 165.0 L-11.3 179.8 L-17.3 202.8 L-22.2 228.5
  L-25.0 253.0 L-26.2 276.5 L-26.0 299.4 L-30.9 300.0 L-40.3 277.2 L-50.1 247.7 L-55.9 220.6 L-58.0 206.3
  L-58.9 194.3 L-58.2 158.7 L-52.1 128.5 L-46.5 111.2 L-35.8 88.2 L-23.7 68.8 L-9.2 50.0 L9.4 31.4
  L21.8 20.7 L36.8 9.2 L52.8 0.0 Z`,
  `M157.4 198.6 L158.7 199.4 L159.3 202.2 L158.0 220.4 L153.1 244.5 L145.9 269.9 L141.4 270.7 L141.2 282.9
  L134.6 299.4 L89.1 300.0 L109.2 281.6 L125.2 261.8 L138.6 239.8 L149.7 216.1 L155.3 201.4 L157.4 198.6 Z`];

const FLAG_BODY = `M-21.7 0.0 L-7.8 0.4 L4.3 2.3 L14.0 4.6 L39.1 13.3 L55.3 17.3 L80.5 21.7 L115.0 24.8
  L130.2 25.0 L150.4 23.8 L152.7 25.3 L159.8 37.4 L168.7 57.2 L175.4 79.1 L179.0 103.1 L179.0 127.9
  L176.7 145.4 L174.1 157.8 L166.5 180.1 L171.4 219.0 L157.3 237.9 L157.7 242.1 L160.5 248.7 L162.3 256.9
  L161.3 260.5 L144.5 274.3 L142.2 277.1 L142.4 284.6 L144.9 292.4 L144.9 300.0 L-52.7 299.8 L-52.7 295.4
  L-51.0 293.9 L-50.8 290.5 L-52.4 280.6 L-53.5 261.5 L-52.9 230.4 L-57.1 223.0 L-62.5 207.9 L-67.0 183.7
  L-67.4 163.3 L-63.6 131.3 L-63.4 119.3 L-65.7 106.9 L-72.4 94.9 L-70.5 87.1 L-70.1 80.8 L-71.4 74.9
  L-76.2 64.4 L-75.4 54.1 L-79.4 34.1 L-75.6 27.8 L-70.3 21.5 L-64.0 15.6 L-55.0 9.3 L-49.7 6.5
  L-38.1 2.5 L-21.7 0.0 Z`;
const FLAG_ACCENTS = [
  `M-76.9 39.1 L-73.9 39.8 L-62.6 47.8 L-50.6 61.0 L-46.6 67.5 L-41.9 78.1 L-38.1 95.1 L-37.3 109.6
  L-38.2 126.6 L-41.1 145.4 L-49.3 184.7 L-52.0 205.7 L-52.9 224.3 L-53.9 226.4 L-55.8 225.3 L-57.1 223.0
  L-62.5 207.9 L-66.8 185.8 L-67.4 163.3 L-63.6 131.3 L-63.4 119.3 L-65.7 106.9 L-72.4 94.9 L-70.5 87.1
  L-70.1 80.8 L-71.4 74.9 L-76.2 64.4 L-75.4 54.1 L-77.7 41.7 L-76.9 39.1 Z`,
  `M165.5 184.5 L166.8 185.3 L167.8 189.3 L171.4 219.0 L157.3 237.9 L157.7 242.1 L162.3 256.9 L162.1 259.0
  L160.2 261.9 L144.7 274.1 L142.1 277.7 L142.4 284.6 L144.9 292.6 L144.9 300.0 L32.8 300.0 L56.9 289.9
  L75.3 280.4 L93.8 268.9 L111.9 254.8 L128.9 238.4 L140.9 224.5 L151.2 210.0 L165.5 184.5 Z`];

const FAN_BODY = `M-16.2 0.0 L4.6 0.2 L20.9 2.4 L40.1 6.9 L74.0 16.9 L93.9 20.2 L106.2 20.4 L121.5 18.6
  L140.7 13.1 L152.7 8.0 L154.7 8.6 L142.5 157.9 L143.5 159.1 L145.5 158.7 L160.6 147.0 L162.5 146.8
  L163.1 149.3 L157.4 191.9 L140.4 204.8 L138.4 207.6 L137.2 217.6 L137.2 221.5 L138.2 222.7 L147.8 216.6
  L150.2 217.0 L150.4 219.4 L146.4 246.2 L143.1 249.2 L137.8 251.9 L133.7 252.1 L133.7 263.5 L134.9 265.3
  L134.9 289.0 L131.7 291.8 L131.7 300.0 L-29.0 300.0 L-35.6 296.3 L-45.1 296.3 L-45.1 270.0 L-42.7 266.8
  L-41.3 262.7 L-36.8 262.1 L-35.1 261.0 L-34.3 252.1 L-38.0 251.9 L-45.5 247.6 L-46.6 246.0 L-50.2 217.0
  L-48.0 216.0 L-42.1 220.5 L-38.2 221.7 L-37.4 220.7 L-38.0 209.7 L-38.8 207.0 L-41.1 204.4 L-57.8 191.7
  L-63.1 149.5 L-62.9 147.2 L-60.8 147.0 L-44.9 158.9 L-42.7 158.1 L-55.1 8.6 L-52.9 6.1 L-40.7 3.1
  L-16.2 0.0 Z`;
const FAN_ACCENTS = [
  `M-62.5 146.8 L-60.8 147.0 L-55.5 150.3 L-38.6 163.8 L-21.3 179.5 L-1.7 200.1 L10.9 215.8 L24.6 236.8
  L26.0 241.3 L29.1 245.3 L35.8 259.6 L43.6 281.4 L47.5 295.5 L47.9 300.0 L14.8 300.0 L4.6 286.3
  L-10.7 271.2 L-34.1 254.1 L-34.7 252.1 L-37.8 251.9 L-46.2 246.8 L-47.6 239.0 L-47.2 236.0 L-48.6 232.5
  L-49.0 225.2 L-50.2 221.3 L-50.0 216.8 L-47.8 216.2 L-28.4 230.3 L-8.6 248.2 L10.1 268.2 L26.2 290.8
  L26.9 291.4 L27.7 290.6 L17.5 269.8 L7.9 255.5 L-4.1 240.0 L-21.5 221.5 L-40.4 204.8 L-57.8 191.5
  L-61.5 162.7 L-61.3 158.7 L-62.5 155.2 L-62.5 146.8 Z`,
  `M161.2 146.8 L163.1 147.4 L163.1 149.1 L159.4 180.9 L157.2 192.3 L144.3 202.3 L139.4 204.4 L134.1 210.7
  L116.0 226.4 L115.0 228.6 L111.9 230.9 L102.3 242.7 L99.3 245.1 L97.2 249.0 L88.8 259.2 L80.1 274.7
  L78.0 277.0 L70.9 292.7 L71.7 294.1 L72.7 293.3 L78.7 283.3 L85.8 275.1 L89.9 268.6 L112.9 244.3
  L120.5 237.2 L129.4 230.7 L131.3 228.2 L135.1 226.8 L137.2 223.9 L145.7 217.6 L148.8 216.4 L150.4 217.4
  L146.4 246.2 L139.8 250.9 L134.1 252.1 L133.7 253.9 L130.5 256.4 L117.4 264.7 L114.3 268.6 L106.4 274.5
  L98.4 283.1 L88.4 295.1 L85.8 300.0 L51.9 300.0 L57.8 277.2 L66.0 255.9 L80.3 229.0 L83.1 225.0
  L88.8 219.8 L89.5 215.6 L96.4 208.6 L97.4 205.8 L102.9 201.9 L105.4 196.6 L120.5 180.5 L139.8 163.0
  L142.1 162.1 L147.4 157.0 L161.2 146.8 Z`,
  `M-38.4 264.5 L-34.9 266.8 L-31.5 267.4 L-27.8 270.4 L-22.9 271.9 L-9.5 281.0 L0.7 289.2 L11.4 300.0
  L-6.0 300.0 L-15.8 294.1 L-36.8 286.5 L-38.6 284.1 L-38.8 275.5 L-39.8 272.7 L-38.8 269.4 L-39.2 265.5
  L-38.4 264.5 Z`,
  `M134.9 265.9 L134.9 287.2 L131.5 286.3 L129.4 289.0 L126.0 289.6 L115.8 294.9 L112.7 295.1 L109.4 298.2
  L105.2 300.0 L88.6 300.0 L98.8 289.6 L109.9 280.6 L120.5 273.5 L123.9 272.5 L129.0 268.6 L134.9 265.9 Z`];

const CREST_BODY = `M47.2 0.0 L66.3 2.3 L96.7 9.7 L106.9 13.7 L113.3 19.7 L120.5 36.0 L128.6 44.8 L156.2 62.6
  L177.9 66.9 L183.9 71.9 L184.6 81.6 L177.3 115.6 L180.0 129.5 L179.6 136.9 L174.0 144.4 L154.3 154.8
  L147.5 162.6 L142.3 172.2 L138.6 183.6 L136.1 199.5 L135.7 237.6 L139.8 260.0 L148.7 276.2 L154.7 280.9
  L160.7 282.8 L185.2 280.9 L193.9 282.2 L200.9 288.4 L197.0 300.0 L-94.5 300.0 L-95.8 296.5 L-100.9 293.6
  L-100.9 271.0 L-85.6 266.4 L-64.1 266.2 L-53.1 262.7 L-47.7 257.7 L-43.8 250.9 L-39.2 231.4 L-39.8 195.6
  L-43.5 180.7 L-48.9 168.6 L-53.3 162.2 L-60.3 156.0 L-80.2 147.9 L-85.4 139.6 L-85.0 110.8 L-91.4 78.5
  L-90.4 71.1 L-86.8 67.3 L-81.9 65.3 L-58.7 62.6 L-37.1 49.9 L-24.1 38.7 L-15.2 20.1 L-8.3 13.7
  L13.8 6.6 L47.2 0.0 Z`;
const CREST_ACCENTS = [
  `M-77.3 65.5 L-68.6 66.7 L-59.9 71.1 L-51.6 78.9 L-43.3 90.5 L-27.4 123.5 L-18.5 157.5 L-15.2 191.0
  L-16.8 229.8 L-25.1 273.5 L-35.0 298.1 L-42.7 298.1 L-44.2 289.8 L-36.7 235.4 L-37.3 200.3 L-40.6 180.7
  L-44.8 169.5 L-52.0 157.7 L-58.9 151.9 L-76.9 144.4 L-82.3 136.1 L-79.4 114.8 L-87.7 74.0 L-84.6 68.0
  L-77.3 65.5 Z`,
  `M172.5 66.9 L180.8 68.4 L184.8 74.6 L182.1 94.3 L176.7 114.2 L180.0 134.5 L178.1 140.1 L174.8 143.8
  L158.3 151.9 L150.8 158.3 L144.8 167.0 L139.0 181.5 L135.5 204.5 L135.0 237.8 L143.1 291.1 L141.9 298.1
  L134.4 298.1 L124.1 273.3 L115.6 226.2 L114.1 190.6 L116.8 161.8 L124.1 130.3 L138.2 98.6 L147.7 84.1
  L156.2 74.6 L164.5 69.2 L172.5 66.9 Z`];

export const LAYERED = {
  oval:    { name: 'Flame', body: FLAME_BODY, accents: FLAME_ACCENTS,
             decal: { x: 0.1, y: 0.4, w: 0.42, h: 0.38 } },
  facet:   { name: 'Flag', body: FLAG_BODY, accents: FLAG_ACCENTS,
             decal: { x: 0.07, y: 0.56, w: 0.6, h: 0.46 } },
  plaque:  { name: 'Fan', body: FAN_BODY, accents: FAN_ACCENTS,
             decal: { x: 0, y: 0.73, w: 0.64, h: 0.38 } },
  shield:  { name: 'Crest', body: CREST_BODY, accents: CREST_ACCENTS,
             decal: { x: 0, y: 0.54, w: 0.38, h: 0.50 } },
};
/* the accent layer is a second cut and a second sheet: about 30% more */
const LAYERED_COST = 1.3;

/* Is `key` showing its layered design? Variant 0 is the design, 1 is Classic. */
function layeredOn(key, variant) {
  if (!LAYERED[key]) return false;
  const i = variant == null ? (VARIANT[key] || 0) : variant;
  return i === 0;
}

/* The accent pieces for a layered design, in the panel's own frame. */
export function accentShapes(key, w, h, variant) {
  if (!layeredOn(key, variant)) return [];
  const L = LAYERED[key];
  const body = pathToShape(L.body, w, h);
  if (!body) return [];
  return L.accents.map(a => pathToShape(a, w, h, body.userData.frame)).filter(Boolean);
}

/* ── the drawings ── */

/* Each figure is ONE solid cut with a flat foot — no holes, no scored lines.
   Rather than hand-placing bezier handles (which is what made the earlier
   figures lumpy), every figure is a PROFILE: a list of rungs down the body,
   `[y, halfWidth]`, or `[y, right, left]` where the two sides differ. The
   rungs are mirrored, threaded onto one Catmull-Rom spline and sampled, so
   the outline comes out smooth and symmetric by construction.

   `notch` cuts the gap between the legs up from the hem. It is part of the
   outline, not a hole — the piece stays in one connected mass.

   Drawn in a 300-tall box, y DOWN, x measured from the centre line. */

/* The Gentleman is not authored at all — it is TRACED from the shop's own
   reference silhouette: the photo was thresholded, its holes filled, features
   under ~1 % of the height rounded off (a hair tuft that fine would snap out of
   5 mm sheet), the outer contour walked and then simplified. That is why it
   keeps the things a smooth profile spline destroys — the square shoulder, the
   corner where the jacket hem ends, the splayed shoes, and the fact that the two
   sides are not mirror images of each other. Drawn 300 tall, y down. */
const GENT_TRACE = `M53.7 0.0 L57.7 0.2 L61.8 2.0 L62.5 3.9 L66.8 7.1 L66.6 8.7 L68.2 11.6 L67.5 13.9
  L67.3 19.8 L66.1 23.4 L65.7 27.1 L64.1 31.4 L62.7 32.8 L61.4 36.4 L59.3 39.8 L59.1 42.5
  L62.0 45.9 L64.5 47.7 L85.0 55.0 L86.9 57.1 L88.0 61.9 L87.7 65.9 L88.2 73.2 L91.8 96.2
  L91.2 106.9 L95.5 112.3 L93.9 126.4 L89.8 133.3 L90.7 138.5 L90.7 143.0 L89.3 146.2 L88.4 150.3
  L85.0 154.2 L82.8 158.8 L83.7 171.1 L83.7 201.8 L83.0 227.2 L81.9 242.7 L78.7 262.7 L78.9 265.2
  L80.0 268.1 L77.7 273.9 L78.0 276.4 L80.0 279.8 L80.3 284.3 L81.8 285.9 L82.5 288.0 L84.4 290.0
  L89.8 293.0 L91.6 295.2 L91.9 298.9 L88.5 300.0 L80.9 299.6 L74.6 298.6 L71.6 297.5 L68.4 293.4
  L67.1 293.4 L66.2 294.5 L65.2 294.6 L60.4 293.2 L60.0 292.5 L60.4 288.6 L58.2 283.0 L57.1 276.3
  L57.9 270.4 L61.1 265.4 L59.3 259.0 L59.1 253.4 L60.2 244.7 L60.0 234.1 L61.4 223.3 L58.2 217.0
  L59.8 207.4 L59.8 204.3 L56.4 189.0 L55.9 178.3 L53.7 174.4 L52.9 173.8 L51.8 174.9 L50.5 183.1
  L47.1 192.4 L45.9 204.7 L40.7 225.8 L39.5 256.6 L44.1 270.4 L44.5 275.0 L43.9 277.2 L39.6 286.3
  L38.6 291.6 L36.3 293.9 L36.1 296.8 L35.5 297.7 L30.9 299.1 L25.2 300.0 L19.5 299.8 L18.1 299.3
  L17.0 297.9 L17.2 295.7 L18.6 292.5 L22.9 287.0 L22.9 281.3 L23.6 279.3 L23.4 277.2 L21.6 273.9
  L21.6 272.3 L23.8 267.2 L23.9 265.2 L21.4 253.1 L23.4 214.0 L20.9 194.7 L22.9 162.2 L21.8 161.2
  L18.6 162.4 L15.9 161.9 L16.6 153.7 L14.1 150.4 L13.6 139.4 L7.7 129.6 L6.1 123.1 L4.5 103.2
  L8.4 63.9 L9.1 59.1 L10.6 56.4 L32.9 47.1 L41.3 40.2 L41.8 37.7 L41.3 33.7 L40.5 31.9
  L38.8 30.5 L36.8 25.2 L37.7 21.1 L37.0 13.6 L38.4 7.9 L38.9 7.0 L41.3 5.7 L41.8 4.8
  L43.6 4.5 L47.0 1.4 L53.7 0.0 Z`;

/* ── posed figures ──────────────────────────────────────────────────────────
   A profile can say how WIDE a body is at each height; it cannot say where the
   limbs are, so it can never show a spike, a guard or a stride. These six are
   posed in `pose-figure.py` — every bone a tapered capsule, every joint and
   ball a circle — and the union is traced by `trace-figure.py`, which rounds
   the joints and guarantees one solid contour with no holes. Rerun either
   script to change a pose; do not hand-edit the numbers below. */

/* Traced straight off the shop's own red acrylic figure: the wave in the hair,
   the profile, the arm swung out with the hand open, the fitted bodice, the
   kick in the hem, the legs apart and the heels. The cut stops at the mounting
   tab, which is what gives the piece its flat foot.
   --radius 1.2 --close 0.5 --bottom 0.9085. The first cut of this figure used
   the old default radius of 9, whose opening is wide enough to swallow a leg:
   her legs came out fused into one mass. The gap between them is only four
   source pixels where it starts, under the hem. */
const LADY_TRACE = `M62.0 0.0 L71.0 1.0 L72.7 2.0 L75.2 6.1 L78.8 10.5 L81.3 16.1 L83.5 17.6 L84.4 17.3
  L86.2 18.3 L86.2 22.0 L89.1 31.8 L87.9 34.2 L82.7 36.6 L80.8 38.4 L79.6 41.3 L79.3 43.5
  L79.6 50.6 L81.0 53.5 L87.1 60.3 L99.6 71.3 L101.8 76.2 L101.3 82.3 L98.1 89.7 L97.4 103.1
  L94.5 121.2 L93.5 141.9 L94.7 169.1 L95.7 173.0 L96.4 180.3 L97.6 183.5 L97.9 186.4 L99.3 190.1
  L100.1 194.0 L104.0 202.5 L104.2 204.7 L103.7 206.2 L101.8 207.9 L93.7 210.6 L89.6 215.5 L85.7 214.7
  L81.8 214.7 L80.8 215.7 L80.0 217.4 L79.6 224.5 L80.3 227.9 L79.8 228.7 L80.0 236.2 L80.8 238.7
  L80.5 240.9 L81.5 245.8 L81.5 250.7 L82.7 258.7 L85.9 270.7 L88.6 276.8 L90.6 283.9 L93.5 287.1
  L95.0 287.8 L109.6 286.3 L111.6 287.5 L112.3 288.8 L111.6 289.5 L108.9 289.3 L107.4 290.2 L102.8 290.2
  L101.8 290.7 L100.8 290.2 L99.8 291.0 L96.4 291.7 L94.0 291.4 L92.0 292.7 L90.6 291.7 L89.3 293.2
  L88.8 295.1 L85.7 297.8 L82.2 297.6 L81.0 298.5 L78.1 298.3 L76.4 300.0 L70.5 299.8 L70.0 297.6
  L72.5 295.6 L71.3 294.6 L69.5 295.6 L68.1 294.1 L63.2 294.1 L62.2 294.9 L58.6 295.4 L54.6 295.1
  L52.7 295.8 L51.5 295.6 L48.0 296.3 L42.2 296.6 L41.4 297.1 L38.3 296.8 L35.1 297.8 L31.4 297.8
  L30.2 298.0 L28.5 300.0 L2.4 300.0 L1.1 298.8 L2.4 297.6 L5.0 296.8 L15.6 296.1 L16.8 295.8
  L18.0 294.6 L17.8 293.2 L16.3 291.4 L16.3 289.0 L17.5 286.1 L17.8 283.9 L16.5 282.7 L13.6 285.1
  L11.6 285.1 L9.4 283.1 L9.7 280.9 L11.6 277.8 L11.9 276.1 L14.8 271.9 L14.8 270.7 L16.5 266.8
  L19.0 264.6 L23.4 263.1 L26.1 260.7 L26.5 259.7 L26.3 258.0 L28.3 254.1 L28.5 251.9 L30.5 248.9
  L30.9 244.8 L33.1 236.2 L32.9 234.5 L34.4 230.9 L34.4 229.4 L35.6 227.2 L35.8 224.8 L37.3 222.6
  L38.8 218.2 L46.8 208.4 L45.4 207.2 L38.5 206.7 L32.7 204.7 L29.2 202.8 L25.3 199.6 L23.1 196.4
  L22.9 194.0 L21.9 192.0 L15.3 187.6 L11.6 183.2 L9.4 177.9 L9.2 175.4 L11.2 172.7 L21.2 167.8
  L26.3 164.2 L32.9 157.8 L36.8 153.2 L41.4 145.6 L48.3 130.9 L52.4 125.1 L61.0 115.1 L62.9 110.7
  L63.4 105.0 L62.2 99.4 L59.3 92.3 L57.3 88.9 L55.4 87.0 L50.2 94.5 L41.2 113.4 L36.3 120.2
  L22.9 136.1 L19.7 140.7 L18.2 143.9 L17.3 144.6 L16.8 146.3 L14.3 149.3 L9.7 152.2 L5.8 156.1
  L2.9 156.4 L1.9 155.9 L0.4 153.9 L0.7 152.4 L-0.1 151.7 L-5.2 157.3 L-7.9 157.6 L-10.3 156.6
  L-12.1 155.1 L-11.6 150.5 L-12.3 149.0 L-12.3 147.6 L-9.6 144.9 L-1.3 140.2 L0.9 140.2 L2.6 139.5
  L4.8 140.2 L5.5 139.5 L5.5 138.5 L8.7 136.6 L10.9 134.1 L17.3 122.1 L19.0 117.5 L23.4 109.0
  L33.6 93.6 L35.6 88.2 L36.6 87.0 L41.7 71.1 L45.4 61.8 L49.0 56.9 L55.1 53.5 L57.3 50.8
  L58.8 46.7 L58.8 44.7 L58.1 44.0 L54.2 43.2 L48.3 41.0 L43.6 36.4 L40.7 35.9 L36.1 32.7
  L33.9 27.4 L33.6 20.8 L34.4 17.6 L36.3 14.7 L40.2 12.5 L42.7 12.7 L48.8 5.4 L54.9 2.2
  L60.5 1.2 L62.0 0.0 Z
  M58.3 228.4 L60.7 237.7 L60.7 239.9 L66.1 251.6 L69.1 259.7 L68.8 261.6 L69.8 264.3 L69.8 268.0
  L66.9 275.6 L67.8 278.0 L67.6 279.2 L69.5 283.9 L69.8 289.3 L68.3 290.2 L62.7 291.2 L60.3 291.0
  L52.0 292.2 L41.0 292.9 L38.0 293.6 L30.5 293.9 L29.7 293.2 L29.7 289.3 L31.9 285.1 L33.6 283.4
  L33.9 281.9 L36.3 277.5 L36.6 275.3 L37.5 274.1 L37.5 271.9 L42.7 257.7 L48.0 247.5 L51.7 242.8
  L52.0 240.1 L53.9 237.2 L57.3 229.4 L58.3 228.4 Z`;

/* Traced off the shop's own blue acrylic figure: the quiff, the profile, the
   suit shoulders, the arms hanging at the sides and the mounting tabs the feet
   stand on. The real piece has a thin slit cut between the right hand and the
   jacket; it is filled here, because the whole set is cut as ONE solid outline
   and a slit that fine is where the sheet would start to crack. */
const SUIT_TRACE = `M35.2 0.0 L58.3 0.0 L61.0 1.1 L65.7 5.8 L67.9 11.8 L68.1 19.2 L66.6 25.0 L63.8 30.6
  L62.3 34.9 L63.0 39.6 L66.8 44.3 L70.3 47.4 L86.9 53.4 L90.9 55.7 L92.5 59.3 L97.4 76.7
  L102.8 99.7 L103.9 109.1 L102.3 115.3 L96.3 122.9 L85.5 133.7 L89.1 162.7 L88.0 164.7 L83.3 167.2
  L82.2 168.8 L82.6 203.0 L80.9 216.9 L81.5 244.6 L80.4 247.2 L80.2 255.3 L82.0 274.8 L80.6 286.4
  L82.4 291.9 L83.1 293.3 L85.1 294.6 L103.2 296.6 L104.1 298.4 L102.5 300.0 L83.5 298.4 L80.0 300.0
  L65.6 300.0 L64.1 299.1 L63.9 297.8 L62.5 296.6 L52.5 295.3 L48.7 295.7 L46.6 299.1 L45.1 300.0
  L30.3 300.0 L28.5 298.7 L26.8 295.8 L24.3 294.4 L8.0 291.0 L-2.3 290.2 L-4.1 288.4 L-3.9 287.0
  L-2.5 286.1 L10.7 287.3 L14.4 285.2 L22.0 283.0 L26.1 278.6 L27.9 273.0 L28.1 269.2 L26.8 265.3
  L27.0 242.6 L25.0 214.6 L23.9 210.6 L23.6 203.2 L22.0 191.4 L21.0 174.6 L19.2 172.8 L15.1 175.3
  L13.4 175.5 L9.1 174.4 L5.3 171.5 L2.1 164.8 L3.1 155.6 L1.7 152.5 L1.7 148.9 L4.9 122.1
  L8.6 104.2 L12.7 70.7 L15.3 58.4 L17.4 56.1 L35.9 48.7 L38.1 46.5 L38.8 44.9 L37.7 42.9
  L33.0 42.7 L31.5 42.3 L30.5 41.3 L28.6 31.1 L26.3 27.9 L26.8 24.8 L29.0 20.4 L28.6 17.2
  L30.6 10.1 L29.9 6.5 L30.3 4.2 L32.8 0.9 L35.2 0.0 Z`;

/* Volleyball, men and women -- five poses each, from the owner's two reference
   sheets. Each player was
   cut from the sheet with its own ball, upscaled 8x (Lanczos) and thresholded.
   Ball panel lines, and any drawn line too thin to reach white, were filled.
   A ball in the air cannot be cut as part of one piece, so each floating ball is
   joined to a HAND at its own height by a bar 40% of the ball's radius wide --
   the usual way acrylic sports trophies hold a ball. --radius 1.2 --close 0.5. */
const VOLLEY_M0_TRACE = `M101.2 0.0 L107.3 0.0 L114.5 1.4 L118.7 3.8 L124.5 9.7 L126.9 13.8 L128.0 18.7 L128.0 25.7
  L126.9 32.3 L124.5 36.4 L119.0 42.0 L115.2 44.4 L112.1 45.1 L108.6 46.8 L102.9 46.8 L94.0 44.0
  L90.8 42.0 L86.4 37.5 L84.3 34.7 L83.2 31.6 L82.2 30.2 L54.1 33.3 L53.5 33.9 L53.7 34.9
  L55.8 39.0 L58.2 41.8 L59.2 46.3 L64.4 51.1 L64.8 52.2 L64.8 53.4 L63.0 57.7 L65.1 65.3
  L64.8 69.1 L65.5 69.8 L69.1 69.8 L74.6 67.4 L81.5 66.3 L93.4 67.4 L99.0 70.1 L108.5 69.4
  L112.6 67.7 L123.7 66.3 L133.7 61.5 L136.8 60.8 L139.2 59.4 L144.0 58.7 L162.7 52.8 L167.5 50.1
  L175.5 43.2 L178.2 41.8 L180.0 40.1 L183.8 38.7 L186.5 36.6 L190.7 31.8 L192.1 28.7 L196.9 23.1
  L199.1 23.1 L200.9 24.9 L203.6 25.6 L204.3 26.3 L204.3 27.5 L202.6 29.5 L201.9 31.6 L202.9 36.1
  L201.6 39.2 L191.2 49.9 L189.1 51.3 L189.1 52.5 L189.8 53.2 L198.1 53.5 L199.5 54.9 L199.8 56.5
  L198.8 58.2 L193.6 58.5 L187.7 61.7 L173.9 61.3 L165.3 64.1 L162.2 66.5 L159.4 67.5 L157.7 69.3
  L155.3 69.9 L149.1 74.4 L145.9 75.8 L144.2 77.5 L135.6 83.1 L129.7 85.5 L122.5 86.5 L119.0 88.3
  L113.8 88.9 L107.3 91.4 L104.8 91.7 L101.4 94.8 L94.1 98.3 L89.6 102.8 L88.6 105.9 L87.2 107.6
  L85.8 111.1 L86.2 119.2 L88.3 127.8 L88.9 134.4 L89.3 154.9 L88.6 157.3 L85.8 160.1 L84.8 162.9
  L85.8 166.5 L85.8 171.8 L84.1 175.6 L83.4 178.8 L84.1 184.3 L82.7 187.0 L75.8 194.0 L73.1 198.8
  L72.0 208.8 L69.9 214.3 L69.6 228.2 L68.9 230.6 L66.8 234.4 L66.5 237.1 L64.1 243.7 L63.7 247.5
  L61.3 254.4 L60.3 265.5 L59.2 266.5 L56.1 267.2 L54.4 268.9 L52.3 275.8 L50.3 280.3 L49.9 282.7
  L44.0 293.1 L39.9 297.9 L38.9 300.0 L-3.5 300.0 L-7.6 295.9 L-10.7 293.8 L-16.2 293.1 L-22.5 291.0
  L-26.9 290.3 L-30.1 288.3 L-33.9 287.6 L-38.0 285.5 L-41.8 284.8 L-44.9 282.7 L-49.1 281.7 L-51.8 280.0
  L-56.6 279.3 L-60.1 277.9 L-62.7 277.9 L-67.9 280.0 L-70.3 281.7 L-73.1 282.4 L-75.5 284.8 L-77.9 285.5
  L-95.2 299.3 L-96.9 300.0 L-98.8 299.7 L-100.9 297.6 L-101.9 292.4 L-103.6 289.3 L-104.3 285.5 L-104.3 281.2
  L-103.6 279.4 L-98.1 272.2 L-90.5 264.6 L-88.8 260.8 L-87.7 255.6 L-86.4 253.5 L-84.6 252.2 L-77.5 252.2
  L-68.9 254.9 L-64.4 255.3 L-61.3 257.7 L-60.3 259.4 L-58.5 260.8 L-29.0 260.8 L-28.0 259.8 L-28.7 257.9
  L-31.4 255.4 L-32.5 253.4 L-36.3 249.6 L-39.0 248.5 L-42.5 248.2 L-45.6 246.8 L-49.7 246.5 L-64.1 246.1
  L-76.3 246.8 L-78.4 246.1 L-79.1 245.1 L-79.1 242.8 L-77.4 239.4 L-76.0 233.9 L-74.6 232.1 L-73.6 229.4
  L-68.7 225.2 L-66.7 224.5 L-61.5 224.5 L-55.6 223.5 L-53.9 222.5 L-49.4 221.4 L-42.8 216.2 L-37.1 216.2
  L-33.0 220.0 L-24.0 230.7 L-24.0 236.3 L-23.3 238.3 L-20.9 240.8 L-15.7 244.2 L-13.0 247.0 L-11.7 247.3
  L-10.0 245.9 L-8.3 242.8 L-8.3 241.6 L-10.0 238.9 L-10.0 235.9 L-7.6 230.4 L-7.3 220.4 L-6.2 218.0
  L-5.2 212.4 L-4.1 198.6 L1.0 190.0 L2.4 183.8 L4.1 180.7 L8.6 175.5 L9.0 169.6 L13.1 164.4
  L14.2 161.7 L14.9 156.8 L16.6 155.1 L17.3 153.0 L16.6 145.9 L14.5 142.5 L12.4 140.4 L11.4 137.3
  L9.3 134.9 L8.6 131.4 L6.9 129.7 L4.1 124.5 L3.1 115.2 L0.0 109.0 L-1.4 107.6 L-2.8 104.5
  L-10.0 97.6 L-15.2 94.5 L-18.3 93.8 L-20.4 91.0 L-21.1 87.2 L-30.7 78.2 L-32.8 77.2 L-34.9 75.1
  L-36.6 74.4 L-39.4 71.3 L-40.8 68.6 L-40.8 59.8 L-40.1 57.0 L-37.0 53.5 L-31.8 52.5 L-27.3 52.5
  L-24.2 51.8 L-20.9 52.5 L-4.5 52.5 L14.9 50.8 L17.3 48.7 L18.0 45.6 L24.5 39.7 L26.3 39.0
  L30.1 34.2 L34.2 32.5 L39.0 32.5 L39.7 31.8 L39.7 29.0 L40.4 27.6 L43.2 25.6 L46.6 25.6
  L80.7 21.4 L83.9 12.1 L87.4 7.3 L92.9 2.8 L96.7 1.0 L101.2 0.0 Z`;

const VOLLEY_M1_TRACE = `M24.5 0.0 L32.2 4.1 L36.0 4.8 L37.9 6.0 L40.1 8.9 L41.1 13.7 L43.0 16.5 L43.6 20.7
  L44.6 22.6 L46.5 24.5 L65.3 27.4 L68.5 29.6 L69.1 33.1 L70.7 35.9 L71.6 40.4 L73.2 43.3
  L73.9 46.1 L75.8 49.0 L76.7 52.2 L78.0 53.8 L79.6 57.6 L81.2 59.2 L81.8 60.8 L83.4 66.5
  L83.4 73.5 L82.4 77.0 L82.8 79.2 L85.3 82.1 L86.3 84.6 L91.4 90.0 L93.3 100.2 L94.5 102.8
  L99.6 108.2 L99.9 110.7 L100.9 112.6 L101.5 121.8 L104.4 127.6 L104.4 137.1 L105.0 140.6 L106.6 143.8
  L107.3 147.3 L109.2 150.2 L109.8 153.3 L111.4 155.9 L112.0 158.4 L113.9 161.0 L117.4 168.9 L119.4 170.8
  L119.4 172.1 L117.8 174.3 L117.4 175.9 L118.1 177.8 L119.4 179.4 L120.3 184.2 L124.1 192.8 L125.1 197.6
  L126.7 199.8 L127.6 202.3 L129.5 204.6 L133.7 208.7 L137.2 211.2 L142.3 216.6 L144.5 221.1 L145.1 224.0
  L147.3 227.5 L148.3 231.6 L149.6 233.5 L150.8 239.2 L152.4 242.1 L153.1 247.2 L154.7 250.7 L155.6 255.8
  L157.8 259.9 L158.5 265.0 L164.8 273.3 L165.8 275.8 L167.4 277.4 L168.7 280.6 L172.5 286.0 L173.4 288.9
  L175.0 290.5 L177.3 294.6 L177.9 296.2 L177.9 299.4 L177.3 300.0 L151.5 300.0 L150.8 299.4 L150.8 290.1
  L149.9 284.7 L148.6 282.5 L148.3 280.6 L146.4 278.4 L142.6 272.0 L141.0 270.4 L139.7 267.6 L135.6 262.1
  L134.9 260.2 L130.5 254.8 L129.9 252.9 L125.7 247.2 L121.9 238.6 L120.3 236.4 L120.0 234.5 L118.1 232.2
  L117.1 229.7 L111.4 222.7 L107.3 218.9 L102.2 215.4 L97.4 210.6 L92.9 204.2 L91.4 200.1 L87.2 194.4
  L83.7 191.2 L82.1 190.9 L80.5 191.5 L79.3 190.6 L67.8 169.9 L65.0 167.3 L58.6 166.7 L56.7 165.1
  L54.8 164.5 L52.9 165.1 L38.5 180.1 L32.8 184.8 L30.3 186.7 L27.4 186.4 L25.5 187.1 L18.2 195.0
  L9.3 203.0 L8.3 203.3 L-1.9 212.8 L-2.8 215.4 L-3.1 223.0 L-4.4 225.6 L-5.4 230.6 L-6.9 232.6
  L-8.2 236.7 L-9.5 238.3 L-10.8 241.5 L-12.0 242.7 L-13.3 245.9 L-15.2 248.8 L-15.5 250.4 L-17.8 253.6
  L-18.1 255.8 L-20.3 259.0 L-20.9 261.8 L-22.5 264.4 L-23.2 267.9 L-24.1 269.5 L-24.4 270.7 L-23.2 273.9
  L-23.2 292.7 L-23.8 294.3 L-27.0 297.1 L-36.2 297.8 L-44.2 299.4 L-49.3 299.7 L-71.5 299.7 L-73.4 299.4
  L-76.0 297.5 L-77.9 293.3 L-77.9 291.4 L-75.7 288.5 L-74.4 287.6 L-71.2 287.0 L-68.7 285.4 L-67.1 285.0
  L-61.0 281.5 L-55.0 276.8 L-50.8 272.6 L-47.7 268.5 L-44.5 266.6 L-41.6 263.1 L-39.7 256.7 L-37.8 253.2
  L-37.2 249.4 L-35.6 245.9 L-34.9 242.4 L-33.0 238.9 L-32.1 232.6 L-30.8 230.3 L-29.9 225.2 L-27.9 221.1
  L-27.3 216.6 L-25.4 210.6 L-24.8 204.9 L-22.9 201.4 L-21.9 197.9 L-20.3 196.3 L-16.8 189.9 L-12.7 184.8
  L-11.4 181.0 L-10.1 179.7 L-9.2 177.2 L-7.6 175.0 L-6.9 171.8 L-8.2 169.2 L-8.2 167.7 L-7.3 165.4
  L-5.0 162.2 L-4.1 159.7 L-2.8 158.4 L-1.9 155.9 L0.1 154.0 L1.3 151.1 L5.1 146.3 L8.3 140.9
  L16.3 131.1 L24.5 122.2 L25.8 119.3 L25.5 117.1 L24.5 115.2 L25.8 111.0 L25.5 108.2 L23.0 105.6
  L20.4 105.6 L16.0 108.5 L13.4 109.4 L5.5 115.5 L4.8 117.4 L4.8 121.8 L1.3 126.3 L-0.9 127.6
  L-2.5 127.3 L-4.4 127.9 L-7.9 131.4 L-10.1 132.3 L-17.1 131.7 L-21.9 128.8 L-25.7 125.7 L-34.9 125.7
  L-36.5 124.7 L-41.0 124.1 L-46.4 120.6 L-49.9 117.1 L-52.8 112.6 L-55.0 105.3 L-55.0 100.5 L-53.1 94.2
  L-50.2 89.1 L-45.1 84.3 L-39.4 81.1 L-32.7 80.5 L-23.5 81.4 L-16.5 86.2 L-11.7 91.9 L-10.8 91.9
  L-9.8 91.0 L-9.5 86.9 L-8.5 85.3 L-7.6 81.4 L-6.9 71.6 L-5.7 67.1 L-6.0 64.3 L-7.3 60.8
  L-7.3 58.2 L-4.7 54.4 L-2.2 43.3 L0.7 40.7 L5.8 37.9 L7.7 35.9 L8.3 34.0 L6.7 26.7
  L5.1 25.1 L3.6 24.8 L2.3 23.9 L2.3 21.0 L-0.3 18.1 L-0.9 15.9 L1.3 13.0 L2.9 12.4
  L5.8 9.5 L8.6 5.4 L11.5 2.9 L13.7 1.9 L20.4 2.2 L24.5 0.0 Z`;

const VOLLEY_M2_TRACE = `M74.9 0.0 L81.3 1.5 L83.9 3.0 L85.6 4.7 L88.6 9.4 L89.0 12.8 L88.6 18.4 L87.1 21.2
  L83.9 24.8 L81.9 26.3 L77.3 27.8 L72.3 27.6 L68.5 26.1 L64.0 22.2 L62.5 19.7 L55.9 20.1
  L55.4 20.7 L56.1 23.7 L57.6 25.0 L59.3 25.0 L62.1 23.1 L63.3 23.5 L63.3 24.4 L61.6 26.3
  L60.2 32.7 L57.2 38.2 L55.9 45.5 L55.0 63.0 L60.4 68.6 L63.1 69.9 L63.4 72.7 L67.4 76.7
  L67.6 78.6 L66.3 80.5 L65.5 84.0 L66.4 85.3 L68.9 83.6 L72.3 83.6 L77.9 79.7 L79.8 78.9
  L82.0 76.9 L87.5 68.8 L87.9 67.5 L89.4 51.1 L89.0 40.4 L88.1 38.7 L84.3 36.8 L79.2 36.5
  L74.0 37.0 L73.6 36.1 L76.4 35.0 L77.3 32.3 L80.9 33.1 L81.7 32.1 L80.0 30.5 L80.4 29.5
  L81.5 29.7 L83.9 31.4 L84.5 30.8 L83.9 28.4 L85.1 27.6 L86.4 30.3 L88.6 32.5 L91.1 33.5
  L93.3 35.7 L93.3 38.2 L94.6 41.5 L95.0 44.7 L96.3 47.7 L97.8 56.4 L99.2 60.3 L99.7 67.9
  L99.2 69.7 L95.2 75.4 L89.0 87.4 L87.9 90.8 L88.3 93.4 L86.0 96.1 L85.4 99.2 L81.3 106.2
  L81.7 115.0 L85.6 132.0 L85.8 149.4 L87.5 154.9 L86.4 158.1 L87.3 159.8 L87.3 162.2 L86.4 164.5
  L87.1 166.9 L87.1 170.5 L85.6 176.1 L85.6 184.6 L83.0 194.7 L82.8 204.1 L80.0 208.6 L79.6 211.1
  L77.2 216.5 L76.6 219.4 L75.5 221.1 L72.1 231.4 L66.4 241.2 L65.9 244.9 L63.3 253.8 L62.9 257.7
  L61.9 259.8 L60.4 265.6 L60.1 269.4 L58.7 273.3 L60.2 283.1 L60.2 286.1 L61.9 291.7 L63.1 293.6
  L63.8 297.6 L62.5 298.9 L56.7 300.0 L51.8 298.3 L50.1 296.8 L49.0 294.7 L48.0 288.7 L45.4 281.4
  L42.8 276.1 L41.6 271.4 L43.1 269.2 L49.7 264.3 L50.8 260.9 L51.6 256.6 L53.1 234.8 L54.8 228.6
  L57.6 224.6 L58.7 214.8 L58.7 213.2 L58.2 212.6 L56.1 214.8 L54.2 218.2 L49.2 223.5 L33.2 234.2
  L22.5 243.0 L18.5 247.2 L17.0 249.4 L16.6 252.8 L15.3 255.6 L13.6 262.8 L13.3 272.0 L11.7 274.1
  L10.6 274.2 L6.1 272.9 L3.7 271.6 L0.5 267.5 L0.3 263.9 L1.8 258.1 L1.8 243.0 L2.3 240.8
  L4.4 238.9 L8.2 238.5 L12.9 237.2 L15.1 235.0 L24.7 221.4 L27.9 218.0 L33.7 213.7 L39.6 210.9
  L40.9 209.4 L43.7 197.0 L43.5 194.5 L42.4 193.2 L42.4 192.5 L45.0 188.7 L45.6 186.5 L45.4 179.9
  L46.5 175.2 L46.9 169.9 L46.3 166.0 L47.1 161.5 L46.9 157.1 L48.4 154.3 L47.5 144.0 L47.5 138.3
  L48.4 130.3 L46.9 127.6 L47.3 125.2 L46.9 121.8 L44.3 114.5 L43.9 111.1 L41.1 100.0 L40.1 91.4
  L41.3 88.2 L39.8 82.1 L39.8 80.5 L40.9 78.0 L41.3 75.6 L43.5 70.5 L43.0 66.9 L43.9 59.8
  L46.7 53.0 L49.7 42.7 L50.1 38.9 L51.2 36.1 L51.2 34.0 L49.7 29.1 L45.8 22.9 L45.4 20.9
  L46.0 20.1 L46.7 20.3 L50.5 24.6 L51.2 23.7 L50.3 21.1 L48.0 18.6 L48.4 16.5 L50.1 15.2
  L61.2 14.7 L61.7 14.1 L62.3 9.2 L65.1 4.7 L67.0 2.8 L70.0 1.3 L74.9 0.0 Z`;

const VOLLEY_M3_TRACE = `M11.5 0.0 L18.7 0.3 L20.7 1.0 L23.2 2.5 L27.5 6.8 L29.7 10.8 L30.5 16.5 L29.7 22.3
  L27.7 26.3 L24.7 29.5 L22.0 31.5 L16.2 33.8 L10.7 33.8 L4.5 31.3 L-1.5 25.3 L-3.3 20.3
  L-3.5 18.0 L-4.3 17.3 L-36.6 17.3 L-37.6 18.3 L-37.8 20.0 L-35.8 24.8 L-28.8 32.0 L-24.6 34.8
  L-21.3 37.8 L-18.8 38.8 L-17.3 40.3 L-12.8 43.0 L-5.0 49.5 L-3.0 50.3 L0.2 50.5 L4.0 52.0
  L9.2 52.8 L12.2 54.0 L18.2 54.3 L22.5 55.3 L25.2 54.8 L30.7 60.1 L32.2 59.3 L32.5 54.0
  L32.0 51.5 L30.5 49.8 L30.5 48.8 L32.7 47.8 L34.7 45.8 L36.0 40.5 L40.2 36.5 L41.5 33.5
  L42.7 32.3 L57.3 32.3 L61.5 32.8 L64.8 34.3 L70.0 34.5 L72.3 37.3 L73.0 41.0 L74.5 52.8
  L73.8 56.5 L71.3 59.5 L69.5 57.8 L68.8 57.8 L67.0 60.1 L63.0 62.1 L59.5 65.8 L57.3 65.8
  L56.5 66.6 L56.5 67.8 L58.5 69.3 L61.5 69.1 L62.8 70.1 L67.5 71.8 L77.5 68.6 L84.5 67.6
  L88.3 66.1 L89.8 64.6 L92.0 52.0 L92.8 38.5 L92.3 34.5 L88.3 27.5 L87.5 21.8 L88.0 21.3
  L88.8 21.5 L89.8 22.5 L90.3 25.0 L91.8 25.8 L93.8 21.8 L94.3 15.5 L95.8 11.3 L97.3 10.3
  L98.0 11.0 L98.0 13.0 L99.0 13.8 L101.0 10.5 L102.3 11.0 L101.8 15.3 L100.3 17.3 L100.0 19.8
  L101.3 20.5 L102.5 18.8 L103.5 18.3 L104.3 20.8 L105.8 22.5 L106.3 24.0 L104.3 27.5 L104.0 29.8
  L102.3 33.0 L102.0 34.5 L100.0 38.0 L100.3 41.5 L101.8 46.3 L102.0 50.3 L102.3 58.5 L101.8 69.6
  L98.3 73.6 L88.0 80.3 L86.5 81.8 L84.3 82.6 L79.8 85.8 L75.5 87.8 L74.3 89.1 L73.8 91.3
  L71.3 93.8 L60.0 103.1 L58.3 106.6 L57.5 110.6 L56.3 112.3 L54.0 119.1 L52.3 121.4 L52.0 122.4
  L53.5 125.4 L54.0 129.1 L53.3 132.6 L53.5 134.1 L57.8 142.1 L58.3 145.6 L59.8 148.4 L60.0 153.9
  L59.5 155.4 L59.3 162.1 L60.5 165.6 L61.5 166.6 L65.8 175.1 L66.3 177.4 L68.0 179.9 L68.3 181.9
  L69.8 184.2 L70.3 187.2 L71.8 189.4 L72.0 191.2 L75.8 195.9 L77.3 196.4 L94.0 196.4 L103.5 200.7
  L105.0 202.2 L107.0 202.9 L111.3 206.2 L119.6 210.4 L121.6 209.9 L130.3 203.4 L131.6 203.4 L135.8 207.4
  L137.6 210.2 L140.8 219.7 L145.8 225.4 L147.8 228.9 L150.1 236.7 L149.8 241.2 L147.1 244.0 L145.3 244.0
  L137.3 236.2 L131.8 232.4 L129.3 231.7 L128.3 230.7 L123.3 228.2 L118.8 222.4 L114.1 220.7 L109.5 219.9
  L105.0 218.2 L93.5 217.2 L85.8 217.2 L79.8 217.9 L69.8 217.9 L68.3 217.4 L65.3 215.7 L62.5 213.2
  L61.8 211.4 L58.3 207.4 L54.3 201.4 L48.7 195.2 L47.7 194.2 L47.0 194.2 L46.0 195.2 L46.2 204.4
  L48.0 209.9 L49.5 211.9 L51.5 216.4 L53.8 226.9 L53.8 234.7 L52.3 246.5 L52.0 257.2 L52.5 258.7
  L54.0 260.2 L56.0 260.7 L60.5 263.0 L61.5 264.0 L63.8 264.7 L64.5 265.7 L64.5 266.7 L63.8 270.5
  L61.8 274.2 L56.3 280.0 L54.3 283.2 L53.8 285.7 L49.5 292.5 L46.0 296.2 L41.0 300.0 L39.0 300.0
  L35.7 297.5 L36.2 294.2 L38.2 289.5 L39.0 281.7 L39.0 270.2 L41.5 264.7 L40.5 262.0 L40.0 255.5
  L38.5 249.7 L38.0 244.7 L36.5 240.7 L36.0 234.9 L34.0 227.9 L32.5 225.7 L32.0 223.2 L28.5 217.9
  L28.0 215.2 L26.7 212.4 L26.0 206.9 L24.7 204.7 L24.0 200.9 L20.7 194.7 L20.2 192.2 L18.2 189.2
  L16.5 184.9 L16.2 182.9 L14.5 180.2 L12.2 170.9 L8.7 167.4 L8.7 163.4 L10.0 154.1 L10.0 146.4
  L8.7 140.9 L7.5 129.6 L7.5 123.1 L10.0 113.3 L10.2 107.1 L14.2 100.6 L16.2 94.1 L16.2 88.1
  L14.2 81.1 L14.0 77.8 L12.2 73.1 L9.5 70.6 L0.5 66.1 L-1.0 65.8 L-3.3 64.3 L-5.8 63.8
  L-9.5 62.1 L-14.1 59.5 L-19.3 55.8 L-23.8 51.3 L-35.3 35.5 L-41.6 28.8 L-45.6 25.3 L-45.8 21.0
  L-44.6 17.8 L-44.8 16.8 L-46.6 14.8 L-48.1 14.3 L-49.3 14.5 L-50.1 13.5 L-50.1 12.5 L-48.8 11.3
  L-45.6 8.8 L-43.3 8.0 L-40.8 8.3 L-38.1 10.8 L-2.8 10.8 L-1.8 9.8 L-1.0 7.5 L3.2 3.0
  L7.2 0.5 L11.5 0.0 Z`;

const VOLLEY_M4_TRACE = `M196.3 0.0 L206.0 1.2 L213.1 4.7 L214.6 6.2 L217.0 7.4 L222.4 13.3 L224.0 16.4 L225.9 18.7
  L229.1 30.0 L229.1 37.1 L227.1 42.9 L226.7 46.4 L224.4 49.5 L222.8 53.1 L219.7 56.6 L213.1 62.4
  L208.4 64.0 L204.5 67.5 L199.8 74.1 L198.2 78.8 L196.3 81.1 L191.2 82.3 L186.2 84.3 L173.7 84.7
  L169.0 87.4 L165.1 88.2 L161.2 90.5 L156.9 91.3 L152.2 93.2 L126.5 95.2 L121.0 96.7 L114.8 97.1
  L107.3 99.9 L103.1 100.7 L99.2 103.0 L95.6 103.8 L91.4 106.1 L89.4 106.5 L85.9 109.2 L81.6 110.0
  L79.3 112.0 L75.4 113.1 L73.4 115.1 L68.7 116.3 L65.2 118.6 L61.3 119.4 L56.2 121.7 L53.5 122.1
  L50.8 121.7 L42.2 123.3 L39.9 126.0 L39.1 133.0 L36.0 136.2 L34.4 138.9 L34.0 140.4 L34.4 142.8
  L35.2 144.3 L37.9 147.1 L40.2 147.9 L41.4 147.5 L44.5 150.2 L46.9 151.0 L54.3 150.2 L59.8 148.6
  L67.9 147.5 L91.4 147.5 L92.5 147.9 L98.4 153.3 L101.9 158.4 L104.2 160.7 L105.4 163.5 L110.1 170.5
  L110.5 176.3 L108.5 179.8 L107.7 183.7 L105.4 187.3 L104.6 190.8 L102.3 193.9 L101.1 197.4 L99.5 199.0
  L98.0 204.4 L96.0 207.5 L94.9 213.0 L92.9 217.3 L91.7 224.3 L89.4 227.8 L88.6 232.1 L86.7 235.2
  L85.9 239.9 L83.9 242.3 L83.2 244.2 L82.0 249.7 L80.0 254.7 L79.6 259.4 L78.9 260.6 L78.1 264.9
  L78.9 267.2 L81.2 269.6 L84.3 271.9 L86.3 272.7 L88.6 275.0 L91.7 276.2 L94.1 278.5 L96.4 279.3
  L99.2 281.3 L103.4 282.1 L107.3 284.4 L112.4 285.2 L114.0 286.7 L115.1 289.9 L114.8 294.9 L113.6 296.5
  L112.8 296.9 L104.6 296.9 L93.7 298.4 L91.7 299.2 L83.2 299.6 L78.1 297.7 L71.8 296.5 L67.6 296.5
  L64.0 295.7 L53.1 296.1 L50.4 294.9 L49.2 293.4 L48.4 286.0 L47.3 281.3 L46.9 271.9 L48.8 268.0
  L50.4 266.4 L52.7 265.7 L55.5 262.5 L56.6 255.5 L57.8 252.8 L58.6 248.5 L59.8 211.4 L61.3 207.9
  L62.1 204.4 L64.0 201.7 L64.0 200.5 L67.9 194.7 L69.1 191.5 L70.3 190.4 L70.3 189.2 L69.1 188.0
  L67.9 188.0 L65.6 189.6 L62.5 193.5 L60.5 193.9 L55.9 196.6 L52.7 197.4 L50.4 199.3 L47.7 200.5
  L37.9 209.9 L36.7 210.3 L35.2 211.8 L27.0 213.4 L22.7 218.5 L20.0 219.2 L18.0 221.2 L17.2 224.3
  L16.1 225.5 L14.9 228.6 L15.7 235.6 L14.1 240.3 L13.7 259.8 L13.3 260.2 L12.9 272.3 L11.8 281.7
  L11.4 291.8 L7.5 296.5 L-0.3 300.0 L-21.4 300.0 L-25.7 297.7 L-30.8 296.5 L-33.1 294.5 L-37.0 293.4
  L-40.9 291.0 L-43.2 290.6 L-46.4 288.3 L-50.3 287.1 L-53.0 285.2 L-56.9 283.6 L-58.5 282.1 L-63.1 280.1
  L-64.3 278.9 L-67.8 277.4 L-69.8 275.4 L-72.9 274.6 L-75.6 272.7 L-78.0 271.9 L-83.4 272.3 L-86.9 274.6
  L-90.1 275.4 L-92.0 277.4 L-95.9 278.5 L-98.6 280.9 L-103.7 287.1 L-104.5 291.0 L-104.5 294.5 L-105.3 296.5
  L-107.6 299.6 L-108.8 300.0 L-110.3 299.6 L-113.8 297.3 L-116.6 296.5 L-119.3 294.1 L-121.7 293.0 L-125.6 289.5
  L-129.1 284.4 L-129.1 280.9 L-128.3 278.9 L-126.3 276.6 L-124.4 271.9 L-122.8 270.0 L-122.0 265.7 L-119.7 261.8
  L-118.5 255.9 L-116.6 252.8 L-115.0 251.6 L-105.3 250.1 L-101.4 247.3 L-96.3 246.6 L-92.8 247.7 L-90.4 250.1
  L-88.1 250.8 L-80.3 250.8 L-79.9 251.2 L-41.3 250.8 L-39.3 251.6 L-33.5 255.9 L-32.3 255.9 L-30.8 254.4
  L-32.3 246.2 L-33.9 244.6 L-35.8 243.8 L-37.8 241.1 L-38.9 234.5 L-40.1 232.5 L-41.3 228.2 L-42.1 222.8
  L-44.0 219.2 L-44.8 213.8 L-46.7 209.5 L-47.5 205.6 L-52.2 199.0 L-51.8 196.6 L-52.6 194.3 L-56.9 190.4
  L-56.9 188.0 L-53.8 183.7 L-51.0 174.0 L-50.7 149.0 L-49.5 145.9 L-47.5 143.2 L-46.7 140.1 L-45.2 138.1
  L-44.0 135.0 L-41.7 132.2 L-40.1 128.0 L-38.6 126.0 L-37.8 121.3 L-35.8 117.8 L-35.0 112.0 L-34.3 110.0
  L-31.1 105.7 L-28.0 103.8 L-26.1 101.8 L-22.6 96.0 L-21.8 92.8 L-17.5 88.9 L-14.8 87.8 L-12.4 85.4
  L-11.2 82.3 L-12.0 80.4 L-12.0 78.0 L-9.7 74.1 L-8.5 73.0 L-2.3 70.2 L0.1 67.5 L0.5 65.9
  L-0.7 62.8 L-0.7 58.5 L-0.3 56.2 L2.4 52.3 L2.8 49.2 L1.6 46.0 L-0.7 42.9 L-0.7 39.8
  L8.3 29.3 L12.9 26.9 L18.4 26.9 L24.3 25.4 L28.2 23.4 L30.5 23.4 L34.0 25.4 L36.7 26.1
  L39.9 28.5 L43.8 29.3 L49.6 32.4 L50.4 33.2 L50.4 35.1 L48.8 38.6 L49.6 41.0 L51.2 42.5
  L52.0 44.5 L52.3 54.2 L59.4 61.6 L59.8 63.2 L61.3 64.8 L64.0 65.9 L70.7 64.0 L80.8 62.8
  L87.1 60.5 L91.7 60.1 L99.2 57.7 L103.8 57.3 L111.6 55.0 L115.1 54.6 L149.1 54.2 L149.5 54.6
  L158.8 55.0 L163.5 56.2 L168.2 56.6 L169.8 55.0 L164.7 48.0 L163.9 42.9 L162.0 37.8 L162.0 28.9
  L164.3 22.2 L165.1 17.9 L170.5 10.9 L177.2 5.1 L181.9 3.1 L184.6 1.2 L196.3 0.0 Z`;

const VOLLEY_W0_TRACE = `M102.2 0.0 L107.0 0.0 L112.0 2.2 L119.5 1.9 L123.3 2.5 L127.7 5.3 L130.2 8.2 L132.7 12.2
  L133.6 16.3 L135.5 19.5 L135.8 38.0 L135.2 40.8 L133.6 43.3 L132.7 48.3 L131.7 49.6 L131.7 52.1
  L134.6 54.9 L137.7 55.2 L140.2 57.4 L144.9 58.4 L151.5 63.4 L155.9 68.4 L156.2 72.5 L157.5 76.3
  L157.8 89.1 L155.9 96.0 L155.9 99.5 L155.3 101.4 L155.3 110.1 L156.2 118.6 L158.1 123.0 L158.4 127.4
  L160.9 134.3 L160.9 142.8 L161.6 144.4 L162.5 145.3 L163.8 144.0 L164.7 140.9 L167.2 138.7 L167.2 136.5
  L169.1 134.0 L172.5 131.2 L174.7 130.5 L176.9 128.0 L182.3 127.4 L187.0 128.7 L189.2 127.7 L193.9 127.7
  L195.4 128.0 L198.9 131.8 L205.8 137.8 L207.4 141.2 L206.7 143.7 L207.1 145.0 L208.3 146.5 L208.9 148.7
  L208.6 153.1 L205.8 160.4 L203.9 162.2 L203.0 164.4 L198.0 168.8 L192.9 171.0 L189.2 171.7 L186.0 172.9
  L181.3 172.6 L175.1 170.1 L171.3 166.9 L169.1 164.1 L166.6 163.8 L165.6 164.7 L165.6 167.6 L166.6 172.3
  L168.1 175.4 L167.8 177.6 L165.3 180.1 L162.5 180.8 L159.0 182.9 L155.0 183.6 L151.5 182.9 L149.0 181.7
  L148.1 182.6 L151.2 187.0 L151.2 189.2 L152.5 193.0 L152.5 198.3 L151.2 201.8 L150.9 213.1 L150.6 214.3
  L146.2 220.3 L145.9 222.5 L143.7 226.6 L143.0 229.7 L141.5 231.9 L140.8 235.7 L138.3 239.4 L137.7 242.6
  L136.1 245.1 L135.2 248.5 L133.3 251.4 L133.0 254.2 L131.1 257.6 L130.5 260.5 L128.9 263.6 L129.6 265.5
  L130.8 267.1 L130.5 271.8 L131.1 275.8 L133.3 279.3 L139.9 286.2 L141.5 286.8 L143.0 288.4 L145.6 291.5
  L146.2 293.1 L146.2 296.2 L145.6 297.5 L144.3 298.4 L139.9 300.0 L134.6 300.0 L127.7 298.4 L125.2 298.4
  L117.9 293.7 L114.2 293.1 L111.3 291.2 L108.8 290.6 L107.0 288.4 L106.6 286.2 L107.6 284.6 L108.8 279.9
  L109.5 272.1 L110.4 269.6 L114.2 265.2 L115.4 259.8 L116.4 227.8 L118.3 220.3 L118.9 213.4 L120.8 209.6
  L121.1 206.8 L122.6 202.7 L122.3 201.5 L120.1 198.6 L114.5 193.6 L111.3 192.7 L109.8 191.1 L106.6 189.9
  L105.4 188.6 L102.2 187.7 L100.4 186.1 L92.5 182.6 L90.6 180.8 L85.9 177.6 L79.7 171.7 L71.2 170.4
  L68.0 171.0 L63.3 175.7 L62.1 177.9 L56.7 182.9 L55.2 183.6 L44.5 192.7 L42.3 193.6 L37.0 197.7
  L11.2 220.6 L5.9 223.4 L4.3 225.0 L-4.1 228.5 L-6.6 230.3 L-8.8 230.6 L-12.0 232.8 L-14.5 233.8
  L-15.7 235.0 L-18.3 236.0 L-20.4 238.2 L-21.7 238.5 L-30.5 245.4 L-32.7 246.3 L-34.6 248.2 L-37.1 249.2
  L-38.3 250.4 L-40.5 251.0 L-42.4 252.9 L-44.9 253.6 L-46.5 254.8 L-50.3 256.4 L-51.5 257.6 L-59.7 261.4
  L-60.9 262.7 L-64.1 263.6 L-72.5 270.2 L-77.6 276.5 L-79.8 280.2 L-81.3 281.5 L-84.2 282.7 L-86.3 283.1
  L-89.8 285.6 L-95.1 285.9 L-98.9 283.7 L-101.7 283.4 L-106.1 280.5 L-108.6 277.1 L-108.9 275.2 L-107.1 270.5
  L-105.5 268.9 L-101.4 266.4 L-95.4 265.8 L-92.9 263.9 L-90.7 263.6 L-83.5 258.9 L-81.0 257.9 L-79.4 256.4
  L-77.9 256.1 L-73.2 253.6 L-61.6 243.5 L-43.4 225.9 L-41.8 225.3 L-37.1 221.2 L-35.5 220.6 L-30.2 216.5
  L-28.3 215.9 L-26.1 213.7 L-19.2 210.3 L-17.6 208.7 L-15.1 207.7 L-13.5 206.2 L-8.5 203.0 L-3.5 198.6
  L0.6 194.2 L3.4 189.2 L5.3 187.3 L6.2 185.1 L15.0 173.2 L16.0 171.0 L20.0 166.3 L21.3 163.5
  L34.8 149.1 L36.0 144.4 L37.9 142.5 L38.9 140.3 L40.1 139.0 L41.1 135.6 L42.3 134.0 L43.6 130.5
  L46.4 125.5 L47.6 124.3 L48.6 121.8 L50.5 119.9 L54.2 113.9 L58.0 109.8 L60.5 106.1 L61.1 102.9
  L62.7 100.1 L63.7 94.5 L65.5 91.9 L66.2 87.6 L68.4 82.2 L68.7 78.8 L70.6 75.9 L71.5 66.2
  L74.3 63.7 L82.8 53.0 L93.8 49.3 L98.8 49.0 L100.4 48.3 L101.6 46.8 L101.3 45.2 L98.8 43.0
  L96.0 38.3 L95.3 35.1 L96.0 31.1 L94.7 28.2 L93.8 21.7 L95.0 19.1 L96.0 13.5 L97.5 11.9
  L98.2 10.0 L96.9 7.2 L96.9 6.0 L98.5 3.1 L101.3 0.3 L102.2 0.0 Z M118.3 122.7
  L119.5 123.0 L120.4 124.0 L121.4 126.5 L122.6 127.7 L123.6 129.9 L127.7 134.6 L128.6 136.8 L130.8 138.7
  L133.0 141.8 L138.0 147.2 L143.0 154.4 L143.0 158.2 L140.8 164.4 L137.4 168.2 L123.6 153.5 L123.0 151.9
  L120.1 149.4 L118.6 146.5 L115.7 144.4 L114.2 141.8 L111.7 139.3 L112.0 136.5 L111.0 134.3 L111.3 129.0
  L117.3 123.0 L118.3 122.7 Z`;

const VOLLEY_W1_TRACE = `M79.6 0.0 L82.7 0.0 L85.4 2.3 L92.4 5.8 L96.6 4.6 L99.0 5.4 L103.2 5.0 L105.9 5.8
  L113.7 6.6 L117.9 9.3 L124.5 16.6 L128.4 27.5 L128.4 30.6 L129.2 34.1 L129.2 46.5 L128.8 46.8
  L129.2 54.2 L128.0 56.9 L126.5 58.5 L125.7 60.8 L126.1 64.3 L125.3 69.7 L122.2 73.2 L119.9 74.3
  L118.7 75.5 L118.7 76.3 L120.3 77.8 L122.6 78.6 L129.5 84.0 L131.1 85.5 L131.9 87.5 L134.2 89.8
  L135.4 92.5 L137.3 94.8 L138.1 99.9 L140.4 103.0 L144.3 111.1 L146.6 113.4 L147.7 116.5 L149.3 118.1
  L150.5 120.8 L152.4 122.7 L153.5 125.4 L158.6 131.2 L159.7 133.5 L164.8 139.0 L166.3 139.7 L168.6 142.1
  L171.0 144.8 L172.5 147.9 L174.5 149.8 L178.7 157.9 L180.3 159.5 L181.8 163.4 L183.4 164.9 L184.5 168.4
  L186.8 170.7 L188.0 173.8 L189.5 175.7 L190.7 179.2 L192.6 181.2 L193.8 183.9 L196.1 186.6 L196.5 188.9
  L198.1 190.5 L209.3 187.0 L210.8 185.4 L211.2 183.9 L210.8 180.0 L212.0 177.7 L212.4 174.2 L213.2 172.6
  L217.4 168.0 L219.0 164.5 L221.3 161.8 L224.8 158.3 L228.6 155.6 L235.6 155.2 L241.4 152.5 L244.9 152.1
  L250.3 152.1 L254.2 154.1 L258.5 154.5 L264.6 158.7 L270.8 165.7 L271.6 167.6 L274.3 171.1 L274.7 173.0
  L276.6 176.9 L277.4 180.8 L277.8 184.3 L277.4 193.2 L273.5 203.6 L267.7 211.0 L267.4 212.1 L263.1 216.4
  L256.9 217.2 L253.4 218.7 L251.5 218.7 L248.0 220.3 L246.8 221.4 L243.4 221.4 L236.8 219.5 L234.8 219.5
  L229.8 216.4 L226.3 216.0 L223.6 212.9 L220.1 210.6 L217.8 208.3 L214.7 204.0 L213.9 202.5 L213.9 200.9
  L212.4 199.4 L205.4 201.3 L204.3 202.8 L205.4 204.0 L206.2 207.1 L212.0 214.1 L215.1 219.1 L215.5 231.1
  L216.3 233.4 L217.8 235.4 L217.8 236.9 L216.3 239.2 L215.9 240.8 L216.3 243.1 L214.7 244.3 L210.8 243.1
  L207.0 243.5 L203.5 241.9 L200.4 241.9 L195.4 238.8 L191.9 238.5 L187.6 234.2 L187.2 233.4 L187.2 221.8
  L183.7 213.7 L177.2 207.5 L174.5 206.3 L167.1 200.5 L144.6 177.3 L143.1 174.6 L139.2 171.1 L137.7 173.0
  L136.9 182.3 L131.9 188.9 L130.7 193.9 L125.3 199.4 L124.9 201.7 L122.6 205.5 L121.8 210.2 L119.5 214.5
  L118.7 219.1 L116.4 222.6 L115.6 226.5 L113.7 229.9 L112.9 233.4 L110.6 236.1 L109.4 240.4 L107.1 243.9
  L105.9 247.4 L103.6 250.5 L103.2 252.8 L100.9 257.0 L100.1 260.5 L98.2 264.4 L101.7 272.9 L107.1 281.0
  L113.7 287.2 L117.2 288.8 L118.7 290.3 L121.4 291.5 L124.1 293.8 L127.2 295.4 L129.9 298.5 L129.2 300.0
  L83.5 300.0 L83.1 299.6 L68.8 300.0 L66.8 299.6 L64.9 298.5 L62.2 295.7 L61.8 294.6 L63.7 287.2
  L66.5 283.0 L67.2 273.3 L68.8 272.1 L71.5 271.4 L73.8 269.0 L75.7 265.2 L76.5 259.7 L78.8 255.5
  L80.0 247.4 L81.9 243.5 L82.3 239.6 L85.0 231.9 L85.8 214.8 L88.1 209.0 L88.9 204.0 L91.2 199.4
  L92.0 194.3 L93.9 192.4 L94.7 190.1 L96.6 187.4 L96.6 186.2 L95.5 185.0 L91.6 186.2 L89.7 188.1
  L86.6 188.5 L83.9 190.8 L80.0 192.0 L75.4 194.7 L72.6 195.1 L69.2 197.4 L64.9 198.2 L61.4 200.1
  L56.4 200.9 L28.5 200.9 L28.1 200.5 L20.0 200.5 L12.6 199.4 L9.9 200.5 L7.2 200.5 L4.9 201.3
  L2.2 204.0 L1.0 207.9 L-1.3 211.0 L-2.1 214.8 L-4.0 217.5 L-5.2 221.8 L-7.5 225.3 L-8.3 229.2
  L-11.0 233.0 L-11.4 235.7 L-13.7 239.2 L-14.8 243.5 L-16.4 245.0 L-17.9 248.9 L-19.9 251.6 L-20.6 255.1
  L-23.0 257.4 L-23.7 260.5 L-25.3 262.5 L-26.8 266.3 L-28.4 267.9 L-30.3 272.1 L-32.3 274.1 L-33.4 276.8
  L-35.0 278.3 L-36.1 283.4 L-40.0 287.2 L-43.9 288.0 L-47.0 289.9 L-51.6 290.7 L-55.5 290.7 L-55.9 291.1
  L-71.7 290.7 L-74.5 288.8 L-78.3 287.2 L-85.3 281.8 L-90.3 281.0 L-93.8 279.1 L-98.5 277.9 L-101.5 275.6
  L-107.0 274.8 L-110.5 272.5 L-113.9 271.7 L-117.4 269.4 L-121.7 268.6 L-125.9 266.3 L-134.1 264.4 L-137.9 264.4
  L-141.8 265.9 L-143.7 267.9 L-144.1 269.0 L-145.7 270.6 L-147.2 274.8 L-147.2 280.3 L-148.4 283.4 L-148.4 285.7
  L-146.8 289.9 L-144.5 292.3 L-143.7 294.2 L-143.7 296.5 L-144.5 298.1 L-146.8 299.6 L-159.6 300.0 L-163.5 299.2
  L-169.7 296.1 L-173.9 289.5 L-174.7 287.2 L-174.7 282.2 L-175.1 281.8 L-174.7 276.4 L-172.8 272.5 L-172.4 270.6
  L-177.4 259.7 L-177.4 255.1 L-177.8 254.7 L-177.4 250.1 L-172.8 245.4 L-167.7 244.3 L-165.4 242.3 L-161.9 240.8
  L-160.0 239.2 L-155.4 238.8 L-150.3 241.2 L-110.8 241.5 L-100.4 242.7 L-94.6 244.3 L-88.4 244.6 L-85.7 245.4
  L-83.7 247.0 L-79.9 248.1 L-75.6 250.8 L-71.7 251.6 L-66.7 253.9 L-64.4 253.2 L-61.7 250.5 L-60.5 248.5
  L-59.4 242.3 L-57.4 238.8 L-56.6 234.2 L-54.3 231.1 L-53.9 226.5 L-51.2 221.0 L-50.5 217.2 L-48.5 213.7
  L-47.4 207.5 L-45.0 202.8 L-44.3 196.6 L-41.9 189.7 L-41.9 181.2 L-40.8 168.8 L-38.8 165.7 L-38.1 161.0
  L-36.1 158.3 L-35.0 155.2 L-32.6 152.9 L-31.9 151.0 L-26.8 145.9 L-23.7 144.8 L-21.4 142.8 L-14.8 136.3
  L-12.9 135.5 L-11.0 133.5 L-7.9 132.4 L-6.3 130.8 L-3.6 129.7 L-1.7 127.7 L-0.9 125.8 L12.6 113.4
  L25.8 97.2 L27.0 94.5 L29.7 91.0 L39.7 80.9 L41.7 80.1 L43.6 78.2 L47.5 76.6 L49.0 75.1
  L57.5 71.6 L61.4 71.6 L67.2 70.1 L69.5 70.1 L74.2 68.5 L80.4 68.1 L83.5 67.0 L85.4 65.0
  L86.2 63.1 L85.4 60.4 L83.5 58.8 L80.8 58.1 L79.6 56.9 L78.1 56.9 L76.9 58.1 L74.2 62.7
  L72.6 61.2 L71.1 61.2 L69.5 62.7 L68.4 65.0 L67.2 64.6 L65.3 62.7 L63.7 62.7 L61.8 64.3
  L58.7 60.8 L56.4 59.2 L56.0 55.4 L53.3 51.5 L54.1 48.8 L53.3 44.9 L56.8 37.2 L56.8 34.5
  L55.6 31.0 L56.0 28.3 L58.3 22.1 L60.3 20.1 L61.0 17.8 L63.4 14.3 L64.1 10.8 L66.8 7.4
  L71.1 3.1 L76.1 2.3 L79.6 0.0 Z`;

const VOLLEY_W2_TRACE = `M56.0 0.0 L61.7 0.2 L65.7 1.8 L68.7 4.3 L70.5 7.7 L70.7 14.3 L69.8 18.1 L70.0 19.0
  L74.3 24.5 L74.8 33.5 L73.7 36.9 L70.9 39.2 L68.0 39.8 L67.5 39.2 L68.5 37.8 L68.2 36.2
  L67.1 35.3 L64.8 35.3 L63.9 36.2 L64.4 40.1 L68.7 44.4 L70.9 45.1 L73.0 46.4 L85.4 48.5
  L88.6 50.9 L90.9 54.6 L97.7 61.8 L103.8 70.9 L114.2 83.5 L117.6 89.0 L119.2 94.6 L118.9 97.4
  L117.6 102.1 L116.5 103.2 L112.2 110.7 L97.4 130.2 L91.8 135.4 L88.8 135.6 L84.1 134.3 L82.9 135.6
  L83.6 144.9 L83.4 157.8 L81.8 160.1 L81.1 162.6 L80.0 164.2 L79.5 166.6 L78.2 168.5 L77.7 171.2
  L76.4 173.7 L75.9 177.1 L74.3 180.5 L74.1 186.8 L72.5 195.6 L71.8 206.5 L72.5 225.5 L70.9 230.9
  L70.5 237.3 L68.9 242.7 L68.9 245.4 L67.3 250.0 L66.9 255.4 L66.0 257.2 L65.1 263.1 L63.5 267.8
  L63.2 271.5 L61.2 277.1 L61.4 279.4 L63.5 282.8 L63.9 287.5 L67.1 293.9 L68.0 297.5 L67.8 299.3
  L67.1 300.0 L54.0 300.0 L52.8 298.6 L52.6 295.9 L50.6 293.0 L50.6 286.6 L49.9 282.3 L50.8 279.2
  L52.4 277.4 L53.1 275.5 L53.7 253.1 L52.8 228.9 L53.5 223.9 L52.6 219.4 L51.0 215.8 L50.1 206.9
  L50.1 204.7 L51.5 199.7 L51.2 191.8 L52.6 175.9 L52.8 163.0 L52.4 159.8 L51.5 158.9 L50.1 158.9
  L47.6 161.7 L46.9 165.7 L43.8 172.8 L43.1 176.4 L42.0 178.0 L41.3 180.7 L40.2 182.0 L39.9 183.8
  L36.8 189.3 L36.1 194.0 L34.7 196.5 L32.7 202.9 L30.9 205.6 L29.3 210.8 L29.1 213.3 L27.5 217.6
  L27.2 227.8 L25.7 235.5 L25.4 239.3 L23.8 243.2 L23.4 247.5 L22.3 250.0 L21.8 252.9 L20.2 255.4
  L19.8 258.3 L18.4 260.6 L17.7 264.5 L16.6 266.0 L16.2 270.3 L15.0 272.4 L13.4 278.5 L13.7 279.8
  L15.7 283.5 L17.1 293.4 L16.6 296.8 L15.2 298.2 L7.1 298.2 L2.6 300.0 L-11.0 299.8 L-14.0 298.0
  L-13.7 296.2 L-9.2 291.8 L-3.3 287.5 L0.1 283.9 L1.9 281.2 L2.3 277.4 L4.8 274.6 L5.3 273.3
  L5.7 257.9 L7.3 240.2 L7.5 231.4 L8.2 224.8 L9.1 222.6 L8.9 219.8 L8.0 217.4 L8.0 210.3
  L8.9 208.8 L10.0 203.1 L9.6 197.9 L12.8 194.5 L13.2 193.1 L14.8 180.0 L14.8 175.0 L16.2 168.5
  L16.6 161.9 L15.2 161.2 L13.7 162.6 L11.8 161.9 L10.9 162.1 L8.0 164.2 L4.6 163.7 L-0.2 161.9
  L-2.2 161.9 L-6.5 158.3 L-6.5 156.2 L-7.4 155.3 L-9.4 155.3 L-10.8 154.2 L-10.6 149.7 L-11.5 148.8
  L-13.3 150.3 L-14.0 154.0 L-11.5 157.1 L-9.9 157.6 L-7.6 159.6 L-8.5 160.5 L-11.7 160.8 L-17.4 156.2
  L-19.2 149.0 L-18.0 146.7 L-17.4 143.5 L-12.6 136.1 L-12.4 134.3 L-10.8 131.3 L-10.3 127.9 L-7.2 122.0
  L-6.7 119.1 L-5.4 116.8 L-3.5 111.6 L-3.3 109.4 L-1.7 107.1 L-1.3 104.6 L0.5 100.8 L3.5 96.7
  L4.2 94.6 L5.5 93.3 L8.0 87.8 L8.9 86.9 L9.8 83.5 L10.9 81.7 L13.0 75.4 L13.2 71.5
  L14.8 67.9 L13.0 65.0 L13.2 62.9 L20.0 54.3 L23.6 50.9 L28.4 48.5 L32.9 47.1 L37.0 46.6
  L39.0 45.1 L41.3 44.2 L46.7 39.6 L47.2 36.5 L45.8 33.5 L45.1 29.2 L44.2 27.4 L44.0 21.1
  L44.7 18.6 L44.2 12.2 L47.2 7.0 L47.6 3.8 L50.8 1.1 L56.0 0.0 Z M84.8 74.7
  L87.0 74.9 L90.0 76.5 L106.3 96.2 L105.1 98.0 L104.9 100.1 L103.5 102.1 L103.1 104.2 L100.2 108.7
  L99.5 110.7 L91.8 122.9 L88.4 126.1 L86.3 125.9 L82.3 121.6 L82.7 119.8 L80.2 115.5 L79.8 110.3
  L78.2 107.3 L78.0 95.8 L78.2 94.6 L80.0 92.6 L80.2 89.2 L81.1 86.0 L80.7 82.2 L84.8 74.7
  Z M27.9 77.2 L29.1 77.9 L30.9 85.4 L30.9 101.2 L29.1 111.8 L28.6 119.8 L29.1 129.7
  L26.8 134.5 L23.8 137.4 L23.4 139.5 L22.3 140.2 L20.7 138.6 L20.0 136.3 L15.2 131.5 L11.8 131.3
  L10.3 130.4 L3.9 129.3 L1.0 130.0 L-2.9 133.1 L-3.5 132.0 L-3.1 130.2 L1.9 123.6 L2.3 122.0
  L9.4 113.0 L16.2 102.3 L16.8 99.2 L18.2 97.4 L22.5 88.1 L23.4 87.2 L23.8 85.1 L25.2 83.5
  L27.0 78.3 L27.9 77.2 Z`;

const VOLLEY_W3_TRACE = `M19.2 0.0 L25.8 0.0 L28.5 1.8 L33.3 3.6 L35.3 6.1 L35.7 10.0 L38.2 16.3 L38.2 18.6
  L37.6 20.1 L37.8 24.9 L37.1 30.1 L34.4 35.1 L28.7 39.1 L28.3 40.5 L28.7 44.3 L31.4 46.8
  L37.8 50.7 L44.6 51.4 L48.0 52.3 L53.8 56.3 L57.2 60.2 L62.7 69.2 L68.6 76.9 L77.6 86.4
  L86.7 88.7 L94.8 88.9 L107.5 90.3 L109.5 90.0 L111.8 88.7 L113.1 87.1 L113.1 85.3 L108.6 80.8
  L108.1 78.5 L106.6 76.7 L106.1 71.3 L106.8 69.7 L106.1 67.0 L106.8 64.0 L110.6 60.2 L111.3 57.9
  L115.6 54.3 L118.6 54.3 L122.9 52.5 L127.1 52.5 L128.7 53.6 L133.0 54.3 L136.4 57.2 L138.5 60.0
  L140.3 63.3 L141.4 67.0 L141.6 72.6 L139.6 79.9 L140.3 83.0 L133.9 89.8 L127.8 93.7 L120.4 94.1
  L116.7 95.5 L109.7 96.8 L94.8 98.0 L86.9 99.3 L71.3 99.3 L62.7 92.1 L53.4 83.0 L51.6 82.1
  L50.5 82.8 L50.0 105.9 L51.6 113.8 L51.8 117.6 L53.4 121.9 L55.2 140.7 L55.4 149.3 L58.6 155.7
  L59.0 157.9 L60.9 160.4 L62.4 164.7 L62.9 167.9 L64.3 170.1 L64.9 175.1 L65.8 176.7 L66.7 181.7
  L68.1 184.6 L68.6 188.9 L69.7 191.4 L70.4 195.5 L71.5 197.5 L72.2 202.7 L73.3 204.5 L73.5 207.0
  L74.9 211.1 L75.1 216.1 L73.5 223.1 L73.3 230.1 L71.9 237.1 L71.5 250.0 L69.9 258.6 L70.1 272.9
  L70.8 274.7 L75.1 279.2 L76.0 281.2 L80.5 287.1 L83.0 289.6 L87.6 291.6 L89.4 293.4 L90.0 296.2
  L89.8 297.7 L87.1 299.1 L81.0 300.0 L74.2 299.5 L70.4 298.0 L69.2 296.8 L65.6 295.0 L59.3 294.6
  L57.0 293.4 L53.8 293.0 L52.3 291.4 L52.3 289.4 L53.8 286.9 L55.0 283.3 L55.4 277.4 L57.7 273.3
  L57.5 267.6 L55.7 261.1 L55.4 256.3 L54.1 250.7 L53.6 245.2 L53.6 235.1 L55.4 225.8 L55.4 219.2
  L53.6 213.8 L52.0 211.1 L51.6 208.8 L50.7 207.9 L48.0 201.8 L46.8 200.7 L44.1 194.8 L41.6 191.0
  L40.7 188.2 L38.2 184.6 L37.3 181.9 L36.0 180.5 L35.3 178.3 L32.6 174.2 L29.6 167.9 L28.7 167.9
  L27.8 169.2 L26.2 177.8 L24.9 180.5 L24.4 185.3 L23.3 187.1 L22.4 191.9 L21.3 193.7 L20.8 197.7
  L19.2 200.7 L18.8 209.7 L17.6 211.8 L17.2 214.5 L15.6 216.5 L14.0 221.0 L13.6 270.1 L14.0 274.7
  L16.3 281.4 L19.0 284.6 L19.5 286.4 L21.3 289.1 L28.1 295.7 L30.1 299.5 L29.6 300.0 L1.4 300.0
  L-0.2 297.7 L-0.2 294.6 L1.4 290.5 L1.6 284.8 L2.9 282.8 L3.4 278.5 L2.9 274.2 L1.4 269.7
  L1.1 264.9 L-0.2 260.9 L-0.5 257.0 L-2.0 253.2 L-2.5 247.5 L-3.8 243.4 L-4.3 237.3 L-5.2 233.9
  L-3.8 221.9 L-2.5 217.2 L-2.0 211.5 L-0.7 207.2 L-0.2 199.5 L-0.7 195.2 L-1.8 192.5 L-2.5 177.8
  L-3.8 173.8 L-4.3 167.0 L-5.2 163.3 L-6.3 146.6 L-5.7 142.5 L-2.7 136.9 L-2.3 130.8 L-2.7 129.4
  L-4.1 128.1 L-10.6 126.2 L-23.3 117.0 L-38.2 103.4 L-39.4 102.9 L-41.4 100.5 L-41.6 99.1 L-40.3 95.9
  L-39.8 91.9 L-36.2 84.2 L-29.6 76.7 L-23.8 67.6 L-18.6 61.8 L-8.8 52.5 L-6.1 50.9 L-0.9 50.0
  L2.7 46.2 L3.4 43.7 L3.2 42.5 L1.6 40.7 L1.1 36.7 L-0.5 34.6 L-0.2 32.8 L1.1 30.1
  L0.0 25.6 L0.9 23.8 L1.8 19.0 L2.9 16.7 L5.0 7.0 L7.5 3.8 L10.0 2.3 L13.3 1.8
  L15.6 0.2 L19.2 0.0 Z M-8.8 78.7 L-6.8 79.6 L-2.7 83.7 L-2.0 86.0 L-0.5 87.3
  L1.4 91.4 L2.9 93.0 L2.9 95.9 L4.5 98.2 L4.3 103.8 L0.9 109.3 L1.8 113.3 L1.1 114.7
  L-2.9 119.0 L-4.1 119.0 L-5.4 117.6 L-6.6 117.4 L-15.8 110.0 L-27.4 96.6 L-26.0 94.3 L-19.5 87.3
  L-10.6 79.6 L-8.8 78.7 Z`;

const VOLLEY_W4_TRACE = `M73.1 0.0 L82.7 0.6 L85.8 1.9 L90.6 6.4 L92.0 8.6 L93.7 15.4 L92.4 19.8 L93.0 21.0
  L106.4 29.2 L107.7 27.6 L109.9 22.7 L111.8 21.8 L112.4 22.4 L112.2 22.9 L109.7 26.4 L109.5 27.8
  L110.5 28.4 L111.8 26.6 L112.6 27.0 L112.6 28.4 L110.9 29.7 L110.9 30.5 L113.2 32.7 L115.5 31.1
  L116.1 31.5 L115.7 33.1 L112.8 36.4 L109.5 42.0 L109.1 62.0 L108.1 66.7 L107.9 71.2 L106.2 77.0
  L103.5 81.7 L100.0 89.6 L98.8 90.8 L96.7 95.5 L95.7 96.4 L91.6 104.8 L92.8 112.0 L91.6 124.2
  L92.2 133.0 L93.7 137.3 L95.1 147.0 L94.9 157.1 L93.7 168.0 L93.9 172.1 L95.7 177.9 L98.4 182.4
  L98.8 184.9 L100.2 187.4 L100.4 190.7 L101.5 195.4 L102.1 205.7 L103.3 212.3 L103.3 221.3 L103.7 222.4
  L106.4 224.8 L106.4 228.6 L104.8 233.9 L103.3 236.2 L91.0 247.1 L86.2 252.6 L78.6 264.0 L75.3 270.1
  L74.5 272.4 L75.9 275.3 L74.7 280.2 L75.1 286.6 L77.0 290.7 L79.7 293.4 L81.3 296.3 L81.1 298.1
  L79.6 300.0 L75.5 299.6 L66.9 293.6 L63.2 290.1 L52.1 276.9 L52.3 274.7 L54.5 272.6 L57.6 270.6
  L62.1 268.9 L64.4 266.4 L69.1 257.0 L69.2 255.3 L72.0 248.3 L72.6 245.0 L75.7 238.8 L79.0 234.1
  L85.0 227.5 L85.4 225.7 L83.1 216.6 L81.9 214.8 L79.9 207.5 L78.8 205.7 L78.2 202.2 L77.4 201.4
  L76.1 202.2 L70.6 217.2 L69.4 218.5 L65.7 226.3 L62.4 230.8 L60.3 232.7 L55.6 234.3 L50.2 232.9
  L47.3 231.4 L35.8 223.6 L18.3 210.2 L9.6 204.7 L8.2 205.5 L9.8 207.6 L8.4 209.6 L7.4 209.6
  L5.5 207.6 L4.1 205.3 L2.2 204.7 L-6.0 205.1 L-13.6 207.6 L-16.1 206.1 L-15.9 202.6 L-14.4 199.9
  L-12.2 197.7 L-8.1 194.8 L0.2 191.3 L4.9 187.0 L12.5 184.3 L14.4 186.5 L16.9 195.0 L18.9 196.8
  L40.3 205.5 L45.1 208.6 L49.6 212.9 L50.4 212.9 L51.4 211.7 L52.1 205.1 L53.7 199.3 L54.9 189.4
  L55.1 181.4 L54.3 174.2 L55.2 167.0 L56.6 164.5 L57.0 162.3 L61.9 156.1 L62.4 154.6 L62.6 143.5
  L61.3 138.2 L56.6 129.9 L45.5 115.1 L40.7 110.6 L29.2 103.8 L21.6 97.8 L13.4 89.4 L13.3 86.7
  L23.0 69.0 L27.8 62.2 L28.8 58.1 L32.1 54.4 L32.7 52.9 L32.3 50.4 L33.9 46.7 L35.4 47.2
  L35.6 48.8 L36.6 50.0 L37.4 49.4 L38.1 47.4 L39.5 46.9 L40.1 47.4 L39.3 50.2 L39.3 51.7
  L39.9 52.3 L41.1 51.5 L43.2 48.0 L44.4 48.4 L44.2 50.4 L44.8 50.9 L46.9 49.6 L48.1 49.8
  L48.4 50.7 L37.4 60.3 L33.7 64.4 L31.3 70.2 L28.8 74.3 L26.9 81.7 L25.5 84.2 L25.9 86.1
  L28.2 88.5 L35.2 92.9 L41.8 96.2 L47.7 97.8 L48.3 97.0 L46.5 95.9 L44.6 91.8 L43.0 84.4
  L43.2 82.0 L44.8 77.6 L47.7 73.5 L49.8 71.7 L53.7 70.0 L57.2 70.2 L58.4 71.4 L62.4 73.1
  L65.4 75.2 L67.5 78.2 L70.6 84.0 L70.4 86.3 L69.1 89.2 L68.9 93.9 L69.4 95.5 L70.8 96.6
  L78.6 96.4 L80.9 95.9 L85.0 92.0 L89.3 86.5 L95.1 76.8 L98.2 69.8 L99.0 64.0 L100.4 60.1
  L102.1 47.6 L103.3 44.3 L103.7 37.3 L103.1 35.4 L101.1 33.1 L90.2 26.2 L84.0 30.9 L81.5 31.9
  L76.4 32.5 L71.2 30.7 L65.4 26.1 L62.4 21.2 L61.5 13.2 L63.0 10.3 L63.4 7.4 L69.6 1.9
  L73.1 0.0 Z`;

/* Boxing — Victory. Both arms up, gloves raised. The one that wins a fight. */
const BOX_VICTORY_TRACE = `M91.9 0.0 L96.3 0.2 L100.1 3.0 L104.4 7.9 L106.4 11.8 L109.2 14.0 L116.9 22.5 L117.3 23.4
  L116.8 24.7 L125.7 36.3 L128.9 42.9 L130.6 49.4 L132.4 53.0 L132.4 56.5 L129.4 59.8 L113.8 68.0
  L104.7 70.3 L99.0 70.5 L92.4 69.5 L90.2 69.8 L88.6 72.2 L86.4 79.6 L78.6 94.2 L75.1 106.5
  L75.1 109.8 L75.7 112.3 L75.4 116.7 L76.5 118.0 L77.0 121.3 L76.5 123.8 L77.1 126.8 L80.1 129.3
  L82.3 132.6 L85.5 139.5 L88.1 147.2 L90.0 155.0 L93.7 178.9 L94.9 183.9 L91.6 185.2 L91.0 193.0
  L89.7 198.7 L91.6 205.9 L92.7 213.5 L96.8 222.4 L98.4 228.4 L100.3 256.6 L100.4 258.0 L101.8 259.6
  L101.8 267.9 L102.5 269.6 L102.8 274.4 L104.8 276.7 L106.9 281.6 L117.6 292.9 L118.5 299.1 L116.8 300.0
  L100.6 300.0 L97.3 296.9 L92.1 294.8 L90.8 293.6 L90.4 279.2 L89.7 276.1 L90.2 273.7 L89.1 271.4
  L89.4 269.8 L88.5 266.2 L86.4 261.6 L86.9 259.6 L83.9 250.3 L79.8 243.8 L78.1 238.6 L77.5 233.5
  L77.5 222.8 L76.8 219.6 L71.9 210.0 L66.3 195.1 L64.4 194.4 L61.1 194.4 L57.9 195.4 L57.5 195.1
  L51.5 171.2 L49.4 169.4 L48.7 171.0 L47.9 180.6 L46.9 183.4 L45.2 197.6 L41.9 198.5 L36.7 198.4
  L36.2 198.8 L34.8 203.4 L27.7 220.4 L28.4 229.4 L28.1 237.7 L27.1 243.1 L23.0 252.5 L21.8 258.8
  L22.7 260.0 L22.7 261.1 L21.6 264.3 L20.7 270.1 L21.3 274.0 L20.5 276.1 L21.0 276.9 L20.5 281.3
  L21.8 287.3 L21.1 295.3 L18.5 297.2 L14.8 298.0 L10.3 299.8 L1.3 300.0 L-3.3 299.5 L-5.1 298.9
  L-5.9 298.0 L-5.5 293.7 L-4.4 291.8 L0.7 286.9 L0.8 286.0 L4.6 281.3 L5.7 278.6 L5.6 277.7
  L6.8 276.4 L7.1 274.8 L8.1 273.7 L7.3 272.3 L7.8 271.2 L7.1 270.3 L7.8 269.0 L7.8 266.6
  L6.8 260.2 L7.9 259.1 L7.9 257.4 L6.5 233.0 L7.8 224.8 L11.5 214.1 L13.3 200.7 L12.2 193.2
  L7.1 191.1 L5.4 190.0 L4.6 188.8 L7.4 173.4 L9.6 166.1 L11.5 153.5 L13.7 145.5 L15.0 138.0
  L16.7 134.2 L19.7 130.9 L21.1 127.9 L20.8 126.6 L21.1 123.2 L21.8 121.9 L21.8 119.1 L24.0 117.7
  L23.0 114.2 L23.0 106.3 L21.1 98.3 L15.5 87.8 L8.1 71.7 L7.3 70.9 L3.0 72.2 L-1.2 72.7
  L-10.2 71.9 L-19.5 69.4 L-30.0 64.5 L-32.4 62.1 L-32.4 57.7 L-30.3 49.2 L-26.5 39.8 L-18.0 28.8
  L-18.5 27.2 L-18.2 25.6 L-11.4 16.2 L-9.9 14.8 L-7.0 8.0 L-2.6 2.7 L0.8 0.8 L2.6 0.8
  L5.4 1.7 L11.9 6.0 L15.5 9.3 L17.0 11.5 L17.8 13.5 L17.8 15.3 L16.6 18.6 L14.2 20.8
  L11.9 21.4 L10.6 20.5 L7.1 23.0 L3.2 23.9 L1.6 26.0 L-0.9 27.8 L-5.5 34.5 L-6.7 35.7
  L-7.5 35.1 L-8.3 35.7 L-10.3 43.6 L-11.3 50.2 L-10.8 50.7 L-7.2 49.4 L-3.4 49.1 L0.2 49.7
  L4.1 51.3 L10.3 48.1 L16.6 47.5 L21.4 48.6 L26.5 51.9 L27.9 52.2 L36.4 48.6 L36.9 48.1
  L37.0 45.9 L36.9 41.2 L35.6 38.1 L35.0 33.5 L32.6 30.2 L31.8 26.9 L32.1 24.7 L34.0 24.1
  L33.9 13.7 L35.4 10.2 L37.7 7.7 L43.9 5.3 L48.3 4.9 L50.9 5.2 L57.0 8.0 L59.2 9.8
  L60.9 12.9 L61.6 17.3 L60.9 24.2 L62.8 25.2 L62.8 27.4 L60.8 32.4 L59.0 34.3 L57.5 41.2
  L57.9 45.6 L59.2 47.2 L70.1 51.8 L74.5 48.3 L78.1 46.7 L81.2 46.1 L86.9 46.4 L90.2 47.5
  L93.2 49.2 L100.6 46.4 L103.9 46.1 L110.6 47.0 L111.1 46.6 L109.9 37.9 L107.5 32.7 L106.9 32.1
  L106.1 32.7 L100.9 26.6 L96.0 22.3 L92.6 22.0 L88.8 20.1 L87.4 21.1 L85.6 20.8 L83.0 19.2
  L80.6 15.9 L80.3 12.4 L83.1 7.4 L87.4 2.8 L91.9 0.0 Z`;

/* Boxing — Guard. Side on, hands up, chin tucked. */
const BOX_GUARD_TRACE = `M36.2 0.0 L42.9 0.0 L46.0 0.7 L50.0 2.4 L53.1 5.3 L56.0 11.1 L56.5 13.8 L56.2 19.2
  L58.7 20.7 L60.0 23.6 L62.9 26.1 L76.1 30.7 L82.7 36.3 L88.3 43.4 L92.1 49.9 L93.4 53.7
  L94.5 60.4 L94.1 74.8 L92.8 82.4 L92.5 88.4 L91.0 96.2 L92.1 98.2 L91.4 104.2 L92.3 108.2
  L95.4 116.9 L99.0 123.2 L100.3 127.4 L101.4 133.9 L101.4 155.2 L100.1 172.8 L98.3 182.0 L97.2 183.5
  L89.9 183.5 L79.4 184.4 L78.3 185.5 L78.3 192.7 L79.6 206.9 L85.4 218.9 L88.5 229.8 L89.2 238.3
  L88.8 261.7 L92.1 276.8 L92.3 283.1 L95.0 290.6 L95.2 292.7 L93.9 294.9 L92.1 295.5 L83.2 296.2
  L75.6 298.4 L66.5 300.0 L58.0 300.0 L55.8 299.6 L54.5 299.1 L53.1 297.8 L52.9 296.0 L53.6 294.2
  L56.0 291.8 L70.3 282.4 L71.8 280.2 L71.6 278.6 L58.5 278.0 L46.0 279.5 L34.9 279.7 L30.0 278.6
  L28.2 277.7 L26.8 275.9 L27.1 274.4 L29.3 272.4 L35.1 270.4 L38.9 269.7 L49.6 264.4 L51.6 262.4
  L53.6 256.3 L53.3 249.4 L50.4 240.8 L50.4 239.2 L51.3 237.0 L41.5 217.8 L38.0 209.4 L29.5 198.2
  L27.7 193.1 L27.7 190.2 L29.5 186.0 L32.0 176.8 L31.7 172.8 L35.1 148.8 L40.9 132.5 L42.2 123.4
  L43.1 120.7 L46.2 116.7 L45.5 112.7 L45.5 106.7 L44.2 101.8 L44.2 98.4 L45.8 96.0 L44.2 94.2
  L43.3 92.0 L43.1 83.5 L41.5 75.9 L38.2 69.7 L36.2 63.0 L35.3 62.1 L27.5 72.4 L21.5 78.6
  L19.9 81.7 L18.6 83.1 L15.9 84.2 L14.1 84.2 L10.4 82.9 L8.1 80.6 L5.5 73.9 L4.6 65.9
  L2.8 59.2 L2.6 53.0 L3.2 48.6 L0.3 44.3 L-1.2 37.2 L-1.2 33.0 L0.1 29.4 L2.1 26.3
  L6.6 22.0 L9.9 20.5 L12.1 20.5 L18.8 23.2 L20.6 24.9 L21.7 27.6 L22.4 34.5 L21.0 38.1
  L17.7 42.3 L15.9 47.0 L15.9 49.2 L16.8 53.5 L17.7 54.3 L21.3 51.2 L23.9 49.9 L24.4 49.2
  L24.2 47.2 L24.8 42.5 L28.4 32.7 L25.5 28.1 L22.8 21.4 L21.9 17.6 L22.2 13.6 L24.2 8.7
  L28.8 2.9 L31.3 1.3 L36.2 0.0 Z`;

/* Boxing — Stance. Squared up, gloves down, feet planted wide. */
const BOX_STANCE_TRACE = `M49.7 0.0 L58.6 1.1 L62.9 4.3 L66.6 5.6 L69.6 8.3 L71.5 11.5 L72.3 15.0 L72.0 17.4
  L69.1 20.1 L69.3 22.8 L67.7 26.0 L69.3 30.6 L69.1 31.7 L67.4 33.5 L66.9 37.6 L65.0 40.0
  L64.2 42.9 L61.8 44.8 L60.7 46.4 L62.3 48.6 L65.0 49.4 L66.1 50.4 L66.9 53.1 L67.7 53.9
  L69.9 54.5 L71.7 56.6 L75.5 57.2 L77.9 58.5 L81.7 62.8 L84.6 70.6 L84.3 75.4 L82.2 77.8
  L81.9 79.4 L84.3 85.1 L87.6 95.3 L88.4 96.3 L90.3 103.0 L94.0 106.3 L97.8 113.0 L98.0 114.6
  L99.1 116.2 L100.7 124.2 L101.8 126.1 L102.1 129.1 L103.1 131.5 L104.2 132.6 L105.8 132.6 L108.5 133.6
  L110.1 135.2 L111.2 137.4 L111.7 140.3 L112.8 141.7 L114.1 146.5 L114.4 149.7 L116.5 151.6 L117.9 154.0
  L122.2 166.4 L122.5 172.3 L121.9 175.0 L119.0 178.7 L114.9 181.1 L109.0 181.9 L105.3 181.7 L102.3 180.9
  L98.6 177.9 L97.0 174.4 L97.0 169.6 L98.3 165.0 L99.6 162.9 L99.6 160.5 L100.4 158.3 L100.2 154.6
  L97.2 149.7 L95.3 143.6 L94.5 142.5 L94.0 138.7 L84.9 126.9 L83.3 121.8 L80.9 116.7 L79.2 108.4
  L75.0 102.8 L73.3 102.8 L72.3 104.4 L72.5 110.6 L74.2 113.2 L75.5 118.1 L77.4 121.0 L78.2 128.0
  L79.2 130.4 L81.9 133.9 L84.6 142.2 L84.6 144.9 L86.0 148.4 L86.0 151.1 L87.0 153.8 L87.3 158.1
  L88.6 162.1 L90.0 172.5 L91.3 176.6 L91.3 180.6 L94.0 192.4 L94.0 195.3 L95.3 198.8 L94.8 200.4
  L91.6 203.4 L91.3 205.8 L92.4 207.7 L93.7 213.6 L93.7 216.0 L92.7 218.7 L92.7 225.4 L95.3 231.3
  L95.6 233.7 L96.7 236.4 L96.7 240.7 L98.0 248.2 L98.0 272.6 L99.1 274.2 L101.8 275.0 L102.9 276.1
  L103.7 280.1 L106.6 282.3 L107.2 283.9 L106.1 286.6 L107.4 289.5 L112.3 293.0 L114.7 295.7 L114.9 296.8
  L114.4 298.4 L113.3 299.5 L111.7 300.0 L86.8 300.0 L85.2 299.5 L84.1 298.4 L83.5 296.2 L84.9 293.3
  L85.2 289.5 L84.9 275.0 L81.9 263.2 L79.5 258.1 L75.8 253.3 L72.8 245.0 L72.5 234.0 L73.9 227.3
  L72.8 224.6 L72.8 221.1 L71.7 219.2 L71.5 216.0 L70.4 213.9 L69.6 209.0 L68.8 207.7 L67.7 207.2
  L64.2 208.2 L59.7 208.5 L58.1 208.0 L56.7 206.4 L55.1 197.8 L53.5 196.7 L51.9 197.8 L51.1 201.5
  L51.1 205.5 L50.5 207.2 L49.5 208.2 L46.8 208.8 L44.6 208.2 L33.9 208.0 L32.3 209.0 L29.1 217.1
  L21.8 228.6 L20.2 232.9 L19.9 240.2 L18.3 250.4 L15.9 256.0 L10.8 262.4 L6.8 273.2 L6.8 274.8
  L5.7 277.5 L6.8 280.7 L6.8 283.1 L5.5 286.3 L5.5 288.7 L3.6 298.4 L2.5 299.5 L0.9 300.0
  L-10.6 300.0 L-13.1 298.7 L-13.9 296.8 L-12.8 292.8 L-11.4 290.6 L-12.5 287.4 L-12.0 285.8 L-10.1 283.4
  L-10.1 278.5 L-6.4 275.0 L-6.1 274.2 L-6.1 270.5 L-5.3 265.9 L-5.0 245.8 L-3.9 243.1 L-3.7 239.1
  L0.4 230.2 L5.2 223.8 L5.7 221.4 L7.1 219.2 L7.1 217.1 L8.4 212.5 L9.5 210.6 L9.5 204.7
  L7.9 201.5 L8.4 199.9 L8.4 196.7 L9.5 193.7 L10.0 187.0 L11.1 184.3 L11.1 181.4 L12.4 176.0
  L12.4 172.8 L13.8 168.8 L14.0 164.5 L15.1 161.5 L15.4 157.2 L16.5 153.5 L16.5 147.6 L17.8 143.6
  L17.8 138.7 L19.1 133.9 L21.6 131.2 L22.6 128.3 L23.2 120.5 L24.5 116.7 L23.4 113.8 L23.2 107.9
  L21.6 104.7 L12.2 93.4 L11.4 93.1 L9.7 94.2 L6.5 102.5 L5.2 104.9 L1.4 109.2 L0.4 112.4
  L0.1 125.8 L-3.1 135.2 L-1.8 139.8 L-1.5 151.1 L3.8 154.8 L7.9 159.4 L9.2 162.1 L10.0 166.4
  L9.5 170.4 L5.7 173.9 L4.9 178.2 L1.4 180.9 L-5.0 182.7 L-14.9 182.7 L-17.9 181.4 L-19.5 179.8
  L-20.8 177.1 L-22.5 170.7 L-22.5 158.9 L-20.6 153.5 L-21.1 148.7 L-20.0 143.6 L-20.0 140.6 L-19.5 137.7
  L-17.4 134.7 L-17.9 132.8 L-17.9 127.2 L-17.1 123.2 L-17.1 115.4 L-16.0 111.9 L-16.0 110.0 L-14.4 104.1
  L-13.3 102.8 L-10.6 94.7 L-10.4 89.1 L-9.3 86.1 L-9.0 82.6 L-8.0 79.2 L-6.6 77.5 L-5.3 73.8
  L-5.0 68.7 L-3.9 66.0 L-3.7 62.8 L-1.0 57.7 L4.1 53.1 L7.1 51.8 L10.0 51.3 L17.8 46.4
  L25.8 43.2 L30.9 39.2 L32.3 37.6 L35.2 29.8 L35.2 23.1 L34.2 19.9 L33.9 15.6 L36.6 8.1
  L37.7 6.7 L38.2 4.8 L41.7 1.9 L46.2 0.3 L48.4 0.5 L49.7 0.0 Z`;

/* Boxing — Ready. Facing front, gloves up and ready to work. */
const BOX_READY_TRACE = `M41.2 0.0 L48.4 0.9 L52.8 3.3 L57.4 7.9 L59.5 12.1 L59.8 21.6 L58.6 26.0 L57.4 27.9
  L57.2 32.6 L55.1 37.0 L56.0 38.6 L64.2 41.4 L72.8 43.0 L78.1 48.4 L80.7 53.0 L80.9 54.4
  L82.3 55.3 L84.2 54.0 L84.4 53.0 L86.5 50.9 L88.6 49.8 L93.0 49.5 L98.1 47.2 L103.5 48.6
  L107.0 50.7 L110.9 54.7 L113.3 58.4 L115.3 65.1 L115.3 68.1 L113.3 73.5 L107.7 78.6 L106.0 82.8
  L101.4 87.2 L99.3 90.9 L95.1 95.6 L92.1 96.3 L88.4 95.6 L85.8 94.4 L80.9 89.3 L77.7 84.9
  L74.9 79.8 L73.0 78.4 L71.4 80.0 L70.2 88.4 L69.1 92.8 L69.1 106.3 L70.9 109.3 L71.4 115.1
  L72.8 119.8 L77.0 123.7 L79.3 129.8 L79.5 132.3 L80.7 135.3 L80.7 138.4 L81.9 142.1 L83.0 150.5
  L85.3 160.0 L86.5 170.0 L90.0 184.0 L90.2 189.1 L87.9 191.4 L87.7 192.3 L88.6 194.4 L91.4 206.7
  L94.7 214.0 L95.8 215.3 L98.1 222.8 L99.3 229.8 L100.2 245.3 L102.1 248.8 L102.8 253.5 L102.8 265.1
  L104.0 273.0 L105.3 277.4 L107.4 281.6 L110.7 286.0 L113.3 291.4 L113.0 296.3 L111.2 298.8 L109.3 299.5
  L102.6 300.0 L98.6 299.3 L95.3 297.9 L94.0 296.3 L93.5 291.6 L90.7 288.8 L90.2 287.4 L90.5 283.3
  L91.4 280.2 L90.2 276.0 L90.2 267.0 L86.3 255.1 L85.3 248.1 L83.3 243.3 L80.9 239.5 L78.8 234.2
  L77.0 218.8 L76.0 216.5 L71.9 210.0 L68.1 200.2 L67.2 199.3 L57.2 199.5 L55.8 199.1 L54.4 197.7
  L49.5 175.3 L48.4 172.6 L46.3 170.9 L44.7 172.1 L42.3 180.7 L42.3 182.6 L41.2 186.7 L40.2 197.7
  L39.5 200.0 L38.4 201.2 L37.0 201.6 L21.9 201.9 L20.5 203.3 L19.1 207.2 L17.0 210.7 L16.5 212.3
  L16.7 225.6 L13.3 233.0 L13.0 238.6 L11.9 243.7 L12.1 250.9 L14.0 257.0 L13.0 260.7 L9.3 264.4
  L3.7 267.9 L3.5 269.3 L2.1 271.4 L2.3 274.0 L1.6 276.3 L-1.2 279.3 L-6.7 281.6 L-10.9 281.9
  L-13.7 280.7 L-15.3 277.9 L-14.2 271.9 L-13.0 269.5 L-4.2 257.7 L-1.6 253.0 L-1.2 245.8 L-1.6 242.6
  L-2.8 239.5 L-2.8 235.1 L-1.6 231.9 L-2.8 228.4 L-3.3 218.6 L-2.8 214.7 L-1.6 211.9 L-1.4 206.5
  L0.5 199.1 L-2.8 195.8 L-3.3 194.4 L-1.4 185.8 L-0.5 184.0 L-0.2 181.2 L0.7 179.1 L0.9 176.3
  L1.9 174.2 L3.0 166.7 L4.2 164.0 L4.2 161.6 L5.1 158.8 L7.7 144.2 L7.7 139.8 L8.8 134.2
  L11.4 127.4 L15.6 122.1 L16.3 117.2 L16.0 113.0 L17.9 108.8 L17.7 105.3 L17.0 103.5 L15.6 102.6
  L11.6 105.1 L1.6 109.3 L-0.9 108.4 L-3.7 105.6 L-4.9 103.5 L-6.3 96.7 L-6.0 83.7 L-4.9 78.8
  L-2.8 74.4 L-2.3 71.6 L-2.8 62.6 L-1.4 56.7 L0.9 52.3 L3.5 49.5 L10.0 47.0 L14.7 44.0
  L20.2 41.4 L24.9 40.0 L28.4 37.0 L29.1 32.8 L26.5 27.7 L25.8 24.7 L27.2 19.5 L27.7 11.4
  L30.0 6.5 L33.0 3.3 L37.0 0.9 L41.2 0.0 Z`;

/* Football — Strike. Striking: plant foot down, arms wide for balance. */
const FOOT_STRIKE_TRACE = `M55.2 0.0 L66.0 0.7 L69.2 2.3 L71.2 4.2 L73.2 8.2 L73.8 11.7 L73.5 21.5 L75.1 25.4
  L73.2 30.3 L68.9 35.9 L66.3 46.0 L67.6 51.8 L71.5 55.4 L74.1 55.8 L78.4 55.1 L82.3 56.1
  L90.1 61.0 L96.6 66.8 L98.6 67.5 L105.1 72.1 L113.9 74.0 L118.5 77.3 L123.7 78.9 L129.9 81.8
  L134.5 81.5 L138.7 83.5 L141.3 83.5 L144.9 85.1 L147.5 85.4 L150.8 88.0 L154.0 88.7 L156.0 90.0
  L160.2 91.3 L162.5 92.9 L164.5 93.6 L165.8 94.9 L170.7 96.8 L171.6 97.8 L174.9 98.5 L176.2 99.5
  L184.0 101.4 L187.3 103.0 L192.5 102.7 L200.0 101.1 L202.6 101.4 L210.8 108.3 L211.7 110.9 L211.4 112.2
  L209.8 114.1 L207.8 114.8 L205.9 114.5 L203.6 115.1 L202.0 114.5 L192.2 114.5 L189.6 113.8 L184.0 110.9
  L182.1 110.9 L176.8 109.2 L174.6 109.2 L170.3 107.6 L158.9 107.6 L155.7 107.3 L150.4 105.7 L147.2 106.0
  L142.0 104.0 L135.1 104.3 L132.5 103.0 L125.3 101.1 L120.8 98.2 L118.8 97.8 L117.2 96.8 L111.0 95.9
  L102.8 93.3 L93.7 92.6 L91.1 92.0 L84.9 92.0 L83.3 92.6 L77.1 100.8 L76.7 102.4 L73.8 108.3
  L71.5 115.8 L68.9 120.7 L68.3 125.5 L68.3 132.4 L67.0 136.6 L65.3 138.6 L64.0 141.5 L63.4 146.4
  L62.1 148.7 L61.1 154.9 L62.1 160.8 L61.7 162.1 L57.2 167.3 L56.8 168.3 L57.2 169.9 L61.7 178.0
  L62.1 184.6 L63.7 189.1 L63.7 192.1 L62.4 195.3 L63.4 200.5 L63.4 205.4 L62.1 211.0 L62.4 213.6
  L61.4 216.8 L58.5 221.4 L54.6 226.0 L53.6 229.2 L44.5 240.0 L43.8 242.6 L25.2 260.9 L19.3 265.1
  L16.1 266.1 L8.9 272.3 L2.1 279.5 L2.1 285.0 L5.0 289.6 L7.6 292.2 L8.9 292.5 L10.9 294.8
  L10.9 297.4 L9.2 299.3 L7.3 300.0 L-12.0 300.0 L-13.9 299.3 L-20.4 300.0 L-24.3 298.4 L-27.6 298.0
  L-33.2 300.0 L-40.3 299.7 L-42.6 298.4 L-45.2 298.0 L-49.5 295.4 L-53.4 291.5 L-56.3 286.0 L-57.3 280.4
  L-57.0 273.9 L-56.3 271.3 L-53.0 265.4 L-50.4 262.8 L-45.9 259.6 L-40.7 257.9 L-31.8 257.9 L-27.0 259.6
  L-25.0 261.2 L-23.7 261.5 L-18.2 267.4 L-15.9 273.3 L-14.6 274.6 L-12.6 274.6 L6.6 253.4 L7.3 251.7
  L9.9 248.5 L10.2 246.8 L11.2 245.5 L11.2 242.6 L12.2 238.7 L13.5 236.4 L19.0 230.5 L26.5 225.0
  L31.4 220.1 L33.0 217.8 L33.0 215.5 L26.8 210.3 L26.2 207.7 L25.2 206.7 L24.9 205.4 L18.7 199.2
  L17.1 196.3 L16.7 194.3 L13.8 192.1 L9.2 187.2 L7.3 186.8 L-10.3 195.7 L-14.6 198.6 L-16.8 199.2
  L-20.4 201.8 L-21.7 202.2 L-24.3 204.8 L-27.9 205.8 L-30.5 205.8 L-44.9 216.8 L-46.5 217.2 L-47.8 218.2
  L-51.1 218.8 L-59.6 218.8 L-63.5 216.8 L-66.1 216.2 L-71.0 211.3 L-74.2 207.1 L-74.9 205.1 L-76.2 203.5
  L-76.5 201.5 L-77.5 199.9 L-78.2 195.7 L-79.5 194.0 L-89.2 194.0 L-93.5 195.3 L-96.1 195.0 L-99.0 192.1
  L-99.0 186.2 L-97.1 182.0 L-93.8 178.7 L-88.9 175.4 L-76.5 174.8 L-73.9 173.5 L-65.1 171.5 L-63.2 172.2
  L-59.2 176.7 L-58.6 178.7 L-58.6 181.0 L-59.2 182.6 L-58.9 183.6 L-57.0 184.9 L-54.3 187.8 L-52.4 187.8
  L-51.4 186.8 L-49.1 182.0 L-45.5 178.4 L-40.0 170.9 L-32.5 163.4 L-30.9 162.7 L-29.2 161.1 L-27.3 156.5
  L-25.7 154.9 L-24.7 154.6 L-20.8 150.3 L-16.8 147.4 L-12.0 142.2 L-9.3 140.5 L-5.8 137.0 L-5.8 133.7
  L-5.1 131.7 L-0.2 127.8 L0.1 126.5 L-0.9 123.9 L0.4 120.7 L-0.9 117.4 L-1.5 113.5 L-0.9 111.5
  L2.7 107.9 L3.0 104.3 L4.7 100.1 L3.7 96.8 L5.0 93.6 L4.0 91.0 L4.3 89.0 L2.7 84.8
  L2.7 81.8 L3.7 79.2 L3.7 77.6 L3.0 76.3 L1.4 75.3 L-15.5 75.3 L-19.5 76.6 L-28.9 77.3
  L-32.2 78.6 L-34.5 77.9 L-36.4 78.3 L-39.7 77.0 L-53.4 77.6 L-57.3 78.6 L-59.2 77.9 L-62.8 77.9
  L-65.8 77.0 L-79.8 77.0 L-84.0 77.9 L-87.0 79.9 L-88.9 80.2 L-93.2 84.5 L-97.1 86.1 L-102.0 84.8
  L-103.9 84.8 L-107.2 86.1 L-108.8 85.8 L-111.1 83.5 L-111.7 80.9 L-111.4 78.9 L-108.5 73.7 L-106.5 71.7
  L-101.6 69.1 L-99.0 68.5 L-91.8 68.5 L-88.6 67.2 L-84.3 67.2 L-78.8 65.5 L-75.2 65.5 L-70.0 63.9
  L-65.4 63.6 L-62.5 61.3 L-60.5 60.7 L-57.0 61.0 L-53.7 62.0 L-50.4 60.7 L-40.7 61.0 L-36.1 59.0
  L-30.5 59.0 L-23.0 55.8 L-19.1 55.4 L-16.5 54.5 L-12.9 54.5 L-8.0 52.8 L-4.5 52.8 L-1.2 50.5
  L3.0 49.2 L6.0 46.6 L7.9 46.0 L12.2 46.0 L15.4 47.3 L20.0 47.6 L23.6 46.0 L36.3 45.7
  L40.2 41.4 L42.5 39.8 L42.8 38.8 L41.5 34.9 L41.2 29.3 L39.6 25.1 L39.6 20.5 L41.8 15.7
  L42.8 7.8 L44.5 4.9 L47.4 2.3 L51.3 0.7 L55.2 0.0 Z`;

/* Football — Dribble. Running with the ball at the feet. */
const FOOT_DRIBBLE_TRACE = `M63.2 0.0 L67.3 0.3 L71.4 1.9 L75.5 5.2 L78.2 9.8 L79.6 16.1 L79.9 22.6 L80.7 25.6
  L79.9 29.7 L78.5 31.9 L78.8 35.2 L81.5 37.4 L85.3 38.5 L90.8 38.7 L98.7 41.5 L105.8 46.6
  L111.0 51.8 L113.7 55.1 L116.1 59.5 L118.3 65.7 L122.4 74.7 L131.4 91.9 L133.0 96.8 L133.0 108.3
  L131.7 114.0 L131.7 118.1 L130.6 121.6 L130.3 126.3 L129.0 131.5 L129.0 135.0 L127.6 139.1 L127.6 148.4
  L129.0 151.9 L129.0 154.9 L130.0 160.6 L129.0 163.9 L127.6 165.3 L124.9 166.4 L122.1 165.8 L118.9 161.2
  L117.2 161.2 L115.6 162.8 L115.3 163.9 L116.4 166.6 L115.9 168.3 L111.2 174.3 L98.7 196.1 L90.8 206.7
  L85.6 212.5 L85.0 213.8 L86.1 215.5 L87.0 215.7 L94.0 216.0 L97.9 215.5 L102.5 213.0 L108.2 213.3
  L111.2 214.6 L113.7 217.1 L115.0 221.5 L115.3 223.1 L113.7 229.9 L111.5 234.5 L110.1 239.2 L109.9 246.0
  L108.5 249.5 L108.2 252.0 L105.5 257.5 L103.0 261.0 L99.8 264.3 L97.3 265.6 L94.0 266.5 L91.0 266.2
  L88.9 264.3 L88.3 262.6 L88.3 257.2 L89.7 251.2 L89.7 246.5 L91.0 240.5 L91.0 232.6 L89.7 230.7
  L87.8 230.7 L83.7 232.9 L78.5 234.5 L68.1 235.6 L62.1 235.6 L54.5 234.3 L50.4 230.7 L48.8 225.8
  L48.8 217.1 L51.5 209.5 L52.6 208.1 L52.9 206.5 L54.0 205.1 L54.2 203.5 L57.0 197.7 L57.2 195.5
  L58.3 193.4 L58.0 189.0 L56.4 187.9 L55.3 188.2 L52.9 191.5 L48.8 195.3 L46.9 195.5 L45.0 195.0
  L40.3 192.3 L38.4 193.4 L36.0 195.8 L31.0 202.9 L29.7 208.1 L29.4 215.2 L28.3 218.5 L27.8 222.8
  L25.3 228.8 L21.5 235.6 L21.0 238.4 L19.9 240.3 L19.9 242.5 L18.2 248.2 L17.1 250.1 L17.4 253.4
  L19.0 255.0 L22.3 255.5 L28.9 259.4 L31.9 262.4 L34.6 266.7 L36.0 269.7 L36.8 274.9 L36.8 279.3
  L36.0 284.5 L34.6 287.7 L32.1 291.3 L25.9 297.0 L18.5 300.0 L9.0 300.0 L1.6 297.0 L-5.5 290.2
  L-8.2 284.5 L-9.3 279.0 L-9.3 275.2 L-8.2 269.7 L-5.5 264.0 L-1.1 259.4 L1.9 257.2 L2.4 256.1
  L2.4 250.1 L3.8 241.1 L3.8 233.2 L5.1 225.0 L5.1 220.6 L6.5 215.7 L6.5 212.7 L7.9 209.7
  L7.9 206.7 L9.2 203.5 L9.5 200.5 L13.6 186.8 L16.3 181.6 L20.1 177.5 L22.9 172.9 L20.7 164.5
  L21.5 162.0 L23.4 160.1 L29.7 156.0 L35.1 149.5 L43.9 140.7 L56.7 131.2 L57.2 127.9 L61.0 121.1
  L61.0 107.7 L58.0 100.1 L55.6 98.2 L53.4 99.5 L46.9 105.8 L43.3 106.6 L31.6 117.0 L23.7 121.1
  L21.5 121.4 L18.2 122.7 L14.7 123.0 L12.0 124.1 L7.6 124.1 L4.0 124.9 L-7.1 125.7 L-11.2 127.1
  L-16.4 130.6 L-22.1 133.6 L-28.4 135.5 L-30.3 135.0 L-31.7 133.6 L-32.8 131.5 L-33.0 129.0 L-30.6 124.1
  L-30.3 122.5 L-29.0 120.8 L-25.1 120.0 L-12.3 118.9 L-10.1 117.8 L-7.1 117.3 L9.5 109.4 L13.9 106.6
  L15.2 106.4 L23.1 101.2 L25.3 99.0 L28.6 93.5 L33.5 87.8 L37.9 75.3 L42.2 66.3 L48.0 60.3
  L53.1 56.2 L55.3 53.5 L56.1 51.0 L55.3 46.1 L52.9 42.0 L49.3 37.6 L47.4 34.1 L46.0 30.0
  L46.0 27.5 L47.4 24.5 L47.4 11.5 L49.0 7.4 L52.9 3.3 L54.8 1.9 L58.3 0.5 L63.2 0.0 Z`;

/* Football — On the ball. Standing over the ball, hands on hips. */
const FOOT_ONBALL_TRACE = `M41.7 0.0 L49.2 0.0 L52.3 1.3 L54.7 1.6 L57.0 2.8 L59.6 5.4 L61.9 10.1 L62.2 21.7
  L60.9 24.8 L60.9 29.8 L59.1 34.4 L54.4 40.6 L54.4 42.2 L56.0 43.7 L57.5 44.0 L59.1 45.0
  L80.5 52.0 L86.8 59.3 L88.3 59.8 L92.7 64.7 L95.6 66.3 L98.9 69.4 L100.0 71.7 L103.6 75.3
  L108.8 82.1 L111.3 87.5 L111.1 91.6 L104.6 106.9 L91.7 127.4 L86.8 133.0 L86.5 136.9 L84.2 141.3
  L84.4 142.6 L86.5 145.2 L87.5 147.5 L88.3 152.2 L91.4 157.4 L92.2 162.6 L94.5 168.5 L94.5 171.4
  L95.8 174.7 L95.8 177.6 L97.1 180.7 L97.1 183.5 L97.9 186.1 L97.4 188.7 L97.4 198.8 L97.9 202.2
  L97.1 204.2 L96.9 208.6 L95.8 210.4 L95.8 214.3 L94.5 217.4 L94.5 220.3 L93.2 223.4 L93.2 226.0
  L91.9 229.6 L91.7 234.3 L90.6 239.2 L93.0 242.5 L93.5 245.4 L94.8 247.7 L100.2 252.4 L103.8 253.9
  L105.7 255.7 L106.4 259.1 L107.2 259.9 L112.1 261.7 L117.8 266.9 L120.4 271.0 L122.0 276.7 L121.7 284.5
  L118.9 290.9 L117.6 292.8 L112.6 297.2 L105.7 300.0 L97.1 300.0 L90.1 297.2 L84.4 291.7 L81.8 286.5
  L80.5 280.6 L80.8 276.7 L82.1 271.8 L85.5 266.4 L90.1 261.4 L89.1 259.9 L87.3 259.4 L85.2 259.6
  L81.3 258.3 L79.5 256.0 L79.0 253.1 L79.0 248.7 L80.3 245.9 L80.3 241.5 L79.5 219.5 L78.0 209.9
  L78.0 199.3 L80.5 193.4 L80.8 190.0 L80.0 187.7 L76.9 183.0 L75.9 182.7 L71.2 184.8 L68.4 184.3
  L66.8 182.7 L66.0 180.2 L61.1 171.4 L58.8 169.5 L58.0 169.8 L57.0 171.4 L57.0 183.5 L57.2 186.4
  L58.3 189.0 L58.0 191.5 L55.4 194.9 L52.6 196.5 L51.0 196.7 L49.7 198.0 L48.2 208.1 L49.2 212.5
  L49.2 215.6 L50.5 218.7 L50.5 221.8 L51.8 227.0 L51.8 241.0 L52.8 245.6 L53.1 254.4 L56.7 264.0
  L57.0 279.8 L55.7 282.7 L54.4 284.0 L52.8 284.5 L46.1 284.0 L43.0 282.9 L41.7 281.6 L41.2 280.1
  L41.5 277.5 L44.3 272.0 L44.8 259.9 L44.0 255.5 L39.1 244.1 L36.8 237.4 L36.5 234.8 L35.5 233.0
  L35.2 230.6 L34.0 227.8 L34.0 224.4 L32.9 221.6 L34.0 218.5 L34.0 205.0 L32.9 203.2 L32.7 199.8
  L31.6 198.0 L31.1 194.7 L30.1 193.4 L28.5 183.3 L27.5 180.7 L27.5 177.8 L26.2 174.2 L26.4 168.2
  L25.9 164.9 L23.9 160.2 L23.3 155.3 L22.3 151.9 L22.0 139.5 L20.0 135.6 L17.6 134.6 L12.5 133.8
  L5.7 126.6 L2.1 124.0 L-2.3 119.6 L-18.9 100.4 L-21.2 96.8 L-22.0 94.5 L-21.4 89.8 L-20.4 88.8
  L-17.6 83.3 L-10.6 76.1 L-10.1 73.0 L9.9 53.1 L11.7 51.8 L16.6 50.7 L18.4 49.4 L21.5 48.9
  L25.7 46.9 L31.1 45.0 L35.2 41.7 L36.0 39.3 L35.2 33.4 L31.6 28.7 L31.4 23.6 L30.1 20.4
  L30.1 13.2 L31.6 8.3 L34.0 4.4 L37.3 1.6 L41.7 0.0 Z
  M15.3 79.7 L16.6 80.5 L17.1 82.6 L17.9 90.3 L18.2 102.5 L22.0 112.6 L20.8 116.7 L22.0 121.1
  L21.8 121.9 L20.5 122.7 L16.1 122.4 L9.1 115.7 L2.9 107.7 L-4.6 95.0 L-3.8 93.4 L-0.7 91.6
  L2.1 88.8 L5.2 87.7 L8.8 84.4 L10.4 83.9 L15.3 79.7 Z
  M76.9 80.0 L80.3 80.5 L86.5 85.4 L89.6 85.7 L91.7 87.7 L95.6 90.1 L96.3 91.4 L89.6 109.5
  L89.1 112.1 L88.3 113.1 L87.8 116.0 L85.5 120.1 L83.9 121.1 L76.9 121.4 L76.1 121.1 L75.4 119.8
  L75.4 113.9 L74.1 111.0 L74.1 108.2 L73.0 105.6 L74.1 99.9 L73.3 94.5 L74.1 92.4 L74.1 88.8
  L75.4 84.9 L75.4 81.5 L75.6 80.8 L76.9 80.0 Z`;

/* Football — Volley. Full stretch into a volley. */
const FOOT_VOLLEY_TRACE = `M57.4 0.0 L66.5 0.0 L69.2 1.1 L81.1 9.7 L83.0 11.6 L84.3 11.8 L85.7 13.2 L87.0 17.2
  L86.5 21.3 L84.8 23.1 L83.0 23.9 L81.6 27.7 L81.3 31.2 L78.4 34.4 L78.1 42.0 L77.0 43.0
  L74.3 44.1 L68.4 52.2 L63.9 52.2 L62.0 50.3 L60.9 50.0 L59.8 50.9 L59.0 52.5 L59.0 57.6
  L62.0 63.8 L62.2 68.1 L66.3 76.7 L67.4 81.3 L66.8 92.0 L67.6 95.5 L67.6 99.6 L68.4 100.9
  L68.7 103.6 L69.8 106.5 L69.8 116.5 L70.6 119.2 L70.9 127.3 L71.9 132.4 L71.9 139.4 L72.5 141.0
  L72.2 143.4 L73.0 145.3 L73.0 152.0 L73.8 154.4 L77.0 158.2 L79.2 159.3 L82.4 162.2 L83.8 166.8
  L85.9 169.8 L104.2 187.8 L112.8 198.6 L116.1 201.5 L119.6 206.4 L121.7 208.3 L122.2 210.1 L123.6 211.5
  L124.4 214.4 L124.7 227.6 L125.7 230.9 L128.2 235.7 L129.5 236.8 L131.1 237.0 L133.0 239.2 L138.7 253.5
  L141.1 258.0 L144.0 262.1 L145.1 267.7 L146.2 269.6 L148.9 272.3 L150.5 273.4 L152.9 273.1 L156.1 267.4
  L161.0 262.6 L164.5 260.7 L169.1 259.4 L176.3 259.4 L179.8 260.4 L182.8 261.8 L188.2 266.6 L191.4 272.6
  L191.1 287.6 L189.2 290.9 L184.7 295.7 L179.0 298.4 L177.7 299.7 L167.7 299.7 L165.8 297.8 L163.7 297.6
  L159.9 295.2 L158.0 296.0 L156.4 297.6 L154.5 298.1 L152.9 299.7 L145.7 299.7 L140.3 293.8 L136.8 283.6
  L133.3 277.9 L126.0 268.3 L116.3 257.2 L110.9 249.4 L104.8 235.4 L104.5 232.7 L103.7 231.4 L103.1 227.4
  L102.3 225.5 L102.3 222.0 L101.3 220.1 L95.9 216.1 L93.2 216.1 L89.4 217.9 L86.2 218.5 L81.9 218.5
  L80.0 217.9 L67.1 208.5 L54.4 197.0 L44.5 206.4 L41.3 208.5 L38.6 211.2 L36.4 214.7 L36.4 215.5
  L33.5 218.7 L30.0 226.3 L27.0 229.2 L24.0 230.9 L18.7 231.9 L16.2 231.9 L11.4 230.9 L10.3 230.0
  L3.9 227.9 L-8.3 220.4 L-15.2 220.1 L-23.0 215.2 L-36.0 209.6 L-43.5 204.2 L-45.4 204.2 L-48.1 203.1
  L-51.3 203.1 L-58.0 201.3 L-66.4 203.4 L-69.3 202.3 L-75.2 201.5 L-79.0 202.1 L-86.8 205.3 L-90.0 205.0
  L-91.1 203.9 L-91.1 197.2 L-88.2 194.5 L-87.9 193.2 L-83.0 188.6 L-81.2 188.1 L-79.6 186.2 L-76.3 186.2
  L-75.2 185.4 L-73.1 185.1 L-72.0 184.3 L-67.2 183.0 L-62.6 180.5 L-61.0 178.7 L-58.6 178.4 L-56.7 176.5
  L-55.6 176.2 L-54.0 176.8 L-51.6 175.7 L-49.4 176.2 L-47.5 178.1 L-44.0 186.7 L-42.2 188.3 L-40.0 188.1
  L-37.3 189.4 L-33.0 190.5 L-28.4 190.5 L-24.9 191.6 L-19.6 191.6 L-15.2 192.6 L-12.3 192.6 L-7.7 194.0
  L0.4 198.0 L9.2 204.2 L12.7 200.4 L13.3 194.5 L14.1 193.5 L14.3 190.8 L15.2 189.4 L15.4 187.0
  L16.2 185.7 L17.6 180.3 L20.5 173.3 L20.5 169.8 L19.7 168.2 L18.7 167.4 L16.0 169.8 L12.2 169.5
  L11.1 168.4 L10.6 165.5 L6.8 160.4 L6.5 157.1 L9.0 152.6 L12.7 148.5 L13.8 145.0 L14.1 131.3
  L15.2 122.4 L16.2 119.2 L16.2 114.1 L17.3 111.7 L17.6 108.7 L21.6 99.8 L19.5 89.1 L19.5 67.3
  L18.4 65.4 L15.7 63.2 L10.9 63.0 L8.4 61.3 L5.2 60.8 L-2.6 57.8 L-7.7 53.5 L-8.5 50.6
  L-7.4 47.9 L-5.0 45.2 L-3.7 44.1 L-0.7 43.0 L15.7 40.9 L24.0 37.9 L30.8 36.9 L38.0 37.7
  L40.2 38.7 L41.5 38.5 L45.3 31.2 L45.3 17.8 L46.6 10.2 L47.7 7.8 L50.9 4.3 L55.0 1.1
  L57.4 0.0 Z`;

/* Athletics: sprinting, leaning, front knee driven up, arms pumping. */
const RUN_TRACE = `M37.2 0.0 L42.0 0.4 L45.8 2.0 L50.1 5.9 L52.5 10.0 L54.0 15.1 L54.2 20.3 L52.9 26.0
  L49.9 32.3 L51.8 37.5 L53.0 39.1 L56.2 40.0 L73.3 39.1 L82.2 39.5 L88.3 42.6 L91.8 46.9
  L93.3 50.6 L93.6 55.9 L91.8 62.7 L98.1 85.1 L97.3 91.1 L94.9 94.3 L92.0 95.9 L87.9 96.3
  L84.4 95.0 L81.1 91.5 L75.4 79.2 L74.3 78.2 L72.4 78.2 L70.9 79.7 L70.2 83.6 L68.9 94.3
  L68.7 102.4 L70.6 112.9 L77.6 134.9 L79.8 144.1 L83.5 147.8 L85.9 151.8 L94.7 171.6 L98.2 181.2
  L100.6 191.5 L101.0 200.2 L99.5 208.1 L96.8 216.2 L85.7 238.2 L86.3 239.9 L93.8 247.8 L94.4 249.6
  L93.8 253.1 L91.1 255.9 L87.5 256.5 L70.6 250.9 L66.7 247.0 L65.6 243.7 L65.6 241.1 L66.7 237.8
  L70.6 233.4 L75.2 219.9 L78.0 208.1 L78.1 200.4 L74.3 191.1 L64.1 176.4 L61.9 175.1 L59.7 176.2
  L44.6 230.8 L28.5 278.4 L29.1 284.7 L28.3 287.3 L26.5 290.0 L24.1 291.9 L7.7 299.4 L4.2 300.0
  L2.3 299.4 L0.3 297.8 L-0.8 295.8 L-1.0 293.2 L0.3 290.2 L13.7 274.9 L22.0 226.6 L30.4 162.9
  L29.8 161.4 L27.8 160.3 L23.9 161.6 L19.6 161.1 L17.4 159.8 L15.4 157.4 L14.3 154.2 L14.7 148.5
  L5.3 130.3 L1.2 119.0 L-0.1 111.8 L-0.1 103.3 L3.2 86.5 L11.2 61.6 L9.5 55.9 L9.5 52.6
  L10.4 48.9 L13.0 44.5 L17.3 41.0 L21.9 39.3 L28.5 38.9 L30.0 37.5 L30.0 34.1 L26.3 29.7
  L23.9 24.4 L23.2 20.3 L23.3 15.1 L24.8 10.0 L28.3 4.6 L31.5 2.0 L37.2 0.0 Z`;

/* Gown — Ball gown. Full skirt, bare shoulders, hair over one side. */
const GOWN_BALL_TRACE = `M44.4 0.0 L58.1 0.2 L61.0 3.7 L63.5 4.2 L66.4 5.6 L68.7 7.9 L69.6 9.6 L69.6 15.6
  L65.2 24.1 L66.0 28.5 L65.6 29.8 L60.6 37.2 L58.3 37.4 L54.8 35.6 L53.5 36.4 L52.5 43.3
  L54.0 45.6 L56.0 46.6 L64.1 47.0 L66.6 48.9 L67.5 50.6 L67.7 57.2 L66.6 66.0 L72.7 72.2
  L73.9 75.5 L73.7 79.1 L72.7 82.4 L68.1 91.7 L72.7 104.6 L73.9 110.5 L78.3 123.8 L89.3 141.3
  L96.6 154.2 L105.1 170.8 L108.5 178.7 L124.1 210.5 L131.3 223.9 L138.4 235.3 L152.1 254.0 L166.9 270.0
  L168.0 270.2 L173.2 268.2 L174.2 268.4 L175.7 269.8 L176.1 273.0 L178.6 274.8 L179.2 276.9 L181.3 279.4
  L182.9 279.6 L186.5 278.2 L188.6 279.4 L189.4 285.0 L191.1 288.3 L190.6 289.6 L189.4 290.6 L166.9 295.0
  L164.4 295.0 L161.3 296.0 L158.2 296.0 L155.9 296.9 L151.5 296.9 L145.9 295.8 L144.2 295.0 L138.8 295.0
  L130.9 298.1 L127.4 298.1 L120.9 297.1 L113.9 299.2 L112.0 299.2 L107.8 298.1 L101.4 297.7 L97.0 298.1
  L93.1 300.0 L87.2 298.3 L85.4 298.3 L80.6 300.0 L31.3 300.0 L29.2 299.2 L26.7 299.0 L25.2 298.1
  L23.6 298.1 L18.8 299.8 L8.2 298.5 L4.4 300.0 L-9.9 300.0 L-47.4 297.3 L-49.2 296.7 L-51.3 295.0
  L-56.9 295.8 L-66.3 295.8 L-71.9 295.0 L-79.6 294.8 L-88.8 293.3 L-90.2 291.9 L-90.2 290.0 L-91.1 287.9
  L-91.1 281.3 L-90.6 280.0 L-88.1 277.9 L-87.7 274.0 L-86.7 272.7 L-83.4 272.5 L-77.5 275.2 L-73.6 276.3
  L-68.2 276.3 L-63.0 274.4 L-59.6 272.1 L-56.9 269.6 L-53.0 264.4 L-45.7 250.9 L-30.9 217.0 L-18.2 191.4
  L-4.7 166.6 L7.6 146.5 L8.4 144.4 L8.8 138.3 L13.6 130.7 L15.9 125.0 L18.0 116.9 L18.0 114.4
  L19.0 111.9 L20.9 100.5 L23.8 93.8 L24.2 90.5 L24.8 82.2 L24.0 80.1 L25.0 77.6 L24.2 76.4
  L22.1 76.1 L20.9 75.1 L20.5 73.4 L18.2 71.2 L16.9 68.4 L17.8 66.6 L21.7 63.2 L23.2 61.2
  L22.3 59.9 L20.0 58.7 L16.9 54.7 L16.1 52.8 L16.3 51.6 L17.5 49.9 L21.7 47.6 L23.6 45.4
  L23.8 44.7 L22.1 41.0 L22.1 38.3 L22.5 37.0 L27.5 32.2 L27.3 29.8 L26.3 27.5 L26.7 23.5
  L33.6 18.9 L35.2 15.0 L35.6 9.6 L36.9 6.0 L40.2 2.1 L44.4 0.0 Z`;

/* Gown — Train. Standing tall, hand on the hip, fitted to the knee and then a
   train sweeping out behind. --radius 1.2 --close 2.4, plus one local patch.
   Every number here was fought for and they pull against each other:
     - the opening at the default 2.4 wipes out the FAR arm, a strip four
       source pixels wide, and she comes out one-armed;
     - the closing at the default 0.5 cannot reach the fold where the train
       meets the skirt, so that fold stays as a nick and the train hangs off
       a thread;
     - the wedge the artist left where the shoulder meets the arm is wider
       still, and closing hard enough to fill it everywhere swallows the
       elbow hole and bulks out the whole torso. So that one is closed
       LOCALLY, across the shoulder band only, at 0.035 of the width.
   The triangle at the near elbow is cut, not filled. */
const GOWN_TRAIN_TRACE = `M12.2 0.0 L19.8 0.0 L21.6 1.3 L23.4 1.5 L27.7 5.6 L30.5 10.6 L31.5 11.4 L34.0 11.7
  L36.3 14.4 L36.6 18.8 L35.3 21.3 L35.8 23.1 L35.3 25.8 L30.7 30.2 L28.7 30.2 L27.4 31.4
  L24.7 30.7 L23.4 32.2 L23.9 37.8 L24.9 39.8 L25.2 41.8 L27.7 45.6 L30.5 48.1 L34.3 50.4
  L39.9 51.9 L41.9 53.2 L45.2 57.0 L53.5 73.0 L60.6 83.1 L64.4 89.7 L67.0 96.0 L66.5 98.1
  L64.9 99.8 L58.9 103.6 L52.5 106.4 L51.5 107.4 L50.3 107.4 L45.9 110.0 L41.6 111.2 L39.9 112.5
  L38.6 112.5 L30.2 116.3 L27.2 116.6 L26.2 117.8 L26.4 120.9 L27.7 124.4 L27.7 137.3 L26.4 140.9
  L26.2 144.7 L25.2 146.5 L24.9 149.2 L22.6 156.1 L22.4 159.4 L21.4 161.4 L21.4 164.7 L20.1 171.5
  L20.1 178.4 L21.4 186.0 L21.4 189.3 L22.4 191.3 L22.9 195.9 L23.9 197.4 L24.2 199.9 L26.4 205.5
  L26.4 206.8 L27.7 208.5 L28.0 210.8 L29.0 212.1 L30.2 216.1 L36.6 228.8 L44.2 241.0 L52.0 251.4
  L66.5 266.0 L74.6 272.1 L79.1 274.9 L80.4 275.2 L81.4 276.2 L85.5 277.7 L86.5 278.7 L87.8 278.7
  L88.5 278.0 L87.5 276.9 L86.5 276.9 L85.5 275.9 L82.2 274.4 L80.9 273.1 L82.2 272.6 L88.0 273.6
  L95.9 273.6 L100.7 274.9 L106.2 275.2 L109.3 276.2 L112.6 276.4 L113.9 277.2 L117.7 277.4 L119.7 278.7
  L122.0 278.7 L124.0 280.0 L125.3 280.0 L127.8 281.5 L130.3 284.0 L130.3 285.8 L126.3 289.6 L124.7 289.9
  L120.2 292.1 L117.9 292.4 L115.6 293.7 L112.3 293.9 L110.3 294.9 L84.5 298.7 L76.1 298.7 L66.5 300.0
  L33.3 300.0 L22.1 298.7 L14.8 298.7 L9.7 297.5 L5.9 297.5 L2.1 296.5 L-1.4 296.2 L-3.7 295.2
  L-7.3 294.9 L-10.1 293.7 L-12.3 293.7 L-14.1 292.7 L-16.6 292.1 L-20.9 289.9 L-22.0 288.3 L-21.2 284.3
  L-19.2 279.5 L-18.9 276.4 L-17.7 274.2 L-17.7 271.9 L-16.4 269.1 L-16.1 265.8 L-14.1 259.0 L-13.9 254.4
  L-12.6 251.1 L-12.6 247.0 L-11.3 241.7 L-9.0 216.1 L-9.3 197.1 L-9.8 195.4 L-10.3 182.9 L-11.1 180.2
  L-11.3 174.6 L-12.6 169.8 L-12.6 166.0 L-13.9 162.4 L-15.1 153.5 L-16.1 151.0 L-16.4 147.7 L-17.7 143.4
  L-17.7 128.7 L-18.4 128.0 L-19.4 129.0 L-21.7 134.0 L-22.7 135.1 L-23.7 138.1 L-22.7 144.2 L-23.0 154.3
  L-23.7 156.6 L-22.0 158.9 L-23.0 159.9 L-22.7 161.1 L-23.7 162.2 L-24.7 162.2 L-26.0 160.9 L-27.0 161.9
  L-27.8 161.4 L-28.0 159.9 L-29.1 158.9 L-29.3 156.3 L-30.3 154.1 L-30.3 148.2 L-26.3 130.5 L-25.5 129.5
  L-25.3 127.4 L-24.0 124.7 L-24.0 123.1 L-22.7 121.1 L-22.7 119.6 L-21.5 117.6 L-21.5 116.3 L-20.4 114.5
  L-18.9 109.2 L-16.4 103.6 L-12.8 91.2 L-11.6 79.8 L-10.3 75.5 L-10.6 71.5 L-9.5 67.4 L-10.1 60.1
  L-8.8 53.7 L-5.5 50.7 L5.9 49.2 L7.9 48.4 L11.5 45.1 L12.0 43.1 L11.5 37.5 L10.2 36.2
  L3.9 36.5 L2.9 35.2 L2.4 33.2 L1.4 32.2 L0.6 28.6 L-0.9 26.9 L-0.9 25.8 L0.1 24.3
  L0.1 19.3 L-0.9 17.0 L0.1 10.6 L-1.2 9.1 L-1.2 6.8 L1.1 4.3 L4.1 3.8 L8.2 1.3
  L9.5 1.3 L12.2 0.0 Z
  M38.1 74.7 L40.9 75.5 L42.9 77.3 L51.5 89.4 L52.5 92.7 L52.0 95.0 L48.7 98.6 L45.9 100.1
  L43.7 102.1 L42.4 102.4 L41.1 103.6 L29.2 109.7 L26.2 110.0 L23.1 106.7 L20.4 101.9 L21.6 98.3
  L21.6 96.8 L22.9 95.5 L24.7 91.5 L32.3 78.8 L35.3 75.5 L38.1 74.7 Z`;

/* Gown — Evening. Slim column gown, hands clasped. The quiet one. */
const GOWN_EVENING_TRACE = `M24.0 0.0 L31.5 1.1 L35.4 3.3 L37.9 5.8 L39.9 9.2 L41.0 13.6 L41.0 16.4 L39.9 22.2
  L42.4 27.2 L42.1 31.1 L40.7 33.9 L38.5 36.1 L35.4 37.2 L31.5 37.2 L30.7 38.3 L31.2 39.7
  L32.6 42.2 L37.4 46.9 L43.2 46.4 L46.8 47.5 L48.5 48.6 L51.0 51.7 L53.2 60.0 L53.8 71.4
  L54.6 75.3 L54.9 80.6 L55.7 83.3 L56.0 90.8 L56.5 92.2 L56.5 96.9 L55.4 101.4 L54.0 102.8
  L52.9 103.1 L42.9 102.8 L36.8 101.4 L35.7 101.7 L34.9 102.8 L38.8 108.6 L41.5 114.7 L42.4 115.6
  L44.6 121.7 L45.7 126.7 L46.5 128.1 L51.2 152.5 L51.2 155.0 L53.5 164.4 L53.5 166.9 L54.6 170.3
  L55.7 178.6 L56.8 181.9 L60.1 199.7 L64.6 217.8 L65.4 219.2 L66.0 222.5 L67.6 226.4 L69.0 231.9
  L69.9 233.1 L70.1 235.0 L74.6 246.4 L81.5 260.6 L85.7 267.2 L91.0 273.9 L96.8 279.4 L104.6 284.2
  L114.0 287.5 L127.1 290.8 L128.2 291.9 L128.5 293.3 L128.2 294.4 L126.8 295.8 L117.9 297.2 L108.2 297.2
  L97.9 300.0 L92.1 299.7 L87.9 298.6 L80.1 298.6 L74.9 300.0 L49.6 300.0 L42.9 298.6 L34.9 298.1
  L25.7 298.3 L19.6 299.4 L9.3 299.4 L4.0 298.1 L-2.1 295.0 L-4.9 294.4 L-14.3 294.7 L-19.3 293.6
  L-23.8 291.7 L-28.2 288.3 L-28.2 286.1 L-25.1 280.8 L-24.0 276.7 L-24.0 273.1 L-22.9 268.6 L-21.8 258.1
  L-19.6 245.6 L-19.6 242.2 L-18.5 237.8 L-17.4 225.6 L-16.5 222.8 L-16.0 215.0 L-15.1 211.4 L-15.1 207.5
  L-14.3 205.0 L-13.8 196.9 L-12.9 193.3 L-12.9 190.0 L-11.8 185.3 L-11.8 180.8 L-9.6 166.7 L-9.6 161.7
  L-7.4 147.5 L-7.4 143.1 L-6.2 138.1 L-6.2 135.3 L-5.4 132.8 L-5.1 127.8 L-4.0 124.4 L-2.6 116.1
  L-1.5 113.3 L-2.6 111.7 L-4.6 110.8 L-6.5 108.9 L-7.4 106.9 L-7.6 103.6 L-11.5 100.0 L-12.1 96.9
  L-11.8 93.6 L-7.4 79.4 L-7.4 77.5 L-5.1 69.4 L-4.0 61.4 L-1.8 53.3 L2.1 49.7 L6.2 48.6
  L8.8 49.4 L15.1 46.4 L16.8 44.7 L17.6 42.5 L17.6 35.3 L16.2 34.2 L14.9 34.7 L12.6 34.4
  L11.0 33.1 L9.3 26.7 L9.0 21.7 L9.6 18.9 L9.6 13.1 L10.4 10.8 L10.7 6.9 L12.1 4.7
  L15.7 1.9 L24.0 0.0 Z`;

/* Graduate - both arms thrown up, diploma in one hand, mortarboard and tassel.
   The tassel cord is TWO source pixels at its thinnest, about 0.8 mm on a 28 cm
   piece, so no opening radius can keep it and keep the rest clean: it has to be
   made thicker, not merely preserved. Traced at --radius 1.2 --min-width 5,
   which brings the cord to ~1.3 mm over its 14 mm and leaves the board's edges
   crisp; at 6 and above the board corners start growing nubs. */
const GRAD_TRACE = `M-1.3 0.0 L-0.2 0.6 L-0.2 1.7 L2.8 4.7 L-4.7 13.9 L-2.8 15.7 L-3.2 22.3 L4.1 36.1
  L9.4 42.1 L13.9 45.3 L16.3 52.4 L17.0 53.0 L20.4 53.9 L22.5 55.8 L23.4 57.7 L23.6 60.3
  L24.5 61.2 L27.5 61.2 L30.3 62.9 L32.6 65.2 L35.2 65.0 L36.9 65.9 L39.1 65.9 L41.0 67.6
  L43.6 67.6 L46.6 69.3 L49.4 67.0 L50.2 67.2 L51.3 65.7 L51.3 59.4 L49.6 57.9 L48.9 55.2
  L49.4 53.2 L50.4 51.9 L50.0 50.0 L50.4 46.1 L51.9 43.6 L45.1 39.7 L43.6 39.9 L42.9 38.8
  L44.0 37.8 L44.8 38.0 L47.4 35.8 L58.6 25.5 L59.9 25.5 L83.9 39.7 L85.2 40.3 L86.1 39.9
  L87.1 41.0 L86.5 42.5 L85.2 42.3 L79.4 47.4 L80.3 48.7 L81.1 53.0 L81.1 54.1 L80.0 55.4
  L80.5 59.0 L80.5 61.6 L80.0 62.0 L78.3 62.2 L77.3 61.6 L78.3 55.8 L77.5 54.1 L77.9 49.8
  L77.3 49.1 L73.2 52.6 L73.2 53.6 L71.5 56.9 L71.5 59.0 L70.6 61.4 L69.7 62.4 L67.0 63.7
  L64.6 68.5 L64.8 70.2 L68.0 73.0 L72.3 70.4 L74.2 70.6 L75.8 69.7 L77.0 69.7 L78.5 70.6
  L81.1 70.4 L83.9 67.0 L86.5 66.7 L87.8 64.2 L89.5 62.4 L90.6 62.0 L94.0 62.4 L97.0 56.0
  L101.9 51.7 L105.2 47.2 L109.7 36.5 L110.1 34.3 L107.3 29.8 L107.5 22.3 L106.7 20.2 L107.9 19.5
  L109.7 20.8 L110.9 18.9 L111.8 18.9 L112.9 20.0 L115.7 21.2 L117.0 22.7 L117.8 22.5 L118.5 23.2
  L118.2 31.5 L115.2 37.8 L113.1 48.9 L111.2 54.9 L111.2 56.0 L114.4 64.2 L115.2 70.8 L107.5 77.7
  L99.8 82.4 L97.2 89.9 L94.6 93.3 L92.5 94.4 L86.9 95.5 L83.0 97.0 L79.6 100.2 L78.8 101.9
  L79.2 110.3 L82.2 137.1 L87.3 166.1 L97.6 185.6 L109.9 197.2 L113.1 201.9 L113.7 204.1 L110.7 207.5
  L97.4 212.4 L88.4 213.7 L71.5 214.2 L70.8 214.8 L70.2 220.2 L67.8 223.8 L69.5 228.1 L69.7 231.1
  L67.8 244.6 L67.0 258.4 L66.3 261.6 L64.2 265.2 L66.5 267.8 L66.7 269.7 L64.2 273.0 L64.6 274.0
  L64.2 276.0 L63.3 276.6 L60.7 276.8 L60.1 277.5 L60.1 279.8 L61.8 281.8 L61.4 283.3 L61.8 284.8
  L61.2 285.8 L61.8 286.9 L61.6 288.4 L64.6 292.9 L65.9 295.9 L66.1 299.1 L65.5 300.0 L51.5 300.0
  L50.4 299.1 L50.4 295.7 L51.5 293.1 L51.7 290.8 L49.4 286.5 L49.4 282.8 L50.4 280.9 L50.0 279.8
  L50.4 277.9 L49.8 275.8 L51.5 274.0 L49.8 272.3 L47.9 272.7 L45.9 270.6 L44.6 267.6 L44.6 264.4
  L47.2 255.4 L47.9 249.6 L42.3 243.8 L41.8 236.9 L37.8 228.5 L38.2 226.6 L36.9 225.1 L37.8 223.2
  L36.1 221.5 L36.5 219.1 L34.5 217.0 L34.5 214.6 L35.4 212.9 L34.3 211.8 L26.4 210.7 L22.3 209.2
  L18.7 205.2 L16.5 199.6 L17.0 194.2 L18.9 186.7 L27.0 162.2 L29.2 152.4 L29.2 148.1 L28.3 143.6
  L28.3 134.8 L26.0 122.7 L25.3 114.8 L25.5 104.7 L27.5 91.2 L25.1 88.2 L17.2 84.5 L14.2 81.5
  L8.6 74.2 L-0.9 69.7 L-2.1 68.5 L-3.0 66.1 L-3.0 63.1 L-1.5 58.8 L-3.0 57.5 L-3.0 56.0
  L0.4 49.6 L0.4 48.7 L-5.2 33.0 L-8.2 27.0 L-12.2 23.2 L-14.2 24.9 L-14.4 26.6 L-15.7 27.3
  L-16.7 26.2 L-16.3 25.3 L-18.7 22.5 L-14.2 16.7 L-13.7 15.2 L-9.2 10.7 L-2.1 2.1 L-2.4 1.1
  L-1.3 0.0 Z`;

/* Basketball - four poses from the owner's reference sheet (one image, four
   players: dribble, jump shot, one-hand shot, pass).

   The sheet is small -- about 180 px a figure -- and the artist drew thin white
   seam lines on the jerseys and shorts. Traced as-is those become slits, and
   the waistband line cuts the figure in two. Each figure was upscaled 8x
   (Lanczos), the hairline seams closed with a closing that only accepts thin
   fills, and the dribbler's ball -- sliced flat by the edge of the original
   image -- completed as a circle. Then --radius 1.2 --close 1.5. Overlap with
   the seam-filled source: 99%, 93%, 99%, 99%. */
const BALL_DRIBBLE_TRACE = `M69.4 0.0 L75.7 0.9 L78.5 2.5 L81.2 5.0 L84.4 11.1 L84.8 13.2 L84.6 25.6 L84.1 30.6
  L83.2 33.1 L83.2 36.3 L85.0 37.6 L86.2 37.2 L89.8 37.4 L97.1 40.6 L98.9 42.6 L102.5 44.4
  L107.5 48.3 L111.8 53.3 L115.4 60.8 L116.1 65.5 L117.5 69.2 L119.3 71.7 L122.9 79.1 L124.9 87.8
  L128.6 98.2 L128.6 105.7 L127.7 108.4 L124.9 111.3 L122.2 111.8 L112.9 115.2 L111.8 117.0 L112.2 118.1
  L112.0 120.0 L110.4 122.9 L110.4 125.9 L113.6 133.8 L113.6 154.2 L111.8 168.0 L110.2 173.2 L110.2 176.0
  L106.8 187.8 L106.1 193.2 L102.5 207.0 L102.0 215.6 L100.2 225.9 L99.8 235.1 L101.1 247.6 L100.9 252.8
  L99.1 258.3 L94.3 265.3 L89.8 267.6 L87.3 267.3 L83.4 263.9 L81.6 259.2 L81.2 251.5 L84.6 239.0
  L83.9 227.0 L84.8 223.8 L81.6 219.5 L79.8 215.9 L78.9 208.8 L76.6 205.9 L74.4 204.1 L72.1 203.2
  L70.3 201.4 L69.4 199.5 L70.1 195.5 L69.6 194.3 L71.9 191.6 L73.7 182.8 L73.9 178.2 L72.8 176.9
  L70.5 180.3 L68.5 185.9 L66.9 191.2 L67.3 193.4 L65.1 195.7 L64.4 198.0 L60.3 203.4 L57.8 210.9
  L57.4 220.2 L58.0 229.5 L57.6 234.0 L54.4 242.9 L54.0 248.8 L53.1 250.6 L53.1 256.2 L52.2 260.8
  L51.5 271.2 L53.7 275.7 L54.0 293.7 L49.2 297.1 L48.5 299.3 L47.6 300.0 L28.6 300.0 L27.2 298.6
  L27.2 292.7 L28.6 290.0 L33.8 285.3 L35.6 282.8 L37.4 278.0 L38.3 271.4 L41.0 267.6 L39.9 265.1
  L39.5 257.6 L38.8 255.3 L39.0 250.6 L38.1 248.8 L37.6 239.2 L36.5 232.9 L36.3 225.4 L38.1 214.3
  L39.5 211.3 L40.8 204.8 L40.6 201.8 L41.3 199.5 L41.0 197.7 L39.5 195.2 L39.5 192.7 L38.3 190.5
  L39.5 168.9 L40.6 162.1 L39.9 155.8 L42.6 146.7 L42.9 140.8 L44.9 137.0 L45.1 126.5 L47.2 122.7
  L46.3 118.4 L48.1 114.1 L48.5 111.3 L48.3 105.4 L49.2 98.0 L49.0 93.4 L48.3 91.4 L47.2 90.2
  L45.8 90.2 L41.3 95.9 L38.1 98.4 L34.9 100.2 L29.7 101.4 L28.1 102.7 L28.1 104.1 L30.4 108.8
  L30.8 111.8 L30.2 119.7 L28.1 124.3 L23.8 129.7 L18.8 132.9 L15.4 133.8 L9.5 134.2 L2.0 132.9
  L-2.0 134.0 L-8.4 134.0 L-14.3 132.4 L-17.0 131.1 L-22.2 127.0 L-25.6 122.4 L-27.0 119.7 L-28.6 113.8
  L-28.6 107.5 L-27.0 101.6 L-23.6 95.9 L-20.0 92.3 L-14.3 88.9 L-8.4 87.3 L-2.0 87.3 L3.9 88.9
  L8.8 91.4 L17.9 87.5 L22.4 84.6 L27.2 82.3 L28.3 81.2 L32.0 73.9 L33.6 68.7 L33.1 58.0
  L34.9 51.9 L38.3 48.3 L43.1 46.0 L46.0 46.0 L51.0 41.0 L58.0 39.0 L59.2 37.9 L59.4 32.2
  L58.7 29.9 L54.6 25.6 L54.0 23.4 L54.2 19.7 L55.8 17.2 L56.0 10.4 L58.3 5.4 L60.8 2.9
  L63.7 1.1 L69.4 0.0 Z`;

/* Jump shot: re-done. The first trace merged head, ball and arms into one
   blob -- the seam fill also narrowed the REAL gaps there, and the space inside
   the arms (1.17% of the piece) fell just under the 1.2% hole cut-off and was
   filled. Now: no seam fill above the shoulders, --keep-holes 0.001, so the
   face profile stands clear of the ball and the gap inside the arms is cut.
   --keep-holes 0.005, not lower: at 0.001 a speck of the white hem seam on
   the shorts was cut as a hole. The inner hem was smoothed locally. */
const BALL_JUMPSHOT_TRACE = `M52.0 0.0 L58.3 0.2 L62.2 1.7 L65.4 4.5 L68.7 10.1 L69.1 15.3 L70.8 18.5 L70.6 28.7
  L71.0 32.4 L69.9 34.3 L66.7 35.2 L64.6 37.1 L64.1 40.8 L64.8 41.4 L67.4 41.2 L71.7 43.6
  L73.6 42.7 L76.4 43.6 L77.5 42.9 L74.5 36.4 L73.2 30.4 L73.0 25.2 L73.6 20.9 L75.6 18.5
  L74.9 15.7 L78.1 10.8 L80.1 8.8 L82.0 7.3 L86.8 5.2 L94.3 5.0 L96.9 5.4 L99.7 6.7
  L101.0 6.7 L102.3 5.4 L103.2 5.4 L109.0 10.6 L110.1 11.9 L112.0 16.6 L112.2 26.1 L111.6 31.1
  L110.7 33.4 L110.7 37.3 L112.2 45.7 L112.7 51.8 L113.5 54.8 L113.5 72.0 L112.0 76.8 L109.6 78.9
  L107.3 79.2 L104.0 78.9 L94.1 75.5 L84.0 70.3 L82.2 68.6 L80.1 71.0 L80.9 73.8 L81.2 77.4
  L80.9 89.5 L79.2 107.0 L77.9 111.9 L77.1 119.9 L76.0 122.1 L72.3 125.1 L71.9 126.4 L72.5 127.9
  L76.9 132.4 L78.8 136.5 L80.9 147.5 L84.2 156.6 L86.1 166.9 L88.3 188.9 L89.6 193.9 L90.0 198.6
  L91.3 202.9 L91.5 206.2 L90.4 207.7 L88.3 208.3 L87.0 209.8 L86.6 212.0 L83.1 218.0 L79.7 225.8
  L74.3 239.6 L69.3 247.6 L69.1 250.4 L66.1 255.8 L65.4 259.0 L64.3 261.0 L64.8 262.0 L66.5 263.3
  L66.5 264.2 L64.3 268.3 L63.5 271.3 L63.9 280.2 L67.6 288.4 L72.5 296.1 L73.2 299.6 L72.8 300.0
  L62.8 300.0 L59.4 298.1 L53.6 292.5 L48.2 284.5 L39.8 276.9 L36.7 272.2 L37.0 268.9 L38.7 267.0
  L50.3 259.5 L53.6 251.7 L55.7 243.7 L57.2 240.7 L57.7 233.4 L59.4 221.9 L60.9 217.2 L64.6 210.1
  L63.0 207.7 L60.5 207.0 L59.2 207.5 L56.6 210.3 L51.6 211.1 L50.5 212.2 L49.9 213.9 L47.1 216.8
  L42.6 220.0 L37.6 224.9 L26.0 239.2 L21.2 243.7 L20.6 246.1 L17.3 249.7 L14.1 255.1 L13.2 257.3
  L14.7 259.2 L14.7 260.1 L12.4 264.0 L10.9 268.5 L11.1 273.5 L14.1 285.1 L17.3 292.9 L17.8 296.5
  L17.3 297.8 L15.4 299.6 L11.7 300.0 L4.2 296.5 L0.5 293.5 L-2.7 289.6 L-4.9 285.5 L-6.8 277.1
  L-8.6 273.7 L-11.8 269.6 L-13.3 266.4 L-13.7 264.4 L-13.3 260.1 L-12.4 258.8 L-10.5 257.5 L0.5 251.7
  L3.1 248.7 L5.5 245.0 L7.8 239.0 L10.6 235.5 L10.9 233.1 L13.9 228.4 L17.8 218.0 L24.9 209.8
  L24.9 208.1 L23.6 206.6 L20.1 205.8 L18.6 203.8 L20.1 200.6 L19.5 198.0 L22.7 188.7 L24.0 177.1
  L22.5 161.5 L21.4 157.4 L20.8 150.8 L21.0 134.4 L22.7 127.7 L24.9 123.4 L27.5 120.6 L27.0 119.5
  L24.9 117.8 L24.4 113.4 L29.4 103.5 L29.2 93.2 L28.3 87.8 L27.5 74.2 L26.2 67.9 L25.5 56.7
  L26.6 50.9 L27.7 49.8 L28.3 47.9 L32.4 43.4 L34.8 41.4 L40.4 38.6 L44.9 38.6 L45.6 38.0
  L45.1 30.2 L40.4 23.7 L38.5 19.2 L38.5 12.1 L40.4 7.3 L43.9 3.5 L46.2 1.7 L52.0 0.0
  Z M100.4 38.4 L101.7 38.8 L101.7 50.9 L100.1 57.6 L99.1 58.2 L95.2 55.2 L91.9 53.5
  L88.1 52.8 L87.2 52.0 L87.2 50.7 L88.3 48.3 L89.1 44.0 L88.9 41.2 L89.8 40.3 L93.5 41.0
  L98.8 39.5 L100.4 38.4 Z`;

const BALL_SHOOT_TRACE = `M30.7 0.0 L43.8 0.2 L44.7 2.2 L47.4 4.6 L49.1 7.2 L50.2 9.9 L50.3 14.0 L49.3 17.5
  L49.0 21.9 L47.4 25.0 L44.4 28.4 L37.8 32.9 L34.3 37.0 L28.6 47.6 L25.7 57.5 L23.0 62.5
  L23.1 65.0 L26.9 71.7 L29.1 79.9 L30.0 81.8 L36.5 88.1 L36.7 90.4 L37.5 91.2 L39.0 91.6
  L40.6 90.0 L39.6 85.6 L39.7 79.7 L41.4 73.6 L43.7 69.8 L47.3 67.6 L49.8 67.3 L55.3 69.0
  L58.6 71.7 L61.0 76.5 L61.5 84.4 L61.1 85.4 L57.2 89.8 L56.0 92.6 L55.8 95.8 L58.0 97.9
  L61.1 97.4 L64.4 98.9 L65.6 100.1 L67.1 103.7 L71.0 105.2 L74.8 109.5 L76.4 113.3 L77.6 121.2
  L80.5 126.3 L83.5 134.0 L88.7 142.6 L89.9 147.2 L90.4 152.3 L91.9 157.4 L94.7 163.3 L100.8 173.0
  L100.1 174.0 L98.3 173.9 L97.4 174.7 L97.2 175.9 L95.9 176.3 L94.0 173.0 L91.9 173.7 L90.4 173.2
  L90.0 167.5 L89.0 165.8 L86.3 165.1 L83.7 167.2 L81.7 167.4 L81.1 166.9 L83.4 161.2 L84.7 159.5
  L84.7 157.8 L79.6 151.5 L73.3 137.9 L68.5 129.5 L67.1 128.5 L65.6 130.1 L65.2 139.0 L62.5 143.2
  L62.7 150.3 L61.3 153.0 L58.9 155.9 L60.6 159.3 L63.7 162.7 L64.4 164.6 L65.1 169.6 L65.1 179.5
  L66.8 191.3 L66.9 220.8 L64.9 223.2 L66.3 227.6 L67.3 239.2 L66.9 250.7 L65.9 252.9 L66.8 255.5
  L65.9 268.3 L67.5 271.1 L66.9 273.1 L66.9 281.5 L68.5 291.6 L68.0 295.4 L66.4 298.3 L65.2 299.5
  L63.3 300.0 L60.1 299.5 L58.4 298.3 L55.1 294.9 L54.4 292.6 L54.4 287.5 L55.5 283.9 L54.4 280.1
  L52.9 277.8 L52.4 273.3 L53.4 271.1 L57.2 267.5 L57.4 261.7 L56.0 250.0 L52.9 240.3 L52.9 228.5
  L50.9 223.0 L51.4 221.1 L50.2 219.6 L46.6 218.5 L42.1 218.5 L40.8 217.2 L39.6 211.0 L39.6 193.2
  L38.9 192.2 L37.7 192.7 L36.8 194.6 L36.5 201.9 L35.3 207.1 L35.3 210.2 L36.7 214.3 L36.5 215.6
  L29.5 220.1 L26.0 221.6 L23.8 222.0 L23.0 222.8 L23.0 224.5 L20.4 229.8 L18.7 238.2 L14.1 247.8
  L12.0 256.0 L12.2 260.0 L13.7 264.1 L13.7 267.3 L12.0 272.1 L12.2 277.8 L13.4 280.3 L13.9 283.1
  L13.2 289.0 L12.0 291.3 L9.8 293.3 L8.2 294.0 L5.5 293.8 L3.3 292.5 L1.6 290.4 L-0.1 287.3
  L-0.8 284.1 L0.9 262.4 L2.9 258.9 L3.8 253.8 L3.8 248.0 L4.8 245.8 L4.3 240.6 L5.5 230.0
  L6.9 225.9 L10.0 219.9 L9.8 219.1 L6.9 216.1 L6.7 214.3 L7.9 210.5 L8.2 207.2 L10.5 202.8
  L10.0 199.0 L10.6 197.1 L11.2 191.0 L11.3 175.9 L12.2 167.5 L13.7 161.9 L15.1 159.2 L20.2 152.1
  L19.0 147.2 L19.0 137.4 L20.1 128.7 L19.7 114.3 L21.1 111.2 L20.6 110.2 L20.6 107.0 L21.8 97.7
  L17.5 90.0 L15.1 84.2 L11.2 67.3 L10.8 62.3 L12.5 57.7 L19.4 44.5 L28.6 30.1 L29.5 26.0
  L28.6 24.1 L24.5 19.3 L23.3 15.7 L23.3 11.0 L25.9 5.3 L29.3 2.1 L29.6 0.7 L30.7 0.0
  Z`;

const BALL_PASS_TRACE = `M-27.6 0.0 L-24.4 0.0 L-19.7 1.1 L-14.9 3.4 L-11.7 6.1 L-8.6 10.2 L-6.1 16.1 L-5.9 24.5
  L-6.5 27.6 L-9.3 33.3 L-8.6 36.0 L-12.0 41.2 L-17.2 45.8 L-19.4 46.9 L-21.7 49.6 L-22.4 51.4
  L-21.9 59.8 L-21.0 61.6 L-20.6 66.2 L-16.7 75.5 L-14.7 77.9 L-12.9 77.7 L-7.2 72.1 L-1.5 68.7
  L0.9 67.7 L2.5 66.2 L3.4 63.4 L6.4 59.6 L10.5 55.7 L13.6 53.7 L18.8 51.9 L23.4 51.7
  L25.9 48.5 L32.7 45.8 L37.9 45.3 L39.0 44.2 L38.1 42.6 L32.4 42.4 L30.6 39.7 L29.7 34.0
  L29.7 23.8 L30.9 21.1 L30.2 14.5 L32.0 10.6 L35.6 5.4 L38.1 3.2 L42.9 1.4 L51.0 1.1
  L56.9 2.7 L60.8 5.7 L64.4 11.1 L65.1 14.5 L65.1 18.8 L64.2 23.6 L60.8 30.8 L60.3 38.1
  L61.0 40.1 L64.4 42.8 L67.8 42.6 L70.1 43.1 L77.5 45.5 L80.2 48.7 L85.9 50.1 L89.3 51.9
  L92.7 54.6 L95.0 57.6 L96.8 60.7 L97.2 63.7 L99.5 69.6 L107.9 83.4 L118.5 103.5 L119.9 109.9
  L120.6 121.7 L122.4 130.3 L122.4 133.2 L124.7 138.9 L129.4 145.5 L131.2 151.4 L131.2 158.6 L129.9 160.4
  L127.4 160.0 L124.9 161.1 L124.0 160.0 L123.8 158.4 L122.6 157.3 L121.9 157.0 L120.4 157.9 L119.2 157.5
  L118.5 156.1 L119.0 153.6 L118.8 146.6 L118.1 145.0 L116.0 143.4 L114.7 143.4 L113.6 144.3 L112.9 146.8
  L110.8 150.0 L109.0 150.0 L108.1 149.1 L109.7 137.5 L112.7 132.1 L112.0 128.5 L103.1 109.9 L102.0 104.5
  L100.0 98.6 L98.6 96.3 L89.3 85.6 L88.0 85.6 L86.8 86.8 L86.4 88.8 L86.6 106.0 L86.1 110.8
  L84.8 114.0 L84.8 115.3 L86.1 118.3 L87.0 123.0 L86.4 125.8 L84.1 128.9 L85.5 130.7 L89.8 134.1
  L90.0 141.4 L93.2 148.6 L93.4 150.9 L95.2 155.4 L100.9 167.0 L105.6 178.3 L106.3 181.5 L107.7 184.4
  L110.2 196.2 L112.4 201.7 L112.2 204.8 L113.8 206.4 L115.4 211.6 L118.5 216.4 L119.0 218.2 L120.6 220.7
  L124.0 232.0 L126.9 247.4 L126.7 250.2 L128.1 252.6 L129.4 257.4 L130.8 267.6 L133.3 269.6 L135.5 275.5
  L139.2 281.2 L145.1 286.9 L147.1 287.1 L147.8 287.8 L147.8 295.9 L147.3 298.9 L146.6 299.8 L130.8 299.8
  L128.7 296.6 L122.4 293.2 L120.1 292.7 L118.8 291.6 L118.3 289.1 L119.2 285.3 L119.0 275.3 L120.6 272.1
  L119.0 269.4 L118.5 266.5 L115.6 260.1 L113.8 253.5 L112.2 251.3 L111.5 248.6 L106.8 242.9 L104.7 238.8
  L104.0 235.6 L103.1 234.1 L102.5 226.8 L100.4 221.4 L96.8 216.4 L94.8 215.0 L88.9 216.4 L80.0 217.3
  L78.0 218.2 L75.5 218.2 L72.8 216.8 L70.7 214.6 L69.8 211.9 L68.5 209.8 L66.0 202.6 L64.6 200.3
  L64.2 197.8 L58.7 184.9 L56.9 181.7 L54.4 179.0 L53.3 178.5 L50.8 179.0 L48.5 181.7 L43.3 192.6
  L40.6 200.3 L39.2 202.3 L37.0 208.9 L35.6 211.0 L35.2 213.2 L32.9 217.1 L31.1 217.5 L29.5 219.1
  L28.1 219.1 L23.6 218.2 L20.4 216.8 L12.5 215.3 L8.6 218.2 L6.8 221.1 L4.6 226.1 L3.0 234.3
  L0.9 239.5 L-4.0 245.4 L-5.9 248.6 L-7.0 252.0 L-8.6 253.8 L-8.8 255.8 L-13.3 266.0 L-14.9 271.9
  L-14.2 278.2 L-15.1 284.8 L-14.0 287.1 L-14.7 290.3 L-16.7 292.1 L-19.2 293.0 L-22.2 295.9 L-25.3 296.8
  L-27.2 299.3 L-31.7 300.0 L-38.7 299.8 L-39.6 299.1 L-40.1 297.1 L-41.7 295.2 L-42.1 293.0 L-41.9 289.8
  L-40.1 286.4 L-31.9 277.1 L-29.0 270.1 L-25.3 266.5 L-24.0 256.9 L-22.6 251.7 L-21.0 249.2 L-21.0 245.4
  L-16.5 226.4 L-15.4 224.3 L-14.7 221.4 L-10.2 214.1 L-7.4 208.5 L-4.7 204.8 L-4.9 202.1 L-4.5 200.1
  L-2.5 194.6 L-2.2 192.1 L-0.9 189.9 L-0.6 187.4 L2.8 178.1 L3.2 175.2 L4.6 172.4 L4.8 170.4
  L6.2 168.4 L8.4 161.8 L11.8 156.3 L13.2 152.5 L13.9 149.8 L13.6 145.5 L15.9 143.0 L16.6 141.4
  L16.4 136.9 L17.3 133.9 L20.9 129.8 L20.7 128.9 L18.2 126.4 L17.7 125.1 L19.1 119.4 L19.1 107.6
  L18.2 102.9 L17.5 93.6 L17.5 87.0 L19.1 79.8 L17.7 77.9 L16.4 77.9 L15.2 78.9 L12.3 83.8
  L5.9 90.2 L-1.3 94.5 L-13.3 100.2 L-19.7 101.5 L-23.3 101.3 L-25.8 98.8 L-27.6 94.9 L-28.1 92.2
  L-29.4 89.3 L-31.7 78.4 L-33.3 66.6 L-33.5 54.4 L-35.3 47.1 L-36.9 44.4 L-36.2 41.5 L-36.9 39.9
  L-40.1 37.8 L-43.9 33.8 L-46.2 29.9 L-47.8 24.0 L-47.5 16.5 L-46.0 12.0 L-43.7 8.4 L-40.5 5.0
  L-35.3 1.6 L-27.6 0.0 Z`;

/* Gown - Sweep. A column gown with the train pooling behind, one hand on the
   hip. This replaces the fan-skirt source, which was a watermarked line
   drawing whose head had no area to cut and had to be grafted on; this one is
   solid ink throughout, so it is a straight trace. --radius 1.2 --close 1.2:
   the hanging near arm is a four-pixel strip that the default opening deletes
   outright, and a closing above about 1.5 welds what is left of it onto the
   bodice. The hand on the hip encloses a triangle well over the 1.2% cut-off,
   so it is cut as a real hole. */
const GOWN_SWEEP_TRACE = `M12.2 0.0 L19.6 0.0 L21.1 1.0 L23.4 1.5 L27.7 5.6 L30.2 10.1 L31.2 11.1 L34.0 11.7
  L36.3 14.4 L36.6 18.8 L35.3 21.3 L35.8 24.1 L35.1 26.1 L31.0 29.9 L28.5 30.4 L26.9 31.4
  L24.9 31.4 L23.9 32.4 L23.9 37.8 L25.2 41.8 L27.7 45.6 L31.8 49.2 L41.9 53.2 L45.2 57.0
  L50.8 68.2 L53.0 71.5 L53.3 72.7 L60.6 83.1 L64.4 89.7 L67.0 96.0 L66.5 98.1 L64.9 99.8
  L58.9 103.6 L51.8 107.2 L49.7 107.7 L46.5 109.7 L41.1 111.5 L40.4 112.2 L38.1 112.8 L31.0 116.0
  L27.7 116.6 L26.4 117.8 L26.4 120.9 L27.7 124.4 L27.7 137.3 L26.4 140.9 L26.4 143.7 L25.2 146.5
  L23.9 153.0 L22.6 156.1 L22.4 159.4 L21.4 161.4 L21.4 164.7 L20.1 171.5 L20.1 178.4 L21.4 186.0
  L21.4 189.3 L22.6 192.3 L22.6 194.8 L26.7 207.3 L27.4 208.0 L28.0 210.6 L29.0 212.1 L30.5 216.6
  L36.6 228.8 L44.2 241.0 L52.0 251.4 L67.7 267.1 L74.6 272.1 L78.6 274.2 L81.2 272.6 L88.0 273.6
  L95.9 273.6 L99.2 274.7 L106.2 275.2 L115.1 277.4 L117.4 277.4 L119.7 278.7 L122.0 278.7 L123.5 279.7
  L125.8 280.2 L130.1 283.8 L130.3 285.3 L129.8 286.6 L128.0 288.3 L122.7 291.1 L110.3 294.9 L84.5 298.7
  L76.1 298.7 L66.5 300.0 L33.3 300.0 L22.1 298.7 L14.8 298.7 L9.7 297.5 L5.9 297.5 L2.1 296.5
  L-1.4 296.2 L-4.0 295.2 L-7.3 294.9 L-10.1 293.7 L-12.3 293.7 L-14.1 292.7 L-16.6 292.1 L-20.9 289.9
  L-21.7 288.9 L-22.0 287.3 L-18.9 278.5 L-18.9 276.7 L-17.7 274.2 L-17.7 271.9 L-16.4 269.1 L-16.1 266.0
  L-14.1 258.7 L-13.9 254.4 L-12.6 251.1 L-12.6 247.0 L-11.3 241.7 L-9.0 216.1 L-9.3 197.1 L-9.8 195.4
  L-10.3 182.9 L-11.1 180.2 L-11.3 174.6 L-12.6 169.8 L-12.6 166.0 L-13.9 162.4 L-15.1 153.5 L-16.1 151.0
  L-16.4 147.7 L-17.7 143.4 L-17.9 132.8 L-18.9 131.8 L-20.4 131.8 L-22.7 135.1 L-23.7 138.3 L-22.7 144.2
  L-23.0 154.3 L-23.7 156.1 L-22.5 158.9 L-23.0 161.4 L-24.2 162.2 L-27.3 161.4 L-28.8 159.1 L-30.3 154.1
  L-30.3 148.2 L-29.3 144.9 L-29.1 141.4 L-27.8 138.1 L-27.8 135.8 L-26.5 133.0 L-25.3 127.4 L-14.1 96.3
  L-13.9 93.5 L-12.6 90.2 L-12.6 86.4 L-11.8 83.1 L-11.1 82.1 L-9.5 82.1 L-7.8 85.4 L-7.3 89.9
  L-7.8 97.3 L-9.3 101.1 L-12.6 106.2 L-15.4 112.0 L-16.6 115.5 L-16.6 118.1 L-17.9 120.1 L-17.9 122.1
  L-17.1 122.9 L-16.4 122.1 L-16.4 120.1 L-15.1 118.1 L-15.1 116.0 L-13.9 114.3 L-13.6 112.2 L-9.8 105.2
  L-6.5 100.6 L-5.2 97.3 L-5.0 88.9 L-6.0 86.4 L-6.3 83.9 L-9.8 76.8 L-10.6 74.0 L-10.3 70.2
  L-8.8 66.9 L-10.1 64.6 L-9.8 57.3 L-8.8 54.0 L-5.7 50.9 L2.6 49.4 L5.4 49.4 L8.7 48.1
  L11.2 45.6 L11.7 44.1 L12.0 40.3 L11.2 37.5 L9.5 36.2 L3.9 36.5 L2.9 35.2 L2.4 33.2
  L1.4 32.2 L0.6 28.6 L-0.7 27.1 L-0.9 26.1 L0.1 24.1 L0.1 19.5 L-0.9 17.0 L-0.9 15.5
  L0.1 11.1 L-1.2 8.9 L-1.2 6.8 L1.1 4.3 L4.1 3.8 L7.7 1.5 L12.2 0.0 Z
  M38.1 71.5 L40.1 73.0 L40.4 74.0 L42.7 76.5 L46.7 83.1 L53.0 91.5 L53.8 93.5 L51.8 96.0
  L43.7 102.1 L42.4 102.4 L41.1 103.6 L32.0 108.4 L28.5 110.0 L26.7 110.0 L23.1 106.7 L20.4 101.1
  L21.9 96.5 L26.7 87.9 L36.1 73.0 L38.1 71.5 Z`;

const FIGURES = {
  /* Heads sit on a circle of half-width 21, so every figure is about seven
     heads tall — the proportion that stops a cut piece reading as a chess
     pawn — and the neck is kept SHORT AND THICK so the head does not float.
     Arms hang at the sides, so from the shoulder down to the hand the
     OUTLINE IS THE ARM; the small step inwards below the hand is what tells
     the eye where the arm ended. */
  gown: { paths: [GOWN_BALL_TRACE, GOWN_TRAIN_TRACE, GOWN_EVENING_TRACE, GOWN_SWEEP_TRACE],
          names: ['Ball gown', 'Train', 'Evening', 'Sweep'],
          /* The sheet is bought by the rectangle, so the price follows the
             WIDTH per unit height, measured off each trace: Ball gown 0.94,
             Train 0.54, Evening 0.52, Sweep 0.54. That is base ~ 2.31w + 0.03.
             The Sweep was 1.75 while it was the fan skirt, which was 0.73 wide;
             the column gown that replaced it needs far less sheet. */
          bases: [2.20, 1.26, 1.24, 1.27] },
  gent: { path: GENT_TRACE },
  lady: { path: LADY_TRACE },
  suit: { path: SUIT_TRACE },
  /* One Volleyball shape: men's poses 0-4, women's 5-9. `groups` drives the
     Men / Women toggle; the pose row shows one group at a time. */
  volley: { paths: [VOLLEY_M0_TRACE, VOLLEY_M1_TRACE, VOLLEY_M2_TRACE, VOLLEY_M3_TRACE, VOLLEY_M4_TRACE,
            VOLLEY_W0_TRACE, VOLLEY_W1_TRACE, VOLLEY_W2_TRACE, VOLLEY_W3_TRACE, VOLLEY_W4_TRACE],
            names: ['Spike', 'Pass', 'Set', 'Jump set', 'Dig',
                    'Dig', 'Lunge', 'Ball at hip', 'Ball in hand', 'Spike'],
            groups: [{ label: 'Men', from: 0, to: 5 }, { label: 'Women', from: 5, to: 10 }],
            /* priced by width per unit height, 2.31w + 0.03, floor 1.26 */
            bases: [2.41, 2.0, 1.26, 1.57, 2.78,
                    2.49, 3.53, 1.26, 1.44, 1.26] },
  box: { paths: [BOX_VICTORY_TRACE, BOX_GUARD_TRACE, BOX_STANCE_TRACE, BOX_READY_TRACE],
         names: ['Victory', 'Guard', 'Stance', 'Ready'] },
  foot: { paths: [FOOT_STRIKE_TRACE, FOOT_DRIBBLE_TRACE, FOOT_ONBALL_TRACE, FOOT_VOLLEY_TRACE],
          names: ['Strike', 'Dribble', 'On the ball', 'Volley'],
          /* Sheet is bought by the rectangle, so a sprawling pose costs more
             than a compact one — Strike is 1.08 wide for every 1 tall, On the
             ball only 0.48. Priced per pose, not per shape. */
          bases: [2.10, 1.32, 1.18, 1.92] },
  run: { path: RUN_TRACE },
  grad: { path: GRAD_TRACE },
  ball: { paths: [BALL_DRIBBLE_TRACE, BALL_JUMPSHOT_TRACE, BALL_SHOOT_TRACE, BALL_PASS_TRACE],
          names: ['Dribble', 'Jump shot', 'Shoot', 'Pass'],
          /* Width per unit height 0.52, 0.43, 0.34, 0.65, priced at the old
             basketball rate of 1.26 for 0.40, with 1.26 as the floor. */
          bases: [1.64, 1.35, 1.26, 2.05] },
};

/* A figure may be cut in more than one pose. The chosen one is held here
   rather than threaded through every call, the same way the custom outline is,
   because `SHAPES[k].build(w, h)` is called from three places that have no
   idea what the customer picked. Pass `variant` explicitly to override it —
   that is how the pose tiles draw themselves rather than all drawing the
   pose that happens to be selected. */
const VARIANT = {};
export function setVariant(key, i) { VARIANT[key] = Math.max(0, i | 0); }
export function variantOf(key) { return VARIANT[key] || 0; }
/* A sprawling pose eats more sheet than a compact one, and sheet is bought by
   the rectangle. Where a figure's poses differ a lot in footprint they carry
   their own price factor; otherwise the shape's own is used. */
export function shapeBase(key, variant) {
  const f = FIGURES[key], spec = SHAPES[key];
  const fallback = spec ? spec.base : 1;
  if (LAYERED[key]) return fallback * (layeredOn(key, variant) ? LAYERED_COST : 1);
  if (!f || !f.bases) return fallback;
  const i = variant == null ? (VARIANT[key] || 0) : variant;
  return f.bases[Math.min(Math.max(i, 0), f.bases.length - 1)] ?? fallback;
}

/* Pose groups -- e.g. Men / Women for Volleyball -- or null. */
export function groupsOf(key) {
  const f = FIGURES[key];
  return f && f.groups ? f.groups : null;
}
export function groupOf(key, i) {
  const g = groupsOf(key);
  return g ? g.find(x => i >= x.from && i < x.to) || g[0] : null;
}

export function variantsOf(key) {
  if (LAYERED[key]) return [LAYERED[key].name, 'Classic'];
  const f = FIGURES[key];
  return f && f.names && f.names.length > 1 ? f.names : null;
}

/* Shapes whose options are a STYLE (layered or plain), not a pose. */
export function isStyled(key) { return !!LAYERED[key]; }

function figurePath(key, variant) {
  const f = FIGURES[key];
  if (!f) return null;
  if (!f.paths) return f.path;
  const i = variant == null ? (VARIANT[key] || 0) : variant;
  return f.paths[Math.min(Math.max(i, 0), f.paths.length - 1)];
}

/* Set by the designer when a customer drops in their own vector outline. */
let CUSTOM_OUTLINE = null;
export function setCustomOutline(d) { CUSTOM_OUTLINE = d || null; }
export function hasCustomOutline() { return !!CUSTOM_OUTLINE; }

/* The third argument is the POSE. Every one of these wrappers used to declare
   just (w, h) and drop it, so the 3D model -- built after setVariant() -- was
   right while outlinePath(key, box, variant) silently returned the currently
   selected pose for all of them. The four gown tiles you pick a pose FROM were
   four copies of the same drawing. Keep the parameter even where the shape
   ignores it; the bug was invisible precisely because dropping it is silent. */
function figureShape(key) {
  return (w, h, variant) => {
    if (key === 'custom') {
      return (CUSTOM_OUTLINE && pathToShape(CUSTOM_OUTLINE, w, h)) ||
             pathToShape(FIGURES.gent.path, w, h);
    }
    return pathToShape(figurePath(key, variant), w, h) ||
           pathToShape(FIGURES.gent.path, w, h);
  };
}

function ladyShape(w, h, v)   { return figureShape('lady')(w, h, v); }
function gentShape(w, h, v)   { return figureShape('gent')(w, h, v); }
function gradShape(w, h, v)   { return figureShape('grad')(w, h, v); }
function ballShape(w, h, v)   { return figureShape('ball')(w, h, v); }
function gownShape(w, h, v)   { return figureShape('gown')(w, h, v); }
function suitShape(w, h, v)   { return figureShape('suit')(w, h, v); }
function volleyShape(w, h, v) { return figureShape('volley')(w, h, v); }
function boxShape(w, h, v)    { return figureShape('box')(w, h, v); }
function footShape(w, h, v)   { return figureShape('foot')(w, h, v); }
function runShape(w, h, v)    { return figureShape('run')(w, h, v); }

function customShape(w, h, v) { return figureShape('custom')(w, h, v); }

/* `decal` says where the sticker goes. The figures have no flat area worth
   printing on, so their sticker mounts on the base instead. */
/* A shape with a layered design: variant 0 draws the traced panel, anything
   else the plain classic cut. */
function styled(key, plain) {
  return (w, h, v) => layeredOn(key, v) ? (pathToShape(LAYERED[key].body, w, h) || plain(w, h)) : plain(w, h);
}

export const SHAPES = {
  arch:     { label: 'Arch',      build: archShape,     base: 1.00, decal: { y: 0.45, w: 0.84, h: 0.52 }, note: 'The default. Fits the most text of any shape.' },
  plaque:   { label: 'Plaque',    build: styled('plaque', plaqueShape),   base: 0.94, decal: { y: 0.50, w: 0.88, h: 0.64 }, note: 'Rounded rectangle. Cheapest to cut, biggest sticker.' },
  shield:   { label: 'Shield',    build: styled('shield', shieldShape),   base: 1.06, decal: { y: 0.49, w: 0.82, h: 0.50 }, note: 'Traditional crest. Suits quiz bees and academic contests.' },
  lady:     { label: 'Lady',      build: ladyShape,     base: 1.30, decal: { onBase: true },              note: 'Traced from our own piece — walking, flared dress, arm out, heels.' },
  gown:     { label: 'Gown',      build: gownShape,     base: 1.24, decal: { onBase: true },              note: 'Four gowns to pick from. Mutya, Mr & Ms and coronation nights.' },
  gent:     { label: 'Gentleman', build: gentShape,     base: 1.22, decal: { onBase: true },              note: 'Standing gentleman in a suit. The pageant partner to the Lady.' },
  grad:     { label: 'Graduate',  build: gradShape,     base: 1.42, decal: { onBase: true },              note: 'Arms up, diploma in hand, cap and tassel. For recognition day.' },
  ball:     { label: 'Basketball',build: ballShape,     base: 1.26, decal: { onBase: true },              note: 'Dribble, jump shot, shoot or pass. The liga favourite.' },
  suit:     { label: 'Suit',       build: suitShape,    base: 1.26, decal: { onBase: true },              note: 'Man in a suit, arms at his sides. The partner to the Dress figure.' },
  volley:   { label: 'Volleyball',build: volleyShape,  base: 1.26, decal: { onBase: true },              note: "Men's or women's, five poses each. The school and liga favourite." },
  box:      { label: 'Boxing',    build: boxShape,      base: 1.26, decal: { onBase: true },              note: 'Four poses to pick from. For boxing and arnis tournaments.' },
  foot:     { label: 'Football',  build: footShape,     base: 1.28, decal: { onBase: true },              note: 'Four poses to pick from. Also used for futsal.' },
  run:      { label: 'Athletics', build: runShape,      base: 1.26, decal: { onBase: true },              note: 'Sprinter mid-stride. Covers track, fun runs and Palaro.' },
  custom:   { label: 'Your art',  build: customShape,   base: 1.30, decal: { onBase: true },              note: 'Cut to your own outline — drop an SVG in the sticker step.' },
  oval:     { label: 'Oval',      build: styled('oval', ovalShape),     base: 1.04, decal: { y: 0.50, w: 0.74, h: 0.52 }, note: 'Soft medallion shape. Pairs well with an oval sticker.' },
  facet:    { label: 'Facet',     build: styled('facet', facetShape),    base: 1.02, decal: { y: 0.49, w: 0.80, h: 0.52 }, note: 'Eight-sided and modern. Popular for corporate awards.' },
  monolith: { label: 'Monolith',  build: monolithShape, base: 0.96, decal: { y: 0.47, w: 0.86, h: 0.58 }, note: 'Square with clipped corners. Plain and cheap.' },
  wave:     { label: 'Wave',      build: waveShape,     base: 1.08, decal: { y: 0.40, w: 0.82, h: 0.48 }, note: 'Contemporary curved top. A change from the usual arch.' },
};

/* The option tiles draw the REAL cut outline, sampled from the same builder
   the 3D model uses, so a tile can never quietly drift from the piece it
   sells. Fitted into `box` with the foot on its bottom edge. */
export function outlinePath(key, box, variant) {
  const spec = SHAPES[key];
  if (!spec) return '';
  let shape;
  try { shape = spec.build(6.8, 17.8, variant); } catch { return ''; }
  if (!shape) return '';

  const rings = [shape, ...(shape.holes || [])].map(r => r.getPoints(170));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const r of rings) for (const p of r) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX, h = maxY - minY;
  if (!(w > 0 && h > 0)) return '';

  const k  = Math.min(box.w / w, box.h / h);
  const ox = box.x + box.w / 2 - ((minX + maxX) / 2) * k;
  const oy = box.y + box.h;
  return rings.map(r => r.map((p, i) =>
    `${i ? 'L' : 'M'}${(ox + p.x * k).toFixed(1)} ${(oy - (p.y - minY) * k).toFixed(1)}`
  ).join('') + 'Z').join('');
}

/* ───────────────────────── sheet colours ───────────────────────── */

/* Cast acrylic sheet, 5–8 mm. Opaque and glossy straight off the saw. */
export const MATERIALS = {
  blue:   { label: 'Blue acrylic',   short: 'Blue',   kind: 'sheet',  color: 0x1B49A8, mult: 1.00, note: 'The most ordered colour. Strong under a white or gold sticker.' },
  red:    { label: 'Red acrylic',    short: 'Red',    kind: 'sheet',  color: 0xC02626, mult: 1.00, note: 'Fiesta and sports standard. Do not put a red sticker on it.' },
  green:  { label: 'Green acrylic',  short: 'Green',  kind: 'sheet',  color: 0x1A7A42, mult: 1.00, note: 'School and barangay colours. Pairs well with gold.' },
  yellow: { label: 'Yellow acrylic', short: 'Yellow', kind: 'sheet',  color: 0xEBC218, mult: 1.00, note: 'Bright and cheap. Needs a dark sticker to stay readable.' },
  orange: { label: 'Orange acrylic', short: 'Orange', kind: 'sheet',  color: 0xE07A16, mult: 1.00, note: 'Warm and loud. Common for palaro and intramurals.' },
  white:  { label: 'White acrylic',  short: 'White',  kind: 'sheet',  color: 0xF2F0EA, mult: 1.00, note: 'Clean ground for any sticker. The pageant favourite.' },
  black:  { label: 'Black acrylic',  short: 'Black',  kind: 'sheet',  color: 0x171614, mult: 1.00, note: 'The most formal sheet. Everything reads on it.' },
  tan:    { label: 'Tan acrylic',    short: 'Tan',    kind: 'sheet',  color: 0xC2B183, mult: 1.00, note: 'Muted stone colour. A quiet alternative to white.' },
  clear:  { label: 'Clear acrylic',  short: 'Clear',  kind: 'glass',  rough: 0.06,     mult: 1.18, note: 'See-through. Give the sticker a solid background or it vanishes.' },
  gold:   { label: 'Gold mirror',    short: 'Gold',   kind: 'mirror', color: 0xC9A14A, mult: 1.30, note: 'Mirrored acrylic. Scratches easily — handle it by the edges.' },
  silver: { label: 'Silver mirror',  short: 'Silver', kind: 'mirror', color: 0xC6CACF, mult: 1.30, note: 'Mirrored acrylic. Photographs brightly under stage lights.' },
};

/* ───────────────────────── bases ───────────────────────── */

export const BASES = {
  goldbar: { label: 'Gold bar',    hint: 'Shaped wood bullion', fee: 60, note: 'Our most ordered base — solid wood, cut and finished as a bullion bar.' },
  octbox:  { label: 'Octagon box', hint: 'PVC junction box',    fee: 40, note: 'A PVC electrical junction box, sprayed. Light, cheap and surprisingly smart.' },
  utilbox: { label: 'Utility box', hint: 'PVC utility box',     fee: 40, note: 'The rectangular PVC box, sprayed. Widest front face for a base sticker.' },
  block:   { label: 'Plain block', hint: 'Two-tier wood block', fee: 0,  note: 'A plain stepped wood block. The cheapest and the most traditional.' },
};

export const BASE_FINISHES = {
  black:  { label: 'Black',   color: 0x1A1917, metal: 0, rough: 0.40 },
  gold:   { label: 'Gold',    color: 0xC9A14A, metal: 1, rough: 0.34 },
  silver: { label: 'Silver',  color: 0xC6CACF, metal: 1, rough: 0.32 },
  white:  { label: 'White',   color: 0xF0EEE8, metal: 0, rough: 0.42 },
  wood:   { label: 'Natural', color: 0x7A5636, metal: 0, rough: 0.58 },
  orange: { label: 'Raw PVC', color: 0xD4531F, metal: 0, rough: 0.46 },
};

/* ───────────────────────── sticker schemes ───────────────────────── */

export const SCHEMES = {
  white: { label: 'White', bg: '#FFFFFF', bg2: '#F1EFEA', ink: '#141310', accent: '#A67C2E', rule: 'rgba(20,19,16,.22)' },
  black: { label: 'Black', bg: '#171613', bg2: '#000000', ink: '#FFFFFF', accent: '#D9B45A', rule: 'rgba(255,255,255,.3)' },
  gold:  { label: 'Gold',  bg: '#E2C275', bg2: '#B88F36', ink: '#2C2008', accent: '#6E4F10', rule: 'rgba(44,32,8,.34)' },
  navy:  { label: 'Navy',  bg: '#17305A', bg2: '#0E1E3C', ink: '#FFFFFF', accent: '#E8C25A', rule: 'rgba(255,255,255,.3)' },
  red:   { label: 'Red',   bg: '#A81F1F', bg2: '#7A1414', ink: '#FFFFFF', accent: '#F0D27A', rule: 'rgba(255,255,255,.3)' },
  green: { label: 'Green', bg: '#176B3E', bg2: '#0E4327', ink: '#FFFFFF', accent: '#E8C25A', rule: 'rgba(255,255,255,.3)' },
};

export const FONTS = {
  classic: { label: 'Classic', note: 'Our default. Reads well at any size and suits most awards.',
             title: `'Instrument Serif', Georgia, serif`, titleW: '400',
             name: `'Instrument Serif', Georgia, serif`, nameStyle: 'italic', nameScale: 1,
             small: `'Inter', system-ui, sans-serif` },
  modern:  { label: 'Modern',  note: 'Clean sans throughout. Best for corporate and tech.',
             title: `'Inter', system-ui, sans-serif`, titleW: '600',
             name: `'Inter', system-ui, sans-serif`, nameStyle: 'normal', nameScale: 0.92,
             small: `'Inter', system-ui, sans-serif` },
  sport:   { label: 'Sport',   note: 'Condensed and loud. The usual pick for liga and palaro.',
             title: `'Oswald', Impact, sans-serif`, titleW: '600',
             name: `'Oswald', Impact, sans-serif`, nameStyle: 'normal', nameScale: 0.95,
             small: `'Inter', system-ui, sans-serif` },
  formal:  { label: 'Formal',  note: 'High-contrast serif. For service, academic and civic awards.',
             title: `'Playfair Display', Georgia, serif`, titleW: '700',
             name: `'Playfair Display', Georgia, serif`, nameStyle: 'italic', nameScale: 0.95,
             small: `'Inter', system-ui, sans-serif` },
  script:  { label: 'Script',  note: 'Flowing name line. Pageants and coronation nights.',
             title: `'Playfair Display', Georgia, serif`, titleW: '700',
             name: `'Great Vibes', 'Segoe Script', cursive`, nameStyle: 'normal', nameScale: 1.42,
             small: `'Inter', system-ui, sans-serif` },
};

export const LAMINATES = {
  gloss: { label: 'Gloss', note: 'Wet-look finish. Colours look richer; it does show fingerprints.' },
  matte: { label: 'Matte', note: 'No glare under hall lighting or a camera flash. Slightly softer colour.' },
};

/* ───────────────────────── sticker outlines ───────────────────────── */

function roundRectShape(w, h) {
  const r = Math.min(w, h) * 0.13;
  const s = new THREE.Shape();
  const x = w / 2, y = h / 2;
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y);  s.quadraticCurveTo(x, -y, x, -y + r);
  s.lineTo(x, y - r);   s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y);  s.quadraticCurveTo(-x, y, -x, y - r);
  s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
  s.closePath();
  return s;
}

function ovalDecalShape(w, h) {
  const s = new THREE.Shape();
  s.absellipse(0, 0, w / 2, h / 2, 0, Math.PI * 2, false);
  return s;
}

function shieldDecalShape(w, h) {
  const x = w / 2, y = h / 2;
  const s = new THREE.Shape();
  s.moveTo(-x, y); s.lineTo(x, y); s.lineTo(x, -y * 0.28);
  s.bezierCurveTo(x, y * 0.30, x * 0.46, -y * 0.86, 0, -y);
  s.bezierCurveTo(-x * 0.46, -y * 0.86, -x, y * 0.30, -x, -y * 0.28);
  s.closePath();
  return s;
}

export const DECALS = {
  rect:   { label: 'Rounded', build: roundRectShape,   ratio: null, safe: 0.84 },
  oval:   { label: 'Oval',    build: ovalDecalShape,   ratio: null, safe: 0.66 },
  shield: { label: 'Shield',  build: shieldDecalShape, ratio: null, safe: 0.74 },
  circle: { label: 'Circle',  build: (w, h) => ovalDecalShape(Math.min(w, h), Math.min(w, h)), ratio: 1, safe: 0.64 },
};

/* The printed keyline has to follow the cut edge. A rectangle inside a round
   sticker is the single thing that made these look homemade. */
function keylinePath(g, kind, W, H, inset) {
  const x = W * inset, y = H * inset;
  const w = W - x * 2, h = H - y * 2;
  g.beginPath();
  if (kind === 'circle' || kind === 'oval') {
    g.ellipse(W / 2, H / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (kind === 'shield') {
    const cx = W / 2, hw = w / 2, top = y, bot = y + h;
    g.moveTo(cx - hw, top);
    g.lineTo(cx + hw, top);
    g.lineTo(cx + hw, top + h * 0.36);
    g.bezierCurveTo(cx + hw, top + h * 0.65, cx + hw * 0.46, bot - h * 0.07, cx, bot);
    g.bezierCurveTo(cx - hw * 0.46, bot - h * 0.07, cx - hw, top + h * 0.65, cx - hw, top + h * 0.36);
    g.closePath();
  } else {
    const r = Math.min(w, h) * 0.13;
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }
}

/* ───────────────────────── printed artwork ───────────────────────── */

function tracked(g, text, cx, cy, spacing) {
  const chars = [...text];
  const widths = chars.map(ch => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  chars.forEach((ch, i) => { g.fillText(ch, x, cy); x += widths[i] + spacing; });
}

function fitFont(g, text, maxW, startPx, family, weight = '400', spacing = 0) {
  let px = startPx;
  for (let i = 0; i < 44; i++) {
    g.font = `${weight} ${px}px ${family}`;
    const w = [...text].reduce((a, ch) => a + g.measureText(ch).width, 0)
            + spacing * px * Math.max(0, text.length - 1);
    if (w <= maxW || px <= startPx * 0.40) break;
    px *= 0.95;
  }
  return px;
}

/* ── motifs, including the pageant silhouettes ── */

/* A true five-point star. The old eight-point version read as an asterisk
   at small sizes, which is not the mark. */
function starPath(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 ? r * 0.40 : r;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}

function heartPath(g, cx, cy, r) {
  g.beginPath();
  g.moveTo(cx, cy + r * 0.82);
  g.bezierCurveTo(cx - r * 1.45, cy - r * 0.15, cx - r * 0.55, cy - r * 1.05, cx, cy - r * 0.34);
  g.bezierCurveTo(cx + r * 0.55, cy - r * 1.05, cx + r * 1.45, cy - r * 0.15, cx, cy + r * 0.82);
  g.closePath();
}

function laurelPath(g, cx, cy, r) {
  g.beginPath();
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const ax = cx + dir * (r * 0.34 + Math.sin(t * Math.PI) * r * 0.5);
      const ay = cy + r * 0.72 - t * r * 1.5;
      g.ellipse(ax, ay, r * 0.26, r * 0.12, dir * (0.5 + t * 0.7), 0, Math.PI * 2);
    }
  }
}

function crownPath(g, cx, cy, r) {
  g.beginPath();
  g.moveTo(cx - r, cy + r * 0.52);
  g.lineTo(cx - r * 0.78, cy - r * 0.46);
  g.lineTo(cx - r * 0.38, cy + r * 0.06);
  g.lineTo(cx, cy - r * 0.72);
  g.lineTo(cx + r * 0.38, cy + r * 0.06);
  g.lineTo(cx + r * 0.78, cy - r * 0.46);
  g.lineTo(cx + r, cy + r * 0.52);
  g.closePath();
}

/* Gown silhouette: head, shoulders, flaring skirt. */
function gownPath(g, cx, cy, r) {
  const u = r / 1.05;
  g.beginPath();
  g.arc(cx, cy - u * 0.82, u * 0.20, 0, Math.PI * 2);
  g.closePath();
  g.moveTo(cx - u * 0.17, cy - u * 0.56);
  g.lineTo(cx + u * 0.17, cy - u * 0.56);
  g.quadraticCurveTo(cx + u * 0.30, cy - u * 0.16, cx + u * 0.22, cy + u * 0.12);
  g.lineTo(cx + u * 0.72, cy + u * 1.00);
  g.lineTo(cx - u * 0.72, cy + u * 1.00);
  g.lineTo(cx - u * 0.22, cy + u * 0.12);
  g.quadraticCurveTo(cx - u * 0.30, cy - u * 0.16, cx - u * 0.17, cy - u * 0.56);
  g.closePath();
}

/* Suit silhouette: head, shoulders, jacket, trousers. */
function suitPath(g, cx, cy, r) {
  const u = r / 1.05;
  g.beginPath();
  g.arc(cx, cy - u * 0.80, u * 0.20, 0, Math.PI * 2);
  g.closePath();
  g.moveTo(cx - u * 0.18, cy - u * 0.54);
  g.lineTo(cx + u * 0.18, cy - u * 0.54);
  g.quadraticCurveTo(cx + u * 0.52, cy - u * 0.40, cx + u * 0.50, cy + u * 0.16);
  g.lineTo(cx + u * 0.40, cy + u * 1.00);
  g.lineTo(cx + u * 0.08, cy + u * 1.00);
  g.lineTo(cx, cy + u * 0.42);
  g.lineTo(cx - u * 0.08, cy + u * 1.00);
  g.lineTo(cx - u * 0.40, cy + u * 1.00);
  g.lineTo(cx - u * 0.50, cy + u * 0.16);
  g.quadraticCurveTo(cx - u * 0.52, cy - u * 0.40, cx - u * 0.18, cy - u * 0.54);
  g.closePath();
}

function pairPath(g, cx, cy, r) {
  suitPath(g, cx - r * 0.54, cy, r * 0.86);
  gownPath(g, cx + r * 0.54, cy, r * 0.86);
}

export const MOTIFS = {
  none:   { label: 'None',      draw: null },
  star:   { label: 'Star',      draw: starPath },
  laurel: { label: 'Laurel',    draw: laurelPath },
  crown:  { label: 'Crown',     draw: crownPath },
  gown:   { label: 'Lady',      draw: gownPath },
  suit:   { label: 'Gentleman', draw: suitPath },
  pair:   { label: 'Couple',    draw: pairPath },
  heart:  { label: 'Heart',     draw: heartPath },
};

/* object-fit: cover, onto a canvas of the given proportions. */
function coverCanvas(img, boxW, boxH) {
  const PX = 760;
  const c = document.createElement('canvas');
  c.width = PX;
  c.height = Math.max(64, Math.round(PX * boxH / boxW));
  const g = c.getContext('2d');
  const k = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
  const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
  g.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
  return c;
}

export const PHOTO_FITS = {
  badge: { label: 'Badge',      note: 'Circular crop at the top, above the wording.' },
  cover: { label: 'Background', note: 'Fills the sticker. We darken it so the text stays readable.' },
};

/**
 * Draws the artwork exactly as it goes to the printer: full colour,
 * edge to edge. `cfg.photoImg` is a loaded Image the customer dropped in;
 * it is read in the browser and never uploaded anywhere.
 */
export function stickerCanvas(cfg, aspect) {
  const sc = SCHEMES[cfg.scheme] || SCHEMES.white;
  const f = FONTS[cfg.font] || FONTS.classic;
  const PX = 1024;
  const c = document.createElement('canvas');
  c.width = PX;
  c.height = Math.max(64, Math.round(PX / aspect));
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const safe = W * ((DECALS[cfg.decal] || DECALS.rect).safe ?? 0.84);
  const sans = f.small;

  const photo = cfg.photoImg || null;
  const fit = photo ? (cfg.photoFit || 'badge') : null;

  const grad = g.createLinearGradient(0, 0, W * 0.4, H);
  grad.addColorStop(0, sc.bg);
  grad.addColorStop(1, sc.bg2 || sc.bg);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  if (fit === 'cover') {
    // object-fit: cover, then a scrim so the wording survives any photo
    const k = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
    const dw = photo.naturalWidth * k, dh = photo.naturalHeight * k;
    g.drawImage(photo, (W - dw) / 2, (H - dh) / 2, dw, dh);
    const veil = g.createLinearGradient(0, 0, 0, H);
    veil.addColorStop(0, 'rgba(8,8,10,.52)');
    veil.addColorStop(1, 'rgba(8,8,10,.78)');
    g.fillStyle = veil;
    g.fillRect(0, 0, W, H);
  }

  const ink    = fit === 'cover' ? '#FFFFFF' : sc.ink;
  const accent = fit === 'cover' ? '#F0D27A' : sc.accent;
  const rule   = fit === 'cover' ? 'rgba(255,255,255,.34)' : sc.rule;

  g.strokeStyle = accent;
  g.lineWidth = Math.max(2, Math.min(W, H) * 0.020);
  keylinePath(g, cfg.decal, W, H, 0.050);
  g.stroke();
  g.globalAlpha = 0.55;
  g.lineWidth = Math.max(1, Math.min(W, H) * 0.007);
  keylinePath(g, cfg.decal, W, H, 0.082);
  g.stroke();
  g.globalAlpha = 1;

  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';

  /* Lay the wording out against a real vertical budget. Sizing each line as
     a fraction of the sticker height independently is what made the lines
     collide on short, wide stickers — the title's ascender climbed into the
     line above it. Instead: measure what is switched on, share the space
     between those lines, and scale the whole block to fit. */
  const round = cfg.decal === 'circle' || cfg.decal === 'oval';
  const padY = H * (round ? 0.17 : 0.11);
  let top = padY;
  let room = H - padY * 2;

  const motif = MOTIFS[cfg.motif];
  const hasMotif = motif && motif.draw && fit !== 'badge';

  if (fit === 'badge') {
    const r = Math.min(H * 0.17, room * 0.30);
    const cy = top + r;
    g.save();
    g.beginPath(); g.arc(W / 2, cy, r, 0, Math.PI * 2); g.clip();
    const k = Math.max((r * 2) / photo.naturalWidth, (r * 2) / photo.naturalHeight);
    const dw = photo.naturalWidth * k, dh = photo.naturalHeight * k;
    g.drawImage(photo, W / 2 - dw / 2, cy - dh / 2, dw, dh);
    g.restore();
    g.beginPath(); g.arc(W / 2, cy, r, 0, Math.PI * 2);
    g.strokeStyle = accent; g.lineWidth = Math.max(2, H * 0.014); g.stroke();
    const used = r * 2 + H * 0.05;
    top += used; room -= used;
  } else if (hasMotif) {
    const mr = Math.min(H * 0.095, room * 0.17);
    g.fillStyle = accent;
    motif.draw(g, W / 2, top + mr, mr);
    g.fill();
    const used = mr * 2 + H * 0.04;
    top += used; room -= used;
  }

  /* relative type sizes; `k` scales them all to the space left */
  const rows = [];
  if (cfg.org)   rows.push({ t: cfg.org.toUpperCase(),   rel: 0.42, fam: sans,   wt: '500', st: '',  track: 0.16, col: accent });
  if (cfg.title) rows.push({ t: cfg.title.toUpperCase(), rel: 1.00, fam: f.title, wt: f.titleW, st: '', track: 0.04, col: ink });
  if (cfg.name)  rows.push({ t: cfg.name,                rel: 0.70 * f.nameScale, fam: f.name, wt: '400', st: f.nameStyle, track: 0, col: ink, rule: true });
  if (cfg.date)  rows.push({ t: cfg.date.toUpperCase(),  rel: 0.36, fam: sans,   wt: '400', st: '',  track: 0.18, col: accent });

  if (rows.length) {
    const LH = 1.12, GAP = 0.34, RULE = 0.42;
    let units = 0;
    rows.forEach((r, i) => {
      units += r.rel * LH;
      if (i) units += rows[i - 1].rel * GAP;
      if (r.rule && i) units += RULE;
    });

    // cap so a tall sticker with one line does not render absurdly large
    const k = Math.min(room / units, H * 0.26);
    let cursor = top + (room - units * k) / 2;

    rows.forEach((r, i) => {
      if (i) cursor += rows[i - 1].rel * GAP * k;
      if (r.rule && i) {
        g.fillStyle = rule;
        g.fillRect(W / 2 - safe * 0.16, cursor + RULE * k * 0.45, safe * 0.32, Math.max(1.5, H * 0.008));
        cursor += RULE * k;
      }

      const planned = r.rel * k;
      const px = fitFont(g, r.t, safe, planned, r.fam, r.wt, r.track);
      g.font = `${r.st} ${r.wt} ${px}px ${r.fam}`.trim();
      g.fillStyle = r.col;
      const baseline = cursor + planned * 0.82;
      if (r.track) {
        tracked(g, r.t, W / 2, baseline, px * r.track);
      } else {
        g.fillText(r.t, W / 2 - g.measureText(r.t).width / 2, baseline);
      }
      cursor += planned * LH;
    });
  }

  return c;
}

function stickerTexture(cfg, aspect) {
  const t = new THREE.CanvasTexture(stickerCanvas(cfg, aspect));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function applyDecalUv(map, dw, dh) {
  /* Cap UVs from ExtrudeGeometry are world units, so undo the sticker size
     to land one copy across it. No Y negation: three already flips textures. */
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  map.repeat.set(1 / dw, 1 / dh);
  map.offset.set(0.5, 0.5);
  return map;
}

function stickerMaterials(cfg, aspect, dw, dh) {
  const gloss = (cfg.laminate || 'gloss') === 'gloss';
  const map = applyDecalUv(stickerTexture(cfg, aspect), dw, dh);
  const face = new THREE.MeshPhysicalMaterial({
    map,
    roughness: gloss ? 0.26 : 0.82,
    metalness: 0,
    clearcoat: gloss ? 1 : 0.06,
    clearcoatRoughness: gloss ? 0.04 : 0.6,
    envMapIntensity: gloss ? 1.1 : 0.4,
  });
  const edge = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.7, metalness: 0 });
  return [face, edge];
}

/* ───────────────────────── sheet & base materials ───────────────────────── */

function sheetMaterial(spec) {
  if (spec.kind === 'glass') {
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: spec.rough,
      transmission: 1, thickness: 0.8, ior: 1.49,
      clearcoat: 1, clearcoatRoughness: 0.03,
      transparent: true, envMapIntensity: 1.4,
    });
  }
  if (spec.kind === 'mirror') {
    return new THREE.MeshStandardMaterial({
      color: spec.color, metalness: 1, roughness: 0.14, envMapIntensity: 1.0,
    });
  }
  /* Cast acrylic is TRANSLUCENT — light goes through it and the cut edges
     glow. Rendering it opaque is what made these look like thick painted
     metal instead of thin coloured sheet. */
  return new THREE.MeshPhysicalMaterial({
    color: spec.color,
    metalness: 0,
    roughness: 0.07,
    transmission: 0.78,
    thickness: 0.9,
    ior: 1.49,
    attenuationColor: new THREE.Color(spec.color),
    attenuationDistance: 2.2,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    transparent: true,
    envMapIntensity: 1.25,
  });
}

function finishMaterial(fin) {
  return new THREE.MeshPhysicalMaterial({
    color: fin.color, metalness: fin.metal, roughness: fin.rough,
    clearcoat: fin.metal ? 0 : 0.5, clearcoatRoughness: 0.25,
    envMapIntensity: fin.metal ? 1.1 : 0.8,
  });
}

/* ───────────────────────── sizes ───────────────────────── */

/* `t` is sheet thickness — 5 to 8 mm, as supplied. */
export const SIZES = {
  s: { label: 'Small',  total: 17, w: 5.4, t: 0.35, baseH: 3.6, mult: 1.00, hint: 'Participation and class awards' },
  m: { label: 'Medium', total: 22, w: 6.8, t: 0.45, baseH: 4.2, mult: 1.45, hint: 'The usual size for most events' },
  l: { label: 'Large',  total: 28, w: 8.2, t: 0.55, baseH: 5.0, mult: 2.05, hint: 'Overall champion and grand prizes' },
};

/* ───────────────────────── occasions ───────────────────────── */

export const OCCASIONS = {
  pageant: {
    label: 'Pageant', hint: 'Mutya, Mr & Ms, coronation',
    cfg: { shape: 'lady', material: 'white', size: 'l', baseKind: 'goldbar', baseFinish: 'gold',
           decal: 'rect', scheme: 'black', laminate: 'gloss', font: 'script', motif: 'crown',
           org: 'Mutya ng Calapan', title: '1st Runner-Up', name: 'Maria C. Lualhati', date: '2026' },
  },
  liga: {
    label: 'Sports / Liga', hint: 'Basketball, volleyball, athletics',
    cfg: { shape: 'shield', material: 'blue', size: 'm', baseKind: 'goldbar', baseFinish: 'black',
           decal: 'shield', scheme: 'navy', laminate: 'gloss', font: 'sport', motif: 'laurel',
           org: 'Barangay Liga 2026', title: 'Champion', name: "Men's Basketball", date: 'Calapan City' },
  },
  school: {
    label: 'School awards', hint: 'Recognition day, honour roll',
    cfg: { shape: 'arch', material: 'white', size: 'm', baseKind: 'block', baseFinish: 'black',
           decal: 'rect', scheme: 'white', laminate: 'matte', font: 'classic', motif: 'star',
           org: 'Calapan City NHS', title: 'Most Outstanding', name: 'Juan D. Reyes', date: 'SY 2025 – 2026' },
  },
  fiesta: {
    label: 'Fiesta', hint: 'Street dance, float, palaro',
    cfg: { shape: 'oval', material: 'red', size: 'm', baseKind: 'octbox', baseFinish: 'black',
           decal: 'circle', scheme: 'gold', laminate: 'gloss', font: 'sport', motif: 'star',
           org: 'Barangay Fiesta', title: '1st Place', name: 'Street Dance', date: 'May 2026' },
  },
  contest: {
    label: 'Contest / Quiz', hint: 'Quiz bee, debate, science fair',
    cfg: { shape: 'plaque', material: 'green', size: 's', baseKind: 'utilbox', baseFinish: 'black',
           decal: 'rect', scheme: 'green', laminate: 'matte', font: 'formal', motif: 'laurel',
           org: 'Division Quiz Bee', title: '2nd Place', name: 'Team Naujan', date: '2026' },
  },
  corporate: {
    label: 'Corporate', hint: 'Service, sales, partner awards',
    cfg: { shape: 'facet', material: 'black', size: 'm', baseKind: 'utilbox', baseFinish: 'silver',
           decal: 'rect', scheme: 'gold', laminate: 'matte', font: 'modern', motif: 'none',
           org: 'Mindoro Growers Co-op', title: 'Partner of the Year', name: 'Tala Artisan', date: '2026' },
  },
};

/* ───────────────────────── base geometry ───────────────────────── */

function octagonShape(r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  return s;
}

/** Returns the base meshes, where the top surface is, and where a
    base-mounted sticker should sit. */
function buildBase(kind, mat, bw, bd, bh) {
  const group = new THREE.Group();
  let front;

  if (kind === 'goldbar') {
    /* A four-sided frustum: CylinderGeometry with 4 segments, turned so a
       face points at us, then scaled from a square to the bar's rectangle. */
    /* Bake the 45-degree turn into the geometry. A mesh rotation would be
       applied AFTER scale, which rotates the finished bar in world space and
       leaves its faces pointing at the corners — the base sticker then lands
       on an edge instead of the front. */
    const g = new THREE.CylinderGeometry(0.94, 1.0, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    const m = new THREE.Mesh(g, mat);
    m.scale.set(bw / 1.414, bh, bd / 1.414);
    m.position.y = bh / 2;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    /* The bar is a 4-sided frustum: after the 45-degree turn its faces sit at
       r * 0.7071 * (bd / 1.414) = r * bd * 0.5 from the centre, and r is 0.97
       at mid height. Anything nearer than that is buried inside the bar. */
    front = { z: bd * 0.50, y: bh * 0.50, w: bw * 0.74, h: bh * 0.62,
              tilt: Math.atan((bd * 0.03) / bh) };

  } else if (kind === 'octbox') {
    const r = Math.max(bw, bd) * 0.5;
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(octagonShape(r), {
      depth: bh, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2,
    }), mat);
    /* -90 on X maps the extrusion's +Z into +Y, so the box already spans
       0..bh. Offsetting by bh again floated it clear of the ground. */
    m.rotation.x = -Math.PI / 2;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    front = { z: r * 0.93, y: bh * 0.50, w: r * 1.12, h: bh * 0.62, tilt: 0 };

  } else if (kind === 'utilbox') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
    m.position.y = bh / 2;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    front = { z: bd / 2, y: bh * 0.50, w: bw * 0.80, h: bh * 0.64, tilt: 0 };

  } else {
    const lowH = bh * 0.62, upH = bh - lowH;
    const lower = new THREE.Mesh(new THREE.BoxGeometry(bw, lowH, bd), mat);
    lower.position.y = lowH / 2;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.80, upH, bd * 0.76), mat);
    upper.position.y = lowH + upH / 2;
    for (const m of [lower, upper]) { m.castShadow = m.receiveShadow = true; group.add(m); }
    front = { z: bd / 2, y: lowH * 0.50, w: bw * 0.70, h: lowH * 0.60, tilt: 0 };
  }

  /* The real boxes are screwed down at the corners — four brass heads is the
     detail that stops a sprayed PVC box reading as a plain block. */
  if (kind === 'octbox' || kind === 'utilbox') {
    const head = new THREE.CylinderGeometry(0.17, 0.17, 0.09, 12);
    const brass = new THREE.MeshStandardMaterial({
      color: 0xB8863B, metalness: 1, roughness: 0.3, envMapIntensity: 1.1,
    });
    const ix = bw * (kind === 'octbox' ? 0.26 : 0.38);
    const iz = bd * (kind === 'octbox' ? 0.26 : 0.36);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const m = new THREE.Mesh(head, brass);
        m.position.set(sx * ix, bh + 0.03, sz * iz);
        m.castShadow = true;
        group.add(m);
      }
    }
  }

  return { group, top: bh, front };
}

/* ───────────────────────── assembly ───────────────────────── */

/* ExtrudeGeometry will quietly emit NaN positions if a hole crosses the
   outline or a sliver is degenerate, and the whole piece then vanishes.
   Try the full drawing; if it comes back unusable, drop the interior cuts
   and extrude the outline alone rather than rendering nothing. */
function safeExtrude(shape, opts) {
  const check = g => {
    g.computeBoundingBox();
    const b = g.boundingBox;
    return b && Number.isFinite(b.min.x) && Number.isFinite(b.max.y) &&
           b.max.y - b.min.y > 1e-4 && g.attributes.position.count > 0;
  };
  let geo = new THREE.ExtrudeGeometry(shape, opts);
  if (check(geo)) return geo;

  geo.dispose();
  if (shape.holes && shape.holes.length) {
    console.warn('[tala] interior cuts would not triangulate; cutting the outline only');
    const bare = shape.clone();
    bare.holes = [];
    geo = new THREE.ExtrudeGeometry(bare, opts);
    if (check(geo)) return geo;
    geo.dispose();
  }
  console.warn('[tala] outline would not extrude; falling back to the arch');
  return new THREE.ExtrudeGeometry(SHAPES.arch.build(6.8, 17.8), opts);
}

export function buildTrophy(cfg) {
  const shape = SHAPES[cfg.shape] || SHAPES.arch;
  const mat   = MATERIALS[cfg.material] || MATERIALS.blue;
  const size  = SIZES[cfg.size] || SIZES.m;
  const fin   = BASE_FINISHES[cfg.baseFinish] || BASE_FINISHES.black;
  const kind  = BASES[cfg.baseKind] ? cfg.baseKind : 'goldbar';

  const group = new THREE.Group();
  const w = size.w, t = size.t;

  /* The base carries the name plate for the figures, so it is taller there.
     Blade height always makes up the advertised total. */
  const onBase = !!shape.decal.onBase;
  const bh = size.baseH * (onBase ? 1.35 : 1);
  const h = size.total - bh;

  const cut = shape.build(w, h, cfg.variant);

  /* The base normally follows the nominal width, but it must reach every
     point where the cut touches down. The volleying footballer lands 5 units
     off his centre of mass; the crouching basketball player plants one foot
     and reaches the other toe far behind him. An earlier version widened only
     for the one-sided case and left the crouch's back foot standing on air. */
  let bw = w * 2 * 0.86 + 2.8;
  if (cut) {
    const pts = [cut, ...(cut.holes || [])].flatMap(r => r.getPoints(240));
    const ys = pts.map(p => p.y);
    const bot = Math.min(...ys), span = Math.max(...ys) - bot;
    // 12%, not 3%: stock drawings put the far foot a little higher for
    // perspective (the women's Dig lunge), and that foot still has to be over the base
    const foot = pts.filter(p => p.y <= bot + span * 0.12).map(p => p.x);
    if (foot.length) {
      const lo = Math.min(...foot), hi = Math.max(...foot);
      bw = Math.max(bw, 2 * (Math.max(Math.abs(lo), Math.abs(hi)) + w * 0.13));
    }
  }
  const bd = Math.max(5.2, w * 0.90);
  const base = buildBase(kind, finishMaterial(fin), bw, bd, bh);
  base.group.name = 'base';           // named so a scroll scene can move the parts
  group.add(base.group);
  const baseTop = base.top;

  /* the cut blade */
  const bevel = Math.min(0.04, t * 0.12);
  const geo = safeExtrude(cut, {
    depth: t, bevelEnabled: true,
    bevelThickness: bevel, bevelSize: bevel, bevelOffset: 0, bevelSegments: 2,
    curveSegments: 54,
  });
  geo.translate(0, 0, -t / 2);
  geo.computeBoundingBox();
  const faceZ = geo.boundingBox.max.z;

  const blade = new THREE.Mesh(geo, sheetMaterial(mat));
  blade.castShadow = true;
  blade.receiveShadow = true;
  blade.position.y = baseTop - h * 0.015;   // seated into the base, not balanced on it
  blade.name = 'blade';
  group.add(blade);

  /* Layered designs: the accent pieces, a thinner second sheet laid on the
     front of the panel. Gold mirror, or silver when the panel is gold. */
  const accents = accentShapes(cfg.shape, w, h, cfg.variant);
  if (accents.length) {
    const ta = t * 0.6, ab = Math.min(0.03, ta * 0.12);
    /* Brushed metallic acrylic, not mirror: a mirror only shows the dark
       studio around it and read as bronze. This holds its own colour. */
    const accMat = new THREE.MeshPhysicalMaterial({
      color: cfg.material === 'gold' ? 0xD9DDE2 : 0xE0B24A,
      metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08,
      emissive: cfg.material === 'gold' ? 0x15161a : 0x2a1c05, envMapIntensity: 1.25,
    });
    accents.forEach((shp, i) => {
      const ag = safeExtrude(shp, { depth: ta, bevelEnabled: true, bevelThickness: ab,
        bevelSize: ab, bevelOffset: 0, bevelSegments: 2, curveSegments: 36 });
      const m = new THREE.Mesh(ag, accMat);
      m.position.set(0, blade.position.y, faceZ + 0.002);
      m.castShadow = true;
      m.name = 'accent' + i;
      group.add(m);
    });
  }

  /* The customer's own image, printed and applied to the whole cut figure.
     Nothing is generated here — the figure is bare acrylic unless they give
     us artwork. The decal mesh IS the silhouette, so it cannot bleed past
     the cut edge; it is inset by the bevel so no rim of acrylic shows. */
  if (onBase && cfg.photoImg && cfg.photoTarget === 'figure') {
    const k = Math.max(0.90, 1 - bevel / w);
    const aw = w * k, ah = h * k;
    const artGeo = safeExtrude(shape.build(aw, ah, cfg.variant), {
      depth: 0.03, bevelEnabled: false, curveSegments: 54,
    });
    const tex = new THREE.CanvasTexture(coverCanvas(cfg.photoImg, aw * 2, ah));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1 / (aw * 2), 1 / ah);
    tex.offset.set(0.5, 0);

    const artMesh = new THREE.Mesh(artGeo, new THREE.MeshPhysicalMaterial({
      map: tex, roughness: 0.28, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.0,
    }));
    artMesh.position.set(0, blade.position.y + (h - ah) / 2, faceZ + 0.004);
    artMesh.name = 'figurePhoto';
    group.add(artMesh);
  }

  /* "Your art" cut from the customer's picture, with the picture printed on
     it (print-and-cut). cutout.js crops the picture to exactly the traced
     outline's box, so mapping the texture through the cut's own bounding box
     lines picture and edge up; the background is transparent, and alphaTest
     drops it, so nothing prints past the cut. */
  if (cfg.shape === 'custom' && cfg.cutArt && cfg.cutPrint) {
    const artGeo = safeExtrude(shape.build(w, h, cfg.variant), {
      depth: 0.03, bevelEnabled: false, curveSegments: 24,
    });
    artGeo.computeBoundingBox();
    const bb = artGeo.boundingBox;
    const tex = new THREE.CanvasTexture(cfg.cutArt);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1 / (bb.max.x - bb.min.x), 1 / (bb.max.y - bb.min.y));
    tex.offset.set(-bb.min.x * tex.repeat.x, -bb.min.y * tex.repeat.y);
    const printed = new THREE.Mesh(artGeo, new THREE.MeshPhysicalMaterial({
      map: tex, transparent: true, alphaTest: 0.5, roughness: 0.28, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.0,
    }));
    printed.position.set(0, blade.position.y, faceZ + 0.004);
    printed.name = 'cutPrint';
    group.add(printed);
  }

  /* sticker — on the blade, or on the base front for the figures */
  const d = layeredOn(cfg.shape, cfg.variant) ? LAYERED[cfg.shape].decal : shape.decal;
  let dw, dh, pos, rotX = 0;

  if (d.onBase) {
    dw = base.front.w;
    dh = base.front.h;
    pos = new THREE.Vector3(0, base.front.y, base.front.z + 0.02);
    rotX = -base.front.tilt;
  } else {
    /* `cfg.place` is the customer's own placement, dragged on the 3D face:
       x as a fraction of the width from centre, y as a fraction of the height
       from the foot, s a size multiplier, r a rotation in radians. Without it
       the sticker sits in the design's own box. */
    const P = cfg.place || {};
    const sc = P.s || 1;
    dw = w * 2 * d.w * sc;
    dh = h * d.h * sc;
    if (DECALS[cfg.decal]?.ratio === 1) dw = dh = Math.min(dw, dh);
    pos = new THREE.Vector3(w * 2 * (P.x ?? d.x ?? 0), blade.position.y + h * (P.y ?? d.y), faceZ - 0.004);
  }

  const decalGeo = new THREE.ExtrudeGeometry(
    (DECALS[cfg.decal] || DECALS.rect).build(dw, dh),
    { depth: 0.045, bevelEnabled: false, curveSegments: 40 }
  );
  const sticker = new THREE.Mesh(decalGeo, stickerMaterials(plateCfg(cfg), dw / dh, dw, dh));
  sticker.position.copy(pos);
  sticker.rotation.x = rotX;
  if (!d.onBase && cfg.place?.r) sticker.rotation.z = cfg.place.r;
  sticker.name = 'sticker';
  group.add(sticker);

  /* The printable face, for dragging the sticker on it: the cut outline and
     its holes, and the accent pieces it must stay off, all in the group's
     x/y at the face. Only for stickers on the acrylic, not on a base front. */
  if (!d.onBase && cut) {
    const by = blade.position.y;
    const ring = pts => pts.map(p => [p.x, p.y + by]);
    group.userData.face = {
      poly: ring(cut.getPoints(64)),
      holes: (cut.holes || []).map(hh => ring(hh.getPoints(32))),
      accents: accents.map(a => ring(a.getPoints(48))),
      z: faceZ, w, h, by,
      box: d,                                   // the design's own sticker box
      base: { w: w * 2 * d.w, h: h * d.h },     // sticker size at s = 1
    };
  }

  group.userData.height = baseTop + h;
  group.userData.dims = { w, h, t, dw, dh, total: size.total, aspect: dw / dh };
  return group;
}

/* Repaint only the artwork — geometry, sheet and GPU state all stay. */
/* When the photo is printed on the figure it must not also appear inside the
   base plate — the plate carries the wording. */
function plateCfg(cfg) {
  return (SHAPES[cfg.shape]?.decal.onBase && cfg.photoTarget === 'figure')
    ? { ...cfg, photoImg: null }
    : cfg;
}

export function setSticker(group, cfg) {
  const d = group.userData.dims;
  const mesh = group.getObjectByName('sticker');
  if (!d || !mesh) return;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const face = mats[0];
  face.map?.dispose();
  face.map = applyDecalUv(stickerTexture(plateCfg(cfg), d.aspect), d.dw, d.dh);

  const gloss = (cfg.laminate || 'gloss') === 'gloss';
  face.roughness = gloss ? 0.26 : 0.82;
  face.clearcoat = gloss ? 1 : 0.06;
  face.clearcoatRoughness = gloss ? 0.04 : 0.6;
  face.envMapIntensity = gloss ? 1.1 : 0.4;
  face.needsUpdate = true;
}

export function disposeGroup(group) {
  const seen = new Set();
  group.traverse(o => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      for (const k of ['map', 'roughnessMap', 'normalMap']) {
        const tx = m[k];
        if (tx && !seen.has(tx)) { seen.add(tx); tx.dispose(); }
      }
      m.dispose();
    }
  });
}

/* ───────────────────────── schedule & delivery ───────────────────────── */

/* Mon–Sat are working days here; the shop is closed Sunday. */
export function addWorkingDays(from, days) {
  const d = new Date(from.getTime());
  let left = Math.max(0, Math.round(days));
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left--;
  }
  return d;
}

export const fmtDate = d =>
  d.toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export const SPEEDS = {
  rush:     { label: 'Rush',     days: 3,  mult: 1.30, hint: '3 working days', note: 'Jumps the queue. Subject to the schedule — we confirm before taking payment.' },
  standard: { label: 'Standard', days: 7,  mult: 1.00, hint: '1 week',         note: 'Our normal run. Safe for anything booked a fortnight out.' },
  economy:  { label: 'Economy',  days: 14, mult: 0.92, hint: '2 weeks',        note: 'We batch it with other jobs. Cheapest option if your date is far off.' },
};

export const ZONES = {
  pickup:   { label: 'Studio pickup',      fee: 0,   per: 0,  days: 0, hint: 'Calapan City' },
  province: { label: 'Oriental Mindoro',   fee: 180, per: 8,  days: 1, hint: 'Next day, island-wide' },
  luzon:    { label: 'Rest of Luzon',      fee: 420, per: 18, days: 3, hint: 'Courier, 3 days' },
  vismin:   { label: 'Visayas / Mindanao', fee: 780, per: 28, days: 6, hint: 'Courier, 5–7 days' },
};

/* Confirmed by the owner, 22 Oct 2026: cash, GCash, PayMaya, bank transfer.
   No card payments. */
export const PAYMENTS = {
  cash:   { label: 'Cash',          fee: 0, hint: 'On pickup, or COD within the province' },
  gcash:  { label: 'GCash',         fee: 0, hint: 'Send to the number on your invoice' },
  maya:   { label: 'PayMaya',       fee: 0, hint: 'Send to the number on your invoice' },
  bank:   { label: 'Bank transfer', fee: 0, hint: 'Details come with the invoice' },
};

/* ───────────────────────── pricing ───────────────────────── */

export const QTY_TIERS = [
  { min: 50, mult: 0.70, label: '50+' },
  { min: 25, mult: 0.77, label: '25–49' },
  { min: 10, mult: 0.84, label: '10–24' },
  { min: 5,  mult: 0.92, label: '5–9' },
  { min: 1,  mult: 1.00, label: '1–4' },
];

const UNIT_BASE = 170;          // small acrylic blade + one printed sticker + plain block
const EXTRA_STICKER_FEE = 40;
const ARTWORK_FEE = 150;
/* "Your art" from a picture: the picture printed over the whole cut piece is
   print work on every piece; preparing the customer's cut file is a one-off,
   charged as artwork. Estimates, like every price here. */
const CUT_PRINT_FEE = 60;
const PROOF_DAYS = 2;

export function quote(cfg, today = new Date()) {
  const shape = SHAPES[cfg.shape] || SHAPES.arch;
  const mat   = MATERIALS[cfg.material] || MATERIALS.blue;
  const size  = SIZES[cfg.size] || SIZES.m;
  const baseK = BASES[cfg.baseKind] || BASES.goldbar;
  const speed = SPEEDS[cfg.speed] || SPEEDS.standard;
  const zone  = ZONES[cfg.zone] || ZONES.pickup;
  const pay   = PAYMENTS[cfg.payment] || PAYMENTS.cash;
  const qty   = Math.max(1, Math.min(2000, Math.floor(cfg.qty) || 1));

  // a cut from the customer's picture is priced by its width, like every other
  // shape: the sheet is bought by the rectangle (2.31 per unit width per height)
  const cutFromPic = cfg.shape === 'custom' && cfg.cutAspect;
  const shapeK = cutFromPic ? Math.max(shape.base, 2.31 / cfg.cutAspect + 0.03) : shapeBase(cfg.shape, cfg.variant);
  const materialCost = UNIT_BASE * shapeK * size.mult * mat.mult;
  const extras = baseK.fee + (cfg.extraSticker ? EXTRA_STICKER_FEE : 0)
               + (cutFromPic && cfg.cutPrint ? CUT_PRINT_FEE : 0);
  const tier = QTY_TIERS.find(t => qty >= t.min) || QTY_TIERS[QTY_TIERS.length - 1];

  const unit = Math.round(((materialCost + extras) * speed.mult * tier.mult) / 5) * 5;
  const make = unit * qty;
  const setup = (cfg.logo || cutFromPic) ? ARTWORK_FEE : 0;
  const shipping = zone.fee ? Math.round(zone.fee + zone.per * qty) : 0;

  const beforeFee = make + setup + shipping;
  const payFee = Math.round(beforeFee * pay.fee);

  const days = PROOF_DAYS + speed.days + zone.days;

  return {
    unit, qty, tier, speed, zone, pay, baseK,
    make, setup, shipping, payFee, total: beforeFee + payFee,
    days, arrival: addWorkingDays(today, days),
    rushAdj: Math.round((speed.mult - 1) * 100),
  };
}

/* Single-piece figure for the shop cards. */
export function price(cfg) {
  return quote({ ...cfg, qty: cfg.qty ?? 1, speed: 'standard', zone: 'pickup', payment: 'cash' });
}

export const peso = n => '₱' + Math.round(n).toLocaleString('en-PH');
