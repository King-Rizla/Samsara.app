# Architecture Patterns: Yama Conversational Agent (M5)

**Domain:** Conversational AI agent integration in existing Electron + React + Python sidecar app
**Researched:** 2026-01-31
**Overall confidence:** HIGH (based on direct codebase analysis of all main process modules)

---

## Executive Summary

The Yama agent should live in the **Electron main process** as a new `AgentManager` singleton, mirroring the existing `QueueManager` pattern. It calls existing database and Python functions directly (no IPC round-trips for tool execution), streams responses to the renderer via `webContents.send()`, and stores conversations in the same SQLite database using the established migration pattern. The renderer gets a Zustand store and chat panel component. When disabled, zero code paths execute.

---

## Recommended Architecture

```
+-------------------------------------------------------------------+
|                        RENDERER (React)                            |
|                                                                    |
|  +------------------+     +-------------------+                    |
|  | Existing UI      |     | ChatPanel (NEW)   |                    |
|  | (projects, CVs,  |     | - message list    |                    |
|  |  JDs, matching)  |     | - input box       |                    |
|  |                  |     | - tool call cards  |                    |
|  +------------------+     +-------------------+                    |
|         |                        |                                 |
|   existing stores          agentStore (NEW)                        |
|         |                        |                                 |
+---------|------------------------|---------------------------------+
          | ipcRenderer.invoke     | ipcRenderer.invoke('agent-chat')
          | (existing handlers)    | ipcRenderer.on('agent-stream')
          |                        |
+---------|------------------------|---------------------------------+
|         v                        v           MAIN PROCESS          |
|  +------------------+     +-------------------+                    |
|  | Existing IPC     |     | Agent IPC (NEW)   |                    |
|  | handlers (30+)   |     | 5 new handlers    |                    |
|  +------------------+     +-------------------+                    |
|         |                        |                                 |
|  +------------------+     +-------------------+                    |
|  | database.ts      |<----| AgentManager (NEW)|                    |
|  | pythonManager.ts  |<----|  - agent loop     |                    |
|  | queueManager.ts   |     |  - LLM client     |                    |
|  | settings.ts       |     |  - tool dispatch   |                    |
|  +------------------+     +-------------------+                    |
|                                   |                                |
|                                   | fetch() with streaming         |
+-----------------------------------|--------------------------------+
                                    |
                                    v
                          +-------------------+
                          | Cloud LLM API     |
                          | (OpenAI / proxy)  |
                          +-------------------+
```

### Component Boundaries

| Component          | File                                | Responsibility                                                                    | New/Modified          |
| ------------------ | ----------------------------------- | --------------------------------------------------------------------------------- | --------------------- |
| `AgentManager`     | `src/main/agentManager.ts`          | Agent loop orchestration, LLM streaming client, tool dispatch, conversation state | **NEW**               |
| `agentTools.ts`    | `src/main/agentTools.ts`            | Tool definitions wrapping existing database/Python functions as callable tools    | **NEW**               |
| Agent DB functions | `src/main/database.ts`              | Conversation + message + feedback tables, migration v5                            | **MODIFIED** (append) |
| Agent IPC handlers | `src/main/index.ts`                 | 5 new `ipcMain.handle()` registrations                                            | **MODIFIED** (append) |
| Preload API        | `src/main/preload.ts`               | Expose agent methods + stream listener to renderer                                | **MODIFIED** (append) |
| Settings           | `src/main/settings.ts`              | Add `agentEnabled`, `agentApiKey`, `agentModel`, `agentApiUrl`                    | **MODIFIED**          |
| `agentStore.ts`    | `src/renderer/stores/agentStore.ts` | Zustand store for chat UI state, streaming accumulation                           | **NEW**               |
| ChatPanel          | `src/renderer/components/agent/`    | Chat UI components (panel, messages, tool cards, input)                           | **NEW**               |

---

## Q1: Where Does Agent Logic Live?

**Answer: Main process, as a new `AgentManager` singleton.**

Rationale based on codebase analysis:

1. **Direct function access.** The agent needs to call `getAllCVs()`, `getCVFull()`, `getJD()`, `getMatchResultsForJD()`, `sendToPython()`, etc. These are all exported functions in `database.ts` and `pythonManager.ts`. From main process, they are direct imports -- zero IPC overhead per tool call. From renderer, each tool call would require an `ipcRenderer.invoke()` round-trip.

