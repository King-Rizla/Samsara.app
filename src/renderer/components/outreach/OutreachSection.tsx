/**
 * OutreachSection - Main component for the Outreach wheel wedge
 *
 * Layout:
 * - Kanban board showing workflow pipeline
 * - Side panel for candidate details
 *
 * Features:
 * - 6-column Kanban board (Pending, Contacted, Replied, Screening, Passed, Failed)
 * - Drag-and-drop for manual workflow transitions
 * - Candidate cards with name, match %, last message snippet
 * - Side panel with full details and message timeline
 * - Templates and Communication settings access
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Settings, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { CommunicationSettings } from "../settings/CommunicationSettings";
import { TemplateEditor, TemplateList } from "../templates";
import { KanbanBoard } from "./KanbanBoard";
import { CandidatePanel } from "./CandidatePanel";
import { useWorkflowStore } from "../../stores/workflowStore";
import type { MessageTemplate } from "../../types/communication";

export function OutreachSection() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Templates and Communication settings state
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCommunication, setShowCommunication] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<MessageTemplate | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  // Workflow store
  const loadCandidates = useWorkflowStore((state) => state.loadCandidates);
  const isLoading = useWorkflowStore((state) => state.isLoading);
  const candidates = useWorkflowStore((state) => state.candidates);

  // Load workflow candidates on mount
  useEffect(() => {
    if (projectId) {
      loadCandidates(projectId);
    }
  }, [projectId, loadCandidates]);

  // Start reply polling on mount (for reply detection and workflow triggers)
  useEffect(() => {
    if (projectId) {
      window.api.startReplyPolling(projectId);
    }
    return () => {
      window.api.stopReplyPolling();
    };
  }, [projectId]);

  return (
    <div className="flex flex-col h-full">
      {/* Section header with Templates and Settings buttons */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/project/${projectId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Project Home
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="font-medium text-sm">Outreach Pipeline</span>
          <span className="text-xs text-muted-foreground">
            ({candidates.length} candidates)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTemplates(true)}
          >
            <FileText className="h-4 w-4 mr-1" />
            Templates
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCommunication(true)}
          >
            <Settings className="h-4 w-4 mr-1" />
            Communication
          </Button>
        </div>
      </div>

      {/* Main content - Kanban board */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <KanbanBoard />
        )}
      </div>

      {/* Candidate detail panel (side panel) */}
      {projectId && <CandidatePanel projectId={projectId} />}

      {/* Communication settings sheet */}
      <Sheet open={showCommunication} onOpenChange={setShowCommunication}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl p-0 overflow-y-auto"
        >
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle>Communication Settings</SheetTitle>
          </SheetHeader>
          <CommunicationSettings />
        </SheetContent>
      </Sheet>

      {/* Templates management sheet */}
      <Sheet open={showTemplates} onOpenChange={setShowTemplates}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
          {editingTemplate || isCreatingTemplate ? (
            <TemplateEditor
              template={editingTemplate}
              onClose={() => {
                setEditingTemplate(null);
                setIsCreatingTemplate(false);
              }}
              onSave={() => {
                setEditingTemplate(null);
                setIsCreatingTemplate(false);
              }}
            />
          ) : (
            <>
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle>Message Templates</SheetTitle>
              </SheetHeader>
              <TemplateList
                onEdit={(template) => setEditingTemplate(template)}
                onNew={() => setIsCreatingTemplate(true)}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
