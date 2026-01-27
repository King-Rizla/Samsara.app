# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Architecture as the Advantage - Zero Latency, Zero Egress, Zero Per-Seat Tax
**Current focus:** Phase 4.5 - Project Homepage & Organization

## Current Position

Phase: 4.5 of 7 (Project Homepage & Organization) - IN PROGRESS
Plan: 1 of 4 in current phase - COMPLETE
Status: In progress
Last activity: 2026-01-27 - Completed 04.5-01-PLAN.md (Database Schema Migration)

Progress: [################] 87% (20/23 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 20
- Average duration: 14 min
- Total execution time: 2.82 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation & Distribution | 3/3 | 58 min | 19 min |
| 2. Parsing Pipeline | 3/3 | 44 min | 15 min |
| 2.1. LLM Extraction | 2/2 | 50 min | 25 min |
| 3. Visual Editor | 5/5 | 40 min | 8 min |
| 3.T. E2E Test Foundation | 1/1 | 45 min | 45 min |
| 4. JD Matching | 3/3 | ~45 min | 15 min |
| 4.T. JD Matching Tests | 1/1 | ~30 min | 30 min |
| 4.5. Project Homepage | 1/4 | 8 min | 8 min |
| 5. Anonymization & Branding | 0/3 | - | - |
| 5.T. Export & Branding Tests | 0/1 | - | - |
| 6. Bulk Processing & OS Integration | 0/3 | - | - |
| 6.T. Performance & Integration Tests | 0/1 | - | - |

**Recent Trend:**
- Last 5 plans: 6 min, 8 min, 45 min, 30 min, 8 min
- Trend: Database/migration plans fast (~8 min)

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
- [03-03]: Click-to-view loads CV in editorStore for Plan 04 editor pane
- [03-03]: Processing stages update in real-time: Parsing -> Extracting -> Saving
- [03-03]: Low confidence (<70%) items get warning styling on badge
- [03-04]: 400ms debounce delay for auto-save (balances responsiveness with IPC overhead)
- [03-04]: Skills section read-only for now (array editing deferred to future phase)
- [03-04]: 50/50 split-view layout keeps queue visible while editing
- [04-03]: Three-column layout with queue/JD/editor panels (w-1/3 each when editor open)
- [E2E]: DevTools disabled during E2E tests to prevent window capture issues
- [E2E]: Scoped selectors via data-testid (queue-panel, jd-panel, drop-zone) for multi-panel layout
- [04.5-01]: Schema versioning via PRAGMA user_version (simple integer increment)
- [04.5-01]: Idempotent migration with column existence checks before ALTER TABLE
- [04.5-01]: Default Project (id='default-project') created for orphaned CVs/JDs

### Pending Todos

- **[PERFORMANCE]** LLM extraction takes ~50 seconds - needs optimization in future phase
  - Consider smaller/faster model
  - Consider simplified schema
  - Consider parallel processing or caching

### Blockers/Concerns

- [Research] PDF parsing may fail on 30-40% of real resumes - need adversarial corpus testing
- [Research] macOS Gatekeeper rejects unsigned Python binaries - sign ALL binaries including PyInstaller output
- [02.1-02] LLM extraction time (~50s) is too long - future optimization needed

### Roadmap Evolution

- Phase 7 added: Testing and Bug Fixing Protocol (2026-01-26)
- Phase 4.5 inserted after Phase 4.T: Project Homepage & Organization (2026-01-26) - Enables multi-project workflow for recruiters working on multiple job roles simultaneously

## Session Continuity

Last session: 2026-01-27
Stopped at: Completed 04.5-01-PLAN.md (Database Schema Migration)
Resume file: None

## Next Steps

**Phase 4.5: Project Homepage & Organization** - IN PROGRESS (1/4 plans)
- [x] Plan 04.5-01: Database schema migration (projects table, project_id columns)
- [ ] Plan 04.5-02: IPC handlers and project store
- [ ] Plan 04.5-03: Project homepage UI
- [ ] Plan 04.5-04: Project context in existing views

**Database Ready:**
- Projects table created with all columns
- CVs and JDs have project_id column
- Default Project exists for backward compatibility
- CRUD functions ready for IPC exposure

**Next:** Run `/gsd:execute-phase 04.5-02` for IPC handlers and project store.
