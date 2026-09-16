/* The Reef — How each animal behaves
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* REEF LIFE: behaviours                                              */
/* ================================================================== */
var ZERO = new THREE.Vector3();
var tmpF = new THREE.Vector3(), tmpG = new THREE.Vector3();

function faceDir(obj, dir, dt, lambda) {
  if (dir.lengthSq() < 1e-7) return;
  tmpF.copy(dir).normalize();
  tmpM.lookAt(tmpF, ZERO, UP);
  tmpQ.setFromRotationMatrix(tmpM);
  obj.quaternion.slerp(tmpQ, 1 - Math.exp(-(lambda || 3) * dt));
}
function addCritter(obj, def) {
  def.obj = obj;
  def.t = rnd() * 100;
  if (def.phase === undefined) def.phase = rnd() * TAU;
  if (def.cast !== false) castShadow(obj);
  scene.add(obj);
  world.critters.push(def);
  return def;
}
function updateCritters(dt) {
  for (var i = 0; i < world.critters.length; i++) {
    var c = world.critters[i];
    c.t += dt;
    if (c.update) c.update(c, dt);
  }
}
/** Beats the pectoral fins, if the model has any. */
function flapPect(obj, t, amp) {
  var p = obj.userData.pect;
  if (!p) return;
  p[0].rotation.z = 0.15 + Math.sin(t) * (amp || 0.45);
  p[1].rotation.z = -0.15 - Math.sin(t + 0.4) * (amp || 0.45);
}
/** Is the player sheltering inside an anemone? */
function inRefuge() {
  for (var i = 0; i < world.refuges.length; i++) {
    if (world.refuges[i].distanceToSquared(player.pos) < 42) return true;
  }
  return false;
}

/* ---------- sharks: patrol, then charge if you expose yourself ---------- */
function updateShark(c, dt) {
  var pos = c.obj.position;
  var dp = pos.distanceTo(player.pos);
  if (c.alert > 0) c.alert -= dt;
  if (c.cool > 0) c.cool -= dt;

  /* The anemone CUTS the chase off, it does not merely stop you being
         spotted. That was the bug: `inRefuge()` only guarded acquisition, so once
         `alert` was set to 3.4 s the shark kept charging and could ram a player
         who had taken shelter. Worse, while you were out in the open the alert
         was reset to 3.4 s every frame — entering the anemone only started a
         three-and-a-half second countdown, during which you got hit. Hiding did,
         literally, nothing. */
  var safe = inRefuge();
  if (safe) {
    if (c.alert > 0 && G.safeT <= 0) {
      // without this feedback, nothing tells the player it worked
      G.safeT = 3.5;
      showHint(T('hint.lostYou'), 2.8);
      SND.safe();
    }
    c.alert = 0;
    c.cool = 1.5;          // and a grace period on the way out: never punishing
  } else if (G.state === 'play' && dp < c.senseR && c.cool <= 0) {
    if (c.alert <= 0) { SND.growl(); showHint(T('hint.spotted'), 3.5); }
    c.alert = 3.4;
  }

  if (c.alert > 0 && G.state === 'play') {
    tmpA.copy(player.pos).sub(pos);
    var dist = tmpA.length() || 1;
    tmpA.divideScalar(dist);
    pos.addScaledVector(tmpA, dt * c.chase);
    faceDir(c.obj, tmpA, dt, 2.0);
    c.obj.userData.body.userData.anim.uSwaySpeed.value = 5.2;
    if (dist < 3.6 && player.stun <= 0) { sharkBump(c); c.alert = 0; c.cool = 9; }
  } else {
    var a = c.t * c.speed + c.phase;
    var x = c.cx + Math.cos(a) * c.r, z = c.cz + Math.sin(a) * c.r;
    var y = c.y + Math.sin(c.t * 0.23 + c.phase) * 6;
    tmpA.set(x, y, z);
    tmpB.copy(tmpA).sub(pos);
    /* Back to the orbit by swimming, not by jumping. The old `pos.copy(tmpA)`
             teleported the shark onto its circle the moment the chase ended; that
             went almost unnoticed when the alert expired by itself far away, but
             the anemone cuts the chase at point-blank range — it would have
             evaporated under the player's nose.

             A **bounded** speed rather than exponential smoothing: an interpolation
             towards a patrol point 92 u away always starts fast, whatever its time
             constant — measured at 26 u in 50 ms, a jump barely spread out. Here it
             swims at ~7 u/s, takes a dozen seconds to reach open water, and once
             there it tracks the orbit as before (the circle moves at 4.6 u/s, so it
             always catches up). */
    var far = tmpB.length();
    var step = dt * c.chase * 0.55;
    if (far > step) pos.addScaledVector(tmpB, step / far);
    else pos.copy(tmpA);
    faceDir(c.obj, tmpB, dt, 2.2);
    // the further it is from its orbit, the harder it beats its tail
    c.obj.userData.body.userData.anim.uSwaySpeed.value = 2.4 + clamp(far / 22, 0, 1) * 1.8;
  }
  var fl = floorHeight(pos.x, pos.z) + 3;
  if (pos.y < fl) pos.y = fl;
  // atmosphere: the closer it is, the redder the water — but under cover it
  // drains away, and that is the clearest signal that hiding works
  var menace = safe ? 0 : clamp(1 - (dp - 12) / 26, 0, 1);
  if (menace > c.menace) c.menace = menace; else c.menace = damp(c.menace, menace, 2, dt);
  if (c.menace > world.menace) world.menace = c.menace;
}

