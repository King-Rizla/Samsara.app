import { useEffect } from 'react';
import { QueueTabs } from './components/queue/QueueTabs';
import { CVEditor } from './components/editor/CVEditor';
import { ErrorDetailPanel } from './components/editor/ErrorDetailPanel';
import { useQueueStore } from './stores/queueStore';
import { useEditorStore } from './stores/editorStore';
import './styles/globals.css';

export function App() {
  const loadFromDatabase = useQueueStore((state) => state.loadFromDatabase);
  const viewMode = useEditorStore((state) => state.viewMode);

  // Load existing CVs from database on mount
  useEffect(() => {
    loadFromDatabase();
  }, [loadFromDatabase]);

  const isPanelOpen = viewMode !== null;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div>
          <h1 className="text-lg font-bold text-primary">Samsara</h1>
        </div>
      </header>

      {/* Main content - split view when panel is open */}
      <main className="flex-1 overflow-hidden flex">
        {/* Queue panel - takes full width when no panel, 50% when viewing */}
        <div className={isPanelOpen ? 'w-1/2 border-r border-border' : 'w-full'}>
          <QueueTabs />
        </div>

        {/* Detail panel - shows CV editor or error details based on viewMode */}
        {viewMode === 'cv' && (
          <div className="w-1/2">
            <CVEditor />
          </div>
        )}
        {viewMode === 'error' && (
          <div className="w-1/2">
            <ErrorDetailPanel />
          </div>
        )}
      </main>
    </div>
  );
}
