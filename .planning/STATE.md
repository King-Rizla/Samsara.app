# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Architecture as the Advantage - Zero Latency, Zero Egress, Zero Per-Seat Tax
**Current focus:** Phase 1 - Foundation & Distribution

## Current Position

Phase: 1 of 6 (Foundation & Distribution)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-01-24 - Completed 01-02-PLAN.md (Python Sidecar)

Progress: [##........] 12% (2/17 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 22 min
- Total execution time: 0.72 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation & Distribution | 2/3 | 43 min | 22 min |
| 2. Parsing Pipeline | 0/3 | - | - |
| 3. Visual Editor | 0/2 | - | - |
| 4. JD Matching | 0/3 | - | - |
| 5. Anonymization & Branding | 0/3 | - | - |
| 6. Bulk Processing & OS Integration | 0/3 | - | - |

**Recent Trend:**
- Last 5 plans: 10 min, 33 min
- Trend: Python/PyInstaller setup takes longer due to dependency resolution

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Research] PDF parsing may fail on 30-40% of real resumes - need adversarial corpus in Phase 2
- [Research] PyInstaller hidden imports for spaCy are finicky - RESOLVED in 01-02
- [Research] macOS Gatekeeper rejects unsigned Python binaries - sign ALL binaries including PyInstaller output

## Session Continuity

Last session: 2026-01-24
Stopped at: Completed 01-02-PLAN.md (Python Sidecar with PyInstaller)
Resume file: None
