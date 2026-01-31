# Milestone 5: Yama — Conversational AI Agent (DRAFT)

## Overview

This milestone adds a conversational AI agent as a power-user feature. The agent orchestrates existing app operations through a chat interface, iteratively refines prompts and search strategies, and learns from recruiter feedback to improve over time.

**Prerequisite:** Milestones 1-4 complete (Formatter, Outreach, Coordination, Sourcing)

---

## Scope

| Capability             | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| Chat Panel             | Side-panel chat UI with streaming, markdown, context awareness           |
| Tool Invocation        | Natural language access to all app operations via existing IPC handlers  |
| Iterative Refinement   | Auto-improve JD matching and boolean searches through feedback loops     |
| Cross-Session Learning | Local preference storage — matching weights, search patterns, rejections |
| LLM Proxy Backend      | Subscription-based cloud proxy with auth, billing, PII scrubbing         |
| Security               | PII boundaries, tool confirmation, iteration caps, key isolation         |

---

## Requirements

33 requirements across 6 categories. Full specification: `.planning/REQUIREMENTS.md`

| Category            | Count | IDs         |
| ------------------- | ----- | ----------- |
| Chat Foundation     | 8     | CHAT-01..08 |
| Agent Operations    | 8     | OPS-01..08  |
| Search & Sourcing   | 3     | SRCH-01..03 |
| Feedback & Learning | 4     | LRNG-01..04 |
| Proxy Backend       | 6     | PRXY-01..06 |
| Security            | 4     | SEC-01..04  |

---

## Phases

Phase numbering is milestone-local (1-6). Will be assigned global numbers when milestone becomes active.

### Phase 1: Security Foundation & PII Boundary

**Goal**: Candidate data never reaches a cloud LLM without PII scrubbing, and the agent cannot take destructive action without consent
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04

**Success Criteria:**

1. API keys and LLM credentials exist only in the main process — renderer devtools cannot access them
2. A PII classification pass strips names, emails, phone numbers, and addresses from any text before it leaves the device
3. Tool confirmation dialog appears for any write/delete/export operation — agent blocks until user approves or rejects
4. Agent aborts with a clear message after hitting the iteration cap (no infinite loops)

---

### Phase 2: Chat UI & Agent Core

**Goal**: User can converse with a context-aware agent that streams responses, renders rich markdown, and can be cancelled mid-flight
**Depends on**: Phase 1 (security boundaries must exist before agent sends data to LLM)
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, CHAT-07, CHAT-08

**Success Criteria:**

1. User opens/closes the chat panel with a keyboard shortcut and a sidebar button — panel remembers open/close state
2. Agent responses appear token-by-token with visible streaming — not a loading spinner followed by a wall of text
3. Agent references the active project name, loaded CVs, and loaded JD in its first response without the user specifying them
4. Markdown renders correctly: tables, bold, inline code, and code blocks all display with proper formatting
5. User can click Cancel during a streaming response or pending tool confirmation and the agent stops cleanly

---

### Phase 3: Agent Tools & Operations

**Goal**: Every existing app operation is invocable via natural language, with chaining, batch support, and explanatory summaries
**Depends on**: Phase 2 (chat UI must exist for tool invocation UX)
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06, OPS-07, OPS-08

**Success Criteria:**

1. User says "match these CVs against the JD" and the agent executes the matching operation — result appears in both chat and the existing UI
2. User says "parse, match, and rank" and the agent chains three tools in sequence without user intervention between steps
3. After any tool execution, agent summarizes what happened in plain English (not raw JSON)
4. User asks "why did candidate X score 72?" and gets a skill-by-skill breakdown showing which skills matched, partially matched, or were missing
5. User triggers a batch operation via chat ("redact all and export") and sees queue progress in the existing bulk UI

---

### Phase 4: Boolean Search Co-Pilot

**Goal**: Agent generates, refines, and version-tracks boolean search strings from JD context
**Depends on**: Phase 3 (agent tool infrastructure needed)
**Requirements**: SRCH-01, SRCH-02, SRCH-03

**Success Criteria:**

1. User says "generate a boolean for this JD" and the agent produces a structured boolean search string using titles, skills, and synonyms from the loaded JD
2. User says "too narrow" and the agent produces a revised boolean with expanded synonyms and alternative titles
3. Agent shows a clear diff between the previous and revised boolean strings so the user can see exactly what changed

---

### Phase 5: Feedback & Learning

**Goal**: Agent remembers what works across sessions — preferred weights, successful patterns, and rejected suggestions
**Depends on**: Phase 3 (needs tool results to learn from), Phase 4 (needs boolean outcomes to store)
**Requirements**: LRNG-01, LRNG-02, LRNG-03, LRNG-04

**Success Criteria:**

1. User can thumbs-up or thumbs-down any agent response — feedback is visually acknowledged
2. When matching a "Senior Java Developer" role a second time, agent applies the matching weights the user preferred last time for that role type
3. Boolean patterns that led to successful sourcing outcomes appear as suggestions when generating booleans for similar roles
4. Agent does not repeat a suggestion the user has rejected three or more times

---

### Phase 6: LLM Proxy Backend

**Goal**: A production proxy service authenticates subscribers, enforces rate limits, scrubs PII server-side, and streams LLM responses to the Electron app
**Depends on**: Phase 1 (client-side PII layer exists as defense-in-depth), Phase 2 (streaming protocol established)
**Requirements**: PRXY-01, PRXY-02, PRXY-03, PRXY-04, PRXY-05, PRXY-06

**Success Criteria:**

1. Unauthenticated requests are rejected with a clear error — only valid subscription JWTs grant access
2. A user exceeding their rate limit receives a descriptive "slow down" message rather than a cryptic error
3. Proxy strips candidate PII from payloads before forwarding to the LLM provider — no names, emails, or phone numbers reach the external API
4. LLM responses stream token-by-token through the proxy to the Electron app with no buffering delay
5. User can subscribe via Stripe checkout and immediately use the agent without manual key entry

---

## Dependency Chain

```
Phase 1 (Security) → Phase 2 (Chat UI) → Phase 3 (Tools) → Phase 4 (Boolean)
                                                    ↘
                                                     Phase 5 (Learning)
Phase 1 (Security) → Phase 6 (Proxy — can parallel after Phase 2)
```

## Research

Research artifacts in `.planning/research/`:

- `STACK.md` — Stack additions (5 new npm packages, Hono + Cloudflare Workers proxy)
- `FEATURES-M5.md` — Feature landscape (table stakes, differentiators, anti-features)
- `ARCHITECTURE.md` — Integration architecture (AgentManager in main process)
- `PITFALLS-AGENT.md` — 13 pitfalls specific to adding agent to existing desktop app
- `SUMMARY-M5.md` — Synthesized findings

## Key Decisions

- Agent logic in Electron main process as AgentManager singleton (mirrors QueueManager)
- Tools call existing functions directly, not through IPC
- Streaming via webContents.send() (same pattern as queue-status-update)
- Conversations stored in same SQLite via migration
- Custom agent loop with Vercel AI SDK (not a framework like LangChain)
- Proxy: Hono + Cloudflare Workers + Stripe

---

_Draft created: 2026-01-31_
_Becomes active after M4 completion_
