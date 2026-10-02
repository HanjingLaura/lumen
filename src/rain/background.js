function glow(context, x, y, radius, color, alpha) {
  const paint = context.createRadialGradient(x, y, 0, x, y, radius);
  paint.addColorStop(0, color.replace('ALPHA', String(alpha)));
  paint.addColorStop(0.65, color.replace('ALPHA', String(alpha * 0.35)));
  paint.addColorStop(1, color.replace('ALPHA', '0'));
  context.fillStyle = paint;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

/**
 * A blue-hour river bank, drawn once and reused behind the glass.
 * The rain, mist and refraction stay the same; only this backdrop differs
 * from a dense neon city.
 */
export function paintHarbor(context, width, height) {
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#07131c');
  sky.addColorStop(0.38, '#14384a');
  sky.addColorStop(0.62, '#1d5960');
  sky.addColorStop(1, '#081014');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  glow(context, width * 0.78, height * 0.16, Math.min(width, height) * 0.22, 'rgba(186, 220, 214, ALPHA)', 0.22);

  const horizon = height * 0.64;
  context.fillStyle = '#0c242c';
  context.beginPath();
  context.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 24) {
    const hill = Math.sin(x * 0.004) * height * 0.03 + Math.sin(x * 0.011) * height * 0.012;
    context.lineTo(x, horizon - height * 0.08 + hill);
  }
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.fill();

  const waterTop = height * 0.7;
  const water = context.createLinearGradient(0, waterTop, 0, height);
  water.addColorStop(0, '#0a2c34');
  water.addColorStop(1, '#061014');
  context.fillStyle = water;
  context.fillRect(0, waterTop, width, height - waterTop);

  const unit = Math.max(width, height) / 70;
  let cursor = -unit * 2;
  const buildings = [];
  while (cursor < width) {
    const block = unit * (2.2 + Math.random() * 4.2);
    const rise = unit * (4 + Math.random() * 14);
    buildings.push({ x: cursor, width: block, top: waterTop - rise });
    cursor += block + unit * (0.3 + Math.random() * 0.8);
  }
  for (const building of buildings) {
    context.fillStyle = '#102028';
    context.fillRect(building.x, building.top, building.width, waterTop - building.top);
    const pane = unit * 0.32;
    for (let y = building.top + pane; y < waterTop - pane; y += pane * 1.7) {
      for (let x = building.x + pane * 0.4; x < building.x + building.width - pane; x += pane * 1.8) {
        if (Math.random() > 0.55) continue;
        const cool = Math.random() > 0.72;
        context.fillStyle = cool
          ? `rgba(150, 214, 206, ${0.35 + Math.random() * 0.45})`
          : `rgba(255, 214, 156, ${0.28 + Math.random() * 0.4})`;
        context.fillRect(x, y, pane, pane * 1.15);
      }
    }
  }

  context.strokeStyle = '#163038';
  context.lineWidth = Math.max(2, unit * 0.35);
  context.beginPath();
  context.moveTo(0, waterTop - unit * 2);
  context.quadraticCurveTo(width * 0.5, waterTop - unit * 8, width, waterTop - unit * 1.4);
  context.stroke();

  context.globalCompositeOperation = 'lighter';
  for (const building of buildings) {
    if (Math.random() > 0.45) continue;
    const x = building.x + building.width * 0.5;
    glow(context, x, waterTop + (height - waterTop) * (0.15 + Math.random() * 0.45), unit * (1.2 + Math.random() * 2), 'rgba(120, 210, 196, ALPHA)', 0.18);
    context.fillStyle = 'rgba(170, 230, 220, 0.18)';
    context.fillRect(x - 1, waterTop, 2, (height - waterTop) * 0.55);
  }
  context.globalCompositeOperation = 'source-over';
}

export function soften(source, amount) {
  const passes = 2 + Math.round(amount * 4);
  let current = source;
  let scale = 1;
  for (let step = 0; step < passes; step += 1) {
    scale *= 2;
    const next = document.createElement('canvas');
    next.width = Math.max(1, Math.round(source.width / scale));
    next.height = Math.max(1, Math.round(source.height / scale));
    const context = next.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.drawImage(current, 0, 0, next.width, next.height);
    current = next;
  }
  const result = document.createElement('canvas');
  result.width = source.width;
  result.height = source.height;
  const context = result.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.drawImage(current, 0, 0, result.width, result.height);
  return result;
}
