# Roadmap: Samsara - The Sovereign Formatter

## Overview

Samsara v1 delivers a local-first CV formatter and JD matching tool that replaces expensive cloud-based parsing SaaS (DaXtra, AllSorted) with zero-latency desktop processing. The roadmap prioritizes proving the hardest technical challenge first (Python bundling with spaCy), then builds the parsing pipeline, visual editor, JD matching, anonymization/branding, and finally bulk processing. Each phase delivers a complete, verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3...): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions if needed

- [x] **Phase 1: Foundation & Distribution** - Prove PyInstaller + spaCy bundling and code signing work before building features
- [x] **Phase 2: Parsing Pipeline** - Single-CV extraction with <2s performance on adversarial corpus
- [x] **Phase 2.1: LLM Extraction** - Local LLM enhancement for work history, education, and skills extraction
- [ ] **Phase 3: Visual Editor** - Split view with human-in-the-loop corrections
- [ ] **Phase 4: JD Matching** - Score and rank CVs against job descriptions
- [ ] **Phase 5: Anonymization & Branding** - Redaction, blind profiles, and themed PDF output
- [ ] **Phase 6: Bulk Processing & OS Integration** - 100+ file queue with context menu integration

## Phase Details

### Phase 1: Foundation & Distribution
**Goal**: Prove the distribution pipeline works with spaCy before building any features
**Depends on**: Nothing (first phase)
**Requirements**: None (infrastructure phase - unblocks all feature requirements)
**Success Criteria** (what must be TRUE):
  1. Packaged app loads spaCy model and responds to IPC health check within 10 seconds on clean Windows/macOS VM
  2. PyInstaller `--onedir` build completes with all spaCy hidden imports (cymem, preshed, srsly.msgpack.util)
  3. Code signing passes for both Windows (.exe) and macOS (.app) binaries
  4. Electron shell displays basic window and communicates with Python sidecar via stdio JSON
  5. SQLite database initializes in app.getPath('userData') with WAL mode enabled
**Plans**: 3 plans in 2 waves

Plans:
- [x] 01-01-PLAN.md - Electron shell with Forge/Vite, IPC, and SQLite database
- [x] 01-02-PLAN.md - Python sidecar with PyInstaller bundling and spaCy model
- [x] 01-03-PLAN.md - Sidecar integration, code signing, and distribution validation

### Phase 2: Parsing Pipeline
**Goal**: Parse a single CV accurately with <2s processing time
**Depends on**: Phase 1
**Requirements**: F-02a, F-01c
**Success Criteria** (what must be TRUE):
  1. User can drop a PDF/DOCX file and see extracted contact fields (Name, Phone, Email, Address) within 2 seconds
  2. Parsing works on 90%+ of adversarial corpus (two-column layouts, tables, infographics, international formats)
  3. Extracted data persists to SQLite with confidence scores per field
  4. spaCy model is preloaded at sidecar startup (no per-request loading penalty)
**Plans**: 3 plans in 3 waves

Plans:
- [x] 02-01-PLAN.md - PDF/DOCX parsing with PyMuPDF and pdfplumber fallback
- [x] 02-02-PLAN.md - Entity extraction with spaCy NER and confidence scoring
- [x] 02-03-PLAN.md - SQLite persistence and drag-drop UI

### Phase 2.1: LLM Extraction
**Goal**: Enhance extraction accuracy for work history, education, and skills using local LLM
**Depends on**: Phase 2
**Requirements**: F-02a (enhanced)
**Success Criteria** (what must be TRUE):
  1. Local LLM (Ollama) extracts work history with company, title, dates, and descriptions
  2. Local LLM extracts education with institution, degree, field, and dates
  3. Local LLM extracts skills preserving candidate groupings
  4. Hybrid approach: regex for contact (with LLM fallback), LLM for semantic fields
  5. Extraction completes in <5s total (acceptable for accuracy improvement)
