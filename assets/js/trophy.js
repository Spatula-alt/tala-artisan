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
  /* Which rings are holes? One inside an odd number of others is a hole; the
     rest are pieces. A figure used to be ONE outline and then its holes, so
     subs[0] was the outline and everything after it a hole. That broke the day
     a ball was cut as its own piece -- read as a hole, it was punched out of
     nothing. No figure has a second piece today, but a customer's own outline
     can. Tested on one anchor per ring: rings here never cross. */
  const anchors = subs.map(sp => sp.map(seg => typeof seg[0] === 'number' ? seg : seg.slice(-2)));
  const inside = ([x, y], poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const depth = anchors.map((a, i) => anchors.reduce((n, b, j) => n + (j !== i && inside(a[0], b) ? 1 : 0), 0));

  let area = 0, moment = 0;
  const areas = subs.map((sp, i) => {
    const r = ringArea(sp);
    if (!r) return 0;
    const sign = depth[i] % 2 ? -1 : 1;    // holes subtract
    area += sign * r.area; moment += sign * r.area * r.cx;
    return r.area;
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

  const outers = subs.map((_, i) => i).filter(i => depth[i] % 2 === 0);
  const shapes = outers.map(i => {
    const s = build(subs[i], THREE.Shape);
    subs.forEach((sp, j) => {
      if (depth[j] === depth[i] + 1 && inside(anchors[j][0], anchors[i])) s.holes.push(build(sp, THREE.Path));
    });
    return s;
  });
  /* The biggest piece is THE shape, so everything that only wants one outline
     -- sticker fitting, the layered frame -- keeps working; the others ride
     along in userData.more. Anything that cuts or draws the piece goes
     through pieces(). */
  const lead = outers.reduce((b, i, n) => (areas[i] > areas[outers[b]] ? n : b), 0);
  const shape = shapes[lead];
  shape.userData = { frame: { k, cx, maxY }, more: shapes.filter(s => s !== shape) };
  return shape;
}

/* Every separate piece of a cut, the biggest first. */
function pieces(shape) {
  return shape ? [shape, ...((shape.userData && shape.userData.more) || [])] : [];
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

/* Every path below is EMITTED by polish-figure.py from figure-src/figures.json.
   Do not hand-edit the numbers: change the spec, rerun with --write. Its
   docstring has the method. In short, the source is either clean vector art
   (figure-src/pixabay) or the first-generation trace (figure-src/legacy, from
   trace-figure.py and photos of the shop's own pieces); the edge is smoothed,
   no figure carries a ball (the owner's call, after four rounds of trying
   to hold one well), and everything below the ground line becomes a mounting tab
   exactly 1.5% of the height --
   the depth buildTrophy sinks every blade into its base. So the feet stand ON
   the base, whole, and the tab is out of sight. 300 tall with the tab, y DOWN. */

/* The Gentleman is not authored at all — it is TRACED from the shop's own
   reference silhouette: the photo was thresholded, its holes filled, features
   under ~1 % of the height rounded off (a hair tuft that fine would snap out of
   5 mm sheet), the outer contour walked and then simplified. That is why it
   keeps the things a smooth profile spline destroys — the square shoulder, the
   corner where the jacket hem ends, the splayed shoes, and the fact that the two
   sides are not mirror images of each other. Drawn 300 tall, y down. */
const GENT_TRACE = `M90.6 299.9 L18.7 299.9 L18.4 299.8 L18.3 294.3 L17.6 292.6 L17.8 291.1 L19.1 288.1 L23.0 282.6
  L23.3 281.5 L23.3 277.6 L23.9 274.5 L23.5 272.5 L22.3 270.1 L22.2 268.1 L24.0 263.3 L24.3 261.7
  L21.9 249.6 L21.9 245.8 L23.8 210.8 L21.3 191.3 L23.2 160.5 L22.8 159.7 L22.0 159.1 L18.7 159.7
  L17.3 159.3 L16.7 158.5 L16.5 157.5 L17.0 152.3 L16.6 150.7 L15.2 148.6 L14.6 146.8 L14.0 137.4
  L13.3 135.7 L8.3 127.2 L6.8 121.2 L5.2 101.5 L9.0 62.6 L9.9 57.9 L10.6 56.4 L11.5 55.4
  L32.9 46.2 L39.5 41.0 L41.1 39.4 L41.7 37.7 L41.7 35.3 L41.4 33.1 L40.9 31.9 L38.7 29.1
  L37.2 24.9 L37.8 20.1 L37.3 12.8 L38.3 8.5 L39.4 6.7 L42.3 4.6 L44.0 3.9 L47.0 1.4
  L48.7 0.8 L53.1 -0.1 L57.5 0.1 L60.9 1.6 L63.5 4.5 L65.9 6.4 L67.6 11.1 L67.2 14.2
  L67.1 18.6 L65.9 23.0 L65.2 27.1 L64.1 30.0 L62.7 32.1 L61.2 35.7 L59.5 38.7 L59.1 41.0
  L59.6 42.4 L62.4 45.4 L64.1 46.6 L83.2 53.5 L85.2 54.7 L86.4 56.7 L87.4 61.3 L87.2 66.0
  L87.7 72.3 L91.1 94.0 L90.8 104.7 L91.5 106.3 L94.3 109.9 L94.7 111.1 L93.2 124.1 L89.8 130.3
  L89.4 131.8 L90.1 136.7 L90.1 139.9 L89.9 141.1 L88.7 144.2 L87.8 147.7 L84.4 152.1 L83.0 154.8
  L82.5 156.4 L82.5 159.2 L83.3 168.5 L83.3 199.1 L82.6 222.7 L81.4 239.3 L78.3 258.6 L78.5 260.5
  L79.3 263.4 L79.3 264.3 L77.5 269.7 L77.7 272.0 L79.5 275.9 L80.1 279.7 L82.2 283.5 L84.1 285.6
  L89.4 288.8 L90.4 289.9 L90.9 290.9 L91.1 293.1 L90.6 294.3 Z
  M75.5 295.1 L75.4 294.2 L71.7 293.0 L70.3 291.7 L68.6 289.7 L67.9 289.3 L66.9 289.3 L65.5 289.8
  L64.2 289.8 L61.6 289.1 L60.3 288.2 L60.0 287.2 L59.9 283.6 L58.5 279.9 L57.8 277.1 L57.1 273.2
  L57.1 270.6 L57.5 267.9 L57.9 266.3 L60.6 261.3 L60.6 260.1 L59.1 254.3 L59.0 249.1 L60.0 241.3
  L59.9 230.4 L61.1 220.6 L60.8 219.2 L58.6 214.8 L58.3 213.4 L58.4 211.5 L59.5 205.3 L59.6 201.4
  L56.4 186.6 L55.8 176.2 L55.4 174.9 L54.2 172.7 L53.5 172.0 L52.8 171.9 L52.1 172.3 L51.8 172.9
  L50.5 180.3 L47.3 189.0 L45.9 201.6 L40.8 223.3 L39.8 252.5 L44.1 265.9 L44.5 268.5 L44.5 271.2
  L43.6 273.9 L39.9 281.7 L38.9 286.3 L36.7 289.5 L36.1 292.2 L35.4 293.0 L32.2 294.2 L32.1 295.0
  L32.5 295.1 Z`;

/* ── posed figures ──────────────────────────────────────────────────────────
   A profile can say how WIDE a body is at each height; it cannot say where the
   limbs are, so it can never show a spike, a guard or a stride. These six are
   posed in `pose-figure.py` — every bone a tapered capsule, every joint and
   ball a circle — and the union is traced by `trace-figure.py`, which rounds
   the joints and guarantees one solid contour with no holes. Rerun either
   script to change a pose; do not hand-edit the numbers below. */

/* Traced straight off the shop's own red acrylic figure: the wave in the hair,
   the profile, the arm swung out with the hand open, the fitted bodice, the
   kick in the hem, the legs apart and the heels. The photo was shot 5.7 degrees
   off level -- the piece's own mounting strip slanted -- so the polish turns
   her upright and cuts that strip off at its top edge: she stands on the base,
   not on a sliver of old tab. (The first trace used an opening wide enough to
   fuse her legs into one mass; the gap between them is four source pixels
   where it starts, under the hem.) */
const LADY_TRACE = `M83.5 299.9 L3.5 299.9 L3.3 299.7 L3.3 295.4 L3.9 294.8 L4.2 293.6 L3.3 291.4 L3.2 289.8
  L3.6 288.3 L4.8 285.6 L4.8 283.8 L3.8 283.1 L1.0 284.3 L-0.4 284.3 L-2.2 283.1 L-2.8 281.9
  L-2.8 281.0 L-2.3 279.6 L-0.5 277.0 L0.5 274.8 L2.9 271.9 L4.4 268.7 L5.6 266.7 L7.3 265.1
  L8.7 264.3 L12.3 263.4 L13.7 262.7 L15.1 261.7 L16.2 260.5 L16.9 258.1 L19.0 254.3 L19.6 252.5
  L21.7 249.3 L22.8 245.0 L25.4 237.7 L26.0 234.7 L27.2 232.3 L27.9 230.1 L30.0 225.2 L31.4 223.2
  L33.0 219.9 L33.9 218.6 L41.0 211.4 L41.6 210.2 L41.5 209.3 L40.7 208.6 L34.2 207.3 L28.8 204.9
  L24.7 202.0 L22.1 199.5 L20.0 195.9 L19.4 192.3 L18.6 190.8 L12.5 185.4 L9.6 181.2 L7.8 176.1
  L7.5 174.2 L7.8 172.7 L8.6 171.5 L10.4 169.9 L20.0 166.3 L25.0 163.6 L28.7 160.9 L34.4 156.3
  L37.9 152.8 L43.3 145.7 L51.2 132.3 L52.7 130.3 L56.2 126.3 L66.4 116.3 L67.9 113.8 L68.8 111.6
  L69.6 107.5 L69.6 104.6 L69.1 100.6 L67.4 94.8 L66.6 92.6 L65.2 89.8 L64.3 88.7 L63.5 88.3
  L62.9 88.5 L61.8 89.4 L56.9 95.5 L45.9 113.5 L41.2 118.8 L25.4 134.2 L22.4 137.8 L17.9 144.1
  L15.4 146.5 L10.8 149.0 L6.8 152.0 L4.9 152.7 L3.4 152.5 L2.1 151.8 L1.3 150.6 L0.9 149.2
  L0.3 148.6 L-1.0 149.0 L-4.8 152.3 L-6.4 152.8 L-8.0 152.7 L-9.9 151.8 L-11.1 150.7 L-11.7 149.0
  L-11.2 146.2 L-11.3 142.8 L-10.9 141.9 L-8.7 140.0 L-0.1 136.1 L3.9 135.7 L5.9 135.9 L6.7 135.8
  L8.6 134.3 L11.6 132.6 L13.7 130.4 L20.7 120.2 L23.3 115.1 L28.6 106.8 L40.7 91.8 L42.8 87.6
  L44.4 85.3 L45.3 83.5 L51.2 69.7 L56.0 60.8 L58.5 57.9 L60.3 56.2 L65.6 53.8 L67.2 52.7
  L68.9 50.8 L70.3 48.3 L71.0 46.2 L71.0 45.3 L70.4 44.3 L69.7 43.8 L65.1 42.1 L61.4 40.1
  L60.2 39.1 L56.8 35.2 L53.2 33.5 L51.0 31.7 L49.5 30.0 L48.0 25.8 L47.8 24.0 L48.2 18.0
  L49.5 14.6 L50.6 13.0 L52.2 11.7 L54.9 10.6 L58.0 10.3 L58.9 9.7 L64.3 4.5 L66.3 3.3
  L71.3 1.4 L76.4 0.8 L79.4 -0.1 L86.9 1.4 L88.1 1.8 L89.2 2.5 L90.1 3.7 L91.7 6.9
  L94.7 11.6 L97.2 17.9 L98.7 19.2 L100.8 20.2 L101.5 21.2 L101.5 24.8 L103.1 33.1 L103.0 34.9
  L102.5 36.0 L101.5 37.0 L96.1 39.3 L95.0 40.2 L93.8 41.6 L92.9 43.4 L92.3 45.3 L92.0 53.0
  L92.5 54.8 L93.4 56.6 L97.9 62.8 L109.8 75.9 L110.6 77.5 L111.6 81.2 L111.4 83.7 L110.4 87.6
  L106.9 94.1 L106.4 95.9 L104.6 108.2 L99.7 126.4 L96.6 148.7 L95.2 174.3 L95.8 179.1 L95.8 186.1
  L96.7 190.4 L96.8 193.2 L97.7 196.9 L98.1 200.4 L101.0 209.5 L101.0 212.1 L100.1 213.7 L98.1 215.0
  L90.1 217.1 L85.5 221.0 L84.1 221.1 L79.8 220.1 L78.0 220.1 L76.9 220.5 L75.8 221.8 L75.3 223.1
  L74.3 228.5 L74.3 233.1 L73.8 235.4 L73.4 240.6 L73.8 244.1 L73.6 246.2 L73.8 253.1 L73.4 257.5
  L73.9 265.5 L75.9 277.0 L78.0 283.8 L79.2 290.4 L79.6 291.4 L81.1 293.6 L82.3 294.8 L83.5 295.3 Z
  M55.9 295.1 L57.2 294.4 L57.7 292.8 L57.7 288.8 L56.7 285.1 L56.3 280.5 L56.7 279.1 L59.7 272.7
  L60.0 270.8 L60.0 268.8 L59.6 267.0 L59.8 264.0 L57.8 256.3 L53.7 244.2 L53.5 240.6 L52.7 235.2
  L52.1 233.1 L51.4 232.8 L50.3 233.6 L47.1 239.3 L45.0 242.3 L43.5 245.7 L39.3 250.5 L33.5 259.4
  L27.1 272.4 L26.3 275.4 L24.4 279.7 L21.3 284.7 L19.2 286.9 L17.1 290.3 L16.6 293.4 L17.0 294.5
  L18.2 295.2 Z`;

/* Traced off the shop's own blue acrylic figure: the quiff, the profile, the
   suit shoulders and the arms hanging at the sides. Its two mounting tabs are
   cut off in the polish; the shoes stand on the base. The real piece has a thin slit cut between the right hand and the
   jacket; it is filled here, because the whole set is cut as ONE solid outline
   and a slit that fine is where the sheet would start to crack. */
const SUIT_TRACE = `M81.2 299.9 L25.6 299.9 L25.5 294.2 L22.6 290.5 L22.5 281.4 L22.2 280.4 L21.0 278.9 L21.2 277.9
  L23.3 275.4 L24.0 273.9 L25.4 269.4 L25.5 266.4 L24.3 261.5 L24.6 239.6 L22.8 215.3 L22.5 211.8
  L21.5 207.6 L21.1 200.2 L19.6 189.6 L18.6 173.5 L17.9 171.9 L16.6 171.2 L15.9 171.4 L13.3 172.8
  L11.9 173.2 L9.9 173.1 L6.3 171.8 L3.9 170.0 L2.8 168.8 L0.9 164.9 L0.1 162.8 L0.7 153.8
  L-0.5 149.8 L-0.5 147.3 L2.5 122.3 L6.4 102.4 L10.4 70.0 L12.7 58.8 L13.5 57.1 L15.2 55.4
  L33.0 48.1 L34.9 46.5 L35.8 44.8 L35.6 43.6 L34.9 42.7 L33.9 42.3 L30.3 42.0 L29.1 41.5
  L28.3 40.8 L27.5 38.7 L26.1 31.2 L24.1 27.3 L24.1 25.9 L24.5 24.3 L26.3 20.1 L26.3 16.3
  L27.9 10.3 L27.5 5.8 L27.9 4.2 L29.2 2.2 L30.4 1.0 L31.3 0.5 L33.4 -0.1 L55.5 0.1
  L57.0 0.6 L58.6 1.6 L62.6 5.7 L63.6 7.8 L64.8 11.5 L65.1 18.6 L63.6 24.7 L61.0 29.9
  L59.7 33.7 L59.5 35.2 L60.2 38.8 L63.2 43.0 L67.2 46.6 L83.9 52.8 L86.9 54.6 L88.0 55.8
  L89.5 59.4 L94.1 75.6 L99.5 99.3 L100.4 107.9 L98.8 113.9 L92.7 121.7 L83.3 131.0 L82.6 132.3
  L82.5 133.5 L85.4 157.0 L85.7 160.4 L85.2 161.8 L84.4 162.7 L80.9 164.7 L80.0 165.5 L79.4 166.4
  L79.0 168.1 L79.4 200.9 L77.8 214.2 L78.3 241.3 L77.4 244.1 L77.2 246.9 L77.2 253.6 L78.8 270.1
  L78.8 272.2 L77.5 282.3 L77.9 284.4 L79.2 288.0 L81.6 291.6 L81.7 293.1 L81.2 294.4 Z
  M60.7 295.2 L60.7 294.3 L60.3 293.8 L58.7 292.9 L50.2 291.8 L46.6 292.2 L45.4 293.1 L44.6 294.4
  L44.8 295.2 Z`;

/* Boxing — Victory. Both arms up, gloves raised. The one that wins a fight. */
const BOX_VICTORY_TRACE = `M116.9 299.9 L-4.0 299.9 L-4.0 294.3 L-4.7 293.5 L-5.0 292.6 L-4.9 290.4 L-4.5 288.9 L-3.1 286.8
  L0.6 283.2 L2.1 280.9 L5.0 277.2 L8.2 269.6 L8.1 265.5 L8.3 262.3 L7.6 256.9 L8.4 253.9
  L8.4 251.8 L7.1 229.9 L8.5 221.1 L11.7 211.6 L12.1 209.9 L13.6 199.0 L13.6 196.2 L13.0 191.9
  L12.5 190.5 L11.6 189.7 L6.7 187.4 L5.6 186.1 L5.5 184.4 L7.7 171.9 L10.1 163.4 L11.9 151.8
  L14.2 143.1 L15.5 136.0 L17.3 131.9 L19.5 129.5 L20.7 127.5 L21.2 126.0 L21.2 123.4 L22.3 117.9
  L23.9 115.3 L23.3 111.7 L23.3 104.9 L22.0 98.5 L21.1 95.9 L15.4 85.1 L9.0 71.3 L8.3 70.4
  L7.0 70.0 L3.3 71.0 L0.1 71.4 L-7.4 70.9 L-10.0 70.5 L-18.8 68.0 L-29.1 63.1 L-30.4 61.7
  L-30.9 60.8 L-31.2 59.7 L-31.2 57.0 L-29.2 48.5 L-25.4 39.2 L-17.7 28.9 L-17.3 27.5 L-17.3 25.7
  L-16.9 24.6 L-12.3 18.2 L-8.8 13.8 L-5.8 7.3 L-1.7 2.5 L1.0 0.9 L1.8 0.7 L3.3 0.7
  L5.8 1.4 L12.6 5.9 L15.6 8.6 L16.9 10.3 L18.0 12.7 L18.1 15.0 L17.2 17.7 L16.1 19.0
  L14.9 20.0 L13.2 20.6 L11.1 20.5 L10.2 20.8 L7.5 22.4 L4.7 23.2 L3.8 23.8 L-0.5 27.8
  L-4.6 33.6 L-5.5 34.4 L-7.2 35.2 L-7.9 36.7 L-9.8 45.0 L-10.2 48.0 L-10.0 48.6 L-9.4 49.2
  L-8.5 49.2 L-5.9 48.5 L-2.8 48.2 L0.0 48.6 L4.7 50.1 L5.8 49.8 L11.1 47.3 L17.4 46.7
  L21.3 47.6 L26.5 50.7 L27.3 50.9 L28.7 50.9 L34.6 48.6 L36.3 47.7 L36.9 46.8 L37.1 45.7
  L37.0 40.8 L35.7 36.6 L35.0 32.9 L32.7 29.1 L32.2 27.1 L32.2 25.2 L33.9 23.0 L34.2 22.0
  L34.2 13.3 L35.6 10.1 L37.8 7.6 L39.2 6.9 L43.5 5.3 L46.7 4.7 L49.4 4.7 L50.7 5.0
  L56.3 7.5 L57.8 8.5 L59.1 9.8 L60.7 13.1 L61.3 16.1 L60.9 22.8 L62.2 25.0 L62.4 26.8
  L61.0 30.7 L58.8 34.0 L57.5 39.9 L57.5 42.1 L57.8 44.5 L58.7 45.9 L59.4 46.3 L66.9 49.7
  L69.6 50.4 L70.7 50.0 L73.6 47.7 L75.7 46.6 L78.0 45.8 L79.8 45.4 L82.1 45.3 L86.5 45.7
  L88.5 46.3 L91.5 47.7 L92.6 48.0 L95.1 47.3 L99.1 45.8 L101.1 45.4 L103.0 45.3 L107.5 45.9
  L109.2 45.7 L109.8 45.1 L109.9 44.2 L109.2 38.7 L108.3 35.7 L106.7 32.6 L104.7 31.2 L99.2 25.2
  L95.8 22.4 L94.8 21.9 L91.7 21.3 L88.9 20.2 L88.2 20.0 L86.0 20.4 L84.9 20.1 L82.2 18.3
  L80.3 15.4 L79.9 13.7 L80.0 11.8 L82.6 7.1 L86.9 2.6 L89.8 0.7 L91.6 -0.1 L94.5 -0.1
  L96.3 0.6 L99.6 3.2 L102.5 6.4 L103.7 8.0 L105.5 11.3 L109.9 15.4 L115.3 21.4 L115.9 22.7
  L116.1 24.1 L116.5 25.0 L124.5 35.7 L127.6 42.0 L129.2 47.7 L130.8 51.5 L131.1 52.8 L131.1 54.4
  L130.5 56.2 L128.0 58.8 L115.5 65.4 L111.6 67.2 L103.2 69.1 L98.2 69.3 L91.1 68.4 L89.7 68.9
  L88.8 69.8 L87.6 72.0 L85.5 78.8 L78.2 92.7 L74.7 105.3 L74.7 107.6 L75.2 110.3 L75.1 113.8
  L76.0 116.5 L76.4 118.5 L76.2 122.2 L76.4 123.6 L77.1 124.9 L79.6 127.3 L80.9 129.2 L84.8 136.9
  L87.6 145.2 L89.7 154.7 L93.8 180.2 L93.4 181.0 L91.6 182.2 L91.0 183.3 L90.5 188.9 L89.3 194.2
  L89.2 195.9 L90.8 202.1 L92.1 210.1 L96.0 218.8 L97.6 224.9 L99.4 252.3 L99.7 253.7 L100.7 255.5
  L100.9 256.7 L100.9 262.9 L101.7 266.0 L101.9 269.2 L102.4 270.6 L104.1 272.9 L106.2 277.3 L115.6 287.3
  L116.5 288.9 L117.2 292.5 L117.2 293.7 L116.9 294.3 Z
  M98.4 295.1 L98.4 294.2 L97.3 293.1 L95.8 292.1 L91.5 290.2 L90.9 289.7 L90.2 288.5 L90.0 286.6
  L89.7 275.2 L89.2 272.7 L89.3 270.0 L88.6 267.0 L88.5 264.8 L87.6 261.6 L86.2 258.3 L86.0 254.8
  L83.8 247.8 L82.9 245.8 L79.3 239.9 L77.8 235.5 L77.0 230.3 L77.0 220.0 L76.1 216.0 L71.6 207.0
  L67.0 194.8 L65.9 192.4 L64.9 191.7 L63.3 191.3 L61.6 191.3 L58.4 191.9 L57.6 191.7 L57.1 191.0
  L51.8 170.0 L51.0 168.5 L50.4 167.8 L49.6 167.7 L49.0 168.2 L48.6 169.6 L48.1 176.2 L46.9 181.2
  L45.2 193.6 L44.7 194.4 L43.1 195.1 L41.5 195.4 L37.7 195.4 L36.5 196.1 L34.4 201.7 L28.4 216.0
  L28.1 217.1 L28.1 219.1 L28.6 224.1 L28.6 229.6 L28.3 235.0 L27.1 240.0 L23.7 247.8 L23.1 249.9
  L22.5 253.2 L22.5 254.8 L23.0 257.0 L22.0 260.5 L21.2 265.0 L21.5 270.1 L21.2 271.1 L21.0 277.1
  L22.1 282.9 L21.6 289.5 L21.0 291.0 L20.1 291.8 L18.8 292.5 L13.7 294.1 L13.4 294.3 L13.4 295.1 Z`;

/* Boxing — Guard. Side on, hands up, chin tucked. */
const BOX_GUARD_TRACE = `M72.8 299.9 L54.2 299.9 L54.1 294.3 L53.3 293.4 L52.9 292.4 L52.9 291.1 L53.4 289.9 L55.3 287.8
  L69.8 277.9 L70.5 277.1 L71.0 275.9 L70.8 275.0 L70.4 274.6 L69.2 274.2 L67.2 274.1 L57.0 273.8
  L46.2 275.2 L35.1 275.3 L31.7 274.7 L29.4 273.9 L27.7 272.5 L27.3 271.3 L27.8 269.8 L29.9 268.1
  L34.0 266.6 L39.5 265.2 L49.5 260.2 L50.6 259.3 L51.5 257.9 L53.3 252.5 L53.0 245.6 L50.3 237.1
  L50.3 235.6 L50.8 233.8 L50.4 231.9 L41.3 214.2 L37.8 206.1 L29.9 195.4 L29.0 193.5 L27.9 189.6
  L28.2 186.6 L30.0 181.9 L32.0 174.3 L32.0 168.8 L35.2 146.6 L40.7 131.0 L42.5 120.5 L43.3 118.5
  L45.4 115.7 L45.9 114.4 L45.4 110.7 L45.4 105.5 L44.2 99.8 L44.2 97.7 L45.1 94.4 L43.7 91.6
  L43.3 90.1 L43.0 82.6 L41.5 75.2 L38.1 68.3 L36.5 63.0 L35.7 62.1 L34.7 62.3 L33.9 63.0
  L27.6 71.3 L22.7 76.4 L20.2 80.3 L18.7 81.8 L16.1 82.8 L13.9 82.6 L11.1 81.5 L8.9 79.5
  L8.1 78.0 L6.1 72.9 L5.1 64.8 L3.4 57.7 L3.3 51.5 L3.5 47.9 L0.8 43.0 L-0.4 37.2
  L-0.5 33.1 L0.7 29.1 L2.3 26.5 L5.6 23.1 L7.8 21.4 L10.5 20.3 L12.6 20.3 L17.6 22.1
  L19.5 23.1 L21.0 24.7 L21.8 26.7 L22.6 33.4 L22.1 35.6 L21.1 37.7 L18.2 41.6 L17.2 43.8
  L16.5 46.2 L16.5 49.0 L17.1 51.7 L18.0 52.6 L19.2 52.4 L21.4 50.6 L23.5 49.3 L24.4 47.9
  L24.6 44.9 L25.1 41.7 L28.0 33.7 L28.2 32.4 L27.6 30.7 L25.5 27.1 L22.9 20.3 L22.2 17.2
  L22.5 13.4 L24.4 8.7 L28.0 4.0 L29.3 2.6 L31.8 1.2 L36.8 -0.1 L42.4 -0.1 L46.1 0.7
  L49.6 2.3 L52.3 4.6 L53.5 6.3 L55.8 11.3 L56.2 13.7 L56.1 17.8 L56.5 18.9 L58.5 20.8
  L60.2 23.5 L62.8 25.6 L75.7 30.4 L82.2 35.9 L87.2 42.2 L91.0 48.6 L92.5 52.7 L93.5 58.5
  L93.6 61.6 L93.3 73.4 L92.0 80.8 L91.7 86.9 L90.4 93.3 L90.4 94.7 L91.2 97.3 L90.7 102.5
  L91.4 106.2 L93.9 113.4 L98.2 121.6 L99.4 125.6 L100.3 130.6 L100.4 153.9 L99.3 169.0 L97.6 178.4
  L97.1 179.5 L96.5 180.1 L95.1 180.7 L88.9 180.7 L80.3 181.4 L78.9 181.8 L78.3 182.3 L77.8 183.8
  L77.8 190.4 L78.7 201.5 L79.1 203.7 L84.6 215.4 L87.7 226.5 L88.5 235.1 L88.1 257.4 L91.2 272.1
  L91.6 278.6 L93.9 285.4 L94.1 288.1 L93.3 289.8 L91.6 290.8 L82.5 291.7 L75.7 293.6 L72.9 294.2 Z`;

/* Boxing — Stance. Squared up, gloves down, feet planted wide. */
const BOX_STANCE_TRACE = `M112.8 299.9 L-11.5 299.9 L-11.8 299.8 L-11.8 294.3 L-12.7 292.6 L-12.7 291.3 L-12.1 288.9 L-10.9 286.1
  L-11.4 283.5 L-11.4 282.4 L-9.4 278.7 L-9.3 275.5 L-9.0 274.4 L-8.3 273.3 L-6.0 270.9 L-5.4 269.1
  L-5.4 266.5 L-4.5 260.3 L-4.2 242.7 L-3.1 238.5 L-3.0 236.1 L-2.3 233.7 L1.2 226.5 L5.2 221.1
  L5.8 219.8 L6.4 218.0 L7.5 215.5 L8.1 212.1 L9.9 207.1 L10.0 202.5 L8.7 198.3 L8.9 194.3
  L10.0 190.3 L10.5 184.5 L11.5 181.3 L11.8 178.0 L12.9 172.8 L13.0 170.0 L14.1 166.6 L14.5 162.4
  L15.4 159.1 L15.8 155.0 L16.9 150.5 L16.9 145.8 L18.2 140.8 L18.3 136.1 L19.3 132.5 L19.8 131.5
  L21.7 129.2 L22.7 126.8 L23.5 119.2 L24.4 115.9 L24.6 114.5 L23.7 111.3 L23.4 106.4 L22.0 103.1
  L13.1 92.5 L12.4 92.1 L11.5 92.1 L10.2 93.1 L6.6 101.8 L5.3 103.7 L2.5 106.9 L1.4 109.4
  L1.0 111.3 L0.8 123.2 L0.4 125.0 L-2.2 132.9 L-1.0 138.3 L-0.9 145.1 L-0.5 148.4 L0.4 149.5
  L4.5 152.5 L7.5 155.7 L8.9 157.8 L9.9 160.2 L10.4 162.9 L10.4 165.4 L10.1 166.9 L9.5 168.2
  L6.6 171.1 L5.2 175.4 L2.3 177.7 L0.1 178.6 L-5.0 179.9 L-13.1 179.9 L-14.8 179.5 L-16.6 178.6
  L-18.4 177.0 L-20.0 173.8 L-21.5 167.5 L-21.5 157.0 L-19.8 151.0 L-20.0 145.8 L-19.2 141.9 L-18.8 136.7
  L-18.4 135.5 L-16.8 132.5 L-16.9 125.2 L-16.2 120.8 L-16.1 113.3 L-15.2 110.3 L-15.0 107.9 L-14.1 104.3
  L-13.6 102.8 L-12.0 99.9 L-10.2 94.3 L-9.8 92.6 L-9.5 87.9 L-8.6 84.6 L-8.2 81.3 L-7.3 78.3
  L-5.6 75.5 L-4.8 73.0 L-4.2 68.0 L-3.3 64.9 L-2.9 61.8 L-1.5 58.9 L-0.1 56.5 L4.8 52.2
  L6.9 51.2 L10.7 50.2 L17.6 45.9 L25.9 42.4 L29.7 39.5 L31.9 37.5 L33.2 35.1 L35.0 29.9
  L35.3 28.6 L35.3 23.0 L34.3 18.8 L34.2 15.1 L35.7 10.6 L36.5 8.4 L38.8 4.2 L41.7 1.8
  L45.8 0.3 L50.6 -0.1 L58.4 1.1 L62.7 4.0 L65.4 5.0 L66.9 5.9 L69.2 8.1 L71.0 11.0
  L71.9 14.5 L71.7 16.1 L71.1 17.4 L69.2 19.6 L68.8 22.5 L67.7 25.5 L68.8 29.8 L68.6 30.8
  L67.1 33.5 L66.7 36.1 L66.2 37.3 L64.9 39.3 L63.7 42.0 L61.3 44.6 L61.0 45.8 L61.4 46.7
  L62.3 47.5 L65.3 49.1 L66.6 51.7 L67.4 52.7 L69.3 53.7 L71.9 55.6 L75.0 56.2 L77.1 57.4
  L79.4 59.6 L81.2 61.9 L83.9 69.3 L83.9 72.0 L83.7 73.6 L81.7 76.8 L81.6 78.2 L83.7 83.4
  L86.8 93.0 L88.0 95.4 L89.4 100.2 L90.2 101.7 L93.4 104.8 L96.7 110.6 L98.4 114.9 L99.7 121.3
  L101.0 124.6 L101.4 127.2 L102.3 129.2 L103.4 130.2 L105.7 130.8 L107.4 131.5 L108.9 132.9 L109.6 134.0
  L110.8 137.8 L112.1 140.4 L113.5 146.8 L114.3 148.1 L116.0 150.1 L117.0 152.1 L121.0 163.7 L121.4 169.2
  L120.7 172.0 L119.2 174.3 L117.9 175.8 L114.2 178.0 L112.2 178.5 L108.3 179.0 L104.3 178.8 L101.2 177.7
  L99.3 176.4 L97.8 174.8 L96.4 171.7 L96.2 167.5 L97.3 163.3 L98.7 160.0 L99.4 155.8 L99.4 153.3
  L99.2 152.1 L96.3 146.8 L95.0 142.6 L93.8 139.8 L93.3 136.9 L92.8 135.8 L84.9 125.5 L84.2 124.4
  L82.7 119.7 L80.4 114.7 L78.5 106.5 L75.7 102.7 L74.3 101.4 L73.4 101.4 L72.7 101.8 L72.1 102.8
  L72.0 103.7 L72.3 108.5 L73.9 111.9 L75.1 115.9 L76.9 119.3 L77.8 125.9 L78.9 128.4 L81.6 132.4
  L83.9 139.7 L84.2 142.6 L85.3 145.8 L85.6 148.8 L86.4 151.6 L86.9 156.2 L88.1 160.3 L89.4 169.6
  L90.6 173.8 L90.8 178.4 L93.2 188.7 L93.4 192.2 L94.3 195.0 L94.1 196.8 L91.2 200.2 L90.8 202.2
  L91.9 205.3 L93.0 210.8 L92.9 212.6 L92.1 215.9 L92.1 221.2 L92.6 223.2 L94.6 228.1 L95.8 232.8
  L96.0 236.9 L97.2 244.3 L97.4 268.1 L97.9 269.1 L98.6 269.8 L100.9 270.9 L101.7 271.7 L102.9 275.4
  L105.7 278.3 L106.0 280.2 L105.6 281.4 L105.6 282.8 L106.5 284.7 L107.6 285.8 L111.0 288.2 L112.6 289.9
  L113.5 291.1 L113.6 292.7 L112.9 294.3 Z
  M84.0 295.1 L84.0 294.2 L83.3 292.9 L83.2 291.6 L84.3 288.4 L84.5 286.1 L84.2 270.3 L81.1 258.5
  L79.0 254.2 L75.2 248.9 L72.5 241.3 L72.1 230.8 L73.2 225.0 L73.2 223.4 L72.5 220.9 L72.2 217.7
  L71.3 215.0 L71.0 212.7 L69.9 209.9 L69.2 206.2 L68.6 205.0 L67.4 204.3 L62.1 205.1 L59.4 205.1
  L58.0 204.6 L57.0 203.6 L56.4 202.2 L55.1 195.7 L54.2 194.5 L53.1 194.2 L52.3 194.6 L51.7 195.6
  L51.0 198.8 L50.9 202.5 L50.4 203.7 L49.4 204.7 L47.3 205.4 L43.8 204.9 L35.2 204.7 L34.0 205.0
  L32.7 205.9 L31.9 207.4 L29.2 213.9 L23.1 223.5 L21.8 226.1 L20.6 229.6 L20.3 236.8 L18.5 247.0
  L16.3 252.0 L11.7 258.0 L10.7 260.1 L7.7 268.2 L6.6 272.9 L7.4 277.8 L6.2 281.9 L6.0 285.1
  L4.6 292.1 L4.3 293.1 L3.7 294.2 L3.6 295.0 L3.9 295.1 Z`;

/* Boxing — Ready. Facing front, gloves up and ready to work. */
const BOX_READY_TRACE = `M109.6 299.9 L96.5 299.9 L96.5 294.2 L94.5 293.1 L93.6 292.1 L93.1 290.9 L92.5 287.6 L91.7 286.3
  L90.2 284.6 L89.6 283.4 L89.5 281.2 L90.3 275.4 L89.3 271.1 L89.2 262.6 L85.8 252.0 L84.8 245.7
  L84.0 242.9 L82.3 239.0 L80.0 235.2 L78.3 230.7 L76.7 217.2 L76.0 214.5 L75.3 212.9 L71.3 206.4
  L68.0 198.0 L67.3 196.9 L65.6 196.2 L57.5 196.4 L55.7 195.8 L54.5 194.8 L53.5 192.0 L49.4 173.0
  L48.1 170.0 L47.4 169.3 L46.4 168.8 L45.6 168.9 L44.7 169.8 L42.8 175.7 L41.1 184.9 L40.2 194.3
  L39.6 196.4 L39.0 197.2 L37.9 198.1 L36.3 198.5 L26.6 198.6 L23.4 198.7 L22.3 199.0 L20.9 200.2
  L19.6 203.3 L17.3 207.6 L16.9 209.0 L17.1 221.3 L16.7 222.9 L13.9 229.3 L13.5 234.4 L12.4 240.1
  L12.5 246.3 L14.2 252.7 L14.1 254.3 L13.5 256.3 L12.6 257.5 L10.3 259.9 L4.7 263.7 L2.9 267.2
  L2.8 270.0 L2.4 271.3 L1.3 273.0 L-0.9 275.0 L-5.4 277.0 L-7.5 277.4 L-10.1 277.4 L-12.4 276.4
  L-13.6 275.1 L-14.2 273.8 L-14.2 272.2 L-13.6 268.7 L-12.6 266.1 L-3.3 253.2 L-1.6 250.1 L-1.0 248.6
  L-0.7 241.3 L-1.1 238.8 L-2.2 235.0 L-2.2 232.1 L-1.3 228.8 L-1.3 227.7 L-2.3 223.3 L-2.6 215.3
  L-2.3 212.1 L-1.0 208.3 L-0.7 202.8 L0.8 196.6 L0.4 195.4 L-2.1 192.4 L-2.4 191.6 L-2.4 190.1
  L-1.0 183.9 L-0.1 181.4 L0.5 178.4 L1.3 175.9 L1.7 173.2 L2.6 170.3 L3.5 164.4 L4.6 161.5
  L4.9 158.9 L5.9 154.6 L8.1 142.6 L8.2 137.9 L9.1 132.9 L10.7 128.2 L12.0 125.1 L15.2 121.1
  L15.9 119.6 L16.6 115.4 L16.4 111.3 L18.0 106.9 L17.9 103.6 L17.4 102.3 L16.3 101.4 L15.0 101.6
  L11.2 103.7 L2.5 107.2 L0.6 106.9 L-1.0 105.9 L-3.3 103.4 L-4.2 101.6 L-5.6 94.7 L-5.4 82.9
  L-4.3 78.0 L-2.4 73.6 L-1.8 71.1 L-2.0 64.5 L-1.9 60.3 L-1.0 56.7 L0.5 53.2 L2.0 50.8
  L3.9 48.9 L11.1 45.7 L14.7 43.4 L18.8 41.3 L25.2 39.0 L28.0 36.6 L28.7 35.0 L29.0 32.3
  L26.4 26.1 L26.2 23.6 L27.4 18.5 L27.8 12.1 L28.0 10.8 L29.9 6.8 L30.9 5.4 L33.1 3.2
  L36.0 1.3 L38.7 0.3 L40.8 -0.1 L43.3 0.1 L47.3 0.6 L50.1 1.7 L53.1 3.6 L56.5 6.9
  L58.7 10.6 L59.3 13.1 L59.4 21.2 L58.5 24.6 L57.2 27.6 L56.7 32.4 L55.3 35.8 L55.4 36.8
  L56.0 37.7 L57.5 38.5 L62.9 40.3 L71.1 42.0 L72.5 42.6 L77.6 47.7 L80.4 53.0 L81.4 53.7
  L82.6 53.5 L85.7 50.1 L87.9 49.0 L92.2 48.4 L96.8 46.6 L99.0 46.8 L102.7 47.9 L106.5 50.2
  L110.0 54.1 L112.1 57.4 L114.0 63.4 L114.0 67.2 L112.1 72.0 L107.0 77.0 L104.7 81.6 L100.6 85.7
  L98.2 89.6 L94.2 93.8 L92.0 94.5 L90.3 94.5 L87.1 93.8 L84.8 92.5 L79.9 87.4 L76.9 83.1
  L74.5 78.9 L73.7 78.1 L73.0 77.8 L71.9 77.9 L70.9 79.3 L69.9 86.2 L68.7 91.7 L68.8 104.4
  L70.4 107.8 L70.9 112.7 L72.1 117.1 L72.7 118.1 L76.3 121.7 L77.1 123.4 L78.6 127.6 L78.9 129.7
  L80.0 133.1 L80.3 136.5 L81.3 140.4 L82.4 147.9 L84.5 157.3 L85.8 167.4 L89.1 180.7 L89.3 185.3
  L88.8 186.6 L87.4 188.5 L87.3 189.8 L90.5 203.0 L93.1 209.0 L95.2 212.9 L97.5 220.8 L98.5 227.0
  L99.2 240.4 L99.6 242.0 L101.0 245.0 L101.7 248.3 L101.8 260.6 L102.9 268.2 L104.6 273.9 L106.4 277.2
  L110.0 282.4 L112.0 286.8 L112.1 288.3 L111.9 291.1 L111.0 293.0 L109.7 294.3 Z`;

/* Football — Dribble. Pixabay 10341010: coming straight at you, the ball taken
   out; the drawn fold lines are closed and the hands kept as drawn. */
const FOOT_DRIBBLE_TRACE = `M90.7 299.9 L81.2 299.9 L81.1 294.3 L80.8 293.8 L79.6 293.3 L73.6 293.3 L72.2 292.8 L70.0 290.8
  L65.4 283.1 L64.6 282.5 L62.8 282.4 L62.1 282.2 L61.1 280.9 L60.6 280.6 L59.5 280.9 L58.2 283.9
  L56.5 285.8 L56.1 288.4 L55.4 289.4 L54.6 289.8 L53.8 289.8 L52.6 288.8 L51.3 288.4 L50.6 288.8
  L49.3 290.2 L48.3 290.6 L46.8 290.1 L45.6 287.8 L42.8 285.9 L41.0 284.1 L39.9 282.6 L39.0 280.9
  L38.4 278.6 L38.2 276.0 L38.4 273.0 L39.9 263.8 L39.5 259.5 L37.4 252.5 L29.7 234.4 L27.8 228.0
  L26.6 222.0 L26.1 217.2 L26.1 214.8 L26.7 211.4 L27.9 209.0 L28.2 207.7 L28.6 203.5 L27.6 201.7
  L23.8 196.8 L20.3 191.4 L16.5 183.8 L15.4 180.4 L14.6 176.7 L14.4 172.3 L15.1 168.1 L13.9 164.9
  L14.0 161.8 L11.7 157.4 L11.1 155.7 L11.3 153.7 L13.8 147.8 L13.5 146.4 L11.8 142.6 L11.8 140.8
  L13.5 137.4 L17.0 133.1 L17.0 132.2 L15.4 130.1 L14.6 127.8 L14.6 124.8 L17.4 115.2 L17.5 112.2
  L14.6 92.2 L14.1 90.7 L13.5 90.3 L12.8 90.3 L9.2 91.7 L7.0 94.7 L3.6 96.2 L2.7 98.6
  L0.5 101.3 L-1.4 104.8 L-2.5 105.4 L-4.4 105.4 L-5.0 105.8 L-7.6 111.6 L-9.8 115.1 L-17.2 124.9
  L-20.9 130.4 L-22.8 134.1 L-24.2 138.4 L-24.2 141.4 L-23.0 147.9 L-23.1 150.1 L-23.7 152.2 L-24.5 153.7
  L-27.3 157.0 L-27.9 158.2 L-28.7 161.6 L-29.6 162.9 L-29.6 163.7 L-29.0 165.3 L-29.0 166.4 L-29.8 167.8
  L-30.8 168.2 L-32.7 168.1 L-36.0 166.7 L-37.7 165.5 L-38.6 163.2 L-40.3 161.4 L-41.3 159.4 L-43.4 153.3
  L-44.6 148.6 L-44.4 147.2 L-43.7 145.6 L-38.5 140.2 L-37.4 138.6 L-36.9 135.6 L-34.2 128.9 L-29.4 110.8
  L-27.7 105.3 L-26.2 101.5 L-23.8 96.6 L-20.6 91.7 L-20.7 88.6 L-19.5 86.5 L-12.0 78.4 L-11.0 77.8
  L-9.3 77.5 L-8.4 77.0 L-7.0 74.5 L-2.8 70.8 L-2.0 69.6 L-0.6 66.5 L2.1 62.9 L6.8 58.0
  L8.5 56.6 L11.0 54.8 L12.8 53.8 L19.6 52.3 L24.8 49.4 L29.4 48.0 L30.3 47.4 L32.5 44.5
  L33.6 43.4 L35.2 42.4 L35.7 41.7 L35.9 40.6 L35.4 37.6 L33.1 35.6 L32.5 34.7 L31.8 33.2
  L30.6 29.2 L30.5 25.9 L31.2 24.5 L32.2 23.4 L32.2 22.1 L30.4 17.1 L30.0 15.1 L29.3 14.5
  L27.9 14.2 L27.5 13.6 L30.1 11.0 L33.7 5.6 L35.9 3.4 L38.3 2.1 L45.4 0.2 L47.9 -0.1
  L49.9 0.1 L52.2 0.5 L54.3 1.2 L56.9 2.9 L59.3 5.7 L61.7 6.0 L63.6 7.0 L64.7 8.4
  L65.3 9.6 L66.2 13.9 L66.2 17.0 L65.0 22.7 L65.0 23.6 L66.5 25.9 L66.7 26.7 L66.7 28.7
  L66.2 31.5 L65.1 34.5 L64.0 36.1 L62.6 37.1 L62.1 37.9 L62.0 40.6 L62.4 41.7 L64.5 43.0
  L66.6 45.0 L69.2 48.6 L69.9 49.0 L76.4 50.6 L83.3 52.9 L86.3 54.4 L90.1 57.0 L93.5 59.9
  L96.6 63.0 L104.4 71.6 L108.3 75.5 L116.3 81.9 L118.1 84.2 L118.9 86.0 L122.3 87.4 L127.2 92.0
  L128.2 93.7 L128.6 95.2 L128.2 97.5 L128.4 98.2 L130.7 103.0 L132.6 109.0 L134.0 115.2 L134.7 120.9
  L135.5 123.7 L137.2 126.0 L141.7 131.1 L143.6 133.9 L144.5 136.2 L143.8 138.8 L142.4 141.7 L141.1 143.7
  L139.7 145.0 L135.9 146.5 L132.5 147.1 L130.4 146.8 L128.9 145.8 L127.1 144.1 L126.7 141.8 L126.3 141.1
  L122.2 136.6 L121.0 134.8 L120.7 133.9 L120.9 132.4 L122.7 126.4 L122.3 124.1 L120.7 120.6 L115.9 114.1
  L114.0 111.2 L113.2 110.4 L110.8 109.9 L109.8 109.3 L108.8 108.2 L107.6 105.3 L105.9 103.2 L105.1 100.3
  L100.2 98.2 L97.5 94.7 L92.3 92.6 L86.5 88.0 L84.4 86.8 L83.2 86.4 L82.3 86.4 L81.5 87.5
  L79.1 104.1 L78.9 112.8 L77.6 118.5 L78.0 120.4 L79.6 123.7 L79.9 126.1 L79.3 127.6 L77.8 129.3
  L77.5 130.2 L78.4 131.4 L82.0 133.8 L83.6 136.1 L84.1 138.1 L84.1 144.8 L84.8 147.8 L85.8 150.8
  L89.8 160.3 L91.8 165.8 L94.6 175.7 L95.6 181.8 L95.5 183.4 L93.9 185.5 L94.9 192.2 L95.1 198.8
  L94.6 206.9 L93.1 213.8 L93.7 220.3 L92.5 225.5 L93.4 228.5 L93.2 231.4 L92.0 235.9 L88.3 243.9
  L85.6 252.8 L82.4 261.3 L81.4 264.6 L82.0 269.9 L81.1 272.8 L81.1 274.0 L82.5 277.3 L84.3 280.4
  L85.9 282.5 L87.2 283.3 L89.8 284.1 L91.5 285.0 L92.8 286.5 L93.8 288.5 L94.1 290.3 L93.6 291.6
  L92.8 292.4 L91.5 293.1 L90.8 294.1 Z
  M61.1 262.3 L62.3 261.1 L64.0 258.3 L64.7 255.8 L65.1 253.0 L65.1 248.4 L64.9 246.6 L63.0 239.5
  L62.2 235.2 L62.2 233.8 L63.1 228.5 L63.1 225.7 L63.9 223.4 L67.0 218.8 L67.5 217.0 L66.5 211.3
  L65.5 207.3 L64.1 203.0 L62.6 199.4 L60.2 194.8 L57.6 193.5 L56.9 192.3 L55.8 188.9 L55.6 188.5
  L54.7 188.2 L53.8 188.9 L53.3 190.8 L53.4 192.5 L54.5 197.9 L54.5 202.3 L53.6 206.8 L55.2 210.9
  L56.3 215.4 L56.9 219.0 L56.0 221.4 L56.2 228.0 L54.5 234.4 L54.5 238.0 L57.5 252.8 L59.6 261.3
  L60.1 262.0 Z`;

/* Gown — Ball gown. Full skirt, bare shoulders, hair over one side. */
const GOWN_BALL_TRACE = `M192.3 299.9 L-92.4 299.9 L-92.5 294.4 L-93.0 291.8 L-92.7 287.9 L-92.1 285.8 L-90.8 283.2 L-89.6 281.3
  L-88.3 280.0 L-86.7 279.2 L-84.1 279.0 L-77.0 281.0 L-74.4 281.4 L-71.4 281.4 L-67.6 280.7 L-63.9 279.0
  L-60.7 276.8 L-57.7 273.7 L-54.6 269.7 L-50.8 263.0 L-46.2 254.1 L-32.0 221.6 L-18.8 194.8 L-4.6 168.9
  L7.5 149.2 L8.2 146.7 L8.5 142.5 L8.9 140.8 L13.2 133.7 L16.1 126.6 L17.9 119.6 L18.2 116.5
  L19.2 113.2 L20.9 103.1 L23.8 95.9 L24.4 91.7 L24.8 86.3 L24.8 83.8 L24.4 82.2 L24.7 78.9
  L23.9 78.0 L22.0 77.2 L21.3 76.5 L20.2 74.6 L18.0 71.9 L17.3 70.3 L17.3 69.2 L17.8 68.1
  L22.2 63.8 L22.8 62.7 L22.8 62.1 L22.1 61.0 L19.6 59.2 L17.4 56.3 L16.6 54.8 L16.3 53.3
  L16.8 51.9 L17.6 50.9 L21.5 48.6 L23.4 46.4 L23.5 44.9 L22.4 42.2 L22.1 40.8 L22.3 39.1
  L23.1 37.3 L26.7 33.7 L27.5 32.4 L27.5 30.9 L26.6 27.8 L26.7 25.5 L27.3 24.0 L28.6 22.8
  L32.7 20.0 L34.0 18.7 L35.4 15.6 L36.1 9.7 L37.3 6.2 L40.6 2.4 L43.6 0.6 L45.9 -0.1
  L58.3 0.2 L59.7 1.1 L62.0 3.5 L65.4 4.7 L67.5 5.9 L69.6 8.0 L70.4 9.7 L70.4 15.8
  L66.5 24.1 L66.4 25.8 L66.8 27.8 L66.8 29.3 L66.1 31.0 L62.8 36.0 L61.3 37.5 L60.3 37.9
  L59.3 37.9 L56.5 36.8 L55.4 36.8 L54.8 37.0 L54.0 38.4 L53.4 43.5 L53.9 45.1 L55.6 46.8
  L57.6 47.5 L63.0 47.7 L65.0 48.2 L67.4 49.9 L68.4 51.8 L68.7 58.6 L67.8 65.3 L67.9 67.2
  L68.7 68.3 L73.6 73.6 L74.4 75.1 L74.9 77.0 L74.9 79.7 L74.3 82.6 L73.5 84.7 L69.9 91.9
  L69.4 93.1 L69.4 94.2 L73.6 106.1 L75.3 113.6 L79.5 126.1 L90.2 143.2 L98.0 156.8 L107.0 174.5
  L111.3 184.2 L127.0 216.1 L133.6 228.3 L140.1 238.8 L154.3 258.2 L165.7 270.8 L168.3 273.0 L169.7 273.8
  L172.1 274.4 L174.8 274.7 L177.2 275.6 L178.8 276.9 L182.3 281.4 L183.8 282.8 L185.9 284.0 L189.2 285.2
  L191.3 286.8 L192.2 288.4 L192.9 290.7 L192.9 292.9 L192.4 294.3 Z`;

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
const GOWN_TRAIN_TRACE = `M75.1 299.9 L23.5 299.9 L23.3 299.8 L23.2 294.2 L16.0 294.2 L9.8 292.9 L6.1 292.8 L2.5 291.9
  L-0.0 291.7 L-2.9 290.7 L-6.2 290.3 L-8.9 289.4 L-11.1 289.1 L-16.3 287.2 L-19.3 285.6 L-20.5 284.0
  L-20.7 283.0 L-20.1 280.3 L-18.2 275.3 L-17.8 272.5 L-16.7 269.8 L-16.3 267.1 L-15.4 264.5 L-15.0 261.5
  L-13.3 255.6 L-12.9 251.0 L-11.8 247.3 L-11.5 243.0 L-10.2 237.0 L-8.1 213.6 L-8.4 194.6 L-9.0 190.6
  L-9.2 181.9 L-10.2 176.7 L-10.3 172.3 L-11.5 167.3 L-11.7 164.0 L-13.0 159.0 L-13.9 152.3 L-15.1 148.2
  L-15.4 145.5 L-16.6 140.7 L-16.7 127.8 L-17.1 127.2 L-17.5 127.0 L-18.5 127.7 L-21.6 133.4 L-22.3 135.3
  L-22.4 136.6 L-21.5 142.2 L-21.8 151.2 L-22.1 154.1 L-21.5 155.6 L-21.4 156.8 L-21.9 158.6 L-22.3 159.0
  L-22.9 159.4 L-25.5 158.8 L-26.4 158.4 L-27.2 157.2 L-27.8 156.0 L-28.9 151.7 L-29.0 146.2 L-25.3 129.5
  L-22.6 121.0 L-19.2 112.3 L-17.8 107.5 L-15.5 102.3 L-11.9 90.2 L-10.7 79.0 L-9.5 74.5 L-9.6 70.5
  L-8.7 66.7 L-9.1 58.8 L-8.0 53.5 L-7.2 52.3 L-4.6 50.1 L-2.5 49.6 L6.1 48.4 L8.6 47.4
  L11.6 44.7 L12.3 43.3 L12.3 39.1 L12.1 37.5 L11.6 36.6 L10.3 35.8 L5.4 35.8 L4.4 35.3
  L3.7 34.5 L2.0 30.9 L1.3 28.4 L0.3 26.6 L0.1 25.4 L0.9 22.9 L0.9 19.7 L0.0 16.1
  L0.6 10.7 L-0.2 8.6 L-0.2 7.3 L0.2 6.1 L1.8 4.5 L5.0 3.5 L8.7 1.4 L12.9 0.1
  L19.2 -0.1 L20.4 0.2 L23.8 1.7 L27.8 5.2 L30.3 9.5 L31.2 10.5 L34.3 11.8 L36.1 13.7
  L36.6 15.1 L36.7 18.1 L35.9 20.7 L35.8 23.8 L35.2 25.5 L32.7 28.1 L31.4 29.2 L27.9 30.4
  L25.2 30.6 L24.2 31.6 L24.0 34.5 L24.3 36.4 L25.8 41.1 L27.9 44.5 L30.7 47.1 L34.7 49.5
  L38.4 50.6 L40.8 51.5 L41.9 52.3 L44.8 55.5 L46.5 58.4 L53.1 71.2 L60.2 81.4 L63.5 87.0
  L66.5 94.1 L66.3 96.0 L65.4 97.5 L63.8 98.8 L59.2 101.7 L50.1 106.0 L45.9 108.2 L42.4 109.3
  L40.2 110.5 L37.4 111.4 L31.6 114.0 L28.3 114.8 L27.2 115.5 L26.8 116.5 L26.8 118.4 L28.1 123.2
  L28.1 134.4 L26.9 138.6 L26.6 141.8 L25.7 144.5 L25.0 147.8 L23.4 152.4 L22.8 156.7 L21.9 159.2
  L21.7 163.0 L20.6 169.1 L20.6 175.4 L21.8 183.1 L21.8 185.4 L22.9 189.1 L23.3 192.3 L24.4 195.0
  L24.8 197.1 L26.9 203.4 L27.9 205.5 L30.8 213.3 L37.7 226.8 L44.7 237.8 L51.0 246.3 L54.6 250.1
  L66.2 261.8 L73.6 267.4 L78.3 270.4 L81.9 272.2 L85.9 273.7 L86.5 273.7 L86.7 273.4 L86.3 272.9
  L81.8 269.8 L81.8 269.1 L82.7 268.7 L87.7 269.4 L94.7 269.4 L99.4 270.5 L104.6 270.9 L108.3 271.8
  L111.0 272.1 L113.7 273.0 L115.9 273.1 L118.8 274.2 L121.0 274.6 L125.4 276.5 L128.0 278.6 L128.9 280.2
  L128.8 281.3 L128.1 282.3 L125.4 284.8 L119.9 287.2 L116.5 288.1 L114.8 289.0 L112.0 289.4 L107.9 290.6
  L84.7 294.0 L75.2 294.2 Z
  M28.2 108.1 L30.7 107.4 L40.3 102.5 L44.2 100.1 L49.4 96.3 L51.0 94.6 L52.1 92.9 L52.3 91.7
  L52.2 90.4 L51.1 87.4 L43.4 76.6 L41.6 74.8 L39.8 73.9 L38.0 73.7 L36.4 74.1 L35.2 74.8
  L33.0 77.1 L25.8 88.9 L22.2 95.7 L21.2 99.3 L21.3 101.1 L22.7 103.7 L24.3 105.9 L26.1 107.6
  L27.3 108.1 Z`;

/* Gown — Evening. Slim column gown, hands clasped. The quiet one. */
const GOWN_EVENING_TRACE = `M101.4 299.9 L7.6 299.9 L7.5 299.8 L7.4 294.2 L4.4 293.4 L-0.7 290.9 L-3.7 290.0 L-13.4 290.1
  L-17.9 289.2 L-23.0 287.0 L-26.1 284.7 L-27.0 283.3 L-26.9 281.4 L-24.1 276.2 L-23.2 272.9 L-23.0 268.6
  L-21.9 263.8 L-20.9 254.1 L-18.8 242.4 L-18.5 237.8 L-17.6 233.5 L-16.6 222.5 L-15.6 218.5 L-15.2 212.2
  L-14.3 208.4 L-14.2 204.8 L-13.4 200.4 L-13.1 195.1 L-12.1 190.0 L-12.0 186.7 L-11.0 182.0 L-10.9 177.0
  L-8.9 164.8 L-8.8 159.0 L-6.8 146.4 L-6.7 141.4 L-5.6 136.3 L-5.5 133.7 L-4.6 129.7 L-4.4 125.9
  L-3.4 122.5 L-2.0 114.7 L-1.3 112.3 L-1.3 111.2 L-1.7 110.4 L-4.5 108.4 L-5.7 107.0 L-6.4 105.5
  L-7.2 101.8 L-10.5 98.3 L-11.1 96.2 L-11.1 93.1 L-10.5 90.3 L-7.0 79.1 L-6.6 75.9 L-4.4 67.9
  L-3.4 60.5 L-1.5 53.6 L-1.0 52.5 L1.1 50.2 L3.4 48.6 L6.7 47.8 L9.5 48.2 L14.8 45.8
  L16.4 44.6 L17.6 42.5 L17.9 41.1 L17.9 36.1 L17.6 34.9 L16.6 34.0 L13.4 33.7 L11.8 32.5
  L10.9 30.5 L10.1 27.2 L9.5 23.0 L9.5 21.1 L10.0 18.2 L10.0 13.5 L11.4 6.4 L12.3 4.9
  L13.5 3.6 L15.9 1.9 L17.1 1.4 L24.0 -0.1 L30.4 0.7 L32.4 1.3 L35.3 3.0 L37.5 5.0
  L38.6 6.5 L39.8 8.7 L40.9 12.9 L41.1 15.5 L40.2 20.2 L40.2 21.8 L42.3 26.8 L42.2 29.8
  L41.3 32.1 L39.2 34.7 L37.8 35.6 L36.1 36.2 L32.0 36.8 L31.4 37.6 L31.4 38.5 L31.9 39.8
  L33.3 41.8 L37.1 45.5 L38.2 45.9 L43.2 45.6 L46.3 46.5 L48.2 47.6 L50.1 49.8 L51.0 51.5
  L52.7 57.9 L53.1 60.3 L53.6 70.1 L54.5 74.9 L54.7 79.2 L55.5 82.4 L55.7 88.5 L56.2 91.1
  L56.2 95.1 L55.2 99.3 L54.0 100.7 L52.7 101.3 L43.6 101.2 L36.9 99.9 L35.8 100.6 L35.7 101.7
  L38.8 106.8 L41.0 111.6 L42.8 114.7 L44.6 119.8 L45.5 123.9 L46.5 126.4 L50.8 148.6 L51.2 153.0
  L53.1 161.1 L53.3 163.5 L54.5 168.2 L55.4 174.9 L56.7 179.6 L59.9 197.0 L64.1 213.8 L65.1 216.1
  L65.7 219.2 L67.3 223.2 L68.2 226.8 L69.4 229.7 L70.2 232.6 L74.3 243.1 L80.8 256.3 L85.1 263.1
  L89.5 268.8 L91.9 271.2 L96.2 275.2 L104.4 280.1 L112.8 283.0 L125.0 286.2 L126.4 287.1 L126.9 288.1
  L126.9 289.4 L126.3 290.4 L124.9 291.3 L123.9 291.5 L116.3 292.7 L107.5 292.7 L101.5 294.2 Z
  M43.7 295.1 L43.6 294.2 L36.1 293.5 L26.5 293.7 L23.2 294.3 L23.4 295.1 Z`;

/* Graduate - both arms thrown up, diploma in one hand, mortarboard and tassel.
   The tassel cord is TWO source pixels at its thinnest, about 0.8 mm on a 28 cm
   piece, so no opening radius can keep it and keep the rest clean: it has to be
   made thicker, not merely preserved. Traced at --radius 1.2 --min-width 5,
   which brings the cord to ~1.3 mm over its 14 mm and leaves the board's edges
   crisp; at 6 and above the board corners start growing nubs. */
const GRAD_TRACE = `M63.7 299.9 L52.3 299.9 L52.2 294.3 L51.3 293.0 L50.9 291.6 L51.0 287.1 L49.6 280.3 L50.0 275.5
  L50.0 271.7 L49.2 269.4 L46.1 265.6 L45.5 264.4 L45.0 262.4 L45.2 258.6 L46.8 252.6 L47.3 249.5
  L47.3 247.6 L46.8 245.5 L43.5 240.6 L42.8 239.0 L41.3 232.7 L38.4 225.2 L36.5 217.3 L34.8 211.9
  L34.1 210.3 L33.1 209.2 L31.8 208.4 L25.3 206.6 L23.7 205.9 L22.0 204.8 L19.2 202.1 L17.0 196.6
  L17.4 191.3 L19.2 183.8 L27.2 159.8 L29.4 149.8 L29.4 145.6 L28.6 141.3 L28.6 132.6 L26.2 120.5
  L25.6 113.3 L25.7 102.9 L27.6 90.9 L27.6 89.6 L25.7 86.9 L25.1 86.5 L17.3 82.7 L14.6 80.0
  L8.8 72.7 L-0.1 68.4 L-1.5 67.0 L-2.4 64.6 L-2.4 62.2 L-1.0 58.0 L-1.4 57.2 L-2.2 56.3
  L-2.4 55.3 L0.8 49.0 L1.1 48.0 L0.8 46.9 L-4.5 32.2 L-7.5 26.3 L-9.7 24.1 L-11.3 22.9
  L-12.2 23.2 L-13.1 24.2 L-13.5 25.5 L-13.9 26.1 L-15.0 26.3 L-15.5 25.6 L-15.9 24.0 L-17.5 21.9
  L-17.2 21.2 L-13.5 16.3 L-12.5 14.4 L-8.3 10.1 L-6.4 7.8 L-1.9 2.4 L-1.2 0.4 L-0.6 -0.0
  L0.2 0.2 L0.9 1.7 L2.9 3.8 L3.2 4.4 L2.8 5.2 L-3.6 13.2 L-3.3 13.9 L-2.5 14.8
  L-2.1 15.6 L-2.4 21.7 L4.8 35.4 L10.0 41.2 L14.3 44.4 L16.5 50.6 L17.0 51.5 L17.8 52.0
  L20.9 52.9 L22.8 54.8 L23.5 55.9 L23.9 58.5 L24.4 59.5 L25.3 59.9 L27.3 59.9 L28.1 60.2
  L30.8 61.8 L32.8 63.7 L35.4 63.9 L37.2 64.6 L38.9 64.6 L41.1 66.2 L43.5 66.4 L46.2 67.7
  L47.1 67.6 L49.1 66.0 L50.2 65.5 L50.8 64.9 L51.2 64.1 L51.2 58.6 L49.8 56.9 L48.9 54.1
  L49.3 52.4 L50.1 50.9 L49.9 48.7 L50.3 45.5 L51.4 42.9 L50.8 42.1 L46.4 39.5 L45.0 38.9
  L43.8 38.8 L43.2 37.9 L43.9 37.2 L45.3 36.8 L47.5 34.9 L57.9 25.2 L59.3 24.8 L60.8 25.5
  L83.0 38.6 L84.3 39.2 L85.8 39.4 L86.3 40.3 L85.8 41.3 L83.9 42.0 L79.9 45.5 L79.2 46.4
  L79.9 48.2 L80.6 51.6 L80.5 52.7 L79.6 54.7 L79.9 57.3 L79.9 59.8 L79.6 60.6 L78.0 60.9
  L77.5 60.7 L77.0 60.1 L77.7 55.3 L77.1 53.1 L77.3 49.7 L77.2 48.8 L76.8 48.5 L76.1 48.8
  L73.1 51.4 L72.5 53.1 L71.1 56.1 L71.0 57.9 L70.3 60.0 L69.3 61.1 L67.1 62.3 L66.4 62.9
  L64.4 67.1 L64.4 68.1 L64.7 68.9 L67.0 71.1 L67.8 71.4 L71.7 69.2 L73.8 69.2 L75.8 68.3
  L78.0 69.2 L80.2 69.0 L81.2 68.4 L83.3 65.9 L85.8 65.2 L87.6 62.4 L89.0 61.2 L89.7 60.9
  L93.1 61.0 L93.6 60.5 L96.4 54.8 L101.1 50.6 L102.7 48.5 L104.7 45.3 L108.6 36.0 L109.0 34.3
  L109.0 33.4 L106.8 29.8 L106.4 28.7 L106.5 21.9 L106.1 20.3 L106.2 19.4 L107.1 19.2 L108.2 19.7
  L108.8 19.7 L110.1 18.4 L110.8 18.4 L112.2 19.5 L114.5 20.5 L115.7 21.7 L116.9 22.2 L117.4 22.9
  L117.1 30.6 L114.1 37.3 L112.2 47.7 L110.2 54.0 L110.5 55.7 L113.4 63.1 L114.1 68.1 L113.9 69.6
  L107.0 75.9 L99.2 80.9 L96.3 88.5 L93.7 91.7 L91.5 92.8 L86.8 93.7 L82.6 95.3 L79.1 98.5
  L78.3 100.4 L78.7 108.8 L81.7 135.0 L86.7 163.4 L97.0 182.7 L109.1 194.3 L111.8 198.2 L112.6 200.6
  L112.3 201.3 L111.2 202.6 L110.4 202.8 L108.0 204.7 L104.9 206.0 L97.9 208.5 L94.0 209.4 L89.0 210.1
  L76.7 210.6 L73.8 211.0 L71.7 212.1 L70.8 213.1 L70.2 214.4 L69.0 217.9 L68.5 220.3 L69.1 228.5
  L67.5 241.2 L66.8 252.6 L65.3 259.6 L65.4 265.5 L64.5 268.6 L63.8 270.1 L61.5 273.4 L60.8 275.6
  L61.3 280.7 L61.9 283.4 L64.3 288.8 L64.9 291.0 L64.8 292.7 L63.8 294.3 Z`;

/* Basketball -- Point (Pixabay 3393880, below with the other new poses), Jump
   shot 3127330 and Layup 306924, every ball taken out. The Dribble and the Pass
   went on 2 Nov: a dribbling hand and an overhead pass hold nothing once the
   ball is gone. Most basketball art hides the hand behind the ball, so taking
   the ball out leaves a stump -- check the hand before adding a pose. These
   replace the owner's reference sheet, which was about 180 px a figure: the
   traces were lumpy and the jump shot's head, hands and ball were one blob. */
const BALL_JUMPSHOT_TRACE = `M62.0 299.9 L51.1 299.9 L51.0 294.2 L48.2 292.3 L46.9 291.0 L46.2 289.9 L45.3 287.5 L45.3 283.5
  L45.0 282.5 L42.0 277.9 L41.0 275.2 L41.0 272.2 L41.4 271.2 L42.8 269.4 L42.9 267.5 L43.2 266.5
  L44.2 265.4 L46.5 264.4 L47.2 263.1 L46.6 252.9 L45.6 244.1 L45.8 242.3 L44.8 235.5 L44.6 232.4
  L44.8 224.4 L46.6 212.7 L46.1 211.9 L44.0 210.7 L43.3 210.1 L42.8 208.5 L40.9 204.4 L40.4 202.8
  L40.1 193.6 L39.5 188.4 L36.9 177.5 L36.3 173.8 L36.2 169.3 L36.6 162.9 L34.7 160.7 L34.3 159.7
  L34.7 157.5 L36.0 143.7 L37.6 133.6 L37.9 127.2 L34.5 116.7 L29.2 106.2 L28.7 103.4 L28.8 97.0
  L26.4 92.8 L25.5 89.9 L25.4 83.3 L26.7 76.8 L25.7 71.2 L25.5 67.5 L27.3 57.7 L27.3 42.4
  L29.5 30.2 L29.7 21.1 L27.0 17.6 L24.6 13.2 L20.6 10.0 L20.0 8.6 L20.3 8.0 L21.2 7.8
  L25.9 11.1 L26.7 10.9 L26.7 10.3 L24.5 6.7 L22.8 2.9 L22.8 2.5 L23.6 1.7 L24.9 1.9
  L25.0 0.6 L26.0 -0.1 L26.8 0.3 L27.6 1.2 L29.4 1.0 L30.7 2.1 L33.3 6.0 L36.0 9.3
  L36.9 11.5 L37.6 15.3 L37.6 20.1 L36.7 25.5 L36.6 29.0 L36.9 36.0 L37.9 42.8 L38.1 50.1
  L37.3 55.5 L37.3 57.7 L37.9 61.5 L37.9 67.9 L38.1 68.3 L40.3 66.2 L40.4 65.3 L40.9 64.8
  L47.9 63.2 L45.5 60.5 L44.8 58.7 L44.3 56.5 L43.7 55.4 L41.7 52.7 L41.3 51.6 L41.9 50.5
  L43.1 50.4 L44.7 51.7 L46.1 54.1 L46.9 54.0 L47.1 52.9 L45.8 50.9 L44.5 49.8 L40.6 48.9
  L40.2 48.2 L40.5 46.9 L39.9 46.0 L40.0 45.6 L40.5 45.3 L41.6 45.2 L46.4 46.4 L47.4 46.9
  L50.2 49.3 L52.2 51.7 L53.5 58.9 L54.4 60.8 L59.8 65.9 L68.2 71.7 L72.9 75.7 L75.1 77.8
  L77.8 81.3 L79.0 83.8 L79.9 87.1 L79.7 89.5 L77.8 97.8 L76.1 101.8 L73.4 105.9 L71.4 108.3
  L71.1 109.1 L72.1 112.6 L72.9 117.3 L73.2 121.2 L73.6 145.4 L73.9 146.9 L75.6 151.1 L76.5 155.3
  L76.8 159.0 L77.2 160.7 L77.2 162.6 L79.0 172.1 L79.4 180.5 L78.7 185.3 L76.2 196.3 L75.6 202.5
  L73.4 216.1 L73.2 216.7 L72.0 217.5 L70.7 221.2 L70.3 223.4 L69.4 231.1 L66.9 240.7 L66.6 243.5
  L63.9 251.5 L61.5 260.8 L61.7 262.8 L63.2 263.4 L64.0 264.2 L64.3 264.9 L63.9 265.8 L64.0 266.1
  L65.4 266.3 L64.6 267.7 L64.6 268.1 L65.6 269.1 L65.6 269.8 L64.6 270.6 L63.3 270.5 L62.9 270.7
  L62.5 271.6 L62.5 273.8 L63.0 275.1 L63.0 276.5 L63.4 278.9 L64.4 280.2 L65.3 282.1 L65.5 283.8
  L66.9 286.9 L67.3 290.1 L66.9 291.5 L66.3 292.1 L65.8 292.3 L63.3 292.4 L62.1 294.2 Z
  M62.1 94.3 L64.5 93.9 L65.3 93.4 L66.8 89.9 L68.9 86.5 L68.6 86.0 L64.5 81.7 L59.3 74.7
  L58.4 74.0 L58.2 74.3 L58.2 76.8 L58.3 77.8 L59.4 79.6 L59.5 80.7 L59.0 82.0 L57.2 83.4
  L56.2 85.5 L55.7 87.9 L55.5 92.2 L55.9 92.7 L56.6 93.0 L59.1 93.2 L61.3 94.2 Z`;

const BALL_SHOOT_TRACE = `M37.8 299.9 L31.0 299.9 L30.9 294.3 L29.5 292.8 L29.0 291.9 L28.3 288.6 L27.9 284.7 L28.1 280.3
  L25.1 276.2 L23.5 273.2 L22.3 269.8 L22.5 269.1 L23.9 268.4 L24.3 267.8 L24.3 267.0 L24.1 266.6
  L16.9 261.4 L11.0 257.9 L-15.0 245.3 L-21.4 241.7 L-23.4 238.8 L-24.8 235.4 L-25.3 231.8 L-25.2 228.7
  L-25.5 228.2 L-28.0 227.0 L-29.4 224.9 L-29.4 224.0 L-28.6 222.3 L-27.3 220.8 L-26.4 220.2 L-26.2 219.7
  L-26.8 210.5 L-26.7 206.7 L-26.2 203.1 L-26.4 202.5 L-28.3 200.2 L-29.2 197.8 L-28.9 193.7 L-27.7 190.2
  L-27.8 186.8 L-28.5 184.2 L-27.4 182.0 L-26.9 180.2 L-26.0 173.7 L-25.5 173.2 L-22.7 172.2 L-20.8 171.0
  L-20.0 170.3 L-19.9 169.6 L-17.4 146.4 L-11.5 102.6 L-9.0 81.4 L-13.0 70.1 L-15.1 61.2 L-15.9 54.2
  L-15.9 48.2 L-15.0 42.2 L-13.3 36.1 L-11.8 32.4 L-9.7 28.3 L-4.8 20.5 L0.5 14.0 L0.5 13.3
  L-1.1 11.5 L-2.5 9.0 L-2.8 7.0 L-2.4 5.8 L-1.6 5.7 L3.2 6.6 L5.9 6.6 L9.5 6.1
  L14.4 4.1 L17.3 2.2 L20.0 -0.1 L20.6 0.4 L21.0 1.2 L21.2 2.6 L19.5 4.1 L11.5 13.1
  L8.0 23.4 L4.2 33.4 L0.9 40.4 L-1.8 44.5 L-1.8 45.3 L0.6 49.7 L1.9 53.2 L2.4 56.1
  L2.7 61.2 L3.1 61.9 L4.6 62.9 L6.4 64.7 L7.9 66.7 L10.1 70.3 L11.7 74.0 L12.2 74.2
  L14.0 74.1 L14.5 73.5 L14.5 68.4 L14.8 65.0 L16.0 56.9 L17.7 53.4 L20.0 50.4 L22.4 48.0
  L25.5 46.4 L28.1 45.5 L30.0 45.2 L33.3 45.4 L35.9 46.1 L38.5 47.3 L41.0 49.1 L43.7 52.1
  L45.7 55.6 L46.5 58.2 L46.8 60.4 L46.5 63.8 L44.8 67.6 L42.6 71.2 L39.5 75.1 L36.7 78.0
  L35.3 80.2 L34.5 82.7 L34.2 84.7 L34.4 88.5 L34.9 89.3 L39.3 89.4 L40.8 89.9 L42.1 90.6
  L43.4 91.9 L46.3 95.7 L49.9 101.1 L51.5 104.6 L52.5 108.0 L53.5 114.7 L53.9 124.4 L56.0 126.8
  L58.0 129.6 L62.1 136.9 L79.7 176.7 L85.9 180.7 L87.8 181.7 L90.2 182.2 L91.5 182.3 L92.2 183.9
  L93.0 184.4 L94.3 184.6 L96.9 184.2 L96.8 184.8 L95.1 187.5 L95.0 188.5 L95.1 189.7 L96.5 191.4
  L99.3 193.4 L100.7 194.8 L101.5 196.4 L101.5 196.9 L101.2 197.0 L97.9 195.3 L97.5 195.3 L97.5 195.6
  L99.0 197.8 L98.9 198.3 L98.3 198.5 L94.3 196.4 L93.7 196.2 L93.6 197.4 L94.8 201.9 L94.6 202.4
  L93.9 202.6 L93.3 202.0 L88.4 194.3 L85.9 192.2 L79.6 188.0 L77.2 185.4 L74.3 180.7 L65.5 172.2
  L63.1 169.5 L60.5 166.2 L57.9 162.3 L55.0 156.8 L52.8 151.1 L51.3 144.5 L46.4 137.3 L43.5 131.8
  L42.0 127.8 L41.3 124.5 L39.5 123.0 L38.2 122.3 L37.3 122.2 L36.1 122.8 L33.1 125.6 L32.4 126.6
  L30.9 129.7 L29.1 136.2 L29.2 137.3 L30.9 142.1 L31.6 146.4 L31.6 150.8 L30.9 155.5 L30.5 164.2
  L37.0 172.3 L47.9 189.4 L50.3 192.5 L51.5 193.7 L51.9 193.9 L52.3 193.7 L56.0 191.0 L57.9 190.1
  L59.6 189.6 L61.8 189.8 L64.1 190.5 L66.1 191.4 L69.3 193.7 L71.4 196.4 L74.0 202.0 L74.5 202.3
  L79.4 202.5 L83.8 203.6 L87.5 205.4 L91.2 207.7 L94.3 209.1 L98.7 209.4 L103.0 207.2 L104.6 206.6
  L107.2 206.2 L110.5 206.6 L113.4 208.0 L116.9 211.8 L118.9 214.7 L120.1 217.7 L120.9 221.0 L124.1 223.9
  L127.0 227.7 L128.1 229.9 L128.7 232.0 L129.2 234.6 L129.3 239.9 L129.0 242.4 L128.3 245.1 L127.6 246.5
  L126.4 248.1 L125.1 248.9 L123.6 249.3 L121.6 249.3 L119.5 248.7 L118.4 248.1 L103.4 230.0 L102.6 229.5
  L100.1 228.7 L96.9 226.9 L95.5 225.4 L94.8 223.4 L94.3 222.9 L90.1 223.3 L80.2 223.3 L73.7 222.9
  L72.2 224.2 L71.6 225.3 L71.0 227.3 L70.7 231.3 L70.0 231.8 L67.2 231.5 L61.9 230.2 L53.0 226.8
  L49.3 227.7 L45.2 228.2 L36.6 228.2 L26.3 226.7 L13.3 223.6 L12.1 223.6 L11.1 225.3 L10.8 226.8
  L10.9 228.1 L11.4 229.7 L12.7 232.0 L13.9 235.4 L14.8 239.4 L15.1 242.5 L15.5 243.1 L20.3 245.9
  L25.3 249.6 L27.6 251.7 L33.3 257.6 L38.2 257.8 L42.3 258.5 L48.9 260.8 L52.3 262.5 L52.6 262.9
  L51.1 267.7 L49.1 272.9 L46.8 277.1 L44.8 279.3 L42.5 287.4 L39.5 292.6 L37.9 294.3 Z`;

/* Gown - Sweep. A column gown with the train pooling behind, one hand on the
   hip. This replaces the fan-skirt source, which was a watermarked line
   drawing whose head had no area to cut and had to be grafted on; this one is
   solid ink throughout, so it is a straight trace. --radius 1.2 --close 1.2:
   the hanging near arm is a four-pixel strip that the default opening deletes
   outright, and a closing above about 1.5 welds what is left of it onto the
   bodice. The hand on the hip encloses a triangle well over the 1.2% cut-off,
   so it is cut as a real hole. */
const GOWN_SWEEP_TRACE = `M75.1 299.9 L23.5 299.9 L23.3 299.8 L23.2 294.2 L16.0 294.2 L9.8 292.9 L6.1 292.8 L2.5 291.9
  L-0.7 291.5 L-3.1 290.7 L-6.2 290.3 L-8.9 289.4 L-11.1 289.1 L-16.3 287.2 L-19.7 285.3 L-20.6 283.6
  L-20.5 281.9 L-18.2 275.4 L-17.6 271.9 L-16.7 269.8 L-16.3 267.1 L-15.4 264.7 L-15.0 261.6 L-13.3 255.4
  L-12.9 251.0 L-11.8 247.3 L-11.5 243.0 L-10.2 237.0 L-8.1 213.6 L-8.4 194.6 L-9.0 190.6 L-9.2 181.9
  L-10.2 176.7 L-10.3 172.3 L-11.5 167.3 L-11.7 164.0 L-13.0 159.0 L-13.9 152.3 L-15.1 148.2 L-15.4 145.5
  L-16.6 141.0 L-17.0 131.2 L-17.5 130.4 L-18.3 130.1 L-18.9 130.1 L-19.9 130.7 L-21.5 133.2 L-22.3 135.5
  L-22.4 136.6 L-21.5 142.3 L-21.8 151.0 L-22.1 153.0 L-22.1 154.4 L-21.5 156.2 L-21.5 157.2 L-22.2 158.8
  L-23.2 159.4 L-24.8 159.2 L-26.1 158.6 L-27.2 157.2 L-28.1 154.7 L-28.9 151.9 L-29.0 146.5 L-28.2 142.9
  L-27.8 139.2 L-26.7 136.0 L-26.3 133.2 L-25.1 130.1 L-23.8 124.6 L-13.3 95.3 L-12.9 92.3 L-11.8 88.9
  L-11.5 84.8 L-10.8 82.1 L-9.9 81.2 L-9.3 81.1 L-8.5 81.3 L-7.5 82.6 L-6.8 84.3 L-6.4 87.6
  L-6.8 94.9 L-7.1 96.6 L-8.1 99.1 L-11.9 105.3 L-14.6 111.2 L-15.2 113.5 L-15.4 116.9 L-16.3 118.4
  L-16.3 119.2 L-15.9 119.3 L-15.6 118.9 L-15.4 117.2 L-13.1 112.3 L-12.0 109.1 L-9.1 103.8 L-5.9 99.3
  L-4.4 95.8 L-4.2 91.0 L-4.3 87.4 L-5.1 85.1 L-5.7 82.2 L-8.8 75.6 L-9.6 72.6 L-9.3 69.4
  L-8.2 66.2 L-8.3 65.5 L-9.1 62.9 L-9.1 60.7 L-8.8 56.9 L-8.2 54.3 L-7.6 53.1 L-6.1 51.3
  L-4.3 50.1 L2.7 48.7 L6.2 48.4 L9.1 47.3 L11.0 45.6 L12.2 43.5 L12.5 39.4 L12.1 37.9
  L11.4 36.8 L9.8 35.8 L5.4 35.8 L4.4 35.3 L3.7 34.5 L2.0 30.9 L1.3 28.4 L0.3 26.5
  L0.3 25.1 L0.9 22.8 L0.9 19.9 L0.0 16.6 L0.0 14.8 L0.6 11.0 L-0.2 8.6 L-0.2 7.3
  L0.2 6.1 L1.8 4.5 L5.0 3.5 L8.8 1.3 L12.6 0.1 L19.0 -0.1 L24.1 1.8 L27.8 5.2
  L31.0 10.2 L32.3 11.0 L34.2 11.7 L36.1 13.7 L36.6 15.1 L36.7 18.1 L35.8 20.7 L35.8 23.9
  L35.6 24.9 L34.5 26.5 L31.5 29.1 L25.8 31.0 L24.7 31.9 L24.3 33.1 L24.3 36.4 L25.3 40.1
  L26.3 42.1 L27.9 44.5 L31.4 47.8 L33.7 49.0 L41.7 52.3 L44.8 55.5 L45.8 57.0 L50.6 66.7
  L52.3 69.3 L53.6 71.9 L60.2 81.4 L63.5 87.0 L66.5 94.1 L66.3 96.0 L65.1 97.7 L58.3 102.2
  L52.8 105.0 L49.8 106.1 L46.4 108.0 L37.3 111.5 L32.0 113.9 L28.5 114.8 L27.5 115.5 L26.9 116.6
  L26.9 118.9 L28.1 123.2 L28.1 134.4 L26.9 138.6 L26.6 141.7 L25.5 144.8 L24.2 150.7 L23.2 153.5
  L22.8 156.7 L21.9 159.2 L21.7 163.0 L20.6 169.1 L20.6 175.4 L21.8 183.1 L21.8 185.5 L22.9 189.2
  L23.4 193.0 L26.6 202.7 L29.5 209.4 L31.1 213.7 L37.7 226.8 L44.7 237.8 L51.0 246.3 L52.2 247.7
  L67.3 262.8 L73.2 267.2 L74.9 268.3 L77.8 269.5 L78.6 269.5 L81.5 268.5 L87.6 269.4 L94.6 269.4
  L99.2 270.5 L105.6 271.0 L112.8 272.8 L116.2 273.3 L118.6 274.2 L121.0 274.6 L124.9 276.2 L127.4 278.2
  L128.4 279.1 L128.8 279.9 L128.8 281.4 L128.1 282.5 L127.3 283.4 L125.4 284.6 L120.5 287.0 L110.4 290.1
  L84.7 294.0 L75.2 294.2 Z
  M28.9 108.1 L30.6 107.5 L34.8 105.4 L44.6 99.9 L51.2 95.0 L52.5 93.6 L53.3 92.2 L53.3 91.1
  L52.6 89.5 L46.9 82.0 L43.0 75.7 L40.2 72.0 L38.7 71.0 L37.8 71.0 L36.8 71.5 L34.8 74.2
  L26.4 87.6 L22.6 94.5 L21.3 97.9 L21.1 99.1 L21.2 100.1 L23.6 104.9 L26.4 107.6 L27.7 108.1 Z`;

/* Football — Celebrate. Pixabay 3340842: arms out. */
const FOOT_CELEBRATE_TRACE = `M151.7 299.9 L122.6 299.9 L122.5 294.3 L121.6 284.9 L120.8 282.8 L120.4 280.3 L119.4 277.7 L118.6 274.9
  L116.0 269.5 L111.7 262.0 L106.7 255.0 L99.4 246.2 L97.0 242.0 L94.5 235.1 L92.3 227.2 L90.8 224.0
  L90.8 219.2 L89.7 216.4 L83.0 205.8 L78.5 199.7 L77.7 199.2 L73.9 199.1 L72.8 198.7 L70.3 191.2
  L68.7 187.9 L67.6 186.4 L65.7 185.0 L57.3 181.5 L56.1 181.8 L54.9 183.1 L48.7 192.9 L44.7 200.4
  L43.5 200.8 L40.1 200.2 L32.2 200.5 L30.6 200.9 L29.4 201.8 L18.8 216.8 L13.7 223.2 L12.6 225.2
  L11.5 226.2 L10.8 227.6 L9.5 229.1 L4.2 240.2 L1.3 245.0 L-9.7 257.8 L-15.0 264.8 L-17.4 268.4
  L-19.7 273.2 L-21.2 279.3 L-22.2 281.1 L-24.5 283.8 L-25.0 285.0 L-24.9 287.3 L-25.1 288.3 L-27.2 291.0
  L-28.8 292.3 L-36.9 291.7 L-38.1 291.2 L-39.7 289.8 L-42.0 288.4 L-42.7 287.5 L-42.4 286.4 L-41.2 284.5
  L-39.9 283.2 L-37.7 281.6 L-36.3 280.1 L-34.4 276.0 L-31.4 272.2 L-29.8 269.6 L-28.0 265.7 L-24.0 254.6
  L-20.2 245.4 L-16.9 238.3 L-12.4 229.9 L-8.7 224.2 L-4.7 219.6 L-0.3 213.6 L6.9 201.1 L8.6 194.6
  L8.7 190.7 L11.5 181.8 L17.4 168.1 L21.9 159.5 L22.0 158.5 L21.3 156.8 L21.3 155.9 L23.7 150.1
  L24.9 144.8 L25.2 142.3 L27.4 136.4 L27.5 134.1 L27.2 132.9 L25.2 128.6 L26.0 123.6 L26.0 119.1
  L25.4 113.0 L23.9 106.4 L21.0 97.3 L17.8 89.9 L16.7 88.2 L16.2 87.8 L15.9 87.8 L13.5 89.4
  L7.3 95.2 L-1.9 104.3 L-5.5 108.3 L-7.9 110.4 L-16.5 116.6 L-22.6 121.5 L-30.5 126.7 L-34.7 130.1
  L-38.5 132.5 L-39.8 133.8 L-41.9 135.2 L-47.4 140.6 L-51.1 143.5 L-52.4 145.5 L-54.0 150.2 L-55.2 152.6
  L-55.9 152.7 L-56.5 151.8 L-55.0 145.3 L-55.0 144.1 L-55.3 143.6 L-55.7 143.5 L-56.3 144.0 L-60.6 150.7
  L-62.1 152.4 L-62.6 152.6 L-63.0 152.3 L-63.0 151.5 L-60.3 145.2 L-60.2 144.2 L-60.5 144.1 L-61.3 144.7
  L-64.8 149.3 L-65.9 149.5 L-66.2 149.3 L-66.2 148.5 L-64.8 145.0 L-65.2 142.6 L-64.5 141.5 L-58.8 134.4
  L-58.0 133.6 L-56.4 132.8 L-55.1 131.7 L-54.6 130.7 L-54.7 129.6 L-54.2 128.7 L-53.3 128.4 L-52.1 129.3
  L-51.0 129.4 L-49.4 128.7 L-47.0 125.8 L-38.6 117.9 L-29.4 107.8 L-20.5 98.8 L-15.9 94.9 L-14.1 93.9
  L-9.9 89.9 L-7.4 86.9 L-6.5 84.0 L-1.1 79.2 L3.1 74.7 L5.3 70.0 L7.4 66.6 L10.1 64.0
  L13.6 58.4 L15.5 56.3 L17.0 55.4 L20.9 55.5 L22.0 55.1 L25.2 52.8 L28.1 51.7 L30.6 50.0
  L34.7 46.7 L37.5 43.8 L38.2 42.7 L38.6 41.2 L38.4 38.4 L34.9 31.2 L32.6 28.4 L32.1 26.8
  L31.7 18.9 L31.8 13.5 L32.8 9.1 L34.6 5.4 L35.8 4.3 L37.8 3.0 L41.9 1.2 L47.1 -0.1
  L49.0 0.5 L51.0 1.4 L54.2 3.4 L55.9 5.2 L58.8 9.0 L60.1 11.4 L60.9 14.4 L63.0 25.9
  L63.0 29.6 L62.5 32.5 L61.7 34.7 L59.9 37.1 L59.6 38.5 L59.6 46.5 L60.2 48.9 L61.4 50.2
  L66.4 53.4 L71.6 53.9 L75.1 54.9 L79.7 57.3 L82.3 59.5 L86.0 65.3 L88.0 69.1 L93.2 84.8
  L94.2 86.9 L95.8 89.3 L96.0 90.4 L96.9 92.1 L97.5 94.3 L98.5 95.7 L99.2 97.6 L101.0 100.0
  L105.4 104.3 L117.1 119.8 L123.5 126.3 L125.1 127.4 L128.9 130.6 L130.8 131.6 L132.4 131.7 L134.0 131.5
  L144.7 129.6 L147.7 128.7 L148.2 128.7 L148.6 129.1 L148.5 130.2 L147.4 131.4 L145.1 132.7 L140.6 134.6
  L139.6 135.4 L139.1 136.5 L139.7 137.6 L141.5 139.4 L148.3 143.1 L151.3 145.2 L152.4 146.4 L152.6 147.0
  L152.5 147.5 L151.7 148.0 L149.5 147.2 L142.9 144.2 L141.3 143.9 L140.3 144.6 L140.4 145.5 L141.0 146.1
  L146.3 150.6 L149.3 153.4 L149.9 154.7 L149.8 155.8 L149.3 156.2 L148.1 155.9 L143.0 152.2 L140.8 150.9
  L140.6 151.2 L140.8 151.6 L145.6 156.6 L146.1 157.5 L146.2 158.4 L145.7 158.9 L144.4 158.5 L139.7 154.9
  L137.2 153.4 L137.2 153.9 L139.1 157.4 L139.0 158.6 L138.6 159.0 L138.0 159.0 L136.7 157.9 L133.5 153.8
  L127.2 146.6 L122.7 140.8 L122.0 140.5 L121.4 140.6 L120.5 140.3 L117.8 138.3 L116.3 137.6 L101.5 124.6
  L92.4 115.9 L88.4 111.6 L84.4 105.2 L79.8 99.1 L79.1 98.6 L78.7 98.6 L78.4 99.1 L78.4 100.3
  L79.7 106.2 L82.6 115.8 L85.4 123.3 L88.5 129.3 L88.8 130.6 L89.1 137.2 L89.1 141.6 L88.7 145.7
  L88.9 146.7 L90.5 149.5 L93.4 156.8 L94.3 160.1 L97.2 165.5 L99.6 171.1 L103.6 183.6 L104.1 187.1
  L105.0 190.0 L104.3 194.9 L104.3 198.0 L104.6 199.5 L107.8 205.8 L111.0 216.6 L112.9 220.9 L114.0 224.1
  L118.7 233.4 L121.0 238.9 L123.7 246.8 L125.3 250.2 L126.1 253.6 L128.1 260.0 L131.4 269.4 L132.7 271.4
  L136.9 276.4 L139.9 279.1 L142.4 280.9 L153.3 286.4 L156.5 287.5 L160.5 288.3 L162.9 289.1 L165.0 290.3
  L166.0 291.4 L165.9 292.0 L165.4 292.4 L163.2 293.0 L157.5 293.8 L151.9 294.2 Z`;

/* Volleyball, men and women: a spike each, no ball. New art on 2 Nov after the
   owner found the last lineup worse than the one before it ("change new stances"):
     Men    0 Spike -- Pixabay 9675748, drawn in colour; every opaque pixel is him
     Women  1 Spike -- Openclipart 295406 (public domain), drawn from its SVG
   Both stand at or near full height on their base. The Set (Pixabay 2667290)
   came back up in the search and was left out: it is the pose the owner asked
   to replace. */
const VOLLEY_M_SPIKE_TRACE = `M67.9 299.9 L60.9 299.9 L60.5 299.7 L60.5 294.3 L60.1 293.0 L60.1 291.8 L60.7 289.4 L62.5 286.0
  L63.9 282.1 L64.4 278.2 L64.9 271.7 L64.8 270.1 L63.0 269.1 L62.5 268.3 L62.4 266.9 L62.6 265.4
  L61.0 263.4 L60.8 262.6 L61.1 261.9 L62.5 260.9 L62.6 260.4 L60.8 256.7 L56.7 251.1 L53.9 248.2
  L52.5 247.0 L51.4 245.5 L42.5 238.0 L28.8 225.6 L26.7 224.5 L23.1 223.0 L20.7 220.7 L16.5 218.4
  L15.6 217.4 L14.9 215.6 L14.6 209.4 L13.5 197.3 L13.6 192.4 L13.4 191.9 L12.6 191.4 L12.4 190.9
  L12.8 184.7 L15.6 166.6 L15.2 164.2 L13.4 158.7 L13.1 157.0 L13.1 154.5 L14.1 149.6 L15.5 144.6
  L18.3 135.6 L19.5 132.6 L19.4 129.1 L19.8 126.6 L14.4 118.2 L13.9 116.8 L13.9 115.7 L14.7 113.0
  L15.9 110.5 L18.5 106.7 L18.8 105.5 L18.8 101.7 L19.3 100.7 L20.9 98.7 L21.9 92.0 L23.6 88.0
  L25.6 85.4 L25.8 84.1 L25.6 83.6 L25.0 83.4 L13.6 83.5 L7.7 85.2 L3.0 86.2 L-6.1 87.3
  L-25.1 87.1 L-26.0 87.3 L-27.2 88.0 L-31.4 95.0 L-33.7 98.3 L-35.4 99.9 L-36.5 100.6 L-37.5 100.9
  L-38.2 100.7 L-38.7 99.8 L-38.5 99.1 L-36.8 95.9 L-36.8 95.4 L-42.4 97.3 L-43.3 97.3 L-44.0 97.0
  L-44.8 95.9 L-44.5 95.0 L-43.9 94.4 L-40.3 92.7 L-39.0 91.8 L-37.5 90.5 L-37.3 89.7 L-42.2 90.9
  L-45.7 90.9 L-47.3 90.3 L-47.7 89.9 L-47.9 88.9 L-47.4 87.8 L-46.1 86.4 L-45.2 84.5 L-39.7 80.8
  L-39.4 80.4 L-42.3 77.9 L-43.0 76.7 L-43.3 75.1 L-42.5 73.8 L-41.7 73.6 L-38.7 75.7 L-37.3 76.2
  L-32.0 77.2 L-30.7 77.2 L-26.7 76.3 L-19.2 75.4 L-12.7 74.1 L-7.2 72.6 L-1.1 70.3 L1.4 69.7
  L3.8 69.4 L10.7 69.7 L13.6 68.1 L15.8 67.4 L25.7 66.1 L30.0 64.9 L32.2 63.8 L35.3 60.2
  L37.4 59.0 L43.7 57.2 L52.4 55.2 L52.8 54.4 L53.0 52.2 L52.9 49.3 L52.4 47.9 L51.5 46.8
  L48.3 45.0 L47.3 43.8 L46.9 42.7 L46.9 41.2 L48.4 38.8 L48.6 36.4 L49.5 35.2 L49.8 33.5
  L50.6 32.6 L51.9 31.7 L50.9 29.3 L50.9 28.7 L51.5 28.0 L52.4 27.4 L58.1 25.3 L58.7 24.7
  L59.6 22.6 L60.6 21.4 L64.2 19.7 L64.4 19.4 L64.2 18.0 L64.3 16.3 L66.4 14.2 L66.2 13.9
  L64.8 13.8 L67.5 12.6 L68.7 10.8 L69.7 10.0 L71.6 9.3 L75.3 9.4 L78.6 10.6 L80.4 11.5
  L83.3 13.7 L88.2 19.1 L91.2 21.9 L92.3 24.1 L93.1 28.9 L94.0 31.5 L94.4 33.8 L94.3 36.0
  L93.4 38.1 L90.7 41.1 L85.6 45.0 L75.1 51.6 L74.6 52.3 L74.8 52.8 L80.6 53.1 L84.5 52.1
  L88.5 52.1 L92.6 53.0 L97.2 54.8 L100.5 52.7 L105.3 51.6 L110.4 51.6 L115.9 52.4 L116.2 51.6
  L115.8 48.1 L113.9 37.8 L112.0 32.2 L108.9 26.1 L107.6 24.2 L106.2 22.8 L100.4 21.0 L93.0 16.9
  L92.2 16.2 L92.4 15.2 L93.4 14.7 L95.2 14.7 L99.4 15.8 L100.1 15.8 L101.0 15.3 L101.4 14.1
  L101.2 12.8 L97.9 4.6 L98.0 3.5 L99.2 2.1 L99.2 1.0 L99.5 0.4 L100.2 -0.0 L100.8 -0.1
  L102.0 0.6 L104.3 3.4 L104.8 3.4 L105.8 2.8 L106.7 2.6 L109.4 3.4 L110.5 5.0 L111.2 7.3
  L113.9 11.4 L115.5 14.7 L116.8 19.4 L118.2 22.6 L122.1 30.1 L126.5 37.4 L129.3 43.7 L131.1 49.7
  L132.0 53.7 L132.4 57.8 L132.2 60.0 L131.7 61.0 L130.4 62.1 L124.5 65.8 L118.1 69.0 L111.5 71.5
  L106.8 72.6 L103.4 73.0 L98.6 73.0 L93.8 72.5 L92.0 72.5 L90.9 72.9 L84.7 79.1 L83.5 81.8
  L82.3 83.7 L79.2 87.5 L76.7 90.1 L75.9 91.7 L74.6 93.3 L72.5 95.2 L70.0 96.8 L68.6 100.0
  L66.8 103.0 L63.0 107.6 L59.9 110.8 L58.8 115.5 L55.7 119.4 L55.8 120.7 L57.9 124.9 L58.2 127.7
  L57.3 130.2 L55.7 132.1 L55.1 134.9 L57.9 139.5 L60.4 145.7 L61.5 151.1 L61.5 156.1 L60.9 159.9
  L59.9 163.8 L58.4 168.0 L56.1 173.0 L56.2 175.1 L55.8 178.2 L55.8 181.8 L56.3 196.5 L56.0 200.0
  L54.7 201.8 L54.7 204.1 L53.8 209.3 L54.0 210.8 L54.4 211.8 L55.0 212.0 L58.5 210.4 L62.0 209.3
  L65.8 208.5 L69.1 208.3 L77.8 208.5 L86.0 209.5 L87.4 209.0 L99.0 208.8 L103.3 208.5 L107.5 207.9
  L107.8 207.6 L108.1 206.2 L111.9 201.1 L113.6 198.0 L114.8 196.7 L116.3 195.9 L118.0 195.4 L119.6 195.6
  L121.9 196.4 L124.4 198.2 L126.7 200.5 L128.8 203.2 L132.4 209.0 L136.0 211.4 L138.7 213.5 L142.7 217.8
  L144.8 221.0 L146.6 225.1 L147.5 228.3 L147.7 232.2 L147.4 234.1 L146.2 237.1 L145.0 238.4 L143.2 239.1
  L140.7 237.9 L133.1 231.8 L129.1 229.5 L125.3 228.6 L116.7 228.5 L114.7 227.5 L113.4 226.0 L112.9 224.7
  L112.4 224.3 L107.5 223.3 L103.2 223.2 L97.3 224.2 L89.1 226.6 L87.1 226.4 L61.4 233.4 L61.1 234.1
  L62.4 236.4 L63.9 237.5 L67.3 243.2 L71.1 248.8 L74.1 251.9 L75.7 253.0 L77.2 253.0 L79.6 253.8
  L86.8 257.2 L89.1 257.4 L90.7 258.8 L91.4 260.1 L91.3 261.5 L90.5 263.9 L89.5 265.7 L82.5 276.1
  L75.3 288.6 L74.2 290.0 L72.1 291.9 L70.0 293.3 L68.0 294.3 Z`;

const VOLLEY_W_SPIKE_TRACE = `M52.1 299.9 L46.9 299.9 L46.8 294.2 L45.6 293.0 L44.4 291.2 L43.0 287.5 L41.9 283.0 L41.7 280.6
  L41.7 276.4 L42.4 271.6 L41.0 268.6 L40.1 264.9 L39.9 258.4 L40.1 257.4 L40.4 256.4 L41.2 255.1
  L43.2 254.0 L45.5 254.0 L52.1 255.2 L53.5 255.5 L55.0 256.6 L55.6 256.4 L58.8 252.4 L63.2 245.9
  L70.8 233.1 L72.0 231.4 L73.5 229.7 L76.2 227.4 L78.9 225.5 L83.8 222.9 L84.2 222.4 L84.2 221.1
  L82.5 213.8 L78.5 200.7 L77.0 196.4 L76.6 195.8 L76.3 195.7 L75.9 196.1 L70.3 207.7 L66.4 214.8
  L63.5 219.5 L59.4 225.3 L57.8 228.1 L56.0 229.9 L54.1 231.2 L51.4 232.5 L47.5 233.6 L44.3 233.9
  L42.3 233.7 L39.9 233.1 L37.1 231.4 L34.2 230.2 L30.6 228.2 L27.7 225.6 L24.9 222.3 L19.8 219.2
  L13.9 216.6 L6.7 213.9 L-6.1 209.6 L-13.1 207.5 L-14.0 208.2 L-15.8 211.3 L-16.7 212.2 L-17.7 212.7
  L-19.2 212.5 L-21.3 211.7 L-30.1 211.7 L-32.3 212.3 L-34.9 213.4 L-41.9 218.4 L-43.4 219.0 L-44.6 219.0
  L-45.9 218.4 L-46.4 218.1 L-46.9 217.2 L-47.0 215.6 L-46.6 213.6 L-44.4 209.6 L-40.9 204.6 L-30.3 191.9
  L-24.3 184.0 L-21.3 182.1 L-19.7 181.7 L-18.7 181.9 L-17.4 182.8 L-7.9 195.3 L-6.8 196.2 L1.0 197.9
  L17.4 199.2 L24.6 200.0 L29.5 200.9 L34.7 202.5 L38.3 204.4 L41.4 206.6 L42.0 206.8 L42.5 206.6
  L44.8 203.4 L46.2 200.7 L47.7 196.5 L48.4 192.9 L49.4 183.5 L50.4 161.8 L51.0 155.9 L52.0 150.4
  L53.3 146.7 L55.1 143.4 L57.3 140.3 L61.4 135.5 L62.8 132.9 L62.9 130.6 L62.3 128.6 L61.2 126.1
  L58.1 121.4 L54.3 117.0 L48.3 111.2 L42.4 106.1 L31.9 98.1 L25.7 94.1 L24.7 93.6 L23.9 93.8
  L21.1 98.2 L18.1 101.0 L14.8 102.5 L11.3 103.4 L7.2 103.4 L2.6 102.2 L-0.6 100.3 L-2.4 98.5
  L-3.5 96.9 L-4.5 94.7 L-4.8 92.7 L-4.5 90.8 L-3.8 89.4 L-2.3 88.1 L-1.3 87.8 L-0.9 89.5
  L0.4 90.9 L1.8 91.5 L3.9 91.2 L4.9 90.5 L5.9 89.1 L8.7 83.9 L8.3 83.3 L1.1 79.2
  L0.5 78.6 L-0.2 76.9 L-0.4 75.3 L-0.2 62.9 L2.8 39.9 L0.2 33.8 L-1.3 28.6 L-3.5 23.2
  L-3.7 21.9 L-3.2 21.4 L-2.5 21.7 L0.7 27.1 L1.3 27.4 L2.0 27.2 L2.2 26.1 L0.8 18.9
  L0.8 17.6 L1.2 16.6 L2.0 16.6 L2.6 17.6 L3.1 19.9 L3.4 20.2 L4.0 20.2 L4.2 18.6
  L3.8 12.8 L4.2 12.0 L4.9 11.8 L5.6 12.2 L6.4 13.8 L7.4 20.0 L7.8 19.6 L7.9 16.7
  L8.3 16.0 L8.8 15.8 L9.1 16.0 L9.8 17.6 L10.6 21.4 L10.7 25.9 L12.0 30.5 L12.5 31.0
  L13.1 31.0 L13.5 30.4 L13.9 29.2 L14.4 28.8 L14.8 28.7 L16.3 30.4 L16.7 31.4 L16.6 32.4
  L14.7 35.7 L11.0 40.2 L10.6 41.9 L11.4 57.4 L12.6 70.1 L12.9 72.6 L13.3 73.1 L16.8 75.0
  L17.5 75.2 L21.1 72.2 L23.4 71.1 L24.6 70.8 L28.0 71.3 L28.6 71.0 L28.5 70.2 L25.6 65.8
  L24.4 63.3 L24.6 57.3 L28.9 49.8 L31.4 46.8 L34.4 44.6 L37.0 43.3 L41.1 42.4 L44.0 42.7
  L47.3 44.0 L49.5 45.8 L51.1 49.9 L51.9 50.3 L53.8 50.5 L54.3 50.8 L55.4 54.3 L57.6 56.6
  L58.1 58.9 L59.4 60.3 L60.2 61.6 L60.0 62.5 L57.9 65.9 L57.9 67.1 L58.4 68.8 L59.3 70.0
  L62.1 72.6 L62.6 72.7 L66.5 70.1 L74.0 66.0 L79.4 63.7 L86.1 61.4 L91.0 57.7 L99.2 48.8
  L111.5 36.3 L122.0 27.2 L127.1 23.4 L140.0 11.4 L144.7 3.2 L145.8 0.3 L146.4 -0.0 L146.9 0.6
  L146.9 1.0 L145.5 5.5 L145.0 8.2 L143.7 10.2 L143.3 14.0 L142.5 15.5 L141.4 17.0 L140.2 20.0
  L138.0 21.9 L134.9 23.3 L133.0 25.1 L127.8 33.0 L121.5 41.1 L112.5 51.1 L110.6 52.7 L104.8 60.4
  L103.1 62.0 L96.9 69.6 L90.6 78.7 L89.3 81.0 L89.3 81.6 L91.4 85.4 L92.9 88.8 L93.3 92.7
  L93.6 101.1 L94.1 105.2 L95.6 111.0 L96.7 116.7 L99.4 128.3 L101.5 134.0 L102.8 139.3 L103.0 144.4
  L102.2 149.4 L101.6 150.0 L98.6 150.5 L98.4 151.0 L98.4 153.2 L98.8 157.1 L103.3 178.9 L105.1 191.6
  L107.4 213.1 L107.9 220.0 L108.9 225.4 L108.9 228.9 L108.6 230.8 L107.8 232.8 L106.7 234.9 L104.3 237.8
  L102.8 239.0 L100.0 240.6 L96.9 241.7 L92.8 242.6 L87.6 243.1 L85.6 244.1 L74.6 252.9 L69.9 256.4
  L63.0 263.2 L61.1 265.7 L60.8 266.6 L62.2 270.1 L62.2 272.6 L61.1 273.9 L58.5 275.5 L56.7 279.1
  L55.5 283.2 L54.0 290.5 L53.4 292.2 L52.2 294.2 Z`;

/* Football — Stance. Pixabay 3092287: standing square to the front, the way a
   captain stands for the team photo; the ball by his boot taken out. */
const FOOT_STANCE_TRACE = `M75.2 299.9 L62.6 299.9 L62.6 294.4 L61.4 293.2 L61.0 292.3 L60.6 289.1 L60.5 283.6 L58.1 276.3
  L55.4 270.6 L55.8 267.2 L55.3 265.1 L55.3 262.3 L57.6 258.1 L57.9 256.7 L57.9 252.2 L56.5 244.3
  L55.2 240.7 L54.4 237.2 L54.7 233.5 L55.3 230.0 L55.0 226.7 L55.1 224.2 L52.8 216.7 L52.4 213.9
  L52.5 207.7 L53.4 203.7 L53.7 200.4 L53.5 199.5 L52.8 198.3 L52.7 195.4 L51.6 191.4 L50.8 186.0
  L50.8 182.1 L50.5 181.3 L50.0 181.1 L48.6 181.2 L47.0 181.9 L44.7 183.4 L39.9 188.2 L36.5 192.3
  L34.8 195.3 L32.3 201.4 L32.2 202.2 L32.7 203.8 L32.5 204.8 L32.2 205.5 L30.5 206.9 L30.1 207.8
  L30.3 229.0 L29.2 234.6 L27.6 238.6 L25.7 245.9 L23.5 251.5 L22.6 255.1 L21.9 259.9 L21.9 263.0
  L22.2 265.3 L22.9 268.0 L22.9 270.2 L21.8 273.7 L21.8 276.3 L20.6 280.9 L17.2 286.4 L13.3 289.4
  L10.0 291.2 L6.8 292.0 L2.9 291.5 L2.3 291.2 L1.1 289.8 L0.4 288.2 L1.2 285.6 L2.7 283.4
  L4.6 281.4 L5.9 279.3 L5.9 277.2 L5.3 276.1 L5.3 275.6 L6.1 274.6 L7.3 273.7 L8.2 272.3
  L8.7 270.7 L8.6 270.0 L10.0 268.2 L11.7 263.6 L12.0 255.1 L11.2 248.8 L10.1 243.4 L9.6 233.7
  L9.6 221.3 L10.1 218.9 L10.5 213.3 L13.6 203.3 L13.9 198.8 L14.2 198.0 L15.4 197.0 L15.9 194.3
  L17.3 183.1 L17.3 181.0 L16.2 179.5 L16.6 173.9 L16.6 168.9 L16.9 165.0 L17.8 160.0 L18.9 156.0
  L19.4 151.4 L21.8 145.4 L21.7 144.5 L20.3 140.6 L20.3 140.0 L21.2 138.5 L23.3 137.2 L23.9 136.1
  L24.1 134.2 L23.8 132.9 L23.8 131.0 L24.3 129.7 L25.3 128.0 L25.4 127.0 L25.0 125.7 L25.2 124.4
  L26.5 120.1 L27.4 119.0 L29.1 117.9 L29.4 117.1 L29.6 115.4 L30.3 113.3 L30.6 107.2 L30.3 104.8
  L29.7 103.1 L29.7 97.9 L29.2 95.5 L22.9 84.2 L21.1 82.7 L20.6 82.5 L20.2 82.6 L19.4 84.9
  L18.4 94.5 L17.3 100.7 L15.2 106.5 L12.0 113.6 L11.0 117.1 L3.4 137.7 L1.9 142.6 L2.3 144.5
  L3.8 146.2 L4.5 148.5 L5.1 152.1 L5.0 155.6 L3.8 157.3 L2.7 157.7 L2.3 157.3 L2.3 156.0
  L1.9 154.3 L1.4 154.0 L0.2 154.0 L-0.6 154.3 L-1.7 155.3 L-2.4 156.1 L-2.7 156.9 L-2.4 158.6
  L-0.6 161.4 L1.9 162.8 L4.1 163.6 L4.5 164.0 L4.5 164.4 L3.8 164.8 L1.0 164.9 L0.7 165.4
  L0.8 166.9 L0.1 167.4 L-1.1 167.0 L-3.9 164.9 L-5.8 163.1 L-6.7 161.3 L-7.4 159.7 L-8.5 153.7
  L-6.3 143.9 L-5.1 136.8 L-2.8 126.2 L-1.6 119.2 L-1.3 115.0 L1.0 103.5 L2.2 98.3 L6.0 88.5
  L6.4 87.2 L6.5 85.4 L7.0 84.1 L7.0 80.4 L5.5 73.1 L6.5 66.9 L7.5 63.8 L7.8 60.0
  L8.2 58.1 L10.4 54.3 L12.7 51.7 L17.0 48.7 L21.0 46.9 L23.0 46.2 L25.2 45.9 L29.4 43.8
  L32.9 42.7 L33.9 41.8 L34.2 39.6 L33.2 36.8 L32.8 34.5 L32.4 33.8 L29.9 32.4 L28.7 31.1
  L27.8 29.2 L26.9 25.7 L26.9 24.6 L27.2 23.6 L27.8 23.2 L28.9 23.0 L29.2 22.5 L29.2 20.8
  L28.5 16.6 L28.4 9.4 L29.9 6.3 L33.1 3.0 L37.3 0.6 L40.9 -0.1 L42.6 -0.1 L46.0 0.6
  L48.2 1.9 L53.1 6.3 L54.3 8.1 L54.7 9.6 L56.7 13.3 L57.1 14.6 L56.9 19.9 L57.4 21.2
  L57.4 25.1 L57.9 28.5 L57.9 30.3 L56.9 35.1 L56.9 38.6 L57.7 40.2 L58.7 41.0 L59.8 41.0
  L61.8 41.8 L63.6 42.3 L71.5 45.7 L75.4 48.6 L81.0 53.7 L84.1 55.9 L86.3 58.4 L87.5 60.9
  L88.2 63.0 L90.4 66.9 L92.4 71.7 L94.2 74.7 L96.1 78.8 L97.4 80.5 L100.2 85.4 L100.6 86.8
  L100.1 88.3 L100.2 90.8 L101.0 92.4 L102.1 95.9 L104.8 102.5 L106.6 108.2 L107.7 112.4 L108.4 116.7
  L108.2 118.6 L106.7 123.1 L105.9 126.7 L103.8 131.8 L101.6 138.1 L97.7 145.8 L93.8 151.1 L90.8 156.6
  L90.0 159.8 L89.1 167.4 L87.4 173.0 L86.9 176.4 L85.3 178.5 L84.7 181.3 L84.2 186.6 L81.5 194.7
  L80.2 199.9 L79.9 203.0 L79.3 203.8 L77.3 204.1 L76.3 205.5 L74.7 210.8 L73.3 217.1 L73.2 218.7
  L74.2 220.0 L74.7 222.8 L75.6 226.4 L75.6 230.3 L75.0 234.0 L73.0 240.8 L71.6 249.0 L70.0 253.0
  L68.6 255.7 L68.3 257.9 L69.3 261.5 L69.3 265.0 L70.5 267.0 L71.4 270.1 L73.0 273.7 L76.1 284.5
  L77.2 287.3 L77.7 290.2 L77.7 291.2 L77.2 292.3 L76.3 293.5 L75.3 294.4 Z`;

/* Basketball -- Point. Pixabay 3393880: standing to the front, one finger up; he
   was spinning a ball on it, and the ball is taken out with the finger kept. */
const BALL_POINT_TRACE = `M74.8 299.9 L-1.6 299.9 L-1.8 299.7 L-1.8 294.4 L-2.2 293.9 L-2.7 292.7 L-2.5 290.8 L-2.0 288.9
  L-0.6 286.6 L1.5 284.1 L3.1 280.9 L3.5 273.4 L3.7 272.0 L4.5 270.2 L5.8 268.9 L6.0 268.3
  L7.0 241.4 L8.0 229.7 L9.0 224.2 L10.0 220.3 L11.6 215.7 L14.0 210.6 L13.6 210.1 L10.8 209.6
  L10.2 209.0 L13.8 191.1 L21.2 146.2 L21.9 142.4 L23.3 139.0 L22.6 137.6 L22.7 132.3 L21.2 128.2
  L20.8 124.9 L21.4 121.7 L24.0 115.7 L26.4 92.7 L26.2 91.7 L25.8 92.2 L24.4 98.2 L23.3 100.8
  L22.2 102.1 L21.3 102.7 L18.5 103.7 L16.5 103.8 L14.0 103.2 L13.0 102.5 L12.4 101.6 L10.8 96.4
  L9.0 92.3 L8.4 88.9 L8.4 83.3 L9.1 78.8 L10.3 54.2 L7.3 47.6 L5.3 44.6 L2.8 42.2
  L0.2 41.3 L-0.2 40.9 L-0.2 40.4 L0.8 39.2 L2.5 38.9 L3.5 39.2 L5.1 40.1 L7.2 42.1
  L8.4 41.3 L8.6 40.0 L8.0 30.7 L7.6 27.8 L8.0 27.4 L10.7 27.8 L10.5 28.8 L10.8 32.1
  L11.1 33.9 L11.4 34.2 L12.0 33.7 L13.8 30.7 L14.7 29.6 L15.5 29.3 L16.3 29.8 L17.3 31.5
  L17.3 32.1 L16.8 32.6 L15.5 32.8 L15.2 33.1 L14.3 36.2 L14.7 37.4 L15.7 38.4 L16.3 38.5
  L16.8 38.3 L18.0 36.0 L19.1 35.0 L20.5 34.7 L21.5 35.1 L22.0 36.3 L22.4 38.7 L21.7 39.6
  L20.1 39.7 L19.6 40.0 L19.3 40.9 L19.8 41.5 L21.1 41.8 L21.9 41.4 L25.6 37.0 L26.6 37.0
  L26.9 37.8 L26.2 39.6 L22.7 44.3 L22.6 47.6 L22.0 51.1 L20.3 55.5 L20.1 58.7 L20.5 59.1
  L21.0 58.8 L21.9 57.7 L23.8 54.2 L24.5 53.9 L29.8 53.5 L37.6 48.2 L42.0 46.1 L42.4 45.7
  L42.9 42.7 L43.2 36.7 L41.4 33.1 L41.0 31.1 L41.0 29.4 L39.5 27.0 L38.7 23.0 L38.7 21.3
  L39.0 20.0 L39.6 19.4 L40.7 19.1 L40.9 18.7 L40.4 14.1 L40.4 11.7 L40.8 9.3 L41.6 7.4
  L42.5 5.9 L43.6 4.6 L45.6 3.1 L49.6 1.0 L53.6 -0.1 L56.7 -0.1 L57.9 0.2 L60.3 1.2
  L61.6 2.2 L63.6 4.1 L64.8 5.7 L66.3 8.5 L67.0 10.3 L67.3 12.1 L67.1 14.3 L65.9 20.5
  L66.2 20.9 L67.4 21.5 L67.8 22.5 L67.8 23.9 L67.1 26.1 L66.0 28.5 L65.0 30.1 L63.5 31.2
  L63.3 32.6 L62.3 35.1 L62.8 42.0 L63.6 44.4 L64.3 45.1 L67.4 47.0 L73.6 49.7 L77.0 50.4
  L83.5 50.9 L83.8 51.3 L84.2 54.0 L86.0 55.1 L87.1 56.2 L88.4 58.6 L89.0 60.5 L90.0 65.6
  L91.2 74.4 L91.2 79.7 L91.4 81.6 L93.4 90.8 L93.6 98.4 L97.0 107.7 L97.9 111.3 L98.8 116.8
  L101.0 137.9 L102.4 155.9 L102.4 160.8 L101.3 163.5 L100.3 167.1 L98.4 169.3 L92.4 174.4 L91.6 174.4
  L91.0 173.7 L90.8 173.2 L91.2 172.2 L95.6 165.9 L96.4 163.4 L96.3 160.3 L95.5 159.3 L94.6 159.1
  L94.0 159.7 L93.6 163.5 L93.0 164.8 L92.1 165.4 L90.9 166.0 L89.9 165.8 L89.4 165.2 L89.6 163.6
  L90.9 158.9 L91.1 153.4 L91.7 151.9 L93.6 149.1 L94.2 147.3 L94.1 143.0 L93.6 139.4 L92.8 136.8
  L88.3 125.8 L85.0 115.9 L83.3 108.4 L82.9 101.5 L82.4 98.2 L81.5 95.1 L81.2 94.8 L80.9 95.5
  L80.2 101.6 L80.2 106.5 L80.5 108.6 L81.4 113.1 L84.7 124.4 L85.2 127.8 L84.8 131.4 L85.2 135.9
  L84.8 137.3 L83.3 138.7 L83.3 141.6 L86.6 210.4 L85.9 210.9 L75.3 211.6 L73.9 211.7 L73.5 212.1
  L74.0 224.4 L73.5 231.9 L72.1 241.2 L68.9 256.7 L67.3 265.5 L67.1 267.3 L67.8 269.7 L67.5 275.6
  L68.4 278.6 L69.4 280.6 L70.6 282.2 L71.9 283.4 L75.1 285.5 L76.5 286.8 L77.7 289.6 L77.8 290.8
  L77.3 292.6 L76.5 293.5 L74.9 294.4 Z
  M68.7 295.2 L68.6 294.2 L60.8 292.7 L59.8 292.1 L57.9 292.0 L54.2 291.1 L53.4 290.6 L53.1 289.7
  L53.1 288.4 L54.1 284.7 L54.1 282.6 L53.0 278.6 L52.9 277.2 L53.3 275.6 L54.2 273.5 L54.2 271.6
  L55.5 270.5 L55.8 267.8 L56.0 253.0 L55.5 239.5 L56.1 232.1 L58.0 220.2 L58.1 217.1 L56.8 212.8
  L56.3 209.2 L55.0 208.2 L54.0 206.9 L54.4 204.4 L54.1 200.6 L52.7 191.6 L52.3 190.6 L51.9 191.3
  L50.2 198.3 L48.3 208.7 L45.2 211.3 L43.3 212.2 L38.8 212.7 L31.2 212.7 L30.6 213.2 L29.7 214.9
  L28.1 216.7 L27.3 218.1 L26.9 220.0 L25.7 232.3 L24.4 239.3 L16.3 266.3 L16.3 267.0 L16.8 267.5
  L17.2 268.7 L16.8 273.9 L17.7 275.4 L17.8 277.7 L15.3 287.0 L15.5 289.2 L14.8 295.0 L15.1 295.2 Z`;

/* Athletics, men 0-1 and women 2. Runners caught mid-stride land on one toe, and
   a figure stands with its feet in the middle of its base, so each is turned by
   the few degrees (`rotate` in figures.json) that put BOTH feet down: the piece
   then stands centred between them and keeps its full height.
     Men    0 Run -- Openclipart 275917 (public domain), turned 3.2 degrees
            1 Marathon -- Pixabay 3635758, running straight at you
     Women  2 Run -- Openclipart 320381 (public domain), turned 3.5 degrees
   The sprint straight at you and the finish through the tape went on 2 Nov:
   the owner found that lineup worse than the one before. */
const RUN_M_RUN_TRACE = `M131.9 299.9 L-23.3 299.9 L-23.5 299.8 L-23.5 294.2 L-25.7 291.6 L-31.2 281.3 L-33.2 276.5 L-34.0 273.3
  L-33.8 272.1 L-33.0 269.7 L-32.8 266.3 L-33.5 263.2 L-35.8 255.7 L-36.4 252.5 L-36.3 250.3 L-35.8 248.9
  L-34.8 247.8 L-33.8 247.3 L-30.1 246.2 L-26.8 245.8 L-23.7 245.9 L-22.1 245.6 L-20.9 245.0 L-19.7 243.7
  L-16.3 237.7 L-4.4 212.2 L-2.9 209.5 L-1.1 207.7 L2.3 205.3 L8.3 200.4 L12.5 197.5 L14.9 195.0
  L16.9 192.2 L18.5 189.2 L20.4 184.5 L24.3 172.8 L25.9 168.8 L27.1 166.3 L30.0 162.8 L31.0 161.0
  L31.8 157.9 L31.5 157.2 L30.4 156.5 L29.8 155.4 L29.6 154.5 L29.6 152.8 L32.1 143.5 L32.1 139.5
  L32.7 138.2 L34.3 136.6 L36.6 131.1 L39.7 125.4 L41.7 122.7 L45.2 119.2 L46.3 117.7 L47.1 115.7
  L47.8 111.3 L49.1 106.6 L49.4 105.1 L49.4 97.9 L48.3 96.7 L44.6 95.2 L43.3 93.9 L42.6 92.3
  L42.6 90.8 L43.0 89.1 L45.2 84.1 L52.9 71.3 L53.5 67.3 L54.6 63.0 L55.9 59.0 L59.6 49.9
  L61.0 47.9 L65.4 44.7 L66.6 43.5 L71.8 37.2 L73.6 35.6 L73.9 34.6 L73.9 31.9 L73.4 30.4
  L71.1 25.9 L69.3 17.7 L69.3 15.3 L69.7 13.3 L71.4 8.2 L73.5 5.1 L75.9 2.8 L79.4 0.9
  L82.8 0.1 L87.7 -0.1 L92.7 0.9 L97.1 2.8 L99.0 4.1 L100.2 5.3 L100.8 6.5 L100.9 8.0
  L102.3 10.6 L104.0 16.5 L104.0 17.7 L103.2 19.7 L103.2 20.6 L103.9 21.8 L106.0 24.0 L106.4 24.7
  L106.4 25.4 L105.9 25.9 L104.0 26.7 L103.6 27.3 L102.6 33.7 L102.6 39.0 L102.3 39.8 L101.8 40.4
  L95.1 44.8 L93.2 49.0 L92.1 52.7 L91.9 54.2 L92.0 56.6 L93.9 60.4 L94.1 62.9 L95.3 64.8
  L95.2 66.5 L96.2 72.3 L95.7 77.4 L93.5 90.4 L94.1 91.1 L94.9 91.4 L95.5 91.3 L98.3 87.4
  L101.4 84.3 L103.5 79.8 L104.2 79.3 L105.3 79.6 L106.0 80.5 L106.3 82.2 L105.7 84.2 L104.7 86.2
  L104.7 86.8 L105.0 87.2 L106.8 87.4 L112.7 86.7 L114.9 86.7 L116.0 87.1 L116.4 87.8 L116.4 88.8
  L115.8 89.7 L112.6 91.1 L112.8 91.5 L113.7 91.4 L115.3 91.9 L116.0 92.9 L115.6 94.1 L113.7 95.4
  L114.1 96.5 L114.1 97.6 L113.9 98.1 L112.7 99.0 L112.5 99.3 L115.2 102.8 L116.0 104.4 L116.0 105.1
  L115.4 105.8 L114.4 105.7 L111.7 102.9 L110.8 102.5 L109.8 102.5 L108.3 102.9 L108.3 103.6 L110.2 105.3
  L110.7 106.1 L110.2 108.6 L109.2 110.1 L107.7 111.3 L104.5 112.7 L103.0 112.9 L100.8 112.9 L99.4 112.4
  L98.8 111.8 L98.3 110.7 L97.5 110.3 L92.5 109.9 L92.0 110.1 L91.7 110.8 L91.6 113.4 L90.1 122.2
  L88.3 127.0 L88.2 129.1 L90.2 134.4 L90.5 135.9 L90.5 138.7 L90.8 139.4 L91.5 139.9 L93.1 140.4
  L94.0 141.3 L94.7 144.9 L97.3 150.3 L104.9 162.2 L109.8 171.7 L112.3 178.3 L114.8 188.2 L116.1 192.0
  L117.2 194.1 L118.0 196.7 L117.9 199.9 L115.8 207.7 L114.6 213.5 L114.3 217.5 L114.3 228.6 L114.0 232.7
  L113.1 237.8 L111.1 244.9 L109.8 250.9 L108.8 258.8 L108.3 269.6 L109.0 270.6 L110.9 271.4 L112.5 272.8
  L114.7 276.7 L116.9 278.4 L120.5 279.6 L123.2 278.9 L126.9 279.3 L127.8 279.8 L128.2 281.8 L128.8 282.7
  L129.5 282.9 L130.6 282.7 L131.9 282.8 L134.8 283.5 L135.6 283.9 L136.3 285.5 L136.1 287.8 L135.0 290.8
  L132.0 294.2 Z
  M116.1 295.1 L115.9 294.2 L107.6 292.7 L105.7 292.4 L93.0 292.4 L91.3 292.0 L90.2 291.0 L90.0 289.9
  L91.1 280.2 L91.9 278.2 L93.9 276.0 L94.3 275.3 L94.9 272.9 L95.4 269.2 L95.8 260.4 L95.5 252.0
  L94.9 243.4 L93.5 233.5 L93.7 230.2 L94.9 222.7 L94.9 218.5 L95.8 214.1 L95.8 212.4 L96.3 209.5
  L97.3 206.2 L97.2 205.1 L95.3 201.4 L91.4 196.1 L85.0 189.5 L75.4 180.9 L71.4 176.9 L69.0 173.8
  L67.0 170.7 L66.1 170.2 L64.5 171.3 L63.2 171.4 L59.8 170.2 L58.7 170.2 L55.5 175.4 L44.9 190.9
  L41.5 194.9 L38.4 197.8 L37.3 199.1 L31.8 209.2 L30.0 210.8 L27.7 212.0 L22.2 213.7 L21.3 214.3
  L12.0 224.9 L-4.0 242.1 L-7.3 246.0 L-8.8 248.3 L-9.9 250.9 L-12.8 261.1 L-12.7 261.4 L-12.2 261.4
  L-9.3 260.2 L-8.8 260.4 L-8.6 260.9 L-9.0 262.1 L-10.1 263.9 L-12.8 266.9 L-13.2 269.6 L-14.5 273.2
  L-15.2 276.6 L-15.5 280.7 L-14.6 286.6 L-14.6 290.4 L-15.0 292.5 L-15.8 294.1 L-15.8 295.1 Z`;

const RUN_M_MARATHON_TRACE = `M46.1 299.9 L31.8 299.9 L31.7 294.3 L31.2 293.2 L31.1 292.5 L32.1 287.1 L29.8 283.8 L28.8 281.2
  L28.8 280.1 L29.6 276.3 L30.9 272.0 L20.7 237.2 L21.2 219.0 L22.3 198.8 L20.3 188.0 L15.6 173.0
  L14.5 162.8 L13.7 160.5 L12.9 149.8 L12.9 142.1 L13.4 138.9 L14.1 136.7 L16.0 134.3 L16.6 132.9
  L19.3 118.9 L19.8 115.1 L19.9 111.9 L19.6 111.6 L19.0 112.2 L16.9 115.5 L15.2 120.5 L11.5 130.0
  L10.7 136.4 L10.1 138.3 L7.6 141.8 L3.2 145.7 L4.7 150.4 L4.5 152.6 L2.4 153.4 L0.6 152.7
  L-1.0 151.8 L-3.3 149.6 L-4.5 148.0 L-4.9 147.0 L-5.1 144.8 L-5.1 140.0 L-4.6 137.5 L-3.9 135.6
  L-1.7 133.2 L3.8 130.0 L4.7 129.0 L5.1 114.7 L6.2 96.1 L6.4 93.7 L8.6 90.4 L8.0 81.0
  L8.0 73.8 L5.9 68.4 L5.7 63.3 L5.9 61.6 L7.2 59.4 L9.0 57.7 L11.5 56.0 L26.4 49.0
  L29.6 48.0 L30.1 47.6 L31.1 44.6 L31.0 41.2 L30.7 40.3 L28.8 37.3 L28.2 34.9 L28.0 33.1
  L27.7 32.7 L26.5 32.1 L25.8 28.9 L25.8 26.8 L26.2 25.1 L25.3 16.5 L26.1 11.6 L26.5 9.7
  L28.0 6.9 L28.9 5.8 L31.9 3.2 L33.9 1.8 L36.0 0.7 L38.9 -0.1 L43.7 0.5 L45.6 1.1
  L47.2 1.9 L51.8 7.7 L55.5 10.3 L56.4 12.2 L56.6 13.5 L56.3 15.4 L54.6 21.1 L54.2 26.7
  L53.7 30.0 L53.1 31.8 L51.4 33.6 L50.9 34.8 L50.8 41.1 L51.4 43.5 L54.3 46.3 L59.7 48.5
  L67.8 52.5 L77.7 57.9 L83.4 63.0 L91.0 74.3 L96.9 84.7 L102.4 92.7 L104.6 97.9 L105.0 100.5
  L105.0 101.9 L104.8 102.4 L98.4 107.5 L92.3 113.4 L87.1 116.5 L83.0 118.2 L81.4 120.0 L80.1 122.5
  L77.4 124.4 L77.0 125.0 L77.2 130.5 L76.7 134.0 L78.2 138.4 L79.0 142.1 L79.2 145.1 L79.0 148.6
  L77.1 157.9 L74.3 167.1 L74.9 169.5 L74.9 171.0 L73.9 173.4 L72.5 175.8 L69.7 194.9 L66.4 204.1
  L69.2 211.4 L66.8 219.1 L67.5 225.0 L67.1 231.6 L65.0 242.8 L63.4 246.5 L61.2 249.6 L58.9 251.5
  L56.4 252.1 L54.2 252.2 L52.7 251.8 L51.7 251.1 L50.9 249.8 L50.3 247.9 L50.1 246.4 L50.1 242.1
  L50.9 235.5 L52.2 231.3 L55.6 222.5 L56.3 219.5 L55.3 217.3 L50.3 210.7 L49.7 209.5 L48.8 202.6
  L49.4 191.2 L46.1 169.8 L45.6 169.2 L45.2 169.9 L41.5 194.4 L41.7 231.0 L40.6 256.0 L40.1 261.5
  L42.3 266.1 L43.9 267.6 L46.2 271.2 L48.5 276.1 L48.4 277.0 L47.8 279.0 L46.8 280.9 L45.7 282.4
  L43.9 283.8 L44.5 285.3 L46.8 287.7 L48.0 290.8 L48.0 292.1 L47.6 293.1 L46.1 294.3 Z
  M78.3 107.1 L87.1 99.9 L89.3 97.9 L89.5 97.3 L89.1 96.6 L87.6 95.7 L86.2 94.3 L82.3 89.0
  L78.6 85.0 L77.4 84.0 L76.8 84.7 L74.8 91.7 L73.8 97.0 L73.7 99.8 L74.0 103.3 L74.7 105.7
  L77.4 107.0 Z`;

const RUN_W_RUN_TRACE = `M101.4 299.9 L-45.0 299.9 L-45.2 299.8 L-45.2 294.2 L-46.6 292.5 L-47.3 290.6 L-47.0 283.6 L-45.2 273.8
  L-42.0 265.4 L-38.8 254.5 L-37.2 252.1 L-33.9 248.2 L-30.8 245.1 L-28.3 242.9 L-23.9 239.3 L-18.9 235.9
  L-10.0 231.1 L-4.6 227.4 L1.4 224.2 L7.5 221.9 L15.7 219.6 L20.2 217.7 L22.2 216.1 L24.4 212.8
  L25.4 207.2 L26.1 200.1 L26.1 181.4 L26.9 174.6 L27.0 169.7 L25.3 161.9 L21.2 153.2 L19.8 145.9
  L19.7 141.8 L20.8 137.3 L22.4 133.5 L23.7 131.6 L29.3 124.8 L32.1 120.8 L34.2 116.7 L35.5 111.9
  L35.4 110.4 L33.8 106.9 L31.9 101.0 L28.1 88.2 L25.4 80.1 L23.3 71.4 L20.4 66.3 L16.3 60.3
  L15.4 59.5 L14.7 59.3 L12.0 59.1 L2.9 60.9 L-5.9 63.5 L-16.0 66.2 L-16.7 66.8 L-16.8 69.4
  L-14.9 81.6 L-13.4 86.1 L-8.5 97.3 L-7.5 98.7 L-5.5 99.8 L1.5 101.2 L3.1 102.1 L6.6 105.8
  L7.2 106.9 L7.6 108.7 L7.7 112.0 L7.4 112.6 L5.6 114.0 L1.8 116.0 L-4.3 117.7 L-7.7 117.7
  L-9.7 116.8 L-11.6 114.7 L-14.0 111.1 L-18.3 101.6 L-21.5 94.0 L-27.3 81.6 L-31.4 69.4 L-32.6 64.4
  L-33.1 60.2 L-31.4 58.1 L-28.5 55.7 L-23.2 52.9 L-16.6 49.9 L-10.4 47.8 L0.9 45.1 L10.7 40.8
  L18.3 38.9 L19.9 38.2 L20.6 37.4 L21.8 34.5 L23.3 32.1 L24.2 29.8 L24.7 26.7 L26.3 23.4
  L27.3 22.0 L29.5 20.1 L33.3 18.2 L34.5 17.3 L35.3 15.5 L36.6 10.3 L38.3 7.5 L40.3 5.6
  L46.7 1.8 L49.3 0.7 L52.0 0.1 L58.1 0.1 L61.0 0.9 L64.2 2.4 L67.3 4.4 L70.1 7.0
  L72.2 9.8 L73.5 12.2 L75.1 13.8 L77.1 14.8 L85.9 17.3 L86.8 17.9 L87.2 18.6 L87.2 20.1
  L86.6 21.5 L84.9 23.4 L83.3 24.4 L81.4 24.9 L79.7 25.0 L75.3 24.6 L74.1 24.6 L73.5 24.8
  L73.2 26.0 L74.5 32.4 L74.4 33.1 L73.9 33.8 L71.8 34.3 L70.8 35.1 L70.6 35.9 L68.3 40.1
  L67.5 43.0 L66.7 43.7 L65.9 44.1 L59.7 42.8 L57.8 42.8 L55.7 43.5 L54.8 44.4 L54.1 45.8
  L53.5 48.2 L52.9 52.4 L53.9 54.0 L58.3 58.1 L61.6 60.6 L65.9 63.2 L69.2 66.8 L74.2 74.2
  L75.8 76.2 L78.7 79.0 L87.4 85.7 L94.7 93.2 L96.9 94.4 L98.6 94.7 L103.4 92.9 L115.8 87.3
  L119.9 84.8 L128.3 78.9 L130.8 76.3 L132.0 74.0 L132.2 66.8 L136.6 59.2 L137.6 57.8 L138.2 57.4
  L138.9 57.8 L139.7 59.9 L141.4 61.2 L142.8 63.2 L146.3 69.5 L147.0 71.7 L147.1 73.7 L146.3 76.3
  L144.3 78.9 L142.5 80.6 L135.8 85.6 L130.1 89.1 L119.9 96.8 L114.6 100.6 L104.9 106.6 L98.4 109.9
  L97.4 110.0 L95.8 109.7 L90.9 107.1 L84.9 103.3 L75.4 96.0 L69.8 92.1 L68.1 91.2 L67.5 91.3
  L67.2 91.7 L67.2 93.0 L68.3 98.7 L68.3 100.3 L67.9 102.4 L65.1 110.0 L64.4 114.4 L64.5 116.5
  L65.8 121.7 L66.2 124.4 L66.1 127.0 L65.4 130.2 L65.6 132.3 L66.1 134.2 L68.6 140.0 L71.5 147.7
  L73.6 151.7 L77.6 157.3 L83.1 163.9 L85.2 166.8 L91.3 174.2 L95.8 180.0 L99.3 185.7 L104.7 193.2
  L106.1 196.3 L107.0 199.1 L107.4 201.3 L107.4 206.0 L106.8 210.4 L105.7 214.2 L105.2 218.3 L104.3 228.0
  L103.6 241.3 L103.7 248.2 L105.6 258.0 L106.0 263.3 L105.8 268.0 L104.9 271.9 L104.9 274.9 L105.5 278.5
  L106.1 280.1 L106.8 280.6 L112.6 279.9 L115.0 279.3 L119.0 279.5 L122.5 279.3 L123.5 279.5 L124.5 280.2
  L125.1 281.4 L125.0 283.8 L123.4 287.2 L121.6 289.2 L118.5 291.4 L116.2 291.9 L112.4 291.8 L107.5 292.4
  L103.3 293.3 L101.6 294.2 Z
  M92.0 295.1 L92.0 294.2 L90.2 292.7 L89.5 291.1 L88.9 288.6 L88.9 286.0 L90.1 278.3 L90.2 276.0
  L88.7 263.0 L87.0 256.1 L84.2 248.2 L83.4 245.4 L80.8 231.5 L80.9 227.3 L83.8 215.1 L83.9 212.6
  L83.5 210.7 L82.4 208.3 L81.3 206.7 L75.3 200.5 L66.1 193.3 L61.9 190.8 L60.6 191.4 L59.3 193.1
  L57.6 197.7 L55.1 207.5 L53.5 212.3 L48.6 223.8 L45.7 229.4 L44.6 230.8 L40.8 234.5 L37.8 236.8
  L35.2 237.6 L31.5 239.7 L26.9 242.0 L18.1 244.9 L1.9 248.8 L-4.3 250.6 L-8.6 252.5 L-12.9 255.5
  L-19.6 260.7 L-21.4 262.3 L-22.8 264.1 L-27.6 274.2 L-31.9 286.3 L-33.9 290.6 L-35.2 292.4 L-36.6 293.3
  L-38.8 294.2 L-38.9 294.5 L-38.9 295.1 L-38.6 295.1 Z`;

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
             sheet actually cut, over the blade height squared: Ball gown 0.62
             (it is cut smaller to stand inside its base), Train 0.53, Evening
             0.52, Sweep 0.53. That is base ~ 2.31w + 0.03.
             The Sweep was 1.75 while it was the fan skirt, which was 0.73 wide;
             the column gown that replaced it needs far less sheet. */
          bases: [1.46, 1.26, 1.24, 1.26] },
  gent: { path: GENT_TRACE },
  lady: { path: LADY_TRACE },
  suit: { path: SUIT_TRACE },
  /* One Volleyball shape: the men's pose 0, the women's 1. `groups` drives the
     Men / Women toggle; the pose row shows one group at a time. */
  volley: { paths: [VOLLEY_M_SPIKE_TRACE, VOLLEY_W_SPIKE_TRACE],
            names: ['Spike', 'Spike'],
            groups: [{ label: 'Men', from: 0, to: 1 }, { label: 'Women', from: 1, to: 2 }],
            /* priced by the sheet cut, 2.31w + 0.03 with 1.26 as the floor:
               w 0.66 for both spikes */
            bases: [1.55, 1.54] },
  box: { paths: [BOX_VICTORY_TRACE, BOX_GUARD_TRACE, BOX_STANCE_TRACE, BOX_READY_TRACE],
         names: ['Victory', 'Guard', 'Stance', 'Ready'] },
  foot: { paths: [FOOT_STANCE_TRACE, FOOT_DRIBBLE_TRACE, FOOT_CELEBRATE_TRACE],
          names: ['Stance', 'Dribble', 'Celebrate'],
          /* Sheet is bought by the rectangle, so a sprawling pose costs more
             than a compact one. Priced per pose, not per shape: 1.53w + 0.45,
             the rate the first poses were set at, with 1.26 as the floor --
             a figure is never cheaper to cut than a plaque. Stance 0.40,
             Dribble 0.52, Celebrate 0.61. */
          bases: [1.26, 1.26, 1.38] },
  /* Athletics, men's poses 0-1 and the women's 2. Priced like the football
     poses, 1.53w + 0.45, with 1.26 as the floor.

     Every `bases` here prices the sheet a pose really uses. fitFigure stands
     a figure with its feet in the middle of its base and cuts it smaller if it
     would reach past the base, so a sprawling or lopsided pose uses less sheet
     than its drawing suggests: w here is the blade's own rectangle at the
     medium size, width x height, over the full blade height squared.
     tests/figure-fit.js lists the poses that are cut smaller, and by how much. */
  run: { paths: [RUN_M_RUN_TRACE, RUN_M_MARATHON_TRACE, RUN_W_RUN_TRACE],
         names: ['Run', 'Marathon', 'Run'],
         groups: [{ label: 'Men', from: 0, to: 2 }, { label: 'Women', from: 2, to: 3 }],
         /* Run 0.58, Marathon 0.37, women's Run 0.66 */
         bases: [1.34, 1.26, 1.46] },
  grad: { path: GRAD_TRACE },
  ball: { paths: [BALL_POINT_TRACE, BALL_JUMPSHOT_TRACE, BALL_SHOOT_TRACE],
          names: ['Point', 'Jump shot', 'Layup'],
          /* Sheet actually cut, over the blade height squared: Point 0.36,
             Jump shot 0.21, Layup 0.54 -- priced at the old basketball rate of
             1.26 for 0.40, with 1.26 as the floor. */
          bases: [1.26, 1.26, 1.69] },
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
  ball:     { label: 'Basketball',build: ballShape,     base: 1.26, decal: { onBase: true },              note: 'Dribble, jump shot, layup or pass. The liga favourite.' },
  suit:     { label: 'Suit',       build: suitShape,    base: 1.26, decal: { onBase: true },              note: 'Man in a suit, arms at his sides. The partner to the Dress figure.' },
  volley:   { label: 'Volleyball',build: volleyShape,  base: 1.26, decal: { onBase: true },              note: "A spike, men's or women's. The school and liga favourite." },
  box:      { label: 'Boxing',    build: boxShape,      base: 1.26, decal: { onBase: true },              note: 'Four poses to pick from. For boxing and arnis tournaments.' },
  foot:     { label: 'Football',  build: footShape,     base: 1.28, decal: { onBase: true },              note: 'Three poses to pick from. Also used for futsal.' },
  run:      { label: 'Athletics', build: runShape,      base: 1.26, decal: { onBase: true },              note: "Sprinting at you, or breaking the tape. Covers track, fun runs and Palaro." },
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

  const rings = pieces(shape).flatMap(s => [s, ...(s.holes || [])]).map(r => r.getPoints(170));
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

/* ONE shield outline, shared by the cut sticker, its printed keyline and the
   text fitting. They used to be three different shields: the cut one even
   curved back on itself, which left ragged slivers down its sides, and the
   wording was sized for the full width while the shield narrows to a point.
   Normalised: u -1..1 across, v 0 (top) .. 1 (point). */
const SH = { r: 0.10, shoulder: 0.40, c1: [1, 0.74], c2: [0.56, 0.93] };
function shieldTrace(P, u0, v0, cw, ch) {
  // P = { move, line, quad, bez } in some space; (u0,v0) maps the outline
  const X = u => u0 + u * cw, Y = v => v0 + v * ch;
  const r = SH.r, k = SH.shoulder, [a, b] = SH.c1, [c, d] = SH.c2;
  P.move(X(-1 + r), Y(0));
  P.line(X(1 - r), Y(0));
  P.quad(X(1), Y(0), X(1), Y(r * 0.8));
  P.line(X(1), Y(k));
  P.bez(X(a), Y(b), X(c), Y(d), X(0), Y(1));
  P.bez(X(-c), Y(d), X(-a), Y(b), X(-1), Y(k));
  P.line(X(-1), Y(r * 0.8));
  P.quad(X(-1), Y(0), X(-1 + r), Y(0));
}
/* half-width (0..1) of the shield at depth v, for fitting each line of text */
function shieldHalfWidth(v) {
  const k = SH.shoulder;
  if (v <= k) return 1;
  const [a, b] = SH.c1, [c, d] = SH.c2;
  const B = (t, p0, p1, p2, p3) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (B(m, k, b, d, 1) < v) lo = m; else hi = m; }
  return Math.max(0, B((lo + hi) / 2, 1, a, c, 0));
}

function shieldDecalShape(w, h) {
  const s = new THREE.Shape();
  shieldTrace({
    move: (x, y) => s.moveTo(x, y), line: (x, y) => s.lineTo(x, y),
    quad: (a, b, x, y) => s.quadraticCurveTo(a, b, x, y),
    bez: (a, b, c, d, x, y) => s.bezierCurveTo(a, b, c, d, x, y),
  }, 0, h / 2, w / 2, -h);                  // three's y runs up: v=0 is the top edge
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
    shieldTrace({
      move: (a, b) => g.moveTo(a, b), line: (a, b) => g.lineTo(a, b),
      quad: (a, b, c, d) => g.quadraticCurveTo(a, b, c, d),
      bez: (a, b, c, d, e, f) => g.bezierCurveTo(a, b, c, d, e, f),
    }, W / 2, y, w / 2, h);
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

function lineWidth(g, text, px, family, weight = '400', spacing = 0) {
  g.font = `${weight} ${px}px ${family}`;
  return [...text].reduce((a, ch) => a + g.measureText(ch).width, 0)
       + spacing * px * Math.max(0, text.length - 1);
}

/* Shrinks until the line fits. The floor used to be 40% of the planned size,
   which on a narrow sticker meant "give up and run off the edge"; a long line
   is now wrapped first (see stickerCanvas), so this floor is a last resort. */
function fitFont(g, text, maxW, startPx, family, weight = '400', spacing = 0) {
  let px = startPx;
  for (let i = 0; i < 60; i++) {
    if (lineWidth(g, text, px, family, weight, spacing) <= maxW || px <= startPx * 0.15) break;
    px *= 0.95;
  }
  return px;
}

/* Two lines from one, broken at the space that leaves them most even. */
function splitEven(text) {
  const words = text.split(/\s+/);
  let best = [text], worst = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const m = Math.max(a.length, b.length);
    if (m < worst) { worst = m; best = [a, b]; }
  }
  return best;
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

/* A real laurel wreath: two branches curving up either side, a thin stem
   and pointed leaves set alternately along it. The old one stacked ellipses
   on top of each other and printed as a gold blob. Filled in one go by the
   caller, so leaves and stems are separate sub-paths that never overlap. */
function laurelPath(g, cx, cy, r) {
  g.beginPath();
  const R = r * 0.86, ccx = cx, ccy = cy + r * 0.04;
  const leaf = (x, y, ang, L, Wd) => {          // an almond, base at (x,y), pointing along ang
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    const tx = x + ux * L, ty = y + uy * L;
    g.moveTo(x, y);
    g.quadraticCurveTo(x + ux * L * 0.5 + nx * Wd, y + uy * L * 0.5 + ny * Wd, tx, ty);
    g.quadraticCurveTo(x + ux * L * 0.5 - nx * Wd, y + uy * L * 0.5 - ny * Wd, x, y);
    g.closePath();
  };
  for (const dir of [-1, 1]) {
    // canvas angles, y down: the branch climbs from just off the bottom to near the top
    const a0 = Math.PI / 2 + dir * -0.28, a1 = Math.PI / 2 + dir * -2.55;
    // stem: a thin ring segment
    const sw = r * 0.035;
    g.moveTo(ccx + (R + sw) * Math.cos(a0), ccy + (R + sw) * Math.sin(a0));
    g.arc(ccx, ccy, R + sw, a0, a1, dir > 0);
    g.arc(ccx, ccy, R - sw, a1, a0, dir < 0);
    g.closePath();
    const N = 7;
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      const a = a0 + (a1 - a0) * t;
      const px = ccx + R * Math.cos(a), py = ccy + R * Math.sin(a);
      const tangent = a - dir * Math.PI / 2;     // direction of growth, up the branch
      const L = r * (0.40 - t * 0.12), Wd = L * 0.30;
      leaf(px, py, tangent - dir * 0.62, L, Wd);  // outer leaf
      if (i < N - 1) leaf(px, py, tangent + dir * 0.55, L * 0.82, Wd * 0.85);  // inner leaf
    }
    // a berry-like bud at the tip
    const ta = a1 - dir * 0.10;
    g.moveTo(ccx + R * Math.cos(ta) + r * 0.07, ccy + R * Math.sin(ta));
    g.arc(ccx + R * Math.cos(ta), ccy + R * Math.sin(ta), r * 0.07, 0, Math.PI * 2);
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
  const isShield = cfg.decal === 'shield';
  const padY = H * (round ? 0.17 : isShield ? 0.10 : 0.11);
  let top = padY;
  let room = isShield ? H * 0.80 - padY : H - padY * 2;   // a shield's point holds no text
  /* the width a line may use between its top and bottom; a shield narrows */
  const widthAt = (y0, y1) => {
    if (!isShield) return safe;
    const ins = 0.082;                                     // inside the inner keyline
    const v = y => Math.min(1, Math.max(0, (y / H - ins) / (1 - ins * 2)));
    const hw = Math.min(shieldHalfWidth(v(y0)), shieldHalfWidth(v(y1)));
    return Math.max(W * 0.2, (hw * (W / 2 - W * ins) - W * 0.035) * 2);
  };

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
    const sumUnits = () => rows.reduce((u, r, i) =>
      u + r.rel * LH * r.lines.length + (i ? rows[i - 1].rel * GAP : 0) + (r.rule && i ? RULE : 0), 0);
    // cap so a tall sticker with one line does not render absurdly large
    const scale = () => Math.min(room / sumUnits(), H * 0.26);

    /* A long line on a narrow sticker -- PARTNER OF THE YEAR on a portrait
       blade -- used to shrink to a floor of 40% and then simply run off both
       edges. A line that would have to shrink below 60% of its planned size is
       now broken in two at the most even space, and the block is re-fitted;
       whatever still does not fit shrinks until it does. */
    rows.forEach(r => { r.lines = [r.t]; });
    let k = scale();
    let wrapped = false;
    rows.forEach(r => {
      if (!/\s/.test(r.t)) return;
      const planned = r.rel * k;
      if (lineWidth(g, r.t, planned, r.fam, r.wt, r.track) > safe / 0.6) {
        r.lines = splitEven(r.t);
        wrapped = true;
      }
    });
    if (wrapped) k = scale();
    let cursor = top + (room - sumUnits() * k) / 2;

    rows.forEach((r, i) => {
      if (i) cursor += rows[i - 1].rel * GAP * k;
      if (r.rule && i) {
        g.fillStyle = rule;
        g.fillRect(W / 2 - safe * 0.16, cursor + RULE * k * 0.45, safe * 0.32, Math.max(1.5, H * 0.008));
        cursor += RULE * k;
      }

      const planned = r.rel * k;
      // the halves of a wrapped line share one size, or they read as two lines of different rank
      const fitPx = r.lines.map((line, j) => fitFont(g, line,
        widthAt(cursor + planned * LH * j, cursor + planned * LH * (j + 1)), planned, r.fam, r.wt, r.track));
      const px = Math.min(...fitPx);
      /* A single line keeps its slot as before. Wrapped lines are spaced by
         the size they were actually set at, not the size planned, and the pair
         is centred in the space the row was given -- or a shrunk title gapes. */
      const n = r.lines.length;
      const step = n > 1 ? px * LH : planned * LH;
      let top = cursor + (n > 1 ? (planned - px) * LH * n / 2 : 0);
      for (const line of r.lines) {
        g.font = `${r.st} ${r.wt} ${px}px ${r.fam}`.trim();
        g.fillStyle = r.col;
        const baseline = top + (n > 1 ? px : planned) * 0.82;
        if (r.track) {
          tracked(g, line, W / 2, baseline, px * r.track);
        } else {
          g.fillText(line, W / 2 - g.measureText(line).width / 2, baseline);
        }
        top += step;
      }
      cursor += planned * LH * n;
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
           org: 'Mutya ng Gloria', title: '1st Runner-Up', name: 'Maria C. Lualhati', date: '2026' },
  },
  liga: {
    label: 'Sports / Liga', hint: 'Basketball, volleyball, athletics',
    cfg: { shape: 'shield', material: 'blue', size: 'm', baseKind: 'goldbar', baseFinish: 'black',
           decal: 'shield', scheme: 'navy', laminate: 'gloss', font: 'sport', motif: 'laurel',
           org: 'Barangay Liga 2026', title: 'Champion', name: "Men's Basketball", date: 'Gloria' },
  },
  school: {
    label: 'School awards', hint: 'Recognition day, honour roll',
    cfg: { shape: 'arch', material: 'white', size: 'm', baseKind: 'block', baseFinish: 'black',
           decal: 'rect', scheme: 'white', laminate: 'matte', font: 'classic', motif: 'star',
           org: 'Gloria NHS', title: 'Most Outstanding', name: 'Juan D. Reyes', date: 'SY 2025 – 2026' },
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
  const list = Array.isArray(shape) ? shape : [shape];
  const check = g => {
    g.computeBoundingBox();
    const b = g.boundingBox;
    return b && Number.isFinite(b.min.x) && Number.isFinite(b.max.y) &&
           b.max.y - b.min.y > 1e-4 && g.attributes.position.count > 0;
  };
  let geo = new THREE.ExtrudeGeometry(list, opts);
  if (check(geo)) return geo;

  geo.dispose();
  if (list.some(s => s.holes && s.holes.length)) {
    console.warn('[tala] interior cuts would not triangulate; cutting the outline only');
    const bare = list.map(s => { const b = s.clone(); b.holes = []; return b; });
    geo = new THREE.ExtrudeGeometry(bare, opts);
    if (check(geo)) return geo;
    geo.dispose();
  }
  console.warn('[tala] outline would not extrude; falling back to the arch');
  return new THREE.ExtrudeGeometry(SHAPES.arch.build(6.8, 17.8), opts);
}

/* A figure stands IN THE MIDDLE of its base: its feet go on the centre line,
   the way a real trophy figure is pinned through the middle of its base. If,
   standing there, any part of it would reach past the end of the base, the
   whole figure is cut smaller until it fits. In the owner's words: "always
   make sure it's in the middle, not on the side -- and if it's larger than
   the base, minimise it to maintain balance".

   Two earlier rules are gone and should stay gone. Centring the figure's
   centre of mass put a one-footed pose's foot at the END of the base (the
   overhead pass, the dribbler, every runner), and growing the base to reach
   that foot gave a lunge a 25 cm base under a 19 cm trophy. Holding a wide
   pose to the base's width but leaving its feet where they fell still stood
   the sprinter on the corner of his base. Feet in the middle, size to fit:
   a compact pose stays full height, a sprawling one is cut smaller.

   Returns the cut, the blade height it was cut at, and bx: how far along the
   cut the feet are, so the blade can be slid back by that much. */
const FIG_EDGE = 0.15;   // base kept clear past the figure's furthest reach, as a share of the blade width
const baseWidth = w => w * 2 * 0.86 + 2.8;    // a base's nominal width, for a blade w wide

function fitFigure(shape, w, h, variant) {
  let cut = shape.build(w, h, variant);
  if (!cut) return { cut, h, bx: 0 };
  const place = () => {
    const pts = pieces(cut).flatMap(r => r.getPoints(160));
    const ys = pts.map(p => p.y);
    const bot = Math.min(...ys), span = Math.max(...ys) - bot;
    // the feet: the tab and the soles on it, the bottom 3% of the piece
    const feet = pts.filter(p => p.y <= bot + span * 0.03).map(p => p.x);
    const mid = (Math.min(...feet) + Math.max(...feet)) / 2;
    const xs = pts.map(p => p.x);
    return { mid, reach: Math.max(mid - Math.min(...xs), Math.max(...xs) - mid) };
  };
  let at = place();
  const room = baseWidth(w) / 2 - w * FIG_EDGE;
  if (at.reach > room) {
    h *= room / at.reach;          // pathToShape scales about one point, so once is exact
    cut = shape.build(w, h, variant);
    at = place();
  }
  return { cut, h, bx: at.mid };
}

/* How tall a trophy really stands, in cm: its size's full height, or less for
   a figure cut smaller to stand inside its base. The size tiles quote the full
   height; the summary, the order sheet and the admin quote this one. */
export function standingHeight(cfg) {
  const shape = SHAPES[cfg.shape] || SHAPES.arch;
  const size = SIZES[cfg.size] || SIZES.m;
  if (!shape.decal.onBase) return size.total;
  const bh = size.baseH * 1.35;
  return bh + fitFigure(shape, size.w, size.total - bh, cfg.variant).h;
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
     Blade height makes up the advertised total, unless a figure has to be cut
     smaller to stand inside its base. */
  const onBase = !!shape.decal.onBase;
  const bh = size.baseH * (onBase ? 1.35 : 1);
  let h = size.total - bh;

  /* A figure stands in the middle of its base, cut smaller if it would reach
     past it -- see fitFigure. Pieces that are not figures keep the old rule
     below: the base widens to reach anything that touches down. */
  let cut, bx = 0, bw = baseWidth(w);
  if (onBase) ({ cut, h, bx } = fitFigure(shape, w, h, cfg.variant));
  else cut = shape.build(w, h, cfg.variant);
  if (cut && !onBase) {
    const pts = pieces(cut).flatMap(r => r.getPoints(240));
    const ys = pts.map(p => p.y);
    const bot = Math.min(...ys), span = Math.max(...ys) - bot;
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
  const geo = safeExtrude(pieces(cut), {
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
  /* Seated into the base: a figure's mounting tab is exactly h * 0.015 deep
     (TAB in polish-figure.py). The bevel swells every edge by `bevel`, the
     top of the tab included, so it sinks that much more. And polish-figure.py
     sets whatever comes within `band` (0.4% of the height) of the ground line
     down onto it, so a toe or a hem that nearly touches stands on a shelf that
     deep: a light strip showed beside the Lady's shoe, along the gown's hem and
     behind the runner's back toe until the figure sank by that much as well. */
  blade.position.y = baseTop - h * 0.015 - (onBase ? h * 0.0045 + bevel * 1.5 : 0);
  blade.position.x = -bx;                   // the feet on the centre line
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
    const artGeo = safeExtrude(pieces(shape.build(aw, ah, cfg.variant)), {
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
    artMesh.position.set(-bx, blade.position.y + (h - ah) / 2, faceZ + 0.004);
    artMesh.name = 'figurePhoto';
    group.add(artMesh);
  }

  /* "Your art" cut from the customer's picture, with the picture printed on
     it (print-and-cut). cutout.js crops the picture to exactly the traced
     outline's box, so mapping the texture through the cut's own bounding box
     lines picture and edge up; the background is transparent, and alphaTest
     drops it, so nothing prints past the cut. */
  if (cfg.shape === 'custom' && cfg.cutArt && cfg.cutPrint) {
    const artGeo = safeExtrude(pieces(shape.build(w, h, cfg.variant)), {
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
    printed.position.set(-bx, blade.position.y, faceZ + 0.004);
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
  pickup:   { label: 'Studio pickup',      fee: 0,   per: 0,  days: 0, hint: 'Gloria, Oriental Mindoro' },
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

/* Owner, 30 Oct 2026: acrylic sheet is expensive, and below about ₱500 a single
   trophy -- often shipped on its own -- earns nothing. So the base roughly
   doubled, and no trophy is ever quoted under MIN_UNIT a piece, at any
   quantity. Still estimates until the owner gives real prices to match. */
const UNIT_BASE = 320;          // small acrylic blade + one printed sticker + plain block
const MIN_UNIT = 500;
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

  const unit = Math.max(MIN_UNIT, Math.round(((materialCost + extras) * speed.mult * tier.mult) / 5) * 5);
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
