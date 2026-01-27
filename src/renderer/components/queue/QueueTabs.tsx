import { useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useQueueStore } from '../../stores/queueStore';
import { QueueList } from './QueueList';
import { QueueControls } from './QueueControls';
import { DropZone } from './DropZone';

export function QueueTabs() {
  const items = useQueueStore((state) => state.items);
  const clearSelection = useQueueStore((state) => state.clearSelection);

  // Memoize counts to avoid recalculating on every render
  // Submitted tab shows both 'queued' and 'submitted' items (all in-progress CVs)
  const counts = useMemo(() => ({
    completed: items.filter((i) => i.status === 'completed').length,
    submitted: items.filter((i) => i.status === 'submitted' || i.status === 'queued').length,
    failed: items.filter((i) => i.status === 'failed').length,
  }), [items]);

  // Clear selection when switching tabs
  const handleTabChange = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="completed" className="flex-1 flex flex-col" onValueChange={handleTabChange}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <TabsList className="bg-transparent">
            <TabsTrigger
              value="completed"
              className="data-[state=active]:bg-status-completed/20 data-[state=active]:text-status-completed"
            >
              Completed ({counts.completed})
            </TabsTrigger>
            <TabsTrigger
              value="submitted"
              className="data-[state=active]:bg-status-submitted/20 data-[state=active]:text-status-submitted"
            >
              Submitted ({counts.submitted})
            </TabsTrigger>
            <TabsTrigger
              value="failed"
              className="data-[state=active]:bg-status-failed/20 data-[state=active]:text-status-failed"
            >
              Failed ({counts.failed})
            </TabsTrigger>
          </TabsList>

          <QueueControls />
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="completed" className="h-full m-0 p-0">
            <QueueList status="completed" />
          </TabsContent>
          <TabsContent value="submitted" className="h-full m-0 p-0">
            <QueueList status="submitted" />
          </TabsContent>
          <TabsContent value="failed" className="h-full m-0 p-0">
            <QueueList status="failed" />
          </TabsContent>
        </div>
      </Tabs>

      {/* Drop zone at bottom */}
      <DropZone />
    </div>
  );
}
