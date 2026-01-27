import { create } from 'zustand';
import type { JobDescription, JDSummary, MatchResult } from '../types/jd';
import { useProjectStore } from './projectStore';

interface JDStore {
  // State
  jds: JDSummary[];
  activeJDId: string | null;
  activeJD: JobDescription | null;
  matchResults: MatchResult[];
  isExtracting: boolean;
  isMatching: boolean;

  // Input state (persisted across tab switches)
  inputText: string;
  inputError: string | null;

  // Actions
  loadJDs: () => Promise<void>;
  extractJD: (text: string) => Promise<{ success: boolean; error?: string }>;
  selectJD: (id: string | null) => Promise<void>;
  deleteJD: (id: string) => Promise<void>;
  setMatchResults: (results: MatchResult[]) => void;
  clearActiveJD: () => void;
  matchCVs: (cvIds: string[]) => Promise<{ success: boolean; error?: string }>;
  loadMatchResults: () => Promise<void>;
  setInputText: (text: string) => void;
  setInputError: (error: string | null) => void;
  clearInput: () => void;
}

export const useJDStore = create<JDStore>((set, get) => ({
  jds: [],
  activeJDId: null,
  activeJD: null,
  matchResults: [],
  isExtracting: false,
  isMatching: false,
  inputText: '',
  inputError: null,

  loadJDs: async () => {
    try {
      const projectId = useProjectStore.getState().activeProjectId;
      const result = await window.api.getAllJDs(projectId || undefined);
      if (result.success && result.data) {
        set({ jds: result.data as JDSummary[] });
      }
    } catch (err) {
      console.error('Failed to load JDs:', err);
    }
  },

  extractJD: async (text) => {
    set({ isExtracting: true, inputError: null });
    try {
      const result = await window.api.extractJD(text);
      if (result.success && result.data) {
        // Reload JD list to include new JD and clear input
        await get().loadJDs();
        set({ inputText: '', inputError: null });
        return { success: true };
      }
      const error = result.error || 'Extraction failed';
      set({ inputError: error });
      return { success: false, error };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Extraction failed';
      set({ inputError: error });
      return { success: false, error };
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

  matchCVs: async (cvIds) => {
    const { activeJDId } = get();
    if (!activeJDId) {
      return { success: false, error: 'No JD selected' };
    }

    set({ isMatching: true });
    try {
      const result = await window.api.matchCVsToJD(activeJDId, cvIds);
      if (result.success && result.results) {
        set({ matchResults: result.results as MatchResult[] });
        return { success: true };
      }
      return { success: false, error: result.error || 'Matching failed' };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Matching failed'
      };
    } finally {
      set({ isMatching: false });
    }
  },

  loadMatchResults: async () => {
    const { activeJDId } = get();
    if (!activeJDId) return;

    try {
      const result = await window.api.getMatchResults(activeJDId);
      if (result.success && result.data) {
        set({ matchResults: result.data as MatchResult[] });
      }
    } catch (err) {
      console.error('Failed to load match results:', err);
    }
  },

  setInputText: (text) => set({ inputText: text, inputError: null }),
  setInputError: (error) => set({ inputError: error }),
  clearInput: () => set({ inputText: '', inputError: null }),
}));

// Expose store for E2E testing
if (typeof window !== 'undefined') {
  (window as unknown as { __jdStore: typeof useJDStore }).__jdStore = useJDStore;
}
