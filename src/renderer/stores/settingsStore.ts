import { create } from 'zustand';

export interface RecruiterSettings {
  name?: string;
  phone?: string;
  email?: string;
}

interface SettingsState {
  recruiter: RecruiterSettings;
  isLoading: boolean;
  loadRecruiterSettings: () => Promise<void>;
  saveRecruiterSettings: (settings: RecruiterSettings) => Promise<boolean>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  recruiter: {},
  isLoading: false,

  loadRecruiterSettings: async () => {
    set({ isLoading: true });
    try {
      const result = await window.api.getRecruiterSettings();
      if (result.success && result.data) {
        set({ recruiter: result.data });
      }
    } catch (error) {
      console.error('Failed to load recruiter settings:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  saveRecruiterSettings: async (settings: RecruiterSettings) => {
    try {
      const result = await window.api.setRecruiterSettings(settings);
      if (result.success) {
        set({ recruiter: settings });
      }
      return result.success;
    } catch (error) {
      console.error('Failed to save recruiter settings:', error);
      return false;
    }
  },
}));
