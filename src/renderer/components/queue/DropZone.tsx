import { useState, useCallback } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { useProjectStore } from '../../stores/projectStore';
import { cn } from '../../lib/utils';

export function DropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const addItem = useQueueStore((state) => state.addItem);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);

  const processFile = useCallback(
    async (fileName: string, filePath: string) => {
      const fileType = fileName.split('.').pop()?.toLowerCase() || 'unknown';

      try {
        // Enqueue CV - this is instant, just persists to DB
        const result = await window.api.enqueueCV(fileName, filePath, activeProjectId || undefined);

        if (result.success && result.id) {
          // Add to queue store with 'queued' status
          // Status updates will come via push notifications
          addItem({
            id: result.id,
            fileName,
            fileType,
            filePath,
            status: 'queued',
            stage: 'Queued...',
          });
        } else {
          // Failed to enqueue - add as failed item locally
          addItem({
            fileName,
            fileType,
            filePath,
            status: 'failed',
            error: result.error || 'Failed to enqueue',
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        addItem({
          fileName,
          fileType,
          filePath,
          status: 'failed',
          error: errorMessage,
        });
      }
    },
    [addItem, activeProjectId]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const validExtensions = ['.pdf', '.docx', '.doc'];

      // Collect valid files first
      const validFiles: { name: string; path: string }[] = [];
      for (const file of files) {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!validExtensions.includes(ext)) {
          console.warn(`Skipping unsupported file: ${file.name}`);
          continue;
        }

        const filePath = window.electronFile.getPath(file);
        if (filePath) {
          validFiles.push({ name: file.name, path: filePath });
        }
      }

      // Process files sequentially to avoid timeout issues
      // Python sidecar handles one file at a time, so parallel requests just queue up and timeout
      for (const file of validFiles) {
        await processFile(file.name, file.path);
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(async () => {
    const result = await window.api.selectCVFile();

    if (result.success && result.filePath && result.fileName) {
      processFile(result.fileName, result.filePath);
    }
  }, [processFile]);

  return (
    <div
      data-testid="drop-zone"
      className={cn(
        'border-t border-border p-4 cursor-pointer transition-colors',
        isDragging ? 'bg-primary/10 border-primary' : 'hover:bg-card'
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <div className="flex items-center justify-center gap-2 text-muted-foreground">
        <span className="text-2xl">+</span>
        <span>Drop CV files here or click to select</span>
      </div>
    </div>
  );
}
