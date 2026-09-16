/* The Reef — Floor, water, god rays, particles
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* BUILDING THE WORLD                                                 */
/* ================================================================== */
var world = {
  colliders: [],        // {x,y,z,r} spheres, {x,y,z,r,h} discs (shelves)
  pearls: [],
  critters: [],         // every animated creature
  npcs: {},             // NPCs indexed by id
  refuges: [],          // anemones that shelter us
  massifs: [],
  menace: 0,            // 0..1: a predator is close
  places: {},           // lieux remarquables
  vents: [],            // bubble vents
  pickups: [],          // items to pick up
  jellies: [],
  schools: [],
  turtle: null,
  shadows: [],
  home: new THREE.Vector3(0, 0, 0)
};

function tint(hex, k) {                       // lightens/darkens a colour
  var c = new THREE.Color(hex);
  c.r = clamp(c.r * k, 0, 1); c.g = clamp(c.g * k, 0, 1); c.b = clamp(c.b * k, 0, 1);
  return c.getHex();
}

/* ---------- the sandy floor ---------- */
function buildFloor() {
  var g = new THREE.PlaneGeometry(340, 340, 150, 150);
  g.rotateX(-Math.PI / 2);                    // espace objet = espace monde
  var p = g.attributes.position;
  for (var i = 0; i < p.count; i++) {
    p.setY(i, floorHeight(p.getX(i), p.getZ(i)));
  }
  g.computeVertexNormals();
  var hook = [
    '  float n = fbm(vObj.xz*0.075);',
    '  base = mix(uColor, uColorB, smoothstep(0.34, 0.70, n));',
    '  float rip = sin(vObj.x*1.05 + fbm(vObj.xz*0.12)*8.0)*0.5 + 0.5;',
    '  base *= 0.93 + 0.11*rip;',
    '  float grav = smoothstep(0.58, 0.86, fbm(vObj.xz*0.42));',
    '  base = mix(base, vec3(0.46,0.44,0.40), grav*0.40);',
    '  base *= 0.88 + 0.14*smoothstep(-4.0, 3.0, vObj.y);',
    '  base = mix(base, base*vec3(0.72,0.86,1.0), smoothstep(0.55, 0.85, fbm(vObj.xz*0.18))*0.5);'
  ].join('\n');
  var m = toonMesh(g, {
    color: PAL.sand, colorB: PAL.sandDark, baseHook: hook, caust: 1.05, bump: 0.30,
    rim: 0.10, spec: 0.0, soft: 0.10, outline: false, frustumCulled: false
  });
  scene.add(m);
  return m;
}

/* ---------- the far water: deep blue -> turquoise ---------- */
function buildWaterDome() {
  var g = new THREE.SphereGeometry(420, 24, 16);
  var mat = new THREE.ShaderMaterial({
    uniforms: sharedU(),
    vertexShader: [
      'varying vec3 vWP;',
      'void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz;',
      '  gl_Position = projectionMatrix*viewMatrix*wp; }'
    ].join('\n'),
    fragmentShader: GLSL_LIB + '\n' + [
      'varying vec3 vWP;',
      'void main(){',
      '  vec3 dir = normalize(vWP - cameraPosition);',
      '  float h = dir.y;',
      '  vec3 col = mix(uDeepCol*0.82, uMidCol, smoothstep(-0.75, 0.02, h));',
      '  col = mix(col, uSkyCol, smoothstep(0.0, 0.55, h));',
      '  float depth = smoothstep(uWaterY*0.8, -10.0, cameraPosition.y);',
      '  col = mix(col, uDeepCol, depth*0.35);',
      '  col += uSunCol * pow(max(dot(dir, uSunDir), 0.0), 5.0) * 0.16;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),
    side: THREE.BackSide, depthWrite: false, depthTest: false
  });
  var m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  scene.add(m);
  return m;
}

/* ---------- the surface, seen from underneath ---------- */
function buildSurface() {
  var g = new THREE.PlaneGeometry(700, 700, 1, 1);
  g.rotateX(Math.PI / 2);                     // normal pointing down
  var u = sharedU();
  var mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: [
      'varying vec3 vWP;',
      'void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }'
    ].join('\n'),
    fragmentShader: GLSL_LIB + '\n' + [
      'varying vec3 vWP;',
      'void main(){',
      '  vec3 V = normalize(vWP - cameraPosition);',
      '  float dist = length(vWP - cameraPosition);',
      '  vec2 p = vWP.xz*0.17;',
      '  float v1 = causticPat(p, uTime*0.8);',
      '  float v2 = causticPat(p*1.9 + 3.0, uTime*1.15);',
      '  float band = pow(1.0 - min(abs(v1)*1.15, 1.0), 6.0);',
      '  float rip2 = pow(1.0 - min(abs(v2)*1.5, 1.0), 9.0);',
      '  vec3 sky = mix(vec3(0.30,0.60,0.70), vec3(1.35,1.42,1.40), clamp(band*1.05 + rip2*0.85, 0.0, 1.0));',
      '  float fres = pow(1.0 - clamp(abs(V.y), 0.0, 1.0), 4.0);',
      '  vec3 mirror = waterTint(uWaterY*0.5) * (1.05 + band*0.9);',
      '  vec3 col = mix(sky, mirror, fres);',
      '  float sun = max(dot(V, uSunDir), 0.0);',
      '  col += uSunCol * pow(sun, 90.0) * 7.0;',
      '  col += uSunCol * pow(sun, 9.0) * 0.85;',
      '  col = applyWater(col, vWP, dist);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),
    side: THREE.DoubleSide, depthWrite: true
  });
  var m = new THREE.Mesh(g, mat);
  m.position.y = CFG.WATER_Y;
  m.frustumCulled = false;
  scene.add(m);
  return m;
}

