// Standalone INMP441 I2S mic test for ESP32-S3.
// Arduino IDE: Board "ESP32S3 Dev Module".
// Using the TTL/CH340 USB port: Tools > USB CDC On Boot: Disabled.
// Does not use or change firmware/lumen_app.

#include <ESP_I2S.h>
#include <math.h>

static const int PIN_BCLK = 15;  // INMP441 SCK
static const int PIN_WS = 16;    // INMP441 WS
static const int PIN_DIN = 17;   // INMP441 SD
static const int PIN_DOUT = -1;  // RX only

static const uint32_t SAMPLE_RATE_HZ = 16000;
static const uint32_t WINDOW_MS = 100;
static const uint32_t HINT_EVERY_MS = 3000;
static const int BAR_WIDTH = 32;
static const int BAR_RMS_PER_HASH = 16;
// INMP441: 24-bit left-justified in a 32-bit slot.
// >> 8 recovers 24-bit PCM; >> 14 is a more plotter-friendly range (about /64).
static const int SAMPLE_SHIFT = 14;
static const float DC_ALPHA = 0.001f;  // running-mean high-pass, tau ~= 1/(alpha*fs)
static const int READ_BURST = 256;

static I2SClass i2s;

static float dcMean = 0.0f;
static double sumSq = 0.0;
static uint32_t sampleCount = 0;
static uint32_t windowStartMs = 0;
static uint32_t lastHintMs = 0;
static int lastRms = -1;
static bool lastWasStuck = false;

static void printPinConfig() {
  Serial.println("INMP441 I2S 16kHz 32bit MONO LEFT");
  Serial.println("BCLK GPIO15  WS GPIO16  DIN GPIO17  DOUT unused");
  Serial.println("L/R GND (left channel)  VDD 3V3");
}

static void printHint() {
  Serial.println("HINT check SD on GPIO17, L/R to GND, VDD must be 3V3 not 5V");
}

static void printRmsLine(int rms) {
  int bars = rms / BAR_RMS_PER_HASH;
  if (bars < 0) {
    bars = 0;
  }
  if (bars > BAR_WIDTH) {
    bars = BAR_WIDTH;
  }

  // "RMS:123" is a single Serial Plotter trace. The ASCII bar has no extra numbers.
  Serial.print("RMS:");
  Serial.print(rms);
  Serial.print('\t');
  Serial.print('[');
  for (int i = 0; i < BAR_WIDTH; i++) {
    Serial.print(i < bars ? '#' : '-');
  }
  Serial.println(']');
}

static void consumeSamples() {
  // I2SClass::available() is not a real RX level (it returns a fixed chunk size).
  // setTimeout(0) + short bursts keeps loop() non-blocking.
  for (int i = 0; i < READ_BURST; i++) {
    int32_t raw = 0;
    const size_t n = i2s.readBytes(reinterpret_cast<char *>(&raw), sizeof(raw));
    if (n != sizeof(raw)) {
      break;
    }

    const int32_t sample = raw >> SAMPLE_SHIFT;
    dcMean += (static_cast<float>(sample) - dcMean) * DC_ALPHA;
    const float ac = static_cast<float>(sample) - dcMean;
    sumSq += static_cast<double>(ac) * static_cast<double>(ac);
    sampleCount++;
  }
}

void setup() {
  Serial.begin(115200);

  i2s.setPins(PIN_BCLK, PIN_WS, PIN_DOUT, PIN_DIN);
  if (!i2s.begin(I2S_MODE_STD, SAMPLE_RATE_HZ, I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO,
                 I2S_STD_SLOT_LEFT)) {
    Serial.println("I2S begin FAILED");
    printPinConfig();
    Serial.println("Check wiring and that VDD is 3V3");
    while (true) {
      delay(2000);
      Serial.println("I2S begin FAILED");
    }
  }

  i2s.setTimeout(0);
  windowStartMs = millis();
  lastHintMs = windowStartMs;

  Serial.println("MIC READY");
  printPinConfig();
}

void loop() {
  consumeSamples();

  const uint32_t now = millis();
  if ((now - windowStartMs) < WINDOW_MS) {
    return;
  }

  int rms = 0;
  if (sampleCount > 0) {
    rms = static_cast<int>(sqrt(sumSq / static_cast<double>(sampleCount)) + 0.5);
  }
  printRmsLine(rms);

  const bool stuck = (sampleCount == 0) || (rms == 0) || (rms == lastRms);
  if (stuck) {
    if (!lastWasStuck) {
      lastHintMs = now;
    } else if ((now - lastHintMs) >= HINT_EVERY_MS) {
      printHint();
      lastHintMs = now;
    }
  }
  lastWasStuck = stuck;
  lastRms = rms;

  sumSq = 0.0;
  sampleCount = 0;
  windowStartMs = now;
}
