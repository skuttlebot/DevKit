# Skuttle Platform Triage

## Purpose

This is a product and technical triage for evolving Skuttle from a working
PC-operated RC prototype into an embodiment through which ALTHEA can observe,
communicate, and act. It is not a rewrite order. The goal is to preserve what
proved useful in hardware while replacing accidental complexity before it
becomes a long-term integration burden.

The central conclusion is: **keep the PC-heavy architecture, but replace the
ad-hoc transport and duplicated state around it with explicit contracts.** The
ESP32s should remain the embodiment's I/O and safety layer, while the PC (and
eventually ALTHEA) owns higher-level perception, interaction, planning, and
operator control.

## The two codebases

There are two distinct execution codebases with different constraints. They
should share protocols, not implementation details.

| Codebase | Current location | Long-term role |
| --- | --- | --- |
| **PC control plane** | `PC/UI/` | Operator UI, ALTHEA adapter, high-level command arbitration, video/audio processing, logging, configuration, and update tooling. |
| **Embedded embodiment firmware** | `Arduino/Skuttleshell/`, `Arduino/SkuttleBody/`, and `Arduino/Libraries/SkuttleCore/` | Device discovery, local sensors/actuators, low-latency movement execution, network transport, and fail-safe behavior. |

Within the embedded codebase, the head and body are *deployment variants*, not
independent product architectures:

- **Head + body:** `Skuttleshell` is a sensor/communications head; it can
  operate wheels and relay high-level motion intent to the hexapod body.
- **Single unit:** one ESP32-based unit hosts the relevant sensor, audio, and
  actuator capabilities directly. It still uses the same command and telemetry
  model, without requiring a detachable head.

The single-unit versus head-and-body choice must be a hardware/product decision
made per embodiment. It should not change ALTHEA's command vocabulary.

## What the prototype got right

The current system was valuable precisely because it worked in the physical
world. These ideas should survive, even where their implementation changes.

| Keep | Why it matters | Recommended evolution |
| --- | --- | --- |
| PC-heavy compute model | A PC is the appropriate home for AI integration, operator UI, vision, STT/TTS, storage, and iteration speed. | Make the PC a deliberate control plane with a named device-session service rather than scattered Electron globals. |
| Body-agnostic `SkuttleIntent` | Separates *desired motion* from wheels, legs, or future bodies. | Keep the semantic shape, version it, add command IDs/timestamps from the authoritative sender, and define acknowledgements. |
| Modular head/body topology | Supports a lightweight communicative head plus an independently capable hexapod. | Keep it as an optional topology; avoid forcing every embodiment through ESP-NOW. |
| Local device autonomy | Motors, audio, camera, and connection recovery cannot depend on an LLM response round trip. | Make the safety and degraded-mode rules explicit and testable. |
| WebSocket-era interactive control | It proved a workable low-friction RC control path. | Retain WebSocket only where it remains the simplest fit; standardize the protocol rather than preserving the current manager. |
| Shared embedded library | `SkuttleCore` already identifies a real cross-device boundary. | Turn it into a small versioned protocol/safety library, not a catch-all firmware dependency. |

## What should be replaced

These are not criticisms of the prototype; they are the places where a
successful experiment should now become a maintainable system.

| Replace | Current limitation | Direction |
| --- | --- | --- |
| Electron-owned WebSocket globals | Connection state and socket ownership are split, which prevents a reliable command path (`INT-001`). | Introduce one PC-side `DeviceSession`/transport owner with explicit connect, send, subscribe, reconnect, and close operations. |
| Implicit string messages | Handshake, heartbeat, status, and flow-control messages are spread across source and are only partly specified. | Publish a versioned message schema for command, telemetry, capability advertisement, acknowledgement, and error messages. |
| Raw audio streaming path | Capture parameters and wire format are inconsistent (`INT-003`). | Use a defined media strategy: initially PCM with fixed metadata and framing, or move to a standard real-time stack if bidirectional low-latency audio becomes central. |
| Camera one-off forwarding | Firmware emits JPEG frames, but the desktop bridge is absent (`INT-002`). | Start with a documented JPEG/MJPEG-over-WebSocket pipeline if it meets latency needs; evaluate WebRTC only when its NAT/media features justify its complexity. |
| Per-feature, hard-coded topology | Hostnames, ports, and endpoints are embedded in the PC code. | Use a device manifest/capability handshake and configuration profile. A session should learn whether it is speaking to a head, a body, or an integrated unit. |
| Best-effort safety behavior | Disconnect does not currently command a stop (`INT-006`). | Put safety at the embedded boundary: watchdog/lease expiry, explicit stop, bounded command rate, and physical e-stop handling. |

