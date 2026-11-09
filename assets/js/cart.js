/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — the cart and checkout (cart.html)
   The owner asked for a shop like Shopee's: the design from the designer
   with a quantity, bulk prices and shipping, "Add to cart" beside "Place
   order"; a cart; a checkout with the delivery address, the products, a
   message, the shipping option, vouchers, the payment method and the totals;
   then the order number and what to pay where -- GCash, Maya or bank, the
   shop's own details from the Admin Deck -- with a receipt to upload.
   Promos (supabase/orders.sql): codes, automatic ones such as Buy 1 Take 1
   on chosen trophies, and a share voucher.
   Prices come from the designer's price model (quote in trophy.js); the
   proof confirms them before anything is made.
   ══════════════════════════════════════════════════════════════ */
import {
  quote, peso, fmtDate, SHAPES, SIZES, MATERIALS, BASES, BASE_FINISHES, ZONES, SPEEDS, PAYMENTS, QTY_TIERS, DESIGNS,
  buildTrophy, disposeGroup, artReady, shopDesignOk, shopGroup, OUTFITS, hasOutfit, outfitOk, outfitLabel,
} from './trophy.js?v=202611091615';
import { createViewer, webglAvailable } from './viewer.js?v=202611091615';
import { hasBadWord } from './wordguard.js?v=202611091615';

const C = window.TALA_CONFIG || {};
const BASE = String(C.supabaseUrl || '').replace(/\/+$/, '');
const AUTH = { apikey: C.supabaseKey, Authorization: `Bearer ${C.supabaseKey}` };
const LIVE = !!(C.supabaseUrl && C.supabaseKey);
const FB = 'https://m.me/61595841638997';
const FB_PAGE = 'https://www.facebook.com/profile.php?id=61595841638997';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = a => a.reduce((x, y) => x + y, 0);
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const uuid = () => crypto.randomUUID();
const clampQty = v => Math.min(Math.max(parseInt(v, 10) || 1, 1), 2000);
const PHOTO_BASE = `${BASE}/storage/v1/object/public/trophy-photos/`;
const picOk = s => typeof s === 'string' && (s.startsWith('data:image/jpeg;base64,') || /^assets\/img\/[\w./-]+$/.test(s)
  || (BASE && s.startsWith(PHOTO_BASE) && !/["'<>\s]/.test(s)));

/* ───────────────────────── state ───────────────────────── */

// items: { id, design, text, summary: { title, preview }, files, qty, on }; from the shop also
// item (its id), fixed (the owner's price) and shopDesign (the trophy as listed, which that price is for)
let cart = store.get('tala.cart', []).filter(it => it && it.design && SHAPES[it.design.shape]);
let incoming = null;                                  // the trophy on show: a design just made, or one from the shop
let settings = null;                                  // the shop's payment details and share voucher
let autos = [];                                       // promos everyone gets (Buy 1 Take 1 on a trophy...)
const order = {
  zone: null, speed: 'standard', payment: 'gcash', message: '',
  voucher: null,                                      // { kind, value, shapes, min_spend, code, note } or the share voucher
  editAddress: false,
};
let addr = store.get('tala.addr', null);              // { name, email, phone, delivery, address }, kept for next time
let listed = [];                                      // shop vouchers to claim (promo_listed)
let claimed = store.get('tala.claimed', []);          // the voucher codes this customer claimed
let stats = {};                                       // shape -> { rating, ratings, sold }: real ones only (trophy_stats)
let orders = store.get('tala.orders', []);            // orders placed here: { ref, code, at, titles, rated }

const keepCart = () => {
  if (store.set('tala.cart', cart)) return true;
  store.set('tala.cart', cart.map(({ files, ...it }) => it));   // out of room: the trophies, without their pictures
  return false;
};
/* The owner, 5 Nov: "instead of 50 percent down payment make it like full
   payment". GCash, Maya and bank: the whole amount once the order is placed;
   cash: on pickup, or on delivery within the province. */

/* ───────────────────────── prices ───────────────────────── */

const variation = d => [MATERIALS[d.material]?.label, `${BASES[d.baseKind]?.label || ''}${BASE_FINISHES[d.baseFinish] ? ', ' + BASE_FINISHES[d.baseFinish].label : ''}`,
  SIZES[d.size] ? `${SIZES[d.size].label} · ${SIZES[d.size].total} cm` : ''].filter(Boolean).join(' · ');
function itemQuote(it, qty = it.qty) {
  const q = quote({ ...it.design, qty, zone: 'pickup', speed: order.speed, payment: 'cash' });
  if (!(it.fixed > 0)) return q;
  const one = quote({ ...(it.shopDesign || it.design), qty: 1, zone: 'pickup', speed: 'standard', payment: 'cash' }).unit;
  const unit = Math.max(5, Math.round(q.unit * it.fixed / one / 5) * 5);
  return { ...q, unit, make: unit * qty };
}
const covers = (p, it) => !p.shapes || !p.shapes.length || p.shapes.includes(it.design.shape);
const promoLine = p => p.note || (p.kind === 'b1t1' ? 'Buy 1 Take 1'
  : `${p.min_qty ? `Any ${p.min_qty} enjoy ` : ''}${p.kind === 'percent' ? `${+p.value}% off` : `${peso(p.value)} off`}`
    + (p.min_spend ? ` · min. spend ${peso(p.min_spend)}` : ''));

/* The order, priced: every trophy at its bulk price, shipped together (one
   courier fee for all the pieces), then the promos -- the automatic ones,
   then one voucher (a code, or the share voucher) on what is left. */
function priceOrder(items) {
  const lines = items.map(it => {
    const q = itemQuote(it);
    return { it, unit: q.unit, make: q.make, setup: q.setup, off: 0 };
  });
  const merch = sum(lines.map(l => l.make + l.setup));
  const pieces = sum(items.map(it => it.qty));
  const zone = ZONES[order.zone] || ZONES.pickup;
  const shipping = zone.fee ? Math.round(zone.fee + zone.per * pieces) : 0;
  const notes = [];
  const apply = (p, label) => {
    let off = 0;
    const eligible = lines.filter(l => covers(p, l.it));
    if (!eligible.length) return 0;
    const base = sum(eligible.map(l => l.make - l.off));
    const count = sum(eligible.map(l => l.it.qty));
    if (p.min_qty && count < p.min_qty) { notes.push(`${label}: add ${p.min_qty - count} more to get it`); return 0; }
    if (p.min_spend && base < p.min_spend) { notes.push(`${label}: spend ${peso(p.min_spend)} on its trophies to use it`); return 0; }
    if (p.kind === 'b1t1') {
      for (const l of eligible) { const free = Math.floor(l.it.qty / 2) * l.unit; l.off += free; off += free; }
    } else {
      off = p.kind === 'amount' ? Math.min(+p.value, base) : Math.round(base * +p.value / 100);
      if (base) for (const l of eligible) l.off += off * (l.make - l.off) / base;
    }
    if (off) notes.push(`${label}: −${peso(off)}`);
    return off;
  };
  let discount = 0;
  for (const p of autos) discount += apply(p, promoLine(p));
  if (order.voucher) discount += apply(order.voucher, order.voucher.kind === 'share' ? `Share voucher ${order.voucher.value}% off`
    : `Code ${order.voucher.code}${order.voucher.note ? ' · ' + order.voucher.note : ''}`);
  discount = Math.min(Math.round(discount), sum(lines.map(l => l.make)));
  const total = merch + shipping - discount;
  const q0 = items.length ? quote({ ...items[0].design, qty: pieces, zone: order.zone || 'pickup', speed: order.speed, payment: 'cash' }) : null;
  return { lines, merch, shipping, pieces, discount, notes, total,
    arrival: q0 && q0.arrival, days: q0 && q0.days };
}

/* ───────────────────────── the server ───────────────────────── */

const rpc = (fn, args) => fetch(`${BASE}/rest/v1/rpc/${fn}`, {
  method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}),
}).then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));

const upload = (path, blob, type) => fetch(`${BASE}/storage/v1/object/request-art/${path}`, {
  method: 'POST', headers: { ...AUTH, 'Content-Type': type, 'x-upsert': 'false' }, body: blob,
});

/* The pictures a design was made with (orderFiles in designer.js), into the
   shop's private bucket under a fresh random folder. -> { picture?, photo? } */
async function sendFiles(all) {
  const id = uuid(), sent = {};
  for (const k of ['picture', 'photo']) {
    const m = typeof all[k] === 'string' && all[k].match(/^data:(image\/(?:webp|png|jpeg));base64,(.+)$/);
    if (!m) continue;
    const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
    const res = await upload(`${id}/${k}.${{ 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }[m[1]]}`, new Blob([bytes], { type: m[1] }), m[1]);
    if (res.ok) sent[k] = `${id}/${k}.${{ 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }[m[1]]}`;
  }
  return sent;
}

/* ───────────────────────── the share voucher ───────────────────────── */

const visitor = () => {
  let v = store.get('tala.visitor', null);
  if (typeof v !== 'string' || !/^[0-9a-f-]{36}$/.test(v)) { v = uuid(); store.set('tala.visitor', v); }
  return v;
};
async function shareCode() {
  let code = store.get('tala.share', null);
  if (typeof code !== 'string' || !/^[A-Z0-9]{8}$/.test(code)) {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => abc[b % abc.length]).join('');
    store.set('tala.share', code);
  }
  try { await rpc('share_start', { p_code: code, p_owner: visitor() }); } catch { /* counted once it works */ }
  return code;
}
const shareUrl = code => new URL(`./?ref=${code}`, location.href).href;

/* ───────────────────────── views ───────────────────────── */

const views = ['product', 'cart', 'checkout', 'paid'];
const PAGE_TITLE = document.title;
function show(view) {
  const withDesign = view === 'cart' && incoming?.source === 'designer';
  for (const v of views) $(`#${v}`).hidden = v !== view && !(v === 'product' && withDesign);
  const title = $('#title');
  title.textContent = view === 'product' ? incoming.summary?.title || SHAPES[incoming.design.shape].label
    : { cart: withDesign ? 'Your design' : 'Shopping cart', checkout: 'Checkout', paid: 'Order placed' }[view] || 'Shopping cart';
  title.classList.toggle('vh', view === 'product');                 // the product's own heading shows its name
  document.title = view === 'product' ? `${title.textContent} — Tala Artisan` : PAGE_TITLE;
  if (view === 'product' || withDesign) renderProduct();
  if (view === 'checkout') renderCheckout(); else if (view === 'cart') renderCart();
  if (view !== 'cart') $('#orders').hidden = true; else if (orders.length) renderOrders(null);
  scrollTo({ top: 0, behavior: 'instant' });
}
// #checkout, #cart, or the trophy on show (a shop trophy's own page)
const viewOfHash = () => (location.hash === '#checkout' && cart.some(i => i.on) ? 'checkout'
  : location.hash !== '#cart' && incoming?.source === 'shop' ? 'product' : 'cart');
