/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — Admin Deck
   Staff sign in to read quote requests and to run the website's shop.
   Everything is live Supabase: nothing here is faked or kept only in
   this browser. Requests come from the quote form; shop trophies are
   what the home page's shop grid shows.
   ══════════════════════════════════════════════════════════════ */
import { createViewer, webglAvailable } from './viewer.js?v=202611082128';
import {
  buildTrophy, disposeGroup, price, peso,
  SHAPES, MATERIALS, SIZES, BASES, BASE_FINISHES, SCHEMES, DECALS, LAMINATES,
  SPEEDS, ZONES, PAYMENTS, variantsOf, standingHeight, printNote, artReady, shopArtOk, SHOP_GROUPS, shopGroup,
  figureArt, recolour, loadArtImage, outfitOk, outfitLabel,
} from './trophy.js?v=202611082128';
import { stickerArt, eachWording, pieceArt, pngAtDpi, STICKER_DPI } from './sticker.js?v=202611082128';
import { simplify } from './cutout.js?v=202611082128';
import { mountCutEditor } from './cut-editor.js?v=202611082128';

const C = window.TALA_CONFIG || {};
const URL_ = String(C.supabaseUrl || '').replace(/\/+$/, '');
const KEY = String(C.supabaseKey || '');
const BUCKET = 'trophy-photos';
const ART_BUCKET = 'request-art';                // the pictures customers send with a request (supabase/request-art.sql)
const ART_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(picture|photo)\.(webp|png|jpg)$/;
const MAX_PHOTOS = 8;
const DESIGN_KEY = 'tala.admin.design';      // the designer hands a design over through this

const STATUSES = ['new', 'quoted', 'proofing', 'won', 'lost'];
const STATUS_LABEL = { new: 'New', quoted: 'Quoted', proofing: 'Proofing', won: 'Won', lost: 'Lost' };
const CATEGORIES = ['Trophy', 'Medal', 'Plaque', 'Ribbon or sash', 'Certificate holder', 'Other'];

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');

const when = s => {
  const d = new Date(s);
  if (Number.isNaN(+d)) return '';
  const mins = (Date.now() - d) / 6e4;
  if (mins < 1) return 'just now';
  if (mins < 60) return `${Math.round(mins)} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};
const fullDate = s => new Date(s).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

// only our own storage, or files shipped with the site, may reach an <img src>
const safeImage = u => typeof u === 'string' &&
  (u.startsWith(`${URL_}/storage/v1/object/public/${BUCKET}/`) || /^assets\/[\w./-]+$/.test(u));

let sb = null;

/* A deck kept from before the last update reloads itself, once. GitHub Pages
   lets a browser keep a page for 10 minutes, and a page that old runs the old
   code: the owner tested a fix twice in a page like that and saw none of it.
   bump-version.py writes version.json. Asked before signing in (start), so
   the reload never cuts off a sign-in being renewed. -> true to reload */
async function stale() {
  const build = new URL(import.meta.url).searchParams.get('v');
  if (!build) return false;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);            // a slow network does not hold the deck up
    const j = await (await fetch(new URL('../../version.json', import.meta.url), { cache: 'no-store', signal: ctl.signal })).json();
    clearTimeout(t);
    if (!j?.v || j.v === build || sessionStorage.getItem('tala.fresh') === j.v) return false;
    sessionStorage.setItem('tala.fresh', j.v);                  // once, so it can never loop
    return true;
  } catch { return false; }
}

/* A staff request turned away because the sign-in ran out ("JWT expired": the
   owner met it after the deck had sat open -- a laptop that slept, a clock a
   little slow) goes again, once, with the sign-in renewed. */
let renewal = null;
async function renewingFetch(input, init) {
  const res = await fetch(input, init);
  const url = String(typeof input === 'string' ? input : input?.url || '');
  if (!sb || res.ok || ![400, 401, 403].includes(res.status) || !/\/(rest|storage)\/v1\//.test(url)) return res;
  if (!/jwt expired/i.test(await res.clone().text())) return res;
  renewal ||= sb.auth.refreshSession().finally(() => { renewal = null; });
  const token = (await renewal)?.data?.session?.access_token;
  if (!token) return res;
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
const S = { user: null, tab: 'requests', requests: [], items: [], settings: null, promos: null, reviews: null, filter: 'open', q: '' };

/* ───────────────────────── small helpers ───────────────────────── */

function toast(msg, bad = false) {
  let box = $('.adm-toasts');
  if (!box) { box = document.createElement('div'); box.className = 'adm-toasts'; box.setAttribute('role', 'status'); }
  // a modal <dialog> sits above every z-index, so toasts go inside the open one
  const host = $$('dialog[open]').pop() || document.body;
  if (box.parentNode !== host) host.append(box);
  const t = document.createElement('div');
  t.className = 'adm-toast' + (bad ? ' bad' : '');
  t.textContent = msg;
  box.append(t);
  setTimeout(() => t.classList.add('is-out'), bad ? 7000 : 3600);
  setTimeout(() => t.remove(), bad ? 7500 : 4100);
}

function friendly(err) {
  const m = String(err?.message || err?.error_description || err || '');
  if (/Invalid login credentials/i.test(m)) return 'Wrong email or PIN. No PIN yet? Use the emailed link once, then set one in the deck.';
  if (/Email not confirmed/i.test(m)) return 'This login is not confirmed yet. Confirm it in Supabase → Authentication → Users.';
  if (/shop_items_published_has_picture/.test(m)) return 'A trophy needs a photo or a 3D design before it can be shown on the website.';
  if (/duplicate key|23505/i.test(m)) return 'A trophy with this name already exists. Change the name a little and save again.';
  if (/row-level security|42501|permission denied/i.test(m)) return 'Your login is not allowed to do that. Ask the owner to add you as staff.';
  if (/does not exist|42P01|42703/i.test(m)) return 'The database is missing the Admin Deck tables — run supabase/admin.sql in the Supabase SQL editor.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Could not reach the server. Check the internet connection and try again.';
  return m || 'Something went wrong. Please try again.';
}
const chk = ({ data, error }) => { if (error) throw error; return data; };

function confirmBox(title, body, ok = 'Delete') {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'adm-dlg';
    d.style.width = 'min(440px, 100% - 24px)';
    d.innerHTML = `<form method="dialog"><div class="dlg-h"><div><h2>${esc(title)}</h2></div></div>
      <div class="dlg-b"><p style="margin:0">${esc(body)}</p></div>
      <div class="dlg-f"><span class="grow"></span><button class="btn btn--line btn--sm" value="no">Cancel</button>
      <button class="btn btn--solid btn--sm" value="yes">${esc(ok)}</button></div></form>`;
    document.body.append(d);
    let done = false;
    const end = yes => { if (done) return; done = true; if (d.open) d.close(); d.remove(); resolve(yes); };
    $('form', d).addEventListener('submit', e => { e.preventDefault(); end(e.submitter?.value === 'yes'); });
    d.addEventListener('cancel', e => { e.preventDefault(); end(false); });
    d.showModal();
    $('[value="no"]', d).focus();
  });
}

/* the plain-language spec of a design, for staff */
function specRows(d) {
  if (!d || typeof d !== 'object') return [];
  const shape = SHAPES[d.shape];
  const pose = shape && d.variant != null ? (variantsOf(d.shape) || [])[d.variant] : null;
  const rows = [
    ['Shape', shape ? shape.label + (pose ? ` · ${pose}` : '') : d.shape],
    ['Sheet', MATERIALS[d.material]?.label],
    // a wide figure is cut smaller to fit its base, so it stands short of its size
    ['Size', SIZES[d.size] ? `${SIZES[d.size].label} · ${canBuild(d) ? Math.round(standingHeight(d) * 2) / 2 : SIZES[d.size].total} cm` : null],
    ['Base', BASES[d.baseKind] ? `${BASES[d.baseKind].label} · ${BASE_FINISHES[d.baseFinish]?.label || ''}` : null],
    ['Sticker', SCHEMES[d.scheme] ? [SCHEMES[d.scheme].label, DECALS[d.decal]?.label, LAMINATES[d.laminate]?.label].filter(Boolean).join(' · ') : null],
    ['Wording', [d.org, ...(Array.isArray(d.names) && d.names.length ? [`a different title and name on each of the ${d.names.length}`] : [d.title, d.name]), d.date]
      .filter(Boolean).join(' / ')],
  ];
  if (SHAPES[d.shape] && printNote(d)) rows.push(['Print', printNote(d)]);
  if (d.shape === 'custom') rows.push(['Cut', `From the customer's own picture${d.cutPrint ? ', picture printed on it' : ''}. Ask them to send the original file.`]);
  if (d.logo) rows.push(['Logo', 'Yes — ask for the file']);
  if (d.extraSticker) rows.push(['Extra sticker', 'Yes']);
  if (d.speed) rows.push(['Speed', SPEEDS[d.speed]?.label || d.speed]);
  if (d.zone) rows.push(['Delivery', ZONES[d.zone]?.label || d.zone]);
  if (d.payment) rows.push(['Payment', PAYMENTS[d.payment]?.label || d.payment]);
  if (d.needBy) rows.push(['Needed by', d.needBy]);
  return rows.filter(r => r[1]);
}
// a request's own outline ("Your art", designSpec in designer.js): plain path data only
const validOutline = s => typeof s === 'string' && s.length <= 20000 && /^[MLHVCQZmlhvcqz\d\s.,eE+-]+$/.test(s);
const canBuild = d => d && typeof d === 'object' && SHAPES[d.shape] && (d.shape !== 'custom' || validOutline(d.outline));
const autoPrice = d => { try { return canBuild(d) ? price({ ...d, qty: 1 }).unit : null; } catch { return null; } };

/* one live 3D view inside a dialog; returns a disposer */
function mount3D(box, design) {
  box.innerHTML = '';
  if (!canBuild(design)) {
    box.innerHTML = `<div class="v3d__empty">${design?.shape === 'custom'
      ? 'Cut from the customer’s own picture — its outline did not come with this request. Ask them for the file.'
      : 'No 3D design.'}</div>`;
    return () => {};
  }
  if (!webglAvailable()) { box.innerHTML = '<div class="v3d__empty">This browser cannot show 3D.</div>'; return () => {}; }
  const canvas = document.createElement('canvas');
  box.append(canvas);
  const note = document.createElement('span');
  note.className = 'v3d__note'; note.textContent = 'Drag to turn';
  box.append(note);
  const viewer = createViewer(canvas, { autoRotate: true, maxDpr: 2 });
  let model = buildTrophy(design);
  viewer.scene.add(model);
  viewer.frameObject(model);
  viewer.invalidate();
  let gone = false;                          // a dialog can close twice (button, then the close event)
  // the canvas goes with it: give its WebGL context back now (a picture being edited redraws this often)
  const dispose = () => { if (gone) return; gone = true; viewer.scene.remove(model); disposeGroup(model); viewer.dispose(); viewer.renderer.forceContextLoss(); };
  // the same design changed a little (a piece slid along its base): the model again, the camera kept
  dispose.update = d => {
    if (gone || !canBuild(d)) return;
    viewer.scene.remove(model); disposeGroup(model);
    model = buildTrophy(d);
    viewer.scene.add(model);
    viewer.invalidate();
  };
  return dispose;
}

async function saveSticker(art, file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await pngAtDpi(art.canvas, STICKER_DPI));
  a.download = `${file}.png`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* A page with the sticker at its real size and a dashed line on its edge to
   cut along; printing at 100% keeps the size. The picture runs a little past
   the cut (sticker.js leaves room for the line), so it is sized by its pixels. */
