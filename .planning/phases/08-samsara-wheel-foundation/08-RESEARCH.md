# Phase 8: Samsara Wheel & Foundation - Research

**Researched:** 2026-01-31
**Domain:** React navigation UI (SVG wheel), nested routing, SQLite schema migration
**Confidence:** HIGH

## Summary

Phase 8 has three distinct sub-domains: (1) refactoring the existing flat routing into nested routes with a project layout, (2) building a custom SVG-based circular navigation wheel with Motion animations, and (3) extending the SQLite schema with all M2 outreach tables.

The current app uses `react-router-dom@7.13.0` with `MemoryRouter` and flat `<Routes>`. The refactor wraps `/project/:id/*` in a layout route using `<Outlet />` so the wheel view and section views share a common project shell. The wheel itself is a custom SVG component (no library exists for this -- it must be hand-built using `<svg>`, `<path>`, and trigonometry). Motion (`motion` npm package, v12.x) provides `AnimatePresence`, `motion.div`, and layout animations for the wheel-to-section transition. The database migration is straightforward -- add new tables at `user_version = 5` following the established pattern in `database.ts`.

**Primary recommendation:** Build the wheel as a pure SVG component with Motion animation wrappers. Use react-router-dom nested routes with `<Outlet />` for the project layout. Keep all M1 features inside the "Candidate Search" section at `/project/:id/search`. The wheel view is the index route at `/project/:id`.

## Standard Stack

### Core

| Library            | Version                     | Purpose                                                         | Why Standard                                                                                  |
| ------------------ | --------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `motion`           | ^12.x                       | Wheel animations, section transitions, hover effects            | Decision locked in CONTEXT.md. Modern successor to framer-motion. Import from `motion/react`. |
| `react-router-dom` | 7.13.0 (already installed)  | Nested routing with `<Outlet />`                                | Already in use. v7 supports layout routes natively.                                           |
| `lucide-react`     | 0.563.0 (already installed) | Section icons (Search, Phone, Users, Database, TrendingUp, Eye) | Already in use throughout the app.                                                            |
| `better-sqlite3`   | 12.6.2 (already installed)  | Schema migration v5 for M2 tables                               | Already in use. Established migration pattern exists.                                         |

### Supporting

| Library                   | Version           | Purpose                                   | When to Use                              |
| ------------------------- | ----------------- | ----------------------------------------- | ---------------------------------------- |
| `@radix-ui/react-tooltip` | already installed | Hover tooltips for section stats          | Already used in app for tooltips         |
| `tailwindcss-animate`     | already installed | CSS keyframes for breathing pulse on Yama | Already configured in tailwind.config.js |

### Alternatives Considered

| Instead of               | Could Use                 | Tradeoff                                                                                                |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Custom SVG wheel         | Canvas/WebGL              | SVG is inspectable, accessible, and simpler for 5 wedges. Canvas would be overkill.                     |
| Motion layout animations | CSS view transitions      | Motion allows interruption mid-animation, multiple layoutId elements, better performance via transforms |
| Nested routes            | State-based nav (zustand) | URL-based routing gives browser-back support, deep linking, clearer mental model                        |

**Installation:**

```bash
npm install motion
```

Single new dependency. Everything else is already installed.

## Architecture Patterns

### Recommended Project Structure

```
src/renderer/
├── routes/
│   ├── Dashboard.tsx              # Existing (unchanged)
│   ├── Settings.tsx               # Existing (unchanged)
│   ├── ProjectLayout.tsx          # NEW: Layout route with <Outlet />
│   └── ProjectView.tsx            # REFACTOR: becomes the wheel view (index route)
├── components/
│   ├── wheel/
│   │   ├── SamsaraWheel.tsx       # Main SVG wheel component
│   │   ├── WheelSection.tsx       # Individual SVG wedge
│   │   ├── YamaHub.tsx            # Center hub with eye icon
│   │   ├── WheelTransition.tsx    # AnimatePresence wrapper for wheel<->section
│   │   └── types.ts               # Section types, stats interfaces
│   ├── sections/
│   │   ├── CandidateSearchSection.tsx  # Wraps existing M1 features
│   │   ├── PlaceholderSection.tsx      # "Coming Soon" for unbuilt sections
│   │   └── SectionHeader.tsx           # Back-to-wheel breadcrumb
│   └── ... (existing components unchanged)
```