/* ---------- god rays ---------- */
function buildGodRays() {
  var group = new THREE.Group();
  var u = sharedU();
  u.uRayFade = { value: 1 };
  var mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: [
      'varying vec2 vUv; varying vec3 vWP;',
      'void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz;',
      '  gl_Position = projectionMatrix*viewMatrix*wp; }'
    ].join('\n'),
    fragmentShader: GLSL_LIB + '\n' + [
      'uniform float uRayFade;',
      'varying vec2 vUv; varying vec3 vWP;',
      'void main(){',
      '  float edge = pow(sin(clamp(vUv.x,0.0,1.0)*3.14159), 1.7);',
      '  float vert = pow(clamp(vUv.y, 0.0, 1.0), 1.05);',
      '  float flick = 0.72 + 0.28*sin(uTime*0.55 + vWP.x*0.09 + vWP.z*0.07);',
      '  float a = edge*vert*flick*0.34*uRayFade;',
      '  a *= 1.0 - waterFog(length(vWP - cameraPosition))*0.85;',
      '  vec3 col = mix(uSkyCol, uSunCol, 0.65);',
      '  gl_FragColor = vec4(col*a, a);',
      '}'
    ].join('\n'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  var n = 26;
  for (var i = 0; i < n; i++) {
    var a = (i / n) * TAU + rr(-0.2, 0.2);
    var d = Math.sqrt(rnd()) * 96;
    var len = rr(64, 108), wid = rr(3.5, 12);
    var g = new THREE.PlaneGeometry(wid, len, 1, 1);
    var q = new THREE.Mesh(g, mat);
    q.position.set(Math.cos(a) * d, CFG.WATER_Y - len * 0.5 + 2, Math.sin(a) * d);
    var sd = U.uSunDir.value;
    q.rotation.y = Math.atan2(sd.x, sd.z) + rr(-0.25, 0.25);
    q.rotation.z = -Math.asin(clamp(sd.x, -1, 1)) * 0.75 + rr(-0.10, 0.10);
    q.rotation.x = Math.asin(clamp(sd.z, -1, 1)) * 0.75 + rr(-0.10, 0.10);
    q.renderOrder = 6;
    group.add(q);
  }
  group.userData.mat = mat;
  scene.add(group);
  return group;
}

/* ---------- contact shadows (a single mesh for the whole reef) ---------- */
function pushShadow(x, z, radius, y) { world.shadows.push([x, z, radius, y]); }
function buildShadows() {
  if (!world.shadows.length) return null;
  var parts = [];
  for (var i = 0; i < world.shadows.length; i++) {
    var s = world.shadows[i];
    var g = new THREE.CircleGeometry(s[2], s[3] !== undefined ? 10 : 14);
    g.rotateX(-Math.PI / 2);
    if (s[3] === undefined) {
      var p = g.attributes.position;
      for (var j = 0; j < p.count; j++) {        // the patch follows the shape of the sand
        var wx = p.getX(j) + s[0], wz = p.getZ(j) + s[1];
        p.setY(j, floorHeight(wx, wz) - floorHeight(s[0], s[1]) + 0.07);
      }
      g.computeVertexNormals();
    }
    parts.push({ geo: g, matrix: TRS(s[0], s[3] !== undefined ? s[3] : floorHeight(s[0], s[1]), s[1]) });
  }
  var u = sharedU();
  var mesh = new THREE.Mesh(mergeGeos(parts), new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: [
      'varying vec2 vUv; varying vec3 vWP;',
      'void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz;',
      '  gl_Position = projectionMatrix*viewMatrix*wp; }'
    ].join('\n'),
    fragmentShader: GLSL_LIB + '\n' + [
      'varying vec2 vUv; varying vec3 vWP;',
      'void main(){',
      '  float d = length(vUv - 0.5)*2.0;',
      '  float a = pow(1.0 - clamp(d, 0.0, 1.0), 1.5)*0.55;',
      '  a *= 1.0 - waterFog(length(vWP - cameraPosition));',
      '  gl_FragColor = vec4(uDeepCol*0.65, a);',
      '}'
    ].join('\n'),
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  }));
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