function printSticker(art, title) {
  const c = document.createElement('canvas');
  c.width = art.canvas.width; c.height = art.canvas.height;
  const g = c.getContext('2d');
  g.drawImage(art.canvas, 0, 0);
  g.setLineDash([STICKER_DPI * 0.06, STICKER_DPI * 0.04]);
  g.lineWidth = Math.max(2, STICKER_DPI / 150);
  g.strokeStyle = 'rgba(0,0,0,.5)';
  g.stroke(art.path);
  const cm = px => (px / STICKER_DPI * 2.54).toFixed(3);
  // A4 inside the 12 mm margins: a Large panel sticker is wider than that standing up
  const pw = +cm(c.width), ph = +cm(c.height);
  const paper = pw <= 18.6 && ph <= 27.3 ? ''
    : pw <= 27.3 && ph <= 18.6 ? ' Choose Landscape in the print window: it is too wide for the page standing up.'
    : ' It is bigger than A4 or short bond paper: choose A3 in the print window, or have a print shop print it.';
  const w = window.open('', '_blank');
  if (!w) { toast('Allow pop-ups for this page to print the sticker.', true); return; }
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(title)} · sticker</title>
<style>@page{margin:12mm}body{margin:0;font:11px/1.5 system-ui,sans-serif;color:#555}img{display:block;width:${cm(c.width)}cm;height:${cm(c.height)}cm}p{margin:5mm 0 0}</style>
<img src="${c.toDataURL('image/png')}" alt="">
<p>${esc(title)} · ${art.w.toFixed(1)} × ${art.h.toFixed(1)} cm. Print at 100% ("Actual size"), then cut along the dashed line.${paper}</p>
<script>addEventListener('load', () => setTimeout(print, 150))</script>`);
  w.document.close();
}

/* Every trophy's wording sticker in a list (design.names), at real size on as
   many pages as it takes, a dashed cut line round each and its number and name
   under it. The window opens at once -- a pop-up has to come straight from the
   click -- and fills when the stickers are drawn. */
async function printEach(design, rows, title) {
  const w = window.open('', '_blank');
  if (!w) { toast('Allow pop-ups for this page to print the stickers.', true); return; }
  const head = `<!doctype html><meta charset="utf-8"><title>${esc(title)} · ${rows.length} stickers</title>`;
  w.document.write(`${head}<p id="busy" style="font:14px system-ui,sans-serif;padding:20px">Drawing the ${rows.length} stickers…</p>`);
  const cm = px => (px / STICKER_DPI * 2.54).toFixed(3);
  const figs = [];
  let size = null, clear = false;
  try {
    await eachWording(design, rows, async (art, i) => {
      const c = document.createElement('canvas');
      c.width = art.canvas.width; c.height = art.canvas.height;
      const g = c.getContext('2d');
      g.drawImage(art.canvas, 0, 0);
      g.setLineDash([STICKER_DPI * 0.06, STICKER_DPI * 0.04]);
      g.lineWidth = Math.max(2, STICKER_DPI / 150);
      g.strokeStyle = 'rgba(0,0,0,.5)';
      g.stroke(art.path);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      c.width = c.height = 0;
      size ||= { w: cm(art.canvas.width), h: cm(art.canvas.height), cw: art.w, ch: art.h };
      clear ||= art.clear;
      figs.push(`<figure><img src="${URL.createObjectURL(blob)}" alt=""><figcaption>${i + 1} · ${esc(rows[i].title || '')} — ${esc(rows[i].name || '')}</figcaption></figure>`);
      const busy = w.document.getElementById('busy');
      if (busy) busy.textContent = `Drawing sticker ${i + 1} of ${rows.length}…`;
      if (w.closed) throw new Error('closed');
    });
  } catch (err) {
    if (w.closed) return;
    console.warn('[tala] wording stickers:', err);
    w.document.body.textContent = `The stickers could not be drawn: ${friendly(err)}`;
    return;
  }
  if (!size) { w.document.body.textContent = 'This design has no wording sticker to print.'; return; }
  w.document.open();
  w.document.write(`${head}
<style>@page{margin:10mm}body{margin:0;font:9px/1.4 system-ui,sans-serif;color:#555}p{margin:0 0 4mm;font-size:11px}
figure{display:inline-block;vertical-align:top;margin:0 5mm 4mm 0}
img{display:block;width:${size.w}cm;height:${size.h}cm}figcaption{margin-top:1mm;max-width:${size.w}cm}</style>
<p>${esc(title)} · ${rows.length} stickers, ${size.cw.toFixed(1)} × ${size.ch.toFixed(1)} cm each. Print at 100% ("Actual size"),
then cut along each dashed line.${clear ? ' The clear parts go on clear sticker film.' : ''}</p>
<div class="sheet">${figs.join('')}</div>
<script>addEventListener('load', () => setTimeout(print, 300))</script>`);
  w.document.close();
}

/* a small copy for the dialog: the full sticker is thousands of pixels across */
function stickerThumb(canvas, max = 720) {
  const k = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

/* Ask for a picture and read it in: -> an <img>, or null. Nothing is uploaded;
   it is only drawn into the prints here. */
function pickImage() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.addEventListener('cancel', () => resolve(null));
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const img = new Image();
      img.src = URL.createObjectURL(file);
      try { await img.decode(); resolve(img); }
      catch { toast(`${file.name} could not be read — use a JPG, PNG or WebP picture.`, true); resolve(null); }
    });
    input.click();
  });
}

/* The pictures that came with a request (main.js sends them), opened for staff:
   -> { picture?, photo?, pictureBox? } as <img>s. The picture is the cut-out
   already, so it spans the whole crop box. */
async function requestFiles(d) {
  const got = {};
  for (const k of ['picture', 'photo']) {
    const path = d?.files?.[k];
    if (typeof path !== 'string' || !ART_PATH.test(path)) continue;
    try {
      const img = new Image();
      img.src = URL.createObjectURL(chk(await sb.storage.from(ART_BUCKET).download(path)));
      await img.decode();
      got[k] = img;
    } catch (err) { console.warn('[tala] could not open', path, err); }
  }
  // a shop trophy made from a picture: its stored cut-out is the picture to print
  if (!got.picture) { const own = await pictureOf(d); if (own) got.picture = own; }
  if (got.picture) got.pictureBox = [0, 0, 1, 1];
  return got;
}
const requestPaths = d => Object.values(d?.files || {}).filter(v => typeof v === 'string' && ART_PATH.test(v));

/* The payment receipt a customer uploads after placing an order (main.js),
   saved beside their pictures under the order number: <ref>/receipt.webp. */
async function showReceipt(box, ref) {
  try {
    const files = chk(await sb.storage.from(ART_BUCKET).list(ref)) || [];
    const got = files.map(f => f.name).filter(n => /^receipt(-[2-9])?\.(webp|png|jpg)$/.test(n)).sort();
    if (!got.length || !box.isConnected) return;
    const urls = [];
    for (const n of got) urls.push(URL.createObjectURL(chk(await sb.storage.from(ART_BUCKET).download(`${ref}/${n}`))));
    box.innerHTML = `<p class="sec-t">Payment receipt${urls.length > 1 ? 's' : ''}</p><div class="rcpt">${urls.map(u =>
      `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="The customer's payment receipt"></a>`).join('')}</div>
      <p class="stk__size">Uploaded by the customer. Check it against your GCash, Maya or bank before you start.</p>`;
    box.hidden = false;
  } catch (err) { console.warn('[tala] receipt not opened:', err); }
}

/* "Your art"'s picture for the 3D model: the original, cropped where the designer cropped it */
function cropToCut(img, [bx, by, bw, bh]) {
  const iw = img.naturalWidth, ih = img.naturalHeight, sw = bw * iw, sh = bh * ih;
  const k = Math.min(1, 1024 / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
  c.getContext('2d').drawImage(img, bx * iw, by * ih, sw, sh, 0, 0, c.width, c.height);
  return c;
}
// the design with what the customer sent afterwards in it, for the 3D model
const withFiles = (design, got) => ({ ...design, photoImg: got.photo || null,
  cutArt: got.picture && Array.isArray(design.cutBox) ? cropToCut(got.picture, got.pictureBox || design.cutBox) : null });

/* The sticker block under a design: the picture, its size, save and print.
   On a request it also takes what the customer sends after ordering (their
   files stay on their device, see design.html): their photo for the sticker,
   and on "Your art", or a figure printed over, the picture for the cut piece.
   `opts.got` keeps those; `opts.onDesign` hears of the design with them in;
   `opts.photo` says a photo is coming (older requests only say so in words). */
async function mountSticker(box, design, name, opts = {}) {
  box.hidden = true;
  box.innerHTML = '';
  if (!design || typeof design !== 'object' || !SHAPES[design.shape]) return;
  const n = (box.dataset.n = String(Number(box.dataset.n || 0) + 1));   // a newer design wins the race
  const got = opts.got || (opts.got = {});
  const coming = !!(design.photo || opts.photo);
  const onFigure = design.photoTarget === 'figure' && !!SHAPES[design.shape].decal?.onBase;
  const d = { ...design, photo: coming, photoImg: got.photo || null };
  let art = null;
  try { art = await stickerArt(d); } catch { /* no sticker for this design */ }
  if (!art || box.dataset.n !== n) return;

  // what is printed on the cut piece itself: "Your art"'s own picture, or a photo over a figure
  const piece = d.shape === 'custom' ? (d.cutPrint && d.cutAspect ? 'picture' : null) : (coming && onFigure ? 'photo' : null);
  const canLine = piece === 'picture' ? !!(d.outline && Array.isArray(d.cutBox)) : !!piece;
  let pa = null;
  if (canLine && got[piece]) {
    try { pa = pieceArt(piece === 'picture' && got.pictureBox ? { ...d, cutBox: got.pictureBox } : d, got[piece]); }
    catch { /* left to add again */ }
  }
  // a printed figure (owner, 8 Nov): the shop's own print at real size, in the outfit's colour, its clear border round it
  const fart = piece ? null : figureArt(d.shape, d.variant);
  let fp = null;
  if (fart?.hi) {
    try {
      let img = await loadArtImage(fart.hi);
      if (fart.wear && outfitOk(d.outfit)) img = recolour(img, await loadArtImage(fart.wear), d.outfit.toLowerCase());
      fp = pieceArt(d, img, fart.box);
    } catch { /* the print is not shown */ }
    if (box.dataset.n !== n) return;
  }

  const label = SHAPES[d.shape]?.label || 'trophy';
  // opts.own: the shop's own trophy made from a picture -- its picture is changed with "Change the picture"
  const along = piece === 'picture' ? (opts.own ? 'its outline' : 'their outline') : 'the figure';
  const where = SHAPES[d.shape]?.decal?.onBase ? 'on the base front' : 'on the trophy';
  // a layered design: its layers are one sticker, the wording a clear one of its own laid on it (owner, 6 Nov)
  const words = art.words;
  // a different title and name on each trophy (owner, 7 Nov): one wording sticker per name
  const names = (Array.isArray(d.names) ? d.names : []).slice(0, 200).filter(r => r && typeof r === 'object')
    .map(r => ({ title: String(r.title ?? '').slice(0, 26), name: String(r.name ?? '').slice(0, 30) }));
  const film = a => (a.clear ? ' The checkered parts are clear: print it on clear sticker film.' : '');
  const wait = art.standIn ? ' Their photo goes in the grey part: add it when they send it.' : '';
  const btn = (k, t) => `<button class="btn btn--line btn--sm" type="button" data-stk="${k}">${t}</button>`;
  const photoBtn = coming && !onFigure ? btn('photo', got.photo ? 'Change their photo' : 'Add their photo') : '';
  box.innerHTML = `<p class="sec-t">${SHAPES[d.shape]?.decal?.onBase ? 'Sticker for the base' : words ? 'Design sticker' : 'Sticker'}</p>
    <div class="stk__pic"><img src="${stickerThumb(art.canvas)}" alt="${words ? 'The design sticker: every layer, no wording' : 'The sticker of this design'}"></div>
    <p class="stk__size">${art.w.toFixed(1)} × ${art.h.toFixed(1)} cm ${where}, ${SIZES[d.size]?.label || 'Medium'} size.${
      words ? ' The same for every trophy of this design and size: the wording is a sticker of its own.' : ''}${film(art)}${words ? '' : wait}</p>
    <div class="stk__btns">${btn('save', 'Save sticker')}${btn('print', 'Print at real size')}${words ? '' : photoBtn}</div>
    ${!words ? '' : `<div class="stk__piece"><p class="sec-t">Wording sticker</p>
      <div class="stk__pic"><img src="${stickerThumb(words.canvas)}" alt="The wording, on its own clear sticker"></div>
      <p class="stk__size">${words.w.toFixed(1)} × ${words.h.toFixed(1)} cm, laid on the design sticker where the 3D trophy shows it.${film(words)}${wait}</p>
      <div class="stk__btns">${btn('wsave', 'Save wording')}${btn('wprint', 'Print at real size')}${photoBtn}</div></div>`}
    ${!piece ? '' : `<div class="stk__piece"><p class="sec-t">${piece === 'picture' ? 'Picture sticker for the cut piece' : 'Photo sticker for the figure'}</p>${
      pa ? `<div class="stk__pic"><img src="${stickerThumb(pa.canvas)}" alt="The print for the cut piece"></div>
        <p class="stk__size">${pa.w.toFixed(1)} × ${pa.h.toFixed(1)} cm, cut along ${along}. Check its edges before printing.</p>
        <div class="stk__btns">${btn('psave', 'Save picture')}${btn('pprint', 'Print at real size')}${opts.own ? '' : btn(piece, `Change their ${piece}`)}</div>`
      : canLine ? `<p class="stk__size">Their ${piece} did not come with this request. Add the one they send you and it is ${
          piece === 'picture' ? 'cropped where they cropped it and ' : ''}cut along ${along}, at real size.</p>
        <div class="stk__btns">${btn(piece, `Add their ${piece}`)}</div>`
      : `<p class="stk__size">Their outline did not come with this request, so their picture cannot be lined up here. Ask them for the file.</p>`}</div>`}
    ${!fp ? '' : `<div class="stk__piece"><p class="sec-t">Figure print</p>
      <div class="stk__pic"><img src="${stickerThumb(fp.canvas)}" alt="The figure's own print"></div>
      <p class="stk__size">${fp.w.toFixed(1)} × ${fp.h.toFixed(1)} cm${outfitOk(d.outfit) ? `, the outfit in ${esc(outfitLabel(d.outfit))}` : ''}.
        The dashed line is the acrylic's cut: a clear border round the print.</p>
      <div class="stk__btns">${btn('fsave', 'Save figure print')}${btn('fprint', 'Print at real size')}</div></div>`}
    ${!names.length ? '' : `<div class="stk__piece"><p class="sec-t">Wording on each trophy · ${names.length}</p>
      <p class="stk__size">A different title and name on each one: a ${words ? 'clear wording' : 'base'} sticker for every trophy, all the same size. The one above is trophy 1.</p>
      <ol class="stk__names">${names.map(r => `<li><b>${esc(r.title || '—')}</b>${esc(r.name || '—')}</li>`).join('')}</ol>
      <div class="stk__btns">${btn('nprint', `Print all ${names.length} at real size`)}</div></div>`}`;
  box.hidden = false;
  const base = slug(name || label);
  $('[data-stk="nprint"]', box)?.addEventListener('click', () => printEach(d, names, name || label));
  $('[data-stk="save"]', box).addEventListener('click', () => saveSticker(art, `${base}-sticker-${art.w.toFixed(1)}x${art.h.toFixed(1)}cm`));
  $('[data-stk="print"]', box).addEventListener('click', () => printSticker(art, name || 'Sticker'));
  if (words) {
    $('[data-stk="wsave"]', box).addEventListener('click', () => saveSticker(words, `${base}-wording-${words.w.toFixed(1)}x${words.h.toFixed(1)}cm`));
    $('[data-stk="wprint"]', box).addEventListener('click', () => printSticker(words, `${name || label} · wording`));
  }
  for (const k of ['photo', 'picture']) {
    $(`[data-stk="${k}"]`, box)?.addEventListener('click', async () => {
      const img = await pickImage();
      if (!img) return;
      got[k] = img;
      if (k === 'picture') got.pictureBox = null;   // their original file: cropped where they cropped it
      opts.onDesign?.(withFiles(design, got));
      mountSticker(box, design, name, opts);
    });
  }
  if (fp) {
    $('[data-stk="fsave"]', box).addEventListener('click', () => saveSticker(fp, `${base}-figure-${fp.w.toFixed(1)}x${fp.h.toFixed(1)}cm`));
    $('[data-stk="fprint"]', box).addEventListener('click', () => printSticker(fp, `${name || label} · figure`));
  }
  if (pa) {
    $('[data-stk="psave"]', box).addEventListener('click', () => saveSticker(pa, `${base}-${piece}-${pa.w.toFixed(1)}x${pa.h.toFixed(1)}cm`));
    $('[data-stk="pprint"]', box).addEventListener('click', () => printSticker(pa, `${name || label} · ${piece}`));
  }
}

/* The order sheet the designer writes into the message (specText in
   designer.js), read back into its sections, so it shows as a table instead of
   padded text. Whatever else the customer typed is kept apart, as their own.
   -> { sections: [{ title, rows: [[key, value]] }], notes, own }, or null. */
const SHEET_TOP = 'TROPHY DESIGN — built on the website';
const SHEET_END = 'Please confirm the price and send a proof.';
const SHEET_TITLES = { 'PRINTED STICKER': 'Sticker', WORDING: 'Wording', ORDER: 'Order' };
// the customer's own notes, said for the shop
const SHEET_NOTES = { 'NOTE: the photo is only on my own screen — please tell me where to send the file.':
  'Their photo is still on their own device: ask them to send it, then add it to the sticker below.' };
function orderSheet(message) {
  const lines = String(message || '').split(/\r?\n/);
  const top = lines.findIndex(l => l.trim() === SHEET_TOP);
  if (top < 0) return null;
  let end = lines.findIndex((l, i) => i > top && l.trim() === SHEET_END);
  if (end < 0) end = lines.length;
  const sections = [{ title: 'Trophy', rows: [] }], notes = [];
  for (const raw of lines.slice(top + 1, end)) {
    const l = raw.replace(/\s+$/, ''), t = l.trim();
    if (!t) continue;
    if (SHEET_TITLES[t]) { sections.push({ title: SHEET_TITLES[t], rows: [] }); continue; }
    if (/^NOTE:/i.test(t)) { notes.push(SHEET_NOTES[t] || t.replace(/^NOTE:\s*/i, '')); continue; }
    // specText pads each label to 16 characters; a line the customer edited may keep only a gap
    const row = l.length > 16 && l[15] === ' ' && l.slice(0, 16).trim()
      ? [l.slice(0, 16).trim(), l.slice(16).trim()] : (t.match(/^(.+?)\s{2,}(.+)$/) || []).slice(1);
    if (row.length !== 2 || !row[1]) { notes.push(t); continue; }
    if (row[0] === 'Unit') sections.push({ title: 'Price', rows: [] });
    sections[sections.length - 1].rows.push(row);
  }
  const own = [...lines.slice(0, top), ...lines.slice(end + 1)].join('\n').trim();
  return { sections: sections.filter(x => x.rows.length), notes, own };
}
const sheetHtml = sh => sh.sections.map(x => `<p class="sheet__t">${esc(x.title)}</p>
    <dl class="kv sheet__kv">${x.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd${/TOTAL/.test(k) ? ' class="sheet__total"' : ''}>${esc(v)}</dd>`).join('')}</dl>`).join('')
  + sh.notes.map(t => `<p class="sheet__note">${esc(t)}</p>`).join('');

/* stills of the shop designs, one renderer for all of them */
const stills = new Map();
async function bakeStills(items) {
  const todo = items.filter(i => !i.images?.length && canBuild(i.design) && !stills.has(stillKey(i)));
  if (!todo.length || !webglAvailable()) return;
  const W = 420, H = 525;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const viewer = createViewer(canvas, { capture: true, fixed: { w: W, h: H }, loop: false, interactive: false, maxDpr: 1 });
  for (const it of todo) {
    await Promise.race([artReady(it.design), new Promise(r => setTimeout(r, 4000))]);
    const model = buildTrophy(it.design);
    viewer.scene.add(model); viewer.frameObject(model); viewer.renderNow();
    stills.set(stillKey(it), canvas.toDataURL('image/png'));
    viewer.scene.remove(model); disposeGroup(model);
    const img = $(`.item[data-id="${CSS.escape(it.id)}"] .item__pic img[data-3d]`);
    if (img) img.src = stills.get(stillKey(it));
    await new Promise(r => setTimeout(r, 0));
  }
  viewer.dispose();
}
const stillKey = i => JSON.stringify(i.design);

/* photos: resize and re-encode in the browser (this also drops the phone's location data) */
async function resizeImage(file, max = 1600, quality = 0.84) {
  let src, url;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    url = URL.createObjectURL(file);
    src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`${file.name} could not be read — use a JPG, PNG or WebP photo`)); i.src = url; });
  }
  const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
  const s = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, c.width, c.height);
  src.close?.(); if (url) URL.revokeObjectURL(url);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
  if (!blob) throw new Error(`${file.name} could not be converted`);
  return blob;
}
async function uploadPhoto(blob, id) {
  const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  chk(await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }));
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
async function deletePhotos(urls) {
  const pre = `${URL_}/storage/v1/object/public/${BUCKET}/`;
  const paths = (urls || []).filter(u => u.startsWith(pre)).map(u => u.slice(pre.length));
  if (paths.length) await sb.storage.from(BUCKET).remove(paths);   // best effort: an orphan photo costs nothing visible
}

