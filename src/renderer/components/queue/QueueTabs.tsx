import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/input";
import { useQueueStore } from "../../stores/queueStore";
import { QueueList } from "./QueueList";
import { QueueControls } from "./QueueControls";
import { DropZone } from "./DropZone";
import { ExportModal } from "../export/ExportModal";

export function QueueTabs() {
  const items = useQueueStore((state) => state.items);
  const clearSelection = useQueueStore((state) => state.clearSelection);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportCvId, setExportCvId] = useState<string>("");
  const [exportCvIds, setExportCvIds] = useState<string[]>([]);
  const [exportCvName, setExportCvName] = useState<string>("");

  // Memoize counts to avoid recalculating on every render
  // Submitted tab shows both 'queued' and 'submitted' items (all in-progress CVs)
  const counts = useMemo(
    () => ({
      completed: items.filter((i) => i.status === "completed").length,
      submitted: items.filter(
        (i) => i.status === "submitted" || i.status === "queued",
      ).length,
      failed: items.filter((i) => i.status === "failed").length,
    }),
    [items],
  );

  // Batch completion detection
  // Track when submitted count was above threshold, then drops to 0
  const prevSubmittedRef = useRef(counts.submitted);
  const batchActiveRef = useRef(false);

  useEffect(() => {
    const prev = prevSubmittedRef.current;
    const curr = counts.submitted;

    // Batch becomes active when 5+ items are in progress
    if (curr >= 5) {
      batchActiveRef.current = true;
    }

    // Batch completes when active batch drops to 0
    if (batchActiveRef.current && prev > 0 && curr === 0) {
      batchActiveRef.current = false;
      const succeeded = counts.completed;
      const failed = counts.failed;
      toast.success(`Batch complete: ${succeeded} succeeded, ${failed} failed`);
    }

    prevSubmittedRef.current = curr;
  }, [counts.submitted, counts.completed, counts.failed]);

  // Clear selection when switching tabs
  const handleTabChange = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Handle single export from QueueItem
  const handleExport = useCallback((cvId: string, cvName: string) => {
    setExportCvId(cvId);
    setExportCvIds([]);
    setExportCvName(cvName);
    setExportModalOpen(true);
  }, []);

  // Handle bulk export from QueueControls
  const handleBulkExport = useCallback((cvIds: string[]) => {
    setExportCvId(cvIds[0]);
    setExportCvIds(cvIds);
    setExportCvName("");
    setExportModalOpen(true);
  }, []);

  // Close export modal
  const handleCloseExport = useCallback(() => {
    setExportModalOpen(false);
    setExportCvId("");
    setExportCvIds([]);
    setExportCvName("");
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Tabs
        defaultValue="completed"
        className="flex-1 flex flex-col"
        onValueChange={handleTabChange}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-border">
          <TabsList className="bg-transparent gap-2">
            <TabsTrigger
              value="completed"
              className="border border-border hover:border-primary transition-colors data-[state=active]:bg-status-completed/20 data-[state=active]:text-status-completed data-[state=active]:border-status-completed"
            >
              Completed ({counts.completed})
            </TabsTrigger>
            <TabsTrigger
              value="submitted"
              className="border border-border hover:border-primary transition-colors data-[state=active]:bg-status-submitted/20 data-[state=active]:text-status-submitted data-[state=active]:border-status-submitted"
            >
              Submitted ({counts.submitted})
            </TabsTrigger>
            <TabsTrigger
              value="failed"
              className="border border-border hover:border-primary transition-colors data-[state=active]:bg-status-failed/20 data-[state=active]:text-status-failed data-[state=active]:border-status-failed"
            >
              Failed ({counts.failed})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-48 h-8"
              />
            </div>
            <QueueControls onBulkExport={handleBulkExport} />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden relative">
          <TabsContent value="completed" className="absolute inset-0 m-0 p-0">
            <QueueList
              status="completed"
              onExport={handleExport}
              searchQuery={searchQuery}
            />
          </TabsContent>
          <TabsContent value="submitted" className="absolute inset-0 m-0 p-0">
            <QueueList status="submitted" searchQuery={searchQuery} />
          </TabsContent>
          <TabsContent value="failed" className="absolute inset-0 m-0 p-0">
            <QueueList status="failed" searchQuery={searchQuery} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Drop zone at bottom */}
      <DropZone />

      {/* Export modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={handleCloseExport}
        cvId={exportCvId}
        cvIds={exportCvIds.length > 0 ? exportCvIds : undefined}
        cvName={exportCvName || undefined}
      />
    </div>
  );
}
