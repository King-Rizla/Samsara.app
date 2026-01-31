# Domain Pitfalls: M2 Automated Outreach

**Domain:** Automated recruitment outreach, AI voice, audio capture, ATS DOM automation
**Researched:** 2026-01-31
**Context:** Adding to existing 25k LOC Electron + React + Python local-first app (Samsara)
**Primary market:** UK recruitment agencies

---

## Critical Pitfalls

Mistakes that cause legal liability, complete feature failure, or architectural rewrites.

---

### Pitfall 1: SMS A2P Registration Kills Deliverability Before You Ship

**What goes wrong:** You integrate Twilio, send SMS from an unregistered number, and carriers silently drop 60-90% of messages. In the UK, Ofcom-regulated networks increasingly filter unregistered Application-to-Person (A2P) traffic. US carriers require A2P 10DLC registration. Without registration, your outreach feature appears broken -- messages send successfully via API but never arrive.

**Why it happens:** Twilio/MessageBird APIs return `200 OK` and `status: sent` even when carriers will filter the message downstream. Developers test with their own phone (same carrier, allowlisted) and assume it works.

**Consequences:** Feature ships, recruiters use it, candidates never receive messages, recruiter blames the product. Impossible to debug without delivery receipts from multiple carriers.

**Prevention:**

1. Budget 2-4 weeks for UK sender registration (short code or alphanumeric sender ID)
2. Use alphanumeric sender IDs in the UK (e.g., "SamsaraRec") -- these are trusted by UK carriers and do not require short code approval
3. Implement delivery status webhooks from day one, not as an afterthought
4. Test with phones on at least 3 different UK carriers (EE, Three, Vodafone)
5. Set up a sender reputation monitoring dashboard before sending production messages
6. Rate limit to 1 SMS per second per number initially

**Warning signs:** High `sent` count but low `delivered` count in Twilio dashboard. Zero replies from candidates.

**Detection:** Compare API-reported delivery rate against expected response rate. If delivery > 90% but response < 1%, messages are being silently filtered.

**Severity:** CRITICAL
**Phase:** Phase 1 (Communication Infrastructure) -- must be resolved before any outreach sends.

---

### Pitfall 2: Recording Consent Failures Create Legal Liability (UK/PECR/GDPR)

**What goes wrong:** The app records calls without proper consent capture, or captures consent in a way that is not auditable. Under UK law (PECR + GDPR + Regulation of Investigatory Powers Act 2000), recording a phone call without consent from both parties is unlawful interception. UK recruitment is specifically scrutinized by ICO.

**Why it happens:** Developers assume "we told them at the start of the call" is sufficient. But consent must be: (a) specific and informed, (b) freely given, (c) auditable with timestamp, (d) withdrawable. Verbal consent alone is legally weak if disputed.

**Consequences:** ICO fines up to 4% of global turnover (GDPR). Individual complaints to ICO. Reputational destruction for the recruitment agency using Samsara. Recordings become inadmissible and must be deleted.

**Prevention:**

1. Before any recording starts, play an unambiguous consent statement: "This call will be recorded for recruitment purposes. Do you consent to being recorded? Please say yes or no."
2. Log consent with: timestamp, candidate ID, call ID, consent response (yes/no), audio snippet of consent moment
3. If candidate says no or is ambiguous, do NOT record. Continue call unrecorded.
4. Implement a consent withdrawal mechanism (candidate can request deletion later)
5. Store recordings encrypted at rest with retention policy (suggest 6 months default, configurable)
6. For AI-initiated calls: the AI MUST identify itself as automated AND request recording consent -- two separate disclosures
7. Create an audit log table: `consent_events(id, candidate_id, call_id, consent_type, response, timestamp, audio_ref)`

**Warning signs:** No consent column in your call records table. Consent captured as a boolean without timestamp or audio reference. Recording starts before consent prompt plays.

**Severity:** CRITICAL
**Phase:** Phase 5 (Call Recording & Privacy) -- but consent architecture must be designed in Phase 3 (AI Voice) since AI calls also need consent.

---

### Pitfall 3: ATS DOM Automation Breaks Every 2-6 Weeks

