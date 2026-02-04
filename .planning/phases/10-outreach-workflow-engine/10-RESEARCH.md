# Phase 10: Outreach Workflow Engine - Research

**Researched:** 2026-02-04
**Domain:** State machine orchestration (XState), timer-based escalation, reply detection, Kanban pipeline UI
**Confidence:** HIGH

## Summary

Phase 10 implements the outreach workflow engine that orchestrates automated candidate outreach sequences. The core challenge is building a state machine that manages the lifecycle of outreach for each candidate: triggering SMS/email on graduation, escalating to AI call on timeout or reply, and persisting state across app restarts.

This phase builds on Phase 9's communication infrastructure (Twilio SMS, Nodemailer email, credential management, DNC registry) and adds the orchestration layer. The key insight is that **XState v5 is the industry-standard solution** for this type of workflow orchestration in TypeScript, offering first-class persistence support, delayed transitions for timeouts, and actor-based architecture that maps cleanly to per-candidate workflow instances.

The CONTEXT.md specifies locked decisions: XState for state machine, Twilio webhooks for reply detection with polling fallback, Kanban pipeline view (Pending -> Contacted -> Replied -> Screening -> Passed/Failed), and specific graduation flow with batch/individual actions. The existing codebase already has `@dnd-kit/core` and `@dnd-kit/sortable` installed for drag-and-drop.

**Primary recommendation:** Use XState v5 with `setup()` for strongly-typed state machines, SQLite persistence via `getPersistedSnapshot()`, delayed transitions (`after`) for timeout escalation, and webhook + polling hybrid for reply detection. Build Kanban UI using existing `@dnd-kit` libraries with shadcn/ui components.

## Standard Stack

### Core

| Library             | Version          | Purpose                        | Why Standard                                                                                              |
| ------------------- | ---------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `xstate`            | 5.x              | State machine orchestration    | Official standard for workflow state machines in TypeScript; actor-based; first-class persistence support |
| `@dnd-kit/core`     | 6.x (installed)  | Drag-and-drop primitives       | Already in codebase; accessible; lightweight; works with React 19                                         |
| `@dnd-kit/sortable` | 10.x (installed) | Sortable lists for Kanban      | Already in codebase; peer to core                                                                         |
| `twilio`            | 5.x (installed)  | SMS sending + webhook handling | Already in codebase; official SDK                                                                         |
| `better-sqlite3`    | 12.x (installed) | State persistence              | Already in codebase; synchronous; perfect for Electron                                                    |

### Supporting

| Library         | Version | Purpose                | When to Use                                   |
| --------------- | ------- | ---------------------- | --------------------------------------------- |
| `@xstate/react` | 5.x     | React hooks for XState | `useActor`, `useMachine` hooks for UI binding |

### Alternatives Considered

| Instead of | Could Use            | Tradeoff                                                                  |
| ---------- | -------------------- | ------------------------------------------------------------------------- |
| XState     | Custom state machine | XState handles edge cases, persistence, visualization; custom = more bugs |
| XState     | Redux + sagas        | Sagas are harder to visualize and test; XState is purpose-built           |
| @dnd-kit   | react-beautiful-dnd  | Not maintained; dnd-kit is actively developed                             |
| @dnd-kit   | @hello-pangea/dnd    | Community fork; dnd-kit is more flexible                                  |
| Webhooks   | Polling only         | Webhooks are faster (real-time); polling can be fallback                  |

**Installation:**

```bash
npm install xstate @xstate/react
```

## Architecture Patterns

### Recommended Project Structure

```
src/main/
├── workflowService.ts           # NEW: XState machine definitions + actor management
├── workflowPersistence.ts       # NEW: SQLite snapshot save/restore
├── webhookServer.ts             # NEW: Local HTTP server for Twilio webhooks (optional)
├── replyPoller.ts               # NEW: Polling for inbound SMS/email
├── communicationService.ts      # MODIFY: Add inbound message handling
├── database.ts                  # MODIFY: Add outreach_workflows table, state column

src/renderer/
├── components/
│   ├── outreach/
│   │   ├── OutreachSection.tsx  # MODIFY: Replace list with Kanban pipeline
│   │   ├── KanbanBoard.tsx      # NEW: DnD columns + cards
│   │   ├── KanbanColumn.tsx     # NEW: Droppable column
│   │   ├── CandidateCard.tsx    # NEW: Draggable candidate card
│   │   ├── CandidatePanel.tsx   # NEW: Side panel for selected candidate
│   │   └── GraduationControls.tsx # NEW: Batch/individual graduation UI
├── stores/
│   └── workflowStore.ts         # NEW: XState actors, workflow state
```

