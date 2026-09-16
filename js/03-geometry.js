/* The Reef — Procedural geometry: rock, coral, anemones, plants
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* GEOMETRY BUILDERS — the reef is entirely procedural                 */
/* ================================================================== */

/** Fish body: a shaped sphere, snout towards +Z, tail towards -Z. */
function fishBodyGeo(width, height, opt) {
  opt = opt || {};
  var geo = new THREE.SphereGeometry(1, opt.seg || 22, opt.seg2 || 14);
  var p = geo.attributes.position, v = new THREE.Vector3();
  for (var i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    var t = clamp((v.z + 1) * 0.5, 0, 1);                 // 0 = queue, 1 = museau
    var prof = 0.13 + 0.87 * Math.pow(Math.sin(Math.pow(t, 0.78) * Math.PI), 0.62);
    var belly = 1 + (opt.belly || 0.12) * smoothstep(0.15, 0.55, t) * (v.y < 0 ? 1 : 0.25);
    var head = 1 + (opt.head || 0) * smoothstep(0.45, 1.0, t);
    p.setXYZ(i,
      v.x * prof * width * head,
      v.y * prof * height * belly * (1 + (opt.head || 0) * 0.35 * smoothstep(0.5, 1.0, t))
        + (opt.arch || 0.04) * Math.sin(t * Math.PI),
      v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Darkens the rim of a fin and lightens its base. */
function finEdge(geo, r0, r1, kRoot, kEdge) {
  ensureAttrs(geo);
  var p = geo.attributes.position, a = geo.attributes.aColor;
  for (var i = 0; i < p.count; i++) {
    var d = Math.sqrt(p.getX(i) * p.getX(i) + p.getY(i) * p.getY(i));
    var k = lerp(kRoot, kEdge, smoothstep(r0, r1, d));
    a.setXYZ(i, k, k, k);
  }
  return geo;
}

/** Fin: an extruded 2D polygon. */
function finGeo(pts, thick) {
  var shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  var g = new THREE.ExtrudeGeometry(shape, { depth: thick || 0.05, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -(thick || 0.05) * 0.5);
  return g;
}

/* ---------- outils communs ---------- */
var YAXIS = new THREE.Vector3(0, 1, 0);
/** Gradually lightens/darkens through aColor (paler tips, and so on). */
function rampColor(geo, y0, y1, k0, k1) {
  ensureAttrs(geo);
  var p = geo.attributes.position, a = geo.attributes.aColor;
  for (var i = 0; i < p.count; i++) {
    var k = lerp(k0, k1, smoothstep(y0, y1, p.getY(i)));
    a.setXYZ(i, a.getX(i) * k, a.getY(i) * k, a.getZ(i) * k);
  }
  return geo;
}
/** Hollows out the lid of a cylinder into a dark mouth (sponges). */
function dimpleTop(geo, depth, shrink, occ) {
  ensureAttrs(geo);
  var p = geo.attributes.position, n = geo.attributes.normal, a = geo.attributes.aOcc;
  for (var i = 0; i < p.count; i++) {
    if (n.getY(i) > 0.9) {
      p.setXYZ(i, p.getX(i) * shrink, p.getY(i) - depth, p.getZ(i) * shrink);
      a.setX(i, occ);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
/** A tapered tentacle growing from a point in a direction, soft at the tip. */
function tentaclePart(pos, dir, len, r0, r1, seg) {
  var g = new THREE.ConeGeometry(r1, len, seg || 4, 1, false);
  g.translate(0, len * 0.5, 0);
  swayByHeight(g, 0, len, 1.35);
  return {
    geo: g,
    matrix: new THREE.Matrix4().compose(pos,
      new THREE.Quaternion().setFromUnitVectors(YAXIS, dir), new THREE.Vector3(1, 1, 1))
  };
}

/* ---------- THE signature shape: the rock shelf ---------- */
/** A rock plate with a rounded edge and a ragged outline. */
function shelfGeo(seed, R, thick) {
  var R2 = mulberry32(seed), sd = R2() * 12, t = thick;
  var pts = [
    new THREE.Vector2(0.002, t * 0.50),
    new THREE.Vector2(R * 0.52, t * 0.50),
    new THREE.Vector2(R * 0.90, t * 0.44),
    new THREE.Vector2(R * 1.00, t * 0.12),
    new THREE.Vector2(R * 0.98, -t * 0.24),
    new THREE.Vector2(R * 0.78, -t * 0.50),
    new THREE.Vector2(R * 0.34, -t * 0.46),
    new THREE.Vector2(0.002, -t * 0.40)
  ];
  var g = new THREE.LatheGeometry(pts, 24);
  var p = g.attributes.position, v = new THREE.Vector3();
  for (var i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    var a = Math.atan2(v.z, v.x);
    var k = 1 + fbm2(Math.cos(a) * 2.3 + sd, Math.sin(a) * 2.3 - sd, 3) * 0.34;
    var rel = Math.sqrt(v.x * v.x + v.z * v.z) / R;
    p.setXYZ(i, v.x * k, v.y + Math.sin(a * 2 + sd) * t * 0.4 * rel, v.z * k);
  }
  g.computeVertexNormals();
  occByHeight(g, -t * 0.5, t * 0.5, 0.42);        // underside of the plates: dark
  return g;
}

/* ---------- coraux ---------- */
/** "Cauliflower" coral: a cluster of lumps with occluded hollows. */
function knobCoralGeo(seed, lumps) {
  var R2 = mulberry32(seed), parts = [], spheres = [[0, 0.52, 0, 0.60]];
  lumps = lumps || 7;
  for (var i = 0; i < lumps; i++) {
    var a = R2() * TAU, b = 0.12 + R2() * 1.05, d = 0.42 + R2() * 0.52;
    var r = 0.28 + R2() * 0.30;
    spheres.push([Math.cos(a) * Math.sin(b) * d, 0.48 + Math.cos(b) * d * 0.9 + r * 0.15,
                  Math.sin(a) * Math.sin(b) * d, r]);
  }
  for (i = 0; i < spheres.length; i++) {
    var s = spheres[i];
    parts.push({
      geo: new THREE.SphereGeometry(s[3], 6, 5),
      matrix: TRS(s[0], s[1], s[2], 0, 0, 0, 1, 0.85 + (i % 3) * 0.12, 1)
    });
  }
  var out = mergeGeos(parts);
  occBySpheres(out, spheres, 0.55);
  occByHeight(out, 0, 1.2, 0.5);
  rampColor(out, 0, 1.5, 0.78, 1.18);
  return out;
}

/** Brain coral: meandering grooves, dark at the bottom of each. */
function brainCoralGeo(seed) {
  var g = new THREE.SphereGeometry(1, 18, 13);
  var p = g.attributes.position, v = new THREE.Vector3();
  ensureAttrs(g);
  var ao = g.attributes.aOcc;
  for (var i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    var n = fbm2(v.x * 2.2 + seed, v.z * 2.2 - seed, 3);
    var groove = Math.sin(n * 22 + v.y * 3.5) * 0.5 + 0.5;     // tight grooves
    var d = 0.16 * n + 0.055 * (groove - 0.55);
    _v3.copy(v).normalize();
    v.addScaledVector(_v3, d);
    p.setXYZ(i, v.x, v.y, v.z);
    ao.setX(i, clamp(0.42 + groove * 0.62, 0.3, 1));
  }
  g.scale(1.12, 0.68, 1.05);
  g.translate(0, 0.40, 0);
  g.computeVertexNormals();
  occByHeight(g, 0, 0.8, 0.55);
  rampColor(g, 0, 0.9, 0.80, 1.14);
  return g;
}

/** Stocky branching coral (acropora), pale tips. */
function branchCoralGeo(seed, scale) {
  var R = mulberry32(seed), parts = [];
  function grow(pos, dir, radius, len, depth) {
    if (depth > 3 || radius < 0.055) return;
    var end = pos.clone().addScaledVector(dir, len);
    parts.push({
      geo: new THREE.CylinderGeometry(radius * 0.74, radius, len, 6, 1, true),
      matrix: new THREE.Matrix4().compose(pos.clone().addScaledVector(dir, len * 0.5),
        new THREE.Quaternion().setFromUnitVectors(YAXIS, dir), new THREE.Vector3(1, 1, 1))
    });
    parts.push({
      geo: new THREE.SphereGeometry(radius * 0.88, 5, 4),
      matrix: new THREE.Matrix4().makeTranslation(end.x, end.y, end.z)
    });
    var n = depth === 0 ? 3 : (R() < 0.6 ? 2 : 3);
    for (var i = 0; i < n; i++) {
      var a = (i / n) * TAU + R() * 1.3, spread = 0.40 + R() * 0.5;
      grow(end, new THREE.Vector3(dir.x + Math.cos(a) * spread, dir.y + 0.34 + R() * 0.22,
           dir.z + Math.sin(a) * spread).normalize(),
           radius * (0.62 + R() * 0.13), len * (0.72 + R() * 0.16), depth + 1);
    }
  }
  grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(R() * 0.16 - 0.08, 1, R() * 0.16 - 0.08).normalize(),
       0.34, 1.25, 0);
  var g = mergeGeos(parts);
  g.scale(scale || 1, scale || 1, scale || 1);
  occByHeight(g, 0, 2.2 * (scale || 1), 0.42);
  rampColor(g, 0, 2.4 * (scale || 1), 0.85, 1.15);
  return g;
}

/** Sea fan: a branching, almost flat fan (a fine silhouette in the distance). */
function fanCoralGeo(seed, scale) {
  var R = mulberry32(seed), parts = [];
  function grow(pos, ang, radius, len, depth) {
    if (depth > 4 || radius < 0.022) return;
    var dir = new THREE.Vector3(Math.sin(ang), Math.cos(ang), 0);
    var end = pos.clone().addScaledVector(dir, len);
    parts.push({
      geo: new THREE.CylinderGeometry(radius * 0.72, radius, len, 5, 1, true),
      matrix: new THREE.Matrix4().compose(pos.clone().addScaledVector(dir, len * 0.5),
        new THREE.Quaternion().setFromUnitVectors(YAXIS, dir), new THREE.Vector3(1, 1, 1))
    });
    var spread = 0.40 + R() * 0.24;
    grow(end, ang - spread, radius * 0.74, len * 0.82, depth + 1);
    grow(end, ang + spread, radius * 0.74, len * 0.82, depth + 1);
    if (R() < 0.3) grow(end, ang + (R() - 0.5) * 0.2, radius * 0.6, len * 0.6, depth + 1);
  }
  grow(new THREE.Vector3(0, 0, 0), 0, 0.13, 1.05, 0);
  var g = mergeGeos(parts);
  g.scale(scale || 1, scale || 1, (scale || 1) * 0.4);
  swayByHeight(g, 0, 3.2 * (scale || 1), 1.6);
  occByHeight(g, 0, 1.5, 0.6);
  return g;
}

/** Fringed plate: the big tentacled table from the film. */
function fringePlateGeo(seed, R) {
  var R2 = mulberry32(seed);
  var parts = [{ geo: shelfGeo(seed + 7, R, R * 0.15) }];
  var n = Math.max(24, Math.round(R * 24));
  for (var i = 0; i < n; i++) {
    var a = (i / n) * TAU + R2() * 0.18;
    var rad = R * (0.42 + R2() * 0.56);
    var len = R * (0.34 + R2() * 0.42);
    var tilt = 0.75 + R2() * 0.55;
    var out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    var dir = new THREE.Vector3().copy(YAXIS).multiplyScalar(Math.cos(tilt))
      .addScaledVector(out, Math.sin(tilt)).normalize();
    parts.push(tentaclePart(new THREE.Vector3(Math.cos(a) * rad, R * 0.07, Math.sin(a) * rad),
                            dir, len, R * 0.010, R * 0.032, 4));
  }
  var g = mergeGeos(parts);
  rampColor(g, 0, R * 0.6, 0.9, 1.18);
  return g;
}

/* ---------- THE POMPOM ANEMONES ------------------------------------------
     They were pincushions: sixty four-sided cones tapering to a needle, which
     reads as a sea urchin. The host anemone's strand (`tentacleTubeGeo`, 120
     triangles) is out of the question here — there are **698 pompoms** in the
     reef, a quarter of all the geometry placed (594,000 triangles, counted
     rather than guessed). Giving them that strand would cost nine million.

     The compromise rests on one observation: what gives away a needle is the
     tip, not the number of strands. A tube whose last fifth is the only part
     that closes costs 36 triangles instead of 8 — but you can then make do
     with a third as many strands, fatter and shorter, and the pompom looks
     **more** like an anemone for the same price. Checked afterwards against
     the total for the scenery.
     ------------------------------------------------------------------------- */

/* The strand's four rings, placed by hand. Two of them fall inside the cap
     (0.86 and 1.0), and that is the whole point of the exercise: with a single
     ring at the tip, six faces converging on a point make six large triangles
     that each catch the light their own way — you saw cut crystal, and
     changing the colour or the number of faces did nothing about it. The
     radius swells before it falls away, which is what makes it a finger. */
var POM_T = [0, 0.52, 0.86, 1.00];
var POM_R = [0.86, 1.06, 0.80, 0.00];

/** Pompom strand: a short six-sided tube with a blunt end. */
function pomTentacleGeo(pos, dir, len, r) {
  /* 6 faces × 3 segments = 36 triangles, no caps: the base is buried in the
         dome, and a useless cap would cost 6 triangles × 22 strands × 698
         pompoms. */
  var g = new THREE.CylinderGeometry(1, 1, len, 6, 3, true);
  ensureAttrs(g);
  var p = g.attributes.position, sw = g.attributes.aSway, ac = g.attributes.aColor;
  for (var i = 0; i < p.count; i++) {
    var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // the rings of a 3-segment cylinder land exactly on 0, ⅓, ⅔, 1
    var ring = Math.round(clamp((y + len * 0.5) / len, 0, 1) * 3);
    var t = POM_T[ring], rr2 = r * POM_R[ring];
    p.setXYZ(i, x * rr2, (t - 0.5) * len, z * rr2);
    sw.setX(i, 0.55 * Math.pow(t, 1.3));    // stocky: it sways without going limp
    var k = 0.80 + 0.46 * t;                 // paler tip
    ac.setXYZ(i, k, k, k);
  }
  g.computeVertexNormals();
  return {
    geo: g,
    matrix: new THREE.Matrix4().compose(pos,
      new THREE.Quaternion().setFromUnitVectors(YAXIS, dir), new THREE.Vector3(1, 1, 1))
      .multiply(new THREE.Matrix4().makeTranslation(0, len * 0.5, 0))
  };
}

/** Pompom anemone: a dome covered in short, fat strands. */
function pomAnemoneGeo(seed, R, count) {
  var R2 = mulberry32(seed), parts = [];
  /* Smaller dome (7×4 instead of 10×7, and 0.50 R instead of 0.58): it is
         the strands that should make the tuft, not the base. A bald patch was
         showing through the middle, and the 84 triangles saved here pay for the
         strands. */
  var base = new THREE.SphereGeometry(R * 0.50, 7, 4, 0, TAU, 0, Math.PI * 0.6);
  base.scale(1, 0.82, 1);
  parts.push({ geo: base, matrix: TRS(0, R * 0.26, 0) });
  count = count || 30;
  for (var i = 0; i < count; i++) {
    // biased upwards: spread over the whole hemisphere they left the top of
    // the dome bare, and the creature read as a spiky ball
    var a = R2() * TAU, b = Math.acos(1 - R2() * 0.80);
    var dir = new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b) * 1.15, Math.sin(b) * Math.sin(a)).normalize();
    /* Stocky: about five times their own width. The tip cone is only the last
             18 per cent, so the shorter the strand the blunter its end — it is that
             ratio, and not the number of faces, that decides whether you see a
             finger or a needle. */
    var len = R * (0.42 + R2() * 0.34);
    parts.push(pomTentacleGeo(dir.clone().multiplyScalar(R * 0.40).add(new THREE.Vector3(0, R * 0.24, 0)),
                              dir, len, R * 0.088 * (0.88 + R2() * 0.24)));
  }
  var g = mergeGeos(parts);
  occByHeight(g, 0, R * 0.8, 0.45);
  // gentle gradient only: the real tip-lightening is already baked in per
  // strand above, and two multiplied ramps blew out the ends.
  rampColor(g, 0, R * 1.0, 0.90, 1.06);
  return g;
}

/* ================================================================== */
/* THE HOST ANEMONE                                                   */
/*                                                                    */
/* The one in the film is a bundle of fat, soft, tightly packed strands, */
/* almost translucent at the tip, growing from a magenta column. Here  */
/* it was made of four-sided cones tapering to a point, scattered at   */
/* random over a hemisphere: from a distance that gave a sea urchin,   */
/* not an anemone. Three things changed.                              */
/*                                                                    */
/*   1. The strand is a curved tube with a rounded end, of almost      */
/*      constant thickness — the strand's silhouette is what makes it.  */
/*   2. They grow from an oral disc in a golden spiral, longer in the  */
/*      middle and more splayed at the rim: the mass takes on the dome */
/*      shape of the reference by itself, instead of a ball.           */
/*   3. The magenta → peach → cream gradient is baked ALONG the strand,*/
/*      not by height in the world: so a splayed strand keeps its pale */
/*      tip.                                                           */
/* ================================================================== */

// The three tints taken from the screenshots. None is magenta: in the
// film the magenta is on the COLUMN; the strands go from salmon to cream.
// An early version put magenta at their base and the occlusion dragged it
// towards a blood red that looked like nothing at all.
var ANEM = { base: 0xe4785f, mid: 0xffbc8e, tip: 0xfae4c6 };

/** An anemone strand: a curved, thick tube with a rounded end. */
function tentacleTubeGeo(len, rad, bend, seg, sides) {
  seg = seg || 10;
  var g = new THREE.CylinderGeometry(1, 1, len, sides || 6, seg, true);
  ensureAttrs(g);
  var p = g.attributes.position, sw = g.attributes.aSway, ac = g.attributes.aColor;
  var ao = g.attributes.aOcc;
  var c0 = new THREE.Color(ANEM.base), c1 = new THREE.Color(ANEM.mid), c2 = new THREE.Color(ANEM.tip);
  var cc = new THREE.Color();
  for (var i = 0; i < p.count; i++) {
    var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    var u = clamp((y + len * 0.5) / len, 0, 1);
    /* A cylinder spaces its rings evenly, and that is what was spoiling the
             rounded end: with the cap over the last 10 per cent, a single ring fell
             inside it and the tube finished in a point — you got a sea urchin. So
             the rings are bunched towards the tip (`1-(1-u)^1.75`), which puts four
             of them in the cap. */
    var t = 1 - Math.pow(1 - u, 1.75);
    // Profile: thin where it emerges, full very quickly, a slight swelling at
    // two thirds, then a real hemispherical cap over the last 12%.
    var r = rad * (0.58 + 0.42 * smoothstep(0, 0.13, t)) * (1 + 0.13 * smoothstep(0.40, 0.90, t));
    if (t > 0.88) r *= Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.88) / 0.12, 2)));
    // The arc grows as t²: the strand leaves the disc straight, then splays.
    p.setXYZ(i, x * r + bend * len * t * t, (t - 0.5) * len, z * r);
    /* 3.4 times the softness of a coral tip. `uSwayAmp` is shared by every soft
             prop, and raising it globally would set the hard corals wobbling;
             `aSway` means precisely "how soft is this vertex", and an anemone
             strand is far softer than a branch. Tuned by measuring: 4.4 gives a
             5.7 m tip about 0.9 m of travel, 15% of its length — the tip clearly
             sways, the bundle stays a bundle. */
    sw.setX(i, 4.4 * Math.pow(t, 1.25));
    if (t < 0.26) cc.copy(c0).lerp(c1, smoothstep(0.0, 0.26, t));
    // The shift to cream comes late: in the screenshots the top two thirds are
    // still peach, only the very end really pales.
    else cc.copy(c1).lerp(c2, smoothstep(0.44, 1.0, t));
    ac.setXYZ(i, cc.r, cc.g, cc.b);
    // the bottom of the crown stays shaded, but warmly: not black
    ao.setX(i, 0.46 + 0.54 * smoothstep(0.03, 0.50, t));
  }
  g.computeVertexNormals();
  return g;
}