**Plans**: 2 plans in 2 waves

Plans:
- [x] 02.1-01-PLAN.md - Ollama integration with client, schemas, and prompts
- [x] 02.1-02-PLAN.md - Unified LLM extraction pipeline with fallback logic

### Phase 3: Visual Editor
**Goal**: Recruiters can review and correct parsing errors in a split-view interface
**Depends on**: Phase 2.1
**Requirements**: F-03a, F-03b
**Success Criteria** (what must be TRUE):
  1. User sees original CV on left and parsed fields on right in split view
  2. User can click on low-confidence fields (highlighted) and fix values directly
  3. User corrections save immediately to SQLite without re-parsing
  4. User can trigger re-parse of a CV if original changes
**Plans**: TBD

Plans:
- [ ] 03-01: PDF rendering with pdf.js in split view
- [ ] 03-02: Inline field editing with confidence indicators

### Phase 4: JD Matching
**Goal**: Score and rank CVs against job descriptions with highlighted matches
**Depends on**: Phase 2 (requires parsed skills data)
**Requirements**: M-01a, M-01b, M-01c, M-01d, M-01e
**Success Criteria** (what must be TRUE):
  1. User can paste or upload a Job Description and it gets parsed/stored
  2. User can select multiple CVs and assign them to a JD for scoring
  3. System calculates match score (%) for each CV against the JD using extracted skills
  4. CVs appear in a ranked list ordered by match score
  5. Matching skills/requirements are visually highlighted when viewing a CV in context of a JD
**Plans**: TBD

Plans:
- [ ] 04-01: JD input and parsing (skills/requirements extraction)
- [ ] 04-02: Matching algorithm and scoring engine
- [ ] 04-03: Ranked results view with highlighted matches

### Phase 5: Anonymization & Branding
**Goal**: Generate blind profiles and branded client-ready PDFs
**Depends on**: Phase 3
**Requirements**: F-02b, F-02c, F-03c
**Success Criteria** (what must be TRUE):
  1. User can apply "Blackout" redaction that visually removes contact details from PDF layer
  2. User can generate a "Blind Profile" front sheet summarizing skills without identifying information
  3. User can apply theme.json (logo, colors, headers) to generate branded client PDF
  4. Branded/anonymized PDF generates in <500ms after editing is complete
**Plans**: TBD

Plans:
- [ ] 05-01: Anonymization engine with visual redaction
- [ ] 05-02: Blind Profile front sheet generation
- [ ] 05-03: Branding engine with theme.json and ReportLab PDF output

### Phase 6: Bulk Processing & OS Integration
**Goal**: Process 100+ CVs simultaneously with OS-level integration
**Depends on**: Phase 5
**Requirements**: F-01a, F-01b
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop a folder containing 100+ PDF/DOCX files and see queue progress
  2. User can right-click files in Windows/macOS Explorer and select "Format with Samsara"
  3. Bulk processing completes 100 CVs without memory growth or crashes
  4. Individual file failures do not stop the batch (error logged, processing continues)
  5. Batch IPC sends 10-50 file paths per message (not one-by-one)
**Plans**: TBD

Plans:
- [ ] 06-01: Drag-drop queue with progress tracking
- [ ] 06-02: Batch IPC and memory management
- [ ] 06-03: OS context menu integration (Windows/macOS)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 2.1 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Distribution | 3/3 | Complete | 2026-01-24 |
| 2. Parsing Pipeline | 3/3 | Complete | 2026-01-24 |
| 2.1. LLM Extraction | 2/2 | Complete | 2026-01-25 |
| 3. Visual Editor | 0/2 | Not started | - |
| 4. JD Matching | 0/3 | Not started | - |
| 5. Anonymization & Branding | 0/3 | Not started | - |
| 6. Bulk Processing & OS Integration | 0/3 | Not started | - |

---
*Roadmap created: 2026-01-23*
*Milestone: The Sovereign Formatter (v1)*
