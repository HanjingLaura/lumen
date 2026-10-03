function unit() {
  return Math.random() * 2 - 1;
}

function writeWind(data, rate) {
  let low = 0;
  let hush = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = unit();
    low = low * 0.992 + white * 0.02;
    hush = hush * 0.8 + white * 0.08;
    const seconds = index / rate;
    const gust = 0.55 + 0.45 * Math.sin(seconds * 0.17) * Math.sin(seconds * 0.07 + 0.6);
    const breath = 0.75 + 0.25 * Math.sin(seconds * 0.41 + 2);
    data[index] = (low * 1.4 + hush * 0.08) * gust * breath;
  }
}

function crossfade(data, rate) {
  const fade = Math.floor(rate * 0.5);
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
  const length = Math.floor(rate * 22);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  writeWind(left, rate);
  writeWind(right, rate);
  crossfade(left, rate);
  crossfade(right, rate);
  let peak = 0.001;
  for (let index = 0; index < length; index += 1) peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  const buffer = context.createBuffer(2, length, rate);
  const gain = 0.55 / peak;
  for (let index = 0; index < length; index += 1) {
    buffer.getChannelData(0)[index] = left[index] * gain;
    buffer.getChannelData(1)[index] = right[index] * gain * 0.92;
  }
  return buffer;
}

export function createSnowLoop() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  const context = new Context({ latencyHint: 'playback' });
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  const master = context.createGain();
  master.gain.value = 0;
  filter.connect(master);
  master.connect(context.destination);
  const source = context.createBufferSource();
  source.buffer = makeLoop(context);
  source.loop = true;
  source.connect(filter);
  source.start();
  return { context, master };
}

export async function playSnowLoop(audio) {
  if (!audio) return;
  await audio.context.resume();
  audio.master.gain.setTargetAtTime(0.55, audio.context.currentTime, 0.45);
}

export function hushSnowLoop(audio) {
  if (!audio) return;
  audio.master.gain.setTargetAtTime(0, audio.context.currentTime, 0.25);
}
