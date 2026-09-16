/* The Reef — Placing the inhabitants
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* POPULATING THE REEF                                                */
/* ================================================================== */
function npcAnchor(i, dy) {
  var M = world.massifs;
  var m = M[(i % Math.max(M.length - 1, 1)) + 1] || M[0];
  return new THREE.Vector3(m.top.x, m.top.y + (dy === undefined ? 2.6 : dy), m.top.z);
}

function populateReef() {
  var M = world.massifs;

  /* ---- predators ---- */
  addCritter(buildShark(5.2), {
    kind: 'shark', update: updateShark, cx: 0, cz: 0, r: 92, y: 20,
    speed: 0.05, senseR: 25, chase: 13, alert: 0, cool: 0, menace: 0
  });
  addCritter(buildHammerhead(4.4), {
    kind: 'shark', update: updateShark, cx: 0, cz: 0, r: 116, y: 29,
    speed: -0.038, senseR: 17, chase: 11, alert: 0, cool: 0, menace: 0
  });

  /* ---- the ray gliding above the reef ---- */
  addCritter(buildRay(3.4), { kind: 'ray', update: updateRay, r: 56, y: 33 });

  /* ---- tortue adulte ---- */
  var t1 = buildTurtle();
  t1.scale.setScalar(2.3);
  world.turtleAdult = addCritter(t1, {
    kind: 'turtle', update: updateTurtleCritter,
    cx: 26, cz: -44, r: 30, y: 24, speed: 0.045
  });

  /* ---- the whale, far away ---- */
  addCritter(buildWhale(), { kind: 'whale', update: updateWhale, y: 32, prog: 0, wait: 25, cast: false });

  /* ---- the inhabitants (NPCs) ---- */
  function npc(id, obj, anchor, opt) {
    opt = opt || {};
    var c = addCritter(obj, {
      kind: 'npc', id: id, update: updateNpc, anchor: anchor,
      r: opt.r !== undefined ? opt.r : 1.6, bob: opt.bob, orbit: opt.orbit,
      extra: opt.extra, baseScale: obj.scale.x
    });
    obj.position.copy(anchor);
    c.nameKey = opt.nameKey;
    world.npcs[id] = c;
    return c;
  }

  npc('tang', buildBlueTang(1.15), npcAnchor(0, 3.2), { nameKey: 'npc.tang', r: 2.2, orbit: 0.55 });
  npc('puffer', buildPufferfish(1.25), npcAnchor(1, 2.4), { nameKey: 'npc.puffer', r: 1.2, orbit: 0.35, extra: puffExtra });
  npc('idol', buildMoorishIdol(1.05), npcAnchor(2, 3.0), { nameKey: 'npc.idol', r: 2.0, orbit: 0.45 });
  npc('seahorse', buildSeahorse(1.7), npcAnchor(3, 1.6), { nameKey: 'npc.seahorse', r: 0.8, orbit: 0.25, bob: 0.8 });
  npc('shrimp', buildShrimp(1.7), npcAnchor(4, 1.2), { nameKey: 'npc.shrimp', r: 0.9, orbit: 0.4 });
  npc('star', buildStarfishNPC(2.2), npcAnchor(5, 0.35), { nameKey: 'npc.star', r: 0.05, orbit: 0.1, bob: 0.05 });

  // a census-taking crab, on the sand near home
  var hm = M[0];
  var crx = hm.x + 13, crz = hm.z + 15;
  var crabN = buildCrab(1.15);
  var crAnchor = new THREE.Vector3(crx, floorHeight(crx, crz) + 0.1, crz);
  npc('crab', crabN, crAnchor, {
    nameKey: 'npc.crab', r: 1.1, orbit: 0.3, bob: 0.02,
    extra: function (c) { c.obj.position.y = floorHeight(c.obj.position.x, c.obj.position.z) + 0.05; }
  });

  // the octopus lives in a hole at the foot of a massif
  var om = M[7] || M[1];
  var ox = om.x + 9, oz = om.z + 7;
  var oct = buildOctopus(2.1);
  var oAnchor = new THREE.Vector3(ox, floorHeight(ox, oz) + 0.5, oz);
  npc('octopus', oct, oAnchor, { nameKey: 'npc.octopus', r: 0.3, orbit: 0.15, extra: octoExtra });

  /* ---- faune d'ambiance ---- */
  for (var i = 0; i < 4; i++) {
    var mm = M[2 + i * 3] || M[1];
    var cx = mm.x + rr(-14, 14), cz = mm.z + rr(-14, 14);
    var crab = buildCrab(rr(0.55, 0.85));
    crab.position.set(cx, floorHeight(cx, cz), cz);
    addCritter(crab, {
      kind: 'crab', update: updateCrab, cx: cx, cz: cz, range: 12,
      dir: new THREE.Vector3(1, 0, 0), target: new THREE.Vector3(1, 0, 0), speed: 1.2
    });
  }
  for (var e = 0; e < 3; e++) {
    var ea = rnd() * TAU, ed = 30 + rnd() * 55;
    var ex = Math.cos(ea) * ed, ez = Math.sin(ea) * ed;
    var col = buildGardenEels(14 + ((rnd() * 10) | 0), 4.5);
    col.position.set(ex, 0, ez);
    col.children.forEach(function (m) {
      m.position.x += ex; m.position.z += ez;
      m.position.y = floorHeight(m.position.x, m.position.z);
    });
    col.position.set(0, 0, 0);
    addCritter(col, { kind: 'eels', update: updateEels, cast: false });
  }
  for (var cl = 0; cl < 7; cl++) {
    var m2 = M[1 + ((rnd() * (M.length - 1)) | 0)];
    var clam = buildClam(rr(0.8, 1.5));
    var ca = rnd() * TAU, cd = rnd() * m2.top.r * 0.7;
    clam.position.set(m2.top.x + Math.cos(ca) * cd, m2.top.y + 0.1, m2.top.z + Math.sin(ca) * cd);
    addCritter(clam, { kind: 'clam', update: updateClam });
  }
}

