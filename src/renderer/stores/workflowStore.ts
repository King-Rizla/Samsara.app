/**
 * Workflow Store - Phase 10 Plan 03
 *
 * Manages workflow candidates for the Kanban pipeline UI.
 * Connects to backend via IPC for graduation and workflow events.
 */

import { create } from "zustand";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

export interface WorkflowCandidate {
  id: string; // candidateId (same as cvId)
  name: string;
  matchScore: number;
  status: string; // Current workflow state
  phone?: string;
  email?: string;
  contactedAt?: string;
  repliedAt?: string;
  lastMessageSnippet?: string;
  lastMessageAt?: string;
}

interface WorkflowState {
  // State
  candidates: WorkflowCandidate[];
  selectedCandidateId: string | null;
  isLoading: boolean;
  isPanelOpen: boolean;

  // Actions
  loadCandidates: (projectId: string) => Promise<void>;
  selectCandidate: (id: string) => void;
  closePanel: () => void;
  moveCandidateToColumn: (
    candidateId: string,
    newStatus: string,
  ) => Promise<void>;
  graduateCandidate: (
    candidateId: string,
    projectId: string,
    context: {
      matchScore: number;
      candidateName: string;
      phone?: string;
      email?: string;
    },
  ) => Promise<boolean>;
  graduateBatch: (
    candidateIds: string[],
    projectId: string,
    escalationTimeoutMs?: number,
  ) => Promise<{ success: string[]; failed: string[] }>;
  pauseWorkflow: (candidateId: string) => Promise<boolean>;
  resumeWorkflow: (candidateId: string) => Promise<boolean>;
  cancelWorkflow: (candidateId: string) => Promise<boolean>;
  forceCall: (candidateId: string) => Promise<boolean>;
  skipToScreening: (candidateId: string) => Promise<boolean>;
  refreshCandidates: () => Promise<void>;
}

// ============================================================================
// Valid Transitions Map (for drag-drop validation)
// ============================================================================

/**
 * Maps current state + target column to workflow event type.
 * If a transition is not in this map, it's invalid.
 */
export const VALID_TRANSITIONS: Record<string, Record<string, string>> = {
  pending: {
    contacted: "GRADUATE",
  },
  contacted: {
    paused: "PAUSE",
    archived: "CANCEL",
    screening: "SKIP_TO_SCREENING",
  },
  paused: {
    contacted: "RESUME",
    screening: "FORCE_CALL",
    archived: "CANCEL",
  },
  replied: {
    screening: "SKIP_TO_SCREENING",
    paused: "PAUSE",
    archived: "CANCEL",
  },
  screening: {
    passed: "SCREENING_COMPLETE",
    failed: "SCREENING_COMPLETE",
    paused: "PAUSE",
    archived: "CANCEL",
  },
};

// ============================================================================
// Store
// ============================================================================