/* ---------- ray: glides in very slow circles ---------- */
function updateRay(c, dt) {
  var a = c.t * 0.055 + c.phase;
  var x = Math.cos(a) * c.r, z = Math.sin(a) * c.r;
  var y = c.y + Math.sin(c.t * 0.13) * 5;
  tmpA.set(x, y, z);
  tmpB.copy(tmpA).sub(c.obj.position);
  c.obj.position.copy(tmpA);
  faceDir(c.obj, tmpB, dt, 1.6);
}

/* ---------- tortues ---------- */
function updateTurtleCritter(c, dt) {
  var a = c.t * c.speed + c.phase;
  tmpA.set(Math.cos(a) * c.r + c.cx, c.y + Math.sin(c.t * 0.09) * 4, Math.sin(a) * c.r + c.cz);
  if (c.follow) {                                  // escort: he follows the player
    tmpG.copy(player.pos).sub(c.obj.position);
    var d = tmpG.length();
    if (d > c.followD) {
      tmpG.divideScalar(d);
      tmpA.copy(c.obj.position).addScaledVector(tmpG, Math.min(d - c.followD, 1) * dt * c.followSpeed * 6);
    } else tmpA.copy(c.obj.position);
    tmpA.y += Math.sin(c.t * 1.2) * dt * 0.6;
  }
  tmpB.copy(tmpA).sub(c.obj.position);
  c.obj.position.copy(tmpA);
  if (tmpB.lengthSq() > 1e-6) faceDir(c.obj, tmpB, dt, 2.5);
  var fl = floorHeight(c.obj.position.x, c.obj.position.z) + 1.6;
  if (c.obj.position.y < fl) c.obj.position.y = fl;
  var fls = c.obj.userData.flippers, ph = c.t * (c.follow ? 3.4 : 1.5);
  for (var i = 0; i < fls.length; i++) {
    var sg = i % 2 === 0 ? 1 : -1;
    fls[i].rotation.z = (i < 2 ? Math.sin(ph) * 0.5 : Math.sin(ph + 0.7) * 0.25) * sg + 0.1 * sg;
    fls[i].rotation.x = Math.cos(ph + i) * 0.18;
  }
}

/* ---------- NPCs drifting near their anchor point ---------- */
function updateNpc(c, dt) {
  var a = c.t * (c.orbit || 0.5) + c.phase;
  tmpA.set(c.anchor.x + Math.cos(a) * (c.r || 1.6),
           c.anchor.y + Math.sin(a * 0.8) * (c.bob || 0.5),
           c.anchor.z + Math.sin(a) * (c.r || 1.6));
  tmpB.copy(tmpA).sub(c.obj.position);
  c.obj.position.copy(tmpA);
  var dp = c.obj.position.distanceTo(player.pos);
  if (dp < 11) { tmpB.copy(player.pos).sub(c.obj.position); tmpB.y *= 0.5; }
  faceDir(c.obj, tmpB, dt, 3);
  flapPect(c.obj, c.t * 7, 0.45);
  if (c.extra) c.extra(c, dt, dp);
}

/* ---------- pufferfish: puffs up ---------- */
function puffExtra(c, dt, dp) {
  var want = dp < 7 ? 1 : 0;
  c.puff = damp(c.puff === undefined ? 0 : c.puff, want, want ? 6 : 2, dt);
  var s = c.baseScale * (1 + c.puff * 0.55);
  c.obj.scale.setScalar(s);
  c.obj.userData.spikes.scale.setScalar(1 + c.puff * 0.35);
}

/* ---------- octopus: ducks into its hole ---------- */
function octoExtra(c, dt, dp) {
  var hide = dp < 4.5 ? 1 : 0;
  c.hide = damp(c.hide === undefined ? 0 : c.hide, hide, hide ? 3.5 : 1.2, dt);
  c.obj.position.y = c.anchor.y - c.hide * 0.35;
  c.obj.userData.arms.userData.anim.uSwayAmp.value = 0.30 + c.hide * 0.5;
  c.obj.userData.body.material.uniforms.uColor.value.setHex(c.hide > 0.5 ? 0x8f6f9c : 0xc4628f);
}

