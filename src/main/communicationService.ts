/**
 * Communication Service - Phase 9 Plan 03
 *
 * Provides SMS sending via Twilio and email sending via Nodemailer.
 * Includes delivery status polling and DNC (Do Not Contact) registry.
 */

import { getCredential } from "./credentialManager";
import { getDatabase } from "./database";
import * as crypto from "crypto";

// ============================================================================
// SMS Sending (Twilio)
// ============================================================================

interface SendSMSParams {
  projectId: string;
  cvId: string;
  toPhone: string;
  body: string;
  templateId?: string;
}

export async function sendSMS(params: SendSMSParams): Promise<{
  success: boolean;
  messageId?: string;
  dbId?: string;
  error?: string;
}> {
  // Check DNC first
  if (isOnDNC("phone", params.toPhone)) {
    return { success: false, error: "Phone number is on Do Not Contact list" };
  }

  const accountSid = getCredential(params.projectId, "twilio", "account_sid");
  const authToken = getCredential(params.projectId, "twilio", "auth_token");
  const fromNumber = getCredential(params.projectId, "twilio", "phone_number");

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  try {
    // Dynamic import to avoid loading twilio at module load time
    const Twilio = (await import("twilio")).default;
    const client = new Twilio(accountSid, authToken);

    const message = await client.messages.create({
      body: params.body,
      from: fromNumber,
      to: params.toPhone,
    });

    // Log message to database
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO messages
      (id, project_id, cv_id, type, direction, status, from_address, to_address, body, template_id, provider_message_id, sent_at, created_at)
      VALUES (?, ?, ?, 'sms', 'outbound', 'sent', ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      id,
      params.projectId,
      params.cvId,
      fromNumber,
      params.toPhone,
      params.body,
      params.templateId || null,
      message.sid,
      now,
      now,
    );

    console.log(`[CommunicationService] SMS sent successfully: ${message.sid}`);
    return { success: true, messageId: message.sid, dbId: id };
  } catch (error) {
    console.error("[CommunicationService] SMS send failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

// ============================================================================
// Email Sending (Nodemailer)
// ============================================================================

interface SendEmailParams {
  projectId: string;
  cvId: string;
  toEmail: string;
  subject: string;
  body: string;
  templateId?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  dbId?: string;
  error?: string;
}> {
  // Check DNC first
  if (isOnDNC("email", params.toEmail)) {
    return { success: false, error: "Email address is on Do Not Contact list" };
  }

  const smtpHost = getCredential(params.projectId, "smtp", "host");
  const smtpPort = getCredential(params.projectId, "smtp", "port");
  const smtpUser = getCredential(params.projectId, "smtp", "user");
  const smtpPassword = getCredential(params.projectId, "smtp", "password");
  const fromEmail = getCredential(params.projectId, "smtp", "from_email");

  if (!smtpHost || !smtpUser || !smtpPassword) {
    return { success: false, error: "SMTP credentials not configured" };
  }

  try {
    // Dynamic import to avoid loading nodemailer at module load time
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort || "587", 10),
      secure: smtpPort === "465",
      auth: { user: smtpUser, pass: smtpPassword },
    });

    const result = await transporter.sendMail({
      from: fromEmail || smtpUser,
      to: params.toEmail,
      subject: params.subject,
      html: params.body,
      text: params.body.replace(/<[^>]*>/g, ""),
    });

    // Log message to database
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO messages
      (id, project_id, cv_id, type, direction, status, from_address, to_address, subject, body, template_id, provider_message_id, sent_at, created_at)
      VALUES (?, ?, ?, 'email', 'outbound', 'sent', ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      id,
      params.projectId,
      params.cvId,
      fromEmail || smtpUser,
      params.toEmail,
      params.subject,
      params.body,
      params.templateId || null,
      result.messageId,
      now,
      now,
    );

    console.log(
      `[CommunicationService] Email sent successfully: ${result.messageId}`,
    );
    return { success: true, messageId: result.messageId, dbId: id };
  } catch (error) {
    console.error("[CommunicationService] Email send failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

// ============================================================================
// Delivery Status Polling
// ============================================================================

export async function pollDeliveryStatus(projectId: string): Promise<void> {
  const accountSid = getCredential(projectId, "twilio", "account_sid");
  const authToken = getCredential(projectId, "twilio", "auth_token");

  if (!accountSid || !authToken) return;

  try {
    // Dynamic import to avoid loading twilio at module load time
    const Twilio = (await import("twilio")).default;
    const client = new Twilio(accountSid, authToken);
    const db = getDatabase();

    // Get messages with non-terminal status (only SMS - email doesn't have delivery tracking via Twilio)
    const pendingMessages = db
      .prepare(
        `
      SELECT id, provider_message_id FROM messages
      WHERE project_id = ? AND type = 'sms' AND status IN ('sent', 'queued')
    `,
      )
      .all(projectId) as { id: string; provider_message_id: string }[];

    for (const msg of pendingMessages) {
      if (!msg.provider_message_id) continue;

      try {
        const twilioMsg = await client
          .messages(msg.provider_message_id)
          .fetch();

        let newStatus: string | null = null;
        let errorMessage: string | null = null;

        switch (twilioMsg.status) {
          case "delivered":
            newStatus = "delivered";
            break;
          case "failed":
          case "undelivered":
            newStatus = "failed";
            errorMessage = twilioMsg.errorMessage || "Delivery failed";
            break;
          // queued, sent, sending - still in progress
          default:
            continue;
        }

        if (newStatus) {
          const now = new Date().toISOString();
          db.prepare(
            `
            UPDATE messages SET status = ?, delivered_at = ?, error_message = ? WHERE id = ?
          `,
          ).run(
            newStatus,
            newStatus === "delivered" ? now : null,
            errorMessage,
            msg.id,
          );
          console.log(
            `[CommunicationService] Updated message ${msg.id} status to ${newStatus}`,
          );
        }
      } catch (error) {
        console.error(
          `[CommunicationService] Failed to poll status for message ${msg.id}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("[CommunicationService] Delivery polling failed:", error);
  }
}

// Polling management
let pollingInterval: NodeJS.Timeout | null = null;
let currentPollingProjectId: string | null = null;

export function startDeliveryPolling(projectId: string): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  currentPollingProjectId = projectId;
  pollingInterval = setInterval(() => {
    if (currentPollingProjectId) {
      pollDeliveryStatus(currentPollingProjectId);
    }
  }, 60000); // Every 60 seconds per CONTEXT.md

  // Run immediately once
  pollDeliveryStatus(projectId);
  console.log(
    `[CommunicationService] Started delivery polling for project ${projectId}`,
  );
}

export function stopDeliveryPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log(
      `[CommunicationService] Stopped delivery polling for project ${currentPollingProjectId}`,
    );
    currentPollingProjectId = null;
  }
}

// ============================================================================
// DNC (Do Not Contact) Registry
// ============================================================================

function normalizeContactValue(type: "phone" | "email", value: string): string {
  if (type === "phone") {
    // Remove all non-digit characters except leading +
    return value.replace(/[^\d+]/g, "");
  }
  return value.toLowerCase().trim();
}

export function addToDNC(
  type: "phone" | "email",
  value: string,
  reason: "opt_out" | "bounce" | "manual",
  sourceMessageId?: string,
): string {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const normalized = normalizeContactValue(type, value);

  db.prepare(
    `
    INSERT OR IGNORE INTO dnc_registry (id, type, value, reason, source_message_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  ).run(id, type, normalized, reason, sourceMessageId || null, now);

  console.log(`[CommunicationService] Added to DNC: ${type} ${normalized}`);
  return id;
}

export function isOnDNC(type: "phone" | "email", value: string): boolean {
  const db = getDatabase();
  const normalized = normalizeContactValue(type, value);
  const row = db
    .prepare(
      `
    SELECT id FROM dnc_registry WHERE type = ? AND value = ?
  `,
    )
    .get(type, normalized);
  return !!row;
}

export function removeFromDNC(type: "phone" | "email", value: string): boolean {
  const db = getDatabase();
  const normalized = normalizeContactValue(type, value);
  const result = db
    .prepare(
      `
    DELETE FROM dnc_registry WHERE type = ? AND value = ?
  `,
    )
    .run(type, normalized);
  if (result.changes > 0) {
    console.log(
      `[CommunicationService] Removed from DNC: ${type} ${normalized}`,
    );
  }
  return result.changes > 0;
}

export function getDNCList(): Array<{
  id: string;
  type: string;
  value: string;
  reason: string;
  createdAt: string;
}> {
  const db = getDatabase();
  return db
    .prepare(
      `
    SELECT id, type, value, reason, created_at as createdAt FROM dnc_registry ORDER BY created_at DESC
  `,
    )
    .all() as Array<{
    id: string;
    type: string;
    value: string;
    reason: string;
    createdAt: string;
  }>;
}
