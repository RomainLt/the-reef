# The Reef

An underwater exploration game set in a coral reef, with a renderer written by hand:
soft wrapped light, cast sun shadows, animated caustics and occlusion baked into the
vertices. You play a small clownfish; eight reef neighbours each give you a quest.

No rendering library is used beyond three.js, which serves here only as a WebGL layer:
every surface is a `ShaderMaterial` written for this game.

## Running it

Double-click `index.html` (or open it in your browser). That is all — the game runs
straight off the file system, with no build step and no server.
An internet connection is needed on first load: three.js and the font come from a CDN.

### Letting somebody on the same Wi-Fi play

`file://` cannot be shared: you need an address. The repository contains a file server
for that, with no dependencies at all — nothing to install, `node` is enough.

```sh
node serve.mjs            # private : http://localhost:5173
node serve.mjs --host     # shared  : open to the local network
```

(or `npm run dev` / `npm run share`, which call exactly those two lines.)

In `--host` mode the server lists the machine's addresses and **points at the one to
share**: a development machine often has three — the Wi-Fi card, a virtual machine's
bridge, a VPN tunnel — and only one is reachable from the phone next to you. The others
are shown greyed out rather than hidden, because sometimes the VPN is the right one.

Never share `localhost`: on somebody else's machine that word means their own computer.

Every request is then logged with the caller's address, `+` marking a new device. That is
what settles "I see nothing": either the request arrives and the problem is in the page,
or it never arrives and the problem is the network.

Three things that make sharing fail:

- macOS asks you to allow incoming connections the first time;
- guest Wi-Fi often isolates devices from one another — both are on the same network but
  cannot see each other;
- the page fetches three.js from cdnjs: it needs **the internet**, not just Wi-Fi.

For a link that works outside the local network you need a tunnel:
`cloudflared tunnel --url http://localhost:5173`, or ngrok.

Options: `--port 8080` to change port (if the port is taken the next one is tried, as Vite
does), `--no-open` to skip opening the browser.

## Français / English

The game is bilingual. It picks the browser's language on first load, and the **FR / EN**
button in the bottom-right corner switches at any time — mid-game included: the dialogue,
the journal and the current objective are rewritten. The choice is remembered between
visits.

Every string lives in a single `TXT` object at the top of the script, one
`['français', 'english']` pair per line, so that the two versions read side by side and a
translation that drifts shows up. Nothing is hard-coded, not even the French: otherwise
the default language starts drifting from the dictionary the first time anyone edits it.
Fixed text on the page carries a `data-i18n` attribute; everything else goes through
`T('key', { hole: value })`.

The function is called `T` and not `t` because `t` is a local variable in fifty-three
places across these files (time, interpolation, loop counter) — a global `t` would be
shadowed there without a word of warning.

## Controls

| Key | Action |
|---|---|
| `W A S D` / `Z Q S D` / arrows | swim |
| Mouse (drag, or click to capture) | look around |
| `Shift` | sprint |
| `Space` / `Ctrl` | rise / dive |
| `E` | talk to an inhabitant |
| `J` | open the quest journal |
| Wheel | pull the camera in or out |
| `P` / `Esc` | pause |

**On a phone or tablet**, the first tap switches the interface over: drag to look, a
**SWIM** button in the bottom-left corner with a smaller **FAST** just above it, and the
"talk to …" prompt becomes the button itself — there is no `E` key under a finger. FAST
swims and sprints at once, because the dash only applies while moving forward and asking
for a second thumb would make it useless exactly when it is wanted. The dialogue bubble
advances when you touch it, and the interface rearranges below 760 px wide so that
nothing overlaps.

Diving goes fullscreen by itself on a touch device — a browser only grants it from a
gesture, and that tap is one — and the ⛶ button in the corner toggles it either way. On
iPhone the button is absent: Safari reserves the Fullscreen API for `<video>`, so the way
to a full screen there is to add the page to the home screen, which the manifest meta
tags already support.

## The reef and its inhabitants

Eight inhabitants each give you a quest. A golden `!` above a head means a quest to take,
a `?` one to hand in; the golden arrow always points at the current objective, and `J`
opens the journal.

| Inhabitant | Quest |
|---|---|
| Doria, the blue tang | find the 12 scattered pearls |
| Balloon, the pufferfish | push 3 urchins off his coral |
| Sheldon, the seahorse | recover 5 shells from the kelp forest |
| Peach, the starfish | guide a baby turtle to the drop-off |
| Gill, the moorish idol | hide in an anemone while the shark goes past |
| Jacques, the cleaner shrimp | bring back the treasure from the wreck |
| Pearl, the octopus | steal the black pearl from the moray |
| Nipper, the crab | count 8 different species |

