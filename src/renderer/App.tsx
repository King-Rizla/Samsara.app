import { useEffect } from 'react';
import { QueueTabs } from './components/queue/QueueTabs';
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
        {activeCVId && (
          <span className="text-xs text-muted-foreground">
            Editing: {activeCVId.slice(0, 8)}...
          </span>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <QueueTabs />
      </main>
    </div>
  );
}
