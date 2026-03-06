// BodyComms.ino — body unit communication layer
// Supports WiFi/WebSocket mode (default) and ESP-NOW mode (optional).

#include "BodyComms.h"
#include "config.h"
#include <WiFi.h>
#include <ESPmDNS.h>
#include <ArduinoOTA.h>
#include <ESPAsyncWebServer.h>
#include <Preferences.h>

#ifdef HAS_ESPNOW_RX
#include <esp_now.h>
#endif

// ─── Module-level state ───────────────────────────────────────────────────────
static AsyncWebServer bodyServer(8080);
static AsyncWebSocket wsBodyCommand("/Command");

// Pointer to BodyComms instance so the static WebSocket callback can reach it
static BodyComms* _instance = nullptr;

// ─── WiFi connect (same NVS-fallback pattern as Skuttleshell) ────────────────
static Preferences prefs;

static void connectWiFi() {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.print("Connecting to WiFi");
    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < 10000) {
        digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
        delay(500);
        Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nBody WiFi connected: " + WiFi.localIP().toString());
        return;
    }
    // Fallback: try NVS stored credentials
    prefs.begin("wifi", true);
    String ss = prefs.getString("autossid", "");
    String pw = prefs.getString("autopass",  "");
    prefs.end();
    if (ss.length() > 0) {
        WiFi.begin(ss.c_str(), pw.c_str());
        t = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - t < 10000) {
            delay(500); Serial.print(".");
        }
    }
    Serial.println(WiFi.status() == WL_CONNECTED ? "\nConnected (NVS creds)" : "\nWiFi failed");
}

// ─── WebSocket event handler ──────────────────────────────────────────────────
static void onBodyWSEvent(AsyncWebSocket*, AsyncWebSocketClient* client,
                          AwsEventType type, void*, uint8_t* data, size_t len) {
    if (!_instance) return;
    switch (type) {
        case WS_EVT_CONNECT:
            Serial.println("Body WS client connected");
            // Send handshake identical to head's format so the PC app can recognise it
            client->text(String("handshake,") + MODULE + "," + ID);
            break;

        case WS_EVT_DISCONNECT:
            Serial.println("Body WS client disconnected");
            break;

        case WS_EVT_DATA: {
            String msg = String((char*)data, len);
            if (msg == "ping") {
                client->text("pong");
                break;
            }
            if (msg.startsWith("{")) {
                SkuttleIntent intent;
                if (SkuttleParser::parseIntent(msg, intent)) {
                    _instance->_latest = intent;
                    _instance->_hasNew = true;
                }
            }
            break;
        }
        default: break;
    }
}

// ─── BodyComms implementation ─────────────────────────────────────────────────
BodyComms::BodyComms() : _latest{}, _hasNew(false) {}

void BodyComms::begin() {
    _instance = this;
    pinMode(STATUS_LED, OUTPUT);
    Serial.begin(115200);
    Serial.println("SkuttleBody booting...");

    connectWiFi();

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("No network — halting. Check WIFI_SSID in config.h");
        while (true) { delay(1000); }
    }

    // mDNS — body announces itself as "skuttlebody"
    if (MDNS.begin("skuttlebody")) {
        Serial.println("mDNS: skuttlebody.local");
    }

    // OTA
    ArduinoOTA.begin();
    xTaskCreatePinnedToCore([](void*){ while(true){ ArduinoOTA.handle(); vTaskDelay(20); } },
                            "OTATask", 2048, nullptr, 2, nullptr, 0);

#ifdef HAS_ESPNOW_RX
    // ── ESP-NOW mode ──────────────────────────────────────────────────────────
    esp_now_init();
    esp_now_register_recv_cb(BodyComms::onEspNowReceive);
    Serial.println("ESP-NOW receiver ready");
    // WiFi/WS server NOT started in this mode — head is the only command source.
#else
    // ── WiFi / WebSocket mode ─────────────────────────────────────────────────
    wsBodyCommand.onEvent(onBodyWSEvent);
    bodyServer.addHandler(&wsBodyCommand);
    bodyServer.begin();
    Serial.println("Body WebSocket server started on port 8080");
    Serial.println("Connect PC to ws://skuttlebody.local:8080/Command");
#endif

    digitalWrite(STATUS_LED, HIGH);
}

SkuttleIntent BodyComms::getLatestIntent() const { return _latest; }
bool          BodyComms::hasNewIntent()    const { return _hasNew; }
void          BodyComms::clearNewFlag()          { _hasNew = false; }

// ─── ESP-NOW receive callback ─────────────────────────────────────────────────
#ifdef HAS_ESPNOW_RX
void BodyComms::onEspNowReceive(const uint8_t* mac, const uint8_t* data, int len) {
    if (!_instance) return;
    if (len != sizeof(SkuttleIntent)) {
        Serial.printf("ESP-NOW: unexpected packet size %d (expected %d)\n",
                      len, (int)sizeof(SkuttleIntent));
        return;
    }
    memcpy(&_instance->_latest, data, sizeof(SkuttleIntent));
    _instance->_hasNew = true;
}
#endif
