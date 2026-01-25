import type { QueueItem as QueueItemType } from '../../types/cv';

interface QueueItemProps {
  item: QueueItemType;
}

// Placeholder - will be implemented in Task 2
export function QueueItem({ item }: QueueItemProps) {
  return (
    <div className="px-4 py-3">
      <span>{item.fileName}</span>
    </div>
  );
}
