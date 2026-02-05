/**
 * Voice Service - Phase 11 AI Voice Screening
 *
 * Integrates with ElevenLabs Conversational AI for outbound screening calls.
 * Uses polling to retrieve call status (desktop app constraint - no webhooks).
 *
 * ElevenLabs Twilio integration handles:
 * - Voice AI agent with system prompt
 * - Outbound call initiation via SIP
 * - Turn-taking, interruptions, latency
 * - Post-call transcript generation
 */

import { getCredential } from "./credentialManager";
import { getDatabase } from "./database";
import crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

export interface OutboundCallParams {
  candidateId: string;
  projectId: string;
  phoneNumber: string;
  candidateName: string;
  roleTitle: string;
  companyName?: string;
  salaryRange?: { min: number; max: number };
  location?: string;
  priorMessaging?: string; // Context from SMS/email
}

export interface OutboundCallResult {
  success: boolean;
  conversationId?: string;
  callRecordId?: string;
  error?: string;
}

export interface CallStatusResult {
  status: "pending" | "in_progress" | "completed" | "failed" | "no_answer";
  transcript?: string;
  durationSeconds?: number;
  analysis?: {
    callSuccessful: boolean;
    transcriptSummary: string;
    dataCollectionResults?: Record<string, unknown>;
  };
}

// ElevenLabs API response types (based on documented API)
interface ElevenLabsOutboundCallResponse {
  success: boolean;
  conversation_id?: string;
  call_sid?: string;
  message?: string;
}

interface ElevenLabsConversationResponse {
  conversation_id: string;
  agent_id: string;
  status: string; // "pending" | "processing" | "in_progress" | "done" | "failed"
  transcript?: Array<{
    role: "agent" | "user";
    message: string;
    time_in_call_secs?: number;
  }>;
  analysis?: {
    call_successful?: string;
    transcript_summary?: string;
    data_collection_results?: Record<string, unknown>;
    evaluation_criteria_results?: Record<string, unknown>;
  };
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    cost?: number;
    end_reason?: string;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get ElevenLabs API key from credential manager.
 */
function getApiKey(): string | null {
  return getCredential(null, "elevenlabs", "api_key");
}

/**
 * Build dynamic variables for ElevenLabs agent personalization.
 * Per RESEARCH.md: candidate name, role, company, salary, location, prior context
 */
function buildDynamicVariables(
  params: OutboundCallParams,
): Record<string, string> {
  const vars: Record<string, string> = {
    candidate_name: params.candidateName,
    candidate_first_name: params.candidateName.split(" ")[0],
    role_title: params.roleTitle,
    company_name: params.companyName || "our client",
  };

  if (params.salaryRange) {
    vars.salary_min = params.salaryRange.min.toLocaleString();
    vars.salary_max = params.salaryRange.max.toLocaleString();
  }
  if (params.location) {
    vars.job_location = params.location;
  }
  if (params.priorMessaging) {
    vars.prior_context = params.priorMessaging;
  }

  return vars;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Initiate an outbound screening call via ElevenLabs + Twilio.
 * Per CONTEXT.md: 2-3 minute pre-screening call gathering logistics.
 *
 * Uses ElevenLabs Twilio outbound call API:
 * POST /v1/convai/conversation/twilio/outbound_call
 */
export async function initiateScreeningCall(
  params: OutboundCallParams,
): Promise<OutboundCallResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: "ElevenLabs API key not configured" };
  }

  // Get agent and phone number IDs (project-specific or global)
  const agentId =
    getCredential(params.projectId, "elevenlabs", "screening_agent_id") ||
    getCredential(null, "elevenlabs", "screening_agent_id");
  const phoneNumberId =
    getCredential(params.projectId, "elevenlabs", "phone_number_id") ||
    getCredential(null, "elevenlabs", "phone_number_id");

  if (!agentId || !phoneNumberId) {
    return {
      success: false,
      error: "ElevenLabs agent or phone number not configured",
    };
  }

  try {
    const dynamicVariables = buildDynamicVariables(params);

    // ElevenLabs Twilio outbound call API
    // https://elevenlabs.io/docs/api-reference/twilio/outbound-call
    const response = await fetch(
      `${ELEVENLABS_API_BASE}/convai/conversation/twilio/outbound_call`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          agent_id: agentId,
          agent_phone_number_id: phoneNumberId,
          to_number: params.phoneNumber,
          conversation_initiation_client_data: {
            dynamic_variables: dynamicVariables,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[VoiceService] API error:", response.status, errorText);
      return {
        success: false,
        error: `API error: ${response.status} ${errorText}`,
      };
    }

    const data = (await response.json()) as ElevenLabsOutboundCallResponse;

    if (!data.conversation_id && !data.call_sid) {
      return {
        success: false,
        error: data.message || "No conversation ID returned",
      };
    }

    // Create call record in database
    const db = getDatabase();
    const callId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO call_records (
        id, project_id, cv_id, type, status, provider_call_id, phone_number,
        started_at, created_at, attempt_number
      ) VALUES (?, ?, ?, 'screening', 'in_progress', ?, ?, ?, ?, 1)
    `,
    ).run(
      callId,
      params.projectId,
      params.candidateId,
      data.conversation_id || data.call_sid || null,
      params.phoneNumber,
      now,
      now,
    );

    console.log(
      `[VoiceService] Initiated screening call for ${params.candidateId}: ${data.conversation_id || data.call_sid}`,
    );

    return {
      success: true,
      conversationId: data.conversation_id || data.call_sid || undefined,
      callRecordId: callId,
    };
  } catch (error) {
    console.error("[VoiceService] Failed to initiate call:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get call status from ElevenLabs API (polling approach).
 * Desktop apps cannot receive webhooks, so we poll for status.
 *
 * GET /v1/convai/conversations/{conversation_id}
 */
export async function getCallStatus(
  conversationId: string,
): Promise<CallStatusResult | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[VoiceService] No API key for status check");
    return null;
  }

  try {
    const response = await fetch(
      `${ELEVENLABS_API_BASE}/convai/conversations/${conversationId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
        },
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Conversation not found - may be too early or invalid ID
        return null;
      }
      console.error(
        "[VoiceService] Status check failed:",
        response.status,
        await response.text(),
      );
      return null;
    }

    const conversation =
      (await response.json()) as ElevenLabsConversationResponse;

    // Map ElevenLabs status to our status
    let status: CallStatusResult["status"] = "pending";
    switch (conversation.status) {
      case "in_progress":
      case "processing":
        status = "in_progress";
        break;
      case "done":
      case "completed":
        status = "completed";
        break;
      case "failed":
        status = "failed";
        break;
      case "no_answer":
        status = "no_answer";
        break;
      default:
        status = "pending";
    }

    // Check for end_reason to detect no answer / voicemail
    if (
      conversation.metadata?.end_reason === "no_answer" ||
      conversation.metadata?.end_reason === "busy"
    ) {
      status = "no_answer";
    }

    // Format transcript if available
    let transcript: string | undefined;
    if (conversation.transcript && Array.isArray(conversation.transcript)) {
      transcript = conversation.transcript
        .map(
          (t) => `${t.role === "agent" ? "Agent" : "Candidate"}: ${t.message}`,
        )
        .join("\n\n");
    }

    return {
      status,
      transcript,
      durationSeconds: conversation.metadata?.call_duration_secs,
      analysis: conversation.analysis
        ? {
            callSuccessful: conversation.analysis.call_successful === "true",
            transcriptSummary: conversation.analysis.transcript_summary || "",
            dataCollectionResults:
              conversation.analysis.data_collection_results,
          }
        : undefined,
    };
  } catch (error) {
    console.error("[VoiceService] Failed to get call status:", error);
    return null;
  }
}

