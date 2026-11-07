/* Chapter Quiz Hub — 3D race track / sea lane / mountain trail (three.js)
   Exposes window.G3D = { ok, mount(el,opts), moveTo(i,o), state(i,s), hurdle(emoji,text), lift(), run(on), jump(), dash(el,opts), destroy(), resize() }
   Loaded as an ES module; the page falls back to the CSS track if G3D is missing or WebGL is unavailable. */
import * as THREE from 'three';

const T = {
  drive:   { sky:0x0b0714, fog:0x120a24, ground:0x1a1030, grid:0x6f44c9, asph:0x2a2a33, k1:0xe63946, k2:0xffffff, dash:0xeeeeee, node:0x17102a, ok:0x48e39b, retry:0xff8a5c, cur:0xc66bff, light:0xffb86b, crowd:['🙋','🙌','👏','🎉','📣','🧑‍🤝‍🧑','🧍','🚩','📸','🥳'], goal:'🏆', vehicle:'car' },
  island:  { sky:0x5e8dff, fog:0x9fd0ff, ground:0x2f7df6, grid:0x5fa8ff, asph:0x2457d8, k1:0xff6f4e, k2:0xffffff, dash:0xffffff, node:0xffffff, ok:0x15b36b, retry:0xff6f4e, cur:0x5b48ff, light:0xffffff, crowd:['🙋','🏝️','🌴','🐬','🐢','⛵','🐠','🛟','🦜','🌺'], goal:'🏝️', vehicle:'ship' },
  gallery: { sky:0x0a0908, fog:0x14100a, ground:0x2b2117, grid:0x4a3a20, asph:0x3b2a1a, k1:0xc9a961, k2:0x5a4123, dash:0xe8d6a8, node:0x1a1410, ok:0x9ccf7a, retry:0xe0b96a, cur:0xc9a961, light:0xff9b2f, crowd:['🙋','🏮','🔦','🐎','👵','👨‍🌾','🧒','🙏','🕯️','🦉'], goal:'🚪', vehicle:'party' }
};

let R = null; // current render context
const clock = new THREE.Clock();

function emojiTexture(txt, size = 128, font = 'sans-serif') {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.font = `${size * .78}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, size / 2, size / 2 + size * .04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function labelTexture(txt, opts = {}) {
  const w = 256, h = 96; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = opts.bg || 'rgba(0,0,0,.55)'; roundRect(g, 4, 4, w - 8, h - 8, 22); g.fill();
  g.fillStyle = opts.fg || '#fff'; g.font = `bold ${opts.px || 40}px "Space Grotesk",system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function sprite(tex, w, h) { const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }); const s = new THREE.Sprite(m); s.scale.set(w, h, 1); return s; }
