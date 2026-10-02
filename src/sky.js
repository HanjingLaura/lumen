/**
 * 场景 2：固定地平线视角。黑山在下，银河贴在右侧，流星只从天空划过。
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createSky(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let raf = 0;
  let running = false;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let backdrop = null;
  let glowLayer = null;
  let brightStars = [];
  let meteors = [];
  let sparks = [];
  let satellites = [];
  let last = 0;
  let nextMeteor = 0;
  let nextSatellite = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    buildBackdrop();
  }

  function buildBackdrop() {
    const layer = document.createElement('canvas');
    layer.width = Math.floor(width * dpr);
    layer.height = Math.floor(height * dpr);
    const g = layer.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sky = g.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#04060d');
    sky.addColorStop(0.62, '#08111c');
    sky.addColorStop(1, '#10202c');
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);

    paintStars(g);
    drawMilkyWay(g);
    drawHills(g);
    backdrop = layer;
    glowLayer = null;
  }

  function horizonAt(x) {
    const n = x / Math.max(1, width);
    return height * (
      0.655
      + Math.sin(n * Math.PI * 1.05) * 0.04
      + Math.sin(n * Math.PI * 2.35 + 0.8) * 0.02
      + Math.sin(n * 8.2 + 1.4) * 0.007
    );
  }

  function drawHills(g) {
    g.fillStyle = '#010204';
    g.beginPath();
    g.moveTo(0, height);
    g.lineTo(0, horizonAt(0));
    for (let x = 0; x <= width; x += 3) g.lineTo(x, horizonAt(x));
    g.lineTo(width, height);
    g.closePath();
    g.fill();
  }

  function milkyWeight(x, y) {
    const nx = x / Math.max(1, width);
    const ny = y / Math.max(1, height);
    const t = (0.66 - ny) / 0.64;
    if (t < -0.08 || t > 1.2) return 0;
    const center = 0.7 + t * 0.26;
    const dist = nx - center;
    const sigma = 0.085;
    return Math.exp(-(dist * dist) / (2 * sigma * sigma));
  }

  function drawMilkyWay(g) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 36; i += 1) {
      const t = i / 35;
      const x = width * (0.7 + t * 0.26);
      const y = height * (0.64 - t * 0.6);
      const radius = height * (0.05 + Math.sin(t * Math.PI) * 0.06);
      const gradient = g.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(170, 184, 206, 0.02)');
      gradient.addColorStop(1, 'rgba(186, 196, 214, 0)');
      g.fillStyle = gradient;
      g.beginPath();
      g.arc(x, y, radius, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    const count = Math.floor((width * height) / 140);
    for (let i = 0; i < count; i += 1) {
      const x = width * (0.55 + Math.random() * 0.48);
      const y = Math.random() * height * 0.7;
      if (milkyWeight(x, y) < Math.random()) continue;
      if (y > horizonAt(x) - 4) continue;
      const [r, gc, b] = starColor();
      const alpha = 0.15 + Math.random() * 0.75;
      g.fillStyle = `rgba(${r}, ${gc}, ${b}, ${alpha})`;
      g.fillRect(x, y, Math.random() < 0.9 ? 1 : 1.4, 1);
    }
  }

  function starColor() {
    const roll = Math.random();
    if (roll < 0.62) return [232, 238, 255];
    if (roll < 0.84) return [255, 246, 232];
    if (roll < 0.94) return [255, 214, 176];
    return [186, 206, 255];
  }

  function paintStars(g) {
    brightStars = [];
    const count = Math.floor((width * height) / 420);
    for (let i = 0; i < count; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.72;
      if (y > horizonAt(x) - 3) continue;
      const magnitude = Math.random() ** 2;
      const [r, gc, b] = starColor();
      const alpha = 0.25 + magnitude * 0.7;
      if (magnitude > 0.86 && !REDUCED_MOTION) {
        brightStars.push({
          x,
          y,
          r,
          g: gc,
          b,
          alpha,
          radius: magnitude > 0.96 ? 1.15 : 0.8,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 0.8,
          spike: magnitude > 0.97,
        });
      }
      g.fillStyle = `rgba(${r}, ${gc}, ${b}, ${alpha})`;
      g.fillRect(x, y, magnitude > 0.9 ? 1.5 : 1, magnitude > 0.9 ? 1.5 : 1);
    }
  }

  function meteorColor() {
    const roll = Math.random();
    if (roll < 0.46) return [236, 244, 255];
    if (roll < 0.72) return [198, 255, 220];
    if (roll < 0.9) return [255, 232, 190];
    return [255, 176, 140];
  }

  function createMeteor() {
    const roll = Math.random();
    let angle;
    if (roll < 0.68) angle = 0.22 + Math.random() * 0.48;
    else if (roll < 0.88) angle = Math.PI - 0.55 + Math.random() * 0.7;
    else angle = 0.95 + Math.random() * 0.4;

    const speed = Math.min(width, height) * (0.9 + Math.random() * 1.15);
    const duration = 0.34 + Math.random() * 0.48;
    const travel = speed * duration;
    const midX = width * (0.12 + Math.random() * 0.76);
    const midY = height * (0.08 + Math.random() * 0.42);
    const fireball = Math.random() < 0.14;
    const [cr, cg, cb] = meteorColor();

    return {
      x: midX - Math.cos(angle) * travel * 0.42,
      y: midY - Math.sin(angle) * travel * 0.42,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      duration,
      trail: fireball ? 0.14 + Math.random() * 0.05 : 0.06 + Math.random() * 0.05,
      thickness: fireball ? 2.4 : 1.15 + Math.random() * 0.55,
      glow: fireball ? 16 : 8,
      peak: fireball ? 1 : 0.75 + Math.random() * 0.25,
      cr,
      cg,
      cb,
      history: [],
      fireball,
      burst: false,
    };
  }

  function createSatellite() {
    const fromLeft = Math.random() < 0.5;
    const y = height * (0.12 + Math.random() * 0.7);
    const speed = width * (0.035 + Math.random() * 0.04);
    return {
      x: fromLeft ? -20 : width + 20,
      y,
      vx: fromLeft ? speed : -speed,
      vy: height * (Math.random() - 0.5) * 0.01,
      alpha: 0.55 + Math.random() * 0.35,
    };
  }

  function envelope(meteor) {
    const t = meteor.age / meteor.duration;
    const fadeIn = Math.min(1, t / 0.08);
    const fadeOut = t > 0.78 ? Math.max(0, (1 - t) / 0.22) : 1;
    return fadeIn * fadeOut;
  }

  function drawMeteor(meteor) {
    const history = meteor.history;
    if (history.length < 2) return;
    const tail = history[0];
    const head = history[history.length - 1];
    const strength = envelope(meteor) * meteor.peak;
    if (strength <= 0.01) return;

    const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, meteor.glow);
    glow.addColorStop(0, `rgba(255, 255, 255, ${strength})`);
    glow.addColorStop(0.22, `rgba(${meteor.cr}, ${meteor.cg}, ${meteor.cb}, ${strength * 0.55})`);
    glow.addColorStop(1, `rgba(${meteor.cr}, ${meteor.cg}, ${meteor.cb}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(head.x, head.y, meteor.glow, 0, Math.PI * 2);
    ctx.fill();

    const streak = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    streak.addColorStop(0, `rgba(${meteor.cr}, ${meteor.cg}, ${meteor.cb}, 0)`);
    streak.addColorStop(0.45, `rgba(${meteor.cr}, ${meteor.cg}, ${meteor.cb}, ${strength * 0.28})`);
    streak.addColorStop(0.82, `rgba(255, 255, 255, ${strength * 0.75})`);
    streak.addColorStop(1, `rgba(255, 255, 255, ${strength})`);
    ctx.lineCap = 'round';
    ctx.strokeStyle = streak;
    ctx.lineWidth = meteor.thickness;
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();
  }

  function updateMeteors(dt) {
    for (let i = meteors.length - 1; i >= 0; i -= 1) {
      const meteor = meteors[i];
      meteor.age += dt;
      meteor.x += meteor.vx * dt;
      meteor.y += meteor.vy * dt;
      meteor.history.push({ x: meteor.x, y: meteor.y, t: meteor.age });
      while (meteor.history.length && meteor.age - meteor.history[0].t > meteor.trail) {
        meteor.history.shift();
      }

      if (meteor.fireball && !meteor.burst && meteor.age > meteor.duration * 0.7) {
        meteor.burst = true;
        for (let n = 0; n < 3; n += 1) {
          sparks.push({
            x: meteor.x,
            y: meteor.y,
            vx: meteor.vx * (0.25 + Math.random() * 0.35) + (Math.random() - 0.5) * 160,
            vy: meteor.vy * (0.25 + Math.random() * 0.35) + (Math.random() - 0.5) * 160,
            age: 0,
            life: 0.16 + Math.random() * 0.18,
            cr: meteor.cr,
            cg: meteor.cg,
            cb: meteor.cb,
          });
        }
      }

      drawMeteor(meteor);

      const offscreen = meteor.x < -80 || meteor.x > width + 80 || meteor.y < -80 || meteor.y > horizonAt(meteor.x);
      if (meteor.age >= meteor.duration || offscreen) meteors.splice(i, 1);
    }
  }

  function drawSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const spark = sparks[i];
      spark.age += dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      const fade = Math.max(0, 1 - spark.age / spark.life);
      ctx.fillStyle = `rgba(${spark.cr}, ${spark.cg}, ${spark.cb}, ${fade})`;
      ctx.fillRect(spark.x, spark.y, 1.4, 1.4);
      if (spark.age >= spark.life) sparks.splice(i, 1);
    }
  }

  function drawSatellites(dt) {
    for (let i = satellites.length - 1; i >= 0; i -= 1) {
      const satellite = satellites[i];
      satellite.x += satellite.vx * dt;
      satellite.y += satellite.vy * dt;
      ctx.fillStyle = `rgba(236, 240, 255, ${satellite.alpha})`;
      ctx.beginPath();
      ctx.arc(satellite.x, satellite.y, 1.15, 0, Math.PI * 2);
      ctx.fill();
      if (satellite.x < -40 || satellite.x > width + 40) satellites.splice(i, 1);
    }
  }

  function drawTwinkles(now, breath) {
    if (REDUCED_MOTION) return;
    for (const star of brightStars) {
      const drift = 0.9 + 0.1 * Math.sin(now * 0.0004 * star.speed + star.phase);
      const flicker = (0.82 + 0.18 * breath) * drift;
      const alpha = Math.min(1, star.alpha * flicker);
      const radius = star.radius * (0.92 + 0.12 * breath);
      ctx.fillStyle = `rgba(${star.r}, ${star.g}, ${star.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (!star.spike) continue;
      const length = star.radius * 6.2 * drift;
      ctx.strokeStyle = `rgba(${star.r}, ${star.g}, ${star.b}, ${alpha * 0.4})`;
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(star.x - length, star.y);
      ctx.lineTo(star.x + length, star.y);
      ctx.moveTo(star.x, star.y - length);
      ctx.lineTo(star.x, star.y + length);
      ctx.stroke();
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(backdrop, 0, 0, width, height);
    drawTwinkles(now, 0.85);
    updateMeteors(dt);
    drawSparks(dt);

    if (!REDUCED_MOTION && now >= nextMeteor) {
      meteors.push(createMeteor());
      if (Math.random() < 0.12) meteors.push(createMeteor());
      nextMeteor = now + 1100 + Math.random() ** 1.4 * 3200;
    } else if (REDUCED_MOTION && now >= nextMeteor) {
      meteors.push(createMeteor());
      nextMeteor = now + 8000;
    }

    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    resize();
    running = true;
    last = 0;
    const now = performance.now();
    nextMeteor = now + 500;
    nextSatellite = now + 6000;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    meteors = [];
    sparks = [];
    satellites = [];
  }

  window.addEventListener('resize', () => {
    if (running) resize();
  });

  return { start, stop };
}

let activeSky = null;

export function setSkyActive(active) {
  const canvas = document.getElementById('sky');
  if (!canvas) return;
  if (active) {
    canvas.hidden = false;
    if (!activeSky) activeSky = createSky(canvas);
    activeSky.start();
    return;
  }
  if (activeSky) activeSky.stop();
  canvas.hidden = true;
}
