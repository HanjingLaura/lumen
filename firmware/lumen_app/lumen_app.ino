// Lumen local debug framework (ESP32-S3). No BLE / no WiFi.
// Arduino IDE: Board "ESP32S3 Dev Module", USB CDC On Boot: Enabled.

#include "config.h"
#include "hw_display.h"
#include "scene.h"

static uint8_t sceneIndex = 0;
static int lastRaw = HIGH;
static int stable = HIGH;
static uint32_t lastEdgeMs = 0;

static void enterScene(uint8_t index) {
  sceneIndex = index;
  const Scene &s = SCENES[sceneIndex];
  Serial.print("SCENE:");
  Serial.println(s.id);
  s.enter();
}

static void nextScene() {
  enterScene((sceneIndex + 1) % SCENE_COUNT);
}

// Non-blocking ~30 ms debounce. Hold counts as one press (falling edge only).
static void pollButton() {
  const int raw = digitalRead(PIN_BTN);
  const uint32_t now = millis();
  if (raw != lastRaw) {
    lastRaw = raw;
    lastEdgeMs = now;
  }
  if ((now - lastEdgeMs) < DEBOUNCE_MS || raw == stable) return;
  stable = raw;
  if (stable == LOW) nextScene();
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BTN, INPUT_PULLUP);

  displayBegin();  // if no OLED, serial-only still works

  Serial.println("LUMEN READY");
  enterScene(0);  // boot scene 1
}

void loop() {
  pollButton();
  SCENES[sceneIndex].loop();
}
