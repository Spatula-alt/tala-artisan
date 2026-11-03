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
    body: `M211.0 0.0 L5.0 0.0 L2.6 0.6 L0.8 2.2 L0.0 5.0 L0.0 295.0 L0.6 297.4 L2.2 299.2 L5.0 300.0 L211.0 300.0 L213.4 299.4 L215.2 297.8 L216.0 295.0 L216.0 5.0 L215.6 3.1 L214.5 1.5 L212.9 0.4 Z`,
    layers: [
      { d: `M207.0 291.0 L207.0 9.0 L9.0 9.0 L9.0 291.0 Z M203.5 287.5 L12.5 287.5 L12.5 12.5 L203.5 12.5 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M193.0 96.0 L200.0 101.0 L190.0 60.0 L179.0 62.0 L187.0 104.0 Z M162.0 96.0 L168.0 104.0 L176.0 62.0 L165.0 60.0 L155.0 101.0 Z`, mat: 'green', level: 1, fin: 'gloss' },
      { d: `M197.0 53.4 L196.5 49.7 L195.3 46.2 L193.4 42.9 L191.0 40.1 L188.0 37.9 L184.7 36.2 L181.1 35.3 L177.4 35.0 L173.7 35.5 L170.2 36.7 L166.9 38.6 L164.1 41.0 L161.9 44.0 L160.2 47.3 L159.3 50.9 L159.0 54.6 L159.5 58.3 L160.7 61.8 L162.6 65.1 L165.0 67.9 L168.0 70.1 L171.3 71.8 L174.9 72.7 L178.6 73.0 L182.3 72.5 L185.8 71.3 L189.1 69.4 L191.9 67.0 L194.1 64.0 L195.8 60.7 L196.7 57.1 Z`, mat: 'gold', level: 2, fin: 'gloss' },
      { d: `M182.5 269.6 L201.5 269.6 L192.0 253.1 Z M171.5 250.1 L190.5 250.1 L181.0 233.5 Z M160.5 269.6 L179.5 269.6 L170.0 253.1 Z M170.0 214.0 L160.5 230.5 L179.5 230.5 Z M149.5 250.1 L168.5 250.1 L159.0 233.5 Z M148.0 253.1 L138.5 269.6 L157.5 269.6 Z`, mat: 'green', level: 1, fin: 'foil' }
    ],
    face: { x: -0.094, y: 0.567, w: 0.525, h: 0.535, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/plaque.781b1df8.webp", "box": [-6.0, -6.0, 222.22, 306.01]}, tile: "img/designs/tile-plaque.b445d88e.webp",
  },
  monolith: {
    name: "Crystal", group: 'Classic', sheet: 'clear', base: 0.96,
    note: "A clear block with a slanted top, a frosted window and a silver emblem.",
    body: `M1.8 17.6 L0.7 18.1 L0.0 19.6 L0.3 299.1 L2.0 300.0 L169.2 299.7 L170.1 298.0 L169.8 0.9 L167.9 0.0 Z`,
    layers: [
      { d: `M157.1 287.0 L157.1 14.2 L13.0 29.5 L13.0 287.0 Z`, mat: 'frost', level: 1, fin: 'frost' },
      { d: `M64.8 68.5 L65.0 69.4 L65.8 69.8 L104.3 69.8 L105.0 69.5 L105.3 68.9 L85.9 35.3 L85.2 34.8 L84.2 35.3 Z`, mat: 'silver', level: 2, fin: 'foil' }
    ],
    face: { x: -0.004, y: 0.409, w: 0.537, h: 0.547, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/monolith.d9ecf8f3.webp", "box": [-6.0, -6.0, 176.23, 306.02]}, tile: "img/designs/tile-monolith.17ff2e86.webp",
  },
  tablet: {
    name: "Tablet", group: 'Classic', sheet: 'clear', base: 0.96,
    note: "An upright tablet, one corner rounded: a navy ring medallion and a stair of navy squares.",
    body: `M31.0 0.0 L25.8 0.6 L19.8 2.4 L15.1 4.8 L10.1 8.6 L6.6 12.5 L3.3 17.8 L1.1 23.7 L0.2 28.9 L0.0 300.0 L190.0 300.0 L190.0 0.0 Z`,
    layers: [
      { d: `M176.9 50.0 L175.9 44.0 L173.8 38.3 L170.6 33.1 L166.4 28.7 L161.5 25.2 L156.0 22.6 L150.0 21.3 L144.0 21.1 L138.0 22.1 L132.3 24.2 L127.1 27.4 L122.7 31.6 L119.2 36.5 L116.6 42.0 L115.3 48.0 L115.1 54.0 L116.1 60.0 L118.2 65.7 L121.4 70.9 L125.6 75.3 L130.5 78.8 L136.0 81.4 L142.0 82.7 L148.0 82.9 L154.0 81.9 L159.7 79.8 L164.9 76.6 L169.3 72.4 L172.8 67.5 L175.4 62.0 L176.7 56.0 Z M169.9 53.6 L169.2 58.2 L167.5 62.6 L165.0 66.6 L161.8 70.0 L158.0 72.8 L153.7 74.7 L149.1 75.8 L144.4 75.9 L139.8 75.2 L135.4 73.5 L131.4 71.0 L128.0 67.8 L125.2 64.0 L123.3 59.7 L122.2 55.1 L122.1 50.4 L122.8 45.8 L124.5 41.4 L127.0 37.4 L130.2 34.0 L134.0 31.2 L138.3 29.3 L142.9 28.2 L147.6 28.1 L152.2 28.8 L156.6 30.5 L160.6 33.0 L164.0 36.2 L166.8 40.0 L168.7 44.3 L169.8 48.9 Z`, mat: 'navy', level: 1, fin: 'gloss' },
      { d: `M167.0 51.3 L166.5 47.2 L165.1 43.3 L163.1 39.8 L160.4 36.7 L157.1 34.2 L153.4 32.3 L149.4 31.3 L145.3 31.0 L141.2 31.5 L137.3 32.9 L133.8 34.9 L130.7 37.6 L128.2 40.9 L126.3 44.6 L125.3 48.6 L125.0 52.7 L125.5 56.8 L126.9 60.7 L128.9 64.2 L131.6 67.3 L134.9 69.8 L138.6 71.7 L142.6 72.7 L146.7 73.0 L150.8 72.5 L154.7 71.1 L158.2 69.1 L161.3 66.4 L163.8 63.1 L165.7 59.4 L166.7 55.4 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M113.0 283.0 L140.0 283.0 L140.0 258.0 L113.0 258.0 Z M117.5 278.5 L117.5 262.5 L135.5 262.5 L135.5 278.5 Z M80.0 283.0 L107.0 283.0 L107.0 258.0 L80.0 258.0 Z M84.5 278.5 L84.5 262.5 L102.5 262.5 L102.5 278.5 Z M80.0 228.0 L80.0 253.0 L107.0 253.0 L107.0 228.0 Z M102.5 248.5 L84.5 248.5 L84.5 232.5 L102.5 232.5 Z M47.0 253.0 L74.0 253.0 L74.0 228.0 L47.0 228.0 Z M51.5 248.5 L51.5 232.5 L69.5 232.5 L69.5 248.5 Z M47.0 198.0 L47.0 223.0 L74.0 223.0 L74.0 198.0 Z M69.5 218.5 L51.5 218.5 L51.5 202.5 L69.5 202.5 Z M47.0 258.0 L47.0 283.0 L74.0 283.0 L74.0 258.0 Z M69.5 278.5 L51.5 278.5 L51.5 262.5 L69.5 262.5 Z M14.0 253.0 L41.0 253.0 L41.0 228.0 L14.0 228.0 Z M18.5 248.5 L18.5 232.5 L36.5 232.5 L36.5 248.5 Z M14.0 168.0 L14.0 193.0 L41.0 193.0 L41.0 168.0 Z M36.5 188.5 L18.5 188.5 L18.5 172.5 L36.5 172.5 Z M14.0 198.0 L14.0 223.0 L41.0 223.0 L41.0 198.0 Z M36.5 218.5 L18.5 218.5 L18.5 202.5 L36.5 202.5 Z M14.0 258.0 L14.0 283.0 L41.0 283.0 L41.0 258.0 Z M36.5 278.5 L18.5 278.5 L18.5 262.5 L36.5 262.5 Z`, mat: 'navy', level: 1, fin: 'gloss' }
    ],
    face: { x: 0.159, y: 0.508, w: 0.394, h: 0.376, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/tablet.4ba11587.webp", "box": [-6.0, -6.0, 196.15, 306.01]}, tile: "img/designs/tile-tablet.a2520ff6.webp",
  },
  crownpanel: {
    name: "Crown Panel", group: 'Classic', sheet: 'navy', base: 1.00,
    note: "A barrel-sided navy panel: a white inner panel, three gold stars on the crown band, a hexagon at the foot.",
    body: `M13.2 270.0 L25.1 299.1 L26.2 300.0 L176.7 299.5 L177.9 298.9 L190.8 270.0 L200.7 228.9 L205.7 178.8 L205.7 129.1 L204.0 79.3 L197.4 33.1 L185.4 0.3 L30.5 2.0 L29.3 2.6 L14.9 33.3 L5.0 79.6 L1.7 129.1 L0.0 179.1 L5.0 228.6 Z`,
    layers: [
      { d: `M23.9 267.0 L32.8 289.0 L170.5 288.5 L180.3 266.6 L189.8 226.9 L194.7 178.3 L194.7 129.4 L193.0 80.3 L189.2 53.8 L21.7 53.8 L15.9 81.0 L12.6 129.7 L11.0 178.7 L15.9 227.0 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M159.3 31.5 L156.9 40.3 L164.5 35.3 L172.2 40.3 L169.8 31.5 L176.9 25.8 L167.8 25.4 L164.5 16.8 L161.3 25.4 L152.2 25.8 Z M89.5 21.5 L97.1 27.7 L94.6 37.2 L102.8 31.8 L111.1 37.2 L108.5 27.7 L116.2 21.5 L106.4 21.0 L102.8 11.8 L99.3 21.0 Z M35.9 31.5 L33.5 40.3 L41.1 35.3 L48.8 40.3 L46.4 31.5 L53.5 25.8 L44.4 25.4 L41.1 16.8 L37.9 25.4 L28.8 25.8 Z`, mat: 'gold', level: 1, fin: 'glitter' },
      { d: `M87.8 220.0 L72.8 246.0 L87.8 272.0 L117.8 272.0 L132.9 246.0 L117.8 220.0 Z M91.9 265.0 L80.9 246.0 L91.9 227.0 L113.8 227.0 L124.8 246.0 L113.8 265.0 Z`, mat: 'navy', level: 2, fin: 'gloss' },
      { d: `M115.8 245.6 L114.7 240.6 L111.7 236.5 L107.4 233.8 L102.4 233.0 L97.5 234.1 L93.3 237.1 L90.7 241.4 L89.8 246.4 L91.0 251.4 L93.9 255.5 L98.3 258.2 L103.3 259.0 L108.2 257.8 L112.3 254.9 L115.0 250.6 Z`, mat: 'frost', level: 2, fin: 'frost' }
    ],
    face: { x: -0.048, y: 0.54, w: 0.509, h: 0.486, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/crownpanel.ac3d7bc4.webp", "box": [-5.99, -5.73, 211.68, 305.99]}, tile: "img/designs/tile-crownpanel.96be7b64.webp",
  },
  pentagon: {
    name: "Pentagon", group: 'Classic', sheet: 'clear', base: 1.00,
    note: "A five-sided plaque: a white inner pentagon framed by a fine black rule.",
    body: `M0.5 124.0 L0.1 125.5 L52.8 299.6 L53.8 300.0 L230.4 299.8 L231.6 299.2 L276.9 125.1 L133.5 0.4 L132.4 0.0 L131.1 0.4 Z`,
    layers: [
      { d: `M61.6 288.0 L222.3 287.8 L263.6 129.2 L132.6 15.5 L13.4 128.2 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M216.9 280.8 L255.7 131.7 L132.8 25.0 L21.4 130.4 L66.8 281.0 Z M251.2 133.1 L213.8 276.8 L69.8 276.9 L26.0 131.6 L132.9 30.4 Z`, mat: 'black', level: 2, fin: 'gloss' }
    ],
    face: { x: 0.005, y: 0.381, w: 0.564, h: 0.507, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/pentagon.682648d0.webp", "box": [-5.94, -6.0, 282.93, 306.01]}, tile: "img/designs/tile-pentagon.d7ea9b87.webp",
  },
  arch: {
    name: "Sun Arch", group: 'Classic', sheet: 'navy', base: 1.04,
    note: "An arch in the colours of the flag: a white wave, a red band and the gold sun.",
    body: `M184.0 89.0 L182.2 74.1 L179.1 62.4 L173.1 48.6 L166.8 38.4 L157.1 26.9 L148.0 19.0 L138.0 12.3 L124.4 5.9 L109.9 1.8 L95.0 0.0 L80.0 0.8 L68.2 3.1 L54.0 8.2 L43.4 13.9 L31.3 22.8 L22.8 31.3 L13.9 43.4 L7.0 56.8 L2.4 71.1 L0.4 83.0 L0.0 92.0 L0.0 300.0 L184.0 300.0 Z`,
    layers: [
      { d: `M46.0 12.3 L36.0 19.0 L29.1 24.9 L20.9 33.6 L15.5 40.9 L10.9 48.6 L7.0 56.8 L4.0 65.3 L1.2 77.0 L0.4 83.0 L0.0 92.0 L0.0 300.0 L68.2 300.0 L68.3 283.8 L67.6 275.1 L66.6 266.5 L63.5 249.5 L57.1 224.7 L44.5 183.8 L39.9 167.3 L36.1 150.6 L34.6 142.1 L32.6 124.9 L32.4 107.2 L33.0 98.1 L34.1 88.9 L35.9 79.5 L38.4 69.9 L41.5 60.2 L45.3 50.2 L50.0 40.0 L50.0 10.2 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M183.6 83.0 L182.2 74.1 L180.9 68.2 L177.0 56.8 L171.7 46.0 L168.5 40.9 L163.4 34.0 L162.8 64.3 L163.6 96.7 L165.4 127.6 L170.7 196.6 L172.0 226.0 L172.2 245.9 L171.7 266.3 L170.2 287.2 L168.9 300.0 L184.0 300.0 L184.0 92.0 Z`, mat: 'red', level: 1, fin: 'brush' },
      { d: `M54.5 48.3 L49.6 49.7 L45.1 52.2 L25.5 37.5 L40.2 57.1 L37.7 61.6 L36.3 66.5 L12.0 70.0 L36.3 73.5 L37.7 78.4 L40.2 82.9 L25.5 102.5 L45.1 87.8 L49.6 90.3 L54.5 91.7 L58.0 116.0 L61.5 91.7 L66.4 90.3 L70.9 87.8 L90.5 102.5 L75.8 82.9 L78.3 78.4 L79.7 73.5 L104.0 70.0 L79.7 66.5 L78.3 61.6 L75.8 57.1 L90.5 37.5 L70.9 52.2 L66.4 49.7 L61.5 48.3 L58.0 24.0 Z`, mat: 'gold', level: 2, fin: 'glitter' }
    ],
    face: { x: 0.108, y: 0.332, w: 0.368, h: 0.375, level: 0, on: -1 },
    ink: 'printlight', art: {"src": "img/designs/arch.00def30e.webp", "box": [-6.0, -5.95, 190.29, 306.06]}, tile: "img/designs/tile-arch.7991fdb5.webp",
  },
  shield: {
    name: "Tulip", group: 'Classic', sheet: 'clear', base: 1.02,
    note: "A clear tulip crest with frosted arcs crossing at its foot.",
    body: `M13.7 52.3 L12.6 59.9 L7.7 79.2 L4.3 99.0 L0.0 146.4 L0.0 180.5 L2.7 202.8 L9.0 237.8 L12.7 249.4 L17.0 268.4 L25.9 294.9 L28.6 298.6 L31.5 300.0 L124.4 300.0 L127.3 299.4 L130.8 294.9 L144.1 254.6 L150.5 229.1 L153.8 207.5 L153.8 199.5 L156.8 181.9 L157.1 135.5 L153.8 112.2 L153.8 99.5 L145.8 52.7 L137.8 19.0 L134.6 9.6 L130.6 6.5 L124.5 6.7 L105.3 13.8 L92.7 15.4 L83.7 15.4 L67.3 12.6 L53.4 7.4 L41.3 0.1 L33.7 0.1 L30.3 2.3 L27.0 8.6 L20.0 28.5 L17.6 40.1 Z`,
    layers: [
      { d: `M64.7 235.5 L52.0 227.9 L38.7 221.6 L24.8 216.6 L9.6 212.9 L10.7 219.2 L18.5 221.1 L27.5 223.8 L36.4 227.1 L45.0 231.0 L53.3 235.5 L61.3 240.5 L74.0 250.0 L62.8 261.5 L52.4 253.8 L45.3 249.4 L37.9 245.4 L26.3 240.4 L13.8 236.4 L15.6 242.1 L28.3 246.6 L39.3 251.8 L49.6 258.0 L59.6 265.4 L53.8 272.9 L48.3 281.1 L40.7 295.0 L47.4 295.0 L51.0 288.3 L56.0 280.3 L64.1 269.3 L71.1 276.2 L75.3 280.9 L69.3 289.2 L65.7 295.0 L71.5 295.0 L78.6 284.9 L85.6 295.0 L91.4 295.0 L87.8 289.2 L81.8 280.9 L86.0 276.2 L93.0 269.3 L101.1 280.3 L106.1 288.3 L109.7 295.0 L116.5 295.0 L108.8 281.1 L103.3 272.9 L97.6 265.4 L107.5 258.0 L117.9 251.8 L128.8 246.6 L142.1 242.0 L143.5 236.4 L130.8 240.4 L119.2 245.4 L111.8 249.4 L104.7 253.8 L94.3 261.5 L83.1 250.0 L95.8 240.5 L103.8 235.5 L112.1 231.0 L120.7 227.1 L129.6 223.8 L138.6 221.1 L146.9 219.1 L147.9 212.8 L137.1 215.3 L127.6 218.1 L118.4 221.6 L109.5 225.6 L100.8 230.3 L92.4 235.5 L84.4 241.2 L78.6 246.0 L72.7 241.2 Z M89.7 265.3 L78.6 277.0 L71.9 269.8 L67.3 265.5 L78.6 254.0 Z`, mat: 'frost', level: 1, fin: 'frost' },
      { d: `M14.9 236.4 L18.5 247.8 L22.8 266.7 L31.4 292.4 L32.6 294.0 L123.9 294.0 L125.4 292.3 L138.3 253.0 L144.5 228.0 L147.8 207.0 L147.9 198.5 L150.8 181.4 L151.1 135.8 L147.8 112.6 L147.8 100.1 L139.9 53.9 L132.0 20.6 L129.4 12.9 L128.8 12.5 L125.5 12.7 L106.8 19.6 L93.1 21.4 L84.1 21.4 L65.2 18.3 L50.8 12.8 L39.5 6.0 L35.6 6.0 L34.9 6.4 L32.6 10.9 L25.8 30.2 L23.5 41.7 L19.6 53.7 L18.5 61.1 L13.6 80.4 L10.3 99.7 L6.0 146.8 L6.0 180.3 L8.6 201.8 Z M13.3 100.1 L16.5 81.1 L21.5 61.7 L22.5 54.4 L26.4 42.4 L28.7 31.0 L35.3 12.1 L37.0 9.0 L38.7 9.0 L49.6 15.6 L64.3 21.1 L83.3 24.4 L93.3 24.4 L107.3 22.6 L126.1 15.6 L127.1 15.6 L129.1 21.4 L136.9 54.5 L144.8 100.4 L144.8 112.9 L148.1 136.0 L147.8 181.2 L144.9 198.2 L144.8 206.7 L141.6 227.4 L135.4 252.1 L122.6 291.0 L34.1 291.0 L25.7 265.9 L21.4 247.0 L17.8 235.7 L11.6 201.4 L9.0 180.1 L9.0 146.9 Z`, mat: 'frost', level: 1, fin: 'frost' }
    ],
    face: { x: -0.002, y: 0.559, w: 0.43, h: 0.438, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/shield.5e8f24db.webp", "box": [-6.0, -5.9, 163.34, 306.11]}, tile: "img/designs/tile-shield.fac4a094.webp",
  },
  cat: {
    name: "Diamond Tower", group: 'Classic', sheet: 'white', base: 1.04,
    note: "A tall white panel crowned with a blue diamond, a framed panel in front.",
    body: `M120.3 60.2 L60.2 0.0 L0.0 60.2 L38.9 99.1 L38.9 300.0 L151.1 300.0 L151.1 81.4 L99.1 81.4 Z`,
    layers: [
      { d: `M0.0 60.2 L60.2 120.3 L120.3 60.2 L60.2 0.0 Z M12.3 60.2 L60.2 12.3 L108.0 60.2 L60.2 108.0 Z`, mat: 'blue', level: 1, fin: 'gloss' },
      { d: `M75.6 124.0 L74.3 124.6 L73.7 125.9 L73.9 298.8 L74.6 299.7 L75.6 300.0 L149.9 299.9 L150.8 299.1 L151.1 298.1 L150.9 125.2 L150.2 124.3 L149.1 124.0 Z`, mat: 'blue', level: 1, fin: 'gloss' },
      { d: `M81.4 292.3 L143.3 292.3 L143.3 131.7 L81.4 131.7 Z`, mat: 'white', level: 2, fin: 'panel' }
    ],
    face: { x: 0.106, y: 0.249, w: 0.198, h: 0.252, level: 2, on: 2 },
    ink: 'printdark', art: {"src": "img/designs/cat.1be31511.webp", "box": [-6.0, -6.0, 157.18, 306.01]}, tile: "img/designs/tile-cat.7b9617b9.webp",
  },
  bkwing: {
    name: "Wing Frame", group: 'Classic', sheet: 'clear', base: 1.06,
    note: "A clear gull wing across a black A-frame, a white flag inside it.",
    body: `M0.4 72.3 L0.0 73.8 L0.9 75.2 L31.0 96.5 L56.7 117.5 L58.3 117.3 L69.9 111.4 L82.3 106.4 L90.6 103.9 L92.5 105.0 L92.6 106.6 L57.7 212.5 L57.7 215.4 L58.8 218.1 L60.9 220.2 L63.5 221.3 L65.8 221.5 L68.6 220.6 L70.8 218.8 L72.2 216.4 L110.3 101.2 L111.5 100.3 L115.2 100.0 L116.4 100.3 L117.2 101.2 L89.5 269.7 L90.0 271.4 L91.4 272.0 L189.8 272.0 L192.1 271.4 L193.7 272.5 L194.5 275.4 L194.0 277.4 L192.5 278.0 L87.4 278.1 L85.8 279.0 L85.1 280.8 L85.1 297.0 L85.9 299.0 L88.1 300.0 L216.0 300.0 L218.1 299.2 L219.1 297.0 L219.0 280.2 L217.4 278.3 L212.5 277.9 L211.3 276.4 L170.1 117.6 L170.7 116.4 L175.2 112.2 L187.7 101.8 L199.5 93.3 L212.8 84.8 L227.6 76.5 L243.6 68.8 L260.8 61.9 L276.0 56.8 L277.1 55.3 L276.4 53.6 L265.3 44.5 L249.8 34.1 L232.7 24.9 L214.3 17.3 L199.8 12.5 L184.9 8.7 L164.4 5.3 L140.6 3.8 L136.3 0.7 L132.2 0.0 L128.4 1.5 L125.0 5.0 L104.4 9.2 L82.0 16.3 L63.8 24.0 L50.3 31.0 L32.9 42.0 L20.7 51.5 L9.3 62.2 Z`,
    layers: [
      { d: `M57.6 213.4 L58.0 216.3 L59.0 218.3 L60.9 220.2 L63.5 221.3 L65.8 221.5 L68.3 220.7 L70.7 219.0 L71.9 217.1 L131.9 35.4 L195.2 278.0 L87.6 278.0 L85.9 279.0 L85.1 280.6 L85.2 298.0 L86.3 299.4 L88.1 300.0 L216.0 300.0 L217.7 299.5 L218.8 298.3 L219.1 297.0 L219.0 280.2 L218.3 279.0 L217.0 278.2 L211.7 278.0 L140.8 6.0 L140.0 4.0 L138.9 2.5 L136.1 0.6 L133.0 0.0 L129.9 0.6 L127.4 2.4 L125.7 4.9 L125.1 8.2 Z`, mat: 'black', level: 1, fin: 'gloss' },
      { d: `M89.1 272.0 L190.5 272.0 L143.6 92.0 L119.1 92.0 Z`, mat: 'white', level: 1, fin: 'panel' }
    ],
    face: { x: 0.002, y: 0.23, w: 0.219, h: 0.209, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/bkwing.66c95cb2.webp", "box": [-5.98, -6.0, 283.18, 306.01]}, tile: "img/designs/tile-bkwing.d2817210.webp",
  },
  crowncrest: {
    name: "Crown Crest", group: 'Classic', sheet: 'white', base: 1.08,
    note: "A white crest under a gold crown, framed in navy.",
    body: `M118.8 7.3 L117.0 2.9 L113.3 0.4 L108.7 0.3 L104.7 2.7 L103.0 5.7 L102.8 9.1 L103.9 12.3 L106.1 14.7 L78.5 54.4 L52.2 28.0 L54.3 25.9 L55.3 23.1 L55.1 20.1 L53.6 17.5 L51.6 15.9 L49.2 15.2 L46.9 15.2 L44.6 16.2 L41.8 19.5 L41.5 23.7 L43.7 27.4 L47.6 29.2 L41.2 72.5 L4.9 72.6 L1.8 74.3 L0.5 76.2 L0.0 78.5 L0.0 213.1 L1.0 221.5 L3.3 228.9 L7.0 236.2 L11.8 243.4 L17.4 250.1 L24.6 257.3 L40.1 270.0 L49.1 276.1 L67.3 286.7 L85.4 295.3 L97.6 300.0 L123.5 300.0 L139.6 294.0 L155.6 287.3 L174.5 278.5 L195.7 267.6 L197.4 265.5 L220.9 214.6 L221.5 212.1 L221.5 78.5 L221.0 76.2 L218.8 73.5 L215.4 72.5 L180.3 72.5 L173.9 29.2 L176.5 28.4 L178.6 26.6 L179.9 24.2 L180.2 21.5 L178.6 17.7 L175.0 15.3 L171.1 15.4 L167.7 17.7 L166.3 20.3 L166.2 23.3 L167.3 26.1 L169.3 28.0 L143.0 54.4 L115.3 14.7 L118.1 11.4 Z`,
    layers: [
      { d: `M6.0 212.9 L6.8 220.0 L8.8 226.4 L11.9 232.7 L16.6 239.6 L22.1 246.3 L28.6 252.8 L35.9 259.1 L43.7 265.1 L61.0 276.3 L79.1 285.9 L88.0 289.8 L98.6 294.0 L122.4 294.0 L137.4 288.4 L153.1 281.8 L171.9 273.1 L191.6 263.1 L215.4 212.1 L215.4 78.6 L6.1 78.6 Z M208.4 210.5 L186.5 257.8 L168.7 266.8 L150.2 275.3 L122.7 286.4 L121.3 286.9 L99.8 286.9 L90.7 283.3 L73.3 275.1 L56.1 265.0 L47.9 259.4 L40.3 253.6 L33.4 247.6 L27.3 241.4 L22.1 235.3 L18.1 229.3 L15.3 223.6 L13.7 218.3 L13.1 212.7 L13.1 85.6 L208.4 85.6 Z`, mat: 'navy', level: 1, fin: 'gloss' },
      { d: `M173.9 29.2 L176.5 28.4 L178.6 26.6 L179.9 24.2 L180.2 21.5 L179.4 18.8 L177.6 16.7 L175.2 15.4 L172.5 15.1 L170.5 15.6 L168.5 16.8 L167.2 18.4 L166.3 20.5 L166.1 22.6 L166.6 24.8 L167.7 26.6 L169.3 28.0 L143.0 54.4 L115.3 14.7 L117.4 12.5 L118.6 9.6 L118.7 6.7 L117.6 3.8 L116.0 2.0 L113.8 0.6 L111.3 0.0 L108.7 0.3 L106.7 1.1 L104.9 2.5 L103.5 4.5 L102.8 6.7 L102.8 9.1 L103.3 11.1 L104.5 13.2 L106.1 14.7 L78.5 54.4 L52.2 28.0 L54.2 26.1 L55.3 23.3 L55.1 20.3 L53.8 17.7 L52.2 16.3 L50.1 15.3 L48.1 15.1 L45.8 15.6 L44.0 16.6 L42.7 17.9 L41.8 19.5 L41.3 21.5 L41.6 24.2 L42.9 26.6 L45.0 28.4 L47.6 29.2 L40.3 78.5 L181.2 78.5 Z`, mat: 'gold', level: 1, fin: 'foil' }
    ],
    face: { x: -0.054, y: 0.45, w: 0.492, h: 0.47, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/crowncrest.70b58455.webp", "box": [-6.0, -5.98, 227.5, 306.03]}, tile: "img/designs/tile-crowncrest.80f545af.webp",
  },
  cup: {
    name: "Trophy Cup", group: 'Classic', sheet: 'gold', base: 1.10,
    note: "A gold cup with handles, a white plaque on its bowl.",
    body: `M49.2 0.0 L47.7 0.6 L47.1 1.7 L46.6 18.1 L45.9 19.8 L44.3 20.4 L38.8 19.4 L32.8 19.5 L27.0 20.9 L22.5 22.9 L18.2 25.6 L13.3 30.0 L9.8 34.2 L6.1 40.3 L3.3 46.9 L1.6 52.7 L0.0 64.9 L0.9 77.1 L4.3 88.6 L8.3 96.4 L13.3 102.9 L19.3 108.0 L25.9 111.6 L32.8 113.3 L40.0 113.3 L47.0 111.5 L54.4 107.7 L56.3 108.2 L60.7 121.2 L68.4 139.1 L72.9 147.1 L82.6 160.9 L87.9 166.7 L99.1 176.6 L111.0 183.9 L117.5 186.8 L127.0 190.0 L128.2 191.7 L122.1 247.5 L120.1 248.6 L75.3 248.6 L73.1 249.3 L72.1 250.9 L57.2 295.7 L57.5 298.5 L58.6 299.6 L60.3 300.0 L226.9 300.0 L228.5 299.6 L230.0 297.9 L230.0 295.7 L215.1 250.9 L214.0 249.3 L211.9 248.6 L167.0 248.6 L165.1 247.5 L159.0 191.7 L160.1 190.0 L169.7 186.8 L176.1 183.9 L188.0 176.6 L199.3 166.7 L204.5 160.9 L214.2 147.1 L218.7 139.1 L226.4 121.2 L230.9 108.2 L233.2 107.8 L239.0 111.1 L244.8 113.0 L250.7 113.6 L255.5 113.2 L261.3 111.5 L266.9 108.7 L272.0 104.7 L276.5 99.8 L280.3 93.9 L283.9 85.9 L285.9 78.6 L287.1 69.5 L286.8 60.3 L285.6 52.7 L282.9 44.2 L279.6 37.7 L276.5 33.1 L272.0 28.1 L267.9 24.8 L263.5 22.3 L258.9 20.5 L254.2 19.5 L248.4 19.4 L242.8 20.4 L241.2 19.8 L240.5 18.1 L240.0 1.7 L238.3 0.0 Z M235.3 92.1 L234.8 90.1 L237.2 75.8 L238.8 62.3 L240.5 36.1 L242.9 34.2 L247.5 32.5 L251.9 32.2 L256.0 33.1 L261.2 35.9 L265.7 40.2 L269.6 46.1 L272.1 52.3 L273.7 59.2 L274.3 66.5 L273.5 74.8 L271.7 81.7 L269.1 87.7 L265.1 93.4 L260.5 97.5 L255.2 100.0 L250.0 100.7 L244.8 99.5 L239.6 96.5 Z M45.8 35.1 L46.8 36.9 L48.3 62.4 L52.3 91.1 L48.9 95.4 L43.7 99.0 L39.0 100.5 L33.8 100.5 L29.2 99.0 L24.6 95.9 L20.3 91.2 L17.1 85.7 L14.7 79.4 L13.2 72.4 L12.9 65.2 L13.6 58.0 L15.4 51.2 L18.6 44.3 L22.1 39.4 L26.5 35.5 L31.3 33.0 L36.4 32.1 L41.0 32.8 Z`,
    layers: [
      { d: `M90.0 27.9 L85.9 28.7 L83.2 30.3 L80.6 33.5 L79.3 37.5 L79.3 124.3 L79.7 127.4 L80.6 129.3 L83.2 132.6 L86.9 134.5 L90.0 135.0 L197.1 135.0 L201.2 134.2 L203.1 133.2 L205.4 131.1 L207.0 128.4 L207.9 124.3 L207.9 38.6 L207.7 36.5 L206.6 33.5 L203.9 30.3 L201.2 28.7 L197.1 27.9 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M57.4 21.4 L57.5 10.7 L229.6 10.7 L229.8 21.4 L234.1 21.4 L233.8 6.4 L53.4 6.4 L53.1 21.4 Z`, mat: 'black', level: 1, fin: 'gloss' }
    ],
    face: { x: -0.0, y: 0.729, w: 0.456, h: 0.29, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/cup.94fe56a8.webp", "box": [-5.98, -6.0, 293.14, 306.01]}, tile: "img/designs/tile-cup.1b92bc71.webp",
  },
  chevron: {
    name: "Chevron Shield", group: 'Classic', sheet: 'navy', base: 1.06,
    note: "A navy shield: a white field and gold chevrons.",
    body: `M4.1 0.1 L1.5 1.5 L0.4 3.1 L0.0 5.1 L0.0 143.0 L0.5 156.5 L2.1 169.4 L4.5 181.7 L7.7 193.0 L11.7 204.1 L16.5 214.6 L21.8 224.6 L34.0 242.8 L47.8 258.9 L62.6 273.1 L77.6 285.0 L92.1 294.8 L100.8 300.0 L123.6 300.0 L139.5 290.2 L154.6 279.1 L169.5 266.2 L183.6 251.4 L196.6 234.3 L202.7 224.6 L208.0 214.6 L212.6 204.4 L216.7 193.3 L220.0 181.7 L222.4 169.4 L224.0 156.1 L224.5 142.8 L224.5 5.1 L224.1 3.1 L222.2 0.9 L219.4 0.0 Z`,
    layers: [
      { d: `M10.2 142.7 L10.7 155.5 L12.1 167.6 L14.4 179.1 L17.5 190.0 L21.3 200.4 L25.7 210.3 L30.7 219.6 L36.2 228.4 L42.2 236.8 L48.6 244.6 L55.2 252.0 L62.1 258.9 L76.4 271.2 L90.6 281.7 L103.6 289.8 L120.9 289.8 L126.9 286.2 L141.0 276.7 L155.3 265.3 L169.3 252.0 L175.9 244.6 L182.3 236.8 L188.3 228.4 L193.8 219.6 L198.8 210.3 L203.2 200.4 L207.0 190.0 L210.1 179.1 L212.4 167.6 L213.8 155.5 L214.3 142.7 L214.3 10.2 L10.2 10.2 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M110.8 247.8 L113.7 247.8 L116.3 246.7 L198.0 189.5 L199.9 187.5 L200.9 184.9 L200.9 182.1 L199.7 179.6 L198.5 178.2 L196.0 176.9 L193.3 176.6 L190.6 177.3 L112.2 232.1 L33.9 177.3 L31.2 176.6 L28.5 176.9 L26.0 178.2 L24.8 179.6 L23.6 182.1 L23.6 184.9 L24.6 187.5 L26.5 189.5 L108.1 246.7 Z M110.7 273.3 L113.8 273.3 L115.8 272.3 L183.2 223.3 L184.8 221.6 L185.6 219.3 L185.5 216.9 L184.5 214.8 L183.4 213.6 L181.3 212.5 L178.9 212.3 L176.7 213.0 L112.2 259.8 L48.5 213.4 L47.1 212.7 L44.7 212.2 L42.4 212.8 L40.5 214.2 L39.2 216.2 L38.8 218.5 L39.3 220.9 L40.7 222.8 L108.6 272.3 Z`, mat: 'gold', level: 2, fin: 'foil' }
    ],
    face: { x: -0.108, y: 0.69, w: 0.501, h: 0.478, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/chevron.6bcca2a6.webp", "box": [-6.0, -6.0, 230.72, 306.01]}, tile: "img/designs/tile-chevron.3fdab103.webp",
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
    ink: 'printdark', art: {"src": "img/designs/hexagon.f867ac7c.webp", "box": [-6.0, -6.0, 352.59, 306.01]}, tile: "img/designs/tile-hexagon.d618c240.webp",
  },
  diamond: {
    name: "Diamond", group: 'Classic', sheet: 'clear', base: 1.04,
    note: "A clear diamond on its point: sky blue and white diamonds laid in it.",
    body: `M0.2 152.8 L0.5 155.7 L90.7 300.0 L116.8 300.0 L207.0 155.7 L207.4 154.0 L206.9 152.3 L106.3 1.4 L105.5 0.5 L103.7 0.0 L102.0 0.5 L101.1 1.4 Z`,
    layers: [
      { d: `M97.0 288.5 L110.4 288.5 L194.4 154.2 L103.7 18.2 L13.1 154.2 Z`, mat: 'sky', level: 1, fin: 'gloss' },
      { d: `M102.8 278.1 L104.6 278.1 L182.0 154.3 L103.7 37.0 L25.5 154.3 Z`, mat: 'white', level: 2, fin: 'panel' }
    ],
    face: { x: -0.0, y: 0.482, w: 0.318, h: 0.304, level: 2, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/diamond.227ca341.webp", "box": [-5.76, -6.0, 213.68, 306.01]}, tile: "img/designs/tile-diamond.194ad00f.webp",
  },
  risingsun: {
    name: "Rising Sun", group: 'Classic', sheet: 'white', base: 1.06,
    note: "A white arch with a gold sun rising from its foot.",
    body: `M199.9 96.7 L198.1 80.5 L194.7 67.9 L189.7 55.8 L181.3 41.8 L170.7 29.3 L160.9 20.7 L150.0 13.4 L138.3 7.6 L122.7 2.6 L109.8 0.5 L96.7 0.1 L80.5 1.9 L64.8 6.4 L52.9 11.8 L39.1 20.7 L29.3 29.3 L18.7 41.8 L10.3 55.8 L6.4 64.8 L3.4 74.1 L0.5 90.2 L0.0 100.0 L0.0 300.0 L200.0 300.0 Z`,
    layers: [
      { d: `M192.0 290.3 L192.0 277.1 L132.1 292.0 L176.1 292.0 Z M175.6 196.0 L105.8 292.0 L107.7 292.0 L192.0 204.7 L192.0 196.0 Z M111.9 292.0 L116.4 292.0 L192.0 255.1 L192.0 237.9 Z M103.6 292.0 L146.3 196.0 L129.8 196.0 L102.3 292.0 Z M100.6 292.0 L107.3 196.0 L92.7 196.0 L99.4 292.0 Z M97.7 292.0 L70.2 196.0 L53.7 196.0 L96.4 292.0 Z M92.3 292.0 L94.2 292.0 L24.4 196.0 L8.0 196.0 L8.0 204.7 Z M83.6 292.0 L88.1 292.0 L8.0 237.9 L8.0 255.1 Z M8.0 277.1 L8.0 290.3 L23.9 292.0 L67.9 292.0 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M154.0 300.0 L153.3 291.2 L152.2 286.0 L150.5 281.0 L148.4 276.1 L145.9 271.5 L142.8 267.1 L139.4 263.1 L135.6 259.4 L131.5 256.1 L127.0 253.2 L122.3 250.8 L117.4 248.9 L112.3 247.4 L107.0 246.5 L98.2 246.0 L93.0 246.5 L87.7 247.4 L79.3 250.1 L74.5 252.4 L70.0 255.1 L65.7 258.3 L61.8 261.8 L58.3 265.7 L55.1 270.0 L52.4 274.5 L50.1 279.3 L48.3 284.3 L47.0 289.5 L46.3 294.7 L46.0 300.0 Z`, mat: 'gold', level: 2, fin: 'foil' },
      { d: `M193.5 90.8 L191.5 78.7 L190.0 72.7 L186.8 64.0 L181.4 53.0 L174.6 42.8 L170.7 38.0 L164.3 31.4 L154.8 23.6 L149.6 20.2 L141.6 15.7 L130.2 11.0 L118.3 7.8 L112.3 6.8 L103.1 6.1 L90.8 6.5 L78.7 8.5 L66.9 12.0 L61.2 14.4 L53.0 18.6 L47.8 21.8 L40.4 27.3 L31.4 35.7 L25.4 42.8 L21.8 47.8 L18.6 53.0 L14.4 61.2 L11.0 69.8 L9.2 75.7 L7.8 81.7 L6.5 90.8 L6.0 100.0 L6.0 294.0 L194.0 294.0 L194.0 100.0 Z M191.0 291.0 L9.0 291.0 L9.0 100.1 L9.4 91.1 L10.7 82.2 L13.8 70.7 L17.1 62.4 L21.2 54.5 L27.8 44.6 L33.6 37.8 L42.3 29.7 L51.9 22.7 L59.8 18.4 L67.9 14.8 L76.4 12.1 L85.2 10.2 L94.0 9.2 L103.0 9.0 L111.9 9.8 L120.7 11.4 L129.3 13.8 L137.6 17.1 L145.5 21.2 L153.0 26.0 L160.0 31.6 L166.4 37.8 L172.2 44.6 L177.3 51.9 L181.6 59.8 L185.2 67.9 L188.6 79.3 L190.2 88.1 L191.0 97.0 Z`, mat: 'gold', level: 1, fin: 'glitter' }
    ],
    face: { x: -0.001, y: 0.59, w: 0.506, h: 0.43, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/risingsun.38d3522f.webp", "box": [-6.0, -5.95, 206.11, 306.07]}, tile: "img/designs/tile-risingsun.7a82a18a.webp",
  },
  round: {
    name: "Round", group: 'Rounds', sheet: 'clear', base: 1.02,
    note: "A clear disc: a blue band sweeping round its edge and a bold blue check.",
    body: `M309.2 149.6 L308.0 134.5 L305.2 119.5 L301.1 104.9 L295.5 90.8 L288.6 77.3 L280.3 64.6 L270.9 52.7 L260.3 41.8 L248.8 32.0 L236.3 23.3 L223.0 15.9 L209.1 9.9 L194.7 5.3 L179.8 2.1 L164.8 0.3 L149.6 0.1 L134.5 1.3 L119.5 4.0 L104.9 8.2 L90.8 13.8 L77.3 20.7 L64.6 28.9 L52.7 38.4 L41.8 48.9 L32.0 60.5 L23.3 73.0 L15.9 86.2 L9.9 100.2 L5.3 114.6 L2.1 129.4 L0.3 144.5 L0.1 159.7 L1.3 174.8 L5.3 194.7 L9.9 209.1 L18.3 227.5 L26.1 240.6 L38.4 256.6 L52.7 270.9 L68.7 283.2 L86.2 293.3 L101.9 300.0 L207.3 300.0 L218.5 295.5 L227.5 291.0 L240.6 283.2 L248.8 277.3 L260.3 267.5 L267.5 260.3 L274.2 252.7 L283.2 240.6 L291.0 227.5 L295.5 218.5 L302.6 199.5 L305.2 189.8 L308.0 174.8 L308.9 164.8 Z`,
    layers: [
      { d: `M40.6 207.8 L36.0 196.4 L32.5 184.5 L30.1 172.4 L29.0 160.1 L29.1 147.8 L30.3 135.5 L32.8 123.4 L36.5 111.6 L41.2 100.2 L47.1 89.4 L54.0 79.2 L61.9 69.7 L70.7 61.0 L80.3 53.2 L90.6 46.4 L101.5 40.6 L109.1 37.4 L120.8 33.5 L132.8 30.8 L145.0 29.2 L157.4 28.9 L169.7 29.8 L177.8 31.0 L189.8 33.9 L201.5 37.9 L212.7 43.1 L223.4 49.3 L230.1 54.0 L236.5 59.2 L245.5 67.7 L253.6 77.0 L260.7 87.1 L264.9 94.1 L268.6 101.5 L283.6 94.5 L277.1 82.2 L269.4 70.5 L260.6 59.7 L250.8 49.7 L240.0 40.8 L228.4 33.0 L216.2 26.4 L203.3 21.0 L190.0 16.8 L176.3 14.0 L162.4 12.6 L148.4 12.5 L134.5 13.8 L120.8 16.4 L107.4 20.4 L94.5 25.7 L86.2 29.9 L78.2 34.7 L66.8 42.7 L56.3 51.9 L46.7 62.0 L38.1 73.0 L33.0 80.8 L28.4 88.9 L22.6 101.6 L18.1 114.8 L15.7 123.8 L14.0 133.0 L12.9 142.2 L12.4 151.5 L12.5 160.8 L13.2 170.1 L14.5 179.3 L16.4 188.5 L20.4 201.8 L25.7 214.8 Z`, mat: 'blue', level: 1, fin: 'gloss' },
      { d: `M76.0 218.7 L75.3 220.1 L75.1 221.7 L75.6 223.2 L76.5 224.4 L143.7 282.2 L146.0 283.2 L147.6 283.0 L149.1 282.1 L268.9 176.1 L269.9 174.8 L270.2 172.3 L269.1 170.1 L255.7 156.8 L253.5 156.1 L251.3 156.7 L147.2 245.0 L145.6 245.9 L143.1 245.9 L141.5 245.0 L99.1 208.1 L97.7 207.3 L96.0 207.1 L94.4 207.7 L77.2 217.7 Z`, mat: 'blue', level: 1, fin: 'gloss' }
    ],
    face: { x: -0.049, y: 0.583, w: 0.521, h: 0.398, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/round.4263b5e0.webp", "box": [-5.92, -5.92, 315.47, 306.09]}, tile: "img/designs/tile-round.f91a4498.webp",
  },
  bluering: {
    name: "Ring Round", group: 'Rounds', sheet: 'blue', base: 1.04,
    note: "A blue disc with a broad ring: a yellow centre crossed by a blue band.",
    body: `M309.2 149.6 L308.0 134.5 L305.2 119.5 L301.1 104.9 L295.5 90.8 L288.6 77.3 L280.3 64.6 L270.9 52.7 L260.3 41.8 L248.8 32.0 L236.3 23.3 L223.0 15.9 L209.1 9.9 L194.7 5.3 L179.8 2.1 L164.8 0.3 L149.6 0.1 L134.5 1.3 L119.5 4.0 L104.9 8.2 L90.8 13.8 L77.3 20.7 L64.6 28.9 L52.7 38.4 L41.8 48.9 L32.0 60.5 L23.3 73.0 L15.9 86.2 L9.9 100.2 L5.3 114.6 L2.1 129.4 L0.3 144.5 L0.1 159.7 L1.3 174.8 L5.3 194.7 L9.9 209.1 L18.3 227.5 L26.1 240.6 L38.4 256.6 L52.7 270.9 L68.7 283.2 L86.2 293.3 L101.9 300.0 L207.3 300.0 L218.5 295.5 L227.5 291.0 L240.6 283.2 L248.8 277.3 L260.3 267.5 L267.5 260.3 L274.2 252.7 L283.2 240.6 L291.0 227.5 L295.5 218.5 L302.6 199.5 L305.2 189.8 L308.0 174.8 L308.9 164.8 Z`,
    layers: [
      { d: `M276.0 146.7 L274.7 134.8 L272.1 123.2 L268.5 111.8 L263.7 100.8 L257.9 90.4 L251.2 80.6 L243.4 71.5 L234.8 63.2 L225.5 55.8 L215.5 49.3 L204.8 43.8 L193.7 39.4 L182.3 36.2 L170.5 34.0 L158.6 33.1 L146.7 33.3 L134.8 34.6 L123.2 37.1 L111.8 40.8 L100.8 45.5 L90.4 51.3 L80.6 58.1 L71.5 65.9 L63.2 74.4 L55.8 83.8 L49.3 93.8 L43.8 104.4 L39.4 115.5 L36.2 127.0 L34.0 138.8 L33.1 150.7 L33.3 162.6 L34.6 174.5 L37.1 186.1 L40.8 197.5 L45.5 208.4 L51.3 218.9 L58.1 228.7 L65.9 237.8 L74.4 246.1 L83.8 253.5 L93.8 260.0 L104.4 265.4 L115.5 269.8 L127.0 273.1 L138.8 275.2 L150.7 276.2 L162.6 276.0 L174.5 274.7 L186.1 272.1 L197.5 268.5 L208.4 263.7 L218.9 257.9 L228.7 251.2 L237.8 243.4 L246.1 234.8 L253.5 225.5 L260.0 215.5 L265.4 204.8 L269.8 193.7 L273.1 182.3 L275.2 170.5 L276.2 158.6 Z`, mat: 'yellow', level: 1, fin: 'gloss' },
      { d: `M125.6 272.8 L138.8 275.2 L150.7 276.2 L162.6 276.0 L174.5 274.7 L186.1 272.1 L197.5 268.5 L208.4 263.7 L218.9 257.9 L228.7 251.2 L237.8 243.4 L246.1 234.8 L253.5 225.5 L260.0 215.5 L265.4 204.8 L269.8 193.7 L272.9 183.0 Z`, mat: 'blue', level: 2, fin: 'gloss' }
    ],
    face: { x: -0.038, y: 0.533, w: 0.573, h: 0.438, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/bluering.c19f2ac0.webp", "box": [-5.92, -5.92, 315.47, 306.09]}, tile: "img/designs/tile-bluering.28fd84fd.webp",
  },
  colourround: {
    name: "Colour Round", group: 'Rounds', sheet: 'white', base: 1.04,
    note: "A disc with a rainbow rim round a white centre.",
    body: `M309.2 149.6 L308.0 134.5 L305.2 119.5 L301.1 104.9 L295.5 90.8 L288.6 77.3 L280.3 64.6 L270.9 52.7 L260.3 41.8 L248.8 32.0 L236.3 23.3 L223.0 15.9 L209.1 9.9 L194.7 5.3 L179.8 2.1 L164.8 0.3 L149.6 0.1 L134.5 1.3 L119.5 4.0 L104.9 8.2 L90.8 13.8 L77.3 20.7 L64.6 28.9 L52.7 38.4 L41.8 48.9 L32.0 60.5 L23.3 73.0 L15.9 86.2 L9.9 100.2 L5.3 114.6 L2.1 129.4 L0.3 144.5 L0.1 159.7 L1.3 174.8 L5.3 194.7 L9.9 209.1 L18.3 227.5 L26.1 240.6 L38.4 256.6 L52.7 270.9 L68.7 283.2 L86.2 293.3 L101.9 300.0 L207.3 300.0 L218.5 295.5 L227.5 291.0 L240.6 283.2 L248.8 277.3 L260.3 267.5 L267.5 260.3 L274.2 252.7 L283.2 240.6 L291.0 227.5 L295.5 218.5 L302.6 199.5 L305.2 189.8 L308.0 174.8 L308.9 164.8 Z`,
    layers: [
      { d: `M201.6 269.1 L213.0 263.7 L223.4 257.5 L233.1 250.3 L242.1 242.1 L250.3 233.1 L257.5 223.4 L263.7 213.0 L268.9 202.0 L273.0 190.5 L276.0 178.8 L277.8 166.8 L278.3 154.6 L277.8 142.5 L276.0 130.5 L273.0 118.7 L268.9 107.3 L263.7 96.3 L257.5 85.9 L250.3 76.2 L242.1 67.2 L233.1 59.0 L223.4 51.8 L213.0 45.5 L202.0 40.3 L190.5 36.3 L178.8 33.3 L166.8 31.5 L154.6 30.9 L142.5 31.5 L130.5 33.3 L118.7 36.3 L107.3 40.3 L96.3 45.5 L85.9 51.8 L76.2 59.0 L67.2 67.2 L59.0 76.2 L51.8 85.9 L45.5 96.3 L40.3 107.3 L36.3 118.7 L33.3 130.5 L31.5 142.5 L30.9 154.6 L31.5 166.8 L33.3 178.8 L36.3 190.5 L40.3 202.0 L45.5 213.0 L51.8 223.4 L59.0 233.1 L67.2 242.1 L76.2 250.3 L85.9 257.5 L96.3 263.7 L107.3 268.9 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M200.4 262.9 L213.4 256.4 L223.1 250.2 L232.1 243.0 L240.4 235.0 L247.9 226.2 L254.4 216.7 L260.0 206.6 L264.6 196.0 L268.2 185.1 L270.6 173.8 L271.9 162.3 L272.1 150.8 L271.2 139.3 L269.1 128.0 L265.9 116.9 L261.7 106.1 L256.4 95.9 L250.2 86.2 L243.0 77.2 L235.0 68.9 L226.2 61.4 L216.7 54.8 L206.6 49.2 L196.0 44.7 L185.1 41.1 L173.8 38.7 L162.3 37.4 L150.8 37.2 L139.3 38.1 L128.0 40.2 L116.9 43.4 L106.1 47.6 L95.9 52.9 L86.2 59.1 L77.2 66.3 L68.9 74.3 L61.4 83.1 L54.8 92.6 L49.2 102.7 L44.7 113.2 L41.1 124.2 L38.7 135.5 L37.4 147.0 L37.2 158.5 L38.1 170.0 L40.2 181.3 L43.4 192.4 L47.6 203.1 L51.0 210.0 L56.9 219.9 L63.8 229.2 L71.5 237.7 L80.1 245.5 L89.3 252.4 L99.2 258.3 L108.9 262.9 Z M104.0 257.3 L94.2 251.8 L85.0 245.4 L76.4 238.2 L68.6 230.1 L61.6 221.3 L55.5 211.9 L50.4 201.9 L46.3 191.4 L43.2 180.6 L41.2 169.6 L40.3 158.4 L40.5 147.2 L41.7 136.0 L44.1 125.0 L47.5 114.3 L52.0 104.0 L57.5 94.2 L63.9 85.0 L71.1 76.4 L79.2 68.6 L88.0 61.6 L97.4 55.5 L107.4 50.4 L117.9 46.3 L128.7 43.2 L139.7 41.2 L150.9 40.3 L162.1 40.5 L173.3 41.7 L184.3 44.1 L194.9 47.5 L205.2 52.0 L215.1 57.5 L224.3 63.9 L232.9 71.1 L240.7 79.2 L247.7 88.0 L253.7 97.4 L258.9 107.4 L263.0 117.9 L266.1 128.7 L268.1 139.7 L269.0 150.9 L268.8 162.1 L267.5 173.3 L265.2 184.3 L261.7 194.9 L257.3 205.2 L251.8 215.1 L247.7 221.3 L240.7 230.1 L232.9 238.2 L227.2 243.1 L218.2 249.8 L208.6 255.6 L199.7 259.8 L109.6 259.8 Z`, mat: 'black', level: 2, fin: 'facets' },
      { d: `M157.3 28.9 L169.9 29.8 L181.4 31.8 L192.7 34.8 L203.7 38.8 L214.2 43.9 L224.2 49.9 L233.7 56.8 L241.7 63.9 L261.7 43.0 L252.7 35.1 L244.7 28.9 L236.3 23.3 L223.0 15.9 L209.1 9.9 L199.5 6.7 L189.8 4.0 L174.8 1.3 L157.9 0.1 Z`, mat: 'red', level: 1, fin: 'facets' },
      { d: `M245.4 67.6 L253.7 77.2 L259.9 85.9 L265.9 95.9 L270.8 106.5 L274.8 117.5 L277.7 128.8 L279.6 140.3 L280.4 152.0 L309.2 151.4 L308.5 139.5 L307.2 129.4 L305.2 119.5 L301.1 104.9 L297.5 95.5 L291.0 81.7 L283.2 68.7 L277.3 60.5 L266.2 47.6 Z`, mat: 'orange', level: 1, fin: 'facets' },
      { d: `M280.4 157.3 L279.5 169.9 L277.5 181.4 L274.5 192.7 L270.5 203.7 L265.4 214.2 L259.4 224.2 L252.5 233.7 L245.4 241.7 L266.2 261.7 L274.2 252.7 L280.3 244.7 L286.0 236.3 L293.3 223.0 L297.5 213.8 L302.6 199.5 L305.2 189.8 L308.0 174.8 L309.2 157.9 Z`, mat: 'yellow', level: 1, fin: 'facets' },
      { d: `M241.7 245.4 L232.1 253.7 L223.4 259.9 L213.3 265.9 L202.8 270.8 L191.8 274.8 L180.5 277.7 L168.9 279.6 L157.3 280.4 L157.7 300.0 L207.3 300.0 L223.0 293.3 L232.0 288.6 L240.6 283.2 L252.7 274.2 L261.7 266.2 Z`, mat: 'green', level: 1, fin: 'facets' },
      { d: `M152.0 280.4 L139.4 279.5 L127.9 277.5 L116.6 274.5 L105.6 270.5 L95.1 265.4 L85.0 259.4 L75.6 252.5 L67.6 245.4 L47.6 266.2 L60.5 277.3 L73.0 286.0 L86.2 293.3 L101.9 300.0 L151.6 300.0 Z`, mat: 'sky', level: 1, fin: 'facets' },
      { d: `M63.9 241.7 L56.2 232.9 L49.3 223.4 L43.4 213.3 L38.4 202.8 L34.5 191.8 L31.5 180.5 L29.7 168.9 L28.9 157.3 L0.1 157.9 L0.7 169.8 L2.1 179.8 L5.3 194.7 L8.2 204.3 L13.8 218.5 L18.3 227.5 L26.1 240.6 L32.0 248.8 L43.0 261.7 Z`, mat: 'blue', level: 1, fin: 'facets' },
      { d: `M28.9 152.0 L29.7 140.3 L31.5 128.8 L34.5 117.5 L38.4 106.5 L43.4 95.9 L49.3 85.9 L56.2 76.4 L63.9 67.6 L43.0 47.6 L35.1 56.5 L28.9 64.6 L20.7 77.3 L15.9 86.2 L9.9 100.2 L6.7 109.7 L3.0 124.5 L1.3 134.5 L0.1 151.4 Z`, mat: 'navy', level: 1, fin: 'facets' },
      { d: `M67.6 63.9 L77.2 55.6 L86.7 48.8 L95.9 43.4 L106.5 38.4 L117.5 34.5 L128.8 31.5 L140.3 29.7 L152.0 28.9 L151.4 0.1 L139.5 0.7 L129.4 2.1 L119.5 4.0 L104.9 8.2 L95.5 11.8 L81.7 18.3 L73.0 23.3 L60.5 32.0 L47.6 43.0 Z`, mat: 'wine', level: 1, fin: 'gloss' }
    ],
    face: { x: -0.0, y: 0.5, w: 0.619, h: 0.473, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/colourround.a7022baa.webp", "box": [-5.95, -5.95, 315.44, 306.06]}, tile: "img/designs/tile-colourround.aeb160bc.webp",
  },
  clearround: {
    name: "Clear Round", group: 'Rounds', sheet: 'clear', base: 1.04,
    note: "A clear disc with a frosted rim and a frosted star at its crown.",
    body: `M309.2 149.6 L308.0 134.5 L305.2 119.5 L301.1 104.9 L295.5 90.8 L288.6 77.3 L280.3 64.6 L270.9 52.7 L260.3 41.8 L248.8 32.0 L236.3 23.3 L223.0 15.9 L209.1 9.9 L194.7 5.3 L179.8 2.1 L164.8 0.3 L149.6 0.1 L134.5 1.3 L119.5 4.0 L104.9 8.2 L90.8 13.8 L77.3 20.7 L64.6 28.9 L52.7 38.4 L41.8 48.9 L32.0 60.5 L23.3 73.0 L15.9 86.2 L9.9 100.2 L5.3 114.6 L2.1 129.4 L0.3 144.5 L0.1 159.7 L1.3 174.8 L5.3 194.7 L9.9 209.1 L18.3 227.5 L26.1 240.6 L38.4 256.6 L52.7 270.9 L68.7 283.2 L86.2 293.3 L101.9 300.0 L207.3 300.0 L218.5 295.5 L227.5 291.0 L240.6 283.2 L248.8 277.3 L260.3 267.5 L267.5 260.3 L274.2 252.7 L283.2 240.6 L291.0 227.5 L295.5 218.5 L302.6 199.5 L305.2 189.8 L308.0 174.8 L308.9 164.8 Z`,
    layers: [
      { d: `M301.4 140.2 L299.2 125.9 L295.7 111.8 L290.8 98.2 L284.7 85.1 L277.2 72.7 L268.6 61.1 L258.9 50.4 L248.2 40.7 L236.5 32.1 L224.1 24.6 L211.1 18.4 L197.4 13.6 L183.4 10.1 L169.1 7.9 L154.6 7.2 L140.2 7.9 L125.9 10.1 L111.8 13.6 L98.2 18.4 L85.1 24.6 L72.7 32.1 L61.1 40.7 L50.4 50.4 L40.7 61.1 L32.1 72.7 L24.6 85.1 L18.4 98.2 L13.6 111.8 L10.1 125.9 L7.9 140.2 L7.2 154.6 L7.9 169.1 L10.1 183.4 L12.2 192.8 L15.0 202.0 L20.4 215.5 L24.6 224.1 L29.4 232.5 L37.7 244.4 L43.8 251.8 L50.4 258.9 L57.4 265.5 L64.9 271.6 L76.8 279.8 L89.4 286.9 L103.2 292.8 L206.1 292.8 L215.5 288.9 L228.4 282.3 L240.5 274.5 L248.2 268.6 L258.9 258.9 L265.5 251.8 L274.5 240.5 L279.8 232.5 L284.7 224.1 L290.8 211.1 L294.2 202.0 L298.2 188.1 L300.8 173.9 L301.7 164.3 L302.1 154.6 Z M96.8 282.3 L84.5 276.1 L73.0 268.6 L62.2 260.1 L52.3 250.5 L43.4 240.0 L35.6 228.7 L28.9 216.6 L23.4 204.0 L19.2 190.9 L16.3 177.5 L14.7 163.8 L14.5 150.1 L15.6 136.3 L18.1 122.8 L21.9 109.6 L26.9 96.8 L33.2 84.5 L40.7 73.0 L49.2 62.2 L58.8 52.3 L69.3 43.4 L80.6 35.6 L92.6 28.9 L105.3 23.4 L118.4 19.2 L131.8 16.3 L145.5 14.7 L159.2 14.5 L172.9 15.6 L186.5 18.1 L199.7 21.9 L212.5 26.9 L224.7 33.2 L236.3 40.7 L247.1 49.2 L257.0 58.8 L265.9 69.3 L273.7 80.6 L280.4 92.6 L285.9 105.3 L290.1 118.4 L293.0 131.8 L294.5 145.5 L294.8 159.2 L293.6 172.9 L291.2 186.5 L287.4 199.7 L282.3 212.5 L276.1 224.7 L268.6 236.3 L260.1 247.1 L250.5 257.0 L240.0 265.9 L228.7 273.7 L216.6 280.4 L204.8 285.6 L104.5 285.6 Z`, mat: 'frost', level: 1, fin: 'frost' },
      { d: `M150.4 41.6 L138.0 42.0 L147.8 49.7 L144.3 61.6 L154.6 54.6 L164.9 61.6 L161.5 49.7 L171.3 42.0 L158.9 41.6 L154.6 29.9 Z`, mat: 'frost', level: 1, fin: 'frost' }
    ],
    face: { x: -0.025, y: 0.482, w: 0.734, h: 0.561, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/clearround.67decdae.webp", "box": [-5.92, -5.92, 315.47, 306.09]}, tile: "img/designs/tile-clearround.0c37cf1b.webp",
  },
  facet: {
    name: "Faceted Round", group: 'Rounds', sheet: 'clear', base: 1.04,
    note: "A clear disc cut with facets round its edge, a frosted centre.",
    body: `M219.3 294.3 L256.4 270.4 L285.2 237.1 L303.6 197.0 L309.8 153.3 L303.6 109.7 L285.2 69.6 L256.4 36.3 L219.3 12.4 L177.0 0.0 L132.9 0.0 L90.6 12.4 L53.5 36.3 L24.6 69.6 L6.3 109.7 L0.0 153.3 L6.3 197.0 L24.6 237.1 L53.5 270.4 L90.6 294.3 L110.1 300.0 L199.7 300.0 Z`,
    layers: [
      { d: `M270.3 143.7 L269.0 132.4 L266.7 121.3 L263.2 110.5 L258.7 100.1 L253.1 90.2 L246.7 80.9 L239.3 72.2 L231.2 64.3 L222.3 57.3 L212.8 51.1 L202.7 45.9 L192.1 41.7 L181.2 38.6 L170.0 36.6 L158.7 35.7 L147.4 35.9 L136.1 37.1 L125.0 39.5 L114.2 43.0 L103.8 47.5 L93.8 53.0 L84.5 59.5 L75.8 66.9 L68.0 75.0 L60.9 83.9 L54.7 93.4 L49.6 103.5 L45.4 114.1 L42.3 125.0 L40.2 136.2 L39.3 147.5 L39.5 158.8 L40.8 170.1 L43.2 181.2 L46.7 192.0 L51.2 202.4 L56.7 212.4 L63.1 221.7 L70.5 230.4 L78.7 238.2 L87.5 245.3 L97.1 251.5 L107.2 256.6 L117.7 260.8 L128.7 263.9 L139.8 266.0 L151.1 266.9 L162.5 266.7 L173.8 265.4 L184.9 263.0 L195.7 259.5 L206.1 255.0 L216.0 249.5 L225.3 243.0 L234.0 235.7 L241.9 227.5 L248.9 218.7 L255.1 209.1 L260.3 199.0 L264.5 188.5 L267.6 177.5 L269.6 166.4 L270.5 155.1 Z`, mat: 'frost', level: 1, fin: 'frost' }
    ],
    face: { x: 0.0, y: 0.496, w: 0.634, h: 0.484, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/facet.ef3cba40.webp", "box": [-6.0, -6.0, 315.97, 306.01]}, tile: "img/designs/tile-facet.f4d6ad26.webp",
  },
  lionround: {
    name: "Onyx Round", group: 'Rounds', sheet: 'black', base: 1.04,
    note: "A black disc: a gold ring, a white centre and a small gold star.",
    body: `M309.2 149.6 L308.0 134.5 L305.2 119.5 L301.1 104.9 L295.5 90.8 L288.6 77.3 L280.3 64.6 L270.9 52.7 L260.3 41.8 L248.8 32.0 L236.3 23.3 L223.0 15.9 L209.1 9.9 L194.7 5.3 L179.8 2.1 L164.8 0.3 L149.6 0.1 L134.5 1.3 L119.5 4.0 L104.9 8.2 L90.8 13.8 L77.3 20.7 L64.6 28.9 L52.7 38.4 L41.8 48.9 L32.0 60.5 L23.3 73.0 L15.9 86.2 L9.9 100.2 L5.3 114.6 L2.1 129.4 L0.3 144.5 L0.1 159.7 L1.3 174.8 L5.3 194.7 L9.9 209.1 L18.3 227.5 L26.1 240.6 L38.4 256.6 L52.7 270.9 L68.7 283.2 L86.2 293.3 L101.9 300.0 L207.3 300.0 L218.5 295.5 L227.5 291.0 L240.6 283.2 L248.8 277.3 L260.3 267.5 L267.5 260.3 L274.2 252.7 L283.2 240.6 L291.0 227.5 L295.5 218.5 L302.6 199.5 L305.2 189.8 L308.0 174.8 L308.9 164.8 Z`,
    layers: [
      { d: `M299.3 140.4 L297.2 126.3 L293.7 112.4 L288.9 99.0 L282.8 86.1 L275.5 73.9 L267.0 62.4 L257.4 51.9 L246.9 42.3 L235.4 33.8 L223.2 26.4 L210.3 20.3 L196.8 15.5 L183.0 12.1 L168.9 10.0 L154.6 9.3 L140.4 10.0 L126.3 12.1 L112.4 15.5 L99.0 20.3 L86.1 26.4 L73.9 33.8 L62.4 42.3 L51.9 51.9 L42.3 62.4 L33.8 73.9 L26.4 86.1 L20.3 99.0 L15.5 112.4 L12.1 126.3 L10.0 140.4 L9.3 154.6 L10.0 168.9 L12.1 183.0 L14.2 192.3 L17.0 201.4 L22.2 214.6 L26.4 223.2 L31.2 231.4 L39.3 243.1 L45.4 250.5 L51.9 257.4 L62.4 267.0 L70.0 272.8 L77.9 278.1 L90.3 285.0 L103.5 290.7 L205.7 290.7 L214.6 287.0 L227.3 280.5 L235.4 275.5 L246.9 267.0 L254.0 260.7 L263.9 250.5 L272.8 239.3 L278.1 231.4 L282.8 223.2 L288.9 210.3 L292.3 201.4 L296.2 187.6 L298.8 173.6 L299.7 164.1 L299.9 149.9 Z M96.4 283.3 L84.0 277.0 L72.4 269.4 L61.5 260.8 L51.6 251.2 L42.6 240.6 L34.7 229.2 L28.0 217.1 L22.5 204.4 L18.2 191.2 L15.3 177.6 L13.7 163.9 L13.5 150.0 L14.6 136.2 L17.1 122.6 L20.9 109.2 L26.0 96.4 L32.3 84.0 L39.8 72.4 L48.5 61.5 L58.1 51.6 L68.7 42.6 L80.1 34.7 L92.2 28.0 L104.9 22.5 L118.1 18.2 L131.6 15.3 L145.4 13.7 L159.3 13.5 L173.1 14.6 L186.7 17.1 L200.0 20.9 L212.9 26.0 L225.3 32.3 L236.9 39.8 L247.8 48.5 L257.7 58.1 L266.7 68.7 L274.6 80.1 L281.3 92.2 L286.8 104.9 L291.1 118.1 L294.0 131.6 L295.6 145.4 L295.8 159.3 L294.7 173.1 L292.2 186.7 L288.4 200.0 L283.3 212.9 L277.0 225.3 L269.4 236.9 L260.8 247.8 L251.2 257.7 L240.6 266.7 L229.2 274.6 L217.1 281.3 L205.0 286.6 L104.3 286.6 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M203.4 278.4 L213.5 273.9 L224.9 267.6 L235.6 260.1 L245.5 251.7 L254.6 242.3 L262.7 232.1 L269.8 221.1 L275.8 209.5 L280.6 197.4 L284.2 184.8 L286.5 172.0 L287.6 159.0 L287.3 145.9 L285.8 133.0 L283.1 120.2 L279.1 107.8 L273.9 95.8 L267.6 84.4 L260.1 73.7 L251.7 63.7 L242.3 54.7 L232.1 46.5 L221.1 39.5 L209.5 33.5 L197.4 28.7 L184.8 25.1 L172.0 22.8 L159.0 21.7 L145.9 21.9 L133.0 23.4 L120.2 26.2 L107.8 30.2 L95.8 35.4 L84.4 41.7 L73.7 49.1 L63.7 57.6 L54.7 67.0 L46.5 77.2 L39.5 88.1 L33.5 99.8 L28.7 111.9 L25.1 124.4 L22.8 137.3 L21.7 150.3 L21.9 163.3 L23.4 176.3 L26.2 189.1 L30.2 201.5 L35.4 213.5 L41.7 224.9 L49.1 235.6 L57.6 245.5 L67.0 254.6 L77.2 262.7 L88.1 269.8 L99.8 275.8 L105.9 278.4 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M151.0 250.7 L140.9 251.2 L148.8 257.6 L146.2 267.3 L154.6 261.9 L163.1 267.3 L160.5 257.6 L168.4 251.2 L158.3 250.7 L154.6 241.2 Z`, mat: 'gold', level: 2, fin: 'foil' }
    ],
    face: { x: 0.007, y: 0.498, w: 0.708, h: 0.541, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/lionround.d99c2e3a.webp", "box": [-5.92, -5.92, 315.47, 306.09]}, tile: "img/designs/tile-lionround.0c0c8f35.webp",
  },
  oval: {
    name: "Oval", group: 'Rounds', sheet: 'clear', base: 1.04,
    note: "A clear oval with a black crescent along its left side.",
    body: `M249.9 151.1 L248.9 135.9 L246.7 120.8 L243.4 106.0 L238.9 91.8 L233.3 78.1 L226.6 65.2 L219.0 53.2 L210.4 42.2 L201.1 32.3 L191.0 23.6 L180.3 16.1 L169.0 10.0 L157.4 5.3 L141.3 1.3 L129.1 0.1 L116.8 0.3 L104.6 2.1 L92.6 5.3 L81.0 10.0 L66.1 18.4 L55.6 26.3 L45.7 35.5 L36.6 45.8 L28.4 57.1 L21.1 69.4 L14.8 82.6 L9.5 96.5 L5.4 110.9 L1.7 130.8 L0.3 146.0 L0.1 161.4 L1.1 176.6 L3.3 191.7 L8.0 211.3 L12.9 225.4 L21.1 243.1 L28.4 255.4 L39.6 270.3 L48.9 280.2 L62.5 291.6 L76.0 300.0 L174.0 300.0 L183.9 294.1 L191.0 288.9 L201.1 280.2 L207.4 273.7 L219.0 259.3 L226.6 247.3 L231.2 238.8 L238.9 220.7 L243.4 206.5 L245.7 196.7 L248.9 176.6 L249.9 161.4 Z`,
    layers: [
      { d: `M112.7 0.8 L100.6 3.0 L92.6 5.3 L81.0 10.0 L73.4 13.9 L66.1 18.4 L55.6 26.3 L48.9 32.3 L39.6 42.2 L33.8 49.4 L25.8 61.1 L21.1 69.4 L14.8 82.6 L11.1 91.8 L6.6 106.0 L3.3 120.8 L1.7 130.8 L0.3 146.0 L0.0 156.2 L0.3 166.5 L1.7 181.7 L3.3 191.7 L6.6 206.5 L9.5 216.0 L14.8 229.9 L21.1 243.1 L25.8 251.4 L33.8 263.1 L39.6 270.3 L48.9 280.2 L55.6 286.2 L66.1 294.1 L76.0 300.0 L100.1 300.0 L91.4 291.8 L85.0 284.7 L78.9 277.0 L73.2 268.9 L67.9 260.2 L63.1 251.2 L56.7 236.8 L53.0 226.8 L49.8 216.4 L47.1 205.8 L44.1 189.6 L42.8 178.5 L41.9 167.4 L41.7 156.2 L41.9 145.1 L43.4 128.4 L45.0 117.5 L47.1 106.7 L51.3 90.9 L56.7 75.7 L60.8 66.0 L65.5 56.7 L70.5 47.9 L76.0 39.5 L81.9 31.6 L88.1 24.2 L94.7 17.4 L101.6 11.2 L108.8 5.6 L116.8 0.3 Z`, mat: 'black', level: 1, fin: 'gloss' },
      { d: `M242.7 136.5 L240.6 121.9 L237.3 107.7 L233.0 93.9 L227.6 80.7 L221.2 68.3 L213.9 56.8 L205.7 46.3 L199.8 39.8 L193.6 33.9 L183.8 26.0 L173.5 19.4 L162.7 14.0 L155.4 11.3 L147.9 9.1 L140.3 7.5 L132.7 6.6 L125.0 6.3 L117.3 6.6 L109.8 7.5 L104.2 11.8 L110.2 10.6 L117.6 9.7 L128.7 9.5 L136.1 10.1 L143.5 11.3 L154.4 14.2 L161.5 16.9 L168.5 20.2 L178.7 26.2 L185.3 31.0 L191.6 36.2 L200.5 45.1 L206.1 51.6 L211.3 58.6 L218.5 69.9 L222.8 77.9 L226.6 86.3 L231.6 99.4 L234.3 108.5 L236.6 117.8 L239.0 132.0 L240.4 146.5 L240.6 161.1 L239.6 175.7 L238.3 185.3 L236.6 194.7 L233.0 208.6 L230.0 217.5 L226.6 226.2 L220.7 238.6 L216.2 246.5 L211.3 253.9 L203.3 264.2 L197.6 270.5 L191.6 276.3 L182.0 284.0 L171.6 290.6 L93.2 290.6 L96.2 293.6 L172.4 293.8 L180.5 288.9 L187.2 284.0 L196.8 275.7 L202.8 269.5 L208.5 262.8 L213.9 255.7 L218.8 248.1 L223.4 240.1 L227.6 231.8 L231.3 223.1 L236.0 209.5 L238.5 200.1 L240.6 190.6 L242.1 180.9 L243.2 171.1 L243.7 156.2 L243.5 146.4 Z`, mat: 'frost', level: 1, fin: 'frost' }
    ],
    face: { x: 0.07, y: 0.495, w: 0.583, h: 0.524, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/oval.7ab557e4.webp", "box": [-6.0, -5.92, 256.21, 306.1]}, tile: "img/designs/tile-oval.cdebc64e.webp",
  },
  gem: {
    name: "Gem", group: 'Rounds', sheet: 'wine', base: 1.04,
    note: "A deep red gem with a waved crown, a red inner panel and a gold medallion.",
    body: `M8.5 39.3 L4.2 67.7 L1.4 109.9 L0.0 152.2 L0.0 194.5 L4.2 236.9 L11.2 278.9 L20.8 299.4 L22.0 300.0 L177.4 293.7 L192.7 294.4 L207.6 290.5 L220.7 281.9 L227.6 274.3 L232.8 265.2 L235.9 255.4 L236.7 240.2 L232.8 225.5 L227.6 216.5 L216.8 205.6 L205.1 198.9 L204.3 197.7 L201.7 180.3 L200.3 152.1 L203.1 124.0 L207.3 95.9 L208.8 67.6 L207.4 39.6 L203.2 18.6 L194.8 5.9 L180.4 0.0 L163.9 2.7 L126.7 21.0 L110.1 18.2 L91.5 8.3 L70.8 2.8 L49.5 2.7 L31.5 5.5 L17.0 14.2 Z`,
    layers: [
      { d: `M14.2 235.5 L20.9 276.1 L27.3 289.8 L138.4 285.2 L133.1 277.7 L129.6 270.9 L127.4 265.1 L125.8 259.2 L124.5 251.8 L124.2 244.6 L124.6 238.5 L125.6 232.4 L127.6 225.1 L129.6 219.8 L132.4 214.3 L136.8 207.5 L140.4 203.1 L144.7 198.8 L150.5 194.0 L156.6 190.1 L161.6 187.5 L167.3 185.3 L174.2 183.4 L181.7 182.3 L191.8 182.2 L190.3 151.8 L193.2 122.9 L197.4 94.8 L198.7 67.7 L197.4 40.7 L193.7 22.2 L188.1 13.8 L179.4 10.3 L166.8 12.4 L131.8 29.8 L129.5 30.6 L127.1 31.0 L106.9 27.7 L88.0 17.8 L69.3 12.8 L50.1 12.8 L34.7 15.1 L25.3 20.8 L18.2 41.8 L14.2 68.7 L11.4 110.4 L10.0 152.4 L10.0 194.0 Z`, mat: 'red', level: 1, fin: 'facets' },
      { d: `M236.7 240.2 L235.9 235.1 L234.6 230.1 L232.7 225.3 L230.4 220.7 L227.5 216.3 L224.3 212.3 L220.6 208.7 L216.6 205.4 L212.3 202.6 L207.7 200.3 L202.9 198.4 L197.9 197.1 L192.8 196.3 L187.6 196.0 L182.4 196.3 L177.3 197.1 L172.3 198.4 L167.5 200.3 L162.9 202.6 L158.6 205.4 L154.6 208.7 L150.9 212.3 L147.7 216.3 L144.8 220.7 L142.5 225.3 L140.7 230.1 L139.3 235.1 L138.5 240.2 L138.2 245.4 L138.5 250.5 L139.3 255.6 L140.7 260.6 L142.5 265.4 L144.8 270.0 L147.7 274.4 L150.9 278.4 L154.6 282.0 L158.6 285.3 L162.9 288.1 L167.5 290.5 L172.3 292.3 L177.3 293.6 L182.4 294.5 L187.6 294.7 L192.8 294.5 L197.9 293.6 L202.9 292.3 L207.7 290.5 L212.3 288.1 L216.6 285.3 L220.6 282.0 L224.3 278.4 L227.5 274.4 L230.4 270.0 L232.7 265.4 L234.6 260.6 L235.9 255.6 L236.7 250.5 L237.0 245.4 Z`, mat: 'gold', level: 1, fin: 'foil' },
      { d: `M227.7 241.1 L226.0 232.9 L222.5 225.2 L217.6 218.4 L211.3 212.7 L207.8 210.4 L200.1 207.0 L191.8 205.2 L183.4 205.2 L175.1 207.0 L167.4 210.4 L160.6 215.4 L155.0 221.6 L152.7 225.2 L149.2 232.9 L147.5 241.1 L147.5 249.6 L149.2 257.8 L152.7 265.5 L157.6 272.3 L163.9 278.0 L171.2 282.2 L179.2 284.8 L187.6 285.7 L191.8 285.5 L200.1 283.7 L207.8 280.3 L214.6 275.3 L220.2 269.1 L224.5 261.8 L227.1 253.7 L227.9 245.4 Z`, mat: 'wine', level: 2, fin: 'gloss' }
    ],
    face: { x: -0.082, y: 0.606, w: 0.484, h: 0.435, level: 1, on: 0 },
    ink: 'printlight', art: {"src": "img/designs/gem.1df0cbdd.webp", "box": [-6.0, -6.0, 243.02, 306.01]}, tile: "img/designs/tile-gem.dc4aefd0.webp",
  },
  hands: {
    name: "Hands & Disc", group: 'Rounds', sheet: 'white', base: 1.08,
    note: "A disc held up in two silver hands: a wood ring round a light centre.",
    body: `M0.0 136.9 L4.2 156.2 L14.0 181.5 L30.7 210.7 L50.4 232.1 L53.0 253.1 L49.5 298.2 L50.1 299.5 L96.5 299.5 L97.7 298.9 L98.4 213.5 L99.1 212.2 L100.2 212.0 L117.0 214.6 L135.4 214.6 L153.9 211.4 L163.7 208.4 L164.9 209.2 L165.0 210.4 L159.0 228.0 L160.9 299.1 L162.3 300.0 L196.7 299.7 L197.8 299.2 L198.2 298.1 L196.9 253.1 L199.2 227.3 L205.4 213.0 L220.2 200.2 L237.0 181.2 L249.4 160.5 L255.7 139.1 L253.6 129.3 L253.0 128.4 L247.3 124.7 L234.3 121.9 L233.3 121.2 L233.9 107.3 L233.5 97.8 L230.3 79.6 L227.3 70.3 L219.5 53.6 L214.4 45.6 L202.4 31.2 L195.5 24.8 L180.2 14.1 L163.1 6.1 L153.9 3.2 L135.7 0.0 L116.9 0.0 L98.4 3.2 L89.2 6.1 L72.5 13.9 L57.1 24.7 L49.9 31.2 L37.9 45.7 L28.5 61.9 L22.2 79.3 L18.9 97.7 L18.9 116.5 L21.2 131.3 L21.0 132.5 L20.0 133.1 L18.9 132.9 L14.9 128.7 L7.1 124.3 L1.4 127.8 Z`,
    layers: [
      { d: `M230.2 79.4 L227.4 70.5 L223.8 61.8 L219.5 53.4 L214.4 45.5 L208.7 38.1 L202.3 31.1 L195.4 24.8 L188.0 19.1 L180.0 14.0 L171.7 9.7 L163.0 6.1 L154.1 3.3 L144.9 1.2 L135.6 0.0 L126.2 -0.4 L116.8 0.0 L107.5 1.2 L98.3 3.3 L89.3 6.1 L80.7 9.7 L72.3 14.0 L64.4 19.1 L56.9 24.8 L50.0 31.1 L43.7 38.1 L38.0 45.5 L32.9 53.4 L28.6 61.8 L25.0 70.5 L22.1 79.4 L20.1 88.6 L18.9 97.9 L18.5 107.3 L18.9 116.7 L20.1 126.0 L21.7 133.0 L30.3 142.4 L40.4 163.4 L58.5 184.1 L78.4 198.7 L99.2 209.1 L100.0 210.2 L100.1 211.7 L107.5 213.4 L116.8 214.6 L126.2 215.0 L135.6 214.6 L144.9 213.4 L154.1 211.3 L163.6 208.3 L165.1 204.4 L188.7 184.1 L208.7 162.5 L222.0 141.0 L228.8 120.6 L230.3 119.6 L233.0 120.0 L233.9 107.3 L233.5 97.9 L232.3 88.6 Z M220.5 132.6 L218.0 140.7 L214.7 148.6 L210.8 156.1 L206.2 163.3 L201.0 170.1 L195.3 176.4 L189.0 182.1 L182.2 187.3 L175.0 191.9 L167.5 195.8 L159.6 199.1 L151.5 201.7 L143.1 203.5 L134.7 204.6 L126.2 205.0 L117.7 204.6 L109.2 203.5 L100.9 201.7 L92.8 199.1 L84.9 195.8 L77.3 191.9 L70.2 187.3 L63.4 182.1 L57.1 176.4 L51.4 170.1 L46.2 163.3 L41.6 156.1 L37.6 148.6 L34.4 140.7 L31.8 132.6 L30.0 124.3 L28.9 115.8 L28.5 107.3 L28.9 98.8 L30.0 90.3 L31.8 82.0 L34.4 73.9 L37.6 66.0 L41.6 58.5 L46.2 51.3 L51.4 44.5 L57.1 38.2 L63.4 32.5 L70.2 27.3 L77.3 22.7 L84.9 18.8 L92.8 15.5 L100.9 12.9 L109.2 11.1 L117.7 10.0 L126.2 9.6 L134.7 10.0 L143.1 11.1 L151.5 12.9 L159.6 15.5 L167.5 18.8 L175.0 22.7 L182.2 27.3 L189.0 32.5 L195.3 38.2 L201.0 44.5 L206.2 51.3 L210.8 58.5 L214.7 66.0 L218.0 73.9 L220.5 82.0 L222.4 90.3 L223.5 98.8 L223.9 107.3 L223.5 115.8 L222.4 124.3 Z`, mat: 'wood', level: 1, fin: 'wood' },
      { d: `M222.4 90.3 L220.5 82.0 L218.0 73.9 L214.7 66.0 L210.8 58.5 L206.2 51.3 L201.0 44.5 L195.3 38.2 L189.0 32.5 L182.2 27.3 L175.0 22.7 L167.5 18.8 L159.6 15.5 L151.5 12.9 L143.1 11.1 L134.7 10.0 L126.2 9.6 L117.7 10.0 L109.2 11.1 L100.9 12.9 L92.8 15.5 L84.9 18.8 L77.3 22.7 L70.2 27.3 L63.4 32.5 L57.1 38.2 L51.4 44.5 L46.2 51.3 L41.6 58.5 L37.6 66.0 L34.4 73.9 L31.8 82.0 L30.0 90.3 L28.9 98.8 L28.5 107.3 L28.9 115.8 L30.0 124.3 L31.8 132.6 L34.4 140.7 L37.6 148.6 L41.6 156.1 L46.2 163.3 L51.4 170.1 L57.1 176.4 L63.4 182.1 L70.2 187.3 L77.3 191.9 L84.9 195.8 L92.8 199.1 L100.9 201.7 L109.2 203.5 L117.7 204.6 L126.2 205.0 L134.7 204.6 L143.1 203.5 L151.5 201.7 L159.6 199.1 L167.5 195.8 L175.0 191.9 L182.2 187.3 L189.0 182.1 L195.3 176.4 L201.0 170.1 L206.2 163.3 L210.8 156.1 L214.7 148.6 L218.0 140.7 L220.5 132.6 L222.4 124.3 L223.5 115.8 L223.9 107.3 L223.5 98.8 Z`, mat: 'tan', level: 1, fin: 'panel' }
    ],
    face: { x: 0.004, y: 0.642, w: 0.53, h: 0.405, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/hands.fc012ded.webp", "box": [-5.99, -6.41, 261.79, 306.19]}, tile: "img/designs/tile-hands.b2365318.webp",
  },
  laurel: {
    name: "Laurel Round", group: 'Rounds', sheet: 'navy', base: 1.08,
    note: "A navy disc: a white centre held in a gold laurel wreath.",
    body: `M309.2 149.6 L308.0 134.5 L305.2 119.5 L301.1 104.9 L295.5 90.8 L288.6 77.3 L280.3 64.6 L270.9 52.7 L260.3 41.8 L248.8 32.0 L236.3 23.3 L223.0 15.9 L209.1 9.9 L194.7 5.3 L179.8 2.1 L164.8 0.3 L149.6 0.1 L134.5 1.3 L119.5 4.0 L104.9 8.2 L90.8 13.8 L77.3 20.7 L64.6 28.9 L52.7 38.4 L41.8 48.9 L32.0 60.5 L23.3 73.0 L15.9 86.2 L9.9 100.2 L5.3 114.6 L2.1 129.4 L0.3 144.5 L0.1 159.7 L1.3 174.8 L5.3 194.7 L9.9 209.1 L18.3 227.5 L26.1 240.6 L38.4 256.6 L52.7 270.9 L68.7 283.2 L86.2 293.3 L101.9 300.0 L207.3 300.0 L218.5 295.5 L227.5 291.0 L240.6 283.2 L248.8 277.3 L260.3 267.5 L267.5 260.3 L274.2 252.7 L283.2 240.6 L291.0 227.5 L295.5 218.5 L302.6 199.5 L305.2 189.8 L308.0 174.8 L308.9 164.8 Z`,
    layers: [
      { d: `M204.4 283.5 L215.7 278.5 L227.6 271.9 L238.7 264.2 L249.1 255.5 L258.5 245.7 L266.9 235.1 L274.3 223.7 L280.5 211.7 L285.5 199.0 L289.2 186.0 L291.6 172.7 L292.7 159.2 L292.5 145.6 L290.9 132.1 L288.1 118.9 L283.9 106.0 L278.5 93.5 L271.9 81.7 L264.2 70.5 L255.5 60.2 L245.7 50.8 L235.1 42.4 L223.7 35.0 L211.7 28.8 L199.0 23.8 L186.0 20.1 L172.7 17.7 L159.2 16.6 L145.6 16.8 L132.1 18.3 L118.9 21.2 L106.0 25.4 L93.5 30.7 L81.7 37.3 L70.5 45.0 L60.2 53.8 L50.8 63.6 L42.4 74.2 L35.0 85.6 L28.8 97.6 L23.8 110.2 L20.1 123.3 L17.7 136.6 L16.6 150.1 L16.8 163.7 L18.3 177.1 L21.2 190.4 L25.4 203.3 L30.7 215.7 L37.3 227.6 L45.0 238.7 L53.8 249.1 L63.6 258.5 L74.2 266.9 L85.6 274.3 L97.6 280.5 L104.9 283.5 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M246.5 83.6 L244.5 80.7 L239.8 77.4 L232.1 74.3 L224.1 73.0 L216.8 67.3 L209.5 62.5 L201.9 58.4 L191.3 53.9 L190.3 56.8 L198.0 60.0 L205.5 63.8 L212.7 68.2 L219.7 73.4 L217.7 74.4 L217.0 76.1 L217.8 78.3 L220.1 80.6 L225.8 83.9 L233.4 86.5 L239.6 94.5 L237.4 94.9 L236.2 96.2 L236.2 98.1 L237.6 100.9 L242.2 106.0 L249.1 110.8 L252.9 120.2 L250.6 120.0 L249.2 120.9 L248.7 122.8 L249.1 125.5 L250.2 128.4 L252.2 132.0 L257.5 138.6 L258.0 142.3 L258.6 148.6 L256.6 147.8 L255.0 148.2 L253.9 149.7 L253.5 152.3 L253.7 155.8 L254.5 159.3 L258.0 167.5 L257.1 173.0 L256.2 177.5 L254.6 176.2 L252.9 176.1 L251.5 177.1 L250.4 179.3 L249.6 182.6 L249.4 186.7 L250.4 195.5 L247.3 202.1 L246.0 204.6 L244.8 202.9 L243.3 202.3 L241.6 202.9 L240.0 204.5 L238.4 207.3 L237.0 211.1 L236.0 215.4 L235.4 220.3 L228.7 227.9 L228.1 226.1 L226.9 225.0 L225.4 224.9 L223.8 225.6 L221.2 227.8 L218.5 231.2 L216.1 235.4 L214.2 240.0 L205.6 245.4 L205.4 243.1 L204.3 241.9 L202.3 241.7 L199.4 242.7 L193.9 246.8 L188.3 253.1 L178.6 256.0 L179.1 253.9 L178.6 252.5 L177.2 251.6 L174.7 251.5 L170.3 252.6 L165.2 255.0 L159.1 259.3 L154.5 264.1 L153.2 266.4 L152.7 268.2 L152.9 269.8 L153.9 270.7 L155.5 271.1 L157.6 271.0 L162.6 269.5 L166.9 267.3 L170.7 264.8 L174.0 262.0 L176.8 258.9 L176.9 259.5 L185.9 257.2 L184.2 261.6 L184.2 265.0 L184.9 265.9 L186.1 266.4 L189.6 265.7 L193.6 263.1 L197.8 259.2 L201.6 254.5 L204.3 249.6 L212.9 244.6 L212.5 248.9 L213.2 252.2 L214.0 253.1 L215.1 253.4 L217.5 252.7 L220.9 249.6 L224.5 244.1 L227.1 238.2 L228.6 232.2 L235.5 225.1 L236.4 229.6 L238.2 232.5 L239.2 233.0 L240.6 232.8 L243.1 230.3 L245.2 226.0 L246.7 220.4 L247.4 214.5 L247.1 208.9 L251.8 200.1 L253.7 203.9 L256.0 206.3 L257.2 206.6 L258.3 206.4 L259.9 204.4 L261.2 200.0 L261.3 193.5 L260.4 187.1 L258.5 181.3 L260.5 171.5 L263.7 174.9 L266.8 176.4 L267.9 176.2 L268.9 175.4 L269.7 171.9 L269.2 167.2 L267.6 161.7 L265.0 156.2 L261.8 151.6 L261.1 141.7 L264.8 144.0 L268.0 144.7 L269.1 144.4 L269.9 143.6 L270.3 141.1 L269.0 136.7 L265.7 131.1 L261.5 126.1 L256.8 122.2 L253.4 112.9 L257.9 114.1 L261.3 113.7 L262.1 113.0 L262.5 111.7 L261.4 108.3 L258.5 104.6 L254.1 100.8 L249.1 97.5 L243.9 95.3 L238.0 87.3 L241.7 87.3 L244.7 86.6 L246.2 85.4 Z M122.7 57.5 L121.1 55.9 L118.2 54.4 L118.0 53.9 L117.3 54.1 L111.8 52.9 L103.8 52.7 L96.5 54.0 L93.1 55.9 L92.3 57.2 L92.3 58.5 L93.1 59.8 L94.7 61.0 L99.3 62.8 L91.1 68.3 L85.0 68.8 L78.2 70.5 L72.7 72.9 L68.8 75.9 L67.8 78.3 L68.9 80.1 L71.8 81.3 L76.2 81.6 L69.7 89.2 L64.0 91.3 L58.3 94.5 L53.3 98.6 L50.6 102.3 L50.1 105.0 L51.5 106.6 L54.8 106.9 L59.1 106.1 L55.0 115.1 L50.8 118.1 L46.5 122.3 L42.9 126.9 L40.7 131.2 L40.1 134.8 L40.7 136.1 L41.6 136.7 L43.0 136.9 L44.9 136.5 L49.4 134.3 L47.9 144.1 L44.5 148.5 L41.5 153.8 L39.5 159.2 L38.6 163.9 L39.2 167.3 L40.2 168.3 L41.3 168.5 L44.4 167.3 L47.8 164.1 L49.2 174.0 L47.1 179.1 L45.7 185.0 L45.2 190.7 L45.6 195.5 L47.2 198.7 L48.2 199.3 L49.5 199.3 L52.2 197.2 L54.6 193.2 L58.6 202.3 L58.0 208.3 L58.4 214.9 L59.7 220.8 L61.8 225.0 L64.0 226.8 L65.2 226.8 L66.2 226.3 L68.0 223.5 L69.1 219.3 L75.4 226.9 L76.4 232.4 L78.3 238.1 L80.9 243.3 L83.8 247.0 L86.8 248.9 L88.0 248.9 L89.1 248.2 L90.3 245.0 L90.2 240.3 L98.4 245.9 L102.2 253.1 L107.5 259.5 L111.4 262.6 L115.0 263.9 L116.9 263.4 L117.8 261.5 L117.6 258.6 L116.3 254.8 L124.0 257.4 L132.3 259.5 L133.0 256.5 L122.2 253.6 L114.1 250.6 L111.3 246.5 L108.4 243.1 L105.4 240.5 L102.3 238.6 L100.3 238.1 L98.9 238.3 L97.7 239.6 L97.5 241.7 L97.0 241.4 L89.3 235.7 L86.0 227.4 L83.9 223.9 L81.9 221.6 L79.8 220.0 L78.0 219.7 L76.5 220.6 L75.7 222.5 L69.5 214.5 L68.7 206.1 L66.6 199.6 L64.9 197.1 L63.2 196.1 L61.6 196.4 L60.0 198.1 L56.3 188.7 L57.4 183.9 L58.0 179.0 L57.8 174.7 L57.0 171.4 L56.0 169.7 L54.8 169.1 L53.2 169.3 L51.7 170.4 L50.7 160.3 L53.1 156.0 L54.8 151.9 L55.9 148.0 L56.2 144.8 L55.9 142.6 L54.8 141.1 L53.4 140.7 L51.4 141.4 L53.1 131.4 L56.7 127.9 L59.5 124.5 L61.5 121.1 L62.8 118.0 L63.1 115.8 L62.7 114.4 L61.3 113.4 L59.0 113.4 L59.3 112.7 L63.5 104.3 L71.1 99.7 L74.1 97.0 L76.3 94.4 L77.2 92.3 L77.3 90.4 L76.1 89.2 L74.1 88.7 L75.7 86.7 L80.9 81.2 L89.5 78.8 L93.1 77.0 L95.9 75.1 L97.5 73.2 L98.0 71.6 L97.2 70.1 L95.4 69.0 L98.9 66.7 L104.0 63.7 L112.4 63.8 L119.1 62.4 L121.4 61.3 L122.6 60.1 L123.1 58.8 Z`, mat: 'gold', level: 2, fin: 'foil' }
    ],
    face: { x: -0.001, y: 0.485, w: 0.549, h: 0.42, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/laurel.4701a97b.webp", "box": [-5.92, -5.92, 315.47, 306.09]}, tile: "img/designs/tile-laurel.a7bd5fb2.webp",
  },
  medal: {
    name: "Ribbon Medal", group: 'Rounds', sheet: 'gold', base: 1.08,
    note: "A gold medal on a blue ribbon, a white face for the sticker.",
    body: `M133.6 0.0 L111.0 56.5 L88.4 0.0 L22.6 0.0 L67.3 95.2 L58.7 99.4 L49.3 105.0 L40.6 111.5 L35.1 116.3 L30.0 121.4 L22.9 129.7 L18.7 135.6 L13.1 145.0 L8.4 154.8 L5.9 161.6 L3.8 168.5 L1.5 179.2 L0.2 190.0 L0.0 197.3 L0.5 208.1 L1.5 215.3 L4.8 229.5 L9.9 243.1 L16.7 255.9 L25.2 267.7 L35.1 278.2 L46.3 287.5 L58.7 295.1 L69.1 300.0 L152.8 300.0 L163.3 295.1 L172.6 289.5 L184.1 280.7 L191.9 273.1 L199.0 264.8 L205.2 255.9 L212.0 243.1 L216.0 232.9 L219.8 218.9 L221.4 208.1 L221.9 200.9 L221.7 190.0 L221.0 182.8 L219.0 172.1 L216.0 161.6 L213.5 154.8 L208.8 145.0 L205.2 138.7 L199.0 129.7 L194.4 124.1 L186.8 116.3 L178.5 109.2 L172.6 105.0 L163.3 99.4 L154.6 95.2 L199.3 0.0 Z`,
    layers: [
      { d: `M69.8 90.9 L81.5 87.1 L92.3 84.8 L99.8 83.8 L111.0 83.2 L122.1 83.8 L133.2 85.4 L144.0 88.1 L152.1 90.9 L192.8 4.1 L136.3 4.1 L114.8 58.0 L113.3 59.9 L111.0 60.6 L108.7 59.9 L107.1 58.0 L85.6 4.1 L29.1 4.1 Z`, mat: 'blue', level: 1, fin: 'ribbon' },
      { d: `M207.5 194.1 L206.7 184.7 L205.0 175.3 L202.4 166.2 L198.9 157.4 L194.6 149.0 L189.5 141.0 L183.6 133.6 L177.0 126.8 L169.7 120.6 L162.0 115.2 L153.7 110.6 L145.0 106.9 L136.0 104.0 L126.7 102.0 L117.3 100.9 L107.8 100.7 L98.4 101.5 L89.0 103.2 L79.9 105.8 L71.1 109.3 L62.7 113.6 L54.7 118.8 L47.3 124.7 L40.5 131.2 L34.3 138.5 L28.9 146.3 L24.3 154.5 L20.6 163.2 L17.7 172.3 L15.7 181.5 L14.6 190.9 L14.4 200.4 L15.2 209.9 L16.9 219.2 L19.5 228.3 L23.0 237.1 L27.3 245.5 L32.5 253.5 L38.4 260.9 L44.9 267.7 L52.2 273.9 L60.0 279.3 L68.2 283.9 L76.9 287.6 L86.0 290.5 L95.2 292.5 L104.6 293.6 L114.1 293.8 L123.6 293.0 L132.9 291.3 L142.0 288.7 L150.8 285.2 L159.2 280.9 L167.2 275.8 L174.6 269.9 L181.4 263.3 L187.6 256.1 L193.0 248.3 L197.6 240.0 L201.3 231.3 L204.2 222.3 L206.2 213.0 L207.3 203.6 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M201.2 191.3 L200.2 182.5 L198.3 173.9 L195.6 165.4 L192.0 157.3 L187.7 149.5 L182.7 142.2 L176.9 135.5 L170.6 129.3 L163.6 123.8 L156.2 119.0 L148.3 114.9 L140.0 111.7 L131.5 109.2 L122.8 107.6 L113.9 106.9 L105.0 107.0 L96.2 108.1 L87.6 109.9 L79.1 112.6 L71.0 116.2 L63.2 120.5 L55.9 125.5 L49.2 131.3 L43.0 137.7 L37.5 144.6 L32.7 152.1 L28.6 159.9 L25.3 168.2 L22.9 176.7 L21.3 185.5 L20.6 194.3 L20.7 203.2 L21.8 212.0 L23.6 220.7 L26.3 229.1 L29.9 237.2 L34.2 245.0 L39.2 252.3 L45.0 259.1 L51.3 265.2 L58.3 270.7 L65.8 275.6 L73.6 279.6 L81.9 282.9 L90.4 285.3 L99.2 286.9 L108.0 287.6 L116.9 287.5 L125.7 286.5 L134.4 284.6 L142.8 281.9 L150.9 278.3 L158.7 274.0 L166.0 269.0 L172.8 263.2 L178.9 256.9 L184.4 249.9 L189.3 242.5 L193.3 234.6 L196.6 226.3 L199.0 217.8 L200.6 209.1 L201.3 200.2 Z M198.1 203.0 L197.1 211.5 L195.3 219.9 L192.7 228.0 L189.3 235.9 L185.1 243.4 L180.2 250.4 L174.7 257.0 L168.5 262.9 L161.8 268.2 L154.6 272.9 L147.0 276.8 L139.0 280.0 L130.8 282.3 L122.4 283.8 L113.8 284.5 L105.2 284.4 L96.7 283.4 L88.4 281.6 L80.2 279.0 L72.3 275.6 L64.8 271.4 L57.8 266.5 L51.3 261.0 L45.3 254.8 L40.0 248.1 L35.3 240.9 L31.4 233.3 L28.3 225.3 L25.9 217.1 L24.4 208.7 L23.7 200.1 L23.8 191.5 L24.8 183.0 L26.6 174.7 L29.2 166.5 L32.6 158.6 L36.8 151.1 L41.7 144.1 L47.2 137.6 L53.4 131.6 L60.1 126.3 L67.3 121.6 L74.9 117.7 L82.9 114.6 L91.1 112.2 L99.6 110.7 L108.1 110.0 L116.7 110.1 L125.2 111.1 L133.6 112.9 L141.7 115.5 L149.6 118.9 L157.1 123.1 L164.1 128.0 L170.7 133.5 L176.6 139.7 L181.9 146.4 L186.6 153.6 L190.5 161.2 L193.7 169.2 L196.0 177.4 L197.5 185.9 L198.2 194.4 Z`, mat: 'gold', level: 2, fin: 'foil' }
    ],
    face: { x: -0.0, y: 0.342, w: 0.48, h: 0.367, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/medal.f93cbe8c.webp", "box": [-6.0, -6.0, 228.08, 306.01]}, tile: "img/designs/tile-medal.99b02ff5.webp",
  },
  goldstar: {
    name: "Gold Star", group: 'Stars', sheet: 'gold', base: 1.06,
    note: "A big gold star with a white star laid inside it.",
    body: `M2.2 115.0 L0.9 115.4 L0.1 116.5 L0.1 117.9 L0.8 119.1 L89.1 190.4 L90.0 191.6 L90.0 193.0 L62.0 297.1 L62.5 299.3 L64.2 300.0 L72.5 299.6 L159.2 243.3 L160.5 242.9 L161.9 243.3 L248.5 299.6 L256.8 300.0 L258.1 299.6 L259.0 298.5 L259.0 297.1 L231.1 193.0 L231.1 191.6 L231.9 190.4 L320.2 119.1 L321.0 117.5 L320.5 115.7 L318.9 115.0 L205.5 109.1 L204.1 108.7 L203.3 107.5 L162.7 1.5 L161.8 0.4 L160.5 0.0 L159.2 0.4 L158.4 1.5 L117.8 107.5 L116.9 108.7 L115.6 109.1 Z`,
    layers: [
      { d: `M100.0 177.0 L103.8 181.0 L105.8 184.7 L107.2 189.9 L107.1 195.3 L87.3 269.4 L149.7 228.8 L154.7 226.5 L160.5 225.6 L166.3 226.5 L171.3 228.8 L233.7 269.4 L214.4 197.5 L213.7 192.0 L214.6 186.3 L217.3 181.0 L221.0 177.0 L278.9 130.2 L204.6 126.4 L199.2 125.3 L194.0 122.6 L189.8 118.5 L187.1 113.7 L160.5 44.2 L133.9 113.7 L131.2 118.5 L127.1 122.6 L121.9 125.3 L116.5 126.4 L42.1 130.2 Z`, mat: 'white', level: 1, fin: 'panel' }
    ],
    face: { x: 0.001, y: 0.438, w: 0.302, h: 0.231, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/goldstar.6c7ba027.webp", "box": [-5.91, -6.0, 327.19, 306.01]}, tile: "img/designs/tile-goldstar.d0230728.webp",
  },
  starstem: {
    name: "Shooting Star", group: 'Stars', sheet: 'tan', base: 1.04,
    note: "A star on a sweeping stem: black and yellow stars laid on cream.",
    body: `M0.0 297.7 L0.4 299.1 L2.0 300.0 L133.1 300.0 L134.9 298.8 L135.1 297.6 L134.2 296.3 L126.7 292.5 L119.4 287.9 L109.6 279.7 L101.8 270.0 L97.7 262.6 L93.8 250.6 L92.4 237.3 L93.8 222.5 L96.5 211.9 L100.6 200.6 L106.1 188.9 L113.2 176.5 L117.4 170.7 L119.6 171.1 L142.7 190.9 L144.2 191.4 L145.6 190.6 L146.1 189.1 L138.5 121.2 L196.7 85.4 L197.4 84.5 L197.6 83.3 L197.0 82.3 L196.0 81.7 L129.1 67.9 L113.0 1.6 L111.7 0.1 L110.5 0.1 L109.3 1.0 L75.5 60.4 L7.4 55.2 L6.2 55.4 L5.4 56.3 L5.2 57.5 L5.8 58.6 L51.8 109.0 L25.8 172.2 L25.7 173.4 L26.2 174.4 L27.3 175.0 L28.5 174.8 L89.5 146.9 L91.4 146.9 L92.5 148.6 L91.6 150.4 L70.9 165.9 L66.8 170.4 L45.6 196.1 L31.1 217.2 L19.4 237.9 L10.3 258.5 L3.7 279.2 Z`,
    layers: [
      { d: `M80.1 63.2 L78.1 65.2 L75.3 65.8 L14.8 60.9 L55.9 105.5 L57.1 108.1 L56.8 110.9 L33.5 167.0 L88.6 141.7 L91.5 141.3 L94.1 142.4 L140.1 182.0 L133.1 121.7 L133.6 118.8 L135.5 116.7 L187.4 85.1 L127.9 73.2 L125.3 71.8 L123.9 69.4 L109.9 10.3 Z`, mat: 'black', level: 1, fin: 'gloss' },
      { d: `M85.4 66.2 L83.5 68.7 L80.9 70.6 L77.9 71.7 L75.8 71.9 L29.8 68.2 L60.4 101.4 L62.1 104.0 L63.1 107.0 L63.2 110.2 L62.4 113.3 L45.1 154.9 L86.1 136.1 L89.1 135.2 L92.3 135.2 L95.4 136.1 L98.0 137.8 L132.3 167.2 L127.1 122.4 L127.2 119.2 L128.1 116.2 L129.9 113.6 L132.4 111.5 L170.9 88.0 L126.7 79.1 L123.7 78.1 L121.1 76.2 L119.2 73.7 L118.0 70.8 L107.5 26.9 Z`, mat: 'yellow', level: 2, fin: 'gloss' }
    ],
    face: { x: 0.062, y: 0.663, w: 0.161, h: 0.123, level: 2, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/starstem.99eed01a.webp", "box": [-5.98, -5.94, 203.79, 306.08]}, tile: "img/designs/tile-starstem.243f0bfd.webp",
  },
  starplaque: {
    name: "Star Plaque", group: 'Stars', sheet: 'clear', base: 1.02,
    note: "A clear pentagon with a red star laid on it, white inside.",
    body: `M0.7 121.2 L0.1 123.2 L61.8 299.7 L273.8 299.7 L275.1 298.9 L326.8 127.5 L169.0 0.2 L167.1 0.3 Z`,
    layers: [
      { d: `M168.9 22.2 L159.1 35.7 L148.7 48.3 L137.8 60.0 L132.1 65.6 L126.3 70.9 L114.2 80.8 L101.6 89.9 L95.0 94.1 L81.5 101.8 L74.5 105.3 L60.2 111.7 L52.8 114.6 L37.6 119.6 L21.8 123.8 L13.7 125.5 L28.7 146.3 L41.7 167.3 L52.8 188.5 L61.9 209.8 L69.2 231.3 L74.5 253.0 L77.8 274.9 L79.2 297.0 L102.5 293.6 L125.5 291.2 L148.1 289.8 L170.3 289.4 L192.3 289.9 L213.9 291.4 L235.1 293.9 L256.1 297.3 L255.2 286.4 L255.1 280.7 L256.5 263.1 L260.2 244.5 L266.1 224.9 L274.4 204.3 L285.0 182.7 L297.8 160.0 L313.0 136.3 L295.1 131.1 L286.6 128.1 L278.3 125.0 L262.6 118.2 L248.0 110.6 L234.4 102.2 L228.0 97.8 L221.8 93.1 L210.4 83.2 L205.0 78.0 L195.1 66.9 L186.3 55.1 L182.3 48.9 L175.1 35.9 Z`, mat: 'red', level: 1, fin: 'gloss' },
      { d: `M29.1 131.2 L45.2 155.5 L53.6 170.2 L64.2 191.8 L70.4 206.7 L77.8 228.7 L81.7 243.9 L85.8 266.2 L87.8 286.5 L109.3 283.7 L132.4 281.7 L147.8 280.8 L170.3 280.4 L192.6 280.9 L207.5 281.8 L229.1 284.0 L246.2 286.4 L246.1 280.4 L246.8 268.4 L248.6 255.3 L253.2 235.8 L257.7 221.8 L266.1 200.7 L273.2 185.9 L285.4 163.2 L298.7 141.6 L283.7 136.7 L274.9 133.3 L258.9 126.4 L251.2 122.6 L236.2 114.1 L222.8 105.2 L216.4 100.3 L204.1 89.7 L193.4 78.7 L188.3 72.8 L178.8 60.0 L170.8 47.1 L167.1 40.1 L155.6 54.1 L144.1 66.5 L132.4 77.5 L126.2 82.8 L113.1 92.9 L99.9 101.7 L92.7 105.9 L85.6 109.8 L71.2 116.8 L63.4 120.1 L48.2 125.7 Z`, mat: 'white', level: 2, fin: 'panel' }
    ],
    face: { x: 0.002, y: 0.329, w: 0.593, h: 0.453, level: 2, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/starplaque.3a0da089.webp", "box": [-5.92, -5.82, 333.05, 305.9]}, tile: "img/designs/tile-starplaque.b832937a.webp",
  },
  starround: {
    name: "Star Round", group: 'Stars', sheet: 'white', base: 1.06,
    note: "A white disc with a navy crescent and two navy stars breaking out of it.",
    body: `M248.0 43.9 L248.0 0.0 L219.7 33.6 L177.9 20.1 L186.3 33.6 L173.2 29.9 L164.2 28.1 L145.8 26.3 L127.3 26.9 L109.1 29.9 L100.2 32.3 L87.1 37.0 L74.6 42.9 L66.6 47.5 L51.6 58.3 L44.7 64.3 L35.0 74.3 L26.4 85.1 L18.9 96.8 L12.6 109.1 L7.5 122.0 L3.7 135.3 L1.2 149.0 L0.1 162.8 L0.3 176.6 L1.9 190.4 L4.8 203.9 L9.0 217.1 L14.6 229.8 L21.3 241.9 L29.2 253.3 L38.1 263.9 L48.1 273.5 L58.9 282.1 L70.6 289.6 L82.9 296.0 L92.8 300.0 L189.5 300.0 L203.6 294.0 L219.6 284.8 L234.3 273.5 L247.3 260.5 L255.9 249.6 L265.7 233.9 L271.6 221.4 L277.5 203.9 L280.5 190.4 L282.0 176.6 L282.0 158.1 L279.6 139.8 L281.0 134.9 L303.0 131.3 L284.4 118.9 L287.7 96.8 L270.4 110.6 L265.7 100.8 L261.1 92.8 L253.2 81.4 L247.1 74.1 L288.7 60.5 Z`,
    layers: [
      { d: `M209.9 69.3 L218.4 75.8 L226.3 83.1 L233.6 91.1 L240.0 99.7 L245.7 108.9 L250.6 118.5 L254.5 128.6 L257.5 138.9 L259.6 149.5 L260.7 160.2 L260.9 171.0 L260.1 181.7 L258.3 192.3 L255.6 202.8 L252.0 212.9 L247.4 222.7 L242.0 232.0 L235.8 240.8 L231.2 246.4 L223.8 254.1 L218.4 258.9 L209.9 265.5 L203.9 269.4 L194.4 274.7 L184.6 279.0 L170.9 283.4 L156.8 286.1 L146.1 287.1 L135.3 287.0 L121.0 285.5 L110.5 283.2 L100.2 279.9 L92.9 300.0 L105.0 303.8 L117.4 306.5 L130.0 308.1 L142.7 308.5 L155.4 307.8 L168.0 306.0 L180.3 303.0 L192.3 299.0 L204.0 293.8 L215.1 287.7 L225.6 280.5 L235.4 272.5 L244.5 263.6 L252.7 253.9 L260.0 243.6 L266.4 232.6 L271.8 221.1 L274.7 213.1 L277.2 205.0 L280.1 192.7 L281.3 184.3 L282.1 175.8 L282.3 163.1 L281.8 154.7 L280.8 146.3 L278.3 133.8 L274.7 121.6 L271.8 113.7 L266.4 102.2 L262.3 94.8 L257.7 87.7 L252.7 80.8 L244.5 71.2 L238.5 65.1 L228.9 56.8 L222.2 51.7 Z`, mat: 'navy', level: 1, fin: 'gloss' },
      { d: `M258.1 121.7 L242.3 137.7 L264.7 136.6 L275.0 156.5 L281.0 134.9 L303.0 131.3 L284.4 118.9 L287.7 96.8 L270.2 110.8 L250.2 100.8 Z M177.9 20.1 L201.1 57.4 L175.3 93.0 L218.0 82.4 L243.8 117.9 L247.0 74.1 L288.7 60.5 L248.0 43.9 L248.0 0.0 L219.7 33.6 Z`, mat: 'navy', level: 1, fin: 'gloss' }
    ],
    face: { x: -0.11, y: 0.417, w: 0.634, h: 0.485, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/starround.903088ee.webp", "box": [-5.92, -6.0, 309.31, 314.8]}, tile: "img/designs/tile-starround.043ea65d.webp",
  },
  starside: {
    name: "Star & Plaque", group: 'Stars', sheet: 'wood', base: 1.04,
    note: "A wood star on a stem beside its white plaque.",
    body: `M0.7 85.5 L0.0 86.9 L0.7 88.4 L38.9 113.1 L48.8 148.5 L48.9 230.2 L47.6 298.4 L48.1 299.5 L49.1 299.9 L188.6 300.0 L189.7 299.6 L190.1 298.5 L193.4 69.7 L193.0 68.7 L191.7 68.2 L113.7 79.5 L112.9 78.3 L113.2 77.2 L147.4 31.5 L147.5 29.8 L145.9 29.1 L81.8 42.5 L54.3 0.7 L53.0 0.0 L51.5 1.3 L42.1 60.7 Z`,
    layers: [
      { d: `M115.8 294.9 L185.2 295.0 L188.2 82.2 L131.6 82.2 L115.8 84.5 Z`, mat: 'white', level: 1, fin: 'panel' }
    ],
    face: { x: 0.17, y: 0.485, w: 0.229, h: 0.292, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/starside.f8c01ba9.webp", "box": [-6.0, -6.0, 199.66, 306.01]}, tile: "img/designs/tile-starside.a7972efe.webp",
  },
  moonstars: {
    name: "Moon & Stars", group: 'Stars', sheet: 'clear', base: 1.04,
    note: "A clear half moon with three gold stars rising up its side.",
    body: `M0.4 200.7 L0.0 211.0 L1.0 221.9 L6.9 236.5 L8.6 242.8 L11.5 248.1 L14.3 250.5 L19.8 251.5 L21.9 252.7 L37.8 266.0 L41.6 276.7 L47.2 282.7 L55.2 288.5 L57.1 291.5 L58.2 296.7 L59.8 298.7 L64.2 300.0 L165.8 299.3 L168.0 297.8 L168.4 296.3 L166.2 287.5 L166.2 270.9 L164.9 264.1 L164.9 254.5 L163.6 248.4 L163.6 231.5 L164.7 226.7 L168.2 219.6 L168.2 214.4 L166.2 206.9 L166.2 196.8 L171.1 182.6 L168.3 173.1 L168.2 168.1 L168.9 151.9 L171.8 141.0 L167.4 132.5 L166.3 128.5 L166.2 100.1 L167.1 96.5 L170.5 90.1 L171.6 83.7 L171.9 74.9 L170.9 69.2 L171.6 28.1 L169.6 17.1 L169.5 6.4 L165.8 1.5 L162.1 0.0 L146.6 0.7 L127.8 5.7 L104.5 14.4 L84.9 24.1 L63.1 39.4 L46.8 55.8 L27.2 82.2 L15.9 104.9 L7.4 130.4 L6.3 141.1 L4.3 148.2 L3.9 155.6 L1.7 164.2 L1.3 179.7 L2.3 189.8 Z`,
    layers: [
      { d: `M59.5 243.4 L55.4 266.0 L73.4 251.7 L93.6 262.6 L85.6 241.1 L102.3 225.2 L79.3 226.2 L69.3 205.5 L63.2 227.6 L40.4 230.7 Z M13.5 183.1 L26.2 197.6 L18.0 215.1 L35.8 207.5 L49.9 220.7 L48.1 201.5 L65.0 192.2 L46.2 187.9 L42.6 168.9 L32.7 185.5 Z M11.2 261.7 L2.1 274.5 L17.4 270.9 L26.8 283.5 L28.1 267.8 L43.0 262.8 L28.5 256.7 L28.3 241.0 L18.0 252.9 L3.0 248.2 Z`, mat: 'gold', level: 1, fin: 'glitter' },
      { d: `M12.5 234.2 L14.3 240.7 L16.4 244.5 L16.8 244.9 L21.8 245.9 L25.4 247.8 L42.4 262.2 L43.7 264.6 L46.8 273.6 L51.0 278.1 L59.8 284.7 L62.7 289.2 L63.7 293.6 L64.9 294.0 L161.4 293.4 L160.3 288.2 L160.2 271.4 L158.9 264.8 L158.9 255.3 L157.6 249.1 L157.6 231.5 L158.9 225.2 L162.2 218.2 L162.2 215.3 L160.3 207.7 L160.2 196.8 L160.7 194.2 L164.9 182.3 L162.3 174.0 L162.2 168.0 L163.0 151.0 L165.5 141.7 L161.8 134.7 L160.3 129.3 L160.2 100.1 L161.4 94.4 L164.8 88.2 L165.6 83.2 L165.9 75.2 L164.9 69.1 L165.5 28.4 L163.6 17.6 L163.6 8.3 L162.0 6.3 L158.9 6.0 L147.7 6.6 L129.7 11.4 L106.9 19.9 L88.0 29.3 L66.9 44.1 L51.4 59.6 L32.4 85.2 L21.5 107.2 L13.2 131.9 L12.2 142.2 L10.3 149.0 L9.9 156.5 L7.6 164.9 L7.3 179.5 L8.3 190.1 L6.3 201.5 L6.0 210.7 L6.9 220.5 Z M11.1 192.1 L11.3 189.0 L10.3 179.4 L10.6 165.3 L12.8 157.0 L13.3 149.5 L15.2 142.8 L16.2 132.5 L24.3 108.3 L35.0 86.8 L53.7 61.6 L68.8 46.4 L89.6 31.8 L108.1 22.7 L130.6 14.3 L148.2 9.6 L160.3 9.0 L160.6 18.0 L162.5 28.7 L161.9 69.0 L162.9 75.4 L162.6 82.9 L161.9 87.2 L158.6 93.4 L157.3 99.1 L157.2 128.0 L158.8 135.2 L162.2 142.0 L160.0 150.7 L159.2 168.0 L159.4 174.6 L161.7 182.3 L157.8 193.3 L157.3 196.0 L157.3 207.9 L159.2 215.7 L159.2 217.5 L156.0 224.2 L154.6 231.5 L154.6 248.6 L155.9 255.7 L156.0 265.5 L157.2 271.7 L157.2 287.5 L157.6 290.4 L66.2 291.0 L65.1 287.3 L61.7 282.3 L53.0 275.8 L49.4 272.0 L46.3 262.8 L44.1 259.6 L27.5 245.7 L23.0 243.1 L18.5 242.1 L17.1 239.6 L15.4 233.6 L9.8 219.8 L9.0 210.6 L9.3 201.8 Z`, mat: 'frost', level: 1, fin: 'frost' }
    ],
    face: { x: 0.035, y: 0.591, w: 0.352, h: 0.384, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/moonstars.1674f993.webp", "box": [-5.99, -6.0, 177.99, 306.01]}, tile: "img/designs/tile-moonstars.8f7db469.webp",
  },
  twinstar: {
    name: "Twin Stars", group: 'Stars', sheet: 'clear', base: 1.08,
    note: "A clear panel with a gold and a silver star breaking out of its top.",
    body: `M92.3 72.3 L126.7 39.4 L79.2 42.9 L58.5 0.0 L47.2 46.2 L0.0 52.7 L35.6 74.7 L21.3 74.8 L15.2 76.6 L11.4 79.5 L9.4 81.9 L7.4 86.2 L6.7 89.4 L6.7 283.8 L7.9 290.0 L10.3 294.1 L13.9 297.3 L18.2 299.3 L21.3 299.9 L173.1 300.0 L179.3 298.8 L183.4 296.3 L186.6 292.8 L188.6 288.5 L189.3 283.8 L189.3 90.8 L205.1 82.4 L182.2 77.6 L176.2 75.0 L172.6 74.7 L167.0 43.0 L150.4 71.6 L117.7 67.0 L124.6 74.7 L93.3 74.7 Z`,
    layers: [
      { d: `M114.1 114.8 L114.4 116.8 L113.5 119.0 L111.5 120.3 L109.1 120.3 L68.9 98.7 L34.6 127.7 L32.9 128.6 L30.9 128.5 L28.7 126.9 L28.0 124.3 L34.7 86.9 L22.5 86.9 L20.6 87.6 L19.3 89.1 L18.8 91.3 L18.8 283.5 L19.3 285.7 L21.0 287.3 L23.2 287.8 L172.8 287.8 L175.0 287.3 L176.6 285.7 L177.1 283.5 L177.1 134.3 L154.7 112.7 L126.6 125.2 L124.2 125.3 L122.5 124.3 L121.3 122.3 L121.5 119.9 L134.9 92.3 L130.1 86.9 L102.7 86.9 Z`, mat: 'frost', level: 1, fin: 'frost' },
      { d: `M47.2 46.2 L0.0 52.7 L40.5 77.8 L32.0 124.6 L68.4 93.9 L110.3 116.4 L92.3 72.3 L126.7 39.4 L79.2 42.9 L58.5 0.0 Z`, mat: 'gold', level: 1, fin: 'glitter' },
      { d: `M117.7 67.0 L139.8 91.6 L125.3 121.4 L155.5 107.9 L179.3 130.9 L175.9 98.0 L205.1 82.4 L172.7 75.5 L167.0 43.0 L150.4 71.6 Z`, mat: 'silver', level: 1, fin: 'foil' }
    ],
    face: { x: 0.009, y: 0.332, w: 0.422, h: 0.43, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/twinstar.96442020.webp", "box": [-6.0, -6.0, 211.38, 306.01]}, tile: "img/designs/tile-twinstar.f6d08a55.webp",
  },
  starburst: {
    name: "Star Burst", group: 'Stars', sheet: 'gold', base: 1.06,
    note: "A sixteen-point gold burst round a white disc.",
    body: `M227.7 262.1 L270.5 270.5 L262.1 227.7 L304.8 219.1 L280.7 182.8 L316.9 158.5 L280.7 134.1 L304.8 97.8 L262.1 89.2 L270.5 46.4 L227.7 54.8 L219.1 12.1 L182.8 36.2 L158.5 0.0 L134.1 36.2 L97.8 12.1 L89.2 54.8 L46.4 46.4 L54.8 89.2 L12.1 97.8 L36.2 134.1 L0.0 158.5 L36.2 182.8 L12.1 219.1 L54.8 227.7 L46.4 270.5 L89.2 262.1 L96.8 300.0 L105.1 300.0 L134.1 280.7 L147.1 300.0 L169.8 300.0 L182.8 280.7 L211.8 300.0 L220.1 300.0 Z`,
    layers: [
      { d: `M264.0 155.0 L263.2 144.7 L261.3 134.5 L258.5 124.5 L254.7 114.9 L249.9 105.6 L244.3 96.9 L237.9 88.8 L230.7 81.4 L222.8 74.6 L214.2 68.7 L205.2 63.7 L195.7 59.6 L185.8 56.4 L175.7 54.2 L165.4 53.0 L155.0 52.9 L144.7 53.7 L134.5 55.6 L124.5 58.4 L114.9 62.2 L105.6 67.0 L96.9 72.6 L88.8 79.0 L81.4 86.2 L74.6 94.1 L68.7 102.7 L63.7 111.7 L59.6 121.2 L56.4 131.1 L54.2 141.2 L53.0 151.5 L52.9 161.9 L53.7 172.2 L55.6 182.4 L58.4 192.4 L62.2 202.0 L67.0 211.3 L72.6 220.0 L79.0 228.1 L86.2 235.5 L94.1 242.3 L102.7 248.2 L111.7 253.2 L121.2 257.3 L131.1 260.5 L141.2 262.7 L151.5 263.9 L161.9 264.0 L172.2 263.2 L182.4 261.3 L192.4 258.5 L202.0 254.7 L211.3 249.9 L220.0 244.3 L228.1 237.9 L235.5 230.7 L242.3 222.8 L248.2 214.2 L253.2 205.2 L257.3 195.7 L260.5 185.8 L262.7 175.7 L263.9 165.4 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M272.3 151.0 L271.0 139.9 L268.6 128.9 L265.2 118.3 L260.8 108.0 L255.3 98.2 L249.0 89.0 L241.7 80.5 L233.7 72.7 L224.9 65.7 L215.5 59.7 L205.5 54.5 L195.1 50.4 L184.4 47.3 L173.3 45.3 L162.2 44.4 L151.0 44.6 L139.9 45.9 L128.9 48.3 L118.3 51.7 L108.0 56.1 L98.2 61.6 L89.0 67.9 L80.5 75.2 L72.7 83.2 L65.7 92.0 L59.7 101.4 L54.5 111.4 L50.4 121.8 L47.3 132.5 L45.3 143.6 L44.4 154.7 L44.6 165.9 L45.9 177.0 L48.3 188.0 L51.7 198.6 L56.1 208.9 L61.6 218.7 L67.9 227.9 L75.2 236.4 L83.2 244.2 L92.0 251.2 L101.4 257.3 L111.4 262.4 L121.8 266.5 L132.5 269.6 L143.6 271.6 L154.7 272.5 L165.9 272.3 L177.0 271.0 L188.0 268.6 L198.6 265.2 L208.9 260.8 L218.7 255.3 L227.9 249.0 L236.4 241.7 L244.2 233.7 L251.2 224.9 L257.3 215.5 L262.4 205.5 L266.5 195.1 L269.6 184.4 L271.6 173.3 L272.5 162.2 Z M268.1 165.6 L266.8 176.3 L264.6 186.9 L261.3 197.1 L257.0 207.0 L251.7 216.5 L245.6 225.3 L238.6 233.5 L230.9 241.0 L222.4 247.7 L213.4 253.6 L203.8 258.5 L193.8 262.5 L183.4 265.4 L172.8 267.4 L162.0 268.3 L151.3 268.1 L140.6 266.8 L130.0 264.6 L119.8 261.3 L109.9 257.0 L100.4 251.7 L91.6 245.6 L83.4 238.6 L75.9 230.9 L69.2 222.4 L63.3 213.4 L58.4 203.8 L54.4 193.8 L51.5 183.4 L49.5 172.8 L48.7 162.0 L48.8 151.3 L50.1 140.6 L52.3 130.0 L55.6 119.8 L59.9 109.9 L65.2 100.4 L71.3 91.6 L78.3 83.4 L86.0 75.9 L94.5 69.2 L103.5 63.3 L113.1 58.4 L123.1 54.4 L133.5 51.5 L144.1 49.5 L154.9 48.7 L165.6 48.8 L176.3 50.1 L186.9 52.3 L197.1 55.6 L207.0 59.9 L216.5 65.2 L225.3 71.3 L233.5 78.3 L241.0 86.0 L247.7 94.5 L253.6 103.5 L258.5 113.1 L262.5 123.1 L265.4 133.5 L267.4 144.1 L268.3 154.9 Z`, mat: 'black', level: 1, fin: 'gloss' }
    ],
    face: { x: -0.0, y: 0.472, w: 0.575, h: 0.44, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/starburst.ee742d2d.webp", "box": [-6.0, -6.0, 323.0, 306.01]}, tile: "img/designs/tile-starburst.70664283.webp",
  },
  wave: {
    name: "Scallop Sail", group: 'Curves', sheet: 'clear', base: 1.04,
    note: "A clear sail with a frosted, scalloped band along its curve.",
    body: `M0.2 280.3 L0.6 283.3 L3.3 286.2 L17.4 294.0 L22.2 299.1 L24.1 300.0 L174.3 299.6 L178.8 298.6 L190.8 292.0 L205.1 282.0 L212.5 274.7 L217.5 271.0 L226.4 262.2 L230.6 256.6 L234.3 254.2 L241.0 244.9 L242.7 240.8 L247.2 234.3 L254.1 221.4 L262.1 200.4 L263.0 195.6 L265.2 190.9 L265.3 186.3 L267.9 176.0 L267.9 169.2 L270.5 162.9 L271.6 152.9 L270.6 130.0 L267.9 121.8 L267.9 115.1 L265.2 107.4 L265.2 103.1 L262.6 96.7 L262.2 92.7 L259.8 88.4 L258.1 81.5 L251.1 66.2 L233.7 37.5 L214.1 15.2 L210.4 12.8 L201.4 3.9 L194.7 0.0 L193.1 0.1 L190.6 2.0 L173.3 25.9 L151.7 59.5 L147.2 64.5 L141.5 74.1 L133.2 85.4 L126.8 96.9 L119.9 105.3 L116.7 111.2 L104.6 127.7 L101.9 132.7 L97.7 137.3 L87.4 153.9 L80.2 164.0 L76.3 168.0 L65.3 185.6 L49.8 207.2 L47.9 211.1 L7.0 268.7 Z`,
    layers: [
      { d: `M136.8 89.3 L138.5 103.3 L139.3 103.8 L142.0 103.3 L145.6 103.8 L147.2 101.1 L145.3 98.7 L144.5 96.7 L144.3 94.4 L145.1 92.2 L146.7 90.2 L149.1 89.0 L151.2 88.8 L154.3 89.7 L155.0 89.4 L156.6 87.1 L154.8 84.4 L154.1 82.3 L154.1 79.9 L155.1 77.7 L156.4 76.3 L158.2 75.2 L160.9 74.8 L163.9 75.5 L166.0 73.5 L166.1 72.6 L164.2 69.8 L163.8 67.5 L164.4 64.8 L166.0 62.6 L169.3 61.1 L171.3 61.1 L173.5 61.7 L174.3 61.3 L175.6 58.9 L173.8 56.3 L173.1 54.3 L173.1 52.0 L174.0 49.8 L175.7 48.0 L177.9 46.9 L180.0 46.7 L183.1 47.4 L184.8 45.0 L184.7 44.2 L182.9 41.8 L182.3 39.8 L182.4 37.4 L183.4 35.2 L185.1 33.5 L187.3 32.6 L189.3 32.5 L191.9 33.2 L192.7 33.1 L193.2 32.2 L192.7 30.0 L192.8 28.1 L194.3 25.1 L195.7 23.8 L197.5 23.1 L199.5 22.9 L201.4 23.3 L203.8 24.8 L205.3 27.3 L205.5 30.5 L204.2 34.0 L205.8 36.1 L206.8 36.4 L209.5 35.3 L212.1 35.3 L214.5 36.4 L216.3 38.3 L217.1 40.2 L217.2 42.4 L216.8 44.2 L215.4 46.7 L217.2 49.0 L217.9 49.3 L220.6 48.7 L222.9 48.9 L225.0 50.0 L226.6 51.7 L227.4 53.9 L227.4 56.4 L226.6 58.6 L224.9 60.5 L224.8 61.3 L226.5 63.7 L229.4 63.2 L231.7 63.5 L233.8 64.6 L235.5 66.4 L236.2 68.6 L236.2 71.0 L235.4 73.1 L233.5 75.4 L234.6 78.2 L235.3 78.6 L237.9 78.3 L240.1 78.8 L242.1 80.0 L243.4 81.9 L244.1 84.0 L243.9 86.3 L242.7 88.9 L240.1 91.1 L240.5 93.7 L241.1 94.4 L244.3 94.4 L246.8 95.5 L248.7 97.7 L249.5 100.4 L249.3 102.3 L248.5 104.2 L245.3 107.2 L245.4 110.0 L246.1 110.7 L248.9 110.8 L251.4 111.9 L253.1 113.9 L253.9 116.5 L253.7 118.8 L252.6 121.1 L251.0 122.5 L248.2 124.0 L248.5 126.5 L249.2 127.2 L252.0 127.3 L254.5 128.3 L256.2 130.2 L257.1 132.6 L257.0 135.1 L256.0 137.4 L254.5 138.9 L251.5 140.2 L251.0 140.9 L251.3 143.8 L254.2 144.7 L255.9 145.9 L257.2 147.6 L257.9 149.8 L257.7 152.3 L256.6 154.6 L254.5 156.4 L251.3 157.3 L250.1 160.0 L250.3 160.9 L252.5 162.3 L253.9 164.2 L254.5 166.3 L254.4 168.6 L253.6 170.5 L252.2 172.1 L250.6 173.1 L247.9 174.0 L247.1 176.8 L247.4 177.5 L249.6 178.8 L251.1 180.6 L251.8 182.7 L251.8 185.0 L250.9 187.3 L249.2 189.1 L246.9 190.1 L244.2 190.3 L243.5 191.0 L243.1 193.6 L245.3 195.3 L246.5 196.8 L247.3 198.8 L247.3 200.9 L246.4 203.5 L244.5 205.5 L242.0 206.5 L239.0 206.4 L238.2 207.0 L237.5 209.8 L239.8 212.1 L240.9 214.7 L240.9 216.8 L240.2 218.8 L238.7 220.7 L236.7 221.9 L234.4 222.3 L231.8 221.8 L231.0 222.2 L229.7 224.7 L231.3 227.1 L232.0 228.8 L232.2 230.8 L231.7 232.8 L230.3 234.9 L228.2 236.3 L225.7 236.8 L223.0 236.3 L222.2 236.7 L220.7 239.0 L221.8 241.9 L222.0 244.0 L221.5 246.1 L220.2 248.0 L218.4 249.4 L216.3 250.0 L214.2 249.9 L211.4 249.0 L209.2 251.0 L209.1 251.8 L210.3 254.2 L210.6 256.5 L210.0 258.7 L208.6 260.7 L206.4 262.2 L203.9 262.6 L201.6 262.1 L198.7 260.5 L196.7 262.2 L196.4 263.1 L197.6 265.6 L197.8 267.9 L197.1 270.3 L195.6 272.2 L193.4 273.4 L190.9 273.8 L188.8 273.3 L186.2 271.4 L185.4 271.4 L183.1 273.2 L183.7 276.2 L183.5 278.4 L182.4 280.6 L180.6 282.2 L178.3 283.1 L175.9 283.1 L173.4 282.0 L171.2 279.8 L168.2 279.7 L167.5 280.2 L166.7 282.7 L165.3 284.6 L163.6 285.6 L161.0 286.2 L160.4 286.7 L161.0 293.8 L161.4 294.5 L173.7 294.6 L177.2 293.9 L188.3 287.7 L201.9 278.2 L209.2 271.0 L214.2 267.2 L222.6 258.8 L227.0 253.2 L230.8 250.5 L236.6 242.5 L238.2 238.4 L242.9 231.7 L249.7 219.2 L257.3 199.1 L258.2 194.2 L260.2 189.8 L260.3 185.6 L262.9 175.7 L263.0 168.3 L265.6 161.6 L266.5 152.8 L265.6 130.8 L263.1 123.0 L262.9 115.9 L260.5 108.9 L260.2 104.1 L257.8 98.3 L257.3 94.3 L255.1 90.2 L253.4 83.2 L246.7 68.6 L229.7 40.5 L210.8 19.0 L206.9 16.4 L198.5 8.1 L194.9 5.8 L193.7 6.2 L177.5 28.7 L155.9 62.1 L151.2 67.4 L145.7 76.8 Z`, mat: 'frost', level: 1, fin: 'frost' }
    ],
    face: { x: 0.058, y: 0.432, w: 0.393, h: 0.375, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/wave.171de361.webp", "box": [-5.8, -5.98, 277.8, 306.04]}, tile: "img/designs/tile-wave.2986cf32.webp",
  },
  halfmoon: {
    name: "Half Moon", group: 'Curves', sheet: 'blue', base: 1.00,
    note: "A blue half moon: a white inner panel and a blue star at its foot.",
    body: `M0.0 184.4 L4.7 210.5 L12.2 231.4 L20.2 246.0 L36.0 270.2 L49.1 283.4 L56.5 294.3 L59.7 297.5 L68.1 300.0 L150.7 299.7 L155.4 299.0 L159.1 296.3 L161.4 287.8 L161.1 274.5 L159.4 265.4 L159.4 257.6 L161.4 243.8 L161.4 226.7 L159.4 212.8 L160.1 188.7 L161.4 176.7 L161.4 21.5 L160.0 11.8 L157.3 5.5 L153.6 1.4 L149.3 0.0 L139.8 3.3 L126.4 6.0 L110.3 11.5 L90.4 19.6 L61.4 38.0 L31.6 68.0 L21.2 82.2 L11.5 100.1 L8.4 106.6 L2.7 124.0 L0.0 148.3 Z`,
    layers: [
      { d: `M14.4 208.1 L21.3 227.2 L28.8 240.8 L43.9 264.0 L56.8 277.0 L65.1 288.8 L69.3 290.0 L150.7 289.6 L151.4 286.9 L151.1 275.4 L149.5 266.4 L149.4 257.6 L151.4 243.1 L151.4 227.3 L149.4 212.5 L150.1 188.0 L151.4 176.2 L151.4 22.1 L150.3 14.6 L148.7 10.8 L142.5 13.0 L129.1 15.7 L113.9 20.8 L95.1 28.5 L67.8 45.7 L39.3 74.4 L29.7 87.5 L20.4 104.6 L17.7 110.2 L12.5 126.3 L10.0 148.8 L10.0 183.6 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M61.6 247.5 L81.5 258.4 L79.5 281.0 L96.0 265.5 L116.8 274.4 L107.2 253.9 L122.1 236.8 L99.6 239.7 L88.0 220.2 L83.7 242.5 Z`, mat: 'blue', level: 2, fin: 'gloss' }
    ],
    face: { x: 0.009, y: 0.495, w: 0.395, h: 0.403, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/halfmoon.41e8dd5a.webp", "box": [-6.0, -6.0, 167.44, 306.02]}, tile: "img/designs/tile-halfmoon.91d6bc88.webp",
  },
  wing: {
    name: "Wing", group: 'Curves', sheet: 'black', base: 1.00,
    note: "An angled black wing: a white panel and a strip of wood.",
    body: `M0.7 84.2 L0.0 85.5 L8.1 298.8 L9.5 299.7 L121.6 299.8 L122.3 298.5 L130.6 0.7 L129.6 0.0 L128.5 0.2 Z`,
    layers: [
      { d: `M41.5 291.7 L41.5 67.0 L8.2 88.9 L15.8 291.7 Z`, mat: 'wood', level: 1, fin: 'wood' },
      { d: `M122.4 13.8 L47.5 63.1 L47.5 291.8 L114.5 292.0 Z`, mat: 'white', level: 1, fin: 'panel' }
    ],
    face: { x: 0.068, y: 0.604, w: 0.226, h: 0.246, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/wing.3a003532.webp", "box": [-6.0, -5.97, 136.68, 306.05]}, tile: "img/designs/tile-wing.01eb8d45.webp",
  },
  fin: {
    name: "Fin", group: 'Curves', sheet: 'white', base: 1.00,
    note: "A white fin with a red tip and a red crescent sweeping up its side.",
    body: `M0.0 147.3 L0.3 159.1 L2.4 168.1 L12.0 199.3 L19.4 218.7 L25.5 240.2 L31.1 254.8 L36.9 281.1 L43.4 296.0 L46.5 298.7 L52.5 300.0 L124.9 299.7 L131.1 298.5 L136.3 294.3 L145.9 276.3 L152.6 259.3 L162.6 220.4 L163.7 207.7 L166.6 190.8 L171.6 177.0 L173.0 162.6 L173.0 154.0 L169.3 138.4 L169.3 130.8 L171.3 119.3 L171.3 112.4 L166.6 96.9 L166.3 87.6 L163.6 73.5 L162.6 58.4 L156.3 29.8 L151.3 14.4 L146.7 5.0 L140.8 0.0 L137.3 0.1 L134.2 1.8 L83.4 52.0 L75.8 63.0 L56.0 83.3 L29.7 109.5 L16.3 119.9 L6.1 130.2 L1.7 137.4 Z`,
    layers: [
      { d: `M162.6 58.4 L156.3 29.9 L151.3 14.4 L146.9 5.2 L140.8 0.0 L137.3 0.1 L134.2 1.8 L93.8 41.7 L107.3 70.0 L163.0 64.1 Z`, mat: 'red', level: 1, fin: 'gloss' },
      { d: `M0.4 159.4 L2.4 168.1 L12.0 199.3 L17.3 213.1 L17.8 199.1 L19.2 186.2 L21.5 173.7 L24.7 161.5 L28.7 149.8 L33.6 138.7 L39.3 128.3 L46.2 118.0 L18.8 118.0 L16.2 120.1 L6.1 130.2 L1.7 137.4 L0.0 147.6 Z`, mat: 'red', level: 1, fin: 'gloss' }
    ],
    face: { x: 0.031, y: 0.474, w: 0.395, h: 0.402, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/fin.d038ad13.webp", "box": [-6.0, -5.98, 179.16, 306.04]}, tile: "img/designs/tile-fin.70595608.webp",
  },
  teardrop: {
    name: "Teardrop", group: 'Curves', sheet: 'navy', base: 1.02,
    note: "A navy teardrop: a white inner panel and a crystal ball at its foot.",
    body: `M0.0 213.1 L2.0 225.3 L6.9 243.0 L4.3 262.9 L4.3 278.6 L2.3 288.9 L2.4 293.1 L3.2 295.5 L6.6 298.7 L12.6 300.0 L161.3 299.7 L166.1 298.9 L170.2 295.3 L175.8 270.6 L176.1 214.3 L174.1 194.4 L169.8 173.3 L159.5 139.2 L154.9 128.2 L136.6 91.9 L128.6 79.0 L112.7 59.1 L90.0 36.2 L82.6 30.5 L64.6 18.7 L44.5 8.7 L20.2 1.0 L12.0 0.0 L7.1 0.0 L4.1 1.2 L1.0 5.4 L1.0 11.5 L2.8 17.0 L11.2 31.1 L13.3 37.4 L19.2 63.8 L19.6 88.3 L18.6 96.0 L13.9 111.7 L12.2 126.8 L2.3 155.2 L0.0 176.8 Z`,
    layers: [
      { d: `M10.0 10.2 L10.9 13.2 L19.4 27.3 L22.1 35.4 L28.2 62.8 L28.6 88.2 L27.4 97.9 L22.8 113.3 L21.0 128.8 L11.2 157.0 L9.0 177.2 L9.0 212.5 L10.8 223.3 L15.9 242.3 L13.3 263.6 L13.3 279.1 L11.3 290.5 L13.4 291.0 L162.1 290.5 L166.8 269.7 L167.1 214.6 L165.2 195.8 L161.1 175.6 L151.1 142.4 L146.7 132.0 L128.7 96.2 L121.3 84.3 L105.9 65.0 L83.9 42.9 L77.4 37.8 L60.2 26.6 L41.0 17.1 L18.2 9.8 L10.0 9.0 Z`, mat: 'white', level: 1, fin: 'panel' },
      { d: `M82.7 260.0 L81.8 254.2 L79.7 248.8 L76.6 243.8 L72.6 239.5 L67.8 236.1 L62.5 233.6 L56.8 232.3 L50.9 232.1 L45.1 233.1 L39.6 235.1 L34.6 238.2 L30.3 242.3 L26.9 247.0 L24.5 252.4 L23.2 258.1 L23.0 264.0 L23.9 269.8 L26.0 275.2 L29.1 280.2 L33.1 284.5 L37.9 287.9 L43.2 290.4 L48.9 291.7 L54.8 291.9 L60.6 290.9 L66.1 288.9 L71.1 285.8 L75.4 281.7 L78.8 277.0 L81.2 271.6 L82.5 265.9 Z`, mat: 'frost', level: 2, fin: 'frost' }
    ],
    face: { x: 0.01, y: 0.444, w: 0.36, h: 0.367, level: 1, on: 0 },
    ink: 'printdark', art: {"src": "img/designs/teardrop.8b0aad0e.webp", "box": [-6.0, -6.0, 182.38, 306.01]}, tile: "img/designs/tile-teardrop.49046761.webp",
  },
  flame: {
    name: "Flame", group: 'Curves', sheet: 'clear', base: 1.02,
    note: "A clear flame with frosted waves and a yellow seal.",
    body: `M0.1 261.8 L0.4 265.9 L6.5 285.4 L5.0 293.9 L5.3 297.2 L7.8 299.4 L10.6 300.0 L144.5 299.7 L148.4 298.5 L149.2 297.5 L149.6 294.2 L139.3 279.3 L132.5 265.6 L126.3 246.5 L122.0 236.7 L121.3 224.9 L124.5 217.5 L130.9 211.1 L139.1 205.4 L145.9 198.5 L151.7 188.5 L153.8 182.2 L155.4 166.8 L153.1 147.3 L144.3 132.4 L131.8 119.5 L129.3 114.7 L130.0 111.0 L134.8 99.5 L147.7 82.1 L148.6 77.8 L147.1 75.8 L145.2 75.1 L126.5 74.3 L106.0 67.4 L97.0 65.3 L75.6 51.8 L63.0 39.1 L59.9 32.0 L51.9 20.0 L44.1 2.6 L39.4 0.0 L34.5 0.7 L29.2 5.5 L23.6 17.3 L20.2 35.0 L20.2 51.7 L22.9 63.1 L23.2 81.5 L27.7 95.7 L28.9 107.1 L33.1 119.7 L34.1 128.4 L39.0 146.4 L39.8 167.1 L44.3 183.8 L45.1 196.2 L47.4 205.0 L47.4 252.8 L45.7 257.4 L43.4 260.1 L38.5 263.5 L33.6 265.2 L25.7 264.3 L8.3 255.3 L4.3 255.6 L1.7 257.5 Z`,
    layers: [
      { d: `M16.4 283.9 L16.5 286.7 L15.9 290.0 L85.5 289.8 L85.5 284.8 L21.5 285.0 L21.2 282.0 L20.0 278.1 L24.1 279.2 L31.6 280.1 L35.0 280.2 L38.8 279.3 L45.3 276.9 L52.6 271.9 L56.9 267.4 L59.4 263.4 L61.8 256.9 L62.4 252.4 L62.3 203.3 L60.0 193.9 L59.1 181.1 L54.7 165.0 L54.2 150.0 L49.2 150.0 L49.7 165.8 L54.2 182.2 L55.0 194.7 L57.3 203.7 L57.4 252.4 L57.0 255.6 L54.3 262.5 L50.0 267.6 L43.0 272.4 L36.3 274.9 L31.9 275.2 L22.7 273.8 L11.6 268.2 Z M65.5 177.9 L66.4 183.1 L66.9 192.8 L69.1 201.4 L69.4 205.0 L69.3 254.6 L68.0 260.4 L64.7 268.6 L60.0 274.6 L56.3 277.9 L85.5 277.8 L85.5 272.8 L67.8 272.9 L71.3 266.1 L73.4 259.9 L74.3 255.1 L74.4 204.7 L74.0 200.4 L71.9 192.0 L71.0 179.4 L66.6 163.2 L66.2 150.0 L61.2 150.0 L61.7 164.0 Z`, mat: 'frost', level: 1, fin: 'frost' },
      { d: `M144.5 148.6 L143.5 140.4 L140.8 132.7 L136.7 125.5 L131.3 119.3 L124.8 114.3 L117.4 110.7 L109.4 108.6 L101.2 108.0 L93.1 109.1 L85.3 111.7 L78.1 115.9 L72.0 121.3 L67.0 127.8 L63.3 135.2 L61.2 143.1 L60.6 151.3 L61.7 159.5 L64.4 167.3 L68.5 174.4 L73.9 180.6 L80.4 185.6 L87.8 189.3 L95.8 191.4 L104.0 191.9 L112.1 190.8 L119.9 188.2 L127.0 184.1 L133.2 178.7 L138.2 172.1 L141.9 164.8 L144.0 156.8 Z`, mat: 'yellow', level: 1, fin: 'gloss' }
    ],
    face: { x: 0.092, y: 0.5, w: 0.203, h: 0.155, level: 1, on: 1 },
    ink: 'printdark', art: {"src": "img/designs/flame.803e1752.webp", "box": [-5.94, -6.0, 161.64, 306.01]}, tile: "img/designs/tile-flame.42e355fa.webp",
  },
  torch: {
    name: "Torch", group: 'Curves', sheet: 'clear', base: 1.00,
    note: "A tall clear leaf with a gold flame rising inside it and a gold ring at its tip.",
    body: `M0.0 144.0 L2.0 157.7 L4.9 167.2 L4.4 178.1 L11.0 188.4 L14.8 199.7 L15.1 229.6 L17.7 238.6 L17.4 242.9 L13.9 248.5 L12.2 253.3 L12.8 265.9 L15.1 275.7 L14.8 280.7 L11.3 289.2 L7.6 294.8 L7.6 297.8 L8.9 299.0 L13.2 300.0 L84.2 299.7 L92.7 298.5 L93.4 297.6 L93.2 296.3 L87.1 292.4 L83.5 288.4 L81.5 284.1 L80.8 268.7 L78.3 261.6 L77.6 252.5 L75.6 245.6 L74.6 221.8 L75.8 217.2 L79.8 210.1 L78.6 203.0 L78.9 197.7 L84.2 188.8 L90.7 169.1 L91.4 160.0 L94.3 150.6 L94.6 137.4 L97.6 127.7 L97.6 121.7 L91.4 108.3 L91.0 101.4 L88.1 92.0 L87.4 83.4 L82.5 65.1 L83.7 52.9 L78.5 43.8 L75.0 33.0 L75.2 20.6 L66.9 3.5 L62.9 0.1 L59.4 0.3 L50.3 9.8 L46.4 12.2 L35.2 10.4 L28.8 10.7 L13.6 17.8 L6.9 24.0 L1.5 34.7 L0.7 51.5 L3.4 56.6 L11.7 65.7 L12.4 70.7 L10.4 75.7 L5.8 82.4 L2.0 93.8 L0.4 101.8 Z`,
    layers: [
      { d: `M55.0 282.0 L60.5 277.6 L67.3 270.2 L70.9 264.8 L74.0 258.3 L73.6 253.0 L71.6 245.8 L70.6 222.0 L72.2 215.4 L68.9 208.4 L64.7 201.0 L59.6 193.5 L53.7 186.0 L46.9 162.0 L40.4 172.2 L36.4 179.6 L31.0 191.5 L27.9 199.8 L24.3 212.6 L22.7 221.2 L21.9 229.8 L21.9 238.3 L22.9 246.7 L23.7 250.8 L26.3 258.8 L29.9 266.3 L34.9 273.5 L41.1 280.0 L48.8 286.0 Z`, mat: 'gold', level: 1, fin: 'glitter' },
      { d: `M70.2 29.9 L69.5 26.4 L68.1 22.5 L65.8 18.9 L63.5 16.3 L60.1 13.8 L57.0 12.2 L53.0 10.9 L49.3 10.5 L46.2 12.3 L42.0 11.6 L40.6 12.2 L36.3 14.5 L33.1 17.3 L30.2 21.3 L28.5 25.1 L27.5 29.2 L27.4 34.1 L28.3 38.2 L29.9 42.1 L32.2 45.6 L35.2 48.6 L38.7 50.9 L42.6 52.5 L46.7 53.4 L50.9 53.4 L55.0 52.5 L58.9 50.9 L62.4 48.6 L65.4 45.6 L67.7 42.1 L69.4 38.2 L70.2 34.1 Z M63.4 33.4 L62.8 36.3 L61.7 38.9 L60.1 41.3 L58.1 43.3 L55.7 44.9 L53.1 46.0 L50.2 46.6 L47.4 46.6 L44.6 46.0 L41.9 44.9 L39.5 43.3 L37.5 41.3 L35.9 38.9 L34.8 36.3 L34.2 33.4 L34.2 30.6 L34.8 27.8 L35.9 25.1 L37.5 22.7 L39.5 20.7 L41.9 19.1 L44.6 18.0 L47.4 17.4 L50.2 17.4 L53.1 18.0 L55.7 19.1 L58.1 20.7 L60.1 22.7 L61.7 25.1 L62.8 27.8 L63.4 30.6 Z`, mat: 'gold', level: 1, fin: 'foil' }
    ],
    face: { x: 0.001, y: 0.668, w: 0.204, h: 0.26, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/torch.c133aad7.webp", "box": [-6.0, -5.91, 103.86, 306.1]}, tile: "img/designs/tile-torch.d8a96015.webp",
  },
  seawave: {
    name: "Ocean Wave", group: 'Curves', sheet: 'white', base: 1.04,
    note: "A white panel with three waves of blue rolling across its foot.",
    body: `M186.0 0.0 L14.0 0.0 L9.9 0.6 L7.4 1.7 L5.1 3.2 L2.4 6.2 L0.6 9.9 L0.0 14.0 L0.0 286.0 L0.3 288.7 L1.7 292.6 L4.1 295.9 L6.2 297.6 L9.9 299.4 L14.0 300.0 L186.0 300.0 L188.7 299.7 L192.6 298.3 L195.9 295.9 L197.6 293.8 L199.4 290.1 L200.0 286.0 L200.0 14.0 L198.9 8.6 L195.9 4.1 L191.4 1.1 Z`,
    layers: [
      { d: `M192.0 215.8 L184.0 215.9 L180.0 215.5 L172.0 214.0 L160.0 210.1 L140.0 201.9 L132.0 199.2 L124.0 197.1 L116.0 196.1 L108.0 196.2 L104.0 196.6 L96.0 198.3 L84.0 202.3 L60.0 211.9 L52.0 214.2 L44.0 215.6 L36.0 216.0 L32.0 215.7 L24.0 214.4 L12.0 210.8 L0.0 206.0 L0.0 286.0 L0.3 288.7 L1.1 291.4 L3.2 294.9 L6.2 297.6 L9.9 299.4 L14.0 300.0 L186.0 300.0 L188.7 299.7 L191.4 298.9 L194.9 296.8 L197.6 293.8 L199.4 290.1 L200.0 286.0 L200.0 214.7 Z`, mat: 'navy', level: 1, fin: 'brush' },
      { d: `M200.0 230.4 L180.0 237.5 L172.0 239.6 L160.0 241.0 L152.0 240.7 L144.0 239.4 L136.0 237.3 L112.0 228.7 L100.0 225.1 L88.0 223.2 L80.0 223.1 L72.0 224.0 L64.0 225.8 L56.0 228.3 L36.0 235.6 L24.0 239.1 L12.0 240.9 L8.0 241.0 L0.0 240.5 L0.0 286.0 L0.6 290.1 L2.4 293.8 L5.1 296.8 L8.6 298.9 L12.6 299.9 L186.0 300.0 L190.1 299.4 L193.8 297.6 L196.8 294.9 L198.3 292.6 L199.4 290.1 L200.0 286.0 Z`, mat: 'blue', level: 2, fin: 'gloss' },
      { d: `M192.0 253.0 L180.0 255.8 L156.0 263.5 L148.0 265.6 L136.0 267.7 L128.0 268.0 L120.0 267.4 L108.0 265.1 L80.0 256.2 L68.0 253.3 L56.0 252.0 L48.0 252.3 L40.0 253.4 L28.0 256.3 L0.0 265.1 L0.3 288.7 L1.7 292.6 L4.1 295.9 L7.4 298.3 L9.9 299.4 L12.6 299.9 L186.0 300.0 L188.7 299.7 L192.6 298.3 L194.9 296.8 L196.8 294.9 L198.9 291.4 L199.9 287.4 L200.0 252.1 Z`, mat: 'sky', level: 3, fin: 'gloss' }
    ],
    face: { x: -0.003, y: 0.669, w: 0.645, h: 0.58, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/seawave.5cf2f496.webp", "box": [-6.0, -6.0, 206.11, 306.01]}, tile: "img/designs/tile-seawave.62bc6518.webp",
  },
  summit: {
    name: "Summit", group: 'Curves', sheet: 'clear', base: 1.06,
    note: "A clear panel topped with mountain peaks: navy, blue, snow caps and a gold sun.",
    body: `M0.0 297.0 L0.9 299.1 L3.0 300.0 L198.5 300.0 L200.2 299.5 L201.3 298.1 L201.5 82.7 L143.6 1.3 L142.3 0.2 L140.5 0.1 L138.6 1.3 L93.9 68.1 L91.6 68.6 L90.0 67.7 L60.5 40.0 L57.9 39.2 L56.4 40.0 L0.2 94.5 Z`,
    layers: [
      { d: `M201.5 82.7 L201.0 81.6 L143.6 1.3 L141.7 0.0 L140.0 0.2 L138.6 1.3 L92.7 70.3 L60.5 40.0 L59.0 39.2 L57.9 39.2 L56.4 40.0 L0.9 93.5 L0.0 95.7 L0.0 148.9 L201.5 148.9 Z`, mat: 'navy', level: 1, fin: 'gloss' },
      { d: `M149.1 27.9 L163.2 34.0 L141.1 1.7 L127.0 23.9 L139.1 38.0 Z M60.5 54.1 L72.6 56.1 L58.4 42.0 L46.4 52.1 L50.4 60.2 Z`, mat: 'white', level: 2, fin: 'glitter' },
      { d: `M52.4 126.1 L51.9 122.6 L50.8 119.2 L49.0 116.1 L46.7 113.4 L43.8 111.3 L40.6 109.7 L37.2 108.8 L33.7 108.6 L30.1 109.0 L26.8 110.2 L23.7 111.9 L21.0 114.3 L18.9 117.1 L17.3 120.3 L16.4 123.7 L16.1 127.3 L16.6 130.8 L17.7 134.2 L19.5 137.2 L21.9 139.9 L24.7 142.1 L27.9 143.7 L31.3 144.6 L34.9 144.8 L38.4 144.3 L41.7 143.2 L44.8 141.4 L47.5 139.1 L49.7 136.3 L51.2 133.1 L52.2 129.6 Z`, mat: 'gold', level: 1, fin: 'panel' }
    ],
    face: { x: -0.116, y: 0.255, w: 0.517, h: 0.439, level: 0, on: -1 },
    ink: 'printdark', art: {"src": "img/designs/summit.a6081938.webp", "box": [-6.0, -5.95, 207.57, 306.06]}, tile: "img/designs/tile-summit.0c18e665.webp",
  },
};
/* </designs> */

/* What a design's layers add to its price. Each is another sheet and another
   cut, but the owner sets the prices: until they choose a layer price, a
   design costs what its single-sheet shape did. (0.12 a layer, capped at
   +50%, raised the shop's cards about 12% -- not done unasked.) */
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
const GENT_TRACE = `M98.8 299.9 L88.6 299.9 L88.5 294.2 L83.7 293.4 L81.2 292.5 L79.6 291.4 L79.0 290.2 L78.9 289.2
  L78.4 288.4 L77.4 288.0 L75.9 288.1 L74.2 287.7 L72.2 286.9 L71.5 286.0 L71.1 282.2 L71.1 278.9
  L71.5 277.4 L72.6 275.3 L72.7 274.7 L71.3 271.2 L70.6 266.8 L70.6 257.1 L71.3 252.4 L71.3 250.6
  L69.7 243.6 L69.7 242.0 L69.4 240.9 L68.6 234.4 L68.3 233.4 L67.8 228.5 L67.4 227.4 L66.9 221.3
  L66.5 220.4 L66.0 216.2 L64.9 211.1 L64.9 208.4 L63.2 204.0 L63.0 202.4 L63.0 199.5 L61.7 193.0
  L61.7 189.4 L61.5 187.8 L59.3 179.7 L57.3 173.8 L55.6 169.5 L54.2 166.7 L53.7 166.1 L53.0 166.9
  L52.8 171.7 L52.5 172.4 L52.5 177.7 L52.2 178.8 L52.2 189.3 L52.5 190.4 L52.5 200.6 L51.7 204.0
  L51.7 207.2 L51.9 208.1 L52.2 217.2 L52.5 218.3 L52.8 223.1 L53.0 223.8 L53.0 227.4 L53.4 228.5
  L53.4 233.3 L53.6 234.1 L53.4 240.5 L58.4 258.6 L58.4 262.8 L58.1 264.1 L55.6 272.6 L55.6 274.6
  L56.5 277.1 L56.5 282.8 L55.9 284.5 L55.2 285.3 L53.6 286.3 L51.8 286.3 L50.9 286.7 L49.7 288.1
  L47.1 289.8 L45.6 291.3 L44.2 292.0 L42.5 292.7 L40.3 293.1 L35.6 293.1 L34.3 292.5 L33.6 291.6
  L33.6 288.9 L34.1 287.0 L34.8 285.5 L36.3 283.8 L37.9 280.7 L39.3 279.0 L40.8 276.5 L42.0 275.1
  L42.1 274.3 L41.2 272.5 L38.7 262.9 L37.3 256.5 L35.8 251.6 L35.3 247.9 L34.9 246.9 L34.7 240.5
  L34.5 239.7 L34.5 235.0 L34.1 233.9 L34.1 228.2 L33.8 227.5 L33.8 215.6 L33.3 211.8 L33.3 208.7
  L33.0 207.7 L32.5 198.9 L32.1 197.7 L32.1 195.3 L31.6 191.7 L31.3 190.7 L31.0 187.9 L29.9 183.0
  L28.8 173.0 L27.3 166.8 L27.1 163.7 L25.7 156.2 L25.7 154.9 L25.3 153.1 L24.3 151.0 L24.3 129.9
  L24.5 129.0 L24.5 125.7 L24.9 124.7 L24.9 122.7 L23.8 121.2 L20.5 119.0 L18.8 117.4 L14.6 115.1
  L9.9 111.9 L4.2 107.2 L2.4 104.7 L1.2 101.0 L1.0 99.5 L2.3 91.9 L4.8 83.3 L8.4 68.5
  L9.6 65.3 L10.1 62.7 L11.9 58.3 L12.1 57.6 L11.8 56.3 L13.1 51.4 L14.6 50.4 L21.5 48.2
  L30.0 44.0 L32.9 42.9 L34.6 41.7 L36.4 39.0 L36.5 37.7 L35.1 35.5 L33.1 31.5 L30.8 29.2
  L29.8 27.7 L29.2 26.2 L28.8 24.3 L29.8 22.2 L29.9 21.4 L26.1 13.3 L26.0 11.7 L26.4 9.8
  L27.6 7.4 L30.9 3.4 L34.1 1.7 L39.9 -0.0 L42.6 -0.1 L44.6 0.3 L46.8 0.9 L48.5 1.8
  L50.6 3.6 L51.8 5.7 L53.7 7.3 L54.7 8.6 L55.7 11.1 L56.2 13.2 L56.2 15.1 L56.6 17.0
  L58.0 18.4 L58.7 19.9 L58.7 23.6 L58.1 25.3 L57.3 26.9 L55.6 27.9 L55.0 28.8 L55.0 30.6
  L54.5 34.0 L55.6 36.5 L58.6 39.7 L61.8 41.5 L70.9 44.3 L75.9 45.4 L79.0 46.5 L79.9 46.5
  L81.1 47.0 L81.6 47.6 L82.4 49.9 L82.5 52.1 L83.3 53.5 L86.8 61.8 L87.2 63.8 L88.0 65.8
  L88.3 67.6 L89.4 70.2 L89.8 72.5 L91.8 77.2 L93.4 82.2 L94.6 86.9 L96.2 90.7 L96.3 92.8
  L95.9 94.5 L94.6 97.4 L92.8 99.7 L77.6 114.7 L77.0 115.8 L77.0 117.0 L77.3 118.1 L77.8 123.9
  L78.2 125.0 L78.7 129.3 L78.9 138.8 L79.3 139.9 L79.3 143.4 L79.6 144.3 L79.6 150.2 L80.2 152.5
  L80.7 158.0 L81.0 159.0 L81.5 163.1 L81.8 167.0 L82.1 168.1 L82.1 169.7 L82.4 170.5 L82.6 178.0
  L83.0 179.1 L83.0 182.8 L83.2 183.5 L83.2 191.4 L83.0 192.2 L83.0 194.6 L83.2 195.7 L83.2 197.9
  L85.2 210.7 L86.1 214.2 L86.6 219.1 L86.9 220.2 L87.2 225.0 L87.4 225.8 L87.4 230.2 L87.8 231.3
  L87.8 236.3 L88.0 237.1 L88.0 240.5 L88.3 241.3 L88.3 244.9 L88.7 245.9 L88.7 247.6 L89.1 250.3
  L89.4 259.2 L89.1 259.9 L88.9 265.3 L86.6 274.7 L86.6 276.4 L87.6 278.6 L88.8 280.5 L92.0 284.6
  L95.2 288.0 L97.4 291.5 L98.6 292.9 L98.9 293.6 Z`;

const LADY_TRACE = `M66.2 299.9 L44.5 299.9 L44.2 299.8 L44.0 290.9 L49.1 271.2 L48.9 260.8 L43.8 241.0 L41.0 226.2
  L40.8 223.3 L41.0 207.9 L40.5 204.5 L40.5 200.5 L40.0 199.7 L38.9 199.1 L38.6 198.3 L38.3 193.6
  L37.6 188.4 L36.7 184.4 L36.5 181.2 L35.6 177.4 L34.6 169.8 L34.0 167.8 L33.5 163.8 L32.7 160.2
  L32.4 157.3 L31.1 151.0 L31.1 139.4 L31.9 136.4 L31.9 134.3 L32.9 130.7 L32.9 129.7 L34.9 123.1
  L35.6 117.4 L35.4 116.9 L34.9 116.9 L33.2 118.7 L30.6 119.6 L27.8 118.8 L25.1 117.0 L19.0 111.3
  L15.4 106.8 L12.0 100.8 L8.1 94.9 L7.3 92.7 L7.3 87.9 L7.6 86.8 L13.0 74.5 L16.9 67.6
  L20.6 59.9 L25.6 52.7 L28.2 49.8 L28.8 48.6 L29.2 47.3 L29.1 46.4 L27.1 45.8 L26.8 45.1
  L27.6 44.7 L29.5 44.5 L30.9 43.5 L30.6 42.9 L28.4 42.1 L27.8 41.3 L27.7 40.5 L28.2 40.1
  L31.9 40.4 L32.7 40.1 L35.1 40.1 L35.7 39.8 L35.9 39.2 L35.6 38.4 L35.6 34.5 L34.7 31.7
  L34.0 30.7 L34.3 30.0 L36.9 27.8 L39.4 26.2 L40.5 25.1 L40.8 24.5 L40.5 23.0 L40.7 22.0
  L42.5 19.9 L44.1 15.4 L46.1 12.5 L48.1 10.5 L51.0 6.5 L53.0 4.5 L56.9 1.7 L59.7 0.5
  L61.7 -0.1 L64.9 -0.1 L67.2 0.7 L69.0 2.0 L70.5 3.4 L73.4 5.0 L74.8 6.6 L76.2 9.0
  L79.0 17.5 L79.9 19.1 L81.5 24.6 L81.5 28.2 L81.2 29.8 L79.9 34.8 L79.9 40.6 L80.1 42.3
  L82.9 49.8 L86.9 51.4 L89.3 53.4 L90.8 55.2 L92.0 58.9 L92.5 63.0 L92.5 76.0 L92.3 76.8
  L92.3 80.4 L92.1 81.1 L92.0 83.0 L91.7 84.1 L91.4 88.0 L90.3 94.1 L90.3 96.4 L89.8 99.8
  L89.8 106.0 L89.6 106.8 L89.3 112.6 L89.0 113.7 L89.0 115.0 L88.2 119.4 L86.1 128.6 L83.7 141.0
  L83.7 145.5 L83.3 146.6 L83.3 149.5 L83.1 150.2 L82.8 155.4 L82.3 159.3 L79.9 168.4 L77.2 176.2
  L76.3 180.2 L76.3 182.3 L74.5 190.7 L74.0 194.1 L74.0 197.2 L73.6 198.3 L73.3 198.8 L72.2 199.4
  L71.0 199.4 L69.9 199.7 L65.9 199.8 L65.3 200.1 L65.0 200.8 L65.0 205.5 L67.4 213.4 L68.3 217.3
  L68.8 221.4 L68.8 235.5 L68.6 236.2 L68.3 242.3 L68.0 243.3 L67.7 248.1 L67.5 248.9 L67.5 255.9
  L70.1 263.0 L70.7 269.0 L71.0 270.1 L71.5 274.5 L72.0 276.6 L72.3 279.7 L73.4 283.8 L73.1 286.5
  L71.9 289.2 L69.1 291.9 L66.3 294.2 Z
  M31.3 110.2 L32.2 109.7 L36.5 105.5 L38.0 104.6 L38.9 102.9 L38.9 101.9 L38.6 101.1 L38.3 97.1
  L36.5 89.6 L36.2 86.2 L35.9 85.1 L35.6 81.4 L34.9 76.4 L33.3 72.5 L32.4 71.3 L30.8 72.0
  L29.5 73.4 L24.5 80.0 L18.9 90.2 L18.9 91.2 L24.7 103.4 L29.5 109.5 L30.4 110.2 Z
  M61.3 295.1 L61.3 294.2 L59.4 292.9 L58.7 293.0 L56.3 294.3 L56.5 295.1 Z`;

const SUIT_TRACE = `M92.1 299.9 L30.9 299.9 L30.8 299.8 L30.7 294.2 L28.0 293.9 L25.8 293.3 L25.1 292.4 L24.7 291.1
  L25.2 287.3 L27.7 282.4 L29.5 280.1 L31.7 275.4 L31.9 274.4 L31.2 270.2 L30.4 266.9 L30.4 264.6
  L29.2 253.8 L29.1 248.5 L28.9 247.7 L28.9 246.1 L26.6 234.4 L26.6 233.0 L26.2 232.0 L26.2 229.9
  L26.0 229.2 L26.0 207.7 L26.2 206.9 L26.2 203.2 L26.0 202.3 L25.7 193.0 L25.5 192.3 L25.5 189.9
  L25.0 187.6 L24.7 179.3 L24.5 178.5 L24.2 173.9 L23.9 172.9 L22.9 163.1 L22.1 159.5 L22.1 157.3
  L21.5 155.0 L21.0 151.0 L20.0 148.2 L18.7 145.5 L16.9 144.4 L14.8 142.3 L12.7 138.7 L12.2 135.9
  L11.0 133.3 L10.7 131.2 L9.1 126.6 L8.9 125.3 L8.9 123.0 L9.1 122.1 L7.8 118.0 L7.5 115.7
  L7.5 112.2 L7.3 111.2 L7.5 109.3 L6.8 107.0 L6.8 104.3 L7.7 98.9 L7.8 94.5 L8.0 93.7
  L8.2 88.3 L8.6 87.3 L8.6 84.3 L9.3 81.2 L9.4 74.7 L11.2 66.1 L11.2 64.9 L12.1 62.6
  L13.8 59.9 L14.2 54.2 L14.8 53.5 L15.8 53.0 L24.9 49.6 L34.5 44.7 L36.9 42.7 L38.1 41.2
  L38.7 39.9 L38.2 37.1 L36.8 34.8 L36.0 32.2 L34.1 31.3 L32.9 30.0 L30.7 25.3 L30.4 23.6
  L30.9 22.3 L32.2 21.5 L32.5 21.0 L31.2 15.0 L31.2 10.3 L32.3 6.9 L34.0 4.1 L35.1 2.9
  L37.2 1.6 L41.1 0.4 L44.3 -0.1 L46.2 -0.1 L50.2 0.7 L53.1 2.5 L55.5 5.3 L58.1 6.7
  L59.8 8.4 L60.9 10.9 L60.9 13.8 L60.4 17.1 L60.4 19.1 L62.6 20.8 L63.0 21.8 L63.0 23.6
  L61.4 27.6 L58.9 30.3 L58.0 33.7 L56.6 36.4 L56.5 37.0 L56.7 38.1 L57.5 39.2 L59.1 40.4
  L62.3 43.6 L63.9 44.4 L74.5 48.1 L82.0 50.1 L83.0 50.9 L83.5 52.0 L84.2 55.7 L85.1 57.7
  L87.4 64.9 L88.2 68.8 L88.2 70.5 L89.2 74.7 L89.2 76.6 L90.8 83.5 L91.0 87.1 L92.6 93.5
  L92.6 96.3 L92.9 97.3 L92.9 101.7 L92.6 102.7 L92.6 114.3 L91.9 119.2 L91.9 120.7 L90.8 126.4
  L90.0 132.5 L88.5 137.8 L87.8 141.5 L87.3 142.1 L85.6 142.6 L83.5 144.8 L82.2 148.3 L81.9 150.3
  L82.2 155.6 L82.4 156.3 L82.2 162.1 L83.0 165.3 L83.3 171.0 L84.5 180.6 L84.5 197.3 L85.1 199.6
  L85.1 200.7 L84.5 202.2 L84.5 203.1 L85.1 205.5 L85.6 211.1 L86.6 216.2 L86.8 220.8 L87.2 221.9
  L87.5 226.4 L87.7 227.2 L87.7 232.1 L87.5 232.8 L87.5 235.9 L87.2 236.9 L87.2 258.4 L86.8 259.5
  L86.3 266.7 L85.0 272.9 L84.3 274.4 L84.1 275.8 L86.2 280.1 L89.6 284.4 L92.7 290.0 L93.1 291.6
  L93.1 292.9 L92.8 293.6 L92.1 294.3 Z
  M82.4 295.1 L82.3 294.2 L79.2 292.9 L77.5 291.6 L76.1 288.4 L75.5 287.7 L71.5 286.8 L70.0 285.9
  L69.5 285.0 L69.5 279.5 L69.3 277.4 L70.2 274.0 L70.2 273.2 L68.9 268.1 L68.9 266.8 L69.5 264.1
  L69.3 262.4 L69.2 257.2 L68.9 256.1 L68.9 249.9 L68.6 249.2 L68.6 247.1 L68.4 246.4 L67.6 236.8
  L67.4 236.0 L67.2 230.0 L66.3 224.5 L66.0 211.3 L64.5 208.2 L63.7 206.2 L63.0 201.7 L63.0 198.5
  L62.7 196.6 L58.6 181.1 L54.8 171.7 L52.7 167.2 L52.2 166.9 L51.8 167.5 L50.7 172.4 L50.2 177.0
  L49.4 179.8 L49.0 186.3 L48.3 188.9 L48.3 191.5 L47.6 195.9 L47.6 201.8 L47.4 202.7 L47.4 204.6
  L46.0 209.2 L46.0 215.7 L45.5 217.6 L45.5 222.1 L45.8 223.2 L45.8 245.3 L45.5 246.1 L45.5 249.6
  L46.0 251.3 L46.5 255.5 L47.4 258.7 L47.4 264.0 L46.8 267.2 L44.5 274.2 L45.0 277.4 L45.0 282.8
  L44.6 284.7 L43.8 285.9 L42.7 286.6 L41.4 287.0 L41.0 287.5 L40.8 289.7 L39.7 291.8 L35.2 293.8
  L33.6 294.2 L31.9 294.2 L31.9 295.0 L32.2 295.1 Z`;

const GOWN_BALL_TRACE = `M104.6 299.9 L87.7 299.9 L87.6 294.2 L85.6 294.2 L84.5 293.8 L81.8 293.5 L76.8 292.2 L73.7 291.9
  L68.8 290.8 L67.8 290.3 L66.5 289.1 L65.8 287.8 L65.6 286.5 L64.3 285.7 L62.2 285.7 L61.2 285.4
  L58.4 285.7 L57.4 285.4 L51.6 285.4 L50.9 285.7 L49.3 285.7 L44.3 287.0 L41.4 287.3 L40.4 287.6
  L36.6 287.9 L33.4 289.3 L30.7 289.9 L27.8 291.3 L25.9 291.3 L23.2 289.9 L19.4 288.5 L12.8 287.3
  L6.9 287.0 L-0.6 284.5 L-3.0 284.5 L-4.6 284.8 L-7.0 284.2 L-8.9 284.2 L-10.0 283.8 L-13.5 283.6
  L-14.6 283.2 L-17.1 283.0 L-22.5 281.2 L-27.9 278.5 L-30.0 277.8 L-37.5 274.3 L-39.0 273.4 L-43.3 269.0
  L-45.2 266.8 L-45.8 265.6 L-45.7 264.4 L-41.9 257.0 L-40.0 252.4 L-36.6 245.4 L-26.5 220.7 L-24.2 215.9
  L-16.9 198.5 L-14.9 194.2 L-12.7 188.5 L-8.8 179.8 L-6.0 174.6 L-4.2 170.1 L-2.0 165.8 L2.4 154.7
  L2.2 153.4 L0.8 151.2 L0.3 149.6 L0.3 147.0 L0.9 142.8 L1.6 141.4 L3.2 139.8 L6.0 135.9
  L7.4 133.6 L8.6 130.8 L13.9 116.4 L17.0 105.0 L18.9 99.7 L20.4 96.2 L21.6 91.6 L22.3 83.7
  L21.9 82.5 L19.4 77.7 L19.2 75.8 L22.3 67.5 L22.3 59.5 L22.9 56.2 L24.1 54.2 L25.7 52.6
  L27.5 51.5 L31.7 50.0 L37.0 49.7 L38.9 49.1 L41.0 47.9 L42.3 46.6 L43.0 45.1 L43.7 42.4
  L43.5 39.3 L40.0 36.1 L38.8 34.4 L38.8 29.0 L38.4 28.0 L38.1 24.7 L37.6 23.0 L37.5 21.6
  L37.2 20.5 L37.2 15.9 L36.5 13.3 L38.2 8.0 L39.9 5.5 L43.5 2.5 L47.1 0.9 L50.1 -0.1
  L53.6 0.7 L56.8 2.3 L59.7 5.5 L61.7 6.6 L63.3 8.2 L65.4 11.4 L67.6 18.7 L67.6 20.6
  L67.2 22.0 L66.2 23.6 L64.4 27.5 L61.8 32.0 L61.1 34.0 L61.1 36.3 L60.6 37.0 L59.8 37.5
  L59.0 37.8 L57.6 37.5 L57.1 37.7 L56.5 39.6 L56.5 42.0 L57.6 44.7 L58.5 46.0 L61.7 49.2
  L66.4 52.4 L68.6 54.5 L69.8 56.8 L71.1 61.8 L71.3 64.3 L71.7 65.4 L71.7 73.7 L71.3 74.8
  L71.3 93.7 L71.7 94.9 L71.9 100.3 L72.3 101.4 L72.3 107.3 L72.7 108.3 L72.7 116.5 L72.3 117.6
  L72.5 120.8 L74.1 123.6 L80.2 132.2 L84.7 137.6 L89.9 145.0 L100.3 162.7 L105.6 173.3 L110.8 185.3
  L114.1 191.8 L120.6 206.1 L123.0 212.7 L124.5 216.2 L126.0 221.1 L128.0 226.1 L136.7 254.0 L143.0 269.0
  L145.7 274.4 L145.3 275.8 L143.2 277.4 L140.6 280.0 L130.5 285.2 L129.4 286.4 L128.5 288.1 L127.5 289.1
  L126.4 289.6 L124.2 290.1 L117.6 290.4 L116.5 290.7 L114.2 291.0 L107.0 291.0 L106.4 291.2 L104.7 294.2 Z`;

const GOWN_TRAIN_TRACE = `M115.3 299.9 L63.3 299.9 L63.2 299.8 L63.2 294.3 L62.7 294.1 L61.0 293.7 L57.6 293.4 L51.5 291.7
  L49.4 291.5 L47.4 291.5 L42.6 292.6 L38.8 292.6 L38.0 292.3 L28.5 292.3 L25.6 290.9 L21.7 289.4
  L16.4 288.7 L11.3 286.6 L8.0 284.8 L6.8 284.6 L3.1 284.6 L2.0 284.2 L0.4 284.2 L-0.3 284.0
  L-3.3 284.0 L-6.0 283.1 L-9.4 282.5 L-10.2 281.7 L-10.1 280.2 L-8.9 278.7 L-6.7 277.8 L-4.9 277.7
  L-4.0 276.8 L-1.7 267.8 L0.3 261.9 L1.4 257.1 L2.0 253.6 L3.4 241.6 L4.0 238.6 L5.1 227.3
  L5.5 226.2 L5.7 222.0 L6.4 219.3 L6.8 209.9 L7.2 208.8 L7.7 201.9 L8.1 200.8 L8.6 194.1
  L9.2 190.8 L9.4 184.7 L9.8 183.3 L9.8 180.7 L9.4 179.6 L9.2 175.5 L6.7 164.5 L4.3 156.5
  L3.2 151.8 L2.9 149.5 L2.3 147.2 L2.0 142.9 L1.7 141.9 L1.7 139.2 L2.0 138.1 L2.1 135.4
  L2.5 130.6 L4.3 122.8 L5.5 119.1 L6.0 116.1 L5.7 115.7 L5.2 115.6 L3.5 116.1 L1.5 115.7
  L0.0 115.1 L-3.2 113.0 L-11.0 106.9 L-17.5 100.2 L-21.9 94.4 L-24.2 91.8 L-25.7 89.5 L-26.4 87.4
  L-25.7 85.5 L-24.5 83.2 L-20.3 77.5 L-17.6 74.6 L-9.4 66.6 L-3.3 58.6 L0.5 54.8 L4.6 51.3
  L7.0 49.6 L11.0 48.3 L16.7 47.1 L18.3 46.3 L19.6 46.5 L20.4 46.3 L21.8 45.5 L23.7 43.6
  L24.5 41.9 L24.9 40.5 L24.9 36.4 L24.0 34.7 L22.7 33.3 L21.1 29.5 L18.5 27.4 L17.6 25.9
  L15.7 20.7 L15.7 17.7 L17.6 11.4 L20.2 6.2 L23.4 3.0 L24.9 1.9 L26.6 0.9 L28.8 0.2
  L30.4 -0.1 L32.7 0.2 L34.9 1.1 L36.4 2.1 L38.6 2.5 L40.2 3.3 L41.3 4.5 L42.8 6.9
  L45.2 13.0 L45.5 15.2 L46.5 19.2 L45.9 21.8 L43.5 27.2 L43.5 29.1 L40.1 34.7 L40.1 36.8
  L41.3 39.8 L42.2 40.9 L43.5 41.8 L45.4 42.8 L49.0 44.2 L53.5 45.2 L58.1 45.2 L59.3 45.5
  L61.6 46.4 L63.3 47.6 L65.2 49.9 L66.1 51.8 L67.0 56.9 L67.2 62.3 L67.6 63.4 L67.6 69.5
  L67.2 70.6 L67.0 77.6 L66.7 78.4 L66.7 80.4 L66.4 81.4 L65.9 88.0 L64.4 95.7 L64.4 100.5
  L60.9 113.9 L58.9 119.3 L55.9 126.4 L54.7 130.1 L54.7 142.3 L53.8 147.5 L52.2 152.5 L49.7 157.4
  L46.7 162.3 L41.7 172.9 L40.1 176.8 L38.1 183.9 L38.3 195.6 L38.7 196.7 L38.9 203.2 L39.5 206.4
  L40.0 211.4 L40.4 212.5 L41.8 221.9 L42.4 224.3 L42.9 229.4 L48.1 249.0 L49.7 254.4 L53.0 264.0
  L53.8 265.9 L54.7 266.7 L58.8 267.4 L61.9 267.4 L63.0 267.7 L66.3 267.7 L69.9 268.5 L75.9 268.5
  L76.9 268.8 L83.4 269.1 L88.3 270.5 L94.0 270.8 L96.0 271.7 L99.2 271.7 L100.6 271.4 L102.7 272.4
  L104.7 272.9 L106.5 274.3 L107.4 274.7 L109.6 274.5 L111.2 275.1 L113.1 275.1 L114.0 274.9 L114.6 275.0
  L117.3 276.8 L119.3 277.2 L120.8 278.1 L123.3 280.6 L125.1 281.9 L126.1 283.4 L126.2 284.8 L125.2 286.4
  L125.3 288.2 L124.4 290.2 L123.2 291.3 L118.2 293.4 L115.5 294.2 Z
  M4.9 107.7 L7.0 106.1 L8.1 104.1 L10.6 102.3 L12.7 100.9 L14.5 100.4 L16.1 99.6 L16.5 98.9
  L16.6 96.9 L16.9 95.8 L16.9 90.0 L16.2 86.4 L14.4 80.9 L13.0 74.5 L12.2 73.0 L10.1 70.8
  L8.1 69.8 L6.9 70.2 L-0.2 75.3 L-9.0 84.1 L-11.3 86.6 L-12.0 87.9 L-11.9 88.9 L-9.9 92.7
  L-5.3 99.8 L2.2 107.0 L3.5 107.7 Z`;

const GOWN_EVENING_TRACE = `M83.0 299.9 L44.8 299.9 L44.7 299.8 L44.6 294.3 L44.3 294.1 L42.4 293.5 L37.1 293.5 L34.0 293.0
  L32.4 292.5 L27.1 291.7 L25.4 291.1 L12.6 289.2 L5.1 287.2 L1.0 285.6 L-1.2 284.5 L-2.6 283.5
  L-4.5 281.5 L-5.7 279.2 L-5.4 277.6 L-3.3 274.4 L-2.4 273.5 L0.6 272.3 L4.6 271.1 L6.8 270.2
  L9.4 269.9 L11.6 268.8 L13.1 269.3 L14.1 269.3 L18.1 268.2 L21.3 268.2 L22.3 268.0 L24.3 268.2
  L25.4 267.8 L27.7 266.0 L32.0 259.8 L32.4 258.7 L34.6 255.4 L36.9 252.4 L39.4 245.5 L40.7 243.7
  L41.8 241.3 L41.9 238.6 L42.5 236.4 L43.3 233.2 L44.9 229.0 L46.0 223.5 L46.3 220.9 L47.1 218.7
  L48.2 213.8 L48.2 211.9 L49.2 205.0 L49.5 204.2 L50.1 200.4 L50.9 196.6 L51.7 190.5 L51.7 188.8
  L52.0 187.7 L52.0 183.9 L52.3 183.1 L52.3 178.0 L52.0 177.2 L52.0 175.6 L49.5 164.7 L46.3 156.3
  L45.7 154.2 L45.0 153.1 L43.8 148.7 L42.2 145.3 L41.4 142.1 L40.8 136.4 L39.7 132.0 L39.7 129.5
  L38.1 124.5 L38.1 121.6 L38.4 120.5 L37.9 116.4 L37.5 115.3 L37.5 113.4 L36.1 107.6 L35.4 105.9
  L34.2 104.3 L31.7 102.9 L28.6 101.9 L20.0 99.9 L15.8 98.4 L6.3 93.7 L1.0 91.4 L-0.2 90.4
  L-1.1 89.1 L-1.1 86.2 L-0.3 83.9 L1.0 81.2 L7.2 73.1 L10.0 70.1 L14.0 66.6 L19.1 61.5
  L24.1 55.6 L32.0 47.2 L34.9 45.6 L36.1 45.3 L40.7 45.3 L46.4 43.8 L49.8 42.2 L51.2 41.0
  L52.4 39.1 L52.8 37.4 L52.2 36.6 L50.7 36.0 L49.8 34.6 L50.0 33.3 L50.9 31.7 L51.2 30.6
  L50.9 29.3 L49.4 26.8 L48.5 23.7 L48.5 22.3 L49.2 20.4 L49.0 16.7 L49.2 14.1 L50.0 11.8
  L50.9 9.8 L51.9 8.5 L53.7 6.6 L56.1 2.7 L58.7 0.8 L62.4 -0.1 L66.1 -0.1 L67.7 0.3
  L70.3 1.4 L72.9 3.3 L75.5 5.7 L76.9 7.5 L78.0 9.3 L78.6 11.6 L80.2 14.1 L80.6 15.3
  L80.2 20.8 L78.4 22.9 L78.1 25.2 L77.7 26.2 L75.0 28.2 L74.3 29.8 L74.3 31.9 L75.4 35.1
  L75.4 36.0 L74.7 37.1 L73.0 37.7 L72.1 37.0 L71.6 35.7 L70.9 35.4 L67.9 38.3 L66.9 41.3
  L66.7 43.5 L66.7 44.8 L67.4 47.1 L68.5 48.9 L70.2 50.6 L72.9 51.8 L76.3 52.7 L79.2 53.0
  L80.5 53.5 L82.8 54.7 L85.5 57.5 L89.6 64.1 L94.7 74.5 L99.1 82.2 L101.7 87.5 L104.3 91.6
  L105.5 95.2 L105.5 97.3 L104.9 99.5 L99.4 107.4 L95.3 112.1 L91.1 116.2 L89.6 117.1 L86.4 117.8
  L85.7 118.7 L86.2 121.2 L87.9 125.3 L89.0 129.0 L90.0 137.1 L90.0 150.1 L89.8 150.8 L89.8 157.1
  L89.5 157.9 L89.5 173.3 L89.8 174.2 L89.8 178.2 L90.4 180.9 L91.7 184.5 L91.8 186.0 L94.4 193.1
  L95.0 196.8 L95.0 199.8 L95.2 200.7 L94.7 205.0 L94.7 232.1 L95.2 236.9 L95.2 240.1 L95.0 241.1
  L95.0 243.3 L95.2 244.0 L95.2 250.2 L95.0 251.8 L95.2 252.5 L95.2 254.4 L95.6 255.5 L95.8 265.7
  L96.3 267.8 L96.6 275.0 L97.7 278.2 L97.7 281.8 L98.3 283.5 L98.3 284.7 L97.4 286.8 L96.4 287.9
  L92.4 290.0 L90.8 291.4 L89.1 291.9 L86.7 291.9 L85.7 292.2 L83.1 294.2 Z
  M39.1 100.5 L39.6 100.0 L39.5 98.4 L35.4 83.3 L34.3 80.2 L34.1 79.0 L34.0 75.4 L32.7 72.6
  L31.0 69.7 L30.4 69.2 L29.7 69.1 L28.2 70.1 L19.5 78.5 L18.1 79.5 L14.5 83.2 L13.9 83.9
  L13.7 84.7 L14.1 85.5 L17.4 88.4 L24.8 93.6 L29.3 96.1 L34.0 98.1 L38.3 100.4 Z
  M88.1 108.5 L90.2 106.6 L92.2 103.1 L94.7 97.0 L94.7 94.6 L94.2 93.4 L91.6 89.2 L90.2 87.5
  L86.5 82.0 L81.7 76.0 L81.2 75.6 L80.6 75.5 L80.1 76.3 L79.0 79.6 L78.6 82.2 L77.9 83.6
  L75.9 90.4 L75.9 94.0 L76.5 96.6 L78.4 102.1 L81.4 104.0 L84.7 105.4 L86.3 107.0 L87.3 108.3 Z`;

const GRAD_TRACE = `M73.3 299.9 L32.3 299.9 L32.2 299.8 L32.1 294.2 L29.4 293.5 L28.3 292.5 L28.1 290.8 L29.8 287.3
  L30.2 285.9 L32.1 282.2 L34.6 279.1 L35.5 277.4 L35.5 276.8 L30.5 268.6 L29.5 265.1 L28.7 259.2
  L28.4 258.1 L28.1 254.6 L27.7 253.8 L26.8 253.1 L24.8 253.1 L22.9 252.4 L22.4 251.7 L22.3 250.4
  L21.9 249.6 L20.9 249.3 L19.2 249.6 L18.8 248.8 L19.2 244.4 L19.3 241.7 L19.5 240.8 L19.5 237.0
  L19.9 236.0 L19.9 231.4 L20.1 230.6 L20.1 226.4 L20.4 225.7 L20.4 219.8 L20.6 219.1 L20.6 213.0
  L21.0 211.9 L21.0 205.2 L21.2 204.3 L21.2 196.9 L21.5 196.1 L21.7 182.2 L22.1 181.1 L22.1 173.9
  L22.3 173.2 L22.3 168.8 L22.6 167.9 L22.5 160.4 L22.3 159.9 L21.6 159.5 L16.4 158.0 L4.1 153.7
  L-1.4 151.5 L-1.8 150.7 L0.2 138.1 L0.8 135.8 L2.6 123.0 L3.0 121.9 L6.0 103.7 L6.6 101.1
  L6.6 99.9 L7.9 91.9 L10.7 78.7 L14.0 68.9 L16.3 64.6 L18.8 62.1 L20.3 61.2 L25.7 59.3
  L28.3 58.1 L36.4 53.2 L39.5 51.0 L41.0 49.5 L42.5 47.2 L42.5 45.3 L41.9 42.3 L40.1 38.5
  L38.7 37.3 L38.3 36.7 L37.5 33.7 L37.0 30.4 L37.2 29.4 L38.2 28.3 L38.6 26.8 L38.6 22.1
  L38.9 21.2 L39.4 17.8 L38.6 16.8 L28.2 10.7 L27.4 10.1 L27.3 9.6 L27.8 8.9 L29.5 8.2
  L54.1 -0.1 L54.7 -0.0 L56.1 0.6 L64.9 6.5 L68.9 9.3 L70.0 10.4 L76.6 14.8 L77.0 15.4
  L77.0 15.9 L76.5 16.4 L71.6 17.8 L71.0 18.2 L70.7 18.8 L71.1 19.7 L72.5 21.2 L72.9 22.1
  L72.6 24.6 L72.6 45.8 L72.0 48.6 L71.2 49.1 L70.6 49.1 L69.1 48.5 L68.5 47.7 L68.7 33.0
  L69.1 31.9 L69.1 21.8 L69.8 19.8 L69.8 18.7 L69.1 18.0 L65.7 18.9 L64.8 19.4 L64.3 20.2
  L64.3 21.3 L64.8 22.5 L64.7 23.4 L64.3 24.7 L64.6 26.1 L64.6 27.6 L64.9 28.3 L65.8 29.1
  L66.1 29.8 L65.7 32.7 L65.0 35.8 L64.5 36.8 L63.2 38.0 L62.4 40.1 L60.7 43.2 L60.2 46.1
  L60.8 48.1 L62.2 50.1 L64.6 52.2 L74.7 58.3 L77.1 59.3 L81.9 60.5 L83.1 61.0 L86.0 64.2
  L88.4 68.9 L90.6 76.1 L93.0 87.1 L94.7 97.3 L95.0 98.4 L95.8 104.2 L97.2 111.7 L97.7 116.5
  L98.3 119.2 L99.1 126.6 L99.4 127.7 L100.2 138.3 L100.6 139.4 L100.6 141.7 L101.3 148.0 L101.3 150.4
  L101.7 151.4 L101.7 154.2 L101.0 155.1 L92.1 157.8 L82.9 160.1 L82.3 160.5 L82.0 161.1 L82.0 164.6
  L82.2 165.3 L82.2 168.0 L82.6 169.1 L82.6 173.4 L82.8 174.3 L82.8 178.1 L83.1 179.0 L83.1 182.8
  L83.3 183.6 L83.3 189.5 L83.7 190.7 L83.7 196.7 L83.9 197.4 L84.0 207.4 L84.2 208.2 L84.4 229.2
  L84.8 230.1 L84.8 246.0 L85.1 246.9 L85.1 248.7 L84.6 249.7 L83.9 250.2 L76.0 251.7 L75.2 252.2
  L74.9 252.9 L74.8 254.5 L74.5 255.6 L74.2 264.1 L73.7 268.0 L73.0 271.0 L69.8 279.8 L69.8 281.1
  L70.1 281.7 L71.6 283.2 L73.6 286.3 L74.7 288.6 L75.1 290.0 L74.9 291.8 L73.4 294.3 Z
  M65.5 295.1 L65.4 294.2 L61.7 292.4 L60.8 291.4 L60.2 290.2 L60.2 288.4 L59.9 287.8 L57.3 286.0
  L56.5 284.0 L56.5 281.1 L56.9 280.0 L56.9 278.0 L56.1 275.5 L55.8 272.9 L54.9 269.0 L54.9 262.9
  L55.2 261.4 L57.8 254.5 L58.0 253.5 L57.2 252.8 L51.2 253.3 L50.7 252.6 L51.0 251.0 L50.8 250.7
  L50.2 250.3 L49.6 250.4 L48.8 251.0 L48.5 251.7 L48.5 253.4 L48.9 254.5 L48.9 260.5 L48.5 261.7
  L48.9 263.1 L48.9 269.4 L48.5 270.5 L48.5 272.6 L47.8 276.1 L48.0 280.7 L48.3 281.5 L48.0 283.1
  L46.9 284.4 L44.8 285.2 L43.9 286.1 L43.6 286.6 L43.6 288.3 L43.2 289.5 L42.0 291.0 L38.0 292.9
  L33.2 294.2 L33.2 295.1 Z`;

const GOWN_SWEEP_TRACE = `M98.2 299.9 L85.8 299.9 L85.7 294.2 L79.6 293.1 L73.9 291.4 L69.3 290.6 L62.1 288.0 L59.3 287.4
  L56.2 287.4 L55.0 287.8 L51.2 287.8 L47.2 289.0 L45.9 289.0 L42.0 289.7 L40.8 289.7 L40.0 289.5
  L39.3 288.7 L37.9 285.9 L36.3 284.3 L32.4 282.4 L29.9 280.4 L29.3 279.5 L28.9 278.0 L29.1 276.4
  L30.2 273.1 L30.4 272.0 L30.1 270.6 L29.4 269.1 L26.8 265.5 L23.7 262.4 L21.8 261.1 L19.9 260.7
  L18.9 260.7 L17.0 261.3 L12.0 264.0 L11.1 264.3 L9.7 264.2 L8.4 265.1 L6.5 267.9 L5.6 270.5
  L5.2 273.1 L5.8 275.4 L5.5 276.1 L4.6 276.8 L2.6 276.4 L2.0 276.7 L1.1 278.0 L-0.0 280.9
  L-0.8 281.7 L-6.7 283.3 L-11.4 283.6 L-12.1 283.8 L-14.7 283.6 L-15.5 283.0 L-15.9 282.3 L-15.9 280.4
  L-15.5 279.2 L-9.5 272.4 L-8.4 268.0 L-7.9 265.4 L-7.9 264.1 L-8.2 263.7 L-8.8 263.7 L-10.5 264.3
  L-14.1 264.5 L-18.1 264.0 L-19.6 263.3 L-22.1 260.1 L-21.9 258.5 L-20.8 256.8 L-18.9 252.3 L-17.2 249.1
  L-14.8 241.0 L-9.1 218.3 L-8.1 212.2 L-5.8 203.2 L-4.8 197.5 L-3.0 191.6 L2.2 168.9 L5.3 157.6
  L7.9 149.4 L7.7 148.3 L6.3 146.0 L4.6 140.8 L4.1 138.5 L4.1 136.5 L2.7 129.6 L2.7 124.5
  L1.5 115.3 L1.5 112.5 L1.1 111.4 L1.1 105.9 L0.9 104.9 L1.1 97.5 L3.0 88.4 L3.4 81.4
  L4.3 76.0 L4.3 74.8 L3.3 72.9 L3.7 71.2 L3.7 67.4 L4.3 65.4 L4.3 63.6 L5.0 60.8
  L5.6 56.8 L6.7 54.1 L7.5 53.0 L8.8 52.0 L12.6 50.3 L14.5 49.9 L18.8 49.9 L19.7 49.6
  L22.7 47.8 L24.8 44.8 L25.1 43.4 L25.1 40.0 L24.8 39.1 L24.5 38.5 L21.0 35.0 L19.2 32.3
  L17.7 27.3 L17.1 23.1 L16.4 21.3 L16.3 20.3 L14.4 15.0 L14.5 13.3 L14.9 11.9 L16.0 8.6
  L17.0 6.6 L19.1 3.8 L21.0 1.9 L23.8 0.5 L27.1 -0.1 L30.6 0.7 L33.6 2.6 L35.5 3.0
  L37.2 3.9 L39.6 6.3 L40.7 7.9 L41.8 10.2 L42.0 11.6 L42.7 13.5 L42.7 17.5 L44.7 21.9
  L45.1 24.1 L45.0 24.8 L44.0 26.7 L41.4 30.0 L40.7 31.3 L38.0 33.7 L37.8 35.5 L38.5 39.9
  L39.1 41.1 L40.3 42.4 L42.4 44.1 L45.8 45.8 L50.7 47.3 L53.0 48.4 L54.6 49.8 L56.1 51.9
  L57.7 55.0 L59.5 57.1 L61.3 60.0 L63.4 62.9 L65.8 66.9 L72.4 75.6 L74.0 78.1 L77.0 83.1
  L78.2 87.0 L78.2 88.2 L77.7 89.2 L74.4 92.1 L71.5 95.0 L68.1 99.0 L64.6 102.8 L60.5 106.4
  L54.7 110.9 L50.6 113.6 L48.2 114.5 L47.8 115.0 L47.7 115.6 L48.9 119.4 L50.9 124.8 L55.6 140.8
  L57.6 149.6 L63.7 171.1 L71.0 198.8 L72.1 202.0 L77.2 222.3 L79.2 231.2 L80.0 233.5 L80.7 234.9
  L82.2 237.0 L89.4 245.6 L108.2 265.3 L109.3 266.9 L111.2 271.1 L111.7 271.6 L114.1 272.5 L116.2 273.7
  L118.8 277.5 L120.8 279.3 L121.3 280.3 L122.0 284.5 L121.9 285.4 L121.4 286.1 L115.7 287.7 L110.8 288.6
  L107.3 290.8 L101.2 293.4 L98.3 294.2 Z
  M47.8 107.3 L49.3 106.3 L51.9 103.3 L56.3 99.3 L58.4 96.9 L62.6 90.7 L65.0 85.6 L64.4 83.9
  L59.0 76.1 L56.3 73.2 L55.7 72.8 L53.3 74.1 L52.1 75.3 L50.7 77.6 L49.8 79.5 L50.2 82.8
  L49.5 84.7 L48.8 85.9 L47.0 86.9 L46.3 87.7 L44.4 92.3 L42.5 98.5 L44.1 103.4 L46.4 107.1
  L46.9 107.3 Z`;

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
const RUN_M_RUN_TRACE = `M64.7 299.9 L57.0 299.9 L56.9 293.7 L56.4 292.8 L55.0 292.1 L53.8 291.8 L51.8 291.8 L49.9 292.5
  L49.0 292.5 L48.0 292.1 L46.9 290.5 L48.3 286.7 L49.6 282.2 L50.1 278.2 L49.8 276.6 L49.8 272.7
  L50.9 269.2 L50.9 266.8 L51.8 264.7 L54.1 260.5 L54.7 258.6 L55.0 256.5 L55.0 237.8 L54.7 237.0
  L54.5 231.5 L54.1 230.8 L53.4 230.4 L50.7 230.2 L49.8 229.9 L48.7 229.0 L47.1 226.8 L45.8 224.2
  L44.9 221.5 L44.9 220.5 L44.5 220.0 L44.0 219.8 L42.5 220.3 L41.0 220.3 L39.7 219.7 L38.5 218.8
  L35.2 213.8 L33.6 210.3 L33.6 205.6 L30.0 190.2 L29.0 183.4 L29.0 181.0 L28.4 178.9 L27.2 176.6
  L25.7 172.6 L26.0 169.0 L25.5 165.8 L25.5 162.2 L22.6 158.2 L21.6 156.2 L20.0 149.1 L20.2 139.7
  L21.3 135.1 L21.1 131.0 L22.3 128.2 L23.0 125.4 L22.7 125.0 L22.2 124.9 L20.4 125.6 L19.3 125.6
  L15.2 123.7 L13.9 122.8 L13.1 121.1 L12.7 118.6 L12.2 117.5 L9.4 114.4 L6.3 109.4 L5.2 108.3
  L2.3 106.2 L0.2 103.1 L-2.0 99.3 L-3.7 97.2 L-4.6 94.6 L-4.6 90.7 L-3.1 85.3 L-0.7 81.2
  L0.7 77.7 L3.4 72.5 L6.7 67.8 L10.0 64.5 L12.4 57.9 L15.2 53.3 L16.4 51.9 L18.8 50.0
  L22.1 48.8 L23.9 48.5 L27.6 47.4 L30.6 45.9 L32.3 44.5 L34.0 43.5 L36.7 42.8 L39.1 41.6
  L41.0 41.3 L42.5 40.2 L42.9 39.1 L42.9 33.8 L42.7 32.3 L42.0 31.3 L40.4 30.9 L39.8 30.4
  L38.9 28.8 L38.3 26.5 L38.0 23.5 L39.1 21.0 L38.6 17.9 L38.6 15.6 L38.3 14.5 L38.3 12.4
  L39.5 9.0 L40.4 7.4 L43.4 4.1 L45.7 2.5 L48.9 0.9 L52.8 -0.1 L54.4 -0.1 L57.7 0.6
  L61.3 2.1 L62.8 3.3 L64.0 5.3 L65.6 6.1 L67.0 7.5 L68.7 10.2 L69.2 11.9 L69.2 13.8
  L69.0 14.6 L69.0 16.6 L67.9 20.5 L67.9 21.4 L69.0 23.1 L69.0 24.5 L68.4 26.2 L68.0 29.4
  L67.5 30.4 L66.1 31.8 L64.2 36.7 L63.5 40.2 L63.5 42.0 L64.3 43.1 L65.4 43.8 L71.1 45.7
  L73.1 47.2 L75.8 48.7 L79.6 50.1 L82.1 50.4 L83.4 50.8 L84.9 52.2 L86.2 54.1 L87.4 56.5
  L88.4 59.5 L88.7 63.2 L88.2 66.2 L90.3 70.7 L91.5 74.0 L93.3 77.7 L94.5 81.1 L95.6 83.1
  L97.5 87.1 L99.1 93.4 L99.6 100.9 L100.7 104.2 L101.8 106.2 L102.4 110.4 L104.5 115.0 L104.5 116.0
  L103.7 119.3 L102.7 120.7 L101.7 121.2 L98.9 121.5 L95.2 121.0 L93.9 120.5 L92.1 118.7 L90.9 117.2
  L90.7 116.5 L92.0 111.3 L93.3 109.1 L93.3 108.3 L92.8 106.6 L91.8 104.8 L90.2 103.2 L86.6 98.2
  L84.9 95.0 L84.0 92.3 L83.2 88.2 L81.1 81.7 L78.5 77.7 L78.0 77.3 L77.0 78.0 L75.0 82.1
  L75.0 83.6 L74.4 85.9 L74.4 87.5 L74.2 88.2 L73.9 93.2 L73.0 95.4 L73.0 97.1 L72.3 102.5
  L72.3 105.3 L71.7 108.0 L71.7 112.6 L71.9 113.7 L71.7 118.6 L72.1 119.6 L74.1 122.5 L76.1 127.1
  L77.6 128.9 L78.1 130.2 L79.0 131.0 L80.0 131.6 L81.3 133.2 L82.1 135.8 L82.1 137.5 L80.8 143.1
  L79.4 145.3 L79.4 148.6 L79.7 149.3 L79.8 151.9 L77.9 154.1 L77.7 155.8 L77.9 157.1 L76.1 160.4
  L75.9 161.9 L75.9 164.4 L75.5 165.5 L75.5 168.0 L74.7 173.2 L73.6 177.1 L70.9 183.2 L70.3 187.1
  L70.3 189.9 L70.6 190.9 L70.3 194.8 L73.0 206.2 L73.3 209.4 L73.7 210.4 L73.7 215.4 L73.3 216.6
  L72.5 222.6 L70.1 233.8 L67.0 243.3 L64.8 251.5 L63.0 259.6 L63.0 262.1 L63.5 265.1 L63.5 271.2
  L64.4 273.1 L64.7 274.2 L64.7 274.9 L63.8 277.0 L64.1 278.2 L64.1 281.6 L64.6 286.0 L65.7 289.4
  L65.7 292.5 L64.8 294.3 Z
  M23.1 107.8 L24.0 107.3 L24.4 106.4 L24.4 104.6 L24.0 103.5 L23.5 98.3 L22.4 95.0 L21.9 90.6
  L21.3 87.5 L20.2 85.0 L19.4 81.4 L18.7 80.8 L18.2 81.1 L17.3 82.2 L9.1 90.1 L8.8 91.6
  L9.0 92.5 L10.2 94.6 L12.0 100.8 L12.8 102.5 L15.4 104.8 L16.6 106.2 L17.7 107.0 L19.6 107.8 Z`;

const RUN_M_RUN_ART = {"src": "img/figures/run-m-run.d4447500.webp", "box": [-5.71, -1.29, 105.93, 301.06]};

const RUN_W_SPRINT_TRACE = `M71.5 299.9 L60.3 299.9 L60.2 294.2 L58.9 293.6 L56.9 292.2 L55.6 290.4 L54.4 289.3 L53.3 287.5
  L52.9 278.5 L52.5 277.5 L52.8 276.4 L52.6 274.5 L51.4 271.5 L48.1 264.7 L48.1 263.2 L48.8 261.8
  L50.0 260.6 L53.8 257.9 L55.6 254.9 L55.6 249.4 L54.9 243.2 L54.2 240.3 L54.0 236.5 L52.9 230.3
  L52.4 222.8 L51.3 215.1 L51.3 211.8 L51.0 211.1 L51.3 209.7 L51.3 205.9 L52.4 201.0 L53.1 196.2
  L53.0 194.1 L52.5 194.2 L52.1 194.7 L50.3 197.7 L48.3 199.7 L43.2 206.9 L36.9 214.6 L34.1 217.4
  L29.2 224.0 L28.8 225.0 L28.9 225.5 L29.3 225.7 L30.6 225.9 L31.0 226.8 L30.0 228.5 L29.1 229.5
  L28.5 231.5 L27.5 232.3 L27.0 233.5 L26.3 241.2 L25.9 243.1 L24.2 247.9 L22.6 249.4 L21.7 249.9
  L20.2 249.9 L19.0 249.5 L17.3 248.0 L15.3 244.5 L14.8 240.8 L15.5 236.7 L16.4 234.1 L16.4 231.1
  L15.1 226.3 L13.7 223.1 L13.4 221.4 L13.7 219.3 L14.3 218.0 L14.8 217.4 L16.5 216.6 L19.2 216.5
  L21.5 217.5 L22.2 217.4 L23.3 215.9 L25.7 211.7 L29.6 201.7 L29.9 197.9 L31.3 193.8 L33.0 191.1
  L35.7 188.7 L36.1 187.7 L36.2 185.0 L37.5 180.3 L38.5 174.0 L38.5 172.1 L37.3 170.0 L35.0 167.7
  L32.5 165.7 L26.5 159.7 L24.3 156.6 L22.5 153.1 L20.9 148.3 L20.2 143.4 L19.8 142.4 L19.8 135.2
  L20.2 133.9 L20.2 131.2 L22.9 124.0 L22.3 123.6 L20.6 124.5 L18.3 124.5 L13.0 122.3 L11.7 120.9
  L11.4 119.9 L11.7 113.0 L9.4 108.7 L8.2 104.4 L5.2 98.8 L3.8 95.7 L2.5 90.2 L2.0 86.2
  L2.0 83.8 L2.6 80.4 L6.0 74.2 L8.6 68.4 L12.2 63.5 L14.4 57.6 L17.3 52.7 L19.1 50.7
  L22.2 48.8 L24.7 47.8 L27.9 47.5 L30.3 46.9 L34.1 45.2 L36.3 42.9 L36.9 41.1 L36.9 39.9
  L37.6 37.0 L37.1 36.5 L36.5 36.5 L34.6 37.0 L33.5 37.0 L31.8 37.7 L30.0 39.7 L29.1 41.3
  L27.9 44.0 L26.9 45.4 L26.5 45.4 L26.3 44.5 L27.6 41.0 L27.1 40.3 L21.7 41.4 L20.4 42.2
  L19.0 43.3 L18.4 43.5 L17.8 42.8 L18.2 41.6 L20.9 39.1 L21.3 38.4 L19.7 37.1 L18.5 36.7
  L17.5 35.5 L16.8 35.1 L15.3 35.1 L13.3 36.1 L12.9 35.9 L12.7 35.4 L13.3 33.2 L13.0 32.5
  L13.2 31.5 L14.8 30.8 L14.9 29.6 L15.3 29.2 L18.8 29.2 L20.5 28.6 L23.8 28.4 L24.1 27.9
  L22.7 26.3 L22.5 25.8 L22.7 25.6 L23.4 25.8 L24.2 26.9 L26.1 28.2 L30.6 29.5 L33.3 29.5
  L34.1 29.2 L35.4 28.7 L38.5 26.7 L39.0 26.1 L39.0 25.5 L38.0 22.6 L37.8 20.3 L39.1 14.6
  L39.4 10.7 L40.4 7.6 L41.3 6.2 L43.8 3.7 L46.4 1.9 L49.1 0.6 L51.4 -0.1 L53.3 -0.1
  L55.5 0.4 L58.0 0.5 L62.1 2.4 L65.6 6.8 L66.5 8.4 L68.1 12.1 L68.1 15.9 L67.8 17.2
  L68.1 19.9 L67.8 21.0 L67.8 23.1 L67.3 26.0 L66.2 28.9 L65.4 32.3 L64.2 34.8 L62.3 37.3
  L61.9 38.1 L62.0 41.1 L62.7 42.0 L68.3 45.5 L74.8 47.5 L76.0 47.6 L80.6 48.8 L82.1 49.4
  L84.0 50.9 L86.1 54.5 L88.4 60.0 L89.8 65.3 L89.8 67.5 L90.3 71.2 L91.0 73.4 L93.3 78.5
  L95.7 86.8 L97.9 91.9 L97.9 99.4 L97.3 100.9 L95.7 102.7 L93.5 103.8 L92.6 103.7 L90.6 102.9
  L88.6 101.3 L87.6 99.9 L86.6 97.9 L85.5 92.6 L84.4 89.5 L82.9 86.7 L81.0 84.4 L78.1 80.0
  L77.2 79.2 L76.6 79.2 L76.3 79.5 L74.9 83.6 L73.8 88.8 L73.8 90.4 L72.2 95.8 L70.8 104.8
  L70.2 107.0 L70.0 109.5 L70.2 110.2 L70.5 114.9 L70.2 115.7 L70.2 120.9 L70.0 121.6 L70.0 129.3
  L69.7 130.0 L69.7 132.5 L69.1 134.6 L68.9 138.5 L68.1 141.7 L68.1 142.8 L65.7 152.4 L61.4 164.1
  L61.8 165.7 L66.6 172.2 L68.7 176.1 L69.7 178.5 L71.1 183.6 L71.1 187.7 L70.5 190.3 L70.2 194.8
  L69.1 200.4 L68.6 204.3 L68.9 205.3 L68.9 215.7 L66.8 229.6 L66.2 231.9 L65.4 237.0 L65.4 238.9
  L65.1 239.9 L65.1 249.8 L66.0 255.1 L67.5 260.9 L67.8 264.1 L68.3 265.4 L69.1 266.5 L69.9 266.5
  L70.7 266.1 L71.2 266.2 L71.7 266.9 L72.0 268.3 L72.7 269.5 L72.3 269.9 L70.4 270.0 L69.9 270.5
  L70.0 271.6 L71.6 275.0 L71.8 276.1 L71.7 276.9 L71.2 276.8 L69.7 273.8 L69.2 273.9 L68.9 274.8
  L69.1 275.8 L69.2 281.4 L70.3 285.4 L72.2 289.4 L72.2 292.5 L71.6 294.3 Z
  M29.0 112.9 L29.6 112.1 L30.7 108.1 L31.7 103.9 L31.7 103.0 L30.1 97.3 L30.1 94.8 L29.6 90.5
  L28.8 87.7 L28.3 84.1 L27.4 80.8 L27.4 77.7 L26.9 74.5 L25.1 70.4 L24.4 70.2 L22.9 71.5
  L14.3 81.2 L13.1 83.8 L12.8 86.5 L13.9 91.6 L14.4 99.6 L15.0 102.3 L16.0 104.7 L17.0 106.1
  L18.5 106.9 L22.1 107.5 L23.3 108.1 L27.7 112.7 L28.4 113.0 Z`;

const RUN_W_SPRINT_ART = {"src": "img/figures/run-w-sprint.26d4ab36.webp", "box": [0.69, -1.34, 99.27, 301.18]};

const BOX_M_VICTORY_TRACE = `M92.7 299.9 L78.1 299.9 L78.0 294.3 L76.5 292.9 L75.9 291.4 L76.7 288.7 L76.4 283.4 L78.0 275.8
  L78.0 273.8 L78.5 270.5 L78.3 269.6 L78.3 266.6 L79.0 264.0 L78.8 261.0 L78.1 258.9 L77.8 255.9
  L76.9 252.9 L76.9 250.6 L77.6 249.3 L79.6 248.0 L79.8 247.0 L79.0 245.5 L78.8 242.0 L78.0 239.8
  L78.3 238.0 L78.1 237.4 L76.2 233.5 L75.2 229.1 L74.5 223.5 L74.5 221.1 L74.2 220.3 L74.2 217.5
  L73.9 215.9 L73.2 213.4 L72.4 211.7 L67.6 205.1 L62.4 194.1 L60.6 189.5 L59.6 184.2 L59.0 182.7
  L58.3 182.2 L57.4 181.9 L54.5 181.9 L53.3 181.6 L52.2 181.1 L50.9 179.8 L50.4 180.2 L49.0 186.1
  L48.0 194.8 L46.3 199.7 L46.3 201.9 L47.0 205.9 L47.3 211.0 L47.5 211.7 L47.5 220.3 L46.8 223.9
  L44.8 229.3 L45.1 235.7 L44.7 237.2 L44.7 242.2 L45.1 242.5 L46.5 242.0 L47.4 242.3 L48.0 243.3
  L47.7 244.1 L46.2 245.2 L45.4 246.8 L44.6 251.7 L45.1 255.7 L44.8 258.6 L46.3 266.8 L46.3 274.1
  L46.6 275.2 L46.3 277.6 L45.8 278.4 L44.2 279.0 L40.1 279.8 L34.3 280.0 L31.0 280.5 L27.8 281.8
  L24.9 283.3 L20.7 284.3 L14.8 284.3 L13.2 284.1 L5.2 281.6 L3.7 281.0 L2.9 280.1 L3.2 279.0
  L4.2 277.5 L5.3 276.4 L8.0 275.3 L13.8 273.7 L17.4 272.1 L19.7 269.6 L22.5 267.5 L23.8 266.0
  L25.0 265.0 L25.7 263.2 L27.7 259.7 L27.7 259.2 L27.0 258.1 L27.0 257.5 L27.6 257.0 L28.2 257.6
  L28.5 257.6 L28.9 257.1 L29.2 256.1 L29.2 255.5 L28.8 255.0 L27.3 254.9 L26.7 254.4 L26.2 253.3
  L26.1 252.5 L27.1 249.1 L27.1 247.5 L27.5 245.9 L27.9 245.3 L29.4 243.8 L30.1 242.0 L29.6 240.1
  L29.7 234.2 L29.5 231.8 L29.8 230.2 L29.7 228.6 L29.0 224.1 L28.7 219.3 L28.5 218.6 L28.5 212.7
  L29.2 206.7 L29.2 201.8 L28.5 197.5 L28.5 190.7 L26.4 184.4 L25.5 180.5 L24.9 179.8 L21.1 178.3
  L19.8 176.7 L19.1 175.1 L19.9 172.3 L20.4 168.4 L20.4 166.2 L21.1 160.9 L21.1 153.7 L21.8 147.7
  L22.3 145.7 L22.3 144.3 L22.7 143.2 L23.9 131.3 L24.3 129.8 L26.0 126.1 L27.7 124.5 L28.2 123.4
  L29.0 118.6 L29.2 112.4 L29.6 111.8 L31.4 110.0 L31.7 109.2 L31.7 107.5 L32.4 104.3 L34.2 98.7
  L34.5 93.6 L35.2 88.5 L35.5 83.0 L35.1 82.6 L34.5 82.9 L29.4 92.5 L26.7 97.0 L24.1 99.9
  L20.9 101.7 L19.3 102.0 L15.6 100.6 L13.5 98.5 L12.9 97.0 L13.1 94.7 L12.9 92.3 L11.6 86.4
  L11.6 83.0 L12.4 79.3 L13.4 76.2 L13.4 75.2 L12.6 72.4 L12.6 70.0 L13.4 62.6 L13.1 54.7
  L13.4 53.1 L15.0 49.2 L18.2 45.9 L23.6 42.4 L26.9 40.9 L29.5 40.6 L31.7 41.4 L33.0 42.2
  L35.0 44.3 L36.8 46.6 L37.4 46.9 L38.4 46.9 L39.7 46.4 L42.4 44.7 L46.8 42.5 L47.0 41.4
  L44.0 37.1 L43.4 35.9 L41.1 29.0 L40.5 26.4 L40.3 21.8 L38.2 15.4 L38.4 10.0 L40.4 6.1
  L42.3 3.8 L47.0 1.1 L51.4 -0.1 L55.2 0.2 L57.4 0.8 L60.5 3.4 L61.2 3.6 L62.7 3.7
  L64.1 4.3 L65.6 5.5 L66.2 6.5 L67.2 9.1 L67.5 13.5 L67.0 18.1 L68.2 20.7 L68.2 23.1
  L66.6 26.8 L65.6 27.9 L65.1 29.1 L64.9 30.7 L64.9 34.2 L65.5 36.6 L66.3 38.1 L67.6 39.7
  L70.3 41.6 L75.4 44.4 L77.5 45.3 L80.1 47.0 L83.7 50.5 L85.8 51.7 L87.7 53.2 L89.8 55.9
  L92.0 60.5 L93.0 63.9 L93.5 66.6 L93.5 73.2 L95.9 83.5 L96.6 90.4 L96.6 92.3 L96.8 93.1
  L96.8 100.1 L96.1 102.9 L95.6 107.2 L94.6 108.8 L91.7 111.4 L90.0 112.3 L88.3 112.3 L86.9 111.6
  L84.7 109.1 L79.8 106.9 L77.3 104.1 L75.5 99.8 L75.3 99.3 L74.9 99.2 L74.2 100.0 L73.5 102.2
  L73.0 105.6 L73.0 107.5 L72.3 109.5 L73.2 112.1 L72.3 114.8 L73.7 118.2 L73.7 120.0 L74.2 123.1
  L74.7 124.4 L77.1 126.7 L78.3 129.0 L79.0 131.4 L79.0 133.5 L80.5 139.4 L81.0 142.9 L81.2 147.2
  L80.7 149.1 L80.7 152.7 L81.0 153.7 L81.0 156.6 L81.2 157.4 L81.2 162.4 L82.5 168.9 L82.5 171.5
  L84.1 177.3 L84.1 179.0 L83.8 179.9 L82.5 181.0 L82.2 181.5 L82.2 185.0 L82.7 188.5 L85.0 196.6
  L85.3 199.1 L86.3 203.1 L89.3 210.9 L90.8 215.7 L91.8 222.3 L91.8 225.0 L92.0 225.9 L92.1 232.9
  L92.3 233.6 L92.3 236.6 L92.8 238.0 L92.3 240.0 L92.3 242.5 L92.1 243.2 L92.1 244.4 L92.4 245.8
  L92.1 247.9 L92.5 249.3 L92.2 251.4 L92.3 257.7 L92.5 258.7 L92.5 261.3 L92.1 262.7 L92.1 263.7
  L93.7 268.0 L92.8 270.7 L93.7 274.2 L94.2 277.5 L95.4 281.7 L96.2 289.7 L95.8 291.9 L94.5 293.2
  L92.8 294.2 Z`;

const BOX_M_VICTORY_ART = {"src": "img/figures/box-m-victory.fb96cce9.webp", "box": [1.84, -1.01, 98.11, 298.85]};

const BOX_M_CHAMPION_TRACE = `M20.8 299.9 L9.4 299.9 L9.3 294.3 L7.9 292.1 L7.6 290.0 L8.6 286.0 L9.6 284.0 L12.4 280.0
  L14.9 275.2 L16.0 272.2 L16.9 268.0 L18.0 262.7 L18.0 258.4 L17.7 257.7 L17.7 254.5 L17.5 253.8
  L17.5 249.8 L18.3 249.0 L20.7 248.3 L21.2 247.6 L20.9 241.1 L20.7 240.3 L20.4 230.1 L19.9 226.6
  L20.2 223.1 L21.7 217.5 L26.2 206.4 L28.8 193.1 L28.8 188.1 L27.5 187.3 L26.8 187.5 L25.8 187.3
  L25.0 186.1 L24.7 185.0 L24.7 178.0 L25.0 177.1 L25.0 174.4 L24.5 172.2 L24.7 161.6 L23.5 155.8
  L23.5 152.9 L23.2 152.2 L23.2 142.2 L23.5 141.2 L23.5 136.5 L24.5 130.3 L25.2 127.3 L26.8 123.9
  L26.5 120.4 L27.3 117.8 L29.1 116.0 L29.1 115.6 L28.5 114.8 L26.3 113.4 L25.2 112.4 L22.4 107.4
  L21.6 106.9 L20.5 106.9 L17.9 107.8 L14.9 110.0 L9.2 111.4 L7.0 110.3 L3.6 107.0 L0.4 105.2
  L-0.7 104.1 L-2.2 101.8 L-2.8 100.4 L-4.2 95.1 L-4.4 89.4 L2.0 73.9 L6.1 64.9 L7.4 59.2
  L7.9 57.7 L9.0 55.7 L11.9 52.8 L14.9 50.3 L19.0 48.1 L21.8 46.9 L23.2 44.4 L31.8 40.6
  L33.2 39.5 L36.4 35.8 L39.4 34.4 L39.7 33.8 L39.7 32.6 L39.3 30.3 L36.9 27.3 L36.1 25.3
  L35.3 22.4 L35.3 20.5 L36.5 19.4 L36.7 18.8 L36.0 16.2 L36.0 10.8 L36.6 8.5 L38.6 5.1
  L41.0 2.5 L42.5 1.4 L46.1 0.2 L49.9 -0.1 L55.4 1.2 L56.8 1.8 L59.5 4.7 L61.1 5.8
  L62.8 7.6 L63.8 9.7 L64.3 11.7 L64.3 14.4 L63.5 18.6 L63.5 19.2 L64.3 20.4 L64.1 23.4
  L63.1 27.6 L61.8 29.5 L61.0 33.1 L59.6 35.5 L59.1 37.0 L59.2 39.9 L60.6 40.7 L64.4 42.2
  L68.1 43.9 L73.5 45.6 L74.1 46.5 L74.7 48.6 L75.2 49.4 L79.0 51.8 L81.9 55.2 L84.7 57.9
  L86.5 64.8 L86.5 70.6 L88.2 78.2 L89.8 81.4 L93.3 87.0 L94.9 90.4 L95.9 94.6 L96.0 96.2
  L97.0 99.5 L97.0 101.6 L96.2 104.6 L96.8 107.4 L96.8 109.7 L97.2 110.6 L99.0 113.0 L99.9 114.8
  L100.5 117.0 L100.5 120.4 L99.2 124.4 L97.4 128.0 L95.5 130.7 L94.4 131.8 L92.3 132.7 L90.3 132.7
  L84.8 131.3 L84.1 131.3 L83.6 132.0 L84.5 135.5 L85.5 142.1 L85.5 145.9 L85.8 148.0 L89.8 161.3
  L91.2 164.1 L91.5 165.2 L91.8 169.6 L92.0 170.5 L92.0 178.1 L91.8 178.8 L91.8 181.2 L91.3 183.1
  L91.2 185.2 L90.0 186.1 L87.1 186.8 L86.7 187.6 L86.5 194.5 L87.0 197.0 L87.9 199.6 L87.9 202.2
  L87.2 205.7 L85.2 210.9 L85.5 220.0 L85.2 220.8 L85.0 224.7 L82.4 236.5 L80.7 243.3 L79.7 246.0
  L79.7 248.6 L79.5 249.6 L79.8 250.3 L81.8 251.4 L82.4 252.4 L82.4 253.5 L81.1 256.5 L81.2 257.3
  L84.0 260.5 L85.6 261.9 L85.4 262.3 L84.9 262.3 L82.2 259.5 L81.6 259.5 L81.3 259.8 L81.5 261.7
  L81.2 263.5 L82.8 267.8 L84.7 270.1 L89.6 275.1 L96.2 278.6 L102.3 281.3 L103.2 282.2 L104.2 284.1
  L104.3 285.4 L103.2 287.8 L101.0 288.6 L98.1 288.6 L97.4 288.4 L91.8 288.1 L84.4 286.9 L76.2 283.5
  L75.1 283.2 L72.9 283.2 L66.9 281.8 L65.1 281.1 L64.6 280.6 L64.3 279.8 L64.3 277.7 L64.1 277.0
  L64.1 271.8 L64.6 268.6 L65.9 264.0 L65.9 261.1 L66.2 260.4 L65.9 254.5 L65.3 251.5 L65.3 250.1
  L66.9 247.4 L66.9 245.6 L67.4 243.1 L67.4 236.4 L66.2 231.1 L66.2 225.3 L67.2 218.7 L68.7 212.9
  L70.1 209.2 L70.2 208.1 L68.9 204.7 L67.6 198.9 L65.9 193.4 L63.7 188.8 L62.9 188.4 L60.7 188.9
  L58.1 188.9 L55.2 188.4 L53.9 187.5 L53.6 186.8 L53.6 184.7 L53.3 184.3 L52.6 184.2 L50.0 185.1
  L49.0 185.6 L48.5 186.2 L47.3 192.5 L44.7 202.0 L42.3 208.0 L40.7 210.7 L39.4 213.8 L39.0 215.6
  L39.0 224.1 L38.5 228.4 L37.5 231.7 L34.2 239.4 L32.7 243.8 L32.0 247.2 L31.8 249.7 L32.1 250.3
  L33.2 251.0 L33.3 252.0 L32.3 255.4 L30.5 263.2 L30.5 268.3 L30.7 269.7 L30.3 271.5 L30.3 273.2
  L30.6 276.5 L29.5 283.6 L28.8 285.2 L26.7 286.6 L26.2 287.2 L26.0 288.1 L26.0 290.5 L25.4 291.8
  L23.6 293.4 L21.0 294.2 Z`;

const BOX_M_CHAMPION_ART = {"src": "img/figures/box-m-champion.5c2827db.webp", "box": [-5.57, -1.21, 105.54, 298.26]};

const BOX_W_GUARD_TRACE = `M-8.4 299.9 L-22.1 299.9 L-22.2 294.2 L-25.0 292.9 L-25.1 292.1 L-24.3 289.4 L-22.1 286.8 L-21.2 286.1
  L-17.1 284.3 L-11.2 281.1 L-9.9 279.5 L-5.4 275.7 L-4.2 273.8 L-3.8 271.6 L-4.0 270.0 L-3.3 268.8
  L-3.1 267.8 L-2.8 264.1 L-1.2 261.2 L-0.6 258.8 L-0.7 257.4 L-1.6 257.0 L-1.8 256.6 L0.3 254.3
  L1.0 251.8 L2.4 250.9 L2.9 250.1 L3.1 248.4 L3.1 242.9 L3.5 241.7 L3.5 237.8 L3.7 237.1
  L3.7 233.6 L4.0 232.8 L4.0 229.6 L4.2 228.8 L4.2 226.6 L4.7 222.8 L7.2 210.2 L9.2 204.1
  L9.5 202.8 L9.3 200.8 L10.1 196.8 L10.6 194.9 L12.2 191.7 L13.8 185.8 L13.8 182.9 L14.2 181.8
  L14.2 179.8 L14.9 175.6 L16.1 172.1 L16.5 169.7 L19.0 160.6 L21.3 153.5 L21.9 149.0 L22.3 147.7
  L23.1 146.5 L24.4 145.4 L24.8 144.8 L26.2 141.5 L26.2 138.5 L26.6 136.8 L27.1 135.8 L28.9 134.1
  L28.9 132.6 L30.2 129.7 L31.6 127.2 L31.7 122.4 L32.9 120.9 L34.8 120.0 L35.4 119.2 L35.8 116.5
  L36.3 115.3 L36.3 112.7 L36.7 111.7 L36.9 108.5 L39.5 104.3 L40.4 100.0 L40.2 99.0 L39.5 99.1
  L37.6 103.7 L36.3 105.2 L35.1 105.9 L33.9 106.2 L31.4 106.2 L30.0 105.6 L27.8 104.2 L26.0 103.9
  L24.6 104.5 L22.8 106.9 L21.6 107.9 L20.0 108.7 L18.0 108.9 L16.1 108.4 L14.7 107.6 L11.9 104.7
  L10.6 101.4 L10.4 100.0 L10.4 98.1 L10.8 96.7 L11.9 94.4 L13.7 88.6 L18.1 78.8 L21.5 72.0
  L23.7 63.7 L26.9 57.3 L28.7 54.6 L30.0 53.4 L32.1 52.3 L33.9 51.7 L36.1 51.4 L39.1 50.3
  L40.8 49.4 L41.7 48.4 L41.5 45.2 L41.7 44.4 L41.7 42.4 L42.6 39.9 L42.6 37.9 L42.8 37.0
  L42.6 34.4 L43.3 31.5 L43.3 28.8 L43.5 28.0 L43.3 25.7 L42.2 22.2 L42.8 18.6 L42.8 17.6
  L42.2 16.2 L42.2 15.2 L43.1 11.7 L45.8 7.4 L51.3 2.1 L52.5 1.2 L54.5 0.3 L55.7 0.3
  L56.8 -0.1 L58.1 -0.0 L60.6 0.9 L63.2 3.2 L65.5 4.4 L68.4 6.8 L69.8 9.1 L70.4 12.8
  L71.2 14.7 L71.3 16.3 L70.3 18.2 L70.6 23.5 L69.7 26.9 L69.2 28.1 L67.5 30.2 L67.1 32.7
  L65.3 36.0 L65.6 38.8 L66.8 41.3 L69.7 43.4 L71.4 44.3 L78.4 46.9 L82.6 46.9 L84.3 47.4
  L87.0 48.6 L89.6 50.5 L93.4 54.3 L95.1 56.5 L99.1 63.9 L101.2 66.6 L104.9 70.6 L106.9 73.4
  L111.2 80.4 L113.9 86.2 L114.2 87.6 L114.2 90.2 L113.9 91.3 L113.0 93.2 L111.6 94.4 L109.4 95.0
  L103.8 97.7 L100.9 98.4 L99.0 99.7 L96.5 100.7 L91.7 101.0 L90.8 101.2 L87.4 101.0 L83.7 101.7
  L79.7 101.5 L78.7 102.0 L78.5 103.6 L79.7 106.3 L79.7 109.8 L80.5 112.5 L80.7 114.7 L82.2 118.2
  L84.0 119.2 L84.6 119.7 L86.4 123.1 L87.5 127.3 L88.0 130.5 L88.0 139.9 L88.8 145.5 L88.8 148.3
  L89.1 149.4 L89.6 153.5 L89.9 160.0 L91.2 164.1 L91.6 166.2 L91.5 166.9 L90.4 167.8 L90.2 168.3
  L89.9 169.7 L90.2 172.7 L89.2 174.3 L88.8 175.4 L89.1 176.7 L89.4 185.5 L89.6 186.2 L89.7 188.2
  L92.3 198.1 L92.6 200.6 L93.8 203.9 L98.0 212.1 L99.6 217.3 L101.2 225.3 L103.1 239.8 L103.6 240.6
  L107.2 241.9 L108.0 243.8 L108.1 246.4 L109.6 249.1 L109.5 249.5 L108.3 249.2 L107.9 249.7 L107.8 250.2
  L110.5 257.6 L110.8 259.1 L110.8 263.6 L111.0 264.5 L113.0 267.5 L118.8 272.1 L122.7 274.7 L123.7 275.7
  L125.0 278.9 L125.0 281.0 L124.1 282.1 L122.1 283.2 L120.4 283.8 L119.1 284.1 L115.8 283.8 L109.2 282.2
  L104.2 279.6 L100.3 278.4 L98.8 277.4 L97.6 274.6 L97.1 272.5 L96.9 266.3 L96.2 263.1 L94.2 257.4
  L93.4 252.9 L91.0 244.7 L91.2 242.1 L87.9 234.5 L83.8 226.5 L82.7 222.9 L81.6 215.6 L80.4 210.4
  L79.3 208.3 L76.8 205.1 L75.0 202.2 L72.5 194.4 L71.8 193.0 L69.6 185.3 L69.0 184.2 L68.0 180.8
  L67.2 179.4 L66.2 178.9 L60.9 179.1 L59.2 178.9 L56.8 178.1 L55.7 177.5 L55.1 175.3 L54.6 167.6
  L54.0 164.7 L53.7 164.2 L53.3 164.1 L52.7 164.9 L46.0 178.7 L44.7 179.4 L39.4 178.9 L38.4 179.4
  L37.8 180.3 L33.9 187.3 L29.1 199.5 L24.6 208.8 L24.6 216.9 L24.3 218.0 L24.0 222.7 L23.2 227.6
  L21.9 233.1 L19.1 240.3 L16.5 249.7 L16.3 251.7 L16.5 254.3 L16.0 258.0 L15.2 261.3 L14.7 267.1
  L13.3 272.5 L13.3 275.1 L14.2 279.1 L14.2 281.9 L13.8 283.0 L13.5 286.7 L12.8 287.7 L10.7 288.6
  L4.4 290.0 L1.9 289.7 L-2.1 290.7 L-3.6 291.5 L-5.4 293.0 L-8.3 294.2 Z`;

const BOX_W_GUARD_ART = {"src": "img/figures/box-w-guard.30b0664a.webp", "box": [-26.18, -1.24, 126.38, 301.22]};

const BOX_W_READY_TRACE = `M107.5 299.9 L-7.1 299.9 L-7.4 299.8 L-7.4 294.3 L-8.1 292.4 L-8.4 290.8 L-7.8 288.3 L-6.7 286.4
  L-5.0 284.6 L-3.6 283.8 L1.4 279.3 L2.8 276.9 L4.0 275.5 L4.4 274.1 L6.0 271.2 L6.7 265.6
  L6.5 264.7 L5.9 264.7 L5.6 265.0 L2.9 268.3 L2.4 268.3 L2.3 268.0 L4.0 265.2 L6.1 263.9
  L6.6 263.2 L7.4 261.3 L7.4 260.0 L8.3 258.3 L8.1 256.7 L8.3 255.6 L9.6 253.4 L10.2 250.7
  L11.1 249.3 L11.1 246.1 L11.4 245.4 L11.4 237.8 L11.6 237.0 L11.6 233.5 L12.1 229.1 L12.1 223.4
  L12.5 222.3 L12.7 218.6 L13.5 214.5 L16.6 204.3 L16.8 200.3 L17.2 199.2 L17.2 197.2 L17.7 194.4
  L17.7 191.1 L17.2 188.5 L17.2 186.8 L16.8 185.7 L16.8 183.4 L16.1 176.8 L16.0 169.4 L15.4 168.8
  L13.5 169.1 L10.1 168.8 L7.4 167.9 L5.6 166.8 L4.0 165.2 L2.2 162.2 L0.7 158.1 L0.2 155.7
  L-0.0 153.9 L-0.0 148.4 L0.6 145.6 L1.8 142.5 L1.8 141.4 L0.9 138.7 L0.7 135.5 L1.7 129.8
  L3.6 127.0 L2.1 118.3 L2.0 109.9 L2.6 106.0 L3.4 103.0 L3.6 99.3 L5.4 90.2 L7.7 79.9
  L10.0 72.5 L11.2 65.9 L12.0 63.3 L14.9 56.9 L16.4 54.4 L18.6 52.5 L21.9 51.1 L27.8 49.7
  L29.0 48.9 L29.6 47.7 L29.9 44.9 L30.9 42.2 L30.9 40.1 L31.4 38.5 L31.4 33.8 L31.7 33.0
  L31.4 28.4 L33.5 23.7 L33.5 20.9 L33.0 19.4 L33.0 16.4 L32.7 15.2 L32.5 13.4 L33.1 11.8
  L34.2 9.6 L34.4 8.9 L34.1 7.3 L34.4 6.4 L35.0 5.3 L37.4 3.2 L40.5 1.3 L42.8 0.9
  L44.3 -0.0 L46.9 -0.1 L51.7 1.0 L53.8 1.1 L58.3 3.7 L59.7 5.0 L60.1 7.1 L62.0 11.3
  L61.8 18.2 L62.6 19.9 L62.7 22.0 L61.4 27.3 L61.1 27.9 L59.5 29.4 L58.8 32.2 L56.9 36.4
  L57.2 39.5 L58.0 41.7 L60.0 43.7 L66.0 47.4 L68.3 48.2 L75.4 50.1 L77.8 51.4 L80.5 53.2
  L81.8 55.0 L83.7 58.6 L86.2 65.7 L87.3 72.7 L90.2 85.6 L90.2 87.7 L90.7 91.8 L92.3 99.5
  L93.3 105.6 L93.3 123.4 L92.3 129.7 L92.7 130.3 L94.1 131.1 L94.6 132.5 L94.6 134.3 L95.4 139.2
  L95.4 141.1 L94.6 144.0 L96.0 146.8 L97.2 152.6 L97.2 155.3 L97.5 156.0 L97.5 166.1 L96.9 168.4
  L96.2 169.7 L94.6 171.1 L92.8 172.0 L89.0 173.3 L85.8 173.8 L82.5 173.8 L80.7 173.3 L79.9 173.6
  L79.5 177.0 L79.5 183.6 L79.0 187.4 L79.0 196.2 L80.0 202.6 L83.9 215.7 L84.7 220.1 L84.9 232.9
  L85.2 233.6 L85.2 237.2 L85.5 238.3 L85.8 248.9 L88.0 252.8 L88.3 254.4 L89.1 256.0 L88.9 257.5
  L89.1 258.2 L94.3 263.0 L94.6 263.7 L94.6 264.3 L94.2 264.9 L93.7 265.0 L93.0 264.6 L93.0 264.2
  L93.6 263.9 L93.6 263.2 L92.9 262.3 L91.6 261.6 L91.1 261.6 L90.9 262.5 L90.2 263.2 L90.2 265.2
  L90.7 267.2 L90.7 269.3 L91.4 270.9 L91.5 273.2 L93.5 276.9 L97.3 280.0 L99.9 282.7 L103.4 285.1
  L105.9 287.6 L106.8 288.8 L107.6 291.9 L108.3 293.1 L108.3 293.6 L107.5 294.3 Z
  M92.6 295.1 L92.6 294.2 L90.4 293.2 L89.3 292.3 L87.9 290.7 L86.0 289.4 L78.4 286.4 L77.3 285.0
  L76.5 282.9 L75.8 280.0 L75.8 273.7 L76.4 271.5 L76.4 269.9 L74.4 264.5 L73.7 260.3 L72.9 257.6
  L72.9 256.8 L73.5 255.4 L73.0 251.6 L73.0 248.2 L72.2 244.4 L69.9 234.6 L67.1 228.1 L66.0 223.3
  L65.7 218.1 L65.5 217.3 L65.5 212.3 L65.2 210.7 L64.1 207.9 L62.0 204.0 L60.6 199.8 L59.7 195.1
  L59.5 191.3 L58.5 184.8 L56.1 176.4 L53.7 169.9 L52.5 169.1 L51.2 168.7 L50.4 167.7 L49.1 156.3
  L48.2 154.9 L47.2 154.6 L46.8 155.3 L47.0 158.9 L46.8 159.6 L46.8 162.5 L46.4 163.6 L46.4 166.2
  L45.8 167.2 L43.4 168.0 L42.4 169.1 L39.5 179.0 L37.1 191.1 L36.1 199.8 L34.7 204.0 L32.1 210.5
  L31.4 213.9 L31.2 220.1 L30.5 223.8 L29.3 228.1 L27.2 233.4 L23.3 249.5 L23.6 251.9 L23.1 253.5
  L23.1 256.7 L23.3 258.3 L21.8 267.3 L20.4 270.9 L20.0 272.6 L20.0 275.0 L20.5 278.2 L20.5 280.9
  L20.1 282.5 L18.6 285.7 L17.6 286.9 L12.2 288.8 L9.9 291.8 L8.4 293.3 L6.1 294.2 L6.1 295.1 Z
  M79.6 134.0 L80.6 132.5 L82.4 131.2 L82.8 130.2 L82.8 125.0 L81.6 114.5 L81.6 107.7 L80.8 103.5
  L76.7 85.9 L74.6 80.8 L73.9 78.0 L73.2 77.3 L72.5 78.0 L72.5 79.2 L71.5 81.5 L71.6 82.6
  L71.1 83.9 L71.1 85.3 L70.4 86.8 L69.9 90.2 L69.5 91.5 L69.7 93.3 L69.1 95.0 L69.1 97.3
  L68.6 100.1 L68.8 101.8 L69.6 103.8 L69.7 104.9 L70.9 109.8 L70.9 111.5 L71.3 112.9 L72.0 114.6
  L73.5 115.5 L74.8 116.8 L76.5 120.5 L78.2 126.9 L78.2 129.5 L78.8 133.2 L79.1 133.9 Z
  M16.3 130.0 L18.4 122.8 L19.7 120.2 L20.6 117.7 L21.4 116.6 L23.7 115.1 L24.4 114.1 L24.7 110.9
  L26.2 106.4 L26.3 104.9 L27.5 102.4 L27.7 99.1 L27.5 98.2 L27.5 95.5 L27.0 94.1 L27.0 91.6
  L26.5 90.0 L26.5 87.9 L25.3 85.1 L24.5 81.0 L23.9 80.1 L23.1 79.7 L22.1 80.4 L20.6 84.2
  L17.6 95.3 L15.7 100.3 L14.0 108.0 L14.2 117.3 L13.2 123.7 L13.2 126.3 L13.6 127.3 L14.9 128.6
  L15.5 129.6 Z`;

const BOX_W_READY_ART = {"src": "img/figures/box-w-ready.f71383ec.webp", "box": [-9.58, -1.24, 109.39, 301.12]};

const RUN_W_READY_TRACE = `M8.9 299.9 L-6.3 299.9 L-6.4 294.1 L-6.1 293.0 L-6.6 290.7 L-5.5 287.7 L-0.8 282.7 L1.2 279.1
  L1.4 277.1 L0.9 275.8 L2.3 274.2 L1.5 273.3 L4.4 272.5 L5.2 269.5 L8.1 266.6 L8.4 263.2
  L8.7 262.0 L8.7 248.5 L8.4 247.4 L8.4 240.1 L8.7 239.0 L9.5 226.5 L10.5 221.2 L12.3 215.5
  L13.4 209.5 L13.9 203.6 L15.1 198.1 L14.9 190.0 L16.3 179.5 L17.8 171.4 L18.3 169.7 L19.6 163.4
  L23.6 151.8 L25.8 142.6 L25.8 141.5 L25.0 138.2 L25.0 133.8 L25.6 130.9 L25.2 130.0 L23.3 127.3
  L21.0 125.0 L17.1 122.8 L14.5 120.2 L9.8 113.0 L6.2 108.1 L2.3 101.2 L-3.4 89.9 L-3.5 87.8
  L-2.2 84.1 L0.0 80.0 L2.8 75.9 L6.8 70.4 L11.6 65.3 L14.1 60.9 L15.6 58.6 L19.0 55.1
  L22.7 52.7 L24.7 51.7 L30.8 49.6 L32.8 49.2 L35.7 47.7 L43.0 44.9 L45.1 43.0 L46.0 41.2
  L46.2 39.1 L43.7 33.9 L43.4 32.6 L42.8 31.4 L41.7 30.2 L40.7 28.3 L39.6 24.2 L39.6 23.1
  L40.8 20.5 L40.6 16.5 L41.2 13.3 L42.7 9.7 L44.5 7.1 L48.4 4.0 L50.0 2.2 L52.8 0.7
  L55.8 -0.1 L56.8 -0.1 L58.7 0.6 L60.6 2.0 L65.4 7.2 L66.4 8.7 L68.4 12.7 L69.4 16.4
  L69.1 20.5 L70.2 22.9 L70.3 24.0 L69.6 26.2 L69.1 29.3 L67.8 31.0 L67.3 32.6 L68.4 38.2
  L67.2 39.3 L66.0 42.5 L64.6 44.4 L64.5 44.9 L64.7 45.5 L65.7 46.8 L68.6 48.8 L72.5 50.3
  L83.6 55.7 L86.6 58.3 L89.7 61.9 L92.6 66.5 L95.0 73.4 L95.7 74.9 L98.6 79.1 L101.9 85.2
  L105.5 93.7 L106.5 97.0 L106.5 98.6 L105.4 101.6 L101.6 107.0 L98.6 112.3 L94.4 118.0 L91.4 121.5
  L84.8 128.0 L81.5 129.2 L77.8 129.2 L76.9 129.6 L76.2 130.6 L76.6 137.0 L77.5 139.4 L77.5 140.9
  L78.5 145.8 L78.5 152.1 L77.7 157.5 L75.7 166.5 L73.3 180.6 L71.7 188.4 L71.7 196.0 L71.5 196.7
  L71.5 200.9 L71.2 201.6 L71.2 205.9 L71.5 206.8 L71.5 209.6 L71.7 210.4 L71.9 215.5 L72.2 216.4
  L72.2 224.3 L71.2 232.0 L69.3 242.2 L67.0 251.3 L65.1 256.6 L63.7 261.8 L63.9 263.5 L64.8 264.7
  L65.2 265.7 L65.2 266.3 L64.1 268.0 L64.1 268.8 L64.9 271.4 L64.9 275.5 L64.7 277.4 L66.5 282.9
  L66.6 284.1 L67.2 285.9 L67.1 287.3 L66.4 288.1 L63.8 289.3 L60.9 290.0 L51.5 290.2 L50.4 289.8
  L49.8 288.9 L49.9 287.2 L49.4 285.7 L49.4 283.0 L51.3 277.5 L51.3 270.9 L51.5 269.5 L53.0 264.6
  L54.7 262.0 L56.0 257.0 L56.0 255.0 L56.2 254.3 L56.2 246.4 L56.0 245.5 L56.0 235.8 L55.6 234.7
  L55.6 229.5 L56.0 228.4 L56.0 224.4 L56.9 215.5 L56.9 213.6 L56.2 208.4 L55.1 204.1 L53.9 196.5
  L53.9 194.1 L53.3 190.8 L53.3 188.4 L53.0 187.6 L53.3 185.0 L53.0 184.2 L53.0 178.5 L51.3 167.8
  L50.9 166.7 L50.9 165.0 L50.7 164.1 L50.9 158.5 L50.7 158.0 L50.2 158.0 L48.4 159.1 L47.8 160.0
  L47.4 166.1 L44.7 175.8 L40.8 185.0 L36.8 192.7 L32.8 205.1 L29.4 212.3 L28.7 214.4 L28.2 217.6
  L28.2 222.0 L27.9 222.9 L27.7 227.7 L27.3 228.8 L26.3 236.2 L24.3 243.2 L21.1 253.2 L17.9 268.4
  L17.9 269.1 L19.1 271.5 L19.1 279.2 L20.3 281.9 L20.7 284.6 L19.9 286.6 L18.8 287.6 L13.4 288.9
  L12.1 289.5 L11.5 290.1 L10.4 292.7 L9.0 294.3 Z
  M81.5 118.9 L82.3 118.6 L84.2 116.4 L89.0 110.2 L91.2 104.5 L94.2 98.7 L94.3 97.4 L93.9 96.3
  L89.1 89.1 L85.6 82.4 L79.9 74.6 L79.0 74.0 L78.4 74.4 L77.3 77.0 L76.7 79.8 L75.4 84.2
  L73.8 93.6 L72.2 97.4 L72.2 99.3 L71.2 102.5 L71.2 106.4 L71.7 109.7 L73.0 114.3 L73.3 117.2
  L73.7 118.0 L74.7 118.5 L79.5 118.6 Z
  M28.4 114.8 L29.2 114.5 L30.0 113.5 L31.0 109.5 L31.0 104.6 L30.8 103.9 L30.8 102.0 L30.0 97.0
  L29.4 94.7 L29.4 93.2 L28.4 88.5 L28.2 84.1 L27.1 77.6 L27.0 75.9 L25.8 73.0 L25.0 72.0
  L24.3 71.7 L23.6 72.1 L17.7 78.2 L13.2 84.1 L9.5 87.2 L8.8 88.4 L8.8 88.9 L11.6 95.7
  L12.7 100.0 L13.8 102.8 L15.3 105.7 L18.5 110.8 L21.2 113.8 L22.1 114.3 L23.2 114.6 Z`;

const RUN_W_READY_ART = {"src": "img/figures/run-w-ready.1d8ef1fa.webp", "box": [-7.81, -1.25, 107.84, 301.09]};

const GENT_ART = {"src": "img/figures/gent.283d9929.webp", "box": [-0.2, -1.32, 100.19, 300.97]};

const LADY_ART = {"src": "img/figures/lady.02fcd70a.webp", "box": [6.1, -1.3, 93.95, 301.06]};

const SUIT_ART = {"src": "img/figures/suit.8429c12b.webp", "box": [5.78, -1.05, 94.47, 301.18]};

const GOWN_BALL_ART = {"src": "img/figures/gown-ball.d716f3b6.webp", "box": [-47.2, -1.46, 147.16, 301.26]};

const GOWN_TRAIN_ART = {"src": "img/figures/gown-train.c4d5debb.webp", "box": [-27.66, -1.37, 127.6, 296.57]};

const GOWN_EVENING_ART = {"src": "img/figures/gown-evening.117f3cf4.webp", "box": [-6.7, -1.1, 106.76, 301.18]};

const GOWN_SWEEP_ART = {"src": "img/figures/gown-sweep.e6284620.webp", "box": [-23.23, -1.28, 123.34, 298.3]};

const GRAD_ART = {"src": "img/figures/grad.e07abe8c.webp", "box": [-3.03, -1.16, 103.01, 301.23]};

const GRAD_W_TRACE = `M61.5 299.9 L45.4 299.9 L45.3 294.2 L42.8 292.9 L41.7 290.8 L41.4 274.8 L41.9 271.6 L40.5 268.7
  L40.8 263.3 L40.3 260.2 L33.6 234.6 L32.8 229.2 L32.4 228.1 L32.2 223.7 L31.9 222.8 L32.2 215.1
  L32.4 214.2 L32.2 207.0 L31.7 206.2 L31.0 205.8 L29.7 205.6 L24.0 205.3 L23.3 205.1 L19.2 205.1
  L17.2 204.7 L16.6 203.8 L16.3 197.4 L16.6 196.6 L16.6 190.4 L16.8 189.6 L16.8 181.4 L17.2 180.3
  L17.4 162.1 L17.7 161.4 L17.9 150.1 L18.2 149.3 L18.2 143.2 L17.4 142.3 L15.9 142.4 L14.2 142.1
  L13.4 141.7 L12.3 140.0 L10.6 135.1 L9.9 132.1 L7.7 125.2 L7.0 120.6 L5.6 117.4 L5.6 112.5
  L6.6 105.1 L8.2 96.8 L11.3 83.7 L12.5 76.0 L13.9 71.8 L16.5 66.4 L19.1 62.4 L20.4 61.0
  L22.5 60.4 L25.1 60.4 L26.3 60.1 L36.8 55.2 L37.8 54.4 L38.2 53.7 L37.8 47.2 L37.3 44.0
  L37.3 34.5 L37.9 30.6 L39.6 24.8 L39.3 24.0 L37.5 22.4 L28.1 15.7 L25.8 14.4 L25.6 13.4
  L26.1 12.7 L33.2 9.4 L48.8 2.5 L55.6 -0.1 L56.6 0.1 L58.1 1.1 L63.9 5.8 L72.6 12.0
  L75.2 14.4 L79.2 17.3 L79.8 18.1 L79.8 18.9 L78.7 19.6 L73.4 21.1 L72.1 21.7 L71.4 22.2
  L70.9 23.4 L70.9 25.9 L71.4 28.1 L71.4 30.6 L71.1 31.5 L71.4 34.2 L71.1 50.6 L72.4 53.8
  L76.2 59.4 L77.7 60.1 L80.9 60.4 L83.6 61.3 L85.6 63.2 L88.1 67.1 L90.3 72.0 L91.9 77.7
  L93.8 87.5 L93.8 89.3 L94.0 90.1 L94.0 95.2 L94.2 96.0 L94.2 105.6 L94.0 106.3 L94.0 111.7
  L93.5 115.0 L86.7 134.7 L82.7 141.3 L82.7 143.2 L83.1 144.3 L83.1 146.9 L83.3 147.7 L83.3 152.5
  L83.5 153.3 L83.6 158.2 L83.8 158.9 L83.8 162.7 L84.0 163.5 L84.0 167.3 L84.3 168.0 L84.3 171.9
  L84.7 173.0 L84.7 177.0 L84.9 177.7 L84.9 180.8 L85.4 185.0 L85.4 190.1 L85.6 190.9 L85.6 196.4
  L86.0 197.5 L86.0 201.8 L85.6 202.5 L84.1 203.2 L69.1 204.2 L68.6 204.6 L68.2 205.6 L68.2 210.8
  L68.4 211.5 L68.4 213.6 L69.0 216.4 L69.1 219.5 L69.3 220.2 L69.0 229.3 L68.4 232.2 L67.7 239.0
  L66.6 244.4 L65.9 249.9 L65.2 252.2 L63.6 263.0 L63.9 267.8 L63.2 271.4 L63.9 276.0 L63.6 284.8
  L63.9 285.5 L64.1 289.6 L63.7 291.8 L63.2 292.9 L61.6 294.3 Z
  M52.4 272.3 L52.9 271.5 L53.5 268.2 L55.1 264.4 L55.9 260.9 L55.9 250.0 L55.5 248.9 L55.3 243.1
  L54.5 237.3 L54.2 236.2 L54.2 233.9 L53.9 233.1 L53.9 228.2 L53.7 227.2 L53.9 214.0 L53.2 210.4
  L51.7 206.1 L50.9 205.6 L49.6 205.6 L48.7 205.9 L48.3 206.5 L47.3 213.5 L47.3 216.2 L47.8 219.4
  L48.0 225.0 L48.3 225.9 L48.3 235.4 L48.0 236.1 L48.0 242.2 L47.8 243.2 L47.8 257.6 L48.3 261.7
  L50.2 265.8 L51.9 272.0 L52.2 272.4 Z`;

const GRAD_W_ART = {"src": "img/figures/grad-w.44aff5ec.webp", "box": [4.6, -1.24, 95.39, 300.97]};

const BALL_W_READY_TRACE = `M106.4 299.9 L94.0 299.9 L93.9 294.2 L91.6 293.2 L90.0 292.1 L88.7 290.8 L87.2 288.2 L86.2 284.5
  L85.7 283.7 L84.8 282.9 L79.6 280.2 L78.1 279.2 L75.5 276.9 L74.8 275.8 L74.5 274.7 L74.8 273.2
  L76.7 269.0 L79.1 262.4 L80.7 254.0 L80.7 250.6 L78.3 235.6 L77.8 232.9 L76.0 227.7 L75.0 222.2
  L75.0 219.1 L74.8 218.4 L74.8 210.2 L75.0 209.5 L75.0 206.2 L75.5 202.5 L75.5 199.9 L74.9 198.6
  L72.2 194.8 L67.2 184.8 L65.5 182.2 L61.1 177.0 L60.3 176.6 L58.9 176.6 L55.3 177.4 L50.9 177.4
  L50.1 177.1 L49.5 176.5 L48.6 173.6 L48.1 171.0 L48.1 169.2 L46.8 163.2 L46.2 162.4 L45.8 162.5
  L45.5 163.2 L45.3 165.4 L45.3 169.8 L44.3 174.6 L44.3 180.9 L44.5 181.6 L44.5 186.0 L44.8 186.8
  L44.8 190.1 L45.0 190.9 L45.0 198.4 L44.5 202.3 L43.4 207.3 L43.4 216.0 L43.8 217.1 L44.8 228.1
  L45.0 228.8 L45.3 246.1 L45.5 246.9 L45.8 255.5 L46.0 257.2 L48.9 264.7 L50.9 271.1 L50.7 275.5
  L51.5 278.4 L52.3 282.3 L52.5 284.1 L52.5 287.7 L52.0 289.1 L51.0 289.7 L48.6 289.7 L47.3 289.4
  L44.0 289.4 L43.0 289.7 L37.1 289.7 L34.4 288.8 L33.1 287.0 L33.1 286.0 L34.7 281.7 L35.1 279.5
  L36.3 276.8 L37.0 274.1 L37.0 263.5 L36.8 262.7 L36.8 260.7 L36.4 259.1 L33.1 250.3 L29.8 239.9
  L27.7 229.9 L26.9 222.8 L26.9 214.4 L27.2 213.7 L27.2 210.2 L27.4 209.5 L27.4 204.8 L26.2 196.4
  L24.6 188.5 L21.6 176.9 L21.0 176.4 L18.4 175.5 L14.0 174.7 L13.4 174.2 L14.0 172.3 L13.8 169.2
  L14.3 166.1 L14.3 162.8 L13.8 158.5 L13.2 157.0 L11.4 154.2 L10.0 149.8 L8.1 148.4 L7.3 146.9
  L6.0 146.5 L5.3 145.6 L5.6 140.3 L5.9 138.7 L8.0 132.0 L10.3 128.2 L10.3 126.5 L6.8 121.8
  L2.0 116.5 L-6.3 104.9 L-7.1 103.3 L-7.7 100.9 L-7.7 96.5 L-6.6 91.8 L-2.8 80.0 L0.5 72.7
  L2.4 64.5 L4.2 60.0 L7.7 53.7 L10.5 50.6 L12.3 49.4 L17.5 47.2 L19.9 45.7 L26.4 42.7
  L29.4 40.9 L30.5 39.7 L30.5 35.7 L30.0 32.7 L28.3 27.9 L26.4 26.6 L25.4 25.2 L24.4 22.1
  L24.1 19.1 L24.6 17.7 L25.3 16.7 L25.4 14.6 L26.8 9.5 L28.2 6.8 L29.6 4.8 L32.4 2.4
  L34.9 1.1 L37.8 -0.0 L39.7 -0.1 L40.9 0.2 L48.2 2.8 L49.6 3.8 L50.9 5.5 L52.2 8.7
  L53.3 13.5 L53.3 17.1 L53.5 18.0 L53.3 20.2 L53.5 20.9 L53.5 22.4 L51.5 27.8 L49.5 29.3
  L47.1 33.9 L46.9 35.9 L47.3 36.9 L48.2 37.8 L49.4 38.4 L54.5 40.4 L68.7 44.3 L71.0 45.6
  L73.4 47.8 L79.3 54.2 L84.8 62.8 L90.8 68.7 L95.7 74.8 L101.4 82.9 L102.7 85.2 L103.6 88.3
  L103.6 89.5 L103.0 91.4 L95.3 104.5 L91.3 110.6 L83.9 119.5 L82.1 122.6 L79.9 125.3 L77.5 127.4
  L74.2 128.7 L72.3 130.1 L71.2 131.4 L71.0 132.5 L71.4 134.5 L72.9 137.0 L72.7 138.8 L72.8 139.7
  L74.5 140.4 L75.5 141.5 L75.3 143.4 L76.3 147.4 L79.3 154.9 L80.9 160.8 L82.4 163.9 L82.9 167.0
  L84.1 170.7 L91.0 187.7 L91.2 190.1 L91.5 199.7 L92.8 207.4 L93.1 211.8 L93.3 212.6 L93.3 217.5
  L93.6 218.2 L93.3 235.1 L93.1 235.8 L93.1 239.1 L92.6 243.1 L92.6 248.5 L92.4 249.2 L92.6 250.1
  L92.6 254.3 L92.8 255.0 L92.9 258.8 L93.1 260.5 L94.6 264.3 L95.2 265.3 L96.5 266.6 L97.1 267.7
  L99.3 275.2 L101.4 280.3 L105.4 285.4 L106.3 286.8 L107.2 288.8 L107.6 291.8 L107.2 293.1 L106.5 294.3 Z
  M73.3 118.4 L74.4 117.9 L76.7 115.9 L79.8 111.5 L83.6 105.4 L86.3 100.3 L88.4 95.5 L90.0 91.4
  L90.3 89.5 L89.0 87.1 L83.5 81.4 L76.1 72.3 L70.5 66.5 L69.4 66.0 L68.8 66.2 L68.2 66.8
  L66.6 69.7 L66.4 71.4 L66.8 73.3 L65.9 75.7 L66.4 78.6 L66.4 81.9 L68.5 88.9 L68.5 91.1
  L67.5 93.8 L68.0 98.0 L68.0 101.3 L68.7 105.4 L68.8 108.2 L69.0 109.1 L69.0 114.0 L68.1 117.4
  L68.4 117.9 L69.1 118.2 L70.4 118.5 Z
  M17.3 121.6 L17.8 121.0 L17.7 120.2 L15.5 118.2 L14.3 116.2 L14.2 115.5 L14.3 114.1 L14.7 113.6
  L16.4 112.5 L17.1 110.4 L17.1 99.3 L16.9 98.5 L16.9 95.3 L17.4 92.8 L17.4 87.3 L17.0 84.2
  L15.3 80.5 L16.9 76.7 L16.8 73.9 L16.6 73.2 L16.1 73.0 L14.4 74.6 L11.6 79.4 L4.5 95.8
  L4.0 97.5 L4.0 99.0 L8.7 109.3 L11.7 115.2 L14.5 119.4 L16.4 121.4 Z`;

const BALL_W_READY_ART = {"src": "img/figures/ball-w-ready.189cb765.webp", "box": [-8.88, -1.21, 108.84, 301.1]};

const VOLLEY_W_READY_TRACE = `M93.8 299.9 L6.5 299.9 L6.3 299.8 L6.2 294.2 L-0.9 294.1 L-1.7 293.8 L-2.5 293.0 L-3.2 291.3
  L-2.9 285.9 L-2.6 284.5 L-1.2 281.0 L-0.7 278.9 L1.5 275.9 L1.4 274.7 L2.1 273.2 L1.6 270.7
  L2.7 267.2 L3.0 265.5 L3.0 255.9 L3.8 251.3 L4.1 241.0 L4.5 240.0 L5.0 231.2 L5.8 225.8
  L7.2 220.9 L8.5 217.7 L8.9 214.7 L9.7 212.7 L9.8 209.9 L10.8 206.8 L11.1 204.1 L12.2 200.5
  L12.0 198.5 L12.3 197.7 L14.1 196.5 L14.5 195.7 L14.3 176.6 L14.5 175.7 L14.5 162.1 L14.8 161.1
  L14.8 157.4 L16.5 149.4 L18.7 145.3 L19.0 142.1 L20.9 135.2 L21.2 132.9 L20.9 132.2 L20.4 131.8
  L14.2 131.6 L10.2 130.4 L7.2 129.8 L5.0 128.8 L3.4 127.6 L2.0 125.4 L1.1 122.4 L-0.7 119.5
  L-5.5 109.5 L-7.1 104.2 L-9.8 98.0 L-10.0 96.0 L-9.9 94.5 L-8.5 90.2 L-4.5 82.3 L-0.8 76.6
  L0.9 75.0 L2.6 72.8 L3.1 71.7 L4.3 70.2 L7.3 64.2 L9.1 61.5 L11.9 58.1 L14.0 56.0
  L16.8 53.8 L18.8 52.8 L23.8 51.4 L27.5 49.4 L28.9 48.4 L29.2 47.8 L29.2 43.4 L28.8 42.2
  L28.8 39.3 L29.2 38.2 L29.2 32.9 L29.4 32.2 L29.7 25.8 L30.5 21.9 L32.2 18.3 L33.1 15.1
  L33.1 11.1 L33.6 9.0 L35.0 5.9 L37.4 3.4 L42.0 0.7 L45.5 -0.1 L49.1 -0.1 L52.9 1.1
  L57.9 4.1 L59.5 6.1 L60.6 8.5 L62.0 14.7 L61.7 15.6 L61.7 17.7 L62.8 19.9 L62.8 21.0
  L62.3 23.7 L61.5 26.2 L59.4 28.8 L56.7 34.5 L56.7 38.1 L57.0 39.6 L57.7 41.3 L58.7 42.3
  L64.9 45.1 L73.5 48.0 L80.5 51.0 L85.4 55.0 L88.5 58.1 L91.9 62.9 L97.3 71.9 L102.4 78.8
  L107.9 89.0 L109.8 94.0 L109.8 97.0 L107.9 100.7 L100.7 112.7 L92.5 124.0 L86.6 129.8 L84.8 130.9
  L82.9 131.2 L79.4 130.0 L78.6 130.1 L78.3 130.6 L78.6 134.9 L78.9 136.1 L79.4 146.0 L80.5 150.7
  L80.5 152.4 L81.2 154.7 L81.2 156.7 L81.4 157.6 L81.2 179.7 L80.0 187.1 L78.3 193.7 L79.2 199.1
  L79.2 202.8 L80.0 206.2 L80.0 211.4 L79.7 212.4 L79.7 215.4 L79.2 218.1 L80.3 225.9 L80.3 237.4
  L80.1 238.4 L80.0 243.3 L79.7 244.4 L79.2 258.7 L78.9 259.4 L78.9 261.0 L78.6 262.1 L78.6 263.6
  L79.4 264.8 L81.1 266.0 L82.3 267.1 L83.0 268.2 L83.1 269.6 L82.9 270.4 L82.9 272.0 L83.3 272.6
  L84.8 273.5 L85.4 276.0 L86.6 277.9 L87.7 279.2 L96.4 287.7 L96.9 288.6 L97.1 291.3 L96.6 292.6
  L95.7 293.5 L93.8 294.3 Z
  M79.5 295.1 L79.5 294.2 L78.3 293.2 L77.0 291.4 L75.7 290.8 L71.8 290.8 L68.4 290.0 L67.2 289.3
  L66.1 288.3 L64.8 285.7 L64.6 284.4 L64.8 281.9 L65.4 280.3 L65.7 277.5 L66.5 274.3 L66.8 272.1
  L67.6 269.6 L67.6 264.5 L67.1 261.5 L67.1 259.7 L66.8 258.6 L66.8 256.6 L65.7 253.2 L65.1 247.4
  L62.8 237.8 L62.8 235.4 L62.6 234.2 L62.6 223.6 L62.8 222.7 L62.8 219.9 L61.3 217.4 L60.0 214.6
  L59.7 212.1 L58.8 209.5 L57.8 204.8 L57.6 200.6 L56.9 197.7 L56.7 193.0 L56.5 190.5 L56.1 189.4
  L56.1 187.8 L51.9 167.4 L51.0 160.3 L51.3 158.0 L50.8 155.3 L50.2 154.8 L46.9 154.6 L46.3 155.1
  L45.0 157.7 L45.4 161.7 L44.9 166.5 L44.3 169.2 L42.9 173.4 L40.7 178.7 L38.2 183.7 L36.4 188.7
  L33.9 199.1 L32.8 203.0 L32.7 205.4 L31.8 209.1 L29.0 215.0 L28.0 216.4 L26.8 218.8 L24.6 221.2
  L24.1 229.3 L23.8 230.4 L23.5 233.3 L22.4 237.4 L18.9 246.3 L17.0 252.8 L16.7 254.6 L15.8 257.2
  L15.4 260.4 L14.8 262.3 L14.5 263.7 L14.5 267.4 L15.4 270.9 L14.3 274.3 L14.9 276.5 L14.0 277.5
  L13.4 279.7 L13.4 281.9 L13.1 282.9 L13.1 284.9 L12.8 285.6 L12.8 292.7 L12.1 294.2 L12.1 295.0
  L12.4 295.1 Z
  M82.6 121.2 L84.8 119.5 L88.3 114.4 L90.8 110.1 L94.0 102.7 L96.7 97.0 L96.9 95.5 L95.8 93.8
  L92.2 90.2 L90.3 87.4 L87.2 82.2 L85.8 80.7 L84.2 78.5 L79.6 73.9 L78.9 73.6 L78.4 73.9
  L77.9 75.1 L77.4 78.2 L75.5 82.6 L73.5 91.2 L73.8 96.4 L74.1 97.5 L74.2 99.4 L74.4 100.2
  L74.4 104.1 L75.0 105.9 L75.0 107.7 L74.6 108.8 L75.7 112.6 L76.1 115.2 L77.4 117.7 L78.9 119.4
  L80.2 120.4 L81.5 121.1 Z
  M5.6 105.9 L8.8 100.2 L12.1 97.3 L16.8 94.2 L20.5 93.3 L23.1 93.3 L24.5 92.7 L24.6 91.7
  L25.2 90.6 L25.2 89.5 L24.2 86.9 L23.5 83.7 L22.8 82.3 L22.4 80.7 L21.9 80.1 L21.3 80.4
  L20.7 81.8 L18.2 83.9 L17.4 83.9 L17.0 83.3 L17.0 81.5 L17.4 80.1 L16.7 80.3 L14.2 82.2
  L10.9 85.5 L8.4 88.9 L5.9 91.6 L5.0 92.3 L3.0 94.6 L2.4 95.9 L2.4 98.0 L3.8 102.3
  L4.5 105.2 L5.0 106.0 Z`;

const VOLLEY_W_READY_ART = {"src": "img/figures/volley-w-ready.6b1296a2.webp", "box": [-11.24, -1.3, 111.24, 301.25]};

const VOLLEY_M_READY_TRACE = `M10.8 299.9 L-4.7 299.9 L-4.8 294.2 L-5.3 292.9 L-5.3 289.7 L-4.8 287.9 L-3.6 286.1 L0.2 282.4
  L2.9 278.7 L3.6 277.5 L3.6 276.5 L3.1 274.8 L3.5 274.1 L4.5 273.5 L6.0 272.0 L6.5 270.6
  L6.3 265.8 L6.5 264.9 L6.5 262.5 L7.4 260.6 L7.9 258.7 L8.1 249.3 L8.7 247.7 L9.0 245.5
  L9.0 237.1 L9.5 233.0 L10.9 226.0 L13.8 218.2 L15.5 211.3 L15.7 206.2 L16.2 203.0 L16.0 194.8
  L16.7 190.0 L16.7 186.6 L17.6 181.9 L17.6 179.2 L18.1 176.9 L18.1 175.0 L18.4 173.9 L18.7 170.6
  L19.2 167.5 L20.0 164.6 L20.3 161.6 L20.8 159.8 L20.8 158.5 L20.3 157.3 L20.3 155.5 L22.1 151.9
  L22.8 149.6 L23.0 147.6 L23.0 141.8 L22.7 141.3 L22.2 141.0 L16.8 141.0 L15.8 141.3 L14.6 141.0
  L11.7 140.0 L7.1 137.7 L2.2 134.2 L0.4 132.4 L-2.3 128.9 L-4.6 126.6 L-7.0 123.5 L-7.3 122.8
  L-7.3 119.9 L-6.9 118.7 L-6.9 116.9 L-9.1 105.9 L-9.6 101.8 L-9.6 95.9 L-9.4 95.1 L-9.3 93.2
  L-8.8 91.3 L-3.9 81.4 L3.3 71.8 L6.7 67.9 L12.4 58.9 L14.4 56.3 L16.7 54.1 L20.5 51.6
  L32.4 47.0 L38.3 44.4 L43.0 42.8 L44.3 41.7 L44.8 40.5 L44.8 38.7 L44.5 38.0 L44.5 36.4
  L43.8 33.3 L43.2 32.3 L41.4 30.8 L39.9 29.1 L39.1 27.1 L39.1 24.2 L40.7 22.7 L41.0 22.0
  L39.1 13.0 L39.3 10.9 L41.6 6.2 L44.6 3.3 L47.5 1.1 L49.9 0.2 L51.6 -0.1 L60.6 0.2
  L61.6 0.6 L62.5 1.5 L64.1 4.5 L67.2 7.1 L68.4 9.2 L69.1 11.8 L69.1 15.9 L68.3 19.1
  L68.6 19.8 L70.2 21.3 L71.0 22.9 L71.0 25.1 L70.5 27.1 L69.2 29.2 L68.2 30.2 L66.7 30.9
  L65.3 34.9 L65.3 43.1 L65.6 43.7 L66.4 44.4 L69.8 46.3 L72.9 48.5 L76.6 50.6 L78.3 52.1
  L82.6 53.1 L86.8 54.9 L88.2 56.1 L90.0 58.4 L92.9 61.3 L94.9 64.5 L98.7 73.9 L103.2 80.0
  L106.2 85.5 L107.8 89.1 L109.5 94.8 L109.5 98.6 L109.0 100.4 L104.0 110.2 L101.6 114.4 L94.2 124.4
  L92.7 127.4 L89.2 131.6 L87.2 134.9 L85.3 136.6 L83.1 137.7 L82.0 137.8 L80.5 138.5 L78.7 140.3
  L77.0 142.7 L77.1 144.2 L77.7 146.5 L78.0 151.5 L77.1 155.0 L76.9 181.9 L77.1 182.7 L77.4 187.3
  L77.7 188.4 L78.0 195.9 L78.2 196.7 L78.5 200.7 L77.8 201.6 L75.6 202.7 L71.2 203.9 L70.2 204.4
  L69.6 205.8 L68.5 210.7 L68.5 214.1 L69.4 218.0 L70.1 223.4 L70.1 226.0 L70.5 227.1 L70.5 230.4
  L70.1 231.6 L69.9 237.6 L68.0 247.1 L68.0 257.9 L68.5 260.6 L69.6 261.6 L69.9 262.2 L69.8 263.8
  L68.4 266.3 L68.4 267.2 L69.3 268.9 L69.4 270.2 L69.8 271.2 L71.8 273.7 L74.0 275.5 L75.7 277.5
  L79.4 279.7 L81.7 280.8 L83.7 282.5 L85.2 285.4 L85.5 286.2 L85.5 287.7 L84.4 289.1 L81.2 290.6
  L77.6 291.1 L72.4 290.8 L69.9 290.3 L68.0 289.6 L66.4 288.6 L64.9 287.1 L63.8 286.4 L61.4 285.8
  L57.0 285.8 L55.3 285.4 L53.2 284.5 L51.4 283.0 L50.8 281.8 L50.4 280.1 L52.9 273.7 L54.2 268.5
  L54.0 263.5 L55.1 260.0 L54.2 256.2 L53.8 252.5 L53.7 246.6 L53.4 245.6 L53.4 244.3 L52.6 241.8
  L51.3 238.9 L50.4 234.3 L50.4 230.8 L50.8 229.6 L50.8 224.1 L52.2 215.1 L50.2 209.0 L48.5 200.0
  L48.0 199.7 L47.7 199.9 L47.0 201.7 L46.2 202.3 L43.8 201.4 L38.9 201.2 L38.4 201.4 L38.2 202.0
  L36.8 207.6 L34.5 213.7 L31.9 218.6 L30.3 222.1 L30.0 226.3 L29.8 227.1 L29.8 229.4 L29.4 230.5
  L29.4 232.8 L28.4 238.9 L27.2 242.4 L24.1 248.2 L23.2 250.8 L21.6 258.3 L20.3 263.1 L20.3 266.4
  L20.1 267.3 L20.0 269.1 L19.4 271.2 L19.4 273.4 L19.8 274.7 L19.8 279.0 L20.5 282.0 L20.5 284.4
  L20.1 285.5 L18.6 287.2 L15.8 288.4 L14.7 288.5 L13.8 289.1 L13.5 289.8 L13.5 291.9 L13.0 293.0
  L12.5 293.5 L10.8 294.3 Z
  M80.9 124.8 L82.5 124.3 L83.4 123.4 L87.2 118.1 L90.6 111.4 L91.8 106.8 L94.8 101.0 L95.7 98.4
  L95.7 97.4 L95.3 96.5 L91.6 92.5 L86.8 85.7 L84.3 82.8 L83.0 80.8 L82.1 80.1 L81.5 80.2
  L81.0 80.5 L80.0 82.3 L79.3 84.4 L79.3 86.5 L79.1 87.6 L77.1 92.0 L75.8 97.8 L75.8 105.4
  L74.8 110.5 L74.8 112.5 L74.4 113.5 L74.4 116.5 L74.2 117.2 L74.2 121.3 L74.4 122.9 L75.0 124.0
  L75.7 124.4 L78.4 124.9 Z
  M4.9 106.6 L8.7 103.0 L10.6 101.6 L12.1 100.8 L14.5 100.1 L15.7 100.1 L17.4 99.6 L20.6 99.5
  L23.5 98.4 L23.7 97.8 L23.2 91.9 L23.0 91.1 L22.8 85.7 L21.0 80.0 L20.5 79.3 L19.6 79.5
  L18.2 81.3 L15.3 83.1 L13.0 86.0 L11.3 87.8 L7.6 90.0 L6.8 91.0 L5.4 95.2 L5.2 97.3
  L5.2 100.0 L4.2 105.8 L4.4 106.6 Z`;

const VOLLEY_M_READY_ART = {"src": "img/figures/volley-m-ready.fd618290.webp", "box": [-10.61, -1.08, 110.86, 301.13]};

const FOOT_M_BALL_TRACE = `M81.6 299.9 L65.9 299.9 L65.8 294.2 L64.2 293.6 L63.6 292.6 L63.6 290.8 L64.0 289.7 L65.5 287.4
  L67.9 284.8 L69.6 281.6 L70.0 280.1 L71.9 275.9 L71.8 275.0 L71.3 274.7 L69.7 274.8 L67.7 275.8
  L67.2 275.8 L67.1 275.4 L69.5 273.8 L71.8 272.9 L72.5 272.1 L74.9 267.4 L76.0 263.6 L76.5 261.0
  L76.5 256.8 L76.3 256.0 L76.0 249.8 L75.6 248.9 L75.4 245.4 L74.8 242.1 L74.8 238.2 L74.5 237.3
  L74.5 224.5 L74.2 223.4 L74.1 221.8 L73.3 219.1 L73.0 215.5 L71.4 213.0 L69.6 209.0 L68.4 207.0
  L65.4 204.7 L64.0 202.9 L63.1 201.1 L62.5 200.7 L62.1 200.8 L61.6 201.4 L60.0 206.4 L60.3 210.1
  L60.6 211.1 L61.1 216.0 L61.5 217.0 L61.7 221.1 L62.1 222.0 L62.1 228.1 L61.1 233.1 L58.6 240.4
  L58.0 242.8 L57.7 245.5 L57.3 246.4 L57.1 249.1 L56.5 251.8 L56.5 253.3 L56.1 254.3 L56.1 257.6
  L55.8 258.3 L55.8 260.4 L56.1 261.4 L58.5 266.2 L59.1 268.0 L59.6 271.0 L59.6 274.9 L59.4 276.6
  L58.5 279.7 L57.7 281.2 L54.4 284.4 L50.3 287.0 L48.8 288.6 L47.0 289.5 L43.6 290.3 L39.9 290.3
  L37.0 289.8 L34.0 288.5 L31.3 286.1 L29.2 285.3 L28.1 285.7 L25.0 285.9 L20.6 286.8 L18.3 286.8
  L17.2 287.1 L15.7 286.8 L14.6 287.1 L12.3 287.1 L11.0 286.8 L9.1 287.1 L7.1 286.6 L5.7 286.5
  L3.2 285.9 L-0.7 283.7 L-1.2 282.8 L-1.1 281.6 L-0.2 279.8 L0.9 278.8 L2.8 278.0 L6.6 277.4
  L11.3 276.2 L16.3 273.8 L22.5 270.0 L26.5 266.3 L29.3 261.8 L32.8 258.4 L37.0 255.9 L41.1 254.7
  L41.9 253.4 L41.9 245.3 L41.7 244.5 L41.7 241.6 L41.3 240.5 L41.1 233.6 L40.7 232.4 L40.7 221.8
  L41.1 220.7 L41.3 216.8 L41.7 215.7 L41.7 210.6 L41.3 209.5 L41.1 206.1 L40.4 202.7 L40.0 202.1
  L39.3 201.6 L36.2 201.5 L34.8 200.8 L33.2 199.2 L32.0 197.6 L31.0 194.1 L31.0 179.1 L30.7 177.9
  L30.2 177.1 L29.0 176.6 L26.3 176.7 L25.5 176.5 L21.8 174.4 L19.4 172.3 L18.6 170.7 L16.5 164.4
  L16.5 162.4 L17.5 159.1 L18.0 155.3 L19.0 151.2 L19.0 147.2 L19.4 144.6 L19.4 143.2 L19.8 142.1
  L20.1 135.7 L20.4 134.6 L20.9 128.1 L21.3 127.0 L21.3 124.7 L21.9 121.4 L21.9 118.8 L22.4 114.6
  L24.3 106.2 L26.6 99.3 L26.4 97.9 L25.0 96.5 L24.5 95.2 L24.5 86.8 L24.9 85.7 L24.9 82.7
  L25.3 79.7 L25.4 77.3 L25.7 76.2 L26.0 72.5 L26.3 71.4 L26.3 69.5 L26.8 66.3 L28.8 60.1
  L30.7 57.4 L31.8 56.4 L37.2 53.1 L45.6 48.4 L47.4 46.7 L47.8 45.9 L47.8 44.4 L47.1 41.4
  L46.5 40.2 L44.3 37.5 L43.3 35.8 L40.5 27.4 L40.2 25.8 L41.1 23.7 L41.1 22.3 L39.9 19.1
  L39.6 17.1 L38.8 14.4 L39.0 12.3 L41.9 6.3 L44.3 3.7 L47.8 1.6 L49.9 0.8 L54.2 -0.1
  L56.9 -0.1 L58.4 0.2 L60.2 0.9 L64.1 3.8 L65.9 5.7 L68.1 6.5 L68.8 7.3 L70.0 10.5
  L70.0 11.8 L70.3 12.8 L70.3 15.6 L70.0 16.7 L70.0 19.7 L69.7 21.0 L70.1 22.0 L71.1 23.2
  L71.2 24.6 L69.7 30.1 L69.1 31.0 L67.8 31.9 L67.1 32.8 L67.0 38.1 L67.4 39.7 L68.1 40.4
  L70.5 40.5 L74.3 44.5 L79.9 46.9 L84.8 50.0 L86.8 52.0 L90.2 54.5 L91.7 56.0 L94.4 59.6
  L96.0 62.2 L97.6 66.8 L98.1 69.2 L98.1 71.3 L99.4 75.9 L99.9 80.7 L100.8 85.3 L101.1 94.3
  L100.5 97.9 L100.5 105.7 L100.8 106.8 L100.8 108.1 L99.6 112.5 L99.4 116.3 L97.2 126.3 L96.0 131.2
  L92.5 141.1 L90.8 148.6 L90.8 150.9 L91.4 153.6 L91.4 157.4 L91.6 158.1 L91.6 167.3 L91.4 168.1
  L91.4 171.3 L91.6 172.0 L91.9 177.3 L92.2 178.3 L92.5 183.8 L92.8 184.8 L93.1 190.5 L93.3 192.7
  L93.7 193.6 L94.0 201.3 L93.5 202.0 L91.3 202.9 L89.0 203.3 L88.1 204.3 L88.1 205.7 L88.8 209.0
  L90.1 211.5 L90.4 213.4 L92.9 221.1 L93.7 224.0 L94.0 227.5 L94.3 228.6 L94.3 234.0 L94.0 235.1
  L93.7 239.4 L93.3 240.4 L92.8 245.2 L91.3 253.3 L88.9 261.3 L88.1 265.5 L88.1 269.1 L88.6 271.0
  L88.2 273.9 L88.9 276.3 L88.9 279.8 L89.3 280.8 L89.3 283.4 L88.5 285.7 L85.8 290.4 L84.2 292.3
  L81.7 294.2 Z`;

const FOOT_M_BALL_ART = {"src": "img/figures/foot-m-ball.859f178d.webp", "box": [-2.59, -1.45, 102.56, 301.32]};

const FOOT_W_BALL_TRACE = `M43.7 299.9 L40.7 299.9 L33.5 298.3 L32.5 297.8 L31.3 296.7 L29.9 294.5 L28.6 293.9 L25.1 294.5
  L21.8 294.5 L19.8 295.1 L13.4 296.0 L9.8 296.9 L7.8 296.9 L6.6 297.3 L2.0 297.3 L0.9 296.9
  L-1.8 296.9 L-4.3 296.5 L-5.4 295.9 L-7.2 294.4 L-7.9 293.6 L-8.0 293.2 L-6.7 290.6 L-4.8 288.4
  L-2.9 287.7 L0.1 287.4 L3.0 286.7 L5.8 285.4 L6.3 284.8 L8.8 280.6 L9.4 278.8 L9.4 278.1
  L8.0 277.5 L6.8 278.1 L6.1 278.8 L5.2 280.8 L4.5 281.2 L3.4 281.2 L3.1 280.3 L4.4 278.6
  L7.3 276.3 L9.6 274.0 L12.2 272.2 L14.2 271.2 L14.7 270.6 L15.3 269.3 L15.3 268.6 L14.7 267.0
  L15.0 266.0 L15.0 261.7 L15.4 260.7 L15.4 258.5 L15.0 257.1 L15.0 250.8 L14.7 250.1 L14.7 248.6
  L13.5 242.7 L13.2 239.5 L12.9 238.4 L12.9 236.0 L12.6 235.3 L12.4 231.1 L11.1 226.9 L10.9 219.4
  L10.5 218.3 L10.2 215.8 L7.5 209.2 L7.2 206.0 L7.6 204.5 L9.9 200.0 L10.7 198.7 L14.5 191.0
  L16.0 189.1 L19.7 181.6 L20.1 179.7 L20.1 176.9 L21.0 173.0 L21.9 169.9 L25.3 162.0 L26.4 156.6
  L25.8 153.3 L26.2 152.3 L26.4 149.4 L27.0 146.4 L27.3 127.9 L27.7 126.7 L27.7 124.7 L28.3 121.6
  L28.8 116.4 L30.7 106.9 L30.9 103.8 L31.3 102.6 L31.3 100.5 L31.0 99.9 L29.3 98.6 L28.8 98.0
  L28.5 91.1 L28.8 90.2 L28.8 88.2 L29.2 87.1 L29.4 83.1 L29.8 81.9 L29.8 79.9 L30.3 76.4
  L30.7 75.4 L30.7 73.5 L31.3 71.1 L31.6 68.6 L33.1 63.2 L34.5 60.5 L35.9 59.1 L45.3 53.7
  L51.1 50.9 L54.9 48.1 L55.5 47.3 L55.5 44.7 L55.1 43.5 L51.5 40.2 L48.4 34.1 L47.5 28.9
  L45.1 19.9 L45.1 16.8 L45.6 13.9 L48.3 8.2 L49.2 6.7 L50.4 5.5 L54.0 3.2 L57.5 2.0
  L59.7 0.1 L62.7 -0.1 L65.8 1.3 L68.3 4.0 L70.9 5.8 L73.3 8.1 L74.2 9.8 L74.8 12.0
  L75.5 14.9 L75.5 18.4 L75.7 19.8 L77.0 23.3 L77.0 25.7 L75.7 29.1 L73.7 31.2 L73.0 33.5
  L72.5 38.3 L73.0 41.0 L74.0 43.3 L75.0 44.3 L75.8 44.6 L77.0 44.4 L78.0 44.5 L80.4 46.7
  L83.2 48.1 L85.4 48.9 L90.8 51.9 L93.7 54.3 L97.5 56.8 L98.8 58.3 L101.2 62.2 L103.7 68.8
  L104.2 72.6 L105.5 78.4 L105.7 82.2 L107.0 86.8 L107.2 91.0 L107.8 94.1 L106.3 97.7 L107.0 102.1
  L107.2 114.3 L105.2 127.0 L103.7 134.4 L102.5 138.6 L102.4 140.0 L105.2 151.7 L106.7 159.7 L107.2 163.7
  L107.2 168.9 L106.6 169.5 L105.5 169.6 L104.6 169.9 L102.5 170.0 L101.7 170.8 L100.7 178.0 L99.4 183.9
  L99.2 187.5 L98.8 188.5 L98.6 193.0 L97.9 196.0 L97.7 199.4 L97.3 200.5 L97.3 206.5 L97.1 207.4
  L97.3 216.2 L97.7 217.3 L97.9 221.7 L98.3 222.7 L98.8 227.4 L99.4 230.4 L99.4 234.0 L99.0 235.0
  L98.5 235.5 L96.5 236.5 L94.0 237.2 L91.8 237.5 L87.2 237.5 L85.4 237.1 L83.3 236.2 L82.1 235.3
  L81.3 233.9 L81.1 223.8 L80.9 222.5 L78.3 217.4 L76.6 210.7 L76.6 209.0 L76.0 206.3 L76.0 203.0
  L74.8 196.2 L74.5 195.2 L74.0 190.6 L71.5 179.7 L70.9 176.0 L70.1 174.9 L69.4 174.9 L66.9 175.6
  L64.5 175.6 L63.5 176.0 L62.2 176.0 L60.7 176.6 L54.0 185.2 L49.7 189.8 L45.9 193.3 L44.9 193.9
  L40.8 198.0 L34.4 206.0 L32.0 209.5 L28.9 213.6 L28.8 214.2 L29.4 215.6 L31.3 223.0 L31.6 225.7
  L32.8 230.9 L32.8 233.2 L33.1 234.0 L33.1 239.8 L32.8 240.5 L32.8 242.3 L32.4 243.4 L32.2 246.4
  L31.8 247.3 L31.3 251.7 L31.3 254.1 L30.9 255.1 L31.1 264.1 L31.7 264.4 L35.6 262.4 L37.6 261.8
  L40.7 261.3 L45.0 261.3 L49.1 262.3 L51.8 263.7 L54.8 265.6 L58.7 270.2 L60.6 273.8 L61.9 278.0
  L61.9 282.1 L61.5 283.1 L61.3 285.6 L60.6 287.5 L59.6 289.5 L59.0 290.3 L57.7 291.5 L55.5 294.2
  L53.5 296.3 L52.2 297.2 L48.8 298.8 Z`;

const FOOT_W_BALL_ART = {"src": "img/figures/foot-w-ball.7341f7b5.webp", "box": [-9.22, -1.49, 109.37, 301.44]};

const BALL_M_READY_TRACE = `M28.0 299.9 L10.5 299.9 L10.2 299.8 L10.0 291.0 L11.1 287.1 L13.9 281.7 L16.3 274.2 L17.1 273.0
  L17.1 272.3 L15.9 270.5 L15.9 269.9 L17.1 268.8 L19.1 267.5 L20.3 264.1 L20.1 255.7 L19.7 253.5
  L20.3 250.9 L20.3 246.6 L20.1 245.8 L20.1 227.1 L20.3 226.1 L20.3 223.2 L21.9 214.8 L25.0 204.5
  L25.5 201.3 L25.5 199.1 L25.8 198.0 L25.8 196.1 L25.5 195.3 L24.7 194.7 L21.8 194.9 L20.5 194.4
  L20.0 193.6 L19.8 192.5 L21.0 190.3 L21.4 188.9 L21.9 178.0 L22.9 170.3 L22.9 167.6 L23.3 166.5
  L23.3 163.0 L23.5 162.0 L23.5 145.7 L23.7 145.0 L24.0 138.2 L25.5 131.3 L28.8 123.2 L28.4 122.5
  L26.9 121.8 L26.3 121.2 L25.5 119.6 L25.5 116.7 L25.8 115.6 L25.8 113.1 L26.1 112.4 L26.1 111.0
  L25.8 110.4 L23.9 108.9 L18.3 106.5 L15.2 104.9 L14.3 104.0 L13.1 101.6 L12.3 98.7 L12.3 90.7
  L12.6 90.0 L12.6 87.0 L12.9 85.9 L13.4 79.5 L15.8 70.1 L15.8 66.9 L16.0 66.1 L16.3 61.7
  L17.8 56.8 L20.0 52.4 L22.3 49.5 L26.1 46.8 L30.7 45.0 L38.2 40.8 L41.1 40.0 L41.8 39.2
  L42.0 38.5 L42.1 36.0 L41.6 33.3 L40.2 30.6 L39.1 29.5 L38.1 29.0 L36.9 27.7 L35.9 25.1
  L35.6 23.1 L35.9 19.7 L34.3 13.5 L34.3 11.4 L35.0 9.0 L36.9 4.8 L39.4 2.5 L44.0 0.3
  L45.8 -0.1 L49.6 -0.1 L51.6 0.5 L53.4 1.4 L55.8 4.0 L57.4 4.5 L58.9 5.4 L59.7 6.6
  L60.4 8.7 L60.4 15.7 L62.0 19.1 L62.0 22.7 L61.1 25.6 L59.2 26.8 L58.1 30.6 L58.5 36.5
  L59.4 39.2 L60.5 40.0 L63.0 40.7 L64.9 41.8 L68.3 43.4 L73.4 45.2 L76.1 46.6 L78.0 47.3
  L79.9 48.5 L82.0 50.6 L83.1 52.6 L84.8 57.7 L85.7 61.8 L85.7 68.5 L85.5 69.3 L85.5 71.1
  L86.7 78.6 L86.9 83.9 L87.3 85.0 L87.3 86.9 L88.1 91.1 L89.9 97.1 L89.9 100.7 L89.3 103.5
  L88.3 106.0 L86.8 108.0 L86.5 108.9 L86.5 110.5 L87.3 113.5 L87.6 115.5 L87.3 116.4 L86.2 118.3
  L85.7 120.2 L81.7 124.7 L80.6 126.4 L79.3 127.4 L76.6 127.5 L74.5 128.6 L74.0 129.6 L76.3 133.6
  L78.0 138.6 L78.5 138.9 L80.6 138.6 L82.9 139.4 L83.6 140.5 L83.9 142.9 L83.8 144.3 L82.4 148.9
  L82.0 149.7 L79.6 152.2 L79.2 153.1 L79.2 155.4 L79.6 156.5 L79.6 159.0 L79.8 159.7 L79.8 178.9
  L79.6 180.0 L79.8 188.0 L78.9 192.9 L78.6 193.4 L77.3 194.2 L77.0 194.9 L77.2 204.1 L79.8 216.6
  L79.8 227.3 L79.6 228.1 L79.6 231.0 L79.2 232.1 L79.0 238.5 L78.5 242.6 L78.0 259.7 L78.5 261.0
  L80.0 261.8 L80.4 262.4 L80.3 263.4 L79.1 264.6 L79.1 265.3 L85.2 270.6 L85.0 271.3 L83.9 271.0
  L83.0 270.1 L82.4 268.9 L81.8 268.6 L81.4 268.7 L81.1 269.1 L81.1 270.4 L83.2 274.8 L84.5 277.0
  L85.7 278.7 L87.4 280.2 L88.0 281.3 L89.3 284.3 L89.9 286.8 L89.4 287.7 L88.4 288.1 L82.2 288.6
  L77.3 289.5 L75.6 289.2 L73.0 287.9 L72.1 287.2 L71.4 286.0 L70.5 283.6 L66.8 281.8 L65.6 280.9
  L64.8 279.6 L64.8 277.4 L65.8 274.7 L65.8 270.2 L66.2 268.5 L66.9 267.2 L67.9 262.7 L67.9 255.7
  L67.6 255.0 L67.6 249.3 L67.4 248.5 L67.4 244.2 L67.1 242.3 L65.3 233.1 L63.5 227.7 L63.0 224.3
  L63.0 222.2 L62.7 221.2 L62.7 215.2 L63.0 214.4 L63.1 210.0 L63.0 207.2 L62.2 204.5 L60.9 201.6
  L59.9 198.6 L59.1 194.5 L58.2 193.6 L56.5 193.1 L55.6 192.3 L55.0 191.1 L53.7 186.5 L53.1 182.8
  L52.6 182.1 L52.2 182.7 L52.1 186.0 L51.7 188.9 L51.7 191.2 L50.9 195.7 L50.3 196.5 L49.6 196.8
  L44.3 196.8 L43.4 197.3 L42.8 198.8 L42.5 200.7 L41.7 203.4 L39.3 210.1 L38.8 212.5 L38.1 215.7
  L38.1 220.9 L37.9 221.7 L37.9 225.2 L37.4 229.4 L36.6 232.4 L35.1 235.5 L34.6 237.0 L32.5 245.8
  L31.5 251.3 L31.5 254.4 L30.6 259.1 L30.6 261.5 L30.1 264.3 L31.0 268.3 L31.0 269.3 L30.6 270.4
  L30.6 272.3 L31.3 274.3 L31.7 276.4 L31.6 282.5 L32.2 285.7 L32.2 288.0 L31.7 289.1 L29.7 290.9
  L29.1 293.0 L28.1 294.2 Z`;

const BALL_M_READY_ART = {"src": "img/figures/ball-m-ready.25828173.webp", "box": [8.83, -1.21, 91.18, 300.58]};

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
          names: ['On the ball', 'On the ball'],
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
function artTexture(art) {
  let tx = ART_TEX.get(art.src);
  if (!tx) {
    let done;
    ART_READY.set(art.src, new Promise(r => { done = r; }));
    tx = new THREE.TextureLoader().load(ART_BASE ? ART_BASE + art.src : new URL('../' + art.src, import.meta.url).href,
      () => { done(); window.dispatchEvent(new Event('tala:art')); }, undefined, () => done());
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 8;
    tx.userData.shared = true;
    ART_TEX.set(art.src, tx);
  }
  return tx;
}

/* Resolves once the print a trophy carries has loaded (at once if it has none),
   for a still that is taken once and kept, like the shop's. */
export function artReady(cfg) {
  const art = figureArt(cfg.shape, cfg.variant) || DESIGNS[cfg.shape]?.art;
  if (!art) return Promise.resolve();
  artTexture(art);
  return ART_READY.get(art.src) || Promise.resolve();
}

/* What the order sheet says about the print, or null. */
export function printNote(cfg) {
  if (figureArt(cfg.shape, cfg.variant)) return 'Printed in full colour on the front: a fashion illustration, no face';
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
  lady:     { group: 'Figures', label: 'Lady',      build: ladyShape,     base: 1.30, decal: { onBase: true },              note: 'Full-colour illustration, no face: a lady in a red dress and heels.' },
  gown:     { group: 'Figures', label: 'Gown',      build: gownShape,     base: 1.24, decal: { onBase: true },              note: 'Four gowns, a full-colour illustration with no face. Mutya, Mr & Ms and coronation nights.' },
  gent:     { group: 'Figures', label: 'Gentleman', build: gentShape,     base: 1.22, decal: { onBase: true },              note: 'Full-colour illustration, no face: a gentleman in a black tuxedo. The pageant partner to the Lady.' },
  suit:     { group: 'Figures', label: 'Suit',       build: suitShape,    base: 1.26, decal: { onBase: true },              note: 'Full-colour illustration, no face: a man in a charcoal suit and tie. The partner to the Lady.' },
  grad:     { group: 'Figures', label: 'Graduate',  build: gradShape,     base: 1.42, decal: { onBase: true },              note: 'Full-colour illustration, no face, men and women, in gown and cap. For recognition day.' },
  ball:     { group: 'Figures', label: 'Basketball',build: ballShape,     base: 1.26, decal: { onBase: true },              note: 'Full-colour illustration, no face, men and women, the ball in hand. The liga favourite.' },
  volley:   { group: 'Figures', label: 'Volleyball',build: volleyShape,  base: 1.26, decal: { onBase: true },              note: 'Full-colour illustration, no face, men and women, the ball in hand. The school and liga favourite.' },
  box:      { group: 'Figures', label: 'Boxing',    build: boxShape,      base: 1.26, decal: { onBase: true },              note: 'Full-colour illustration, no face, men and women. For boxing and arnis tournaments.' },
  foot:     { group: 'Figures', label: 'Football',  build: footShape,     base: 1.28, decal: { onBase: true },              note: 'Full-colour illustration, no face, men and women, the ball at their feet. Also used for futsal.' },
  run:      { group: 'Figures', label: 'Athletics', build: runShape,      base: 1.26, decal: { onBase: true },              note: 'Full-colour illustration, no face, men and women. Covers track, fun runs and Palaro.' },
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
  white:  { label: 'White acrylic',  short: 'White',  kind: 'sheet',  color: 0xF2F0EA, mult: 1.00, note: 'Clean ground for any sticker. The pageant favourite.' },
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
  const figure = onBase;
  if (figure) ({ cut, h, bx } = fitFigure(shape, w, h, cfg.variant));
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
  blade.position.y = baseTop - h * 0.015 - (figure ? h * 0.0045 + bevel * 1.5 : 0);
  blade.position.x = -bx;                   // the feet on the centre line
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
    const lg = safeExtrude(pieces(L.shape), { depth: tl, bevelEnabled: true, bevelThickness: ab,
      bevelSize: ab, bevelOffset: 0, bevelSegments: 2, curveSegments: 36 });
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
    m.position.set(-bx, blade.position.y, faceZ + 0.002 + lift(L.level - 1));
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
      map: artTexture(art), transparent: true, alphaTest: 0.5, roughness: 0.3, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    colour.position.set(-bx, blade.position.y, faceZ + 0.003);
    colour.name = 'figurePrint';
    group.add(colour);
    /* The blade's bevel and sides carry the picture too, through the same frame,
       so a printed figure has no pale outline of bare sheet round it: the owner
       saw one and read it as background left on the picture. The print runs past
       the cut (BLEED in polish-figure.py) to cover them. The back stays sheet. */
    const BP = geo.attributes.position, BU = geo.attributes.uv;
    for (let i = 0; i < BP.count; i++) {
      const px = BP.getX(i) / fk + fcx, py = fmax - BP.getY(i) / fk;
      BU.setXY(i, (px - ax0) / (ax1 - ax0), 1 - (py - ay0) / (ay1 - ay0));
    }
    BU.needsUpdate = true;
    blade.material = [blade.material, new THREE.MeshPhysicalMaterial({
      map: artTexture(art), roughness: 0.4, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2,
    })];
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
