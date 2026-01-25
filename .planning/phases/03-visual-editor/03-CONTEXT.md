# Phase 3: Visual Editor - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Queue management interface with three tabs (Completed, Submitted, Failed) for tracking CV extraction status. Users can view extraction results and edit parsed fields. **Note:** Original documents are not displayed — only raw text is stored.

This phase also establishes the **visual design system** for the entire project.

</domain>

<decisions>
## Implementation Decisions

### Tab Structure & Queue
- Items display: Filename | Filetype (stage indicator replaces ETA during processing)
- Tab transitions: Brief highlight (success/fail color) for 1-2s, then item moves to appropriate tab
- Tab counts: Session totals (resets when app restarts)
- Multi-select: Checkboxes on each item + shift-click range selection for power users

### Failed State Handling
- Error display: Simple human-readable message ("Failed to parse", "Extraction timeout") — no technical details
- Retry: Manual retry button per item, or bulk retry via multi-select
- Partial failures: Treated as failed (all or nothing — no partial success state)
- Cleanup: Delete individual items or bulk delete via selection

### Processing Feedback (Submitted Tab)
- Progress indicator: Stage text ("Parsing..." → "Extracting..." → "Saving...") — no progress bar or ETA
- Cancel: Individual items can be cancelled mid-processing
- Parallelism: 2-3 CVs process simultaneously

### Visual Design System (Project-Wide)
- **Aesthetic:** Terminal style — dark background (black), white text, monospace font
- **Font:** JetBrains Mono
- **Brand colors:** Samsara purple/magenta used for accent highlights only (selected items, active states, focus)
- **Status colors:** Yellow/orange (Submitted), Green (Completed), Red (Failed)
- **Interactive elements:** Outlined/bordered with transparent fill, highlight on hover
- **Motion:** Subtle only — quick fades for transitions, smooth scrolling
- **Icons:** Text labels for main actions, icons only in compact areas (row actions, toolbars)
- **Theme:** Dark mode only (no light mode option)
- **Chrome:** Minimal titlebar with just window controls — maximize content space

### Claude's Discretion
- Exact spacing and layout proportions
- Field editing interaction (inline vs modal) — not discussed
- Specific icon set to use
- Exact hex values for status/brand colors (within described palette)

</decisions>

<specifics>
## Specific Ideas

- "This tool is here to do a job" — utilitarian, function over form
- Terminal aesthetic like a Bloomberg terminal energy — information-dense, professional
- Samsara brand: dark purple + magenta on black background with white text
- Tab colors specifically: yellow/orange for pending, green for success, red for failures

</specifics>

<deferred>
## Deferred Ideas

- **Projects concept** — Outer layer with "project tabs" containing scraper config + parser + rater per project. Self-contained CV groups. → Future phase (architectural change)
- **Original document display** — Not in scope; only raw text is stored, not the original PDF/DOCX
- **Field editing UX** — Not discussed in detail; Claude has discretion on implementation

</deferred>

---

*Phase: 03-visual-editor*
*Context gathered: 2026-01-25*
