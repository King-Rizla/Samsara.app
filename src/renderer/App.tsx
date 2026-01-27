import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './routes/Dashboard';
import { ProjectView } from './routes/ProjectView';
import './styles/globals.css';

export function App() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <div className="h-screen flex flex-col bg-background">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/project/:id" element={<ProjectView />} />
        </Routes>
      </div>
    </MemoryRouter>
  );
}
