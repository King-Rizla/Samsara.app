# Samsara

## What This Is

Samsara is a **Sovereign Recruitment Suite**. It is a local-first desktop application that replaces expensive, cloud-hosted SaaS tools (Parsing, Sourcing, Note Taking) with high-performance local automation. By utilizing the user's own CPU and existing access rights, it eliminates "seat taxes," cloud latency, and data privacy risks.

## Strategic Wedge

**The "Formatter" First.**

We attack the "Admin Bottleneck" (Category 1) first.

- **Problem:** Agencies pay $30k+ for DaXtra or ration AllSorted licenses, forcing manual "Shadow Workflows" where recruiters email CVs to admins.

- **Solution:** A $0-latency, drag-and-drop Desktop Formatter installed on _every_ recruiter's machine.

## Core Value

**Architecture as the Advantage.**

1. **Zero Latency:** Bulk process 100 CVs in seconds via local CPU (vs. minutes via Cloud Queue).

2. **Zero Egress:** Candidate data never leaves the laptop (GDPR/Defense compliant).

3. **Zero Per-Seat Tax:** We monetize the _Agency_, not the _User_, destroying the "Shadow License" economy.

## Current State

**Shipped:** v1 The Sovereign Formatter (2026-01-30, completed 2026-01-31)
**Codebase:** 25,501 LOC (14,596 TypeScript/CSS + 10,905 Python)
**Architecture:** Electron + React + Tailwind + Zustand | Python sidecar (PyInstaller) | SQLite (better-sqlite3)

**Capabilities delivered:**

- CV parsing (PDF/DOCX) with LLM-enhanced extraction (Ollama/Qwen 2.5)
- JD matching with skill variants, boolean search generation, and search tools
- Multi-project dashboard with drag-drop sidebar pinning and usage tracking
- PDF redaction, blind profiles, and branded export
- Quality gates: pre-commit hooks, unit tests, security audit

**Known tech debt:**

- LLM extraction ~50s per CV (needs optimization)
- JD prompt produces truncated booleans
- PDF parsing may fail on 30-40% of adversarial corpus
- macOS unsigned Python binary signing needed

## Context

- **Target Audience:** Mid-sized agencies (20-100 seats) trapped in "Shadow Workflows."

- **Architecture:** Electron + Local Python Sidecar + SQLite.

- **Business Model:** Agency-wide License (Ubiquitous Install) vs. Per-Seat SaaS.

## Constraints

- **Tech stack**: Electron + Python sidecar + SQLite — local-first architecture is non-negotiable
- **Performance**: < 2 seconds per resume processing on local CPU
- **Privacy**: Zero data egress — candidate data never leaves the machine

## Requirements

### Validated

- ✓ F-01c: <2s per CV processing — v1
- ✓ F-02a: Local Python extraction of contact fields — v1
- ✓ F-02b: Auto-redaction "Blackout" of contact details — v1
- ✓ F-02c: Blind Profile generation — v1
- ✓ F-03a: Split view editor — v1
- ✓ F-03b: Instant field fix — v1
- ✓ F-03c: Branding engine with theme.json — v1
- ✓ M-01a: Paste/upload Job Description — v1
- ✓ M-01b: Select CVs for JD matching — v1
- ✓ M-01c: Score CVs against JD — v1
- ✓ M-01d: Ranked CV results — v1
- ✓ M-01e: Highlighted matching skills — v1

### Active — M2: Automated Outreach

- [ ] NAV-01: Samsara Wheel navigation component with 5 sections + Yama hub
- [ ] NAV-02: Migrate M1 features into Candidate Search wheel section
- [ ] OUT-01: SMS/email automated outreach on candidate approval
- [ ] OUT-02: AI voice pre-screening (3-5 qualification questions)
- [ ] OUT-03: Outreach workflow engine (30 min timeout, reply handling)
- [ ] REC-01: System audio recording with toggle control
- [ ] REC-02: Call transcription for AI and recruiter calls
- [ ] ATS-01: ATS field mapping from CV + transcript data
- [ ] ATS-02: ATS DOM bridge (tested against mock ATS)
- [ ] SUB-01: Client submission (branded CV + front sheet + data)

### Out of Scope

