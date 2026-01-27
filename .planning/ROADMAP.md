# Roadmap: Samsara - The Sovereign Formatter

## Overview

Samsara v1 delivers a local-first CV formatter and JD matching tool that replaces expensive cloud-based parsing SaaS (DaXtra, AllSorted) with zero-latency desktop processing. The roadmap prioritizes proving the hardest technical challenge first (Python bundling with spaCy), then builds the parsing pipeline, visual editor, JD matching, anonymization/branding, and finally bulk processing. Each phase delivers a complete, verifiable capability.

**Testing Strategy:** Dedicated testing phases (T1, T2, T3) follow major feature milestones to ensure quality before moving forward. Testing phases expand E2E coverage using the Playwright infrastructure established in Phase 3.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3...): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions if needed
- T-prefixed phases (T1, T2, T3): Dedicated testing phases

- [x] **Phase 1: Foundation & Distribution** - Prove PyInstaller + spaCy bundling and code signing work before building features
- [x] **Phase 2: Parsing Pipeline** - Single-CV extraction with <2s performance on adversarial corpus
- [x] **Phase 2.1: LLM Extraction** - Local LLM enhancement for work history, education, and skills extraction
- [x] **Phase 3: Visual Editor** - Queue management with human-in-the-loop corrections
- [x] **Phase 3.T: E2E Test Foundation** - Playwright infrastructure, fixtures, and core test coverage
- [x] **Phase 4: JD Matching** - Score and rank CVs against job descriptions
- [x] **Phase 4.T: JD Matching Tests** - E2E coverage for JD parsing, scoring, and ranking
- [x] **Phase 4.5: Project Homepage & Organization** - Homepage with project-scoped CVs, JDs, and matches for multi-role workflow
- [ ] **Phase 4.6: Queue Infrastructure & Persistence** - Fix timeout bug, DB status column, queue manager, real-time updates
- [ ] **Phase 4.7: Dashboard Enhancements** - Project drag-drop to sidebar, token/API tracking, usage limits
- [ ] **Phase 5: Anonymization & Branding** - Redaction, blind profiles, and themed PDF output
- [ ] **Phase 5.T: Export & Branding Tests** - E2E coverage for PDF generation and anonymization
- [ ] **Phase 6: Bulk Processing & OS Integration** - 100+ file queue with context menu integration
- [ ] **Phase 6.T: Performance & Integration Tests** - Load testing, memory profiling, and OS integration tests
- [ ] **Phase 7: Testing and Bug Fixing Protocol** - Comprehensive testing pass and bug resolution

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
**Goal**: Queue management interface with human-in-the-loop corrections and terminal aesthetic design system
**Depends on**: Phase 2.1
**Requirements**: F-03a, F-03b
**Success Criteria** (what must be TRUE):
  1. User sees queue with three tabs (Completed, Submitted, Failed) with item counts ✓
  2. User can click on low-confidence fields (highlighted) and fix values directly ✓
  3. User corrections save immediately to SQLite without re-parsing ✓
  4. User can retry failed items or delete items from queue ✓
  5. Terminal aesthetic applied: dark background, JetBrains Mono, purple accent ✓
**Plans**: 5 plans in 5 waves

Plans:
- [x] 03-01-PLAN.md — React + Tailwind + shadcn/ui foundation with terminal theme
- [x] 03-02-PLAN.md — Zustand stores and IPC handlers for queue/editor state
- [x] 03-03-PLAN.md — Queue tabs, item display, selection, and bulk actions
- [x] 03-04-PLAN.md — CV editor with inline field editing and confidence badges
- [x] 03-05-PLAN.md — Human verification checkpoint

### Phase 3.T: E2E Test Foundation
**Goal**: Establish Playwright testing infrastructure with mock data injection for Electron
**Depends on**: Phase 3
**Requirements**: None (quality assurance phase)
**Success Criteria** (what must be TRUE):
  1. Playwright configured for Electron testing with proper app launch/teardown ✓
  2. Test fixtures created (4 CVs, 4 JDs) with corresponding mock data ✓
  3. Store patching workaround implemented (contextBridge limitation) ✓
  4. Core editor tests passing with mock data injection ✓
  5. Infrastructure ready for expanding test coverage ✓
