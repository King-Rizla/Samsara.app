# Technology Stack

**Project:** Samsara - Sovereign Recruitment Suite
**Researched:** 2026-01-31
**Research Mode:** Ecosystem (Stack Dimension) -- M5 Agent Additions
**Scope:** NEW additions only. Existing stack (Electron 40, React 19, TypeScript, Tailwind, Zustand, Python sidecar, better-sqlite3) is validated and unchanged.

---

## Executive Summary

M5 adds a conversational AI agent to the existing Samsara desktop app. This requires additions in four areas: (1) chat UI components for streaming markdown, (2) an LLM integration layer for tool-use/function-calling, (3) a cloud proxy backend for subscription-based LLM access, and (4) local storage for conversation history and learned preferences.

The recommended approach uses the **Vercel AI SDK** for the streaming/tool-use abstraction on the frontend, a lightweight **Hono + Cloudflare Workers** proxy backend, and extends the existing SQLite database for conversation storage. No new UI framework dependencies are needed -- Tailwind + Radix primitives handle the chat UI.

---

## Recommended Stack Additions

### 1. LLM Integration & Streaming (Frontend)

| Technology             | Version | Purpose                         | Confidence | Rationale                                                                                                                                                                                                              |
| ---------------------- | ------- | ------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ai (Vercel AI SDK)** | 4.x     | Streaming, tool-use abstraction | MEDIUM     | Provides `useChat` hook with built-in streaming, tool calling, and message management. Works with any LLM provider via adapters. Framework-agnostic core. Note: version based on training data, verify before install. |
| **@ai-sdk/react**      | latest  | React hooks for chat UI         | MEDIUM     | `useChat` and `useCompletion` hooks handle SSE streaming, message state, loading states. Eliminates boilerplate for streaming chat.                                                                                    |

**Why Vercel AI SDK over raw fetch/SSE:**

- Built-in streaming protocol (handles chunked responses, backpressure)
- Tool-use/function-calling abstraction maps cleanly to IPC handlers
- Message history management built-in
- Provider-agnostic: swap between OpenAI, Anthropic, local Ollama without code changes
- Active maintenance, large community

**Alternative considered: LangChain.js** -- Rejected. Too heavy, too many abstractions for what is fundamentally "send messages, call tools, stream responses." Vercel AI SDK is lighter and more focused.

**Alternative considered: Raw EventSource/fetch** -- Viable but means reimplementing streaming, tool-call parsing, retry logic. Not worth it when AI SDK handles it.

### 2. Chat UI Components (Frontend)

| Technology           | Version | Purpose                    | Confidence | Rationale                                                                                           |
| -------------------- | ------- | -------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| **react-markdown**   | 9.x     | Markdown rendering in chat | HIGH       | Standard for rendering LLM markdown output. Supports GFM, syntax highlighting plugins. Lightweight. |
| **remark-gfm**       | 4.x     | GitHub-flavored markdown   | HIGH       | Tables, strikethrough, task lists in LLM responses.                                                 |
| **rehype-highlight** | 7.x     | Code syntax highlighting   | HIGH       | Highlight code blocks in agent responses. Uses highlight.js under the hood.                         |

**What NOT to add:**

- **No chat UI component library** (e.g., chatscope, stream-chat-react). These are designed for multi-user messaging apps, not AI agent interfaces. Build the chat panel with existing Tailwind + Radix primitives. The UI is simple: message list + input box + streaming indicator.
- **No rich text editor** for the input. Plain textarea or contenteditable div is sufficient. Recruiters type natural language, not formatted documents.

### 3. Tool-Use / Agent Architecture (Frontend + Main Process)

| Technology | Version | Purpose                | Confidence | Rationale                                                                                      |
| ---------- | ------- | ---------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| **zod**    | 3.x     | Tool parameter schemas | HIGH       | Already implicit via AI SDK dependency. Define tool schemas that map to existing IPC handlers. |

**Architecture pattern:** The agent's "tools" are thin wrappers around existing `ipcRenderer.invoke` calls. No new IPC handlers needed for most operations.

```
Agent Tool Definition (renderer)
    |
    v
Vercel AI SDK tool-call handler
    |
    v
window.electronAPI.[existing method]  (preload bridge)
    |
    v
ipcMain.handle (existing handlers)
```

The ~30 existing IPC handlers (get-all-cvs, get-jd, run matching, etc.) become the agent's tool catalog. Each tool definition needs:

- A name matching the IPC channel
- A zod schema for parameters
- A description for the LLM

**No additional agent framework needed.** The Vercel AI SDK's `tools` parameter + existing IPC = complete agent loop.

### 4. LLM Proxy Backend (Server-Side)

