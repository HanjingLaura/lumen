function unit() {
  return Math.random() * 2 - 1;
}

function writeAir(data, rate) {
  let low = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = unit();
    low = low * 0.997 + white * 0.012;
    const seconds = index / rate;
    const swell = 0.7 + 0.3 * Math.sin(seconds * 0.11) * Math.sin(seconds * 0.04 + 1.2);
    data[index] = low * swell;
  }
}

function chirp(data, rate, at, frequency) {
  const start = Math.floor(at * rate);
  const length = Math.floor(rate * 0.07);
  for (let index = 0; index < length && start + index < data.length; index += 1) {
    const time = index / rate;
    const envelope = Math.sin(Math.PI * (index / length));
    const buzz = 0.45 + 0.55 * Math.sin(2 * Math.PI * 38 * time);
    data[start + index] += Math.sin(2 * Math.PI * frequency * time) * envelope * buzz * 0.22;
  }
}

function addCrickets(data, rate) {
  const seconds = data.length / rate;
  let cursor = 1.4;
  while (cursor < seconds - 1) {
    const group = 2 + Math.floor(Math.random() * 3);
    const frequency = 3900 + Math.random() * 700;
    for (let index = 0; index < group; index += 1) chirp(data, rate, cursor + index * 0.11, frequency);
    cursor += 2.4 + Math.random() * 3.6;
  }
}

function crossfade(data, rate) {
  const fade = Math.floor(rate * 0.45);
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
  const length = Math.floor(rate * 26);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  writeAir(left, rate);
  writeAir(right, rate);
  addCrickets(left, rate);
  addCrickets(right, rate);
  crossfade(left, rate);
  crossfade(right, rate);
  let peak = 0.001;
  for (let index = 0; index < length; index += 1) peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  const buffer = context.createBuffer(2, length, rate);
  const gain = 0.42 / peak;
  for (let index = 0; index < length; index += 1) {
    buffer.getChannelData(0)[index] = left[index] * gain;
    buffer.getChannelData(1)[index] = right[index] * gain * 0.9;
  }
  return buffer;
}

export function createNightLoop() {
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
  return { context, master };
}

export async function playNightLoop(audio) {
  if (!audio) return;
  await audio.context.resume();
  audio.master.gain.setTargetAtTime(0.42, audio.context.currentTime, 0.6);
}

export function hushNightLoop(audio) {
  if (!audio) return;
  audio.master.gain.setTargetAtTime(0, audio.context.currentTime, 0.3);
}
