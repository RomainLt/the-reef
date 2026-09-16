/* The Reef — Landmarks dug into the reef
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* LIEUX REMARQUABLES                                                 */
/* ================================================================== */
// clear = radius to keep free of massifs around the place
var PLACES = {
  kelp:   { x: -58, z: 30, clear: 26, nameKey: 'place.kelp' },
  wreck:  { x: 54, z: 50, clear: 24, nameKey: 'place.wreck' },
  cave:   { x: -34, z: -62, clear: 22, nameKey: 'place.cave' },
  vents:  { x: 46, z: -20, clear: 18, nameKey: 'place.vents' },
  dropoff:{ x: 0, z: -88, clear: 30, nameKey: 'place.dropoff' }
};

/** Local light moods: each place pulls the colour of the water. */
var ZONES = [];
var ZBASE = {
  deep: new THREE.Color(PAL.deep), mid: new THREE.Color(PAL.mid),
  sky: new THREE.Color(PAL.sky), fog: CFG.FOG_FAR, caust: 1.0
};
var _zd = new THREE.Color(), _zm = new THREE.Color(), _zs = new THREE.Color();
function updateZones(dt) {
  _zd.copy(ZBASE.deep); _zm.copy(ZBASE.mid); _zs.copy(ZBASE.sky);
  var fog = ZBASE.fog, caust = ZBASE.caust;
  for (var i = 0; i < ZONES.length; i++) {
    var z = ZONES[i];
    var dx = player.pos.x - z.x, dz = player.pos.z - z.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    var w = 1 - smoothstep(z.r * 0.45, z.r, d);
    if (w <= 0.001) continue;
    _zd.lerp(z.deep, w); _zm.lerp(z.mid, w); _zs.lerp(z.sky, w);
    fog = lerp(fog, z.fog, w);
    caust = lerp(caust, z.caust, w);
  }
  var k = 1 - Math.exp(-1.6 * dt);
  U.uDeepCol.value.lerp(_zd, k);
  U.uMidCol.value.lerp(_zm, k);
  U.uSkyCol.value.lerp(_zs, k);
  U.uFogFar.value = damp(U.uFogFar.value, fog, 1.6, dt);
  U.uCaustics.value = damp(U.uCaustics.value, caust, 1.6, dt);
}
function addZone(x, z, r, deep, mid, sky, fog, caust) {
  ZONES.push({
    x: x, z: z, r: r,
    deep: new THREE.Color(deep), mid: new THREE.Color(mid), sky: new THREE.Color(sky),
    fog: fog, caust: caust
  });
}

