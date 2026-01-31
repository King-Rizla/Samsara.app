# Roadmap: Samsara

## Milestones

- **v1 The Sovereign Formatter** — Phases 1-7 + Phase 6, 47 plans (shipped 2026-01-30, completed 2026-01-31) → [Archive](milestones/v1-ROADMAP.md) | [Audit](milestones/v1-MILESTONE-AUDIT.md)
- **M2 Automated Outreach** — Phases 8-13 (in progress)

## M2 Automated Outreach

**Milestone Goal:** Transform Samsara from a CV processing tool into an automated candidate engagement platform -- SMS/email outreach, AI voice pre-screening, system audio recording, transcription, and ATS form automation, all local-first.

### Phase 8: Samsara Wheel & Foundation

**Goal**: Users navigate between recruitment workflow sections via the Samsara Wheel, with all M1 features preserved and the database ready for outreach data
**Depends on**: Phase 6 (complete)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, DAT-01, DAT-02
**Success Criteria** (what must be TRUE):

1. User sees the Samsara Wheel with 5 sections and Yama hub when inside a project
2. User can click any wheel section to navigate to that feature area with animated transition
3. All M1 features (CV parsing, JD matching, branding, bulk processing) work in the Candidate Search section
4. Each wheel section shows live status indicators (pipeline count, response rate placeholders)
5. Yama hub displays as a visual placeholder with eye icon and "coming soon" label

**Plans**: TBD

Plans:

- [ ] 08-01: Nested routing refactor (ProjectLayout + Outlet), CVSection extraction from ProjectView
- [ ] 08-02: SamsaraWheel component with Framer Motion animations, section navigation
- [ ] 08-03: SQLite migration v3 (all M2 tables), status indicator wiring, Yama placeholder

### Phase 9: Communication Infrastructure

**Goal**: Users can configure SMS and email providers and send templated messages to candidates with delivery tracking and opt-out compliance
**Depends on**: Phase 8
**Requirements**: COM-01, COM-02, COM-03, COM-04, COM-05, COM-06
**Success Criteria** (what must be TRUE):

1. User can enter and test Twilio SMS credentials within a project
2. User can enter and test SMTP email credentials within a project
3. User can create message templates with variable substitution (candidate name, role, company) and preview rendered output
4. System sends SMS and email to a candidate and user can see delivery status (sent/delivered/failed) update via polling
5. Candidates who reply STOP or opt out are added to an opt-out registry and blocked from future contact

**Plans**: TBD

Plans:

- [ ] 09-01: Credential storage (safeStorage encryption), provider config UI, test-send verification
- [ ] 09-02: Template engine with variable substitution, template CRUD UI
- [ ] 09-03: SMS/email send via Twilio + Nodemailer, delivery status polling, opt-out registry

### Phase 10: Outreach Workflow Engine

**Goal**: The system orchestrates automated outreach sequences -- triggering SMS/email on candidate approval, escalating on timeout, and responding to replies -- with full recruiter override control
**Depends on**: Phase 9
**Requirements**: WRK-01, WRK-02, WRK-03, WRK-04, WRK-05
**Success Criteria** (what must be TRUE):

1. Outreach triggers automatically when recruiter approves a candidate (SMS + email sent)
2. System escalates to AI screening call after configurable timeout (default 30 min) with no reply
3. Candidate reply triggers immediate AI screening call
4. Recruiter can manually pause, cancel, or force-trigger any outreach step per candidate from the outreach dashboard
5. Post-failed-screening candidate reply triggers the bot to schedule a recruiter callback slot

**Plans**: TBD

Plans:

- [ ] 10-01: XState state machine with SQLite persistence, outreach sequence lifecycle
- [ ] 10-02: Timer-based escalation (timeout handling surviving app restart), reply detection
- [ ] 10-03: Outreach dashboard UI (candidate pipeline view, manual controls, activity timeline)

### Phase 11: AI Voice Screening

