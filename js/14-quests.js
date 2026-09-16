/* The Reef — Quests, dialogue, journal, game rules
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* QUESTS                                                             */
/* ================================================================== */
var elDialog = $('#dialog'), elWho = $('#dialog .who'), elTxt = $('#dialog .txt');
var elPrompt = $('#prompt'), elObj = $('#objective'), elJournal = $('#journal'), elJList = $('#journal-list');

var Q = {
  defs: [], byId: {}, order: [], done: 0, total: 0,
  dialog: null, near: null, journalOn: false, counters: {}, seen: {},
  babyTurtle: null, hideT: 0
};

function questDefs() {
  return [
    {
      id: 'pearls', npc: 'tang', target: 12,
      title: function () { return T('q.pearls.title'); },
      objective: function (q) { return T('q.pearls.obj', { n: q.progress }); },
      lines: function () { return [T('q.pearls.1'), T('q.pearls.2'), T('q.pearls.3')]; },
      doneLines: function () { return [T('q.pearls.d1'), T('q.pearls.d2')]; },
      start: function (q) { spawnPearls(12); }
    },
    {
      id: 'urchins', npc: 'puffer', target: 3,
      title: function () { return T('q.urchins.title', { name: T('npc.puffer') }); },
      objective: function (q) { return T('q.urchins.obj', { n: q.progress }); },
      lines: function () { return [T('q.urchins.1'), T('q.urchins.2'), T('q.urchins.3')]; },
      doneLines: function () { return [T('q.urchins.d1')]; },
      start: function (q) {
        var a = world.npcs.puffer.anchor;
        for (var i = 0; i < 3; i++) {
          var ang = (i / 3) * TAU + rnd() * 0.7, d = rr(3.0, 5.0);
          addPickup('urchin',
            new THREE.Vector3(a.x + Math.cos(ang) * d, a.y - 1.7, a.z + Math.sin(ang) * d),
            { tag: 'urchins', radius: 3.6 });
        }
      }
    },
    {
      id: 'shells', npc: 'seahorse', target: 5,
      title: function () { return T('q.shells.title', { name: T('npc.seahorse') }); },
      objective: function (q) { return T('q.shells.obj', { n: q.progress }); },
      lines: function () { return [T('q.shells.1'), T('q.shells.2'), T('q.shells.3')]; },
      doneLines: function () { return [T('q.shells.d1')]; },
      start: function (q) {
        var P = world.places.kelp;
        for (var i = 0; i < 5; i++) {
          addPickup('shell', clearSpot(P.x, P.z, null, 19, 1.6), { tag: 'shells', radius: 2.6 });
        }
      },
      marker: function () { return world.places.kelp; }
    },
    {
      id: 'escort', npc: 'star', target: 1,
      title: function () { return T('q.escort.title'); },
      objective: function (q) { return T('q.escort.obj'); },
      lines: function () { return [T('q.escort.1'), T('q.escort.2'), T('q.escort.3')]; },
      doneLines: function () { return [T('q.escort.d1')]; },
      start: function (q) {
        var t = buildTurtle();
        t.scale.setScalar(0.8);
        var a = world.npcs.star.anchor;
        t.position.set(a.x + 4, a.y + 1.5, a.z + 4);
        Q.babyTurtle = addCritter(t, {
          kind: 'baby', update: updateTurtleCritter, cx: a.x, cz: a.z, r: 3, y: a.y + 1.5,
          speed: 0.3, follow: true, followD: 3.2, followSpeed: 1.6
        });
      },
      marker: function () { return Q.babyTurtle ? world.places.dropoff : null; }
    },
    {
      id: 'hide', npc: 'idol', target: 1,
      title: function () { return T('q.hide.title'); },
      objective: function (q) { return T('q.hide.obj', { n: Math.ceil(Math.max(0, 8 - Q.hideT)) }); },
      lines: function () { return [T('q.hide.1'), T('q.hide.2'), T('q.hide.3')]; },
      doneLines: function () { return [T('q.hide.d1')]; },
      start: function (q) { Q.hideT = 0; showHint(T('hint.hideHere'), 6); },
      marker: function () { return world.places.garden; }
    },
    {
      id: 'treasure', npc: 'shrimp', target: 1,
      title: function () { return T('q.treasure.title'); },
      objective: function (q) { return q.progress ? T('q.treasure.back', { name: T('npc.shrimp') }) : T('q.treasure.find'); },
      lines: function () { return [T('q.treasure.1'), T('q.treasure.2'), T('q.treasure.3')]; },
      doneLines: function () { return [T('q.treasure.d1')]; },
      start: function (q) {
        var P = world.places.wreck;
        var v = clearSpot(P.x, P.z, P.y + 2.2, 7, 1.4);
        addPickup('treasure', v, { tag: 'treasure', radius: 3.2 });
      },
      marker: function (q) { return q.progress ? world.npcs.shrimp.obj.position : world.places.wreck; }
    },
    {
      id: 'cave', npc: 'octopus', target: 1,
      title: function () { return T('q.cave.title'); },
      objective: function (q) { return q.progress ? T('q.cave.back', { name: T('npc.octopus') }) : T('q.cave.find'); },
      lines: function () { return [T('q.cave.1'), T('q.cave.2'), T('q.cave.3')]; },
      doneLines: function () { return [T('q.cave.d1')]; },
      start: function (q) {
        var m = world.places.cave;
        var dir = new THREE.Vector3(-m.x, 0, -m.z).normalize();
        addPickup('blackpearl',
          new THREE.Vector3(m.x + dir.x * 2.2, m.y + 0.6, m.z + dir.z * 2.2),
          { tag: 'cave', radius: 2.8 });
      },
      marker: function (q) { return q.progress ? world.npcs.octopus.obj.position : world.places.cave; }
    },
    {
      id: 'census', npc: 'crab', target: 8, late: true,
      title: function () { return T('q.census.title'); },
      objective: function (q) { return T('q.census.obj', { n: q.progress }); },
      lines: function () { return [T('q.census.1'), T('q.census.2'), T('q.census.3')]; },
      doneLines: function () { return [T('q.census.d1')]; }
    }
  ];
}

