/* The Reef — Shared uniforms, the GLSL library, toon materials
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* THE TOON ENGINE                                                    */
/* ================================================================== */

// Uniforms shared by EVERY material (same objects -> one update does all)
var U = {
  uTime:     { value: 0 },
  uSunDir:   { value: new THREE.Vector3(0.46, 0.80, 0.40).normalize() },
  uSunCol:   { value: new THREE.Color(PAL.sun) },
  uSkyCol:   { value: new THREE.Color(PAL.sky) },
  uMidCol:   { value: new THREE.Color(PAL.mid) },
  uDeepCol:  { value: new THREE.Color(PAL.deep) },
  uBounceCol:{ value: new THREE.Color(PAL.bounce) },
  uOccCol:   { value: new THREE.Color(PAL.occ) },
  uFogFar:   { value: CFG.FOG_FAR },
  uWaterY:   { value: CFG.WATER_Y },
  uCaustics: { value: 1.0 },
  tShadow:      { value: null },
  uShadowMat:   { value: new THREE.Matrix4() },
  uShadowOn:    { value: 0 },
  uShadowTexel: { value: 1 / 2048 },
  /* The current. `uCurrent` is direction × strength at this instant: all the
         vegetation leans along it, so it leans together. `uDrift` is its
         integral — what the particles follow. Both are needed: deriving drift
         from `uTime * strength` would teleport the particles every time the
         strength changed. */
  uCurrent: { value: new THREE.Vector2(0.7, 0.2) },
  uDrift:   { value: new THREE.Vector2(0, 0) }
};
function sharedU() {
  var o = {};
  for (var k in U) o[k] = U[k];
  return o;
}

