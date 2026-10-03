#include "config.h"
#include "hw_display.h"
#include "hw_leds.h"
#include "scene.h"

#include <Arduino.h>

// Drum beat: ~2 Hz, sharp attack then a fast decay. Other LEDs stay off.
static const uint32_t S2_BEAT_MS = 500;
static const uint32_t S2_ATTACK_MS = 22;
static const uint32_t S2_DECAY_MS = 170;
static const uint8_t S2_PEAK = 185;

static uint32_t s2BeatStartMs = 0;

void scene2Enter() {
  displayShowNumber(2);
  ledsAllOff();
  s2BeatStartMs = millis();
}

void scene2Loop() {
  const uint32_t now = millis();
  uint32_t t = now - s2BeatStartMs;
  if (t >= S2_BEAT_MS) {
    s2BeatStartMs += (t / S2_BEAT_MS) * S2_BEAT_MS;
    t = now - s2BeatStartMs;
  }

  uint8_t duty = 0;
  if (t < S2_ATTACK_MS) {
    duty = (uint8_t)((uint32_t)S2_PEAK * t / S2_ATTACK_MS);
  } else if (t < S2_ATTACK_MS + S2_DECAY_MS) {
    const uint32_t remain = S2_ATTACK_MS + S2_DECAY_MS - t;
    duty = (uint8_t)((uint32_t)S2_PEAK * remain * remain / (S2_DECAY_MS * S2_DECAY_MS));
  }
  ledsSetDuty(PIN_LED2, duty);
}
