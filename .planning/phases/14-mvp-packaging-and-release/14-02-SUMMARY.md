# Phase 14 Plan 02: PDF Parser Resilience Summary

**One-liner:** Cascading PDF fallback with pdfplumber text extraction, pre-cleaning, and structured error returns

## What Was Done

### Task 1: PDF pre-cleaning and pdfplumber text fallback

- Added `pre_clean_pdf()` using `doc.tobytes(garbage=3, clean=True)` to repair malformed PDFs before extraction
- Added pdfplumber as full text extraction fallback when PyMuPDF returns insufficient text (< 50 chars/page)
- Wrapped entire PyMuPDF extraction in try/except with automatic fallback to pdfplumber-only parsing
- Changed `check_pdf_readable()` to return specific "image-only-pdf" error code for scanned documents
- All error paths now return `ParseResult` with `error` field instead of raising exceptions
- Added optional `error` field to `ParseResult` TypedDict in base.py
- **Commit:** `bc00c95` feat(14-02): add PDF pre-cleaning and pdfplumber text fallback

### Task 2: PDF parser resilience tests

- 7 tests covering pre-cleaning, fallback, crash recovery, and error reporting
- Tests use unittest.mock to simulate PyMuPDF failures and empty extraction results
- **Commit:** `0a5da16` test(14-02): add PDF parser resilience tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lint fixes for ruff compliance**

- **Found during:** Task 1 verification
- **Issue:** ruff flagged deprecated typing imports (List/Tuple/Optional), unsorted imports, unused os import
- **Fix:** Auto-fixed with `ruff --fix`, manually moved import to top of file, added contextlib.suppress
- **Files modified:** python-src/parsers/pdf_parser.py

## Decisions Made

| Decision                                               | Rationale                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Return ParseResult with error field instead of raising | Callers can handle errors without try/except, more resilient pipeline          |
| 50 chars/page threshold for fallback                   | Conservative threshold catches truly empty extractions without false positives |
| Pre-clean always runs (not just on failure)            | Proactive repair prevents downstream issues with slightly malformed PDFs       |

## Verification

- 218/218 tests pass
- ruff lint clean on pdf_parser.py
- pdfplumber fallback pattern confirmed in code
- garbage=3 pre-cleaning confirmed in code

## Files Changed

| File                                    | Change                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------- |
| python-src/parsers/pdf_parser.py        | Added pre-cleaning, pdfplumber text fallback, crash recovery, error returns |
| python-src/parsers/base.py              | Added optional `error` field to ParseResult                                 |
| python-src/tests/test_pdf_resilience.py | New: 7 resilience tests                                                     |

## Duration

~5 minutes
