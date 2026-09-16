/* The Reef — Scene, render targets, post-processing, sun shadows
   Part of one program split across files; they share the global scope,
   exactly as they shared one closure before. Load order is set in index.html. */
'use strict';

/* ================================================================== */
/* SCENE, RENDERING, POST-PROCESSING                                  */
/* ================================================================== */
var TEX = {};
var renderer, scene, camera, W = 1, H = 1, pixelScale = 1;
var rtScene, rtBrightA, rtBrightB, fsScene, fsCam, fsQuad;
var matBright, matBlur, matComp;
var QUALITY = 2;                         // 2 = high, 1 = medium, 0 = low
var flashCollect = 0, flashSting = 0;

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x0b4a72, 1);
  renderer.autoClear = true;
  $('#stage').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, 0.3, 800);
  camera.position.set(0, 8, 16);

  TEX.soft = softSpriteTex();
  TEX.bubble = bubbleSpriteTex();

  // ---- render targets
  var half = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
  // no MSAA: we need a depth texture (FXAA makes up for it)
  rtScene = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: half
  });
  rtScene.depthTexture = new THREE.DepthTexture(2, 2);
  rtScene.depthTexture.format = THREE.DepthFormat;
  rtScene.depthTexture.type = renderer.capabilities.isWebGL2 ? THREE.UnsignedIntType : THREE.UnsignedShortType;
  rtBrightA = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: half });
  rtBrightB = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: half });

  fsScene = new THREE.Scene();
  fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  var FS_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

  matBright = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uThresh: { value: 0.82 } },
    vertexShader: FS_VERT,
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float uThresh; varying vec2 vUv;',
      'void main(){',
      '  vec3 c = texture2D(tDiffuse, vUv).rgb;',
      '  float l = max(max(c.r,c.g),c.b);',
      '  float k = max(l - uThresh, 0.0)/max(l, 0.0001);',
      '  gl_FragColor = vec4(c*k*1.25, 1.0);',
      '}'
    ].join('\n')
  });

  matBlur = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } },
    vertexShader: FS_VERT,
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;',
      'void main(){',
      '  vec3 s = texture2D(tDiffuse, vUv).rgb * 0.2270270270;',
      '  s += (texture2D(tDiffuse, vUv + uDir*1.3846153846).rgb + texture2D(tDiffuse, vUv - uDir*1.3846153846).rgb) * 0.3162162162;',
      '  s += (texture2D(tDiffuse, vUv + uDir*3.2307692308).rgb + texture2D(tDiffuse, vUv - uDir*3.2307692308).rgb) * 0.0702702703;',
      '  gl_FragColor = vec4(s, 1.0);',
      '}'
    ].join('\n')
  });

  // "Animated film" grading + depth of field + sun shafts
  matComp = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null }, tBloom: { value: null }, tDepth: { value: null },
      uBloom: { value: 0.62 }, uExposure: { value: 1.20 }, uTime: { value: 0 },
      uFlashA: { value: 0 }, uFlashB: { value: 0 }, uAspect: { value: 1 },
      uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 800) },
      uSunScreen: { value: new THREE.Vector2(0.5, 1.2) }, uSunVis: { value: 0 },
      uNear: { value: 0.3 }, uFar: { value: 800 }, uDof: { value: 1 }, uMenace: { value: 0 }
    },
    vertexShader: FS_VERT,
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform sampler2D tBloom; uniform sampler2D tDepth;',
      'uniform float uBloom, uExposure, uTime, uFlashA, uFlashB, uAspect;',
      'uniform float uSunVis, uNear, uFar, uDof, uMenace;',
      'uniform vec2 uTexel, uSunScreen;',
      'varying vec2 vUv;',
      'vec3 filmic(vec3 x){',                        // simplified ACES-style curve
      '  x = max(x, 0.0);',
      '  return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0);',
      '}',
      'float linDepth(vec2 uv){',
      '  float z = texture2D(tDepth, uv).x;',
      '  float ndc = z*2.0 - 1.0;',
      '  return (2.0*uNear*uFar)/(uFar + uNear - ndc*(uFar - uNear));',
      '}',
      // light anti-aliasing: diagonal average weighted by local contrast
      'vec3 aaSample(vec2 uv){',
      '  vec3 c0 = texture2D(tDiffuse, uv).rgb;',
      '  vec3 a = texture2D(tDiffuse, uv + vec2( 0.6, 0.6)*uTexel).rgb;',
      '  vec3 b = texture2D(tDiffuse, uv + vec2(-0.6, 0.6)*uTexel).rgb;',
      '  vec3 c = texture2D(tDiffuse, uv + vec2( 0.6,-0.6)*uTexel).rgb;',
      '  vec3 d = texture2D(tDiffuse, uv + vec2(-0.6,-0.6)*uTexel).rgb;',
      '  vec3 av = (a+b+c+d)*0.25;',
      '  return mix(c0, av, clamp(length(av-c0)*3.0, 0.0, 0.62));',
      '}',
      // depth of field: a small 7-tap disc whose radius follows the blur amount
      'vec3 dofSample(vec2 uv, float coc){',
      '  vec2 r = uTexel * (1.0 + coc*6.0);',
      '  vec3 s = texture2D(tDiffuse, uv).rgb * 0.24;',
      '  s += texture2D(tDiffuse, uv + vec2( 1.00, 0.00)*r).rgb * 0.127;',
      '  s += texture2D(tDiffuse, uv + vec2(-1.00, 0.00)*r).rgb * 0.127;',
      '  s += texture2D(tDiffuse, uv + vec2( 0.50, 0.87)*r).rgb * 0.127;',
      '  s += texture2D(tDiffuse, uv + vec2(-0.50, 0.87)*r).rgb * 0.127;',
      '  s += texture2D(tDiffuse, uv + vec2( 0.50,-0.87)*r).rgb * 0.127;',
      '  s += texture2D(tDiffuse, uv + vec2(-0.50,-0.87)*r).rgb * 0.127;',
      '  return s;',
      '}',
      'void main(){',
      '  vec2 uv = vUv;',
      '  vec2 c = uv - 0.5;',
      '  float r2 = dot(c,c);',
      // slight liquid wobble
      '  uv += vec2(sin(uv.y*11.0 + uTime*0.55), cos(uv.x*9.0 - uTime*0.42)) * 0.0013;',
      '  float dpt = linDepth(uv);',
      '  float coc = smoothstep(26.0, 135.0, dpt) * uDof;',
      '  vec3 col = coc > 0.02 ? dofSample(uv, coc) : aaSample(uv);',
      // soft chromatic aberration towards the edges
      '  float ca = 0.0016 * r2 * 3.0;',
      '  col.r = mix(col.r, texture2D(tDiffuse, uv + c*ca).r, 0.85);',
      '  col.b = mix(col.b, texture2D(tDiffuse, uv - c*ca).b, 0.85);',
      '  col += texture2D(tBloom, uv).rgb * uBloom;',
      // sun shafts: radial blur of the bright pass
      '  if(uSunVis > 0.001){',
      '    vec2 dir = (uSunScreen - uv) * 0.30;',
      '    vec3 sh = vec3(0.0);',
      '    for(int i = 0; i < 8; i++){',
      '      sh += texture2D(tBloom, uv + dir*(float(i)*0.125)).rgb;',
      '    }',
      '    col += sh * 0.125 * uSunVis * 0.85;',
      '  }',
      '  col *= uExposure;',
      '  col = filmic(col);',
      // grading
      '  float l = dot(col, vec3(0.299,0.587,0.114));',
      '  col = mix(vec3(l), col, 1.22);',
      '  col *= mix(vec3(0.90,1.02,1.06), vec3(1.05,1.0,0.95), smoothstep(0.15,0.85,l));',
      '  col = pow(col, vec3(0.95));',
      '  col += vec3(0.9,1.0,0.7) * uFlashA * (1.0 - r2*1.4);',
      '  col = mix(col, vec3(0.75,0.35,0.95), uFlashB*0.5*smoothstep(0.02,0.30,r2));',
      '  col *= 1.0 - smoothstep(0.14, 0.78, r2)*0.42;',
      '  col = mix(col, col*vec3(1.0,0.42,0.34), uMenace*smoothstep(0.02,0.34,r2)*0.85);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  });

  fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matComp);
  fsQuad.frustumCulled = false;
  fsScene.add(fsQuad);

  initShadows();
  window.addEventListener('resize', onResize);
  onResize();
}