var GLSL_LIB = [
  'uniform float uTime;',
  'uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uMidCol;',
  'uniform vec3 uDeepCol; uniform vec3 uBounceCol; uniform vec3 uOccCol;',
  'uniform float uFogFar; uniform float uWaterY; uniform float uCaustics;',

  'float hash21(vec2 p){ p = fract(p*vec2(127.31,311.79)); p += dot(p,p+34.42); return fract(p.x*p.y); }',
  'float vnoise(vec2 p){',
  '  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);',
  '  return mix(mix(hash21(i),hash21(i+vec2(1,0)),u.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),u.x), u.y);',
  '}',
  'float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.02; a*=0.5; } return v; }',
  'float bandMask(float z, float c, float w){ return 1.0 - smoothstep(w*0.55, w, abs(z-c)); }',
  'float discMask(vec2 p, vec2 c, float r){ return 1.0 - smoothstep(r*0.72, r, length(p-c)); }',

  // ---- caustics: a net of bright veins, discreet on the corals
  'float causticPat(vec2 p, float t){',
  '  float v = 0.0;',
  '  v += sin(p.x*1.30 + t*0.85) * sin(p.y*1.17 - t*0.63);',
  '  v += sin(p.x*2.13 - t*0.55 + 1.7) * sin(p.y*1.93 + t*0.47);',
  '  v += 0.70*sin((p.x+p.y)*1.71 + t*1.05);',
  '  v += 0.45*sin((p.x-p.y)*2.63 - t*0.80);',
  '  return v*0.33;',
  '}',
  'float caustics(vec3 wp, float up){',
  '  vec2 p = wp.xz*0.23 + vec2(wp.y*0.028);',
  '  float v1 = causticPat(p, uTime);',
  '  float v2 = causticPat(p*1.83 + 5.1, uTime*0.87);',
  '  float c  = pow(1.0 - min(abs(v1)*1.3, 1.0), 8.0)*1.15;',
  '  c += pow(1.0 - min(abs(v2)*1.6, 1.0), 12.0)*0.85;',
  '  float fade = smoothstep(-32.0, uWaterY*0.45, wp.y);',
  '  return c * mix(0.15, 1.0, up) * fade * uCaustics;',
  '}',

  // ---- the water: turquoise near the surface, deep blue far away
  'vec3 waterTint(float y){',
  '  float t = smoothstep(-24.0, uWaterY*0.85, y);',
  '  return t < 0.55 ? mix(uDeepCol, uMidCol, t/0.55) : mix(uMidCol, uSkyCol, (t-0.55)/0.45);',
  '}',
  'float waterFog(float dist){ return clamp(1.0 - exp(-pow(max(dist-2.0,0.0)/uFogFar, 1.15)*1.95), 0.0, 0.985); }',
  'vec3 applyWater(vec3 col, vec3 wp, float dist){',
  '  float f = waterFog(dist);',
  '  float ty = min(wp.y, cameraPosition.y + 10.0);',
  '  vec3 far = mix(waterTint(ty), uDeepCol, 0.38*f);',   // distance turns blue
  '  return mix(col, far, f);',
  '}',

  // ---- soft lighting: wrapped diffuse + hemispheric ambient + occlusion
  // ---- sun shadow (4 taps, offset along the normal)
  'uniform sampler2D tShadow; uniform mat4 uShadowMat;',
  'uniform float uShadowOn; uniform float uShadowTexel;',
  'float sunShadow(vec3 wp, vec3 N){',
  '  if(uShadowOn < 0.5) return 1.0;',
  '  vec4 sc = uShadowMat * vec4(wp + N*0.45 + uSunDir*0.25, 1.0);',
  '  vec2 uv = sc.xy;',
  '  if(uv.x < 0.004 || uv.x > 0.996 || uv.y < 0.004 || uv.y > 0.996 || sc.z > 0.999) return 1.0;',
  '  float d = sc.z - 0.0024;',
  '  float t = uShadowTexel*2.6;',
  '  float s = 0.0;',
  '  s += d <= texture2D(tShadow, uv).r ? 1.0 : 0.0;',
  '  s += d <= texture2D(tShadow, uv + vec2( t,  0.0)).r ? 1.0 : 0.0;',
  '  s += d <= texture2D(tShadow, uv + vec2(-t,  0.0)).r ? 1.0 : 0.0;',
  '  s += d <= texture2D(tShadow, uv + vec2( 0.0,  t)).r ? 1.0 : 0.0;',
  '  s += d <= texture2D(tShadow, uv + vec2( 0.0, -t)).r ? 1.0 : 0.0;',
  '  s += d <= texture2D(tShadow, uv + vec2( t*0.7,  t*0.7)).r ? 1.0 : 0.0;',
  '  s += d <= texture2D(tShadow, uv + vec2(-t*0.7, -t*0.7)).r ? 1.0 : 0.0;',
  '  s *= 0.142857;',
  '  vec2 e = abs(uv - 0.5)*2.0;',
  '  return mix(1.0, s, 1.0 - smoothstep(0.72, 0.97, max(e.x, e.y)));',
  '}',
  'vec3 softShade(vec3 base, vec3 N, vec3 V, vec3 wp, float occ, float spec, float sss, float rim, float caustMul){',
  '  float ndl = dot(N, uSunDir);',
  '  float wrap = pow(clamp(ndl*0.42 + 0.58, 0.0, 1.0), 1.85);',
  '  float sh = sunShadow(wp, N);',
  '  float caus = caustics(wp, clamp(N.y*0.5 + 0.5, 0.0, 1.0)) * caustMul * sh;',
  '  vec3 direct = uSunCol * wrap * (1.0 + caus*0.9) * mix(0.32, 1.0, occ) * (0.38 + 0.62*sh);',
  '  float up = N.y*0.5 + 0.5;',
  '  vec3 sky = mix(uBounceCol*0.55, uSkyCol, pow(up, 0.9));',
  '  vec3 amb = mix(uOccCol, sky, mix(0.10, 1.0, occ));',
  '  vec3 col = base * (direct*0.95 + amb*0.50);',
  '  if(sss > 0.001){',                                    // thin tissue with light coming through it
  '    float bt = pow(clamp(-ndl*0.5 + 0.5, 0.0, 1.0), 2.4);',
  '    col += base * uSunCol * bt * sss * mix(0.2, 1.0, occ);',
  '  }',
  '  if(spec > 0.001){',
  '    float s = pow(max(dot(N, normalize(uSunDir+V)), 0.0), 30.0);',
  '    col += uSunCol * s * spec * occ * sh;',
  '  }',
  '  col += base * uSkyCol * pow(1.0 - max(dot(N,V), 0.0), 3.4) * rim * occ;',
  '  return col;',
  '}'
].join('\n');

