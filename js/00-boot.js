/* The Reef — Helpers, tunables, languages, start-up guard
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* =====================================================================
 THE REEF — a hand-written "animated film" renderer (three.js + own shaders)
 Rendering, procedural world, gameplay and sound, cut into files that
 index.html loads in order.
 ===================================================================== */

var $ = function (s) { return document.querySelector(s); };
var loaderEl = $('#loader');

/* ==================================================================
     LANGUAGES

     Every entry is a [French, English] pair on a single line: the two
     versions read side by side, so a translation that drifts from its
     original shows up. `{x}` marks a hole to fill in.

     `LANG.i` indexes the pair. Everything goes through `T()`, French
     included: without that, the default language starts drifting from the
     dictionary the first time anyone edits it.
     ================================================================== */
var TXT = {
  // ---- screens ----
  'ui.title':        ['Le Récif', 'The Reef'],
  'ui.subtitle':     ['UNE BALADE ANIMÉE', 'AN ANIMATED STROLL'],
  'ui.lead':         ['Tu es un petit poisson-clown. Le récif est plein d’habitants qui ont besoin d’un coup de nageoire&nbsp;: parle-leur, rends-leur service, et méfie-toi des méduses et des requins.',
                      'You are a small clownfish. The reef is full of neighbours who could use a fin: talk to them, lend a hand, and watch out for the jellyfish and the sharks.'],
  'ui.dive':         ['Plonger', 'Dive in'],
  'ui.mouseTip':     ['Clique dans l’image pour capturer la souris • <kbd>Échap</kbd> pour la libérer',
                      'Click the picture to capture the mouse • <kbd>Esc</kbd> to release it'],
  'ui.winTitle':     ['Bravo&nbsp;!', 'Well done!'],
  'ui.winSub':       ['LE RÉCIF EST EN FÊTE', 'THE WHOLE REEF IS CELEBRATING'],
  'ui.winLead':      ['Tout le récif te dit merci.', 'The whole reef thanks you.'],
  'ui.again':        ['Replonger', 'Dive again'],
  'ui.pause':        ['Pause', 'Paused'],
  'ui.pauseSub':     ['RESPIRE UN PEU', 'TAKE A BREATH'],
  'ui.resume':       ['Reprendre', 'Resume'],
  'ui.loading':      ['Le récif se réveille…', 'The reef is waking up…'],
  'ui.noThree':      ['Impossible de charger three.js.<br>Vérifie ta connexion internet puis recharge la page.',
                      'Could not load three.js.<br>Check your internet connection, then reload the page.'],
  'ui.crash':        ['Oups, le récif n’a pas démarré :', 'Oops, the reef did not start:'],

  // ---- controls (key order changes: ZQSD first in French) ----
  'keys.move':   ['<kbd>Z Q S D</kbd>ou<kbd>W A S D</kbd>nager', '<kbd>W A S D</kbd>or<kbd>Z Q S D</kbd>swim'],
  'keys.look':   ['<kbd>Souris</kbd>regarder', '<kbd>Mouse</kbd>look around'],
  'keys.dash':   ['<kbd>Maj</kbd>accélérer', '<kbd>Shift</kbd>sprint'],
  'keys.up':     ['<kbd>Espace</kbd>monter', '<kbd>Space</kbd>rise'],
  'keys.down':   ['<kbd>Ctrl</kbd>descendre', '<kbd>Ctrl</kbd>dive'],
  'keys.talk':   ['<kbd>E</kbd>parler', '<kbd>E</kbd>talk'],
  'keys.journal':['<kbd>J</kbd>journal', '<kbd>J</kbd>journal'],
  'keys.pause':  ['<kbd>P</kbd>pause', '<kbd>P</kbd>pause'],

  // ---- in-game interface ----
  'hud.quests':      ['/ {n} quêtes', '/ {n} quests'],
  'hud.journal':     ['Journal', 'Journal'],
  'hud.promptIdle':  ['<kbd>E</kbd> parler', '<kbd>E</kbd> talk'],
  'hud.sound':       ['Son', 'Sound'],
  'hud.qualityTip':  ['Qualité du rendu', 'Rendering quality'],
  // (the non-breaking space before a colon is a French rule, not an English one)
  'hud.quality':     ['Qualité&nbsp;: {v}', 'Quality: {v}'],
  'hud.qHigh':       ['élevée', 'high'],
  'hud.qMid':        ['moyenne', 'medium'],
  'hud.qLow':        ['basse', 'low'],
  'hud.langTip':     ['Langue / Language', 'Langue / Language'],
  'hud.depth':       ['{n} m', '{n} m'],
  'hud.talkTo':      ['parler à {name}', 'talk to {name}'],
  'hud.listenTo':    ['écouter {name}', 'listen to {name}'],
  'hud.tapPrefix':   ['Touchez pour ', 'Tap to '],
  'hud.keyPrefix':   ['Espace pour ', 'Space to '],
  'hud.more':        ['continuer', 'continue'],
  'hud.accept':      ['accepter', 'accept'],
  'hud.close':       ['fermer', 'close'],
  'hud.swim':        ['NAGER', 'SWIM'],

  // ---- journal and objectives ----
  'jr.empty':        ['Va parler aux habitants du récif.', 'Go and talk to the reef’s neighbours.'],
  'jr.done':         ['Terminée', 'Done'],
  'jr.report':       ['Va rendre compte à {name}', 'Go and report to {name}'],
  'jr.pickUp':       ['À prendre auprès de {name}', 'Available from {name}'],
  'jr.someone':      ['…', '…'],
  'obj.goSee':       ['Va voir <b>{name}</b>', 'Go and see <b>{name}</b>'],
  'obj.newQuest':    ['Nouvelle quête', 'New quest'],
  'obj.questDone':   ['Quête accomplie !', 'Quest complete!'],
  'obj.friend':      ['ton ami', 'your friend'],

  // ---- indices ----
  'hint.start':      ['Explore le récif — trouve un habitant à qui parler', 'Explore the reef — find a neighbour to talk to'],
  'hint.blueFish':   ['Un poisson bleu t’appelle près de la maison — va lui parler', 'A blue fish is calling you near home — go and talk to her'],
  'hint.spotted':    ['Un requin t’a repéré ! Cache-toi dans une anémone', 'A shark has spotted you! Hide in an anemone'],
  'hint.lostYou':    ['Le requin t’a perdu de vue — reste à l’abri', 'The shark has lost you — stay under cover'],
  'hint.sharkBump':  ['Les requins rôdent au large — replie-toi dans une anémone !', 'Sharks prowl the open water — fall back into an anemone!'],
  'hint.edge':       ['Le grand bleu commence ici… reste dans le récif !', 'The open blue starts here… stay on the reef!'],
  'hint.jelly':      ['Les méduses piquent : garde tes distances', 'Jellyfish sting: keep your distance'],
  'hint.moray':      ['La murène n’aime pas la visite…', 'The moray does not care for visitors…'],
  'hint.ouch':       ['Aïe !', 'Ouch!'],
  'hint.hideHere':   ['Nage jusqu’à une anémone du jardin et reste dedans', 'Swim to an anemone in the garden and stay inside'],
  'toast.arrived':   ['Il est arrivé !', 'He made it!'],
  'toast.wellDone':  ['Bien joué !', 'Nicely done!'],
  'toast.eightKinds':['Huit espèces !', 'Eight species!'],
  'win.stats':       ['{time} • {n} quêtes accomplies', '{time} • {n} quests completed'],
  'win.time':        ['Temps : {m} min {s} s', 'Time: {m} min {s} s'],
  'obj.report':      ['Retourne voir {name}', 'Go back and see {name}'],

  // ---- lieux ----
  'place.kelp':      ['la forêt de laminaires', 'the kelp forest'],
  'place.wreck':     ['l’épave', 'the wreck'],
  'place.cave':      ['la grotte', 'the cave'],
  'place.vents':     ['les sources de bulles', 'the bubble vents'],
  'place.dropoff':   ['le creu', 'the drop-off'],
  'place.garden':    ['le jardin d’anémones', 'the anemone garden'],

  // ---- the inhabitants ----
  // Names that are common words get translated (Ballon, Pêche, Perle,
  // Pince); given names stay as they are in both languages.
  'npc.moray':    ['la murène', 'the moray'],
  'npc.tang':     ['Doria', 'Doria'],
  'npc.puffer':   ['Ballon', 'Balloon'],
  'npc.idol':     ['Gill', 'Gill'],
  'npc.seahorse': ['Sheldon', 'Sheldon'],
  'npc.shrimp':   ['Jacques', 'Jacques'],
  'npc.star':     ['Pêche', 'Peach'],
  'npc.crab':     ['Pince', 'Nipper'],
  'npc.octopus':  ['Perle', 'Pearl'],

  // ---- quest 1: the pearls ----
  'q.pearls.title': ['Les perles de nacre', 'The scattered pearls'],
  'q.pearls.obj':   ['Retrouve les perles de nacre — <b>{n} / 12</b>', 'Find the scattered pearls — <b>{n} / 12</b>'],
  'q.pearls.1':     ['Oh, un poisson-clown ! Tu tombes bien.', 'Oh, a clownfish! You come just in time.'],
  'q.pearls.2':     ['Le courant de cette nuit a éparpillé nos douze perles de nacre dans tout le récif.', 'Last night’s current scattered our twelve pearls all over the reef.'],
  'q.pearls.3':     ['Elles brillent, tu les verras de loin. La flèche dorée t’aidera !', 'They shine, so you will spot them from far off. The golden arrow will help!'],
  'q.pearls.d1':    ['Douze sur douze ! Le récif va scintiller à nouveau.', 'Twelve out of twelve! The reef will sparkle again.'],
  'q.pearls.d2':    ['Va voir les autres, tout le monde a besoin d’un coup de nageoire.', 'Go and see the others, everyone could use a fin.'],

  // ---- quest 2: the urchins ----
  'q.urchins.title':['Les oursins de {name}', '{name}’s urchins'],
  'q.urchins.obj':  ['Pousse les oursins hors du corail — <b>{n} / 3</b>', 'Push the urchins off the coral — <b>{n} / 3</b>'],
  'q.urchins.1':    ['Pff… tu vois ces oursins ? Ils se sont installés SUR mon corail.', 'Pfff… see those urchins? They have settled right ON my coral.'],
  'q.urchins.2':    ['Je ne peux pas les toucher, je me pique. Toi tu es petit et rapide…', 'I cannot touch them, I would prick myself. But you are small and quick…'],
  'q.urchins.3':    ['Fonce-leur dedans, ils rouleront tout seuls !', 'Just charge into them, they will roll away on their own!'],
  'q.urchins.d1':   ['Ha ! Enfin tranquille. Merci petit.', 'Ha! Peace at last. Thanks, little one.'],

  // ---- quest 3: the shells ----
  'q.shells.title': ['Les coquillages de {name}', '{name}’s shells'],
  'q.shells.obj':   ['Retrouve les coquillages dans la forêt de laminaires — <b>{n} / 5</b>', 'Find the shells in the kelp forest — <b>{n} / 5</b>'],
  'q.shells.1':     ['A… a… ATCHOUM ! Pardon. Les laminaires, ça me fait éternuer.', 'A… a… ACHOO! Sorry. Kelp makes me sneeze.'],
  'q.shells.2':     ['J’y ai lâché ma collection de coquillages, cinq beaux coquillages roses.', 'I dropped my shell collection in there, five lovely pink ones.'],
  'q.shells.3':     ['La forêt est au nord-ouest. Tu me les rapportes ?', 'The forest lies to the north-west. Would you bring them back to me?'],
  'q.shells.d1':    ['Mes coquillages ! Merci, merci, mer… ATCHOUM !', 'My shells! Thank you, thank you, than… ACHOO!'],

  // ---- quest 4: the baby turtle ----
  'q.escort.title': ['Le petit de la tortue', 'The turtle’s little one'],
  'q.escort.obj':   ['Guide le bébé tortue jusqu’au creu', 'Guide the baby turtle to the drop-off'],
  'q.escort.1':     ['Psst ! Tu as vu ? Un bébé tortue s’est perdu près de mon rocher.', 'Psst! Did you see? A baby turtle got lost by my rock.'],
  'q.escort.2':     ['Sa mère l’attend au creu, là où l’eau devient bleu nuit.', 'His mother is waiting at the drop-off, where the water turns midnight blue.'],
  'q.escort.3':     ['Nage devant lui, il te suivra. Et ne traîne pas près des requins !', 'Swim ahead of him and he will follow. And do not linger near the sharks!'],
  'q.escort.d1':    ['Il est rentré ! Tu es un chic type, petit clown.', 'He is home! You are a good sort, little clown.'],

  // ---- quest 5: hiding ----
  'q.hide.title':   ['Le passage du requin', 'When the shark comes by'],
  'q.hide.obj':     ['Reste caché dans une anémone — <b>{n} s</b>', 'Stay hidden in an anemone — <b>{n} s</b>'],
  'q.hide.1':       ['Tu vois cette cicatrice ? Souvenir du creu.', 'See this scar? A souvenir from the drop-off.'],
  'q.hide.2':       ['Écoute-moi bien : quand un grand blanc rôde, on ne fuit pas. On se cache.', 'Listen carefully: when a great white is prowling, you do not flee. You hide.'],
  'q.hide.3':       ['Les anémones ne piquent pas les poissons-clowns. Va t’y blottir, et compte jusqu’à huit.', 'Anemones do not sting clownfish. Go and nestle in one, and count to eight.'],
  'q.hide.d1':      ['Parfait. Tu as la tête sur les nageoires, toi.', 'Perfect. You have got your head screwed on, you have.'],

  // ---- quest 6: the treasure ----
  'q.treasure.title':['Le trésor de l’épave', 'The treasure in the wreck'],
  'q.treasure.find': ['Trouve le trésor dans l’épave', 'Find the treasure in the wreck'],
  'q.treasure.back': ['Rapporte le trésor à {name}', 'Bring the treasure back to {name}'],
  'q.treasure.1':    ['Ah, un client ! Non ? Tant pis.', 'Ah, a customer! No? Never mind.'],
  'q.treasure.2':    ['Écoute : dans la vieille épave, à l’est, il y a une perle dorée grosse comme ton œil.', 'Listen: in the old wreck, to the east, there is a golden pearl as big as your eye.'],
  'q.treasure.3':    ['Rapporte-la-moi et je te nettoie les écailles à vie.', 'Bring it back to me and I will clean your scales for life.'],
  'q.treasure.d1':   ['Magnifique ! Allez, viens là, je te fais un brin de toilette.', 'Magnificent! Come here, let me give you a little polish.'],

  // ---- quest 7: the black pearl ----
  'q.cave.title':   ['La perle de la murène', 'The moray’s pearl'],
  'q.cave.find':    ['Récupère la perle noire à la grotte', 'Fetch the black pearl from the cave'],
  'q.cave.back':    ['Rapporte la perle noire à {name}', 'Bring the black pearl back to {name}'],
  'q.cave.1':       ['Chhht… approche. Tu as du cran ?', 'Shhh… come closer. Have you got nerve?'],
  'q.cave.2':       ['La murène garde une perle noire à l’entrée de sa grotte, au sud-ouest.', 'The moray guards a black pearl at the mouth of her cave, to the south-west.'],
  'q.cave.3':       ['Elle claque des dents mais elle est lente. Vise juste et file.', 'She snaps her teeth, but she is slow. Aim true and run.'],
  'q.cave.d1':      ['Tu l’as eue ! Je vais la garder précieusement, dans mon trou.', 'You got it! I shall keep it safe, down in my hole.'],

  // ---- quest 8: the census ----
  'q.census.title': ['Le recensement du récif', 'The reef census'],
  'q.census.obj':   ['Approche les habitants du récif — <b>{n} / 8</b>', 'Get close to the reef’s inhabitants — <b>{n} / 8</b>'],
  'q.census.1':     ['Clic clic ! Tu arrives à point : moi, je compte tout ce qui bouge ici.', 'Click click! Good timing: I count everything that moves around here.'],
  'q.census.2':     ['Mais j’ai huit pattes et pas de nageoires. Approche-toi de huit espèces différentes —', 'But I have eight legs and no fins. Get close to eight different species —'],
  'q.census.3':     ['poissons, tortue, raie, méduse, pieuvre… — et reviens me dire ce que tu as vu.', 'fish, turtle, ray, jellyfish, octopus… — then come back and tell me what you saw.'],
  'q.census.d1':    ['Huit espèces ! Je note, je note. Te voilà un vrai habitant du récif.', 'Eight species! Noting it down, noting it down. You are a true reef-dweller now.'],

  // ---- small talk for when there is nothing to do ----
  'idle.tang':     ['Tu sais nager en cercles ? Moi j’adore ! …attends, qu’est-ce que je disais ?', 'Can you swim in circles? I love it! …wait, what was I saying?'],
  'idle.idol':     ['Ce récif est immense. Enfin, pour nous.', 'This reef is enormous. For us, anyway.'],
  'idle.puffer':   ['Ne me chatouille pas, je gonfle pour un rien.', 'Do not tickle me, I puff up at the slightest thing.'],
  'idle.star':     ['Le creu, c’est là que tout commence et que tout finit.', 'The drop-off — that is where everything begins and everything ends.'],
  'idle.seahorse': ['ATCHOUM ! …pardon. Les spores de laminaires.', 'ACHOO! …sorry. Kelp spores.'],
  'idle.shrimp':   ['Un petit nettoyage ? C’est gratuit pour les amis.', 'A quick clean? Free for friends.'],
  'idle.turtle':   ['J’ai une vue imprenable, d’ici.', 'I have got quite a view from up here.'],
  'idle.octopus':  ['Chhht. Je préfère qu’on ne me voie pas.', 'Shhh. I would rather not be seen.'],
  'idle.crab':     ['Clic ! Clic ! Ne marche pas sur mes pattes.', 'Click! Click! Mind my legs.'],
  'idle.none':     ['…', '…']
};

