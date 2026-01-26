---
phase: 04-jd-matching
plan: 01
subsystem: jd-matching
tags: [llm, pydantic, sqlite, zustand, react, ipc]

# Dependency graph
requires:
  - phase: 02.1-llm-extraction
    provides: OllamaClient, LLM extraction infrastructure
  - phase: 03-visual-editor
    provides: Zustand patterns, UI component patterns
provides:
  - JD TypeScript types (JobDescription, SkillRequirement, MatchResult)
  - Python LLMJDExtraction schema and JD_EXTRACTION_PROMPT
  - SQLite job_descriptions and cv_jd_matches tables
  - IPC layer for JD operations (extract, get, delete)
  - JDInput component with paste and file upload
  - jdStore Zustand store for JD state
affects: [04-02-matching-algorithm, 04-03-results-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JD extraction via LLM with structured output (Pydantic schema)"
    - "JD input supports both paste and file upload (.txt)"
    - "JD store pattern matches queueStore for consistency"

key-files:
  created:
    - src/renderer/types/jd.ts
    - src/renderer/stores/jdStore.ts
    - src/renderer/components/jd/JDInput.tsx
    - src/renderer/components/jd/index.ts
  modified:
    - python-src/extractors/llm/schemas.py
    - python-src/extractors/llm/prompts.py
    - python-src/main.py
    - src/main/database.ts
    - src/main/index.ts
    - src/main/preload.ts

key-decisions:
  - "LLM required for JD extraction (no regex fallback) - JD structure too varied"
  - "JD input supports both paste AND file upload to meet M-01a requirement"
  - "Store exposed for E2E testing via window.__jdStore"

patterns-established:
  - "JD extraction uses same LLM client/timeout as CV extraction (120s)"
  - "JD CRUD follows CV CRUD patterns in database.ts"

# Metrics
duration: 24 min
completed: 2026-01-26
---

# Phase 4 Plan 1: JD Input and Parsing Summary

**JD input UI with paste/file upload and LLM-based extraction pipeline using Pydantic schema for structured requirements**

## Performance

- **Duration:** 24 min
- **Started:** 2026-01-26T15:08:08Z
- **Completed:** 2026-01-26T15:32:05Z
- **Tasks:** 3/3
- **Files modified:** 10 (4 created, 6 modified)

## Accomplishments

- TypeScript JD types with JobDescription, SkillRequirement, MatchResult interfaces
- Python LLMJDExtraction Pydantic schema for structured LLM output
- JD_EXTRACTION_PROMPT designed for skill requirement parsing
- SQLite tables for JD storage (job_descriptions) and future matching (cv_jd_matches)
- Full IPC pipeline: renderer -> preload -> main -> Python sidecar -> database
- JDInput component with both paste textarea AND .txt file upload (M-01a requirement)
- jdStore Zustand store for JD state management

## Task Commits

Each task was committed atomically:

1. **Task 1: Create JD types, Python schema/prompt, and database tables** - `be562ca` (feat)
2. **Task 2: Create Python extract_jd handler and IPC layer** - `8ba4dab` (feat)
3. **Task 3: Create JD input UI with paste AND file upload, and Zustand store** - `48d5fba` (feat)

## Files Created/Modified

### Created
- `src/renderer/types/jd.ts` - JD TypeScript interfaces (JobDescription, SkillRequirement, MatchResult, JDSummary)
- `src/renderer/stores/jdStore.ts` - Zustand store for JD list, active JD, and extraction state
- `src/renderer/components/jd/JDInput.tsx` - JD input with paste and file upload
- `src/renderer/components/jd/index.ts` - Component export barrel

### Modified
- `python-src/extractors/llm/schemas.py` - Added LLMSkillRequirement and LLMJDExtraction schemas
- `python-src/extractors/llm/prompts.py` - Added JD_EXTRACTION_PROMPT
- `python-src/main.py` - Added extract_jd action handler
- `src/main/database.ts` - Added JD tables and CRUD functions (insertJD, getJD, getAllJDs, deleteJD)
- `src/main/index.ts` - Added IPC handlers for JD operations
- `src/main/preload.ts` - Added JD IPC exposures (extractJD, getAllJDs, getJD, deleteJD)

## Decisions Made

1. **LLM-only extraction for JDs** - Unlike CVs which have regex fallback, JDs require LLM because their structure is too varied. Error returned if LLM unavailable.
2. **Dual input methods (paste + file)** - Satisfies M-01a requirement for both paste and file upload workflows.
3. **E2E test exposure** - Store exposed via `window.__jdStore` following queueStore pattern.
4. **120s timeout** - Matches CV extraction timeout since JD parsing complexity is similar.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- JD input infrastructure complete
- Ready for Plan 04-02: Matching algorithm and scoring engine
- JDInput component created but not yet integrated into App.tsx (will be done in Plan 04-03)
- cv_jd_matches table ready for match results storage

---
*Phase: 04-jd-matching*
*Completed: 2026-01-26*
