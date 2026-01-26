import { useState, useRef } from 'react';
import { Button } from '../ui/button';
import { useJDStore } from '../../stores/jdStore';

/**
 * JDInput component for inputting job descriptions.
 * Supports both pasting text directly and uploading .txt files.
 */
export function JDInput() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { extractJD, isExtracting } = useJDStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError('Please paste a job description or upload a file');
      return;
    }

    setError(null);
    const result = await extractJD(text);

    if (result.success) {
      setText('');  // Clear on success
    } else {
      setError(result.error || 'Failed to extract JD');
    }
  };

  // File upload handler - reads .txt file content into textarea
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
      setError('Please upload a .txt file');
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      setError('File too large. Maximum size is 1MB.');
      return;
    }

    try {
      const content = await file.text();
      setText(content);
      setError(null);
    } catch (err) {
      setError('Failed to read file');
    }

    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <label htmlFor="jd-input" className="block text-sm font-medium text-foreground mb-2">
          Paste Job Description or Upload File
        </label>
        <textarea
          id="jd-input"
          data-testid="jd-input-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the full job description here, or use the 'Upload File' button below..."
          className="w-full h-64 p-3 bg-muted border border-border rounded-md
                     text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:ring-2 focus:ring-primary
                     font-mono text-sm resize-none"
          disabled={isExtracting}
        />
      </div>

      {/* File upload section */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isExtracting}
          data-testid="jd-file-input"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleBrowseClick}
          disabled={isExtracting}
          data-testid="jd-upload-button"
        >
          Upload .txt File
        </Button>
        <span className="text-xs text-muted-foreground">
          or paste JD text directly above
        </span>
      </div>

      {error && (
        <p className="text-sm text-destructive" data-testid="jd-error">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setText('')}
          disabled={isExtracting || !text}
          data-testid="jd-clear-button"
        >
          Clear
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isExtracting || !text.trim()}
          data-testid="jd-submit-button"
        >
          {isExtracting ? 'Extracting...' : 'Extract Requirements'}
        </Button>
      </div>

      {isExtracting && (
        <p className="text-sm text-muted-foreground">
          Analyzing job description with AI... This may take 30-60 seconds.
        </p>
      )}
    </div>
  );
}
