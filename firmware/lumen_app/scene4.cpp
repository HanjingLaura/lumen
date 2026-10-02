#include "config.h"
#include "hw_display.h"
#include "hw_leds.h"
#include "scene.h"

#include <Arduino.h>

static const uint8_t S4_DUTY = 150;

void scene4Enter() {
  displayShowNumber(4);
  ledsAllOff();
  ledsSetDuty(PIN_LED4, S4_DUTY);
}

void scene4Loop() {
  ledsSetDuty(PIN_LED4, S4_DUTY);
}
