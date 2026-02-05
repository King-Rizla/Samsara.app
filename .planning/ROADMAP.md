# Roadmap: Samsara

## Milestones

- **v1 The Sovereign Formatter** — Phases 1-7 + Phase 6, 47 plans (shipped 2026-01-30, completed 2026-01-31) → [Archive](milestones/v1-ROADMAP.md) | [Audit](milestones/v1-MILESTONE-AUDIT.md)
- **M2 Automated Outreach** — Phases 8-14 (in progress)

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

**Plans**: 3 plans

Plans:

- [ ] 08-01-PLAN.md — Nested routing refactor (ProjectLayout + Outlet), CandidateSearchSection extraction, motion install
- [ ] 08-02-PLAN.md — SamsaraWheel SVG component with Motion animations, 5 wedges, Yama hub, section navigation
- [ ] 08-03-PLAN.md — SQLite migration v5 (7 M2 outreach tables)

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

**Plans**: 4 plans

Plans:

- [x] 09-01-PLAN.md — Credential storage (safeStorage encryption), provider config UI, test-send verification
- [x] 09-02-PLAN.md — Template engine with variable substitution, template CRUD UI
- [x] 09-03-PLAN.md — SMS/email send via Twilio + Nodemailer, delivery status polling, opt-out registry
- [x] 09-04-PLAN.md — UAT gap closure (header overflow, AlertDialog delete, Outreach visibility)

### Phase 10: Outreach Workflow Engine

**Goal**: The system orchestrates automated outreach sequences -- triggering SMS/email on candidate graduation, escalating on timeout, and responding to replies -- with full recruiter override control via Kanban dashboard
**Depends on**: Phase 9
**Requirements**: WRK-01, WRK-02, WRK-03, WRK-04, WRK-05
**Success Criteria** (what must be TRUE):

1. Outreach triggers automatically when recruiter graduates a candidate (SMS + email sent)
2. System escalates to AI screening call after configurable timeout (default 30 min) with no reply
3. Candidate reply triggers immediate AI screening call
4. Recruiter can manually pause, cancel, or force-trigger any outreach step per candidate from the outreach dashboard
5. Post-failed-screening candidate reply triggers the bot to schedule a recruiter callback slot

**Plans**: 3 plans

Plans:

- [x] 10-01-PLAN.md — XState v5 state machine, SQLite persistence, graduation flow, database migration v7
- [x] 10-02-PLAN.md — Reply polling, intent classification, working hours queueing, missed escalation recovery
- [x] 10-03-PLAN.md — Kanban dashboard UI with @dnd-kit, candidate cards, side panel, graduation controls

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

**Plans**: 3 plans

Plans:

- [ ] 11-01-PLAN.md — ElevenLabs SDK integration, voice service, polling infrastructure, database migration v9
- [ ] 11-02-PLAN.md — VoiceSettings UI for credentials, screening criteria configuration, screeningService
- [ ] 11-03-PLAN.md — Claude transcript analysis, CallRecordCard, TranscriptViewer, CandidatePanel integration

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

### Phase 14: MVP Packaging & Release

**Goal**: Ship a distributable Windows installer from M1 codebase on an `mvp` branch — app icon, product metadata, Squirrel installer, PDF parsing fixes, and first-run polish — so recruiters can install and test without a terminal
**Depends on**: Phase 13 (can execute independently — branches from v1 code, not M2)
**Requirements**: MVP-01 (installer), MVP-02 (app icon/branding), MVP-03 (PDF parsing reliability), MVP-04 (first-run UX)
**Success Criteria** (what must be TRUE):

1. `mvp` branch exists with v1 code frozen, `master` continues M2 development independently
2. Running `npm run make` on the `mvp` branch produces a Squirrel `.exe` installer with Samsara icon and product name
3. Installer creates desktop shortcut and Start Menu entry — user launches by double-clicking, no terminal
4. PDF parsing failure rate reduced from 30-40% to under 10% on the test corpus
5. First-run experience includes a sample project or onboarding hint so testers aren't dropped into a blank screen

**Plans**: 4 plans

Plans:

- [ ] 14-01-PLAN.md — Branch creation, build config fixes (sidecar path, DevTools, icon, asar)
- [ ] 14-02-PLAN.md — PDF parsing reliability (pdfplumber fallback, pre-cleaning, error recovery)
- [ ] 14-03-PLAN.md — First-run onboarding overlay
- [ ] 14-04-PLAN.md — Cherry-pick, build installer, end-to-end verification

---

## Future Milestones

Milestone drafts in `.planning/milestones/`:

- `03-client-coordination/ROADMAP-DRAFT.md` -- Feedback portal, interview scheduling
- `04-intelligent-sourcing/ROADMAP-DRAFT.md` -- Call transcription, boolean search, CV library connectors
- `05-yama/ROADMAP-DRAFT.md` -- Conversational AI agent (6 phases, 33 requirements)

---

## Progress

**Execution Order:** Phases execute in numeric order: 8 -> 9 -> 10 -> 11 -> 12 -> 13. Phase 14 runs independently on mvp branch.

| Phase                           | Milestone | Plans Complete | Status      | Completed  |
| ------------------------------- | --------- | -------------- | ----------- | ---------- |
| 8. Samsara Wheel & Foundation   | M2        | 3/3            | Complete    | 2026-01-31 |
| 9. Communication Infrastructure | M2        | 4/4            | Complete    | 2026-02-04 |
| 10. Outreach Workflow Engine    | M2        | 3/3            | Complete    | 2026-02-05 |
| 11. AI Voice Screening          | M2        | 0/3            | Not started | -          |
| 12. Recording & Transcription   | M2        | 0/2            | Not started | -          |
| 13. ATS Integration             | M2        | 0/3            | Not started | -          |
| 14. MVP Packaging & Release     | mvp       | 5/5            | Complete    | 2026-02-03 |

---

_Roadmap created: 2026-01-23_
_v1 archived: 2026-01-30_
_M2 roadmap created: 2026-01-31_
