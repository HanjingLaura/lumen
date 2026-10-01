// Lumen local debug framework (ESP32-S3). No BLE / no WiFi.
// Arduino IDE: Board "ESP32S3 Dev Module".
// Using the TTL/CH340 USB port: Tools > USB CDC On Boot: Disabled.

#include "config.h"
#include "hw_display.h"
#include "scene.h"

static uint8_t sceneIndex = 0;

struct Button {
  const uint8_t pin;
  const uint8_t scene;  // 0-based index into SCENES[]
  int lastRaw;
  int stable;
  uint32_t lastEdgeMs;
};

// BTN1–BTN4 on GPIO 4, 5, 6, 7. Named pin constants live in config.h.
static Button buttons[] = {
    {PIN_BTN1, 0, HIGH, HIGH, 0},
    {PIN_BTN2, 1, HIGH, HIGH, 0},
    {PIN_BTN3, 2, HIGH, HIGH, 0},
    {PIN_BTN4, 3, HIGH, HIGH, 0},
};

static void enterScene(uint8_t index) {
  sceneIndex = index;
  const Scene &s = SCENES[sceneIndex];
  Serial.print("SCENE:");
  Serial.println(s.id);
  // TODO: BLE UART notify of "SCENE:n" (Nordic UART UUIDs:
  // service 6e400001-b5a3-f393-e0a9-e50e24dcca9e,
  // TX/notify 6e400003-b5a3-f393-e0a9-e50e24dcca9e).
  s.enter();
}

// Non-blocking ~30 ms debounce. Hold counts as one press (falling edge only).
static void pollButtons() {
  const uint32_t now = millis();
  for (uint8_t i = 0; i < 4; i++) {
    Button &b = buttons[i];
    const int raw = digitalRead(b.pin);
    if (raw != b.lastRaw) {
      b.lastRaw = raw;
      b.lastEdgeMs = now;
    }
    if ((now - b.lastEdgeMs) < DEBOUNCE_MS || raw == b.stable) continue;
    b.stable = raw;
    if (b.stable == LOW) enterScene(b.scene);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BTN1, INPUT_PULLUP);
  pinMode(PIN_BTN2, INPUT_PULLUP);
  pinMode(PIN_BTN3, INPUT_PULLUP);
  pinMode(PIN_BTN4, INPUT_PULLUP);

  displayBegin();  // if no OLED, serial-only still works

  Serial.println("LUMEN READY");
  enterScene(0);  // boot scene 1
}

void loop() {
  pollButtons();
  SCENES[sceneIndex].loop();
}
