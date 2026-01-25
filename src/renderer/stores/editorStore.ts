import { create } from 'zustand';
import type { ParsedCV } from '../types/cv';

interface EditorStore {
  activeCVId: string | null;
  activeCV: ParsedCV | null;
  isDirty: boolean;
  pendingChanges: Map<string, unknown>;  // fieldPath -> value

  // Actions
  setActiveCV: (id: string | null, data?: ParsedCV) => void;
  updateField: (fieldPath: string, value: unknown) => void;
  saveChanges: () => Promise<void>;
  discardChanges: () => void;
  loadCV: (id: string) => Promise<void>;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  activeCVId: null,
  activeCV: null,
  isDirty: false,
  pendingChanges: new Map(),

  setActiveCV: (id, data) => set({
    activeCVId: id,
    activeCV: data || null,
    isDirty: false,
    pendingChanges: new Map(),
  }),

  updateField: (fieldPath, value) => {
    const { pendingChanges, activeCV } = get();
    const newChanges = new Map(pendingChanges);
    newChanges.set(fieldPath, value);

    // Apply change to local state for immediate UI feedback
    if (activeCV) {
      const updatedCV = applyFieldUpdate(activeCV, fieldPath, value);
      set({
        activeCV: updatedCV,
        pendingChanges: newChanges,
        isDirty: true,
      });
    }
  },

  saveChanges: async () => {
    const { activeCVId, pendingChanges } = get();
    if (!activeCVId || pendingChanges.size === 0) return;

    // Save each pending change to database
    for (const [fieldPath, value] of pendingChanges) {
      await window.api.updateCVField(activeCVId, fieldPath, value);
    }

    set({ pendingChanges: new Map(), isDirty: false });
  },

  discardChanges: () => {
    const { activeCVId } = get();
    if (activeCVId) {
      // Reload from database to discard local changes
      get().loadCV(activeCVId);
    }
  },

  loadCV: async (id) => {
    try {
      const result = await window.api.getCV(id);
      if (result.success && result.data) {
        set({
          activeCVId: id,
          activeCV: result.data,
          isDirty: false,
          pendingChanges: new Map(),
        });
      }
    } catch (err) {
      console.error('Failed to load CV:', err);
    }
  },
}));

// Helper to apply nested field updates
function applyFieldUpdate(cv: ParsedCV, fieldPath: string, value: unknown): ParsedCV {
  const parts = fieldPath.split('.');
  const result = { ...cv };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);

    if (arrayMatch) {
      const [, arrayName, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      current[arrayName] = [...current[arrayName]];
      current[arrayName][index] = { ...current[arrayName][index] };
      current = current[arrayName][index];
    } else {
      current[part] = { ...current[part] };
      current = current[part];
    }
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;

  return result;
}
