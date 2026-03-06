# Skuttlebot System Architecture

## Overview

Skuttlebot is a modular AI-embodiment robot platform. The design goal is to let an AI system ("Althea") perceive the world through robot senses (camera, microphone) and act on it through robot actuators (wheels, legs, speaker), with a clean interface boundary between the AI intelligence and the robot hardware.

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │  ALTHEA (AI — separate project)                                     │
  │  Vision  •  STT  •  LLM reasoning  •  TTS  •  Motion decisions     │
  └────────────────────┬────────────────────────────────────────────────┘
                       │  HTTP / WebSocket (future Althea API)
  ┌────────────────────▼────────────────────────────────────────────────┐
  │  PC  —  Electron app  (Node.js)                                     │
  │  websocketManager.js  •  audioManager.js  •  main.js               │
  └────┬────────────┬────────────┬────────────┬───────────────────────-─┘
       │ /Command   │ /Camera    │ /Sound     │ /Mic
       │ (WebSocket)│ (WebSocket)│ (WebSocket)│ (WebSocket)
  ┌────▼────────────▼────────────▼────────────▼──────────────────────────┐
  │  HEAD UNIT  —  Freenove ESP32-S3-CAM                                 │
  │  Skuttleshell (main sketch)                                          │
  │  ├─ SkuttleWIFI     WiFi connection, mDNS, OTA                      │
  │  ├─ Skuttlecam      OV2640 camera → JPEG stream → /Camera WS        │
  │  ├─ Skuttlesound    MAX98357A amp + INMP441 mic via I2S              │
  │  ├─ Skuttlemove     SCS0009 serial bus servos (wheels + tilt)       │
  │  ├─ SkuttleParser   Parse "command,..." WS string → SkuttleIntent   │
  │  └─ SkuttleESPNOW  Broadcast SkuttleIntent to body (optional)      │
  └─────────────────────────────┬────────────────────────────────────────┘
                                │  ESP-NOW  (≤10 ms, ≤250 bytes)
                                │  SkuttleIntent struct (~28 bytes)
  ┌─────────────────────────────▼────────────────────────────────────────┐
  │  BODY UNIT  —  ESP32 AI-Thinker (or any ESP32)                      │
  │  SkuttleBody (sketch)                                                │
  │  ├─ BodyComms        ESP-NOW RX  OR  WiFi WebSocket server          │
  │  └─ HexapodExecutor  SkuttleIntent → 18-servo tripod gait           │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## Modules

### PC App  (`PC/UI/`)

| File | Purpose |
|------|---------|
| `main.js` | Electron entry point. Creates window, wires IPC, starts WebSocket connection. |
| `windowManager.js` | Creates the BrowserWindow with security settings. |
| `websocketManager.js` | Manages all four WebSocket channels. Handles connect/reconnect, heartbeat, and forwards messages to renderer via IPC. |
| `audioManager.js` | Sends PCM audio packets over /Sound WebSocket. Handles tone generation and streaming. |
| `audioCapture.js` | Wraps FFmpeg (dshow) for capturing audio from a Windows device. |
| `renderer.js` | Runs in the browser context. Polls gamepad, renders camera frames, updates UI. |
| `preload.js` | Electron context bridge — exposes a safe subset of IPC to the renderer. |

**WebSocket channels:**

| Channel | Direction | Content |
|---------|-----------|---------|
| `/Command` | Bidirectional | PC→ESP32: `"command,B0,...,B16,A0,A1,A2,A3"` gamepad state. ESP32→PC: `"handshake,..."`, heartbeat RSSI/heap stats. |
| `/Camera` | ESP32→PC | Binary JPEG frames, one per WS message. |
| `/Sound` | PC→ESP32 | Binary PCM packets (16 kHz, 16-bit, mono). `"EOA"` signals end of audio. |
| `/Mic` | ESP32→PC | Binary PCM from INMP441 mic. Forwarded to renderer as `micData` IPC for Althea STT. |

---

### Head Unit  (`Arduino/Skuttleshell/`)

The head is the robot's "face" — it provides all audio-visual sensing and communicates with the PC. It optionally delegates locomotion to a body unit.

| File | Purpose |
|------|---------|
| `Skuttleshell.ino` | Main sketch. Declares WebSocket servers, calls setup on all modules, handles WebSocket events. |
| `config.h` | Compile-time configuration: unit type, feature flags, servo IDs, board pins, WiFi credentials, device identity. |
| `SkuttleWIFI.h/.ino` | WiFi connection (primary creds → NVS stored creds → WiFiManager AP portal). OTA updates. mDNS hostname. Heartbeat sender task. |
| `Skuttlecam.h/.ino` | OV2640 camera init and JPEG streaming task. Sends frames over /Camera WebSocket. |
| `Skuttlesound.h/.ino` | I2S audio output (MAX98357A amp). Buffers incoming PCM from /Sound WebSocket and plays it. |
| `Skuttlemove.h/.ino` | Serial bus servo control. Three drive modes: Turret (pivot only), Tank (dual stick), Car (single stick + turn). Slew-rate filter for smooth acceleration. |
| `Signalchk.h/.ino` | Reads WiFi RSSI for heartbeat telemetry. |
| `SkuttleESPNOW.h/.ino` | **Optional.** Enable with `#define HAS_ESPNOW_TX` in config.h. Transmits SkuttleIntent structs to the body unit over ESP-NOW. |
| `camera_pins.h` | GPIO pin map for the camera model in use. Set `CAMERA_MODEL_FREENOVE_S3` in `Skuttlecam.ino`. |
| `config.h.template` | Safe-to-commit reference for config.h. Contains placeholder credentials. |

