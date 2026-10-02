# Lumen 固件入门

完整说明（Windows + Arduino IDE 2.x、中国镜像、四按键/LED/麦克风接线）见上一级 [firmware/README.md](../README.md)。

走 **TTL/CH340 COM 口** 时：**工具 → USB CDC On Boot → Disabled**，否则串口监视器空白。波特率 115200，按 RST 应看到 `BLE ADV Lumen-XXXX`、`MIC INMP441 …`、`LUMEN READY` 然后 `SCENE:1`。网页联调见上一级 README 的 **M2** 小节。

## 拍手切场（烧录后怎么测）

麦克风：INMP441 **SCK→G15**、**WS→G16**、**SD→G17**、**L/R→GND**、VDD **3V3**（不要 5V）。

1. 烧录本目录 `lumen_app.ino`，打开串口监视器 115200，按 RST。
2. 先安静约 2 秒。然后拍 **1** 下，等约 2 秒；再连拍 **2** 下（同一组要快，间隔大约 0.2–0.5 秒），再等约 2 秒；同样再测 **3** 下、**4** 下。组与组之间隔开大约 2 秒。
3. 每一组结束应先看到 `CLAPS:n`，紧接着 `SCENE:n`。对应那颗场景灯亮、其余灭，OLED 数字变成 n。连上 https://hanjing-laura.vercel.app/lumen/ 后，网页也应切到场景 n（BLE Notify 同样是 `SCENE:n`）。
4. 拍 5 下或更多会打印 `CLAPS_DROP n=`，**不切场**。
5. 再按 **BTN1–BTN4**：场景/LED/网页必须仍按按键切，和拍手互不卡住。BLE 用 nRF Connect 往 RX 写 `SCENE:n` 也照常。

连拍要快、组与组要隔开；说话、敲键盘不应出 `CLAPS:`。串口默认不刷 RMS/DBG；要看细节可在 `clap_detector.h` 把 `CLAP_DEBUG` 改成 `1`。
