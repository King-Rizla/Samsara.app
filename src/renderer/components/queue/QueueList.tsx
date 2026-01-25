import { useMemo } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { QueueItem } from './QueueItem';
import type { QueueStatus } from '../../types/cv';

interface QueueListProps {
  status: QueueStatus;
}

export function QueueList({ status }: QueueListProps) {
  // Get stable reference to items array, then filter with useMemo
  // This avoids React 19's infinite loop detection with useSyncExternalStore
  const allItems = useQueueStore((state) => state.items);
  const items = useMemo(
    () => allItems.filter((item) => item.status === status),
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
    <div className="h-full overflow-y-auto">
      <div className="divide-y divide-border">
        {items.map((item) => (
          <QueueItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
