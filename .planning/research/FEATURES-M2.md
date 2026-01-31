# Feature Landscape: Automated Recruitment Outreach

**Domain:** Automated candidate outreach, AI screening, ATS integration
**Project:** Samsara - Milestone 2 (Automated Outreach)
**Researched:** 2026-01-31
**Confidence:** MEDIUM (based on domain expertise; WebSearch unavailable for live verification)

---

## Table Stakes

Features recruiters expect from any outreach automation. Missing = product feels broken or unusable.

| Feature                              | Why Expected                                                                 | Complexity | M1 Dependency                                   | Notes                                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------- | ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **SMS sending via API**              | Every outreach tool sends SMS. Twilio is the de facto standard.              | Low        | Candidate phone from CV parsing                 | Twilio, MessageBird, Vonage all work. Twilio has best docs and reliability.                    |
| **Email sending via API**            | Parallel channel to SMS. Many candidates prefer email.                       | Low        | Candidate email from CV parsing                 | SendGrid or AWS SES. SMTP fallback for agencies with existing mail servers.                    |
| **Template variable substitution**   | `{{first_name}}`, `{{role}}`, `{{company}}` — every tool has this            | Low        | Parsed candidate fields                         | Simple Handlebars/Mustache style. No complex logic needed initially.                           |
| **Message delivery status tracking** | Recruiters need to know if SMS/email was delivered, bounced, failed          | Medium     | None                                            | Webhook-based. Twilio/SendGrid both provide delivery receipts.                                 |
| **Outreach sequence trigger**        | "Approve candidate" triggers outreach automatically                          | Medium     | Candidate status from M1 queue                  | Core workflow: status change fires sequence. Must be cancellable.                              |
| **Configurable timeout escalation**  | No reply in X minutes -> next action (AI call or manual flag)                | Medium     | None                                            | 30 min default per vision doc. Must handle business hours (don't call at 2am).                 |
| **Opt-out / unsubscribe handling**   | Legal requirement (CAN-SPAM, PECR, TCPA). Every SMS/email must have opt-out. | Medium     | None                                            | "Reply STOP" for SMS. Unsubscribe link for email. Must suppress opted-out candidates globally. |
| **Manual override / cancel**         | Recruiter must be able to pause or cancel any automated sequence             | Low        | None                                            | Kill switch per candidate and per project. Non-negotiable for recruiter trust.                 |
| **Outreach activity log**            | Complete history of what was sent, when, to whom, and outcome                | Medium     | None                                            | Audit trail. Required for compliance and recruiter visibility.                                 |
| **AI voice pre-screening call**      | The core differentiator of M2 flow — automated qualification call            | High       | Candidate phone, role criteria from JD matching | Bland.ai, Vapi, or Retell. See detailed analysis below.                                        |
| **Call transcript generation**       | Recruiters need to read what was said without listening to full audio        | Medium     | AI voice call recording                         | Most voice AI providers include transcription. Store locally.                                  |
| **Pass/fail screening outcome**      | Binary or tiered result from AI call with reasoning                          | Medium     | Screening script config                         | "Pass: confirmed 3+ years Java experience" vs "Fail: not available for 2 weeks"                |
| **ATS field mapping**                | Map parsed CV fields to ATS-required fields                                  | High       | All M1 parsed data                              | Each ATS has different schemas. Bullhorn, JobAdder, Vincere all differ significantly.          |
| **Recruiter call recording**         | Record the human recruiter's follow-up call                                  | High       | None (system audio capture)                     | Privacy-sensitive. Consent mechanism required. See compliance section.                         |

---

## Differentiators

Features that set Samsara apart from Bullhorn Automation, Herefish, Sense, Gem.

| Feature                                               | Value Proposition                                                                                   | Complexity | Notes                                                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Local-first outreach orchestration**                | All logic, templates, logs, recordings stored on-device. No cloud vendor lock-in for workflow data. | Medium     | Competitors are all cloud-SaaS. Agencies with data sovereignty concerns (EU, finance, gov) will value this.              |
| **Unified CV + transcript + screening in one record** | AI call transcript merged with parsed CV data before ATS entry. Recruiter sees complete picture.    | Medium     | No competitor does this natively. Bullhorn Automation sends to CRM; Samsara keeps it local and combined.                 |
| **DOM bridge for ATS entry**                          | Automate form filling in ATS web UIs without expensive API licenses                                 | Very High  | Bullhorn REST API costs money. JobAdder API requires partnership. DOM bridge sidesteps this entirely. Novel but fragile. |
| **System audio call recording**                       | Record any VoIP call (Teams, Zoom, phone) via system audio capture, not bot injection               | High       | No "bot joining meeting" UX. Invisible recording. But raises consent questions.                                          |
| **Configurable screening scripts per role**           | Recruiter defines 3-5 questions tailored to the role. AI adapts follow-ups.                         | Medium     | Beyond canned scripts. Use JD criteria from M1 to auto-suggest questions.                                                |
| **Business hours awareness**                          | Queue outreach for appropriate times. Respect time zones.                                           | Low        | Surprisingly few tools do this well. Sense and Gem have it; smaller tools don't.                                         |
| **Cost dashboard for API usage**                      | Show SMS/call/email costs in real-time. Agencies are cost-conscious.                                | Low        | Extends M1's token usage tracking. Twilio/SendGrid costs are per-message.                                                |
| **Offline queue with sync**                           | Queue outreach while offline, send when connection restored                                         | Medium     | Unique to local-first. Cloud tools assume always-online.                                                                 |

---

## Anti-Features

Things to deliberately NOT build in M2. Common mistakes in recruitment automation.

| Anti-Feature                              | Why Avoid                                                                                                                                                        | What to Do Instead                                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Built-in email server / SMTP relay**    | Deliverability nightmare. SPF/DKIM/DMARC setup is complex. Agencies get blocklisted.                                                                             | Use established providers (SendGrid, SES). They handle deliverability.                                                                       |
| **AI-generated personalized messages**    | LLM-written outreach feels robotic. Recruiters have their own voice. Templates with variables are better.                                                        | Provide good templates with variable substitution. Let recruiters write their own copy.                                                      |
| **Complex multi-branch workflow builder** | Visual workflow editors (like Bullhorn Automation's) are expensive to build and confusing to use. Agencies want simple sequences, not Zapier.                    | Linear sequence: SMS -> wait -> email -> wait -> AI call -> outcome. One path, configurable timeouts.                                        |
| **Calendar integration for scheduling**   | OAuth flows for Google/Outlook are fragile. Calendar conflicts, timezone math, rescheduling logic — massive scope.                                               | Defer to M3 (Client Coordination). For M2, AI call says "recruiter will call you back" and flags the candidate.                              |
| **NLP-based reply parsing**               | Understanding free-text SMS replies ("yeah mate im free tmrw arvo") is unreliable. False positives cause bad UX.                                                 | Treat any reply as "candidate engaged." Flag for recruiter. Don't try to parse intent from SMS.                                              |
| **Multi-channel chatbot**                 | WhatsApp, LinkedIn messaging, Facebook — each requires separate API approval, compliance, maintenance.                                                           | SMS + email only for M2. Add channels later based on demand.                                                                                 |
| **ATS API integration**                   | Bullhorn REST API requires paid partnership. JobAdder API has waitlists. API approach is expensive and slow to get approved.                                     | DOM bridge approach per vision doc. Fragile but free and immediate.                                                                          |
| **Candidate self-service portal**         | Web portal where candidates update their details. Requires hosting, auth, GDPR data subject access.                                                              | Not needed. Candidates interact via SMS/phone. Keep it simple.                                                                               |
| **A/B testing for templates**             | Statistically valid A/B testing requires large sample sizes agencies rarely have per role. Premature optimization.                                               | Let recruiters create multiple templates and pick per project. Track response rates for manual comparison.                                   |
| **Radial/wheel navigation UI**            | Novel but confusing. Radial menus work for quick-access toolbars (Blender, Maya) but fail for workflow navigation. Recruitment workflows are linear, not radial. | Use a linear pipeline/kanban view for candidate status progression. Each column = stage (approved, contacted, screening, passed, submitted). |

---

## Feature Dependencies on M1

```
M1 Features Required by M2:

  Parsed CV Data (Phase 2)
       |
       +---> Candidate name, email, phone --> SMS/Email outreach
       |
       +---> Skills, experience, education --> AI screening questions
       |
       +---> Structured fields --> ATS field mapping

  JD Matching (Phase 4)
       |
       +---> Role criteria --> Auto-generate screening script
       |
       +---> Match score --> Approval threshold for auto-outreach

  Project Organization (Phase 4.5)
       |
       +---> Project context --> Template variables (role, company, client)
       |
       +---> Candidate queue --> Outreach status tracking per candidate

  Queue Infrastructure (Phase 4.6)
       |
       +---> Status tracking --> "approved" status triggers outreach
       |
       +---> Retry/delete --> Cancel outreach, retry failed sends

  Branded Export (Phase 5, planned)
       |
       +---> Branded CV + front sheet --> Attach to ATS submission
```

---

## Compliance Requirements

### SMS Compliance

| Regulation             | Region | Requirement                                                                            | Implementation                                                                  |
| ---------------------- | ------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **TCPA**               | US     | Prior express consent for automated SMS. Written consent for marketing.                | Consent checkbox in candidate approval flow. Log consent timestamp.             |
| **PECR**               | UK     | Consent required for direct marketing. Soft opt-in allowed for existing relationships. | Recruitment contact is arguably "legitimate interest" but safer to get consent. |
| **CASL**               | Canada | Express or implied consent. Unsubscribe mechanism mandatory.                           | "Reply STOP to opt out" in every SMS.                                           |
| **10DLC Registration** | US     | Twilio requires 10DLC campaign registration for A2P SMS. $15/brand + $2/campaign.      | Must register before sending. Takes 1-4 weeks approval.                         |

### Email Compliance

| Regulation   | Requirement                                                      | Implementation                                                                  |
| ------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **CAN-SPAM** | Physical address, unsubscribe link, honest subject lines         | Footer template with agency address + unsub link                                |
| **GDPR**     | Lawful basis (legitimate interest or consent), data minimization | Log lawful basis per candidate. Don't send unnecessary personal data in emails. |
| **PECR**     | Similar to GDPR. Consent or soft opt-in.                         | Same as SMS consent mechanism.                                                  |

### Call Recording Compliance

| Regulation              | Region                                  | Requirement                                 | Implementation                                                                                                   |
| ----------------------- | --------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Two-party consent**   | UK, 12 US states (CA, FL, IL, etc.), EU | Both parties must consent to recording      | AI call: announce "this call is recorded" at start. Recruiter call: play consent prompt before recording begins. |
| **One-party consent**   | 38 US states, most of Australia         | Only one party needs to know                | Still announce recording — it's best practice and protects against legal gray areas.                             |
| **GDPR Article 6**      | EU/UK                                   | Lawful basis for processing voice data      | Legitimate interest for recruitment. Document in privacy policy. Retention limits.                               |
| **Data retention**      | UK ICO guidance                         | Don't keep recordings longer than necessary | Configurable retention (default 90 days). Auto-delete with audit log entry.                                      |
| **Data subject access** | GDPR                                    | Candidates can request their recordings     | Export mechanism for recordings + transcripts per candidate.                                                     |

**Recommendation:** Always announce recording regardless of jurisdiction. Simpler to implement one path than jurisdiction-based logic. Store recordings encrypted locally with configurable retention.

---

## AI Voice Screening: Provider Comparison

| Criterion                | Bland.ai              | Vapi                      | Retell            |
| ------------------------ | --------------------- | ------------------------- | ----------------- |
| **Pricing**              | ~$0.09/min            | ~$0.05/min + LLM costs    | ~$0.10/min        |
| **Latency**              | ~800ms                | ~500ms                    | ~600ms            |
| **Custom voice**         | Yes (cloning)         | Yes (ElevenLabs, etc.)    | Yes               |
| **Webhook integration**  | Good                  | Excellent                 | Good              |
| **Call recording**       | Built-in              | Built-in                  | Built-in          |
| **Transcript**           | Built-in              | Built-in                  | Built-in          |
| **Outbound calling**     | Yes                   | Yes                       | Yes               |
| **Local number support** | US, UK, AU            | US, UK, more              | US, UK            |
| **Best for**             | Simple scripted calls | Complex conversational AI | Low-latency needs |

**Recommendation:** Vapi. Best balance of cost, flexibility, and developer experience. Webhook-first architecture fits Samsara's local-first model — Samsara sends call request, Vapi calls back with results. Bland.ai is simpler but less flexible. Retell is good but more expensive.

**Confidence:** MEDIUM. Based on domain knowledge as of early 2025. Pricing and features change frequently. Verify before implementation.

### Standard Screening Questions

Typical 3-5 question pre-screening call:

1. **Availability** — "Are you currently available for new opportunities?" / "When could you start?"
2. **Role confirmation** — "We have a [role] position at [salary range]. Is this something you'd be interested in?"
3. **Key requirement** — "Do you have experience with [critical skill from JD]?" (e.g., "Do you have at least 3 years of Java experience?")
4. **Location/remote** — "This role is [location/remote/hybrid]. Does that work for you?"
5. **Salary expectations** — "What are your salary expectations?" (open-ended, captured in transcript)

**Pass criteria:** Affirmative on Q1-Q4. Q5 captured but not auto-judged.
**Fail criteria:** Negative on Q1 (not available) or Q2 (not interested). Others flag for recruiter review.

---

## Outreach Workflow Pattern

The standard pattern across Bullhorn Automation, Herefish, Sense:

```
Recruiter approves candidate(s)
         |
         v
    [Send SMS]  -----> Delivered?
         |                |
         |           No: [Send Email as fallback]
         |                |
         v                v
    [Wait: 30 min timeout]
         |
    +----+----+
    |         |
    v         v
 [Reply     [No Reply]
  received]      |
    |            v
    v       [Initiate AI screening call]
 [Flag for       |
  recruiter:     +----+----+
  "candidate     |         |
  engaged"]   [Pass]    [Fail]
                 |         |
                 v         v
           [Flag:      [Log reason.
            "recruiter  Archive
            call back   candidate.]
            needed"]
                 |
                 v
           [Recruiter calls candidate]
                 |
                 v
           [Call recorded + transcribed]
                 |
                 v
           [CV + transcript + screening
            result combined]
                 |
                 v
           [Map to ATS fields]
                 |
                 v
           [DOM bridge: enter into ATS]
                 |
                 v
           [Attach branded CV + front sheet]
                 |
                 v
           [Submit to client]
```

**Key UX pattern:** Kanban board with columns per stage. Candidates move left-to-right. Click candidate to see full timeline (messages sent, call recording, transcript, screening result). Bulk actions on column (approve all, retry failed, cancel pending).

---

## Template Management

### Standard Variables

| Variable              | Source         | Example                      |
| --------------------- | -------------- | ---------------------------- |
| `{{first_name}}`      | CV parsing     | "Sarah"                      |
| `{{full_name}}`       | CV parsing     | "Sarah Johnson"              |
| `{{role_title}}`      | Project/JD     | "Senior Java Developer"      |
| `{{company_name}}`    | Project config | "Acme Corp"                  |
| `{{salary_range}}`    | Project config | "80-100k"                    |
| `{{recruiter_name}}`  | App settings   | "Tom at Samsara Recruitment" |
| `{{recruiter_phone}}` | App settings   | "+44 7xxx xxx xxx"           |
| `{{opt_out}}`         | System         | "Reply STOP to opt out"      |

### Template Types Needed

1. **Initial SMS** — Short, personal, includes role and opt-out
2. **Initial email** — Longer, includes role details, agency branding, unsubscribe
3. **Follow-up SMS** — Gentle nudge if no reply (before AI call)
4. **AI call intro script** — What the AI says when candidate picks up
5. **Post-screening SMS** — "Thanks for your time, recruiter will be in touch"
6. **Rejection SMS** — Professional decline (if screening fails)

---

## ATS Integration: DOM Bridge Pattern

### How It Works

1. Recruiter has ATS open in browser (Bullhorn, JobAdder, Vincere)
2. Samsara launches a browser extension or uses desktop automation (Playwright/Puppeteer)
3. Extension receives structured candidate data from Samsara via local HTTP or native messaging
4. Extension fills form fields using CSS selectors mapped to ATS field names
5. Recruiter reviews pre-filled form and clicks submit

### DOM Bridge vs API vs RPA

| Approach                     | Pros                                         | Cons                                                                     | Cost             |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ | ---------------- |
| **DOM Bridge (extension)**   | Free, immediate, works with any web ATS      | Fragile (ATS DOM changes break it), maintenance burden                   | Free             |
| **ATS REST API**             | Reliable, official, versioned                | Expensive (Bullhorn charges), requires partnership approval, rate limits | $$$              |
| **RPA (desktop automation)** | Works with any desktop app, visual scripting | Slow, brittle, requires screen resolution consistency                    | $$ (UiPath/etc.) |

**Recommendation:** DOM bridge via Chrome extension. It's the vision doc's stated approach. Use data attributes and ARIA labels as selectors where possible (more stable than class names). Maintain selector configs per ATS vendor as JSON files that can be community-updated.

### Priority ATS Vendors

1. **Bullhorn** — Largest market share in UK/AU recruitment agencies
2. **JobAdder** — Strong in AU/NZ market
3. **Vincere** — Growing in UK mid-market (Samsara's target)

---

## MVP Feature Set for M2

### Phase 1: Communication Infrastructure

- Twilio SMS integration (send, receive webhooks, delivery status)
- SendGrid email integration (send, delivery status, open tracking)
- Template editor with variable substitution
- Opt-out management (STOP handling, unsubscribe)
- Message history per candidate

### Phase 2: Outreach Workflow

- "Approved" status triggers outreach sequence
- Configurable timeout (default 30 min)
- Reply detection (any reply = flag for recruiter)
- Business hours queue
- Manual override (pause, cancel, retry)
- Kanban board for candidate pipeline status

### Phase 3: AI Voice Screening

- Vapi integration for outbound calls
- Configurable screening script (3-5 questions)
- Auto-trigger after timeout with no reply
- Call recording + transcript stored locally
- Pass/fail/review outcome with reasoning
- Consent announcement at call start

### Phase 4: Recruiter Call Recording

- System audio capture for VoIP calls
- Consent prompt before recording
- Local encrypted storage
- Configurable retention with auto-delete
- Transcript generation (Whisper or provider API)

### Phase 5: ATS Integration

- ATS field mapping editor (per vendor)
- Combined record: CV + transcript + screening
- Chrome extension for DOM bridge
- Bullhorn selector config (first vendor)
- Pre-fill preview before submission

### Defer to Post-M2

- Calendar integration / scheduling bot (M3)
- Additional ATS vendors beyond Bullhorn
- WhatsApp / LinkedIn messaging channels
- A/B template testing
- NLP reply intent parsing
- Candidate self-service

---

## Quality Gates Checklist

- [x] Categories clear (table stakes vs differentiators vs anti-features)
- [x] Complexity noted for each feature
- [x] Dependencies on M1 features identified
- [x] Compliance requirements for SMS/email/recording covered
- [x] Provider comparison for AI voice
- [x] Workflow pattern documented
- [x] Template management specified
- [x] ATS integration approach analyzed

---

## Sources

### Medium Confidence (Domain Knowledge)

- Twilio SMS API patterns, pricing, 10DLC requirements
- SendGrid email delivery and webhook patterns
- Vapi/Bland.ai/Retell voice AI capabilities (as of early 2025)
- TCPA, CAN-SPAM, PECR, GDPR compliance requirements
- Bullhorn, JobAdder, Vincere market positioning
- Recruitment outreach patterns from Bullhorn Automation, Herefish, Sense, Gem

### Low Confidence (Needs Verification Before Implementation)

- Exact current pricing for voice AI providers (changes frequently)
- Specific DOM selectors for ATS vendors (must be reverse-engineered)
- 10DLC registration timelines and current fees
- Vapi webhook API specifics (verify with Context7/docs at implementation time)

### Not Verified (WebSearch Unavailable)

- Current market share data for ATS vendors
- Latest feature updates from Sense, Gem, Herefish
- Radial UI case studies (recommendation based on general UX knowledge)
