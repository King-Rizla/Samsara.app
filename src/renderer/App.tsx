import { useEffect, useState, useCallback } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { FolderOpen } from 'lucide-react';
import { Toaster } from 'sonner';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './components/ui/sidebar';
import { AppSidebar } from './components/sidebar/AppSidebar';
import { Dashboard } from './routes/Dashboard';
import { ProjectView } from './routes/ProjectView';
import { Settings } from './routes/Settings';
import { TooltipProvider } from './components/ui/tooltip';
import { useQueueStore } from './stores/queueStore';
import './styles/globals.css';

interface PinnedProject {
  id: string;
  name: string;
}

export function App() {
  const [activeProject, setActiveProject] = useState<PinnedProject | null>(null);
  const [pinnedProjects, setPinnedProjects] = useState<PinnedProject[]>([]);

  // Configure sensors with distance constraint to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  // Load pinned projects on mount
  const loadPinnedProjects = useCallback(async () => {
    const result = await window.api.getPinnedProjects();
    if (result.success && result.data) {
      setPinnedProjects(result.data.map(p => ({ id: p.id, name: p.name })));
    }
  }, []);

  useEffect(() => {
    loadPinnedProjects();
  }, [loadPinnedProjects]);

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

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === 'project' || data?.type === 'pinned-project') {
      setActiveProject({
        id: data.project.id,
        name: data.project.name,
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveProject(null);

    const activeData = active.data.current;

    // Case 1: Dropping unpinned project onto sidebar drop zone
    if (over?.id === 'sidebar-quick-access' && activeData?.type === 'project') {
      const project = activeData.project;
      if (!pinnedProjects.some(p => p.id === project.id)) {
        const result = await window.api.setPinnedProject(project.id, true);
        if (result.success) {
          setPinnedProjects(prev => [...prev, { id: project.id, name: project.name }]);
        }
      }
      return;
    }

    // Case 2: Reordering pinned projects within sidebar
    if (activeData?.type === 'pinned-project' && over) {
      const activeId = active.id.toString().replace('pinned-', '');
      const overId = over.id.toString().replace('pinned-', '');

      if (activeId !== overId && overId !== 'sidebar-quick-access') {
        const oldIndex = pinnedProjects.findIndex(p => p.id === activeId);
        const newIndex = pinnedProjects.findIndex(p => p.id === overId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(pinnedProjects, oldIndex, newIndex);
          setPinnedProjects(newOrder);
          // Persist new order
          await window.api.reorderPinnedProjects(newOrder.map(p => p.id));
        }
        return;
      }

      // Case 3: Dragging pinned project OUT of sidebar (unpin via drag-back)
      // If dropped anywhere that's not the sidebar or another pinned item, unpin it
      if (over.id !== 'sidebar-quick-access') {
        const isOverPinnedItem = over.id.toString().startsWith('pinned-');
        if (!isOverPinnedItem) {
          const projectId = activeData.project.id;
          const result = await window.api.setPinnedProject(projectId, false);
          if (result.success) {
            setPinnedProjects(prev => prev.filter(p => p.id !== projectId));
          }
        }
      }
    }
  };

  // Handle unpin via X button
  const handleUnpin = async (projectId: string) => {
    const result = await window.api.setPinnedProject(projectId, false);
    if (result.success) {
      setPinnedProjects(prev => prev.filter(p => p.id !== projectId));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <MemoryRouter initialEntries={['/']}>
        <TooltipProvider>
          <SidebarProvider>
            <div className="flex h-screen w-full bg-background">
              <AppSidebar
                pinnedProjects={pinnedProjects}
                onUnpin={handleUnpin}
              />
              <SidebarInset className="flex flex-col flex-1 overflow-hidden">
                <header className="flex items-center gap-2 px-4 py-2 border-b border-border">
                  <SidebarTrigger />
                </header>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/project/:id" element={<ProjectView />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </SidebarInset>
            </div>
          </SidebarProvider>
        </TooltipProvider>
      </MemoryRouter>

      {/* DragOverlay renders outside normal DOM for z-index (per Research pitfall #1) */}
      <DragOverlay>
        {activeProject ? (
          <div className="bg-card border border-primary rounded-md p-3 shadow-lg opacity-90 min-w-[150px]">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              <span className="font-medium truncate">{activeProject.name}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* Toast notifications for usage warnings (per CONTEXT.md: toast stays until dismissed) */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'bg-card border-border text-foreground',
          duration: Infinity,
        }}
      />
    </DndContext>
  );
}