/* ───────── a shop trophy made from a picture (owner, 6 Nov) ─────────
   "Add trophy by just putting the picture and you generate it as trophy": the
   picture is cut out as "Your art" is in the designer -- its background taken
   off, the acrylic cut to its outline, the picture printed on it -- on the
   shop's usual Medium gold bar. The picture is taken in, its base cut off and
   edited by hand in cut-editor.js (6 Nov); every cut becomes the design here.
   The cut-out is stored under art/ when the trophy is saved and named by the
   design's `cutUrl`, so the shop, the cart and orders all wear it. Old ones
   are kept: orders still point at them. */
const OUTLINE_MAX = 6500;               // shop_items.design holds 8 kB, and the outline is most of it

/* a cut (finishCut's result on the working picture `c`) as the trophy's design,
   keeping the options of the one before if that was made from a picture too */
function pictureDesign(img, c, r, prev) {
  const base = prev?.shape === 'custom' ? prev : catalogItem('custom').design;
  const outline = fitOutline(r.d, simplify);
  if (!outline) throw new Error('That outline is too detailed to keep. Erase the fine bits, or try a simpler picture.');
  const cutBox = [r.x0 / c.width, r.y0 / c.height, r.art.width / c.width, r.art.height / c.height].map(v => +v.toFixed(5));
  // the print: the original picture cropped to the cut, kept where the cut kept it, up to 2048 px
  const iw = img.naturalWidth, ih = img.naturalHeight, sw = cutBox[2] * iw, sh = cutBox[3] * ih;
  const k = Math.min(1, 2048 / Math.max(sw, sh));
  const art = document.createElement('canvas');
  art.width = Math.max(1, Math.round(sw * k)); art.height = Math.max(1, Math.round(sh * k));
  const g = art.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, cutBox[0] * iw, cutBox[1] * ih, sw, sh, 0, 0, art.width, art.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(r.art, 0, 0, art.width, art.height);
  const { cutUrl: _, cutArt: __, ...keep } = base;
  return { ...keep, shape: 'custom', variant: 0, outline, cutBox, cutAspect: r.aspect, cutPrint: true, cutMode: r.mode, cutArt: art };
}

/* The traced outline made to fit the design column: simplified a little more
   each time (outline units, 300 = its height) until it does; null if never. */
function fitOutline(d, simplify) {
  const rings = d.split('M').slice(1).map(sp => {
    const n = (sp.match(/-?\d*\.?\d+/g) || []).map(Number), r = [];
    for (let i = 0; i + 1 < n.length; i += 2) r.push([n[i], n[i + 1]]);
    return r;
  });
  for (const tol of [0, 0.3, 0.6, 1, 1.5]) {
    const out = rings.map(r => (tol ? simplify([...r, r[0]], tol).slice(0, -1) : r)).filter(r => r.length > 2)
      .map(r => r.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + ' Z').join(' ');
    if (out.length <= OUTLINE_MAX) return out;
  }
  return null;
}

async function uploadArt(canvas, id) {
  const blob = await new Promise(ok => canvas.toBlob(ok, 'image/webp', 0.9));
  if (!blob) throw new Error('The picture could not be prepared. Choose it again.');
  const ext = blob.type === 'image/png' ? 'png' : 'webp';    // Safari makes a PNG when asked for WebP
  const path = `art/${id}-${Date.now().toString(36)}.${ext}`;
  chk(await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false }));
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/* A picture-made trophy's cut-out, for its print: the one just made, or the stored one. */
function pictureOf(d) {
  if (d?.shape !== 'custom') return Promise.resolve(null);
  if (d.cutArt) return Promise.resolve(Object.assign(d.cutArt, { naturalWidth: d.cutArt.width, naturalHeight: d.cutArt.height }));
  if (!shopArtOk(d.cutUrl)) return Promise.resolve(null);
  return new Promise(ok => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => ok(im); im.onerror = () => ok(null);
    im.src = d.cutUrl;
  });
}

// a picture's file name as a trophy's name, unless it is a camera's or an app's
const nameFromFile = n => {
  const s = String(n).replace(/\.[a-z0-9]+$/i, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || /^(img|dsc|pxl|screenshot|photo|image|received|messenger|fb|whatsapp|viber|download)\b|^\d/i.test(s)) return '';
  return s.replace(/\b\w/g, ch => ch.toUpperCase()).slice(0, 80);
};

const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'trophy';

/* ───────────────────────── screens ───────────────────────── */

function setupScreen() {
  app.innerHTML = `<section class="adm-gate">
    <div class="brand">★ <b>Tala Artisan</b> · Admin Deck</div>
    <h1>Not connected yet</h1>
    <p>The Admin Deck needs the shop's Supabase project. Fill in <code>assets/js/config.js</code>
       (project URL and publishable key) and run <code>supabase/admin.sql</code>.</p></section>`;
}

/* Three ways in. Google and the emailed link need no password; the password
   form stays for staff logins made in Supabase → Authentication → Users.
   A first Google or email-link sign-in creates the login, but it can do
   nothing until the owner adds it to the staff list (make-admin.sql). */
const backHere = () => location.origin + location.pathname;

function signInScreen(msg = '') {
  app.innerHTML = `<section class="adm-gate">
    <div class="brand">★ <b>Tala Artisan</b> · Admin Deck</div>
    <h1>Sign in</h1>
    <p>For shop staff. Requests and the website's shop are managed here.</p>
    <div style="display:grid;gap:10px;margin-top:20px" id="googleRow" hidden>
      <button class="btn btn--line adm-google" type="button" id="google">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="stroke:none;transform:none"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z"/></svg>
        Continue with Google</button>
      <p class="adm-or">or</p>
    </div>
    <form id="signin" novalidate style="margin-top:0">
      <label class="fld">Email<input type="email" name="email" autocomplete="username" required></label>
      <label class="fld" id="pwRow">PIN<input type="password" name="password" inputmode="numeric" autocomplete="current-password"></label>
      <p class="adm-msg${msg ? ' bad' : ''}" id="signMsg" role="alert">${esc(msg)}</p>
      <button class="btn btn--solid" type="submit" id="go">Sign in</button>
      <button class="adm-link" type="button" id="usePw">No PIN yet, or forgot it? Email me a sign-in link</button>
    </form></section>`;
  const f = $('#signin'), out = $('#signMsg');
  const say = (t, bad = false) => { out.textContent = t; out.className = 'adm-msg' + (bad ? ' bad' : ''); };
  let pw = true;                         // PIN first; the emailed link is the way in to set one
  fetch(`${URL_}/auth/v1/settings`, { headers: { apikey: KEY } }).then(r => r.json())
    .then(st => { if (st?.external?.google) $('#googleRow').hidden = false; }).catch(() => {});

  $('#google').addEventListener('click', async () => {
    // supabase-js would send the browser off to a bare JSON error page if the
    // provider is off, so ask the server first
    try {
      const st = await (await fetch(`${URL_}/auth/v1/settings`, { headers: { apikey: KEY } })).json();
      if (!st?.external?.google) return say('Google sign-in is not switched on yet — the owner turns it on in Supabase. Use the emailed link for now.', true);
    } catch { /* let supabase-js try anyway */ }
    say('Opening Google…');
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: backHere() } });
    if (error) say(/provider is not enabled|Unsupported provider/i.test(error.message)
      ? 'Google sign-in is not switched on in Supabase yet. Use the emailed link for now.' : friendly(error), true);
  });
  $('#usePw').addEventListener('click', () => {
    pw = !pw;
    $('#pwRow').hidden = !pw;
    $('#go').textContent = pw ? 'Sign in' : 'Email me a sign-in link';
    $('#usePw').textContent = pw ? 'No PIN yet, or forgot it? Email me a sign-in link' : 'I have a PIN';
    (pw ? f.password : f.email).focus();
  });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const email = f.email.value.trim(), btn = $('#go');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return say('Enter your email address.', true);
    if (pw && !f.password.value) return say('Enter your PIN.', true);
    btn.disabled = true;
    try {
      if (pw) {
        say('Signing in…');
        chk(await sb.auth.signInWithPassword({ email, password: f.password.value }));
        await enter();
      } else {
        say('Sending…');
        chk(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: backHere() } }));
        codeStep(email);
      }
    } catch (err) {
      say(/rate limit|too many/i.test(err.message || '') ? 'Too many emails just now. Wait a few minutes and try again.' : friendly(err), true);
    } finally { btn.disabled = false; }
  });
  f.email.focus();
}

/* Step two of the emailed sign-in. Supabase's built-in mail sends a link, not
   a code, and the link signs in whichever device it is opened on -- so the
   page says exactly that, and offers a resend instead of a code box. */
function codeStep(email) {
  app.innerHTML = `<section class="adm-gate">
    <div class="brand">★ <b>Tala Artisan</b> · Admin Deck</div>
    <h1>Check your email</h1>
    <p>We sent <b>“Your sign-in link”</b> to <b>${esc(email)}</b>. Open the newest one and press <b>Sign in</b>.</p>
    <p><b>Open it on the device you want to use.</b> The link signs in whichever phone or computer it is
       opened on — open it on your phone and the phone is signed in, not this screen.</p>
    <p style="font-size:.84rem;color:var(--mute)">It can take a minute; look in Spam too. In Gmail on a computer,
       press <b>•••</b> if the email looks empty. Each new email cancels the one before it.</p>
    <div style="display:grid;gap:10px;margin-top:18px">
      <button class="btn btn--line" type="button" id="again">Send a new link</button>
      <button class="adm-link" type="button" id="back">Use a different email</button>
    </div>
    <p class="adm-msg" id="codeMsg" role="alert" style="margin-top:10px"></p></section>`;
  const out = $('#codeMsg'), again = $('#again');
  $('#back').addEventListener('click', () => signInScreen());
  // Supabase's free mail allows about two of these an hour, so make a resend deliberate
  let wait = 60;
  const tick = () => { again.disabled = wait > 0; again.textContent = wait > 0 ? `Send a new link (in ${wait}s)` : 'Send a new link'; };
  tick();
  const t = setInterval(() => { wait--; tick(); if (wait <= 0) clearInterval(t); }, 1000);
  again.addEventListener('click', async () => {
    again.disabled = true;
    try {
      chk(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: backHere() } }));
      out.textContent = 'Sent. Use only this newest email.'; out.className = 'adm-msg';
    } catch (err) {
      out.textContent = /rate limit|too many/i.test(err.message || '') ? 'Too many emails just now. Wait a few minutes and try again.' : friendly(err);
      out.className = 'adm-msg bad'; again.disabled = false;
    }
  });
}