addEventListener('hashchange', () => { if (['', '#cart', '#checkout'].includes(location.hash)) show(viewOfHash()); });

/* A trophy as a product page, laid out like the owner's Shopee pictures:
   pictures with thumbnails and sharing; the name, real ratings and sold; the
   price (struck through under a promo) and the price after the best voucher;
   shop vouchers, bundle deals, shipping with every option, the shop's
   promise; the sheet colour, size and base to pick (a trophy from the shop --
   a design just made keeps its own); the quantity and the two buttons. Under
   it: the shop (with its Facebook page), the specifications, the
   description, the ratings, and more trophies. Nothing is made up: no
   rating, sale, follower or reply rate that is not real is shown. */
function renderProduct() {
  const box = $('#product');
  if (!incoming) { box.hidden = true; return; }
  const it = incoming, d = it.design, shopItem = it.source === 'shop';
  const sh = SHAPES[d.shape] || {};
  const q = itemQuote(it);
  // the price with the automatic promos, and with each shop voucher instead of any voucher in use
  const priced = v => { const saved = order.voucher; order.voucher = v; try { return priceOrder([it]); } finally { order.voucher = saved; } };
  const now = priced(null);
  const each = Math.round((now.merch - now.discount - q.setup) / it.qty);
  const vouchers = listed.filter(v => covers(v, it));
  const best = vouchers.map(v => priced({ ...v })).map(p => p.merch - p.discount).sort((x, y) => x - y)[0];
  const after = best != null && best < now.merch - now.discount ? Math.round((best - q.setup) / it.qty) : null;
  const off = each < q.unit ? Math.round((1 - each / q.unit) * 100) : 0;
  const tiers = [...QTY_TIERS].reverse().map(t => `<span><b>${esc(t.label)}</b> ${peso(itemQuote(it, t.min).unit)}</span>`).join('');
  const deals = autos.filter(p => covers(p, it) && !p.min_qty);
  const bundles = autos.filter(p => covers(p, it) && p.min_qty);
  const st = stats[d.shape];
  // shipping as the customer would most likely get it: the island, unless they pick up
  const zk = order.zone || (addr?.delivery === 'pickup' ? 'pickup' : 'province');
  const zone = ZONES[zk];
  const zq = quote({ ...d, qty: it.qty, zone: zk, speed: order.speed, payment: 'cash' });
  const options = Object.entries(ZONES).map(([k, z]) => {
    const oq = quote({ ...d, qty: it.qty, zone: k, speed: order.speed, payment: 'cash' });
    return `<li><span><b>${esc(k === 'pickup' ? 'Self pick-up at the studio' : z.label)}</b><small>${esc(z.hint)}</small></span>
      <span>${esc(fmtDate(oq.arrival))}</span><span>${z.fee ? peso(oq.shipping) : 'Free'}</span></li>`;
  }).join('');

  // pictures: the owner's photos, then the trophy drawn with the options picked (drawn before anything else)
  const dk = JSON.stringify(d);
  if (shopItem && it.stillKey !== dk) {
    it.stillKey = dk;
    if (stillDone.has(dk)) it.still = stillDone.get(dk);
    else stillFor(d, true).then(url => {
      if (incoming !== it || it.stillKey !== dk) return;
      if (url) it.still = url; else it.stillFailed = true;
      renderProduct();
    });
  }
  const photos = (it.summary?.photos || []).filter(picOk);
  const gallery = shopItem ? [...photos, ...(it.still ? [it.still] : [])] : [it.summary?.preview].filter(picOk);
  /* A shop trophy is shown as Shopee shows a product, a big picture over a row of small ones: the
     trophy in 3D to turn, the owner's photos, the trophy from four sides, and a video of it turning
     (owner, 9 Nov: "make the products 3d and below are photos of different angles or yet video"). */
  const in3d = shopItem && WEBGL && !it.stillFailed;
  const media = in3d ? [
    { key: '3d', thumb: it.still, label: 'In 3D' },
    ...photos.map((u, i) => ({ key: `p${i}`, thumb: u, src: u, label: `Photo ${i + 1}` })),
    ...ANGLES.map(a => ({ key: a.key, thumb: stillDone.get(`${dk}|${a.key}`), src: stillDone.get(`${dk}|${a.key}`), label: a.label })),
    { key: 'video', thumb: it.still, label: 'Video' },
  ] : [];
  const pick = in3d ? media.find(m => m.key === it.pick) || media[0] : null;
  const main = in3d ? null : (gallery.includes(it.pick) && it.pick) || (it.changed && it.still) || gallery[0]
    || (!shopItem || it.stillFailed || !WEBGL ? productPhoto(d.shape) : null);
  const title = it.summary?.title || sh.label || 'The trophy';
  const film = filmDone.get(dk);
  const big = !in3d
    ? `<div class="pd__pic${main ? '' : ' is-wait'}">${main ? `<img id="pdMain" src="${esc(main)}" alt="${esc(title)}">` : '<span>Drawing your trophy…</span>'}</div>
        ${gallery.length > 1 ? `<div class="pd__thumbs">${gallery.map((u, i) =>
          `<button type="button" data-ph="${i}" aria-label="Picture ${i + 1}"${u === main ? ' aria-current="true"' : ''}><img src="${esc(u)}" alt=""></button>`).join('')}</div>` : ''}`
    : `<div class="pd__pic${pick.key === '3d' ? ' pd__pic--live' : ''}${pick.key !== '3d' && !(pick.key === 'video' ? film : pick.src) ? ' is-wait' : ''}">${
        pick.key === '3d' ? '<span class="pd__hint">Drag to turn</span>'
        : pick.key === 'video' ? (film ? `<video class="pd__video" src="${esc(film)}" autoplay loop muted playsinline controls aria-label="${esc(title)} turning"></video>`
          : `<span>${filmFailed.has(dk) ? 'This browser cannot make the video. Try the 3D.' : 'Filming it as it turns…'}</span>`)
        : pick.src ? `<img id="pdMain" src="${esc(pick.src)}" alt="${esc(`${title}: ${pick.label}`)}">` : '<span>Drawing it…</span>'}</div>
        <div class="pd__thumbs">${media.map(m => `<button type="button" data-media="${m.key}" aria-label="${esc(m.label)}"${m === pick ? ' aria-current="true"' : ''}>${
          m.thumb ? `<img src="${esc(m.thumb)}" alt="">` : '<i class="pd__twait"></i>'}${
          m.key === '3d' ? '<b class="pd__badge">3D</b>' : m.key === 'video' ? '<b class="pd__play" aria-hidden="true"></b>' : ''}</button>`).join('')}</div>`;

  // the choices a shop trophy offers, each priced by the same model
  const hex = n => '#' + Number(n).toString(16).padStart(6, '0');
  const swatch = m => (m.kind === 'glass' ? 'linear-gradient(135deg,#F4F8FA,#B9CFDB)'
    : m.kind === 'mirror' ? `linear-gradient(135deg,#FFFFFF,${hex(m.color)} 60%)` : hex(m.color));
  const chip = (field, key, label, sw) => `<button type="button" class="opt-chip${(d[field] ?? '') === key ? ' is-on' : ''}" data-field="${field}" data-key="${esc(key)}" aria-pressed="${(d[field] ?? '') === key}">${sw ? `<i style="background:${sw}"></i>` : ''}${esc(label)}</button>`;
  const choices = shopItem ? `
          <dt>Sheet colour</dt><dd class="pd__chips">${Object.entries(MATERIALS).map(([k, m]) => chip('material', k, m.short || m.label, swatch(m))).join('')}</dd>
          <dt>Size</dt><dd class="pd__chips">${Object.entries(SIZES).map(([k, z]) => chip('size', k, `${z.label} · ${z.total} cm`)).join('')}</dd>
          <dt>Base</dt><dd class="pd__chips">${Object.entries(BASES).map(([k, b]) => chip('baseKind', k, b.label)).join('')}</dd>${
          hasOutfit(d) ? `
          <dt>Outfit colour</dt><dd class="pd__chips">${chip('outfit', '', 'As drawn', 'conic-gradient(#c4262e 0 25%,#2456c4 0 50%,#1b1b1d 0 75%,#c9a23a 0)')}${
            OUTFITS.map(o => chip('outfit', o.hex, o.label, o.hex)).join('')}</dd>` : ''}` : '';

  // the shop, and more of its trophies
  const shopRatings = sum(Object.values(stats).map(x => x.ratings || 0));
  const catalogue = Object.keys(SHAPES).filter(k => k !== 'custom');
  const promoTag = sp => { const a = autos.find(p => covers(p, { design: { shape: sp } }) && !p.min_qty); return a ? `<em class="tag tag--solid">${esc(promoLine(a))}</em>` : ''; };
  const starsOf = sp => { const s = stats[sp]; return [s?.ratings ? `★ ${(+s.rating).toFixed(1)}` : '', s?.sold ? `${s.sold} sold` : ''].filter(Boolean).join(' · '); };
  const mini = (href, pic, title, price, sp, wait) => `<a class="mini" href="${esc(href)}">
      <span class="mini__pic${pic ? '' : ' is-wait'}">${pic ? `<img src="${esc(pic)}" alt="" loading="lazy">` : `<img data-sk="${esc(wait)}" alt="" hidden>`}${promoTag(sp)}</span>
      <span class="mini__t">${esc(title)}</span><span class="mini__p">${peso(price)}</span><span class="mini__s">${esc(starsOf(sp))}</span></a>`;
  // the shop's own trophies, pictured as on the home page: their photo, else the trophy drawn in 3D
  const sameItems = (SHOP_ITEMS || []).filter(r => r.id !== it.item).slice(0, 6);
  const picOf = r => (r.images || []).find(picOk) || stillDone.get(JSON.stringify(r.design)) || null;
  const same = sameItems.map(r => mini(`cart.html?item=${r.id}`, picOf(r), r.name,
    itemQuote({ design: r.design, shopDesign: r.design, fixed: r.price, qty: 1 }, 1).unit, r.design.shape, r.id));
  const fellow = k => (SHAPES[k].group || '') === (sh.group || '');
  // the designer's trophies the owner has photographed (a tile is too small for a card), this one's group first
  const photographed = catalogue.filter(k => k !== d.shape && picOk(PRODUCT_PHOTOS[k])).sort((a, b) => fellow(b) - fellow(a));
  const catCard = k => mini(`cart.html?shape=${k}`, PRODUCT_PHOTOS[k], SHAPES[k].label, catalogUnit(k), k);
  // a full row of six, with no empty place at the end: the shop's own trophies, then photographed ones
  // (once the shop's own are in, so the row does not change under the customer's eyes)
  const fill = SHOP_ITEMS ? photographed.slice(0, Math.max(0, 6 - same.length)) : [];
  same.push(...fill.map(catCard));
  const alsoLike = photographed.filter(k => !fill.includes(k)).slice(0, 12).map(catCard);
  const wording = [d.org, d.title, d.name, d.date].filter(Boolean).join(' / ');
  // a shop trophy sits under the group the owner gave it, as in "See all"; More is no group
  const grp = shopItem ? (g => (g === 'More' ? '' : g))(shopGroup(d)) : sh.group || 'Your art';

  box.innerHTML = `
    ${shopItem ? `<p class="pd__crumbs"><a href="./">Tala Artisan</a> › <a href="./#shop">Trophies</a> › ${grp ? `${esc(grp)} › ` : ''}<span>${esc(it.summary?.title || sh.label)}</span></p>` : ''}
    <div class="pd__top">
      <div class="pd__media">
        ${big}
        <div class="pd__share"><span>Share:</span>
          <a data-net="fb" target="_blank" rel="noopener">Facebook</a>
          <a data-net="x" target="_blank" rel="noopener">X</a>
          <a data-net="pin" target="_blank" rel="noopener">Pinterest</a>
          <button type="button" data-net="copy">Copy link</button></div>
      </div>
      <div class="pd__b">
        <h2 class="pd__t">${esc(it.summary?.title || sh.label)}</h2>
        <p class="pd__var">${esc(variation(d))}</p>
        <p class="pd__stats">${st?.ratings ? `<a class="pd__rate" href="#ratings"><b>${(+st.rating).toFixed(1)}</b> ${stars(+st.rating)}</a><a href="#ratings"><b>${st.ratings}</b> ${st.ratings === 1 ? 'Rating' : 'Ratings'}</a>` : '<span>No ratings yet</span>'}
          <span><b>${st?.sold || 0}</b> Sold</span></p>
        <div class="pd__price${off ? ' is-sale' : ''}"><b>${peso(each)}</b>${off ? ` <s>${peso(q.unit)}</s> <span class="pd__off">−${off}%</span>` : ''} <small>each</small>
          ${after != null ? `<span class="pd__after">${peso(after)} each after voucher</span>` : ''}</div>
        <dl class="pd__rows">
          ${vouchers.length ? `<dt>Shop vouchers</dt><dd class="pd__vouch">${vouchers.map(v => `<button type="button" class="vch${claimed.includes(v.code) ? ' is-claimed' : ''}" data-claim="${esc(v.code)}"
            title="${esc(promoLine(v))}${v.ends_at ? ' · valid till ' + esc(fmtDate(new Date(new Date(v.ends_at).getTime() - 1))) : ''}">${esc(v.kind === 'percent' ? `${+v.value}% OFF` : `${peso(v.value)} OFF`)}${claimed.includes(v.code) ? ' ✓' : ''}</button>`).join('')}
            <small class="pd__hint">${vouchers.some(v => !claimed.includes(v.code)) ? 'Tap one to claim it for your cart.' : 'Claimed. Use it at checkout.'}</small></dd>` : ''}
          ${bundles.length ? `<dt>Bundle deals</dt><dd>${bundles.map(p => `<span class="tag">${esc(promoLine(p))}</span>`).join(' ')}</dd>` : ''}
          ${deals.length ? `<dt>Promo</dt><dd>${deals.map(p => `<span class="tag">${esc(promoLine(p))}</span>`).join(' ')}</dd>` : ''}
          <dt>Shipping</dt><dd>Get it by <b>${esc(fmtDate(zq.arrival))}</b> · ${esc(zone.label)}${zone.fee ? ` · ${peso(zq.shipping)}` : ' · free'}
            <details class="pd__ship"><summary>All shipping options</summary><ul>${options}</ul>
            <p>${esc(SPEEDS[order.speed].label)}: made in ${SPEEDS[order.speed].days} working days after you approve the proof, then the courier. Change it at checkout.</p></details></dd>
          <dt>Our promise</dt><dd><details class="pd__ship"><summary>A proof before we make it · Free reprint if the mistake is ours</summary>
            <p><b>A proof before we make it.</b> We send you the finished design to check. Nothing is cut until you approve it.</p>
            <p><b>Free reprint if the mistake is ours.</b> A wrong spelling, colour or size from our side, we make it again at no cost.</p></details></dd>
          ${choices}
          <dt>Bulk price</dt><dd class="pd__tiers">${tiers}</dd>
          <dt>Quantity</dt><dd class="pd__qty">${perName(it) ? fixedQty(it) : `<span class="qty" data-q="in"><button type="button" data-d="-1" aria-label="One less">−</button><input type="number" min="1" max="2000" value="${it.qty}" aria-label="Quantity"><button type="button" data-d="1" aria-label="One more">+</button></span>`}
            <span class="pd__stock">Made to order</span></dd>
        </dl>
        <div class="pd__btns">
          <button class="btn btn--cart" type="button" id="addCart"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11h10.6L20 7H6.2M9 20h.01M17 20h.01M12 9v4M10 11h4"/></svg>Add to cart</button>
          <button class="btn btn--solid" type="button" id="buyNow">Place order</button>
        </div>
        ${shopItem ? '<a class="pd__edit" href="design.html">Or design your own in 3D</a>' : '<a class="pd__edit" href="design.html?edit">Change the design</a>'}
      </div>
    </div>

    <div class="pd__card pd__shopcard">
      <a class="pd__logo" href="${FB_PAGE}" target="_blank" rel="noopener" aria-label="Tala Artisan on Facebook"><img src="assets/img/shop-logo.webp" alt="" width="72" height="72"></a>
      <div class="pd__shopname"><b>Tala Artisan</b><small>Acrylic trophies · Gloria, Oriental Mindoro</small>
        <span class="pd__shopbtns"><a class="btn btn--cart btn--sm" href="${FB}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4c4.4 0 8 3.2 8 7.3s-3.6 7.2-8 7.2c-1 0-2-.2-2.9-.5L5 19.6l1.2-3.5C4.8 14.8 4 13.1 4 11.3 4 7.2 7.6 4 12 4Z"/></svg>Chat now</a>
          <a class="btn btn--line btn--sm" href="./#shop">View shop</a>
          <a class="btn btn--line btn--sm" href="${FB_PAGE}" target="_blank" rel="noopener">Facebook page</a></span></div>
      <dl class="pd__shopstats">
        <dt>Ratings</dt><dd>${shopRatings || 'None yet'}</dd>
        <dt>Products</dt><dd>${catalogue.length}</dd>
        <dt>Proof</dt><dd>Free, before we cut</dd>
        <dt>Made in</dt><dd>${SPEEDS.standard.days} working days</dd>
        <dt>Ships</dt><dd>Nationwide</dd>
        <dt>Payment</dt><dd>GCash, Maya, bank, cash</dd>
      </dl>
    </div>

    <div class="pd__card pd__sec">
      <h3>Product specifications</h3>
      <dl class="pd__spec">
        <dt>Category</dt><dd><a href="./#shop">Tala Artisan</a> › Trophies${grp ? ` › ${esc(grp)}` : ''}</dd>
        <dt>Stock</dt><dd>Made to order</dd>
        <dt>Sheet</dt><dd>${esc(MATERIALS[d.material]?.label || '')}</dd>
        <dt>Size</dt><dd>${esc(SIZES[d.size] ? `${SIZES[d.size].label}, ${SIZES[d.size].total} cm tall with its base` : '')}</dd>
        <dt>Base</dt><dd>${esc(`${BASES[d.baseKind]?.label || ''}${BASE_FINISHES[d.baseFinish] ? ', ' + BASE_FINISHES[d.baseFinish].label : ''}`)}</dd>${
        hasOutfit(d) && outfitOk(d.outfit) ? `<dt>Outfit</dt><dd>${esc(outfitLabel(d.outfit))}</dd>` : ''}
        <dt>Wording</dt><dd>${shopItem ? 'Yours. The picture shows a sample; we agree your wording in the proof.' : esc(wording || 'To agree in the proof')}</dd>
        <dt>Ships from</dt><dd>Gloria, Oriental Mindoro</dd>
      </dl>
      <h3>Product description</h3>
      <div class="pd__desc"><p>${esc(sh.note || '')}</p>
        <p>${shopItem ? 'Cut from acrylic sheet, with the wording printed in full colour. Pick the sheet colour, size and base above, and tell us your wording in the message at checkout; you see it all in the proof before we make anything.'
          : 'Made from the design you built: the cut, the colours and the wording as you set them. You see it again in the proof before we make anything.'}
          Made in Gloria, Oriental Mindoro, and shipped anywhere in the Philippines.</p></div>
    </div>

    <div class="pd__card pd__sec" id="ratings">
      <h3>Product ratings</h3>
      <div class="rt__head"><p class="rt__score"><span><b>${st?.ratings ? (+st.rating).toFixed(1) : '0'}</b> out of 5</span>${stars(st?.ratings ? +st.rating : 0)}</p>
        <div class="rt__filters" id="rtFilters"><button type="button" class="is-on" data-rf="all">All</button>${[5, 4, 3, 2, 1].map(n =>
          `<button type="button" data-rf="${n}">${n} Star (<span data-rc="${n}">0</span>)</button>`).join('')}<button type="button" data-rf="text">With comments (<span data-rc="text">0</span>)</button></div></div>
      <div class="rt__list" id="rtList"><p class="rt__none">No ratings yet</p></div>
    </div>

    ${same.length ? `<div class="pd__card pd__sec"><div class="pd__rowhead"><h3>From the same shop</h3><a href="./#shop">See all ›</a></div><div class="mini-row">${same.join('')}</div></div>` : ''}
    ${alsoLike.length ? `<div class="pd__card pd__sec"><h3>You may also like</h3><div class="mini-grid">${alsoLike.join('')}</div></div>` : ''}`;

  if ($('[data-q="in"]', box)) wireQty($('[data-q="in"]', box), n => { incoming.qty = n; renderProduct(); });
  $$('[data-ph]', box).forEach(b => b.addEventListener('click', () => { it.pick = gallery[+b.dataset.ph]; renderProduct(); }));
  $$('[data-media]', box).forEach(b => b.addEventListener('click', () => { it.pick = b.dataset.media; renderProduct(); }));
  if (in3d) {
    if (pick.key === '3d') mount3D($('.pd__pic', box), d, dk);
    // the four sides, each into its own small picture as it is drawn (and the big one, if it is the one shown)
    for (const a of ANGLES) {
      if (stillDone.has(`${dk}|${a.key}`)) continue;
      stillFor(d, false, a).then(url => {
        if (incoming !== it || it.stillKey !== dk || !url) return;
        if (pick.key === a.key) { renderProduct(); return; }
        const b = $(`[data-media="${a.key}"]`, box);
        if (b) b.innerHTML = `<img src="${esc(url)}" alt="">`;
      });
    }
    if (pick.key === 'video' && !film && !filmFailed.has(dk)) {
      filmTurn(d).then(url => {
        if (!url) filmFailed.add(dk);
        if (incoming === it && it.stillKey === dk && it.pick === 'video') renderProduct();
      });
    }
  }
  $$('[data-field]', box).forEach(b => b.addEventListener('click', () => {
    if (d[b.dataset.field] === b.dataset.key) return;
    incoming.design = { ...incoming.design, [b.dataset.field]: b.dataset.key };
    it.changed = true; it.pick = null;
    renderProduct();
  }));
  $$('[data-claim]', box).forEach(b => b.addEventListener('click', () => {
    if (!claimed.includes(b.dataset.claim)) { claimed.push(b.dataset.claim); store.set('tala.claimed', claimed); toast('Voucher claimed. It is waiting at checkout.'); }
    renderProduct();
  }));
  wireShareRow(box, it);
  // the shop's trophies not drawn yet, after this one's own picture
  for (const r of sameItems) if (!picOf(r)) stillFor(r.design).then(url => {
    const img = $(`img[data-sk="${r.id}"]`, box), src = url || productPhoto(r.design.shape);
    if (!img || !src) return;
    img.src = src; img.hidden = false; img.parentElement.classList.remove('is-wait');
  });
  // a shop trophy waits a moment for its picture, so the cart shows the options picked
  const pictured = () => (shopItem && !stillDone.has(dk) && !it.stillFailed ? Promise.race([stillFor(d, true), new Promise(r => setTimeout(r, 3000))]) : null);
  $('#addCart').addEventListener('click', async e => {
    e.currentTarget.disabled = true;
    await pictured();
    addIncoming(true);
    toast('Added to your cart.');
    if (shopItem) renderProduct(); else show('cart');
  });
  $('#buyNow').addEventListener('click', async e => {
    e.currentTarget.disabled = true;
    await pictured();
    cart.forEach(i => { i.on = false; });
    addIncoming(true);
    location.hash = '#checkout';
    show('checkout');
  });
  if (LIVE && st?.ratings) showReviews(d.shape);
}

