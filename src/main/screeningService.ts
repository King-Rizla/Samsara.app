/**
 * Screening Service - Phase 11 AI Voice Screening
 *
 * Manages screening criteria, system prompts, and scripts for voice screening calls.
 * Provides default screening prompt with 5 fixed questions (VOX-02) and positive close (VOX-04).
 *
 * Key exports:
 * - getDefaultSystemPrompt(): Returns the default screening system prompt
 * - getScreeningCriteria(projectId): Retrieves criteria for a project
 * - saveScreeningCriteria(projectId, criteria): Saves screening criteria
 * - getScreeningScript(projectId): Returns full script (criteria + system prompt)
 * - saveScreeningScript(projectId, script): Saves script with optional overrides
 */

import { getDatabase } from "./database";
import crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

export interface ScreeningCriteria {
  salaryMin?: number;
  salaryMax?: number;
  locations?: string[]; // Allowed locations
  noticePeriod?: string; // e.g., "2 weeks", "immediate", "1 month"
  requiredAvailability?: string; // e.g., "full-time", "contract", "part-time"
  workAuthorization?: string; // e.g., "US Citizen", "Any", "Visa Sponsorship"
  customQuestions?: string[]; // Additional screening questions
}

export interface ScreeningScript {
  projectId: string;
  agentName: string;
  systemPrompt: string;
  firstMessage?: string;
  criteria: ScreeningCriteria;
  createdAt: string;
  updatedAt: string;
}

