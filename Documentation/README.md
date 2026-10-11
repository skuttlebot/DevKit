# DevKit Documentation

This folder is the maintenance documentation for the Skuttlebot DevKit. It
describes the checked-in code as it exists today, with clear labels where a
design is planned but not yet wired end to end.

Start with [General/Overview.md](General/Overview.md) for the project shape,
then use the document matching the task:

- [Architecture/Runtime-and-Interfaces.md](Architecture/Runtime-and-Interfaces.md)
  — process boundaries, firmware roles, message formats, and data paths.
- [Operations/Setup-and-Deployment.md](Operations/Setup-and-Deployment.md)
  — local prerequisites, safe configuration, Electron startup, and firmware
  flashing guidance.
- [Issues/KNOWN_ISSUES.md](Issues/KNOWN_ISSUES.md) — evidence-backed gaps and
  compatibility concerns in the current source tree.
- [Triage/PLATFORM_TRIAGE.md](Triage/PLATFORM_TRIAGE.md) — recommended keep,
  replace, and retire decisions for evolving the RC prototype into an ALTHEA
  embodiment.

## Documentation rules

- **Live source wins.** These notes are a guide, not a replacement for the
  implementation.
- **Verified** means behavior was checked against the repository source on
  2026-10-10. **Planned** means it is represented in comments or architecture
  material but is not confirmed as a complete runtime path.
- Do not place Wi-Fi passwords, device tokens, or other secrets in this folder.
  Use local configuration that is excluded from version control.
- Keep historical or aspirational material distinct from the current runtime.
  [../ARCHITECTURE.md](../ARCHITECTURE.md) remains useful as a system-design
  reference; these pages identify where it diverges from current wiring.

## Scope

DevKit contains the local control surface and embedded firmware for Skuttle:

```text
Electron desktop controller <-> ESP32-S3 head unit <-> optional ESP32 body
```

The desktop app produces body-agnostic motion intents. The head unit exposes
WebSocket services for control, camera, and sound, and can pass intents to a
hexapod body over ESP-NOW. The body can alternatively receive an intent
directly over its own WebSocket endpoint.
