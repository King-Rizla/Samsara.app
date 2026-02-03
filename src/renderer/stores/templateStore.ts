import { create } from "zustand";
import type {
  MessageTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplateVariable,
  TemplateRecord,
} from "../types/communication";

interface TemplateState {
  templates: MessageTemplate[];
  selectedTemplateId: string | null;
  availableVariables: TemplateVariable[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setTemplates: (templates: MessageTemplate[]) => void;
  selectTemplate: (id: string | null) => void;
  setAvailableVariables: (variables: TemplateVariable[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Async actions
  loadTemplates: (projectId: string) => Promise<void>;
  loadVariables: () => Promise<void>;
  createTemplate: (
    input: CreateTemplateInput,
  ) => Promise<MessageTemplate | null>;
  updateTemplate: (
    id: string,
    updates: UpdateTemplateInput,
  ) => Promise<boolean>;
  deleteTemplate: (id: string) => Promise<boolean>;
}

// Convert database record to frontend model (inline to avoid circular import)
function toModel(record: TemplateRecord): MessageTemplate {
  return {
    id: record.id,
    projectId: record.project_id,
    name: record.name,
    type: record.type as "sms" | "email",
    subject: record.subject || undefined,
    body: record.body,
    variablesJson: record.variables_json || undefined,
    isDefault: Boolean(record.is_default),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export const useTemplateStore = create<TemplateState>((set) => ({
  templates: [],
  selectedTemplateId: null,
  availableVariables: [],
  isLoading: false,
  error: null,

  setTemplates: (templates) => set({ templates }),
  selectTemplate: (id) => set({ selectedTemplateId: id }),
  setAvailableVariables: (variables) => set({ availableVariables: variables }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  loadTemplates: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.api.getTemplatesByProject(projectId);
      if (result.success && result.data) {
        const templates = (result.data as TemplateRecord[]).map(toModel);
        set({ templates, isLoading: false });
      } else {
        set({
          error: result.error || "Failed to load templates",
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to load templates",
        isLoading: false,
      });
    }
  },

  loadVariables: async () => {
    try {
      const result = await window.api.getAvailableVariables();
      if (result.success && result.data) {
        set({ availableVariables: result.data as TemplateVariable[] });
      }
    } catch (error) {
      console.error("Failed to load variables:", error);
    }
  },

  createTemplate: async (input) => {
    try {
      const result = await window.api.createTemplate(input);
      if (result.success && result.data) {
        const template = toModel(result.data as TemplateRecord);
        set((state) => ({ templates: [template, ...state.templates] }));
        return template;
      }
      return null;
    } catch (error) {
      console.error("Failed to create template:", error);
      return null;
    }
  },

  updateTemplate: async (id, updates) => {
    try {
      const result = await window.api.updateTemplate(id, updates);
      if (result.success) {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id
              ? { ...t, ...updates, updatedAt: new Date().toISOString() }
              : t,
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to update template:", error);
      return false;
    }
  },

  deleteTemplate: async (id) => {
    try {
      const result = await window.api.deleteTemplateById(id);
      if (result.success) {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
          selectedTemplateId:
            state.selectedTemplateId === id ? null : state.selectedTemplateId,
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to delete template:", error);
      return false;
    }
  },
}));

// Expose store for E2E testing
if (typeof window !== "undefined") {
  (
    window as unknown as { __templateStore: typeof useTemplateStore }
  ).__templateStore = useTemplateStore;
}
