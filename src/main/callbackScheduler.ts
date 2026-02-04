/**
 * Callback Scheduler - Phase 10 Plan 02
 *
 * Handles post-failed-screening callback scheduling (WRK-05).
 * Generates available time slots, sends callback options via SMS,
 * and processes candidate slot selection.
 *
 * Note: Full implementation in Task 4. This file includes stubs
 * for functions needed by replyPoller.ts.
 */

import { getDatabase } from "./database";
import { sendSMS } from "./communicationService";
import {
  isWithinWorkingHours,
  getNextWorkingHoursStart,
  getProjectOutreachSettings,
} from "./workingHours";
import { sendWorkflowEvent } from "./workflowService";
import * as crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

export interface CallbackSlot {
  id: string;
  candidateId: string;
  projectId: string;
  scheduledAt: string; // ISO timestamp
  status: "pending" | "confirmed" | "completed" | "cancelled";
  recruiterNotes?: string;
}

interface PendingCallbackRequest {
  id: string;
  candidateId: string;
  projectId: string;
  slots: Array<{ option: number; time: string; formatted: string }>;
  createdAt: string;
}

// ============================================================================
// Slot Generation
// ============================================================================

/**
 * Generate available callback slots during working hours.
 * Slots are 30 minutes apart and skip already-booked times.
 */
export async function generateCallbackSlots(
  projectId: string,
  count = 3,
): Promise<Array<{ time: Date; formatted: string }>> {
  const settings = getProjectOutreachSettings(projectId);
  const db = getDatabase();

  const config = {
    enabled: settings.working_hours_enabled === 1,
    startHour: parseInt(settings.working_hours_start?.split(":")[0] || "9", 10),
    startMinute: parseInt(
      settings.working_hours_start?.split(":")[1] || "0",
      10,
    ),
    endHour: parseInt(settings.working_hours_end?.split(":")[0] || "17", 10),
    endMinute: parseInt(settings.working_hours_end?.split(":")[1] || "0", 10),
    timezone: settings.working_hours_timezone || "America/New_York",
    workDays: JSON.parse(settings.working_hours_days || "[1,2,3,4,5]"),
  };

  // Get already booked slots
  const bookedSlots = db
    .prepare(
      `
    SELECT scheduled_at FROM callback_slots
    WHERE project_id = ? AND status IN ('pending', 'confirmed')
  `,
    )
    .all(projectId) as { scheduled_at: string }[];
  const bookedTimes = new Set(bookedSlots.map((s) => s.scheduled_at));

  const slots: Array<{ time: Date; formatted: string }> = [];
  let checkTime = new Date();
  checkTime.setMinutes(Math.ceil(checkTime.getMinutes() / 30) * 30, 0, 0); // Round to next 30 min

  // Look ahead up to 7 days
  const maxTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  while (slots.length < count && checkTime < maxTime) {
    // Check if within working hours
    if (isWithinWorkingHours(config, checkTime)) {
      const isoTime = checkTime.toISOString();
      if (!bookedTimes.has(isoTime)) {
        slots.push({
          time: new Date(checkTime),
          formatted: formatSlotTime(checkTime),
        });
      }
    }

    // Move to next 30-minute slot
    checkTime = new Date(checkTime.getTime() + 30 * 60 * 1000);

    // If we're past end of working day, jump to start of next working day
    if (
      !isWithinWorkingHours(config, checkTime) &&
      checkTime.getHours() >= config.endHour
    ) {
      const nextStart = getNextWorkingHoursStart(config, checkTime);
      if (nextStart) {
        checkTime = nextStart;
      }
    }
  }

  return slots;
}

/**
 * Format a slot time for SMS display.
 * Example: "Mon 2:00 PM" or "Tue 10:30 AM"
 */
function formatSlotTime(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = days[date.getDay()];
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes =
    minutes === 0 ? "" : `:${minutes.toString().padStart(2, "0")}`;
  return `${day} ${displayHours}${displayMinutes} ${ampm}`;
}

// ============================================================================
// Callback Scheduling
// ============================================================================

/**
 * Schedule a callback at a specific time.
 */
