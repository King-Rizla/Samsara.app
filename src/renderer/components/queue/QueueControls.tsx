import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { useQueueStore } from '../../stores/queueStore';
import { useEditorStore } from '../../stores/editorStore';
import { Button } from '../ui/button';

interface QueueControlsProps {
  onBulkExport?: (cvIds: string[]) => void;
}

export function QueueControls({ onBulkExport }: QueueControlsProps) {
  const selectedIds = useQueueStore((state) => state.selectedIds);
  const items = useQueueStore((state) => state.items);
  const clearSelection = useQueueStore((state) => state.clearSelection);
  const retryFailed = useQueueStore((state) => state.retryFailed);
  const deleteSelected = useQueueStore((state) => state.deleteSelected);

  const activeCVId = useEditorStore((state) => state.activeCVId);
  const failedItem = useEditorStore((state) => state.failedItem);
  const closePanel = useEditorStore((state) => state.closePanel);

  const selectedCount = selectedIds.size;

  // Memoize derived state to avoid recalculation on every render
  const hasFailedSelected = useMemo(() => {
    return [...selectedIds].some((id) => {
      const item = items.find((i) => i.id === id);
      return item?.status === 'failed';
    });
  }, [selectedIds, items]);

  // Check if any completed items are selected (for export)
  const completedSelectedIds = useMemo(() => {
    return [...selectedIds].filter((id) => {
      const item = items.find((i) => i.id === id);
      return item?.status === 'completed';
    });
  }, [selectedIds, items]);

  if (selectedCount === 0) {
    return null;
  }

  const handleRetry = async () => {
    const failedIds = [...selectedIds].filter((id) => {
      const item = items.find((i) => i.id === id);
      return item?.status === 'failed';
    });
    await retryFailed(failedIds);
  };

  const handleDelete = async () => {
    // Close panel if the currently viewed item is being deleted
    const currentViewedId = activeCVId || failedItem?.id;
    if (currentViewedId && selectedIds.has(currentViewedId)) {
      closePanel();
    }
    await deleteSelected();
  };

  const handleExport = () => {
    if (onBulkExport && completedSelectedIds.length > 0) {
      onBulkExport(completedSelectedIds);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {selectedCount} selected
      </span>

      {completedSelectedIds.length > 0 && onBulkExport && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          className="btn-terminal"
        >
          <Download className="h-4 w-4 mr-1" />
          Export {completedSelectedIds.length > 1 ? `(${completedSelectedIds.length})` : ''}
        </Button>
      )}

      {hasFailedSelected && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          className="btn-terminal"
        >
          Retry
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={handleDelete}
        className="text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive"
      >
        Delete
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={clearSelection}
        className="text-muted-foreground"
      >
        Clear
      </Button>
    </div>
  );
}