**Plans**: 1 plan (infrastructure)

Plans:
- [x] 03.T-01-PLAN.md — Playwright setup, fixtures, mock utilities, and core tests

### Phase 4: JD Matching
**Goal**: Score and rank CVs against job descriptions with highlighted matches
**Depends on**: Phase 3.T (requires Visual Editor and test infrastructure)
**Requirements**: M-01a, M-01b, M-01c, M-01d, M-01e
**Success Criteria** (what must be TRUE):
  1. User can paste or upload a Job Description and it gets parsed/stored
  2. User can select multiple CVs and assign them to a JD for scoring
  3. System calculates match score (%) for each CV against the JD using extracted skills
  4. CVs appear in a ranked list ordered by match score
  5. Matching skills/requirements are visually highlighted when viewing a CV in context of a JD
**Plans**: 3 plans in 3 waves

Plans:
- [x] 04-01-PLAN.md — JD input UI and parsing (skills/requirements extraction via LLM)
- [x] 04-02-PLAN.md — Matching algorithm and scoring engine
- [x] 04-03-PLAN.md — Ranked results view with highlighted matches

### Phase 4.T: JD Matching Tests
**Goal**: E2E test coverage for JD matching functionality
**Depends on**: Phase 4
**Requirements**: None (quality assurance phase)
**Success Criteria** (what must be TRUE):
  1. JD upload/paste and parsing tests pass
  2. CV-to-JD assignment tests pass
  3. Scoring accuracy validated against known test cases
  4. Ranked results display tests pass
  5. Skill highlighting tests pass
**Plans**: 1 plan

Plans:
- [x] 04.T-01-PLAN.md — JD matching E2E tests with mock JD fixtures

### Phase 4.5: Project Homepage & Organization (INSERTED)
**Goal**: Enable multi-project workflow where recruiters can separate work by job role/client
**Depends on**: Phase 4.T
**Requirements**: None (architectural enhancement)
**Success Criteria** (what must be TRUE):
  1. User sees a homepage listing all projects on app launch
  2. User can create a new project with a name and optional description
  3. Each project contains its own CVs, JDs, and match results (fully isolated)
  4. User can switch between projects without losing context
  5. Current queue/editor UI works within the selected project scope
**Plans**: 4 plans in 3 waves

Plans:
- [x] 04.5-01-PLAN.md — Database schema migration (projects table, project_id on CVs/JDs)
- [x] 04.5-02-PLAN.md — Project IPC handlers and preload API
- [x] 04.5-03-PLAN.md — React Router, project store, and routing structure
- [x] 04.5-04-PLAN.md — Dashboard UI with sidebar, stats strip, and project cards

### Phase 4.6: Queue Infrastructure & Persistence (INSERTED)
**Goal**: Fix timeout-on-submission bug and establish queue infrastructure for bulk processing
**Depends on**: Phase 4.5
**Requirements**: None (infrastructure/bug fix phase)
**Success Criteria** (what must be TRUE):
  1. Timeout starts when Python begins processing, not when request is submitted
  2. CVs persist to database immediately on drop with status column (queued → processing → completed/failed)
  3. Submitted tab shows queue items that survive navigation between projects
  4. Queue manager in main process sends one request at a time to Python sidecar
  5. UI receives real-time status updates as items move through queue
**Plans**: 5 plans in 3 waves

Plans:
- [x] 04.6-01-PLAN.md — Database schema migration (status column on cvs, queue functions)
- [x] 04.6-02-PLAN.md — QueueManager in main process (serialization, timeout handling, push updates)
- [x] 04.6-03-PLAN.md — Preload API for queue operations (enqueueCV, status listeners)
- [x] 04.6-04-PLAN.md — Renderer integration (DropZone, queueStore, App subscription)
- [ ] 04.6-05-PLAN.md — Gap closure: Python ACK + timeout coordination (fix timeout bug)

