# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Architecture as the Advantage - Zero Latency, Zero Egress, Zero Per-Seat Tax
**Current focus:** Phase 2 - Parsing Pipeline

## Current Position

Phase: 2 of 6 (Parsing Pipeline)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-01-24 - Phase 1 complete (Foundation & Distribution)

Progress: [##........] 18% (3/17 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 19 min
- Total execution time: 0.97 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation & Distribution | 3/3 | 58 min | 19 min |
| 2. Parsing Pipeline | 0/3 | - | - |
| 3. Visual Editor | 0/2 | - | - |
| 4. JD Matching | 0/3 | - | - |
| 5. Anonymization & Branding | 0/3 | - | - |
| 6. Bulk Processing & OS Integration | 0/3 | - | - |

**Recent Trend:**
- Last 5 plans: 10 min, 33 min, 15 min
- Trend: Stabilizing after initial Python/PyInstaller setup

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Research]: PyInstaller `--onedir` required (not `--onefile`) for faster startup to meet <2s requirement
- [Research]: spaCy en_core_web_sm model (12MB) for NER, preload at startup
- [Research]: Code signing must happen in Phase 1, not as a last step
- [Questioning]: JD Matching is equally important as formatting - added as Phase 4
- [01-01]: Use concurrent:false in VitePlugin to prevent OOM during builds
- [01-01]: Mark better-sqlite3 as external in Vite rollup options
- [01-01]: WAL mode + synchronous=NORMAL for SQLite performance
- [01-02]: Python 3.12 required - spaCy incompatible with Python 3.14
- [01-02]: Model path detection handles frozen/dev contexts via get_model_path()
- [01-03]: spawn + readline for Python IPC (not python-shell library)
- [01-03]: extraResource for Python sidecar in packaged app

### Pending Todos

None yet.

### Blockers/Concerns

- [Research] PDF parsing may fail on 30-40% of real resumes - need adversarial corpus in Phase 2
- [Research] macOS Gatekeeper rejects unsigned Python binaries - sign ALL binaries including PyInstaller output

## Session Continuity

Last session: 2026-01-24
Stopped at: Phase 1 complete, ready for Phase 2 planning
Resume file: None
