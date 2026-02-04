# Phase 10: Outreach Workflow Engine - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Orchestrate automated outreach sequences — triggering SMS/email on candidate graduation, escalating to AI call on timeout or reply, with full recruiter override control. Candidates enter via graduation from JD matches; the state machine manages the sequence lifecycle.

</domain>

<decisions>
## Implementation Decisions

### Candidate Graduation

- Both individual approval (button per card) and batch selection (checkboxes + "Graduate selected")
- Agent can be instructed to graduate candidates above a match % threshold
- Graduation triggers immediate outreach — no extra confirmation step
- No undo needed once graduated; candidates stay in pipeline (can pause but not remove)
- Graduated candidates visible in BOTH Candidate Search (with "Graduated" badge) and Outreach section
- Toggle filter in Candidate Search to show/hide graduated candidates
- Candidates sorted by match % by default in Outreach, match % always visible

### Sequence Timing

- Initial outreach: SMS + Email sent simultaneously on graduation
- Escalation timeout: Project-configurable (default 30 min, range 15 min to 2 hours)
- Working hours: Configurable per project (queue messages outside hours)
- AI call escalation: Optional — project setting to enable/disable entirely
- App restart catch-up: All missed escalations execute in order when app reopens

### Reply Detection

- Primary: Twilio webhooks for SMS (fastest detection)
- Fallback: Polling for email inbox
- Intent detection: Keyword-based (positive triggers AI call, negative does not)
- Ambiguous replies: Treat as positive — let AI call determine interest
- Thread display: Full SMS/email conversation thread per candidate

### Dashboard & Controls

- Kanban pipeline view: Pending → Contacted → Replied → Screening → Passed/Failed columns
- Candidate cards show: Name, match %, current stage, timeline preview, contact info, last message snippet
- Primary action visible on card, advanced controls (Pause, Skip, Force call, Send message, Archive) in overflow menu
- Click card → side panel opens with full details (pipeline stays visible)

### Claude's Discretion

- Exact keyword lists for positive/negative intent classification
- Kanban card layout and spacing
- Timeline preview format on cards
- Webhook retry/fallback logic
- Side panel animation and width

</decisions>

<specifics>
## Specific Ideas

- Agent-driven graduation: "Graduate all candidates above 85% match" as an instruction the agent can execute
- Caller agent determines interest quickly if reply was ambiguous — don't over-engineer keyword detection
- Match % stays prominent throughout outreach flow — recruiters want to see quality context

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 10-outreach-workflow-engine_
_Context gathered: 2026-02-04_