/** Host anemone: the bundle of soft strands we live in. */
function hostAnemoneGeo(seed, R, count) {
  var R2 = mulberry32(seed), parts = [];
  count = count || 130;
  var Rd = R * 0.58;              // radius of the oral disc
  var yd = R * 0.52;              // height of the disc: the column shows

  /* ---- the column: a flared magenta trunk with vertical folds ---- */
  var prof = [
    new THREE.Vector2(R * 0.58, 0),             // foot flared over the rock
    new THREE.Vector2(R * 0.48, R * 0.12),
    new THREE.Vector2(R * 0.41, R * 0.28),      // the waist
    new THREE.Vector2(R * 0.46, R * 0.42),
    new THREE.Vector2(R * 0.58, R * 0.52),      // flare beneath the strands
    new THREE.Vector2(R * 0.64, R * 0.565),     // the lip, which overhangs
    new THREE.Vector2(R * 0.57, R * 0.58)
  ];
  var col = new THREE.LatheGeometry(prof, 30);
  ensureAttrs(col);
  var cp = col.attributes.position, cc2 = col.attributes.aColor, co = col.attributes.aOcc;
  var mag0 = new THREE.Color(0x8a1a5c), mag1 = new THREE.Color(0xd8298c);
  var mc = new THREE.Color();
  for (var k = 0; k < cp.count; k++) {
    var vx = cp.getX(k), vy = cp.getY(k), vz = cp.getZ(k);
    var ang = Math.atan2(vz, vx);
    // vertical folds: the column in the film is pleated, not smooth
    var f = 1 + Math.sin(ang * 13) * 0.045 + Math.sin(ang * 5 + 1.1) * 0.030;
    cp.setXYZ(k, vx * f, vy, vz * f);
    var h = clamp(vy / (R * 0.58), 0, 1);
    mc.copy(mag0).lerp(mag1, smoothstep(0.1, 0.9, h));
    cc2.setXYZ(k, mc.r, mc.g, mc.b);
    /* High occlusion floor: in the film the column is VIVID, right down to the
             foot. At 0.30 it came out almost black under the crown, and we lost the
             creature's one saturated accent. */
    co.setX(k, 0.52 + 0.40 * h);
  }
  col.computeVertexNormals();
  parts.push({ geo: col });

  /* ---- the crown: a golden spiral on the disc ---- */
  for (var i = 0; i < count; i++) {
    var fr = (i + 0.5) / count;
    var rho = Rd * Math.sqrt(fr);                   // square root: even density
    var a = i * 2.399963229728653 + R2() * 0.22;    // golden angle: never an alignment
    // The strands in the middle are the longest and the straightest, those at
    // the rim the shortest and the most splayed: hence the dome.
    /* Proportions matter more than numbers: a strand in the film is about ten
             times its own width. At twenty-four times (the previous attempt) you
             read spines, whatever the colour. And the splay stays small so the mass
             remains a tight bundle rather than a firework. */
    /* The dome comes from the length CONTRAST between middle and rim: with
             near-equal lengths you get a flat brush, which is what we had. Here the
             middle is almost twice the rim. */
    var len = R * (1.30 - 0.62 * fr) * (0.82 + R2() * 0.36);
    var bend = 0.05 + 0.36 * fr + R2() * 0.09;
    var rad = R * 0.069 * (0.88 + R2() * 0.26);
    var geo = tentacleTubeGeo(len, rad, bend, 10, 6);
    var m = new THREE.Matrix4()
      .makeTranslation(Math.cos(a) * rho, yd + R * 0.02, Math.sin(a) * rho)
      .multiply(new THREE.Matrix4().makeRotationY(-a))     // local +X -> outwards
      .multiply(new THREE.Matrix4().makeTranslation(0, len * 0.5, 0));
    parts.push({ geo: geo, matrix: m, phase: R2() * TAU });
  }
  // Neither rampColor nor swayByHeight here: everything is already baked per
  // strand, and a second pass by world height would flatten the gradient.
  return mergeGeos(parts);
}

