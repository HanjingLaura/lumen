# Lumen

Lumen 是一个可配置的氛围场景控制器：浏览器负责播放和渲染场景，实体按键通过 BLE 发送一个很小的场景编号来切场。当前仓库是可运行的软件骨架，适合先用 Mock 按键迭代，再接入硬件。

## 安装与运行

项目没有运行时依赖，要求 Node.js 18+。

```bash
npm run dev
# 打开 http://localhost:4173
```

`npm run check` 会检查 Node 与前端模块的语法。部署静态文件时，`index.html`、`styles.css` 和 `src/` 可以交给任意静态服务器；Web Bluetooth 需要 HTTPS 或 `localhost` 这样的安全上下文。

## 当前功能

- `src/scenes.js` 提供 4 个数据化场景：雨幕白噪音、低频鼓点、余温壁炉、潮汐呼吸。Canvas 渲染器目前是轻量占位，场景配置可继续扩展。
- 页面底部的 **BUTTON MAP** 是可编辑的 `buttonMap`。默认映射为 `1 → scene 1`、`2 → scene 2`、`3 → scene 3`、`4 → scene 4`，改动保存在浏览器 `localStorage`。
- 四个 Mock 按键和键盘 `1`–`4` 都会触发切场，方便没有硬件时开发。
- 点击“连接 Lumen 按键”会按 `Lumen-` 名称前缀扫描设备。浏览器不支持 Web Bluetooth、页面不是安全上下文、设备断开或用户取消选择时，页面会保留 Mock 模式并给出提示。

## BLE 协议

硬件发送端使用 BLE UART 风格的 Notify 特征。通知内容是 ASCII 文本行，每行以换行结束：

```text
SCENE:<id>\n
```

其中 `<id>` 只能是 `1`、`2`、`3`、`4`。例如 `SCENE:2\n` 会切换到 scene 2。前端按行缓冲数据，因此一个通知可以包含半行或多行；无效行会被忽略。

- 设备名必须以 `Lumen-` 开头，例如 `Lumen-01A4`。
- 当前前端使用 Nordic UART Service UUID `6e400001-b5a3-f393-e0a9-e50e24dcca9e`，监听 TX/Notify 特征 `6e400003-b5a3-f393-e0a9-e50e24dcca9e`。
- BLE 只负责发送场景编号。场景内容、映射和视觉效果都由前端维护，固件不需要知道具体场景名称。

## 硬件边界

固件实现留给 Harry，仓库只保留 [`firmware/README.md`](firmware/README.md) 协议说明，不包含完整 ESP32 固件。固件只需完成按键去抖、BLE 广播/连接和 Notify 行发送；前端不假设 GPIO、供电或电池方案。

## 中文说明

这是一个干净的新仓，未迁移 `goblin-candle-summon` 的剧照、粒子召唤演出状态机或其他旧资产。先把“按键 → 编号 → 场景”的链路跑通，再逐步替换更丰富的音频和视觉实现。
