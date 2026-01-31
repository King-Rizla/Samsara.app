# Feature Landscape: Yama (M5 - AI Agent Layer)

**Domain:** Conversational AI agent / co-pilot for recruitment desktop app
**Researched:** 2026-01-31
**Confidence:** MEDIUM (based on established agent UX patterns from Cursor, Copilot, Claude Code; web search unavailable for latest recruitment-specific trends)

---

## Table Stakes

Features users expect from any chat-based agent in a productivity app. Missing = agent feels like a toy.

| Feature                                  | Why Expected                                                                                     | Complexity | Dependencies                       | Notes                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Natural language tool invocation         | Users type "match these CVs against the JD" and agent calls match-cvs-to-jd IPC                  | Med        | M1 IPC handlers                    | Core value prop. Agent must map intent to existing IPC calls                               |
| Streaming responses                      | Users see tokens appear progressively, not a loading spinner then wall of text                   | Low        | LLM provider streaming API         | Every modern chat UI streams. Cursor, Copilot, ChatGPT all do this                         |
| Context awareness (current project)      | Agent knows which project is active, what CVs/JDs are loaded                                     | Low        | Project state in renderer          | Without this, every message needs "in project X..."                                        |
| Tool execution confirmation              | Agent shows what it will do before doing it (e.g., "I will run JD matching on 15 CVs. Proceed?") | Low        | None                               | Cursor pattern: show plan, user approves. Critical for destructive ops (delete, overwrite) |
| Error handling with recovery suggestions | When tool call fails, agent explains why and suggests fix                                        | Low        | Existing error types               | "Matching failed because no JD is loaded. Would you like to upload one?"                   |
| Conversation history (within session)    | Agent remembers context within a chat session                                                    | Low        | In-memory state                    | Standard for any chat interface                                                            |
| Markdown rendering in responses          | Tables, code blocks, bold/italic in agent output                                                 | Low        | Markdown renderer (react-markdown) | Agent will return formatted match results, boolean strings, etc.                           |
| Cancel/stop generation                   | User can stop a long response or cancel a pending tool call                                      | Low        | AbortController pattern            | Standard UX. Cursor and Copilot both have stop buttons                                     |
| Multi-step task execution                | Agent chains operations: "Parse these 5 CVs, then match against JD, then rank"                   | High       | All M1 IPC handlers                | This is where agent value compounds. Must handle intermediate failures gracefully          |
| Result summarization                     | After tool execution, agent summarizes outcome in natural language                               | Low        | LLM post-processing                | "Matched 12 CVs. 3 scored above 80%. Top match: John Smith (92%)"                          |

---

## Differentiators

Features that set Yama apart from generic chat wrappers. Not expected, but create real recruiter value.

| Feature                       | Value Proposition                                                                                                          | Complexity | Dependencies                                   | Notes                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Iterative JD match refinement | Agent runs matching, recruiter says "too many false positives on Java vs JavaScript", agent adjusts criteria and re-runs   | High       | M1 JD matching, prompt storage                 | Key differentiator. Agent modifies the matching prompt/weights based on feedback, re-executes, shows delta between runs |
| Boolean search co-pilot       | Agent generates boolean strings, recruiter says "too narrow", agent widens with synonyms and alternative titles            | Med        | M4 boolean generator                           | Interactive refinement loop: generate, preview, feedback, regenerate. Show diff between versions                        |
| Proactive suggestions         | Agent notices patterns: "You have rejected 5 candidates with less than 3 years experience. Should I raise the minimum?"    | High       | Match history, feedback log                    | Requires tracking accept/reject patterns across candidates. High value but complex                                      |
| Batch operations via chat     | "Redact personal info from all CVs in this project and export as branded PDFs"                                             | Med        | M1 anonymization, export                       | Recruiter describes workflow in English, agent orchestrates multi-CV operations                                         |
| Explanation on demand         | "Why did this candidate score 45%?" with detailed skill-by-skill breakdown                                                 | Med        | M1 match results (already has skill breakdown) | Surface existing data conversationally. Low additional logic, high perceived value                                      |
| Cross-project intelligence    | "Find candidates from Project Alpha who might fit this role too"                                                           | High       | Multi-project data access                      | Recruiter gold: re-mining past candidate pools. Requires cross-project queries                                          |
| Candidate comparison          | "Compare top 3 candidates side by side"                                                                                    | Med        | M1 CV data, match results                      | Agent builds comparison table from structured data                                                                      |
| Smart defaults from history   | Agent pre-fills based on similar past projects: "This looks like a Senior Java role. Last time you used these criteria..." | High       | Cross-session persistence, project similarity  | Requires learning layer                                                                                                 |
| Draft outreach from CV + JD   | "Write an outreach message for this candidate highlighting their relevant experience"                                      | Low        | M1 CV data, M2 outreach templates              | LLM generation with structured context. Low complexity, high time savings                                               |
| Status dashboard queries      | "How many candidates are pending review?" "What is the pipeline status?"                                                   | Low        | M1 aggregate stats IPC                         | Natural language queries against existing data. Quick win                                                               |

