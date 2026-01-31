# M2 Automated Outreach Research Summary

**Project:** Samsara - Milestone 2
**Domain:** Automated recruitment outreach with AI screening
**Researched:** 2026-01-31
**Confidence:** MEDIUM

## Executive Summary

M2 transforms Samsara from a CV processing tool into an automated candidate engagement platform for UK recruitment agencies. The research reveals a complex integration challenge requiring seven distinct capabilities: SMS/email outreach, AI voice pre-screening, system audio recording for recruiter calls, transcription, ATS form automation, and coordinated workflow orchestration—all while maintaining the local-first architecture.

The recommended approach is **polling-first, not webhook-driven** due to desktop app constraints. Use Motion for the circular navigation UI, Twilio for SMS, Nodemailer for universal email, Bland.ai REST API for AI voice calling, Python sidecar with soundcard for system audio capture, faster-whisper for local transcription, and Playwright for ATS DOM automation. Total new dependencies: 4 npm packages (motion, twilio, nodemailer, playwright-core) and 4 Python packages (soundcard, sounddevice, faster-whisper, pydub).

The three critical risks are: (1) SMS deliverability failing due to lack of A2P sender registration (silently drops 60-90% of messages), (2) recording consent failures creating ICO liability under UK PECR/GDPR, and (3) ATS DOM automation breaking every 2-6 weeks as vendors update UIs. Mitigation requires UK sender registration before launch, explicit consent capture with audit logs, and config-driven selector architecture with health checks before each automation run.

## Key Findings

### Recommended Stack

M2 adds 8 npm packages and 4 Python packages to the existing Electron + React + Python stack, plus ffmpeg binary bundling. The key architectural decision is **main process handles all HTTP calls** (SMS, email, voice APIs), not the Python sidecar. Python sidecar extends only for audio capture and transcription—its strengths.

**Core technologies:**

- **motion** (formerly framer-motion) ^11.x: Wheel navigation animations — industry-standard React animation library with spring physics and layout orchestration. Decision already made.
- **twilio** ^5.x: SMS sending — industry standard with best deliverability and documentation. Most recruiters already have accounts.
- **nodemailer** ^6.x: Universal SMTP email — works with any provider (SendGrid, SES, Gmail, Outlook) without vendor lock-in.
- **Bland.ai REST API** (no SDK): AI voice calls — simplest outbound calling API. Single POST initiates call with script. Built-in recording and transcript.
- **soundcard** (Python) ^0.4.x: System audio capture — wraps WASAPI loopback (Windows) and CoreAudio (macOS). Critical limitation: macOS requires BlackHole virtual audio device (user install).
- **faster-whisper** (Python) ^1.0.x: Local transcription — 4x faster than OpenAI Whisper on CPU. Privacy-preserving for candidate call audio.
- **playwright-core** ^1.58.x: ATS DOM automation — already installed. Use with `channel: 'chrome'` to leverage user's browser and existing ATS sessions.

**Stack confidence:** HIGH for Node.js libraries (Twilio, Nodemailer, Playwright). MEDIUM for Python audio (untested on target hardware). LOW for Bland.ai (fast-moving voice AI space, verify pricing/availability).

### Expected Features

M2 has 18 table stakes features (any outreach tool must have these), 7 differentiators that set Samsara apart, and 9 explicit anti-features to avoid scope creep.

**Must have (table stakes):**

- SMS sending via API with delivery status tracking
- Email sending via API with deliverability monitoring
- Template variable substitution (`{{candidate_name}}`, `{{role}}`, etc.)
- Outreach sequence trigger on candidate approval
- Configurable timeout escalation (30 min default per vision doc)
- Opt-out/unsubscribe handling (legal requirement: CAN-SPAM, PECR, TCPA)
- Manual override/cancel (recruiter kill switch)
- Outreach activity log (audit trail)
- AI voice pre-screening call (core M2 differentiator)
- Call transcript generation (recruiters read, not listen)
- Pass/fail screening outcome with reasoning
- ATS field mapping (CV data → ATS schema)
- Recruiter call recording (privacy-sensitive, consent required)

**Should have (competitive differentiators):**

- Local-first orchestration (no cloud vendor lock-in for workflow data)
- Unified CV + transcript + screening in one record (no competitor does this natively)
- DOM bridge for ATS entry (sidesteps expensive API licenses)
- System audio recording (invisible, no "bot joined meeting" UX)
- Configurable screening scripts per role (use JD criteria from M1)
- Business hours awareness (time zone respect)
- Cost dashboard (real-time API usage tracking)

