# Setup and Deployment

## Desktop prerequisites

- Node.js and npm compatible with the repository's Electron version.
- A Windows-compatible installation of FFmpeg on `PATH` for audio capture.
- Network access to the robot's local Wi-Fi network and mDNS resolution for
  `skuttlehost.local` (or a deliberate code/config change to use another host).
- A browser-recognized gamepad for interactive control.

Install the checked-in desktop dependencies and launch the app:

```powershell
npm install
npm start
```

The package script starts `PC/UI/main.js` under Electron. Do not treat a
successful window launch as confirmation that robot control works; first check
the command WebSocket handshake and perform a hardware-safe motion test.

## Firmware prerequisites

Install the ESP32 board support and the libraries referenced by the sketches.
The repository vendors several Arduino libraries under `Arduino/Libraries/`;
the sketches also reference libraries such as ArduinoJson and the Feetech
SCServo library that must be available to the Arduino build environment.

The major board targets documented in source are:

| Sketch | Intended target |
| --- | --- |
| `Arduino/Skuttleshell/` | Freenove ESP32-S3-CAM head unit. |
| `Arduino/SkuttleBody/` | ESP32 AI-Thinker-style body unit. |

Before upload, confirm the active board definition, port, pin assignments,
servo IDs, and feature flags against the physical hardware. A wrong board or
servo configuration can produce unsafe motion.

## Configuration and secrets

The checked-in `config.h` files contain Wi-Fi configuration and are currently
tracked by Git. Do not add, copy, or quote their credential values in issues,
documentation, logs, or commits.

For new setup work:

1. Create an untracked local configuration approach before adding a new
   network secret (for example, a local header excluded through `.gitignore`).
2. Use a dedicated development network where possible.
3. Rotate any credential that may have been committed or shared outside its
   intended environment.
4. Verify `git status` before committing so local settings are not included.

This is tracked as `SEC-001` in [../Issues/KNOWN_ISSUES.md](../Issues/KNOWN_ISSUES.md).

## Head-unit deployment checklist

1. Review `Arduino/Skuttleshell/config.h` for the physical build: unit type,
   camera/audio features, servo IDs, and pin assignments.
2. Upload `Skuttleshell.ino` with the shared `SkuttleCore` library available.
3. Use serial output to confirm Wi-Fi, mDNS, OTA, and the WebSocket server.
4. Confirm the robot advertises `skuttlehost.local` and accepts a command
   handshake on port 8080.
5. Test emergency stop before any sustained motion test.
6. Test camera and sound one at a time with the robot safely supported.

## Body-unit deployment checklist

1. Review `Arduino/SkuttleBody/config.h`, especially the 18 servo IDs and
   serial bus pins.
2. Choose one inbound-control mode:
   - Wi-Fi/WebSocket (default), for standalone tuning from the PC;
   - ESP-NOW (`HAS_ESPNOW_RX`), for an attached head unit.
3. Upload `SkuttleBody.ino`; confirm serial output shows the selected mode.
4. With the robot physically supported, verify `homeAll()` positions every
   leg before asking it to walk.
5. Send a low-speed forward/backward and pivot intent, then verify emergency
   stop behavior.

## Operational cautions

- The head firmware's Wi-Fi fallback can start an access-point configuration
  portal when configured credentials fail. Treat that as a provisioning mode,
  not normal operation.
- OTA is enabled in both head and body firmware. Restrict OTA use to trusted
  networks until an authentication policy is explicitly established.
- The body staleness guard applies to received intent timestamps. The head's
  command-disconnect path does not yet force a stop; keep a direct emergency
  stop and physical safety procedure available during testing.