## What to retire or quarantine

| Item | Decision | Reason |
| --- | --- | --- |
| `PC/Server/server.js` placeholder | Retire or move to an archive when confirmed unused. | It is commented scaffolding, not a service. Do not revive it without an explicit API use case. |
| Legacy CSV-style command documentation | Quarantine as historical protocol material. | Current firmware parses JSON `SkuttleIntent`; maintaining two command formats causes drift. |
| Browser-to-main direct transport assumptions | Replace. | Electron's preload bridge should expose intentional operations, not transport internals. |
| Duplicate PC state containers | Replace. | A single connection/session authority is required before ALTHEA integration. |
| Credential-bearing tracked firmware config | Replace urgently. | Use sanitized templates and ignored local secrets (`SEC-001`). |

## Recommended target architecture

```text
                         ALTHEA
                           |
                 embodiment capability API
                           |
                  PC control-plane service
          +----------------+----------------+
          |                |                |
     operator UI      perception/media   device session
      (Electron)       (vision/STT/TTS)  (protocol owner)
                                              |
                                   versioned device protocol
                                              |
                     +------------------------+---------------------+
                     |                                              |
             integrated ESP32 unit                       head + body units
       sensors / speakers / actuators          head I/O <-> body locomotion
```

ALTHEA should interact with a narrow embodiment capability API, not directly
with Electron IPC or individual ESP32 WebSocket paths. Example capability
families:

- `observe.camera_frame` / `observe.audio_chunk`
- `speak.play_audio`
- `move.set_velocity` / `move.stop`
- `device.get_status` / `device.set_mode`

The PC control plane translates those capabilities into the device protocol,
records outcomes, and arbitrates between operator and AI authority. Firmware
enforces hard limits and safe defaults regardless of the caller.

## Protocol principles

1. **One command envelope.** Every PC-to-device command carries protocol
   version, command ID, type, timestamp/lease, payload, and optionally an
   authority source (`operator`, `althea`, `system`).
2. **Advertise capabilities.** On connection, a device reports its identity,
   firmware version, hardware role, supported sensors/actuators, and limits.
3. **Acknowledge meaningful commands.** Motion and mode changes need accepted,
   rejected, and completed/stopped semantics; telemetry is separate.
4. **Make stale-command behavior local.** The embedded controller must stop or
   enter a safe state when its command lease expires, even if the PC fails.
5. **Keep media separate from motion control.** A camera or audio backlog must
   not delay a stop command.
6. **Support both physical topologies.** Head/body forwarding can use ESP-NOW,
   Wi-Fi, or another link internally, while the external PC contract remains
   unchanged.

## Delivery order

### Phase 0 — Protect the working prototype

- Rotate and remove tracked network secrets; create safe configuration
  templates.
- Preserve a known-good firmware/PC pairing and record the board, library, and
  wiring versions used with it.
- Add a hardware test checklist for stop, reconnect, steering polarity, camera,
  and speaker output.

### Phase 1 — Make RC control trustworthy

- Fix the single ownership model for the PC device session.
- Implement and test embedded stop-on-command-loss behavior.
- Define and document the version-1 command/telemetry schema.
- Restore one vertical slice: connect -> handshake -> command -> acknowledgement
  -> stop. Do this before adding AI features.

### Phase 2 — Restore perception and communication

- Complete camera-frame delivery to the desktop.
- Choose and implement the audio contract end to end.
- Add capability/status telemetry that identifies available hardware and
  degraded states.

### Phase 3 — Add ALTHEA as a bounded client

- Build the PC-side embodiment adapter around the stable capability API.
- Give ALTHEA permissioned high-level actions, not raw arbitrary packets.
- Keep an operator override and log every AI-issued action with its outcome.

### Phase 4 — Support multiple bodies cleanly

- Treat wheels, hexapod, and future embodiments as capability profiles.
- Validate head/body and single-unit deployments against the same protocol test
  suite.

## Decisions still needed

These are product decisions, not implementation details to guess at:

1. Is the detachable head a required platform feature, or an optional module
   for specific embodiments?
2. Must voice interaction be full-duplex and low latency, or is push-to-talk/
   turn-based speech sufficient for the first ALTHEA integration?
3. What authority model governs simultaneous operator and ALTHEA motion input?
4. Which hardware roles must continue operating when the PC or AI stack is
   unavailable?
5. What physical and software emergency-stop mechanisms are required before
   autonomous movement is allowed?

Until those are decided, the safe default is manual operator authority, no
unattended movement, and embedded stop-on-lease-expiry.
