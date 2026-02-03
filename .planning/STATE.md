# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-31)

**Core value:** Architecture as the Advantage - Zero Latency, Zero Egress, Zero Per-Seat Tax
**Current focus:** MVP Released — ready for test users

## Current Position

Phase: 14 (mvp-packaging-and-release) — COMPLETE
Plan: 5 of 5
Status: DEPLOYED — MVP live for test users
Last activity: 2026-02-03 — Landing page deployed to Vercel

Progress: MVP branch [██████████] 14-01, 14-02, 14-03, 14-04, 14-05 done — RELEASED

## MVP Deployment

**Landing Page:** https://samsaralanding.vercel.app
**Download:** https://github.com/King-Rizla/Samsara.mvp/releases/download/MVP-v0.1.0/Samsara-win32-x64-1.0.0.zip
**Version:** MVP v0.1.0
**Repos:**

- App code: https://github.com/King-Rizla/Samsara.mvp
- Landing: https://github.com/King-Rizla/Samsara.landing

## Performance Metrics

**Velocity:**

- Total plans completed: 52 (v1: 47, Phase 14: 5)
- Average duration: 11 min
- Total execution time: ~7.5 hours

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

### Blockers/Concerns

- PDF parsing failure rate reduced with pdfplumber fallback (target <10%)
- macOS Gatekeeper rejects unsigned Python binaries
- Voice AI provider space is fast-moving — ElevenLabs + Twilio SIP needs verification before Phase 11
- macOS system audio capture deferred (BlackHole requirement)

## Session Continuity

Last session: 2026-02-03
Stopped at: Phase 14 COMPLETE — MVP deployed and live
Resume file: None

## Next Steps

**MVP is live.** Test users can download from https://samsaralanding.vercel.app

### Phase 14 Summary (COMPLETE)

| Plan  | Description                      | Status |
| ----- | -------------------------------- | ------ |
| 14-01 | Build configuration foundation   | ✓      |
| 14-02 | PDF parser resilience            | ✓      |
| 14-03 | First-run onboarding             | ✓      |
| 14-04 | Installer fixes (Squirrel + ZIP) | ✓      |
| 14-05 | Landing page + deployment        | ✓      |

### What's Next

- Gather feedback from test users
- Address critical bugs reported
- Plan M2 (Automated Outreach) when ready
