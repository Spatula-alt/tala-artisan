/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — Admin Deck
   Staff sign in to read quote requests and to run the website's shop.
   Everything is live Supabase: nothing here is faked or kept only in
   this browser. Requests come from the quote form; shop trophies are
   what the home page's shop grid shows.
   ══════════════════════════════════════════════════════════════ */
import { createViewer, webglAvailable } from './viewer.js?v=202610301919';
import {
  buildTrophy, disposeGroup, price, peso,
  SHAPES, MATERIALS, SIZES, BASES, BASE_FINISHES, SCHEMES, DECALS, LAMINATES,
  SPEEDS, ZONES, PAYMENTS, variantsOf,
} from './trophy.js?v=202610301919';

const C = window.TALA_CONFIG || {};
const URL_ = String(C.supabaseUrl || '').replace(/\/+$/, '');
const KEY = String(C.supabaseKey || '');
const BUCKET = 'trophy-photos';
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
const S = { user: null, tab: 'requests', requests: [], items: [], filter: 'open', q: '' };

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
    ['Size', SIZES[d.size] ? `${SIZES[d.size].label} · ${SIZES[d.size].total} cm` : null],
    ['Base', BASES[d.baseKind] ? `${BASES[d.baseKind].label} · ${BASE_FINISHES[d.baseFinish]?.label || ''}` : null],
    ['Sticker', SCHEMES[d.scheme] ? [SCHEMES[d.scheme].label, DECALS[d.decal]?.label, LAMINATES[d.laminate]?.label].filter(Boolean).join(' · ') : null],
    ['Wording', [d.org, d.title, d.name, d.date].filter(Boolean).join(' / ')],
  ];
  if (d.shape === 'custom') rows.push(['Cut', `From the customer's own picture${d.cutPrint ? ', picture printed on it' : ''}. Ask them to send the original file.`]);
  if (d.logo) rows.push(['Logo', 'Yes — ask for the file']);
  if (d.extraSticker) rows.push(['Extra sticker', 'Yes']);
  if (d.speed) rows.push(['Speed', SPEEDS[d.speed]?.label || d.speed]);
  if (d.zone) rows.push(['Delivery', ZONES[d.zone]?.label || d.zone]);
  if (d.payment) rows.push(['Payment', PAYMENTS[d.payment]?.label || d.payment]);
  if (d.needBy) rows.push(['Needed by', d.needBy]);
  return rows.filter(r => r[1]);
}
const canBuild = d => d && typeof d === 'object' && SHAPES[d.shape] && d.shape !== 'custom';
const autoPrice = d => { try { return canBuild(d) ? price({ ...d, qty: 1 }).unit : null; } catch { return null; } };

/* one live 3D view inside a dialog; returns a disposer */
function mount3D(box, design) {
  box.innerHTML = '';
  if (!canBuild(design)) {
    box.innerHTML = `<div class="v3d__empty">${design?.shape === 'custom'
      ? 'Cut from the customer’s own picture — the outline is not saved with the request. Ask them for the file.'
      : 'No 3D design.'}</div>`;
    return () => {};
  }
  if (!webglAvailable()) { box.innerHTML = '<div class="v3d__empty">This browser cannot show 3D.</div>'; return () => {}; }
  const canvas = document.createElement('canvas');
  box.append(canvas);
  const note = document.createElement('span');
  note.className = 'v3d__note'; note.textContent = 'Drag to turn';
  box.append(note);
  box.classList.toggle('is-light', design.material !== 'white' && design.material !== 'clear');
  const viewer = createViewer(canvas, { autoRotate: true, maxDpr: 2 });
  const model = buildTrophy(design);
  viewer.scene.add(model);
  viewer.frameObject(model);
  viewer.invalidate();
  let gone = false;                          // a dialog can close twice (button, then the close event)
  return () => { if (gone) return; gone = true; viewer.scene.remove(model); disposeGroup(model); viewer.dispose(); };
}

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
  if (S.tab === 'requests') renderRequests(); else renderShop();
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
        <span class="req__meta">${esc([r.item, r.qty ? `${r.qty} pcs` : '', r.design ? '3D design' : '', (r.message || '').split('\n')[0]].filter(Boolean).join(' · '))}</span>
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

