/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — home page 3D
   Two live viewers, plus the six shop thumbnails rendered through
   a single shared context and baked to images.
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { createViewer, webglAvailable } from './viewer.js?v=202611051643';
import { buildTrophy, disposeGroup, price, peso, artReady, SHAPES, DESIGNS, MATERIALS, BASES, SIZES } from './trophy.js?v=202611051643';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* The flat drawings in the 3D boxes stay hidden (index.html, data-wait) until
   the real picture is in. This script has started, so the 8-second fallback
   is off; with no WebGL the drawings are all there is, so they show now. */
clearTimeout(window.__talaLate);
const GL = webglAvailable();
const ready = viz => viz?.removeAttribute('data-wait');
if (!GL) $$('.viz[data-wait]').forEach(ready);

/* The pictures drawn here are kept between visits (Cache Storage, one cache
   per build, so an update draws them again), so a reload shows the real
   trophies at once. */
const BUILD = new URL(import.meta.url).searchParams.get('v') || 'dev';
const STILLS = `tala-stills-${BUILD}`;
const stillStore = (async () => {
  try {
    if (!('caches' in window) || !crypto.subtle) return null;
    for (const k of await caches.keys()) if (k.startsWith('tala-stills-') && k !== STILLS) caches.delete(k);
    return await caches.open(STILLS);
  } catch { return null; }
})();
async function stillKey(text) {
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return new URL(`__stills/${[...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')}`, location.href).href;
}
async function cachedStill(text) {
  try {
    const store = await stillStore;
    const hit = store && await store.match(await stillKey(text));
    return hit ? URL.createObjectURL(await hit.blob()) : null;
  } catch { return null; }
}
async function keepStill(text, blob) {
  try {
    const store = await stillStore;
    if (store && blob) await store.put(await stillKey(text), new Response(blob, { headers: { 'Content-Type': blob.type } }));
  } catch { /* drawn again next time */ }
}
// a picture into its box, shown once it can paint whole (it fades in over the
// waiting box). Never waited on: a lazy picture far down "See all" would hold
// everything up, so it loads at once (it is made here, nothing to download).
function showStill(viz, src) {
  const img = viz?.querySelector('.viz__poster');
  if (!img) return;
  img.loading = 'eager';
  img.src = src;
  Promise.race([img.decode(), new Promise(r => setTimeout(r, 3000))]).catch(() => {}).then(() => ready(viz));
}
// the shop's pictures already drawn on an earlier visit
async function applyCachedStills() {
  await Promise.all($$('#shopGrid .card[data-cfg]:not([data-photo]):not([data-baked])').map(async card => {
    const url = await cachedStill(card.dataset.cfg);
    if (!url || card.hasAttribute('data-baked')) return;
    card.dataset.baked = '';
    showStill(card.querySelector('.viz'), url);
  }));
}

/* Prices come from the same model the designer uses, so the two can never
   drift apart. The HTML carries a fallback for the no-JS case. */
function writePrices() {
  for (const card of $$('#shopGrid .card')) {
    const slot = card.querySelector('[data-price]');
    if (!slot || card.hasAttribute('data-fixed') || !card.dataset.cfg) continue;
    try {
      const cfg = JSON.parse(card.dataset.cfg);
      slot.textContent = peso(price({ ...cfg, qty: 1 }).unit);
    } catch { /* keep the hand-written fallback */ }
  }
  // "from ₱…" on the page follows the cheapest trophy actually in the shop
  const prices = $$('#shopGrid .card:not([data-cat]) [data-price]').map(e => Number(e.textContent.replace(/[^\d]/g, ''))).filter(n => n > 0);
  if (prices.length) $$('[data-from]').forEach(e => { e.textContent = peso(Math.min(...prices)); });
}