/** Tube sponges with dark mouths. */
function tubeSpongeGeo(seed) {
  var R2 = mulberry32(seed), parts = [];
  var n = 2 + ((R2() * 4) | 0);
  for (var i = 0; i < n; i++) {
    var h = 0.65 + R2() * 1.35, r = 0.20 + R2() * 0.17;
    var a = R2() * TAU, d = R2() * 0.42, tilt = (R2() - 0.5) * 0.36;
    var g = new THREE.CylinderGeometry(r, r * 0.86, h, 11, 1, false);
    dimpleTop(g, r * 0.75, 0.80, 0.14);
    occByHeight(g, -h * 0.5, h * 0.2, 0.5);
    parts.push({
      geo: g,
      matrix: TRS(Math.cos(a) * d, h * 0.5, Math.sin(a) * d, tilt, R2() * TAU, tilt * 0.7)
    });
    rampColor(g, -h * 0.5, h * 0.5, 0.80, 1.16);
    parts.push({
      geo: new THREE.TorusGeometry(r * 0.93, r * 0.14, 4, 10),
      matrix: TRS(Math.cos(a) * d, h - r * 0.05, Math.sin(a) * d, Math.PI / 2 + tilt, 0, 0)
    });
  }
  return mergeGeos(parts);
}

/** Sea whip: a long, soft, curving stalk. */
function whipGeo(seed, h) {
  var R2 = mulberry32(seed);
  var pts = [];
  var lean = (R2() - 0.5) * 1.15, lean2 = (R2() - 0.5) * 1.15;
  for (var i = 0; i <= 4; i++) {
    var t = i / 4;
    pts.push(new THREE.Vector3(Math.sin(t * 2.6) * lean * h * 0.42, t * h * (1 - t * 0.10),
                               Math.sin(t * 2.0 + 1) * lean2 * h * 0.42));
  }
  var curve = new THREE.CatmullRomCurve3(pts);
  var g = new THREE.TubeGeometry(curve, 12, h * 0.016, 5, false);
  swayByHeight(g, 0, h, 1.5);
  rampColor(g, 0, h, 0.85, 1.15);
  occByHeight(g, 0, h * 0.25, 0.6);
  return g;
}

