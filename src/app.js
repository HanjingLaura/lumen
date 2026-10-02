import { mountRain } from './rain/stage.js';
import { LumenBluetooth } from './bluetooth.js';
import { loadButtonMap, saveButtonMap, sceneIdForButton } from './buttonMap.js';
import { SCENES, SCENES_BY_ID } from './scenes.js';

const $ = (selector) => document.querySelector(selector);
const state = { sceneId: 1, buttonId: 1, source: 'Mock', buttonMap: loadButtonMap() };
const rain = mountRain($('#sceneCanvas'));

function announce(message) {
  $('#toast').textContent = message;
}

function activateScene(sceneId, source = 'Mock', buttonId = null) {
  const scene = SCENES_BY_ID[Number(sceneId)];
  if (!scene) return;
  state.sceneId = scene.id;
  state.source = source;
  state.buttonId = buttonId;
  $('#sceneMark').textContent = String(scene.id);
  $('#scene').dataset.scene = String(scene.id);
  rain?.setActive(scene.id === 1);
  document.querySelectorAll('.key').forEach((key) => key.classList.toggle('active', Number(key.dataset.button) === buttonId));
}

function renderKeys() {
  const keyGrid = $('#keyGrid');
  keyGrid.innerHTML = [1, 2, 3, 4].map((buttonId) => {
    const sceneId = sceneIdForButton(state.buttonMap, buttonId);
    const active = state.buttonId === buttonId ? ' active' : '';
    return `<button class="key${active}" data-button="${buttonId}" type="button" aria-label="按键 ${buttonId}，场景 ${sceneId}">${buttonId}</button>`;
  }).join('');
  keyGrid.querySelectorAll('.key').forEach((button) => button.addEventListener('click', () => {
    const buttonId = Number(button.dataset.button);
    activateScene(sceneIdForButton(state.buttonMap, buttonId), 'Mock', buttonId);
    announce(`按键 ${buttonId} → 场景 ${state.sceneId}`);
  }));
}

function renderMapping() {
  $('#mappingGrid').innerHTML = [1, 2, 3, 4].map((buttonId) => `<label class="mapping-cell"><span>按键 ${buttonId}</span><select data-map-button="${buttonId}" aria-label="按键 ${buttonId} 映射">
    ${SCENES.map((scene) => `<option value="${scene.id}" ${scene.id === sceneIdForButton(state.buttonMap, buttonId) ? 'selected' : ''}>${scene.id}</option>`).join('')}
  </select></label>`).join('');
  $('#mappingGrid').querySelectorAll('select').forEach((select) => select.addEventListener('change', () => {
    state.buttonMap[select.dataset.mapButton] = Number(select.value);
    saveButtonMap(state.buttonMap);
    renderKeys();
    announce(`按键 ${select.dataset.mapButton} 已映射到场景 ${select.value}`);
  }));
}

function unlockRain() {
  rain?.unlock();
}
window.addEventListener('pointerdown', unlockRain, { once: true });
document.addEventListener('keydown', (event) => {
  unlockRain();
  if (event.target instanceof HTMLElement && event.target.matches('input, select, textarea')) return;
  const buttonId = Number(event.key);
  if (buttonId >= 1 && buttonId <= 4) {
    event.preventDefault();
    activateScene(sceneIdForButton(state.buttonMap, buttonId), 'Mock', buttonId);
    announce(`按键 ${buttonId} → 场景 ${state.sceneId}`);
    renderKeys();
  }
});

$('#benchEntry').addEventListener('click', () => $('#bench').showModal());
$('#benchClose').addEventListener('click', () => $('#bench').close());

$('#resetMapButton').addEventListener('click', () => {
  state.buttonMap = { 1: 1, 2: 2, 3: 3, 4: 4 };
  saveButtonMap(state.buttonMap);
  renderMapping();
  renderKeys();
  announce('已恢复默认映射');
});

const bluetooth = new LumenBluetooth({
  onScene: (sceneId) => {
    activateScene(sceneId, 'BLE', null);
    renderKeys();
    announce(`BLE → 场景 ${sceneId}`);
  },
  onStatus: (message, status) => {
    $('#connectionLabel').textContent = status === 'connected' ? 'Lumen 已连接' : status === 'pending' ? '连接中…' : 'Mock 模式';
    $('#connectionDot').classList.toggle('connected', status === 'connected');
    $('#bluetoothNote').textContent = message;
  },
});

$('#connectButton').addEventListener('click', async () => {
  try {
    await bluetooth.connect();
  } catch (error) {
    if (error.name !== 'NotFoundError') announce(`蓝牙连接失败：${error.message}`);
    bluetooth.onStatus('没有连接设备，继续使用 Mock 按键。', 'fallback');
  }
});

renderMapping();
renderKeys();
activateScene(1, 'Mock', 1);
if (!bluetooth.supported) bluetooth.onStatus('当前页面不是安全上下文，继续使用 Mock 按键。', 'fallback');