/* A shop trophy with no photo is drawn in 3D, the way the home page draws its
   cards, and kept as a JPEG on the cards' light ground: the product's picture
   (with the options picked), its picture in the cart, and the pictures of the
   shop's other trophies under it. One renderer, one trophy at a time, the
   product's own picture first. Kept for the visit (sessionStorage), so a
   trophy opened from "From the same shop" shows its picture at once. */
const WEBGL = webglAvailable();
const STILLS = 'tala.stills.2';                       // .2: figures drawn facing forward (9 Nov)
/* A figure, or a picture, is printed on its front: it is shown facing forward (owner, 9 Nov:
   "facing forward", "like this position"). A panel keeps the three-quarter view of its layers. */
const faceOn = d => !!SHAPES[d?.shape]?.decal?.onBase;
const stillDone = new Map((() => {
  try { const a = JSON.parse(sessionStorage.getItem(STILLS)); return Array.isArray(a) ? a : []; } catch { return []; }
})().filter(e => Array.isArray(e) && typeof e[0] === 'string' && picOk(e[1]) && e[1].startsWith('data:')));
const stillJobs = new Map();                          // design -> its picture, being drawn
const stillLine = [];                                 // the designs waiting to be drawn
let stillViewer = null, stillCanvas = null, stillHome = null, drawing = false;
/* The four sides a product is pictured from, under its 3D: the camera's turn from the front. */
const ANGLES = [
  { key: 'front', label: 'From the front', az: 0 },
  { key: 'left', label: 'From the left', az: -0.8 },
  { key: 'right', label: 'From the right', az: 0.8 },
  { key: 'side', label: 'From the side', az: -1.45 },
];

