function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function cube(value) {
  return value * value * value;
}

function combinedRadius(left, right) {
  return Math.cbrt(cube(left) + cube(right));
}

export function createRain(width, height) {
  const rain = {
    width,
    height,
    intensity: 0.55,
    scale: width < 500 ? 0.9 : 1.25,
    drops: [],
    mist: [],
    random: mulberry32(0x51a7e1),
  };
  for (let frame = 0; frame < 40; frame += 1) stepRain(rain, 0.25);
  return rain;
}

export function stepRain(rain, dt) {
  const { width, height, intensity, scale, random } = rain;
  const area = (width * height) / 1_000_000;
  const spawn = (15 + 110 * intensity) * area * dt;
  let births = Math.floor(spawn);
  if (random() < spawn - births) births += 1;
  for (let index = 0; index < births && rain.drops.length < 700; index += 1) {
    const radius = (1.8 + 8 * random() ** 2.4) * scale;
    rain.drops.push({
      x: random() * width,
      y: random() * height * 1.05 - height * 0.05,
      radius,
      vx: 0,
      vy: 0,
      momentum: 0,
      trailY: random() * height,
    });
  }

  const mistLimit = Math.round((width * height) / 900 * (0.4 + 0.6 * intensity));
  const mistBirths = Math.min(
    Math.max(0, mistLimit - rain.mist.length),
    Math.ceil((40 + 400 * intensity) * area * dt * 10),
  );
  for (let index = 0; index < mistBirths; index += 1) {
    rain.mist.push({
      x: random() * width,
      y: random() * height,
      radius: (0.7 + 1.9 * random()) * scale,
    });
  }

  const maxRadius = 14 * scale * 1.3;
  for (const drop of rain.drops) {
    if (drop.dead || drop.radius <= 5 * scale) continue;
    const weight = (drop.radius / scale - 5) / 9;
    if (random() < dt * (0.15 + 1.5 * weight)) drop.momentum += (1 + 2 * random()) * (1 + weight);
    drop.momentum *= Math.exp(-1.4 * dt);
    drop.vy = 110 * Math.max(0, drop.momentum) * scale * (0.35 + weight);
    if (random() < 2 * dt) drop.vx = (random() - 0.5) * drop.vy * 0.25;
    drop.x += drop.vx * dt;
    drop.y += drop.vy * dt;
    const spacing = drop.radius * (1.6 + 2.5 * random());
    if (drop.y - drop.trailY > spacing && drop.vy > 5 * scale) {
      const bead = drop.radius * (0.18 + 0.18 * random());
      rain.mist.push({
        x: drop.x + (random() - 0.5) * drop.radius * 0.4,
        y: drop.y - drop.radius * 1.1,
        radius: bead,
      });
      drop.radius = Math.cbrt(Math.max(0, cube(drop.radius) - cube(bead)));
      drop.trailY = drop.y;
    }
  }

  for (const drop of rain.drops) {
    if (drop.y - drop.radius > height || drop.radius < 0.4) drop.dead = true;
  }

  const alive = rain.drops.filter((drop) => !drop.dead).sort((left, right) => right.radius - left.radius);
  for (let index = 0; index < alive.length; index += 1) {
    const drop = alive[index];
    if (drop.dead) continue;
    for (let otherIndex = index + 1; otherIndex < alive.length; otherIndex += 1) {
      const other = alive[otherIndex];
      if (other.dead) continue;
      if (Math.hypot(drop.x - other.x, drop.y - other.y) >= (drop.radius + other.radius) * 0.8) continue;
      const keeper = drop.radius >= other.radius ? drop : other;
      const absorbed = keeper === drop ? other : drop;
      const volume = cube(keeper.radius) + cube(absorbed.radius);
      keeper.x += ((absorbed.x - keeper.x) * cube(absorbed.radius)) / volume;
      keeper.y += ((absorbed.y - keeper.y) * cube(absorbed.radius)) / volume;
      keeper.radius = Math.min(maxRadius, Math.cbrt(volume));
      keeper.momentum = Math.max(keeper.momentum, absorbed.momentum) + 0.3;
      absorbed.dead = true;
    }
  }

  const runners = rain.drops.filter((drop) => !drop.dead && drop.vy > 1);
  if (runners.length && rain.mist.length) {
    const kept = [];
    for (const bead of rain.mist) {
      const collector = runners.find((drop) => Math.hypot(bead.x - drop.x, bead.y - drop.y) < drop.radius * 1.1 + bead.radius);
      if (!collector) {
        kept.push(bead);
        continue;
      }
      collector.radius = Math.min(maxRadius, combinedRadius(collector.radius, bead.radius));
    }
    rain.mist = kept;
  }

  rain.drops = rain.drops.filter((drop) => !drop.dead);
  if (rain.mist.length > mistLimit * 1.3) rain.mist.splice(0, rain.mist.length - Math.round(mistLimit * 1.3));
}
