import { useEffect } from 'react';
import { QueueTabs } from './components/queue/QueueTabs';
import { CVEditor } from './components/editor/CVEditor';
import { useQueueStore } from './stores/queueStore';
import { useEditorStore } from './stores/editorStore';
import './styles/globals.css';

export function App() {
  const loadFromDatabase = useQueueStore((state) => state.loadFromDatabase);
  const activeCVId = useEditorStore((state) => state.activeCVId);

  // Load existing CVs from database on mount
  useEffect(() => {
    loadFromDatabase();
  }, [loadFromDatabase]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div>
          <h1 className="text-lg font-bold text-primary">Samsara</h1>
        </div>
      </header>

      {/* Main content - split view when CV is selected */}
      <main className="flex-1 overflow-hidden flex">
        {/* Queue panel - takes full width when no CV selected, 50% when editing */}
        <div className={activeCVId ? 'w-1/2 border-r border-border' : 'w-full'}>
          <QueueTabs />
        </div>

        {/* Editor panel - only visible when CV selected */}
        {activeCVId && (
          <div className="w-1/2">
            <CVEditor />
          </div>
        )}
      </main>
    </div>
  );
}