function notStaffScreen(email) {
  app.innerHTML = `<section class="adm-gate">
    <div class="brand">★ <b>Tala Artisan</b> · Admin Deck</div>
    <h1>Not on the staff list</h1>
    <p>You are signed in as <b>${esc(email)}</b>, but this login has not been given access yet.
       The owner adds it by running <code>supabase/make-admin.sql</code> with your email.</p>
    <button class="btn btn--line" id="out" style="margin-top:14px">Sign out</button></section>`;
  $('#out').addEventListener('click', signOut);
}

async function signOut() { await sb.auth.signOut(); S.noDevice = true; signInScreen(); }

/* A browser that has not been approved yet. Its code is the start of its
   own id; approving it is one insert into public.admins (see make-admin.sql).
   After that this browser opens straight into the deck, with no sign-in. */
const deviceCode = () => S.user.id.replace(/-/g, '').slice(0, 8).toUpperCase();
function deviceScreen() {
  app.innerHTML = `<section class="adm-gate">
    <div class="brand">★ <b>Tala Artisan</b> · Admin Deck</div>
    <h1>Approve this device</h1>
    <p>This phone or computer is not approved yet. Send this code to the owner:</p>
    <p style="font-family:ui-monospace,Consolas,monospace;font-size:2rem;letter-spacing:.18em;text-align:center;
      background:var(--surface);border-radius:10px;padding:14px 0;margin:14px 0">${deviceCode()}</p>
    <p style="font-size:.86rem;color:var(--mute)">Once it is approved, this device opens straight into the deck — no email,
      no password. Clearing this browser's data means approving it again.</p>
    <div style="display:grid;gap:10px;margin-top:16px">
      <button class="btn btn--solid" type="button" id="again">It's approved — open the deck</button>
      <button class="adm-link" type="button" id="staff">Sign in with email and PIN instead</button>
    </div>
    <p class="adm-msg" id="devMsg" role="alert" style="margin-top:10px"></p></section>`;
  $('#again').addEventListener('click', async () => {
    const ok = chk(await sb.from('admins').select('user_id').eq('user_id', S.user.id).maybeSingle());
    if (ok) return enter();
    $('#devMsg').textContent = 'Not approved yet. Send the code above to the owner.'; $('#devMsg').className = 'adm-msg bad';
  });
  $('#staff').addEventListener('click', () => signInScreen());
}

/* small line icons for the sidebar */
const IC = {
  inbox: '<path d="M4 13h4l2 3h4l2-3h4M4 13l2.5-7h11L20 13v6H4Z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M9 17h6"/>',
  site: '<path d="M4 5h16v14H4ZM4 9h16M7 7h.01M9.5 7h.01"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16Zm9-13 4 4"/>',
  wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9H4ZM4 7l11-3v3M16 13h.01"/>',
  tag: '<path d="M4 4h7l9 9-7 7-9-9ZM8 8h.01"/>',
  star: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6Z"/>',
};
const ico = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

function shell() {
  app.innerHTML = `
  <div class="adm-shell">
    <aside class="adm-side">
      <a class="adm-side__brand" href="./" target="_blank" rel="noopener" aria-label="Open the website">Tala Artisan</a>
      <span class="adm-side__label">Admin Deck</span>
      <nav class="adm-side__nav" aria-label="Admin">
        <button type="button" data-tab="requests">${ico('inbox')}<span>Requests</span><span class="adm-badge" id="newCount" hidden></span></button>
        <button type="button" data-tab="shop">${ico('trophy')}<span>Shop trophies</span></button>
        <button type="button" data-tab="promos">${ico('tag')}<span>Promos</span></button>
        <button type="button" data-tab="reviews">${ico('star')}<span>Ratings</span></button>
        <button type="button" data-tab="pay">${ico('wallet')}<span>Payment details</span></button>
        <span class="adm-side__sep"></span>
        <a href="./" target="_blank" rel="noopener">${ico('site')}<span>View website</span></a>
        <a href="design.html" target="_blank" rel="noopener">${ico('pen')}<span>Open the designer</span></a>
      </nav>
      <div class="adm-side__foot">
        <span class="adm-side__user" title="${esc(S.user.email)}">${esc(S.user.email)}</span>
        <button type="button" id="pin">Set my sign-in PIN</button>
        <button type="button" id="out">Sign out</button>
      </div>
    </aside>
    <main class="adm-main" id="main"></main>
  </div>`;
  $$('.adm-side__nav [data-tab]').forEach(t => t.addEventListener('click', () => { S.tab = t.dataset.tab; render(); window.scrollTo(0, 0); }));
  $('#out').addEventListener('click', signOut);
  $('#pin').addEventListener('click', setPin);
  if (S.user.is_anonymous) {
    $('#pin').hidden = true; $('#out').hidden = true;
    $('.adm-side__user').textContent = `Approved device ${deviceCode()}`;
  }
}

/* The PIN is the login's own Supabase password, chosen by the staff member
   while signed in -- so nobody else ever sees or sets it, and signing in
   needs no email at all. */
function setPin() {
  const d = document.createElement('dialog');
  d.className = 'adm-dlg';
  d.style.width = 'min(440px, 100% - 24px)';
  d.innerHTML = `<form novalidate>
    <div class="dlg-h"><div><h2>Your sign-in PIN</h2><p>Sign in with your email and this PIN on any phone or computer. No emails needed.</p></div>
      <button class="dlg-x" type="button" value="close" aria-label="Close">×</button></div>
    <div class="dlg-b">
      <label class="fld">New PIN<input type="password" name="a" inputmode="numeric" autocomplete="new-password" minlength="6" required>
        <small>At least 6 numbers or letters. Not your birthday or 123456.</small></label>
      <label class="fld">Type it again<input type="password" name="b" inputmode="numeric" autocomplete="new-password" required></label>
      <p class="adm-msg" id="pinMsg" role="alert"></p>
    </div>
    <div class="dlg-f"><span class="grow"></span>
      <button class="btn btn--line btn--sm" type="button" value="close">Cancel</button>
      <button class="btn btn--solid btn--sm" type="submit">Save PIN</button></div></form>`;
  document.body.append(d);
  const f = $('form', d), out = $('#pinMsg', d);
  const end = () => { if (d.open) d.close(); d.remove(); };
  $$('[value="close"]', d).forEach(b => b.addEventListener('click', end));
  d.addEventListener('cancel', e => { e.preventDefault(); end(); });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const a = f.a.value, b = f.b.value;
    if (a.length < 6) { out.textContent = 'Make it at least 6 characters.'; out.className = 'adm-msg bad'; return; }
    if (/^(\d)\1+$/.test(a) || '01234567890'.includes(a) || '09876543210'.includes(a)) { out.textContent = 'That one is too easy to guess. Pick another.'; out.className = 'adm-msg bad'; return; }
    if (a !== b) { out.textContent = 'The two PINs are different.'; out.className = 'adm-msg bad'; return; }
    const btn = $('button[type=submit]', f); btn.disabled = true;
    out.textContent = 'Saving…'; out.className = 'adm-msg';
    try {
      chk(await sb.auth.updateUser({ password: a }));
      end(); toast('PIN saved. Next time, sign in with your email and this PIN.');
    } catch (err) {
      out.textContent = /different from the old/i.test(err.message || '') ? 'That is already your PIN.'
        : /weak|at least/i.test(err.message || '') ? 'Supabase says that PIN is too weak. Try a longer one.' : friendly(err);
      out.className = 'adm-msg bad'; btn.disabled = false;
    }
  });
  d.showModal();
  f.a.focus();
}