### Pattern 1: Nested Route Layout with Outlet

**What:** Project-level layout wrapping wheel + section views
**When to use:** Always -- this is the routing foundation

```typescript
// App.tsx route config
<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/project/:id" element={<ProjectLayout />}>
    <Route index element={<WheelView />} />
    <Route path="search" element={<CandidateSearchSection />} />
    <Route path="outreach" element={<PlaceholderSection name="Candidate Outreach" />} />
    <Route path="coordination" element={<PlaceholderSection name="Client Coordination" />} />
    <Route path="data-entry" element={<PlaceholderSection name="Data Entry" />} />
    <Route path="business-dev" element={<PlaceholderSection name="Business Development" />} />
  </Route>
  <Route path="/settings" element={<Settings />} />
</Routes>
```

```typescript
// ProjectLayout.tsx
import { Outlet, useParams, useNavigate } from 'react-router-dom';

export function ProjectLayout() {
  const { id: projectId } = useParams<{ id: string }>();
  // Load project data, setup stores
  // Shared project header bar lives here

  return (
    <>
      <ProjectHeader projectId={projectId} />
      <Outlet />
    </>
  );
}
```

### Pattern 2: SVG Wheel with Trigonometric Wedge Positioning

**What:** 5 wedges positioned around a circle using SVG arc paths
**When to use:** For the SamsaraWheel component

```typescript
// SVG arc path calculation for wheel wedges
const SECTIONS = 5;
const ANGLE_PER_SECTION = (2 * Math.PI) / SECTIONS;
const INNER_RADIUS = 80; // Yama hub radius
const OUTER_RADIUS = 240; // Wheel outer radius

function getWedgePath(index: number): string {
  const startAngle = index * ANGLE_PER_SECTION - Math.PI / 2; // Start from top
  const endAngle = startAngle + ANGLE_PER_SECTION;

  const x1 = Math.cos(startAngle) * OUTER_RADIUS;
  const y1 = Math.sin(startAngle) * OUTER_RADIUS;
  const x2 = Math.cos(endAngle) * OUTER_RADIUS;
  const y2 = Math.sin(endAngle) * OUTER_RADIUS;
  const x3 = Math.cos(endAngle) * INNER_RADIUS;
  const y3 = Math.sin(endAngle) * INNER_RADIUS;
  const x4 = Math.cos(startAngle) * INNER_RADIUS;
  const y4 = Math.sin(startAngle) * INNER_RADIUS;

  return `
    M ${x4} ${y4}
    L ${x1} ${y1}
    A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 1 ${x2} ${y2}
    L ${x3} ${y3}
    A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${x4} ${y4}
    Z
  `;
}
```

### Pattern 3: AnimatePresence for Wheel-to-Section Transition

**What:** Wheel fades out, section content expands from wedge position
**When to use:** Wrapping the `<Outlet />` content

```typescript
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';

function ProjectLayout() {
  const location = useLocation();
  const isWheelView = location.pathname.match(/^\/project\/[^/]+$/);

  return (
    <>
      <ProjectHeader />
      <AnimatePresence mode="wait">
        <motion.div
          key={isWheelView ? 'wheel' : location.pathname}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="flex-1 overflow-hidden"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </>
  );
}
```

### Pattern 4: SQLite Migration Pattern (Established)

**What:** Sequential version checks with `user_version` pragma
**When to use:** For the v5 migration adding M2 tables

