# Known Issues and Verification Gaps

This is the current, evidence-backed issue register for DevKit. IDs are stable
so a fix, test, or handoff can refer to one issue precisely. An issue describes
checked-in source behavior; it is not a claim about a specific hardware setup
unless hardware testing confirms it.

## Integration

### INT-001 — Desktop command socket state is split

**Severity:** high — blocks verified PC-to-robot control.

`PC/UI/main.js` checks `isConnectedCommand` and reads `wsCommand` from
`PC/UI/config.js`. `PC/UI/websocketManager.js` instead owns separate local
state and a separate local `wsCommand`, and exports neither socket nor state
updates. As written, the main-process `r2m` handler has no demonstrated route
to the socket opened by the connection manager.

**Resolution direction:** make one module the authoritative owner of both
socket lifecycle and connection state, then expose a small send API rather
than sharing mutable socket references.

### INT-002 — Camera frames do not reach the renderer

**Severity:** high — blocks camera display.

The head sends JPEG bytes through `/Camera`; `websocketManager.js` opens that
WebSocket but has no `message` handler for it. No IPC event forwards camera
frames to `preload.js` or `renderer.js`. The renderer's `video` handling is
therefore not connected to actual camera payloads.

**Resolution direction:** add a binary frame listener, transfer or encode the
data safely over IPC, and render it as an image/jpeg blob. Test frame cleanup
to avoid object-URL or memory leaks.

### INT-003 — Desktop audio capture parameters and format are inconsistent

**Severity:** high — blocks verified microphone-to-speaker streaming.

`audioManager.startStreaming()` calls `audioCapture.startCapture()` without a
sample-rate argument, but `startCapture()` calls `sampleRate.toString()`.
Also, FFmpeg is invoked with `-f wav`, while the head audio handler expects
16-bit PCM chunks; a WAV header is not stripped in the desktop path.

**Resolution direction:** define one PCM transport contract (sample format,
rate, channels, byte order), pass explicit capture parameters, and add an
integration test using recorded audio.

### INT-004 — Microphone return path is documented but absent in head firmware

**Severity:** medium.

The PC manager has a `/Mic` connection function and comments describe an
INMP441/STT path. `Skuttleshell.ino` only registers `/Command`, `/Camera`, and
`/Sound`; no `/Mic` socket or I2S microphone implementation is present.

### INT-005 — Head ESP-NOW setup is incomplete when enabled

**Severity:** medium.

The head command handler sends an intent through `SkuttleESPNOW::send()` when
`HAS_ESPNOW_TX` is defined, but `Skuttleshell.ino` does not call
`SkuttleESPNOW::begin(...)` in `setup()`. The transmitter peer is therefore
not initialized by the checked-in setup path.

### INT-006 — Command disconnect does not trigger a device stop

**Severity:** safety-relevant.

On `/Command` disconnection, the head firmware clears its client pointer and
contains a `//full stop routine!!!` comment, but performs no stop action.
The retained intent can therefore remain the last motion command. Test and
implement a positive stop-on-loss policy before relying on unattended motion.

## Security and configuration

### SEC-001 — Firmware configuration with network secrets is tracked

**Severity:** high.

Both firmware `config.h` files are tracked by Git and contain Wi-Fi
configuration. Credential values are intentionally not repeated here.

**Resolution direction:** rotate exposed credentials; introduce a committed
template plus ignored local configuration; remove secret-bearing files from
version history according to the project's credential-rotation process.

### SEC-002 — OTA has no documented access-control policy

**Severity:** medium.

Both head and body initialize Arduino OTA. The source documents no OTA
password, certificate, network restriction, or operator policy. Limit use to
trusted networks until a deliberate policy is implemented and documented.

## Documentation drift

### DOC-001 — Root architecture document contains unverified runtime claims

`ARCHITECTURE.md` is a useful design reference, but several of its described
paths are not fully wired in current sources, including camera delivery to the
renderer, microphone ingestion, and shared desktop socket state. Build and
maintenance work should use this `Documentation/` folder plus source as the
current reference.

### DOC-002 — Referenced configuration templates are not present

The root architecture document refers to `config.h.template` files, but no
such files are currently present under the head or body sketch folders. Add
sanitized templates before removing or restructuring the existing local
configuration files.
