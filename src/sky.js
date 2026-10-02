/**
 * 场景 2：固定镜头的夜空。
 * 画法对齐 AstroShot 仓库（暗色天空、星等闪烁、尖头流星光带、山脊压住轨迹），
 * 镜头锁在地平线附近，银河用程序生成在右侧，不使用全景照片。
 */
import { createNightLoop, hushNightLoop, playNightLoop } from './sky/night-audio.js';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SKY_HUE = 218;
const SKY_SAT = 0.4;
const SKY_BRIGHTNESS = 0.67;
const METEOR_RATE = 7;
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
  let openingAt = 0;
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
    scatterStars(Math.round(10 * scale), -1.1, 1.2, false);
    scatterStars(Math.round(28 * scale), 1.4, 3.0, false);
    scatterStars(Math.round(110 * scale), 3.1, 4.8, false);
    scatterStars(Math.round(340 * scale), 4.9, 6.7, false);
    scatterStars(Math.round(260 * scale), 5.6, 7.3, true);
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

  function seeded(index) {
    const value = Math.sin(index * 91.171 + 17.371) * 43758.5453;
    return value - Math.floor(value);
  }

  function temporalNoise(time, seed) {
    const integer = Math.floor(time);
    const fraction = time - integer;
    const eased = fraction * fraction * (3 - 2 * fraction);
    const first = seeded(integer * 1.917 + seed * 13.71);
    const second = seeded((integer + 1) * 1.917 + seed * 13.71);
    return (first + (second - first) * eased) * 2 - 1;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function smoothstep(edge0, edge1, value) {
    const range = edge1 - edge0;
    const t = clamp(range === 0 ? Number(value >= edge1) : (value - edge0) / range, 0, 1);
    return t * t * (3 - 2 * t);
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

  function drawPointedCapsule(tail, head, halfWidth, fill) {
    const deltaX = head.x - tail.x;
    const deltaY = head.y - tail.y;
    const length = Math.hypot(deltaX, deltaY) || 1;
    const directionX = deltaX / length;
    const directionY = deltaY / length;
    const normalX = -deltaY / length;
    const normalY = deltaX / length;
    const shoulderX = head.x - directionX * halfWidth * 0.58;
    const shoulderY = head.y - directionY * halfWidth * 0.58;
    const tipX = head.x + directionX * halfWidth * 0.22;
    const tipY = head.y + directionY * halfWidth * 0.22;
    const middleX = tail.x + deltaX * 0.5;
    const middleY = tail.y + deltaY * 0.5;
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.quadraticCurveTo(
      middleX + normalX * halfWidth * 0.76,
      middleY + normalY * halfWidth * 0.76,
      shoulderX + normalX * halfWidth,
      shoulderY + normalY * halfWidth,
    );
    ctx.quadraticCurveTo(
      tipX + normalX * halfWidth * 0.62,
      tipY + normalY * halfWidth * 0.62,
      tipX,
      tipY,
    );
    ctx.quadraticCurveTo(
      tipX - normalX * halfWidth * 0.62,
      tipY - normalY * halfWidth * 0.62,
      shoulderX - normalX * halfWidth,
      shoulderY - normalY * halfWidth,
    );
    ctx.quadraticCurveTo(
      middleX - normalX * halfWidth * 0.76,
      middleY - normalY * halfWidth * 0.76,
      tail.x,
      tail.y,
    );
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawCapsuleHead(head, directionX, directionY, length, halfWidth, fill) {
    const capsuleLength = Math.max(length, halfWidth * 2);
    const rearCenter = -capsuleLength + halfWidth;
    const frontCenter = -halfWidth;
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(Math.atan2(directionY, directionX));
    ctx.beginPath();
    ctx.moveTo(rearCenter, -halfWidth);
    ctx.lineTo(frontCenter, -halfWidth);
    ctx.arc(frontCenter, 0, halfWidth, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(rearCenter, halfWidth);
    ctx.arc(rearCenter, 0, halfWidth, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  function drawDirectionalWake(head, directionX, directionY, halfWidth, flare, age, seed) {
    const wakeStrength = clamp((flare - 0.18) / 1.8, 0, 1);
    if (wakeStrength <= 0) return;
    const normalX = -directionY;
    const normalY = directionX;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let index = 0; index < 4; index += 1) {
      const sideNoise = temporalNoise(age * 2.2 + index * 2.7, seed + 1200 + index * 17);
      const along = 2.5 + index * 3.2 + Math.abs(sideNoise) * 2.2;
      const side = sideNoise * halfWidth * (0.8 + index * 0.42);
      const centerX = head.x - directionX * along + normalX * side;
      const centerY = head.y - directionY * along + normalY * side;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(Math.atan2(directionY, directionX));
      ctx.globalAlpha = wakeStrength * (0.078 - index * 0.009) * (0.72 + Math.abs(sideNoise) * 0.28);
      ctx.fillStyle = index < 2 ? 'rgba(224, 220, 204, 0.82)' : 'rgba(106, 173, 111, 0.58)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.2 + index * 2.25 + wakeStrength * (2.8 + index * 0.7), halfWidth * (0.75 + index * 0.26) + 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.lineCap = 'round';
    for (let index = 0; index < 5; index += 1) {
      const sparkNoise = temporalNoise(age * 3.8 + index * 1.7, seed + 1400 + index * 29);
      const along = 1.8 + index * 2.15 + Math.abs(sparkNoise) * 2.4;
      const side = sparkNoise * halfWidth * (1.15 + index * 0.34);
      const sparkX = head.x - directionX * along + normalX * side;
      const sparkY = head.y - directionY * along + normalY * side;
      const sparkLength = 0.8 + index * 0.36 + Math.abs(sparkNoise) * 1.1;
      ctx.globalAlpha = wakeStrength * (0.115 - index * 0.013);
      ctx.strokeStyle = index < 3 ? 'rgba(244, 239, 224, 0.76)' : 'rgba(157, 194, 154, 0.55)';
      ctx.lineWidth = 0.28 + (index % 2) * 0.13;
      ctx.beginPath();
      ctx.moveTo(sparkX - directionX * sparkLength, sparkY - directionY * sparkLength);
      ctx.lineTo(sparkX, sparkY);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMeteor(meteor, now) {
    const points = meteor.points;
    if (points.length < 2) return;
    const newest = points[points.length - 1];
    const age = now - meteor.born;
    const attack = smoothstep(0, meteor.attackTime, age);
    const terminalFade = 1 - smoothstep(meteor.duration * 0.78, meteor.duration, age);
    const firstFlare = Math.exp(-(((age - meteor.flareAt) / meteor.flareWidth) ** 2));
    const secondFlare = Math.exp(-(((age - meteor.secondFlareAt) / Math.max(0.045, meteor.flareWidth * 0.7)) ** 2));
    const luminosityNoise = temporalNoise(age * (meteor.kind === 'fireball' ? 34 : 23), meteor.seed + 412);
    const flare = meteor.kind === 'fireball'
      ? firstFlare * meteor.flareStrength + secondFlare * meteor.flareStrength * 0.72
      : 0;
    const liveIntensity = meteor.alive
      ? attack * terminalFade * (meteor.kind === 'fireball'
        ? 0.68 + flare + Math.max(-0.08, luminosityNoise * 0.11)
        : 0.38 + meteor.strength * 1.25 + luminosityNoise * 0.07)
      : 0;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (meteor.kind === 'fireball') {
      ctx.lineCap = 'butt';
      const velocityLength = Math.hypot(meteor.vx, meteor.vy) || 1;
      const normalX = -meteor.vy / velocityLength;
      const normalY = meteor.vx / velocityLength;
      const displaced = (point) => {
        const pointAge = Math.max(0, now - point.born);
        const maturity = smoothstep(0.55, Math.max(0.72, meteor.trailLife), pointAge);
        const drift = 0.5 * maturity * temporalNoise(point.born * 3.4 + pointAge * 0.64, meteor.seed + 817);
        return { x: point.x + normalX * drift, y: point.y + normalY * drift, born: point.born, energy: point.energy };
      };
      for (let index = 1; index < points.length; index += 1) {
        const second = points[index];
        const firstDrawn = displaced(points[index - 1]);
        const secondDrawn = displaced(second);
        const decay = Math.exp(-(now - second.born) / Math.max(0.035, meteor.trailLife * 0.42));
        const irregularity = 0.52 + 0.48 * temporalNoise(second.born * 9.5, meteor.seed + 233);
        const alpha = clamp(decay * second.energy * (0.14 + irregularity * 0.34), 0, 0.62);
        if (alpha < 0.012) continue;
        ctx.globalAlpha = alpha * 0.075;
        ctx.strokeStyle = 'rgba(72, 238, 78, 0.72)';
        ctx.lineWidth = 0.9 + second.energy * 0.72;
        ctx.beginPath();
        ctx.moveTo(firstDrawn.x, firstDrawn.y);
        ctx.lineTo(secondDrawn.x, secondDrawn.y);
        ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = second.energy > 1.2 ? 'rgba(199, 255, 128, 0.86)' : 'rgba(76, 239, 77, 0.78)';
        ctx.lineWidth = 0.26 + Math.min(0.72, second.energy * 0.27);
        ctx.beginPath();
        ctx.moveTo(firstDrawn.x, firstDrawn.y);
        ctx.lineTo(secondDrawn.x, secondDrawn.y);
        ctx.stroke();
      }
    }

    if (liveIntensity > 0.015) {
      const bodyCutoff = now - meteor.bodyTime;
      let bodyStart = 0;
      while (bodyStart < points.length - 2 && points[bodyStart].born < bodyCutoff) bodyStart += 1;
      const tail = points[bodyStart];
      const baseWidth = meteor.kind === 'fireball'
        ? (0.42 + meteor.strength * 0.58) * (0.12 + attack * 0.88) * (1 + Math.min(1.4, flare) * 0.2)
        : 0.34 + meteor.strength * 0.42;
      if (meteor.kind === 'fireball') {
        const velocityLength = Math.hypot(meteor.vx, meteor.vy) || 1;
        const directionX = meteor.vx / velocityLength;
        const directionY = meteor.vy / velocityLength;
        const trailHalfWidth = baseWidth * 0.72;
        const bodyGradient = ctx.createLinearGradient(tail.x, tail.y, newest.x, newest.y);
        bodyGradient.addColorStop(0, 'rgba(34, 204, 47, 0)');
        bodyGradient.addColorStop(0.3, 'rgba(51, 232, 59, 0.24)');
        bodyGradient.addColorStop(0.68, 'rgba(78, 255, 75, 0.86)');
        bodyGradient.addColorStop(0.86, 'rgba(188, 255, 153, 0.34)');
        bodyGradient.addColorStop(1, 'rgba(239, 246, 229, 0.06)');
        ctx.globalAlpha = clamp(liveIntensity, 0, 1) * 0.075;
        drawPointedCapsule(tail, newest, trailHalfWidth * 1.9, bodyGradient);
        ctx.globalAlpha = clamp(liveIntensity * 0.9, 0, 1);
        drawPointedCapsule(tail, newest, trailHalfWidth, bodyGradient);
        const hotCutoff = now - (0.038 + Math.min(0.046, Math.max(0, flare) * 0.012));
        let hotStart = points.length - 2;
        while (hotStart > 0 && points[hotStart].born > hotCutoff) hotStart -= 1;
        const hotTail = points[hotStart];
        const hotGradient = ctx.createLinearGradient(hotTail.x, hotTail.y, newest.x, newest.y);
        hotGradient.addColorStop(0, 'rgba(142, 255, 115, 0)');
        hotGradient.addColorStop(0.36, 'rgba(199, 245, 183, 0.32)');
        hotGradient.addColorStop(0.72, 'rgba(242, 239, 222, 0.82)');
        hotGradient.addColorStop(1, 'rgba(255, 255, 250, 0.94)');
        ctx.globalAlpha = clamp(liveIntensity * 0.82, 0, 1);
        drawPointedCapsule(hotTail, newest, 0.3 + baseWidth * 0.22, hotGradient);
        const headLength = clamp(10 + velocityLength / 76 + Math.min(6, Math.max(0, flare) * 1.35), 12, 28);
        const headHalfWidth = clamp(0.58 + baseWidth * 0.62 + Math.min(0.7, Math.max(0, flare) * 0.1), 1.05, 3.5);
        const headRearX = newest.x - directionX * headLength;
        const headRearY = newest.y - directionY * headLength;
        const headFrontX = newest.x + directionX * headHalfWidth;
        const headFrontY = newest.y + directionY * headHalfWidth;
        drawDirectionalWake(newest, directionX, directionY, headHalfWidth, flare, age, meteor.seed);
        const headGradient = ctx.createLinearGradient(headRearX, headRearY, headFrontX, headFrontY);
        headGradient.addColorStop(0, 'rgba(102, 246, 91, 0)');
        headGradient.addColorStop(0.24, 'rgba(167, 255, 139, 0.55)');
        headGradient.addColorStop(0.52, 'rgba(239, 243, 222, 0.92)');
        headGradient.addColorStop(0.84, 'rgba(255, 254, 246, 1)');
        headGradient.addColorStop(1, 'rgba(255, 255, 255, 0.76)');
        ctx.globalAlpha = clamp(liveIntensity * 0.94, 0, 1);
        drawCapsuleHead(newest, directionX, directionY, headLength, headHalfWidth, headGradient);
      } else {
        const gradient = ctx.createLinearGradient(tail.x, tail.y, newest.x, newest.y);
        gradient.addColorStop(0, 'rgba(193, 219, 255, 0)');
        gradient.addColorStop(0.7, 'rgba(225, 238, 255, 0.74)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 1)');
        ctx.globalAlpha = clamp(liveIntensity, 0, 1.2) * 0.13;
        drawPointedCapsule(tail, newest, baseWidth * 2, gradient);
        ctx.globalAlpha = clamp(liveIntensity, 0, 1);
        drawPointedCapsule(tail, newest, baseWidth, gradient);
        const bloomRadius = 0.72 + meteor.strength * 1.2;
        const bloom = ctx.createRadialGradient(newest.x, newest.y, 0, newest.x, newest.y, bloomRadius);
        bloom.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
        bloom.addColorStop(0.2, 'rgba(211, 229, 255, 0.3)');
        bloom.addColorStop(1, 'rgba(160, 205, 255, 0)');
        ctx.globalAlpha = clamp(liveIntensity * 0.72, 0, 1);
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(newest.x, newest.y, bloomRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function createMeteor(kind, now, options = {}) {
    const variant = options.variant ?? null;
    let angleDegrees = options.angleDegrees ?? (11 + (Math.random() - 0.5) * 118);
    if (options.angleDegrees === undefined && Math.random() < Math.min(0.42, 118 / 360)) angleDegrees += 180;
    const angle = (angleDegrees * Math.PI) / 180;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const ordinaryEnergy = kind === 'ordinary' ? Math.random() ** 1.7 : 0;
    const fireballBase = 0.56 + 0.72 * 0.86 + Math.random() * 0.38;
    const hasBurst = kind === 'fireball' && (variant !== null || Math.random() < 0.68);
    const isExtreme = hasBurst && Math.random() < (variant === 'strong' ? 0.42 : 0.06 + 0.72 * 0.16);
    const strength = kind === 'fireball'
      ? fireballBase * (variant === 'strong' ? 1.34 : variant === 'weak' ? 0.62 : 1) * (isExtreme ? 1.34 : 1)
      : 0.14 + ordinaryEnergy * 0.38;
    const speed = Math.max(width, 900) * (kind === 'fireball'
      ? (variant === 'strong' ? 0.25 + Math.random() * 0.09 : 0.36 + Math.random() * 0.18)
      : 0.42 + Math.random() * 0.38 + ordinaryEnergy * 0.12);
    const ordinaryTrackLength = Math.min(width, height) * (0.065 + ordinaryEnergy * 0.18 + Math.random() * (0.022 + ordinaryEnergy * 0.035));
    let x;
    let y;
    if (options.originX !== undefined) {
      x = width * options.originX;
      y = height * options.originY;
    } else if (kind === 'ordinary') {
      const travelX = directionX * ordinaryTrackLength;
      const travelY = directionY * ordinaryTrackLength;
      const minimumX = width * 0.055 - Math.min(0, travelX);
      const maximumX = width * 0.945 - Math.max(0, travelX);
      x = minimumX + Math.random() * Math.max(1, maximumX - minimumX);
      const limit = ridgeAt(x) - 30;
      const minimumY = height * 0.04 - Math.min(0, travelY);
      const maximumY = Math.min(limit, height * 0.72 - Math.max(0, travelY));
      y = minimumY + Math.random() * Math.max(1, maximumY - minimumY);
    } else if (Math.abs(directionX) >= Math.abs(directionY)) {
      x = directionX >= 0 ? -width * 0.08 : width * 1.08;
      y = height * (0.05 + Math.random() * 0.5);
    } else {
      x = width * (0.08 + Math.random() * 0.84);
      y = directionY >= 0 ? -height * 0.08 : ridgeAt(x) * 0.9;
    }
    const duration = kind === 'fireball'
      ? (variant === 'strong' ? 0.98 + Math.random() * 0.18 : 0.76 + Math.random() * 0.24)
      : clamp(ordinaryTrackLength / Math.max(1, speed), 0.085, 0.36);
    const flareAt = hasBurst ? duration * clamp(0.52 + (Math.random() - 0.5) * 0.12, 0.16, 0.84) : -10;
    const flareWidth = variant === 'strong' ? 0.14 + Math.random() * 0.055 : 0.09 + Math.random() * 0.04;
    const trailLife = kind === 'fireball'
      ? 0.55 * (variant === 'strong' ? 2.85 + Math.random() * 0.35 : 1.18 + Math.random() * 0.28)
      : 0.045 + ordinaryEnergy * 0.045 + 0.55 * 0.08;
    const ordinaryTailLength = Math.min(width, height) * (0.012 + ordinaryEnergy * 0.045 + Math.random() * (0.006 + ordinaryEnergy * 0.012));
    const bodyTime = kind === 'fireball'
      ? (variant === 'strong' ? 0.62 + Math.random() * 0.15 : 0.36 + Math.random() * 0.16)
      : Math.min(duration * 0.64, ordinaryTailLength / Math.max(1, speed));
    return {
      kind,
      strength,
      x,
      y,
      vx: directionX * speed,
      vy: directionY * speed,
      curve: (Math.random() - 0.5) * (kind === 'fireball' ? 0.35 : 0.12),
      born: now,
      duration,
      trailLife,
      bodyTime,
      attackTime: kind === 'fireball' ? 0.12 * (variant === 'strong' ? 2.4 : 1.3) : 0.012 + ordinaryEnergy * 0.008,
      alive: true,
      lastSample: now,
      flareAt,
      secondFlareAt: isExtreme ? Math.min(duration * 0.9, flareAt + duration * 0.22) : -10,
      flareWidth,
      flareStrength: kind === 'fireball' ? (variant === 'strong' ? 1.05 : 0.72) + strength * 0.62 : 0,
      seed: Math.random() * 1000,
      points: [{ x, y, born: now, energy: 0.22 }],
    };
  }

  function updateMeteors(dt, now) {
    if (!opened && now >= openingAt) {
      meteors.push(createMeteor('fireball', now, {
        angleDegrees: 25 + Math.random() * 14,
        originX: 0.3 + Math.random() * 0.12,
        originY: 0.2 + Math.random() * 0.12,
        variant: Math.random() < 0.28 ? 'strong' : null,
      }));
      opened = true;
      nextMeteor = Math.max(nextMeteor, now + 1.4);
    }
    if (now >= nextMeteor) {
      meteors.push(createMeteor(!REDUCED_MOTION && Math.random() < 0.26 ? 'fireball' : 'ordinary', now));
      const mean = REDUCED_MOTION ? 9 : 60 / METEOR_RATE;
      nextMeteor = now + Math.max(0.12, -Math.log(Math.max(0.001, Math.random())) * mean);
    }
    for (let index = meteors.length - 1; index >= 0; index -= 1) {
      const meteor = meteors[index];
      if (meteor.alive) {
        const age = now - meteor.born;
        const turn = meteor.curve * dt;
        const cosine = Math.cos(turn);
        const sine = Math.sin(turn);
        const vx = meteor.vx * cosine - meteor.vy * sine;
        const vy = meteor.vx * sine + meteor.vy * cosine;
        meteor.vx = vx;
        meteor.vy = vy;
        meteor.x += vx * dt;
        meteor.y += vy * dt;
        if (now - meteor.lastSample > 0.0075) {
          const firstFlare = Math.exp(-(((age - meteor.flareAt) / meteor.flareWidth) ** 2));
          const secondFlare = Math.exp(-(((age - meteor.secondFlareAt) / Math.max(0.045, meteor.flareWidth * 0.7)) ** 2));
          const grain = 0.18 + 0.2 * (0.5 + 0.5 * temporalNoise(age * 8.5, meteor.seed + 491));
          meteor.points.push({
            x: meteor.x,
            y: meteor.y,
            born: now,
            energy: grain + firstFlare * meteor.flareStrength + secondFlare * meteor.flareStrength * 0.72,
          });
          meteor.lastSample = now;
        }
        if (age > meteor.duration) meteor.alive = false;
      }
      while (meteor.points.length > 2 && now - meteor.points[0].born > meteor.trailLife) meteor.points.shift();
      if (!meteor.alive && meteor.points.length <= 2) {
        meteors.splice(index, 1);
        continue;
      }
      drawMeteor(meteor, now);
    }
  }

  function frame(nowMs) {
    if (!running) return;
    const now = nowMs / 1000;
    const dt = Math.min(0.05, last ? now - last : 0.016);
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
    drawStars(nowMs);
    updateMeteors(dt, now);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
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
    meteors = [];
    const now = performance.now() / 1000;
    openingAt = now + 0.38 + Math.random() * 0.34;
    nextMeteor = now + 2.2;
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
let nightAudio = null;
let nightUnlocked = false;

export function setSkyActive(active) {
  const canvas = document.getElementById('sky');
  if (!canvas) return;
  if (active) {
    canvas.hidden = false;
    if (!activeSky) activeSky = createSky(canvas);
    activeSky.start();
    if (nightUnlocked) playNightLoop(nightAudio);
    return;
  }
  if (activeSky) activeSky.stop();
  canvas.hidden = true;
  hushNightLoop(nightAudio);
}

export async function unlockSky() {
  if (nightUnlocked) return;
  nightUnlocked = true;
  if (!nightAudio) nightAudio = createNightLoop();
  const canvas = document.getElementById('sky');
  if (canvas && !canvas.hidden) await playNightLoop(nightAudio);
}