/** Flat algae plate (the green "lily pads" from the film). */
function padGeo(seed, R) {
  var R2 = mulberry32(seed), sd = R2() * 9;
  var g = new THREE.CylinderGeometry(R, R * 0.96, R * 0.09, 20, 1, false);
  var p = g.attributes.position, v = new THREE.Vector3();
  for (var i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    var a = Math.atan2(v.z, v.x);
    var k = 1 + fbm2(Math.cos(a) * 2.6 + sd, Math.sin(a) * 2.6 - sd, 2) * 0.26;
    p.setXYZ(i, v.x * k, v.y + Math.sin(a * 3 + sd) * R * 0.10, v.z * k);
  }
  g.computeVertexNormals();
  occByHeight(g, -R * 0.05, R * 0.05, 0.35);
  return g;
}

/** Touffe d'herbe / algues souples. */
function grassGeo(seed, blades, h) {
  var R = mulberry32(seed), parts = [], maxH = 0;
  for (var i = 0; i < blades; i++) {
    var hh = h * (0.6 + R() * 0.7), w = 0.09 + R() * 0.07;
    maxH = Math.max(maxH, hh);
    var g = new THREE.PlaneGeometry(w, hh, 1, 4);
    var p = g.attributes.position, v = new THREE.Vector3();
    for (var j = 0; j < p.count; j++) {
      v.fromBufferAttribute(p, j);
      var t = (v.y + hh * 0.5) / hh;
      p.setXYZ(j, v.x * (1 - t * 0.75), v.y, v.z + t * t * hh * 0.22);
    }
    g.computeVertexNormals();
    parts.push({ geo: g, matrix: TRS((R() - 0.5) * 0.8, hh * 0.5, (R() - 0.5) * 0.8, 0, R() * TAU, 0) });
  }
  var out = mergeGeos(parts);
  swayByHeight(out, 0, maxH, 1.45);
  occByHeight(out, 0, maxH * 0.4, 0.55);
  return out;
}

