/** Moonlit snow night behind the glass. No trees. */
export function paintSnowNight(canvas) {
  const context = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#1d3f73');
  sky.addColorStop(0.46, '#4e7eb4');
  sky.addColorStop(0.78, '#9eb8d4');
  sky.addColorStop(1, '#e7eef6');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  const moonX = width * 0.7;
  const moonY = height * 0.24;
  const moonR = Math.min(width, height) * 0.055;
  const glow = context.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 9);
  glow.addColorStop(0, 'rgba(255, 250, 240, 0.98)');
  glow.addColorStop(0.12, 'rgba(255, 244, 220, 0.5)');
  glow.addColorStop(0.4, 'rgba(210, 226, 245, 0.12)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#fffaf2';
  context.beginPath();
  context.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  context.fill();

  for (let index = 0; index < 70; index += 1) {
    const x = (index * 97.3) % width;
    const y = (index * 53.1) % (height * 0.55);
    context.fillStyle = `rgba(255, 255, 255, ${0.35 + (index % 5) * 0.1})`;
    const size = index % 6 === 0 ? 2 : 1.2;
    context.fillRect(x, y, size, size);
  }

  const ground = context.createLinearGradient(0, height * 0.72, 0, height);
  ground.addColorStop(0, 'rgba(180, 206, 228, 0)');
  ground.addColorStop(0.35, 'rgba(214, 226, 238, 0.45)');
  ground.addColorStop(1, 'rgba(246, 249, 252, 0.98)');
  context.fillStyle = ground;
  context.fillRect(0, height * 0.72, width, height * 0.28);
  return canvas;
}
