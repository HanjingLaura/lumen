function unit() {
  return Math.random() * 2 - 1;
}

function writeRain(data, rate) {
  let low = 0;
  let mid = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = unit();
    low = low * 0.985 + white * 0.035;
    mid = mid * 0.62 + white * 0.38;
    const seconds = index / rate;
    const gust = 0.82 + 0.18 * Math.sin(seconds * 0.63) * Math.sin(seconds * 0.21 + 1.3);
    data[index] = (low * 1.15 + mid * 0.28) * gust;
  }
}

function addThunder(data, rate, atSeconds, distance) {
  const start = Math.floor(atSeconds * rate);
  const length = Math.floor(rate * (3.2 + Math.random() * 1.6));
  let rumble = 0;
  for (let index = 0; index < length && start + index < data.length; index += 1) {
    rumble = rumble * 0.992 + unit() * 0.08;
    const time = index / rate;
    const envelope = time < 0.08 ? time / 0.08 : Math.exp(-(time - 0.08) / (1.1 + distance * 0.25));
    const crack = distance < 2 && index < rate * 0.05 ? unit() * Math.exp(-index / (rate * 0.012)) * 1.6 : 0;
    data[start + index] += (rumble * (0.7 / (1 + distance * 0.15)) + crack) * envelope;
  }
}

function crossfade(data, rate) {
  const fade = Math.floor(rate * 0.4);
  for (let index = 0; index < fade; index += 1) {
    const mix = index / fade;
    const head = data.length - fade + index;
    const blended = data[head] * (1 - mix) + data[index] * mix;
    data[index] = blended;
    data[head] = blended;
  }
}

function makeLoop(context) {
  const rate = context.sampleRate;
  const seconds = 18;
  const length = Math.floor(rate * seconds);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  writeRain(left, rate);
  writeRain(right, rate);
  addThunder(left, rate, 5.5, 3.2);
  addThunder(right, rate, 5.5, 3.2);
  addThunder(left, rate, 13.2, 1.4);
  addThunder(right, rate, 13.2, 1.4);
  crossfade(left, rate);
  crossfade(right, rate);
  let peak = 0.001;
  for (let index = 0; index < length; index += 1) peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  const buffer = context.createBuffer(2, length, rate);
  const gain = 0.72 / peak;
  for (let index = 0; index < length; index += 1) {
    buffer.getChannelData(0)[index] = left[index] * gain;
    buffer.getChannelData(1)[index] = right[index] * gain;
  }
  return buffer;
}

export function createRainLoop() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  const context = new Context({ latencyHint: 'playback' });
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);
  const source = context.createBufferSource();
  source.buffer = makeLoop(context);
  source.loop = true;
  source.connect(master);
  source.start();
  return { context, master, playing: false };
}

export async function playRainLoop(audio) {
  if (!audio) return;
  await audio.context.resume();
  audio.master.gain.setTargetAtTime(0.9, audio.context.currentTime, 0.35);
  audio.playing = true;
}

export function hushRainLoop(audio) {
  if (!audio) return;
  audio.master.gain.setTargetAtTime(0, audio.context.currentTime, 0.2);
  audio.playing = false;
}
