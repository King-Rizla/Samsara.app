# Phase 3: Visual Editor - Research

**Researched:** 2026-01-25
**Domain:** React UI with Terminal Aesthetic, Queue Management, Inline Editing
**Confidence:** HIGH

## Summary

Phase 3 transforms the current single-CV parser view into a full queue management interface with three tabs (Completed, Submitted, Failed) and inline field editing. Research confirms the existing stack (React + TypeScript + Electron) supports all requirements. Key additions needed: React framework setup (currently vanilla TS), shadcn/ui components, Zustand for state management, and TanStack Table for editable data grids.

The terminal aesthetic (dark background, JetBrains Mono, monospace) is well-supported by shadcn/ui themes. Several pre-built terminal themes exist. The confidence-based highlighting pattern (70% threshold) aligns with established AI UX patterns using color-coded indicators.

**Primary recommendation:** Migrate from vanilla TypeScript to React with shadcn/ui (terminal theme), Zustand for queue state, and TanStack Table for editable CV fields.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI framework | Already in project stack (STACK.md), component model works well with Electron |
| TypeScript | 5.x | Type safety | Already in use, essential for IPC contracts |
| Tailwind CSS | 3.x | Utility styling | Enables terminal theme customization, works with shadcn/ui |
| shadcn/ui | latest | Component library | Copy-paste components, accessible, dark mode support, pre-built terminal themes |
| Zustand | 5.x | State management | Lightweight (1.2kb), handles queue state, tab state, editing state |
| TanStack Table | 8.x | Data table/grid | Editable cells, sorting, column definitions, integrates with shadcn/ui |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fontsource/jetbrains-mono | latest | Terminal font | Self-hosted web font for monospace styling |
| class-variance-authority | latest | Component variants | Included with shadcn/ui for component styling |
| clsx + tailwind-merge | latest | Class utilities | Included with shadcn/ui for conditional classes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand | Redux Toolkit | Redux adds boilerplate without benefit for medium complexity |
| TanStack Table | AG Grid | AG Grid is heavy (commercial), TanStack is lightweight and free |
| shadcn/ui | Material UI | MUI has opinionated styling, harder to achieve terminal aesthetic |

**Installation:**
```bash
# Core React setup (if not already present)
npm install react react-dom
npm install -D @types/react @types/react-dom

# Styling
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# shadcn/ui (requires initialization)
npx shadcn@latest init

# State management
npm install zustand

# Data table
npm install @tanstack/react-table

# Terminal font
npm install @fontsource/jetbrains-mono
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── renderer/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── tabs.tsx
│   │   │   ├── table.tsx
│   │   │   ├── input.tsx
│   │   │   ├── button.tsx
│   │   │   └── badge.tsx
│   │   ├── queue/                 # Queue management components
│   │   │   ├── QueueTabs.tsx      # Tab container (Completed/Submitted/Failed)
│   │   │   ├── QueueItem.tsx      # Single CV row in queue
│   │   │   └── QueueControls.tsx  # Bulk actions, retry buttons
│   │   ├── editor/                # CV editing components
│   │   │   ├── CVEditor.tsx       # Main editor view (split view concept)
│   │   │   ├── FieldEditor.tsx    # Inline editable field
│   │   │   ├── SectionEditor.tsx  # Work history, education sections
│   │   │   └── ConfidenceBadge.tsx
│   │   └── App.tsx                # Root component
│   ├── stores/
│   │   ├── queueStore.ts          # Zustand store for queue state
│   │   └── editorStore.ts         # Zustand store for editing state
│   ├── hooks/
│   │   ├── useQueue.ts            # Queue operations hook
│   │   └── useFieldEdit.ts        # Field editing hook
│   ├── lib/
│   │   └── utils.ts               # cn() utility for class merging
│   ├── styles/
│   │   └── globals.css            # Terminal theme CSS variables
│   ├── App.tsx
│   └── main.tsx                   # React entry point
├── main/
│   ├── index.ts                   # Electron main process
│   ├── preload.ts                 # Context bridge
│   └── database.ts                # SQLite operations
```