var LANG = { code: 'fr', i: 0 };
/** Translated text. `v` fills the `{name}` holes.
      Called `T` and not `t` because `t` is a local variable in fifty-three
      places across these files (interpolation parameter, time, loop counter). A
      global `t` would be shadowed there without a word of warning as you
      write it — and would only throw "t is not a function" once you hit the
      right branch, in game. */
function T(k, v) {
  var e = TXT[k];
  var s = e ? (e[LANG.i] !== undefined ? e[LANG.i] : e[0]) : k;
  if (v) for (var n in v) s = s.split('{' + n + '}').join(v[n]);
  return s;
}

/** Starting choice: whatever the visitor picked last time, otherwise their
      browser's language. `localStorage` can throw (private browsing, blocked
      cookies), and the game has to start anyway. */
function initLang() {
  var saved = null;
  try { saved = localStorage.getItem('recif-lang'); } catch (e) { /* no storage */ }
  var code = (saved === 'fr' || saved === 'en') ? saved
    : ((navigator.language || 'en').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en');
  LANG.code = code;
  LANG.i = code === 'fr' ? 0 : 1;
}

/** Writes every piece of fixed text on the page. */
function applyI18n() {
  var n, i;
  n = document.querySelectorAll('[data-i18n]');
  for (i = 0; i < n.length; i++) n[i].textContent = T(n[i].getAttribute('data-i18n'));
  n = document.querySelectorAll('[data-i18n-html]');
  for (i = 0; i < n.length; i++) n[i].innerHTML = T(n[i].getAttribute('data-i18n-html'));
  n = document.querySelectorAll('[data-i18n-title]');
  for (i = 0; i < n.length; i++) n[i].title = T(n[i].getAttribute('data-i18n-title'));
  document.title = T('ui.title');
  document.documentElement.lang = LANG.code;
  var fr = $('#lang-fr'), en = $('#lang-en');
  if (fr) fr.classList.toggle('on', LANG.code === 'fr');
  if (en) en.classList.toggle('on', LANG.code === 'en');
}

/** Switches language mid-game: the fixed text, then everything the game
      builds itself — without which you end up with a French journal inside an
      English interface. */
function setLang(code) {
  LANG.code = code;
  LANG.i = code === 'fr' ? 0 : 1;
  try { localStorage.setItem('recif-lang', code); } catch (e) { /* tant pis */ }
  applyI18n();
  loaderEl.textContent = T('ui.loading');
  if (typeof setQualityLabel === 'function' && $('#btn-quality')) setQualityLabel();
  if (Q && Q.total) $('#pearls small').textContent = T('hud.quests', { n: Q.total });
  if (Q && Q.defs && Q.defs.length) { updateJournal(); refreshObjective(true); }
  if (Q && Q.dialog) { Q.dialog.lines = Q.dialog.linesFor(); showDialogLine(); }
  var sw = document.getElementById('swim');
  if (sw) sw.textContent = T('hud.swim');
}

initLang();
// The script sits at the end of <body>, so the whole page already exists
// and we can write its text right away — including the loading line, which
// shows before three.js is even there.
applyI18n();
loaderEl.textContent = T('ui.loading');

/* A classic script cannot `return` at the top level, so the guard sets a flag
   that the last file reads before starting anything. The files in between only
   declare things, with one exception: fifteen `var … = new THREE.Vector3()`
   would throw without three.js. They throw into the console and nowhere else —
   each script fails on its own — and the message below is already on screen by
   then, which is all the player sees. */
var REEF_READY = typeof THREE !== 'undefined';
if (!REEF_READY) loaderEl.innerHTML = T('ui.noThree');

/* ------------------------------------------------------------------ */
/* Tunables                                                           */
/* ------------------------------------------------------------------ */
var CFG = {
  WATER_Y: 54,          // height of the surface
  REEF_R: 104,          // radius of the playable reef
  PEARLS: 12,
  JELLIES: 7,
  FOG_FAR: 152,
  SEED: 20260902,
  PLAYER_SPEED: 15.5,
  DASH_MULT: 2.05,
  CURRENT: 0.55         // how hard the current pushes the player (u/s per unit of current)
};

// Palette taken from the film's sets: saturated turquoise water, lavender-
// gris-lavande, coraux saumon / magenta / violet / vert d'eau / ambre.
var PAL = {
  sun:      0xfff1d6,
  sky:      0x6fd6e2,   // water near the surface
  mid:      0x2a92ad,   // water at middle distance
  deep:     0x0d4f73,   // eau profonde, silhouettes lointaines
  bounce:   0xd8c39c,   // light bouncing off the sand (muted)
  occ:      0x11293a,   // bottom of the hollows: midnight blue, never grey
  sand:     0xc3bcac,
  sandDark: 0x9c9686,
  rock:     0x9c96a9,   // lavender-grey of the shelves
  rockDark: 0x6d697f,
  coral: [
    0xf08a72, 0xff9d86, 0xe0637f, 0xc4497e, 0x9c3f78,
    0x8f4f9e, 0x7b5cb8, 0xa87fd8, 0x6e8fd0, 0x8fb4e8,
    0x3fa898, 0x2f8878, 0xe0a86a, 0xf0c68e, 0x9fd8c0
  ],
  algae: [0x4f9e7a, 0x66a85c, 0x2f7d6a, 0x86b06a]
};

/* ------------------------------------------------------------------ */
/* Maths / bruit                                                      */
/* ------------------------------------------------------------------ */
var TAU = Math.PI * 2;
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function damp(cur, target, lambda, dt) { return lerp(cur, target, 1 - Math.exp(-lambda * dt)); }

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var rnd = mulberry32(CFG.SEED);
function rr(a, b) { return a + (b - a) * rnd(); }
function pick(arr) { return arr[(rnd() * arr.length) | 0]; }

function hash2(x, y) {
  var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise2(x, y) {
  var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  var a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
function fbm2(x, y, oct) {
  var v = 0, amp = 0.5, fx = x, fy = y;
  for (var i = 0; i < (oct || 4); i++) { v += amp * noise2(fx, fy); fx *= 2.03; fy *= 1.97; amp *= 0.5; }
  return v;
}

var DROP_ANG = -Math.PI / 2;                           // direction of the drop-off (-Z)
/** Absolute angular distance to a heading, within [0, PI]. */
function angGap(a, b) {
  return Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
}
/** Shape of the sandy floor — used by the geometry AND by the gameplay. */
function floorHeight(x, z) {
  var r = Math.sqrt(x * x + z * z);
  var h = fbm2(x * 0.013, z * 0.013, 4) * 4.2;         // grandes dunes
  h += fbm2(x * 0.075, z * 0.075, 2) * 0.85;           // ondulations
  h += Math.sin(x * 0.09 + Math.cos(z * 0.06) * 2) * 0.35 * smoothstep(60, 10, r); // sand ripples
  h -= smoothstep(0, 46, r) * 1.6;                     // petite cuvette centrale
  // the drop-off: in one sector the reef stops dead and falls into the open blue
  var drop = (1 - smoothstep(0.50, 1.00, angGap(Math.atan2(z, x), DROP_ANG))) * smoothstep(70, 92, r);
  h += smoothstep(CFG.REEF_R - 20, CFG.REEF_R + 55, r) * 15 * (1 - drop);
  h -= drop * (48 + smoothstep(92, 140, r) * 45);
  return h;
}

/* ------------------------------------------------------------------ */
/* Procedural textures                                                */
/* ------------------------------------------------------------------ */
function canvasTex(size, draw) {
  var c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  var t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}
function softSpriteTex() {
  return canvasTex(64, function (g, s) {
    var grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  });
}
function bubbleSpriteTex() {
  return canvasTex(64, function (g, s) {
    g.clearRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 4.5;
    g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 5, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.16)';
    g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 6, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.beginPath(); g.ellipse(s * 0.36, s * 0.32, s * 0.10, s * 0.07, -0.7, 0, TAU); g.fill();
  });
}
