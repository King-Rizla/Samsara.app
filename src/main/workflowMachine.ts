/**
 * Outreach Workflow State Machine - Phase 10
 *
 * XState v5 state machine for managing the outreach workflow lifecycle:
 * pending -> contacted -> replied -> screening -> passed/failed
 *
 * Uses the setup() pattern for strongly-typed machines with:
 * - Actions for state updates and persistence
 * - Guards for transition conditions
 * - Actors for async operations (SMS, email, AI call)
 * - Dynamic delays for escalation timeouts
 */

import { setup, assign, fromPromise } from "xstate";
import { sendSMS, sendEmail } from "./communicationService";

// ============================================================================
// Types
// ============================================================================

export type WorkflowState =
  | "pending"
  | "contacted"
  | "replied"
  | "screening"
  | "passed"
  | "failed"
  | "paused"
  | "archived";

export interface WorkflowContext {
  candidateId: string;
  projectId: string;
  matchScore: number;
  candidateName: string;
  phone?: string;
  email?: string;
  escalationTimeoutMs: number; // Configurable per project (default 30 min)
  replyDetected: boolean;
  replyIntent: "positive" | "negative" | "ambiguous" | null;
  screeningOutcome: "passed" | "failed" | null;
  timestamps: {
    startedAt: string;
    contactedAt?: string;
    repliedAt?: string;
    screeningAt?: string;
    completedAt?: string;
  };
  lastError?: string;
}

export type WorkflowEvent =
  | { type: "GRADUATE" }
  | { type: "REPLY_DETECTED"; intent: "positive" | "negative" | "ambiguous" }
  | { type: "TIMEOUT" }
  | { type: "SCREENING_COMPLETE"; outcome: "passed" | "failed" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "CANCEL" }
  | { type: "FORCE_CALL" }
  | { type: "SKIP_TO_SCREENING" };

export interface WorkflowInput {
  candidateId: string;
  projectId: string;
  matchScore: number;
  candidateName: string;
  phone?: string;
  email?: string;
  escalationTimeoutMs: number;
}

// ============================================================================
// State Machine Definition
// ============================================================================

