/**
 * 场景 1：对焦在窗玻璃上。外面的夜景是散开的光斑，
 * 一部分雨打在玻璃上停住，一部分在玻璃前直直落下。
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createRain(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let raf = 0;
  let running = false;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let outside = null;
  let streaks = [];
  let drops = [];
  let ripples = [];
  let last = 0;
  let nextStreak = 0;
  const sash = { top: 26, side: 22, bottom: 34 };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    outside = buildOutside();
    streaks = Array.from({ length: 46 }, () => createStreak(true));
    drops = Array.from({ length: 18 }, () => createDrop(true));
    ripples = [];
  }

  function buildOutside() {
    const sharp = document.createElement('canvas');
    sharp.width = Math.floor(width * dpr);
    sharp.height = Math.floor(height * dpr);
    const g = sharp.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sky = g.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#070912');
    sky.addColorStop(0.42, '#121826');
    sky.addColorStop(0.72, '#1c1a22');
    sky.addColorStop(1, '#120e0c');
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);

    const horizon = height * 0.62;
    g.fillStyle = '#0a0c12';
    let x = -20;
    while (x < width + 30) {
      const block = 50 + Math.random() * 110;
      const top = horizon - (30 + Math.random() ** 1.4 * height * 0.38);
      g.globalAlpha = 0.55 + Math.random() * 0.4;
      g.fillRect(x, top, block, horizon - top + height);
      x += block * 0.72;
    }
    g.globalAlpha = 1;

    const blurred = document.createElement('canvas');
    blurred.width = sharp.width;
    blurred.height = sharp.height;
    const b = blurred.getContext('2d');
    const blurPx = Math.max(16, Math.round(22 * dpr));
    b.filter = `blur(${blurPx}px)`;
    b.drawImage(sharp, 0, 0);
    b.filter = `blur(${Math.round(blurPx * 0.65)}px)`;
    b.drawImage(blurred, 0, 0);
    b.filter = 'none';
    b.setTransform(dpr, 0, 0, dpr, 0, 0);

    const lights = 70 + Math.floor((width * height) / 28000);
    for (let i = 0; i < lights; i += 1) {
      const lx = Math.random() * width;
      const ly = height * (0.2 + Math.random() * 0.5);
      const radius = 14 + Math.random() ** 1.6 * 48;
      const warm = Math.random();
      const color = warm > 0.78 ? '176, 206, 255' : warm > 0.18 ? '255, 176, 96' : '255, 206, 150';
      const alpha = 0.12 + Math.random() * 0.32;
      const glow = b.createRadialGradient(lx, ly, 0, lx, ly, radius);
      glow.addColorStop(0, `rgba(${color}, ${alpha})`);
      glow.addColorStop(0.45, `rgba(${color}, ${alpha * 0.28})`);
      glow.addColorStop(1, `rgba(${color}, 0)`);
      b.fillStyle = glow;
      b.beginPath();
      b.arc(lx, ly, radius, 0, Math.PI * 2);
      b.fill();
    }

    [0.16, 0.38, 0.58, 0.8].forEach((t) => {
      const lx = width * t + (Math.random() - 0.5) * 40;
      const ly = horizon + 18;
      const radius = 34 + Math.random() * 28;
      const glow = b.createRadialGradient(lx, ly, 0, lx, ly, radius);
      glow.addColorStop(0, 'rgba(255, 176, 90, 0.55)');
      glow.addColorStop(0.4, 'rgba(255, 140, 60, 0.16)');
      glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
      b.fillStyle = glow;
      b.beginPath();
      b.arc(lx, ly, radius, 0, Math.PI * 2);
      b.fill();
    });

    return blurred;
  }

  function paneX() {
    return sash.side + 6 + Math.random() * (width - sash.side * 2 - 12);
  }

  function createStreak(anywhere) {
    const near = Math.random() < 0.35;
    return {
      x: paneX(),
      y: anywhere ? Math.random() * height : sash.top - 20,
      len: near ? 18 + Math.random() * 16 : 10 + Math.random() * 14,
      vy: near ? 920 + Math.random() * 480 : 640 + Math.random() * 280,
      width: near ? 1.35 : 0.7,
      alpha: near ? 0.28 + Math.random() * 0.22 : 0.1 + Math.random() * 0.12,
      stickAt: Math.random() < 0.16 ? sash.top + 40 + Math.random() * (height * 0.5) : null,
    };
  }

  function createDrop(settled) {
    const radius = 3.6 + Math.random() ** 1.2 * 5.5;
    return {
      x: paneX(),
      y: settled
        ? sash.top + 16 + Math.random() * (height - sash.top - sash.bottom - 36)
        : sash.top + 12,
      r: radius,
      vy: 0,
      age: settled ? Math.random() * 2 : 0,
      slideAfter: 1.6 + Math.random() * 3.4,
      sliding: false,
      canSlide: radius > 4.2 && Math.random() < 0.55,
    };
  }

  function stickStreak(streak) {
    const radius = 3.2 + Math.random() * 4.2;
    drops.push({
      x: streak.x,
      y: streak.y,
      r: radius,
      vy: 0,
      age: 0,
      slideAfter: 2 + Math.random() * 4,
      sliding: false,
      canSlide: radius > 4 && Math.random() < 0.4,
    });
    ripples.push({ x: streak.x, y: streak.y, age: 0, life: 0.28, r: radius });
    if (drops.length > 24) drops.shift();
  }

  function drawStreaks(dt) {
    ctx.lineCap = 'round';
    for (let i = streaks.length - 1; i >= 0; i -= 1) {
      const streak = streaks[i];
      if (!REDUCED_MOTION) streak.y += streak.vy * dt;
      const hit = streak.stickAt != null && streak.y >= streak.stickAt;
      const gone = streak.y - streak.len > height - sash.bottom;
      if (hit) stickStreak(streak);
      if (hit || gone) {
        streaks[i] = createStreak(false);
        continue;
      }
      ctx.strokeStyle = `rgba(226, 234, 242, ${streak.alpha})`;
      ctx.lineWidth = streak.width;
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y - streak.len);
      ctx.lineTo(streak.x, streak.y);
      ctx.stroke();
    }
  }

  function drawDrop(drop) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
    ctx.clip();
    const zoom = 1.55;
    ctx.drawImage(
      outside,
      (drop.x - drop.r) * dpr,
      (drop.y - drop.r) * dpr,
      drop.r * 2 * dpr,
      drop.r * 2 * dpr,
      drop.x - drop.r * zoom,
      drop.y - drop.r * zoom * 1.15,
      drop.r * 2 * zoom,
      drop.r * 2 * zoom,
    );
    const shade = ctx.createRadialGradient(drop.x, drop.y, drop.r * 0.55, drop.x, drop.y, drop.r);
    shade.addColorStop(0, 'rgba(255, 255, 255, 0)');
    shade.addColorStop(1, 'rgba(210, 226, 236, 0.28)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.ellipse(drop.x - drop.r * 0.28, drop.y - drop.r * 0.32, Math.max(1.1, drop.r * 0.22), Math.max(0.6, drop.r * 0.12), -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function updateDrops(dt) {
    for (let i = drops.length - 1; i >= 0; i -= 1) {
      const drop = drops[i];
      drop.age += dt;
      if (drop.canSlide && !drop.sliding && drop.age > drop.slideAfter) {
        drop.sliding = true;
        drop.vy = 8 + drop.r * 6;
      }
      if (drop.sliding && !REDUCED_MOTION) {
        drop.vy = Math.min(drop.vy + dt * 18, 22 + drop.r * 8);
        drop.y += drop.vy * dt;
        drop.x += Math.sin(drop.age * 1.4) * 4 * dt;
      }
      if (drop.y > height - sash.bottom - drop.r) {
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
      ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - t) * 0.16})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.r + t * 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawGlass() {
    const tint = ctx.createLinearGradient(0, sash.top, 0, height - sash.bottom);
    tint.addColorStop(0, 'rgba(186, 206, 224, 0.05)');
    tint.addColorStop(0.5, 'rgba(8, 12, 18, 0.04)');
    tint.addColorStop(1, 'rgba(8, 10, 14, 0.12)');
    ctx.fillStyle = tint;
    ctx.fillRect(sash.side, sash.top, width - sash.side * 2, height - sash.top - sash.bottom);

    const room = ctx.createRadialGradient(width * 0.18, height * 0.2, 0, width * 0.18, height * 0.2, width * 0.34);
    room.addColorStop(0, 'rgba(255, 228, 196, 0.07)');
    room.addColorStop(1, 'rgba(255, 228, 196, 0)');
    ctx.fillStyle = room;
    ctx.fillRect(sash.side, sash.top, width - sash.side * 2, height * 0.45);

    const sheen = ctx.createLinearGradient(width * 0.15, 0, width * 0.72, height);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(0.42, 'rgba(255, 255, 255, 0.045)');
    sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(sash.side, sash.top, width - sash.side * 2, height - sash.top - sash.bottom);
  }

  function drawFrame() {
    const frame = ctx.createLinearGradient(0, 0, 0, height);
    frame.addColorStop(0, '#2a241e');
    frame.addColorStop(1, '#14110e');
    ctx.fillStyle = frame;
    ctx.fillRect(0, 0, width, sash.top);
    ctx.fillRect(0, height - sash.bottom, width, sash.bottom);
    ctx.fillRect(0, 0, sash.side, height);
    ctx.fillRect(width - sash.side, 0, sash.side, height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(sash.side, sash.top, width - sash.side * 2, 10);
    ctx.fillRect(sash.side, sash.top, 8, height - sash.top - sash.bottom);

    ctx.strokeStyle = 'rgba(255, 236, 214, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sash.side + 1, sash.top + 1, width - sash.side * 2 - 2, height - sash.top - sash.bottom - 2);

    ctx.fillStyle = '#3a322a';
    ctx.fillRect(sash.side, height - sash.bottom - 5, width - sash.side * 2, 5);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(outside, 0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(sash.side, sash.top, width - sash.side * 2, height - sash.top - sash.bottom);
    ctx.clip();
    drawStreaks(dt);
    updateDrops(dt);
    drawRipples(dt);
    drawGlass();
    ctx.restore();
    drawFrame();

    if (!REDUCED_MOTION && streaks.length < 64 && now >= nextStreak) {
      streaks.push(createStreak(false));
      nextStreak = now + 40 + Math.random() * 70;
    }

    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    resize();
    running = true;
    last = 0;
    nextStreak = performance.now() + 80;
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