### Pattern 1: Zustand Queue Store
**What:** Centralized state for CV processing queue
**When to use:** Managing items across tabs, processing status, selection state
**Example:**
```typescript
// Source: Zustand best practices + project requirements
interface QueueItem {
  id: string;
  fileName: string;
  fileType: string;
  status: 'submitted' | 'completed' | 'failed';
  stage?: 'Parsing...' | 'Extracting...' | 'Saving...';
  error?: string;
  data?: ParsedCV;
  parseConfidence?: number;
  createdAt: string;
}

interface QueueStore {
  items: QueueItem[];
  selectedIds: Set<string>;

  // Actions
  addItem: (item: QueueItem) => void;
  updateStatus: (id: string, status: QueueItem['status'], data?: Partial<QueueItem>) => void;
  removeItem: (id: string) => void;
  toggleSelect: (id: string) => void;
  selectRange: (fromId: string, toId: string) => void;
  clearSelection: () => void;
  retryFailed: (ids: string[]) => void;
}

export const useQueueStore = create<QueueStore>((set, get) => ({
  items: [],
  selectedIds: new Set(),

  addItem: (item) => set((state) => ({
    items: [...state.items, item]
  })),

  updateStatus: (id, status, data) => set((state) => ({
    items: state.items.map(item =>
      item.id === id ? { ...item, status, ...data } : item
    )
  })),
  // ... more actions
}));
```

### Pattern 2: Inline Editable Field
**What:** Click-to-edit field with validation and immediate save
**When to use:** CV field editing (name, email, phone, etc.)
**Example:**
```typescript
// Source: React inline edit best practices + project requirements
interface EditableFieldProps {
  value: string;
  fieldKey: string;
  cvId: string;
  confidence: number;
  onSave: (cvId: string, fieldKey: string, newValue: string) => Promise<void>;
  validate?: (value: string) => string | null; // Returns error message or null
}

function EditableField({ value, fieldKey, cvId, confidence, onSave, validate }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLowConfidence = confidence < 0.7;

  const handleSave = async () => {
    if (validate) {
      const validationError = validate(editValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    await onSave(cvId, fieldKey, editValue);
    setIsEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
      setError(null);
    }
  };

  if (isEditing) {
    return (
      <div className="inline-edit-container">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={cn("edit-input", error && "border-destructive")}
          autoFocus
        />
        {error && <span className="text-destructive text-xs">{error}</span>}
      </div>
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={cn(
        "editable-field cursor-pointer hover:bg-accent px-1 rounded",
        isLowConfidence && "bg-warning/20 border border-warning"
      )}
    >
      {value || <span className="text-muted-foreground">Click to add</span>}
    </span>
  );
}
```

### Pattern 3: TanStack Table with Editable Cells
**What:** Data table with inline editing using TableMeta
**When to use:** Work history, education entries as editable tables
**Example:**
```typescript
// Source: TanStack Table editable data example
// Extend TableMeta to include update function
declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
}

// Custom cell component
const EditableCell = ({ getValue, row, column, table }: CellContext<WorkEntry, unknown>) => {
  const initialValue = getValue() as string;
  const [value, setValue] = useState(initialValue);

  const onBlur = () => {
    table.options.meta?.updateData(row.index, column.id, value);
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <input
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={onBlur}
      className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
};

// Column definition with editable cell
const columns: ColumnDef<WorkEntry>[] = [
  {
    accessorKey: 'company',
    header: 'Company',
    cell: EditableCell,
    meta: { type: 'text' }
  },
  {
    accessorKey: 'position',
    header: 'Position',
    cell: EditableCell,
    meta: { type: 'text' }
  },
  {
    accessorKey: 'confidence',
    header: 'Confidence',
    cell: ({ getValue }) => {
      const conf = getValue() as number;
      return <ConfidenceBadge value={conf} threshold={0.7} />;
    }
  }
];
```

