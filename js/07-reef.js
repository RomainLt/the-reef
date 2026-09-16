/* The Reef — The reef: massifs of coral-crusted rock shelves
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* THE REEF: massifs of coral-crusted rock shelves                    */
/* ------------------------------------------------------------------ */
/* All the static scenery is merged into 3 meshes per massif          */
/* (hard / soft / flat), which buys thousands of corals for a         */
/* handful of draw calls.                                             */
/* ================================================================== */
var REEF = {};                 // the only 3 materials in the scenery
var batch = null;
var seedCounter = 1000;
function nextSeed() { return ++seedCounter; }

function beginBatch() { batch = { hard: [], soft: [], flat: [] }; }
function put(kind, geo, matrix, color, phase) {
  batch[kind].push({ geo: geo, matrix: matrix, color: color, phase: phase || 0 });
}
function endBatch() {
  var kinds = ['hard', 'soft', 'flat'], made = [];
  for (var i = 0; i < kinds.length; i++) {
    var k = kinds[i];
    if (!batch[k].length) continue;
    var m = new THREE.Mesh(mergeGeos(batch[k]), REEF[k].mat);
    m.matrixAutoUpdate = false;
    castShadow(m);
    scene.add(m);
    made.push(m);
  }
  batch = null;
  return made;
}

var SPAWN = new THREE.Vector3(26, 0, 24);
function nearSpawn(x, z, pad) {
  var dx = x - SPAWN.x, dz = z - SPAWN.z;
  return dx * dx + dz * dz < (pad || 9) * (pad || 9);
}
function addCollider(x, y, z, r) { world.colliders.push({ x: x, y: y, z: z, r: r }); }
function addDisc(x, y, z, r, h) { world.colliders.push({ x: x, y: y, z: z, r: r, h: h }); }

