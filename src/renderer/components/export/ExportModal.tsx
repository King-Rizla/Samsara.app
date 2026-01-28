import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FolderOpen, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useSettingsStore } from '../../stores/settingsStore';

type ExportMode = 'full' | 'client' | 'punt';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cvId: string;           // Single CV export
  cvIds?: string[];       // Bulk export (optional)
  cvName?: string;        // Display name for single export
}

const MODE_INFO: Record<ExportMode, { label: string; description: string }> = {
  full: {
    label: 'Full',
    description: 'No redaction - all contact details visible',
  },
  client: {
    label: 'Client',
    description: 'Remove phone and email (recommended)',
  },
  punt: {
    label: 'Punt',
    description: 'Remove phone, email, and name',
  },
};

export function ExportModal({ isOpen, onClose, cvId, cvIds, cvName }: ExportModalProps) {
  const [mode, setMode] = useState<ExportMode>('client');
  const [includeBlindProfile, setIncludeBlindProfile] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputDir, setOutputDir] = useState<string | null>(null);

  const navigate = useNavigate();
  const { recruiter, loadRecruiterSettings } = useSettingsStore();

  // Determine if this is bulk export
  const isBulk = cvIds && cvIds.length > 1;
  const exportCount = isBulk ? cvIds.length : 1;

  // Load recruiter settings on mount
  useEffect(() => {
    if (isOpen) {
      loadRecruiterSettings();
      setError(null);
      setOutputDir(null);
    }
  }, [isOpen, loadRecruiterSettings]);

  // Check if recruiter is configured
  const recruiterConfigured = !!(recruiter.name || recruiter.phone || recruiter.email);

  const handleSelectFolder = async () => {
    const result = await window.api.selectFolder();
    if (!result.canceled && result.path) {
      setOutputDir(result.path);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const idsToExport = isBulk ? cvIds : [cvId];
      let successCount = 0;
      let lastOutputPath: string | undefined;
      let lastError: string | undefined;

      for (const id of idsToExport) {
        const result = await window.api.exportCV(id, mode, outputDir ?? undefined, includeBlindProfile);
        if (result.success) {
          successCount++;
          lastOutputPath = result.outputPath;
        } else {
          lastError = result.error;
          console.error(`Export failed for CV ${id}:`, result.error);
        }
      }

      if (successCount === idsToExport.length) {
        if (isBulk) {
          toast.success(`Exported ${successCount} CVs successfully`);
        } else {
          toast.success(`CV exported to ${lastOutputPath}`);
        }
        onClose();
      } else if (successCount > 0) {
        toast.warning(`Exported ${successCount}/${idsToExport.length} CVs`);
        onClose();
      } else {
        setError(lastError || 'Export failed. Please try again.');
      }
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-primary bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            {isBulk ? `Export ${exportCount} CVs` : 'Export CV'}
          </DialogTitle>
          <DialogDescription>
            {cvName && !isBulk ? `Exporting: ${cvName}` : 'Choose export settings'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Mode Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Export Mode</label>
            <div className="space-y-2">
              {(Object.entries(MODE_INFO) as [ExportMode, { label: string; description: string }][]).map(([key, info]) => (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    mode === key
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <input
                    type="radio"
                    name="export-mode"
                    value={key}
                    checked={mode === key}
                    onChange={() => setMode(key)}
                    className="mt-0.5 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-medium text-foreground">{info.label}</span>
                    <p className="text-sm text-muted-foreground">{info.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Blind Profile Toggle */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBlindProfile}
                onChange={(e) => setIncludeBlindProfile(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0"
              />
              <div>
                <span className="font-medium text-foreground">Include Blind Profile</span>
                <p className="text-sm text-muted-foreground">
                  Prepend a summary page with skills and recent experience
                </p>
              </div>
            </label>

            {/* Warning if recruiter not configured */}
            {includeBlindProfile && !recruiterConfigured && (
              <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-md">
                <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-warning font-medium">Recruiter details not configured</p>
                  <p className="text-muted-foreground">
                    Set up your contact details in{' '}
                    <a href="/settings" className="text-primary hover:underline" onClick={(e) => {
                      e.preventDefault();
                      onClose();
                      navigate('/settings');
                    }}>
                      Settings
                    </a>{' '}
                    for the blind profile footer.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Folder Selection (bulk export) */}
          {isBulk && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Export Location</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleSelectFolder}
                  className="flex-1 justify-start"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  {outputDir ? outputDir : 'Choose folder...'}
                </Button>
              </div>
              {!outputDir && (
                <p className="text-sm text-muted-foreground">
                  Select a folder for bulk export, or leave empty to use Downloads
                </p>
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
