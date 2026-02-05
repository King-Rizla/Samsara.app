---
phase: 10-outreach-workflow-engine
plan: 03
subsystem: ui
tags: [kanban, dnd-kit, drag-drop, zustand, react, workflow, graduation]

# Dependency graph
requires:
  - phase: 10-01
    provides: XState workflow engine, graduation IPC handlers, workflow persistence
  - phase: 10-02
    provides: Reply polling, workflow event triggers, working hours logic
  - phase: 09-03
    provides: OutreachSection component, CandidateTimeline, SendMessageDialog
provides:
  - Kanban pipeline dashboard with 6-column workflow visualization
  - Drag-and-drop candidate movement with @dnd-kit
  - Graduation controls in Match Results (individual + batch)
  - Side panel for candidate details and timeline
  - Workflow store (Zustand) for UI state management
affects: [11-ai-voice-screening, 12-ats-chrome-extension]

# Tech tracking
tech-stack:
  added: [@radix-ui/react-checkbox, @radix-ui/react-switch]
  patterns: [parent-controlled-drag-state, isPaused-visual-modifier]

key-files:
  created:
    - src/renderer/stores/workflowStore.ts
    - src/renderer/components/outreach/KanbanBoard.tsx
    - src/renderer/components/outreach/KanbanColumn.tsx
    - src/renderer/components/outreach/CandidateCard.tsx
    - src/renderer/components/outreach/CandidatePanel.tsx
    - src/renderer/components/outreach/GraduationControls.tsx
    - src/renderer/components/ui/checkbox.tsx
    - src/renderer/components/ui/switch.tsx
  modified:
    - src/renderer/components/outreach/OutreachSection.tsx
    - src/renderer/components/jd/MatchResults.tsx
    - src/renderer/components/queue/QueueItem.tsx
    - src/renderer/stores/queueStore.ts
    - src/renderer/types/cv.ts
    - src/main/database.ts
    - src/main/preload.ts

key-decisions:
  - "Paused as visual modifier, not separate column"
  - "Free drag-drop (recruiters have full manual override)"
  - "Parent-controlled isOver state for consistent highlighting"
  - "Auto-retry when dragging out of Failed column"
  - "rectIntersection collision detection for reliability"

patterns-established:
  - "Parent-controlled drag state: Board tracks overColumnId and passes isOver prop to columns"
  - "isPaused modifier: Boolean flag on WorkflowCandidate, card stays in current column with badge"
  - "Immediate UI update: Call queueStore.updateOutreachStatus after graduation IPC"

# Metrics
duration: 45min
completed: 2026-02-04
---

# Phase 10 Plan 03: Kanban Pipeline Dashboard Summary

**Drag-and-drop Kanban board with @dnd-kit for outreach workflow visualization, graduation controls in Match Results, and side panel for candidate details**

## Performance

- **Duration:** 45 min
- **Started:** 2026-02-04T18:30:00Z
- **Completed:** 2026-02-04T19:55:00Z
- **Tasks:** 3 + checkpoint + UAT fixes
- **Files modified:** 17

## Accomplishments

- 6-column Kanban board (Pending, Contacted, Replied, Screening, Passed, Failed/Archived)
- Free drag-and-drop with smooth column highlighting during hover
- Graduation UI in Match Results: checkboxes, individual/batch graduation, "Graduated" badge
- Side panel with candidate details, contact info copy, message timeline, workflow actions
- Paused as visual modifier (amber badge) - candidates stay in current column
- Auto-retry when dragging candidates out of Failed column
- Failed CV retry button in queue list

## Task Commits

Each task was committed atomically:

1. **Task 1: Create workflow store and Kanban board structure** - `24b6e38` (feat)
2. **Task 2: Create candidate card and side panel components** - `57e3000` (feat - included in 10-02 by linter)
3. **Task 3: Integrate Kanban into OutreachSection and graduation** - `34072a5` (feat)

**UAT fixes:**

- `6169a2d` - fix: UAT feedback (badge delay, retry button, paused behavior, drag freedom)
- `221642b` - fix: drag-drop column highlighting consistency
- `6e0d213` - feat: auto-retry when dragging from Failed column

## Files Created/Modified

**Created:**

- `src/renderer/stores/workflowStore.ts` - Zustand store for workflow candidates and actions
- `src/renderer/components/outreach/KanbanBoard.tsx` - DndContext with 6 columns
- `src/renderer/components/outreach/KanbanColumn.tsx` - Droppable column with highlight state
- `src/renderer/components/outreach/CandidateCard.tsx` - Draggable card with useSortable
- `src/renderer/components/outreach/CandidatePanel.tsx` - Sheet with details and timeline
- `src/renderer/components/outreach/GraduationControls.tsx` - Batch graduation UI
- `src/renderer/components/ui/checkbox.tsx` - Radix checkbox component
- `src/renderer/components/ui/switch.tsx` - Radix switch component

