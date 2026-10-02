#pragma once

// Four scene buttons: INPUT_PULLUP, other leg to GND (press = LOW).
#define PIN_BTN1 4  // GPIO4 / G4 → scene 1
#define PIN_BTN2 5  // GPIO5 / G5 → scene 2
#define PIN_BTN3 6  // GPIO6 / G6 → scene 3
#define PIN_BTN4 7  // GPIO7 / G7 → scene 4
#define DEBOUNCE_MS 30

// Four scene LEDs: anode via 220 Ω to GPIO, cathode to GND. Active HIGH.
#define PIN_LED1 10  // GPIO10 / G10 → scene 1
#define PIN_LED2 11  // GPIO11 / G11 → scene 2
#define PIN_LED3 12  // GPIO12 / G12 → scene 3
#define PIN_LED4 13  // GPIO13 / G13 → scene 4
#define LED_PWM_HZ 5000
#define LED_PWM_BITS 8

// 128x64 SSD1306 I2C OLED. Firmware still runs if the panel is missing.
#define PIN_SDA 8
#define PIN_SCL 9
#define OLED_W 128
#define OLED_H 64
#define OLED_ADDR 0x3C
