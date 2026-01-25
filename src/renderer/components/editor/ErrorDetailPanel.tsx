import { useEditorStore } from '../../stores/editorStore';
import { useQueueStore } from '../../stores/queueStore';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export function ErrorDetailPanel() {
  const failedItem = useEditorStore((state) => state.failedItem);
  const closePanel = useEditorStore((state) => state.closePanel);
  const retryFailed = useQueueStore((state) => state.retryFailed);

  if (!failedItem) {
    return null;
  }

  const handleRetry = async () => {
    await retryFailed([failedItem.id]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="h-full flex flex-col bg-background border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-foreground">Error Details</h2>
          <Badge className="bg-status-failed/20 text-status-failed border border-status-failed">
            Failed
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={closePanel}
          className="text-muted-foreground hover:text-foreground"
        >
          Close
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* File Information */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            File Information
          </h3>
          <div className="space-y-2 bg-card p-4 border border-border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">File Name</span>
              <span className="font-medium">{failedItem.fileName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium uppercase">{failedItem.fileType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Submitted</span>
              <span className="font-medium">{formatDate(failedItem.createdAt)}</span>
            </div>
          </div>
        </section>

        {/* File Path */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            File Path
          </h3>
          <div className="bg-card p-4 border border-border">
            <code className="text-sm break-all text-muted-foreground">
              {failedItem.filePath}
            </code>
          </div>
        </section>

        {/* Error Message */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-status-failed uppercase tracking-wider">
            Error Message
          </h3>
          <div className="bg-status-failed/10 border border-status-failed p-4">
            <pre className="text-sm text-status-failed whitespace-pre-wrap break-words font-mono">
              {failedItem.error || 'Unknown error occurred'}
            </pre>
          </div>
        </section>

        {/* Troubleshooting Tips */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Troubleshooting
          </h3>
          <div className="bg-card p-4 border border-border space-y-2 text-sm text-muted-foreground">
            <p>Common causes for CV parsing failures:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>File is corrupted or password-protected</li>
              <li>File contains only images (scanned document)</li>
              <li>Unsupported file format or encoding</li>
              <li>Network error during LLM extraction</li>
              <li>API rate limit exceeded</li>
            </ul>
          </div>
        </section>

        {/* Actions */}
        <section className="pt-4 border-t border-border">
          <Button
            onClick={handleRetry}
            className="w-full bg-primary hover:bg-primary/90"
          >
            Retry Processing
          </Button>
        </section>
      </div>
    </div>
  );
}