/* The product's live 3D: one viewer for the visit, its canvas moved into each new render of the
   page (the page is drawn again on every choice), the trophy built again only when it changes. */
let pd3d = null;
function mount3D(pic, design, key) {
  if (!pic) return;
  if (!pd3d) {
    const canvas = Object.assign(document.createElement('canvas'), { className: 'pd__canvas', tabIndex: 0 });
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'The trophy in 3D. Drag to turn it, scroll to zoom; the arrow keys turn it too.');
    pd3d = { canvas, viewer: null, model: null, key: null, base: null };
  }
  pic.prepend(pd3d.canvas);
  if (!pd3d.viewer) {
    pd3d.viewer = createViewer(pd3d.canvas, { autoRotate: true, maxDpr: 2 });
    pd3d.base = pd3d.viewer.getHome();
  }
  pd3d.viewer.resize();
  if (pd3d.key !== key) {
    if (pd3d.model) { pd3d.viewer.scene.remove(pd3d.model); disposeGroup(pd3d.model); }
    pd3d.model = buildTrophy(design);
    pd3d.viewer.scene.add(pd3d.model);
    pd3d.viewer.setView({ az: faceOn(design) ? 0 : pd3d.base.az, pol: pd3d.base.pol });   // its sway turns round this
    pd3d.viewer.frameObject(pd3d.model);
    pd3d.key = key;
  }
  pd3d.viewer.invalidate();
}

/* The video: the trophy turned once round on the cards' light ground, filmed off the page as the
   browser draws it (MediaRecorder), when the customer first asks for it. A browser that cannot
   film says so and keeps the 3D. */
const filmDone = new Map(), filmFailed = new Set();
const filmJobs = new Map();
function filmTurn(design) {
  const k = JSON.stringify(design);
  if (filmDone.has(k)) return Promise.resolve(filmDone.get(k));
  if (!filmJobs.has(k)) filmJobs.set(k, shootTurn(design).catch(() => null).then(url => {
    filmJobs.delete(k);
    if (url) filmDone.set(k, url);
    return url;
  }));
  return filmJobs.get(k);
}
async function shootTurn(design) {
  if (!WEBGL || typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
  const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
    .find(t => MediaRecorder.isTypeSupported(t));
  if (!type) return null;
  const W = 480, H = 600, SECONDS = 6;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const viewer = createViewer(canvas, { capture: true, fixed: { w: W, h: H }, loop: false, interactive: false, maxDpr: 1 });
  viewer.renderer.setClearColor(0xF3F1EB, 1);           // --surface: a video has no see-through ground
  await Promise.race([artReady(design), new Promise(r => setTimeout(r, 4000))]);
  const model = buildTrophy(design);
  viewer.scene.add(model);
  viewer.frameObject(model);
  const home = viewer.getHome();
  viewer.renderNow();
  const parts = [];
  const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: type, videoBitsPerSecond: 3000000 });
  rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  rec.start(250);
  const t0 = performance.now();
  await new Promise(done => {
    const step = now => {
      const f = Math.min(1, (now - t0) / (SECONDS * 1000));
      viewer.setView({ az: home.az + f * Math.PI * 2 });
      viewer.renderNow();
      if (f < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
  rec.stop();
  await stopped;
  viewer.scene.remove(model);
  disposeGroup(model);
  viewer.dispose();
  return parts.length ? URL.createObjectURL(new Blob(parts, { type: type.split(';')[0] })) : null;
}
function stillFor(design, first = false, angle = null) {
  const k = JSON.stringify(design) + (angle ? `|${angle.key}` : '');
  if (stillDone.has(k)) return Promise.resolve(stillDone.get(k));
  if (!stillJobs.has(k)) stillJobs.set(k, new Promise(resolve => {
    stillLine[first ? 'unshift' : 'push']({ design, k, resolve, angle });
    if (!drawing) drawStills();
  }));
  return stillJobs.get(k);
}
async function drawStills() {
  drawing = true;
  while (stillLine.length) {
    const { design, k, resolve, angle } = stillLine.shift();
    let url = null;
    try { url = await drawStill(design, angle); } catch { /* left undrawn */ }
    stillJobs.delete(k);
    if (url) keepStill(k, url);
    resolve(url);
  }
  drawing = false;
}
function keepStill(k, url) {
  stillDone.set(k, url);
  while (stillDone.size > 48) stillDone.delete(stillDone.keys().next().value);   // five pictures a trophy
  try { sessionStorage.setItem(STILLS, JSON.stringify([...stillDone])); } catch { /* full: kept for this page only */ }
}
async function drawStill(design, angle = null) {
  if (!WEBGL) return null;
  const W = 480, H = 600;
  if (!stillViewer) {
    stillCanvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    stillViewer = createViewer(stillCanvas, { capture: true, fixed: { w: W, h: H }, loop: false, interactive: false, maxDpr: 1 });
    stillHome = stillViewer.getHome();
  }
  await Promise.race([artReady(design), new Promise(r => setTimeout(r, 4000))]);
  const model = buildTrophy(design);
  try {
    stillViewer.scene.add(model);
    // framing keeps the view it finds: a side's own, else forward for a figure, else the three-quarter view
    stillViewer.setView({ az: angle ? angle.az : faceOn(design) ? 0 : stillHome.az, pol: angle?.pol ?? stillHome.pol });
    stillViewer.frameObject(model);
    stillViewer.renderNow();
    const out = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const g = out.getContext('2d');
    g.fillStyle = '#F3F1EB';                       // --surface, as behind the home page's cards
    g.fillRect(0, 0, W, H);
    g.drawImage(stillCanvas, 0, 0);
    return out.toDataURL('image/jpeg', 0.86);
  } finally {
    stillViewer.scene.remove(model);
    disposeGroup(model);
  }
}

// a trophy's picture for the cards: the owner's product photo of it, else its tile
let PRODUCT_PHOTOS = {};
const productPhoto = k => (picOk(PRODUCT_PHOTOS[k]) && PRODUCT_PHOTOS[k]) || (DESIGNS[k]?.tile ? `assets/${DESIGNS[k].tile}` : null);
// the shop's own trophies (shop_items), for "From the same shop"; null until they are in
let SHOP_ITEMS = null;
let shopItemsJob = null;
const loadShopItems = () => (shopItemsJob ||= !LIVE ? Promise.resolve([])
  : fetch(`${BASE}/rest/v1/shop_items?published=is.true&select=id,name,line,price,design,images&order=sort.asc,name.asc`, { headers: AUTH })
    .then(r => (r.ok ? r.json() : [])).catch(() => [])
    .then(rows => (Array.isArray(rows) ? rows : []).filter(r => r && typeof r.id === 'string' && /^[a-z0-9][a-z0-9-]{1,79}$/.test(r.id)
      && typeof r.name === 'string' && shopDesignOk(r.design))   // "Your art" only as the owner made it from a picture
      .map(r => ({ ...r, price: r.price != null && +r.price > 0 ? +r.price : null }))));
/* A designer trophy as the shop would list it -- the same as the Admin Deck's
   "Not in the shop yet": its own sheet and ink, Medium on a black gold bar,
   sample wording for the picture (the customer's own is agreed in the proof). */
const catalogDesign = k => {
  const sh = SHAPES[k];
  return { shape: k, variant: 0, material: MATERIALS[sh.sheet] ? sh.sheet : 'white', size: 'm', baseKind: 'goldbar', baseFinish: 'black',
    decal: 'rect', scheme: sh.ink || 'black', laminate: 'gloss', font: 'classic',
    org: 'Gloria Awards Night', title: 'Champion', name: 'Juan Dela Cruz', date: '2026' };
};
const catalogUnit = k => quote({ ...catalogDesign(k), qty: 1, zone: 'pickup', speed: 'standard', payment: 'cash' }).unit;

/* Share this trophy: Facebook, X, Pinterest, or the link. A link from a
   customer carries their share code, so it counts toward their voucher. */
function wireShareRow(box, it) {
  const code = store.get('tala.share', null);
  const page = new URL(location.href);
  page.hash = '';
  for (const k of ['rate']) page.searchParams.delete(k);
  if (typeof code === 'string' && /^[A-Z0-9]{8}$/.test(code)) page.searchParams.set('ref', code);
  const url = encodeURIComponent(page.href), text = encodeURIComponent(`${it.summary?.title || 'A trophy'} from Tala Artisan`);
  const img = it.summary?.preview && !it.summary.preview.startsWith('data:') ? encodeURIComponent(new URL(it.summary.preview, location.href).href) : '';
  const links = {
    fb: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    x: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
    pin: `https://pinterest.com/pin/create/button/?url=${url}&description=${text}${img ? `&media=${img}` : ''}`,
  };
  $$('[data-net]', box).forEach(a => {
    if (links[a.dataset.net]) a.href = links[a.dataset.net];
    else a.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(page.href); toast('Link copied.'); } catch { toast('Could not copy the link.', true); }
    });
  });
}

