#pragma once
#include <Arduino.h>
#include "SkuttleIntent.h"

// ─── SkuttleParser ────────────────────────────────────────────────────────────
// Deserialises a SkuttleIntent from the JSON string sent by the PC.
//
// PC sends (from renderer.js):
//   {"moveX":0.0,"moveY":0.8,"turnZ":-0.3,"speed":1.0,
//    "panX":0.0,"tiltY":0.0,"emergencyStop":false,"cameraToggle":false}
//
// Drive mode selection, button mapping, and axis scaling all happen on the PC.
// The firmware receives a clean, controller-agnostic intent it can act on
// directly — no knowledge of gamepads required.
//
// Requires: ArduinoJson library (Library Manager → "ArduinoJson" by Benoit Blanchon)
// ─────────────────────────────────────────────────────────────────────────────

class SkuttleParser {
public:
    // Parse a JSON intent string into a SkuttleIntent struct.
    // intent.timestamp is set to millis() on successful parse.
    // Returns true if the string was valid JSON containing at least one known field.
    static bool parseIntent(const String& json, SkuttleIntent& intent);
};
