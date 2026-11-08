/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — trophy model
   A trophy is a shape CUT FROM THIN COLOURED ACRYLIC SHEET, standing
   in a base, with a full-colour printed sticker applied to it.
   Every shape here is flat-cuttable: no cups, no thin protrusions,
   nothing that would have to be bent or moulded.
   Units are centimetres; 1 unit = 1 cm.
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

/* ───────────────────── shapes, authored as path data ─────────────────────
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
   The panel trophies, as stacked acrylic. The owner's catalogue pictures set
   the look -- a body cut from the customer's sheet, with coloured layers laid
   on it: an inner panel, a frame, rings, stars, a gold medallion, each cut from
   its own sheet. They asked for exactly that ("layers, like embedding, if it
   needs two or more acrylic layers") after their photos, printed on the cuts,
   came out "low resolution and blurry". So nothing here is a picture: every
   design is vector, drawn by figure-src/trophy-designs.py. The customer's
   sticker sits on the design's face layer; there is no name plate on the base. */

/* <designs> written by figure-src/trophy-designs.py -- edit there, not here.
   Each panel trophy as stacked acrylic: `body` cut from the customer's sheet
   (`sheet` is the colour it is shown in first), `layers` laid on it -- `level`
   1 sits on the body, 2 on a level-1 layer -- and `face`, the sticker's box
   (fractions as a SHAPES decal) on the layer `on` (-1: the body itself). */
export const DESIGNS = {
  plaque: {
    name: "Certificate", group: 'Classic', sheet: 'white', base: 0.94,
    note: "A certificate plaque: a gold rule round the edge, a ribboned seal and a cluster of green triangles.",
    body: `M211.0 0.0 L5.0 0.0 L3.5 0.2 L2.6 0.6 L1.5 1.5 L0.8 2.2 L0.2 3.5 L0.0 5.0 L0.0 295.0 L0.1 296.0 L0.6 297.4 L1.5 298.5 L2.2 299.2 L3.5 299.8 L5.0 300.0 L211.0 300.0 L212.5 299.8 L213.4 299.4 L214.5 298.5 L215.2 297.8 L215.8 296.5 L216.0 295.0 L216.0 5.0 L215.9 4.0 L215.6 3.1 L215.2 2.2 L214.5 1.5 L213.8 0.8 L212.9 0.4 L212.0 0.1 Z`,
    layers: [
      { d: `M207.0 291.0 L207.0 9.0 L9.0 9.0 L9.0 291.0 Z M203.5 287.5 L12.5 287.5 L12.5 12.5 L203.5 12.5 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M173.7 74.0 L170.8 73.2 L169.5 72.7 L167.8 71.8 L165.5 70.2 L164.0 69.0 L163.0 68.0 L155.0 101.0 L162.0 96.0 L168.0 104.0 Z M192.2 68.8 L189.9 70.7 L188.3 71.7 L187.1 72.4 L184.6 73.4 L182.7 74.0 L181.3 74.2 L187.0 104.0 L193.0 96.0 L200.0 101.0 Z`, mat: 'green', level: 1, fin: 'gloss' },
      { d: `M197.0 53.4 L196.8 51.5 L196.5 49.7 L196.0 47.9 L195.3 46.2 L194.5 44.5 L193.4 42.9 L192.3 41.5 L191.0 40.1 L189.6 38.9 L188.0 37.9 L186.4 37.0 L184.7 36.2 L182.9 35.6 L181.1 35.3 L179.2 35.0 L177.4 35.0 L175.5 35.2 L173.7 35.5 L171.9 36.0 L170.2 36.7 L168.5 37.5 L166.9 38.6 L165.5 39.7 L164.1 41.0 L162.9 42.4 L161.9 44.0 L161.0 45.6 L160.2 47.3 L159.6 49.1 L159.3 50.9 L159.0 52.8 L159.0 54.6 L159.2 56.5 L159.5 58.3 L160.0 60.1 L160.7 61.8 L161.5 63.5 L162.6 65.1 L163.7 66.5 L165.0 67.9 L166.4 69.1 L168.0 70.1 L169.6 71.0 L171.3 71.8 L173.1 72.4 L174.9 72.7 L176.8 73.0 L178.6 73.0 L180.5 72.8 L182.3 72.5 L184.1 72.0 L185.8 71.3 L187.5 70.5 L189.1 69.4 L190.5 68.3 L191.9 67.0 L193.1 65.6 L194.1 64.0 L195.0 62.4 L195.8 60.7 L196.4 58.9 L196.7 57.1 L197.0 55.2 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M179.5 230.5 L170.0 214.0 L160.5 230.5 Z M149.5 250.1 L168.5 250.1 L159.0 233.5 Z M171.5 250.1 L190.5 250.1 L181.0 233.5 Z M157.5 269.6 L148.0 253.1 L138.5 269.6 Z M160.5 269.6 L179.5 269.6 L170.0 253.1 Z M182.5 269.6 L201.5 269.6 L192.0 253.1 Z`, mat: 'green', level: 1, fin: 'gloss' }
    ],
    face: { x: -0.094, y: 0.567, w: 0.525, h: 0.535, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/plaque.9dc7b2be.webp", "box": [-6.0, -6.0, 222.05, 306.19]}, tile: "img/designs/tile-plaque.21524b19.webp",
  },
  monolith: {
    name: "Crystal", group: 'Classic', sheet: 'clear', base: 0.96,
    note: "A clear block with a slanted top, a frosted window and a silver emblem.",
    body: `M1.8 17.6 L1.0 17.9 L0.7 18.1 L0.2 18.8 L0.0 19.6 L0.0 298.0 L0.2 298.8 L0.3 299.1 L0.9 299.7 L1.6 300.0 L2.0 300.0 L168.1 300.0 L168.5 300.0 L169.2 299.7 L169.5 299.4 L170.0 298.8 L170.1 298.0 L170.1 2.0 L170.0 1.3 L169.8 0.9 L169.6 0.6 L169.0 0.2 L168.3 0.0 L167.9 0.0 Z`,
    layers: [
      { d: `M157.1 287.0 L157.1 14.2 L13.0 29.5 L13.0 287.0 Z`, mat: 'frost', level: 1, fin: 'frost' },
      { d: `M64.8 68.5 L64.8 68.9 L65.0 69.4 L65.2 69.7 L65.8 69.8 L104.3 69.8 L104.7 69.8 L105.0 69.5 L105.3 69.2 L105.3 68.9 L105.2 68.3 L85.9 35.3 L85.5 34.9 L85.2 34.8 L84.6 34.9 L84.2 35.3 Z`, mat: 'silver', level: 2, fin: 'foil' }
    ],
    face: { x: -0.004, y: 0.409, w: 0.537, h: 0.547, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/monolith.ede2e98b.webp", "box": [-6.0, -6.0, 176.34, 306.19]}, tile: "img/designs/tile-monolith.019afefc.webp",
  },
  tablet: {
    name: "Tablet", group: 'Classic', sheet: 'clear', base: 0.96,
    note: "An upright tablet, one corner rounded: a navy ring medallion and a stair of navy squares.",
    body: `M31.0 0.0 L27.8 0.3 L25.8 0.6 L22.7 1.4 L19.8 2.4 L16.9 3.8 L15.1 4.8 L12.5 6.6 L10.1 8.6 L8.6 10.1 L6.6 12.5 L4.8 15.1 L3.3 17.8 L2.1 20.7 L1.1 23.7 L0.6 25.8 L0.2 28.9 L0.0 32.0 L0.0 300.0 L190.0 300.0 L190.0 0.0 Z`,
    layers: [
      { d: `M176.9 50.0 L176.6 47.0 L175.9 44.0 L175.0 41.1 L173.8 38.3 L172.3 35.6 L170.6 33.1 L168.6 30.8 L166.4 28.7 L164.1 26.8 L161.5 25.2 L158.8 23.8 L156.0 22.6 L153.0 21.8 L150.0 21.3 L147.0 21.0 L144.0 21.1 L141.0 21.4 L138.0 22.1 L135.1 23.0 L132.3 24.2 L129.6 25.7 L127.1 27.4 L124.8 29.4 L122.7 31.6 L120.8 33.9 L119.2 36.5 L117.8 39.2 L116.6 42.0 L115.8 45.0 L115.3 48.0 L115.0 51.0 L115.1 54.0 L115.4 57.0 L116.1 60.0 L117.0 62.9 L118.2 65.7 L119.7 68.4 L121.4 70.9 L123.4 73.2 L125.6 75.3 L127.9 77.2 L130.5 78.8 L133.2 80.2 L136.0 81.4 L139.0 82.2 L142.0 82.7 L145.0 83.0 L148.0 82.9 L151.0 82.6 L154.0 81.9 L156.9 81.0 L159.7 79.8 L162.4 78.3 L164.9 76.6 L167.2 74.6 L169.3 72.4 L171.2 70.1 L172.8 67.5 L174.2 64.8 L175.4 62.0 L176.2 59.0 L176.7 56.0 L177.0 53.0 Z M169.9 53.6 L169.7 55.9 L169.2 58.2 L168.5 60.5 L167.5 62.6 L166.4 64.7 L165.0 66.6 L163.5 68.4 L161.8 70.0 L160.0 71.5 L158.0 72.8 L155.9 73.9 L153.7 74.7 L151.4 75.4 L149.1 75.8 L146.8 76.0 L144.4 75.9 L142.1 75.7 L139.8 75.2 L137.5 74.5 L135.4 73.5 L133.3 72.4 L131.4 71.0 L129.6 69.5 L128.0 67.8 L126.5 66.0 L125.2 64.0 L124.1 61.9 L123.3 59.7 L122.6 57.4 L122.2 55.1 L122.0 52.8 L122.1 50.4 L122.3 48.1 L122.8 45.8 L123.5 43.5 L124.5 41.4 L125.6 39.3 L127.0 37.4 L128.5 35.6 L130.2 34.0 L132.0 32.5 L134.0 31.2 L136.1 30.1 L138.3 29.3 L140.6 28.6 L142.9 28.2 L145.2 28.0 L147.6 28.1 L149.9 28.3 L152.2 28.8 L154.5 29.5 L156.6 30.5 L158.7 31.6 L160.6 33.0 L162.4 34.5 L164.0 36.2 L165.5 38.0 L166.8 40.0 L167.9 42.1 L168.7 44.3 L169.4 46.6 L169.8 48.9 L170.0 51.2 Z`, mat: 'navy', level: 1, fin: 'gloss' },
      { d: `M167.0 51.3 L166.8 49.3 L166.5 47.2 L165.9 45.2 L165.1 43.3 L164.2 41.5 L163.1 39.8 L161.8 38.2 L160.4 36.7 L158.8 35.3 L157.1 34.2 L155.3 33.2 L153.4 32.3 L151.4 31.7 L149.4 31.3 L147.4 31.0 L145.3 31.0 L143.3 31.2 L141.2 31.5 L139.2 32.1 L137.3 32.9 L135.5 33.8 L133.8 34.9 L132.2 36.2 L130.7 37.6 L129.3 39.2 L128.2 40.9 L127.2 42.7 L126.3 44.6 L125.7 46.6 L125.3 48.6 L125.0 50.6 L125.0 52.7 L125.2 54.7 L125.5 56.8 L126.1 58.8 L126.9 60.7 L127.8 62.5 L128.9 64.2 L130.2 65.8 L131.6 67.3 L133.2 68.7 L134.9 69.8 L136.7 70.8 L138.6 71.7 L140.6 72.3 L142.6 72.7 L144.6 73.0 L146.7 73.0 L148.7 72.8 L150.8 72.5 L152.8 71.9 L154.7 71.1 L156.5 70.2 L158.2 69.1 L159.8 67.8 L161.3 66.4 L162.7 64.8 L163.8 63.1 L164.8 61.3 L165.7 59.4 L166.3 57.4 L166.7 55.4 L167.0 53.4 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M41.0 168.0 L14.0 168.0 L14.0 193.0 L41.0 193.0 Z M36.5 172.5 L36.5 188.5 L18.5 188.5 L18.5 172.5 Z M41.0 198.0 L14.0 198.0 L14.0 223.0 L41.0 223.0 Z M36.5 202.5 L36.5 218.5 L18.5 218.5 L18.5 202.5 Z M74.0 198.0 L47.0 198.0 L47.0 223.0 L74.0 223.0 Z M69.5 202.5 L69.5 218.5 L51.5 218.5 L51.5 202.5 Z M14.0 253.0 L41.0 253.0 L41.0 228.0 L14.0 228.0 Z M18.5 248.5 L18.5 232.5 L36.5 232.5 L36.5 248.5 Z M47.0 253.0 L74.0 253.0 L74.0 228.0 L47.0 228.0 Z M51.5 248.5 L51.5 232.5 L69.5 232.5 L69.5 248.5 Z M107.0 228.0 L80.0 228.0 L80.0 253.0 L107.0 253.0 Z M102.5 232.5 L102.5 248.5 L84.5 248.5 L84.5 232.5 Z M41.0 258.0 L14.0 258.0 L14.0 283.0 L41.0 283.0 Z M36.5 262.5 L36.5 278.5 L18.5 278.5 L18.5 262.5 Z M74.0 258.0 L47.0 258.0 L47.0 283.0 L74.0 283.0 Z M69.5 262.5 L69.5 278.5 L51.5 278.5 L51.5 262.5 Z M80.0 283.0 L107.0 283.0 L107.0 258.0 L80.0 258.0 Z M84.5 278.5 L84.5 262.5 L102.5 262.5 L102.5 278.5 Z M113.0 283.0 L140.0 283.0 L140.0 258.0 L113.0 258.0 Z M117.5 278.5 L117.5 262.5 L135.5 262.5 L135.5 278.5 Z`, mat: 'navy', level: 1, fin: 'gloss' }
    ],
    face: { x: 0.159, y: 0.508, w: 0.393, h: 0.375, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/tablet.b1e30c55.webp", "box": [-6.0, -6.0, 196.03, 306.19]}, tile: "img/designs/tile-tablet.08d9f684.webp",
  },
  crownpanel: {
    name: "Crown Panel", group: 'Classic', sheet: 'navy', base: 1.00,
    note: "A barrel-sided navy panel: three gold stars on its crown band, a white panel framed in gold, a crystal set in a hexagon at its foot.",
    body: `M167.1 300.0 L174.5 271.2 L176.9 260.7 L179.2 249.7 L182.0 233.4 L183.3 225.0 L184.8 213.5 L186.2 201.9 L187.2 193.0 L188.8 174.8 L190.0 155.1 L190.9 135.0 L191.1 125.0 L191.3 112.0 L191.2 78.4 L191.0 70.5 L190.7 62.8 L190.2 55.5 L189.7 50.9 L189.1 46.4 L188.3 42.3 L186.4 34.0 L185.1 28.8 L183.5 23.9 L182.0 20.6 L180.8 18.6 L179.5 16.7 L178.0 14.9 L176.3 13.3 L174.4 11.9 L172.3 10.6 L170.0 9.6 L166.4 8.2 L162.5 7.1 L158.4 6.2 L141.3 3.0 L137.2 2.4 L130.9 1.7 L120.0 0.7 L113.3 0.4 L106.6 0.1 L100.0 0.0 L91.3 0.0 L82.5 0.2 L75.8 0.5 L69.1 0.9 L62.5 1.4 L56.1 2.1 L50.0 3.0 L32.9 6.2 L28.8 7.1 L24.9 8.2 L21.2 9.6 L19.0 10.6 L16.9 11.9 L15.9 12.6 L15.0 13.3 L13.3 14.9 L11.1 17.6 L9.9 19.6 L8.8 21.7 L7.8 23.9 L7.0 26.3 L5.5 31.3 L3.9 38.1 L2.2 46.4 L1.6 50.9 L0.9 57.9 L0.6 62.8 L0.3 70.5 L0.0 86.5 L0.0 108.9 L0.1 121.7 L0.4 135.0 L0.9 148.4 L1.6 161.7 L2.3 171.6 L3.3 184.2 L4.4 196.0 L5.8 207.7 L7.2 219.3 L8.9 230.7 L10.2 239.0 L12.1 249.7 L13.4 256.4 L16.3 269.1 L24.2 300.0 Z`,
    layers: [
      { d: `M17.1 54.4 L16.2 54.5 L15.2 54.7 L14.4 55.2 L13.6 55.7 L12.9 56.4 L12.4 57.3 L12.1 58.2 L11.9 59.1 L11.4 68.3 L11.2 75.9 L11.1 86.5 L11.1 108.9 L11.2 121.5 L11.5 134.6 L11.9 144.6 L12.5 157.8 L13.1 167.6 L14.3 183.2 L16.1 200.6 L18.2 217.8 L20.7 234.4 L23.4 249.8 L25.6 260.3 L28.1 270.6 L31.9 285.2 L32.2 286.0 L32.7 286.9 L33.3 287.6 L34.0 288.1 L34.9 288.6 L35.8 288.8 L36.7 288.9 L154.6 288.9 L155.5 288.8 L156.4 288.6 L157.3 288.1 L158.0 287.6 L158.6 286.9 L159.1 286.0 L159.4 285.2 L164.7 264.5 L166.6 256.2 L167.9 249.8 L170.6 234.4 L173.1 217.8 L175.2 200.7 L176.7 186.1 L178.0 170.8 L179.0 154.5 L179.7 137.9 L180.1 121.6 L180.2 105.8 L180.1 75.9 L179.9 68.3 L179.5 61.1 L179.4 59.1 L179.2 58.2 L178.9 57.3 L178.4 56.4 L177.7 55.7 L176.9 55.2 L176.1 54.7 L175.1 54.5 L174.2 54.4 L173.2 54.6 L165.0 56.3 L154.5 58.1 L143.4 59.7 L131.9 60.9 L124.0 61.5 L111.9 62.1 L99.7 62.4 L87.5 62.3 L79.3 62.1 L67.3 61.5 L59.5 60.9 L51.6 60.1 L44.1 59.2 L33.3 57.6 L26.3 56.3 L18.1 54.6 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M17.7 49.9 L15.5 50.0 L13.7 50.5 L12.0 51.3 L10.6 52.4 L9.3 53.7 L8.4 55.3 L7.7 57.0 L7.4 58.8 L7.0 65.7 L6.7 75.8 L6.5 108.8 L6.8 128.2 L7.5 148.1 L8.6 167.9 L9.3 177.5 L10.1 186.5 L10.9 195.3 L12.3 206.9 L13.3 215.6 L14.9 226.9 L17.6 243.2 L18.9 250.6 L20.3 257.2 L22.2 265.5 L24.7 275.8 L27.5 286.3 L28.3 288.4 L29.0 289.5 L29.9 290.6 L31.6 292.0 L33.2 292.8 L34.5 293.2 L36.7 293.5 L154.6 293.5 L156.4 293.3 L157.7 292.9 L159.7 292.0 L161.1 290.9 L162.3 289.5 L163.2 288.0 L163.7 286.7 L168.6 267.6 L171.5 255.0 L172.8 248.5 L174.2 240.6 L176.8 224.1 L179.0 206.9 L180.9 189.5 L182.5 171.2 L183.5 154.8 L184.2 138.1 L184.7 118.4 L184.8 108.9 L184.7 86.5 L184.5 70.7 L184.2 63.3 L183.9 58.8 L183.6 57.0 L182.7 54.9 L182.0 53.7 L181.1 52.7 L179.3 51.3 L177.6 50.5 L176.3 50.1 L174.0 49.9 L172.2 50.1 L167.4 51.2 L160.8 52.5 L153.8 53.7 L142.9 55.2 L131.5 56.3 L119.7 57.2 L107.7 57.7 L95.6 57.9 L83.5 57.7 L75.5 57.4 L67.6 56.9 L59.8 56.3 L48.4 55.2 L41.1 54.2 L34.0 53.1 L27.2 51.9 L19.1 50.1 Z M17.4 51.9 L30.1 54.5 L37.2 55.6 L44.5 56.7 L52.0 57.6 L63.5 58.7 L71.4 59.2 L79.4 59.6 L87.5 59.8 L99.7 59.9 L107.8 59.7 L119.9 59.2 L131.7 58.3 L143.1 57.2 L154.1 55.7 L161.2 54.5 L167.8 53.2 L172.7 52.1 L174.1 51.9 L175.8 52.1 L176.9 52.4 L178.2 53.0 L179.6 54.0 L180.4 54.9 L181.0 55.9 L181.6 57.5 L181.9 58.9 L182.3 65.7 L182.5 73.3 L182.7 83.8 L182.7 105.8 L182.6 121.6 L182.1 141.3 L181.3 157.9 L180.2 174.2 L178.9 189.2 L177.4 203.8 L175.2 221.0 L172.6 237.5 L169.9 252.5 L167.1 265.1 L161.9 285.8 L161.4 287.1 L160.7 288.3 L159.7 289.4 L158.6 290.3 L157.3 290.9 L156.2 291.3 L154.6 291.4 L36.7 291.4 L35.3 291.3 L34.2 291.0 L32.7 290.3 L31.4 289.2 L30.6 288.3 L30.0 287.3 L29.4 285.8 L25.7 271.2 L23.7 263.0 L21.8 254.6 L20.5 248.1 L19.1 240.2 L16.5 223.8 L15.0 212.5 L13.9 203.8 L12.6 192.2 L11.8 183.4 L11.0 174.2 L10.4 164.5 L9.3 144.7 L8.7 124.8 L8.6 105.8 L8.7 75.9 L9.0 65.7 L9.4 58.9 L9.7 57.3 L10.2 56.1 L10.8 55.1 L11.9 53.9 L13.1 53.0 L14.4 52.4 L16.0 52.0 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M89.3 27.2 L85.9 38.6 L95.6 31.8 L105.4 38.6 L102.0 27.2 L111.4 20.0 L99.6 19.8 L95.6 8.6 L91.7 19.8 L79.9 20.0 Z M43.3 37.9 L51.6 43.6 L48.7 34.0 L56.7 27.9 L46.6 27.7 L43.3 18.1 L40.0 27.7 L29.9 27.9 L37.9 34.0 L35.0 43.6 Z M148.0 37.9 L156.3 43.6 L153.4 34.0 L161.4 27.9 L151.3 27.7 L148.0 18.1 L144.7 27.7 L134.6 27.9 L142.6 34.0 L139.7 43.6 Z`, mat: 'gold', level: 1, fin: 'glitter' },
      { d: `M67.8 249.5 L67.8 249.9 L68.0 250.7 L81.0 273.1 L81.5 273.7 L81.9 273.9 L82.7 274.1 L108.6 274.1 L109.4 273.9 L109.8 273.7 L110.3 273.1 L123.3 250.7 L123.5 249.9 L123.5 249.5 L123.3 248.7 L110.3 226.3 L110.1 225.9 L109.4 225.4 L108.6 225.3 L82.7 225.3 L81.9 225.4 L81.5 225.6 L81.0 226.3 L68.0 248.7 Z M106.3 231.3 L116.9 249.7 L106.3 268.0 L85.0 268.0 L74.4 249.7 L85.0 231.3 Z`, mat: 'navy', level: 2, fin: 'gloss' },
      { d: `M110.7 249.2 L110.6 247.7 L110.4 246.2 L109.9 244.8 L109.4 243.4 L108.7 242.1 L107.9 240.9 L107.0 239.7 L106.0 238.6 L104.8 237.7 L103.6 236.8 L102.3 236.1 L101.0 235.5 L99.6 235.1 L98.1 234.8 L96.6 234.6 L95.2 234.6 L93.7 234.7 L92.2 235.0 L90.8 235.4 L89.4 235.9 L88.1 236.6 L86.9 237.4 L85.7 238.3 L84.6 239.3 L83.7 240.5 L82.8 241.7 L82.1 243.0 L81.5 244.3 L81.1 245.8 L80.8 247.2 L80.6 248.7 L80.6 250.2 L80.7 251.6 L80.9 253.1 L81.3 254.5 L81.9 255.9 L82.6 257.2 L83.4 258.5 L84.3 259.6 L85.3 260.7 L86.5 261.6 L87.7 262.5 L89.0 263.2 L90.3 263.8 L91.7 264.3 L93.2 264.6 L94.7 264.7 L96.1 264.8 L97.6 264.6 L99.1 264.4 L100.5 264.0 L101.9 263.4 L103.2 262.7 L104.4 261.9 L105.6 261.0 L106.7 260.0 L107.6 258.9 L108.5 257.6 L109.2 256.3 L109.8 255.0 L110.2 253.6 L110.5 252.1 L110.7 250.7 Z`, mat: 'frost', level: 2, fin: 'crystal' }
    ],
    face: { x: -0.002, y: 0.517, w: 0.498, h: 0.476, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/crownpanel.9be9f038.webp", "box": [-6.0, -5.98, 197.44, 306.21]}, tile: "img/designs/tile-crownpanel.e2d611d0.webp",
  },
  pentagon: {
    name: "Pentagon", group: 'Classic', sheet: 'clear', base: 1.00,
    note: "A clear pentagon: a frosted rim, a white inner pentagon and a fine black rule.",
    body: `M1.4 112.7 L0.8 113.1 L0.4 113.7 L0.1 114.3 L0.0 115.0 L0.0 115.7 L0.1 116.4 L59.1 297.7 L59.3 298.3 L59.7 298.9 L60.3 299.4 L60.9 299.7 L61.5 299.9 L62.2 300.0 L252.8 300.0 L253.5 299.9 L254.2 299.7 L254.8 299.4 L255.3 298.9 L255.7 298.3 L256.0 297.7 L314.9 116.4 L315.1 115.7 L315.1 115.0 L314.9 114.3 L314.6 113.7 L314.2 113.1 L313.7 112.7 L159.5 0.6 L158.9 0.3 L158.2 0.1 L157.5 0.0 L156.8 0.1 L156.2 0.3 L155.6 0.6 Z`,
    layers: [
      { d: `M0.4 113.7 L0.1 114.3 L0.0 115.0 L0.0 115.7 L0.1 116.4 L59.1 297.7 L59.3 298.3 L59.7 298.9 L60.3 299.4 L60.9 299.7 L61.5 299.9 L62.2 300.0 L252.8 300.0 L253.5 299.9 L254.2 299.7 L254.8 299.4 L255.3 298.9 L255.7 298.3 L256.0 297.7 L314.9 116.4 L315.1 115.7 L315.1 115.0 L314.9 114.3 L314.6 113.7 L314.2 113.1 L313.7 112.7 L159.5 0.6 L158.9 0.3 L158.2 0.1 L157.5 0.0 L156.8 0.1 L156.2 0.3 L155.6 0.6 L1.4 112.7 L0.8 113.1 Z M301.3 118.8 L246.4 287.8 L68.7 287.8 L13.7 118.8 L157.5 14.3 Z`, mat: 'frost', level: 1, fin: 'frost' },
      { d: `M71.1 284.5 L244.0 284.5 L297.4 120.0 L157.5 18.4 L17.6 120.0 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M238.3 276.7 L288.3 123.0 L157.5 28.0 L26.8 123.0 L76.7 276.7 Z M284.4 124.3 L235.9 273.4 L79.1 273.4 L30.7 124.3 L157.5 32.1 Z`, mat: 'black', level: 2, fin: 'gloss' }
    ],
    face: { x: 0.001, y: 0.389, w: 0.597, h: 0.536, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/pentagon.cd30c060.webp", "box": [-6.0, -6.0, 321.19, 306.19]}, tile: "img/designs/tile-pentagon.38d19e57.webp",
  },
  arch: {
    name: "Sun Arch", group: 'Classic', sheet: 'navy', base: 1.04,
    note: "An arch in the colours of the flag: a white wave, a red band and the gold sun.",
    body: `M184.0 89.0 L183.6 83.0 L183.2 80.0 L182.2 74.1 L180.9 68.2 L179.1 62.4 L177.0 56.8 L174.5 51.3 L173.1 48.6 L170.1 43.4 L166.8 38.4 L163.1 33.6 L159.1 29.1 L157.1 26.9 L152.7 22.8 L148.0 19.0 L143.1 15.5 L138.0 12.3 L132.7 9.5 L127.2 7.0 L124.4 5.9 L118.7 4.0 L112.9 2.4 L109.9 1.8 L107.0 1.2 L101.0 0.4 L95.0 0.0 L89.0 0.0 L83.0 0.4 L80.0 0.8 L74.1 1.8 L68.2 3.1 L62.4 4.9 L56.8 7.0 L54.0 8.2 L48.6 10.9 L43.4 13.9 L38.4 17.2 L33.6 20.9 L31.3 22.8 L26.9 26.9 L22.8 31.3 L19.0 36.0 L15.5 40.9 L13.9 43.4 L12.3 46.0 L9.5 51.3 L7.0 56.8 L5.9 59.6 L4.0 65.3 L2.4 71.1 L1.2 77.0 L0.4 83.0 L0.0 89.0 L0.0 92.0 L0.0 300.0 L184.0 300.0 Z`,
    layers: [
      { d: `M43.4 13.9 L38.4 17.2 L33.6 20.9 L31.3 22.8 L26.9 26.9 L24.9 29.1 L20.9 33.6 L19.0 36.0 L15.5 40.9 L13.9 43.4 L10.9 48.6 L9.5 51.3 L7.0 56.8 L5.9 59.6 L4.0 65.3 L2.4 71.1 L1.2 77.0 L0.4 83.0 L0.0 89.0 L0.0 92.0 L0.0 300.0 L68.2 300.0 L68.5 292.6 L68.3 283.8 L67.6 275.1 L66.6 266.5 L65.2 257.9 L63.5 249.5 L61.6 241.2 L59.4 232.9 L57.1 224.7 L54.6 216.5 L44.5 183.8 L42.1 175.5 L39.9 167.3 L37.9 159.0 L36.1 150.6 L34.6 142.1 L33.4 133.5 L32.6 124.9 L32.2 116.1 L32.4 107.2 L32.9 98.8 L26.1 103.9 L25.4 104.0 L24.8 103.9 L24.3 103.4 L24.0 102.7 L24.0 102.2 L24.3 101.6 L34.3 88.3 L36.1 78.6 L35.5 76.8 L35.0 74.8 L11.8 71.5 L11.2 71.3 L10.9 71.0 L10.6 70.6 L10.5 70.1 L10.5 69.6 L10.8 69.1 L11.1 68.8 L11.6 68.5 L35.0 65.2 L35.5 63.2 L36.3 61.0 L37.3 58.9 L38.3 57.2 L24.2 38.2 L24.0 37.7 L24.0 37.1 L24.3 36.6 L24.7 36.2 L25.1 36.0 L25.5 36.0 L26.0 36.1 L26.4 36.3 L45.2 50.3 L45.3 50.2 L50.0 40.0 L50.0 10.2 L46.0 12.3 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M183.2 80.0 L182.2 74.1 L180.9 68.2 L179.1 62.4 L177.0 56.8 L174.5 51.3 L171.7 46.0 L168.5 40.9 L166.8 38.4 L163.4 34.0 L163.1 41.6 L162.8 53.1 L162.8 64.3 L162.9 75.3 L163.2 86.1 L163.6 96.7 L164.1 107.2 L165.4 127.6 L169.3 177.1 L170.7 196.6 L171.7 216.2 L172.0 226.0 L172.2 235.9 L172.2 245.9 L172.1 256.1 L171.7 266.3 L171.1 276.7 L170.2 287.2 L168.9 300.0 L184.0 300.0 L184.0 92.0 L183.8 86.0 Z`, mat: 'red', level: 1, fin: 'brush' },
      { d: `M54.5 48.3 L52.3 48.7 L49.6 49.7 L47.0 50.9 L45.1 52.2 L25.5 37.5 L40.2 57.1 L38.9 59.0 L37.7 61.6 L36.7 64.3 L36.3 66.5 L12.0 70.0 L36.3 73.5 L36.7 75.7 L37.7 78.4 L38.9 81.0 L40.2 82.9 L25.5 102.5 L45.1 87.8 L47.0 89.1 L49.6 90.3 L52.3 91.3 L54.5 91.7 L58.0 116.0 L61.5 91.7 L63.7 91.3 L66.4 90.3 L69.0 89.1 L70.9 87.8 L90.5 102.5 L75.8 82.9 L77.1 81.0 L78.3 78.4 L79.3 75.7 L79.7 73.5 L104.0 70.0 L79.7 66.5 L79.3 64.3 L78.3 61.6 L77.1 59.0 L75.8 57.1 L90.5 37.5 L70.9 52.2 L69.0 50.9 L66.4 49.7 L63.7 48.7 L61.5 48.3 L58.0 24.0 Z`, mat: 'gold', level: 1, fin: 'glitter' }
    ],
    face: { x: 0.108, y: 0.332, w: 0.369, h: 0.376, level: 0, on: -1 },
    ink: 'printlight', art: {"src": "img/designs/arch.7191f2f0.webp", "box": [-6.0, -5.95, 190.17, 306.0]}, tile: "img/designs/tile-arch.083722ee.webp",
  },
  shield: {
    name: "Tulip", group: 'Classic', sheet: 'clear', base: 1.02,
    note: "A clear tulip crest outlined in gold, with frosted arcs crossing at its foot.",
    body: `M32.4 9.6 L8.7 0.0 L7.8 0.0 L6.9 0.4 L6.5 0.7 L6.0 1.4 L5.7 2.3 L2.5 41.8 L1.3 59.0 L0.9 67.6 L0.3 85.3 L0.1 97.1 L0.0 109.0 L0.1 120.8 L0.4 129.6 L0.9 138.3 L1.6 146.8 L2.3 155.3 L3.2 163.8 L5.0 177.8 L6.3 186.1 L7.8 194.3 L9.4 202.4 L10.6 207.5 L13.2 217.4 L17.0 229.6 L20.2 239.1 L30.6 268.4 L41.7 298.4 L42.3 299.2 L43.1 299.8 L44.1 300.0 L115.4 300.0 L116.4 299.8 L117.2 299.2 L117.7 298.4 L127.1 273.4 L140.0 236.8 L143.2 227.2 L145.5 219.9 L147.6 212.5 L148.9 207.5 L151.1 197.0 L152.2 191.6 L153.6 183.4 L155.6 169.4 L156.6 161.0 L157.4 152.5 L158.3 141.2 L158.9 132.6 L159.1 126.7 L159.4 117.9 L159.5 109.0 L159.4 100.1 L158.9 79.4 L158.4 64.8 L158.0 56.1 L156.8 38.9 L153.7 1.9 L153.3 1.0 L152.6 0.4 L151.7 0.0 L150.8 0.0 L127.1 9.6 L120.5 12.0 L114.1 14.1 L102.5 17.4 L98.2 18.6 L93.9 19.5 L89.7 20.3 L86.8 20.7 L82.6 21.1 L79.7 21.2 L76.8 21.1 L72.6 20.7 L69.7 20.3 L65.5 19.5 L61.2 18.6 L57.0 17.4 L45.4 14.1 L38.9 12.0 Z`,
    layers: [
      { d: `M66.2 234.6 L62.0 231.9 L57.8 229.4 L53.5 227.0 L49.0 224.7 L44.6 222.6 L40.0 220.6 L35.4 218.8 L30.7 217.1 L24.1 215.1 L26.2 222.0 L33.3 224.5 L37.7 226.2 L42.1 228.1 L46.4 230.1 L50.6 232.3 L54.8 234.6 L58.8 237.1 L62.8 239.7 L66.8 242.4 L70.6 245.2 L75.1 248.9 L70.3 253.5 L66.8 257.0 L63.8 260.4 L60.7 258.0 L57.3 255.5 L53.9 253.1 L50.3 250.8 L46.7 248.6 L43.0 246.6 L39.2 244.6 L33.0 241.8 L35.3 248.4 L40.6 251.0 L44.2 253.0 L47.6 255.1 L51.1 257.3 L54.4 259.6 L57.7 262.0 L60.5 264.3 L57.2 268.4 L54.3 272.3 L51.4 276.4 L47.6 282.4 L50.1 288.9 L50.9 288.9 L53.9 283.8 L56.5 279.8 L59.2 275.9 L62.0 272.1 L65.1 268.2 L69.9 272.7 L72.7 275.7 L76.5 279.9 L72.3 285.3 L69.9 288.9 L76.0 288.9 L79.7 283.9 L83.5 288.9 L89.6 288.9 L87.1 285.3 L83.0 279.9 L86.8 275.7 L89.6 272.7 L94.4 268.2 L97.4 272.1 L100.3 275.9 L103.0 279.8 L105.6 283.8 L108.6 288.9 L109.4 288.9 L111.8 282.4 L108.0 276.4 L105.2 272.3 L102.2 268.4 L99.0 264.3 L101.8 262.0 L105.1 259.6 L108.4 257.3 L111.8 255.1 L115.3 253.0 L118.9 251.0 L124.1 248.4 L126.5 241.8 L120.3 244.6 L116.5 246.6 L112.8 248.6 L109.2 250.8 L105.6 253.1 L102.1 255.5 L98.7 258.0 L95.7 260.4 L92.6 257.0 L89.2 253.5 L84.3 248.9 L88.9 245.2 L92.7 242.4 L96.6 239.7 L100.6 237.1 L104.7 234.6 L108.9 232.3 L113.1 230.1 L117.4 228.1 L121.8 226.2 L126.2 224.5 L133.2 222.0 L135.3 215.1 L128.7 217.1 L124.1 218.8 L119.5 220.6 L114.9 222.6 L110.4 224.7 L106.0 227.0 L101.7 229.4 L97.4 231.9 L93.3 234.6 L89.2 237.4 L85.2 240.4 L79.7 244.8 L74.3 240.4 L70.3 237.4 Z M91.1 264.4 L86.0 269.2 L83.1 272.2 L79.7 275.9 L76.4 272.2 L73.5 269.2 L68.4 264.4 L71.3 261.2 L74.6 257.7 L79.7 252.9 L84.9 257.7 L88.2 261.2 Z`, mat: 'frost', level: 1, fin: 'frost' },
      { d: `M11.4 7.6 L8.7 39.4 L7.5 56.5 L6.8 73.7 L6.2 94.3 L6.1 111.9 L6.4 126.4 L7.0 137.9 L7.6 146.3 L8.4 154.7 L9.9 168.7 L11.9 182.4 L13.2 190.5 L14.3 195.8 L15.9 203.7 L17.1 208.5 L19.7 218.1 L22.8 227.7 L26.0 237.1 L35.7 264.7 L39.3 274.5 L46.6 293.9 L112.9 293.9 L122.0 269.7 L132.7 239.5 L136.7 227.7 L140.4 215.7 L143.0 206.1 L144.1 201.1 L145.7 193.2 L146.7 187.9 L148.0 179.7 L149.9 165.9 L150.8 157.6 L151.6 149.2 L152.3 140.8 L152.8 132.2 L153.3 117.8 L153.4 109.0 L153.4 100.2 L152.9 79.6 L152.4 65.0 L151.9 56.5 L150.7 39.4 L148.1 7.6 L132.6 13.9 L124.3 17.1 L117.5 19.4 L107.1 22.5 L99.6 24.5 L95.3 25.5 L92.1 26.1 L89.1 26.5 L86.0 26.9 L82.9 27.1 L79.8 27.2 L76.6 27.1 L73.5 26.9 L67.4 26.1 L61.2 24.8 L53.9 22.9 L42.1 19.4 L36.9 17.7 L26.9 14.0 Z M13.4 10.8 L27.7 16.7 L36.2 19.8 L41.4 21.5 L54.8 25.4 L62.2 27.3 L68.4 28.5 L71.6 28.9 L74.7 29.2 L79.9 29.4 L83.0 29.4 L86.2 29.1 L89.4 28.7 L92.5 28.3 L98.7 27.0 L106.2 25.0 L118.2 21.5 L124.9 19.2 L133.5 16.0 L146.1 10.8 L148.8 42.4 L149.9 59.4 L150.3 68.0 L150.8 82.6 L151.2 103.1 L151.2 111.9 L151.0 120.6 L150.7 129.3 L150.5 135.0 L149.9 143.4 L149.2 151.8 L148.3 160.1 L147.4 168.4 L145.4 182.1 L143.5 192.8 L141.9 200.6 L140.8 205.6 L138.3 215.1 L134.6 227.0 L130.6 238.7 L119.9 268.9 L111.4 291.7 L48.1 291.7 L39.0 267.3 L26.4 231.7 L22.6 219.9 L19.9 210.3 L18.7 205.5 L17.5 200.6 L16.4 195.4 L15.0 187.4 L12.8 173.9 L11.1 160.1 L10.3 151.7 L9.6 143.4 L9.0 134.9 L8.7 129.2 L8.3 114.8 L8.3 106.0 L8.4 97.3 L8.6 85.5 L9.1 70.9 L9.5 62.3 L9.9 53.8 L10.9 39.6 Z`, mat: 'gold', level: 1, fin: 'foil' }
    ],
    face: { x: 0.001, y: 0.629, w: 0.476, h: 0.484, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/shield.544278c7.webp", "box": [-6.0, -5.96, 165.56, 306.23]}, tile: "img/designs/tile-shield.c18c112d.webp",
  },
  cat: {
    name: "Diamond Tower", group: 'Classic', sheet: 'white', base: 1.04,
    note: "A tall white panel crowned with a blue diamond, a framed panel in front.",
    body: `M120.3 60.2 L60.2 0.0 L0.0 60.2 L38.9 99.1 L38.9 300.0 L151.1 300.0 L151.1 81.4 L99.1 81.4 Z`,
    layers: [
      { d: `M0.0 60.2 L60.2 120.3 L120.3 60.2 L60.2 0.0 Z M12.3 60.2 L60.2 12.3 L108.0 60.2 L60.2 108.0 Z`, mat: 'blue', level: 1, fin: 'gloss' },
      { d: `M75.6 124.0 L74.9 124.1 L74.3 124.6 L73.9 125.2 L73.7 125.9 L73.7 298.1 L73.9 298.8 L74.2 299.3 L74.6 299.7 L75.1 299.9 L75.6 300.0 L149.1 300.0 L149.9 299.9 L150.4 299.6 L150.8 299.1 L151.0 298.6 L151.1 298.1 L151.1 125.9 L150.9 125.2 L150.6 124.7 L150.2 124.3 L149.7 124.1 L149.1 124.0 Z`, mat: 'blue', level: 1, fin: 'gloss' },
      { d: `M81.4 292.3 L143.3 292.3 L143.3 131.7 L81.4 131.7 Z`, mat: 'white', level: 2, fin: 'panel' }
    ],
    face: { x: 0.106, y: 0.249, w: 0.198, h: 0.252, level: 2, on: 2 },
    ink: 'printdark', art: {"src": "img/designs/cat.2ebbfd3e.webp", "box": [-6.0, -6.0, 157.12, 306.19]}, tile: "img/designs/tile-cat.c2070540.webp",
  },
  bkwing: {
    name: "Wing Frame", group: 'Classic', sheet: 'clear', base: 1.06,
    note: "A clear gull wing across a black A-frame, a white flag inside it.",
    body: `M0.4 72.3 L0.1 73.0 L0.0 73.8 L0.3 74.6 L0.9 75.2 L16.5 85.9 L23.7 91.1 L31.0 96.5 L42.1 105.2 L49.6 111.4 L56.0 117.1 L56.7 117.5 L57.5 117.6 L58.3 117.3 L65.6 113.5 L69.9 111.4 L74.0 109.6 L78.1 108.0 L82.3 106.4 L86.4 105.1 L90.6 103.9 L91.0 103.9 L91.7 104.1 L92.3 104.7 L92.5 105.0 L92.7 105.7 L92.6 106.6 L57.7 212.5 L57.6 213.7 L57.7 215.4 L58.0 216.6 L58.8 218.1 L59.6 219.1 L60.9 220.2 L61.9 220.8 L63.5 221.3 L64.5 221.5 L65.8 221.5 L67.4 221.1 L68.6 220.6 L70.0 219.7 L70.8 218.8 L71.8 217.4 L72.2 216.4 L110.3 101.2 L110.8 100.6 L111.5 100.3 L115.2 100.0 L115.7 100.1 L116.4 100.3 L117.0 100.9 L117.2 101.2 L117.4 102.0 L117.3 102.5 L89.5 269.7 L89.5 270.4 L89.8 271.1 L90.0 271.4 L90.7 271.9 L91.4 272.0 L189.8 272.0 L190.6 271.8 L191.3 271.5 L192.1 271.4 L192.9 271.7 L193.2 271.9 L193.7 272.5 L194.5 275.4 L194.5 276.3 L194.4 276.7 L194.0 277.4 L193.4 277.8 L192.5 278.0 L88.1 278.0 L87.4 278.1 L86.6 278.4 L85.8 279.0 L85.3 279.8 L85.1 280.8 L85.1 297.0 L85.3 298.1 L85.9 299.0 L86.8 299.7 L87.4 299.9 L88.1 300.0 L216.0 300.0 L217.1 299.8 L218.1 299.2 L218.8 298.2 L219.0 297.7 L219.1 297.0 L219.1 281.0 L219.0 280.2 L218.7 279.5 L218.3 279.0 L217.4 278.3 L216.3 278.0 L213.3 278.0 L212.5 277.9 L211.9 277.5 L211.6 277.2 L211.3 276.4 L170.1 118.5 L170.1 117.6 L170.4 116.8 L170.7 116.4 L175.2 112.2 L182.4 106.1 L187.7 101.8 L193.4 97.6 L199.5 93.3 L206.0 89.0 L212.8 84.8 L220.1 80.6 L227.6 76.5 L235.5 72.5 L243.6 68.8 L252.1 65.2 L260.8 61.9 L269.8 58.8 L276.0 56.8 L276.6 56.4 L276.8 56.1 L277.1 55.3 L277.1 54.9 L276.9 54.2 L276.4 53.6 L272.4 50.1 L268.9 47.3 L265.3 44.5 L261.6 41.8 L257.8 39.1 L249.8 34.1 L241.4 29.3 L232.7 24.9 L223.6 20.9 L214.3 17.3 L204.8 14.0 L199.8 12.5 L190.0 9.9 L184.9 8.7 L179.8 7.7 L174.7 6.8 L169.6 6.0 L164.4 5.3 L159.2 4.8 L154.0 4.3 L148.8 4.1 L140.6 3.8 L139.8 3.5 L138.7 2.3 L137.9 1.6 L136.3 0.7 L135.3 0.3 L134.3 0.1 L133.3 0.0 L132.2 0.0 L131.2 0.2 L130.2 0.5 L129.2 1.0 L128.4 1.5 L127.6 2.2 L126.8 3.0 L125.7 4.6 L125.0 5.0 L117.2 6.3 L113.1 7.2 L104.4 9.2 L95.6 11.7 L91.1 13.1 L82.0 16.3 L72.9 19.9 L63.8 24.0 L54.8 28.5 L50.3 31.0 L45.8 33.6 L41.5 36.3 L37.1 39.1 L32.9 42.0 L28.8 45.0 L24.7 48.2 L20.7 51.5 L16.8 54.9 L13.0 58.5 L9.3 62.2 L5.7 66.0 L2.4 69.9 Z`,
    layers: [
      { d: `M57.6 213.4 L57.6 214.7 L58.0 216.3 L58.3 217.3 L59.0 218.3 L60.1 219.6 L60.9 220.2 L61.9 220.8 L63.5 221.3 L64.5 221.5 L65.8 221.5 L67.4 221.1 L68.3 220.7 L69.4 220.1 L70.7 219.0 L71.3 218.2 L71.9 217.1 L131.9 35.4 L195.2 278.0 L87.6 278.0 L86.7 278.3 L85.9 279.0 L85.3 279.8 L85.1 280.6 L85.1 297.0 L85.2 298.0 L85.7 298.8 L86.3 299.4 L87.1 299.8 L88.1 300.0 L216.0 300.0 L216.9 299.9 L217.7 299.5 L218.3 299.0 L218.8 298.3 L219.0 297.7 L219.1 297.0 L219.1 281.0 L219.0 280.2 L218.7 279.5 L218.3 279.0 L217.7 278.5 L217.0 278.2 L216.1 278.0 L211.7 278.0 L140.8 6.0 L140.5 5.0 L140.0 4.0 L139.5 3.2 L138.9 2.5 L137.9 1.6 L137.0 1.0 L136.1 0.6 L134.3 0.1 L133.0 0.0 L131.2 0.2 L129.9 0.6 L128.4 1.5 L127.4 2.4 L126.2 3.8 L125.7 4.9 L125.4 5.9 L125.1 6.9 L125.1 8.2 L58.0 211.6 Z`, mat: 'black', level: 1, fin: 'gloss' },
      { d: `M89.1 272.0 L190.5 272.0 L143.6 92.0 L119.1 92.0 Z`, mat: 'white', level: 1, fin: 'panel' }
    ],
    face: { x: 0.002, y: 0.23, w: 0.219, h: 0.209, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/bkwing.90d80162.webp", "box": [-5.98, -6.0, 283.24, 306.19]}, tile: "img/designs/tile-bkwing.5e16590a.webp",
  },
  crowncrest: {
    name: "Crown Crest", group: 'Classic', sheet: 'white', base: 1.08,
    note: "A white crest under a gold crown, framed in navy.",
    body: `M118.8 7.3 L118.6 6.2 L118.2 5.0 L117.7 4.0 L117.0 2.9 L116.0 2.0 L115.2 1.4 L114.3 0.8 L113.3 0.4 L112.1 0.1 L111.0 0.0 L109.7 0.1 L108.7 0.3 L107.7 0.6 L106.5 1.2 L105.4 2.0 L104.7 2.7 L103.8 4.0 L103.0 5.7 L102.7 7.5 L102.8 9.1 L103.1 10.6 L103.9 12.3 L104.9 13.6 L106.1 14.7 L78.5 54.4 L52.2 28.0 L53.3 27.1 L54.3 25.9 L55.0 24.4 L55.3 23.1 L55.3 21.5 L55.1 20.1 L54.4 18.6 L53.6 17.5 L52.6 16.6 L51.6 15.9 L50.6 15.5 L49.2 15.2 L48.1 15.1 L46.9 15.2 L45.6 15.6 L44.6 16.2 L43.7 16.8 L42.9 17.7 L42.3 18.4 L41.8 19.5 L41.5 20.3 L41.3 21.5 L41.3 22.6 L41.5 23.7 L41.8 24.8 L42.2 25.7 L42.9 26.6 L43.7 27.4 L44.4 28.0 L45.4 28.6 L46.5 29.0 L47.6 29.2 L41.2 72.5 L6.0 72.5 L4.9 72.6 L3.7 72.9 L2.7 73.5 L1.8 74.3 L1.0 75.2 L0.5 76.2 L0.1 77.3 L0.0 78.5 L0.0 213.1 L0.7 220.4 L1.0 221.5 L3.0 228.0 L3.3 228.9 L7.0 236.2 L11.8 243.4 L17.4 250.1 L24.6 257.3 L32.2 263.9 L40.1 270.0 L49.1 276.1 L58.1 281.6 L67.3 286.7 L76.3 291.2 L85.4 295.3 L94.3 298.8 L97.6 300.0 L123.5 300.0 L127.3 298.7 L139.6 294.0 L155.6 287.3 L174.5 278.5 L194.6 268.4 L195.7 267.6 L196.7 266.7 L197.4 265.5 L220.9 214.6 L221.3 213.4 L221.5 212.1 L221.5 78.5 L221.4 77.3 L221.0 76.2 L220.5 75.2 L219.7 74.3 L218.8 73.5 L217.7 72.9 L216.6 72.6 L215.4 72.5 L180.3 72.5 L173.9 29.2 L175.2 28.9 L176.5 28.4 L177.6 27.6 L178.6 26.6 L179.4 25.5 L179.9 24.2 L180.2 22.8 L180.2 21.5 L180.0 20.3 L179.7 19.5 L179.3 18.6 L178.6 17.7 L178.0 17.0 L177.1 16.3 L176.1 15.7 L175.0 15.3 L173.8 15.1 L172.9 15.1 L172.0 15.2 L171.1 15.4 L170.2 15.7 L169.2 16.3 L168.5 16.8 L167.7 17.7 L166.8 19.0 L166.3 20.3 L166.1 21.7 L166.2 23.3 L166.6 24.8 L167.3 26.1 L168.2 27.1 L169.3 28.0 L143.0 54.4 L115.3 14.7 L116.2 13.9 L117.0 13.2 L117.6 12.3 L118.1 11.4 L118.4 10.4 L118.7 9.4 L118.8 8.3 Z`,
    layers: [
      { d: `M6.0 212.9 L6.8 220.0 L8.8 226.4 L11.9 232.7 L16.6 239.6 L22.1 246.3 L28.6 252.8 L35.9 259.1 L43.7 265.1 L52.2 270.9 L61.0 276.3 L70.0 281.3 L79.1 285.9 L88.0 289.8 L96.4 293.2 L98.6 294.0 L122.4 294.0 L125.2 293.0 L137.4 288.4 L153.1 281.8 L171.9 273.1 L191.6 263.1 L191.9 262.9 L192.0 262.7 L215.4 212.1 L215.4 78.6 L6.1 78.6 Z M208.4 210.5 L186.5 257.8 L168.7 266.8 L150.2 275.3 L134.8 281.8 L122.7 286.4 L121.3 286.9 L99.8 286.9 L90.7 283.3 L82.1 279.5 L73.3 275.1 L64.6 270.3 L56.1 265.0 L47.9 259.4 L40.3 253.6 L33.4 247.6 L27.3 241.4 L22.1 235.3 L18.1 229.3 L15.3 223.6 L13.7 218.3 L13.1 212.7 L13.1 85.6 L208.4 85.6 Z`, mat: 'navy', level: 1, fin: 'gloss' },
      { d: `M173.9 29.2 L175.2 28.9 L176.5 28.4 L177.6 27.6 L178.6 26.6 L179.4 25.5 L179.9 24.2 L180.2 22.8 L180.2 21.5 L179.9 20.1 L179.4 18.8 L178.6 17.7 L177.6 16.7 L176.5 15.9 L175.2 15.4 L173.8 15.1 L172.5 15.1 L171.6 15.3 L170.5 15.6 L169.4 16.2 L168.5 16.8 L167.9 17.5 L167.2 18.4 L166.6 19.5 L166.3 20.5 L166.1 21.7 L166.1 22.6 L166.3 23.7 L166.6 24.8 L167.2 25.9 L167.7 26.6 L168.5 27.4 L169.3 28.0 L143.0 54.4 L115.3 14.7 L116.4 13.7 L117.4 12.5 L118.2 11.1 L118.6 9.6 L118.8 8.3 L118.7 6.7 L118.3 5.2 L117.6 3.8 L117.0 2.9 L116.0 2.0 L115.0 1.2 L113.8 0.6 L112.6 0.2 L111.3 0.0 L109.9 0.0 L108.7 0.3 L107.7 0.6 L106.7 1.1 L105.6 1.8 L104.9 2.5 L104.2 3.4 L103.5 4.5 L103.1 5.5 L102.8 6.7 L102.7 7.8 L102.8 9.1 L103.0 10.1 L103.3 11.1 L103.8 12.1 L104.5 13.2 L105.2 13.9 L106.1 14.7 L78.5 54.4 L52.2 28.0 L53.3 27.1 L54.2 26.1 L54.8 24.8 L55.3 23.3 L55.4 21.7 L55.1 20.3 L54.6 19.0 L53.8 17.7 L53.1 17.0 L52.2 16.3 L51.2 15.7 L50.1 15.3 L49.2 15.2 L48.1 15.1 L46.9 15.2 L45.8 15.6 L44.8 16.0 L44.0 16.6 L43.3 17.2 L42.7 17.9 L42.2 18.6 L41.8 19.5 L41.5 20.3 L41.3 21.5 L41.3 22.8 L41.6 24.2 L42.1 25.5 L42.9 26.6 L43.9 27.6 L45.0 28.4 L46.3 28.9 L47.6 29.2 L40.3 78.5 L181.2 78.5 Z`, mat: 'gold', level: 1, fin: 'foil' }
    ],
    face: { x: -0.054, y: 0.449, w: 0.495, h: 0.472, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/crowncrest.7bbfd37b.webp", "box": [-6.0, -6.0, 227.67, 306.19]}, tile: "img/designs/tile-crowncrest.a0f4ab5a.webp",
  },
  cup: {
    name: "Trophy Cup", group: 'Classic', sheet: 'gold', base: 1.10,
    note: "A gold cup with handles, a white plaque on its bowl.",
    body: `M49.2 0.0 L48.4 0.2 L47.7 0.6 L47.3 1.3 L47.1 1.7 L46.6 18.1 L46.4 19.1 L45.9 19.8 L45.2 20.2 L44.3 20.4 L41.2 19.7 L38.8 19.4 L35.3 19.3 L32.8 19.5 L29.4 20.2 L27.0 20.9 L24.8 21.8 L22.5 22.9 L20.4 24.1 L18.2 25.6 L15.2 28.1 L13.3 30.0 L11.5 32.0 L9.8 34.2 L7.5 37.7 L6.1 40.3 L4.3 44.2 L3.3 46.9 L2.3 49.8 L1.6 52.7 L1.0 55.7 L0.5 58.7 L0.2 61.8 L0.0 64.9 L0.0 67.9 L0.2 71.0 L0.5 74.1 L0.9 77.1 L1.6 80.1 L2.3 83.0 L3.2 85.9 L4.3 88.6 L6.1 92.6 L8.3 96.4 L10.7 99.8 L13.3 102.9 L16.2 105.7 L19.3 108.0 L22.5 110.0 L25.9 111.6 L29.3 112.7 L32.8 113.3 L36.4 113.6 L40.0 113.3 L43.5 112.7 L47.0 111.5 L50.3 110.0 L53.5 108.1 L54.4 107.7 L55.2 107.6 L55.6 107.7 L56.3 108.2 L56.8 108.8 L56.9 109.3 L57.4 111.0 L60.7 121.2 L64.4 130.4 L68.4 139.1 L72.9 147.1 L77.5 154.2 L82.6 160.9 L87.9 166.7 L93.4 172.0 L99.1 176.6 L104.9 180.5 L111.0 183.9 L117.5 186.8 L123.7 189.0 L127.0 190.0 L127.7 190.5 L127.9 190.9 L128.2 191.7 L122.4 246.5 L122.1 247.5 L121.5 248.2 L121.1 248.4 L120.1 248.6 L75.3 248.6 L74.1 248.8 L73.1 249.3 L72.5 250.0 L72.1 250.9 L57.2 295.7 L57.0 296.6 L57.0 297.2 L57.1 297.8 L57.5 298.5 L57.8 299.0 L58.6 299.6 L59.4 299.9 L60.3 300.0 L226.9 300.0 L227.8 299.9 L228.5 299.6 L229.4 298.8 L230.0 297.9 L230.2 296.8 L230.0 295.7 L215.1 250.9 L214.6 250.0 L214.0 249.3 L213.1 248.8 L211.9 248.6 L167.0 248.6 L166.1 248.4 L165.3 247.9 L165.1 247.5 L164.8 246.5 L159.0 191.7 L159.2 190.9 L159.8 190.2 L160.1 190.0 L163.4 189.0 L169.7 186.8 L176.1 183.9 L182.2 180.5 L188.0 176.6 L193.7 172.0 L199.3 166.7 L204.5 160.9 L209.6 154.2 L214.2 147.1 L218.7 139.1 L222.8 130.4 L226.4 121.2 L229.7 111.0 L230.2 109.3 L230.4 108.8 L230.9 108.2 L231.2 107.9 L232.0 107.6 L232.4 107.6 L233.2 107.8 L236.7 110.0 L239.0 111.1 L242.4 112.3 L244.8 113.0 L247.2 113.3 L250.7 113.6 L253.1 113.5 L255.5 113.2 L258.9 112.4 L261.3 111.5 L264.6 110.0 L266.9 108.7 L269.9 106.5 L272.0 104.7 L274.7 101.9 L276.5 99.8 L278.1 97.5 L280.3 93.9 L282.3 90.0 L283.9 85.9 L284.8 83.0 L285.9 78.6 L286.7 74.1 L287.1 69.5 L287.1 64.9 L286.8 60.3 L286.2 55.8 L285.6 52.7 L284.4 48.4 L282.9 44.2 L281.0 40.3 L279.6 37.7 L278.1 35.3 L276.5 33.1 L274.7 31.0 L272.0 28.1 L270.0 26.4 L267.9 24.8 L265.7 23.5 L263.5 22.3 L261.2 21.3 L258.9 20.5 L256.6 19.9 L254.2 19.5 L251.9 19.3 L248.4 19.4 L245.9 19.7 L242.8 20.4 L241.9 20.2 L241.2 19.8 L240.7 19.1 L240.5 18.1 L240.0 1.7 L239.7 0.9 L239.4 0.6 L238.7 0.2 L238.3 0.0 Z M235.3 92.1 L234.8 91.1 L234.8 90.1 L235.2 88.2 L237.2 75.8 L238.8 62.3 L239.9 48.1 L240.3 36.9 L240.5 36.1 L241.0 35.4 L241.4 35.1 L242.9 34.2 L245.4 33.1 L247.5 32.5 L249.5 32.2 L251.9 32.2 L254.0 32.5 L256.0 33.1 L258.6 34.2 L261.2 35.9 L263.2 37.6 L265.7 40.2 L267.5 42.6 L269.6 46.1 L270.9 49.1 L272.1 52.3 L273.1 55.7 L273.7 59.2 L274.1 62.8 L274.3 66.5 L274.1 70.1 L273.5 74.8 L272.8 78.3 L271.7 81.7 L270.5 84.8 L269.1 87.7 L266.9 91.1 L265.1 93.4 L262.6 95.9 L260.5 97.5 L257.9 99.0 L255.2 100.0 L252.6 100.6 L250.0 100.7 L247.4 100.4 L244.8 99.5 L242.1 98.2 L239.6 96.5 L237.6 94.7 Z M45.8 35.1 L46.2 35.4 L46.6 36.1 L46.8 36.9 L47.2 48.1 L48.3 62.4 L49.9 75.7 L52.0 88.2 L52.3 90.1 L52.3 91.1 L52.2 91.6 L51.4 92.6 L50.2 94.0 L48.9 95.4 L46.3 97.4 L43.7 99.0 L41.6 99.8 L39.0 100.5 L36.4 100.7 L33.8 100.5 L31.3 99.8 L29.2 99.0 L26.6 97.5 L24.6 95.9 L22.1 93.4 L20.3 91.2 L18.6 88.5 L17.1 85.7 L15.8 82.7 L14.7 79.4 L13.8 76.0 L13.2 72.4 L12.9 68.8 L12.9 65.2 L13.1 61.5 L13.6 58.0 L14.4 54.5 L15.4 51.2 L16.6 48.1 L18.6 44.3 L20.2 41.8 L22.1 39.4 L24.0 37.5 L26.5 35.5 L28.6 34.2 L31.3 33.0 L33.8 32.4 L36.4 32.1 L39.0 32.4 L41.0 32.8 L43.6 33.8 Z`,
    layers: [
      { d: `M90.0 27.9 L87.9 28.1 L85.9 28.7 L84.0 29.7 L83.2 30.3 L81.7 31.8 L80.6 33.5 L79.7 35.5 L79.3 37.5 L79.3 124.3 L79.3 125.3 L79.7 127.4 L80.6 129.3 L81.7 131.1 L83.2 132.6 L84.9 133.7 L86.9 134.5 L88.9 134.9 L90.0 135.0 L197.1 135.0 L199.2 134.8 L201.2 134.2 L203.1 133.2 L204.7 131.9 L205.4 131.1 L206.6 129.3 L207.0 128.4 L207.7 126.4 L207.9 124.3 L207.9 38.6 L207.7 36.5 L207.4 35.5 L206.6 33.5 L205.4 31.8 L203.9 30.3 L203.1 29.7 L201.2 28.7 L199.2 28.1 L197.1 27.9 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M57.4 21.4 L57.3 17.1 L57.5 10.7 L229.6 10.7 L229.8 17.1 L229.8 21.4 L234.1 21.4 L234.1 17.0 L233.8 6.4 L53.4 6.4 L53.1 17.0 L53.1 21.4 Z`, mat: 'black', level: 1, fin: 'gloss' }
    ],
    face: { x: 0.0, y: 0.729, w: 0.457, h: 0.291, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/cup.eba719c5.webp", "box": [-5.98, -6.0, 293.32, 306.19]}, tile: "img/designs/tile-cup.13dacede.webp",
  },
  chevron: {
    name: "Chevron Shield", group: 'Classic', sheet: 'navy', base: 1.06,
    note: "A navy shield: a white field and gold chevrons.",
    body: `M4.1 0.1 L3.1 0.4 L2.3 0.9 L1.5 1.5 L0.9 2.3 L0.4 3.1 L0.1 4.1 L0.0 5.1 L0.0 143.0 L0.5 156.5 L2.1 169.4 L4.5 181.7 L7.7 193.0 L11.7 204.1 L16.5 214.6 L21.8 224.6 L27.7 234.0 L34.0 242.8 L40.7 251.2 L47.8 258.9 L55.0 266.2 L62.6 273.1 L70.1 279.3 L77.6 285.0 L84.8 290.1 L92.1 294.8 L100.8 300.0 L123.6 300.0 L132.3 294.9 L139.5 290.2 L147.1 284.9 L154.6 279.1 L162.1 272.9 L169.5 266.2 L176.7 258.9 L183.6 251.4 L190.3 243.1 L196.6 234.3 L202.7 224.6 L208.0 214.6 L212.6 204.4 L216.7 193.3 L220.0 181.7 L222.4 169.4 L224.0 156.1 L224.5 142.8 L224.5 5.1 L224.4 4.1 L224.1 3.1 L223.6 2.3 L223.0 1.5 L222.2 0.9 L221.3 0.4 L220.4 0.1 L219.4 0.0 L5.1 0.0 Z`,
    layers: [
      { d: `M10.2 142.7 L10.7 155.5 L12.1 167.6 L14.4 179.1 L17.5 190.0 L21.3 200.4 L25.7 210.3 L30.7 219.6 L36.2 228.4 L42.2 236.8 L48.6 244.6 L55.2 252.0 L62.1 258.9 L69.2 265.3 L76.4 271.2 L83.5 276.7 L90.6 281.7 L97.6 286.2 L103.6 289.8 L120.9 289.8 L126.9 286.2 L133.9 281.7 L141.0 276.7 L148.1 271.2 L155.3 265.3 L162.4 258.9 L169.3 252.0 L175.9 244.6 L182.3 236.8 L188.3 228.4 L193.8 219.6 L198.8 210.3 L203.2 200.4 L207.0 190.0 L210.1 179.1 L212.4 167.6 L213.8 155.5 L214.3 142.7 L214.3 10.2 L10.2 10.2 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M111.8 247.9 L112.7 247.9 L113.7 247.8 L114.6 247.6 L115.5 247.2 L116.3 246.7 L198.0 189.5 L198.7 188.9 L199.3 188.3 L199.9 187.5 L200.4 186.7 L200.7 185.8 L200.9 184.9 L201.0 184.0 L201.0 183.1 L200.9 182.1 L200.6 181.2 L200.2 180.4 L199.7 179.6 L199.1 178.8 L198.5 178.2 L197.7 177.6 L196.9 177.2 L196.0 176.9 L195.1 176.6 L194.2 176.5 L193.3 176.6 L192.3 176.7 L191.4 177.0 L190.6 177.3 L189.8 177.8 L112.2 232.1 L34.7 177.8 L33.9 177.3 L33.1 177.0 L32.2 176.7 L31.2 176.6 L30.3 176.5 L29.4 176.6 L28.5 176.9 L27.6 177.2 L26.8 177.6 L26.0 178.2 L25.3 178.8 L24.8 179.6 L24.3 180.4 L23.9 181.2 L23.6 182.1 L23.5 183.1 L23.5 184.0 L23.6 184.9 L23.8 185.8 L24.1 186.7 L24.6 187.5 L25.1 188.3 L25.8 188.9 L26.5 189.5 L108.1 246.7 L109.0 247.2 L109.9 247.6 L110.8 247.8 Z M112.2 273.5 L113.8 273.3 L115.2 272.7 L115.8 272.3 L183.2 223.3 L184.4 222.2 L184.8 221.6 L185.5 220.1 L185.6 219.3 L185.7 218.5 L185.5 216.9 L185.3 216.2 L184.5 214.8 L183.4 213.6 L182.8 213.1 L181.3 212.5 L179.7 212.2 L178.9 212.3 L178.2 212.4 L176.7 213.0 L112.2 259.8 L48.5 213.4 L47.1 212.7 L46.3 212.4 L44.7 212.2 L43.2 212.5 L42.4 212.8 L41.0 213.6 L40.5 214.2 L39.5 215.4 L39.2 216.2 L38.9 216.9 L38.8 218.5 L38.9 219.3 L39.3 220.9 L39.7 221.6 L40.7 222.8 L108.6 272.3 L109.3 272.7 L110.7 273.3 Z`, mat: 'gold', level: 2, fin: 'foil' }
    ],
    face: { x: -0.108, y: 0.69, w: 0.501, h: 0.478, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/chevron.b49edf1c.webp", "box": [-6.0, -6.0, 230.72, 306.19]}, tile: "img/designs/tile-chevron.6bcd986c.webp",
  },
  hexagon: {
    name: "Hexagon", group: 'Classic', sheet: 'black', base: 1.04,
    note: "A black hexagon: a gold rule and a white hexagon inside.",
    body: `M346.4 150.0 L259.8 0.0 L86.6 0.0 L0.0 150.0 L86.6 300.0 L259.8 300.0 Z`,
    layers: [
      { d: `M91.9 9.2 L10.7 150.0 L91.9 290.8 L254.5 290.8 L335.7 150.0 L254.5 9.2 Z M94.6 286.1 L16.0 150.0 L94.6 13.9 L251.8 13.9 L330.4 150.0 L251.8 286.1 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M247.8 20.8 L98.6 20.8 L24.0 150.0 L98.6 279.2 L247.8 279.2 L322.4 150.0 Z`, mat: 'white', level: 1, fin: 'panel' }
    ],
    face: { x: 0.0, y: 0.5, w: 0.739, h: 0.565, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/hexagon.43fd75a6.webp", "box": [-6.0, -6.0, 352.59, 306.19]}, tile: "img/designs/tile-hexagon.f7ee2775.webp",
  },
  diamond: {
    name: "Diamond", group: 'Classic', sheet: 'clear', base: 1.04,
    note: "A clear diamond on its point: sky blue and white diamonds laid in it.",
    body: `M0.2 152.8 L0.0 154.0 L0.2 155.1 L0.5 155.7 L90.7 300.0 L116.8 300.0 L207.0 155.7 L207.4 154.6 L207.4 154.0 L207.4 153.4 L206.9 152.3 L106.3 1.4 L105.9 0.9 L105.5 0.5 L104.9 0.2 L104.3 0.1 L103.7 0.0 L103.1 0.1 L102.5 0.2 L102.0 0.5 L101.5 0.9 L101.1 1.4 Z`,
    layers: [
      { d: `M97.0 288.5 L110.4 288.5 L194.4 154.2 L103.7 18.2 L13.1 154.2 Z`, mat: 'sky', level: 1, fin: 'gloss' },
      { d: `M102.8 278.1 L104.6 278.1 L182.0 154.3 L103.7 37.0 L25.5 154.3 Z`, mat: 'white', level: 2, fin: 'panel' }
    ],
    face: { x: -0.0, y: 0.482, w: 0.318, h: 0.304, level: 2, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/diamond.6688d34e.webp", "box": [-6.0, -6.0, 213.61, 306.19]}, tile: "img/designs/tile-diamond.25860b7f.webp",
  },
  risingsun: {
    name: "Rising Sun", group: 'Classic', sheet: 'white', base: 1.06,
    note: "A white arch with a gold sun rising from its foot.",
    body: `M199.9 96.7 L199.5 90.2 L198.7 83.7 L198.1 80.5 L196.6 74.1 L194.7 67.9 L192.4 61.7 L189.7 55.8 L186.6 50.0 L183.1 44.4 L181.3 41.8 L177.3 36.6 L175.2 34.1 L170.7 29.3 L165.9 24.8 L160.9 20.7 L155.6 16.9 L150.0 13.4 L144.2 10.3 L138.3 7.6 L132.1 5.3 L129.0 4.3 L122.7 2.6 L116.3 1.3 L109.8 0.5 L103.3 0.1 L96.7 0.1 L90.2 0.5 L86.9 0.9 L80.5 1.9 L77.3 2.6 L71.0 4.3 L64.8 6.4 L58.7 8.9 L52.9 11.8 L47.2 15.1 L41.8 18.7 L39.1 20.7 L34.1 24.8 L29.3 29.3 L27.0 31.6 L22.7 36.6 L18.7 41.8 L15.1 47.2 L13.4 50.0 L10.3 55.8 L7.6 61.7 L6.4 64.8 L5.3 67.9 L3.4 74.1 L1.9 80.5 L0.9 86.9 L0.5 90.2 L0.1 96.7 L0.0 100.0 L0.0 300.0 L200.0 300.0 Z`,
    layers: [
      { d: `M103.9 244.1 L107.3 196.0 L92.7 196.0 L96.1 244.1 L100.0 244.0 Z M84.6 246.2 L70.2 196.0 L53.7 196.0 L77.2 248.8 L80.3 247.6 Z M122.8 248.8 L146.3 196.0 L129.8 196.0 L115.4 246.2 L119.7 247.6 Z M24.4 196.0 L11.0 196.0 L11.0 207.8 L61.1 259.7 L64.4 256.7 L67.1 254.7 Z M189.0 207.8 L189.0 196.0 L175.6 196.0 L132.9 254.7 L135.6 256.7 L138.9 259.7 Z M11.0 240.0 L11.0 256.6 L49.7 275.5 L51.5 272.0 L53.6 268.7 Z M189.0 256.6 L189.0 240.0 L146.4 268.7 L148.5 272.0 L150.3 275.5 Z M45.1 289.0 L45.7 286.5 L11.0 277.8 L11.0 289.0 Z M154.3 286.5 L154.9 289.0 L189.0 289.0 L189.0 277.8 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M152.2 286.0 L151.1 282.6 L149.2 277.7 L146.8 273.0 L144.9 270.0 L141.7 265.7 L138.2 261.8 L134.3 258.3 L131.5 256.1 L127.0 253.2 L123.9 251.6 L120.7 250.1 L115.7 248.3 L112.3 247.4 L107.0 246.5 L103.5 246.1 L98.2 246.0 L93.0 246.5 L89.5 247.0 L84.3 248.3 L81.0 249.5 L76.1 251.6 L73.0 253.2 L68.5 256.1 L65.7 258.3 L61.8 261.8 L59.4 264.4 L57.2 267.1 L54.1 271.5 L51.6 276.1 L50.1 279.3 L48.3 284.3 L47.1 289.0 L152.9 289.0 Z`, mat: 'gold', level: 1, fin: 'glitter' },
      { d: `M193.5 90.8 L192.7 84.7 L191.5 78.7 L190.0 72.7 L188.0 66.9 L186.8 64.0 L184.3 58.4 L181.4 53.0 L178.2 47.8 L174.6 42.8 L170.7 38.0 L166.5 33.5 L164.3 31.4 L159.6 27.3 L154.8 23.6 L149.6 20.2 L144.3 17.1 L141.6 15.7 L136.0 13.2 L130.2 11.0 L124.3 9.2 L118.3 7.8 L112.3 6.8 L106.1 6.2 L103.1 6.1 L96.9 6.1 L90.8 6.5 L84.7 7.3 L78.7 8.5 L72.7 10.0 L66.9 12.0 L61.2 14.4 L55.7 17.1 L53.0 18.6 L47.8 21.8 L45.2 23.6 L40.4 27.3 L35.7 31.4 L31.4 35.7 L27.3 40.4 L25.4 42.8 L21.8 47.8 L18.6 53.0 L15.7 58.4 L14.4 61.2 L13.2 64.0 L11.0 69.8 L9.2 75.7 L7.8 81.7 L7.3 84.7 L6.5 90.8 L6.1 96.9 L6.0 100.0 L6.0 294.0 L194.0 294.0 L194.0 100.0 L193.9 96.9 Z M191.0 291.0 L9.0 291.0 L9.0 100.1 L9.0 97.0 L9.4 91.1 L9.8 88.1 L10.7 82.2 L12.1 76.4 L13.8 70.7 L15.9 65.2 L17.1 62.4 L18.4 59.8 L21.2 54.5 L24.3 49.4 L27.8 44.6 L29.7 42.3 L33.6 37.8 L37.8 33.6 L42.3 29.7 L47.0 26.0 L51.9 22.7 L57.1 19.7 L59.8 18.4 L62.4 17.1 L67.9 14.8 L73.6 12.9 L76.4 12.1 L79.3 11.4 L85.2 10.2 L88.1 9.8 L94.0 9.2 L97.0 9.0 L103.0 9.0 L106.0 9.2 L111.9 9.8 L114.8 10.2 L120.7 11.4 L126.4 12.9 L129.3 13.8 L134.8 15.9 L137.6 17.1 L140.2 18.4 L145.5 21.2 L148.1 22.7 L153.0 26.0 L155.4 27.8 L160.0 31.6 L162.2 33.6 L166.4 37.8 L168.4 40.0 L172.2 44.6 L175.7 49.4 L177.3 51.9 L178.8 54.5 L181.6 59.8 L184.1 65.2 L185.2 67.9 L187.1 73.6 L188.6 79.3 L189.8 85.2 L190.2 88.1 L190.6 91.1 L191.0 97.0 Z`, mat: 'gold', level: 1, fin: 'foil' }
    ],
    face: { x: -0.001, y: 0.593, w: 0.513, h: 0.436, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/risingsun.fdd5b689.webp", "box": [-6.0, -5.95, 206.11, 306.01]}, tile: "img/designs/tile-risingsun.123e1d3f.webp",
  },
  round: {
    name: "Round", group: 'Rounds', sheet: 'clear', base: 1.02,
    note: "A clear disc: a blue band sweeping round its edge and a bold blue check.",
    body: `M309.2 149.6 L308.9 144.5 L308.5 139.5 L308.0 134.5 L307.2 129.4 L306.3 124.5 L305.2 119.5 L304.0 114.6 L302.6 109.7 L301.1 104.9 L299.4 100.2 L297.5 95.5 L295.5 90.8 L293.3 86.2 L291.0 81.7 L288.6 77.3 L286.0 73.0 L283.2 68.7 L280.3 64.6 L277.3 60.5 L274.2 56.5 L270.9 52.7 L267.5 48.9 L264.0 45.3 L260.3 41.8 L256.6 38.4 L252.7 35.1 L248.8 32.0 L244.7 28.9 L240.6 26.1 L236.3 23.3 L232.0 20.7 L227.5 18.3 L223.0 15.9 L218.5 13.8 L213.8 11.8 L209.1 9.9 L204.3 8.2 L199.5 6.7 L194.7 5.3 L189.8 4.0 L184.8 3.0 L179.8 2.1 L174.8 1.3 L169.8 0.7 L164.8 0.3 L159.7 0.1 L154.6 0.0 L149.6 0.1 L144.5 0.3 L139.5 0.7 L134.5 1.3 L129.4 2.1 L124.5 3.0 L119.5 4.0 L114.6 5.3 L109.7 6.7 L104.9 8.2 L100.2 9.9 L95.5 11.8 L90.8 13.8 L86.2 15.9 L81.7 18.3 L77.3 20.7 L73.0 23.3 L68.7 26.1 L64.6 28.9 L60.5 32.0 L56.5 35.1 L52.7 38.4 L48.9 41.8 L45.3 45.3 L41.8 48.9 L38.4 52.7 L35.1 56.5 L32.0 60.5 L28.9 64.6 L26.1 68.7 L23.3 73.0 L20.7 77.3 L18.3 81.7 L15.9 86.2 L13.8 90.8 L11.8 95.5 L9.9 100.2 L8.2 104.9 L6.7 109.7 L5.3 114.6 L4.0 119.5 L3.0 124.5 L2.1 129.4 L1.3 134.5 L0.7 139.5 L0.3 144.5 L0.1 149.6 L0.0 154.6 L0.1 159.7 L0.3 164.8 L0.7 169.8 L1.3 174.8 L2.1 179.8 L3.0 184.8 L4.0 189.8 L5.3 194.7 L6.7 199.5 L8.2 204.3 L9.9 209.1 L11.8 213.8 L13.8 218.5 L15.9 223.0 L18.3 227.5 L20.7 232.0 L23.3 236.3 L26.1 240.6 L28.9 244.7 L32.0 248.8 L35.1 252.7 L38.4 256.6 L41.8 260.3 L45.3 264.0 L48.9 267.5 L52.7 270.9 L56.5 274.2 L60.5 277.3 L64.6 280.3 L68.7 283.2 L73.0 286.0 L77.3 288.6 L81.7 291.0 L86.2 293.3 L90.8 295.5 L95.5 297.5 L101.9 300.0 L207.3 300.0 L213.8 297.5 L218.5 295.5 L223.0 293.3 L227.5 291.0 L232.0 288.6 L236.3 286.0 L240.6 283.2 L244.7 280.3 L248.8 277.3 L252.7 274.2 L256.6 270.9 L260.3 267.5 L264.0 264.0 L267.5 260.3 L270.9 256.6 L274.2 252.7 L277.3 248.8 L280.3 244.7 L283.2 240.6 L286.0 236.3 L288.6 232.0 L291.0 227.5 L293.3 223.0 L295.5 218.5 L297.5 213.8 L299.4 209.1 L301.1 204.3 L302.6 199.5 L304.0 194.7 L305.2 189.8 L306.3 184.8 L307.2 179.8 L308.0 174.8 L308.5 169.8 L308.9 164.8 L309.2 159.7 L309.3 154.6 Z`,
    layers: [
      { d: `M40.6 207.8 L39.0 204.0 L37.4 200.2 L36.0 196.4 L34.7 192.5 L33.5 188.5 L32.5 184.5 L31.6 180.5 L30.8 176.5 L30.1 172.4 L29.6 168.3 L29.2 164.2 L29.0 160.1 L28.9 156.0 L28.9 151.9 L29.1 147.8 L29.3 143.7 L29.8 139.6 L30.3 135.5 L31.0 131.4 L31.8 127.4 L32.8 123.4 L33.9 119.4 L35.1 115.5 L36.5 111.6 L37.9 107.8 L39.5 104.0 L41.2 100.2 L43.1 96.6 L45.0 92.9 L47.1 89.4 L49.3 85.9 L51.6 82.5 L54.0 79.2 L56.6 75.9 L59.2 72.7 L61.9 69.7 L64.7 66.7 L67.7 63.8 L70.7 61.0 L73.8 58.3 L77.0 55.7 L80.3 53.2 L83.6 50.8 L87.1 48.6 L90.6 46.4 L94.1 44.4 L97.8 42.5 L101.5 40.6 L105.2 39.0 L109.1 37.4 L112.9 36.0 L116.8 34.7 L120.8 33.5 L124.7 32.5 L128.8 31.6 L132.8 30.8 L136.9 30.1 L140.9 29.6 L145.0 29.2 L149.2 29.0 L153.3 28.9 L157.4 28.9 L161.5 29.1 L165.6 29.3 L169.7 29.8 L173.8 30.3 L177.8 31.0 L181.9 31.8 L185.9 32.8 L189.8 33.9 L193.8 35.1 L197.7 36.5 L201.5 37.9 L205.3 39.5 L209.0 41.2 L212.7 43.1 L216.3 45.0 L219.9 47.1 L223.4 49.3 L226.8 51.6 L230.1 54.0 L233.4 56.6 L236.5 59.2 L239.6 61.9 L242.6 64.7 L245.5 67.7 L248.3 70.7 L251.0 73.8 L253.6 77.0 L256.1 80.3 L258.4 83.6 L260.7 87.1 L262.9 90.6 L264.9 94.1 L266.8 97.8 L268.6 101.5 L283.6 94.5 L281.5 90.3 L279.4 86.2 L277.1 82.2 L274.6 78.2 L272.1 74.3 L269.4 70.5 L266.6 66.8 L263.6 63.2 L260.6 59.7 L257.4 56.3 L254.1 52.9 L250.8 49.7 L247.3 46.7 L243.7 43.7 L240.0 40.8 L236.2 38.1 L232.4 35.5 L228.4 33.0 L224.4 30.7 L220.3 28.4 L216.2 26.4 L211.9 24.4 L207.6 22.6 L203.3 21.0 L198.9 19.4 L194.4 18.1 L190.0 16.8 L185.4 15.7 L180.9 14.8 L176.3 14.0 L171.7 13.4 L167.0 12.9 L162.4 12.6 L157.7 12.4 L153.1 12.4 L148.4 12.5 L143.8 12.8 L139.2 13.2 L134.5 13.8 L129.9 14.5 L125.4 15.4 L120.8 16.4 L116.3 17.6 L111.9 19.0 L107.4 20.4 L103.1 22.0 L98.8 23.8 L94.5 25.7 L90.3 27.7 L86.2 29.9 L82.2 32.2 L78.2 34.7 L74.3 37.2 L70.5 39.9 L66.8 42.7 L63.2 45.7 L59.7 48.7 L56.3 51.9 L52.9 55.1 L49.7 58.5 L46.7 62.0 L43.7 65.6 L40.8 69.3 L38.1 73.0 L35.5 76.9 L33.0 80.8 L30.7 84.9 L28.4 88.9 L26.4 93.1 L24.4 97.3 L22.6 101.6 L21.0 106.0 L19.4 110.4 L18.1 114.8 L16.8 119.3 L15.7 123.8 L14.8 128.4 L14.0 133.0 L13.4 137.6 L12.9 142.2 L12.6 146.9 L12.4 151.5 L12.4 156.2 L12.5 160.8 L12.8 165.5 L13.2 170.1 L13.8 174.7 L14.5 179.3 L15.4 183.9 L16.4 188.5 L17.6 193.0 L19.0 197.4 L20.4 201.8 L22.0 206.2 L23.8 210.5 L25.7 214.8 Z`, mat: 'blue', level: 1, fin: 'gloss' },
      { d: `M76.0 218.7 L75.6 219.4 L75.3 220.1 L75.1 220.9 L75.1 221.7 L75.3 222.4 L75.6 223.2 L76.0 223.8 L76.5 224.4 L143.7 282.2 L144.4 282.7 L145.1 283.0 L146.0 283.2 L146.8 283.2 L147.6 283.0 L148.4 282.6 L149.1 282.1 L268.9 176.1 L269.5 175.5 L269.9 174.8 L270.2 174.0 L270.3 173.1 L270.2 172.3 L270.0 171.5 L269.6 170.7 L269.1 170.1 L256.3 157.3 L255.7 156.8 L255.0 156.5 L254.3 156.2 L253.5 156.1 L252.8 156.2 L252.0 156.3 L251.3 156.7 L250.7 157.1 L147.2 245.0 L146.3 245.6 L145.6 245.9 L144.8 246.1 L143.9 246.1 L143.1 245.9 L142.3 245.6 L141.5 245.0 L99.1 208.1 L98.4 207.6 L97.7 207.3 L96.8 207.1 L96.0 207.1 L95.1 207.3 L94.4 207.7 L77.2 217.7 L76.5 218.2 Z`, mat: 'blue', level: 1, fin: 'gloss' }
    ],
    face: { x: -0.049, y: 0.584, w: 0.521, h: 0.398, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/round.bc46c5c5.webp", "box": [-6.0, -6.0, 315.33, 306.19]}, tile: "img/designs/tile-round.663cb4dc.webp",
  },
  bluering: {
    name: "Ring Round", group: 'Rounds', sheet: 'blue', base: 1.04,
    note: "A blue disc with a broad ring: a yellow centre crossed by a blue band.",
    body: `M309.2 149.6 L308.9 144.5 L308.5 139.5 L308.0 134.5 L307.2 129.4 L306.3 124.5 L305.2 119.5 L304.0 114.6 L302.6 109.7 L301.1 104.9 L299.4 100.2 L297.5 95.5 L295.5 90.8 L293.3 86.2 L291.0 81.7 L288.6 77.3 L286.0 73.0 L283.2 68.7 L280.3 64.6 L277.3 60.5 L274.2 56.5 L270.9 52.7 L267.5 48.9 L264.0 45.3 L260.3 41.8 L256.6 38.4 L252.7 35.1 L248.8 32.0 L244.7 28.9 L240.6 26.1 L236.3 23.3 L232.0 20.7 L227.5 18.3 L223.0 15.9 L218.5 13.8 L213.8 11.8 L209.1 9.9 L204.3 8.2 L199.5 6.7 L194.7 5.3 L189.8 4.0 L184.8 3.0 L179.8 2.1 L174.8 1.3 L169.8 0.7 L164.8 0.3 L159.7 0.1 L154.6 0.0 L149.6 0.1 L144.5 0.3 L139.5 0.7 L134.5 1.3 L129.4 2.1 L124.5 3.0 L119.5 4.0 L114.6 5.3 L109.7 6.7 L104.9 8.2 L100.2 9.9 L95.5 11.8 L90.8 13.8 L86.2 15.9 L81.7 18.3 L77.3 20.7 L73.0 23.3 L68.7 26.1 L64.6 28.9 L60.5 32.0 L56.5 35.1 L52.7 38.4 L48.9 41.8 L45.3 45.3 L41.8 48.9 L38.4 52.7 L35.1 56.5 L32.0 60.5 L28.9 64.6 L26.1 68.7 L23.3 73.0 L20.7 77.3 L18.3 81.7 L15.9 86.2 L13.8 90.8 L11.8 95.5 L9.9 100.2 L8.2 104.9 L6.7 109.7 L5.3 114.6 L4.0 119.5 L3.0 124.5 L2.1 129.4 L1.3 134.5 L0.7 139.5 L0.3 144.5 L0.1 149.6 L0.0 154.6 L0.1 159.7 L0.3 164.8 L0.7 169.8 L1.3 174.8 L2.1 179.8 L3.0 184.8 L4.0 189.8 L5.3 194.7 L6.7 199.5 L8.2 204.3 L9.9 209.1 L11.8 213.8 L13.8 218.5 L15.9 223.0 L18.3 227.5 L20.7 232.0 L23.3 236.3 L26.1 240.6 L28.9 244.7 L32.0 248.8 L35.1 252.7 L38.4 256.6 L41.8 260.3 L45.3 264.0 L48.9 267.5 L52.7 270.9 L56.5 274.2 L60.5 277.3 L64.6 280.3 L68.7 283.2 L73.0 286.0 L77.3 288.6 L81.7 291.0 L86.2 293.3 L90.8 295.5 L95.5 297.5 L101.9 300.0 L207.3 300.0 L213.8 297.5 L218.5 295.5 L223.0 293.3 L227.5 291.0 L232.0 288.6 L236.3 286.0 L240.6 283.2 L244.7 280.3 L248.8 277.3 L252.7 274.2 L256.6 270.9 L260.3 267.5 L264.0 264.0 L267.5 260.3 L270.9 256.6 L274.2 252.7 L277.3 248.8 L280.3 244.7 L283.2 240.6 L286.0 236.3 L288.6 232.0 L291.0 227.5 L293.3 223.0 L295.5 218.5 L297.5 213.8 L299.4 209.1 L301.1 204.3 L302.6 199.5 L304.0 194.7 L305.2 189.8 L306.3 184.8 L307.2 179.8 L308.0 174.8 L308.5 169.8 L308.9 164.8 L309.2 159.7 L309.3 154.6 Z`,
    layers: [
      { d: `M276.0 146.7 L275.7 142.7 L275.2 138.8 L274.7 134.8 L274.0 130.9 L273.1 127.0 L272.1 123.2 L271.1 119.3 L269.8 115.5 L268.5 111.8 L267.0 108.1 L265.4 104.4 L263.7 100.8 L261.9 97.3 L260.0 93.8 L257.9 90.4 L255.8 87.1 L253.5 83.8 L251.2 80.6 L248.7 77.5 L246.1 74.4 L243.4 71.5 L240.7 68.6 L237.8 65.9 L234.8 63.2 L231.8 60.6 L228.7 58.1 L225.5 55.8 L222.2 53.5 L218.9 51.3 L215.5 49.3 L212.0 47.4 L208.4 45.5 L204.8 43.8 L201.2 42.2 L197.5 40.8 L193.7 39.4 L190.0 38.2 L186.1 37.1 L182.3 36.2 L178.4 35.3 L174.5 34.6 L170.5 34.0 L166.6 33.6 L162.6 33.3 L158.6 33.1 L154.6 33.0 L150.7 33.1 L146.7 33.3 L142.7 33.6 L138.8 34.0 L134.8 34.6 L130.9 35.3 L127.0 36.2 L123.2 37.1 L119.3 38.2 L115.5 39.4 L111.8 40.8 L108.1 42.2 L104.4 43.8 L100.8 45.5 L97.3 47.4 L93.8 49.3 L90.4 51.3 L87.1 53.5 L83.8 55.8 L80.6 58.1 L77.5 60.6 L74.4 63.2 L71.5 65.9 L68.6 68.6 L65.9 71.5 L63.2 74.4 L60.6 77.5 L58.1 80.6 L55.8 83.8 L53.5 87.1 L51.3 90.4 L49.3 93.8 L47.4 97.3 L45.5 100.8 L43.8 104.4 L42.2 108.1 L40.8 111.8 L39.4 115.5 L38.2 119.3 L37.1 123.2 L36.2 127.0 L35.3 130.9 L34.6 134.8 L34.0 138.8 L33.6 142.7 L33.3 146.7 L33.1 150.7 L33.0 154.6 L33.1 158.6 L33.3 162.6 L33.6 166.6 L34.0 170.5 L34.6 174.5 L35.3 178.4 L36.2 182.3 L37.1 186.1 L38.2 190.0 L39.4 193.7 L40.8 197.5 L42.2 201.2 L43.8 204.8 L45.5 208.4 L47.4 212.0 L49.3 215.5 L51.3 218.9 L53.5 222.2 L55.8 225.5 L58.1 228.7 L60.6 231.8 L63.2 234.8 L65.9 237.8 L68.6 240.7 L71.5 243.4 L74.4 246.1 L77.5 248.7 L80.6 251.2 L83.8 253.5 L87.1 255.8 L90.4 257.9 L93.8 260.0 L97.3 261.9 L100.8 263.7 L104.4 265.4 L108.1 267.0 L111.8 268.5 L115.5 269.8 L119.3 271.1 L123.2 272.1 L127.0 273.1 L130.9 274.0 L134.8 274.7 L138.8 275.2 L142.7 275.7 L146.7 276.0 L150.7 276.2 L154.6 276.3 L158.6 276.2 L162.6 276.0 L166.6 275.7 L170.5 275.2 L174.5 274.7 L178.4 274.0 L182.3 273.1 L186.1 272.1 L190.0 271.1 L193.7 269.8 L197.5 268.5 L201.2 267.0 L204.8 265.4 L208.4 263.7 L212.0 261.9 L215.5 260.0 L218.9 257.9 L222.2 255.8 L225.5 253.5 L228.7 251.2 L231.8 248.7 L234.8 246.1 L237.8 243.4 L240.7 240.7 L243.4 237.8 L246.1 234.8 L248.7 231.8 L251.2 228.7 L253.5 225.5 L255.8 222.2 L257.9 218.9 L260.0 215.5 L261.9 212.0 L263.7 208.4 L265.4 204.8 L267.0 201.2 L268.5 197.5 L269.8 193.7 L271.1 190.0 L272.1 186.1 L273.1 182.3 L274.0 178.4 L274.7 174.5 L275.2 170.5 L275.7 166.6 L276.0 162.6 L276.2 158.6 L276.3 154.6 L276.2 150.7 Z`, mat: 'yellow', level: 1, fin: 'gloss' },
      { d: `M125.6 272.8 L130.9 274.0 L134.8 274.7 L138.8 275.2 L142.7 275.7 L146.7 276.0 L150.7 276.2 L154.6 276.3 L158.6 276.2 L162.6 276.0 L166.6 275.7 L170.5 275.2 L174.5 274.7 L178.4 274.0 L182.3 273.1 L186.1 272.1 L190.0 271.1 L193.7 269.8 L197.5 268.5 L201.2 267.0 L204.8 265.4 L208.4 263.7 L212.0 261.9 L215.5 260.0 L218.9 257.9 L222.2 255.8 L225.5 253.5 L228.7 251.2 L231.8 248.7 L234.8 246.1 L237.8 243.4 L240.7 240.7 L243.4 237.8 L246.1 234.8 L248.7 231.8 L251.2 228.7 L253.5 225.5 L255.8 222.2 L257.9 218.9 L260.0 215.5 L261.9 212.0 L263.7 208.4 L265.4 204.8 L267.0 201.2 L268.5 197.5 L269.8 193.7 L271.1 190.0 L272.9 183.0 Z`, mat: 'blue', level: 2, fin: 'gloss' }
    ],
    face: { x: -0.037, y: 0.533, w: 0.573, h: 0.438, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/bluering.8c0e0d52.webp", "box": [-6.0, -6.0, 315.33, 306.19]}, tile: "img/designs/tile-bluering.ac3c86da.webp",
  },
  colourround: {
    name: "Colour Round", group: 'Rounds', sheet: 'white', base: 1.04,
    note: "A disc with a rainbow rim round a white centre.",
    body: `M309.2 149.6 L308.9 144.5 L308.5 139.5 L308.0 134.5 L307.2 129.4 L306.3 124.5 L305.2 119.5 L304.0 114.6 L302.6 109.7 L301.1 104.9 L299.4 100.2 L297.5 95.5 L295.5 90.8 L293.3 86.2 L291.0 81.7 L288.6 77.3 L286.0 73.0 L283.2 68.7 L280.3 64.6 L277.3 60.5 L274.2 56.5 L270.9 52.7 L267.5 48.9 L264.0 45.3 L260.3 41.8 L256.6 38.4 L252.7 35.1 L248.8 32.0 L244.7 28.9 L240.6 26.1 L236.3 23.3 L232.0 20.7 L227.5 18.3 L223.0 15.9 L218.5 13.8 L213.8 11.8 L209.1 9.9 L204.3 8.2 L199.5 6.7 L194.7 5.3 L189.8 4.0 L184.8 3.0 L179.8 2.1 L174.8 1.3 L169.8 0.7 L164.8 0.3 L159.7 0.1 L154.6 0.0 L149.6 0.1 L144.5 0.3 L139.5 0.7 L134.5 1.3 L129.4 2.1 L124.5 3.0 L119.5 4.0 L114.6 5.3 L109.7 6.7 L104.9 8.2 L100.2 9.9 L95.5 11.8 L90.8 13.8 L86.2 15.9 L81.7 18.3 L77.3 20.7 L73.0 23.3 L68.7 26.1 L64.6 28.9 L60.5 32.0 L56.5 35.1 L52.7 38.4 L48.9 41.8 L45.3 45.3 L41.8 48.9 L38.4 52.7 L35.1 56.5 L32.0 60.5 L28.9 64.6 L26.1 68.7 L23.3 73.0 L20.7 77.3 L18.3 81.7 L15.9 86.2 L13.8 90.8 L11.8 95.5 L9.9 100.2 L8.2 104.9 L6.7 109.7 L5.3 114.6 L4.0 119.5 L3.0 124.5 L2.1 129.4 L1.3 134.5 L0.7 139.5 L0.3 144.5 L0.1 149.6 L0.0 154.6 L0.1 159.7 L0.3 164.8 L0.7 169.8 L1.3 174.8 L2.1 179.8 L3.0 184.8 L4.0 189.8 L5.3 194.7 L6.7 199.5 L8.2 204.3 L9.9 209.1 L11.8 213.8 L13.8 218.5 L15.9 223.0 L18.3 227.5 L20.7 232.0 L23.3 236.3 L26.1 240.6 L28.9 244.7 L32.0 248.8 L35.1 252.7 L38.4 256.6 L41.8 260.3 L45.3 264.0 L48.9 267.5 L52.7 270.9 L56.5 274.2 L60.5 277.3 L64.6 280.3 L68.7 283.2 L73.0 286.0 L77.3 288.6 L81.7 291.0 L86.2 293.3 L90.8 295.5 L95.5 297.5 L101.9 300.0 L207.3 300.0 L213.8 297.5 L218.5 295.5 L223.0 293.3 L227.5 291.0 L232.0 288.6 L236.3 286.0 L240.6 283.2 L244.7 280.3 L248.8 277.3 L252.7 274.2 L256.6 270.9 L260.3 267.5 L264.0 264.0 L267.5 260.3 L270.9 256.6 L274.2 252.7 L277.3 248.8 L280.3 244.7 L283.2 240.6 L286.0 236.3 L288.6 232.0 L291.0 227.5 L293.3 223.0 L295.5 218.5 L297.5 213.8 L299.4 209.1 L301.1 204.3 L302.6 199.5 L304.0 194.7 L305.2 189.8 L306.3 184.8 L307.2 179.8 L308.0 174.8 L308.5 169.8 L308.9 164.8 L309.2 159.7 L309.3 154.6 Z`,
    layers: [
      { d: `M201.6 269.1 L205.7 267.3 L209.4 265.6 L213.0 263.7 L216.5 261.8 L220.0 259.7 L223.4 257.5 L226.7 255.2 L229.9 252.8 L233.1 250.3 L236.2 247.6 L239.2 244.9 L242.1 242.1 L244.9 239.2 L247.6 236.2 L250.3 233.1 L252.8 229.9 L255.2 226.7 L257.5 223.4 L259.7 220.0 L261.8 216.5 L263.7 213.0 L265.6 209.4 L267.3 205.7 L268.9 202.0 L270.4 198.2 L271.8 194.4 L273.0 190.5 L274.1 186.7 L275.1 182.7 L276.0 178.8 L276.7 174.8 L277.3 170.8 L277.8 166.8 L278.1 162.7 L278.3 158.7 L278.3 154.6 L278.3 150.6 L278.1 146.5 L277.8 142.5 L277.3 138.5 L276.7 134.5 L276.0 130.5 L275.1 126.5 L274.1 122.6 L273.0 118.7 L271.8 114.9 L270.4 111.1 L268.9 107.3 L267.3 103.6 L265.6 99.9 L263.7 96.3 L261.8 92.8 L259.7 89.3 L257.5 85.9 L255.2 82.6 L252.8 79.3 L250.3 76.2 L247.6 73.1 L244.9 70.1 L242.1 67.2 L239.2 64.3 L236.2 61.6 L233.1 59.0 L229.9 56.5 L226.7 54.1 L223.4 51.8 L220.0 49.6 L216.5 47.5 L213.0 45.5 L209.4 43.7 L205.7 42.0 L202.0 40.3 L198.2 38.9 L194.4 37.5 L190.5 36.3 L186.7 35.1 L182.7 34.2 L178.8 33.3 L174.8 32.6 L170.8 32.0 L166.8 31.5 L162.7 31.2 L158.7 31.0 L154.6 30.9 L150.6 31.0 L146.5 31.2 L142.5 31.5 L138.5 32.0 L134.5 32.6 L130.5 33.3 L126.5 34.2 L122.6 35.1 L118.7 36.3 L114.9 37.5 L111.1 38.9 L107.3 40.3 L103.6 42.0 L99.9 43.7 L96.3 45.5 L92.8 47.5 L89.3 49.6 L85.9 51.8 L82.6 54.1 L79.3 56.5 L76.2 59.0 L73.1 61.6 L70.1 64.3 L67.2 67.2 L64.3 70.1 L61.6 73.1 L59.0 76.2 L56.5 79.3 L54.1 82.6 L51.8 85.9 L49.6 89.3 L47.5 92.8 L45.5 96.3 L43.7 99.9 L42.0 103.6 L40.3 107.3 L38.9 111.1 L37.5 114.9 L36.3 118.7 L35.1 122.6 L34.2 126.5 L33.3 130.5 L32.6 134.5 L32.0 138.5 L31.5 142.5 L31.2 146.5 L31.0 150.6 L30.9 154.6 L31.0 158.7 L31.2 162.7 L31.5 166.8 L32.0 170.8 L32.6 174.8 L33.3 178.8 L34.2 182.7 L35.1 186.7 L36.3 190.5 L37.5 194.4 L38.9 198.2 L40.3 202.0 L42.0 205.7 L43.7 209.4 L45.5 213.0 L47.5 216.5 L49.6 220.0 L51.8 223.4 L54.1 226.7 L56.5 229.9 L59.0 233.1 L61.6 236.2 L64.3 239.2 L67.2 242.1 L70.1 244.9 L73.1 247.6 L76.2 250.3 L79.3 252.8 L82.6 255.2 L85.9 257.5 L89.3 259.7 L92.8 261.8 L96.3 263.7 L99.9 265.6 L103.6 267.3 L107.3 268.9 L107.7 269.1 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M200.4 262.9 L206.6 260.0 L210.0 258.3 L213.4 256.4 L216.7 254.4 L219.9 252.4 L223.1 250.2 L226.2 247.9 L229.2 245.5 L232.1 243.0 L235.0 240.4 L237.7 237.7 L240.4 235.0 L243.0 232.1 L245.5 229.2 L247.9 226.2 L250.2 223.1 L252.4 219.9 L254.4 216.7 L256.4 213.4 L258.3 210.0 L260.0 206.6 L261.7 203.1 L263.2 199.6 L264.6 196.0 L265.9 192.4 L267.1 188.8 L268.2 185.1 L269.1 181.3 L269.9 177.6 L270.6 173.8 L271.2 170.0 L271.6 166.2 L271.9 162.3 L272.1 158.5 L272.2 154.6 L272.1 150.8 L271.9 147.0 L271.6 143.1 L271.2 139.3 L270.6 135.5 L269.9 131.7 L269.1 128.0 L268.2 124.2 L267.1 120.5 L265.9 116.9 L264.6 113.2 L263.2 109.7 L261.7 106.1 L260.0 102.7 L258.3 99.2 L256.4 95.9 L254.4 92.6 L252.4 89.3 L250.2 86.2 L247.9 83.1 L245.5 80.1 L243.0 77.2 L240.4 74.3 L237.7 71.5 L235.0 68.9 L232.1 66.3 L229.2 63.8 L226.2 61.4 L223.1 59.1 L219.9 56.9 L216.7 54.8 L213.4 52.9 L210.0 51.0 L206.6 49.2 L203.1 47.6 L199.6 46.1 L196.0 44.7 L192.4 43.4 L188.8 42.2 L185.1 41.1 L181.3 40.2 L177.6 39.4 L173.8 38.7 L170.0 38.1 L166.2 37.7 L162.3 37.4 L158.5 37.2 L154.6 37.1 L150.8 37.2 L147.0 37.4 L143.1 37.7 L139.3 38.1 L135.5 38.7 L131.7 39.4 L128.0 40.2 L124.2 41.1 L120.5 42.2 L116.9 43.4 L113.2 44.7 L109.7 46.1 L106.1 47.6 L102.7 49.2 L99.2 51.0 L95.9 52.9 L92.6 54.8 L89.3 56.9 L86.2 59.1 L83.1 61.4 L80.1 63.8 L77.2 66.3 L74.3 68.9 L71.5 71.5 L68.9 74.3 L66.3 77.2 L63.8 80.1 L61.4 83.1 L59.1 86.2 L56.9 89.3 L54.8 92.6 L52.9 95.9 L51.0 99.2 L49.2 102.7 L47.6 106.1 L46.1 109.7 L44.7 113.2 L43.4 116.9 L42.2 120.5 L41.1 124.2 L40.2 128.0 L39.4 131.7 L38.7 135.5 L38.1 139.3 L37.7 143.1 L37.4 147.0 L37.2 150.8 L37.1 154.6 L37.2 158.5 L37.4 162.3 L37.7 166.2 L38.1 170.0 L38.7 173.8 L39.4 177.6 L40.2 181.3 L41.1 185.1 L42.2 188.8 L43.4 192.4 L44.7 196.0 L46.1 199.6 L47.6 203.1 L49.2 206.6 L51.0 210.0 L52.9 213.4 L54.8 216.7 L56.9 219.9 L59.1 223.1 L61.4 226.2 L63.8 229.2 L66.3 232.1 L68.9 235.0 L71.5 237.7 L74.3 240.4 L77.2 243.0 L80.1 245.5 L83.1 247.9 L86.2 250.2 L89.3 252.4 L92.6 254.4 L95.9 256.4 L99.2 258.3 L102.7 260.0 L108.9 262.9 Z M104.0 257.3 L100.7 255.6 L97.4 253.7 L94.2 251.8 L91.1 249.8 L88.0 247.7 L85.0 245.4 L82.0 243.1 L79.2 240.7 L76.4 238.2 L73.7 235.6 L71.1 232.9 L68.6 230.1 L66.2 227.2 L63.9 224.3 L61.6 221.3 L59.5 218.2 L57.5 215.1 L55.5 211.9 L53.7 208.6 L52.0 205.2 L50.4 201.9 L48.9 198.4 L47.5 194.9 L46.3 191.4 L45.1 187.9 L44.1 184.3 L43.2 180.6 L42.4 177.0 L41.7 173.3 L41.2 169.6 L40.8 165.9 L40.5 162.1 L40.3 158.4 L40.2 154.6 L40.3 150.9 L40.5 147.2 L40.8 143.4 L41.2 139.7 L41.7 136.0 L42.4 132.3 L43.2 128.7 L44.1 125.0 L45.1 121.4 L46.3 117.9 L47.5 114.3 L48.9 110.8 L50.4 107.4 L52.0 104.0 L53.7 100.7 L55.5 97.4 L57.5 94.2 L59.5 91.1 L61.6 88.0 L63.9 85.0 L66.2 82.0 L68.6 79.2 L71.1 76.4 L73.7 73.7 L76.4 71.1 L79.2 68.6 L82.0 66.2 L85.0 63.9 L88.0 61.6 L91.1 59.5 L94.2 57.5 L97.4 55.5 L100.7 53.7 L104.0 52.0 L107.4 50.4 L110.8 48.9 L114.3 47.5 L117.9 46.3 L121.4 45.1 L125.0 44.1 L128.7 43.2 L132.3 42.4 L136.0 41.7 L139.7 41.2 L143.4 40.8 L147.2 40.5 L150.9 40.3 L154.6 40.2 L158.4 40.3 L162.1 40.5 L165.9 40.8 L169.6 41.2 L173.3 41.7 L177.0 42.4 L180.6 43.2 L184.3 44.1 L187.9 45.1 L191.4 46.3 L194.9 47.5 L198.4 48.9 L201.9 50.4 L205.2 52.0 L208.6 53.7 L211.9 55.5 L215.1 57.5 L218.2 59.5 L221.3 61.6 L224.3 63.9 L227.2 66.2 L230.1 68.6 L232.9 71.1 L235.6 73.7 L238.2 76.4 L240.7 79.2 L243.1 82.0 L245.4 85.0 L247.7 88.0 L249.8 91.1 L251.8 94.2 L253.7 97.4 L255.6 100.7 L257.3 104.0 L258.9 107.4 L260.4 110.8 L261.7 114.3 L263.0 117.9 L264.1 121.4 L265.2 125.0 L266.1 128.7 L266.9 132.3 L267.5 136.0 L268.1 139.7 L268.5 143.4 L268.8 147.2 L269.0 150.9 L269.1 154.6 L269.0 158.4 L268.8 162.1 L268.5 165.9 L268.1 169.6 L267.5 173.3 L266.9 177.0 L266.1 180.6 L265.2 184.3 L264.1 187.9 L263.0 191.4 L261.7 194.9 L260.4 198.4 L258.9 201.9 L257.3 205.2 L255.6 208.6 L253.7 211.9 L251.8 215.1 L249.8 218.2 L247.7 221.3 L245.4 224.3 L243.1 227.2 L240.7 230.1 L238.2 232.9 L235.6 235.6 L232.9 238.2 L230.1 240.7 L227.2 243.1 L224.3 245.4 L221.3 247.7 L218.2 249.8 L215.1 251.8 L211.9 253.7 L208.6 255.6 L205.2 257.3 L199.7 259.8 L109.6 259.8 Z`, mat: 'black', level: 2, fin: 'gloss' },
      { d: `M157.3 28.9 L164.1 29.2 L169.9 29.8 L175.7 30.6 L181.4 31.8 L187.1 33.1 L192.7 34.8 L198.2 36.7 L203.7 38.8 L209.0 41.2 L214.2 43.9 L219.3 46.8 L224.2 49.9 L229.0 53.2 L233.7 56.8 L238.1 60.6 L241.7 63.9 L261.7 43.0 L256.6 38.4 L252.7 35.1 L248.8 32.0 L244.7 28.9 L240.6 26.1 L236.3 23.3 L232.0 20.7 L227.5 18.3 L223.0 15.9 L218.5 13.8 L213.8 11.8 L209.1 9.9 L204.3 8.2 L199.5 6.7 L194.7 5.3 L189.8 4.0 L184.8 3.0 L179.8 2.1 L174.8 1.3 L169.8 0.7 L164.8 0.3 L157.9 0.1 Z`, mat: 'red', level: 1, fin: 'facets' },
      { d: `M245.4 67.6 L250.0 72.6 L253.7 77.2 L257.2 81.8 L259.9 85.9 L263.0 90.8 L265.9 95.9 L268.5 101.2 L270.8 106.5 L272.9 112.0 L274.8 117.5 L276.4 123.1 L277.7 128.8 L278.8 134.6 L279.6 140.3 L280.1 146.2 L280.4 152.0 L309.2 151.4 L308.9 144.5 L308.5 139.5 L308.0 134.5 L307.2 129.4 L306.3 124.5 L305.2 119.5 L304.0 114.6 L302.6 109.7 L301.1 104.9 L299.4 100.2 L297.5 95.5 L295.5 90.8 L293.3 86.2 L291.0 81.7 L288.6 77.3 L286.0 73.0 L283.2 68.7 L280.3 64.6 L277.3 60.5 L274.2 56.5 L270.9 52.7 L266.2 47.6 Z`, mat: 'orange', level: 1, fin: 'facets' },
      { d: `M280.4 157.3 L280.1 164.1 L279.5 169.9 L278.6 175.7 L277.5 181.4 L276.2 187.1 L274.5 192.7 L272.6 198.2 L270.5 203.7 L268.1 209.0 L265.4 214.2 L262.5 219.3 L259.4 224.2 L256.1 229.0 L252.5 233.7 L248.7 238.1 L245.4 241.7 L266.2 261.7 L270.9 256.6 L274.2 252.7 L277.3 248.8 L280.3 244.7 L283.2 240.6 L286.0 236.3 L288.6 232.0 L291.0 227.5 L293.3 223.0 L295.5 218.5 L297.5 213.8 L299.4 209.1 L301.1 204.3 L302.6 199.5 L304.0 194.7 L305.2 189.8 L306.3 184.8 L307.2 179.8 L308.0 174.8 L308.5 169.8 L308.9 164.8 L309.2 157.9 Z`, mat: 'yellow', level: 1, fin: 'facets' },
      { d: `M241.7 245.4 L236.6 250.0 L232.1 253.7 L227.4 257.2 L223.4 259.9 L218.5 263.0 L213.3 265.9 L208.1 268.5 L202.8 270.8 L197.3 272.9 L191.8 274.8 L186.2 276.4 L180.5 277.7 L174.7 278.8 L168.9 279.6 L163.1 280.1 L157.3 280.4 L157.7 300.0 L207.3 300.0 L213.8 297.5 L218.5 295.5 L223.0 293.3 L227.5 291.0 L232.0 288.6 L236.3 286.0 L240.6 283.2 L244.7 280.3 L248.8 277.3 L252.7 274.2 L256.6 270.9 L261.7 266.2 Z`, mat: 'green', level: 1, fin: 'facets' },
      { d: `M152.0 280.4 L145.2 280.1 L139.4 279.5 L133.6 278.6 L127.9 277.5 L122.2 276.2 L116.6 274.5 L111.0 272.6 L105.6 270.5 L100.3 268.1 L95.1 265.4 L90.0 262.5 L85.0 259.4 L80.3 256.1 L75.6 252.5 L71.9 249.4 L67.6 245.4 L47.6 266.2 L52.7 270.9 L56.5 274.2 L60.5 277.3 L64.6 280.3 L68.7 283.2 L73.0 286.0 L77.3 288.6 L81.7 291.0 L86.2 293.3 L90.8 295.5 L95.5 297.5 L101.9 300.0 L151.6 300.0 Z`, mat: 'sky', level: 1, fin: 'facets' },
      { d: `M63.9 241.7 L59.3 236.6 L56.2 232.9 L52.6 228.2 L49.3 223.4 L46.3 218.5 L43.4 213.3 L40.8 208.1 L38.4 202.8 L36.3 197.3 L34.5 191.8 L32.9 186.2 L31.5 180.5 L30.5 174.7 L29.7 168.9 L29.2 163.1 L28.9 157.3 L0.1 157.9 L0.3 164.8 L0.7 169.8 L1.3 174.8 L2.1 179.8 L3.0 184.8 L4.0 189.8 L5.3 194.7 L6.7 199.5 L8.2 204.3 L9.9 209.1 L11.8 213.8 L13.8 218.5 L15.9 223.0 L18.3 227.5 L20.7 232.0 L23.3 236.3 L26.1 240.6 L28.9 244.7 L32.0 248.8 L35.1 252.7 L38.4 256.6 L43.0 261.7 Z`, mat: 'blue', level: 1, fin: 'facets' },
      { d: `M28.9 152.0 L29.2 145.2 L29.7 140.3 L30.5 134.6 L31.5 128.8 L32.9 123.1 L34.5 117.5 L36.3 112.0 L38.4 106.5 L40.8 101.2 L43.4 95.9 L46.3 90.8 L49.3 85.9 L52.6 81.0 L56.2 76.4 L59.9 71.9 L63.9 67.6 L43.0 47.6 L38.4 52.7 L35.1 56.5 L32.0 60.5 L28.9 64.6 L26.1 68.7 L23.3 73.0 L20.7 77.3 L18.3 81.7 L15.9 86.2 L13.8 90.8 L11.8 95.5 L9.9 100.2 L8.2 104.9 L6.7 109.7 L5.3 114.6 L4.0 119.5 L3.0 124.5 L2.1 129.4 L1.3 134.5 L0.7 139.5 L0.3 144.5 L0.1 151.4 Z`, mat: 'navy', level: 1, fin: 'facets' },
      { d: `M67.6 63.9 L72.6 59.3 L77.2 55.6 L81.8 52.1 L86.7 48.8 L90.8 46.3 L95.9 43.4 L101.2 40.8 L106.5 38.4 L112.0 36.3 L117.5 34.5 L123.1 32.9 L128.8 31.5 L134.6 30.5 L140.3 29.7 L146.2 29.2 L152.0 28.9 L151.4 0.1 L144.5 0.3 L139.5 0.7 L134.5 1.3 L129.4 2.1 L124.5 3.0 L119.5 4.0 L114.6 5.3 L109.7 6.7 L104.9 8.2 L100.2 9.9 L95.5 11.8 L90.8 13.8 L86.2 15.9 L81.7 18.3 L77.3 20.7 L73.0 23.3 L68.7 26.1 L64.6 28.9 L60.5 32.0 L56.5 35.1 L52.7 38.4 L47.6 43.0 Z`, mat: 'wine', level: 1, fin: 'facets' }
    ],
    face: { x: -0.0, y: 0.5, w: 0.62, h: 0.473, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/colourround.10cb6555.webp", "box": [-6.0, -6.0, 315.33, 306.19]}, tile: "img/designs/tile-colourround.566c7015.webp",
  },
  clearround: {
    name: "Clear Round", group: 'Rounds', sheet: 'clear', base: 1.04,
    note: "A clear disc with a frosted rim and a frosted star at its crown.",
    body: `M309.2 149.6 L308.9 144.5 L308.5 139.5 L308.0 134.5 L307.2 129.4 L306.3 124.5 L305.2 119.5 L304.0 114.6 L302.6 109.7 L301.1 104.9 L299.4 100.2 L297.5 95.5 L295.5 90.8 L293.3 86.2 L291.0 81.7 L288.6 77.3 L286.0 73.0 L283.2 68.7 L280.3 64.6 L277.3 60.5 L274.2 56.5 L270.9 52.7 L267.5 48.9 L264.0 45.3 L260.3 41.8 L256.6 38.4 L252.7 35.1 L248.8 32.0 L244.7 28.9 L240.6 26.1 L236.3 23.3 L232.0 20.7 L227.5 18.3 L223.0 15.9 L218.5 13.8 L213.8 11.8 L209.1 9.9 L204.3 8.2 L199.5 6.7 L194.7 5.3 L189.8 4.0 L184.8 3.0 L179.8 2.1 L174.8 1.3 L169.8 0.7 L164.8 0.3 L159.7 0.1 L154.6 0.0 L149.6 0.1 L144.5 0.3 L139.5 0.7 L134.5 1.3 L129.4 2.1 L124.5 3.0 L119.5 4.0 L114.6 5.3 L109.7 6.7 L104.9 8.2 L100.2 9.9 L95.5 11.8 L90.8 13.8 L86.2 15.9 L81.7 18.3 L77.3 20.7 L73.0 23.3 L68.7 26.1 L64.6 28.9 L60.5 32.0 L56.5 35.1 L52.7 38.4 L48.9 41.8 L45.3 45.3 L41.8 48.9 L38.4 52.7 L35.1 56.5 L32.0 60.5 L28.9 64.6 L26.1 68.7 L23.3 73.0 L20.7 77.3 L18.3 81.7 L15.9 86.2 L13.8 90.8 L11.8 95.5 L9.9 100.2 L8.2 104.9 L6.7 109.7 L5.3 114.6 L4.0 119.5 L3.0 124.5 L2.1 129.4 L1.3 134.5 L0.7 139.5 L0.3 144.5 L0.1 149.6 L0.0 154.6 L0.1 159.7 L0.3 164.8 L0.7 169.8 L1.3 174.8 L2.1 179.8 L3.0 184.8 L4.0 189.8 L5.3 194.7 L6.7 199.5 L8.2 204.3 L9.9 209.1 L11.8 213.8 L13.8 218.5 L15.9 223.0 L18.3 227.5 L20.7 232.0 L23.3 236.3 L26.1 240.6 L28.9 244.7 L32.0 248.8 L35.1 252.7 L38.4 256.6 L41.8 260.3 L45.3 264.0 L48.9 267.5 L52.7 270.9 L56.5 274.2 L60.5 277.3 L64.6 280.3 L68.7 283.2 L73.0 286.0 L77.3 288.6 L81.7 291.0 L86.2 293.3 L90.8 295.5 L95.5 297.5 L101.9 300.0 L207.3 300.0 L213.8 297.5 L218.5 295.5 L223.0 293.3 L227.5 291.0 L232.0 288.6 L236.3 286.0 L240.6 283.2 L244.7 280.3 L248.8 277.3 L252.7 274.2 L256.6 270.9 L260.3 267.5 L264.0 264.0 L267.5 260.3 L270.9 256.6 L274.2 252.7 L277.3 248.8 L280.3 244.7 L283.2 240.6 L286.0 236.3 L288.6 232.0 L291.0 227.5 L293.3 223.0 L295.5 218.5 L297.5 213.8 L299.4 209.1 L301.1 204.3 L302.6 199.5 L304.0 194.7 L305.2 189.8 L306.3 184.8 L307.2 179.8 L308.0 174.8 L308.5 169.8 L308.9 164.8 L309.2 159.7 L309.3 154.6 Z`,
    layers: [
      { d: `M301.4 140.2 L300.8 135.4 L300.1 130.6 L299.2 125.9 L298.2 121.2 L297.0 116.5 L295.7 111.8 L294.2 107.3 L292.6 102.7 L290.8 98.2 L288.9 93.8 L286.9 89.4 L284.7 85.1 L282.3 80.9 L279.8 76.8 L277.2 72.7 L274.5 68.8 L271.6 64.9 L268.6 61.1 L265.5 57.4 L262.2 53.9 L258.9 50.4 L255.4 47.0 L251.8 43.8 L248.2 40.7 L244.4 37.7 L240.5 34.8 L236.5 32.1 L232.5 29.4 L228.4 27.0 L224.1 24.6 L219.8 22.4 L215.5 20.4 L211.1 18.4 L206.6 16.7 L202.0 15.0 L197.4 13.6 L192.8 12.2 L188.1 11.1 L183.4 10.1 L178.7 9.2 L173.9 8.5 L169.1 7.9 L164.3 7.5 L159.5 7.3 L154.6 7.2 L149.8 7.3 L145.0 7.5 L140.2 7.9 L135.4 8.5 L130.6 9.2 L125.9 10.1 L121.2 11.1 L116.5 12.2 L111.8 13.6 L107.3 15.0 L102.7 16.7 L98.2 18.4 L93.8 20.4 L89.4 22.4 L85.1 24.6 L80.9 27.0 L76.8 29.4 L72.7 32.1 L68.8 34.8 L64.9 37.7 L61.1 40.7 L57.4 43.8 L53.9 47.0 L50.4 50.4 L47.0 53.9 L43.8 57.4 L40.7 61.1 L37.7 64.9 L34.8 68.8 L32.1 72.7 L29.4 76.8 L27.0 80.9 L24.6 85.1 L22.4 89.4 L20.4 93.8 L18.4 98.2 L16.7 102.7 L15.0 107.3 L13.6 111.8 L12.2 116.5 L11.1 121.2 L10.1 125.9 L9.2 130.6 L8.5 135.4 L7.9 140.2 L7.5 145.0 L7.3 149.8 L7.2 154.6 L7.3 159.5 L7.5 164.3 L7.9 169.1 L8.5 173.9 L9.2 178.7 L10.1 183.4 L11.1 188.1 L12.2 192.8 L13.6 197.4 L15.0 202.0 L16.7 206.6 L18.4 211.1 L20.4 215.5 L22.4 219.8 L24.6 224.1 L27.0 228.4 L29.4 232.5 L32.1 236.5 L34.8 240.5 L37.7 244.4 L40.7 248.2 L43.8 251.8 L47.0 255.4 L50.4 258.9 L53.9 262.2 L57.4 265.5 L61.1 268.6 L64.9 271.6 L68.8 274.5 L72.7 277.2 L76.8 279.8 L80.9 282.3 L85.1 284.7 L89.4 286.9 L93.8 288.9 L98.2 290.8 L103.2 292.8 L206.1 292.8 L211.1 290.8 L215.5 288.9 L219.8 286.9 L224.1 284.7 L228.4 282.3 L232.5 279.8 L236.5 277.2 L240.5 274.5 L244.4 271.6 L248.2 268.6 L251.8 265.5 L255.4 262.2 L258.9 258.9 L262.2 255.4 L265.5 251.8 L268.6 248.2 L271.6 244.4 L274.5 240.5 L277.2 236.5 L279.8 232.5 L282.3 228.4 L284.7 224.1 L286.9 219.8 L288.9 215.5 L290.8 211.1 L292.6 206.6 L294.2 202.0 L295.7 197.4 L297.0 192.8 L298.2 188.1 L299.2 183.4 L300.1 178.7 L300.8 173.9 L301.4 169.1 L301.7 164.3 L302.0 159.5 L302.1 154.6 L302.0 149.8 L301.7 145.0 Z M96.8 282.3 L92.6 280.4 L88.5 278.3 L84.5 276.1 L80.6 273.7 L76.7 271.2 L73.0 268.6 L69.3 265.9 L65.7 263.0 L62.2 260.1 L58.8 257.0 L55.5 253.8 L52.3 250.5 L49.2 247.1 L46.3 243.6 L43.4 240.0 L40.7 236.3 L38.1 232.5 L35.6 228.7 L33.2 224.7 L31.0 220.7 L28.9 216.6 L26.9 212.5 L25.1 208.3 L23.4 204.0 L21.9 199.7 L20.5 195.3 L19.2 190.9 L18.1 186.5 L17.1 182.0 L16.3 177.5 L15.6 172.9 L15.1 168.4 L14.7 163.8 L14.5 159.2 L14.4 154.6 L14.5 150.1 L14.7 145.5 L15.1 140.9 L15.6 136.3 L16.3 131.8 L17.1 127.3 L18.1 122.8 L19.2 118.4 L20.5 113.9 L21.9 109.6 L23.4 105.3 L25.1 101.0 L26.9 96.8 L28.9 92.6 L31.0 88.5 L33.2 84.5 L35.6 80.6 L38.1 76.7 L40.7 73.0 L43.4 69.3 L46.3 65.7 L49.2 62.2 L52.3 58.8 L55.5 55.5 L58.8 52.3 L62.2 49.2 L65.7 46.3 L69.3 43.4 L73.0 40.7 L76.7 38.1 L80.6 35.6 L84.5 33.2 L88.5 31.0 L92.6 28.9 L96.8 26.9 L101.0 25.1 L105.3 23.4 L109.6 21.9 L113.9 20.5 L118.4 19.2 L122.8 18.1 L127.3 17.1 L131.8 16.3 L136.3 15.6 L140.9 15.1 L145.5 14.7 L150.1 14.5 L154.6 14.4 L159.2 14.5 L163.8 14.7 L168.4 15.1 L172.9 15.6 L177.5 16.3 L182.0 17.1 L186.5 18.1 L190.9 19.2 L195.3 20.5 L199.7 21.9 L204.0 23.4 L208.3 25.1 L212.5 26.9 L216.6 28.9 L220.7 31.0 L224.7 33.2 L228.7 35.6 L232.5 38.1 L236.3 40.7 L240.0 43.4 L243.6 46.3 L247.1 49.2 L250.5 52.3 L253.8 55.5 L257.0 58.8 L260.1 62.2 L263.0 65.7 L265.9 69.3 L268.6 73.0 L271.2 76.7 L273.7 80.6 L276.1 84.5 L278.3 88.5 L280.4 92.6 L282.3 96.8 L284.2 101.0 L285.9 105.3 L287.4 109.6 L288.8 113.9 L290.1 118.4 L291.2 122.8 L292.1 127.3 L293.0 131.8 L293.6 136.3 L294.2 140.9 L294.5 145.5 L294.8 150.1 L294.8 154.6 L294.8 159.2 L294.5 163.8 L294.2 168.4 L293.6 172.9 L293.0 177.5 L292.1 182.0 L291.2 186.5 L290.1 190.9 L288.8 195.3 L287.4 199.7 L285.9 204.0 L284.2 208.3 L282.3 212.5 L280.4 216.6 L278.3 220.7 L276.1 224.7 L273.7 228.7 L271.2 232.5 L268.6 236.3 L265.9 240.0 L263.0 243.6 L260.1 247.1 L257.0 250.5 L253.8 253.8 L250.5 257.0 L247.1 260.1 L243.6 263.0 L240.0 265.9 L236.3 268.6 L232.5 271.2 L228.7 273.7 L224.7 276.1 L220.7 278.3 L216.6 280.4 L212.5 282.3 L208.3 284.2 L204.8 285.6 L104.5 285.6 L101.0 284.2 Z`, mat: 'frost', level: 1, fin: 'frost' },
      { d: `M150.4 41.6 L138.0 42.0 L147.8 49.7 L144.3 61.6 L154.6 54.6 L164.9 61.6 L161.5 49.7 L171.3 42.0 L158.9 41.6 L154.6 29.9 Z`, mat: 'frost', level: 1, fin: 'frost' }
    ],
    face: { x: -0.008, y: 0.482, w: 0.734, h: 0.561, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/clearround.f6d9d617.webp", "box": [-6.0, -6.0, 315.33, 306.19]}, tile: "img/designs/tile-clearround.13379ead.webp",
  },
  facet: {
    name: "Faceted Round", group: 'Rounds', sheet: 'clear', base: 1.04,
    note: "A clear disc cut with facets round its edge, a frosted centre.",
    body: `M219.3 294.3 L256.4 270.4 L285.2 237.1 L303.6 197.0 L309.8 153.3 L303.6 109.7 L285.2 69.6 L256.4 36.3 L219.3 12.4 L177.0 0.0 L132.9 0.0 L90.6 12.4 L53.5 36.3 L24.6 69.6 L6.3 109.7 L0.0 153.3 L6.3 197.0 L24.6 237.1 L53.5 270.4 L90.6 294.3 L110.1 300.0 L199.7 300.0 Z`,
    layers: [
      { d: `M270.3 143.7 L270.0 139.9 L269.6 136.2 L269.0 132.4 L268.4 128.7 L267.6 125.0 L266.7 121.3 L265.6 117.7 L264.5 114.1 L263.2 110.5 L261.8 107.0 L260.3 103.5 L258.7 100.1 L256.9 96.7 L255.1 93.4 L253.1 90.2 L251.1 87.0 L248.9 83.9 L246.7 80.9 L244.3 77.9 L241.9 75.0 L239.3 72.2 L236.7 69.5 L234.0 66.9 L231.2 64.3 L228.3 61.9 L225.3 59.5 L222.3 57.3 L219.2 55.1 L216.0 53.0 L212.8 51.1 L209.4 49.3 L206.1 47.5 L202.7 45.9 L199.2 44.4 L195.7 43.0 L192.1 41.7 L188.5 40.6 L184.9 39.5 L181.2 38.6 L177.5 37.8 L173.8 37.1 L170.0 36.6 L166.3 36.2 L162.5 35.9 L158.7 35.7 L154.9 35.6 L151.1 35.7 L147.4 35.9 L143.6 36.2 L139.8 36.6 L136.1 37.1 L132.4 37.8 L128.7 38.6 L125.0 39.5 L121.3 40.6 L117.7 41.7 L114.2 43.0 L110.7 44.4 L107.2 45.9 L103.8 47.5 L100.4 49.3 L97.1 51.1 L93.8 53.0 L90.7 55.1 L87.5 57.3 L84.5 59.5 L81.5 61.9 L78.7 64.3 L75.8 66.9 L73.1 69.5 L70.5 72.2 L68.0 75.0 L65.5 77.9 L63.1 80.9 L60.9 83.9 L58.7 87.0 L56.7 90.2 L54.7 93.4 L52.9 96.7 L51.2 100.1 L49.6 103.5 L48.1 107.0 L46.7 110.5 L45.4 114.1 L44.2 117.7 L43.2 121.3 L42.3 125.0 L41.5 128.7 L40.8 132.4 L40.2 136.2 L39.8 139.9 L39.5 143.7 L39.3 147.5 L39.2 151.3 L39.3 155.1 L39.5 158.8 L39.8 162.6 L40.2 166.4 L40.8 170.1 L41.5 173.8 L42.3 177.5 L43.2 181.2 L44.2 184.9 L45.4 188.5 L46.7 192.0 L48.1 195.5 L49.6 199.0 L51.2 202.4 L52.9 205.8 L54.7 209.1 L56.7 212.4 L58.7 215.5 L60.9 218.7 L63.1 221.7 L65.5 224.7 L68.0 227.5 L70.5 230.4 L73.1 233.1 L75.8 235.7 L78.7 238.2 L81.5 240.7 L84.5 243.0 L87.5 245.3 L90.7 247.5 L93.8 249.5 L97.1 251.5 L100.4 253.3 L103.8 255.0 L107.2 256.6 L110.7 258.1 L114.2 259.5 L117.7 260.8 L121.3 262.0 L125.0 263.0 L128.7 263.9 L132.4 264.7 L136.1 265.4 L139.8 266.0 L143.6 266.4 L147.4 266.7 L151.1 266.9 L154.9 267.0 L158.7 266.9 L162.5 266.7 L166.3 266.4 L170.0 266.0 L173.8 265.4 L177.5 264.7 L181.2 263.9 L184.9 263.0 L188.5 262.0 L192.1 260.8 L195.7 259.5 L199.2 258.1 L202.7 256.6 L206.1 255.0 L209.4 253.3 L212.8 251.5 L216.0 249.5 L219.2 247.5 L222.3 245.3 L225.3 243.0 L228.3 240.7 L231.2 238.2 L234.0 235.7 L236.7 233.1 L239.3 230.4 L241.9 227.5 L244.3 224.7 L246.7 221.7 L248.9 218.7 L251.1 215.5 L253.1 212.4 L255.1 209.1 L256.9 205.8 L258.7 202.4 L260.3 199.0 L261.8 195.5 L263.2 192.0 L264.5 188.5 L265.6 184.9 L266.7 181.2 L267.6 177.5 L268.4 173.8 L269.0 170.1 L269.6 166.4 L270.0 162.6 L270.3 158.8 L270.5 155.1 L270.6 151.3 L270.5 147.5 Z`, mat: 'frost', level: 1, fin: 'frost' }
    ],
    face: { x: 0.0, y: 0.496, w: 0.635, h: 0.485, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/facet.6418f531.webp", "box": [-6.0, -6.0, 316.03, 306.19]}, tile: "img/designs/tile-facet.916e2e73.webp",
  },
  lionround: {
    name: "Onyx Round", group: 'Rounds', sheet: 'black', base: 1.04,
    note: "A black disc: a gold ring, a white centre and a small gold star.",
    body: `M309.2 149.6 L308.9 144.5 L308.5 139.5 L308.0 134.5 L307.2 129.4 L306.3 124.5 L305.2 119.5 L304.0 114.6 L302.6 109.7 L301.1 104.9 L299.4 100.2 L297.5 95.5 L295.5 90.8 L293.3 86.2 L291.0 81.7 L288.6 77.3 L286.0 73.0 L283.2 68.7 L280.3 64.6 L277.3 60.5 L274.2 56.5 L270.9 52.7 L267.5 48.9 L264.0 45.3 L260.3 41.8 L256.6 38.4 L252.7 35.1 L248.8 32.0 L244.7 28.9 L240.6 26.1 L236.3 23.3 L232.0 20.7 L227.5 18.3 L223.0 15.9 L218.5 13.8 L213.8 11.8 L209.1 9.9 L204.3 8.2 L199.5 6.7 L194.7 5.3 L189.8 4.0 L184.8 3.0 L179.8 2.1 L174.8 1.3 L169.8 0.7 L164.8 0.3 L159.7 0.1 L154.6 0.0 L149.6 0.1 L144.5 0.3 L139.5 0.7 L134.5 1.3 L129.4 2.1 L124.5 3.0 L119.5 4.0 L114.6 5.3 L109.7 6.7 L104.9 8.2 L100.2 9.9 L95.5 11.8 L90.8 13.8 L86.2 15.9 L81.7 18.3 L77.3 20.7 L73.0 23.3 L68.7 26.1 L64.6 28.9 L60.5 32.0 L56.5 35.1 L52.7 38.4 L48.9 41.8 L45.3 45.3 L41.8 48.9 L38.4 52.7 L35.1 56.5 L32.0 60.5 L28.9 64.6 L26.1 68.7 L23.3 73.0 L20.7 77.3 L18.3 81.7 L15.9 86.2 L13.8 90.8 L11.8 95.5 L9.9 100.2 L8.2 104.9 L6.7 109.7 L5.3 114.6 L4.0 119.5 L3.0 124.5 L2.1 129.4 L1.3 134.5 L0.7 139.5 L0.3 144.5 L0.1 149.6 L0.0 154.6 L0.1 159.7 L0.3 164.8 L0.7 169.8 L1.3 174.8 L2.1 179.8 L3.0 184.8 L4.0 189.8 L5.3 194.7 L6.7 199.5 L8.2 204.3 L9.9 209.1 L11.8 213.8 L13.8 218.5 L15.9 223.0 L18.3 227.5 L20.7 232.0 L23.3 236.3 L26.1 240.6 L28.9 244.7 L32.0 248.8 L35.1 252.7 L38.4 256.6 L41.8 260.3 L45.3 264.0 L48.9 267.5 L52.7 270.9 L56.5 274.2 L60.5 277.3 L64.6 280.3 L68.7 283.2 L73.0 286.0 L77.3 288.6 L81.7 291.0 L86.2 293.3 L90.8 295.5 L95.5 297.5 L101.9 300.0 L207.3 300.0 L213.8 297.5 L218.5 295.5 L223.0 293.3 L227.5 291.0 L232.0 288.6 L236.3 286.0 L240.6 283.2 L244.7 280.3 L248.8 277.3 L252.7 274.2 L256.6 270.9 L260.3 267.5 L264.0 264.0 L267.5 260.3 L270.9 256.6 L274.2 252.7 L277.3 248.8 L280.3 244.7 L283.2 240.6 L286.0 236.3 L288.6 232.0 L291.0 227.5 L293.3 223.0 L295.5 218.5 L297.5 213.8 L299.4 209.1 L301.1 204.3 L302.6 199.5 L304.0 194.7 L305.2 189.8 L306.3 184.8 L307.2 179.8 L308.0 174.8 L308.5 169.8 L308.9 164.8 L309.2 159.7 L309.3 154.6 Z`,
    layers: [
      { d: `M299.3 140.4 L298.8 135.7 L298.1 131.0 L297.2 126.3 L296.2 121.6 L295.0 117.0 L293.7 112.4 L292.3 107.9 L290.7 103.4 L288.9 99.0 L287.0 94.6 L285.0 90.3 L282.8 86.1 L280.5 82.0 L278.1 77.9 L275.5 73.9 L272.8 70.0 L270.0 66.1 L267.0 62.4 L263.9 58.8 L260.7 55.3 L257.4 51.9 L254.0 48.5 L250.5 45.4 L246.9 42.3 L243.1 39.3 L239.3 36.5 L235.4 33.8 L231.4 31.2 L227.3 28.8 L223.2 26.4 L218.9 24.3 L214.6 22.2 L210.3 20.3 L205.8 18.6 L201.4 17.0 L196.8 15.5 L192.3 14.2 L187.6 13.1 L183.0 12.1 L178.3 11.2 L173.6 10.5 L168.9 10.0 L164.1 9.6 L159.4 9.4 L154.6 9.3 L149.9 9.4 L145.1 9.6 L140.4 10.0 L135.7 10.5 L131.0 11.2 L126.3 12.1 L121.6 13.1 L117.0 14.2 L112.4 15.5 L107.9 17.0 L103.4 18.6 L99.0 20.3 L94.6 22.2 L90.3 24.3 L86.1 26.4 L82.0 28.8 L77.9 31.2 L73.9 33.8 L70.0 36.5 L66.1 39.3 L62.4 42.3 L58.8 45.4 L55.3 48.5 L51.9 51.9 L48.5 55.3 L45.4 58.8 L42.3 62.4 L39.3 66.1 L36.5 70.0 L33.8 73.9 L31.2 77.9 L28.8 82.0 L26.4 86.1 L24.3 90.3 L22.2 94.6 L20.3 99.0 L18.6 103.4 L17.0 107.9 L15.5 112.4 L14.2 117.0 L13.1 121.6 L12.1 126.3 L11.2 131.0 L10.5 135.7 L10.0 140.4 L9.6 145.1 L9.4 149.9 L9.3 154.6 L9.4 159.4 L9.6 164.1 L10.0 168.9 L10.5 173.6 L11.2 178.3 L12.1 183.0 L13.1 187.6 L14.2 192.3 L15.5 196.8 L17.0 201.4 L18.6 205.8 L20.3 210.3 L22.2 214.6 L24.3 218.9 L26.4 223.2 L28.8 227.3 L31.2 231.4 L33.8 235.4 L36.5 239.3 L39.3 243.1 L42.3 246.9 L45.4 250.5 L48.5 254.0 L51.9 257.4 L55.3 260.7 L58.8 263.9 L62.4 267.0 L66.1 270.0 L70.0 272.8 L73.9 275.5 L77.9 278.1 L82.0 280.5 L86.1 282.8 L90.3 285.0 L94.6 287.0 L99.0 288.9 L103.5 290.7 L205.7 290.7 L210.3 288.9 L214.6 287.0 L218.9 285.0 L223.2 282.8 L227.3 280.5 L231.4 278.1 L235.4 275.5 L239.3 272.8 L243.1 270.0 L246.9 267.0 L250.5 263.9 L254.0 260.7 L257.4 257.4 L260.7 254.0 L263.9 250.5 L267.0 246.9 L270.0 243.1 L272.8 239.3 L275.5 235.4 L278.1 231.4 L280.5 227.3 L282.8 223.2 L285.0 218.9 L287.0 214.6 L288.9 210.3 L290.7 205.8 L292.3 201.4 L293.7 196.8 L295.0 192.3 L296.2 187.6 L297.2 183.0 L298.1 178.3 L298.8 173.6 L299.3 168.9 L299.7 164.1 L299.9 159.4 L300.0 154.6 L299.9 149.9 L299.7 145.1 Z M96.4 283.3 L92.2 281.3 L88.1 279.2 L84.0 277.0 L80.1 274.6 L76.2 272.1 L72.4 269.4 L68.7 266.7 L65.0 263.8 L61.5 260.8 L58.1 257.7 L54.8 254.5 L51.6 251.2 L48.5 247.8 L45.5 244.2 L42.6 240.6 L39.8 236.9 L37.2 233.1 L34.7 229.2 L32.3 225.3 L30.1 221.2 L28.0 217.1 L26.0 212.9 L24.2 208.7 L22.5 204.4 L20.9 200.0 L19.5 195.6 L18.2 191.2 L17.1 186.7 L16.1 182.2 L15.3 177.6 L14.6 173.1 L14.1 168.5 L13.7 163.9 L13.5 159.3 L13.4 154.6 L13.5 150.0 L13.7 145.4 L14.1 140.8 L14.6 136.2 L15.3 131.6 L16.1 127.1 L17.1 122.6 L18.2 118.1 L19.5 113.6 L20.9 109.2 L22.5 104.9 L24.2 100.6 L26.0 96.4 L28.0 92.2 L30.1 88.1 L32.3 84.0 L34.7 80.1 L37.2 76.2 L39.8 72.4 L42.6 68.7 L45.5 65.0 L48.5 61.5 L51.6 58.1 L54.8 54.8 L58.1 51.6 L61.5 48.5 L65.0 45.5 L68.7 42.6 L72.4 39.8 L76.2 37.2 L80.1 34.7 L84.0 32.3 L88.1 30.1 L92.2 28.0 L96.4 26.0 L100.6 24.2 L104.9 22.5 L109.2 20.9 L113.6 19.5 L118.1 18.2 L122.6 17.1 L127.1 16.1 L131.6 15.3 L136.2 14.6 L140.8 14.1 L145.4 13.7 L150.0 13.5 L154.6 13.4 L159.3 13.5 L163.9 13.7 L168.5 14.1 L173.1 14.6 L177.6 15.3 L182.2 16.1 L186.7 17.1 L191.2 18.2 L195.6 19.5 L200.0 20.9 L204.4 22.5 L208.7 24.2 L212.9 26.0 L217.1 28.0 L221.2 30.1 L225.3 32.3 L229.2 34.7 L233.1 37.2 L236.9 39.8 L240.6 42.6 L244.2 45.5 L247.8 48.5 L251.2 51.6 L254.5 54.8 L257.7 58.1 L260.8 61.5 L263.8 65.0 L266.7 68.7 L269.4 72.4 L272.1 76.2 L274.6 80.1 L277.0 84.0 L279.2 88.1 L281.3 92.2 L283.3 96.4 L285.1 100.6 L286.8 104.9 L288.4 109.2 L289.8 113.6 L291.1 118.1 L292.2 122.6 L293.2 127.1 L294.0 131.6 L294.7 136.2 L295.2 140.8 L295.6 145.4 L295.8 150.0 L295.9 154.6 L295.8 159.3 L295.6 163.9 L295.2 168.5 L294.7 173.1 L294.0 177.6 L293.2 182.2 L292.2 186.7 L291.1 191.2 L289.8 195.6 L288.4 200.0 L286.8 204.4 L285.1 208.7 L283.3 212.9 L281.3 217.1 L279.2 221.2 L277.0 225.3 L274.6 229.2 L272.1 233.1 L269.4 236.9 L266.7 240.6 L263.8 244.2 L260.8 247.8 L257.7 251.2 L254.5 254.5 L251.2 257.7 L247.8 260.8 L244.2 263.8 L240.6 266.7 L236.9 269.4 L233.1 272.1 L229.2 274.6 L225.3 277.0 L221.2 279.2 L217.1 281.3 L212.9 283.3 L208.7 285.1 L205.0 286.6 L104.3 286.6 L100.6 285.1 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M203.4 278.4 L209.5 275.8 L213.5 273.9 L217.3 271.9 L221.1 269.8 L224.9 267.6 L228.5 265.2 L232.1 262.7 L235.6 260.1 L239.0 257.4 L242.3 254.6 L245.5 251.7 L248.7 248.7 L251.7 245.5 L254.6 242.3 L257.4 239.0 L260.1 235.6 L262.7 232.1 L265.2 228.5 L267.6 224.9 L269.8 221.1 L271.9 217.3 L273.9 213.5 L275.8 209.5 L277.5 205.5 L279.1 201.5 L280.6 197.4 L281.9 193.2 L283.1 189.1 L284.2 184.8 L285.1 180.6 L285.8 176.3 L286.5 172.0 L287.0 167.7 L287.3 163.3 L287.6 159.0 L287.6 154.6 L287.6 150.3 L287.3 145.9 L287.0 141.6 L286.5 137.3 L285.8 133.0 L285.1 128.7 L284.2 124.4 L283.1 120.2 L281.9 116.0 L280.6 111.9 L279.1 107.8 L277.5 103.7 L275.8 99.8 L273.9 95.8 L271.9 91.9 L269.8 88.1 L267.6 84.4 L265.2 80.8 L262.7 77.2 L260.1 73.7 L257.4 70.3 L254.6 67.0 L251.7 63.7 L248.7 60.6 L245.5 57.6 L242.3 54.7 L239.0 51.8 L235.6 49.1 L232.1 46.5 L228.5 44.1 L224.9 41.7 L221.1 39.5 L217.3 37.4 L213.5 35.4 L209.5 33.5 L205.5 31.8 L201.5 30.2 L197.4 28.7 L193.2 27.4 L189.1 26.2 L184.8 25.1 L180.6 24.2 L176.3 23.4 L172.0 22.8 L167.7 22.3 L163.3 21.9 L159.0 21.7 L154.6 21.7 L150.3 21.7 L145.9 21.9 L141.6 22.3 L137.3 22.8 L133.0 23.4 L128.7 24.2 L124.4 25.1 L120.2 26.2 L116.0 27.4 L111.9 28.7 L107.8 30.2 L103.7 31.8 L99.8 33.5 L95.8 35.4 L91.9 37.4 L88.1 39.5 L84.4 41.7 L80.8 44.1 L77.2 46.5 L73.7 49.1 L70.3 51.8 L67.0 54.7 L63.7 57.6 L60.6 60.6 L57.6 63.7 L54.7 67.0 L51.8 70.3 L49.1 73.7 L46.5 77.2 L44.1 80.8 L41.7 84.4 L39.5 88.1 L37.4 91.9 L35.4 95.8 L33.5 99.8 L31.8 103.7 L30.2 107.8 L28.7 111.9 L27.4 116.0 L26.2 120.2 L25.1 124.4 L24.2 128.7 L23.4 133.0 L22.8 137.3 L22.3 141.6 L21.9 145.9 L21.7 150.3 L21.7 154.6 L21.7 159.0 L21.9 163.3 L22.3 167.7 L22.8 172.0 L23.4 176.3 L24.2 180.6 L25.1 184.8 L26.2 189.1 L27.4 193.2 L28.7 197.4 L30.2 201.5 L31.8 205.5 L33.5 209.5 L35.4 213.5 L37.4 217.3 L39.5 221.1 L41.7 224.9 L44.1 228.5 L46.5 232.1 L49.1 235.6 L51.8 239.0 L54.7 242.3 L57.6 245.5 L60.6 248.7 L63.7 251.7 L67.0 254.6 L70.3 257.4 L73.7 260.1 L77.2 262.7 L80.8 265.2 L84.4 267.6 L88.1 269.8 L91.9 271.9 L95.8 273.9 L99.8 275.8 L105.9 278.4 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M151.0 250.7 L140.9 251.2 L148.8 257.6 L146.2 267.3 L154.6 261.9 L163.1 267.3 L160.5 257.6 L168.4 251.2 L158.3 250.7 L154.6 241.2 Z`, mat: 'gold', level: 2, fin: 'foil' }
    ],
    face: { x: 0.01, y: 0.498, w: 0.708, h: 0.541, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/lionround.7ea38f54.webp", "box": [-6.0, -6.0, 315.33, 306.19]}, tile: "img/designs/tile-lionround.fb289324.webp",
  },
  oval: {
    name: "Oval", group: 'Rounds', sheet: 'clear', base: 1.04,
    note: "A clear oval with a black crescent along its left side.",
    body: `M249.9 151.1 L249.7 146.0 L249.4 140.9 L248.9 135.9 L248.3 130.8 L247.6 125.8 L246.7 120.8 L245.7 115.8 L244.6 110.9 L243.4 106.0 L242.0 101.2 L240.5 96.5 L238.9 91.8 L237.1 87.1 L235.2 82.6 L233.3 78.1 L231.2 73.7 L228.9 69.4 L226.6 65.2 L224.2 61.1 L221.6 57.1 L219.0 53.2 L216.2 49.4 L213.4 45.8 L210.4 42.2 L207.4 38.8 L204.3 35.5 L201.1 32.3 L197.8 29.2 L194.4 26.3 L191.0 23.6 L187.5 20.9 L183.9 18.4 L180.3 16.1 L176.6 13.9 L172.8 11.9 L169.0 10.0 L165.2 8.3 L161.3 6.7 L157.4 5.3 L153.4 4.1 L149.4 3.0 L145.4 2.1 L141.3 1.3 L137.3 0.8 L133.2 0.3 L129.1 0.1 L125.0 0.0 L120.9 0.1 L116.8 0.3 L112.7 0.8 L108.7 1.3 L104.6 2.1 L100.6 3.0 L96.6 4.1 L92.6 5.3 L88.7 6.7 L84.8 8.3 L81.0 10.0 L77.2 11.9 L73.4 13.9 L69.7 16.1 L66.1 18.4 L62.5 20.9 L59.0 23.6 L55.6 26.3 L52.2 29.2 L48.9 32.3 L45.7 35.5 L42.6 38.8 L39.6 42.2 L36.6 45.8 L33.8 49.4 L31.0 53.2 L28.4 57.1 L25.8 61.1 L23.4 65.2 L21.1 69.4 L18.8 73.7 L16.7 78.1 L14.8 82.6 L12.9 87.1 L11.1 91.8 L9.5 96.5 L8.0 101.2 L6.6 106.0 L5.4 110.9 L4.3 115.8 L3.3 120.8 L2.4 125.8 L1.7 130.8 L1.1 135.9 L0.6 140.9 L0.3 146.0 L0.1 151.1 L0.0 156.2 L0.1 161.4 L0.3 166.5 L0.6 171.6 L1.1 176.6 L1.7 181.7 L2.4 186.7 L3.3 191.7 L4.3 196.7 L5.4 201.6 L6.6 206.5 L8.0 211.3 L9.5 216.0 L11.1 220.7 L12.9 225.4 L14.8 229.9 L16.7 234.4 L18.8 238.8 L21.1 243.1 L23.4 247.3 L25.8 251.4 L28.4 255.4 L31.0 259.3 L33.8 263.1 L36.6 266.7 L39.6 270.3 L42.6 273.7 L45.7 277.0 L48.9 280.2 L52.2 283.3 L55.6 286.2 L59.0 288.9 L62.5 291.6 L66.1 294.1 L69.7 296.4 L73.4 298.6 L76.0 300.0 L174.0 300.0 L176.6 298.6 L180.3 296.4 L183.9 294.1 L187.5 291.6 L191.0 288.9 L194.4 286.2 L197.8 283.3 L201.1 280.2 L204.3 277.0 L207.4 273.7 L210.4 270.3 L213.4 266.7 L216.2 263.1 L219.0 259.3 L221.6 255.4 L224.2 251.4 L226.6 247.3 L228.9 243.1 L231.2 238.8 L233.3 234.4 L235.2 229.9 L237.1 225.4 L238.9 220.7 L240.5 216.0 L242.0 211.3 L243.4 206.5 L244.6 201.6 L245.7 196.7 L246.7 191.7 L247.6 186.7 L248.3 181.7 L248.9 176.6 L249.4 171.6 L249.7 166.5 L249.9 161.4 L250.0 156.2 Z`,
    layers: [
      { d: `M112.7 0.8 L108.7 1.3 L104.6 2.1 L100.6 3.0 L96.6 4.1 L92.6 5.3 L88.7 6.7 L84.8 8.3 L81.0 10.0 L77.2 11.9 L73.4 13.9 L69.7 16.1 L66.1 18.4 L62.5 20.9 L59.0 23.6 L55.6 26.3 L52.2 29.2 L48.9 32.3 L45.7 35.5 L42.6 38.8 L39.6 42.2 L36.6 45.8 L33.8 49.4 L31.0 53.2 L28.4 57.1 L25.8 61.1 L23.4 65.2 L21.1 69.4 L18.8 73.7 L16.7 78.1 L14.8 82.6 L12.9 87.1 L11.1 91.8 L9.5 96.5 L8.0 101.2 L6.6 106.0 L5.4 110.9 L4.3 115.8 L3.3 120.8 L2.4 125.8 L1.7 130.8 L1.1 135.9 L0.6 140.9 L0.3 146.0 L0.1 151.1 L0.0 156.2 L0.1 161.4 L0.3 166.5 L0.6 171.6 L1.1 176.6 L1.7 181.7 L2.4 186.7 L3.3 191.7 L4.3 196.7 L5.4 201.6 L6.6 206.5 L8.0 211.3 L9.5 216.0 L11.1 220.7 L12.9 225.4 L14.8 229.9 L16.7 234.4 L18.8 238.8 L21.1 243.1 L23.4 247.3 L25.8 251.4 L28.4 255.4 L31.0 259.3 L33.8 263.1 L36.6 266.7 L39.6 270.3 L42.6 273.7 L45.7 277.0 L48.9 280.2 L52.2 283.3 L55.6 286.2 L59.0 288.9 L62.5 291.6 L66.1 294.1 L69.7 296.4 L73.4 298.6 L76.0 300.0 L100.1 300.0 L94.7 295.1 L91.4 291.8 L88.1 288.3 L85.0 284.7 L81.9 280.9 L78.9 277.0 L76.0 273.0 L73.2 268.9 L70.5 264.6 L67.9 260.2 L65.5 255.8 L63.1 251.2 L60.8 246.5 L58.7 241.7 L56.7 236.8 L54.8 231.8 L53.0 226.8 L51.3 221.6 L49.8 216.4 L48.4 211.2 L47.1 205.8 L46.0 200.5 L45.0 195.0 L44.1 189.6 L43.4 184.1 L42.8 178.5 L42.3 173.0 L41.9 167.4 L41.7 161.8 L41.7 156.2 L41.7 150.7 L41.9 145.1 L42.3 139.5 L42.8 134.0 L43.4 128.4 L44.1 122.9 L45.0 117.5 L46.0 112.0 L47.1 106.7 L48.4 101.3 L49.8 96.1 L51.3 90.9 L53.0 85.7 L54.8 80.7 L56.7 75.7 L58.7 70.8 L60.8 66.0 L63.1 61.3 L65.5 56.7 L67.9 52.3 L70.5 47.9 L73.2 43.6 L76.0 39.5 L78.9 35.5 L81.9 31.6 L85.0 27.8 L88.1 24.2 L91.4 20.7 L94.7 17.4 L98.1 14.2 L101.6 11.2 L105.2 8.3 L108.8 5.6 L112.5 3.0 L116.8 0.3 Z`, mat: 'black', level: 1, fin: 'gloss' },
      { d: `M242.7 136.5 L242.1 131.6 L241.4 126.7 L240.6 121.9 L239.6 117.1 L238.5 112.4 L237.3 107.7 L236.0 103.0 L234.6 98.4 L233.0 93.9 L231.3 89.4 L229.5 85.1 L227.6 80.7 L225.6 76.5 L223.4 72.4 L221.2 68.3 L218.8 64.4 L216.4 60.6 L213.9 56.8 L211.2 53.2 L208.5 49.7 L205.7 46.3 L202.8 43.0 L199.8 39.8 L196.8 36.8 L193.6 33.9 L190.4 31.1 L187.2 28.5 L183.8 26.0 L180.5 23.6 L177.0 21.4 L173.5 19.4 L170.0 17.4 L166.4 15.7 L162.7 14.0 L159.1 12.6 L155.4 11.3 L151.6 10.1 L147.9 9.1 L144.1 8.2 L140.3 7.5 L136.5 7.0 L132.7 6.6 L128.8 6.3 L125.0 6.3 L121.2 6.3 L117.3 6.6 L113.5 7.0 L109.8 7.5 L106.5 10.0 L104.2 11.8 L110.2 10.6 L113.9 10.1 L117.6 9.7 L121.3 9.5 L125.0 9.4 L128.7 9.5 L132.4 9.7 L136.1 10.1 L139.8 10.6 L143.5 11.3 L147.1 12.1 L150.8 13.1 L154.4 14.2 L158.0 15.5 L161.5 16.9 L165.0 18.5 L168.5 20.2 L172.0 22.1 L175.4 24.1 L178.7 26.2 L182.0 28.5 L185.3 31.0 L188.4 33.5 L191.6 36.2 L194.6 39.1 L197.6 42.0 L200.5 45.1 L203.3 48.3 L206.1 51.6 L208.7 55.1 L211.3 58.6 L213.8 62.3 L216.2 66.0 L218.5 69.9 L220.7 73.9 L222.8 77.9 L224.7 82.1 L226.6 86.3 L228.4 90.6 L230.0 95.0 L231.6 99.4 L233.0 103.9 L234.3 108.5 L235.5 113.1 L236.6 117.8 L237.5 122.5 L238.3 127.2 L239.0 132.0 L239.6 136.8 L240.1 141.7 L240.4 146.5 L240.6 151.4 L240.6 156.2 L240.6 161.1 L240.4 166.0 L240.1 170.8 L239.6 175.7 L239.0 180.5 L238.3 185.3 L237.5 190.0 L236.6 194.7 L235.5 199.4 L234.3 204.0 L233.0 208.6 L231.6 213.1 L230.0 217.5 L228.4 221.9 L226.6 226.2 L224.7 230.4 L222.8 234.6 L220.7 238.6 L218.5 242.6 L216.2 246.5 L213.8 250.2 L211.3 253.9 L208.7 257.4 L206.1 260.9 L203.3 264.2 L200.5 267.4 L197.6 270.5 L194.6 273.4 L191.6 276.3 L188.4 279.0 L185.3 281.5 L182.0 284.0 L178.7 286.3 L175.4 288.4 L171.6 290.6 L93.2 290.6 L96.2 293.6 L96.3 293.8 L172.4 293.8 L177.0 291.1 L180.5 288.9 L183.8 286.5 L187.2 284.0 L190.4 281.4 L193.6 278.6 L196.8 275.7 L199.8 272.7 L202.8 269.5 L205.7 266.2 L208.5 262.8 L211.2 259.3 L213.9 255.7 L216.4 251.9 L218.8 248.1 L221.2 244.2 L223.4 240.1 L225.6 236.0 L227.6 231.8 L229.5 227.4 L231.3 223.1 L233.0 218.6 L234.6 214.1 L236.0 209.5 L237.3 204.8 L238.5 200.1 L239.6 195.4 L240.6 190.6 L241.4 185.8 L242.1 180.9 L242.7 176.0 L243.2 171.1 L243.5 166.1 L243.7 161.2 L243.7 156.2 L243.7 151.3 L243.5 146.4 L243.2 141.4 Z`, mat: 'frost', level: 1, fin: 'frost' }
    ],
    face: { x: 0.07, y: 0.5, w: 0.579, h: 0.52, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/oval.dad1cd09.webp", "box": [-6.0, -6.0, 256.03, 306.19]}, tile: "img/designs/tile-oval.68ecbc41.webp",
  },
  gem: {
    name: "Gem", group: 'Rounds', sheet: 'wine', base: 1.04,
    note: "A deep red gem with a waved crown: a faceted red panel framed in gold, and a gold medallion set with a garnet and a star.",
    body: `M205.8 300.0 L206.8 295.8 L209.9 295.9 L213.0 295.8 L217.6 295.3 L220.6 294.7 L223.6 293.9 L227.9 292.3 L230.8 291.0 L234.8 288.8 L237.4 287.1 L241.0 284.2 L244.3 281.0 L246.4 278.6 L249.1 274.9 L251.5 271.0 L253.5 266.8 L255.0 262.4 L256.2 257.9 L256.9 253.3 L257.1 250.2 L257.0 245.6 L256.7 242.5 L255.8 238.0 L254.6 233.5 L253.5 230.6 L251.5 226.5 L250.0 223.8 L247.3 220.0 L245.4 217.6 L243.3 215.3 L239.8 212.2 L236.1 209.5 L233.5 207.8 L230.8 206.4 L227.8 205.0 L229.6 194.5 L231.2 183.6 L232.5 172.1 L233.9 157.6 L235.5 137.0 L237.7 101.4 L238.5 86.1 L238.9 74.1 L239.1 62.6 L238.9 54.6 L237.9 38.0 L237.3 31.8 L236.5 25.9 L235.5 21.9 L234.2 18.1 L233.1 15.9 L232.5 14.8 L231.3 13.1 L229.9 11.4 L228.5 9.8 L226.9 8.3 L225.2 6.9 L222.6 5.0 L220.7 3.8 L218.8 2.8 L216.9 2.0 L214.9 1.2 L212.9 0.7 L210.8 0.2 L209.7 0.1 L207.3 0.0 L203.6 0.2 L201.0 0.6 L198.4 1.2 L193.0 2.6 L186.4 4.8 L181.2 6.6 L178.4 7.6 L175.7 8.9 L171.6 11.1 L162.1 16.7 L158.0 19.0 L153.9 21.0 L149.7 22.6 L147.0 23.4 L142.9 24.3 L138.8 25.1 L136.0 25.6 L130.4 26.2 L127.7 26.3 L124.9 26.3 L120.8 26.0 L116.8 25.4 L114.2 24.7 L111.5 23.7 L109.0 22.4 L106.4 20.8 L102.7 18.2 L94.0 11.7 L90.1 9.2 L87.5 7.8 L86.1 7.1 L83.3 6.1 L77.3 4.1 L71.0 2.4 L66.2 1.4 L63.0 0.8 L59.8 0.4 L55.1 0.1 L50.6 0.2 L46.6 0.6 L41.6 1.6 L36.7 3.1 L34.4 4.0 L32.0 5.0 L29.8 6.2 L27.7 7.4 L25.6 8.8 L23.7 10.3 L21.1 12.7 L20.3 13.7 L18.7 15.8 L17.3 18.1 L16.1 20.5 L14.4 24.4 L12.6 30.1 L11.1 36.1 L7.8 49.9 L6.6 56.6 L5.1 66.3 L4.2 73.8 L3.2 84.1 L2.2 97.2 L1.1 113.7 L0.5 125.5 L0.2 137.5 L0.0 149.7 L0.0 158.8 L0.3 170.9 L0.8 179.9 L1.4 189.0 L2.4 201.3 L3.4 210.5 L4.8 222.7 L6.1 231.6 L7.9 243.2 L9.2 251.0 L10.6 257.8 L12.0 264.3 L13.6 270.7 L19.0 291.6 L21.1 300.0 Z`,
    layers: [
      { d: `M29.5 287.0 L30.2 287.9 L30.7 288.2 L31.7 288.7 L32.3 288.7 L154.4 288.7 L155.5 288.5 L156.1 288.2 L156.9 287.4 L157.4 286.3 L157.4 285.1 L157.2 284.5 L153.9 278.9 L152.1 275.2 L150.3 271.0 L148.9 266.9 L147.9 263.1 L147.1 259.0 L146.6 254.9 L146.3 250.5 L146.4 244.8 L146.8 240.7 L147.5 236.4 L148.5 232.2 L149.7 228.2 L151.2 224.1 L153.0 220.3 L155.7 215.4 L158.1 211.7 L160.7 208.4 L163.5 205.2 L166.6 202.1 L169.6 199.5 L173.1 196.8 L177.8 193.8 L181.5 191.8 L185.6 189.9 L189.7 188.4 L195.2 186.8 L199.3 186.0 L203.6 185.4 L207.7 185.1 L212.0 185.1 L216.5 185.4 L217.7 185.4 L218.2 185.1 L219.2 184.4 L219.5 183.9 L219.9 182.8 L221.3 170.9 L222.4 159.5 L223.4 147.9 L224.4 133.3 L226.6 97.7 L227.2 85.6 L227.7 70.9 L227.8 60.1 L227.5 52.8 L226.4 35.8 L225.8 30.4 L225.0 26.0 L224.4 24.2 L223.9 22.7 L223.3 21.5 L222.6 20.3 L221.3 18.7 L219.9 17.2 L218.8 16.2 L217.0 14.8 L215.1 13.6 L213.2 12.7 L210.8 11.8 L209.1 11.4 L207.3 11.3 L205.0 11.4 L203.0 11.8 L199.8 12.4 L196.3 13.4 L191.3 15.0 L184.9 17.2 L181.8 18.5 L177.2 20.9 L167.8 26.5 L163.2 29.0 L158.6 31.2 L154.8 32.8 L152.9 33.4 L149.7 34.3 L145.4 35.3 L142.2 36.0 L135.9 37.0 L132.7 37.3 L129.4 37.5 L126.1 37.6 L123.1 37.5 L118.1 37.0 L116.0 36.7 L113.0 36.0 L111.0 35.5 L109.0 34.8 L107.1 34.1 L105.0 33.0 L103.2 32.1 L100.4 30.4 L96.1 27.4 L87.5 20.9 L84.4 19.0 L82.5 17.9 L80.8 17.2 L78.2 16.3 L72.6 14.5 L66.9 13.1 L61.4 12.0 L56.0 11.4 L53.6 11.4 L51.4 11.4 L49.3 11.6 L47.3 11.9 L44.4 12.6 L42.4 13.1 L39.6 14.1 L37.8 14.8 L36.0 15.6 L33.7 16.9 L32.2 17.9 L30.4 19.4 L29.0 20.9 L28.1 22.1 L26.7 24.4 L25.9 26.3 L25.1 28.3 L23.9 31.9 L22.4 37.3 L19.3 50.1 L18.5 54.2 L17.3 60.8 L16.0 70.1 L15.2 77.5 L14.2 87.7 L13.2 100.6 L12.4 114.4 L11.8 126.0 L11.5 134.8 L11.3 146.7 L11.3 155.6 L11.4 164.6 L11.7 173.4 L12.2 182.2 L12.8 191.2 L13.6 200.2 L14.6 209.3 L15.6 218.3 L16.8 227.1 L18.1 235.7 L19.5 244.0 L20.3 249.0 L21.6 255.4 L24.5 268.0 Z`, mat: 'red', level: 1, fin: 'facets' },
      { d: `M24.9 287.6 L25.6 289.3 L26.4 290.5 L27.1 291.3 L28.2 292.1 L29.9 292.9 L30.9 293.2 L32.3 293.3 L154.4 293.3 L156.3 293.1 L157.3 292.8 L158.2 292.3 L159.8 291.1 L160.7 289.9 L161.5 288.6 L161.9 287.2 L162.1 285.7 L161.9 284.2 L161.3 282.3 L158.0 276.7 L156.2 273.1 L154.7 269.6 L153.5 265.9 L152.4 262.1 L151.7 258.1 L151.2 254.3 L150.9 248.9 L151.0 244.9 L151.4 241.0 L152.0 237.1 L153.0 233.2 L154.0 229.7 L155.5 226.0 L157.1 222.4 L159.7 217.7 L161.9 214.4 L164.2 211.3 L166.9 208.3 L169.6 205.6 L172.5 203.1 L175.6 200.7 L178.8 198.6 L182.3 196.6 L185.7 194.9 L190.7 192.9 L194.7 191.7 L198.6 190.8 L202.2 190.2 L206.2 189.8 L211.6 189.7 L217.0 190.1 L218.9 189.8 L220.7 189.0 L221.6 188.5 L222.7 187.4 L223.7 185.8 L224.1 184.9 L224.4 183.8 L225.6 174.2 L227.0 159.9 L228.2 145.4 L229.2 130.7 L231.2 98.0 L232.0 82.8 L232.4 68.2 L232.3 57.5 L232.1 52.5 L230.9 34.0 L230.2 28.4 L229.7 26.0 L229.2 23.9 L228.5 21.8 L227.7 20.0 L226.9 18.4 L225.9 17.1 L224.8 15.6 L223.1 13.9 L221.7 12.6 L219.7 11.1 L217.4 9.6 L215.0 8.4 L212.2 7.4 L209.9 6.9 L207.5 6.7 L205.2 6.8 L202.2 7.2 L198.8 7.9 L195.0 9.0 L189.9 10.6 L182.3 13.3 L179.9 14.3 L174.9 16.9 L165.5 22.5 L161.1 24.9 L156.7 27.0 L153.3 28.4 L148.6 29.8 L141.4 31.5 L135.4 32.4 L129.4 32.9 L124.6 32.9 L119.9 32.6 L115.3 31.8 L112.5 31.1 L110.7 30.5 L107.1 28.9 L102.9 26.5 L98.8 23.6 L90.1 17.1 L86.9 15.0 L84.4 13.7 L82.4 12.8 L79.6 11.9 L72.5 9.7 L66.4 8.2 L60.5 7.2 L57.6 6.9 L54.9 6.8 L52.3 6.8 L49.9 6.9 L45.3 7.6 L42.2 8.3 L39.9 9.0 L37.0 10.1 L34.9 11.1 L32.9 12.1 L30.5 13.5 L28.7 14.9 L26.8 16.5 L25.4 17.9 L24.3 19.4 L22.6 22.3 L21.1 25.6 L19.8 29.3 L18.3 34.7 L14.8 49.1 L13.9 53.3 L12.8 60.0 L11.7 67.1 L10.8 74.5 L9.8 84.7 L8.8 97.7 L7.9 111.2 L7.3 122.8 L7.0 131.7 L6.7 143.7 L6.7 152.7 L6.8 161.7 L7.0 170.6 L7.4 179.5 L8.0 188.5 L8.8 197.6 L9.7 206.8 L10.7 215.8 L11.8 224.8 L13.1 233.6 L14.4 242.1 L15.8 249.8 L17.1 256.4 L20.1 269.1 Z M26.9 287.3 L21.0 264.5 L19.6 258.1 L18.2 251.6 L16.9 244.5 L15.6 236.1 L14.3 227.5 L13.1 218.6 L12.0 209.6 L11.1 200.5 L10.3 191.4 L9.6 182.4 L9.0 167.6 L8.8 158.7 L8.7 149.7 L8.8 140.7 L9.1 128.8 L9.5 120.0 L10.1 108.5 L11.3 92.7 L12.1 82.3 L13.2 72.3 L14.1 65.0 L15.2 58.1 L16.4 51.7 L19.2 39.7 L20.6 33.8 L22.2 28.7 L23.5 25.3 L24.9 22.4 L26.4 20.1 L27.5 18.7 L28.8 17.4 L30.7 15.9 L32.4 14.7 L34.8 13.4 L36.7 12.5 L38.7 11.6 L41.6 10.7 L43.8 10.1 L46.8 9.4 L49.0 9.1 L51.2 8.9 L53.6 8.8 L56.1 8.9 L58.8 9.1 L61.7 9.5 L67.5 10.6 L73.3 12.0 L79.1 13.8 L81.7 14.8 L83.6 15.6 L85.8 16.8 L89.0 18.8 L97.6 25.3 L101.8 28.2 L104.5 29.9 L106.1 30.8 L109.9 32.4 L113.6 33.6 L118.4 34.5 L123.2 34.9 L126.1 35.0 L129.3 34.9 L132.5 34.8 L135.6 34.4 L141.7 33.5 L149.1 31.8 L152.1 31.0 L154.0 30.4 L157.6 28.9 L162.2 26.6 L166.5 24.2 L175.9 18.7 L180.8 16.1 L183.0 15.2 L190.5 12.6 L195.5 11.0 L199.2 9.9 L202.5 9.2 L204.7 8.9 L207.3 8.7 L209.4 8.9 L211.6 9.3 L214.2 10.3 L216.5 11.4 L218.6 12.8 L220.4 14.2 L221.7 15.4 L223.3 17.0 L224.6 18.8 L225.5 20.2 L226.2 21.7 L226.9 23.4 L227.4 25.2 L227.9 27.5 L228.3 30.0 L229.0 35.6 L230.1 52.6 L230.3 57.5 L230.3 68.2 L229.9 82.7 L229.1 97.9 L227.2 130.6 L226.2 145.2 L225.0 159.7 L223.9 171.2 L222.4 183.4 L222.2 184.2 L221.9 185.0 L221.1 186.1 L220.1 187.0 L219.4 187.4 L218.4 187.8 L217.0 188.0 L211.9 187.7 L207.6 187.7 L202.2 188.2 L198.2 188.8 L194.0 189.8 L190.0 191.0 L184.9 193.0 L181.3 194.8 L177.7 196.8 L174.4 199.1 L171.1 201.6 L168.1 204.2 L165.3 207.0 L162.7 210.0 L160.2 213.2 L157.9 216.7 L155.3 221.5 L153.6 225.1 L152.1 229.0 L151.0 232.7 L150.0 236.7 L149.4 240.8 L149.0 244.8 L148.9 249.0 L149.1 254.4 L149.6 258.4 L150.4 262.5 L151.5 266.5 L152.8 270.3 L154.4 274.1 L156.9 279.0 L159.2 282.8 L159.6 283.5 L159.9 284.3 L160.0 285.7 L159.9 286.8 L159.6 287.8 L159.0 288.8 L158.3 289.6 L157.3 290.5 L156.5 290.9 L155.7 291.1 L154.4 291.3 L32.3 291.3 L31.0 291.1 L30.2 290.9 L29.5 290.5 L28.5 289.8 L27.8 289.0 L27.2 288.1 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M257.1 247.2 L256.7 242.5 L255.8 238.0 L254.6 233.5 L252.9 229.2 L250.8 225.1 L248.2 221.2 L245.4 217.6 L242.1 214.3 L238.6 211.3 L234.8 208.6 L230.8 206.4 L226.5 204.5 L222.1 203.1 L217.6 202.1 L213.0 201.6 L208.3 201.5 L203.7 201.9 L199.2 202.7 L194.7 204.0 L190.4 205.7 L186.3 207.8 L182.4 210.3 L178.8 213.2 L175.4 216.4 L172.4 220.0 L169.8 223.8 L167.6 227.8 L165.7 232.1 L164.3 236.5 L163.3 241.0 L162.8 245.6 L162.7 250.2 L163.1 254.9 L163.9 259.4 L165.2 263.9 L166.9 268.2 L169.0 272.3 L171.5 276.2 L174.4 279.8 L177.6 283.1 L181.2 286.1 L185.0 288.8 L189.0 291.0 L193.3 292.9 L197.7 294.3 L202.2 295.3 L206.8 295.8 L211.4 295.9 L216.0 295.5 L220.6 294.7 L225.1 293.4 L229.4 291.7 L233.5 289.6 L237.4 287.1 L241.0 284.2 L244.3 281.0 L247.3 277.4 L250.0 273.6 L252.2 269.6 L254.1 265.3 L255.5 260.9 L256.5 256.4 L257.0 251.8 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M248.9 247.4 L248.5 243.6 L247.9 239.9 L246.8 236.2 L245.4 232.6 L243.7 229.2 L241.6 226.0 L239.2 223.0 L236.5 220.3 L233.6 217.8 L230.5 215.6 L227.1 213.7 L223.6 212.2 L220.0 211.0 L216.2 210.2 L212.4 209.8 L208.6 209.7 L204.8 210.1 L201.0 210.7 L197.4 211.8 L193.8 213.2 L190.4 214.9 L187.2 217.0 L184.2 219.4 L181.4 222.1 L179.0 225.0 L176.8 228.1 L174.9 231.5 L173.4 235.0 L172.2 238.6 L171.4 242.4 L171.0 246.2 L170.9 250.0 L171.2 253.8 L171.9 257.6 L173.0 261.2 L174.4 264.8 L176.1 268.2 L178.2 271.4 L180.6 274.4 L183.2 277.2 L186.2 279.6 L189.3 281.8 L192.6 283.7 L196.2 285.2 L199.8 286.4 L203.5 287.2 L207.3 287.6 L211.2 287.7 L215.0 287.4 L218.7 286.7 L222.4 285.6 L226.0 284.2 L229.4 282.5 L232.6 280.4 L235.6 278.0 L238.3 275.4 L240.8 272.4 L243.0 269.3 L244.9 265.9 L246.4 262.4 L247.5 258.8 L248.4 255.1 L248.8 251.3 Z`, mat: 'wine', level: 2, fin: 'facets' },
      { d: `M204.6 243.5 L189.4 244.1 L201.3 253.5 L197.2 268.2 L209.9 259.8 L222.6 268.2 L218.5 253.5 L230.4 244.1 L215.2 243.5 L209.9 229.2 Z`, mat: 'gold', level: 3, fin: 'foil' }
    ],
    face: { x: -0.125, y: 0.566, w: 0.512, h: 0.461, level: 1, on: 0 },
    ink: 'printlight', art: {"src": "img/designs/gem.dfed3688.webp", "box": [-6.0, -6.0, 263.06, 306.19]}, tile: "img/designs/tile-gem.c288e363.webp",
  },
  hands: {
    name: "Hands & Disc", group: 'Rounds', sheet: 'white', base: 1.08,
    note: "A disc held up in two white hands: a wood ring and a fine gold line round a cream face.",
    body: `M242.3 84.9 L241.4 81.4 L239.3 74.5 L236.8 67.8 L233.8 61.3 L230.4 54.9 L228.6 51.8 L224.6 45.9 L222.4 43.0 L217.9 37.4 L212.9 32.2 L207.7 27.3 L205.0 24.9 L199.3 20.6 L193.3 16.6 L190.2 14.7 L183.9 11.3 L177.3 8.4 L174.0 7.0 L167.2 4.7 L163.7 3.7 L160.2 2.9 L153.2 1.5 L149.6 0.9 L142.4 0.2 L135.3 0.0 L131.7 0.1 L124.5 0.5 L117.4 1.5 L110.3 2.9 L103.4 4.7 L96.6 7.0 L93.2 8.4 L86.7 11.3 L83.5 13.0 L77.2 16.6 L71.3 20.6 L68.4 22.7 L62.8 27.3 L57.6 32.2 L55.1 34.8 L52.7 37.4 L48.1 43.0 L43.9 48.8 L42.0 51.8 L40.1 54.9 L36.7 61.3 L33.8 67.8 L32.4 71.2 L31.2 74.5 L29.1 81.4 L28.3 84.9 L27.1 90.6 L24.7 87.1 L22.6 84.8 L21.6 83.9 L20.5 83.2 L19.5 82.7 L18.5 82.4 L17.5 82.4 L16.9 82.6 L15.8 83.1 L14.7 83.8 L12.9 85.4 L10.7 88.2 L8.5 91.4 L6.1 95.6 L4.4 99.3 L3.3 102.8 L2.3 106.6 L1.4 111.9 L0.7 117.6 L0.3 123.3 L0.0 130.4 L0.0 136.6 L0.4 142.9 L1.0 149.4 L1.9 155.8 L2.8 160.6 L3.9 165.3 L5.7 171.8 L8.0 178.4 L9.9 183.3 L12.8 189.8 L15.1 194.6 L18.5 200.6 L21.2 204.9 L23.9 208.8 L26.8 212.5 L31.0 217.3 L35.3 221.9 L40.9 227.3 L47.6 233.3 L49.7 234.9 L52.0 236.4 L61.4 241.8 L63.6 243.2 L65.8 244.7 L67.7 246.4 L69.6 248.2 L71.2 250.3 L71.9 251.4 L72.7 252.9 L73.4 254.5 L74.6 257.9 L75.4 261.6 L76.1 265.6 L76.7 271.8 L77.5 291.6 L77.8 295.9 L78.2 300.0 L112.0 300.0 L112.2 276.0 L112.0 261.2 L112.1 246.5 L111.9 240.8 L111.4 236.6 L110.9 234.0 L110.3 231.5 L109.1 228.2 L107.8 225.3 L106.2 222.5 L104.4 219.8 L102.5 217.2 L99.6 213.7 L103.4 215.0 L106.8 216.0 L110.3 216.8 L117.4 218.3 L124.5 219.2 L128.1 219.5 L135.3 219.7 L142.4 219.5 L146.0 219.2 L153.2 218.3 L160.2 216.8 L163.7 216.0 L167.2 215.0 L171.0 213.7 L168.1 217.2 L166.1 219.8 L164.3 222.5 L162.8 225.3 L161.4 228.2 L160.2 231.5 L159.6 234.0 L159.1 236.6 L158.7 240.8 L158.4 246.5 L158.6 261.2 L158.3 276.0 L158.5 300.0 L192.3 300.0 L192.7 295.9 L193.0 291.6 L193.9 271.8 L194.5 265.6 L195.1 261.6 L196.0 257.9 L197.1 254.5 L197.8 252.9 L198.6 251.4 L199.4 250.3 L201.0 248.2 L202.8 246.4 L204.8 244.7 L206.9 243.2 L209.2 241.8 L218.5 236.4 L221.9 234.1 L224.0 232.4 L230.7 226.2 L236.3 220.8 L241.7 215.0 L245.7 210.1 L248.5 206.2 L252.0 200.6 L255.4 194.6 L258.5 188.2 L260.6 183.3 L263.2 176.7 L265.3 170.2 L267.0 163.8 L267.8 160.6 L268.7 155.8 L269.7 147.8 L270.4 139.7 L270.5 131.9 L270.2 123.3 L269.9 119.0 L269.5 114.7 L268.9 110.6 L268.5 107.9 L267.6 104.0 L266.9 101.6 L266.1 99.3 L264.8 96.4 L263.0 93.0 L261.5 90.5 L259.9 88.2 L258.2 86.1 L256.4 84.3 L255.3 83.4 L253.6 82.6 L252.5 82.4 L251.5 82.5 L250.0 83.2 L248.4 84.4 L246.8 85.9 L245.3 87.8 L243.4 90.6 Z`,
    layers: [
      { d: `M241.4 81.4 L239.3 74.5 L238.1 71.2 L235.3 64.5 L233.8 61.3 L230.4 54.9 L226.6 48.8 L224.6 45.9 L220.2 40.2 L217.9 37.4 L212.9 32.2 L207.7 27.3 L205.0 24.9 L199.3 20.6 L193.3 16.6 L187.0 13.0 L183.9 11.3 L177.3 8.4 L174.0 7.0 L167.2 4.7 L160.2 2.9 L153.2 1.5 L149.6 0.9 L142.4 0.2 L135.3 0.0 L131.7 0.1 L124.5 0.5 L120.9 0.9 L113.8 2.1 L106.8 3.7 L103.4 4.7 L96.6 7.0 L89.9 9.8 L83.5 13.0 L80.3 14.7 L77.2 16.6 L71.3 20.6 L65.6 24.9 L62.8 27.3 L57.6 32.2 L52.7 37.4 L48.1 43.0 L43.9 48.8 L42.0 51.8 L40.1 54.9 L36.7 61.3 L33.8 67.8 L31.2 74.5 L30.1 78.0 L29.1 81.4 L27.5 88.3 L29.4 91.3 L31.0 94.4 L32.1 96.8 L32.9 99.5 L33.5 102.3 L34.0 105.4 L35.8 121.5 L36.2 124.6 L36.8 127.7 L37.9 132.0 L40.0 139.2 L41.8 145.0 L43.4 149.2 L45.6 154.8 L47.4 158.8 L49.3 162.7 L51.4 166.5 L54.5 171.4 L57.0 175.0 L60.4 179.7 L63.2 183.0 L67.9 188.2 L70.8 191.1 L72.7 192.7 L74.7 194.2 L76.8 195.6 L80.1 197.6 L89.1 202.7 L91.3 204.1 L93.3 205.5 L95.3 207.1 L97.0 208.8 L100.1 212.0 L102.5 214.7 L106.8 216.0 L110.3 216.8 L117.4 218.3 L120.9 218.8 L128.1 219.5 L135.3 219.7 L138.9 219.7 L146.0 219.2 L153.2 218.3 L160.2 216.8 L163.7 216.0 L168.0 214.7 L170.4 212.0 L173.5 208.8 L175.2 207.1 L177.2 205.5 L179.2 204.1 L181.4 202.7 L190.4 197.6 L193.7 195.6 L196.8 193.5 L198.8 191.9 L201.6 189.2 L205.5 185.1 L208.3 181.9 L211.9 177.4 L214.4 173.8 L217.6 169.0 L220.5 164.0 L222.5 160.2 L224.4 156.2 L226.6 150.6 L228.7 145.0 L230.5 139.2 L233.0 130.6 L234.0 126.2 L234.9 119.8 L236.3 106.9 L237.0 102.4 L237.6 99.5 L238.5 96.8 L239.5 94.4 L241.1 91.3 L243.0 88.3 Z M234.1 119.6 L233.2 126.0 L232.6 129.2 L231.2 135.6 L230.3 138.7 L229.3 141.8 L227.0 147.9 L224.3 153.8 L222.8 156.7 L221.3 159.5 L217.8 165.0 L216.0 167.7 L212.0 172.9 L207.7 177.7 L205.5 180.1 L203.1 182.3 L198.3 186.6 L195.7 188.6 L190.4 192.4 L184.9 195.9 L182.1 197.4 L179.2 198.9 L173.3 201.6 L170.2 202.8 L164.1 204.9 L161.0 205.8 L154.6 207.2 L148.2 208.3 L145.0 208.7 L141.8 208.9 L135.3 209.2 L132.0 209.1 L125.5 208.7 L119.1 207.8 L115.9 207.2 L109.6 205.8 L106.4 204.9 L103.3 203.9 L97.3 201.6 L94.3 200.3 L88.5 197.4 L82.8 194.2 L80.1 192.4 L77.4 190.6 L72.3 186.6 L67.4 182.3 L65.1 180.1 L62.8 177.7 L58.5 172.9 L54.6 167.7 L52.7 165.0 L49.3 159.5 L47.7 156.7 L46.2 153.8 L43.5 147.9 L42.3 144.8 L40.2 138.7 L39.4 135.6 L37.9 129.2 L36.8 122.8 L36.4 119.6 L36.0 113.1 L36.0 109.9 L36.2 103.4 L36.4 100.1 L36.8 96.9 L37.9 90.5 L38.6 87.3 L40.2 81.0 L41.2 77.9 L43.5 71.9 L46.2 65.9 L47.7 63.1 L50.9 57.4 L52.7 54.7 L56.5 49.4 L58.5 46.9 L62.8 42.0 L65.1 39.6 L67.4 37.4 L72.3 33.1 L77.4 29.1 L80.1 27.3 L82.8 25.5 L88.5 22.3 L91.3 20.8 L97.3 18.1 L100.3 16.9 L106.4 14.8 L112.7 13.2 L115.9 12.5 L119.1 11.9 L125.5 11.0 L132.0 10.6 L135.3 10.6 L141.8 10.8 L145.0 11.0 L148.2 11.4 L154.6 12.5 L157.8 13.2 L164.1 14.8 L167.2 15.8 L173.3 18.1 L179.2 20.8 L182.1 22.3 L187.7 25.5 L190.4 27.3 L193.1 29.1 L198.3 33.1 L200.7 35.2 L205.5 39.6 L209.9 44.4 L212.0 46.9 L214.0 49.4 L217.8 54.7 L221.3 60.2 L222.8 63.1 L224.3 65.9 L227.0 71.9 L229.3 77.9 L230.3 81.0 L231.2 84.2 L232.6 90.5 L233.2 93.7 L234.1 100.1 L234.3 103.4 L234.6 109.9 L234.5 113.1 Z`, mat: 'wood', level: 1, fin: 'wood' },
      { d: `M233.0 100.2 L232.2 93.9 L231.6 90.7 L230.9 87.6 L229.3 81.3 L228.3 78.3 L226.0 72.3 L223.4 66.4 L221.9 63.6 L220.3 60.7 L216.9 55.3 L213.2 50.1 L211.2 47.5 L209.1 45.1 L204.7 40.4 L200.0 36.0 L197.6 33.9 L192.5 30.0 L189.8 28.2 L187.1 26.4 L181.6 23.2 L178.7 21.8 L172.9 19.1 L166.8 16.8 L163.8 15.9 L157.6 14.2 L154.4 13.5 L148.1 12.5 L144.9 12.1 L141.7 11.8 L135.3 11.6 L132.0 11.7 L125.6 12.1 L122.4 12.5 L116.1 13.5 L109.8 15.0 L106.7 15.9 L100.7 17.9 L97.7 19.1 L94.7 20.4 L89.0 23.2 L83.4 26.4 L80.7 28.2 L78.0 30.0 L72.9 33.9 L68.1 38.2 L65.8 40.4 L63.6 42.7 L59.3 47.5 L57.3 50.1 L53.6 55.3 L51.8 58.0 L48.6 63.6 L47.2 66.4 L44.5 72.3 L42.2 78.3 L41.3 81.3 L40.4 84.4 L38.9 90.7 L37.9 97.0 L37.5 100.2 L37.2 103.4 L37.0 109.9 L37.2 116.3 L37.5 119.5 L37.9 122.7 L38.9 129.0 L40.4 135.3 L41.3 138.4 L42.2 141.4 L44.5 147.5 L45.8 150.4 L48.6 156.2 L51.8 161.7 L53.6 164.4 L57.3 169.7 L59.3 172.2 L63.6 177.0 L65.8 179.3 L70.5 183.7 L72.9 185.8 L78.0 189.7 L80.7 191.5 L83.4 193.3 L89.0 196.5 L94.7 199.3 L97.7 200.6 L100.7 201.8 L106.7 203.9 L109.8 204.7 L116.1 206.2 L119.3 206.8 L125.6 207.6 L132.0 208.0 L135.3 208.1 L141.7 207.9 L144.9 207.6 L148.1 207.3 L154.4 206.2 L160.7 204.7 L163.8 203.9 L169.9 201.8 L172.9 200.6 L175.8 199.3 L181.6 196.5 L184.4 194.9 L189.8 191.5 L195.1 187.8 L197.6 185.8 L202.4 181.6 L204.7 179.3 L207.0 177.0 L211.2 172.2 L213.2 169.7 L216.9 164.4 L218.7 161.7 L221.9 156.2 L223.4 153.3 L226.0 147.5 L228.3 141.4 L229.3 138.4 L230.9 132.2 L231.6 129.0 L232.2 125.9 L233.0 119.5 L233.3 116.3 L233.5 109.9 L233.3 103.4 Z M230.9 119.3 L230.1 125.5 L229.5 128.6 L228.9 131.7 L227.2 137.8 L226.3 140.8 L224.1 146.6 L221.5 152.4 L220.0 155.2 L216.9 160.6 L215.2 163.3 L211.5 168.4 L209.6 170.8 L207.5 173.2 L203.2 177.8 L201.0 180.0 L196.2 184.2 L193.8 186.1 L188.7 189.8 L183.3 193.1 L180.6 194.6 L174.9 197.4 L172.0 198.7 L169.1 199.8 L163.2 201.8 L160.1 202.7 L154.0 204.1 L147.8 205.2 L144.7 205.5 L141.5 205.8 L135.3 206.0 L132.1 205.9 L125.8 205.5 L119.6 204.7 L116.5 204.1 L110.4 202.7 L107.4 201.8 L101.4 199.8 L98.5 198.7 L95.6 197.4 L89.9 194.6 L84.5 191.5 L81.9 189.8 L76.7 186.1 L74.3 184.2 L71.9 182.1 L67.3 177.8 L63.0 173.2 L61.0 170.8 L59.0 168.4 L55.3 163.3 L53.6 160.6 L50.5 155.2 L47.7 149.5 L46.5 146.6 L45.3 143.7 L43.3 137.8 L42.4 134.7 L41.0 128.6 L40.0 122.4 L39.6 119.3 L39.3 116.1 L39.1 109.9 L39.3 103.6 L39.6 100.4 L40.0 97.3 L41.0 91.1 L42.4 85.0 L43.3 82.0 L44.2 79.0 L46.5 73.1 L49.1 67.3 L50.5 64.5 L53.6 59.1 L55.3 56.5 L59.0 51.3 L61.0 48.9 L63.0 46.5 L67.3 41.9 L69.6 39.7 L74.3 35.6 L76.7 33.6 L81.9 29.9 L84.5 28.2 L89.9 25.1 L95.6 22.3 L98.5 21.1 L101.4 19.9 L107.4 17.9 L110.4 17.0 L116.5 15.6 L122.7 14.6 L125.8 14.2 L129.0 13.9 L135.3 13.7 L141.5 13.9 L144.7 14.2 L147.8 14.6 L154.0 15.6 L157.1 16.2 L163.2 17.9 L166.2 18.8 L172.0 21.1 L174.9 22.3 L180.6 25.1 L186.0 28.2 L188.7 29.9 L191.3 31.7 L196.2 35.6 L198.6 37.6 L203.2 41.9 L207.5 46.5 L209.6 48.9 L211.5 51.3 L215.2 56.5 L218.5 61.8 L220.0 64.5 L221.5 67.3 L224.1 73.1 L226.3 79.0 L227.2 82.0 L228.1 85.0 L229.5 91.1 L230.6 97.3 L230.9 100.4 L231.3 106.7 L231.4 109.9 L231.3 113.0 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M230.1 103.6 L229.9 100.5 L229.1 94.4 L227.8 88.3 L227.1 85.3 L225.3 79.3 L224.2 76.4 L221.9 70.6 L220.5 67.8 L217.6 62.3 L216.0 59.7 L212.5 54.5 L210.7 52.0 L206.7 47.2 L204.6 44.9 L202.5 42.6 L197.9 38.4 L195.6 36.4 L190.6 32.6 L188.1 30.8 L182.8 27.5 L177.3 24.6 L174.5 23.3 L168.8 20.9 L165.8 19.8 L162.9 18.9 L156.8 17.3 L150.7 16.1 L147.7 15.6 L141.5 15.0 L138.4 14.8 L135.3 14.8 L129.0 15.0 L122.9 15.6 L119.8 16.1 L116.7 16.6 L110.7 18.0 L107.7 18.9 L101.8 20.9 L96.0 23.3 L93.2 24.6 L90.4 26.0 L85.1 29.1 L82.4 30.8 L77.4 34.4 L75.0 36.4 L70.3 40.5 L65.9 44.9 L63.8 47.2 L59.8 52.0 L58.0 54.5 L56.2 57.0 L52.9 62.3 L51.4 65.0 L48.7 70.6 L47.4 73.5 L45.2 79.3 L43.4 85.3 L42.7 88.3 L42.0 91.3 L41.0 97.5 L40.4 103.6 L40.2 106.7 L40.2 113.0 L40.4 116.1 L41.0 122.3 L41.5 125.3 L42.0 128.4 L43.4 134.5 L45.2 140.4 L46.3 143.3 L48.7 149.1 L50.0 151.9 L52.9 157.4 L54.5 160.1 L56.2 162.7 L59.8 167.7 L63.8 172.5 L65.9 174.8 L68.0 177.1 L72.6 181.3 L75.0 183.3 L79.9 187.1 L85.1 190.6 L87.7 192.2 L90.4 193.7 L96.0 196.5 L98.9 197.7 L104.7 199.9 L110.7 201.7 L113.7 202.4 L119.8 203.7 L122.9 204.1 L125.9 204.5 L132.2 204.9 L138.4 204.9 L141.5 204.7 L147.7 204.1 L150.7 203.7 L156.8 202.4 L159.9 201.7 L162.9 200.8 L168.8 198.8 L174.5 196.5 L177.3 195.1 L182.8 192.2 L185.5 190.6 L190.6 187.1 L193.1 185.3 L195.6 183.3 L200.3 179.2 L202.5 177.1 L206.7 172.5 L208.8 170.2 L212.5 165.2 L216.0 160.1 L217.6 157.4 L220.5 151.9 L221.9 149.1 L223.1 146.2 L225.3 140.4 L226.2 137.5 L227.8 131.4 L229.1 125.3 L229.5 122.3 L229.9 119.2 L230.3 113.0 L230.3 109.9 Z`, mat: 'tan', level: 1, fin: 'panel' }
    ],
    face: { x: 0.0, y: 0.634, w: 0.514, h: 0.393, level: 1, on: 2 },
    ink: 'printdark', art: {"src": "img/designs/hands.54127694.webp", "box": [-5.98, -6.0, 276.67, 306.19]}, tile: "img/designs/tile-hands.bbc276a3.webp",
  },
  laurel: {
    name: "Laurel Round", group: 'Rounds', sheet: 'navy', base: 1.08,
    note: "A navy disc: a white centre held in a gold laurel wreath.",
    body: `M309.2 149.6 L308.9 144.5 L308.5 139.5 L308.0 134.5 L307.2 129.4 L306.3 124.5 L305.2 119.5 L304.0 114.6 L302.6 109.7 L301.1 104.9 L299.4 100.2 L297.5 95.5 L295.5 90.8 L293.3 86.2 L291.0 81.7 L288.6 77.3 L286.0 73.0 L283.2 68.7 L280.3 64.6 L277.3 60.5 L274.2 56.5 L270.9 52.7 L267.5 48.9 L264.0 45.3 L260.3 41.8 L256.6 38.4 L252.7 35.1 L248.8 32.0 L244.7 28.9 L240.6 26.1 L236.3 23.3 L232.0 20.7 L227.5 18.3 L223.0 15.9 L218.5 13.8 L213.8 11.8 L209.1 9.9 L204.3 8.2 L199.5 6.7 L194.7 5.3 L189.8 4.0 L184.8 3.0 L179.8 2.1 L174.8 1.3 L169.8 0.7 L164.8 0.3 L159.7 0.1 L154.6 0.0 L149.6 0.1 L144.5 0.3 L139.5 0.7 L134.5 1.3 L129.4 2.1 L124.5 3.0 L119.5 4.0 L114.6 5.3 L109.7 6.7 L104.9 8.2 L100.2 9.9 L95.5 11.8 L90.8 13.8 L86.2 15.9 L81.7 18.3 L77.3 20.7 L73.0 23.3 L68.7 26.1 L64.6 28.9 L60.5 32.0 L56.5 35.1 L52.7 38.4 L48.9 41.8 L45.3 45.3 L41.8 48.9 L38.4 52.7 L35.1 56.5 L32.0 60.5 L28.9 64.6 L26.1 68.7 L23.3 73.0 L20.7 77.3 L18.3 81.7 L15.9 86.2 L13.8 90.8 L11.8 95.5 L9.9 100.2 L8.2 104.9 L6.7 109.7 L5.3 114.6 L4.0 119.5 L3.0 124.5 L2.1 129.4 L1.3 134.5 L0.7 139.5 L0.3 144.5 L0.1 149.6 L0.0 154.6 L0.1 159.7 L0.3 164.8 L0.7 169.8 L1.3 174.8 L2.1 179.8 L3.0 184.8 L4.0 189.8 L5.3 194.7 L6.7 199.5 L8.2 204.3 L9.9 209.1 L11.8 213.8 L13.8 218.5 L15.9 223.0 L18.3 227.5 L20.7 232.0 L23.3 236.3 L26.1 240.6 L28.9 244.7 L32.0 248.8 L35.1 252.7 L38.4 256.6 L41.8 260.3 L45.3 264.0 L48.9 267.5 L52.7 270.9 L56.5 274.2 L60.5 277.3 L64.6 280.3 L68.7 283.2 L73.0 286.0 L77.3 288.6 L81.7 291.0 L86.2 293.3 L90.8 295.5 L95.5 297.5 L101.9 300.0 L207.3 300.0 L213.8 297.5 L218.5 295.5 L223.0 293.3 L227.5 291.0 L232.0 288.6 L236.3 286.0 L240.6 283.2 L244.7 280.3 L248.8 277.3 L252.7 274.2 L256.6 270.9 L260.3 267.5 L264.0 264.0 L267.5 260.3 L270.9 256.6 L274.2 252.7 L277.3 248.8 L280.3 244.7 L283.2 240.6 L286.0 236.3 L288.6 232.0 L291.0 227.5 L293.3 223.0 L295.5 218.5 L297.5 213.8 L299.4 209.1 L301.1 204.3 L302.6 199.5 L304.0 194.7 L305.2 189.8 L306.3 184.8 L307.2 179.8 L308.0 174.8 L308.5 169.8 L308.9 164.8 L309.2 159.7 L309.3 154.6 Z`,
    layers: [
      { d: `M204.4 283.5 L207.5 282.3 L211.7 280.5 L215.7 278.5 L219.8 276.5 L223.7 274.3 L227.6 271.9 L231.4 269.5 L235.1 266.9 L238.7 264.2 L242.3 261.4 L245.7 258.5 L249.1 255.5 L252.3 252.3 L255.5 249.1 L258.5 245.7 L261.4 242.3 L264.2 238.7 L266.9 235.1 L269.5 231.4 L271.9 227.6 L274.3 223.7 L276.5 219.8 L278.5 215.7 L280.5 211.7 L282.3 207.5 L283.9 203.3 L285.5 199.0 L286.8 194.7 L288.1 190.4 L289.2 186.0 L290.1 181.6 L290.9 177.1 L291.6 172.7 L292.1 168.2 L292.5 163.7 L292.7 159.2 L292.8 154.6 L292.7 150.1 L292.5 145.6 L292.1 141.1 L291.6 136.6 L290.9 132.1 L290.1 127.7 L289.2 123.3 L288.1 118.9 L286.8 114.5 L285.5 110.2 L283.9 106.0 L282.3 101.8 L280.5 97.6 L278.5 93.5 L276.5 89.5 L274.3 85.6 L271.9 81.7 L269.5 77.9 L266.9 74.2 L264.2 70.5 L261.4 67.0 L258.5 63.6 L255.5 60.2 L252.3 57.0 L249.1 53.8 L245.7 50.8 L242.3 47.9 L238.7 45.0 L235.1 42.4 L231.4 39.8 L227.6 37.3 L223.7 35.0 L219.8 32.8 L215.7 30.7 L211.7 28.8 L207.5 27.0 L203.3 25.4 L199.0 23.8 L194.7 22.4 L190.4 21.2 L186.0 20.1 L181.6 19.2 L177.1 18.3 L172.7 17.7 L168.2 17.2 L163.7 16.8 L159.2 16.6 L154.6 16.5 L150.1 16.6 L145.6 16.8 L141.1 17.2 L136.6 17.7 L132.1 18.3 L127.7 19.2 L123.3 20.1 L118.9 21.2 L114.5 22.4 L110.2 23.8 L106.0 25.4 L101.8 27.0 L97.6 28.8 L93.5 30.7 L89.5 32.8 L85.6 35.0 L81.7 37.3 L77.9 39.8 L74.2 42.4 L70.5 45.0 L67.0 47.9 L63.6 50.8 L60.2 53.8 L57.0 57.0 L53.8 60.2 L50.8 63.6 L47.9 67.0 L45.0 70.5 L42.4 74.2 L39.8 77.9 L37.3 81.7 L35.0 85.6 L32.8 89.5 L30.7 93.5 L28.8 97.6 L27.0 101.8 L25.4 106.0 L23.8 110.2 L22.4 114.5 L21.2 118.9 L20.1 123.3 L19.2 127.7 L18.3 132.1 L17.7 136.6 L17.2 141.1 L16.8 145.6 L16.6 150.1 L16.5 154.6 L16.6 159.2 L16.8 163.7 L17.2 168.2 L17.7 172.7 L18.3 177.1 L19.2 181.6 L20.1 186.0 L21.2 190.4 L22.4 194.7 L23.8 199.0 L25.4 203.3 L27.0 207.5 L28.8 211.7 L30.7 215.7 L32.8 219.8 L35.0 223.7 L37.3 227.6 L39.8 231.4 L42.4 235.1 L45.0 238.7 L47.9 242.3 L50.8 245.7 L53.8 249.1 L57.0 252.3 L60.2 255.5 L63.6 258.5 L67.0 261.4 L70.5 264.2 L74.2 266.9 L77.9 269.5 L81.7 271.9 L85.6 274.3 L89.5 276.5 L93.5 278.5 L97.6 280.5 L101.8 282.3 L104.9 283.5 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M122.0 56.6 L121.1 55.9 L119.7 55.1 L118.2 54.4 L118.0 53.9 L117.3 54.1 L114.7 53.4 L111.8 52.9 L107.8 52.6 L103.8 52.7 L101.4 52.9 L99.6 53.2 L98.0 53.6 L96.5 54.0 L94.4 55.0 L93.1 55.9 L92.6 56.5 L92.3 57.2 L92.2 57.9 L92.3 58.5 L92.5 59.0 L93.1 59.8 L93.9 60.5 L94.7 61.0 L96.9 62.0 L99.3 62.8 L94.9 65.6 L91.1 68.3 L88.3 68.4 L85.0 68.8 L81.5 69.5 L78.2 70.5 L75.5 71.5 L72.7 72.9 L70.4 74.4 L68.8 75.9 L68.0 77.2 L67.9 77.8 L67.8 78.3 L67.9 78.9 L68.2 79.4 L68.9 80.1 L70.0 80.8 L71.8 81.3 L74.0 81.6 L76.2 81.6 L73.4 84.7 L69.7 89.2 L67.1 90.0 L64.0 91.3 L61.3 92.7 L58.3 94.5 L55.6 96.5 L53.3 98.6 L51.6 100.7 L50.6 102.3 L50.1 103.8 L50.0 104.4 L50.1 105.0 L50.3 105.6 L50.7 106.0 L51.5 106.6 L53.0 106.9 L54.8 106.9 L57.0 106.6 L59.1 106.1 L56.5 111.5 L55.0 115.1 L53.0 116.4 L50.8 118.1 L48.6 120.1 L46.5 122.3 L44.6 124.5 L42.9 126.9 L41.6 129.1 L40.7 131.2 L40.1 133.3 L40.1 134.8 L40.3 135.4 L40.7 136.1 L41.1 136.4 L41.6 136.7 L42.3 136.9 L43.0 136.9 L43.7 136.8 L44.9 136.5 L47.2 135.6 L49.4 134.3 L48.6 139.1 L47.9 144.1 L46.1 146.2 L44.5 148.5 L42.9 151.1 L41.5 153.8 L40.3 156.5 L39.5 159.2 L38.9 161.6 L38.6 163.9 L38.7 165.7 L38.9 166.5 L39.2 167.3 L39.7 168.0 L40.2 168.3 L40.7 168.5 L41.3 168.5 L42.6 168.3 L43.6 167.8 L44.4 167.3 L46.1 165.9 L47.8 164.1 L48.2 167.9 L49.2 174.0 L48.0 176.4 L47.1 179.1 L46.3 182.0 L45.7 185.0 L45.3 187.9 L45.2 190.7 L45.3 193.3 L45.6 195.5 L46.2 197.2 L46.6 197.9 L47.2 198.7 L47.7 199.0 L48.2 199.3 L48.9 199.4 L49.5 199.3 L50.7 198.6 L51.6 197.9 L52.2 197.2 L53.4 195.4 L54.6 193.2 L56.7 198.3 L58.6 202.3 L58.2 205.0 L58.0 208.3 L58.1 211.9 L58.4 214.9 L58.9 217.7 L59.7 220.8 L60.6 223.0 L61.8 225.0 L62.9 226.2 L63.5 226.6 L64.0 226.8 L64.6 226.9 L65.2 226.8 L65.7 226.6 L66.2 226.3 L67.2 225.1 L68.0 223.5 L68.7 221.3 L69.1 219.3 L71.9 222.8 L75.4 226.9 L75.8 229.6 L76.4 232.4 L77.2 235.3 L78.3 238.1 L79.6 240.8 L80.9 243.3 L82.4 245.4 L83.8 247.0 L84.8 247.9 L85.5 248.4 L86.8 248.9 L87.4 249.0 L88.0 248.9 L88.5 248.7 L89.1 248.2 L89.8 247.0 L90.1 246.2 L90.3 245.0 L90.4 242.8 L90.2 240.3 L95.3 244.0 L98.4 245.9 L99.9 249.3 L101.1 251.4 L102.2 253.1 L103.4 254.7 L104.9 256.7 L107.5 259.5 L109.5 261.3 L111.4 262.6 L113.2 263.5 L114.3 263.8 L115.0 263.9 L116.1 263.8 L116.9 263.4 L117.4 262.6 L117.8 261.5 L117.8 260.2 L117.6 258.6 L117.1 256.7 L116.3 254.8 L121.2 256.5 L124.0 257.4 L129.5 258.9 L132.3 259.5 L133.0 256.5 L127.5 255.2 L122.2 253.6 L116.9 251.7 L114.1 250.6 L112.8 248.5 L111.3 246.5 L109.7 244.5 L108.4 243.1 L106.7 241.6 L105.4 240.5 L103.8 239.4 L102.3 238.6 L101.3 238.2 L100.3 238.1 L99.4 238.1 L98.9 238.3 L98.3 238.7 L97.7 239.6 L97.5 240.5 L97.5 241.7 L97.0 241.4 L92.5 238.2 L89.3 235.7 L87.9 231.4 L87.1 229.6 L86.0 227.4 L85.1 225.8 L83.9 223.9 L82.9 222.7 L81.9 221.6 L80.7 220.6 L79.8 220.0 L79.0 219.7 L78.0 219.7 L77.3 219.9 L76.5 220.6 L76.1 221.4 L75.7 222.5 L72.5 218.6 L69.5 214.5 L69.3 210.1 L68.7 206.1 L67.8 202.6 L67.3 201.0 L66.6 199.6 L65.8 198.1 L64.9 197.1 L63.9 196.3 L63.2 196.1 L62.5 196.1 L61.6 196.4 L60.7 197.2 L60.0 198.1 L58.4 194.5 L56.3 188.7 L56.9 186.4 L57.4 183.9 L57.8 181.4 L58.0 179.0 L58.0 176.8 L57.8 174.7 L57.5 172.9 L57.0 171.4 L56.5 170.5 L56.0 169.7 L55.3 169.3 L54.8 169.1 L54.0 169.0 L53.2 169.3 L52.4 169.8 L51.7 170.4 L51.0 164.7 L50.7 160.3 L51.9 158.2 L53.1 156.0 L54.1 153.7 L54.8 151.9 L55.5 149.7 L55.9 148.0 L56.2 146.1 L56.2 144.8 L56.1 143.6 L55.9 142.6 L55.5 141.8 L54.8 141.1 L54.2 140.8 L53.4 140.7 L52.5 140.9 L51.4 141.4 L52.1 136.8 L53.1 131.4 L54.9 129.7 L56.7 127.9 L58.3 126.0 L59.5 124.5 L60.7 122.6 L61.5 121.1 L62.3 119.3 L62.8 118.0 L63.0 116.9 L63.1 115.8 L63.0 115.1 L62.7 114.4 L62.2 113.8 L61.3 113.4 L60.2 113.3 L59.0 113.4 L59.3 112.7 L61.7 107.6 L63.5 104.3 L67.4 102.2 L69.5 100.8 L71.1 99.7 L72.9 98.2 L74.1 97.0 L75.2 95.8 L76.3 94.4 L76.9 93.3 L77.2 92.3 L77.4 91.4 L77.3 90.4 L76.8 89.6 L76.1 89.2 L75.2 88.9 L74.1 88.7 L75.7 86.7 L77.6 84.6 L80.9 81.2 L85.2 80.2 L87.6 79.5 L89.5 78.8 L91.2 78.1 L93.1 77.0 L94.5 76.2 L95.9 75.1 L97.0 74.0 L97.5 73.2 L97.9 72.4 L98.0 71.6 L97.8 70.9 L97.2 70.1 L96.5 69.5 L95.4 69.0 L98.9 66.7 L104.0 63.7 L108.5 64.0 L112.4 63.8 L116.1 63.3 L117.7 62.9 L119.1 62.4 L120.4 61.9 L121.4 61.3 L122.2 60.6 L122.6 60.1 L122.9 59.5 L123.1 58.8 L123.0 58.1 L122.7 57.5 Z M246.1 82.7 L245.7 82.1 L244.5 80.7 L242.4 79.0 L239.8 77.4 L237.7 76.4 L235.9 75.6 L232.1 74.3 L230.1 73.8 L227.8 73.3 L224.1 73.0 L221.4 70.7 L216.8 67.3 L214.4 65.6 L209.5 62.5 L207.0 61.1 L201.9 58.4 L196.7 56.0 L191.3 53.9 L190.3 56.8 L195.5 58.9 L198.0 60.0 L203.1 62.5 L205.5 63.8 L210.3 66.7 L212.7 68.2 L217.2 71.4 L219.7 73.4 L218.6 73.8 L217.7 74.4 L217.1 75.2 L217.0 76.1 L217.2 77.2 L217.8 78.3 L218.8 79.4 L220.1 80.6 L222.9 82.4 L225.8 83.9 L229.5 85.4 L233.4 86.5 L237.1 91.1 L239.6 94.5 L238.4 94.6 L237.4 94.9 L236.7 95.4 L236.2 96.2 L236.1 97.2 L236.2 98.1 L236.7 99.4 L237.6 100.9 L238.5 102.1 L239.5 103.4 L242.2 106.0 L245.3 108.4 L249.1 110.8 L251.0 115.3 L252.9 120.2 L251.7 120.0 L250.6 120.0 L249.9 120.3 L249.2 120.9 L248.8 121.6 L248.7 122.8 L248.7 123.9 L249.1 125.5 L249.5 126.9 L250.2 128.4 L251.0 130.0 L252.2 132.0 L254.5 135.2 L257.5 138.6 L258.0 142.3 L258.6 148.6 L257.5 148.1 L256.6 147.8 L255.7 147.9 L255.0 148.2 L254.4 148.7 L253.9 149.7 L253.6 151.0 L253.5 152.3 L253.5 153.8 L253.7 155.8 L254.5 159.3 L255.3 161.6 L256.0 163.5 L258.0 167.5 L257.1 173.0 L256.2 177.5 L255.4 176.7 L254.6 176.2 L253.6 176.0 L252.9 176.1 L252.2 176.4 L251.5 177.1 L250.8 178.2 L250.4 179.3 L249.9 181.0 L249.6 182.6 L249.5 184.3 L249.4 186.7 L249.5 189.1 L249.6 191.1 L250.4 195.5 L248.6 199.6 L247.3 202.1 L246.0 204.6 L245.4 203.6 L244.8 202.9 L244.1 202.5 L243.3 202.3 L242.4 202.5 L241.6 202.9 L240.8 203.6 L240.0 204.5 L239.1 205.9 L238.4 207.3 L237.6 209.3 L237.0 211.1 L236.5 212.9 L236.0 215.4 L235.6 217.9 L235.4 220.3 L231.4 225.0 L228.7 227.9 L228.4 227.0 L228.1 226.1 L227.6 225.4 L226.9 225.0 L226.2 224.8 L225.4 224.9 L224.7 225.1 L223.8 225.6 L222.5 226.5 L221.2 227.8 L219.8 229.4 L218.5 231.2 L217.3 233.2 L216.1 235.4 L215.1 237.7 L214.2 240.0 L209.9 242.9 L205.6 245.4 L205.6 244.2 L205.4 243.1 L204.9 242.3 L204.3 241.9 L203.5 241.7 L202.3 241.7 L201.0 242.1 L199.4 242.7 L198.1 243.5 L196.7 244.4 L193.9 246.8 L191.1 249.6 L188.3 253.1 L184.4 254.4 L178.6 256.0 L179.0 254.8 L179.1 253.9 L178.9 253.1 L178.6 252.5 L178.0 252.0 L177.2 251.6 L175.9 251.4 L174.7 251.5 L172.7 251.8 L170.3 252.6 L167.8 253.6 L165.2 255.0 L162.3 256.9 L159.1 259.3 L156.7 261.5 L154.5 264.1 L153.7 265.3 L153.2 266.4 L152.8 267.5 L152.7 268.2 L152.7 269.0 L152.9 269.8 L153.4 270.3 L153.9 270.7 L154.5 270.9 L155.5 271.1 L156.6 271.1 L157.6 271.0 L160.2 270.4 L162.6 269.5 L164.7 268.5 L166.9 267.3 L168.6 266.2 L170.7 264.8 L172.6 263.3 L174.0 262.0 L175.6 260.4 L176.8 258.9 L176.9 259.5 L182.5 258.2 L185.9 257.2 L184.8 259.5 L184.2 261.6 L184.0 262.8 L184.0 263.6 L184.2 265.0 L184.5 265.5 L184.9 265.9 L185.3 266.2 L186.1 266.4 L187.0 266.4 L187.8 266.3 L189.6 265.7 L191.5 264.6 L193.6 263.1 L195.7 261.3 L197.8 259.2 L199.8 256.9 L201.6 254.5 L203.1 252.1 L204.3 249.6 L209.1 247.0 L212.9 244.6 L212.6 246.7 L212.5 248.9 L212.7 250.8 L213.2 252.2 L213.6 252.7 L214.0 253.1 L214.5 253.3 L215.1 253.4 L215.7 253.4 L216.4 253.2 L217.5 252.7 L219.1 251.5 L220.9 249.6 L222.8 247.1 L224.5 244.1 L225.8 241.4 L227.1 238.2 L228.1 234.9 L228.6 232.2 L231.7 229.2 L235.5 225.1 L235.8 227.6 L236.4 229.6 L236.8 230.8 L237.2 231.5 L238.2 232.5 L238.7 232.8 L239.2 233.0 L240.0 232.9 L240.6 232.8 L241.1 232.4 L241.9 231.7 L243.1 230.3 L244.2 228.3 L245.2 226.0 L246.0 223.3 L246.7 220.4 L247.1 217.4 L247.4 214.5 L247.4 211.6 L247.1 208.9 L250.1 203.5 L251.8 200.1 L252.6 202.0 L253.7 203.9 L254.8 205.4 L256.0 206.3 L256.6 206.5 L257.2 206.6 L257.7 206.6 L258.3 206.4 L259.1 205.7 L259.9 204.4 L260.7 202.3 L261.2 200.0 L261.4 196.9 L261.3 193.5 L261.0 190.5 L260.4 187.1 L259.5 183.8 L258.5 181.3 L259.6 176.4 L260.5 171.5 L262.1 173.5 L263.7 174.9 L265.2 175.9 L265.9 176.2 L266.8 176.4 L267.3 176.4 L267.9 176.2 L268.5 175.8 L268.9 175.4 L269.5 174.0 L269.7 172.9 L269.7 171.9 L269.6 169.7 L269.2 167.2 L268.5 164.5 L267.6 161.7 L266.4 158.9 L265.0 156.2 L263.5 153.8 L261.8 151.6 L261.6 147.7 L261.1 141.7 L262.8 142.9 L264.8 144.0 L266.5 144.6 L268.0 144.7 L268.6 144.6 L269.1 144.4 L269.6 144.1 L269.9 143.6 L270.3 142.6 L270.3 141.1 L269.8 138.9 L269.0 136.7 L267.6 133.9 L265.7 131.1 L263.5 128.3 L261.5 126.1 L259.0 123.8 L256.8 122.2 L255.0 116.8 L253.4 112.9 L255.8 113.6 L257.9 114.1 L258.8 114.1 L259.9 114.1 L261.3 113.7 L261.8 113.4 L262.1 113.0 L262.4 112.3 L262.5 111.7 L262.3 110.2 L262.0 109.4 L261.4 108.3 L260.1 106.5 L258.5 104.6 L256.4 102.6 L254.1 100.8 L251.6 99.0 L249.1 97.5 L246.5 96.3 L243.9 95.3 L241.3 91.5 L238.0 87.3 L239.7 87.4 L241.7 87.3 L243.3 87.1 L244.7 86.6 L245.5 86.2 L246.2 85.4 L246.6 84.6 L246.5 83.6 Z`, mat: 'gold', level: 2, fin: 'foil' }
    ],
    face: { x: 0.001, y: 0.484, w: 0.548, h: 0.419, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/laurel.a5dd0bbd.webp", "box": [-6.0, -6.0, 315.33, 306.19]}, tile: "img/designs/tile-laurel.b79d715e.webp",
  },
  medal: {
    name: "Ribbon Medal", group: 'Rounds', sheet: 'gold', base: 1.08,
    note: "A gold medal on a blue ribbon, a white face for the sticker.",
    body: `M133.6 0.0 L111.0 56.5 L88.4 0.0 L22.6 0.0 L67.3 95.2 L61.9 97.7 L58.7 99.4 L52.4 103.0 L49.3 105.0 L43.4 109.2 L40.6 111.5 L35.1 116.3 L30.0 121.4 L27.5 124.1 L22.9 129.7 L18.7 135.6 L14.9 141.8 L13.1 145.0 L11.4 148.2 L8.4 154.8 L5.9 161.6 L3.8 168.5 L2.9 172.1 L1.5 179.2 L0.9 182.8 L0.2 190.0 L0.0 197.3 L0.1 200.9 L0.5 208.1 L1.5 215.3 L2.9 222.5 L4.8 229.5 L7.1 236.3 L9.9 243.1 L13.1 249.6 L16.7 255.9 L20.8 261.9 L25.2 267.7 L30.0 273.1 L35.1 278.2 L40.6 283.0 L46.3 287.5 L52.4 291.5 L58.7 295.1 L65.2 298.3 L69.1 300.0 L152.8 300.0 L156.8 298.3 L163.3 295.1 L166.4 293.4 L172.6 289.5 L178.5 285.3 L184.1 280.7 L189.4 275.7 L191.9 273.1 L196.7 267.7 L199.0 264.8 L201.2 261.9 L205.2 255.9 L208.8 249.6 L212.0 243.1 L214.8 236.3 L216.0 232.9 L218.1 226.0 L219.8 218.9 L220.4 215.3 L221.4 208.1 L221.9 200.9 L221.9 197.3 L221.7 190.0 L221.0 182.8 L219.8 175.6 L219.0 172.1 L218.1 168.5 L216.0 161.6 L213.5 154.8 L210.5 148.2 L208.8 145.0 L205.2 138.7 L201.2 132.6 L199.0 129.7 L194.4 124.1 L189.4 118.8 L186.8 116.3 L184.1 113.8 L178.5 109.2 L172.6 105.0 L169.6 103.0 L163.3 99.4 L160.0 97.7 L154.6 95.2 L199.3 0.0 Z`,
    layers: [
      { d: `M69.8 90.9 L77.8 88.1 L81.5 87.1 L88.7 85.4 L92.3 84.8 L96.1 84.2 L99.8 83.8 L107.2 83.3 L111.0 83.2 L114.7 83.3 L122.1 83.8 L125.9 84.2 L133.2 85.4 L136.9 86.2 L144.0 88.1 L147.7 89.3 L152.1 90.9 L192.8 4.1 L136.3 4.1 L114.8 58.0 L114.2 59.1 L113.3 59.9 L112.2 60.4 L111.0 60.6 L109.8 60.4 L108.7 59.9 L107.8 59.1 L107.1 58.0 L85.6 4.1 L29.1 4.1 Z`, mat: 'blue', level: 1, fin: 'ribbon' },
      { d: `M207.5 197.3 L207.3 190.9 L206.7 184.7 L205.7 178.4 L205.0 175.3 L204.2 172.3 L202.4 166.2 L201.3 163.2 L198.9 157.4 L197.6 154.5 L194.6 149.0 L193.0 146.3 L189.5 141.0 L185.6 136.0 L183.6 133.6 L179.2 129.0 L177.0 126.8 L174.6 124.7 L169.7 120.6 L167.2 118.8 L162.0 115.2 L156.5 112.1 L153.7 110.6 L147.9 108.0 L145.0 106.9 L139.0 104.8 L136.0 104.0 L132.9 103.2 L126.7 102.0 L123.6 101.5 L117.3 100.9 L114.1 100.7 L107.8 100.7 L104.6 100.9 L98.4 101.5 L92.1 102.5 L89.0 103.2 L86.0 104.0 L79.9 105.8 L76.9 106.9 L71.1 109.3 L65.4 112.1 L62.7 113.6 L60.0 115.2 L54.7 118.8 L49.7 122.6 L47.3 124.7 L44.9 126.8 L40.5 131.2 L38.4 133.6 L34.3 138.5 L30.7 143.6 L28.9 146.3 L27.3 149.0 L24.3 154.5 L21.7 160.3 L20.6 163.2 L18.5 169.2 L17.7 172.3 L16.9 175.3 L15.7 181.5 L15.2 184.7 L14.6 190.9 L14.4 194.1 L14.4 200.4 L14.9 206.7 L15.2 209.9 L16.2 216.1 L16.9 219.2 L17.7 222.3 L19.5 228.3 L21.7 234.2 L23.0 237.1 L25.8 242.8 L27.3 245.5 L30.7 250.9 L32.5 253.5 L36.3 258.5 L38.4 260.9 L40.5 263.3 L44.9 267.7 L47.3 269.9 L52.2 273.9 L57.3 277.6 L60.0 279.3 L65.4 282.4 L68.2 283.9 L71.1 285.2 L76.9 287.6 L82.9 289.7 L86.0 290.5 L89.0 291.3 L95.2 292.5 L101.5 293.4 L104.6 293.6 L107.8 293.8 L114.1 293.8 L117.3 293.6 L123.6 293.0 L129.8 292.0 L132.9 291.3 L136.0 290.5 L142.0 288.7 L147.9 286.5 L150.8 285.2 L153.7 283.9 L159.2 280.9 L162.0 279.3 L167.2 275.8 L169.7 273.9 L174.6 269.9 L179.2 265.5 L181.4 263.3 L183.6 260.9 L187.6 256.1 L189.5 253.5 L193.0 248.3 L194.6 245.5 L197.6 240.0 L198.9 237.1 L201.3 231.3 L202.4 228.3 L204.2 222.3 L205.0 219.2 L206.2 213.0 L207.1 206.7 L207.3 203.6 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M201.2 191.3 L200.6 185.5 L200.2 182.5 L199.6 179.6 L198.3 173.9 L197.5 171.0 L195.6 165.4 L194.5 162.7 L192.0 157.3 L189.3 152.1 L187.7 149.5 L184.4 144.6 L182.7 142.2 L178.9 137.7 L176.9 135.5 L174.9 133.3 L170.6 129.3 L166.0 125.5 L163.6 123.8 L158.7 120.5 L156.2 119.0 L150.9 116.2 L148.3 114.9 L145.6 113.7 L140.0 111.7 L137.2 110.7 L131.5 109.2 L128.6 108.6 L122.8 107.6 L116.9 107.0 L113.9 106.9 L108.0 106.9 L105.0 107.0 L102.1 107.3 L96.2 108.1 L93.3 108.6 L87.6 109.9 L84.7 110.7 L79.1 112.6 L73.6 114.9 L71.0 116.2 L68.3 117.5 L63.2 120.5 L58.3 123.8 L55.9 125.5 L51.3 129.3 L49.2 131.3 L47.0 133.3 L43.0 137.7 L39.2 142.2 L37.5 144.6 L35.8 147.0 L32.7 152.1 L29.9 157.3 L28.6 159.9 L27.4 162.7 L25.3 168.2 L23.6 173.9 L22.9 176.7 L22.3 179.6 L21.3 185.5 L20.7 191.3 L20.6 194.3 L20.6 200.2 L20.7 203.2 L21.3 209.1 L21.8 212.0 L22.3 214.9 L23.6 220.7 L25.3 226.3 L26.3 229.1 L27.4 231.9 L29.9 237.2 L31.2 239.9 L34.2 245.0 L37.5 249.9 L39.2 252.3 L41.1 254.6 L45.0 259.1 L49.2 263.2 L51.3 265.2 L55.9 269.0 L58.3 270.7 L60.7 272.4 L65.8 275.6 L71.0 278.3 L73.6 279.6 L79.1 281.9 L81.9 282.9 L84.7 283.8 L90.4 285.3 L96.2 286.5 L99.2 286.9 L105.0 287.5 L108.0 287.6 L111.0 287.7 L116.9 287.5 L122.8 286.9 L125.7 286.5 L128.6 285.9 L134.4 284.6 L140.0 282.9 L142.8 281.9 L148.3 279.6 L150.9 278.3 L156.2 275.6 L158.7 274.0 L161.2 272.4 L166.0 269.0 L170.6 265.2 L172.8 263.2 L174.9 261.2 L178.9 256.9 L180.8 254.6 L184.4 249.9 L187.7 245.0 L189.3 242.5 L190.7 239.9 L193.3 234.6 L195.6 229.1 L196.6 226.3 L197.5 223.5 L199.0 217.8 L199.6 214.9 L200.6 209.1 L200.9 206.1 L201.3 200.2 L201.4 197.3 Z M198.2 200.1 L197.9 205.8 L197.1 211.5 L196.0 217.1 L195.3 219.9 L194.5 222.6 L192.7 228.0 L190.5 233.3 L189.3 235.9 L188.0 238.4 L185.1 243.4 L181.9 248.1 L180.2 250.4 L178.5 252.7 L174.7 257.0 L170.7 261.0 L168.5 262.9 L164.1 266.5 L161.8 268.2 L159.5 269.9 L154.6 272.9 L152.1 274.3 L147.0 276.8 L141.7 279.0 L139.0 280.0 L136.3 280.8 L130.8 282.3 L128.0 282.9 L122.4 283.8 L116.7 284.4 L113.8 284.5 L108.1 284.5 L105.2 284.4 L99.6 283.8 L96.7 283.4 L91.1 282.3 L88.4 281.6 L85.6 280.8 L80.2 279.0 L74.9 276.8 L72.3 275.6 L69.8 274.3 L64.8 271.4 L60.1 268.2 L57.8 266.5 L53.4 262.9 L51.3 261.0 L47.2 257.0 L45.3 254.8 L41.7 250.4 L40.0 248.1 L38.4 245.8 L35.3 240.9 L32.6 235.9 L31.4 233.3 L30.3 230.7 L28.3 225.3 L26.6 219.9 L25.9 217.1 L25.3 214.3 L24.4 208.7 L23.8 203.0 L23.7 200.1 L23.6 197.3 L23.8 191.5 L24.4 185.9 L24.8 183.0 L25.9 177.4 L26.6 174.7 L28.3 169.2 L29.2 166.5 L31.4 161.2 L32.6 158.6 L35.3 153.6 L36.8 151.1 L38.4 148.7 L41.7 144.1 L45.3 139.7 L47.2 137.6 L51.3 133.5 L53.4 131.6 L55.6 129.8 L60.1 126.3 L64.8 123.1 L67.3 121.6 L69.8 120.2 L74.9 117.7 L77.5 116.6 L82.9 114.6 L85.6 113.7 L91.1 112.2 L93.9 111.6 L99.6 110.7 L102.4 110.4 L108.1 110.0 L113.8 110.0 L116.7 110.1 L119.5 110.4 L125.2 111.1 L128.0 111.6 L133.6 112.9 L136.3 113.7 L141.7 115.5 L144.4 116.6 L149.6 118.9 L154.6 121.6 L157.1 123.1 L159.5 124.7 L164.1 128.0 L166.4 129.8 L170.7 133.5 L172.7 135.5 L176.6 139.7 L178.5 141.9 L181.9 146.4 L185.1 151.1 L186.6 153.6 L188.0 156.1 L190.5 161.2 L192.7 166.5 L193.7 169.2 L195.3 174.7 L196.0 177.4 L196.6 180.2 L197.5 185.9 L197.9 188.7 L198.2 194.4 Z`, mat: 'gold', level: 2, fin: 'foil' }
    ],
    face: { x: -0.0, y: 0.342, w: 0.48, h: 0.367, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/medal.826e0a38.webp", "box": [-6.0, -6.0, 228.14, 306.19]}, tile: "img/designs/tile-medal.0a045b4e.webp",
  },
  goldstar: {
    name: "Gold Star", group: 'Stars', sheet: 'gold', base: 1.06,
    note: "A big gold star with a white star laid inside it.",
    body: `M2.2 115.0 L1.3 115.2 L0.9 115.4 L0.3 116.1 L0.1 116.5 L0.0 117.0 L0.1 117.9 L0.3 118.3 L0.8 119.1 L89.1 190.4 L89.5 190.8 L90.0 191.6 L90.1 192.5 L90.0 193.0 L62.0 297.1 L61.9 297.6 L62.1 298.5 L62.5 299.3 L63.3 299.8 L64.2 300.0 L71.3 300.0 L71.7 300.0 L72.5 299.6 L159.2 243.3 L159.7 243.0 L160.5 242.9 L161.4 243.0 L161.9 243.3 L248.5 299.6 L248.9 299.8 L249.8 300.0 L256.8 300.0 L257.3 300.0 L258.1 299.6 L258.8 298.9 L259.0 298.5 L259.1 298.0 L259.0 297.1 L231.1 193.0 L231.0 192.5 L231.1 191.6 L231.5 190.8 L231.9 190.4 L320.2 119.1 L320.8 118.3 L321.0 117.5 L320.9 116.5 L320.5 115.7 L319.7 115.2 L318.9 115.0 L205.5 109.1 L204.9 109.0 L204.1 108.7 L203.5 108.0 L203.3 107.5 L162.7 1.5 L162.5 1.1 L161.8 0.4 L161.0 0.0 L160.5 0.0 L159.6 0.2 L159.2 0.4 L158.6 1.1 L158.4 1.5 L117.8 107.5 L117.5 108.0 L116.9 108.7 L116.1 109.0 L115.6 109.1 Z`,
    layers: [
      { d: `M100.0 177.0 L101.6 178.5 L102.8 179.7 L103.8 181.0 L104.9 182.8 L105.8 184.7 L106.4 186.3 L106.8 187.9 L107.2 189.9 L107.3 192.0 L107.3 193.7 L107.1 195.3 L106.7 197.5 L87.3 269.4 L149.7 228.8 L151.7 227.7 L153.2 227.0 L154.7 226.5 L156.8 225.9 L158.9 225.7 L160.5 225.6 L162.2 225.7 L164.3 225.9 L166.3 226.5 L167.9 227.0 L169.4 227.7 L171.3 228.8 L233.7 269.4 L214.4 197.5 L213.9 195.3 L213.7 193.7 L213.7 192.0 L213.8 189.9 L214.2 187.9 L214.6 186.3 L215.4 184.3 L216.1 182.8 L217.3 181.0 L218.3 179.7 L219.4 178.5 L221.0 177.0 L278.9 130.2 L204.6 126.4 L202.4 126.1 L200.7 125.8 L199.2 125.3 L197.2 124.5 L195.7 123.8 L194.0 122.6 L192.3 121.3 L191.2 120.1 L189.8 118.5 L188.9 117.2 L188.1 115.7 L187.1 113.7 L160.5 44.2 L133.9 113.7 L133.0 115.7 L132.2 117.2 L131.2 118.5 L129.9 120.1 L128.7 121.3 L127.1 122.6 L125.7 123.5 L123.8 124.5 L121.9 125.3 L120.3 125.8 L118.7 126.1 L116.5 126.4 L42.1 130.2 Z`, mat: 'white', level: 1, fin: 'panel' }
    ],
    face: { x: 0.001, y: 0.438, w: 0.302, h: 0.231, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/goldstar.76d9ce1a.webp", "box": [-5.99, -6.0, 327.05, 306.19]}, tile: "img/designs/tile-goldstar.5c9ba541.webp",
  },
  starstem: {
    name: "Shooting Star", group: 'Stars', sheet: 'gold', base: 1.04,
    note: "A gold star on a sweeping tail: a black rim round a white star face, and a black line along the tail.",
    body: `M2.0 59.1 L1.3 59.3 L0.9 59.4 L0.6 59.7 L0.2 60.3 L0.1 60.6 L0.0 61.4 L0.2 62.1 L0.4 62.4 L44.4 116.6 L44.7 117.0 L44.9 117.8 L44.8 118.6 L22.0 184.6 L21.9 185.3 L22.1 186.1 L22.5 186.7 L23.1 187.1 L23.9 187.2 L24.6 187.1 L64.2 171.9 L64.9 171.9 L65.6 172.2 L66.2 172.7 L66.3 173.0 L66.5 173.8 L66.4 174.5 L66.0 175.2 L57.5 185.2 L50.8 193.5 L47.6 197.7 L44.6 201.9 L38.7 210.2 L33.4 218.4 L30.8 222.5 L26.1 230.7 L21.8 238.8 L17.9 247.0 L14.4 255.1 L11.3 263.2 L8.7 271.3 L6.4 279.5 L4.5 287.7 L3.7 291.8 L2.7 297.7 L2.8 298.5 L2.9 298.8 L3.1 299.2 L3.6 299.7 L4.0 299.9 L4.7 300.0 L133.7 300.0 L134.1 300.0 L134.8 299.7 L135.3 299.1 L135.5 298.8 L135.7 298.0 L135.6 297.3 L135.4 296.9 L134.9 296.4 L131.4 294.7 L127.5 292.7 L123.8 290.5 L120.2 288.1 L116.8 285.6 L113.6 282.9 L110.5 279.9 L107.8 277.0 L105.3 273.8 L102.8 270.3 L100.7 266.8 L99.0 263.4 L97.4 259.6 L96.1 255.6 L95.1 251.5 L94.3 247.1 L93.8 242.7 L93.7 238.3 L93.8 233.6 L94.3 228.6 L95.1 223.6 L96.2 218.6 L97.7 213.3 L99.5 207.8 L101.7 202.2 L104.2 196.5 L107.2 190.5 L110.5 184.6 L112.7 181.0 L113.2 180.3 L113.9 180.0 L114.2 179.9 L115.0 180.0 L115.7 180.4 L147.4 204.4 L148.1 204.7 L148.9 204.8 L149.6 204.5 L150.2 204.1 L150.5 203.4 L150.6 202.7 L146.9 133.0 L147.0 132.1 L147.4 131.4 L147.8 131.1 L205.0 91.2 L205.5 90.6 L205.8 89.9 L205.8 89.2 L205.6 88.5 L205.1 87.9 L204.4 87.6 L137.0 69.6 L136.2 69.2 L135.7 68.6 L135.5 68.2 L115.2 1.4 L115.0 1.1 L114.5 0.5 L113.9 0.1 L113.5 0.0 L113.1 0.0 L112.4 0.2 L111.8 0.6 L111.6 0.9 L73.7 59.5 L73.3 59.9 L72.7 60.3 L71.8 60.5 Z`,
    layers: [
      { d: `M78.0 63.7 L77.3 64.7 L76.3 65.5 L75.8 65.8 L75.3 66.0 L74.1 66.4 L72.9 66.5 L10.5 65.3 L49.8 113.7 L50.5 114.7 L50.8 115.3 L51.1 116.5 L51.2 117.7 L51.0 118.9 L50.8 119.5 L30.5 178.4 L88.7 156.0 L89.8 155.7 L90.4 155.6 L91.6 155.6 L92.8 155.9 L93.4 156.2 L94.4 156.8 L144.2 194.4 L140.8 132.1 L140.9 130.9 L141.0 130.3 L141.4 129.2 L142.1 128.1 L142.9 127.2 L143.4 126.9 L194.5 91.2 L134.3 75.1 L133.7 74.9 L132.6 74.4 L131.6 73.6 L130.9 72.7 L130.3 71.6 L130.1 71.1 L111.9 11.4 Z`, mat: 'black', level: 1, fin: 'gloss' },
      { d: `M83.1 67.0 L82.3 68.0 L81.5 68.9 L80.6 69.7 L79.7 70.4 L78.6 71.1 L77.5 71.6 L76.4 72.0 L75.2 72.3 L74.0 72.4 L72.8 72.5 L23.3 71.5 L54.5 109.9 L55.2 110.9 L55.8 112.0 L56.3 113.1 L56.7 114.2 L57.0 115.4 L57.1 116.6 L57.2 117.8 L57.1 119.1 L56.9 120.3 L56.5 121.4 L40.3 168.2 L86.5 150.4 L87.7 150.0 L88.8 149.7 L90.1 149.6 L91.3 149.6 L92.5 149.7 L93.7 149.9 L94.8 150.3 L96.0 150.7 L97.0 151.3 L98.0 152.0 L137.5 181.8 L134.9 132.4 L134.8 131.2 L135.0 130.0 L135.2 128.8 L135.6 127.7 L136.0 126.5 L136.6 125.5 L137.3 124.5 L138.1 123.5 L139.0 122.7 L140.0 122.0 L180.5 93.6 L132.7 80.9 L131.6 80.5 L130.5 80.0 L129.4 79.4 L128.4 78.7 L127.5 77.9 L126.6 77.1 L125.9 76.1 L125.3 75.0 L124.8 73.9 L124.3 72.8 L109.9 25.5 Z`, mat: 'white', level: 2, fin: 'panel' },
      { d: `M61.5 195.3 L58.3 199.4 L52.2 207.5 L49.3 211.5 L43.9 219.5 L39.0 227.4 L36.6 231.4 L32.3 239.2 L28.3 247.0 L24.8 254.8 L23.2 258.7 L20.3 266.4 L17.7 274.1 L15.6 281.9 L14.6 285.7 L13.0 293.5 L13.0 293.9 L13.2 294.4 L13.4 294.8 L13.9 295.1 L14.6 295.3 L15.2 295.1 L15.6 294.7 L15.9 294.2 L17.6 286.4 L19.5 278.8 L21.8 271.2 L23.1 267.4 L26.0 259.8 L29.3 252.2 L32.9 244.5 L34.9 240.6 L39.2 232.9 L41.5 229.0 L46.4 221.2 L51.8 213.2 L57.6 205.2 L63.9 197.2 L70.7 188.8 L70.9 188.3 L71.0 187.9 L70.9 187.5 L70.6 187.0 L70.1 186.7 L69.5 186.5 L68.9 186.6 L68.4 186.9 Z`, mat: 'black', level: 1, fin: 'gloss' }
    ],
    face: { x: 0.054, y: 0.639, w: 0.204, h: 0.156, level: 2, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/starstem.fedbb9f9.webp", "box": [-5.99, -6.0, 211.98, 306.19]}, tile: "img/designs/tile-starstem.fc1782a5.webp",
  },
  starplaque: {
    name: "Star Plaque", group: 'Stars', sheet: 'clear', base: 1.02,
    note: "A clear pentagon outlined in gold, with a red star laid on it, white inside.",
    body: `M1.4 112.7 L0.8 113.1 L0.4 113.7 L0.1 114.3 L0.0 115.0 L0.0 115.7 L0.1 116.4 L59.1 297.7 L59.3 298.3 L59.7 298.9 L60.3 299.4 L60.9 299.7 L61.5 299.9 L62.2 300.0 L252.8 300.0 L253.5 299.9 L254.2 299.7 L254.8 299.4 L255.3 298.9 L255.7 298.3 L256.0 297.7 L314.9 116.4 L315.1 115.7 L315.1 115.0 L314.9 114.3 L314.6 113.7 L314.2 113.1 L313.7 112.7 L159.5 0.6 L158.9 0.3 L158.2 0.1 L157.5 0.0 L156.8 0.1 L156.2 0.3 L155.6 0.6 Z`,
    layers: [
      { d: `M156.2 29.5 L154.5 39.3 L152.3 48.6 L149.8 57.3 L146.9 65.5 L143.7 73.2 L140.0 80.4 L135.9 87.0 L131.5 93.1 L126.7 98.6 L121.4 103.6 L115.8 108.1 L109.8 112.0 L103.5 115.5 L96.7 118.3 L89.5 120.7 L82.0 122.5 L74.1 123.8 L65.8 124.5 L57.1 124.7 L48.0 124.4 L38.5 123.6 L28.6 122.2 L18.4 120.3 L27.8 124.7 L36.6 129.4 L44.8 134.3 L52.3 139.4 L59.2 144.7 L65.5 150.2 L71.2 155.9 L76.2 161.8 L80.6 167.9 L84.4 174.2 L87.5 180.7 L90.1 187.4 L92.0 194.3 L93.2 201.4 L93.9 208.8 L93.9 216.3 L93.3 224.0 L92.1 232.0 L90.2 240.1 L87.7 248.5 L84.6 257.0 L80.9 265.7 L76.5 274.7 L71.5 283.9 L78.7 276.3 L85.9 269.4 L93.0 263.1 L100.2 257.5 L107.4 252.6 L114.5 248.3 L121.7 244.7 L128.9 241.7 L136.0 239.4 L143.2 237.7 L150.4 236.8 L157.5 236.4 L164.7 236.8 L171.9 237.7 L179.0 239.4 L186.2 241.7 L193.4 244.7 L200.5 248.3 L207.7 252.6 L214.9 257.5 L222.0 263.1 L229.2 269.4 L236.4 276.3 L243.5 283.9 L238.5 274.7 L234.2 265.7 L230.4 257.0 L227.3 248.5 L224.8 240.1 L223.0 232.0 L221.8 224.0 L221.2 216.3 L221.2 208.8 L221.8 201.4 L223.1 194.3 L225.0 187.4 L227.5 180.7 L230.7 174.2 L234.5 167.9 L238.9 161.8 L243.9 155.9 L249.6 150.2 L255.9 144.7 L262.8 139.4 L270.3 134.3 L278.5 129.4 L287.3 124.7 L296.7 120.3 L286.4 122.2 L276.6 123.6 L267.1 124.4 L258.0 124.7 L249.3 124.5 L241.0 123.8 L233.1 122.5 L225.5 120.7 L218.4 118.3 L211.6 115.5 L205.2 112.0 L199.2 108.1 L193.6 103.6 L188.4 98.6 L183.6 93.1 L179.1 87.0 L175.1 80.4 L171.4 73.2 L168.1 65.5 L165.2 57.3 L162.7 48.6 L160.6 39.3 L158.9 29.5 L157.5 19.2 Z`, mat: 'red', level: 1, fin: 'gloss' },
      { d: `M65.3 136.8 L72.1 142.7 L78.2 148.8 L83.8 155.3 L88.7 162.0 L92.9 169.1 L96.5 176.3 L99.7 184.8 L101.8 192.6 L103.2 200.6 L103.9 208.7 L103.9 216.3 L103.2 224.8 L101.9 233.5 L99.9 242.3 L98.8 246.4 L102.2 244.0 L110.0 239.4 L117.9 235.4 L125.8 232.2 L133.0 229.9 L141.0 228.0 L149.0 226.9 L157.1 226.5 L165.2 226.8 L173.2 227.9 L181.3 229.7 L189.3 232.2 L197.2 235.4 L205.0 239.4 L212.8 244.0 L216.3 246.4 L215.1 242.3 L213.1 233.5 L211.8 224.8 L211.2 216.3 L211.2 208.7 L211.9 200.6 L213.3 192.6 L215.4 184.8 L218.2 177.2 L221.7 169.8 L225.9 162.7 L230.8 155.9 L236.3 149.4 L242.5 143.1 L249.3 137.2 L252.6 134.6 L248.4 134.5 L239.4 133.6 L230.7 132.2 L222.4 130.2 L215.3 127.8 L207.7 124.6 L200.5 120.8 L193.7 116.4 L187.4 111.4 L181.5 105.8 L176.1 99.6 L171.1 92.9 L166.6 85.6 L162.5 77.8 L159.0 69.5 L157.5 65.5 L156.1 69.5 L152.5 77.8 L148.5 85.6 L144.0 92.9 L139.5 98.9 L134.2 105.2 L128.3 110.8 L122.1 115.9 L115.3 120.4 L108.2 124.2 L100.6 127.5 L92.7 130.2 L84.3 132.2 L75.7 133.6 L66.7 134.5 L62.4 134.6 Z`, mat: 'white', level: 2, fin: 'panel' },
      { d: `M250.4 293.3 L307.8 116.6 L157.5 7.4 L7.2 116.6 L64.6 293.3 Z M305.2 117.5 L248.8 291.1 L66.2 291.1 L9.8 117.5 L157.5 10.2 Z`, mat: 'gold', level: 1, fin: 'foil' }
    ],
    face: { x: 0.001, y: 0.449, w: 0.32, h: 0.244, level: 2, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/starplaque.2a0ee778.webp", "box": [-6.0, -6.0, 321.19, 306.19]}, tile: "img/designs/tile-starplaque.f7c83927.webp",
  },
  starround: {
    name: "Star Round", group: 'Stars', sheet: 'white', base: 1.06,
    note: "A white disc with a navy crescent and two navy stars breaking out of it.",
    body: `M248.0 43.9 L248.0 0.0 L219.7 33.6 L177.9 20.1 L186.3 33.6 L182.2 32.3 L177.7 31.0 L173.2 29.9 L168.7 28.9 L164.2 28.1 L159.6 27.4 L155.0 26.9 L150.4 26.5 L145.8 26.3 L141.2 26.2 L136.6 26.3 L131.9 26.5 L127.3 26.9 L122.7 27.4 L118.2 28.1 L113.6 28.9 L109.1 29.9 L104.6 31.0 L100.2 32.3 L95.8 33.7 L91.4 35.3 L87.1 37.0 L82.9 38.8 L78.7 40.8 L74.6 42.9 L70.6 45.1 L66.6 47.5 L62.7 50.0 L58.9 52.6 L55.2 55.4 L51.6 58.3 L48.1 61.2 L44.7 64.3 L41.3 67.6 L38.1 70.9 L35.0 74.3 L32.0 77.8 L29.2 81.4 L26.4 85.1 L23.8 88.9 L21.3 92.8 L18.9 96.8 L16.7 100.8 L14.6 104.9 L12.6 109.1 L10.7 113.4 L9.0 117.7 L7.5 122.0 L6.1 126.4 L4.8 130.8 L3.7 135.3 L2.7 139.8 L1.9 144.4 L1.2 149.0 L0.7 153.5 L0.3 158.1 L0.1 162.8 L0.0 167.4 L0.1 172.0 L0.3 176.6 L0.7 181.2 L1.2 185.8 L1.9 190.4 L2.7 194.9 L3.7 199.4 L4.8 203.9 L6.1 208.4 L7.5 212.8 L9.0 217.1 L10.7 221.4 L12.6 225.6 L14.6 229.8 L16.7 233.9 L18.9 238.0 L21.3 241.9 L23.8 245.8 L26.4 249.6 L29.2 253.3 L32.0 256.9 L35.0 260.5 L38.1 263.9 L41.3 267.2 L44.7 270.4 L48.1 273.5 L51.6 276.5 L55.2 279.4 L58.9 282.1 L62.7 284.8 L66.6 287.3 L70.6 289.6 L74.6 291.9 L78.7 294.0 L82.9 296.0 L87.1 297.8 L92.8 300.0 L189.5 300.0 L195.2 297.8 L199.4 296.0 L203.6 294.0 L207.7 291.9 L211.8 289.6 L215.7 287.3 L219.6 284.8 L223.4 282.1 L227.1 279.4 L230.7 276.5 L234.3 273.5 L237.7 270.4 L241.0 267.2 L244.2 263.9 L247.3 260.5 L250.3 256.9 L253.2 253.3 L255.9 249.6 L258.6 245.8 L261.1 241.9 L263.4 238.0 L265.7 233.9 L267.8 229.8 L269.8 225.6 L271.6 221.4 L273.3 217.1 L274.9 212.8 L276.3 208.4 L277.5 203.9 L278.7 199.4 L279.6 194.9 L280.5 190.4 L281.1 185.8 L281.7 181.2 L282.0 176.6 L282.3 172.0 L282.4 167.4 L282.3 162.8 L282.0 158.1 L281.7 153.5 L281.1 149.0 L280.5 144.4 L279.6 139.8 L281.0 134.9 L303.0 131.3 L284.4 118.9 L287.7 96.8 L270.4 110.6 L267.8 104.9 L265.7 100.8 L263.4 96.8 L261.1 92.8 L258.6 88.9 L255.9 85.1 L253.2 81.4 L250.3 77.8 L247.1 74.1 L288.7 60.5 Z`,
    layers: [
      { d: `M247.4 112.1 L250.6 118.5 L252.0 121.8 L253.6 126.2 L242.3 137.7 L257.0 137.0 L258.3 142.4 L259.0 145.9 L259.6 149.5 L260.5 156.6 L260.9 163.8 L261.0 167.4 L260.9 171.0 L260.5 178.1 L259.6 185.3 L259.0 188.8 L257.5 195.9 L255.6 202.8 L254.5 206.2 L252.0 212.9 L250.6 216.2 L247.4 222.7 L243.9 229.0 L240.0 235.0 L235.8 240.8 L233.6 243.6 L228.8 249.0 L223.8 254.1 L221.1 256.6 L218.4 258.9 L212.8 263.4 L206.9 267.5 L203.9 269.4 L197.6 273.0 L191.2 276.2 L184.6 279.0 L177.8 281.4 L174.4 282.5 L167.4 284.3 L163.9 285.0 L156.8 286.1 L149.7 286.9 L146.1 287.1 L142.5 287.2 L135.3 287.0 L128.1 286.5 L124.6 286.0 L117.5 284.8 L110.5 283.2 L103.6 281.1 L100.2 279.9 L92.9 300.0 L96.9 301.4 L100.9 302.7 L105.0 303.8 L109.1 304.9 L113.3 305.8 L117.4 306.5 L121.6 307.2 L125.8 307.7 L130.0 308.1 L134.2 308.4 L138.5 308.5 L142.7 308.5 L146.9 308.4 L151.2 308.2 L155.4 307.8 L159.6 307.3 L163.8 306.7 L168.0 306.0 L172.1 305.1 L176.2 304.1 L180.3 303.0 L184.4 301.8 L188.4 300.4 L192.3 299.0 L196.3 297.4 L200.1 295.7 L204.0 293.8 L207.7 291.9 L211.4 289.8 L215.1 287.7 L218.6 285.4 L222.2 283.0 L225.6 280.5 L228.9 278.0 L232.2 275.3 L235.4 272.5 L238.5 269.6 L241.5 266.7 L244.5 263.6 L247.3 260.5 L250.1 257.2 L252.7 253.9 L255.3 250.5 L257.7 247.1 L260.0 243.6 L262.3 240.0 L264.4 236.3 L266.4 232.6 L268.3 228.8 L270.1 224.9 L271.8 221.1 L273.3 217.1 L274.7 213.1 L276.0 209.1 L277.2 205.0 L278.3 200.9 L279.2 196.8 L280.1 192.7 L280.8 188.5 L281.3 184.3 L281.8 180.1 L282.1 175.8 L282.3 171.6 L282.4 167.4 L282.3 163.1 L282.1 158.9 L281.8 154.7 L281.3 150.5 L280.8 146.3 L279.6 139.8 L281.0 134.9 L303.0 131.3 L284.4 118.9 L287.7 96.8 L270.4 110.6 L268.3 106.0 L266.4 102.2 L264.4 98.5 L262.3 94.8 L260.0 91.2 L257.7 87.7 L255.3 84.2 L252.7 80.8 L250.1 77.5 L247.1 74.1 L288.7 60.5 L248.0 43.9 L248.0 0.0 L219.7 33.6 L177.9 20.1 L201.1 57.4 L175.3 93.0 L218.0 82.4 L243.8 117.9 L244.6 107.0 Z`, mat: 'navy', level: 1, fin: 'gloss' }
    ],
    face: { x: -0.11, y: 0.417, w: 0.634, h: 0.485, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/starround.57e6798c.webp", "box": [-6.0, -6.0, 309.23, 314.62]}, tile: "img/designs/tile-starround.7b94f37d.webp",
  },
  starside: {
    name: "Star & Plaque", group: 'Stars', sheet: 'wood', base: 1.04,
    note: "A wood star on a stem, a glittering gold star set in it, beside its white plaque.",
    body: `M52.4 55.5 L1.1 68.5 L0.5 69.0 L0.3 69.3 L0.0 70.1 L0.0 70.5 L0.2 71.3 L0.8 71.9 L1.1 72.2 L48.2 95.3 L48.9 95.8 L49.3 96.5 L49.4 96.9 L45.9 150.1 L46.2 150.9 L46.8 151.5 L47.5 151.9 L47.9 151.9 L48.8 151.8 L49.4 151.3 L53.2 147.5 L53.6 147.3 L54.4 147.1 L55.2 147.3 L55.8 147.7 L56.3 148.4 L56.4 149.3 L53.1 297.9 L53.3 298.7 L53.7 299.4 L54.4 299.8 L55.2 300.0 L190.5 300.0 L191.2 299.9 L192.0 299.7 L193.2 299.0 L193.9 298.3 L194.3 297.6 L194.5 296.8 L194.6 295.8 L194.6 94.9 L194.5 94.2 L194.3 93.4 L193.7 92.4 L192.9 91.5 L191.8 91.0 L190.6 90.8 L119.9 90.7 L119.2 90.5 L118.9 90.3 L118.4 89.6 L115.1 83.4 L114.9 82.6 L114.9 81.8 L115.4 81.0 L149.0 40.7 L149.4 40.0 L149.5 39.2 L149.4 38.8 L149.0 38.0 L148.6 37.8 L147.9 37.4 L147.1 37.4 L95.4 46.4 L94.9 46.4 L94.1 46.2 L93.5 45.8 L93.1 45.4 L65.2 1.0 L64.7 0.4 L64.3 0.2 L63.5 0.0 L63.1 0.0 L62.7 0.2 L62.0 0.7 L61.8 1.0 L61.5 1.8 L54.0 53.7 L53.9 54.2 L53.5 54.9 L52.9 55.3 Z`,
    layers: [
      { d: `M107.4 292.8 L187.4 292.8 L187.4 98.0 L107.4 98.0 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M64.8 57.8 L64.1 59.9 L62.9 61.8 L61.4 63.5 L59.7 64.8 L58.7 65.3 L56.6 66.1 L28.7 73.1 L55.5 86.3 L57.3 87.7 L58.7 89.3 L59.3 90.3 L60.2 92.3 L60.5 93.4 L60.8 95.6 L58.9 125.4 L78.9 104.7 L80.6 103.3 L81.5 102.7 L83.6 101.8 L84.7 101.6 L85.8 101.4 L88.0 101.3 L89.1 101.5 L91.2 102.1 L98.2 104.9 L98.2 94.8 L98.4 93.6 L98.7 92.4 L99.2 91.6 L99.7 90.9 L100.5 90.1 L101.4 89.5 L102.1 89.2 L103.1 88.9 L103.9 88.8 L105.2 88.7 L104.0 86.4 L103.4 84.3 L103.2 83.2 L103.1 82.1 L103.4 79.8 L104.0 77.7 L104.5 76.7 L105.8 74.9 L124.2 52.8 L94.8 57.9 L93.7 57.9 L91.5 57.6 L89.3 56.9 L88.4 56.4 L86.5 55.2 L85.0 53.5 L69.1 28.3 Z`, mat: 'gold', level: 1, fin: 'glitter' }
    ],
    face: { x: 0.136, y: 0.277, w: 0.273, h: 0.347, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/starside.3592067b.webp", "box": [-6.0, -6.0, 200.72, 306.19]}, tile: "img/designs/tile-starside.568794fc.webp",
  },
  moonstars: {
    name: "Moon & Stars", group: 'Stars', sheet: 'clear', base: 1.04,
    note: "A clear half moon with three gold stars breaking out of its curve, a frosted rim and a fine gold line.",
    body: `M1.9 256.6 L1.3 256.6 L1.0 256.7 L0.5 257.0 L0.3 257.2 L0.0 257.7 L0.0 258.3 L0.1 258.6 L5.6 267.0 L5.8 267.3 L5.9 267.9 L5.8 268.5 L5.6 268.8 L0.3 276.9 L0.0 277.5 L0.0 278.1 L0.3 278.6 L0.7 279.1 L1.0 279.2 L1.6 279.3 L7.7 277.6 L8.5 277.8 L9.1 278.4 L9.3 279.0 L10.4 286.3 L11.9 294.8 L12.8 298.8 L13.2 299.6 L14.0 300.0 L163.9 300.0 L164.5 299.9 L165.2 299.3 L165.4 298.5 L165.4 1.5 L165.4 1.2 L165.2 0.6 L164.7 0.2 L164.5 0.1 L163.9 0.0 L163.3 0.1 L155.4 3.9 L147.7 7.8 L140.1 12.1 L132.6 16.6 L125.2 21.3 L118.1 26.3 L111.1 31.5 L104.2 36.9 L97.6 42.5 L91.2 48.3 L84.9 54.4 L78.8 60.7 L72.9 67.2 L67.3 73.8 L61.9 80.6 L56.7 87.7 L51.8 94.8 L47.0 102.1 L42.5 109.6 L38.3 117.2 L34.3 125.0 L30.6 132.9 L27.1 140.9 L23.9 149.0 L21.0 157.2 L18.3 165.5 L15.9 173.9 L13.8 182.4 L12.0 190.8 L11.2 195.0 L10.8 195.5 L10.6 195.7 L10.0 195.9 L7.7 195.8 L7.1 195.9 L6.6 196.2 L6.4 196.4 L6.1 197.0 L6.1 197.6 L6.3 198.1 L9.4 201.2 L9.8 201.7 L9.9 202.3 L9.1 208.1 L8.1 216.7 L7.4 225.4 L7.0 234.1 L6.8 242.8 L7.0 251.5 L7.2 256.3 L6.8 257.1 L6.4 257.4 L5.9 257.6 L5.2 257.5 Z`,
    layers: [
      { d: `M18.8 210.4 L11.0 230.1 L29.8 220.2 L46.1 233.8 L42.5 212.9 L60.5 201.5 L39.5 198.4 L34.2 177.9 L24.8 196.9 L3.6 195.5 Z M82.8 268.8 L105.4 280.7 L95.9 257.0 L114.2 239.2 L88.7 240.9 L77.4 218.0 L71.2 242.7 L45.9 246.4 L67.5 260.0 L63.2 285.1 Z M12.3 276.3 L21.6 287.9 L22.2 273.1 L36.1 267.9 L22.2 262.7 L21.6 247.9 L12.3 259.5 L-2.0 255.5 L6.2 267.9 L-2.0 280.3 Z`, mat: 'gold', level: 1, fin: 'glitter' },
      { d: `M17.0 170.4 L17.0 171.1 L17.1 171.7 L17.4 172.2 L17.8 172.7 L18.2 173.1 L18.8 173.4 L19.3 173.6 L20.0 173.7 L23.6 173.6 L24.7 173.2 L25.5 172.5 L26.0 171.5 L27.0 168.0 L29.5 160.0 L32.3 152.2 L35.4 144.4 L38.8 136.5 L42.4 129.0 L46.2 121.6 L50.4 114.1 L54.7 106.8 L59.2 99.9 L64.0 92.9 L69.0 86.2 L74.3 79.5 L79.8 73.0 L85.4 66.9 L91.3 60.8 L97.3 55.0 L103.5 49.3 L110.0 43.8 L116.6 38.6 L123.4 33.5 L130.3 28.7 L137.3 24.3 L144.5 19.9 L151.9 15.8 L152.6 15.5 L153.9 15.4 L154.5 15.2 L155.0 15.0 L155.5 14.6 L155.9 14.1 L156.2 13.6 L156.4 13.0 L156.4 8.3 L156.4 7.7 L156.2 7.1 L155.9 6.6 L155.5 6.1 L155.0 5.7 L154.4 5.5 L153.8 5.3 L153.2 5.3 L152.6 5.4 L147.7 7.8 L140.1 12.0 L132.6 16.5 L125.3 21.3 L118.1 26.3 L111.1 31.5 L104.2 36.9 L97.6 42.5 L91.2 48.3 L84.9 54.4 L78.8 60.7 L73.0 67.1 L67.4 73.8 L61.9 80.7 L56.7 87.7 L51.7 94.8 L47.0 102.1 L42.6 109.6 L38.3 117.3 L34.3 124.9 L30.6 132.8 L27.1 140.9 L23.9 149.0 L21.0 157.1 L18.3 165.5 Z`, mat: 'frost', level: 1, fin: 'frost' },
      { d: `M28.7 172.8 L28.8 173.1 L29.0 173.4 L29.4 173.7 L30.3 173.6 L30.7 173.2 L31.7 169.6 L34.3 161.7 L37.1 153.9 L40.1 146.3 L43.4 138.6 L46.9 131.2 L50.7 123.9 L54.7 116.6 L58.9 109.5 L63.4 102.6 L68.1 95.8 L73.0 89.2 L78.2 82.7 L83.5 76.4 L89.1 70.3 L94.8 64.3 L100.8 58.6 L106.9 53.1 L113.2 47.7 L119.7 42.6 L126.3 37.6 L133.0 33.0 L140.0 28.5 L145.1 25.4 L145.4 25.0 L145.4 24.3 L145.3 24.0 L145.0 23.7 L144.6 23.5 L144.2 23.6 L139.0 26.8 L132.0 31.3 L125.1 36.0 L118.4 41.0 L111.9 46.2 L105.6 51.5 L99.4 57.1 L93.4 62.9 L87.6 68.9 L82.0 75.1 L76.6 81.4 L71.5 87.9 L66.5 94.7 L61.7 101.5 L57.2 108.5 L52.9 115.6 L48.9 122.9 L45.1 130.3 L41.5 137.9 L38.2 145.5 L35.2 153.2 L32.4 161.1 L29.8 169.0 Z`, mat: 'gold', level: 1, fin: 'foil' }
    ],
    face: { x: 0.078, y: 0.476, w: 0.323, h: 0.352, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/moonstars.387f35ff.webp", "box": [-7.98, -6.0, 171.55, 306.19]}, tile: "img/designs/tile-moonstars.4d13a8f8.webp",
  },
  twinstar: {
    name: "Twin Stars", group: 'Stars', sheet: 'clear', base: 1.08,
    note: "A clear panel with a gold and a silver star breaking out of its top.",
    body: `M92.3 72.3 L126.7 39.4 L79.2 42.9 L58.5 0.0 L47.2 46.2 L0.0 52.7 L35.6 74.7 L22.9 74.7 L21.3 74.8 L19.7 75.0 L18.2 75.4 L16.7 76.0 L15.2 76.6 L13.9 77.5 L12.6 78.4 L11.4 79.5 L10.3 80.7 L9.4 81.9 L8.6 83.3 L7.9 84.7 L7.4 86.2 L7.0 87.8 L6.7 89.4 L6.7 91.0 L6.7 283.8 L6.7 285.4 L7.0 286.9 L7.4 288.5 L7.9 290.0 L8.6 291.4 L9.4 292.8 L10.3 294.1 L11.4 295.2 L12.6 296.3 L13.9 297.3 L15.2 298.1 L16.7 298.8 L18.2 299.3 L19.7 299.7 L21.3 299.9 L22.9 300.0 L173.1 300.0 L174.7 299.9 L176.2 299.7 L177.8 299.3 L179.3 298.8 L180.7 298.1 L182.1 297.3 L183.4 296.3 L184.6 295.2 L185.6 294.1 L186.6 292.8 L187.4 291.4 L188.1 290.0 L188.6 288.5 L189.0 286.9 L189.2 285.4 L189.3 283.8 L189.3 90.8 L205.1 82.4 L182.2 77.6 L180.7 76.6 L179.3 76.0 L177.8 75.4 L176.2 75.0 L174.7 74.8 L172.6 74.7 L167.0 43.0 L150.4 71.6 L117.7 67.0 L124.6 74.7 L93.3 74.7 Z`,
    layers: [
      { d: `M114.1 114.8 L114.3 115.6 L114.4 116.8 L114.1 117.9 L113.5 119.0 L112.6 119.8 L111.5 120.3 L110.3 120.4 L109.1 120.3 L108.4 120.0 L68.9 98.7 L34.6 127.7 L33.6 128.3 L32.9 128.6 L31.7 128.7 L30.9 128.5 L30.2 128.2 L29.5 127.8 L28.7 126.9 L28.3 126.2 L28.1 125.5 L28.0 124.3 L34.7 86.9 L22.5 86.9 L21.3 87.2 L20.6 87.6 L19.8 88.4 L19.3 89.1 L18.9 90.2 L18.8 91.3 L18.8 283.5 L18.9 284.6 L19.3 285.7 L20.0 286.6 L21.0 287.3 L22.1 287.7 L23.2 287.8 L172.8 287.8 L173.9 287.7 L175.0 287.3 L175.9 286.6 L176.6 285.7 L177.0 284.6 L177.1 283.5 L177.1 134.3 L176.5 133.8 L154.7 112.7 L126.6 125.2 L125.4 125.4 L124.2 125.3 L123.1 124.8 L122.5 124.3 L121.8 123.4 L121.3 122.3 L121.2 121.1 L121.5 119.9 L134.9 92.3 L130.1 86.9 L102.7 86.9 Z`, mat: 'frost', level: 1, fin: 'frost' },
      { d: `M47.2 46.2 L0.0 52.7 L40.5 77.8 L32.0 124.6 L68.4 93.9 L110.3 116.4 L92.3 72.3 L126.7 39.4 L79.2 42.9 L58.5 0.0 Z`, mat: 'gold', level: 1, fin: 'glitter' },
      { d: `M117.7 67.0 L139.8 91.6 L125.3 121.4 L155.5 107.9 L179.3 130.9 L175.9 98.0 L205.1 82.4 L172.7 75.5 L167.0 43.0 L150.4 71.6 Z`, mat: 'silver', level: 1, fin: 'foil' }
    ],
    face: { x: 0.009, y: 0.314, w: 0.455, h: 0.463, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/twinstar.4d41a1ae.webp", "box": [-6.0, -6.0, 211.27, 306.19]}, tile: "img/designs/tile-twinstar.977a0537.webp",
  },
  starburst: {
    name: "Star Burst", group: 'Stars', sheet: 'gold', base: 1.06,
    note: "A sixteen-point gold burst round a white disc.",
    body: `M227.7 262.1 L270.5 270.5 L262.1 227.7 L304.8 219.1 L280.7 182.8 L316.9 158.5 L280.7 134.1 L304.8 97.8 L262.1 89.2 L270.5 46.4 L227.7 54.8 L219.1 12.1 L182.8 36.2 L158.5 0.0 L134.1 36.2 L97.8 12.1 L89.2 54.8 L46.4 46.4 L54.8 89.2 L12.1 97.8 L36.2 134.1 L0.0 158.5 L36.2 182.8 L12.1 219.1 L54.8 227.7 L46.4 270.5 L89.2 262.1 L96.8 300.0 L105.1 300.0 L134.1 280.7 L147.1 300.0 L169.8 300.0 L182.8 280.7 L211.8 300.0 L220.1 300.0 Z`,
    layers: [
      { d: `M264.0 155.0 L263.6 148.1 L263.2 144.7 L262.7 141.2 L261.3 134.5 L260.5 131.1 L258.5 124.5 L256.0 118.0 L254.7 114.9 L253.2 111.7 L249.9 105.6 L248.2 102.7 L244.3 96.9 L242.3 94.1 L237.9 88.8 L233.1 83.8 L230.7 81.4 L225.5 76.8 L222.8 74.6 L217.1 70.6 L214.2 68.7 L211.3 67.0 L205.2 63.7 L198.9 60.9 L195.7 59.6 L192.4 58.4 L185.8 56.4 L182.4 55.6 L175.7 54.2 L168.8 53.3 L165.4 53.0 L161.9 52.9 L155.0 52.9 L148.1 53.3 L144.7 53.7 L141.2 54.2 L134.5 55.6 L127.8 57.4 L124.5 58.4 L121.2 59.6 L114.9 62.2 L108.7 65.3 L105.6 67.0 L102.7 68.7 L96.9 72.6 L91.4 76.8 L88.8 79.0 L86.2 81.4 L81.4 86.2 L76.8 91.4 L74.6 94.1 L70.6 99.8 L68.7 102.7 L67.0 105.6 L63.7 111.7 L60.9 118.0 L59.6 121.2 L58.4 124.5 L56.4 131.1 L54.8 137.8 L54.2 141.2 L53.3 148.1 L53.0 151.5 L52.9 155.0 L52.9 161.9 L53.3 168.8 L53.7 172.2 L54.8 179.1 L55.6 182.4 L56.4 185.8 L58.4 192.4 L59.6 195.7 L62.2 202.0 L65.3 208.2 L67.0 211.3 L70.6 217.1 L72.6 220.0 L74.6 222.8 L79.0 228.1 L81.4 230.7 L86.2 235.5 L88.8 237.9 L94.1 242.3 L96.9 244.3 L102.7 248.2 L105.6 249.9 L111.7 253.2 L114.9 254.7 L121.2 257.3 L127.8 259.5 L131.1 260.5 L134.5 261.3 L141.2 262.7 L148.1 263.6 L151.5 263.9 L158.5 264.1 L161.9 264.0 L168.8 263.6 L172.2 263.2 L175.7 262.7 L182.4 261.3 L185.8 260.5 L192.4 258.5 L198.9 256.0 L202.0 254.7 L205.2 253.2 L211.3 249.9 L214.2 248.2 L220.0 244.3 L225.5 240.1 L228.1 237.9 L230.7 235.5 L235.5 230.7 L240.1 225.5 L242.3 222.8 L244.3 220.0 L248.2 214.2 L249.9 211.3 L253.2 205.2 L254.7 202.0 L257.3 195.7 L258.5 192.4 L260.5 185.8 L261.3 182.4 L262.7 175.7 L263.6 168.8 L263.9 165.4 L264.1 158.5 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M272.3 151.0 L272.0 147.3 L271.6 143.6 L271.0 139.9 L270.3 136.2 L269.6 132.5 L268.6 128.9 L267.6 125.3 L266.5 121.8 L265.2 118.3 L263.9 114.8 L262.4 111.4 L260.8 108.0 L259.1 104.7 L257.3 101.4 L255.3 98.2 L253.3 95.1 L251.2 92.0 L249.0 89.0 L246.6 86.1 L244.2 83.2 L241.7 80.5 L239.1 77.8 L236.4 75.2 L233.7 72.7 L230.8 70.3 L227.9 67.9 L224.9 65.7 L221.8 63.6 L218.7 61.6 L215.5 59.7 L212.2 57.8 L208.9 56.1 L205.5 54.5 L202.1 53.1 L198.6 51.7 L195.1 50.4 L191.6 49.3 L188.0 48.3 L184.4 47.3 L180.7 46.6 L177.0 45.9 L173.3 45.3 L169.6 44.9 L165.9 44.6 L162.2 44.4 L158.5 44.4 L154.7 44.4 L151.0 44.6 L147.3 44.9 L143.6 45.3 L139.9 45.9 L136.2 46.6 L132.5 47.3 L128.9 48.3 L125.3 49.3 L121.8 50.4 L118.3 51.7 L114.8 53.1 L111.4 54.5 L108.0 56.1 L104.7 57.8 L101.4 59.7 L98.2 61.6 L95.1 63.6 L92.0 65.7 L89.0 67.9 L86.1 70.3 L83.2 72.7 L80.5 75.2 L77.8 77.8 L75.2 80.5 L72.7 83.2 L70.3 86.1 L67.9 89.0 L65.7 92.0 L63.6 95.1 L61.6 98.2 L59.7 101.4 L57.8 104.7 L56.1 108.0 L54.5 111.4 L53.1 114.8 L51.7 118.3 L50.4 121.8 L49.3 125.3 L48.3 128.9 L47.3 132.5 L46.6 136.2 L45.9 139.9 L45.3 143.6 L44.9 147.3 L44.6 151.0 L44.4 154.7 L44.4 158.5 L44.4 162.2 L44.6 165.9 L44.9 169.6 L45.3 173.3 L45.9 177.0 L46.6 180.7 L47.3 184.4 L48.3 188.0 L49.3 191.6 L50.4 195.1 L51.7 198.6 L53.1 202.1 L54.5 205.5 L56.1 208.9 L57.8 212.2 L59.7 215.5 L61.6 218.7 L63.6 221.8 L65.7 224.9 L67.9 227.9 L70.3 230.8 L72.7 233.7 L75.2 236.4 L77.8 239.1 L80.5 241.7 L83.2 244.2 L86.1 246.6 L89.0 249.0 L92.0 251.2 L95.1 253.3 L98.2 255.3 L101.4 257.3 L104.7 259.1 L108.0 260.8 L111.4 262.4 L114.8 263.9 L118.3 265.2 L121.8 266.5 L125.3 267.6 L128.9 268.6 L132.5 269.6 L136.2 270.3 L139.9 271.0 L143.6 271.6 L147.3 272.0 L151.0 272.3 L154.7 272.5 L158.5 272.5 L162.2 272.5 L165.9 272.3 L169.6 272.0 L173.3 271.6 L177.0 271.0 L180.7 270.3 L184.4 269.6 L188.0 268.6 L191.6 267.6 L195.1 266.5 L198.6 265.2 L202.1 263.9 L205.5 262.4 L208.9 260.8 L212.2 259.1 L215.5 257.3 L218.7 255.3 L221.8 253.3 L224.9 251.2 L227.9 249.0 L230.8 246.6 L233.7 244.2 L236.4 241.7 L239.1 239.1 L241.7 236.4 L244.2 233.7 L246.6 230.8 L249.0 227.9 L251.2 224.9 L253.3 221.8 L255.3 218.7 L257.3 215.5 L259.1 212.2 L260.8 208.9 L262.4 205.5 L263.9 202.1 L265.2 198.6 L266.5 195.1 L267.6 191.6 L268.6 188.0 L269.6 184.4 L270.3 180.7 L271.0 177.0 L271.6 173.3 L272.0 169.6 L272.3 165.9 L272.5 162.2 L272.5 158.5 L272.5 154.7 Z M268.3 162.0 L267.8 169.2 L266.8 176.3 L265.4 183.4 L264.6 186.9 L263.6 190.3 L261.3 197.1 L259.9 200.5 L257.0 207.0 L255.3 210.2 L251.7 216.5 L247.7 222.4 L245.6 225.3 L243.4 228.1 L238.6 233.5 L236.1 236.1 L230.9 241.0 L228.1 243.4 L222.4 247.7 L216.5 251.7 L213.4 253.6 L207.0 257.0 L203.8 258.5 L197.1 261.3 L193.8 262.5 L186.9 264.6 L183.4 265.4 L179.9 266.2 L172.8 267.4 L165.6 268.1 L162.0 268.3 L154.9 268.3 L151.3 268.1 L147.7 267.8 L140.6 266.8 L137.0 266.2 L130.0 264.6 L126.6 263.6 L119.8 261.3 L116.4 259.9 L109.9 257.0 L103.5 253.6 L100.4 251.7 L94.5 247.7 L91.6 245.6 L88.8 243.4 L83.4 238.6 L80.8 236.1 L75.9 230.9 L71.3 225.3 L69.2 222.4 L67.1 219.5 L63.3 213.4 L61.6 210.2 L58.4 203.8 L57.0 200.5 L54.4 193.8 L52.3 186.9 L51.5 183.4 L50.7 179.9 L49.5 172.8 L48.8 165.6 L48.7 162.0 L48.7 154.9 L48.8 151.3 L49.5 144.1 L50.1 140.6 L51.5 133.5 L52.3 130.0 L54.4 123.1 L55.6 119.8 L57.0 116.4 L59.9 109.9 L63.3 103.5 L65.2 100.4 L67.1 97.4 L71.3 91.6 L75.9 86.0 L78.3 83.4 L80.8 80.8 L86.0 75.9 L88.8 73.5 L94.5 69.2 L100.4 65.2 L103.5 63.3 L106.7 61.6 L113.1 58.4 L119.8 55.6 L123.1 54.4 L130.0 52.3 L133.5 51.5 L137.0 50.7 L144.1 49.5 L147.7 49.1 L154.9 48.7 L162.0 48.7 L165.6 48.8 L172.8 49.5 L176.3 50.1 L179.9 50.7 L186.9 52.3 L190.3 53.3 L197.1 55.6 L200.5 57.0 L207.0 59.9 L210.2 61.6 L216.5 65.2 L222.4 69.2 L225.3 71.3 L230.9 75.9 L233.5 78.3 L236.1 80.8 L241.0 86.0 L243.4 88.8 L247.7 94.5 L249.8 97.4 L253.6 103.5 L257.0 109.9 L258.5 113.1 L259.9 116.4 L262.5 123.1 L263.6 126.6 L265.4 133.5 L266.2 137.0 L267.4 144.1 L268.1 151.3 L268.3 154.9 Z`, mat: 'black', level: 1, fin: 'gloss' }
    ],
    face: { x: 0.0, y: 0.472, w: 0.575, h: 0.44, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/starburst.e5a5d97a.webp", "box": [-6.0, -6.0, 323.06, 306.19]}, tile: "img/designs/tile-starburst.1e863165.webp",
  },
  wave: {
    name: "Scallop Sail", group: 'Curves', sheet: 'clear', base: 1.04,
    note: "A clear sail: a frosted scalloped band along its curve and a fine gold arc inside it.",
    body: `M0.2 297.1 L0.0 297.9 L0.1 298.7 L0.3 299.0 L0.5 299.4 L1.2 299.8 L2.0 300.0 L149.1 299.9 L153.2 297.9 L158.0 295.2 L162.7 292.4 L167.4 289.4 L171.9 286.3 L176.3 283.0 L180.6 279.6 L184.8 276.1 L188.8 272.4 L192.8 268.5 L196.7 264.5 L200.3 260.5 L203.9 256.3 L207.3 252.0 L210.6 247.5 L213.7 243.0 L216.7 238.4 L219.5 233.7 L222.2 228.9 L224.7 224.0 L227.1 219.0 L229.2 214.0 L231.3 208.9 L233.1 203.6 L234.8 198.5 L236.3 193.2 L237.7 187.8 L238.8 182.4 L239.8 177.1 L240.6 171.5 L241.2 166.1 L241.7 160.7 L242.0 155.1 L242.0 149.7 L242.0 144.2 L241.7 138.6 L241.2 133.1 L240.6 127.7 L239.8 122.2 L238.8 116.9 L237.7 111.5 L236.3 106.1 L234.8 100.9 L233.1 95.6 L231.3 90.4 L229.2 85.3 L227.1 80.3 L224.7 75.3 L222.2 70.4 L219.5 65.6 L216.7 60.8 L213.7 56.3 L210.6 51.7 L207.3 47.3 L203.9 43.0 L200.4 38.8 L196.6 34.7 L192.8 30.8 L188.9 27.0 L184.8 23.2 L180.6 19.7 L176.3 16.3 L171.8 13.0 L167.3 9.8 L162.7 6.9 L158.0 4.0 L150.9 0.2 L150.2 0.0 L149.4 0.1 L148.7 0.5 L148.2 1.1 Z`,
    layers: [
      { d: `M106.7 299.3 L106.9 299.6 L107.2 299.9 L107.5 300.0 L139.5 300.0 L139.8 299.9 L147.0 296.6 L153.3 293.3 L159.5 289.7 L165.5 285.8 L171.4 281.7 L178.2 276.4 L183.6 271.7 L188.8 266.8 L192.8 262.7 L197.7 257.4 L202.2 251.9 L205.7 247.4 L209.9 241.6 L213.8 235.5 L216.7 230.6 L220.1 224.3 L223.2 217.9 L226.0 211.3 L228.6 204.6 L230.4 199.2 L232.4 192.3 L234.1 185.3 L235.3 179.7 L236.4 172.7 L237.3 165.6 L237.7 159.8 L238.0 152.7 L238.0 147.0 L237.7 139.8 L237.3 134.1 L236.7 128.4 L235.6 121.3 L234.5 115.7 L232.9 108.7 L231.3 103.2 L229.6 97.7 L227.2 91.0 L225.1 85.7 L222.1 79.2 L219.6 74.0 L216.1 67.8 L213.2 62.8 L209.3 56.9 L206.0 52.2 L201.6 46.5 L197.9 42.1 L194.1 37.9 L189.1 32.7 L184.9 28.8 L179.6 24.1 L175.1 20.4 L169.4 16.2 L164.7 12.9 L158.6 9.1 L152.4 5.5 L148.6 3.5 L147.7 3.1 L147.3 3.2 L147.0 3.6 L141.0 15.6 L140.9 16.0 L141.1 16.5 L141.5 16.7 L142.0 16.7 L143.0 15.8 L143.8 15.3 L144.8 14.8 L145.8 14.6 L146.8 14.5 L147.8 14.6 L148.6 14.8 L149.6 15.2 L150.6 15.8 L151.4 16.6 L152.2 17.6 L152.7 18.7 L152.9 19.9 L153.0 21.1 L152.8 22.2 L152.4 23.6 L152.5 24.1 L152.8 24.3 L153.9 25.0 L154.3 25.0 L154.6 24.9 L155.8 23.8 L156.9 23.1 L158.3 22.7 L159.7 22.6 L160.9 22.7 L162.1 23.1 L163.2 23.8 L164.1 24.7 L164.7 25.5 L165.2 26.4 L165.5 27.4 L165.7 28.2 L165.7 29.2 L165.6 30.0 L165.3 31.0 L164.8 32.1 L164.8 32.5 L165.1 32.9 L165.9 33.6 L166.2 33.8 L166.7 33.8 L167.9 32.9 L168.9 32.4 L170.1 32.0 L171.3 31.9 L172.5 32.0 L173.5 32.3 L174.6 32.8 L175.5 33.5 L176.2 34.3 L176.9 35.4 L177.3 36.5 L177.5 37.5 L177.5 38.5 L177.3 39.5 L176.9 40.7 L176.2 42.0 L176.2 42.3 L176.3 42.7 L177.4 43.7 L177.8 43.8 L178.2 43.7 L179.4 42.9 L180.5 42.5 L181.9 42.3 L183.1 42.4 L184.1 42.7 L185.0 43.1 L185.9 43.6 L186.6 44.3 L187.4 45.3 L187.9 46.3 L188.2 47.3 L188.3 48.5 L188.2 49.6 L187.9 50.7 L187.4 51.8 L186.6 52.9 L186.6 53.4 L186.7 53.7 L187.6 54.7 L188.0 54.9 L188.3 54.8 L189.6 54.2 L190.8 53.9 L192.0 53.8 L193.2 54.0 L194.0 54.2 L194.9 54.6 L195.7 55.2 L196.5 55.9 L197.2 56.9 L197.7 58.0 L198.0 59.2 L198.0 60.4 L197.8 61.6 L197.4 62.7 L196.7 63.8 L195.8 64.9 L195.7 65.3 L195.9 65.6 L196.6 66.7 L197.0 66.9 L197.4 66.9 L198.8 66.4 L200.1 66.2 L201.5 66.3 L202.9 66.8 L203.9 67.4 L204.9 68.3 L205.6 69.3 L206.2 70.4 L206.4 71.4 L206.5 72.4 L206.4 73.4 L206.2 74.4 L205.8 75.2 L205.3 76.0 L204.7 76.8 L203.9 77.5 L203.7 78.0 L203.8 78.4 L204.3 79.4 L204.6 79.8 L205.0 79.9 L206.4 79.5 L207.5 79.4 L208.6 79.5 L209.8 79.9 L210.7 80.4 L211.7 81.1 L212.5 82.0 L213.1 83.0 L213.5 84.2 L213.7 85.2 L213.6 86.4 L213.4 87.5 L212.9 88.5 L212.3 89.6 L211.5 90.3 L210.4 91.2 L210.2 91.6 L210.3 92.0 L210.8 93.2 L211.2 93.5 L211.5 93.5 L213.0 93.3 L214.0 93.3 L215.2 93.6 L216.3 94.1 L217.2 94.7 L217.8 95.3 L218.4 96.0 L218.9 96.9 L219.3 98.1 L219.5 99.3 L219.4 100.5 L219.1 101.7 L218.5 102.8 L217.8 103.8 L216.9 104.5 L215.6 105.3 L215.5 105.6 L215.4 106.1 L215.8 107.3 L216.2 107.7 L216.5 107.7 L218.2 107.7 L219.4 107.9 L220.7 108.5 L221.8 109.3 L222.7 110.2 L223.3 111.3 L223.7 112.5 L223.8 113.7 L223.8 114.7 L223.6 115.7 L223.2 116.6 L222.7 117.5 L222.1 118.1 L221.4 118.8 L220.6 119.3 L219.5 119.8 L219.2 120.2 L219.1 120.7 L219.4 121.8 L219.6 122.2 L219.9 122.4 L221.3 122.5 L222.3 122.7 L223.4 123.2 L224.5 123.8 L225.3 124.7 L226.0 125.7 L226.4 126.6 L226.7 127.8 L226.7 128.9 L226.6 130.0 L226.2 131.0 L225.7 132.1 L224.9 133.0 L224.0 133.8 L223.0 134.3 L221.6 134.8 L221.4 135.2 L221.3 135.5 L221.4 136.7 L221.6 137.1 L222.0 137.4 L223.1 137.5 L224.1 137.8 L225.0 138.2 L225.7 138.7 L226.4 139.4 L227.1 140.2 L227.5 141.0 L227.9 142.0 L228.1 143.2 L228.0 144.4 L227.7 145.8 L227.2 146.9 L226.3 148.0 L225.2 148.9 L224.1 149.4 L222.5 149.8 L222.3 150.0 L222.0 150.4 L222.0 151.7 L222.1 152.1 L222.4 152.4 L223.7 152.7 L224.9 153.3 L225.8 154.0 L226.7 154.9 L227.3 155.9 L227.7 157.0 L227.9 158.2 L227.9 159.5 L227.7 160.4 L227.4 161.2 L226.9 162.1 L226.3 162.9 L225.3 163.7 L224.3 164.3 L223.2 164.7 L221.7 164.9 L221.5 165.0 L221.2 165.4 L221.0 166.8 L221.1 167.2 L221.3 167.4 L222.8 168.0 L223.9 168.6 L224.6 169.3 L225.2 170.1 L225.7 171.0 L226.1 172.2 L226.3 173.3 L226.2 174.4 L225.9 175.5 L225.4 176.7 L224.8 177.5 L224.0 178.4 L223.0 179.0 L221.9 179.5 L220.8 179.7 L219.3 179.8 L218.9 180.1 L218.8 180.4 L218.5 181.5 L218.6 182.0 L218.9 182.4 L219.8 182.8 L220.7 183.3 L221.4 184.0 L221.9 184.6 L222.5 185.5 L222.8 186.5 L223.0 187.5 L223.1 188.5 L222.9 189.7 L222.5 190.8 L221.8 192.0 L221.0 192.9 L219.8 193.7 L218.5 194.2 L217.3 194.5 L215.6 194.4 L215.3 194.4 L215.0 194.8 L214.6 196.0 L214.5 196.5 L214.7 196.8 L216.0 197.6 L216.9 198.4 L217.6 199.4 L218.1 200.5 L218.4 201.7 L218.4 202.9 L218.2 204.1 L217.8 205.3 L217.4 206.0 L216.7 206.8 L216.0 207.5 L215.3 207.9 L214.2 208.4 L212.9 208.7 L211.8 208.7 L210.4 208.5 L210.1 208.5 L209.7 208.8 L209.1 210.2 L209.1 210.5 L209.2 210.8 L210.4 211.8 L211.2 212.7 L211.7 213.6 L212.1 214.5 L212.3 215.7 L212.3 216.9 L212.1 218.1 L211.7 219.1 L211.1 220.1 L210.3 220.9 L209.4 221.6 L208.4 222.1 L207.2 222.4 L206.0 222.5 L204.9 222.4 L203.5 222.0 L203.1 222.2 L202.9 222.4 L202.3 223.4 L202.2 223.9 L202.4 224.3 L203.2 225.1 L203.9 225.9 L204.3 226.6 L204.7 227.5 L204.9 228.5 L204.9 229.4 L204.8 230.4 L204.6 231.4 L204.0 232.6 L203.3 233.6 L202.3 234.4 L201.3 235.0 L199.9 235.4 L198.5 235.6 L197.3 235.4 L195.7 234.8 L195.4 234.8 L194.9 235.0 L194.2 236.0 L194.0 236.3 L194.1 236.8 L195.1 238.0 L195.6 239.0 L196.0 240.2 L196.2 241.4 L196.1 242.6 L195.8 243.8 L195.3 244.9 L194.5 245.8 L193.9 246.4 L193.1 247.0 L192.2 247.4 L191.2 247.7 L190.0 247.8 L188.8 247.7 L187.8 247.4 L186.4 246.7 L186.1 246.7 L185.7 246.8 L184.7 247.9 L184.6 248.2 L184.6 248.5 L185.5 249.9 L186.0 251.1 L186.2 252.0 L186.3 252.9 L186.2 254.1 L185.8 255.2 L185.2 256.3 L184.6 257.1 L183.7 257.9 L182.7 258.5 L181.7 258.9 L180.5 259.1 L179.3 259.0 L178.1 258.8 L177.1 258.4 L175.9 257.6 L175.5 257.5 L175.1 257.7 L174.3 258.5 L174.0 258.9 L174.1 259.4 L174.6 260.4 L175.0 261.3 L175.2 262.3 L175.3 263.1 L175.2 264.1 L174.9 265.1 L174.5 266.1 L174.0 266.9 L173.1 267.8 L172.1 268.5 L170.9 269.0 L169.7 269.3 L168.3 269.3 L166.9 268.9 L165.8 268.4 L164.5 267.4 L164.2 267.3 L163.8 267.4 L162.7 268.1 L162.5 268.4 L162.4 268.8 L163.0 270.2 L163.2 271.3 L163.3 272.6 L163.1 273.8 L162.6 274.9 L162.0 276.0 L161.1 276.8 L160.2 277.6 L159.3 278.0 L158.3 278.3 L157.4 278.4 L156.5 278.4 L155.3 278.1 L154.1 277.6 L153.3 277.1 L152.1 276.0 L151.8 275.8 L151.4 275.9 L150.1 276.6 L149.9 276.9 L149.9 277.2 L150.3 278.7 L150.4 280.0 L150.3 281.0 L150.1 281.9 L149.7 282.9 L149.0 283.9 L148.2 284.8 L147.2 285.4 L146.0 285.9 L145.0 286.1 L143.8 286.2 L142.6 286.0 L141.7 285.6 L140.8 285.1 L139.8 284.4 L138.8 283.2 L138.5 283.0 L138.2 283.1 L136.9 283.7 L136.6 284.1 L136.5 284.4 L136.8 285.8 L136.8 287.0 L136.6 288.2 L136.1 289.3 L135.7 290.0 L135.0 290.8 L134.2 291.5 L133.4 292.0 L132.3 292.4 L131.1 292.6 L129.8 292.6 L128.7 292.3 L127.5 291.8 L126.6 291.1 L125.7 290.2 L124.9 289.1 L124.5 288.9 L124.2 288.9 L123.1 289.3 L122.7 289.6 L122.6 290.1 L122.7 291.2 L122.6 292.2 L122.2 293.9 L121.7 294.8 L121.1 295.6 L120.4 296.3 L119.6 296.8 L118.3 297.4 L116.9 297.7 L115.6 297.6 L114.3 297.3 L113.2 296.7 L112.4 296.1 L111.4 295.1 L110.5 293.5 L110.1 293.3 L109.8 293.3 L108.5 293.6 L108.2 294.0 L108.1 294.3 L108.1 295.7 L107.9 296.7 L107.5 297.8 L106.8 298.9 Z M93.1 299.7 L93.3 299.9 L93.7 300.0 L96.4 300.0 L96.7 299.9 L96.9 299.6 L97.0 299.2 L97.0 298.9 L96.2 297.6 L95.9 296.6 L95.5 296.3 L95.2 296.2 L93.7 296.4 L93.4 296.7 L93.2 297.0 L93.1 298.1 L92.9 299.1 Z`, mat: 'frost', level: 1, fin: 'frost' },
      { d: `M141.0 29.0 L146.2 32.0 L151.3 35.3 L155.2 38.1 L160.0 41.7 L163.7 44.8 L168.2 48.8 L172.5 53.0 L176.6 57.4 L180.6 62.0 L183.5 65.7 L187.1 70.6 L189.8 74.6 L193.0 79.7 L195.3 83.9 L197.5 88.2 L200.1 93.6 L202.4 99.2 L204.5 104.8 L206.3 110.6 L207.6 115.2 L209.0 121.1 L209.9 125.8 L210.8 131.8 L211.4 136.6 L211.8 142.6 L212.0 147.4 L211.9 153.4 L211.6 159.4 L211.1 165.4 L210.4 170.2 L209.6 174.9 L208.4 180.8 L206.9 186.7 L205.5 191.3 L204.0 195.9 L201.9 201.5 L200.0 205.9 L197.4 211.4 L195.2 215.6 L192.2 220.9 L189.6 225.0 L186.2 229.9 L182.6 234.7 L179.6 238.5 L176.4 242.1 L172.3 246.5 L168.0 250.7 L164.4 253.9 L159.7 257.8 L155.9 260.7 L152.0 263.5 L148.0 266.1 L143.9 268.7 L138.6 271.6 L134.3 273.8 L128.8 276.3 L123.3 278.6 L117.6 280.6 L111.8 282.4 L106.0 283.9 L100.1 285.2 L94.2 286.2 L88.2 286.9 L82.2 287.4 L82.3 289.4 L88.4 288.9 L94.5 288.2 L99.3 287.4 L105.3 286.1 L111.2 284.6 L115.9 283.2 L120.5 281.7 L126.3 279.5 L131.9 277.1 L137.4 274.5 L141.7 272.2 L147.0 269.1 L151.1 266.5 L156.1 263.0 L160.0 260.1 L164.8 256.2 L169.3 252.2 L172.8 248.8 L177.1 244.4 L180.3 240.7 L183.4 236.9 L187.1 232.1 L190.6 227.1 L193.3 222.9 L195.7 218.7 L198.6 213.4 L201.3 207.9 L203.3 203.4 L205.5 197.7 L207.5 191.9 L209.2 186.0 L210.4 181.3 L211.6 175.3 L212.4 170.5 L213.1 165.7 L213.6 159.6 L213.9 154.7 L214.0 148.6 L213.8 142.5 L213.4 136.4 L212.8 131.5 L211.9 125.5 L210.7 119.5 L209.2 113.5 L207.9 108.8 L206.0 103.0 L203.8 97.3 L201.4 91.7 L198.8 86.2 L195.9 80.8 L193.4 76.6 L190.1 71.5 L186.6 66.5 L182.9 61.6 L178.9 57.0 L174.8 52.5 L169.6 47.3 L165.0 43.3 L159.3 38.6 L154.4 35.0 L148.3 31.0 L141.9 27.2 Z`, mat: 'gold', level: 1, fin: 'foil' }
    ],
    face: { x: 0.036, y: 0.457, w: 0.342, h: 0.326, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/wave.228f2869.webp", "box": [-6.0, -6.0, 248.06, 306.19]}, tile: "img/designs/tile-wave.bb0f0000.webp",
  },
  halfmoon: {
    name: "Half Moon", group: 'Curves', sheet: 'blue', base: 1.00,
    note: "A blue half moon: a fine gold line round a white inner panel, and a blue star at its foot.",
    body: `M66.1 299.6 L67.0 299.9 L67.4 300.0 L164.5 300.0 L164.9 300.0 L165.7 299.6 L166.0 299.3 L166.5 298.6 L166.7 297.8 L166.7 2.2 L166.5 1.4 L166.3 1.0 L166.0 0.6 L165.3 0.2 L164.4 0.0 L161.3 0.1 L155.7 0.3 L150.4 0.8 L145.0 1.4 L139.5 2.2 L134.1 3.2 L128.8 4.3 L123.5 5.7 L118.3 7.1 L113.1 8.8 L108.0 10.6 L102.9 12.7 L97.9 14.8 L92.9 17.2 L88.1 19.7 L83.4 22.3 L78.7 25.1 L74.1 28.1 L69.6 31.2 L65.2 34.4 L60.9 37.8 L56.8 41.4 L52.7 45.0 L48.8 48.8 L45.1 52.7 L41.3 56.8 L37.9 60.9 L34.5 65.1 L31.2 69.5 L28.1 74.1 L25.1 78.7 L22.3 83.3 L19.7 88.1 L17.2 92.9 L14.9 97.8 L12.7 102.8 L10.7 108.0 L8.8 113.1 L7.2 118.3 L5.7 123.5 L4.3 128.8 L3.2 134.1 L2.2 139.5 L1.4 144.9 L0.8 150.3 L0.4 155.8 L0.1 161.2 L0.0 166.6 L0.1 172.1 L0.4 177.6 L0.8 183.0 L1.4 188.4 L2.2 193.8 L3.2 199.1 L4.4 204.5 L5.7 209.8 L7.2 215.1 L8.9 220.3 L10.7 225.4 L12.7 230.4 L14.8 235.4 L17.2 240.4 L19.7 245.3 L22.3 250.0 L25.1 254.6 L28.1 259.2 L31.2 263.7 L34.4 268.1 L37.9 272.4 L41.4 276.6 L45.1 280.6 L48.8 284.5 L52.7 288.3 L56.8 292.0 L61.0 295.5 Z`,
    layers: [
      { d: `M157.8 9.1 L151.3 9.6 L146.1 10.2 L141.0 11.0 L135.9 11.9 L130.9 13.0 L125.9 14.2 L120.9 15.6 L116.0 17.2 L111.1 19.0 L106.3 20.9 L101.6 22.9 L96.9 25.1 L92.3 27.5 L87.8 30.0 L83.4 32.6 L79.0 35.4 L74.8 38.4 L70.7 41.4 L66.6 44.7 L62.7 48.0 L58.8 51.5 L55.1 55.0 L51.5 58.8 L48.1 62.6 L44.7 66.5 L41.5 70.6 L38.4 74.7 L35.5 79.0 L32.7 83.3 L30.0 87.7 L27.5 92.2 L25.2 96.8 L23.0 101.5 L20.9 106.2 L19.0 111.0 L17.3 115.9 L15.7 120.8 L14.3 125.8 L13.0 130.8 L11.9 135.8 L11.0 140.9 L10.2 146.0 L9.7 151.1 L9.2 156.3 L9.0 161.5 L8.9 166.6 L9.0 171.8 L9.2 176.9 L9.6 182.1 L10.2 187.2 L11.0 192.3 L11.9 197.4 L13.0 202.4 L14.3 207.5 L15.7 212.4 L17.3 217.3 L19.0 222.2 L20.9 227.0 L22.9 231.7 L25.1 236.4 L27.5 241.0 L30.0 245.5 L32.7 249.9 L35.5 254.3 L38.4 258.5 L41.5 262.7 L44.7 266.7 L48.0 270.7 L51.5 274.5 L55.1 278.2 L58.8 281.8 L62.6 285.3 L66.6 288.6 L69.7 291.1 L157.8 291.1 Z M64.1 283.6 L60.3 280.2 L56.7 276.6 L53.1 273.0 L49.7 269.2 L46.4 265.3 L43.2 261.3 L40.2 257.2 L37.3 253.1 L34.6 248.8 L31.9 244.4 L29.5 240.0 L27.1 235.4 L25.0 230.8 L22.9 226.2 L21.1 221.4 L19.4 216.6 L17.8 211.8 L16.4 206.9 L15.2 201.9 L14.1 197.0 L13.2 192.0 L12.4 186.9 L11.9 181.9 L11.4 176.8 L11.2 171.7 L11.1 166.6 L11.2 161.5 L11.4 156.4 L11.9 151.4 L12.4 146.3 L13.2 141.3 L14.1 136.3 L15.2 131.3 L16.4 126.4 L17.8 121.5 L19.4 116.6 L21.1 111.8 L23.0 107.1 L25.0 102.4 L27.2 97.8 L29.5 93.3 L32.0 88.8 L34.6 84.5 L37.4 80.2 L40.2 76.0 L43.3 71.9 L46.4 67.9 L49.7 64.0 L53.2 60.3 L56.7 56.6 L60.4 53.1 L64.1 49.7 L68.0 46.4 L72.0 43.2 L76.1 40.2 L80.3 37.3 L84.6 34.5 L88.9 31.9 L93.4 29.4 L97.9 27.1 L102.5 24.9 L107.2 22.9 L111.9 21.0 L116.7 19.3 L121.6 17.8 L126.5 16.4 L131.4 15.1 L136.4 14.1 L141.4 13.2 L146.4 12.4 L151.5 11.8 L155.6 11.5 L155.6 288.9 L70.5 288.9 L68.0 286.9 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M153.4 286.7 L153.4 13.9 L146.7 14.6 L141.7 15.3 L136.8 16.2 L131.9 17.3 L127.0 18.5 L122.2 19.9 L117.4 21.4 L112.7 23.1 L108.0 25.0 L103.4 27.0 L98.9 29.1 L94.4 31.4 L90.0 33.8 L85.7 36.4 L81.5 39.1 L77.4 42.0 L73.4 45.0 L69.4 48.1 L65.6 51.3 L61.9 54.7 L58.3 58.2 L54.8 61.8 L51.4 65.5 L48.2 69.3 L45.0 73.3 L42.1 77.3 L39.2 81.4 L36.5 85.6 L33.9 89.9 L31.5 94.3 L29.2 98.8 L27.0 103.3 L25.0 107.9 L23.2 112.6 L21.5 117.3 L19.9 122.1 L18.6 126.9 L17.4 131.8 L16.3 136.7 L15.4 141.6 L14.7 146.6 L14.1 151.6 L13.7 156.6 L13.4 161.6 L13.3 166.6 L13.4 171.6 L13.7 176.6 L14.1 181.6 L14.6 186.6 L15.4 191.6 L16.3 196.5 L17.3 201.4 L18.6 206.3 L19.9 211.1 L21.5 215.9 L23.2 220.6 L25.0 225.3 L27.0 229.9 L29.1 234.4 L31.4 238.9 L33.9 243.3 L36.4 247.6 L39.2 251.8 L42.0 255.9 L45.0 260.0 L48.1 263.9 L51.4 267.7 L54.7 271.5 L58.2 275.1 L61.8 278.6 L65.6 281.9 L71.3 286.7 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M86.8 237.7 L68.0 238.4 L82.8 250.1 L77.7 268.2 L93.3 257.8 L109.0 268.2 L103.9 250.1 L118.7 238.4 L99.9 237.7 L93.3 220.0 Z`, mat: 'blue', level: 2, fin: 'gloss' }
    ],
    face: { x: 0.007, y: 0.489, w: 0.383, h: 0.39, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/halfmoon.aee0fe60.webp", "box": [-6.0, -6.0, 172.83, 306.19]}, tile: "img/designs/tile-halfmoon.6b9d664c.webp",
  },
  wing: {
    name: "Wing", group: 'Curves', sheet: 'black', base: 1.00,
    note: "An angled black wing: a white panel and a strip of wood.",
    body: `M127.6 0.4 L0.5 98.2 L0.1 98.8 L0.0 99.6 L6.9 298.1 L7.0 298.4 L7.3 299.1 L7.9 299.7 L8.6 300.0 L9.0 300.0 L121.9 300.0 L122.6 299.9 L123.0 299.7 L123.5 299.1 L123.8 298.4 L123.9 298.0 L130.8 2.1 L130.8 1.6 L130.5 0.9 L129.9 0.3 L129.1 0.0 L128.3 0.1 Z`,
    layers: [
      { d: `M39.2 292.9 L39.2 77.2 L7.1 101.9 L13.8 292.9 Z`, mat: 'wood', level: 1, fin: 'wood' },
      { d: `M123.5 12.4 L45.3 72.6 L45.3 292.9 L117.0 292.9 Z`, mat: 'white', level: 1, fin: 'panel' }
    ],
    face: { x: 0.062, y: 0.575, w: 0.243, h: 0.265, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/wing.1a1354c8.webp", "box": [-6.0, -5.98, 136.97, 306.21]}, tile: "img/designs/tile-wing.10a9df02.webp",
  },
  fin: {
    name: "Fin", group: 'Curves', sheet: 'white', base: 1.00,
    note: "A white fin: a red tip and a red crescent sweeping up its side, each edged in gold.",
    body: `M11.8 298.8 L12.3 299.6 L12.7 299.9 L13.3 300.0 L128.4 300.0 L129.0 299.9 L129.3 299.7 L129.5 299.5 L129.8 299.0 L133.4 271.0 L134.9 258.4 L136.7 240.0 L138.1 222.7 L139.1 207.5 L139.7 194.6 L139.9 180.9 L139.8 166.3 L139.1 145.6 L137.8 119.0 L136.4 98.1 L134.4 74.1 L132.1 51.3 L131.0 41.9 L129.8 33.3 L125.2 1.3 L125.0 0.7 L124.5 0.3 L124.3 0.1 L123.7 0.0 L123.4 0.0 L123.1 0.1 L122.6 0.4 L102.2 20.6 L97.1 25.8 L85.6 37.9 L76.3 47.8 L68.6 56.3 L61.2 65.1 L55.5 72.5 L48.2 82.2 L41.2 92.3 L34.6 102.5 L29.6 110.8 L27.3 114.9 L24.1 120.9 L19.1 130.8 L14.6 140.8 L11.3 148.9 L8.5 157.1 L6.1 165.2 L4.2 173.2 L2.7 181.2 L1.6 189.3 L0.7 199.4 L0.1 209.5 L0.0 217.5 L0.1 221.6 L0.3 227.8 L1.1 238.0 L2.2 248.1 L4.1 261.8 L5.2 268.4 L6.4 274.9 Z`,
    layers: [
      { d: `M132.4 54.0 L131.0 41.9 L129.8 33.3 L125.2 1.3 L125.0 0.7 L124.5 0.3 L124.3 0.1 L123.7 0.0 L123.1 0.1 L122.6 0.4 L103.5 19.3 L95.9 27.1 L78.5 45.4 L92.5 47.8 L107.6 50.3 Z`, mat: 'red', level: 1, fin: 'gloss' },
      { d: `M35.9 100.4 L29.6 110.8 L26.2 117.0 L21.1 126.8 L17.3 134.8 L13.8 142.9 L10.6 150.9 L7.8 159.1 L6.1 165.2 L4.2 173.2 L2.7 181.2 L1.6 189.3 L0.8 197.3 L0.3 205.4 L0.0 215.5 L0.1 223.7 L0.6 231.9 L1.3 240.1 L2.2 248.1 L3.5 258.0 L4.9 266.8 L5.4 269.9 L8.0 273.6 L11.1 277.5 L12.8 279.4 L16.1 282.8 L19.6 285.8 L21.4 287.2 L25.0 289.7 L26.9 290.7 L30.7 292.6 L34.5 294.1 L36.5 294.7 L38.4 295.1 L42.3 295.8 L44.3 295.9 L48.3 295.9 L52.2 295.5 L54.2 295.1 L57.5 294.2 L53.8 291.2 L50.1 287.8 L46.6 283.9 L43.4 279.8 L40.2 275.2 L37.2 270.3 L34.4 265.1 L31.9 259.5 L29.5 253.7 L27.4 247.7 L25.5 241.4 L23.8 234.9 L22.4 228.3 L21.2 221.5 L20.3 214.5 L19.7 207.5 L19.3 200.5 L19.2 196.9 L19.2 189.9 L19.4 182.8 L20.0 175.7 L20.7 168.8 L21.2 165.4 L22.4 158.6 L23.8 152.0 L25.5 145.4 L27.4 139.2 L28.4 136.1 L30.6 130.2 L33.1 124.5 L35.8 119.1 L38.7 114.0 L41.8 109.3 L45.0 104.8 L46.7 102.8 L50.1 99.1 L46.3 98.9 L44.3 98.9 L40.4 99.3 L38.4 99.7 Z`, mat: 'red', level: 1, fin: 'gloss' },
      { d: `M107.2 52.9 L131.1 56.5 L130.9 54.4 L107.5 50.9 L79.8 46.2 L78.2 48.0 Z M45.4 105.3 L42.2 109.7 L39.2 114.4 L36.3 119.4 L33.7 124.8 L31.2 130.4 L29.0 136.3 L27.9 139.4 L26.1 145.6 L24.4 152.0 L23.0 158.7 L21.8 165.5 L20.9 172.4 L20.3 179.3 L19.9 186.4 L19.8 189.9 L19.8 196.9 L20.0 204.0 L20.6 211.0 L21.3 217.9 L22.4 224.7 L23.0 228.1 L24.4 234.7 L26.0 241.2 L27.9 247.4 L30.1 253.5 L32.4 259.2 L35.0 264.7 L37.7 270.0 L40.7 274.9 L43.8 279.4 L47.2 283.6 L50.6 287.4 L54.3 290.9 L58.2 294.0 L60.5 293.2 L57.3 290.8 L55.5 289.3 L52.0 286.0 L48.7 282.3 L45.4 278.2 L42.4 273.8 L40.9 271.4 L38.1 266.5 L35.5 261.2 L33.1 255.6 L30.9 249.8 L28.9 243.8 L27.1 237.5 L25.6 231.0 L24.4 224.4 L23.3 217.7 L22.6 210.8 L22.0 203.9 L21.8 196.9 L21.8 189.9 L22.0 182.9 L22.6 176.0 L23.3 169.1 L24.4 162.4 L25.6 155.8 L27.1 149.3 L28.9 143.0 L29.9 140.0 L31.9 134.0 L34.3 128.3 L36.8 122.9 L38.1 120.4 L40.9 115.4 L43.9 110.8 L45.4 108.6 L48.7 104.5 L50.3 102.6 L53.3 99.6 L50.8 99.2 L48.8 101.3 Z`, mat: 'gold', level: 1, fin: 'foil' }
    ],
    face: { x: 0.011, y: 0.348, w: 0.351, h: 0.358, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/fin.e376d618.webp", "box": [-6.0, -6.0, 146.11, 306.19]}, tile: "img/designs/tile-fin.e4f295c0.webp",
  },
  teardrop: {
    name: "Teardrop", group: 'Curves', sheet: 'navy', base: 1.02,
    note: "A navy teardrop: a fine gold line round a white inner panel, and a crystal ball in a gold cup at its foot.",
    body: `M17.9 0.2 L17.0 0.0 L16.2 0.3 L15.7 1.0 L15.6 1.9 L19.7 18.8 L23.3 36.6 L25.3 47.8 L26.0 52.8 L26.5 57.8 L26.8 61.1 L27.1 66.5 L27.3 75.9 L27.0 85.5 L26.6 93.3 L25.9 101.2 L24.9 109.0 L23.9 115.2 L22.6 121.4 L20.6 129.8 L14.9 150.8 L11.2 166.0 L5.9 186.4 L4.2 193.2 L2.8 200.0 L1.6 206.8 L0.8 213.5 L0.3 220.0 L0.0 228.6 L0.1 237.2 L0.3 241.5 L0.7 247.8 L1.6 256.0 L2.4 261.9 L3.1 265.5 L3.8 268.6 L4.7 271.8 L6.6 277.9 L8.2 282.3 L12.7 294.1 L14.5 299.0 L14.6 299.3 L15.0 299.7 L15.6 300.0 L15.9 300.0 L140.3 300.0 L140.9 299.9 L141.5 299.3 L141.8 298.8 L148.2 271.5 L149.9 263.8 L150.9 257.8 L153.5 239.8 L154.8 227.7 L155.4 220.4 L155.7 215.4 L155.9 210.4 L155.9 205.4 L155.8 200.5 L155.6 195.5 L155.1 190.0 L154.6 184.6 L153.9 179.0 L153.0 173.4 L152.1 167.7 L151.0 162.1 L149.7 156.5 L148.4 150.9 L146.0 142.6 L144.3 137.1 L142.5 131.8 L139.4 123.8 L136.0 115.9 L133.5 110.6 L130.9 105.4 L128.1 100.2 L125.2 95.1 L120.6 87.5 L117.4 82.7 L114.2 77.9 L109.1 71.0 L103.8 64.6 L100.2 60.5 L96.3 56.4 L92.4 52.4 L88.4 48.6 L84.2 44.8 L78.0 39.4 L73.7 35.9 L67.4 30.9 L57.3 23.3 L51.8 19.5 L44.4 15.0 L37.1 10.7 Z`,
    layers: [
      { d: `M26.9 14.4 L28.5 21.8 L32.4 41.6 L33.7 50.1 L34.7 58.7 L34.9 62.4 L35.2 68.1 L35.3 77.9 L35.0 87.9 L34.3 98.0 L33.4 106.0 L32.5 112.2 L31.8 116.8 L30.4 123.2 L28.4 131.8 L22.7 152.8 L19.0 167.9 L13.7 188.3 L11.1 199.4 L9.9 205.9 L9.0 212.2 L8.5 218.3 L8.1 226.6 L8.1 234.9 L8.2 239.0 L8.5 245.1 L9.3 253.0 L9.8 256.8 L10.7 262.3 L11.3 265.3 L12.0 268.2 L13.7 273.8 L15.7 279.5 L20.5 292.0 L135.1 292.0 L139.1 275.4 L140.8 267.9 L142.3 260.4 L143.3 254.6 L145.5 238.8 L146.8 227.0 L147.4 219.8 L147.7 215.0 L147.9 210.3 L147.9 205.5 L147.7 198.4 L147.4 193.4 L146.9 188.1 L145.5 177.4 L144.6 171.9 L143.6 166.5 L142.5 161.0 L141.2 155.6 L139.1 147.5 L137.5 142.3 L135.8 137.1 L133.0 129.4 L129.8 121.8 L127.5 116.7 L125.0 111.6 L122.4 106.5 L119.7 101.6 L115.3 94.3 L112.3 89.5 L109.2 84.9 L104.4 78.1 L99.4 71.8 L94.2 65.9 L90.6 62.0 L86.8 58.2 L82.9 54.5 L78.9 50.8 L74.8 47.3 L68.7 42.2 L58.4 34.1 L50.9 28.6 L43.9 24.0 L36.8 19.8 Z M29.8 18.3 L41.1 24.7 L48.0 29.1 L51.4 31.4 L55.1 34.2 L65.3 42.1 L73.5 48.8 L81.5 56.0 L85.4 59.6 L89.1 63.4 L94.5 69.2 L99.5 75.1 L104.4 81.5 L109.1 88.3 L112.1 92.9 L115.1 97.7 L119.3 105.0 L121.9 110.0 L124.4 115.0 L126.8 120.0 L129.1 125.1 L132.1 132.7 L134.8 140.3 L137.2 148.1 L139.3 156.1 L140.5 161.5 L141.7 166.9 L142.7 172.3 L143.5 177.7 L144.9 188.4 L145.3 193.6 L145.7 198.5 L145.9 205.5 L145.8 210.2 L145.7 214.9 L145.0 224.4 L143.8 236.2 L141.6 252.3 L140.3 260.0 L138.8 267.5 L137.1 274.9 L133.5 289.9 L21.9 289.9 L17.6 278.8 L15.2 271.8 L13.6 266.2 L12.7 262.0 L11.5 254.7 L10.9 248.9 L10.5 245.0 L10.1 236.9 L10.1 228.7 L10.3 220.5 L10.8 214.5 L11.2 210.3 L12.2 204.1 L13.5 197.6 L15.6 188.8 L20.9 168.4 L24.1 155.4 L29.7 134.4 L31.9 125.8 L33.3 119.3 L34.2 114.8 L35.1 108.4 L35.9 102.3 L36.6 94.0 L37.2 83.9 L37.3 73.9 L37.0 64.2 L36.8 60.3 L36.4 55.1 L35.2 46.3 L33.4 36.3 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M32.7 22.1 L35.4 35.9 L36.9 44.3 L38.1 53.0 L38.8 60.3 L39.3 69.9 L39.3 80.0 L38.9 90.1 L38.1 100.5 L37.4 106.6 L36.5 113.1 L35.3 119.6 L33.9 126.2 L31.7 134.9 L26.1 155.9 L22.9 168.9 L17.6 189.3 L15.5 198.1 L14.2 204.4 L13.2 210.6 L12.8 214.6 L12.4 220.6 L12.1 228.7 L12.1 236.8 L12.6 244.8 L13.3 252.5 L14.3 259.9 L14.9 263.0 L15.5 265.8 L17.1 271.2 L19.5 278.1 L23.3 287.9 L131.9 287.9 L135.2 274.5 L136.9 267.1 L138.4 259.6 L139.6 252.0 L141.5 238.3 L142.8 226.6 L143.4 219.5 L143.7 214.9 L143.8 210.2 L143.9 205.5 L143.8 200.9 L143.5 196.3 L142.6 185.9 L141.1 175.3 L139.7 167.2 L138.6 161.9 L137.3 156.6 L135.2 148.6 L132.9 140.9 L130.2 133.4 L127.2 125.9 L125.0 120.9 L122.6 115.9 L120.1 110.9 L117.5 106.0 L113.4 98.7 L110.4 94.0 L107.4 89.4 L102.7 82.7 L97.9 76.3 L93.0 70.5 L87.7 64.8 L84.0 61.1 L80.2 57.4 L72.2 50.4 L64.1 43.6 L53.9 35.8 L50.2 33.1 L46.9 30.7 L40.0 26.4 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M69.1 249.1 L69.0 247.1 L68.6 245.2 L68.1 243.3 L67.3 241.4 L66.4 239.7 L65.4 238.0 L64.1 236.5 L62.8 235.1 L61.3 233.8 L59.6 232.7 L57.9 231.7 L56.1 230.9 L54.2 230.3 L52.3 229.9 L50.3 229.7 L48.4 229.6 L46.4 229.8 L44.5 230.2 L42.6 230.7 L40.7 231.4 L39.0 232.3 L37.3 233.4 L35.8 234.6 L34.3 236.0 L33.1 237.5 L31.9 239.1 L31.0 240.8 L30.2 242.7 L29.6 244.5 L29.2 246.5 L29.0 248.4 L28.9 250.4 L29.1 252.4 L29.4 254.3 L30.0 256.2 L30.7 258.0 L31.6 259.8 L32.7 261.5 L33.9 263.0 L35.3 264.4 L36.8 265.7 L38.4 266.8 L40.1 267.8 L41.9 268.6 L43.8 269.2 L45.7 269.6 L47.7 269.8 L49.7 269.8 L51.6 269.7 L53.6 269.3 L55.5 268.8 L57.3 268.1 L59.1 267.2 L60.7 266.1 L62.3 264.9 L63.7 263.5 L65.0 262.0 L66.1 260.4 L67.1 258.6 L67.8 256.8 L68.4 254.9 L68.9 253.0 L69.1 251.1 Z`, mat: 'frost', level: 2, fin: 'crystal' },
      { d: `M70.4 255.5 L69.8 257.2 L69.2 258.9 L68.4 260.5 L67.4 262.0 L66.3 263.5 L65.2 264.9 L63.9 266.1 L62.5 267.3 L60.0 269.0 L58.4 269.8 L56.7 270.5 L55.0 271.0 L53.2 271.5 L51.4 271.7 L49.6 271.8 L47.8 271.8 L46.0 271.6 L44.2 271.3 L42.5 270.9 L40.8 270.3 L39.1 269.5 L37.5 268.6 L36.0 267.6 L34.2 266.1 L32.9 264.9 L31.7 263.5 L30.6 262.0 L29.7 260.5 L28.9 258.9 L28.2 257.2 L27.7 255.5 L22.8 256.8 L23.5 258.9 L24.3 260.9 L25.3 262.9 L26.5 264.8 L27.8 266.6 L29.2 268.3 L30.8 269.8 L32.5 271.3 L34.3 272.6 L36.2 273.7 L38.9 274.9 L41.0 275.7 L43.1 276.2 L45.3 276.6 L47.5 276.8 L49.8 276.9 L52.7 276.6 L54.9 276.2 L57.0 275.7 L59.8 274.6 L61.8 273.7 L64.3 272.1 L66.7 270.3 L68.3 268.8 L70.3 266.6 L71.6 264.8 L72.4 263.6 L73.1 262.3 L74.0 260.3 L74.8 258.2 L75.2 256.8 Z`, mat: 'gold', level: 2, fin: 'foil' }
    ],
    face: { x: 0.025, y: 0.402, w: 0.28, h: 0.286, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/teardrop.354fe26e.webp", "box": [-5.98, -6.0, 162.06, 306.19]}, tile: "img/designs/tile-teardrop.71a0aaf1.webp",
  },
  flame: {
    name: "Flame", group: 'Curves', sheet: 'clear', base: 1.02,
    note: "A clear flame: a glittering gold flame and a frosted core rising out of a gold-ringed seal.",
    body: `M16.6 299.0 L16.9 299.5 L17.1 299.7 L17.4 299.9 L18.0 300.0 L108.3 300.0 L108.6 300.0 L109.1 299.7 L109.6 299.2 L109.7 299.0 L118.0 274.5 L120.9 265.3 L122.9 257.7 L126.3 243.1 L127.6 236.6 L128.7 230.1 L129.8 223.5 L130.3 219.0 L131.0 212.4 L131.3 208.0 L131.5 201.4 L131.4 194.6 L131.0 187.8 L130.2 178.8 L129.3 171.9 L127.9 162.9 L126.3 153.8 L124.5 144.8 L122.3 135.5 L120.6 128.6 L117.9 119.4 L115.8 112.6 L112.7 103.7 L110.2 97.2 L107.7 91.1 L104.1 83.4 L101.2 77.6 L97.2 70.1 L94.1 64.7 L89.8 57.6 L86.4 52.5 L82.0 46.4 L78.7 42.1 L74.0 36.4 L69.3 31.0 L64.4 25.9 L59.5 21.1 L55.0 16.8 L50.7 13.2 L46.3 9.8 L33.2 0.3 L32.4 0.0 L31.8 0.1 L31.3 0.4 L30.9 0.8 L30.8 1.3 L29.4 12.8 L29.0 17.2 L28.9 21.5 L29.1 25.9 L29.7 30.2 L30.6 34.4 L34.2 47.5 L36.4 56.3 L40.1 70.6 L41.4 76.4 L42.6 82.2 L44.7 96.5 L45.2 100.8 L45.5 105.1 L45.7 109.4 L45.7 112.2 L45.4 116.4 L45.1 119.2 L44.6 122.0 L43.6 126.1 L42.8 128.8 L41.4 132.9 L39.8 136.9 L38.1 140.9 L33.7 150.1 L31.6 153.9 L29.2 157.7 L26.6 161.4 L19.3 171.1 L15.9 176.2 L14.3 178.8 L12.9 181.5 L10.9 185.9 L8.9 190.5 L7.1 195.2 L5.5 200.0 L4.0 204.8 L2.7 209.7 L1.7 214.7 L0.9 219.6 L0.5 223.1 L0.1 228.3 L0.0 231.8 L0.0 237.2 L0.2 240.8 L0.6 246.1 L0.9 249.7 L1.7 255.0 L2.5 260.1 L3.2 263.5 L4.1 266.7 L5.0 270.0 L7.3 276.4 L9.2 281.1 L14.5 293.7 Z`,
    layers: [
      { d: `M43.1 162.2 L43.0 162.9 L42.9 163.8 L43.1 164.6 L43.3 165.3 L43.8 166.0 L44.3 166.6 L45.0 167.0 L45.8 167.3 L46.6 167.5 L47.4 167.5 L48.2 167.3 L52.7 166.1 L56.8 165.3 L60.9 164.7 L64.9 164.4 L69.1 164.4 L73.3 164.7 L77.4 165.2 L81.4 166.0 L85.4 167.1 L89.4 168.4 L93.2 170.0 L96.8 171.8 L100.4 173.8 L102.5 175.2 L105.8 177.5 L109.1 180.3 L109.8 180.8 L110.5 181.1 L111.3 181.3 L112.1 181.3 L112.9 181.2 L113.7 180.9 L114.4 180.5 L114.9 179.9 L115.4 179.2 L115.7 178.4 L115.8 177.6 L115.8 176.8 L115.4 173.9 L114.4 167.4 L112.9 158.7 L110.2 145.6 L107.6 134.5 L104.5 123.4 L101.0 112.8 L98.0 104.5 L96.4 100.5 L94.0 94.9 L89.6 85.8 L86.9 80.5 L84.0 75.3 L79.0 66.9 L75.9 62.1 L72.8 57.6 L69.7 53.5 L65.5 48.2 L62.2 44.3 L57.8 39.3 L53.2 34.6 L52.3 33.8 L51.6 33.4 L50.8 33.2 L50.0 33.1 L49.2 33.2 L48.4 33.5 L47.7 33.9 L47.1 34.4 L46.6 35.1 L46.3 35.8 L46.1 36.6 L46.1 37.4 L46.2 38.2 L47.8 43.9 L49.6 51.5 L54.1 68.6 L55.5 74.9 L56.4 79.7 L58.4 93.1 L59.3 100.9 L59.7 107.7 L59.8 110.9 L59.7 114.4 L59.2 119.5 L58.4 124.8 L57.1 129.9 L55.2 136.1 L52.8 142.3 L50.3 148.1 L46.2 156.4 Z`, mat: 'gold', level: 1, fin: 'glitter' },
      { d: `M58.2 154.9 L65.0 154.4 L67.5 154.4 L71.6 154.5 L76.8 155.0 L81.8 155.8 L84.2 156.4 L88.1 157.4 L93.1 159.1 L97.8 161.0 L101.4 162.8 L103.7 164.1 L102.2 156.3 L100.4 147.7 L98.4 139.2 L96.7 132.7 L94.2 124.3 L92.2 118.1 L90.1 112.1 L87.9 106.3 L85.6 100.8 L82.4 93.8 L79.8 88.6 L76.2 81.9 L73.4 77.0 L69.5 70.7 L65.5 64.7 L62.4 60.4 L64.2 67.9 L65.7 74.7 L66.6 79.8 L68.0 88.8 L68.8 95.2 L69.5 101.9 L69.8 107.3 L69.8 112.9 L69.6 116.9 L69.1 121.1 L68.5 125.1 L67.4 130.3 L65.8 135.9 L64.0 141.4 L61.4 147.7 Z`, mat: 'frost', level: 2, fin: 'frost' },
      { d: `M121.3 224.1 L120.7 218.8 L119.6 213.6 L117.9 208.6 L115.8 203.7 L113.2 199.0 L110.2 194.7 L106.8 190.6 L102.9 186.9 L98.8 183.6 L94.3 180.7 L89.6 178.3 L84.6 176.3 L79.5 174.9 L74.2 173.9 L68.9 173.5 L63.6 173.6 L58.3 174.2 L53.1 175.3 L48.1 176.9 L43.2 179.0 L38.5 181.6 L34.1 184.6 L30.1 188.1 L26.4 191.9 L23.1 196.1 L20.2 200.6 L17.8 205.3 L15.8 210.2 L14.3 215.4 L13.4 220.6 L13.0 225.9 L13.0 231.2 L13.6 236.5 L14.8 241.7 L16.4 246.8 L18.5 251.7 L21.1 256.3 L24.1 260.7 L27.6 264.8 L31.4 268.5 L35.6 271.8 L40.0 274.7 L44.8 277.1 L49.7 279.0 L54.8 280.5 L60.1 281.5 L65.4 281.9 L70.7 281.8 L76.0 281.2 L81.2 280.1 L86.3 278.4 L91.2 276.3 L95.8 273.7 L100.2 270.7 L104.2 267.3 L107.9 263.4 L111.3 259.3 L114.1 254.8 L116.6 250.1 L118.5 245.1 L120.0 240.0 L120.9 234.8 L121.4 229.5 Z M114.3 230.8 L113.7 235.4 L112.8 239.9 L111.3 244.3 L109.5 248.6 L107.3 252.6 L104.6 256.4 L101.6 260.0 L98.3 263.2 L94.7 266.1 L90.8 268.6 L86.6 270.7 L82.3 272.4 L77.9 273.7 L73.3 274.5 L68.7 274.9 L64.1 274.8 L59.5 274.3 L54.9 273.3 L50.5 271.9 L46.3 270.0 L42.2 267.8 L38.4 265.1 L34.9 262.1 L31.7 258.8 L28.8 255.2 L26.3 251.3 L24.2 247.2 L22.5 242.9 L21.2 238.4 L20.4 233.8 L20.0 229.2 L20.1 224.6 L20.6 220.0 L21.6 215.5 L23.0 211.1 L24.8 206.8 L27.1 202.8 L29.7 198.9 L32.7 195.4 L36.0 192.2 L39.7 189.3 L43.6 186.8 L47.7 184.7 L52.0 183.0 L56.4 181.7 L61.0 180.9 L65.6 180.5 L70.3 180.6 L74.9 181.1 L79.4 182.1 L83.8 183.5 L88.0 185.3 L92.1 187.6 L95.9 190.2 L99.4 193.2 L102.7 196.6 L105.5 200.2 L108.0 204.1 L110.2 208.2 L111.9 212.5 L113.1 217.0 L114.0 221.5 L114.3 226.1 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M114.3 226.1 L114.0 221.5 L113.1 217.0 L111.9 212.5 L110.2 208.2 L108.0 204.1 L105.5 200.2 L102.7 196.6 L99.4 193.2 L95.9 190.2 L92.1 187.6 L88.0 185.3 L83.8 183.5 L79.4 182.1 L74.9 181.1 L70.3 180.6 L65.6 180.5 L61.0 180.9 L56.4 181.7 L52.0 183.0 L47.7 184.7 L43.6 186.8 L39.7 189.3 L36.0 192.2 L32.7 195.4 L29.7 198.9 L27.1 202.8 L24.8 206.8 L23.0 211.1 L21.6 215.5 L20.6 220.0 L20.1 224.6 L20.0 229.2 L20.4 233.8 L21.2 238.4 L22.5 242.9 L24.2 247.2 L26.3 251.3 L28.8 255.2 L31.7 258.8 L34.9 262.1 L38.4 265.1 L42.2 267.8 L46.3 270.0 L50.5 271.9 L54.9 273.3 L59.5 274.3 L64.1 274.8 L68.7 274.9 L73.3 274.5 L77.9 273.7 L82.3 272.4 L86.6 270.7 L90.8 268.6 L94.7 266.1 L98.3 263.2 L101.6 260.0 L104.6 256.4 L107.3 252.6 L109.5 248.6 L111.3 244.3 L112.8 239.9 L113.7 235.4 L114.3 230.8 Z`, mat: 'yellow', level: 1, fin: 'gloss' }
    ],
    face: { x: -0.005, y: 0.241, w: 0.235, h: 0.179, level: 1, on: 3 },
    ink: 'printdark', art: {"src": "img/designs/flame.7d34b897.webp", "box": [-5.98, -6.0, 137.69, 306.19]}, tile: "img/designs/tile-flame.0ed63fb3.webp",
  },
  torch: {
    name: "Torch", group: 'Curves', sheet: 'clear', base: 1.00,
    note: "A tall clear leaf outlined in gold, with a gold torch and a glittering flame at its crown.",
    body: `M18.4 299.0 L18.8 299.5 L19.0 299.7 L19.3 299.9 L19.9 300.0 L114.0 300.0 L114.6 299.9 L115.2 299.5 L115.5 299.0 L121.6 281.8 L124.1 274.0 L125.6 268.1 L127.7 258.9 L129.3 251.1 L130.7 243.0 L131.9 234.6 L132.6 228.2 L133.2 221.7 L133.6 214.0 L133.9 203.2 L133.9 194.9 L133.7 186.5 L133.3 178.0 L132.7 169.5 L131.9 161.1 L131.2 155.5 L129.9 146.9 L128.4 138.3 L126.7 129.6 L124.8 120.9 L122.6 112.3 L120.3 103.8 L116.9 92.7 L114.2 84.7 L111.4 77.0 L108.4 69.2 L105.2 61.5 L101.8 53.9 L97.2 44.3 L93.7 37.5 L90.2 31.1 L87.3 26.2 L84.6 22.0 L80.0 15.6 L68.2 0.6 L67.7 0.2 L67.1 0.0 L66.5 0.1 L66.0 0.4 L65.8 0.6 L55.8 13.2 L51.2 19.4 L48.5 23.3 L46.7 26.1 L42.6 33.2 L37.9 42.0 L33.3 51.5 L28.8 61.5 L24.5 71.8 L20.6 82.1 L17.0 92.7 L13.6 103.8 L10.6 115.2 L7.8 126.7 L5.5 138.3 L4.0 146.9 L2.7 155.5 L1.5 166.7 L0.8 175.2 L0.2 186.5 L0.0 197.7 L0.1 208.6 L0.6 219.2 L1.3 228.2 L2.3 236.7 L3.9 247.1 L5.8 257.0 L8.3 268.1 L9.9 274.0 L11.5 279.2 L13.1 284.2 Z`,
    layers: [
      { d: `M110.8 294.0 L115.1 282.2 L117.1 276.2 L119.0 269.8 L120.6 263.1 L122.6 253.8 L124.4 244.0 L126.0 233.9 L126.8 225.6 L127.5 216.3 L127.8 205.8 L127.9 195.0 L127.7 186.7 L127.1 175.6 L126.4 167.3 L125.2 156.3 L124.0 147.9 L122.5 139.4 L120.2 128.0 L118.2 119.5 L115.3 108.3 L112.0 97.3 L108.6 86.7 L105.8 79.1 L101.8 68.9 L97.4 58.9 L92.9 49.3 L88.4 40.3 L83.8 32.1 L80.5 26.7 L77.0 21.7 L73.4 17.0 L67.0 8.9 L57.9 20.5 L54.3 25.4 L51.8 29.3 L49.0 34.0 L45.6 40.3 L42.1 47.0 L38.7 54.0 L35.4 61.4 L32.2 68.9 L29.1 76.5 L26.3 84.1 L23.6 91.9 L21.1 100.0 L18.6 108.2 L16.4 116.7 L14.4 125.2 L12.5 133.7 L10.9 142.2 L9.9 147.9 L8.7 156.3 L8.0 161.7 L7.2 170.0 L6.6 178.3 L6.2 186.7 L6.0 195.0 L6.0 203.1 L6.2 211.1 L6.6 218.8 L7.1 225.5 L7.7 231.8 L8.8 240.0 L9.8 246.0 L11.3 253.8 L12.9 261.3 L14.9 269.8 L16.0 273.6 L17.6 278.6 L23.1 294.0 Z M24.5 292.0 L20.3 280.4 L18.3 274.3 L16.9 269.3 L14.9 260.9 L12.9 251.5 L11.1 241.7 L10.0 233.6 L9.1 225.3 L8.4 216.2 L8.1 205.8 L8.1 195.0 L8.2 186.8 L8.8 175.7 L9.5 167.4 L10.4 159.2 L11.5 151.0 L12.9 142.6 L15.1 131.3 L17.0 122.8 L19.8 111.6 L22.2 103.3 L25.5 92.5 L28.2 84.8 L32.0 74.7 L36.1 64.6 L40.5 54.9 L45.1 45.6 L49.6 37.0 L53.5 30.4 L56.9 25.3 L61.2 19.3 L67.0 12.1 L71.8 18.2 L75.3 22.9 L78.8 27.8 L81.3 31.7 L84.3 37.1 L87.7 43.4 L91.1 50.2 L94.5 57.3 L97.8 64.7 L100.9 72.2 L103.9 79.8 L106.7 87.4 L109.3 95.2 L111.8 103.3 L114.1 111.6 L116.3 120.0 L118.2 128.4 L120.0 136.9 L121.5 145.4 L122.4 151.0 L123.2 156.6 L124.2 164.7 L124.7 170.2 L125.3 178.5 L125.7 186.8 L125.9 195.0 L125.9 203.1 L125.7 211.1 L125.3 218.7 L124.8 225.4 L124.2 231.6 L123.1 239.7 L122.1 245.7 L120.7 253.4 L119.1 260.9 L117.0 269.3 L116.0 273.1 L114.4 278.0 L109.4 292.0 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M49.1 96.8 L48.7 96.9 L48.2 97.5 L48.1 98.1 L48.3 98.6 L57.2 113.6 L57.2 114.0 L57.1 114.5 L56.7 114.8 L55.9 115.4 L55.5 116.1 L55.4 119.0 L55.6 119.6 L56.0 120.2 L56.6 120.5 L58.9 120.7 L59.5 121.2 L59.6 121.6 L59.6 122.5 L62.0 169.9 L62.3 170.5 L62.7 170.7 L63.2 170.8 L70.8 170.8 L71.2 170.7 L71.7 170.3 L72.0 169.7 L74.4 122.5 L74.3 121.6 L74.5 121.2 L75.0 120.7 L77.4 120.5 L77.9 120.2 L78.3 119.7 L78.5 119.0 L78.4 116.1 L78.2 115.6 L78.0 115.3 L76.9 114.6 L76.7 113.9 L76.7 113.4 L85.6 98.6 L85.8 98.1 L85.8 97.7 L85.4 97.1 L85.0 96.8 L84.6 96.7 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M70.2 24.3 L64.3 33.9 L61.8 38.0 L58.7 44.2 L56.3 49.6 L54.6 54.4 L53.4 58.7 L52.8 61.8 L52.3 64.9 L51.8 69.5 L51.8 71.8 L51.9 74.0 L52.1 75.4 L52.6 77.2 L53.2 79.0 L54.1 81.4 L55.0 83.2 L56.3 85.3 L57.7 87.3 L58.7 88.5 L60.0 89.7 L61.3 90.8 L63.2 92.0 L64.6 92.8 L66.0 93.3 L67.4 93.5 L68.6 93.4 L70.0 92.9 L71.9 91.8 L73.9 90.4 L76.1 88.6 L77.9 86.9 L79.6 85.0 L81.1 83.0 L82.1 81.3 L83.4 78.6 L84.3 76.5 L85.1 74.2 L85.8 71.8 L86.3 69.4 L86.6 67.0 L86.7 65.4 L86.7 63.8 L86.6 62.2 L86.2 59.8 L85.3 56.5 L83.7 52.3 L79.0 41.6 L76.7 36.6 Z`, mat: 'gold', level: 1, fin: 'glitter' }
    ],
    face: { x: -0.001, y: 0.241, w: 0.363, h: 0.277, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/torch.6ce6a5ad.webp", "box": [-6.0, -6.0, 140.02, 306.19]}, tile: "img/designs/tile-torch.8f722d20.webp",
  },
  seawave: {
    name: "Ocean Wave", group: 'Curves', sheet: 'white', base: 1.04,
    note: "A white panel with three waves of blue rolling across its foot.",
    body: `M186.0 0.0 L14.0 0.0 L12.6 0.1 L11.3 0.3 L9.9 0.6 L8.6 1.1 L7.4 1.7 L6.2 2.4 L5.1 3.2 L4.1 4.1 L3.2 5.1 L2.4 6.2 L1.7 7.4 L1.1 8.6 L0.6 9.9 L0.3 11.3 L0.1 12.6 L0.0 14.0 L0.0 286.0 L0.1 287.4 L0.3 288.7 L0.6 290.1 L1.1 291.4 L1.7 292.6 L2.4 293.8 L3.2 294.9 L4.1 295.9 L5.1 296.8 L6.2 297.6 L7.4 298.3 L8.6 298.9 L9.9 299.4 L11.3 299.7 L12.6 299.9 L14.0 300.0 L186.0 300.0 L187.4 299.9 L188.7 299.7 L190.1 299.4 L191.4 298.9 L192.6 298.3 L193.8 297.6 L194.9 296.8 L195.9 295.9 L196.8 294.9 L197.6 293.8 L198.3 292.6 L198.9 291.4 L199.4 290.1 L199.7 288.7 L199.9 287.4 L200.0 286.0 L200.0 14.0 L199.9 12.6 L199.7 11.3 L199.4 9.9 L198.9 8.6 L198.3 7.4 L197.6 6.2 L196.8 5.1 L195.9 4.1 L194.9 3.2 L193.8 2.4 L192.6 1.7 L191.4 1.1 L190.1 0.6 L188.7 0.3 L187.4 0.1 Z`,
    layers: [
      { d: `M192.0 215.8 L188.0 216.0 L184.0 215.9 L180.0 215.5 L176.0 214.9 L172.0 214.0 L168.0 212.8 L164.0 211.5 L160.0 210.1 L140.0 201.9 L136.0 200.5 L132.0 199.2 L128.0 198.0 L124.0 197.1 L120.0 196.5 L116.0 196.1 L112.0 196.0 L108.0 196.2 L104.0 196.6 L100.0 197.3 L96.0 198.3 L92.0 199.5 L88.0 200.8 L84.0 202.3 L68.0 208.9 L60.0 211.9 L56.0 213.1 L52.0 214.2 L48.0 215.0 L44.0 215.6 L40.0 215.9 L36.0 216.0 L32.0 215.7 L28.0 215.2 L24.0 214.4 L20.0 213.4 L16.0 212.2 L12.0 210.8 L8.0 209.3 L0.0 206.0 L0.0 286.0 L0.1 287.4 L0.3 288.7 L0.6 290.1 L1.1 291.4 L1.7 292.6 L2.4 293.8 L3.2 294.9 L4.1 295.9 L5.1 296.8 L6.2 297.6 L7.4 298.3 L8.6 298.9 L9.9 299.4 L11.3 299.7 L12.6 299.9 L14.0 300.0 L186.0 300.0 L187.4 299.9 L188.7 299.7 L190.1 299.4 L191.4 298.9 L192.6 298.3 L193.8 297.6 L194.9 296.8 L195.9 295.9 L196.8 294.9 L197.6 293.8 L198.3 292.6 L198.9 291.4 L199.4 290.1 L199.7 288.7 L199.9 287.4 L200.0 286.0 L200.0 214.7 L196.0 215.4 Z`, mat: 'navy', level: 1, fin: 'brush' },
      { d: `M192.0 233.4 L184.0 236.3 L180.0 237.5 L176.0 238.6 L172.0 239.6 L168.0 240.3 L164.0 240.7 L160.0 241.0 L156.0 241.0 L152.0 240.7 L148.0 240.2 L144.0 239.4 L140.0 238.5 L136.0 237.3 L128.0 234.7 L112.0 228.7 L108.0 227.4 L104.0 226.2 L100.0 225.1 L96.0 224.2 L92.0 223.6 L88.0 223.2 L84.0 223.0 L80.0 223.1 L76.0 223.4 L72.0 224.0 L68.0 224.8 L64.0 225.8 L60.0 227.0 L56.0 228.3 L36.0 235.6 L32.0 236.9 L28.0 238.1 L24.0 239.1 L20.0 239.9 L16.0 240.5 L12.0 240.9 L8.0 241.0 L4.0 240.9 L0.0 240.5 L0.0 286.0 L0.1 287.4 L0.3 288.7 L0.6 290.1 L1.1 291.4 L1.7 292.6 L2.4 293.8 L3.2 294.9 L4.1 295.9 L5.1 296.8 L6.2 297.6 L7.4 298.3 L8.6 298.9 L9.9 299.4 L11.3 299.7 L12.6 299.9 L14.0 300.0 L186.0 300.0 L187.4 299.9 L188.7 299.7 L190.1 299.4 L191.4 298.9 L192.6 298.3 L193.8 297.6 L194.9 296.8 L195.9 295.9 L196.8 294.9 L197.6 293.8 L198.3 292.6 L198.9 291.4 L199.4 290.1 L199.7 288.7 L199.9 287.4 L200.0 286.0 L200.0 230.4 Z`, mat: 'blue', level: 2, fin: 'gloss' },
      { d: `M192.0 253.0 L188.0 253.8 L184.0 254.7 L180.0 255.8 L172.0 258.2 L156.0 263.5 L152.0 264.6 L148.0 265.6 L144.0 266.5 L140.0 267.2 L136.0 267.7 L132.0 267.9 L128.0 268.0 L124.0 267.8 L120.0 267.4 L116.0 266.8 L112.0 266.0 L108.0 265.1 L100.0 262.7 L84.0 257.5 L80.0 256.2 L76.0 255.1 L72.0 254.1 L68.0 253.3 L64.0 252.7 L60.0 252.2 L56.0 252.0 L52.0 252.0 L48.0 252.3 L44.0 252.7 L40.0 253.4 L36.0 254.2 L32.0 255.2 L28.0 256.3 L8.0 262.8 L0.0 265.1 L0.0 286.0 L0.1 287.4 L0.3 288.7 L0.6 290.1 L1.1 291.4 L1.7 292.6 L2.4 293.8 L3.2 294.9 L4.1 295.9 L5.1 296.8 L6.2 297.6 L7.4 298.3 L8.6 298.9 L9.9 299.4 L11.3 299.7 L12.6 299.9 L14.0 300.0 L186.0 300.0 L187.4 299.9 L188.7 299.7 L190.1 299.4 L191.4 298.9 L192.6 298.3 L193.8 297.6 L194.9 296.8 L195.9 295.9 L196.8 294.9 L197.6 293.8 L198.3 292.6 L198.9 291.4 L199.4 290.1 L199.7 288.7 L199.9 287.4 L200.0 286.0 L200.0 252.1 L196.0 252.5 Z`, mat: 'sky', level: 3, fin: 'gloss' }
    ],
    face: { x: 0.001, y: 0.669, w: 0.644, h: 0.579, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/seawave.3bd2740c.webp", "box": [-6.0, -6.0, 206.11, 306.19]}, tile: "img/designs/tile-seawave.611bef88.webp",
  },
  summit: {
    name: "Summit", group: 'Curves', sheet: 'clear', base: 1.06,
    note: "A clear panel topped with mountains: blue peaks with snow caps, navy hills, a rising gold sun and a gold horizon.",
    body: `M0.0 289.9 L0.2 291.8 L0.7 293.7 L1.6 295.4 L2.9 297.0 L4.4 298.2 L6.1 299.2 L8.0 299.8 L10.1 300.0 L191.1 300.0 L192.1 299.9 L193.8 299.6 L195.0 299.2 L196.5 298.4 L197.5 297.7 L198.7 296.4 L199.9 294.6 L200.3 293.7 L200.9 292.0 L201.1 289.9 L201.0 73.2 L200.9 72.9 L200.5 72.2 L174.8 46.4 L142.5 0.8 L141.9 0.3 L141.6 0.1 L140.8 0.0 L140.0 0.2 L139.4 0.6 L139.1 0.9 L97.8 66.7 L97.5 67.1 L96.9 67.5 L96.2 67.7 L95.8 67.7 L95.1 67.5 L94.7 67.2 L82.4 56.7 L59.7 35.9 L59.1 35.5 L58.3 35.4 L57.6 35.5 L56.9 35.9 L34.2 58.7 L23.8 68.4 L23.1 68.7 L22.6 68.8 L10.0 68.8 L9.0 68.8 L7.2 69.2 L5.4 69.9 L3.6 71.1 L2.2 72.5 L1.1 74.2 L0.7 75.1 L0.2 76.8 L0.0 78.9 Z`,
    layers: [
      { d: `M200.9 72.9 L200.5 72.2 L174.9 46.6 L142.5 0.8 L141.9 0.3 L141.6 0.1 L141.2 0.0 L140.4 0.0 L139.7 0.4 L139.1 0.9 L96.5 68.8 L82.4 56.7 L59.7 35.9 L59.1 35.5 L58.3 35.4 L57.6 35.5 L56.9 35.9 L34.2 58.7 L0.0 90.9 L0.0 116.2 L7.1 110.2 L10.5 107.4 L14.1 104.9 L16.0 103.8 L18.0 102.8 L20.0 102.1 L22.1 101.7 L24.0 101.4 L24.7 101.5 L26.1 100.0 L28.2 98.2 L30.5 96.8 L32.9 95.7 L34.9 95.1 L36.8 94.7 L38.2 94.5 L40.2 94.4 L42.9 94.6 L45.5 95.1 L47.5 95.7 L49.9 96.8 L51.7 97.9 L53.8 99.5 L55.3 100.9 L57.0 103.0 L58.1 104.7 L59.2 107.1 L59.9 109.1 L60.5 111.6 L60.8 113.6 L60.8 115.7 L60.5 118.4 L59.8 121.3 L60.1 121.4 L62.3 121.5 L64.6 121.2 L66.9 120.4 L69.4 119.1 L71.9 117.5 L74.4 115.6 L77.0 113.4 L87.6 103.9 L90.2 101.6 L93.0 99.6 L95.7 97.9 L98.7 96.6 L101.6 95.7 L104.6 95.4 L107.8 95.8 L110.8 96.8 L114.0 98.4 L117.1 100.4 L120.2 102.7 L123.2 105.3 L135.2 116.3 L138.1 118.8 L140.9 121.0 L143.6 122.9 L146.2 124.3 L148.6 125.2 L150.9 125.6 L152.5 125.5 L154.2 125.1 L155.8 124.4 L157.5 123.5 L159.2 122.4 L160.9 121.1 L167.7 115.3 L171.3 112.6 L173.1 111.4 L175.0 110.5 L176.8 109.8 L178.7 109.5 L180.6 109.5 L182.5 109.6 L184.2 109.9 L187.6 110.9 L189.4 111.6 L192.7 113.2 L201.1 117.6 L201.1 73.6 Z`, mat: 'blue', level: 1, fin: 'gloss' },
      { d: `M201.1 119.3 L193.7 115.3 L190.4 113.7 L187.1 112.4 L185.5 111.8 L183.9 111.4 L182.2 111.1 L180.6 111.0 L179.0 111.0 L177.2 111.3 L175.5 111.9 L173.8 112.8 L172.1 113.8 L168.7 116.5 L161.8 122.3 L160.1 123.6 L158.3 124.8 L156.5 125.8 L154.6 126.5 L152.7 127.0 L150.8 127.1 L148.2 126.7 L145.5 125.7 L142.8 124.2 L140.0 122.2 L137.1 119.9 L134.2 117.4 L122.2 106.4 L119.2 103.9 L116.2 101.6 L113.3 99.7 L110.3 98.2 L107.4 97.3 L104.6 96.9 L101.9 97.2 L99.2 98.0 L96.5 99.2 L93.9 100.9 L91.2 102.8 L88.6 105.0 L78.0 114.5 L75.4 116.7 L72.8 118.7 L70.1 120.4 L67.5 121.8 L64.9 122.7 L62.3 123.1 L59.9 122.9 L57.5 122.3 L55.0 121.3 L52.5 120.0 L50.1 118.5 L47.6 116.8 L37.9 109.2 L35.5 107.5 L33.2 105.9 L30.9 104.7 L28.6 103.7 L26.3 103.1 L24.1 102.9 L22.2 103.2 L20.4 103.6 L18.5 104.3 L16.7 105.1 L15.0 106.1 L13.2 107.3 L9.7 109.9 L0.0 118.1 L0.0 149.2 L201.1 149.2 Z`, mat: 'navy', level: 1, fin: 'gloss' },
      { d: `M59.3 113.8 L58.9 111.3 L58.7 110.1 L58.1 108.3 L57.6 107.1 L56.8 105.5 L55.4 103.4 L53.7 101.5 L51.8 99.9 L50.8 99.1 L49.2 98.2 L46.9 97.1 L45.2 96.6 L43.9 96.3 L41.5 96.0 L40.2 95.9 L38.3 96.0 L35.9 96.4 L33.5 97.1 L32.3 97.6 L30.7 98.5 L28.6 99.9 L26.6 101.6 L29.2 102.3 L31.6 103.3 L34.0 104.7 L36.4 106.3 L38.8 108.0 L46.1 113.7 L50.9 117.2 L53.3 118.7 L55.6 120.0 L58.4 121.0 L58.8 119.4 L59.2 117.5 L59.3 115.6 Z`, mat: 'gold', level: 1, fin: 'glitter' },
      { d: `M115.8 38.3 L115.9 38.6 L116.1 38.8 L116.5 39.1 L126.3 40.6 L126.7 40.5 L127.0 40.4 L136.1 33.0 L136.5 32.9 L136.8 32.9 L137.3 33.1 L146.2 42.1 L146.5 42.2 L146.9 42.3 L147.4 42.1 L156.3 33.1 L156.6 32.9 L156.9 32.9 L157.4 33.0 L166.8 40.5 L167.2 40.6 L169.2 40.5 L169.6 40.3 L169.8 40.0 L169.8 39.7 L169.7 39.2 L142.5 0.9 L141.9 0.3 L141.3 0.0 L140.9 0.0 L140.0 0.2 L139.4 0.6 L139.1 1.0 L115.9 38.0 Z M49.2 43.9 L49.2 44.2 L49.4 44.6 L49.7 44.8 L50.5 44.9 L50.7 45.1 L57.7 52.1 L58.2 52.3 L58.5 52.3 L58.9 52.1 L65.8 45.2 L66.1 45.0 L66.5 44.9 L66.8 45.0 L69.7 47.0 L70.0 47.1 L70.3 46.9 L70.5 46.7 L70.7 46.4 L70.6 45.9 L70.4 45.7 L59.8 35.9 L59.1 35.5 L58.6 35.4 L57.7 35.5 L57.0 35.9 L49.3 43.6 Z`, mat: 'white', level: 2, fin: 'panel' },
      { d: `M195.0 152.2 L6.0 152.2 L6.0 154.7 L195.0 154.7 Z`, mat: 'gold', level: 1, fin: 'foil' }
    ],
    face: { x: -0.113, y: 0.245, w: 0.495, h: 0.421, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/summit.aa931897.webp", "box": [-6.0, -6.0, 207.28, 306.19]}, tile: "img/designs/tile-summit.89fdc053.webp",
  },
};
/* </designs> */

/* What a design's layers add to its price: nothing. The owner (4 Nov): "don't
   add up prices even if it has layering" -- a layered design costs what a plain
   cut of the same size does. */
const LAYER_PRICE = 0;
function designCost(key) {
  const D = DESIGNS[key];
  return D ? 1 + Math.min(0.5, LAYER_PRICE * D.layers.length) : 1;
}

/* A design's body, fitted to the blade. */
function designShape(key) {
  return (w, h) => pathToShape(DESIGNS[key].body, w, h);
}

/* A design's layers, each placed in its body's frame: { shape, mat, level }. */
export function layerShapes(key, w, h) {
  const D = DESIGNS[key];
  if (!D) return [];
  const body = pathToShape(D.body, w, h);
  if (!body) return [];
  return D.layers.map(L => ({ shape: pathToShape(L.d, w, h, body.userData.frame), mat: L.mat, level: L.level }))
    .filter(L => L.shape);
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

/* Every figure is a FLAT FASHION ILLUSTRATION WITH NO FACE, printed in full
   colour and cut to its own outline. The owner on 3 Nov, step by step: "not
   cartoon style, more modern and realistic ... professional and luxury", then
   "a neutral face" (not a mannequin, not a stern stare), and finally, holding
   up flat vector men in suits with blank faces: "make it not real faces, make
   it like illustration with no face".
   How a figure is made (each script's docstring has the detail):
     generate-figures.py   a realistic studio photograph, made on this laptop's
                           GPU (RealVisXL V5.0; its licence allows commercial use)
     inpaint-marks.py      big brand marks painted out as fabric
     cutout-figures.py     off the backdrop, small marks filled in
     illustrate-figures.py flattened to a few clean planes, skin in three tones,
                           the face an oval of flat skin under the hair
     polish-figure.py      the cut and the print, as for any source
   Each _ART is the picture and its corners in the cut's frame.
     Gentleman  black tuxedo, buttoning the jacket      GENT-2002
     Suit       charcoal suit, navy tie                 SUIT-2000
     Lady       red dress                               LADY-2000
     Gowns      0 Ball gown GOWN_BALL-5001, 1 Train GOWN_TRAIN-2000,
                2 Evening GOWN_EVENING-2003, 3 Off-shoulder GOWN_SWEEP-2001
     Graduate   men GRAD-2003, women GRAD_W-5002
   (NAME-seed is the photograph in figure-src/ai and the seed it was drawn with.)
   Before this: realistic photographs with faces, flat cartoon drawings from
   Pixabay, and black silhouettes. Drawn 300 tall, y down. */
const GENT_TRACE = `M102.3 299.9 L83.1 299.9 L81.6 298.2 L77.1 295.4 L74.0 292.9 L69.7 290.7 L66.0 287.9 L63.5 287.0
  L61.9 287.0 L60.4 287.4 L56.2 289.9 L52.0 292.0 L47.3 295.4 L45.6 296.3 L41.9 297.3 L36.6 297.5
  L33.8 297.0 L32.7 296.5 L31.2 295.4 L30.4 294.3 L29.7 292.5 L29.4 290.2 L30.0 286.3 L31.4 283.4
  L35.2 277.5 L36.0 275.8 L36.4 274.3 L36.4 272.0 L31.7 253.1 L30.7 247.4 L29.7 228.3 L29.7 218.4
  L27.8 196.9 L25.8 184.8 L24.6 175.3 L23.5 170.2 L21.7 158.4 L20.5 154.3 L20.2 152.4 L20.2 129.1
  L19.3 126.7 L17.5 124.4 L7.5 117.8 L2.1 113.4 L0.6 111.8 L-0.8 109.4 L-2.1 106.0 L-2.6 103.4
  L-2.6 101.5 L-1.2 93.6 L4.6 71.3 L7.6 61.6 L9.0 55.1 L9.7 53.3 L11.1 51.5 L13.0 50.2
  L21.0 47.4 L25.0 45.3 L27.0 43.7 L28.3 41.4 L28.6 40.0 L28.3 37.5 L26.0 33.2 L25.2 30.9
  L24.5 24.5 L22.1 17.8 L22.0 15.4 L22.9 11.9 L24.9 8.4 L28.6 4.4 L32.1 2.3 L38.2 0.3
  L41.2 -0.1 L44.1 0.2 L46.9 0.8 L49.9 2.0 L51.7 3.1 L53.6 5.0 L58.1 10.4 L59.3 13.0
  L60.7 18.2 L62.3 22.0 L62.7 23.7 L62.8 26.8 L62.6 28.7 L60.8 34.6 L61.0 37.4 L62.4 39.7
  L64.2 41.2 L66.2 42.1 L81.6 46.5 L83.5 47.7 L84.7 49.2 L85.5 50.6 L87.2 56.4 L90.4 64.3
  L93.1 73.4 L95.4 79.3 L97.5 86.7 L99.6 92.8 L99.7 97.0 L99.0 99.6 L98.1 101.7 L94.6 106.3
  L84.5 116.3 L83.2 117.8 L81.9 120.5 L81.6 123.8 L82.6 132.0 L83.6 151.9 L84.6 159.0 L86.2 172.5
  L87.1 185.4 L87.1 198.1 L90.8 222.4 L92.0 243.7 L93.0 253.4 L93.1 259.5 L92.8 264.6 L92.4 267.4
  L91.1 273.4 L91.1 275.7 L91.4 277.1 L92.8 279.4 L98.1 285.9 L101.7 291.3 L102.4 294.5 Z`;

const LADY_TRACE = `M53.6 299.9 L5.0 299.9 L3.6 296.1 L2.0 294.1 L-2.2 289.7 L-3.6 287.0 L-3.8 285.7 L-3.8 283.6
  L-2.9 276.0 L1.6 267.2 L3.2 261.9 L3.8 260.7 L5.7 258.2 L9.4 254.1 L11.4 250.1 L17.8 226.6
  L20.1 215.2 L24.5 204.0 L26.8 195.0 L26.2 186.0 L25.3 179.4 L24.9 163.7 L24.0 158.5 L23.6 154.9
  L22.3 149.4 L21.8 145.4 L21.8 142.2 L22.3 136.2 L23.9 128.0 L25.4 122.2 L25.4 119.2 L24.7 117.4
  L23.1 115.5 L12.3 108.9 L-0.6 98.8 L-1.7 97.6 L-2.8 95.6 L-3.3 93.6 L-3.3 90.9 L-2.7 88.6
  L-1.6 86.4 L3.2 79.6 L9.5 72.2 L15.7 66.1 L20.2 60.7 L26.5 53.8 L27.8 51.9 L28.4 50.6
  L28.8 48.8 L29.2 38.0 L29.7 35.4 L32.7 26.8 L38.2 17.0 L43.7 11.0 L48.0 5.2 L50.2 3.2
  L52.8 1.5 L55.8 0.3 L57.8 -0.1 L60.6 -0.1 L65.4 0.8 L68.2 1.9 L71.1 4.1 L73.8 7.0
  L76.4 10.9 L80.2 18.2 L83.7 22.2 L87.8 27.4 L88.9 30.3 L88.8 35.8 L89.6 38.3 L90.3 39.3
  L95.0 43.7 L97.1 47.1 L99.1 52.9 L99.8 58.0 L99.5 64.0 L102.6 82.0 L103.5 90.0 L103.7 96.8
  L103.4 98.8 L102.7 101.2 L96.0 116.6 L84.7 137.6 L81.6 147.1 L80.3 149.2 L75.1 155.2 L72.3 159.5
  L67.4 170.3 L62.8 179.5 L60.5 188.0 L57.9 195.5 L56.1 198.5 L52.1 202.8 L51.1 205.5 L50.9 207.9
  L51.3 213.0 L51.3 218.9 L50.5 227.7 L50.3 250.1 L51.1 255.1 L52.5 259.1 L54.5 263.6 L55.4 266.7
  L55.5 271.5 L55.2 274.0 L55.2 277.9 L56.5 288.0 L56.2 291.5 L54.2 296.8 Z
  M33.4 100.1 L35.9 99.3 L38.2 97.4 L40.1 94.9 L40.9 93.2 L41.4 90.5 L40.7 86.5 L39.1 82.5
  L38.2 81.4 L36.9 80.3 L34.2 79.4 L33.0 79.4 L31.1 79.9 L28.3 81.9 L24.2 86.3 L23.0 88.3
  L22.5 90.3 L22.5 91.5 L23.0 93.4 L24.3 95.4 L25.6 96.8 L27.8 98.5 L29.7 99.5 L31.9 100.2 Z
  M27.9 290.7 L29.5 290.3 L30.8 289.7 L32.0 288.8 L33.0 287.5 L33.9 285.2 L34.5 278.8 L34.4 275.6
  L33.3 272.9 L31.3 271.1 L28.6 270.2 L27.4 270.2 L25.5 270.7 L23.9 271.7 L22.8 272.9 L21.3 276.0
  L19.7 282.9 L19.7 285.0 L20.0 286.2 L20.6 287.5 L21.7 288.9 L24.2 290.3 L26.0 290.7 Z`;

const SUIT_TRACE = `M95.8 299.9 L26.5 299.9 L22.3 295.3 L21.4 293.6 L21.0 292.1 L20.9 289.9 L21.4 286.8 L23.5 282.1
  L26.7 276.6 L27.2 274.8 L27.2 272.1 L26.4 267.0 L25.4 257.1 L24.9 248.1 L23.0 237.7 L22.1 231.5
  L22.1 203.8 L20.5 179.3 L19.0 166.1 L17.1 154.4 L15.9 151.6 L11.4 146.4 L9.4 142.8 L5.5 129.9
  L5.0 125.0 L3.9 119.2 L3.1 108.0 L3.9 101.4 L4.7 90.1 L5.5 83.7 L5.9 76.3 L7.5 68.1
  L9.8 61.2 L10.4 57.7 L10.9 56.1 L11.9 54.4 L13.8 53.0 L23.4 49.1 L26.9 47.4 L29.2 45.9
  L30.5 44.4 L31.3 41.7 L31.2 39.7 L30.7 38.2 L27.5 32.0 L26.7 30.0 L26.5 28.3 L27.4 22.4
  L27.2 15.4 L27.5 13.1 L28.1 10.8 L29.3 8.0 L30.7 5.9 L32.2 4.2 L34.5 2.5 L36.5 1.5
  L40.5 0.4 L43.8 -0.1 L47.2 -0.1 L49.7 0.3 L52.1 1.1 L53.8 1.9 L55.9 3.4 L61.0 7.7
  L63.0 9.9 L64.8 13.5 L65.2 16.0 L65.3 19.6 L67.1 25.6 L66.8 29.2 L66.1 31.3 L64.0 35.4
  L63.5 36.9 L63.3 39.2 L63.8 41.0 L65.6 43.3 L68.0 44.8 L75.4 47.4 L82.7 49.6 L83.8 50.0
  L85.6 51.5 L87.1 54.1 L91.6 69.1 L94.9 89.0 L96.4 96.8 L96.7 100.5 L96.4 116.4 L95.6 124.2
  L94.0 134.4 L91.7 144.1 L90.4 146.7 L87.7 149.6 L86.8 151.1 L86.1 153.5 L86.1 156.3 L86.4 159.0
  L86.3 163.0 L87.1 168.3 L87.4 172.8 L88.4 182.7 L88.4 196.4 L88.9 200.2 L88.9 205.9 L90.5 217.3
  L91.6 228.6 L91.6 232.7 L91.1 239.1 L91.1 258.4 L90.3 267.0 L89.0 273.7 L89.0 275.5 L89.4 277.1
  L90.2 278.5 L94.0 284.2 L96.3 289.0 L96.8 291.4 L96.8 293.2 Z
  M58.7 290.7 L60.9 290.1 L63.0 288.6 L64.2 286.8 L64.8 284.5 L65.0 272.5 L64.4 269.0 L63.3 265.8
  L62.6 264.8 L60.2 262.7 L59.9 262.0 L60.0 261.6 L60.4 261.0 L62.5 259.1 L63.6 257.4 L64.2 255.1
  L64.3 252.3 L63.5 242.6 L62.7 239.7 L61.5 237.9 L60.1 236.8 L58.3 236.1 L56.2 235.9 L54.1 236.5
  L52.2 237.9 L51.0 239.7 L50.4 242.0 L50.1 249.4 L51.2 256.0 L52.4 258.5 L55.4 261.4 L55.6 262.3
  L52.3 265.8 L51.5 267.6 L49.8 273.0 L49.4 275.1 L49.5 284.4 L49.9 286.2 L50.5 287.5 L52.4 289.5
  L55.0 290.6 Z`;

const GOWN_BALL_TRACE = `M108.5 299.9 L82.3 299.9 L81.0 298.8 L79.0 297.7 L77.1 297.1 L71.0 296.0 L67.4 295.1 L65.5 294.1
  L62.4 291.7 L60.8 290.9 L57.3 290.1 L53.3 290.0 L49.5 290.5 L44.7 291.6 L38.3 292.6 L29.6 295.4
  L28.2 295.7 L26.2 295.7 L23.8 295.1 L21.0 293.8 L17.7 292.8 L13.0 291.9 L6.5 291.3 L0.1 289.4
  L-5.3 289.1 L-17.0 287.4 L-20.5 286.5 L-24.0 285.1 L-37.0 279.2 L-39.2 278.0 L-41.6 276.1 L-45.7 271.8
  L-47.6 269.3 L-48.5 266.9 L-48.5 264.5 L-47.8 262.2 L-39.7 245.1 L-29.5 220.4 L-25.1 210.4 L-15.8 188.4
  L-5.4 166.2 L-2.8 159.3 L-2.4 156.7 L-3.2 152.0 L-3.3 149.7 L-3.0 146.2 L-2.5 143.9 L-1.4 141.5
  L2.9 135.8 L4.9 132.0 L9.0 121.2 L13.5 105.8 L17.4 95.0 L17.9 91.9 L18.0 88.5 L17.2 85.5
  L15.8 82.2 L15.5 80.4 L15.5 78.8 L15.8 76.8 L18.1 69.6 L18.5 62.1 L19.4 58.1 L20.6 55.7
  L23.2 52.8 L25.3 51.4 L27.0 50.5 L30.9 49.1 L32.7 48.2 L34.3 46.6 L35.2 44.8 L35.5 43.6
  L35.5 41.7 L34.7 38.3 L34.5 33.3 L33.2 25.2 L32.5 17.9 L32.9 14.8 L33.9 11.6 L35.0 9.2
  L36.0 7.7 L40.0 4.0 L43.4 1.9 L49.2 -0.0 L52.2 0.1 L56.1 1.2 L59.8 3.4 L64.5 7.5
  L66.4 9.4 L68.5 12.4 L69.7 15.0 L71.4 20.7 L71.7 22.4 L71.7 24.8 L71.4 26.2 L70.8 27.9
  L65.9 37.6 L64.2 43.9 L64.1 46.2 L64.6 48.0 L65.6 49.6 L70.4 53.7 L72.6 56.6 L74.0 59.6
  L75.3 65.6 L75.8 69.5 L75.8 76.4 L75.5 80.1 L75.5 94.5 L76.4 104.7 L76.4 107.8 L76.8 111.4
  L76.8 120.5 L77.3 122.7 L79.5 126.4 L84.2 133.0 L89.9 140.2 L93.4 145.3 L103.4 162.4 L108.4 172.2
  L114.5 186.1 L121.9 201.5 L124.6 208.1 L130.9 225.3 L139.4 252.0 L145.8 267.5 L147.9 271.9 L148.5 273.9
  L148.5 276.0 L148.2 277.3 L147.3 278.8 L145.3 280.8 L142.4 283.4 L140.2 284.9 L133.5 288.4 L128.6 292.9
  L126.9 293.7 L124.6 294.4 L116.2 295.1 L112.4 296.0 L111.0 296.7 L109.9 297.7 Z`;

const GOWN_TRAIN_TRACE = `M119.0 299.9 L58.1 299.9 L56.4 298.3 L54.7 297.4 L49.9 296.2 L47.7 296.2 L41.9 297.0 L29.3 296.8
  L26.2 296.0 L21.6 294.1 L15.6 293.0 L7.3 289.7 L4.8 289.2 L-3.1 288.4 L-8.7 287.2 L-11.5 285.9
  L-12.6 284.7 L-13.4 283.0 L-13.7 281.5 L-13.6 280.2 L-12.6 277.7 L-11.5 276.3 L-7.6 273.1 L-6.4 271.0
  L-3.4 261.5 L-2.1 255.4 L0.1 239.4 L2.5 218.9 L3.5 206.5 L5.3 191.3 L5.7 186.1 L5.7 181.8
  L4.7 174.7 L-0.3 155.4 L-1.8 146.3 L-2.1 143.4 L-1.9 140.4 L-1.3 133.9 L-0.1 126.5 L-0.5 124.1
  L-1.6 122.1 L-3.0 120.7 L-12.8 113.2 L-17.0 109.1 L-20.1 105.6 L-26.6 97.4 L-28.3 94.8 L-29.3 92.2
  L-29.5 89.6 L-28.8 87.3 L-27.7 85.0 L-23.7 79.2 L-19.5 74.4 L-12.0 67.0 L-6.0 59.3 L-2.4 55.6
  L3.2 50.9 L5.3 49.5 L9.3 48.0 L14.4 46.6 L16.7 45.2 L18.0 43.6 L18.9 41.1 L18.8 38.9
  L17.9 36.8 L14.6 32.5 L12.9 28.5 L12.0 25.6 L11.8 23.4 L12.1 19.8 L14.1 13.6 L15.9 9.7
  L17.4 7.5 L21.6 3.4 L23.8 1.9 L27.0 0.6 L29.9 -0.1 L32.2 -0.1 L34.1 0.3 L41.2 3.1
  L43.4 4.6 L45.0 6.4 L46.8 9.1 L48.1 12.1 L49.4 16.2 L50.7 22.1 L50.7 24.2 L50.3 26.2
  L48.1 31.9 L47.2 36.0 L47.0 38.3 L47.5 40.1 L49.2 42.4 L51.1 43.6 L53.4 44.2 L58.4 44.5
  L60.7 45.1 L63.5 46.3 L66.0 48.1 L68.1 50.4 L69.6 53.1 L70.4 56.1 L71.0 60.5 L71.6 67.4
  L71.6 72.1 L70.2 89.0 L68.6 98.9 L68.4 103.9 L67.9 106.7 L64.8 117.8 L59.3 132.5 L58.9 135.2
  L58.8 145.3 L57.3 152.8 L55.5 157.6 L50.9 165.7 L45.7 176.6 L43.7 182.2 L42.7 186.3 L42.5 191.0
  L43.5 204.6 L47.2 228.5 L48.4 234.2 L53.5 252.6 L55.4 258.4 L56.5 260.5 L58.1 262.1 L60.5 263.2
  L69.8 264.4 L74.8 264.5 L82.4 265.2 L89.9 266.6 L96.3 267.5 L100.7 267.7 L107.9 270.2 L110.2 270.7
  L113.9 271.1 L115.7 271.6 L122.1 274.9 L125.6 277.9 L128.1 280.6 L129.2 283.3 L129.2 285.8 L128.1 290.2
  L127.0 292.4 L124.7 294.8 L121.0 297.2 Z
  M5.6 102.5 L7.0 102.2 L8.7 101.4 L11.3 99.2 L12.5 97.0 L12.8 94.1 L12.5 91.4 L11.6 88.4
  L10.8 86.4 L9.9 85.2 L8.3 83.8 L7.0 83.2 L4.3 83.0 L3.1 83.2 L1.2 84.2 L-2.2 87.3
  L-3.2 88.6 L-4.2 90.5 L-4.5 93.3 L-3.4 96.5 L-1.6 99.1 L-0.1 100.8 L2.6 102.3 L3.8 102.6 Z`;

const GOWN_EVENING_TRACE = `M87.1 299.9 L39.5 299.9 L38.0 298.8 L35.9 297.9 L29.3 296.4 L11.8 293.5 L4.8 291.7 L0.7 290.1
  L-3.6 287.8 L-6.7 285.0 L-8.5 282.1 L-9.1 279.3 L-8.5 276.2 L-6.5 273.0 L-5.0 271.2 L-2.2 269.4
  L5.9 266.6 L10.6 265.3 L21.6 264.1 L23.2 263.6 L24.7 262.7 L26.8 260.5 L32.8 251.3 L35.4 245.0
  L37.1 241.7 L38.9 234.1 L40.8 228.1 L42.1 221.3 L43.6 215.2 L44.7 207.0 L46.5 197.1 L47.5 188.8
  L47.9 183.2 L47.4 177.3 L45.3 168.0 L40.6 155.6 L37.4 145.7 L36.6 139.9 L35.1 131.9 L34.1 127.5
  L33.9 122.2 L33.3 117.3 L32.7 114.3 L31.9 112.4 L30.4 110.7 L28.3 109.4 L20.3 107.3 L15.6 105.7
  L1.8 99.3 L-1.0 97.7 L-3.4 95.4 L-4.5 93.0 L-4.7 89.8 L-4.2 87.2 L-3.0 84.0 L-1.8 81.8
  L4.2 74.0 L8.6 69.3 L15.4 62.9 L28.4 48.5 L30.5 46.9 L32.4 45.8 L35.8 44.8 L39.1 44.5
  L40.8 44.2 L42.5 43.3 L44.1 41.7 L45.1 39.6 L45.7 35.5 L45.3 32.5 L44.4 29.0 L44.2 25.9
  L44.9 18.7 L45.4 16.2 L46.2 13.8 L47.8 11.0 L50.3 7.9 L51.7 5.6 L53.1 3.9 L54.2 2.9
  L57.4 1.1 L59.9 0.3 L63.0 -0.1 L66.4 0.1 L68.7 0.6 L72.9 2.5 L76.0 4.8 L78.2 6.9
  L80.2 9.6 L81.6 12.0 L83.5 16.2 L84.2 18.4 L84.2 23.6 L83.6 26.5 L79.7 35.2 L79.3 37.3
  L79.1 40.6 L77.3 45.9 L77.5 48.2 L78.2 50.1 L78.9 51.0 L80.8 52.5 L84.7 54.8 L86.2 56.1
  L88.2 58.1 L90.9 62.1 L93.3 66.2 L98.3 76.4 L106.8 91.6 L108.0 94.2 L109.0 97.9 L108.8 101.6
  L108.2 103.6 L107.2 105.6 L102.0 113.0 L93.6 122.1 L92.5 124.0 L92.0 125.8 L92.0 127.9 L93.2 133.6
  L93.8 139.9 L93.8 151.9 L93.3 161.6 L93.3 173.6 L93.6 178.1 L94.2 181.6 L98.0 193.9 L98.8 200.4
  L98.8 204.2 L98.4 208.0 L98.4 231.5 L98.9 238.1 L98.9 253.6 L99.4 258.1 L99.5 264.4 L100.1 272.1
  L101.2 278.2 L101.8 285.1 L101.2 287.6 L99.5 290.4 L96.5 292.6 L89.1 297.2 Z`;

const GRAD_TRACE = `M77.2 299.9 L28.0 299.9 L26.9 297.7 L25.1 295.1 L24.2 293.0 L24.2 290.2 L25.0 287.9 L28.9 278.6
  L28.9 275.5 L26.2 269.3 L24.8 262.4 L23.8 259.7 L21.9 257.5 L17.6 254.1 L16.2 252.8 L15.4 251.5
  L14.9 249.4 L15.8 234.9 L16.6 214.8 L16.9 211.1 L17.7 184.4 L18.3 173.5 L18.1 168.7 L17.0 166.1
  L15.1 164.2 L13.4 163.4 L-0.7 158.2 L-3.1 156.9 L-4.1 155.9 L-4.9 154.7 L-5.3 152.2 L-4.4 145.2
  L4.2 93.8 L7.0 80.4 L10.5 70.1 L12.8 65.9 L14.5 63.8 L16.2 62.2 L19.6 60.3 L24.5 58.4
  L27.4 56.9 L31.3 54.6 L33.7 53.0 L35.0 51.7 L36.3 49.0 L36.5 46.8 L36.2 45.6 L34.3 41.5
  L33.5 38.7 L33.0 35.9 L33.0 33.1 L34.0 28.6 L34.0 26.3 L33.8 25.1 L32.7 23.0 L31.3 21.7
  L26.0 18.2 L24.8 17.2 L24.1 16.3 L23.5 14.7 L23.4 13.5 L23.8 11.9 L24.4 10.7 L25.5 9.6
  L27.8 8.3 L48.2 1.3 L52.9 -0.1 L55.9 0.1 L59.5 1.8 L68.8 8.1 L78.1 14.8 L79.4 16.0
  L80.5 17.8 L80.8 19.2 L80.5 21.2 L77.5 26.0 L76.8 28.8 L76.6 48.4 L76.3 51.8 L76.4 53.7
  L77.3 56.2 L78.6 57.7 L80.7 59.0 L84.5 60.5 L86.8 62.3 L88.0 63.6 L89.6 65.9 L91.0 68.7
  L93.2 74.7 L94.6 79.7 L96.6 89.3 L100.9 114.2 L103.3 132.2 L105.1 152.5 L105.3 155.0 L104.9 157.6
  L103.9 159.4 L103.0 160.3 L100.6 161.6 L93.3 163.7 L89.8 165.2 L87.8 167.0 L86.7 169.7 L86.5 173.8
  L87.8 199.2 L88.3 227.9 L88.6 231.7 L88.8 249.5 L88.2 251.5 L87.4 252.9 L85.5 254.5 L81.7 256.3
  L80.7 257.0 L79.4 258.5 L78.5 260.9 L77.7 268.7 L75.1 278.3 L75.3 281.1 L77.9 286.3 L78.9 289.9
  L78.8 292.2 L77.6 296.4 Z`;

const GOWN_SWEEP_TRACE = `M102.1 299.9 L80.4 299.9 L78.8 298.3 L76.6 297.1 L72.4 295.8 L69.0 295.2 L61.4 292.7 L59.1 292.2
  L57.0 292.1 L53.4 292.3 L43.0 294.1 L40.9 294.1 L38.8 293.6 L36.8 292.3 L33.4 288.3 L28.7 285.2
  L26.5 282.8 L25.7 281.4 L25.1 279.4 L25.0 277.1 L25.2 272.8 L24.7 271.0 L23.6 269.3 L22.5 268.3
  L21.4 267.7 L19.4 267.2 L18.1 267.2 L15.6 268.0 L13.9 268.9 L12.5 270.2 L11.2 272.5 L10.4 277.1
  L9.5 278.9 L8.4 280.2 L5.3 282.6 L2.2 285.5 L-1.3 286.9 L-6.0 287.9 L-12.7 288.3 L-14.8 287.9
  L-16.3 287.2 L-17.5 286.3 L-18.3 285.2 L-19.1 283.3 L-19.1 279.7 L-17.4 274.3 L-17.4 273.0 L-17.9 271.0
  L-18.9 269.3 L-23.4 265.0 L-24.2 263.7 L-25.1 261.8 L-25.1 258.5 L-19.9 246.8 L-16.9 236.0 L-12.7 218.6
  L-11.3 211.4 L-9.4 203.8 L-8.2 198.0 L-6.1 190.4 L-0.8 167.8 L3.1 153.2 L2.9 149.9 L0.6 142.2
  L-0.9 132.5 L-1.1 126.8 L-2.4 115.2 L-2.8 107.6 L-2.8 104.0 L-2.4 99.7 L-0.9 91.2 L0.1 81.9
  L0.1 78.7 L-0.3 76.2 L-0.0 71.3 L1.6 61.5 L2.6 57.6 L4.5 54.2 L6.1 52.6 L7.9 51.4
  L14.7 48.3 L15.8 47.3 L16.9 45.6 L17.4 43.7 L17.3 41.6 L15.0 35.9 L12.9 27.2 L11.0 21.3
  L10.7 19.0 L10.8 17.0 L12.3 11.8 L13.3 9.3 L14.6 7.3 L16.4 5.1 L18.5 2.9 L20.2 1.8
  L23.0 0.6 L25.4 0.1 L27.8 -0.1 L31.7 0.7 L39.2 4.2 L41.4 5.9 L43.5 8.2 L44.8 10.3
  L46.0 13.1 L46.8 15.8 L47.5 20.6 L48.9 24.6 L49.5 27.2 L49.3 29.0 L48.8 30.8 L45.1 37.3
  L44.8 40.1 L45.4 42.0 L46.4 43.6 L47.7 44.8 L55.0 48.2 L57.2 49.9 L58.2 51.1 L70.2 69.1
  L77.1 78.5 L79.6 82.7 L81.6 87.3 L82.1 89.9 L82.0 91.8 L81.6 93.1 L80.3 95.2 L75.4 99.8
  L70.7 105.3 L66.6 109.4 L56.5 117.7 L54.9 120.0 L54.4 122.0 L54.4 123.4 L55.3 127.1 L57.9 135.4
  L63.7 157.6 L75.9 201.9 L82.9 230.4 L83.7 232.5 L85.5 235.4 L92.6 244.0 L109.2 261.3 L111.4 263.9
  L113.8 267.6 L117.6 270.5 L119.2 272.1 L123.2 277.1 L124.5 280.0 L125.1 283.3 L125.1 285.8 L124.2 288.1
  L122.9 289.6 L120.6 290.8 L111.7 293.2 L106.4 295.7 L104.3 297.1 L103.4 298.0 Z`;

/* The sports figures, made the same way as the formal ones above: plain kit,
   asked for "unbranded, no logos, no lettering" and still cleaned by hand --
   cutout-figures.py fills small marks from the fabric around them, and
   inpaint-marks.py repaints the bigger ones (a team name across a jersey, a
   maker's patch on a boxer's waistband). A ball is kept where the player holds
   it or it stands on the floor at their feet, so it is printed and cut with them.
     Basketball  men 0 Ready BALL_M-5001 (ball in both hands); women 1 Ready BALL_W-3000
     Volleyball  men 0 Ready VOLLEY_M-3003; women 1 Ready VOLLEY_W-3002 (each ball at the hip)
     Football    men 0 On the ball FOOT_M-3001; women 1 On the ball FOOT_W-3001
     Athletics   men 0 Run RUN_M-3003; women 1 Sprint RUN_W-3003, 2 Ready RUN_W_READY-3003
     Boxing      men 0 Victory BOX_M_VICTORY-3000, 1 Champion BOX_M_CHAMPION-3001;
                 women 2 Guard BOX_W_GUARD-3001, 3 Ready BOX_W_READY-3002 */
const RUN_M_RUN_TRACE = `M68.8 299.9 L52.1 299.9 L50.2 298.0 L45.5 295.5 L44.1 294.1 L43.1 292.2 L42.9 289.8 L45.3 281.2
  L45.6 272.7 L46.8 266.8 L47.7 263.8 L50.0 259.2 L50.5 256.7 L50.6 241.1 L50.2 238.6 L49.0 236.1
  L45.0 232.1 L41.8 227.3 L40.4 226.1 L36.6 223.7 L35.0 222.1 L32.2 218.1 L30.5 214.8 L29.6 211.7
  L29.1 205.7 L26.4 194.1 L24.8 183.2 L22.5 177.3 L21.9 174.7 L21.8 169.7 L21.4 167.0 L20.7 164.8
  L18.0 159.8 L16.4 153.6 L16.1 150.6 L16.1 147.1 L16.4 141.4 L17.0 138.0 L17.0 135.5 L16.8 134.2
  L15.5 131.7 L12.1 128.9 L10.9 127.5 L9.8 125.5 L8.5 122.4 L4.3 116.1 L3.3 114.9 L-0.4 111.5
  L-2.8 108.1 L-7.2 101.2 L-7.9 98.9 L-8.2 96.8 L-7.9 92.2 L-7.2 89.2 L-6.1 86.1 L-0.0 74.2
  L2.4 70.5 L6.5 65.4 L9.1 59.4 L12.4 54.1 L14.7 51.6 L17.0 49.9 L19.0 48.9 L24.4 47.4
  L27.5 46.2 L32.7 42.9 L34.7 40.7 L35.6 38.2 L35.6 36.2 L34.4 31.7 L34.0 29.3 L34.0 27.0
  L34.5 24.0 L34.3 16.2 L35.2 12.6 L36.9 9.2 L39.6 6.0 L42.7 3.6 L47.4 1.2 L52.4 -0.1
  L55.0 -0.1 L58.1 0.4 L60.8 1.3 L62.9 2.3 L65.2 3.9 L70.0 8.7 L72.3 12.2 L73.3 15.6
  L73.3 19.3 L72.8 23.4 L73.0 28.7 L71.9 34.3 L70.2 39.1 L70.5 41.8 L71.7 44.0 L73.0 45.3
  L76.1 47.5 L78.2 48.5 L84.2 50.2 L86.0 51.3 L88.5 53.9 L90.8 58.0 L92.2 62.3 L92.5 68.0
  L92.9 69.9 L95.2 75.8 L98.0 82.4 L100.0 86.4 L101.5 90.3 L102.7 95.5 L103.5 102.9 L105.3 108.2
  L106.0 111.2 L107.6 115.6 L108.0 117.5 L107.8 120.7 L107.0 123.3 L105.9 125.3 L104.2 126.9 L102.5 127.7
  L100.2 128.2 L97.4 128.2 L94.0 127.8 L91.1 127.8 L90.0 128.0 L88.7 128.6 L87.2 129.9 L86.5 130.9
  L85.8 132.7 L85.6 135.6 L86.0 137.8 L86.0 140.4 L85.5 143.2 L83.8 149.2 L83.5 154.7 L80.4 163.6
  L79.9 165.9 L79.3 172.1 L78.6 176.4 L77.4 180.5 L75.1 186.1 L74.6 189.0 L74.7 195.8 L77.3 208.0
  L77.7 212.3 L77.7 216.0 L76.8 223.3 L74.2 235.1 L70.9 246.3 L67.4 259.9 L67.3 262.3 L67.7 268.3
  L68.8 274.4 L68.4 277.9 L68.4 281.8 L69.9 290.4 Z`;

const RUN_M_RUN_ART = {"src": "img/figures/run-m-run.8112431c.webp", "box": [-9.44, -1.35, 109.25, 301.04], "clear": true, "wear": "img/figures/run-m-run-wear.da057de0.png", "hi": "img/figures/run-m-run-hi.fd2a3f33.webp"};

const RUN_W_SPRINT_TRACE = `M75.5 299.9 L55.8 299.9 L54.6 296.7 L50.8 291.9 L49.4 289.3 L48.7 286.3 L48.0 275.9 L46.9 272.7
  L44.4 267.5 L43.9 265.3 L44.0 262.9 L45.0 260.5 L45.9 259.1 L49.5 255.7 L50.0 254.9 L50.6 253.6
  L51.0 251.4 L50.7 246.6 L48.3 230.3 L47.2 227.5 L45.9 225.9 L44.8 225.1 L43.2 224.5 L41.1 224.4
  L38.5 225.3 L36.5 227.1 L32.0 236.0 L31.5 237.9 L30.6 244.1 L29.1 249.1 L27.4 251.8 L25.3 253.7
  L24.1 254.3 L22.0 254.8 L20.5 254.8 L18.1 254.2 L16.2 253.1 L14.7 251.7 L12.9 249.2 L11.9 247.1
  L11.1 244.2 L11.0 241.1 L12.2 234.4 L12.2 232.2 L11.7 229.9 L10.2 225.8 L9.8 224.1 L9.7 221.3
  L10.1 219.4 L11.0 217.2 L12.7 215.2 L15.0 214.0 L17.9 213.2 L19.9 212.4 L21.7 210.9 L22.5 209.7
  L25.2 203.0 L26.2 197.5 L27.2 194.6 L28.5 192.0 L30.6 188.9 L31.7 186.9 L33.3 181.0 L33.7 177.5
  L33.3 175.3 L32.2 173.3 L23.3 164.2 L21.1 161.2 L19.0 157.2 L17.2 151.8 L16.2 147.0 L15.9 143.9
  L16.0 135.2 L15.6 133.1 L14.3 130.8 L9.9 127.3 L8.3 124.8 L7.7 122.8 L7.6 118.1 L7.2 116.2
  L4.4 108.4 L0.6 100.5 L-0.8 95.2 L-1.6 90.3 L-1.6 86.0 L-0.6 81.7 L2.3 76.3 L4.6 71.1
  L8.3 65.2 L10.8 59.7 L14.0 53.7 L14.5 52.3 L14.7 50.0 L13.9 47.2 L12.5 44.8 L9.8 41.8
  L9.1 39.9 L9.2 36.1 L10.1 33.2 L11.3 31.5 L13.1 29.8 L17.4 28.0 L21.4 25.7 L23.6 25.3
  L26.5 25.8 L28.5 25.8 L30.4 25.3 L32.1 24.1 L33.1 23.0 L33.9 21.5 L34.6 18.9 L35.7 12.6
  L37.0 9.3 L38.2 7.5 L41.0 4.7 L44.5 2.3 L48.2 0.6 L51.0 -0.1 L54.1 -0.1 L58.7 0.6
  L63.1 2.4 L65.3 4.0 L66.4 5.2 L70.2 10.5 L71.9 14.6 L72.2 17.1 L72.2 20.4 L72.1 24.9
  L71.6 28.7 L69.1 38.8 L69.1 40.6 L69.6 42.4 L71.3 44.8 L73.5 46.1 L80.3 47.9 L83.5 49.1
  L86.1 51.0 L88.0 53.4 L89.7 56.5 L92.5 63.7 L93.3 67.3 L93.8 71.8 L94.3 74.1 L96.7 79.9
  L99.2 88.2 L100.6 91.4 L101.3 93.7 L101.6 95.7 L101.6 101.3 L101.0 104.4 L100.1 106.1 L98.8 107.8
  L96.1 109.9 L93.5 110.8 L90.5 110.5 L88.0 109.4 L84.1 106.8 L81.4 105.9 L79.3 106.1 L77.5 106.8
  L76.3 107.7 L75.3 109.0 L74.7 110.3 L74.3 112.4 L74.4 119.3 L74.1 125.7 L74.1 131.3 L73.0 140.9
  L71.9 147.0 L70.6 151.8 L67.0 163.7 L67.0 166.0 L67.4 167.5 L71.1 173.5 L73.2 177.9 L74.7 182.9
  L75.2 186.1 L75.0 190.1 L73.0 204.7 L72.9 217.9 L69.7 237.9 L69.2 242.9 L69.2 248.3 L70.1 254.8
  L71.4 259.7 L72.3 261.6 L75.0 265.2 L75.9 267.0 L76.5 269.4 L75.6 277.6 L74.4 281.9 L74.6 284.2
  L75.9 288.0 L76.3 290.7 Z`;

const RUN_W_SPRINT_ART = {"src": "img/figures/run-w-sprint.e6f33a4d.webp", "box": [-2.88, -1.08, 102.85, 301.16], "clear": true, "wear": "img/figures/run-w-sprint-wear.9da8ba1b.png", "hi": "img/figures/run-w-sprint-hi.b59b40d7.webp"};

const BOX_M_VICTORY_TRACE = `M96.3 299.9 L73.4 299.9 L72.7 296.5 L71.5 293.1 L71.4 290.1 L71.8 287.5 L71.8 282.9 L73.3 273.7
  L73.5 267.9 L73.8 265.1 L73.8 262.4 L72.2 253.9 L72.2 251.0 L73.7 246.4 L73.8 243.6 L72.8 238.9
  L71.4 234.9 L70.7 231.6 L69.8 225.8 L69.3 219.2 L68.7 216.6 L66.9 213.3 L64.0 209.6 L61.8 207.6
  L59.3 206.8 L57.0 206.9 L55.2 207.6 L53.6 208.9 L52.5 210.8 L51.9 213.9 L51.9 220.7 L51.6 223.0
  L49.5 231.3 L49.5 235.9 L49.7 237.5 L50.2 239.0 L51.7 242.1 L52.1 244.4 L51.5 246.7 L49.7 249.9
  L49.2 252.1 L49.5 259.5 L50.5 266.5 L50.8 273.7 L50.5 278.2 L50.2 279.5 L49.4 280.9 L47.5 282.6
  L43.9 283.8 L40.2 284.4 L34.6 284.8 L32.4 285.2 L26.7 287.6 L23.2 288.5 L20.3 288.9 L16.1 288.9
  L10.8 288.0 L3.8 285.7 L2.0 284.8 L0.6 283.5 L-0.2 282.2 L-0.6 280.8 L-0.6 279.3 L-0.1 277.6
  L0.9 275.8 L2.6 273.9 L5.5 272.1 L12.2 270.1 L14.2 269.1 L19.2 265.2 L21.6 262.4 L22.5 260.2
  L22.8 258.5 L22.2 253.8 L22.4 251.2 L23.5 245.9 L25.2 241.7 L25.6 239.3 L25.5 230.1 L24.4 219.4
  L24.4 214.3 L25.1 204.7 L24.4 198.3 L24.2 193.5 L23.6 190.5 L22.2 186.8 L21.3 185.6 L18.2 182.8
  L16.9 181.2 L15.8 179.2 L15.4 177.5 L15.4 175.8 L16.2 170.3 L17.0 163.0 L17.3 153.6 L19.9 133.8
  L21.1 129.5 L24.3 122.9 L24.8 119.9 L25.0 115.4 L24.2 112.8 L22.7 110.8 L20.8 109.7 L16.3 108.3
  L13.5 106.8 L11.0 104.4 L9.4 101.3 L8.8 95.8 L7.9 90.4 L7.8 87.0 L8.0 84.6 L9.0 79.9
  L8.7 73.5 L9.3 66.1 L9.2 58.9 L9.5 56.6 L10.2 53.7 L11.5 50.9 L13.2 48.7 L16.4 45.8
  L20.9 42.8 L23.7 41.3 L26.5 40.3 L30.4 39.8 L32.3 39.3 L34.2 38.2 L35.2 37.0 L36.1 35.3
  L36.5 32.1 L35.9 26.8 L34.3 21.1 L33.9 18.4 L34.2 14.4 L34.8 11.9 L37.6 6.9 L39.9 4.5
  L41.6 3.2 L44.8 1.5 L47.1 0.7 L49.9 0.1 L54.1 -0.1 L58.1 0.8 L65.6 4.6 L67.3 5.8
  L69.1 7.6 L70.3 9.8 L71.1 12.7 L71.4 14.5 L71.4 20.5 L72.1 24.4 L72.0 28.1 L69.6 34.9
  L69.6 36.7 L70.1 38.5 L71.1 40.2 L72.5 41.5 L81.5 46.6 L90.8 54.3 L92.9 57.2 L94.5 60.1
  L96.0 64.0 L97.0 68.5 L97.3 75.8 L99.4 85.6 L100.5 96.4 L100.5 102.2 L99.1 110.5 L97.6 113.8
  L95.0 116.5 L93.2 117.9 L91.5 118.7 L89.6 119.2 L86.2 119.6 L84.1 120.4 L82.8 121.4 L81.8 122.7
  L81.2 124.0 L81.0 125.3 L81.1 127.5 L82.6 132.6 L84.2 141.0 L85.0 146.5 L84.7 155.4 L85.2 164.0
  L86.4 172.5 L87.8 178.5 L87.8 181.0 L86.4 186.5 L86.5 188.8 L88.6 196.7 L90.0 203.3 L94.0 214.5
  L95.0 219.3 L95.5 223.6 L95.8 232.4 L96.4 238.3 L96.0 243.0 L96.0 256.7 L96.2 263.0 L97.2 267.8
  L97.2 273.1 L98.9 281.2 L99.8 288.2 L99.8 290.8 L99.4 292.7 L97.1 297.2 Z`;

const BOX_M_VICTORY_ART = {"src": "img/figures/box-m-victory.9a27a7c2.webp", "box": [-1.75, -1.21, 101.58, 298.87], "clear": true, "wear": "img/figures/box-m-victory-wear.dbf71e91.png", "hi": "img/figures/box-m-victory-hi.e4bcc66b.webp"};

const BOX_M_CHAMPION_TRACE = `M25.6 299.9 L5.7 299.9 L5.2 295.9 L4.0 291.4 L4.1 288.8 L5.2 284.6 L6.2 282.5 L9.4 277.4
  L11.1 274.2 L12.1 271.6 L13.1 267.7 L13.9 262.5 L13.9 258.5 L13.6 254.0 L13.7 250.5 L14.2 248.7
  L16.2 244.9 L16.7 242.8 L16.7 237.3 L16.1 228.9 L16.2 224.2 L17.1 220.0 L18.2 216.6 L22.3 206.3
  L24.0 197.4 L24.0 195.1 L23.7 193.9 L21.5 189.4 L20.8 187.0 L20.8 176.4 L20.5 173.2 L20.6 164.3
  L19.6 158.6 L19.3 153.9 L19.3 144.7 L19.6 138.1 L20.7 131.1 L22.2 126.1 L22.3 123.4 L21.9 121.9
  L21.3 120.7 L20.3 119.4 L19.1 118.4 L16.5 117.6 L14.5 117.6 L11.3 118.2 L9.0 118.2 L7.6 117.8
  L5.1 116.4 L1.9 113.6 L-1.5 111.3 L-2.9 110.0 L-5.1 107.0 L-6.9 102.2 L-7.8 97.6 L-7.9 92.2
  L-6.8 88.3 L-1.4 75.7 L2.1 67.9 L4.2 60.1 L6.1 56.7 L8.9 53.7 L12.7 50.4 L18.2 47.1
  L21.7 44.1 L29.1 40.7 L31.0 39.0 L32.1 37.5 L32.8 35.2 L32.8 33.3 L31.4 27.5 L31.3 24.3
  L31.9 20.0 L31.9 15.6 L32.1 13.6 L32.9 10.8 L34.0 8.6 L37.1 4.6 L40.2 2.1 L42.1 1.2
  L44.8 0.3 L47.1 -0.1 L50.4 -0.1 L56.1 1.2 L59.3 2.8 L65.6 8.6 L67.3 11.4 L68.1 13.9
  L68.5 17.0 L68.2 20.3 L68.4 26.3 L67.9 29.5 L65.8 36.5 L65.8 38.1 L66.3 39.9 L67.4 41.6
  L69.0 43.0 L73.6 44.7 L76.1 46.1 L78.9 49.8 L83.6 54.3 L87.7 59.1 L88.8 61.6 L89.8 65.4
  L90.3 68.9 L90.4 73.0 L91.8 79.3 L92.8 81.7 L96.6 88.0 L98.1 91.1 L99.1 94.7 L100.4 100.4
  L100.6 102.0 L100.4 107.1 L100.5 109.5 L101.1 111.7 L102.8 115.0 L103.6 117.3 L104.1 120.0 L104.1 122.7
  L103.6 125.3 L102.7 128.2 L100.0 133.4 L98.1 135.9 L96.9 137.1 L93.0 139.4 L91.2 140.9 L90.1 142.6
  L89.5 144.9 L89.5 147.8 L90.0 150.7 L95.2 166.5 L95.8 172.7 L95.8 179.5 L94.9 187.3 L94.3 188.9
  L91.7 192.4 L90.8 195.0 L90.8 196.8 L91.8 201.8 L91.7 204.2 L90.8 208.3 L89.4 212.9 L89.3 220.8
  L88.9 225.8 L88.0 230.5 L84.8 244.0 L84.5 247.4 L86.0 252.2 L86.7 256.5 L89.1 261.3 L89.1 267.0
  L90.0 269.6 L92.0 271.8 L93.2 272.6 L98.0 275.2 L103.0 277.4 L104.2 278.2 L105.7 279.7 L106.8 281.4
  L107.5 283.4 L107.8 285.3 L107.1 288.2 L106.4 289.7 L105.2 291.1 L104.0 292.0 L102.0 292.8 L97.9 293.1
  L90.1 292.5 L83.1 291.3 L75.1 288.2 L69.8 287.3 L64.7 286.0 L62.1 284.5 L60.8 282.9 L60.0 281.1
  L59.6 278.7 L59.5 272.8 L59.9 269.6 L61.2 263.7 L61.5 260.7 L60.9 250.6 L62.4 245.3 L62.8 242.0
  L62.7 238.2 L61.6 231.4 L61.6 227.0 L62.6 219.7 L64.7 210.8 L64.7 208.7 L63.1 201.8 L62.6 200.3
  L61.4 198.2 L59.1 196.5 L57.2 196.0 L55.2 196.1 L52.9 197.1 L50.9 199.2 L50.1 201.1 L47.7 208.0
  L43.9 216.3 L43.5 218.8 L43.4 226.4 L42.8 230.8 L41.7 234.4 L38.1 243.1 L37.2 246.5 L37.2 248.7
  L37.8 252.5 L37.5 254.5 L36.3 259.1 L35.3 264.2 L35.1 277.9 L34.0 284.5 L33.5 286.1 L31.5 289.6
  L29.5 293.8 L26.8 297.5 Z`;

const BOX_M_CHAMPION_ART = {"src": "img/figures/box-m-champion.a3c01735.webp", "box": [-8.99, -1.15, 108.95, 298.29], "clear": true, "wear": "img/figures/box-m-champion-wear.088a9dbe.png", "hi": "img/figures/box-m-champion-hi.c50104e0.webp"};

const BOX_W_GUARD_TRACE = `M-3.1 299.9 L-25.5 299.9 L-26.2 297.8 L-28.1 293.8 L-28.3 291.4 L-27.8 289.2 L-26.8 287.2 L-24.3 284.1
  L-21.4 282.0 L-16.0 279.4 L-13.7 278.1 L-9.6 274.3 L-8.2 272.0 L-6.9 267.2 L-5.5 260.6 L-5.1 256.1
  L-1.6 249.5 L-0.9 247.3 L-0.3 240.6 L0.3 229.0 L1.3 221.6 L3.3 211.6 L5.0 205.6 L6.3 197.9
  L9.5 188.0 L11.0 177.0 L14.2 165.0 L16.9 156.1 L18.3 149.4 L19.2 147.2 L21.5 143.5 L22.9 137.6
  L26.1 131.1 L27.2 127.3 L27.6 121.6 L26.7 119.1 L25.5 117.6 L23.8 116.5 L22.2 116.0 L18.2 115.9
  L15.0 115.1 L12.2 113.4 L9.0 110.0 L7.5 107.1 L6.7 104.2 L6.6 100.7 L6.9 99.2 L10.2 89.9
  L13.2 83.0 L17.4 74.4 L19.9 65.7 L22.6 59.7 L25.2 55.9 L26.9 54.1 L29.3 52.4 L33.2 50.8
  L34.8 49.8 L36.2 48.3 L37.0 46.8 L38.1 42.4 L38.4 37.7 L39.0 33.4 L38.9 30.4 L38.0 26.3
  L38.0 19.0 L38.9 14.9 L40.0 12.5 L43.5 7.6 L47.5 3.8 L49.9 1.9 L52.1 0.8 L54.3 0.2
  L56.0 -0.1 L58.9 0.1 L61.0 0.7 L62.4 1.4 L69.6 6.5 L72.0 9.1 L73.1 10.9 L73.7 12.5
  L75.1 18.3 L75.2 20.5 L74.1 29.9 L71.3 37.6 L71.4 39.5 L72.2 41.9 L74.1 44.0 L76.8 45.4
  L78.7 45.9 L84.2 46.6 L88.1 48.2 L91.7 50.6 L95.2 54.0 L98.1 57.7 L102.4 65.2 L108.0 71.8
  L111.5 76.9 L115.6 84.3 L117.3 89.1 L117.6 92.2 L117.0 95.8 L115.5 98.6 L114.0 100.2 L111.9 101.4
  L98.8 107.0 L95.5 107.9 L91.0 108.4 L88.8 109.3 L87.3 110.5 L86.3 112.2 L85.7 114.0 L85.7 115.6
  L86.1 117.2 L89.8 124.1 L91.0 128.3 L91.7 132.1 L91.8 140.5 L92.5 148.8 L93.3 154.4 L93.7 160.9
  L95.2 167.7 L95.0 169.4 L93.0 178.8 L93.1 185.5 L93.8 190.5 L96.3 200.9 L97.2 203.3 L101.0 211.1
  L102.7 216.2 L103.9 221.4 L105.7 233.4 L106.4 235.7 L107.5 237.6 L110.3 241.1 L111.3 243.5 L112.9 249.2
  L113.0 254.1 L114.8 263.2 L115.8 264.9 L117.2 266.4 L123.9 271.4 L126.1 273.6 L127.3 275.8 L128.0 278.1
  L128.0 281.9 L126.8 284.5 L124.3 286.6 L120.1 288.3 L118.6 288.5 L115.7 288.5 L111.1 287.8 L107.0 286.6
  L101.1 283.9 L97.7 282.6 L96.2 281.7 L94.9 280.5 L93.3 277.7 L92.3 274.3 L91.3 265.2 L89.5 259.7
  L88.0 253.0 L86.6 248.5 L85.5 242.6 L82.8 236.3 L79.1 228.9 L77.9 224.9 L76.8 217.9 L75.8 213.7
  L75.1 212.2 L72.2 208.0 L70.5 204.9 L65.2 189.5 L63.6 187.1 L61.4 185.7 L53.7 183.5 L50.9 183.4
  L46.3 185.1 L42.5 186.1 L40.8 187.1 L39.6 188.2 L38.3 190.3 L37.3 192.4 L33.4 202.6 L29.7 210.8
  L29.3 213.2 L29.3 217.6 L28.9 221.6 L27.7 230.2 L26.7 234.2 L23.4 243.4 L21.4 251.1 L20.9 257.8
  L20.0 263.0 L19.2 269.0 L18.4 272.9 L18.3 274.6 L19.0 281.5 L18.5 285.8 L17.9 288.5 L17.1 289.8
  L16.1 291.0 L13.5 292.5 L7.2 294.1 L2.3 294.6 L0.0 295.5 L-2.0 297.3 Z`;

const BOX_W_GUARD_ART = {"src": "img/figures/box-w-guard.f8452fd1.webp", "box": [-29.39, -1.2, 129.46, 301.2], "clear": true, "wear": "img/figures/box-w-guard-wear.631699a9.png", "hi": "img/figures/box-w-guard-hi.4f6709ee.webp"};

const BOX_W_READY_TRACE = `M111.0 299.9 L-10.5 299.9 L-10.8 299.8 L-11.0 295.6 L-11.8 291.2 L-11.6 289.5 L-11.1 287.5 L-10.0 285.2
  L-8.9 283.6 L-2.4 277.6 L-1.1 275.5 L-0.6 273.7 L-0.6 272.0 L-1.1 269.5 L-0.8 266.8 L0.4 264.4
  L2.5 261.6 L3.7 259.4 L4.8 255.5 L7.1 248.5 L7.6 244.6 L7.6 239.0 L8.6 222.5 L9.8 214.8
  L12.6 205.2 L13.7 195.9 L13.7 192.7 L12.6 182.2 L11.9 178.3 L11.1 177.0 L10.0 175.8 L3.9 172.3
  L1.2 169.5 L-0.2 167.4 L-1.7 164.2 L-2.8 161.0 L-3.4 157.8 L-3.6 151.3 L-2.4 144.2 L-2.8 137.1
  L-0.9 127.4 L-1.6 120.2 L-1.6 112.8 L-1.2 109.3 L0.4 99.9 L3.7 84.1 L6.2 75.3 L7.8 67.5
  L10.7 60.1 L13.0 56.0 L15.0 53.8 L17.3 52.1 L22.4 50.0 L24.2 48.9 L25.5 47.4 L26.3 46.1
  L26.9 43.9 L27.4 40.1 L27.5 32.0 L29.1 26.1 L28.6 18.9 L28.7 16.5 L31.1 8.2 L32.3 6.4
  L33.6 5.0 L36.4 3.0 L39.7 1.3 L43.6 0.1 L47.6 -0.1 L53.5 0.9 L55.8 1.5 L60.4 4.1
  L62.2 5.8 L63.1 6.9 L65.3 12.1 L66.1 14.5 L66.3 16.7 L66.2 19.8 L66.8 23.6 L66.8 26.2
  L65.4 32.2 L63.3 36.5 L62.7 38.3 L62.5 40.8 L63.1 42.7 L64.1 44.4 L66.1 46.0 L69.9 47.7
  L77.3 49.9 L80.1 51.4 L82.2 52.9 L84.2 54.9 L85.9 57.6 L88.9 64.5 L90.0 68.1 L91.2 74.9
  L93.7 86.4 L94.8 95.5 L97.0 107.6 L97.1 125.3 L96.9 128.2 L97.1 130.3 L98.4 135.2 L99.0 140.1
  L99.2 145.7 L100.5 151.6 L101.0 155.0 L101.2 158.4 L101.2 167.3 L101.0 169.5 L100.3 171.8 L99.3 173.6
  L97.4 175.7 L93.9 177.9 L87.3 180.1 L85.8 181.2 L84.5 182.7 L83.5 185.3 L83.2 188.6 L83.2 197.8
  L84.0 203.2 L87.1 213.6 L88.4 219.4 L89.0 234.4 L89.7 246.1 L90.1 248.5 L93.2 256.2 L94.7 258.4
  L96.9 260.8 L98.0 263.0 L98.2 265.5 L96.6 270.3 L96.6 272.2 L97.5 274.7 L98.5 276.1 L101.2 278.6
  L105.4 281.9 L107.5 283.9 L108.8 285.5 L110.3 288.0 L111.6 292.5 L111.6 294.8 Z
  M64.4 290.8 L67.3 290.2 L69.3 289.0 L70.9 286.8 L71.5 284.2 L71.2 279.8 L71.3 270.5 L69.6 264.7
  L68.5 259.3 L68.5 252.5 L68.1 248.6 L65.4 237.0 L62.8 230.4 L62.1 227.9 L61.3 223.2 L61.0 215.5
  L60.6 213.0 L57.7 206.7 L56.6 203.5 L55.8 199.8 L54.9 193.5 L54.4 191.6 L53.2 189.5 L51.6 188.2
  L49.8 187.5 L47.6 187.3 L45.8 187.8 L44.1 188.8 L43.1 190.1 L42.3 191.4 L41.7 193.7 L41.0 199.9
  L40.3 203.0 L36.5 213.8 L35.2 225.2 L34.4 228.6 L31.2 237.7 L28.5 249.9 L28.0 255.0 L27.9 260.5
  L26.6 268.0 L25.1 273.5 L25.3 279.3 L25.1 285.0 L26.0 287.5 L27.2 289.0 L29.2 290.2 L31.2 290.7 Z`;

const BOX_W_READY_ART = {"src": "img/figures/box-w-ready.da5dd02a.webp", "box": [-12.77, -1.08, 112.96, 301.1], "clear": true, "wear": "img/figures/box-w-ready-wear.71e3f136.png", "hi": "img/figures/box-w-ready-hi.95d57159.webp"};

const RUN_W_READY_TRACE = `M13.8 299.9 L-9.6 299.9 L-9.9 298.8 L-10.1 290.7 L-9.2 287.3 L-8.1 285.3 L-4.0 280.4 L-3.2 278.4
  L-2.4 274.2 L-1.8 272.4 L-0.8 270.7 L2.9 266.7 L4.0 264.8 L4.6 263.2 L5.0 260.4 L5.0 251.3
  L4.6 247.5 L4.6 241.6 L5.8 226.7 L6.7 221.9 L8.6 215.3 L9.5 210.4 L10.3 203.3 L11.1 198.7
  L11.0 192.0 L11.4 187.9 L13.2 176.1 L15.8 164.4 L19.5 153.5 L21.1 147.4 L21.5 144.8 L20.8 135.8
  L20.6 134.4 L19.9 132.7 L18.5 131.1 L14.6 128.4 L11.8 125.6 L2.8 112.6 L-1.3 105.3 L-5.9 96.1
  L-6.9 93.3 L-7.0 90.5 L-6.6 88.6 L-5.8 86.3 L-2.0 79.4 L2.5 72.9 L8.3 66.4 L10.8 62.1
  L13.7 58.2 L17.2 54.9 L21.2 52.3 L24.3 50.9 L33.2 47.8 L36.4 46.1 L38.3 44.2 L39.2 42.1
  L39.4 39.8 L38.8 37.6 L36.6 33.1 L35.9 30.8 L35.5 28.4 L36.7 18.2 L38.1 13.8 L39.7 10.7
  L41.5 8.2 L47.6 2.9 L50.4 1.3 L52.3 0.6 L55.5 -0.1 L57.6 0.1 L59.2 0.4 L61.0 1.3
  L63.3 3.0 L65.6 5.2 L68.8 9.0 L70.0 10.9 L71.5 13.7 L72.7 16.8 L73.3 19.8 L73.6 23.3
  L74.3 27.4 L74.0 29.9 L72.2 37.0 L72.2 44.6 L72.6 46.8 L73.2 48.1 L74.6 49.8 L75.9 50.7
  L83.7 54.5 L86.3 56.1 L89.8 59.4 L93.7 64.1 L96.1 68.5 L99.1 76.0 L103.4 82.9 L106.5 89.5
  L109.4 97.1 L109.9 99.6 L109.9 101.7 L109.3 104.4 L108.2 106.7 L104.9 111.6 L101.9 116.7 L99.1 120.7
  L93.5 127.5 L88.3 132.7 L83.2 136.6 L82.1 138.3 L81.6 139.9 L81.6 142.9 L82.4 148.7 L82.2 156.2
  L81.6 160.4 L79.8 168.6 L76.2 187.9 L75.8 191.6 L75.8 197.1 L75.3 205.5 L76.2 217.9 L76.1 226.5
  L75.1 233.9 L73.3 244.0 L71.7 250.4 L68.6 260.7 L68.6 262.7 L69.2 266.3 L69.0 269.3 L69.1 276.5
  L69.4 278.3 L71.1 285.1 L71.3 286.8 L70.9 288.7 L69.8 290.5 L67.3 292.5 L63.7 294.0 L60.2 294.5
  L52.5 294.7 L50.5 294.5 L48.4 293.6 L47.5 292.9 L46.6 291.9 L45.8 290.4 L45.3 288.0 L45.1 284.4
  L45.5 281.5 L46.8 276.4 L47.2 269.8 L48.9 263.9 L50.9 259.3 L51.6 254.9 L51.8 248.5 L51.2 231.2
  L52.4 215.6 L51.5 209.3 L50.6 205.8 L49.8 203.9 L48.5 202.4 L46.8 201.3 L45.0 200.8 L43.5 200.8
  L41.0 201.7 L39.8 202.6 L38.8 203.9 L33.8 215.4 L33.2 217.5 L32.4 228.6 L30.9 238.1 L29.3 243.9
  L25.6 255.5 L23.4 265.7 L23.3 268.5 L23.9 272.7 L24.0 277.6 L25.3 283.8 L24.9 286.8 L24.1 288.7
  L22.3 290.8 L20.9 291.7 L17.3 293.3 L15.7 294.6 L14.6 296.5 Z`;

const RUN_W_READY_ART = {"src": "img/figures/run-w-ready.ee09680b.webp", "box": [-11.08, -1.08, 111.11, 301.07], "clear": true, "wear": "img/figures/run-w-ready-wear.5a804f2b.png", "hi": "img/figures/run-w-ready-hi.64bf7427.webp"};

const GENT_ART = {"src": "img/figures/gent.418f1c14.webp", "box": [-3.7, -1.11, 103.85, 300.96], "clear": true, "wear": "img/figures/gent-wear.64c5a09d.png", "hi": "img/figures/gent-hi.85ed147f.webp"};

const LADY_ART = {"src": "img/figures/lady.f12df48f.webp", "box": [-4.85, -1.21, 104.95, 301.24], "clear": true, "wear": "img/figures/lady-wear.11b1aab9.png", "hi": "img/figures/lady-hi.fd52e3ad.webp"};

const SUIT_ART = {"src": "img/figures/suit.6453ec54.webp", "box": [2.11, -1.15, 98.0, 301.16], "clear": true, "wear": "img/figures/suit-wear.bc8d0319.png", "hi": "img/figures/suit-hi.aebaa446.webp"};

const GOWN_BALL_ART = {"src": "img/figures/gown-ball.ab8aab7d.webp", "box": [-50.09, -1.3, 149.87, 301.24], "clear": true, "wear": "img/figures/gown-ball-wear.936bb776.png", "hi": "img/figures/gown-ball-hi.3996381b.webp"};

const GOWN_TRAIN_ART = {"src": "img/figures/gown-train.a29becbc.webp", "box": [-30.57, -1.33, 130.67, 296.62], "clear": true, "wear": "img/figures/gown-train-wear.42f205cc.png", "hi": "img/figures/gown-train-hi.a49b7aea.webp"};

const GOWN_EVENING_ART = {"src": "img/figures/gown-evening.bcb7da27.webp", "box": [-10.16, -1.28, 110.22, 301.16], "clear": true, "wear": "img/figures/gown-evening-wear.acb49bea.png", "hi": "img/figures/gown-evening-hi.83d6c589.webp"};

const GOWN_SWEEP_ART = {"src": "img/figures/gown-sweep.e605fd16.webp", "box": [-26.26, -1.09, 126.37, 298.32], "clear": true, "wear": "img/figures/gown-sweep-wear.3e44d901.png", "hi": "img/figures/gown-sweep-hi.69596040.webp"};

const GRAD_ART = {"src": "img/figures/grad.3dc22f54.webp", "box": [-6.45, -1.1, 106.58, 301.21], "clear": true, "wear": "img/figures/grad-wear.e93759e0.png", "hi": "img/figures/grad-hi.c487bfd6.webp"};

const GRAD_W_TRACE = `M65.6 299.9 L41.2 299.9 L40.3 297.3 L38.0 293.1 L37.4 289.9 L37.1 273.3 L36.4 269.5 L36.3 263.2
  L29.2 234.4 L27.9 225.6 L27.9 217.1 L27.7 215.8 L26.3 213.2 L24.7 211.8 L22.5 211.0 L17.1 210.2
  L15.3 209.4 L13.7 207.6 L12.8 205.3 L12.5 202.1 L12.5 196.8 L12.9 189.6 L12.9 183.5 L13.3 179.9
  L13.5 164.2 L14.0 155.9 L13.9 152.5 L13.6 151.2 L12.9 149.5 L9.4 145.0 L8.1 141.9 L4.3 129.5
  L3.2 124.4 L2.1 121.0 L1.9 119.0 L1.9 115.4 L2.2 111.5 L3.8 102.3 L7.4 85.8 L8.7 78.7
  L10.1 73.8 L11.6 70.4 L15.1 64.4 L17.8 61.3 L19.6 60.2 L21.6 59.6 L25.8 58.8 L29.7 57.0
  L31.0 56.1 L32.2 54.8 L33.2 52.1 L33.4 49.6 L33.2 47.2 L33.2 38.5 L33.8 32.7 L33.4 30.3
  L32.3 28.2 L30.9 26.8 L24.9 22.7 L22.8 20.8 L22.0 19.4 L21.8 18.3 L22.0 15.9 L23.4 13.8
  L24.6 12.8 L27.2 11.5 L47.4 2.5 L52.6 0.4 L54.7 -0.1 L56.7 -0.1 L57.8 0.2 L60.6 1.8
  L81.0 17.5 L83.1 19.9 L83.6 21.5 L83.6 23.0 L82.9 24.8 L82.0 26.1 L78.5 28.3 L77.3 29.5
  L76.2 31.2 L75.7 32.6 L75.3 36.2 L75.5 42.9 L75.2 45.6 L75.2 51.0 L75.5 53.0 L76.4 55.6
  L78.4 57.9 L80.4 59.1 L84.8 60.7 L86.4 61.7 L88.2 63.6 L90.5 66.7 L92.3 69.9 L93.7 73.5
  L94.9 77.5 L96.9 86.3 L97.6 91.6 L98.0 99.0 L97.8 113.8 L97.1 118.3 L91.7 134.9 L90.3 138.3
  L87.7 143.2 L87.1 145.6 L87.5 158.5 L89.9 199.4 L89.8 203.3 L88.9 205.8 L87.0 207.7 L84.7 208.6
  L79.5 209.3 L77.6 209.8 L76.0 210.6 L74.8 211.6 L74.1 212.6 L73.4 214.3 L73.2 215.8 L73.4 225.2
  L73.0 231.2 L71.7 241.0 L69.0 256.0 L67.9 263.6 L67.7 273.3 L68.1 276.8 L67.9 285.1 L68.2 290.4
  L67.8 292.6 L66.1 297.1 Z`;

const GRAD_W_ART = {"src": "img/figures/grad-w.0f441384.webp", "box": [0.72, -1.08, 99.28, 300.96], "clear": true, "wear": "img/figures/grad-w-wear.9101e3ca.png", "hi": "img/figures/grad-w-hi.a97b0773.webp"};

const BALL_W_READY_TRACE = `M109.9 299.9 L89.1 299.9 L88.0 297.3 L84.6 293.2 L81.1 287.1 L79.6 285.8 L76.0 283.6 L73.8 281.9
  L72.1 280.2 L70.8 278.1 L70.1 276.0 L70.2 273.1 L74.3 261.9 L75.6 255.9 L75.8 251.6 L73.5 236.6
  L71.1 228.1 L70.5 224.2 L70.1 218.9 L70.1 211.9 L70.5 207.4 L70.5 203.8 L69.6 200.8 L67.4 196.8
  L64.9 191.6 L62.2 187.2 L60.2 185.0 L59.4 184.4 L56.8 183.6 L54.4 183.7 L52.6 184.4 L51.0 185.8
  L49.8 188.0 L49.4 189.8 L49.4 200.8 L47.9 211.0 L48.1 216.7 L49.5 230.3 L49.8 245.5 L50.2 254.4
  L50.9 257.7 L54.5 267.8 L55.1 270.4 L55.3 275.2 L56.9 285.0 L56.9 286.9 L56.5 289.3 L55.9 290.9
  L54.8 292.4 L53.7 293.2 L52.4 293.9 L51.2 294.1 L45.0 294.0 L38.2 294.2 L35.0 293.7 L32.4 292.5
  L30.3 290.3 L29.3 287.9 L29.2 286.7 L29.4 284.7 L32.8 273.5 L32.8 263.9 L32.2 260.4 L28.9 251.4
  L26.1 242.5 L23.7 231.2 L23.0 223.5 L23.0 216.0 L23.5 209.1 L23.3 206.2 L22.1 197.9 L20.9 191.9
  L19.6 186.3 L18.3 183.7 L16.4 181.9 L11.7 179.6 L10.6 178.4 L10.1 177.5 L9.9 176.4 L9.9 173.1
  L10.4 168.1 L10.4 164.8 L9.9 162.1 L6.9 155.5 L5.9 153.9 L3.2 151.1 L2.0 149.0 L1.8 147.5
  L2.0 142.1 L4.8 131.6 L4.8 129.9 L4.4 128.4 L3.2 126.1 L-1.0 121.3 L-9.0 110.2 L-10.2 107.6
  L-10.9 105.1 L-11.2 100.2 L-10.7 96.8 L-9.7 93.1 L-6.1 81.8 L-2.9 74.1 L-0.9 66.2 L0.8 61.9
  L3.6 56.6 L6.0 53.2 L8.9 50.4 L10.8 49.2 L17.6 46.0 L21.5 43.8 L23.5 42.1 L24.8 39.9
  L25.0 38.4 L24.8 35.9 L21.5 30.1 L20.8 27.9 L20.3 25.2 L20.3 22.8 L20.6 21.3 L22.3 14.8
  L23.5 11.4 L25.5 7.6 L27.0 5.8 L28.7 4.2 L33.0 1.5 L37.1 0.1 L41.0 0.1 L47.9 2.1
  L51.4 4.0 L53.9 6.5 L55.7 9.6 L56.5 12.0 L57.6 18.2 L57.8 26.5 L55.8 33.5 L55.8 35.6
  L56.7 38.1 L57.9 39.6 L59.8 40.8 L61.9 41.6 L69.5 43.7 L72.0 44.9 L74.3 46.6 L78.4 50.4
  L82.9 55.8 L87.3 62.6 L95.8 71.7 L102.1 80.1 L104.9 84.4 L106.1 86.9 L106.9 89.6 L107.2 92.5
  L106.8 94.5 L106.2 96.1 L103.9 100.4 L98.7 109.1 L94.3 115.8 L87.5 124.1 L84.2 128.9 L80.1 133.5
  L79.1 134.8 L78.4 136.6 L78.2 138.9 L79.3 142.9 L80.1 147.6 L82.8 154.9 L84.4 160.5 L86.2 165.1
  L87.8 170.9 L91.4 180.1 L94.0 186.2 L94.7 188.8 L95.1 192.1 L95.5 201.0 L96.8 209.8 L97.4 219.8
  L97.1 235.6 L96.4 245.3 L96.4 253.5 L96.8 258.5 L97.5 261.3 L100.6 266.9 L102.9 274.2 L103.8 276.5
  L105.3 279.3 L109.2 284.7 L110.6 287.9 L111.1 290.5 L111.1 292.0 L110.4 295.6 Z`;

const BALL_W_READY_ART = {"src": "img/figures/ball-w-ready.0cddb985.webp", "box": [-12.31, -1.03, 112.4, 301.08], "clear": true, "wear": "img/figures/ball-w-ready-wear.ea54f718.png", "hi": "img/figures/ball-w-ready-hi.fc46f504.webp"};

const VOLLEY_W_READY_TRACE = `M97.5 299.9 L1.4 299.9 L-3.9 296.9 L-5.5 295.0 L-6.5 292.4 L-6.6 288.4 L-6.2 284.6 L-4.3 278.6
  L-2.4 274.0 L-0.8 265.4 L-0.7 257.1 L0.2 250.2 L0.4 242.2 L1.1 233.4 L2.0 227.2 L3.0 223.0
  L4.6 218.0 L5.3 215.0 L7.9 202.9 L8.5 198.6 L9.9 195.4 L10.6 192.9 L10.5 178.6 L10.7 176.0
  L10.7 164.4 L10.9 160.0 L11.3 157.1 L12.7 151.3 L14.7 145.7 L14.8 142.8 L13.9 140.4 L12.6 138.8
  L10.3 137.4 L7.0 136.5 L4.2 135.4 L1.9 133.9 L-0.2 131.5 L-7.3 117.1 L-8.9 113.4 L-10.8 107.8
  L-12.9 102.5 L-13.4 99.8 L-13.3 97.0 L-12.8 94.8 L-11.4 91.1 L-8.3 84.8 L-4.3 78.5 L0.7 71.8
  L4.1 65.6 L6.4 62.2 L10.2 57.7 L13.3 55.0 L15.6 53.4 L21.4 50.8 L22.6 49.8 L23.6 48.6
  L24.4 46.9 L24.7 44.7 L25.4 32.8 L26.0 27.6 L26.6 25.1 L28.5 20.0 L29.3 13.9 L30.5 9.9
  L32.2 7.1 L35.3 4.1 L38.1 2.3 L40.3 1.2 L43.5 0.3 L48.3 -0.1 L51.1 0.3 L54.0 1.2
  L57.0 2.7 L60.0 4.7 L61.2 5.8 L62.8 7.8 L64.0 9.9 L64.8 12.4 L65.9 17.3 L66.9 24.0
  L66.7 27.4 L65.8 30.5 L65.1 32.2 L63.3 35.1 L62.4 37.2 L62.3 39.4 L63.2 41.9 L64.5 43.5
  L66.5 44.7 L74.8 47.7 L82.1 50.8 L84.8 52.8 L90.5 58.0 L93.2 61.3 L98.0 69.3 L106.1 81.0
  L111.1 90.4 L112.4 93.6 L113.2 96.5 L113.3 99.2 L112.4 102.7 L111.1 105.4 L104.2 116.9 L101.1 121.4
  L94.3 130.3 L89.8 134.7 L85.9 137.7 L84.8 138.9 L83.6 141.0 L83.2 142.8 L83.5 147.8 L84.7 154.3
  L85.3 159.9 L85.3 172.0 L84.8 183.9 L82.6 195.8 L83.2 203.6 L84.0 208.3 L84.0 212.2 L83.4 219.8
  L84.2 227.3 L84.2 238.2 L83.1 259.1 L83.8 262.3 L86.5 267.2 L87.5 270.3 L89.6 275.2 L90.9 277.0
  L98.0 284.0 L100.1 287.0 L100.7 289.6 L100.5 292.4 L100.1 293.9 L98.3 297.3 Z
  M52.7 290.8 L55.0 290.5 L56.7 289.7 L58.2 288.4 L59.4 286.6 L62.8 269.7 L63.0 267.2 L62.9 265.1
  L62.0 258.1 L58.3 238.5 L58.1 235.2 L57.9 223.1 L57.5 221.5 L55.8 217.0 L54.1 210.3 L53.2 205.4
  L52.3 198.0 L51.4 195.4 L50.0 193.8 L47.8 192.5 L45.2 192.3 L43.3 192.8 L41.7 193.8 L39.9 196.2
  L38.8 199.6 L37.7 204.2 L36.8 209.5 L35.9 212.7 L33.7 217.2 L30.6 222.6 L29.5 225.2 L28.6 232.1
  L27.4 238.0 L23.2 249.6 L20.8 258.6 L19.8 263.3 L19.5 267.3 L20.0 270.1 L20.0 272.7 L19.5 277.6
  L18.3 282.3 L18.3 285.1 L19.2 287.5 L20.4 289.0 L22.4 290.2 L24.4 290.7 Z`;

const VOLLEY_W_READY_ART = {"src": "img/figures/volley-w-ready.8070c3ed.webp", "box": [-14.5, -1.35, 114.5, 301.23], "clear": true, "wear": "img/figures/volley-w-ready-wear.dff7db49.png", "hi": "img/figures/volley-w-ready-hi.89def79a.webp"};

const VOLLEY_M_READY_TRACE = `M15.6 299.9 L-7.9 299.9 L-8.2 299.8 L-8.8 292.1 L-8.7 289.5 L-8.3 287.6 L-6.8 284.4 L-1.8 278.7
  L-1.1 277.2 L0.0 273.2 L1.9 269.6 L2.4 267.6 L2.9 262.7 L4.1 257.0 L4.4 250.8 L5.2 244.5
  L5.2 238.5 L5.8 233.1 L7.2 226.2 L10.3 217.5 L11.5 212.0 L12.2 204.4 L12.1 197.0 L12.9 188.7
  L14.7 173.2 L16.4 164.0 L16.5 157.2 L17.0 154.4 L17.0 152.6 L16.1 150.1 L14.8 148.5 L13.5 147.6
  L9.5 145.9 L5.4 143.7 L0.7 140.4 L-1.2 138.7 L-8.2 130.6 L-9.7 128.5 L-10.3 127.2 L-10.7 125.5
  L-10.8 118.4 L-13.0 105.7 L-13.1 99.3 L-12.7 95.6 L-11.6 91.9 L-6.6 82.1 L-0.5 73.8 L3.9 68.4
  L8.8 60.7 L12.4 56.2 L15.2 53.7 L17.6 52.1 L33.3 45.5 L35.1 44.3 L36.6 42.5 L37.3 40.7
  L37.5 38.5 L36.9 36.6 L35.3 32.6 L34.9 30.4 L35.0 27.9 L35.8 24.0 L35.6 21.3 L35.0 17.7
  L35.0 15.5 L35.4 13.7 L36.1 11.9 L38.7 7.5 L41.2 4.9 L43.8 2.8 L46.8 1.1 L48.3 0.6
  L52.4 -0.1 L60.7 0.3 L62.2 0.7 L63.7 1.4 L65.3 2.8 L70.9 9.6 L72.1 11.9 L72.8 14.2
  L73.2 16.8 L73.3 20.8 L74.9 26.7 L74.9 29.5 L73.9 33.1 L70.8 37.8 L70.0 39.9 L69.8 41.9
  L70.7 44.6 L73.2 47.3 L78.2 50.5 L80.2 51.4 L86.7 53.9 L89.4 55.5 L91.3 57.2 L95.6 62.0
  L97.3 64.5 L98.6 67.0 L102.1 75.3 L106.5 81.6 L109.8 87.6 L111.6 92.1 L112.8 97.2 L113.0 100.7
  L112.2 104.5 L107.6 114.1 L105.2 118.3 L102.9 121.8 L98.4 127.8 L95.4 132.7 L90.4 139.6 L88.6 141.5
  L84.3 144.4 L83.1 145.8 L82.4 146.9 L81.9 148.7 L81.8 154.3 L81.1 159.0 L81.1 172.5 L80.8 175.4
  L80.9 182.1 L81.8 192.0 L82.3 202.2 L81.9 203.8 L80.9 205.5 L79.6 206.7 L76.1 208.7 L74.5 210.0
  L73.4 211.8 L72.9 213.6 L72.9 215.6 L74.4 227.0 L74.5 230.9 L73.8 239.4 L72.2 248.1 L72.1 255.9
  L72.4 257.8 L73.8 262.7 L73.7 266.5 L74.0 268.5 L75.2 271.1 L78.1 274.1 L80.1 275.6 L84.4 278.0
  L86.7 280.3 L88.3 283.2 L88.9 284.8 L89.2 287.9 L88.7 289.8 L87.8 291.3 L86.2 292.8 L84.2 294.0
  L80.2 295.2 L78.4 295.5 L74.0 295.5 L70.6 295.1 L67.6 294.3 L65.9 293.6 L62.6 291.6 L60.5 290.8
  L55.7 290.1 L53.3 289.5 L50.7 288.3 L48.8 286.8 L47.8 285.5 L46.8 283.5 L46.3 281.6 L46.3 279.8
  L46.6 278.3 L48.8 271.9 L49.6 268.4 L49.6 264.8 L50.1 261.2 L50.1 258.4 L49.5 254.2 L49.3 249.6
  L49.0 246.4 L46.0 237.0 L45.2 235.4 L44.2 234.3 L42.5 233.2 L40.5 232.7 L39.3 232.7 L36.7 233.5
  L35.4 234.5 L34.4 235.8 L33.7 237.3 L31.9 244.0 L28.4 251.3 L27.7 253.3 L25.3 263.8 L24.5 272.1
  L24.6 277.5 L25.2 281.8 L25.2 284.7 L24.7 286.8 L22.9 289.7 L19.7 292.3 L18.1 294.1 L16.5 296.8 Z`;

const VOLLEY_M_READY_ART = {"src": "img/figures/volley-m-ready.2259ed2c.webp", "box": [-14.24, -1.21, 114.22, 301.11], "clear": true, "wear": "img/figures/volley-m-ready-wear.4ca6104c.png", "hi": "img/figures/volley-m-ready-hi.e5eaa8bf.webp"};

const FOOT_M_BALL_TRACE = `M97.6 299.9 L76.5 299.9 L75.2 296.6 L71.8 292.4 L70.0 288.2 L69.2 284.8 L69.9 278.4 L69.9 273.7
  L71.8 267.0 L71.8 264.1 L71.4 261.8 L70.1 255.9 L68.9 248.8 L68.0 245.6 L67.0 243.8 L65.9 242.5
  L64.3 241.5 L62.5 241.0 L59.7 241.3 L57.5 242.5 L56.1 244.1 L55.1 247.0 L53.9 253.9 L52.8 265.0
  L52.9 267.6 L53.9 272.6 L54.8 278.7 L54.8 282.4 L54.4 284.2 L53.6 286.3 L51.3 289.6 L50.1 290.8
  L49.0 291.6 L47.3 292.1 L41.4 292.3 L36.9 292.2 L28.3 293.6 L19.5 293.8 L16.3 293.0 L13.3 291.4
  L10.8 288.8 L9.7 286.2 L9.6 284.0 L10.0 282.2 L11.5 279.6 L12.7 278.5 L14.1 277.7 L18.2 276.4
  L20.5 275.2 L27.0 268.8 L28.6 266.5 L31.0 261.0 L31.5 259.2 L31.4 255.5 L29.0 240.6 L28.4 234.4
  L28.4 226.5 L29.5 215.5 L29.3 212.5 L28.1 205.1 L27.5 202.7 L26.5 200.9 L23.5 197.7 L22.8 196.0
  L22.5 194.2 L22.5 170.4 L22.8 167.8 L22.8 162.2 L24.6 145.9 L24.6 143.0 L24.1 141.2 L23.1 139.6
  L21.5 138.3 L20.2 137.7 L19.1 137.4 L12.1 137.8 L5.0 137.4 L2.4 136.6 L-2.2 134.2 L-6.2 131.1
  L-9.3 127.5 L-11.1 124.1 L-11.7 122.4 L-12.0 120.7 L-11.9 119.2 L-11.0 116.2 L-7.8 110.1 L-4.7 101.2
  L-2.5 96.5 L0.3 92.0 L4.9 86.2 L9.9 78.1 L10.6 76.0 L11.0 72.1 L11.7 69.7 L15.5 61.9
  L16.8 60.1 L20.1 57.2 L23.7 55.1 L29.3 52.9 L31.2 51.8 L33.9 49.9 L35.3 48.4 L36.2 46.9
  L36.7 45.1 L36.7 43.6 L36.3 41.9 L34.3 37.3 L32.4 34.1 L30.9 29.0 L30.9 23.0 L30.2 16.6
  L30.6 12.4 L31.3 10.3 L32.5 8.0 L33.7 6.4 L35.8 4.5 L38.1 2.9 L41.2 1.4 L43.1 0.7
  L45.9 0.1 L49.5 -0.1 L51.2 0.2 L54.7 1.2 L57.5 2.4 L60.2 4.2 L61.9 5.9 L65.2 10.2
  L66.5 12.5 L67.0 14.4 L67.2 20.5 L68.1 25.3 L67.9 28.8 L65.2 37.1 L65.2 39.0 L66.1 41.5
  L67.5 43.2 L70.0 44.8 L78.1 48.8 L83.7 50.4 L85.8 51.4 L88.0 52.8 L90.7 55.3 L93.8 59.5
  L96.3 64.8 L97.2 66.4 L101.0 70.7 L102.9 73.3 L110.4 88.2 L111.8 92.1 L111.9 95.3 L111.1 97.9
  L107.9 103.3 L105.1 108.6 L103.0 111.7 L98.2 117.8 L91.9 124.4 L85.3 131.7 L83.9 133.9 L83.4 136.1
  L84.1 144.0 L84.2 151.6 L85.7 158.2 L86.3 163.2 L86.7 168.7 L86.9 180.7 L87.6 187.9 L87.6 193.0
  L88.1 198.1 L90.1 209.8 L94.2 221.2 L95.0 225.0 L95.6 229.5 L95.5 235.9 L95.0 240.1 L90.7 262.5
  L90.4 265.5 L91.2 268.4 L94.8 275.3 L95.1 277.3 L95.2 279.3 L95.7 281.6 L96.6 283.4 L98.5 286.1
  L99.6 288.8 L99.6 291.3 L98.1 296.5 Z`;

const FOOT_M_BALL_ART = {"src": "img/figures/foot-m-ball.7efcc576.webp", "box": [-12.96, -1.02, 113.16, 301.01], "clear": true, "wear": "img/figures/foot-m-ball-wear.78209c85.png", "hi": "img/figures/foot-m-ball-hi.fc2a8495.webp"};

const FOOT_W_BALL_TRACE = `M88.4 299.9 L69.3 299.9 L68.8 296.6 L67.4 293.7 L65.3 291.7 L62.8 290.9 L61.3 290.9 L59.3 291.5
  L54.1 295.2 L51.2 296.6 L47.4 297.7 L42.9 298.4 L39.4 298.1 L34.3 297.0 L32.2 296.3 L28.2 294.0
  L25.5 293.3 L22.1 293.5 L9.1 295.7 L4.2 295.8 L0.1 295.5 L-3.0 294.9 L-5.9 293.6 L-7.9 292.1
  L-9.0 290.8 L-9.7 289.6 L-10.1 288.1 L-10.1 286.9 L-9.7 285.3 L-7.8 281.8 L-6.1 280.0 L-2.4 277.6
  L-0.9 276.2 L2.2 271.2 L10.1 263.8 L11.1 262.1 L11.6 260.4 L11.9 256.7 L11.6 245.6 L10.0 236.2
  L9.3 228.8 L8.2 223.9 L7.5 215.4 L4.8 207.5 L4.4 205.3 L4.4 202.9 L4.8 201.1 L5.8 198.5
  L11.4 187.6 L14.2 182.9 L16.2 178.8 L18.0 169.5 L19.1 166.1 L21.5 160.4 L22.2 157.5 L22.4 151.9
  L23.5 144.0 L23.8 126.8 L25.0 117.3 L27.0 105.7 L26.7 103.5 L25.2 98.4 L24.9 92.7 L26.1 81.3
  L27.7 71.0 L29.7 63.8 L31.0 61.0 L31.9 59.7 L33.5 58.1 L35.5 56.7 L44.5 51.4 L45.9 49.9
  L46.7 48.2 L47.0 47.0 L46.8 44.5 L44.1 37.5 L41.0 24.0 L40.9 21.2 L41.2 18.8 L41.8 16.1
  L42.5 14.3 L45.1 9.2 L47.5 6.4 L51.0 4.0 L56.5 1.1 L58.1 0.3 L59.8 -0.1 L63.4 0.1
  L65.1 0.6 L67.0 1.5 L74.2 7.6 L76.5 10.4 L77.5 12.5 L78.3 15.4 L79.2 21.9 L80.3 26.5
  L80.3 29.3 L80.0 30.8 L77.5 37.6 L77.5 39.4 L78.0 41.2 L79.3 43.2 L81.3 45.1 L83.0 46.2
  L87.9 48.4 L91.2 50.4 L98.0 55.3 L100.0 57.3 L102.3 60.7 L104.5 65.1 L106.3 70.9 L109.4 88.2
  L110.0 93.2 L110.0 96.0 L109.3 99.9 L109.6 110.7 L109.5 115.5 L107.8 126.5 L105.4 138.8 L105.5 141.0
  L108.2 152.7 L109.3 159.2 L109.6 162.9 L109.6 166.4 L109.4 168.2 L108.6 169.9 L105.0 173.5 L103.7 175.6
  L103.0 178.2 L102.1 183.2 L100.2 198.5 L99.8 206.2 L100.4 215.2 L102.0 225.9 L102.0 230.5 L101.2 233.0
  L98.4 237.1 L97.5 239.3 L91.9 263.0 L91.9 265.0 L92.4 266.8 L95.1 270.7 L95.7 272.2 L96.2 278.1
  L96.0 280.2 L95.1 282.7 L93.3 284.8 L92.1 286.9 L91.1 292.1 L89.3 296.2 Z
  M66.4 262.9 L68.7 262.1 L70.2 260.8 L71.7 258.4 L72.2 256.7 L76.1 235.4 L76.2 232.8 L75.7 229.0
  L75.7 223.0 L75.3 220.6 L73.2 215.5 L72.0 210.9 L70.9 204.2 L70.4 198.8 L69.0 190.9 L68.3 188.0
  L67.2 186.1 L65.6 184.8 L63.8 184.1 L61.5 183.9 L58.9 184.8 L57.0 186.2 L51.9 191.5 L45.4 197.5
  L39.4 204.7 L35.8 210.1 L35.2 212.1 L35.2 214.7 L37.5 225.9 L38.0 230.7 L37.9 237.1 L36.8 245.5
  L37.2 247.6 L37.8 249.0 L38.8 250.2 L40.0 251.2 L42.2 252.0 L48.0 252.8 L51.3 253.9 L56.4 256.8
  L60.0 260.4 L62.2 262.1 L64.7 263.0 Z`;

const FOOT_W_BALL_ART = {"src": "img/figures/foot-w-ball.86fa9a9c.webp", "box": [-11.27, -1.26, 111.41, 301.25], "clear": true, "wear": "img/figures/foot-w-ball-wear.fee65c57.png", "hi": "img/figures/foot-w-ball-hi.a47b9136.webp"};

const BALL_M_READY_TRACE = `M32.6 299.9 L6.7 299.9 L6.4 298.8 L6.2 292.2 L6.8 288.4 L8.2 284.5 L10.3 280.3 L11.1 277.8
  L12.0 274.3 L12.1 270.7 L12.5 268.9 L15.1 264.9 L15.9 263.2 L16.1 261.7 L15.9 253.7 L16.3 250.9
  L16.1 228.4 L16.4 224.8 L17.7 216.5 L20.1 208.3 L20.6 205.7 L20.6 203.9 L20.1 202.1 L19.4 200.8
  L17.1 198.0 L16.5 196.8 L16.1 195.4 L16.1 193.4 L17.6 187.9 L18.0 180.0 L19.3 166.6 L19.5 162.7
  L19.5 148.3 L20.1 139.8 L22.7 128.9 L22.7 126.9 L21.7 123.1 L21.3 119.2 L20.4 116.3 L18.3 114.1
  L14.4 112.0 L12.3 110.4 L10.7 108.3 L9.9 106.6 L8.6 102.1 L8.5 94.1 L9.5 83.6 L11.6 73.5
  L12.6 63.9 L13.9 59.6 L14.8 57.3 L17.3 52.9 L20.0 49.9 L23.9 47.0 L29.5 44.5 L31.6 43.3
  L32.9 42.1 L34.2 39.9 L34.4 36.8 L31.9 29.9 L31.5 27.7 L31.4 23.6 L30.3 18.2 L30.3 15.1
  L31.4 11.0 L33.1 7.5 L34.2 5.9 L35.7 4.5 L38.2 2.6 L41.2 1.2 L43.3 0.4 L46.6 -0.1
  L48.8 -0.1 L52.4 0.6 L55.5 2.0 L61.5 6.5 L63.1 8.5 L63.8 10.1 L64.5 12.7 L64.7 17.7
  L65.9 22.2 L66.2 24.2 L65.8 28.7 L64.0 33.2 L63.5 35.1 L63.7 37.3 L64.4 39.1 L65.9 40.9
  L67.4 42.0 L79.7 47.2 L81.7 48.5 L83.5 50.0 L85.1 51.9 L86.7 54.9 L88.6 60.2 L89.3 63.6
  L89.6 65.9 L89.6 74.9 L90.4 80.7 L91.4 90.8 L93.4 99.0 L93.7 102.7 L92.9 107.2 L91.1 112.7
  L91.0 115.1 L91.3 118.0 L90.9 120.2 L89.3 124.2 L88.4 125.7 L84.7 130.4 L83.7 133.2 L83.7 134.7
  L84.3 136.6 L87.1 141.5 L87.6 144.2 L87.6 146.7 L86.1 152.1 L84.1 156.3 L83.6 158.4 L83.6 190.5
  L82.9 194.8 L81.3 198.9 L81.1 202.5 L81.6 206.7 L83.4 215.2 L83.7 218.3 L83.7 228.0 L82.4 244.9
  L82.2 251.1 L82.3 256.6 L82.9 259.0 L84.7 263.8 L85.5 265.2 L87.7 268.0 L88.6 269.6 L89.0 271.5
  L89.0 273.8 L89.2 275.3 L92.4 282.2 L93.3 285.1 L93.4 287.5 L93.0 289.0 L92.4 290.1 L91.2 291.3
  L89.6 292.2 L87.6 292.7 L78.8 293.8 L75.2 293.8 L72.8 293.0 L69.7 291.2 L66.1 287.2 L62.2 283.9
  L61.2 282.6 L60.4 279.9 L60.4 277.3 L61.5 269.3 L63.1 262.4 L63.3 258.0 L63.0 251.4 L62.8 246.6
  L62.3 242.7 L60.8 235.4 L59.2 230.1 L58.5 226.3 L58.2 222.0 L58.4 214.1 L58.3 209.4 L57.8 207.4
  L57.2 206.2 L55.9 204.6 L54.7 203.9 L53.2 203.3 L50.2 203.3 L48.4 204.0 L46.7 205.4 L45.1 208.3
  L44.1 211.1 L42.8 217.6 L42.4 226.0 L41.8 231.2 L40.8 234.9 L38.9 239.8 L36.6 250.0 L35.0 264.5
  L35.5 268.4 L35.6 272.3 L36.4 277.5 L36.7 288.2 L36.1 290.5 L33.4 295.3 Z`;

const BALL_M_READY_ART = {"src": "img/figures/ball-m-ready.b42220aa.webp", "box": [5.1, -1.16, 94.91, 300.57], "clear": true, "wear": "img/figures/ball-m-ready-wear.29bf794c.png", "hi": "img/figures/ball-m-ready-hi.2494265b.webp"};

const FIGURES = {
  /* Each figure: its cut (`path`, or `paths` one per pose), the colour print
     on it (`art` / `arts`), the pose names, the Men / Women `groups` and the
     price factor per pose (`bases`). */
  gown: { paths: [GOWN_BALL_TRACE, GOWN_TRAIN_TRACE, GOWN_EVENING_TRACE, GOWN_SWEEP_TRACE],
          names: ['Ball gown', 'Train', 'Evening', 'Off-shoulder'],
          arts: [GOWN_BALL_ART, GOWN_TRAIN_ART, GOWN_EVENING_ART, GOWN_SWEEP_ART],
          /* The sheet is bought by the rectangle, so the price follows the
             sheet actually cut, over the blade height squared, at 2.31w + 0.03
             with 1.26 as the floor: Ball gown 0.63; Train 0.52, Evening 0.38
             and Off-shoulder 0.49, all three at the floor. */
          bases: [1.49, 1.26, 1.26, 1.26] },
  gent: { path: GENT_TRACE, art: GENT_ART },
  lady: { path: LADY_TRACE, art: LADY_ART },
  suit: { path: SUIT_TRACE, art: SUIT_ART },
  /* One Volleyball shape: the men's pose 0, the women's 1. `groups` drives the
     Men / Women toggle; the pose row shows one group at a time. */
  volley: { paths: [VOLLEY_M_READY_TRACE, VOLLEY_W_READY_TRACE],
            arts: [VOLLEY_M_READY_ART, VOLLEY_W_READY_ART],
            names: ['Ready', 'Ready'],
            groups: [{ label: 'Men', from: 0, to: 1 }, { label: 'Women', from: 1, to: 2 }],
            /* priced by the sheet cut, 2.31w + 0.03 with 1.26 as the floor:
               w 0.40 and 0.41, both at the floor */
            bases: [1.26, 1.26] },
  box: { paths: [BOX_M_VICTORY_TRACE, BOX_M_CHAMPION_TRACE, BOX_W_GUARD_TRACE, BOX_W_READY_TRACE],
         names: ['Victory', 'Champion', 'Guard', 'Ready'],
         groups: [{ label: 'Men', from: 0, to: 2 }, { label: 'Women', from: 2, to: 4 }],
         arts: [BOX_M_VICTORY_ART, BOX_M_CHAMPION_ART, BOX_W_GUARD_ART, BOX_W_READY_ART] },
  foot: { paths: [FOOT_M_BALL_TRACE, FOOT_W_BALL_TRACE],
          // the men's player holds his ball since he was made fit (owner, 8 Nov: the first "looks fat")
          names: ['Ball in hand', 'On the ball'],
          groups: [{ label: 'Men', from: 0, to: 1 }, { label: 'Women', from: 1, to: 2 }],
          arts: [FOOT_M_BALL_ART, FOOT_W_BALL_ART],
          /* Sheet is bought by the rectangle, so a sprawling pose costs more
             than a compact one. Priced per pose, not per shape: 1.53w + 0.45,
             the rate the first poses were set at, with 1.26 as the floor --
             a figure is never cheaper to cut than a plaque. On the ball 0.35
             and 0.39: both at the floor. */
          bases: [1.26, 1.26] },
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
         /* Run 0.37, women's Sprint 0.33 and Ready 0.38: all at the floor */
         bases: [1.26, 1.26, 1.26] },
  grad: { paths: [GRAD_TRACE, GRAD_W_TRACE],
          names: ['Graduate', 'Graduate'],
          groups: [{ label: 'Men', from: 0, to: 1 }, { label: 'Women', from: 1, to: 2 }],
          arts: [GRAD_ART, GRAD_W_ART],
          /* 0.35 and 0.30 of sheet, both at the 1.26 floor; the arms-up
             silhouette of the first set used 0.46 and was 1.42 */
          bases: [1.26, 1.26] },
  ball: { paths: [BALL_M_READY_TRACE, BALL_W_READY_TRACE],
          names: ['Ready', 'Ready'],
          groups: [{ label: 'Men', from: 0, to: 1 }, { label: 'Women', from: 1, to: 2 }],
          arts: [BALL_M_READY_ART, BALL_W_READY_ART],
          /* Sheet actually cut, over the blade height squared: Ready 0.27 and
             0.39 -- priced at the basketball rate of 1.26 for 0.40 (3.15w),
             with 1.26 as the floor: both at the floor. */
          bases: [1.26, 1.26] },
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
  if (DESIGNS[key]) return fallback * designCost(key);
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
  const f = FIGURES[key];
  return f && f.names && f.names.length > 1 ? f.names : null;
}

/* Shapes whose options are a STYLE (layered or plain), not a pose. */
export function isStyled(key) { return false; }   // the layered designs come one way: as drawn

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
/* Where the pictures are served from: beside this module on the site. The
   video project bundles this file away from the site and points it at its own
   copy of assets/img/figures instead. */
let ART_BASE = null;
export function setArtBase(url) { ART_BASE = url; }
const ART_READY = new Map();
const artUrl = src => (ART_BASE ? ART_BASE + src : new URL('../' + src, import.meta.url).href);

/* The figures' outfit colours (owner, 8 Nov: the customer picks the colour of
   the dress or suit). A design keeps `outfit` as #rrggbb: one of these, or any
   colour the customer mixes. figure-src/print-figures.py found the clothes. */
export const OUTFITS = [
  { hex: '#1b1b1d', label: 'Black' }, { hex: '#f2f0ea', label: 'White' }, { hex: '#1f2b5c', label: 'Navy' },
  { hex: '#2456c4', label: 'Royal blue' }, { hex: '#5aa8e0', label: 'Sky blue' }, { hex: '#c4262e', label: 'Red' },
  { hex: '#7a1f2c', label: 'Maroon' }, { hex: '#e27aa5', label: 'Pink' }, { hex: '#6b3fa0', label: 'Purple' },
  { hex: '#1f8a54', label: 'Green' }, { hex: '#c9a23a', label: 'Gold' }, { hex: '#a7adb5', label: 'Silver' },
];
const OUTFIT_HEX = /^#[0-9a-f]{6}$/i;
export const outfitOk = v => typeof v === 'string' && OUTFIT_HEX.test(v);
export const outfitLabel = v => (outfitOk(v) ? OUTFITS.find(o => o.hex === v.toLowerCase())?.label || `Custom ${v.toLowerCase()}` : null);
// a figure whose print can take an outfit colour
export const hasOutfit = cfg => !!figureArt(cfg?.shape, cfg?.variant)?.wear;

/* The print with the outfit in `hex`: where the outfit map says (its alpha) the
   print takes the colour, darker or lighter by the map's shade (grey 128 = the
   colour itself); face, skin, hair, a white shirt, shoes and a ball stay as
   drawn. -> a canvas the size asked for */
export function recolour(print, wear, hex, w = print.naturalWidth || print.width, h = print.naturalHeight || print.height) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(print, 0, 0, w, h);
  const P = g.getImageData(0, 0, w, h), d = P.data;
  const m = document.createElement('canvas');
  m.width = w; m.height = h;
  const mg = m.getContext('2d', { willReadFrequently: true });
  mg.imageSmoothingQuality = 'high';
  mg.drawImage(wear, 0, 0, w, h);
  const M = mg.getImageData(0, 0, w, h).data;
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, gr = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  for (let i = 0; i < d.length; i += 4) {
    const a = M[i + 3] / 255;
    if (a < 0.01) continue;
    const t = M[i] / 128;                          // 1: the colour itself
    let R, G, B;
    if (t <= 1) { const k = 0.25 + 0.75 * t; R = r * k; G = gr * k; B = b * k; }
    else { const k = Math.min(1, t - 1) * 0.45; R = r + (1 - r) * k; G = gr + (1 - gr) * k; B = b + (1 - b) * k; }
    d[i] = d[i] * (1 - a) + R * 255 * a;
    d[i + 1] = d[i + 1] * (1 - a) + G * 255 * a;
    d[i + 2] = d[i + 2] * (1 - a) + B * 255 * a;
  }
  g.putImageData(P, 0, 0);
  m.width = m.height = 0;
  return c;
}
export const loadArtImage = src => new Promise((ok, bad) => {
  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.onload = () => ok(im);
  im.onerror = bad;
  im.src = artUrl(src);
});
const artKey = (art, outfit) => (art.wear && outfitOk(outfit) ? `${art.src}|${outfit.toLowerCase()}` : art.src);

function artTexture(art, outfit) {
  const key = artKey(art, outfit);
  if (key !== art.src) {
    // the outfit recoloured: nothing until both pictures land, then the print in its colour
    let tx = ART_TEX.get(key);
    if (!tx) {
      // no picture until it is ready: WebGL keeps a texture the size of its first one, so a
      // stand-in of another size would leave the print blank
      tx = new THREE.Texture();
      tx.colorSpace = THREE.SRGBColorSpace;
      tx.anisotropy = 8;
      tx.userData.shared = true;
      ART_TEX.set(key, tx);
      ART_READY.set(key, Promise.all([loadArtImage(art.src), loadArtImage(art.wear)]).then(([pr, we]) => {
        tx.image = recolour(pr, we, outfit.toLowerCase());
        tx.needsUpdate = true;
        window.dispatchEvent(new Event('tala:art'));
      }).catch(() => {}));
    }
    return tx;
  }
  let tx = ART_TEX.get(art.src);
  if (!tx) {
    let done;
    ART_READY.set(art.src, new Promise(r => { done = r; }));
    tx = new THREE.TextureLoader().load(artUrl(art.src),
      () => { done(); window.dispatchEvent(new Event('tala:art')); }, undefined, () => done());
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 8;
    tx.userData.shared = true;
    ART_TEX.set(art.src, tx);
  }
  return tx;
}

/* A shop trophy the owner made from a picture in the Admin Deck (6 Nov) is
   "Your art" whose cut-out picture is kept in the shop's photo storage, named
   by the design's `cutUrl`. Only that storage is read: an order's design comes
   from the customer. Loaded once; every model of the trophy then wears it, as
   "Your art" wears the customer's own picture. */
const SHOP_ART = new Map();                 // cutUrl -> { img, ready, waiting }
export function shopArtOk(url) {
  const base = String(globalThis.TALA_CONFIG?.supabaseUrl || '').replace(/\/+$/, '');
  const dir = `${base}/storage/v1/object/public/trophy-photos/art/`;
  return !!base && typeof url === 'string' && url.startsWith(dir) && /^[\w.-]+$/.test(url.slice(dir.length));
}
// a shop item's design the site can show: a designer trophy, or one made from a picture with its outline and cut-out
/* The headings the shop's "See all" sorts its trophies under. A shop trophy
   sits under its shape's, unless the owner picked another in the Admin Deck
   (design.group, owner 8 Nov); a picture-made one has no shape group: More. */
export const SHOP_GROUPS = ['Classic', 'Rounds', 'Stars', 'Curves', 'Figures', 'More'];
export const shopGroup = d => (SHOP_GROUPS.includes(d?.group) ? d.group : SHAPES[d?.shape]?.group || 'More');
export const shopDesignOk = d => !!(d && typeof d === 'object' && SHAPES[d.shape]
  && (d.shape !== 'custom' || (typeof d.outline === 'string' && shopArtOk(d.cutUrl))));
function shopArt(cfg) {
  if (cfg.shape !== 'custom' || cfg.cutArt || !cfg.cutPrint || !shopArtOk(cfg.cutUrl)) return null;
  let e = SHOP_ART.get(cfg.cutUrl);
  if (!e) {
    e = { img: null, waiting: [] };
    const img = new Image();
    img.crossOrigin = 'anonymous';           // the sticker is printed from it: the canvas must stay readable
    e.ready = new Promise(done => {
      img.onload = () => { e.img = img; e.waiting.splice(0).forEach(f => f()); done(); window.dispatchEvent(new Event('tala:art')); };
      img.onerror = () => done();
    });
    img.src = cfg.cutUrl;
    SHOP_ART.set(cfg.cutUrl, e);
  }
  return e;
}

/* Resolves once the print a trophy carries has loaded (at once if it has none),
   for a still that is taken once and kept, like the shop's. */
export function artReady(cfg) {
  const own = shopArt(cfg);
  if (own) return own.ready;
  const art = figureArt(cfg.shape, cfg.variant) || DESIGNS[cfg.shape]?.art;
  if (!art) return Promise.resolve();
  artTexture(art, cfg.outfit);
  return ART_READY.get(artKey(art, cfg.outfit)) || Promise.resolve();
}

/* What the order sheet says about the print, or null. */
export function printNote(cfg) {
  const fa = figureArt(cfg.shape, cfg.variant);
  if (fa?.clear) return `Printed in colour on the front, with a face, cut with a clear border${hasOutfit(cfg) && outfitOk(cfg.outfit) ? `; outfit in ${outfitLabel(cfg.outfit)}` : ''}`;
  if (fa) return 'Printed in full colour on the front: a fashion illustration, no face';
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
export function customOutline() { return CUSTOM_OUTLINE; }

/* A saved design carries its own outline -- a request sent from "Your art"
   (`outline`, see designSpec in designer.js): build with it, then put back
   whatever outline the designer page holds. */
function withOwnOutline(cfg, fn) {
  if (cfg?.shape !== 'custom' || typeof cfg.outline !== 'string') return fn();
  const keep = CUSTOM_OUTLINE;
  CUSTOM_OUTLINE = cfg.outline;
  try { return fn(); } finally { CUSTOM_OUTLINE = keep; }
}

/* The path a piece is cut along, in its own drawing's units: a design's body,
   a figure's pose, the customer's own outline. */
export function cutOutline(cfg) {
  if (DESIGNS[cfg.shape]) return DESIGNS[cfg.shape].body;
  if (cfg.shape === 'custom') return typeof cfg.outline === 'string' ? cfg.outline : CUSTOM_OUTLINE;
  return figurePath(cfg.shape, cfg.variant);
}

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

/* `decal` says where the sticker goes: on a design, its face (see DESIGNS).
   The figures have no flat area worth printing on, so their sticker mounts on
   the base instead. */
/* every design, as a shape */
function designEntries() {
  return Object.fromEntries(Object.entries(DESIGNS).map(([k, D]) => [k, {
    label: D.name, group: D.group, build: designShape(k), base: D.base, decal: D.face, sheet: D.sheet, note: D.note,
    tile: D.tile, ink: D.ink,
  }]));
}

export const SHAPES = {
  ...designEntries(),
  lady:     { group: 'Figures', label: 'Lady',      build: ladyShape,     base: 1.30, decal: { onBase: true },              note: 'Full-colour illustration with a face: a lady in a red dress and heels.' },
  gown:     { group: 'Figures', label: 'Gown',      build: gownShape,     base: 1.24, decal: { onBase: true },              note: 'Four gowns, a full-colour illustration with a face. Mutya, Mr & Ms and coronation nights.' },
  gent:     { group: 'Figures', label: 'Gentleman', build: gentShape,     base: 1.22, decal: { onBase: true },              note: 'Full-colour illustration with a face: a gentleman in a black tuxedo. The pageant partner to the Lady.' },
  suit:     { group: 'Figures', label: 'Suit',       build: suitShape,    base: 1.26, decal: { onBase: true },              note: 'Full-colour illustration with a face: a man in a charcoal suit and tie. The partner to the Lady.' },
  grad:     { group: 'Figures', label: 'Graduate',  build: gradShape,     base: 1.42, decal: { onBase: true },              note: 'Full-colour illustration with a face, men and women, in gown and cap. For recognition day.' },
  ball:     { group: 'Figures', label: 'Basketball',build: ballShape,     base: 1.26, decal: { onBase: true },              note: 'Full-colour illustration with a face, men and women, the ball in hand. The liga favourite.' },
  volley:   { group: 'Figures', label: 'Volleyball',build: volleyShape,  base: 1.26, decal: { onBase: true },              note: 'Full-colour illustration with a face, men and women, the ball in hand. The school and liga favourite.' },
  box:      { group: 'Figures', label: 'Boxing',    build: boxShape,      base: 1.26, decal: { onBase: true },              note: 'Full-colour illustration with a face, men and women. For boxing and arnis tournaments.' },
  foot:     { group: 'Figures', label: 'Football',  build: footShape,     base: 1.28, decal: { onBase: true },              note: 'Full-colour illustration with a face, men and women, with the ball. Also used for futsal.' },
  run:      { group: 'Figures', label: 'Athletics', build: runShape,      base: 1.26, decal: { onBase: true },              note: 'Full-colour illustration with a face, men and women. Covers track, fun runs and Palaro.' },
  custom:   { label: 'Your art',  build: customShape,   base: 1.30, decal: { onBase: true },              note: 'Cut to your own outline — drop an SVG in the sticker step.' },
};

/* The option tiles draw the REAL cut outline, sampled from the same builder
   the 3D model uses, so a tile can never quietly drift from the piece it
   sells. Fitted into `box` with the foot on its bottom edge. A panel shown
   "With gold" carries its gold piece too: in outlinePath as rings the even-odd
   fill leaves open, and from goldPath to fill them in gold -- so the With gold
   and Plain tiles differ, as the pieces do. */
function tileRings(key, box, variant) {
  const spec = SHAPES[key];
  if (!spec) return null;
  let shape;
  try { shape = spec.build(6.8, 17.8, variant); } catch { return null; }
  if (!shape) return null;

  const ringsOf = list => list.flatMap(s => [s, ...(s.holes || [])]).map(r => r.getPoints(170));
  const rings = ringsOf(pieces(shape));
  const gold = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const r of rings) for (const p of r) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX, h = maxY - minY;
  if (!(w > 0 && h > 0)) return null;

  const k  = Math.min(box.w / w, box.h / h);
  const ox = box.x + box.w / 2 - ((minX + maxX) / 2) * k;
  const oy = box.y + box.h;
  const d = list => list.map(r => r.map((p, i) =>
    `${i ? 'L' : 'M'}${(ox + p.x * k).toFixed(1)} ${(oy - (p.y - minY) * k).toFixed(1)}`
  ).join('') + 'Z').join('');
  return { outline: d(rings), gold: d(gold) };
}

export function outlinePath(key, box, variant) {
  const t = tileRings(key, box, variant);
  return t ? t.outline + t.gold : '';
}

/* A design's tile: its body and layers in their own colours, fitted into
   `box` with the foot on its bottom edge, as SVG paths. Inline fills: the
   tiles' stylesheet paints every other path in the text colour. */
const TILE_FILL = {
  white: '#F2F0EA', black: '#22211F', navy: '#1C2F6E', blue: '#1F4FB0', sky: '#5AA8DE', red: '#C42A2A',
  wine: '#7E1D30', green: '#1E7E46', yellow: '#ECC422', orange: '#E27E1C', tan: '#D8C79A', wood: '#8A5A2E',
  gold: '#C9A24A', silver: '#BFC4CA', frost: '#E6ECEF', clear: '#D5E4EE', rainbow: '#D98CC9',
};
export function tileArt(key, box) {
  const D = DESIGNS[key];
  if (!D) return '';
  const body = pathToShape(D.body, 6.8, 17.8);
  if (!body) return '';
  const layers = layerShapes(key, 6.8, 17.8).sort((a, b) => a.level - b.level);
  const ringsOf = shp => pieces(shp).flatMap(s => [s, ...(s.holes || [])]).map(r => r.getPoints(120));
  const all = ringsOf(body);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const r of all) for (const p of r) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const k = Math.min(box.w / (maxX - minX), box.h / (maxY - minY));
  const ox = box.x + box.w / 2 - ((minX + maxX) / 2) * k, oy = box.y + box.h;
  const d = shp => ringsOf(shp).map(r => r.map((p, i) =>
    `${i ? 'L' : 'M'}${(ox + p.x * k).toFixed(2)} ${(oy - (p.y - minY) * k).toFixed(2)}`).join('') + 'Z').join('');
  const path = (shp, mat) => `<path class="lay" d="${d(shp)}" fill-rule="evenodd" style="fill:${TILE_FILL[mat] || '#ccc'}"/>`;
  return path(body, D.sheet) + layers.map(L => path(L.shape, L.mat)).join('');
}

export function goldPath(key, box, variant) {
  const t = tileRings(key, box, variant);
  return t ? t.gold : '';
}

/* ───────────────────────── sheet colours ───────────────────────── */

/* Cast acrylic sheet, 5–8 mm. Opaque and glossy straight off the saw. */
export const MATERIALS = {
  blue:   { label: 'Blue acrylic',   short: 'Blue',   kind: 'sheet',  color: 0x1B49A8, mult: 1.00, note: 'The most ordered colour. Strong under a white or gold sticker.' },
  red:    { label: 'Red acrylic',    short: 'Red',    kind: 'sheet',  color: 0xC02626, mult: 1.00, note: 'Fiesta and sports standard. Do not put a red sticker on it.' },
  green:  { label: 'Green acrylic',  short: 'Green',  kind: 'sheet',  color: 0x1A7A42, mult: 1.00, note: 'School and barangay colours. Pairs well with gold.' },
  yellow: { label: 'Yellow acrylic', short: 'Yellow', kind: 'sheet',  color: 0xEBC218, mult: 1.00, note: 'Bright and cheap. Needs a dark sticker to stay readable.' },
  orange: { label: 'Orange acrylic', short: 'Orange', kind: 'sheet',  color: 0xE07A16, mult: 1.00, note: 'Warm and loud. Common for palaro and intramurals.' },
  white:  { label: 'White acrylic',  short: 'White',  kind: 'sheet',  color: 0xF2F0EA, mult: 1.00, opal: true, note: 'Clean ground for any sticker. The pageant favourite.' },
  black:  { label: 'Black acrylic',  short: 'Black',  kind: 'sheet',  color: 0x171614, mult: 1.00, note: 'The most formal sheet. Everything reads on it.' },
  tan:    { label: 'Tan acrylic',    short: 'Tan',    kind: 'sheet',  color: 0xC2B183, mult: 1.00, note: 'Muted stone colour. A quiet alternative to white.' },
  navy:   { label: 'Navy acrylic',   short: 'Navy',   kind: 'sheet',  color: 0x172A66, mult: 1.00, note: 'Deep blue. Formal, and gold reads beautifully on it.' },
  wine:   { label: 'Wine acrylic',   short: 'Wine',   kind: 'sheet',  color: 0x7A1A2C, mult: 1.00, note: 'A deep red. Rich under a gold medallion.' },
  wood:   { label: 'Wood grain',     short: 'Wood',   kind: 'sheet',  color: 0x8A5A2E, mult: 1.10, note: 'Wood-grain sheet. Warm and classic.' },
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
  /* printed on the acrylic itself, no sticker round it: how the catalogue pieces carry their wording */
  printdark:  { label: 'Printed, dark',  print: true, bg: 'rgba(0,0,0,0)', ink: '#1C1813', accent: '#9B7426', rule: 'rgba(28,24,19,.28)' },
  printlight: { label: 'Printed, white', print: true, bg: 'rgba(0,0,0,0)', ink: '#FFFFFF', accent: '#E6C468', rule: 'rgba(255,255,255,.4)' },
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
export function stickerCanvas(cfg, aspect, px = 1024) {
  const sc = SCHEMES[cfg.scheme] || SCHEMES.white;
  const f = FONTS[cfg.font] || FONTS.classic;
  const PX = Math.round(px);       // wider for a sticker printed at 300 dpi (admin.js); every size below follows it
  const c = document.createElement('canvas');
  c.width = PX;
  c.height = Math.max(64, Math.round(PX / aspect));
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const safe = W * ((DECALS[cfg.decal] || DECALS.rect).safe ?? 0.84);
  const sans = f.small;

  const photo = cfg.photoImg || null;
  const fit = photo ? (cfg.photoFit || 'badge') : null;

  const print = sc.print && fit !== 'cover';
  if (print) {
    g.clearRect(0, 0, W, H);
  } else {
    const grad = g.createLinearGradient(0, 0, W * 0.4, H);
    grad.addColorStop(0, sc.bg);
    grad.addColorStop(1, sc.bg2 || sc.bg);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }

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

  if (!print) {                       // printed wording sits in the design's own frame
    g.strokeStyle = accent;
    g.lineWidth = Math.max(2, Math.min(W, H) * 0.020);
    keylinePath(g, cfg.decal, W, H, 0.050);
    g.stroke();
    g.globalAlpha = 0.55;
    g.lineWidth = Math.max(1, Math.min(W, H) * 0.007);
    keylinePath(g, cfg.decal, W, H, 0.082);
    g.stroke();
    g.globalAlpha = 1;
  }

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

/* Wording printed on the acrylic: no sticker, so no sticker edge either. */
const printed = cfg => !!(SCHEMES[cfg.scheme]?.print && !(cfg.photoImg && cfg.photoFit === 'cover'));

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
    transparent: printed(cfg), depthWrite: !printed(cfg),
  });
  const edge = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.7, metalness: 0,
    transparent: printed(cfg), opacity: printed(cfg) ? 0 : 1, depthWrite: !printed(cfg) });
  return [face, edge];
}

/* ───────────────────────── sheet & base materials ───────────────────────── */

/* The sheets a design's layers are cut from. Nearly opaque: a thin layer on
   a translucent body would take the body's colour otherwise. A gold layer on a
   gold sheet is cut in silver, or it would vanish into it. */
const LAYER_COLOURS = {
  white: 0xF2F0EA, black: 0x1A1917, navy: 0x172A66, blue: 0x1B49A8, sky: 0x58A6DE, red: 0xC02626,
  wine: 0x7A1A2C, green: 0x1A7A42, yellow: 0xEBC218, orange: 0xE07A16, tan: 0xD8C79A, wood: 0x8A5A2E,
};
function layerMaterial(name, sheet) {
  const key = name === 'gold' && sheet === 'gold' ? 'silver' : name;
  if (key === 'gold' || key === 'silver') {
    return new THREE.MeshPhysicalMaterial({
      color: key === 'gold' ? 0xE0B24A : 0xD9DDE2, metalness: 0.55, roughness: 0.32, clearcoat: 1,
      clearcoatRoughness: 0.08, emissive: key === 'gold' ? 0x2a1c05 : 0x15161a, envMapIntensity: 1.25,
    });
  }
  if (key === 'frost') {
    return new THREE.MeshPhysicalMaterial({ color: 0xF4F7F8, roughness: 0.55, transmission: 0.5, thickness: 0.4,
      ior: 1.49, transparent: true, clearcoat: 0.3 });
  }
  if (key === 'clear') return sheetMaterial(MATERIALS.clear);
  if (key === 'rainbow') {
    return new THREE.MeshPhysicalMaterial({ color: 0xF6EEF6, roughness: 0.16, metalness: 0.25, iridescence: 1,
      iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 820], clearcoat: 1, clearcoatRoughness: 0.05 });
  }
  if (key === 'wood') return new THREE.MeshStandardMaterial({ color: LAYER_COLOURS.wood, roughness: 0.62, metalness: 0 });
  return new THREE.MeshPhysicalMaterial({ color: LAYER_COLOURS[key] ?? 0xF2F0EA, roughness: 0.16, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.04, transmission: 0.1, thickness: 0.3, transparent: true });
}

/* A layer's printed face. Foil and glitter are metal, so their print shows in
   what they reflect; a little of it glows on its own as well, or a dark studio
   turns gold to bronze. */
function capMaterial(fin, map) {
  if (fin === 'foil' || fin === 'glitter') {
    return new THREE.MeshPhysicalMaterial({ map, metalness: fin === 'foil' ? 0.6 : 0.45, roughness: fin === 'foil' ? 0.28 : 0.38,
      clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.16, envMapIntensity: 1.3 });
  }
  if (fin === 'frost') {
    return new THREE.MeshPhysicalMaterial({ map, transparent: true, roughness: 0.5, transmission: 0.3, thickness: 0.4,
      ior: 1.49, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  }
  if (fin === 'wood') return new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0 });
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04,
    envMapIntensity: 1.1 });
}

/* The cut edge of a design's sheet, polished as the laser leaves it: brighter
   than the face, as the edge of real acrylic is -- light travelling inside the
   sheet comes out there. On clear acrylic it is what draws the outline. */
function edgeMaterial(spec) {
  if (spec.kind === 'mirror') return sheetMaterial(spec);
  const glass = spec.kind === 'glass';
  const c = glass ? 0xDDF1EE : spec.color;
  return new THREE.MeshPhysicalMaterial({
    color: c, emissive: c, emissiveIntensity: glass ? 0.3 : 0.16,
    metalness: 0, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04,
    transmission: glass ? 0.35 : spec.opal ? 0.05 : 0.25, thickness: 0.6, ior: 1.49, transparent: true,
    envMapIntensity: 1.3,
  });
}

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
    /* Mirrored acrylic shows what it reflects, and the dark studio turned gold
       to bronze on the gold stars and cups: a little of its own colour glows
       through, as the gold on a real piece catches the room's light. */
    return new THREE.MeshPhysicalMaterial({
      color: spec.color, metalness: 0.82, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08,
      emissive: spec.color, emissiveIntensity: 0.22, envMapIntensity: 1.2,
    });
  }
  /* Cast acrylic is TRANSLUCENT — light goes through it and the cut edges
     glow. Rendering it opaque is what made these look like thick painted
     metal instead of thin coloured sheet. */
  return new THREE.MeshPhysicalMaterial({
    color: spec.color,
    metalness: 0,
    roughness: 0.07,
    transmission: spec.opal ? 0.1 : 0.78,     // white is opal: see-through, it read as grey
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
           decal: 'rect', scheme: 'black', laminate: 'gloss', font: 'script',
           org: 'Mutya ng Gloria', title: '1st Runner-Up', name: 'Maria C. Lualhati', date: '2026' },
  },
  liga: {
    label: 'Sports / Liga', hint: 'Basketball, volleyball, athletics',
    cfg: { shape: 'shield', material: 'blue', size: 'm', baseKind: 'goldbar', baseFinish: 'black',
           decal: 'shield', scheme: 'navy', laminate: 'gloss', font: 'sport',
           org: 'Barangay Liga 2026', title: 'Champion', name: "Men's Basketball", date: 'Gloria' },
  },
  school: {
    label: 'School awards', hint: 'Recognition day, honour roll',
    cfg: { shape: 'arch', material: 'white', size: 'm', baseKind: 'block', baseFinish: 'black',
           decal: 'rect', scheme: 'white', laminate: 'matte', font: 'classic',
           org: 'Gloria NHS', title: 'Most Outstanding', name: 'Juan D. Reyes', date: 'SY 2025 – 2026' },
  },
  fiesta: {
    label: 'Fiesta', hint: 'Street dance, float, palaro',
    cfg: { shape: 'oval', material: 'red', size: 'm', baseKind: 'octbox', baseFinish: 'black',
           decal: 'circle', scheme: 'gold', laminate: 'gloss', font: 'sport',
           org: 'Barangay Fiesta', title: '1st Place', name: 'Street Dance', date: 'May 2026' },
  },
  contest: {
    label: 'Contest / Quiz', hint: 'Quiz bee, debate, science fair',
    cfg: { shape: 'plaque', material: 'green', size: 's', baseKind: 'utilbox', baseFinish: 'black',
           decal: 'rect', scheme: 'green', laminate: 'matte', font: 'formal',
           org: 'Division Quiz Bee', title: '2nd Place', name: 'Team Naujan', date: '2026' },
  },
  corporate: {
    label: 'Corporate', hint: 'Service, sales, partner awards',
    cfg: { shape: 'facet', material: 'black', size: 'm', baseKind: 'utilbox', baseFinish: 'silver',
           decal: 'rect', scheme: 'gold', laminate: 'matte', font: 'modern',
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
/* ExtrudeGeometry gives every triangle its own flat normal, so a curved cut
   shows as a row of facets, each catching the light on its own -- the owner
   saw the edges as rough. Where faces meet at less than `crease` degrees they
   share their normals: a curve shades as a curve, while a corner, and the turn
   from the face to its bevel (22.5 degrees with two bevel segments), stays
   crisp. */
function smoothEdges(geo, crease = 14) {
  const pos = geo.attributes.position, n = pos.count;
  const lim = Math.cos(crease * Math.PI / 180);
  const fn = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i + 2 < n; i += 3) {      // as computeVertexNormals: (C - B) x (A - B)
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    c.sub(b).cross(a.sub(b)).normalize();
    for (let k = i * 3; k < i * 3 + 9; k += 3) { fn[k] = c.x; fn[k + 1] = c.y; fn[k + 2] = c.z; }
  }
  const at = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)}|${Math.round(pos.getY(i) * 1e4)}|${Math.round(pos.getZ(i) * 1e4)}`;
    const list = at.get(k);
    if (list) list.push(i); else at.set(k, [i]);
  }
  const out = new Float32Array(n * 3);
  for (const list of at.values()) {
    for (const i of list) {
      let x = 0, y = 0, z = 0;
      for (const j of list) {
        if (fn[i * 3] * fn[j * 3] + fn[i * 3 + 1] * fn[j * 3 + 1] + fn[i * 3 + 2] * fn[j * 3 + 2] >= lim) {
          x += fn[j * 3]; y += fn[j * 3 + 1]; z += fn[j * 3 + 2];
        }
      }
      const L = Math.hypot(x, y, z) || 1;
      out[i * 3] = x / L; out[i * 3 + 1] = y / L; out[i * 3 + 2] = z / L;
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return geo;
}

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
  if (!cut) return { cut, h, bx: 0, foot: 0 };
  const place = () => {
    const pts = pieces(cut).flatMap(r => r.getPoints(160));
    const ys = pts.map(p => p.y);
    const bot = Math.min(...ys), span = Math.max(...ys) - bot;
    // the feet: the tab and the soles on it, the bottom 3% of the piece
    const feet = pts.filter(p => p.y <= bot + span * 0.03).map(p => p.x);
    const mid = (Math.min(...feet) + Math.max(...feet)) / 2;
    const xs = pts.map(p => p.x);
    return { mid, foot: (Math.max(...feet) - Math.min(...feet)) / 2, reach: Math.max(mid - Math.min(...xs), Math.max(...xs) - mid) };
  };
  let at = place();
  const room = baseWidth(w) / 2 - w * FIG_EDGE;
  if (at.reach > room) {
    h *= room / at.reach;          // pathToShape scales about one point, so once is exact
    cut = shape.build(w, h, variant);
    at = place();
  }
  return { cut, h, bx: at.mid, foot: at.foot };
}

/* How tall a trophy really stands, in cm: its size's full height, or less for
   a figure cut smaller to stand inside its base. The size tiles quote the full
   height; the summary, the order sheet and the admin quote this one. */
export function standingHeight(cfg) {
  return withOwnOutline(cfg, () => standingHeightNow(cfg));
}
function standingHeightNow(cfg) {
  const shape = SHAPES[cfg.shape] || SHAPES.arch;
  const size = SIZES[cfg.size] || SIZES.m;
  if (!shape.decal.onBase) return size.total;
  const bh = size.baseH * 1.35;
  return bh + fitFigure(shape, size.w, size.total - bh, cfg.variant).h;
}

export function buildTrophy(cfg) {
  return withOwnOutline(cfg, () => buildTrophyNow(cfg));
}
function buildTrophyNow(cfg) {
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
  let cut, bx = 0, foot = 0, bw = baseWidth(w);
  const figure = onBase;
  if (figure) ({ cut, h, bx, foot } = fitFigure(shape, w, h, cfg.variant));
  else cut = shape.build(w, h, cfg.variant);
  if (cut && !figure) {
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
  const isDesign = !!DESIGNS[cfg.shape];
  if (isDesign) smoothEdges(geo);
  geo.translate(0, 0, -t / 2);
  geo.computeBoundingBox();
  const faceZ = geo.boundingBox.max.z;

  // a design's cut edge is polished (group 1: the sides and bevel); a figure's carries its print
  const blade = new THREE.Mesh(geo, isDesign ? [sheetMaterial(mat), edgeMaterial(mat)] : sheetMaterial(mat));
  blade.castShadow = true;
  blade.receiveShadow = true;
  /* Seated into the base: a figure's mounting tab is exactly h * 0.015 deep
     (TAB in polish-figure.py). The bevel swells every edge by `bevel`, the
     top of the tab included, so it sinks that much more. And polish-figure.py
     sets whatever comes within `band` (0.4% of the height) of the ground line
     down onto it, so a toe or a hem that nearly touches stands on a shelf that
     deep: a light strip showed beside the Lady's shoe, along the gown's hem and
     behind the runner's back toe until the figure sank by that much as well. */
  blade.position.y = baseTop - h * 0.015 - (figure ? h * 0.0045 + bevel * 1.5 : 0);
  /* The owner can slide a figure along its base (a piece made from a picture,
     Admin Deck, 6 Nov: "move it to side ... recenter"): `shift` -1..1 takes
     its feet from one end of the base to the other, never off it. 0: centred. */
  const slide = figure ? Math.max(-1, Math.min(1, +cfg.shift || 0)) * Math.max(0, bw / 2 - foot - w * 0.05) : 0;
  const px = slide - bx;
  blade.position.x = px;                    // the feet on the centre line, or where they were slid to
  blade.name = 'blade';
  group.add(blade);

  /* A design's layers: each cut from its own 3 mm sheet and laid on the front,
     a level-2 layer on a level-1 one. */
  const layers = layerShapes(cfg.shape, w, h);
  const tl = t * 0.5;
  const lift = level => level * (tl + 0.002);
  const design = DESIGNS[cfg.shape];
  const finish = design?.art ? artTexture(design.art) : null;
  layers.forEach((L, i) => {
    const ab = Math.min(0.03, tl * 0.12);
    const lg = smoothEdges(safeExtrude(pieces(L.shape), { depth: tl, bevelEnabled: true, bevelThickness: ab,
      bevelSize: ab, bevelOffset: 0, bevelSegments: 2, curveSegments: 36 }));
    let skin = layerMaterial(L.mat, cfg.material);
    if (finish) {
      // the printed finish, through the design's frame: caps (group 0) print, the cut edges stay sheet
      const { k: fk, cx: fcx, maxY: fmax } = L.shape.userData.frame;
      const [ax0, ay0, ax1, ay1] = design.art.box;
      const P = lg.attributes.position, U = lg.attributes.uv;
      for (let j = 0; j < P.count; j++) {
        const px = P.getX(j) / fk + fcx, py = fmax - P.getY(j) / fk;
        U.setXY(j, (px - ax0) / (ax1 - ax0), 1 - (py - ay0) / (ay1 - ay0));
      }
      U.needsUpdate = true;
      skin = [capMaterial(design.layers[i]?.fin, finish), skin];
    }
    const m = new THREE.Mesh(lg, skin);
    m.position.set(px, blade.position.y, faceZ + 0.002 + lift(L.level - 1));
    m.castShadow = true;
    m.name = 'layer' + i;
    group.add(m);
  });

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
      map: artTexture(art, cfg.outfit), transparent: true, alphaTest: 0.5, roughness: 0.3, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    colour.position.set(px, blade.position.y, faceZ + 0.003);
    colour.name = 'figurePrint';
    group.add(colour);
    /* The blade's bevel and sides carry the picture too, through the same frame,
       so a printed figure has no pale outline of bare sheet round it: the owner
       saw one and read it as background left on the picture. The print runs past
       the cut (BLEED in polish-figure.py) to cover them. The back stays sheet.
       A print with a clear border round it (`clear`, owner 8 Nov) leaves them bare. */
    const BP = art.clear ? null : geo.attributes.position, BU = geo.attributes.uv;
    if (BP) {
      for (let i = 0; i < BP.count; i++) {
        const px = BP.getX(i) / fk + fcx, py = fmax - BP.getY(i) / fk;
        BU.setXY(i, (px - ax0) / (ax1 - ax0), 1 - (py - ay0) / (ay1 - ay0));
      }
      BU.needsUpdate = true;
      blade.material = [blade.material, new THREE.MeshPhysicalMaterial({
        map: artTexture(art, cfg.outfit), roughness: 0.4, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2,
      })];
    }
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
    print.position.set(px, blade.position.y, faceZ + 0.003);
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
    artMesh.position.set(px, blade.position.y + (h - ah) / 2, faceZ + 0.004);
    artMesh.name = 'figurePhoto';
    group.add(artMesh);
  }

  /* "Your art" cut from the customer's picture, with the picture printed on
     it (print-and-cut). cutout.js crops the picture to exactly the traced
     outline's box, so mapping the texture through the cut's own bounding box
     lines picture and edge up; the background is transparent, and alphaTest
     drops it, so nothing prints past the cut. */
  const shopPrint = shopArt(cfg);              // a shop trophy made from a picture: its stored cut-out
  if (cfg.shape === 'custom' && cfg.cutPrint && (cfg.cutArt || shopPrint)) {
    const artGeo = safeExtrude(pieces(shape.build(w, h, cfg.variant)), {
      depth: 0.03, bevelEnabled: false, curveSegments: 24,
    });
    artGeo.computeBoundingBox();
    const bb = artGeo.boundingBox;
    const tex = cfg.cutArt ? new THREE.CanvasTexture(cfg.cutArt) : new THREE.Texture(shopPrint.img || undefined);
    if (!cfg.cutArt && shopPrint.img) tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1 / (bb.max.x - bb.min.x), 1 / (bb.max.y - bb.min.y));
    tex.offset.set(-bb.min.x * tex.repeat.x, -bb.min.y * tex.repeat.y);
    const printed = new THREE.Mesh(artGeo, new THREE.MeshPhysicalMaterial({
      map: tex, transparent: true, alphaTest: 0.5, roughness: 0.28, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.0,
    }));
    printed.position.set(px, blade.position.y, faceZ + 0.004);
    printed.name = 'cutPrint';
    if (shopPrint && !shopPrint.img) {        // shown when the stored picture has loaded (viewers redraw on tala:art)
      printed.visible = false;
      shopPrint.waiting.push(() => { tex.image = shopPrint.img; tex.needsUpdate = true; printed.visible = true; });
    }
    group.add(printed);
  }

  /* sticker — on the blade, or on the base front for the figures */
  const d = shape.decal;
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
    // on a design, on top of the layer it sits on
    pos = new THREE.Vector3(w * 2 * (P.x ?? d.x ?? 0), blade.position.y + h * (P.y ?? d.y), faceZ - 0.004 + lift(d.level || 0));
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
    /* on a design the face is the layer the sticker sits on, and the layers
       above it are what it must stay off */
    const on = d.on >= 0 ? layers[d.on] : null;
    const faceShape = on ? on.shape : cut;
    const above = layers.filter(L => L.level > (d.level || 0)).map(L => L.shape);
    group.userData.face = {
      poly: ring(faceShape.getPoints(64)),
      holes: (faceShape.holes || []).map(hh => ring(hh.getPoints(32))),
      accents: above.map(a => ring(a.getPoints(48))),
      accentHoles: above.flatMap(a => (a.holes || []).map(hh => ring(hh.getPoints(48)))),   // a rim's middle is bare
      z: faceZ + lift(d.level || 0), w, h, by,
      box: d,                                   // the design's own sticker box
      base: { w: w * 2 * d.w, h: h * d.h },     // sticker size at s = 1
    };
  }

  group.userData.height = baseTop + h;
  /* `at` and `frame`, for the flat sticker (sticker.js): the wording's centre
     and turn on the blade, from its foot, and the cut's frame from pathToShape */
  group.userData.dims = { w, h, t, dw, dh, total: size.total, aspect: dw / dh,
    at: d.onBase ? null : { x: pos.x, y: pos.y - blade.position.y, r: cfg.place?.r || 0 },
    frame: cut?.userData?.frame || null };
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
  // a change to or from wording printed on the acrylic: the sticker shows or goes
  const pr = printed(plateCfg(cfg));
  face.transparent = pr;
  face.depthWrite = !pr;
  face.needsUpdate = true;
  if (mats[1]) {
    mats[1].transparent = pr;
    mats[1].opacity = pr ? 0 : 1;
    mats[1].depthWrite = !pr;
    mats[1].needsUpdate = true;
  }
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
