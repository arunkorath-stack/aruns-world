/* Chapter Quiz Hub — 3D race track / sea lane / mountain trail (three.js)
   Exposes window.G3D = { ok, mount(el,opts), moveTo(i,o), state(i,s), hurdle(emoji,text), lift(), run(on), jump(), dash(el,opts), destroy(), resize() }
   Loaded as an ES module; the page falls back to the CSS track if G3D is missing or WebGL is unavailable. */
import * as THREE from 'three';

const T = {
  drive:   { sky:0x0b0714, fog:0x120a24, ground:0x1a1030, grid:0x6f44c9, asph:0x2a2a33, k1:0xe63946, k2:0xffffff, dash:0xeeeeee, node:0x17102a, ok:0x48e39b, retry:0xff8a5c, cur:0xc66bff, light:0xffb86b, crowd:['🙋','🙌','👏','🎉','📣','🧑‍🤝‍🧑','🧍','🚩','📸','🥳'], goal:'🏆', vehicle:'car' },
  island:  { sky:0x5e8dff, fog:0x9fd0ff, ground:0x2f7df6, grid:0x5fa8ff, asph:0x2457d8, k1:0xff6f4e, k2:0xffffff, dash:0xffffff, node:0xffffff, ok:0x15b36b, retry:0xff6f4e, cur:0x5b48ff, light:0xffffff, crowd:['🙋','🏝️','🌴','🐬','🐢','⛵','🐠','🛟','🦜','🌺'], goal:'🏝️', vehicle:'ship' },
  gallery: { sky:0x05060c, fog:0x0b0d16, ground:0x141a14, grid:0x20281e, asph:0x2a2418, k1:0x3b3324, k2:0x1a160f, dash:0x6b5a3a, node:0x0e0c0a, ok:0x9ccf7a, retry:0xe0b96a, cur:0xc9a961, light:0xff9b2f, crowd:['🦉','🐺','🌲','🌲','🕯️','🏮','🪵','🦇','🌲','🪨'], goal:'🏰', vehicle:'party' }
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


/* ---------- Night Drive v2 helpers ---------- */
function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
function skyTexture(top, horizon) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, hex(top)); gr.addColorStop(.55, hex(top)); gr.addColorStop(.82, hex(horizon)); gr.addColorStop(1, hex(horizon));
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function roadTexture(asph) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = hex(asph); g.fillRect(0, 0, 128, 256);
  // subtle asphalt noise
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .05})`; g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); }
  g.fillStyle = '#f2f2f2'; g.fillRect(4, 0, 4, 256); g.fillRect(120, 0, 4, 256);           // edge lines
  g.fillStyle = '#ffd766'; g.fillRect(62, 40, 4, 110);                                    // centre dash (yellow)
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function windowTexture(warm) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 10) for (let x = 4; x < 64; x += 10) { if (Math.random() < .45) { g.fillStyle = Math.random() < .8 ? warm : '#9fd0ff'; g.globalAlpha = .6 + Math.random() * .4; g.fillRect(x, y, 5, 6); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture(col) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, col); gr.addColorStop(.35, col.replace(')', ',.55)').replace('rgb(', 'rgba(')); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowSprite(col, w, h) { const m = new THREE.SpriteMaterial({ map: glowTexture(col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); const s = new THREE.Sprite(m); s.scale.set(w, h, 1); return s; }
function rgb(c) { return `rgb(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255})`; }

function makeCar2(th) {
  const g = new THREE.Group(); const neon = th.grid || 0x6f44c9;
  const paint = new THREE.MeshStandardMaterial({ color: th.k1 || 0xe63946, roughness: .28, metalness: .55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b12, roughness: .4, metalness: .2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a40, roughness: .1, metalness: .9 });
  // sleek body from a side profile
  const sh = new THREE.Shape(); sh.moveTo(-1.25, .25); sh.lineTo(1.2, .25); sh.lineTo(1.3, .45); sh.lineTo(.95, .55); sh.lineTo(.35, .95); sh.lineTo(-.55, .98); sh.lineTo(-1.15, .6); sh.lineTo(-1.3, .5); sh.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 1.1, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 2 }), paint);
  body.rotation.y = Math.PI / 2; body.position.set(.55, 0, 0); g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(.86, .34, 1.0), glass); cab.position.set(0, .88, -.12); g.add(cab);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.1, .06, .28), dark); spoiler.position.set(0, .95, -1.15); g.add(spoiler);
  [[-.5], [.5]].forEach(([x]) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(.06, .3, .1), dark); leg.position.set(x, .78, -1.15); g.add(leg); });
  const tyre = new THREE.CylinderGeometry(.28, .28, .26, 18); const rim = new THREE.CylinderGeometry(.17, .17, .27, 10);
  const rimM = new THREE.MeshStandardMaterial({ color: 0xcfd6e6, metalness: .9, roughness: .25 });
  [[-.6, .28, .75], [.6, .28, .75], [-.6, .28, -.75], [.6, .28, -.75]].forEach(([x, y, z]) => { const w = new THREE.Group(); const t = new THREE.Mesh(tyre, dark); const r = new THREE.Mesh(rim, rimM); w.add(t); w.add(r); w.rotation.z = Math.PI / 2; w.position.set(x, y, z); g.add(w); g.userData.wheels = (g.userData.wheels || []).concat(w); });
  // lights
  const hlM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c4, emissiveIntensity: 2 });
  [[-.4], [.4]].forEach(([x]) => { const h = new THREE.Mesh(new THREE.BoxGeometry(.26, .1, .06), hlM); h.position.set(x, .45, 1.28); g.add(h); const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.rotation.x = -Math.PI / 2; beam.position.set(x, .4, 5.7); g.add(beam); });
  const spot = new THREE.SpotLight(0xfff2c0, 60, 22, .55, .6, 1.1); spot.position.set(0, .6, 1.2); spot.target.position.set(0, 0, 10); g.add(spot); g.add(spot.target);
  const tlM = new THREE.MeshStandardMaterial({ color: 0xff2040, emissive: 0xff2040, emissiveIntensity: 2.5 });
  [[-.42], [.42]].forEach(([x]) => { const t = new THREE.Mesh(new THREE.BoxGeometry(.3, .1, .05), tlM); t.position.set(x, .5, -1.3); g.add(t); const gl = glowSprite('rgb(255,40,70)', .9, .5); gl.position.set(x, .5, -1.38); g.add(gl); });
  const under = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.2), new THREE.MeshBasicMaterial({ map: glowTexture(rgb(neon)), transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })); under.rotation.x = -Math.PI / 2; under.position.y = .03; g.add(under);
  g.userData.lift = 0; return g;
}

function driveWorld(scene, curve, theme, V, n, len, opts, crowd) {
  const neon = theme.grid || 0x6f44c9; const neonRgb = rgb(neon);
  // sky dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(110, 24, 12), new THREE.MeshBasicMaterial({ map: skyTexture(theme.sky, theme.fog), side: THREE.BackSide, fog: false })); scene.add(dome);
  const moon = glowSprite('rgb(255,244,214)', 7, 7); moon.position.set(18, 26, -len - 20); scene.add(moon);
  // road
  const road = new THREE.Mesh(ribbon(curve, 2.3, 180), new THREE.MeshStandardMaterial({ map: roadTexture(theme.asph || 0x24242c), roughness: .95 })); scene.add(road);
  const shoulderM = new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 1 });
  scene.add(new THREE.Mesh(ribbon(curve, .5, 120, 2.8, .01), shoulderM)); scene.add(new THREE.Mesh(ribbon(curve, .5, 120, -2.8, .01), shoulderM));
  // guard rails + posts + lamp posts (instanced)
  const railM = new THREE.MeshStandardMaterial({ color: 0x9aa3b8, metalness: .8, roughness: .35 });
  scene.add(new THREE.Mesh(ribbon(curve, .06, 160, 3.25, .62), railM)); scene.add(new THREE.Mesh(ribbon(curve, .06, 160, -3.25, .62), railM));
  const postCount = Math.floor(len / 2.2); const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(.08, .65, .08), new THREE.MeshStandardMaterial({ color: 0x5a6070 }), postCount * 2);
  const m4 = new THREE.Matrix4(); let k = 0;
  for (let i = 0; i < postCount; i++) { const t = (i + .5) / postCount; const p = curve.getPointAt(t), tan = curve.getTangentAt(t); const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize(); [3.25, -3.25].forEach(o => { const q = p.clone().addScaledVector(side, o); m4.makeTranslation(q.x, .32, q.z); posts.setMatrixAt(k++, m4); }); }
  scene.add(posts);
  const lampCount = Math.max(4, Math.floor(len / 7)); const lampM = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: .6, roughness: .5 });
  for (let i = 0; i < lampCount; i++) { const t = (i + .5) / lampCount; const p = curve.getPointAt(t), tan = curve.getTangentAt(t); const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize(); const sgn = i % 2 ? 1 : -1; const base = p.clone().addScaledVector(side, sgn * 3.9);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, 5.2, 8), lampM); pole.position.set(base.x, 2.6, base.z); scene.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, .08, .08), lampM); arm.position.set(base.x - side.x * sgn * .75, 5.15, base.z - side.z * sgn * .75); arm.lookAt(arm.position.clone().add(side)); arm.rotation.y += Math.PI / 2; scene.add(arm);
    const head = p.clone().addScaledVector(side, sgn * 2.5); const bulb = glowSprite('rgb(255,214,140)', 1.6, 1.2); bulb.position.set(head.x, 5.1, head.z); scene.add(bulb);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd28c, transparent: true, opacity: .05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); cone.position.set(head.x, 2.6, head.z); scene.add(cone);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), new THREE.MeshBasicMaterial({ map: glowTexture('rgb(255,214,140)'), transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.set(head.x, .04, head.z); scene.add(pool);
    if (i % 2 === 0) { const l = new THREE.PointLight(0xffd28c, 6, 9, 1.6); l.position.set(head.x, 4.6, head.z); scene.add(l); }
  }
  // city skyline both sides: near row of mid-rise, far row of towers
  const winTex = windowTexture('#ffd28c'); const bM = new THREE.MeshStandardMaterial({ color: 0x0c0d16, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: .9, roughness: .9 });
  const bGeo = new THREE.BoxGeometry(1, 1, 1); const near = Math.floor(len / 3) * 2, far = 44; const bld = new THREE.InstancedMesh(bGeo, bM, near + far); k = 0; const q4 = new THREE.Quaternion(); const sc = new THREE.Vector3();
  for (let i = 0; i < near; i++) { const t = (Math.floor(i / 2) + .5) / (near / 2); const p = curve.getPointAt(t), tan = curve.getTangentAt(t); const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize(); const sgn = i % 2 ? 1 : -1; const w = 2 + Math.random() * 2.5, h = 3 + Math.random() * 9, d = 2 + Math.random() * 2.5; const c = p.clone().addScaledVector(side, sgn * (8 + Math.random() * 6)); m4.compose(new THREE.Vector3(c.x, h / 2, c.z), q4, sc.set(w, h, d)); bld.setMatrixAt(k++, m4); }
  for (let i = 0; i < far; i++) { const w = 3 + Math.random() * 5, h = 10 + Math.random() * 22, d = 3 + Math.random() * 5; const x = (i % 2 ? 1 : -1) * (18 + Math.random() * 26); const z = -Math.random() * (len + 40) + 10; m4.compose(new THREE.Vector3(x, h / 2, z), q4, sc.set(w, h, d)); bld.setMatrixAt(k++, m4); }
  bld.instanceMatrix.needsUpdate = true; scene.add(bld);
  // neon horizon strip under the skyline
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(260, 2.5), new THREE.MeshBasicMaterial({ map: glowTexture(neonRgb), transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false })); strip.position.set(0, 1.2, -len - 48); scene.add(strip);
  // spectators in small groups near checkpoints
  for (let i = 0; i < n; i++) { const t = n ? i / n : 0; for (let j = 0; j < 3; j++) { const p = curve.getPointAt(Math.min(1, t + (j - 1) * .012)); const tan = curve.getTangentAt(Math.min(1, t)); const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize(); const sgn = (i + j) % 2 ? 1 : -1; const s = sprite(emojiTexture(theme.crowd[(i * 3 + j) % theme.crowd.length]), 1.05, 1.05); s.position.copy(p).addScaledVector(side, sgn * (4.3 + Math.random() * .8)); s.position.y = .7; s.userData.ph = Math.random() * 6; s.userData.wild = Math.random() < .3; scene.add(s); crowd.push(s); } }
  // speed streaks (shown while running)
  const streaks = new THREE.Group(); for (let i = 0; i < 36; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(.03, .03, 2.5 + Math.random() * 3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false })); st.userData.off = new THREE.Vector3((Math.random() - .5) * 7, .4 + Math.random() * 3.5, 0); st.userData.d = Math.random() * 18; streaks.add(st); } streaks.visible = false; scene.add(streaks);
  return { streaks, neon, road };
}

/* ---------- build ---------- */

// Per-chapter scenery: each chapter of a world looks different (sky, water/ground, roadside life, a landmark behind the goal)
const VAR = {
  drive: [
    { name:'Neon city', sky:0x0b0714, fog:0x120a24, ground:0x1a1030, grid:0x6f44c9, crowd:['🙋','🙌','👏','🎉','📣','🏙️','🚕','📸','🥳','🌃'], extra:['🏙️','🌆','🏢'], landmark:'🏙️', treeCol:0xff7fb0 },
    { name:'Desert highway', sky:0x1a0f0a, fog:0x3a2210, ground:0x5a3a1c, grid:0x8a5a2a, asph:0x3a3028, crowd:['🐪','🌵','🙋','🏜️','🦂','🙌','🏕️','⛽','🪨','🎉'], extra:['🏜️','🐪','🌵'], landmark:'🏜️', treeCol:0xc98a3a },
    { name:'Coast road', sky:0x061a2a, fog:0x0e3350, ground:0x0f3a5a, grid:0x2a7aa0, asph:0x2a2e36, crowd:['🌊','⛵','🙋','🐚','🦀','🙌','🏖️','🪸','🎉','🚤'], extra:['🌊','⛵','🏝️'], landmark:'🌉', treeCol:0x3ad0c0 },
    { name:'Mountain pass', sky:0x070b18, fog:0x1a2240, ground:0x2a3040, grid:0x4a5a7a, asph:0x2a2a33, crowd:['🏔️','🌲','🙋','🦌','🧗','🙌','⛺','🦅','🎉','🪵'], extra:['🏔️','🏔️','🌲'], landmark:'🏔️', treeCol:0x2f7a4a },
    { name:'Rain city', sky:0x05070f, fog:0x0c1226, ground:0x0f1430, grid:0x3a4a9a, asph:0x1e2230, crowd:['☔','🌧️','🙋','🚖','🏢','🙌','💡','🧥','🎉','🚦'], extra:['🌧️','🏢','⛈️'], landmark:'🌃', treeCol:0x4a7aff },
    { name:'Sunset highway', sky:0x2a0a1a, fog:0x6a1a3a, ground:0x4a1a2a, grid:0xc9446f, asph:0x2a2630, crowd:['🌇','🙋','🎸','🙌','🚗','📸','🏍️','🎉','🌴','🥳'], extra:['🌇','🌴','🎡'], landmark:'🌅', treeCol:0xff9a3a },
    { name:'Snow road', sky:0x0a1420, fog:0x3a4a60, ground:0xdfe8f2, grid:0xbfd0e0, asph:0x3a4048, k1:0x1e62ff, crowd:['❄️','⛄','🙋','🎿','🦌','🙌','🏔️','☕','🎉','🧣'], extra:['🏔️','❄️','🌲'], landmark:'🗻', treeCol:0xe8f4ff },
    { name:'Forest road', sky:0x05100a, fog:0x0c2a16, ground:0x0f2a16, grid:0x2a6a3a, asph:0x2a2a28, crowd:['🌲','🦌','🙋','🦉','🍄','🙌','🏕️','🐿️','🎉','🪵'], extra:['🌲','🌳','🌲'], landmark:'🌲', treeCol:0x2faa5a },
    { name:'Airport run', sky:0x0a0f1a, fog:0x1a2230, ground:0x202830, grid:0x5a6a7a, asph:0x2a2e33, crowd:['✈️','🧳','🙋','🛫','🚌','🙌','🏭','📡','🎉','🛬'], extra:['✈️','🏭','🛫'], landmark:'🛬', treeCol:0x9ab0c0 },
    { name:'Dawn finish', sky:0x2a1a0a, fog:0x8a5a2a, ground:0x5a4a2a, grid:0xd9a24a, asph:0x2a2a33, crowd:['🌅','🏁','🙋','🎉','🏆','🙌','📸','🥳','🎊','🚩'], extra:['🌅','🏁','🎆'], landmark:'🏆', treeCol:0xffc44a }
  ],
  island: [
    { name:'Blue lagoon', sky:0x5e8dff, fog:0x9fd0ff, ground:0x2f7df6, crowd:['🙋','🏝️','🌴','🐬','🐢','⛵','🐠','🛟','🦜','🌺'], extra:['🏝️','🌴','🐬'], landmark:'🏝️' },
    { name:'Storm sea', sky:0x3a4a60, fog:0x6a7a90, ground:0x1f4a7a, asph:0x1a3a66, crowd:['🌩️','🙋','⛵','🌊','🐙','🙌','🛟','🐋','⚓','🌧️'], extra:['🌩️','🌊','⛈️'], landmark:'🗼' },
    { name:'Sunset bay', sky:0xff8a4a, fog:0xffc08a, ground:0x3a5aa0, asph:0x2a4a90, crowd:['🌇','🙋','⛵','🐬','🌴','🙌','🏖️','🦩','🎉','🐚'], extra:['🌇','🌴','⛵'], landmark:'🌅' },
    { name:'Coral reef', sky:0x6ab8ff, fog:0xbfe6ff, ground:0x1fa0b0, asph:0x1a8aa0, crowd:['🐠','🪸','🙋','🐡','🤿','🙌','🐙','🦀','🎉','🐚'], extra:['🪸','🐠','🏝️'], landmark:'🪸' },
    { name:'Iceberg sea', sky:0xcfe6ff, fog:0xeaf4ff, ground:0x4a8ad0, asph:0x3a7ac0, crowd:['🧊','🐧','🙋','🦭','❄️','🙌','🐋','⛵','🎉','🏔️'], extra:['🧊','🏔️','🐧'], landmark:'🧊' },
    { name:'Volcano island', sky:0x2a0a0a, fog:0x6a2a1a, ground:0x1a3a6a, asph:0x14305a, crowd:['🌋','🙋','🔥','🌴','🦎','🙌','⛵','🪨','🎉','🐢'], extra:['🌋','🔥','🌴'], landmark:'🌋' },
    { name:'Mangrove channel', sky:0x7ac07a, fog:0xbfe0a0, ground:0x2a7a5a, asph:0x1f6a4a, crowd:['🌿','🦩','🙋','🐊','🛶','🙌','🦜','🍃','🎉','🐸'], extra:['🌿','🦩','🌳'], landmark:'🌳' },
    { name:'Night sea', sky:0x060a1a, fog:0x0e1a3a, ground:0x0f2a5a, asph:0x0c2250, crowd:['🌙','⭐','🙋','⛵','🐬','🙌','🏮','🌊','🎉','🦑'], extra:['🌙','⭐','🏮'], landmark:'🌙' },
    { name:'Pirate cove', sky:0x5a4a3a, fog:0x9a8a6a, ground:0x2a5a8a, asph:0x1f4a7a, crowd:['🏴‍☠️','🦜','🙋','⚓','🗺️','🙌','💰','🛶','🎉','🦑'], extra:['🏴‍☠️','⚓','🗺️'], landmark:'🏴‍☠️' },
    { name:'Treasure island', sky:0xffd27a, fog:0xffe6b0, ground:0x2f7df6, asph:0x2457d8, crowd:['💰','🏆','🙋','🌴','🎉','🙌','💎','🦜','🥳','🏝️'], extra:['💰','🏝️','🎆'], landmark:'🏆' }
  ],
  gallery: [
    { name:'Dark forest', sky:0x05060c, fog:0x0b0d16, ground:0x141a14, crowd:['🦉','🐺','🌲','🌲','🕯️','🏮','🪵','🦇','🌲','🪨'], extra:['🌲','🌲','🦉'], landmark:'🌲', treeCol:0x0f1a10 },
    { name:'Black swamp', sky:0x060a06, fog:0x1a2a14, ground:0x1a2a14, asph:0x24301a, crowd:['🐸','🦟','🌿','🕯️','🐊','🏮','🪵','🦇','🌾','🪨'], extra:['🌿','🐊','🌾'], landmark:'🌳', treeCol:0x16301a },
    { name:'River crossing', sky:0x050810, fog:0x0e1a30, ground:0x0f2238, asph:0x2a2418, crowd:['🌊','🛶','🌉','🕯️','🐟','🏮','🪨','🦆','🌲','🪵'], extra:['🌉','🌊','🛶'], landmark:'🌉', treeCol:0x1a3a4a },
    { name:'Red canyon', sky:0x0c0606, fog:0x2a120a, ground:0x3a1e12, asph:0x3a2a1a, crowd:['🪨','🦅','🌵','🕯️','🐎','🏮','🦂','🪨','🔥','🌵'], extra:['🏜️','🪨','🦅'], landmark:'🏜️', treeCol:0x5a3a24 },
    { name:'Burned village', sky:0x120808, fog:0x3a1a0a, ground:0x1a1410, asph:0x2a2418, crowd:['🔥','🏚️','👵','🕯️','🐎','🏮','👨‍🌾','🧒','🔥','🪵'], extra:['🏚️','🔥','🏚️'], landmark:'🏚️', treeCol:0x2a1a10 },
    { name:'Crow caves', sky:0x030306, fog:0x0a0a12, ground:0x0e0e16, asph:0x1a1a22, crowd:['🦇','💎','🕯️','🪨','🦇','🏮','💀','🪨','🔦','🕸️'], extra:['🦇','💎','🪨'], landmark:'🕳️', treeCol:0x14141c },
    { name:'Snow pass', sky:0x0a1020, fog:0x3a4a66, ground:0xc8d4e0, asph:0x3a3a40, k1:0x4a4a56, crowd:['❄️','🐺','🌲','🕯️','🏔️','🏮','🦌','❄️','🪵','⛺'], extra:['🏔️','❄️','🌲'], landmark:'🗻', treeCol:0xdfe8f0 },
    { name:'Desert night', sky:0x080612, fog:0x2a1a30, ground:0x3a2a3a, asph:0x3a2e2a, crowd:['🐪','🌵','🕯️','⭐','🏕️','🏮','🦂','🪨','🌙','🐎'], extra:['🏜️','🐪','🌙'], landmark:'🕌', treeCol:0x5a4a3a },
    { name:'Castle outskirts', sky:0x0a0810, fog:0x2a1c10, ground:0x1a1812, asph:0x2a2418, crowd:['🔥','🛡️','🕯️','🐎','🏮','⚔️','🪨','🔥','🗡️','🏮'], extra:['🏰','🔥','🛡️'], landmark:'🏰', treeCol:0x2a2418 },
    { name:'Crow fortress', sky:0x140606, fog:0x3a0c0c, ground:0x1a0e0e, asph:0x2a1a1a, k1:0x5a1a1a, crowd:['🦹','🔥','🕯️','⚔️','🏮','🛡️','🔥','🗝️','🪨','👸'], extra:['🏰','🔥','🦹'], landmark:'🏰', treeCol:0x2a1212 }
  ]
};
function variant(theme, ch) { const arr = VAR[theme] || VAR.drive; const i = Math.max(0, (Number(ch) || 1) - 1) % arr.length; return arr[i]; }

function build(el, opts) {
  destroy();
  const base = T[opts.theme] || T.drive; const V = opts.chapter ? variant(opts.theme, opts.chapter) : null; const theme = V ? Object.assign({}, base, V) : base; const n = opts.n; const labels = opts.labels || [];
  const w = el.clientWidth || 240, h = el.clientHeight || 600;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(w, h); renderer.shadowMap.enabled = false; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;border-radius:18px';
  el.innerHTML = ''; el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(theme.sky); scene.fog = new THREE.Fog(theme.fog, opts.theme === 'gallery' ? 6 : 14, opts.theme === 'gallery' ? 30 : 46);
  const camera = new THREE.PerspectiveCamera(opts.horizontal ? 42 : 62, w / h, .1, 120);
  // path: a gentle S-curve, nodes spread along it
  const len = opts.horizontal ? Math.max(30, n * 7) : Math.max(36, n * 6.5);
  const pts = []; const steps = 9; for (let i = 0; i <= steps; i++) { const t = i / steps; pts.push(new THREE.Vector3(Math.sin(t * Math.PI * 2.2) * (opts.horizontal ? 1.5 : 3.2), 0, -t * len)); }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .5);
  const isDrive = opts.theme === 'drive'; let DW = null;
  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: theme.ground, map: null, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.05; scene.add(ground);
  if (opts.theme === 'island') { ground.material.color.set(theme.ground); ground.material.transparent = true; ground.material.opacity = .95; ground.userData.wave = true; ground.geometry = new THREE.PlaneGeometry(240, 240, 60, 60); }
  // road
  const crowd = [];
  let asph, kerbL, kerbR;
  if (isDrive) { DW = driveWorld(scene, curve, theme, V || VAR.drive[0], n, len, opts, crowd); asph = DW.road; kerbL = kerbR = asph; }
  else {
  asph = new THREE.Mesh(ribbon(curve, opts.theme === 'island' ? 1.6 : 1.5, 160), new THREE.MeshStandardMaterial({ map: dashTexture(theme.dash, theme.asph), roughness: .9 })); asph.material.map.repeat.set(1, 1); scene.add(asph);
  kerbL = new THREE.Mesh(ribbon(curve, .22, 160, 1.72, .03), new THREE.MeshStandardMaterial({ map: stripeTexture(theme.k1, theme.k2, 2) })); scene.add(kerbL);
  kerbR = new THREE.Mesh(ribbon(curve, .22, 160, -1.72, .03), new THREE.MeshStandardMaterial({ map: stripeTexture(theme.k1, theme.k2, 2) })); scene.add(kerbR);
  }
  if (opts.theme === 'island') { asph.material.transparent = true; asph.material.opacity = .85; }
  // lights
  scene.add(new THREE.AmbientLight(opts.theme === 'gallery' ? 0x6070a0 : isDrive ? 0x8090c0 : 0xffffff, opts.theme === 'island' ? 1.2 : opts.theme === 'gallery' ? .25 : isDrive ? .3 : .35));
  const sun = new THREE.DirectionalLight(0xffffff, opts.theme === 'island' ? 1.6 : .6); sun.position.set(5, 12, 6); scene.add(sun);
  const hemi = new THREE.HemisphereLight(theme.sky, theme.ground, .5); scene.add(hemi);
  // nodes
  const nodes = []; const nodeMat = () => new THREE.MeshStandardMaterial({ color: theme.node, emissive: 0x000000 });
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0; const p = curve.getPointAt(t); const g = new THREE.Group(); g.position.copy(p);
    if (i < n) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.9, .12, 10, 32), nodeMat()); ring.rotation.x = Math.PI / 2; ring.position.y = .06; g.add(ring);
      if (isDrive) { ring.visible = false; const gate = new THREE.Mesh(new THREE.TorusGeometry(3.1, .14, 10, 48, Math.PI), new THREE.MeshStandardMaterial({ color: theme.node, emissive: DW.neon, emissiveIntensity: .9 })); gate.position.y = .2; const tan = curve.getTangentAt(t); gate.lookAt(gate.position.clone().add(tan)); g.add(gate); g.userData.gate = gate; const gl = glowSprite(rgb(DW.neon), 7, 4); gl.position.y = 1.4; gl.material.opacity = .35; g.add(gl); g.userData.gateGlow = gl; }
      if (opts.theme === 'gallery') { const gm = new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: .8, roughness: .4 }); [-1.9, 1.9].forEach(x => { const post = new THREE.Mesh(new THREE.CylinderGeometry(.14, .16, 3.4, 8), gm); post.position.set(x, 1.7, 0); g.add(post); }); const bar = new THREE.Mesh(new THREE.BoxGeometry(4.1, .18, .18), gm); bar.position.y = 3.3; g.add(bar); for (let b = -1.4; b <= 1.4; b += .7) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 3, 6), gm); rod.position.set(b, 1.6, 0); rod.userData.gate = true; g.add(rod); g.userData.rods = (g.userData.rods || []).concat(rod); } const lantern = new THREE.PointLight(0xff9b2f, 4, 7); lantern.position.set(1.9, 3.4, 0); g.add(lantern); lantern.userData.flk = i; }
      const num = sprite(labelTexture(String(i + 1), { px: 46, bg: isDrive ? 'rgba(20,10,40,.85)' : 'rgba(0,0,0,.5)' }), 1.3, .5); num.position.y = isDrive ? 3.6 : .9; g.add(num);
      const lbl = sprite(labelTexture(labels[i] || '', { px: 34, bg: isDrive ? 'rgba(20,10,40,.85)' : 'rgba(0,0,0,.35)', fg: isDrive ? '#ffd766' : '#fff' }), 2.2, .8); lbl.position.set(isDrive ? 3.4 : 2.9, isDrive ? 2.6 : .7, 0); g.add(lbl);
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
  const count = isDrive ? 0 : opts.horizontal ? 18 : Math.max(16, n * 3);
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count; const p = curve.getPointAt(t); const tan = curve.getTangentAt(t); const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize(); const sgn = i % 2 ? 1 : -1;
    const s = sprite(emojiTexture(theme.crowd[(i * 7) % theme.crowd.length]), 1.1 + Math.random() * .5, 1.1 + Math.random() * .5);
    s.position.copy(p).addScaledVector(side, sgn * (2.8 + Math.random() * 1.6)); s.position.y = .7; s.userData.ph = Math.random() * 6; s.userData.wild = Math.random() < .3; scene.add(s); crowd.push(s);
    if (opts.theme === 'gallery' && i % 4 === 0) { const l = new THREE.PointLight(0xff9b2f, 3, 7); l.position.copy(s.position).setY(1.6); l.userData.flk = Math.random() * 6; scene.add(l); crowd.push(l); }
    if (opts.theme === 'gallery') { const tr = new THREE.Mesh(new THREE.ConeGeometry(.9 + Math.random() * .8, 3.5 + Math.random() * 3, 7), new THREE.MeshStandardMaterial({ color: theme.treeCol || 0x0f1a10, roughness: 1 })); tr.position.copy(p).addScaledVector(side, sgn * (4 + Math.random() * 4)).setY(1.6); scene.add(tr); if (i % 5 === 0) { const tr2 = tr.clone(); tr2.position.addScaledVector(side, sgn * 2.5); scene.add(tr2); } }
    if (opts.theme === 'drive' && i % 3 === 0) { const tree = new THREE.Mesh(new THREE.SphereGeometry(.7 + Math.random() * .6, 10, 8), new THREE.MeshStandardMaterial({ color: theme.treeCol || 0xff7fb0, emissive: theme.treeCol || 0xff7fb0, emissiveIntensity: .5 })); tree.position.copy(s.position).addScaledVector(side, sgn * 2.5).setY(1.2); scene.add(tree); }
  }
  // chapter landmark behind the goal and big scenery pieces along the horizon
  if (V) { const lm = sprite(emojiTexture(V.landmark), 9, 9); const gp = curve.getPointAt(1); lm.position.set(gp.x + 4, 5.5, gp.z - 14); scene.add(lm); crowd.push(lm);
    for (let i = 0; i < 9; i++) { const e = V.extra[i % V.extra.length]; const sp = sprite(emojiTexture(e), 3.5 + Math.random() * 3, 3.5 + Math.random() * 3); const t = (i + .5) / 9; const p = curve.getPointAt(t); const tan = curve.getTangentAt(t); const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize(); const sgn = i % 2 ? 1 : -1; sp.position.copy(p).addScaledVector(side, sgn * (9 + Math.random() * 6)); sp.position.y = 2.2 + Math.random(); scene.add(sp); } }
  // stars (night themes)
  if ((opts.theme !== 'island' || (V && V.sky < 0x303030)) && !(isDrive && V && V.sky > 0x200000)) { const sg = new THREE.BufferGeometry(); const sp = []; for (let i = 0; i < 400; i++) sp.push((Math.random() - .5) * 200, 20 + Math.random() * 60, -Math.random() * 200 + 40); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: .35, transparent: true, opacity: .8 }))); }
  else { for (let i = 0; i < 6; i++) { const c = sprite(emojiTexture('☁️'), 6, 3.5); c.position.set((Math.random() - .5) * 60, 9 + Math.random() * 5, -Math.random() * len - 5); c.userData.cloud = .3 + Math.random() * .4; scene.add(c); crowd.push(c); } }
  if (opts.theme === 'gallery') { const moon = sprite(emojiTexture('🌕'), 5, 5); moon.position.set(-14, 22, -len - 10); scene.add(moon); const mg = new THREE.BufferGeometry(); const mp = []; for (let i = 0; i < 260; i++) mp.push((Math.random() - .5) * 30, .2 + Math.random() * 1.6, -Math.random() * len); mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3)); const mist = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0x9aa3b8, size: 1.6, transparent: true, opacity: .16, depthWrite: false })); mist.userData.mist = true; scene.add(mist); crowd.push(mist); }
  // vehicle
  const veh = theme.vehicle === 'car' ? makeCar2(theme) : theme.vehicle === 'ship' ? makeShip() : makeParty(); scene.add(veh);
  R = { el, renderer, scene, camera, curve, nodes, crowd, veh, theme: opts.theme, n, asph, kerbL, kerbR, t: 0, target: 0, from: 0, t0: 0, dur: 0, run: false, jump: null, hurdle: null, horizontal: !!opts.horizontal, ground, raf: null, lastW: w, lastH: h, chase: opts.chase !== false, streaks: DW && DW.streaks, neon: DW ? DW.neon : 0x6f44c9 };
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
  else if (R.theme === 'gallery') { desired = p.clone().addScaledVector(tan, -6); desired.y = 3.2; look = p.clone().addScaledVector(tan, 8); look.y = 1.2; }
  else if (R.theme === 'drive') { desired = p.clone().addScaledVector(tan, -6.5); desired.y = 3.4; look = p.clone().addScaledVector(tan, 10); look.y = 1.0; }
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
  const speed = R.run ? 6 : (R.theme === 'island' ? .6 : .9); R.asph.material.map.offset.y -= dt * speed * .25; if (R.kerbL !== R.asph) { R.kerbL.material.map.offset.y -= dt * speed * .25; R.kerbR.material.map.offset.y -= dt * speed * .25; }
  // vehicle idle motion
  const v = R.veh;
  if (R.theme === 'island') { v.position.y = (v.userData.lift || 0) + Math.sin(now * 1.6) * .08 + (R.jump ? v.position.y - (v.userData.lift || 0) : 0); v.rotation.z = Math.sin(now * 1.2) * .06; }
  if (R.theme === 'drive' && v.userData.wheels) v.userData.wheels.forEach(w => w.rotation.x += dt * (R.run ? 18 : 2.5));
  if (R.theme === 'gallery' && v.userData.people) { v.userData.people.forEach(p => { p.position.y = Math.abs(Math.sin(now * (R.run ? 9 : 3) + p.userData.phase)) * (R.run ? .22 : .06); }); v.userData.torch.intensity = 5 + Math.sin(now * 13) * 1.2 + Math.random() * .6; }
  if (R.ground.userData.wave) { const pos = R.ground.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, Math.sin(x * .35 + now * 1.4) * .12 + Math.cos(y * .3 + now * 1.1) * .12); } pos.needsUpdate = true; }
  // crowd cheer
  R.crowd.forEach(s => { if (s.userData.mist) { const pa = s.geometry.attributes.position; for (let i = 0; i < pa.count; i += 3) pa.setX(i, pa.getX(i) + Math.sin(now * .3 + i) * .004); pa.needsUpdate = true; } else if (s.isSprite && !s.userData.cloud) { s.position.y = .7 + Math.abs(Math.sin(now * (R.run ? 7 : 2.2) + s.userData.ph)) * (s.userData.wild ? .45 : .18); s.material.rotation = Math.sin(now * 3 + s.userData.ph) * .12; } else if (s.userData.cloud) { s.position.x += dt * s.userData.cloud; if (s.position.x > 40) s.position.x = -40; } else if (s.isLight) { s.intensity = 2.4 + Math.sin(now * 11 + s.userData.flk) * .8 + Math.random() * .5; } });
  // hurdle slam / lift
  if (R.hurdle) { const h = R.hurdle; const k = Math.min(1, (now - h.t0) / .45); if (h.lifting) { h.g.position.y = h.baseY + k * 3; h.g.rotation.z = k * .6; h.g.children.forEach(c => { if (c.material) c.material.opacity = 1 - k; }); if (k >= 1) { R.scene.remove(h.g); R.hurdle = null; } } else { const s = .4 + .6 * (k < .6 ? k / .6 * 1.15 : 1.15 - (k - .6) / .4 * .15); h.g.scale.setScalar(s); } }
  if (R.streaks) { R.streaks.visible = !!R.run; if (R.run) { const tan = R.curve.getTangentAt(Math.min(1, Math.max(0, R.t))); R.streaks.children.forEach(st => { st.userData.d -= dt * 40; if (st.userData.d < -4) st.userData.d = 18 + Math.random() * 6; const side = new THREE.Vector3(-tan.z, 0, tan.x); st.position.copy(R.veh.position).addScaledVector(tan, st.userData.d).addScaledVector(side, st.userData.off.x); st.position.y = st.userData.off.y; st.lookAt(st.position.clone().add(tan)); }); } }
  if (R.theme === 'drive') { const fov = R.horizontal ? 42 : (R.run ? 78 : 66); R.camera.fov += (fov - R.camera.fov) * .08; R.camera.updateProjectionMatrix(); }
  // cur node pulse
  R.nodes.forEach((g, i) => { if (g.userData.ring && g.userData.state === 'cur') g.userData.ring.material.emissiveIntensity = .6 + Math.sin(now * 5) * .4; if (g.userData.gate && g.userData.state === 'cur') g.userData.gate.material.emissiveIntensity = 1.2 + Math.sin(now * 5) * .6; });
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
  sceneName(theme, ch) { return variant(theme, ch).name; },
  mount(el, opts) { try { return build(el, opts); } catch (e) { console.warn('G3D mount failed', e); return false; } },
  moveTo(i, o = {}) { if (!R) return 0; const t = R.n ? i / R.n : 0; R.from = R.t; R.target = t; R.t0 = performance.now() / 1000; R.dur = o.dur || (o.fast ? 2.4 : 1.35); R.run = true; if (o.jump) setTimeout(() => this.jump(), R.dur * 1000 * .42); return R.dur; },
  state(i, s) { if (!R) return; const g = R.nodes[i]; if (!g || !g.userData.ring) return; g.userData.state = s; if (g.userData.rods) g.userData.rods.forEach((r, k) => { r.position.y = s === 'ok' ? 4.6 : 1.6; }); const th = T[R.theme]; const c = s === 'ok' ? th.ok : s === 'retry' ? th.retry : s === 'cur' ? th.cur : th.node; g.userData.ring.material.color.set(c); g.userData.ring.material.emissive.set(s ? c : 0x000000); g.userData.ring.material.emissiveIntensity = s === 'cur' ? .8 : s ? .5 : 0; if (g.userData.gate) { g.userData.gate.material.emissive.set(s ? c : R.neon); g.userData.gate.material.emissiveIntensity = s === 'cur' ? 1.4 : s ? 1 : .9; if (g.userData.gateGlow) { g.userData.gateGlow.material.map = glowTexture(rgb(s ? c : R.neon)); g.userData.gateGlow.material.needsUpdate = true; } } },
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
