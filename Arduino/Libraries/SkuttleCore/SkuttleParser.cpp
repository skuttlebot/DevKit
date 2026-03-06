#include "SkuttleParser.h"
#include <ArduinoJson.h>

// ─── SkuttleParser::parseIntent ──────────────────────────────────────────────
// Deserialises a JSON intent message into a SkuttleIntent.
// Missing fields default to zero / false — safe to send partial updates.
bool SkuttleParser::parseIntent(const String& json, SkuttleIntent& intent) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, json);
    if (err) return false;

    intent.moveX         = doc["moveX"]         | 0.0f;
    intent.moveY         = doc["moveY"]         | 0.0f;
    intent.turnZ         = doc["turnZ"]         | 0.0f;
    intent.speed         = doc["speed"]         | 1.0f;
    intent.panX          = doc["panX"]          | 0.0f;
    intent.tiltY         = doc["tiltY"]         | 0.0f;
    intent.emergencyStop = doc["emergencyStop"] | false;
    intent.cameraToggle  = doc["cameraToggle"]  | false;
    intent.timestamp     = millis();
    // seqNum managed by the caller

    return true;
}
