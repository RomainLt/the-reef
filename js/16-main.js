/* The Reef — Opening shot, main loop, start-up
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* OPENING SHOT (title screen)                                        */
/* ================================================================== */
function updateTitle(dt) {
  var t = U.uTime.value;
  var a = t * 0.32;
  player.pos.set(world.home.x + Math.cos(a) * 7.5,
                 world.home.y + 1.6 + Math.sin(t * 0.7) * 1.0,
                 world.home.z + Math.sin(a) * 7.5);
  tmpA.set(-Math.sin(a), Math.cos(t * 0.7) * 0.06, Math.cos(a)).normalize();
  tmpM.lookAt(tmpA, tmpC.set(0, 0, 0), UP);
  tmpQ.setFromRotationMatrix(tmpM);
  player.obj.quaternion.slerp(tmpQ, 1 - Math.exp(-5 * dt));
  player.obj.position.copy(player.pos);

  var anim = player.obj.userData.body.userData.anim;
  anim.uSwaySpeed.value = 5.2;
  anim.uSwayAmp.value = 0.075;
  player.flap += dt * 4.2;
  player.obj.userData.pect[0].rotation.z = 0.2 + Math.sin(player.flap) * 0.5;
  player.obj.userData.pect[1].rotation.z = -0.2 - Math.sin(player.flap + 0.4) * 0.5;

  var ca = t * 0.075 + 1.1;
  camera.position.set(world.home.x + Math.cos(ca) * 26,
                      world.home.y + 8 + Math.sin(t * 0.11) * 3,
                      world.home.z + Math.sin(ca) * 26);
  camera.lookAt(world.home.x, world.home.y + 1.5, world.home.z);
  cam.pos.copy(camera.position);
}

/* ================================================================== */
/* BOUCLE PRINCIPALE                                                  */
/* ================================================================== */
var lastT = 0, frameAcc = 0, frameN = 0, autoDropped = false;

function updateWorldFx(dt) {
  var layers = world.particles.userData.layers;
  for (var i = 0; i < layers.length; i++) {
    var u = layers[i].material.uniforms;
    u.uCenter.value.copy(camera.position);
    u.uPix.value = H * pixelScale * 0.00055;
  }
  world.rays.rotation.y += dt * 0.007;
  // the bubble vents puff continuously
  if (world.vents.length && rnd() < dt * 14) {
    var v = world.vents[(rnd() * world.vents.length) | 0];
    if (v.distanceToSquared(camera.position) < 3600) {
      spawnFx(v, 1, { speed: 0.5, size: 0.22, life: rr(2.2, 3.4), grow: 1.6, spread: 0.6 });
    }
  }
}

/* The current turns slowly and breathes, without ever dying: still water
     makes dead scenery, and a current that flips all at once cracks the whole
     vegetation like a whip. Two sine waves with incommensurable periods (41 s
     and 67 s) are enough that you cannot pick out the loop. */
var CUR = { ang: 0.6, beat: 0 };
var _curF = new THREE.Vector3(), _curR = new THREE.Vector3();
function updateCurrent(dt) {
  var t = U.uTime.value;
  CUR.ang = 0.6 + Math.sin(t / 41) * 0.9 + Math.sin(t / 67 + 1.3) * 0.5;
  var force = 0.62 + Math.sin(t / 23 + 0.7) * 0.20 + Math.sin(t / 13.5) * 0.09;
  var cx = Math.cos(CUR.ang) * force, cz = Math.sin(CUR.ang) * force;
  U.uCurrent.value.set(cx, cz);
  // integral of the current: this is what the particles follow, so that
  // a change of strength does not make them jump all at once.
  U.uDrift.value.x += cx * dt * 2.6;
  U.uDrift.value.y += cz * dt * 2.6;

  /* ---- and what you hear of it ----
         The gust is recomputed here with **the shader's own formula**, at the
         player's position: `REEF.soft` sways at 1.15 rad/s and its gust travels
         with the current. Copying the formula is the price of having ear and eye
         talk about the same wave — an independent audio envelope would have been
         simpler and would have rung false, swelling just as the corals
         straighten up. */
  if (!SND.ready) return;
  CUR.beat += dt * 1.15;
  var trav = (player.pos.x * cx + player.pos.z * cz) * 0.09;
  var gust = 0.60 + 0.40 * Math.sin(CUR.beat * 0.29 - trav);
  // which side it is blowing from, relative to where you are looking
  camForward(_curF);
  _curR.crossVectors(_curF, UP).normalize();
  // /0.75 and not /0.62: at 0.62 the strong gusts hit the ceiling of the
  // clamp and all sounded the same.
  SND.setCurrent(force * gust / 0.75, cx * _curR.x + cz * _curR.z);
}

