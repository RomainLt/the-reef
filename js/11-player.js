/* The Reef — The player fish and the chase camera
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* THE PLAYER AND THE CAMERA                                          */
/* ================================================================== */
var UP = new THREE.Vector3(0, 1, 0);
var player = {
  obj: null, pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(),
  stun: 0, dash: 0, flap: 0, turn: 0, quat: new THREE.Quaternion()
};
var cam = { yaw: 0, pitch: -0.10, dist: 5.8, pos: new THREE.Vector3(), look: new THREE.Vector3(), baseFov: 62 };
var keys = {}, mouseDX = 0, mouseDY = 0, dragging = false, locked = false;
var TOUCH = false;   // becomes true on the first touch: see goTouch()
var tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
var tmpD = new THREE.Vector3(), tmpE = new THREE.Vector3();
var tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion();

function camForward(out) {
  var cp = Math.cos(cam.pitch);
  return out.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp).normalize();
}

function buildPlayer() {
  player.obj = buildClownfish();
  player.obj.scale.setScalar(0.85);
  castShadow(player.obj);
  scene.add(player.obj);
  resetPlayer();
}
function resetPlayer() {
  var ox = SPAWN.x - world.home.x, oz = SPAWN.z - world.home.z;
  player.pos.set(SPAWN.x, world.home.y + 4.2, SPAWN.z);
  player.vel.set(0, 0, 0);
  player.stun = 0; player.dash = 0;
  player.lastYaw = undefined;
  cam.yaw = Math.atan2(-ox, -oz); cam.pitch = -0.13;
  camForward(tmpA);
  cam.pos.copy(player.pos).addScaledVector(tmpA, -cam.dist);
  player.obj.position.copy(player.pos);
}

function keyDown(codes) {
  for (var i = 0; i < codes.length; i++) if (keys[codes[i]]) return true;
  return false;
}

