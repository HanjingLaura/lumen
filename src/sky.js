/**
 * 场景 2：固定镜头的夜空。
 * 画法对齐 AstroShot（暗色天空、闪烁、传感器噪点、两类流星、山脊压住轨迹），
 * 镜头锁在地平线附近，银河用程序生成在右侧，不使用全景照片。
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SKY_HUE = 218;
const SKY_SAT = 0.4;
const SKY_BRIGHTNESS = 0.67;
const METEOR_RATE = 18;
const VISIBLE_MAGNITUDE = 7.43;
const EXPOSURE_GAIN = 2.33;
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
    return height * 0.81;
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
    const x0 = width * 0.58;
    const y0 = height * 0.66;
    const x1 = width * 0.96;
    const y1 = height * 0.03;
    return [
      x0 + (x1 - x0) * t + Math.sin(t * 3.1) * width * 0.02,
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
    const x0 = 0.58 * w;
    const y0 = 0.66 * h;
    const x1 = 0.96 * w;
    const y1 = 0.03 * h;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    const sigma = w * 0.16;
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
        data[i] = 176;
        data[i + 1] = 188;
        data[i + 2] = 214;
        data[i + 3] = Math.round(alpha * 58);
      }
    }
    g.putImageData(image, 0, 0);
    milkyLayer = layer;
  }

  function colorFromBv(bv) {
    const value = Math.max(-0.4, Math.min(2, bv));
    let red;
    let green;
    let blue;
    if (value < 0) red = 0.61 + 0.11 * value + 0.1 * value * value;
    else if (value < 0.4) red = 0.83 + 0.17 * (value / 0.4);
    else red = 1;
    if (value < 0) green = 0.7 + 0.07 * value + 0.1 * value * value;
    else if (value < 0.4) green = 0.87 + 0.11 * (value / 0.4);
    else if (value < 1.6) green = 0.98 - 0.16 * ((value - 0.4) / 1.2);
    else green = 0.82 - 0.5 * (value - 1.6);
    if (value < 0.4) blue = 1;
    else if (value < 1.5) blue = 1 - 0.47 * ((value - 0.4) / 1.1);
    else blue = 0.63 - 0.6 * (value - 1.5);
    return [
      Math.round(Math.max(0, Math.min(1, red)) * 255),
      Math.round(Math.max(0, Math.min(1, green)) * 255),
      Math.round(Math.max(0, Math.min(1, blue)) * 255),
    ];
  }

  function pushStar(x, y, magnitude, bv) {
    if (y < 2 || y > ridgeAt(x) - 3) return;
    const [r, g, b] = colorFromBv(bv);
    stars.push({
      x,
      y,
      magnitude,
      r,
      g,
      b,
      phase: Math.random() * Math.PI * 2,
      frequency: 0.55 + Math.random() * 2.4,
      defocus: Math.random(),
      seed: stars.length + 1,
    });
  }

  function scatterStars(count, minMag, maxMag, inBand) {
    for (let i = 0; i < count; i += 1) {
      let x;
      let y;
      if (inBand) {
        const t = Math.random();
        const [cx, cy] = milkyPoint(t);
        const spread = width * (0.045 + Math.random() ** 1.4 * 0.2);
        x = cx + (Math.random() - 0.5) * spread * 2;
        y = cy + (Math.random() - 0.5) * spread * 1.15;
      } else {
        x = Math.random() * width;
        y = Math.random() * ridgeAt(x);
      }
      const magnitude = minMag + Math.random() * (maxMag - minMag);
      const bv = Math.random() < 0.12 ? -0.25 + Math.random() * 0.3 : 0.05 + Math.random() * 1.2;
      pushStar(x, y, magnitude, bv);
    }
  }

  function buildStars() {
    stars = [];
    const scale = (width * height) / (1440 * 820);
    scatterStars(Math.round(16 * scale), -1.1, 1.3, false);
    scatterStars(Math.round(70 * scale), 1.4, 3.1, false);
    scatterStars(Math.round(520 * scale), 3.2, 5.1, false);
    scatterStars(Math.round(1900 * scale), 5.1, 7.35, false);
    scatterStars(Math.round(2400 * scale), 5.5, 7.45, true);
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

  function drawStars(now) {
    const seconds = now / 1000;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const star of stars) {
      const visibility = Math.max(0, Math.min(1, (VISIBLE_MAGNITUDE - star.magnitude) / 3.15));
      const altitude = (ridgeAt(star.x) - star.y) / height;
      const horizonScintillation = 0.42 + 0.58 * (1 - Math.max(0, Math.min(1, (altitude - 0.025) / 0.65)));
      const slowNoise = temporalNoise(seconds * star.frequency * 3.1 + star.phase, star.seed + 31);
      const fastNoise = temporalNoise(seconds * (7.2 + star.frequency * 2.8) + star.phase * 4.2, star.seed + 907);
      const glintNoise = temporalNoise(seconds * (13.5 + star.frequency * 4.3) + star.phase * 8.4, star.seed + 1907);
      const glint = Math.max(0, glintNoise) ** 9;
      const twinkle = REDUCED_MOTION ? 0 : 0.76;
      const scintillationAmplitude = twinkle * horizonScintillation * (0.22 + visibility * 0.38);
      const scintillation = Math.exp(
        scintillationAmplitude * (slowNoise * 0.54 + fastNoise * 0.46 + glint * 0.82),
      );
      const focusTransmission = 1 - star.defocus * (1 - visibility) * 0.22;
      const alpha = Math.max(0.009, Math.min(0.86,
        (0.035 + visibility ** 1.08 * 0.68) * scintillation * EXPOSURE_GAIN * focusTransmission,
      ));
      const radius = Math.max(0.18, Math.min(star.magnitude < 0 ? 1.52 : 1.08,
        (0.2 + visibility ** 1.82 * 0.78 + star.defocus * (1 - visibility) * 0.14)
          * (1 + (scintillation - 1) * 0.27),
      ));
      const imageMotion = twinkle * horizonScintillation * (0.08 + (1 - visibility) * 0.16);
      const starX = star.x + temporalNoise(seconds * (8.2 + star.frequency * 1.7) + star.phase * 2.9, star.seed + 4271) * imageMotion;
      const starY = star.y + temporalNoise(seconds * (9.4 + star.frequency * 1.3) + star.phase * 3.7, star.seed + 5297) * imageMotion;
      const chromaticShift = fastNoise * twinkle * 0.035;
      const red = Math.round(Math.max(0, Math.min(255, star.r * 0.34 + 224 * 0.66 + chromaticShift * 150)));
      const green = Math.round(Math.max(0, Math.min(255, star.g * 0.3 + 230 * 0.7)));
      const blue = Math.round(Math.max(0, Math.min(255, star.b * 0.34 + 234 * 0.66 - chromaticShift * 110)));

      if (visibility < 0.56 && star.defocus > 0.76) {
        const softRadius = radius * (1.8 + star.defocus * 0.8);
        ctx.globalAlpha = alpha * 0.28;
        ctx.fillStyle = `rgb(${red},${green},${blue})`;
        ctx.beginPath();
        ctx.arc(starX, starY, softRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      if (star.magnitude < 1.15 || (star.magnitude < 2.8 && glint > 0.18)) {
        const glowRadius = radius * (3.1 + 3.2);
        const glow = ctx.createRadialGradient(starX, starY, 0, starX, starY, glowRadius);
        glow.addColorStop(0, `rgba(${red},${green},${blue},${alpha * (0.38 + glint * 0.32)})`);
        glow.addColorStop(0.2, `rgba(${red},${green},${blue},${alpha * 0.1})`);
        glow.addColorStop(1, `rgba(${red},${green},${blue},0)`);
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(starX, starY, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${red},${green},${blue})`;
      ctx.beginPath();
      ctx.arc(starX, starY, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHorizon() {
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, ridgeAt(0));
    const step = Math.max(2, width / 90);
    for (let x = 0; x <= width; x += step) ctx.lineTo(x, ridgeAt(x));
    ctx.lineTo(width, height);
    ctx.closePath();
    const ground = ctx.createLinearGradient(0, horizonBase() - 20, 0, height);
    ground.addColorStop(0, '#06070b');
    ground.addColorStop(1, '#010102');
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
        ? height * (0.02 + Math.random() * 0.55)
        : height * (0.04 + Math.random() * 0.62);
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
    ctx.globalAlpha = 0.74;
    ctx.drawImage(milkyLayer, 0, 0, width, height);
    ctx.restore();
    drawStars(now);
    if (!opened && now - startedAt > 650) {
      meteors.push(createMeteor(true, true));
      opened = true;
    }
    if (now >= nextMeteor) {
      meteors.push(createMeteor(!REDUCED_MOTION && Math.random() < 0.26));
      if (!REDUCED_MOTION && Math.random() < 0.4) meteors.push(createMeteor(false));
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
    nextMeteor = now + 500;
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
