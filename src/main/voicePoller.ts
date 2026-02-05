/**
 * Voice Poller - Phase 11 AI Voice Screening
 *
 * Polls ElevenLabs for call status updates.
 * Desktop apps cannot receive webhooks, so we poll.
 *
 * Poll interval: 10 seconds (calls are 2-3 minutes)
 * - Check all in-progress screening calls
 * - Update call_records with status
 * - Store transcripts when calls complete
 * - Report to workflow machine for state transitions
 */

import {
  getCallStatus,
  getInProgressCalls,
  updateCallRecordCompleted,
  storeTranscript,
} from "./voiceService";
import { reportScreeningComplete, getWorkflowActor } from "./workflowService";
import { analyzeTranscript } from "./transcriptAnalyzer";
import { getDatabase } from "./database";

// ============================================================================
// Configuration
// ============================================================================

const POLL_INTERVAL_MS = 10_000; // 10 seconds

// ============================================================================
// State
// ============================================================================

let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let isPolling = false;

// ============================================================================
// Core Polling Logic
// ============================================================================

/**
 * Poll for in-progress calls and update status.
 * This is the main polling loop body.
 */
async function pollCallStatuses(): Promise<void> {
  // Prevent concurrent polling
  if (isPolling) {
    console.log("[VoicePoller] Skipping - previous poll still running");
    return;
  }

  isPolling = true;

  try {
    // Get all in-progress screening calls
    const inProgressCalls = getInProgressCalls();

    if (inProgressCalls.length === 0) {
      return; // Nothing to poll
    }

    console.log(
      `[VoicePoller] Polling ${inProgressCalls.length} in-progress calls`,
    );

    for (const call of inProgressCalls) {
      try {
        const status = await getCallStatus(call.provider_call_id);

        if (!status) {
          // Could be too early or API error - skip for now
          continue;
        }

        // Handle completed/failed/no_answer states
        if (
          status.status === "completed" ||
          status.status === "failed" ||
          status.status === "no_answer"
        ) {
          // Update call record
          updateCallRecordCompleted(
            call.id,
            status.status,
            status.durationSeconds || 0,
          );

          // Store transcript if available
          if (status.transcript) {
            storeTranscript(
              call.id,
              call.project_id,
              status.transcript,
              status.analysis?.transcriptSummary,
            );
          }

          // Report to workflow with analysis result
          if (status.status === "completed" && call.cv_id) {
            console.log(
              `[VoicePoller] Call ${call.id} completed, transcript stored`,
            );

            // Analyze transcript for pass/maybe/fail if available
            if (status.transcript) {
              try {
                const result = await analyzeTranscript(
                  status.transcript,
                  call.project_id,
                );

                // Update call record with screening outcome
                const db = getDatabase();
                db.prepare(
                  `
                  UPDATE call_records SET
                    screening_outcome = ?,
                    screening_confidence = ?,
                    extracted_data_json = ?
                  WHERE id = ?
                `,
                ).run(
                  result.outcome,
                  result.confidence,
                  JSON.stringify({
                    ...result.extractedData,
                    reasoning: result.reasoning,
                    disqualifiers: result.disqualifiers,
                  }),
                  call.id,
                );

                // Report to workflow - pass or maybe = passed, fail = failed
                // Treat 'maybe' as passed so recruiter can make final call
                const workflowOutcome =
                  result.outcome === "fail" ? "failed" : "passed";
                const actor = getWorkflowActor(call.cv_id);
                if (actor) {
                  reportScreeningComplete(call.cv_id, workflowOutcome);
                }

                console.log(
                  `[VoicePoller] Call ${call.id} analyzed: ${result.outcome} (${result.confidence}%), workflow: ${workflowOutcome}`,
                );
              } catch (analyzeError) {
                console.error(
                  `[VoicePoller] Failed to analyze transcript for call ${call.id}:`,
                  analyzeError,
                );
                // Still report as passed if analysis fails - let recruiter decide
                const actor = getWorkflowActor(call.cv_id);
                if (actor) {
                  reportScreeningComplete(call.cv_id, "passed");
                }
              }
            } else {
              // No transcript available - pass to recruiter for manual review
              const actor = getWorkflowActor(call.cv_id);
              if (actor) {
                reportScreeningComplete(call.cv_id, "passed");
              }
              console.log(
                `[VoicePoller] Call ${call.id} completed but no transcript - passed to recruiter`,
              );
            }
          } else if (
            (status.status === "failed" || status.status === "no_answer") &&
            call.cv_id
          ) {
            // Call failed or no answer - report failure to workflow
            const actor = getWorkflowActor(call.cv_id);
            if (actor) {
              reportScreeningComplete(call.cv_id, "failed");
              console.log(
                `[VoicePoller] Call ${call.id} ${status.status}, reported failed to workflow`,
              );
            }
          }
        }
      } catch (error) {
        console.error(`[VoicePoller] Error polling call ${call.id}:`, error);
        // Continue to next call - don't fail entire poll
      }
    }
  } finally {
    isPolling = false;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Start the voice poller.
 * Should be called on app ready after workflow service is initialized.
 */
export function startVoicePoller(): void {
  if (pollIntervalId) {
    console.warn("[VoicePoller] Already running");
    return;
  }

  console.log("[VoicePoller] Starting with interval", POLL_INTERVAL_MS, "ms");
  pollIntervalId = setInterval(pollCallStatuses, POLL_INTERVAL_MS);

  // Run immediately to catch any in-progress calls from previous session
  pollCallStatuses();
}

/**
 * Stop the voice poller.
 * Should be called before app quits.
 */
export function stopVoicePoller(): void {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
    console.log("[VoicePoller] Stopped");
  }
}

/**
 * Check if the voice poller is running.
 */
export function isVoicePollerRunning(): boolean {
  return pollIntervalId !== null;
}

/**
 * Force an immediate poll (for testing or manual refresh).
 */
export async function forcePoll(): Promise<void> {
  await pollCallStatuses();
}
