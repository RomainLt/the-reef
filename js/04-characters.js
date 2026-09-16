/* The Reef — Fish bodies and the bestiary
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* PERSONNAGES                                                        */
/* ================================================================== */

// Clownfish livery: 3 white bands edged in black + one at the tail
var CLOWN_HOOK = [
  '  float z = vObj.z + 0.13*vObj.y;',
  '  float wA = bandMask(z, 0.575, 0.105) + bandMask(z, 0.015, 0.125) + bandMask(z, -0.655, 0.080) + bandMask(z, -1.07, 0.075);',
  '  float kA = bandMask(z, 0.575, 0.158) + bandMask(z, 0.015, 0.182) + bandMask(z, -0.655, 0.125) + bandMask(z, -1.07, 0.122);',
  '  wA = clamp(wA, 0.0, 1.0); kA = clamp(kA, 0.0, 1.0);',
  '  base *= mix(1.10, 0.94, smoothstep(-0.45, 0.35, vObj.y));',
  '  base = mix(base, vec3(0.07,0.09,0.14), clamp(kA - wA, 0.0, 1.0)*0.95);',
  '  base = mix(base, vec3(1.0,0.985,0.95), wA*0.97);'
].join('\n');

/** The hero: a small clownfish, snout towards +Z. */
function buildClownfish() {
  var g = new THREE.Group();

  // --- body + median fins, all merged into body space
  var parts = [{ geo: fishBodyGeo(0.335, 0.495, { belly: 0.20, arch: 0.05, head: 0.30, seg: 26, seg2: 18 }), matrix: null }];

  var fins = [];
  var tail = finGeo([[0, 0.12], [0.18, 0.26], [0.34, 0.34], [0.46, 0.33], [0.52, 0.20],
                     [0.53, 0.0], [0.52, -0.20], [0.46, -0.33], [0.34, -0.34],
                     [0.18, -0.26], [0, -0.12]], 0.030);
  finEdge(tail, 0.30, 0.50, 1.10, 0.34);
  tail.rotateY(Math.PI / 2);                       // the profile runs towards -Z
  fins.push({ geo: tail, matrix: TRS(0, 0.02, -0.94) });

  var dorsal = finGeo([[0, 0], [0.18, 0.24], [0.50, 0.38], [0.84, 0.32], [1.04, 0.04], [0.55, 0.01]], 0.028);
  finEdge(dorsal, 0.22, 0.44, 1.05, 0.34);
  dorsal.rotateY(Math.PI / 2);                      // stands up on the back
  fins.push({ geo: dorsal, matrix: TRS(0, 0.40, 0.30) });

  var anal = finGeo([[0, 0], [0.15, 0.20], [0.38, 0.26], [0.54, 0.03], [0.30, 0.0]], 0.026);
  finEdge(anal, 0.18, 0.34, 1.05, 0.36);
  anal.rotateY(Math.PI / 2);
  anal.rotateZ(Math.PI);                            // and this one hangs under the belly
  fins.push({ geo: anal, matrix: TRS(0, -0.38, -0.34) });

  var bodyMat = {
    color: 0xf4661f, baseHook: CLOWN_HOOK, mode: 1, fishLen: 1.0,
    swayAmp: 0.085, swayFreq: 2.7, swaySpeed: 7.0,
    rim: 0.40, spec: 0.30, soft: 0.045, outline: 3.4
  };
  var body = toonMesh(mergeGeos(parts), bodyMat);
  g.add(body);

  // the fins share the body's animation uniforms -> the same ripple
  var finMesh = toonMesh(mergeGeos(fins), {
    color: 0xf4661f, baseHook: CLOWN_HOOK, mode: 1, fishLen: 1.0,
    rim: 0.5, spec: 0.2, sss: 0.85, opacity: 0.9, transparent: true,
    side: THREE.DoubleSide, uniforms: body.userData.anim
  });
  finMesh.renderOrder = 2;
  g.add(finMesh);

  // --- pectoral fins (flapped in JS), including the "lucky fin"
  var pectShape = finGeo([[0, 0], [0.16, 0.16], [0.32, 0.17], [0.42, 0.08],
                          [0.40, -0.06], [0.26, -0.15], [0.06, -0.11]], 0.020);
  (function cup(g) {                              // the fin is bowed
    var pp = g.attributes.position;
    for (var i = 0; i < pp.count; i++) {
      var x = pp.getX(i), y = pp.getY(i);
      pp.setZ(i, pp.getZ(i) + Math.sin(clamp(x / 0.42, 0, 1) * Math.PI) * 0.055 - y * 0.06);
    }
    g.computeVertexNormals();
  })(pectShape);
  finEdge(pectShape, 0.20, 0.40, 1.10, 0.34);
  var pectOpt = {
    color: 0xf9853a, rim: 0.45, spec: 0.15, sss: 0.9,
    opacity: 0.86, transparent: true, side: THREE.DoubleSide
  };
  var pl = toonMesh(pectShape, pectOpt);
  pl.position.set(0.255, 0.0, 0.30); pl.rotation.set(0, -0.5, 0.2);
  var pr = toonMesh(pectShape, pectOpt);
  pr.position.set(-0.255, 0.0, 0.30); pr.rotation.set(0, Math.PI + 0.5, -0.2);
  pr.scale.setScalar(0.72);                      // the small fin
  g.add(pl); g.add(pr);

  // --- cartoon eyes (big and glossy)
  var eyes = new THREE.Group();
  for (var s = -1; s <= 1; s += 2) {
    var sclera = toonMesh(new THREE.SphereGeometry(0.152, 14, 10),
      { color: 0xfffaf4, rim: 0.20, spec: 0.35 });
    sclera.position.set(0.148 * s, 0.150, 0.495);
    var iris = toonMesh(new THREE.SphereGeometry(0.114, 12, 9),
      { color: 0x8ecfe6, rim: 0.15, spec: 0.4 });
    iris.position.set(0.188 * s, 0.150, 0.545);
    var pupil = toonMesh(new THREE.SphereGeometry(0.086, 12, 9),
      { color: 0x0a1520, rim: 0.05, spec: 1.4 });
    pupil.position.set(0.212 * s, 0.150, 0.575);
    var glint = new THREE.Mesh(new THREE.SphereGeometry(0.030, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(0.228 * s, 0.196, 0.610);
    var glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint2.position.set(0.222 * s, 0.108, 0.618);
    eyes.add(sclera); eyes.add(iris); eyes.add(pupil); eyes.add(glint); eyes.add(glint2);
  }
  g.add(eyes);

  g.userData.body = body;
  g.userData.pect = [pl, pr];
  g.userData.bend = body.userData.anim.uBend;
  g.userData.swaySpeed = body.userData.anim.uSwaySpeed;
  return g;
}

/** School fish: body and tail merged, eye painted by the shader. */
function buildSmallFish(opt) {
  var parts = [{ geo: fishBodyGeo(opt.w || 0.30, opt.h || 0.55, { belly: 0.1, seg: 14, seg2: 10 }), matrix: null }];
  var tail = finGeo([[0, 0.09], [0.34, 0.34], [0.46, 0.30], [0.30, 0.04],
                     [0.46, -0.30], [0.34, -0.34], [0, -0.09]], 0.04);
  tail.rotateY(Math.PI / 2);
  parts.push({ geo: tail, matrix: TRS(0, 0, -0.95) });
  var dors = finGeo([[0, 0], [0.32, 0.34], [0.75, 0.03]], 0.035);
  dors.rotateY(Math.PI / 2);
  parts.push({ geo: dors, matrix: TRS(0, 0.46, 0.10) });

  var hook = [
    '  base = mix(base, uColorB, smoothstep(-0.1, 0.45, vObj.y));',
    opt.stripes ? '  base = mix(base, vec3(0.08,0.10,0.14), bandMask(vObj.z + vObj.y*0.2, 0.30, 0.10)*0.85 + bandMask(vObj.z + vObj.y*0.2, -0.25, 0.09)*0.85);' : '',
    '  float ey = discMask(vec2(vObj.z, vObj.y), vec2(0.60, 0.13), 0.105);',
    '  ey *= smoothstep(0.10, 0.20, abs(vObj.x));',
    '  base = mix(base, vec3(0.98), ey);',
    '  base = mix(base, vec3(0.05,0.06,0.09), discMask(vec2(vObj.z, vObj.y), vec2(0.635, 0.13), 0.058)*step(0.10, abs(vObj.x)));'
  ].join('\n');

  return toonMesh(mergeGeos(parts), {
    color: opt.color, colorB: opt.colorB !== undefined ? opt.colorB : opt.color,
    baseHook: hook, mode: 1, fishLen: 1.0,
    swayAmp: 0.11, swayFreq: 2.9, swaySpeed: opt.swaySpeed || 8.5,
    rim: 0.45, spec: 0.25, soft: 0.05, outline: 2.2
  });
}

/** Translucent jellyfish (the hazard of the reef). */
function buildJellyfish() {
  var g = new THREE.Group();
  var bell = new THREE.SphereGeometry(1, 18, 12, 0, TAU, 0, Math.PI * 0.58);
  bell.scale(1, 0.82, 1);
  var bellMesh = toonMesh(bell, {
    color: 0xd6a8ff, colorB: 0xfff0ff,
    baseHook: '  base = mix(base, uColorB, smoothstep(0.2, 0.95, vObj.y));\n  base *= 0.9 + 0.35*bandMask(length(vObj.xz), 0.72, 0.16);',
    opacity: 0.55, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    rim: 1.25, emissive: 0.30, soft: 0.10, outline: false
  });
  g.add(bellMesh);
  var rim = toonMesh(new THREE.TorusGeometry(0.995, 0.055, 6, 20), {
    color: 0xffd9ff, rim: 0.9, emissive: 0.5, soft: 0.2, outline: false
  });
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  var tent = [];
  for (var i = 0; i < 7; i++) {
    var a = i / 7 * TAU, len = 1.5 + (i % 3) * 0.5;
    var rib = new THREE.PlaneGeometry(0.12, len, 1, 5);
    tent.push({ geo: rib, matrix: TRS(Math.cos(a) * 0.62, len * 0.5, Math.sin(a) * 0.62, 0, a, 0) });
  }
  var tents = toonMesh(mergeGeos(tent), {
    color: 0xe9c2ff, opacity: 0.45, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, rim: 0.9, emissive: 0.25, soft: 0.2, outline: false,
    mode: 2, swayAmp: 0.36, swayFreq: 1.7, swaySpeed: 1.6
  });
  tents.rotation.x = Math.PI;                     // the tentacles hang down
  g.add(tents);
  g.userData.bell = bellMesh;
  return g;
}

/** Sea turtle, a silhouette drifting past in the distance. */
function buildTurtle() {
  var g = new THREE.Group();
  var shell = new THREE.SphereGeometry(1, 18, 12);
  noisify(shell, 0.06, 3.5, 11);
  shell.scale(1.0, 0.46, 1.25);
  var sh = toonMesh(shell, {
    color: 0x5f7f4a, colorB: 0x8fae5c,
    baseHook: '  float cell = fbm(vec2(vObj.x, vObj.z)*3.4);\n  base = mix(base, uColorB, smoothstep(0.42, 0.62, cell));\n  base *= 0.86 + 0.3*smoothstep(0.15, 0.5, vObj.y);',
    rim: 0.4, spec: 0.35, soft: 0.05, outline: 3.0
  });
  g.add(sh);
  var belly = toonMesh(new THREE.SphereGeometry(0.92, 14, 8, 0, TAU, Math.PI * 0.55, Math.PI * 0.45),
    { color: 0xe8dda6, rim: 0.3, soft: 0.08, outline: false });
  belly.scale.set(1.0, 0.4, 1.22);
  g.add(belly);
  var head = toonMesh(new THREE.SphereGeometry(0.34, 12, 9), { color: 0x6f8f55, rim: 0.4, spec: 0.3, outline: 2.6 });
  head.position.set(0, 0.06, 1.30); head.scale.set(0.85, 0.85, 1.25);
  g.add(head);
  var flipShape = finGeo([[0, 0], [0.85, 0.34], [1.5, 0.22], [1.35, -0.14], [0.6, -0.28]], 0.09);
  var fl = [];
  for (var i = 0; i < 4; i++) {
    var side = i % 2 === 0 ? 1 : -1, front = i < 2 ? 1 : -1;
    var f = toonMesh(flipShape, { color: 0x6a8a52, rim: 0.4, soft: 0.06, outline: 2.6 });
    f.position.set(0.75 * side, -0.02, front > 0 ? 0.55 : -0.62);
    f.rotation.y = side > 0 ? 0 : Math.PI;
    f.rotation.z = side > 0 ? 0.1 : -0.1;
    if (front < 0) f.scale.setScalar(0.6);
    g.add(f); fl.push(f);
  }
  g.userData.flippers = fl;
  return g;
}


/* ================================================================== */
/* THE BESTIARY                                                       */
/* ================================================================== */

/** A pair of cartoon eyes (sclera + pupil + glint), mirrored on X. */
function addEyes(parent, x, y, z, r, opt) {
  opt = opt || {};
  for (var s = -1; s <= 1; s += 2) {
    var e = toonMesh(new THREE.SphereGeometry(r, 10, 8),
      { color: opt.white !== undefined ? opt.white : 0xfffaf4, rim: 0.2, spec: 0.4 });
    e.position.set(x * s, y, z);
    parent.add(e);
    if (opt.iris) {
      var ir = toonMesh(new THREE.SphereGeometry(r * 0.72, 9, 7), { color: opt.iris, rim: 0.15, spec: 0.4 });
      ir.position.set(x * s * 1.14, y, z + r * 0.36);
      parent.add(ir);
    }
    var p = toonMesh(new THREE.SphereGeometry(r * (opt.pupilR || 0.56), 9, 7),
      { color: opt.pupil !== undefined ? opt.pupil : 0x0a1520, rim: 0.05, spec: 1.3 });
    p.position.set(x * s * 1.26, y, z + r * 0.52);
    parent.add(p);
    var gl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.20, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    gl.position.set(x * s * 1.32, y + r * 0.34, z + r * 0.62);
    parent.add(gl);
  }
}

/** A simple triangular fin, oriented by a matrix. */
function finPart(pts, thick, mtx, tint) {
  var g = finGeo(pts, thick);
  if (tint) finEdge(g, tint[0], tint[1], tint[2], tint[3]);
  return { geo: g, matrix: mtx };
}

/* ---------- THE SHARK ---------- */
var SHARK_HOOK = [
  '  base = mix(base, uColorB, smoothstep(-0.02, -0.30, vObj.y));',           // ventre blanc
  '  float side = step(0.13, abs(vObj.x));',
  '  float gill = bandMask(vObj.z, 0.34, 0.022) + bandMask(vObj.z, 0.42, 0.022) + bandMask(vObj.z, 0.50, 0.022);',
  '  base = mix(base, base*0.55, clamp(gill,0.0,1.0)*side*0.8);',
  '  float mouth = discMask(vec2(vObj.z, vObj.y), vec2(0.66, -0.20), 0.20);',
  '  base = mix(base, vec3(0.05,0.04,0.06), mouth*0.92);',
  '  base = mix(base, vec3(0.96,0.96,0.92), bandMask(vObj.y, -0.135, 0.022)*smoothstep(0.48,0.60,vObj.z)*0.9);'
].join('\n');

function buildShark(len) {
  var g = new THREE.Group();
  var parts = [{ geo: fishBodyGeo(0.30, 0.34, { belly: 0.06, arch: 0.0, head: -0.1, seg: 22, seg2: 15 }) }];
  // dorsale haute
  var d1 = finGeo([[0, 0], [0.10, 0.34], [0.34, 0.40], [0.46, 0.02], [0.10, 0.0]], 0.045);
  d1.rotateY(Math.PI / 2);
  parts.push({ geo: d1, matrix: TRS(0, 0.22, 0.06) });
  var d2 = finGeo([[0, 0], [0.08, 0.12], [0.20, 0.01]], 0.03);
  d2.rotateY(Math.PI / 2);
  parts.push({ geo: d2, matrix: TRS(0, 0.17, -0.62) });
  // crescent tail
  var t1 = finGeo([[0, 0.04], [0.16, 0.30], [0.40, 0.62], [0.30, 0.16], [0.34, -0.02],
                   [0.30, -0.34], [0.14, -0.20], [0, -0.04]], 0.035);
  t1.rotateY(Math.PI / 2);
  parts.push({ geo: t1, matrix: TRS(0, 0, -0.96) });
  // pectorales larges
  var pc = finGeo([[0, 0], [0.40, -0.04], [0.70, -0.34], [0.44, -0.20], [0.08, -0.08]], 0.035);
  parts.push({ geo: pc, matrix: TRS(0.17, -0.08, 0.30, 0.30, 0, 0) });
  var pc2 = pc.clone(); pc2.scale(-1, 1, 1);
  parts.push({ geo: pc2, matrix: TRS(-0.17, -0.08, 0.30, 0.30, 0, 0) });
  // pelviennes
  var pv = finGeo([[0, 0], [0.14, -0.10], [0.20, -0.02]], 0.025);
  parts.push({ geo: pv, matrix: TRS(0.09, -0.16, -0.42, 0.5, 0, 0) });
  var pv2 = pv.clone(); pv2.scale(-1, 1, 1);
  parts.push({ geo: pv2, matrix: TRS(-0.09, -0.16, -0.42, 0.5, 0, 0) });

  var body = toonMesh(mergeGeos(parts), {
    color: 0x6f7f8c, colorB: 0xe8e6dd, baseHook: SHARK_HOOK,
    mode: 1, fishLen: 1.0, taper: 1.3, swayAmp: 0.10, swayFreq: 2.2, swaySpeed: 2.4,
    spec: 0.28, rim: 0.30, bump: 0.10, sss: 0.22
  });
  g.add(body);
  addEyes(g, 0.155, 0.075, 0.58, 0.055, { white: 0x2a3038, pupil: 0x05070a, pupilR: 0.7 });
  // dents
  for (var i = 0; i < 7; i++) {
    var tx = -0.12 + i * 0.04;
    var tooth = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 4),
      new THREE.MeshBasicMaterial({ color: 0xfffaf0 }));
    tooth.position.set(tx, -0.115, 0.70 - Math.abs(tx) * 0.5);
    tooth.rotation.x = Math.PI;
    g.add(tooth);
  }
  g.scale.setScalar(len || 5.5);
  g.userData.body = body;
  return g;
}

