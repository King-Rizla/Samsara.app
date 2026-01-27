import { create } from 'zustand';
import type { Project, CreateProjectInput } from '../types/project';

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;
  isLoading: boolean;

  // Actions
  loadProjects: () => Promise<void>;
  selectProject: (id: string | null) => void;
  createProject: (input: CreateProjectInput) => Promise<string>;
  updateProject: (id: string, updates: Partial<CreateProjectInput & { is_archived: boolean }>) => Promise<boolean>;
  archiveProject: (id: string) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  isLoading: false,

  loadProjects: async () => {
    set({ isLoading: true });
    try {
      const result = await window.api.getAllProjects();
      if (result.success && result.data) {
        set({ projects: result.data });
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  selectProject: (id) => {
    set({ activeProjectId: id });
    // Note: Components will trigger store reloads via useEffect when activeProjectId changes
  },

  createProject: async (input) => {
    const result = await window.api.createProject(input);
    if (result.success && result.data) {
      await get().loadProjects();
      return result.data.id;
    }
    throw new Error(result.error || 'Failed to create project');
  },

  updateProject: async (id, updates) => {
    const result = await window.api.updateProject(id, updates);
    if (result.success) {
      await get().loadProjects();
      return true;
    }
    return false;
  },

  archiveProject: async (id) => {
    return get().updateProject(id, { is_archived: true });
  },

  deleteProject: async (id) => {
    const result = await window.api.deleteProject(id);
    if (result.success) {
      const { activeProjectId } = get();
      if (activeProjectId === id) {
        set({ activeProjectId: null });
      }
      await get().loadProjects();
      return true;
    }
    return false;
  },
}));

// Expose store for E2E testing
if (typeof window !== 'undefined') {
  (window as unknown as { __projectStore: typeof useProjectStore }).__projectStore = useProjectStore;
}
