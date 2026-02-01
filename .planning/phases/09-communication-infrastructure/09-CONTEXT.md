# Phase 9: Communication Infrastructure - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can configure SMS and email providers, create message templates with variable substitution, and send templated messages to candidates with delivery tracking and opt-out compliance. This phase builds the communication plumbing — the outreach workflow engine (sequencing, escalation, automation) is Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Credential Setup

- Global credentials in existing app-level settings (sidebar access)
- Per-project overrides available via a dropdown on the left side of the Samsara Wheel
- Project settings dropdown contains only settings that can be overridden (credentials, templates, outreach config) — no project metadata
- Test button: validate credentials with provider API first, then offer optional "send test message to yourself" as second step
- Providers: Twilio for SMS, SMTP (Nodemailer) for email

### Template Authoring

- Shared template library as defaults, with per-role customization possible
- Basic variable set: candidate name, role title, company name, recruiter name
- Rich editor with variable chips/pills — click to insert, visual distinction between text and variables
- Side-by-side preview: editor on left, rendered preview with sample candidate data on right
- Templates for both SMS and email

### Sending & Status

- Candidates auto-enter contact queue when approved/graduated from Candidate Search section
- Default flow is automatic — recruiter can cancel individuals or batches but queue entry is the default
- Pipeline/kanban columns for outreach view: Queued → Contacted → Replied → Screened
- Batch sending at configurable interval (not immediate on queue)
- Status badge on each candidate card updates on poll + activity feed for detailed event history
- Polling interval: ~60 seconds, plus event-driven updates when actions occur
- No real-time websockets — fits existing polling-first architecture decision

### Opt-out & Compliance

- DNC (Do Not Contact) registry is global across all projects on the machine
- If candidate opts out in any project, they're blocked everywhere
- Schema designed to support future cross-machine sync via admin layer
- Opted-out candidates visible in pipeline with "Opted Out" badge + send buttons disabled
- STOP keyword (SMS) and unsubscribe (email) trigger automatic opt-out

### Claude's Discretion

- Audit trail implementation level (recommend full logging with timestamps for GDPR, exportable)
- Exact polling mechanism and interval tuning
- Kanban column styling and card layout details
- Template editor component choice
- Batch interval default value and configuration UI

</decisions>

<specifics>
## Specific Ideas

- Wheel left-side dropdown for project-specific settings is a new UI element — needs to integrate with existing Samsara Wheel from Phase 8
- The auto-queue pattern means Phase 9 needs a "graduation" hook from Candidate Search — when a candidate is approved, they enter the outreach pipeline
- Kanban columns should feel like a recruitment pipeline tracker, familiar to agency recruiters

</specifics>

<deferred>
## Deferred Ideas

- **Company-wide admin panel** — Directors set limits on team accounts, manage company-wide settings. Own milestone.
- **Cross-machine DNC sync** — DNC registry communicates between company instances via admin accounts. Depends on admin panel.
- **Samsara Wheel bug** — Wheel not appearing on app launch, navigates straight to CV system. Investigate separately (Phase 8 regression).

</deferred>

---

_Phase: 09-communication-infrastructure_
_Context gathered: 2026-02-01_