function buildHammerhead(len) {
  var g = buildShark(len);
  // hammer: a flattened bar across the snout
  var head = toonMesh(new THREE.SphereGeometry(0.5, 14, 9), { color: 0x7c8b96, spec: 0.25, rim: 0.3 });
  head.scale.set(0.62, 0.16, 0.20);
  head.position.set(0, 0.02, 0.66);
  g.add(head);
  addEyes(g, 0.30, 0.02, 0.66, 0.05, { white: 0x2a3038, pupil: 0x05070a, pupilR: 0.75 });
  return g;
}

/* ---------- THE RAY ---------- */
function buildRay(span) {
  var g = new THREE.Group();
  // wing: a flattened disc, stretched, with thin edges
  var w = new THREE.SphereGeometry(1, 26, 14);
  var p = w.attributes.position, v = new THREE.Vector3();
  for (var i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    var ax = Math.abs(v.x), taper = Math.pow(1 - ax * 0.94, 0.55);
    p.setXYZ(i, v.x * 1.95, v.y * 0.105 * taper, v.z * (0.66 - ax * 0.34) - ax * 0.60);
  }
  w.computeVertexNormals();
  ensureAttrs(w);
  var body = toonMesh(w, {
    color: 0x35566b, colorB: 0xf2f0e6,
    baseHook: [
      '  base = mix(base, uColorB, smoothstep(0.0, -0.04, vObj.y));',
      '  float sp = smoothstep(0.58, 0.665, fbm(vObj.xz*10.0));',
      '  base = mix(base, vec3(0.95,0.97,0.98), sp*step(0.0, vObj.y)*0.9);'
    ].join('\n'),
    mode: 3, fishLen: 1.95, swayAmp: 0.42, swayFreq: 1.6, swaySpeed: 1.4,
    spec: 0.22, rim: 0.35, bump: 0.08, sss: 0.55
  });
  g.add(body);
  // queue
  var tail = new THREE.CylinderGeometry(0.02, 0.07, 1.5, 6, 4, true);
  tail.translate(0, 0.75, 0);
  swayByHeight(tail, 0, 1.5, 1.3);
  var tm = toonMesh(tail, { color: 0x3f4d5e, mode: 2, swayAmp: 0.22, swaySpeed: 1.6, rim: 0.3 });
  tm.rotation.x = -Math.PI / 2 + 0.14;   // the tail trails behind
  tm.position.set(0, 0.02, -0.55);
  g.add(tm);
  // cephalic horns
  for (var s2 = -1; s2 <= 1; s2 += 2) {
    var horn = toonMesh(new THREE.ConeGeometry(0.055, 0.26, 6), { color: 0x465666, rim: 0.3 });
    horn.position.set(0.14 * s2, 0.0, 0.46);
    horn.rotation.x = 1.55;                // the horns point forward
    g.add(horn);
  }
  addEyes(g, 0.19, 0.02, 0.30, 0.05, { white: 0xf2ede0, pupil: 0x0a1018 });
  g.scale.setScalar(span || 3.2);
  g.userData.body = body;
  return g;
}

