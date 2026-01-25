import { useCallback } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { useEditorStore } from '../../stores/editorStore';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type { QueueItem as QueueItemType } from '../../types/cv';

interface QueueItemProps {
  item: QueueItemType;
}

export function QueueItem({ item }: QueueItemProps) {
  // Use boolean selector to avoid Set reference comparison issues with React 19
  const isSelected = useQueueStore((state) => state.selectedIds.has(item.id));
  const toggleSelect = useQueueStore((state) => state.toggleSelect);
  const selectRange = useQueueStore((state) => state.selectRange);

  const loadCV = useEditorStore((state) => state.loadCV);

  const handleCheckboxChange = useCallback(() => {
    toggleSelect(item.id);
  }, [toggleSelect, item.id]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Shift-click for range selection
      if (e.shiftKey) {
        e.preventDefault();
        selectRange(item.id);
        return;
      }

      // Regular click to view/edit (only for completed items)
      if (item.status === 'completed') {
        loadCV(item.id);
      }
    },
    [selectRange, loadCV, item.id, item.status]
  );

  const getStatusBadge = () => {
    if (item.status === 'submitted' && item.stage) {
      return (
        <Badge className="bg-status-submitted/20 text-status-submitted border border-status-submitted">
          {item.stage}
        </Badge>
      );
    }

    if (item.status === 'failed') {
      return (
        <Badge className="bg-status-failed/20 text-status-failed border border-status-failed">
          {item.error || 'Failed'}
        </Badge>
      );
    }

    if (item.status === 'completed' && item.parseConfidence !== undefined) {
      const isLow = item.parseConfidence < 0.7;
      return (
        <Badge
          className={cn(
            'border',
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
        'flex items-center gap-3 px-4 py-3 hover:bg-card cursor-pointer transition-colors',
        isSelected && 'bg-primary/10',
        item.status === 'completed' && 'hover:bg-card'
      )}
      onClick={handleClick}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleCheckboxChange}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0"
      />

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{item.fileName}</span>
          <span className="text-xs text-muted-foreground uppercase">
            {item.fileType}
          </span>
        </div>
      </div>

      {/* Status badge */}
      {getStatusBadge()}
    </div>
  );
}
