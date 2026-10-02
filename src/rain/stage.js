import { paintNightCity } from './background.js';
import { createRainLoop, hushRainLoop, playRainLoop } from './audio.js';

export function mountRain(canvas) {
  const RaindropFX = window.RaindropFX;
  if (!RaindropFX) return null;

  let effect = null;
  let running = false;
  let ready = false;
  let booting = null;
  let active = false;
  let audio = null;
  let unlocked = false;

  function viewSize() {
    const bounds = canvas.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
    };
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
      const plate = document.createElement('canvas');
      plate.width = 1600;
      plate.height = 900;
      const background = paintNightCity(plate);
      effect = new RaindropFX({
        canvas,
        background,
        backgroundBlurSteps: 2,
      });
      await effect.start();
      ready = true;
      running = true;
      if (!active) {
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
    if (!effect || !ready || !active) return;
    const { width, height } = viewSize();
    if (width < 2 || height < 2) return;
    effect.resize(width, height);
  });
  observer.observe(canvas);
  boot();

  return {
    async setActive(next) {
      active = next;
      await setRunning(next);
      if (next && unlocked) await playRainLoop(audio);
      else hushRainLoop(audio);
    },
    async unlock() {
      if (unlocked) return;
      unlocked = true;
      if (!audio) audio = createRainLoop();
      if (active) await playRainLoop(audio);
    },
    destroy() {
      observer.disconnect();
      effect?.stop();
      audio?.context.close();
    },
  };
}