/* ---------- particules : neige marine + bulles ---------- */
function buildParticles() {
  var group = new THREE.Group();
  function makePoints(count, spread, tex, opt) {
    var pos = new Float32Array(count * 3), size = new Float32Array(count), seed = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      pos[i * 3] = rr(-spread, spread);
      pos[i * 3 + 1] = rr(opt.y0, opt.y1);
      pos[i * 3 + 2] = rr(-spread, spread);
      size[i] = rr(opt.s0, opt.s1);
      seed[i] = rnd() * 100;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    var u = sharedU();
    u.tMap = { value: tex };
    u.uCenter = { value: new THREE.Vector3() };
    u.uSpread = { value: spread };
    u.uRise = { value: opt.rise };
    u.uPix = { value: 1 };
    u.uAlpha = { value: opt.alpha };
    u.uCol = { value: new THREE.Color(opt.color) };
    u.uYRange = { value: new THREE.Vector2(opt.y0, opt.y1) };
    var mat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: GLSL_LIB + '\n' + [
        'attribute float aSize; attribute float aSeed;',
        'uniform vec3 uCenter; uniform float uSpread; uniform float uRise; uniform float uPix;',
        'uniform vec2 uYRange; uniform vec2 uDrift;',
        'varying float vFade; varying float vSeed;',
        'void main(){',
        '  vec3 p = position;',
        '  float span = uSpread*2.0;',
        // The drift comes from the integral of the current: the same gusts carry
        // the dust and lean the corals, so you read one moving body of water
        // rather than two unrelated animations.
        '  p.x += sin(uTime*0.31 + aSeed)*0.9 + uDrift.x;',
        '  p.z += cos(uTime*0.27 + aSeed*1.7)*0.9 + uDrift.y;',
        '  p.y += uTime*uRise;',
        '  p.x = mod(p.x - uCenter.x + uSpread, span) - uSpread + uCenter.x;',
        '  p.z = mod(p.z - uCenter.z + uSpread, span) - uSpread + uCenter.z;',
        '  float ySpan = uYRange.y - uYRange.x;',
        '  p.y = mod(p.y - uYRange.x, ySpan) + uYRange.x;',
        '  vSeed = aSeed;',
        '  vec4 mv = viewMatrix*vec4(p,1.0);',
        '  float dist = -mv.z;',
        '  vFade = (1.0 - waterFog(dist)) * smoothstep(1.2, 4.0, dist);',
        '  gl_PointSize = aSize*uPix/max(dist, 0.5);',
        '  gl_Position = projectionMatrix*mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D tMap; uniform float uAlpha; uniform vec3 uCol;',
        'varying float vFade; varying float vSeed;',
        'void main(){',
        '  vec4 t = texture2D(tMap, gl_PointCoord);',
        '  float a = t.a*uAlpha*vFade;',
        '  if(a < 0.004) discard;',
        '  gl_FragColor = vec4(uCol*t.rgb, a);',
        '}'
      ].join('\n'),
      transparent: true, depthWrite: false, blending: opt.additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    var pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    group.add(pts);
    return pts;
  }

  var snow = makePoints(QUALITY > 0 ? 1700 : 700, 62, TEX.soft,
    { y0: -6, y1: CFG.WATER_Y, s0: 16, s1: 52, rise: 0.35, alpha: 0.5, color: 0xdff6ff, additive: true });
  var plankton = makePoints(QUALITY > 0 ? 900 : 300, 34, TEX.soft,
    { y0: -4, y1: CFG.WATER_Y * 0.8, s0: 7, s1: 20, rise: 0.12, alpha: 0.75, color: 0xfff2cf, additive: true });
  var bubbles = makePoints(QUALITY > 0 ? 300 : 120, 60, TEX.bubble,
    { y0: -4, y1: CFG.WATER_Y + 2, s0: 40, s1: 130, rise: 3.1, alpha: 0.5, color: 0xffffff, additive: false });
  group.userData.layers = [snow, plankton, bubbles];
  scene.add(group);
  return group;
}