// Vertex animation: aSway carries the softness profile baked into the geometry,
// aPhase offsets each plant within a merged massif.
// Vertex animation: aSway carries the softness profile baked into the geometry,
// aPhase offsets each plant within a merged massif.
// uMode: 0 = plant, 1 = swimming (ripple along Z), 2 = hanging, 3 = wings (ray)
var GLSL_ANIM = [
  'attribute float aPhase; attribute float aSway;',
  'uniform float uBeat; uniform float uSwayAmp; uniform float uSwayFreq; uniform float uSwaySpeed;',
  'uniform float uMode; uniform float uBend; uniform float uFishLen; uniform float uTaper;',
  'uniform vec2 uCurrent;',
  'vec3 animate(vec3 p, vec3 origin){',
  '  float ph = aPhase + origin.x*0.29 + origin.z*0.24;',
  '  if(uMode < 0.5){',
  /* The current. Before, each tuft swung on its own X axis: the whole reef
         moved the same way, and nothing moved together. Three things are
         layered here:
           — a shared lean along `uCurrent`, with gusts that travel across the
             reef (the `trav` term);
           — a ripple running up each strand (`-p.y*uSwayFreq`), which is what
             makes the motion fluid rather than rigid;
           — a per-strand offset taken from its position in the object, without
             which an anemone's 78 tentacles move like a single comb. */
  '    float amp = uSwayAmp * aSway;',
  '    vec2 cur = uCurrent;',
  '    float trav = dot(origin.xz + p.xz, cur) * 0.09;',
  /* `own` stays small on purpose. It also varies ALONG a strand (a curved
         strand moves in x), so a large coefficient made every tentacle
         concertina instead of lean. The offset between strands comes from
         `ph`, which now carries a phase per strand. */
  '    float own = p.x*0.55 + p.z*0.45;',
  '    float gust = 0.60 + 0.40*sin(uBeat*0.29 - trav);',
  // Half a wavelength on a 5 m strand: it bends, it does not frizz.
  '    float w  = sin(uBeat + ph + own - p.y*uSwayFreq*0.42);',
  '    float w2 = sin(uBeat*1.71 + ph*1.6 + own*1.4 - p.y*uSwayFreq*0.78);',
  '    p.xz += cur * (gust * 1.25 * amp);',
  '    p.x += (w*0.70 + w2*0.24) * amp;',
  '    p.z += (cos(uBeat*0.86 + ph*1.27 + own) * 0.55 + w2*0.20) * amp;',
  '    p.y -= (abs(w)*0.55 + gust*0.45) * amp * 0.16;',
  '  } else if(uMode < 1.5){',
  '    float t = clamp((uFishLen - p.z)/max(uFishLen*2.0, 0.0001), 0.0, 1.0);',
  '    float w = sin(uBeat + ph - t*uSwayFreq);',
  '    p.x += w*uSwayAmp*pow(t, uTaper) + uBend*pow(t, uTaper*0.8);',
  '    p.y += w*uSwayAmp*0.10*pow(t, uTaper*1.3);',
  '  } else if(uMode < 2.5){',
  '    float w = sin(uBeat + ph + p.y*uSwayFreq);',
  '    p.x += w * uSwayAmp * aSway + uCurrent.x * uSwayAmp * 0.9 * aSway;',
  '    p.z += sin(uBeat*0.71 + ph*1.7 + p.y*uSwayFreq*1.3) * uSwayAmp*0.8 * aSway',
  '         + uCurrent.y * uSwayAmp * 0.9 * aSway;',
  '  } else {',
  '    float k = clamp(abs(p.x)/max(uFishLen, 0.0001), 0.0, 1.0);',
  '    p.y += sin(uBeat + ph - k*uSwayFreq) * uSwayAmp * pow(k, 1.7);',
  '    p.z += cos(uBeat + ph - k*uSwayFreq) * uSwayAmp * 0.12 * pow(k, 2.0);',
  '  }',
  '  return p;',
  '}'
].join('\n');

var VERT_MAIN = [
  'attribute vec3 aColor; attribute float aOcc;',
  'varying vec3 vN; varying vec3 vWP; varying vec3 vObj; varying vec2 vUv;',
  'varying vec3 vCol; varying float vOcc;',
  'void main(){',
  '  vObj = position; vUv = uv; vCol = aColor; vOcc = aOcc;',
  '  #ifdef USE_INSTANCING',
  '    mat4 mm = modelMatrix * instanceMatrix;',
  '  #else',
  '    mat4 mm = modelMatrix;',
  '  #endif',
  '  vec3 p = animate(position, mm[3].xyz);',
  '  vec4 wp = mm * vec4(p, 1.0);',
  '  vWP = wp.xyz;',
  '  vN = normalize(mat3(mm) * normal);',
  '  gl_Position = projectionMatrix * viewMatrix * wp;',
  '}'
].join('\n');

