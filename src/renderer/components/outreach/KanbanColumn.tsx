/**
 * KanbanColumn - Droppable column for the Kanban board
 *
 * Features:
 * - Droppable zone for drag-and-drop
 * - Visual feedback when dragging over (controlled by parent)
 * - Header with title and count badge
 * - Pointer events disabled on children during drag for smoother detection
 */

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "../../lib/utils";

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  color: string;
  candidateIds: string[];
  children: React.ReactNode;
  /** Whether a dragged item is currently over this column (controlled by parent) */
  isOver?: boolean;
  /** Whether any drag is currently active */
  isDragging?: boolean;
}

export function KanbanColumn({
  id,
  title,
  count,
  color,
  candidateIds,
  children,
  isOver = false,
  isDragging = false,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-64 min-w-64 flex-shrink-0 flex flex-col rounded-lg border-2 transition-all duration-150",
        // Default state
        !isOver && "border-border bg-muted/30",
        // Hover state when dragging over this column
        isOver && "border-primary bg-primary/5 shadow-lg shadow-primary/20",
      )}
    >
      {/* Column header */}
      <div
        className={cn(
          "px-3 py-2 rounded-t-lg transition-colors",
          color,
          isOver && "bg-primary/20",
        )}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm text-foreground">{title}</h3>
          <span
            className={cn(
              "inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full text-xs font-medium transition-colors",
              isOver
                ? "bg-primary text-primary-foreground"
                : "bg-background/50",
            )}
          >
            {count}
          </span>
        </div>
      </div>

      {/* Column content */}
      <SortableContext
        items={candidateIds}
        strategy={verticalListSortingStrategy}
      >
        <div
          className={cn(
            "flex-1 p-2 space-y-2 overflow-y-auto min-h-32",
            // Disable pointer events on children during drag to prevent
            // them from interfering with column drop detection
            isDragging && "pointer-events-none",
          )}
        >
          {children}
        </div>
      </SortableContext>
    </div>
  );
}