**Board:** Freenove ESP32-S3-CAM (16 MB flash, 8 MB PSRAM, 240 MHz dual-core)

**Key pins:**

| Pin | Function |
|-----|---------|
| 48 | WS2812 RGB status LED |
| 38 / 39 | Servo bus UART TX / RX |
| 14 / 2 / 21 | I2S BCLK / LRC / DOUT (amp) |
| 40 | I2S MIC_SD (INMP441, when HAS_AUDIO_IN enabled) |
| 15 | Camera XCLK |

---

### Body Unit  (`Arduino/SkuttleBody/`)

The body is a pure locomotion unit. It has no camera, no audio. It receives SkuttleIntent commands and moves legs accordingly.

| File | Purpose |
|------|---------|
| `SkuttleBody.ino` | Main sketch. Calls `comms.begin()` and `hexapod.setup()`, starts intent-execution task. |
| `config.h` | Body-specific config: `UNIT_TYPE_BODY`, servo IDs (LEG1_COXA_ID etc.), WiFi creds, optional `HAS_ESPNOW_RX`. |
| `BodyComms.h/.ino` | Receives SkuttleIntent from ESP-NOW (when HAS_ESPNOW_RX) or from PC via /Command WebSocket. Runs a WebSocket server at `ws://skuttlebody.local:8080/Command`. |
| `HexapodExecutor.h/.ino` | Translates SkuttleIntent into tripod-gait leg movements across 18 SCS0009 servos. |

**Board:** ESP32 AI-Thinker (camera GPIOs repurposed for servo bus — no camera needed on body)

**Servo ID scheme:**  `LEG_NUMBER × 10 + JOINT`  (joint: 1=coxa, 2=femur, 3=tibia)

```
Leg layout (top-down view):
     Front
 [1]     [2]
 [3]     [4]
 [5]     [6]
      Rear

Tripod groups:
  Group A: legs 1, 3, 5  (FR, MR, RL)
  Group B: legs 2, 4, 6  (FL, ML, RR)
```

---

### Shared Library  (`Arduino/Libraries/SkuttleCore/`)

Shared types and utilities used by both Skuttleshell and SkuttleBody.

| File | Purpose |
|------|---------|
| `SkuttleCore.h` | Umbrella include: `#include <SkuttleCore.h>` pulls in everything. |
| `SkuttleIntent.h` | The universal command struct. The hardware-abstraction boundary between "what the operator/AI wants" and "how a specific body executes it". |
| `SkuttleParser.h/.cpp` | Static class with two methods: `parse()` converts the raw WebSocket string into `bool COMMAND[17]` and `float MOVE[4]` arrays; `toIntent()` converts those arrays into a `SkuttleIntent`. |

---

## SkuttleIntent — The HAL Contract

`SkuttleIntent` is the single interface between command sources (gamepad, AI) and body types (wheeled, hexapod, future). Adding a new body type means implementing `executeIntent(SkuttleIntent&)` — the rest of the system is untouched.

```cpp
struct SkuttleIntent {
    float    moveX;          // strafe      –1 (left)   … +1 (right)
    float    moveY;          // forward     –1 (back)   … +1 (forward)
    float    turnZ;          // yaw         –1 (CW)     … +1 (CCW)
    float    speed;          // throttle     0 (stop)   … +1 (full)
    float    panX;           // camera pan  –1 (left)   … +1 (right)
    float    tiltY;          // camera tilt –1 (down)   … +1 (up)
    bool     emergencyStop;  // all joints → neutral, hold
    bool     cameraToggle;   // toggle camera stream
    uint32_t timestamp;      // millis() at creation — used for staleness guard
    uint8_t  seqNum;         // rolling counter — used to detect dropped packets
};
```

Staleness guard: if a SkuttleIntent arrives at the body more than `SKUTTLEINTENT_MAX_AGE_MS` (500 ms) after its `timestamp`, the body issues an emergency stop rather than acting on stale data. This prevents runaway motion if the ESP-NOW link drops.

---

## Data Flow — Gamepad Command

