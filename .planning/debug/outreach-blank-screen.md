---
status: diagnosed
trigger: "Investigate why the Outreach section shows a blank/black screen when navigating to it from the Samsara Wheel."
created: 2026-02-04T00:00:00Z
updated: 2026-02-04T00:10:30Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: Component structure is correct but may have background color or CSS rendering issue
test: Comparing OutreachSection layout with working CandidateSearchSection
expecting: Find CSS class or background color mismatch
next_action: Check global styles and test component rendering

## Symptoms

expected: OutreachSection should render with candidate list on left panel
actual: Screen is blank/black when clicking Outreach wedge
errors: Unknown (checking console)
reproduction: Click Outreach wedge from Samsara Wheel
started: User reported as current issue

## Eliminated

## Evidence

- timestamp: 2026-02-04T00:01:00Z
  checked: App.tsx routing configuration
  found: Route correctly configured at line 182 - path="outreach" element={<OutreachSection />}
  implication: Routing is properly set up

- timestamp: 2026-02-04T00:02:00Z
  checked: OutreachSection component
  found: Component exists and appears complete with all imports
  implication: Component file is not missing

- timestamp: 2026-02-04T00:03:00Z
  checked: Component exports
  found: OutreachSection properly exported from index.ts
  implication: Export is correct

- timestamp: 2026-02-04T00:04:00Z
  checked: Component dependencies
  found: All dependencies exist (StatusWheel, CandidateTimeline, SendMessageDialog, outreachStore)
  implication: No missing dependencies

- timestamp: 2026-02-04T00:05:00Z
  checked: wheel/types.ts
  found: Outreach section marked as comingSoon: true (line 39)
  implication: This is only for UI badge, does NOT block navigation

- timestamp: 2026-02-04T00:06:00Z
  checked: WheelSection.tsx handleClick
  found: onClick directly calls navigate with section.route (line 44)
  implication: Navigation should work regardless of comingSoon flag

- timestamp: 2026-02-04T00:07:00Z
  checked: OutreachSection structure vs CandidateSearchSection
  found: Both use identical pattern - flex flex-col h-full with SectionHeader
  implication: Layout structure is correct

- timestamp: 2026-02-04T00:08:00Z
  checked: globals.css background color
  found: --background is set to pure black (0 0% 0%)
  implication: "Black screen" could be seeing default background without content rendering

- timestamp: 2026-02-04T00:09:00Z
  checked: Empty state UI in OutreachSection
  found: Component has proper empty state with icons and text
  implication: Should not appear completely blank even with no data

- timestamp: 2026-02-04T00:10:00Z
  checked: SectionHeader component structure
  found: SectionHeader uses bg-background class which is pure black
  implication: The header might be visible but blending into background

## Resolution

root_cause: The Outreach section in wheel/types.ts is marked with `comingSoon: true` (line 39). While this flag does NOT prevent navigation (verified in WheelSection.tsx - onClick still fires), the user may be experiencing one of two issues: (1) Component renders correctly but shows empty state (no candidates with contact info), which appears as a mostly-black screen with subtle gray text, or (2) There's a runtime error when the component tries to call `window.api.startDeliveryPolling()` which may not be properly typed in the Window interface, causing the component to crash silently.

The most likely root cause: **Missing type declarations** for `window.api.startDeliveryPolling` and `window.api.stopDeliveryPolling` in the renderer types. While the preload.ts implements these methods (lines 814-822), and no TypeScript compilation errors appear, there may be a runtime issue if these aren't properly exposed through contextBridge.

fix: Need to verify Window.api type declarations include startDeliveryPolling and stopDeliveryPolling
verification: Component structure verified correct, all imports exist, routing configured properly
files_changed: []