/* ---------- crab: scuttles over the sand and bolts ---------- */
function updateCrab(c, dt) {
  var pos = c.obj.position;
  var dp = pos.distanceTo(player.pos);
  if (dp < 7) {                                     // it bolts
    tmpA.copy(pos).sub(player.pos).setY(0).normalize();
    c.dir.lerp(tmpA, 1 - Math.exp(-6 * dt));
    c.speed = damp(c.speed, 6.5, 6, dt);
  } else {
    if (c.turnT === undefined || c.t > c.turnT) {
      c.turnT = c.t + rr(2, 6);
      var a = rnd() * TAU;
      c.target = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    }
    c.dir.lerp(c.target, 1 - Math.exp(-1.5 * dt));
    c.speed = damp(c.speed, 1.4, 2, dt);
  }
  pos.addScaledVector(c.dir, c.speed * dt);
  var rad = Math.sqrt((pos.x - c.cx) * (pos.x - c.cx) + (pos.z - c.cz) * (pos.z - c.cz));
  if (rad > c.range) {                              // it stays in its corner
    tmpA.set(c.cx - pos.x, 0, c.cz - pos.z).normalize();
    c.dir.lerp(tmpA, 0.25);
    c.target = tmpA.clone();
  }
  pos.y = floorHeight(pos.x, pos.z) + 0.05;
  c.obj.rotation.y = Math.atan2(c.dir.x, c.dir.z) + Math.PI * 0.5;   // it walks sideways
  c.obj.position.y += Math.abs(Math.sin(c.t * c.speed * 3)) * 0.06;
}

/* ---------- garden eels ---------- */
function updateEels(c, dt) {
  var eels = c.obj.userData.eels;
  for (var i = 0; i < eels.length; i++) {
    var e = eels[i];
    var d = e.position.distanceTo(player.pos);
    var want = d < 9 ? 0.06 : 1;
    e.userData.out = damp(e.userData.out, want, want < 0.5 ? 7 : 1.6, dt);
    e.scale.y = e.userData.out;
  }
}

/* ---------- giant clam ---------- */
function updateClam(c, dt) {
  var dp = c.obj.position.distanceTo(player.pos);
  var open = dp < 5 ? 0.06 : (0.55 + Math.sin(c.t * 0.5 + c.phase) * 0.35);
  c.open = damp(c.open === undefined ? 0.5 : c.open, open, dp < 5 ? 8 : 1.2, dt);
  c.obj.userData.top.rotation.x = -c.open * 0.75;
  c.obj.userData.top.position.y = 0.04 + c.open * 0.10;
  c.obj.userData.mantle.material.uniforms.uEmissive.value = 0.05 + c.open * 0.2;
}

/* ---------- moray ---------- */
function updateMoray(c, dt) {
  var dp = c.obj.position.distanceTo(player.pos);
  var open = dp < 9 ? 0.8 + Math.sin(c.t * 5) * 0.2 : 0.25 + Math.sin(c.t * 0.8) * 0.2;
  c.open = damp(c.open === undefined ? 0.3 : c.open, open, 6, dt);
  c.obj.userData.jaw.rotation.x = Math.PI - c.open * 0.5;
  c.obj.userData.body.userData.anim.uSwaySpeed.value = dp < 9 ? 3.2 : 1.2;
  if (dp < 3.2 && player.stun <= 0 && G.state === 'play') {
    moraySnap(c);
  }
}

/* ---------- whale: it crosses the open blue, far away ---------- */
function updateWhale(c, dt) {
  if (c.wait > 0) {
    c.wait -= dt;
    c.obj.visible = false;
    return;
  }
  c.obj.visible = true;
  c.prog += dt * 0.012;
  if (c.prog > 1) { c.prog = 0; c.wait = rr(70, 140); c.phase = rnd() * TAU; return; }
  var a = c.phase, span = 460;
  var t = (c.prog - 0.5) * span;
  tmpA.set(Math.cos(a) * 190 - Math.sin(a) * t, c.y + Math.sin(c.prog * 3.1) * 8, Math.sin(a) * 190 + Math.cos(a) * t);
  tmpB.copy(tmpA).sub(c.obj.position);
  c.obj.position.copy(tmpA);
  faceDir(c.obj, tmpB, dt, 1.2);
  if (c.prog > 0.42 && c.prog < 0.46 && !c.called) { c.called = true; SND.whale(); }
  if (c.prog < 0.3) c.called = false;
}