/* ---------- POISSONS PERSONNAGES ---------- */
/** Disc-bodied fish (tang, moorish idol, butterflyfish…). */
function buildDiscFish(opt) {
  var g = new THREE.Group();
  var parts = [{ geo: fishBodyGeo(opt.w || 0.22, opt.h || 0.78, { belly: 0.05, head: opt.head || 0.15, seg: 20, seg2: 14 }) }];
  var tail = finGeo(opt.tail || [[0, 0.10], [0.28, 0.26], [0.40, 0.22], [0.26, 0.02],
                                 [0.40, -0.22], [0.28, -0.26], [0, -0.10]], 0.028);
  finEdge(tail, 0.26, 0.46, 1.05, opt.tailEdge !== undefined ? opt.tailEdge : 0.4);
  tail.rotateY(Math.PI / 2);
  parts.push({ geo: tail, matrix: TRS(0, 0, -0.94) });
  var dors = finGeo(opt.dorsal || [[0, 0], [0.28, 0.34], [0.72, 0.40], [1.10, 0.05], [0.5, 0.0]], 0.024);
  finEdge(dors, 0.2, 0.42, 1.05, 0.45);
  dors.rotateY(Math.PI / 2);
  parts.push({ geo: dors, matrix: TRS(0, 0.58, 0.20) });
  var anal = finGeo([[0, 0], [0.26, 0.22], [0.62, 0.02], [0.3, 0.0]], 0.022);
  finEdge(anal, 0.18, 0.36, 1.05, 0.45);
  anal.rotateY(Math.PI / 2); anal.rotateZ(Math.PI);
  parts.push({ geo: anal, matrix: TRS(0, -0.52, -0.10) });

  var body = toonMesh(mergeGeos(parts), {
    color: opt.color, colorB: opt.colorB !== undefined ? opt.colorB : opt.color,
    baseHook: opt.hook, mode: 1, fishLen: 1.0, taper: 1.7,
    swayAmp: 0.085, swayFreq: 2.7, swaySpeed: opt.speed || 6.5,
    spec: 0.3, rim: 0.4, sss: 0.2
  });
  g.add(body);
  // beating pectorals
  var pect = finGeo([[0, 0], [0.14, 0.13], [0.28, 0.12], [0.34, 0.0], [0.20, -0.11], [0.05, -0.09]], 0.016);
  finEdge(pect, 0.16, 0.34, 1.1, 0.35);
  var pl = toonMesh(pect, { color: opt.finColor !== undefined ? opt.finColor : opt.color, opacity: 0.85, transparent: true, side: THREE.DoubleSide, rim: 0.5, sss: 0.9 });
  pl.position.set(0.145, -0.02, 0.24); pl.rotation.set(0, -0.5, 0.15);
  var pr = toonMesh(pect, { color: opt.finColor !== undefined ? opt.finColor : opt.color, opacity: 0.85, transparent: true, side: THREE.DoubleSide, rim: 0.5, sss: 0.9 });
  pr.position.set(-0.145, -0.02, 0.24); pr.rotation.set(0, Math.PI + 0.5, -0.15);
  g.add(pl); g.add(pr);
  addEyes(g, opt.eyeX || 0.115, opt.eyeY || 0.16, opt.eyeZ || 0.52, opt.eyeR || 0.10,
          { iris: opt.iris, pupil: 0x0a1018 });
  g.userData.body = body;
  g.userData.pect = [pl, pr];
  g.scale.setScalar(opt.scale || 1);
  return g;
}

