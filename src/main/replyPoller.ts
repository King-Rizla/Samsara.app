/**
 * Reply Polling Service - Phase 10 Plan 02
 *
 * Polls Twilio for inbound SMS messages, classifies intent,
 * and sends REPLY_DETECTED events to matching workflow actors.
 */

import { getCredential } from "./credentialManager";
import { getDatabase } from "./database";
import { sendWorkflowEvent, getWorkflowState } from "./workflowService";
import { processCallbackReply } from "./callbackScheduler";
import * as crypto from "crypto";

// ============================================================================
// Intent Classification Keywords
// ============================================================================

// Check negative keywords first (more specific opt-out signals)
const NEGATIVE_KEYWORDS = [
  "no",
  "stop",
  "unsubscribe",
  "not interested",
  "remove",
  "no thanks",
  "no thank you",
  "busy",
  "wrong number",
  "do not contact",
  "opt out",
  "optout",
  "leave me alone",
  "dont text",
  "don't text",
  "quit",
  "cancel",
  "end",
];

// Positive keywords indicate interest
const POSITIVE_KEYWORDS = [
  "yes",
  "interested",
  "call",
  "available",
  "sure",
  "okay",
  "ok",
  "sounds good",
  "tell me more",
  "when",
  "what time",
  "let's talk",
  "lets talk",
  "call me",
  "please call",
  "i'm interested",
  "im interested",
  "count me in",
  "definitely",
  "absolutely",
  "great",
  "perfect",
  "works for me",
  "free",
  "tomorrow",
  "today",
  "this week",
  "next week",
];

// ============================================================================
// Types
// ============================================================================

export interface InboundMessage {
  sid: string;
  from: string;
  to: string;
  body: string;
  timestamp: Date;
}

// ============================================================================
// Intent Classification
// ============================================================================

/**
 * Classify the intent of a message body.
 * Per CONTEXT.md: Check negative first (more specific), then positive.
 * Ambiguous replies are treated as positive (let AI call determine interest).
 */
export function classifyIntent(
  body: string,
): "positive" | "negative" | "ambiguous" {
  const normalized = body.toLowerCase().trim();

  // Check negative keywords first (opt-out signals take priority)
  for (const keyword of NEGATIVE_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return "negative";
    }
  }

  // Check positive keywords
  for (const keyword of POSITIVE_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return "positive";
    }
  }

  // Default to ambiguous (per CONTEXT.md: treat as positive)
  return "ambiguous";
}

// ============================================================================
// Phone Normalization
// ============================================================================

/**
 * Normalize a phone number to digits only (with optional leading +).
 */
function normalizePhone(phone: string): string {
  // Keep leading + if present, strip all other non-digits
  if (phone.startsWith("+")) {
    return "+" + phone.slice(1).replace(/\D/g, "");
  }
  return phone.replace(/\D/g, "");
}

// ============================================================================
// Database Helpers
// ============================================================================

/**
 * Check if a message SID has already been processed.
 */
function isMessageProcessed(sid: string): boolean {
  const db = getDatabase();
  const row = db
    .prepare("SELECT 1 FROM messages WHERE provider_message_id = ?")
    .get(sid);
  return !!row;
}

/**
 * Store an inbound message in the database.
 */
