# Roadmap: Samsara

## Milestones

- **v1 The Sovereign Formatter** — Phases 1-7, 14 phases, 44 plans (shipped 2026-01-30) → [Archive](milestones/v1-ROADMAP.md)

## Remaining v1 Work

### Phase 6: Bulk Processing & OS Integration

**Goal**: Process 100+ CVs simultaneously with OS-level integration
**Depends on**: Phase 7 (complete)
**Requirements**: F-01a, F-01b
**Success Criteria** (what must be TRUE):

1. User can drag-and-drop a folder containing 100+ PDF/DOCX files and see queue progress
2. User can right-click files in Windows/macOS Explorer and select "Format with Samsara"
3. Bulk processing completes 100 CVs without memory growth or crashes
4. Individual file failures do not stop the batch (error logged, processing continues)
5. Batch IPC sends 10-50 file paths per message (not one-by-one)
   **Plans**: 3 plans in 3 waves

Plans:

- [ ] 06-01-PLAN.md — Drag-drop queue with progress tracking
- [ ] 06-02-PLAN.md — Batch IPC and memory management
- [ ] 06-03-PLAN.md — OS context menu integration (Windows/macOS)

---

_Roadmap created: 2026-01-23_
_v1 archived: 2026-01-30_