The reef is also home to a **great white shark** and a **hammerhead** patrolling out past
the drop-off (they charge if you expose yourself — an anemone **cuts** the chase: the
shark loses your trail, the red tint drains out of the water, and it swims back towards
open water; you keep a second and a half of grace on the way out), a **ray** gliding over
the massifs, **turtles**, **schools** of seven species, **jellyfish**, **crabs**,
**garden eels** that duck into the sand as you approach, **giant clams** that snap shut, a
**moray** in its cave, and a **whale** that crosses the open blue now and then.

Six places have their own light mood (the colour of the water, the haze and the caustics
travel with the player): **the drop-off** into the open blue, **the kelp forest**,
**the wreck**, **the moray's cave**, **the anemone garden** (home) and **the bubble vents**.

## What is under the hood

The game is one program cut into seventeen files under `js/`, loaded in order by
`index.html`. They are **classic scripts**, not ES modules, and that is a deliberate
choice: modules do not load over `file://` — silently — which would cost the
double-click. Classic scripts share the global scope exactly as the code shared one
closure before the split, so there is not a single `import` to write and the bodies are
unchanged.

The numeric prefix is the load order, and the only real constraint: `00-boot.js` defines
`$`, the tunables and the language machinery, which a handful of later declarations use at
load time. Everything else only declares things, so it is order-independent.

`00-boot.js` also holds the three.js guard. A classic script cannot `return` at the top
level, so it sets `REEF_READY`, and `index.html` injects the other sixteen files only if
that flag is true (`async = false` keeps them in order). Without that, a failed CDN would
still execute all sixteen and throw "THREE is not defined" sixteen times into the console.

There is no dependency to install. three.js is only a WebGL layer: the geometry and the
shaders are written here.

**The rendering** aims at the look of the film's sets — not cel shading: no ink lines at
all, everything rests on the softness of the light and the depth of the hollows.

- **Cast sun shadows**: an orthographic depth pass (2048², following the player and
  snapped to the texel grid so it does not shimmer); corals, rock and animals all cast a
  real shadow, and the caustics are blocked along with the light.
- `softShade()`: wrapped diffuse (`dot(N,L)*0.42+0.58` raised to a power) instead of hard
  steps, hemispheric ambient (turquoise from above, a warm bounce off the sand below), a
  broad highlight, a discreet rim, and translucency (`sss`) for the tentacles and fins
  that light passes through.
- **Occlusion baked into the geometry**: every vertex carries an `aOcc` attribute computed
  at build time — undersides of plates, hollows between the lumps of a coral
  (`occBySpheres`), the bottom of a brain coral's grooves, the base of each prop. That is
  what gives the deep blacks of the film where light does not reach.
- **Contact shadows**: a graded disc under each coral, laid on the rock or following the
  shape of the sand, all merged into a single transparent mesh.
- `caustics()`: a net of bright veins (the ridges of a sum of sine waves), applied to
  *every* object, weighted by the orientation of the normal.
- **The water**: a graded dome in the background (deep blue at the bottom, turquoise
  towards the surface), exponential absorption turning the distance blue, the surface seen
  from underneath with a ripple net and a sun disc, and volumetric god rays.
- **Post-processing**: three-pass bloom, **depth of field** (the distance dissolves,
  driven by the depth texture), **sun shafts** as a radial blur towards the sun, a filmic
  curve, grading, anti-aliasing, vignetting, a slight liquid wobble and a red tint when a
  predator charges.
- **Micro-relief**: the normal is perturbed by noise in the tangent plane (`uBump`), which
  gives grain to the corals and the rock without a single extra triangle.

**The current** is one global vector (`U.uCurrent`, direction × strength) turning slowly —
two sine waves with incommensurable periods, 41 s and 67 s, so that you cannot pick out
the loop. All the vegetation leans along it, with gusts that *travel across* the reef, and
a ripple running up each strand: that is the difference between scenery that moves and
scenery that moves *together*. The particles follow `U.uDrift`, the integral of the
current — so the same gusts carry the dust and lean the corals. The player is pushed too,
weakly (0.35 u/s against 15.5 of swimming, and zero inside an anemone).

**The host anemone** is the one from the film, and not by accident: the strands are curved
tubes with hemispherical ends, about a tenth of their length in thickness, planted in a
golden spiral on an oral disc — longer in the middle, more splayed at the rim, hence the
dome. The salmon → peach → cream gradient is baked **along the strand** rather than by
height in the world, so that a splayed strand keeps its pale tip; the magenta is reserved
for the column, which carries its vertical folds. Each strand has its own phase and a
softness (`aSway`) of 4.4 where a coral tip sits at 1, which gives it about 15% of its own
length in travel.

