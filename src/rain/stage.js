import { paintHarbor, soften } from './background.js';
import { playThunder, createRainAudio, resumeRainAudio, silenceRainAudio, updateRainAudio } from './audio.js';
import { createRain, stepRain } from './simulation.js';

const VERTEX = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform sampler2D uWater;
uniform sampler2D uSharp;
uniform sampler2D uBlur;
uniform vec2 uResolution;
uniform float uFog;
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  uv.y = 1.0 - uv.y;
  vec4 water = texture2D(uWater, uv);
  float wet = smoothstep(0.12, 0.52, water.a);
  vec2 slope = (water.rg - 0.5) * 2.0;
  float depth = water.b;
  vec2 aspect = vec2(uResolution.y / max(uResolution.x, 1.0), 1.0);
  vec2 lens = clamp(uv - slope * (0.04 + depth * 0.055) * aspect, 0.0, 1.0);
  vec3 through = texture2D(uSharp, lens).rgb * (1.02 + depth * 0.22);
  float rim = 1.0 - smoothstep(0.0, 0.58, depth);
  through *= 1.0 - rim * 0.32;
  vec3 normal = normalize(vec3(slope, max(depth, 0.06)));
  float highlight = pow(max(dot(normal, normalize(vec3(-0.32, -0.58, 0.75))), 0.0), 26.0);
  through += highlight * 0.4;
  vec3 glass = texture2D(uBlur, uv).rgb;
  glass = mix(glass, vec3(0.52, 0.6, 0.66) * (0.24 + dot(glass, vec3(0.33))), uFog * 0.2);
  gl_FragColor = vec4(mix(glass, through, wet), 1.0);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function program(gl) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vertex || !fragment) return null;
  const shader = gl.createProgram();
  gl.attachShader(shader, vertex);
  gl.attachShader(shader, fragment);
  gl.linkProgram(shader);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(shader, gl.LINK_STATUS)) return null;
  return shader;
}

function texture(gl, unit) {
  const handle = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, handle);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return handle;
}

function dropSprite() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  const center = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5 - center) / center;
      const ny = (y + 0.5 - center) / center;
      const distance = Math.hypot(nx, ny);
      const offset = (y * size + x) * 4;
      if (distance >= 1) continue;
      const facing = Math.sqrt(1 - distance * distance);
      image.data[offset] = Math.round(128 + 127 * nx);
      image.data[offset + 1] = Math.round(128 + 127 * ny);
      image.data[offset + 2] = Math.round(255 * facing);
      image.data[offset + 3] = Math.round(255 * Math.min(1, (1 - distance) * center * 0.75));
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function paintBackdrop(width, height, fog) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  const context = canvas.getContext('2d');
  paintHarbor(context, canvas.width, canvas.height);
  return { sharp: canvas, blur: soften(canvas, 0.35 + fog * 0.65) };
}

export function mountRain(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  const shader = gl && program(gl);
  if (!gl || !shader) return null;
  gl.useProgram(shader);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(shader, 'aPosition');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const water = texture(gl, 0);
  const sharp = texture(gl, 1);
  const blur = texture(gl, 2);
  gl.uniform1i(gl.getUniformLocation(shader, 'uWater'), 0);
  gl.uniform1i(gl.getUniformLocation(shader, 'uSharp'), 1);
  gl.uniform1i(gl.getUniformLocation(shader, 'uBlur'), 2);
  const resolution = gl.getUniformLocation(shader, 'uResolution');
  const fogUniform = gl.getUniformLocation(shader, 'uFog');

  const stamp = document.createElement('canvas');
  const stampContext = stamp.getContext('2d');
  const sprite = dropSprite();
  const fog = 0.6;
  const intensity = 0.55;
  const volume = 50;
  let rain = null;
  let backdrop = null;
  let audio = null;
  let unlocked = false;
  let active = false;
  let frame = 0;
  let last = performance.now();
  let nextThunder = 8 + Math.random() * 12;
  let elapsed = 0;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    stamp.width = width;
    stamp.height = height;
    rain = createRain(width, height);
    rain.intensity = intensity;
    backdrop = paintBackdrop(width, height, fog);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, sharp);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, backdrop.sharp);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, blur);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, backdrop.blur);
  }

  function drawDrop(drop, stretch) {
    const radius = drop.radius;
    stampContext.drawImage(sprite, drop.x - radius, drop.y - radius * stretch, radius * 2, radius * 2 * stretch);
  }

  function loop(now) {
    frame = requestAnimationFrame(loop);
    if (!active || document.hidden) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    if (!rain) return;
    stepRain(rain, dt * (reduced ? 0.4 : 1));
    if (elapsed >= nextThunder) {
      const distance = 0.8 + Math.random() * 7;
      nextThunder = elapsed + (18 + Math.random() * 40) * (intensity > 0.6 ? 0.75 : 1);
      if (Math.random() < 0.6) playThunder(audio, distance);
    }
    stampContext.clearRect(0, 0, stamp.width, stamp.height);
    for (const bead of rain.mist) drawDrop(bead, 1);
    for (const drop of [...rain.drops].sort((left, right) => left.radius - right.radius)) {
      drawDrop(drop, drop.vy > 20 ? 1.18 : 1.05);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, water);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, stamp);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform1f(fogUniform, fog);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);
  resize();
  frame = requestAnimationFrame(loop);

  return {
    setActive(next) {
      active = next;
      if (!next) silenceRainAudio(audio);
      else if (unlocked) resumeRainAudio(audio, { intensity, volume });
    },
    async unlock() {
      if (unlocked) return;
      unlocked = true;
      if (!audio) audio = createRainAudio();
      if (active) await resumeRainAudio(audio, { intensity, volume });
      else silenceRainAudio(audio);
      updateRainAudio(audio, { intensity, volume });
    },
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      audio?.context.close();
    },
  };
}