### Phase 4.7: Dashboard Enhancements (INSERTED)
**Goal**: Enhance dashboard with project quick-access and usage tracking for cost visibility
**Depends on**: Phase 4.6
**Requirements**: None (enhancement phase)
**Success Criteria** (what must be TRUE):
  1. User can drag projects onto sidebar for quick access when managing multiple projects
  2. Token usage tracked per project and displayed in project cards
  3. API usage (LLM calls) tracked per project with timestamps
  4. Dashboard stats strip shows total token/API usage across all projects
  5. User can set usage limits per project or globally in Settings
  6. Warning displayed when approaching usage limit
**Plans**: 5 plans in 3 waves

Plans:
- [ ] 04.7-01-PLAN.md — Database schema for usage tracking and quick-access pinning
- [ ] 04.7-02-PLAN.md — Python LLM clients return token usage in responses
- [ ] 04.7-03-PLAN.md — IPC handlers for usage tracking and settings extension
- [ ] 04.7-04-PLAN.md — @dnd-kit drag-drop for pinning projects to sidebar
- [ ] 04.7-05-PLAN.md — UI integration: usage display, warnings, and settings

### Phase 5: Anonymization & Branding
**Goal**: Generate blind profiles and branded client-ready PDFs
**Depends on**: Phase 4.7
**Requirements**: F-02b, F-02c, F-03c
**Success Criteria** (what must be TRUE):
  1. User can apply "Blackout" redaction that visually removes contact details from PDF layer
  2. User can generate a "Blind Profile" front sheet summarizing skills without identifying information
  3. User can apply theme.json (logo, colors, headers) to generate branded client PDF
  4. Branded/anonymized PDF generates in <500ms after editing is complete
**Plans**: 3 plans in 3 waves

Plans:
- [ ] 05-01-PLAN.md — Redaction engine with PyMuPDF (Full/Client/Punt modes)
- [ ] 05-02-PLAN.md — Blind Profile generation with ReportLab and recruiter settings
- [ ] 05-03-PLAN.md — Export UI with mode selection and bulk export

### Phase 5.T: Export & Branding Tests
**Goal**: E2E test coverage for PDF generation and anonymization
**Depends on**: Phase 5
**Requirements**: None (quality assurance phase)
**Success Criteria** (what must be TRUE):
  1. Blackout redaction removes all PII from PDF output
  2. Blind Profile generates correctly formatted front sheet
  3. Branding applies theme correctly (logo, colors, headers)
  4. PDF generation completes within performance target
  5. Output files are valid PDFs that open correctly
**Plans**: 1 plan

Plans:
- [ ] 05.T-01-PLAN.md — Export and branding E2E tests with PDF validation

### Phase 6: Bulk Processing & OS Integration
**Goal**: Process 100+ CVs simultaneously with OS-level integration
**Depends on**: Phase 5.T
**Requirements**: F-01a, F-01b
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop a folder containing 100+ PDF/DOCX files and see queue progress
  2. User can right-click files in Windows/macOS Explorer and select "Format with Samsara"
  3. Bulk processing completes 100 CVs without memory growth or crashes
  4. Individual file failures do not stop the batch (error logged, processing continues)
  5. Batch IPC sends 10-50 file paths per message (not one-by-one)
**Plans**: 3 plans in 3 waves

Plans:
- [ ] 06-01-PLAN.md — Drag-drop queue with progress tracking
- [ ] 06-02-PLAN.md — Batch IPC and memory management
- [ ] 06-03-PLAN.md — OS context menu integration (Windows/macOS)

