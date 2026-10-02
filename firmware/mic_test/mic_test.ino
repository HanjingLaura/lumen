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
static const uint32_t PRINT_RMS_EVERY_MS = 1000;  // RMS/音量条多久打一行（太密会把 CLAP 顶没）
static const uint32_t HINT_EVERY_MS = 3000;
static const uint32_t RAW_HEX_EVERY_MS = 1000;
static const uint32_t SLOT_PROBE_EVERY_MS = 5000;
static const int BAR_WIDTH = 32;
static const int BAR_RMS_PER_HASH = 16;
// INMP441: 24-bit left-justified in a 32-bit slot.
// sample24 = raw >> 8 (arithmetic). Display/RMS uses filtered sample24 >> 6.
static const float HPF_CUTOFF_HZ = 150.0f;  // 高通截止（16 kHz 下约 150 Hz），逐点滤慢漂，不是块均值
static const uint32_t HPF_WARMUP_MS = 200;  // 开机后滤波器建立，这段时间不报 CLAP
static const int DISPLAY_SHIFT = 6;
static const size_t BLOCK_SAMPLES = 256;  // 16 ms at 16 kHz
static const size_t BLOCK_BYTES = BLOCK_SAMPLES * sizeof(int32_t);
// 256 frames need ~16 ms; 20 ms lets a full block finish, leftover handles shorts.
static const uint32_t READ_TIMEOUT_MS = 20;
static const uint8_t ZERO_WINDOWS_BEFORE_PROBE = 10;  // ~1 s of all-zero LEFT

// ---- 拍手检测（单位都是高通后的 |sample24|，不是显示用 RMS）----
static const uint32_t SUBWIN_MS = 10;  // 子窗口：算 10 ms 峰值和短时 RMS
static const uint32_t SUBWIN_SAMPLES = SAMPLE_RATE_HZ * SUBWIN_MS / 1000;
static const float BASELINE_TAU_S = 2.0f;         // 背景跟踪时间常数（秒），只在非事件时更新
static const float BASELINE_FLOOR = 1.0f;         // 背景下限，避免除零
static const uint32_t BASELINE_WARMUP_MS = 500;   // 前 500 ms 背景可以吃所有峰值（冷启动）
static const float BASELINE_ADMIT_X = 3.0f;       // 之后只有 peak < 此倍数×背景 才进 EMA，避免被拍手抬高
static const uint32_t BASELINE_HOLD_MS = 150;     // 响亮事件（候选/确认/拒绝）后这么久不更新背景
static const float CLAP_PEAK_OVER_BASE = 20.0f;   // 10 ms 峰值须超过背景的 K 倍（默认 20，挡小误触发）
static const float CLAP_CREST_MIN = 3.0f;         // 波峰因数；削波拍手会变低，默认 3
static const float CLIP_LEVEL_24 = 7000000.0f;    // 10 ms 峰值达到此值视为削波，不再卡 crest
static const uint32_t DECAY_WAIT_MS = 50;         // 峰值后再看约 50 ms（响尾可跨 2–3 个 10 ms）
static const float DECAY_FRAC = 0.50f;            // 衰减门槛：确认窗口峰值 < DECAY_FRAC * 拍手峰值
static const uint32_t CLAP_REFRACTORY_MS = 120;   // 两次拍手之间的不应期
static const uint32_t ECHO_WINDOW_MS = 300;       // 确认后这么久内，新候选须够响，否则当回声/尾巴
static const float ECHO_REL_MIN = 0.50f;          // 回声窗内：新 peak >= 上一拍 peak × 此比例（真双击够得着）
static const uint32_t DOUBLE_CLAP_MIN_MS = 150;   // 双击：两拍间隔下限
static const uint32_t DOUBLE_CLAP_MAX_MS = 600;   // 双击：两拍间隔上限
static const uint32_t DBG_EVERY_MS = 1000;        // 每秒一行 DBG，看背景有没有跟上

static I2SClass i2s;

static uint8_t leftover[sizeof(int32_t)];
static size_t leftoverLen = 0;

static float hpfB0 = 0.0f, hpfB1 = 0.0f, hpfB2 = 0.0f, hpfA1 = 0.0f, hpfA2 = 0.0f;
static float hpfX1 = 0.0f, hpfX2 = 0.0f, hpfY1 = 0.0f, hpfY2 = 0.0f;
static uint32_t audioStartMs = 0;
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

