import { create } from 'zustand';
import type { JobDescription, JDSummary, MatchResult } from '../types/jd';

interface JDStore {
  // State
  jds: JDSummary[];
  activeJDId: string | null;
  activeJD: JobDescription | null;
  matchResults: MatchResult[];
  isExtracting: boolean;

  // Actions
  loadJDs: () => Promise<void>;
  extractJD: (text: string) => Promise<{ success: boolean; error?: string }>;
  selectJD: (id: string | null) => Promise<void>;
  deleteJD: (id: string) => Promise<void>;
  setMatchResults: (results: MatchResult[]) => void;
  clearActiveJD: () => void;
}

export const useJDStore = create<JDStore>((set, get) => ({
  jds: [],
  activeJDId: null,
  activeJD: null,
  matchResults: [],
  isExtracting: false,

  loadJDs: async () => {
    try {
      const result = await window.api.getAllJDs();
      if (result.success && result.data) {
        set({ jds: result.data as JDSummary[] });
      }
    } catch (err) {
      console.error('Failed to load JDs:', err);
    }
  },

  extractJD: async (text) => {
    set({ isExtracting: true });
    try {
      const result = await window.api.extractJD(text);
      if (result.success && result.data) {
        // Reload JD list to include new JD
        await get().loadJDs();
        return { success: true };
      }
      return { success: false, error: result.error || 'Extraction failed' };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Extraction failed'
      };
    } finally {
      set({ isExtracting: false });
    }
  },

  selectJD: async (id) => {
    if (!id) {
      set({ activeJDId: null, activeJD: null, matchResults: [] });
      return;
    }

    try {
      const result = await window.api.getJD(id);
      if (result.success && result.data) {
        set({
          activeJDId: id,
          activeJD: result.data as JobDescription,
          matchResults: []  // Clear matches when switching JD
        });
      }
    } catch (err) {
      console.error('Failed to load JD:', err);
    }
  },

  deleteJD: async (id) => {
    try {
      await window.api.deleteJD(id);
      const { activeJDId } = get();
      if (activeJDId === id) {
        set({ activeJDId: null, activeJD: null, matchResults: [] });
      }
      await get().loadJDs();
    } catch (err) {
      console.error('Failed to delete JD:', err);
    }
  },

  setMatchResults: (results) => set({ matchResults: results }),

  clearActiveJD: () => set({
    activeJDId: null,
    activeJD: null,
    matchResults: []
  }),
}));

// Expose store for E2E testing
if (typeof window !== 'undefined') {
  (window as unknown as { __jdStore: typeof useJDStore }).__jdStore = useJDStore;
}