/** Laminaire : long ruban ondulant. */
function kelpGeo(seed, h) {
  var R = mulberry32(seed), parts = [];
  var g = new THREE.PlaneGeometry(0.5, h, 2, 10);
  var p = g.attributes.position, v = new THREE.Vector3();
  for (var j = 0; j < p.count; j++) {
    v.fromBufferAttribute(p, j);
    var t = (v.y + h * 0.5) / h;
    p.setXYZ(j, v.x * (0.5 + t * 0.8), v.y, v.z + Math.sin(t * 7) * 0.16 * t);
  }
  g.computeVertexNormals();
  var rot0 = R() * TAU;
  parts.push({ geo: g, matrix: TRS(0, h * 0.5, 0, 0, rot0, 0) });
  parts.push({ geo: g.clone(), matrix: TRS(0, h * 0.5, 0, 0, rot0 + Math.PI / 2, 0) });
  parts.push({ geo: new THREE.CylinderGeometry(0.05, 0.08, h, 5, 1, true), matrix: TRS(0, h * 0.5, 0) });
  var out = mergeGeos(parts);
  swayByHeight(out, 0, h, 1.5);
  occByHeight(out, 0, h * 0.3, 0.6);
  return out;
}

/** Oursin. */
function urchinGeo(seed) {
  var R = mulberry32(seed), parts = [];
  parts.push({ geo: new THREE.SphereGeometry(0.32, 10, 8), matrix: TRS(0, 0.28, 0) });
  for (var i = 0; i < 30; i++) {
    var a = R() * TAU, b = Math.acos(1 - 2 * R() * 0.7);
    var d = new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a));
    var len = 0.26 + R() * 0.3;
    parts.push({
      geo: new THREE.ConeGeometry(0.026, len, 4, 1, true),
      matrix: new THREE.Matrix4().compose(
        d.clone().multiplyScalar(0.28 + len * 0.5).add(new THREE.Vector3(0, 0.28, 0)),
        new THREE.Quaternion().setFromUnitVectors(YAXIS, d), new THREE.Vector3(1, 1, 1))
    });
  }
  var g = mergeGeos(parts);
  occByHeight(g, 0, 0.5, 0.5);
  return g;
}

