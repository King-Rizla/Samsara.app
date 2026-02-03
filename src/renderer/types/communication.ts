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

// ============================================================================
// Message Types (Plan 09-03)
// ============================================================================

export interface Message {
  id: string;
  projectId: string;
  cvId: string | null;
  type: "sms" | "email";
  direction: "outbound" | "inbound";
  status: "queued" | "sent" | "delivered" | "failed" | "received";
  fromAddress: string | null;
  toAddress: string;
  subject: string | null;
  body: string;
  templateId: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface DNCEntry {
  id: string;
  type: "phone" | "email";
  value: string;
  reason: "opt_out" | "bounce" | "manual";
  createdAt: string;
}

export interface OutreachCandidate {
  cvId: string;
  name: string;
  email?: string;
  phone?: string;
  lastMessageAt?: string;
  messageCount: number;
  status: "pending" | "contacted" | "responded" | "opted_out";
}

/**
 * Convert database message record to frontend model.
 */
export function messageRecordToModel(record: {
  id: string;
  project_id: string;
  cv_id: string | null;
  type: string;
  direction: string;
  status: string;
  from_address: string | null;
  to_address: string;
  subject: string | null;
  body: string;
  template_id: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}): Message {
  return {
    id: record.id,
    projectId: record.project_id,
    cvId: record.cv_id,
    type: record.type as "sms" | "email",
    direction: record.direction as "outbound" | "inbound",
    status: record.status as Message["status"],
    fromAddress: record.from_address,
    toAddress: record.to_address,
    subject: record.subject,
    body: record.body,
    templateId: record.template_id,
    providerMessageId: record.provider_message_id,
    errorMessage: record.error_message,
    sentAt: record.sent_at,
    deliveredAt: record.delivered_at,
    createdAt: record.created_at,
  };
}
