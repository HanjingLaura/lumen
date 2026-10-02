/**
 * 场景 2：暗夜空。星野和银河按一次缓慢的呼吸一起亮起、暗下，流星叠在上面。
 * 流星按一场小流星雨来排：大多数从同一辐射点方向掠过，少数是散现。
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
    sky.addColorStop(0, '#02030a');
    sky.addColorStop(0.42, '#070c18');
    sky.addColorStop(0.74, '#10192c');
    sky.addColorStop(1, '#1a2940');
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);

    const airglow = g.createLinearGradient(0, height * 0.62, 0, height);
    airglow.addColorStop(0, 'rgba(12, 28, 26, 0)');
    airglow.addColorStop(0.5, 'rgba(36, 72, 58, 0.16)');
    airglow.addColorStop(1, 'rgba(22, 40, 62, 0.22)');
    g.fillStyle = airglow;
    g.fillRect(0, height * 0.62, width, height * 0.38);

    drawMilkyWay(g);
    paintStars(g);
    drawVignette(g);
    backdrop = layer;

    const glow = document.createElement('canvas');
    glow.width = layer.width;
    glow.height = layer.height;
    const glowCtx = glow.getContext('2d');
    glowCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMilkyGlow(glowCtx, 1.05);
    glowLayer = glow;
  }

  function breathAmount(seconds) {
    const period = 6.4;
    const p = (seconds % period) / period;
    const inhale = 0.4;
    const hold = 0.1;
    const smooth = (t) => t * t * (3 - 2 * t);
    if (p < inhale) return smooth(p / inhale);
    if (p < inhale + hold) return 1;
    return 1 - smooth((p - inhale - hold) / (1 - inhale - hold));
  }

  function bandCoords(x, y) {
    const cx = x - width * 0.5;
    const cy = y - height * 0.46;
    const cos = 0.8572;
    const sin = 0.515;
    return {
      along: cx * cos + cy * sin,
      across: -cx * sin + cy * cos,
    };
  }

  function bandWeight(x, y) {
    const { along, across } = bandCoords(x, y);
    const acrossSigma = height * 0.13;
    const alongSigma = width * 0.46;
    return Math.exp(-(across * across) / (2 * acrossSigma * acrossSigma))
      * Math.exp(-(along * along) / (2 * alongSigma * alongSigma));
  }

  function milkyPoint(t, scatter = 1) {
    const wobble = Math.sin(t * Math.PI * 2.4) * 0.03 + Math.sin(t * 11.5) * 0.012;
    const spread = (Math.random() + Math.random() - 1) * height * 0.1 * scatter;
    return {
      x: width * (0.04 + t * 0.92),
      y: height * (0.84 - t * 0.7 + wobble) + spread,
    };
  }

  function drawMilkyGlow(g, strength) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 110; i += 1) {
      const t = i / 109;
      const point = milkyPoint(t, 0.15);
      const presence = Math.sin(t * Math.PI);
      const radius = height * (0.035 + presence * 0.07);
      const alpha = (0.02 + presence * 0.045) * strength;
      const gradient = g.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      const color = t > 0.42 && t < 0.66 ? '214, 198, 176' : '150, 170, 204';
      gradient.addColorStop(0, `rgba(${color}, ${alpha})`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      g.fillStyle = gradient;
      g.beginPath();
      g.arc(point.x, point.y, radius, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function drawMilkyWay(g) {
    drawMilkyGlow(g, 0.85);
    const count = Math.floor((width * height) / 520);
    for (let i = 0; i < count; i += 1) {
      const point = milkyPoint(Math.random(), 1);
      if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) continue;
      const [r, gc, b] = starColor();
      const alpha = 0.05 + Math.random() ** 2 * 0.55;
      g.fillStyle = `rgba(${r}, ${gc}, ${b}, ${alpha})`;
      const size = Math.random() < 0.94 ? 1 : 1.5;
      g.fillRect(point.x, point.y, size, size);
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
    const count = Math.floor((width * height) / 1100);
    for (let i = 0; i < count; i++) {
      const inCloud = Math.random() < 0.42;
      let x = 0;
      let y = 0;
      if (inCloud) {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          x = Math.random() * width;
          y = Math.random() * height;
          if (Math.random() < bandWeight(x, y)) break;
        }
      } else {
        x = Math.random() * width;
        y = Math.random() * height;
      }

      const brightRoll = Math.random();
      const magnitude = brightRoll < 0.9 ? Math.random() ** 2 * 0.42 : 0.42 + Math.random() * 0.58;
      const [r, gc, b] = starColor();
      const horizon = 0.42 + 0.58 * (1 - y / height);
      const alpha = (0.12 + magnitude * 0.82) * horizon;
      const radius = magnitude > 0.82 ? 1.25 : magnitude > 0.5 ? 0.85 : 0.55;

      if (magnitude > 0.72 && !REDUCED_MOTION) {
        brightStars.push({
          x,
          y,
          r,
          g: gc,
          b,
          alpha,
          radius,
          phase: Math.random() * Math.PI * 2,
          speed: 0.6 + Math.random() * 1.8,
          spike: magnitude > 0.94,
        });
        continue;
      }

      g.fillStyle = `rgba(${r}, ${gc}, ${b}, ${alpha})`;
      g.beginPath();
      g.arc(x, y, radius, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawVignette(g) {
    const vignette = g.createRadialGradient(
      width * 0.5,
      height * 0.42,
      height * 0.15,
      width * 0.5,
      height * 0.48,
      Math.max(width, height) * 0.72,
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    g.fillStyle = vignette;
    g.fillRect(0, 0, width, height);
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
    const midX = width * (0.18 + Math.random() * 0.64);
    const midY = height * (0.12 + Math.random() * 0.58);
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

      const offscreen = meteor.x < -80 || meteor.x > width + 80 || meteor.y < -80 || meteor.y > height + 80;
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
      const flicker = (0.45 + 0.55 * breath) * drift;
      const alpha = Math.min(1, star.alpha * flicker);
      const radius = star.radius * (0.7 + 0.55 * breath);
      ctx.fillStyle = `rgba(${star.r}, ${star.g}, ${star.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (!star.spike) continue;
      const length = star.radius * (4 + 5 * breath) * drift;
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
    const breath = REDUCED_MOTION ? 0.75 : breathAmount(now / 1000);
    if (!REDUCED_MOTION && glowLayer) {
      ctx.fillStyle = `rgba(1, 2, 8, ${(1 - breath) * 0.22})`;
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.28 + 0.72 * breath;
      ctx.drawImage(glowLayer, 0, 0, width, height);
      ctx.restore();
    }
    drawTwinkles(now, breath);
    updateMeteors(dt);
    drawSparks(dt);
    drawSatellites(dt);

    if (!REDUCED_MOTION && now >= nextMeteor) {
      meteors.push(createMeteor());
      if (Math.random() < 0.12) meteors.push(createMeteor());
      nextMeteor = now + 1100 + Math.random() ** 1.4 * 3200;
    } else if (REDUCED_MOTION && now >= nextMeteor) {
      meteors.push(createMeteor());
      nextMeteor = now + 8000;
    }

    if (now >= nextSatellite) {
      satellites.push(createSatellite());
      nextSatellite = now + (REDUCED_MOTION ? 40000 : 18000 + Math.random() * 22000);
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