**The pompom anemones** (the ones scattered everywhere, by the hundred) could not have the
same strands: there are **698** of them in the reef and they alone account for a quarter
of all the geometry placed — 594,000 triangles out of 2.42 million, counted rather than
guessed. Giving them the host anemone's strand would have cost nine million triangles.

What gives away a needle is the tip, not the number of strands. A six-sided tube whose
last fourteen per cent are the only part that closes costs 36 triangles where the
four-sided cone cost 8 — but you can then make do with **a third as many strands**, fatter
and shorter, biased towards the top of the dome (spread over the whole hemisphere, a bald
patch showed through). The dome itself went from 10×7 to 7×4 segments, which pays the
difference. Measured result: **587,500 triangles**, slightly fewer than before, for a
creature that looks like an anemone rather than a sea urchin.

**You can hear the current.** A second voice of brown noise runs through a wide band-pass
(Q 0.55, 330 → 890 Hz) whose level, brightness and stereo position follow the current: the
audible gust is recomputed **with the shader's own formula**, at the player's position.
Copying that formula is the price of having ear and eye talk about the same wave — an
independent envelope would have been simpler and would have rung false, swelling just as
the corals straighten up. Measured correlation between the visible gust and the audible
gain: **0.997**. The stereo image flips when you turn around, and the ambient bed opens a
little during gusts, so that you hear "the water is moving" rather than a rush laid over
it. The parameters are driven by `setTargetAtTime` (an exponential approach, so no clicks)
at 8 Hz rather than every frame.

**Animation phases are accumulated** (`uBeat += dt × rate`), never recomputed from
`uTime × rate`. That matters as soon as a rate varies: the swim rate follows the player's
speed, and the product made the phase jump by `uTime × Δrate` from one frame to the next —
a jump proportional to the length of the session, which showed up as the body shivering.
Measured: 0.89 rad of jump per frame (and two steps backwards per second) against 0.18 rad
of steady progress after the fix.

**The reef** is procedural and reproducible (`CFG.SEED`). Its grammar comes from the
film's sets: **massifs of stacked rock plates** (lavender-grey, held up by columns)
entirely encrusted with coral — cauliflowers, brains, branching acropora, tube sponges
with dark mouths, anemones (pompoms everywhere, host anemones around home), fringed
tables, sea whips, sea fans, algae plates — sown in tufts of a single species, with sand
valleys between the massifs.

**Performance**: all the static scenery of a massif is merged (indexed) into 3 meshes —
hard / soft / double-sided leaves — that is ~200 draw calls for several thousand corals.
The colour, the sway phase and the occlusion of each prop travel in vertex attributes
(`aColor`, `aPhase`, `aSway`, `aOcc`), which is what allows the whole scene to be painted
with **three** materials.

**The sound** is synthesised on the fly with the Web Audio API (filtered brown noise for
the ambience, arpeggios for the pearls) — no audio files at all.

## Useful knobs

At the top of the script:

```js
var CFG = { WATER_Y: 54, REEF_R: 104, PEARLS: 12, JELLIES: 7,
            FOG_FAR: 152, SEED: 20260902, PLAYER_SPEED: 15.5, DASH_MULT: 2.05,
            CURRENT: 0.55 };                            // push of the current
var PAL = { sun: …, sky: …, mid: …, deep: …, occ: …,   // the hollows
            rock: 0x9c96a9,                            // lavender-grey of the plates
            coral: […], algae: […] };
```

Change `SEED` to generate an entirely different reef. The **Quality** button (bottom
right) varies the render resolution, the bloom and the depth of field; the game lowers the
quality by itself if the machine is struggling.

From the browser console, `window.__reef` exposes `scene`, `camera`, `player`, `world`,
`U` (the shared uniforms), `CFG`, `SND` (the audio engine), `CUR` (the state of the
current), `LANG`, `T` and `setLang` — handy for poking at it live, for instance:

```js
__reef.U.uCaustics.value = 3        // exaggerated caustics
__reef.CFG.PLAYER_SPEED = 40        // rocket fish
__reef.U.uCurrent.value.set(3, 0)   // a storm (it settles again within seconds)
__reef.SND.setCurrent(1.4, -1)      // a strong rush to the left, to hear the voice alone
__reef.setLang('fr')                // switches at once, journal included
```

## License

MIT — see [LICENSE](LICENSE). three.js, loaded from a CDN, is MIT as well.
