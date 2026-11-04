/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — shared page behaviour
   Runs on both pages. No dependencies, no 3D.
   ══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ─── a page kept from before the last update reloads itself, once ───
     GitHub Pages lets a browser keep a page for 10 minutes, and a page that old runs the old code: the
     owner tested a fix twice in a page like that and saw none of it. bump-version.py writes version.json. */
  const build = new URL(document.currentScript?.src || location.href).searchParams.get('v');
  if (build) {
    fetch('version.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => {
      if (!j || !j.v || j.v === build || sessionStorage.getItem('tala.fresh') === j.v) return;
      sessionStorage.setItem('tala.fresh', j.v);     // once, so it can never loop
      location.reload();
    }).catch(() => { /* offline or private mode: carry on with this page */ });
  }

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* A staff sign-in link that Supabase sent to the site's front page (it does
     when the Admin Deck address is not on its allow list) still belongs to the
     Admin Deck: pass it on, tokens and all. */
  if (/(^|[#&])(access_token|error_description)=/.test(location.hash) && !/admin\.html$/.test(location.pathname)) {
    location.replace(location.pathname.replace(/[^/]*$/, '') + 'admin.html' + location.hash);
    return;
  }

  /* ─── Lottie, on demand ───
     The two animations (assets/anim/) were authored and checked frame by frame
     in the official Skottie player (../tala-artisan-motion). The site plays them
     with lottie-web's light build, and only fetches it when one is about to
     show, so pages that never need one pay nothing. */
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lottieLib = null;
  function loadLottie() {
    if (window.lottie) return Promise.resolve(window.lottie);
    if (lottieLib) return lottieLib;
    lottieLib = new Promise((ok, bad) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie_light.min.js';
      s.integrity = 'sha512-Pe5arL9TnWlLgXT1VY0d50tfo6J9bh0qM7irYJuACQcGz7mbIahBXZmNeav+46mTQBtPY170Vi89KDa4kd4QVg==';
      s.crossOrigin = 'anonymous';
      s.onload = () => ok(window.lottie); s.onerror = bad;
      document.head.append(s);
    });
    return lottieLib;
  }
  async function playLottie(el, name, loop) {
    const lottie = await loadLottie();
    const anim = lottie.loadAnimation({ container: el, renderer: 'svg', loop, autoplay: !calm,
                                        path: `assets/anim/${name}.json` });
    if (calm) anim.addEventListener('DOMLoaded', () => anim.goToAndStop(anim.totalFrames - 1, true));
    return anim;
  }

  /* ─── 3D loading star ───
     Shown over a 3D view that is ON SCREEN and still not live 600 ms later --
     that is, on a slow connection, while the 3D engine downloads. Views below
     the fold start only when scrolled near (home.js), so the clock starts when
     one becomes visible, not at page load. */
  function loadingStar(viz) {
    const box = document.createElement('div');
    box.className = 'viz__loader'; box.setAttribute('aria-hidden', 'true');
    viz.append(box);
    let anim = null;
    playLottie(box, 'loader', true).then(a => { anim = a; }).catch(() => box.remove());
    const done = () => { box.classList.add('is-gone'); setTimeout(() => { anim?.destroy(); box.remove(); }, 400); };
    new MutationObserver((_, mo) => {
      if (viz.classList.contains('is-live')) { mo.disconnect(); done(); }
    }).observe(viz, { attributes: true, attributeFilter: ['class'] });
  }
  if (!calm && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        setTimeout(() => { if (!e.target.classList.contains('is-live')) loadingStar(e.target); }, 600);
      }
    }, { threshold: 0.25 });
    for (const viz of $$('.viz')) if (viz.querySelector('canvas')) io.observe(viz);
  }

  /* ─── sticky header ─── */
  const nav = $('#nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('is-stuck', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ─── mobile menu ─── */
  const burger = $('#burger'), menu = $('#menu');
  if (burger && menu) {
    const set = open => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.classList.toggle('open', open);
    };
    burger.addEventListener('click', () => set(burger.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', e => { if (e.target.tagName === 'A') set(false); });
    addEventListener('keydown', e => {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { set(false); burger.focus(); }
    });
    matchMedia('(min-width: 721px)').addEventListener('change', e => { if (e.matches) set(false); });
  }

  /* ─── reveal on scroll ─── */
  const targets = $$('[data-rev]');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        obs.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    targets.forEach(el => io.observe(el));
  }

  /* ─── year ─── */
  const yr = $('#yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ─── arriving at the form (the designer's "Send this design to the studio") ───
     The shop above it loads its trophies after the page does and grows by more
     than a screen, so the form slid down past where the browser had jumped: the
     owner landed on "Tala means star" instead. Hold the form in place while the
     page settles, until the visitor scrolls, clicks or types themselves. */
  const quoteSec = location.hash === '#quote' && $('#quote');
  if (quoteSec && 'ResizeObserver' in window) {
    let held = true;
    const root = document.documentElement;
    root.style.scrollBehavior = 'auto';      // a smooth scroll still heading for the old spot would win
    const pad = () => parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    const align = () => {
      if (held) scrollTo({ top: quoteSec.getBoundingClientRect().top + scrollY - pad(), behavior: 'instant' });
    };
    const ro = new ResizeObserver(align);
    const release = () => { held = false; ro.disconnect(); root.style.scrollBehavior = ''; };
    ro.observe(document.body);
    addEventListener('load', align);
    for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(ev, release, { once: true, passive: true });
    setTimeout(release, 8000);
  }

  /* ─── the shop: the cart's count in the menu (cart.js keeps the cart) ─── */
  const cartCount = $('#cartCount');
  const countCart = () => {
    if (!cartCount) return;
    let n = 0;
    try { n = (JSON.parse(localStorage.getItem('tala.cart') || '[]') || []).length; } catch { /* private mode */ }
    cartCount.textContent = n;
    cartCount.hidden = !n;
  };
  countCart();
  addEventListener('storage', e => { if (e.key === 'tala.cart') countCart(); });
  addEventListener('tala:cart', countCart);

  const cfgT = window.TALA_CONFIG || {};
  const live = !!(cfgT.supabaseUrl && cfgT.supabaseKey);
  const base = String(cfgT.supabaseUrl || '').replace(/\/$/, '');
  const auth = { apikey: cfgT.supabaseKey, Authorization: `Bearer ${cfgT.supabaseKey}` };

  /* Someone opened a share link (cart.js makes them: ?ref=CODE). It counts
     toward the sharer's voucher, once per browser (share_visit, orders.sql). */
  const shareRef = new URLSearchParams(location.search).get('ref');
  if (live && shareRef && /^[A-Z0-9]{8}$/.test(shareRef)) {
    try {
      const seen = JSON.parse(localStorage.getItem('tala.visited') || '[]');
      if (!seen.includes(shareRef)) {
        let me = JSON.parse(localStorage.getItem('tala.visitor') || 'null');
        if (typeof me !== 'string' || !/^[0-9a-f-]{36}$/.test(me)) {
          me = crypto.randomUUID();
          localStorage.setItem('tala.visitor', JSON.stringify(me));
        }
        fetch(`${base}/rest/v1/rpc/share_visit`, {
          method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_code: shareRef, p_visitor: me }),
        }).then(r => { if (r.ok) localStorage.setItem('tala.visited', JSON.stringify([...seen, shareRef].slice(-20))); })
          .catch(() => { /* not counted this time */ });
      }
    } catch { /* private mode: not counted */ }
  }

  /* ─── the request form ───
     For anything the designer does not make: a plaque, a reprint, a trophy
     from a logo. A designed trophy is ordered from the cart (cart.html). */
  const form = $('#quoteForm');
  if (form) {
    const nameEl = $('#qName'), mailEl = $('#qEmail'), msgEl = $('#qMsg');
    const qtyEl = $('#qQty'), phoneEl = $('#qPhone'), out = $('#quoteMsg');
    const btn = form.querySelector('button[type="submit"]');

    const setErr = (el, text) => {
      el.closest('.field').classList.toggle('bad', !!text);
      const slot = $(`[data-err="${el.id}"]`);
      if (slot) slot.textContent = text || '';
    };

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const nameOk = nameEl.value.trim().length > 1;
      const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mailEl.value.trim());
      // a mobile number: digits, with spaces, dashes or +63
      const phone = (phoneEl?.value || '').replace(/[^\d+()\s-]/g, '').replace(/\s+/g, ' ').trim();
      const phoneOk = !phoneEl || (/^[0-9 +()-]{7,20}$/.test(phone) && phone.replace(/\D/g, '').length >= 7);

      setErr(nameEl, nameOk ? '' : 'We need a name to put on the quote.');
      setErr(mailEl, mailOk ? '' : 'That email does not look right.');
      if (phoneEl) setErr(phoneEl, phoneOk ? '' : 'We need a mobile number, like 0917 123 4567.');

      const allOk = nameOk && mailOk && phoneOk;
      out.classList.toggle('err', !allOk);
      out.classList.toggle('ok', allOk);
      if (!allOk) {
        out.textContent = 'Check the highlighted fields.';
        (!nameOk ? nameEl : !mailOk ? mailEl : phoneEl).focus();
        return;
      }

      // honeypot: a field people never see; bots fill it in
      if (form.elements.website && form.elements.website.value) { form.reset(); return; }

      const first = nameEl.value.trim().split(/\s+/)[0];
      const email = mailEl.value.trim();

      if (!live) {
        out.classList.remove('ok'); out.classList.add('err');
        out.textContent = 'Online requests are not switched on yet, so this was not sent. Please contact the shop directly for now.';
        return;
      }

      btn.disabled = true; out.classList.remove('ok', 'err'); out.textContent = 'Sending…';
      try {
        const qty = parseInt(qtyEl.value, 10);
        /* Insert-only: Row Level Security lets the publishable key add a row
           and nothing else, so `return=minimal`. */
        const res = await fetch(`${base}/rest/v1/quote_requests`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({
            name: nameEl.value.trim().slice(0, 120),
            email: email.slice(0, 200),
            ...(phoneEl ? { phone } : {}),
            qty: Number.isFinite(qty) ? Math.min(Math.max(qty, 1), 2000) : null,
            message: msgEl.value.trim().slice(0, 6000) || null,
            page: location.pathname.slice(0, 200),
          }),
        });
        if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
        out.classList.add('ok');
        out.textContent = `Thanks ${first} — we'll reply to ${email} within 48 hours.`;
        const tick = document.createElement('span');
        tick.className = 'form__tick'; tick.setAttribute('aria-hidden', 'true');
        out.prepend(tick);
        playLottie(tick, 'sent', false).catch(() => tick.remove());
        form.reset();
      } catch (err) {
        console.warn('[tala] request not saved:', err);
        out.classList.add('err');
        out.textContent = 'Sorry — that did not go through. Please try again in a moment.';
      } finally {
        btn.disabled = false;
      }
    });

    [nameEl, mailEl, phoneEl].filter(Boolean).forEach(el => el.addEventListener('input', () => {
      setErr(el, '');
      out.textContent = '';
      out.classList.remove('err', 'ok');
    }));
  }
})();
