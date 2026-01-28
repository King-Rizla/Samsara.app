import { useMemo } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { QueueItem } from './QueueItem';
import type { QueueStatus } from '../../types/cv';

interface QueueListProps {
  status: QueueStatus;
  onExport?: (cvId: string, cvName: string) => void;
}

export function QueueList({ status, onExport }: QueueListProps) {
  // Get stable reference to items array, then filter with useMemo
  // This avoids React 19's infinite loop detection with useSyncExternalStore
  const allItems = useQueueStore((state) => state.items);
  const items = useMemo(
    () => allItems.filter((item) => {
      // Submitted tab shows both 'queued' and 'submitted' items (all in-progress CVs)
      if (status === 'submitted') {
        return item.status === 'submitted' || item.status === 'queued';
      }
      return item.status === status;
    }),
    [allItems, status]
  );

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>
          {status === 'completed' && 'No completed CVs yet'}
          {status === 'submitted' && 'No CVs processing'}
          {status === 'failed' && 'No failed CVs'}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="space-y-2">
        {items.map((item) => (
          <QueueItem key={item.id} item={item} onExport={onExport} />
        ))}
      </div>
    </div>
  );
}
