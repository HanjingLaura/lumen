#pragma once

#include <stdint.h>

// 拍手检测（从 firmware/mic_test/mic_test.ino @ 62addd5 原样移植检测行为）。
// 设为 1 打印即时 CLAP / 周期性 DBG、RMS；默认关闭以免刷屏。
#ifndef CLAP_DEBUG
#define CLAP_DEBUG 0
#endif

// 初始化 INMP441 I2S（SCK G15 / WS G16 / SD G17）。失败返回 false，按键/BLE 仍可用。
bool clapBegin();

// 非阻塞：每次最多读约 10 ms 的 I2S，不 delay。
// 一串拍手结束且 n=1..4 时返回 n（并已打印 CLAPS:n）；CLAPS_DROP 或无事件返回 0。
uint8_t clapPoll();