/** First ray/obstacle hit (sphere or disc). -1 if none. */
function rayHit(o, d, maxT, c) {
  var px = o.x - c.x, py = o.y - c.y, pz = o.z - c.z;
  if (c.h === undefined) {
    var er = c.r + 0.35;
    var b = px * d.x + py * d.y + pz * d.z;
    var q = px * px + py * py + pz * pz - er * er;
    var disc = b * b - q;
    if (disc <= 0) return -1;
    return -b - Math.sqrt(disc);
  }
  var r = c.r + 0.3, h = c.h + 0.3;
  var t0 = 0, t1 = maxT;
  var a = d.x * d.x + d.z * d.z;
  var bb = px * d.x + pz * d.z;
  var cc2 = px * px + pz * pz - r * r;
  if (a > 1e-8) {
    var dq = bb * bb - a * cc2;
    if (dq < 0) return -1;
    var sq = Math.sqrt(dq);
    t0 = Math.max(t0, (-bb - sq) / a);
    t1 = Math.min(t1, (-bb + sq) / a);
  } else if (cc2 > 0) return -1;
  if (Math.abs(d.y) > 1e-8) {
    var ta = (-h - py) / d.y, tb = (h - py) / d.y;
    if (ta > tb) { var sw = ta; ta = tb; tb = sw; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
  } else if (Math.abs(py) > h) return -1;
  if (t1 < t0 || t1 < 0) return -1;
  return t0;
}

function updatePlayer(dt) {
  var sens = 0.0026;
  cam.yaw -= mouseDX * sens;
  cam.pitch = clamp(cam.pitch - mouseDY * sens, -1.28, 1.05);
  mouseDX = 0; mouseDY = 0;

  var fwd = camForward(tmpA);
  var right = tmpB.crossVectors(fwd, UP).normalize();

  var inZ = (keyDown(['KeyW', 'KeyZ', 'ArrowUp']) ? 1 : 0) - (keyDown(['KeyS', 'ArrowDown']) ? 1 : 0);
  var inX = (keyDown(['KeyD', 'ArrowRight']) ? 1 : 0) - (keyDown(['KeyA', 'KeyQ', 'ArrowLeft']) ? 1 : 0);
  var inY = (keyDown(['Space']) ? 1 : 0) - (keyDown(['ControlLeft', 'ControlRight', 'KeyX', 'KeyC']) ? 1 : 0);
  var wantDash = keyDown(['ShiftLeft', 'ShiftRight']) && inZ > 0;

  if (player.stun > 0) { player.stun -= dt; inZ = inX = inY = 0; wantDash = false; }
  if (Q.dialog) { inZ = inX = inY = 0; wantDash = false; }

  player.dash = damp(player.dash, wantDash ? 1 : 0, wantDash ? 7 : 3.5, dt);

  var desired = tmpC.set(0, 0, 0)
    .addScaledVector(fwd, inZ)
    .addScaledVector(right, inX)
    .addScaledVector(UP, inY * 0.85);
  if (desired.lengthSq() > 1) desired.normalize();
  var speed = CFG.PLAYER_SPEED * (1 + player.dash * (CFG.DASH_MULT - 1));
  desired.multiplyScalar(speed);

  /* The current carries the player, but added to the **target** velocity
         rather than to the position: while swimming you compensate without
         thinking about it, at a standstill you drift with the water.
         Deliberately weak (~0.35 u/s against 15.5 of swimming). Zero inside an
         anemone — which is true physically, and above all the "stay hidden for
         8 s" quest has a 6.5 u radius: a constant drift would have made it fail
         without the player understanding why. */
  var flow = inRefuge() ? 0 : CFG.CURRENT;
  var accel = desired.lengthSq() > 0.01 ? 3.4 : 1.9;
  player.vel.x = damp(player.vel.x, desired.x + U.uCurrent.value.x * flow, accel, dt);
  player.vel.y = damp(player.vel.y, desired.y, accel, dt);
  player.vel.z = damp(player.vel.z, desired.z + U.uCurrent.value.y * flow, accel, dt);
  player.pos.addScaledVector(player.vel, dt);

  // --- obstacles: spheres (rocks, corals) and discs (shelves)
  // two passes: inside a dense massif the obstacles overlap
  for (var pass = 0; pass < 2; pass++)
  for (var i = 0; i < world.colliders.length; i++) {
    var c = world.colliders[i];
    var dx = player.pos.x - c.x, dy = player.pos.y - c.y, dz = player.pos.z - c.z;
    if (c.h === undefined) {
      var d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < c.r * c.r && d2 > 0.0001) {
        var d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d;
        var push = c.r - d;
        player.pos.x += nx * push; player.pos.y += ny * push; player.pos.z += nz * push;
        var vn = player.vel.x * nx + player.vel.y * ny + player.vel.z * nz;
        if (vn < 0) { player.vel.x -= vn * nx; player.vel.y -= vn * ny; player.vel.z -= vn * nz; }
      }
    } else {
      var dh = Math.sqrt(dx * dx + dz * dz);
      if (dh < c.r && Math.abs(dy) < c.h) {
        var overH = c.r - dh, overV = c.h - Math.abs(dy);
        if (overV <= overH || dh < 0.001) {
          var sg = dy >= 0 ? 1 : -1;
          player.pos.y += sg * overV;
          if (player.vel.y * sg < 0) player.vel.y = 0;
        } else {
          player.pos.x += dx / dh * overH; player.pos.z += dz / dh * overH;
          var vt = (player.vel.x * dx + player.vel.z * dz) / dh;
          if (vt < 0) { player.vel.x -= vt * dx / dh; player.vel.z -= vt * dz / dh; }
        }
      }
    }
  }
  // --- floor and surface
  var fy = floorHeight(player.pos.x, player.pos.z) + 1.0;
  if (player.pos.y < fy) { player.pos.y = fy; if (player.vel.y < 0) player.vel.y *= -0.15; }
  var maxY = CFG.WATER_Y - 1.4;
  if (player.pos.y > maxY) {
    player.pos.y = maxY;
    if (player.vel.y > 0) { player.vel.y *= -0.2; spawnFx(player.pos, 3, { speed: 1.4, size: 0.35 }); }
  }
  // --- edge of the reef: you are gently pulled back in
  var rad = Math.sqrt(player.pos.x * player.pos.x + player.pos.z * player.pos.z);
  if (rad > CFG.REEF_R) {
    var k = (rad - CFG.REEF_R) * 0.12;
    player.pos.x -= player.pos.x / rad * k;
    player.pos.z -= player.pos.z / rad * k;
    showHint(T('hint.edge'), 2.2);
  }

  // --- orientation: the fish follows its velocity, banks into turns
  var sp = player.vel.length();
  var dir = tmpA;
  if (sp > 0.8) dir.copy(player.vel).divideScalar(sp);
  else camForward(dir);
  /* A turn is read from the **lag** of a smoothed heading behind the real
         one. Before, it was `dYaw / dt`: a minute angle difference divided by a
         dt that varies from frame to frame, hence a signal that changed sign
         five times a second (measured). It drives the roll and the curve of the
         body — two places where noise shows. */
  var yawNow = Math.atan2(dir.x, dir.z);
  if (player.headYaw === undefined) player.headYaw = yawNow;
  var dYaw = yawNow - player.headYaw;
  while (dYaw > Math.PI) dYaw -= TAU;
  while (dYaw < -Math.PI) dYaw += TAU;
  player.headYaw += dYaw * (1 - Math.exp(-3.2 * dt));
  player.turn = damp(player.turn, clamp(dYaw * 1.6, -1, 1), 7, dt);

  var upv = tmpB.copy(UP).applyAxisAngle(dir, -player.turn * 0.85);
  tmpM.lookAt(dir, new THREE.Vector3(0, 0, 0), upv);
  tmpQ.setFromRotationMatrix(tmpM);
  player.obj.quaternion.slerp(tmpQ, 1 - Math.exp(-9 * dt));
  player.obj.position.copy(player.pos);

  // --- body animation
  /* Bounded rate: at full speed the old formula reached 5 beats per second,
         which reads as a tremor even with a clean phase. Swimming reads at about
         1.5–2 Hz, with more amplitude. */
  var beat = 2.8 + Math.min(sp, 16) * 0.52 + player.dash * 3.2;
  var anim = player.obj.userData.body.userData.anim;
  anim.uSwaySpeed.value = beat;
  anim.uSwayAmp.value = 0.062 + Math.min(sp, 20) * 0.0062 + player.dash * 0.035;
  anim.uBend.value = damp(anim.uBend.value, -player.turn * 0.16, 8, dt);
  player.flap += dt * (3 + sp * 0.5 + player.dash * 5);
  var pect = player.obj.userData.pect;
  pect[0].rotation.z = 0.2 + Math.sin(player.flap) * 0.55;
  pect[1].rotation.z = -0.2 - Math.sin(player.flap + 0.4) * 0.55;

  // --- bubbles when you sprint
  if (player.dash > 0.55 && rnd() < dt * 26) {
    tmpA.copy(player.pos).addScaledVector(dir, -1.1);
    spawnFx(tmpA, 1, { speed: 0.7, size: 0.16, life: rr(0.6, 1.1), grow: 1.2 });
  }

  // --- chase camera
  var fwd2 = camForward(tmpA);
  var side = tmpD.crossVectors(fwd2, UP).normalize();
  var want = tmpB.copy(player.pos).addScaledVector(fwd2, -cam.dist)
    .addScaledVector(UP, 0.85).addScaledVector(side, 0.95);
  // if an obstacle sits between fish and camera, shorten the boom
  tmpE.copy(want).sub(player.pos);
  var maxD = tmpE.length() || 1;
  tmpE.divideScalar(maxD);
  var allowed = maxD;
  for (var j = 0; j < world.colliders.length; j++) {
    var th = rayHit(player.pos, tmpE, allowed, world.colliders[j]);
    if (th > 0.35 && th < allowed) allowed = th;
  }
  want.copy(player.pos).addScaledVector(tmpE, Math.max(allowed, 1.7));
  var camFloor = floorHeight(want.x, want.z) + 1.4;
  if (want.y < camFloor) want.y = camFloor;
  if (want.y > CFG.WATER_Y - 0.6) want.y = CFG.WATER_Y - 0.6;
  var lambda = 9;
  cam.pos.x = damp(cam.pos.x, want.x, lambda, dt);
  cam.pos.y = damp(cam.pos.y, want.y, lambda, dt);
  cam.pos.z = damp(cam.pos.z, want.z, lambda, dt);
  camera.position.copy(cam.pos);
  cam.look.copy(player.pos).addScaledVector(camForward(tmpA), 3.4)
    .addScaledVector(tmpD, 0.62).addScaledVector(player.vel, 0.05);
  camera.lookAt(cam.look);
  var fov = cam.baseFov + player.dash * 7;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

/* ================================================================== */
/* UPDATING EVERYTHING ALIVE                                          */
/* ================================================================== */
function updateSchools(dt) {
  for (var s = 0; s < world.schools.length; s++) {
    var sc = world.schools[s];
    sc.t += dt;
    var a = sc.t * sc.speed + sc.phase;
    var cx = Math.cos(a) * sc.radius, cz = Math.sin(a) * sc.radius;
    var cy = sc.y + Math.sin(sc.t * 0.21 + sc.phase) * 5.0;
    var floorY = floorHeight(cx, cz) + 3.5;
    if (cy < floorY) cy = floorY;
    for (var i = 0; i < sc.fish.length; i++) {
      var f = sc.fish[i];
      var off = f.userData.off;
      var wob = Math.sin(U.uTime.value * 1.4 + f.userData.ph) * 0.7;
      tmpA.set(cx + off.x + wob, cy + off.y + wob * 0.3, cz + off.z - wob);
      // flee if the player comes close
      tmpB.copy(f.position).sub(player.pos);
      var d2 = tmpB.lengthSq();
      if (d2 < 90) {
        var d = Math.sqrt(d2) || 1;
        f.userData.flee.copy(tmpB).divideScalar(d).multiplyScalar((9.5 - d) * 1.5);
      }
      f.userData.flee.multiplyScalar(1 - Math.min(dt * 1.6, 1));
      tmpA.add(f.userData.flee);
      var k = 1 - Math.exp(-2.6 * dt);
      f.position.lerp(tmpA, k);
      tmpB.copy(f.position).sub(f.userData.prev);
      f.userData.prev.copy(f.position);
      if (tmpB.lengthSq() > 1e-6) {
        tmpC.copy(f.position).add(tmpB.multiplyScalar(30));
        f.lookAt(tmpC);
      }
    }
  }
}

function updateJellies(dt) {
  for (var i = 0; i < world.jellies.length; i++) {
    var j = world.jellies[i];
    var t = U.uTime.value * 0.9 + j.userData.ph;
    var pulse = Math.sin(t * 1.7);
    j.userData.bell.scale.set(1 + pulse * 0.10, 1 - pulse * 0.16, 1 + pulse * 0.10);
    j.position.addScaledVector(j.userData.drift, dt);
    j.position.y = j.userData.y0 + Math.sin(t * 1.7 - 0.6) * 1.5 + Math.sin(t * 0.3) * 2.2;
    var r = Math.sqrt(j.position.x * j.position.x + j.position.z * j.position.z);
    if (r > CFG.REEF_R - 8 || r < 12) j.userData.drift.multiplyScalar(-1);
    var fl = floorHeight(j.position.x, j.position.z) + 4;
    if (j.position.y < fl) { j.userData.y0 += (fl - j.position.y); }
    if (player.stun <= 0 && j.position.distanceToSquared(player.pos) < 7.5 * j.scale.x * j.scale.x) sting(j);
  }
}

function updateTurtle(dt) {
  var t = world.turtle;
  if (!t) return;
  t.userData.t += dt;
  var a = t.userData.t * 0.028;
  var R = 96;
  var x = Math.cos(a) * R, z = Math.sin(a) * R;
  var y = 24 + Math.sin(t.userData.t * 0.07) * 8;
  tmpA.set(x, y, z);
  tmpB.copy(tmpA).sub(t.position);
  t.position.copy(tmpA);
  if (tmpB.lengthSq() > 1e-6) t.lookAt(tmpC.copy(tmpA).add(tmpB.multiplyScalar(40)));
  var fl = t.userData.flippers, ph = t.userData.t * 1.5;
  for (var i = 0; i < fl.length; i++) {
    var s = i % 2 === 0 ? 1 : -1;
    fl[i].rotation.z = (i < 2 ? Math.sin(ph) * 0.5 : Math.sin(ph + 0.7) * 0.25) * s + 0.1 * s;
    fl[i].rotation.x = Math.cos(ph + i) * 0.18;
  }
}