function applyQuality() {
  var showInk = QUALITY > 0;
  scene.traverse(function (o) {
    if (o.userData && o.userData.isOutline) o.visible = showInk;
  });
}
/* ------------------------------------------------------------------ */
/* SUN SHADOWS                                                        */
/* An orthographic depth pass that follows the player; only objects   */
/* marked on layer 1 take part in it.                                 */
/* ------------------------------------------------------------------ */
var SHADOW = { size: 2048, cam: null, rt: null, depthMat: null, half: 74, ready: false };

function initShadows() {
  SHADOW.size = QUALITY === 2 ? 2048 : (QUALITY === 1 ? 1024 : 0);
  if (SHADOW.rt) { SHADOW.rt.dispose(); SHADOW.rt = null; }
  if (!SHADOW.size) { U.uShadowOn.value = 0; SHADOW.ready = false; return; }
  var d = SHADOW.half;
  SHADOW.cam = new THREE.OrthographicCamera(-d, d, d, -d, 1, 400);
  SHADOW.cam.layers.set(1);
  SHADOW.rt = new THREE.WebGLRenderTarget(SHADOW.size, SHADOW.size, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    type: renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType,
    depthBuffer: true, stencilBuffer: false
  });
  SHADOW.depthMat = new THREE.ShaderMaterial({
    vertexShader: [
      'varying float vD;',
      'void main(){',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  gl_Position = projectionMatrix * mv;',
      '  vD = gl_Position.z;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying float vD;',
      'void main(){ float d = vD*0.5 + 0.5; gl_FragColor = vec4(d, d, d, 1.0); }'
    ].join('\n'),
    side: THREE.FrontSide
  });
  U.tShadow.value = SHADOW.rt.texture;
  U.uShadowTexel.value = 1 / SHADOW.size;
  U.uShadowOn.value = 1;
  SHADOW.ready = true;
}

