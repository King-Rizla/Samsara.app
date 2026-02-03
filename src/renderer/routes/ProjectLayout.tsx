import { useEffect, useState } from "react";
import { Outlet, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Settings, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { LLMSettings } from "../components/settings/LLMSettings";
import { TemplateEditor, TemplateList } from "../components/templates";
import { useQueueStore } from "../stores/queueStore";
import { useJDStore } from "../stores/jdStore";
import { useProjectStore } from "../stores/projectStore";
import type { MessageTemplate } from "../types/communication";

export function ProjectLayout() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const loadFromDatabase = useQueueStore((state) => state.loadFromDatabase);
  const { loadJDs, clearActiveJD } = useJDStore();
  const { selectProject, projects } = useProjectStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<MessageTemplate | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  const currentProject = projects.find((p) => p.id === projectId);

  // Initialize stores on project change
  useEffect(() => {
    if (projectId) {
      selectProject(projectId);
    }
  }, [projectId, selectProject]);

  useEffect(() => {
    if (projectId) {
      clearActiveJD();
      loadFromDatabase();
      loadJDs();
    }
  }, [projectId, clearActiveJD, loadFromDatabase, loadJDs]);

  return (
    <>
      {/* Project-specific header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              selectProject(null);
              navigate("/");
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Dashboard
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <span className="font-medium">
              {currentProject?.name || "Project"}
            </span>
            {currentProject?.client_name && (
              <span className="text-muted-foreground ml-2">
                - {currentProject.client_name}
              </span>
            )}
          </div>
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
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

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

      {/* Settings panel (project-level, above section content) */}
      {showSettings && (
        <div className="border-b border-border">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-foreground">Settings</h2>
          </div>
          <LLMSettings />
        </div>
      )}

      {/* Route content (instant transitions) */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </div>
    </>
  );
}
