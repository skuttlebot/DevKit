// SkuttleESPNOW.ino — ESP-NOW transmitter for the head unit
// Only compiled when HAS_ESPNOW_TX is defined in config.h.
//
// ESP-NOW notes:
// - Both devices must be on the same WiFi channel.
// - The head sends SkuttleIntent structs (~28 bytes) at up to ~50 Hz.
// - No pairing ceremony needed if using unicast to the body's known MAC.
// - Range: ~100 m in open air at 1 Mbps.

#ifdef HAS_ESPNOW_TX

#include "SkuttleESPNOW.h"
#include "config.h"
#include <esp_now.h>
#include <WiFi.h>

uint8_t SkuttleESPNOW::_bodyMac[6] = {};
bool    SkuttleESPNOW::_peerAdded  = false;

void SkuttleESPNOW::begin(const uint8_t bodyMac[6]) {
    memcpy(_bodyMac, bodyMac, 6);

    if (esp_now_init() != ESP_OK) {
        Serial.println("ESP-NOW init failed");
        return;
    }
    esp_now_register_send_cb(SkuttleESPNOW::onSendResult);

    esp_now_peer_info_t peer = {};
    memcpy(peer.peer_addr, _bodyMac, 6);
    peer.channel = WiFi.channel();
    peer.encrypt = false;

    if (esp_now_add_peer(&peer) == ESP_OK) {
        _peerAdded = true;
        Serial.printf("ESP-NOW: paired with body %02X:%02X:%02X:%02X:%02X:%02X ch%d\n",
                      _bodyMac[0], _bodyMac[1], _bodyMac[2],
                      _bodyMac[3], _bodyMac[4], _bodyMac[5],
                      peer.channel);
    } else {
        Serial.println("ESP-NOW: failed to add peer");
    }
}

bool SkuttleESPNOW::send(const SkuttleIntent& intent) {
    if (!_peerAdded) return false;
    esp_err_t result = esp_now_send(_bodyMac,
                                    (const uint8_t*)&intent,
                                    sizeof(SkuttleIntent));
    return (result == ESP_OK);
}

void SkuttleESPNOW::onSendResult(const uint8_t*, esp_now_send_status_t status) {
    if (status != ESP_NOW_SEND_SUCCESS) {
        Serial.println("ESP-NOW: send failed");
    }
}

#endif // HAS_ESPNOW_TX
