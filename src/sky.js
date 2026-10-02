/**
 * 场景 2：固定镜头的夜空。
 * 画法对齐 AstroShot（暗色天空、闪烁、传感器噪点、两类流星、山脊压住轨迹），
 * 镜头锁在地平线附近，银河用程序生成在右侧，不使用全景照片。
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SKY_HUE = 218;
const SKY_SAT = 0.4;
const SKY_BRIGHTNESS = 0.67;
const METEOR_RATE = 7;
const SENSOR_NOISE = 0.28;

export function createSky(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let raf = 0;
  let running = false;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let skyLayer = null;
  let milkyLayer = null;
  let noiseLayer = null;
  let stars = [];
  let meteors = [];
  let last = 0;
  let nextMeteor = 0;
  let startedAt = 0;
  let opened = false;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    buildSky();
    buildMilkyWay();
    buildStars();
    buildNoise();
  }

  function hsl(h, s, l) {
    return `hsl(${h} ${s}% ${l}%)`;
  }

  function buildSky() {
    const layer = document.createElement('canvas');
    layer.width = canvas.width;
    layer.height = canvas.height;
    const g = layer.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const brightness = SKY_BRIGHTNESS;
    const topL = 1.4 + brightness * 3.2;
    const midL = 2.5 + brightness * 5.4;
    const botL = 3.3 + brightness * 8.8;
    const sky = g.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, hsl(SKY_HUE, SKY_SAT * 90, topL));
    sky.addColorStop(0.62, hsl(SKY_HUE - 2, SKY_SAT * 85, midL));
    sky.addColorStop(1, hsl(SKY_HUE - 7, SKY_SAT * 100, botL));
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);
    skyLayer = layer;
  }

  function horizonBase() {
    return height * 0.635;
  }

  function ridgeAt(x) {
    const index = (x / Math.max(1, width)) * 45;
    const amp = height / 720;
    return horizonBase()
      + (Math.sin(index * 0.71 + 1.2) * 9
        + Math.sin(index * 0.19 + 4.1) * 21
        + Math.sin(index * 1.73) * 3) * amp;
  }

  function milkyPoint(t) {
    const x0 = width * 0.56;
    const y0 = height * 0.7;
    const x1 = width * 0.98;
    const y1 = height * 0.02;
    return [
      x0 + (x1 - x0) * t + Math.sin(t * 4.6) * width * 0.02,
      y0 + (y1 - y0) * t,
    ];
  }

  function buildMilkyWay() {
    const scale = 3;
    const w = Math.ceil(width / scale);
    const h = Math.ceil(height / scale);
    const layer = document.createElement('canvas');
    layer.width = w;
    layer.height = h;
    const g = layer.getContext('2d');
    const image = g.createImageData(w, h);
    const data = image.data;
    const x0 = 0.56 * w;
    const y0 = 0.7 * h;
    const x1 = 0.98 * w;
    const y1 = 0.02 * h;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    const sigma = w * 0.09;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let t = ((x - x0) * dx + (y - y0) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const dist = Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t));
        const fall = Math.exp(-(dist * dist) / (2 * sigma * sigma));
        const along = 0.45 + 0.55 * Math.sin(t * Math.PI);
        const alpha = fall * along;
        if (alpha < 0.04) continue;
        const i = (y * w + x) * 4;
        const warm = dist < sigma * 0.35 ? 18 : 0;
        data[i] = 170 + warm;
        data[i + 1] = 184 + warm * 0.4;
        data[i + 2] = 214 - warm;
        data[i + 3] = Math.round(alpha * 36);
      }
    }
    g.putImageData(image, 0, 0);
    milkyLayer = layer;
  }

  function starColor(warmth) {
    return [
      Math.round(206 + warmth * 42),
      Math.round(216 + warmth * 10),
      Math.round(255 - Math.max(0, warmth) * 58),
    ];
  }

  function pushStar(x, y, mag, warmth) {
    if (y < 2 || y > ridgeAt(x) - 2) return;
    const [r, g, b] = starColor(warmth);
    stars.push({
      x,
      y,
      mag,
      r,
      g,
      b,
      seed: Math.random() * 1000,
      alpha: mag < 1 ? 0.95 : mag < 2.2 ? 0.72 : mag < 3.6 ? 0.46 : 0.28,
    });
  }

  function buildStars() {
    stars = [];
    const count = Math.floor((width * height) / 380);
    for (let i = 0; i < count; i += 1) {
      const x = Math.random() * width;
      const roll = Math.random();
      const mag = roll < 0.84 ? 3.4 + Math.random() * 2.2 : roll < 0.97 ? 1.8 + Math.random() * 1.4 : Math.random() * 1.5;
      const warmth = (Math.random() ** 2) * (Math.random() < 0.2 ? -1 : 0.7);
      pushStar(x, Math.random() * ridgeAt(x), mag, warmth);
    }
    const band = Math.floor(width * 1.6);
    for (let i = 0; i < band; i += 1) {
      const t = Math.random();
      const [cx, cy] = milkyPoint(t);
      const spread = width * (0.012 + Math.random() ** 2 * 0.11);
      const x = cx + (Math.random() - 0.5) * spread * 2;
      const y = cy + (Math.random() - 0.5) * spread * 1.5;
      const mag = Math.random() < 0.08 ? 1.2 + Math.random() : 3.2 + Math.random() * 2;
      pushStar(x, y, mag, Math.random() * 0.35);
    }
  }

  function buildNoise() {
    const size = 128;
    const layer = document.createElement('canvas');
    layer.width = size;
    layer.height = size;
    const g = layer.getContext('2d');
    const image = g.createImageData(size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = 70 + Math.random() * 185;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
    g.putImageData(image, 0, 0);
    noiseLayer = layer;
  }

  function hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function temporalNoise(t, seed) {
    const i = Math.floor(t);
    const f = t - i;
    const u = f * f * (3 - 2 * f);
    return hash(i + seed) * (1 - u) + hash(i + 1 + seed) * u;
  }

  function scintillation(star, now) {
    if (REDUCED_MOTION) return 1;
    const horizon = Math.max(0, 1 - (ridgeAt(star.x) - star.y) / (height * 0.22));
    const boost = 1 + horizon * 1.35;
    const slow = temporalNoise(now * 0.00032, star.seed);
    const fast = temporalNoise(now * 0.0024, star.seed + 17);
    const glint = star.mag < 2.2 ? temporalNoise(now * 0.0014, star.seed + 41) ** 9 : 0;
    const twinkle = 0.76 * boost;
    const level = 0.62 + 0.38 * slow + (fast - 0.5) * 0.42 * twinkle + glint * 0.85;
    return Math.min(1.65, Math.max(0.18, level));
  }

  function drawStars(now) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const star of stars) {
      const level = scintillation(star, now);
      const alpha = Math.min(1, star.alpha * level);
      if (alpha < 0.04) continue;
      const chroma = REDUCED_MOTION ? 0 : (temporalNoise(now * 0.003, star.seed + 9) - 0.5) * 14;
      const r = Math.max(0, Math.min(255, star.r + chroma));
      const b = Math.max(0, Math.min(255, star.b - chroma));
      ctx.fillStyle = `rgba(${r}, ${star.g}, ${b}, ${alpha})`;
      if (star.mag < 0.9) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${r}, ${star.g}, ${b}, ${alpha * 0.28})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (star.mag < 2.1) {
        ctx.fillRect(star.x, star.y, 2, 2);
      } else {
        ctx.fillRect(star.x, star.y, 1, 1);
      }
    }
    ctx.restore();
  }

  function drawHorizon() {
    const hazeTop = horizonBase() - 130 * (height / 720);
    const haze = ctx.createLinearGradient(0, hazeTop, 0, horizonBase() + 25);
    haze.addColorStop(0, 'rgba(44, 95, 60, 0)');
    haze.addColorStop(0.62, 'rgba(50, 101, 61, 0.07)');
    haze.addColorStop(1, 'rgba(5, 11, 8, 0.38)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, hazeTop, width, horizonBase() + 25 - hazeTop);

    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, ridgeAt(0));
    const step = Math.max(2, width / 90);
    for (let x = 0; x <= width; x += step) ctx.lineTo(x, ridgeAt(x));
    ctx.lineTo(width, height);
    ctx.closePath();
    const ground = ctx.createLinearGradient(0, horizonBase(), 0, height);
    ground.addColorStop(0, 'rgba(2, 8, 5, 0.96)');
    ground.addColorStop(1, '#010302');
    ctx.fillStyle = ground;
    ctx.fill();
  }

  function drawSensorNoise() {
    if (!noiseLayer) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.012 + SENSOR_NOISE * 0.052;
    const ox = Math.random() * noiseLayer.width;
    const oy = Math.random() * noiseLayer.height;
    const pattern = ctx.createPattern(noiseLayer, 'repeat');
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(ox, oy, width + ox, height + oy);
    ctx.restore();
  }

  function pickAngle() {
    const spread = (118 * Math.PI) / 180;
    let angle = (11 * Math.PI) / 180 + (Math.random() - 0.5) * spread;
    if (Math.random() < Math.min(0.42, 118 / 360)) angle += Math.PI;
    return angle;
  }

  function pointAt(meteor, t) {
    const bend = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * meteor.curve * meteor.length;
    const along = meteor.length * t;
    return [
      meteor.x + Math.cos(meteor.angle) * along + Math.cos(meteor.angle + Math.PI / 2) * bend,
      meteor.y + Math.sin(meteor.angle) * along + Math.sin(meteor.angle + Math.PI / 2) * bend,
    ];
  }

  function createMeteor(fireball, featured = false) {
    if (featured) {
      return {
        fireball: true,
        x: width * 0.12,
        y: height * 0.16,
        angle: (14 * Math.PI) / 180,
        length: width * 0.48,
        duration: 0.85,
        curve: 0.035,
        age: 0,
        flare: true,
        flared: false,
        afterglow: 0.6,
      };
    }
    const energy = Math.random() ** 1.7;
    const angle = pickAngle();
    let meteor = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const length = fireball ? 260 + Math.random() * 380 : 42 + energy * 130;
      const speed = fireball ? 620 + Math.random() * 380 : 780 + Math.random() * 640;
      const duration = fireball
        ? Math.min(1.15, Math.max(0.48, length / speed))
        : Math.min(0.36, Math.max(0.085, length / speed));
      const x = fireball
        ? -width * 0.08 + Math.random() * width * 1.16
        : width * (0.06 + Math.random() * 0.88);
      const y = fireball
        ? height * (0.02 + Math.random() * 0.42)
        : height * (0.04 + Math.random() * 0.4);
      meteor = {
        fireball,
        x,
        y,
        angle,
        length,
        duration,
        curve: (Math.random() - 0.5) * (fireball ? 0.16 : 0.05),
        age: 0,
        flare: fireball && Math.random() < 0.68,
        flared: false,
        afterglow: fireball ? 0.55 : 0.05,
      };
      const [mx, my] = pointAt(meteor, 0.45);
      if (my < ridgeAt(mx) - 16 && my > height * 0.02) break;
    }
    return meteor;
  }

  function strokeSegment(meteor, from, to, color, width0, width1) {
    const steps = meteor.fireball ? 10 : 5;
    ctx.lineCap = 'butt';
    for (let i = 0; i < steps; i += 1) {
      const t0 = from + ((to - from) * i) / steps;
      const t1 = from + ((to - from) * (i + 1)) / steps;
      const [x0, y0] = pointAt(meteor, t0);
      const [x1, y1] = pointAt(meteor, t1);
      const k = (i + 1) / steps;
      ctx.strokeStyle = color(k);
      ctx.lineWidth = width0 + (width1 - width0) * k;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }

  function drawOrdinary(meteor, progress, alpha) {
    const head = Math.min(1, progress);
    const tail = Math.max(0, head - 0.42);
    strokeSegment(
      meteor,
      tail,
      head,
      (k) => `rgba(176, 208, 255, ${alpha * (0.08 + k * 0.86)})`,
      0.35,
      2.1,
    );
    const [hx, hy] = pointAt(meteor, head);
    ctx.fillStyle = `rgba(244, 249, 255, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 2.4, 1.05, meteor.angle, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFireball(meteor, progress) {
    const flight = Math.min(1, progress);
    const fadeIn = Math.min(1, meteor.age / 0.12);
    const after = progress > 1 ? 1 - (meteor.age - meteor.duration) / meteor.afterglow : 1;
    const alpha = Math.max(0, fadeIn * after);
    if (alpha <= 0) return;
    const head = flight;
    const tail = progress > 1 ? 0.08 : Math.max(0, head - 0.7);
    strokeSegment(
      meteor,
      tail,
      Math.max(tail, head - 0.16),
      (k) => `rgba(64, 176, 112, ${alpha * (0.05 + k * 0.55)})`,
      1.1,
      2.6,
    );
    strokeSegment(
      meteor,
      Math.max(tail, head - 0.18),
      head,
      (k) => `rgba(255, 252, 244, ${alpha * (0.25 + k * 0.75)})`,
      1.4,
      3.4,
    );
    const [hx, hy] = pointAt(meteor, head);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 1; i <= 4; i += 1) {
      const [wx, wy] = pointAt(meteor, Math.max(0, head - i * 0.035));
      ctx.fillStyle = i % 2 === 0
        ? `rgba(186, 230, 206, ${alpha * 0.16})`
        : `rgba(232, 240, 255, ${alpha * 0.14})`;
      ctx.beginPath();
      ctx.ellipse(wx, wy, 10 + i * 4, 3.2, meteor.angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 16);
    glow.addColorStop(0, `rgba(255, 255, 250, ${alpha * 0.9})`);
    glow.addColorStop(1, 'rgba(255, 255, 250, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(hx, hy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 4.2, 1.7, meteor.angle, 0, Math.PI * 2);
    ctx.fill();

    if (meteor.flare && flight > 0.52 && flight < 0.72) {
      const flareAge = (flight - 0.52) / 0.2;
      const radius = 18 + flareAge * 54;
      const flare = ctx.createRadialGradient(hx, hy, 0, hx, hy, radius);
      flare.addColorStop(0, `rgba(255, 255, 245, ${alpha * (1 - flareAge) * 0.85})`);
      flare.addColorStop(0.35, `rgba(190, 230, 210, ${alpha * (1 - flareAge) * 0.28})`);
      flare.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = flare;
      ctx.beginPath();
      ctx.arc(hx, hy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMeteors(dt) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = meteors.length - 1; i >= 0; i -= 1) {
      const meteor = meteors[i];
      meteor.age += dt;
      const life = meteor.duration + meteor.afterglow;
      if (meteor.age >= life) {
        meteors.splice(i, 1);
        continue;
      }
      const progress = meteor.age / meteor.duration;
      if (meteor.fireball) drawFireball(meteor, progress);
      else drawOrdinary(meteor, progress, progress > 1 ? 1 - (meteor.age - meteor.duration) / meteor.afterglow : 1);
    }
    ctx.restore();
  }

  function poissonDelay() {
    const perSecond = METEOR_RATE / 60;
    return (-Math.log(1 - Math.random()) / perSecond) * 1000;
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(skyLayer, 0, 0, width, height);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.82;
    ctx.drawImage(milkyLayer, 0, 0, width, height);
    ctx.restore();
    drawStars(now);
    if (!opened && now - startedAt > 650) {
      meteors.push(createMeteor(true, true));
      opened = true;
    }
    if (now >= nextMeteor) {
      meteors.push(createMeteor(!REDUCED_MOTION && Math.random() < 0.26));
      nextMeteor = now + (REDUCED_MOTION ? 9000 : poissonDelay());
    }
    drawMeteors(dt);
    ctx.globalCompositeOperation = 'source-over';
    drawHorizon();
    drawSensorNoise();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    resize();
    running = true;
    last = 0;
    opened = false;
    startedAt = performance.now();
    meteors = [];
    const now = performance.now();
    nextMeteor = now + 1400;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    meteors = [];
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
