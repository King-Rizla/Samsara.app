---
phase: 01-foundation-distribution
plan: 02
subsystem: backend
tags: [python, spacy, pyinstaller, nlp, ipc]

# Dependency graph
requires:
  - phase: none
    provides: n/a
provides:
  - Python sidecar with JSON-over-stdio IPC protocol
  - PyInstaller onedir bundle with bundled spaCy model
  - health_check action for process verification
affects: [01-03 integration, parsing pipeline]

# Tech tracking
tech-stack:
  added: [spacy 3.8.11, pyinstaller 6.18.0, en_core_web_sm 3.8.0]
  patterns: [JSON-over-stdio IPC, frozen executable model path resolution]

key-files:
  created:
    - python-src/main.py
    - python-src/requirements.txt
    - python-src/samsara.spec
  modified:
    - .gitignore

key-decisions:
  - "Python 3.12 required due to spaCy incompatibility with Python 3.14"
  - "Model path detection handles both development and frozen executable contexts"
  - "spaCy model data (versioned folder) bundled directly to en_core_web_sm for simpler path resolution"

patterns-established:
  - "get_model_path() function pattern for frozen/dev detection"
  - "JSON-over-stdio with status messages during initialization"

# Metrics
duration: 33min
completed: 2026-01-24
---

# Phase 01 Plan 02: Python Sidecar Summary

**PyInstaller onedir bundle with spaCy en_core_web_sm, JSON-over-stdio IPC, and frozen executable model resolution**

## Performance

- **Duration:** 33 min
- **Started:** 2026-01-24T10:22:32Z
- **Completed:** 2026-01-24T10:55:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Python sidecar with JSON-over-stdio protocol for Electron integration
- spaCy en_core_web_sm model preloaded at startup for fast inference
- PyInstaller onedir bundle that successfully loads model and responds to requests
- Model path detection handles both development and frozen executable contexts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Python project structure with spaCy** - `1c6ede2` (feat)
2. **Task 2: Create PyInstaller spec and build onedir bundle** - `6da81fe` (feat)

## Files Created/Modified

- `python-src/main.py` - Python sidecar entry point with JSON IPC
- `python-src/requirements.txt` - spacy==3.8.11, pyinstaller==6.18.0
- `python-src/samsara.spec` - PyInstaller spec with spaCy hidden imports
- `.gitignore` - Added python-dist/, python-build/, .venv/, __pycache__/

## Decisions Made

1. **Python 3.12 required** - spaCy 3.8.11 is incompatible with Python 3.14 due to Pydantic v1 issues. Used `uv` to install Python 3.12.12 automatically.

2. **Model path resolution** - Created `get_model_path()` function that detects frozen (PyInstaller) vs development context and returns appropriate path.

3. **Model data bundling** - Bundled the versioned model data folder (en_core_web_sm-3.8.0) directly as `en_core_web_sm` for simpler path resolution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Python 3.14 incompatible with spaCy**

- **Found during:** Task 1 (venv setup and spacy download)
- **Issue:** Python 3.14 causes Pydantic v1 compatibility errors in spaCy schemas
- **Fix:** Used `uv` to create venv with Python 3.12.12 (downloaded automatically)
- **Files modified:** python-src/.venv/ (created with Python 3.12)
- **Verification:** spaCy model loads successfully
- **Committed in:** 1c6ede2 (noted in commit message)

**2. [Rule 1 - Bug] Model not found in frozen executable**

- **Found during:** Task 2 (bundled executable testing)
- **Issue:** PyInstaller bundle couldn't find model - path resolution failed
- **Fix:** Added `get_model_path()` function to detect frozen context and use `sys._MEIPASS`
- **Files modified:** python-src/main.py
- **Verification:** Bundled executable health_check passes
- **Committed in:** 6da81fe

**3. [Rule 1 - Bug] Wrong model folder structure in bundle**

- **Found during:** Task 2 (bundled executable testing after first fix)
- **Issue:** Spec copied package folder instead of model data folder (nested en_core_web_sm-3.8.0)
- **Fix:** Updated spec to find and copy versioned model data folder directly
- **Files modified:** python-src/samsara.spec
- **Verification:** Model loads correctly in bundled executable
- **Committed in:** 6da81fe

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All fixes necessary for correct operation. No scope creep.

## Issues Encountered

None beyond the deviations above - all were resolved during execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Python sidecar ready for Plan 03 integration with Electron shell
- Bundle builds successfully with spaCy model included
- health_check protocol verified and working
- Model preloads at startup for fast inference

---
*Phase: 01-foundation-distribution*
*Completed: 2026-01-24*
