# Lumen 最小测试固件（macOS）

给第一次接触硬件的人：把按钮接到 ESP32-S3，烧录后在串口看到 `SCENE:1`。不需要 BLE / WiFi。

## 接线

- 按钮一只脚接到板子的 **G4（GPIO4）**
- 另一只脚接到 **GND**
- 固件已打开内部上拉，按下为 LOW

## Arduino IDE 2 准备

1. 安装 [Arduino IDE 2](https://www.arduino.cc/en/software)
2. **Settings → Additional boards manager URLs**，添加：

   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`

3. **Boards Manager** 搜索并安装 **esp32 by Espressif**

## 烧录

1. 用数据线把开发板接到 Mac（充电线常常没有数据）
2. **Tools → Board** 选 **ESP32S3 Dev Module**
3. **Tools → USB CDC On Boot: Enabled**（很多 S3 板必须开，否则串口没字）
4. **Tools → Port** 选 `/dev/cu.usbmodem*` 或 `/dev/cu.usbserial*`
5. 打开本目录的 `lumen_min_test.ino`，点 Upload

上传失败时：按住 **BOOT**，点一下 **RST**，松开 **BOOT**，再点 Upload。上传结束后如仍无串口，再点一次 **RST**。

## 看结果

打开 **Serial Monitor**，波特率 **115200**。应先看到一行：

```text
LUMEN TEST READY
```

每按一次按钮再出现一行 `SCENE:1`。按住只打印一次；松开后再按才会再打印。

## 常见问题

- **没有端口**：换一根能传数据的 USB 线，或换板上另一个 USB 口（有的板标 USB / UART）
- **乱码**：确认串口监视器是 115200
- **什么都不打印**：检查 **USB CDC On Boot: Enabled**，烧录后再按一次 RST
