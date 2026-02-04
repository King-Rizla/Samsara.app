---
phase: 10-outreach-workflow-engine
plan: 01
subsystem: workflow-orchestration
tags: [xstate, state-machine, persistence, graduation, ipc]

dependency-graph:
  requires: [09-communication-infrastructure]
  provides: [xstate-workflow-machine, graduation-flow, workflow-persistence]
  affects: [10-02-kanban-ui, 10-03-reply-detection]

tech-stack:
  added: [xstate@5.26.0, @xstate/react@6.0.0]
  patterns: [state-machine, actor-model, snapshot-persistence]

file-tracking:
  created:
    - src/main/workflowMachine.ts
    - src/main/workflowPersistence.ts
    - src/main/workflowService.ts
  modified:
    - src/main/database.ts
    - src/main/index.ts
    - src/main/preload.ts
    - package.json

decisions:
  - choice: TypeScript upgrade to 5.6
    rationale: XState v5 requires TS 5+ for type definitions
  - choice: Snapshot persistence on every state change
    rationale: Ensures durability across app restarts
  - choice: Actor-per-candidate model
    rationale: Each workflow instance is independent and can be persisted individually

metrics:
  duration: ~15 min
  completed: 2026-02-04
  tests-passing: 152/152
---

# Phase 10 Plan 01: XState Workflow Engine Summary

XState v5 state machine with SQLite persistence for outreach workflow orchestration and candidate graduation flow.

## One-liner

XState v5 state machine (pending->contacted->replied->screening->passed/failed) with SQLite snapshot persistence and IPC graduation APIs.

## What Was Built

### 1. XState v5 Workflow Machine (`workflowMachine.ts`)

- **States**: pending, contacted, replied, screening, passed, failed, paused, archived
- **Actions**: sendInitialOutreach, markReplied, markScreeningStarted, markCompleted
- **Guards**: hasPhone, hasEmail, isPositiveReply, aiCallEnabled
- **Actors**: sendInitialMessages (SMS+email via communicationService), triggerAICall (placeholder for Phase 11)
- **Dynamic delays**: escalationTimeout from context (default 30 min)
- Uses `setup()` pattern for strongly-typed machine
- Imports sendSMS/sendEmail directly from communicationService (no context passing)

### 2. Workflow Persistence (`workflowPersistence.ts`)

- `saveWorkflowSnapshot()`: INSERT OR REPLACE with JSON-serialized XState snapshot
- `loadWorkflowSnapshot()`: Retrieve and parse snapshot for actor restoration
- `restoreActiveWorkflows()`: On app startup, restore non-final workflows
- `executeMissedEscalations()`: Check elapsed time, trigger TIMEOUT for overdue workflows
- `getWorkflowsByProject()`: Query workflows for UI display
- `getWorkflowCandidate()`: Full workflow data for detail view

### 3. Workflow Service (`workflowService.ts`)

- Actor management with `Map<string, WorkflowActor>`
- `graduateCandidate()`: Create actor, start, send GRADUATE event, update CV record
- `graduateCandidates()`: Batch graduation with success/failed arrays
- `sendWorkflowEvent()`: Dispatch events to running actors
- Helper functions: pauseWorkflow, resumeWorkflow, cancelWorkflow, forceCall, skipToScreening
- `initializeWorkflows()`: Called on app startup
- `stopAllWorkflows()`: Called on app shutdown

### 4. Database Migration v7

- `outreach_workflows` table with snapshot_json, current_state, match_score
- Indexes on project_id+current_state and project_id+match_score DESC
- Added `graduated_at` and `outreach_status` columns to cvs table
- Index on cvs(project_id, outreach_status)

### 5. IPC Handlers

- `graduate-candidate`: Single candidate graduation
- `graduate-candidates`: Batch graduation
- `send-workflow-event`: Dispatch PAUSE, RESUME, CANCEL, FORCE_CALL, etc.
- `get-workflows-by-project`: List workflows for project
- `get-workflow-candidate`: Full workflow data for detail view

## Key Files

| File                              | Purpose                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| `src/main/workflowMachine.ts`     | XState v5 machine definition with all states, actions, guards |
| `src/main/workflowPersistence.ts` | SQLite snapshot save/restore, missed escalation handling      |
| `src/main/workflowService.ts`     | Actor management, graduation functions, event dispatching     |
| `src/main/database.ts`            | Migration v7 for outreach_workflows table                     |
| `src/main/index.ts`               | IPC handlers and workflow initialization                      |
| `src/main/preload.ts`             | Exposed APIs for renderer                                     |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript upgrade to 5.6**

- **Found during:** Task 1
- **Issue:** XState v5 type definitions require TypeScript 5+ features not supported by TS 4.5
- **Fix:** Upgraded TypeScript from ~4.5.4 to ~5.6.0
- **Files modified:** package.json
- **Commit:** d7698c7

**2. [Rule 1 - Bug] Missing completeCVProcessing import**

- **Found during:** Task 1
- **Issue:** index.ts referenced completeCVProcessing without importing it
- **Fix:** Added to imports from database.ts
- **Files modified:** src/main/index.ts
- **Commit:** d7698c7

## Verification

```bash
# TypeScript compiles
npm run typecheck  # Pre-existing errors only, no workflow errors

# Tests pass
npm test  # 152/152 tests passing

# Files exist
ls src/main/workflow*.ts  # 3 files present

# Packages installed
npm ls xstate @xstate/react  # xstate@5.26.0, @xstate/react@6.0.0
```

## What's Next

Plan 10-02 will build the Kanban UI:

- Kanban pipeline view (Pending -> Contacted -> Replied -> Screening -> Passed/Failed columns)
- Candidate cards with match %, status, last message snippet
- Drag-drop transitions (with validation)
- Graduation controls in Match Results
- Side panel for workflow details

## Commits

| Hash    | Message                                                        |
| ------- | -------------------------------------------------------------- |
| d7698c7 | feat(10-01): add XState v5 state machine for outreach workflow |
| fdb5cc5 | feat(10-01): add workflow persistence and service layers       |
| e2fa6d1 | feat(10-01): wire IPC handlers for workflow operations         |