/** Blue tang (the chatty companion). */
function buildBlueTang(scale) {
  return buildDiscFish({
    color: 0x2f6fd8, colorB: 0x7fc0ff, finColor: 0xffd23f, iris: 0x9fd8e8,
    w: 0.20, h: 0.80, scale: scale || 1.1, speed: 6.0,
    eyeX: 0.078, eyeY: 0.20, eyeZ: 0.50, eyeR: 0.088,
    hook: [
      '  base = mix(base, uColorB, smoothstep(-0.2, 0.6, vObj.y)*0.5);',
      // the "palette": a dark oval towards the rear, edged in pale blue
      '  float pd = length(vec2((vObj.z + 0.30)*1.15, (vObj.y - 0.02)*1.7));',
      '  base = mix(base, vec3(0.05,0.07,0.13), (1.0 - smoothstep(0.30, 0.44, pd))*0.88);',
      '  base = mix(base, vec3(1.0,0.82,0.20), smoothstep(-0.70, -0.92, vObj.z));', // queue jaune
      '  base = mix(base, vec3(0.98,0.98,0.95), bandMask(vObj.z, -0.78, 0.045)*0.55);'
    ].join('\n')
  });
}

/** Moorish idol (black / white / yellow stripes). */
function buildMoorishIdol(scale) {
  return buildDiscFish({
    color: 0xf7f3e4, colorB: 0xffffff, finColor: 0xffd23f, iris: 0xbfe0ee,
    w: 0.17, h: 0.88, scale: scale || 1.0, speed: 5.6, head: 0.25,
    eyeX: 0.072, eyeY: 0.20, eyeZ: 0.50, eyeR: 0.082,
    dorsal: [[0, 0], [0.24, 0.42], [0.55, 0.55], [0.9, 0.30], [1.15, 0.02], [0.5, 0.0]],
    hook: [
      '  float z = vObj.z + vObj.y*0.10;',
      '  float b1 = bandMask(z, 0.30, 0.17), b2 = bandMask(z, -0.42, 0.20);',
      '  base = mix(base, vec3(0.08,0.09,0.13), clamp(b1+b2, 0.0, 1.0)*0.92);',
      '  base = mix(base, vec3(1.0,0.80,0.18), smoothstep(-0.78, -0.98, z));',
      '  base = mix(base, vec3(1.0,0.78,0.16), smoothstep(0.30, 0.62, vObj.y)*0.55);'
    ].join('\n')
  });
}