function buildReef() {
  /* ---- materials: one for rock and hard corals, one for whatever sways,
                one for double-sided leaves ---- */
  var MOTTLE = [
    '  float mo = fbm(vWP.xz*0.33 + vWP.y*0.12);',
    '  base *= 0.90 + 0.20*mo;',
    '  base = mix(base, base*vec3(0.72,0.92,0.80), smoothstep(0.62,0.92,mo)*0.35);'
  ].join('\n');
  REEF.hard = makeToonMat({ color: 0xffffff, spec: 0.10, rim: 0.20, caust: 1.0, bump: 0.55, baseHook: MOTTLE });
  REEF.soft = makeToonMat({
    color: 0xffffff, spec: 0.06, rim: 0.30, sss: 0.55, caust: 0.85, bump: 0.22,
    mode: 0, swayAmp: 0.115, swaySpeed: 1.15
  });
  REEF.flat = makeToonMat({
    color: 0xffffff, spec: 0.05, rim: 0.28, sss: 0.75, caust: 0.8,
    mode: 0, swayAmp: 0.19, swaySpeed: 1.3, side: THREE.DoubleSide
  });

  /* ---- library of geometries reused everywhere ---- */
  var GEO = {
    knob:   [knobCoralGeo(301, 6), knobCoralGeo(302, 8), knobCoralGeo(303, 10), knobCoralGeo(304, 5)],
    brain:  [brainCoralGeo(311), brainCoralGeo(312)],
    branch: [branchCoralGeo(321, 1.0), branchCoralGeo(322, 1.25), branchCoralGeo(323, 0.85)],
    sponge: [tubeSpongeGeo(331), tubeSpongeGeo(332), tubeSpongeGeo(333)],
    pom:    [pomAnemoneGeo(341, 1.0, 22), pomAnemoneGeo(342, 1.4, 29), pomAnemoneGeo(343, 0.7, 15)],
    fringe: [fringePlateGeo(351, 2.1), fringePlateGeo(352, 3.0)],
    fan:    [fanCoralGeo(361, 1.4), fanCoralGeo(362, 2.1)],
    whip:   [whipGeo(371, 3.0), whipGeo(372, 4.4), whipGeo(373, 2.2)],
    pad:    [padGeo(381, 1.2), padGeo(382, 1.9)],
    grass:  [grassGeo(391, 10, 0.85), grassGeo(392, 14, 1.25)],
    kelp:   [kelpGeo(401, 5.0), kelpGeo(402, 7.5)],
    urchin: [urchinGeo(411)],
    star:   [starfishGeo()],
    shelfS: [shelfGeo(421, 2.0, 0.45), shelfGeo(422, 3.2, 0.65)],
    rock:   [rockGeo(431, 2.2), rockGeo(432, 4.0), rockGeo(433, 6.5), rockGeo(434, 9.5)],
    pillar: [pillarGeo(441, 10), pillarGeo(442, 14), pillarGeo(443, 7)]
  };
  var ROCK_R = [2.2, 4.0, 6.5, 9.5];

  function rockCol() {
    var v = rnd();
    return v < 0.5 ? PAL.rock : (v < 0.75 ? tint(PAL.rock, 0.88) : tint(PAL.rock, 1.09));
  }
  /** Palette for one massif: 3 dominant tints + rare accents. */
  function makePal() {
    var p = [];
    for (var i = 0; i < 3; i++) p.push(pick(PAL.coral));
    return p;
  }
  function palPick(pal) {
    var v = rnd();
    return v < 0.82 ? pal[(rnd() * pal.length) | 0] : pick(PAL.coral);
  }

  /** Places one coral of a given type. */
  function placeProp(t, x, z, py, col, big, shadY, onSand) {
    var rot = rnd() * TAU, ph = rnd() * TAU, s = 0;
    {
      if (t < 0.235) {                                    // chou-fleur
        s = (big > 1 && rnd() < 0.3 ? rr(1.6, 2.6) : rr(0.5, 1.25)) * big;
        put('hard', pick(GEO.knob), TRS(x, py - 0.08, z, 0, rot, 0, s), col);
        if (s > 0.85) addCollider(x, py + 0.6 * s, z, 0.95 * s + 0.5);
      } else if (t < 0.325) {                             // cerveau
        s = (big > 1 && rnd() < 0.3 ? rr(1.7, 2.8) : rr(0.55, 1.35)) * big;
        put('hard', pick(GEO.brain), TRS(x, py - 0.05, z, 0, rot, 0, s), col);
        if (s > 0.8) addCollider(x, py + 0.32 * s, z, 1.15 * s + 0.45);
      } else if (t < 0.415) {                             // branchu
        s = (big > 1 && rnd() < 0.25 ? rr(1.7, 2.6) : rr(0.55, 1.3)) * big;
        put('hard', pick(GEO.branch), TRS(x, py - 0.08, z, 0, rot, 0, s), col);
        if (s > 0.9) addCollider(x, py + 1.0 * s, z, 1.0 * s + 0.5);
      } else if (t < 0.49) {                              // sponges
        s = rr(0.6, 1.35) * big;
        put('hard', pick(GEO.sponge), TRS(x, py - 0.05, z, 0, rot, 0, s), col);
      } else if (t < 0.665) {                             // pompom anemones
        s = rr(0.55, 1.25) * big;
        put('soft', pick(GEO.pom), TRS(x, py - 0.05, z, 0, rot, 0, s), col, ph);
      } else if (t < 0.705) {                             // big fringed table
        s = rr(0.75, 1.3);
        put('soft', pick(GEO.fringe), TRS(x, py + 0.1, z, 0, rot, 0, s), col, ph);
        addDisc(x, py + 0.35 * s, z, 2.4 * s, 0.5 * s + 0.7);
      } else if (t < 0.775) {                             // sea whips
        s = rr(0.6, 1.3) * big;
        put('soft', pick(GEO.whip), TRS(x, py, z, 0, rot, 0, s), col, ph);
      } else if (t < 0.825) {                             // gorgones
        s = rr(0.6, 1.4) * big;
        put('soft', pick(GEO.fan), TRS(x, py, z, 0, rot, 0, s), col, ph);
      } else if (t < 0.878) {                             // plateaux d'algue
        s = rr(0.45, 0.95);
        put('hard', pick(GEO.pad), TRS(x, py + 0.12, z, rr(-0.06, 0.06), rot, rr(-0.06, 0.06), s),
            pick(PAL.algae));
      } else if (t < 0.935) {                             // touffes
        s = rr(0.7, 1.4);
        put('flat', rnd() < 0.75 ? pick(GEO.grass) : pick(GEO.kelp),
            TRS(x, py - 0.1, z, 0, rot, 0, s), pick(PAL.algae), ph);
        s = 0;
      } else if (t < 0.962) {                             // small shelf
        s = rr(0.6, 1.2);
        put('hard', pick(GEO.shelfS), TRS(x, py + 0.2, z, 0, rot, 0, s), rockCol());
      } else if (t < 0.984) {
        put('hard', GEO.urchin[0], TRS(x, py, z, 0, rot, 0, rr(0.6, 1.2)), pick(PAL.coral));
      } else {
        put('hard', GEO.star[0], TRS(x, py + 0.04, z, 0, rot, 0, rr(0.8, 1.5)), col);
      }
    }
    if (s > 0.62) pushShadow(x, z, s * 1.45, onSand ? undefined : shadY);
  }

  /** Scatters corals over a disc (the top of a shelf, or the sand),
            in small tufts of a single species, as in the film. */
  function encrust(cx, cz, y, radius, count, pal, opt) {
    opt = opt || {};
    var placed = 0, guard = 0;
    while (placed < count && guard++ < count * 4) {
      var a = rnd() * TAU;
      var d = opt.rim ? radius * rr(0.86, 1.04) : Math.pow(rnd(), opt.edge ? 0.45 : 0.72) * radius;
      var x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (opt.onSand && nearSpawn(x, z, 10)) continue;
      var t = rnd(), col = palPick(pal), big = opt.big ? 1.35 : 1.0;
      var clump = rnd() < 0.38 ? 2 + ((rnd() * 3) | 0) : 1;
      for (var ci = 0; ci < clump && placed < count; ci++) {
        var jx = x + (ci ? rr(-1.6, 1.6) : 0), jz = z + (ci ? rr(-1.6, 1.6) : 0);
        var py = opt.onSand ? floorHeight(jx, jz) : y;
        placeProp(t, jx, jz, py, col, big, py + 0.05, !!opt.onSand);
        placed++;
      }
    }
  }

  /** One massif: a rock core + stacked shelves + corals everywhere. */
  function buildMassif(cx, cz, size, opt) {
    opt = opt || {};
    beginBatch();
    var pal = makePal();
    var baseY = floorHeight(cx, cz);

    var ri = size > 17 ? 3 : (size > 12 ? 2 : 1);
    var rs = (size * 0.60) / ROCK_R[ri];
    put('hard', GEO.rock[ri], TRS(cx, baseY - size * 0.16, cz, 0, rnd() * TAU, 0, rs, rs * 0.85, rs), rockCol());
    addCollider(cx, baseY - size * 0.16, cz, ROCK_R[ri] * rs * 1.2 + 0.9);
    pushShadow(cx, cz, size * 1.4);

    var n = Math.max(3, Math.round(size / 3.6) + ((rnd() * 2) | 0));
    var y = baseY + size * rr(0.14, 0.22);
    var top = { x: cx, y: y, z: cz, r: size * 0.5 };
    for (var i = 0; i < n; i++) {
      var sr = size * (0.62 - i * 0.055 + (rnd() - 0.5) * 0.14);
      if (sr < 2.2) break;
      var th = rr(1.1, 2.3);
      var sx = cx + rr(-1, 1) * size * 0.26, sz = cz + rr(-1, 1) * size * 0.26;
      // pillar holding the plate up (otherwise the shelves look like they float)
      var supY0 = i === 0 ? baseY - 1 : top.y;
      var supH = y - th * 0.5 - supY0 + 0.8;
      if (supH > 0.4) {
        var supX = (i === 0 ? cx : top.x) * 0.4 + sx * 0.6;
        var supZ = (i === 0 ? cz : top.z) * 0.4 + sz * 0.6;
        var supR = Math.min(i === 0 ? size * 0.4 : top.r, sr) * rr(0.4, 0.62);
        var sup = new THREE.CylinderGeometry(supR * 0.88, supR * 1.06, supH, 10, 1, true);
        occByHeight(sup, -supH * 0.5, supH * 0.5, 0.5);
        put('hard', sup, TRS(supX, supY0 + supH * 0.5, supZ, 0, rnd() * TAU, 0, 1), rockCol());
        addCollider(supX, supY0 + supH * 0.5, supZ, supR + 1.0);
      }
      put('hard', shelfGeo(nextSeed(), sr, th), TRS(sx, y, sz, 0, rnd() * TAU, 0, 1), rockCol());
      addDisc(sx, y, sz, sr * 0.97, th * 0.5 + 1.0);
      var bigTop = i === 0 && size > 14;
      encrust(sx, sz, y + th * 0.5, sr * 0.86, Math.round(sr * 2.0), pal, { big: bigTop });
      encrust(sx, sz, y + th * 0.35, sr, Math.round(sr * 1.3), pal, { rim: true });
      top = { x: sx, y: y + th * 0.5, z: sz, r: sr };
      y += rr(1.1, 2.3) + th;
    }
    // at the foot of the massif, on the sand
    encrust(cx, cz, 0, size * 1.1, Math.round(size * 2.4), pal, { onSand: true, edge: true });
    var meshes = endBatch();
    return { x: cx, z: cz, size: size, top: top, meshes: meshes };
  }

  /** A rock bridge between two massifs: the arches from the film. */
  function buildBridge(a, b) {
    beginBatch();
    var mx = (a.top.x + b.top.x) * 0.5, mz = (a.top.z + b.top.z) * 0.5;
    var dx = b.top.x - a.top.x, dz = b.top.z - a.top.z;
    var len = Math.sqrt(dx * dx + dz * dz);
    var ang = Math.atan2(dx, dz);
    var y = Math.min(a.top.y, b.top.y) + rr(1.5, 4);
    var wid = rr(3.2, 5);
    var g = shelfGeo(nextSeed(), 1, 0.55);
    put('hard', g, TRS(mx, y, mz, 0, -ang, 0, wid, 1.6, len * 0.55), rockCol());
    addDisc(mx, y, mz, Math.max(wid, len * 0.5), 1.6);
    var pal = makePal();
    for (var i = 0; i < 14; i++) {
      var t = rr(-0.42, 0.42);
      encrust(mx + dx * t, mz + dz * t, y + 0.5, wid * 0.5, 2, pal, {});
    }
    endBatch();
    world.arch = new THREE.Vector3(mx, y, mz);
  }

  /* ---- 1. home: the central massif crowned by the host anemone ---- */
  var home = buildMassif(0, 0, 15);
  beginBatch();
  var hostR = 4.4;          // in the film the anemone dwarfs the fish
  /* White tint: the magenta → cream gradient is baked into the vertices, and
         the colour passed here MULTIPLIES it. A pink would have re-tinted the
         whole thing and buried the magenta column under a uniform mush. */
  put('soft', hostAnemoneGeo(777, hostR, 172),
      TRS(home.top.x, home.top.y + 0.1, home.top.z, 0, rnd() * TAU, 0, 1), 0xffffff, rnd() * TAU);
  endBatch();
  world.home.set(home.top.x, home.top.y + hostR * 0.9, home.top.z);
  world.refuges.push(world.home.clone());
  addDisc(home.top.x, home.top.y + 0.6, home.top.z, hostR * 0.7, 1.2);

  /* ---- 2. the other massifs ---- */
  var massifs = [home];
  var RING = [];
  var rings = [[30, 4, 14], [54, 6, 19], [78, 7, 23], [98, 5, 13]];
  for (var rg = 0; rg < rings.length; rg++) {
    var rad = rings[rg][0], cnt = rings[rg][1], sz = rings[rg][2];
    for (var ci2 = 0; ci2 < cnt; ci2++) {
      var ang2 = (ci2 / cnt) * TAU + rg * 0.5 + rr(-0.16, 0.16);
      RING.push([Math.cos(ang2) * rad * rr(0.88, 1.12), Math.sin(ang2) * rad * rr(0.88, 1.12), sz]);
    }
  }
  for (var i = 0; i < RING.length; i++) {
    var mx2 = RING[i][0] + rr(-5, 5), mz2 = RING[i][1] + rr(-5, 5);
    if (nearSpawn(mx2, mz2, 22)) continue;
    var clash = false;
    for (var pk2 in PLACES) {
      var pv = PLACES[pk2];
      if ((mx2 - pv.x) * (mx2 - pv.x) + (mz2 - pv.z) * (mz2 - pv.z) < pv.clear * pv.clear) clash = true;
    }
    if (clash) continue;
    // no massif out in the void of the drop-off
    if ((1 - smoothstep(0.5, 1.0, angGap(Math.atan2(mz2, mx2), DROP_ANG))) *
        smoothstep(70, 92, Math.sqrt(mx2 * mx2 + mz2 * mz2)) > 0.25) continue;
    massifs.push(buildMassif(mx2, mz2, RING[i][2] * rr(0.85, 1.15)));
  }

  /* ---- 3. tourelles ---- */
  for (var q = 0; q < 10; q++) {
    var qa = rnd() * TAU, qd = 24 + Math.sqrt(rnd()) * (CFG.REEF_R - 34);
    var qx = Math.cos(qa) * qd, qz = Math.sin(qa) * qd;
    if (nearSpawn(qx, qz, 16)) continue;
    var okq = true;
    for (var mi = 0; mi < massifs.length; mi++) {
      var mm = massifs[mi];
      if ((qx - mm.x) * (qx - mm.x) + (qz - mm.z) * (qz - mm.z) < (mm.size + 12) * (mm.size + 12)) { okq = false; break; }
    }
    if (!okq) continue;
    beginBatch();
    var psc = rr(0.8, 1.5), pg = pick(GEO.pillar), pby = floorHeight(qx, qz) - 1;
    put('hard', pg, TRS(qx, pby, qz, 0, rnd() * TAU, 0, psc), rockCol());
    for (var pk = 0; pk < 4; pk++) addCollider(qx, pby + (1.5 + pk * 3.4) * psc, qz, 3.0 * psc + 0.9);
    pushShadow(qx, qz, 6 * psc);
    encrust(qx, qz, 0, 7 * psc, Math.round(16 * psc), makePal(), { onSand: true });
    endBatch();
  }

  /* ---- 4. deux passerelles entre massifs proches ---- */
  var bridges = 0;
  for (var bi = 1; bi < massifs.length && bridges < 2; bi++) {
    for (var bj = bi + 1; bj < massifs.length && bridges < 2; bj++) {
      var A = massifs[bi], B = massifs[bj];
      var dd = Math.sqrt((A.x - B.x) * (A.x - B.x) + (A.z - B.z) * (A.z - B.z));
      if (dd > 26 && dd < 42) { buildBridge(A, B); bridges++; }
    }
  }
  if (!world.arch) world.arch = new THREE.Vector3(massifs[1].top.x, massifs[1].top.y + 4, massifs[1].top.z);
  world.massifs = massifs;

  /* ---- 5. the landmarks ---- */
  buildLandmarks(GEO, encrust, makePal, rockCol);

  /* ---- 6. the sand between massifs: a sparse scatter, per quadrant ---- */
  for (var qd2 = 0; qd2 < 4; qd2++) {
    beginBatch();
    var pal2 = makePal();
    var placedQ = 0, tries = 0;
    while (placedQ < 58 && tries < 520) {
      tries++;
      var aa = (qd2 + rnd()) * (TAU / 4);
      var dd2 = 16 + Math.sqrt(rnd()) * (CFG.REEF_R - 18);
      var px = Math.cos(aa) * dd2, pz = Math.sin(aa) * dd2;
      if (nearSpawn(px, pz, 11)) continue;
      var ok = true;
      for (var ci = 0; ci < massifs.length; ci++) {
        var M = massifs[ci];
        if ((px - M.x) * (px - M.x) + (pz - M.z) * (pz - M.z) < (M.size * 1.2) * (M.size * 1.2)) { ok = false; break; }
      }
      if (!ok) continue;
      placedQ++;
      encrust(px, pz, 0, 3 + rnd() * 4, 2 + ((rnd() * 5) | 0), pal2, { onSand: true });
    }
    endBatch();
  }
}

