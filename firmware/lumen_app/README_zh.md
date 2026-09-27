# Lumen 固件入门（macOS + Arduino IDE 2）

这是本地调试框架：GPIO4 按键切 4 个占位场景。没有 BLE / WiFi。

Arduino IDE 必须打开 **USB CDC On Boot: Enabled**，否则串口监视器看不到输出。

## 接线

| 功能 | ESP32-S3 引脚 | 另一端 |
| --- | --- | --- |
| 调试按键 | **G4**（GPIO4），固件内部 `INPUT_PULLUP` | 按键另一脚接 **GND** |
| OLED SDA | **GPIO8**（`PIN_SDA`，可在 `config.h` 改） | SSD1306 SDA |
| OLED SCL | **GPIO9**（`PIN_SCL`，可在 `config.h` 改） | SSD1306 SCL |
| OLED 电源 | 3V3 与 GND | VCC / GND |

仓库没有指定屏幕。当前按常见 ESP32-S3 方案假设为 **128×64 SSD1306 I2C OLED**。没有屏幕时固件仍可通过串口工作。

## 安装 Arduino IDE 2 与开发板

1. 安装 [Arduino IDE 2](https://www.arduino.cc/en/software)。
2. **Arduino IDE → Settings → Additional boards manager URLs**，添加：

   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`

3. **Boards Manager** 搜索并安装 **esp32 by Espressif Systems**。
4. **Library Manager** 安装：
   - Adafruit SSD1306
   - Adafruit GFX Library
   - Adafruit BusIO（通常会自动依赖）

## 板子与烧录设置

1. **Tools → Board → esp32 → ESP32S3 Dev Module**
2. **Tools → USB CDC On Boot → Enabled**
3. 用数据线连上开发板，**Tools → Port** 选 `/dev/cu.usbmodem*`（名称因板子而异）
4. 打开本目录的 `lumen_app.ino`，点 **Upload**

烧录失败时：按住板上 **BOOT**，点一下 **RST**（或 EN），松开 BOOT，再点 Upload。

## 串口监视器

- 波特率 **115200**
- 上电后应看到：

```text
LUMEN READY
SCENE:1
```

- 每按一次 G4 按键（按住只算一次）：

```text
SCENE:2
SCENE:3
SCENE:4
SCENE:1
```

有 OLED 时，左上角会显示对应数字 `1`–`4`。

## 常见问题

| 现象 | 可尝试 |
| --- | --- |
| 监视器空白 / 端口消失 | 确认 USB CDC On Boot 为 Enabled，重新插拔 USB，再选 `/dev/cu.usbmodem*` |
| 找不到端口 | 换数据线或 USB 口；安装 CH340 / CP210x 驱动（视模块而定） |
| 上传超时 | BOOT + RST 进下载模式后再烧 |
| 按键没反应 | G4 接按键、另一脚接 GND；不要外加上拉（已用内部上拉） |
| 屏幕不亮 | 查 3V3/GND/SDA/SCL；I2C 地址多为 `0x3C`；没有屏也不影响串口切场 |