function fragMain(baseHook) {
  return [
    'uniform vec3 uColor; uniform vec3 uColorB; uniform float uSpec; uniform float uSSS;',
    'uniform float uRim; uniform float uEmissive; uniform float uOpacity;',
    'uniform float uCaustMul; uniform float uOccMul; uniform float uBump;',
    'varying vec3 vN; varying vec3 vWP; varying vec3 vObj; varying vec2 vUv;',
    'varying vec3 vCol; varying float vOcc;',
    'void main(){',
    '  vec3 N = normalize(vN);',
    '  if(!gl_FrontFacing) N = -N;',
    // micro-relief: the normal is perturbed by noise in the tangent plane
    '  if(uBump > 0.001){',
    '    vec3 t1 = normalize(cross(N, vec3(0.0, 1.0, 0.0)) + vec3(0.0008, 0.0, 0.0));',
    '    vec3 t2 = cross(N, t1);',
    '    float e = 0.22;',
    '    vec3 q = vWP*2.3;',
    '    float n0 = vnoise(q.xz + q.y*0.8);',
    '    float na = vnoise((q + t1*e).xz + (q.y + t1.y*e)*0.8);',
    '    float nb = vnoise((q + t2*e).xz + (q.y + t2.y*e)*0.8);',
    '    N = normalize(N + (t1*(n0-na) + t2*(n0-nb)) * uBump * 6.0);',
    '  }',
    '  vec3 V = normalize(cameraPosition - vWP);',
    '  vec3 base = uColor * vCol;',
    '  float occ = clamp(mix(1.0, vOcc, uOccMul), 0.0, 1.0);',
    '  float alpha = uOpacity;',
    '  float emis = uEmissive;',
    '  float spec = uSpec; float sss = uSSS;',
    baseHook || '',
    '  vec3 col = softShade(base, N, V, vWP, occ, spec, sss, uRim, uCaustMul);',
    '  col += base*emis;',
    '  col = applyWater(col, vWP, length(cameraPosition - vWP));',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');
}

var matCount = 0;
var ANIMS = [];              // every animation phase that needs advancing
/** Reef material: soft lighting, no outline (the film has none). */
function makeToonMat(opt) {
  opt = opt || {};
  var anim = {
    /* The animation phase is **accumulated**, not recomputed from
             `uTime * uSwaySpeed`. This is the fix for the shivering: the player's
             swim rate depends on their speed, so it changes every frame, and
             `sin(uTime * rate)` made the phase jump by `uTime * Δrate` from one
             frame to the next — a jump that grew with the length of the session.
             At a standstill the rate was constant, so the fish rippled normally:
             exactly what was being reported. */
    uBeat:      { value: 0 },
    uSwayAmp:   { value: opt.swayAmp || 0 },
    uSwayFreq:  { value: opt.swayFreq !== undefined ? opt.swayFreq : 1.1 },
    uSwaySpeed: { value: opt.swaySpeed !== undefined ? opt.swaySpeed : 1.0 },
    uMode:      { value: opt.mode || 0 },
    uBend:      { value: 0 },
    uFishLen:   { value: opt.fishLen || 1 },
    uTaper:     { value: opt.taper !== undefined ? opt.taper : 1.7 }
  };
  var u = sharedU();
  for (var k in anim) u[k] = anim[k];
  u.uColor    = { value: new THREE.Color(opt.color !== undefined ? opt.color : 0xffffff) };
  u.uColorB   = { value: new THREE.Color(opt.colorB !== undefined ? opt.colorB : 0xffffff) };
  u.uSpec     = { value: opt.spec !== undefined ? opt.spec : 0.10 };
  u.uSSS      = { value: opt.sss !== undefined ? opt.sss : 0.0 };
  u.uRim      = { value: opt.rim !== undefined ? opt.rim : 0.22 };
  u.uEmissive = { value: opt.emissive || 0 };
  u.uOpacity  = { value: opt.opacity !== undefined ? opt.opacity : 1 };
  u.uCaustMul = { value: opt.caust !== undefined ? opt.caust : 1 };
  u.uOccMul   = { value: opt.occ !== undefined ? opt.occ : 1 };
  u.uBump     = { value: opt.bump || 0 };
  if (opt.uniforms) for (var k2 in opt.uniforms) u[k2] = opt.uniforms[k2];

  var mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: 'uniform float uTime;\n' + GLSL_ANIM + '\n' + VERT_MAIN,
    fragmentShader: GLSL_LIB + '\n' + fragMain(opt.baseHook),
    side: opt.side || THREE.FrontSide,
    transparent: !!opt.transparent,
    depthWrite: opt.depthWrite !== undefined ? opt.depthWrite : true,
    blending: opt.blending || THREE.NormalBlending
  });
  mat.name = 'reef' + (matCount++);
  ANIMS.push(anim);          // a single loop advances every phase
  return { mat: mat, outline: null, anim: anim, u: u };
}

function toonMesh(geo, opt) {
  ensureAttrs(geo);
  var m = makeToonMat(opt);
  var mesh = new THREE.Mesh(geo, m.mat);
  mesh.frustumCulled = opt && opt.frustumCulled === false ? false : true;
  mesh.userData.u = m.u;
  mesh.userData.anim = m.anim;
  mesh.userData.mats = m;
  return mesh;
}