function render() {
  $$('.adm-side__nav [data-tab]').forEach(t => {
    const on = t.dataset.tab === S.tab;
    t.classList.toggle('is-active', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  const n = S.requests.filter(r => r.status === 'new').length;
  const badge = $('#newCount'); badge.hidden = !n; badge.textContent = n;
  if (S.tab === 'requests') renderRequests(); else if (S.tab === 'pay') renderPay();
  else if (S.tab === 'promos') renderPromos(); else if (S.tab === 'reviews') renderReviews(); else renderShop();
}

/* ───────────────────────── requests ───────────────────────── */

async function loadRequests() {
  S.requests = chk(await sb.from('quote_requests').select('*').order('created_at', { ascending: false }).limit(500));
}

function renderRequests() {
  const counts = Object.fromEntries(STATUSES.map(s => [s, S.requests.filter(r => r.status === s).length]));
  const open = S.requests.filter(r => !['won', 'lost'].includes(r.status)).length;
  const q = S.q.toLowerCase();
  const list = S.requests
    .filter(r => S.filter === 'all' || (S.filter === 'open' ? !['won', 'lost'].includes(r.status) : r.status === S.filter))
    .filter(r => !q || [r.name, r.email, r.item, r.message, r.notes].some(v => String(v || '').toLowerCase().includes(q)));

  $('#main').innerHTML = `
    <div class="adm-head"><div><h1>Requests</h1>
      <p>Everything customers sent through the quote form and the designer, newest first.</p></div>
      <button class="btn btn--line btn--sm" id="reload">Refresh</button></div>
    <div class="adm-kpis">
      <div><b>${counts.new}</b><span>New, not answered</span></div>
      <div><b>${open}</b><span>Open (new, quoted, proofing)</span></div>
      <div><b>${counts.won}</b><span>Won</span></div>
      <div><b>${S.requests.filter(r => Date.now() - new Date(r.created_at) < 7 * 864e5).length}</b><span>Came in this week</span></div>
    </div>
    <div class="adm-tools">
      <div class="chips" role="group" aria-label="Show">
        ${[['open', 'Open', open], ['all', 'All', S.requests.length], ...STATUSES.map(s => [s, STATUS_LABEL[s], counts[s]])]
          .map(([k, l, c]) => `<button class="chip" data-f="${k}" aria-pressed="${S.filter === k}">${l}<span>${c}</span></button>`).join('')}
      </div>
      <input type="search" id="q" placeholder="Search name, email, message…" value="${esc(S.q)}" aria-label="Search requests">
    </div>
    ${list.length ? `<div class="req-list">${list.map(r => `
      <button class="req${r.status === 'new' ? ' is-new' : ''}" data-id="${r.id}">
        <span class="req__dot"></span>
        <span class="req__name">${esc(r.name)}</span>
        <span class="req__side"><span class="st st--${esc(r.status)}">${STATUS_LABEL[r.status] || esc(r.status)}</span><span>${when(r.created_at)}</span></span>
        <span class="req__meta">${esc(reqMeta(r))}</span>
      </button>`).join('')}</div>`
    : `<div class="adm-empty">${S.requests.length ? 'Nothing matches.' : 'No requests yet. When a customer sends the quote form, it appears here.'}</div>`}`;

  $('#reload').addEventListener('click', async () => {
    try { await loadRequests(); render(); toast('Up to date.'); } catch (e) { toast(friendly(e), true); }
  });
  $$('.chip[data-f]').forEach(c => c.addEventListener('click', () => { S.filter = c.dataset.f; renderRequests(); }));
  const qIn = $('#q');
  qIn.addEventListener('input', () => {
    S.q = qIn.value; const pos = qIn.selectionStart;
    renderRequests(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos);
  });
  $$('.req').forEach(b => b.addEventListener('click', () => openRequest(S.requests.find(r => String(r.id) === b.dataset.id))));
}

const orderCode = r => (/^[0-9a-f-]{36}$/.test(r?.ref || '') ? 'TA-' + r.ref.slice(0, 8).toUpperCase() : null);
const reqMeta = r => {
  const sh = orderSheet(r.message), cut = SHAPES[r.design?.shape]?.label;
  return [orderCode(r), r.item, r.qty ? `${r.qty} pcs` : '', r.design ? `3D design${cut ? `: ${cut}` : ''}` : '',
    (sh ? sh.own : r.message || '').split('\n')[0]].filter(Boolean).join(' · ');
};

function openRequest(r) {
  if (!r) return;
  const d = r.design && typeof r.design === 'object' ? { ...r.design } : null;
  if (d?.shape === 'custom' && !validOutline(d.outline)) delete d.outline;   // only plain path data is drawn
  const est = d ? autoPrice(d) : null;
  const sheet = orderSheet(r.message);
  // a photo still to come: flagged on newer requests, only written in older ones
  const photoRow = sheet?.sections.flatMap(x => x.rows).find(([k]) => k === 'Photo');
  const sameOrder = r.ref ? S.requests.filter(x => x.ref === r.ref).length : 0;
  const photoComing = !!(d && (d.photo || /TO BE SENT/.test(photoRow?.[1] || '')));
  const dlg = document.createElement('dialog');
  dlg.className = 'adm-dlg';
  dlg.innerHTML = `<form method="dialog">
    <div class="dlg-h"><div><h2>${esc(r.name)}</h2><p>Sent ${esc(fullDate(r.created_at))}${r.page ? ` · from ${esc(r.page)}` : ''}</p></div>
      <button class="dlg-x" value="close" aria-label="Close">×</button></div>
    <div class="dlg-b">
      <div class="two">
        <div style="display:grid;gap:16px;align-content:start">
          <div><p class="sec-t">Customer</p>
            <dl class="kv">
              ${orderCode(r) ? `<dt>Order</dt><dd><b>${orderCode(r)}</b>${sameOrder > 1 ? ` · one of ${sameOrder} trophies in it` : ''}</dd>` : ''}
              <dt>Email</dt><dd><a href="mailto:${esc(r.email)}?subject=${encodeURIComponent('Your Tala Artisan trophy proof')}" style="color:var(--brass)">${esc(r.email)}</a></dd>
              ${r.phone ? `<dt>Mobile</dt><dd><a href="tel:${esc(r.phone.replace(/[^\d+]/g, ''))}" style="color:var(--brass)">${esc(r.phone)}</a></dd>` : ''}
              ${r.delivery ? `<dt>${r.delivery === 'pickup' ? 'Gets it' : 'Ship to'}</dt><dd>${r.delivery === 'pickup' ? 'Picks up at the studio in Gloria' : esc(r.address || '—')}</dd>` : ''}
              <dt>Wants</dt><dd>${esc(r.item || '—')}</dd>
              <dt>How many</dt><dd>${esc(r.qty ?? '—')}</dd>
              ${est != null ? `<dt>Estimate</dt><dd>${peso(est)} each at the site's current prices</dd>` : ''}
            </dl></div>
          ${sheet ? `${sheet.own ? `<div><p class="sec-t">Their message</p><div class="msg-box">${esc(sheet.own)}</div></div>` : ''}
            <div><p class="sec-t">Order sheet</p><div class="sheet">${sheetHtml(sheet)}</div></div>`
          : r.message ? `<div><p class="sec-t">Message</p><div class="msg-box">${esc(r.message)}</div></div>` : ''}
          ${r.pricing && typeof r.pricing === 'object' ? `<div><p class="sec-t">Order totals${sameOrder > 1 ? ` (all ${sameOrder} trophies)` : ''}</p><dl class="kv">
            <dt>Trophies</dt><dd>${peso(+r.pricing.merch || 0)}</dd>
            <dt>Shipping</dt><dd>${+r.pricing.shipping ? peso(+r.pricing.shipping) : 'Free'}${ZONES[r.pricing.zone] ? ` · ${esc(ZONES[r.pricing.zone].label)}` : ''}</dd>
            ${+r.pricing.discount ? `<dt>Promos</dt><dd>−${peso(+r.pricing.discount)}${r.pricing.voucher ? ` · ${esc(r.pricing.voucher)}` : ''}${Array.isArray(r.pricing.promos) && r.pricing.promos.length ? `<br><small>${esc(r.pricing.promos.join(' · '))}</small>` : ''}</dd>` : ''}
            <dt>Total</dt><dd><b>${peso(+r.pricing.total || 0)}</b></dd>
            <dt>Pays by</dt><dd>${esc(PAYMENTS[r.pricing.payment]?.label || r.pricing.payment || '—')}${+r.pricing.deposit_percent >= 100 ? ` · the whole ${peso(+r.pricing.deposit)} when ordering` : +r.pricing.deposit ? ` · down payment ${peso(+r.pricing.deposit)} (${+r.pricing.deposit_percent}%)` : ''}</dd>
          </dl></div>` : ''}
          ${r.status === 'won' && orderCode(r) ? `<p class="stk__size">Rating link for the customer: <a href="cart.html?rate=${esc(r.ref)}" target="_blank" rel="noopener" style="color:var(--brass)">cart.html?rate=…</a>
            <button class="adm-link" type="button" id="copyRate">Copy</button></p>` : ''}
          <div id="receipt" hidden></div>
          <div class="fld-row">
            <label class="fld">Status<select name="status">${STATUSES.map(s => `<option value="${s}"${s === r.status ? ' selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select></label>
          </div>
          <label class="fld">Notes for the shop<textarea name="notes" maxlength="4000" placeholder="Proof sent on…, price agreed, pickup date…">${esc(r.notes || '')}</textarea>
            <small>Only staff see these.</small></label>
        </div>
        <div>${d ? `<p class="sec-t">Their design</p><div class="v3d" id="v3d"></div>
            <div class="stk" id="stk" hidden></div>
            ${sheet ? '' : `<dl class="kv" style="margin-top:12px">${specRows(d).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`}`
          : `<p class="sec-t">Their design</p><div class="adm-empty" style="padding:28px 18px">Sent from the quote form without a 3D design.</div>`}
        </div>
      </div>
    </div>
    <div class="dlg-f">
      <button class="btn btn--line btn--sm btn-danger" type="button" id="del">Delete</button>
      ${canBuild(d) && d.shape !== 'custom' ? '<button class="btn btn--line btn--sm" type="button" id="toShop">Add this design to the shop</button>' : ''}
      <span class="grow"></span>
      <button class="btn btn--line btn--sm" value="close">Close</button>
      <button class="btn btn--solid btn--sm" type="submit" value="save" id="save">Save</button>
    </div></form>`;
  document.body.append(dlg);
  let dispose = () => {};
  const close = () => { dispose(); if (dlg.open) dlg.close(); dlg.remove(); };
  dlg.addEventListener('close', close);
  dlg.showModal();
  if (orderCode(r)) showReceipt($('#receipt', dlg), r.ref);
  $('#copyRate', dlg)?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(new URL(`cart.html?rate=${r.ref}`, location.href).href); toast('Rating link copied. Send it to the customer.'); }
    catch { toast('Could not copy. Right-click the link and copy it.', true); }
  });
  if (d) {
    dispose = mount3D($('#v3d', dlg), d);
    const who = r.name ? `Order for ${r.name}` : 'Order';
    const opts = {
      photo: photoComing,
      onDesign: dd => { dispose(); dispose = mount3D($('#v3d', dlg), dd); },   // their photo or picture, on the 3D
    };
    if (!requestPaths(d).length) mountSticker($('#stk', dlg), d, who, opts);
    else requestFiles(d).then(got => {     // the pictures they sent: on the 3D and in the prints
      if (!dlg.isConnected) return;
      opts.got = got;
      if (got.picture || got.photo) opts.onDesign(withFiles(d, got));
      mountSticker($('#stk', dlg), d, who, opts);
    });
  }

  $('form', dlg).addEventListener('submit', async e => {
    e.preventDefault();
    if (e.submitter?.value !== 'save') return close();
    const f = e.target, btn = $('#save', dlg);
    btn.disabled = true;
    try {
      const fields = { status: f.status.value, notes: f.notes.value.trim() || null, updated_at: new Date().toISOString() };
      chk(await sb.from('quote_requests').update(fields).eq('id', r.id));
      Object.assign(r, fields);
      close(); render(); toast('Saved.');
    } catch (err) { toast(friendly(err), true); btn.disabled = false; }
  });
  $('#del', dlg).addEventListener('click', async () => {
    if (!await confirmBox('Delete this request?', `${r.name}'s request will be removed for good. Mark it Lost instead if you may want it later.`)) return;
    try {
      chk(await sb.from('quote_requests').delete().eq('id', r.id));
      // its pictures go with it
      if (requestPaths(d).length) await sb.storage.from(ART_BUCKET).remove(requestPaths(d)).catch(() => {});
      S.requests = S.requests.filter(x => x.id !== r.id);
      close(); render(); toast('Request deleted.');
    } catch (err) { toast(friendly(err), true); }
  });
  $('#toShop', dlg)?.addEventListener('click', () => {
    const design = { ...d };
    for (const k of ['qty', 'speed', 'zone', 'payment', 'needBy', 'logo', 'extraSticker', 'place']) delete design[k];
    close(); S.tab = 'shop'; render();
    openItem({ id: null, name: '', line: '', category: 'Trophy', price: null, design, images: [], published: false, sort: 100 });
  });
}

/* ───────────────────────── shop trophies ───────────────────────── */

/* The trophy photos the owner made from the designs, served with the site
   (assets/img/products, listed in products.json): a shop card's photo, or a
   designer trophy (`key`) that goes into the shop with its photo. */
let PRODUCTS = null;

/* The shop's payment details (shop_settings, supabase/delivery-payment.sql).
   Missing until that script has been run: the deck still opens. */
async function loadSettings() {
  try { S.settings = chk(await sb.from('shop_settings').select('*').eq('id', 'shop').maybeSingle()); }
  catch { S.settings = null; }
}

/* Payment details: what the order page shows a customer once they place an
   order -- where to send the full amount (owner, 5 Nov: "instead of 50
   percent down payment make it like full payment"): the bank's details, or
   the GCash / Maya number with its QR beside the receipt button. The QR is
   saved in the public photo bucket at a fixed place, pay/<gcash|maya>-qr.png;
   updated_at moves with every change, and the order page asks for the QR by
   it, so a new QR is never hidden behind an old copy. */
const QR_PATH = k => `pay/${k}-qr.png`;
/* the QR as a PNG: crisp edges (no JPEG blur), on white, at most 1600 px, a
   file every phone's gallery and every wallet's "upload a QR" opens */
async function qrPng(file) {
  if (!/^image\//.test(file.type)) throw new Error('That needs to be a picture of your QR.');
  const src = URL.createObjectURL(file);
  try {
    // load, not decode(): decode() can wait for ever in some embedded browsers
    const img = await new Promise((ok, bad) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = bad;
      im.src = src;
    });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    const png = await new Promise(r => c.toBlob(r, 'image/png'));
    if (!png) throw new Error('Could not read that picture. Try a screenshot of the QR.');
    return png;
  } catch (err) {
    throw err instanceof Error && /QR|picture/.test(err.message) ? err : new Error('Could not read that picture. Try a screenshot of the QR.');
  } finally { URL.revokeObjectURL(src); }
}
function renderPay() {
  const st = S.settings;
  if (!st) {
    $('#main').innerHTML = `<div class="adm-head"><div><h1>Payment details</h1></div></div>
      <div class="adm-empty">The database is missing the payment settings. Run supabase/delivery-payment.sql in the Supabase SQL editor.</div>`;
    return;
  }
  const v = k => esc(st[k] ?? '');
  const qrBox = (k, app) => `<div class="fld qr-fld" data-qr="${k}"><span>${app} QR</span>
        <div class="qr-row"><div class="qr-slot"><span class="qr-none">No QR yet</span></div>
          <div class="qr-btns"><label class="btn btn--line btn--sm">Upload your QR<input type="file" accept="image/*" hidden></label>
            <button class="btn btn--line btn--sm" type="button" data-qr-del hidden>Remove</button></div></div>
        <small>The QR you save from your ${app} app. Customers who pay by ${app} see it beside the button for their receipt, and can scan it or save it.</small></div>`;
  $('#main').innerHTML = `
    <div class="adm-head"><div><h1>Payment details</h1>
      <p>Customers see these right after they place an order, with the full amount to pay and their order number.
        Fill in only the ways you take. Leave a number empty to hide that way.</p></div></div>
    <form class="pay-form" id="payForm" novalidate>
      <fieldset><legend>GCash</legend>
        <label class="fld">Account name<input name="gcash_name" maxlength="80" value="${v('gcash_name')}" placeholder="e.g. Juan D."></label>
        <label class="fld">GCash number<input name="gcash_number" inputmode="tel" maxlength="20" value="${v('gcash_number')}" placeholder="0917 123 4567"></label>
        ${qrBox('gcash', 'GCash')}
      </fieldset>
      <fieldset><legend>Maya</legend>
        <label class="fld">Account name<input name="maya_name" maxlength="80" value="${v('maya_name')}"></label>
        <label class="fld">Maya number<input name="maya_number" inputmode="tel" maxlength="20" value="${v('maya_number')}" placeholder="0918 123 4567"></label>
        ${qrBox('maya', 'Maya')}
      </fieldset>
      <fieldset><legend>Bank transfer</legend>
        <label class="fld">Bank<input name="bank_name" maxlength="80" value="${v('bank_name')}" placeholder="e.g. BDO, BPI, Landbank"></label>
        <label class="fld">Account name<input name="bank_account_name" maxlength="80" value="${v('bank_account_name')}"></label>
        <label class="fld">Account number<input name="bank_account_number" inputmode="numeric" maxlength="34" value="${v('bank_account_number')}"></label>
      </fieldset>
      <fieldset><legend>For customers</legend>
        <label class="fld qr-fld">A line under your details (optional)<input name="pay_note" maxlength="300" value="${v('pay_note')}" placeholder="e.g. We confirm payments within the day.">
          <small>Customers pay the whole amount when they order (cash: on pickup, or on delivery within Oriental Mindoro).</small></label>
      </fieldset>
      <p class="adm-msg" id="payMsg" role="alert"></p>
      <button class="btn btn--solid btn--sm" type="submit">Save payment details</button>
    </form>`;
  const f = $('#payForm'), msg = $('#payMsg');

  // the QRs: which are up (staff may list the bucket), upload one, remove one
  const qrUrl = k => `${sb.storage.from(BUCKET).getPublicUrl(QR_PATH(k)).data.publicUrl}?v=${encodeURIComponent(S.settings.updated_at || '')}`;
  const showQr = (k, on) => {
    const box = $(`[data-qr="${k}"]`, f);
    $('.qr-slot', box).innerHTML = on ? `<img src="${esc(qrUrl(k))}" alt="Your ${k === 'gcash' ? 'GCash' : 'Maya'} QR">` : '<span class="qr-none">No QR yet</span>';
    $('[data-qr-del]', box).hidden = !on;
  };
  const touch = async () => {                       // a new updated_at: the order page asks for the new QR
    const at = new Date().toISOString();
    chk(await sb.from('shop_settings').update({ updated_at: at }).eq('id', 'shop'));
    S.settings.updated_at = at;
  };
  sb.storage.from(BUCKET).list('pay').then(({ data }) => {
    const up = new Set((data || []).map(x => x.name));
    for (const k of ['gcash', 'maya']) showQr(k, up.has(`${k}-qr.png`));
  }).catch(() => {});
  for (const k of ['gcash', 'maya']) {
    const box = $(`[data-qr="${k}"]`, f), app = k === 'gcash' ? 'GCash' : 'Maya';
    $('input[type=file]', box).addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      msg.textContent = `Saving your ${app} QR…`; msg.className = 'adm-msg';
      try {
        const png = await qrPng(file);
        chk(await sb.storage.from(BUCKET).upload(QR_PATH(k), png, { contentType: 'image/png', cacheControl: '300', upsert: true }));
        await touch();
        showQr(k, true);
        msg.textContent = '';
        toast(`${app} QR saved. Customers who pay by ${app} see it now.`);
      } catch (err) { msg.textContent = friendly(err); msg.className = 'adm-msg bad'; }
    });
    $('[data-qr-del]', box).addEventListener('click', async () => {
      if (!await confirmBox(`Remove your ${app} QR?`, `Customers who pay by ${app} will see your number only.`, 'Remove')) return;
      try {
        chk(await sb.storage.from(BUCKET).remove([QR_PATH(k)]));
        await touch();
        showQr(k, false);
        toast(`${app} QR removed.`);
      } catch (err) { msg.textContent = friendly(err); msg.className = 'adm-msg bad'; }
    });
  }

  /* Saving (owner, 6 Nov: "the infos are not saving" -- typed in, nothing in the
     database). An update the database's rules turn away changes no row and
     reports no error, so the deck used to say "saved" anyway: now the row comes
     back with the answer, and no row is said plainly. Each detail saves as soon
     as its box is left (the button too), and the status stays on the page. */
  const btn = $('button[type=submit]', f);
  let dirty = false, saving = null;
  const say = (text, kind = '') => { msg.textContent = text; msg.className = `adm-msg${kind ? ' ' + kind : ''}`; };
  async function save() {
    const val = k => f[k].value.trim() || null;
    const fields = {
      gcash_name: val('gcash_name'), gcash_number: val('gcash_number'), maya_name: val('maya_name'), maya_number: val('maya_number'),
      bank_name: val('bank_name'), bank_account_name: val('bank_account_name'), bank_account_number: val('bank_account_number'),
      pay_note: val('pay_note'), updated_at: new Date().toISOString(),
    };
    const bad = [['gcash_number', /^[0-9 +()-]{7,20}$/, 'the GCash number'], ['maya_number', /^[0-9 +()-]{7,20}$/, 'the Maya number'],
      ['bank_account_number', /^[0-9 -]{4,34}$/, 'the account number']].find(([k, re]) => fields[k] && !re.test(fields[k]));
    if (bad) { say(`Not saved: ${bad[2]} should be numbers only (spaces and dashes are fine).`, 'bad'); return false; }
    btn.disabled = true;
    dirty = false;
    say('Saving…');
    try {
      const rows = chk(await sb.from('shop_settings').update(fields).eq('id', 'shop').select('id'));
      if (!rows?.length) {
        throw new Error('Not saved: the database did not let this sign-in change the payment details. '
          + 'Sign out (bottom of the menu), sign in again, and save once more. If it still will not save, send me a screenshot of this.');
      }
      Object.assign(S.settings, fields);
      say(`Saved at ${new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}. Customers see these on the order page now.`, 'ok');
      return true;
    } catch (err) {
      dirty = true;
      console.warn('[tala] payment details not saved:', err);
      say(err.message?.startsWith('Not saved') ? err.message : `Not saved: ${friendly(err)}`, 'bad');
      return false;
    } finally { btn.disabled = false; }
  }
  const run = () => (saving = (saving || Promise.resolve()).then(save));   // one save at a time, in order
  f.addEventListener('input', e => { if (e.target.type !== 'file') { dirty = true; say('Not saved yet: it saves when you leave the box, or press Save.'); } });
  f.addEventListener('change', e => { if (e.target.type !== 'file' && dirty) run(); });
  f.addEventListener('submit', e => { e.preventDefault(); run(); });
  // closing the page with something typed and not saved asks first
  const leaving = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', leaving);
  const stop = new MutationObserver(() => { if (!f.isConnected) { window.removeEventListener('beforeunload', leaving); stop.disconnect(); } });
  stop.observe($('#main'), { childList: true });
}

