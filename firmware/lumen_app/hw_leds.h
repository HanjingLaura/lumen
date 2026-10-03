#pragma once

#include <stdint.h>

// Four yellow scene LEDs on PIN_LED1–PIN_LED4 (LEDC PWM, active HIGH).
void ledsBegin();
void ledsSetDuty(uint8_t pin, uint8_t duty);  // 8-bit duty, 0 = off
void ledsAllOff();
