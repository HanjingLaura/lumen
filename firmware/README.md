# Lumen 固件边界（预留）

这里暂不放 ESP32 完整固件。硬件端只需要把实体按键转换为 BLE UART 风格的 Notify 消息：

```text
SCENE:1\n
SCENE:2\n
SCENE:3\n
SCENE:4\n
```

设备名使用 `Lumen-` 前缀。推荐沿用 Nordic UART Service：服务 `6e400001-b5a3-f393-e0a9-e50e24dcca9e`，Notify 特征 `6e400003-b5a3-f393-e0a9-e50e24dcca9e`。每次有效按键发送一整行 ASCII；固件不需要传输场景名称、颜色或音频数据。

按键去抖、连接重试和低功耗策略属于固件实现细节，由硬件侧决定。前端会缓存分片通知、按 `\n` 拆行，并忽略不符合 `SCENE:1`–`SCENE:4` 的内容。
