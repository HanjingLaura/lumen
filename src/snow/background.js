function pine(context, cx, baseY, height, body, snow) {
  context.fillStyle = body;
  context.beginPath();
  const layers = 5;
  for (let layer = 0; layer < layers; layer += 1) {
    const y = baseY - (layer * height) / layers;
    const width = height * 0.42 * (1 - layer / (layers + 0.6));
    context.moveTo(cx - width, y);
    context.lineTo(cx, y - height / layers - height * 0.06);
    context.lineTo(cx + width, y);
    context.closePath();
  }
  context.fill();
  context.fillStyle = snow;
  for (let layer = 1; layer < layers; layer += 1) {
    const y = baseY - (layer * height) / layers;
    const width = height * 0.42 * (1 - layer / (layers + 0.6));
    context.beginPath();
    context.moveTo(cx - width * 0.72, y - height * 0.012);
    context.lineTo(cx, y - height / layers * 0.42);
    context.lineTo(cx + width * 0.72, y - height * 0.012);
    context.closePath();
    context.fill();
  }
}

/** A moonlit clearing: low blue pines with snow on the tips, not a black wall. */
export function paintSnowNight(canvas) {
  const context = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#6e93c4');
  sky.addColorStop(0.42, '#8eafd4');
  sky.addColorStop(0.72, '#b7cbe2');
  sky.addColorStop(1, '#d5e0ec');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  const moonX = width * 0.72;
  const moonY = height * 0.22;
  const moonR = Math.min(width, height) * 0.05;
  const glow = context.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 8);
  glow.addColorStop(0, 'rgba(255, 252, 244, 0.95)');
  glow.addColorStop(0.14, 'rgba(255, 244, 220, 0.42)');
  glow.addColorStop(0.45, 'rgba(220, 230, 245, 0.08)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#fffaf2';
  context.beginPath();
  context.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  context.fill();

  for (let index = 0; index < 46; index += 1) {
    const x = (index * 97.3) % width;
    const y = (index * 53.1) % (height * 0.48);
    context.fillStyle = `rgba(255, 255, 255, ${0.28 + (index % 5) * 0.1})`;
    context.fillRect(x, y, index % 4 === 0 ? 1.6 : 1, index % 4 === 0 ? 1.6 : 1);
  }

  for (let index = 0; index < 18; index += 1) {
    const x = (index / 17) * width + ((index * 23) % 50) - 24;
    pine(
      context,
      x,
      height * 0.8,
      height * (0.1 + (index % 4) * 0.018),
      'rgba(92, 118, 150, 0.55)',
      'rgba(236, 242, 248, 0.7)',
    );
  }
  for (let index = 0; index < 9; index += 1) {
    const x = (index + 0.45) / 9 * width + ((index * 31) % 36) - 18;
    pine(
      context,
      x,
      height * 0.9,
      height * (0.16 + (index % 3) * 0.03),
      'rgba(62, 88, 122, 0.78)',
      'rgba(246, 249, 252, 0.92)',
    );
  }

  const ground = context.createLinearGradient(0, height * 0.82, 0, height);
  ground.addColorStop(0, 'rgba(190, 208, 224, 0)');
  ground.addColorStop(0.4, 'rgba(226, 234, 242, 0.55)');
  ground.addColorStop(1, 'rgba(246, 249, 252, 0.96)');
  context.fillStyle = ground;
  context.fillRect(0, height * 0.82, width, height * 0.18);
  return canvas;
}
