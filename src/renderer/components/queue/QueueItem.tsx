import { useCallback } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { useEditorStore } from '../../stores/editorStore';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type { QueueItem as QueueItemType } from '../../types/cv';

interface QueueItemProps {
  item: QueueItemType;
}

// Animated ellipsis component for processing state
function AnimatedEllipsis() {
  return (
    <span className="inline-flex w-5">
      <span className="loading-dot">.</span>
      <span className="loading-dot">.</span>
      <span className="loading-dot">.</span>
    </span>
  );
}

export function QueueItem({ item }: QueueItemProps) {
  // Use boolean selector to avoid Set reference comparison issues with React 19
  const isSelected = useQueueStore((state) => state.selectedIds.has(item.id));
  const toggleSelect = useQueueStore((state) => state.toggleSelect);
  const selectRange = useQueueStore((state) => state.selectRange);

  const loadCV = useEditorStore((state) => state.loadCV);

  // Handle checkbox click - supports shift-click for range selection
  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.shiftKey) {
        e.preventDefault();
        selectRange(item.id);
      } else {
        toggleSelect(item.id);
      }
    },
    [toggleSelect, selectRange, item.id]
  );

  const setFailedItem = useEditorStore((state) => state.setFailedItem);

  // Handle filename click - opens CV editor for completed items, error panel for failed
  const handleFilenameClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (item.status === 'completed') {
        loadCV(item.id);
      } else if (item.status === 'failed') {
        setFailedItem(item);
      }
    },
    [loadCV, setFailedItem, item]
  );

  const getStatusBadge = () => {
    if (item.status === 'submitted') {
      const stageText = item.stage?.replace('...', '') || 'Processing';
      return (
        <Badge className="bg-status-submitted/20 text-status-submitted border border-status-submitted whitespace-nowrap">
          {stageText}<AnimatedEllipsis />
        </Badge>
      );
    }

    if (item.status === 'failed') {
      return (
        <Badge className="bg-status-failed/20 text-status-failed border border-status-failed">
          Error
        </Badge>
      );
    }

    if (item.status === 'completed' && item.parseConfidence !== undefined) {
      const isLow = item.parseConfidence < 0.7;
      return (
        <Badge
          className={cn(
            'border whitespace-nowrap',
            isLow
              ? 'bg-warning/20 text-warning border-warning'
              : 'bg-status-completed/20 text-status-completed border-status-completed'
          )}
          title={isLow ? 'Low confidence - may need review' : 'High confidence'}
        >
          {Math.round(item.parseConfidence * 100)}%
        </Badge>
      );
    }

    return null;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-colors',
        isSelected && 'bg-primary/10'
      )}
    >
      {/* Checkbox - shift-click here for range selection */}
      <input
        type="checkbox"
        checked={isSelected}
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onChange={() => {}} // Required for controlled input, actual logic in onClick
        onClick={handleCheckboxClick}
        className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
      />

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Filename - clickable for completed and failed items */}
          <span
            onClick={handleFilenameClick}
            className={cn(
              'font-medium truncate',
              (item.status === 'completed' || item.status === 'failed') &&
                'cursor-pointer hover:underline transition-colors',
              item.status === 'completed' && 'hover:text-primary',
              item.status === 'failed' && 'hover:text-status-failed'
            )}
          >
            {item.fileName}
          </span>
          <span className="text-xs text-muted-foreground uppercase flex-shrink-0">
            {item.fileType}
          </span>
        </div>
      </div>

      {/* Status badge */}
      {getStatusBadge()}
    </div>
  );
}