```typescript
if (version < 5) {
  console.log("Migrating database to version 5 (M2 outreach tables)...");

  db.exec(`
    CREATE TABLE IF NOT EXISTS outreach_templates (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,  -- 'sms' | 'email'
      subject TEXT,
      body TEXT NOT NULL,
      variables_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // ... other tables ...

  db.pragma("user_version = 5");
}
```

### Anti-Patterns to Avoid

- **Rendering wheel with Canvas/WebGL:** SVG is sufficient for 5 wedges and gives accessibility, event handling, and CSS styling for free
- **State-based navigation instead of URL routing:** Breaks browser back button, makes deep linking impossible, loses routing context on refresh
- **Putting M1 features directly in ProjectLayout:** They must be extracted into CandidateSearchSection and rendered only when that section route matches
- **Animating with CSS transitions on SVG transform:** Use Motion for spring physics and interruptible animations; CSS transitions snap on interruption
- **Creating a separate "data migration" phase:** DAT-01/DAT-02 tables should be created in this phase even though the data won't be populated until later phases

## Don't Hand-Roll

| Problem                   | Don't Build                 | Use Instead                                   | Why                                                                           |
| ------------------------- | --------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| Animation orchestration   | CSS keyframes + JS timers   | Motion (`motion/react`)                       | Spring physics, interruptible animations, layout animations, gesture handling |
| Tooltip on hover          | Custom tooltip component    | `@radix-ui/react-tooltip` (already installed) | Accessible, handles positioning, z-index, portals                             |
| SVG arc path calculation  | Manual string concatenation | Helper function with Math.cos/sin             | But DO hand-build -- no library exists for a 5-wedge wheel with this design   |
| Route-based navigation    | Zustand-based view state    | react-router-dom `<Outlet />`                 | URL-based routing with nested layout support                                  |
| Breathing pulse animation | JS setInterval              | CSS `@keyframes` via tailwindcss-animate      | Pure CSS is more performant for simple infinite pulses                        |

**Key insight:** The wheel itself must be hand-built (no library for this specific UI pattern), but everything around it (animations, routing, tooltips, icons) uses existing installed libraries. The only new install is `motion`.

## Common Pitfalls

### Pitfall 1: MemoryRouter + AnimatePresence Key Mismatch

**What goes wrong:** AnimatePresence exit animations don't trigger because MemoryRouter doesn't notify location changes the same way BrowserRouter does
**Why it happens:** MemoryRouter is used in Electron (no URL bar), but it still supports `useLocation()` correctly
**How to avoid:** Use `useLocation()` to get the current path and pass it as the `key` prop to `motion.div` inside `AnimatePresence`. Ensure `mode="wait"` so exit completes before enter starts
**Warning signs:** Section changes happen instantly without animation

### Pitfall 2: SVG viewBox Coordinate Confusion

**What goes wrong:** Wheel renders at wrong size or is clipped
**Why it happens:** SVG viewBox origin is top-left (0,0) but wheel math centers at (0,0). Forgetting to translate the viewBox
**How to avoid:** Set `viewBox="-260 -260 520 520"` (centered) and draw all coordinates relative to origin (0,0). The wheel center is at SVG origin.
**Warning signs:** Wheel appears in corner, paths are clipped

### Pitfall 3: Outlet Not Re-rendering on Nested Route Change

**What goes wrong:** Navigating between sections doesn't update content
**Why it happens:** React-router-dom v7 `<Outlet />` renders the matched child route. If the parent component memoizes or blocks re-renders, child won't update
**How to avoid:** Don't wrap `<Outlet />` in `React.memo`. Don't use `shouldComponentUpdate` in the layout component. The `<AnimatePresence>` key must change when the route changes.
**Warning signs:** Clicking different wheel sections shows same content

### Pitfall 4: Extracting ProjectView Content Breaks Store Subscriptions

**What goes wrong:** After extracting M1 features into CandidateSearchSection, stores stop receiving updates
**Why it happens:** Store subscriptions (useQueueStore, useEditorStore, useJDStore) were set up in ProjectView's useEffect. Moving components without moving the setup breaks the data flow
**How to avoid:** Move project-scoped store initialization to ProjectLayout (the parent). Individual sections subscribe to the stores they need. The `selectProject()` call belongs in ProjectLayout, not in any section.
**Warning signs:** CV list empty, JD list empty after refactor

### Pitfall 5: Motion Bundle Size

**What goes wrong:** App bundle size increases significantly
**Why it happens:** Motion is ~30KB gzipped. In an Electron app this is negligible, but tree-shaking still matters
**How to avoid:** Import only what you need: `import { motion, AnimatePresence } from 'motion/react'`. Don't import the full package.
**Warning signs:** Not actually a problem for Electron desktop apps

### Pitfall 6: Database Migration Version Gap

**What goes wrong:** Migration runs on machines that already have version 4 but skips tables
**Why it happens:** Using wrong version number or not following the established `if (version < N)` pattern
**How to avoid:** Next migration MUST be `if (version < 5)`. Check the current max is `version < 4` (matching metadata). Never skip a version number.
**Warning signs:** Tables don't exist at runtime, foreign key errors

## Code Examples

### SVG Wheel Wedge with Motion Hover

```typescript
// Source: Custom pattern combining SVG + Motion
import { motion } from 'motion/react';

