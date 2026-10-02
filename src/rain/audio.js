function randomUnit() {
  return Math.random() * 2 - 1;
}

function noiseBuffer(context, seconds) {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let brown = 0;
    for (let index = 0; index < length; index += 1) {
      brown = brown * 0.98 + randomUnit() * 0.08;
      data[index] = brown + randomUnit() * 0.015;
    }
  }
  return buffer;
}

function tickBuffer(context, seconds) {
  const rate = context.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    const taps = Math.floor(seconds * 46);
    for (let tap = 0; tap < taps; tap += 1) {
      const start = Math.floor(Math.random() * length);
      const frequency = 1500 + Math.random() ** 2 * 4500;
      const decay = rate * (0.002 + Math.random() * 0.006);
      const gain = 0.12 + Math.random() ** 2 * 0.7;
      const span = Math.min(length - start, Math.floor(decay * 6));
      for (let index = 0; index < span; index += 1) {
        data[start + index] += Math.sin((Math.PI * 2 * frequency * index) / rate) * Math.exp(-index / decay) * gain;
      }
    }
  }
  return buffer;
}

function mixLevel(intensity) {
  const shaped = intensity * intensity;
  return { wash: 0.18 + shaped * 0.9, ticks: 0.28 + intensity * 0.55 };
}

export function createRainAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  const context = new Context({ latencyHint: 'playback' });
  const master = context.createGain();
  master.gain.value = 0;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -8;
  compressor.ratio.value = 8;
  master.connect(compressor).connect(context.destination);

  const wash = context.createBufferSource();
  wash.buffer = noiseBuffer(context, 8);
  wash.loop = true;
  const washFilter = context.createBiquadFilter();
  washFilter.type = 'lowpass';
  washFilter.frequency.value = 1800;
  const washGain = context.createGain();
  wash.connect(washFilter).connect(washGain).connect(master);

  const ticks = context.createBufferSource();
  ticks.buffer = tickBuffer(context, 6);
  ticks.loop = true;
  const tickFilter = context.createBiquadFilter();
  tickFilter.type = 'highpass';
  tickFilter.frequency.value = 900;
  const tickGain = context.createGain();
  ticks.connect(tickFilter).connect(tickGain).connect(master);

  const thunderBus = context.createGain();
  thunderBus.gain.value = 0.9;
  thunderBus.connect(master);
  wash.start();
  ticks.start();

  return { context, master, washGain, tickGain, thunderBus, running: false };
}

export async function resumeRainAudio(audio, { intensity, volume }) {
  if (!audio) return;
  await audio.context.resume();
  const level = mixLevel(intensity);
  const now = audio.context.currentTime;
  audio.washGain.gain.setTargetAtTime(level.wash, now, 0.4);
  audio.tickGain.gain.setTargetAtTime(level.ticks, now, 0.4);
  audio.master.gain.cancelScheduledValues(now);
  audio.master.gain.setTargetAtTime((volume / 100) ** 2 * 0.85, now, 0.3);
  audio.running = true;
}

export function updateRainAudio(audio, { intensity, volume }) {
  if (!audio?.running) return;
  const level = mixLevel(intensity);
  const now = audio.context.currentTime;
  audio.washGain.gain.setTargetAtTime(level.wash, now, 0.3);
  audio.tickGain.gain.setTargetAtTime(level.ticks, now, 0.3);
  audio.master.gain.setTargetAtTime((volume / 100) ** 2 * 0.85, now, 0.15);
}

export function silenceRainAudio(audio) {
  if (!audio) return;
  const now = audio.context.currentTime;
  audio.master.gain.setTargetAtTime(0, now, 0.2);
  audio.running = false;
}

export function playThunder(audio, distanceKm) {
  if (!audio?.running) return;
  const { context, thunderBus } = audio;
  const rate = context.sampleRate;
  const seconds = 4.5 + Math.random() * 3 + Math.min(3, distanceKm * 0.35);
  const length = Math.floor(rate * seconds);
  const data = new Float32Array(length);
  let rumble = 0;
  for (let index = 0; index < length; index += 1) {
    rumble = rumble * 0.995 + randomUnit() * 0.05;
    data[index] = rumble;
  }
  const peaks = 3 + Math.floor(Math.random() * 3);
  const envelope = new Float32Array(length);
  for (let peak = 0; peak < peaks; peak += 1) {
    const at = (peak === 0 ? 0 : Math.random() * 0.55) * seconds;
    const attack = 0.05 + Math.random() * 0.2;
    const release = 0.7 + Math.random() * 1.6;
    const height = peak === 0 ? 1 : 0.4 + Math.random() * 0.4;
    for (let index = Math.floor(at * rate); index < length; index += 1) {
      const time = index / rate - at;
      const amount = time < attack ? time / attack : Math.exp(-(time - attack) / release);
      envelope[index] = Math.max(envelope[index], amount * height);
    }
  }
  if (distanceKm < 2.5) {
    const crack = Math.floor(rate * 0.2);
    for (let index = 0; index < crack; index += 1) data[index] += randomUnit() * Math.exp(-index / (rate * 0.04)) * 1.4;
  }
  let peak = 0.001;
  for (let index = 0; index < length; index += 1) {
    data[index] *= envelope[index];
    peak = Math.max(peak, Math.abs(data[index]));
  }
  for (let index = 0; index < length; index += 1) data[index] = (data[index] / peak) * 0.8;
  const buffer = context.createBuffer(1, length, rate);
  buffer.copyToChannel(data, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.max(120, 900 / (1 + distanceKm * 0.7));
  const gain = context.createGain();
  gain.gain.value = Math.min(1, 1.4 / (1 + distanceKm * 0.3));
  source.connect(filter).connect(gain).connect(thunderBus);
  source.start(context.currentTime + (distanceKm * 1000) / 343);
}
