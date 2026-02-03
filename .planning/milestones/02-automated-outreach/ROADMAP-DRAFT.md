# Milestone 2: Automated Outreach (DRAFT)

## Overview

This milestone transforms Samsara from a CV processing tool into an automated candidate engagement platform. After CVs are scored and selected, the system initiates contact, conducts AI pre-screening, and prepares candidates for ATS submission.

**Vision Reference:** Candidate Flow Steps 9-15 (Stage 2)

**Prerequisite:** Milestone 1 complete (The Sovereign Formatter)

---

## Scope

| Step | Description                                      | Automation Level  |
| ---- | ------------------------------------------------ | ----------------- |
| 9    | Initiate SMS + email to approved candidates      | Full              |
| 10a  | AI pre-screening call (no reply after timeout)   | Full              |
| 10b  | Bot schedules recruiter call (candidate replies) | Full              |
| 11   | Call recording with privacy compliance           | Full              |
| 12   | Structure candidate data for ATS fields          | Full              |
| 13   | Input details into ATS                           | Full (DOM bridge) |
| 14   | Generate front sheet + branded CV                | Full (from M1)    |
| 15   | Send to client                                   | Full              |

---

## Proposed Phases

### Phase 1: Communication Infrastructure

**Goal:** Establish SMS and email sending capabilities with template management

**Success Criteria:**

1. User can configure SMS provider credentials (Twilio, MessageBird)
2. User can configure email provider credentials (SendGrid, SES, SMTP)
3. User can create message templates with variable substitution (candidate name, role, etc.)
4. System sends test messages successfully
5. Message history logged per candidate

**Key Decisions Needed:**

- Which SMS/email providers to support initially?
- Template editor complexity (plain text vs rich HTML)?
- Rate limiting and queue management approach?

---

### Phase 2: Outreach Workflow Engine

**Goal:** Automated outreach triggered when candidates are approved

**Success Criteria:**

1. User can configure outreach sequence (SMS first, email backup, or both)
2. System sends initial outreach when candidate status changes to "approved"
3. System tracks delivery status and opens (where available)
4. Configurable timeout before escalating to AI call (default 30 min)
5. User can manually trigger or cancel outreach per candidate

**Key Decisions Needed:**

- How does "approved" status get set? (From M1 selection UI?)
- What triggers the timeout? (No reply vs no open vs no click?)
- How to handle out-of-hours? (Queue until business hours?)

---

### Phase 3: AI Voice Integration

**Goal:** Automated pre-screening calls for non-responsive candidates

**Success Criteria:**

1. Integration with AI voice provider (Bland.ai, Vapi, Retell)
2. Pre-screening script configurable per role/project
3. Call initiates automatically after outreach timeout
4. Call recording captured and stored locally
5. Call transcript generated and attached to candidate record
6. Screening outcome (pass/fail/unclear) logged with confidence

**Key Decisions Needed:**

- Which voice AI provider? (Cost, quality, latency tradeoffs)
- How complex should screening scripts be? (Simple Q&A vs conversational?)
- What happens on "unclear" outcome? (Escalate to recruiter?)

---

### Phase 4: Recruiter Scheduling Bot

**Goal:** Handle candidates who respond to outreach

**Success Criteria:**

1. Bot detects candidate reply (SMS or email)
2. Bot engages in scheduling conversation
3. Integration with recruiter's calendar for availability
4. Meeting scheduled and confirmation sent to both parties
5. Fallback to manual scheduling if bot fails

**Key Decisions Needed:**

- NLP approach for understanding replies? (LLM vs intent classification?)
- Calendar integration method? (OAuth vs manual availability input?)
- How to handle complex scheduling (multiple time zones, rescheduling)?

---

### Phase 5: Call Recording & Privacy

**Goal:** Privacy-compliant recording of all recruitment calls

**Success Criteria:**

1. System audio capture (not bot joining calls)
2. Consent captured before recording starts
3. Recordings stored locally with encryption
4. Retention policy configurable (auto-delete after X days)
5. Audit log for compliance

**Key Decisions Needed:**

- Recording method? (System audio vs per-app capture?)
- Consent mechanism? (Verbal prompt vs written acknowledgment?)
- Storage encryption approach?

---

### Phase 6: ATS Field Mapping

**Goal:** Structure candidate data for ATS submission

**Success Criteria:**

1. User can define field mappings per ATS vendor
2. Extracted CV data maps to ATS-required fields
3. Missing required fields flagged for recruiter review
4. Preview of ATS-ready data before submission
5. Mapping templates shareable across projects

**Key Decisions Needed:**

- Which ATS vendors to prioritize? (Bullhorn, JobAdder, Vincere?)
- How to handle ATS-specific field types (dropdowns, lookups)?
- Validation rules per ATS?

---

### Phase 7: ATS DOM Bridge

**Goal:** Automate data entry into ATS web interfaces

**Success Criteria:**

1. Browser extension or desktop automation framework selected
2. DOM selectors configurable per ATS vendor
3. System fills ATS forms with mapped candidate data
4. Handles multi-step forms and page navigation
5. Error detection and recovery (field validation failures)

**Key Decisions Needed:**

- Extension vs desktop automation? (Reliability vs setup complexity)
- How to handle ATS updates breaking selectors?
- User confirmation before submission?

---

### Phase 8: Client Submission

**Goal:** Package and send candidate to client

**Success Criteria:**

1. Branded CV + front sheet attached (from M1 Phase 5)
2. Configurable submission method (email, portal upload, ATS share)
3. Submission logged with timestamp
4. Client details pulled from project initialization
5. Batch submission for multiple candidates

**Key Decisions Needed:**

- Client portal integrations? (Or email-only initially?)
- Submission tracking (read receipts, portal confirmations)?

---

## Integration Requirements

| Integration                 | Purpose              | Priority |
| --------------------------- | -------------------- | -------- |
| Twilio / MessageBird        | SMS sending          | High     |
| SendGrid / SES              | Email sending        | High     |
| Bland.ai / Vapi             | AI voice calls       | High     |
| Google Calendar / Outlook   | Recruiter scheduling | Medium   |
| System Audio API            | Call recording       | Medium   |
| Browser Extension Framework | ATS DOM bridge       | High     |

---

## Risk Assessment

| Risk                     | Mitigation                                          |
| ------------------------ | --------------------------------------------------- |
| SMS/email deliverability | Multiple provider support, fallback routing         |
| AI call quality          | Human escalation path, quality monitoring           |
| ATS DOM changes          | Selector versioning, community-maintained configs   |
| Privacy compliance       | Consent workflows, local storage, audit logs        |
| Candidate experience     | Opt-out mechanisms, human override always available |

---

## Open Questions

1. Should outreach be opt-in per candidate or bulk-enabled per project?
2. What's the fallback when all automated contact fails?
3. How do we handle candidates already in the ATS (de-duplication)?
4. Multi-language support for outreach templates?
5. What metrics should be tracked (response rates, conversion, etc.)?

---

_Draft created: 2026-01-28_
_Status: Awaiting Milestone 1 completion_
_Source: .planning/vision/candidate-flow.md_