function stripeTexture(c1, c2, reps = 1) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#' + c1.toString(16).padStart(6, '0'); g.fillRect(0, 0, 64, 32); g.fillStyle = '#' + c2.toString(16).padStart(6, '0'); g.fillRect(0, 32, 64, 32);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, reps); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function dashTexture(col, asph) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#' + asph.toString(16).padStart(6, '0'); g.fillRect(0, 0, 64, 128); g.fillStyle = '#' + col.toString(16).padStart(6, '0'); g.fillRect(28, 20, 8, 52);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function gridTexture(col, bg) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#' + bg.toString(16).padStart(6, '0'); g.fillRect(0, 0, 128, 128); g.fillStyle = '#' + col.toString(16).padStart(6, '0'); g.globalAlpha = .55; g.beginPath(); g.arc(64, 64, 3, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- ribbon road along a curve ---------- */
function ribbon(curve, halfW, segs, offset = 0, y = .02) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; const p = curve.getPointAt(t); const tan = curve.getTangentAt(t); const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const l = p.clone().addScaledVector(side, offset + halfW), r = p.clone().addScaledVector(side, offset - halfW);
    pos.push(l.x, p.y + y, l.z, r.x, p.y + y, r.z); uv.push(0, t * segs / 6, 1, t * segs / 6);
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/* ---------- vehicles ---------- */
function makeCar(th) {
  const g = new THREE.Group(); const red = new THREE.MeshStandardMaterial({ color: 0xff3c5a, roughness: .35, metalness: .3 }); const dark = new THREE.MeshStandardMaterial({ color: 0x1b1330 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, .4, 2.2), red); body.position.y = .45; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(.9, .4, 1.1), dark); cab.position.set(0, .85, -.1); g.add(cab);
  const wheelG = new THREE.CylinderGeometry(.26, .26, .3, 16); const wm = new THREE.MeshStandardMaterial({ color: 0x111111 });
  [[-.55, .26, .7], [.55, .26, .7], [-.55, .26, -.7], [.55, .26, -.7]].forEach(([x, y, z]) => { const w = new THREE.Mesh(wheelG, wm); w.rotation.z = Math.PI / 2; w.position.set(x, y, z); g.add(w); g.userData.wheels = (g.userData.wheels || []).concat(w); });
  const hl = new THREE.SpotLight(0xfff2c0, 40, 18, .6, .5, 1.2); hl.position.set(0, .6, 1.1); hl.target.position.set(0, 0, 8); g.add(hl); g.add(hl.target);
  const tail = new THREE.PointLight(0xff2040, 2, 3); tail.position.set(0, .5, -1.15); g.add(tail);
  g.userData.lift = 0; return g;
}
function makeShip() {
  const g = new THREE.Group(); const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, .5, 2.8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6 })); hull.position.y = .35; g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(.6, 1, 4), new THREE.MeshStandardMaterial({ color: 0xffffff })); bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(0, .35, 1.9); g.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(.9, .5, 1.3), new THREE.MeshStandardMaterial({ color: 0xff6f4e })); deck.position.set(0, .85, -.2); g.add(deck);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(.16, .18, .6, 12), new THREE.MeshStandardMaterial({ color: 0x2b1fb0 })); funnel.position.set(0, 1.35, -.4); g.add(funnel);
  const lamp = new THREE.PointLight(0xffe9a8, 3, 6); lamp.position.set(0, 1.4, .4); g.add(lamp); g.userData.lift = .1; return g;
}
function makeParty() {
  const g = new THREE.Group(); const faces = ['🧔', '👩‍🦱', '💪', '👩‍🦰']; const cols = [0xc9a961, 0x6b8cff, 0xff6f4e, 0x9ccf7a];
  faces.forEach((f, i) => { const p = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(.18, .45, 4, 8), new THREE.MeshStandardMaterial({ color: cols[i] })); body.position.y = .5; p.add(body);
    const head = sprite(emojiTexture(f), .55, .55); head.position.y = 1.05; p.add(head); p.position.set((i % 2) * .7 - .35, 0, i < 1 ? .6 : -.3 - Math.floor(i / 2) * .5); p.userData.phase = i; g.add(p); g.userData.people = (g.userData.people || []).concat(p); });
  const torch = new THREE.PointLight(0xff9b2f, 6, 9); torch.position.set(0, 1.4, .8); g.add(torch); g.userData.torch = torch; g.userData.lift = 0; return g;
}