/** Pufferfish: puffs up when you come close. */
function buildPufferfish(scale) {
  var g = new THREE.Group();
  var b = new THREE.SphereGeometry(0.62, 20, 15);
  var p = b.attributes.position, v = new THREE.Vector3();
  for (var i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    var t = (v.z / 0.62 + 1) * 0.5;
    p.setXYZ(i, v.x * (0.86 + t * 0.2), v.y * (0.9 + t * 0.18), v.z * 1.15);
  }
  b.computeVertexNormals();
  var body = toonMesh(b, {
    color: 0xe0a24a, colorB: 0xfff0cf,
    baseHook: [
      '  base = mix(base, uColorB, smoothstep(-0.1, -0.45, vObj.y));',
      '  base = mix(base, base*0.42, step(0.62, fbm(vObj.xz*7.0 + vObj.y*3.0))*0.8);'
    ].join('\n'),
    spec: 0.3, rim: 0.35, bump: 0.25
  });
  g.add(body);
  var spikes = new THREE.Group();
  for (var k = 0; k < 46; k++) {
    var a = rnd() * TAU, e = Math.acos(1 - 2 * rnd());
    var d = new THREE.Vector3(Math.sin(e) * Math.cos(a), Math.cos(e), Math.sin(e) * Math.sin(a));
    if (d.z > 0.6) continue;
    var sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 4),
      new THREE.MeshBasicMaterial({ color: 0x8a5a2a }));
    sp.position.copy(d).multiplyScalar(0.6);
    sp.quaternion.setFromUnitVectors(YAXIS, d);
    spikes.add(sp);
  }
  g.add(spikes);
  var tailF = finGeo([[0, 0.06], [0.2, 0.16], [0.26, 0.0], [0.2, -0.16], [0, -0.06]], 0.02);
  tailF.rotateY(Math.PI / 2);
  var tm = toonMesh(tailF, { color: 0xe8b567, opacity: 0.9, transparent: true, side: THREE.DoubleSide, rim: 0.4, sss: 0.8 });
  tm.position.set(0, 0, -0.7);
  g.add(tm);
  addEyes(g, 0.24, 0.16, 0.50, 0.115, { iris: 0xffe08a, pupil: 0x0a1018 });
  g.userData.spikes = spikes;
  g.userData.body = body;
  g.scale.setScalar(scale || 1);
  return g;
}