/* The shop grid is run from the Admin Deck (admin.html → shop_items). The six
   cards written into index.html stay as the fallback: offline, Supabase down,
   or nothing published yet. A card shows the trophy's photo when it has one,
   otherwise its 3D design baked to a still, like the built-in cards. The
   first six are the home page's "most ordered". "See all" opens the rest, in
   the designer's groups, and after them every designer trophy not in the
   shop yet (as the Admin Deck lists them), so the shop shows all it makes.
   Each card opens its trophy's own page in the cart: cart.html?item=<shop
   item> or ?shape=<designer trophy>. */
const SHOP_POSTERS = ['lady', 'shield', 'oval', 'arch', 'plaque', 'facet'];
const FEATURED = 6;
const GROUP_ORDER = ['Classic', 'Rounds', 'Stars', 'Curves', 'Figures'];
const escH = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ITEM_ID = /^[a-z0-9][a-z0-9-]{1,79}$/;

/* A designer trophy as the shop would list it: the Admin Deck's "Not in the
   shop yet" card -- its own sheet and ink, Medium on a black gold bar,
   sample wording on the picture. */
function catalogDesign(k) {
  const s = SHAPES[k];
  return { shape: k, variant: 0, material: MATERIALS[s.sheet] ? s.sheet : 'white', size: 'm', baseKind: 'goldbar', baseFinish: 'black',
    decal: 'rect', scheme: s.ink || 'black', laminate: 'gloss', font: 'classic', motif: 'star',
    org: 'Gloria Awards Night', title: 'Champion', name: 'Juan Dela Cruz', date: '2026' };
}

async function shopRows(base, key) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(`${base}/rest/v1/shop_items?select=id,name,line,category,price,design,images&published=is.true&order=sort.asc,name.asc`, {
      headers: { apikey: key }, signal: ctl.signal,
    });
    clearTimeout(t);
    return res.ok ? await res.json() : null;
  } catch { return null; }                  // keep the built-in cards
}

