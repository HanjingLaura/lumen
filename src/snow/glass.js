import { paintSnowNight } from './background.js';

/**
 * 场景 4 的玻璃：雪花落在玻璃上粘住，边角慢慢结霜。
 * 不用 raindrop-fx，没有水珠折射，也没有往下流的水痕。
 * 背景、霜和雪花贴图都预先画好，每帧只做几次 drawImage，手机上也轻。
 */

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sprite(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  return canvas;
}

function softDot(context, x, y, radius, alpha) {
  const glow = context.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, `rgba(255,255,255,${alpha})`);
  glow.addColorStop(0.55, `rgba(246,250,255,${alpha * 0.55})`);
  glow.addColorStop(1, 'rgba(240,246,255,0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

/** 不规则的软雪团：一串大小不一的软点，外形拉长、带碎边。 */
function makeClump(random) {
  return sprite(64, (context, size) => {
    const c = size / 2;
    const heading = random() * Math.PI;
    const stretch = 0.35 + random() * 0.5;
    const lobes = 8 + Math.floor(random() * 6);
    context.filter = 'blur(0.8px)';
    for (let index = 0; index < lobes; index += 1) {
      const along = (random() - 0.5) * size * 0.32;
      const across = (random() - 0.5) * size * 0.32 * stretch;
      const x = c + Math.cos(heading) * along - Math.sin(heading) * across;
      const y = c + Math.sin(heading) * along + Math.cos(heading) * across;
      softDot(context, x, y, size * (0.08 + random() * 0.1), 0.45 + random() * 0.4);
    }
    for (let index = 0; index < 10; index += 1) {
      const angle = random() * Math.PI * 2;
      const distance = size * (0.14 + random() * 0.26);
      softDot(context, c + Math.cos(angle) * distance, c + Math.sin(angle) * distance * stretch, size * (0.015 + random() * 0.03), 0.55);
    }
    context.filter = 'none';
  });
}

/** 六角冰晶的影子：六根长短不一的枝，有的断了，整体是软的，只是隐约看得出六角。 */
function makeCrystal(random) {
  return sprite(64, (context, size) => {
    const c = size / 2;
    const twist = random() * Math.PI;
    context.filter = 'blur(0.9px)';
    context.strokeStyle = 'rgba(255,255,255,0.75)';
    context.lineCap = 'round';
    for (let index = 0; index < 6; index += 1) {
      if (random() < 0.15) continue;
      const angle = twist + (index * Math.PI) / 3 + (random() - 0.5) * 0.12;
      const arm = size * (0.2 + random() * 0.2);
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      context.lineWidth = 1.6;
      context.beginPath();
      context.moveTo(c, c);
      context.lineTo(c + dx * arm, c + dy * arm);
      context.stroke();
      if (random() < 0.6) {
        context.lineWidth = 1.1;
        const bx = c + dx * arm * 0.6;
        const by = c + dy * arm * 0.6;
        for (const side of [-1, 1]) {
          const ba = angle + side * (Math.PI / 3);
          context.beginPath();
          context.moveTo(bx, by);
          context.lineTo(bx + Math.cos(ba) * arm * 0.28, by + Math.sin(ba) * arm * 0.28);
          context.stroke();
        }
      }
    }
    softDot(context, c, c, size * 0.16, 0.8);
    for (let index = 0; index < 4; index += 1) {
      softDot(context, c + (random() - 0.5) * size * 0.3, c + (random() - 0.5) * size * 0.3, size * 0.06, 0.45);
    }
    context.filter = 'none';
  });
}

/** 小雪粒。 */
function makeSpeck(random) {
  return sprite(24, (context, size) => {
    softDot(context, size / 2 + (random() - 0.5) * 3, size / 2 + (random() - 0.5) * 3, size * 0.32, 0.9);
    softDot(context, size / 2 + (random() - 0.5) * 6, size / 2 + (random() - 0.5) * 6, size * 0.18, 0.6);
  });
}

function edgeDistance(x, y, width, height) {
  return Math.min(x, y, width - x, height - y);
}

/** 边角的霜：角上最厚，沿边一圈薄霜，加上细碎冰粒和羽状冰纹。 */
function paintFrost(canvas, width, height, scale) {
  const context = canvas.getContext('2d');
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, width, height);
  const random = seeded(4041);
  const short = Math.min(width, height);

  const band = short * 0.09;
  const edges = [
    [0, 0, 0, band, 0, 0, width, band],
    [0, height, 0, height - band, 0, height - band, width, band],
    [0, 0, band, 0, 0, 0, band, height],
    [width, 0, width - band, 0, width - band, 0, band, height],
  ];
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
    const gradient = context.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, 'rgba(240,246,255,0.28)');
    gradient.addColorStop(0.45, 'rgba(240,246,255,0.1)');
    gradient.addColorStop(1, 'rgba(240,246,255,0)');
    context.fillStyle = gradient;
    context.fillRect(rx, ry, rw, rh);
  }

  const corner = short * 0.34;
  for (const [cx, cy] of [[0, 0], [width, 0], [0, height], [width, height]]) {
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, corner);
    gradient.addColorStop(0, 'rgba(244,248,255,0.55)');
    gradient.addColorStop(0.4, 'rgba(236,244,255,0.18)');
    gradient.addColorStop(1, 'rgba(236,244,255,0)');
    context.fillStyle = gradient;
    context.fillRect(cx - corner, cy - corner, corner * 2, corner * 2);
  }

  // 细碎冰粒，越靠边越密。
  const grains = Math.round((width + height) * 3.2);
  for (let index = 0; index < grains; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const reach = edgeDistance(x, y, width, height) / (short * 0.16);
    if (random() > Math.exp(-reach * reach * 1.6)) continue;
    context.fillStyle = `rgba(255,255,255,${0.12 + random() * 0.38})`;
    const size = 0.6 + random() * 1.6;
    context.fillRect(x, y, size, size);
  }

  // 羽状冰纹：很短很细的冰羽，主干两侧密密的小刺，贴着边和角。
  context.lineCap = 'round';
  const feather = (x, y, angle, length) => {
    const steps = Math.max(4, Math.round(length / 2.5));
    const unit = length / steps;
    let px = x;
    let py = y;
    let heading = angle;
    context.strokeStyle = `rgba(255,255,255,${0.07 + random() * 0.12})`;
    context.lineWidth = 0.6;
    context.beginPath();
    for (let step = 0; step < steps; step += 1) {
      heading += (random() - 0.5) * 0.25;
      const nx = px + Math.cos(heading) * unit;
      const ny = py + Math.sin(heading) * unit;
      context.moveTo(px, py);
      context.lineTo(nx, ny);
      const barb = unit * (0.6 + random() * 1.4) * (1 - step / steps);
      for (const side of [-1, 1]) {
        const ba = heading + side * (0.8 + random() * 0.7);
        context.moveTo(nx, ny);
        context.lineTo(nx + Math.cos(ba) * barb, ny + Math.sin(ba) * barb);
      }
      px = nx;
      py = ny;
    }
    context.stroke();
  };
  const feathers = Math.round((width + height) / 2.6);
  for (let index = 0; index < feathers; index += 1) {
    const side = Math.floor(random() * 4);
    const along = random();
    const nearCorner = Math.min(along, 1 - along) < 0.15;
    const inset = Math.pow(random(), 3) * short * (nearCorner ? 0.16 : 0.05);
    let x;
    let y;
    let angle;
    if (side === 0) { x = along * width; y = inset; angle = Math.PI / 2; }
    else if (side === 1) { x = along * width; y = height - inset; angle = -Math.PI / 2; }
    else if (side === 2) { x = inset; y = along * height; angle = 0; }
    else { x = width - inset; y = along * height; angle = Math.PI; }
    const length = short * (nearCorner ? 0.01 + random() * 0.025 : 0.006 + random() * 0.014);
    feather(x, y, angle + (random() - 0.5) * 3.4, length);
  }
}

