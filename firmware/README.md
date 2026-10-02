# Lumen 固件（Windows + Arduino IDE 2.x）

ESP32-S3 本地调试固件：四个按键直接切到场景 1–4，串口打印 `SCENE:n`，并通过 BLE Nordic UART Notify 把同一行发给网页。已在 Arduino IDE 2.3.10 + **esp32 by Espressif 3.3.11** 上验证；任意 **3.3.x** 均可。

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
BLE ADV Lumen-XXXX
LUMEN READY
SCENE:1
```

`XXXX` 是蓝牙 MAC 后两字节的十六进制（例如 `Lumen-01A4`）。连接网页后还会打印 `BLE CONNECTED`，断开后打印 `BLE DISCONNECTED`，然后再次 `BLE ADV Lumen-XXXX`。

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

BLE 使用 Nordic UART：服务 `6e400001-b5a3-f393-e0a9-e50e24dcca9e`，TX/Notify `6e400003-b5a3-f393-e0a9-e50e24dcca9e`，RX/Write `6e400002-b5a3-f393-e0a9-e50e24dcca9e`。通知同样是 `SCENE:n` 这一行（以 `\n` 结尾），和网页解析格式一致。

## M2：用网页测 BLE（Windows 笔记本）

网页会按名称前缀 `Lumen-` 扫描设备，并监听 TX Notify 上的 `SCENE:1`–`SCENE:4`。固件广播名是 `Lumen-XXXX`（MAC 后两字节）。

1. 打开 Windows **蓝牙**（系统托盘或「设置 → 蓝牙和设备」），保持开启。
2. 用 **Chrome 或 Edge**（不要用 Firefox）打开 https://hanjing-laura.vercel.app/lumen/
3. 点右上角 **调试**，再点 **连接 Lumen 按键**（或「连接设备」）。
4. 在弹出的设备列表里选 **Lumen-XXXX**（串口监视器里 `BLE ADV` 那一行就是这个名字）。
5. 网页状态应变为「Lumen 已连接」，串口打印 `BLE CONNECTED`。连接成功后固件会立刻 Notify 当前场景（上电默认 `SCENE:1`）。
6. 按板上 **BTN1–BTN4**：OLED/串口切场景，网页应跟着切到场景 1–4。

### 连不上时

- 确认笔记本蓝牙已打开，且 Chrome/Edge 已允许该站点使用蓝牙。
- 关掉手机 nRF Connect、串口调试助手或其他已经连着这块板的 BLE 软件；Windows 同时只允许一个中央设备连接。
- 必须用 **HTTPS** 页面（上面的 Vercel 地址即可）。`file://` 或普通 http 不能用 Web Bluetooth。
- 只认名字以 `Lumen-` 开头的设备。如果列表是空的：看串口是否已有 `BLE ADV Lumen-XXXX`，板子是否已上电，笔记本是否离板子太远。
- 网页当前**不会**往 RX 写命令；切场只靠板上按键。若用 nRF Connect 向 RX 写入 `SCENE:3` 或 `SCENE:3\n`，固件也会切到场景 3。

## INMP441 麦克风测试（独立草图，主程序未改）

这是单独的测试草图 `firmware/mic_test/mic_test.ino`，只用来确认 I2S 麦克风有没有接对、串口有没有数字在跳。**主程序 `firmware/lumen_app` 没有改动。** 测完麦以后，重新打开并上传 `lumen_app.ino` 即可回到四个场景的固件。

需要 **esp32 by Espressif 3.3.x**（本仓库按 **3.3.11** 验证；装的是国内镜像的 **3.3.10-cn** 也可以）。草图用的是 3.x 的 `ESP_I2S.h` / `I2SClass`，不要用旧的 `driver/i2s.h` 示例去改它。

### INMP441 接线

板子仍放在面包板**旁边**，用杜邦线连。`L/R` 接地表示左声道，必须接地，悬空或接 3V3 会读到空槽，RMS 一直是 0。**VDD 只能接 3V3，不要接 5V。**

| INMP441 | ESP32-S3 | 说明 |
| --- | --- | --- |
| VDD | **3V3** | 不要接 5V |
| GND | **GND** | 与开发板共地 |
| SCK | **GPIO15** | I2S 位时钟 BCLK |
| WS | **GPIO16** | 左右时钟 / 字选择 |
| SD | **GPIO17** | 麦克风数据输出 → 开发板 DIN |
| L/R | **GND** | 选左声道 |

### 用 Arduino IDE 打开并烧录

1. 打开 `firmware/mic_test/mic_test.ino`（不要同时打开 `lumen_app` 再点上传）。
2. **工具 → 开发板 → esp32 → ESP32S3 Dev Module**
3. **工具 → USB CDC On Boot → Disabled**（走 TTL/CH340 口时必须关掉，否则监视器一直空白）
4. **工具 → 端口** 选 CH340/TTL 的 COM 口
5. 点上传。失败时：按住 **BOOT**，点一下 **RST**，松开 BOOT，再点上传。

### 串口监视器（115200）

1. **工具 → 串口监视器**
2. 窗口右下角波特率选 **115200**（务必和草图一致）
3. 上传结束后按一下板上 **RST**

应先看到：

```text
MIC READY
INMP441 I2S 16kHz 32bit MONO LEFT
BCLK GPIO15  WS GPIO16  DIN GPIO17  DOUT unused
L/R GND (left channel)  VDD 3V3
```

然后大约每秒一行状态（`PRINT_RMS_EVERY_MS`，默认 1000，免得把 `CLAP` 顶没），例如：

