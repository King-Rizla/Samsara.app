# Requirements: Samsara

**Defined:** 2026-01-23
**Core Value:** Architecture as the Advantage — Zero Latency, Zero Egress, Zero Per-Seat Tax

## v1 Requirements

### Phase 1: The Sovereign Formatter

*The "Tip of the Spear" to disrupt DaXtra/AllSorted.*

#### Bulk Ingest (F-01)

- [ ] **F-01a**: Drag-and-drop queue handles 100+ PDF/Docx files simultaneously
- [ ] **F-01b**: OS right-click context menu integration (Windows/macOS): "Format with Samsara"
- [ ] **F-01c**: < 2 seconds per resume processing on local CPU (no upload progress bars)

#### Local Parsing & Anonymization (F-02)

- [ ] **F-02a**: Local Python extraction (pdfplumber/spacy) of Name, Phone, Email, Address
- [ ] **F-02b**: Auto-redaction: visual "Blackout" of contact details on PDF layer
- [ ] **F-02c**: Blind Profile generation: auto-generate summary "Front Sheet" from extracted skills

#### Human-in-the-Loop Visual Editor (F-03)

- [ ] **F-03a**: Split view: Original CV on left | Parsed fields on right
- [ ] **F-03b**: Instant fix: click "Wrong Phone Number" on PDF → validate/fix field immediately
- [ ] **F-03c**: Branding engine: apply theme.json (Logo, Colors, Headers) to generate final Client PDF

## v2 Requirements

### Phase 2: The Silent Listener

*Disrupting Metaview/Fireflies.*

#### System Audio Capture (L-01)

- **L-01a**: Virtual device captures system output (candidate) + mic input (recruiter)
- **L-01b**: Stealth mode: no "Samsara Bot" participant in Zoom/Teams calls

#### Local JSON Extraction (L-02)

- **L-02a**: Structured output: local LLM outputs strict JSON for ATS injection (e.g., `{"salary_min": 50000, "notice_period": "Immediate"}`)
- **L-02b**: Custom maps: user defines their own "Scorecard" fields

### Phase 3: The Co-Pilot Driver

*Disrupting Gem/SourceWhale.*

#### DOM Bridge (D-01)

- **D-01a**: The "Reader": scrape data from active LinkedIn tab (Sidecar)
- **D-01b**: The "Writer": inject data into active Bullhorn/Salesforce tab
- **D-01c**: Compliance: "Human Speed" limits to prevent bans

#### Local Sourcing Database (D-02)

- **D-02a**: "The Pile": local SQLite database of sourced candidates (no cloud hosting of scraped data)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud processing | Core value is local-first; eliminates COGS and privacy risk |
| Per-seat licensing | Business model is agency-wide license |
| Bot-based call recording | Key decision: stealth via system audio capture |
| Direct API integrations | Key decision: DOM Bridge approach for universal compatibility |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| F-01a | Phase 1 | Pending |
| F-01b | Phase 1 | Pending |
| F-01c | Phase 1 | Pending |
| F-02a | Phase 1 | Pending |
| F-02b | Phase 1 | Pending |
| F-02c | Phase 1 | Pending |
| F-03a | Phase 1 | Pending |
| F-03b | Phase 1 | Pending |
| F-03c | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-23*
*Last updated: 2026-01-23 after initialization*
