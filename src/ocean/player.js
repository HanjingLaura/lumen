/**
 * 场景 3 播放 Framic 热带海滩目录里的马尔代夫窗景。
 * 画面和海浪声都在这条公开视频里，不把成片拷进仓库。
 * https://www.youtube.com/watch?v=M5U0A95JuVA
 */
const VIDEO_ID = 'M5U0A95JuVA';
const ORIGIN = 'https://www.youtube-nocookie.com';

export function mountOcean(frame) {
  const iframe = document.createElement('iframe');
  iframe.title = '马尔代夫海滩窗景';
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.setAttribute('allowfullscreen', '');
  frame.appendChild(iframe);

  let active = false;
  let unlocked = false;
  let loaded = false;
  let ready = false;

  function command(func, args = []) {
    if (!ready || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func,
      args,
    }), ORIGIN);
  }

  function sync() {
    if (!ready) return;
    if (active) {
      command('playVideo');
      if (unlocked) {
        command('unMute');
        command('setVolume', [100]);
      } else {
        command('mute');
      }
      return;
    }
    command('mute');
    command('pauseVideo');
  }

  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      controls: '0',
      disablekb: '1',
      fs: '0',
      modestbranding: '1',
      rel: '0',
      playsinline: '1',
      loop: '1',
      playlist: VIDEO_ID,
      iv_load_policy: '3',
      cc_load_policy: '0',
      enablejsapi: '1',
      origin: window.location.origin,
    });
    iframe.src = `${ORIGIN}/embed/${VIDEO_ID}?${params}`;
  }

  iframe.addEventListener('load', () => {
    if (!iframe.src) return;
    iframe.contentWindow?.postMessage(JSON.stringify({
      event: 'listening',
      id: 'ocean',
      channel: 'widget',
    }), ORIGIN);
  });

  window.addEventListener('message', (event) => {
    if (event.origin !== ORIGIN) return;
    let data = event.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    if (data?.event === 'onReady' || data?.event === 'initialDelivery') {
      ready = true;
      sync();
    }
  });

  return {
    setActive(next) {
      active = next;
      if (next) ensureLoaded();
      sync();
    },
    unlock() {
      unlocked = true;
      sync();
    },
  };
}