**What goes wrong:** You build selectors for Bullhorn/Vincere/JobAdder, ship it, and within weeks an ATS vendor pushes a UI update that changes class names, restructures the DOM, or migrates a component to a new framework. Your automation silently fills wrong fields or fails entirely.

**Why it happens:** ATS vendors deploy continuously. Their DOM is not a stable API -- class names are often generated (CSS-in-JS hashes like `.css-1a2b3c`), IDs change between releases, and iframes nest unpredictably. Unlike browser extensions for consumer sites, recruitment ATS interfaces are complex SPAs with React/Angular rendering.

**Consequences:** Candidate data entered into wrong ATS fields. Duplicate records created. Recruiter submits corrupted candidate profiles to clients. Trust in the tool destroyed.

**Prevention:**

1. NEVER rely on generated class names. Use this selector priority: `[data-testid]` > `[aria-label]` > `[name]` > `[id]` > semantic HTML structure > class names
2. Build a selector health-check that runs before each automation session: load the ATS page, verify all expected selectors resolve, abort with clear error if any fail
3. Implement a selector configuration layer that users can update without code changes (JSON config per ATS vendor + version)
4. Add visual confirmation step: after filling fields, screenshot the form and show the recruiter before submission
5. Version your selector configs: `bullhorn-selectors-v3.json` with date and ATS version tested against
6. Build a "record mode" where the recruiter manually fills one candidate and the app learns the field mapping from their actions
7. Consider targeting ATS REST APIs where available (Bullhorn has a REST API; DOM should be fallback, not primary)

**Warning signs:** Tests pass in development but fail on a recruiter's machine. Selectors that use more than 3 levels of nesting. Any selector containing a hash-like string.

**Severity:** CRITICAL
**Phase:** Phase 7 (ATS DOM Bridge) -- but the selector architecture decision (config-driven vs hardcoded) must be made in Phase 6 (ATS Field Mapping).

---

### Pitfall 4: Webhook Callbacks Cannot Reach a Desktop App

**What goes wrong:** Twilio, SendGrid, and voice providers use webhooks to report delivery status, inbound SMS replies, and call events. Webhooks require a publicly accessible HTTP endpoint. A desktop Electron app is not a web server -- it has no public URL. Developers hack around this with ngrok tunnels that break constantly.

**Why it happens:** The entire outreach provider ecosystem assumes your backend is a cloud server. Every tutorial shows webhook URLs pointing to `https://your-server.com/webhook`. Local-first architecture fundamentally conflicts with webhook-based integrations.

**Consequences:** No delivery confirmations. No inbound SMS replies detected. AI call status updates lost. The outreach workflow engine cannot advance state because it never receives events.

**Prevention:**

1. Accept that you need a lightweight relay service. Options ranked by preference:
   - **Polling-first approach:** Poll Twilio/SendGrid APIs for status updates every 10-30 seconds. Simpler, no server needed, but higher latency and API rate limits apply. Good enough for SMS delivery status and email opens.
   - **Lightweight cloud relay:** A minimal serverless function (Cloudflare Worker or AWS Lambda) that receives webhooks and pushes to the desktop app via WebSocket or SSE. ~50 lines of code, pennies per month.
   - **Provider-specific solutions:** Twilio has `statusCallback` but also allows polling via the Messages API. SendGrid has the Event Webhook but also the Email Activity API for polling.
2. For inbound SMS replies: Twilio requires a webhook. You MUST have either a relay or use Twilio's built-in Studio flows to auto-respond and queue messages for polling.
3. Do NOT use ngrok in production. It is unreliable, exposes a security surface, and the free tier rotates URLs.
4. Design the architecture so the app works in "degraded mode" without webhooks (polling fallback) but benefits from real-time updates when a relay is configured.

**Warning signs:** Architecture diagrams that show Twilio pointing directly at `localhost`. Any mention of ngrok in production config. No fallback for when the webhook endpoint is unreachable.

**Severity:** CRITICAL
**Phase:** Phase 1 (Communication Infrastructure) -- this architectural decision shapes everything downstream.

---

## Major Pitfalls

Mistakes that cause significant rework, poor user experience, or feature degradation.

---

### Pitfall 5: AI Voice Calls Feel Robotic Due to Latency Stacking