const stars = r => `<span class="stars" aria-label="${r.toFixed(1)} out of 5">${[1, 2, 3, 4, 5].map(i =>
  `<i class="${r >= i - 0.25 ? 'on' : r >= i - 0.75 ? 'half' : ''}"></i>`).join('')}</span>`;

// the real reviews of a trophy, first names only, fetched once
const reviewsOf = {};
async function showReviews(shape) {
  const list = await (reviewsOf[shape] ||= rpc('trophy_reviews', { p_shape: shape })
    .then(a => (Array.isArray(a) ? a.filter(r => r && r.rating >= 1 && r.rating <= 5 && !hasBadWord(r.comment, r.name)) : [])).catch(() => []));
  const box = $('#rtList'), filters = $('#rtFilters');
  if (!box || !filters || !list.length || incoming?.design.shape !== shape) return;
  for (const n of [1, 2, 3, 4, 5]) $(`[data-rc="${n}"]`, filters).textContent = list.filter(r => r.rating === n).length;
  $('[data-rc="text"]', filters).textContent = list.filter(r => r.comment).length;
  const draw = f => {
    const shown = list.filter(r => f === 'all' || (f === 'text' ? r.comment : r.rating === +f));
    box.innerHTML = shown.length ? `<ul>${shown.map(r => `<li>${stars(r.rating)} <b>${esc(r.name || 'Customer')}</b>
      <small>${esc(fmtDate(new Date(r.created_at)))}</small>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}</li>`).join('')}</ul>`
      : '<p class="rt__none">No ratings here yet</p>';
  };
  $$('[data-rf]', filters).forEach(b => b.addEventListener('click', () => {
    $$('[data-rf]', filters).forEach(x => x.classList.toggle('is-on', x === b));
    draw(b.dataset.rf);
  }));
  draw('all');
}

function addIncoming(on) {
  const { source, still, stillKey, stillFailed, pick, changed, ...it } = incoming;
  const preview = (source === 'shop' && still) || it.summary?.preview || null;
  const line = { ...it, summary: { title: it.summary?.title, preview }, on };
  const same = source === 'shop' && cart.find(c => !c.text && !c.files && c.item === line.item && c.fixed === line.fixed
    && JSON.stringify(c.design) === JSON.stringify(line.design));
  if (same) Object.assign(same, { qty: clampQty(same.qty + line.qty), on, summary: line.summary });
  else cart.unshift({ ...line, id: uuid() });
  if (source === 'designer') {
    incoming = null;
    try { sessionStorage.removeItem('tala.spec'); } catch { /* private mode */ }
  }
  if (!keepCart()) toast('Added without its pictures: this browser is out of room.', true);
  countBadge();
}

/* A design with a different title and name on each trophy (design.names): one
   trophy per name, so its quantity is the list's, not a stepper's. */
const perName = it => Array.isArray(it?.design?.names) && it.design.names.length > 0;
const fixedQty = (it, label) => `<span class="qty-fixed"${label ? ` data-l="${label}"` : ''}><b>${it.qty}</b> one per name</span>`;

function wireQty(box, done) {
  const input = $('input', box);
  $$('button', box).forEach(b => b.addEventListener('click', () => done(clampQty(+input.value + +b.dataset.d))));
  input.addEventListener('change', () => done(clampQty(input.value)));
}

/* The cart, as Shopee lays it out: tick, product, unit price, quantity,
   total, delete; select all and check out at the foot. */
function renderCart() {
  const box = $('#cart');
  if (!cart.length) {
    box.innerHTML = incoming ? '' : `<div class="ct__empty"><p>Your cart is empty.</p><a class="btn btn--solid" href="design.html">Design a trophy</a></div>`;
    return;
  }
  const on = cart.filter(i => i.on);
  const p = priceOrder(on);
  box.innerHTML = `
    <div class="ct__head"><label class="ck"><input type="checkbox" data-all ${on.length === cart.length ? 'checked' : ''}><span>Product</span></label>
      <span>Unit price</span><span>Quantity</span><span>Total price</span><span>Actions</span></div>
    ${autos.length ? `<p class="ct__deal">${autos.map(a => `<span class="tag">${esc(promoLine(a))}</span>`).join(' ')}</p>` : ''}
    <ul class="ct__list">${cart.map((it, i) => {
      const q = itemQuote(it);
      return `<li class="ct__row" data-i="${i}">
        <label class="ck ct__prod"><input type="checkbox" ${it.on ? 'checked' : ''} aria-label="Order this one">
          ${picOk(it.summary?.preview) ? `<img src="${it.summary.preview}" alt="">` : '<span class="ct__nopic"></span>'}
          <span><b>${esc(it.summary?.title || SHAPES[it.design.shape].label)}</b><small>${esc(variation(it.design))}</small>
            ${autos.filter(a => covers(a, it)).map(a => `<em class="tag">${esc(promoLine(a))}</em>`).join(' ')}</span></label>
        <span class="ct__unit" data-l="Unit price">${peso(q.unit)}</span>
        ${perName(it) ? fixedQty(it, 'Quantity') : `<span class="qty" data-l="Quantity"><button type="button" data-d="-1" aria-label="One less">−</button><input type="number" min="1" max="2000" value="${it.qty}" aria-label="Quantity"><button type="button" data-d="1" aria-label="One more">+</button></span>`}
        <span class="ct__tot" data-l="Total price">${peso(q.make + q.setup)}</span>
        <button class="ct__del" type="button">Delete</button>
      </li>`;
    }).join('')}</ul>
    <div class="ct__foot">
      <label class="ck"><input type="checkbox" data-all ${on.length === cart.length ? 'checked' : ''}><span>Select all (${cart.length})</span></label>
      <button class="ct__del" type="button" data-delsel>Delete</button>
      <span class="ct__sum">Total (${on.length} ${on.length === 1 ? 'item' : 'items'}): <b>${peso(p.merch - p.discount)}</b>${p.discount ? `<small>Saved ${peso(p.discount)}</small>` : ''}</span>
      <button class="btn btn--solid" type="button" id="checkOut" ${on.length ? '' : 'disabled'}>Check out</button>
    </div>`;
  $$('.ct__row', box).forEach(row => {
    const it = cart[+row.dataset.i];
    $('input[type=checkbox]', row).addEventListener('change', e => { it.on = e.target.checked; keepCart(); renderCart(); });
    if ($('.qty', row)) wireQty($('.qty', row), n => { it.qty = n; keepCart(); renderCart(); });
    $('.ct__del', row).addEventListener('click', () => { cart.splice(+row.dataset.i, 1); keepCart(); countBadge(); renderCart(); });
  });
  $$('[data-all]', box).forEach(c => c.addEventListener('change', e => { cart.forEach(i => { i.on = e.target.checked; }); keepCart(); renderCart(); }));
  $('[data-delsel]', box).addEventListener('click', () => { cart = cart.filter(i => !i.on); keepCart(); countBadge(); renderCart(); });
  $('#checkOut').addEventListener('click', () => { location.hash = '#checkout'; show('checkout'); });
}

/* Your orders, placed in this browser: each can be rated once the shop has
   marked it done (review_submit checks). A link the shop sends,
   cart.html?rate=<order>, opens the same form on any phone. */
