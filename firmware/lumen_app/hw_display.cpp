#include "hw_display.h"
#include "config.h"

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Wire.h>

static Adafruit_SSD1306 oled(OLED_W, OLED_H, &Wire, -1);
static bool ready = false;

bool displayBegin() {
  Wire.begin(PIN_SDA, PIN_SCL);
  ready = oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  if (ready) {
    oled.clearDisplay();
    oled.display();
  }
  return ready;
}

void displayShowNumber(uint8_t n) {
  if (!ready) return;
  oled.clearDisplay();
  oled.setTextSize(2);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(0, 0);  // top-left
  oled.print(n);
  oled.display();
}
