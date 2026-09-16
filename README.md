# Le Récif

> **In English** — *The Reef* is a small underwater exploration game that runs in the
> browser: you play a clownfish, eight reef neighbours each give you a quest. No install,
> no build step — open `index.html`, or play it online. The game is bilingual; use the
> **FR / EN** button in the bottom-right corner. The notes below are in French.


Un jeu d'exploration sous-marine dans un récif de corail, avec un moteur de rendu écrit
à la main : lumière douce enveloppante, ombres portées du soleil, caustiques animées et
occlusion cuite dans les sommets. Tu incarnes un poisson-clown ; huit habitants du récif
te confient chacun une mission.

Aucune bibliothèque de rendu n'est utilisée au-delà de three.js, qui ne sert ici que de
couche WebGL : toutes les matières sont des `ShaderMaterial` écrits pour ce jeu.

## Lancer le jeu

Double-clique sur `index.html` (ou ouvre-le dans ton navigateur). C'est tout.
Une connexion internet est nécessaire au premier chargement : three.js et la police
sont récupérés depuis un CDN.

### Faire jouer quelqu'un sur le même Wi-Fi

`file://` ne se partage pas : il faut une adresse. Le dépôt contient pour ça un
serveur de fichiers sans aucune dépendance — rien à installer, `node` suffit.

```sh
node serve.mjs            # privé   : http://localhost:5173
node serve.mjs --host     # partagé : ouvert au réseau local
```

(ou `npm run dev` / `npm run share`, qui appellent exactement ces deux lignes.)

En mode `--host`, le serveur liste les adresses de la machine et **désigne celle
à transmettre** : une machine de développement en a souvent trois — la carte
Wi-Fi, le pont d'une machine virtuelle, le tunnel d'un VPN — et une seule est
joignable par le téléphone d'à côté. Les autres sont affichées en grisé plutôt
que cachées, parce qu'il arrive que le VPN soit justement le bon.

Ne transmets jamais `localhost` : chez l'autre, ce mot désigne sa propre machine.

Chaque requête est ensuite journalisée avec l'adresse du demandeur, `+` marquant
un nouvel appareil. C'est ce qui permet de trancher le « je ne vois rien » : soit
la requête arrive et le problème est dans la page, soit elle n'arrive jamais et
le problème est le réseau.

Trois choses qui font échouer le partage :

- macOS demande d'autoriser les connexions entrantes au premier lancement ;
- les Wi-Fi « invité » isolent souvent les appareils les uns des autres — les
  deux sont sur le même réseau mais ne se voient pas ;
- la page va chercher three.js sur cdnjs : il faut **Internet**, pas seulement
  le Wi-Fi.

Pour un lien accessible hors du réseau local, il faut un tunnel :
`cloudflared tunnel --url http://localhost:5173`, ou ngrok.

Options : `--port 8080` pour changer de port (si le port est pris, le suivant est
essayé, comme Vite), `--no-open` pour ne pas ouvrir le navigateur.

## Français / English

Le jeu est bilingue. Il choisit la langue du navigateur au premier lancement, et
le bouton **FR / EN** en bas à droite bascule à tout moment — y compris en pleine
partie : les dialogues, le journal et l'objectif en cours se réécrivent. Le choix
est retenu d'une visite à l'autre.

Toutes les chaînes vivent dans un seul objet `TXT` en haut du script, une paire
`['français', 'english']` par ligne, pour que les deux versions se lisent côte à
côte et qu'une traduction qui dérive se voie. Rien n'est écrit en dur, pas même
le français : la langue par défaut se mettrait sinon à diverger du dictionnaire
dès la première retouche. Les textes fixes de la page portent un attribut
`data-i18n` ; le reste passe par `T('clé', { trou: valeur })`.

La fonction s'appelle `T` et non `t` parce que `t` sert de variable locale à
cinquante-trois endroits du fichier (temps, interpolation, compteur de boucle) —
une globale `t` y serait masquée sans un mot d'erreur.

