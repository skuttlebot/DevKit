// SkuttleBody.ino — Hexapod body unit firmware
//
// Responsibilities:
//   1. Connect to WiFi (or receive via ESP-NOW from head, see config.h).
//   2. Listen for SkuttleIntent commands.
//   3. Execute those commands as physical leg movements.
//
// The body is deliberately decoupled from all audio/video concerns — it is a
// pure locomotion unit.  Command authority hierarchy:
//
//   ESP-NOW from head  (highest priority, lowest latency)
//         ↓
//   WebSocket from PC  (direct fallback — useful for tuning / standalone use)
//
// See ARCHITECTURE.md for the full system design.

#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <ESPmDNS.h>
#include <SkuttleCore.h>     // SkuttleIntent + SkuttleParser

#include "config.h"
#include "BodyComms.h"
#include "HexapodExecutor.h"

BodyComms       comms;
HexapodExecutor hexapod;

// Task: poll BodyComms and feed intent to HexapodExecutor
void intentTask(void* pv) {
    for (;;) {
        if (comms.hasNewIntent()) {
            SkuttleIntent intent = comms.getLatestIntent();
            comms.clearNewFlag();

            // Staleness guard: ignore commands older than 500 ms
            if ((millis() - intent.timestamp) < SKUTTLEINTENT_MAX_AGE_MS) {
                hexapod.executeIntent(intent);
            } else {
                // Stale intent — stop the body
                SkuttleIntent estop = {};
                estop.emergencyStop = true;
                hexapod.executeIntent(estop);
            }
        }
        vTaskDelay(pdMS_TO_TICKS(20));  // 50 Hz
    }
}

void setup() {
    comms.begin();      // WiFi, mDNS, OTA, WebSocket / ESP-NOW
    hexapod.setup();    // Servo bus init, home all legs

    xTaskCreatePinnedToCore(intentTask, "IntentTask", 4096, nullptr, 1, nullptr, 1);
    Serial.println("SkuttleBody ready");
}

void loop() {
    // Nothing — all work is in FreeRTOS tasks
}