```text
RMS:37	[##------------------------------]	cnt=16000 min24=-160000 max24=100000 raw=0x00730000
```

每个采样先经过约 **150 Hz 的二阶巴特沃斯高通**（逐点滤波、状态跨块保留），再算 `RMS:` / 拍手；`min24`/`max24` 仍是滤波前的 raw，方便看慢漂。`RMS:数字` 给绘图器用（应只有这一条曲线）。后面括号里的 `#` / `-` 是监视器里看的简易音量条。`cnt` / `min24` / `max24` / `raw` 用的是 `=`，绘图器不应再多出几条线。

- `cnt`：这一行覆盖的完整 32 位采样数。默认约 1 秒，16 kHz 时应约 **16000**。
- `min24` / `max24`：滤波前 raw。安静可漂；真拍手常会削波到大约 ±8e6。
- `raw`：大约每秒一个原始 32 位槽的十六进制。对齐正确时低 8 位常常是 `00`。
- `DBG base=…`：大约每秒一行，安静时背景应大约 **2000–7000**（对应显示 RMS≈37）。被拍手抬到几万说明背景被污染了。
- `CLAP peak=… base=… ratio=… crest=…`：检出一次拍手。`peak`/`base` 是高通之后的 24 位幅度。
- `DOUBLE_CLAP`：两次 `CLAP` 间隔在 150–600 ms。

若一启动就是 `I2S begin FAILED`：I2S 没初始化成功，先核对上面的引脚和 3V3 供电，再按 RST 重试。

若数字一直是 `RMS:0` 或完全不变，监视器每隔几秒会多一行提示，请检查 **SD → GPIO17**、**L/R → GND**、**VDD → 3V3**。若提示 LEFT 全 0、RIGHT 有数据，把 **L/R 接到 GND**（当前板子默认 LEFT，已能出数时不会去探 RIGHT）。

### 串口绘图器（一条 RMS 曲线）

同一 COM 口通常不能同时开监视器和绘图器，先关掉串口监视器。

1. **工具 → 串口绘图器**
2. 波特率选 **115200**
3. 应只看到一条名为 **RMS** 的曲线（格式是 `RMS:123`，Arduino IDE 2.x 绘图器认这种标签）

对着麦说话或拍手，曲线应明显抬高；安静时在低处小幅抖动。

### 数字大概是多少（这块板第 2 轮实机）

先把 32 位槽算术右移 **8** 得到 24 位 PCM，再经 150 Hz 高通，再右移 **6** 做显示 RMS。对齐修好后（`raw` 低字节为 0）。`min24`/`max24` 仍可能漂；高通之后这块板安静 `RMS:` 大约 **35–40**。真拍手会削波（raw 顶满），`RMS:` 可能蹦到一万以上，但应打出 `CLAP`，不要再出现 `DRIFT`。

高通加上之前的数量级（只减均值，供对照）：

| 场景 | 100 ms 显示 RMS（当时还没有 150 Hz 高通） |
| --- | --- |
| 安静房间、别碰麦 | 大约 **140–650**，多数时候 **200–450** |
| 真拍手（几毫秒脉冲） | 大约 **1100–1600**，只有本底的 2–5 倍——100 ms 平均把尖峰抹平了 |
| 键盘敲击 / 碰桌子 | 大约 **1000–2500**，和拍手的 100 ms RMS 分不开 |

所以**不要用 `RMS:` 当拍手**。草图另外用 10 ms 峰值、自适应背景、波峰因数和衰减来打 `CLAP`。

第一版（按 4 字节超时读）安静 RMS 大约 1000 且乱跳，是 32 位对齐错了。对齐正常后若 `cnt` 仍远小于 1600、或 `raw` 低字节不是 `00`，再查接线。

### 怎么测拍手（Arduino 串口监视器 115200）

门槛都在 `mic_test.ino` 文件开头，带中文注释。默认：峰值 ≥ 背景 × **20**；波峰因数 ≥ **3**（削波到 `CLIP_LEVEL_24`≈7000000 时不卡 crest）；之后 **50 ms** 要掉回峰值的 **50%** 以下；确认后 **120 ms** 不应期，再往后到 **300 ms** 内新候选须 ≥ 上一拍峰值的 **50%**（压回声/尾巴，真双击差不多一样响还能过）。`DOUBLE_CLAP` 仍是间隔 **150–600 ms**。背景只吃「小于 3 倍当前背景」的 10 ms 峰值，响亮事件后 **150 ms** 不更新。

1. 上传后安静坐 **5 秒**，让 `DBG base=` 稳住。这时不应出现 `CLAP`。
2. **一下一下拍**，每下间隔大约 **2 秒**。每拍应**只有一行** `CLAP`（后面 85–140 ms 的尾巴不应再出第二行）。这块板真拍手大约 `peak` 八九百万、`ratio` 一千左右。
3. **双击**（两下间隔大约 0.2–0.5 秒，两下都要拍响）：应先看到两行 `CLAP`，其中第二次后面多一行 `DOUBLE_CLAP`。
4. **敲键盘约 3 秒**（普通打字，别砸桌子）：理想情况**没有** `CLAP`。现在要过「20 倍背景」，轻敲更难误触发。
5. 对着麦连续说话或放音乐：能量掉不下去，不应出 `CLAP`。

说话/音乐靠「很快衰减」拒绝；软键盘靠「必须比背景高很多」拒绝。真拍手在这块板会削波（`min24`/`max24` 顶到 ±8e6），所以不再用 raw 均值跳变当 DRIFT（那会误杀拍手）。`RMS:` 每秒一行，以 `CLAP` 行为准。