/** Hippocampe. */
function buildSeahorse(scale) {
  var g = new THREE.Group();
  var pts = [];
  for (var i = 0; i <= 6; i++) {
    var t = i / 6;
    pts.push(new THREE.Vector3(0, t * 1.5 - 0.2, Math.sin(t * 2.4) * 0.28 - 0.1));
  }
  var curve = new THREE.CatmullRomCurve3(pts);
  var bodyG = new THREE.TubeGeometry(curve, 16, 0.13, 8, false);
  var pb = bodyG.attributes.position, vb = new THREE.Vector3();
  for (var j = 0; j < pb.count; j++) {                 // taper the tail
    vb.fromBufferAttribute(pb, j);
    var k = clamp((vb.y + 0.2) / 1.5, 0, 1);
    pb.setXYZ(j, vb.x * (0.5 + k * 0.9), vb.y, (vb.z - Math.sin(k * 2.4) * 0.28 + 0.1) * (0.5 + k * 0.9)
               + Math.sin(k * 2.4) * 0.28 - 0.1);
  }
  bodyG.computeVertexNormals();
  var parts = [{ geo: bodyG }];
  var head = new THREE.SphereGeometry(0.17, 12, 9);
  head.scale(0.8, 0.9, 1.5);
  parts.push({ geo: head, matrix: TRS(0, 1.28, 0.14) });
  var snout = new THREE.CylinderGeometry(0.045, 0.075, 0.34, 7, 1, false);
  parts.push({ geo: snout, matrix: TRS(0, 1.26, 0.36, Math.PI / 2 - 0.25, 0, 0) });
  var crown = new THREE.ConeGeometry(0.07, 0.20, 6);
  parts.push({ geo: crown, matrix: TRS(0, 1.46, 0.02, -0.3, 0, 0) });
  var bg = mergeGeos(parts);
  swayByHeight(bg, 1.5, -0.2, 1.2);
  var body = toonMesh(bg, {
    color: 0xf2c14e, colorB: 0xfff0c0,
    baseHook: [
      '  base = mix(base, uColorB, smoothstep(0.0, 1.3, vObj.y)*0.4);',
      '  base *= 0.86 + 0.28*step(0.5, fract(vObj.y*7.0));',                  // anneaux
      '  base = mix(base, base*0.7, step(0.6, fbm(vObj.xz*9.0))*0.5);'
    ].join('\n'),
    mode: 2, swayAmp: 0.05, swayFreq: 1.2, swaySpeed: 1.6, spec: 0.3, rim: 0.4, bump: 0.3
  });
  g.add(body);
  var dfin = finGeo([[0, 0], [0.1, 0.22], [0.24, 0.30], [0.3, 0.02]], 0.014);
  dfin.rotateY(Math.PI / 2);
  var dm = toonMesh(dfin, { color: 0xffdc8a, opacity: 0.8, transparent: true, side: THREE.DoubleSide, rim: 0.5, sss: 1.0 });
  dm.position.set(0, 0.72, -0.16); dm.rotation.z = -0.2;
  g.add(dm);
  addEyes(g, 0.10, 1.32, 0.22, 0.058, { iris: 0x9fd8e8, pupil: 0x0a1018 });
  g.userData.body = body;
  g.userData.fin = dm;
  g.scale.setScalar(scale || 1);
  return g;
}

/** Octopus: a domed mantle and eight rippling arms. */
function buildOctopus(scale) {
  var g = new THREE.Group();
  var m = new THREE.SphereGeometry(0.5, 16, 12);
  m.scale(1, 1.25, 1.05);
  var mm = toonMesh(m, {
    color: 0xc4628f, colorB: 0xffd3e0,
    baseHook: [
      '  base = mix(base, uColorB, smoothstep(0.1, 0.6, vObj.y)*0.5);',
      '  base = mix(base, base*0.68, step(0.58, fbm(vObj.xz*6.0 + vObj.y*2.0))*0.7);'
    ].join('\n'),
    spec: 0.35, rim: 0.4, sss: 0.3, bump: 0.35
  });
  mm.position.y = 0.42;
  g.add(mm);
  var arms = [];
  for (var i = 0; i < 8; i++) {
    var a = (i / 8) * TAU;
    var pts = [];
    for (var k = 0; k <= 4; k++) {
      var t = k / 4;
      pts.push(new THREE.Vector3(Math.cos(a) * (0.30 + t * 1.15), 0.34 - t * 0.22 + Math.sin(t * 3.1) * 0.16,
                                 Math.sin(a) * (0.30 + t * 1.15)));
    }
    var cur = new THREE.CatmullRomCurve3(pts);
    var ag = new THREE.TubeGeometry(cur, 10, 0.085, 6, false);
    var pa = ag.attributes.position, va = new THREE.Vector3();
    ensureAttrs(ag);
    var sw = ag.attributes.aSway;
    for (var j = 0; j < pa.count; j++) {              // taper + softness towards the tip
      va.fromBufferAttribute(pa, j);
      var d = Math.sqrt(va.x * va.x + va.z * va.z);
      var kk = clamp((d - 0.30) / 1.15, 0, 1);
      sw.setX(j, Math.pow(kk, 1.4));
    }
    arms.push({ geo: ag });
  }
  var armMesh = toonMesh(mergeGeos(arms), {
    color: 0xb85684, colorB: 0xffd3e0,
    baseHook: '  base = mix(base, uColorB, smoothstep(0.3, -0.2, vObj.y)*0.35);',
    mode: 0, swayAmp: 0.30, swaySpeed: 1.5, spec: 0.3, rim: 0.4, sss: 0.4
  });
  g.add(armMesh);
  addEyes(g, 0.30, 0.62, 0.30, 0.12, { iris: 0xffe08a, pupil: 0x0a1018, pupilR: 0.4 });
  g.userData.body = mm;
  g.userData.arms = armMesh;
  g.scale.setScalar(scale || 1);
  return g;
}

/** Crab: shell, legs and claws. */
function buildCrab(scale) {
  var g = new THREE.Group();
  var sh = new THREE.SphereGeometry(0.5, 16, 11);
  sh.scale(1.15, 0.5, 0.9);
  var body = toonMesh(sh, {
    color: 0xd8543f, colorB: 0xffb08a,
    baseHook: '  base = mix(base, uColorB, smoothstep(0.05, 0.3, vObj.y)*0.6);\n  base = mix(base, base*0.7, step(0.6, fbm(vObj.xz*5.0))*0.5);',
    spec: 0.4, rim: 0.35, bump: 0.3
  });
  body.position.y = 0.3;
  g.add(body);
  var legs = [];
  for (var s2 = -1; s2 <= 1; s2 += 2) {
    for (var i = 0; i < 4; i++) {
      var zz = -0.28 + i * 0.19;
      var l1 = new THREE.CylinderGeometry(0.028, 0.04, 0.36, 5, 1, true);
      legs.push({ geo: l1, matrix: TRS(s2 * 0.52, 0.24, zz, 0, 0, s2 * 1.0) });
      var l2 = new THREE.CylinderGeometry(0.022, 0.032, 0.34, 5, 1, true);
      legs.push({ geo: l2, matrix: TRS(s2 * 0.76, 0.10, zz, 0, 0, s2 * 2.3) });
    }
    // pince
    var cl = new THREE.SphereGeometry(0.14, 9, 7);
    cl.scale(1.3, 0.7, 0.8);
    legs.push({ geo: cl, matrix: TRS(s2 * 0.72, 0.26, 0.44, 0, s2 * 0.5, 0) });
    var arm = new THREE.CylinderGeometry(0.035, 0.05, 0.4, 5, 1, true);
    legs.push({ geo: arm, matrix: TRS(s2 * 0.46, 0.28, 0.3, 1.2, s2 * 0.6, 0) });
  }
  var legMesh = toonMesh(mergeGeos(legs), { color: 0xc44a38, spec: 0.35, rim: 0.3 });
  g.add(legMesh);
  // eyes on stalks
  for (var s3 = -1; s3 <= 1; s3 += 2) {
    var st = toonMesh(new THREE.CylinderGeometry(0.022, 0.026, 0.2, 5), { color: 0xd8543f, rim: 0.3 });
    st.position.set(s3 * 0.14, 0.52, 0.24);
    g.add(st);
  }
  addEyes(g, 0.14, 0.63, 0.25, 0.055, { pupil: 0x0a1018, pupilR: 0.65 });
  g.userData.body = body;
  g.scale.setScalar(scale || 1);
  return g;
}

