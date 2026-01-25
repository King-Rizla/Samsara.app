import { useState, useRef, useEffect, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../lib/utils';

interface EditableFieldProps {
  value: string;
  cvId: string;
  fieldPath: string;
  confidence?: number;
  placeholder?: string;
  multiline?: boolean;
  validate?: (value: string) => string | null;
  onSave?: () => void;
}

const LOW_CONFIDENCE_THRESHOLD = 0.7;

export function EditableField({
  value,
  cvId,
  fieldPath,
  confidence,
  placeholder = 'Click to add',
  multiline = false,
  validate,
  onSave,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const isLowConfidence = confidence !== undefined && confidence < LOW_CONFIDENCE_THRESHOLD;

  // Sync with prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Debounced save function (400ms delay)
  const saveToDatabase = useCallback(
    async (newValue: string) => {
      if (validate) {
        const validationError = validate(newValue);
        if (validationError) {
          setError(validationError);
          return;
        }
      }

      try {
        await window.api.updateCVField(cvId, fieldPath, newValue);
        setError(null);
        onSave?.();
      } catch (err) {
        console.error('Failed to save field:', err);
        setError('Save failed');
      }
    },
    [cvId, fieldPath, validate, onSave]
  );

  const debouncedSave = useDebounce(saveToDatabase, 400);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setEditValue(newValue);
    setError(null);
    debouncedSave(newValue);
  };

  const handleBlur = () => {
    // Final save on blur (in case debounce hasn't fired yet)
    saveToDatabase(editValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
      setError(null);
    }
    if (e.key === 'Enter' && !multiline) {
      saveToDatabase(editValue);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    const inputClass = cn(
      'w-full bg-input border rounded px-2 py-1 text-foreground font-mono',
      'focus:outline-none focus:ring-1 focus:ring-primary',
      error && 'border-destructive focus:ring-destructive'
    );

    return (
      <div className="relative">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(inputClass, 'min-h-[60px] resize-y')}
            rows={3}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
        )}
        {error && (
          <span className="absolute -bottom-5 left-0 text-destructive text-xs">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={cn(
        'inline-block cursor-pointer px-1 py-0.5 rounded transition-colors min-w-[100px]',
        'hover:bg-primary/10',
        isLowConfidence && 'bg-warning/20 border border-warning',
        !value && 'text-muted-foreground italic'
      )}
      title={isLowConfidence ? 'Low confidence - click to review' : 'Click to edit'}
    >
      {value || placeholder}
    </span>
  );
}
