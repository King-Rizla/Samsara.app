# Milestone 3: Client Coordination (DRAFT)

## Overview

This milestone closes the recruitment loop by automating client feedback collection and interview scheduling. After candidates are submitted, the system tracks client decisions and orchestrates the interview booking process.

**Vision Reference:** Candidate Flow Steps 16-18 (Stage 3)

**Prerequisite:** Milestone 2 complete (Automated Outreach)

---

## Scope

| Step | Description                                           | Automation Level |
| ---- | ----------------------------------------------------- | ---------------- |
| 16   | Client indicates interest/rejection                   | Client-initiated |
| 17a  | Bot schedules interview (if interested)               | Full             |
| 17b  | Bot requests feedback (if rejected)                   | Full             |
| 18   | Send interview confirmations (BCC recruiter + client) | Full             |

---

## Proposed Phases

### Phase 1: Client Feedback Portal

**Goal:** Give clients a simple interface to respond to candidate submissions

**Success Criteria:**

1. Unique link generated per submission batch
2. Client can mark candidates as Interested / Not Interested / Maybe
3. Optional feedback text field for rejections
4. No login required (link-based authentication)
5. Responses sync back to Samsara in real-time

**Key Decisions Needed:**

- Web portal vs email-based responses?
- How long should links remain valid?
- Anonymous feedback or tied to client contact?

---

### Phase 2: Email-Based Feedback (Alternative)

**Goal:** Allow clients to respond via email for lower friction

**Success Criteria:**

1. Submission email includes quick-reply links (Interested / Pass)
2. Click tracking determines client decision
3. Reply parsing for written feedback
4. Fallback to portal if email interaction fails
5. Works with common email clients (Outlook, Gmail)

**Key Decisions Needed:**

- Email link format (one-click vs confirmation page)?
- How to handle accidental clicks?
- Reply parsing accuracy expectations?

---

### Phase 3: Interview Scheduling Bot

**Goal:** Automate interview coordination between candidate and client

**Success Criteria:**

1. Bot initiates scheduling when client marks "Interested"
2. Bot collects candidate availability (via SMS/email conversation)
3. Bot collects client/interviewer availability
4. Proposes mutually available times
5. Handles time zone differences automatically
6. Reschedule flow if initial times don't work

**Key Decisions Needed:**

- Calendar integration depth? (Read-only vs create events?)
- How many scheduling attempts before human takeover?
- Video call link generation (Zoom, Teams, Meet)?

---

### Phase 4: Interview Confirmation System

**Goal:** Send professional confirmations to all parties

**Success Criteria:**

1. Confirmation email to candidate with interview details
2. BCC to recruiter and client on all communications
3. Calendar invite attached (.ics file)
4. Reminder sequence (24h, 1h before interview)
5. Reschedule/cancel links in confirmation

**Key Decisions Needed:**

- Reminder frequency configurable?
- What information included in calendar invite?
- Branding on confirmation emails?

---

### Phase 5: Rejection Feedback Loop

**Goal:** Capture actionable feedback when clients pass on candidates

**Success Criteria:**

1. Automated feedback request when client marks "Not Interested"
2. Structured feedback options (skills gap, experience, salary, culture fit)
3. Free-text field for detailed feedback
4. Feedback stored on candidate record
5. Aggregate feedback analytics per project

**Key Decisions Needed:**

- Feedback categories to offer?
- How to use feedback (improve matching, inform candidate)?
- Share feedback with candidate or recruiter-only?

---

### Phase 6: Client Communication Hub

**Goal:** Centralized view of all client interactions

**Success Criteria:**

1. Timeline view of all communications per submission
2. Status tracking (Submitted -> Viewed -> Decided -> Interview/Rejected)
3. Recruiter can manually intervene at any point
4. Notification when client hasn't responded (configurable timeout)
5. Escalation workflow for stale submissions

**Key Decisions Needed:**

- What triggers "stale" status?
- Automated follow-up to clients or manual prompt?
- Client-facing vs recruiter-facing views?

---

## Integration Requirements

| Integration           | Purpose                               | Priority |
| --------------------- | ------------------------------------- | -------- |
| Email Service         | Feedback requests, confirmations      | High     |
| Calendar APIs         | Availability checking, event creation | High     |
| Video Conferencing    | Meeting link generation               | Medium   |
| Webhook/Email Parsing | Client response capture               | High     |

---

## Data Model Extensions

```
submissions
  - id
  - project_id
  - candidate_id (FK to cvs)
  - client_id
  - sent_at
  - status (sent, viewed, interested, rejected, interview_scheduled)
  - feedback_text
  - feedback_categories[]

interviews
  - id
  - submission_id (FK)
  - scheduled_at
  - duration_minutes
  - location (video_link, address, phone)
  - status (scheduled, confirmed, completed, cancelled, rescheduled)
  - reminder_sent_at

clients
  - id
  - project_id
  - name
  - email
  - phone
  - calendar_integration_token
```

---

## Risk Assessment

| Risk                   | Mitigation                                     |
| ---------------------- | ---------------------------------------------- |
| Client doesn't respond | Automated follow-ups, recruiter notification   |
| Scheduling conflicts   | Multiple time proposals, human fallback        |
| Time zone errors       | Explicit time zone handling, confirmation step |
| Email deliverability   | Multiple channels, portal fallback             |
| Interview no-shows     | Reminder sequence, confirmation requirements   |

---

## Open Questions

1. Should the client portal require authentication for compliance?
2. How to handle multiple interviewers with different availability?
3. Integration with client's ATS (they may want candidates there too)?
4. Video interview vs in-person vs phone - how to handle each?
5. What happens after interview? (Offer stage out of scope for now?)

---

## Success Metrics

| Metric                            | Target             |
| --------------------------------- | ------------------ |
| Client response rate              | >80% within 48h    |
| Scheduling success rate           | >90% automated     |
| Time from submission to interview | <5 business days   |
| Feedback capture rate             | >60% of rejections |

---

_Draft created: 2026-01-28_
_Status: Awaiting Milestone 2 completion_
_Source: .planning/vision/candidate-flow.md_
