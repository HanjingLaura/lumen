import { SCENES_BY_ID } from './scenes.js';

const STORAGE_KEY = 'lumen.buttonMap.v1';
const DEFAULT_MAP = { 1: 1, 2: 2, 3: 3, 4: 4 };

export function loadButtonMap() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && [1, 2, 3, 4].every((button) => SCENES_BY_ID[Number(saved[button])])) {
      return { ...DEFAULT_MAP, ...saved };
    }
  } catch {
    // 清理损坏的本地设置，回到可用的默认映射。
  }
  return { ...DEFAULT_MAP };
}

export function saveButtonMap(buttonMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buttonMap));
}

export function sceneIdForButton(buttonMap, buttonId) {
  return Number(buttonMap[buttonId]) || DEFAULT_MAP[buttonId];
}

export const defaultButtonMap = Object.freeze({ ...DEFAULT_MAP });