/* ---------- where the pearls go ---------- */
function buildPearls() {
  var spots = [];
  function far(v) {
    if (v.length() > CFG.REEF_R - 6) return false;
    var hx = v.x - world.home.x, hz = v.z - world.home.z;
    if (hx * hx + hz * hz < 260) return false;
    for (var i = 0; i < spots.length; i++) if (spots[i].distanceTo(v) < 20) return false;
    for (var c = 0; c < world.colliders.length; c++) {
      var col = world.colliders[c];
      var dx = v.x - col.x, dy = v.y - col.y, dz = v.z - col.z;
      if (col.h === undefined) {
        if (dx * dx + dy * dy + dz * dz < (col.r + 1.6) * (col.r + 1.6)) return false;
      } else if (dx * dx + dz * dz < (col.r + 1.6) * (col.r + 1.6) && Math.abs(dy) < col.h + 1.6) {
        return false;
      }
    }
    return true;
  }
  // one pearl under the arch, one right up near the surface
  spots.push(new THREE.Vector3(world.arch.x, world.arch.y - 4.5, world.arch.z));
  spots.push(new THREE.Vector3(rr(-30, 30), CFG.WATER_Y - 7, rr(-30, 30)));
  var guard = 0;
  while (spots.length < CFG.PEARLS && guard++ < 3000) {
    var a = rnd() * TAU, d = 22 + Math.sqrt(rnd()) * (CFG.REEF_R - 26);
    var x = Math.cos(a) * d, z = Math.sin(a) * d;
    var y = floorHeight(x, z) + (rnd() < 0.25 ? rr(9, 20) : rr(1.6, 7));
    var v = new THREE.Vector3(x, y, z);
    if (far(v)) spots.push(v);
  }
  world.pearlSpots = spots;
}
/** Spawns the pearls (when the quest starts). */
function spawnPearls(n) {
  var sp = world.pearlSpots || [];
  for (var i = 0; i < Math.min(n, sp.length); i++) {
    addPickup('pearl', sp[i], { tag: 'pearls' });
  }
}