**Goal**: The system calls candidates via AI voice, asks configurable screening questions, determines pass/fail, and logs the outcome and transcript to the candidate record
**Depends on**: Phase 10
**Requirements**: VOX-01, VOX-02, VOX-03, VOX-04, VOX-05
**Success Criteria** (what must be TRUE):

1. AI calls candidate via ElevenLabs Conversational AI + Twilio SIP when triggered by workflow
2. Screening script asks 3-5 configurable qualification questions sourced from role/JD criteria
3. AI determines pass/fail with a confidence score visible to the recruiter
4. On pass, AI tells the candidate a recruiter will call them back
5. Call outcome (pass/fail/confidence) and full transcript are logged to the candidate record and visible in the UI

**Plans**: TBD

Plans:

- [ ] 11-01: Voice provider abstraction (ElevenLabs + Twilio SIP), call initiation, polling loop
- [ ] 11-02: Screening script editor (per-role configurable questions), pass/fail scoring logic
- [ ] 11-03: Call record UI, transcript viewer, outcome display on candidate card

### Phase 12: System Audio Recording & Transcription

**Goal**: Recruiters can record their own calls via system audio capture and get local transcriptions attached to candidate records
**Depends on**: Phase 11
**Requirements**: REC-01, REC-02, REC-03
**Success Criteria** (what must be TRUE):

1. User can toggle system audio recording on/off in the outreach tab with a visible level meter confirming capture (Windows WASAPI)
2. Recorded audio is transcribed locally via faster-whisper in the Python sidecar without blocking CV parsing
3. Transcripts are attached to the candidate record alongside CV data and visible in the transcript viewer

**Plans**: TBD

Plans:

- [ ] 12-01: Python sidecar audio capture (WASAPI loopback), recording toggle UI with level meter
- [ ] 12-02: faster-whisper integration, transcription job queue, transcript attachment to candidate record

### Phase 13: ATS Integration

**Goal**: Users can map CV and transcript data to ATS fields and push that data into ATS web forms via a Chrome extension DOM bridge
**Depends on**: Phase 12
**Requirements**: ATS-01, ATS-02, ATS-03, ATS-04
**Success Criteria** (what must be TRUE):

1. User can define field mappings from CV + transcript data to ATS fields for a specific vendor
2. User can preview the ATS-ready data payload before submission
3. Chrome extension fills ATS web forms via DOM bridge using the mapped data from Electron
4. A mock ATS page is available for testing the DOM bridge end-to-end without a real ATS account

**Plans**: TBD

Plans:

- [ ] 13-01: Field mapping engine + editor UI, ATS-ready data preview
- [ ] 13-02: Chrome extension (manifest, content scripts, WebSocket bridge to Electron)
- [ ] 13-03: Mock ATS test page, end-to-end DOM fill verification

---

## Future Milestones

Milestone drafts in `.planning/milestones/`:

- `03-client-coordination/ROADMAP-DRAFT.md` -- Feedback portal, interview scheduling
- `04-intelligent-sourcing/ROADMAP-DRAFT.md` -- Call transcription, boolean search, CV library connectors
- `05-yama/ROADMAP-DRAFT.md` -- Conversational AI agent (6 phases, 33 requirements)

---

## Progress

**Execution Order:** Phases execute in numeric order: 8 -> 9 -> 10 -> 11 -> 12 -> 13

| Phase                           | Milestone | Plans Complete | Status      | Completed |
| ------------------------------- | --------- | -------------- | ----------- | --------- |
| 8. Samsara Wheel & Foundation   | M2        | 0/3            | Not started | -         |
| 9. Communication Infrastructure | M2        | 0/3            | Not started | -         |
| 10. Outreach Workflow Engine    | M2        | 0/3            | Not started | -         |
| 11. AI Voice Screening          | M2        | 0/3            | Not started | -         |
| 12. Recording & Transcription   | M2        | 0/2            | Not started | -         |
| 13. ATS Integration             | M2        | 0/3            | Not started | -         |

---

_Roadmap created: 2026-01-23_
_v1 archived: 2026-01-30_
_M2 roadmap created: 2026-01-31_