---

## Anti-Features

Things to deliberately NOT build. Common mistakes in agent-powered recruitment tools.

| Anti-Feature                                  | Why Avoid                                                                                                                                       | What to Do Instead                                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Fully autonomous pipeline (no human approval) | Recruiters need control. Sending wrong candidate to client damages relationships. Regulatory risk (EU AI Act on automated employment decisions) | Always require confirmation for external-facing actions (outreach, client submission). Internal ops (parsing, matching) can be auto-approved |
| Agent replacing the UI                        | Agent should not become the only way to do things. Power users want direct manipulation too                                                     | Agent is an accelerator layer, not a replacement. Every agent action must also be possible via UI clicks                                     |
| Persistent memory of candidate opinions       | "Remember that I don't like candidates from Company X" creates discrimination risk. Storing subjective biases is legally dangerous              | Learn workflow preferences (matching weights, boolean patterns) not candidate/company biases. Explicit preference controls only              |
| Real-time voice agent in-app                  | Adding voice input/output to the desktop agent is scope creep and poor UX for office environments                                               | Text chat only for M5. Voice belongs in M2/M4 (call recording, AI screening) which are phone-based                                           |
| Autonomous web browsing/scraping              | Agent deciding to search LinkedIn on its own creates ToS violations, security risk                                                              | Agent generates boolean strings and search plans. User executes searches or M4 infrastructure handles it with proper rate limiting           |
| Complex multi-turn planning UI                | Showing agent "reasoning chains" with expandable tree views adds complexity without clear user value                                            | Simple chat with tool-use indicators. Show what the agent did, not how it thought. Cursor keeps it simple: message, action, result           |
| Fine-tuning on user data                      | Training/fine-tuning models on recruiter's candidate data creates privacy nightmares, model drift, GDPR complications                           | Use retrieval (RAG over project data) and prompt engineering. Preferences stored as structured config, not model weights                     |
| Chat history search/analytics                 | Building search over past conversations, analytics dashboards for agent usage                                                                   | Log conversations for debugging. Do not build user-facing analytics for M5. Measure adoption through simpler signals                         |
| Agent-initiated actions without prompt        | Agent popping up with "I noticed you uploaded CVs, want me to match them?"                                                                      | Never act without being asked. Suggestions are fine when user is already in chat. No unsolicited notifications                               |

---

## Feature Dependencies

