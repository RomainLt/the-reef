/* The Reef — On-screen interface and collectables
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* INTERFACE                                                          */
/* ================================================================== */
var elHud = $('#hud'), elPearls = $('#pearls b'), elClock = $('#clock'), elDepth = $('#depth');
var elArrow = $('#arrow'), elHint = $('#hint'), elToast = $('#toast'), elFlash = $('#vignette-flash');
var G = { state: 'title', pearls: 0, time: 0, hintT: 0, toastT: 0, bubbleT: 0,
          /* Stops "he has lost sight of you" repeating: the shelter radius is a
                         sphere, and hovering on its edge would take you in and out several
                         times a second. */
          safeT: 0 };

function showHint(txt, dur) {
  if (elHint.textContent !== txt) elHint.textContent = txt;
  elHint.classList.remove('hide');
  G.hintT = dur || 4;
}
function showToast(txt) {
  elToast.textContent = txt;
  elToast.classList.add('pop');
  G.toastT = 1.1;
}
function updateHud(dt) {
  if (G.hintT > 0) { G.hintT -= dt; if (G.hintT <= 0) elHint.classList.add('hide'); }
  if (G.toastT > 0) { G.toastT -= dt; if (G.toastT <= 0) elToast.classList.remove('pop'); }
  var t = G.time | 0;
  elClock.textContent = ((t / 60) | 0) + ':' + ('0' + (t % 60)).slice(-2);
  elDepth.textContent = '-' + Math.max(0, Math.round((CFG.WATER_Y - player.pos.y) * 0.35)) + ' m';

  // arrow towards the current objective
  var best = arrowTarget();
  if (!best) { elArrow.style.opacity = 0; return; }
  tmpA.copy(best);
  camera.getWorldDirection(tmpB);
  tmpC.copy(tmpA).sub(camera.position);
  var behind = tmpC.dot(tmpB) < 0;
  tmpA.project(camera);
  var sx = tmpA.x, sy = tmpA.y;
  var onScreen = !behind && Math.abs(sx) < 0.82 && Math.abs(sy) < 0.82;
  if (onScreen) { elArrow.style.opacity = 0; return; }
  var dx = sx, dy = sy;
  if (behind) { dx = -dx; dy = -dy; }
  var len = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= len; dy /= len;
  var rx = Math.min(W, H) * 0.30;
  var px = W * 0.5 + dx * rx, py = H * 0.5 - dy * rx;
  var ang = Math.atan2(dx, dy) * 180 / Math.PI;
  elArrow.style.transform = 'translate(' + (px - W * 0.5) + 'px,' + (py - H * 0.5) + 'px) rotate(' + ang + 'deg)';
  elArrow.style.opacity = 0.9;
}


/* ================================================================== */
/* COLLECTABLES                                                       */
/* ================================================================== */
function shellGeo(seed) {
  var g = new THREE.SphereGeometry(0.42, 16, 10, 0, TAU, 0, Math.PI * 0.55);
  var p = g.attributes.position, v = new THREE.Vector3();
  for (var i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    var a = Math.atan2(v.z, v.x);
    var rid = 1 + Math.cos(a * 9) * 0.10;
    p.setXYZ(i, v.x * rid * 1.1, v.y * 0.42, v.z * rid);
  }
  g.computeVertexNormals();
  occByHeight(g, 0, 0.2, 0.5);
  return g;
}

/** Objet ramassable : flotte, tourne, halo. */
function buildPickup(kind) {
  var g = new THREE.Group();
  var core, halo = 0xbff0ff;
  if (kind === 'shell') {
    core = toonMesh(shellGeo(1), {
      color: 0xffd9c0, colorB: 0xff9ec0,
      baseHook: '  base = mix(base, uColorB, smoothstep(-0.1, 0.2, vObj.y));\n  emis += 0.25;',
      spec: 0.7, rim: 0.7, bump: 0.4
    });
    halo = 0xffd0c0;
  } else if (kind === 'urchin') {
    core = toonMesh(urchinGeo(7), { color: 0x6b4fa8, colorB: 0xc0a8ff, spec: 0.4, rim: 0.5, emissive: 0.10 });
    halo = 0xc0a8ff;
  } else if (kind === 'treasure') {
    core = toonMesh(new THREE.SphereGeometry(0.56, 18, 13), {
      color: 0xffe9a8, colorB: 0xffb840,
      baseHook: '  base = mix(base, uColorB, smoothstep(0.2, -0.4, vObj.y));\n  emis += 0.9;',
      spec: 2.2, rim: 1.0, emissive: 0.9
    });
    halo = 0xffd88a;
  } else if (kind === 'blackpearl') {
    core = toonMesh(new THREE.SphereGeometry(0.44, 16, 12), {
      color: 0x6a5fa8, colorB: 0xd0c8ff,
      baseHook: '  base = mix(base, uColorB, pow(1.0 - max(dot(normalize(vN), normalize(cameraPosition-vWP)),0.0), 2.0));\n  emis += 0.5;',
      spec: 2.4, rim: 1.2, emissive: 0.5
    });
    halo = 0xb0a0ff;
  } else {
    core = toonMesh(new THREE.SphereGeometry(0.42, 16, 12), {
      color: 0xfff8ee, colorB: 0x9fe2ff,
      baseHook: '  base = mix(base, uColorB, smoothstep(0.15, -0.4, vObj.y));\n  emis += 0.5*pow(max(vObj.y*2.0, 0.0), 2.0);',
      rim: 1.0, spec: 2.0, emissive: 1.05
    });
  }
  g.add(core);
  var hl = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX.soft, color: halo, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9
  }));
  hl.scale.setScalar(kind === 'urchin' ? 2.0 : 3.0);
  g.add(hl);
  g.userData.core = core;
  g.userData.halo = hl;
  return g;
}