// Database row shape
interface ScreeningScriptRow {
  id: string;
  project_id: string;
  agent_name: string;
  system_prompt_override: string | null;
  first_message_override: string | null;
  criteria_json: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Default System Prompt (VOX-02 and VOX-04)
// ============================================================================

/**
 * Default screening system prompt for ElevenLabs Conversational AI agent.
 *
 * VOX-02: Includes all 5 fixed screening questions
 * VOX-04: Includes positive close message about recruiter follow-up
 *
 * Dynamic variables available from voiceService:
 * - {{candidate_name}}: Full name of the candidate
 * - {{candidate_first_name}}: First name of the candidate
 * - {{role_title}}: Job title being screened for
 * - {{company_name}}: Company name (or "our client")
 * - {{salary_min}}, {{salary_max}}: Salary range (if provided)
 * - {{job_location}}: Job location (if provided)
 */
export const DEFAULT_SCREENING_SYSTEM_PROMPT = `You are Alex, a friendly and professional AI recruiting assistant. You are conducting a brief pre-screening call with {{candidate_first_name}} for the {{role_title}} position at {{company_name}}.

Your goal is to gather basic logistical information to help the recruiting team prepare for a more detailed conversation. Be warm, conversational, and respectful of the candidate's time.

## Call Flow

1. **Introduction**: Greet the candidate warmly and explain you're calling for a quick pre-screening about the {{role_title}} role.

2. **Questions (Ask all 5)**:
   - "What is your current salary or salary expectation for this role?"
   - "Are you open to working in {{job_location}} or do you have location preferences?"
   - "What is your notice period with your current employer?"
   - "What is your availability for interviews this week or next?"
   - "Are you authorized to work in this location, or would you need visa sponsorship?"

3. **Closing**: Thank them for their time and let them know the next steps.

## Important Guidelines

- Keep the call brief (2-3 minutes maximum)
- Be conversational, not robotic
- If the candidate asks about salary range, you can mention: "The range for this role is around {{salary_min}} to {{salary_max}}"
- If the candidate has questions you can't answer, say: "That's a great question - our recruiter will be able to give you more details"
- If the candidate seems hesitant or busy, offer to reschedule

## Closing Message (VOX-04)

End every call with a positive close:
"Thank you so much for your time today, {{candidate_first_name}}. I've noted all your responses. One of our recruiters will be in touch shortly to discuss the role in more detail. Have a great day!"

## Tone

- Professional but warm
- Efficient but not rushed
- Empathetic and respectful`;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get the default screening system prompt.
 * Used when no project-specific override exists.
 */
export function getDefaultSystemPrompt(): string {
  return DEFAULT_SCREENING_SYSTEM_PROMPT;
}

/**
 * Get screening criteria for a project.
 * Returns empty criteria object if none configured.
 */
export function getScreeningCriteria(projectId: string): ScreeningCriteria {
  const db = getDatabase();

  const row = db
    .prepare(
      `
      SELECT criteria_json FROM screening_scripts
      WHERE project_id = ?
    `,
    )
    .get(projectId) as { criteria_json: string | null } | undefined;

  if (!row || !row.criteria_json) {
    return {};
  }

  try {
    return JSON.parse(row.criteria_json) as ScreeningCriteria;
  } catch (error) {
    console.error("[ScreeningService] Failed to parse criteria JSON:", error);
    return {};
  }
}

/**
 * Save screening criteria for a project.
 * Creates or updates the screening_scripts record.
 *
 * @returns The script ID
 */
export function saveScreeningCriteria(
  projectId: string,
  criteria: ScreeningCriteria,
): string {
  const db = getDatabase();
  const now = new Date().toISOString();
  const criteriaJson = JSON.stringify(criteria);

  // Check if record exists
  const existing = db
    .prepare(`SELECT id FROM screening_scripts WHERE project_id = ?`)
    .get(projectId) as { id: string } | undefined;

  if (existing) {
    // Update existing
    db.prepare(
      `
      UPDATE screening_scripts
      SET criteria_json = ?, updated_at = ?
      WHERE project_id = ?
    `,
    ).run(criteriaJson, now, projectId);

    console.log(
      `[ScreeningService] Updated screening criteria for project ${projectId}`,
    );
    return existing.id;
  }

  // Insert new
  const id = crypto.randomUUID();
  db.prepare(
    `
    INSERT INTO screening_scripts
      (id, project_id, agent_name, criteria_json, created_at, updated_at)
    VALUES (?, ?, 'Alex', ?, ?, ?)
  `,
  ).run(id, projectId, criteriaJson, now, now);

  console.log(
    `[ScreeningService] Created screening criteria for project ${projectId}`,
  );
  return id;
}

/**
 * Get the full screening script for a project.
 * Includes system prompt (default or override) and criteria.
 *
 * If no script is configured, returns default values.
 */
export function getScreeningScript(projectId: string): ScreeningScript {
  const db = getDatabase();

  const row = db
    .prepare(
      `
      SELECT * FROM screening_scripts
      WHERE project_id = ?
    `,
    )
    .get(projectId) as ScreeningScriptRow | undefined;

  const now = new Date().toISOString();

  if (!row) {
    // Return defaults
    return {
      projectId,
      agentName: "Alex",
      systemPrompt: DEFAULT_SCREENING_SYSTEM_PROMPT,
      criteria: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  // Parse criteria
  let criteria: ScreeningCriteria = {};
  if (row.criteria_json) {
    try {
      criteria = JSON.parse(row.criteria_json);
    } catch (error) {
      console.error("[ScreeningService] Failed to parse criteria:", error);
    }
  }

  return {
    projectId: row.project_id,
    agentName: row.agent_name,
    systemPrompt: row.system_prompt_override || DEFAULT_SCREENING_SYSTEM_PROMPT,
    firstMessage: row.first_message_override || undefined,
    criteria,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Save a full screening script for a project.
 * Allows overriding system prompt, first message, and criteria.
 *
 * @returns The script ID
 */
export function saveScreeningScript(
  projectId: string,
  script: {
    agentName?: string;
    systemPromptOverride?: string | null;
    firstMessageOverride?: string | null;
    criteria?: ScreeningCriteria;
  },
): string {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Check if record exists
  const existing = db
    .prepare(
      `SELECT id, agent_name, system_prompt_override, first_message_override, criteria_json
       FROM screening_scripts WHERE project_id = ?`,
    )
    .get(projectId) as ScreeningScriptRow | undefined;

  if (existing) {
    // Update existing
    const agentName = script.agentName ?? existing.agent_name;
    const systemPromptOverride =
      script.systemPromptOverride !== undefined
        ? script.systemPromptOverride
        : existing.system_prompt_override;
    const firstMessageOverride =
      script.firstMessageOverride !== undefined
        ? script.firstMessageOverride
        : existing.first_message_override;
    const criteriaJson = script.criteria
      ? JSON.stringify(script.criteria)
      : existing.criteria_json;

    db.prepare(
      `
      UPDATE screening_scripts
      SET agent_name = ?, system_prompt_override = ?, first_message_override = ?,
          criteria_json = ?, updated_at = ?
      WHERE project_id = ?
    `,
    ).run(
      agentName,
      systemPromptOverride,
      firstMessageOverride,
      criteriaJson,
      now,
      projectId,
    );

    console.log(
      `[ScreeningService] Updated screening script for project ${projectId}`,
    );
    return existing.id;
  }

  // Insert new
  const id = crypto.randomUUID();
  db.prepare(
    `
    INSERT INTO screening_scripts
      (id, project_id, agent_name, system_prompt_override, first_message_override,
       criteria_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    projectId,
    script.agentName || "Alex",
    script.systemPromptOverride || null,
    script.firstMessageOverride || null,
    script.criteria ? JSON.stringify(script.criteria) : null,
    now,
    now,
  );

  console.log(
    `[ScreeningService] Created screening script for project ${projectId}`,
  );
  return id;
}

/**
 * Delete screening script for a project.
 * Returns true if deleted, false if not found.
 */
export function deleteScreeningScript(projectId: string): boolean {
  const db = getDatabase();

  const result = db
    .prepare(`DELETE FROM screening_scripts WHERE project_id = ?`)
    .run(projectId);

  return result.changes > 0;
}