async function loadShop() {
  const grid = $('#shopGrid');
  if (!grid) return;
  const C = window.TALA_CONFIG || {};
  const base = String(C.supabaseUrl || '').replace(/\/+$/, '');
  const photoBase = `${base}/storage/v1/object/public/trophy-photos/`;
  const [rows, products] = await Promise.all([
    base && C.supabaseKey ? shopRows(base, C.supabaseKey) : null,
    fetch(new URL('../img/products/products.json', import.meta.url)).then(r => (r.ok ? r.json() : [])).catch(() => []),
  ]);

  // a photo uploaded in the Admin Deck, or one served with the site (assets/img/products)
  const photoOf = r => (r.images || []).find(u => typeof u === 'string' && (u.startsWith(photoBase) || /^assets\/[\w./-]+$/.test(u)));
  const designOf = r => (r.design && typeof r.design === 'object' && SHAPES[r.design.shape] && r.design.shape !== 'custom' ? r.design : null);
  const items = (Array.isArray(rows) ? rows : []).filter(r => r && typeof r.name === 'string' && (photoOf(r) || designOf(r)));
  // the owner's photos of designer trophies (products.json `key`)
  const photoKey = Object.fromEntries((Array.isArray(products) ? products : [])
    .filter(x => x && x.key && /^assets\/img\/products\/[\w.-]+$/.test(x.photo || '')).map(x => [x.key, x.photo]));

  const card = (r, more) => {
    const photo = photoOf(r), d = designOf(r);
    const fixed = r.price != null;
    const shown = fixed ? peso(r.price) : 'Ask for a price';
    const pic = photo
      ? `<img class="viz__poster viz__photo" src="${escH(photo)}" alt="${escH(r.name)}" loading="lazy">`
      : `<img class="viz__poster" src="assets/img/${SHOP_POSTERS.includes(d.shape) ? 's-' + d.shape : 'poster-hero'}.svg" alt="${escH(r.name)}, ${escH(r.line)}">`;
    const name = ITEM_ID.test(r.id || '') && d ? `<a class="card__go" href="cart.html?item=${r.id}">${escH(r.name)}</a>` : escH(r.name);
    // the design prices the card even under a photo; only a card with no photo is baked to a still
    return `<article class="card in${more ? ' is-more' : ''}" data-rev${d ? ` data-cfg="${escH(JSON.stringify(d))}"` : ''}${photo ? ' data-photo' : ''}${fixed ? ' data-fixed' : ''}>
        <div class="viz"${!photo && GL ? ' data-wait' : ''}>${pic}</div>
        <div class="card__b">
          <div><h3>${name}</h3><p>${escH(r.line || r.category)}</p></div>
          <p class="card__p" data-price>${shown}</p>
        </div>
      </article>`;
  };
  // a designer trophy that is not in the shop: its photo, or its tile until it is baked
  const catCard = k => {
    const d = catalogDesign(k), photo = photoKey[k];
    const line = `${MATERIALS[d.material].label} · ${BASES.goldbar.label.toLowerCase()} base · ${SIZES.m.total} cm`;
    const pic = photo
      ? `<img class="viz__poster viz__photo" src="${escH(photo)}" alt="${escH(SHAPES[k].label)}" loading="lazy">`
      : `<img class="viz__poster" src="${DESIGNS[k]?.tile ? `assets/${escH(DESIGNS[k].tile)}` : 'assets/img/poster-hero.svg'}" alt="${escH(SHAPES[k].label)}" loading="lazy">`;
    return `<article class="card in is-more" data-rev data-cat data-cfg="${escH(JSON.stringify(d))}"${photo ? ' data-photo' : ''}>
        <div class="viz"${!photo && GL ? ' data-wait' : ''}>${pic}</div>
        <div class="card__b">
          <div><h3><a class="card__go" href="cart.html?shape=${k}">${escH(SHAPES[k].label)}</a></h3><p>${escH(line)}</p></div>
          <p class="card__p" data-price></p>
        </div>
      </article>`;
  };

  let rest = [];
  if (items.length) {
    grid.innerHTML = items.slice(0, FEATURED).map(r => card(r, false)).join('');
    rest = items.slice(FEATURED);
  } else {
    // the built-in cards open their trophy as the designer has it
    for (const c of $$('.card[data-cfg]', grid)) {
      let shape = null;
      try { shape = JSON.parse(c.dataset.cfg).shape; } catch { /* no link */ }
      const h = c.querySelector('h3');
      if (h && SHAPES[shape] && shape !== 'custom') h.innerHTML = `<a class="card__go" href="cart.html?shape=${shape}">${escH(h.textContent)}</a>`;
    }
  }
  const shapeOf = c => { try { return JSON.parse(c.dataset.cfg).shape; } catch { return null; } };
  const inShop = new Set([...items.map(r => designOf(r)?.shape), ...$$('.card[data-cfg]', grid).map(shapeOf)].filter(Boolean));
  const cat = Object.keys(SHAPES).filter(k => k !== 'custom' && !inShop.has(k));
  const groupOf = r => SHAPES[designOf(r)?.shape]?.group || 'More';
  grid.insertAdjacentHTML('beforeend', [...new Set([...GROUP_ORDER, ...rest.map(groupOf)])].map(g => {
    const gs = rest.filter(r => groupOf(r) === g), cs = cat.filter(k => (SHAPES[k].group || 'Figures') === g);
    return gs.length || cs.length ? `<h3 class="grid__g is-more">${escH(g)}</h3>${gs.map(r => card(r, true)).join('')}${cs.map(catCard).join('')}` : '';
  }).join(''));

  // nothing more to show: no "See all" (it is in index.html, wired at the end of this file)
  if (!rest.length && !cat.length) $('#shop .shop__all')?.remove();
  const head = $('#shop .sec-head h2');
  if (head && items.length && items.length < FEATURED) head.textContent = 'What we make most often.';
}

function liveViewer(vizId, canvasId, cfg) {
  const viz = $(vizId), canvas = $(canvasId);
  if (!viz || !canvas) return null;

  const viewer = createViewer(canvas, { autoRotate: true, maxDpr: 2 });
  const model = buildTrophy(cfg);
  viewer.scene.add(model);
  viewer.frameObject(model);
  viewer.invalidate();
  viz.classList.add('is-live');
  ready(viz);
  return { viewer, model };
}