```
Gamepad (USB HID)
  │
  ▼  requestAnimationFrame (~60 Hz)
renderer.js  →  IPC "r2m"  →  main.js
  │
  ▼  WebSocket text
"command,B0,B1,...,B16,A0,A1,A2,A3"
  │
  ▼  /Command WebSocket
Skuttleshell.ino  →  SkuttleParser::parse()
  │                    └─ COMMAND[17], MOVE[4]
  ├─► Skuttlemove::action(COMMAND, MOVE)     — head locomotion (wheels, tilt)
  │
  └─► SkuttleParser::toIntent()             — if HAS_ESPNOW_TX
       │  SkuttleIntent struct
       ▼
      SkuttleESPNOW::send()
       │  ESP-NOW packet (~28 bytes, <10 ms)
       ▼
      BodyComms::onEspNowReceive()
       │  SkuttleIntent
       ▼
      HexapodExecutor::executeIntent()       — body locomotion (tripod gait)
```

## Data Flow — Camera

```
OV2640 sensor  →  DMA buffer  →  Skuttlecam task
  │  JPEG frame (PSRAM)
  ▼  WebSocket binary
/Camera WebSocket  →  websocketManager.js  →  IPC "frame"
  │
  ▼
renderer.js  →  <img src=objectURL>  →  displayed in UI
```

## Data Flow — Microphone (when HAS_AUDIO_IN enabled)

```
INMP441 mic  →  I2S RX  →  Skuttlemic task
  │  PCM binary (16kHz mono)
  ▼  WebSocket binary
/Mic WebSocket  →  websocketManager.js  →  IPC "micData"
  │
  ▼
renderer.js  →  Althea STT pipeline
```

---

## Configuration Guide

### Enabling the Body (ESP-NOW)

1. Flash SkuttleBody onto the hexapod ESP32.
2. Open Serial Monitor on the body and note its MAC address (printed at boot).
3. In `Arduino/Skuttleshell/config.h`, add:
   ```cpp
   #define HAS_ESPNOW_TX
   #define BODY_MAC { 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF }  // replace with real MAC
   ```
4. In `Skuttleshell.ino` setup(), add:
   ```cpp
   #ifdef HAS_ESPNOW_TX
   const uint8_t bodyMac[] = BODY_MAC;
   SkuttleESPNOW::begin(bodyMac);
   #endif
   ```
5. Reflash the head. Head and body must be on the same WiFi channel.

### Enabling the Microphone (INMP441)

1. Wire INMP441: SCK→GPIO14 (I2S_BCLK), WS→GPIO2 (I2S_LRC), SD→GPIO40 (I2S_MIC_SD).
2. In `config.h`, uncomment `#define HAS_AUDIO_IN`.
3. In `PC/UI/renderer.js`, subscribe to `window.electronAPI.on('micData', handler)` and pipe to Althea STT.

### Connecting Body Directly to PC (no head)

The body's WebSocket server is always active in WiFi mode (default — `HAS_ESPNOW_RX` not defined).
Point the PC at `ws://skuttlebody.local:8080/Command` instead of `ws://skuttlehost.local:8080/Command`.
The command string format is identical.

---

## File Structure

```
SkuttlebotDevKit/
├── ARCHITECTURE.md          ← you are here
├── README.md
├── package.json             ← Electron app manifest
├── PC/
│   └── UI/
│       ├── main.js          ← Electron main process
│       ├── windowManager.js
│       ├── websocketManager.js
│       ├── audioManager.js
│       ├── audioCapture.js
│       ├── renderer.js      ← browser context
│       └── preload.js       ← IPC context bridge
└── Arduino/
    ├── Libraries/
    │   └── SkuttleCore/     ← shared library (install in Arduino IDE)
    │       ├── SkuttleCore.h
    │       ├── SkuttleIntent.h
    │       ├── SkuttleParser.h
    │       └── SkuttleParser.cpp
    ├── Skuttleshell/        ← HEAD unit sketch
    │   ├── Skuttleshell.ino
    │   ├── config.h         ← DO NOT COMMIT (has WiFi credentials)
    │   ├── config.h.template
    │   ├── SkuttleWIFI.h/.ino
    │   ├── Skuttlecam.h/.ino
    │   ├── Skuttlesound.h/.ino
    │   ├── Skuttlemove.h/.ino
    │   ├── SkuttleESPNOW.h/.ino
    │   ├── Signalchk.h/.ino
    │   └── camera_pins.h
    └── SkuttleBody/         ← BODY unit sketch (hexapod)
        ├── SkuttleBody.ino
        ├── config.h         ← DO NOT COMMIT (has WiFi credentials)
        ├── BodyComms.h/.ino
        └── HexapodExecutor.h/.ino
```

---

## Adding a New Body Type

1. Create `Arduino/SkuttleNewBody/`.
2. Copy `SkuttleBody/config.h`, set unit type and servo IDs.
3. Copy `BodyComms.h/.ino` — no changes needed (same command layer).
4. Create `NewBodyExecutor.h/.ino` implementing `executeIntent(SkuttleIntent&)`.
5. Create main sketch calling `comms.begin()` and `executor.setup()`.

The head, PC app, and Althea integration require zero changes.
