import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { VariableDropdown } from "./VariableDropdown";
import { useTemplateStore } from "../../stores/templateStore";
import { useProjectStore } from "../../stores/projectStore";
import { Save, X, Mail, MessageSquare } from "lucide-react";
import type {
  MessageTemplate,
  TemplateVariable,
} from "../../types/communication";

interface TemplateEditorProps {
  template?: MessageTemplate | null;
  onClose: () => void;
  onSave?: (template: MessageTemplate) => void;
}

// SMS segment info: 160 chars for GSM-7, 70 for Unicode
const SMS_SEGMENT_LENGTH = 160;
const SMS_CONCAT_SEGMENT_LENGTH = 153; // Concatenated messages use 7 chars for header

/**
 * Calculate SMS segment count for a message body.
 */
function calculateSmsSegments(body: string): {
  chars: number;
  segments: number;
} {
  const chars = body.length;
  if (chars === 0) return { chars: 0, segments: 0 };
  if (chars <= SMS_SEGMENT_LENGTH) return { chars, segments: 1 };
  // Concatenated message
  return { chars, segments: Math.ceil(chars / SMS_CONCAT_SEGMENT_LENGTH) };
}

/**
 * Generate preview by replacing {{variable}} with example data.
 * Done client-side for instant feedback.
 */
function generatePreview(body: string, variables: TemplateVariable[]): string {
  const exampleData: Record<string, string> = {};
  for (const v of variables) {
    exampleData[v.key] = v.example;
  }
  return body.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return exampleData[key] ?? match;
  });
}

/**
 * Side-by-side template editor with live preview.
 * Supports SMS and email templates with variable substitution.
 */
export function TemplateEditor({
  template,
  onClose,
  onSave,
}: TemplateEditorProps) {
  const isEditing = Boolean(template);

  // Form state
  const [name, setName] = useState(template?.name ?? "");
  const [type, setType] = useState<"sms" | "email">(template?.type ?? "sms");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const { availableVariables, createTemplate, updateTemplate, loadVariables } =
    useTemplateStore();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);

  // Load variables on mount
  useEffect(() => {
    if (availableVariables.length === 0) {
      loadVariables();
    }
  }, [availableVariables.length, loadVariables]);

  // Generate preview with example data
  const preview = useMemo(() => {
    return generatePreview(body, availableVariables);
  }, [body, availableVariables]);

  const subjectPreview = useMemo(() => {
    return generatePreview(subject, availableVariables);
  }, [subject, availableVariables]);

  // SMS segment info
  const smsInfo = useMemo(() => {
    return type === "sms" ? calculateSmsSegments(body) : null;
  }, [type, body]);

  // Insert variable at cursor position
  const handleInsertVariable = (variableKey: string) => {
    const textarea = bodyRef.current;
    if (!textarea) {
      setBody((prev) => prev + `{{${variableKey}}}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const variableText = `{{${variableKey}}}`;

    const newBody =
      body.substring(0, start) + variableText + body.substring(end);
    setBody(newBody);

    // Restore focus and cursor position after variable insertion
    requestAnimationFrame(() => {
      textarea.focus();
      const newCursorPos = start + variableText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  };

  // Form validation
  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (!body.trim()) return false;
    if (type === "email" && !subject.trim()) return false;
    return true;
  }, [name, body, type, subject]);

  // Save handler
  const handleSave = async () => {
    if (!isValid || !activeProjectId) return;

    setIsSaving(true);
    try {
      if (isEditing && template) {
        // Update existing template
        const success = await updateTemplate(template.id, {
          name: name.trim(),
          subject: type === "email" ? subject.trim() : undefined,
          body: body.trim(),
        });
        if (success) {
          onSave?.({
            ...template,
            name: name.trim(),
            subject: type === "email" ? subject.trim() : undefined,
            body: body.trim(),
            updatedAt: new Date().toISOString(),
          });
          onClose();
        }
      } else {
        // Create new template
        const newTemplate = await createTemplate({
          projectId: activeProjectId,
          name: name.trim(),
          type,
          subject: type === "email" ? subject.trim() : undefined,
          body: body.trim(),
        });
        if (newTemplate) {
          onSave?.(newTemplate);
          onClose();
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-4 min-w-0 flex-shrink">
          <h2 className="text-lg font-medium truncate">
            {isEditing ? "Edit Template" : "New Template"}
          </h2>

          {/* Type toggle (only for new templates) */}
          {!isEditing && (
            <div className="flex items-center gap-1 bg-muted rounded-md p-1 flex-shrink-0">
              <Button
                variant={type === "sms" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setType("sms")}
                className="h-7"
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                SMS
              </Button>
              <Button
                variant={type === "email" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setType("email")}
                className="h-7"
              >
                <Mail className="h-4 w-4 mr-1" />
                Email
              </Button>
            </div>
          )}

          <VariableDropdown
            variables={availableVariables}
            onInsert={handleInsertVariable}
            disabled={isSaving}
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isValid || isSaving}
          >
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Main content: side-by-side editor and preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor panel */}
        <div className="flex-1 flex flex-col p-4 border-r border-border overflow-auto">
          <div className="space-y-4">
            {/* Template name */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Template Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Initial Outreach"
                disabled={isSaving}
              />
            </div>

            {/* Subject line for email */}
            {type === "email" && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Subject Line
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Exciting opportunity at {{company_name}}"
                  disabled={isSaving}
                />
              </div>
            )}

            {/* Message body */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-foreground">
                  Message Body
                </label>
                {smsInfo && (
                  <span className="text-xs text-muted-foreground">
                    {smsInfo.chars} chars / {smsInfo.segments} segment
                    {smsInfo.segments !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={
                  type === "sms"
                    ? "Hi {{candidate_first_name}}, I'm reaching out about the {{role_title}} role at {{company_name}}..."
                    : "Dear {{candidate_name}},\n\nI hope this message finds you well. I'm reaching out regarding..."
                }
                className="w-full h-64 px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {"{{variable}}"} syntax to insert dynamic content
              </p>
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div className="flex-1 flex flex-col p-4 bg-muted/30 overflow-auto">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Live Preview
          </h3>

          <div className="flex-1 bg-background rounded-md border border-border p-4">
            {type === "email" && subject && (
              <div className="mb-4 pb-4 border-b border-border">
                <span className="text-xs text-muted-foreground block mb-1">
                  Subject:
                </span>
                <p className="font-medium">{subjectPreview || subject}</p>
              </div>
            )}

            <div className="whitespace-pre-wrap text-sm">
              {preview || (
                <span className="text-muted-foreground italic">
                  Start typing to see preview...
                </span>
              )}
            </div>
          </div>

          {type === "sms" && smsInfo && smsInfo.segments > 1 && (
            <p className="text-xs text-amber-600 mt-2">
              This message will be sent as {smsInfo.segments} SMS segments
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default TemplateEditor;