### Pattern 4: Terminal Theme CSS Variables
**What:** Dark theme with monospace font using CSS variables
**When to use:** Base styling for entire application
**Example:**
```css
/* Source: shadcn/ui theming + terminal aesthetic requirements */
@import "@fontsource/jetbrains-mono";

:root {
  /* Terminal dark theme - always dark, no light mode */
  --background: 0 0% 0%;           /* Pure black */
  --foreground: 0 0% 100%;         /* Pure white */

  /* Samsara brand accent - purple/magenta */
  --primary: 280 100% 60%;         /* Purple */
  --primary-foreground: 0 0% 100%;

  /* Status colors */
  --status-submitted: 45 100% 50%; /* Yellow/Orange */
  --status-completed: 142 76% 36%; /* Green */
  --status-failed: 0 84% 60%;      /* Red */

  /* Low confidence highlight */
  --warning: 45 100% 50%;
  --warning-foreground: 0 0% 0%;

  /* UI elements */
  --card: 0 0% 5%;                 /* Slightly lighter than background */
  --card-foreground: 0 0% 100%;
  --border: 0 0% 20%;              /* Subtle borders */
  --input: 0 0% 10%;
  --ring: 280 100% 60%;            /* Focus ring = brand color */

  --radius: 0.25rem;               /* Minimal rounding for terminal feel */
}

body {
  font-family: 'JetBrains Mono', monospace;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

/* Low confidence field highlighting */
.low-confidence {
  background: hsl(var(--warning) / 0.2);
  border: 1px solid hsl(var(--warning));
}

/* Interactive elements - outlined style */
.btn-terminal {
  background: transparent;
  border: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
}

.btn-terminal:hover {
  background: hsl(var(--primary) / 0.1);
  border-color: hsl(var(--primary));
}
```

### Anti-Patterns to Avoid
- **Storing editing state in props:** Use Zustand store for editing state, not prop drilling
- **Re-parsing on every edit:** Save field changes directly to SQLite, only re-parse on explicit user action
- **Blocking UI during save:** Use optimistic updates - show change immediately, save async
- **Modal for every field edit:** Use inline editing for quick fixes, matches "instant fix" requirement
- **Light mode toggle:** Design specifies dark mode only, don't add theme switcher

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab components | Custom tab state | shadcn/ui Tabs | Accessible, keyboard navigation, ARIA labels |
| Data tables | Manual table markup | TanStack Table + shadcn/ui Table | Sorting, pagination, column defs, editable cells |
| Form validation | Manual regex checking | Simple regex with clear patterns | For email/phone, built-in HTML5 validation patterns work |
| CSS utilities | Manual class concatenation | clsx + tailwind-merge (cn()) | Handles class conflicts, conditional classes |
| State management | useState + context | Zustand | Handles cross-component state without prop drilling |
| Queue processing | Custom event emitters | IPC + Zustand | Electron IPC already established, Zustand for UI state |
| Monospace font loading | @font-face rules | @fontsource/jetbrains-mono | Self-hosted, properly licensed, npm package |

**Key insight:** The UI requirements (tabs, tables, inline editing) are standard patterns with well-tested solutions. shadcn/ui + TanStack Table handle 90% of the complexity. Focus development time on the CV-specific editing logic, not UI infrastructure.

## Common Pitfalls

### Pitfall 1: IPC Bottleneck on Frequent Saves
**What goes wrong:** Every field edit triggers IPC call to main process, causing lag
**Why it happens:** Naive implementation saves on every keystroke
**How to avoid:**
- Debounce saves (300-500ms after last keystroke)
- Batch multiple field changes into single IPC call
- Use optimistic updates in UI
**Warning signs:** Input lag, cursor jumping, "loading" states during typing

### Pitfall 2: Stale Queue State After Processing
**What goes wrong:** UI shows old status after CV finishes processing
**Why it happens:** Main process updates database but renderer has stale state
**How to avoid:**
- Use IPC events to push status updates from main to renderer
- Zustand store subscribes to these events
- Or poll database on tab focus (simpler but less reactive)
**Warning signs:** Items stuck in "Processing" state, manual refresh needed

### Pitfall 3: Lost Edits on Tab Switch
**What goes wrong:** User edits a field, switches tab, edits are lost
**Why it happens:** Component unmounts, local state is lost before save completes
**How to avoid:**
- Save to Zustand store immediately on blur
- Persist pending changes even if component unmounts
- Save to SQLite asynchronously
**Warning signs:** User complaints about lost work, fields reverting to old values

### Pitfall 4: Confidence Threshold Confusion
**What goes wrong:** Users don't understand why some fields are highlighted
**Why it happens:** Visual indicator without explanation
**How to avoid:**
- Tooltip on hover explaining "Low confidence - AI was uncertain about this value"
- Consistent 70% threshold (already decided)
- Same highlighting style everywhere (contact, work history, education)
**Warning signs:** Users ignoring highlighted fields, support tickets about "yellow fields"

### Pitfall 5: Multi-Select State Conflicts
**What goes wrong:** Shift-click selection breaks, wrong items selected
**Why it happens:** Selection state not tracking last-clicked item for range selection
**How to avoid:**
- Store `lastSelectedId` in queue store
- Implement proper range selection: all items between last click and current click
- Clear selection on tab switch
**Warning signs:** Unexpected items in selection, shift-click selecting wrong range