### Pattern 1: XState v5 Machine with setup()

**What:** Define strongly-typed state machine for outreach workflow
**When to use:** Always - this is the core orchestration
**Source:** [Stately XState TypeScript docs](https://stately.ai/docs/typescript)

```typescript
// src/main/workflowService.ts
import { setup, assign, fromPromise, createActor } from "xstate";
import { sendSMS, sendEmail } from "./communicationService";
import {
  saveWorkflowSnapshot,
  loadWorkflowSnapshot,
} from "./workflowPersistence";

// Define workflow states matching Kanban columns
type WorkflowState =
  | "pending"
  | "contacted"
  | "replied"
  | "screening"
  | "passed"
  | "failed"
  | "paused"
  | "archived";

interface WorkflowContext {
  candidateId: string;
  projectId: string;
  matchScore: number;
  candidateName: string;
  phone?: string;
  email?: string;
  escalationTimeoutMs: number; // Configurable per project
  replyDetected: boolean;
  replyIntent: "positive" | "negative" | "ambiguous" | null;
  screeningOutcome: "passed" | "failed" | null;
  startedAt: string;
  contactedAt?: string;
  repliedAt?: string;
  screeningAt?: string;
  completedAt?: string;
  lastError?: string;
}

type WorkflowEvent =
  | { type: "GRADUATE" }
  | { type: "REPLY_DETECTED"; intent: "positive" | "negative" | "ambiguous" }
  | { type: "TIMEOUT" }
  | { type: "SCREENING_COMPLETE"; outcome: "passed" | "failed" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "CANCEL" }
  | { type: "FORCE_CALL" }
  | { type: "SKIP_TO_SCREENING" };

export const outreachMachine = setup({
  types: {
    context: {} as WorkflowContext,
    events: {} as WorkflowEvent,
  },
  actions: {
    sendInitialOutreach: assign(({ context }) => {
      // Send SMS + Email simultaneously (handled by invoke)
      return { contactedAt: new Date().toISOString() };
    }),
    markReplied: assign({
      repliedAt: () => new Date().toISOString(),
    }),
    markScreeningStarted: assign({
      screeningAt: () => new Date().toISOString(),
    }),
    markCompleted: assign({
      completedAt: () => new Date().toISOString(),
    }),
    persistState: ({ context, self }) => {
      // Save snapshot to SQLite on every state change
      const snapshot = self.getPersistedSnapshot();
      saveWorkflowSnapshot(context.candidateId, snapshot);
    },
  },
  guards: {
    hasPhone: ({ context }) => !!context.phone,
    hasEmail: ({ context }) => !!context.email,
    isPositiveReply: ({ context }) =>
      context.replyIntent === "positive" || context.replyIntent === "ambiguous",
    aiCallEnabled: ({ context }) => {
      // Check project setting - to be implemented
      return true;
    },
  },
  actors: {
    sendInitialMessages: fromPromise(
      async ({ input }: { input: WorkflowContext }) => {
        const results = await Promise.allSettled([
          input.phone
            ? sendSMS({
                projectId: input.projectId,
                cvId: input.candidateId,
                toPhone: input.phone,
                body: "{{initial_sms_template}}", // Template rendering happens in sendSMS
              })
            : Promise.resolve({ success: true }),
          input.email
            ? sendEmail({
                projectId: input.projectId,
                cvId: input.candidateId,
                toEmail: input.email,
                subject: "{{initial_email_subject}}",
                body: "{{initial_email_body}}",
              })
            : Promise.resolve({ success: true }),
        ]);
        return results;
      },
    ),
    triggerAICall: fromPromise(
      async ({ input }: { input: WorkflowContext }) => {
        // ElevenLabs + Twilio SIP integration (Phase 11+)
        // For now, placeholder
        console.log(`[Workflow] Would trigger AI call to ${input.phone}`);
        return { callId: "placeholder" };
      },
    ),
  },
}).createMachine(
  {
    id: "outreachWorkflow",
    initial: "pending",
    context: ({ input }) => input as WorkflowContext,
    states: {
      pending: {
        // Waiting for graduation
        on: {
          GRADUATE: {
            target: "contacted",
            actions: ["sendInitialOutreach", "persistState"],
          },
        },
      },
      contacted: {
        // Initial outreach sent, waiting for reply or timeout
        entry: ["persistState"],
        invoke: {
          id: "sendMessages",
          src: "sendInitialMessages",
          input: ({ context }) => context,
          onDone: {
            // Messages sent successfully
          },
          onError: {
            // Handle send failure - stay in contacted, log error
            actions: assign({ lastError: ({ event }) => String(event.error) }),
          },
        },
        after: {
          // Dynamic timeout from context
          escalationTimeout: {
            target: "screening",
            guard: "aiCallEnabled",
            actions: ["markScreeningStarted", "persistState"],
          },
        },
        on: {
          REPLY_DETECTED: [
            {
              guard: "isPositiveReply",
              target: "replied",
              actions: [
                assign({
                  replyDetected: true,
                  replyIntent: ({ event }) => event.intent,
                }),
                "markReplied",
                "persistState",
              ],
            },
            {
              // Negative reply - don't escalate
              target: "archived",
              actions: [
                assign({
                  replyDetected: true,
                  replyIntent: ({ event }) => event.intent,
                }),
                "markCompleted",
                "persistState",
              ],
            },
          ],
          PAUSE: { target: "paused", actions: "persistState" },
          CANCEL: {
            target: "archived",
            actions: ["markCompleted", "persistState"],
          },
          SKIP_TO_SCREENING: {
            target: "screening",
            actions: ["markScreeningStarted", "persistState"],
          },
        },
      },
      replied: {
        // Reply detected - trigger AI call immediately
        entry: ["persistState"],
        always: {
          guard: "aiCallEnabled",
          target: "screening",
          actions: ["markScreeningStarted", "persistState"],
        },
      },
      screening: {
        // AI call in progress
        entry: ["persistState"],
        invoke: {
          id: "aiCall",
          src: "triggerAICall",
          input: ({ context }) => context,
          onDone: {
            // Call completed, wait for outcome
          },
          onError: {
            target: "failed",
            actions: [
              assign({ lastError: ({ event }) => String(event.error) }),
              "markCompleted",
              "persistState",
            ],
          },
        },
        on: {
          SCREENING_COMPLETE: [
            {
              guard: ({ event }) => event.outcome === "passed",
              target: "passed",
              actions: [
                assign({ screeningOutcome: "passed" }),
                "markCompleted",
                "persistState",
              ],
            },
            {
              target: "failed",
              actions: [
                assign({ screeningOutcome: "failed" }),
                "markCompleted",
                "persistState",
              ],
            },
          ],
          PAUSE: { target: "paused", actions: "persistState" },
          CANCEL: {
            target: "archived",
            actions: ["markCompleted", "persistState"],
          },
        },
      },
      passed: {
        type: "final",
        entry: "persistState",
      },
      failed: {
        // Post-failed screening - handle callback scheduling on reply
        entry: "persistState",
        on: {
          REPLY_DETECTED: {
            // WRK-05: Schedule recruiter callback
            actions: [
              assign({ replyDetected: true }),
              // TODO: Trigger callback scheduling
              "persistState",
            ],
          },
        },
      },
      paused: {
        // Recruiter paused the workflow
        entry: "persistState",
        on: {
          RESUME: { target: "contacted", actions: "persistState" },
          CANCEL: {
            target: "archived",
            actions: ["markCompleted", "persistState"],
          },
          FORCE_CALL: {
            target: "screening",
            actions: ["markScreeningStarted", "persistState"],
          },
        },
      },
      archived: {
        type: "final",
        entry: "persistState",
      },
    },
  },
  {
    delays: {
      escalationTimeout: ({ context }) => context.escalationTimeoutMs,
    },
  },
);
```

### Pattern 2: SQLite State Persistence

**What:** Persist XState snapshots to SQLite for app restart recovery
**When to use:** On every state transition, on app startup
**Source:** [Stately Persistence docs](https://stately.ai/docs/persistence)

```typescript
// src/main/workflowPersistence.ts
import { getDatabase } from "./database";
import { outreachMachine } from "./workflowService";
import { createActor, SnapshotFrom } from "xstate";

type WorkflowSnapshot = SnapshotFrom<typeof outreachMachine>;

/**
 * Save workflow snapshot to SQLite.
 * Called on every state transition.
 */
export function saveWorkflowSnapshot(
  candidateId: string,
  snapshot: WorkflowSnapshot,
): void {
  const db = getDatabase();
  const snapshotJson = JSON.stringify(snapshot);
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO outreach_workflows (candidate_id, snapshot_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(candidate_id) DO UPDATE SET
      snapshot_json = excluded.snapshot_json,
      updated_at = excluded.updated_at
  `,
  ).run(candidateId, snapshotJson, now);
}