/* ---------- build ---------- */
function build(el, opts) {
  destroy();
  const theme = T[opts.theme] || T.drive; const n = opts.n; const labels = opts.labels || [];
  const w = el.clientWidth || 240, h = el.clientHeight || 600;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(w, h); renderer.shadowMap.enabled = false; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;border-radius:18px';
  el.innerHTML = ''; el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(theme.sky); scene.fog = new THREE.Fog(theme.fog, 14, 46);
  const camera = new THREE.PerspectiveCamera(opts.horizontal ? 42 : 62, w / h, .1, 120);
  // path: a gentle S-curve, nodes spread along it
  const len = opts.horizontal ? Math.max(30, n * 7) : Math.max(36, n * 6.5);
  const pts = []; const steps = 9; for (let i = 0; i <= steps; i++) { const t = i / steps; pts.push(new THREE.Vector3(Math.sin(t * Math.PI * 2.2) * (opts.horizontal ? 1.5 : 3.2), 0, -t * len)); }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .5);
  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: theme.ground, map: opts.theme === 'drive' ? gridTexture(theme.grid, theme.ground) : null, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.05; scene.add(ground);
  if (opts.theme === 'island') { ground.material.color.set(0x2f7df6); ground.material.transparent = true; ground.material.opacity = .95; ground.userData.wave = true; ground.geometry = new THREE.PlaneGeometry(240, 240, 60, 60); }
  // road
  const asph = new THREE.Mesh(ribbon(curve, opts.theme === 'island' ? 1.6 : 1.5, 160), new THREE.MeshStandardMaterial({ map: dashTexture(theme.dash, theme.asph), roughness: .9 })); asph.material.map.repeat.set(1, 1); scene.add(asph);
  const kerbL = new THREE.Mesh(ribbon(curve, .22, 160, 1.72, .03), new THREE.MeshStandardMaterial({ map: stripeTexture(theme.k1, theme.k2, 2) })); scene.add(kerbL);
  const kerbR = new THREE.Mesh(ribbon(curve, .22, 160, -1.72, .03), new THREE.MeshStandardMaterial({ map: stripeTexture(theme.k1, theme.k2, 2) })); scene.add(kerbR);
  if (opts.theme === 'island') { asph.material.transparent = true; asph.material.opacity = .85; }
  // lights
  scene.add(new THREE.AmbientLight(0xffffff, opts.theme === 'island' ? 1.2 : .35));
  const sun = new THREE.DirectionalLight(0xffffff, opts.theme === 'island' ? 1.6 : .6); sun.position.set(5, 12, 6); scene.add(sun);
  const hemi = new THREE.HemisphereLight(theme.sky, theme.ground, .5); scene.add(hemi);
  // nodes
  const nodes = []; const nodeMat = () => new THREE.MeshStandardMaterial({ color: theme.node, emissive: 0x000000 });
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0; const p = curve.getPointAt(t); const g = new THREE.Group(); g.position.copy(p);
    if (i < n) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.9, .12, 10, 32), nodeMat()); ring.rotation.x = Math.PI / 2; ring.position.y = .06; g.add(ring);
      const num = sprite(labelTexture(String(i + 1), { px: 46, bg: 'rgba(0,0,0,.5)' }), 1.3, .5); num.position.y = .9; g.add(num);
      const lbl = sprite(labelTexture(labels[i] || '', { px: 34, bg: 'rgba(0,0,0,.35)' }), 2.2, .8); lbl.position.set(2.9, .7, 0); g.add(lbl);
      g.userData.ring = ring;
    } else {
      // goal: checkered arch / island / gate
      const arch = new THREE.Group(); const pm = new THREE.MeshStandardMaterial({ map: stripeTexture(0x000000, 0xffffff, 6) });
      [-2.2, 2.2].forEach(x => { const post = new THREE.Mesh(new THREE.BoxGeometry(.3, 3.2, .3), pm); post.position.set(x, 1.6, 0); arch.add(post); });
      const top = new THREE.Mesh(new THREE.BoxGeometry(4.7, .35, .35), pm); top.position.y = 3.2; arch.add(top);
      const flag = sprite(emojiTexture(theme.goal), 1.6, 1.6); flag.position.y = 4.3; arch.add(flag);
      if (opts.theme === 'island') { const isle = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, .5, 24), new THREE.MeshStandardMaterial({ color: 0xe3c77f })); isle.position.y = -.1; arch.add(isle); const palm = sprite(emojiTexture('🌴'), 2.4, 2.4); palm.position.set(-1.6, 1.4, -1); arch.add(palm); const chest = sprite(emojiTexture('💰'), 1.2, 1.2); chest.position.set(1.4, .8, -.6); arch.add(chest); }
      if (opts.theme === 'gallery') { const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 7, 10), new THREE.MeshStandardMaterial({ color: 0x3a2d22 })); tower.position.set(0, 3.5, -4); arch.add(tower); const win = new THREE.PointLight(0xffd27a, 10, 12); win.position.set(0, 6, -2.4); arch.add(win); const layla = sprite(emojiTexture('👸'), 1.4, 1.4); layla.position.set(0, 6.4, -2.2); arch.add(layla); }
      g.add(arch);
    }
    scene.add(g); nodes.push(g);
  }
  // crowd along both sides
  const crowd = []; const count = opts.horizontal ? 18 : Math.max(16, n * 3);
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count; const p = curve.getPointAt(t); const tan = curve.getTangentAt(t); const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize(); const sgn = i % 2 ? 1 : -1;
    const s = sprite(emojiTexture(theme.crowd[(i * 7) % theme.crowd.length]), 1.1 + Math.random() * .5, 1.1 + Math.random() * .5);
    s.position.copy(p).addScaledVector(side, sgn * (2.8 + Math.random() * 1.6)); s.position.y = .7; s.userData.ph = Math.random() * 6; s.userData.wild = Math.random() < .3; scene.add(s); crowd.push(s);
    if (opts.theme === 'gallery' && i % 4 === 0) { const l = new THREE.PointLight(0xff9b2f, 3, 7); l.position.copy(s.position).setY(1.6); l.userData.flk = Math.random() * 6; scene.add(l); crowd.push(l); }
    if (opts.theme === 'drive' && i % 3 === 0) { const tree = new THREE.Mesh(new THREE.SphereGeometry(.7 + Math.random() * .6, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff7fb0, emissive: 0xff7fb0, emissiveIntensity: .5 })); tree.position.copy(s.position).addScaledVector(side, sgn * 2.5).setY(1.2); scene.add(tree); }
  }
  // stars (night themes)
  if (opts.theme !== 'island') { const sg = new THREE.BufferGeometry(); const sp = []; for (let i = 0; i < 400; i++) sp.push((Math.random() - .5) * 200, 20 + Math.random() * 60, -Math.random() * 200 + 40); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: .35, transparent: true, opacity: .8 }))); }
  else { for (let i = 0; i < 6; i++) { const c = sprite(emojiTexture('☁️'), 6, 3.5); c.position.set((Math.random() - .5) * 60, 9 + Math.random() * 5, -Math.random() * len - 5); c.userData.cloud = .3 + Math.random() * .4; scene.add(c); crowd.push(c); } }
  // vehicle
  const veh = theme.vehicle === 'car' ? makeCar(theme) : theme.vehicle === 'ship' ? makeShip() : makeParty(); scene.add(veh);
  R = { el, renderer, scene, camera, curve, nodes, crowd, veh, theme: opts.theme, n, asph, kerbL, kerbR, t: 0, target: 0, from: 0, t0: 0, dur: 0, run: false, jump: null, hurdle: null, horizontal: !!opts.horizontal, ground, raf: null, lastW: w, lastH: h, chase: opts.chase !== false };
  placeVehicle(0); updateCamera(1); loop();
  R.ro = new ResizeObserver(() => resize()); R.ro.observe(el);
  return true;
}
function placeVehicle(t) {
  const p = R.curve.getPointAt(Math.min(1, Math.max(0, t))); const tan = R.curve.getTangentAt(Math.min(1, Math.max(0, t)));
  R.veh.position.copy(p); R.veh.position.y = R.veh.userData.lift || 0; R.veh.lookAt(p.clone().add(tan)); R.t = t;
}
function updateCamera(lerp) {
  const p = R.veh.position; const tan = R.curve.getTangentAt(Math.min(1, Math.max(0, R.t)));
  let desired, look;
  if (R.horizontal) { desired = new THREE.Vector3(p.x + 9, 7.5, p.z + 9); look = new THREE.Vector3(p.x, .8, p.z - 2); }
  else { desired = p.clone().addScaledVector(tan, -8); desired.y = 5.2; look = p.clone().addScaledVector(tan, 9); look.y = .6; }
  R.camera.position.lerp(desired, lerp); R.camLook = (R.camLook || look.clone()).lerp(look, lerp); R.camera.lookAt(R.camLook);
}
function loop() {
  if (!R) return; R.raf = requestAnimationFrame(loop); const dt = Math.min(.05, clock.getDelta()); const now = performance.now() / 1000;
  // movement tween
  if (R.dur > 0) { const k = Math.min(1, (now - R.t0) / R.dur); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; placeVehicle(R.from + (R.target - R.from) * e); if (k >= 1) { R.dur = 0; R.run = false; } }
  // jump arc
  if (R.jump) { const k = Math.min(1, (now - R.jump.t0) / R.jump.d); R.veh.position.y = (R.veh.userData.lift || 0) + Math.sin(k * Math.PI) * 2.2; R.veh.rotation.x += Math.sin(k * Math.PI) * -.012; if (k >= 1) R.jump = null; }
  // texture flow when running
  const speed = R.run ? 6 : (R.theme === 'island' ? .6 : .9); R.asph.material.map.offset.y -= dt * speed * .25; R.kerbL.material.map.offset.y -= dt * speed * .25; R.kerbR.material.map.offset.y -= dt * speed * .25;
  // vehicle idle motion
  const v = R.veh;
  if (R.theme === 'island') { v.position.y = (v.userData.lift || 0) + Math.sin(now * 1.6) * .08 + (R.jump ? v.position.y - (v.userData.lift || 0) : 0); v.rotation.z = Math.sin(now * 1.2) * .06; }
  if (R.theme === 'drive' && v.userData.wheels) v.userData.wheels.forEach(w => w.rotation.x += dt * (R.run ? 18 : 2.5));
  if (R.theme === 'gallery' && v.userData.people) { v.userData.people.forEach(p => { p.position.y = Math.abs(Math.sin(now * (R.run ? 9 : 3) + p.userData.phase)) * (R.run ? .22 : .06); }); v.userData.torch.intensity = 5 + Math.sin(now * 13) * 1.2 + Math.random() * .6; }
  if (R.ground.userData.wave) { const pos = R.ground.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, Math.sin(x * .35 + now * 1.4) * .12 + Math.cos(y * .3 + now * 1.1) * .12); } pos.needsUpdate = true; }
  // crowd cheer
  R.crowd.forEach(s => { if (s.isSprite && !s.userData.cloud) { s.position.y = .7 + Math.abs(Math.sin(now * (R.run ? 7 : 2.2) + s.userData.ph)) * (s.userData.wild ? .45 : .18); s.material.rotation = Math.sin(now * 3 + s.userData.ph) * .12; } else if (s.userData.cloud) { s.position.x += dt * s.userData.cloud; if (s.position.x > 40) s.position.x = -40; } else if (s.isLight) { s.intensity = 2.4 + Math.sin(now * 11 + s.userData.flk) * .8 + Math.random() * .5; } });
  // hurdle slam / lift
  if (R.hurdle) { const h = R.hurdle; const k = Math.min(1, (now - h.t0) / .45); if (h.lifting) { h.g.position.y = h.baseY + k * 3; h.g.rotation.z = k * .6; h.g.children.forEach(c => { if (c.material) c.material.opacity = 1 - k; }); if (k >= 1) { R.scene.remove(h.g); R.hurdle = null; } } else { const s = .4 + .6 * (k < .6 ? k / .6 * 1.15 : 1.15 - (k - .6) / .4 * .15); h.g.scale.setScalar(s); } }
  // cur node pulse
  R.nodes.forEach((g, i) => { if (g.userData.ring && g.userData.state === 'cur') g.userData.ring.material.emissiveIntensity = .6 + Math.sin(now * 5) * .4; });
  updateCamera(R.chase ? .08 : 1);
  R.renderer.render(R.scene, R.camera);
}
function resize() { if (!R) return; const w = R.el.clientWidth, h = R.el.clientHeight; if (!w || !h || (w === R.lastW && h === R.lastH)) return; R.lastW = w; R.lastH = h; R.renderer.setSize(w, h); R.camera.aspect = w / h; R.camera.updateProjectionMatrix(); }
function destroy() { if (!R) return; cancelAnimationFrame(R.raf); R.ro && R.ro.disconnect(); R.renderer.dispose(); R.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } }); R.el.innerHTML = ''; R = null; }


