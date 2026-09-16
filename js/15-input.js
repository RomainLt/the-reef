/* The Reef — Keyboard, mouse and touch
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* COMMANDES                                                          */
/* ================================================================== */
function bindInput() {
  var el = renderer.domElement;

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Escape') { if (G.state === 'play') setPause(true); return; }
    keys[e.code] = true;
    if (e.code === 'KeyP') setPause(G.state === 'play');
    if (G.state === 'play') {
      if (e.code === 'KeyE') { if (Q.dialog) advanceDialog(); else if (Q.near) startDialog(Q.near); }
      if (e.code === 'Space' && Q.dialog) { advanceDialog(); keys.Space = false; }
      if (e.code === 'KeyJ') { Q.journalOn = !Q.journalOn; elJournal.classList.toggle('on', Q.journalOn); }
    }
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () { keys = {}; });

  el.addEventListener('mousedown', function () {
    if (Q.dialog) { advanceDialog(); return; }
    dragging = true;
    /* No pointer lock on touch: there is no pointer to lock, and the call
               fails on every tap.
               Since Chrome 116 the method returns a **promise**, and a `try/catch`
               does not catch it: the refusal (re-locking too fast, document not
               focused) surfaced as "Uncaught (in promise)" in the console of
               whoever opened the page. Nothing broken, but a visible error in a
               page you are sharing is one error too many. */
    if (G.state === 'play' && !locked && !TOUCH && el.requestPointerLock) {
      var pl;
      try { pl = el.requestPointerLock(); } catch (err) { pl = null; }
      if (pl && pl.catch) pl.catch(function () { /* refused: we keep the drag */ });
    }
  });
  window.addEventListener('mouseup', function () { dragging = false; });
  window.addEventListener('mousemove', function (e) {
    if (locked || dragging) { mouseDX += e.movementX || 0; mouseDY += e.movementY || 0; }
  });
  document.addEventListener('pointerlockchange', function () {
    locked = document.pointerLockElement === el;
  });
  el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  el.addEventListener('wheel', function (e) {
    cam.dist = clamp(cam.dist + (e.deltaY > 0 ? 0.7 : -0.7), 3.4, 13);
    e.preventDefault();
  }, { passive: false });

  // ---- touch: drag to look + one big SWIM button
  var tid = null, tx = 0, ty = 0;
  el.addEventListener('touchstart', function (e) {
    goTouch();
    var t = e.changedTouches[0];
    tid = t.identifier; tx = t.clientX; ty = t.clientY;
  }, { passive: true });
  el.addEventListener('touchmove', function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier !== tid) continue;
      mouseDX += (t.clientX - tx) * 1.6; mouseDY += (t.clientY - ty) * 1.6;
      tx = t.clientX; ty = t.clientY;
    }
    e.preventDefault();
  }, { passive: false });
  el.addEventListener('touchend', function () { tid = null; }, { passive: true });

  // The prompt and the dialogue bubble take on the role of the E key and the
  // space bar. `click` rather than `touchstart`: the browser synthesises it
  // on a short tap, and it keeps the mouse click working on a
  // touchscreen computer.
  elPrompt.addEventListener('click', function (e) {
    e.stopPropagation();
    if (G.state !== 'play') return;
    if (Q.dialog) advanceDialog(); else if (Q.near) startDialog(Q.near);
  });
  elDialog.addEventListener('click', function (e) {
    e.stopPropagation();
    if (Q.dialog) advanceDialog();
  });

  $('#btn-dive').addEventListener('click', dive);
  $('#btn-again').addEventListener('click', dive);
  $('#btn-resume').addEventListener('click', function () { setPause(false); });
  $('#btn-lang').addEventListener('click', function () {
    setLang(LANG.code === 'fr' ? 'en' : 'fr');
  });
  $('#btn-sound').addEventListener('click', function () {
    SND.init();
    SND.muted = !SND.muted;
    if (SND.master) SND.master.gain.value = SND.muted ? 0 : 0.9;
    this.textContent = SND.muted ? '🔇' : '🔊';
    this.classList.toggle('off', SND.muted);
  });
  $('#btn-quality').addEventListener('click', function () {
    QUALITY = (QUALITY + 2) % 3;
    setQualityLabel();
    applyQuality();
    initShadows();
    onResize();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && G.state === 'play') setPause(true);
  });
}

function setQualityLabel() {
  $('#btn-quality').innerHTML = T('hud.quality',
    { v: T(QUALITY === 2 ? 'hud.qHigh' : QUALITY === 1 ? 'hud.qMid' : 'hud.qLow') });
}

/* Switching to touch mode is irreversible within a session, and that is
     deliberate: a tap proves there is a touchscreen, whereas a touch laptop may
     well go back to the keyboard — removing the buttons as soon as a key is
     pressed would make them flicker. */
function goTouch() {
  if (TOUCH) return;
  TOUCH = true;
  document.body.classList.add('touch');
  addSwimButton();
  if (Q.dialog) showDialogLine();   // rewrites "Space" as "Tap"
}

function addSwimButton() {
  if (document.getElementById('swim')) return;
  var b = document.createElement('div');
  b.id = 'swim';
  b.textContent = T('hud.swim');
  b.setAttribute('style', 'position:fixed;left:18px;bottom:18px;z-index:4;width:108px;height:108px;' +
    'border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;' +
    'color:#3a1400;background:linear-gradient(#ffd08a,#ff7a4d);box-shadow:0 6px 0 #e2542a;' +
    'user-select:none;touch-action:none;font-family:"Baloo 2",sans-serif');
  document.body.appendChild(b);
  function on(e) { keys['KeyW'] = true; e.preventDefault(); e.stopPropagation(); }
  function off(e) { keys['KeyW'] = false; e.preventDefault(); e.stopPropagation(); }
  b.addEventListener('touchstart', on, { passive: false });
  b.addEventListener('touchend', off, { passive: false });
  b.addEventListener('touchcancel', off, { passive: false });
}