### Pitfall 6: React Key Prop Issues in Lists
**What goes wrong:** Edits appear on wrong CV after re-sort or filter
**Why it happens:** Using array index as key instead of unique ID
**How to avoid:**
- Always use `item.id` as key, never array index
- CVs already have UUID from database
**Warning signs:** Form state "jumping" between items, wrong data displayed after sort

## Code Examples

Verified patterns from official sources:

### IPC Handler for Field Update (Main Process)
```typescript
// Source: Electron IPC best practices + existing codebase pattern
// Add to src/main/index.ts

import { getDatabase } from './database';

ipcMain.handle('update-cv-field', async (_event, cvId: string, fieldPath: string, value: unknown) => {
  const db = getDatabase();
  const now = new Date().toISOString();

  try {
    // fieldPath examples: "contact.email", "work_history[0].company"
    const cv = db.prepare('SELECT * FROM cvs WHERE id = ?').get(cvId);
    if (!cv) {
      return { success: false, error: 'CV not found' };
    }

    // Parse the field path and update the appropriate JSON column
    const [section, ...rest] = fieldPath.split('.');
    const columnMap: Record<string, string> = {
      contact: 'contact_json',
      work_history: 'work_history_json',
      education: 'education_json',
      skills: 'skills_json',
    };

    const column = columnMap[section];
    if (!column) {
      return { success: false, error: `Unknown section: ${section}` };
    }

    // Update the JSON field
    const currentData = JSON.parse(cv[column] || '{}');
    // ... apply update to nested path ...

    db.prepare(`UPDATE cvs SET ${column} = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(currentData), now, cvId);

    return { success: true };
  } catch (error) {
    console.error('Field update failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});
```

### Preload API Extension
```typescript
// Source: Existing preload.ts pattern
// Add to contextBridge.exposeInMainWorld('api', { ... })

updateCVField: (cvId: string, fieldPath: string, value: unknown) =>
  ipcRenderer.invoke('update-cv-field', cvId, fieldPath, value),

getCV: (cvId: string) =>
  ipcRenderer.invoke('get-cv', cvId),

deleteCV: (cvId: string) =>
  ipcRenderer.invoke('delete-cv', cvId),

reprocessCV: (cvId: string) =>
  ipcRenderer.invoke('reprocess-cv', cvId),

// Status updates from main to renderer
onProcessingStatus: (callback: (status: ProcessingStatus) => void) => {
  const handler = (_event: IpcRendererEvent, status: ProcessingStatus) => callback(status);
  ipcRenderer.on('processing-status', handler);
  return () => ipcRenderer.removeListener('processing-status', handler);
},
```

### Confidence Badge Component
```typescript
// Source: AI UX patterns + project requirements
interface ConfidenceBadgeProps {
  value: number;
  threshold?: number;
  showPercentage?: boolean;
}

function ConfidenceBadge({ value, threshold = 0.7, showPercentage = true }: ConfidenceBadgeProps) {
  const isLow = value < threshold;
  const percentage = Math.round(value * 100);

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-mono",
        isLow
          ? "bg-warning/20 text-warning border border-warning"
          : "bg-primary/20 text-primary border border-primary"
      )}
      title={isLow ? "Low confidence - AI was uncertain about this value" : "High confidence"}
    >
      {showPercentage && `${percentage}%`}
      {isLow && <span className="ml-1">!</span>}
    </span>
  );
}
```

### Queue Tab Counter
```typescript
// Source: Zustand selector pattern
function useTabCounts() {
  return useQueueStore((state) => ({
    submitted: state.items.filter(i => i.status === 'submitted').length,
    completed: state.items.filter(i => i.status === 'completed').length,
    failed: state.items.filter(i => i.status === 'failed').length,
  }));
}

