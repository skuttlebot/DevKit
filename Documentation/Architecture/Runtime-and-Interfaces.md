# Runtime and Interfaces

This page records the current interfaces observed in source. It intentionally
does not promise that every interface is wired end to end; known gaps are
linked to the issue register.

## Desktop Electron boundary

`PC/UI/main.js` is the Electron main-process entry point. `preload.js` exposes
a narrow `window.electronAPI` bridge to `renderer.js`.

| Renderer action | IPC channel | Main-process action |
| --- | --- | --- |
| Send motion JSON | `r2m` | Send to the command WebSocket when it is available. |
| Play a test tone | `playTone` | Generate and queue a 440 Hz tone for the sound WebSocket. |
| Start/stop audio stream | `streamToggle` | Start or stop FFmpeg-backed capture and sound transmission. |
| Window readiness | `Ready` | Begin the command-WebSocket connection attempt. |

The main process emits renderer notifications through the preload bridge,
including `status`, `video`, `no-video`, `triggerTX`, `triggerRX`,
`updateFuelGauge`, and `updateRSSI`.

The exact renderer API and the emitted notification paths should be preserved
when editing either `preload.js` or `renderer.js`: they are cross-process
contracts.

## WebSocket services

The head unit starts an `AsyncWebServer` on port 8080 and registers these
paths:

| Endpoint | Direction | Current payload |
| --- | --- | --- |
| `/Command` | bidirectional text | JSON `SkuttleIntent`; `handshake,...`; `ping` / `pong`; camera-connect messages. |
| `/Camera` | head to PC, binary | Individual JPEG camera frames. |
| `/Sound` | PC to head, binary/text | 16-bit PCM chunks; the text sentinel `EOA` marks end of audio. Head replies with `READY`, `PAUSE`, or `RESUME` for flow control. |

The PC WebSocket manager targets `ws://skuttlehost.local` and attempts port
8080 first, then port 8081 after a timeout while no device response is seen.
The firmware in this repository listens on 8080. The body, when built in its
default Wi-Fi mode, listens at `ws://skuttlebody.local:8080/Command`.

### Command lifecycle

1. The renderer maps gamepad state to an intent object and serializes it as
   JSON.
2. The head or body parses the JSON with `SkuttleParser::parseIntent`.
3. The parser supplies defaults for omitted fields and assigns `timestamp`
   using that device's `millis()` clock.
4. The head drives its wheel/tilt actuators and, if compiled and initialized
   for ESP-NOW, forwards the intent to the body.
5. The body executes the latest intent on a 50 Hz task. It rejects an intent
   older than `SKUTTLEINTENT_MAX_AGE_MS` (500 ms).

## `SkuttleIntent` contract

Defined in `Arduino/Libraries/SkuttleCore/SkuttleIntent.h`.

| Field | Meaning |
| --- | --- |
| `moveX` | Strafe request, -1 left to +1 right. Current wheel and hexapod executors do not use it. |
| `moveY` | Forward/backward request, -1 backward to +1 forward. |
| `turnZ` | Yaw request, -1 clockwise to +1 counter-clockwise. |
| `speed` | Throttle, 0 to 1. Defaults to 1 when omitted. |
| `panX`, `tiltY` | Head pointing requests. The checked-in head firmware applies `tiltY`; `panX` has no observed executor. |
| `emergencyStop` | Requests immediate wheel stop or hexapod halt. |
| `cameraToggle` | Toggles the head's camera-connection notification. |
| `timestamp`, `seqNum` | Transport metadata. `timestamp` is set when JSON is parsed; the head assigns `seqNum` only in its ESP-NOW send branch. |

Example payload:

```json
{
  "moveX": 0,
  "moveY": 0.75,
  "turnZ": -0.2,
  "speed": 1,
  "panX": 0,
  "tiltY": 0,
  "emergencyStop": false,
  "cameraToggle": false
}
```

## Firmware roles

### Head: `Arduino/Skuttleshell/`

- Configures Wi-Fi, mDNS hostname `skuttlehost`, Arduino OTA, and the port-8080
  WebSocket server.
- Initializes the OV2640 camera path, I2S audio-output path, and Feetech serial
  servo bus.
- Runs wheel/tilt control every 20 ms from the most recently parsed intent.
- Sends JPEG buffers through `/Camera` while a camera client is connected.
- Accepts PCM chunks on `/Sound`, buffers them, and plays them on the I2S amp.

### Body: `Arduino/SkuttleBody/`

- Configures Wi-Fi, mDNS hostname `skuttlebody`, and Arduino OTA.
- Uses exactly one inbound-command mode at compile time:
  - default: `/Command` WebSocket on port 8080;
  - `HAS_ESPNOW_RX`: ESP-NOW receive callback and no body WebSocket server.
- Runs a 50 Hz task to deliver the newest non-stale intent to the hexapod
  executor.
- Maps forward/backward and yaw to an 18-servo alternating-tripod gait.

## Audio and camera paths

The intended data paths are straightforward but not both complete in the
desktop app:

```text
PC capture -> /Sound binary PCM -> I2S amp
OV2640 JPEG -> /Camera binary frame -> desktop renderer
```

The head confirms the camera and audio firmware paths. The current desktop
WebSocket manager opens `/Camera` but does not register a `message` listener to
forward JPEG data, and the current FFmpeg capture invocation needs parameter
and format validation. See `INT-002` and `INT-003`.

## Boundaries that are not live APIs

`PC/Server/server.js` is a commented placeholder for a former Express server;
it does not expose a running HTTP API. ALTHEA integration is described as a
future direction, but no checked-in HTTP or WebSocket API provides a direct
ALTHEA-to-DevKit integration at this time.