2. **Precedent: QueueManager.** The existing `QueueManager` class (in `src/main/queueManager.ts`) is a singleton in main process that orchestrates async work, pushes status updates to renderer via `mainWindow.webContents.send('queue-status-update', ...)`, and the renderer subscribes via `ipcRenderer.on()`. The agent follows this identical pattern.

3. **API key security.** The LLM API key must stay in main process. The existing pattern (`settings.ts`) stores keys in `userData/settings.json` and only exposes `hasApiKey: boolean` to renderer via preload. Agent follows the same pattern.

4. **Streaming without blocking UI.** The agent loop (call LLM -> parse tool calls -> execute tools -> call LLM again) is async in main process. Each chunk is pushed to renderer immediately. Renderer never blocks.

**Alternatives considered and rejected:**

- **Renderer process:** API keys exposed, every tool call requires IPC round-trip, streaming complexity increases.
- **Python sidecar:** Uses stdin/stdout JSON lines protocol (`pythonManager.ts` lines 108-148). Not designed for streaming. Would require rewriting the entire communication layer. Python sidecar should remain focused on NLP/parsing.
- **Separate Node.js service:** Unnecessary complexity. Main process already has everything needed.

---

## Q2: How Does the Agent Call Existing IPC Handlers as Tools?

**Answer: It does not call IPC handlers. It calls the underlying functions directly.**

The IPC handlers in `index.ts` are thin wrappers around imported functions. The agent bypasses IPC entirely:

```
IPC handler (for renderer):
  ipcMain.handle('get-all-cvs') --> calls getAllCVs() from database.ts

Agent tool (same process):
  agentTools['list_cvs'].execute() --> calls getAllCVs() from database.ts directly
```

### Tool Registry Design

```typescript
// src/main/agentTools.ts
import {
  getAllCVs,
  getCVFull,
  getAllJDs,
  getJD,
  getMatchResultsForJD,
} from "./database";
import { sendToPython } from "./pythonManager";

// OpenAI function calling format
export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "list_cvs",
      description:
        "List all CVs in a project. Returns summaries with id, name, confidence.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Filter by project ID" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cv_details",
      description:
        "Get full CV data including contact, skills, work history, education.",
      parameters: {
        type: "object",
        properties: {
          cvId: { type: "string" },
        },
        required: ["cvId"],
      },
    },
  },
  // ... more tools
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "list_cvs":
      return getAllCVs(args.projectId as string | undefined);
    case "get_cv_details":
      return getCVFull(args.cvId as string);
    case "list_jds":
      return getAllJDs(args.projectId as string | undefined);
    case "get_jd_details":
      return getJD(args.jdId as string);
    case "get_match_results":
      return getMatchResultsForJD(args.jdId as string);
    case "extract_jd":
      return sendToPython({ action: "extract_jd", text: args.text }, 120000);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
```

**Refactoring needed:** The CV-JD matching logic is currently inline in the `match-cvs-to-jd` IPC handler (index.ts lines 585-727). This should be extracted into a shared function in `database.ts` or a new `matching.ts` so both the IPC handler and agent tool can call it. This is a small, mechanical refactor.

### Tool Safety: Read-Only + Create for V1

**Include as tools (v1):**

- `list_cvs`, `get_cv_details` -- read
- `list_jds`, `get_jd_details` -- read
- `get_match_results` -- read
- `match_cvs_to_jd` -- compute (non-destructive, creates match records)
- `extract_jd` -- create (via Python sidecar)
- `get_project`, `list_projects` -- read

**Exclude from tools (v1):**

- `delete_cv`, `delete_jd`, `delete_project` -- destructive
- `update_cv_field` -- mutation (add in v2 after trust is established)
- `export_cv` -- file system side effect (add in v2)
- Any settings mutations

---

## Q3: How Does Streaming Flow Through Electron IPC?

**Answer: `webContents.send()` push events from main to renderer, same as queue status updates.**

### Streaming Data Flow

```
Cloud LLM API
    | SSE chunks (data: {"choices":[{"delta":{"content":"Hello"}}]})
    v
AgentManager (main process)
    | Parses SSE, extracts delta content
    | For each chunk:
    v
mainWindow.webContents.send('agent-stream', {
    conversationId: 'conv-123',
    type: 'text',           // 'text' | 'tool_call' | 'tool_result' | 'error' | 'done'
    content: 'Hello',       // text delta
})
    |
    v
Renderer: ipcRenderer.on('agent-stream', callback)
    |
    v
agentStore.appendStreamChunk(data)
    | Zustand state update triggers React re-render
    v
ChatPanel displays accumulated text with typing indicator
```