## Commandes

| Touche | Action |
|---|---|
| `Z Q S D` / `W A S D` / flèches | nager |
| Souris (glisser, ou clic pour capturer) | regarder |
| `Maj` | accélérer |
| `Espace` / `Ctrl` | monter / descendre |
| `E` | parler à un habitant |
| `J` | ouvrir le journal de quêtes |
| Molette | éloigner ou rapprocher la caméra |
| `P` / `Échap` | pause |

**Sur téléphone ou tablette**, le premier appui fait basculer l'interface : glisser
pour regarder, un bouton **NAGER** en bas à gauche, et l'invite « parler à … »
devient elle-même le bouton — au doigt il n'y a pas de touche `E`. La bulle de
dialogue s'avance en la touchant, et l'interface se réorganise sous 760 px de
large pour que rien ne se recouvre.

## Le récif et ses habitants

Huit habitants confient chacun une mission. Un `!` doré au-dessus de la tête signale
une quête à prendre, un `?` une quête à rendre ; la flèche dorée pointe toujours
l'objectif courant, et `J` ouvre le journal.

| Habitant | Quête |
|---|---|
| Doria, le chirurgien bleu | retrouver les 12 perles de nacre |
| Ballon, le poisson-globe | déloger 3 oursins de son corail |
| Sheldon, l'hippocampe | récupérer 5 coquillages dans la forêt de laminaires |
| Pêche, l'étoile de mer | guider un bébé tortue jusqu'au tombant |
| Gill, l'idole des Maures | se cacher dans une anémone pendant que le requin passe |
| Jacques, la crevette | rapporter le trésor de l'épave |
| Perle, la pieuvre | voler la perle noire à la murène |
| Pince, le crabe | recenser 8 espèces différentes |

Côté faune, le récif est aussi habité par un **grand requin blanc** et un **requin-marteau**
qui patrouillent au large du tombant (ils foncent si on s'expose — une anémone **coupe** la
poursuite : le requin perd sa trace, la teinte rouge de l'eau se vide, et il repart vers le
large en nageant ; on garde une seconde et demie de répit en ressortant),
une **raie** qui planera au-dessus des massifs, des **tortues**, des **bancs** de sept espèces,
des **méduses**, des **crabes**, des **anguilles de jardin** qui rentrent dans le sable quand
on approche, des **bénitiers** qui se referment, une **murène** dans sa grotte, et une
**baleine** qui traverse le grand bleu de loin en loin.

Six lieux ont leur propre ambiance lumineuse (la couleur de l'eau, la brume et les caustiques
se déplacent avec le joueur) : **le tombant** vers le grand bleu, **la forêt de laminaires**,
**l'épave**, **la grotte de la murène**, **le jardin d'anémones** (la maison) et
**les sources de bulles**.

## Ce qu'il y a sous le capot

Tout est dans `index.html` (un seul fichier, aucune dépendance à installer).
three.js sert uniquement de couche WebGL : la géométrie et les shaders sont maison.

**Le rendu** cherche le rendu des décors du film — pas du cel-shading : aucun trait
d'encre, tout se joue sur la douceur de la lumière et la profondeur des creux.