/* ---------- 3D cut-scene stage ---------- */
const STAGE_BG = {
  office:{sky:0x24324f,floor:0x3a4a70,light:0xdfe8ff}, cafe:{sky:0x4a2e1b,floor:0x7a5a3a,light:0xffd9a0}, hospital:{sky:0xcfe8f3,floor:0xdde9ee,light:0xffffff},
  factory:{sky:0x2b2f33,floor:0x4b5259,light:0xcfd8ff}, shop:{sky:0xf6e7c8,floor:0xd9b36b,light:0xfff2c8}, street:{sky:0x0f1b3a,floor:0x2a2f45,light:0xffe0a0},
  meeting:{sky:0x2a2140,floor:0x4a3b70,light:0xe8dcff}, mountain:{sky:0x0a0d1f,floor:0x3b3a2a,light:0xcbd5ff}, fortress:{sky:0x120a0a,floor:0x3a2a1a,light:0xff9b2f},
  camp:{sky:0x0b0f1f,floor:0x3a3020,light:0xff9b2f}, sea:{sky:0x9fd0ff,floor:0xe3c77f,light:0xffffff}, village:{sky:0x4a1c0f,floor:0x2a1a10,light:0xff8a3a},
  hotel:{sky:0x2a1e3a,floor:0x6a4a7a,light:0xffe6c0}, school:{sky:0x1e3a2a,floor:0x4a7a4a,light:0xe8ffe0}, airport:{sky:0x1a2a3a,floor:0x6a8aaa,light:0xffffff},
  home:{sky:0x3a2a2a,floor:0x7a5a50,light:0xffd9b0}, lab:{sky:0x0f2a2a,floor:0x2a6a6a,light:0xd0ffff}, bank:{sky:0x1a2238,floor:0x3a4a6a,light:0xe0e8ff},
  kitchen:{sky:0x3a2415,floor:0x8a6a4a,light:0xffe0b0}, warehouse:{sky:0x23262b,floor:0x55595f,light:0xdde3ff}, '':{sky:0x1b1430,floor:0x2a1646,light:0xd9c6ff}
};
let ST = null;
function stageMount(el, opts) {
  stageDestroy();
  const bg = STAGE_BG[opts.bg] || STAGE_BG['']; const w = el.clientWidth || 600, h = el.clientHeight || 260;
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(w, h); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%'; el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg.sky); scene.fog = new THREE.Fog(bg.sky, 12, 30);
  const camera = new THREE.PerspectiveCamera(38, w / h, .1, 100); camera.position.set(0, 2.6, 8.5); camera.lookAt(0, 1.1, 0);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: bg.floor, roughness: .95 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // a soft spotlit circle under the cast
  const disc = new THREE.Mesh(new THREE.CircleGeometry(4.5, 48), new THREE.MeshStandardMaterial({ color: bg.floor, emissive: bg.light, emissiveIntensity: .12 })); disc.rotation.x = -Math.PI / 2; disc.position.y = .01; scene.add(disc);
  scene.add(new THREE.AmbientLight(0xffffff, .55)); const key = new THREE.DirectionalLight(bg.light, 1.4); key.position.set(4, 8, 6); scene.add(key); const rim = new THREE.PointLight(bg.light, 6, 20); rim.position.set(-4, 4, -3); scene.add(rim);
  // props as big faded sprites around the stage
  (opts.props || []).forEach((e, i) => { const sp = sprite(emojiTexture(e), 2.2, 2.2); sp.material.opacity = .9; const a = -1.2 + i * (2.4 / Math.max(1, (opts.props.length - 1))); sp.position.set(Math.sin(a) * 7.5, 1.6 + (i % 2) * 1.2, -5 - Math.cos(a) * 2); scene.add(sp); });
  // actors
  const actors = []; const n = opts.actors.length; const cols = [0xc66bff, 0xff8a5c, 0x48e39b, 0x5b48ff, 0xffd166, 0xef476f];
  opts.actors.forEach((a, i) => {
    const g = new THREE.Group(); const x = n === 1 ? 0 : -3.2 + i * (6.4 / (n - 1)); g.position.set(x, 0, (i % 2) * -.6);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.42, .9, 6, 12), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: .6 })); body.position.y = 1.05; g.add(body);
    const head = sprite(emojiTexture(a.emoji), 1.25, 1.25); head.position.y = 2.25; g.add(head);
    const feet = new THREE.Mesh(new THREE.CircleGeometry(.5, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .25 })); feet.rotation.x = -Math.PI / 2; feet.position.y = .02; g.add(feet);
    g.userData = { phase: i, talk: false, head }; scene.add(g); actors.push(g);
  });
  ST = { el, renderer, scene, camera, actors, t0: performance.now(), raf: null, dolly: 0 };
  const loop = () => { if (!ST) return; ST.raf = requestAnimationFrame(loop); const t = (performance.now() - ST.t0) / 1000;
    ST.actors.forEach((g, i) => { const tk = g.userData.talk; g.position.y = tk ? Math.abs(Math.sin(t * 9 + i)) * .12 : Math.sin(t * 1.6 + i) * .03; g.rotation.y = tk ? Math.sin(t * 6) * .12 : Math.sin(t * .8 + i) * .06; g.scale.setScalar(tk ? 1.08 : 1); g.userData.head.material.opacity = tk || !ST.anyTalk ? 1 : .6; });
    ST.camera.position.x = Math.sin(t * .18) * 1.4; ST.camera.position.y = 2.6 + Math.sin(t * .25) * .2; ST.camera.lookAt(0, 1.2, 0); ST.renderer.render(ST.scene, ST.camera); if (ST.onFrame) ST.onFrame(); };
  loop(); ST.ro = new ResizeObserver(() => { if (!ST) return; const w2 = el.clientWidth, h2 = el.clientHeight; if (!w2 || !h2) return; ST.renderer.setSize(w2, h2); ST.camera.aspect = w2 / h2; ST.camera.updateProjectionMatrix(); }); ST.ro.observe(el);
  return true;
}
function stageTalk(i) { if (!ST) return; ST.anyTalk = i >= 0; ST.actors.forEach((g, k) => g.userData.talk = (k === i)); }
function stageAnchor(i) { if (!ST || !ST.actors[i]) return null; const v = new THREE.Vector3(0, 2.95, 0); ST.actors[i].localToWorld(v); v.project(ST.camera); const w = ST.el.clientWidth, h = ST.el.clientHeight; return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h }; }
function stageDestroy() { if (!ST) return; cancelAnimationFrame(ST.raf); ST.ro && ST.ro.disconnect(); ST.renderer.dispose(); ST.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } }); if (ST.renderer.domElement.parentNode) ST.renderer.domElement.remove(); ST = null; }