function renderOrders(rateRef) {
  const box = $('#orders');
  if (!box) return;
  const list = rateRef && !orders.some(o => o.ref === rateRef)
    ? [{ ref: rateRef, code: 'TA-' + rateRef.slice(0, 8).toUpperCase(), titles: [], rated: false }, ...orders] : orders;
  box.hidden = !list.length;
  if (!list.length) return;
  box.innerHTML = `<h2>Your orders</h2><ul class="od__list">${list.map(o => `<li data-ref="${esc(o.ref)}">
      <span><b>${esc(o.code)}</b><small>${esc(o.titles.join(', '))}${o.at ? ` · ${esc(fmtDate(new Date(o.at)))}` : ''}</small></span>
      ${o.rated ? '<span class="od__done">Rated — thank you</span>' : '<button class="btn btn--line btn--sm" type="button" data-rate>Rate it</button>'}
      <form class="od__rate" hidden><div class="od__stars" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map(n =>
        `<button type="button" role="radio" aria-checked="false" data-star="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
        <input name="comment" maxlength="500" placeholder="A few words about your trophies (optional)">
        <button class="btn btn--solid btn--sm" type="submit">Send rating</button><p class="co__note" role="status"></p></form>
    </li>`).join('')}</ul>`;
  $$('li', box).forEach(li => {
    const f = $('.od__rate', li);
    let rating = 0;
    $('[data-rate]', li)?.addEventListener('click', () => { f.hidden = !f.hidden; });
    $$('[data-star]', f).forEach(b => b.addEventListener('click', () => {
      rating = +b.dataset.star;
      $$('[data-star]', f).forEach(x => x.setAttribute('aria-checked', String(+x.dataset.star <= rating)));
    }));
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const note = $('.co__note', f);
      if (!rating) { note.textContent = 'Tap the stars first.'; return; }
      if (hasBadWord(f.comment.value)) { note.textContent = 'Please leave out offensive words.'; return; }
      note.textContent = 'Sending…';
      try {
        const ok = await rpc('review_submit', { p_ref: li.dataset.ref, p_rating: rating, p_comment: f.comment.value.trim() || null });
        if (!ok) { note.textContent = 'You can rate an order once we have delivered it, and once only.'; return; }
        const o = orders.find(x => x.ref === li.dataset.ref);
        if (o) { o.rated = true; store.set('tala.orders', orders); }
        note.textContent = 'Thank you for rating your trophies.';
        f.querySelector('button[type=submit]').disabled = true;
      } catch { note.textContent = 'Could not send it just now. Try again in a moment.'; }
    });
    if (li.dataset.ref === rateRef) { f.hidden = false; li.scrollIntoView({ block: 'center' }); }
  });
}

/* Checkout: address, products, message, shipping, vouchers, payment, totals. */
function renderCheckout() {
  const box = $('#checkout');
  const on = cart.filter(i => i.on);
  if (!on.length) { location.hash = '#cart'; show('cart'); return; }
  if (!order.zone) order.zone = on[0].design.zone && ZONES[on[0].design.zone] ? on[0].design.zone : 'province';
  const p = priceOrder(on);
  const editing = order.editAddress || !addr;
  const a = addr || { delivery: order.zone === 'pickup' ? 'pickup' : 'ship' };
  const ways = [['gcash', 'GCash'], ['maya', 'Maya'], ['bank', 'Bank transfer'], ['cash', 'Cash on pickup or delivery']];
  box.innerHTML = `
    <a class="co__back" href="#cart">← Back to cart</a>
    <section class="co__card co__addr">
      <h2><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>Delivery address</h2>
      ${editing ? `<form class="co__form" id="addrForm" novalidate>
          <div class="row2"><div class="field"><label for="aName">Full name</label><input id="aName" name="name" autocomplete="name" value="${esc(a.name)}" required><span class="field__err" data-err="aName"></span></div>
            <div class="field"><label for="aPhone">Mobile number</label><input id="aPhone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0917 123 4567" value="${esc(a.phone)}" required><span class="field__err" data-err="aPhone"></span></div></div>
          <div class="row2"><div class="field"><label for="aEmail">Email (for your proof)</label><input id="aEmail" name="email" type="email" inputmode="email" autocomplete="email" value="${esc(a.email)}" required><span class="field__err" data-err="aEmail"></span></div>
            <div class="field"><label for="aWay">How you get it</label><select id="aWay" name="delivery">
              <option value="ship"${a.delivery !== 'pickup' ? ' selected' : ''}>Deliver to my address</option>
              <option value="pickup"${a.delivery === 'pickup' ? ' selected' : ''}>Pick up at the studio in Gloria</option></select></div></div>
          <div class="field" id="aAddrField"${a.delivery === 'pickup' ? ' hidden' : ''}><label for="aAddr">Address</label>
            <textarea id="aAddr" name="address" rows="2" autocomplete="street-address" placeholder="House no., street, barangay, town or city, province">${esc(a.address)}</textarea><span class="field__err" data-err="aAddr"></span></div>
          <button class="btn btn--solid btn--sm" type="submit">Use this address</button>
        </form>`
      : `<p class="co__who"><b>${esc(addr.name)}</b> <span>${esc(addr.phone)}</span> <span>${esc(addr.email)}</span></p>
         <p class="co__where">${addr.delivery === 'pickup' ? 'Pick up at the studio in Gloria, Oriental Mindoro' : esc(addr.address)}</p>
         <button class="co__change" type="button" id="changeAddr">Change</button>`}
    </section>

    <section class="co__card">
      <div class="co__prodhead"><h2>Products ordered</h2><span>Unit price</span><span>Quantity</span><span>Item subtotal</span></div>
      <ul class="co__list">${p.lines.map(l => `<li>
          <span class="co__prod">${picOk(l.it.summary?.preview) ? `<img src="${l.it.summary.preview}" alt="">` : ''}
            <span><b>${esc(l.it.summary?.title || SHAPES[l.it.design.shape].label)}</b><small>${esc(variation(l.it.design))}</small></span></span>
          <span data-l="Unit price">${peso(l.unit)}</span><span data-l="Quantity">${l.it.qty}</span><span data-l="Subtotal">${peso(l.make + l.setup)}${l.setup ? `<small>incl. ${peso(l.setup)} artwork setup</small>` : ''}</span>
        </li>`).join('')}</ul>
      <div class="co__opts">
        <label class="co__msg">Message for the shop<input id="coMsg" maxlength="500" placeholder="Wording changes, deadline, anything else…" value="${esc(order.message)}"></label>
        <div class="co__ship">
          <label>Shipping option<select id="coZone">${Object.entries(ZONES).map(([k, z]) =>
            `<option value="${k}"${k === order.zone ? ' selected' : ''}>${esc(z.label)} — ${z.fee ? peso(Math.round(z.fee + z.per * p.pieces)) : 'free'}</option>`).join('')}</select></label>
          <label>Turnaround<select id="coSpeed">${Object.entries(SPEEDS).map(([k, s]) =>
            `<option value="${k}"${k === order.speed ? ' selected' : ''}>${esc(s.label)} — ${esc(s.hint)}${s.mult > 1 ? ` (+${Math.round((s.mult - 1) * 100)}%)` : s.mult < 1 ? ` (−${Math.round((1 - s.mult) * 100)}%)` : ''}</option>`).join('')}</select></label>
          <p class="co__eta">Get it by <b>${p.arrival ? esc(fmtDate(p.arrival)) : '—'}</b> · ${p.days} working days from approval, proof included</p>
        </div>
      </div>
    </section>

    <section class="co__card co__vouch">
      <h2>Vouchers</h2>
      ${claimedHere().length ? `<div class="co__claimed">${claimedHere().map(v => `<button type="button" class="vch${order.voucher?.code === v.code ? ' is-on' : ''}" data-use="${esc(v.code)}">
        <b>${esc(v.kind === 'percent' ? `${+v.value}% OFF` : `${peso(v.value)} OFF`)}</b><small>${esc(promoLine(v))}${v.ends_at ? ` · till ${esc(fmtDate(new Date(new Date(v.ends_at).getTime() - 1)))}` : ''}</small></button>`).join('')}</div>` : ''}
      <form class="co__code" id="codeForm"><input id="coCode" placeholder="Promo code" autocomplete="off" maxlength="20" value="${esc(order.voucher?.code || '')}" aria-label="Promo code">
        <button class="btn btn--line btn--sm" type="submit">Apply</button></form>
      <p class="co__note" id="codeMsg" role="status">${order.voucher ? (order.voucher.kind === 'share' ? `Share voucher on: ${order.voucher.value}% off your trophies.` : `Code ${esc(order.voucher.code)} on.`) : ''}</p>
      ${settings && settings.share_percent > 0 ? `<div class="co__share" id="shareBox">
        <p><b>Share and get ${settings.share_percent}% off.</b> Send your link to ${settings.share_needed} friends. When ${settings.share_needed} of them open it, ${settings.share_percent}% comes off your trophies.</p>
        <div class="co__sharebtns"><button class="btn btn--line btn--sm" type="button" id="shareBtn">Share my link</button><span id="shareCount" class="co__note"></span></div>
      </div>` : ''}
      ${p.notes.length ? `<ul class="co__deals">${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    </section>

    <section class="co__card co__pay">
      <h2>Payment method</h2>
      <div class="co__ways" role="radiogroup" aria-label="Payment method">${ways.map(([k, l]) =>
        `<button type="button" role="radio" class="co__way" data-pay="${k}" aria-checked="${order.payment === k}">${esc(l)}</button>`).join('')}</div>
      <dl class="co__sum">
        <dt>Merchandise subtotal</dt><dd>${peso(p.merch)}</dd>
        <dt>Shipping subtotal</dt><dd>${p.shipping ? peso(p.shipping) : 'Free'}</dd>
        ${p.discount ? `<dt>Promo discount</dt><dd class="co__minus">−${peso(p.discount)}</dd>` : ''}
        <dt class="co__total">Total payment</dt><dd class="co__total">${peso(p.total)}</dd>
      </dl>
      <p class="co__note">${order.payment === 'cash' ? 'Pay in cash when you pick up, or on delivery within Oriental Mindoro.'
        : 'Pay the full amount once you place the order: we show you where to send it.'}
        Within 2 days we email you a proof to check before we make anything.</p>
      <p class="form__msg" id="placeMsg" role="status"></p>
      <button class="btn btn--solid co__place" type="button" id="placeOrder">Place order</button>
    </section>`;

  $('.co__back', box).addEventListener('click', e => { e.preventDefault(); location.hash = '#cart'; show('cart'); });
  $('#changeAddr')?.addEventListener('click', () => { order.editAddress = true; renderCheckout(); });
  const f = $('#addrForm');
  if (f) {
    f.aWay.addEventListener('change', () => { $('#aAddrField').hidden = f.aWay.value === 'pickup'; });
    f.addEventListener('submit', e => {
      e.preventDefault();
      const got = readAddress(f);
      if (!got) return;
      addr = got; store.set('tala.addr', addr); order.editAddress = false;
      if (addr.delivery === 'pickup') order.zone = 'pickup';
      else if (order.zone === 'pickup') order.zone = 'province';
      renderCheckout();
    });
  }
  $('#coMsg').addEventListener('input', e => { order.message = e.target.value; });
  $('#coZone').addEventListener('change', e => { order.zone = e.target.value; renderCheckout(); });
  $('#coSpeed').addEventListener('change', e => { order.speed = e.target.value; renderCheckout(); });
  $$('.co__way', box).forEach(b => b.addEventListener('click', () => { order.payment = b.dataset.pay; renderCheckout(); }));
  $('#codeForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('#coCode').value.trim().toUpperCase();
    const msg = $('#codeMsg');
    if (!code) { order.voucher = null; renderCheckout(); return; }
    if (!/^[A-Z0-9]{3,20}$/.test(code)) { msg.textContent = 'Promo codes are letters and numbers only.'; return; }
    msg.textContent = 'Checking…';
    try {
      const [hit] = LIVE ? await rpc('promo_lookup', { p_code: code }) : [];
      if (!hit) { msg.textContent = 'That code is not valid, or it has ended.'; return; }
      order.voucher = { ...hit, value: +hit.value, min_spend: hit.min_spend == null ? null : +hit.min_spend };
      renderCheckout();
    } catch { msg.textContent = 'Could not check the code just now. Try again in a moment.'; }
  });
  $$('[data-use]', box).forEach(b => b.addEventListener('click', () => {
    const v = listed.find(x => x.code === b.dataset.use);
    order.voucher = order.voucher?.code === b.dataset.use ? null : (v ? { ...v } : null);
    renderCheckout();
  }));
  if ($('#shareBox')) wireShare();
  $('#placeOrder').addEventListener('click', placeOrder);
  qrFor(order.payment);                  // the shop's GCash / Maya QR, ready for the order page
}

