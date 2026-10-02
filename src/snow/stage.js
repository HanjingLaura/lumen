import { paintSnowNight } from './background.js';
import { createSnowLoop, hushSnowLoop, playSnowLoop } from './audio.js';

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

export function mountSnow(canvas) {
  const plate = document.createElement('canvas');
  plate.width = 1600;
  plate.height = 900;
  paintSnowNight(plate);
  const soft = document.createElement('canvas');
  soft.width = 1600;
  soft.height = 900;
  const softContext = soft.getContext('2d');
  softContext.filter = 'blur(5px)';
  softContext.drawImage(plate, 0, 0);
  softContext.filter = 'none';

  const softSprite = makeSoftSprite();
  const air = [];
  const glass = [];
  let seeded = false;
  let width = 1;
  let height = 1;
  let active = false;
  let raf = 0;
  let last = performance.now();
  let wind = 0.2;
  let audio = null;
  let unlocked = false;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(bounds.width || window.innerWidth));
    const nextHeight = Math.max(1, Math.round(bounds.height || window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(nextWidth * dpr);
    const pixelHeight = Math.round(nextHeight * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    width = nextWidth;
    height = nextHeight;
  }

  function fillAir() {
    const count = Math.round((width * height) / 6200);
    while (air.length < count) air.push(spawnAir(width, height));
    if (air.length > count + 40) air.length = count;
  }

  function stick(x, y, size) {
    if (glass.length > 120) {
      glass.sort((a, b) => a.r - b.r);
      glass.shift();
    }
    glass.push({
      x,
      y,
      r: 2.4 + size * 1.15,
      vy: 0,
      phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.4,
    });
  }

  function seedGlass() {
    if (seeded || width < 2) return;
    seeded = true;
    const count = 36 + Math.round(width / 80);
    for (let index = 0; index < count; index += 1) {
      stick(Math.random() * width, Math.random() * height, 1.5 + Math.random() * 6);
    }
  }

  function mergeGlass() {
    for (let index = glass.length - 1; index >= 0; index -= 1) {
      const flake = glass[index];
      for (let other = index - 1; other >= 0; other -= 1) {
        const neighbor = glass[other];
        const dx = flake.x - neighbor.x;
        const dy = flake.y - neighbor.y;
        const reach = (flake.r + neighbor.r) * 0.72;
        if (dx * dx + dy * dy > reach * reach) continue;
        const mass = flake.r * flake.r + neighbor.r * neighbor.r;
        neighbor.x = (neighbor.x * neighbor.r + flake.x * flake.r) / (neighbor.r + flake.r);
        neighbor.y = (neighbor.y * neighbor.r + flake.y * flake.r) / (neighbor.r + flake.r);
        neighbor.r = Math.min(28, Math.sqrt(mass));
        neighbor.vy = Math.max(neighbor.vy, flake.vy) * 0.4;
        glass.splice(index, 1);
        break;
      }
    }
  }

  function step(dt) {
    wind += (Math.sin(performance.now() * 0.00015) * 0.8 - wind) * dt * 0.15;
    for (const flake of air) {
      flake.phase += dt * flake.sway;
      flake.y += flake.speed * dt;
      flake.x += Math.sin(flake.phase) * (8 + flake.depth * 22) * dt + wind * (10 + flake.depth * 40) * dt;
      if (flake.x < -20) flake.x = width + 20;
      if (flake.x > width + 20) flake.x = -20;
      const nearGlass = flake.depth > 0.82 && flake.y > height * 0.08;
      if (nearGlass && Math.random() < dt * 0.22) {
        stick(flake.x, flake.y, flake.size);
        flake.y = -12 - Math.random() * 40;
        flake.x = Math.random() * width;
      } else if (flake.y > height + 12) {
        flake.y = -12;
        flake.x = Math.random() * width;
      }
    }
    for (const flake of glass) {
      const heavy = flake.r > 11;
      const target = heavy ? 8 + flake.r * 0.35 : 0.35 + flake.r * 0.04;
      flake.vy += (target - flake.vy) * dt * (heavy ? 0.35 : 0.12);
      flake.y += flake.vy * dt;
      flake.x += wind * (heavy ? 4 : 1.2) * dt + Math.sin(flake.phase) * dt * (heavy ? 2 : 0.6);
      flake.phase += dt * (0.15 + (flake.spin || 0));
      if (flake.y > height + flake.r) {
        flake.y = -flake.r;
        flake.x = Math.random() * width;
        flake.r = 3 + Math.random() * 5;
        flake.vy = 0;
      }
    }
    if (Math.random() < dt * 2) mergeGlass();
  }

  function drawGlass(context, flake) {
    const radius = flake.r;
    context.save();
    context.translate(flake.x, flake.y);
    context.fillStyle = 'rgba(70, 90, 120, 0.28)';
    context.beginPath();
    context.ellipse(radius * 0.15, radius * 0.45, radius * 0.85, radius * 0.38, 0, 0, Math.PI * 2);
    context.fill();
    const body = context.createRadialGradient(-radius * 0.2, -radius * 0.25, radius * 0.08, 0, 0, radius);
    body.addColorStop(0, 'rgba(255,255,255,0.97)');
    body.addColorStop(0.5, 'rgba(232, 240, 250, 0.88)');
    body.addColorStop(1, 'rgba(196, 214, 232, 0.2)');
    context.fillStyle = body;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    if (radius > 6) {
      context.beginPath();
      context.arc(radius * 0.28, radius * 0.08, radius * 0.46, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = 'rgba(255,255,255,0.7)';
    context.beginPath();
    context.arc(-radius * 0.28, -radius * 0.3, Math.max(1.2, radius * 0.16), 0, Math.PI * 2);
    context.fill();
    context.restore();
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
    seedGlass();
    step(dt);
    const context = canvas.getContext('2d');
    const scale = canvas.width / width;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.drawImage(soft, 0, 0, width, height);
    for (const flake of air) {
      if (flake.depth > 0.78) continue;
      const alpha = 0.18 + flake.depth * 0.45;
      context.globalAlpha = alpha;
      const size = flake.size * (0.7 + flake.depth);
      context.drawImage(softSprite, flake.x - size, flake.y - size, size * 2, size * 2);
    }
    context.globalAlpha = 1;
    const frost = context.createRadialGradient(width * 0.5, height * 0.5, width * 0.2, width * 0.5, height * 0.45, width * 0.72);
    frost.addColorStop(0, 'rgba(255,255,255,0)');
    frost.addColorStop(0.72, 'rgba(210, 224, 240, 0.02)');
    frost.addColorStop(1, 'rgba(226, 236, 248, 0.28)');
    context.fillStyle = frost;
    context.fillRect(0, 0, width, height);
    for (const flake of glass) drawGlass(context, flake);
    context.globalAlpha = 0.9;
    for (const flake of air) {
      if (flake.depth <= 0.78) continue;
      const size = flake.size * 1.35;
      context.drawImage(softSprite, flake.x - size, flake.y - size, size * 2, size * 2);
    }
    context.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  return {
    setActive(next) {
      active = next;
      if (next && !raf) {
        last = performance.now();
        resize();
        fillAir();
        raf = requestAnimationFrame(frame);
      } else if (!next && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (next && unlocked) playSnowLoop(audio);
      else hushSnowLoop(audio);
    },
    async unlock() {
      if (unlocked) return;
      unlocked = true;
      if (!audio) audio = createSnowLoop();
      if (active) await playSnowLoop(audio);
    },
  };
}