/* ---------- reactions to predators ---------- */
function sharkBump(c) {
  player.stun = 1.1;
  flashSting = 1;
  tmpA.copy(player.pos).sub(c.obj.position).normalize();
  player.vel.copy(tmpA).multiplyScalar(26);
  player.pos.addScaledVector(tmpA, 1.2);
  SND.growl();
  showToast('Oh oh !');
  showHint(T('hint.sharkBump'), 4.5);
  spawnFx(player.pos, 12, { speed: 2.4, size: 0.42, life: 0.8, grow: 2.2 });
  elFlash.style.opacity = '0.9';
  setTimeout(function () { elFlash.style.opacity = '0'; }, 220);
  G.time += 4;
}
function moraySnap(c) {
  player.stun = 0.7;
  flashSting = 0.8;
  tmpA.copy(player.pos).sub(c.obj.position).normalize();
  player.vel.copy(tmpA).multiplyScalar(18);
  SND.sting();
  showToast(T('hint.ouch'));
  showHint(T('hint.moray'), 3);
  G.time += 2;
}

/* ---------- small effects: bubbles, sparks ---------- */
var fx = [];
function initFx() {
  for (var i = 0; i < 60; i++) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX.bubble, transparent: true, depthWrite: false, opacity: 0
    }));
    sp.visible = false;
    scene.add(sp);
    fx.push({ sp: sp, life: 0, max: 1, vel: new THREE.Vector3(), s0: 1, s1: 1 });
  }
}
function spawnFx(pos, count, opt) {
  opt = opt || {};
  var made = 0;
  for (var i = 0; i < fx.length && made < count; i++) {
    var f = fx[i];
    if (f.life > 0) continue;
    made++;
    f.sp.position.copy(pos).add(new THREE.Vector3(rr(-0.4, 0.4), rr(-0.3, 0.3), rr(-0.4, 0.4)).multiplyScalar(opt.spread || 1));
    f.vel.set(rr(-1, 1), rr(0.8, 2.6), rr(-1, 1)).multiplyScalar(opt.speed || 1);
    f.max = opt.life || rr(0.9, 1.8);
    f.life = f.max;
    f.s0 = (opt.size || 0.3) * rr(0.6, 1.4);
    f.s1 = f.s0 * (opt.grow || 1.4);
    f.sp.material.map = opt.soft ? TEX.soft : TEX.bubble;
    f.sp.material.color.set(opt.color !== undefined ? opt.color : 0xffffff);
    f.sp.material.blending = opt.soft ? THREE.AdditiveBlending : THREE.NormalBlending;
    f.sp.visible = true;
  }
}
function updateFx(dt) {
  for (var i = 0; i < fx.length; i++) {
    var f = fx[i];
    if (f.life <= 0) continue;
    f.life -= dt;
    if (f.life <= 0) { f.sp.visible = false; f.sp.material.opacity = 0; continue; }
    var k = 1 - f.life / f.max;
    f.vel.y += dt * 1.2;
    f.vel.x *= (1 - dt * 1.2); f.vel.z *= (1 - dt * 1.2);
    f.sp.position.addScaledVector(f.vel, dt);
    var sc = lerp(f.s0, f.s1, k);
    f.sp.scale.set(sc, sc, sc);
    f.sp.material.opacity = Math.sin((1 - k) * Math.PI * 0.85) * 0.95;
  }
}