/* ---------- schools of fish ---------- */
function buildSchools() {
  var species = [
    { color: 0x2f7fe0, colorB: 0xa8ddff, w: 0.26, h: 0.62, n: 18, size: 0.55, swaySpeed: 9 },
    { color: 0xffcf3f, colorB: 0xfff3bd, w: 0.22, h: 0.68, n: 15, size: 0.5, swaySpeed: 10 },
    { color: 0xa9e6ff, colorB: 0xffffff, w: 0.24, h: 0.50, n: 22, size: 0.4, stripes: true, swaySpeed: 11 },
    { color: 0xff6fa8, colorB: 0xffd6e6, w: 0.28, h: 0.58, n: 13, size: 0.62, swaySpeed: 8.5 },
    { color: 0x6be0b0, colorB: 0xe6fff4, w: 0.25, h: 0.55, n: 16, size: 0.46, swaySpeed: 9.5 },
    { color: 0xffa03f, colorB: 0xffe3b0, w: 0.27, h: 0.60, n: 14, size: 0.52, stripes: true, swaySpeed: 9 },
    { color: 0x8f9dff, colorB: 0xe4e9ff, w: 0.23, h: 0.52, n: 18, size: 0.42, swaySpeed: 10.5 }
  ];
  for (var s = 0; s < species.length; s++) {
    var sp = species[s];
    var tmpl = buildSmallFish(sp);
    var school = {
      fish: [], t: rnd() * 100,
      radius: s < 3 ? rr(38, 88) : rr(13, 34), speed: rr(0.055, 0.11) * (rnd() < 0.5 ? 1 : -1),
      phase: rnd() * TAU, y: rr(5, 28), spread: rr(3.2, 6.5)
    };
    for (var i = 0; i < sp.n; i++) {
      var f = i === 0 ? tmpl : new THREE.Mesh(tmpl.geometry, tmpl.material);
      f.scale.setScalar(sp.size * rr(0.82, 1.18));
      f.userData.off = new THREE.Vector3(rr(-1, 1), rr(-0.5, 0.5), rr(-1, 1))
        .normalize().multiplyScalar(Math.pow(rnd(), 0.6) * school.spread);
      f.userData.ph = rnd() * TAU;
      f.userData.prev = new THREE.Vector3();
      f.userData.flee = new THREE.Vector3();
      castShadow(f);
      scene.add(f);
      school.fish.push(f);
    }
    world.schools.push(school);
  }
}

/* ---------- jellyfish ---------- */
function buildJellies() {
  for (var i = 0; i < CFG.JELLIES; i++) {
    var j = buildJellyfish();
    var a = rnd() * TAU, d = 25 + rnd() * (CFG.REEF_R - 34);
    var x = Math.cos(a) * d, z = Math.sin(a) * d;
    j.position.set(x, floorHeight(x, z) + rr(8, 26), z);
    j.scale.setScalar(rr(0.85, 1.5));
    j.userData.ph = rnd() * TAU;
    j.userData.drift = new THREE.Vector3(rr(-1, 1), 0, rr(-1, 1)).normalize().multiplyScalar(rr(0.5, 1.3));
    j.userData.y0 = j.position.y;
    scene.add(j);
    world.jellies.push(j);
  }
}

/* ---------- the passing turtle ---------- */
function buildTurtleActor() {
  var t = buildTurtle();
  t.scale.setScalar(2.6);
  t.userData.t = rnd() * 100;
  castShadow(t);
  scene.add(t);
  world.turtle = t;
}