const G3D = {
  ok: (() => { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } })(),
  mount(el, opts) { try { return build(el, opts); } catch (e) { console.warn('G3D mount failed', e); return false; } },
  moveTo(i, o = {}) { if (!R) return 0; const t = R.n ? i / R.n : 0; R.from = R.t; R.target = t; R.t0 = performance.now() / 1000; R.dur = o.dur || (o.fast ? 2.4 : 1.35); R.run = true; if (o.jump) setTimeout(() => this.jump(), R.dur * 1000 * .42); return R.dur; },
  state(i, s) { if (!R) return; const g = R.nodes[i]; if (!g || !g.userData.ring) return; g.userData.state = s; const th = T[R.theme]; const c = s === 'ok' ? th.ok : s === 'retry' ? th.retry : s === 'cur' ? th.cur : th.node; g.userData.ring.material.color.set(c); g.userData.ring.material.emissive.set(s ? c : 0x000000); g.userData.ring.material.emissiveIntensity = s === 'cur' ? .8 : s ? .5 : 0; },
  hurdle(emoji, text) { if (!R) return; this.lift(true); const t = Math.min(1, R.t + (R.n ? .5 / R.n : .3)); const p = R.curve.getPointAt(t); const g = new THREE.Group(); g.position.copy(p); g.position.y = 1.2;
    const s = sprite(emojiTexture(emoji), 2.6, 2.6); g.add(s); const l = sprite(labelTexture(text, { px: 30, bg: 'rgba(230,57,70,.95)' }), 3.6, 1.3); l.position.set(0, 2.1, 0); g.add(l);
    g.scale.setScalar(.01); R.scene.add(g); R.hurdle = { g, t0: performance.now() / 1000, baseY: 1.2, lifting: false }; },
  lift(now) { if (!R || !R.hurdle) return; if (now) { R.scene.remove(R.hurdle.g); R.hurdle = null; return; } R.hurdle.lifting = true; R.hurdle.t0 = performance.now() / 1000; },
  run(on) { if (R) R.run = !!on; },
  jump() { if (!R) return; R.jump = { t0: performance.now() / 1000, d: .9 }; },
  dash(el, opts) { return this.mount(el, Object.assign({ horizontal: true, chase: true }, opts)); },
  stage(el, opts) { try { return stageMount(el, opts); } catch (e) { console.warn('stage failed', e); return false; } }, stageTalk, stageAnchor, stageDestroy, onStageFrame(fn) { if (ST) ST.onFrame = fn; },
  resize, destroy
};
window.G3D = G3D;