### Stream Event Types

| Type          | When                       | Payload                                        |
| ------------- | -------------------------- | ---------------------------------------------- |
| `text`        | LLM generating text        | `{ content: "partial text" }`                  |
| `tool_call`   | LLM decided to call a tool | `{ toolName: "list_cvs", args: {...} }`        |
| `tool_result` | Tool execution completed   | `{ toolName: "list_cvs", result: summarized }` |
| `error`       | Something failed           | `{ error: "message" }`                         |
| `done`        | Agent loop finished        | `{ totalTokens: 1234 }`                        |

### LLM Streaming Implementation

```typescript
// In AgentManager
private async *streamFromLLM(messages: LLMMessage[]): AsyncGenerator<SSEChunk> {
    const settings = loadSettings();
    const response = await fetch(settings.agentApiUrl || 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${settings.agentApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: settings.agentModel || 'gpt-4o',
            messages,
            tools: TOOL_DEFINITIONS,
            stream: true,
        }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!; // Keep incomplete line in buffer

        for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                yield JSON.parse(line.slice(6));
            }
        }
    }
}
```

### AbortController for Cancellation

```typescript
private abortControllers = new Map<string, AbortController>();

async chat(message: string, conversationId: string): Promise<void> {
    const controller = new AbortController();
    this.abortControllers.set(conversationId, controller);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        // ... process stream
    } finally {
        this.abortControllers.delete(conversationId);
    }
}

cancel(conversationId: string): void {
    this.abortControllers.get(conversationId)?.abort();
}
```

---

## Q4: Where Does Conversation History Get Stored?

**Answer: Same SQLite database (`samsara.db`), new tables via migration v5.**

### Schema Design

```sql
-- Migration version 5: Agent conversations

CREATE TABLE IF NOT EXISTS agent_conversations (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT,                    -- Auto-generated from first user message
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,            -- 'user' | 'assistant' | 'tool' | 'system'
    content TEXT,                  -- Text content (null for tool_call-only messages)
    tool_calls_json TEXT,          -- JSON: [{id, name, arguments}] when assistant calls tools
    tool_call_id TEXT,             -- For role='tool': which tool_call this responds to
    tool_name TEXT,                -- For role='tool': the function name
    token_count INTEGER,           -- Tokens consumed by this message
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conv
    ON agent_messages(conversation_id, id ASC);

CREATE TABLE IF NOT EXISTS agent_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,       -- 1 = helpful, -1 = not helpful
    comment TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (message_id) REFERENCES agent_messages(id) ON DELETE CASCADE
);
```

### Why Same Database

- **Foreign keys to projects.** Conversations belong to projects via `project_id`. Cascade delete works.
- **Single backup.** One file to back up or move.
- **Established migration pattern.** Database is currently at schema version 4 (line 366 of database.ts). Version 5 adds agent tables following the exact same pattern.
- **WAL mode already enabled.** Concurrent reads from agent and existing queries are fine.
- **No performance concern.** Conversation data is small (text). SQLite handles millions of rows trivially.

### Token Usage Tracking

Agent usage integrates with the existing `usage_events` table by adding a new event type:

```typescript
recordUsageEvent({
  projectId: conversationProjectId || "default-project",
  eventType: "agent_chat", // New event type alongside 'cv_extraction', 'jd_extraction'
  promptTokens: usage.prompt_tokens,
  completionTokens: usage.completion_tokens,
  totalTokens: usage.total_tokens,
  llmMode: "cloud", // Agent always uses cloud LLM
  model: settings.agentModel,
});
```

This automatically aggregates into `usage_daily` via the existing SQLite trigger (database.ts lines 336-346).

---

## Q5: How Does the LLM Proxy Connect?

**Answer: Main process makes HTTPS `fetch()` calls directly to cloud LLM API.**

```
Renderer                    Main Process                   Cloud API
   |                            |                              |
   |--invoke('agent-chat')----->|                              |
   |                            |--fetch(apiUrl, {stream})---->|
   |                            |<----SSE chunks---------------|
   |<--send('agent-stream')-----|                              |
   |<--send('agent-stream')-----|                              |
   |<--send('agent-stream')-----|                              |
   |                            |                              |
```

### Why Main Process, Not Renderer