/** Is this point clear of every obstacle? */
function isClear(v, pad) {
  pad = pad || 1.2;
  for (var i = 0; i < world.colliders.length; i++) {
    var c = world.colliders[i];
    var dx = v.x - c.x, dy = v.y - c.y, dz = v.z - c.z;
    if (c.h === undefined) {
      if (dx * dx + dy * dy + dz * dz < (c.r + pad) * (c.r + pad)) return false;
    } else if (dx * dx + dz * dz < (c.r + pad) * (c.r + pad) && Math.abs(dy) < c.h + pad) return false;
  }
  return true;
}
/** Looks for a clear point around a centre (failing that, higher up). */
function clearSpot(cx, cz, y, spread, pad) {
  for (var k = 0; k < 50; k++) {
    var a = rnd() * TAU, d = Math.sqrt(rnd()) * spread;
    var x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    var v = new THREE.Vector3(x, y === null ? floorHeight(x, z) + rr(1.3, 3.2) : y, z);
    if (isClear(v, pad)) return v;
  }
  return new THREE.Vector3(cx, y === null ? floorHeight(cx, cz) + 6 : y + 4, cz);
}

function addPickup(kind, pos, opt) {
  opt = opt || {};
  var o = buildPickup(kind);
  o.position.copy(pos);
  o.userData.base = pos.clone();
  o.userData.phase = rnd() * TAU;
  o.userData.kind = kind;
  o.userData.tag = opt.tag;
  o.userData.taken = false;
  o.userData.radius = opt.radius || 2.1;
  scene.add(o);
  world.pickups.push(o);
  return o;
}

function updatePickups(dt) {
  var t = U.uTime.value;
  for (var i = 0; i < world.pickups.length; i++) {
    var o = world.pickups[i];
    if (o.userData.taken) {
      if (o.userData.pushT > 0) {                    // the pushed urchin rolls across the sand
        o.userData.pushT -= dt;
        o.position.addScaledVector(o.userData.push, dt);
        o.userData.push.multiplyScalar(1 - dt * 1.6);
        o.position.y = damp(o.position.y, floorHeight(o.position.x, o.position.z) + 0.35, 3, dt);
        o.rotation.x += dt * 4;
        if (o.userData.pushT <= 0) o.visible = false;
      }
      continue;
    }
    var k = o.userData.kind;
    if (k !== 'urchin') {
      o.position.y = o.userData.base.y + Math.sin(t * 1.3 + o.userData.phase) * 0.30;
      o.rotation.y += dt * 0.9;
    }
    var hs = (k === 'urchin' ? 2.0 : 3.0) + Math.sin(t * 2.2 + o.userData.phase) * 0.3;
    o.userData.halo.scale.setScalar(hs);
    if (o.position.distanceToSquared(player.pos) < o.userData.radius * o.userData.radius) {
      takePickup(o);
    }
  }
}

function takePickup(o) {
  o.userData.taken = true;
  var k = o.userData.kind;
  if (k === 'urchin') {                              // pushed: it rolls away
    o.userData.push = o.position.clone().sub(player.pos).setY(0.15).normalize().multiplyScalar(7);
    o.userData.pushT = 1.6;
    o.userData.halo.visible = false;
  } else o.visible = false;
  flashCollect = 0.5;
  spawnFx(o.position, 12, {
    speed: 1.5, size: 0.3, soft: true, life: 0.9, grow: 2.2, spread: 1.4,
    color: k === 'treasure' ? 0xffe0a0 : 0xcaf4ff
  });
  spawnFx(o.position, 5, { speed: 1.1, size: 0.22, life: 1.2 });
  Q.onPickup(k, o);
}