**What goes wrong:** The AI voice call has noticeable pauses (1-3 seconds) between candidate speech ending and AI response beginning. Candidates hang up, thinking the line is dead or they are talking to a badly programmed bot.

**Why it happens:** Latency stacks across multiple layers: (1) audio capture and streaming to provider, (2) speech-to-text processing, (3) LLM inference for response generation, (4) text-to-speech synthesis, (5) audio streaming back. Each layer adds 200-500ms. Total round-trip easily exceeds 2 seconds.

**Consequences:** Candidates hang up within 30 seconds. Pre-screening completion rate drops below 20%. Recruiters lose confidence in the feature and disable it.

**Prevention:**

1. Choose a voice AI provider that handles the full pipeline (Vapi, Retell, Bland.ai) rather than stitching together STT + LLM + TTS yourself. Integrated providers optimize the pipeline to sub-1-second response times.
2. Implement "filler" responses: the AI should say "Mmhmm" or "I see" while processing longer responses, mimicking natural conversation cadence
3. Use streaming TTS -- start speaking the response before it is fully generated
4. Set a hard latency budget: if response takes > 1.5 seconds, inject a bridge phrase ("Let me think about that...")
5. Test with real UK phone numbers on real mobile networks, not VoIP-to-VoIP in development
6. Handle interruptions (barge-in): if the candidate starts speaking while the AI is talking, the AI must stop immediately and listen. This requires the provider to support duplex audio.

**Warning signs:** Testing only with text transcripts, not actual voice calls. No latency monitoring. Provider does not support barge-in/interruption handling.

**Severity:** MAJOR
**Phase:** Phase 3 (AI Voice Integration)

---

### Pitfall 6: System Audio Capture Fails Silently on Windows

**What goes wrong:** The app attempts to capture system audio (for recording recruiter calls made via Teams/Zoom/phone), but gets silence, the wrong audio source, or permission errors that are not surfaced to the user.

**Why it happens:** Windows audio capture is complex:

- WASAPI loopback capture requires specifying the correct audio endpoint device
- If the recruiter uses a headset, the "default" device may not be the one carrying call audio
- Virtual audio devices (from Teams, Zoom) create additional routing confusion
- Multi-monitor setups with different audio outputs per display
- Windows privacy settings can block audio capture per-app
- Some audio drivers do not support loopback capture

**Consequences:** Recruiter completes a 30-minute call, checks the recording, finds silence or only their own microphone audio (no candidate voice). Recording is useless.

**Prevention:**

1. Show an audio level meter in the UI during recording so the recruiter can visually confirm capture is working
2. Before recording starts, run a 3-second test capture and verify non-silence (check RMS level > threshold)
3. Let the user explicitly select which audio device to capture (dropdown of available outputs), do not assume "default"
4. On Windows, use WASAPI loopback mode via the Python sidecar (e.g., `sounddevice` library with loopback flag). This captures what is being played through a specific output device.
5. Handle the case where the audio device changes mid-recording (headset unplugged) -- detect silence and alert the user
6. Store audio in a lossless format initially (WAV), compress to Opus/AAC after recording completes

**Warning signs:** No audio device selection UI. No recording level indicator. Testing only on the developer's machine with built-in speakers.

**Severity:** MAJOR
**Phase:** Phase 5 (Call Recording & Privacy)

---

### Pitfall 7: Outreach State Machine Becomes Unmaintainable Spaghetti

**What goes wrong:** The outreach workflow (send SMS -> wait for reply -> timeout -> AI call -> wait for result -> schedule or ATS entry) is implemented with scattered `if/else` chains, `setTimeout` calls, and database flags. Edge cases multiply: what if the candidate replies AFTER the AI call started? What if the SMS fails and the email also fails? What if the recruiter manually intervenes mid-workflow?

**Why it happens:** Developers underestimate workflow complexity. The happy path has 5 states. The real system has 20+ states when you account for failures, retries, manual overrides, timeouts, and concurrent operations (batch outreach to 50 candidates simultaneously).

**Consequences:** Candidates get double-contacted (AI calls them while they are replying to SMS). Workflows get stuck in liminal states with no way to recover. Debugging requires reading through interleaved logs for 50 candidates.

