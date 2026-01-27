import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './components/ui/sidebar';
import { AppSidebar } from './components/sidebar/AppSidebar';
import { Dashboard } from './routes/Dashboard';
import { ProjectView } from './routes/ProjectView';
import { TooltipProvider } from './components/ui/tooltip';
import './styles/globals.css';

export function App() {
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
