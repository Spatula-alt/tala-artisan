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
   trace-figure.py and photos of the shop's own pieces); the edge is smoothed.
   A ball is kept only where the drawing has it in a hand or under a boot, so
   it is cut with the player: never floating, never joined on by a bar (the
   owner's rules, 2-3 Nov). Everything below the ground line becomes a mounting tab
   exactly 1.5% of the height --
   the depth buildTrophy sinks every blade into its base. So the feet stand ON
   the base, whole, and the tab is out of sight. 300 tall with the tab, y DOWN. */

/* Every figure is PRINTED IN FULL COLOUR -- face, skin, hair and clothes -- and
   cut to the drawing's own outline: the owner's choice on 3 Nov, first for the
   sports figures, then "all other figures as well". Each _ART beside a _TRACE is
   the drawing beside the site and its corners in the cut's frame (polish-figure.py,
   step 9).
     Gentleman  Pixabay 9485368, a maroon tuxedo and bow tie
     Lady       Pixabay 10047391, a red tulle dress
     Suit       Pixabay 9519573, a grey suit and pink tie
     Gowns      0 Ball gown 10444304, 1 Train 10045082, 2 Evening 10043606,
                3 Off-shoulder 10432666
     Graduate   men 0 Pixabay 8905717; women 1 Pixabay 10443995
   Before this the Gentleman was a black silhouette retraced from the owner's
   couple picture with the shirt and tie printed white, and the Lady and the
   Suit were traced off the shop's own acrylic pieces. Drawn 300 tall, y down. */
const GENT_TRACE = `M36.6 299.9 L24.1 299.9 L24.0 294.3 L22.9 293.1 L22.6 292.3 L22.6 290.8 L23.2 288.3 L24.2 286.7
  L27.4 282.8 L29.4 278.5 L29.9 276.5 L28.7 275.2 L28.2 274.2 L24.6 262.5 L23.6 257.7 L22.6 250.6
  L21.4 238.4 L20.3 223.3 L19.6 192.3 L17.6 173.9 L17.0 173.2 L13.7 172.2 L10.9 170.8 L10.1 170.2
  L7.2 162.9 L7.5 155.7 L7.0 153.7 L7.0 151.4 L6.1 150.2 L5.3 148.5 L4.8 146.6 L4.6 144.2
  L4.4 137.3 L3.8 131.4 L3.3 122.7 L3.2 111.8 L3.6 108.2 L4.4 103.8 L4.6 97.5 L6.2 76.8
  L10.1 54.3 L10.7 53.4 L11.3 53.0 L13.2 52.5 L18.5 50.4 L30.3 44.5 L32.1 42.9 L33.6 40.9
  L33.8 40.1 L32.6 38.9 L30.5 32.5 L29.5 25.8 L30.1 21.6 L28.5 17.7 L29.5 15.2 L29.4 13.3
  L30.8 9.8 L30.1 8.2 L30.5 6.5 L30.5 4.5 L31.0 3.7 L32.2 2.8 L36.8 0.9 L39.9 0.2
  L45.3 -0.1 L47.2 0.5 L50.0 1.7 L53.0 3.4 L55.5 5.8 L58.2 7.8 L59.7 9.4 L60.5 10.8
  L60.6 11.9 L60.0 14.6 L58.1 19.4 L57.0 23.5 L55.1 28.9 L54.2 32.3 L54.1 34.7 L54.4 36.1
  L55.9 38.9 L59.7 42.7 L62.4 44.7 L73.0 49.1 L80.4 51.5 L81.5 53.0 L82.5 55.6 L85.3 68.7
  L85.5 70.6 L85.0 72.9 L85.0 74.3 L86.1 77.6 L87.5 84.2 L89.4 91.4 L92.9 101.6 L94.8 111.4
  L96.2 128.7 L96.7 145.6 L95.8 148.4 L95.8 150.1 L96.5 156.3 L95.2 161.4 L93.9 162.5 L92.8 163.9
  L90.8 165.2 L86.8 167.0 L83.7 167.9 L83.1 167.9 L82.4 167.3 L82.4 166.6 L82.8 165.7 L84.5 163.9
  L86.1 161.8 L86.4 159.8 L87.4 156.5 L86.8 155.5 L86.3 155.2 L85.9 155.4 L85.1 158.1 L84.8 160.7
  L84.0 162.8 L82.8 163.6 L82.2 163.6 L81.4 162.9 L81.7 160.5 L81.5 158.0 L81.8 156.9 L81.8 153.8
  L81.5 152.7 L83.8 146.9 L83.7 145.8 L84.2 143.2 L84.1 142.1 L84.1 134.0 L83.9 132.0 L82.9 128.1
  L81.4 125.0 L81.0 121.7 L79.5 117.4 L78.4 110.5 L76.8 107.2 L75.7 101.6 L74.2 96.1 L73.6 92.6
  L72.9 91.5 L72.1 92.3 L71.3 96.3 L71.5 101.4 L74.4 121.7 L77.0 135.1 L77.5 138.9 L78.2 149.8
  L78.2 151.8 L77.9 153.2 L78.6 156.6 L78.0 159.3 L78.0 161.1 L79.8 170.2 L80.1 173.1 L80.1 180.7
  L79.6 191.8 L79.8 204.0 L79.3 209.6 L78.6 212.7 L78.6 215.4 L76.8 221.8 L69.3 255.5 L68.6 260.0
  L68.6 263.4 L68.4 265.1 L68.0 265.9 L67.0 266.7 L67.4 269.6 L68.4 273.1 L68.5 274.8 L71.1 279.7
  L71.7 281.7 L71.9 283.0 L71.9 286.7 L71.6 287.5 L70.9 288.1 L69.2 288.5 L67.0 288.5 L61.3 287.4
  L58.3 286.0 L57.2 284.6 L56.7 283.4 L56.0 276.6 L55.4 274.4 L55.0 273.9 L53.8 273.7 L52.9 273.1
  L50.8 270.0 L49.8 267.9 L49.8 267.0 L50.9 264.6 L51.3 262.3 L52.1 260.4 L52.3 259.1 L53.4 256.4
  L54.1 251.8 L55.7 247.5 L56.1 245.5 L56.5 244.9 L57.8 243.8 L58.4 242.2 L58.7 236.4 L60.3 223.2
  L61.2 209.3 L60.8 205.3 L58.9 195.6 L54.5 178.5 L49.2 160.3 L47.5 156.8 L46.8 156.2 L46.3 156.2
  L45.9 156.6 L45.2 159.2 L40.2 183.6 L38.9 194.9 L37.6 213.2 L37.6 218.5 L38.0 220.6 L38.8 222.9
  L39.0 224.6 L39.1 237.4 L40.0 247.3 L40.0 254.4 L40.4 255.9 L42.7 261.3 L43.9 265.3 L44.3 267.5
  L44.2 275.4 L43.6 276.9 L42.9 277.6 L43.9 280.6 L44.0 282.9 L43.4 285.1 L43.3 288.3 L41.5 289.3
  L39.1 289.7 L38.8 290.0 L38.6 291.9 L38.2 292.9 L36.7 294.2 Z`;

const LADY_TRACE = `M33.7 299.9 L19.5 299.9 L19.5 294.2 L19.1 291.5 L22.0 286.7 L24.1 282.4 L25.8 277.0 L27.2 270.5
  L29.8 264.2 L30.1 262.1 L31.4 260.3 L33.0 255.5 L34.1 251.1 L35.1 245.6 L37.1 229.7 L36.4 229.1
  L31.9 228.4 L26.2 226.7 L25.6 226.8 L24.3 228.1 L22.6 228.4 L19.5 228.2 L15.0 227.0 L9.0 224.8
  L7.7 223.9 L7.8 222.4 L7.1 221.8 L-0.8 218.8 L-2.5 217.8 L-2.9 216.9 L-2.6 213.0 L-3.3 212.3
  L-7.0 210.9 L-8.4 210.1 L-9.3 209.1 L-9.3 208.2 L-5.5 198.6 L-0.7 187.8 L7.4 171.6 L11.2 161.0
  L18.4 138.9 L25.6 119.7 L26.2 112.1 L27.1 107.3 L29.0 99.7 L29.5 95.1 L29.3 87.3 L28.4 77.4
  L27.9 76.6 L26.6 76.0 L24.9 74.7 L22.0 73.4 L21.6 73.0 L21.4 71.7 L21.0 70.9 L18.6 69.1
  L18.3 68.1 L21.8 64.8 L23.8 62.4 L25.7 59.7 L27.7 55.3 L29.7 53.0 L30.7 52.3 L32.9 51.3
  L37.5 50.1 L40.9 48.3 L41.4 47.7 L40.8 46.5 L39.3 45.6 L38.7 44.7 L37.8 41.9 L37.5 39.7
  L38.3 36.9 L39.5 34.3 L40.0 32.4 L40.0 29.9 L39.2 27.0 L39.5 26.4 L39.6 22.6 L40.6 18.8
  L40.4 18.1 L42.2 15.2 L42.9 13.6 L43.6 11.2 L45.2 8.2 L46.3 5.5 L48.4 4.0 L49.9 2.4
  L51.7 1.6 L53.1 1.5 L55.2 0.1 L56.6 -0.1 L57.7 0.3 L60.3 0.2 L64.3 1.8 L68.1 3.8
  L70.3 5.8 L72.0 8.1 L73.0 10.1 L74.4 15.4 L75.5 17.5 L75.6 18.8 L77.2 21.8 L80.1 24.9
  L81.6 27.3 L82.0 29.0 L82.0 32.0 L81.3 33.4 L80.6 33.9 L80.6 34.8 L81.5 35.6 L84.7 36.5
  L85.9 37.6 L86.4 38.5 L86.5 40.6 L86.3 41.5 L85.6 42.4 L85.8 40.2 L85.1 38.7 L83.6 37.7
  L80.6 37.2 L80.8 37.7 L82.9 39.5 L83.8 40.9 L84.1 41.9 L84.1 43.6 L83.6 45.2 L83.8 45.7
  L85.3 47.1 L87.2 50.1 L88.1 51.0 L92.4 53.1 L96.9 54.7 L97.5 55.1 L97.1 57.1 L95.7 59.6
  L95.8 60.6 L96.7 61.7 L96.4 62.6 L93.6 65.7 L92.0 66.6 L89.4 68.9 L88.9 69.7 L88.5 90.6
  L90.1 98.7 L90.6 102.7 L90.6 125.2 L91.2 129.9 L91.3 133.0 L94.3 142.1 L94.5 147.0 L94.1 148.1
  L94.1 148.7 L94.9 149.4 L95.9 151.4 L97.3 155.5 L97.7 155.7 L99.9 155.6 L100.7 156.3 L105.2 172.9
  L105.4 175.1 L104.8 176.1 L103.7 176.5 L99.4 177.3 L99.0 177.7 L99.0 178.3 L105.2 200.6 L108.9 215.0
  L109.2 216.9 L108.1 218.1 L105.2 219.3 L105.0 219.9 L105.2 221.5 L104.6 222.2 L99.2 225.6 L96.0 227.2
  L92.9 228.3 L89.9 228.9 L86.4 228.9 L85.1 228.1 L84.9 226.5 L84.3 225.8 L82.0 225.6 L78.6 226.6
  L78.2 227.1 L78.2 228.6 L77.8 229.0 L75.1 230.0 L73.6 230.1 L72.9 229.9 L72.4 228.3 L71.8 227.9
  L64.7 229.5 L60.4 229.8 L60.0 230.0 L59.8 230.6 L59.8 244.8 L60.5 257.7 L61.1 260.8 L62.6 262.4
  L65.3 267.1 L66.0 268.7 L66.5 270.6 L66.5 272.6 L65.4 276.8 L65.1 281.1 L64.9 287.8 L64.6 288.2
  L63.6 288.4 L62.9 288.1 L62.6 287.7 L62.3 282.4 L62.1 281.0 L61.7 280.7 L61.2 281.9 L61.5 287.2
  L61.2 290.4 L61.0 291.2 L60.4 291.8 L57.4 292.9 L53.7 293.5 L50.1 293.4 L48.8 293.2 L47.3 292.7
  L46.5 291.9 L46.4 290.8 L46.6 288.2 L49.5 284.6 L51.0 281.2 L52.6 270.6 L52.4 265.0 L51.7 263.4
  L52.0 262.3 L51.9 260.9 L48.1 247.8 L47.5 247.2 L46.9 248.0 L43.9 253.8 L40.9 260.9 L40.7 262.3
  L41.1 263.4 L40.0 265.2 L39.9 266.7 L39.9 268.9 L40.4 270.7 L40.4 273.2 L38.8 278.6 L38.3 284.1
  L38.1 289.3 L37.7 290.1 L36.6 290.3 L36.3 290.5 L36.1 292.1 L35.6 293.2 L33.8 294.2 Z`;

const SUIT_TRACE = `M77.4 299.9 L0.8 299.9 L0.6 299.8 L0.6 294.2 L-1.6 293.9 L-2.2 292.9 L-2.0 291.5 L-0.6 289.5
  L1.5 288.0 L8.3 284.5 L12.1 280.6 L15.1 279.0 L16.8 277.0 L16.6 275.1 L17.3 271.3 L17.5 268.0
  L17.1 263.2 L16.2 257.2 L16.1 254.2 L17.1 242.0 L17.8 225.6 L19.5 204.4 L19.5 201.3 L18.6 194.2
  L18.6 180.1 L18.3 179.6 L16.4 179.0 L14.5 177.6 L11.5 174.4 L10.1 171.8 L7.9 165.8 L7.9 164.9
  L8.6 162.6 L8.8 157.9 L8.6 156.3 L7.9 154.9 L7.9 153.1 L10.2 137.7 L11.2 129.0 L12.2 124.2
  L12.9 118.1 L14.1 111.2 L15.6 97.5 L17.7 86.0 L18.2 81.0 L18.7 70.5 L19.2 66.2 L19.9 62.5
  L21.4 59.6 L23.0 58.0 L31.5 52.8 L36.8 49.9 L39.2 47.4 L39.6 46.6 L39.4 43.8 L39.8 42.0
  L39.6 39.5 L36.9 35.7 L36.2 33.2 L35.9 30.1 L34.2 28.9 L33.4 26.1 L33.2 21.7 L33.4 20.3
  L34.1 18.8 L32.5 16.7 L31.6 14.6 L31.5 12.9 L31.9 11.0 L32.4 9.5 L33.1 8.2 L34.9 6.5
  L36.4 4.4 L40.2 1.9 L44.8 0.3 L47.0 0.3 L49.5 -0.1 L52.2 1.1 L54.1 2.3 L55.8 3.9
  L57.1 6.0 L59.5 8.2 L60.7 10.5 L61.7 14.2 L61.7 16.6 L60.6 19.9 L61.3 21.8 L61.3 23.4
  L60.5 26.9 L59.8 28.7 L58.6 30.0 L57.6 30.6 L57.3 31.1 L57.7 36.5 L58.9 38.1 L60.8 39.3
  L64.0 42.2 L66.5 44.0 L68.5 44.7 L77.3 47.1 L83.6 49.2 L87.0 51.3 L88.7 53.4 L89.8 56.1
  L90.4 62.0 L92.4 68.9 L93.2 71.0 L95.1 74.9 L96.2 78.3 L96.7 81.2 L97.2 86.8 L98.7 94.9
  L99.8 97.5 L101.5 99.8 L102.1 101.6 L102.0 104.3 L101.3 107.1 L98.9 110.9 L92.1 123.9 L96.0 133.9
  L100.5 144.1 L100.9 145.4 L100.7 145.9 L100.1 146.5 L92.6 148.8 L89.6 149.1 L85.4 148.5 L83.8 148.5
  L82.5 149.0 L81.0 150.4 L80.1 150.7 L78.9 150.5 L76.8 149.6 L76.5 149.8 L76.9 150.9 L77.0 153.2
  L78.0 156.5 L78.1 157.9 L78.0 165.5 L77.0 173.5 L77.0 176.0 L77.7 180.6 L77.7 183.3 L76.9 189.1
  L76.9 191.2 L80.0 216.3 L80.9 229.2 L81.4 239.7 L81.2 247.8 L79.7 268.1 L79.0 274.5 L79.0 276.7
  L78.6 278.1 L77.8 279.1 L77.8 279.7 L79.1 282.5 L79.2 283.6 L78.6 285.4 L79.1 287.7 L79.0 291.1
  L78.5 293.1 L77.5 294.3 Z
  M61.7 295.1 L61.7 294.3 L61.3 292.6 L61.4 288.8 L63.1 284.2 L64.5 279.6 L64.4 278.6 L64.1 278.0
  L64.3 272.4 L63.8 264.8 L64.2 260.6 L65.8 253.0 L65.8 249.5 L60.1 221.7 L57.6 212.8 L55.8 195.7
  L54.0 184.2 L52.5 177.9 L50.0 170.1 L48.8 167.2 L48.3 166.7 L47.9 166.7 L47.1 167.5 L46.6 168.9
  L43.1 181.5 L41.8 187.0 L40.1 200.5 L38.6 208.9 L38.4 212.6 L37.5 218.7 L37.3 222.2 L37.4 225.8
  L36.4 232.4 L36.2 237.2 L36.0 260.3 L34.8 270.7 L34.8 278.6 L34.1 280.3 L34.3 285.4 L34.8 287.2
  L34.8 288.6 L34.5 289.3 L33.8 289.9 L29.8 290.8 L26.4 291.1 L22.2 290.0 L18.5 293.0 L16.9 293.8
  L15.2 294.2 L15.1 295.0 L15.4 295.1 Z`;

const GOWN_BALL_TRACE = `M66.1 299.9 L30.7 299.9 L30.5 299.8 L30.5 294.2 L29.5 291.1 L29.6 288.8 L29.1 288.3 L17.8 288.5
  L11.3 288.1 L3.5 287.2 L0.6 286.1 L0.2 285.2 L0.1 284.5 L-0.7 284.0 L-10.7 283.5 L-16.5 282.8
  L-24.5 281.5 L-31.0 279.9 L-35.6 278.4 L-39.8 276.7 L-43.8 274.5 L-44.7 273.7 L-45.0 273.1 L-44.6 271.4
  L-35.0 246.3 L-20.4 209.5 L-8.6 182.0 L-1.1 166.6 L-1.1 166.1 L-1.5 165.8 L-3.0 165.9 L-3.6 165.5
  L-3.4 164.1 L-2.4 161.9 L0.0 157.0 L3.5 151.1 L9.4 142.4 L16.6 133.2 L23.6 125.9 L23.6 125.3
  L23.3 125.0 L19.1 122.1 L16.3 119.6 L14.9 117.7 L14.5 115.9 L14.8 111.4 L19.1 80.3 L20.1 75.9
  L21.2 72.7 L22.2 70.9 L23.5 69.5 L26.6 67.8 L33.4 66.9 L36.2 66.2 L36.9 65.8 L36.2 64.5
  L36.2 62.5 L37.4 54.1 L38.4 50.5 L37.9 48.8 L38.1 46.8 L37.3 45.3 L36.8 45.3 L35.9 45.9
  L34.3 44.9 L32.7 46.6 L31.3 47.1 L30.2 46.2 L28.6 43.2 L28.2 42.9 L26.1 43.9 L23.9 44.3
  L23.3 43.9 L22.8 43.2 L22.1 40.1 L19.9 39.9 L18.9 39.4 L18.2 37.7 L17.5 37.3 L17.1 36.4
  L17.1 35.3 L17.9 32.8 L16.1 31.9 L13.9 29.1 L13.9 28.2 L14.3 27.4 L15.5 25.6 L16.4 24.7
  L15.0 22.7 L14.2 19.8 L16.0 16.6 L17.4 15.8 L19.7 15.1 L19.0 13.6 L18.8 12.7 L19.3 11.7
  L19.7 8.5 L20.3 7.6 L21.2 7.1 L23.4 6.7 L23.9 5.7 L24.3 5.4 L25.0 5.4 L26.5 6.1
  L27.1 5.9 L27.7 4.1 L28.4 3.0 L29.3 2.3 L30.5 2.0 L31.3 1.1 L32.8 1.3 L35.4 3.0
  L37.4 1.0 L38.3 0.3 L39.4 -0.1 L40.8 0.6 L42.2 2.1 L43.1 2.5 L43.6 4.6 L44.1 4.6
  L45.6 3.4 L46.7 2.9 L48.6 2.6 L49.5 2.9 L50.0 3.4 L50.3 5.4 L50.9 6.4 L50.3 8.0
  L50.7 8.4 L52.6 8.4 L53.4 8.8 L53.7 9.3 L53.3 10.3 L53.4 10.8 L56.4 10.6 L59.5 11.4
  L61.8 12.7 L63.3 14.2 L64.3 15.9 L65.2 19.1 L65.2 20.7 L64.7 22.7 L63.6 24.7 L63.6 25.3
  L64.8 28.2 L65.3 30.6 L65.4 35.5 L64.9 38.6 L65.4 40.1 L65.4 41.6 L64.8 43.9 L63.4 46.7
  L63.6 48.6 L63.2 50.0 L64.4 55.7 L65.4 64.2 L65.1 65.2 L65.7 65.8 L67.6 66.3 L73.9 67.1
  L76.4 67.8 L78.5 69.2 L80.2 71.2 L81.3 73.6 L82.6 79.1 L86.1 104.9 L86.6 109.8 L86.7 114.6
  L86.4 116.3 L85.9 117.4 L83.7 119.6 L80.9 121.6 L76.3 124.1 L75.8 124.7 L75.8 125.0 L85.2 135.0
  L91.7 143.1 L98.1 152.5 L100.9 157.3 L104.4 164.0 L104.7 164.9 L104.7 165.6 L104.3 166.0 L102.3 166.5
  L102.3 167.5 L109.7 182.7 L120.1 207.0 L131.8 236.7 L144.9 271.7 L144.5 272.6 L143.2 273.8 L136.4 277.7
  L128.8 280.6 L121.3 282.6 L112.6 283.8 L97.2 284.1 L94.3 284.3 L93.3 284.8 L92.9 286.4 L92.2 287.1
  L90.3 287.9 L88.2 288.3 L79.3 288.9 L69.5 288.3 L69.0 288.8 L68.8 290.4 L68.2 291.8 L66.2 294.2 Z
  M61.6 295.1 L61.6 294.2 L59.3 292.6 L58.0 291.1 L57.4 289.5 L57.1 286.9 L56.3 286.6 L54.8 286.4
  L46.7 286.4 L43.4 286.8 L42.8 287.2 L42.3 288.4 L41.2 289.2 L40.6 290.9 L39.7 291.9 L35.4 294.3
  L35.6 295.1 Z`;

const GOWN_TRAIN_TRACE = `M50.7 299.9 L41.3 299.9 L41.2 294.2 L38.1 292.2 L34.6 292.8 L32.6 292.8 L30.4 292.5 L25.8 291.4
  L20.9 289.7 L15.3 289.7 L3.4 286.4 L1.6 285.5 L-0.2 284.1 L-2.4 284.2 L-3.7 283.9 L-7.2 281.5
  L-11.8 279.3 L-13.0 278.0 L-13.5 276.6 L-13.5 274.5 L-13.2 273.7 L-12.8 272.9 L-11.9 272.0 L-10.3 271.5
  L-5.1 271.0 L-2.4 270.2 L-0.5 269.3 L1.0 266.9 L3.4 261.7 L6.0 254.6 L9.1 242.6 L12.2 226.6
  L14.2 213.8 L15.9 197.2 L16.5 181.0 L15.9 166.4 L14.1 153.6 L12.4 145.0 L12.0 144.2 L11.5 145.0
  L11.0 147.0 L11.0 151.3 L12.8 153.4 L12.7 154.5 L13.5 155.6 L13.8 157.6 L13.5 158.0 L12.9 158.0
  L11.4 157.4 L10.8 157.4 L10.7 158.4 L10.3 159.0 L8.9 158.3 L4.8 154.4 L4.5 153.6 L2.9 146.5
  L5.0 138.6 L5.7 135.8 L5.8 133.8 L8.4 124.1 L10.7 110.2 L12.1 103.7 L14.8 95.2 L15.3 92.8
  L15.9 85.4 L16.3 75.5 L16.1 63.5 L16.5 59.0 L17.2 55.4 L18.3 52.9 L20.4 51.1 L23.1 50.1
  L29.6 49.4 L34.8 48.0 L38.5 46.0 L39.5 44.8 L40.0 43.3 L40.0 41.9 L39.6 39.9 L35.4 35.7
  L32.8 32.3 L32.5 32.4 L32.5 34.2 L31.9 35.7 L30.4 36.8 L29.9 36.7 L31.0 34.8 L31.1 33.1
  L30.4 31.8 L27.5 30.6 L25.5 28.3 L25.3 27.5 L25.3 25.0 L25.7 21.4 L25.1 18.8 L24.8 18.4
  L24.3 18.5 L24.4 16.7 L24.9 15.1 L26.9 10.8 L29.0 7.6 L30.0 5.7 L31.6 3.4 L31.5 3.2
  L31.1 3.1 L29.6 3.8 L28.9 4.4 L27.5 6.2 L27.9 4.9 L29.2 3.6 L31.0 2.5 L33.8 2.0
  L39.6 0.2 L43.5 0.2 L44.3 -0.1 L45.1 -0.0 L46.0 0.4 L48.1 0.3 L50.4 2.1 L51.1 3.1
  L52.2 3.6 L54.1 3.3 L54.9 3.6 L55.6 4.6 L55.9 6.0 L57.6 7.6 L58.0 10.0 L59.1 11.4
  L59.0 12.7 L59.7 15.1 L59.4 19.1 L59.9 20.3 L61.0 24.4 L59.9 27.0 L59.7 28.2 L58.7 29.8
  L57.3 31.2 L54.7 32.2 L54.3 34.6 L53.0 36.6 L53.7 41.4 L54.8 44.3 L56.5 46.3 L60.3 48.4
  L65.1 50.0 L68.5 50.7 L72.3 52.3 L74.3 53.9 L75.3 55.5 L75.7 56.8 L76.2 59.2 L76.7 64.4
  L76.7 70.2 L76.0 86.4 L76.0 94.5 L78.6 107.2 L79.8 123.3 L80.7 129.7 L81.5 133.9 L81.6 136.4
  L85.0 146.6 L85.0 147.7 L83.5 154.7 L80.8 158.0 L78.8 159.9 L77.6 160.6 L77.1 160.3 L77.1 158.8
  L75.3 159.1 L74.6 158.8 L74.8 157.8 L76.9 155.8 L76.7 155.4 L75.5 155.7 L75.1 155.2 L76.6 152.9
  L76.5 149.4 L75.1 144.0 L75.1 141.6 L76.0 137.9 L76.0 135.9 L75.0 131.5 L68.4 112.8 L66.8 106.5
  L66.0 101.4 L65.4 89.9 L64.0 78.5 L63.8 78.3 L63.5 78.4 L62.7 79.9 L61.3 83.7 L57.9 91.3
  L56.2 97.1 L56.3 100.0 L62.2 115.0 L64.3 121.3 L66.2 129.3 L67.1 136.2 L67.0 141.9 L66.2 147.2
  L64.4 157.1 L63.2 168.0 L62.6 176.3 L62.2 190.8 L62.4 200.3 L63.0 202.4 L64.4 207.4 L67.9 217.3
  L70.8 224.3 L73.5 229.8 L78.1 238.2 L82.4 245.5 L86.5 251.9 L91.5 259.1 L93.7 261.7 L95.4 263.2
  L105.3 267.2 L110.6 269.8 L112.5 271.0 L113.2 271.8 L113.3 272.3 L112.8 273.6 L111.3 275.0 L106.9 277.3
  L107.2 279.3 L107.0 280.7 L106.1 282.2 L104.8 283.5 L100.8 285.8 L96.0 286.9 L90.8 286.8 L86.3 285.4
  L81.4 282.4 L77.1 278.0 L75.7 277.4 L75.1 277.8 L75.0 279.7 L74.2 281.9 L73.1 283.8 L72.0 284.9
  L70.4 285.9 L68.9 286.4 L66.4 286.6 L64.5 285.8 L63.0 284.0 L61.5 280.9 L60.9 278.2 L60.6 277.8
  L56.8 278.3 L53.1 278.2 L52.6 278.8 L52.7 281.9 L52.3 283.1 L53.0 286.7 L53.0 290.4 L52.4 292.2
  L50.8 294.2 Z`;

const GOWN_EVENING_TRACE = `M94.1 299.9 L20.2 299.9 L20.0 299.8 L20.0 294.3 L17.8 292.1 L15.5 292.2 L14.8 291.3 L14.1 291.1
  L10.4 292.3 L9.0 291.9 L6.3 292.4 L4.0 292.4 L2.9 291.6 L1.9 291.2 L-4.6 290.3 L-5.6 289.3
  L-7.9 288.2 L-7.3 287.9 L-3.7 288.1 L-2.9 287.8 L-3.1 287.4 L-5.2 286.8 L-5.5 286.1 L-5.1 285.2
  L-5.2 285.0 L-6.8 284.3 L-7.5 283.5 L-4.9 283.8 L-2.5 282.7 L-1.7 281.9 L-0.7 280.2 L0.1 278.1
  L0.5 276.4 L0.1 275.9 L-1.1 277.3 L-3.1 278.7 L-3.8 278.3 L-3.6 278.0 L-2.2 276.8 L-1.3 275.4
  L-0.5 272.8 L-0.8 272.4 L-2.2 272.7 L-2.4 272.3 L-1.1 271.2 L-0.2 269.9 L0.3 268.0 L0.1 266.9
  L-0.5 266.3 L-2.6 267.9 L-3.6 268.3 L-3.9 268.0 L-1.6 264.3 L-0.7 262.1 L-0.2 259.3 L-0.6 259.2
  L-1.4 260.2 L-2.5 260.9 L-4.9 261.1 L-5.8 260.6 L-3.5 259.3 L-2.3 257.5 L-0.8 254.8 L0.0 252.0
  L-0.1 251.6 L-0.9 251.7 L-1.0 251.5 L0.1 249.1 L0.7 246.3 L0.8 243.5 L0.4 241.3 L-1.0 241.8
  L-2.5 242.7 L-2.9 242.7 L-3.0 242.4 L-1.7 240.8 L-0.7 238.5 L-0.1 235.8 L0.2 233.2 L-0.3 232.0
  L0.1 230.8 L0.3 229.5 L-0.1 229.4 L-1.0 231.1 L-1.7 231.7 L-3.0 232.0 L-3.4 231.7 L-1.7 230.2
  L-0.7 227.5 L-0.8 223.5 L0.0 220.1 L-0.1 219.2 L0.8 215.2 L0.6 214.6 L-0.3 215.0 L-0.4 214.7
  L0.5 212.5 L0.9 210.4 L0.9 209.2 L0.0 209.2 L0.8 206.7 L0.6 206.5 L0.2 206.7 L-1.7 209.7
  L-2.0 209.7 L-2.0 209.4 L-1.4 206.1 L0.4 202.8 L1.4 199.5 L1.8 195.9 L1.6 195.6 L1.1 195.5
  L1.0 195.2 L2.1 192.1 L2.6 188.1 L2.3 183.5 L1.2 179.0 L0.9 176.5 L-0.2 175.3 L-0.8 174.1
  L-0.1 173.0 L-0.1 172.3 L-2.7 159.8 L-3.8 149.3 L-3.7 146.4 L-4.4 144.8 L-3.7 143.2 L-3.4 140.2
  L-3.4 138.6 L-4.0 136.6 L-3.7 136.0 L-2.8 135.1 L-2.1 131.7 L-1.2 129.5 L-1.0 128.1 L0.1 125.9
  L0.9 123.2 L7.5 113.1 L5.6 112.3 L2.8 110.3 L0.6 109.2 L-9.5 105.1 L-19.5 100.0 L-20.7 99.1
  L-21.7 97.9 L-22.0 97.1 L-22.0 95.1 L-20.7 92.4 L-17.8 87.7 L-7.8 74.7 L-2.4 66.2 L0.7 62.6
  L2.4 61.2 L4.5 60.1 L7.1 59.5 L11.2 59.1 L14.4 58.0 L18.6 55.3 L20.3 53.2 L21.5 49.8
  L22.2 45.8 L21.8 44.1 L20.6 41.6 L19.9 40.9 L19.4 39.4 L19.5 37.8 L20.3 35.6 L20.3 32.6
  L19.7 31.1 L19.1 30.5 L19.4 29.4 L19.1 28.5 L19.9 26.5 L20.1 25.0 L24.6 14.0 L26.6 11.7
  L31.4 8.7 L31.4 8.2 L30.1 6.3 L30.8 3.8 L32.8 1.3 L34.3 0.6 L36.5 -0.1 L39.0 0.2
  L41.0 0.8 L42.2 1.5 L47.7 1.6 L46.8 2.5 L49.9 4.9 L51.2 6.5 L51.9 8.2 L52.4 11.0
  L51.8 12.5 L51.8 11.4 L51.4 11.0 L51.1 11.2 L50.7 12.2 L50.5 14.4 L50.8 15.3 L51.4 15.8
  L51.7 16.7 L53.1 18.5 L54.2 20.7 L55.7 26.8 L55.4 30.6 L54.8 31.5 L53.9 35.7 L51.9 39.1
  L49.4 41.3 L48.8 42.7 L48.5 45.2 L48.2 45.9 L46.1 47.3 L47.3 44.7 L47.5 43.4 L47.2 43.1
  L46.2 44.7 L45.8 45.1 L45.5 44.9 L46.4 42.7 L46.6 41.3 L46.1 40.9 L44.6 43.5 L42.4 45.8
  L37.2 49.0 L37.0 49.5 L37.0 50.8 L37.3 51.4 L39.0 52.3 L43.9 53.3 L47.7 53.3 L52.8 52.7
  L54.2 52.7 L56.5 53.2 L58.6 54.6 L59.9 56.2 L60.9 58.4 L61.6 61.3 L62.1 65.2 L62.5 73.5
  L62.4 82.7 L61.8 92.3 L61.8 98.1 L62.4 101.8 L62.4 104.6 L60.8 116.3 L56.8 133.0 L55.7 138.8
  L55.9 139.5 L56.9 140.6 L56.4 141.9 L57.8 145.1 L58.7 146.1 L59.9 147.0 L59.6 148.2 L61.1 150.7
  L61.0 151.6 L59.9 151.1 L59.4 151.2 L60.1 153.0 L60.6 153.8 L63.3 156.3 L62.9 156.9 L60.4 156.1
  L60.4 156.8 L61.0 157.9 L62.7 159.8 L64.7 161.1 L62.9 161.3 L62.7 161.6 L64.4 163.4 L64.4 163.9
  L63.7 164.0 L63.6 164.3 L65.0 165.9 L65.3 166.8 L66.5 168.1 L66.2 168.4 L64.6 168.2 L64.4 168.8
  L66.6 171.2 L67.6 173.6 L67.3 173.8 L65.7 173.0 L65.1 173.3 L64.9 173.7 L66.1 176.2 L66.1 177.4
  L66.7 179.2 L66.8 180.0 L66.4 180.3 L66.2 181.0 L66.4 183.8 L67.5 186.1 L69.5 188.3 L69.4 188.4
  L67.5 187.9 L68.0 190.6 L69.5 193.1 L70.4 193.9 L71.3 195.2 L71.6 196.4 L71.6 197.0 L71.3 197.2
  L70.5 195.9 L69.6 195.3 L69.7 196.0 L71.3 198.7 L71.2 199.1 L70.5 199.0 L70.3 199.3 L70.8 200.7
  L71.6 201.7 L72.9 202.9 L74.4 203.5 L74.8 203.9 L74.7 205.3 L74.3 205.3 L72.8 204.6 L72.5 205.0
  L72.8 205.5 L74.0 206.5 L74.5 207.7 L75.6 208.7 L78.0 209.6 L78.6 210.2 L78.7 211.8 L78.4 211.9
  L76.6 211.3 L76.2 211.6 L76.5 212.3 L77.6 213.6 L79.4 214.7 L80.7 216.1 L81.7 216.6 L83.8 216.9
  L83.6 217.4 L82.8 217.7 L80.3 217.7 L79.5 217.4 L79.1 217.7 L81.8 221.3 L83.9 223.1 L85.3 223.7
  L85.0 225.1 L85.3 226.8 L86.4 228.8 L88.1 230.4 L90.0 231.2 L90.0 231.6 L89.4 231.9 L88.0 232.2
  L88.6 233.3 L87.6 233.9 L88.2 235.2 L89.3 236.6 L91.1 238.4 L94.0 240.1 L93.6 240.5 L92.4 240.5
  L90.2 239.7 L89.8 239.8 L90.6 241.3 L90.4 242.5 L90.9 243.8 L92.0 244.7 L94.0 245.2 L94.0 245.6
  L93.5 245.9 L91.9 246.1 L92.5 247.7 L94.7 250.2 L95.5 251.5 L97.2 252.5 L99.3 253.2 L99.4 253.7
  L98.5 254.2 L98.9 254.7 L100.5 255.2 L101.9 255.3 L101.8 255.8 L100.9 256.4 L98.9 256.5 L98.5 256.8
  L99.4 258.4 L100.0 261.5 L99.4 261.5 L97.9 259.9 L97.5 259.9 L99.2 262.4 L100.3 263.4 L102.9 264.4
  L105.5 264.3 L105.5 264.7 L104.9 265.2 L101.5 265.9 L103.5 267.1 L106.3 267.4 L106.6 267.9 L105.3 268.3
  L103.1 268.5 L102.4 268.7 L102.3 269.2 L103.6 271.3 L104.2 271.7 L105.8 272.5 L108.3 273.0 L109.2 273.6
  L109.1 274.0 L107.2 273.9 L106.7 274.2 L107.2 275.1 L107.4 276.3 L108.0 277.0 L112.4 278.8 L113.7 279.9
  L114.2 280.9 L115.6 281.9 L118.6 282.8 L121.2 282.8 L121.7 283.1 L120.9 283.8 L117.1 284.7 L118.6 285.5
  L121.4 285.9 L121.8 286.4 L119.2 287.0 L116.9 286.9 L114.7 287.1 L114.5 287.4 L114.9 288.2 L114.7 288.4
  L103.3 288.4 L100.1 287.9 L96.9 288.2 L96.4 290.5 L96.5 292.5 L95.6 293.6 L94.2 294.3 Z
  M84.9 295.1 L84.9 294.2 L82.3 293.3 L81.3 292.2 L80.8 290.4 L81.0 287.4 L80.7 286.9 L78.7 286.3
  L78.1 286.3 L77.8 286.8 L77.8 290.0 L77.5 290.4 L76.9 290.6 L76.2 289.9 L76.1 286.3 L75.7 285.5
  L69.5 283.9 L68.0 284.1 L69.3 285.5 L69.3 286.1 L68.6 286.4 L66.4 286.1 L62.7 284.7 L60.6 284.7
  L53.1 286.4 L49.2 287.0 L37.5 286.9 L37.1 287.3 L38.3 288.2 L37.9 288.6 L35.8 288.6 L33.2 287.9
  L32.8 288.3 L33.8 292.1 L33.7 293.4 L33.1 294.3 L33.3 295.1 Z
  M8.5 105.6 L9.9 104.9 L14.5 101.2 L16.1 100.9 L16.5 100.2 L16.1 97.9 L15.1 96.1 L15.3 94.7
  L15.1 94.3 L13.8 92.5 L12.6 91.6 L11.3 89.3 L9.7 85.9 L9.1 80.7 L8.1 78.9 L7.1 78.0
  L6.3 77.8 L5.5 78.2 L1.0 83.1 L-6.4 90.2 L-8.4 92.4 L-9.0 93.3 L-9.1 93.8 L-4.0 98.9
  L-0.5 101.4 L6.1 105.1 Z`;

const GRAD_TRACE = `M47.5 299.9 L34.1 299.9 L34.0 294.2 L32.5 293.5 L31.4 292.5 L30.4 290.7 L29.9 289.1 L29.8 287.7
  L30.4 282.3 L31.5 278.6 L31.1 278.1 L30.2 277.8 L29.8 277.1 L29.8 273.9 L30.1 272.7 L30.1 267.0
  L29.5 256.0 L29.6 244.2 L29.4 243.7 L28.7 243.4 L21.7 241.9 L21.3 241.1 L23.6 192.6 L23.6 188.2
  L22.6 182.0 L22.3 181.5 L21.6 181.1 L13.7 179.0 L4.4 175.9 L3.7 175.5 L3.6 174.7 L9.6 138.7
  L17.5 85.5 L19.0 77.7 L20.1 74.2 L22.0 70.8 L25.3 67.5 L36.8 61.1 L41.1 59.0 L42.7 58.6
  L45.0 55.6 L46.7 55.5 L47.6 53.5 L48.3 49.8 L48.3 45.1 L47.3 41.2 L46.9 40.8 L45.3 40.1
  L44.5 39.3 L43.6 37.9 L42.7 35.8 L42.3 33.9 L42.6 30.9 L42.3 27.7 L42.2 26.9 L41.2 25.2
  L41.1 23.5 L40.1 20.4 L39.5 19.9 L39.0 20.0 L39.5 21.3 L39.2 23.2 L39.3 37.6 L39.1 38.0
  L38.6 38.2 L36.5 38.2 L35.5 37.9 L35.1 37.3 L35.1 36.3 L36.5 24.5 L36.6 19.7 L34.1 17.8
  L28.2 14.3 L27.9 13.8 L28.8 13.1 L32.4 11.6 L57.0 1.9 L62.7 -0.1 L64.8 1.2 L82.2 13.9
  L83.1 14.9 L82.9 15.4 L82.2 15.7 L73.9 18.4 L73.3 18.8 L73.2 19.6 L73.9 23.0 L74.0 25.2
  L73.3 29.4 L73.2 38.5 L72.8 42.1 L71.6 45.8 L67.8 52.3 L66.4 53.5 L64.1 53.7 L63.6 54.0
  L63.2 59.4 L64.2 60.8 L64.8 62.5 L65.4 63.3 L71.9 67.0 L77.1 70.6 L79.5 72.6 L81.2 74.7
  L82.5 77.7 L84.5 88.9 L87.7 117.5 L90.8 140.5 L92.0 151.5 L94.7 170.5 L96.3 179.1 L95.6 180.3
  L93.4 181.7 L90.3 183.3 L87.1 184.3 L86.6 185.0 L88.1 189.3 L88.1 191.1 L87.6 193.7 L87.1 195.4
  L86.1 197.3 L87.5 222.0 L88.0 239.9 L87.8 240.4 L87.0 240.7 L76.0 243.0 L74.8 243.7 L73.6 252.4
  L72.2 265.9 L72.2 270.2 L73.5 276.2 L77.1 279.0 L80.6 281.3 L83.1 282.3 L87.0 283.2 L88.6 284.0
  L89.6 285.2 L90.6 287.1 L90.8 288.6 L90.6 289.0 L89.7 289.3 L86.5 290.0 L83.7 290.2 L78.2 290.2
  L75.1 289.7 L68.7 287.4 L66.4 288.0 L64.9 288.0 L59.1 287.3 L58.7 285.9 L58.4 281.5 L58.8 279.2
  L60.1 275.9 L59.8 274.8 L59.7 268.8 L58.2 245.3 L57.9 244.8 L57.4 244.5 L46.3 244.9 L45.8 245.3
  L45.5 246.5 L43.5 266.2 L42.7 270.4 L43.0 273.2 L43.0 276.9 L42.7 277.4 L41.9 277.9 L41.7 278.4
  L44.1 284.3 L46.1 287.8 L47.5 290.9 Z`;

const GOWN_SWEEP_TRACE = `M60.1 299.9 L36.4 299.9 L36.3 294.2 L33.2 291.9 L32.8 290.5 L32.9 287.6 L32.6 287.0 L22.8 286.9
  L16.5 285.9 L15.0 285.4 L14.6 284.4 L14.1 284.1 L8.4 282.8 L7.1 282.3 L7.0 281.9 L13.3 258.3
  L18.5 236.8 L22.2 217.8 L23.7 208.4 L24.7 199.9 L25.4 189.4 L25.4 178.8 L24.2 164.3 L22.0 150.9
  L21.2 144.9 L21.0 141.7 L21.0 135.7 L21.5 131.1 L22.7 125.0 L25.2 117.7 L28.0 111.8 L31.8 105.5
  L33.3 102.1 L33.3 100.0 L31.9 94.2 L28.9 85.1 L28.4 84.1 L28.0 83.9 L27.2 83.9 L26.7 84.4
  L25.6 96.8 L25.6 106.4 L23.2 117.7 L19.5 131.5 L17.8 140.0 L17.9 142.9 L19.3 146.4 L20.0 149.1
  L20.0 151.7 L19.7 152.9 L19.9 158.9 L19.6 160.4 L18.8 161.3 L19.0 162.5 L20.5 164.1 L21.0 165.9
  L20.5 166.4 L18.7 166.3 L14.5 162.7 L13.5 161.5 L12.5 158.3 L11.2 155.6 L10.9 154.2 L11.8 150.3
  L12.6 145.5 L12.6 140.5 L13.3 135.7 L13.8 128.8 L14.6 110.1 L15.5 104.6 L17.0 98.6 L17.3 95.6
  L17.3 84.6 L16.9 83.9 L15.1 83.4 L14.5 82.4 L12.7 68.3 L13.4 67.3 L16.9 65.1 L17.0 62.0
  L17.8 58.7 L18.8 56.8 L20.4 55.2 L23.2 53.8 L29.9 53.0 L33.8 51.7 L38.5 49.2 L40.7 46.9
  L41.6 44.8 L42.0 42.8 L42.1 38.3 L39.6 34.6 L38.9 31.7 L38.4 31.4 L37.6 31.8 L37.1 31.1
  L35.8 27.6 L35.2 24.2 L35.5 23.6 L36.4 23.2 L36.7 22.8 L36.5 17.6 L37.0 14.5 L38.5 11.2
  L40.9 8.4 L40.8 5.4 L41.3 3.8 L42.0 2.7 L43.9 1.1 L47.2 -0.1 L49.4 -0.1 L51.4 0.5
  L53.8 1.8 L54.5 2.5 L55.3 3.8 L55.8 5.4 L55.8 8.5 L58.3 11.3 L59.4 13.8 L60.0 16.0
  L60.2 18.2 L60.0 22.6 L61.2 23.7 L61.2 25.5 L60.7 28.0 L59.3 31.6 L59.0 31.9 L58.2 31.6
  L57.8 31.7 L57.0 34.8 L54.7 38.1 L54.7 43.2 L54.9 44.8 L55.9 47.1 L57.8 49.1 L63.3 52.1
  L66.1 53.0 L72.8 54.0 L74.8 54.7 L76.3 55.7 L77.8 57.3 L78.6 59.0 L79.1 61.5 L79.5 65.4
  L83.0 67.4 L83.5 68.4 L81.6 82.8 L80.8 83.6 L79.2 83.9 L78.8 84.6 L78.9 97.5 L81.4 109.2
  L83.1 137.4 L83.8 141.1 L83.8 145.1 L84.1 147.0 L85.4 154.1 L85.3 155.1 L84.2 157.4 L83.1 161.4
  L78.0 166.2 L77.0 166.1 L76.1 166.4 L75.8 165.8 L76.3 163.7 L77.7 162.4 L77.6 161.0 L77.0 160.1
  L76.7 158.4 L76.8 153.0 L76.4 149.3 L76.8 147.0 L78.6 142.4 L78.7 140.5 L77.8 135.7 L71.8 113.3
  L70.2 105.9 L70.3 96.8 L69.4 84.5 L69.0 84.0 L68.3 83.8 L67.7 84.1 L67.4 84.7 L63.9 95.2
  L62.7 101.2 L62.9 103.1 L63.4 104.1 L68.8 112.8 L70.8 116.9 L73.1 123.2 L74.7 129.8 L75.5 135.4
  L75.5 143.2 L73.7 160.6 L73.2 170.6 L73.5 183.6 L74.2 192.5 L76.9 211.4 L80.3 228.9 L87.0 259.2
  L92.9 281.7 L92.5 282.4 L91.4 282.8 L81.1 284.9 L73.2 285.8 L63.7 286.2 L63.4 286.6 L63.8 289.3
  L63.6 291.5 L62.7 292.6 L60.2 294.3 Z`;

/* Volleyball, in full colour:
     Men    0 Spike -- Pixabay 9675748. The ball is drawn in the air above him,
            clear of his hand, so it cannot be cut with him and is left out.
     Women  1 Ready -- made by figure-src/make-volley-w.py: the creativecanvasdesign
            basketball player (10442422) with the volleyball from 9675748 put in
            her hand at the hip and her kit recoloured red and navy. No free
            colour drawing of a woman volleyball player had both a drawn face
            and a ball in her hands.
   The Set (Pixabay 2667290) is the pose the owner asked to replace; keep it out. */
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

const RUN_M_RUN_TRACE = `M85.3 299.9 L-36.9 299.9 L-37.0 294.2 L-39.2 292.7 L-41.2 290.7 L-43.0 287.9 L-44.8 283.5 L-45.4 280.9
  L-45.5 274.9 L-46.0 271.5 L-46.9 268.5 L-49.8 260.9 L-50.3 257.9 L-50.3 255.9 L-50.0 254.3 L-49.4 253.0
  L-48.4 251.8 L-47.5 251.4 L-46.2 251.2 L-43.3 251.9 L-42.2 251.9 L-38.2 250.8 L-36.1 250.8 L-34.7 251.5
  L-34.0 251.2 L-30.8 247.9 L-26.4 242.6 L-20.9 235.2 L-17.1 229.2 L-12.5 219.8 L-9.2 215.1 L-6.8 212.8
  L-2.7 209.6 L1.9 207.1 L8.1 204.9 L9.6 203.3 L11.2 200.0 L15.5 188.8 L18.3 180.0 L23.2 169.1
  L23.1 168.3 L21.6 165.4 L20.6 162.6 L20.0 159.0 L19.9 154.8 L18.9 152.5 L19.1 149.0 L19.9 145.8
  L21.0 142.9 L23.0 139.2 L26.2 134.7 L30.8 129.1 L35.0 122.4 L35.9 120.3 L37.1 116.4 L38.8 107.7
  L40.3 98.2 L40.5 93.3 L41.1 88.1 L41.1 84.7 L41.6 82.9 L42.0 79.0 L42.2 73.3 L41.7 72.9
  L36.8 73.3 L28.4 73.0 L22.4 72.4 L12.8 71.0 L12.4 71.1 L11.9 71.7 L10.2 77.3 L8.9 80.6
  L1.8 94.5 L-0.8 100.2 L-3.0 106.4 L-2.9 107.2 L-2.1 108.0 L-2.1 108.8 L-3.5 113.1 L-3.5 114.3
  L-2.8 116.8 L-0.8 120.3 L0.4 123.9 L0.7 125.1 L0.9 130.1 L0.9 131.2 L0.5 132.4 L-0.3 133.1
  L-1.0 133.1 L-2.0 132.7 L-2.7 132.0 L-3.5 130.1 L-3.8 127.1 L-4.0 126.6 L-4.6 126.4 L-5.7 127.2
  L-7.7 131.5 L-9.2 133.2 L-10.4 133.4 L-12.0 132.7 L-13.2 133.0 L-14.3 132.8 L-15.5 132.1 L-16.4 130.2
  L-18.0 129.5 L-19.2 127.6 L-20.7 126.4 L-21.0 125.6 L-20.9 123.9 L-21.6 122.3 L-21.0 120.0 L-15.4 110.4
  L-14.9 107.7 L-14.1 104.6 L-13.4 104.4 L-12.3 104.6 L-11.9 104.1 L-9.8 88.8 L-7.6 76.7 L-5.2 67.9
  L-4.2 65.0 L-3.0 62.4 L-1.1 60.1 L1.8 58.2 L6.3 56.0 L12.8 53.4 L21.0 50.5 L28.0 48.7
  L29.9 48.4 L33.7 48.4 L37.3 49.2 L38.1 49.1 L41.4 47.0 L44.3 45.5 L48.2 44.2 L49.8 44.0
  L54.4 44.2 L57.1 45.0 L60.8 46.4 L74.7 46.2 L78.0 47.1 L79.0 46.8 L80.6 44.8 L81.5 42.9
  L82.8 39.1 L83.3 36.9 L83.3 35.4 L82.8 32.9 L79.6 25.3 L79.0 23.4 L78.7 20.2 L78.8 17.0
  L79.3 14.5 L80.4 11.8 L81.5 10.2 L81.4 9.8 L80.6 9.1 L81.2 7.8 L82.2 6.2 L84.8 3.9
  L88.0 2.1 L90.3 1.2 L93.3 0.6 L96.0 0.3 L102.2 0.6 L106.9 1.2 L108.3 -0.1 L111.1 1.2
  L112.7 2.3 L114.9 4.5 L115.8 6.3 L115.8 9.4 L114.0 12.8 L115.3 17.5 L115.8 22.5 L114.7 25.8
  L113.8 26.8 L113.7 27.2 L116.5 31.9 L116.7 32.9 L116.3 33.5 L114.2 34.2 L113.8 34.6 L114.5 36.7
  L114.0 38.0 L112.7 40.1 L112.9 44.8 L112.5 46.5 L111.8 47.7 L110.4 48.8 L108.3 49.2 L102.6 48.2
  L101.6 49.7 L98.1 56.5 L98.5 57.2 L102.4 60.2 L103.9 61.6 L105.1 63.4 L108.6 65.7 L110.5 67.7
  L112.4 70.3 L113.8 73.7 L114.5 76.5 L114.7 81.0 L114.5 83.2 L112.7 90.1 L112.4 92.2 L114.2 98.8
  L115.0 103.5 L115.1 109.5 L114.9 113.0 L115.3 113.4 L118.2 113.5 L125.0 115.2 L127.5 114.4 L130.4 112.9
  L131.9 111.7 L132.2 111.1 L131.8 107.7 L130.6 103.9 L130.6 102.5 L131.6 101.3 L133.5 100.0 L135.7 99.1
  L136.7 99.5 L138.3 100.7 L142.7 99.6 L144.1 99.8 L145.1 100.5 L145.8 102.1 L147.2 103.6 L147.5 105.6
  L148.8 107.2 L148.8 109.5 L149.8 110.9 L150.2 112.0 L150.2 114.3 L149.6 115.7 L149.2 116.2 L146.0 118.4
  L142.1 119.9 L137.7 120.4 L125.0 128.6 L120.3 131.1 L116.1 132.7 L113.3 133.4 L111.0 133.8 L108.1 133.8
  L105.8 133.4 L103.3 132.3 L101.4 130.8 L100.2 129.2 L99.0 126.7 L97.8 123.4 L95.2 115.7 L93.3 108.8
  L92.9 108.2 L92.5 108.1 L91.5 109.3 L86.3 116.9 L83.9 121.1 L81.0 126.7 L75.9 138.2 L67.0 160.0
  L66.9 160.6 L67.2 161.2 L75.4 170.3 L81.2 177.5 L86.0 184.1 L93.3 195.3 L94.3 197.3 L94.9 200.0
  L94.8 202.5 L93.7 206.6 L92.7 208.7 L89.3 214.1 L87.1 218.4 L85.1 222.8 L80.7 234.4 L73.2 250.8
  L70.5 257.8 L68.2 266.3 L68.6 267.0 L70.1 267.4 L71.1 268.4 L72.4 272.6 L72.8 273.2 L74.1 273.6
  L76.3 273.8 L76.9 274.1 L76.9 274.5 L76.6 274.8 L74.1 274.7 L73.9 274.9 L76.6 277.4 L80.0 279.5
  L83.0 281.0 L85.5 281.6 L90.9 282.2 L92.5 282.6 L94.4 284.1 L95.3 287.2 L95.1 287.9 L94.4 289.0
  L91.5 291.2 L85.4 294.2 Z
  M63.6 295.1 L63.6 294.2 L58.2 293.3 L48.8 290.1 L48.2 289.6 L48.1 289.0 L48.3 288.1 L50.0 285.5
  L50.8 283.4 L51.7 278.6 L53.2 273.5 L54.4 272.3 L55.7 272.5 L56.1 272.2 L57.0 268.9 L58.7 259.6
  L61.1 243.6 L61.4 230.0 L62.3 223.7 L63.8 219.4 L65.3 216.2 L68.2 211.3 L71.3 206.8 L72.5 205.6
  L72.9 204.8 L72.5 204.0 L71.5 203.0 L67.6 199.8 L65.3 198.3 L54.9 192.4 L51.2 190.4 L50.7 190.4
  L49.7 191.3 L45.8 196.1 L39.1 203.1 L35.0 206.7 L26.4 213.3 L24.9 214.7 L22.6 217.7 L20.9 219.3
  L17.8 221.2 L16.5 221.6 L14.6 221.6 L13.5 222.0 L2.8 233.0 L-3.2 238.2 L-19.3 251.5 L-24.2 256.1
  L-27.1 259.6 L-27.7 260.5 L-28.0 261.3 L-24.9 261.9 L-24.2 262.7 L-24.2 263.3 L-27.9 268.1 L-27.9 268.6
  L-26.8 270.6 L-25.4 276.8 L-25.9 276.8 L-26.4 275.9 L-27.5 270.6 L-28.6 269.2 L-29.0 269.2 L-29.2 269.7
  L-29.9 277.1 L-30.2 278.3 L-29.7 279.7 L-29.5 282.9 L-28.4 289.0 L-28.3 291.0 L-28.9 293.0 L-30.0 294.2
  L-30.0 295.0 L-29.7 295.1 Z`;

const VOLLEY_M_SPIKE_ART = {"src": "img/figures/volley-m-spike.c2d84778.webp", "box": [-47.87, -1.2, 147.72, 295.46]};

/* Football, athletics and boxing are PRINTED IN FULL COLOUR -- face, skin, hair
   and kit -- and cut to the drawing's own outline: the owner's choice on 3 Nov,
   shown a silhouette with white details beside a colour print. Every drawing
   here is by one artist, creativecanvasdesign on Pixabay, so the set matches.
   Each _ART is the drawing beside the site and its corners in the cut's frame
   (polish-figure.py, step 9). The two footballers stand with a boot on the
   ball, and the ball is printed and cut with them, on the base (3 Nov; it was
   taken out while the owner wanted no balls at all).
     Football   men 0 Celebrate (10335002); women 1 Celebrate (10335085)
     Athletics  men 0 Run (8923041, another artist, the one runner with a face);
                women 1 Sprint (10499683), 2 Ready (10444255)
   Several of this artist's figures have no face drawn -- a blank skin oval --
   and those were left out: the owner asked for "faces like faces".
     Boxing     men 0 Victory (10100970), 1 Champion (10360614); women 2 Guard (10452927), 3 Ready (10442200) */
const FOOT_M_CELEBRATE_TRACE = `M66.0 299.9 L-7.8 299.9 L-8.0 299.8 L-8.0 294.2 L-11.9 293.5 L-14.7 292.5 L-17.2 291.3 L-20.5 288.9
  L-23.6 285.9 L-25.9 282.7 L-27.8 279.0 L-28.5 276.8 L-29.3 272.7 L-29.3 267.9 L-28.0 263.0 L-27.0 260.5
  L-25.2 257.3 L-22.8 254.4 L-20.3 252.3 L-19.4 250.9 L-19.7 250.6 L-20.4 251.5 L-20.8 251.7 L-22.1 251.7
  L-22.7 251.4 L-23.4 249.9 L-24.7 249.0 L-25.3 248.1 L-25.7 246.7 L-25.4 245.6 L-24.8 244.5 L-23.9 243.5
  L-17.4 240.1 L-16.3 238.6 L-15.0 237.9 L-14.0 236.5 L-12.7 235.7 L-12.1 234.4 L-10.7 233.5 L-10.1 231.8
  L-8.4 230.8 L-8.0 227.8 L-7.6 227.1 L-6.4 226.4 L-6.0 225.8 L-6.4 222.8 L-7.9 217.2 L-13.5 201.5
  L-15.6 193.4 L-16.1 190.0 L-16.4 183.0 L-16.8 178.6 L-16.6 175.2 L-17.7 168.4 L-17.7 165.2 L-16.8 161.1
  L-15.6 158.8 L-14.3 157.5 L-5.9 151.0 L-3.8 148.9 L3.6 145.1 L12.2 142.0 L14.3 140.2 L16.5 139.7
  L17.7 138.4 L18.8 136.0 L18.7 133.0 L19.1 131.2 L20.3 128.9 L22.2 126.6 L22.8 125.5 L22.6 122.5
  L23.4 113.5 L23.2 103.3 L21.6 87.5 L20.9 83.5 L17.8 80.8 L12.1 77.3 L6.3 74.5 L2.3 73.2
  L1.6 72.4 L1.1 69.9 L0.6 69.2 L-4.7 66.1 L-17.3 57.6 L-18.1 56.8 L-18.7 55.7 L-18.8 52.3
  L-20.0 44.0 L-20.0 38.0 L-18.6 24.0 L-18.4 18.8 L-17.7 15.9 L-17.2 11.8 L-14.9 2.7 L-14.3 1.8
  L-11.6 0.2 L-8.7 0.3 L-3.9 -0.1 L-2.6 0.3 L-1.8 1.7 L-2.1 4.3 L-1.7 4.8 L-0.2 5.5
  L0.2 6.6 L-0.0 8.1 L-1.4 11.4 L-5.1 15.6 L-8.4 17.4 L-9.0 18.6 L-9.2 20.8 L-8.9 27.4
  L-8.2 31.7 L-4.8 42.3 L-3.5 48.2 L-2.3 49.1 L3.8 51.1 L5.7 51.3 L13.1 54.3 L16.5 55.4
  L21.7 56.0 L26.6 56.0 L31.5 56.8 L34.5 58.0 L37.6 59.8 L42.1 58.9 L43.7 58.8 L45.0 58.2
  L45.2 57.8 L45.4 56.6 L45.4 54.1 L45.0 53.6 L43.5 52.8 L42.7 52.0 L41.8 50.3 L41.8 47.5
  L40.6 41.2 L40.6 39.1 L40.3 38.1 L40.3 36.4 L41.0 34.2 L42.3 32.0 L42.8 30.6 L43.0 27.2
  L44.4 24.8 L44.0 22.8 L44.1 21.3 L43.8 21.2 L43.2 21.9 L43.0 21.3 L43.4 19.8 L44.6 18.5
  L44.2 16.1 L44.8 14.5 L45.2 14.1 L45.6 14.1 L45.7 15.4 L46.1 16.1 L46.6 16.1 L47.3 14.0
  L48.3 12.9 L51.0 10.7 L53.3 10.0 L54.0 10.3 L52.6 11.4 L52.6 11.8 L58.0 10.6 L60.5 10.8
  L62.2 11.5 L64.5 13.4 L67.6 14.1 L69.5 15.3 L70.2 16.1 L71.4 18.9 L73.1 19.9 L73.9 20.9
  L74.5 22.9 L75.0 22.9 L75.3 21.9 L75.5 21.9 L75.8 23.1 L75.1 24.8 L76.5 26.4 L77.6 28.5
  L77.6 30.8 L77.0 31.4 L76.7 34.4 L75.7 36.9 L74.9 37.9 L74.1 39.7 L72.2 43.1 L67.8 48.3
  L65.6 51.7 L65.3 56.6 L65.6 58.1 L67.5 58.9 L70.4 61.3 L75.5 63.8 L78.0 64.7 L83.0 65.4
  L86.7 66.8 L91.9 70.4 L97.6 75.8 L99.2 76.9 L100.3 78.2 L102.8 79.7 L104.4 81.0 L106.0 81.5
  L108.4 83.1 L109.7 84.8 L110.5 85.2 L111.1 84.9 L116.0 77.7 L118.2 72.8 L119.5 68.6 L120.2 65.4
  L120.2 64.2 L119.8 63.1 L117.3 60.7 L116.1 58.7 L113.8 52.4 L113.9 51.0 L114.9 50.0 L116.8 49.6
  L117.5 46.7 L118.8 46.1 L126.3 47.4 L128.0 48.7 L128.6 49.9 L129.1 66.8 L128.0 72.6 L127.1 85.1
  L126.2 89.5 L125.2 92.9 L120.6 103.6 L118.9 105.0 L117.9 105.2 L116.2 105.2 L110.4 103.8 L102.2 100.8
  L99.3 101.9 L98.1 101.9 L85.8 95.2 L84.7 94.8 L83.7 94.8 L82.8 95.8 L80.8 101.2 L77.4 113.2
  L76.2 118.8 L74.8 123.7 L74.8 124.8 L76.9 131.5 L76.9 132.7 L76.1 136.0 L76.1 137.0 L77.1 141.5
  L77.7 150.3 L77.7 151.7 L76.9 152.9 L76.9 154.2 L77.7 161.1 L78.2 169.7 L78.7 191.9 L78.3 192.7
  L75.6 193.8 L75.2 194.3 L73.4 205.2 L73.7 214.9 L74.4 218.9 L75.3 220.9 L76.5 226.0 L77.1 230.4
  L77.4 236.2 L77.1 239.2 L76.5 242.6 L70.9 263.0 L70.0 267.7 L70.0 272.0 L70.8 274.2 L71.1 277.1
  L71.8 280.9 L71.8 285.0 L71.2 287.2 L70.4 288.6 L70.0 290.3 L69.6 290.8 L68.2 291.4 L66.9 292.6
  L66.1 294.2 Z
  M50.8 295.1 L50.8 294.2 L50.5 293.5 L49.4 292.3 L48.9 291.3 L48.9 288.8 L49.8 287.0 L53.0 283.5
  L54.7 280.1 L55.6 277.4 L55.5 276.5 L55.7 275.5 L57.3 273.6 L57.5 271.3 L58.4 269.7 L59.2 266.3
  L59.5 259.3 L58.9 251.8 L56.9 242.6 L56.3 238.7 L56.5 234.7 L57.4 227.1 L57.3 221.6 L54.9 214.4
  L53.8 209.2 L52.1 203.9 L50.0 194.1 L49.4 193.4 L44.2 191.7 L42.9 191.0 L42.3 190.3 L42.2 186.5
  L41.4 180.1 L40.1 172.7 L39.4 171.2 L36.7 171.6 L32.8 173.2 L26.3 176.3 L20.7 179.5 L19.1 180.1
  L16.9 180.0 L14.5 178.9 L9.2 174.6 L4.4 174.4 L2.8 174.7 L2.0 175.4 L2.0 176.1 L6.0 188.4
  L6.9 192.6 L7.1 195.7 L6.9 199.6 L5.3 208.4 L5.3 214.1 L5.8 221.3 L6.7 226.6 L7.1 227.2
  L8.5 227.9 L9.0 228.7 L9.6 231.9 L11.0 236.2 L11.4 238.7 L11.0 242.6 L10.6 243.8 L9.4 245.4
  L8.9 247.2 L7.9 247.8 L7.1 247.8 L6.4 247.4 L5.9 246.5 L5.5 246.4 L4.0 246.8 L3.6 247.5
  L4.5 248.5 L8.4 250.5 L9.9 251.6 L13.5 255.1 L15.7 258.3 L17.3 261.5 L18.5 265.4 L19.1 269.0
  L19.1 271.7 L18.4 275.9 L16.7 280.4 L14.2 284.8 L11.0 288.3 L8.1 290.4 L5.1 291.9 L1.2 293.1
  L-5.0 293.9 L-5.9 294.2 L-5.9 295.1 Z`;

const FOOT_M_CELEBRATE_ART = {"src": "img/figures/foot-m-celebrate.edb863c7.webp", "box": [-30.49, -1.21, 130.43, 301.24]};

const FOOT_W_CELEBRATE_TRACE = `M94.3 299.9 L17.6 299.9 L17.4 299.8 L17.4 294.2 L13.7 292.9 L10.3 291.3 L7.1 289.2 L5.2 287.5
  L2.8 284.9 L0.7 281.7 L-1.4 276.5 L-2.0 273.6 L-2.3 268.8 L-1.8 265.2 L-0.7 261.5 L0.7 258.8
  L2.6 256.0 L7.2 251.3 L6.9 250.1 L5.3 247.8 L5.1 246.1 L5.4 244.6 L6.7 242.7 L13.0 236.8
  L17.1 231.9 L17.3 231.4 L16.2 230.3 L15.7 229.2 L15.8 227.2 L16.5 226.0 L17.7 225.2 L19.4 224.6
  L22.2 224.4 L22.5 223.9 L23.0 221.3 L23.6 219.9 L24.1 219.4 L26.1 218.6 L26.3 218.3 L26.1 217.1
  L24.3 211.1 L17.9 192.3 L15.7 183.5 L15.3 180.0 L15.3 172.9 L16.4 165.3 L16.3 158.5 L16.9 154.5
  L18.5 150.7 L22.0 145.1 L24.0 142.6 L30.1 136.8 L31.3 133.8 L32.5 132.5 L33.7 131.6 L34.9 128.4
  L37.2 126.2 L38.0 123.5 L39.0 121.4 L40.8 118.6 L42.6 116.6 L42.6 113.3 L43.5 111.7 L44.1 109.5
  L43.6 107.3 L42.7 105.3 L42.1 104.8 L39.4 106.4 L38.4 107.3 L37.8 108.4 L37.9 110.1 L37.6 110.2
  L36.7 108.4 L36.9 106.9 L37.6 105.3 L37.3 105.0 L34.7 106.4 L33.1 107.7 L32.3 109.1 L32.5 110.6
  L32.3 110.9 L31.5 110.5 L31.1 110.0 L30.5 108.7 L30.4 107.3 L29.9 107.1 L29.1 109.1 L29.1 110.3
  L29.8 111.9 L29.5 112.1 L27.7 110.9 L26.8 109.6 L26.3 108.4 L25.9 106.5 L25.9 105.2 L26.4 103.4
  L26.2 103.2 L22.8 105.1 L21.2 105.6 L18.2 105.6 L17.1 105.3 L14.0 103.6 L13.5 103.1 L13.7 102.9
  L16.0 103.1 L18.0 102.6 L19.4 101.2 L20.2 100.0 L20.4 97.7 L19.3 93.4 L19.2 91.6 L18.8 91.4
  L18.3 92.3 L17.5 95.2 L17.7 97.7 L18.7 99.9 L18.0 99.8 L16.4 99.1 L15.3 98.2 L14.1 96.4
  L13.2 94.6 L12.5 91.9 L12.5 88.8 L12.9 87.0 L13.9 84.6 L15.2 82.8 L15.4 82.0 L15.1 81.9
  L12.8 82.9 L11.4 83.8 L9.8 85.6 L9.2 87.1 L8.9 88.8 L9.1 90.0 L10.0 92.3 L9.8 92.4
  L8.4 91.4 L7.3 89.7 L6.7 87.5 L6.7 84.7 L7.2 82.8 L8.3 80.7 L9.8 79.0 L12.2 77.2
  L12.2 76.6 L17.7 74.9 L18.0 74.8 L18.0 74.4 L10.2 72.2 L8.6 71.5 L7.0 69.9 L6.2 68.4
  L5.7 66.3 L5.1 65.4 L-5.8 59.9 L-9.6 57.4 L-11.1 55.6 L-11.4 54.6 L-11.3 49.1 L-10.4 43.2
  L-9.0 36.7 L-2.9 14.8 L-0.7 2.5 L-0.1 1.2 L1.2 0.6 L4.4 0.6 L7.9 -0.1 L9.6 0.1
  L10.6 0.7 L11.9 3.7 L13.2 5.0 L13.7 6.0 L13.7 7.0 L13.2 8.4 L10.8 12.2 L9.2 13.9
  L5.5 16.1 L4.9 16.9 L3.2 23.2 L2.3 29.0 L2.0 32.7 L2.2 49.0 L2.6 49.4 L8.9 51.2
  L11.1 51.0 L17.1 52.1 L19.7 49.8 L25.2 46.4 L24.8 46.1 L22.5 46.2 L20.5 45.5 L19.3 44.3
  L19.0 43.7 L19.1 42.9 L21.4 44.3 L24.6 44.5 L27.7 43.7 L30.5 42.0 L31.2 37.3 L33.1 32.6
  L33.0 32.4 L32.4 32.7 L31.0 34.3 L30.1 36.4 L29.8 38.5 L29.3 37.6 L29.2 35.7 L29.9 33.5
  L31.6 30.9 L35.2 27.5 L36.8 26.4 L37.5 25.5 L36.0 25.9 L32.7 27.8 L30.0 29.8 L28.5 31.2
  L27.4 32.8 L26.9 34.1 L26.7 36.9 L26.2 36.0 L26.0 34.6 L27.0 31.7 L28.5 29.8 L30.0 28.4
  L36.0 24.5 L36.9 23.7 L38.4 23.4 L39.6 22.7 L41.7 19.9 L43.1 17.5 L42.8 16.7 L44.2 14.8
  L47.8 10.9 L52.6 7.3 L55.8 5.7 L58.9 4.8 L62.7 4.1 L65.9 4.2 L68.8 5.0 L70.0 5.6
  L71.8 7.2 L73.0 9.2 L75.6 10.2 L78.1 11.6 L80.4 14.4 L82.3 18.3 L84.2 24.8 L86.1 34.7
  L89.7 43.1 L90.2 45.1 L90.2 47.4 L89.4 49.7 L89.7 48.3 L89.6 45.3 L88.6 42.2 L87.1 39.1
  L86.8 39.0 L86.8 40.0 L87.5 44.5 L87.5 48.2 L88.0 50.8 L88.6 51.4 L89.0 54.1 L88.3 53.8
  L88.0 54.2 L88.0 57.1 L87.0 60.8 L85.9 62.3 L83.9 63.7 L83.9 64.2 L84.6 64.7 L85.9 64.7
  L87.0 64.4 L88.3 63.1 L89.5 60.5 L89.4 58.9 L89.5 57.4 L89.7 57.3 L90.0 59.2 L89.5 62.5
  L88.3 64.6 L86.4 65.8 L86.3 66.3 L89.5 69.1 L96.6 78.2 L102.9 84.9 L103.5 86.1 L103.3 88.3
  L108.5 96.2 L111.1 101.2 L111.2 103.0 L109.5 107.7 L107.7 111.6 L104.7 116.5 L94.7 130.0 L93.6 130.7
  L92.3 130.6 L91.7 130.9 L91.7 131.5 L93.8 137.9 L94.6 141.8 L95.1 144.9 L95.6 151.3 L99.0 172.8
  L98.5 174.0 L97.0 175.5 L94.8 176.8 L92.0 177.7 L91.5 178.4 L84.1 203.3 L83.0 208.7 L82.7 211.2
  L82.7 214.6 L83.3 222.5 L83.2 227.9 L82.8 231.5 L80.5 243.3 L77.2 255.6 L75.3 263.7 L75.4 264.8
  L76.8 266.8 L77.7 269.6 L78.2 269.8 L80.3 269.7 L82.4 270.1 L83.4 270.6 L84.4 271.7 L84.7 272.4
  L84.7 274.2 L83.5 275.9 L83.9 276.9 L85.5 279.2 L89.0 282.8 L91.0 284.3 L94.8 286.4 L96.0 287.7
  L96.4 288.9 L96.4 290.4 L96.0 291.5 L95.0 292.5 L94.4 294.2 Z
  M75.3 295.1 L75.3 294.2 L74.4 293.5 L74.0 292.5 L73.3 291.8 L69.0 288.9 L68.4 288.7 L67.2 289.2
  L65.8 289.0 L65.2 288.5 L64.7 287.5 L64.2 287.0 L62.6 287.9 L61.0 287.3 L60.5 286.8 L60.1 285.4
  L59.1 284.3 L58.6 282.9 L58.6 281.1 L59.4 275.9 L60.7 270.2 L62.4 266.7 L64.5 264.9 L64.9 264.1
  L65.1 259.2 L64.9 253.8 L62.8 237.8 L62.7 230.4 L63.6 224.1 L65.5 216.4 L65.5 202.6 L66.6 195.6
  L67.1 189.4 L67.1 184.9 L66.7 179.6 L66.3 178.5 L64.3 177.4 L63.7 176.1 L62.7 165.1 L62.2 161.9
  L61.9 161.4 L61.5 161.3 L57.1 165.6 L53.1 168.7 L51.4 170.7 L49.7 171.6 L47.7 171.9 L45.6 171.5
  L42.2 170.3 L38.0 168.1 L37.4 168.0 L36.9 168.3 L38.9 176.6 L39.5 183.4 L39.2 190.8 L37.6 202.0
  L37.3 208.5 L37.6 217.3 L38.0 218.7 L39.8 220.2 L41.4 224.1 L43.1 231.2 L43.5 235.5 L43.0 237.1
  L41.5 239.2 L40.8 241.6 L39.7 241.9 L38.4 241.4 L37.8 241.8 L37.1 243.3 L35.9 243.8 L35.2 243.7
  L34.4 243.0 L33.8 243.0 L29.3 246.0 L28.7 247.2 L29.0 247.6 L33.2 248.8 L36.9 250.5 L40.5 253.3
  L43.5 256.7 L45.1 258.9 L47.1 263.7 L48.3 269.2 L48.3 273.7 L47.6 277.0 L46.8 279.5 L44.7 283.0
  L42.4 286.0 L39.5 288.9 L37.4 290.6 L35.9 291.5 L32.6 293.1 L29.0 294.2 L29.0 295.0 L29.3 295.1 Z`;

const FOOT_W_CELEBRATE_ART = {"src": "img/figures/foot-w-celebrate.89502d62.webp", "box": [-12.63, -1.21, 112.61, 301.1]};

const RUN_M_RUN_ART = {"src": "img/figures/run-m-run.b30c43da.webp", "box": [-51.47, -1.39, 151.48, 301.27]};

const RUN_W_SPRINT_TRACE = `M119.0 299.9 L103.7 299.9 L103.6 294.2 L98.1 292.2 L94.5 290.2 L92.4 288.6 L89.7 285.5 L87.8 280.9
  L86.3 278.6 L84.3 276.8 L79.8 274.5 L76.1 271.8 L73.7 269.3 L71.8 265.7 L71.6 263.2 L72.0 261.8
  L72.7 260.5 L74.4 258.8 L76.8 257.4 L81.6 250.5 L83.2 247.5 L84.5 246.7 L86.0 246.6 L86.5 245.5
  L86.8 240.5 L86.5 233.0 L84.2 216.8 L82.4 207.7 L82.0 203.9 L82.2 200.0 L82.9 196.2 L85.1 191.1
  L87.7 187.0 L93.4 180.5 L94.1 179.4 L93.8 178.7 L92.7 178.1 L88.0 176.8 L82.2 176.3 L75.7 176.4
  L71.0 176.1 L66.7 175.5 L65.7 175.7 L61.6 181.7 L58.7 185.3 L53.6 190.9 L50.2 194.0 L40.7 201.2
  L39.4 202.6 L36.5 206.9 L34.4 209.5 L30.8 212.1 L27.6 214.0 L21.9 220.9 L17.8 225.1 L4.5 235.6
  L0.3 239.3 L-4.1 243.9 L-6.1 246.6 L-6.1 247.1 L-5.3 248.5 L-5.3 249.6 L-8.2 252.4 L-8.7 253.9
  L-10.2 255.4 L-13.2 262.4 L-13.4 263.7 L-14.1 265.7 L-14.6 274.7 L-14.9 275.7 L-15.7 276.8 L-16.6 277.8
  L-18.5 278.4 L-20.1 278.4 L-21.7 278.0 L-23.8 276.8 L-25.7 274.9 L-27.4 272.6 L-28.4 270.7 L-29.8 266.3
  L-30.2 264.0 L-30.2 262.3 L-29.8 260.2 L-28.0 255.9 L-27.3 252.9 L-27.4 250.1 L-29.0 244.5 L-29.4 241.8
  L-29.2 238.0 L-28.6 235.7 L-27.9 234.2 L-26.2 232.3 L-24.9 231.5 L-23.9 231.2 L-21.7 231.4 L-18.9 232.9
  L-16.1 233.5 L-13.9 233.2 L-12.5 233.2 L-11.1 233.6 L-10.6 233.4 L-8.0 230.6 L-4.8 225.7 L-2.2 220.6
  L-0.7 216.0 L0.8 212.8 L3.6 208.8 L8.5 204.6 L15.0 200.7 L17.2 198.8 L21.0 192.9 L22.9 189.5
  L25.3 180.1 L28.0 173.0 L31.4 166.7 L34.3 162.5 L34.1 161.7 L31.7 159.1 L30.0 156.4 L29.1 154.3
  L28.1 150.7 L27.7 147.7 L27.8 144.1 L28.4 140.8 L29.6 137.5 L32.1 132.7 L35.7 128.4 L40.7 124.8
  L46.7 121.9 L51.3 118.9 L54.5 115.6 L55.7 113.4 L56.2 111.6 L55.2 107.0 L53.1 101.1 L47.8 91.0
  L44.6 86.4 L43.2 84.0 L41.6 79.9 L40.7 79.0 L39.4 79.0 L28.7 84.0 L23.0 86.2 L12.6 89.3
  L11.6 90.9 L9.2 97.3 L4.7 105.4 L2.0 111.1 L0.0 116.8 L-1.0 121.5 L-1.3 123.8 L-1.2 126.1
  L2.9 131.9 L4.1 134.6 L3.7 141.8 L2.4 143.4 L-0.3 146.0 L-1.3 146.6 L-2.3 146.7 L-3.6 146.4
  L-4.7 146.5 L-6.6 145.7 L-7.7 145.5 L-10.2 143.9 L-11.4 142.9 L-13.5 139.9 L-13.9 138.3 L-12.2 131.4
  L-10.8 126.9 L-10.7 124.1 L-9.1 117.8 L-8.1 108.6 L-6.7 100.1 L-5.0 93.4 L-3.5 89.1 L-2.3 86.3
  L-0.7 83.5 L2.0 81.0 L8.2 76.2 L15.6 71.2 L20.4 68.7 L25.8 66.6 L30.8 61.4 L34.0 59.1
  L38.2 57.0 L42.1 56.0 L45.1 55.8 L50.5 56.7 L52.0 56.7 L54.9 56.1 L59.2 54.7 L60.6 54.5
  L62.3 53.3 L64.3 50.9 L65.4 48.6 L66.4 44.9 L66.4 43.9 L65.9 43.1 L63.6 42.0 L61.5 40.5
  L59.5 38.4 L57.8 36.0 L56.4 32.5 L55.8 29.9 L55.7 26.4 L56.8 20.7 L58.3 17.1 L58.2 16.6
  L57.6 16.6 L55.7 17.6 L54.5 18.8 L52.7 21.5 L50.8 26.1 L48.8 35.0 L46.7 41.3 L45.4 44.0
  L43.7 46.3 L42.0 48.3 L39.8 50.2 L35.4 52.8 L34.1 53.2 L33.7 53.0 L37.9 49.2 L39.5 47.0
  L41.9 42.3 L43.0 38.5 L43.1 37.6 L42.9 37.5 L38.7 43.9 L35.2 48.0 L30.7 51.9 L26.6 54.5
  L22.6 56.5 L18.6 57.7 L15.6 58.2 L10.5 58.2 L6.4 57.2 L3.6 56.0 L2.7 54.9 L6.5 55.6
  L10.5 55.5 L14.8 54.3 L17.2 53.0 L18.4 52.0 L17.4 52.1 L14.1 53.2 L10.7 53.7 L6.2 53.5
  L1.7 52.3 L-0.3 51.1 L-3.4 48.1 L-4.9 45.4 L-5.5 43.4 L-5.5 42.4 L-5.1 42.5 L-2.5 45.0
  L-0.3 46.4 L1.8 47.1 L3.9 47.6 L5.7 47.8 L8.4 47.5 L9.4 47.2 L9.8 46.8 L7.5 46.3
  L3.8 44.9 L-5.3 39.4 L-7.4 38.6 L-10.0 38.1 L-12.1 37.9 L-15.9 38.7 L-18.4 40.0 L-20.7 42.2
  L-20.6 41.2 L-19.6 39.2 L-17.3 36.6 L-15.8 35.5 L-13.2 34.4 L-10.9 33.8 L-8.3 33.6 L-8.0 33.2
  L-8.9 32.4 L-12.5 30.9 L-15.0 30.4 L-16.6 30.4 L-19.3 30.9 L-21.4 31.9 L-23.6 33.8 L-25.5 37.3
  L-25.8 37.4 L-25.9 35.7 L-25.2 32.6 L-23.6 29.6 L-21.9 27.8 L-19.3 25.9 L-16.0 24.4 L-12.5 23.7
  L-9.0 23.4 L-9.6 23.0 L-11.4 22.7 L-13.6 22.7 L-16.4 23.2 L-19.1 24.3 L-22.5 26.8 L-22.7 26.4
  L-22.3 25.8 L-20.3 23.6 L-16.0 21.2 L-12.7 20.4 L-8.6 20.1 L-3.6 20.7 L-4.3 20.0 L-6.6 19.0
  L-9.3 18.4 L-12.0 18.1 L-15.9 19.0 L-17.9 20.0 L-19.8 21.6 L-20.3 21.7 L-19.3 19.7 L-17.4 17.6
  L-15.4 16.2 L-13.7 15.3 L-11.5 14.6 L-8.3 14.0 L-3.6 14.1 L1.4 15.2 L10.7 18.6 L12.9 19.1
  L15.0 19.2 L15.1 19.1 L14.8 18.9 L11.4 17.6 L3.5 13.6 L-1.4 12.1 L-4.3 12.0 L-4.9 11.8
  L-4.7 11.5 L-2.6 11.1 L1.7 11.4 L6.2 12.6 L12.1 15.2 L15.8 16.4 L19.0 16.9 L22.5 16.8
  L25.8 15.7 L27.3 14.8 L30.0 12.7 L35.3 7.9 L37.5 6.4 L41.3 4.2 L41.0 4.0 L39.8 4.1
  L36.6 5.1 L32.7 7.1 L28.9 9.9 L25.0 13.7 L24.9 13.4 L25.5 12.2 L27.1 9.8 L29.7 6.9
  L32.4 4.8 L36.2 2.5 L39.1 1.4 L45.6 0.1 L50.9 0.1 L54.8 0.8 L57.7 1.8 L60.9 3.8
  L62.5 5.4 L63.3 6.6 L64.1 8.6 L64.6 9.0 L70.3 5.9 L72.0 5.3 L75.6 4.5 L77.9 4.2
  L81.8 4.4 L87.3 5.6 L90.1 6.8 L92.3 8.4 L94.4 10.3 L95.5 12.2 L95.8 14.1 L97.1 16.4
  L97.5 17.8 L97.5 19.8 L96.7 22.3 L97.3 25.0 L96.8 27.8 L97.2 28.6 L96.2 29.6 L95.8 30.7
  L96.4 34.1 L96.4 35.7 L96.0 37.4 L92.9 44.6 L91.8 47.8 L90.6 49.1 L88.9 49.6 L84.3 48.9
  L83.6 49.2 L83.2 50.3 L82.2 55.1 L82.2 58.2 L82.8 58.7 L88.4 61.3 L91.2 61.8 L95.1 61.8
  L97.0 62.1 L100.2 63.3 L102.3 64.7 L104.6 67.5 L106.5 70.6 L108.7 76.6 L110.2 82.3 L113.2 85.9
  L116.0 90.2 L116.5 89.6 L116.6 85.2 L116.1 80.9 L115.6 78.8 L114.5 76.8 L112.2 74.4 L110.8 72.4
  L109.1 67.4 L107.5 64.5 L107.3 62.5 L108.0 61.6 L109.9 61.2 L110.7 58.7 L111.6 58.0 L112.7 57.8
  L119.5 59.0 L120.1 59.3 L120.8 60.4 L122.2 61.7 L123.0 65.5 L123.1 77.1 L124.7 84.2 L128.7 97.4
  L130.0 103.8 L130.1 106.2 L129.6 110.8 L127.0 118.2 L125.6 120.1 L124.0 120.8 L122.2 120.7 L120.3 120.0
  L117.6 118.4 L115.2 116.5 L111.2 112.3 L104.2 103.2 L100.9 98.1 L100.5 97.8 L100.0 98.0 L97.6 100.5
  L95.9 101.8 L93.7 111.4 L89.2 121.1 L88.3 125.0 L86.9 136.6 L84.9 145.3 L84.9 145.9 L85.2 146.2
  L93.0 150.0 L100.5 154.3 L104.2 156.7 L109.1 160.5 L112.6 163.6 L116.1 167.3 L117.9 170.3 L118.4 172.0
  L118.7 174.8 L118.0 179.0 L116.8 182.3 L113.0 189.7 L110.0 200.5 L102.5 222.8 L100.5 231.6 L100.0 236.1
  L99.9 241.0 L100.2 246.5 L101.0 250.9 L101.6 251.7 L104.0 252.0 L104.9 253.0 L104.9 259.2 L105.7 260.4
  L105.7 262.5 L107.0 266.2 L107.5 268.5 L108.7 270.6 L109.0 272.3 L109.8 274.1 L110.7 274.8 L111.3 276.6
  L112.3 278.0 L114.9 281.1 L120.4 286.2 L121.5 288.1 L121.6 290.5 L121.3 292.0 L120.6 293.2 L119.0 294.3 Z`;

const RUN_W_SPRINT_ART = {"src": "img/figures/run-w-sprint.e7d2cd4d.webp", "box": [-31.24, -1.07, 131.14, 301.01]};

const BOX_M_VICTORY_TRACE = `M107.0 299.9 L-7.2 299.9 L-7.2 294.3 L-7.9 293.5 L-8.6 292.0 L-8.6 288.9 L-7.7 285.9 L-4.7 281.2
  L-3.2 278.0 L-2.1 274.9 L-1.1 270.7 L-0.1 264.2 L0.1 249.7 L0.3 249.2 L1.2 248.4 L1.5 247.5
  L2.8 246.8 L3.2 246.1 L3.6 232.3 L4.5 224.4 L5.2 221.3 L6.4 217.7 L11.6 206.4 L13.0 201.0
  L13.9 196.4 L14.2 190.3 L12.5 177.5 L12.0 176.6 L9.5 175.6 L9.2 174.5 L16.4 134.9 L18.0 128.4
  L19.6 123.7 L21.8 118.9 L22.0 117.5 L22.4 110.4 L21.8 108.0 L22.0 103.9 L21.7 97.7 L21.1 93.7
  L18.9 86.7 L17.5 79.5 L16.7 77.3 L14.1 71.4 L12.8 67.0 L11.9 66.8 L4.0 69.0 L0.9 69.5
  L-2.9 69.5 L-6.4 69.0 L-13.2 67.2 L-22.5 63.6 L-27.7 61.0 L-28.4 60.1 L-28.4 59.5 L-26.5 53.5
  L-23.3 45.5 L-19.3 37.9 L-14.3 30.5 L-14.3 30.0 L-14.8 29.0 L-14.8 28.3 L-8.6 18.2 L-6.1 10.8
  L-4.3 6.6 L-3.4 5.2 L-1.8 3.6 L0.6 2.3 L3.5 1.5 L6.8 1.5 L8.6 1.8 L12.6 2.9
  L16.3 4.9 L18.0 6.6 L19.7 9.5 L20.1 11.7 L19.3 13.2 L19.3 13.9 L20.4 15.4 L20.7 16.5
  L19.9 18.4 L19.1 19.5 L18.1 20.5 L16.1 21.9 L11.3 24.3 L4.8 26.8 L4.0 27.4 L1.9 29.7
  L-2.4 36.1 L-3.0 36.7 L-4.1 37.0 L-4.6 37.4 L-5.9 40.6 L-6.8 44.5 L-7.2 46.4 L-6.9 47.2
  L-6.2 47.1 L-2.6 45.0 L0.5 44.2 L3.9 44.2 L5.9 44.7 L7.8 45.7 L8.6 45.7 L13.6 43.0
  L17.4 41.7 L18.9 41.5 L21.7 41.5 L26.3 42.3 L33.6 38.7 L35.2 38.6 L38.9 37.4 L39.3 36.8
  L39.5 35.4 L39.5 25.5 L39.2 25.0 L38.2 24.3 L37.2 23.1 L36.4 21.4 L36.2 20.0 L36.2 18.8
  L36.6 17.5 L38.0 15.7 L37.9 12.4 L38.7 7.7 L39.6 5.7 L40.5 4.4 L42.1 2.8 L43.4 1.9
  L46.9 0.3 L49.0 -0.1 L51.1 -0.1 L52.7 0.2 L54.7 0.9 L58.2 3.1 L59.6 4.7 L61.2 7.6
  L62.0 11.8 L62.0 15.9 L63.4 17.6 L63.7 20.2 L62.9 22.6 L61.8 24.3 L60.8 24.8 L60.4 25.5
  L60.4 34.5 L60.5 36.8 L61.0 37.4 L64.9 38.6 L66.4 38.7 L73.5 42.3 L78.3 41.5 L82.5 41.7
  L86.3 43.0 L91.7 45.8 L93.9 44.8 L96.2 44.2 L99.5 44.2 L102.7 45.1 L106.6 47.2 L107.1 46.8
  L107.0 45.7 L105.7 40.3 L104.7 37.5 L104.2 37.0 L103.1 36.9 L102.5 36.6 L98.1 29.9 L96.0 27.3
  L95.4 26.8 L89.6 24.6 L83.8 21.9 L81.0 19.7 L80.0 18.3 L79.3 16.6 L79.5 15.6 L80.7 13.6
  L79.9 11.8 L79.9 10.6 L80.3 9.3 L82.3 6.3 L83.5 5.0 L85.0 4.0 L89.2 2.3 L94.5 1.4
  L98.3 1.9 L101.4 3.4 L102.8 4.7 L104.0 6.4 L106.2 11.3 L108.5 18.2 L114.7 28.3 L114.3 30.7
  L118.5 36.8 L120.7 40.5 L123.4 45.9 L125.8 51.6 L128.0 58.2 L128.2 60.1 L127.1 61.4 L122.2 63.7
  L115.7 66.3 L110.5 68.0 L106.6 69.0 L103.0 69.5 L98.0 69.4 L94.8 68.8 L89.0 67.1 L87.5 66.9
  L87.2 67.1 L85.8 71.8 L83.5 76.6 L82.5 79.3 L81.1 86.7 L78.7 94.1 L78.1 100.3 L78.1 108.9
  L77.6 110.5 L77.6 114.2 L78.0 118.2 L80.7 124.4 L83.2 133.3 L90.8 174.6 L90.5 175.6 L88.2 176.5
  L87.5 177.5 L85.8 190.3 L85.8 194.0 L86.2 197.2 L87.6 203.6 L88.8 207.4 L93.1 216.5 L94.7 220.9
  L95.4 223.8 L96.0 228.1 L96.4 233.1 L96.7 245.9 L97.0 246.8 L98.4 247.5 L98.9 248.6 L99.7 249.6
  L100.0 262.3 L100.9 269.4 L101.7 273.3 L103.2 278.0 L105.0 281.8 L107.5 285.4 L108.5 288.2 L108.4 292.3
  L107.9 293.5 L107.1 294.3 Z
  M90.8 295.1 L90.8 294.2 L89.5 293.3 L87.3 291.0 L86.1 289.3 L85.6 288.1 L85.2 282.5 L85.4 279.8
  L86.0 275.9 L85.6 271.5 L85.6 265.2 L85.0 263.6 L82.4 251.7 L82.5 250.6 L83.0 250.0 L83.0 249.2
  L80.8 244.2 L74.8 233.4 L73.4 229.4 L73.1 226.4 L73.3 211.7 L72.8 209.0 L72.0 206.9 L70.4 204.2
  L66.9 194.6 L63.7 188.0 L61.6 182.7 L60.9 182.4 L54.9 182.6 L54.4 182.3 L54.0 181.7 L51.3 164.1
  L50.6 157.0 L50.3 156.0 L50.0 155.9 L49.6 157.0 L48.2 167.7 L45.9 181.8 L45.5 182.5 L44.6 182.8
  L39.1 182.4 L38.3 182.8 L36.4 187.6 L32.9 195.2 L29.7 203.7 L28.0 206.9 L27.3 208.5 L26.7 211.6
  L26.6 213.6 L26.8 227.0 L26.6 229.1 L25.0 233.7 L19.8 243.1 L17.1 249.0 L17.0 249.7 L17.7 250.7
  L17.7 251.8 L16.4 256.7 L15.1 263.2 L14.4 265.5 L14.5 267.5 L14.2 277.9 L14.8 281.1 L14.5 288.1
  L14.0 289.3 L12.8 290.8 L10.2 293.4 L9.0 294.2 L9.0 295.0 L9.3 295.1 Z`;

const BOX_M_VICTORY_ART = {"src": "img/figures/box-m-victory.22eaca55.webp", "box": [-29.35, -1.22, 129.58, 301.2]};

const BOX_M_CHAMPION_TRACE = `M103.2 299.9 L-5.7 299.9 L-5.8 299.8 L-5.8 294.3 L-7.0 293.1 L-7.4 291.8 L-6.9 289.3 L-5.7 287.3
  L-1.6 283.8 L1.2 281.1 L3.5 278.0 L5.6 274.5 L6.6 272.3 L8.1 264.0 L8.1 248.2 L8.6 247.0
  L9.5 246.2 L9.8 245.8 L9.3 231.9 L9.3 223.2 L9.5 220.7 L10.9 214.9 L13.8 207.1 L14.1 202.2
  L14.9 196.8 L14.1 189.5 L10.0 187.6 L9.3 187.1 L9.0 186.5 L9.2 184.0 L9.7 182.3 L12.1 164.0
  L12.4 160.1 L11.9 159.6 L9.6 158.2 L8.6 157.2 L8.5 156.7 L14.8 124.2 L14.5 123.8 L12.7 124.0
  L10.8 123.5 L7.0 121.6 L0.4 117.1 L-3.6 113.3 L-6.4 109.8 L-8.4 106.5 L-9.0 104.1 L-9.3 101.8
  L-9.0 97.4 L-8.2 94.2 L-5.4 89.4 L-2.9 82.3 L0.3 75.8 L3.2 70.8 L4.3 66.1 L5.3 63.1
  L7.7 57.9 L9.1 55.8 L10.8 53.8 L13.3 52.1 L15.5 51.0 L24.8 47.3 L27.5 45.8 L26.4 41.7
  L26.1 38.3 L26.3 35.9 L27.1 31.7 L28.5 27.7 L31.6 20.0 L36.9 8.6 L38.9 5.8 L42.1 3.0
  L45.6 1.1 L49.1 -0.1 L51.2 -0.1 L52.6 0.3 L56.9 2.3 L60.6 5.1 L63.0 8.1 L64.7 11.3
  L67.2 17.0 L70.4 25.1 L72.0 30.1 L72.8 34.4 L72.9 37.8 L72.8 41.1 L72.0 45.5 L75.2 47.1
  L86.5 51.9 L89.8 54.1 L91.7 56.3 L93.1 58.7 L94.7 62.0 L96.0 65.4 L97.3 71.1 L102.4 80.9
  L104.2 85.6 L105.6 90.0 L108.2 94.5 L108.9 97.3 L109.2 101.8 L108.9 104.3 L108.0 107.1 L106.4 109.8
  L103.5 113.5 L100.7 116.2 L96.6 119.3 L91.9 122.4 L87.7 123.8 L85.6 122.4 L84.1 121.0 L82.9 118.9
  L80.4 112.9 L80.0 112.6 L79.6 112.9 L80.0 114.6 L81.6 118.7 L82.6 120.5 L84.7 123.4 L88.7 143.5
  L90.1 151.8 L91.1 155.6 L91.1 157.1 L90.8 157.7 L87.8 159.5 L87.3 160.4 L89.0 174.5 L90.8 186.0
  L90.6 186.8 L89.8 187.6 L85.9 189.1 L85.5 189.5 L84.8 196.8 L85.5 201.5 L86.1 207.3 L89.5 216.5
  L90.3 220.8 L90.6 223.5 L90.6 230.0 L90.0 245.8 L90.2 246.4 L91.3 247.2 L91.7 248.8 L91.5 255.5
  L91.6 264.9 L92.3 267.8 L92.3 269.9 L93.2 273.2 L95.3 278.1 L98.6 282.7 L103.3 287.4 L104.6 290.0
  L104.6 292.6 L104.0 293.7 L103.3 294.3 Z
  M89.6 295.1 L89.6 294.2 L88.1 293.5 L86.7 292.5 L85.3 290.0 L84.3 289.0 L79.5 286.8 L78.3 285.9
  L77.7 284.7 L77.6 283.0 L77.9 281.7 L78.0 279.3 L79.5 273.1 L79.2 269.7 L79.5 265.7 L78.4 258.4
  L76.2 249.0 L76.7 246.4 L75.1 240.7 L72.3 234.9 L70.8 229.9 L70.4 226.0 L70.4 222.0 L70.9 215.1
  L70.8 211.6 L67.5 204.3 L66.1 198.2 L64.1 192.9 L62.6 192.2 L57.9 191.7 L54.7 191.1 L53.9 190.7
  L53.5 190.0 L50.5 165.4 L50.1 163.6 L49.7 163.4 L49.3 165.2 L47.7 176.8 L46.2 189.9 L45.6 190.7
  L44.6 191.1 L41.9 191.7 L36.4 192.4 L35.5 192.8 L33.7 197.7 L31.8 205.3 L29.1 211.2 L29.0 215.0
  L29.3 219.6 L29.3 227.3 L29.1 229.3 L28.0 233.5 L24.6 241.1 L23.1 246.5 L23.4 248.1 L23.3 250.1
  L21.2 258.8 L20.2 265.3 L20.5 268.9 L20.2 272.8 L21.8 279.8 L22.1 282.7 L21.9 285.0 L20.5 286.5
  L15.5 288.4 L13.8 289.4 L11.2 292.5 L10.0 293.4 L8.1 294.2 L8.1 295.0 L8.4 295.1 Z`;

const BOX_M_CHAMPION_ART = {"src": "img/figures/box-m-champion.2fa519e5.webp", "box": [-10.43, -1.09, 110.43, 301.07]};

const BOX_W_GUARD_TRACE = `M95.6 299.9 L84.6 299.9 L84.3 299.8 L84.3 294.3 L83.8 293.1 L83.9 291.8 L83.5 290.2 L83.5 288.4
  L84.9 283.1 L84.9 276.1 L85.5 272.0 L84.8 268.3 L85.3 261.9 L84.5 256.5 L83.1 250.7 L79.1 238.6
  L76.5 233.1 L75.2 229.8 L74.5 226.0 L73.6 214.4 L73.2 212.7 L72.0 209.5 L69.7 204.8 L68.1 200.4
  L63.6 183.9 L57.3 169.5 L55.3 163.0 L54.0 156.5 L53.4 155.7 L50.9 156.1 L50.3 156.8 L48.6 162.9
  L46.2 169.7 L45.1 172.3 L37.0 187.9 L32.6 200.0 L29.1 207.3 L28.8 208.5 L29.1 218.8 L28.7 222.3
  L27.5 226.4 L24.8 231.6 L23.2 235.9 L21.2 242.8 L19.7 249.6 L19.5 255.8 L21.2 261.3 L21.2 263.1
  L20.9 264.0 L20.3 265.1 L19.2 266.2 L16.4 268.3 L15.3 271.5 L14.4 276.4 L12.9 278.1 L11.2 278.9
  L9.6 280.1 L7.3 280.6 L5.2 279.9 L3.2 279.9 L1.2 278.8 L0.1 277.4 L0.2 275.2 L0.9 273.9
  L2.8 272.1 L4.2 270.0 L5.6 267.3 L8.1 260.9 L10.0 256.8 L10.3 255.7 L10.1 253.8 L11.3 249.6
  L11.3 245.0 L9.8 224.4 L9.8 217.6 L10.8 211.8 L13.6 203.7 L14.8 194.6 L14.9 191.4 L14.2 182.9
  L14.2 177.2 L15.6 164.0 L17.8 152.5 L20.8 141.7 L22.7 132.5 L25.5 124.1 L27.8 114.6 L28.9 111.9
  L30.1 107.0 L29.8 104.2 L25.8 86.0 L24.9 78.6 L23.7 74.4 L23.2 70.6 L22.6 70.3 L17.6 69.8
  L14.8 69.9 L10.8 69.5 L8.4 68.8 L5.4 67.0 L4.1 65.6 L3.0 64.1 L2.3 62.7 L1.2 59.5
  L0.7 56.7 L0.7 53.6 L1.1 51.4 L2.5 47.7 L4.2 45.5 L5.7 43.9 L7.5 42.6 L10.1 41.3
  L15.3 39.8 L20.0 39.5 L21.9 39.8 L24.7 40.7 L27.8 42.6 L30.1 45.7 L33.5 46.6 L38.6 45.3
  L40.7 45.2 L42.9 44.3 L43.2 44.0 L43.2 43.1 L42.6 40.0 L40.8 37.3 L39.8 34.2 L39.2 29.9
  L39.4 28.7 L40.4 27.7 L40.3 25.7 L40.7 21.6 L41.7 17.6 L43.1 14.5 L44.3 12.9 L46.4 11.2
  L49.1 9.5 L50.1 5.7 L51.6 3.2 L52.8 2.1 L55.0 0.8 L58.3 -0.1 L60.4 0.1 L63.3 0.8
  L65.2 1.7 L67.4 3.3 L68.6 4.5 L70.1 6.6 L73.9 14.0 L76.1 17.4 L77.9 19.4 L81.7 22.1
  L81.7 22.4 L81.1 22.6 L78.1 21.6 L77.5 21.6 L77.9 22.4 L80.3 25.2 L81.3 26.7 L83.1 30.3
  L83.9 33.7 L84.1 35.5 L83.6 36.4 L81.3 32.5 L80.6 31.7 L80.3 31.7 L80.9 35.3 L80.9 37.8
  L80.0 41.9 L80.4 42.6 L82.5 44.6 L83.7 46.4 L84.8 49.1 L85.8 53.8 L88.0 57.1 L88.8 59.4
  L89.6 64.8 L89.4 71.8 L92.0 79.1 L93.2 86.0 L94.9 89.4 L95.5 92.1 L95.4 95.6 L93.7 100.1
  L92.9 104.3 L92.1 105.4 L90.0 107.2 L89.2 107.7 L87.6 108.1 L85.7 107.3 L80.8 102.0 L79.3 100.0
  L78.2 97.0 L77.4 91.0 L76.8 89.1 L76.5 88.5 L76.1 88.4 L74.8 91.0 L72.7 94.5 L70.7 104.8
  L70.7 106.4 L71.8 110.7 L72.9 112.7 L75.9 122.8 L78.4 127.9 L80.1 132.5 L84.7 148.2 L86.5 156.8
  L87.3 164.1 L87.3 173.7 L85.9 191.0 L86.2 196.6 L87.4 203.4 L88.2 205.5 L92.4 214.3 L93.8 218.2
  L94.6 222.1 L95.1 227.2 L95.1 233.7 L93.8 256.6 L93.9 260.8 L94.3 263.6 L95.5 267.9 L95.3 271.0
  L95.4 272.9 L96.3 276.1 L97.9 283.6 L99.8 288.9 L99.7 290.8 L99.1 292.4 L97.2 293.8 L95.7 294.2 Z`;

const BOX_W_GUARD_ART = {"src": "img/figures/box-w-guard.b410022b.webp", "box": [-0.9, -1.22, 101.07, 301.05]};

const BOX_W_READY_TRACE = `M91.2 299.9 L8.7 299.9 L8.5 299.8 L8.4 294.2 L7.2 294.0 L6.3 293.2 L5.2 292.7 L3.7 290.9
  L3.4 290.2 L4.3 286.6 L7.6 280.4 L10.7 271.7 L10.9 268.5 L12.2 263.2 L11.8 247.7 L11.1 234.8
  L11.1 225.8 L11.8 220.4 L12.6 216.9 L16.7 204.6 L17.9 196.3 L17.9 190.4 L17.5 186.5 L17.0 178.3
  L17.0 171.9 L17.5 162.4 L18.9 150.2 L20.4 143.2 L22.8 134.2 L29.0 115.4 L31.1 110.0 L31.6 107.7
  L31.4 102.9 L30.1 96.5 L28.6 90.0 L26.3 83.3 L25.8 83.8 L22.8 93.3 L21.9 96.8 L20.6 99.9
  L19.7 101.3 L16.0 105.1 L14.4 106.2 L13.5 106.5 L11.4 106.4 L10.1 105.6 L8.6 104.0 L8.1 102.9
  L7.7 99.8 L6.5 96.2 L6.4 92.7 L7.0 90.0 L8.6 86.1 L10.1 80.7 L11.5 76.9 L11.5 75.3
  L10.8 73.7 L11.1 72.1 L12.3 67.7 L13.4 66.1 L14.3 58.3 L15.1 54.5 L16.2 51.8 L17.5 50.3
  L18.7 49.3 L20.6 48.4 L23.4 47.9 L26.0 48.2 L28.7 48.9 L30.9 50.2 L32.4 51.5 L33.1 50.9
  L34.1 47.9 L33.8 47.6 L32.7 48.9 L32.2 49.2 L32.0 49.0 L32.8 47.3 L33.2 45.8 L33.2 43.9
  L32.5 40.5 L32.4 37.0 L32.3 36.6 L32.0 36.8 L31.3 39.7 L31.4 42.7 L31.2 42.9 L30.5 41.1
  L30.4 38.3 L31.0 34.9 L33.8 27.7 L33.6 27.1 L32.0 29.0 L31.7 29.0 L33.3 25.5 L33.9 23.3
  L34.3 20.5 L34.7 13.9 L35.3 10.8 L37.0 6.6 L38.7 4.3 L39.9 3.0 L43.0 1.1 L44.6 0.5
  L47.3 -0.1 L50.2 -0.1 L51.6 0.2 L53.4 0.9 L55.8 2.8 L56.9 4.6 L57.7 7.6 L59.2 8.8
  L61.4 11.1 L63.1 14.3 L63.8 16.6 L64.3 20.3 L64.3 22.5 L63.8 25.8 L65.0 27.2 L65.1 29.0
  L64.6 31.6 L63.7 33.8 L63.0 35.2 L61.4 36.4 L60.2 40.9 L58.3 44.1 L58.4 47.0 L58.9 49.2
  L60.2 50.8 L61.2 51.5 L67.1 54.0 L67.6 53.5 L68.5 51.4 L69.6 50.2 L72.3 48.7 L75.2 47.9
  L78.5 47.9 L80.5 48.4 L82.5 49.6 L84.1 51.1 L85.1 52.9 L85.7 54.9 L86.9 60.7 L87.4 66.1
  L88.6 68.2 L89.6 72.1 L89.7 73.8 L89.1 75.3 L89.0 77.0 L91.2 84.9 L93.0 89.5 L93.6 91.9
  L93.6 95.6 L92.4 99.4 L91.9 102.7 L91.4 104.0 L90.1 105.4 L88.9 106.2 L87.9 106.5 L85.9 106.4
  L84.8 105.7 L82.4 103.4 L79.5 100.2 L77.9 96.1 L77.4 93.8 L74.8 86.6 L74.0 83.7 L73.6 83.2
  L70.8 91.9 L69.0 99.9 L68.3 104.7 L68.3 107.5 L68.7 109.5 L72.3 119.6 L77.8 137.0 L80.4 147.8
  L81.7 155.2 L82.4 162.4 L82.9 172.0 L82.7 183.1 L81.9 190.6 L81.9 195.9 L82.7 201.9 L83.4 205.6
  L86.7 214.8 L87.4 217.7 L88.3 222.1 L88.8 227.3 L88.8 232.7 L88.1 245.7 L87.6 263.1 L88.8 268.1
  L89.1 271.3 L92.3 280.4 L95.6 286.6 L96.4 289.7 L96.2 290.9 L94.7 292.8 L92.6 294.0 L91.3 294.2 Z
  M82.9 295.1 L82.3 291.4 L80.9 288.6 L81.2 282.8 L80.9 280.2 L80.0 275.0 L80.1 272.1 L79.3 269.0
  L79.6 263.3 L78.7 257.2 L77.4 250.5 L75.3 242.7 L71.6 232.4 L70.7 228.8 L70.4 224.9 L70.5 214.4
  L70.2 212.6 L69.5 210.3 L66.6 204.1 L65.5 200.9 L62.3 186.9 L61.6 184.7 L57.1 173.5 L54.8 167.0
  L52.8 159.5 L51.6 152.5 L51.1 151.8 L49.1 151.7 L48.5 151.9 L48.2 152.3 L47.0 160.1 L45.4 166.2
  L43.4 171.9 L39.0 182.6 L37.5 186.9 L34.5 200.6 L33.2 204.3 L30.4 210.3 L29.7 212.8 L29.4 214.5
  L29.5 224.7 L29.1 228.6 L28.5 231.6 L24.1 244.3 L21.3 256.3 L20.3 262.8 L20.5 268.9 L19.8 272.1
  L19.9 275.0 L18.9 280.2 L18.7 282.8 L18.9 288.3 L18.5 289.7 L17.6 291.3 L17.6 292.9 L17.0 294.2
  L17.0 295.0 L17.3 295.1 Z`;

const BOX_W_READY_ART = {"src": "img/figures/box-w-ready.d2a61a05.webp", "box": [2.42, -1.05, 97.62, 301.08]};

const RUN_W_READY_TRACE = `M92.2 299.9 L6.2 299.9 L6.0 299.8 L6.0 294.3 L4.7 293.9 L4.4 293.5 L4.9 292.4 L4.3 291.5
  L4.2 290.8 L4.8 288.3 L6.2 286.8 L8.6 284.9 L11.4 281.9 L13.7 278.1 L14.8 275.8 L15.4 274.9
  L16.6 272.0 L17.9 270.7 L18.4 268.7 L18.0 259.7 L16.5 237.8 L16.3 230.8 L17.1 224.2 L19.0 214.8
  L19.5 199.8 L16.7 185.5 L15.2 173.2 L14.7 163.1 L15.0 156.8 L15.7 149.1 L18.9 134.9 L21.0 128.7
  L24.5 120.9 L27.4 113.6 L28.1 110.9 L28.0 104.8 L25.9 90.2 L25.1 87.6 L24.7 87.5 L24.5 87.9
  L21.4 101.1 L20.9 104.0 L20.4 110.9 L19.2 116.1 L16.8 123.8 L11.9 137.3 L9.4 146.3 L9.4 149.9
  L10.8 153.1 L11.4 156.7 L10.9 160.6 L11.0 164.9 L10.8 167.6 L10.4 168.4 L9.9 168.7 L9.1 168.5
  L8.5 167.8 L8.1 166.3 L8.1 162.0 L7.8 161.2 L7.4 160.9 L6.8 161.1 L6.1 162.5 L6.0 165.9
  L6.5 167.8 L10.8 171.7 L11.1 172.4 L11.2 173.3 L10.7 174.0 L10.1 173.9 L7.7 172.8 L3.4 170.0
  L2.8 169.1 L0.7 162.2 L0.7 160.9 L2.6 151.5 L2.8 147.4 L4.0 140.2 L5.6 117.9 L6.1 113.9
  L7.1 109.3 L10.5 98.7 L11.8 86.5 L13.0 78.9 L13.0 68.1 L13.5 65.0 L14.8 60.8 L16.6 57.1
  L18.2 55.2 L19.7 54.2 L22.2 53.2 L30.8 51.0 L39.0 47.4 L40.8 45.6 L41.3 44.2 L41.5 41.7
  L41.4 37.0 L39.6 33.9 L38.2 29.6 L36.6 28.3 L35.3 25.4 L34.6 21.9 L34.7 20.8 L35.2 19.0
  L34.8 17.3 L34.9 15.2 L34.6 14.3 L35.2 10.8 L35.8 9.1 L36.0 7.6 L37.2 5.3 L38.6 3.8
  L41.2 2.1 L44.4 0.7 L46.9 0.1 L48.8 -0.1 L50.9 0.4 L52.6 0.1 L54.7 0.1 L57.6 0.8
  L60.6 2.2 L62.9 3.8 L65.3 6.9 L65.8 8.1 L66.0 9.5 L66.8 11.3 L66.6 14.1 L67.0 15.6
  L66.6 17.2 L66.7 18.6 L66.3 19.9 L66.7 22.9 L66.4 24.5 L65.3 27.4 L63.6 29.7 L62.0 30.2
  L61.9 31.0 L65.5 34.5 L67.8 38.0 L67.9 39.1 L67.5 39.6 L68.3 42.5 L70.3 46.1 L70.2 46.9
  L71.1 47.8 L71.6 48.7 L70.7 48.8 L70.5 49.0 L71.2 50.7 L72.8 51.5 L78.7 52.8 L81.5 54.0
  L83.7 55.9 L85.9 59.0 L87.3 62.1 L88.7 66.0 L90.0 74.1 L94.6 85.0 L97.0 92.7 L98.6 97.1
  L99.0 98.9 L99.0 106.1 L98.3 107.5 L96.8 109.4 L94.8 110.1 L89.5 108.9 L86.1 107.6 L83.8 105.9
  L76.2 97.7 L74.6 97.0 L72.1 97.3 L71.7 97.6 L71.3 98.6 L69.4 105.7 L68.8 110.1 L68.9 113.1
  L69.4 115.0 L70.9 119.1 L71.5 121.9 L72.5 123.9 L74.9 130.8 L76.6 137.3 L79.4 149.3 L80.8 160.1
  L81.1 168.3 L80.8 177.7 L79.9 188.8 L78.8 196.0 L78.5 200.7 L79.5 213.0 L80.0 215.7 L82.3 223.9
  L83.3 230.3 L83.3 240.5 L82.0 264.5 L82.0 269.4 L82.2 270.9 L83.4 272.7 L83.9 274.8 L85.2 277.1
  L87.0 282.1 L89.0 285.1 L91.4 287.7 L92.1 289.1 L92.5 290.9 L92.0 292.7 L92.3 293.9 Z
  M75.4 295.1 L75.4 294.3 L74.9 292.5 L74.5 292.1 L71.8 291.2 L71.3 290.5 L71.5 287.3 L71.3 285.7
  L71.5 284.9 L71.6 281.2 L72.4 275.3 L73.1 272.8 L73.2 267.9 L72.6 263.6 L70.5 253.5 L65.6 236.7
  L65.1 232.5 L65.1 221.3 L64.6 217.4 L61.2 208.3 L58.1 190.6 L56.7 185.6 L52.0 170.6 L50.7 165.1
  L50.2 161.0 L49.5 157.7 L48.7 156.7 L47.5 156.4 L46.4 156.9 L45.8 158.2 L44.6 168.0 L39.3 189.4
  L37.2 207.0 L34.3 216.3 L34.0 222.0 L34.6 232.4 L34.3 236.7 L31.5 247.2 L29.9 254.2 L27.9 265.5
  L27.4 269.8 L27.5 272.8 L28.6 275.2 L30.6 290.2 L30.2 290.9 L28.7 291.6 L25.9 292.2 L22.8 292.3
  L21.8 294.2 L21.7 295.0 L22.0 295.1 Z`;

const RUN_W_READY_ART = {"src": "img/figures/run-w-ready.3c9b3a55.webp", "box": [-0.32, -1.08, 100.26, 301.17]};

const GENT_ART = {"src": "img/figures/gent.72c00aa8.webp", "box": [2.26, -1.16, 97.76, 300.12]};

const LADY_ART = {"src": "img/figures/lady.2bccc2b0.webp", "box": [-10.43, -1.23, 110.33, 301.06]};

const SUIT_ART = {"src": "img/figures/suit.6206ac77.webp", "box": [-3.28, -1.01, 103.25, 301.1]};

const GOWN_BALL_ART = {"src": "img/figures/gown-ball.ea2e5f4e.webp", "box": [-45.97, -1.14, 145.97, 298.18]};

const GOWN_TRAIN_ART = {"src": "img/figures/gown-train.77938305.webp", "box": [-14.53, -1.15, 114.65, 301.2]};

const GOWN_EVENING_ART = {"src": "img/figures/gown-evening.1726aae2.webp", "box": [-23.01, -1.14, 123.01, 301.26]};

const GOWN_SWEEP_ART = {"src": "img/figures/gown-sweep.8930ebf3.webp", "box": [5.91, -1.04, 93.97, 301.14]};

const GRAD_ART = {"src": "img/figures/grad.f5079d41.webp", "box": [2.41, -1.08, 97.6, 301.14]};

const GRAD_W_TRACE = `M99.2 299.9 L90.2 299.9 L90.1 294.2 L88.8 293.8 L86.4 292.4 L83.7 288.8 L82.9 288.6 L80.9 288.8
  L79.8 288.5 L78.9 287.7 L77.4 280.6 L77.6 277.1 L78.2 274.7 L77.9 271.1 L75.1 261.2 L74.5 259.6
  L74.0 259.3 L62.4 260.3 L42.4 260.5 L42.1 261.0 L41.7 265.8 L41.7 271.1 L42.1 273.9 L43.1 276.1
  L44.2 279.9 L43.4 285.6 L42.7 288.5 L42.1 289.0 L40.6 289.4 L39.4 289.5 L38.1 289.2 L37.2 288.7
  L36.8 287.3 L36.2 287.1 L35.1 287.9 L31.7 291.1 L29.7 292.0 L25.3 292.8 L23.1 292.9 L18.0 292.8
  L16.3 292.3 L15.7 291.1 L16.3 290.0 L25.2 283.5 L29.1 279.1 L32.4 274.2 L33.3 271.2 L33.3 269.6
  L32.2 257.4 L31.8 256.5 L29.6 256.2 L28.9 256.7 L28.7 258.8 L28.2 259.1 L27.2 259.1 L22.9 258.3
  L16.0 256.6 L12.5 255.1 L11.9 254.2 L11.9 253.1 L11.6 252.4 L8.2 251.1 L7.5 250.2 L8.5 234.5
  L12.9 180.9 L16.1 146.4 L18.3 128.2 L17.8 127.6 L12.8 126.5 L10.0 125.3 L6.9 123.1 L4.8 120.9
  L3.0 118.0 L1.2 113.7 L0.4 108.5 L0.6 104.8 L1.4 102.0 L2.3 99.9 L10.3 87.7 L14.5 80.1
  L17.8 73.2 L19.7 70.9 L22.9 69.2 L23.8 67.6 L24.1 66.4 L24.1 64.6 L23.2 60.4 L23.0 57.0
  L23.3 55.7 L23.5 55.7 L23.5 59.1 L24.1 62.0 L24.7 62.5 L25.2 61.9 L25.1 54.8 L26.1 50.3
  L27.7 45.8 L27.2 46.0 L24.9 50.0 L24.8 50.1 L24.7 49.8 L26.8 45.3 L30.2 39.1 L31.3 36.1
  L32.4 30.8 L33.0 28.9 L34.0 26.8 L35.8 24.1 L35.8 23.6 L35.3 23.0 L26.0 16.3 L25.5 15.8
  L25.5 15.1 L35.6 8.9 L51.5 -0.1 L52.3 0.1 L55.0 2.1 L69.6 14.3 L74.2 17.7 L78.9 22.1
  L85.6 27.6 L86.1 28.4 L85.9 29.0 L85.4 29.3 L78.5 32.3 L76.3 33.4 L75.9 34.0 L77.4 50.9
  L77.2 52.2 L76.7 52.7 L74.9 53.1 L73.3 52.7 L72.8 52.1 L73.3 39.0 L73.7 35.9 L73.5 35.1
  L72.8 35.0 L67.5 37.4 L66.9 37.9 L66.8 38.6 L68.2 48.5 L68.9 51.1 L70.4 54.4 L72.5 57.8
  L75.0 61.0 L81.6 67.4 L83.1 69.2 L85.6 72.7 L87.4 76.5 L88.2 78.8 L88.0 79.3 L86.7 76.3
  L85.1 73.6 L83.8 71.7 L83.3 71.5 L83.2 71.7 L85.5 77.2 L86.9 82.3 L87.2 84.9 L87.1 93.5
  L93.6 110.6 L95.1 115.4 L95.6 118.4 L95.6 121.9 L94.9 125.8 L93.8 130.1 L92.2 134.9 L89.5 141.4
  L87.4 145.6 L84.5 150.7 L80.7 156.2 L80.6 157.6 L85.3 183.7 L98.4 249.9 L98.0 250.8 L94.2 252.9
  L89.5 255.0 L84.0 257.1 L83.8 257.5 L84.0 261.6 L85.4 270.8 L86.0 273.1 L87.1 275.3 L92.1 282.1
  L97.5 288.4 L99.1 291.0 L99.5 292.5 L99.3 294.2 Z`;

const GRAD_W_ART = {"src": "img/figures/grad-w.7817238a.webp", "box": [-0.67, -1.07, 100.74, 301.0]};

/* Basketball, in full colour, both by creativecanvasdesign on Pixabay and both
   holding the ball, so it is printed and cut with the hand that holds it:
     Men    0 Dribble -- 10454238, low in his stance, the ball at his side
     Women  1 Ready   -- 10442422, standing to the front, the ball at her hip
   They replace the silhouettes Point, Jump shot and Layup, whose balls had all
   been taken out. */
const BALL_M_DRIBBLE_TRACE = `M120.3 299.9 L-13.3 299.9 L-13.6 299.8 L-13.6 294.3 L-14.3 293.0 L-14.3 290.0 L-14.1 288.1 L-13.3 286.5
  L-9.3 281.8 L-6.5 277.4 L-5.0 271.7 L-3.5 267.9 L-2.9 264.9 L-0.9 261.5 L-0.6 259.9 L-0.3 247.0
  L0.3 242.7 L0.8 227.9 L1.3 221.5 L2.9 214.1 L7.5 201.7 L10.1 190.4 L10.3 187.3 L10.0 181.8
  L8.5 180.1 L8.3 178.6 L11.8 161.1 L13.4 154.6 L15.7 147.1 L16.2 144.2 L16.0 144.0 L15.4 144.5
  L13.7 146.9 L10.9 149.6 L8.2 151.3 L5.4 152.7 L1.1 153.7 L-3.6 153.7 L-5.8 153.3 L-8.4 152.4
  L-11.4 150.8 L-14.0 148.9 L-16.6 146.2 L-18.1 143.8 L-19.7 140.1 L-20.4 136.9 L-20.5 134.3 L-21.7 132.2
  L-22.0 128.9 L-20.7 123.5 L-17.7 117.3 L-16.0 115.2 L-12.9 112.5 L-12.2 112.0 L-8.9 111.1 L-7.3 110.0
  L-5.4 106.9 L-3.0 101.2 L-1.5 99.3 L1.5 96.5 L2.0 95.7 L3.0 91.8 L3.4 87.0 L4.1 82.7
  L7.3 74.2 L6.8 66.8 L7.3 62.5 L8.6 58.5 L10.9 54.4 L12.8 52.2 L14.5 51.0 L20.9 48.5
  L23.9 46.8 L24.7 45.7 L25.6 45.2 L28.0 44.4 L38.9 39.6 L38.9 35.1 L37.9 29.8 L37.6 29.4
  L36.3 28.7 L35.4 27.6 L34.7 25.8 L34.3 24.1 L34.3 20.7 L34.9 20.0 L36.2 20.1 L36.5 19.6
  L35.9 14.1 L35.2 11.2 L35.2 9.6 L35.9 7.6 L37.8 4.6 L41.3 1.9 L43.4 1.1 L48.7 -0.1
  L54.1 0.9 L58.3 3.3 L60.8 5.8 L62.0 8.1 L62.3 9.2 L62.3 11.3 L61.4 15.1 L61.2 19.4
  L61.5 20.0 L62.5 19.9 L63.2 20.4 L63.5 22.5 L63.1 25.5 L62.5 27.1 L61.2 28.8 L59.8 29.2
  L59.5 29.6 L59.2 31.6 L59.2 36.8 L59.5 38.6 L60.0 39.3 L62.0 39.4 L63.3 39.8 L75.2 44.5
  L81.2 48.3 L85.5 49.5 L87.0 50.3 L89.1 51.8 L90.9 53.9 L92.9 57.1 L94.7 61.1 L95.8 65.1
  L96.3 70.8 L99.1 75.8 L101.4 80.7 L104.4 92.7 L107.5 100.6 L108.4 106.0 L108.3 110.1 L106.9 116.0
  L104.0 123.9 L103.6 127.2 L102.6 130.0 L102.9 137.4 L102.5 139.4 L102.5 142.9 L101.5 145.9 L99.9 148.7
  L99.3 149.4 L98.5 149.2 L98.1 148.1 L99.7 144.4 L99.8 143.8 L99.6 143.4 L99.0 143.8 L95.9 147.6
  L95.1 147.9 L94.3 147.4 L94.3 146.1 L97.5 140.6 L97.7 139.5 L97.3 138.9 L94.8 141.9 L92.9 144.8
  L91.9 145.2 L91.1 144.8 L91.0 143.5 L91.4 142.3 L93.1 139.5 L94.6 136.5 L94.6 135.5 L93.8 134.8
  L93.5 134.8 L93.1 135.2 L90.7 138.1 L89.4 140.0 L89.4 140.7 L95.0 159.2 L99.0 176.4 L99.3 179.0
  L98.0 180.9 L98.2 189.7 L101.1 201.1 L105.2 211.7 L106.6 216.1 L107.3 219.8 L107.9 225.1 L108.6 241.2
  L110.3 261.7 L112.3 267.8 L113.7 273.3 L114.8 275.9 L115.7 280.0 L117.0 282.2 L120.3 286.2 L121.3 288.4
  L121.8 290.8 L121.7 292.6 L120.4 294.3 Z
  M101.6 295.1 L101.6 294.2 L100.5 293.3 L99.7 291.4 L97.6 289.1 L97.2 287.6 L97.8 282.7 L98.0 275.8
  L98.2 273.9 L98.1 269.6 L98.5 268.0 L99.4 266.7 L99.6 265.8 L99.4 260.9 L95.7 242.3 L93.5 236.0
  L91.1 231.4 L89.8 227.6 L88.7 222.1 L87.2 207.7 L84.2 202.1 L82.3 196.4 L77.2 187.3 L75.9 187.0
  L71.6 187.5 L66.8 187.5 L65.5 187.0 L65.0 185.9 L63.5 179.7 L60.6 169.9 L57.8 162.0 L55.2 157.4
  L53.9 156.7 L52.9 156.7 L51.5 157.9 L49.4 162.2 L46.5 172.2 L42.6 187.3 L42.1 187.9 L41.2 188.1
  L37.3 188.1 L31.6 187.4 L30.8 187.6 L26.7 195.4 L24.1 202.6 L21.5 207.4 L21.1 209.2 L20.1 221.9
  L19.3 226.4 L18.0 230.8 L14.7 237.8 L13.4 242.1 L9.9 258.4 L9.3 264.1 L9.3 266.2 L10.5 270.5
  L10.6 276.0 L11.7 288.3 L10.9 290.0 L7.3 291.8 L6.7 293.2 L5.6 294.2 L5.6 295.1 Z
  M85.8 128.4 L87.2 127.1 L91.5 125.3 L93.4 124.2 L94.4 121.3 L94.6 116.7 L93.3 110.6 L93.2 108.5
  L93.7 103.1 L92.9 99.5 L88.0 92.6 L84.8 86.1 L83.4 82.5 L82.7 81.6 L82.4 82.3 L81.7 86.5
  L80.5 99.3 L80.5 102.7 L81.0 106.6 L82.6 113.9 L82.6 114.9 L82.2 116.0 L81.0 117.3 L81.0 118.1
  L81.4 119.1 L82.7 120.5 L83.8 122.5 L84.8 126.3 L85.0 127.9 L85.2 128.4 Z
  M19.0 132.2 L20.9 129.6 L21.1 125.2 L21.7 122.6 L23.0 120.4 L24.2 119.1 L24.6 118.3 L24.5 117.3
  L23.2 115.6 L23.1 114.0 L25.4 105.2 L25.4 103.7 L23.8 92.0 L22.3 83.5 L21.8 82.6 L21.4 83.1
  L18.1 93.2 L15.0 100.5 L13.2 107.6 L10.6 111.7 L9.0 113.3 L6.6 114.9 L6.1 115.5 L6.4 115.9
  L10.5 118.2 L14.0 121.6 L15.5 123.7 L16.8 126.1 L17.7 129.0 L18.3 131.7 L18.7 132.3 Z`;

const BALL_M_DRIBBLE_ART = {"src": "img/figures/ball-m-dribble.31d6963e.webp", "box": [-23.04, -1.14, 122.87, 301.07]};

const BALL_W_READY_TRACE = `M111.6 299.9 L3.4 299.9 L3.1 299.8 L3.1 294.3 L2.5 293.2 L2.5 291.9 L3.2 288.3 L4.0 287.0
  L7.0 283.9 L8.8 281.5 L11.2 277.4 L12.9 272.9 L13.4 270.6 L13.7 265.3 L14.1 264.7 L15.1 264.3
  L15.5 263.0 L16.6 261.0 L16.6 247.8 L17.0 244.3 L17.2 230.0 L17.7 223.5 L19.0 216.5 L22.2 205.5
  L23.0 202.3 L24.5 193.1 L24.8 188.9 L25.0 171.3 L24.5 170.7 L21.5 169.5 L21.3 168.5 L26.2 142.6
  L26.0 142.4 L25.6 142.5 L23.2 144.6 L21.2 145.9 L18.5 147.1 L16.3 147.8 L11.7 148.2 L7.1 147.4
  L6.3 148.1 L5.5 148.3 L0.6 146.9 L-2.4 145.5 L-5.2 143.1 L-7.8 141.1 L-11.3 132.7 L-12.0 130.5
  L-12.3 128.7 L-11.8 126.7 L-0.3 103.9 L3.3 98.2 L9.2 90.7 L12.9 84.3 L19.8 70.2 L23.2 59.2
  L25.5 54.2 L26.6 52.5 L28.2 50.7 L30.8 49.0 L36.7 47.4 L38.3 46.5 L43.2 44.9 L46.7 43.5
  L48.3 43.2 L49.4 42.6 L50.7 41.2 L51.2 39.9 L51.0 39.1 L47.9 38.2 L46.2 36.7 L45.4 35.4
  L44.3 33.1 L43.1 28.6 L42.8 28.7 L42.6 30.6 L43.4 33.6 L43.4 33.9 L43.1 33.5 L42.3 29.6
  L42.3 23.7 L43.2 18.7 L44.4 13.9 L45.8 9.8 L47.3 6.8 L48.6 4.8 L51.1 2.3 L53.8 0.7
  L55.9 0.1 L57.9 -0.1 L59.6 0.2 L61.6 -0.1 L63.7 0.3 L66.4 1.6 L68.1 2.8 L69.6 4.3
  L71.6 7.1 L72.8 9.8 L78.4 26.6 L79.3 31.4 L79.2 33.6 L78.7 35.4 L78.4 35.4 L78.3 32.1
  L78.0 30.1 L77.7 30.0 L77.2 34.4 L75.7 37.8 L75.1 38.4 L73.5 38.8 L73.0 38.5 L73.1 37.5
  L72.9 37.4 L71.6 38.6 L70.8 39.0 L67.6 39.2 L67.3 39.9 L68.0 41.7 L68.8 42.5 L70.3 43.3
  L72.3 43.8 L80.3 46.7 L81.7 47.8 L86.5 49.0 L89.4 50.5 L90.9 51.9 L92.0 53.4 L93.0 55.4
  L94.2 59.7 L94.7 62.5 L95.0 66.2 L95.0 73.9 L96.8 91.9 L97.7 97.4 L100.3 106.5 L101.4 113.4
  L101.8 122.0 L102.1 135.5 L102.3 137.1 L102.2 142.4 L102.6 146.6 L103.6 152.8 L101.1 160.5 L96.7 163.6
  L94.4 164.5 L94.2 165.8 L94.7 168.3 L94.6 169.4 L93.4 170.1 L91.1 171.1 L90.8 171.5 L90.8 188.8
  L92.5 202.1 L93.6 206.8 L96.0 214.6 L97.5 222.6 L98.0 230.3 L98.2 244.3 L98.4 245.1 L98.5 248.8
  L98.3 256.5 L98.4 261.0 L99.4 262.9 L99.8 264.5 L100.9 264.7 L101.5 265.4 L101.6 270.6 L102.2 273.6
  L103.5 276.8 L106.5 282.2 L110.8 286.9 L111.7 288.6 L112.2 291.5 L112.2 293.0 L111.7 294.3 Z
  M95.4 295.1 L95.4 294.2 L94.2 293.6 L93.1 292.7 L92.4 290.3 L89.0 289.2 L87.1 288.4 L86.1 287.6
  L85.5 286.7 L85.4 285.4 L86.6 281.5 L86.7 278.6 L87.5 274.4 L87.1 270.8 L87.1 267.4 L87.6 266.2
  L88.4 265.3 L88.7 264.3 L88.2 259.8 L85.5 246.5 L85.3 244.8 L83.5 237.9 L80.7 229.9 L79.5 225.2
  L78.7 219.6 L78.2 211.6 L77.6 208.5 L73.3 197.5 L70.2 185.4 L67.3 175.8 L66.5 175.0 L62.8 174.8
  L61.9 174.6 L61.4 173.7 L58.7 154.5 L58.0 151.9 L57.6 152.6 L57.2 154.6 L54.1 174.0 L53.6 174.7
  L53.1 174.8 L49.3 175.0 L48.5 175.8 L45.3 186.0 L41.9 198.5 L37.8 208.6 L37.0 212.9 L36.8 218.2
  L35.8 225.7 L34.5 230.1 L31.5 238.7 L29.9 244.5 L29.8 246.5 L27.3 257.4 L26.3 264.0 L26.3 264.9
  L27.6 266.7 L27.9 267.5 L27.6 274.7 L28.3 279.8 L28.3 281.7 L29.2 284.3 L29.5 286.3 L28.8 287.6
  L27.9 288.4 L22.4 290.3 L22.0 290.9 L21.7 292.6 L20.8 293.6 L19.7 294.2 L19.7 295.0 L20.0 295.1 Z
  M30.0 122.9 L32.6 115.5 L34.4 112.3 L35.1 108.9 L34.9 107.7 L33.1 106.5 L32.2 104.8 L32.7 102.7
  L34.7 97.9 L34.6 82.0 L33.8 74.7 L33.4 73.5 L32.7 74.0 L28.4 81.8 L19.1 96.3 L14.9 103.8
  L9.1 111.1 L9.5 111.5 L10.9 111.3 L13.8 111.3 L15.9 111.5 L19.2 112.5 L21.7 113.7 L25.3 116.6
  L27.9 119.8 L29.5 122.7 Z
  M94.1 161.4 L96.3 160.3 L95.1 159.9 L95.0 159.5 L95.2 159.0 L97.5 157.8 L98.3 157.1 L98.3 153.1
  L97.7 151.8 L96.9 151.7 L96.4 153.3 L96.2 156.3 L95.7 157.9 L95.2 158.5 L94.8 158.6 L94.3 158.6
  L93.8 157.9 L93.7 146.4 L94.5 143.8 L95.9 141.0 L96.1 137.4 L93.7 126.6 L89.2 111.4 L88.2 106.4
  L87.2 99.3 L85.1 90.7 L83.6 82.5 L83.4 81.7 L83.1 81.5 L82.7 82.4 L82.4 84.6 L81.7 94.5
  L81.7 98.2 L83.7 104.2 L83.8 105.3 L83.0 106.8 L81.2 108.0 L81.1 108.9 L81.7 112.4 L83.0 114.5
  L84.6 118.1 L87.6 128.0 L90.5 143.1 L93.3 160.3 L93.5 161.2 Z`;

const BALL_W_READY_ART = {"src": "img/figures/ball-w-ready.ef84e966.webp", "box": [-13.44, -1.15, 113.32, 301.21]};

const VOLLEY_W_READY_TRACE = `M111.6 299.9 L3.4 299.9 L3.1 299.8 L3.1 294.3 L2.5 293.2 L2.5 291.9 L3.2 288.3 L4.0 287.0
  L7.0 283.9 L8.8 281.5 L11.2 277.4 L12.9 272.9 L13.4 270.6 L13.7 265.3 L14.1 264.7 L15.1 264.3
  L15.5 263.0 L16.6 261.0 L16.6 247.8 L17.0 244.3 L17.2 230.0 L17.7 223.5 L19.0 216.5 L22.2 205.5
  L23.0 202.3 L24.5 193.1 L24.8 188.9 L25.0 171.3 L24.5 170.7 L21.5 169.5 L21.3 168.5 L26.1 143.2
  L25.9 143.0 L25.5 143.1 L23.2 145.1 L20.2 146.8 L17.7 147.8 L15.4 148.3 L11.1 148.5 L7.1 147.8
  L5.5 148.3 L0.6 146.9 L-2.4 145.5 L-5.2 143.1 L-7.8 141.1 L-11.3 132.7 L-12.0 130.5 L-12.3 128.7
  L-11.8 126.7 L-0.3 103.9 L3.3 98.2 L9.2 90.7 L12.9 84.3 L19.8 70.2 L23.2 59.2 L25.5 54.2
  L26.6 52.5 L28.2 50.7 L30.8 49.0 L36.7 47.4 L38.3 46.5 L43.2 44.9 L46.7 43.5 L48.3 43.2
  L49.4 42.6 L50.7 41.2 L51.2 39.9 L51.0 39.1 L47.9 38.2 L46.2 36.7 L45.4 35.4 L44.3 33.1
  L43.1 28.6 L42.8 28.7 L42.6 30.6 L43.4 33.6 L43.4 33.9 L43.1 33.5 L42.3 29.6 L42.3 23.7
  L43.2 18.7 L44.4 13.9 L45.8 9.8 L47.3 6.8 L48.6 4.8 L51.1 2.3 L53.8 0.7 L55.9 0.1
  L57.9 -0.1 L59.6 0.2 L61.6 -0.1 L63.7 0.3 L66.4 1.6 L68.1 2.8 L69.6 4.3 L71.6 7.1
  L72.8 9.8 L78.4 26.6 L79.3 31.4 L79.2 33.6 L78.7 35.4 L78.4 35.4 L78.3 32.1 L78.0 30.1
  L77.7 30.0 L77.2 34.4 L75.7 37.8 L75.1 38.4 L73.5 38.8 L73.0 38.5 L73.1 37.5 L72.9 37.4
  L71.6 38.6 L70.8 39.0 L67.6 39.2 L67.3 39.9 L68.0 41.7 L68.8 42.5 L70.3 43.3 L72.3 43.8
  L80.3 46.7 L81.7 47.8 L86.5 49.0 L89.4 50.5 L90.9 51.9 L92.0 53.4 L93.0 55.4 L94.2 59.7
  L94.7 62.5 L95.0 66.2 L95.0 73.9 L96.8 91.9 L97.7 97.4 L100.3 106.5 L101.4 113.4 L101.8 122.0
  L102.1 135.5 L102.3 137.1 L102.2 142.4 L102.6 146.6 L103.6 152.8 L101.1 160.5 L96.7 163.6 L94.4 164.5
  L94.2 165.8 L94.7 168.3 L94.6 169.4 L93.4 170.1 L91.1 171.1 L90.8 171.5 L90.8 188.8 L92.5 202.1
  L93.6 206.8 L96.0 214.6 L97.5 222.6 L98.0 230.3 L98.2 244.3 L98.4 245.1 L98.5 248.8 L98.3 256.5
  L98.4 261.0 L99.4 262.9 L99.8 264.5 L100.9 264.7 L101.5 265.4 L101.6 270.6 L102.2 273.6 L103.5 276.8
  L106.5 282.2 L110.8 286.9 L111.7 288.6 L112.2 291.5 L112.2 293.0 L111.7 294.3 Z
  M95.4 295.1 L95.4 294.2 L94.2 293.6 L93.1 292.7 L92.4 290.3 L89.0 289.2 L87.1 288.4 L86.1 287.6
  L85.5 286.7 L85.4 285.4 L86.6 281.5 L86.7 278.6 L87.5 274.4 L87.1 270.8 L87.1 267.4 L87.6 266.2
  L88.4 265.3 L88.7 264.3 L88.2 259.8 L85.5 246.5 L85.3 244.8 L83.5 237.9 L80.7 229.9 L79.5 225.2
  L78.7 219.6 L78.2 211.6 L77.6 208.5 L73.3 197.5 L70.2 185.4 L67.3 175.8 L66.5 175.0 L62.8 174.8
  L61.9 174.6 L61.4 173.7 L58.7 154.5 L58.0 151.9 L57.6 152.6 L57.2 154.6 L54.1 174.0 L53.6 174.7
  L53.1 174.8 L49.3 175.0 L48.5 175.8 L45.3 186.0 L41.9 198.5 L37.8 208.6 L37.0 212.9 L36.8 218.2
  L35.8 225.7 L34.5 230.1 L31.5 238.7 L29.9 244.5 L29.8 246.5 L27.3 257.4 L26.3 264.0 L26.3 264.9
  L27.6 266.7 L27.9 267.5 L27.6 274.7 L28.3 279.8 L28.3 281.7 L29.2 284.3 L29.5 286.3 L28.8 287.6
  L27.9 288.4 L22.4 290.3 L22.0 290.9 L21.7 292.6 L20.8 293.6 L19.7 294.2 L19.7 295.0 L20.0 295.1 Z
  M30.1 122.4 L30.5 121.9 L32.6 115.5 L34.4 112.3 L35.1 108.9 L34.9 107.7 L33.1 106.5 L32.2 104.8
  L32.7 102.7 L34.7 97.9 L34.6 82.0 L33.8 74.7 L33.4 73.5 L32.7 74.0 L28.4 81.8 L19.1 96.3
  L14.9 103.8 L9.6 110.6 L9.9 110.9 L14.0 110.8 L15.7 111.0 L19.1 112.0 L21.7 113.2 L24.1 114.9
  L26.3 117.0 L28.3 119.6 L29.7 122.3 Z
  M94.1 161.4 L96.3 160.3 L95.1 159.9 L95.0 159.5 L95.2 159.0 L97.5 157.8 L98.3 157.1 L98.3 153.1
  L97.7 151.8 L96.9 151.7 L96.4 153.3 L96.2 156.3 L95.7 157.9 L95.2 158.5 L94.8 158.6 L94.3 158.6
  L93.8 157.9 L93.7 146.4 L94.5 143.8 L95.9 141.0 L96.1 137.4 L93.7 126.6 L89.2 111.4 L88.2 106.4
  L87.2 99.3 L85.1 90.7 L83.6 82.5 L83.4 81.7 L83.1 81.5 L82.7 82.4 L82.4 84.6 L81.7 94.5
  L81.7 98.2 L83.7 104.2 L83.8 105.3 L83.0 106.8 L81.2 108.0 L81.1 108.9 L81.7 112.4 L83.0 114.5
  L84.6 118.1 L87.6 128.0 L90.5 143.1 L93.3 160.3 L93.5 161.2 Z`;

const VOLLEY_W_READY_ART = {"src": "img/figures/volley-w-ready.288285ae.webp", "box": [-13.44, -1.15, 113.32, 301.21]};

const FIGURES = {
  /* Each figure: its cut (`path`, or `paths` one per pose), the colour print
     on it (`art` / `arts`), the pose names, the Men / Women `groups` and the
     price factor per pose (`bases`). */
  gown: { paths: [GOWN_BALL_TRACE, GOWN_TRAIN_TRACE, GOWN_EVENING_TRACE, GOWN_SWEEP_TRACE],
          names: ['Ball gown', 'Train', 'Evening', 'Off-shoulder'],
          arts: [GOWN_BALL_ART, GOWN_TRAIN_ART, GOWN_EVENING_ART, GOWN_SWEEP_ART],
          /* The sheet is bought by the rectangle, so the price follows the
             sheet actually cut, over the blade height squared, at 2.31w + 0.03
             with 1.26 as the floor: Ball gown 0.64; Train 0.43, Evening 0.49
             and Off-shoulder 0.29, all three at the floor. */
          bases: [1.51, 1.26, 1.26, 1.26] },
  gent: { path: GENT_TRACE, art: GENT_ART },
  lady: { path: LADY_TRACE, art: LADY_ART },
  suit: { path: SUIT_TRACE, art: SUIT_ART },
  /* One Volleyball shape: the men's pose 0, the women's 1. `groups` drives the
     Men / Women toggle; the pose row shows one group at a time. */
  volley: { paths: [VOLLEY_M_SPIKE_TRACE, VOLLEY_W_READY_TRACE],
            arts: [VOLLEY_M_SPIKE_ART, VOLLEY_W_READY_ART],
            names: ['Spike', 'Ready'],
            groups: [{ label: 'Men', from: 0, to: 1 }, { label: 'Women', from: 1, to: 2 }],
            /* priced by the sheet cut, 2.31w + 0.03 with 1.26 as the floor:
               w 0.66 for the spike, 0.42 for the women's Ready (the floor) */
            bases: [1.55, 1.26] },
  box: { paths: [BOX_M_VICTORY_TRACE, BOX_M_CHAMPION_TRACE, BOX_W_GUARD_TRACE, BOX_W_READY_TRACE],
         names: ['Victory', 'Champion', 'Guard', 'Ready'],
         groups: [{ label: 'Men', from: 0, to: 2 }, { label: 'Women', from: 2, to: 4 }],
         arts: [BOX_M_VICTORY_ART, BOX_M_CHAMPION_ART, BOX_W_GUARD_ART, BOX_W_READY_ART] },
  foot: { paths: [FOOT_M_CELEBRATE_TRACE, FOOT_W_CELEBRATE_TRACE],
          names: ['Celebrate', 'Celebrate'],
          groups: [{ label: 'Men', from: 0, to: 1 }, { label: 'Women', from: 1, to: 2 }],
          arts: [FOOT_M_CELEBRATE_ART, FOOT_W_CELEBRATE_ART],
          /* Sheet is bought by the rectangle, so a sprawling pose costs more
             than a compact one. Priced per pose, not per shape: 1.53w + 0.45,
             the rate the first poses were set at, with 1.26 as the floor --
             a figure is never cheaper to cut than a plaque. With the ball
             back under the boot: Celebrate 0.54, women's Celebrate 0.42 (the
             floor). */
          bases: [1.27, 1.26] },
  /* Athletics, the men's pose 0 and the women's 1-2. Priced like the football
     poses, 1.53w + 0.45, with 1.26 as the floor.

     Every `bases` here prices the sheet a pose really uses. fitFigure stands
     a figure with its feet in the middle of its base and cuts it smaller if it
     would reach past the base, so a sprawling or lopsided pose uses less sheet
     than its drawing suggests: w here is the blade's own rectangle at the
     medium size, width x height, over the full blade height squared.
     tests/figure-fit.js lists the poses that are cut smaller, and by how much. */
  run: { paths: [RUN_M_RUN_TRACE, RUN_W_SPRINT_TRACE, RUN_W_READY_TRACE],
         names: ['Run', 'Sprint', 'Ready'],
         groups: [{ label: 'Men', from: 0, to: 1 }, { label: 'Women', from: 1, to: 3 }],
         arts: [RUN_M_RUN_ART, RUN_W_SPRINT_ART, RUN_W_READY_ART],
         /* Run 0.58, women's Sprint 0.36 and Ready 0.33 (both at the floor);
            the two runners are cut smaller at the bigger sizes */
         bases: [1.33, 1.26, 1.26] },
  grad: { paths: [GRAD_TRACE, GRAD_W_TRACE],
          names: ['Graduate', 'Graduate'],
          groups: [{ label: 'Men', from: 0, to: 1 }, { label: 'Women', from: 1, to: 2 }],
          arts: [GRAD_ART, GRAD_W_ART],
          /* 0.32 and 0.34 of sheet, both at the 1.26 floor; the arms-up
             silhouette they replaced used 0.46 and was 1.42 */
          bases: [1.26, 1.26] },
  ball: { paths: [BALL_M_DRIBBLE_TRACE, BALL_W_READY_TRACE],
          names: ['Dribble', 'Ready'],
          groups: [{ label: 'Men', from: 0, to: 1 }, { label: 'Women', from: 1, to: 2 }],
          arts: [BALL_M_DRIBBLE_ART, BALL_W_READY_ART],
          /* Sheet actually cut, over the blade height squared: Dribble 0.49,
             Ready 0.42 -- priced at the basketball rate of 1.26 for 0.40
             (3.15w), with 1.26 as the floor. */
          bases: [1.53, 1.33] },
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

/* The face and clothes printed on a figure -- `detail` and `line` beside a
   single `path`, or `details` and `lines` beside `paths`, one per pose (null
   where a pose has none). polish-figure.py emits both in the same frame as the
   cut: the detail filled, for white ink on a dark sheet, and as a line drawn
   round it, for dark ink on a light one (filled black, a white shirt read as a
   black shirt on a white suit). */
export function figureDetail(key, variant, asLine = false) {
  const f = FIGURES[key];
  if (!f) return null;
  if (!f.paths) return (asLine ? f.line : f.detail) || null;
  const i = variant == null ? (VARIANT[key] || 0) : variant;
  const list = asLine ? f.lines : f.details;
  return (list && list[Math.min(Math.max(i, 0), f.paths.length - 1)]) || null;
}

/* A figure printed in full colour -- `art` beside a single `path`, or `arts`
   beside `paths`, one per pose (null where a pose has none): { src, box }, the
   drawing beside the site and its corners in the cut's own path units, from
   polish-figure.py. The owner chose this for the sports figures: face, skin,
   hair and kit in colour, over a silhouette with white details. */
export function figureArt(key, variant) {
  const f = FIGURES[key];
  if (!f) return null;
  if (!f.paths) return f.art || null;
  const i = variant == null ? (VARIANT[key] || 0) : variant;
  return (f.arts && f.arts[Math.min(Math.max(i, 0), f.paths.length - 1)]) || null;
}

/* One texture per drawing, shared by every trophy that shows it, so
   disposeGroup leaves it alone. It loads in the background; when it lands,
   'tala:art' tells every viewer to draw again. */
const ART_TEX = new Map();
function artTexture(art) {
  let tx = ART_TEX.get(art.src);
  if (!tx) {
    tx = new THREE.TextureLoader().load(new URL('../' + art.src, import.meta.url).href,
      () => window.dispatchEvent(new Event('tala:art')));
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 8;
    tx.userData.shared = true;
    ART_TEX.set(art.src, tx);
  }
  return tx;
}

/* What the order sheet says about the print, or null. */
export function printNote(cfg) {
  if (figureArt(cfg.shape, cfg.variant)) return 'Printed in full colour on the front: face, skin, hair and kit';
  if (!figureDetail(cfg.shape, cfg.variant)) return null;
  const mat = MATERIALS[cfg.material] || MATERIALS.blue;
  return printInk(mat) === PRINT_WHITE
    ? 'Face and clothes printed on the front, in white'
    : 'Face and clothes drawn on the front in a black line';
}

/* Print on a figure reads in contrast with its sheet: white on a dark sheet
   (the owner's reference: a black suit, the shirt and tie white), near-black on
   white, yellow, tan, clear or the mirrors. */
const PRINT_WHITE = 0xf3f0e8, PRINT_DARK = 0x1d1c1a;
export function printInk(mat) {
  if (mat.kind !== 'sheet') return PRINT_DARK;
  const c = new THREE.Color(mat.color);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.45 ? PRINT_DARK : PRINT_WHITE;
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
  lady:     { label: 'Lady',      build: ladyShape,     base: 1.30, decal: { onBase: true },              note: 'Printed in full colour: a lady in a flared red dress and heels.' },
  gown:     { label: 'Gown',      build: gownShape,     base: 1.24, decal: { onBase: true },              note: 'Four gowns, printed in full colour. Mutya, Mr & Ms and coronation nights.' },
  gent:     { label: 'Gentleman', build: gentShape,     base: 1.22, decal: { onBase: true },              note: 'Printed in full colour: a gentleman in a tuxedo. The pageant partner to the Lady.' },
  grad:     { label: 'Graduate',  build: gradShape,     base: 1.42, decal: { onBase: true },              note: 'Printed in full colour, men and women, in gown and cap. For recognition day.' },
  ball:     { label: 'Basketball',build: ballShape,     base: 1.26, decal: { onBase: true },              note: 'Printed in full colour, men and women, the ball in hand. The liga favourite.' },
  suit:     { label: 'Suit',       build: suitShape,    base: 1.26, decal: { onBase: true },              note: 'Printed in full colour: a man in a grey suit and tie. The partner to the Lady.' },
  volley:   { label: 'Volleyball',build: volleyShape,  base: 1.26, decal: { onBase: true },              note: 'Printed in full colour, men and women. The school and liga favourite.' },
  box:      { label: 'Boxing',    build: boxShape,      base: 1.26, decal: { onBase: true },              note: 'Printed in full colour, men and women. For boxing and arnis tournaments.' },
  foot:     { label: 'Football',  build: footShape,     base: 1.28, decal: { onBase: true },              note: 'Printed in full colour, men and women. Also used for futsal.' },
  run:      { label: 'Athletics', build: runShape,      base: 1.26, decal: { onBase: true },              note: 'Printed in full colour, men and women. Covers track, fun runs and Palaro.' },
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

  /* The figure's face and clothes, printed on its front in the same frame as
     the cut -- the owner's "faces and clothes instead of blank". A customer's
     own picture printed over the figure (below) replaces it. */
  /* A figure printed in full colour: the drawing laid on the cut's front and
     mapped through its `box` (path units) to the cut's own frame, so picture
     and edge line up. */
  const own = cfg.photoImg && cfg.photoTarget === 'figure';
  const art = onBase && cut && !own ? figureArt(cfg.shape, cfg.variant) : null;
  if (art) {
    const pg = new THREE.ShapeGeometry(pieces(cut), 24);
    const { k: fk, cx: fcx, maxY: fmax } = cut.userData.frame;
    const [ax0, ay0, ax1, ay1] = art.box;
    const P = pg.attributes.position, U = pg.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      const px = P.getX(i) / fk + fcx, py = fmax - P.getY(i) / fk;
      U.setXY(i, (px - ax0) / (ax1 - ax0), 1 - (py - ay0) / (ay1 - ay0));
    }
    const colour = new THREE.Mesh(pg, new THREE.MeshPhysicalMaterial({
      map: artTexture(art), transparent: true, alphaTest: 0.5, roughness: 0.3, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    colour.position.set(-bx, blade.position.y, faceZ + 0.003);
    colour.name = 'figurePrint';
    group.add(colour);
  }

  const ink = printInk(mat);
  const detail = onBase && cut && !own && !art
    ? figureDetail(cfg.shape, cfg.variant, ink === PRINT_DARK) : null;
  const printShape = detail && pathToShape(detail, w, h, cut.userData.frame);
  if (printShape) {
    const pg = new THREE.ShapeGeometry(pieces(printShape), 16);
    const print = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({
      color: ink, roughness: 0.45, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    print.position.set(-bx, blade.position.y, faceZ + 0.003);
    print.name = 'figurePrint';
    group.add(print);
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
        if (tx && !seen.has(tx) && !tx.userData?.shared) { seen.add(tx); tx.dispose(); }
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
/* A figure's print -- its face and clothes in white (figureDetail) or the whole
   drawing in full colour (figureArt): a sticker laid on the cut, priced like
   the second sticker. */
const FIGURE_PRINT_FEE = 40;
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
               + (cutFromPic && cfg.cutPrint ? CUT_PRINT_FEE : 0)
               + (figureDetail(cfg.shape, cfg.variant) || figureArt(cfg.shape, cfg.variant) ? FIGURE_PRINT_FEE : 0);
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