**Defer (explicit anti-features for M2):**

- Built-in email server/SMTP relay (use established providers)
- AI-generated personalized messages (recruiters want their own voice)
- Complex multi-branch workflow builder (linear sequence is sufficient)
- Calendar integration (defer to M3 Client Coordination)
- NLP-based SMS reply parsing (unreliable, flag any reply for recruiter)
- Multi-channel chatbot (WhatsApp, LinkedIn) (SMS + email only for MVP)
- ATS REST API integration (DOM bridge sidesteps license barriers)
- Candidate self-service portal (not needed for outreach-only workflow)

### Architecture Approach

The existing Electron IPC pattern extends cleanly for M2 with no fundamental changes. All new capabilities run in main process or Python sidecar, never in renderer. Polling-first architecture is critical: desktop apps cannot reliably receive webhooks (NAT, firewalls, no public URL). Poll Twilio/SendGrid for delivery status every 10-30 seconds. Poll voice providers for call status every 5 seconds during active calls.

**Major components:**

1. **Outreach Manager** (main process) — orchestrates sequences, manages timers, triggers SMS/email/call. Uses SQLite-backed state machine with event-driven transitions.
2. **Provider Abstractions** (main process) — smsProvider, emailProvider, voiceProvider, transcriptionProvider. Abstract vendor-specific APIs so providers are swappable. Critical for voice AI where lock-in is dangerous.
3. **Credential Storage** (main process) — Electron `safeStorage` API to encrypt/decrypt API keys using OS keychain (DPAPI on Windows, Keychain on macOS). Never expose decrypted keys to renderer.
4. **Audio Capture** (Python sidecar) — soundcard library for WASAPI loopback (Windows) and CoreAudio (macOS). Separate from CV parsing pipeline to avoid blocking.
5. **Transcription** (Python sidecar or cloud API) — faster-whisper for local privacy-preserving transcription. Cloud API (Deepgram, AssemblyAI) as opt-in for speed.
6. **ATS Bridge** (Chrome extension + WebSocket) — extension runs in user's authenticated ATS session, communicates with Electron via localhost WebSocket. Avoids bundled Chromium. Config-driven selectors per ATS vendor.
7. **State Machine** (main process) — 15+ states from `PENDING` → `SMS_SENT` → `AWAITING_REPLY` → `AI_CALLING` → `SCREENED` → `ATS_SUBMITTED`. Persisted to SQLite on every transition with timestamp for audit trail and crash recovery.

**Routing refactor:** Move from monolithic `ProjectView.tsx` to nested routes under `/project/:id/*` with a persistent wheel navigation. Each wheel section is a lazy-loaded route: `/cvs`, `/outreach`, `/calls`, `/ats`, `/settings`.

**New SQLite tables (migration v3):** `provider_credentials`, `message_templates`, `outreach_sequences`, `messages`, `call_records`, `transcripts`, `ats_field_mappings`, `ats_submissions`.

### Critical Pitfalls

The research identified 18 pitfalls (4 critical, 5 major, 6 moderate, 3 minor). The top 5 are deployment-blocking.

1. **SMS A2P Registration Kills Deliverability** — Unregistered numbers are silently filtered by UK carriers (60-90% drop rate). Prevention: UK alphanumeric sender ID registration (2-4 weeks), delivery status webhooks from day one, test on 3+ UK carriers (EE, Three, Vodafone) before launch. Phase 1 blocker.

2. **Recording Consent Failures Create ICO Liability** — UK PECR + GDPR require explicit consent before recording calls. Verbal consent alone is legally weak. Prevention: play unambiguous consent prompt before recording, log consent timestamp + audio snippet, implement withdrawal mechanism, encrypt recordings at rest with configurable retention (default 90 days). Phase 3 and Phase 5 critical.

3. **ATS DOM Automation Breaks Every 2-6 Weeks** — ATS vendors continuously deploy. Generated class names (`.css-1a2b3c`) and iframe nesting changes break selectors. Prevention: config-driven selector files per vendor (JSON, not hardcoded), health check before each automation run, visual confirmation step (screenshot pre-filled form before submit), "record mode" where recruiter teaches field mapping. Phase 7 ongoing maintenance.