// Usage in TabsList
function QueueTabs() {
  const counts = useTabCounts();

  return (
    <Tabs defaultValue="completed">
      <TabsList>
        <TabsTrigger value="completed" className="data-[state=active]:bg-status-completed/20">
          Completed ({counts.completed})
        </TabsTrigger>
        <TabsTrigger value="submitted" className="data-[state=active]:bg-status-submitted/20">
          Submitted ({counts.submitted})
        </TabsTrigger>
        <TabsTrigger value="failed" className="data-[state=active]:bg-status-failed/20">
          Failed ({counts.failed})
        </TabsTrigger>
      </TabsList>
      {/* TabsContent for each tab */}
    </Tabs>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redux for all state | Zustand for UI + React Query for server | 2024-2025 | Simpler code, less boilerplate |
| Modal editing forms | Inline click-to-edit | 2023+ | Faster UX, fewer clicks |
| react-table (legacy) | TanStack Table v8 | 2022 | Framework-agnostic, better types |
| Hand-rolled dark mode | CSS variables + system detection | 2024+ | Simpler theming, OS integration |
| Custom component library | shadcn/ui | 2023+ | Copy-paste components, full control |

**Deprecated/outdated:**
- **Redux for simple UI state:** Zustand handles it with 1/10th the code
- **Class components:** Hooks are standard, especially for state management
- **CSS-in-JS (styled-components, emotion):** Tailwind CSS is dominant in 2025-2026
- **react-table v7:** Upgrade to TanStack Table v8 for better TypeScript support

## Open Questions

Things that couldn't be fully resolved:

1. **Field editing UX: Inline vs Modal**
   - What we know: User gave Claude discretion on this. Research suggests inline for "instant fix" requirement.
   - What's unclear: Whether complex fields (work history with multiple sub-fields) should use inline or expand to a modal/panel
   - Recommendation: Use inline for simple fields (name, email, phone). Use expandable card/panel for complex sections (work history entry with company, position, dates, highlights). No full-screen modals.

2. **Processing concurrency: Which CVs to process simultaneously?**
   - What we know: 2-3 CVs process simultaneously (per CONTEXT.md)
   - What's unclear: Queue ordering (FIFO? Priority?), what happens if user adds CV while 3 are processing
   - Recommendation: FIFO queue, new CVs wait in "pending" sub-state until slot opens. Simple implementation first.

3. **Tab count persistence: Session vs persistent?**
   - What we know: "Session totals (resets when app restarts)" per CONTEXT.md
   - What's unclear: Whether items in queue persist in database or only in memory
   - Recommendation: CVs persist in database (already implemented), queue counts are derived from database state on startup. "Session totals" means cumulative counts, not item persistence.

## Sources

### Primary (HIGH confidence)
- [shadcn/ui Tabs Documentation](https://ui.shadcn.com/docs/components/tabs) - Tab component patterns
- [shadcn/ui Data Table Documentation](https://ui.shadcn.com/docs/components/data-table) - TanStack Table integration
- [shadcn/ui Theming Documentation](https://ui.shadcn.com/docs/theming) - CSS variables, dark mode
- [TanStack Table Editable Data Example](https://tanstack.com/table/latest/docs/framework/react/examples/editable-data) - Inline editing pattern
- [JetBrains Mono - Google Fonts](https://fonts.google.com/specimen/JetBrains+Mono) - Font availability
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc) - IPC patterns

### Secondary (MEDIUM confidence)
- [LogRocket - Build Inline Editable UI in React](https://blog.logrocket.com/build-inline-editable-ui-react/) - Inline edit best practices
- [AI Design Patterns - Confidence Visualization](https://www.aiuxdesign.guide/patterns/confidence-visualization) - UX patterns for AI confidence
- [Agentic Design - Confidence Visualization Patterns](https://agentic-design.ai/patterns/ui-ux-patterns/confidence-visualization-patterns) - Color-coded confidence thresholds
- [shadcn.io Mono Theme](https://www.shadcn.io/theme/mono) - Terminal-inspired shadcn theme
- [Zustand Third-Party Libraries](https://zustand.docs.pmnd.rs/integrations/third-party-libraries) - Tab sync middleware

### Tertiary (LOW confidence)
- WebSearch results for React queue management patterns - Various approaches, no single standard
- Simple Table blog on editable grids - Useful but single-source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs, existing STACK.md alignment
- Architecture: HIGH - Patterns from official documentation, matches Electron IPC already in codebase
- Pitfalls: MEDIUM - Drawn from multiple sources, some from general experience
- UI/UX patterns: MEDIUM - Confidence visualization is emerging pattern, multiple sources agree

**Research date:** 2026-01-25
**Valid until:** 2026-02-25 (30 days - stack is stable)

---

*Phase: 03-visual-editor*
*Research completed: 2026-01-25*
