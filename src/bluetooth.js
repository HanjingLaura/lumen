export const LUMEN_DEVICE_PREFIX = 'Lumen-';
export const LUMEN_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const LUMEN_NOTIFY_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

/** 将一行协议文本解析为场景编号；无效行会被忽略。 */
export function parseSceneLine(line) {
  const match = /^SCENE:([1-4])$/.exec(line.trim());
  return match ? Number(match[1]) : null;
}

export class LumenBluetooth {
  constructor({ onScene, onStatus }) {
    this.onScene = onScene;
    this.onStatus = onStatus;
    this.device = null;
    this.characteristic = null;
    this.buffer = '';
    this.decoder = new TextDecoder();
    this.handleValue = this.handleValue.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
  }

  get supported() {
    return typeof window !== 'undefined' && window.isSecureContext && 'bluetooth' in navigator;
  }

  async connect() {
    if (!this.supported) {
      this.onStatus('当前环境无法使用 Web Bluetooth，继续使用 Mock 按键。', 'fallback');
      return false;
    }

    this.onStatus('正在等待选择 Lumen 设备…', 'pending');
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: LUMEN_DEVICE_PREFIX }],
      optionalServices: [LUMEN_SERVICE_UUID],
    });
    this.device.addEventListener('gattserverdisconnected', this.handleDisconnect);
    this.onStatus(`已选择 ${this.device.name || 'Lumen 设备'}，正在连接…`, 'pending');
    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService(LUMEN_SERVICE_UUID);
    this.characteristic = await service.getCharacteristic(LUMEN_NOTIFY_UUID);
    await this.characteristic.startNotifications();
    this.characteristic.addEventListener('characteristicvaluechanged', this.handleValue);
    this.onStatus(`已连接 ${this.device.name || 'Lumen 设备'} · 等待按键`, 'connected');
    return true;
  }

  handleValue(event) {
    this.buffer += this.decoder.decode(event.target.value, { stream: true });
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || '';
    for (const line of lines) {
      const sceneId = parseSceneLine(line);
      if (sceneId !== null) this.onScene(sceneId);
    }
  }

  handleDisconnect() {
    this.characteristic = null;
    this.onStatus('设备已断开，仍可用 Mock 按键继续预览。', 'fallback');
  }

  disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
  }
}