4. **Webhook Callbacks Cannot Reach Desktop App** — Twilio, SendGrid, voice providers expect webhooks. Desktop apps behind NAT have no public URL. ngrok is unreliable in production. Prevention: polling-first architecture with 10-30 second intervals, optional lightweight cloud relay for users who want real-time updates, degraded mode when relay unavailable. Phase 1 architectural foundation.

5. **AI Voice Latency Stacking Creates 2-3 Second Pauses** — Candidates hang up thinking line is dead. Latency stacks across STT + LLM + TTS layers. Prevention: use integrated voice provider (Vapi, Retell, Bland.ai) that optimizes full pipeline, implement filler responses ("Mmhmm"), streaming TTS, hard 1.5-second latency budget, test on real UK mobile networks. Phase 3 quality gate.

**Additional major pitfalls:**

- **System Audio Capture Fails Silently** (Windows device selection, macOS requires BlackHole) — show audio level meter during recording, 3-second test capture before recording starts, explicit device selection UI. Phase 5.
- **State Machine Becomes Spaghetti** — 20+ states when accounting for failures, retries, manual overrides. Prevention: use XState for explicit state machine, persist every transition to SQLite, workflow dashboard showing all candidate states. Phase 2 foundation.
- **UK PECR Compliance for Electronic Marketing** — distinguish candidates with existing relationship (soft opt-in) vs sourced candidates (consent required), opt-out registry checked before every send, log legal basis per outreach. Phase 1 and Phase 2.

## Implications for Roadmap

Based on combined research, the recommended phase structure is infrastructure-first, then simple integrations, then complex/risky integrations. Avoid interleaving UI and backend work—lay all backend foundations before building outreach UI.

### Phase 1: Communication Infrastructure and Data Model

**Rationale:** SMS/email are the simplest external integrations (REST APIs, well-documented). Validates credential storage pattern, tests polling architecture, establishes opt-out registry. Must resolve webhook vs polling decision here—everything depends on it.

**Delivers:** Twilio SMS integration, Nodemailer email integration (SMTP universal), template engine with variable substitution, credential storage (safeStorage), opt-out/unsubscribe handling, message delivery status tracking, SQLite migration v3 with all new tables.

**Addresses:** Table stakes features (SMS, email, templates, opt-out, audit log). Differentiators (local-first data, cost tracking).

**Avoids:** Pitfall #1 (SMS registration), Pitfall #4 (webhook architecture), Pitfall #8 (PECR compliance opt-out registry), Pitfall #11 (email deliverability).

**Research flag:** Standard patterns. SMS and email integrations are well-documented. Skip phase-specific research unless encountering UK-specific sender registration blockers.

### Phase 2: Outreach Workflow Engine

**Rationale:** Ties Phase 1 together into automated sequences. State machine complexity must be solved before adding AI voice (which adds more states). Persistent timeout handling is critical for multi-day workflows.

**Delivers:** SQLite-backed state machine (XState recommended), outreach sequence orchestration, timer-based timeout escalation (30 min configurable), business hours queue, manual override (pause/cancel/retry), outreach dashboard UI (Kanban board per candidate stage), activity timeline per candidate.

**Uses:** Phase 1 SMS/email infrastructure. New nested routes under `/project/:id/outreach`.

**Implements:** State machine component, outreach scheduler, outreach store (Zustand).

**Avoids:** Pitfall #7 (state machine spaghetti), Pitfall #12 (persistent timeouts lost on restart), Pitfall #18 (business hours awareness).

**Research flag:** State machine architecture needs design review. XState is overkill vs simple switch/map tradeoff. Phase-specific research optional but recommended for state modeling.

### Phase 3: AI Voice Integration

**Rationale:** Riskiest integration. Fast-moving provider space. Latency and consent are deal-breakers. Build this after core workflow works so you can test end-to-end without blocking simpler features.

**Delivers:** Bland.ai REST API integration (or Vapi as alternative), call polling loop (5-second interval during active calls), configurable screening script editor (per role), call recording download and local encrypted storage, transcript retrieval and storage, pass/fail screening outcome with reasoning, consent prompt architecture (AI identifies itself + requests recording consent).

**Uses:** Workflow engine from Phase 2 to trigger AI calls on timeout. Credential storage from Phase 1 for Bland.ai API key.

**Implements:** voiceProvider abstraction (swappable), callPoller, callManager, call store, CallsSection route, CallRecordCard component, TranscriptViewer component.