function initQuests() {
  Q.defs = questDefs();
  Q.total = Q.defs.length;
  $('#pearls small').textContent = T('hud.quests', { n: Q.total });
  for (var i = 0; i < Q.defs.length; i++) {
    var d = Q.defs[i];
    d.state = i === 0 ? 'available' : 'locked';
    d.progress = 0;
    Q.byId[d.id] = d;
    Q.order.push(d.id);
  }
  updateJournal();
}

/** Once the first quest is done, the whole reef opens up. */
function unlockAll() {
  for (var i = 0; i < Q.defs.length; i++) {
    var d = Q.defs[i];
    if (d.state === 'locked' && !d.late) d.state = 'available';
  }
  var cens = Q.byId.census;
  if (cens && cens.state === 'locked' && Q.done >= 4) cens.state = 'available';
}

/** Display name of an inhabitant or a place — resolved at display time, so
    that a change of language renames everyone at once. */
function npcName(o) { return o && o.nameKey ? T(o.nameKey) : T('jr.someone'); }

/** Quest this NPC offers / is waiting to be told about. */
function questForNpc(id) {
  for (var i = 0; i < Q.defs.length; i++) {
    var d = Q.defs[i];
    if (d.npc !== id) continue;
    if (d.state === 'active' && d.progress >= d.target) return d;   // to hand in
    if (d.state === 'available') return d;
  }
  return null;
}
function npcMark(id) {
  var q = questForNpc(id);
  if (!q) return null;
  return q.state === 'active' ? '?' : '!';
}


/* ---------- markers above the NPCs ---------- */
function markTexture(ch, col) {
  return canvasTex(64, function (g, s) {
    g.clearRect(0, 0, s, s);
    g.font = 'bold 52px "Baloo 2", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = '#08202e';
    g.strokeText(ch, s / 2, s / 2 + 2);
    g.fillStyle = col;
    g.fillText(ch, s / 2, s / 2 + 2);
  });
}
function attachMarks() {
  TEX.mark1 = markTexture('!', '#ffd98a');
  TEX.mark2 = markTexture('?', '#9fe8ff');
  for (var id in world.npcs) {
    var c = world.npcs[id];
    if (!c.obj || c.noTalk) continue;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX.mark1, transparent: true, depthWrite: false, depthTest: false
    }));
    sp.scale.setScalar(1.5);
    sp.position.y = c.markY || 2.4;
    sp.renderOrder = 20;
    sp.visible = false;
    c.obj.add(sp);
    c.mark = sp;
  }
}
function updateMarks(dt) {
  var t = U.uTime.value;
  for (var id in world.npcs) {
    var c = world.npcs[id];
    if (!c.mark) continue;
    var m = npcMark(id);
    c.mark.visible = !!m && !Q.dialog;
    if (m) {
      c.mark.material.map = m === '!' ? TEX.mark1 : TEX.mark2;
      c.mark.position.y = (c.markY || 2.4) + Math.sin(t * 2.4 + (c.phase || 0)) * 0.18;
      var sc = 1.4 / Math.max(c.obj.scale.x, 0.001);
      c.mark.scale.setScalar(sc);
    }
  }
}

