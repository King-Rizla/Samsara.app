# Candidate Flow Vision

## Overview

This document defines the complete automated recruitment candidate flow for Samsara. It serves as the north star for all development work, mapping each stage from initial sourcing through interview scheduling.

**Current Milestone:** "The Sovereign Formatter" (v1) addresses a subset of Stage 1.

---

## Stage 1: Initial Setup & Sourcing

| Step | Description                                                                | Handled By                       | Status                  |
| ---- | -------------------------------------------------------------------------- | -------------------------------- | ----------------------- |
| 1    | Client call recording + job description                                    | USER INPUT                       | Not started             |
| 2    | Distills call details + JD into matching criteria                          | APP                              | Not started             |
| 3    | Creates booleans and searches connected CV libraries (wide/narrow/midline) | APP                              | Not started             |
| 4    | Downloads or scrapes all relevant CVs                                      | APP                              | Not started             |
| 5    | Checks for duplications                                                    | APP                              | Not started             |
| 5b   | Allows user to submit additional CVs                                       | USER INPUT (optional)            | **BUILT** (drag-drop)   |
| 6    | Browses connected database/ATS for additional matches                      | APP                              | Not started             |
| 7    | Scores all matches against criteria                                        | APP                              | **BUILT** (JD matching) |
| 8    | Select which candidates proceed OR auto proceed                            | USER INPUT or APP (configurable) | Partial (manual only)   |

### What's Built (Milestone 1)

The current "Sovereign Formatter" milestone delivers:

- **CV Parsing Pipeline** (Phase 2, 2.1): Drag-drop CV processing with LLM extraction
- **Visual Editor** (Phase 3): Queue management, human-in-the-loop corrections
- **JD Matching** (Phase 4): Score CVs against job descriptions with skill highlighting
- **Project Organization** (Phase 4.5): Multi-project workflow isolation
- **Queue Infrastructure** (Phase 4.6): Persistent queue with status tracking
- **Dashboard Enhancements** (Phase 4.7): Usage tracking, pinned projects, unified settings

### Remaining in Milestone 1

- **Phase 5**: Anonymization & branding (redaction, blind profiles, themed PDFs)
- **Phase 6**: Bulk processing (100+ CVs, OS context menu integration)
- **Phase 7**: Testing and security hardening

---

## Stage 2: Candidate Outreach

| Step | Description                                                             | Handled By | Status                |
| ---- | ----------------------------------------------------------------------- | ---------- | --------------------- |
| 9    | Initiates text message and email communication with approved candidates | APP        | Not started           |
| 10a  | No reply in 30 mins -> AI pre-screening call                            | APP        | Not started           |
| 10b  | Candidate replies -> Bot schedules call with recruiter                  | APP        | Not started           |
| 11   | Calls recorded and logged using privacy recording                       | APP        | Not started           |
| 12   | Candidates who proceed have all data put into fields ready for ATS      | APP        | Not started           |
| 13   | Application inputs details into ATS                                     | APP        | Not started           |
| 14   | Front sheet and branded CV is created                                   | APP        | **PLANNED** (Phase 5) |
| 15   | Sent to client using details from project initialisation                | APP        | Not started           |

### Key Integrations Required

- SMS API (Twilio, MessageBird, etc.)
- Email API (SendGrid, SES, etc.)
- AI Voice Calling (Bland.ai, Vapi, etc.)
- Call Recording (privacy-compliant system audio capture)
- ATS Integration (Bullhorn, JobAdder, etc.)

---

## Stage 3: Client Decision & Interview

| Step | Description                                                                  | Handled By   | Status      |
| ---- | ---------------------------------------------------------------------------- | ------------ | ----------- |
| 16   | Client indicates interest/rejection                                          | CLIENT INPUT | Not started |
| 17a  | If interested -> Bot liaises with both parties to schedule interview         | APP          | Not started |
| 17b  | If not interested -> Bot asks client for feedback                            | APP          | Not started |
| 18   | Interview booked -> Send confirmation to candidate; BCC recruiter and client | APP          | Not started |

### Key Integrations Required

- Calendar Integration (Google Calendar, Outlook, Calendly)
- Client Portal or Email-based feedback collection
- Automated scheduling with availability checking