**Avoids:** Pitfall #5 (latency stacking), Pitfall #2 (consent liability—AI call consent separate from recruiter call consent), Pitfall #15 (provider lock-in via abstraction layer).

**Research flag:** HIGH priority. Voice AI providers (Bland.ai, Vapi, Retell) need current pricing, API verification, latency testing. Fastest-moving area of M2 stack. Budget 3-5 days for phase-specific research before implementation.

### Phase 4: Samsara Wheel Navigation (UI Refactor)

**Rationale:** Can be built anytime but best before adding more UI sections. Unblocks outreach/calls/ATS UI by establishing routing structure. Independent of backend—pure React refactor.

**Delivers:** Nested routes under `/project/:id/*`, ProjectLayout component with wheel navigation, lazy-loaded route sections (CVSection, OutreachSection, CallsSection, ATSSection), Motion animations for wheel expand/rotate/pulse.

**Uses:** Motion library from stack. Existing Zustand stores adapt to routing.

**Implements:** Samsara Wheel component (radial or tab-based navigation—research suggests radial is confusing for linear workflows, but vision doc specifies radial).

**Avoids:** Pitfall #9 (Motion re-render cascades—isolate with React.memo, avoid layout prop on lists, profile before/after).

**Research flag:** Motion package name verification (motion vs framer-motion on npm). Radial navigation UX validation (research flagged this as anti-pattern for linear workflows, but it is a stated requirement—may need design discussion).

### Phase 5: Call Recording and Privacy

**Rationale:** Highest complexity and platform-specific risk (macOS requires BlackHole). Deferred until core workflow proven. Recruiter call recording is secondary to AI screening—can ship M2 without this if macOS blocks.

**Delivers:** Python sidecar extension with soundcard library, WASAPI loopback capture (Windows), CoreAudio capture (macOS with BlackHole guide), audio device selection UI, recording level meter (visual confirmation), 3-second test capture before recording starts, consent prompt before recording (separate from AI call consent), local encrypted storage (OGG/OPUS compression), configurable retention with auto-delete.

**Uses:** Python sidecar (extend, do not block CV parsing). Separate process or thread pool to avoid bottleneck.

**Implements:** Audio capture manager, recording UI, consent flow, retention scheduler.

**Avoids:** Pitfall #2 (consent liability—log timestamp, audio snippet, withdrawable), Pitfall #6 (silent capture failure—level meter, test capture), Pitfall #14 (sidecar bottleneck—separate process).

**Research flag:** MEDIUM-HIGH priority. Windows WASAPI loopback is proven but needs hardware testing (virtual devices, headset routing). macOS is risky—BlackHole user install friction may push this to post-M2. Phase-specific research: 2-3 days for Windows implementation, 1-2 days for macOS feasibility spike.

### Phase 6: Call Transcription

**Rationale:** Depends on Phase 5 recordings and Phase 3 AI call recordings. Two separate transcription paths: AI calls get transcript from provider (built-in), recruiter calls need local transcription (faster-whisper) or cloud API.

**Delivers:** faster-whisper integration (Python sidecar), Whisper tiny model bundled (~75MB), auto-download medium model on first use, cloud transcription API option (Deepgram/AssemblyAI as opt-in), transcript segments with timestamps, transcript-to-recording synchronization, transcript viewer UI with playback sync.

**Uses:** Call recordings from Phase 5 and Phase 3. Python sidecar extension.

**Implements:** transcriptionProvider abstraction (local vs cloud), transcription job queue, transcript store, TranscriptViewer enhancements.

**Avoids:** Pitfall #17 (timestamp drift—use single provider/pipeline or synchronized start marker).

**Research flag:** faster-whisper model bundling strategy. CTranslate2 compatibility and PyInstaller bundle size impact. Phase-specific research: 1-2 days for model download UX and bundle size optimization.

### Phase 7: ATS DOM Bridge

**Rationale:** Most complex and fragile integration. Requires Chrome extension (new project), WebSocket server, config-driven selectors, per-vendor testing. Deferred until all candidate data (CV + transcript + screening) is ready for ATS entry.

**Delivers:** Chrome extension with manifest + content scripts, WebSocket server in Electron main process, ATS field mapping editor UI (per vendor config), selector config files (Bullhorn, JobAdder, Vincere JSON), selector health check before automation, visual confirmation (screenshot pre-filled form), "record mode" (learn mapping from recruiter actions), ATS submission status tracking.