// the shop vouchers claimed here that are still running
const claimedHere = () => listed.filter(v => claimed.includes(v.code));

function readAddress(f) {
  const err = (el, t) => { el.closest('.field').classList.toggle('bad', !!t); const s = $(`[data-err="${el.id}"]`); if (s) s.textContent = t || ''; };
  const name = f.name.value.trim(), email = f.email.value.trim();
  const phone = f.phone.value.replace(/[^\d+()\s-]/g, '').replace(/\s+/g, ' ').trim();
  const delivery = f.delivery.value === 'pickup' ? 'pickup' : 'ship';
  const address = f.address.value.trim();
  const ok = {
    name: name.length > 1, email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email),
    phone: /^[0-9 +()-]{7,20}$/.test(phone) && phone.replace(/\D/g, '').length >= 7,
    address: delivery === 'pickup' || address.length >= 10,
  };
  err(f.name, ok.name ? '' : 'We need a name for the order.');
  err(f.email, ok.email ? '' : 'That email does not look right.');
  err(f.phone, ok.phone ? '' : 'A mobile number, like 0917 123 4567.');
  err(f.address, ok.address ? '' : 'House no., street, barangay, town or city, province.');
  const first = Object.entries(ok).find(([, v]) => !v);
  if (first) { f[first[0]].focus(); return null; }
  return { name: name.slice(0, 120), email: email.slice(0, 200), phone, delivery, address: delivery === 'ship' ? address.slice(0, 600) : null };
}

async function wireShare() {
  const count = $('#shareCount');
  const code = store.get('tala.share', null);
  const need = settings.share_needed;
  const showCount = n => {
    if (n >= need) {
      count.innerHTML = `<b>${n} friends opened it.</b> <button class="co__use" type="button" id="useShare">Use ${settings.share_percent}% off</button>`;
      $('#useShare').addEventListener('click', () => {
        order.voucher = { kind: 'share', value: settings.share_percent, code, shapes: null, min_spend: null };
        renderCheckout();
      });
    } else count.textContent = `${n} of ${need} friends opened your link.`;
  };
  if (code && LIVE) rpc('share_count', { p_code: code }).then(n => showCount(+n || 0)).catch(() => {});
  $('#shareBtn').addEventListener('click', async () => {
    const c = await shareCode();
    const url = shareUrl(c);
    try {
      if (navigator.share) await navigator.share({ title: 'Tala Artisan trophies', text: 'Custom acrylic trophies, made in Gloria, Oriental Mindoro.', url });
      else { await navigator.clipboard.writeText(url); toast('Your link is copied. Send it to your friends.'); }
    } catch { /* closed the share sheet */ }
    if (LIVE) rpc('share_count', { p_code: c }).then(n => showCount(+n || 0)).catch(() => {});
  });
}

/* ───────────────────────── place the order ───────────────────────── */

const r16 = (k, v) => `${k.padEnd(16)}${v}`;
/* The order sheet in each request's message: the designer's own part, with its
   ORDER part replaced by what was actually ordered here (the quantity, the
   shipping or the speed may have changed in the cart). */
function sheetFor(l, p) {
  const d = l.it.design;
  const head = String(l.it.text || '').split(/\r?\n(?=ORDER\s*$)/m)[0].trimEnd() || ['TROPHY DESIGN — built on the website', '',
    r16('Cut shape', `${l.it.summary?.title || SHAPES[d.shape]?.label || d.shape} (from the shop)`),
    r16('Sheet', MATERIALS[d.material]?.label || d.material),
    r16('Size', SIZES[d.size] ? `${SIZES[d.size].label} — ${SIZES[d.size].total} cm` : d.size),
    r16('Base', `${BASES[d.baseKind]?.label || d.baseKind}, ${BASE_FINISHES[d.baseFinish]?.label || d.baseFinish}`),
    ...(hasOutfit(d) && outfitOk(d.outfit) ? [r16('Outfit', outfitLabel(d.outfit))] : []),
    r16('Wording', 'SAMPLE on the shop picture only: get the customer’s own (message or proof)')].join('\n');
  const zone = ZONES[order.zone] || ZONES.pickup;
  return [head, '', 'ORDER',
    r16('Quantity', String(l.it.qty)),
    r16('Turnaround', `${SPEEDS[order.speed].label} — ${SPEEDS[order.speed].hint}`),
    r16('Delivery', zone.label),
    r16('Payment', PAYMENTS[order.payment]?.label || order.payment),
    '',
    r16('Unit', peso(l.unit)),
    r16('Trophies', peso(l.make)),
    l.setup ? r16('Artwork setup', peso(l.setup)) : null,
    l.off ? r16('Promo', '−' + peso(l.off)) : null,
    r16('Est. arrival', `${fmtDate(p.arrival)} (${p.days} working days)`),
    '',
    'Please confirm the price and send a proof.',
    order.message.trim() ? `\n${order.message.trim()}` : null,
  ].filter(x => x != null).join('\n').slice(0, 6000);
}

