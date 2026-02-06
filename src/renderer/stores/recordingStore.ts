/**
 * Recording Store - Phase 12 Plan 02
 *
 * Manages recording state for the floating RecordingPanel.
 * Connects to main process via IPC for start/stop/attach operations.
 */
import { create } from "zustand";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

type RecordingState = "idle" | "recording" | "stopped" | "attaching";

interface RecordingStore {
  // State
  state: RecordingState;
  isPanelExpanded: boolean;
  sessionId: string | null;
  startedAt: string | null;
  durationMs: number;
  micLevel: number;
  systemLevel: number;
  audioPath: string | null;

  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  attachToCandidate: (candidateId: string, projectId: string) => Promise<void>;
  discardRecording: () => Promise<void>;
  togglePanel: () => void;
  expandPanel: () => void;
  collapsePanel: () => void;
  setLevels: (mic: number, system: number) => void;
  updateDuration: () => void;
  reset: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  // Initial state
  state: "idle",
  isPanelExpanded: true,
  sessionId: null,
  startedAt: null,
  durationMs: 0,
  micLevel: 0,
  systemLevel: 0,
  audioPath: null,

  // Start recording
  startRecording: async () => {
    try {
      const result = await window.api.startRecording();
      if (result.success) {
        set({
          state: "recording",
          sessionId: result.sessionId,
          startedAt: new Date().toISOString(),
          durationMs: 0,
          micLevel: 0,
          systemLevel: 0,
        });
        toast.success("Recording started");
      } else {
        toast.error(result.error || "Failed to start recording");
      }
    } catch (error) {
      console.error("[RecordingStore] Start failed:", error);
      toast.error("Failed to start recording");
    }
  },

  // Stop recording
  stopRecording: async () => {
    try {
      const result = await window.api.stopRecording();
      if (result.success) {
        set({
          state: "stopped",
          durationMs: result.durationMs || get().durationMs,
          audioPath: result.audioPath,
        });
        toast.success("Recording stopped");
      } else {
        toast.error(result.error || "Failed to stop recording");
      }
    } catch (error) {
      console.error("[RecordingStore] Stop failed:", error);
      toast.error("Failed to stop recording");
    }
  },

  // Attach recording to candidate
  attachToCandidate: async (candidateId: string, projectId: string) => {
    try {
      set({ state: "attaching" });
      const result = await window.api.attachRecording(candidateId, projectId);
      if (result.success) {
        toast.success("Recording attached - transcription started");
        set({
          state: "idle",
          sessionId: null,
          startedAt: null,
          durationMs: 0,
          audioPath: null,
          micLevel: 0,
          systemLevel: 0,
        });
      } else {
        set({ state: "stopped" });
        toast.error(result.error || "Failed to attach recording");
      }
    } catch (error) {
      console.error("[RecordingStore] Attach failed:", error);
      set({ state: "stopped" });
      toast.error("Failed to attach recording");
    }
  },

  // Discard recording
  discardRecording: async () => {
    try {
      await window.api.discardRecording();
      set({
        state: "idle",
        sessionId: null,
        startedAt: null,
        durationMs: 0,
        audioPath: null,
        micLevel: 0,
        systemLevel: 0,
      });
      toast.info("Recording discarded");
    } catch (error) {
      console.error("[RecordingStore] Discard failed:", error);
      toast.error("Failed to discard recording");
    }
  },

  // Toggle panel expanded/collapsed
  togglePanel: () => set((s) => ({ isPanelExpanded: !s.isPanelExpanded })),

  // Expand panel
  expandPanel: () => set({ isPanelExpanded: true }),

  // Collapse panel
  collapsePanel: () => set({ isPanelExpanded: false }),

  // Update audio levels (called from level callback)
  setLevels: (mic, system) => set({ micLevel: mic, systemLevel: system }),

  // Update duration while recording
  updateDuration: () => {
    const { startedAt, state } = get();
    if (state === "recording" && startedAt) {
      const now = new Date().getTime();
      const started = new Date(startedAt).getTime();
      set({ durationMs: now - started });
    }
  },

  // Reset to initial state
  reset: () =>
    set({
      state: "idle",
      isPanelExpanded: true,
      sessionId: null,
      startedAt: null,
      durationMs: 0,
      micLevel: 0,
      systemLevel: 0,
      audioPath: null,
    }),
}));