/** Marks an object (and its children) as casting a shadow. */
function castShadow(obj) {
  obj.layers.enable(1);
  for (var i = 0; i < obj.children.length; i++) castShadow(obj.children[i]);
  return obj;
}

var _shadowBias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
function renderShadowMap() {
  if (!SHADOW.ready) return;
  var c = SHADOW.cam, sun = U.uSunDir.value;
  // centred ahead of the player, snapped to the texel grid (no shimmer)
  camForward(tmpA);
  var cx = player.pos.x + tmpA.x * 26, cz = player.pos.z + tmpA.z * 26;
  var texel = (SHADOW.half * 2) / SHADOW.size;
  cx = Math.round(cx / texel) * texel;
  cz = Math.round(cz / texel) * texel;
  c.position.set(cx + sun.x * 160, sun.y * 160, cz + sun.z * 160);
  c.up.set(0, 1, 0);
  c.lookAt(cx, 0, cz);
  c.updateMatrixWorld(true);
  U.uShadowMat.value.copy(_shadowBias)
    .multiply(c.projectionMatrix)
    .multiply(c.matrixWorldInverse);

  scene.overrideMaterial = SHADOW.depthMat;
  renderer.setRenderTarget(SHADOW.rt);
  renderer.setClearColor(0xffffff, 1);
  renderer.clear();
  renderer.render(scene, c);
  scene.overrideMaterial = null;
}