```
M1 (The Sovereign Formatter) - BUILT
  |-- CV parsing IPC handlers -----> Agent tool: parse_cv
  |-- JD matching IPC handlers ----> Agent tool: match_jd
  |-- Project management IPC ------> Agent context: active project
  |-- Anonymization/branding ------> Agent tool: redact_cv, export_branded
  |-- Queue infrastructure --------> Agent tool: get_queue_status
  |-- Usage stats -----------------> Agent tool: get_usage

M2 (Automated Outreach) - FUTURE
  |-- Outreach templates ----------> Agent tool: draft_outreach
  |-- Communication infra ---------> Agent tool: send_message (with confirmation)

M3 (Client Coordination) - FUTURE
  |-- Client feedback data --------> Agent context: client preferences
  |-- Scheduling ------------------> Agent tool: schedule_interview

M4 (Intelligent Sourcing) - FUTURE
  |-- Boolean generator -----------> Agent tool: generate_boolean, refine_boolean
  |-- Call transcription ----------> Agent context: call insights
  |-- CV library connectors ------> Agent tool: search_candidates
  |-- De-duplication -------------> Agent tool: check_duplicates

Agent-specific (new for M5):
  - Chat panel UI component
  - Tool registry (maps agent intents to IPC calls)
  - Conversation state manager
  - Feedback persistence (SQLite tables for preferences)
  - LLM orchestration layer (tool-use protocol)
```

### Existing IPC Handlers Available as Agent Tools

From codebase inspection, the following M1 IPC handlers can be wrapped as agent tools immediately:

| IPC Handler           | Agent Tool Name  | Description                    |
| --------------------- | ---------------- | ------------------------------ |
| `get-all-cvs`         | `list_cvs`       | List CVs in project            |
| `get-cv`              | `get_cv_details` | Get parsed CV data             |
| `select-cv-file`      | `import_cv`      | Trigger CV file selection      |
| `delete-cv`           | `delete_cv`      | Remove CV (needs confirmation) |
| `get-all-jds`         | `list_jds`       | List job descriptions          |
| `get-jd`              | `get_jd_details` | Get JD data                    |
| `delete-jd`           | `delete_jd`      | Remove JD (needs confirmation) |
| `get-match-results`   | `get_matches`    | Get matching results for a JD  |
| `get-llm-settings`    | `get_settings`   | Check LLM configuration        |
| `get-project`         | `get_project`    | Get project details            |
| `get-aggregate-stats` | `get_stats`      | Dashboard statistics           |
| `get-queued-cvs`      | `get_queue`      | Queue status                   |
| `get-usage-stats`     | `get_usage`      | Token/cost usage               |
| `get-pinned-projects` | `get_pinned`     | Pinned projects list           |

---

## Chat UX Patterns (from established products)

Based on patterns from Cursor, GitHub Copilot Chat, Claude Code, Replit Agent:

### Panel Layout

- **Side panel** (right side, resizable) - not modal, not full-screen. Cursor and Copilot both use this. User sees app state alongside chat.
- **Collapsible** - agent is opt-in. App works fully without it open.
- **Context indicators** - show active project, loaded CVs/JDs at top of panel.
- **Keyboard shortcut** to toggle - Ctrl+L (Cursor) or Ctrl+I (Copilot). Pick one and be consistent.

### Interaction Patterns

- **Slash commands** for common actions: `/match`, `/boolean`, `/compare`, `/explain`, `/redact`, `/export`. Reduces ambiguity, enables autocomplete.
- **Tool-use indicators** - when agent calls a tool, show a collapsed block: "Called: Match JDs (15 CVs, 1 JD)" with expandable details.
- **Suggested actions** - after results, show clickable buttons: "Refine criteria" / "Export top 5" / "Compare top 3". Reduces typing for common follow-ups.
- **Inline references** - agent can reference specific candidates or JDs by name with clickable links that navigate the main UI.
- **@-mentions for context** - `@project:Alpha` or `@cv:JohnSmith` to scope queries. GitHub Copilot uses this pattern.

### Feedback Mechanisms

- **Thumbs up/down per response** - simplest signal. Cursor uses this.
- **"Not what I wanted" with correction** - user explains, agent adjusts. This is the iterative refinement loop.
- **Implicit feedback** - if user manually changes match weights after agent sets them, that is a correction signal worth capturing.

---

## Cross-Session Learning

What to persist between sessions (stored in SQLite, not in model):

