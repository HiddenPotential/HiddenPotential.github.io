// 3D renderer for Bull Rider (Three.js). The game simulates in 2D "arena pixels"
// (x across the arena, y down from the sky, ground at y = 450); this module maps
// that onto a 3D world measured in meters and draws it.
import * as THREE from 'three';

const PX = 100, CENTER_X = 480, GROUND_Y = 450;
export const wx = (gx) => (gx - CENTER_X) / PX;
export const wy = (gy) => (GROUND_Y - gy) / PX;
const FENCE_X = 4.32;

const V3 = THREE.Vector3;
const SPHERE = new THREE.SphereGeometry(1, 28, 18);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const BOX = new THREE.BoxGeometry(1, 1, 1);

const std = (color, opts) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0 }, opts));

function mesh(geo, mat, parent, pos, scale, rot) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

// Lowest world-space y of a posed model's solid meshes, so it can be kept out of
// the ground. Spheres are measured exactly as ellipsoids; anything else uses its
// bounding box, which runs a hair low for rotated cylinders.
const _lowBox = new THREE.Box3();
function lowestY(root) {
  root.updateMatrixWorld(true);
  let low = Infinity;
  root.traverseVisible((o) => {
    if (!o.isMesh || o.material === OUTLINE_MAT || o.material.transparent) return;
    const e = o.matrixWorld.elements;
    const g = o.geometry;
    let y;
    if (g === SPHERE) {
      y = e[13] - Math.hypot(e[1], e[5], e[9]);
    } else {
      if (!g.boundingBox) g.computeBoundingBox();
      const b = g.boundingBox;
      const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2, cz = (b.min.z + b.max.z) / 2;
      const hx = (b.max.x - b.min.x) / 2, hy = (b.max.y - b.min.y) / 2, hz = (b.max.z - b.min.z) / 2;
      y = e[1] * cx + e[5] * cy + e[9] * cz + e[13] - (Math.abs(e[1]) * hx + Math.abs(e[5]) * hy + Math.abs(e[9]) * hz);
    }
    if (y < low) low = y;
  });
  return low;
}
// Lifts `obj` so no part of it dips below the ground.
function keepAboveGround(obj) {
  const low = lowestY(obj);
  if (low < 0) obj.position.y -= low;
}