/**
 * Load workflow snapshot from SQLite.
 */
export function loadWorkflowSnapshot(
  candidateId: string,
): WorkflowSnapshot | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `
    SELECT snapshot_json FROM outreach_workflows WHERE candidate_id = ?
  `,
    )
    .get(candidateId) as { snapshot_json: string } | undefined;

  if (!row) return null;
  return JSON.parse(row.snapshot_json) as WorkflowSnapshot;
}

/**
 * Restore all active workflows on app startup.
 * Called from main process initialization.
 */
export function restoreActiveWorkflows(): Map<
  string,
  ReturnType<typeof createActor>
> {
  const db = getDatabase();
  const actors = new Map();

  // Get all non-final workflows
  const rows = db
    .prepare(
      `
    SELECT candidate_id, snapshot_json FROM outreach_workflows
    WHERE json_extract(snapshot_json, '$.status') != 'done'
  `,
    )
    .all() as { candidate_id: string; snapshot_json: string }[];

  for (const row of rows) {
    try {
      const snapshot = JSON.parse(row.snapshot_json) as WorkflowSnapshot;

      // Create actor with persisted snapshot
      const actor = createActor(outreachMachine, {
        snapshot,
      });

      actor.start();
      actors.set(row.candidate_id, actor);

      console.log(
        `[WorkflowPersistence] Restored workflow for ${row.candidate_id}`,
      );
    } catch (error) {
      console.error(
        `[WorkflowPersistence] Failed to restore ${row.candidate_id}:`,
        error,
      );
    }
  }

  // Execute missed escalations in order
  executeMissedEscalations(actors);

  return actors;
}

