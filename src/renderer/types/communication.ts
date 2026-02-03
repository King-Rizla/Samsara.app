// Communication types for Phase 9 - SMS and Email outreach

// ============================================================================
// Provider Credentials (Plan 09-01)
// ============================================================================

export type CommunicationProvider = "twilio" | "smtp";

export type CredentialStatus =
  | "unconfigured"
  | "configured"
  | "verified"
  | "failed";

/**
 * UI form state for Twilio credentials
 * Note: These are NOT stored directly - they're encrypted via safeStorage
 */
export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

/**
 * UI form state for SMTP credentials
 * Note: These are NOT stored directly - they're encrypted via safeStorage
 */
export interface SmtpCredentials {
  host: string;
  port: string;
  user: string;
  password: string;
  fromEmail: string;
}

/**
 * Result from testing provider credentials
 */
export interface TestResult {
  success: boolean;
  error?: string;
  data?: Record<string, string>;
}

/**
 * Twilio-specific test result with account info
 */
export interface TwilioTestResult extends TestResult {
  data?: {
    friendlyName: string;
    status: string;
  };
}

/**
 * Status for individual credential fields
 */
export interface CredentialFieldStatus {
  configured: boolean;
  error?: string;
}

// ============================================================================
// Message Templates (Plan 09-02)
// ============================================================================

export interface MessageTemplate {
  id: string;
  projectId: string;
  name: string;
  type: "sms" | "email";
  subject?: string; // For email only
  body: string;
  variablesJson?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  projectId: string;
  name: string;
  type: "sms" | "email";
  subject?: string;
  body: string;
}

export interface UpdateTemplateInput {
  name?: string;
  subject?: string;
  body?: string;
  isDefault?: boolean;
}

export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
  category: "candidate" | "role" | "recruiter";
}

// Database record shape (snake_case from SQLite)
export interface TemplateRecord {
  id: string;
  project_id: string;
  name: string;
  type: string;
  subject: string | null;
  body: string;
  variables_json: string | null;
  is_default: number;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database record to frontend model.
 */
export function templateRecordToModel(record: TemplateRecord): MessageTemplate {
  return {
    id: record.id,
    projectId: record.project_id,
    name: record.name,
    type: record.type as "sms" | "email",
    subject: record.subject || undefined,
    body: record.body,
    variablesJson: record.variables_json || undefined,
    isDefault: Boolean(record.is_default),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
