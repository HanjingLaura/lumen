#include "ble_link.h"

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLEAdvertising.h>
#include <string.h>

#include "esp_mac.h"

// Same UUIDs as src/bluetooth.js (deployed at /lumen/).
static const char *NUS_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
static const char *NUS_RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
static const char *NUS_TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

static BLEServer *server = nullptr;
static BLECharacteristic *txChar = nullptr;
static char deviceName[12] = "Lumen-0000";
static uint8_t lastSceneId = 1;
static volatile bool connected = false;
static volatile bool wasConnected = false;
static volatile bool subscribed = false;
static volatile bool notifyPending = false;
static volatile bool restartAdv = false;
static volatile uint8_t rxQueuedScene = 0;
static volatile uint32_t restartAdvAtMs = 0;

static char rxBuf[32];
static uint8_t rxLen = 0;

static uint8_t parseSceneLine(const char *line) {
  while (*line == ' ' || *line == '\t') line++;
  if (strncmp(line, "SCENE:", 6) != 0) return 0;
  const char d = line[6];
  if (d < '1' || d > '4') return 0;
  const char *rest = line + 7;
  while (*rest == ' ' || *rest == '\t') rest++;
  if (*rest != '\0') return 0;
  return (uint8_t)(d - '0');
}

static void queueRxLine(const char *line) {
  const uint8_t id = parseSceneLine(line);
  if (id != 0) rxQueuedScene = id;
}

static void feedRx(const uint8_t *data, size_t len) {
  for (size_t i = 0; i < len; i++) {
    const char c = (char)data[i];
    if (c == '\n' || c == '\r') {
      if (rxLen == 0) continue;
      rxBuf[rxLen] = '\0';
      queueRxLine(rxBuf);
      rxLen = 0;
      continue;
    }
    if (rxLen + 1 < sizeof(rxBuf)) rxBuf[rxLen++] = c;
  }
  // nRF Connect and similar tools often write "SCENE:n" with no newline.
  if (rxLen > 0) {
    rxBuf[rxLen] = '\0';
    if (parseSceneLine(rxBuf) != 0) {
      queueRxLine(rxBuf);
      rxLen = 0;
    }
  }
}

static void sendSceneNotify() {
  if (txChar == nullptr || lastSceneId < 1 || lastSceneId > 4) return;
  char buf[10];
  const int n = snprintf(buf, sizeof(buf), "SCENE:%u\n", (unsigned)lastSceneId);
  if (n <= 0) return;
  txChar->setValue((uint8_t *)buf, (size_t)n);
  txChar->notify();
}

static void startAdvertising() {
  if (server == nullptr) return;
  BLEAdvertising *adv = server->getAdvertising();
  // NamePrefix 'Lumen-' must be in the ADV packet (31-byte limit cannot hold
  // both a 128-bit UUID and "Lumen-XXXX"). Put NUS UUID in the scan response.
  BLEAdvertisementData advData;
  advData.setFlags(ESP_BLE_ADV_FLAG_GEN_DISC | ESP_BLE_ADV_FLAG_BREDR_NOT_SPT);
  advData.setName(String(deviceName));
  BLEAdvertisementData scanData;
  scanData.setCompleteServices(BLEUUID(NUS_SERVICE_UUID));
  scanData.setName(String(deviceName));
  adv->setScanResponse(true);
  adv->setAdvertisementData(advData);
  adv->setScanResponseData(scanData);
  adv->start();
  Serial.print("BLE ADV ");
  Serial.println(deviceName);
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) override {
    (void)pServer;
    connected = true;
    notifyPending = true;
  }

  void onDisconnect(BLEServer *pServer) override {
    (void)pServer;
    connected = false;
    subscribed = false;
    restartAdvAtMs = millis();
    restartAdv = true;
  }
};

class TxCallbacks : public BLECharacteristicCallbacks {
#if defined(CONFIG_NIMBLE_ENABLED)
  void onSubscribe(BLECharacteristic *pCharacteristic, ble_gap_conn_desc *desc, uint16_t subValue) override {
    (void)pCharacteristic;
    (void)desc;
    subscribed = (subValue & 0x0001) != 0;
    if (subscribed) notifyPending = true;
  }
#endif

  void onStatus(BLECharacteristic *pCharacteristic, Status s, uint32_t code) override {
    (void)pCharacteristic;
    (void)code;
    if (s == SUCCESS_NOTIFY) subscribed = true;
  }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    uint8_t *data = pCharacteristic->getData();
    const size_t len = pCharacteristic->getLength();
    if (data == nullptr || len == 0) return;
    feedRx(data, len);
  }
};

void bleBegin() {
  uint8_t mac[6] = {0};
  if (esp_read_mac(mac, ESP_MAC_BT) != ESP_OK) {
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
  }
  snprintf(deviceName, sizeof(deviceName), "Lumen-%02X%02X", mac[4], mac[5]);

  BLEDevice::init(deviceName);
  server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
#if !defined(CONFIG_BT_NIMBLE_EXT_ADV) || defined(CONFIG_BLUEDROID_ENABLED)
  server->advertiseOnDisconnect(false);  // restart from blePoll so we can log BLE ADV
#endif

  BLEService *service = server->createService(NUS_SERVICE_UUID);

  // TX: web client startNotifications() on this UUID (src/bluetooth.js).
  txChar = service->createCharacteristic(NUS_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  txChar->setCallbacks(new TxCallbacks());
  // NimBLE (esp32 3.3.x) adds CCCD 0x2902 automatically for PROPERTY_NOTIFY.

  // RX: live page does not write; accept SCENE:n for nRF Connect / future web commands.
  BLECharacteristic *rxChar = service->createCharacteristic(
      NUS_RX_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rxChar->setCallbacks(new RxCallbacks());

  service->start();

  server->getAdvertising()->addServiceUUID(NUS_SERVICE_UUID);
  startAdvertising();
}

void blePoll() {
  if (connected && !wasConnected) {
    Serial.println("BLE CONNECTED");
    wasConnected = true;
  }
  if (!connected && wasConnected) {
    Serial.println("BLE DISCONNECTED");
    wasConnected = false;
  }

  if (restartAdv && (millis() - restartAdvAtMs) >= 80) {
    restartAdv = false;
    startAdvertising();
  }

  if (connected && notifyPending) {
    notifyPending = false;
    sendSceneNotify();
  }
}

void bleNotifyScene(uint8_t sceneId) {
  if (sceneId < 1 || sceneId > 4) return;
  lastSceneId = sceneId;
  if (connected) sendSceneNotify();
}

bool bleTakeRxScene(uint8_t *sceneId) {
  if (sceneId == nullptr || rxQueuedScene == 0) return false;
  *sceneId = rxQueuedScene;
  rxQueuedScene = 0;
  return true;
}
