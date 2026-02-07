---
status: diagnosed
trigger: "TemplateEditor header is overcrowded. The save button is half off the screen and the x overlaps on the save button."
created: 2026-02-04T00:00:00Z
updated: 2026-02-04T00:00:00Z
---

## Current Focus

hypothesis: Header has insufficient space allocation. Left side (title + toggles + dropdown) takes too much space, causing right-side buttons (Cancel/Save) to overflow or overlap.
test: Analyze flex container and child element sizing
expecting: Find width constraint issue or missing flex-shrink settings
next_action: Examine the header structure and flex properties in detail

## Symptoms

expected: Header layout with title, controls on left, and Cancel/Save buttons properly positioned on right without overlap
actual: Save button appears half off-screen, X (Cancel) button overlaps with Save button
errors: None reported, visual layout issue
reproduction: Open TemplateEditor (create new template)
started: Unknown if regression or always present

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-04
  checked: TemplateEditor.tsx lines 170-229 (header structure)
  found: Header is a flex container with `justify-between` splitting left and right sections
  implication: Layout strategy is sound (space-between), but content on left or right may need constraints

- timestamp: 2026-02-04
  checked: Left side content (lines 174-207)
  found: |
  - Title (h2)
  - Type toggle (Button group, only for new templates)
  - VariableDropdown (conditional)
    These use `flex items-center gap-4` with no width constraints
    implication: Left side can grow unbounded, pushing right-side buttons off-screen

- timestamp: 2026-02-04
  checked: Right side content (lines 210-228)
  found: |
  - Cancel button (Button, size="sm")
  - Save button (Button, size="sm")
    These use `flex items-center gap-2` with no width constraints
    implication: Right-side buttons have fixed size but no flex-shrink protection

- timestamp: 2026-02-04
  checked: ProjectLayout.tsx line 121 (TemplateEditor parent container)
  found: TemplateEditor is inside SheetContent with `className="w-full sm:max-w-2xl p-0"`
  implication: Parent Sheet has max-width constraint, but TemplateEditor still doesn't respect it

- timestamp: 2026-02-04
  checked: sheet.tsx lines 33-50 (Sheet styling)
  found: |
  SheetContent for "right" side: "w-3/4 border-l ... sm:max-w-sm"
  ProjectLayout overrides with: "w-full sm:max-w-2xl"
  Max width for right sheet is 2xl (28rem = 448px on sm+)
  implication: Container IS constrained, but TemplateEditor header doesn't adapt to this width

- timestamp: 2026-02-04
  checked: TemplateEditor.tsx line 173 header container classes
  found: "flex items-center justify-between p-4 border-b border-border"
  missing: |
  - No `flex-wrap` or `flex-shrink` on parent
  - No `min-w-0` on children to allow text truncation
  - No `flex-shrink` or `overflow-hidden` on left/right side containers
    implication: When sheet width is 448px (2xl), header content cannot shrink/wrap, causing overflow

## Resolution

root_cause: Header lacks proper flex constraints for responsive layout. The header (line 173) uses `flex items-center justify-between p-4` but:

1. Left-side wrapper (line 174) has `flex items-center gap-4` with NO `flex-shrink` or `min-w-0`, allowing it to expand unbounded
2. h2 title (line 175) has no width constraint or text truncation
3. Type toggle (line 181) has no `flex-shrink` constraint
4. VariableDropdown (line 203) has no `flex-shrink` constraint
5. Right-side wrapper (line 210) has `flex items-center gap-2` with NO `flex-shrink-0`, allowing buttons to be pushed off-screen

When sheet width is 448px (sm:max-w-2xl), the left-side controls consume all available space, pushing the Cancel/Save buttons beyond the right edge and causing visual overlap.

fix: Add flex shrinking and min-width constraints to allow responsive adaptation to sheet width

1. Left-side wrapper: Add `flex-shrink min-w-0` to allow shrinking
2. h2 title: Add `truncate` to prevent text overflow
3. Right-side wrapper: Add `flex-shrink-0` to prevent buttons being pushed off
4. Consider: Type toggle and VariableDropdown may need conditional hiding on small widths

verification: (pending implementation)
files_changed: []
