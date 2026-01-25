import { useQueueStore } from '../../stores/queueStore';
import { Button } from '../ui/button';

export function QueueControls() {
  const selectedIds = useQueueStore((state) => state.selectedIds);
  const items = useQueueStore((state) => state.items);
  const clearSelection = useQueueStore((state) => state.clearSelection);
  const retryFailed = useQueueStore((state) => state.retryFailed);
  const deleteSelected = useQueueStore((state) => state.deleteSelected);

  const selectedCount = selectedIds.size;

  // Check if any selected items are failed (for retry button)
  const hasFailedSelected = [...selectedIds].some((id) => {
    const item = items.find((i) => i.id === id);
    return item?.status === 'failed';
  });

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
    await deleteSelected();
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {selectedCount} selected
      </span>

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