export function mountSnowGlass(canvas) {
  const random = Math.random;
  const looks = seeded(77);
  const clumps = Array.from({ length: 8 }, () => makeClump(looks));
  const crystals = Array.from({ length: 5 }, () => makeCrystal(looks));
  const specks = Array.from({ length: 4 }, () => makeSpeck(looks));
  const plate = document.createElement('canvas');
  plate.width = 1600;
  plate.height = 900;
  paintSnowNight(plate);
  const backdrop = document.createElement('canvas');
  const frost = document.createElement('canvas');
  const flakes = [];
  let width = 1;
  let height = 1;
  let scale = 1;
  let active = false;
  let raf = 0;
  let last = 0;
  let frostLevel = 0;
  let spawnClock = 0;

  function capacity() {
    return Math.max(48, Math.min(160, Math.round((width * height) / 8000)));
  }

  function spawn(age = 0) {
    // 雪更容易粘在靠边和靠下的地方。
    let x = random() * width;
    let y = random() * height;
    if (random() < 0.45) {
      const edge = Math.floor(random() * 4);
      const depth = Math.pow(random(), 2) * Math.min(width, height) * 0.2;
      if (edge === 0) y = depth;
      else if (edge === 1) y = height - depth;
      else if (edge === 2) x = depth;
      else x = width - depth;
    } else if (random() < 0.35) {
      y = height * (0.55 + random() * 0.45);
    }
    const kind = random();
    const image = kind < 0.12 ? crystals[Math.floor(random() * crystals.length)]
      : kind < 0.68 ? clumps[Math.floor(random() * clumps.length)]
        : specks[Math.floor(random() * specks.length)];
    const base = kind < 0.12 ? 10 + random() * 9 : kind < 0.68 ? 5 + random() * 11 : 2 + random() * 3.5;
    const fate = random();
    const life = 10 + random() * 26;
    return {
      x,
      y,
      image,
      size: base,
      angle: random() * Math.PI * 2,
      alpha: 0.55 + random() * 0.4,
      age,
      life,
      // stick: 一直粘着；fade: 慢慢淡掉；melt: 缩小变透明。
      fate: fate < 0.55 ? 'stick' : fate < 0.78 ? 'fade' : 'melt',
      end: 3 + random() * 5,
    };
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(bounds.width || window.innerWidth));
    const nextHeight = Math.max(1, Math.round(bounds.height || window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const pixelWidth = Math.round(nextWidth * dpr);
    const pixelHeight = Math.round(nextHeight * dpr);
    if (canvas.width === pixelWidth && canvas.height === pixelHeight && width === nextWidth) return false;
    width = nextWidth;
    height = nextHeight;
    scale = dpr;
    for (const layer of [canvas, backdrop, frost]) {
      layer.width = pixelWidth;
      layer.height = pixelHeight;
    }
    // 背景按 cover 铺满，和原来的雪夜底图一致。
    const context = backdrop.getContext('2d');
    const cover = Math.max(pixelWidth / plate.width, pixelHeight / plate.height);
    const drawWidth = plate.width * cover;
    const drawHeight = plate.height * cover;
    // 隔着玻璃，底图稍微柔一点。
    context.filter = `blur(${(7 * dpr).toFixed(1)}px)`;
    context.drawImage(plate, (pixelWidth - drawWidth) / 2 - 16, (pixelHeight - drawHeight) / 2 - 16, drawWidth + 32, drawHeight + 32);
    context.filter = 'none';
    context.fillStyle = 'rgba(255,255,255,0.012)';
    context.fillRect(0, 0, pixelWidth, pixelHeight);
    paintFrost(frost, width, height, scale);
    flakes.length = 0;
    const count = capacity();
    for (let index = 0; index < count * 0.8; index += 1) {
      const flake = spawn();
      flake.age = random() * flake.life;
      flakes.push(flake);
    }
    return true;
  }

  function step(dt) {
    frostLevel = Math.min(1, frostLevel + dt / 25);
    spawnClock += dt;
    const every = 0.35;
    while (spawnClock > every) {
      spawnClock -= every;
      if (flakes.length < capacity()) flakes.push(spawn());
    }
    for (let index = flakes.length - 1; index >= 0; index -= 1) {
      const flake = flakes[index];
      flake.age += dt;
      if (flake.fate !== 'stick' && flake.age > flake.life + flake.end) flakes.splice(index, 1);
    }
  }

  function draw() {
    const context = canvas.getContext('2d');
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.drawImage(backdrop, 0, 0);
    context.globalAlpha = 0.55 + frostLevel * 0.45;
    context.drawImage(frost, 0, 0);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    for (const flake of flakes) {
      const landing = Math.min(1, flake.age / 0.5);
      let alpha = flake.alpha * landing;
      let size = flake.size * (0.7 + 0.3 * landing);
      if (flake.fate !== 'stick' && flake.age > flake.life) {
        const t = Math.min(1, (flake.age - flake.life) / flake.end);
        if (flake.fate === 'melt') {
          size *= 1 - t * 0.55;
          alpha *= (1 - t) * (1 - t * 0.3);
        } else {
          alpha *= 1 - t;
        }
      }
      if (alpha <= 0.01) continue;
      context.globalAlpha = alpha;
      const cos = Math.cos(flake.angle) * size;
      const sin = Math.sin(flake.angle) * size;
      context.setTransform(cos * scale, sin * scale, -sin * scale, cos * scale, flake.x * scale, flake.y * scale);
      context.drawImage(flake.image, -1, -1, 2, 2);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
  }

  function frame(now) {
    if (!active) {
      raf = 0;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    resize();
    step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  return {
    setActive(next) {
      active = next;
      if (next && !raf) {
        last = performance.now();
        resize();
        draw();
        raf = requestAnimationFrame(frame);
      } else if (!next && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
  };
}
