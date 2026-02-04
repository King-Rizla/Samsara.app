/**
 * Workflow Persistence Layer - Phase 10
 *
 * Handles saving/restoring XState workflow snapshots to SQLite.
 * Called on every state transition for durability and on app startup
 * to restore active workflows.
 */

import { createActor, type Actor, type SnapshotFrom } from "xstate";
import { getDatabase } from "./database";
import { outreachMachine, type WorkflowContext } from "./workflowMachine";

// Type for workflow snapshot
export type WorkflowSnapshot = SnapshotFrom<typeof outreachMachine>;

// Type for actor
export type WorkflowActor = Actor<typeof outreachMachine>;

// ============================================================================
// Snapshot Persistence
// ============================================================================

/**
 * Save workflow snapshot to SQLite.
 * Called on every state transition to ensure durability.
 */
export function saveWorkflowSnapshot(
  candidateId: string,
  projectId: string,
  matchScore: number,
  snapshot: WorkflowSnapshot,
): void {
  const db = getDatabase();
  const snapshotJson = JSON.stringify(snapshot);
  const now = new Date().toISOString();
  const currentState = String(snapshot.value);

  db.prepare(
    `
    INSERT INTO outreach_workflows (candidate_id, project_id, snapshot_json, current_state, match_score, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(candidate_id) DO UPDATE SET
      snapshot_json = excluded.snapshot_json,
      current_state = excluded.current_state,
      match_score = excluded.match_score,
      updated_at = excluded.updated_at
  `,
  ).run(
    candidateId,
    projectId,
    snapshotJson,
    currentState,
    matchScore,
    now,
    now,
  );

  console.log(
    `[WorkflowPersistence] Saved snapshot for ${candidateId} in state: ${currentState}`,
  );
}

/**
 * Load workflow snapshot from SQLite.
 * Returns null if no snapshot found.
 */
export function loadWorkflowSnapshot(
  candidateId: string,
): WorkflowSnapshot | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `
    SELECT snapshot_json FROM outreach_workflows WHERE candidate_id = ?
  `,
    )
    .get(candidateId) as { snapshot_json: string } | undefined;

  if (!row) return null;

  try {
    return JSON.parse(row.snapshot_json) as WorkflowSnapshot;
  } catch (error) {
    console.error(
      `[WorkflowPersistence] Failed to parse snapshot for ${candidateId}:`,
      error,
    );
    return null;
  }
}

/**
 * Delete workflow snapshot from SQLite.
 * Called when workflow is removed.
 */
export function deleteWorkflowSnapshot(candidateId: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare("DELETE FROM outreach_workflows WHERE candidate_id = ?")
    .run(candidateId);
  return result.changes > 0;
}

// ============================================================================
// Workflow Restoration
// ============================================================================

interface WorkflowRecord {
  candidate_id: string;
  project_id: string;
  snapshot_json: string;
  current_state: string;
  match_score: number | null;
}

/**
 * Restore all active workflows on app startup.
 * Returns a Map of candidateId -> running workflow actor.
 *
 * Non-final workflows are restored (status != 'done').
 * Final states are: 'passed', 'failed', 'archived'
 */
export function restoreActiveWorkflows(
  onStateChange: (
    candidateId: string,
    snapshot: WorkflowSnapshot,
    projectId: string,
    matchScore: number,
  ) => void,
): Map<string, WorkflowActor> {
  const db = getDatabase();
  const actors = new Map<string, WorkflowActor>();

  // Get all non-final workflows
  // XState v5: Final states have status === 'done'
  const rows = db
    .prepare(
      `
    SELECT candidate_id, project_id, snapshot_json, current_state, match_score
    FROM outreach_workflows
    WHERE json_extract(snapshot_json, '$.status') != 'done'
  `,
    )
    .all() as WorkflowRecord[];

  console.log(
    `[WorkflowPersistence] Found ${rows.length} active workflows to restore`,
  );

  for (const row of rows) {
    try {
      const snapshot = JSON.parse(row.snapshot_json) as WorkflowSnapshot;

      // Create actor with persisted snapshot
      const actor = createActor(outreachMachine, {
        snapshot,
      });

      // Subscribe to state changes for persistence
      actor.subscribe((state) => {
        onStateChange(
          row.candidate_id,
          state,
          row.project_id,
          row.match_score || 0,
        );
      });

      // Start the actor
      actor.start();
      actors.set(row.candidate_id, actor);

      console.log(
        `[WorkflowPersistence] Restored workflow for ${row.candidate_id} in state: ${row.current_state}`,
      );
    } catch (error) {
      console.error(
        `[WorkflowPersistence] Failed to restore workflow for ${row.candidate_id}:`,
        error,
      );
    }
  }

  // Execute missed escalations
  executeMissedEscalations(actors);

  return actors;
}