/* Promos (supabase/orders.sql): the owner asked to "edit each trophy with
   discounts ... 50 percent off ... or buy 1 take 1", and for Shopee's shop
   vouchers, bundle deals and promo codes. Missing until that script has run. */
async function loadPromos() {
  try { S.promos = chk(await sb.from('promos').select('*').order('created_at', { ascending: false })); }
  catch { S.promos = null; }
}
async function loadReviews() {
  try { S.reviews = chk(await sb.from('reviews').select('*').order('created_at', { ascending: false }).limit(300)); }
  catch { S.reviews = null; }
}

// what a promo is, from its fields
const PROMO_TYPES = {
  trophy: 'Discount on trophies',
  b1t1: 'Buy 1 Take 1',
  bundle: 'Bundle deal',
  voucher: 'Shop voucher',
  code: 'Promo code',
};
const promoType = p => (p.auto ? (p.kind === 'b1t1' ? 'b1t1' : p.min_qty ? 'bundle' : 'trophy') : p.listed ? 'voucher' : 'code');
const promoWhat = p => p.kind === 'b1t1' ? 'Buy 1 Take 1' : p.kind === 'percent' ? `${+p.value}% off` : `${peso(+p.value)} off`;
const shapeNames = list => (list && list.length ? list.map(k => SHAPES[k]?.label || k).join(', ') : 'All trophies');
// a date as the owner's calendar has it (local, not UTC: in Manila a UTC date is a day early before 8 am)
const dayOf = t => { if (!t) return ''; const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// a promo ends at midnight after its last day: the day shown is the last one it runs
const lastDay = t => (t ? dayOf(new Date(t).getTime() - 1) : '');

function renderPromos() {
  if (!S.promos) {
    $('#main').innerHTML = `<div class="adm-head"><div><h1>Promos</h1></div></div>
      <div class="adm-empty">The database is missing the promos. Run supabase/orders.sql in the Supabase SQL editor.</div>`;
    return;
  }
  const now = Date.now();
  const state = p => !p.active ? ['Off', 'st--lost'] : p.ends_at && new Date(p.ends_at) <= now ? ['Ended', 'st--lost']
    : p.starts_at && new Date(p.starts_at) > now ? ['Starts ' + dayOf(p.starts_at), 'st--quoted'] : ['On', 'st--won'];
  const st = S.settings;
  $('#main').innerHTML = `
    <div class="adm-head"><div><h1>Promos</h1>
      <p>Discounts the cart applies by itself, shop vouchers customers claim, bundle deals and promo codes. A customer gets the automatic ones, plus one voucher or code.</p></div>
      <button class="btn btn--solid btn--sm" id="newPromo">+ New promo</button></div>
    ${S.promos.length ? `<div class="promo-list">${S.promos.map(p => {
      const [label, cls] = state(p);
      return `<button class="promo-row" data-id="${esc(p.id)}">
        <span class="promo-row__what"><b>${esc(promoWhat(p))}</b> ${p.min_qty ? `· any ${p.min_qty} pieces` : ''}${p.min_spend ? ` · min. spend ${peso(+p.min_spend)}` : ''}
          <small>${esc(PROMO_TYPES[promoType(p)])}${p.code ? ` · code <code>${esc(p.code)}</code>` : ''} · ${esc(shapeNames(p.shapes))}${p.ends_at ? ` · until ${esc(lastDay(p.ends_at))}` : ''}</small></span>
        <span class="st ${cls}">${esc(label)}</span></button>`;
    }).join('')}</div>` : '<div class="adm-empty">No promos yet. Add the first one, or set one on a trophy in Shop trophies.</div>'}
    ${st ? `<form class="pay-form" id="shareForm" novalidate style="margin-top:26px"><fieldset><legend>Share voucher</legend>
      <label class="fld">Discount for sharing<select name="share_percent">${[0, 5, 10, 15, 20].map(n => `<option value="${n}"${+st.share_percent === n ? ' selected' : ''}>${n ? `${n}% off their trophies` : 'Off — no share voucher'}</option>`).join('')}</select></label>
      <label class="fld">Friends who must open the link<select name="share_needed">${[2, 3, 5].map(n => `<option value="${n}"${+st.share_needed === n ? ' selected' : ''}>${n} friends</option>`).join('')}</select>
        <small>It works on trust: one person could open their own link in a few browsers. You see it on the order before you approve the proof.</small></label>
      </fieldset><button class="btn btn--solid btn--sm" type="submit">Save share voucher</button></form>` : ''}`;
  $('#newPromo').addEventListener('click', () => openPromo({ kind: 'percent', value: 10, auto: true, listed: false, active: true, shapes: null }));
  $$('.promo-row').forEach(b => b.addEventListener('click', () => openPromo(S.promos.find(p => p.id === b.dataset.id))));
  $('#shareForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fields = { share_percent: +e.target.share_percent.value, share_needed: +e.target.share_needed.value, updated_at: new Date().toISOString() };
    try { chk(await sb.from('shop_settings').update(fields).eq('id', 'shop')); Object.assign(S.settings, fields); toast('Share voucher saved.'); }
    catch (err) { toast(friendly(err), true); }
  });
}

