#pragma once
#include <Arduino.h>
#include <SkuttleCore.h>

// ─── BodyComms ────────────────────────────────────────────────────────────────
// Manages incoming command reception for the body unit.
//
// Two modes (selected at compile time via config.h):
//
//  1. WiFi / WebSocket mode (default, HAS_ESPNOW_RX not defined):
//     Body connects to the home network and runs its own AsyncWebSocket server
//     at ws://skuttlebody.local:8080/Command.  The PC (or head) sends the same
//     "command,..." string it sends to the head unit.  SkuttleParser converts it
//     into a SkuttleIntent for HexapodExecutor.
//
//  2. ESP-NOW mode (HAS_ESPNOW_RX defined):
//     Body listens for ESP-NOW packets from the head.  Packets are raw
//     SkuttleIntent structs (≤28 bytes, well within the 250-byte ESP-NOW limit).
//     WiFi is still started (ESP-NOW requires Wi-Fi to be initialised) but no
//     WebSocket server is started.
//
// In both modes, the last received SkuttleIntent is stored and exposed via
// BodyComms::getLatestIntent().
// ─────────────────────────────────────────────────────────────────────────────

class BodyComms {
public:
    BodyComms();
    void begin();                           // call in setup()
    SkuttleIntent getLatestIntent() const;  // call in loop / task
    bool hasNewIntent() const;              // true if a new intent arrived since last get
    void clearNewFlag();

private:
    SkuttleIntent _latest;
    bool          _hasNew;

#ifdef HAS_ESPNOW_RX
    static void onEspNowReceive(const uint8_t* mac, const uint8_t* data, int len);
#endif
};