**Modified:**

- `src/renderer/components/outreach/OutreachSection.tsx` - Replaced list with KanbanBoard
- `src/renderer/components/jd/MatchResults.tsx` - Added graduation UI
- `src/renderer/components/queue/QueueItem.tsx` - Added retry button for failed CVs
- `src/renderer/stores/queueStore.ts` - Added updateOutreachStatus, retrySingle
- `src/renderer/types/cv.ts` - Added outreachStatus, graduatedAt fields
- `src/main/database.ts` - CVSummary includes outreach_status
- `src/main/preload.ts` - CVSummary type updated

## Decisions Made

| Decision            | Choice                         | Rationale                                                        |
| ------------------- | ------------------------------ | ---------------------------------------------------------------- |
| Paused behavior     | Visual modifier, not column    | Pausing shouldn't change pipeline position                       |
| Drag restrictions   | Free movement except TO Failed | Recruiters need manual override for out-of-band comms            |
| Collision detection | rectIntersection               | More reliable than closestCorners for area detection             |
| Highlight state     | Parent-controlled              | useDroppable isOver was glitchy, board-level state is consistent |
| Failed drag-out     | Auto-retry                     | Intuitive: dragging out = "give another chance"                  |
| Badge update        | Immediate via queueStore       | No refresh needed after graduation                               |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Immediate graduated badge update**

- **Found during:** UAT checkpoint verification
- **Issue:** Graduated badge required page refresh to appear
- **Fix:** Call queueStore.updateOutreachStatus immediately after graduation IPC returns
- **Files modified:** src/renderer/stores/workflowStore.ts
- **Committed in:** 6169a2d

**2. [Rule 2 - Missing Critical] Failed CV retry button**

- **Found during:** UAT checkpoint verification
- **Issue:** Failed CVs had no way to retry processing
- **Fix:** Added retrySingle action to queueStore, retry button to QueueItem
- **Files modified:** src/renderer/stores/queueStore.ts, src/renderer/components/queue/QueueItem.tsx
- **Committed in:** 6169a2d

**3. [Rule 1 - Bug] Paused state moving to wrong column**

- **Found during:** UAT checkpoint verification
- **Issue:** Pausing moved candidate to Contacted column instead of staying in place
- **Fix:** Changed paused to isPaused boolean modifier, candidates stay in current column
- **Files modified:** src/renderer/stores/workflowStore.ts, src/renderer/components/outreach/CandidateCard.tsx
- **Committed in:** 6169a2d

**4. [Rule 1 - Bug] Drag-drop too restrictive**

- **Found during:** UAT checkpoint verification
- **Issue:** VALID_TRANSITIONS map blocked legitimate recruiter overrides
- **Fix:** Removed restrictions, allow free movement (except TO Failed)
- **Files modified:** src/renderer/stores/workflowStore.ts, src/renderer/components/outreach/KanbanBoard.tsx
- **Committed in:** 6169a2d

**5. [Rule 1 - Bug] Glitchy column highlighting during drag**

- **Found during:** UAT checkpoint verification
- **Issue:** useDroppable isOver state was inconsistent/flickering
- **Fix:** Parent-controlled overColumnId state, onDragOver tracking, pointer-events-none during drag
- **Files modified:** src/renderer/components/outreach/KanbanBoard.tsx, src/renderer/components/outreach/KanbanColumn.tsx
- **Committed in:** 221642b

---

**Total deviations:** 5 auto-fixed (2 missing critical, 3 bugs)
**Impact on plan:** All fixes essential for usability. No scope creep - all related to core Kanban functionality.

## Issues Encountered

- @dnd-kit closestCorners collision detection unreliable with cards inside droppable - switched to rectIntersection with parent-controlled state
- CandidateCard and CandidatePanel were auto-committed with 10-02 by lint-staged during Task 1 commit

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 11 (AI Voice Screening):**

- Kanban pipeline shows candidate workflow state
- Side panel displays message timeline for context
- Workflow store provides actions for state transitions
- "Force Call" action button ready in card menu

**Deferred tests now verified:**

- View graduated candidates in Outreach Kanban
- Select candidate and view timeline in side panel
- Graduation from Match Results works (individual + batch)
- Paused candidates show badge while staying in column
- Drag-drop moves candidates with smooth highlighting

---

_Phase: 10-outreach-workflow-engine_
_Completed: 2026-02-04_
