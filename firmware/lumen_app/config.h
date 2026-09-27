#pragma once

// Debug button: GPIO4 (G4) INPUT_PULLUP, other leg to GND.
#define PIN_BTN 4
#define DEBOUNCE_MS 30

// ASSUMPTION: this repo does not specify a display (firmware/README.md
// only describes BLE UART SCENE lines). Using the common ESP32-S3 choice:
// 128x64 SSD1306 I2C OLED via Adafruit_SSD1306.
// ESP32-S3 DevKit default Wire pins; change if your module differs.
#define PIN_SDA 8
#define PIN_SCL 9
#define OLED_W 128
#define OLED_H 64
#define OLED_ADDR 0x3C