enum ClapState { CLAP_IDLE, CLAP_CONFIRM };
static ClapState clapState = CLAP_IDLE;
static float baselinePeak = 0.0f;
static bool baselineReady = false;
static uint32_t baselineStartMs = 0;
static uint32_t lastDbgMs = 0;
static uint32_t lastClapMs = 0;
static float lastConfirmedPeak = 0.0f;
static uint32_t lastLoudMs = 0;
static uint32_t lastClapForDoubleMs = 0;
static float candPeak = 0.0f;
static float candBase = 0.0f;
static float candRatio = 0.0f;
static float candCrest = 0.0f;
static uint32_t candStartMs = 0;
static uint8_t decayWindowsSeen = 0;
static uint32_t subCount = 0;
static double subSumSq = 0.0;
static float subPeak = 0.0f;

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

static void resetHpfState() {
  hpfX1 = 0.0f;
  hpfX2 = 0.0f;
  hpfY1 = 0.0f;
  hpfY2 = 0.0f;
}

// 2nd-order Butterworth high-pass (RBJ), coefficients from HPF_CUTOFF_HZ.
static void initHpf() {
  const float w0 = 2.0f * 3.14159265f * HPF_CUTOFF_HZ / static_cast<float>(SAMPLE_RATE_HZ);
  const float cosw = cosf(w0);
  const float sinw = sinf(w0);
  const float q = 0.70710678f;
  const float alpha = sinw / (2.0f * q);
  const float a0 = 1.0f + alpha;
  hpfB0 = ((1.0f + cosw) * 0.5f) / a0;
  hpfB1 = (-(1.0f + cosw)) / a0;
  hpfB2 = ((1.0f + cosw) * 0.5f) / a0;
  hpfA1 = (-2.0f * cosw) / a0;
  hpfA2 = (1.0f - alpha) / a0;
  resetHpfState();
}

