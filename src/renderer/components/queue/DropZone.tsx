import { useState, useCallback } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { cn } from '../../lib/utils';

export function DropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const addItem = useQueueStore((state) => state.addItem);
  const updateStatus = useQueueStore((state) => state.updateStatus);
  const updateStage = useQueueStore((state) => state.updateStage);

  const processFile = useCallback(
    async (fileName: string, filePath: string) => {
      const fileType = fileName.split('.').pop()?.toLowerCase() || 'unknown';
      const itemId = crypto.randomUUID();

      // Add to queue as submitted
      addItem({
        id: itemId,
        fileName,
        fileType,
        filePath,
        status: 'submitted',
        stage: 'Parsing...',
      });

      try {
        // Update stage as processing continues
        updateStage(itemId, 'Extracting...');

        const result = await window.api.extractCV(filePath);

        if (result.success && result.data) {
          updateStage(itemId, 'Saving...');

          // Small delay to show saving stage
          await new Promise((resolve) => setTimeout(resolve, 200));

          updateStatus(itemId, 'completed', {
            data: result.data,
            parseConfidence: result.data.parse_confidence,
          });
        } else {
          updateStatus(itemId, 'failed', {
            error: result.error || 'Extraction failed',
          });
        }
      } catch (err) {
        updateStatus(itemId, 'failed', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [addItem, updateStatus, updateStage]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const validExtensions = ['.pdf', '.docx', '.doc'];

      for (const file of files) {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!validExtensions.includes(ext)) {
          console.warn(`Skipping unsupported file: ${file.name}`);
          continue;
        }

        const filePath = window.electronFile.getPath(file);
        if (filePath) {
          processFile(file.name, filePath);
        }
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
