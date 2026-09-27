// Minimal ESP32-S3 button test: GPIO4 -> Serial "SCENE:1"
// Many S3 boards need Tools -> "USB CDC On Boot: Enabled"

const int BTN_PIN = 4;
const unsigned long DEBOUNCE_MS = 30;

int lastStable = HIGH;
int lastRead = HIGH;
unsigned long lastChangeMs = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 2000) {}  // native USB CDC
  pinMode(BTN_PIN, INPUT_PULLUP);        // other leg to GND; pressed = LOW
  Serial.println("LUMEN TEST READY");
}

void loop() {
  int reading = digitalRead(BTN_PIN);
  unsigned long now = millis();

  if (reading != lastRead) {
    lastChangeMs = now;
    lastRead = reading;
  }

  // Debounced falling edge only; hold does not repeat
  if ((now - lastChangeMs) >= DEBOUNCE_MS && reading != lastStable) {
    lastStable = reading;
    if (lastStable == LOW) {
      Serial.println("SCENE:1");
    }
  }
}
