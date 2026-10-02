function glow(context, x, y, radius, color, alpha) {
  const paint = context.createRadialGradient(x, y, 0, x, y, radius);
  paint.addColorStop(0, color.replace('A', String(alpha)));
  paint.addColorStop(0.7, color.replace('A', String(alpha * 0.35)));
  paint.addColorStop(1, color.replace('A', '0'));
  context.fillStyle = paint;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Night city behind the glass: purple sky, lit windows, neon, street lights. */
export function paintNightCity(canvas) {
  const context = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const random = mulberry32(0xc17a);
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#24143f');
  sky.addColorStop(0.42, '#4a2a68');
  sky.addColorStop(0.72, '#8a4560');
  sky.addColorStop(1, '#1a1020');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  const unit = Math.max(width, height) / 60;
  const layers = [
    { base: 0.7, maxH: 0.42, color: '#3a3358', lit: 0.45, alpha: 0.85 },
    { base: 0.8, maxH: 0.52, color: '#241c3c', lit: 0.55, alpha: 0.95 },
    { base: 0.92, maxH: 0.48, color: '#161226', lit: 0.5, alpha: 1 },
  ];
  for (const layer of layers) {
    let x = -random() * unit * 3;
    while (x < width) {
      const block = unit * (2.5 + 5 * random());
      const rise = height * layer.maxH * (0.3 + 0.7 * random());
      const top = height * layer.base - rise;
      context.fillStyle = layer.color;
      context.fillRect(x, top, block, height - top);
      const paneW = unit * 0.35;
      const paneH = unit * 0.5;
      for (let y = top + paneH; y < height * layer.base - paneH; y += paneH * 1.8) {
        for (let px = x + paneW; px < x + block - paneW; px += paneW * 1.9) {
          if (random() > layer.lit) continue;
          const warm = random() > 0.25;
          const alpha = layer.alpha * (0.45 + 0.55 * random());
          context.fillStyle = warm
            ? `rgba(255, ${170 + Math.floor(60 * random())}, ${80 + Math.floor(60 * random())}, ${alpha})`
            : `rgba(${150 + Math.floor(60 * random())}, ${190 + Math.floor(40 * random())}, 255, ${alpha})`;
          context.fillRect(px, y, paneW, paneH);
        }
      }
      x += block + unit * random() * 0.6;
    }
  }

  const neons = ['rgba(255,60,140,A)', 'rgba(60,220,255,A)', 'rgba(255,120,40,A)', 'rgba(160,90,255,A)'];
  for (let index = 0; index < 4; index += 1) {
    const x = random() * width;
    const y = height * (0.6 + 0.2 * random());
    const signW = unit * (4 + 6 * random());
    const signH = unit * 1.4;
    context.fillStyle = neons[index].replace('A', '0.95');
    context.fillRect(x, y, signW, signH);
    glow(context, x + signW * 0.5, y, unit * 8, neons[index], 0.55);
  }

  context.globalCompositeOperation = 'lighter';
  for (let index = 0; index < 26; index += 1) {
    const pick = random();
    const color = pick < 0.35 ? 'rgba(255,40,30,A)' : pick < 0.65 ? 'rgba(255,245,220,A)' : 'rgba(255,170,60,A)';
    glow(context, random() * width, height * (0.84 + 0.14 * random()), unit * (0.8 + 2.2 * random()), color, 0.35 + 0.4 * random());
  }
  context.globalCompositeOperation = 'source-over';
  return canvas.toDataURL('image/jpeg', 0.86);
}
