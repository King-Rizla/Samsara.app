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
import { ArrowLeft, Settings } from 'lucide-react';

export function ProjectView() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const loadFromDatabase = useQueueStore((state) => state.loadFromDatabase);
  const loadJDs = useJDStore((state) => state.loadJDs);
  const viewMode = useEditorStore((state) => state.viewMode);
  const { selectProject, projects } = useProjectStore();

  const [showSettings, setShowSettings] = useState(false);

  const currentProject = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (projectId) {
      selectProject(projectId);
    }
  }, [projectId, selectProject]);

  useEffect(() => {
    if (projectId) {
      loadFromDatabase();
      loadJDs();
    }
  }, [projectId, loadFromDatabase, loadJDs]);

  const isPanelOpen = viewMode !== null || showSettings;

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
              navigate('/');
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Dashboard
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <span className="font-medium">{currentProject?.name || 'Project'}</span>
            {currentProject?.client_name && (
              <span className="text-muted-foreground ml-2">- {currentProject.client_name}</span>
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

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex">
        <div data-testid="queue-panel" className={`border-r border-border ${isPanelOpen ? 'w-1/3' : 'w-1/2'}`}>
          <QueueTabs />
        </div>

        <div data-testid="jd-panel" className={`border-r border-border ${isPanelOpen ? 'w-1/3' : 'w-1/2'}`}>
          <JDPanel />
        </div>

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
    </>
  );
}
