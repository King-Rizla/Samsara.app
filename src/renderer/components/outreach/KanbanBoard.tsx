/**
 * KanbanBoard - Drag-and-drop Kanban pipeline view for outreach workflow
 *
 * Features:
 * - 6 columns: Pending, Contacted, Replied, Screening, Passed, Failed
 * - Free drag-and-drop (recruiters have full manual control)
 * - Only restriction: can't drag TO Failed column (use Archive)
 * - Paused is a visual modifier (badge), not a separate column
 * - Drag overlay for visual feedback
 * - Horizontal scrolling for all columns
 */

import { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { CandidateCard } from "./CandidateCard";
import { useWorkflowStore } from "../../stores/workflowStore";

// ============================================================================
// Column Configuration
// ============================================================================

const COLUMNS = [
  { id: "pending", title: "Pending", color: "bg-slate-500/20" },
  { id: "contacted", title: "Contacted", color: "bg-blue-500/20" },
  { id: "replied", title: "Replied", color: "bg-purple-500/20" },
  { id: "screening", title: "Screening", color: "bg-amber-500/20" },
  { id: "passed", title: "Passed", color: "bg-green-500/20" },
  { id: "failed", title: "Failed/Archived", color: "bg-red-500/20" },
] as const;

// Column IDs for checking if we're over a column (not a card)
const COLUMN_IDS = new Set<string>(COLUMNS.map((c) => c.id));

// Map workflow states to column IDs
// Note: "paused" is NOT a column - paused candidates stay in their current column
const STATE_TO_COLUMN: Record<string, string> = {
  pending: "pending",
  contacted: "contacted",
  replied: "replied",
  screening: "screening",
  passed: "passed",
  failed: "failed",
  archived: "failed", // Show archived in failed column
};

// ============================================================================
// Component
// ============================================================================

export function KanbanBoard() {
  const candidates = useWorkflowStore((state) => state.candidates);
  const moveCandidateToColumn = useWorkflowStore(
    (state) => state.moveCandidateToColumn,
  );

  // Track active drag and which column is being hovered
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  // Set up sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activating
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Group candidates by column
  const candidatesByColumn = useMemo(() => {
    const grouped: Record<string, typeof candidates> = {};

    for (const column of COLUMNS) {
      grouped[column.id] = [];
    }

    for (const candidate of candidates) {
      // Use the candidate's status to determine column
      // isPaused is just a visual modifier, doesn't change column
      const columnId = STATE_TO_COLUMN[candidate.status] || "pending";
      if (grouped[columnId]) {
        grouped[columnId].push(candidate);
      }
    }

    return grouped;
  }, [candidates]);

  // Get active candidate for drag overlay
  const activeCandidate = useMemo(
    () => candidates.find((c) => c.id === activeId),
    [candidates, activeId],
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Handle drag over - track which column we're hovering
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;

      if (!over) {
        setOverColumnId(null);
        return;
      }

      const overId = over.id as string;

      // Check if we're over a column directly
      if (COLUMN_IDS.has(overId)) {
        setOverColumnId(overId);
        return;
      }

      // We're over a card - find which column it belongs to
      // The card's parent column can be determined from candidate status
      const overCandidate = candidates.find((c) => c.id === overId);
      if (overCandidate) {
        const columnId = STATE_TO_COLUMN[overCandidate.status] || "pending";
        setOverColumnId(columnId);
      }
    },
    [candidates],
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverColumnId(null);

      if (!over) return;

      const candidateId = active.id as string;
      let targetColumnId = over.id as string;

      // If dropped on a card, get the column that card is in
      if (!COLUMN_IDS.has(targetColumnId)) {
        const overCandidate = candidates.find((c) => c.id === targetColumnId);
        if (overCandidate) {
          targetColumnId = STATE_TO_COLUMN[overCandidate.status] || "pending";
        } else {
          return; // Unknown target
        }
      }

      // Find the candidate being dragged
      const candidate = candidates.find((c) => c.id === candidateId);
      if (!candidate) return;

      // Get current column
      const currentColumnId = STATE_TO_COLUMN[candidate.status] || "pending";

      // If dropped on same column, do nothing
      if (currentColumnId === targetColumnId) return;

      // Attempt the move (store handles validation and feedback)
      moveCandidateToColumn(candidateId, targetColumnId);
    },
    [candidates, moveCandidateToColumn],
  );

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverColumnId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 p-4 h-full overflow-x-auto">
        {COLUMNS.map((column) => {
          const columnCandidates = candidatesByColumn[column.id] || [];
          const candidateIds = columnCandidates.map((c) => c.id);

          return (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              count={columnCandidates.length}
              color={column.color}
              candidateIds={candidateIds}
              isOver={overColumnId === column.id}
              isDragging={activeId !== null}
            >
              {columnCandidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  isDragging={activeId === candidate.id}
                />
              ))}
            </KanbanColumn>
          );
        })}
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeCandidate ? (
          <CandidateCard candidate={activeCandidate} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
