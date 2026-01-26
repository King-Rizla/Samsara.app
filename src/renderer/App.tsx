import { useEffect } from 'react';
import { QueueTabs } from './components/queue/QueueTabs';
import { CVEditor } from './components/editor/CVEditor';
import { ErrorDetailPanel } from './components/editor/ErrorDetailPanel';
import { JDPanel } from './components/jd/JDPanel';
import { useQueueStore } from './stores/queueStore';
import { useEditorStore } from './stores/editorStore';
import { useJDStore } from './stores/jdStore';
import './styles/globals.css';

export function App() {
  const loadFromDatabase = useQueueStore((state) => state.loadFromDatabase);
  const loadJDs = useJDStore((state) => state.loadJDs);
  const viewMode = useEditorStore((state) => state.viewMode);

  // Load existing CVs and JDs from database on mount
  useEffect(() => {
    loadFromDatabase();
    loadJDs();
  }, [loadFromDatabase, loadJDs]);

  const isPanelOpen = viewMode !== null;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div>
          <h1 className="text-lg font-bold text-primary">Samsara</h1>
        </div>
      </header>

      {/* Main content - three column layout */}
      <main className="flex-1 overflow-hidden flex">
        {/* Queue panel - left side */}
        <div className={`border-r border-border ${isPanelOpen ? 'w-1/3' : 'w-1/2'}`}>
          <QueueTabs />
        </div>

        {/* JD panel - middle */}
        <div className={`border-r border-border ${isPanelOpen ? 'w-1/3' : 'w-1/2'}`}>
          <JDPanel />
        </div>

        {/* Detail panel - right side (CV editor or error details) */}
        {viewMode === 'cv' && (
          <div className="w-1/3">
            <CVEditor />
          </div>
        )}
        {viewMode === 'error' && (
          <div className="w-1/3">
            <ErrorDetailPanel />
          </div>
        )}
      </main>
    </div>
  );
}
