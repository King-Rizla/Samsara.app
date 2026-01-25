# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Architecture as the Advantage - Zero Latency, Zero Egress, Zero Per-Seat Tax
**Current focus:** Phase 3 complete - Visual Editor

## Current Position

Phase: 3 of 6 (Visual Editor)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-01-25 - Completed 03-02-PLAN.md (Editor State & Queue Management)

Progress: [#####.....] 53% (10/19 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 16 min
- Total execution time: 2.50 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation & Distribution | 3/3 | 58 min | 19 min |
| 2. Parsing Pipeline | 3/3 | 44 min | 15 min |
| 2.1. LLM Extraction | 2/2 | 50 min | 25 min |
| 3. Visual Editor | 2/2 | 21 min | 11 min |
| 4. JD Matching | 0/3 | - | - |
| 5. Anonymization & Branding | 0/3 | - | - |
| 6. Bulk Processing & OS Integration | 0/3 | - | - |

**Recent Trend:**
- Last 5 plans: 9 min, 12 min, 25 min, 5 min, 45 min
- Trend: State management plan fast (9 min) - no complexity

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
- [02-01]: suppress_stdout() context manager for PyMuPDF to preserve JSON lines IPC
- [02-01]: Multi-column detection via X position gap analysis (>100px threshold)
- [02-01]: Cascading parser strategy: PyMuPDF first, pdfplumber for tables
- [02-02]: British date format with dayfirst=True (3/2/2020 = 3rd Feb)
- [02-02]: Partial dates default to 1st (Jan 2020 -> 01/01/2020)
- [02-02]: Company indicators filtered from PERSON entities (Ltd, Inc, LLC)
- [02-02]: Preserve candidate skill groupings rather than re-categorizing
- [02-03]: webUtils.getPathForFile for context-isolated file access (Electron)
- [02-03]: Native dialog.showOpenDialog as fallback for click-to-select
- [02-03]: 70% confidence threshold for low-confidence field highlighting
- [User]: Local LLM extraction for improved work/education/skills deferred to Phase 2.1
- [02.1-01]: Qwen 2.5 7B default model (Qwen3 breaks JSON with thinking tags)
- [02.1-01]: 60s timeout for extraction, 5m keep_alive to avoid cold-start delays
- [02.1-01]: Never raise exceptions in OllamaClient - return None for fallback
- [02.1-02]: Single unified LLM call instead of 4 separate calls (cost + speed efficiency)
- [02.1-02]: Pass full raw_text to LLM for better multi-column PDF handling
- [02.1-02]: 120s timeout for unified extraction (complex schema)
- [User]: 1 API call always preferred over multiple for cost efficiency
- [03-01]: Tailwind v3 required for shadcn/ui compatibility (v4 incompatible)
- [03-01]: esbuild JSX automatic transform for ESM compatibility with electron-forge
- [03-01]: Terminal dark mode only - no light mode support
- [03-01]: CSS variables-based theming for future customization
- [03-02]: Field path format uses dots for objects, brackets for arrays
- [03-02]: Selection state uses Set for O(1) membership checks
- [03-02]: Pending changes tracked in Map for batch save operations

### Pending Todos

- **[PERFORMANCE]** LLM extraction takes ~50 seconds - needs optimization in future phase
  - Consider smaller/faster model
  - Consider simplified schema
  - Consider parallel processing or caching

### Blockers/Concerns

- [Research] PDF parsing may fail on 30-40% of real resumes - need adversarial corpus testing
- [Research] macOS Gatekeeper rejects unsigned Python binaries - sign ALL binaries including PyInstaller output
- [02.1-02] LLM extraction time (~50s) is too long - future optimization needed

## Session Continuity

Last session: 2026-01-25T15:59:17Z
Stopped at: Completed 03-02-PLAN.md (Editor State & Queue Management)
Resume file: None

## Next Steps

**Phase 4: JD Matching** - Match CVs against job descriptions
- Plan 04-01: JD Input & Parsing
- Plan 04-02: Match Algorithm
- Plan 04-03: Match Results UI

Run `/gsd:plan-phase 04` to start Phase 4.