/** Crevette nettoyeuse. */
function buildShrimp(scale) {
  var g = new THREE.Group();
  var parts = [];
  for (var i = 0; i < 6; i++) {
    var t = i / 5;
    var r = 0.14 * (1 - t * 0.55);
    var seg = new THREE.SphereGeometry(r, 9, 7);
    parts.push({ geo: seg, matrix: TRS(0, 0.02 + Math.sin(t * 1.6) * 0.12, 0.30 - t * 0.62, 0, 0, 0, 1, 0.9, 1.1) });
  }
  var bodyG = mergeGeos(parts);
  var body = toonMesh(bodyG, {
    color: 0xf2f0ea, colorB: 0xe0483f,
    baseHook: [
      '  float band = step(0.5, fract(vObj.z*4.5));',
      '  base = mix(base, uColorB, band*0.85);',
      '  base = mix(base, vec3(1.0), 0.15);'
    ].join('\n'),
    opacity: 0.92, transparent: true, spec: 0.5, rim: 0.6, sss: 0.7
  });
  g.add(body);
  var tailF = finGeo([[0, 0.03], [0.14, 0.13], [0.18, 0.0], [0.14, -0.13], [0, -0.03]], 0.012);
  tailF.rotateY(Math.PI / 2);
  var tm = toonMesh(tailF, { color: 0xffd9d0, opacity: 0.8, transparent: true, side: THREE.DoubleSide, rim: 0.5 });
  tm.position.set(0, 0.02, -0.38);
  g.add(tm);
  for (var s2 = -1; s2 <= 1; s2 += 2) {                // antennes
    var ant = new THREE.CylinderGeometry(0.006, 0.009, 0.9, 4, 3, true);
    ant.translate(0, 0.45, 0);
    swayByHeight(ant, 0, 0.9, 1.3);
    var am = toonMesh(ant, { color: 0xffffff, opacity: 0.55, transparent: true, mode: 2, swayAmp: 0.12, swaySpeed: 2.2, rim: 0.6 });
    am.position.set(s2 * 0.05, 0.10, 0.34);
    am.rotation.set(1.15, 0, s2 * 0.25);
    g.add(am);
  }
  addEyes(g, 0.075, 0.14, 0.34, 0.04, { pupil: 0x101820, pupilR: 0.8 });
  g.userData.body = body;
  g.scale.setScalar(scale || 1);
  return g;
}

/** Moray: a long eel lurking in its hole. */
function buildMoray(scale) {
  var g = new THREE.Group();
  var pts = [];
  for (var i = 0; i <= 5; i++) {
    var t = i / 5;
    pts.push(new THREE.Vector3(Math.sin(t * 3.0) * 0.5, t * 0.5, -t * 3.4));
  }
  var cur = new THREE.CatmullRomCurve3(pts);
  var bg = new THREE.TubeGeometry(cur, 22, 0.26, 9, false);
  var pb = bg.attributes.position, vb = new THREE.Vector3();
  for (var j = 0; j < pb.count; j++) {
    vb.fromBufferAttribute(pb, j);
    var k = clamp(-vb.z / 3.4, 0, 1);
    pb.setXYZ(j, vb.x * (1 - k * 0.5), vb.y * (1.15 - k * 0.6), vb.z);
  }
  bg.computeVertexNormals();
  var body = toonMesh(bg, {
    color: 0x7a8f5c, colorB: 0xe8e2b0,
    baseHook: [
      '  base = mix(base, uColorB, smoothstep(0.0, -0.2, vObj.y)*0.5);',
      '  base = mix(base, base*0.55, step(0.55, fbm(vObj.xz*4.5 + vObj.y*2.0))*0.75);'
    ].join('\n'),
    mode: 1, fishLen: 0.2, taper: 0.5, swayAmp: 0.16, swayFreq: 3.4, swaySpeed: 1.4,
    spec: 0.35, rim: 0.35, bump: 0.2
  });
  g.add(body);
  // jaw
  var jaw = toonMesh(new THREE.SphereGeometry(0.24, 12, 8, 0, TAU, 0, Math.PI * 0.55),
    { color: 0x6f8452, rim: 0.3 });
  jaw.scale.set(1, 0.5, 1.5);
  jaw.rotation.x = Math.PI;
  jaw.position.set(0, -0.04, 0.18);
  g.add(jaw);
  for (var k2 = 0; k2 < 6; k2++) {
    var tooth = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.07, 4),
      new THREE.MeshBasicMaterial({ color: 0xfff8e8 }));
    tooth.position.set(-0.1 + k2 * 0.04, -0.02, 0.30);
    tooth.rotation.x = Math.PI;
    g.add(tooth);
  }
  addEyes(g, 0.12, 0.10, 0.24, 0.052, { white: 0xffe8a0, pupil: 0x120a06, pupilR: 0.75 });
  g.userData.body = body;
  g.userData.jaw = jaw;
  g.scale.setScalar(scale || 1);
  return g;
}