/**
 * Execute any escalations that were missed while app was closed.
 * Per CONTEXT.md: "All missed escalations execute in order when app reopens"
 */
function executeMissedEscalations(
  actors: Map<string, ReturnType<typeof createActor>>,
): void {
  for (const [candidateId, actor] of actors) {
    const snapshot = actor.getSnapshot();
    const context = snapshot.context;

    // Check if we're in 'contacted' state and timeout has passed
    if (snapshot.value === "contacted" && context.contactedAt) {
      const contactedTime = new Date(context.contactedAt).getTime();
      const now = Date.now();
      const elapsed = now - contactedTime;

      if (elapsed >= context.escalationTimeoutMs) {
        console.log(
          `[WorkflowPersistence] Executing missed escalation for ${candidateId}`,
        );
        actor.send({ type: "TIMEOUT" });
      }
    }
  }
}
```

### Pattern 3: Reply Detection with Webhooks + Polling Hybrid

**What:** Detect candidate replies via Twilio webhooks (primary) with polling fallback
**When to use:** Always - webhooks for real-time, polling for reliability
**Source:** [Twilio Webhooks](https://www.twilio.com/docs/messaging/tutorials/how-to-receive-and-reply)

```typescript
// src/main/replyPoller.ts
import { getCredential } from "./credentialManager";
import { getDatabase } from "./database";

interface InboundMessage {
  from: string;
  body: string;
  timestamp: string;
}

// Keyword classification for intent detection
const POSITIVE_KEYWORDS = [
  "yes",
  "interested",
  "call",
  "available",
  "sure",
  "okay",
  "ok",
];
const NEGATIVE_KEYWORDS = [
  "no",
  "stop",
  "unsubscribe",
  "not interested",
  "remove",
];

export function classifyIntent(
  body: string,
): "positive" | "negative" | "ambiguous" {
  const lower = body.toLowerCase();

  // Check negative first (more specific)
  for (const keyword of NEGATIVE_KEYWORDS) {
    if (lower.includes(keyword)) return "negative";
  }

  // Check positive
  for (const keyword of POSITIVE_KEYWORDS) {
    if (lower.includes(keyword)) return "positive";
  }

  // Per CONTEXT.md: "Ambiguous replies: Treat as positive"
  return "ambiguous";
}

/**
 * Poll Twilio for inbound SMS messages.
 * Fallback mechanism when webhooks aren't available.
 */
export async function pollInboundMessages(
  projectId: string,
): Promise<InboundMessage[]> {
  const accountSid = getCredential(projectId, "twilio", "account_sid");
  const authToken = getCredential(projectId, "twilio", "auth_token");
  const ourNumber = getCredential(projectId, "twilio", "phone_number");

  if (!accountSid || !authToken || !ourNumber) return [];

  try {
    const Twilio = (await import("twilio")).default;
    const client = new Twilio(accountSid, authToken);

    // Get messages sent TO our number in last 30 minutes
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

    const messages = await client.messages.list({
      to: ourNumber,
      dateSentAfter: thirtyMinsAgo,
      limit: 50,
    });

    // Filter to only inbound (direction === 'inbound')
    return messages
      .filter((m) => m.direction === "inbound")
      .map((m) => ({
        from: m.from,
        body: m.body || "",
        timestamp: m.dateSent?.toISOString() || new Date().toISOString(),
      }));
  } catch (error) {
    console.error("[ReplyPoller] Failed to poll inbound messages:", error);
    return [];
  }
}

