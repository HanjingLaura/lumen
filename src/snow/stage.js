import { paintSnowNight } from './background.js';
import { createSnowLoop, hushSnowLoop, playSnowLoop } from './audio.js';
import { mountGlass } from '../rain/stage.js';

function makeSoftSprite() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 30);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.28, 'rgba(244,248,255,0.55)');
  glow.addColorStop(1, 'rgba(244,248,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);
  return canvas;
}

function spawnAir(width, height) {
  const depth = Math.random();
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    depth,
    speed: 18 + depth * 70,
    sway: 0.4 + Math.random() * 1.6,
    phase: Math.random() * Math.PI * 2,
    size: 1.2 + depth * 5.5,
  };
}

export function mountSnow(canvas, airCanvas) {
  const glass = mountGlass(canvas, {
    paint: paintSnowNight,
    createLoop: createSnowLoop,
    playLoop: playSnowLoop,
    hushLoop: hushSnowLoop,
    errorId: 'snowError',
    defer: true,
  });

  const sprite = makeSoftSprite();
  const air = [];
  let width = 1;
  let height = 1;
  let active = false;
  let raf = 0;
  let last = performance.now();
  let wind = 0.2;

  function resize() {
    const bounds = airCanvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(bounds.width || window.innerWidth));
    const nextHeight = Math.max(1, Math.round(bounds.height || window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(nextWidth * dpr);
    const pixelHeight = Math.round(nextHeight * dpr);
    if (airCanvas.width !== pixelWidth || airCanvas.height !== pixelHeight) {
      airCanvas.width = pixelWidth;
      airCanvas.height = pixelHeight;
    }
    width = nextWidth;
    height = nextHeight;
  }

  function fillAir() {
    const count = Math.round((width * height) / 6200);
    while (air.length < count) air.push(spawnAir(width, height));
    if (air.length > count + 40) air.length = count;
  }

  function step(dt) {
    wind += (Math.sin(performance.now() * 0.00015) * 0.8 - wind) * dt * 0.15;
    for (const flake of air) {
      flake.phase += dt * flake.sway;
      flake.y += flake.speed * dt;
      flake.x += Math.sin(flake.phase) * (8 + flake.depth * 22) * dt + wind * (10 + flake.depth * 40) * dt;
      if (flake.x < -20) flake.x = width + 20;
      if (flake.x > width + 20) flake.x = -20;
      if (flake.y > height + 12) {
        flake.y = -12;
        flake.x = Math.random() * width;
      }
    }
  }

  function frame(now) {
    if (!active) {
      raf = 0;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    resize();
    fillAir();
    step(dt);
    const context = airCanvas.getContext('2d');
    const scale = airCanvas.width / width;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);
    for (const flake of air) {
      const alpha = flake.depth > 0.78 ? 0.9 : 0.18 + flake.depth * 0.45;
      context.globalAlpha = alpha;
      const size = flake.size * (flake.depth > 0.78 ? 1.35 : 0.7 + flake.depth);
      context.drawImage(sprite, flake.x - size, flake.y - size, size * 2, size * 2);
    }
    context.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  return {
    async setActive(next) {
      active = next;
      await glass?.setActive(next);
      if (next && !raf) {
        last = performance.now();
        resize();
        fillAir();
        raf = requestAnimationFrame(frame);
      } else if (!next && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        const context = airCanvas.getContext('2d');
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, airCanvas.width, airCanvas.height);
      }
    },
    unlock() {
      return glass?.unlock();
    },
  };
}
