/* The Reef — Vertex attributes, occlusion baking, geometry merging
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ------------------------------------------------------------------ */
/* Vertex attributes: colour, occlusion, softness                     */
/* ------------------------------------------------------------------ */
/** Makes sure the attributes the shaders read are present. */
function ensureAttrs(geo) {
  var n = geo.attributes.position.count, i;
  if (!geo.attributes.aColor) {
    var c = new Float32Array(n * 3);
    for (i = 0; i < n * 3; i++) c[i] = 1;
    geo.setAttribute('aColor', new THREE.BufferAttribute(c, 3));
  }
  if (!geo.attributes.aOcc) {
    var o = new Float32Array(n);
    for (i = 0; i < n; i++) o[i] = 1;
    geo.setAttribute('aOcc', new THREE.BufferAttribute(o, 1));
  }
  if (!geo.attributes.aPhase) geo.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(n), 1));
  if (!geo.attributes.aSway) geo.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(n), 1));
  return geo;
}

/** Occlusion: downward faces and hollows get less ambient light. */
function occByHeight(geo, y0, y1, minOcc) {
  ensureAttrs(geo);
  var p = geo.attributes.position, a = geo.attributes.aOcc;
  for (var i = 0; i < p.count; i++) {
    a.setX(i, a.getX(i) * lerp(minOcc, 1, smoothstep(y0, y1, p.getY(i))));
  }
  return geo;
}
/** Occlusion between overlapping spheres (hollows of a cauliflower coral). */
function occBySpheres(geo, spheres, strength) {
  ensureAttrs(geo);
  var p = geo.attributes.position, a = geo.attributes.aOcc, v = new THREE.Vector3();
  for (var i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    var sum = 0;
    for (var j = 0; j < spheres.length; j++) {
      var s = spheres[j];
      var d = Math.sqrt((v.x - s[0]) * (v.x - s[0]) + (v.y - s[1]) * (v.y - s[1]) + (v.z - s[2]) * (v.z - s[2]));
      sum += 1 - smoothstep(s[3] * 0.82, s[3] * 1.45, d);
    }
    a.setX(i, a.getX(i) * clamp(1 - Math.max(sum - 1, 0) * (strength || 0.45), 0.16, 1));
  }
  return geo;
}
/** Softness profile: 0 at the base, 1 at the tip. */
function swayByHeight(geo, y0, y1, power) {
  ensureAttrs(geo);
  var p = geo.attributes.position, a = geo.attributes.aSway;
  for (var i = 0; i < p.count; i++) {
    a.setX(i, Math.pow(smoothstep(y0, y1, p.getY(i)), power || 1.4));
  }
  return geo;
}
function tintAttr(geo, hex) {
  ensureAttrs(geo);
  var c = new THREE.Color(hex), a = geo.attributes.aColor;
  for (var i = 0; i < a.count; i++) a.setXYZ(i, c.r, c.g, c.b);
  return geo;
}

/* ------------------------------------------------------------------ */
/* Merging geometry (indexed) — thousands of corals, ~1 draw call      */
/* ------------------------------------------------------------------ */
var _mcol = new THREE.Color(), _nmat = new THREE.Matrix3(), _mv = new THREE.Vector3();
/**
   * parts: [{ geo, matrix?, color?, phase?, occ? }]
   * Keeps and propagates aColor, aOcc, aPhase, aSway and the indices.
   */
