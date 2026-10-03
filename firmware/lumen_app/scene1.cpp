#include "config.h"
#include "hw_display.h"
#include "hw_leds.h"
#include "scene.h"

#include <Arduino.h>

// Raindrop twinkle: brief random flashes that decay, then a random pause.
static uint32_t s1NextMs = 0;
static uint32_t s1FadeStartMs = 0;
static uint16_t s1FadeMs = 0;
static uint8_t s1Peak = 0;
static bool s1Fading = false;

void scene1Enter() {
  displayShowNumber(1);
  ledsAllOff();
  s1Fading = false;
  s1NextMs = millis();
}

void scene1Loop() {
  const uint32_t now = millis();
  if (s1Fading) {
    const uint32_t elapsed = now - s1FadeStartMs;
    if (elapsed >= s1FadeMs) {
      ledsSetDuty(PIN_LED1, 0);
      s1Fading = false;
      s1NextMs = now + (uint32_t)random(70, 520);
      return;
    }
    const uint8_t duty = (uint8_t)((uint32_t)s1Peak * (s1FadeMs - elapsed) / s1FadeMs);
    ledsSetDuty(PIN_LED1, duty);
    return;
  }
  if ((int32_t)(now - s1NextMs) >= 0) {
    s1Peak = (uint8_t)random(48, 170);
    s1FadeMs = (uint16_t)random(45, 160);
    s1FadeStartMs = now;
    s1Fading = true;
    ledsSetDuty(PIN_LED1, s1Peak);
  }
}