// every trophy a promo can be set on, as checkboxes, grouped like the designer
const shapeChecks = picked => {
  const groups = {};
  for (const [k, v] of Object.entries(SHAPES)) if (k !== 'custom') (groups[v.group || 'Other'] ||= []).push([k, v.label]);
  return Object.entries(groups).map(([g, list]) => `<p class="sec-t" style="margin:10px 0 4px">${esc(g)}</p><div class="shape-checks">${list.map(([k, l]) =>
    `<label><input type="checkbox" name="shape" value="${esc(k)}"${picked?.includes(k) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</div>`).join('');
};

function openPromo(orig) {
  const p = { ...orig };
  const isNew = !p.id;
  const dlg = document.createElement('dialog');
  dlg.className = 'adm-dlg';
  dlg.innerHTML = `<form novalidate>
    <div class="dlg-h"><div><h2>${isNew ? 'New promo' : 'Promo'}</h2><p>Customers see it in the cart and at checkout.</p></div>
      <button class="dlg-x" type="button" value="close" aria-label="Close">×</button></div>
    <div class="dlg-b">
      <label class="fld">Kind<select name="type">${Object.entries(PROMO_TYPES).map(([k, l]) =>
        `<option value="${k}"${promoType(p) === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <small id="typeHelp"></small></label>
      <div class="fld-row" data-for="trophy bundle voucher code">
        <label class="fld">Off by<select name="unit"><option value="percent"${p.kind !== 'amount' ? ' selected' : ''}>Percent (%)</option><option value="amount"${p.kind === 'amount' ? ' selected' : ''}>Pesos (₱)</option></select></label>
        <label class="fld">How much<input name="value" type="number" min="1" step="1" value="${esc(+p.value || '')}" placeholder="e.g. 50"></label>
      </div>
      <div class="fld-row">
        <label class="fld" data-for="voucher code">Code<input name="code" maxlength="20" value="${esc(p.code || '')}" placeholder="e.g. FIESTA20" style="text-transform:uppercase"></label>
        <label class="fld" data-for="bundle">Any how many pieces<input name="min_qty" type="number" min="2" step="1" value="${esc(p.min_qty || '')}" placeholder="e.g. 3"></label>
        <label class="fld" data-for="voucher code">Minimum spend (₱)<input name="min_spend" type="number" min="0" step="1" value="${esc(p.min_spend ?? '')}" placeholder="optional"></label>
      </div>
      <div class="fld-row">
        <label class="fld">Starts<input name="starts_at" type="date" value="${esc(dayOf(p.starts_at))}"></label>
        <label class="fld">Last day<input name="ends_at" type="date" value="${esc(lastDay(p.ends_at))}"></label>
      </div>
      <label class="fld">The line customers see (optional)<input name="note" maxlength="140" value="${esc(p.note || '')}" placeholder="e.g. Fiesta sale: 50% off Gold Star"></label>
      <label class="fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="active"${p.active !== false ? ' checked' : ''} style="width:auto"> On</label>
      <div><p class="sec-t">Trophies</p><label class="fld" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="all"${!p.shapes || !p.shapes.length ? ' checked' : ''} style="width:auto"> All trophies</label>
        <div id="shapes"${!p.shapes || !p.shapes.length ? ' hidden' : ''}>${shapeChecks(p.shapes)}</div></div>
      <p class="adm-msg" id="promoMsg" role="alert"></p>
    </div>
    <div class="dlg-f">${isNew ? '' : '<button class="btn btn--line btn--sm btn-danger" type="button" id="delPromo">Delete</button>'}
      <span class="grow"></span><button class="btn btn--line btn--sm" type="button" value="close">Cancel</button>
      <button class="btn btn--solid btn--sm" type="submit">Save promo</button></div></form>`;
  document.body.append(dlg);
  const f = $('form', dlg), msg = $('#promoMsg', dlg);
  const HELP = {
    trophy: 'Everyone gets it on the trophies you pick, e.g. 50% off the Gold Star. No code needed.',
    b1t1: 'Every second piece of the trophies you pick is free. No code needed.',
    bundle: 'Everyone who orders this many pieces gets it, e.g. any 3 enjoy 2% off.',
    voucher: 'Shown in the cart for customers to claim, like Shopee\'s shop vouchers.',
    code: 'Secret: only customers who type the code get it.',
  };
  const sync = () => {
    const t = f.type.value;
    $$('[data-for]', dlg).forEach(el => { el.hidden = !el.dataset.for.split(' ').includes(t); });
    $('#typeHelp', dlg).textContent = HELP[t];
    $('#shapes', dlg).hidden = f.all.checked;
  };
  f.type.addEventListener('change', sync);
  f.all.addEventListener('change', sync);
  sync();
  const end = () => { if (dlg.open) dlg.close(); dlg.remove(); };
  $$('[value="close"]', dlg).forEach(b => b.addEventListener('click', end));
  dlg.addEventListener('cancel', e => { e.preventDefault(); end(); });
  $('#delPromo', dlg)?.addEventListener('click', async () => {
    if (!await confirmBox('Delete this promo?', 'Customers stop getting it straight away.')) return;
    try { chk(await sb.from('promos').delete().eq('id', p.id)); S.promos = S.promos.filter(x => x.id !== p.id); end(); render(); toast('Promo deleted.'); }
    catch (err) { toast(friendly(err), true); }
  });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const t = f.type.value;
    const shapes = f.all.checked ? null : $$('input[name=shape]:checked', dlg).map(c => c.value);
    const row = {
      kind: t === 'b1t1' ? 'b1t1' : f.unit.value,
      value: t === 'b1t1' ? 0 : +f.value.value,
      code: ['voucher', 'code'].includes(t) ? f.code.value.trim().toUpperCase() || null : null,
      min_qty: t === 'bundle' ? (+f.min_qty.value || null) : null,
      min_spend: ['voucher', 'code'].includes(t) && f.min_spend.value !== '' ? +f.min_spend.value : null,
      starts_at: f.starts_at.value ? new Date(f.starts_at.value + 'T00:00:00').toISOString() : null,
      ends_at: f.ends_at.value ? (e => { e.setDate(e.getDate() + 1); return e.toISOString(); })(new Date(f.ends_at.value + 'T00:00:00')) : null,
      note: f.note.value.trim() || null,
      active: f.active.checked,
      auto: ['trophy', 'b1t1', 'bundle'].includes(t),
      listed: t === 'voucher',
      shapes: shapes && shapes.length ? shapes : null,
    };
    const bad = row.kind !== 'b1t1' && !(row.value > 0) ? 'Say how much it takes off.'
      : row.kind === 'percent' && row.value > 90 ? 'Keep a percent at 90 or less.'
      : ['voucher', 'code'].includes(t) && !/^[A-Z0-9]{3,20}$/.test(row.code || '') ? 'A code is 3 to 20 letters and numbers.'
      : t === 'bundle' && !(row.min_qty >= 2) ? 'Say how many pieces make the bundle (2 or more).'
      : !f.all.checked && !row.shapes ? 'Tick the trophies it is for, or All trophies.'
      : row.ends_at && row.starts_at && row.ends_at <= row.starts_at ? 'It has to end after it starts.' : '';
    if (bad) { msg.textContent = bad; msg.className = 'adm-msg bad'; return; }
    try {
      const saved = isNew ? chk(await sb.from('promos').insert(row).select().single())
        : chk(await sb.from('promos').update(row).eq('id', p.id).select().single());
      S.promos = isNew ? [saved, ...S.promos] : S.promos.map(x => (x.id === p.id ? saved : x));
      end(); render(); toast('Promo saved. The cart uses it now.');
    } catch (err) {
      msg.textContent = /duplicate|unique/i.test(String(err.message)) ? 'That code is already used by another promo.' : friendly(err);
      msg.className = 'adm-msg bad';
    }
  });
  dlg.showModal();
}

/* The promo on one trophy, set right in its dialog: none, a percent off, or
   Buy 1 Take 1 -- an automatic promo for just that trophy. */
function mountTrophyPromo(box, shape) {
  if (!box) return;
  if (!S.promos || !shape || shape === 'custom') { box.hidden = true; return; }
  const own = S.promos.find(p => p.auto && !p.min_qty && p.shapes?.length === 1 && p.shapes[0] === shape);
  const kind = !own || !own.active ? 'none' : own.kind === 'b1t1' ? 'b1t1' : 'percent';
  box.hidden = false;
  box.innerHTML = `<p class="sec-t" style="margin-top:16px">Promo on this trophy</p>
    <div class="fld-row" style="align-items:flex-end">
      <label class="fld">Promo<select name="tpKind"><option value="none"${kind === 'none' ? ' selected' : ''}>None</option>
        <option value="percent"${kind === 'percent' ? ' selected' : ''}>A percent off</option><option value="b1t1"${kind === 'b1t1' ? ' selected' : ''}>Buy 1 Take 1</option></select></label>
      <label class="fld" data-pct${kind === 'percent' ? '' : ' hidden'}>Percent off<input name="tpPct" type="number" min="1" max="90" step="1" value="${own && own.kind === 'percent' ? +own.value : 50}"></label>
      <button class="btn btn--line btn--sm" type="button" data-tpsave>Save promo</button>
    </div>
    <small style="color:var(--mute);font-size:.78rem">Everyone gets it on this trophy, no code needed. More kinds, dates and vouchers are in Promos.</small>`;
  const sel = $('[name=tpKind]', box);
  sel.addEventListener('change', () => { $('[data-pct]', box).hidden = sel.value !== 'percent'; });
  $('[data-tpsave]', box).addEventListener('click', async () => {
    const k = sel.value, pct = +$('[name=tpPct]', box).value;
    if (k === 'percent' && !(pct >= 1 && pct <= 90)) return toast('Pick a percent from 1 to 90.', true);
    try {
      if (k === 'none') {
        if (own) chk(await sb.from('promos').update({ active: false }).eq('id', own.id));
        if (own) own.active = false;
      } else {
        const row = { kind: k, value: k === 'percent' ? pct : 0, auto: true, listed: false, active: true, shapes: [shape], code: null, min_qty: null,
          note: k === 'b1t1' ? 'Buy 1 Take 1' : `${pct}% off`, ends_at: own?.ends_at ?? null };
        const saved = own ? chk(await sb.from('promos').update(row).eq('id', own.id).select().single())
          : chk(await sb.from('promos').insert(row).select().single());
        S.promos = own ? S.promos.map(x => (x.id === own.id ? saved : x)) : [saved, ...S.promos];
      }
      toast(k === 'none' ? 'Promo off for this trophy.' : 'Promo saved. The cart uses it now.');
      mountTrophyPromo(box, shape);
    } catch (err) { toast(friendly(err), true); }
  });
}

/* Real ratings from customers, for each order they rated once it was done.
   Hide one and it leaves the site at once. */
function renderReviews() {
  if (!S.reviews) {
    $('#main').innerHTML = `<div class="adm-head"><div><h1>Ratings</h1></div></div>
      <div class="adm-empty">The database is missing the ratings. Run supabase/orders.sql in the Supabase SQL editor.</div>`;
    return;
  }
  $('#main').innerHTML = `
    <div class="adm-head"><div><h1>Ratings</h1>
      <p>Customers rate an order once you mark it Won. Send them its rating link from the request. Hidden ratings do not show on the site.</p></div></div>
    ${S.reviews.length ? `<div class="promo-list">${S.reviews.map(r => `<div class="promo-row" data-ref="${esc(r.ref)}">
        <span class="promo-row__what"><b>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</b> ${esc(r.name || '')}
          <small>${esc(shapeNames(r.shapes))} · ${esc(when(r.created_at))}</small>${r.comment ? `<span class="promo-row__c">${esc(r.comment)}</span>` : ''}</span>
        <button class="btn btn--line btn--sm" type="button" data-hide>${r.hidden ? 'Show it' : 'Hide it'}</button></div>`).join('')}</div>`
    : '<div class="adm-empty">No ratings yet.</div>'}`;
  $$('[data-hide]').forEach(b => b.addEventListener('click', async () => {
    const r = S.reviews.find(x => x.ref === b.closest('[data-ref]').dataset.ref);
    try { chk(await sb.from('reviews').update({ hidden: !r.hidden }).eq('ref', r.ref)); r.hidden = !r.hidden; renderReviews(); }
    catch (err) { toast(friendly(err), true); }
  }));
}

async function loadItems() {
  S.items = chk(await sb.from('shop_items').select('*').order('sort').order('name'));
  if (!PRODUCTS) {
    try { PRODUCTS = await fetch(new URL('../img/products/products.json', import.meta.url)).then(r => (r.ok ? r.json() : [])); }
    catch { PRODUCTS = []; }
  }
}

/* Photos not in the shop yet: one already on any item is done. */
const pendingPhotos = () => (PRODUCTS || []).filter(e => !S.items.some(i => i.images?.includes(e.photo))
  && (e.key ? !!SHAPES[e.key] : S.items.some(i => i.id === e.shop)));

async function importPhotos() {
  const todo = pendingPhotos();
  const own = e => (e.shop ? S.items.find(i => i.id === e.shop)
    : S.items.find(i => i.design?.shape === e.key && i.name === SHAPES[e.key].label));
  const fresh = todo.filter(e => !own(e)).length;
  const cards = todo.length - fresh;
  if (!await confirmBox(`Add ${todo.length} trophy photos to the shop?`,
    `${fresh} trophies go on the website with their photo${cards ? `, and ${cards} shop cards get theirs` : ''}. `
    + 'You can change the price, words or photos of any of them afterwards, or hide it.', 'Add them')) return;
  let sort = Math.max(0, ...S.items.map(i => i.sort ?? 0));
  const taken = new Set(S.items.map(i => i.id));
  const rows = [], updates = [];
  for (const e of todo) {
    const it = own(e);
    if (it) { updates.push([it.id, { images: [e.photo, ...(it.images || [])], ...(e.key ? { published: true } : {}) }]); continue; }
    const { id: _, ...row } = catalogItem(e.key);
    let id = slug(row.name);
    for (let n = 2; taken.has(id); n++) id = `${slug(row.name)}-${n}`;
    taken.add(id);
    rows.push({ ...row, id, images: [e.photo], published: true, sort: (sort += 10) });
  }
  try {
    if (rows.length) chk(await sb.from('shop_items').insert(rows));
    for (const [id, patch] of updates) chk(await sb.from('shop_items').update(patch).eq('id', id));
    toast(`Done: ${todo.length} photos are in the shop.`);
  } catch (err) { toast(friendly(err), true); }
  await loadItems(); render();
}

/* The trophies in the designer that are not in the shop yet, as the shop item
   each would start as: its own sheet and ink, sample wording, Medium on a black
   gold bar. The owner asked to see all of them here, not only the shop's
   handful; the ones already in the shop are in the list above. */
const CAT_GROUPS = ['Classic', 'Rounds', 'Stars', 'Curves', 'Figures'];
const catKeys = () => Object.keys(SHAPES).filter(k => k !== 'custom');
const inShop = k => S.items.filter(i => i.design?.shape === k);
function catalogItem(k) {
  const s = SHAPES[k];
  const material = MATERIALS[s.sheet] ? s.sheet : 'white';
  const design = { shape: k, variant: 0, material, size: 'm', baseKind: 'goldbar', baseFinish: 'black', decal: 'rect',
    scheme: s.ink || 'black', laminate: 'gloss', font: 'classic',
    org: 'Gloria Awards Night', title: 'Champion', name: 'Juan Dela Cruz', date: '2026' };
  return { id: null, name: s.label, category: 'Trophy', price: null, design, images: [], published: false,
    line: `${MATERIALS[material].label} · ${BASES.goldbar.label.toLowerCase()} base · ${SIZES.m.total} cm` };
}

const notInShop = () => catKeys().filter(k => !inShop(k).length);

function catalogHtml() {
  const keys = notInShop();
  if (!keys.length) return '';
  return `<div class="adm-head cat-head"><div><h2>Not in the shop yet</h2>
      <p>${keys.length} of the ${catKeys().length} trophies in the designer. Open one to give it a price and photos: it joins the shop list above, hidden until you switch it on.</p></div>
      <button class="btn btn--line btn--sm" id="addAll">Add all ${keys.length} (hidden)</button></div>
    ${CAT_GROUPS.map(g => {
      const ks = keys.filter(k => (SHAPES[k].group || 'Figures') === g);
      return ks.length ? `<p class="cat-g">${g}</p><div class="shop-grid">${ks.map(k => {
        const it = catalogItem(k), p = autoPrice(it.design);
        return `<button class="item" data-cat="${esc(k)}" data-id="cat-${esc(k)}">
          <div class="item__pic is-3d"><img data-3d src="${esc(stills.get(stillKey(it)) || 'assets/img/poster-hero.svg')}" alt=""></div>
          <div class="item__b"><div><h3>${esc(SHAPES[k].label)}</h3><p>${esc(it.line)}</p></div><b>${p != null ? peso(p) : '—'}</b></div>
        </button>`;
      }).join('')}</div>` : '';
    }).join('')}`;
}

async function addAllToShop() {
  const todo = notInShop();
  if (!await confirmBox(`Add ${todo.length} trophies to the shop?`,
    'They are added hidden: the website does not change until you open one and switch "Show on the website" on.', 'Add them')) return;
  let sort = S.items.at(-1)?.sort ?? 0;
  const taken = new Set(S.items.map(i => i.id));
  const rows = todo.map(k => {
    const { id: _, ...row } = catalogItem(k);
    let id = slug(row.name);
    for (let n = 2; taken.has(id); n++) id = `${slug(row.name)}-${n}`;
    taken.add(id);
    return { ...row, id, sort: (sort += 10) };
  });
  try {
    chk(await sb.from('shop_items').insert(rows));
    await loadItems(); render();
    toast(`Added ${rows.length} trophies, hidden. Give each a price and photos, then switch it on.`);
  } catch (err) { toast(friendly(err), true); }
}

function renderShop() {
  const pending = pendingPhotos().length;
  $('#main').innerHTML = `
    <div class="adm-head"><div><h1>Shop trophies</h1>
      <p>What the website's shop shows, in this order: the first 6 on the home page, the rest under "See all". Hidden ones stay here but not on the site.</p></div>
      ${pending ? `<button class="btn btn--line btn--sm" id="importPhotos">Add ${pending} trophy photos</button>` : ''}
      <button class="btn btn--solid btn--sm" id="add">+ Add a trophy</button></div>
    ${S.items.length ? `<div class="shop-grid">${S.items.map(it => {
      const p = it.price != null ? Number(it.price) : autoPrice(it.design);
      const pic = it.images?.find(safeImage);
      return `<button class="item" data-id="${esc(it.id)}">
        <div class="item__pic${pic ? '' : ' is-3d'}">${pic ? `<img src="${esc(pic)}" alt="" loading="lazy">`
          : canBuild(it.design) ? `<img data-3d src="${esc(stills.get(stillKey(it)) || 'assets/img/poster-hero.svg')}" alt="">` : 'No picture'}
          <span class="st ${it.published ? 'st--won' : 'st--hidden'}">${it.published ? 'On the site' : 'Hidden'}</span></div>
        <div class="item__b"><div><h3>${esc(it.name)}</h3><p>${esc(it.line || it.category)}</p></div><b>${p != null ? peso(p) : '—'}</b></div>
      </button>`;
    }).join('')}</div>`
    : '<div class="adm-empty">No trophies yet. Add the first one.</div>'}
    ${catalogHtml()}`;
  $('#add').addEventListener('click', () => openItem({ id: null, name: '', line: '', category: 'Trophy', price: null, design: null, images: [], published: true, sort: (S.items.at(-1)?.sort ?? 0) + 10 }));
  $$('.item:not([data-cat])').forEach(b => b.addEventListener('click', () => openItem(S.items.find(i => i.id === b.dataset.id))));
  $$('.item[data-cat]').forEach(b => b.addEventListener('click', () =>
    openItem({ ...catalogItem(b.dataset.cat), sort: (S.items.at(-1)?.sort ?? 0) + 10 })));
  $('#addAll')?.addEventListener('click', addAllToShop);
  $('#importPhotos')?.addEventListener('click', importPhotos);
  bakeStills([...S.items, ...notInShop().map(k => ({ ...catalogItem(k), id: `cat-${k}` }))]);
}

function openItem(orig) {
  const it = structuredClone(orig);
  const isNew = !it.id;
  const added = [];                     // photos uploaded in this dialog, removed again if it is cancelled
  const dlg = document.createElement('dialog');
  dlg.className = 'adm-dlg';
  dlg.innerHTML = `<form method="dialog" novalidate>
    <div class="dlg-h"><div><h2>${isNew ? 'Add a trophy' : esc(it.name)}</h2><p>${isNew ? 'It goes on the website when you save, if "Show on the website" is on.' : 'Changes show on the website as soon as you save.'}</p></div>
      <button class="dlg-x" value="close" aria-label="Close">×</button></div>
    <div class="dlg-b"><div class="two">
      <div style="display:grid;gap:14px;align-content:start">
        <label class="fld">Name<input name="name" maxlength="80" required value="${esc(it.name)}" placeholder="Pageant Lady"></label>
        <label class="fld">Short line<input name="line" maxlength="140" value="${esc(it.line)}" placeholder="Gold mirror · gold bar base · 28 cm"><small>Shown under the name on the shop card.</small></label>
        <div class="fld-row">
          <label class="fld">Kind<select name="category">${CATEGORIES.map(c => `<option${c === it.category ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
          <label class="fld">Price (₱)<input name="price" type="number" min="0" step="5" inputmode="numeric" value="${it.price ?? ''}"><small id="autoP"></small></label>
          <label class="fld">Order<input name="sort" type="number" step="1" value="${it.sort ?? 100}"><small>Smaller comes first.</small></label>
        </div>
        <label class="fld">Group<select name="group">${SHOP_GROUPS.map(g => `<option${g === shopGroup(it.design) ? ' selected' : ''}>${g}</option>`).join('')}</select>
          <small>Where it is sorted under "See all" on the website.</small></label>
        <label class="switch"><input type="checkbox" name="published"${it.published ? ' checked' : ''}> Show on the website</label>
        <div><p class="sec-t">Photos</p>
          <div class="photos" id="photos"></div>
          <input type="file" id="phIn" accept="image/jpeg,image/png,image/webp" multiple hidden>
          <small style="color:var(--mute);font-size:.78rem;display:block;margin-top:6px">The first photo is the one the shop shows. With no photo, the shop shows the 3D design.</small></div>
      </div>
      <div><p class="sec-t">3D design</p>
        <div class="v3d" id="v3d"></div>
        <div class="slide" id="slide" hidden>
          <label class="slide__row"><span>Left – right</span>
            <input type="range" min="-1" max="1" step="0.01" value="0" aria-label="Slide the piece along its base">
            <output>centred</output></label>
          <button class="btn btn--line btn--sm" type="button" id="slideMid">Center</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn btn--line btn--sm" type="button" id="fromPic">Make it from a picture</button>
          <button class="btn btn--line btn--sm" type="button" id="design">${it.design ? 'Change in the designer' : 'Design it in 3D'}</button>
          <button class="btn btn--line btn--sm" type="button" id="noDesign"${it.design ? '' : ' hidden'}>Remove design</button>
        </div>
        <div class="cutx" id="cutx"></div>
        <p class="adm-msg" id="dMsg" style="margin-top:8px;font-size:.8rem;color:var(--mute)" role="status"></p>
        <div id="trophyPromo" hidden></div>
        <div class="stk" id="stk" hidden></div>
      </div>
    </div></div>
    <div class="dlg-f">
      ${isNew ? '' : '<button class="btn btn--line btn--sm btn-danger" type="button" id="del">Delete</button>'}
      <span class="grow"></span>
      <button class="btn btn--line btn--sm" value="close">Cancel</button>
      <button class="btn btn--solid btn--sm" type="submit" value="save" id="save">Save</button>
    </div></form>`;
  document.body.append(dlg);
  const f = $('form', dlg);
  let dispose = () => {};
  let saved = false;
  // the group follows the design until the owner picks one
  let groupPicked = false;
  f.group.addEventListener('change', () => { groupPicked = true; });

  const showDesign = () => {
    if (!groupPicked) f.group.value = shopGroup(it.design);
    dispose();
    dispose = mount3D($('#v3d', dlg), it.design);
    // a picture-made trophy's print is its own cut-out picture
    const d = it.design;
    pictureOf(d).then(picture => {
      if (it.design === d) mountSticker($('#stk', dlg), d, f.name.value.trim() || it.name, picture ? { got: { picture, pictureBox: [0, 0, 1, 1] }, own: true } : {});
    });
    mountTrophyPromo($('#trophyPromo', dlg), it.design?.shape);
    $('#noDesign', dlg).hidden = !it.design;
    const fromPicture = it.design?.shape === 'custom';     // the designer does not take a picture cut from here
    $('#design', dlg).textContent = !it.design ? 'Design it in 3D' : fromPicture ? 'Design it in 3D instead' : 'Change in the designer';
    $('#fromPic', dlg).textContent = fromPicture ? 'Change the picture' : 'Make it from a picture';
    $('#slide', dlg).hidden = !fromPicture;
    if (fromPicture) showSlide(+it.design.shift || 0);
    const a = autoPrice(it.design);
    $('#autoP', dlg).textContent = a != null ? `Leave empty to use ${peso(a)} from the design.` : 'Leave empty to show "Ask for a price".';
  };
  /* "Left – right": a trophy made from a picture slides along its base (owner,
     6 Nov: "move it to side ... recenter the cut shape"); `shift` -1..1, saved
     with the design, 0 (Center) its feet in the middle. The 3D follows the bar. */
  const slideIn = $('#slide input', dlg), slideOut = $('#slide output', dlg);
  function showSlide(v) {
    slideIn.value = v;
    slideOut.textContent = Math.abs(v) < 0.01 ? 'centred' : `${Math.round(Math.abs(v) * 100)}% ${v < 0 ? 'left' : 'right'}`;
  }
  function setSlide(v) {
    if (it.design?.shape !== 'custom') return;
    const { shift: _, ...rest } = it.design;
    it.design = Math.abs(v) < 0.01 ? rest : { ...rest, shift: +v.toFixed(2) };
    showSlide(+it.design.shift || 0);
    dispose.update?.(it.design);
  }
  slideIn.addEventListener('input', () => setSlide(+slideIn.value));
  $('#slideMid', dlg).addEventListener('click', () => setSlide(0));
  const showPhotos = () => {
    const box = $('#photos', dlg);
    box.innerHTML = it.images.map((u, i) => `<div class="ph">${i === 0 ? '<span class="ph__cover">Shown</span>' : ''}
      <img src="${esc(u)}" alt="">
      <div class="ph__bar"><button type="button" data-mv="${i}" aria-label="Move earlier"${i ? '' : ' disabled'}>‹</button>
        <button type="button" data-rm="${i}" aria-label="Remove photo">✕</button>
        <button type="button" data-mv="${i + 1}" aria-label="Move later"${i < it.images.length - 1 ? '' : ' disabled'}>›</button></div></div>`).join('')
      + (it.images.length < MAX_PHOTOS ? '<button type="button" class="ph-add" id="phAdd">+ Add photos</button>' : '');
    $('#phAdd', dlg)?.addEventListener('click', () => $('#phIn', dlg).click());
    $$('[data-rm]', box).forEach(b => b.addEventListener('click', () => { it.images.splice(+b.dataset.rm, 1); showPhotos(); }));
    $$('[data-mv]', box).forEach(b => b.addEventListener('click', () => {
      const j = +b.dataset.mv; [it.images[j - 1], it.images[j]] = [it.images[j], it.images[j - 1]]; showPhotos();
    }));
  };

  $('#phIn', dlg).addEventListener('change', async e => {
    const files = [...e.target.files].slice(0, MAX_PHOTOS - it.images.length);
    e.target.value = '';
    const id = it.id || slug(f.name.value || 'trophy');
    for (const file of files) {
      try {
        toast(`Uploading ${file.name}…`);
        const url = await uploadPhoto(await resizeImage(file), id);
        it.images.push(url); added.push(url); showPhotos();
      } catch (err) { toast(friendly(err), true); }
    }
  });

  /* the designer hands its design back through localStorage (same site, another tab) */
  const onStorage = e => {
    if (e.key !== DESIGN_KEY || !e.newValue) return;
    try {
      const d = JSON.parse(e.newValue);
      if (!canBuild(d)) return;
      it.design = d; showDesign();
      $('#dMsg', dlg).textContent = 'Design received from the designer.';
      localStorage.removeItem(DESIGN_KEY);
    } catch { /* not ours */ }
  };
  window.addEventListener('storage', onStorage);
  /* "Make it from a picture", or a picture dropped in the box under it: cut out in
     cut-editor.js (base cut off, edited by hand), shown in 3D after every cut,
     stored when the trophy is saved */
  let showSoon = 0;
  const say = t => { $('#dMsg', dlg).textContent = t; };
  const editor = mountCutEditor($('#cutx', dlg), {
    heightCm: () => { const s = SIZES[it.design?.size] || SIZES.m; return s.total - s.baseH * 1.35; },
    say,
    onPicture: file => {
      if (!f.name.value.trim()) f.name.value = nameFromFile(file.name);
      if (!f.line.value.trim()) f.line.value = catalogItem('custom').line;
    },
    onCut: (r, pic) => {
      try { it.design = pictureDesign(pic.img, pic.c, r, it.design); }
      catch (err) { say(err.message); return; }
      clearTimeout(showSoon);
      showSoon = setTimeout(showDesign, 300);   // one 3D redraw after a run of quick edits
    },
  });
  $('#fromPic', dlg).addEventListener('click', () => editor.choose());

  $('#design', dlg).addEventListener('click', () => {
    try { localStorage.removeItem(DESIGN_KEY); } catch { /* ignore */ }
    const q = it.design && it.design.shape !== 'custom' ? '&from=' + encodeURIComponent(JSON.stringify(it.design)) : '';
    window.open(`design.html?admin=1${q}`, '_blank');
    $('#dMsg', dlg).textContent = 'Design it in the new tab, then press "Use in the Admin Deck" there. This window picks it up.';
  });
  $('#noDesign', dlg).addEventListener('click', () => { it.design = null; editor.clear(); clearTimeout(showSoon); showDesign(); });

  // every way out comes through here; the close event alone is not dependable
  // (Chrome can hold it back in a background tab), so it is only the Esc path
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    dispose(); window.removeEventListener('storage', onStorage);
    clearTimeout(showSoon); editor.destroy();
    if (!saved && added.length) deletePhotos(added).catch(() => {});
    if (dlg.open) dlg.close();
    dlg.remove();
  };
  dlg.addEventListener('close', finish);
  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (e.submitter?.value !== 'save') { finish(); return; }
    const name = f.name.value.trim();
    if (name.length < 2) { toast('Give the trophy a name.', true); f.name.focus(); return; }
    // a trophy just made from a picture: the cut-out picture is stored with it, the design names it
    const { cutArt: _, ...design } = it.design || {};
    const row = {
      name, line: f.line.value.trim(), category: f.category.value,
      price: f.price.value === '' ? null : Math.max(0, Number(f.price.value)),
      sort: Number.isFinite(+f.sort.value) ? Math.round(+f.sort.value) : 100,
      published: f.published.checked, design: it.design ? design : null, images: it.images,
    };
    if (row.published && !row.images.length && !row.design) { toast('Add a photo or a 3D design before showing it on the website.', true); return; }
    // the group goes with the design, kept only when it is not the shape's own
    if (row.design) {
      const { group: _g, ...rest } = row.design;
      row.design = f.group.value !== shopGroup(rest) && SHOP_GROUPS.includes(f.group.value) ? { ...rest, group: f.group.value } : rest;
    }
    const btn = $('#save', dlg); btn.disabled = true;
    try {
      if (it.design?.cutArt) {
        toast('Saving the picture…');
        row.design.cutUrl = await uploadArt(it.design.cutArt, it.id || slug(name));
        it.design = row.design;
      }
      if (isNew) {
        let id = slug(name);
        if (S.items.some(i => i.id === id)) id = `${id}-${Date.now().toString(36).slice(-4)}`;
        chk(await sb.from('shop_items').insert({ id, ...row }));
      } else {
        chk(await sb.from('shop_items').update(row).eq('id', it.id));
        const gone = (orig.images || []).filter(u => !row.images.includes(u));
        if (gone.length) await deletePhotos(gone);
      }
      saved = true;
      await loadItems();
      finish(); render();
      toast(row.published ? 'Saved — it is on the website.' : 'Saved (hidden from the website).');
    } catch (err) { toast(friendly(err), true); btn.disabled = false; }
  });
  $('#del', dlg)?.addEventListener('click', async () => {
    if (!await confirmBox('Delete this trophy?', `"${it.name}" and its photos will be removed for good. To take it off the website for a while, switch "Show on the website" off instead.`)) return;
    try {
      chk(await sb.from('shop_items').delete().eq('id', it.id));
      await deletePhotos([...(orig.images || []), ...added]);
      saved = true;
      S.items = S.items.filter(i => i.id !== it.id);
      finish(); render(); toast('Trophy deleted.');
    } catch (err) { toast(friendly(err), true); }
  });

  dlg.showModal();
  showPhotos(); showDesign();
}

/* ───────────────────────── start ───────────────────────── */

async function enter() {
  const { data: { session } } = await sb.auth.getSession();
  const why = new URLSearchParams(location.hash.slice(1)).get('error_description');
  // a Google or emailed-link sign-in comes back with tokens in the address; drop them
  if (/access_token|refresh_token|[?&]code=|error_description/.test(location.hash + location.search)) history.replaceState(null, '', backHere());
  if (!session && !why && !S.noDevice) {
    // no sign-in: this browser becomes a "device" with its own id, and sees
    // nothing until the owner approves it (it is added to public.admins)
    const { error } = await sb.auth.signInAnonymously();
    if (!error) return enter();
    S.noDevice = true;                     // anonymous sign-ins are off: fall back to email / PIN
  }
  if (!session) {
    const msg = why ? why.replace(/\+/g, ' ') : '';
    return signInScreen(/invalid or has expired/i.test(msg)
      ? 'That sign-in link was already used, or a newer email replaced it. If you are signed in on another device, you are fine there; to sign in here, send a new link and open it on this device.'
      : msg);
  }
  S.user = session.user;
  let staff;
  try { staff = chk(await sb.from('admins').select('user_id').eq('user_id', S.user.id).maybeSingle()); }
  catch (err) {
    if (/jwt|refresh token|session/i.test(String(err?.message))) return signInScreen('Your sign-in ran out. Sign in again with your email and PIN.');
    app.innerHTML = `<section class="adm-gate"><h1>Can't open the deck</h1><p>${esc(friendly(err))}</p></section>`; return;
  }
  if (!staff) return S.user.is_anonymous ? deviceScreen() : notStaffScreen(S.user.email);
  shell();
  $('#main').innerHTML = '<p class="adm-boot">Loading…</p>';
  try { await Promise.all([loadRequests(), loadItems(), loadSettings(), loadPromos(), loadReviews()]); }
  catch (err) { $('#main').innerHTML = `<div class="adm-empty">${esc(friendly(err))}</div>`; return; }
  render();
}

(async function start() {
  if (await stale()) { location.reload(); return; }
  if (!URL_ || !KEY) return setupScreen();
  if (!window.supabase?.createClient) {
    app.innerHTML = '<section class="adm-gate"><h1>Can’t load</h1><p>The sign-in library did not load. Check the internet connection and reload.</p></section>';
    return;
  }
  sb = window.supabase.createClient(URL_, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tala-admin' },
    global: { fetch: renewingFetch },
  });
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') signInScreen(); });
  await enter();
})();
