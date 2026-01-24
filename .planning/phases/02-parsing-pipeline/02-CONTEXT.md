# Phase 2: Parsing Pipeline - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Parse a single CV (PDF/DOCX/DOC) and extract structured data with <2s processing time. Multiple parsing methods with fallbacks. User-triggered LLM escalation for failures. Data optimized for downstream agent consumption (rating, reconstruction, ATS integration).

</domain>

<decisions>
## Implementation Decisions

### Extraction Targets
- **Full profile extraction:** Contact, Work History, Education, Skills, plus all other sections
- **Work history:** Comprehensive — company, title, dates, description/bullets (for agent reconstruction)
- **Education:** Full details — institution, degree, field of study, dates, grades if mentioned
- **All sections:** Detect and extract any section the CV contains (Certifications, Languages, Publications, Volunteer, etc.)
- **Skills:** Preserve candidate's own groupings/headings as written
- **Links:** Extract URLs (LinkedIn, GitHub, portfolio) as contact fields
- **Photos:** Do not extract — complexity outweighs value, engineers may include project images
- **Dates:** Normalize to dd/mm/yyyy (British format)

### Parsing Strategy
- **Primary methods:** PyMuPDF for PDFs, python-docx for DOCX
- **Fallback:** pdfplumber for tables/complex layouts
- **Supported formats:** PDF, DOCX, DOC (legacy Word)
- **LLM escalation:** User-triggered, not automatic — user selects failed CVs and clicks "escalate attempt"

### Failure Handling
- **Complete failure:** Fail with clear error message explaining why (corrupted, encrypted, unparseable)
- **Partial success:** Show all extracted fields, visually highlight low-confidence fields for review
- **Confidence meaning:** Parsing accuracy ("did we extract this correctly?"), NOT CV quality judgment
- **No manual entry mode:** If parsing fails completely, user must provide a better file

### Data Structure
- **Optimize for:** Agent consumption (LLM-friendly structured JSON)
- **Section order:** Preserve original order from CV for faithful reconstruction
- **Storage:** Raw text + structured data (agents can re-interpret raw text if needed)
- **Original file:** Reference path only — user responsible for file management, no copying into app

### Adversarial Corpus
- **Source:** Public CV datasets
- **Formats:** PDF, DOCX, DOC
- **Challenges to test:** Two-column layouts, tables/grids, international formats, very long CVs (70+ pages with portfolios)
- **Success threshold (90%):** Name + at least one contact method + work history extracted. Aim for maximum field extraction.

### Claude's Discretion
- Exact JSON schema for structured data
- Specific parsing library configuration
- Confidence score calculation method
- Which public datasets to use for corpus

</decisions>

<specifics>
## Specific Ideas

- "This feeds into recruiters defining ATS fields they need to fill" — extraction should be comprehensive
- "Optimise for ease of understanding for our CV rating and reconstruction agent" — structure for LLM consumption
- "We are British" — dates in dd/mm/yyyy format
- "Mostly local, high security and privacy" — local-first with user-controlled escalation

</specifics>

<deferred>
## Deferred Ideas

- **ATS field mapping:** Recruiters define exact fields their ATS needs — future phase
- **Call recording integration:** Use extracted data for automatic ATS input during calls — future service
- **Automatic ATS input:** Populate ATS fields directly from parsed CV — future phase
- **OCR for scanned PDFs:** Could add as additional fallback if needed — evaluate after initial corpus testing

</deferred>

---

*Phase: 02-parsing-pipeline*
*Context gathered: 2026-01-24*
