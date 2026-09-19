import { LumenBluetooth } from './bluetooth.js';
import { loadButtonMap, saveButtonMap, sceneIdForButton } from './buttonMap.js';
import { SCENES, SCENES_BY_ID } from './scenes.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#sceneCanvas');
const context = canvas.getContext('2d');
const state = { sceneId: 1, buttonId: 1, source: 'Mock', buttonMap: loadButtonMap(), startedAt: performance.now() };
let toastTimer;

function currentScene() { return SCENES_BY_ID[state.sceneId] || SCENES[0]; }

function announce(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function activateScene(sceneId, source = 'Mock', buttonId = null) {
  const scene = SCENES_BY_ID[Number(sceneId)];
  if (!scene) return;
  state.sceneId = scene.id;
  state.source = source;
  state.buttonId = buttonId;
  state.startedAt = performance.now();
  $('#sceneKicker').textContent = `${scene.kicker}`;
  $('#sceneTitle').textContent = scene.title;
  $('#sceneDescription').textContent = scene.description;
  $('#sceneSource').textContent = `${buttonId ? `按键 ${buttonId}` : 'BLE Notify'} · ${source}`;
  $('#sceneCard').style.setProperty('--accent', scene.accent);
  document.querySelectorAll('.key').forEach((key) => key.classList.toggle('active', Number(key.dataset.button) === buttonId));
  document.documentElement.style.setProperty('--accent', scene.accent);
}

function renderKeys() {
  const keyGrid = $('#keyGrid');
  keyGrid.innerHTML = [1, 2, 3, 4].map((buttonId) => {
    const scene = SCENES_BY_ID[sceneIdForButton(state.buttonMap, buttonId)];
    return `<button class="key${state.buttonId === buttonId ? ' active' : ''}" data-button="${buttonId}" type="button" aria-label="按键 ${buttonId}，${scene.title}">
      <span class="key-number">${buttonId}</span><span class="key-name">${scene.title}</span><span class="key-slug">${scene.slug} · scene ${scene.id}</span>
    </button>`;
  }).join('');
  keyGrid.querySelectorAll('.key').forEach((button) => button.addEventListener('click', () => {
    const buttonId = Number(button.dataset.button);
    activateScene(sceneIdForButton(state.buttonMap, buttonId), 'Mock', buttonId);
    announce(`按键 ${buttonId} → ${currentScene().title}`);
  }));
}

function renderMapping() {
  $('#mappingGrid').innerHTML = [1, 2, 3, 4].map((buttonId) => `<label class="mapping-cell"><span>BUTTON ${buttonId}</span><select data-map-button="${buttonId}" aria-label="按键 ${buttonId} 映射">
    ${SCENES.map((scene) => `<option value="${scene.id}" ${scene.id === sceneIdForButton(state.buttonMap, buttonId) ? 'selected' : ''}>${scene.id} · ${scene.title}</option>`).join('')}
  </select></label>`).join('');
  $('#mappingGrid').querySelectorAll('select').forEach((select) => select.addEventListener('change', () => {
    state.buttonMap[select.dataset.mapButton] = Number(select.value);
    saveButtonMap(state.buttonMap);
    renderKeys();
    announce(`按键 ${select.dataset.mapButton} 的映射已更新`);
  }));
}

function resizeCanvas() {
  const scale = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  canvas.width = Math.floor(bounds.width * scale);
  canvas.height = Math.floor(bounds.height * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);
}

function drawScene(time) {
  const { width, height } = canvas.getBoundingClientRect();
  const t = (time - state.startedAt) / 1000;
  const scene = currentScene();
  const gradient = context.createLinearGradient(0, 0, width, height);
  const palettes = {
    rain: ['#102338', '#2a6076', '#071018'], drums: ['#231b31', '#784a52', '#120f1d'],
    ember: ['#351e26', '#a24d42', '#180f1b'], tide: ['#171c3c', '#3d3c76', '#0c1128'],
  };
  const colors = palettes[scene.visual];
  gradient.addColorStop(0, colors[0]); gradient.addColorStop(.5, colors[1]); gradient.addColorStop(1, colors[2]);
  context.fillStyle = gradient; context.fillRect(0, 0, width, height);

  if (scene.visual === 'rain') {
    context.lineWidth = 1;
    for (let i = 0; i < 120; i += 1) {
      const x = (i * 83 + t * (15 + (i % 5) * 4)) % (width + 50) - 25;
      const y = (i * 47 + t * 90 * (1 + (i % 3) / 5)) % (height + 80) - 80;
      context.strokeStyle = `rgba(166, 226, 245, ${.13 + (i % 4) * .04})`;
      context.beginPath(); context.moveTo(x, y); context.lineTo(x - 6, y + 24 + (i % 4) * 4); context.stroke();
    }
    for (let i = 0; i < 5; i += 1) { const x = width * (.16 + i * .2); const y = height * (.78 + (i % 2) * .05); context.strokeStyle = 'rgba(155,231,255,.18)'; context.beginPath(); context.ellipse(x, y, 35 + ((t * 18 + i * 15) % 30), 8, 0, 0, Math.PI * 2); context.stroke(); }
  } else if (scene.visual === 'drums') {
    const cx = width * .56; const cy = height * .38; const beat = (Math.sin(t * Math.PI * 2 * 1.15) + 1) / 2;
    for (let i = 0; i < 7; i += 1) { const radius = 35 + i * 34 + beat * 18; context.strokeStyle = `rgba(255,184,108,${.25 - i * .025})`; context.lineWidth = 1.5; context.beginPath(); context.arc(cx, cy, radius, 0, Math.PI * 2); context.stroke(); }
    for (let i = 0; i < 26; i += 1) { const angle = (i / 26) * Math.PI * 2 + t * .15; const length = 45 + ((i * 17) % 60) + beat * 25; context.strokeStyle = 'rgba(255,214,165,.25)'; context.beginPath(); context.moveTo(cx + Math.cos(angle) * 36, cy + Math.sin(angle) * 36); context.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length); context.stroke(); }
  } else if (scene.visual === 'ember') {
    for (let i = 0; i < 42; i += 1) { const x = (i * 71 + Math.sin(t * .7 + i) * 35) % width; const y = (height - ((i * 39 + t * (16 + i % 5 * 5)) % (height + 80))); const size = 1 + i % 4; context.fillStyle = `rgba(255,${120 + i % 70},${90 + i % 60},${.18 + (i % 5) * .08})`; context.shadowBlur = 16; context.shadowColor = '#ff8e70'; context.beginPath(); context.arc(x, y, size, 0, Math.PI * 2); context.fill(); }
    context.shadowBlur = 0;
  } else {
    for (let wave = 0; wave < 5; wave += 1) { context.beginPath(); for (let x = 0; x <= width; x += 8) { const y = height * (.57 + wave * .08) + Math.sin(x * .012 + t * (.6 + wave * .08) + wave) * (14 + wave * 3); if (x === 0) context.moveTo(x, y); else context.lineTo(x, y); } context.strokeStyle = `rgba(181,167,255,${.26 - wave * .03})`; context.lineWidth = 2; context.stroke(); }
  }
  requestAnimationFrame(drawScene);
}