function openRequest(r) {
  if (!r) return;
  const d = r.design && typeof r.design === 'object' ? r.design : null;
  const est = d ? autoPrice(d) : null;
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
              <dt>Email</dt><dd><a href="mailto:${esc(r.email)}?subject=${encodeURIComponent('Your Tala Artisan trophy proof')}" style="color:var(--brass)">${esc(r.email)}</a></dd>
              <dt>Wants</dt><dd>${esc(r.item || '—')}</dd>
              <dt>How many</dt><dd>${esc(r.qty ?? '—')}</dd>
              ${est != null ? `<dt>Estimate</dt><dd>${peso(est)} each at the site's current prices</dd>` : ''}
            </dl></div>
          ${r.message ? `<div><p class="sec-t">Message</p><div class="msg-box">${esc(r.message)}</div></div>` : ''}
          <div class="fld-row">
            <label class="fld">Status<select name="status">${STATUSES.map(s => `<option value="${s}"${s === r.status ? ' selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select></label>
          </div>
          <label class="fld">Notes for the shop<textarea name="notes" maxlength="4000" placeholder="Proof sent on…, price agreed, pickup date…">${esc(r.notes || '')}</textarea>
            <small>Only staff see these.</small></label>
        </div>
        <div>${d ? `<p class="sec-t">Their design</p><div class="v3d" id="v3d"></div>
            <dl class="kv" style="margin-top:12px">${specRows(d).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`
          : `<p class="sec-t">Their design</p><div class="adm-empty" style="padding:28px 18px">Sent from the quote form without a 3D design.</div>`}
        </div>
      </div>
    </div>
    <div class="dlg-f">
      <button class="btn btn--line btn--sm btn-danger" type="button" id="del">Delete</button>
      ${canBuild(d) ? '<button class="btn btn--line btn--sm" type="button" id="toShop">Add this design to the shop</button>' : ''}
      <span class="grow"></span>
      <button class="btn btn--line btn--sm" value="close">Close</button>
      <button class="btn btn--solid btn--sm" type="submit" value="save" id="save">Save</button>
    </div></form>`;
  document.body.append(dlg);
  let dispose = () => {};
  const close = () => { dispose(); if (dlg.open) dlg.close(); dlg.remove(); };
  dlg.addEventListener('close', close);
  dlg.showModal();
  if (d) dispose = mount3D($('#v3d', dlg), d);

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

async function loadItems() {
  S.items = chk(await sb.from('shop_items').select('*').order('sort').order('name'));
}

function renderShop() {
  $('#main').innerHTML = `
    <div class="adm-head"><div><h1>Shop trophies</h1>
      <p>What the website's shop shows, in this order. Hidden ones stay here but not on the site.</p></div>
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
    : '<div class="adm-empty">No trophies yet. Add the first one.</div>'}`;
  $('#add').addEventListener('click', () => openItem({ id: null, name: '', line: '', category: 'Trophy', price: null, design: null, images: [], published: true, sort: (S.items.at(-1)?.sort ?? 0) + 10 }));
  $$('.item').forEach(b => b.addEventListener('click', () => openItem(S.items.find(i => i.id === b.dataset.id))));
  bakeStills(S.items);
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
        <label class="switch"><input type="checkbox" name="published"${it.published ? ' checked' : ''}> Show on the website</label>
        <div><p class="sec-t">Photos</p>
          <div class="photos" id="photos"></div>
          <input type="file" id="phIn" accept="image/jpeg,image/png,image/webp" multiple hidden>
          <small style="color:var(--mute);font-size:.78rem;display:block;margin-top:6px">The first photo is the one the shop shows. With no photo, the shop shows the 3D design.</small></div>
      </div>
      <div><p class="sec-t">3D design</p>
        <div class="v3d" id="v3d"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn btn--line btn--sm" type="button" id="design">${it.design ? 'Change in the designer' : 'Design it in 3D'}</button>
          <button class="btn btn--line btn--sm" type="button" id="noDesign"${it.design ? '' : ' hidden'}>Remove design</button>
        </div>
        <p class="adm-msg" id="dMsg" style="margin-top:8px;font-size:.8rem;color:var(--mute)"></p>
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

  const showDesign = () => {
    dispose();
    dispose = mount3D($('#v3d', dlg), it.design);
    $('#noDesign', dlg).hidden = !it.design;
    $('#design', dlg).textContent = it.design ? 'Change in the designer' : 'Design it in 3D';
    const a = autoPrice(it.design);
    $('#autoP', dlg).textContent = a != null ? `Leave empty to use ${peso(a)} from the design.` : 'Leave empty to show "Ask for a price".';
  };
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
  $('#design', dlg).addEventListener('click', () => {
    try { localStorage.removeItem(DESIGN_KEY); } catch { /* ignore */ }
    const q = it.design ? '&from=' + encodeURIComponent(JSON.stringify(it.design)) : '';
    window.open(`design.html?admin=1${q}`, '_blank');
    $('#dMsg', dlg).textContent = 'Design it in the new tab, then press "Use in the Admin Deck" there. This window picks it up.';
  });
  $('#noDesign', dlg).addEventListener('click', () => { it.design = null; showDesign(); });

  // every way out comes through here; the close event alone is not dependable
  // (Chrome can hold it back in a background tab), so it is only the Esc path
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    dispose(); window.removeEventListener('storage', onStorage);
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
    const row = {
      name, line: f.line.value.trim(), category: f.category.value,
      price: f.price.value === '' ? null : Math.max(0, Number(f.price.value)),
      sort: Number.isFinite(+f.sort.value) ? Math.round(+f.sort.value) : 100,
      published: f.published.checked, design: it.design, images: it.images,
    };
    if (row.published && !row.images.length && !row.design) { toast('Add a photo or a 3D design before showing it on the website.', true); return; }
    const btn = $('#save', dlg); btn.disabled = true;
    try {
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
  catch (err) { app.innerHTML = `<section class="adm-gate"><h1>Can't open the deck</h1><p>${esc(friendly(err))}</p></section>`; return; }
  if (!staff) return S.user.is_anonymous ? deviceScreen() : notStaffScreen(S.user.email);
  shell();
  $('#main').innerHTML = '<p class="adm-boot">Loading…</p>';
  try { await Promise.all([loadRequests(), loadItems()]); }
  catch (err) { $('#main').innerHTML = `<div class="adm-empty">${esc(friendly(err))}</div>`; return; }
  render();
}

(async function start() {
  if (!URL_ || !KEY) return setupScreen();
  if (!window.supabase?.createClient) {
    app.innerHTML = '<section class="adm-gate"><h1>Can’t load</h1><p>The sign-in library did not load. Check the internet connection and reload.</p></section>';
    return;
  }
  sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tala-admin' } });
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') signInScreen(); });
  await enter();
})();
