# Phase 08 Plan 01: Nested Routing Foundation Summary

**One-liner:** Refactored flat routing into nested routes with ProjectLayout, extracted M1 features into CandidateSearchSection, installed motion for animations.

## Tasks Completed

| #   | Task                                                                 | Commit  | Key Files                                                               |
| --- | -------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| 1   | Install motion and create section scaffolds                          | 58a12b0 | package.json, SectionHeader.tsx, PlaceholderSection.tsx                 |
| 2   | Create ProjectLayout, extract CandidateSearchSection, rewire routing | 2af5b86 | ProjectLayout.tsx, CandidateSearchSection.tsx, ProjectView.tsx, App.tsx |

## What Was Built

- **ProjectLayout** (`src/renderer/routes/ProjectLayout.tsx`): Shared layout with project header, store initialization (selectProject, loadFromDatabase, loadJDs, clearActiveJD), LLMSettings panel, and AnimatePresence-wrapped Outlet for route transitions.
- **CandidateSearchSection** (`src/renderer/components/sections/CandidateSearchSection.tsx`): All M1 features (QueueTabs, JDPanel, CVEditor, ErrorDetailPanel, JDDetail) extracted from the old ProjectView.
- **SectionHeader** (`src/renderer/components/sections/SectionHeader.tsx`): Back-to-wheel navigation button with section title.
- **PlaceholderSection** (`src/renderer/components/sections/PlaceholderSection.tsx`): Coming Soon placeholder for unbuilt sections.
- **ProjectView** (`src/renderer/routes/ProjectView.tsx`): Stripped to wheel placeholder (Plan 02 replaces content).
- **Nested routing** in App.tsx: 6 routes under `/project/:id` (index, search, outreach, coordination, data-entry, business-dev).

## Decisions Made

| Decision                                                       | Rationale                                                   |
| -------------------------------------------------------------- | ----------------------------------------------------------- |
| LLMSettings stays in ProjectLayout, not CandidateSearchSection | It's a project-level concern, not section-specific          |
| Settings panel renders above Outlet (not as third column)      | Simpler layout; settings don't compete with section content |
| motion@12.29.2 installed (not framer-motion)                   | motion is the new package name for framer-motion            |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- motion@12.29.2 installed: confirmed via `npm ls motion`
- TypeScript: no errors in source files (`npx tsc --noEmit`)
- Tests: 152/152 passing (`npx vitest run`)
- All nested routes configured in App.tsx

## Next Phase Readiness

Plan 02 (Samsara Wheel component) can now:

- Render inside ProjectView (index route of ProjectLayout)
- Use motion/react for animations (already installed)
- Navigate to section routes via `/project/:id/{section}`
- Rely on store initialization happening in ProjectLayout
