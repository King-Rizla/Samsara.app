---
phase: 09
plan: 03
subsystem: communication
tags: [twilio, nodemailer, sms, email, dnc, outreach-ui]
depends_on:
  requires: [09-01, 09-02]
  provides: [messaging-service, dnc-registry, outreach-section]
  affects: [10]
tech-stack:
  added:
    [
      "@radix-ui/react-select",
      "@radix-ui/react-label",
      "@radix-ui/react-alert-dialog",
    ]
  patterns: [polling, dnc-compliance]
key-files:
  created:
    - src/main/communicationService.ts
    - src/renderer/components/outreach/OutreachSection.tsx
    - src/renderer/components/outreach/CandidateTimeline.tsx
    - src/renderer/components/outreach/SendMessageDialog.tsx
    - src/renderer/components/outreach/StatusWheel.tsx
    - src/renderer/stores/outreachStore.ts
    - src/renderer/components/ui/alert-dialog.tsx
    - src/renderer/components/ui/label.tsx
    - src/renderer/components/ui/select.tsx
    - src/renderer/components/ui/textarea.tsx
  modified:
    - src/main/database.ts
    - src/main/index.ts
    - src/main/preload.ts
    - src/renderer/App.tsx
    - src/renderer/types/communication.ts
decisions:
  - key: dynamic-sdk-import
    choice: "Dynamic import for Twilio/Nodemailer"
    rationale: "Avoid loading heavy SDKs at module initialization"
  - key: polling-interval
    choice: "60 seconds"
    rationale: "Per CONTEXT.md specification, balance freshness vs API calls"
  - key: dnc-normalization
    choice: "Phone: digits only, Email: lowercase"
    rationale: "Consistent matching regardless of formatting"
metrics:
  duration: "~10 min"
  completed: "2026-02-03"
---

# Phase 9 Plan 03: SMS/Email Sending with Delivery Tracking Summary

Twilio SMS and Nodemailer email sending with 60-second delivery polling, DNC registry, and OutreachSection UI replacing wheel placeholder.

## Commits

| Task | Commit  | Description                                                                 |
| ---- | ------- | --------------------------------------------------------------------------- |
| 1    | d884d19 | Communication service with SMS/email sending, DNC check, delivery polling   |
| 2    | 90f186d | 12 IPC handlers for messaging, DNC, polling control                         |
| 3    | e73b4bf | OutreachSection UI, CandidateTimeline, SendMessageDialog, new UI primitives |

## What Was Built

### Communication Service (Task 1)

- `sendSMS()` - Twilio SMS with DNC check, logs to database
- `sendEmail()` - Nodemailer SMTP with DNC check, logs to database
- `pollDeliveryStatus()` - Fetches Twilio status, updates database
- `startDeliveryPolling()`/`stopDeliveryPolling()` - 60-second interval management
- DNC Registry: `addToDNC()`, `isOnDNC()`, `removeFromDNC()`, `getDNCList()`
- Message queries: `getMessagesByCV()`, `getMessagesByProject()`

### IPC Handlers (Task 2)

- Messaging: `send-sms`, `send-email`, `get-messages-by-cv`, `get-messages-by-project`
- DNC: `add-to-dnc`, `check-dnc`, `remove-from-dnc`, `get-dnc-list`
- Polling: `start-delivery-polling`, `stop-delivery-polling`
- Template: `render-template-with-variables`

### Outreach UI (Task 3)

- **OutreachSection**: Left panel with candidate list, right panel with timeline and actions
- **CandidateTimeline**: Expandable message cards with status badges (sent/delivered/failed)
- **SendMessageDialog**: SMS/Email tabs, template selector, character count, DNC warning
- **StatusWheel**: Visual progress indicator (0-3 segments filled)
- **outreachStore**: Zustand store for candidates, messages, DNC state, sending actions

### New UI Components

- AlertDialog (confirmation dialogs)
- Label (form labels)
- Select (dropdown selection)
- Textarea (multi-line input)

## Architecture

```
User clicks "Send SMS" in OutreachSection
        |
        v
SendMessageDialog (compose, preview, DNC check)
        |
        v
window.api.sendSMS() --> IPC --> sendSMS()
        |                            |
        v                            v
outreachStore.sendSMS()    Twilio SDK (dynamic import)
        |                            |
        v                            v
loadMessagesForCandidate() <-- INSERT INTO messages
        |
        v
CandidateTimeline (updated)
```

Delivery Polling Flow:

```
OutreachSection mount --> startDeliveryPolling(projectId)
        |
        v (every 60s)
pollDeliveryStatus() --> Twilio API --> UPDATE messages
        |
        v
OutreachSection unmount --> stopDeliveryPolling()
```

## Key Patterns

1. **Dynamic SDK Import**: Twilio and Nodemailer loaded via `await import()` only when needed
2. **DNC-First Check**: All send functions check DNC before attempting delivery
3. **Database Logging**: Every message logged with provider_message_id for status tracking
4. **Normalized Contact Values**: Phone stripped to digits, email lowercased for consistent DNC matching

## Deviations from Plan

### [Rule 3 - Blocking] Missing UI Components

- **Found during:** Task 3 implementation
- **Issue:** AlertDialog, Label, Select, Textarea components not present in UI library
- **Fix:** Created missing components using Radix UI primitives
- **Files created:** alert-dialog.tsx, label.tsx, select.tsx, textarea.tsx
- **Packages installed:** @radix-ui/react-select, @radix-ui/react-label, @radix-ui/react-alert-dialog

## Testing Notes

- All 152 existing tests pass
- SMS/email sending requires valid Twilio/SMTP credentials (configured in Phase 9-01)
- DNC check is synchronous via local SQLite query
- Polling only runs while OutreachSection is mounted

## Phase 9 Complete

All three plans executed:

- 09-01: Credential storage with safeStorage encryption
- 09-02: Template engine with variable substitution
- 09-03: SMS/email sending with delivery tracking and OutreachSection UI

Phase 9 provides the foundation for Phase 10 (Automated Outreach Sequences) with:

- Credential management for Twilio and SMTP
- Template engine for personalized messages
- Message sending and delivery status tracking
- DNC compliance built into all send operations
- UI for manual outreach management
