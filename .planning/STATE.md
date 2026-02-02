# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-31)

**Core value:** Architecture as the Advantage - Zero Latency, Zero Egress, Zero Per-Seat Tax
**Current focus:** Phase 14 — MVP Packaging & Release (mvp branch)

## Current Position

Phase: 14 (mvp-packaging-and-release) — mvp branch
Plan: 4 of 4
Status: VERIFIED — installer builds, installs, creates desktop icon, app launches correctly
Last activity: 2026-02-02 — Installer verified working (Squirrel + ZIP)

Progress: MVP branch [██████████] 14-01, 14-02, 14-03, 14-04 done — verified

## Performance Metrics

**Velocity:**

- Total plans completed: 47 (v1: 47)
- Average duration: 11 min
- Total execution time: ~6.9 hours

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

**Phase 14 packaging decisions (2026-02-02):**

- `better-sqlite3` native module requires `bindings` and `file-uri-to-path` copied alongside it in `packageAfterCopy` hook
- `asarUnpack` must include all three: `better-sqlite3`, `bindings`, `file-uri-to-path`
- Vite renderer `outDir` must include `main_window` subdirectory to match `MAIN_WINDOW_VITE_NAME` constant at runtime
- Squirrel installer verified working after fixing all three issues
- ZIP fallback also produced for portable distribution
- `outDir` set to `out` in forge.config.ts (canonical); stale dirs (`dist/`, `build/`, `release/`, `installer/`) gitignored

**M2 architectural decisions:**

- Polling-first for SMS/email/voice status (no webhooks — desktop app constraint)
- XState for outreach workflow state machine
- ElevenLabs Conversational AI + Twilio SIP for voice screening
- System audio capture via Windows WASAPI (macOS deferred)
- Local transcription via faster-whisper (Python sidecar)
- Chrome extension for ATS DOM bridge
- Framer Motion for wheel animations
- safeStorage (Electron) for credential encryption
- DAT requirements distributed across phases (no separate data-only phase)

### Pending Todos

- **[PERFORMANCE]** LLM extraction takes ~50 seconds - needs optimization
- **[PROMPT]** JD extraction prompt produces truncated booleans and fewer skills
- **[DESIGN]** Matching architecture rethink (auto-trigger, project=1 JD)
- **[CLEANUP]** Delete stale build dirs after reboot: `out/`, `dist/`, `build/`, `release/`, `installer/` (locked by asar file handles in current session)

### Blockers/Concerns

- PDF parsing failure rate reduced with pdfplumber fallback (target <10%)
- macOS Gatekeeper rejects unsigned Python binaries
- Voice AI provider space is fast-moving — ElevenLabs + Twilio SIP needs verification before Phase 11
- macOS system audio capture deferred (BlackHole requirement)

## Session Continuity

Last session: 2026-02-02
Stopped at: Phase 14 verified — installer working, needs commit and cleanup
Resume file: None

## Next Steps

**Immediate:** Commit all Phase 14 fixes, then cleanup wave

### Phase 14 Fixes Applied (uncommitted)

1. **forge.config.ts** — Three fixes:
   - `asarUnpack` includes `bindings` and `file-uri-to-path` alongside `better-sqlite3`
   - `packageAfterCopy` copies all three native module deps
   - Added `MakerSquirrel` with `setupExe: "SamsaraSetup.exe"` + `MakerZIP` for win32
   - `outDir` set to `out` (changed from default during debugging)

2. **vite.renderer.config.ts** — `outDir` changed to `.vite/renderer/main_window` so production `loadFile` path matches `MAIN_WINDOW_VITE_NAME`

3. **src/main/index.ts** — `electron-squirrel-startup` re-added (needed for install/uninstall shortcut lifecycle)

4. **.gitignore** — Added `dist/`, `build/`, `release/`, `installer/` to gitignore

### Cleanup Wave (end of phase)

- [ ] Delete stale build dirs: `out/`, `dist/`, `build/`, `release/`, `installer/` (requires reboot to release asar locks)
- [ ] Remove `out_old/` if it exists
- [ ] Verify `npm start` (dev mode) still works after vite.renderer.config.ts change
- [ ] Run typecheck and lint
- [ ] Commit all changes

**WARNING:** Do NOT use `rm -rf` or `cat` against asar files from bash — it locks them on Windows. Use `cmd.exe /c rd /s /q` or delete from Explorer.
