import { paintNightCity } from './background.js';
import { paintSnowNight } from '../snow/background.js';
import { createRainLoop, hushRainLoop, playRainLoop } from './audio.js';

export function mountRain(canvas) {
  const RaindropFX = window.RaindropFX;
  if (!RaindropFX) return null;

  let effect = null;
  let running = false;
  let ready = false;
  let booting = null;
  let look = null;
  let request = 0;
  let audio = null;
  let unlocked = false;
  let city = null;
  let snow = null;

  function viewSize() {
    const bounds = canvas.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
    };
  }

  function plate(paint) {
    const canvasPlate = document.createElement('canvas');
    canvasPlate.width = 1600;
    canvasPlate.height = 900;
    return paint(canvasPlate);
  }

  async function boot() {
    if (effect || booting) return booting;
    booting = (async () => {
      let size = viewSize();
      for (let attempt = 0; attempt < 20 && (size.width < 2 || size.height < 2); attempt += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        size = viewSize();
      }
      canvas.width = size.width;
      canvas.height = size.height;
      city = plate(paintNightCity);
      snow = plate(paintSnowNight);
      effect = new RaindropFX({
        canvas,
        background: city,
        backgroundBlurSteps: 2,
      });
      await effect.start();
      ready = true;
      running = true;
      if (!look) {
        effect.stop();
        running = false;
      }
    })().catch((error) => {
      console.error(error);
      const note = document.createElement('p');
      note.id = 'rainError';
      note.textContent = error?.message || String(error);
      note.style.cssText = 'position:fixed;left:24px;bottom:24px;z-index:3;color:#fff;font:14px sans-serif;';
      document.body.appendChild(note);
    });
    return booting;
  }

  async function setRunning(next) {
    await boot();
    if (!effect) return;
    if (next && !running) {
      const { width, height } = viewSize();
      effect.resize(width, height);
      await effect.start();
      running = true;
    } else if (!next && running) {
      effect.stop();
      running = false;
    }
  }

  const observer = new ResizeObserver(() => {
    if (!effect || !ready || !look) return;
    const { width, height } = viewSize();
    if (width < 2 || height < 2) return;
    effect.resize(width, height);
  });
  observer.observe(canvas);
  boot();

  return {
    async setLook(next) {
      const ticket = ++request;
      const showing = next === 'city' || next === 'snow';
      look = showing ? next : null;
      await setRunning(showing);
      if (ticket !== request) return;
      if (showing && effect) await effect.setBackground(next === 'snow' ? snow : city);
      if (ticket !== request) return;
      if (next === 'city' && unlocked) await playRainLoop(audio);
      else hushRainLoop(audio);
    },
    async unlock() {
      if (unlocked) return;
      unlocked = true;
      if (!audio) audio = createRainLoop();
      if (look === 'city') await playRainLoop(audio);
    },
    destroy() {
      observer.disconnect();
      effect?.stop();
      audio?.context.close();
    },
  };
}
