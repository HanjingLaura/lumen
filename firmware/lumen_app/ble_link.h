#pragma once

#include <stdint.h>

// Nordic UART Service (NUS) — must match the live page and src/bluetooth.js:
//   service  6e400001-b5a3-f393-e0a9-e50e24dcca9e
//   TX/notify 6e400003-b5a3-f393-e0a9-e50e24dcca9e
//   RX/write  6e400002-b5a3-f393-e0a9-e50e24dcca9e
void bleBegin();
void blePoll();
void bleNotifyScene(uint8_t sceneId);  // 1–4; sends "SCENE:n\n" when a client is subscribed
bool bleTakeRxScene(uint8_t *sceneId); // true if NUS RX queued a SCENE:1–4 command
