---
phase: 02-parsing-pipeline
plan: 01
subsystem: parsing
tags: [pymupdf, python-docx, pdfplumber, pdf, docx, text-extraction]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Python sidecar with spaCy model and IPC handler framework
provides:
  - PDF parsing with PyMuPDF and pdfplumber fallback for tables
  - DOCX parsing with python-docx
  - Multi-column layout detection and handling
  - parse_document IPC action handler
affects: [02-02-entity-extraction, 02-03-llm-fallback]

# Tech tracking
tech-stack:
  added: [PyMuPDF 1.26.7, python-docx 1.2.0, pdfplumber 0.11.9, python-dateutil 2.9.0]
  patterns: [cascading parser strategy, suppress stdout for IPC]

key-files:
  created:
    - python-src/parsers/__init__.py
    - python-src/parsers/base.py
    - python-src/parsers/pdf_parser.py
    - python-src/parsers/docx_parser.py
  modified:
    - python-src/requirements.txt
    - python-src/samsara.spec
    - python-src/main.py

key-decisions:
  - "Suppress PyMuPDF stdout messages via context manager to preserve JSON lines IPC protocol"
  - "Use find_tables() for table detection then pdfplumber for accurate extraction"
  - "Multi-column detection via X position gap analysis (>100px threshold)"

patterns-established:
  - "Cascading parser: fast extraction first, fallback for complex cases"
  - "ParseResult TypedDict for consistent return type across parsers"
  - "suppress_stdout() context manager for noisy libraries"

# Metrics
duration: 7min
completed: 2026-01-24
---

# Phase 02-01: Document Parsers Summary

**PDF and DOCX parsing with PyMuPDF cascading to pdfplumber for tables, multi-column layout detection, and IPC integration**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-24T14:21:21Z
- **Completed:** 2026-01-24T14:28:49Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- PDF parsing with PyMuPDF extracts structured text with font/position info
- Multi-column PDF layouts detected and processed in reading order
- Tables extracted with pdfplumber when detected via PyMuPDF find_tables()
- DOCX parsing extracts paragraphs with style info and tables
- IPC handler accepts parse_document action and returns structured results
- Legacy DOC files return clear "save as DOCX" message

## Task Commits

Each task was committed atomically:

1. **Task 1: Add parsing libraries and update PyInstaller spec** - `1f806d6` (chore)
2. **Task 2: Create PDF and DOCX parsers with cascading extraction** - `a06dd56` (feat)
3. **Task 3: Integrate parsers with IPC handler** - `cb808da` (feat)

## Files Created/Modified

- `python-src/requirements.txt` - Added PyMuPDF, python-docx, pdfplumber, python-dateutil
- `python-src/samsara.spec` - Added hidden imports for parsing libraries (pdfminer, PIL, lxml)
- `python-src/parsers/__init__.py` - Package exports
- `python-src/parsers/base.py` - DocumentType enum, ParseResult TypedDict, parse_document dispatcher
- `python-src/parsers/pdf_parser.py` - PyMuPDF + pdfplumber cascading extraction
- `python-src/parsers/docx_parser.py` - python-docx paragraph and table extraction
- `python-src/main.py` - parse_document IPC action handler

## Decisions Made

1. **Suppress PyMuPDF stdout messages** - PyMuPDF prints "Consider using pymupdf_layout" to stdout which breaks JSON lines protocol. Added suppress_stdout() context manager around find_tables().

2. **Column gap threshold of 100px** - Multi-column detection uses X position analysis. Gap threshold of 100px works well for typical CV layouts without false positives on normal paragraph indentation.

3. **DOCX page count returns 1** - python-docx doesn't provide page count without rendering. Return 1 as placeholder since CVs are typically single-document entities.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PyMuPDF stdout pollution breaking IPC**
- **Found during:** Task 3 (IPC integration testing)
- **Issue:** PyMuPDF's find_tables() prints "Consider using the pymupdf_layout package" to stdout, corrupting JSON lines protocol
- **Fix:** Added suppress_stdout() context manager to redirect stdout during find_tables() call
- **Files modified:** python-src/parsers/pdf_parser.py
- **Verification:** IPC tests pass with clean JSON responses
- **Committed in:** cb808da (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for IPC functionality. No scope creep.

## Issues Encountered

- **uv-managed venv without pip** - The python-src/.venv was created with uv and doesn't have pip installed. Used uv pip command directly instead of python -m pip.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Parse infrastructure complete for entity extraction (Plan 02-02)
- ParseResult contains raw_text, blocks with position info, and tables
- Multi-column handling ensures contact info and work history aren't jumbled
- Ready for spaCy NER + regex contact extraction

---
*Phase: 02-parsing-pipeline*
*Completed: 2026-01-24*
