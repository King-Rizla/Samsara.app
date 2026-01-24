---
phase: 02-parsing-pipeline
plan: 02
subsystem: extraction
tags: [spacy, ner, regex, typeddict, extraction, british-dates]

# Dependency graph
requires:
  - phase: 02-parsing-pipeline
    plan: 01
    provides: Document parsing (PDF/DOCX) with raw_text output
provides:
  - TypedDict schema for CV data structure (ParsedCV, ContactInfo, WorkEntry, etc.)
  - Contact extraction using spaCy PERSON entity and regex patterns
  - Work history extraction with date range detection
  - Education extraction with degree/grade recognition
  - Skills extraction preserving candidate groupings
  - Date normalization to British dd/mm/yyyy format
  - extract_cv IPC action for full pipeline
affects: [02-03-llm-fallback, 03-visual-editor]

# Tech tracking
tech-stack:
  added: []
  patterns: [TypedDict for schema, regex for structured extraction, spaCy NER for names]

key-files:
  created:
    - python-src/schema/__init__.py
    - python-src/schema/cv_schema.py
    - python-src/normalizers/__init__.py
    - python-src/normalizers/dates.py
    - python-src/normalizers/text.py
    - python-src/extractors/__init__.py
    - python-src/extractors/contact.py
    - python-src/extractors/sections.py
    - python-src/extractors/work_history.py
    - python-src/extractors/education.py
    - python-src/extractors/skills.py
  modified:
    - python-src/main.py

key-decisions:
  - "Use dayfirst=True for British date parsing (3/2/2020 = 3rd Feb, not March 2nd)"
  - "Month-year and year-only dates default to 1st of month/January"
  - "Filter company indicators (Ltd, Inc, LLC) from PERSON entity names"
  - "Preserve candidate's skill groupings rather than re-categorizing"
  - "Confidence scoring based on extraction agreement (1.0 multi-source, 0.7 single)"

patterns-established:
  - "TypedDict with total=False for optional fields"
  - "Tuple return (data, confidence) for extraction functions"
  - "Section detection before extraction for targeted processing"

# Metrics
duration: 12min
completed: 2026-01-24
---

# Phase 02-02: Entity Extraction Summary

**CV entity extraction with spaCy NER for names, regex for structured data, and British date normalization to dd/mm/yyyy format**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-24T14:30:00Z
- **Completed:** 2026-01-24T14:42:00Z
- **Tasks:** 3
- **Files created:** 11
- **Files modified:** 1

## Accomplishments

- TypedDict schema defines CV data structure: ParsedCV, ContactInfo, WorkEntry, EducationEntry, SkillGroup
- Contact extraction uses spaCy PERSON entity for names, regex for email/phone/LinkedIn/GitHub
- Date normalization converts all dates to British dd/mm/yyyy format with dayfirst=True
- Work history extraction identifies company, position, date ranges, and bullet highlights
- Education extraction recognizes degrees (BSc, MSc, PhD, etc.) and UK grades (First Class, 2:1)
- Skills extraction preserves candidate's own groupings/headings
- extract_cv IPC action provides full pipeline from document to structured data
- Confidence scores indicate extraction reliability (1.0 high, 0.5 ambiguous)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CV schema and normalization utilities** - `88b09d9` (feat)
2. **Task 2: Implement contact and section extraction** - `adfacbb` (feat)
3. **Task 3: Implement work history, education, and skills extraction** - `9e11a1c` (feat)

## Files Created/Modified

**Schema:**
- `python-src/schema/__init__.py` - Package exports
- `python-src/schema/cv_schema.py` - TypedDict definitions: ParsedCV, ContactInfo, WorkEntry, EducationEntry, SkillGroup

**Normalizers:**
- `python-src/normalizers/__init__.py` - Package exports
- `python-src/normalizers/dates.py` - normalize_date() with dayfirst=True, extract_date_range()
- `python-src/normalizers/text.py` - Unicode normalization, whitespace cleaning, bullet normalization

**Extractors:**
- `python-src/extractors/__init__.py` - Package exports
- `python-src/extractors/contact.py` - extract_contacts() with spaCy NER + regex
- `python-src/extractors/sections.py` - detect_sections(), get_section_text()
- `python-src/extractors/work_history.py` - extract_work_history() with date range detection
- `python-src/extractors/education.py` - extract_education() with degree/grade patterns
- `python-src/extractors/skills.py` - extract_skills() preserving groupings

**Main:**
- `python-src/main.py` - Added extract_cv IPC action handler

## Decisions Made

1. **British date format with dayfirst=True** - Date "3/2/2020" parses as 3rd February (British convention) not March 2nd (US convention). All output uses dd/mm/yyyy format.

2. **Partial dates default to 1st** - "January 2020" becomes "01/01/2020", "2020" becomes "01/01/2020". Consistent for sorting and comparison.

3. **Company indicator filtering** - PERSON entities containing Ltd, Inc, LLC, etc. are filtered out to avoid extracting company names as person names.

4. **Preserve skill groupings** - Rather than re-categorizing skills, we preserve the candidate's own headings (Technical Skills, Languages, etc.) to maintain their presentation intent.

5. **Confidence based on source agreement** - 1.0 when multiple extraction sources agree, 0.7 for single reliable source, 0.5 for ambiguous/uncertain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Month-year dates using today's day**
- **Found during:** Task 1 verification
- **Issue:** normalize_date("January 2020") returned "24/01/2020" instead of "01/01/2020"
- **Fix:** Added _is_partial_date() detection and explicit day=1 replacement
- **Committed in:** 88b09d9 (Task 1 commit)

**2. [Rule 1 - Bug] Title-case skills filtered as headings**
- **Found during:** Task 3 verification
- **Issue:** Skills like "Python", "React", "Django" were incorrectly identified as category headings because they matched str.istitle()
- **Fix:** Removed title-case check from _is_category_heading(), keeping only all-caps check
- **Committed in:** 9e11a1c (Task 3 commit)

**3. [Rule 1 - Bug] 2-character skills filtered out**
- **Found during:** Task 3 verification
- **Issue:** Skills like "Go" and "R" were filtered by len(skill) > 2 check
- **Fix:** Changed minimum length to > 1 (allow 2+ char skills)
- **Committed in:** 9e11a1c (Task 3 commit)

**4. [Rule 1 - Bug] Year-only dates not normalized**
- **Found during:** Task 3 verification
- **Issue:** "2014" was getting current day/month instead of "01/01/2014"
- **Fix:** Added year-only pattern to _is_partial_date() and explicit month=1 for year-only
- **Committed in:** 9e11a1c (Task 3 commit)

---

**Total deviations:** 4 auto-fixed bugs
**Impact on plan:** All bugs discovered and fixed during verification. No scope creep.

## Issues Encountered

None - all extraction patterns worked as designed after bug fixes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Entity extraction complete for LLM fallback enhancement (Plan 02-03)
- ParsedCV structure ready for visual editor (Phase 3)
- Confidence scores enable selective LLM enhancement for low-confidence fields
- Section detection enables targeted LLM prompts per section type

---
*Phase: 02-parsing-pipeline*
*Completed: 2026-01-24*
