#pragma once
#include <stdint.h>
#include <stdbool.h>

// ─── SkuttleIntent ────────────────────────────────────────────────────────────
// Universal body-agnostic command struct. The head unit produces this; any body
// type consumes it. Think of it as a hardware abstraction layer (HAL) for
// locomotion — the head doesn't know or care whether the body has wheels, legs,
// treads, or thrusters.
//
// Coordinate conventions (right-hand, from body's perspective):
//   +X  = right strafe
//   +Y  = forward
//   +Z  = counter-clockwise yaw (turn left)
//
// All motion axes are normalised –1.0 … +1.0 unless noted.
// ─────────────────────────────────────────────────────────────────────────────

struct SkuttleIntent {

    // ── Locomotion ────────────────────────────────────────────────────────────
    float   moveX;          // strafe left/right  (-1 = left,   +1 = right)
    float   moveY;          // forward/backward   (-1 = back,   +1 = forward)
    float   turnZ;          // yaw/pivot          (-1 = CW,     +1 = CCW)
    float   speed;          // global throttle     (0 = stop,   +1 = full)

    // ── Sensor / Head Pointing ────────────────────────────────────────────────
    float   panX;           // pan  left/right    (-1 = left,   +1 = right)
    float   tiltY;          // tilt down/up       (-1 = down,   +1 = up)

    // ── Behaviour Flags ───────────────────────────────────────────────────────
    bool    emergencyStop;  // halt all joints immediately and hold
    bool    cameraToggle;   // toggle camera stream on/off

    // ── Metadata ──────────────────────────────────────────────────────────────
    uint32_t timestamp;     // millis() at intent creation (staleness detection)
    uint8_t  seqNum;        // rolling 0-255 counter (drop/reorder detection)
};

// Maximum age (ms) before a receiver should discard a stale intent and stop.
#define SKUTTLEINTENT_MAX_AGE_MS 500
