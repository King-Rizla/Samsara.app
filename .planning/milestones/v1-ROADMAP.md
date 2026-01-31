# Milestone v1: The Sovereign Formatter

**Status:** SHIPPED 2026-01-30 (Phase 6 completed 2026-01-31)
**Phases:** 1-7 (14 phases, including decimal and test phases) + Phase 6 (bulk processing)
**Total Plans:** 47

## Overview

Samsara v1 delivers a local-first CV formatter and JD matching tool that replaces expensive cloud-based parsing SaaS (DaXtra, AllSorted) with zero-latency desktop processing. The roadmap prioritized proving the hardest technical challenge first (Python bundling with spaCy), then built the parsing pipeline, visual editor, JD matching, anonymization/branding, and quality gates.

**Testing Strategy:** Phase 7 (Testing & Bug Fixing Protocol) provides comprehensive quality gates including pre-commit hooks, automated scanners, unit tests, and security audits. Legacy E2E test phases (3.T, 4.T) were completed; remaining test phases (5.T, 6.T) were superseded by Phase 7.

## Phases

### Phase 1: Foundation & Distribution

**Goal**: Prove the distribution pipeline works with spaCy before building any features
**Depends on**: Nothing (first phase)
**Plans**: 3 plans in 2 waves

Plans:

- [x] 01-01-PLAN.md - Electron shell with Forge/Vite, IPC, and SQLite database
- [x] 01-02-PLAN.md - Python sidecar with PyInstaller bundling and spaCy model
- [x] 01-03-PLAN.md - Sidecar integration, code signing, and distribution validation

### Phase 2: Parsing Pipeline

**Goal**: Parse a single CV accurately with <2s processing time
**Depends on**: Phase 1
**Plans**: 3 plans in 3 waves

Plans:

- [x] 02-01-PLAN.md - PDF/DOCX parsing with PyMuPDF and pdfplumber fallback
- [x] 02-02-PLAN.md - Entity extraction with spaCy NER and confidence scoring
- [x] 02-03-PLAN.md - SQLite persistence and drag-drop UI

### Phase 2.1: LLM Extraction (INSERTED)

**Goal**: Enhance extraction accuracy for work history, education, and skills using local LLM
**Depends on**: Phase 2
**Plans**: 2 plans in 2 waves

Plans:

- [x] 02.1-01-PLAN.md - Ollama integration with client, schemas, and prompts
- [x] 02.1-02-PLAN.md - Unified LLM extraction pipeline with fallback logic

### Phase 3: Visual Editor

**Goal**: Queue management interface with human-in-the-loop corrections and terminal aesthetic design system
**Depends on**: Phase 2.1
**Plans**: 5 plans in 5 waves

Plans:

- [x] 03-01-PLAN.md - React + Tailwind + shadcn/ui foundation with terminal theme
- [x] 03-02-PLAN.md - Zustand stores and IPC handlers for queue/editor state
- [x] 03-03-PLAN.md - Queue tabs, item display, selection, and bulk actions
- [x] 03-04-PLAN.md - CV editor with inline field editing and confidence badges
- [x] 03-05-PLAN.md - Human verification checkpoint

### Phase 3.T: E2E Test Foundation

**Goal**: Establish Playwright testing infrastructure with mock data injection for Electron
**Depends on**: Phase 3
**Plans**: 1 plan

Plans:

- [x] 03.T-01-PLAN.md - Playwright setup, fixtures, mock utilities, and core tests

### Phase 4: JD Matching

**Goal**: Score and rank CVs against job descriptions with highlighted matches
**Depends on**: Phase 3.T
**Plans**: 3 plans in 3 waves

Plans:

- [x] 04-01-PLAN.md - JD input UI and parsing (skills/requirements extraction via LLM)
- [x] 04-02-PLAN.md - Matching algorithm and scoring engine
- [x] 04-03-PLAN.md - Ranked results view with highlighted matches

### Phase 4.T: JD Matching Tests

**Goal**: E2E test coverage for JD matching functionality
**Depends on**: Phase 4
**Plans**: 1 plan

Plans:

- [x] 04.T-01-PLAN.md - JD matching E2E tests with mock JD fixtures

### Phase 4.5: Project Homepage & Organization (INSERTED)

**Goal**: Enable multi-project workflow where recruiters can separate work by job role/client
**Depends on**: Phase 4.T
**Plans**: 4 plans in 3 waves

Plans:

- [x] 04.5-01-PLAN.md - Database schema migration (projects table, project_id on CVs/JDs)
- [x] 04.5-02-PLAN.md - Project IPC handlers and preload API
- [x] 04.5-03-PLAN.md - React Router, project store, and routing structure
- [x] 04.5-04-PLAN.md - Dashboard UI with sidebar, stats strip, and project cards

### Phase 4.6: Queue Infrastructure & Persistence (INSERTED)

**Goal**: Fix timeout-on-submission bug and establish queue infrastructure for bulk processing
**Depends on**: Phase 4.5
**Plans**: 5 plans in 3 waves

Plans:

- [x] 04.6-01-PLAN.md - Database schema migration (status column on cvs, queue functions)
- [x] 04.6-02-PLAN.md - QueueManager in main process (serialization, timeout handling, push updates)
- [x] 04.6-03-PLAN.md - Preload API for queue operations (enqueueCV, status listeners)
- [x] 04.6-04-PLAN.md - Renderer integration (DropZone, queueStore, App subscription)
- [x] 04.6-05-PLAN.md - Gap closure: Python ACK + timeout coordination (fix timeout bug)

### Phase 4.7: Dashboard Enhancements (INSERTED)

