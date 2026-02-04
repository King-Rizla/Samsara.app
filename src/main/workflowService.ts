/**
 * Workflow Service - Phase 10
 *
 * Manages workflow actors for outreach orchestration.
 * Provides graduation functions and event dispatching.
 */

import { createActor, type Actor } from "xstate";
import { getDatabase } from "./database";
import {
  outreachMachine,
  type WorkflowInput,
  type WorkflowEvent,
  type WorkflowContext,
} from "./workflowMachine";
import {
  saveWorkflowSnapshot,
  restoreActiveWorkflows,
  getWorkflowsByProject as queryWorkflowsByProject,
  getWorkflowCandidate as queryWorkflowCandidate,
  type WorkflowSnapshot,
  type WorkflowActor,
  type WorkflowSummary,
} from "./workflowPersistence";

// ============================================================================
// Actor Management
// ============================================================================

// Map of active workflow actors: candidateId -> actor
const workflowActors = new Map<string, WorkflowActor>();

/**
 * Get the map of active workflow actors.
 * Used by other services to send events directly.
 */
export function getWorkflowActors(): Map<string, WorkflowActor> {
  return workflowActors;
}

/**
 * Get a specific workflow actor by candidate ID.
 */
export function getWorkflowActor(
  candidateId: string,
): WorkflowActor | undefined {
  return workflowActors.get(candidateId);
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize workflows on app startup.
 * Restores active workflows from database and starts actors.
 */
export function initializeWorkflows(): void {
  console.log("[WorkflowService] Initializing workflows...");

  // Restore active workflows from persistence
  const restoredActors = restoreActiveWorkflows(
    (candidateId, snapshot, projectId, matchScore) => {
      // Persist on every state change
      saveWorkflowSnapshot(candidateId, projectId, matchScore, snapshot);
    },
  );

  // Store in actors map
  for (const [candidateId, actor] of restoredActors) {
    workflowActors.set(candidateId, actor);
  }

  console.log(
    `[WorkflowService] Initialized with ${workflowActors.size} active workflows`,
  );
}

// ============================================================================
// Graduation Functions
// ============================================================================

export interface GraduateContext {
  matchScore: number;
  candidateName: string;
  phone?: string;
  email?: string;
  escalationTimeoutMs?: number;
}

const DEFAULT_ESCALATION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Graduate a single candidate to outreach.
 * Creates workflow actor, starts it, and sends GRADUATE event.
 *
 * @returns true if graduation successful, false if already graduated or failed
 */
export async function graduateCandidate(
  candidateId: string,
  projectId: string,
  context: GraduateContext,
): Promise<boolean> {
  // Check if already graduated
  if (workflowActors.has(candidateId)) {
    console.warn(
      `[WorkflowService] Candidate ${candidateId} already in workflow`,
    );
    return false;
  }

  try {
    const db = getDatabase();
    const now = new Date().toISOString();

    // Create workflow input
    const input: WorkflowInput = {
      candidateId,
      projectId,
      matchScore: context.matchScore,
      candidateName: context.candidateName,
      phone: context.phone,
      email: context.email,
      escalationTimeoutMs:
        context.escalationTimeoutMs || DEFAULT_ESCALATION_TIMEOUT_MS,
    };

    // Create actor
    const actor = createActor(outreachMachine, {
      input,
    });

    // Subscribe to state changes for persistence
    actor.subscribe((snapshot) => {
      saveWorkflowSnapshot(
        candidateId,
        projectId,
        context.matchScore,
        snapshot,
      );

      // Check if workflow completed (final state)
      if (snapshot.status === "done") {
        console.log(
          `[WorkflowService] Workflow ${candidateId} completed in state: ${snapshot.value}`,
        );
        // Note: We keep the actor in the map for querying but it's stopped
      }
    });

    // Start actor
    actor.start();
    workflowActors.set(candidateId, actor);

    // Update CV record to mark as graduated
    db.prepare(
      `
      UPDATE cvs SET graduated_at = ?, outreach_status = 'graduated' WHERE id = ?
    `,
    ).run(now, candidateId);

    // Create initial workflow record in outreach_workflows
    const initialSnapshot = actor.getSnapshot();
    saveWorkflowSnapshot(
      candidateId,
      projectId,
      context.matchScore,
      initialSnapshot,
    );

    // Send GRADUATE event to trigger initial outreach
    actor.send({ type: "GRADUATE" });

    console.log(`[WorkflowService] Graduated candidate ${candidateId}`);
    return true;
  } catch (error) {
    console.error(
      `[WorkflowService] Failed to graduate candidate ${candidateId}:`,
      error,
    );
    return false;
  }
}

/**
 * Graduate multiple candidates in batch.
 * Returns lists of successful and failed candidate IDs.
 */
export async function graduateCandidates(
  candidateIds: string[],
  projectId: string,
  escalationTimeoutMs?: number,
): Promise<{ success: string[]; failed: string[] }> {
  const db = getDatabase();
  const success: string[] = [];
  const failed: string[] = [];

  for (const candidateId of candidateIds) {
    try {
      // Get candidate data
      const cv = db
        .prepare(
          `
        SELECT id, contact_json FROM cvs WHERE id = ? AND project_id = ?
      `,
        )
        .get(candidateId, projectId) as
        | { id: string; contact_json: string }
        | undefined;

      if (!cv) {
        console.warn(
          `[WorkflowService] Candidate ${candidateId} not found in project ${projectId}`,
        );
        failed.push(candidateId);
        continue;
      }

      const contact = JSON.parse(cv.contact_json || "{}");

      // Get best match score for this candidate
      const match = db
        .prepare(
          `
        SELECT match_score FROM cv_jd_matches WHERE cv_id = ? ORDER BY calculated_at DESC LIMIT 1
      `,
        )
        .get(candidateId) as { match_score: number } | undefined;

      const graduated = await graduateCandidate(candidateId, projectId, {
        matchScore: match?.match_score || 0,
        candidateName: contact.name || "Unknown",
        phone: contact.phone,
        email: contact.email,
        escalationTimeoutMs:
          escalationTimeoutMs || DEFAULT_ESCALATION_TIMEOUT_MS,
      });

      if (graduated) {
        success.push(candidateId);
      } else {
        failed.push(candidateId);
      }
    } catch (error) {
      console.error(
        `[WorkflowService] Failed to graduate candidate ${candidateId}:`,
        error,
      );
      failed.push(candidateId);
    }
  }

  console.log(
    `[WorkflowService] Batch graduation: ${success.length} succeeded, ${failed.length} failed`,
  );
  return { success, failed };
}

// ============================================================================
// Event Dispatching
// ============================================================================

/**
 * Send an event to a workflow actor.
 *
 * @returns true if event sent successfully, false if actor not found
 */
export function sendWorkflowEvent(
  candidateId: string,
  event: WorkflowEvent,
): boolean {
  const actor = workflowActors.get(candidateId);
  if (!actor) {
    console.warn(
      `[WorkflowService] No active workflow for candidate ${candidateId}`,
    );
    return false;
  }

  actor.send(event);
  console.log(
    `[WorkflowService] Sent event ${event.type} to workflow ${candidateId}`,
  );
  return true;
}

/**
 * Pause a workflow.
 */
export function pauseWorkflow(candidateId: string): boolean {
  return sendWorkflowEvent(candidateId, { type: "PAUSE" });
}

/**
 * Resume a paused workflow.
 */
export function resumeWorkflow(candidateId: string): boolean {
  return sendWorkflowEvent(candidateId, { type: "RESUME" });
}

/**
 * Cancel a workflow (archive).
 */
export function cancelWorkflow(candidateId: string): boolean {
  return sendWorkflowEvent(candidateId, { type: "CANCEL" });
}

/**
 * Force trigger AI call for a workflow.
 */
export function forceCall(candidateId: string): boolean {
  return sendWorkflowEvent(candidateId, { type: "FORCE_CALL" });
}

/**
 * Skip to screening state.
 */
export function skipToScreening(candidateId: string): boolean {
  return sendWorkflowEvent(candidateId, { type: "SKIP_TO_SCREENING" });
}

/**
 * Report reply detected for a workflow.
 */
export function reportReplyDetected(
  candidateId: string,
  intent: "positive" | "negative" | "ambiguous",
): boolean {
  return sendWorkflowEvent(candidateId, { type: "REPLY_DETECTED", intent });
}

/**
 * Report screening complete for a workflow.
 */
export function reportScreeningComplete(
  candidateId: string,
  outcome: "passed" | "failed",
): boolean {
  return sendWorkflowEvent(candidateId, {
    type: "SCREENING_COMPLETE",
    outcome,
  });
}

// ============================================================================
// Query Functions (delegate to persistence layer)
// ============================================================================

/**
 * Get all workflows for a project with summary information.
 */
export function getWorkflowsByProject(projectId: string): WorkflowSummary[] {
  return queryWorkflowsByProject(projectId);
}

/**
 * Get full workflow data for a candidate.
 */
export function getWorkflowCandidateData(candidateId: string): {
  summary: WorkflowSummary;
  snapshot: WorkflowSnapshot;
  context: WorkflowContext;
} | null {
  return queryWorkflowCandidate(candidateId);
}

/**
 * Get workflow state for a candidate.
 */
export function getWorkflowState(
  candidateId: string,
): { state: string; context: WorkflowContext } | null {
  const actor = workflowActors.get(candidateId);
  if (!actor) {
    // Not in active actors, try persistence
    const data = queryWorkflowCandidate(candidateId);
    if (!data) return null;
    return {
      state: data.summary.currentState,
      context: data.context,
    };
  }

  const snapshot = actor.getSnapshot();
  return {
    state: String(snapshot.value),
    context: snapshot.context as WorkflowContext,
  };
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Stop all workflow actors.
 * Called on app shutdown.
 */
export function stopAllWorkflows(): void {
  console.log(`[WorkflowService] Stopping ${workflowActors.size} workflows...`);
  for (const [candidateId, actor] of workflowActors) {
    actor.stop();
    console.log(`[WorkflowService] Stopped workflow for ${candidateId}`);
  }
  workflowActors.clear();
}
