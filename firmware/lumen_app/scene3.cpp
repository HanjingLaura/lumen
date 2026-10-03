#include "config.h"
#include "hw_display.h"
#include "hw_leds.h"
#include "scene.h"

#include <Arduino.h>
#include <math.h>

// Slow breath: ~3.6 s cosine cycle, gamma-corrected so the mid fade looks even.
static const uint32_t S3_PERIOD_MS = 3600;
static const uint8_t S3_PEAK = 165;

static uint32_t s3StartMs = 0;

void scene3Enter() {
  displayShowNumber(3);
  ledsAllOff();
  s3StartMs = millis();
}

void scene3Loop() {
  const uint32_t elapsed = millis() - s3StartMs;
  const float phase = (float)(elapsed % S3_PERIOD_MS) / (float)S3_PERIOD_MS;
  const float linear = 0.5f * (1.0f - cosf(2.0f * (float)PI * phase));
  const float gamma = powf(linear, 2.2f);
  const uint8_t duty = (uint8_t)(gamma * (float)S3_PEAK + 0.5f);
  ledsSetDuty(PIN_LED3, duty);
}