/* One renderer, six stills. Cheaper and far kinder to the GPU than six
   live canvases, and the result is a plain <img> the page can cache. */
/* Wait for a quiet moment. The shop stills only replace SVG posters that are
   already on screen, so they can always wait for the page to be idle. */
const idle = () => new Promise(r =>
  'requestIdleCallback' in window ? requestIdleCallback(() => r(), { timeout: 2000 }) : setTimeout(r, 50));

async function bakeThumbnails() {
  await idle();
  const cards = $$('#shopGrid .card[data-cfg]:not([data-photo]):not([data-baked])').filter(c => c.getClientRects().length);
  if (!cards.length) return;
  for (const c of cards) c.dataset.baked = '';     // taken: a second run (See all opened) leaves it alone

  // a card is at most ~360 css px wide; 560 covers that on a 1.5x screen and
  // costs half the pixels of the old 760 x 950 -- each still was ~0.5 s on a phone
  const W = 560, H = 700;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;

  const viewer = createViewer(canvas, {
    capture: true, fixed: { w: W, h: H }, loop: false,
    interactive: false, maxDpr: 1,
  });

  for (const card of cards) {
    const viz = card.querySelector('.viz');
    try {
      const cfg = JSON.parse(card.dataset.cfg);

      // Frosted engraving needs a dark ground or the piece reads as empty.
      if (cfg.material === 'clear' || cfg.material === 'white') viz?.classList.add('is-dark');

      // a printed piece: wait for its print, or the still is taken bare (4 s at most)
      await Promise.race([artReady(cfg), new Promise(r => setTimeout(r, 4000))]);
      const model = buildTrophy(cfg);
      viewer.scene.add(model);
      viewer.frameObject(model);
      viewer.renderNow();

      // WebP where the browser writes it (a fifth of the PNG), kept for the next visit
      let blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.9));
      if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      viewer.scene.remove(model);
      disposeGroup(model);
      if (!blob) throw new Error('no picture');
      keepStill(card.dataset.cfg, blob);
      showStill(viz, URL.createObjectURL(blob));
    } catch {
      ready(viz);                              // its drawing, rather than a box that waits for ever
    }

    // Yield so the page stays responsive. setTimeout rather than rAF: a
    // backgrounded tab still runs timers, but stops animation frames.
    await idle();
  }

  viewer.dispose();
}

/* The band trophy is built on screen as a short scroll scene. The section
   pins, and the scroll position IS the timeline (scrubbed, so scrolling back
   takes it apart again in reverse): the camera starts wide and low and glides
   round while the base rises, the cut acrylic drops into its slot, the gold
   wings slide in from either side and the printed sticker presses on. The
   list beside it and a caption follow the same clock. It is the product's
   real anatomy, not decoration. GSAP + ScrollTrigger are fetched only here;
   with reduced motion the trophy simply stays assembled. */
