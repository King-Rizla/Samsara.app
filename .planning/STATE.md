# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-31)

**Core value:** Architecture as the Advantage - Zero Latency, Zero Egress, Zero Per-Seat Tax
**Current focus:** M2 Automated Outreach - Phase 10 (Automated Outreach Sequences)

## Current Position

Phase: 10 of 14 (outreach-workflow-engine)
Plan: 2 of 3 complete
Status: In progress
Last activity: 2026-02-04 - Completed 10-02-PLAN.md (Reply polling and workflow triggers)

Progress: M2 [████████░░░░░░░░░░] 3.5/6 phases | Phase 10 plan 2/3 complete

## MVP Status (Separate Branch)

MVP v0.1.0 shipped on `mvp` branch - see `.planning/RELEASE-WORKFLOW.md` for update process.

- Landing: https://samsaralanding.vercel.app
- Download: https://github.com/King-Rizla/Samsara.mvp/releases

## Performance Metrics

**Velocity:**

- Total plans completed: 56 (v1: 47, M2 Phase 8: 3, M2 Phase 9: 4, M2 Phase 10: 2)
- Average duration: 11 min
- Total execution time: ~8.2 hours

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

**M2 architectural decisions:**

- Polling-first for SMS/email/voice status (no webhooks - desktop app constraint)
- XState for outreach workflow state machine
- ElevenLabs Conversational AI + Twilio SIP for voice screening
- System audio capture via Windows WASAPI (macOS deferred)
- Local transcription via faster-whisper (Python sidecar)
- Chrome extension for ATS DOM bridge
- Framer Motion (motion package) for wheel animations
- safeStorage (Electron) for credential encryption
- DAT requirements distributed across phases (no separate data-only phase)
- DAT-V5: All 7 M2 tables created in single migration v5 block

**Phase 8 completed (2026-01-31):**

- Nested routing with ProjectLayout + Outlet
- CandidateSearchSection extracted from ProjectView
- SamsaraWheel SVG donut with 5 purple-spectrum wedges
- Hover-retreat animation pattern (non-hovered scale to 0.95)
- ProjectStatsBar with live store data
- Database migration v5 with 7 M2 outreach tables

**Phase 9 completed (2026-02-04):**

- 09-01: Credential manager with safeStorage encryption, CommunicationSettings UI
- 09-02: Template engine with {{variable}} substitution and live preview
- 09-03: SMS/email sending via Twilio + Nodemailer, delivery polling, DNC registry, OutreachSection UI
- 09-04: UAT gap closure - header overflow, AlertDialog delete, Outreach enabled, visibility fixes

**Phase 10 in progress (2026-02-04):**

- 10-01: XState v5 workflow engine with SQLite persistence, graduation IPC, TypeScript 5.6 upgrade
- 10-02: Reply polling (30s), keyword intent classification, working hours queueing, WRK-05 callbacks

| Decision              | Choice                       | Rationale                                   |
| --------------------- | ---------------------------- | ------------------------------------------- |
| Credential encryption | safeStorage (DPAPI/Keychain) | OS-level encryption, no app secrets         |
| Credential fallback   | Project -> global            | Allows global default with overrides        |
| Provider SDK loading  | Dynamic import               | Avoids loading twilio/nodemailer at startup |
| DNC normalization     | Digits only / lowercase      | Consistent matching regardless of format    |
| Polling interval      | 60 seconds                   | Balance freshness vs API rate limits        |

| Decision              | Choice                      | Rationale                                          |
| --------------------- | --------------------------- | -------------------------------------------------- |
| Client-side preview   | Generate preview locally    | Instant feedback without IPC round-trip            |
| SMS segment calc      | 160/153 chars               | Standard GSM-7 with UDH header                     |
| Delete confirmation   | AlertDialog (not two-click) | Radix DropdownMenu closes between clicks           |
| Empty state contrast  | text-foreground/70          | Better readability than text-muted-foreground      |
| TypeScript version    | 5.6                         | XState v5 requires TS 5+ for type definitions      |
| Snapshot persistence  | On every state change       | Ensures durability across app restarts             |
| Actor model           | Actor-per-candidate         | Independent workflow instances, easy persistence   |
| Intent classification | Keyword-based               | Simple, predictable, ambiguous treated as positive |
| Reply polling         | 30 seconds                  | Faster than delivery polling for real-time feel    |

### Pending Todos

- **[PERFORMANCE]** LLM extraction takes ~50 seconds - needs optimization
- **[PROMPT]** JD extraction prompt produces truncated booleans and fewer skills
- **[DESIGN]** Matching architecture rethink (auto-trigger, project=1 JD)

### Blockers/Concerns

- PDF parsing may fail on 30-40% of real resumes (pdfplumber fallback added in MVP)
- macOS Gatekeeper rejects unsigned Python binaries
- Voice AI provider space is fast-moving - ElevenLabs + Twilio SIP needs verification before Phase 11
- macOS system audio capture deferred (BlackHole requirement)

## Session Continuity

Last session: 2026-02-04
Stopped at: Completed 10-02-PLAN.md (Reply polling and workflow triggers)
Resume file: None

## Next Steps

**Phase 10: Automated Outreach Sequences (continued)**

Remaining plans:

- 10-03: Kanban UI with graduation controls and workflow visualization

**Deferred tests (must verify in Phase 10):**

- View graduated candidates in Outreach list
- Select candidate and view timeline
- Open Send Message dialog
- SMS character count display
- DNC warning prevents sending