/* ---------- dialogues ---------- */
// (the small talk lives in TXT, under the `idle.<npc>` keys)

function startDialog(c) {
  var q = questForNpc(c.id);
  var mode = 'idle', lines;
  /* The lines are built by a function kept on the dialogue, not merely
         copied: changing language in the middle of a conversation has to be able
         to rewrite them. */
  var linesFor = function () {
    if (q && q.state === 'available') return q.lines();
    if (q && q.state === 'active') return q.doneLines();
    return [T(TXT['idle.' + c.id] ? 'idle.' + c.id : 'idle.none')];
  };
  if (q && q.state === 'available') mode = 'give';
  else if (q && q.state === 'active') mode = 'turnin';
  lines = linesFor();
  Q.dialog = { npc: c, q: q, mode: mode, lines: lines, linesFor: linesFor,
               i: 0, shown: '', full: '', t: 0 };
  elDialog.classList.add('on');
  showDialogLine();
  SND.talk();
}
function showDialogLine() {
  var d = Q.dialog;
  elWho.textContent = npcName(d.npc);
  d.full = d.lines[d.i];
  d.shown = ''; d.t = 0;
  elTxt.textContent = '';
  var quoi = T(d.i < d.lines.length - 1 ? 'hud.more' : (d.mode === 'give' ? 'hud.accept' : 'hud.close'));
  $('#dialog .more').textContent = T(TOUCH ? 'hud.tapPrefix' : 'hud.keyPrefix') + quoi;
}
function advanceDialog() {
  var d = Q.dialog;
  if (!d) return;
  if (d.shown.length < d.full.length) { d.shown = d.full; elTxt.textContent = d.full; return; }
  d.i++;
  if (d.i < d.lines.length) { showDialogLine(); SND.talk(); return; }
  Q.dialog = null;
  elDialog.classList.remove('on');
  if (d.mode === 'give') acceptQuest(d.q);
  else if (d.mode === 'turnin') completeQuest(d.q);
}
function updateDialog(dt) {
  var d = Q.dialog;
  if (!d) return;
  if (d.shown.length < d.full.length) {
    d.t += dt;
    var n = Math.min(d.full.length, Math.floor(d.t * 58));
    if (n > d.shown.length) { d.shown = d.full.slice(0, n); elTxt.textContent = d.shown; }
  }
}

function acceptQuest(q) {
  q.state = 'active';
  q.progress = 0;
  if (q.start) q.start(q);
  showToast(T('obj.newQuest'));
  showHint(q.title(), 4.5);
  SND.quest();
  updateJournal(); refreshObjective(true);
}
function completeQuest(q) {
  q.state = 'done';
  Q.done++;
  elPearls.textContent = Q.done;
  showToast(T('obj.questDone'));
  SND.pickup(Math.min(Q.done + 2, 7));
  if (q.id === 'pearls') unlockAll();
  if (Q.done >= 3) { var c = Q.byId.census; if (c && c.state === 'locked') c.state = 'available'; }
  updateJournal(); refreshObjective(true);
  if (Q.done >= Q.total) win();
}

Q.onPickup = function (kind, o) {
  var q = Q.byId[o.userData.tag];
  if (q && q.state === 'active' && q.progress < q.target) {
    q.progress++;
    SND.pickup(Math.min(q.progress - 1, 7));
    if (q.progress >= q.target) {
      var who = world.npcs[q.npc];
      showToast(T('obj.report', { name: who ? npcName(who) : T('obj.friend') }));
    } else {
      showToast(q.progress + ' / ' + q.target);
    }
    updateJournal(); refreshObjective(true);
  }
};