export const outreachMachine = setup({
  types: {
    context: {} as WorkflowContext,
    events: {} as WorkflowEvent,
    input: {} as WorkflowInput,
  },
  actions: {
    // Mark contacted timestamp when initial outreach is sent
    sendInitialOutreach: assign({
      timestamps: ({ context }) => ({
        ...context.timestamps,
        contactedAt: new Date().toISOString(),
      }),
    }),

    // Mark replied timestamp
    markReplied: assign({
      timestamps: ({ context }) => ({
        ...context.timestamps,
        repliedAt: new Date().toISOString(),
      }),
    }),

    // Mark screening started timestamp
    markScreeningStarted: assign({
      timestamps: ({ context }) => ({
        ...context.timestamps,
        screeningAt: new Date().toISOString(),
      }),
    }),

    // Mark completed timestamp (final states)
    markCompleted: assign({
      timestamps: ({ context }) => ({
        ...context.timestamps,
        completedAt: new Date().toISOString(),
      }),
    }),

    // Store reply information
    storeReplyInfo: assign({
      replyDetected: true,
      replyIntent: ({ event }) => {
        if (event.type === "REPLY_DETECTED") {
          return event.intent;
        }
        return null;
      },
    }),

    // Store screening outcome
    storeScreeningOutcome: assign({
      screeningOutcome: ({ event }) => {
        if (event.type === "SCREENING_COMPLETE") {
          return event.outcome;
        }
        return null;
      },
    }),

    // Store error
    storeError: assign({
      lastError: ({ event }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = (event as any).error;
        return err instanceof Error ? err.message : String(err);
      },
    }),
  },
  guards: {
    // Check if candidate has phone number
    hasPhone: ({ context }) => !!context.phone,

    // Check if candidate has email
    hasEmail: ({ context }) => !!context.email,

    // Check if reply is positive (positive or ambiguous per CONTEXT.md)
    isPositiveReply: ({ context }) =>
      context.replyIntent === "positive" || context.replyIntent === "ambiguous",

    // Check if AI call is enabled for this project (placeholder for project setting)
    aiCallEnabled: () => {
      // TODO: Check project setting in Phase 11
      // For now, return true to allow escalation flow
      return true;
    },

    // Check if screening outcome is passed
    isPassed: ({ event }) => {
      if (event.type === "SCREENING_COMPLETE") {
        return event.outcome === "passed";
      }
      return false;
    },
  },
  actors: {
    // Actor: Send initial SMS + Email simultaneously
    sendInitialMessages: fromPromise(
      async ({ input }: { input: WorkflowContext }) => {
        const results = await Promise.allSettled([
          // Send SMS if phone is available
          input.phone
            ? sendSMS({
                projectId: input.projectId,
                cvId: input.candidateId,
                toPhone: input.phone,
                body: `Hi ${input.candidateName}, we have an exciting opportunity that matches your profile. Are you available for a quick call?`,
              })
            : Promise.resolve({ success: true, skipped: true }),
          // Send Email if email is available
          input.email
            ? sendEmail({
                projectId: input.projectId,
                cvId: input.candidateId,
                toEmail: input.email,
                subject: "Exciting Career Opportunity",
                body: `<p>Hi ${input.candidateName},</p><p>We came across your profile and believe you would be a great fit for an opportunity we're working on.</p><p>Would you be available for a quick call to discuss?</p>`,
              })
            : Promise.resolve({ success: true, skipped: true }),
        ]);

        console.log(
          `[WorkflowMachine] Sent initial messages for ${input.candidateId}:`,
          results,
        );
        return results;
      },
    ),

    // Actor: Trigger AI call (placeholder for Phase 11)
    triggerAICall: fromPromise(
      async ({ input }: { input: WorkflowContext }) => {
        // ElevenLabs + Twilio SIP integration will be implemented in Phase 11
        console.log(
          `[WorkflowMachine] AI call placeholder for ${input.candidateId} - ${input.phone}`,
        );
        // For now, just log and return placeholder
        return {
          callId: `placeholder-${input.candidateId}`,
          status: "pending",
        };
      },
    ),
  },
  delays: {
    // Dynamic escalation timeout from context
    escalationTimeout: ({ context }) => context.escalationTimeoutMs,
  },
}).createMachine({
  id: "outreachWorkflow",
  initial: "pending",
  context: ({ input }) => ({
    candidateId: input.candidateId,
    projectId: input.projectId,
    matchScore: input.matchScore,
    candidateName: input.candidateName,
    phone: input.phone,
    email: input.email,
    escalationTimeoutMs: input.escalationTimeoutMs,
    replyDetected: false,
    replyIntent: null,
    screeningOutcome: null,
    timestamps: {
      startedAt: new Date().toISOString(),
    },
  }),
  states: {
    // ========================================================================
    // PENDING: Waiting for graduation
    // ========================================================================
    pending: {
      on: {
        GRADUATE: {
          target: "contacted",
          actions: ["sendInitialOutreach"],
        },
      },
    },

    // ========================================================================
    // CONTACTED: Initial outreach sent, waiting for reply or timeout
    // ========================================================================
    contacted: {
      // Invoke actor to send SMS + Email
      invoke: {
        id: "sendMessages",
        src: "sendInitialMessages",
        input: ({ context }) => context,
        onDone: {
          // Messages sent successfully - stay in contacted state
        },
        onError: {
          // Log error but stay in contacted state
          actions: ["storeError"],
        },
      },
      // Dynamic timeout escalation
      after: {
        escalationTimeout: {
          target: "screening",
          guard: "aiCallEnabled",
          actions: ["markScreeningStarted"],
        },
      },
      on: {
        REPLY_DETECTED: [
          {
            // Positive/ambiguous reply -> proceed to replied state
            guard: ({ event }) =>
              event.intent === "positive" || event.intent === "ambiguous",
            target: "replied",
            actions: ["storeReplyInfo", "markReplied"],
          },
          {
            // Negative reply -> archive (don't escalate)
            target: "archived",
            actions: ["storeReplyInfo", "markCompleted"],
          },
        ],
        PAUSE: {
          target: "paused",
        },
        CANCEL: {
          target: "archived",
          actions: ["markCompleted"],
        },
        SKIP_TO_SCREENING: {
          target: "screening",
          actions: ["markScreeningStarted"],
        },
        TIMEOUT: {
          // Manual timeout trigger (for app restart catch-up)
          target: "screening",
          guard: "aiCallEnabled",
          actions: ["markScreeningStarted"],
        },
      },
    },

    // ========================================================================
    // REPLIED: Reply detected - transition to screening immediately
    // ========================================================================
    replied: {
      always: {
        guard: "aiCallEnabled",
        target: "screening",
        actions: ["markScreeningStarted"],
      },
    },

    // ========================================================================
    // SCREENING: AI call in progress
    // ========================================================================
    screening: {
      invoke: {
        id: "aiCall",
        src: "triggerAICall",
        input: ({ context }) => context,
        onDone: {
          // Call initiated - wait for SCREENING_COMPLETE event
        },
        onError: {
          target: "failed",
          actions: ["storeError", "markCompleted"],
        },
      },
      on: {
        SCREENING_COMPLETE: [
          {
            guard: "isPassed",
            target: "passed",
            actions: ["storeScreeningOutcome", "markCompleted"],
          },
          {
            target: "failed",
            actions: ["storeScreeningOutcome", "markCompleted"],
          },
        ],
        PAUSE: {
          target: "paused",
        },
        CANCEL: {
          target: "archived",
          actions: ["markCompleted"],
        },
      },
    },

    // ========================================================================
    // PASSED: Screening passed - final state
    // ========================================================================
    passed: {
      type: "final",
    },

    // ========================================================================
    // FAILED: Screening failed - can receive late replies for callback scheduling
    // ========================================================================
    failed: {
      on: {
        REPLY_DETECTED: {
          // WRK-05: Handle late replies for callback scheduling
          actions: [
            assign({ replyDetected: true }),
            // TODO: Trigger callback scheduling in future phase
          ],
        },
      },
    },

    // ========================================================================
    // PAUSED: Recruiter paused the workflow
    // ========================================================================
    paused: {
      on: {
        RESUME: {
          target: "contacted",
        },
        CANCEL: {
          target: "archived",
          actions: ["markCompleted"],
        },
        FORCE_CALL: {
          target: "screening",
          actions: ["markScreeningStarted"],
        },
      },
    },

    // ========================================================================
    // ARCHIVED: Workflow ended without completion - final state
    // ========================================================================
    archived: {
      type: "final",
    },
  },
});

// Export types for use in other modules
export type OutreachMachine = typeof outreachMachine;
