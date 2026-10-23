/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — shared page behaviour
   Runs on both pages. No dependencies, no 3D.
   ══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

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

  /* ─── quote form ─── */
  const form = $('#quoteForm');
  if (form) {
    const nameEl = $('#qName'), mailEl = $('#qEmail'), msgEl = $('#qMsg');
    const qtyEl = $('#qQty'), itemEl = $('#qItem'), out = $('#quoteMsg');

    const setErr = (el, text) => {
      el.closest('.field').classList.toggle('bad', !!text);
      const slot = $(`[data-err="${el.id}"]`);
      if (slot) slot.textContent = text || '';
    };

    let design = null;                                // set when the designer handed one over
    const cfgT = window.TALA_CONFIG || {};
    const live = !!(cfgT.supabaseUrl && cfgT.supabaseKey);
    const btn = form.querySelector('button[type="submit"]');

    /* Insert-only: Row Level Security lets the publishable key add a row and
       nothing else, so `return=minimal` -- asking for the row back would need a
       SELECT policy, which deliberately does not exist. */
    async function save(row) {
      const res = await fetch(`${cfgT.supabaseUrl.replace(/\/$/, '')}/rest/v1/quote_requests`, {
        method: 'POST',
        headers: {
          apikey: cfgT.supabaseKey,
          Authorization: `Bearer ${cfgT.supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(row),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const nameOk = nameEl.value.trim().length > 1;
      const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mailEl.value.trim());

      setErr(nameEl, nameOk ? '' : 'We need a name to put on the quote.');
      setErr(mailEl, mailOk ? '' : 'That email does not look right.');

      out.classList.toggle('err', !(nameOk && mailOk));
      out.classList.toggle('ok', nameOk && mailOk);

      if (!nameOk || !mailOk) {
        out.textContent = 'Check the highlighted fields.';
        (!nameOk ? nameEl : mailEl).focus();
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
        await save({
          name: nameEl.value.trim().slice(0, 120),
          email: email.slice(0, 200),
          item: itemEl.value || null,
          qty: Number.isFinite(qty) ? Math.min(Math.max(qty, 1), 2000) : null,
          message: msgEl.value.trim().slice(0, 6000) || null,
          design,
          page: location.pathname.slice(0, 200),
        });
        out.classList.add('ok');
        out.textContent = `Thanks ${first} — we'll send a proof to ${email} within 48 hours.`;
        const tick = document.createElement('span');
        tick.className = 'form__tick'; tick.setAttribute('aria-hidden', 'true');
        out.prepend(tick);
        playLottie(tick, 'sent', false).catch(() => tick.remove());
        form.reset(); design = null;
        sessionStorage.removeItem('tala.spec');
      } catch (err) {
        console.warn('[tala] quote not saved:', err);
        out.classList.add('err');
        out.textContent = 'Sorry — that did not go through. Please try again in a moment.';
      } finally {
        btn.disabled = false;
      }
    });

    [nameEl, mailEl].forEach(el => el.addEventListener('input', () => {
      setErr(el, '');
      out.textContent = '';
      out.classList.remove('err', 'ok');
    }));

    /* a design handed over from the designer page */
    try {
      const raw = sessionStorage.getItem('tala.spec');
      if (raw) {
        const spec = JSON.parse(raw);
        if (spec && typeof spec.text === 'string') {
          msgEl.value = spec.text;
          if (spec.qty) qtyEl.value = spec.qty;
          if (spec.design && typeof spec.design === 'object') design = spec.design;
          if (spec.item && [...itemEl.options].some(o => o.value === spec.item)) itemEl.value = spec.item;
          out.textContent = 'Your design has been filled in below — add your details and send.';
          out.classList.add('ok');
        }
      }
    } catch { /* storage unavailable or malformed; the form still works empty */ }
  }
})();
