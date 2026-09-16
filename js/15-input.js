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
  var full = $('#btn-full');
  if (full) {
    // A button that does nothing is worse than no button: see below.
    if (!fullscreenSupported()) full.hidden = true;
    else full.addEventListener('click', toggleFullscreen);
  }
  document.addEventListener('fullscreenchange', setFullscreenLabel);
  document.addEventListener('webkitfullscreenchange', setFullscreenLabel);

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
  addTouchButtons();
  if (Q.dialog) showDialogLine();   // rewrites "Space" as "Tap"
}

/* `swimHeld` guards one trap: when a finger leaves FAST while SWIM is still
     pressed, clearing KeyW would stop the fish dead under the other thumb. */
var swimHeld = false;

function addTouchButtons() {
  if (document.getElementById('swim')) return;

  var swim = touchPad('swim', T('hud.swim'), 108, 18);
  hold(swim, function (on) { swimHeld = on; keys['KeyW'] = on; });

  /* FAST presses KeyW as well. The dash only applies while swimming forward
     (wantDash, 11-player.js), so a button that sent Shift alone would do
     nothing unless a second thumb held SWIM — useless exactly when wanted. */
  var dash = touchPad('dash', T('hud.fast'), 72, 136);
  hold(dash, function (on) {
    keys['ShiftLeft'] = on;
    if (on) keys['KeyW'] = true;
    else if (!swimHeld) keys['KeyW'] = false;
  });
}

/** A round pad in the bottom-left corner. `bottom` is counted from the safe
    area rather than the screen edge, so the home bar never sits on it. */
function touchPad(id, label, size, bottom) {
  var b = document.createElement('div');
  b.id = id;
  b.textContent = label;
  b.setAttribute('style', 'position:fixed;z-index:4;' +
    'left:calc(18px + var(--safe-l));bottom:calc(' + bottom + 'px + var(--safe-b));' +
    'width:' + size + 'px;height:' + size + 'px;' +
    'border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;' +
    'font-size:' + (size > 90 ? 18 : 15) + 'px;' +
    'color:#3a1400;background:linear-gradient(#ffd08a,#ff7a4d);box-shadow:0 6px 0 #e2542a;' +
    'user-select:none;touch-action:none;font-family:"Baloo 2",sans-serif');
  document.body.appendChild(b);
  return b;
}

/** Press and hold: down, then up — or `touchcancel`, when the system takes the
    touch away for a call or a notification, which must release the key too. */
function hold(b, set) {
  function down(e) { set(true); e.preventDefault(); e.stopPropagation(); }
  function up(e) { set(false); e.preventDefault(); e.stopPropagation(); }
  b.addEventListener('touchstart', down, { passive: false });
  b.addEventListener('touchend', up, { passive: false });
  b.addEventListener('touchcancel', up, { passive: false });
}

/* ================================================================== */
/* FULLSCREEN                                                         */
/* ================================================================== */
/* Safari on iPhone exposes none of this for anything but a <video>, so the
   button takes itself out of the corner there rather than sitting and doing
   nothing; on that device, adding the page to the home screen is the way in
   (see the meta tags in index.html). */
function fullscreenSupported() {
  var d = document.documentElement;
  return !!(d.requestFullscreen || d.webkitRequestFullscreen);
}

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

/* Like requestPointerLock, these return a **promise**, and a refusal nobody
   catches surfaces as "Uncaught (in promise)" in the console of whoever opened
   the page. Nothing is broken when it happens — we simply stay windowed. */
function enterFullscreen() {
  var d = document.documentElement;
  var fn = d.requestFullscreen || d.webkitRequestFullscreen;
  if (!fn) return;
  var p;
  try { p = fn.call(d, { navigationUI: 'hide' }); } catch (e) { p = null; }
  if (p && p.catch) p.catch(function () { /* refused: windowed it is */ });
}

function leaveFullscreen() {
  var fn = document.exitFullscreen || document.webkitExitFullscreen;
  if (!fn) return;
  var p;
  try { p = fn.call(document); } catch (e) { p = null; }
  if (p && p.catch) p.catch(function () { /* already out */ });
}

function toggleFullscreen() {
  if (isFullscreen()) leaveFullscreen(); else enterFullscreen();
}

/* The glyph does not change — being fullscreen is obvious enough on screen.
   The tooltip does, and `data-i18n-title` carries the key rather than the text
   so that switching language keeps the right one. */
function setFullscreenLabel() {
  var b = $('#btn-full');
  if (!b) return;
  var key = isFullscreen() ? 'hud.fullExitTip' : 'hud.fullTip';
  b.setAttribute('data-i18n-title', key);
  b.title = T(key);
}
