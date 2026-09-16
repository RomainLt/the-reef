#!/usr/bin/env node
/* ====================================================================
   Le Récif — serveur de fichiers, pour faire jouer quelqu'un d'autre.

   Le jeu est un unique `index.html` : il s'ouvre très bien en double-clic,
   et ce serveur n'existe que pour une chose que `file://` ne sait pas faire —
   donner une adresse à taper sur un autre appareil du même Wi-Fi.

   Zéro dépendance, et ce n'est pas de la coquetterie : il n'y a rien à
   compiler ici, donc rien à installer. `node serve.mjs` marche sur une
   machine où `npm install` n'a jamais tourné.

     node serve.mjs            # privé   : seulement cette machine
     node serve.mjs --host     # partagé : ouvert au réseau local
     node serve.mjs --host --port 8080 --no-open

   Par défaut le serveur n'écoute que sur `127.0.0.1`, comme Vite : ouvrir
   un port au réseau est un choix, pas un défaut.
   ==================================================================== */

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { createGzip } from 'node:zlib';
import { spawn } from 'node:child_process';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ARGV = process.argv.slice(2);
const flag = (...names) => names.some((n) => ARGV.includes(n));

const SHARE = flag('--host', '--share');
const OPEN = !flag('--no-open');
const PORT_WANTED = readPort() ?? 5173;

function readPort() {
  const eq = ARGV.find((a) => a.startsWith('--port='));
  if (eq) return Number(eq.slice(7)) || null;
  const i = ARGV.indexOf('--port');
  return i >= 0 ? Number(ARGV[i + 1]) || null : null;
}

/* Assez de types pour ce dossier, et pour ce qu'on pourrait y déposer
   (une capture, un modèle .glb). Le reste part en octet-stream, ce que
   le navigateur télécharge au lieu de l'exécuter : c'est le bon défaut. */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

/* Compresser ce qui se compresse : `index.html` fait 220 ko et tombe à ~50 ko.
   Sur le Wi-Fi c'est un détail, mais dans un tunnel (cloudflared, ngrok) c'est
   la différence entre « ça charge » et « ça rame ». */
const ZIPPABLE = /^(text\/|application\/json|image\/svg)/;

const server = createServer((req, res) => {
  const started = Date.now();
  const url = new URL(req.url, 'http://localhost');
  let file;

  try {
    /* Décodage puis normalisation, dans cet ordre : un `%2e%2e` décodé après
       la normalisation ressortirait un `..` intact. Et on vérifie le résultat
       plutôt que de chercher des motifs interdits dans l'entrée. */
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    file = join(ROOT, rel);
    if (file !== ROOT && !file.startsWith(ROOT + sep)) throw new Error('hors racine');
  } catch {
    return end(403, 'Chemin refusé');
  }

  let st;
  try {
    st = statSync(file);
    if (st.isDirectory()) {
      file = join(file, 'index.html');
      st = statSync(file);
    }
  } catch {
    return end(404, 'Introuvable');
  }

  const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    // Signature : elle sert au contrôle de démarrage ci-dessous à vérifier que
    // l'adresse qu'on s'apprête à afficher mène bien ICI.
    'X-Le-Recif': '1',
    /* Le jeu tient dans ce fichier : le garder en cache, c'est servir une
       version périmée à celui qui recharge après une correction. */
    'Cache-Control': 'no-store',
  };

  if (req.method === 'HEAD') {
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    return res.end(), log(200, st.size);
  }
  if (req.method !== 'GET') return end(405, 'Méthode non gérée');

  const gz = ZIPPABLE.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const src = createReadStream(file);
  src.on('error', () => end(500, 'Lecture impossible'));

  if (gz) {
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
    src.pipe(createGzip()).pipe(res);
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    src.pipe(res);
  }
  res.on('finish', () => log(200, st.size));

  function end(code, msg) {
    if (res.headersSent) return res.destroy();
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(msg + '\n');
    log(code, msg.length);
  }

  /* Une ligne par requête, avec l'adresse du demandeur. C'est le seul moyen
     de trancher le « j'ai envoyé le lien, il ne voit rien » : soit la requête
     arrive et le problème est dans la page, soit elle n'arrive jamais et le
     problème est le pare-feu ou le réseau. */
  function log(code, size) {
    const ip = (req.socket.remoteAddress || '?').replace('::ffff:', '');
    const mark = seen.has(ip) ? ' ' : (seen.add(ip), '+');
    const time = new Date().toTimeString().slice(0, 8);
    console.log(
      `${time} ${mark} ${ip.padEnd(15)} ${String(code)} ${url.pathname.slice(0, 42).padEnd(42)}` +
        ` ${ko(size).padStart(8)}  ${Date.now() - started} ms`
    );
  }
});

const seen = new Set();
const ko = (n) => (typeof n === 'number' ? (n > 1024 ? (n / 1024).toFixed(0) + ' ko' : n + ' o') : '');