/**
 * Check if voice calling is configured for a project.
 * Checks for API key, agent ID, and phone number ID.
 */
export function isVoiceConfigured(projectId: string | null): boolean {
  const apiKey = getCredential(null, "elevenlabs", "api_key");

  // Check project-specific or global agent ID
  const agentId =
    (projectId
      ? getCredential(projectId, "elevenlabs", "screening_agent_id")
      : null) || getCredential(null, "elevenlabs", "screening_agent_id");

  // Check project-specific or global phone number ID
  const phoneNumberId =
    (projectId
      ? getCredential(projectId, "elevenlabs", "phone_number_id")
      : null) || getCredential(null, "elevenlabs", "phone_number_id");

  const configured = !!(apiKey && agentId && phoneNumberId);

  if (!configured) {
    console.log("[VoiceService] Voice not configured:", {
      hasApiKey: !!apiKey,
      hasAgentId: !!agentId,
      hasPhoneNumberId: !!phoneNumberId,
    });
  }

  return configured;
}

/**
 * Get all in-progress calls from database.
 * Used by the voice poller to know which calls to check.
 */
export function getInProgressCalls(): Array<{
  id: string;
  cv_id: string;
  provider_call_id: string;
  project_id: string;
}> {
  const db = getDatabase();
  return db
    .prepare(
      `
    SELECT id, cv_id, provider_call_id, project_id
    FROM call_records
    WHERE status = 'in_progress' AND type = 'screening' AND provider_call_id IS NOT NULL
  `,
    )
    .all() as Array<{
    id: string;
    cv_id: string;
    provider_call_id: string;
    project_id: string;
  }>;
}

/**
 * Update call record with completed status and transcript.
 */
export function updateCallRecordCompleted(
  callId: string,
  status: string,
  durationSeconds: number,
  transcriptId?: string,
): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `
    UPDATE call_records SET
      status = ?,
      duration_seconds = ?,
      ended_at = ?
    WHERE id = ?
  `,
  ).run(status, durationSeconds, now, callId);
}

/**
 * Store transcript in database.
 */
export function storeTranscript(
  callId: string,
  projectId: string,
  rawText: string,
  summary?: string,
): string {
  const db = getDatabase();
  const transcriptId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO transcripts (id, call_id, project_id, raw_text, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  ).run(transcriptId, callId, projectId, rawText, summary || null, now);

  return transcriptId;
}