1. **API key never reaches renderer.** Renderer only knows `hasAgentApiKey: boolean`.
2. **No CORS issues.** Node.js `fetch()` in main process has no CORS restrictions.
3. **Single point for rate limiting.** Can enforce token limits before making the call.
4. **Consistent with existing pattern.** The Python sidecar already talks to OpenAI for extraction (via `OPENAI_API_KEY` env var). The agent uses the same key storage mechanism but calls the API directly from Node.js.

### Configuration

```typescript
// In settings.ts AppSettings interface
agentEnabled?: boolean;       // Default: false
agentApiKey?: string;         // Separate from openaiApiKey (may differ)
agentModel?: string;          // Default: 'gpt-4o'
agentApiUrl?: string;         // Default: 'https://api.openai.com/v1/chat/completions'
```

Separate `agentApiKey` from `openaiApiKey` because:

- User may want different API keys for extraction vs chat
- Agent may use a different provider (Anthropic, Azure OpenAI, local proxy)
- Configurable `agentApiUrl` supports corporate proxy or self-hosted LLM

---

## Q6: How Does the Agent's Iterative Loop Work?

**Answer: While loop in `AgentManager.chat()` with max iteration cap.**

### Flow Diagram

```
User sends: "Find me Java developers with 5+ years from my CVs"
    |
    v
AgentManager.chat()
    |
    v
[Iteration 1] Call LLM with system prompt + user message
    |
    LLM returns: tool_call("list_cvs", {projectId: "proj-123"})
    |
    Push to renderer: {type: 'tool_call', name: 'list_cvs'}
    Execute: getAllCVs("proj-123") --> returns 15 CV summaries
    Push to renderer: {type: 'tool_result', name: 'list_cvs', count: 15}
    |
    v
[Iteration 2] Call LLM with tool result appended
    |
    LLM returns: tool_call("get_cv_details", {cvId: "cv-001"})
                 tool_call("get_cv_details", {cvId: "cv-002"})
                 ... (parallel tool calls)
    |
    Execute all tool calls, append results
    |
    v
[Iteration 3] Call LLM with all tool results
    |
    LLM returns: text response "I found 4 Java developers with 5+ years..."
    |
    Stream text chunks to renderer
    Push: {type: 'done'}
    |
    v
Save full conversation to SQLite
```

### Implementation

```typescript
class AgentManager {
  private static MAX_ITERATIONS = 10;

  async chat(
    message: string,
    conversationId: string,
    projectId?: string,
  ): Promise<void> {
    // 1. Load or create conversation
    const messages = await this.loadConversationMessages(conversationId);

    // 2. Append user message
    messages.push({ role: "user", content: message });
    this.saveMessage(conversationId, "user", message);

    // 3. Iterative agent loop
    let iterations = 0;
    while (iterations < AgentManager.MAX_ITERATIONS) {
      iterations++;

      // Call LLM with streaming
      const response = await this.callLLMStreaming(messages);

      if (response.toolCalls && response.toolCalls.length > 0) {
        // LLM wants to use tools
        // Save assistant message with tool calls
        this.saveMessage(
          conversationId,
          "assistant",
          response.content,
          response.toolCalls,
        );

        // Execute each tool call
        for (const toolCall of response.toolCalls) {
          this.pushToRenderer({
            conversationId,
            type: "tool_call",
            toolName: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments),
          });

          const result = await executeTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
          );

          // Summarize large results to avoid bloating context
          const summarized = this.summarizeToolResult(result);

          this.pushToRenderer({
            conversationId,
            type: "tool_result",
            toolName: toolCall.function.name,
            result: summarized,
          });

          // Append tool result for next LLM call
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(summarized),
          });

          this.saveMessage(
            conversationId,
            "tool",
            JSON.stringify(summarized),
            null,
            toolCall.id,
            toolCall.function.name,
          );
        }

        // Loop continues: LLM will be called again with tool results
      } else {
        // Final text response -- save and finish
        this.saveMessage(conversationId, "assistant", response.content);
        this.pushToRenderer({ conversationId, type: "done" });
        break;
      }
    }

    if (iterations >= AgentManager.MAX_ITERATIONS) {
      this.pushToRenderer({
        conversationId,
        type: "error",
        error:
          "Agent reached maximum iterations. Please try a more specific request.",
      });
    }
  }
}
```

### Tool Result Summarization

Large tool results (e.g., 15 full CV objects) would blow up the context window. The agent should summarize:

```typescript
private summarizeToolResult(result: unknown): unknown {
    const json = JSON.stringify(result);
    if (json.length < 4000) return result; // Small enough, pass through

    // For arrays, return count + first 3 items
    if (Array.isArray(result)) {
        return {
            _summary: true,
            totalCount: result.length,
            items: result.slice(0, 3),
            note: `Showing 3 of ${result.length}. Ask me to look at specific items.`,
        };
    }

    // For large objects, truncate deep fields
    return result; // TODO: smarter truncation
}
```

---

## Feature Flag: Zero-Impact When Disabled

```typescript
// In settings.ts
interface AppSettings {
  // ... existing fields
  agentEnabled?: boolean; // Default: false (undefined = false)
  agentApiKey?: string;
  agentModel?: string;
  agentApiUrl?: string;
}
```

**When `agentEnabled` is falsy:**

- **Main process:** Agent IPC handlers return early: `{ success: false, error: 'Agent not enabled' }`
- **Renderer:** `ChatPanel` conditionally renders: `{settings.agentEnabled && <ChatPanel />}`
- **No network calls:** `AgentManager` not instantiated, no fetch to LLM API
- **No DB impact:** Agent tables exist in schema but are empty
- **Zero performance overhead:** No listeners, no polling, no state updates

---

## New IPC Surface (5 handlers)

```typescript
// Append to src/main/index.ts

ipcMain.handle(
  "agent-chat",
  async (
    _event,
    message: string,
    conversationId?: string,
    projectId?: string,
  ) => {
    // Returns { success: true, conversationId } immediately
    // Streaming happens via webContents.send('agent-stream')
  },
);

ipcMain.handle(
  "agent-get-conversations",
  async (_event, projectId?: string) => {
    // Returns { success: true, data: ConversationSummary[] }
  },
);

ipcMain.handle("agent-get-messages", async (_event, conversationId: string) => {
  // Returns { success: true, data: AgentMessage[] }
});

ipcMain.handle("agent-cancel", async (_event, conversationId: string) => {
  // Aborts in-progress LLM call via AbortController
});

ipcMain.handle(
  "agent-feedback",
  async (_event, messageId: number, rating: number, comment?: string) => {
    // Stores feedback in agent_feedback table
  },
);
```

**Preload additions:**

```typescript
// Append to preload.ts contextBridge.exposeInMainWorld('api', { ... })
agentChat: (message: string, conversationId?: string, projectId?: string) =>
    ipcRenderer.invoke('agent-chat', message, conversationId, projectId),
agentGetConversations: (projectId?: string) =>
    ipcRenderer.invoke('agent-get-conversations', projectId),
agentGetMessages: (conversationId: string) =>
    ipcRenderer.invoke('agent-get-messages', conversationId),
agentCancel: (conversationId: string) =>
    ipcRenderer.invoke('agent-cancel', conversationId),
agentFeedback: (messageId: number, rating: number, comment?: string) =>
    ipcRenderer.invoke('agent-feedback', messageId, rating, comment),
onAgentStream: (callback: (data: AgentStreamEvent) => void): void => {
    ipcRenderer.on('agent-stream', (_event, data) => callback(data));
},
removeAgentStreamListener: (): void => {
    ipcRenderer.removeAllListeners('agent-stream');
},
```

---

## Zustand Store Design