| What to Learn                            | Storage                                                                | How Used                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Preferred matching weights per role type | `agent_preferences` table keyed by role category                       | Pre-fill when similar JD detected                                                |
| Boolean search patterns that worked      | `search_history` with outcome tracking (did recruiter use the result?) | Suggest proven patterns for similar roles                                        |
| Common slash commands per user           | Usage frequency log                                                    | Order suggestions by frequency                                                   |
| Rejected agent suggestions               | `agent_feedback` table                                                 | Avoid repeating suggestions user consistently rejects                            |
| Typical workflow sequences               | Action sequence log                                                    | Suggest next step proactively ("You usually export after matching. Export now?") |

**Architecture principle:** Store structured preferences, not conversation history. Preferences are queryable, auditable, and GDPR-safe. Conversation logs are for debugging only, auto-deleted after 30 days.

---

## MVP Recommendation

For M5 MVP, prioritize in this order:

### Phase 1: Foundation (must have)

1. **Chat panel with streaming** - table stakes UI foundation
2. **Tool registry mapping to existing M1 IPC handlers** - core agent value
3. **Context awareness** (active project, loaded CVs/JDs) - makes agent useful
4. **Tool execution confirmation UX** - safety for destructive operations
5. **Error handling with recovery** - prevents frustration

### Phase 2: Core Value (should have)

6. **Multi-step task execution** - "parse, match, and rank" in one command
7. **Slash commands for top operations** - `/match`, `/compare`, `/explain`, `/export`
8. **Iterative JD match refinement** - highest-value differentiator
9. **Explanation on demand** - "why did X score Y?" using existing match data
10. **Thumbs up/down feedback** - enables learning layer later

### Phase 3: Advanced (defer)

- **Boolean search co-pilot** - depends on M4 being built first
- **Cross-project intelligence** - requires significant query infrastructure
- **Proactive suggestions** - needs substantial feedback data accumulated first
- **Smart defaults from history** - needs cross-session learning layer
- **Draft outreach** - depends on M2 being built first

### Ordering Rationale

- Phase 1 creates a working agent that can invoke any existing feature
- Phase 2 makes it genuinely useful for the primary workflow (matching)
- Phase 3 features either depend on M2-M4 or require data that accumulates over time

---

## Confidence Assessment

| Finding                             | Confidence | Reason                                                                                  |
| ----------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| Chat panel UX patterns              | HIGH       | Well-established by Cursor, Copilot, Claude Code; consistent across products            |
| Tool-use agent architecture         | HIGH       | Standard pattern (OpenAI function calling, Anthropic tool use); well-documented         |
| IPC handler inventory as tool basis | HIGH       | Direct codebase inspection                                                              |
| Iterative refinement value          | MEDIUM     | Logical extension of established patterns; not verified in recruitment-specific tools   |
| Cross-session learning approach     | MEDIUM     | RAG + structured preferences is standard; recruitment-specific effectiveness unverified |
| Anti-features (bias/autonomy risks) | HIGH       | Well-documented in AI ethics literature and EU AI Act requirements                      |
| Boolean co-pilot pattern            | LOW        | Recruitment-specific; based on domain reasoning, not verified implementations           |

---

## Sources

- Cursor editor agent UX patterns (direct product experience)
- GitHub Copilot Chat interaction patterns (widely documented)
- Claude Code tool-use architecture (Anthropic agent pattern)
- OpenAI function calling / Anthropic tool use protocols (official documentation)
- EU AI Act provisions on automated decision-making in employment
- Samsara existing IPC handler inventory (codebase inspection: `src/main/index.ts`)
- Samsara milestone roadmaps M2-M4 (`.planning/milestones/`)
- Samsara candidate flow vision (`.planning/vision/candidate-flow.md`)

_Note: WebSearch was unavailable during this research session. Findings on recruitment-specific agent implementations are LOW confidence and based on domain reasoning rather than verified market analysis. Recommend validating boolean co-pilot and iterative refinement patterns against actual recruitment AI products (Hireflow, Fetcher, HireEZ) in a follow-up research pass._
