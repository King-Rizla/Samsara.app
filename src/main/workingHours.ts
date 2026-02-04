/**
 * Working Hours Service - Phase 10 Plan 02
 *
 * Checks if current time is within project working hours.
 * Queues messages for delivery during business hours.
 */

import { getDatabase } from "./database";
import * as crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

export interface WorkingHoursConfig {
  enabled: boolean;
  startHour: number; // 0-23
  startMinute: number; // 0-59
  endHour: number;
  endMinute: number;
  timezone: string; // e.g., 'America/New_York'
  workDays: number[]; // 0=Sunday, 1=Monday, etc.
}

export interface ProjectOutreachSettings {
  project_id: string;
  escalation_timeout_ms: number;
  ai_call_enabled: number;
  working_hours_enabled: number;
  working_hours_start: string;
  working_hours_end: string;
  working_hours_timezone: string;
  working_hours_days: string;
  created_at: string;
  updated_at: string;
}

export interface QueueResult {
  send: boolean;
  scheduledFor?: Date;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: Omit<
  ProjectOutreachSettings,
  "project_id" | "created_at" | "updated_at"
> = {
  escalation_timeout_ms: 30 * 60 * 1000, // 30 minutes
  ai_call_enabled: 1,
  working_hours_enabled: 0, // Disabled by default
  working_hours_start: "09:00",
  working_hours_end: "17:00",
  working_hours_timezone: "America/New_York",
  working_hours_days: "[1,2,3,4,5]", // Mon-Fri
};

// ============================================================================
// Working Hours Check
// ============================================================================

/**
 * Check if the current time (or specified time) is within working hours.
 * If working hours are disabled, always returns true.
 */
export function isWithinWorkingHours(
  config: WorkingHoursConfig,
  checkTime?: Date,
): boolean {
  // If working hours disabled, always within hours
  if (!config.enabled) {
    return true;
  }

  const now = checkTime || new Date();

  // Get current time in the configured timezone
  // Using Intl.DateTimeFormat to handle timezone conversion
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(
    parts.find((p) => p.type === "minute")?.value || "0",
    10,
  );
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value || "Mon";

  // Convert weekday string to number (0=Sun, 1=Mon, etc.)
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdayMap[weekdayStr] ?? 1;

  // Check if day is a work day
  if (!config.workDays.includes(dayOfWeek)) {
    return false;
  }

  // Convert times to minutes since midnight for comparison
  const currentMinutes = hour * 60 + minute;
  const startMinutes = config.startHour * 60 + config.startMinute;
  const endMinutes = config.endHour * 60 + config.endMinute;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Get the next time when working hours start.
 * Used for scheduling delayed messages.
 */
export function getNextWorkingHoursStart(
  config: WorkingHoursConfig,
  fromTime?: Date,
): Date | null {
  if (!config.enabled) {
    // If disabled, return current time (no delay)
    return new Date();
  }

  const now = fromTime || new Date();
  const result = new Date(now);

  // Try up to 8 days ahead (ensures we cover a full week plus buffer)
  for (let daysAhead = 0; daysAhead < 8; daysAhead++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + daysAhead);

    // Get day of week in target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: config.timezone,
      weekday: "short",
    });
    const weekdayStr = formatter.format(checkDate);
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dayOfWeek = weekdayMap[weekdayStr] ?? 1;

    // Skip non-work days
    if (!config.workDays.includes(dayOfWeek)) {
      continue;
    }

    // Set to start of working hours on this day
    result.setDate(checkDate.getDate());
    result.setHours(config.startHour, config.startMinute, 0, 0);

    // If this is today, check if start time has already passed
    if (daysAhead === 0) {
      const hourFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: config.timezone,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const parts = hourFormatter.formatToParts(now);
      const currentHour = parseInt(
        parts.find((p) => p.type === "hour")?.value || "0",
        10,
      );
      const currentMinute = parseInt(
        parts.find((p) => p.type === "minute")?.value || "0",
        10,
      );

      const currentMinutes = currentHour * 60 + currentMinute;
      const startMinutes = config.startHour * 60 + config.startMinute;
      const endMinutes = config.endHour * 60 + config.endMinute;

      // If we're already past end time, continue to next day
      if (currentMinutes >= endMinutes) {
        continue;
      }

      // If we're past start time but before end, we're currently in working hours
      if (currentMinutes >= startMinutes) {
        return new Date(now);
      }
    }