// Track current project for refresh
let currentProjectId: string | null = null;

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // Initial state
  candidates: [],
  selectedCandidateId: null,
  isLoading: false,
  isPanelOpen: false,

  // Load candidates from workflow database
  loadCandidates: async (projectId: string) => {
    currentProjectId = projectId;
    set({ isLoading: true });

    try {
      const result = await window.api.getWorkflowsByProject(projectId);

      if (result.success && result.data) {
        // Map workflow summaries to WorkflowCandidate
        type WorkflowSummary = NonNullable<typeof result.data>[number];
        const candidates: WorkflowCandidate[] = await Promise.all(
          result.data.map(async (workflow: WorkflowSummary) => {
            // Get additional candidate data
            const candidateResult = await window.api.getWorkflowCandidate(
              workflow.candidateId,
            );

            const context = candidateResult.data?.context;

            // Get last message for snippet
            const messagesResult = await window.api.getMessagesByCV(
              workflow.candidateId,
            );
            const messages = (messagesResult.data || []) as Array<{
              body: string;
              sent_at?: string;
              created_at: string;
            }>;
            const lastMessage = messages[0];

            return {
              id: workflow.candidateId,
              name: context?.candidateName || "Unknown",
              matchScore: workflow.matchScore,
              status: workflow.currentState,
              phone: context?.phone,
              email: context?.email,
              contactedAt: context?.timestamps?.contactedAt,
              repliedAt: context?.timestamps?.repliedAt,
              lastMessageSnippet: lastMessage?.body?.slice(0, 50),
              lastMessageAt: lastMessage?.sent_at || lastMessage?.created_at,
            };
          }),
        );

        set({ candidates, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error("[WorkflowStore] Failed to load candidates:", error);
      set({ isLoading: false });
    }
  },

  // Select a candidate and open panel
  selectCandidate: (id: string) => {
    set({ selectedCandidateId: id, isPanelOpen: true });
  },

  // Close panel
  closePanel: () => {
    set({ isPanelOpen: false, selectedCandidateId: null });
  },

  // Move candidate to new column via drag-drop
  moveCandidateToColumn: async (candidateId: string, newStatus: string) => {
    const { candidates } = get();
    const candidate = candidates.find((c) => c.id === candidateId);

    if (!candidate) {
      console.warn("[WorkflowStore] Candidate not found:", candidateId);
      return;
    }

    const currentStatus = candidate.status;
    const eventType = VALID_TRANSITIONS[currentStatus]?.[newStatus];

    if (!eventType) {
      toast.error(`Cannot move from ${currentStatus} to ${newStatus}`);
      return;
    }

    // Optimistic update
    set({
      candidates: candidates.map((c) =>
        c.id === candidateId ? { ...c, status: newStatus } : c,
      ),
    });

    try {
      // Send workflow event
      let payload: Record<string, unknown> | undefined;

      // For screening complete, we need to pass outcome
      if (eventType === "SCREENING_COMPLETE") {
        payload = { outcome: newStatus === "passed" ? "passed" : "failed" };
      }

      const result = await window.api.sendWorkflowEvent(
        candidateId,
        eventType,
        payload,
      );

      if (!result.success) {
        // Revert on failure
        set({
          candidates: candidates.map((c) =>
            c.id === candidateId ? { ...c, status: currentStatus } : c,
          ),
        });
        toast.error(result.error || "Failed to update workflow");
      } else {
        toast.success(`Candidate moved to ${newStatus}`);
      }
    } catch (error) {
      // Revert on error
      set({
        candidates: candidates.map((c) =>
          c.id === candidateId ? { ...c, status: currentStatus } : c,
        ),
      });
      toast.error("Failed to update workflow");
    }
  },

  // Graduate a single candidate
  graduateCandidate: async (candidateId, projectId, context) => {
    try {
      const result = await window.api.graduateCandidate(
        candidateId,
        projectId,
        context,
      );

      if (result.success) {
        toast.success(`${context.candidateName} graduated to outreach`);
        // Refresh candidates if we're viewing this project
        if (currentProjectId === projectId) {
          get().refreshCandidates();
        }
        return true;
      } else {
        toast.error(result.error || "Failed to graduate candidate");
        return false;
      }
    } catch (error) {
      console.error("[WorkflowStore] Graduation failed:", error);
      toast.error("Failed to graduate candidate");
      return false;
    }
  },

  // Batch graduate candidates
  graduateBatch: async (candidateIds, projectId, escalationTimeoutMs) => {
    try {
      const result = await window.api.graduateCandidates(
        candidateIds,
        projectId,
        escalationTimeoutMs,
      );

      if (result.success && result.data) {
        const { success, failed } = result.data;

        if (success.length > 0) {
          toast.success(
            `Graduated ${success.length} candidate${success.length !== 1 ? "s" : ""} to outreach`,
          );
        }

        if (failed.length > 0) {
          toast.error(
            `Failed to graduate ${failed.length} candidate${failed.length !== 1 ? "s" : ""}`,
          );
        }

        // Refresh candidates if we're viewing this project
        if (currentProjectId === projectId) {
          get().refreshCandidates();
        }

        return { success, failed };
      } else {
        toast.error(result.error || "Failed to graduate candidates");
        return { success: [], failed: candidateIds };
      }
    } catch (error) {
      console.error("[WorkflowStore] Batch graduation failed:", error);
      toast.error("Failed to graduate candidates");
      return { success: [], failed: candidateIds };
    }
  },

  // Workflow control actions
  pauseWorkflow: async (candidateId: string) => {
    const result = await window.api.sendWorkflowEvent(candidateId, "PAUSE");
    if (result.success) {
      toast.success("Workflow paused");
      get().refreshCandidates();
      return true;
    }
    toast.error(result.error || "Failed to pause workflow");
    return false;
  },

  resumeWorkflow: async (candidateId: string) => {
    const result = await window.api.sendWorkflowEvent(candidateId, "RESUME");
    if (result.success) {
      toast.success("Workflow resumed");
      get().refreshCandidates();
      return true;
    }
    toast.error(result.error || "Failed to resume workflow");
    return false;
  },

  cancelWorkflow: async (candidateId: string) => {
    const result = await window.api.sendWorkflowEvent(candidateId, "CANCEL");
    if (result.success) {
      toast.success("Workflow cancelled");
      get().refreshCandidates();
      return true;
    }
    toast.error(result.error || "Failed to cancel workflow");
    return false;
  },

  forceCall: async (candidateId: string) => {
    const result = await window.api.sendWorkflowEvent(
      candidateId,
      "FORCE_CALL",
    );
    if (result.success) {
      toast.success("AI call triggered");
      get().refreshCandidates();
      return true;
    }
    toast.error(result.error || "Failed to trigger call");
    return false;
  },

  skipToScreening: async (candidateId: string) => {
    const result = await window.api.sendWorkflowEvent(
      candidateId,
      "SKIP_TO_SCREENING",
    );
    if (result.success) {
      toast.success("Skipped to screening");
      get().refreshCandidates();
      return true;
    }
    toast.error(result.error || "Failed to skip to screening");
    return false;
  },

  // Refresh candidates (used after actions)
  refreshCandidates: async () => {
    if (currentProjectId) {
      await get().loadCandidates(currentProjectId);
    }
  },
}));