function animate() {
  requestAnimationFrame(animate);
  var now = performance.now() / 1000;
  var dt = clamp(now - lastT, 0.0005, 0.05);
  lastT = now;

  if (G.state === 'pause') { renderFrame(dt); return; }

  U.uTime.value += dt;
  updateCurrent(dt);
  for (var ai = 0; ai < ANIMS.length; ai++) {
    var an = ANIMS[ai];
    an.uBeat.value += dt * an.uSwaySpeed.value;
    /* The phase is wrapped so a shader `float` keeps its precision: after an
             hour `uBeat` would reach ~20,000, and a 32-bit float no longer has
             enough mantissa to tell two frames apart — the animation would freeze
             into steps. Wrapping on a multiple of 2π is invisible. */
    if (an.uBeat.value > 6283.18) an.uBeat.value -= 6283.18;
  }
  G.safeT = Math.max(0, G.safeT - dt);
  flashCollect = Math.max(0, flashCollect - dt * 2.2);
  flashSting = Math.max(0, flashSting - dt * 2.6);

  if (G.state === 'play') {
    G.time += dt;
    updatePlayer(dt);
    updatePickups(dt);
    updateQuests(dt);
    updateInteract(dt);
    updateDialog(dt);
    refreshObjective(false);
    updateHud(dt);
    G.bubbleT -= dt;
    if (G.bubbleT <= 0) { G.bubbleT = rr(2.5, 7.5); SND.bubble(); }
  } else {
    updateTitle(dt);
  }
  world.menace = 0;
  updateZones(dt);
  updateCritters(dt);
  updateSchools(dt);
  updateJellies(dt);
  updateFx(dt);
  updateMarks(dt);
  updateWorldFx(dt);
  renderFrame(dt);

  // drops the quality by itself if the machine is struggling
  if (!autoDropped && QUALITY > 0) {
    frameAcc += dt; frameN++;
    if (frameN >= 150) {
      if (frameAcc / frameN > 0.028) {
        QUALITY = QUALITY - 1; setQualityLabel(); applyQuality(); initShadows(); onResize();
        if (QUALITY === 0) autoDropped = true;
      }
      frameAcc = 0; frameN = 0;
    }
  }
}

/* ================================================================== */
/* START-UP                                                           */
/* ================================================================== */
function init() {
  initRenderer();
  buildWaterDome();
  buildFloor();
  buildSurface();
  world.rays = buildGodRays();
  buildReef();
  buildShadows();
  buildPearls();
  buildSchools();
  populateReef();
  buildJellies();
  world.particles = buildParticles();
  initFx();
  buildPlayer();
  initQuests();
  attachMarks();
  bindInput();
  setQualityLabel();

  camera.position.set(world.home.x + 26, world.home.y + 10, world.home.z);
  camera.lookAt(world.home.x, world.home.y, world.home.z);
  renderer.compile(scene, camera);
  lastT = performance.now() / 1000;
  renderFrame(0.016);
  animate();

  window.__reef = { THREE: THREE, scene: scene, camera: camera, player: player, cam: cam,
                    world: world, U: U, CFG: CFG, G: G, Q: Q, renderer: renderer,
                    SND: SND, CUR: CUR, LANG: LANG, T: T, setLang: setLang,
                    dive: dive, startDialog: startDialog, advanceDialog: advanceDialog };
  loaderEl.style.opacity = '0';
  setTimeout(function () { if (loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl); }, 600);
}

/* No REEF_READY check here: index.html only loads this file when three.js is
   present, and a second gate would just be dead code pretending otherwise. */
try {
  requestAnimationFrame(function () {
    try { init(); }
    catch (err) {
      loaderEl.style.opacity = '1';
      loaderEl.innerHTML = T('ui.crash') + '<br><small style="opacity:.7">' + (err && err.message ? err.message : err) + '</small>';
      if (window.console) console.error(err);
    }
  });
} catch (err2) {
  loaderEl.innerHTML = T('ui.crash') + '<br><small style="opacity:.7">' + err2 + '</small>';
}