**Uses:** Playwright-core for local testing/development. Chrome extension for production use in user's authenticated session.

**Implements:** atsBridge (WebSocket server), fieldMapper, ATSSection route, FieldMappingEditor component, SubmissionPreview component, ATS submission store.

**Avoids:** Pitfall #3 (DOM fragility—config-driven selectors, health check, visual confirmation), Pitfall #13 (iframe blocking—test against real ATS trial accounts).

**Research flag:** HIGH priority. ATS vendor DOM structures unknown. Requires trial accounts for Bullhorn, JobAdder, Vincere. Selector strategy (data-testid > aria-label > name > id). Phase-specific research: 5-7 days for per-vendor selector mapping and iframe handling.

### Phase 8: Client Submission and Completion

**Rationale:** Final phase. Combines all M2 outputs (CV + transcript + screening + ATS entry) into client submission package. Uses existing M1 PDF generation and email from Phase 1.

**Delivers:** Package candidate submission (branded CV from M1 + front sheet with screening summary + transcript attachment), email to client via Nodemailer, submission tracking (sent, opened, replied), project completion workflow (candidate marked as submitted).

**Uses:** M1 branded export, Phase 1 email infrastructure, Phase 3 screening outcomes, Phase 6 transcripts.

**Implements:** Submission packager, client email templates, submission log.

**Avoids:** Pitfall #10 (scope creep into CRM—submission is terminal state, no ongoing relationship tracking).

**Research flag:** None. Uses existing patterns. Standard implementation.

### Phase Ordering Rationale

- **Phase 1 first:** Simplest external integrations validate credential storage, polling architecture, and opt-out registry. Everything depends on this foundation.
- **Phase 2 second:** State machine must be solved before adding more states (AI voice, recording). Timeout handling is critical for multi-day workflows.
- **Phase 3 before Phase 5:** AI voice is core differentiator but less complex than system audio (no OS-level drivers, provider handles heavy lifting). Learning from voice provider integration informs recording architecture.
- **Phase 4 anytime:** UI refactor is independent, but best before building outreach/calls/ATS UI to establish routing structure.
- **Phase 5 deferred:** Highest platform risk. macOS may not be feasible without BlackHole. Can ship M2 with AI screening only (no recruiter recording) if necessary.
- **Phase 6 after Phase 5:** Transcription depends on recordings. AI call transcripts are free (provider-included), recruiter call transcripts need local Whisper.
- **Phase 7 last backend:** ATS automation is most fragile and requires all candidate data ready. Benefits from learning in earlier phases.
- **Phase 8 final:** Glue phase combining all outputs. No new integrations.

### Research Flags

Phases needing deeper research during planning:

- **Phase 3 (AI Voice):** Voice AI provider landscape is fast-moving. Verify Bland.ai, Vapi, Retell current pricing, latency, API specifics. Confidence: LOW. Estimated research: 3-5 days.
- **Phase 5 (Recording):** Windows WASAPI and macOS CoreAudio platform-specific testing. BlackHole feasibility assessment. Confidence: MEDIUM-LOW. Estimated research: 2-3 days.
- **Phase 7 (ATS Bridge):** Per-vendor DOM structure reverse-engineering. Requires trial accounts. Confidence: LOW (no hands-on access). Estimated research: 5-7 days.

Phases with standard patterns (skip research-phase):

- **Phase 1 (SMS/Email):** Well-documented REST APIs. Twilio and Nodemailer have extensive documentation. Confidence: HIGH.
- **Phase 2 (Workflow):** State machine patterns are established (XState or simple switch/map). Confidence: HIGH.
- **Phase 4 (Wheel UI):** React routing and Motion animations are standard. Package name verification only. Confidence: HIGH.
- **Phase 8 (Submission):** Uses existing M1 PDF and Phase 1 email. No new patterns. Confidence: HIGH.

## Confidence Assessment