function mergeGeos(parts) {
  var nv = 0, ni = 0, i, j, pre = [];
  for (i = 0; i < parts.length; i++) {
    var g = parts[i].geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    var cnt = g.attributes.position.count;
    var idx = g.index ? g.index.array : null;
    pre.push({ g: g, idx: idx, cnt: cnt, part: parts[i] });
    nv += cnt; ni += idx ? idx.length : cnt;
  }
  var pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
  var col = new Float32Array(nv * 3), occ = new Float32Array(nv);
  var pha = new Float32Array(nv), swy = new Float32Array(nv), uvs = new Float32Array(nv * 2);
  var index = nv > 65000 ? new Uint32Array(ni) : new Uint16Array(ni);
  var vo = 0, io = 0;
  for (i = 0; i < pre.length; i++) {
    var e = pre[i], part = e.part, m = part.matrix;
    var P = e.g.attributes.position, N = e.g.attributes.normal;
    var UVA = e.g.attributes.uv, OA = e.g.attributes.aOcc, SA = e.g.attributes.aSway;
    var CA = e.g.attributes.aColor, PA = e.g.attributes.aPhase;
    if (m) _nmat.getNormalMatrix(m);
    var hasCol = part.color !== undefined;
    if (hasCol) _mcol.setHex(part.color);
    var pOcc = part.occ !== undefined ? part.occ : 1;
    var pPha = part.phase || 0;
    for (j = 0; j < e.cnt; j++) {
      var o3 = (vo + j) * 3;
      _mv.fromBufferAttribute(P, j);
      if (m) _mv.applyMatrix4(m);
      pos[o3] = _mv.x; pos[o3 + 1] = _mv.y; pos[o3 + 2] = _mv.z;
      _mv.fromBufferAttribute(N, j);
      if (m) _mv.applyMatrix3(_nmat).normalize();
      nor[o3] = _mv.x; nor[o3 + 1] = _mv.y; nor[o3 + 2] = _mv.z;
      if (hasCol && CA) {                     // the prop's tint MULTIPLIES the baked gradient
        col[o3] = _mcol.r * CA.getX(j); col[o3 + 1] = _mcol.g * CA.getY(j); col[o3 + 2] = _mcol.b * CA.getZ(j);
      } else if (hasCol) { col[o3] = _mcol.r; col[o3 + 1] = _mcol.g; col[o3 + 2] = _mcol.b; }
      else if (CA) { col[o3] = CA.getX(j); col[o3 + 1] = CA.getY(j); col[o3 + 2] = CA.getZ(j); }
      else { col[o3] = 1; col[o3 + 1] = 1; col[o3 + 2] = 1; }
      occ[vo + j] = (OA ? OA.getX(j) : 1) * pOcc;
      /* The prop's phase is ADDED to the one already baked in, it does not
                 overwrite it — just as the tint multiplies. Without this, an
                 anemone's 130 strands lost their individual offsets when the massif
                 was merged, and started moving like one rigid comb. */
      pha[vo + j] = pPha + (PA ? PA.getX(j) : 0);
      swy[vo + j] = SA ? SA.getX(j) : 0;
      uvs[(vo + j) * 2] = UVA ? UVA.getX(j) : 0;
      uvs[(vo + j) * 2 + 1] = UVA ? UVA.getY(j) : 0;
    }
    if (e.idx) for (j = 0; j < e.idx.length; j++) index[io + j] = e.idx[j] + vo;
    else for (j = 0; j < e.cnt; j++) index[io + j] = vo + j;
    vo += e.cnt; io += e.idx ? e.idx.length : e.cnt;
  }
  var out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  out.setAttribute('aOcc', new THREE.BufferAttribute(occ, 1));
  out.setAttribute('aPhase', new THREE.BufferAttribute(pha, 1));
  out.setAttribute('aSway', new THREE.BufferAttribute(swy, 1));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

var _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v3 = new THREE.Vector3();
function TRS(px, py, pz, rx, ry, rz, sx, sy, sz) {
  var m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(px, py, pz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
    new THREE.Vector3(sx === undefined ? 1 : sx, sy === undefined ? (sx === undefined ? 1 : sx) : sy, sz === undefined ? (sx === undefined ? 1 : sx) : sz)
  );
  return m;
}

/** Warps a geometry with noise (organic, "sculpted" look). */
function noisify(geo, amp, freq, seedOff, occStrength) {
  var p = geo.attributes.position, v = new THREE.Vector3(), s = seedOff || 0;
  ensureAttrs(geo);
  var ao = geo.attributes.aOcc;
  for (var i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    var d = fbm2(v.x * freq + s, v.z * freq - s, 3) + fbm2(v.y * freq * 1.3 + s * 2, v.x * freq - s, 2) * 0.6;
    _v3.copy(v).normalize();
    v.addScaledVector(_v3, d * amp);
    p.setXYZ(i, v.x, v.y, v.z);
    if (occStrength) ao.setX(i, ao.getX(i) * clamp(1 + Math.min(d, 0) * occStrength, 0.25, 1));
  }
  geo.computeVertexNormals();
  return geo;
}