/**
 * Process inbound messages and send events to matching workflows.
 */
export function processInboundMessages(
  messages: InboundMessage[],
  workflowActors: Map<string, any>,
  candidatePhoneMap: Map<string, string>, // phone -> candidateId
): void {
  for (const msg of messages) {
    const normalizedPhone = normalizePhone(msg.from);
    const candidateId = candidatePhoneMap.get(normalizedPhone);

    if (candidateId) {
      const actor = workflowActors.get(candidateId);
      if (actor) {
        const intent = classifyIntent(msg.body);
        actor.send({ type: "REPLY_DETECTED", intent });

        // Store inbound message in database
        storeInboundMessage(candidateId, msg, intent);
      }
    }
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function storeInboundMessage(
  candidateId: string,
  msg: InboundMessage,
  intent: "positive" | "negative" | "ambiguous",
): void {
  // Store in messages table
  const db = getDatabase();
  const id = crypto.randomUUID();

  db.prepare(
    `
    INSERT INTO messages (id, project_id, cv_id, type, direction, status, from_address, to_address, body, created_at)
    SELECT ?, project_id, ?, 'sms', 'inbound', 'received', ?,
           (SELECT value FROM provider_credentials WHERE provider = 'twilio' AND credential_type = 'phone_number' LIMIT 1),
           ?, ?
    FROM outreach_workflows WHERE candidate_id = ?
  `,
  ).run(id, candidateId, msg.from, msg.body, msg.timestamp, candidateId);
}
```

### Pattern 4: Kanban Board with @dnd-kit

**What:** Drag-and-drop Kanban pipeline view
**When to use:** OutreachSection main view
**Source:** [dnd-kit Kanban tutorial](https://blog.logrocket.com/build-kanban-board-dnd-kit-react/)

```typescript
// src/renderer/components/outreach/KanbanBoard.tsx
import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { CandidateCard } from './CandidateCard';
import { useWorkflowStore } from '../../stores/workflowStore';

const COLUMNS = [
  { id: 'pending', title: 'Pending', color: 'bg-slate-100' },
  { id: 'contacted', title: 'Contacted', color: 'bg-blue-100' },
  { id: 'replied', title: 'Replied', color: 'bg-purple-100' },
  { id: 'screening', title: 'Screening', color: 'bg-amber-100' },
  { id: 'passed', title: 'Passed', color: 'bg-green-100' },
  { id: 'failed', title: 'Failed', color: 'bg-red-100' },
] as const;

export function KanbanBoard() {
  const { candidates, moveCandidateToColumn } = useWorkflowStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const candidateId = active.id as string;
    const newColumn = over.id as string;

    // Find current column
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate || candidate.status === newColumn) return;

    // Validate transition (can only move to certain columns manually)
    const validTransitions: Record<string, string[]> = {
      pending: ['contacted'],  // Graduate
      contacted: ['paused', 'archived', 'screening'],  // Pause, Cancel, Skip
      paused: ['contacted', 'screening', 'archived'],  // Resume, Force call, Cancel
    };

    if (!validTransitions[candidate.status]?.includes(newColumn)) {
      console.warn(`Invalid transition: ${candidate.status} -> ${newColumn}`);
      return;
    }

    moveCandidateToColumn(candidateId, newColumn);
  };

  const activeCandidate = candidates.find(c => c.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-4 overflow-x-auto h-full">
        {COLUMNS.map(column => {
          const columnCandidates = candidates.filter(c => c.status === column.id);

          return (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              count={columnCandidates.length}
              color={column.color}
            >
              <SortableContext
                items={columnCandidates.map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {columnCandidates
                  .sort((a, b) => b.matchScore - a.matchScore) // Sort by match % descending
                  .map(candidate => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                    />
                  ))}
              </SortableContext>
            </KanbanColumn>
          );
        })}
      </div>

      <DragOverlay>
        {activeCandidate ? (
          <CandidateCard candidate={activeCandidate} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

### Anti-Patterns to Avoid

- **Storing XState actors in React state:** Actors should be managed in the main process or a global store, not component state
- **Polling too frequently:** 1-minute intervals for delivery status; 30-second for reply detection max
- **Not persisting on every transition:** State loss on crash if persistence is delayed
- **Synchronous workflow operations:** All Twilio/Nodemailer calls must be async
- **Hardcoding timeout values:** Must be project-configurable per CONTEXT.md
- **Ignoring webhook security:** Validate Twilio webhook signatures
- **Manual state transitions without XState:** All state changes must go through the machine

## Don't Hand-Roll

| Problem            | Don't Build              | Use Instead                | Why                                                          |
| ------------------ | ------------------------ | -------------------------- | ------------------------------------------------------------ |
| State machine      | Custom switch statements | XState v5                  | Persistence, visualization, type safety, delayed transitions |
| Timeout management | setTimeout tracking      | XState `after` delays      | Automatic cleanup, persistence across restarts               |
| Drag-and-drop      | Custom mouse handlers    | @dnd-kit                   | Accessibility, keyboard support, touch support               |
| Webhook validation | Custom HMAC              | Twilio SDK validation      | Security edge cases handled                                  |
| Retry logic        | Manual retry loops       | XState invoke with onError | Cleaner error handling, state-aware retries                  |

**Key insight:** Workflow orchestration is deceptively complex. XState handles timeout cancellation on state exit, snapshot serialization, child actor persistence, and many edge cases that custom solutions miss.

## Common Pitfalls

### Pitfall 1: Timeout Not Firing After App Restart

**What goes wrong:** Escalation timeouts scheduled before restart are lost
**Why it happens:** `setTimeout` IDs don't persist; XState delays are in-memory
**How to avoid:** On restore, calculate elapsed time and immediately trigger if timeout passed
**Warning signs:** Candidates stuck in "contacted" state with no escalation

### Pitfall 2: Race Condition Between Reply and Timeout

**What goes wrong:** Both reply and timeout fire, causing duplicate escalations
**Why it happens:** Reply detected microseconds before timeout
**How to avoid:** XState handles this - transition to reply state cancels timeout delay
**Warning signs:** Multiple AI calls for same candidate

### Pitfall 3: Webhook URL Changes on Each App Launch

**What goes wrong:** Twilio can't deliver webhooks; replies not detected
**Why it happens:** ngrok/tunnel URL changes each session
**How to avoid:** Use polling as primary for desktop; webhooks optional for development
**Warning signs:** Zero inbound message detection

### Pitfall 4: DnD Causes Unintended State Transitions

**What goes wrong:** Dragging candidate to "passed" column without screening
**Why it happens:** Kanban allows any drag, but state machine has guards
**How to avoid:** Validate transitions in drag handler; only allow valid drops
**Warning signs:** Candidates in invalid states

### Pitfall 5: Actor Memory Leak on Many Candidates

**What goes wrong:** App slows down with 100+ active workflows
**Why it happens:** Each actor consumes memory; old completed actors not cleaned up
**How to avoid:** Stop and remove actors for final states; limit active actors
**Warning signs:** Memory usage grows over time

### Pitfall 6: Working Hours Not Respected

**What goes wrong:** Messages sent at 2 AM
**Why it happens:** Graduation triggers immediate outreach without time check
**How to avoid:** Per CONTEXT.md: "Queue messages outside hours" - check working hours before send, delay if needed
**Warning signs:** Customer complaints about late-night messages

## Code Examples

### Database Schema Additions

```sql
-- Migration v7: Workflow persistence table
CREATE TABLE IF NOT EXISTS outreach_workflows (
  candidate_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  current_state TEXT NOT NULL,  -- Denormalized for querying
  match_score INTEGER,          -- Denormalized for sorting
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES cvs(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflows_project_state ON outreach_workflows(project_id, current_state);
CREATE INDEX IF NOT EXISTS idx_workflows_match_score ON outreach_workflows(project_id, match_score DESC);

-- Add graduated_at to cvs table for tracking graduation
ALTER TABLE cvs ADD COLUMN graduated_at TEXT;
ALTER TABLE cvs ADD COLUMN outreach_status TEXT DEFAULT 'not_graduated';

CREATE INDEX IF NOT EXISTS idx_cvs_outreach_status ON cvs(project_id, outreach_status);
```

### Graduation Flow

```typescript
// src/main/workflowService.ts
import { createActor } from "xstate";
import { outreachMachine } from "./outreachMachine";
import { saveWorkflowSnapshot } from "./workflowPersistence";
import { getDatabase } from "./database";

// Map of active workflow actors
const workflowActors = new Map<string, ReturnType<typeof createActor>>();

/**
 * Graduate a single candidate to outreach.
 * Creates workflow actor and sends GRADUATE event.
 */
export async function graduateCandidate(
  candidateId: string,
  projectId: string,
  context: {
    matchScore: number;
    candidateName: string;
    phone?: string;
    email?: string;
    escalationTimeoutMs: number;
  },
): Promise<void> {
  // Check if already graduated
  if (workflowActors.has(candidateId)) {
    console.warn(`Candidate ${candidateId} already in workflow`);
    return;
  }

  // Create actor with initial context
  const actor = createActor(outreachMachine, {
    input: {
      candidateId,
      projectId,
      ...context,
      replyDetected: false,
      replyIntent: null,
      screeningOutcome: null,
      startedAt: new Date().toISOString(),
    },
  });

  // Subscribe to state changes for persistence
  actor.subscribe((snapshot) => {
    saveWorkflowSnapshot(candidateId, snapshot);

    // Update denormalized state in workflow table
    const db = getDatabase();
    db.prepare(
      `
      UPDATE outreach_workflows SET current_state = ?, updated_at = ? WHERE candidate_id = ?
    `,
    ).run(String(snapshot.value), new Date().toISOString(), candidateId);
  });

  // Start actor
  actor.start();
  workflowActors.set(candidateId, actor);

  // Mark CV as graduated
  const db = getDatabase();
  db.prepare(
    `
    UPDATE cvs SET graduated_at = ?, outreach_status = 'graduated' WHERE id = ?
  `,
  ).run(new Date().toISOString(), candidateId);

  // Send GRADUATE event to trigger initial outreach
  actor.send({ type: "GRADUATE" });
}

/**
 * Graduate multiple candidates (batch operation).
 */
export async function graduateCandidates(
  candidateIds: string[],
  projectId: string,
  escalationTimeoutMs: number,
): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const candidateId of candidateIds) {
    try {
      // Get candidate data
      const db = getDatabase();
      const cv = db
        .prepare(
          `
        SELECT id, contact_json FROM cvs WHERE id = ? AND project_id = ?
      `,
        )
        .get(candidateId, projectId) as
        | { id: string; contact_json: string }
        | undefined;

      if (!cv) {
        failed.push(candidateId);
        continue;
      }

      const contact = JSON.parse(cv.contact_json);

      // Get match score
      const match = db
        .prepare(
          `
        SELECT match_score FROM cv_jd_matches WHERE cv_id = ? ORDER BY calculated_at DESC LIMIT 1
      `,
        )
        .get(candidateId) as { match_score: number } | undefined;

      await graduateCandidate(candidateId, projectId, {
        matchScore: match?.match_score || 0,
        candidateName: contact.name || "Unknown",
        phone: contact.phone,
        email: contact.email,
        escalationTimeoutMs,
      });

      success.push(candidateId);
    } catch (error) {
      console.error(`Failed to graduate ${candidateId}:`, error);
      failed.push(candidateId);
    }
  }

  return { success, failed };
}
```

### Workflow Store (Zustand)

```typescript
// src/renderer/stores/workflowStore.ts
import { create } from "zustand";

interface WorkflowCandidate {
  id: string;
  name: string;
  matchScore: number;
  status: string;
  phone?: string;
  email?: string;
  lastMessageAt?: string;
  lastMessageSnippet?: string;
}

interface WorkflowState {
  candidates: WorkflowCandidate[];
  selectedCandidateId: string | null;
  isLoading: boolean;

  // Actions
  loadCandidates: (projectId: string) => Promise<void>;
  selectCandidate: (id: string | null) => void;
  moveCandidateToColumn: (candidateId: string, newStatus: string) => void;
  graduateCandidate: (candidateId: string) => Promise<void>;
  graduateBatch: (candidateIds: string[]) => Promise<void>;
  pauseWorkflow: (candidateId: string) => Promise<void>;
  resumeWorkflow: (candidateId: string) => Promise<void>;
  cancelWorkflow: (candidateId: string) => Promise<void>;
  forceCall: (candidateId: string) => Promise<void>;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  candidates: [],
  selectedCandidateId: null,
  isLoading: false,

  loadCandidates: async (projectId: string) => {
    set({ isLoading: true });
    try {
      const result = await window.api.getWorkflowCandidates(projectId);
      if (result.success) {
        set({ candidates: result.data, isLoading: false });
      }
    } catch (error) {
      console.error("Failed to load workflow candidates:", error);
      set({ isLoading: false });
    }
  },

  selectCandidate: (id) => set({ selectedCandidateId: id }),

  moveCandidateToColumn: async (candidateId, newStatus) => {
    // Optimistic update
    set((state) => ({
      candidates: state.candidates.map((c) =>
        c.id === candidateId ? { ...c, status: newStatus } : c,
      ),
    }));

    // Map column to event
    const eventMap: Record<string, string> = {
      contacted: "GRADUATE",
      screening: "SKIP_TO_SCREENING",
      paused: "PAUSE",
      archived: "CANCEL",
    };

    const event = eventMap[newStatus];
    if (event) {
      await window.api.sendWorkflowEvent(candidateId, event);
    }
  },

  graduateCandidate: async (candidateId) => {
    await window.api.graduateCandidate(candidateId);
    await get().loadCandidates("current-project-id"); // Refresh
  },

  graduateBatch: async (candidateIds) => {
    await window.api.graduateCandidates(candidateIds);
    await get().loadCandidates("current-project-id"); // Refresh
  },

  pauseWorkflow: async (candidateId) => {
    await window.api.sendWorkflowEvent(candidateId, "PAUSE");
  },

  resumeWorkflow: async (candidateId) => {
    await window.api.sendWorkflowEvent(candidateId, "RESUME");
  },

  cancelWorkflow: async (candidateId) => {
    await window.api.sendWorkflowEvent(candidateId, "CANCEL");
  },

  forceCall: async (candidateId) => {
    await window.api.sendWorkflowEvent(candidateId, "FORCE_CALL");
  },
}));
```

## State of the Art

| Old Approach        | Current Approach         | When Changed | Impact                                               |
| ------------------- | ------------------------ | ------------ | ---------------------------------------------------- |
| XState v4           | XState v5                | Dec 2023     | Actor-first model, better TypeScript, `setup()` API  |
| react-beautiful-dnd | @dnd-kit                 | 2022         | react-beautiful-dnd unmaintained; dnd-kit is modular |
| Webhook-only        | Webhook + Polling hybrid | N/A          | Desktop apps can't receive webhooks reliably         |
| Manual setTimeout   | XState `after` delays    | XState v3+   | Automatic cancellation, persistence support          |

**Deprecated/outdated:**

- `XState v4 createMachine` without `setup()`: Use v5 `setup()` for type safety
- `react-beautiful-dnd`: No longer maintained; use `@dnd-kit`
- Manual state persistence: Use `getPersistedSnapshot()` built-in method

## Open Questions

1. **Webhook server for development**
   - What we know: Twilio webhooks need public URL; ngrok works for dev
   - What's unclear: Should we bundle an optional local webhook server?
   - Recommendation: Use polling as primary; webhook server is Phase 11+ enhancement

2. **ElevenLabs integration specifics**
   - What we know: CONTEXT.md mentions ElevenLabs + Twilio SIP for voice
   - What's unclear: API details, conversation flow, SIP trunking setup
   - Recommendation: Placeholder AI call actor in Phase 10; full implementation Phase 11

3. **Working hours time zone**
   - What we know: Working hours are project-configurable
   - What's unclear: Time zone handling for distributed candidates
   - Recommendation: Use project's local time zone; add candidate TZ detection later

4. **Concurrent workflow limits**
   - What we know: Each candidate = one XState actor in memory
   - What's unclear: Performance ceiling on actor count
   - Recommendation: Start with 500-actor limit; profile and adjust

## Sources

### Primary (HIGH confidence)

- [XState v5 Documentation](https://stately.ai/docs/xstate) - State machine setup, TypeScript, persistence
- [XState Delayed Transitions](https://stately.ai/docs/delayed-transitions) - `after` timeout syntax
- [XState Persistence](https://stately.ai/docs/persistence) - `getPersistedSnapshot()` and restore
- [dnd-kit Documentation](https://docs.dndkit.com/) - DndContext, Sortable, sensors
- [Twilio Messaging API](https://www.twilio.com/docs/messaging/api) - Inbound message handling
- Project codebase: `src/main/communicationService.ts`, `src/main/database.ts`

### Secondary (MEDIUM confidence)

- [LogRocket Kanban Tutorial](https://blog.logrocket.com/build-kanban-board-dnd-kit-react/) - Kanban patterns with dnd-kit
- [XState Persistence Discussion](https://github.com/statelyai/xstate/discussions/3962) - SQLite persistence patterns
- [Twilio Webhook Security](https://www.twilio.com/docs/usage/webhooks/security) - Signature validation

### Tertiary (LOW confidence)

- Community patterns for XState + Electron persistence (needs validation)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - XState v5 is official; dnd-kit already in project
- Architecture: HIGH - Patterns from official docs and existing codebase patterns
- Pitfalls: MEDIUM - Based on documentation; some edge cases may emerge in implementation
- Reply detection: MEDIUM - Webhooks require desktop app workaround; polling tested approach

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (stable libraries; XState v5 is mature)