| Feature                  | Reason                                                        |
| ------------------------ | ------------------------------------------------------------- |
| Cloud processing         | Core value is local-first; eliminates COGS and privacy risk   |
| Per-seat licensing       | Business model is agency-wide license                         |
| Bot-based call recording | Key decision: stealth via system audio capture                |
| Direct API integrations  | Key decision: DOM Bridge approach for universal compatibility |

## Key Decisions

| Decision                         | Rationale                                                                                               | Outcome   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- | --------- |
| **Formatter First**              | Highest friction point; easiest ROI to prove ("4 hours to 4 minutes").                                  | ✓ Final   |
| **Local Processing**             | Eliminates server COGS; enables "Zero Latency" bulk actions.                                            | ✓ Final   |
| **No Bots**                      | "Listeners" must record system audio, not join calls as a bot.                                          | ✓ Final   |
| **DOM Bridge**                   | Integration via browser DOM (Frontend) rather than expensive API (Backend).                             | ✓ Final   |
| **PyInstaller --onedir**         | Faster startup than --onefile for spaCy model loading.                                                  | ✓ Good    |
| **Qwen 2.5 7B default**          | Qwen3 breaks JSON with thinking tags. Reliable structured output.                                       | ✓ Good    |
| **Single unified LLM call**      | 1 API call vs 4 separate for cost + speed efficiency.                                                   | ✓ Good    |
| **ACK timeout pattern**          | Python sends ACK before extraction; timeout starts on ACK not submission.                               | ✓ Good    |
| **Phase 7 replaces test phases** | E2E tests fragile; comprehensive quality gates more effective.                                          | ✓ Good    |
| **Terminal dark mode only**      | Simpler theming, matches target audience aesthetic.                                                     | ✓ Good    |
| **Agent as power-user feature**  | Agent orchestrates existing IPC handlers; app works fully without it. Subscription tier for LLM access. | — Pending |
| **Agent local-first learning**   | Local feedback storage by default; opt-in anonymized sync in future milestone.                          | — Pending |
| **IPC handlers as tool defs**    | Keep IPC handlers granular and self-describing — they become agent tools in M5.                         | ✓ Good    |
| **Samsara Wheel navigation**     | Circular project-level nav (Bhavachakra-inspired) with 5 sections + Yama hub. Sections = milestones.    | ✓ Good    |
| **Framer Motion**                | Rich wheel animations for reasonable memory cost (~32kb); reusable across future milestones.            | ✓ Good    |
| **System audio capture**         | Record recruiter calls via system audio toggle, not bot. Reusable for BD/sales in future.               | ✓ Good    |

## Product Vision

Samsara automates the complete candidate recruitment flow from initial sourcing through interview scheduling. The full vision is documented in `.planning/vision/candidate-flow.md`.

### Milestone Roadmap

| Milestone                       | Scope                                                                                           | Status     |
| ------------------------------- | ----------------------------------------------------------------------------------------------- | ---------- |
| **M1: The Sovereign Formatter** | CV parsing, JD matching, branding, bulk processing                                              | Shipped v1 |
| **M2: Automated Outreach**      | Samsara Wheel nav, SMS/email, AI pre-screening, call recording, ATS integration                 | Active     |
| **M3: Client Coordination**     | Feedback portal, interview scheduling                                                           | Draft      |
| **M4: Intelligent Sourcing**    | Call transcription, boolean search, CV library connectors                                       | Draft      |
| **M5: Yama**                    | Conversational AI agent — iterative refinement, boolean search co-pilot, cross-session learning | Draft      |

### Candidate Flow Stages

1. **Initial Setup & Sourcing** (M4) - Call recording, criteria extraction, CV library search, de-duplication
2. **Candidate Outreach** (M2) - Automated contact, AI pre-screening, ATS data entry, branded CV submission
3. **Client Decision & Interview** (M3) - Feedback collection, interview scheduling, confirmations

### Milestone Drafts

Future milestone plans are in `.planning/milestones/`:

- `02-automated-outreach/ROADMAP-DRAFT.md`
- `03-client-coordination/ROADMAP-DRAFT.md`
- `04-intelligent-sourcing/ROADMAP-DRAFT.md`
- `05-yama/ROADMAP-DRAFT.md` — Conversational AI agent (6 phases, 33 requirements)

---

_Last updated: 2026-01-31 after v1 milestone completion and archive_