static float hpfProcess(float x) {
  const float y = hpfB0 * x + hpfB1 * hpfX1 + hpfB2 * hpfX2 - hpfA1 * hpfY1 - hpfA2 * hpfY2;
  hpfX2 = hpfX1;
  hpfX1 = x;
  hpfY2 = hpfY1;
  hpfY1 = y;
  return y;
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

static void resetClapDetector(uint32_t now) {
  clapState = CLAP_IDLE;
  baselinePeak = 0.0f;
  baselineReady = false;
  baselineStartMs = now;
  lastDbgMs = now;
  lastClapMs = 0;
  lastConfirmedPeak = 0.0f;
  lastLoudMs = 0;
  lastClapForDoubleMs = 0;
  candPeak = 0.0f;
  candBase = 0.0f;
  candRatio = 0.0f;
  candCrest = 0.0f;
  candStartMs = 0;
  decayWindowsSeen = 0;
  subCount = 0;
  subSumSq = 0.0;
  subPeak = 0.0f;
  audioStartMs = now;
  resetHpfState();
}

static void printClap(float peak, float base, float ratio, float crest) {
  Serial.print("CLAP peak=");
  Serial.print(static_cast<long>(peak + 0.5f));
  Serial.print(" base=");
  Serial.print(static_cast<long>(base + 0.5f));
  Serial.print(" ratio=");
  Serial.print(ratio, 1);
  Serial.print(" crest=");
  Serial.println(crest, 1);
}

static bool inClapEvent(uint32_t now) {
  if (clapState != CLAP_IDLE) {
    return true;
  }
  return (lastClapMs != 0) && ((now - lastClapMs) < CLAP_REFRACTORY_MS);
}

static void updateBaseline(float peak10, uint32_t now) {
  if (!baselineReady) {
    if (peak10 > 0.0f) {
      baselinePeak = peak10;
      baselineReady = true;
      baselineStartMs = now;
    }
    return;
  }
  const bool warming = (now - baselineStartMs) < BASELINE_WARMUP_MS;
  if (!warming) {
    if ((lastLoudMs != 0) && ((now - lastLoudMs) < BASELINE_HOLD_MS)) {
      return;
    }
    if (peak10 >= (BASELINE_ADMIT_X * baselinePeak)) {
      return;
    }
  }
  if (inClapEvent(now)) {
    return;
  }
  const float alpha = (static_cast<float>(SUBWIN_MS) / 1000.0f) / BASELINE_TAU_S;
  baselinePeak += (peak10 - baselinePeak) * alpha;
  if (baselinePeak < BASELINE_FLOOR) {
    baselinePeak = BASELINE_FLOOR;
  }
}

static void maybePrintDbg(uint32_t now) {
  if ((now - lastDbgMs) < DBG_EVERY_MS) {
    return;
  }
  lastDbgMs = now;
  Serial.print("DBG base=");
  Serial.println(static_cast<long>(baselinePeak + 0.5f));
}

static void confirmOrRejectClap(float followPeak, uint32_t now) {
  const bool decayed = followPeak < (candPeak * DECAY_FRAC);
  clapState = CLAP_IDLE;
  lastLoudMs = (candStartMs != 0) ? candStartMs : now;
  if (!decayed) {
    return;
  }

  printClap(candPeak, candBase, candRatio, candCrest);
  const uint32_t clapAt = (candStartMs != 0) ? candStartMs : now;
  if (lastClapForDoubleMs != 0) {
    const uint32_t gap = clapAt - lastClapForDoubleMs;
    if (gap >= DOUBLE_CLAP_MIN_MS && gap <= DOUBLE_CLAP_MAX_MS) {
      Serial.println("DOUBLE_CLAP");
    }
  }
  lastClapMs = clapAt;
  lastConfirmedPeak = candPeak;
  lastClapForDoubleMs = clapAt;
}

static void finishSubwindow() {
  const uint32_t now = millis();
  const uint32_t n = subCount;
  const float shortRms =
      (n > 0) ? static_cast<float>(sqrt(subSumSq / static_cast<double>(n))) : 0.0f;
  const float peak = subPeak;
  subCount = 0;
  subSumSq = 0.0;
  subPeak = 0.0f;

  if (clapState == CLAP_CONFIRM) {
    decayWindowsSeen++;
    if ((decayWindowsSeen * SUBWIN_MS) <= 30 && peak > candPeak) {
      candPeak = peak;
      candRatio = (candBase > 0.0f) ? (candPeak / candBase) : 0.0f;
    }
    if ((decayWindowsSeen * SUBWIN_MS) >= DECAY_WAIT_MS) {
      confirmOrRejectClap(peak, now);
    }
    maybePrintDbg(now);
    return;
  }

  const bool hpfWarm = (now - audioStartMs) < HPF_WARMUP_MS;
  const bool warmed =
      !hpfWarm && baselineReady && ((now - baselineStartMs) >= BASELINE_WARMUP_MS);
  const bool refractory = (lastClapMs != 0) && ((now - lastClapMs) < CLAP_REFRACTORY_MS);
  const bool inEchoWindow =
      (lastClapMs != 0) && (lastConfirmedPeak > 0.0f) && ((now - lastClapMs) < ECHO_WINDOW_MS);
  const bool echoTooSoft = inEchoWindow && (peak < (ECHO_REL_MIN * lastConfirmedPeak));
  const float base = (baselinePeak > BASELINE_FLOOR) ? baselinePeak : BASELINE_FLOOR;
  const float ratio = peak / base;
  const float crest = (shortRms > 1.0f) ? (peak / shortRms) : ((peak > 0.0f) ? 100.0f : 0.0f);
  const bool clipped = peak >= CLIP_LEVEL_24;
  const bool crestOk = clipped || (crest >= CLAP_CREST_MIN);
  if (warmed && !refractory && !echoTooSoft && peak > (CLAP_PEAK_OVER_BASE * base) && crestOk) {
    candPeak = peak;
    candBase = base;
    candRatio = ratio;
    candCrest = crest;
    candStartMs = now;
    lastLoudMs = now;
    decayWindowsSeen = 0;
    clapState = CLAP_CONFIRM;
    maybePrintDbg(now);
    return;
  }

  if (!hpfWarm) {
    updateBaseline(peak, now);
  }
  maybePrintDbg(now);
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

  const float filtered = hpfProcess(static_cast<float>(sample24));
  const float acDisp = filtered / static_cast<float>(1 << DISPLAY_SHIFT);
  sumSq += static_cast<double>(acDisp) * static_cast<double>(acDisp);
  sampleCount++;

  const float absAc = (filtered >= 0.0f) ? filtered : -filtered;
  if (absAc > subPeak) {
    subPeak = absAc;
  }
  subSumSq += static_cast<double>(filtered) * static_cast<double>(filtered);
  subCount++;
  if (subCount >= SUBWIN_SAMPLES) {
    finishSubwindow();
  }
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
  resetClapDetector(now);
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
  initHpf();
  resetWindow(now);
  resetClapDetector(now);
  lastHintMs = now;
  lastRawHexMs = now;
  lastSlotProbeMs = now;

  Serial.println("MIC READY");
  printPinConfig();
}

void loop() {
  consumeSamples();

  const uint32_t now = millis();
  if ((now - windowStartMs) < PRINT_RMS_EVERY_MS) {
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
