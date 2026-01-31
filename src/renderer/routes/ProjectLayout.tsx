import { useEffect, useState } from "react";
import { Outlet, useParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Settings } from "lucide-react";
import { Button } from "../components/ui/button";
import { LLMSettings } from "../components/settings/LLMSettings";
import { useQueueStore } from "../stores/queueStore";
import { useEditorStore } from "../stores/editorStore";
import { useJDStore } from "../stores/jdStore";
import { useProjectStore } from "../stores/projectStore";

export function ProjectLayout() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const loadFromDatabase = useQueueStore((state) => state.loadFromDatabase);
  const { loadJDs, clearActiveJD } = useJDStore();
  const { selectProject, projects } = useProjectStore();

  const [showSettings, setShowSettings] = useState(false);

  const currentProject = projects.find((p) => p.id === projectId);
  const isWheelView = /^\/project\/[^/]+$/.test(location.pathname);

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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Settings panel (project-level, above section content) */}
      {showSettings && (
        <div className="border-b border-border">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-foreground">Settings</h2>
          </div>
          <LLMSettings />
        </div>
      )}

      {/* Animated route content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={isWheelView ? "wheel" : location.pathname}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex-1 overflow-hidden flex flex-col"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </>
  );
}
