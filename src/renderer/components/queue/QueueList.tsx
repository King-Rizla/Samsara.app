import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueueStore } from "../../stores/queueStore";
import { QueueItem } from "./QueueItem";
import type { QueueStatus } from "../../types/cv";

interface QueueListProps {
  status: QueueStatus;
  onExport?: (cvId: string, cvName: string) => void;
  searchQuery?: string;
}

export function QueueList({
  status,
  onExport,
  searchQuery = "",
}: QueueListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  // Get stable reference to items array, then filter with useMemo
  // This avoids React 19's infinite loop detection with useSyncExternalStore
  const allItems = useQueueStore((state) => state.items);
  const items = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return allItems.filter((item) => {
      // Filter by status first
      // Submitted tab shows both 'queued' and 'submitted' items (all in-progress CVs)
      const statusMatch =
        status === "submitted"
          ? item.status === "submitted" || item.status === "queued"
          : item.status === status;

      if (!statusMatch) return false;

      // Then filter by search query if provided
      if (query) {
        const fileName = item.fileName?.toLowerCase() || "";
        const candidateName = item.data?.contact?.name?.toLowerCase() || "";
        return fileName.includes(query) || candidateName.includes(query);
      }

      return true;
    });
  }, [allItems, status, searchQuery]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
    useFlushSync: false,
  });

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>
          {status === "completed" && "No completed CVs yet"}
          {status === "submitted" && "No CVs processing"}
          {status === "failed" && "No failed CVs"}
        </p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-y-auto p-2">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <QueueItem item={items[virtualRow.index]} onExport={onExport} />
          </div>
        ))}
      </div>
    </div>
  );
}