function buildLandmarks(GEO, encrust, makePal, rockCol) {
  /* ---------------- the drop-off: cliff and open blue ---------------- */
  (function dropOff() {
    var P = PLACES.dropoff;
    beginBatch();
    var pal = makePal();
    // big boulders on the lip of the cliff
    for (var i = 0; i < 22; i++) {
      var a = DROP_ANG + rr(-0.72, 0.72);
      var d = 66 + rr(-6, 10);
      var x = Math.cos(a) * d, z = Math.sin(a) * d;
      var sc = rr(0.7, 1.7);
      put('hard', GEO.rock[1 + ((rnd() * 2) | 0)], TRS(x, floorHeight(x, z) - 1, z, 0, rnd() * TAU, 0, sc), rockCol());
      addCollider(x, floorHeight(x, z), z, 4.5 * sc);
      encrust(x, z, 0, 6 * sc, 8, pal, { onSand: true });
    }
    // giant sea fans turned into the current
    for (var g = 0; g < 14; g++) {
      var ga = DROP_ANG + rr(-0.6, 0.6), gd = 62 + rr(-8, 8);
      var gx = Math.cos(ga) * gd, gz = Math.sin(ga) * gd;
      put('soft', pick(GEO.fan), TRS(gx, floorHeight(gx, gz), gz, 0, ga + Math.PI / 2, 0, rr(1.8, 3.2)),
          pick(PAL.coral), rnd() * TAU);
    }
    endBatch();
    addZone(Math.cos(DROP_ANG) * 96, Math.sin(DROP_ANG) * 96, 66,
            0x05304a, 0x116a8a, 0x4fa8c4, 118, 0.55);
    world.places.dropoff = new THREE.Vector3(Math.cos(DROP_ANG) * 72, 6, Math.sin(DROP_ANG) * 72);
  })();

  /* ---------------- the kelp forest ---------------- */
  (function kelpForest() {
    var P = PLACES.kelp;
    beginBatch();
    var pal = makePal();
    var tall = [kelpGeo(901, 13), kelpGeo(902, 17), kelpGeo(903, 21)];
    for (var i = 0; i < 150; i++) {
      var a = rnd() * TAU, d = Math.sqrt(rnd()) * 22;
      var x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
      put('flat', pick(tall), TRS(x, floorHeight(x, z) - 0.3, z, 0, rnd() * TAU, 0, rr(0.8, 1.5)),
          pick(PAL.algae), rnd() * TAU);
    }
    for (var r2 = 0; r2 < 7; r2++) {                    // quelques rochers moussus
      var ra = rnd() * TAU, rd = rnd() * 20;
      var rx = P.x + Math.cos(ra) * rd, rz = P.z + Math.sin(ra) * rd;
      var rs = rr(0.6, 1.2);
      put('hard', GEO.rock[1], TRS(rx, floorHeight(rx, rz) - 1.2, rz, 0, rnd() * TAU, 0, rs), 0x6f7a5c);
      addCollider(rx, floorHeight(rx, rz), rz, 4.4 * rs);
      encrust(rx, rz, 0, 5, 6, pal, { onSand: true });
    }
    endBatch();
    addZone(P.x, P.z, 30, 0x0d4a52, 0x1f8a7a, 0x86e0b4, 92, 0.75);
    world.places.kelp = new THREE.Vector3(P.x, floorHeight(P.x, P.z) + 8, P.z);
  })();

  /* ---------------- the wreck ---------------- */
  (function wreck() {
    var P = PLACES.wreck;
    beginBatch();
    var by = floorHeight(P.x, P.z);
    var parts = [];
    // hull: a stretched sphere, pointed bow, flattened deck
    var hull = new THREE.SphereGeometry(1, 26, 16);
    var hp = hull.attributes.position, hv = new THREE.Vector3();
    for (var i = 0; i < hp.count; i++) {
      hv.fromBufferAttribute(hp, i);
      var t = (hv.z + 1) * 0.5;                          // 0 = poupe, 1 = proue
      var taper = t < 0.58 ? (0.72 + t * 0.48) : Math.pow(1 - (t - 0.58) / 0.42, 0.5);
      hp.setXYZ(i, hv.x * taper * 4.0, Math.min(hv.y, 0.40) * 3.2, hv.z * 12.5);
    }
    hull.computeVertexNormals();
    occByHeight(hull, -3.2, 1.2, 0.55);
    // bordage : planches horizontales
    (function planks(g2) {
      ensureAttrs(g2);
      var pa = g2.attributes.position, ca = g2.attributes.aColor;
      for (var q = 0; q < pa.count; q++) {
        var k = 0.86 + 0.24 * (Math.sin(pa.getY(q) * 5.5) * 0.5 + 0.5);
        ca.setXYZ(q, k, k, k);
      }
    })(hull);
    parts.push({ geo: hull, matrix: TRS(0, 2.8, 0, 0.12, 0, 0.30) });
    // pont
    var deck = new THREE.CylinderGeometry(3.2, 3.5, 0.45, 20, 1);
    deck.scale(1, 1, 3.2);
    parts.push({ geo: deck, matrix: TRS(0, 4.0, -0.6, 0.12, 0, 0.30) });
    // cabine
    var cab = new THREE.BoxGeometry(3.0, 2.2, 3.6);
    occByHeight(cab, -1.1, 1.1, 0.5);
    parts.push({ geo: cab, matrix: TRS(0.2, 5.4, -3.0, 0.12, 0, 0.30) });
    // broken mast
    var mast = new THREE.CylinderGeometry(0.22, 0.30, 9, 8, 1);
    parts.push({ geo: mast, matrix: TRS(-0.6, 8.4, 1.4, 0.45, 0, 0.5) });
    var mast2 = new THREE.CylinderGeometry(0.16, 0.22, 4.5, 7, 1);
    parts.push({ geo: mast2, matrix: TRS(3.4, 2.0, 3.0, 1.3, 0.6, 0.2) });
    var merged = mergeGeos(parts.map(function (q) { return { geo: q.geo, matrix: q.matrix, color: 0x9a8158 }; }));
    var wm = new THREE.Mesh(merged, REEF.hard.mat);
    wm.position.set(P.x, by - 1.2, P.z);
    wm.rotation.y = 0.7;
    wm.rotation.z = 0.22;
    wm.scale.setScalar(1.35);
    castShadow(wm);
    scene.add(wm);
    // rough collision along the hull
    for (var c = -1; c <= 1; c++) {
      addCollider(P.x + Math.sin(0.7) * c * 7, by + 2.6, P.z + Math.cos(0.7) * c * 7, 5.4);
    }
    addCollider(P.x + Math.sin(0.7) * -3.6, by + 5.6, P.z + Math.cos(0.7) * -3.6, 3.2);
    pushShadow(P.x, P.z, 17);
    // the wreck has been colonised
    var pal = makePal();
    for (var e = 0; e < 18; e++) {
      var ea = rnd() * TAU, ed = Math.sqrt(rnd()) * 6.5;
      encrust(P.x + Math.cos(ea) * ed, P.z + Math.sin(ea) * ed, by + rr(3.2, 5.2), 1.0, 1, pal, {});
    }
    encrust(P.x, P.z, 0, 14, 26, pal, { onSand: true, edge: true });
    endBatch();
    world.places.wreck = new THREE.Vector3(P.x, by + 6, P.z);
    addZone(P.x, P.z, 26, 0x0a4560, 0x24809c, 0x74cfd8, 130, 0.9);
  })();

  /* ---------------- the moray's cave ---------------- */
  (function cave() {
    var P = PLACES.cave;
    beginBatch();
    var by = floorHeight(P.x, P.z);
    // rock dome
    var dome = rockGeo(950, 9);
    put('hard', dome, TRS(P.x, by - 1.5, P.z, 0, 0.4, 0, 1.15, 1.0, 1.15), rockCol());
    // mouth of the cave: a ring plus a very dark interior
    var toC = new THREE.Vector3(-P.x, 0, -P.z).normalize();
    var mAng = Math.atan2(toC.x, toC.z);
    var mx = P.x + toC.x * 11.0, mz = P.z + toC.z * 11.0;
    var ring = new THREE.TorusGeometry(2.6, 1.15, 8, 18);
    put('hard', ring, TRS(mx, by + 3.4, mz, 0, mAng, 0, 1), tint(PAL.rock, 0.78));
    var back = new THREE.SphereGeometry(2.7, 14, 10);
    put('hard', back, TRS(P.x + toC.x * 8.0, by + 3.4, P.z + toC.z * 8.0, 0, 0, 0, 1), 0x0a1218);
    addCollider(P.x, by + 2, P.z, 9.8);
    pushShadow(P.x, P.z, 15);
    var pal = makePal();
    encrust(P.x, P.z, 0, 15, 26, pal, { onSand: true, edge: true });
    endBatch();
    var mouth = new THREE.Vector3(P.x + toC.x * 11.6, by + 3.4, P.z + toC.z * 11.6);
    world.places.cave = mouth.clone();
    // the moray pokes out of the hole
    var mor = buildMoray(1.5);
    mor.position.copy(mouth);
    mor.rotation.y = mAng;
    addCritter(mor, { kind: 'moray', update: updateMoray });
    world.npcs.moray = { obj: mor, id: 'moray', nameKey: 'npc.moray', kind: 'moray', noTalk: true };
    addZone(P.x, P.z, 24, 0x07283a, 0x145e78, 0x4f9cb0, 100, 0.6);
  })();

  /* ---------------- the anemone garden (home) ---------------- */
  (function garden() {
    beginBatch();
    var home = world.massifs[0];
    var hostGeo = hostAnemoneGeo(960, 2.6, 140);
    for (var i = 0; i < 5; i++) {
      var a = (i / 5) * TAU + 0.4;
      var d = home.size * 0.75;
      var x = home.x + Math.cos(a) * d, z = home.z + Math.sin(a) * d;
      var y = floorHeight(x, z);
      // barely tinted, so they are not five clones, without
      // flattening the baked gradient (see the note on the home anemone)
      put('soft', hostGeo, TRS(x, y, z, 0, rnd() * TAU, 0, rr(0.85, 1.18)),
          pick([0xffffff, 0xfceaff, 0xfff4e6, 0xffecf3]), rnd() * TAU);
      world.refuges.push(new THREE.Vector3(x, y + 2.2, z));
    }
    endBatch();
    world.places.garden = world.home.clone();
  })();

  /* ---------------- the bubble vents ---------------- */
  (function vents() {
    var P = PLACES.vents;
    beginBatch();
    var pal = makePal();
    for (var i = 0; i < 9; i++) {
      var a = rnd() * TAU, d = Math.sqrt(rnd()) * 9;
      var x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
      var y = floorHeight(x, z);
      var cone = new THREE.CylinderGeometry(0.5, 1.5, 1.6, 10, 1, true);
      put('hard', cone, TRS(x, y + 0.6, z, 0, rnd() * TAU, 0, rr(0.7, 1.4)), 0x8a8474);
      world.vents.push(new THREE.Vector3(x, y + 1.2, z));
    }
    encrust(P.x, P.z, 0, 13, 18, pal, { onSand: true });
    endBatch();
    world.places.vents = new THREE.Vector3(P.x, floorHeight(P.x, P.z) + 3, P.z);
  })();
}
