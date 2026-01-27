import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QueueTabs } from '../components/queue/QueueTabs';
import { CVEditor } from '../components/editor/CVEditor';
import { ErrorDetailPanel } from '../components/editor/ErrorDetailPanel';
import { JDPanel } from '../components/jd/JDPanel';
import { JDDetail } from '../components/jd/JDDetail';
import { LLMSettings } from '../components/settings/LLMSettings';
import { Button } from '../components/ui/button';
import { useQueueStore } from '../stores/queueStore';
import { useEditorStore } from '../stores/editorStore';
import { useJDStore } from '../stores/jdStore';
import { useProjectStore } from '../stores/projectStore';

export function ProjectView() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const loadFromDatabase = useQueueStore((state) => state.loadFromDatabase);
  const loadJDs = useJDStore((state) => state.loadJDs);
  const viewMode = useEditorStore((state) => state.viewMode);
  const { selectProject, projects } = useProjectStore();

  const [showSettings, setShowSettings] = useState(false);

  // Get current project info
  const currentProject = projects.find((p) => p.id === projectId);

  // Set active project and reload data when project changes
  useEffect(() => {
    if (projectId) {
      selectProject(projectId);
    }
  }, [projectId, selectProject]);

  // Reload CVs and JDs when project is selected
  useEffect(() => {
    if (projectId) {
      loadFromDatabase();
      loadJDs();
    }
  }, [projectId, loadFromDatabase, loadJDs]);

  const isPanelOpen = viewMode !== null || showSettings;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              selectProject(null);
              navigate('/');
            }}
          >
            ← Dashboard
          </Button>
          <div>
            <h1 className="text-lg font-bold text-primary">
              {currentProject?.name || 'Project'}
            </h1>
            {currentProject?.client_name && (
              <p className="text-xs text-muted-foreground">{currentProject.client_name}</p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
        >
          {showSettings ? 'Close Settings' : 'Settings'}
        </Button>
      </header>

      {/* Main content - three column layout (unchanged from current App.tsx) */}
      <main className="flex-1 overflow-hidden flex">
        {/* Queue panel - left side */}
        <div data-testid="queue-panel" className={`border-r border-border ${isPanelOpen ? 'w-1/3' : 'w-1/2'}`}>
          <QueueTabs />
        </div>

        {/* JD panel - middle */}
        <div data-testid="jd-panel" className={`border-r border-border ${isPanelOpen ? 'w-1/3' : 'w-1/2'}`}>
          <JDPanel />
        </div>

        {/* Detail panel - right side (CV editor, error details, or settings) */}
        {showSettings && (
          <div className="w-1/3 border-l border-border">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-medium text-foreground">Settings</h2>
            </div>
            <LLMSettings />
          </div>
        )}
        {!showSettings && viewMode === 'cv' && (
          <div className="w-1/3">
            <CVEditor />
          </div>
        )}
        {!showSettings && viewMode === 'error' && (
          <div className="w-1/3">
            <ErrorDetailPanel />
          </div>
        )}
        {!showSettings && viewMode === 'jd' && (
          <div className="w-1/3 overflow-y-auto">
            <JDDetail />
          </div>
        )}
      </main>
    </div>
  );
}
