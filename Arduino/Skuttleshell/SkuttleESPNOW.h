#pragma once
#include <Arduino.h>
#include <SkuttleCore.h>

// ─── SkuttleESPNOW ────────────────────────────────────────────────────────────
// Optional ESP-NOW transmitter for the head unit.
// Only compiled when HAS_ESPNOW_TX is defined in config.h.
//
// Usage in Skuttleshell.ino:
//   1. #define HAS_ESPNOW_TX in config.h
//   2. Call SkuttleESPNOW::begin(bodyMac) in setup()
//   3. Call SkuttleESPNOW::send(intent) after converting gamepad input to intent
//
// The body MAC address is found by running Serial.println(WiFi.macAddress())
// in the body's setup() and copying the hex values into config.h.
// ─────────────────────────────────────────────────────────────────────────────

#ifdef HAS_ESPNOW_TX

class SkuttleESPNOW {
public:
    // bodyMac: 6-byte MAC of the body unit (set in config.h as BODY_MAC)
    static void begin(const uint8_t bodyMac[6]);

    // Send a SkuttleIntent to the paired body. Returns true if queued OK.
    static bool send(const SkuttleIntent& intent);

private:
    static void onSendResult(const uint8_t* mac, esp_now_send_status_t status);
    static uint8_t _bodyMac[6];
    static bool    _peerAdded;
};

#endif // HAS_ESPNOW_TX
