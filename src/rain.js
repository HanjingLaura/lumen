/**
 * 场景 1：夜里站在窗内。外面是城市夜景和雨丝，玻璃上有雨点落下、汇成水痕。
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createRain(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let raf = 0;
  let running = false;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let city = null;
  let wet = null;
  let wetCtx = null;
  let streaks = [];
  let drops = [];
  let ripples = [];
  let last = 0;
  let nextDrop = 0;
  const frameTop = 18;
  const frameSide = 16;
  const frameBottom = 28;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    buildCity();
    wet = document.createElement('canvas');
    wet.width = canvas.width;
    wet.height = canvas.height;
    wetCtx = wet.getContext('2d');
    streaks = Array.from({ length: 110 }, () => createStreak(true));
    drops = Array.from({ length: 48 }, () => createDrop(true));
    ripples = [];
  }

  function buildCity() {
    const layer = document.createElement('canvas');
    layer.width = Math.floor(width * dpr);
    layer.height = Math.floor(height * dpr);
    const g = layer.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sky = g.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#060814');
    sky.addColorStop(0.46, '#10182a');
    sky.addColorStop(0.74, '#24202a');
    sky.addColorStop(1, '#16110e');
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);

    const horizon = height * 0.7;
    const haze = g.createLinearGradient(0, horizon - height * 0.16, 0, horizon + 20);
    haze.addColorStop(0, 'rgba(120, 130, 150, 0)');
    haze.addColorStop(1, 'rgba(120, 96, 78, 0.28)');
    g.fillStyle = haze;
    g.fillRect(0, horizon - height * 0.16, width, height * 0.2);

    let x = -10;
    while (x < width + 20) {
      const block = 34 + Math.random() * 78;
      const top = horizon - (40 + Math.random() ** 1.6 * height * 0.46);
      g.fillStyle = Math.random() > 0.82 ? '#12151c' : '#090b10';
      g.fillRect(x, top, block - 3, horizon - top);
      for (let wy = top + 12; wy < horizon - 14; wy += 12) {
        for (let wx = x + 7; wx < x + block - 12; wx += 10) {
          if (Math.random() > 0.46) continue;
          const roll = Math.random();
          g.fillStyle = roll > 0.82
            ? 'rgba(255, 198, 130, 0.92)'
            : roll > 0.45
              ? 'rgba(255, 168, 96, 0.5)'
              : 'rgba(170, 196, 214, 0.26)';
          g.fillRect(wx, wy, 3, 4.5);
        }
      }
      x += block;
    }

    g.fillStyle = '#0c0e13';
    g.fillRect(0, horizon, width, height - horizon);
    const sheen = g.createLinearGradient(0, horizon, 0, height);
    sheen.addColorStop(0, 'rgba(40, 36, 32, 0.2)');
    sheen.addColorStop(1, 'rgba(8, 8, 10, 0.65)');
    g.fillStyle = sheen;
    g.fillRect(0, horizon, width, height - horizon);

    [0.12, 0.31, 0.55, 0.73, 0.9].forEach((t, index) => {
      const lx = width * t;
      const ly = horizon + 6;
      const radius = 28 + (index % 2) * 16;
      const glow = g.createRadialGradient(lx, ly, 0, lx, ly, radius);
      glow.addColorStop(0, 'rgba(255, 196, 130, 0.7)');
      glow.addColorStop(0.35, 'rgba(255, 150, 70, 0.22)');
      glow.addColorStop(1, 'rgba(255, 140, 60, 0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(lx, ly, radius, 0, Math.PI * 2);
      g.fill();

      const reflection = g.createLinearGradient(lx, horizon, lx, horizon + radius * 2.4);
      reflection.addColorStop(0, 'rgba(255, 170, 90, 0.28)');
      reflection.addColorStop(1, 'rgba(255, 170, 90, 0)');
      g.fillStyle = reflection;
      g.fillRect(lx - 3, horizon, 6, radius * 2.4);
    });

    city = layer;
  }

  function createStreak(anywhere) {
    const speed = 780 + Math.random() * 640;
    return {
      x: Math.random() * (width + 80) - 40,
      y: anywhere ? Math.random() * height : -30,
      len: 18 + Math.random() * 34,
      vx: -120 - Math.random() * 90,
      vy: speed,
      alpha: 0.12 + Math.random() * 0.2,
    };
  }

  function createDrop(settled) {
    const radius = 1.05 + Math.random() ** 2 * 2.1;
    const drop = {
      x: frameSide + 8 + Math.random() * (width - frameSide * 2 - 16),
      y: frameTop + 10 + Math.random() * (height - frameTop - frameBottom - 30),
      r: radius,
      vy: 0,
      age: settled ? Math.random() * 0.8 : 0,
      wait: 0.5 + Math.random() * 2.2,
      sliding: settled && radius > 2.15 && Math.random() < 0.28,
    };
    if (drop.sliding) drop.vy = 18 + radius * 36;
    return drop;
  }

  function spawnImpact(drop) {
    ripples.push({ x: drop.x, y: drop.y, age: 0, life: 0.32, r: drop.r });
  }

  function paneClip() {
    ctx.beginPath();
    ctx.rect(frameSide, frameTop, width - frameSide * 2, height - frameTop - frameBottom);
    ctx.clip();
  }

  function drawStreaks(dt) {
    ctx.lineCap = 'round';
    for (const streak of streaks) {
      streak.x += streak.vx * dt;
      streak.y += streak.vy * dt;
      if (streak.y - streak.len > height || streak.x < -60) {
        Object.assign(streak, createStreak(false));
      }
      const scale = streak.len / streak.vy;
      const tailX = streak.x - streak.vx * scale;
      const tailY = streak.y - streak.vy * scale;
      ctx.strokeStyle = `rgba(214, 224, 236, ${streak.alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(streak.x, streak.y);
      ctx.stroke();
    }
  }

  function drawDrop(drop) {
    const body = ctx.createRadialGradient(
      drop.x - drop.r * 0.25,
      drop.y - drop.r * 0.35,
      drop.r * 0.1,
      drop.x,
      drop.y,
      drop.r,
    );
    body.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    body.addColorStop(0.42, 'rgba(186, 208, 222, 0.22)');
    body.addColorStop(1, 'rgba(140, 168, 188, 0.05)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230, 240, 248, 0.35)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  function updateDrops(dt) {
    wetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wetCtx.globalCompositeOperation = 'destination-out';
    wetCtx.fillStyle = REDUCED_MOTION ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.16)';
    wetCtx.fillRect(0, 0, width, height);
    wetCtx.globalCompositeOperation = 'source-over';

    for (let i = drops.length - 1; i >= 0; i -= 1) {
      const drop = drops[i];
      drop.age += dt;
      if (!drop.sliding && drop.age > drop.wait && drop.r > 2.05) {
        drop.sliding = true;
        drop.vy = 16 + drop.r * 34;
      }
      if (drop.sliding && !REDUCED_MOTION) {
        drop.vy = Math.min(drop.vy + dt * 40, 46 + drop.r * 42);
        drop.y += drop.vy * dt;
        drop.x += Math.sin(drop.y * 0.05 + drop.r) * 6 * dt;
        wetCtx.fillStyle = 'rgba(214, 228, 236, 0.28)';
        wetCtx.beginPath();
        wetCtx.arc(drop.x, drop.y, Math.max(0.6, drop.r * 0.42), 0, Math.PI * 2);
        wetCtx.fill();
      }

      if (drop.y > height - frameBottom - 2) {
        drops.splice(i, 1);
        continue;
      }
      drawDrop(drop);
    }
  }

  function drawRipples(dt) {
    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const ripple = ripples[i];
      ripple.age += dt;
      const t = ripple.age / ripple.life;
      if (t >= 1) {
        ripples.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = `rgba(230, 240, 248, ${(1 - t) * 0.45})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.r + t * 16, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawGlass() {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.35;
    ctx.drawImage(wet, 0, 0, width, height);
    ctx.restore();

    const room = ctx.createRadialGradient(width * 0.8, height * 0.86, 0, width * 0.8, height * 0.86, width * 0.42);
    room.addColorStop(0, 'rgba(255, 206, 160, 0.08)');
    room.addColorStop(1, 'rgba(255, 206, 160, 0)');
    ctx.fillStyle = room;
    ctx.fillRect(0, 0, width, height);

    const sheen = ctx.createLinearGradient(0, frameTop, 0, height * 0.42);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.055)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(frameSide, frameTop, width - frameSide * 2, height * 0.36);
  }

  function drawFrame() {
    ctx.fillStyle = '#12110f';
    ctx.fillRect(0, 0, width, frameTop);
    ctx.fillRect(0, height - frameBottom, width, frameBottom);
    ctx.fillRect(0, 0, frameSide, height);
    ctx.fillRect(width - frameSide, 0, frameSide, height);
    ctx.strokeStyle = 'rgba(255, 248, 236, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(frameSide + 0.5, frameTop + 0.5, width - frameSide * 2 - 1, height - frameTop - frameBottom - 1);
    ctx.fillStyle = 'rgba(255, 236, 210, 0.05)';
    ctx.fillRect(frameSide, height - frameBottom - 3, width - frameSide * 2, 3);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(city, 0, 0, width, height);
    ctx.save();
    paneClip();
    drawStreaks(REDUCED_MOTION ? dt * 0.25 : dt);
    updateDrops(dt);
    drawRipples(dt);
    drawGlass();
    ctx.restore();
    drawFrame();

    if (!REDUCED_MOTION && now >= nextDrop) {
      const drop = createDrop(false);
      drop.y = frameTop + 8 + Math.random() * 24;
      drops.push(drop);
      spawnImpact(drop);
      if (drops.length > 70) drops.shift();
      nextDrop = now + 90 + Math.random() * 140;
    }

    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    resize();
    running = true;
    last = 0;
    nextDrop = performance.now() + 180;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    streaks = [];
    drops = [];
    ripples = [];
  }

  window.addEventListener('resize', () => {
    if (running) resize();
  });

  return { start, stop };
}

let activeRain = null;

export function setRainActive(active) {
  const canvas = document.getElementById('sky');
  if (!canvas) return;
  if (active) {
    canvas.hidden = false;
    if (!activeRain) activeRain = createRain(canvas);
    activeRain.start();
    return;
  }
  if (activeRain) activeRain.stop();
  canvas.hidden = true;
}
