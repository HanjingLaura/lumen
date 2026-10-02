// Standalone INMP441 I2S mic test for ESP32-S3.
// Arduino IDE: Board "ESP32S3 Dev Module".
// Using the TTL/CH340 USB port: Tools > USB CDC On Boot: Disabled.
// Does not use or change firmware/lumen_app.

#include <ESP_I2S.h>
#include <limits.h>
#include <math.h>
#include <string.h>

#include "driver/i2s_common.h"

static const int PIN_BCLK = 15;  // INMP441 SCK
static const int PIN_WS = 16;    // INMP441 WS
static const int PIN_DIN = 17;   // INMP441 SD
static const int PIN_DOUT = -1;  // RX only

static const uint32_t SAMPLE_RATE_HZ = 16000;
static const uint32_t WINDOW_MS = 100;
static const uint32_t HINT_EVERY_MS = 3000;
static const uint32_t RAW_HEX_EVERY_MS = 1000;
static const uint32_t SLOT_PROBE_EVERY_MS = 5000;
static const int BAR_WIDTH = 32;
static const int BAR_RMS_PER_HASH = 16;
// INMP441: 24-bit left-justified in a 32-bit slot.
// sample24 = raw >> 8 (arithmetic). Display/RMS uses sample24 >> 6, same as old >> 14.
static const float DC_ALPHA = 0.001f;  // running-mean high-pass, tau ~= 1/(alpha*fs)
static const int DISPLAY_SHIFT = 6;
static const size_t BLOCK_SAMPLES = 256;  // 16 ms at 16 kHz
static const size_t BLOCK_BYTES = BLOCK_SAMPLES * sizeof(int32_t);
// 256 frames need ~16 ms; 20 ms lets a full block finish, leftover handles shorts.
static const uint32_t READ_TIMEOUT_MS = 20;
static const uint8_t ZERO_WINDOWS_BEFORE_PROBE = 10;  // ~1 s of all-zero LEFT

static I2SClass i2s;

static uint8_t leftover[sizeof(int32_t)];
static size_t leftoverLen = 0;

static float dcMean = 0.0f;
static double sumSq = 0.0;
static uint32_t sampleCount = 0;
static int32_t min24 = INT32_MAX;
static int32_t max24 = INT32_MIN;
static int32_t rawExample = 0;
static bool haveRawExample = false;
static uint32_t windowStartMs = 0;
static uint32_t lastHintMs = 0;
static uint32_t lastRawHexMs = 0;
static uint32_t lastSlotProbeMs = 0;
static int lastRms = -1;
static bool lastWasStuck = false;
static uint8_t leftZeroWindows = 0;

static void printPinConfig() {
  Serial.println("INMP441 I2S 16kHz 32bit MONO LEFT");
  Serial.println("BCLK GPIO15  WS GPIO16  DIN GPIO17  DOUT unused");
  Serial.println("L/R GND (left channel)  VDD 3V3");
}

static void printWiringHint() {
  Serial.println("HINT check SD on GPIO17, L/R to GND, VDD must be 3V3 not 5V");
}

static void printHex32(uint32_t value) {
  Serial.print("0x");
  for (int i = 7; i >= 0; i--) {
    Serial.print((value >> (i * 4)) & 0xF, HEX);
  }
}

static void resetWindow(uint32_t now) {
  sumSq = 0.0;
  sampleCount = 0;
  min24 = INT32_MAX;
  max24 = INT32_MIN;
  haveRawExample = false;
  rawExample = 0;
  windowStartMs = now;
}

static bool beginMic(int8_t slotMask) {
  leftoverLen = 0;
  if (i2s.rxChan() != NULL) {
    i2s.end();
  }
  i2s.setPins(PIN_BCLK, PIN_WS, PIN_DOUT, PIN_DIN);
  return i2s.begin(I2S_MODE_STD, SAMPLE_RATE_HZ, I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO,
                   slotMask);
}

// I2SClass::readBytes() returns 0 on timeout even after the DMA already gave 1-3 bytes,
// which permanently slips 32-bit alignment. Use the IDF read and keep leftovers.
static size_t readAlignedSamples(int32_t *out, size_t maxSamples) {
  i2s_chan_handle_t rx = i2s.rxChan();
  if (rx == NULL || maxSamples == 0) {
    return 0;
  }

  uint8_t tmp[sizeof(leftover) + BLOCK_BYTES];
  memcpy(tmp, leftover, leftoverLen);

  size_t got = 0;
  const esp_err_t err = i2s_channel_read(rx, tmp + leftoverLen, BLOCK_BYTES, &got, READ_TIMEOUT_MS);
  if (err != ESP_OK && err != ESP_ERR_TIMEOUT && got == 0) {
    return 0;
  }

  const size_t total = leftoverLen + got;
  size_t nSamp = total / sizeof(int32_t);
  if (nSamp > maxSamples) {
    nSamp = maxSamples;
  }
  const size_t used = nSamp * sizeof(int32_t);
  memcpy(out, tmp, used);

  const size_t remain = total - used;
  leftoverLen = remain % sizeof(int32_t);
  memcpy(leftover, tmp + total - leftoverLen, leftoverLen);
  return nSamp;
}