---

## Recruiter Controls (Available Throughout)

| Feature             | Type            | Status                                               |
| ------------------- | --------------- | ---------------------------------------------------- |
| Stage Tracking      | USER MONITORING | Partial (queue status)                               |
| Stage Control       | USER INPUT      | Partial (retry/delete)                               |
| Agent Communication | USER INPUT      | Not started                                          |
| Cost Monitoring     | USER MONITORING | **BUILT** (Phase 4.7 - token tracking, usage limits) |

---

## Milestone Mapping

### Milestone 1: The Sovereign Formatter (Current)

**Covers:** Steps 5b, 7, 8 (partial), 14 (planned)
**Focus:** Local CV processing, parsing, matching, branding

### Milestone 2: Automated Outreach (Future)

**Covers:** Steps 9-15
**Focus:** Candidate communication, pre-screening, ATS integration

### Milestone 3: Client Coordination (Future)

**Covers:** Steps 16-18
**Focus:** Client feedback loop, interview scheduling

### Milestone 4: Intelligent Sourcing (Future)

**Covers:** Steps 1-6, 8 (auto-proceed)
**Focus:** Call transcription, criteria generation, CV library integration, de-duplication

---

## Technical Architecture Notes

### Local-First Constraint

All processing must remain local where possible. External integrations (SMS, email, calendar) require careful consideration of:

- Data minimization (only send what's necessary)
- User consent workflows
- Audit logging for compliance

### Orchestrator Agent

The "Agent Communication" feature implies a conversational interface where recruiters can:

- Query the system about candidate status
- Override automated decisions
- Request explanations for scores/recommendations

This likely requires an LLM-powered chat interface with access to project context.

### DOM Bridge Strategy

Per PROJECT.md, ATS integration uses browser DOM manipulation rather than paid APIs. This means:

- Browser extension or desktop automation
- Scraping ATS web interfaces
- Field mapping configurations per ATS vendor

---

## Configurable Options

| Option                 | Description                               | Default                  |
| ---------------------- | ----------------------------------------- | ------------------------ |
| Auto-proceed threshold | Score above which candidates auto-advance | Manual selection         |
| Outreach timeout       | Time before AI call if no reply           | 30 minutes               |
| Search scope           | Wide/narrow/midline boolean generation    | Configurable per project |
| Recording mode         | What gets recorded (calls, screens, etc.) | Calls only               |

---

## Data Flow Summary

```
Call Recording + JD
        |
        v
[Criteria Extraction] --> [Boolean Search] --> [CV Download]
        |                                            |
        v                                            v
[Manual CV Upload] -----------------------> [De-duplication]
                                                     |
                                                     v
                                            [Scoring & Ranking]
                                                     |
                                    +----------------+----------------+
                                    |                                 |
                                    v                                 v
                            [Manual Selection]              [Auto-proceed]
                                    |                                 |
                                    +----------------+----------------+
                                                     |
                                                     v
                                            [Candidate Outreach]
                                                     |
                                    +----------------+----------------+
                                    |                                 |
                                    v                                 v
                            [AI Pre-screen]               [Recruiter Call]
                                    |                                 |
                                    +----------------+----------------+
                                                     |
                                                     v
                                            [ATS Data Entry]
                                                     |
                                                     v
                                            [Branded CV + Front Sheet]
                                                     |
                                                     v
                                            [Send to Client]
                                                     |
                                    +----------------+----------------+
                                    |                                 |
                                    v                                 v
                              [Interested]                    [Not Interested]
                                    |                                 |
                                    v                                 v
                        [Schedule Interview]              [Request Feedback]
                                    |
                                    v
                        [Send Confirmations]
```

---

## Legend

| Term         | Meaning                         |
| ------------ | ------------------------------- |
| USER INPUT   | Requires recruiter action       |
| CLIENT INPUT | Requires client action          |
| APP          | Automated by Samsara            |
| BUILT        | Implemented in current codebase |
| PLANNED      | In current milestone roadmap    |
| Not started  | Future milestone work           |

---

_Created: 2026-01-27_
_Updated: 2026-01-28 (Phase 4.7 complete)_
_Purpose: Vision document for full candidate automation scope_
