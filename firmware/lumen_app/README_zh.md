# Lumen 固件入门

完整说明（Windows + Arduino IDE 2.x、中国镜像、四按键接线）见上一级 [firmware/README.md](../README.md)。

走 **TTL/CH340 COM 口** 时：**工具 → USB CDC On Boot → Disabled**，否则串口监视器空白。波特率 115200，按 RST 应看到 `LUMEN READY` 然后 `SCENE:1`。
