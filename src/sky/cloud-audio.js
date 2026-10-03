function unit() {
  return Math.random() * 2 - 1;
}

function writeBreeze(data, rate) {
  let low = 0;
  let air = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = unit();
    low = low * 0.99 + white * 0.018;
    air = air * 0.72 + white * 0.12;
    const seconds = index / rate;
    const swell = 0.55 + 0.45 * Math.sin(seconds * 0.13) * Math.sin(seconds * 0.05 + 0.8);
    data[index] = (low * 0.7 + air * 0.22) * swell;
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
  const length = Math.floor(rate * 24);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  writeBreeze(left, rate);
  writeBreeze(right, rate);
  crossfade(left, rate);
  crossfade(right, rate);
  let peak = 0.001;
  for (let index = 0; index < length; index += 1) peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  const buffer = context.createBuffer(2, length, rate);
  const gain = 0.5 / peak;
  for (let index = 0; index < length; index += 1) {
    buffer.getChannelData(0)[index] = left[index] * gain;
    buffer.getChannelData(1)[index] = right[index] * gain * 0.94;
  }
  return buffer;
}

export function createCloudLoop() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  const context = new Context({ latencyHint: 'playback' });
  const high = context.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 180;
  const low = context.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 1400;
  const master = context.createGain();
  master.gain.value = 0;
  high.connect(low);
  low.connect(master);
  master.connect(context.destination);
  const source = context.createBufferSource();
  source.buffer = makeLoop(context);
  source.loop = true;
  source.connect(high);
  source.start();
  return { context, master };
}

export async function playCloudLoop(audio) {
  if (!audio) return;
  await audio.context.resume();
  audio.master.gain.setTargetAtTime(0.48, audio.context.currentTime, 0.5);
}

export function hushCloudLoop(audio) {
  if (!audio) return;
  audio.master.gain.setTargetAtTime(0, audio.context.currentTime, 0.28);
}
