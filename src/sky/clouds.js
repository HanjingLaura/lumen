/**
 * Originkit Cloud Sky，按页面上的预设画满屏幕。
 * 云、卷云和太阳光都在着色器里算，没有贴图或视频。
 */
const NEAR_DRIFT = 0.055;
const FAR_DRIFT = 0.026;
const CIRRUS_DRIFT = 0.014;

const VERT_SRC = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform float uNearX, uFarX, uCirrusX;
uniform float uCoverage, uSize, uSoftness, uShadow, uCirrus;
uniform vec3 uZenith, uHorizon, uCloud;
uniform vec4 uGlow;
uniform vec2 uSun;
uniform vec2 uParallax;

vec2 hash22(vec2 p){
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}

float hash12(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float vnoise(vec2 x){
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++){
    s += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}

vec2 blobs(vec2 uv, float seed){
  vec2 id = floor(uv), f = fract(uv);

  float best = -1e4;
  float wsum = 0.0, ysum = 0.0;
  float wMax = min(2.150, 0.72 * uSize);
  float reach = min(2.0, ceil(wMax + 0.85) - 1.0);
  for (int j = -2; j <= 2; j++){
    for (int i = -2; i <= 2; i++){
      vec2 o = vec2(float(i), float(j));
      if (max(abs(o.x), abs(o.y)) > reach) continue;
      vec2 h = hash22(id + o + seed);

      if (fract(h.x * 37.1) > uCoverage) continue;
      vec2 c = o + 0.15 + h * 0.7;
      float w = min(2.150, (0.30 + 0.42 * fract(h.y * 19.7)) * uSize);
      vec2 d = f - c;

      float ry = (d.y > 0.0 ? 0.340 : 0.190) * uSize * (0.8 + 0.5 * fract(h.y * 7.3));
      float e = length(vec2(d.x / max(w, 1e-3), d.y / max(ry, 1e-3)));
      float val = 1.0 - e;
      float yN = d.y / max(ry, 1e-3);
      if (val > best){
        float k = exp(12.0 * (best - val));
        wsum = wsum * k + 1.0;
        ysum = ysum * k + yN;
        best = val;
      } else {
        float g = exp(12.0 * (val - best));
        wsum += g;
        ysum += g * yN;
      }
    }
  }
  return vec2(best, ysum / max(wsum, 1e-4));
}

vec2 cloudField(vec2 uv, float seed, float detailScale){
  vec2 b = blobs(uv, seed);

  float n = fbm(uv * detailScale + seed * 3.1) * 0.72
          + fbm(uv * detailScale * 3.3 + seed * 7.7) * 0.28;
  return vec2(b.x - (1.0 - n) * 0.700, b.y);
}

vec3 shadeCloud(float dyNorm, vec3 sky){
  float t = smoothstep(-0.95, 0.25, dyNorm);
  vec3 base = mix(uCloud * 0.52, sky, 0.34);
  return mix(mix(uCloud, base, uShadow), uCloud, t);
}

void main(){
  vec2 frag = gl_FragCoord.xy / max(uRes.y, 1.0);
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = vec2(frag.x, frag.y);

  vec3 sky = mix(uHorizon, uZenith, smoothstep(-0.15, 1.05, p.y));
  vec2 sunP = vec2(uSun.x * aspect, uSun.y);
  float sd = length(p - sunP);

  sky += uGlow.rgb * uGlow.a * exp(-sd * 3.4) * 0.30;

  vec3 col = sky;

  if (uCirrus > 0.0) {
    vec2 cuv = vec2(p.x * 1.4 + uCirrusX, p.y * 5.5);
    float veil = fbm(cuv) * fbm(cuv * 2.3 + 9.0);
    veil = smoothstep(0.24, 0.55, veil) * smoothstep(0.15, 0.7, p.y);
    col = mix(col, uCloud, veil * uCirrus * 0.5);
  }

  vec2 fuv = vec2(p.x + uFarX, p.y) * 2.150 + uParallax * 0.4;
  vec2 fd = cloudField(fuv, 17.0, 11.0);
  float fa = clamp(fd.x * uSoftness, 0.0, 1.0);
  if (fa > 0.0) {
    vec3 lit = shadeCloud(fd.y, sky);
    col = mix(col, mix(lit, sky, 0.550), fa);
  }

  vec2 nuv = vec2(p.x + uNearX, p.y) * 1.050 + uParallax;
  vec2 nd = cloudField(nuv, 3.0, 8.5);
  float na = clamp(nd.x * uSoftness, 0.0, 1.0);
  if (na > 0.0) {
    vec3 lit = shadeCloud(nd.y, sky);
    float above = clamp(cloudField(nuv + vec2(0.0, 0.085), 3.0, 8.5).x * uSoftness, 0.0, 1.0);
    lit *= 1.0 - 0.18 * uShadow * above;
    lit += uGlow.rgb * uGlow.a * 0.22 * exp(-length(p - sunP) * 1.6);
    col = mix(col, lit, na);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

const LOOK = {
  coverage: 1,
  speed: 64 / 50,
  size: 1.3,
  softness: 4.5 / 2,
  shadow: 0.7,
  cirrus: 1,
  sunX: 1,
  sunY: 1,
  parallax: 3,
  wind: 3,
  damping: 50,
  zenith: [0x00 / 255, 0x75 / 255, 0xff / 255],
  horizon: [0xb4 / 255, 0xd2 / 255, 0xf0 / 255],
  cloud: [1, 1, 1],
  glow: [1, 1, 1, 1],
};

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function mountClouds(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  const prog = vs && fs && gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const loc = (name) => gl.getUniformLocation(prog, name);
  const u = {
    res: loc('uRes'),
    nearX: loc('uNearX'),
    farX: loc('uFarX'),
    cirrusX: loc('uCirrusX'),
    coverage: loc('uCoverage'),
    size: loc('uSize'),
    softness: loc('uSoftness'),
    shadow: loc('uShadow'),
    cirrus: loc('uCirrus'),
    sun: loc('uSun'),
    parallax: loc('uParallax'),
    zenith: loc('uZenith'),
    horizon: loc('uHorizon'),
    cloud: loc('uCloud'),
    glow: loc('uGlow'),
  };

  let active = false;
  let raf = 0;
  let last = performance.now();
  let nearX = 0;
  let farX = 0;
  let cirrusX = 0;
  let leanX = 0;
  let leanY = 0;
  const pointer = { x: 0, y: 0, inside: false };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round((bounds.width || window.innerWidth) * dpr));
    const height = Math.max(1, Math.round((bounds.height || window.innerHeight) * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function frame(now) {
    if (!active) {
      raf = 0;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const k = 1 - Math.exp(-LOOK.damping * 0.12 * dt);
    leanX += ((pointer.inside ? pointer.x : 0) - leanX) * k;
    leanY += ((pointer.inside ? pointer.y : 0) - leanY) * k;
    const gust = 1 + leanX * LOOK.wind;
    const rate = LOOK.speed * gust;
    nearX = (nearX - NEAR_DRIFT * rate * dt) % 1000;
    farX = (farX - FAR_DRIFT * rate * dt) % 1000;
    cirrusX = (cirrusX - CIRRUS_DRIFT * rate * dt) % 1000;

    resize();
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.nearX, nearX);
    gl.uniform1f(u.farX, farX);
    gl.uniform1f(u.cirrusX, cirrusX);
    gl.uniform1f(u.coverage, LOOK.coverage);
    gl.uniform1f(u.size, LOOK.size);
    gl.uniform1f(u.softness, LOOK.softness);
    gl.uniform1f(u.shadow, LOOK.shadow);
    gl.uniform1f(u.cirrus, LOOK.cirrus);
    gl.uniform2f(u.sun, LOOK.sunX, LOOK.sunY);
    gl.uniform2f(u.parallax, -leanX * LOOK.parallax * 0.07, -leanY * LOOK.parallax * 0.05);
    gl.uniform3f(u.zenith, LOOK.zenith[0], LOOK.zenith[1], LOOK.zenith[2]);
    gl.uniform3f(u.horizon, LOOK.horizon[0], LOOK.horizon[1], LOOK.horizon[2]);
    gl.uniform3f(u.cloud, LOOK.cloud[0], LOOK.cloud[1], LOOK.cloud[2]);
    gl.uniform4f(u.glow, LOOK.glow[0], LOOK.glow[1], LOOK.glow[2], LOOK.glow[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  }

  function track(event) {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = 1 - ((event.clientY - bounds.top) / bounds.height) * 2;
    pointer.inside = true;
  }

  canvas.addEventListener('pointermove', track);
  canvas.addEventListener('pointerenter', track);
  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
  });

  return {
    setActive(next) {
      active = next;
      if (next && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else if (!next && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
  };
}
