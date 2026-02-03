# Phase 9: Communication Infrastructure - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Configure SMS and email providers, create message templates with variable substitution, send messages to candidates, track delivery status via polling, and provide DNC list mechanism. This is the foundation that Phase 10 (workflow automation) and Phase 11 (voice screening) build upon.

Users can manually send messages after this phase; automated sequences come in Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Credential Setup Flow

- Global credentials with per-project override capability
- Dedicated "Communication" tab in project settings (not a modal)
- Test verification: validate API connection first, then offer optional real test send
- Inline error display for invalid credentials (subtle, doesn't block)
- Data model should support future admin-set limits at company level

### Template Authoring UX

- Dropdown menu for variable insertion (click button, see available variables, select to insert)
- Side-by-side live preview (edit on left, rendered preview on right, updates as you type)
- Global template library + project copy (select from library, bring into project to customize)
- Separate template types for SMS and email (distinct entities, not unified)

### Delivery Status Display

- UI contained entirely within Outreach wheel section (no leak to Candidate Search)
- Candidates "graduate" from Candidate Search to Outreach (one-way flow around wheel)
- Timeline-style display showing message events with timestamps
- Status wheel visual: progress indicator showing sequence completion (1/3 text, 2/3 email, full after call)
- Color coding: blue for in-progress stages, green for success, red for failure
- Countdown to next action displayed per candidate
- Polling every minute for minimal processing drain
- Cost tracking per action: every API call logged with cost data for billing purposes

### Opt-out / DNC Handling

- DNC list as a tool; user responsible for compliance decisions
- Global DNC at company level (shared across users, like admin limits)
- DNC check happens upstream in Candidate Search at CV parsing time
- CVs matching DNC entries are flagged before graduating to Outreach
- No automatic STOP keyword registration; recruiter reviews and decides

### Claude's Discretion

- Exact credential field layout within Communication tab
- Variable syntax format (e.g., {{candidate_name}} vs %candidate_name%)
- Template editor component library choice
- Polling backoff strategy on repeated failures
- Cost estimation display format

</decisions>

<specifics>
## Specific Ideas

- Status wheel concept: visual progress through outreach sequence, fills as stages complete
- Timeline cohesive with upcoming workflow view (sent and upcoming messages visible)
- Information architecture: one-way flow around Samsara Wheel, candidates graduate between sections
- Cost tracking foundation needed for future billing feature

</specifics>

<deferred>
## Deferred Ideas

- **Admin layer for company directors** — set limits for all staff, shared DNC list (multi-user architecture)
- **ElevenLabs Conversational AI** — Phase 11, already planned
- **Dedicated mobile for callbacks** — routing callbacks to recruiter's phone, Phase 11 consideration
- **ElevenLabs grant opportunity** — investigate startup grant for creative API usage
- **Cancel/re-order/postpone workflow controls** — Phase 10 (Outreach Workflow Engine)
- **AI reading text/email context before calling** — Phase 11 (AI Voice Screening)

</deferred>

---

_Phase: 09-communication-infrastructure_
_Context gathered: 2026-02-03_
