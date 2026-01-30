# Requirements Archive: v1 The Sovereign Formatter

**Archived:** 2026-01-30
**Status:** SHIPPED (12/14 requirements delivered, 2 deferred to next milestone)

This is the archived requirements specification for v1.
For current requirements, see `.planning/REQUIREMENTS.md` (created for next milestone).

---

## v1 Requirements

### Phase 1: The Sovereign Formatter

_The "Tip of the Spear" to disrupt DaXtra/AllSorted._

#### Bulk Ingest (F-01)

- [ ] **F-01a**: Drag-and-drop queue handles 100+ PDF/Docx files simultaneously — _Deferred to v1.1 Phase 6_
- [ ] **F-01b**: OS right-click context menu integration (Windows/macOS): "Format with Samsara" — _Deferred to v1.1 Phase 6_
- [x] **F-01c**: < 2 seconds per resume processing on local CPU (no upload progress bars) — _v1.0, Phase 2_

#### Local Parsing & Anonymization (F-02)

- [x] **F-02a**: Local Python extraction (pdfplumber/spacy) of Name, Phone, Email, Address — _v1.0, Phase 2 + 2.1 (LLM enhanced)_
- [x] **F-02b**: Auto-redaction: visual "Blackout" of contact details on PDF layer — _v1.0, Phase 5_
- [x] **F-02c**: Blind Profile generation: auto-generate summary "Front Sheet" from extracted skills — _v1.0, Phase 5_

#### Human-in-the-Loop Visual Editor (F-03)

- [x] **F-03a**: Split view: Original CV on left | Parsed fields on right — _v1.0, Phase 3_
- [x] **F-03b**: Instant fix: click "Wrong Phone Number" on PDF -> validate/fix field immediately — _v1.0, Phase 3_
- [x] **F-03c**: Branding engine: apply theme.json (Logo, Colors, Headers) to generate final Client PDF — _v1.0, Phase 5_

#### JD Matching (M-01)

- [x] **M-01a**: User can paste or upload a Job Description — _v1.0, Phase 4_
- [x] **M-01b**: User can select multiple CVs to rate against a JD — _v1.0, Phase 4_
- [x] **M-01c**: System scores each CV against the JD (% match or ranking score) — _v1.0, Phase 4_
- [x] **M-01d**: CVs appear ranked by match score for each JD — _v1.0, Phase 4_
- [x] **M-01e**: Matching skills/requirements are highlighted in the CV view — _v1.0, Phase 4_

## v2 Requirements (Unchanged — Not in Scope for v1)

### Phase 2: The Silent Listener

- L-01a: Virtual device captures system output + mic input
- L-01b: Stealth mode: no bot participant
- L-02a: Structured JSON output for ATS injection
- L-02b: Custom scorecard fields

### Phase 3: The Co-Pilot Driver

- D-01a: LinkedIn tab scraping
- D-01b: Bullhorn/Salesforce injection
- D-01c: Human speed compliance
- D-02a: Local sourcing database

## Traceability

| Requirement | Roadmap Phase                     | Status           |
| ----------- | --------------------------------- | ---------------- |
| F-01a       | Phase 6: Bulk Processing          | Deferred to v1.1 |
| F-01b       | Phase 6: Bulk Processing          | Deferred to v1.1 |
| F-01c       | Phase 2: Parsing Pipeline         | Complete         |
| F-02a       | Phase 2 + 2.1: Parsing + LLM      | Complete         |
| F-02b       | Phase 5: Anonymization & Branding | Complete         |
| F-02c       | Phase 5: Anonymization & Branding | Complete         |
| F-03a       | Phase 3: Visual Editor            | Complete         |
| F-03b       | Phase 3: Visual Editor            | Complete         |
| F-03c       | Phase 5: Anonymization & Branding | Complete         |
| M-01a       | Phase 4: JD Matching              | Complete         |
| M-01b       | Phase 4: JD Matching              | Complete         |
| M-01c       | Phase 4: JD Matching              | Complete         |
| M-01d       | Phase 4: JD Matching              | Complete         |
| M-01e       | Phase 4: JD Matching              | Complete         |

---

## Milestone Summary

**Shipped:** 12 of 14 v1 requirements
**Deferred:** F-01a (100+ file batch), F-01b (OS context menu) — moved to v1.1 Phase 6
**Dropped:** None
**Adjusted:** F-02a enhanced with LLM extraction (Phase 2.1) beyond original spaCy-only spec

---

_Archived: 2026-01-30 as part of v1 milestone completion_
