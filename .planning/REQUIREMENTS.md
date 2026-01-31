# Requirements: Samsara M2 Automated Outreach

**Defined:** 2026-01-31
**Core Value:** Architecture as the Advantage — Zero Latency, Zero Egress, Zero Per-Seat Tax

## M2 Requirements

Requirements for the Automated Outreach milestone. Each maps to roadmap phases.

### Navigation & UI

- [ ] **NAV-01**: User sees Samsara Wheel with 5 sections + Yama hub when inside a project
- [ ] **NAV-02**: User can click a wheel section to navigate to that feature area
- [ ] **NAV-03**: Existing M1 features (CV parsing, JD matching, branding, bulk) accessible via Candidate Search section
- [ ] **NAV-04**: Each wheel section shows live status indicators (pipeline count, response rate, etc)
- [ ] **NAV-05**: Yama hub displays as visual placeholder ("coming soon") with eye icon

### Communication

- [ ] **COM-01**: User can configure Twilio SMS credentials per project
- [ ] **COM-02**: User can configure email provider credentials (SMTP via Nodemailer)
- [ ] **COM-03**: User can create SMS/email templates with variable substitution (candidate name, role, company)
- [ ] **COM-04**: System sends SMS and email to candidate on outreach trigger
- [ ] **COM-05**: User can view delivery status per message (sent/delivered/failed)
- [ ] **COM-06**: System maintains opt-out registry — candidates who opt out are never contacted again

### Outreach Workflow

- [ ] **WRK-01**: Outreach triggers automatically when recruiter approves a candidate
- [ ] **WRK-02**: System escalates to AI screening call after 30-minute no-reply timeout
- [ ] **WRK-03**: Candidate reply triggers AI screening call immediately
- [ ] **WRK-04**: Recruiter can manually pause, cancel, or trigger any outreach step per candidate
- [ ] **WRK-05**: Post-failed-screening reply triggers bot to schedule recruiter callback slot

### AI Voice Screening

- [ ] **VOX-01**: AI calls candidate via ElevenLabs Conversational AI + Twilio SIP
- [ ] **VOX-02**: Screening script asks 3-5 configurable qualification questions per role
- [ ] **VOX-03**: AI determines pass/fail with confidence score
- [ ] **VOX-04**: On pass, AI tells candidate "recruiter will call you back"
- [ ] **VOX-05**: Call outcome and transcript logged to candidate record

### Recording & Transcription

- [ ] **REC-01**: User can toggle system audio recording on/off in the outreach tab (Windows WASAPI)
- [ ] **REC-02**: Recorded audio transcribed locally via Whisper
- [ ] **REC-03**: Transcripts attached to candidate record alongside CV data

### ATS Integration

- [ ] **ATS-01**: User can define field mappings from CV + transcript data to ATS fields per vendor
- [ ] **ATS-02**: User can preview ATS-ready data before submission
- [ ] **ATS-03**: Chrome extension fills ATS web forms via DOM bridge with mapped data
- [ ] **ATS-04**: Mock ATS page available for testing DOM bridge

### Data Model

- [ ] **DAT-01**: All outreach data (messages, calls, transcripts, sequences) scoped to project
- [ ] **DAT-02**: SQLite schema extended with tables for messages, call records, transcripts, templates, outreach sequences, provider credentials, ATS mappings

## Future Requirements

Deferred to post-M2 milestones.

- **NAV-06**: Responsive wheel for tablet/mobile
- **COM-07**: A/B testing for message templates
- **WRK-06**: Visual workflow builder for outreach sequences
- **VOX-06**: Multi-language screening scripts
- **REC-04**: AI call recording pulled from voice provider API
- **REC-05**: Recording consent capture with audit trail (UK compliance)
- **REC-06**: macOS system audio capture (requires BlackHole virtual audio device)
- **ATS-05**: Mapping templates shareable across projects
- **SUB-01**: Client submission (branded CV + front sheet + data via email)
- **SUB-02**: Batch submission for multiple candidates

## Out of Scope

| Feature                      | Reason                                                     |
| ---------------------------- | ---------------------------------------------------------- |
| Visual workflow builder      | Over-engineering; simple linear sequence sufficient for M2 |
| NLP reply parsing            | Unreliable; use keyword matching + manual escalation       |
| Calendar integration         | Deferred to M3 (Client Coordination)                       |
| Multi-channel chatbot        | Scope creep into CRM territory                             |
| A/B testing for templates    | Premature optimization; agencies need basic outreach first |
| Voice input / voice agent UI | Scope creep; belongs in M4/M5                              |
| Autonomous web browsing      | ToS violations, security risk                              |
| Proactive agent suggestions  | M5 territory; agent never acts without being asked         |

## Traceability

| Requirement | Phase | Status  |
| ----------- | ----- | ------- |
| NAV-01      |       | Pending |
| NAV-02      |       | Pending |
| NAV-03      |       | Pending |
| NAV-04      |       | Pending |
| NAV-05      |       | Pending |
| COM-01      |       | Pending |
| COM-02      |       | Pending |
| COM-03      |       | Pending |
| COM-04      |       | Pending |
| COM-05      |       | Pending |
| COM-06      |       | Pending |
| WRK-01      |       | Pending |
| WRK-02      |       | Pending |
| WRK-03      |       | Pending |
| WRK-04      |       | Pending |
| WRK-05      |       | Pending |
| VOX-01      |       | Pending |
| VOX-02      |       | Pending |
| VOX-03      |       | Pending |
| VOX-04      |       | Pending |
| VOX-05      |       | Pending |
| REC-01      |       | Pending |
| REC-02      |       | Pending |
| REC-03      |       | Pending |
| ATS-01      |       | Pending |
| ATS-02      |       | Pending |
| ATS-03      |       | Pending |
| ATS-04      |       | Pending |
| DAT-01      |       | Pending |
| DAT-02      |       | Pending |

**Coverage:**

- M2 requirements: 30 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 30

---

_Requirements defined: 2026-01-31_
_Last updated: 2026-01-31 after initial definition_