// Cartoon outline: a back-face shell pushed out along the normals, so characters
// get a dark rim that separates them from the busy arena.
const OUTLINE_MAT = new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Color('#1a0d06') }, thickness: { value: 0.014 } },
  vertexShader: `uniform float thickness;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      wp.xyz += normalize(mat3(modelMatrix) * normal) * thickness;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: `uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }`,
  side: THREE.BackSide,
});

function addOutline(root) {
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.material.transparent) meshes.push(o);
  });
  for (const m of meshes) {
    const shell = new THREE.Mesh(m.geometry, OUTLINE_MAT);
    shell.castShadow = shell.receiveShadow = false;
    m.add(shell);
  }
}

// Cowboy hat for the crowd: a lathe profile with a pinched crown and an upturned brim,
// squashed a little front-to-back so the brim reads as curled at the sides.
const COWBOY_HAT = (() => {
  const pts = [
    [0, 0.158], [0.045, 0.186], [0.085, 0.182], [0.104, 0.15], [0.112, 0.07], [0.118, 0.03],
    [0.19, 0.022], [0.225, 0.05], [0.24, 0.085], [0.232, 0.068], [0.19, 0.008], [0.118, 0.002], [0, 0.002],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 20);
  g.scale(1, 1, 0.85);
  g.computeVertexNormals();
  return g;
})();
const HAT_COLORS = ['#d2ab6e', '#c49a5c', '#7a4a26', '#5a3418', '#2a201a', '#efe6d2', '#a8342a', '#e8d2a0'];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// A two-segment limb hanging straight down from its pivot. Rotating `root`/`mid`
// around z swings it forward (+x) for positive angles.
function limb(parent, pos, len1, len2, r1, r2, mat) {
  const root = new THREE.Group();
  root.position.set(pos[0], pos[1], pos[2]);
  parent.add(root);
  mesh(SPHERE, mat, root, [0, 0, 0], [r1, r1, r1]);
  mesh(CYL, mat, root, [0, -len1 / 2, 0], [r1, len1, r1]);
  const mid = new THREE.Group();
  mid.position.y = -len1;
  root.add(mid);
  mesh(SPHERE, mat, mid, [0, 0, 0], [r2 * 1.1, r2 * 1.1, r2 * 1.1]);
  mesh(CYL, mat, mid, [0, -len2 / 2, 0], [r2, len2, r2]);
  const end = new THREE.Group();
  end.position.y = -len2;
  mid.add(end);
  return { root, mid, end };
}

// ---------- Bull ----------
const DEFAULT_LOOK = { seed: 1, spots: null, blaze: null, horn: '#efe6cf', hornScale: 1, bulk: 1, aura: null };

function buildBull() {
  const mats = {
    body: std('#9a6440'),
    light: std('#b07a55'),
    dark: std('#1d140d', { roughness: 0.6 }),
    horn: std('#efe6cf', { roughness: 0.45 }),
    eye: std('#ffffff', { roughness: 0.3 }),
    pupil: std('#111111', { roughness: 0.2 }),
    strap: std('#e6dcc4'),
    rope: std('#d9b26f'),
    spot: std('#efe7da'),
    blaze: std('#f2ece2'),
  };
  const root = new THREE.Group();
  const pitch = new THREE.Group();
  root.add(pitch);

  // Bulk widens the barrel without moving the rider's seat.
  const bulky = [
    mesh(SPHERE, mats.body, pitch, [-0.05, 0.74, 0], [1.0, 0.45, 0.42]),
    mesh(SPHERE, mats.light, pitch, [-0.05, 0.62, 0], [0.86, 0.3, 0.38]),
    mesh(SPHERE, mats.body, pitch, [0.42, 1.0, 0], [0.42, 0.32, 0.36]),
    mesh(SPHERE, mats.body, pitch, [0.82, 0.84, 0], [0.34, 0.33, 0.31]),
  ].map((m) => ({ m, base: m.scale.clone() }));

  // Coat spots sit on the barrel's surface; their layout comes from the bull's seed.
  const spots = [];
  const Z_AXIS = new V3(0, 0, 1), tmpN = new V3();
  for (let i = 0; i < 9; i++) {
    const m = mesh(SPHERE, mats.spot, pitch, [0, 0, 0], [0.1, 0.1, 0.02]);
    m.castShadow = false;
    spots.push(m);
  }
  function layoutSpots(seed, bulk) {
    let x = seed || 1;
    const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
    for (const m of spots) {
      const u = -0.75 + rnd() * 1.4; // along the body
      const a = -0.3 + rnd() * 2.0; // around it, mostly on the visible upper side
      const side = rnd() < 0.5 ? -1 : 1;
      const k = Math.sqrt(Math.max(0.05, 1 - u * u));
      const ny = Math.cos(a), nz = Math.sin(a) * side;
      m.position.set(-0.05 + u, 0.74 + ny * 0.45 * bulk * k * 1.02, nz * 0.42 * bulk * k * 1.02);
      m.quaternion.setFromUnitVectors(Z_AXIS, tmpN.set(u * 0.5, ny / 0.45, nz / 0.42).normalize());
      const r = 0.09 + rnd() * 0.12;
      m.scale.set(r * (1 + rnd() * 0.6), r, 0.03);
    }
  }

  const head = new THREE.Group();
  head.position.set(1.0, 0.86, 0);
  pitch.add(head);
  mesh(SPHERE, mats.body, head, [0.16, -0.02, 0], [0.3, 0.24, 0.24]);
  mesh(SPHERE, mats.light, head, [0.4, -0.12, 0], [0.16, 0.14, 0.16]);
  const blaze = mesh(SPHERE, mats.blaze, head, [0.3, 0.04, 0], [0.16, 0.12, 0.13]);
  const horns = [];
  for (const s of [-1, 1]) {
    mesh(SPHERE, mats.dark, head, [0.54, -0.1, s * 0.06], [0.025, 0.03, 0.025]);
    mesh(SPHERE, mats.eye, head, [0.25, 0.07, s * 0.19], [0.05, 0.05, 0.04]);
    mesh(SPHERE, mats.pupil, head, [0.285, 0.07, s * 0.215], [0.026, 0.028, 0.02]);
    mesh(SPHERE, mats.body, head, [0.02, 0.1, s * 0.27], [0.1, 0.04, 0.07], [s * 0.4, 0, 0]);
    const curve = new THREE.CatmullRomCurve3([
      new V3(0.05, 0.13, s * 0.12), new V3(0.02, 0.22, s * 0.34), new V3(0.12, 0.38, s * 0.46), new V3(0.27, 0.46, s * 0.42),
    ]);
    const horn = new THREE.Group();
    horn.position.set(0.05, 0.13, s * 0.12);
    head.add(horn);
    const tube = mesh(new THREE.TubeGeometry(curve, 20, 0.04, 8), mats.horn, horn);
    tube.position.set(-0.05, -0.13, -s * 0.12);
    mesh(SPHERE, mats.horn, horn, [0.22, 0.33, s * 0.3], [0.04, 0.04, 0.04]);
    horns.push(horn);
  }

  const legs = [];
  for (const [x, z, ph] of [[0.62, 0.22, 0], [0.62, -0.22, Math.PI], [-0.6, 0.22, Math.PI], [-0.6, -0.22, 0]]) {
    const l = limb(pitch, [x, 0.58, z], 0.3, 0.26, 0.1, 0.066, mats.body);
    mesh(CYL, mats.dark, l.end, [0, 0.0, 0], [0.08, 0.06, 0.08]);
    legs.push({ ...l, ph });
  }

  const tail = new THREE.Group();
  tail.position.set(-1.02, 0.92, 0);
  pitch.add(tail);
  const tseg = limb(tail, [0, 0, 0], 0.3, 0.3, 0.025, 0.02, mats.body);
  mesh(SPHERE, mats.dark, tseg.end, [0, -0.05, 0], [0.05, 0.1, 0.05]);

  const ring = new THREE.TorusGeometry(1, 0.07, 8, 40);
  mesh(ring, mats.strap, pitch, [-0.55, 0.74, 0], [0.38, 0.41, 0.4], [0, Math.PI / 2, 0]);
  mesh(ring, mats.rope, pitch, [0.3, 0.76, 0], [0.4, 0.45, 0.4], [0, Math.PI / 2, 0]);

  const seat = new THREE.Group();
  seat.position.set(0.05, 1.14, 0);
  pitch.add(seat);

  // Rarity aura: a glow sprite plus a light that pulses around Epic and Legendary bulls.
  const auraTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d').createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    const cx = c.getContext('2d');
    cx.fillStyle = g;
    cx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
  aura.scale.set(3.4, 2.4, 1);
  aura.position.set(0, 0.8, -0.4);
  root.add(aura);
  const auraLight = new THREE.PointLight('#ffc93c', 0, 4, 1.5);
  auraLight.position.set(0.2, 1.6, 0.6);
  root.add(auraLight);

  let colorKey = '', lookKey = '';
  let auraOn = false;
  function update(b) {
    root.position.set(wx(b.x), -b.hop / PX, 0);
    root.rotation.y = b.yaw;
    pitch.rotation.z = -b.pitch;
    head.rotation.z = -(0.35 + b.dip);
    for (const l of legs) {
      l.root.rotation.z = Math.sin(b.legPhase + l.ph) * 0.35;
      l.mid.rotation.z = -Math.max(0, Math.sin(b.legPhase + l.ph + 0.8)) * 0.6;
    }
    tail.rotation.z = -0.35 + Math.sin(b.tailPhase * 0.7) * 0.15;
    tail.rotation.x = Math.sin(b.tailPhase) * 0.45;
    tseg.mid.rotation.x = Math.sin(b.tailPhase - 0.8) * 0.4;
    if (b.color !== colorKey) {
      colorKey = b.color;
      const c = new THREE.Color(b.color);
      mats.body.color.copy(c);
      mats.light.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.18);
    }
    const look = b.look || DEFAULT_LOOK;
    const key = JSON.stringify(look);
    if (key !== lookKey) {
      lookKey = key;
      for (const m of spots) m.visible = !!look.spots;
      if (look.spots) {
        mats.spot.color.set(look.spots);
        layoutSpots(look.seed, look.bulk);
      }
      blaze.visible = !!look.blaze;
      if (look.blaze) mats.blaze.color.set(look.blaze);
      mats.horn.color.set(look.horn);
      mats.horn.emissive.set(look.horn === DEFAULT_LOOK.horn ? '#000000' : look.horn);
      mats.horn.emissiveIntensity = look.horn === DEFAULT_LOOK.horn ? 0 : 0.35;
      for (const h of horns) h.scale.setScalar(look.hornScale);
      for (const { m, base } of bulky) m.scale.set(base.x, base.y * look.bulk, base.z * look.bulk);
      auraOn = !!look.aura;
      aura.visible = auraOn;
      if (auraOn) {
        aura.material.color.set(look.aura);
        auraLight.color.set(look.aura);
      }
    }
    const pulse = 0.75 + 0.25 * Math.sin(b.legPhase * 0.5 + performance.now() / 300);
    aura.material.opacity = auraOn ? 0.45 * pulse : 0;
    auraLight.intensity = auraOn ? 2.5 * pulse : 0;
  }
  return { root, seat, update };
}

// ---------- Other mounts ----------
// A shared four-legged rig: the species fills in body, head and extras, and the
// rig handles motion, coat color and the rarity glow the same way the bull does.
const THIGH = new THREE.CylinderGeometry(1, 0.62, 1, 16);
const SHIN = new THREE.CylinderGeometry(0.8, 1, 1, 14);
const HOOF = new THREE.CylinderGeometry(0.85, 1.1, 1, 14);
const CLAW = new THREE.ConeGeometry(1, 1, 6);

// A muscled leg: a haunch where it meets the body, a tapering thigh, a knee and
// a shin ending in a hoof (or claws). Same joints as limb() so the gait code works.
function leg(parent, pos, len1, len2, r1, r2, mat, footMat, claws) {
  const root = new THREE.Group();
  root.position.set(pos[0], pos[1], pos[2]);
  parent.add(root);
  mesh(SPHERE, mat, root, [0, -len1 * 0.12, 0], [r1 * 1.55, r1 * 2.3, r1 * 1.35]);
  mesh(THIGH, mat, root, [0, -len1 / 2, 0], [r1, len1, r1]);
  const mid = new THREE.Group();
  mid.position.y = -len1;
  root.add(mid);
  mesh(SPHERE, mat, mid, [0, 0, 0], [r2 * 1.08, r2 * 1.08, r2 * 1.05]);
  mesh(SHIN, mat, mid, [0, -len2 / 2, 0], [r2, len2, r2]);
  const end = new THREE.Group();
  end.position.y = -len2;
  mid.add(end);
  mesh(SPHERE, mat, end, [0, 0.03, 0], [r2 * 1.04, r2 * 1.02, r2 * 1.04]);
  if (claws) {
    mesh(SPHERE, mat, end, [r2 * 0.5, -0.02, 0], [r2 * 1.6, r2 * 0.6, r2 * 1.3]);
    for (const a of [-0.45, 0, 0.45]) mesh(CLAW, footMat, end, [r2 * 1.6 + Math.cos(a) * r2, -0.03, Math.sin(a) * r2 * 1.2], [r2 * 0.28, r2 * 0.9, r2 * 0.28], [0, -a, -Math.PI / 2]);
  } else {
    mesh(HOOF, footMat, end, [0, -0.02, 0], [r2 * 1.2, 0.09, r2 * 1.2]);
  }
  return { root, mid, end };
}

function buildQuadruped(spec) {
  const mats = {
    body: std('#8b5a2b'),
    light: std('#a87a50'),
    dark: std('#1d140d', { roughness: 0.6 }),
    eye: std('#ffffff', { roughness: 0.3 }),
    pupil: std('#111111', { roughness: 0.2 }),
    strap: std('#e6dcc4'),
    rope: std('#d9b26f'),
    accent: std(spec.accent || '#2a1d15'),
  };
  const root = new THREE.Group();
  const pitch = new THREE.Group();
  root.add(pitch);
  const head = new THREE.Group();
  head.position.set(...spec.headPos);
  pitch.add(head);
  spec.build(pitch, head, mats);

  const legs = [];
  const [fx, bx, lz] = spec.legX;
  const footMat = spec.foot ? std(spec.foot, { roughness: 0.5 }) : mats.dark;
  for (const [x, z, ph] of [[fx, lz, 0], [fx, -lz, Math.PI], [bx, lz, Math.PI], [bx, -lz, 0]]) {
    const l = leg(pitch, [x, spec.legY, z], spec.len[0], spec.len[1], spec.r[0], spec.r[1], spec.legMat === 'accent' ? mats.accent : mats.body, footMat, spec.claws);
    legs.push({ ...l, ph });
  }

  // Species that draw their own tail in build() leave spec.tail out.
  const tail = new THREE.Group();
  let tseg = null;
  if (spec.tail) {
    tail.position.set(...spec.tailPos);
    pitch.add(tail);
    tseg = limb(tail, [0, 0, 0], spec.tail[0], spec.tail[1], spec.tail[2], spec.tail[2] * 0.8, spec.tailMat === 'accent' ? mats.accent : mats.body);
    if (spec.tailTip) spec.tailTip(tseg.end, mats);
  }

  const [gx, gy, gr, gry] = spec.girth;
  bullRope(pitch, mats.rope, gx, gy, gr, gry);

  const seat = new THREE.Group();
  seat.position.set(...spec.seat);
  pitch.add(seat);

  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  aura.scale.set(3.4, 2.6, 1);
  aura.position.set(0, spec.seat[1] * 0.7, -0.4);
  root.add(aura);

  let colorKey = '';
  function update(b) {
    const hover = spec.hover ? spec.hover + Math.sin(performance.now() / 320) * 0.08 : 0;
    root.position.set(wx(b.x), -b.hop / PX + hover, 0);
    root.rotation.y = b.yaw;
    pitch.rotation.z = -b.pitch;
    head.rotation.z = -(spec.headRest + b.dip);
    for (const l of legs) {
      l.root.rotation.z = Math.sin(b.legPhase + l.ph) * 0.35;
      l.mid.rotation.z = -Math.max(0, Math.sin(b.legPhase + l.ph + 0.8)) * 0.6;
    }
    if (tseg) {
      tail.rotation.z = spec.tailRest + Math.sin(b.tailPhase * 0.7) * 0.15;
      tail.rotation.x = Math.sin(b.tailPhase) * 0.45;
      tseg.mid.rotation.x = Math.sin(b.tailPhase - 0.8) * 0.4;
    }
    if (b.color !== colorKey) {
      colorKey = b.color;
      const c = new THREE.Color(b.color);
      mats.body.color.copy(c);
      mats.light.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.2);
    }
    const look = b.look || DEFAULT_LOOK;
    aura.visible = !!look.aura;
    if (look.aura) {
      aura.material.color.set(look.aura);
      aura.material.opacity = 0.45 * (0.75 + 0.25 * Math.sin(performance.now() / 300));
    }
    if (spec.animate) spec.animate(b, look);
  }
  return { root, seat, update, lift: spec.lift || 0 };
}

// A smooth tapering neck: one tube along a curve, radius easing from r0 to r1,
// flattened side-to-side by `squash`, with rounded ends.
function neck(parent, mat, points, r0, r1, n = 9, squash = 0.85) {
  const curve = new THREE.CatmullRomCurve3(points);
  const T = Math.max(16, n * 3), RS = 18;
  const geo = new THREE.TubeGeometry(curve, T, 1, RS, false);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const c = new V3(), v = new V3();
  for (let i = 0; i <= T; i++) {
    curve.getPointAt(i / T, c);
    const k = i / T, r = r0 + (r1 - r0) * (k * k * (3 - 2 * k));
    for (let j = 0; j <= RS; j++) {
      const idx = i * (RS + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r);
      v.z *= squash;
      pos.setXYZ(idx, c.x + v.x, c.y + v.y, c.z + v.z);
      v.fromBufferAttribute(nor, idx);
      v.z /= squash;
      v.normalize();
      nor.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  mesh(geo, mat, parent);
  const a = curve.getPointAt(0), b = curve.getPointAt(1);
  mesh(SPHERE, mat, parent, [a.x, a.y, a.z], [r0, r0, r0 * squash]);
  mesh(SPHERE, mat, parent, [b.x, b.y, b.z], [r1, r1, r1 * squash]);
}

// The bull rope: a braided loop around the barrel with a short tail where it's tied.
const ROPE_RING = new THREE.TorusGeometry(1, 0.035, 8, 48);
function bullRope(parent, mat, x, y, r, ry = r * 1.1) {
  mesh(ROPE_RING, mat, parent, [x, y, 0], [r, ry, r], [0, Math.PI / 2, 0]);
  mesh(SPHERE, mat, parent, [x, y + ry * 0.98, r * 0.15], [0.05, 0.04, 0.05]);
  mesh(CYL, mat, parent, [x + 0.02, y + ry * 0.78, r * 0.35], [0.022, ry * 0.45, 0.022], [0.5, 0, 0.1]);
}

// A cylinder stretched between two points (bones, struts).
const UP = new V3(0, 1, 0);
function rod(parent, mat, a, b, r) {
  const m = mesh(CYL, mat, parent, [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2], [r, a.distanceTo(b), r]);
  m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  return m;
}

// A smooth tube swept along a list of points, with a radius per point and a rounded
// tip. Call update() again with new points to bend it (tentacles, tails); the outline
// shell shares the geometry so it bends too. `under(t, c)` gives how much of the
// second paint color a vertex gets, from how far along it is (t, 0..1) and how much
// it faces the frame's N side (c, -1..1); paint() applies the two colors.
function sweep(parent, n, radial, under) {
  const rings = n + 1, tip = rings * radial;
  const pos = new Float32Array((tip + 1) * 3), nor = new Float32Array((tip + 1) * 3), col = new Float32Array((tip + 1) * 3);
  const idx = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + ((j + 1) % radial);
      idx.push(a, b, a + radial, b, b + radial, a + radial);
    }
  }
  for (let j = 0; j < radial; j++) idx.push(n * radial + j, n * radial + ((j + 1) % radial), tip);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new V3(), 6);
  const m = mesh(geo, std('#ffffff', { vertexColors: true }), parent);
  const weights = new Float32Array(tip + 1);
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radial; j++) weights[i * radial + j] = under ? under(i / n, Math.cos((j / radial) * Math.PI * 2)) : 0;
  }
  weights[tip] = weights[tip - radial];
  const T = [], N = [], B = [];
  for (let i = 0; i < rings; i++) T.push(new V3()), N.push(new V3()), B.push(new V3());
  const end = new THREE.Group();
  parent.add(end);
  const basis = new THREE.Matrix4(), d = new V3();
  const ca = new THREE.Color(), cb = new THREE.Color(), c = new THREE.Color();
  return {
    mesh: m, end, T, N, B,
    // pts: V3 per ring; rad: radius per ring; side: a vector roughly across the curve,
    // which sets the starting N (N = side x T) so paint stays on a consistent side.
    update(pts, rad, side) {
      for (let i = 0; i < rings; i++) {
        T[i].subVectors(pts[Math.min(n, i + 1)], pts[Math.max(0, i - 1)]).normalize();
        if (i === 0) N[0].crossVectors(side, T[0]).normalize();
        else N[i].copy(N[i - 1]).addScaledVector(T[i], -N[i - 1].dot(T[i])).normalize();
        B[i].crossVectors(T[i], N[i]);
        for (let j = 0; j < radial; j++) {
          const a = (j / radial) * Math.PI * 2;
          d.copy(N[i]).multiplyScalar(Math.cos(a)).addScaledVector(B[i], Math.sin(a));
          const k = (i * radial + j) * 3;
          nor[k] = d.x; nor[k + 1] = d.y; nor[k + 2] = d.z;
          pos[k] = pts[i].x + d.x * rad[i]; pos[k + 1] = pts[i].y + d.y * rad[i]; pos[k + 2] = pts[i].z + d.z * rad[i];
        }
      }
      const e = pts[n], t = T[n], r = rad[n];
      pos[tip * 3] = e.x + t.x * r; pos[tip * 3 + 1] = e.y + t.y * r; pos[tip * 3 + 2] = e.z + t.z * r;
      nor[tip * 3] = t.x; nor[tip * 3 + 1] = t.y; nor[tip * 3 + 2] = t.z;
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;
      end.position.copy(e);
      end.quaternion.setFromRotationMatrix(basis.makeBasis(T[n], N[n], B[n]));
    },
    paint(base, second) {
      ca.set(base);
      cb.set(second);
      for (let i = 0; i <= tip; i++) {
        c.copy(ca).lerp(cb, weights[i]);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      geo.attributes.color.needsUpdate = true;
    },
  };
}

// Points along a chain that bends by angle(s) (radians from +x in its plane, s 0..1),
// starting at `base` and running along horizontal direction `dir`.
function chain(out, base, dir, len, angle) {
  const n = out.length - 1, step = len / n;
  out[0].copy(base);
  for (let i = 1; i <= n; i++) {
    const a = angle((i - 0.5) / n);
    out[i].copy(out[i - 1]).addScaledVector(dir, Math.cos(a) * step);
    out[i].y += Math.sin(a) * step;
  }
  return out;
}

// A flat shape with a little thickness, so fins and wings read from any angle.
function slab(shape, depth, bevel = depth * 0.6) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}

const HIGHLIGHT = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }); // transparent: skips the outline shell

// Eyes with a pupil, a catch-light and an upper lid in the skin color.
// `pupil` is 'round', 'slit' (dragon) or 'bar' (goats, octopus).
function eyes(head, mats, x, y, z, r, pupil = 'round', irisColor, lidMat = mats.body) {
  const iris = irisColor ? std(irisColor, { roughness: 0.3, emissive: new THREE.Color(irisColor), emissiveIntensity: 0.25 }) : null;
  for (const s of [-1, 1]) {
    mesh(SPHERE, iris || mats.eye, head, [x, y, s * z], [r, r, r * 0.8]);
    const px = x + r * 0.62, pz = s * (z + r * 0.42);
    if (pupil === 'slit') mesh(SPHERE, mats.pupil, head, [px, y, pz], [r * 0.18, r * 0.75, r * 0.4]);
    else if (pupil === 'bar') mesh(SPHERE, mats.pupil, head, [px, y, pz], [r * 0.3, r * 0.22, r * 0.6]);
    else mesh(SPHERE, mats.pupil, head, [px, y, pz], [r * 0.5, r * 0.55, r * 0.4]);
    const hl = mesh(SPHERE, HIGHLIGHT, head, [px + r * 0.08, y + r * 0.32, pz + s * r * 0.08], [r * 0.16, r * 0.16, r * 0.1]);
    hl.castShadow = false;
    mesh(SPHERE, lidMat, head, [x - r * 0.05, y + r * 0.42, s * z], [r * 1.12, r * 0.62, r * 0.98], [s * 0.15, 0, -0.15]);
  }
}

function buildBronco() {
  let blaze;
  return buildQuadruped({
    headPos: [1.12, 1.62, 0], headRest: -0.35, lift: 0.3,
    legY: 1.0, legX: [0.6, -0.6, 0.2], len: [0.5, 0.48], r: [0.1, 0.055],
    tailPos: [-0.98, 1.3, 0], tail: [0.18, 0.2, 0.06], tailRest: -0.45, tailMat: 'accent',
    girth: [0.32, 1.2, 0.33, 0.38], seat: [0.0, 1.55, 0],
    accent: '#1e1612',
    tailTip(end, mats) {
      // A long flowing tail of tapering hair locks.
      mesh(SPHERE, mats.accent, end, [0, -0.05, 0], [0.09, 0.14, 0.08]);
      for (let i = 0; i < 5; i++) {
        const a = (i - 2) * 0.06;
        mesh(new THREE.ConeGeometry(0.07, 0.8, 10), mats.accent, end, [Math.sin(a) * 0.05, -0.38, a * 0.25], null, [a, 0, Math.PI + a * 0.3]);
      }
    },
    build(pitch, head, mats) {
      mesh(SPHERE, mats.body, pitch, [0, 1.2, 0], [0.92, 0.38, 0.34]);
      mesh(SPHERE, mats.body, pitch, [0.5, 1.22, 0], [0.45, 0.4, 0.33]); // chest
      mesh(SPHERE, mats.body, pitch, [-0.55, 1.24, 0], [0.42, 0.38, 0.34]); // rump
      mesh(SPHERE, mats.light, pitch, [0.05, 1.04, 0], [0.75, 0.22, 0.28]);
      neck(pitch, mats.body, [new V3(0.62, 1.32, 0), new V3(0.85, 1.52, 0), new V3(1.05, 1.66, 0)], 0.27, 0.15, 8, 0.75);
      // Mane: a row of flat locks down the top of the neck, plus a forelock.
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        mesh(SPHERE, mats.accent, pitch, [0.62 + t * 0.45, 1.62 + t * 0.14 - Math.sin(t * Math.PI) * 0.02, (i % 2 ? 1 : -1) * 0.03], [0.1, 0.17, 0.05], [0, 0, -0.8 + (i % 2) * 0.2]);
      }
      mesh(SPHERE, mats.body, head, [0.1, 0, 0], [0.2, 0.17, 0.15]);
      mesh(SPHERE, mats.body, head, [0.36, -0.1, 0], [0.24, 0.12, 0.12], [0, 0, -0.3]);
      mesh(SPHERE, mats.light, head, [0.54, -0.18, 0], [0.1, 0.08, 0.1]); // muzzle
      mesh(SPHERE, mats.accent, head, [0.06, 0.16, 0], [0.12, 0.06, 0.08], [0, 0, 0.6]); // forelock
      blaze = mesh(SPHERE, std('#f4efe6'), head, [0.32, -0.02, 0], [0.24, 0.05, 0.08], [0, 0, -0.3]);
      for (const s of [-1, 1]) {
        mesh(new THREE.ConeGeometry(0.045, 0.17, 8), mats.body, head, [0.0, 0.2, s * 0.08], null, [s * 0.25, 0, 0.15]);
        mesh(SPHERE, mats.dark, head, [0.6, -0.15, s * 0.055], [0.025, 0.03, 0.02]);
      }
      eyes(head, mats, 0.18, 0.06, 0.13, 0.038);
      // Saddle shaped to the back: seat, raised pommel and cantle, a short horn, stirrups.
      const leather = std('#5a2d10', { roughness: 0.6 });
      mesh(SPHERE, leather, pitch, [0, 1.535, 0], [0.36, 0.11, 0.36]);
      mesh(SPHERE, leather, pitch, [-0.26, 1.6, 0], [0.08, 0.1, 0.22]); // cantle
      mesh(SPHERE, leather, pitch, [0.24, 1.6, 0], [0.09, 0.08, 0.17]); // pommel
      mesh(CYL, leather, pitch, [0.28, 1.68, 0], [0.028, 0.08, 0.028]); // horn
      mesh(SPHERE, leather, pitch, [0.28, 1.725, 0], [0.05, 0.022, 0.05]);
      for (const s of [-1, 1]) {
        mesh(BOX, leather, pitch, [0.02, 1.34, s * 0.345], [0.06, 0.36, 0.018]);
        mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14), std('#8a8a8a', { metalness: 0.7, roughness: 0.35 }), pitch, [0.02, 1.13, s * 0.35], null, [0, 0, 0]);
      }
    },
    animate(b, look) {
      blaze.visible = !!look.blaze;
    },
  });
}

function buildRam() {
  return buildQuadruped({
    headPos: [0.72, 0.72, 0], headRest: 0.15, lift: -0.15,
    legY: 0.42, legX: [0.4, -0.4, 0.16], len: [0.22, 0.2], r: [0.06, 0.045], legMat: 'accent',
    tailPos: [-0.72, 0.68, 0], tail: [0.1, 0.1, 0.05], tailRest: -0.6,
    girth: [0.15, 0.62, 0.38, 0.35], seat: [-0.05, 0.92, 0],
    accent: '#2b2420',
    build(pitch, head, mats) {
      // Lumpy wool coat made of overlapping puffs.
      mesh(SPHERE, mats.body, pitch, [0, 0.62, 0], [0.68, 0.34, 0.36]);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        mesh(SPHERE, i % 2 ? mats.body : mats.light, pitch, [Math.cos(a) * 0.5, 0.7 + Math.abs(Math.sin(a)) * 0.15, Math.sin(a) * 0.26], [0.2, 0.2, 0.2]);
      }
      mesh(SPHERE, mats.light, head, [0.02, 0.1, 0], [0.16, 0.12, 0.16]);
      mesh(SPHERE, mats.accent, head, [0.16, -0.02, 0], [0.2, 0.14, 0.13], [0, 0, -0.3]);
      for (const s of [-1, 1]) {
        // Curled horns.
        const horn = mesh(new THREE.TorusGeometry(0.12, 0.045, 8, 20, Math.PI * 1.6), std('#d9c9a0', { roughness: 0.5 }), head, [0.0, 0.04, s * 0.17], null, [0, s * 0.3, 0.6]);
        horn.castShadow = false;
        mesh(SPHERE, mats.accent, head, [0.0, 0.0, s * 0.16], [0.08, 0.03, 0.06], [s * 0.6, 0, 0]);
      }
      for (const s of [-1, 1]) mesh(SPHERE, mats.accent, head, [0.04, -0.02, s * 0.2], [0.09, 0.03, 0.05], [s * 0.5, 0, -0.3]); // ears
      eyes(head, mats, 0.18, 0.04, 0.1, 0.03, 'bar', '#e8c060');
    },
  });
}

function buildCamel() {
  return buildQuadruped({
    headPos: [1.42, 2.05, 0], headRest: -0.15, lift: 0.6,
    legY: 1.25, legX: [0.6, -0.55, 0.2], len: [0.66, 0.6], r: [0.1, 0.065],
    tailPos: [-0.9, 1.5, 0], tail: [0.35, 0.25, 0.03], tailRest: -0.2,
    girth: [-0.35, 1.48, 0.38], seat: [0.05, 2.02, 0],
    accent: '#8a6a3c',
    tailTip(end, mats) {
      mesh(SPHERE, mats.accent, end, [0, -0.06, 0], [0.05, 0.12, 0.04]);
    },
    build(pitch, head, mats) {
      mesh(SPHERE, mats.body, pitch, [0, 1.48, 0], [0.92, 0.4, 0.38]);
      mesh(SPHERE, mats.light, pitch, [0, 1.38, 0], [0.75, 0.26, 0.34]);
      mesh(SPHERE, mats.body, pitch, [0.05, 1.8, 0], [0.45, 0.32, 0.3]); // hump
      // Long curved neck.
      neck(pitch, mats.body, [new V3(0.62, 1.55, 0), new V3(1.05, 1.42, 0), new V3(1.3, 1.72, 0), new V3(1.42, 2.02, 0)], 0.24, 0.12, 12);
      mesh(SPHERE, mats.body, head, [0.1, 0, 0], [0.18, 0.13, 0.13]);
      mesh(SPHERE, mats.light, head, [0.3, -0.05, 0], [0.16, 0.1, 0.1]);
      for (const s of [-1, 1]) {
        mesh(SPHERE, mats.body, head, [-0.02, 0.12, s * 0.09], [0.04, 0.06, 0.03]);
        mesh(SPHERE, mats.dark, head, [0.44, -0.04, s * 0.04], [0.02, 0.02, 0.02]);
      }
      eyes(head, mats, 0.14, 0.06, 0.11, 0.035);
      for (const s of [-1, 1]) mesh(BOX, mats.dark, head, [0.15, 0.1, s * 0.13], [0.07, 0.008, 0.02], [0, 0, -0.3]); // lashes
      mesh(SPHERE, mats.light, head, [0.38, -0.12, 0], [0.1, 0.05, 0.08]); // droopy lip
      mesh(SPHERE, mats.accent, pitch, [0.7, 1.35, 0], [0.18, 0.22, 0.14]); // chest pad
      const blanket = canvasTex(64, 64, (c, w, h) => {
        for (let i = 0; i < 8; i++) {
          c.fillStyle = ['#b8322a', '#f2c14e', '#2f6fb3', '#f4efe6'][i % 4];
          c.fillRect(0, (i * h) / 8, w, h / 8 + 1);
        }
      });
      mesh(SPHERE, std('#ffffff', { map: blanket }), pitch, [0.05, 1.82, 0], [0.5, 0.2, 0.34]);
    },
  });
}

// A free-form rig for creatures that aren't four-legged: the species builds its
// body on `pitch` and returns an animate(b) that moves its fins, tentacles or legs.
function buildCreature(spec) {
  const mats = {
    body: std('#3c5a78'),
    light: std('#6a86a0'),
    belly: std(spec.belly || '#e8e4dc'),
    dark: std('#1d140d', { roughness: 0.6 }),
    eye: std('#ffffff', { roughness: 0.3 }),
    pupil: std('#111111', { roughness: 0.2 }),
    rope: std('#d9b26f'),
    accent: std(spec.accent || '#2a1d15'),
  };
  const root = new THREE.Group();
  const pitch = new THREE.Group();
  root.add(pitch);
  const parts = spec.build(pitch, mats);
  const seat = new THREE.Group();
  seat.position.set(...spec.seat);
  pitch.add(seat);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  aura.scale.set(3.8, 3, 1);
  aura.position.set(0, spec.seat[1] * 0.7, -0.5);
  root.add(aura);

  let colorKey = '';
  function update(b) {
    const hover = spec.hover ? spec.hover + Math.sin(performance.now() / 500) * 0.08 : 0;
    root.position.set(wx(b.x), -b.hop / PX + hover, 0);
    root.rotation.y = b.yaw;
    pitch.rotation.z = -b.pitch;
    if (b.color !== colorKey) {
      colorKey = b.color;
      const c = new THREE.Color(b.color);
      mats.body.color.copy(c);
      mats.light.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.25);
    }
    const look = b.look || DEFAULT_LOOK;
    aura.visible = !!look.aura;
    if (look.aura) {
      aura.material.color.set(look.aura);
      aura.material.opacity = 0.45 * (0.75 + 0.25 * Math.sin(performance.now() / 300));
    }
    parts.animate(b);
  }
  return { root, seat, update, lift: spec.lift || 0 };
}

function buildWhale() {
  let coatKey = '', tail, tailPts, fins, spout, spoutMat, recolor;
  const BODY_Y = 1.15, SY = 0.9, SZ = 0.95;
  // Body profile as [radius, x] from the tail stock back (-x) to the rounded head (+x).
  const prof = [[0, -1.1], [0.2, -1.05], [0.33, -0.85], [0.47, -0.5], [0.58, -0.1], [0.66, 0.35], [0.69, 0.75], [0.67, 1.1], [0.6, 1.4], [0.48, 1.62], [0.31, 1.77], [0.13, 1.84], [0, 1.86]];
  const radiusAt = (x) => {
    for (let i = 1; i < prof.length; i++) {
      if (x <= prof[i][1]) {
        const [r0, x0] = prof[i - 1], [r1, x1] = prof[i];
        return r0 + ((r1 - r0) * (x - x0)) / (x1 - x0);
      }
    }
    return 0;
  };
  // A point on the skin at body-x `x`, height `y`, on side s (+1 toward the camera).
  const skin = (x, y, s, out = 0) => {
    const r = radiusAt(x), dy = (y - BODY_Y) / (SY * r);
    return new V3(x, y, s * (SZ * r * Math.sqrt(Math.max(0, 1 - dy * dy)) + out));
  };
  return buildCreature({
    seat: [0.1, 1.76, 0], lift: 0.45, hover: 0.15, belly: '#eef2f4',
    build(pitch, mats) {
      const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48, 0, Math.PI * 2);
      const pos = geo.attributes.position;
      const cols = new Float32Array(pos.count * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      mesh(geo, std('#ffffff', { vertexColors: true, roughness: 0.75 }), pitch, [0, BODY_Y, 0], [SY, 1, SZ], [0, 0, -Math.PI / 2]);
      // Local +x of the lathe points down once rotated, so that side is the belly,
      // with throat grooves along the front half.
      const coat = new THREE.Color(), white = new THREE.Color('#eef2f4'), groove = new THREE.Color('#b4bec8'), c = new THREE.Color();
      recolor = (hex) => {
        coat.set(hex);
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const nx = x / (Math.hypot(x, z) || 1);
          const k = THREE.MathUtils.smoothstep(nx, -0.3, 0.1) * THREE.MathUtils.smoothstep(y, -1.0, -0.6);
          c.copy(coat).lerp(white, k);
          if (k > 0.85 && y > 0.2 && y < 1.7 && Math.abs(Math.sin(Math.atan2(z, x) * 11)) < 0.22) c.copy(groove);
          cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
        }
        geo.attributes.color.needsUpdate = true;
        tail.paint(hex, '#eef2f4');
      };

      // Tail stock: a tapering tube that rises a little and beats up and down.
      tail = sweep(pitch, 12, 14, (t, cn) => THREE.MathUtils.smoothstep(cn, 0.1, 0.5));
      tailPts = Array.from({ length: 13 }, () => new V3());
      // Flukes on the end of the tail, lying flat and swept back at the tips.
      const half = [[0, 0.05], [0.08, 0.25], [0.22, 0.52], [0.4, 0.8], [0.55, 0.92], [0.62, 0.86], [0.56, 0.62], [0.47, 0.36], [0.42, 0.14], [0.33, 0]];
      const outline = half.concat(half.slice(0, -1).reverse().map(([x, w]) => [x, -w]));
      const flukeGeo = slab(new THREE.Shape(outline.map(([x, w]) => new THREE.Vector2(x - 0.06, w))), 0.05, 0.025);
      mesh(flukeGeo, mats.body, tail.end, [0, 0, 0], null, [Math.PI / 2, 0, 0]);

      // Mouth: a long smile curling up toward the eye, which sits low by the corner.
      for (const s of [-1, 1]) {
        const pts = [[1.84, 1.03], [1.66, 0.94], [1.4, 0.9], [1.12, 0.92], [0.98, 0.99]].map(([x, y]) => skin(x, y, s, 0.005));
        mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.018, 6), mats.dark, pitch);
        const eye = skin(1.08, 1.09, s, -0.03);
        eyes(pitch, mats, eye.x, eye.y, Math.abs(eye.z), 0.065);
        const cheek = skin(1.0, 0.96, s, -0.02);
        mesh(SPHERE, std('#e89aa8', { roughness: 0.9 }), pitch, [cheek.x, cheek.y, cheek.z], [0.07, 0.04, 0.03]);
      }
      // Blowhole and a few barnacles on the head.
      mesh(SPHERE, mats.dark, pitch, [0.95, BODY_Y + SY * radiusAt(0.95) - 0.005, 0], [0.08, 0.02, 0.05]);
      const barnacle = std('#cfcabd', { roughness: 1 });
      for (const [x, a] of [[1.45, 0.3], [1.38, -0.4], [1.55, 0.05], [1.25, 0.7], [1.6, -0.9]]) {
        const r = radiusAt(x);
        mesh(SPHERE, barnacle, pitch, [x, BODY_Y + Math.cos(a) * SY * r, Math.sin(a) * SZ * r], [0.045, 0.03, 0.045]);
      }
      // Small hooked dorsal fin behind the rider.
      const dorsal = new THREE.Shape([[0.22, 0], [0.02, 0.06], [-0.14, 0.22], [-0.2, 0.25], [-0.16, 0.12], [-0.22, 0]].map(([x, y]) => new THREE.Vector2(x, y)));
      mesh(slab(dorsal, 0.07, 0.03), mats.body, pitch, [-0.7, BODY_Y + SY * radiusAt(-0.7) - 0.05, 0]);

      // Long paddle flippers with a bumpy leading edge, pale underneath.
      const fin = new THREE.Shape();
      fin.moveTo(0, -0.14);
      fin.quadraticCurveTo(0.45, -0.2, 0.9, -0.08);
      fin.quadraticCurveTo(1.0, 0, 0.92, 0.06);
      for (let i = 0; i < 4; i++) fin.quadraticCurveTo(0.82 - i * 0.2, 0.17, 0.72 - i * 0.2, 0.11);
      fin.quadraticCurveTo(0.1, 0.16, 0, 0.12);
      fin.closePath();
      const finGeo = slab(fin, 0.05, 0.03);
      finGeo.applyMatrix4(new THREE.Matrix4().makeBasis(new V3(0, 0, 1), new V3(1, 0, 0), new V3(0, 1, 0)));
      fins = [-1, 1].map((s) => {
        const side = new THREE.Group();
        side.position.set(0.85, 0.82, s * 0.48);
        side.scale.z = s;
        pitch.add(side);
        const g = new THREE.Group();
        g.rotation.y = -0.75;
        side.add(g);
        const flap = new THREE.Group();
        g.add(flap);
        mesh(finGeo, mats.body, flap);
        mesh(finGeo, mats.belly, flap, [0, -0.025, 0], [0.96, 0.6, 0.96]);
        return flap;
      });

      bullRope(pitch, mats.rope, 0.1, BODY_Y, SZ * radiusAt(0.1) + 0.01, SY * radiusAt(0.1) + 0.01);
      spoutMat = new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0, depthWrite: false });
      spout = mesh(new THREE.ConeGeometry(0.25, 1.2, 10, 1, true), spoutMat, pitch, [0.95, 2.35, 0], null, [Math.PI, 0, 0]);
      spout.castShadow = false;
      const rad = Array.from({ length: 13 }, (_, i) => 0.3 * (1 - i / 12) ** 0.7 + 0.1);
      const base = new V3(-0.75, BODY_Y + 0.02, 0), back = new V3(-1, 0, 0), side = new V3(0, 0, 1);
      return {
        animate(b) {
          const w = b.legPhase * 0.5;
          chain(tailPts, base, back, 1.15, (s) => 0.15 + 0.4 * s + Math.sin(w - 0.6 - s * 1.6) * 0.32 * s);
          tail.update(tailPts, rad, side);
          if (b.color !== coatKey) {
            coatKey = b.color;
            recolor(b.color);
          }
          for (const f of fins) f.rotation.x = 0.12 + Math.sin(w + 1) * 0.25;
          const k = Math.max(0, Math.sin(b.tailPhase * 0.25)) ** 8;
          spoutMat.opacity = k * 0.6;
          spout.scale.set(1 + k * 0.4, k, 1 + k * 0.4);
        },
      };
    },
  });
}

function buildKraken() {
  let coatKey = '';
  return buildCreature({
    seat: [0.18, 1.86, 0], lift: 0.6, belly: '#f4c6d0', accent: '#f6d6de',
    build(pitch, mats) {
      // Head, with the long mantle rising up and back behind the rider.
      mesh(SPHERE, mats.body, pitch, [0.3, 1.2, 0], [0.64, 0.58, 0.6]);
      const mantle = new THREE.Group();
      mantle.position.set(-0.05, 1.42, 0);
      mantle.rotation.z = 0.95;
      pitch.add(mantle);
      const prof = [[0, -0.3], [0.4, -0.26], [0.54, 0.05], [0.58, 0.4], [0.53, 0.85], [0.41, 1.3], [0.24, 1.66], [0.08, 1.86], [0, 1.9]];
      mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32), mats.body, mantle, [0, 0, 0], [1, 1, 0.92]);
      // Pale spots, half sunk into the mantle so they read as bumps.
      for (let i = 0; i < 18; i++) {
        const y = 0.15 + (i / 18) * 1.35, a = i * 2.4;
        let r = 0;
        for (let k = 1; k < prof.length; k++) if (y <= prof[k][1]) { r = prof[k - 1][0] + ((prof[k][0] - prof[k - 1][0]) * (y - prof[k - 1][1])) / (prof[k][1] - prof[k - 1][1]); break; }
        const sz = 0.06 + (i % 3) * 0.02;
        mesh(SPHERE, mats.light, mantle, [Math.cos(a) * r * 0.97, y, Math.sin(a) * r * 0.9], [sz, sz, sz]);
      }
      // Diamond fins around the mantle's tip.
      const finShape = new THREE.Shape([[0, 0.95], [0.32, 1.25], [0.62, 1.42], [0.5, 1.62], [0, 1.95], [-0.5, 1.62], [-0.62, 1.42], [-0.32, 1.25]].map(([x, y]) => new THREE.Vector2(x, y)));
      mesh(slab(finShape, 0.05, 0.03), mats.body, mantle, [0, 0, 0], null, [0, -Math.PI / 2, 0]);

      // Big gold eyes on the sides of the head under heavy brows, and a siphon.
      eyes(pitch, mats, 0.44, 1.3, 0.46, 0.17, 'bar', '#ffd34d');
      for (const s of [-1, 1]) mesh(SPHERE, mats.body, pitch, [0.46, 1.5, s * 0.47], [0.24, 0.07, 0.16], [s * 0.15, 0, -0.3]);
      mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.25, 12), mats.light, pitch, [0.8, 0.95, 0], null, [0, 0, -1.1]);
      bullRope(pitch, mats.rope, 0.15, 1.22, 0.6, 0.6);

      // Eight arms that splay out across the sand, and two longer feeding tentacles
      // with sucker clubs that rear up in front. Each is one smooth tapering tube,
      // pale on the sucker side.
      const suckers = (t, cn) => THREE.MathUtils.smoothstep(-cn, 0.25, 0.6) * THREE.MathUtils.smoothstep(t, 0.04, 0.15);
      const arms = [];
      const N = 16;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const dir = new V3(Math.cos(a) + 0.35, 0, Math.sin(a) * 1.1).normalize();
        const tube = sweep(pitch, N, 10, suckers);
        const base = new V3(0.42 + Math.cos(a) * 0.3, 0.8, Math.sin(a) * 0.3);
        const rad = Array.from({ length: N + 1 }, (_, i) => 0.14 * (1 - i / N) ** 0.85 + 0.018);
        arms.push({ tube, base, dir, rad, a, ph: k * 1.7, len: 2.0 + (k % 2) * 0.25, pts: Array.from({ length: N + 1 }, () => new V3()), d: new V3(), side: new V3() });
      }
      const feeders = [-1, 1].map((s) => {
        const tube = sweep(pitch, 20, 10, suckers);
        const club = new THREE.Group();
        tube.end.add(club);
        mesh(SPHERE, mats.body, club, [-0.08, 0, 0], [0.2, 0.075, 0.1]);
        mesh(SPHERE, mats.belly, club, [-0.08, -0.035, 0], [0.17, 0.05, 0.08]);
        const rad = Array.from({ length: 21 }, (_, i) => 0.075 * (1 - i / 20) + 0.035);
        return { tube, s, rad, base: new V3(0.78, 0.95, s * 0.16), dir: new V3(1, 0, s * 0.45).normalize(), pts: Array.from({ length: 21 }, () => new V3()), side: new V3(-s * 0.45, 0, 1).normalize() };
      });
      const UPV = new V3(0, 1, 0);
      return {
        animate(b) {
          if (b.color !== coatKey) {
            coatKey = b.color;
            for (const arm of arms) arm.tube.paint(b.color, '#f4c6d0');
            for (const f of feeders) f.tube.paint(b.color, '#f4c6d0');
          }
          const w = b.legPhase * 0.6;
          for (const arm of arms) {
            const sway = Math.sin(w * 0.7 + arm.ph) * 0.12;
            arm.d.set(Math.cos(sway) * arm.dir.x - Math.sin(sway) * arm.dir.z, 0, Math.sin(sway) * arm.dir.x + Math.cos(sway) * arm.dir.z);
            arm.side.crossVectors(arm.d, UPV);
            chain(arm.pts, arm.base, arm.d, arm.len, (s) => -1.4 + 2.0 * s + 2.6 * THREE.MathUtils.smoothstep(s, 0.72, 1) + Math.sin(w + arm.ph - s * 3) * (0.06 + 0.3 * s));
            arm.tube.update(arm.pts, arm.rad, arm.side);
          }
          for (const f of feeders) {
            chain(f.pts, f.base, f.dir, 1.75, (s) => 0.25 + 1.1 * s + Math.sin(w * 0.8 + f.s - s * 3) * 0.35 * s);
            f.tube.update(f.pts, f.rad, f.side);
          }
        },
      };
    },
  });
}

function buildChicken() {
  return buildCreature({
    seat: [0, 1.78, 0], lift: 0.35, accent: '#d23a2c',
    build(pitch, mats) {
      mesh(SPHERE, mats.body, pitch, [0, 1.22, 0], [0.78, 0.6, 0.6]);
      mesh(SPHERE, mats.light, pitch, [0.38, 1.12, 0], [0.45, 0.48, 0.5]); // fluffy chest
      for (let i = 0; i < 6; i++) mesh(SPHERE, mats.light, pitch, [0.62 + (i % 2) * 0.05, 0.95 + i * 0.08, (i % 3 - 1) * 0.12], [0.14, 0.1, 0.14]);
      // A fan of glossy tail feathers.
      const tailMat = std('#24303a', { metalness: 0.35, roughness: 0.35 });
      for (let i = 0; i < 7; i++) {
        const a = (i - 3) * 0.22;
        mesh(SPHERE, i % 2 ? tailMat : mats.body, pitch, [-0.72 - Math.abs(a) * 0.1, 1.62 + Math.cos(a) * 0.12, a * 0.35], [0.12, 0.45, 0.05], [a * 0.8, 0, 0.55 + Math.abs(a) * 0.3]);
      }
      neck(pitch, mats.body, [new V3(0.45, 1.5, 0), new V3(0.62, 1.75, 0), new V3(0.72, 1.92, 0)], 0.26, 0.2, 6, 0.9);
      const head = new THREE.Group();
      head.position.set(0.74, 2.0, 0);
      pitch.add(head);
      mesh(SPHERE, mats.body, head, [0, 0, 0], [0.24, 0.24, 0.22]);
      mesh(new THREE.ConeGeometry(0.08, 0.26, 8), std('#f2a33a'), head, [0.28, -0.03, 0], null, [0, 0, -Math.PI / 2]);
      for (let i = 0; i < 4; i++) mesh(SPHERE, mats.accent, head, [-0.1 + i * 0.08, 0.24 - Math.abs(i - 1.5) * 0.03, 0], [0.07, 0.1, 0.035]); // comb
      mesh(SPHERE, mats.accent, head, [0.18, -0.2, 0], [0.05, 0.1, 0.04]); // wattle
      for (const s of [-1, 1]) mesh(SPHERE, mats.accent, head, [0.08, -0.06, s * 0.19], [0.05, 0.06, 0.02]); // cheeks
      eyes(head, mats, 0.13, 0.07, 0.17, 0.045, 'round', '#e89a2a');
      bullRope(pitch, mats.rope, 0.05, 1.22, 0.61, 0.62);

      // Wings of layered feathers.
      const wings = [-1, 1].map((s) => {
        const g = new THREE.Group();
        g.position.set(0.05, 1.42, s * 0.5);
        g.rotation.y = s * 0.12; // follow the curve of the body
        pitch.add(g);
        mesh(SPHERE, mats.body, g, [-0.15, -0.05, s * 0.02], [0.4, 0.24, 0.13]);
        for (let i = 0; i < 4; i++) mesh(SPHERE, i % 2 ? mats.light : mats.body, g, [-0.35 - i * 0.07, -0.18 - i * 0.03, s * 0.06], [0.28 - i * 0.03, 0.08, 0.05], [0, 0, 0.35 + i * 0.1]);
        return { g, s };
      });
      const legMat = std('#f2a33a');
      const legs = [-1, 1].map((s) => {
        const l = limb(pitch, [0.05, 0.75, s * 0.22], 0.4, 0.38, 0.065, 0.045, legMat);
        mesh(SPHERE, mats.body, l.root, [0, -0.12, 0], [0.13, 0.2, 0.12]); // feathered thigh
        for (const a of [-0.6, 0, 0.6]) mesh(CYL, legMat, l.end, [Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12], [0.025, 0.24, 0.025], [0, -a, Math.PI / 2]);
        mesh(CYL, legMat, l.end, [-0.08, 0.01, 0], [0.022, 0.14, 0.022], [0, 0, Math.PI / 2]); // back toe
        return { ...l, ph: s > 0 ? 0 : Math.PI };
      });
      return {
        animate(b) {
          head.rotation.z = -b.dip * 0.8;
          for (const w of wings) w.g.rotation.x = -w.s * (0.1 + Math.abs(Math.sin(b.legPhase * 1.4)) * (b.hop < -5 ? 0.9 : 0.2));
          for (const l of legs) {
            l.root.rotation.z = Math.sin(b.legPhase + l.ph) * 0.45;
            l.mid.rotation.z = -Math.max(0, Math.sin(b.legPhase + l.ph + 0.8)) * 0.7;
          }
        },
      };
    },
  });
}

function buildDragon() {
  let wings, wingMat, flame, flameMat, core, jaw, neckTube, tail, tailSpines, coatKey = '';
  const tailPts = Array.from({ length: 19 }, () => new V3());
  const tailRad = Array.from({ length: 19 }, (_, i) => 0.17 * (1 - i / 18) ** 0.9 + 0.03);
  const SIDE = new V3(0, 0, 1), BACK = new V3(-1, 0, 0), TAIL_BASE = new V3(-0.92, 1.08, 0), spineDir = new V3();
  return buildQuadruped({
    headPos: [1.5, 1.86, 0], headRest: -0.05, lift: 0.75, hover: 0.35,
    legY: 0.85, legX: [0.6, -0.62, 0.27], len: [0.42, 0.4], r: [0.13, 0.085], claws: true, foot: '#efe6cf',
    girth: [0.36, 1.05, 0.44], seat: [0.02, 1.5, 0],
    accent: '#e8c070',
    build(pitch, head, mats) {
      mesh(SPHERE, mats.body, pitch, [0, 1.05, 0], [0.95, 0.42, 0.4]);
      mesh(SPHERE, mats.body, pitch, [0.55, 1.12, 0], [0.47, 0.44, 0.39]); // chest
      mesh(SPHERE, mats.body, pitch, [-0.58, 1.05, 0], [0.45, 0.4, 0.38]); // haunches
      // Belly plates.
      for (let i = 0; i < 8; i++) mesh(SPHERE, mats.accent, pitch, [-0.65 + i * 0.19, 0.7 + Math.sin((i / 7) * Math.PI) * 0.02, 0], [0.09, 0.06, 0.24]);

      // A smooth S-curved neck with banded throat plates and a row of spines on top.
      neckTube = sweep(pitch, 14, 16, (t, cn) => THREE.MathUtils.smoothstep(-cn, 0.35, 0.7) * (Math.round(t * 14) % 2 ? 0.85 : 1));
      const neckCurve = new THREE.CatmullRomCurve3([new V3(0.6, 1.18, 0), new V3(0.98, 1.36, 0), new V3(1.24, 1.6, 0), new V3(1.46, 1.84, 0)]);
      const neckPts = neckCurve.getPoints(14);
      const neckRad = neckPts.map((_, i) => 0.31 - (0.15 * i) / 14);
      neckTube.update(neckPts, neckRad, SIDE);
      const spine = new THREE.ConeGeometry(0.055, 0.2, 6);
      for (let i = 2; i <= 12; i += 2) {
        const top = neckTube.N[i];
        const m = mesh(spine, mats.accent, pitch, neckPts[i].clone().addScaledVector(top, neckRad[i] * 0.85).toArray(), [1, 0.8 + (12 - i) * 0.04, 1]);
        m.quaternion.setFromUnitVectors(UP, spineDir.copy(top).addScaledVector(neckTube.T[i], -0.5).normalize());
      }
      // Spines down the back, leaving room for the rider.
      for (const x of [-0.85, -0.62, -0.45, 0.45]) {
        const y = 1.43 + (x > 0 ? 0.02 : (x + 0.45) * 0.3);
        mesh(spine, mats.accent, pitch, [x, y, 0], null, [0, 0, 0.35]);
      }

      // A long tail that swishes side to side, with spines and an arrowhead spade.
      tail = sweep(pitch, 18, 14, (t, cn) => THREE.MathUtils.smoothstep(cn, 0.35, 0.7));
      tailSpines = [0.12, 0.24, 0.36, 0.48, 0.6, 0.72].map((t, i) => ({ i: Math.round(t * 18), m: mesh(spine, mats.accent, pitch, null, [0.9 - i * 0.1, 0.9 - i * 0.1, 0.9 - i * 0.1]) }));
      const spade = new THREE.Shape([[-0.06, 0], [0.02, 0.13], [0.08, 0.22], [0.22, 0.15], [0.46, 0], [0.22, -0.15], [0.08, -0.22], [0.02, -0.13]].map(([x, y]) => new THREE.Vector2(x, y)));
      mesh(slab(spade, 0.04, 0.02), mats.accent, tail.end);

      // Head: skull, long snout, jaw with teeth, brows, swept-back horns and cheek spikes.
      mesh(SPHERE, mats.body, head, [0.04, 0.03, 0], [0.25, 0.2, 0.2]);
      mesh(SPHERE, mats.body, head, [0.36, 0.0, 0], [0.32, 0.11, 0.14]);
      mesh(SPHERE, mats.body, head, [0.64, 0.01, 0], [0.1, 0.085, 0.115]);
      mesh(SPHERE, mats.accent, head, [0.38, 0.09, 0], [0.24, 0.035, 0.05]); // nose ridge
      jaw = new THREE.Group();
      jaw.position.set(0.12, -0.08, 0);
      head.add(jaw);
      mesh(SPHERE, mats.body, jaw, [0.25, -0.02, 0], [0.3, 0.06, 0.115]);
      mesh(SPHERE, mats.accent, jaw, [0.22, -0.05, 0], [0.24, 0.035, 0.085]);
      const tooth = std('#fffaf0', { roughness: 0.3 });
      const fang = new THREE.ConeGeometry(0.018, 0.065, 5);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) mesh(fang, tooth, head, [0.3 + i * 0.08, -0.1, s * 0.1], null, [Math.PI, 0, 0]);
        for (let i = 0; i < 3; i++) mesh(fang, tooth, jaw, [0.22 + i * 0.09, 0.03, s * 0.085], [0.8, 0.8, 0.8]);
        mesh(SPHERE, mats.dark, head, [0.7, 0.06, s * 0.05], [0.025, 0.018, 0.022]); // nostrils
        mesh(SPHERE, mats.accent, head, [0.17, 0.15, s * 0.13], [0.13, 0.04, 0.055], [s * 0.3, 0, -0.25]); // brow
        const horn = new THREE.CatmullRomCurve3([new V3(-0.02, 0.13, s * 0.1), new V3(-0.22, 0.24, s * 0.15), new V3(-0.42, 0.28, s * 0.19), new V3(-0.58, 0.4, s * 0.21)]);
        const hornTube = sweep(head, 12, 8);
        hornTube.update(horn.getPoints(12), Array.from({ length: 13 }, (_, i) => 0.046 * (1 - i / 15)), SIDE);
        hornTube.paint('#e8c070', '#e8c070');
        for (let i = 0; i < 3; i++) mesh(new THREE.ConeGeometry(0.03, 0.17 - i * 0.03, 5), mats.accent, head, [-0.06 - i * 0.07, -0.05 - i * 0.04, s * 0.17], null, [s * 0.5, 0, 1.9 + i * 0.15]);
      }
      eyes(head, mats, 0.2, 0.08, 0.15, 0.052, 'slit', '#ffd34d');

      flameMat = new THREE.MeshBasicMaterial({ color: '#ff6a10', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      flame = mesh(new THREE.ConeGeometry(0.2, 1.0, 12, 1, true), flameMat, head, [1.05, -0.08, 0], null, [0, 0, Math.PI / 2]);
      core = mesh(new THREE.ConeGeometry(0.1, 0.8, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe36a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), flame, [0, 0.08, 0]);
      flame.castShadow = core.castShadow = false;

      // Bat wings: arm and finger bones with a membrane stretched between them,
      // scalloped between the finger tips.
      const S = [0.05, 0], E = [0.32, 0.75], W = [0.12, 1.42], F = [[-0.3, 2.1], [-0.82, 1.82], [-1.12, 1.2], [-1.0, 0.5]], R = [-0.68, 0.03];
      const shape = new THREE.Shape();
      shape.moveTo(...S);
      shape.lineTo(...E);
      shape.lineTo(...W);
      shape.lineTo(...F[0]);
      const tips = [...F, R];
      for (let i = 1; i < tips.length; i++) {
        const [ax, ay] = tips[i - 1], [bx, by] = tips[i];
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        shape.quadraticCurveTo(mx + (W[0] - mx) * 0.32, my + (W[1] - my) * 0.32, bx, by);
      }
      shape.lineTo(...S);
      const membrane = new THREE.ShapeGeometry(shape, 12);
      wingMat = new THREE.MeshStandardMaterial({ color: '#7a2a2a', side: THREE.DoubleSide, roughness: 0.75, transparent: true, opacity: 0.93 });
      const P = ([x, y]) => new V3(x, 0, y);
      const knuckle = std('#e8c070', { roughness: 0.6 });
      wings = [-1, 1].map((s) => {
        const side = new THREE.Group();
        side.position.set(-0.1, 1.38, s * 0.3);
        side.scale.set(1.15, 1.15, 1.15 * s);
        pitch.add(side);
        const g = new THREE.Group();
        side.add(g);
        mesh(membrane, wingMat, g, [0, 0, 0], null, [Math.PI / 2, 0, 0]);
        rod(g, mats.body, P(S), P(E), 0.045);
        rod(g, mats.body, P(E), P(W), 0.035);
        for (const f of F) rod(g, mats.accent, P(W), P(f), 0.016);
        mesh(SPHERE, mats.body, g, P(E).toArray(), [0.06, 0.06, 0.06]);
        mesh(SPHERE, knuckle, g, P(W).toArray(), [0.055, 0.055, 0.055]);
        mesh(new THREE.ConeGeometry(0.03, 0.14, 6), knuckle, g, [W[0] + 0.08, 0, W[1]], null, [0, 0, -Math.PI / 2]); // wing claw
        return g;
      });
    },
    animate(b) {
      if (b.color !== coatKey) {
        coatKey = b.color;
        neckTube.paint(b.color, '#e8c070');
        tail.paint(b.color, '#e8c070');
        wingMat.color.set(b.color).lerp(new THREE.Color('#f0b070'), 0.3);
      }
      const t = performance.now() / 1000;
      const flap = Math.sin(t * 4.5 + b.legPhase * 0.2);
      for (const g of wings) {
        g.rotation.x = -(0.7 + flap * 0.55);
        g.rotation.y = Math.cos(t * 4.5) * 0.12;
      }
      chain(tailPts, TAIL_BASE, BACK, 2.0, (s) => -0.7 + 1.25 * s + Math.sin(b.tailPhase * 0.7 - s * 2) * 0.1);
      for (let i = 0; i < tailPts.length; i++) {
        const s = i / 18;
        tailPts[i].z = Math.sin(b.tailPhase - s * 2.5) * 0.4 * s ** 1.4;
      }
      tail.update(tailPts, tailRad, SIDE);
      for (const sp of tailSpines) {
        const top = tail.N[sp.i];
        sp.m.position.copy(tailPts[sp.i]).addScaledVector(top, -tailRad[sp.i] * 0.85);
        sp.m.quaternion.setFromUnitVectors(UP, spineDir.copy(top).negate().addScaledVector(tail.T[sp.i], 0.5).normalize());
      }
      const k = Math.max(0, -b.hop / 36 - 0.4);
      jaw.rotation.z = -Math.min(0.5, k * 0.9);
      flameMat.opacity = Math.min(0.9, k * 2);
      core.material.opacity = Math.min(1, k * 2.4);
      flame.scale.set(1 + k, 0.4 + k * 1.6, 1 + k);
      flame.position.x = 0.6 + flame.scale.y * 0.5;
    },
  });
}

function buildPig() {
  return buildQuadruped({
    headPos: [0.84, 0.72, 0], headRest: 0.05, lift: -0.15,
    legY: 0.38, legX: [0.42, -0.42, 0.2], len: [0.18, 0.16], r: [0.085, 0.06], foot: '#6a3a30',
    tailPos: [-0.86, 0.8, 0], tail: [0.04, 0.04, 0.02], tailRest: 0.6,
    girth: [0.18, 0.67, 0.425, 0.425], seat: [-0.05, 1.04, 0],
    accent: '#d97f78',
    build(pitch, head, mats) {
      // One smooth barrel (a capsule on its side) instead of three overlapping lumps.
      mesh(new THREE.CapsuleGeometry(0.4, 0.82, 10, 24), mats.body, pitch, [0, 0.67, 0], [1, 1, 1.04], [0, 0, Math.PI / 2]);
      mesh(SPHERE, mats.light, pitch, [0.05, 0.5, 0], [0.62, 0.2, 0.32]);
      mesh(SPHERE, mats.body, head, [0.05, 0, 0], [0.3, 0.28, 0.29]);
      for (const s of [-1, 1]) mesh(SPHERE, mats.body, head, [0.16, -0.1, s * 0.15], [0.14, 0.12, 0.1]); // jowls
      mesh(CYL, mats.accent, head, [0.33, -0.04, 0], [0.125, 0.09, 0.125], [0, 0, Math.PI / 2]);
      mesh(CYL, mats.light, head, [0.38, -0.04, 0], [0.11, 0.01, 0.11], [0, 0, Math.PI / 2]);
      for (const s of [-1, 1]) {
        mesh(SPHERE, mats.dark, head, [0.385, -0.03, s * 0.045], [0.012, 0.03, 0.018]);
        // Floppy ears folding forward.
        mesh(SPHERE, mats.body, head, [0.1, 0.24, s * 0.15], [0.15, 0.035, 0.11], [s * 0.5, 0, -0.75]);
      }
      eyes(head, mats, 0.23, 0.09, 0.19, 0.04);
      mesh(new THREE.TorusGeometry(0.07, 0.022, 6, 16, Math.PI * 1.7), mats.body, pitch, [-0.9, 0.84, 0], null, [Math.PI / 2, 0, 0]); // curly tail
    },
  });
}

function buildCow() {
  // Black-and-white patches painted onto the hide; the coat color tints the light parts.
  const hide = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#231b16';
    for (let i = 0; i < 9; i++) {
      const x = Math.random() * w, y = 15 + Math.random() * (h - 30), r = 10 + Math.random() * 18;
      for (let k = 0; k < 6; k++) {
        c.beginPath();
        c.ellipse(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r * 0.7, r * (0.5 + Math.random() * 0.5), r * (0.4 + Math.random() * 0.4), Math.random() * 3, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
  hide.wrapS = THREE.RepeatWrapping;
  return buildQuadruped({
    headPos: [1.0, 1.06, 0], headRest: 0.25, lift: 0.05,
    legY: 0.62, legX: [0.62, -0.6, 0.22], len: [0.32, 0.28], r: [0.1, 0.065],
    tailPos: [-1.0, 1.02, 0], tail: [0.35, 0.35, 0.022], tailRest: -0.15,
    girth: [0.3, 0.88, 0.41, 0.41], seat: [0.0, 1.27, 0],
    accent: '#231b16',
    tailTip(end, mats) {
      mesh(SPHERE, mats.accent, end, [0, -0.07, 0], [0.05, 0.12, 0.05]);
    },
    build(pitch, head, mats) {
      mats.body.map = hide;
      mesh(SPHERE, mats.body, pitch, [0, 0.88, 0], [0.95, 0.42, 0.42]);
      mesh(SPHERE, mats.body, pitch, [-0.55, 0.92, 0], [0.4, 0.38, 0.4]); // hips
      const pink = std('#f2a8b0');
      mesh(SPHERE, pink, pitch, [-0.35, 0.5, 0], [0.2, 0.12, 0.16]); // udder
      for (const [x, z] of [[-0.42, 0.07], [-0.42, -0.07], [-0.28, 0.07], [-0.28, -0.07]]) mesh(CYL, pink, pitch, [x, 0.38, z], [0.02, 0.06, 0.02]);
      // Plain face (no hide patches) so the eyes read clearly.
      mesh(SPHERE, mats.light, head, [0.14, -0.02, 0], [0.28, 0.22, 0.22]);
      mesh(SPHERE, mats.accent, head, [0.02, 0.1, -0.15], [0.14, 0.11, 0.07], [0.7, 0, 0.2]); // patch over one side
      mesh(SPHERE, pink, head, [0.4, -0.11, 0], [0.15, 0.12, 0.18]);
      for (const s of [-1, 1]) {
        mesh(SPHERE, mats.dark, head, [0.54, -0.1, s * 0.06], [0.015, 0.03, 0.025]);
        mesh(new THREE.ConeGeometry(0.035, 0.14, 8), std('#efe6cf'), head, [0.04, 0.2, s * 0.14], null, [s * 0.6, 0, 0]);
        mesh(SPHERE, mats.body, head, [-0.02, 0.09, s * 0.28], [0.11, 0.045, 0.07], [s * 0.4, 0, 0]);
        mesh(SPHERE, pink, head, [-0.01, 0.09, s * 0.3], [0.07, 0.025, 0.045], [s * 0.4, 0, 0]);
      }
      eyes(head, mats, 0.25, 0.07, 0.172, 0.048, 'round', null, mats.light);
      // Collar and cowbell.
      const leather = std('#5a2d10');
      mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 24), leather, pitch, [0.82, 0.86, 0], null, [0, Math.PI / 2, 0.5]);
      mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.15, 12), std('#e8c35a', { metalness: 0.8, roughness: 0.3 }), pitch, [0.9, 0.62, 0]);
    },
  });
}

function buildGoat() {
  return buildQuadruped({
    headPos: [0.72, 1.1, 0], headRest: -0.1, lift: -0.1,
    legY: 0.55, legX: [0.42, -0.42, 0.16], len: [0.28, 0.26], r: [0.065, 0.042],
    tailPos: [-0.62, 0.92, 0], tail: [0.09, 0.05, 0.03], tailRest: 2.6,
    girth: [0.12, 0.78, 0.305, 0.305], seat: [-0.02, 1.09, 0],
    accent: '#3a3028',
    build(pitch, head, mats) {
      mesh(SPHERE, mats.body, pitch, [0, 0.78, 0], [0.6, 0.3, 0.3]);
      mesh(SPHERE, mats.body, pitch, [-0.35, 0.8, 0], [0.3, 0.28, 0.29]);
      // Shaggy chest and a mane of longer hair along the back.
      for (let i = 0; i < 5; i++) mesh(SPHERE, mats.light, pitch, [0.42 + (i % 2) * 0.05, 0.6 + i * 0.06, (i % 3 - 1) * 0.08], [0.1, 0.13, 0.1]);
      neck(pitch, mats.body, [new V3(0.4, 0.86, 0), new V3(0.58, 1.0, 0), new V3(0.7, 1.1, 0)], 0.18, 0.13, 6, 0.85);
      mesh(SPHERE, mats.body, head, [0.1, 0, 0], [0.18, 0.14, 0.13]);
      mesh(SPHERE, mats.light, head, [0.3, -0.06, 0], [0.13, 0.08, 0.08], [0, 0, -0.2]);
      mesh(new THREE.ConeGeometry(0.05, 0.2, 6), mats.light, head, [0.24, -0.2, 0], null, [Math.PI, 0, 0]); // beard
      for (const s of [-1, 1]) {
        const curve = new THREE.CatmullRomCurve3([new V3(0.05, 0.1, s * 0.06), new V3(-0.05, 0.25, s * 0.09), new V3(-0.22, 0.3, s * 0.12), new V3(-0.3, 0.2, s * 0.14)]);
        mesh(new THREE.TubeGeometry(curve, 12, 0.03, 6), mats.accent, head);
        mesh(SPHERE, mats.body, head, [0.0, 0.04, s * 0.19], [0.12, 0.03, 0.05], [s * 0.2, 0, 0.2]); // ears
        mesh(SPHERE, mats.dark, head, [0.42, -0.05, s * 0.03], [0.012, 0.012, 0.012]);
      }
      eyes(head, mats, 0.17, 0.05, 0.1, 0.032, 'bar', '#e8b040');
    },
  });
}

// ---------- Rider ----------
const HALF_SPHERE = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);

// Every hat style is built up front; setStyle() shows one. Origin sits just above the head.
function makeHat(m) {
  const g = new THREE.Group();
  const styles = {};
  const style = (id) => {
    const s = new THREE.Group();
    g.add(s);
    styles[id] = s;
    return s;
  };
  const cowboy = style('cowboy');
  mesh(CYL, m.hat, cowboy, [0, 0, 0], [0.22, 0.02, 0.2]);
  mesh(new THREE.CylinderGeometry(0.095, 0.115, 0.14, 16), m.hat, cowboy, [0, 0.08, 0]);
  mesh(CYL, m.band, cowboy, [0, 0.03, 0], [0.117, 0.03, 0.117]);

  const tall = style('tall');
  mesh(CYL, m.hat, tall, [0, 0, 0], [0.26, 0.02, 0.23]);
  mesh(SPHERE, m.hat, tall, [0, 0.015, 0.2], [0.08, 0.03, 0.05], [0.5, 0, 0]); // rolled brim edges
  mesh(SPHERE, m.hat, tall, [0, 0.015, -0.2], [0.08, 0.03, 0.05], [-0.5, 0, 0]);
  mesh(new THREE.CylinderGeometry(0.085, 0.125, 0.19, 16), m.hat, tall, [0, 0.105, 0]);
  mesh(SPHERE, m.hat, tall, [0, 0.2, 0], [0.085, 0.025, 0.07]); // pinched crown top
  mesh(CYL, m.band, tall, [0, 0.04, 0], [0.122, 0.04, 0.122]);

  const flat = style('flat');
  mesh(CYL, m.hat, flat, [0, 0, 0], [0.27, 0.015, 0.27]);
  mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.09, 16), m.hat, flat, [0, 0.05, 0]);
  mesh(CYL, m.band, flat, [0, 0.025, 0], [0.112, 0.03, 0.112]);

  // Bull riding helmet with a face cage.
  const helmet = style('helmet');
  mesh(HALF_SPHERE, m.hat, helmet, [0, -0.09, 0], [0.135, 0.15, 0.135]);
  mesh(CYL, m.band, helmet, [0, -0.085, 0], [0.138, 0.025, 0.138]);
  for (let i = 0; i < 3; i++) mesh(BOX, m.cage, helmet, [0.135, -0.11 - i * 0.045, 0], [0.012, 0.012, 0.2]);
  for (const z of [-0.06, 0, 0.06]) mesh(BOX, m.cage, helmet, [0.14, -0.155, z], [0.012, 0.1, 0.012]);

  function setStyle(id) {
    for (const k in styles) styles[k].visible = k === (styles[id] ? id : 'cowboy');
  }
  setStyle('cowboy');
  return Object.assign(g, { setStyle });
}

function riderMats() {
  return {
    shirt: std('#2f6fb3'),
    vest: std('#6e3519'),
    jeans: std('#2b3a55'),
    skin: std('#e0b089'),
    hat: std('#d2ab6e'),
    band: std('#5a2d10'),
    cage: std('#9a9a9a', { metalness: 0.7, roughness: 0.4 }),
    boot: std('#3b2412', { roughness: 0.5 }),
    glove: std('#d8c7a0'),
    buckle: std('#e8c35a', { metalness: 0.8, roughness: 0.3 }),
    hair: std('#3a2618', { roughness: 0.75 }),
    brow: std('#3a2618', { roughness: 0.75, transparent: true }),
    bandana: std('#b0281f'),
    belt: std('#3a2414', { roughness: 0.6 }),
    spur: std('#c0c0c0', { metalness: 0.8, roughness: 0.3, emissive: new THREE.Color('#000000') }),
  };
}

// Small face parts are marked transparent so addOutline skips them; a dark shell
// around something this small would swallow it.
const RIDER_EYE = std('#ffffff', { roughness: 0.3, transparent: true });
const RIDER_PUPIL = std('#1a120c', { roughness: 0.2, transparent: true });
const RIDER_MOUTH = std('#6a2a20', { transparent: true });

// Shirt patterns: grey-on-white tiles that the shirt color multiplies, so any
// shirt color works with any pattern.
const SHIRT_PATTERNS = {};
function shirtPattern(id) {
  if (id === 'solid' || !id) return null;
  if (SHIRT_PATTERNS[id]) return SHIRT_PATTERNS[id];
  const tex = canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    if (id === 'plaid') {
      c.fillStyle = 'rgba(0,0,0,0.28)';
      c.fillRect(0, 20, w, 14); c.fillRect(20, 0, 14, h);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(0, 50, w, 3); c.fillRect(50, 0, 3, h);
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(0, 6, w, 2); c.fillRect(6, 0, 2, h);
    } else if (id === 'stripes') {
      c.fillStyle = 'rgba(255,255,255,1)';
      for (let x = 0; x < w; x += 16) { c.fillStyle = '#ffffff'; c.fillRect(x, 0, 8, h); c.fillStyle = '#a8a8a8'; c.fillRect(x + 8, 0, 8, h); }
    } else if (id === 'gingham') {
      for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) {
        const k = ((x / 16) % 2) + ((y / 16) % 2);
        c.fillStyle = k === 0 ? '#ffffff' : k === 1 ? '#c8c8c8' : '#8c8c8c';
        c.fillRect(x, y, 16, 16);
      }
    } else if (id === 'pinstripe') {
      c.fillStyle = '#6a6a6a';
      for (let x = 0; x < w; x += 10) c.fillRect(x, 0, 2, h);
    } else if (id === 'stars') {
      c.fillStyle = '#9a9a9a';
      for (const [x, y] of [[12, 12], [44, 28], [20, 46], [54, 56]]) {
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 2.5 : 6;
          c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        c.fill();
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return (SHIRT_PATTERNS[id] = tex);
}

// The top of a sphere, tilted back so it frames the face: used for hair caps.
const HAIR_CAP = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
// The bottom of a sphere: a full beard around the jaw.
const BEARD_CAP = new THREE.SphereGeometry(1, 20, 10, -Math.PI * 0.5, Math.PI, Math.PI * 0.5, Math.PI * 0.5);

function buildRider(m) {
  const root = new THREE.Group(); // origin at the hips
  mesh(SPHERE, m.jeans, root, [0, 0, 0], [0.16, 0.12, 0.18]);
  // Belt with the buckle on the front.
  mesh(new THREE.TorusGeometry(1, 0.18, 8, 28), m.belt, root, [0, 0.07, 0], [0.155, 0.17, 0.12], [Math.PI / 2, 0, 0]);
  mesh(BOX, m.buckle, root, [0.16, 0.07, 0], [0.03, 0.06, 0.09]);

  const legs = [-1, 1].map((s) => {
    const l = limb(root, [0, 0, s * 0.11], 0.44, 0.44, 0.078, 0.062, m.jeans);
    mesh(BOX, m.boot, l.end, [0.05, -0.03, 0], [0.24, 0.1, 0.1]);
    mesh(SPHERE, m.boot, l.end, [0.16, -0.03, 0], [0.05, 0.05, 0.05]); // rounded toe
    mesh(BOX, m.boot, l.end, [-0.05, -0.085, 0], [0.06, 0.05, 0.08]); // heel
    mesh(new THREE.CylinderGeometry(1, 0.85, 1, 14), m.boot, l.end, [0, 0.08, 0], [0.075, 0.16, 0.075]);
    const spur = mesh(SPHERE, m.spur, l.end, [-0.1, -0.03, 0], [0.04, 0.04, 0.02]);
    return { ...l, s, spur };
  });

  const torso = new THREE.Group();
  root.add(torso);
  mesh(new THREE.CapsuleGeometry(0.15, 0.3, 6, 14), m.shirt, torso, [0, 0.32, 0], [1, 1, 0.75]);
  const vest = mesh(new THREE.CapsuleGeometry(0.155, 0.22, 6, 14), m.vest, torso, [0, 0.33, 0], [1.03, 1, 0.8]);
  // Shoulders and a pointed western collar.
  for (const s of [-1, 1]) {
    mesh(SPHERE, m.shirt, torso, [0, 0.53, s * 0.16], [0.075, 0.07, 0.075]);
    mesh(new THREE.ConeGeometry(0.035, 0.08, 3), m.shirt, torso, [0.06, 0.585, s * 0.035], [1, 1, 0.4], [s * 0.4, 0, -2.4]);
  }
  mesh(CYL, m.skin, torso, [0, 0.61, 0], [0.05, 0.08, 0.05]);

  // Head, with a face looking along +x.
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0);
  torso.add(head);
  mesh(SPHERE, m.skin, head, [0, 0, 0], [0.11, 0.12, 0.105]);
  mesh(SPHERE, m.skin, head, [0.105, -0.01, 0], [0.025, 0.03, 0.022]); // nose
  for (const s of [-1, 1]) {
    mesh(SPHERE, m.skin, head, [-0.005, -0.005, s * 0.105], [0.022, 0.035, 0.015]); // ears
    mesh(SPHERE, RIDER_EYE, head, [0.088, 0.02, s * 0.04], [0.02, 0.022, 0.016]);
    mesh(SPHERE, RIDER_PUPIL, head, [0.103, 0.02, s * 0.042], [0.009, 0.012, 0.009]);
    mesh(BOX, m.brow, head, [0.1, 0.05, s * 0.042], [0.012, 0.01, 0.04], [s * 0.15, 0, 0]); // brows
  }
  mesh(BOX, RIDER_MOUTH, head, [0.1, -0.055, 0], [0.008, 0.008, 0.04]);

  // Hair styles, all in the hair material; setHair shows one.
  const hairStyles = {};
  const hs = (id) => { const g = new THREE.Group(); head.add(g); hairStyles[id] = g; return g; };
  const cap = (g) => mesh(HAIR_CAP, m.hair, g, [-0.008, 0.008, 0], [0.118, 0.128, 0.113], [0, 0, 0.55]);
  cap(hs('short'));
  const long = hs('long');
  cap(long);
  mesh(SPHERE, m.hair, long, [-0.06, -0.08, 0], [0.07, 0.15, 0.11]);
  const pony = hs('ponytail');
  cap(pony);
  mesh(SPHERE, m.hair, pony, [-0.115, 0.0, 0], [0.03, 0.03, 0.03]);
  mesh(SPHERE, m.hair, pony, [-0.14, -0.1, 0], [0.04, 0.11, 0.04], [0, 0, -0.25]);
  const braids = hs('braids');
  cap(braids);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) mesh(SPHERE, m.hair, braids, [-0.03 + i * 0.008, -0.07 - i * 0.045, s * 0.09], [0.026, 0.03, 0.026]);
  const mohawk = hs('mohawk');
  mesh(BOX, m.hair, mohawk, [-0.01, 0.12, 0], [0.18, 0.07, 0.03], [0, 0, 0.2]);
  hs('bald');
  function setHair(id) {
    for (const k in hairStyles) hairStyles[k].visible = k === (hairStyles[id] ? id : 'short');
  }
  setHair('short');

  // Facial hair.
  const beards = {};
  const bs = (id) => { const g = new THREE.Group(); head.add(g); beards[id] = g; return g; };
  bs('none');
  const stache = (g) => { for (const s of [-1, 1]) mesh(SPHERE, m.hair, g, [0.103, -0.035, s * 0.022], [0.012, 0.012, 0.028], [s * 0.4, 0, 0]); };
  stache(bs('mustache'));
  const handlebar = bs('handlebar');
  stache(handlebar);
  for (const s of [-1, 1]) mesh(SPHERE, m.hair, handlebar, [0.1, -0.025, s * 0.058], [0.008, 0.02, 0.008], [s * 0.6, 0, 0]);
  const goatee = bs('goatee');
  stache(goatee);
  mesh(SPHERE, m.hair, goatee, [0.085, -0.095, 0], [0.025, 0.03, 0.025]);
  const full = bs('beard');
  stache(full);
  mesh(BEARD_CAP, m.hair, full, [0.012, -0.012, 0], [0.112, 0.125, 0.108], [0, 0, 0.25]);
  function setBeard(id) {
    for (const k in beards) beards[k].visible = k === (beards[id] ? id : 'none');
  }
  setBeard('none');

  // Bandana: knotted round the neck with a point hanging down the chest.
  const bandana = new THREE.Group();
  torso.add(bandana);
  mesh(new THREE.TorusGeometry(0.058, 0.022, 8, 20), m.bandana, bandana, [0, 0.625, 0], null, [Math.PI / 2, 0, 0]);
  mesh(new THREE.ConeGeometry(0.075, 0.12, 3), m.bandana, bandana, [0.09, 0.56, 0], [1, 1, 0.35], [0, 0, Math.PI - 0.25]);
  bandana.visible = false;

  const hat = makeHat(m);
  hat.position.set(0, 0.8, 0);
  torso.add(hat);

  const arms = [-1, 1].map((s) => {
    const a = limb(torso, [0, 0.54, s * 0.2], 0.28, 0.27, 0.058, 0.048, m.shirt);
    mesh(SPHERE, m.glove, a.end, [0, -0.01, 0], [0.058, 0.065, 0.05]);
    mesh(SPHERE, m.glove, a.end, [0.04, 0.0, s * 0.03], [0.02, 0.035, 0.02], [0, 0, -0.5]); // thumb
    mesh(CYL, m.glove, a.end, [0, 0.05, 0], [0.058, 0.05, 0.058]); // cuff
    return { ...a, s };
  });

  function setPattern(id) {
    m.shirt.map = shirtPattern(id);
    m.shirt.needsUpdate = true;
  }

  function setPose(mode, p) {
    root.rotation.set(0, 0, 0);
    torso.rotation.set(0, 0, 0);
    hat.visible = p.hasHat;
    const t = p.t;
    for (const l of legs) {
      l.root.rotation.set(0, 0, 0);
      l.mid.rotation.set(0, 0, 0);
      l.spur.material.emissive.setRGB(p.spurGlow ? 1 : 0, p.spurGlow ? 0.8 : 0, 0);
      l.spur.material.emissiveIntensity = p.spurGlow ? 1.5 + Math.sin(t * 30) : 0;
    }
    for (const a of arms) {
      a.root.rotation.set(0, 0, 0);
      a.mid.rotation.set(0, 0, 0);
    }
    const [farArm, nearArm] = arms;

    if (mode === 'ride') {
      torso.rotation.z = -p.lean * 1.05;
      // Leg spread is fitted per mount (fitSplay) so boots wrap the body instead of sinking in.
      const fit = p.fit || { splay: 0.78, fwd: 0.9 };
      const splay = p.splay || fit.splay, fwd = p.fwd || fit.fwd;
      for (const l of legs) {
        l.root.rotation.set(-l.s * splay, 0, fwd);
        l.mid.rotation.z = -1.5;
      }
      // Rope hand stays on the bull rope; the free hand waves overhead.
      nearArm.root.rotation.set(0.3, 0, 0.5 + p.lean * 1.0);
      nearArm.mid.rotation.z = 0.5;
      // Raised arms tilt outward with +s (the opposite sign from hanging arms), so the hand clears the head.
      farArm.root.rotation.set(-0.5, 0, Math.PI + 0.3 + 0.3 * Math.sin(t * 9) - p.lean * 0.4);
      farArm.mid.rotation.z = -0.4 + 0.3 * Math.sin(t * 9 + 1);
    } else if (mode === 'fly') {
      // flail: 1 thrashing in the air, easing to 0 as the rider comes to rest.
      const f = t * 22, k = p.flail == null ? 1 : p.flail;
      torso.rotation.z = Math.sin(f * 0.5) * 0.2 * k;
      for (const l of legs) {
        l.root.rotation.set(-l.s * 0.3, 0, Math.sin(f + l.s) * 0.7 * k);
        l.mid.rotation.z = (-0.4 - Math.abs(Math.sin(f * 1.3 + l.s)) * 0.6) * k;
      }
      for (const a of arms) {
        a.root.rotation.set(a.s * 0.5, 0, Math.PI * 0.75 + Math.sin(f * 1.1 + a.s * 2) * 0.8 * k);
        a.mid.rotation.z = Math.sin(f + a.s) * 0.6 * k;
      }
    } else if (mode === 'jump') {
      // k = 1 while rising (knees tucked, arms up in a V); 0 coming down (legs reach for the ground, arms out).
      const k = THREE.MathUtils.clamp(-p.vy / 430, 0, 1);
      torso.rotation.z = -0.15 * k;
      for (const l of legs) {
        l.root.rotation.set(-l.s * 0.12, 0, 0.25 + k * 0.85);
        l.mid.rotation.z = -0.35 - k * 1.25;
      }
      for (const a of arms) {
        a.root.rotation.set(a.s * (0.45 + (1 - k) * 0.6), 0, Math.PI * (0.55 + k * 0.4));
        a.mid.rotation.z = 0.15;
      }
    } else if (mode === 'down') {
      root.rotation.z = Math.PI / 2;
      for (const l of legs) l.root.rotation.z = 0.1 * l.s;
      for (const a of arms) a.root.rotation.set(-a.s * 0.3, 0, -0.3);
    } else {
      // Standing: running to the fence, or celebrating on it.
      const ph = p.phase * Math.PI * 0.5;
      if (p.safe) {
        for (const a of arms) {
          a.root.rotation.set(a.s * 0.35, 0, Math.PI + 0.15 * Math.sin(t * 8 + a.s));
          a.mid.rotation.z = 0.2;
        }
        for (const l of legs) l.root.rotation.set(-l.s * 0.12, 0, 0);
      } else if (p.crouch > 0) {
        // Landing: knees bent, leaning forward, arms out for balance.
        const c = p.crouch;
        torso.rotation.z = -0.45 * c;
        for (const l of legs) {
          l.root.rotation.set(-l.s * 0.15, 0, 1.0 * c);
          l.mid.rotation.z = -1.7 * c;
        }
        for (const a of arms) {
          a.root.rotation.set(-a.s * 1.1, 0, 0.4);
          a.mid.rotation.z = 0.3;
        }
      } else {
        torso.rotation.z = -0.2;
        for (const l of legs) {
          const sw = Math.sin(ph + (l.s > 0 ? 0 : Math.PI));
          l.root.rotation.z = sw * 0.6;
          l.mid.rotation.z = -Math.max(0, -sw) * 0.9 - 0.15;
        }
        for (const a of arms) {
          const sw = Math.sin(ph + (a.s > 0 ? Math.PI : 0));
          a.root.rotation.set(-a.s * 0.12, 0, sw * 0.7);
          a.mid.rotation.z = 0.9;
        }
      }
    }
  }
  return { root, setPose, hat, vest, legs, head, bandana, setHair, setBeard, setPattern };
}

// ---------- Environments ----------
// Each bull bucks in its own arena. `props` names the scenery groups shown;
// `dirt` is [base, dark speck rgb, light speck rgb] for the ground texture.
export const ENVIRONMENTS = {
  fair: {
    name: 'County Fair',
    sky: ['#3d7fd0', '#86bde8', '#e4f0f4'],
    fog: ['#cfe0ea', 24, 70],
    hemi: ['#ffffff', '#6a5030', 1.25],
    sun: ['#fff4dc', 3.0, [4, 10, 6]],
    rim: ['#ffffff', 0.35],
    exposure: 1.0,
    dirt: ['#b58a5e', '80,48,22', '230,200,150'],
    groundRough: 1,
    dust: '#d6bb94',
    wall: '#2f5e8c',
    banners: ['COUNTY FAIR RODEO', '★ 8 SECONDS ★', 'FRESH LEMONADE'],
    orb: { color: '#fffbe8', pos: [14, 20, -50], size: 12 },
    props: ['fences', 'wall', 'stands', 'fair'],
    weather: null,
  },
  canyon: {
    name: 'Red Rock Canyon',
    sky: ['#2a1d4a', '#c8506a', '#ffb35c'],
    fog: ['#d98a5c', 20, 60],
    hemi: ['#ffd2a8', '#6a3a20', 1.0],
    sun: ['#ffb070', 2.8, [-7, 4.5, 4]],
    rim: ['#ff7a9a', 0.9],
    exposure: 1.1,
    dirt: ['#c48a52', '110,55,25', '240,190,130'],
    groundRough: 1,
    dust: '#e0aa74',
    wall: '#8a4a22',
    banners: ['RED ROCK ROUNDUP', '★ 8 SECONDS ★', 'WATCH FOR SNAKES'],
    orb: { color: '#ffb060', pos: [-34, 5, -46], size: 18 },
    props: ['fences', 'wall', 'canyon', 'canyonCrowd'],
    weather: null,
  },
  stadium: {
    name: 'Friday Night Stadium',
    sky: ['#120a28', '#4a2142', '#7a3448'],
    fog: ['#3a1a32', 16, 40],
    hemi: ['#ffe7c4', '#5a3a20', 1.1],
    sun: ['#fff1d6', 2.4, [3, 9, 6]],
    rim: ['#8fa8ff', 0.8],
    exposure: 1.15,
    dirt: ['#a07450', '70,40,18', '210,170,120'],
    groundRough: 1,
    dust: '#c7a175',
    wall: '#7a1e1e',
    banners: ['FANCY SENTRY RODEO', '★ 8 SECONDS ★', 'HOLD ON TIGHT'],
    orb: null,
    props: ['fences', 'wall', 'stands', 'towers'],
    weather: null,
  },
  storm: {
    name: 'Thunder Flats',
    sky: ['#101319', '#262c37', '#454d5b'],
    fog: ['#363c47', 11, 34],
    hemi: ['#b8c4d8', '#2a2620', 0.85],
    sun: ['#c8d4ff', 1.3, [2, 9, 5]],
    rim: ['#7f9cff', 0.7],
    exposure: 1.15,
    dirt: ['#5e4632', '35,24,14', '120,100,80'],
    groundRough: 0.55,
    dust: '#7a644e',
    wall: '#3a3f4a',
    banners: ['THUNDER FLATS', '★ 8 SECONDS ★', 'MIND THE MUD'],
    orb: null,
    props: ['fences', 'wall', 'stands', 'towers', 'storm'],
    weather: 'rain',
  },
  inferno: {
    name: "Devil's Pit",
    sky: ['#050000', '#3a0806', '#a0200c'],
    fog: ['#4a0e08', 14, 42],
    hemi: ['#ff9a70', '#300808', 0.75],
    sun: ['#ff7040', 1.6, [0, 9, 5]],
    rim: ['#ff3010', 1.3],
    exposure: 1.2,
    dirt: ['#4a2a20', '20,8,4', '120,60,40'],
    groundRough: 1,
    dust: '#6a5048',
    wall: '#2a0d0a',
    banners: ["DEVIL'S PIT", '★ 8 SECONDS ★', 'ABANDON HOPE'],
    orb: { color: '#ff3a1a', pos: [-12, 16, -48], size: 9 },
    props: ['fences', 'wall', 'stands', 'inferno'],
    weather: 'embers',
  },
  ocean: {
    name: 'Coral Reef',
    sky: ['#3aa6cf', '#0d5d8a', '#04243f'],
    fog: ['#0b4f73', 9, 34],
    hemi: ['#a8f0ff', '#0a3050', 1.2],
    sun: ['#c8f4ff', 2.2, [2, 10, 4]],
    rim: ['#40ffd0', 0.7],
    exposure: 1.1,
    dirt: ['#d8c79a', '150,130,90', '250,240,210'],
    groundRough: 1,
    dust: '#e6dcc0',
    wall: '#7a1e1e',
    banners: null,
    orb: { color: '#d8f8ff', pos: [0, 24, -34], size: 34 },
    props: ['reef', 'reefCrowd'],
    weather: 'bubbles',
  },
  sky: {
    name: 'Sky Islands',
    sky: ['#3a7bd5', '#8cc8f0', '#f2f8ff'],
    fog: ['#dcecfa', 26, 90],
    hemi: ['#ffffff', '#7aa0c0', 1.3],
    sun: ['#fff6e0', 3.0, [5, 10, 4]],
    rim: ['#ffd8f0', 0.5],
    exposure: 1.0,
    dirt: ['#6aa84f', '40,90,30', '170,220,120'],
    groundRough: 1,
    dust: '#ffffff',
    wall: '#7a1e1e',
    banners: null,
    orb: { color: '#fffbe8', pos: [-16, 22, -50], size: 12 },
    props: ['fences', 'skyIsles', 'skyCrowd'],
    weather: null,
    ground: false,
  },
  farm: {
    name: 'Sunny Farm',
    sky: ['#4a8ee0', '#9ccdf0', '#f4f0dc'],
    fog: ['#dfe8e0', 26, 75],
    hemi: ['#fff8e8', '#6a5030', 1.25],
    sun: ['#fff0d0', 3.0, [6, 10, 5]],
    rim: ['#ffffff', 0.35],
    exposure: 1.0,
    dirt: ['#8a6a42', '60,40,20', '190,160,110'],
    groundRough: 1,
    dust: '#c8a67a',
    wall: '#7a1e1e',
    banners: null,
    orb: { color: '#fffbe8', pos: [18, 20, -50], size: 12 },
    props: ['fences', 'farm', 'farmCrowd'],
    weather: null,
  },
};

const glowTexture = () => canvasTex(128, 128, (c, w) => {
  const g = c.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, w);
});

// ---------- Arena ----------
function buildArena(scene) {
  const dirtCache = {};
  const dirtTex = (env) => {
    if (dirtCache[env.name]) return dirtCache[env.name];
    const [base, dark, light] = env.dirt;
    const tex = canvasTex(512, 512, (c, w, h) => {
      c.fillStyle = base;
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const v = Math.random();
        c.fillStyle = v < 0.5 ? `rgba(${dark},${Math.random() * 0.25})` : `rgba(${light},${Math.random() * 0.2})`;
        const s = Math.random() * 3 + 1;
        c.fillRect(Math.random() * w, Math.random() * h, s, s);
      }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 7);
    return (dirtCache[env.name] = tex);
  };
  const groundMat = std('#ffffff', { roughness: 1 });
  const ground = mesh(new THREE.PlaneGeometry(70, 50), groundMat, scene, [0, 0, 0], null, [-Math.PI / 2, 0, 0]);
  ground.castShadow = false;

  const wood = std('#8b5a2b'), darkWood = std('#5e3a19');

  // Side fences the rider escapes to.
  const fences = new THREE.Group();
  scene.add(fences);
  for (const s of [-1, 1]) {
    const x = s * FENCE_X;
    for (let z = -4.2; z <= 4.2; z += 1.4) mesh(BOX, darkWood, fences, [x + s * 0.12, 0.8, z], [0.16, 1.6, 0.16]);
    for (let i = 0; i < 4; i++) mesh(BOX, wood, fences, [x + s * 0.02, 0.3 + i * 0.34, 0], [0.07, 0.15, 8.6]);
  }

  // Back wall with banners.
  const wall = new THREE.Group();
  scene.add(wall);
  const wallMat = std('#7a1e1e');
  const cream = std('#e8d3a8');
  mesh(BOX, wallMat, wall, [0, 0.65, -4.4], [24, 1.3, 0.2]);
  mesh(BOX, cream, wall, [0, 1.32, -4.4], [24, 0.06, 0.24]);
  const bannerTex = [];
  const banners = ENVIRONMENTS.stadium.banners;
  const drawBanner = (txt, gold) => (c, w, h) => {
    c.fillStyle = gold ? '#f2c14e' : '#efe2c4';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#5a1a12';
    c.lineWidth = 8;
    c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#5a1a12';
    c.font = '64px "Rye", Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(txt, w / 2, h / 2 + 4);
  };
  banners.forEach((txt, i) => {
    const tex = canvasTex(1024, 140, drawBanner(txt, i === 1));
    bannerTex.push({ tex, txt, gold: i === 1 });
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    const b = mesh(new THREE.PlaneGeometry(3.2, 0.44), mat, wall, [(i - 1) * 3.6, 0.66, -4.29]);
    b.castShadow = false;
  });
  const redrawBanners = () => {
    for (const b of bannerTex) {
      drawBanner(b.txt, b.gold)(b.tex.image.getContext('2d'), b.tex.image.width, b.tex.image.height);
      b.tex.needsUpdate = true;
    }
  };
  if (document.fonts && document.fonts.load) {
    document.fonts.load('64px "Rye"').then(redrawBanners).catch(() => {});
  }

  // Grandstand steps.
  const stands = new THREE.Group();
  scene.add(stands);
  const standMats = [std('#4b2f1f'), std('#3e2618')];
  const ROWS = 6;
  for (let r = 0; r < ROWS; r++) {
    const h = 1.4 + r * 0.42;
    mesh(BOX, standMats[r % 2], stands, [0, h / 2, -5.0 - r * 0.7], [26, h, 0.7]).castShadow = false;
  }

  // Crowd: instanced bodies, heads and hats.
  const people = [];
  const colors = ['#c0392b', '#e67e22', '#f1c40f', '#ecf0f1', '#3498db', '#27ae60', '#8e44ad', '#d35400', '#bdc3c7', '#16a085'];
  for (let r = 0; r < ROWS; r++) {
    for (let i = 0; i < 46; i++) {
      people.push({
        x: -11.5 + i * 0.5 + (r % 2) * 0.25 + (Math.random() - 0.5) * 0.1,
        y: 1.4 + r * 0.42,
        z: -5.0 - r * 0.7,
        ph: Math.random() * Math.PI * 2,
        color: colors[(Math.random() * colors.length) | 0],
        hat: Math.random() < 0.6,
        hatColor: HAT_COLORS[(Math.random() * HAT_COLORS.length) | 0],
        tilt: (Math.random() - 0.5) * 0.3,
        turn: (Math.random() - 0.5) * 0.8,
        speed: 0.85 + Math.random() * 0.3,
      });
    }
  }
  const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.4, 0.24), std('#ffffff'), people.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 12, 8), std('#d9a679'), people.length);
  const hatCount = people.filter((p) => p.hat).length;
  const hats = new THREE.InstancedMesh(COWBOY_HAT, std('#ffffff', { roughness: 0.9, side: THREE.DoubleSide }), hatCount);
  const bands = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.121, 0.124, 0.03, 16), std('#3a2414'), hatCount);
  people.forEach((p, i) => bodies.setColorAt(i, new THREE.Color(p.color)));
  people.filter((p) => p.hat).forEach((p, i) => hats.setColorAt(i, new THREE.Color(p.hatColor)));
  stands.add(bodies, heads, hats, bands);
  const mtx = new THREE.Matrix4();
  const dummy = new THREE.Object3D();
  // The bob runs on an accumulated phase so its tempo can follow the crowd's
  // excitement without jumping (scaling t directly made them jitter).
  let crowdPhase = 0, lastCrowdT = null;
  function updateCrowd(t, excite) {
    const dt = lastCrowdT === null ? 0 : Math.min(0.1, Math.max(0, t - lastCrowdT));
    lastCrowdT = t;
    crowdPhase += dt * (2.2 + excite * 3.5);
    if (!stands.visible) return;
    let h = 0;
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      const wave = 0.5 - 0.5 * Math.cos(crowdPhase * p.speed + p.ph);
      const bob = wave * wave * (0.015 + excite * 0.1);
      mtx.makeTranslation(p.x, p.y + 0.21 + bob, p.z);
      bodies.setMatrixAt(i, mtx);
      mtx.makeTranslation(p.x, p.y + 0.55 + bob, p.z);
      heads.setMatrixAt(i, mtx);
      if (p.hat) {
        dummy.position.set(p.x, p.y + 0.6 + bob, p.z);
        dummy.rotation.set(p.tilt * 0.5, p.turn, p.tilt);
        dummy.updateMatrix();
        hats.setMatrixAt(h, dummy.matrix);
        dummy.position.y += 0.045;
        dummy.updateMatrix();
        bands.setMatrixAt(h++, dummy.matrix);
      }
    }
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    hats.instanceMatrix.needsUpdate = true;
    bands.instanceMatrix.needsUpdate = true;
  }

  // Light towers with glowing heads.
  const towers = new THREE.Group();
  scene.add(towers);
  const glowTex = glowTexture();
  const pole = std('#2a2236');
  const lamp = new THREE.MeshBasicMaterial({ color: '#fff7dd' });
  for (const x of [-9, -3.2, 3.2, 9]) {
    const z = -11;
    mesh(CYL, pole, towers, [x, 5, z], [0.12, 10, 0.12]);
    mesh(BOX, lamp, towers, [x, 10, z + 0.1], [1.4, 0.5, 0.1]);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffeccc', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.position.set(x, 10, z + 0.3);
    glow.scale.set(5, 5, 1);
    towers.add(glow);
  }

  function setEnv(env) {
    ground.visible = env.ground !== false;
    groundMat.map = dirtTex(env);
    groundMat.roughness = env.groundRough;
    groundMat.needsUpdate = true;
    wallMat.color.set(env.wall);
    if (env.banners) {
      bannerTex.forEach((b, i) => { b.txt = env.banners[i]; });
      redrawBanners();
    }
  }

  return { updateCrowd, wood, darkWood, stands, towers, fences, wall, setEnv };
}

// ---------- Scenery for each environment ----------
function tree(parent, x, z, s, leaf) {
  mesh(CYL, std('#5a3b22'), parent, [x, 0.6 * s, z], [0.18 * s, 1.2 * s, 0.18 * s]);
  mesh(new THREE.ConeGeometry(1, 1, 9), leaf, parent, [x, 2.1 * s, z], [1.1 * s, 2.4 * s, 1.1 * s]);
}

function buildFair() {
  const group = new THREE.Group();
  // Ferris wheel in the distance.
  const hub = new V3(13, 8, -24);
  const steel = std('#eef0f6', { metalness: 0.3, roughness: 0.5 });
  const wheel = new THREE.Group();
  wheel.position.copy(hub);
  group.add(wheel);
  mesh(new THREE.TorusGeometry(6, 0.12, 8, 56), steel, wheel);
  mesh(new THREE.TorusGeometry(3, 0.08, 8, 40), steel, wheel);
  for (let i = 0; i < 6; i++) mesh(BOX, steel, wheel, [0, 0, 0], [12, 0.1, 0.1], [0, 0, (i / 6) * Math.PI]);
  for (const s of [-1, 1]) {
    for (const d of [-1, 1]) mesh(BOX, steel, group, [hub.x + s * 2.1, hub.y / 2, hub.z + d * 0.5], [0.25, hub.y * 1.08, 0.25], [0, 0, s * 0.27]);
  }
  const carColors = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71'];
  const cars = [];
  for (let i = 0; i < 12; i++) {
    cars.push({ m: mesh(BOX, std(carColors[i % 4]), group, null, [0.8, 0.7, 0.8]), a: (i / 12) * Math.PI * 2 });
  }

  // Striped tents.
  const stripes = canvasTex(256, 16, (c, w, h) => {
    for (let i = 0; i < 16; i++) {
      c.fillStyle = i % 2 ? '#f4efe6' : '#d23a2c';
      c.fillRect((i * w) / 16, 0, w / 16 + 1, h);
    }
  });
  const tentWall = std('#ffffff', { map: stripes });
  const tentTop = std('#d23a2c');
  for (const [x, z, s] of [[-12, -15, 1.3], [-16.5, -11, 1], [-8.5, -19, 1.1]]) {
    mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true), tentWall, group, [x, 0.8 * s, z], [1.8 * s, 1.6 * s, 1.8 * s]);
    mesh(new THREE.ConeGeometry(1, 1, 16), tentTop, group, [x, 2.2 * s, z], [2.1 * s, 1.3 * s, 2.1 * s]);
  }

  // Trees all around the fairground.
  const leaf = std('#4f8a3a');
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + Math.random() * 0.2;
    const r = 18 + Math.random() * 10;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (Math.hypot(x - hub.x, z - hub.z) < 8) continue;
    tree(group, x, z, 1 + Math.random() * 0.8, leaf);
  }

  // Bunting strung above the back wall.
  const flagGeo = new THREE.ConeGeometry(0.16, 0.34, 3);
  for (let i = 0; i < 40; i++) {
    const x = -11.7 + i * 0.6;
    const sag = 0.25 * Math.sin(((i % 10) / 10) * Math.PI);
    const f = mesh(flagGeo, std(carColors[i % 4]), group, [x, 2.4 - sag, -4.35], null, [Math.PI, 0, 0]);
    f.castShadow = false;
  }

  return {
    group,
    update(t) {
      const rot = t * 0.12;
      wheel.rotation.z = rot;
      for (const c of cars) c.m.position.set(hub.x + Math.cos(c.a + rot) * 6, hub.y + Math.sin(c.a + rot) * 6 - 0.55, hub.z);
    },
  };
}

function buildCanyon() {
  const group = new THREE.Group();
  const rock = [std('#a8502c'), std('#c06a3a'), std('#8a3e22')];
  const band = std('#d9946a');
  const mesas = [
    [-26, -30, 7, 9], [-12, -38, 9, 13], [6, -34, 6, 8], [22, -30, 8, 11], [34, -12, 6, 7],
    [-34, -8, 7, 10], [-28, 18, 8, 9], [26, 20, 7, 12], [4, 30, 9, 8],
  ];
  mesas.forEach(([x, z, r, h], i) => {
    mesh(new THREE.CylinderGeometry(r * 0.85, r, h, 8), rock[i % 3], group, [x, h / 2, z]).castShadow = false;
    mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.88, h * 0.08, 8), band, group, [x, h * 0.7, z]).castShadow = false;
  });

  const cactusMat = std('#4f7a3a');
  const cactus = (x, z, s) => {
    mesh(CYL, cactusMat, group, [x, 1.1 * s, z], [0.18 * s, 2.2 * s, 0.18 * s]);
    mesh(SPHERE, cactusMat, group, [x, 2.2 * s, z], [0.18 * s, 0.18 * s, 0.18 * s]);
    for (const d of [-1, 1]) {
      const h = (d > 0 ? 1.0 : 1.3) * s;
      mesh(CYL, cactusMat, group, [x + d * 0.3 * s, h, z], [0.12 * s, 0.12 * s, 0.6 * s], [0, 0, Math.PI / 2]);
      mesh(CYL, cactusMat, group, [x + d * 0.55 * s, h + 0.35 * s, z], [0.12 * s, 0.7 * s, 0.12 * s]);
    }
  };
  for (const [x, z, s] of [[-7, -7, 1.1], [-9.5, -12, 1.4], [8, -9, 1.2], [11, -14, 1], [-14, 3, 1.3], [13, 2, 1.2], [3, -15, 1.5], [-3, -10, 0.9]]) {
    cactus(x, z, s);
  }
  for (let i = 0; i < 18; i++) {
    const s = 0.2 + Math.random() * 0.5;
    mesh(new THREE.DodecahedronGeometry(1, 0), rock[i % 3], group, [(Math.random() - 0.5) * 30, s * 0.4, -6 - Math.random() * 14], [s, s * 0.7, s]);
  }

  const weed = mesh(new THREE.IcosahedronGeometry(0.4, 1), std('#a07a48', { wireframe: true }), group);
  return {
    group,
    update(t) {
      const u = (t * 2.4) % 40;
      weed.position.set(-20 + u, 0.4 + Math.abs(Math.sin(t * 3.2)) * 1.6, -6);
      weed.rotation.z = -t * 5;
    },
  };
}

function buildStorm(scene) {
  const group = new THREE.Group();
  // Windmill spinning in the gale.
  const metal = std('#4a4e56', { metalness: 0.4, roughness: 0.6 });
  mesh(new THREE.CylinderGeometry(0.25, 1.1, 9, 4), metal, group, [-12, 4.5, -15]);
  const rotor = new THREE.Group();
  rotor.position.set(-12, 9.2, -14.4);
  group.add(rotor);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    mesh(BOX, metal, rotor, [-Math.sin(a) * 1.1, Math.cos(a) * 1.1, 0], [0.35, 2.2, 0.05], [0, 0, a]);
  }
  mesh(BOX, metal, group, [-12, 9.2, -16], [0.1, 0.9, 1.6]);

  // Bare trees.
  const bark = std('#2e2620');
  for (const [x, z, s] of [[14, -14, 1.3], [18, -6, 1], [-17, -4, 1.1], [10, -20, 1.5]]) {
    mesh(CYL, bark, group, [x, 1.6 * s, z], [0.15 * s, 3.2 * s, 0.15 * s]);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7;
      mesh(CYL, bark, group, [x + Math.cos(a) * 0.5 * s, (2.3 + i * 0.3) * s, z + Math.sin(a) * 0.5 * s], [0.06 * s, 1.4 * s, 0.06 * s], [Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8]);
    }
  }

  // Lightning: a jagged bolt plus a flash of light over everything.
  const flash = new THREE.AmbientLight('#dfe8ff', 0);
  scene.add(flash);
  const bolt = new THREE.Group();
  group.add(bolt);
  const boltMat = new THREE.MeshBasicMaterial({ color: '#f4f7ff', fog: false });
  let next = 2, level = 0, flicker = 0;
  function strike() {
    bolt.clear();
    let p = new V3((Math.random() - 0.5) * 50, 26, -38 - Math.random() * 10);
    while (p.y > 0) {
      const q = p.clone().add(new V3((Math.random() - 0.5) * 3, -1.5 - Math.random() * 2, 0));
      const seg = new THREE.Mesh(BOX, boltMat);
      seg.position.copy(p).lerp(q, 0.5);
      seg.scale.set(0.16, p.distanceTo(q), 0.16);
      seg.rotation.z = Math.atan2(-(q.x - p.x), q.y - p.y);
      bolt.add(seg);
      p = q;
    }
    level = 1;
    flicker = Math.random() < 0.6 ? 0.18 : 0;
  }

  return {
    group,
    update(t, dt) {
      rotor.rotation.z -= dt * 5;
      next -= dt;
      if (next <= 0) {
        strike();
        next = 3 + Math.random() * 5;
      }
      if (flicker > 0) {
        flicker -= dt;
        if (flicker <= 0) level = 0.9;
      }
      level = Math.max(0, level - dt * 3.2);
      flash.intensity = group.visible ? level * 3 : 0;
      bolt.visible = level > 0.35;
    },
  };
}

function buildInferno(scene) {
  const group = new THREE.Group();
  const rock = std('#2b1712');
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = 17 + Math.random() * 14;
    const h = 4 + Math.random() * 9;
    mesh(new THREE.ConeGeometry(1, 1, 6), rock, group, [Math.sin(a) * r, h / 2, Math.cos(a) * r], [1.2 + Math.random() * 1.5, h, 1.2 + Math.random() * 1.5]).castShadow = false;
  }

  // Lava channels outside the fences.
  const lava = new THREE.MeshBasicMaterial({ color: '#ff5a14' });
  for (const s of [-1, 1]) {
    mesh(new THREE.PlaneGeometry(2.4, 40), lava, group, [s * 7.5, 0.02, 4], null, [-Math.PI / 2, 0, 0]).castShadow = false;
  }

  // Fire braziers at the arena corners. The lights live on the scene (not in
  // the toggled group) so switching arenas never changes the light count.
  const iron = std('#1c1412', { metalness: 0.5, roughness: 0.5 });
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ff8a1a', transparent: true, opacity: 0.9 });
  const coreMat = new THREE.MeshBasicMaterial({ color: '#ffe07a' });
  const fires = [];
  for (const [x, z] of [[-4.7, -4.0], [4.7, -4.0], [-4.7, 3.6], [4.7, 3.6]]) {
    mesh(CYL, iron, group, [x, 0.7, z], [0.12, 1.4, 0.12]);
    mesh(new THREE.CylinderGeometry(0.4, 0.2, 0.3, 12), iron, group, [x, 1.5, z]);
    const flame = mesh(new THREE.ConeGeometry(0.3, 0.9, 10), flameMat, group, [x, 2.0, z]);
    const core = mesh(new THREE.ConeGeometry(0.16, 0.5, 8), coreMat, group, [x, 1.85, z]);
    flame.castShadow = core.castShadow = false;
    const light = new THREE.PointLight('#ff7a2a', 0, 9, 2);
    light.position.set(x, 2.2, z);
    scene.add(light);
    fires.push({ flame, core, light, ph: Math.random() * 10 });
  }

  return {
    group,
    update(t) {
      const on = group.visible;
      lava.color.setRGB(1, 0.32 + 0.08 * Math.sin(t * 2), 0.06);
      for (const f of fires) {
        const k = 1 + 0.18 * Math.sin(t * 13 + f.ph) + 0.1 * Math.sin(t * 29 + f.ph * 2);
        f.flame.scale.set(1, k, 1);
        f.core.scale.set(1, k * 0.9, 1);
        f.light.intensity = on ? 14 * k : 0;
      }
    },
  };
}

// A swaying stalk (kelp, tentacle-like plants): a chain of segments whose joints bend.
function stalk(parent, pos, n, len, r, mat) {
  const joints = [];
  let p = new THREE.Group();
  p.position.set(...pos);
  parent.add(p);
  for (let i = 0; i < n; i++) {
    const rr = r * (1 - (i / n) * 0.5);
    const seg = mesh(BOX, mat, p, [0, len / 2, 0], [rr * 2.4, len, rr * 0.5]);
    seg.castShadow = false;
    joints.push(p);
    const next = new THREE.Group();
    next.position.y = len;
    p.add(next);
    p = next;
  }
  return joints;
}

function buildReef() {
  const group = new THREE.Group();
  const rockMats = [std('#4a5a68'), std('#5a6670'), std('#3e4a58')];
  const coralCols = ['#ff6f91', '#ff9a5c', '#ffd25c', '#b06cff', '#5cffc8', '#ff4f6a'];
  const coral = coralCols.map((c) => std(c, { roughness: 0.7, emissive: new THREE.Color(c), emissiveIntensity: 0.12 }));

  const rock = (x, y, z, s, i) => mesh(new THREE.DodecahedronGeometry(1, 0), rockMats[i % 3], group, [x, y, z], [s, s * 0.8, s], [i, i * 2, 0]);
  const coralClump = (x, y, z, s, i) => {
    const m = coral[i % coral.length];
    if (i % 3 === 0) {
      mesh(SPHERE, m, group, [x, y + 0.2 * s, z], [0.3 * s, 0.25 * s, 0.3 * s]); // brain coral
    } else if (i % 3 === 1) {
      for (let k = 0; k < 4; k++) mesh(CYL, m, group, [x + Math.cos(k * 1.7) * 0.12 * s, y + 0.3 * s, z + Math.sin(k * 1.7) * 0.12 * s], [0.05 * s, 0.6 * s, 0.05 * s], [Math.sin(k) * 0.4, 0, Math.cos(k) * 0.4]);
    } else {
      mesh(new THREE.CircleGeometry(0.4 * s, 12), new THREE.MeshStandardMaterial({ color: coralCols[i % 6], side: THREE.DoubleSide, roughness: 0.8 }), group, [x, y + 0.4 * s, z], null, [0, i, 0]); // sea fan
    }
  };

  // Rock-and-coral walls where the fences would be, plus a back reef.
  let n = 0;
  for (const s of [-1, 1]) {
    for (let z = -4.2; z <= 4.2; z += 0.9) {
      rock(s * (FENCE_X + 0.3), 0.5, z, 0.6 + Math.random() * 0.25, n);
      rock(s * (FENCE_X + 0.35), 1.15, z + 0.4, 0.45, n + 1);
      if (n % 2 === 0) coralClump(s * (FENCE_X + 0.2), 1.45, z, 1, n);
      n++;
    }
  }
  for (let x = -11; x <= 11; x += 1.1) {
    rock(x, 0.5, -4.8 - Math.random() * 0.4, 0.7 + Math.random() * 0.3, n);
    coralClump(x + 0.3, 1.0, -4.5, 1.2 + Math.random() * 0.5, n++);
  }

  // Kelp forest behind the reef and off to the sides.
  const kelpMat = std('#3f8a3a', { roughness: 0.7 });
  const kelp = [];
  for (let i = 0; i < 30; i++) {
    const x = (Math.random() - 0.5) * 30;
    const z = -6 - Math.random() * 12;
    kelp.push({ joints: stalk(group, [x, 0, z], 8 + ((Math.random() * 5) | 0), 0.55, 0.12, kelpMat), ph: Math.random() * 6 });
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) kelp.push({ joints: stalk(group, [s * (6 + Math.random() * 6), 0, -3 + Math.random() * 8], 7, 0.5, 0.12, kelpMat), ph: Math.random() * 6 });
  }

  // Treasure chest half-buried by the back reef.
  const chestWood = std('#6b3f1d'), gold = std('#ffd34d', { metalness: 0.8, roughness: 0.3, emissive: new THREE.Color('#ffb000'), emissiveIntensity: 0.3 });
  mesh(BOX, chestWood, group, [2.6, 0.22, -3.7], [0.7, 0.45, 0.45], [0, 0.3, 0.1]);
  mesh(BOX, gold, group, [2.6, 0.48, -3.7], [0.72, 0.08, 0.47], [0, 0.3, 0.1]);
  mesh(SPHERE, gold, group, [2.15, 0.08, -3.4], [0.12, 0.04, 0.12]);

  // Schools of fish circling in the distance.
  const FISH = 70;
  const fishMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.08, 0.3, 6), std('#ffffff', { roughness: 0.4 }), FISH);
  fishMesh.castShadow = false;
  const fishCols = ['#ffd25c', '#5cc8ff', '#ff8a5c', '#c8f0ff'];
  const fish = [];
  for (let i = 0; i < FISH; i++) {
    const school = i % 4;
    fish.push({ school, r: 7 + school * 3 + Math.random(), y: 2 + school * 0.9 + Math.random() * 0.8, ph: Math.random() * 0.8 + school * 1.6, cz: -10 - school * 2, sp: 0.18 + school * 0.03 });
    fishMesh.setColorAt(i, new THREE.Color(fishCols[school]));
  }
  group.add(fishMesh);

  // Shafts of light from the surface.
  const shaftMat = new THREE.MeshBasicMaterial({ color: '#bff4ff', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const shafts = [];
  for (let i = 0; i < 7; i++) {
    const m = mesh(new THREE.ConeGeometry(1.4, 16, 12, 1, true), shaftMat, group, [-12 + i * 4 + Math.random(), 8, -6 - Math.random() * 6], null, [0, 0, 0.25]);
    m.castShadow = m.receiveShadow = false;
    shafts.push(m);
  }

  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3(1, 1, 1), pos = new V3();
  const fwd = new THREE.Euler();
  return {
    group,
    update(t) {
      if (!group.visible) return;
      for (const k of kelp) k.joints.forEach((j, i) => { j.rotation.z = Math.sin(t * 0.9 + k.ph + i * 0.5) * 0.08; j.rotation.x = Math.sin(t * 0.7 + k.ph * 2 + i * 0.4) * 0.05; });
      for (let i = 0; i < FISH; i++) {
        const f = fish[i];
        const a = t * f.sp + f.ph + (i % 17) * 0.05;
        pos.set(Math.cos(a) * f.r, f.y + Math.sin(t + i) * 0.1, f.cz + Math.sin(a) * f.r * 0.4);
        fwd.set(0, -a, -Math.PI / 2);
        q.setFromEuler(fwd);
        mtx.compose(pos, q, sc);
        fishMesh.setMatrixAt(i, mtx);
      }
      fishMesh.instanceMatrix.needsUpdate = true;
      shafts.forEach((m, i) => { m.rotation.z = 0.25 + Math.sin(t * 0.3 + i) * 0.06; });
    },
  };
}

function island(parent, x, y, z, r, grass, rockMat) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  mesh(new THREE.CylinderGeometry(r, r * 0.9, r * 0.12, 20), grass, g, [0, -r * 0.06, 0]);
  mesh(new THREE.ConeGeometry(r * 0.9, r * 1.1, 10), rockMat, g, [0, -r * 0.12 - r * 0.55, 0], null, [Math.PI, 0, 0]);
  return g;
}

function buildSkyIsles() {
  const group = new THREE.Group();
  const grass = std('#6aa84f');
  const rockMat = std('#8a7a6a');
  // The island the arena sits on.
  const home = island(group, 0, 0, 0, 8, grass, rockMat);
  home.children.forEach((m) => { m.receiveShadow = true; });
  const leaf = std('#4f8a3a');
  for (const [x, z] of [[-6.5, -3], [6.4, -2], [-5.5, 3.5], [6, 4], [-7.2, 1], [7.3, 0.5]]) tree(group, x, z, 0.8, leaf);

  // A sea of clouds far below and puffs drifting by.
  const cloudMat = std('#ffffff', { roughness: 1, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.25 });
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 40;
    const s = 2 + Math.random() * 4;
    mesh(SPHERE, cloudMat, group, [Math.cos(a) * r, -9 - Math.random() * 3, Math.sin(a) * r], [s * 1.6, s * 0.6, s]).castShadow = false;
  }
  const drift = [];
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    c.position.set((Math.random() - 0.5) * 60, 4 + Math.random() * 6, -18 - Math.random() * 20);
    for (let k = 0; k < 4; k++) mesh(SPHERE, cloudMat, c, [k * 0.9 - 1.4, Math.sin(k) * 0.3, 0], [1.1, 0.7, 0.8]).castShadow = false;
    group.add(c);
    drift.push(c);
  }

  // Distant floating islands, some with trees.
  const far = [];
  for (const [x, y, z, r] of [[-18, 2, -24, 3], [16, 4, -28, 4], [26, -1, -12, 2.5], [-28, 5, -8, 3.5], [4, 7, -38, 5], [-10, -2, 22, 3], [20, 1, 18, 3]]) {
    const g = island(group, x, y, z, r, grass, rockMat);
    tree(g, 0, 0, r * 0.35, leaf);
    far.push({ g, y, ph: Math.random() * 6 });
  }

  // Rainbow.
  ['#ff4f4f', '#ff9a3c', '#ffe14f', '#5cd65c', '#4fa8ff', '#9a6cff'].forEach((c, i) => {
    const m = mesh(new THREE.TorusGeometry(26 - i * 0.7, 0.35, 6, 64, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35, fog: false }), group, [8, -6, -60]);
    m.castShadow = false;
  });

  return {
    group,
    update(t, dt) {
      if (!group.visible) return;
      for (const c of drift) {
        c.position.x += dt * 0.8;
        if (c.position.x > 35) c.position.x = -35;
      }
      for (const f of far) f.g.position.y = f.y + Math.sin(t * 0.4 + f.ph) * 0.4;
    },
  };
}

function buildFarm() {
  const group = new THREE.Group();
  const red = std('#b8322a'), white = std('#f4efe6'), roof = std('#5a5a62');
  // Barn with a gabled roof.
  const barn = new THREE.Group();
  barn.position.set(-6, 0, -14);
  group.add(barn);
  mesh(BOX, red, barn, [0, 2, 0], [6, 4, 5]);
  const gable = new THREE.Shape([new THREE.Vector2(-3.3, 0), new THREE.Vector2(3.3, 0), new THREE.Vector2(0, 2.4)]);
  const roofGeo = new THREE.ExtrudeGeometry(gable, { depth: 5.4, bevelEnabled: false });
  mesh(roofGeo, roof, barn, [0, 4, -2.7]);
  mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-3, 0), new THREE.Vector2(3, 0), new THREE.Vector2(0, 2.2)]), { depth: 5.02, bevelEnabled: false }), red, barn, [0, 4, -2.51]);
  mesh(BOX, white, barn, [0, 1.4, 2.52], [2.4, 2.8, 0.05]);
  mesh(BOX, red, barn, [0, 1.4, 2.56], [2.1, 2.5, 0.05]);
  for (const s of [-1, 1]) mesh(BOX, white, barn, [0, 1.4, 2.6], [0.12, 3.4, 0.04], [0, 0, s * 0.72]);
  mesh(BOX, white, barn, [0, 4.6, 2.52], [1, 0.9, 0.05]);
  // Silo.
  mesh(CYL, std('#c8ccd2', { metalness: 0.3, roughness: 0.5 }), group, [-1.6, 3.5, -15], [1.3, 7, 1.3]);
  mesh(SPHERE, std('#9aa0a8', { metalness: 0.4, roughness: 0.4 }), group, [-1.6, 7, -15], [1.3, 1, 1.3]);

  // Hay bales stacked where the back wall would be, and rolled bales around.
  const hay = std('#e0c070'), hayEnd = std('#c8a050');
  for (let x = -11; x <= 11; x += 1.3) {
    mesh(BOX, hay, group, [x, 0.35, -4.5], [1.25, 0.7, 0.8]);
    if (Math.abs(x) > 1.5 && Math.random() < 0.6) mesh(BOX, hay, group, [x + 0.3, 1.05, -4.6], [1.25, 0.7, 0.8]);
  }
  for (const [x, z] of [[7, -7], [8.5, -6], [-8, -6.5], [9, 3], [-9, 2]]) {
    mesh(CYL, hay, group, [x, 0.7, z], [0.7, 1.2, 0.7], [Math.PI / 2, 0, Math.random()]);
    mesh(CYL, hayEnd, group, [x, 0.7, z], [0.6, 1.22, 0.6], [Math.PI / 2, 0, Math.random()]);
  }

  // Tractor.
  const tractor = new THREE.Group();
  tractor.position.set(8, 0, -10);
  tractor.rotation.y = -0.6;
  group.add(tractor);
  const green = std('#2f8a3a'), tire = std('#1c1c1c', { roughness: 0.9 }), rim = std('#ffd34d');
  mesh(BOX, green, tractor, [0.3, 0.9, 0], [2.2, 0.8, 1]);
  mesh(BOX, green, tractor, [-0.5, 1.6, 0], [0.9, 0.9, 1]);
  mesh(BOX, std('#bfe6ff', { roughness: 0.2 }), tractor, [-0.5, 1.7, 0], [0.92, 0.6, 0.9]);
  for (const s of [-1, 1]) {
    mesh(CYL, tire, tractor, [-0.6, 0.7, s * 0.65], [0.7, 0.35, 0.7], [Math.PI / 2, 0, 0]);
    mesh(CYL, rim, tractor, [-0.6, 0.7, s * 0.84], [0.35, 0.02, 0.35], [Math.PI / 2, 0, 0]);
    mesh(CYL, tire, tractor, [1.1, 0.4, s * 0.6], [0.4, 0.25, 0.4], [Math.PI / 2, 0, 0]);
  }
  mesh(CYL, std('#333333'), tractor, [0.9, 1.6, 0.2], [0.06, 0.8, 0.06]);

  // Crop fields stretching away.
  const rows = (a, b) => canvasTex(64, 64, (c, w, h) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? a : b;
      c.fillRect(0, (i * h) / 8, w, h / 8 + 1);
    }
  });
  for (const [x, z, a, b] of [[-14, -30, '#7ab648', '#5a8a32'], [6, -32, '#e8c860', '#c8a840'], [24, -22, '#7ab648', '#4a7a2a'], [-28, -14, '#e8c860', '#c8a040']]) {
    const t = rows(a, b);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 6);
    mesh(new THREE.PlaneGeometry(16, 14), std('#ffffff', { map: t }), group, [x, 0.02, z], null, [-Math.PI / 2, 0, 0.2]).castShadow = false;
  }
  const leaf = std('#4f8a3a');
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    const r = 18 + Math.random() * 8;
    if (Math.sin(a) < -0.3) continue; // keep the view of the fields open
    tree(group, Math.cos(a) * r, Math.sin(a) * r - 4, 1 + Math.random() * 0.6, leaf);
  }

  // A few chickens pecking outside the fences.
  const hens = [];
  for (const [x, z] of [[-6.2, 1], [-7, 2.4], [6.3, -1.5], [7.2, 0.6], [5.8, 2.8]]) {
    const h = new THREE.Group();
    h.position.set(x, 0, z);
    h.rotation.y = Math.random() * 6;
    group.add(h);
    mesh(SPHERE, white, h, [0, 0.25, 0], [0.2, 0.16, 0.15]);
    const head = new THREE.Group();
    head.position.set(0.16, 0.38, 0);
    h.add(head);
    mesh(SPHERE, white, head, [0, 0, 0], [0.08, 0.08, 0.08]);
    mesh(SPHERE, red, head, [0, 0.07, 0], [0.04, 0.04, 0.02]);
    mesh(new THREE.ConeGeometry(0.03, 0.08, 6), std('#f2a33a'), head, [0.08, -0.01, 0], null, [0, 0, -Math.PI / 2]);
    hens.push({ head, ph: Math.random() * 6 });
  }

  return {
    group,
    update(t) {
      if (!group.visible) return;
      for (const h of hens) h.head.rotation.z = -Math.max(0, Math.sin(t * 3 + h.ph)) * 0.9;
    },
  };
}

// ---------- Themed crowds ----------
// Spectators for the maps without a grandstand. Each crowd is rows of seats plus
// a mix of spectator kinds; every kind is a few instanced parts (body, head, ...)
// placed in the spectator's own frame, where +z faces the arena.
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function buildCrowd({ rows, kinds, seat, size = 1 }) {
  const group = new THREE.Group();
  const spots = [];
  rows.forEach((row, r) => {
    seat(group, row, r);
    for (let x = row.x0; x <= row.x1; x += row.gap) {
      if (Math.random() < (row.skip || 0)) continue;
      spots.push({ x: x + (Math.random() - 0.5) * row.gap * 0.3, y: row.y, z: row.z + (Math.random() - 0.5) * 0.12 });
    }
  });
  // Deal spots out to kinds by weight.
  const total = kinds.reduce((a, k) => a + k.weight, 0);
  const members = kinds.map(() => []);
  for (const sp of spots) {
    let roll = Math.random() * total, i = 0;
    while (roll > kinds[i].weight) roll -= kinds[i++].weight;
    members[i].push({ ...sp, ph: Math.random() * 6.28, speed: 0.85 + Math.random() * 0.3, turn: (Math.random() - 0.5) * 0.6, tints: {} });
  }
  const sets = kinds.map((kind, ki) => {
    const list = members[ki];
    for (const m of list) for (const key in kind.palettes || {}) m.tints[key] = new THREE.Color(pick(kind.palettes[key]));
    const parts = kind.parts.map((part) => {
      const im = new THREE.InstancedMesh(part.geo, part.mat || std(part.color || '#ffffff', { roughness: 0.8 }), Math.max(1, list.length));
      im.count = list.length;
      im.castShadow = false;
      if (part.tint) list.forEach((m, i) => im.setColorAt(i, m.tints[part.tint]));
      const local = new THREE.Matrix4().compose(new V3(...(part.pos || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rot || [0, 0, 0]))), new V3(...(part.scale || [1, 1, 1])));
      group.add(im);
      return { im, local, flap: part.flap };
    });
    return { kind, list, parts };
  });

  const base = new THREE.Matrix4(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new V3(size, size, size), p = new V3();
  const flapM = new THREE.Matrix4();
  let phase = 0;
  return {
    group,
    update(t, dt, excite = 0.2) {
      phase += dt * (2.2 + excite * 3.5);
      if (!group.visible) return;
      for (const { kind, list, parts } of sets) {
        list.forEach((m, i) => {
          const wave = 0.5 - 0.5 * Math.cos(phase * m.speed + m.ph);
          const lift = kind.motion === 'float' ? 0.06 * Math.sin(t * 1.5 + m.ph) + wave * excite * 0.12 : wave * wave * (0.015 + excite * (kind.hop || 0.1));
          const sway = kind.motion === 'float' ? Math.sin(t * 0.9 + m.ph) * 0.08 : 0;
          p.set(m.x + sway, m.y + lift, m.z);
          // Face the arena's center, give or take.
          e.set(0, Math.atan2(-m.x, -m.z) + m.turn + (kind.motion === 'float' ? Math.sin(t + m.ph) * 0.15 : 0), 0);
          base.compose(p, q.setFromEuler(e), one);
          for (const part of parts) {
            m4.multiplyMatrices(base, part.local);
            if (part.flap) {
              // Wings and claws wave while the crowd is excited.
              flapM.makeRotationZ(part.flap * (0.2 + wave * excite * 1.2));
              m4.multiply(flapM);
            }
            part.im.setMatrixAt(i, m4);
          }
        });
        for (const part of parts) part.im.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

const SKIN = ['#e0b089', '#c68e62', '#8d5a3b', '#f1c9a5', '#6b4430'];
const EYE_W = std('#ffffff', { roughness: 0.3 });
const EYE_B = std('#111111', { roughness: 0.2 });
const eyePair = (y, z, x, r) => [-1, 1].flatMap((s) => [
  { geo: SPHERE, mat: EYE_W, pos: [s * x, y, z], scale: [r, r, r * 0.7] },
  { geo: SPHERE, mat: EYE_B, pos: [s * x, y, z + r * 0.6], scale: [r * 0.5, r * 0.55, r * 0.4] },
]);
const person = (shirts, hats) => ({
  weight: 6,
  palettes: { shirt: shirts, skin: SKIN, hat: hats },
  parts: [
    { geo: BOX, tint: 'shirt', pos: [0, 0.21, 0], scale: [0.3, 0.4, 0.24] },
    { geo: SPHERE, tint: 'skin', pos: [0, 0.55, 0], scale: [0.12, 0.12, 0.12] },
    { geo: COWBOY_HAT, tint: 'hat', mat: std('#ffffff', { roughness: 0.9, side: THREE.DoubleSide }), pos: [0, 0.6, 0] },
    { geo: SPHERE, tint: 'shirt', pos: [-0.2, 0.42, 0.04], scale: [0.06, 0.18, 0.06], flap: 1 },
    { geo: SPHERE, tint: 'shirt', pos: [0.2, 0.42, 0.04], scale: [0.06, 0.18, 0.06], flap: -1 },
  ],
});

function buildCanyonCrowd() {
  const rock = [std('#9a4a28'), std('#b05a32'), std('#8a3e22')];
  const rows = [0, 1, 2, 3].map((r) => ({ x0: -11, x1: 11, gap: 0.55, y: 1.25 + r * 0.45, z: -5.0 - r * 0.75, skip: 0.15 }));
  return buildCrowd({
    rows,
    seat(group, row, r) {
      mesh(BOX, rock[r % 3], group, [0, row.y / 2, row.z], [25, row.y, 0.75]).castShadow = false;
      for (let i = 0; i < 10; i++) {
        const s = 0.2 + Math.random() * 0.3;
        mesh(new THREE.DodecahedronGeometry(1, 0), rock[(i + r) % 3], group, [-12 + Math.random() * 24, row.y - s * 0.3, row.z + 0.3], [s, s * 0.6, s * 0.6]).castShadow = false;
      }
    },
    kinds: [person(['#a8342a', '#2f6fb3', '#e8d2a0', '#5a7a3a', '#c97a2a', '#efe6d2', '#6a3a7a'], HAT_COLORS)],
  });
}

function buildFarmCrowd() {
  const hay = std('#e0c070'), hayDark = std('#c8a050');
  const rows = [0, 1, 2].map((r) => ({ x0: -11, x1: 11, gap: 0.6, y: 1.4 + r * 0.7, z: -5.4 - r * 0.85, skip: 0.1 }));
  return buildCrowd({
    rows,
    seat(group, row, r) {
      for (let x = -11.5; x <= 11.5; x += 1.28) {
        for (let k = 0; k * 0.7 < row.y - 0.01; k++) mesh(BOX, (k + r) % 2 ? hay : hayDark, group, [x + (k % 2) * 0.3, 0.35 + k * 0.7, row.z], [1.25, 0.7, 0.82]).castShadow = false;
      }
    },
    kinds: [
      Object.assign(person(['#3a6ab0', '#b8322a', '#5a8a3a', '#e8d2a0', '#8a5a3b'], ['#e8c870', '#d8b860', '#f0d890']), { weight: 3 }),
      { weight: 3, hop: 0.12, palettes: { wool: ['#f4f0e8', '#e8e0d0', '#d8d0c0', '#3a3028'] }, parts: [
        { geo: SPHERE, tint: 'wool', pos: [0, 0.22, -0.05], scale: [0.24, 0.2, 0.3] },
        { geo: SPHERE, color: '#2b2420', pos: [0, 0.32, 0.26], scale: [0.09, 0.11, 0.11] },
        { geo: SPHERE, color: '#2b2420', pos: [-0.1, 0.36, 0.22], scale: [0.06, 0.025, 0.04], rot: [0, 0, 0.4] },
        { geo: SPHERE, color: '#2b2420', pos: [0.1, 0.36, 0.22], scale: [0.06, 0.025, 0.04], rot: [0, 0, -0.4] },
        ...eyePair(0.35, 0.34, 0.05, 0.025),
      ] },
      { weight: 2, hop: 0.14, palettes: { pig: ['#f4b6b0', '#e89c94', '#f8cfc8'] }, parts: [
        { geo: SPHERE, tint: 'pig', pos: [0, 0.2, -0.05], scale: [0.24, 0.2, 0.3] },
        { geo: SPHERE, tint: 'pig', pos: [0, 0.3, 0.24], scale: [0.14, 0.13, 0.13] },
        { geo: CYL, color: '#d97f78', pos: [0, 0.28, 0.38], scale: [0.06, 0.04, 0.06], rot: [Math.PI / 2, 0, 0] },
        { geo: SPHERE, tint: 'pig', pos: [-0.09, 0.42, 0.24], scale: [0.06, 0.03, 0.05], rot: [0.5, 0, 0.5] },
        { geo: SPHERE, tint: 'pig', pos: [0.09, 0.42, 0.24], scale: [0.06, 0.03, 0.05], rot: [0.5, 0, -0.5] },
        ...eyePair(0.35, 0.34, 0.06, 0.022),
      ] },
      { weight: 2, hop: 0.2, palettes: { hen: ['#f6f1e6', '#c8642a', '#3a302a', '#e8c070'] }, parts: [
        { geo: SPHERE, tint: 'hen', pos: [0, 0.14, 0], scale: [0.13, 0.13, 0.16] },
        { geo: SPHERE, tint: 'hen', pos: [0, 0.3, 0.08], scale: [0.08, 0.08, 0.08] },
        { geo: SPHERE, color: '#d23a2c', pos: [0, 0.39, 0.08], scale: [0.025, 0.04, 0.05] },
        { geo: new THREE.ConeGeometry(0.025, 0.07, 6), color: '#f2a33a', pos: [0, 0.29, 0.17], rot: [Math.PI / 2, 0, 0] },
        { geo: SPHERE, tint: 'hen', pos: [-0.12, 0.16, 0], scale: [0.03, 0.08, 0.1], flap: 1 },
        { geo: SPHERE, tint: 'hen', pos: [0.12, 0.16, 0], scale: [0.03, 0.08, 0.1], flap: -1 },
      ] },
    ],
  });
}

function buildReefCrowd() {
  const rock = [std('#4a5a68'), std('#3e4a58'), std('#55606e')];
  const rows = [0, 1, 2, 3].map((r) => ({ x0: -11, x1: 11, gap: 0.85, y: 1.6 + r * 0.6, z: -5.8 - r * 0.9, skip: 0.15 }));
  return buildCrowd({
    rows,
    size: 1.5,
    seat(group, row, r) {
      mesh(BOX, rock[r % 3], group, [0, row.y / 2, row.z], [25, row.y, 0.8]).castShadow = false;
      for (let i = 0; i < 12; i++) {
        const s = 0.25 + Math.random() * 0.3;
        mesh(new THREE.DodecahedronGeometry(1, 0), rock[(i + r) % 3], group, [-12 + Math.random() * 24, row.y - s * 0.35, row.z + 0.25], [s, s * 0.6, s * 0.6]).castShadow = false;
      }
    },
    kinds: [
      { weight: 5, motion: 'float', palettes: { fish: ['#ffd25c', '#5cc8ff', '#ff8a5c', '#ff6f91', '#b06cff', '#5cffc8'] }, parts: [
        { geo: SPHERE, tint: 'fish', pos: [0, 0.4, 0], scale: [0.1, 0.17, 0.22] },
        { geo: new THREE.ConeGeometry(0.12, 0.18, 4), tint: 'fish', pos: [0, 0.4, -0.27], rot: [-Math.PI / 2, 0, 0], scale: [0.3, 1, 1] },
        { geo: new THREE.ConeGeometry(0.06, 0.12, 4), tint: 'fish', pos: [0, 0.6, -0.02], scale: [0.3, 1, 1] },
        ...eyePair(0.45, 0.14, 0.07, 0.04),
      ] },
      { weight: 3, hop: 0.16, palettes: { crab: ['#d8402a', '#e8602a', '#c03030', '#f08040'] }, parts: [
        { geo: SPHERE, tint: 'crab', pos: [0, 0.12, 0], scale: [0.22, 0.1, 0.16] },
        { geo: SPHERE, tint: 'crab', pos: [-0.25, 0.2, 0.1], scale: [0.08, 0.06, 0.07], flap: 1 },
        { geo: SPHERE, tint: 'crab', pos: [0.25, 0.2, 0.1], scale: [0.08, 0.06, 0.07], flap: -1 },
        { geo: CYL, tint: 'crab', pos: [-0.06, 0.24, 0.1], scale: [0.012, 0.12, 0.012] },
        { geo: CYL, tint: 'crab', pos: [0.06, 0.24, 0.1], scale: [0.012, 0.12, 0.012] },
        ...eyePair(0.31, 0.1, 0.06, 0.03),
      ] },
      { weight: 2, hop: 0.06, palettes: { shell: ['#4f7a3a', '#6a8a3a', '#3a6a4a'] }, parts: [
        { geo: SPHERE, tint: 'shell', pos: [0, 0.16, -0.04], scale: [0.25, 0.14, 0.26] },
        { geo: SPHERE, color: '#9ab87a', pos: [0, 0.18, 0.26], scale: [0.08, 0.08, 0.1] },
        { geo: SPHERE, color: '#9ab87a', pos: [-0.24, 0.1, 0.1], scale: [0.12, 0.03, 0.06], rot: [0, 0.5, 0], flap: 1 },
        { geo: SPHERE, color: '#9ab87a', pos: [0.24, 0.1, 0.1], scale: [0.12, 0.03, 0.06], rot: [0, -0.5, 0], flap: -1 },
        ...eyePair(0.22, 0.33, 0.05, 0.022),
      ] },
    ],
  });
}

function buildSkyCrowd() {
  const cloud = std('#ffffff', { roughness: 1, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.2 });
  const rows = [0, 1, 2, 3].map((r) => ({ x0: -9.5, x1: 9.5, gap: 0.55, y: 1.2 + r * 0.55, z: -5.4 - r * 0.8, skip: 0.2 }));
  return buildCrowd({
    rows,
    seat(group, row) {
      // Puffy cloud benches.
      for (let x = -10; x <= 10; x += 0.75) {
        mesh(SPHERE, cloud, group, [x, row.y - 0.25, row.z], [0.55, 0.3 + Math.random() * 0.08, 0.45]).castShadow = false;
      }
    },
    kinds: [
      { weight: 1, hop: 0.18, palettes: { bird: ['#4fa8ff', '#ff6f6f', '#ffd25c', '#7ad66c', '#b07dff', '#ff9a3c', '#3a3a48'] }, parts: [
        { geo: SPHERE, tint: 'bird', pos: [0, 0.17, 0], scale: [0.15, 0.17, 0.15] },
        { geo: SPHERE, color: '#f4efe6', pos: [0, 0.14, 0.08], scale: [0.11, 0.12, 0.09] },
        { geo: SPHERE, tint: 'bird', pos: [0, 0.37, 0.03], scale: [0.1, 0.1, 0.1] },
        { geo: new THREE.ConeGeometry(0.03, 0.09, 6), color: '#f2a33a', pos: [0, 0.36, 0.15], rot: [Math.PI / 2, 0, 0] },
        { geo: SPHERE, tint: 'bird', pos: [-0.15, 0.2, -0.02], scale: [0.04, 0.12, 0.11], flap: 1 },
        { geo: SPHERE, tint: 'bird', pos: [0.15, 0.2, -0.02], scale: [0.04, 0.12, 0.11], flap: -1 },
        { geo: SPHERE, tint: 'bird', pos: [0, 0.12, -0.17], scale: [0.06, 0.03, 0.1], rot: [0.4, 0, 0] },
        ...eyePair(0.4, 0.1, 0.045, 0.025),
      ] },
    ],
  });
}

// Rain streaks or rising embers, wrapped inside a box around the arena.
function buildWeather(scene) {
  const BOXW = 28, BOXH = 14, Z0 = -10, Z1 = 9;
  const RN = 1100;
  const rainPos = new Float32Array(RN * 6);
  const drops = [];
  for (let i = 0; i < RN; i++) {
    drops.push({ x: (Math.random() - 0.5) * BOXW, y: Math.random() * BOXH, z: Z0 + Math.random() * (Z1 - Z0), v: 13 + Math.random() * 5 });
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#b4c2dc', transparent: true, opacity: 0.45 }));
  rain.frustumCulled = false;
  scene.add(rain);

  const EN = 280;
  const emberPos = new Float32Array(EN * 3);
  const embers = [];
  for (let i = 0; i < EN; i++) {
    embers.push({ x: (Math.random() - 0.5) * BOXW, y: Math.random() * BOXH, z: Z0 + Math.random() * (Z1 - Z0), v: 0.6 + Math.random() * 1.2, ph: Math.random() * 10 });
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const ember = new THREE.Points(emberGeo, new THREE.PointsMaterial({
    color: '#ff8a3a', size: 0.09, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  ember.frustumCulled = false;
  scene.add(ember);

  // Bubbles reuse the ember particles' positions, drawn bigger, rounder and pale.
  const bubble = new THREE.Points(emberGeo, new THREE.PointsMaterial({
    color: '#dff6ff', size: 0.16, map: glowTexture(), transparent: true, opacity: 0.7, depthWrite: false,
  }));
  bubble.frustumCulled = false;
  scene.add(bubble);

  let mode = null;
  return {
    set(m) {
      mode = m;
      rain.visible = m === 'rain';
      ember.visible = m === 'embers';
      bubble.visible = m === 'bubbles';
    },
    update(t, dt) {
      if (mode === 'rain') {
        for (let i = 0; i < RN; i++) {
          const d = drops[i];
          d.y -= d.v * dt;
          d.x += 2.5 * dt;
          if (d.y < 0) { d.y += BOXH; d.x = (Math.random() - 0.5) * BOXW; }
          if (d.x > BOXW / 2) d.x -= BOXW;
          const o = i * 6;
          rainPos[o] = d.x; rainPos[o + 1] = d.y; rainPos[o + 2] = d.z;
          rainPos[o + 3] = d.x - 0.08; rainPos[o + 4] = d.y + 0.45; rainPos[o + 5] = d.z;
        }
        rainGeo.attributes.position.needsUpdate = true;
      } else if (mode === 'embers' || mode === 'bubbles') {
        for (let i = 0; i < EN; i++) {
          const e = embers[i];
          e.y += e.v * dt;
          if (e.y > BOXH) { e.y = 0; e.x = (Math.random() - 0.5) * BOXW; }
          emberPos[i * 3] = e.x + Math.sin(t * 1.3 + e.ph) * 0.4;
          emberPos[i * 3 + 1] = e.y;
          emberPos[i * 3 + 2] = e.z + Math.cos(t * 1.1 + e.ph) * 0.3;
        }
        emberGeo.attributes.position.needsUpdate = true;
      }
    },
  };
}

function buildGate(scene, wood, darkWood) {
  const hinge = new THREE.Group();
  hinge.position.set(-1.7, 0, 0.9);
  for (let i = 0; i < 4; i++) mesh(BOX, wood, hinge, [1.7, 0.32 + i * 0.36, 0], [3.4, 0.15, 0.06]);
  for (const x of [0.06, 1.7, 3.34]) mesh(BOX, darkWood, hinge, [x, 0.8, 0], [0.12, 1.6, 0.12]);
  const back = new THREE.Group();
  for (let i = 0; i < 4; i++) mesh(BOX, wood, back, [0, 0.32 + i * 0.36, -0.9], [3.4, 0.15, 0.06]);
  for (const x of [-1.66, 0, 1.66]) mesh(BOX, darkWood, back, [x, 0.8, -0.9], [0.12, 1.6, 0.12]);
  const post = mesh(BOX, darkWood, scene, [-1.75, 0.85, 0.9], [0.16, 1.7, 0.16]);
  scene.add(hinge, back);
  return {
    update(open, visible) {
      hinge.visible = back.visible = post.visible = visible;
      hinge.rotation.y = -open * 1.45;
    },
  };
}

// Soft dust puffs, drawn as points that fade and grow.
function buildDust(scene) {
  const MAX = 400;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 3), size = new Float32Array(MAX), alpha = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const tex = canvasTex(64, 64, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 1, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
  });
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, scale: { value: 500 }, color: { value: new THREE.Color('#c7a175') } },
    vertexShader: `attribute float size; attribute float alpha; varying float vA; uniform float scale;
      void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 color; varying float vA;
      void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(color, c.a * vA); }`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  return {
    mat,
    update(list) {
      const n = Math.min(MAX, list.length);
      for (let i = 0; i < n; i++) {
        const p = list[i];
        const k = Math.max(0, p.life / p.max);
        pos[i * 3] = wx(p.x);
        pos[i * 3 + 1] = Math.max(0.02, wy(p.y));
        pos[i * 3 + 2] = p.z || 0;
        size[i] = (p.r / PX) * 2.4 * (1.6 - k * 0.6);
        alpha[i] = k * 0.75;
      }
      geo.setDrawRange(0, n);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
      geo.attributes.alpha.needsUpdate = true;
    },
  };
}

// ---------- Scene ----------
export function createScene(canvas, W, H) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#3a1a32', 16, 40);

  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 120);
  camera.position.set(0, 2, 7);

  const hemi = new THREE.HemisphereLight('#ffe7c4', '#5a3a20', 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
  sun.position.set(3, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 6, bottom: -4, near: 1, far: 30 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#8fa8ff', 0.8);
  rim.position.set(-4, 5, -6);
  scene.add(rim);

  const arena = buildArena(scene);
  const mounts = {
    bull: buildBull(), bronco: buildBronco(), ram: buildRam(), camel: buildCamel(),
    whale: buildWhale(), kraken: buildKraken(), dragon: buildDragon(),
    pig: buildPig(), cow: buildCow(), goat: buildGoat(), chicken: buildChicken(),
  };
  for (const k in mounts) scene.add(mounts[k].root);
  let bull = mounts.bull;
  const rmats = riderMats();
  const rider = buildRider(rmats);
  const looseHat = makeHat(rmats);
  scene.add(looseHat);
  let helmetOn = false;
  // Rider outfit: colors are CSS strings; vest null hides it; hatStyle picks a makeHat style.
  function setRiderLook(look) {
    for (const k of ['shirt', 'jeans', 'skin', 'hat', 'band', 'boot', 'glove', 'hair']) {
      if (look[k]) rmats[k].color.set(look[k]);
    }
    if (look.hair) rmats.brow.color.set(look.hair);
    rider.setHair(look.hatStyle === 'helmet' && look.hairStyle === 'mohawk' ? 'short' : look.hairStyle);
    rider.setBeard(look.beard);
    rider.setPattern(look.pattern);
    rider.bandana.visible = !!look.bandana;
    if (look.bandana) rmats.bandana.color.set(look.bandana);
    rider.vest.visible = !!look.vest;
    if (look.vest) rmats.vest.color.set(look.vest);
    rider.hat.setStyle(look.hatStyle);
    looseHat.setStyle(look.hatStyle);
    helmetOn = look.hatStyle === 'helmet';
  }
  for (const k in mounts) addOutline(mounts[k].root);
  addOutline(rider.root);
  addOutline(looseHat);
  const gate = buildGate(scene, arena.wood, arena.darkWood);
  const dust = buildDust(scene);
  const props = {
    stands: { group: arena.stands },
    towers: { group: arena.towers },
    fair: buildFair(),
    canyon: buildCanyon(),
    storm: buildStorm(scene),
    inferno: buildInferno(scene),
    fences: { group: arena.fences },
    wall: { group: arena.wall },
    reef: buildReef(),
    skyIsles: buildSkyIsles(),
    farm: buildFarm(),
    canyonCrowd: buildCanyonCrowd(),
    farmCrowd: buildFarmCrowd(),
    reefCrowd: buildReefCrowd(),
    skyCrowd: buildSkyCrowd(),
  };
  for (const k of ['fair', 'canyon', 'storm', 'inferno', 'reef', 'skyIsles', 'farm', 'canyonCrowd', 'farmCrowd', 'reefCrowd', 'skyCrowd']) scene.add(props[k].group);
  const weather = buildWeather(scene);
  // Sun or moon hanging in the sky.
  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), fog: false, depthWrite: false, transparent: true }));
  scene.add(orb);

  const skyCache = {};
  const skyTex = (e) => skyCache[e.name] || (skyCache[e.name] = canvasTex(4, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, e.sky[0]);
    g.addColorStop(0.6, e.sky[1]);
    g.addColorStop(1, e.sky[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }));

  let envKey = null;
  function setEnv(key) {
    const e = ENVIRONMENTS[key];
    if (!e) return;
    envKey = key;
    scene.background = skyTex(e);
    scene.fog.color.set(e.fog[0]);
    scene.fog.near = e.fog[1];
    scene.fog.far = e.fog[2];
    hemi.color.set(e.hemi[0]);
    hemi.groundColor.set(e.hemi[1]);
    hemi.intensity = e.hemi[2];
    sun.color.set(e.sun[0]);
    sun.intensity = e.sun[1];
    sun.position.set(...e.sun[2]);
    rim.color.set(e.rim[0]);
    rim.intensity = e.rim[1];
    renderer.toneMappingExposure = e.exposure;
    arena.setEnv(e);
    dust.mat.uniforms.color.value.set(e.dust);
    for (const k in props) props[k].group.visible = e.props.includes(k);
    orb.visible = !!e.orb;
    if (e.orb) {
      orb.material.color.set(e.orb.color);
      orb.position.set(...e.orb.pos);
      orb.scale.set(e.orb.size, e.orb.size, 1);
    }
    weather.set(e.weather);
  }
  setEnv('stadium');

  const camPos = new V3(0, 2.2, 7), camLook = new V3(0, 1.1, 0);
  const tPos = new V3(), tLook = new V3();
  let lastT = 0;
  const tmp = new V3();

  // Fits the seated legs to a mount: searches leg spread and thigh angle for the pose
  // closest to the default whose knees, shins and boots stay outside every body part
  // (each part is treated as the ellipsoid, or box, filling its bounds) with some clearance.
  const splayCache = {};
  function fitSplay(mount) {
    if (rider.root.parent) rider.root.parent.remove(rider.root);
    mount.root.updateMatrixWorld(true);
    const seatInv = mount.seat.matrixWorld.clone().invert();
    const solids = [];
    const ws = new V3();
    mount.root.traverse((o) => {
      if (!o.isMesh || !o.visible || o.material === OUTLINE_MAT || o.material.transparent) return;
      const g = o.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const c = g.boundingBox.getCenter(new V3());
      const h = g.boundingBox.getSize(new V3()).multiplyScalar(0.5);
      o.getWorldScale(ws);
      if (Math.min(h.x * ws.x, h.y * ws.y, h.z * ws.z) < 0.03) return; // spots, fins, decals
      if (g.type === 'TorusGeometry' || g.type === 'TubeGeometry') return; // ropes and horns
      const pad = new V3(0.04 / ws.x, 0.04 / ws.y, 0.04 / ws.z);
      // Seat-relative, so the mount's current buck or tilt doesn't matter.
      const inv = new THREE.Matrix4().multiplyMatrices(seatInv, o.matrixWorld).invert();
      solids.push({ inv, c, r: h.add(pad), box: g === BOX });
    });
    const inside = (pt) => solids.some(({ inv, c, r, box }) => {
      const q = tmp.copy(pt).applyMatrix4(inv).sub(c).divide(r);
      return box ? Math.max(Math.abs(q.x), Math.abs(q.y), Math.abs(q.z)) < 1 : q.lengthSq() < 1;
    });
    const probe = new THREE.Group();
    probe.add(rider.root);
    rider.root.position.set(0, 0, 0);
    const leg = rider.legs.find((l) => l.s > 0);
    const pts = [];
    const sample = (obj, x, y) => pts.push(obj.localToWorld(new V3(x, y, 0)));
    const options = [];
    for (let splay = 0.55; splay <= 1.65; splay += 0.05) {
      for (let fwd = 0.2; fwd <= 1.0; fwd += 0.1) options.push({ splay, fwd, cost: Math.abs(splay - 0.78) + 0.6 * Math.abs(fwd - 0.9) });
    }
    options.sort((a, b) => a.cost - b.cost);
    let best = { splay: 1.4, fwd: 0.6 };
    for (const o of options) {
      rider.setPose('ride', { t: 0, lean: 0, hasHat: true, spurGlow: false, splay: o.splay, fwd: o.fwd });
      probe.updateMatrixWorld(true);
      pts.length = 0;
      sample(leg.root, 0, -0.3);
      sample(leg.root, 0, -0.44);
      sample(leg.mid, 0, -0.22);
      sample(leg.end, 0, 0.1);
      sample(leg.end, 0, -0.04);
      sample(leg.end, 0.17, -0.03);
      sample(leg.end, -0.08, -0.03);
      if (!pts.some(inside)) { best = o; break; }
    }
    probe.remove(rider.root);
    return { splay: best.splay, fwd: best.fwd };
  }


  function setSize(w, h, dpr) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    dust.mat.uniforms.scale.value = (h * dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }

  function render(v) {
    const dt = Math.min(0.1, Math.max(0, v.t - lastT));
    lastT = v.t;

    if (v.env && v.env !== envKey) setEnv(v.env);
    for (const k in props) if (props[k].update) props[k].update(v.t, dt, v.excite);
    weather.update(v.t, dt);

    const kind = mounts[v.bull.kind] ? v.bull.kind : 'bull';
    for (const k in mounts) mounts[k].root.visible = k === kind;
    bull = mounts[kind];
    bull.update(v.bull);
    gate.update(v.gate || 0, v.gate != null);
    arena.updateCrowd(v.t, v.excite);
    dust.update(v.particles);

    // Rider
    // A helmet stays strapped on when the rider is bucked.
    const p = { t: v.t, lean: v.lean || 0, hasHat: v.hasHat || helmetOn, spurGlow: v.spurGlow, phase: 0, safe: false };
    rider.root.visible = v.riderMode !== 'none';
    if (v.riderMode === 'ride') {
      const fitKey = (v.bull.kind || 'bull') + ':' + ((v.bull.look && v.bull.look.bulk) || 1).toFixed(2);
      if (!(fitKey in splayCache)) splayCache[fitKey] = fitSplay(bull);
      p.fit = splayCache[fitKey];
      if (rider.root.parent !== bull.seat) bull.seat.add(rider.root);
      rider.root.position.set(p.lean * 0.08, 0, 0);
      rider.setPose('ride', p);
    } else {
      if (rider.root.parent !== scene) scene.add(rider.root);
      if (v.riderMode === 'fly' && v.flyer.jump) {
        p.vy = v.flyer.vy;
        rider.setPose('jump', p);
        rider.root.position.set(wx(v.flyer.x), wy(v.flyer.y), v.flyer.z);
        rider.root.rotation.y = v.flyer.vx < 0 ? Math.PI : 0;
      } else if (v.riderMode === 'fly') {
        rider.root.position.set(wx(v.flyer.x), wy(v.flyer.y), v.flyer.z || 0);
        p.flail = v.flyer.flail;
        rider.setPose('fly', p);
        rider.root.rotation.z = -v.flyer.rot;
      } else if (v.riderMode === 'run') {
        const r = v.runner;
        if (r.down > 0) {
          rider.setPose('down', p);
          rider.root.position.set(wx(r.x), 0.16, r.z != null ? r.z : 0.3);
        } else {
          p.phase = r.phase;
          p.safe = r.safe;
          p.crouch = r.land > 0 ? r.land / 0.3 : 0;
          rider.setPose('stand', p);
          rider.root.position.set(wx(r.x), 0.9 - p.crouch * 0.25 + r.climb * 1.04, r.safe ? 0.15 : r.z != null ? r.z : 0.3);
          rider.root.rotation.y = r.face < 0 ? Math.PI : 0;
          if (r.safe) rider.root.rotation.y = r.face < 0 ? -Math.PI / 2 : Math.PI / 2;
          // Plant the boots on the dirt; once climbing, just keep them out of it.
          if (!r.climb) rider.root.position.y -= lowestY(rider.root);
        }
      }
      if (rider.root.visible) keepAboveGround(rider.root);
    }
    // Lift the mount (and its rider) if a buck or landing pushes a hoof or belly into the ground.
    keepAboveGround(bull.root);
    looseHat.visible = !!v.hat && !helmetOn;
    if (v.hat) {
      looseHat.position.set(wx(v.hat.x), Math.max(0.03, wy(v.hat.y)), 0.2);
      looseHat.rotation.set(0, 0, -v.hat.rot);
    }

    // Camera
    const bxw = wx(v.bull.x);
    // Pull the camera up and back for taller mounts.
    const lift = bull.lift || 0;
    const m = v.mode;
    if (m === 'title') {
      const a = v.t * 0.22;
      tPos.set(Math.sin(a) * 6.2, 2.0, Math.cos(a) * 6.2);
      tLook.set(0, 1.0, 0);
    } else if (m === 'select' || m === 'world') {
      tPos.set(2.2 + lift, 1.6 + lift, 5.4 + lift * 3);
      tLook.set(0, 0.95 + lift, 0);
    } else if (m === 'rider') {
      // Close on the rider, framed right of center to leave room for the outfit panel.
      bull.seat.getWorldPosition(tmp);
      tPos.set(tmp.x + 1.4, tmp.y + 0.7, 4.3 + lift);
      tLook.set(tmp.x - 1.0, tmp.y + 0.35, 0);
    } else if (m === 'chute') {
      tPos.set(1.0, 2.3 + lift, 5.6 + lift * 2);
      tLook.set(0, 1.25 + lift, 0);
    } else if (m === 'ride' || m === 'dismount') {
      tPos.set(bxw * 0.4 + 0.6, 2.1 + lift, 6.1 + lift * 2);
      tLook.set(bxw * 0.6, 1.3 + lift * 0.8, 0);
    } else {
      tPos.set(0, 2.8, 9.0);
      tLook.set(0, 1.0, 0);
    }
    const k = m === 'title' ? 1 : 1 - Math.exp(-dt * 3);
    camPos.lerp(tPos, k);
    camLook.lerp(tLook, k);
    camera.position.copy(camPos);
    if (v.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * v.shake;
      camera.position.y += (Math.random() - 0.5) * v.shake;
    }
    camera.lookAt(camLook);

    renderer.render(scene, camera);
  }

  function project(x, y, z) {
    tmp.set(x, y, z || 0).project(camera);
    return { x: ((tmp.x + 1) / 2) * W, y: ((1 - tmp.y) / 2) * H };
  }

  // Seat position (rider's hips) in game coordinates and on screen.
  function seatGame() {
    bull.seat.getWorldPosition(tmp);
    return { x: tmp.x * PX + CENTER_X, y: GROUND_Y - tmp.y * PX };
  }
  function seatScreen() {
    bull.seat.getWorldPosition(tmp);
    return project(tmp.x, tmp.y, tmp.z);
  }

  return { render, setSize, project, seatGame, seatScreen, setRiderLook };
}
