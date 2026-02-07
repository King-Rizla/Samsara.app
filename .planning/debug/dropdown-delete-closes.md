---
status: diagnosed
trigger: "Investigate why clicking Delete on a template closes the dropdown menu and requires re-opening to confirm."
created: 2026-02-04T00:00:00Z
updated: 2026-02-04T00:00:00Z
---

## ROOT CAUSE IDENTIFIED

### The Problem

When user clicks "Delete" in the dropdown menu for the first time, the dropdown menu closes instead of staying open to show "Click again to confirm". The user must re-open the menu to complete the deletion.

### Root Cause Mechanism

**Location:** `src/renderer/components/templates/TemplateList.tsx` lines 210-221

The issue is in how Radix UI's DropdownMenu works combined with the two-click confirmation flow:

1. User clicks "Delete" → `handleDelete(template.id)` executes (line 214)
2. `handleDelete` sets `deleteConfirmId = template.id` (line 64)
3. Component re-renders with new state
4. **BUT**: Radix UI's `DropdownMenuContent` default behavior closes the menu when ANY `DropdownMenuItem` is clicked (by design - it's the documented behavior)
5. The menu closes BEFORE the visual confirmation text can render

### Why This Happens

Radix UI DropdownMenu has a `closeOnEscape` prop and automatically closes on item selection. When you click a `DropdownMenuItem`, by default Radix closes the menu. The component state updates ARE happening (deleteConfirmId is set), but you can't see the updated "Click again to confirm" text because the menu has already animated away.

### Evidence

**File:** `src/renderer/components/templates/TemplateList.tsx`

- Lines 210-221: Delete menu item with onClick handler
- Line 212: `onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }`
- Lines 218-220: Conditional text display: `{deleteConfirmId === template.id ? "Click again to confirm" : "Delete"}`

The logic for 2-click confirmation EXISTS but is hidden by the menu closing.

### What Needs to Change

To achieve seamless 2-click delete while keeping the menu open:

1. **Add `closeOnEscape` prop to DropdownMenuContent** - allows Escape to close, but not clicking items
2. **Or: Use `onOpenChange` callback** - manually control when menu closes
3. **Or: Use `shouldCloseOnInteractOutside`** - from Radix UI to prevent auto-close on item click
4. **Or: Extract delete confirmation to a separate confirmation dialog** - not inline

### Missing Implementation Details

The current implementation expects:

- Menu stays open after first delete click ❌ (doesn't happen)
- Text changes to "Click again to confirm" ✓ (happens, but invisible)
- Second click completes deletion ✓ (logic works, never reached because menu closed)

### Recommended Fix Direction

**Option A (Minimal):** Pass `onOpenChange` to detect menu state and only allow close after confirmation completes
**Option B (Better UX):** Use a separate ConfirmationDialog component (AlertDialog pattern) triggered from the dropdown - gives user clear visual affordance that confirmation is required

**Current Code Pattern:** Inline two-click with hidden state
**Better Pattern:** Explicit confirmation dialog modal (clearer to users, standard UX pattern)