| Technology                                  | Version | Purpose              | Confidence | Rationale                                                                                                                                                |
| ------------------------------------------- | ------- | -------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hono**                                    | 4.x     | HTTP framework       | MEDIUM     | Ultra-lightweight (14kb), runs on Cloudflare Workers, Vercel Edge, Node, Deno. Perfect for a proxy that adds auth + rate limiting + forwards to LLM API. |
| **Cloudflare Workers**                      | -       | Hosting              | MEDIUM     | Free tier: 100K requests/day. Edge deployment = low latency globally. KV for rate limiting state. D1 for user/subscription data.                         |
| **@ai-sdk/openai** or **@ai-sdk/anthropic** | latest  | LLM provider adapter | MEDIUM     | Server-side adapter for the actual LLM API call. Handles streaming response format.                                                                      |
| **Stripe**                                  | latest  | Subscription billing | HIGH       | Industry standard for SaaS billing. Webhooks for subscription status.                                                                                    |
| **better-auth** or **Lucia**                | latest  | Authentication       | LOW        | Lightweight auth for the proxy. Session-based. Verify current recommendations before choosing -- auth libraries churn fast.                              |

**Why Hono + Workers over Express/Next.js:**

- The proxy does three things: authenticate, rate-limit, forward. It does not need a full framework.
- Hono is purpose-built for edge runtimes.
- Cloudflare Workers pricing is usage-based (good for subscription SaaS).
- Built-in KV/D1 eliminates need for external database for simple state.

**Alternative considered: Supabase Edge Functions** -- Viable but ties you to Supabase ecosystem. Workers is more portable.

**Alternative considered: Self-hosted Express on VPS** -- More ops burden, no edge distribution. Only choose this if you need GPU-local inference.

### 5. Conversation History & Preferences (Local Storage)

| Technology                    | Version | Purpose              | Confidence | Rationale                                                                                                             |
| ----------------------------- | ------- | -------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| **better-sqlite3** (existing) | 12.6.x  | Conversation storage | HIGH       | Already in stack. Add tables for conversations, messages, tool calls, and user preferences. No new dependency needed. |

**New SQLite tables needed:**

```sql
-- Conversation sessions
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  title TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Individual messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  role TEXT CHECK(role IN ('user','assistant','system','tool')),
  content TEXT,
  tool_calls TEXT,       -- JSON array of tool invocations
  tool_results TEXT,     -- JSON array of tool results
  tokens_used INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Learned preferences (feedback across sessions)
CREATE TABLE agent_preferences (
  id TEXT PRIMARY KEY,
  category TEXT,         -- e.g., 'matching_style', 'output_format'
  key TEXT,
  value TEXT,            -- JSON
  confidence REAL,       -- 0.0 to 1.0, increases with repeated feedback
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**No vector database needed.** Preferences are key-value pairs with confidence scores, not embeddings. Conversation history is retrieved by conversation_id, not semantic search. Keep it simple.

---

## Full Addition Summary

### npm install (new dependencies)

```bash
# Core agent
npm install ai @ai-sdk/react react-markdown remark-gfm rehype-highlight

# Dev (types if needed)
# ai SDK includes its own types
```

**Total new dependencies: 5 packages.** Minimal footprint.

### Proxy backend (separate repo/directory)

```bash
# Initialize proxy project
npm init -y
npm install hono @ai-sdk/openai @ai-sdk/anthropic @hono/zod-validator zod stripe
npm install -D wrangler typescript @types/node

# Or with Anthropic as primary provider:
npm install hono @ai-sdk/anthropic @hono/zod-validator zod stripe
```

---

## What NOT to Add

| Technology                              | Why Avoid                                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LangChain.js**                        | Over-engineered for this use case. Adds massive dependency tree for abstractions you don't need. AI SDK's tool-calling is sufficient.                |
| **chatscope/stream-chat-react**         | Multi-user chat libraries. Wrong abstraction for single-user AI agent. Build with Tailwind.                                                          |
| **ChromaDB / Pinecone / any vector DB** | No semantic search needed. Preferences are structured key-value. Conversations retrieved by ID. SQLite is enough.                                    |
| **Socket.io / WebSocket library**       | SSE (Server-Sent Events) is sufficient for LLM streaming. AI SDK handles this. WebSockets add complexity for no benefit in unidirectional streaming. |
| **Redis**                               | For the proxy rate limiting, Cloudflare KV is sufficient. Only add Redis if self-hosting.                                                            |
| **Prisma / Drizzle (for proxy)**        | Cloudflare D1 with raw SQL or Hono's built-in D1 bindings is enough for user/subscription tables.                                                    |
| **NextAuth**                            | Designed for Next.js. Use a lighter auth solution for the Hono proxy.                                                                                |

---

## Integration Points with Existing Stack

### How Agent Connects to Existing App

| Existing Component | Agent Integration                                            | Change Required                       |
| ------------------ | ------------------------------------------------------------ | ------------------------------------- |
| IPC handlers (30+) | Exposed as agent tools via schema definitions                | None -- handlers stay as-is           |
| Preload bridge     | Agent calls same `window.electronAPI.*` methods              | May need to expose additional methods |
| Zustand stores     | Chat panel uses new `useChatStore` alongside existing stores | New store, no changes to existing     |
| SQLite database    | New tables added via migration                               | Migration script only                 |
| Python sidecar     | Agent triggers Python operations via existing IPC            | None                                  |
| React Router       | New `/chat` or sidebar panel route                           | Add route                             |
| Tailwind           | Chat UI styled with existing Tailwind config                 | None                                  |

### Streaming Architecture in Electron

```
[Renderer: Chat Panel]
    |
    | useChat() hook (AI SDK)
    |
    v