/* ---------- quest tracking ---------- */
function updateQuests(dt) {
  var q;
  // escorting the baby turtle
  q = Q.byId.escort;
  if (q && q.state === 'active' && Q.babyTurtle && q.progress < 1) {
    var d = Q.babyTurtle.obj.position.distanceTo(world.places.dropoff);
    if (d < 16) {
      q.progress = 1;
      Q.babyTurtle.follow = false;
      Q.babyTurtle.cx = world.places.dropoff.x;
      Q.babyTurtle.cz = world.places.dropoff.z;
      Q.babyTurtle.r = 8;
      showToast(T('toast.arrived'));
      refreshObjective(true); updateJournal();
    }
  }
  // hiding in an anemone
  q = Q.byId.hide;
  if (q && q.state === 'active' && q.progress < 1) {
    if (inRefuge()) {
      Q.hideT += dt;
      if (Q.hideT >= 8) { q.progress = 1; showToast(T('toast.wellDone')); updateJournal(); }
    } else if (Q.hideT > 0) {
      Q.hideT = Math.max(0, Q.hideT - dt * 2);
    }
  }
  // recensement
  q = Q.byId.census;
  if (q && q.state === 'active' && q.progress < q.target) {
    var n = 0, k;
    for (var i = 0; i < world.critters.length; i++) {
      var c = world.critters[i];
      if (!c.obj || !c.obj.visible) continue;
      if (c.obj.position.distanceToSquared(player.pos) < 100) Q.seen[c.id || c.kind] = 1;
    }
    for (var s2 = 0; s2 < world.schools.length; s2++) {
      var sc = world.schools[s2];
      if (sc.fish[0] && sc.fish[0].position.distanceToSquared(player.pos) < 110) Q.seen['banc' + s2] = 1;
    }
    for (var j = 0; j < world.jellies.length; j++) {
      if (world.jellies[j].position.distanceToSquared(player.pos) < 110) Q.seen.meduse = 1;
    }
    for (k in Q.seen) n++;
    if (n !== q.progress) {
      q.progress = Math.min(n, q.target);
      if (q.progress >= q.target) showToast(T('toast.eightKinds'));
      updateJournal(); refreshObjective(true);
    }
  }
}

/* ---------- interaction ---------- */
function updateInteract(dt) {
  if (Q.dialog) { elPrompt.classList.remove('on'); return; }
  var best = null, bd = 49;
  for (var id in world.npcs) {
    var c = world.npcs[id];
    if (!c.obj || c.noTalk) continue;
    var d = c.obj.position.distanceToSquared(player.pos);
    if (d < bd) { bd = d; best = c; }
  }
  Q.near = best;
  if (best) {
    var mk = npcMark(best.id);
    var verbe = T(mk === '!' ? 'hud.listenTo' : 'hud.talkTo', { name: npcName(best) });
    elPrompt.innerHTML = TOUCH ? ('💬 ' + verbe) : ('<kbd>E</kbd> ' + verbe);
    elPrompt.classList.add('on');
  } else elPrompt.classList.remove('on');
}