/**
 * Execute any escalations that were missed while app was closed.
 * Per CONTEXT.md: "All missed escalations execute in order when app reopens"
 *
 * For each 'contacted' state actor, check if elapsed time >= escalationTimeoutMs.
 * If so, send TIMEOUT event to trigger escalation.
 */
function executeMissedEscalations(actors: Map<string, WorkflowActor>): void {
  const now = Date.now();

  for (const [candidateId, actor] of actors) {
    const snapshot = actor.getSnapshot();
    const context = snapshot.context as WorkflowContext;

    // Only process 'contacted' state (waiting for escalation)
    if (snapshot.value !== "contacted") continue;

    // Check if timeout has passed
    if (!context.timestamps.contactedAt) continue;

    const contactedTime = new Date(context.timestamps.contactedAt).getTime();
    const elapsed = now - contactedTime;

    if (elapsed >= context.escalationTimeoutMs) {
      console.log(
        `[WorkflowPersistence] Executing missed escalation for ${candidateId} (elapsed: ${Math.round(elapsed / 1000 / 60)}min)`,
      );
      actor.send({ type: "TIMEOUT" });
    }
  }
}

// ============================================================================
// Workflow Queries
// ============================================================================

export interface WorkflowSummary {
  candidateId: string;
  projectId: string;
  currentState: string;
  matchScore: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all workflows for a project with summary information.
 */
export function getWorkflowsByProject(projectId: string): WorkflowSummary[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `
    SELECT candidate_id, project_id, current_state, match_score, created_at, updated_at
    FROM outreach_workflows
    WHERE project_id = ?
    ORDER BY match_score DESC, created_at DESC
  `,
    )
    .all(projectId) as Array<{
    candidate_id: string;
    project_id: string;
    current_state: string;
    match_score: number | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    candidateId: row.candidate_id,
    projectId: row.project_id,
    currentState: row.current_state,
    matchScore: row.match_score || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get workflow count by state for a project.
 * Useful for Kanban column counts.
 */
export function getWorkflowCountsByState(
  projectId: string,
): Record<string, number> {
  const db = getDatabase();
  const rows = db
    .prepare(
      `
    SELECT current_state, COUNT(*) as count
    FROM outreach_workflows
    WHERE project_id = ?
    GROUP BY current_state
  `,
    )
    .all(projectId) as Array<{ current_state: string; count: number }>;

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.current_state] = row.count;
  }
  return counts;
}

/**
 * Get full workflow data for a single candidate.
 * Returns both snapshot and summary info for UI.
 */
export function getWorkflowCandidate(candidateId: string): {
  summary: WorkflowSummary;
  snapshot: WorkflowSnapshot;
  context: WorkflowContext;
} | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `
    SELECT candidate_id, project_id, snapshot_json, current_state, match_score, created_at, updated_at
    FROM outreach_workflows
    WHERE candidate_id = ?
  `,
    )
    .get(candidateId) as
    | (WorkflowRecord & { created_at: string; updated_at: string })
    | undefined;

  if (!row) return null;

  try {
    const snapshot = JSON.parse(row.snapshot_json) as WorkflowSnapshot;
    return {
      summary: {
        candidateId: row.candidate_id,
        projectId: row.project_id,
        currentState: row.current_state,
        matchScore: row.match_score || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      snapshot,
      context: snapshot.context as WorkflowContext,
    };
  } catch (error) {
    console.error(
      `[WorkflowPersistence] Failed to parse workflow data for ${candidateId}:`,
      error,
    );
    return null;
  }
}
