import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';
import { Button } from '../components/ui/button';

export function Dashboard() {
  const navigate = useNavigate();
  const { projects, isLoading, loadProjects, createProject } = useProjectStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async () => {
    try {
      const id = await createProject({ name: 'New Project' });
      navigate(`/project/${id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleOpenProject = (id: string) => {
    navigate(`/project/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={handleCreateProject}>New Project</Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No projects yet</p>
          <Button onClick={handleCreateProject}>Create your first project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="p-4 border border-border rounded-lg cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleOpenProject(project.id)}
            >
              <h3 className="font-medium">{project.name}</h3>
              {project.client_name && (
                <p className="text-sm text-muted-foreground">{project.client_name}</p>
              )}
              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                <span>{project.cv_count} CVs</span>
                <span>{project.jd_count} JDs</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
