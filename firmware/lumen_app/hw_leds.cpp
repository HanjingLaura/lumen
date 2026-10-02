#include "hw_leds.h"

#include <Arduino.h>

#include "config.h"

static const uint8_t LED_PINS[] = {PIN_LED1, PIN_LED2, PIN_LED3, PIN_LED4};

void ledsBegin() {
  for (uint8_t i = 0; i < 4; i++) {
    ledcAttach(LED_PINS[i], LED_PWM_HZ, LED_PWM_BITS);
    ledcWrite(LED_PINS[i], 0);
  }
}

void ledsSetDuty(uint8_t pin, uint8_t duty) {
  ledcWrite(pin, duty);
}

void ledsAllOff() {
  for (uint8_t i = 0; i < 4; i++) {
    ledcWrite(LED_PINS[i], 0);
  }
}