**Prevention:**

1. Use an explicit state machine library (e.g., XState for TypeScript). Define ALL states and ALL transitions upfront. If a transition is not defined, it cannot happen.
2. Minimum states for outreach: `PENDING -> SMS_SENT -> SMS_DELIVERED -> AWAITING_REPLY -> REPLY_RECEIVED -> SCHEDULING | TIMEOUT -> AI_CALL_INITIATED -> AI_CALL_COMPLETE -> SCREENING_PASSED | SCREENING_FAILED -> ATS_READY -> ATS_SUBMITTED -> SENT_TO_CLIENT`
3. Add failure states: `SMS_FAILED`, `EMAIL_FAILED`, `AI_CALL_FAILED`, `ATS_ENTRY_FAILED`
4. Add override states: `MANUALLY_PAUSED`, `MANUALLY_ADVANCED`, `MANUALLY_REJECTED`
5. Persist state machine state to SQLite on every transition with timestamp. This gives you full audit trail and crash recovery.
6. Implement a "workflow dashboard" showing all candidates and their current state. This is not optional -- recruiters need visibility.
7. Handle the "late reply" problem explicitly: if candidate replies after AI call has been initiated, define what happens (cancel AI call if possible, or flag for recruiter review).

**Warning signs:** Workflow logic spread across multiple files without a central state definition. Any use of raw `setTimeout` for workflow timeouts (use persistent scheduled jobs instead). No way to visualize current state of all candidates.

**Severity:** MAJOR
**Phase:** Phase 2 (Outreach Workflow Engine) -- the state machine must be designed here, not retrofitted.

---

### Pitfall 8: UK-Specific PECR Compliance for Electronic Marketing

**What goes wrong:** The app sends automated SMS/email to candidates without proper legal basis. Under PECR (Privacy and Electronic Communications Regulations 2003, amended), unsolicited electronic marketing to individuals requires prior consent OR a "soft opt-in" (existing relationship + relevant message + opt-out offered). Recruitment outreach to candidates who uploaded their CV to a job board is a grey area.

**Why it happens:** US-centric tutorials and documentation focus on CAN-SPAM/TCPA. UK recruitment has specific ICO guidance that developers miss. The "soft opt-in" exception has narrow conditions that recruitment cold outreach may not satisfy.