async function placeOrder() {
  const msg = $('#placeMsg');
  if (!addr || order.editAddress) {
    msg.textContent = 'Fill in your delivery address first.'; msg.className = 'form__msg err';
    $('#addrForm')?.querySelector('input')?.focus();
    return;
  }
  const items = cart.filter(i => i.on);
  if (!items.length) return;
  if (!LIVE) { msg.textContent = 'Online orders are not switched on yet. Please message the shop.'; msg.className = 'form__msg err'; return; }
  // a word that cannot go on a trophy (wordguard.js): the designer stops it, and so does the order
  const lines = d => [d?.org, d?.title, d?.name, d?.date, ...(Array.isArray(d?.names) ? d.names.flatMap(r => [r?.title, r?.name]) : [])];
  if (items.some(i => i.text && hasBadWord(...lines(i.design)))) {
    msg.textContent = 'A trophy\'s wording has a word we can\'t print. Change its design first.'; msg.className = 'form__msg err'; return;
  }
  const btn = $('#placeOrder');
  btn.disabled = true; msg.textContent = 'Placing your order…'; msg.className = 'form__msg';
  try {
    const p = priceOrder(items);
    const ref = uuid();
    const pricing = {
      merch: p.merch, shipping: p.shipping, discount: p.discount, total: p.total,
      deposit_percent: order.payment === 'cash' ? 0 : 100, deposit: order.payment === 'cash' ? 0 : p.total,   // paid in full
      zone: order.zone, speed: order.speed, payment: order.payment, pieces: p.pieces, items: items.length,
      promos: p.notes.slice(0, 6), voucher: order.voucher ? (order.voucher.kind === 'share' ? `share ${order.voucher.code}` : order.voucher.code) : null,
    };
    const rows = [];
    for (const l of p.lines) {
      const sent = l.it.files ? await sendFiles(l.it.files).catch(() => ({})) : {};
      rows.push({
        name: addr.name, email: addr.email, phone: addr.phone, delivery: addr.delivery, address: addr.address,
        ref, page: location.pathname.slice(0, 200), item: 'Trophy', qty: l.it.qty, message: sheetFor(l, p),
        design: { ...l.it.design, qty: l.it.qty, zone: order.zone, speed: order.speed, payment: order.payment, ...(Object.keys(sent).length ? { files: sent } : {}) },
        pricing,
      });
    }
    const res = await fetch(`${BASE}/rest/v1/quote_requests`, {
      method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
    cart = cart.filter(i => !i.on); keepCart(); countBadge();
    showPaid(ref, p, items, await qrWait(order.payment));
  } catch (err) {
    console.warn('[tala] order not saved:', err);
    msg.textContent = 'Sorry — your order did not go through. Please try again in a moment.'; msg.className = 'form__msg err';
  } finally { btn.disabled = false; }
}

/* The shop's GCash or Maya QR (Admin Deck → Payment details), at a fixed place
   in the photo bucket and asked for by the settings' updated_at, so a new QR
   is never hidden behind an old copy. Fetched while the customer checks out
   (renderCheckout), so it is on the order page the moment the order is
   placed; null when the shop has none. */
const qrs = {};
function qrFor(k) {
  if (!settings || !BASE || (k !== 'gcash' && k !== 'maya')) return Promise.resolve(null);
  return qrs[k] ||= new Promise(done => {
    const src = `${BASE}/storage/v1/object/public/trophy-photos/pay/${k}-qr.png?v=${encodeURIComponent(settings.updated_at || '')}`;
    const img = new Image();
    img.onload = () => done(src);
    img.onerror = () => done(null);
    img.src = src;
  });
}
const qrWait = k => Promise.race([qrFor(k), new Promise(r => setTimeout(r, 3000, null))]);

/* After "Place order": the order number, the full amount to pay now and where
   -- the shop's account (bank, GCash or Maya, with a Copy button for the
   number) and, for GCash or Maya, its QR with the receipt button beside it
   (owner, 5 Nov) -- and a place for the receipt (saved beside the order's
   pictures, where only the shop's staff can see it). */
function showPaid(ref, p, items, qr = null) {
  const code = 'TA-' + ref.slice(0, 8).toUpperCase();
  orders.unshift({ ref, code, at: Date.now(), titles: items.map(i => i.summary?.title || SHAPES[i.design.shape].label).slice(0, 4), rated: false });
  orders = orders.slice(0, 20);
  store.set('tala.orders', orders);
  const st = settings || {};
  const way = order.payment;
  const how = { gcash: 'GCash', maya: 'Maya', bank: 'bank transfer' }[way] || 'payment';
  // the shop's account for the way chosen, as the Admin Deck has it: [what, value, copy]
  const acct = {
    gcash: st.gcash_number && [['Name', st.gcash_name], ['GCash number', st.gcash_number, true]],
    maya: st.maya_number && [['Name', st.maya_name], ['Maya number', st.maya_number, true]],
    bank: st.bank_account_number && [['Bank', st.bank_name], ['Account name', st.bank_account_name], ['Account number', st.bank_account_number, true]],
  }[way];
  const rows = acct ? acct.filter(([, v]) => v).map(([k, v, copy]) => `<dt>${k}</dt><dd>${esc(v)}${copy
    ? ` <button class="pay__copy" type="button" data-copy="${esc(String(v).replace(/[^\d+]/g, ''))}" aria-label="Copy the ${k.toLowerCase()}">Copy</button>` : ''}</dd>`).join('')
    + `<dt>Amount</dt><dd><b>${peso(p.total)}</b></dd>` : '';
  const note = acct || qr
    ? `${st.pay_note ? esc(st.pay_note) + ' ' : ''}${qr ? `Scan the QR with your ${how} app. On this phone? Save the QR, then upload it in the app's QR scanner. ` : ''}Put <b>${code}</b> in the message of your payment. Pay only this account.`
    : `We message you our ${esc(how)} details today. Put <b>${code}</b> in the message of your payment.`;
  const cash = way === 'cash';
  const box = $('#paid');
  box.innerHTML = `
    <div class="paid__head"><span class="form__tick" aria-hidden="true"></span><div>
      <p class="paid__k">Order placed</p><h2 class="paid__code">${code}</h2>
      <p>Thanks ${esc(addr.name.split(/\s+/)[0])}. We have your order — keep this number.</p></div></div>
    <dl class="paid__sum">${p.lines.map(l => `<dt>${esc(l.it.summary?.title || SHAPES[l.it.design.shape].label)} × ${l.it.qty}</dt><dd>${peso(l.make + l.setup)}</dd>`).join('')}
      <dt>Shipping</dt><dd>${p.shipping ? peso(p.shipping) : 'Free'}</dd>
      ${p.discount ? `<dt>Promo discount</dt><dd>−${peso(p.discount)}</dd>` : ''}
      <dt class="paid__tot">Total payment</dt><dd class="paid__tot">${peso(p.total)}</dd></dl>
    <div class="paid__pay">
      ${cash ? `<p class="paid__t">Pay in cash: ${peso(p.total)}</p><p class="pay__note">When you pick up at the studio, or on delivery within Oriental Mindoro.</p>`
      : `<p class="paid__t">Pay ${peso(p.total)} now by ${esc(how)}</p>
        <div class="pay__box${qr ? ' has-qr' : ''}">
          ${qr ? `<figure class="pay__qr"><img src="${esc(qr)}" alt="Tala Artisan's ${esc(how)} QR code">
            <a class="pay__save" href="${esc(qr)}" target="_blank" rel="noopener">Save the QR</a></figure>` : ''}
          <div class="pay__info">${rows ? `<dl class="pay__acct">${rows}</dl>` : ''}<p class="pay__note">${note}</p></div>
          <div class="pay__act"><label class="btn btn--line paid__up">Upload your receipt<input type="file" accept="image/*" hidden></label>
            <p class="paid__msg" role="status"></p></div>
        </div>`}
    </div>
    <p class="paid__next">Next: within 2 days we email a proof to ${esc(addr.email)} to check before we make anything.
      Arriving about ${esc(fmtDate(p.arrival))}.</p>
    <p class="paid__links"><a href="${FB}" target="_blank" rel="noopener">Message us on Facebook</a> · <a href="design.html">Design another trophy</a></p>`;
  const file = $('input[type=file]', box), upMsg = $('.paid__msg', box);
  file?.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f || !/^image\//.test(f.type)) { upMsg.textContent = 'That needs to be a photo or screenshot of the receipt.'; return; }
    upMsg.textContent = 'Sending your receipt…';
    try {
      // load, not decode(): decode() never finished on a phone-sized screenshot in an embedded browser
      const img = await new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = URL.createObjectURL(f); });
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.85)), type = 'image/webp', ext = 'webp';
      if (!blob || blob.type !== 'image/webp') { blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85)); type = 'image/jpeg'; ext = 'jpg'; }
      for (const name of ['receipt', 'receipt-2', 'receipt-3', 'receipt-4', 'receipt-5']) {
        const res = await upload(`${ref}/${name}.${ext}`, blob, type);
        if (res.ok) { upMsg.textContent = 'Receipt received. We will confirm your payment.'; return; }
        if (!/duplicate|exists/i.test(await res.text().catch(() => ''))) break;
      }
      throw new Error('not sent');
    } catch { upMsg.textContent = 'The receipt did not go through. Send it to us on Messenger instead.'; }
  });
  // the account number, copied as digits for the bank or wallet app. Browsers
  // inside apps (Facebook's, where many customers come from) may refuse the
  // clipboard API: then the older way, a selected hidden text box.
  const copyText = async t => {
    try { await navigator.clipboard.writeText(t); return true; } catch { /* the older way */ }
    const ta = Object.assign(document.createElement('textarea'), { value: t, readOnly: true });
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  };
  $$('.pay__copy', box).forEach(b => b.addEventListener('click', async () => {
    if (!await copyText(b.dataset.copy)) { toast('Could not copy it. Please type it in.', true); return; }
    b.textContent = 'Copied';
    setTimeout(() => { b.textContent = 'Copy'; }, 1800);
  }));
  // the QR saved as a file, to upload in the wallet's scanner on this phone
  // (a link to another site cannot simply be downloaded); else it opens on its own
  $('.pay__save', box)?.addEventListener('click', async e => {
    e.preventDefault();
    try {
      const res = await fetch(qr);
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: `tala-artisan-${way}-qr.png` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { window.open(qr, '_blank', 'noopener'); }
  });
  show('paid');
}

/* ───────────────────────── small things ───────────────────────── */

function toast(t, bad = false) {
  const el = document.createElement('div');
  el.className = 'cart-toast' + (bad ? ' bad' : '');
  el.textContent = t;
  document.body.append(el);
  setTimeout(() => el.classList.add('is-out'), 2600);
  setTimeout(() => el.remove(), 3100);
}
const countBadge = () => window.dispatchEvent(new Event('tala:cart'));   // main.js keeps the nav's count

/* ───────────────────────── start ───────────────────────── */

/* A trophy opened from the shop: ?item=<a shop item> (its photos, its own
   price) or ?shape=<a designer trophy, as the shop would list it>. */
async function fromShop() {
  const qs = new URLSearchParams(location.search);
  const id = qs.get('item'), key = qs.get('shape');
  if (id && /^[a-z0-9][a-z0-9-]{1,79}$/.test(id)) {
    const row = (await loadShopItems()).find(r => r.id === id);
    if (row) {
      const photos = (row.images || []).filter(picOk);
      return { source: 'shop', item: row.id, design: { ...row.design }, shopDesign: { ...row.design }, text: '', files: null, qty: 1,
        fixed: row.price, summary: { title: row.name, preview: photos[0] || null, photos } };
    }
  }
  if (key && SHAPES[key] && key !== 'custom') {
    const photos = [PRODUCT_PHOTOS[key]].filter(picOk);
    return { source: 'shop', design: catalogDesign(key), text: '', files: null, qty: 1, fixed: null,
      summary: { title: SHAPES[key].label, preview: photos[0] || null, photos } };
  }
  return null;
}

(async function start() {
  // the owner's product photos served with the site (assets/img/products/products.json): designer trophy -> photo
  const products = await fetch(new URL('../img/products/products.json', import.meta.url)).then(r => (r.ok ? r.json() : [])).catch(() => []);
  PRODUCT_PHOTOS = Object.fromEntries((Array.isArray(products) ? products : []).filter(x => x && x.key && picOk(x.photo)).map(x => [x.key, x.photo]));
  const shopItem = await fromShop();
  if (shopItem) { incoming = shopItem; SHOP_ITEMS = await loadShopItems(); }
  else try {
    const spec = JSON.parse(sessionStorage.getItem('tala.spec') || 'null');
    if (spec && spec.design && SHAPES[spec.design.shape]) {
      incoming = { source: 'designer', design: spec.design, text: String(spec.text || ''), files: spec.files || null, qty: clampQty(Array.isArray(spec.design.names) && spec.design.names.length ? spec.design.names.length : spec.qty || spec.design.qty),
        summary: { title: spec.summary?.title, preview: picOk(spec.summary?.preview) ? spec.summary.preview : null } };
      order.zone = spec.design.zone && ZONES[spec.design.zone] ? spec.design.zone : null;
      order.speed = SPEEDS[spec.design.speed] ? spec.design.speed : 'standard';
      if (PAYMENTS[spec.design.payment]) order.payment = spec.design.payment;
    }
  } catch { /* nothing handed over */ }
  if (addr?.delivery === 'pickup') order.zone = 'pickup';
  show(incoming?.source === 'designer' ? 'cart' : viewOfHash());
  const rateRef = new URLSearchParams(location.search).get('rate');
  if (!$('#cart').hidden) renderOrders(/^[0-9a-f-]{36}$/.test(rateRef || '') ? rateRef : null);
  if (!LIVE) return;
  const num = x => ({ ...x, value: +x.value, min_spend: x.min_spend == null ? null : +x.min_spend, min_qty: x.min_qty == null ? null : +x.min_qty });
  const [st, au, li, ts, items] = await Promise.all([
    fetch(`${BASE}/rest/v1/shop_settings?id=eq.shop&select=*`, { headers: AUTH }).then(r => (r.ok ? r.json() : [])).catch(() => []),
    rpc('promo_auto').catch(() => []),
    rpc('promo_listed').catch(() => []),
    rpc('trophy_stats').catch(() => []),
    loadShopItems(),
  ]);
  settings = st[0] || null;
  autos = (Array.isArray(au) ? au : []).map(num);
  listed = (Array.isArray(li) ? li : []).map(num);
  claimed = claimed.filter(c => listed.some(v => v.code === c));          // ended ones drop out
  for (const t of Array.isArray(ts) ? ts : []) if (t.shape) stats[t.shape] = { rating: t.rating == null ? null : +t.rating, ratings: +t.ratings || 0, sold: +t.sold || 0 };
  SHOP_ITEMS = items;
  if (!$('#paid').hidden) return;
  if (!$('#checkout').hidden) renderCheckout();
  if (!$('#product').hidden) renderProduct();
  if (!$('#cart').hidden) renderCart();
})();