| Area                 | Confidence  | Notes                                                                                                                                                                                                                                                            |
| -------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack (Node.js)      | HIGH        | Twilio, Nodemailer, Playwright are stable, well-documented, already in ecosystem. Motion package name needs verification (motion vs framer-motion).                                                                                                              |
| Stack (Python audio) | MEDIUM      | soundcard wraps WASAPI/CoreAudio but untested on target hardware (virtual devices, headset routing). faster-whisper actively maintained as of early 2025 but CTranslate2 compatibility needs verification.                                                       |
| Stack (Voice AI)     | LOW         | Bland.ai, Vapi, Retell pricing and APIs change frequently. Research was based on training data (early 2025). Must verify before implementation.                                                                                                                  |
| Features             | MEDIUM      | Table stakes and differentiators are based on domain expertise in recruitment automation (Bullhorn Automation, Sense, Gem patterns). Confidence in compliance requirements (PECR, GDPR) is MEDIUM—needs current ICO guidance verification.                       |
| Architecture         | MEDIUM-HIGH | Polling-first vs webhook decision is sound for desktop constraints. State machine and provider abstraction patterns are proven. ATS bridge approach (Chrome extension + WebSocket) is standard but untested for target ATS vendors.                              |
| Pitfalls             | MEDIUM-HIGH | SMS deliverability, consent liability, DOM fragility, webhook constraints are well-known domain problems. Confidence in Windows audio is MEDIUM (proven but hardware-dependent). macOS audio is LOW (BlackHole requirement confirmed but user friction unknown). |

**Overall confidence:** MEDIUM

### Gaps to Address

Research was conducted without web search access. The following require validation during planning or implementation:

- **Voice AI providers (Bland.ai, Vapi, Retell):** Verify current pricing, latency claims, API availability, and company viability. Fast-moving space—assumptions may be outdated.
- **Motion package name:** Is it `motion` or `framer-motion` on npm? Run `npm info motion` before install.
- **UK PECR/GDPR compliance for recruitment:** Verify current ICO guidance on soft opt-in for recruitment SMS/email. Research assumed standard PECR interpretation but recruitment agencies have specific scrutiny.
- **ATS vendor DOM structures:** No hands-on access to Bullhorn, JobAdder, Vincere trial accounts. Selector strategy is sound but specific implementations need reverse-engineering.
- **macOS audio capture with BlackHole:** User install friction and setup reliability unknown. Consider Windows-only for MVP if macOS proves too complex.
- **ffmpeg bundling with PyInstaller:** Size impact on installer and subprocess vs ffmpeg-python library choice.
- **faster-whisper model bundling:** Bundle tiny model vs on-demand download for medium/large models. Installer size tradeoff.
- **10DLC SMS registration timelines (US):** If targeting US market later, budget 2-4 weeks for approval. UK alphanumeric sender ID is faster (days, not weeks).
- **Playwright `channel: 'chrome'` reliability:** Verify that user's Chrome installation is reliably detected on both Windows and macOS. Fallback if Chrome not found.

## Sources

### High Confidence (Project Codebase)

- `package.json` — Electron 40, React 19.2, Playwright ^1.58.0 already installed
- `src/main/index.ts`, `src/main/database.ts`, `src/renderer/App.tsx` — existing architecture patterns
- `.planning/milestones/02-automated-outreach/ROADMAP-DRAFT.md` — phase structure and requirements
- `.planning/vision/SAMSARA-VISION.md` — local-first architecture, UK recruitment target, 30-minute timeout requirement

### Medium Confidence (Training Data, Stable Libraries)

- Nodemailer documentation — extremely stable npm package, unlikely changed
- Twilio Node SDK documentation — industry standard, stable API
- Playwright documentation — `channel: 'chrome'` feature for using system browser
- XState documentation — state machine library patterns
- Electron `safeStorage` API — credential encryption using OS keychain
- UK PECR compliance — Privacy and Electronic Communications Regulations 2003, ICO guidance
- UK GDPR Article 6 lawful basis for recruitment contact
- WASAPI loopback capture — Windows audio API documentation
- faster-whisper — https://github.com/SYSTRAN/faster-whisper (CTranslate2-based Whisper acceleration)
- soundcard — https://github.com/bastibe/SoundCard (Python cross-platform audio capture)

### Low Confidence (Training Data, Fast-Moving Space—Verify Before Use)

- Bland.ai API and pricing — https://docs.bland.ai/ (may have changed since early 2025)
- Vapi API and pricing — https://docs.vapi.ai/ (may have improved or changed)
- Retell API and pricing — https://docs.retellai.com/ (may have improved or changed)
- Motion vs framer-motion package name — package transition status unclear, verify with `npm info`
- ATS vendor DOM structures (Bullhorn, JobAdder, Vincere) — no trial account access, needs reverse-engineering
- macOS BlackHole virtual audio device — user install friction and setup reliability unknown

---

_Research completed: 2026-01-31_
_Ready for roadmap: yes_