**Consequences:** ICO complaints from candidates. Fines. The recruitment agency (Samsara's customer) bears the legal risk, which makes them stop using the feature.

**Prevention:**

1. Distinguish between two candidate types in the data model:
   - **Candidates from the agency's own database** (applied previously, existing relationship) -- soft opt-in may apply if the message is relevant to similar roles
   - **Candidates from external sources** (scraped from job boards, sourced CVs) -- consent is required before electronic marketing
2. For all automated outreach, include: (a) agency name, (b) clear opt-out mechanism ("Reply STOP to opt out"), (c) reason for contact
3. Build an opt-out registry that is checked before EVERY send. Store opt-outs permanently (do not delete on candidate deletion).
4. Log the legal basis for each outreach (consent / soft opt-in / legitimate interest) with the candidate record
5. Add a "compliance check" step before batch outreach: show the recruiter which candidates have valid legal basis and which do not
6. Consider GDPR Article 6(1)(f) legitimate interest as the legal basis for recruitment contact, but document the balancing test

**Warning signs:** No legal basis field in the candidate data model. No opt-out mechanism. No distinction between sourced candidates and existing contacts.

**Severity:** MAJOR
**Phase:** Phase 1 (Communication Infrastructure) must include the opt-out registry. Phase 2 (Workflow Engine) must include legal basis checks.

---

### Pitfall 9: Framer Motion Re-Render Cascading Tanks Performance

**What goes wrong:** Adding Framer Motion to the existing React app (Samsara Wheel navigation) causes unexpected re-renders across the component tree. Animated components trigger layout recalculations that cascade to siblings and parents. The app, which handles 100+ candidate cards, becomes sluggish.

**Why it happens:** Framer Motion's `motion.*` components use React context and layout effects that can trigger parent re-renders. `AnimatePresence` wrapping list items forces reconciliation of all siblings when one item enters/exits. Layout animations (`layout` prop) are especially expensive because they measure DOM positions on every frame.

**Consequences:** UI jank when scrolling candidate lists. Wheel navigation feels heavy instead of fluid. Memory usage climbs as animation instances accumulate (especially with `AnimatePresence` not cleaning up properly).

**Prevention:**

1. Isolate animated components: wrap the Wheel navigation in `React.memo` boundaries so animations do not trigger re-renders in the candidate data area
2. NEVER use the `layout` prop on list items in a long list. Use `layoutId` only for shared element transitions between specific views.
3. For the Wheel component, use CSS transforms (via Framer Motion's `animate` prop with `x`, `y`, `rotate`) -- these are GPU-composited and do not trigger layout recalculation
4. Use `useReducedMotion()` hook to disable animations for users who prefer reduced motion (accessibility + performance fallback)
5. Profile with React DevTools Profiler before and after adding Framer Motion. Set a performance budget: no animation should add > 2ms to a render cycle.
6. Avoid `AnimatePresence` with `mode="wait"` on frequently changing content -- it blocks rendering while exit animations complete
7. Clean up animation subscriptions in `useEffect` cleanup functions to prevent memory leaks

**Warning signs:** Wrapping entire page layouts in `motion.div`. Using `layout` prop on more than 5 elements simultaneously. No `React.memo` boundaries between animated and data-heavy components.

**Severity:** MAJOR
**Phase:** Wherever the Samsara Wheel UI is built -- before outreach features are layered on top.

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or user friction.

---

### Pitfall 10: Outreach Feature Scope-Creeps Into a CRM

**What goes wrong:** The outreach system accumulates features: contact history, notes, tags, pipeline stages, activity timelines, reporting. Before anyone notices, you have rebuilt Bullhorn inside Samsara. The codebase doubles, maintenance burden explodes, and the app competes with dedicated CRMs that have 10-year head starts.

**Prevention:**

1. Define a hard scope boundary: Samsara handles the journey from "CV scored" to "submitted to ATS." It does NOT manage ongoing client relationships, placement tracking, or invoicing.
2. The candidate record in Samsara is ephemeral -- it exists for the duration of a project/role fill. It is NOT a permanent contact database.
3. If a feature request sounds like "track candidates across multiple roles over time," redirect it: "That data lives in the ATS. Samsara pushes to the ATS."
4. Put a "CRM boundary" label on feature requests that cross the line. Review quarterly.

**Warning signs:** Adding a "contacts" table separate from project-scoped candidates. Building search across historical candidates. Adding deal/placement tracking.

**Severity:** MODERATE
**Phase:** All phases -- enforce scope boundary continuously.

---

### Pitfall 11: Email Deliverability Destroyed by Shared IP / No Authentication

**What goes wrong:** Emails from Samsara land in spam. Recruiters do not notice because delivery status shows "sent." Candidates never see outreach emails.

**Prevention:**

1. Require the recruiter to use their own email domain (not `@gmail.com`) with proper DNS records: SPF, DKIM, DMARC
2. Provide a setup wizard that checks DNS configuration before allowing email outreach
3. Use the recruiter's own SMTP or a dedicated SendGrid subuser (not shared IP pool)
4. Start with low volume (10/day) and ramp up over 2-3 weeks to build sender reputation
5. Include plain text version alongside HTML. Avoid spam trigger words ("urgent opportunity," "act now")
6. Add one-click unsubscribe header (RFC 8058, required by Gmail/Yahoo as of Feb 2024)

**Warning signs:** Using a shared sending domain. No SPF/DKIM/DMARC setup wizard. No warm-up guidance for new senders.

**Severity:** MODERATE
**Phase:** Phase 1 (Communication Infrastructure)

---

### Pitfall 12: Persistent Timeouts Lost on App Restart

**What goes wrong:** The workflow engine schedules a "30-minute timeout then initiate AI call" using `setTimeout`. The recruiter closes and reopens Samsara. The timeout is gone. The candidate never gets called.

**Prevention:**

1. Store all scheduled events in SQLite with `scheduled_at` and `execute_at` timestamps
2. On app startup, query for overdue scheduled events and execute them immediately
3. Use a "tick" mechanism (setInterval every 30 seconds) that checks for due events, rather than individual setTimeout per candidate
4. This is the same problem as a job queue -- treat it as one from the start

**Warning signs:** Any use of `setTimeout` or `setInterval` for business logic timing. Timeouts that do not survive app restart.

**Severity:** MODERATE
**Phase:** Phase 2 (Outreach Workflow Engine)

---

### Pitfall 13: ATS iframe Sandboxing Blocks DOM Access

**What goes wrong:** Many ATS vendors (especially Bullhorn) render candidate forms inside iframes, often cross-origin. Your browser extension or automation script cannot access iframe content due to same-origin policy.

**Prevention:**

1. Test against actual ATS instances early (get trial accounts for Bullhorn, Vincere, JobAdder)
2. For browser extensions: use `content_scripts` with `all_frames: true` and `match_about_blank: true` in manifest
3. For cross-origin iframes: the extension must inject scripts into each frame separately
4. Consider using the `webRequest` API to intercept ATS API calls and inject data at the network level rather than DOM level
5. Document which ATS vendors use iframes and which do not -- this determines automation strategy per vendor

**Warning signs:** Only testing against a mock ATS page you built yourself. No trial accounts for target ATS vendors. Automation works on the main page but fails on form pages.

**Severity:** MODERATE
**Phase:** Phase 7 (ATS DOM Bridge)

---

### Pitfall 14: Python Sidecar Audio Processing Bottleneck

**What goes wrong:** The Python sidecar (already used for CV parsing) is tasked with audio capture, transcription, and processing. Long-running audio operations block the sidecar, causing CV processing to queue behind active recordings.

**Prevention:**

1. Separate audio concerns from CV parsing: either run a second Python process for audio, or handle audio capture in the Electron main process using native Node modules
2. If using the Python sidecar for audio, implement process pooling (multiple sidecar instances)
3. Audio transcription (Whisper or similar) is CPU-intensive -- offload to a dedicated thread/process, never block the main sidecar event loop
4. Consider using Electron's `desktopCapturer` API for audio capture (stays in Node.js land) and only send to Python for transcription

**Warning signs:** Single Python process handling both CV parsing and audio. No process pooling. Audio operations and CV operations sharing the same queue.

**Severity:** MODERATE
**Phase:** Phase 5 (Call Recording & Privacy)

---

### Pitfall 15: AI Voice Provider Lock-In and Cost Surprise

**What goes wrong:** You build tightly against one voice AI provider's API (e.g., Bland.ai), then discover their per-minute pricing makes 50 calls/day uneconomical, or they deprecate a feature, or quality degrades. Switching providers requires rewriting the integration.

**Prevention:**

1. Abstract the voice provider behind an interface: `VoiceProvider.initiateCall(script, candidate)` with provider-specific adapters
2. Budget voice costs early: at 50 calls/day x 5 minutes x 20 working days = 5000 minutes/month. At $0.07-0.12/min that is $350-600/month per recruiter.
3. Negotiate volume pricing before building. Get trial credits from 2-3 providers.
4. Build a cost tracking dashboard from day one -- recruiters need to see spend per project

**Warning signs:** Direct API calls to voice provider scattered across codebase (not behind an adapter). No cost estimation shown to recruiter before initiating batch calls. No provider abstraction layer.

**Severity:** MODERATE
**Phase:** Phase 3 (AI Voice Integration)

---

## Minor Pitfalls

Mistakes that cause annoyance or minor rework.

---

### Pitfall 16: Template Variable Injection Creates Garbled Messages

**What goes wrong:** Template variables like `{{candidate_name}}` are not properly validated. Missing data produces messages like "Hi {{candidate_name}}, we have an exciting role..." sent to actual candidates.

**Prevention:**

1. Validate all template variables are resolved before sending. If any `{{...}}` pattern remains, block the send.
2. Preview rendered messages in the UI before batch send.
3. Provide sensible fallbacks: `{{candidate_name|there}}` resolves to "there" if name is missing.

**Severity:** MINOR
**Phase:** Phase 1 (Communication Infrastructure)

---

### Pitfall 17: Call Transcript Timestamps Drift from Recording

**What goes wrong:** The transcript and recording are generated separately, and their timestamps do not align. Clicking a transcript segment plays the wrong part of the recording.

**Prevention:**

1. Use a single provider/pipeline that generates both recording and transcript with aligned timestamps
2. If using separate tools, synchronize via a shared start-time marker
3. Test alignment with calls > 10 minutes (drift compounds over time)

**Severity:** MINOR
**Phase:** Phase 3 / Phase 5

---

### Pitfall 18: Outreach Sent Outside Business Hours Annoys Candidates

**What goes wrong:** Automated SMS sent at 11pm or 6am. Candidates perceive the agency as unprofessional or spammy.

**Prevention:**

1. Enforce a sending window (default 8am-7pm candidate local time)
2. Queue messages that fall outside the window for next business day
3. Make the window configurable per project

**Severity:** MINOR
**Phase:** Phase 2 (Outreach Workflow Engine)

---

## Phase-Specific Warning Summary

| Phase                         | Likely Pitfalls                                                                                                                   | Severity | Key Mitigation                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| Phase 1: Comms Infrastructure | SMS A2P registration (#1), Email deliverability (#11), Webhook architecture (#4), Opt-out registry (#8), Template injection (#16) | CRITICAL | Register sender IDs early, design polling-first webhook fallback, build opt-out from day one   |
| Phase 2: Workflow Engine      | State machine spaghetti (#7), Persistent timeouts (#12), Business hours (#18)                                                     | MAJOR    | Use XState, persist all scheduled events to SQLite                                             |
| Phase 3: AI Voice             | Latency stacking (#5), Consent architecture (#2), Provider lock-in (#15)                                                          | MAJOR    | Choose integrated voice provider, design consent flow before implementation, abstract provider |
| Phase 4: Scheduling Bot       | Scope creep into CRM (#10)                                                                                                        | MODERATE | Hard scope boundary: Samsara is not a CRM                                                      |
| Phase 5: Recording & Privacy  | Consent liability (#2), Silent capture failure (#6), Sidecar bottleneck (#14)                                                     | CRITICAL | Audio level meter, device selection UI, separate audio process                                 |
| Phase 6: ATS Field Mapping    | Selector architecture decision (#3)                                                                                               | CRITICAL | Config-driven selectors, not hardcoded                                                         |
| Phase 7: ATS DOM Bridge       | DOM fragility (#3), iframe blocking (#13)                                                                                         | CRITICAL | Health-check before automation, test against real ATS instances                                |
| Phase 8: Client Submission    | Scope creep (#10)                                                                                                                 | MODERATE | Send to ATS/client and stop                                                                    |
| UI (Wheel)                    | Framer Motion perf (#9)                                                                                                           | MAJOR    | Isolate animations, profile before/after                                                       |

---

## Confidence Assessment

| Area                      | Confidence | Notes                                                                                                                            |
| ------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| SMS/Email deliverability  | HIGH       | Well-documented domain, A2P registration requirements are established                                                            |
| UK PECR/GDPR compliance   | MEDIUM     | Based on training data knowledge of ICO guidance; verify against current ICO recruitment-specific guidance before implementation |
| ATS DOM fragility         | HIGH       | Universal problem with web automation; specific ATS vendor DOM structures need hands-on testing with trial accounts              |
| Audio capture on Windows  | MEDIUM     | WASAPI loopback is documented but edge cases (virtual devices, driver quirks) require real-world testing                         |
| AI voice latency          | MEDIUM     | Provider landscape evolving rapidly; specific latency numbers should be verified with current provider trials                    |
| Webhook architecture      | HIGH       | Fundamental constraint of desktop apps; polling-first is well-established pattern                                                |
| Framer Motion performance | HIGH       | Known React performance patterns; layout animations and AnimatePresence are documented perf traps                                |
| State machine complexity  | HIGH       | Universal software engineering problem with well-known solutions (XState)                                                        |

---

_Researched: 2026-01-31_
_Confidence: MEDIUM-HIGH overall_
_Note: WebSearch was unavailable during this research. UK compliance items (Pitfalls #2, #8) should be verified against current ICO website before implementation. Voice AI provider comparisons (Pitfall #5, #15) should be verified with current pricing and feature sets._
