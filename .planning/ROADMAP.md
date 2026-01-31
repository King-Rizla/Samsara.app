# Roadmap: Samsara

## Milestones

- **v1 The Sovereign Formatter** — Phases 1-7, 14 phases, 44 plans (shipped 2026-01-30) → [Archive](milestones/v1-ROADMAP.md)

## Remaining v1 Work

### Phase 6: Bulk Processing & OS Integration

**Goal**: Process 100+ CVs simultaneously via folder drag-drop with batch IPC and virtualized queue UI
**Depends on**: Phase 7 (complete)
**Requirements**: F-01a, F-01b
**Success Criteria** (what must be TRUE):

1. User can drag-and-drop a folder containing 100+ PDF/DOCX files and see queue progress
2. Bulk processing completes 100 CVs without memory growth or crashes
3. Individual file failures do not stop the batch (error logged, processing continues)
4. Batch IPC sends file paths in chunks (not one-by-one)
5. QueueList is virtualized for smooth scrolling at 100+ items
   **Plans**: 2 plans in 2 waves

Plans:

- [ ] 06-01-PLAN.md — Folder drag-drop with recursive scanning, batch IPC handler, confirmation dialog
- [ ] 06-02-PLAN.md — List virtualization, retry-all-failed, batch summary notification

_Note: OS context menu integration (right-click "Format with Samsara") deferred to future phase._

---

_Roadmap created: 2026-01-23_
_v1 archived: 2026-01-30_