window.addEventListener('resize', resizeCanvas);
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLElement && event.target.matches('input, select, textarea')) return;
  const buttonId = Number(event.key);
  if (buttonId >= 1 && buttonId <= 4) {
    event.preventDefault();
    activateScene(sceneIdForButton(state.buttonMap, buttonId), 'Mock', buttonId);
    announce(`按键 ${buttonId} → ${currentScene().title}`);
    renderKeys();
  }
});

$('#resetMapButton').addEventListener('click', () => {
  state.buttonMap = { 1: 1, 2: 2, 3: 3, 4: 4 };
  saveButtonMap(state.buttonMap); renderMapping(); renderKeys(); announce('已恢复默认映射');
});

const bluetooth = new LumenBluetooth({
  onScene: (sceneId) => { activateScene(sceneId, 'BLE', null); renderKeys(); announce(`BLE → 场景 ${sceneId}`); },
  onStatus: (message, status) => { $('#connectionLabel').textContent = status === 'connected' ? 'Lumen 已连接' : status === 'pending' ? '连接中…' : 'Mock 模式'; $('#connectionDot').classList.toggle('connected', status === 'connected'); $('#bluetoothNote').textContent = message; },
});
$('#connectButton').addEventListener('click', async () => {
  try { await bluetooth.connect(); } catch (error) { if (error.name !== 'NotFoundError') announce(`蓝牙连接失败：${error.message}`); bluetooth.onStatus('没有连接设备，继续使用 Mock 按键。', 'fallback'); }
});

renderMapping(); renderKeys(); resizeCanvas(); activateScene(1, 'Mock', 1); requestAnimationFrame(drawScene);
if (!bluetooth.supported) bluetooth.onStatus('当前页面不是安全上下文，继续使用 Mock 按键。', 'fallback');