/* Port occupé : on prend le suivant, comme Vite. Rien de plus agaçant qu'un
   serveur qui refuse de démarrer parce qu'un onglet d'hier tourne encore. */
let port = PORT_WANTED;
let tries = 0;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && ++tries <= 12) {
    console.log(`  port ${port} occupé, j'essaie ${port + 1}`);
    server.listen(++port, SHARE ? '0.0.0.0' : '127.0.0.1');
  } else {
    console.error('\n  ' + e.message + '\n');
    process.exit(1);
  }
});

/* Toutes les adresses IPv4 non-locales ne se valent pas. Une machine de
   développement en a souvent trois : la carte Wi-Fi, le pont d'une machine
   virtuelle, et le tunnel d'un VPN. Une seule est joignable par le téléphone
   d'à côté, et afficher les trois sans les distinguer, c'est laisser choisir
   au hasard. On classe donc par nom d'interface — et on garde le VPN à
   l'écran plutôt que de le cacher, parce qu'il arrive qu'il soit le bon (deux
   machines sur le même tunnel). */
const VIRTUAL = /^(bridge|vmnet|vboxnet|docker|veth|utun|tun|tap|ppp|awdl|llw|ap\d)/i;

function addresses() {
  const out = [];
  for (const [iface, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs || []) {
      // 169.254.x.x = auto-attribuée faute de DHCP : jamais joignable.
      if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
      out.push({ iface, address: a.address, virtual: VIRTUAL.test(iface) });
    }
  }
  return out.sort((x, y) => x.virtual - y.virtual);
}

/* Un port « libre » ne suffit pas : en mode partagé on écoute sur 0.0.0.0,
   c'est-à-dire en IPv4 seulement, et un autre serveur déjà posé sur
   `[::1]:5173` (IPv6) ne provoque alors AUCUN conflit. Le nôtre démarre donc
   sans erreur, mais « localhost » — que macOS résout d'abord en ::1 — mène
   chez le voisin. C'est arrivé : on a passé un moment à examiner le jeu d'un
   autre projet en croyant regarder celui-ci.

   On vérifie donc l'adresse qu'on va afficher, au lieu de la supposer. */
async function checkOwnUrl() {
  try {
    const r = await fetch('http://localhost:' + port + '/', { method: 'HEAD' });
    return r.headers.get('x-le-recif') === '1';
  } catch {
    return true;   // personne ne répond : c'est forcément nous que l'on verra
  }
}

server.listen(port, SHARE ? '0.0.0.0' : '127.0.0.1', async () => {
  if (!(await checkOwnUrl())) {
    console.log(`  un autre serveur occupe déjà « localhost:${port} », je passe à ${port + 1}`);
    server.close(() => server.listen(++port, SHARE ? '0.0.0.0' : '127.0.0.1'));
    return;
  }
  const lan = addresses();

  console.log('\n  \x1b[1mLe Récif\x1b[0m');
  console.log(`  Local     \x1b[36mhttp://localhost:${port}/\x1b[0m   (cette machine)`);

  if (!SHARE) {
    console.log('  Réseau    — fermé. Ajoutez \x1b[1m--host\x1b[0m pour ouvrir aux autres appareils.');
  } else if (!lan.length) {
    console.log('  Réseau    aucune adresse : cette machine est-elle connectée ?');
  } else {
    let first = true;
    for (const a of lan) {
      const url = `http://${a.address}:${port}/`;
      if (a.virtual) {
        console.log(`  \x1b[2m          ${url}   via ${a.iface}, probablement pas la bonne\x1b[0m`);
      } else {
        console.log(`  Réseau    \x1b[36m${url}\x1b[0m   via ${a.iface}` +
          (first ? '   \x1b[1m← à transmettre\x1b[0m' : ''));
        first = false;
      }
    }
    console.log('\n  Ne transmettez pas « localhost » : chez l\'autre, ce mot désigne');
    console.log('  sa propre machine, donc le lien n\'y mènera jamais nulle part.');
    console.log('\n  Si la page ne s\'ouvre pas chez lui :');
    console.log('   · macOS demande d\'autoriser les connexions entrantes au 1er lancement ;');
    console.log('   · les Wi-Fi « invité » isolent souvent les appareils entre eux ;');
    console.log('   · la page va chercher three.js sur cdnjs : il faut Internet, pas que le Wi-Fi.');
    console.log('\n  Chaque requête est journalisée ci-dessous, « + » = nouvel appareil.');
  }
  console.log('\n  Ctrl+C pour arrêter.\n');

  if (OPEN) {
    const url = `http://localhost:${port}/`;
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    try {
      spawn(cmd, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref();
    } catch { /* pas de navigateur : l'adresse est affichée, ça suffit */ }
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n  arrêté — ${seen.size} appareil${seen.size > 1 ? 's' : ''} vu${seen.size > 1 ? 's' : ''}\n`);
    process.exit(0);
  });
}