### Phase 6.T: Performance & Integration Tests
**Goal**: Load testing, memory profiling, and OS integration validation
**Depends on**: Phase 6
**Requirements**: None (quality assurance phase)
**Success Criteria** (what must be TRUE):
  1. 100-file batch completes without memory leaks
  2. Failure isolation verified (bad files don't crash batch)
  3. OS context menu integration tested on Windows and macOS
  4. Performance regression tests established as baseline
  5. Full E2E smoke test suite passes
**Plans**: 1 plan

Plans:
- [ ] 06.T-01-PLAN.md — Performance tests, memory profiling, and OS integration tests

### Phase 7: Testing and Bug Fixing Protocol
**Goal**: Make Claude bug-test itself with automated security gates, self-auditing prompts, and stacked scanners
**Depends on**: Phase 6.T
**Requirements**: None (quality assurance phase)
**Success Criteria** (what must be TRUE):
  1. CLAUDE.md file in repo root with mandatory pre-completion checks (secrets, injection, validation, tests, types)
  2. Pre-commit hooks block commits with security vulnerabilities or type errors
  3. Automated scanners configured: semgrep (SAST/OWASP), bandit (Python), ruff (lint), mypy (types), gitleaks (secrets)
  4. Self-audit test suite: 20+ unit tests per critical function designed to break it
  5. Edge case corpus generated: null, empty, negative, unicode, 100k arrays for fuzzing
  6. Security audit completed: SQL injection, auth bypasses, privilege escalation, input validation gaps
  7. Secret scan passed: no API keys in comments, passwords in configs, tokens in error messages
  8. All identified bugs fixed and verified
**Plans**: 0 plans (estimated 3-4 plans)

**The Loop:**
```
Claude writes code → CLAUDE.md forces self-review → Automated scanners catch the rest → Pre-commit blocks garbage → GitHub Action reviews the PR
```

**Protocol Stack:**
- **CLAUDE.md gate**: Automatic checks every session (secrets, injection, path traversal, validation, tests, types)
- **Self-snitching prompts**: "Write 20 tests to break this", "Find every vulnerability like a pentester", "Generate 50 edge cases"
- **Tool integrations**: claude-code-action (PR reviews), claude-agent-sdk (batch audits)
- **Scanner stack**: semgrep, bandit, ruff, mypy, snyk, gitleaks
- **Pre-commit hooks**: Physical blocker preventing vulnerable commits

Plans:
- [ ] 07-01-PLAN.md — CLAUDE.md setup + pre-commit hooks + scanner stack configuration
- [ ] 07-02-PLAN.md — Self-audit test generation (unit tests, edge cases, fuzzing corpus)
- [ ] 07-03-PLAN.md — Security audit (injection, auth, secrets scan) + bug fixes
- [ ] 07-04-PLAN.md — Final verification pass + documentation

## Progress

**Execution Order:**
Phases execute in order: 1 → 2 → 2.1 → 3 → 3.T → 4 → 4.T → 4.5 → 4.6 → 4.7 → 5 → 5.T → 6 → 6.T → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Distribution | 3/3 | Complete | 2026-01-24 |
| 2. Parsing Pipeline | 3/3 | Complete | 2026-01-24 |
| 2.1. LLM Extraction | 2/2 | Complete | 2026-01-25 |
| 3. Visual Editor | 5/5 | Complete | 2026-01-25 |
| 3.T. E2E Test Foundation | 1/1 | Complete | 2026-01-25 |
| 4. JD Matching | 3/3 | Complete | 2026-01-27 |
| 4.T. JD Matching Tests | 1/1 | Complete | 2026-01-27 |
| 4.5. Project Homepage & Organization | 4/4 | Complete | 2026-01-27 |
| 4.6. Queue Infrastructure & Persistence | 4/5 | Gap closure | - |
| 4.7. Dashboard Enhancements | 0/5 | Not started | - |
| 5. Anonymization & Branding | 0/3 | Not started | - |
| 5.T. Export & Branding Tests | 0/1 | Not started | - |
| 6. Bulk Processing & OS Integration | 0/3 | Not started | - |
| 6.T. Performance & Integration Tests | 0/1 | Not started | - |
| 7. Testing and Bug Fixing Protocol | 0/4 | Not started | - |

**Total Progress:** 27/33 plans complete

---
*Roadmap created: 2026-01-23*
*Roadmap updated: 2026-01-27 (Phase 4.6 gap closure plan added)*
*Milestone: The Sovereign Formatter (v1)*