/** Garden eels: they duck into the sand when you come near. */
function buildGardenEels(count, radius) {
  var g = new THREE.Group();
  var eels = [];
  for (var i = 0; i < count; i++) {
    var a = rnd() * TAU, d = Math.sqrt(rnd()) * radius;
    var h = rr(1.1, 2.2);
    var tube = new THREE.CylinderGeometry(0.035, 0.055, h, 6, 4, true);
    tube.translate(0, h * 0.5, 0);
    swayByHeight(tube, 0, h, 1.3);
    var m = toonMesh(tube, {
      color: 0xd8cfae, colorB: 0x8a7f5f,
      baseHook: '  base = mix(base, uColorB, step(0.5, fract(vObj.y*3.0))*0.5);',
      mode: 2, swayAmp: 0.10, swayFreq: 1.6, swaySpeed: 1.8, rim: 0.35, spec: 0.2
    });
    var x = Math.cos(a) * d, z = Math.sin(a) * d;
    m.position.set(x, floorHeight(x, z), z);
    m.userData.h = h;
    m.userData.out = 1;
    g.add(m);
    eels.push(m);
  }
  g.userData.eels = eels;
  return g;
}

/** Giant clam: two valves that open and close. */
function buildClam(scale) {
  var g = new THREE.Group();
  function valve(sign) {
    var v = new THREE.SphereGeometry(0.5, 14, 9, 0, TAU, 0, Math.PI * 0.5);
    var p = v.attributes.position, w = new THREE.Vector3();
    for (var i = 0; i < p.count; i++) {
      w.fromBufferAttribute(p, i);
      var a = Math.atan2(w.z, w.x);
      p.setXYZ(i, w.x * (1 + Math.cos(a * 7) * 0.07), w.y * 0.55, w.z * (1 + Math.cos(a * 7) * 0.07));
    }
    v.computeVertexNormals();
    occByHeight(v, 0, 0.3, 0.5);
    var m = toonMesh(v, {
      color: 0xdad3c2, colorB: 0x9f9784,
      baseHook: '  base = mix(base, uColorB, step(0.5, fract(length(vObj.xz)*9.0))*0.4);',
      spec: 0.35, rim: 0.3, bump: 0.4
    });
    m.rotation.z = sign * 0.1;
    return m;
  }
  var top = valve(1), bot = valve(-1);
  bot.rotation.x = Math.PI;
  bot.position.y = 0.02;
  top.position.y = 0.04;
  g.add(top); g.add(bot);
  var mantle = toonMesh(new THREE.SphereGeometry(0.44, 14, 8, 0, TAU, 0, Math.PI * 0.5), {
    color: 0x4fc0d8, colorB: 0x8f5ad8,
    baseHook: '  base = mix(base, uColorB, fbm(vObj.xz*8.0));\n  emis += 0.10;',
    spec: 0.5, rim: 0.6, sss: 0.4
  });
  mantle.scale.set(1, 0.25, 1);
  mantle.position.y = 0.03;
  g.add(mantle);
  g.userData.top = top;
  g.userData.mantle = mantle;
  g.scale.setScalar(scale || 1);
  return g;
}

/** Chatty starfish (with eyes). */
function buildStarfishNPC(scale) {
  var g = new THREE.Group();
  var st = toonMesh(starfishGeo(), {
    color: 0xe8608f, colorB: 0xffc0d8,
    baseHook: '  base = mix(base, uColorB, smoothstep(0.0, 0.14, vObj.y)*0.7);\n  base = mix(base, base*0.8, step(0.55, fbm(vObj.xz*7.0))*0.6);',
    spec: 0.3, rim: 0.35, bump: 0.4
  });
  g.add(st);
  addEyes(g, 0.10, 0.16, 0.30, 0.062, { iris: 0xffd8e8, pupil: 0x0a1018 });
  g.userData.body = st;
  g.scale.setScalar(scale || 1);
  return g;
}

/** Whale silhouette, far off in the blue. */
function buildWhale() {
  var g = new THREE.Group();
  var b = fishBodyGeo(0.55, 0.62, { belly: 0.25, head: 0.35, seg: 18, seg2: 12 });
  var parts = [{ geo: b }];
  var tail = finGeo([[0, 0.06], [0.5, 0.5], [0.9, 0.34], [0.55, 0.02],
                     [0.9, -0.34], [0.5, -0.5], [0, -0.06]], 0.06);
  tail.rotateY(Math.PI / 2); tail.rotateZ(Math.PI / 2);   // fluke horizontal : voulu
  parts.push({ geo: tail, matrix: TRS(0, 0, -1.05) });
  var pec = finGeo([[0, 0], [0.7, -0.1], [1.0, -0.3], [0.6, -0.22]], 0.05);
  parts.push({ geo: pec, matrix: TRS(0.3, -0.2, 0.2, 0.3, 0, 0) });
  var pec2 = pec.clone(); pec2.scale(-1, 1, 1);
  parts.push({ geo: pec2, matrix: TRS(-0.3, -0.2, 0.2, 0.3, 0, 0) });
  var m = toonMesh(mergeGeos(parts), {
    color: 0x2f4a63, colorB: 0x9fb4c4,
    baseHook: '  base = mix(base, uColorB, smoothstep(-0.1, -0.5, vObj.y)*0.8);',
    mode: 1, fishLen: 1.0, taper: 1.4, swayAmp: 0.07, swayFreq: 1.6, swaySpeed: 0.7,
    rim: 0.5, spec: 0.15
  });
  g.add(m);
  g.scale.setScalar(26);
  g.userData.body = m;
  return g;
}

/** A pearl to collect. */
function buildPearl() {
  var g = new THREE.Group();
  var core = toonMesh(new THREE.SphereGeometry(0.42, 16, 12), {
    color: 0xfff8ee, colorB: 0x9fe2ff,
    baseHook: '  base = mix(base, uColorB, smoothstep(0.15, -0.4, vObj.y));\n  emis += 0.5*pow(max(vObj.y*2.0, 0.0), 2.0);',
    rim: 1.0, spec: 2.0, emissive: 1.05, soft: 0.20, outline: 2.2
  });
  g.add(core);
  var halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX.soft, color: 0x9fe9ff, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95
  }));
  halo.scale.setScalar(3.2);
  g.add(halo);
  var sparks = [];
  for (var i = 0; i < 3; i++) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX.soft, color: 0xffffff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9
    }));
    sp.scale.setScalar(0.42);
    g.add(sp); sparks.push(sp);
  }
  g.userData.core = core;
  g.userData.halo = halo;
  g.userData.sparks = sparks;
  return g;
}