[Renderer: Proxy Client]
    |
    | fetch() with streaming (SSE)
    | Via Electron's net module or direct HTTPS
    |
    v
[Cloud: Hono Proxy on Workers]
    |
    | Auth check, rate limit, forward
    |
    v
[LLM Provider API: Anthropic/OpenAI]
    |
    | Streaming response (SSE)
    |
    v
[Back through proxy -> renderer -> UI update per token]
```

**Key consideration:** Electron's CSP may block direct fetch to external APIs from the renderer. Two options:

1. **Proxy through main process** -- renderer sends to main via IPC, main makes HTTPS request. Safer, more control.
2. **Direct from renderer** -- Configure CSP to allow the proxy domain. Simpler but less secure.

**Recommendation:** Proxy through main process for auth token security. Store the subscription API key in main process, never expose to renderer.

---

## Alternatives Considered

| Category             | Recommended                  | Alternative              | Why Not                                                                |
| -------------------- | ---------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| LLM SDK              | Vercel AI SDK                | LangChain.js             | LangChain too heavy, too many abstractions for proxy+tool-call pattern |
| LLM SDK              | Vercel AI SDK                | Raw fetch+SSE            | Works but reimplements streaming, tool parsing, retry logic            |
| Markdown             | react-markdown               | marked + DOMPurify       | react-markdown integrates better with React, handles XSS by default    |
| Proxy hosting        | Cloudflare Workers           | Vercel Edge / AWS Lambda | Workers has best free tier and built-in KV/D1                          |
| Proxy framework      | Hono                         | Express                  | Express too heavy for edge, Hono purpose-built for Workers             |
| Conversation storage | SQLite (existing)            | IndexedDB in renderer    | SQLite already in stack, accessed from main process, more reliable     |
| Preferences          | SQLite key-value             | Separate JSON files      | SQLite is transactional, queryable. JSON files risk corruption.        |
| Auth                 | TBD (verify before choosing) | Firebase Auth            | Firebase adds cloud dependency. Keep auth lightweight.                 |

---

## Confidence Assessment

| Area                                | Confidence | Notes                                                                                                                         |
| ----------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Chat UI (react-markdown + Tailwind) | HIGH       | Stable, well-known libraries. No version uncertainty.                                                                         |
| Vercel AI SDK                       | MEDIUM     | Confident in approach but version (4.x) unverified against current release. API may have changed. Verify before implementing. |
| Hono + Cloudflare Workers           | MEDIUM     | Architecture is sound. Specific Hono middleware for auth/rate-limiting needs verification at implementation time.             |
| SQLite for conversations            | HIGH       | Proven pattern, already in stack.                                                                                             |
| Tool-use via IPC mapping            | HIGH       | Architectural pattern, no library dependency. Just schema definitions.                                                        |
| Auth library choice                 | LOW        | Auth ecosystem churns rapidly. Research specific options at implementation time.                                              |
| Stripe integration                  | HIGH       | Stable API, well-documented.                                                                                                  |

---

## Open Questions for Phase-Specific Research

1. **Vercel AI SDK version:** Verify current stable version and confirm `useChat` + `tools` API shape before implementation.
2. **Electron CSP for streaming:** Test whether SSE from renderer to external proxy works with default Electron CSP, or if main-process proxying is required.
3. **Auth library:** Evaluate better-auth vs Lucia vs custom JWT at proxy implementation time. This space moves fast.
4. **LLM provider choice:** Anthropic Claude vs OpenAI GPT for tool-use quality. AI SDK supports both -- can A/B test. Anthropic's tool-use is generally stronger as of early 2025 training data.
5. **Token budget management:** How to handle conversation context windows. May need summarization strategy for long conversations.
6. **Offline fallback:** When proxy is unreachable, can agent fall back to local Ollama/Qwen for basic operations? AI SDK supports Ollama adapter.

---

## Sources

### High Confidence (verified from project)

- Existing IPC handlers: `src/main/index.ts` (~30 handlers verified)
- Existing dependencies: `package.json` (React 19, Electron 40, better-sqlite3 12.6.2, Zustand 5.x)

### Medium Confidence (training data, verify before use)

- Vercel AI SDK: https://sdk.vercel.ai/docs
- Hono framework: https://hono.dev/
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- react-markdown: https://github.com/remarkjs/react-markdown

### Low Confidence (needs verification at implementation time)

- Auth library recommendations (ecosystem churn)
- Exact Vercel AI SDK 4.x API surface
- Cloudflare D1 pricing for subscription data storage
