# Phase 11: AI Voice Screening - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

AI calls candidates via ElevenLabs Conversational AI + Twilio SIP when triggered by workflow. This is **pre-screening** — not qualification testing. The goal is to gather logistics (salary, location, availability, interest, contact details) and identify disqualifying answers. Post-call analysis determines pass/fail. Call outcome and transcript are logged to candidate record.

</domain>

<decisions>
## Implementation Decisions

### Screening Script Design

- **Purpose:** Pre-screening logistics, not qualification testing
- **5 fixed question categories:** Salary expectations, location/relocation, availability/start date, interest level, best contact details
- **All 5 asked every call** — consistent data collection
- **Conversational style** — AI adapts naturally but follows a basic script structure
- **Context-aware** — Agent should reference prior SMS/email messaging if it occurred
- **Non-answer handling:** Rephrase once, then move on (log as unclear)

### Pass/Fail Determination

- **Disqualification model** — The call filters out candidates who don't meet thresholds
- **Key disqualifiers:** Location mismatch, salary out of range, not interested in opportunities
- **Threshold source:** From JD, but recruiter can override/specify if not explicit in JD
- **May need inline JD editing** to define screening criteria clearly
- **Post-call analysis** — Outcome determined after reviewing transcript, not real-time
- **Positive close regardless** — AI always ends with "one of our recruiters will be in touch if..."

### Candidate Experience

- **Intro format:** Name, agency, reason for call, "have you got 2 minutes?"
- **No "applied for" language** — These are sourced candidates, not applicants
- **Voice persona:** Warm and friendly
- **AI disclosure:** Present as human, disclose if specifically asked
- **Bad timing handling:** Ask to reschedule, capture callback time
- **AI name:** Configurable per agency in settings
- **Call duration:** 2-3 minutes — quick and efficient
- **Outro:** Confirm details back, then warm close
- **No automatic follow-up** after call — workflow waits for recruiter review

### Failure Handling

- **No answer:** Retry up to N times (configurable)
- **Voicemail:** Leave a brief message with callback request
- **Hang-up mid-call:** Mark as disengaged, don't retry
- **Technical failure:** Auto-retry once

### Claude's Discretion

- Pass/Maybe/Fail outcome structure (user said "you decide")
- Exact retry intervals and attempt limits
- Voicemail script content
- How to detect technical failure vs hang-up

</decisions>

<specifics>
## Specific Ideas

- "The caller agent should always end on a positive note by saying one of our recruiters will be in touch if..."
- Pre-screening focuses on disqualification, not qualification — we're trying to filter out, not filter in
- Should feel like a real 2-minute call with a friendly recruiter, not a robotic survey
- Context from prior SMS/email should inform the conversation (e.g., "Thanks for replying to our text...")

</specifics>

<deferred>
## Deferred Ideas

- Inline JD editing for screening criteria — may be needed but could be its own UI enhancement phase
- Voice/persona selection per role (currently fixed as warm/friendly)
- Multi-language support for calls

</deferred>

---

_Phase: 11-ai-voice-screening_
_Context gathered: 2026-02-05_
