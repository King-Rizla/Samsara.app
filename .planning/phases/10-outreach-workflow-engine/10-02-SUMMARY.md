---
phase: 10-outreach-workflow-engine
plan: 02
subsystem: workflow-engine
tags: [twilio, sms, polling, intent-classification, working-hours, callbacks]

dependency_graph:
  requires: [10-01]
  provides:
    - reply-polling-service
    - intent-classification
    - working-hours-check
    - project-outreach-settings
    - callback-scheduling
  affects: [10-03, 11-xx]

tech_stack:
  added:
    - twilio (dynamic import for SMS polling)
  patterns:
    - polling-based reply detection
    - keyword intent classification
    - working hours message queueing
    - XState actors for callback scheduling

key_files:
  created:
    - src/main/replyPoller.ts
    - src/main/workingHours.ts
    - src/main/callbackScheduler.ts
  modified:
    - src/main/database.ts
    - src/main/workflowMachine.ts
    - src/main/index.ts
    - src/main/preload.ts

decisions:
  - key: intent-classification
    choice: keyword-based
    rationale: Simple, predictable, low latency - ambiguous replies treated as positive per CONTEXT.md

metrics:
  duration: 10 min
  completed: 2026-02-04
---

# Phase 10 Plan 02: Reply Polling and Workflow Triggers Summary

Reply polling service with keyword-based intent classification, working hours message queueing, and post-failed-screening callback scheduling.

## One-liner

Twilio SMS polling every 30s with positive/negative/ambiguous intent classification, project working hours config, and WRK-05 callback scheduling flow.

## What Was Built

### 1. Reply Polling Service (`replyPoller.ts`)

- **Keywords**: 17 negative terms (stop, unsubscribe, not interested...), 27 positive terms (yes, interested, call me...)
- **Intent Classification**: `classifyIntent(body)` returns 'positive' | 'negative' | 'ambiguous'
- **Polling**: `pollInboundMessages(projectId)` queries Twilio API for inbound SMS from last 30 minutes
- **Processing**: `processInboundMessages()` matches by phone number, classifies intent, sends REPLY_DETECTED events
- **Lifecycle**: `startReplyPolling(projectId)` / `stopReplyPolling()` with 30-second interval

### 2. Working Hours Service (`workingHours.ts`)

- **Config Interface**: `WorkingHoursConfig` with enabled, start/end times, timezone, work days
- **Hours Check**: `isWithinWorkingHours(config, checkTime?)` uses Intl.DateTimeFormat for timezone handling
- **Next Start**: `getNextWorkingHoursStart(config)` calculates next valid business hours start
- **Message Queueing**: `queueMessageForWorkingHours()` returns `{ send: true }` or `{ send: false, scheduledFor }`
- **Settings CRUD**: `getProjectOutreachSettings()` / `updateProjectOutreachSettings()` with defaults

### 3. Callback Scheduler (`callbackScheduler.ts`)

- **Slot Generation**: `generateCallbackSlots(projectId, count)` finds available 30-minute slots during working hours
- **Scheduling**: `scheduleCallback(candidateId, projectId, slotTime)` creates confirmed callback slot
- **Options SMS**: `sendCallbackOptions()` sends "Reply 1, 2, or 3" format with time slot options
- **Reply Processing**: `processCallbackReply()` parses 1/2/3 or formatted time, confirms callback
- **Confirmation**: Sends CALLBACK_CONFIRMED event to workflow, notifies recruiter

### 4. Database Migration v8

- `project_outreach_settings`: escalation_timeout_ms, ai_call_enabled, working hours config
- `message_queue`: pending messages scheduled for working hours delivery
- `callback_slots`: confirmed callback appointments with status tracking
- `pending_callback_requests`: tracks offered time slots for reply parsing
- Unique index on `messages.provider_message_id` for idempotent processing

### 5. Workflow Machine Updates

- **New States**: `scheduling_callback`, `callback_scheduled`
- **New Events**: `CALLBACK_CONFIRMED`, `CALLBACK_TIMEOUT`
- **Failed State**: REPLY_DETECTED now transitions to `scheduling_callback`
- **sendCallbackOptionsActor**: Invokes callback scheduling flow
- **Working Hours Check**: `sendInitialMessages` actor checks hours before sending

### 6. IPC Handlers

- `start-reply-polling` / `stop-reply-polling`: Control polling lifecycle
- `get-project-outreach-settings` / `update-project-outreach-settings`: Settings CRUD

## Key Implementation Details

### Intent Classification Logic

```typescript
// Check negative first (more specific opt-out signals)
for (const keyword of NEGATIVE_KEYWORDS) {
  if (normalized.includes(keyword)) return "negative";
}
// Check positive
for (const keyword of POSITIVE_KEYWORDS) {
  if (normalized.includes(keyword)) return "positive";
}
// Default to ambiguous (treated as positive per CONTEXT.md)
return "ambiguous";
```

### Working Hours Check

Uses `Intl.DateTimeFormat` with timezone option to correctly handle business hours across timezones. Message queueing stores scheduled delivery time in `message_queue` table.

### Callback Slot Parsing

Accepts both numeric replies ("1", "2", "3") and formatted time strings ("Mon 2pm") for flexibility.

## Commits

| Hash    | Type | Description                                      |
| ------- | ---- | ------------------------------------------------ |
| d2d4850 | feat | Reply polling with intent classification         |
| 57e3000 | feat | Working hours check for workflow messages        |
| 76c28f8 | feat | Wire reply polling and settings to IPC           |
| d0b0a61 | feat | Callback scheduling states for workflow (WRK-05) |

## Deviations from Plan

None - plan executed exactly as written.

## Testing Notes

- 152 existing tests pass
- Pre-existing TypeScript errors in test files and forge.config.ts (unrelated to this plan)
- Manual testing required:
  - Configure Twilio credentials
  - Verify reply polling starts on OutreachSection mount
  - Test intent classification with various message bodies
  - Test working hours queueing with different timezone configs

## Next Phase Readiness

### 10-03: Kanban UI and Graduation Controls

- Workflow service and persistence ready
- Reply polling provides real-time state updates
- Settings accessible via IPC for UI configuration

### Dependencies Provided

- `startReplyPolling` / `stopReplyPolling` for OutreachSection lifecycle
- `getProjectOutreachSettings` / `updateProjectOutreachSettings` for settings UI
- `classifyIntent` for manual reply testing in UI
- `callback_scheduled` state for Kanban column display

---

_Phase: 10-outreach-workflow-engine_
_Plan: 02_
_Completed: 2026-02-04_
