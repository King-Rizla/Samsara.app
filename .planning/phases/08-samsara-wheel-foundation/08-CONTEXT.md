# Phase 8: Samsara Wheel & Foundation - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Users navigate between recruitment workflow sections via the Samsara Wheel — a circular navigation component with 5 sections + Yama hub. All M1 features migrate into the Candidate Search section. SQLite schema extends with all M2 tables. Non-search sections show "Coming Soon" placeholders. Yama hub is visual placeholder only.

</domain>

<decisions>
## Implementation Decisions

### Wheel Visual Design

- Elevated visual — richer than terminal aesthetic. Allow gradients, glows, subtle decorative rings on dark background
- Subtle Bhavachakra references — decorative ring patterns inspired by the Wheel of Life, but modern. Not literal Buddhist iconography
- Explore a Yama-like figure holding the wheel if it fits the design (may be cut if it doesn't work visually)
- Each wedge gets its own distinct muted/pastel accent color (e.g. soft blue for search, soft green for outreach)
- Dominant center placement — wheel fills most of the project view (~500px diameter)
- Yama hub: eye icon with subtle breathing pulse every 3-4 seconds, "Coming Soon" label

### Section Transition Behavior

- Click a wedge → wheel fades out, section content expands from the wedge position outward (Framer Motion layout animation)
- No mini-wheel or quick-switch nav — always return to wheel to switch sections
- Back button/breadcrumb at top of section view to return to wheel
- Returning to wheel: reverse animation (content collapses back, wheel fades in)

### Status Indicators

- Stats appear on hover tooltip only — clean wheel surface at rest
- Unbuilt sections (Client Coordination, Data Entry, Business Dev) show "Coming Soon" badge
- Candidate Search shows: candidates in pipeline (total CVs in project)
- Candidate Outreach shows placeholder stats (awaiting contact: 0, etc) once built in Phase 9+

### M1 Migration

- Project sidebar stays — navigates between projects, each links to the wheel
- Always wheel first — clicking a project in sidebar always lands on the wheel
- Candidate Search section contains all existing M1 features (CV parsing, JD matching, branding, bulk)
- Minor visual cleanup of existing features to match elevated wheel aesthetic — not a redesign
- Routing: Claude's discretion on URL structure (nested routes recommended by research)

### Claude's Discretion

- Exact routing strategy (/project/:id/search vs state-based)
- Exact pastel color palette per section
- Spacing, typography adjustments for the cleanup
- Hover animation timing and easing curves
- Section icon choices
- Whether the Yama figure concept works visually (attempt it, cut if not)

</decisions>

<specifics>
## Specific Ideas

- Bhavachakra (Wheel of Life) as visual inspiration — subtle ring patterns, not literal
- Yama figure holding the wheel — exploratory, include if it fits the elevated dark aesthetic
- "I like the idea that each wedge has a specific colour yet we should keep colours inline with design and muted, pastel like colours could be great"
- Wheel is the centerpiece — dominant, ~500px, the main thing you see when entering a project
- Section opening feels like "opening a door" — wedge expands outward

Reference spec: `c:\Users\edwar\Documents\dev\Projects\Samsara Wheel - Feature Specification.md`

</specifics>

<deferred>
## Deferred Ideas

- Quick-switch between sections without returning to wheel — future UX improvement
- Responsive wheel for tablet/mobile — NAV-06 (future requirement)
- Animated data "flowing" between sections — from spec's future enhancements
- Section-specific colour themes beyond the accent — from spec's future enhancements
- Mini-wheel widget when deep in a section — from spec's future enhancements

</deferred>

---

_Phase: 08-samsara-wheel-foundation_
_Context gathered: 2026-01-31_