**Goal**: Enhance dashboard with project quick-access and usage tracking for cost visibility
**Depends on**: Phase 4.6
**Plans**: 5 plans in 3 waves

Plans:

- [x] 04.7-01-PLAN.md - Database schema for usage tracking, pinning, and reorder
- [x] 04.7-02-PLAN.md - Python LLM clients return token usage with model name
- [x] 04.7-03-PLAN.md - IPC handlers for usage, pinning, reorder, and settings
- [x] 04.7-04-PLAN.md - @dnd-kit drag-drop: pin, reorder, unpin via X/drag-back
- [x] 04.7-05-PLAN.md - UI: usage display, toast warnings, unified Settings, hidden scrollbars

### Phase 4.8: JD Matching Enhancement (INSERTED)

**Goal**: Maximize JD parsing LLM call value by generating expanded skill variants, boolean search strings, and search hints
**Depends on**: Phase 4.7
**Plans**: 4 plans in 3 waves

Plans:

- [x] 04.8-01-PLAN.md - Database schema migration (matching_metadata JSON column)
- [x] 04.8-02-PLAN.md - Enhanced JD extraction prompt (skills+variants, booleans, search hints)
- [x] 04.8-03-PLAN.md - TypeScript types + Settings UI for boolean syntax configuration
- [x] 04.8-04-PLAN.md - SearchTools UI component + matching engine update

### Phase 5: Anonymization & Branding

**Goal**: Generate blind profiles and branded client-ready PDFs
**Depends on**: Phase 4.8
**Plans**: 3 plans in 3 waves

Plans:

- [x] 05-01-PLAN.md - Redaction engine with PyMuPDF (Full/Client/Punt modes)
- [x] 05-02-PLAN.md - Blind Profile generation with ReportLab and recruiter settings
- [x] 05-03-PLAN.md - Export UI with mode selection and bulk export

### Phase 7: Testing and Bug Fixing Protocol

**Goal**: Make Claude bug-test itself with automated security gates, self-auditing prompts, and stacked scanners
**Depends on**: Phase 5
**Plans**: 4 plans in 3 waves

Plans:

- [x] 07-01-PLAN.md - CLAUDE.md session gate + pre-commit hooks + scanner stack configuration
- [x] 07-02-PLAN.md - Python self-audit tests (pytest + hypothesis edge cases + fuzzing)
- [x] 07-03-PLAN.md - TypeScript unit tests (vitest for main process modules)
- [x] 07-04-PLAN.md - Security audit + secret scan + bug fixes + final verification

---

## Milestone Summary

### Phase 6: Bulk Processing & OS Integration

**Goal**: Process 100+ CVs simultaneously via folder drag-drop with batch IPC and virtualized queue UI
**Depends on**: Phase 7 (complete)
**Requirements**: F-01a, F-01b
**Plans**: 3 plans in 2 waves

Plans:

- [x] 06-01-PLAN.md — Folder drag-drop with recursive scanning, batch IPC handler, confirmation dialog
- [x] 06-02-PLAN.md — List virtualization, retry-all-failed, batch summary notification
- [x] 06-03-PLAN.md — Folder drag-drop fix (gap closure: webkitGetAsEntry + single-folder click routing)

**Phase 6 verified** (2026-01-31) — 5/5 must-haves passed

---

## Milestone Summary

**Execution Order:** 1 -> 2 -> 2.1 -> 3 -> 3.T -> 4 -> 4.T -> 4.5 -> 4.6 -> 4.7 -> 4.8 -> 5 -> 7 -> 6

**Decimal Phases:**

- Phase 2.1: LLM Extraction (inserted after Phase 2 for improved extraction accuracy)
- Phase 4.5: Project Homepage & Organization (inserted after Phase 4.T for multi-project workflow)
- Phase 4.6: Queue Infrastructure & Persistence (inserted for timeout bug fix and queue reliability)
- Phase 4.7: Dashboard Enhancements (inserted for project quick-access and usage tracking)
- Phase 4.8: JD Matching Enhancement (inserted for expanded skill variants and boolean search)

**Key Decisions:**

- PyInstaller --onedir (not --onefile) for faster startup
- spaCy en_core_web_sm (12MB) for NER
- spawn + readline for Python IPC (not python-shell library)
- Qwen 2.5 7B as default LLM model
- Single unified LLM call instead of 4 separate calls
- Tailwind v3 for shadcn/ui compatibility
- Terminal dark mode only
- 400ms debounce for auto-save
- ACK pattern for timeout coordination
- Phase 7 replaced scattered test phases (5.T, 6.T)

**Issues Resolved:**

- Timeout-on-submission bug (Phase 4.6-05: ACK pattern)
- Python sidecar stdout corruption (suppress_stdout context manager)
- Qwen3 breaking JSON with thinking tags (switched to Qwen 2.5)
- Windows Git pre-commit hook compatibility (shebang fix)
- Security audit fixes (Phase 7-04)

**Issues Deferred:**

- LLM extraction ~50s per CV (optimization needed)
- JD extraction prompt quality (truncated booleans)
- PDF parsing 30-40% failure rate on adversarial corpus
- macOS Gatekeeper unsigned Python binary signing

**Technical Debt Incurred:**

- 7 phases without formal VERIFICATION.md
- Matching architecture needs rethink (auto-trigger, project=1 JD)
- E2E tests fragile (reason for Phase 7 replacing test phases)

---

_For current project status, see .planning/ROADMAP.md_
_Archived: 2026-01-30_
_Updated: 2026-01-31 (Phase 6 added, milestone audit completed)_
