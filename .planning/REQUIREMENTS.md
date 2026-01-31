# Requirements: Samsara M5 Yama

**Defined:** 2026-01-31
**Core Value:** Architecture as the Advantage — Zero Latency, Zero Egress, Zero Per-Seat Tax

## M5 Requirements

Requirements for the Yama conversational AI agent milestone. Each maps to roadmap phases.

### Chat Foundation

- [ ] **CHAT-01**: User can open/close a chat panel via keyboard shortcut and sidebar button
- [ ] **CHAT-02**: User sees streaming token-by-token responses from the agent
- [ ] **CHAT-03**: Agent is aware of the active project, loaded CVs, and loaded JDs without user specifying
- [ ] **CHAT-04**: Agent shows what tool it will execute and waits for user confirmation before destructive operations
- [ ] **CHAT-05**: When a tool call fails, agent explains the error and suggests a recovery action
- [ ] **CHAT-06**: Agent maintains conversation context within a session
- [ ] **CHAT-07**: Agent responses render markdown (tables, bold, code blocks)
- [ ] **CHAT-08**: User can cancel an in-progress response or pending tool call

### Agent Operations

- [ ] **OPS-01**: User can invoke any existing app operation via natural language ("match these CVs against the JD")
- [ ] **OPS-02**: Agent can chain multiple operations in sequence ("parse these CVs, then match, then rank")
- [ ] **OPS-03**: Agent summarizes tool execution results in natural language
- [ ] **OPS-04**: Agent iteratively refines JD matching based on recruiter feedback ("too many false positives on Java vs JavaScript")
- [ ] **OPS-05**: User can ask "why did this candidate score X?" and get a skill-by-skill explanation
- [ ] **OPS-06**: User can trigger batch operations via chat ("redact all CVs and export branded")
- [ ] **OPS-07**: User can request side-by-side candidate comparisons
- [ ] **OPS-08**: User can query dashboard status via natural language ("how many candidates pending?")

### Search & Sourcing

- [ ] **SRCH-01**: Agent generates boolean search strings from a JD
- [ ] **SRCH-02**: User can give feedback on boolean results ("too narrow") and agent refines with synonyms and alternative titles
- [ ] **SRCH-03**: Agent shows diff between boolean string versions

### Feedback & Learning

- [ ] **LRNG-01**: User can thumbs up/down any agent response
- [ ] **LRNG-02**: Agent stores preferred matching weights per role type across sessions
- [ ] **LRNG-03**: Agent stores boolean search patterns that led to successful outcomes
- [ ] **LRNG-04**: Agent avoids repeating suggestions the user consistently rejects

### Proxy Backend

- [ ] **PRXY-01**: LLM proxy authenticates users via subscription JWT
- [ ] **PRXY-02**: Proxy enforces per-user rate limits
- [ ] **PRXY-03**: Proxy strips candidate PII before forwarding to LLM provider
- [ ] **PRXY-04**: Proxy streams LLM responses back to the Electron app
- [ ] **PRXY-05**: Proxy integrates with Stripe for subscription billing
- [ ] **PRXY-06**: Proxy supports configurable LLM provider (Anthropic/OpenAI)

### Security

- [ ] **SEC-01**: API keys are stored in Electron main process only, never exposed to renderer
- [ ] **SEC-02**: Agent cannot execute destructive operations without explicit user confirmation
- [ ] **SEC-03**: PII classification layer prevents candidate personal data from reaching cloud LLM
- [ ] **SEC-04**: Agent has a maximum iteration cap to prevent infinite tool-use loops

## Future Requirements

Deferred to post-M5 milestone.

- **LRNG-05**: Opt-in anonymized feedback sync to central service for system-wide improvement
- **SRCH-04**: Cross-project intelligence — find candidates from other projects that fit current role
- **OPS-09**: Proactive suggestions based on accumulated feedback patterns
- **OPS-10**: Smart defaults from similar past projects
- **OPS-11**: Draft outreach messages from CV + JD context (depends on M2)

## Out of Scope

| Feature                                 | Reason                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| Voice agent / voice input               | Scope creep; poor UX for office environments. Voice belongs in M4 (call recording)     |
| Autonomous web browsing                 | ToS violations, security risk. Agent generates search plans, user executes             |
| Fine-tuning on user data                | Privacy nightmare, GDPR complications. Use RAG + prompt engineering instead            |
| Agent replacing the UI                  | Agent is accelerator layer, not replacement. Every action must also be possible via UI |
| Persistent memory of candidate opinions | Discrimination risk. Learn workflow preferences, not candidate biases                  |
| Agent-initiated actions without prompt  | Never act without being asked. No unsolicited notifications                            |
| Chat history search/analytics           | Defer. Log for debugging only                                                          |

## Traceability

| Requirement | Phase | Status  |
| ----------- | ----- | ------- |
| SEC-01      | 8     | Pending |
| SEC-02      | 8     | Pending |
| SEC-03      | 8     | Pending |
| SEC-04      | 8     | Pending |
| CHAT-01     | 9     | Pending |
| CHAT-02     | 9     | Pending |
| CHAT-03     | 9     | Pending |
| CHAT-04     | 9     | Pending |
| CHAT-05     | 9     | Pending |
| CHAT-06     | 9     | Pending |
| CHAT-07     | 9     | Pending |
| CHAT-08     | 9     | Pending |
| OPS-01      | 10    | Pending |
| OPS-02      | 10    | Pending |
| OPS-03      | 10    | Pending |
| OPS-04      | 10    | Pending |
| OPS-05      | 10    | Pending |
| OPS-06      | 10    | Pending |
| OPS-07      | 10    | Pending |
| OPS-08      | 10    | Pending |
| SRCH-01     | 11    | Pending |
| SRCH-02     | 11    | Pending |
| SRCH-03     | 11    | Pending |
| LRNG-01     | 12    | Pending |
| LRNG-02     | 12    | Pending |
| LRNG-03     | 12    | Pending |
| LRNG-04     | 12    | Pending |
| PRXY-01     | 13    | Pending |
| PRXY-02     | 13    | Pending |
| PRXY-03     | 13    | Pending |
| PRXY-04     | 13    | Pending |
| PRXY-05     | 13    | Pending |
| PRXY-06     | 13    | Pending |

**Coverage:**

- M5 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---

_Requirements defined: 2026-01-31_
_Last updated: 2026-01-31 after roadmap creation_
