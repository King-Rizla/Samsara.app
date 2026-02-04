/**
 * Workflow Store - Phase 10 Plan 03
 *
 * Manages workflow candidates for the Kanban pipeline UI.
 * Connects to backend via IPC for graduation and workflow events.
 */

import { create } from "zustand";
import { toast } from "sonner";
import { useQueueStore } from "./queueStore";

// ============================================================================
// Types
// ============================================================================

export interface WorkflowCandidate {
  id: string; // candidateId (same as cvId)
  name: string;
  matchScore: number;
  status: string; // Current workflow state (contacted, replied, screening, passed, failed)
  isPaused: boolean; // Paused is a modifier, not a separate state
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
  retryFailedCandidate: (
    candidateId: string,
    targetState: string,
  ) => Promise<boolean>;
  refreshCandidates: () => Promise<void>;
}

// ============================================================================
// Column Configuration
// ============================================================================

/**
 * Columns in the Kanban board.
 * Note: "paused" is NOT a column - it's a visual modifier on cards in any column.
 * Recruiters can freely move candidates between columns (except to "failed" which
 * is determined by screening outcome or manual archive).
 */
export const KANBAN_COLUMNS = [
  "pending",
  "contacted",
  "replied",
  "screening",
  "passed",
  "failed",
] as const;

/**
 * Maps drag-drop target to workflow event.
 * This is permissive - recruiters have full manual override control.
 * The only restriction: can't drag TO "failed" (use archive/screening instead).
 */
export function getWorkflowEventForMove(
  _fromStatus: string,
  toStatus: string,
): string | null {
  // Can't drag TO failed column directly - use archive or screening outcome
  if (toStatus === "failed") {
    return null;
  }

  // Map target column to appropriate event
  switch (toStatus) {
    case "pending":
      return "MANUAL_MOVE"; // Reset to pending
    case "contacted":
      return "MANUAL_MOVE"; // Move to contacted
    case "replied":
      return "REPLY_DETECTED"; // Mark as replied
    case "screening":
      return "SKIP_TO_SCREENING"; // Move to screening
    case "passed":
      return "SCREENING_COMPLETE"; // Mark as passed
    default:
      return "MANUAL_MOVE";
  }
}

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

            // Determine if paused and the actual display status
            const isPaused = workflow.currentState === "paused";
            // If paused, show in the column they were in before pausing (default to contacted)
            // The backend stores the previous state, but for now default to contacted
            const displayStatus = isPaused
              ? "contacted"
              : workflow.currentState;

            return {
              id: workflow.candidateId,
              name: context?.candidateName || "Unknown",
              matchScore: workflow.matchScore,
              status: displayStatus,
              isPaused,
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

    // Can't drag TO failed column - use archive or screening outcome
    if (newStatus === "failed") {
      toast.error("Use Archive or Screening to move to Failed");
      return;
    }

    // Get the appropriate event type
    const eventType = getWorkflowEventForMove(currentStatus, newStatus);

    if (!eventType) {
      toast.error(`Cannot move to ${newStatus}`);
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
      } else {
        // For manual moves, include the target state
        payload = { targetState: newStatus };
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
        // Update queue store immediately for instant UI feedback
        useQueueStore.getState().updateOutreachStatus(candidateId, "graduated");
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
          // Update queue store immediately for instant UI feedback
          const updateOutreachStatus =
            useQueueStore.getState().updateOutreachStatus;
          for (const id of success) {
            updateOutreachStatus(id, "graduated");
          }
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

  retryFailedCandidate: async (candidateId: string, targetState: string) => {
    // Send RETRY event with the target state to re-enter the workflow
    const result = await window.api.sendWorkflowEvent(candidateId, "RETRY", {
      targetState,
    });
    if (result.success) {
      toast.success("Candidate given another chance");
      get().refreshCandidates();
      return true;
    }
    toast.error(result.error || "Failed to retry candidate");
    return false;
  },

  // Refresh candidates (used after actions)
  refreshCandidates: async () => {
    if (currentProjectId) {
      await get().loadCandidates(currentProjectId);
    }
  },
}));
