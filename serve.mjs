#!/usr/bin/env node
/* ====================================================================
   The Reef — a file server, for letting somebody else play.

   The game is a single `index.html`: it opens perfectly well on a
   double-click, and this server exists for one thing `file://` cannot do —
   give you an address to type on another device on the same Wi-Fi.

   Zero dependencies, and that is not affectation: there is nothing to build
   here, so there is nothing to install. `node serve.mjs` runs on a machine
   where `npm install` has never been typed.

     node serve.mjs            # private : this machine only
     node serve.mjs --host     # shared  : open to the local network
     node serve.mjs --host --port 8080 --no-open

   By default the server only listens on `127.0.0.1`, like Vite: opening a
   port to the network is a decision, not a default.
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

/* Enough types for this folder, and for what one might drop into it (a
   screenshot, a .glb model). Anything else goes out as octet-stream, which
   the browser downloads instead of executing: the right default. */
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

/* Compress what compresses: `index.html` is 220 kB and drops to ~50 kB.
   Over Wi-Fi that is a detail, but through a tunnel (cloudflared, ngrok) it
   is the difference between "it loads" and "it crawls". */
const ZIPPABLE = /^(text\/|application\/json|image\/svg)/;

const server = createServer((req, res) => {
  const started = Date.now();
  const url = new URL(req.url, 'http://localhost');
  let file;

  try {
    /* Decode, then normalise, in that order: a `%2e%2e` decoded after
           normalisation would come back out as an intact `..`. And we check the
           result rather than hunting for forbidden patterns in the input. */
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    file = join(ROOT, rel);
    if (file !== ROOT && !file.startsWith(ROOT + sep)) throw new Error('outside root');
  } catch {
    return end(403, 'Path refused');
  }

  let st;
  try {
    st = statSync(file);
    if (st.isDirectory()) {
      file = join(file, 'index.html');
      st = statSync(file);
    }
  } catch {
    return end(404, 'Not found');
  }

  const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    // Signature: the start-up check below uses it to confirm that the address
    // we are about to print really does lead HERE.
    'X-Le-Recif': '1',
    /* The game fits in this one file: caching it means serving a stale
           version to anyone who reloads after a fix. */
    'Cache-Control': 'no-store',
  };

  if (req.method === 'HEAD') {
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    return res.end(), log(200, st.size);
  }
  if (req.method !== 'GET') return end(405, 'Method not supported');

  const gz = ZIPPABLE.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const src = createReadStream(file);
  src.on('error', () => end(500, 'Cannot read that'));

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

  /* One line per request, with the caller's address. It is the only way to
       settle "I sent the link, they see nothing": either the request arrives and
       the problem is in the page, or it never arrives and the problem is the
       firewall or the network. */
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

/* Port taken: take the next one, like Vite. Nothing is more irritating than
   a server that refuses to start because a tab from yesterday is still up. */
let port = PORT_WANTED;
let tries = 0;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && ++tries <= 12) {
    console.log(`  port ${port} is taken, trying ${port + 1}`);
    server.listen(++port, SHARE ? '0.0.0.0' : '127.0.0.1');
  } else {
    console.error('\n  ' + e.message + '\n');
    process.exit(1);
  }
});

/* Not every non-local IPv4 address is worth the same. A development machine
   often has three: the Wi-Fi card, the bridge of a virtual machine, and a VPN
   tunnel. Only one is reachable from the phone next to you, and printing all
   three without distinguishing them leaves the choice to chance. So we sort by
   interface name — and we keep the VPN on screen rather than hiding it,
   because sometimes it is the right one (two machines on the same tunnel). */
const VIRTUAL = /^(bridge|vmnet|vboxnet|docker|veth|utun|tun|tap|ppp|awdl|llw|ap\d)/i;

function addresses() {
  const out = [];
  for (const [iface, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs || []) {
      // 169.254.x.x = self-assigned for want of DHCP: never reachable.
      if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
      out.push({ iface, address: a.address, virtual: VIRTUAL.test(iface) });
    }
  }
  return out.sort((x, y) => x.virtual - y.virtual);
}

/* A "free" port is not enough: in shared mode we listen on 0.0.0.0, that is
   to say on IPv4 only, and another server already sitting on `[::1]:5173`
   (IPv6) therefore causes NO conflict at all. Ours starts without an error,
   but "localhost" — which macOS resolves to ::1 first — leads to the
   neighbour. This happened: we spent a while examining another project's game
   believing we were looking at this one.

   So we check the address we are about to print, instead of assuming it. */
async function checkOwnUrl() {
  try {
    const r = await fetch('http://localhost:' + port + '/', { method: 'HEAD' });
    return r.headers.get('x-le-recif') === '1';
  } catch {
    return true;   // nobody answers: then it can only be us that people will reach
  }
}

server.listen(port, SHARE ? '0.0.0.0' : '127.0.0.1', async () => {
  if (!(await checkOwnUrl())) {
    console.log(`  another server already holds "localhost:${port}", moving to ${port + 1}`);
    server.close(() => server.listen(++port, SHARE ? '0.0.0.0' : '127.0.0.1'));
    return;
  }
  const lan = addresses();

  console.log('\n  \x1b[1mThe Reef\x1b[0m');
  console.log(`  Local     \x1b[36mhttp://localhost:${port}/\x1b[0m   (this machine)`);

  if (!SHARE) {
    console.log('  Network   — closed. Add \x1b[1m--host\x1b[0m to open it to other devices.');
  } else if (!lan.length) {
    console.log('  Network   no address at all: is this machine connected?');
  } else {
    let first = true;
    for (const a of lan) {
      const url = `http://${a.address}:${port}/`;
      if (a.virtual) {
        console.log(`  \x1b[2m          ${url}   via ${a.iface}, probably not the one\x1b[0m`);
      } else {
        console.log(`  Network   \x1b[36m${url}\x1b[0m   via ${a.iface}` +
          (first ? '   \x1b[1m← share this one\x1b[0m' : ''));
        first = false;
      }
    }
    console.log('\n  Do not share "localhost": on their machine, that word means');
    console.log('  their own computer, so the link will never lead anywhere there.');
    console.log('\n  If the page does not open for them:');
    console.log('   · macOS asks you to allow incoming connections the first time;');
    console.log('   · guest Wi-Fi often isolates devices from one another;');
    console.log('   · the page fetches three.js from cdnjs: it needs the internet, not just Wi-Fi.');
    console.log('\n  Every request is logged below; "+" marks a new device.');
  }
  console.log('\n  Ctrl+C to stop.\n');

  if (OPEN) {
    const url = `http://localhost:${port}/`;
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    try {
      spawn(cmd, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref();
    } catch { /* no browser: the address is printed, that will do */ }
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n  stopped — ${seen.size} device${seen.size > 1 ? 's' : ''} seen\n`);
    process.exit(0);
  });
}