interface WheelSectionProps {
  path: string;        // SVG arc path
  fill: string;        // Muted pastel color
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  comingSoon?: boolean;
}

function WheelSection({ path, fill, label, icon, onClick, comingSoon }: WheelSectionProps) {
  return (
    <motion.g
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <motion.path
        d={path}
        fill={fill}
        stroke="hsl(0 0% 20%)"
        strokeWidth={1}
        whileHover={{ fill: `${fill}dd` }} // slightly brighter on hover
      />
      {/* Icon and label positioned at wedge centroid */}
      {/* ... */}
    </motion.g>
  );
}
```

### Yama Hub Breathing Pulse (CSS)

```css
/* In globals.css or via tailwindcss-animate */
@keyframes breathe {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}

.yama-breathe {
  animation: breathe 3.5s ease-in-out infinite;
}
```

### Section Back Button Navigation

```typescript
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';

function SectionHeader({ title }: { title: string }) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/project/${id}`)}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Wheel
      </Button>
      <div className="h-4 w-px bg-border" />
      <span className="font-medium">{title}</span>
    </div>
  );
}
```

### M2 Database Tables (DAT-02)

```sql
-- Messages (SMS + email)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  cv_id TEXT,
  type TEXT NOT NULL,           -- 'sms' | 'email'
  direction TEXT NOT NULL,      -- 'outbound' | 'inbound'
  status TEXT NOT NULL,         -- 'queued' | 'sent' | 'delivered' | 'failed' | 'received'
  from_address TEXT,
  to_address TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  template_id TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (cv_id) REFERENCES cvs(id) ON DELETE SET NULL
);

-- Call records
CREATE TABLE IF NOT EXISTS call_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  cv_id TEXT,
  type TEXT NOT NULL,           -- 'ai_screening' | 'recruiter'
  status TEXT NOT NULL,         -- 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'no_answer'
  provider_call_id TEXT,
  phone_number TEXT NOT NULL,
  duration_seconds INTEGER,
  screening_outcome TEXT,       -- 'pass' | 'fail' | 'unclear' | null
  screening_confidence REAL,
  recording_path TEXT,
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (cv_id) REFERENCES cvs(id) ON DELETE SET NULL
);

-- Transcripts
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  segments_json TEXT,           -- [{start, end, speaker, text}]
  summary TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (call_id) REFERENCES call_records(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Outreach templates
CREATE TABLE IF NOT EXISTS outreach_templates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'sms' | 'email' | 'voice_script'
  subject TEXT,
  body TEXT NOT NULL,
  variables_json TEXT,
  is_default INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Outreach sequences
CREATE TABLE IF NOT EXISTS outreach_sequences (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  cv_id TEXT NOT NULL,
  status TEXT NOT NULL,         -- 'pending' | 'active' | 'completed' | 'cancelled'
  current_step INTEGER DEFAULT 0,
  steps_json TEXT NOT NULL,     -- [{type, template_id, delay_minutes, status}]
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (cv_id) REFERENCES cvs(id) ON DELETE CASCADE
);

-- Provider credentials (encrypted via safeStorage)
CREATE TABLE IF NOT EXISTS provider_credentials (
  id TEXT PRIMARY KEY,
  project_id TEXT,              -- NULL = global
  provider TEXT NOT NULL,       -- 'twilio' | 'sendgrid' | 'smtp' | 'elevenlabs'
  credential_type TEXT NOT NULL,-- 'api_key' | 'auth_token' | 'smtp_password'
  encrypted_value TEXT NOT NULL,-- Encrypted via Electron safeStorage
  label TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ATS field mappings
CREATE TABLE IF NOT EXISTS ats_mappings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  ats_vendor TEXT NOT NULL,     -- 'bullhorn' | 'jobadder' | 'vincere' | 'custom'
  mapping_json TEXT NOT NULL,   -- {cv_field: ats_field} pairs
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

## State of the Art

| Old Approach            | Current Approach                              | When Changed       | Impact                                                             |
| ----------------------- | --------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| `framer-motion` package | `motion` package (import from `motion/react`) | 2025               | Same API, new package name. Install `motion`, not `framer-motion`  |
| Flat routes only        | Layout routes with `<Outlet />`               | react-router v6.4+ | Enables shared project layout without prop drilling                |
| CSS transitions for SVG | Motion for SVG `<motion.path>`, `<motion.g>`  | 2023+              | Spring physics, gestures, interruptible animations on SVG elements |

**Deprecated/outdated:**

- `framer-motion` npm package: still works but `motion` is the maintained successor. Use `motion`.
- `react-router-dom` v5 patterns (`Switch`, `component` prop): v7 uses `element` prop and `<Outlet />`

## Open Questions

1. **Exact wedge accent colors**
   - What we know: Muted/pastel colors per wedge on dark background. User wants "inline with design"
   - What's unclear: Exact HSL values for each of the 5 sections
   - Recommendation: Claude's discretion per CONTEXT.md. Suggest: Search (soft blue 210 60% 70%), Outreach (soft green 160 50% 65%), Coordination (soft amber 35 60% 70%), Data Entry (soft teal 180 50% 65%), Business Dev (soft rose 340 50% 70%)

2. **Yama figure visual**
   - What we know: User wants to "explore" a Yama-like figure if it fits. Eye icon with breathing pulse confirmed
   - What's unclear: Whether a decorative Yama figure (holding the wheel) is achievable in SVG without looking amateur
   - Recommendation: Start with eye icon + decorative concentric rings only. Yama figure is a stretch goal -- attempt inline SVG illustration, cut if it doesn't look professional

3. **Decorative Bhavachakra ring**
   - What we know: Subtle ring patterns inspired by Wheel of Life, not literal
   - What's unclear: Exact visual treatment
   - Recommendation: Single thin decorative ring outside the wedges with subtle dashed/dotted pattern. Low effort, high visual impact.

## Sources

### Primary (HIGH confidence)

- Codebase analysis: `src/renderer/App.tsx` -- current routing structure with MemoryRouter
- Codebase analysis: `src/renderer/routes/ProjectView.tsx` -- current M1 feature layout
- Codebase analysis: `src/main/database.ts` -- migration pattern (versions 1-4)
- Codebase analysis: `package.json` -- react-router-dom@7.13.0 already installed
- [Motion docs: Layout Animations](https://motion.dev/docs/react-layout-animations) -- layout, layoutId, AnimatePresence
- [Motion docs: React component](https://motion.dev/docs/react-motion-component) -- motion.div, motion.path, motion.g
- [Motion npm](https://www.npmjs.com/package/motion) -- v12.26.2 current, import from `motion/react`

### Secondary (MEDIUM confidence)

- [React Router v7 nested routes tutorial](https://www.robinwieruch.de/react-router-nested-routes/) -- Outlet pattern confirmed
- [Motion upgrade guide](https://motion.dev/docs/react-upgrade-guide) -- framer-motion to motion migration
- [Maxime Heckel: Layout animations](https://blog.maximeheckel.com/posts/framer-motion-layout-animations/) -- layout prop patterns

### Tertiary (LOW confidence)

- Wedge accent color choices -- designer discretion, no authoritative source

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- All libraries already installed except `motion`. Versions verified from package.json and npm.
- Architecture: HIGH -- Nested routing pattern is well-documented for react-router-dom v7. SVG wheel is custom but mathematically straightforward.
- Pitfalls: HIGH -- Based on direct codebase analysis of existing patterns (MemoryRouter, store subscriptions, migration versioning)
- Database schema: MEDIUM -- Table designs based on M2 requirements and ROADMAP-DRAFT.md. May need refinement when specific features are implemented.

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (stable domain, no fast-moving dependencies)
