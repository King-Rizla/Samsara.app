import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { StatsStrip, ProjectCard, CreateProjectDialog } from '../components/dashboard';
import { Card, CardContent } from '../components/ui/card';

export function Dashboard() {
  const navigate = useNavigate();
  const { projects, isLoading, loadProjects, createProject, archiveProject, deleteProject } = useProjectStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [stats, setStats] = useState({ total_cvs: 0, total_jds: 0 });

  useEffect(() => {
    loadProjects();
    // Load aggregate stats
    window.api.getAggregateStats().then((result) => {
      if (result.success && result.data) {
        setStats(result.data);
      }
    });
  }, [loadProjects]);

  const handleCreateProject = async (data: { name: string; client_name?: string; description?: string }) => {
    const id = await createProject(data);
    navigate(`/project/${id}`);
  };

  const handleArchive = async (id: string) => {
    await archiveProject(id);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this project and all its data? This cannot be undone.')) {
      await deleteProject(id);
    }
  };

  // Calculate time saved (estimate: 5 min manual vs 2s automated per CV)
  const timeSavedMinutes = Math.round(stats.total_cvs * 4.97); // 5 min - 2s = ~4.97 min saved per CV
  const timeSavedFormatted = timeSavedMinutes >= 60
    ? `${Math.floor(timeSavedMinutes / 60)}h ${timeSavedMinutes % 60}m`
    : `${timeSavedMinutes}m`;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Stats Strip */}
      <StatsStrip
        totalCVs={stats.total_cvs}
        totalJDs={stats.total_jds}
        timeSaved={timeSavedFormatted}
      />

      {/* Projects Grid */}
      <div className="flex-1 overflow-auto p-6">
        <h2 className="text-lg font-semibold mb-4">Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Create New Project Card */}
          <Card
            className="bg-card border-border border-dashed hover:border-primary cursor-pointer transition-colors min-h-[140px] flex items-center justify-center"
            onClick={() => setShowCreateDialog(true)}
          >
            <CardContent className="flex flex-col items-center gap-2 p-6">
              <Plus className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">New Project</span>
            </CardContent>
          </Card>

          {/* Project Cards */}
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      {/* Create Project Dialog */}
      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreate={handleCreateProject}
      />
    </div>
  );
}