```typescript
// src/renderer/stores/agentStore.ts
interface AgentMessage {
  id: number;
  role: "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: ToolCall[];
  toolName?: string;
  toolResult?: unknown;
  createdAt: string;
}

interface AgentState {
  // Visibility
  isOpen: boolean;
  toggle: () => void;

  // Conversation
  conversationId: string | null;
  messages: AgentMessage[];
  conversations: ConversationSummary[]; // sidebar list

  // Streaming state
  isStreaming: boolean;
  streamingText: string; // Accumulates text chunks during streaming
  pendingToolCalls: string[]; // Tool names currently executing

  // Actions
  sendMessage: (text: string, projectId?: string) => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  loadConversations: (projectId?: string) => Promise<void>;
  newConversation: () => void;
  cancel: () => void;
  submitFeedback: (messageId: number, rating: number) => Promise<void>;

  // Internal (called by stream listener)
  _handleStreamEvent: (event: AgentStreamEvent) => void;
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Agent Logic in Renderer

**What:** Running the LLM call loop in React components or a renderer-side service.
**Why bad:** API keys in renderer memory; every tool call requires IPC round-trip; complex state management for streaming + tool execution.
**Instead:** Agent loop in main process. Renderer is purely a display layer for stream events.

### Anti-Pattern 2: Agent Logic in Python Sidecar

**What:** Adding the agent orchestration to the Python backend.
**Why bad:** The Python sidecar communicates via stdin/stdout JSON lines (see `pythonManager.ts`). This protocol has no concept of streaming -- it waits for a complete JSON response per request. Adding streaming would require rewriting the entire IPC protocol. The sidecar should remain focused on CPU-bound NLP tasks.
**Instead:** Agent in main process (TypeScript/Node.js). Calls Python sidecar via existing `sendToPython()` when it needs NLP operations.

### Anti-Pattern 3: Unbounded Agent Loops

**What:** No iteration cap on tool call cycles.
**Why bad:** Runaway API costs, confused users watching an infinite tool cycle, potential for stuck conversations.
**Instead:** Hard cap at 10 iterations. Show each tool call in UI so user sees progress. Allow cancel via AbortController.

### Anti-Pattern 4: Passing Full Tool Results to LLM

**What:** Sending the complete JSON of 50 CVs back to the LLM as tool output.
**Why bad:** Context window explosion, high token costs, degraded LLM performance.
**Instead:** Summarize tool results. Return counts + first N items. Let agent ask for specifics.

### Anti-Pattern 5: Separate Conversation Database

**What:** Storing conversations in a separate JSON file or SQLite database.
**Why bad:** Loses foreign key relationships to projects table, complicates backup/restore, diverges from established data patterns.
**Instead:** Same `samsara.db` with migration v5.

---

## Suggested Build Order

Based on dependency analysis:

| Phase | What                                        | Depends On | Rationale                       |
| ----- | ------------------------------------------- | ---------- | ------------------------------- |
| 1     | DB schema (agent tables, migration v5)      | Nothing    | Purely additive to database.ts  |
| 2     | Extract matching logic into shared function | Nothing    | Small refactor of index.ts      |
| 3     | Agent tools registry (`agentTools.ts`)      | Phase 1, 2 | Wraps existing functions        |
| 4     | `AgentManager` core (LLM client + loop)     | Phase 3    | The main new component          |
| 5     | Agent IPC handlers + preload                | Phase 4    | Thin wrappers                   |
| 6     | Agent settings (enable, API key, model)     | Phase 5    | Settings UI + backend           |
| 7     | `agentStore` + basic ChatPanel              | Phase 5    | Frontend integration            |
| 8     | Streaming UI (typing indicator, tool cards) | Phase 7    | Polish the chat experience      |
| 9     | Conversation history (list, load, continue) | Phase 7    | Multi-conversation support      |
| 10    | Feedback system (thumbs up/down)            | Phase 9    | After basic chat works          |
| 11    | Usage tracking integration                  | Phase 4    | Wire into existing usage_events |

**Phases 1-5 are backend. Phases 6-10 are frontend. Phase 11 is integration.**

---

## Security Considerations

### API Key Management

- `agentApiKey` stored in `userData/settings.json` (same as existing `openaiApiKey`)
- Preload exposes only `hasAgentApiKey: boolean` to renderer
- Key read by `AgentManager` in main process only
- Separate from extraction API key -- user may use different providers

### Tool Execution Safety

- Tools are a **fixed whitelist** in `agentTools.ts` -- LLM cannot invent new tools
- V1 tools are read-only + non-destructive create operations
- No delete, no settings mutation, no file system writes via agent
- Each tool validates inputs before calling underlying function

### Rate Limiting

- Check `globalTokenLimit` from settings before each LLM call
- Agent token usage recorded via existing `recordUsageEvent()` with `eventType: 'agent_chat'`
- Existing `usage_daily` aggregation trigger handles rollup automatically

### Network Security

- HTTPS only (Node.js fetch defaults to HTTPS)
- Configurable `agentApiUrl` for corporate proxy/VPN setups
- No credentials sent to renderer process

---

## Sources

- Direct analysis: `src/main/index.ts` -- 30+ IPC handlers, matching logic inline at lines 585-727
- Direct analysis: `src/main/pythonManager.ts` -- stdin/stdout JSON lines protocol, request-response with correlation IDs
- Direct analysis: `src/main/queueManager.ts` -- push notification pattern via `webContents.send()`, singleton in main process
- Direct analysis: `src/main/database.ts` -- SQLite schema at version 4, WAL mode, migration pattern
- Direct analysis: `src/main/settings.ts` -- JSON file storage, API key pattern
- Direct analysis: `src/main/preload.ts` -- contextBridge API surface, stream listener pattern (`onQueueStatusUpdate`)
