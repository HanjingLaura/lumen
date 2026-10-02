function pine(context, cx, baseY, height, color) {
  context.fillStyle = color;
  context.beginPath();
  const layers = 6;
  for (let layer = 0; layer < layers; layer += 1) {
    const y = baseY - (layer * height) / layers;
    const width = height * 0.46 * (1 - layer / (layers + 0.4));
    context.moveTo(cx - width, y);
    context.lineTo(cx, y - height / layers - height * 0.08);
    context.lineTo(cx + width, y);
    context.closePath();
  }
  context.fill();
  context.fillRect(cx - height * 0.025, baseY - 2, height * 0.05, height * 0.08);
}

/** Moonlit pines behind the glass, in the same spirit as the cozy-cabin window. */
export function paintSnowNight(canvas) {
  const context = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#1c2c4e');
  sky.addColorStop(0.38, '#12203a');
  sky.addColorStop(0.72, '#0a1428');
  sky.addColorStop(1, '#07101c');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  const moonX = width * 0.74;
  const moonY = height * 0.24;
  const moonR = Math.min(width, height) * 0.045;
  const glow = context.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 7);
  glow.addColorStop(0, 'rgba(236, 242, 255, 0.95)');
  glow.addColorStop(0.12, 'rgba(190, 208, 240, 0.45)');
  glow.addColorStop(0.4, 'rgba(120, 150, 200, 0.08)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#f4f7ff';
  context.beginPath();
  context.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  context.fill();

  for (let index = 0; index < 90; index += 1) {
    const x = (index * 97.3) % width;
    const y = ((index * 53.1) % (height * 0.62));
    context.fillStyle = `rgba(220, 230, 255, ${0.25 + (index % 7) * 0.1})`;
    context.fillRect(x, y, index % 5 === 0 ? 1.6 : 1, index % 5 === 0 ? 1.6 : 1);
  }

  for (let index = 0; index < 28; index += 1) {
    const x = (index / 27) * width + ((index * 17) % 40) - 20;
    pine(context, x, height * 0.78, height * (0.16 + (index % 5) * 0.025), 'rgba(10, 16, 32, 0.78)');
  }
  for (let index = 0; index < 16; index += 1) {
    const x = (index / 15) * width + ((index * 29) % 70) - 35;
    pine(context, x, height * 0.9, height * (0.28 + (index % 4) * 0.04), 'rgba(5, 9, 20, 0.96)');
  }

  const ground = context.createLinearGradient(0, height * 0.78, 0, height);
  ground.addColorStop(0, 'rgba(30, 48, 80, 0)');
  ground.addColorStop(0.45, 'rgba(150, 170, 200, 0.18)');
  ground.addColorStop(1, 'rgba(214, 224, 238, 0.55)');
  context.fillStyle = ground;
  context.fillRect(0, height * 0.78, width, height * 0.22);
  return canvas;
}