export async function scheduleCallback(
  candidateId: string,
  projectId: string,
  slotTime: Date,
): Promise<CallbackSlot> {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO callback_slots (id, candidate_id, project_id, scheduled_at, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'confirmed', ?, ?)
  `,
  ).run(id, candidateId, projectId, slotTime.toISOString(), now, now);

  console.log(
    `[CallbackScheduler] Scheduled callback for ${candidateId} at ${slotTime.toISOString()}`,
  );

  return {
    id,
    candidateId,
    projectId,
    scheduledAt: slotTime.toISOString(),
    status: "confirmed",
  };
}

/**
 * Send callback options to a candidate via SMS.
 * Stores pending request to track which slots were offered.
 */
export async function sendCallbackOptions(
  candidateId: string,
  projectId: string,
  phone: string,
): Promise<boolean> {
  const slots = await generateCallbackSlots(projectId, 3);
  if (slots.length === 0) {
    console.error(
      "[CallbackScheduler] No available slots for callback scheduling",
    );
    return false;
  }

  // Format message with numbered options
  const optionLines = slots.map((s, i) => `${i + 1}) ${s.formatted}`);
  const body = `Thanks for your interest! When works for a quick call? Reply 1, 2, or 3:\n${optionLines.join("\n")}`;

  // Send SMS
  const result = await sendSMS({
    projectId,
    cvId: candidateId,
    toPhone: phone,
    body,
  });

  if (!result.success) {
    console.error(
      `[CallbackScheduler] Failed to send callback options: ${result.error}`,
    );
    return false;
  }

  // Store pending request
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const slotsData = slots.map((s, i) => ({
    option: i + 1,
    time: s.time.toISOString(),
    formatted: s.formatted,
  }));

  db.prepare(
    `
    INSERT INTO pending_callback_requests (id, candidate_id, project_id, slots_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,
  ).run(id, candidateId, projectId, JSON.stringify(slotsData), now);

  console.log(
    `[CallbackScheduler] Sent callback options to ${candidateId}: ${optionLines.join(", ")}`,
  );
  return true;
}

/**
 * Process a candidate's reply selecting a callback slot.
 * Returns true if reply was processed successfully.
 */
export async function processCallbackReply(
  candidateId: string,
  body: string,
): Promise<boolean> {
  const db = getDatabase();

  // Get pending callback request
  const request = db
    .prepare(
      `
    SELECT * FROM pending_callback_requests
    WHERE candidate_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `,
    )
    .get(candidateId) as
    | {
        id: string;
        candidate_id: string;
        project_id: string;
        slots_json: string;
        created_at: string;
      }
    | undefined;

  if (!request) {
    console.log(
      `[CallbackScheduler] No pending callback request for ${candidateId}`,
    );
    return false;
  }

  const slots = JSON.parse(request.slots_json) as Array<{
    option: number;
    time: string;
    formatted: string;
  }>;

  // Parse reply - look for 1, 2, or 3
  const normalized = body.trim();
  const optionMatch = normalized.match(/^[1-3]$/);

  if (!optionMatch) {
    // Check if they typed out a day/time from the options
    const matchedSlot = slots.find((s) =>
      normalized.toLowerCase().includes(s.formatted.toLowerCase()),
    );
    if (!matchedSlot) {
      console.log(
        `[CallbackScheduler] Could not parse callback reply: "${body}"`,
      );
      return false;
    }
    // Found a match by formatted string
    await confirmCallback(candidateId, request.project_id, matchedSlot.time);
    return true;
  }

  const optionNum = parseInt(optionMatch[0], 10);
  const selectedSlot = slots.find((s) => s.option === optionNum);

  if (!selectedSlot) {
    console.log(`[CallbackScheduler] Invalid option number: ${optionNum}`);
    return false;
  }

  await confirmCallback(candidateId, request.project_id, selectedSlot.time);
  return true;
}

/**
 * Confirm a callback and notify via workflow event.
 */
async function confirmCallback(
  candidateId: string,
  projectId: string,
  slotTime: string,
): Promise<void> {
  // Schedule the callback
  await scheduleCallback(candidateId, projectId, new Date(slotTime));

  // Delete pending request
  const db = getDatabase();
  db.prepare(
    "DELETE FROM pending_callback_requests WHERE candidate_id = ?",
  ).run(candidateId);

  // Send CALLBACK_CONFIRMED event to workflow
  sendWorkflowEvent(candidateId, {
    type: "CALLBACK_CONFIRMED" as const,
  } as any);

  console.log(
    `[CallbackScheduler] Confirmed callback for ${candidateId} at ${slotTime}`,
  );
}

/**
 * Get pending callback slots for a candidate.
 */
export function getPendingCallbackSlots(
  candidateId: string,
): CallbackSlot | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `
    SELECT * FROM callback_slots
    WHERE candidate_id = ? AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1
  `,
    )
    .get(candidateId) as
    | {
        id: string;
        candidate_id: string;
        project_id: string;
        scheduled_at: string;
        status: string;
        recruiter_notes: string | null;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    candidateId: row.candidate_id,
    projectId: row.project_id,
    scheduledAt: row.scheduled_at,
    status: row.status as CallbackSlot["status"],
    recruiterNotes: row.recruiter_notes || undefined,
  };
}