function storeInboundMessage(
  projectId: string,
  cvId: string | null,
  from: string,
  to: string,
  body: string,
  sid: string,
): string {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO messages
    (id, project_id, cv_id, type, direction, status, from_address, to_address, body, provider_message_id, sent_at, created_at)
    VALUES (?, ?, ?, 'sms', 'inbound', 'received', ?, ?, ?, ?, ?, ?)
  `,
  ).run(id, projectId, cvId, from, to, body, sid, now, now);

  console.log(`[ReplyPoller] Stored inbound message ${sid} from ${from}`);
  return id;
}

/**
 * Get candidate ID by phone number for a project.
 * Joins cvs with outreach_workflows to find candidates in active outreach.
 */
function getCandidateIdByPhone(
  phone: string,
  projectId: string,
): string | null {
  const db = getDatabase();
  const normalizedPhone = normalizePhone(phone);

  // Try different phone formats: with/without country code, etc.
  // The cv contact_json stores phone in various formats
  const row = db
    .prepare(
      `
    SELECT c.id
    FROM cvs c
    INNER JOIN outreach_workflows w ON w.candidate_id = c.id
    WHERE w.project_id = ?
      AND (
        json_extract(c.contact_json, '$.phone') LIKE '%' || ? || '%'
        OR json_extract(c.contact_json, '$.phone') LIKE '%' || ? || '%'
      )
    LIMIT 1
  `,
    )
    .get(
      projectId,
      normalizedPhone.slice(-10), // Last 10 digits (US numbers without country code)
      normalizedPhone,
    ) as { id: string } | undefined;

  return row?.id || null;
}

// ============================================================================
// Twilio Polling
// ============================================================================

/**
 * Poll Twilio for inbound messages received in the last 30 minutes.
 * Filters to messages sent TO our Twilio number.
 */
export async function pollInboundMessages(
  projectId: string,
): Promise<InboundMessage[]> {
  const accountSid = getCredential(projectId, "twilio", "account_sid");
  const authToken = getCredential(projectId, "twilio", "auth_token");
  const twilioNumber = getCredential(projectId, "twilio", "phone_number");

  if (!accountSid || !authToken || !twilioNumber) {
    console.log(
      "[ReplyPoller] Twilio credentials not configured, skipping poll",
    );
    return [];
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Twilio = (await import("twilio")).default as any;
    const client = new Twilio(accountSid, authToken);

    // Get messages from last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const messages = await client.messages.list({
      to: twilioNumber,
      dateSentAfter: thirtyMinutesAgo,
      limit: 100,
    });

    // Filter to inbound messages only
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inboundMessages: InboundMessage[] = messages
      .filter((m: any) => m.direction === "inbound")
      .map((m: any) => ({
        sid: m.sid,
        from: m.from || "",
        to: m.to || "",
        body: m.body || "",
        timestamp: m.dateSent || new Date(),
      }));

    console.log(
      `[ReplyPoller] Polled ${inboundMessages.length} inbound messages`,
    );
    return inboundMessages;
  } catch (error) {
    console.error("[ReplyPoller] Failed to poll Twilio:", error);
    return [];
  }
}

// ============================================================================
// Message Processing
// ============================================================================

/**
 * Process inbound messages and route to appropriate workflow handlers.
 * - Looks up candidate by phone number
 * - Classifies intent
 * - Sends REPLY_DETECTED event to workflow
 * - Stores message in database
 */
export async function processInboundMessages(
  messages: InboundMessage[],
  projectId: string,
): Promise<void> {
  for (const message of messages) {
    // Skip if already processed (idempotency)
    if (isMessageProcessed(message.sid)) {
      continue;
    }

    // Look up candidate by phone
    const candidateId = getCandidateIdByPhone(message.from, projectId);
    if (!candidateId) {
      // Store as unmatched inbound message
      storeInboundMessage(
        projectId,
        null,
        message.from,
        message.to,
        message.body,
        message.sid,
      );
      console.log(
        `[ReplyPoller] Received message from unknown number: ${message.from}`,
      );
      continue;
    }

    // Store the inbound message
    storeInboundMessage(
      projectId,
      candidateId,
      message.from,
      message.to,
      message.body,
      message.sid,
    );

    // Get current workflow state
    const workflowState = getWorkflowState(candidateId);
    if (!workflowState) {
      console.log(
        `[ReplyPoller] No workflow found for candidate ${candidateId}`,
      );
      continue;
    }

    // Check if candidate is in callback_scheduled state
    // If so, route to callback processing instead of normal intent classification
    if (workflowState.state === "callback_scheduled") {
      const processed = await processCallbackReply(candidateId, message.body);
      if (processed) {
        console.log(
          `[ReplyPoller] Processed callback reply for ${candidateId}`,
        );
        continue;
      }
    }

    // Classify intent and send event
    const intent = classifyIntent(message.body);
    console.log(
      `[ReplyPoller] Classified message from ${candidateId} as ${intent}: "${message.body.substring(0, 50)}..."`,
    );

    const sent = sendWorkflowEvent(candidateId, {
      type: "REPLY_DETECTED",
      intent,
    });
    if (sent) {
      console.log(
        `[ReplyPoller] Sent REPLY_DETECTED event to workflow ${candidateId} with intent: ${intent}`,
      );
    }
  }
}

// ============================================================================
// Polling Management
// ============================================================================

let pollingInterval: NodeJS.Timeout | null = null;
let currentPollingProjectId: string | null = null;

/**
 * Start polling for inbound messages every 30 seconds.
 */
export function startReplyPolling(projectId: string): void {
  // Stop existing polling if any
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  currentPollingProjectId = projectId;
  console.log(`[ReplyPoller] Starting reply polling for project ${projectId}`);

  // Poll immediately once
  pollAndProcess(projectId);

  // Then poll every 30 seconds
  pollingInterval = setInterval(() => {
    if (currentPollingProjectId) {
      pollAndProcess(currentPollingProjectId);
    }
  }, 30000);
}

/**
 * Stop reply polling.
 */
export function stopReplyPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log(
      `[ReplyPoller] Stopped reply polling for project ${currentPollingProjectId}`,
    );
    currentPollingProjectId = null;
  }
}

/**
 * Internal: Poll and process messages.
 */
async function pollAndProcess(projectId: string): Promise<void> {
  try {
    const messages = await pollInboundMessages(projectId);
    if (messages.length > 0) {
      await processInboundMessages(messages, projectId);
    }
  } catch (error) {
    console.error("[ReplyPoller] Error during poll cycle:", error);
  }
}