function qualityScale() { return QUALITY === 2 ? Math.min(window.devicePixelRatio || 1, 2) : (QUALITY === 1 ? 1 : 0.72); }

function onResize() {
  W = window.innerWidth; H = window.innerHeight;
  var pr = qualityScale();
  pixelScale = pr;
  renderer.setPixelRatio(pr);
  renderer.setSize(W, H, true);
  var w = Math.max(2, Math.floor(W * pr)), h = Math.max(2, Math.floor(H * pr));
  rtScene.setSize(w, h);
  rtBrightA.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2));
  rtBrightB.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2));
  camera.aspect = W / H;
  camera.fov = W / H < 0.85 ? 74 : 62;
  camera.updateProjectionMatrix();
  matComp.uniforms.uAspect.value = W / H;
  matComp.uniforms.uTexel.value.set(1 / w, 1 / h);
  matComp.uniforms.uNear.value = camera.near;
  matComp.uniforms.uFar.value = camera.far;
  matComp.uniforms.uDof.value = QUALITY > 0 ? 1 : 0;
}

var _clear = new THREE.Color();
function waterTintJS(y) {
  var t = smoothstep(-24, CFG.WATER_Y * 0.85, y);
  _clear.copy(t < 0.55 ? U.uDeepCol.value : U.uMidCol.value)
    .lerp(t < 0.55 ? U.uMidCol.value : U.uSkyCol.value, t < 0.55 ? t / 0.55 : (t - 0.55) / 0.45);
  return _clear.lerp(U.uDeepCol.value, 0.38);
}
function renderFrame(dt) {
  renderShadowMap();
  renderer.setClearColor(waterTintJS(camera.position.y), 1);
  matComp.uniforms.uTime.value = U.uTime.value;
  matComp.uniforms.uFlashA.value = flashCollect;
  matComp.uniforms.uFlashB.value = flashSting;
  matComp.uniforms.uMenace.value = world.menace;

  renderer.setRenderTarget(rtScene);
  renderer.clear();
  renderer.render(scene, camera);

  if (QUALITY > 0) {
    var bw = rtBrightA.width, bh = rtBrightA.height;
    fsQuad.material = matBright;
    matBright.uniforms.tDiffuse.value = rtScene.texture;
    renderer.setRenderTarget(rtBrightA);
    renderer.render(fsScene, fsCam);

    fsQuad.material = matBlur;
    matBlur.uniforms.tDiffuse.value = rtBrightA.texture;
    matBlur.uniforms.uDir.value.set(1 / bw, 0);
    renderer.setRenderTarget(rtBrightB);
    renderer.render(fsScene, fsCam);

    matBlur.uniforms.tDiffuse.value = rtBrightB.texture;
    matBlur.uniforms.uDir.value.set(0, 1 / bh);
    renderer.setRenderTarget(rtBrightA);
    renderer.render(fsScene, fsCam);
  }

  // the sun's position on screen, for the shafts
  _v3.copy(camera.position).addScaledVector(U.uSunDir.value, 300).project(camera);
  matComp.uniforms.uSunScreen.value.set(_v3.x * 0.5 + 0.5, _v3.y * 0.5 + 0.5);
  camera.getWorldDirection(tmpA);
  matComp.uniforms.uSunVis.value = Math.pow(Math.max(0, tmpA.dot(U.uSunDir.value)), 2.2) * (QUALITY > 0 ? 1 : 0);

  fsQuad.material = matComp;
  matComp.uniforms.tDiffuse.value = rtScene.texture;
  matComp.uniforms.tDepth.value = rtScene.depthTexture;
  matComp.uniforms.tBloom.value = rtBrightA.texture;
  matComp.uniforms.uBloom.value = QUALITY > 0 ? 0.62 : 0.0;
  renderer.setRenderTarget(null);
  renderer.render(fsScene, fsCam);
}