- **Ombres portées du soleil** : une passe de profondeur orthographique (2048², qui suit le
  joueur et s'aligne sur la grille de texels pour ne pas scintiller) ; les coraux, la roche et
  les animaux projettent une vraie ombre, et les caustiques sont bloquées avec la lumière.
- `softShade()` : diffuse enveloppante (`dot(N,L)*0.42+0.58` élevée à une puissance) au lieu
  de paliers francs, ambiance hémisphérique (turquoise du dessus, rebond chaud du sable
  dessous), reflet large, liseré discret, et translucidité (`sss`) pour les tentacules
  et les nageoires que la lumière traverse.
- **Occlusion cuite dans la géométrie** : chaque sommet porte un attribut `aOcc` calculé
  à la construction — dessous des plateaux, creux entre les bosses d'un corail
  (`occBySpheres`), fond des sillons d'un corail cerveau, base des props. C'est ce qui
  donne les noirs profonds du film là où la lumière n'entre pas.
- **Ombres de contact** : un disque dégradé sous chaque corail, posé sur la roche ou
  épousant le relief du sable, tout fusionné en un seul maillage transparent.
- `caustics()` : réseau de veines lumineuses (les crêtes d'une somme de sinusoïdes),
  appliqué sur *tous* les objets, pondéré par l'orientation de la normale.
- **L'eau** : un dôme dégradé en fond (bleu profond en bas, turquoise vers la surface),
  absorption exponentielle qui bleuit le lointain, surface vue d'en dessous avec réseau
  de rides et disque solaire, et rayons de lumière volumétriques.
- **Post-traitement** : bloom en trois passes, **profondeur de champ** (le lointain se dilue,
  pilotée par la texture de profondeur), **rayons de soleil** en flou radial vers le soleil,
  courbe filmique, étalonnage, anticrénelage, vignettage, léger flottement liquide et
  teinte rouge quand un prédateur fonce.
- **Micro-relief** : la normale est perturbée par du bruit dans le plan tangent (`uBump`),
  ce qui donne du grain aux coraux et à la roche sans un triangle de plus.

**Le courant** est un seul vecteur global (`U.uCurrent`, direction × force) qui tourne
lentement — deux sinusoïdes de périodes incommensurables, 41 s et 67 s, pour qu'on ne
devine pas la boucle. Toute la végétation s'y penche, avec des rafales qui *traversent* le
récif, et une ondulation qui remonte chaque brin : c'est ce qui fait la différence entre
un décor qui bouge et un décor qui bouge *ensemble*. Les particules suivent
`U.uDrift`, l'intégrale du courant — les mêmes rafales emportent donc la poussière et
penchent les coraux. Le joueur est poussé lui aussi, faiblement (0,35 u/s contre 15,5 de
nage, et zéro à l'abri d'une anémone).

**L'anémone hôte** est celle du film, et pas au hasard : les brins sont des tubes arqués à
bout hémisphérique, épais d'environ un dixième de leur longueur, plantés en spirale dorée
sur un disque oral — plus longs au centre, plus couchés au bord, d'où le dôme. Le dégradé
saumon → pêche → crème est cuit **le long du brin** et non selon la hauteur dans le monde,
pour qu'un brin couché garde sa pointe claire ; le magenta est réservé à la colonne, qui
porte ses plis verticaux. Chaque brin a sa propre phase et une souplesse (`aSway`) de 4,4
là où une pointe de corail est à 1, ce qui lui donne ~15 % de sa longueur de course.

**Les anémones pompons** (celles semées partout, par centaines) ne pouvaient pas avoir
les mêmes brins : elles sont **698** dans le récif et représentent à elles seules un quart
de toute la géométrie posée — 594 000 triangles sur 2,42 millions, compté et pas estimé.
Leur donner le brin de l'anémone hôte aurait coûté neuf millions de triangles.

Ce qui trahit l'aiguille, c'est la pointe, pas le nombre de brins. Un tube à six faces
dont seuls les quatorze derniers pour cent se referment coûte 36 triangles là où le cône
à quatre faces en coûtait 8 — mais on peut alors se contenter de **trois fois moins de
brins**, plus gros et plus courts, biaisés vers le haut du dôme (réparti sur toute la
demi-sphère, il en dépassait un crâne chauve). Le dôme lui-même est passé de 10×7 à 7×4
segments, ce qui paie la différence. Résultat mesuré : **587 500 triangles**, soit un peu
moins qu'avant, pour une bête qui ressemble à une anémone et non plus à un oursin.

**On entend le courant.** Une seconde voix de bruit brun passe dans un passe-bande large
(Q 0,55, 330 → 890 Hz) dont le niveau, la brillance et la place dans le stéréo suivent le
courant : la rafale sonore est recalculée **avec la formule du shader**, à la position du
joueur. Recopier cette formule est le prix à payer pour que l'oreille et l'œil parlent de
la même vague — une enveloppe indépendante aurait été plus simple et aurait sonné faux, en
gonflant pile quand les coraux se redressent. Corrélation mesurée entre la rafale visible
et le gain entendu : **0,997**. Le panoramique s'inverse quand on se retourne, et le lit
d'ambiance s'ouvre un peu dans les rafales, pour qu'on entende « l'eau bouge » plutôt
qu'un souffle posé par-dessus. Les paramètres sont pilotés par `setTargetAtTime` (approche
exponentielle, donc aucun clic) à 8 Hz plutôt qu'à chaque image.

**Les phases d'animation sont accumulées** (`uBeat += dt × cadence`), jamais recalculées
depuis `uTime × cadence`. Ça compte dès qu'une cadence varie : celle de la nage suit la
vitesse du joueur, et le produit faisait sauter la phase de `uTime × Δcadence` d'une image
à l'autre — un saut proportionnel à la durée de la partie, qui se voyait comme une
vibration du corps. Mesuré : 0,89 rad de saut par image (et deux marches arrière par
seconde) contre 0,18 rad d'avance régulière après correction.

**Le récif** est procédural et rejouable à l'identique (`CFG.SEED`). Sa grammaire vient
des décors du film : des **massifs de plateaux de roche empilés** (gris-lavande, portés par
des colonnes) entièrement encroûtés de coraux — choux-fleurs, cerveaux, branchus, éponges
tubulaires à bouche sombre, anémones (pompons partout, hôtes autour de la maison),
tables frangées, fouets de mer, gorgones,
plateaux d'algues — semés par touffes d'une même espèce, avec des vallées de sable entre
les massifs.

**Performance** : tout le décor statique d'un massif est fusionné (indexé) en 3 maillages
— rigide / souple / feuilles double face — soit ~200 appels de dessin pour plusieurs
milliers de coraux. La couleur, la phase d'ondulation et l'occlusion de chaque prop
voyagent dans des attributs de sommets (`aColor`, `aPhase`, `aSway`, `aOcc`), ce qui permet
de tout peindre avec **trois** matériaux.

**Le son** est synthétisé à la volée avec l'API Web Audio (bruit brun filtré pour
l'ambiance, arpèges pour les perles) — aucun fichier audio.

## Réglages utiles

En haut du script :

```js
var CFG = { WATER_Y: 54, REEF_R: 104, PEARLS: 12, JELLIES: 7,
            FOG_FAR: 152, SEED: 20260902, PLAYER_SPEED: 15.5, DASH_MULT: 2.05,
            CURRENT: 0.55 };                            // poussée du courant
var PAL = { sun: …, sky: …, mid: …, deep: …, occ: …,   // les creux
            rock: 0x9c96a9,                            // gris-lavande des plateaux
            coral: […], algae: […] };
```

Change `SEED` pour générer un tout autre récif. Le bouton **Qualité** (en bas à droite)
fait varier la résolution de rendu, le bloom et les traits d'encre ; le jeu baisse la
qualité tout seul si la machine peine.

Depuis la console du navigateur, `window.__reef` expose `scene`, `camera`, `player`, `world`,
`U` (les uniforms partagés), `CFG`, `SND` (le moteur audio), `CUR` (l'état du courant),
`LANG`, `T` et `setLang` — pratique pour bidouiller en direct, par exemple :

```js
__reef.U.uCaustics.value = 3     // caustiques exagérées
__reef.CFG.PLAYER_SPEED = 40     // poisson fusée
__reef.U.uCurrent.value.set(3, 0)   // tempête (elle se rétablit en quelques secondes)
__reef.SND.setCurrent(1.4, -1)      // souffle fort à gauche, pour entendre la voix seule
__reef.setLang('en')                // bascule immédiate, journal compris
```
