# DevKit Overview

## What this repository is

DevKit is the control and firmware layer for a Skuttle robot. It is not an AI
runtime: it gives a desktop controller and future AI client a physical
interface for motion, camera, and audio.

The repository has three primary runtime areas:

| Area | Location | Verified responsibility |
| --- | --- | --- |
| Desktop controller | `PC/UI/` | Electron app that reads a browser gamepad, creates JSON motion intents, and manages device WebSockets. |
| Head unit | `Arduino/Skuttleshell/` | ESP32-S3 firmware that hosts command, camera, and sound WebSockets; drives wheel/tilt servos; and can relay an intent to a body. |
| Body unit | `Arduino/SkuttleBody/` | ESP32 firmware that accepts an intent through either ESP-NOW or WebSocket and turns it into a six-leg tripod gait. |

`Arduino/Libraries/SkuttleCore/` defines the shared `SkuttleIntent` contract
and its JSON parser. That contract is the intended hardware-abstraction
boundary: a command producer expresses desired movement without knowing
whether the target uses wheels or legs.

## Runtime map

```text
USB gamepad
    |
    v
Electron renderer -> Electron main process -> /Command WebSocket
                                                  |
                                                  v
                                       Skuttleshell (ESP32-S3 head)
                                          |                 |
                                          |                 +--> /Camera and /Sound WebSockets
                                          v
                                      local wheels / tilt
                                          |
                                   optional ESP-NOW
                                          v
                                 SkuttleBody (hexapod)
```

The body may instead be used without a head. In that mode it provides its own
`/Command` endpoint at `skuttlebody.local:8080`.

## Current-status snapshot

The source contains a meaningful platform foundation, but the desktop-to-head
control path is not currently verified as operational. In particular, the
Electron main process reads connection state and socket objects from
`PC/UI/config.js`, while `PC/UI/websocketManager.js` maintains separate,
private state and sockets. See `INT-001` in
[../Issues/KNOWN_ISSUES.md](../Issues/KNOWN_ISSUES.md).

Treat these as distinct categories:

- **Implemented in firmware:** JSON intent parsing; wheel/tilt control;
  camera JPEG emission; sound buffering/playback; body WebSocket reception;
  basic hexapod gait execution.
- **Implemented but not fully integrated:** desktop WebSocket connection
  management, camera connection state, desktop audio capture, and optional
  ESP-NOW support.
- **Planned or incomplete:** an end-to-end microphone/STT path, a verified
  camera-frame bridge to the renderer, and an ALTHEA-facing embodiment API.

## Entry points

| Component | Entry point | How it starts |
| --- | --- | --- |
| Desktop app | `PC/UI/main.js` | `npm start` runs `electron PC/UI/main.js`. |
| Head firmware | `Arduino/Skuttleshell/Skuttleshell.ino` | Open the sketch folder in Arduino IDE and upload to the configured head board. |
| Body firmware | `Arduino/SkuttleBody/SkuttleBody.ino` | Open the sketch folder in Arduino IDE and upload to the configured body board. |

## Safety boundary

`emergencyStop` is part of every `SkuttleIntent` and makes the wheel controller
write zero speed; the hexapod executor stops issuing new gait positions. This
is not a complete communications-loss safety system: the head's command
disconnect handler contains only a TODO for a full stop. Do not rely on a
network disconnect as an emergency stop until that behavior is implemented and
tested with hardware.
