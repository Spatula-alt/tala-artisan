/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — viewer
   One small studio: renderer, three-point lighting, a procedural
   environment for the metal and acrylic, and drag-to-turn controls.
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

/* A studio softbox rig painted onto an equirect canvas. Gives the brass
   something to reflect and the acrylic something to refract without
   shipping an HDR file. */
function studioEnvironment(renderer) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');

  /* A hard horizon matters more than brightness. Metal with nothing dark to
     reflect reads as pale paint, so the lower half is a dark studio floor. */
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0.00, '#ffffff');
  sky.addColorStop(0.34, '#f0ebe2');
  sky.addColorStop(0.47, '#8c8579');
  sky.addColorStop(0.54, '#36332d');
  sky.addColorStop(1.00, '#14130f');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);

  const box = (x, y, rx, ry, a) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    rg.addColorStop(0, `rgba(255,255,255,${a})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y);
    g.fillStyle = rg; g.fillRect(x - rx * 2, y - ry * 2, rx * 4, ry * 4);
    g.restore();
  };

  box(250, 120, 210, 130, 1.0);   // key
  box(740, 170, 150, 110, 0.55);  // fill
  box(520,  70, 300,  70, 0.40);  // overhead strip
  box(930, 300, 120,  90, 0.30);  // kicker

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}

function addLights(scene) {
  const key = new THREE.DirectionalLight(0xfff4e4, 2.0);
  key.position.set(16, 30, 24);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0012;
  key.shadow.normalBias = 0.03;
  const cam = key.shadow.camera;
  cam.near = 1; cam.far = 110;
  cam.left = -30; cam.right = 30; cam.top = 45; cam.bottom = -8;
  cam.updateProjectionMatrix();
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xdce7ff, 0.45);
  fill.position.set(-22, 12, 16);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
  rim.position.set(-10, 20, -26);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0xffffff, 0.14));
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{capture?:boolean, maxDpr?:number, interactive?:boolean, autoRotate?:boolean}} opts
 */
export function createViewer(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: !!opts.capture,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDpr ?? 2));
  /* The see-through acrylic renders the scene a second time into a buffer.
     On a phone that buffer at half size looks the same through frosted sheet
     and halves the cost of every frame. */
  if (matchMedia('(pointer: coarse)').matches && 'transmissionResolutionScale' in renderer) {
    renderer.transmissionResolutionScale = 0.5;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  addLights(scene);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.ShadowMaterial({ opacity: 0.2 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
  const target = new THREE.Vector3(0, 12, 0);

  const view = { az: -0.42, pol: 1.44, dist: 70 };
  let sway = 0;
  let home = { ...view };
  let dirty = true;

  function place() {
    const { az, pol, dist } = view;
    camera.position.set(
      target.x + dist * Math.sin(pol) * Math.sin(az),
      target.y + dist * Math.cos(pol),
      target.z + dist * Math.sin(pol) * Math.cos(az)
    );
    camera.lookAt(target);
  }

  function renderNow() {
    resize();
    place();
    renderer.render(scene, camera);
    dirty = false;
  }

  /* ── framing ── */
  /* Measures the object rather than trusting a single height figure: the cup's
     handles and the base are wider than the body, and a shape that is turned
     presents its diagonal. Fits both axes, then paints straight away — rAF is
     throttled in background tabs and stalls outright in some embedded views,
     so the first frame cannot depend on it. */
  /* The distance at which the piece exactly fills the frame. Zooming closer
     than this cuts the product in half, which is the one thing a product
     viewer must never do -- and a wide pose (a boxer with both arms up is
     nearly twice the width of a gown) hits it immediately. */
  let fitDist = 0;

  function fitDistanceFor(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return 0;
    const size = box.getSize(new THREE.Vector3());
    const spread = Math.hypot(size.x, size.z);
    const fovV = (camera.fov * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * Math.max(0.25, camera.aspect));
    return Math.max((size.y * 0.5) / Math.tan(fovV / 2),
                    (spread * 0.5) / Math.tan(fovH / 2));
  }

  function frameObject(obj, margin = 1.24) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    framed = obj;
    const size = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());
    target.set(0, mid.y, 0);

    // worst case as it spins: the footprint diagonal
    const spread = Math.hypot(size.x, size.z);
    const fovV = (camera.fov * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * Math.max(0.25, camera.aspect));

    fitDist = Math.max(
      (size.y * 0.5) / Math.tan(fovV / 2),
      (spread * 0.5) / Math.tan(fovH / 2)
    );
    view.dist = fitDist * margin;

    home = { ...view };
    renderNow();
  }

  /* Kept for callers that only know the height. */
  let framed = null;

  function frame(height) {
    target.set(0, height * 0.48, 0);
    const fov = (camera.fov * Math.PI) / 180;
    view.dist = (height * 0.62) / Math.tan(fov / 2) * 1.18;
    fitDist = view.dist / 1.18;
    home = { ...view };
    renderNow();
  }

  /* ── sizing ── */
  function resize() {
    let w, h;
    if (opts.fixed) {
      w = opts.fixed.w; h = opts.fixed.h;
    } else {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
    }
    /* Re-read the device ratio every time: it is not fixed for the life of
       the page. It changes when a window moves between monitors or the user
       zooms, and it can still be settling when the module first runs. */
    const want = Math.min(window.devicePixelRatio || 1, opts.maxDpr ?? 2);
    if (renderer.getPixelRatio() !== want) renderer.setPixelRatio(want);

    // Compare against the integers three will actually use, or this never settles.
    const cw = Math.floor(w * want), ch = Math.floor(h * want);
    if (canvas.width === cw && canvas.height === ch) return false;

    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    /* A narrower frame needs a longer lens for the same piece, so the floor
       moves. Re-clamp rather than re-frame: the customer's own turn and zoom
       are theirs to keep. */
    if (framed) {
      fitDist = fitDistanceFor(framed) || fitDist;
      if (view.dist < fitDist) view.dist = fitDist;
      if (home.dist < fitDist) home.dist = fitDist;
    }
    dirty = true;
    return true;
  }

  /* ── drag to turn ── */
  let idle = 0;
  const POL_MIN = 0.62, POL_MAX = 1.78;

  if (opts.interactive !== false) {
    let drag = null;
    canvas.style.touchAction = 'none';

    /* `opts.grab(e)` lets the page claim a drag -- the designer's sticker --
       by returning { move(e), end(e) }; otherwise the drag turns the trophy.
       `opts.hover(e)` is told about plain moves, for the cursor. */
    let claimed = null;
    canvas.addEventListener('pointerdown', e => {
      claimed = opts.grab ? opts.grab(e) : null;
      if (claimed) {
        idle = 0;
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      drag = { x: e.clientX, y: e.clientY };
      idle = 0;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('is-grabbing');
    });
    canvas.addEventListener('pointermove', e => {
      if (claimed) { claimed.move(e); idle = 0; dirty = true; return; }
      if (!drag) { opts.hover?.(e); return; }
      view.az -= (e.clientX - drag.x) * 0.008;
      view.pol = Math.min(POL_MAX, Math.max(POL_MIN, view.pol - (e.clientY - drag.y) * 0.006));
      drag = { x: e.clientX, y: e.clientY };
      idle = 0; dirty = true;
    });
    const end = e => {
      if (claimed) { claimed.end(e); claimed = null; dirty = true; }
      drag = null;
      canvas.classList.remove('is-grabbing');
      if (e.pointerId != null && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (opts.wheel && opts.wheel(e)) { idle = 0; dirty = true; return; }
      // fitDist is an exact fit for a level view; the camera looks down at the
      // piece, so the base's depth adds to its height on screen. 8% covers it.
      const near = Math.max(fitDist * 1.08, home.dist * 0.52);
      view.dist = Math.min(home.dist * 1.9, Math.max(near, view.dist * (1 + e.deltaY * 0.0011)));
      idle = 0; dirty = true;
    }, { passive: false });

    // Keyboard, so the viewer is usable without a mouse.
    canvas.addEventListener('keydown', e => {
      const step = 0.16;
      if (e.key === 'ArrowLeft')  { view.az -= step; }
      else if (e.key === 'ArrowRight') { view.az += step; }
      else if (e.key === 'ArrowUp')    { view.pol = Math.max(POL_MIN, view.pol - step * 0.6); }
      else if (e.key === 'ArrowDown')  { view.pol = Math.min(POL_MAX, view.pol + step * 0.6); }
      else return;
      e.preventDefault(); idle = 0; dirty = true;
    });
  }

  function reset() {
    Object.assign(view, home);
    sway = 0;
    idle = 0; dirty = true;
  }

  /* ── loop, paused when off screen or hidden ── */
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = true, running = true;

  if (!opts.fixed && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.02 })
      .observe(canvas);
  }
  document.addEventListener('visibilitychange', () => { dirty = true; });

  /* Repaint immediately on resize. Flagging dirty and waiting for the next
     animation frame leaves the canvas blank wherever rAF is throttled —
     background tabs, embedded views — because the buffer was just cleared. */
  const onResize = () => { if (resize()) renderNow(); };
  if (!opts.fixed) {
    if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(canvas);
    else window.addEventListener('resize', onResize);
  }

  let last = performance.now(), swayAcc = 0;
  function tick(now) {
    if (!running) return;
    requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;

    resize();

    /* The idle sway redraws every frame, and the acrylic's transmission pass
       renders the scene twice per frame -- Lighthouse measured 16 s of main
       thread on the home page with it running forever. So it sways at 30 fps,
       and only for the first ~12 s of idleness; any touch restarts it. */
    if (opts.autoRotate && !calm) {
      idle += dt;
      // after ~12 s it keeps going only until it swings back to the front
      if (idle > 2.2 && (idle < 14 || Math.abs(Math.sin(sway)) > 0.04)) {
        swayAcc += dt;
        if (swayAcc >= 1 / 30) {
          sway += swayAcc * 0.42; swayAcc = 0;
          view.az = home.az + Math.sin(sway) * 0.46;   // about +/-26 degrees
          dirty = true;
        }
      }
    }
    if (dirty) { place(); renderer.render(scene, camera); dirty = false; }
  }
  resize();

  if (opts.loop !== false) requestAnimationFrame(tick);
  else running = false;

  return {
    scene, camera, renderer,
    frame, frameObject, reset, resize,
    invalidate() { dirty = true; },
    renderNow,
    stop() { running = false; },
    dispose() { running = false; renderer.dispose(); },
  };
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}
