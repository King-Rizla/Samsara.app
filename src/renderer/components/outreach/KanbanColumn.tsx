/**
 * KanbanColumn - Droppable column for the Kanban board
 *
 * Features:
 * - Droppable zone for drag-and-drop
 * - Visual feedback when dragging over
 * - Header with title and count badge
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
}

export function KanbanColumn({
  id,
  title,
  count,
  color,
  candidateIds,
  children,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-64 min-w-64 flex-shrink-0 flex flex-col rounded-lg border border-border bg-muted/30",
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      {/* Column header */}
      <div className={cn("px-3 py-2 rounded-t-lg", color)}>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm text-foreground">{title}</h3>
          <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-background/50 text-xs font-medium">
            {count}
          </span>
        </div>
      </div>

      {/* Column content */}
      <SortableContext
        items={candidateIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-32">
          {children}
        </div>
      </SortableContext>
    </div>
  );
}
