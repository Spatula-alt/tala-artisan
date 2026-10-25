/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — home page 3D
   Two live viewers, plus the six shop thumbnails rendered through
   a single shared context and baked to images.
   ══════════════════════════════════════════════════════════════ */
import { createViewer, webglAvailable } from './viewer.js?v=202610251536';
import { buildTrophy, disposeGroup, price, peso } from './trophy.js?v=202610251536';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

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
}

/* The shop grid is run from the Admin Deck (admin.html → shop_items). The six
   cards written into index.html stay as the fallback: offline, Supabase down,
   or nothing published yet. A card shows the trophy's photo when it has one,
   otherwise its 3D design baked to a still, like the built-in cards. */
const SHOP_POSTERS = ['lady', 'shield', 'oval', 'arch', 'plaque', 'facet'];
const escH = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function loadShop() {
  const grid = $('#shopGrid');
  const C = window.TALA_CONFIG || {};
  const base = String(C.supabaseUrl || '').replace(/\/+$/, '');
  if (!grid || !base || !C.supabaseKey) return;
  const photoBase = `${base}/storage/v1/object/public/trophy-photos/`;
  let rows;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(`${base}/rest/v1/shop_items?select=id,name,line,category,price,design,images&published=is.true&order=sort.asc,name.asc`, {
      headers: { apikey: C.supabaseKey }, signal: ctl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return;
    rows = await res.json();
  } catch { return; }                       // keep the built-in cards
  if (!Array.isArray(rows) || !rows.length) return;

  grid.innerHTML = rows.map(r => {
    const photo = (r.images || []).find(u => typeof u === 'string' && u.startsWith(photoBase));
    const d = r.design && typeof r.design === 'object' && r.design.shape !== 'custom' ? r.design : null;
    if (!photo && !d) return '';
    const fixed = r.price != null;
    const shown = fixed ? peso(r.price) : 'Ask for a price';
    const pic = photo
      ? `<img class="viz__poster viz__photo" src="${escH(photo)}" alt="${escH(r.name)}" loading="lazy">`
      : `<img class="viz__poster" src="assets/img/${SHOP_POSTERS.includes(d.shape) ? 's-' + d.shape : 'poster-hero'}.svg" alt="${escH(r.name)}, ${escH(r.line)}">`;
    return `<article class="card in" data-rev${!photo ? ` data-cfg="${escH(JSON.stringify(d))}"` : ''}${fixed ? ' data-fixed' : ''}>
        <div class="viz">${pic}</div>
        <div class="card__b">
          <div><h3>${escH(r.name)}</h3><p>${escH(r.line || r.category)}</p></div>
          <p class="card__p" data-price>${shown}</p>
        </div>
      </article>`;
  }).join('');
  const head = $('#shop .sec-head h2');
  if (head && rows.length !== 6) head.textContent = 'What we make most often.';
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
  const cards = $$('#shopGrid .card[data-cfg]');
  if (!cards.length) return;

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
    let cfg;
    try { cfg = JSON.parse(card.dataset.cfg); } catch { continue; }

    // Frosted engraving needs a dark ground or the piece reads as empty.
    if (cfg.material === 'clear' || cfg.material === 'white') card.querySelector('.viz')?.classList.add('is-dark');

    const model = buildTrophy(cfg);
    viewer.scene.add(model);
    viewer.frameObject(model);
    viewer.renderNow();

    const url = canvas.toDataURL('image/png');
    const img = card.querySelector('.viz__poster');
    if (img) img.src = url;

    viewer.scene.remove(model);
    disposeGroup(model);

    // Yield so the page stays responsive. setTimeout rather than rAF: a
    // backgrounded tab still runs timers, but stops animation frames.
    await idle();
  }

  viewer.dispose();
}

/* The band trophy assembles as its section scrolls into view: the base rises,
   the cut acrylic drops into its slot, the printed sticker presses on. It is
   the product's real anatomy, not decoration. GSAP + ScrollTrigger are fetched
   only here, when the section is near; with reduced motion the trophy simply
   stays assembled. Scrubbed (scrub: 0.6) and driving three object offsets,
   so each scroll step costs one render. */
const GSAP = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5';
async function assembleOnScroll(sel, live) {
  if (!live || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { viewer, model } = live;
  const parts = ['base', 'blade', 'sticker'].map(n => model.getObjectByName(n));
  if (parts.some(p => !p)) return;
  const [base, blade, sticker] = parts;
  const rest = parts.map(p => p.position.clone());
  const h = model.userData.height || 20;

  let gsap, ScrollTrigger;
  try {
    ({ gsap } = await import(`${GSAP}/index.js`));
    ({ ScrollTrigger } = await import(`${GSAP}/ScrollTrigger.js`));
  } catch { return; }                       // offline CDN: the trophy just stays assembled
  gsap.registerPlugin(ScrollTrigger);

  const k = { base: 0, blade: 0, sticker: 0 };   // 0 = apart, 1 = assembled
  const apply = () => {
    base.position.y    = rest[0].y - (1 - k.base) * h * 0.18;
    blade.position.y   = rest[1].y + (1 - k.blade) * h * 0.32;
    sticker.position.y = rest[2].y + (1 - k.blade) * (sticker.parent === model && rest[2].y > rest[0].y + 1 ? h * 0.32 : 0);
    // never past 1: an overshoot pushed the sticker behind the acrylic face,
    // where it read as dim and printed on the inside
    sticker.position.z = rest[2].z + (1 - Math.min(1, k.sticker)) * h * 0.22;
    viewer.invalidate();
  };
  apply();
  gsap.timeline({
    scrollTrigger: { trigger: sel, start: 'top 85%', end: 'center 55%', scrub: 0.6 },
    onUpdate: apply,
  })
    .to(k, { base: 1, duration: 0.35, ease: 'power2.out' })
    .to(k, { blade: 1, duration: 0.45, ease: 'power3.inOut' }, 0.2)
    .to(k, { sticker: 1, duration: 0.35, ease: 'power2.out' }, 0.62);
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
    org: 'Mutya ng Calapan', title: '1st Runner-Up', name: 'Maria C. Lualhati', date: '2026',
  });

  whenNear('#bandViz', () => assembleOnScroll('#bandViz', liveViewer('#bandViz', '#bandCanvas', {
    shape: 'shield', material: 'blue', size: 'm', baseKind: 'goldbar', baseFinish: 'black',
    decal: 'shield', scheme: 'navy', font: 'sport', laminate: 'gloss', motif: 'laurel',
    org: 'Barangay Liga 2026', title: 'Champion', name: "Men's Basketball", date: 'Calapan City',
  })));

  // the shop grid is well below the fold: bake its stills only on approach
  whenNear('#shopGrid', () => { shopReady.then(bakeThumbnails); });
}

writePrices();
// the hero must not wait for the network: only the shop stills wait for the shop
const shopReady = loadShop().then(writePrices, () => {});
boot().catch(err => {
  // A failure here just means the SVG posters stay on screen.
  console.warn('[tala] 3D unavailable:', err);
});