/** Starfish. */
function starfishGeo() {
  var parts = [];
  for (var i = 0; i < 5; i++) {
    var a = i / 5 * TAU;
    var arm = new THREE.SphereGeometry(0.5, 8, 6);
    arm.scale(0.22, 0.12, 0.62);
    parts.push({ geo: arm, matrix: TRS(Math.sin(a) * 0.34, 0.06, Math.cos(a) * 0.34, 0, a, 0) });
  }
  var c = new THREE.SphereGeometry(0.26, 10, 6); c.scale(1, 0.45, 1);
  parts.push({ geo: c, matrix: TRS(0, 0.07, 0) });
  return mergeGeos(parts);
}

/** Boulder / coral head. */
function rockGeo(seed, r) {
  var g = new THREE.SphereGeometry(r, 26, 17);
  noisify(g, r * 0.16, 1.5 / r, seed % 71, 0.9);
  g.scale(1, 0.86 + (seed % 7) * 0.05, 1);
  g.computeVertexNormals();
  occByHeight(g, -r, r * 0.2, 0.45);
  return g;
}

/** Pillar / rock turret. */
function pillarGeo(seed, h) {
  var R = mulberry32(seed), sd = R() * 20, parts = [];
  var g = new THREE.CylinderGeometry(0.6 + R() * 0.4, 1.9 + R() * 0.5, h, 13, 8, true);
  var p = g.attributes.position, v = new THREE.Vector3();
  for (var i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    var t = (v.y + h * 0.5) / h;
    var bump = 1 + fbm2(v.x * 0.55 + sd, v.z * 0.55 - sd, 3) * 0.34 + Math.sin(t * 8.5 + sd) * 0.09;
    p.setXYZ(i, v.x * bump + Math.sin(t * 2.6 + sd) * 1.5 * t * t, v.y,
                v.z * bump + Math.cos(t * 2.1 + sd) * 1.2 * t * t);
  }
  g.computeVertexNormals();
  parts.push({ geo: g, matrix: TRS(0, h * 0.5, 0) });
  parts.push({
    geo: new THREE.SphereGeometry(0.85, 10, 7),
    matrix: TRS(Math.sin(2.6 + sd) * 1.5, h, Math.cos(2.1 + sd) * 1.2)
  });
  var out = mergeGeos(parts);
  occByHeight(out, 0, h * 0.55, 0.4);
  return out;
}

/** Rock arch (you can swim under it). */
function archGeo(seed, R, thick) {
  var g = new THREE.TorusGeometry(R, thick, 10, 26, Math.PI);
  noisify(g, thick * 0.4, 0.8, seed % 53, 0.8);
  g.computeVertexNormals();
  return g;
}
