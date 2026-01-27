import { useEffect } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './components/ui/sidebar';
import { AppSidebar } from './components/sidebar/AppSidebar';
import { Dashboard } from './routes/Dashboard';
import { ProjectView } from './routes/ProjectView';
import { TooltipProvider } from './components/ui/tooltip';
import { useQueueStore } from './stores/queueStore';
import './styles/globals.css';

export function App() {
  // Subscribe to queue status updates from main process
  useEffect(() => {
    const handleStatusUpdate = useQueueStore.getState().handleQueueStatusUpdate;

    window.api.onQueueStatusUpdate((update) => {
      console.log('Queue status update:', update);
      handleStatusUpdate(update);
    });

    // Cleanup on unmount
    return () => {
      window.api.removeQueueStatusListener();
    };
  }, []);

  return (
    <MemoryRouter initialEntries={['/']}>
      <TooltipProvider>
        <SidebarProvider>
          <div className="flex h-screen w-full bg-background">
            <AppSidebar />
            <SidebarInset className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center gap-2 px-4 py-2 border-b border-border">
                <SidebarTrigger />
              </header>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/project/:id" element={<ProjectView />} />
              </Routes>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    </MemoryRouter>
  );
}