    return result;
  }

  return null; // No working hours found in next 8 days (shouldn't happen)
}

/**
 * Queue a message for delivery during working hours.
 * Returns { send: true } if within hours, { send: false, scheduledFor: Date } if outside.
 */
export function queueMessageForWorkingHours(
  projectId: string,
  candidateId: string,
  messageType: "sms" | "email",
  payload: { toAddress: string; body: string; subject?: string },
): QueueResult {
  const settings = getProjectOutreachSettings(projectId);

  const config: WorkingHoursConfig = {
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

  if (isWithinWorkingHours(config)) {
    return { send: true };
  }

  // Calculate when working hours start next
  const scheduledFor = getNextWorkingHoursStart(config);
  if (!scheduledFor) {
    // Fallback: send anyway if we can't calculate
    console.warn(
      "[WorkingHours] Could not calculate next working hours, sending immediately",
    );
    return { send: true };
  }

  // Store in message queue table
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO message_queue (id, project_id, candidate_id, message_type, payload_json, scheduled_for, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `,
  ).run(
    id,
    projectId,
    candidateId,
    messageType,
    JSON.stringify(payload),
    scheduledFor.toISOString(),
    now,
  );

  console.log(
    `[WorkingHours] Queued ${messageType} for ${candidateId} scheduled for ${scheduledFor.toISOString()}`,
  );

  return { send: false, scheduledFor };
}

// ============================================================================
// Project Outreach Settings
// ============================================================================

/**
 * Get outreach settings for a project.
 * Returns default values if not configured.
 */
export function getProjectOutreachSettings(
  projectId: string,
): ProjectOutreachSettings {
  const db = getDatabase();

  const row = db
    .prepare("SELECT * FROM project_outreach_settings WHERE project_id = ?")
    .get(projectId) as ProjectOutreachSettings | undefined;

  if (row) {
    return row;
  }

  // Return defaults
  const now = new Date().toISOString();
  return {
    project_id: projectId,
    ...DEFAULT_SETTINGS,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Update outreach settings for a project.
 * Creates settings if they don't exist.
 */
export function updateProjectOutreachSettings(
  projectId: string,
  settings: Partial<
    Omit<ProjectOutreachSettings, "project_id" | "created_at" | "updated_at">
  >,
): ProjectOutreachSettings {
  const db = getDatabase();
  const now = new Date().toISOString();
  const existing = getProjectOutreachSettings(projectId);

  const merged = {
    ...existing,
    ...settings,
    updated_at: now,
  };

  db.prepare(
    `
    INSERT INTO project_outreach_settings (
      project_id, escalation_timeout_ms, ai_call_enabled,
      working_hours_enabled, working_hours_start, working_hours_end,
      working_hours_timezone, working_hours_days, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      escalation_timeout_ms = excluded.escalation_timeout_ms,
      ai_call_enabled = excluded.ai_call_enabled,
      working_hours_enabled = excluded.working_hours_enabled,
      working_hours_start = excluded.working_hours_start,
      working_hours_end = excluded.working_hours_end,
      working_hours_timezone = excluded.working_hours_timezone,
      working_hours_days = excluded.working_hours_days,
      updated_at = excluded.updated_at
  `,
  ).run(
    merged.project_id,
    merged.escalation_timeout_ms,
    merged.ai_call_enabled,
    merged.working_hours_enabled,
    merged.working_hours_start,
    merged.working_hours_end,
    merged.working_hours_timezone,
    merged.working_hours_days,
    merged.created_at,
    merged.updated_at,
  );

  console.log(
    `[WorkingHours] Updated outreach settings for project ${projectId}`,
  );
  return merged;
}
