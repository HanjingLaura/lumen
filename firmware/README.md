# Lumen 固件（Windows + Arduino IDE 2.x）

ESP32-S3 本地调试固件：四个按键直接切到场景 1–4，串口打印 `SCENE:n`。本 PR **不含 BLE**。已在 Arduino IDE 2.3.10 + **esp32 by Espressif 3.3.11** 上验证；任意 **3.3.x** 均可。

## 安装 Arduino IDE 与 esp32 开发板包

1. 安装 [Arduino IDE 2.x](https://www.arduino.cc/en/software)。
2. **文件 → 首选项 → 其他开发板管理器地址**，添加官方索引：

   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`

3. **开发板管理器** 搜索 **esp32 by Espressif Systems**，安装 **3.3.11**（已验证）。装不到时，3.3.x 都行。
4. **库管理器** 搜索 **Adafruit SSD1306**，点安装，弹出依赖时选 **INSTALL ALL**（会一并装上 Adafruit GFX 和 Adafruit BusIO）。

### 中国大陆：先设代理

官方索引在大陆常超时。先到 **文件 → 首选项 → 网络** 填代理，**必须完全退出并重新打开 IDE** 后代理才生效。仅改代理、不重启，开发板管理器仍然会失败。

### 中国大陆：代理仍不够时，改用乐鑫镜像

代理设好仍装不上时，再加国内镜像：

1. **文件 → 首选项 → 其他开发板管理器地址**，再添加一行：

   `https://jihulab.com/esp-mirror/espressif/arduino-esp32/-/raw/gh-pages/package_esp32_index_cn.json`

2. 完全重启 IDE。
3. **开发板管理器** 里选它列出的最新 **`-cn`** 版本安装。截至 **2026-10-01**，该索引最新是 **3.3.10-cn**，**没有 3.3.12**。固件在 **3.3.11** 上验证过，**任意 3.3.x**（含 3.3.10-cn）都可以。

## 板子与端口（TTL / CH340）

开发板用 **TTL/CH340 USB 口**（例如 COM7），不要用原生 USB。

1. **工具 → 开发板 → esp32 → ESP32S3 Dev Module**
2. **工具 → USB CDC On Boot → Disabled**（走 TTL 口时必须关掉，否则串口监视器一直空白）
3. **工具 → 端口** 选 CH340/TTL 的 COM 口（设备管理器里一般是 CH340）
4. 打开 `firmware/lumen_app/lumen_app.ino`，点上传

烧录失败：按住板上 **BOOT**，点一下 **RST**，松开 BOOT，再点上传。

## 串口监视器

波特率 **115200**。上传后按一下 **RST**，应看到：

```text
LUMEN READY
SCENE:1
```

## 接线

板子放在面包板**旁边**，用杜邦线连，不要插进面包板。轻触开关用**对角两脚**（相邻两脚是内部短接的）。

| 功能 | ESP32-S3 | 另一端 |
| --- | --- | --- |
| BTN1 → 场景 1 | **G4**（GPIO4），`INPUT_PULLUP` | 对角另一脚 → **GND** |
| BTN2 → 场景 2 | **G5**（GPIO5），`INPUT_PULLUP` | 对角另一脚 → **GND** |
| BTN3 → 场景 3 | **G6**（GPIO6），`INPUT_PULLUP` | 对角另一脚 → **GND** |
| BTN4 → 场景 4 | **G7**（GPIO7），`INPUT_PULLUP` | 对角另一脚 → **GND** |
| OLED SDA | **GPIO8** | SSD1306 SDA |
| OLED SCL | **GPIO9** | SSD1306 SCL |
| OLED 电源 | 3V3 / GND | VCC / GND |

OLED 为 **SSD1306 128×64 I2C**（地址多为 `0x3C`）。没接屏幕时固件照常跑，只走串口。

引脚常量在 `lumen_app/config.h` 顶部：`PIN_BTN1`–`PIN_BTN4`、`PIN_SDA`、`PIN_SCL`。

## 串口协议 `SCENE:n`

每次有效按下（约 30 ms 去抖，下降沿触发一次；按住只算一次）打印一行，格式固定，带换行：

```text
SCENE:1
SCENE:2
SCENE:3
SCENE:4
```

BTNn 直接切到场景 n，并刷新 OLED 占位数字。上电默认场景 1。

后续 BLE 会用 Nordic UART：服务 `6e400001-b5a3-f393-e0a9-e50e24dcca9e`，TX/Notify `6e400003-b5a3-f393-e0a9-e50e24dcca9e`，通知同样是 `SCENE:n` 这一行。本 PR 未实现 BLE。