/* ---------- journal and objective ---------- */
function stripTags(h) { return String(h).replace(/<[^>]*>/g, ''); }
function updateJournal() {
  var html = '';
  for (var i = 0; i < Q.order.length; i++) {
    var q = Q.byId[Q.order[i]];
    if (q.state === 'locked') continue;
    var who = world.npcs[q.npc];
    var nom = npcName(who);
    var line = q.state === 'done' ? T('jr.done')
      : (q.state === 'active' ? (q.progress >= q.target
          ? T('jr.report', { name: nom })
          : stripTags(q.objective(q)))
        : T('jr.pickUp', { name: nom }));
    html += '<li' + (q.state === 'done' ? ' class="done"' : '') + '><b>' + q.title() + '</b>' + line + '</li>';
  }
  elJList.innerHTML = html || '<li class="empty">' + T('jr.empty') + '</li>';
}
var _objTxt = '';
function refreshObjective(force) {
  var q = null;
  for (var i = 0; i < Q.order.length; i++) {
    var d = Q.byId[Q.order[i]];
    if (d.state === 'active') { q = d; break; }
  }
  Q.active = q;
  if (!q) {
    if (_objTxt !== '') { _objTxt = ''; elObj.classList.remove('on'); }
    return;
  }
  var who = world.npcs[q.npc];
  var txt = q.progress >= q.target
    ? T('obj.goSee', { name: npcName(who) })
    : q.objective(q);
  if (txt !== _objTxt || force) {
    _objTxt = txt;
    elObj.innerHTML = txt;
    elObj.classList.add('on');
  }
}
/** What the golden arrow points at. */
function arrowTarget() {
  var q = Q.active;
  if (!q) {
    var best = null, bd = 1e9;
    for (var id in world.npcs) {
      var c = world.npcs[id];
      if (!c.obj || c.noTalk || !npcMark(id)) continue;
      var d = c.obj.position.distanceToSquared(player.pos);
      if (d < bd) { bd = d; best = c.obj.position; }
    }
    return best;
  }
  if (q.progress >= q.target) {
    var w = world.npcs[q.npc];
    return w && w.obj ? w.obj.position : null;
  }
  var near = null, nd = 1e9;
  for (var i = 0; i < world.pickups.length; i++) {
    var o = world.pickups[i];
    if (o.userData.taken || o.userData.tag !== q.id) continue;
    var dd = o.position.distanceToSquared(player.pos);
    if (dd < nd) { nd = dd; near = o.position; }
  }
  if (near) return near;
  if (q.marker) { var m = q.marker(q); if (m) return m; }
  var w2 = world.npcs[q.npc];
  return w2 && w2.obj ? w2.obj.position : null;
}

/* ================================================================== */
/* GAME RULES                                                         */
/* ================================================================== */
function sting(j) {
  player.stun = 0.9;
  flashSting = 1;
  tmpA.copy(player.pos).sub(j.position).normalize();
  player.vel.copy(tmpA).multiplyScalar(16);
  player.pos.addScaledVector(tmpA, 0.6);
  SND.sting();
  showToast(T('hint.ouch'));
  showHint(T('hint.jelly'), 3);
  spawnFx(player.pos, 8, { speed: 1.6, size: 0.3, soft: true, color: 0xd9a0ff, life: 0.7, grow: 2 });
  elFlash.style.opacity = 0.85;
  setTimeout(function () { elFlash.style.opacity = 0; }, 160);
}

function win() {
  G.state = 'win';
  var t = G.time | 0;
  $('#stats').textContent = T('win.stats', { time: T('win.time', { m: (t / 60) | 0, s: t % 60 }), n: Q.total });
  $('#win').classList.remove('gone');
  elHud.classList.remove('on');
  if (document.pointerLockElement) document.exitPointerLock();
  SND.win();
}

function dive() {
  /* On a phone, diving goes fullscreen. A browser only grants it from a user
     gesture, and this click is one — asking for it later, once the reef is
     built, would be refused. */
  if (COARSE) enterFullscreen();
  SND.init();
  if (SND.ctx && SND.ctx.state === 'suspended') SND.ctx.resume();
  G.state = 'play'; G.time = 0; G.pearls = 0;
  elPearls.textContent = '0';
  // start over: items and quests
  for (var i = 0; i < world.pickups.length; i++) scene.remove(world.pickups[i]);
  world.pickups.length = 0;
  if (Q.babyTurtle) {
    scene.remove(Q.babyTurtle.obj);
    var bi = world.critters.indexOf(Q.babyTurtle);
    if (bi >= 0) world.critters.splice(bi, 1);
    Q.babyTurtle = null;
  }
  Q.done = 0; Q.seen = {}; Q.hideT = 0; Q.dialog = null; Q.active = null;
  elDialog.classList.remove('on');
  for (var k = 0; k < Q.defs.length; k++) {
    Q.defs[k].state = k === 0 ? 'available' : 'locked';
    Q.defs[k].progress = 0;
  }
  updateJournal(); refreshObjective(true);
  resetPlayer();
  $('#title').classList.add('gone');
  $('#win').classList.add('gone');
  $('#pause').classList.add('gone');
  elHud.classList.add('on');
  showHint(T('hint.blueFish'), 7);
}

function setPause(on) {
  if (G.state !== 'play' && G.state !== 'pause') return;
  G.state = on ? 'pause' : 'play';
  $('#pause').classList.toggle('gone', !on);
  if (on && document.pointerLockElement) document.exitPointerLock();
}