static void processRawSlot(int32_t raw) {
  const int32_t sample24 = raw >> 8;  // arithmetic, sign-preserving 24-bit PCM
  if (sample24 < min24) {
    min24 = sample24;
  }
  if (sample24 > max24) {
    max24 = sample24;
  }
  if (!haveRawExample) {
    rawExample = raw;
    haveRawExample = true;
  }

  dcMean += (static_cast<float>(sample24) - dcMean) * DC_ALPHA;
  const float ac24 = static_cast<float>(sample24) - dcMean;
  const float acDisp = ac24 / static_cast<float>(1 << DISPLAY_SHIFT);
  sumSq += static_cast<double>(acDisp) * static_cast<double>(acDisp);
  sampleCount++;
}

static void consumeSamples() {
  static int32_t block[BLOCK_SAMPLES];
  const size_t n = readAlignedSamples(block, BLOCK_SAMPLES);
  for (size_t i = 0; i < n; i++) {
    processRawSlot(block[i]);
  }
}

static void printRmsLine(int rms, bool withRawHex) {
  int bars = rms / BAR_RMS_PER_HASH;
  if (bars < 0) {
    bars = 0;
  }
  if (bars > BAR_WIDTH) {
    bars = BAR_WIDTH;
  }

  const int32_t minOut = (sampleCount > 0) ? min24 : 0;
  const int32_t maxOut = (sampleCount > 0) ? max24 : 0;

  // Plotter uses only "RMS:<int>". Diagnostics use '=' so they are not extra traces.
  Serial.print("RMS:");
  Serial.print(rms);
  Serial.print('\t');
  Serial.print('[');
  for (int i = 0; i < BAR_WIDTH; i++) {
    Serial.print(i < bars ? '#' : '-');
  }
  Serial.print("]\t");
  Serial.print("cnt=");
  Serial.print(sampleCount);
  Serial.print(" min24=");
  Serial.print(minOut);
  Serial.print(" max24=");
  Serial.print(maxOut);
  if (withRawHex && haveRawExample) {
    Serial.print(" raw=");
    printHex32(static_cast<uint32_t>(rawExample));
  }
  Serial.println();
}

static void probeRightIfLeftSilent(uint32_t now) {
  Serial.println("HINT LEFT samples are all zeros, probing RIGHT slot");

  if (!beginMic(I2S_STD_SLOT_RIGHT)) {
    Serial.println("HINT RIGHT slot begin failed, restoring LEFT");
    if (!beginMic(I2S_STD_SLOT_LEFT)) {
      Serial.println("I2S begin FAILED");
      while (true) {
        delay(2000);
        Serial.println("I2S begin FAILED");
      }
    }
    return;
  }

  static int32_t probe[BLOCK_SAMPLES];
  bool rightHasData = false;
  for (int attempt = 0; attempt < 4 && !rightHasData; attempt++) {
    const size_t n = readAlignedSamples(probe, BLOCK_SAMPLES);
    for (size_t i = 0; i < n; i++) {
      if ((probe[i] >> 8) != 0) {
        rightHasData = true;
        break;
      }
    }
  }

  if (rightHasData) {
    Serial.println("HINT LEFT slot is zeros but RIGHT has data. Tie L/R to GND for left.");
  }

  if (!beginMic(I2S_STD_SLOT_LEFT)) {
    Serial.println("I2S begin FAILED");
    while (true) {
      delay(2000);
      Serial.println("I2S begin FAILED");
    }
  }
  resetWindow(now);
}

void setup() {
  Serial.begin(115200);

  if (!beginMic(I2S_STD_SLOT_LEFT)) {
    Serial.println("I2S begin FAILED");
    printPinConfig();
    Serial.println("Check wiring and that VDD is 3V3");
    while (true) {
      delay(2000);
      Serial.println("I2S begin FAILED");
    }
  }

  const uint32_t now = millis();
  resetWindow(now);
  lastHintMs = now;
  lastRawHexMs = now;
  lastSlotProbeMs = now;

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

  const bool emitRaw = (now - lastRawHexMs) >= RAW_HEX_EVERY_MS;
  printRmsLine(rms, emitRaw);
  if (emitRaw) {
    lastRawHexMs = now;
  }

  const bool leftAllZero = (sampleCount > 0) && (min24 == 0) && (max24 == 0);
  if (leftAllZero) {
    leftZeroWindows++;
  } else if (sampleCount > 0) {
    leftZeroWindows = 0;
  }
  if (leftZeroWindows >= ZERO_WINDOWS_BEFORE_PROBE && (now - lastSlotProbeMs) >= SLOT_PROBE_EVERY_MS) {
    lastSlotProbeMs = now;
    leftZeroWindows = 0;
    probeRightIfLeftSilent(now);
    return;
  }

  const bool stuck = (sampleCount == 0) || (rms == 0) || (rms == lastRms);
  if (stuck) {
    if (!lastWasStuck) {
      lastHintMs = now;
    } else if ((now - lastHintMs) >= HINT_EVERY_MS) {
      printWiringHint();
      lastHintMs = now;
    }
  }
  lastWasStuck = stuck;
  lastRms = rms;

  resetWindow(now);
}
