#pragma once

#include <stdint.h>

// Returns true if the SSD1306 answered on I2C.
bool displayBegin();
void displayShowNumber(uint8_t n);