const GSAP = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5';
// `li` is the line of the list beside the scene that the stage is about
const STAGES = [
  { at: 0.00, cap: 'The base', li: 1 },
  { at: 0.17, cap: 'Cut acrylic, dropped into its slot', li: 0 },
  { at: 0.44, cap: 'Gold accents, layered on', li: 1 },
  { at: 0.64, cap: 'The printed sticker, pressed on', li: 2 },
  { at: 0.83, cap: 'Ready for the podium', li: 3 },
];
async function assembleOnScroll(sel, live) {
  if (!live || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { viewer, model } = live;
  const base = model.getObjectByName('base'), blade = model.getObjectByName('blade');
  const sticker = model.getObjectByName('sticker');
  if (!base || !blade || !sticker || !viewer.setView) return;
  const wings = model.children.filter(o => /^(accent|layer)\d+$/.test(o.name));   // a design's layers
  const h = model.userData.height || 20;
  const w = model.userData.dims?.w || 6;

  // each wing slides in from its own side
  const side = wings.map(m => {
    m.geometry.computeBoundingBox();
    const c = m.geometry.boundingBox.getCenter(new THREE.Vector3());
    return c.x < 0 ? -1 : 1;
  });
  const rest = { base: base.position.clone(), blade: blade.position.clone(), sticker: sticker.position.clone(),
                 wings: wings.map(m => m.position.clone()), sScale: sticker.scale.clone() };

  let gsap, ScrollTrigger;
  try {
    ({ gsap } = await import(`${GSAP}/index.js`));
    ({ ScrollTrigger } = await import(`${GSAP}/ScrollTrigger.js`));
  } catch { return; }                       // offline CDN: the trophy just stays assembled
  gsap.registerPlugin(ScrollTrigger);

  const home = viewer.getHome();
  // opens three-quarter and a little high, so the falling acrylic reads as a shape, not an edge
  const cam = { az: home.az - 0.72, pol: 1.32, dist: home.dist * 1.78 };
  const k = { base: 0, blade: 0, wings: 0, sticker: 0 };   // 0 = apart, 1 = in place

  const steps = $$('.band ol li');
  const viz = $(sel);
  const cap = document.createElement('p');
  cap.className = 'viz__stage';
  cap.setAttribute('aria-hidden', 'true');
  viz.append(cap);
  let shown = -1;

  const apply = progress => {
    const drop = (1 - k.blade) * h * 0.50;
    base.position.y = rest.base.y - (1 - k.base) * h * 0.22;
    blade.position.y = rest.blade.y + drop;
    wings.forEach((m, i) => {
      m.visible = k.wings > 0.001;
      m.position.x = rest.wings[i].x + side[i] * (1 - k.wings) * w * 2.2;
      m.position.y = rest.wings[i].y + drop;
      m.position.z = rest.wings[i].z + (1 - k.wings) * h * 0.10;
    });
    // never past 1: an overshoot pushes the sticker behind the acrylic face
    const ks = Math.min(1, k.sticker);
    sticker.visible = ks > 0.001;
    sticker.position.y = rest.sticker.y + (rest.sticker.y > rest.base.y + 1 ? drop : 0);
    sticker.position.z = rest.sticker.z + (1 - ks) * h * 0.55;
    sticker.scale.setScalar(rest.sScale.x * (1 + (1 - ks) * 0.35));
    viewer.setView(cam);

    if (typeof progress === 'number') {
      let i = 0;
      STAGES.forEach((st, j) => { if (progress >= st.at) i = j; });
      if (i !== shown) {
        shown = i;
        cap.innerHTML = `<span>${String(i + 1).padStart(2, '0')} / ${String(STAGES.length).padStart(2, '0')}</span>${STAGES[i].cap}`;
        cap.classList.remove('is-in'); void cap.offsetWidth; cap.classList.add('is-in');
        steps.forEach((li, j) => li.classList.toggle('is-on', j === STAGES[i].li));
      }
    }
  };

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  tl.to(cam, { keyframes: [
        { az: home.az - 0.40, pol: 1.36, dist: home.dist * 1.30, duration: 3.8, ease: 'sine.inOut' },
        { az: home.az, pol: home.pol, dist: home.dist * 1.06, duration: 4.0, ease: 'sine.inOut' },
      ] }, 0)
    .to(k, { base: 1, duration: 1.8, ease: 'sine.inOut' }, 0.1)
    .to(k, { blade: 1, duration: 2.2, ease: 'sine.inOut' }, 1.3)
    .to(k, { wings: 1, duration: 1.8, ease: 'sine.inOut' }, 3.3)
    .to(k, { sticker: 1, duration: 1.7, ease: 'sine.inOut' }, 5.0)
    .to({}, { duration: 0.6 }, 7.2);           // a short beat on the finished piece

  viz.classList.add('is-scene');
  apply(0);
  const wide = matchMedia('(min-width: 900px)').matches;
  viewer.hold(true);
  ScrollTrigger.create({
    trigger: wide ? '.band' : sel,
    // wide screens: lock the whole section just under the fixed menu bar, so the
    // heading, the list and the trophy all stay in view until the build is done
    // (centring it slid the heading under the bar on tall screens)
    start: () => wide ? `top ${Math.round(($('#nav')?.getBoundingClientRect().height || 70))}px` : 'center center',
    end: () => `+=${Math.round(innerHeight * (wide ? 1.9 : 1.5))}`,   // about 2 screens: slow and calm
    pin: wide ? '.band' : sel,
    scrub: 1.2,                                // glides after the wheel instead of following it step by step
    animation: tl,
    // finished: the idle sway and dragging take over, and the hint comes back
    onLeave: () => { viewer.hold(false); viz.classList.remove('is-scene'); },
    onEnterBack: () => { viewer.hold(true); viz.classList.add('is-scene'); },
  });
  // one clock: the scrubbed (smoothed) timeline drives parts, camera and captions alike
  tl.eventCallback('onUpdate', () => apply(tl.progress()));

  // The page above can grow after this was measured: "See all trophies"
  // opens the whole shop. Measure again whenever the page's height changes, or
  // the section pins where it used to be -- over the trophies (owner, 5 Nov).
  let measured = document.documentElement.scrollHeight, again = 0;
  new ResizeObserver(() => {
    clearTimeout(again);
    again = setTimeout(() => {
      if (Math.abs(document.documentElement.scrollHeight - measured) < 2) return;
      ScrollTrigger.refresh();
      measured = document.documentElement.scrollHeight;
    }, 120);
  }).observe(document.body);
}

/* Run `fn` once, when `sel` comes within a screen of the viewport. Each live
   viewer and the thumbnail bake is seconds of main-thread work on a phone,
   and none of it is visible on load. */
function whenNear(sel, fn) {
  const el = $(sel);
  if (!el) return;
  if (!('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: '600px 0px' });
  io.observe(el);
}

async function boot() {
  if (!webglAvailable()) return;          // posters stay; nothing breaks
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* draw with fallbacks */ }
  }

  liveViewer('#heroViz', '#heroCanvas', {
    shape: 'lady', material: 'gold', size: 'l', baseKind: 'goldbar', baseFinish: 'black',
    decal: 'rect', scheme: 'black', font: 'script', laminate: 'gloss', motif: 'crown',
    org: 'Mutya ng Gloria', title: '1st Runner-Up', name: 'Maria C. Lualhati', date: '2026',
  });

  whenNear('#bandViz', () => assembleOnScroll('#bandViz', liveViewer('#bandViz', '#bandCanvas', {
    shape: 'shield', material: 'blue', size: 'm', baseKind: 'goldbar', baseFinish: 'black',
    decal: 'shield', scheme: 'navy', font: 'sport', laminate: 'gloss', motif: 'laurel',
    org: 'Barangay Liga 2026', title: 'Champion', name: "Men's Basketball", date: 'Gloria',
  })));

  // the shop grid is well below the fold: bake its stills only on approach
  whenNear('#shopGrid', () => { shopReady.then(bakeThumbnails); });
}

writePrices();
// the hero must not wait for the network: only the shop stills wait for the shop
const shopReady = loadShop().then(applyCachedStills).then(writePrices, () => {});

/* "See all trophies" (index.html, under the shop's intro) opens the rest of
   the shop. Wired now, not once the shop has loaded: cards added later still
   show, being .is-more under .is-open. It sits above the list, so closing it
   needs no scroll back. */
const allBtn = $('#shop .shop__all button');
allBtn?.addEventListener('click', () => {
  const open = $('#shop').classList.toggle('is-open');
  allBtn.setAttribute('aria-expanded', String(open));
  allBtn.textContent = open ? 'Show fewer' : 'See all trophies';
  if (open && GL) shopReady.then(bakeThumbnails);   // the cards just shown that have no photo
});
boot().catch(err => {
  // A failure here just means the SVG posters stay on screen: show them.
  document.documentElement.classList.add('js-late');
  console.warn('[tala] 3D unavailable:', err);
});
