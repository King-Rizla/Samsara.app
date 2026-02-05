/**
 * Credential Manager - Phase 9 Communication Infrastructure
 *
 * Provides secure credential storage using Electron's safeStorage API
 * for encrypting sensitive provider credentials (Twilio, SMTP).
 *
 * Credentials are encrypted with OS-level encryption:
 * - Windows: DPAPI
 * - macOS: Keychain
 * - Linux: libsecret
 */

import { safeStorage } from "electron";
import { getDatabase } from "./database";
import * as crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

export type ProviderType = "twilio" | "smtp" | "elevenlabs" | "anthropic";

export type TwilioCredentialType =
  | "account_sid"
  | "auth_token"
  | "phone_number";

export type SmtpCredentialType =
  | "host"
  | "port"
  | "user"
  | "password"
  | "from_email";

export type ElevenLabsCredentialType =
  | "api_key"
  | "screening_agent_id"
  | "phone_number_id";

export type AnthropicCredentialType = "api_key";

export type CredentialType =
  | TwilioCredentialType
  | SmtpCredentialType
  | ElevenLabsCredentialType
  | AnthropicCredentialType;

export interface StoredCredential {
  id: string;
  projectId: string | null;
  provider: ProviderType;
  credentialType: CredentialType;
  label?: string;
  createdAt: string;
  updatedAt: string;
}

// Database row shape
interface CredentialRow {
  id: string;
  project_id: string | null;
  provider: string;
  credential_type: string;
  encrypted_value: string;
  label: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Encryption Availability
// ============================================================================

/**
 * Check if safeStorage encryption is available on this system.
 * Returns false on Linux without libsecret or if encryption fails.
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

// ============================================================================
// Credential Storage Functions
// ============================================================================

/**
 * Store a credential with safeStorage encryption.
 *
 * @param projectId - Project ID for project-specific credentials, null for global
 * @param provider - Provider type ('twilio' | 'smtp')
 * @param credentialType - Specific credential field
 * @param plainValue - The unencrypted credential value
 * @param label - Optional human-readable label
 * @returns The credential ID
 */
export function storeCredential(
  projectId: string | null,
  provider: ProviderType,
  credentialType: CredentialType,
  plainValue: string,
  label?: string,
): string {
  const db = getDatabase();

  // Encrypt the value using OS keychain
  const encryptedBuffer = safeStorage.encryptString(plainValue);
  const encryptedValue = encryptedBuffer.toString("base64");

  const now = new Date().toISOString();

  // Check if credential already exists (upsert logic)
  const existing = db
    .prepare(
      `
      SELECT id FROM provider_credentials
      WHERE (project_id = ? OR (project_id IS NULL AND ? IS NULL))
        AND provider = ?
        AND credential_type = ?
    `,
    )
    .get(projectId, projectId, provider, credentialType) as
    | { id: string }
    | undefined;

  if (existing) {
    // Update existing credential
    db.prepare(
      `
      UPDATE provider_credentials
      SET encrypted_value = ?, label = ?, updated_at = ?
      WHERE id = ?
    `,
    ).run(encryptedValue, label || null, now, existing.id);

    console.log(
      `[CredentialManager] Updated credential: ${provider}/${credentialType}`,
    );
    return existing.id;
  }

  // Insert new credential
  const id = crypto.randomUUID();
  db.prepare(
    `
    INSERT INTO provider_credentials
      (id, project_id, provider, credential_type, encrypted_value, label, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    projectId,
    provider,
    credentialType,
    encryptedValue,
    label || null,
    now,
    now,
  );

  console.log(
    `[CredentialManager] Stored new credential: ${provider}/${credentialType}`,
  );
  return id;
}

/**
 * Get a decrypted credential value.
 *
 * Falls back to global credentials (projectId = null) if project-specific not found.
 *
 * @param projectId - Project ID to check first, null for global only
 * @param provider - Provider type
 * @param credentialType - Specific credential field
 * @returns Decrypted value or null if not found
 */
export function getCredential(
  projectId: string | null,
  provider: ProviderType,
  credentialType: CredentialType,
): string | null {
  const db = getDatabase();

  // Try project-specific first if projectId provided
  let row: CredentialRow | undefined;

  if (projectId !== null) {
    row = db
      .prepare(
        `
        SELECT * FROM provider_credentials
        WHERE project_id = ? AND provider = ? AND credential_type = ?
      `,
      )
      .get(projectId, provider, credentialType) as CredentialRow | undefined;
  }

  // Fallback to global (null projectId)
  if (!row) {
    row = db
      .prepare(
        `
        SELECT * FROM provider_credentials
        WHERE project_id IS NULL AND provider = ? AND credential_type = ?
      `,
      )
      .get(provider, credentialType) as CredentialRow | undefined;
  }

  if (!row) {
    return null;
  }

  // Decrypt the value
  try {
    const encryptedBuffer = Buffer.from(row.encrypted_value, "base64");
    return safeStorage.decryptString(encryptedBuffer);
  } catch (error) {
    console.error(
      `[CredentialManager] Failed to decrypt ${provider}/${credentialType}:`,
      error,
    );
    return null;
  }
}

/**
 * Delete a credential.
 *
 * @param projectId - Project ID or null for global
 * @param provider - Provider type
 * @param credentialType - Specific credential field
 * @returns true if deleted, false if not found
 */
export function deleteCredential(
  projectId: string | null,
  provider: ProviderType,
  credentialType: CredentialType,
): boolean {
  const db = getDatabase();

  const result = db
    .prepare(
      `
      DELETE FROM provider_credentials
      WHERE (project_id = ? OR (project_id IS NULL AND ? IS NULL))
        AND provider = ?
        AND credential_type = ?
    `,
    )
    .run(projectId, projectId, provider, credentialType);

  const deleted = result.changes > 0;
  if (deleted) {
    console.log(
      `[CredentialManager] Deleted credential: ${provider}/${credentialType}`,
    );
  }
  return deleted;
}

/**
 * Check if a credential exists without decrypting it.
 *
 * Falls back to global credentials if project-specific not found.
 *
 * @param projectId - Project ID to check first, null for global only
 * @param provider - Provider type
 * @param credentialType - Specific credential field
 * @returns true if credential exists
 */
export function hasCredential(
  projectId: string | null,
  provider: ProviderType,
  credentialType: CredentialType,
): boolean {
  const db = getDatabase();

  // Check project-specific first
  if (projectId !== null) {
    const projectRow = db
      .prepare(
        `
        SELECT 1 FROM provider_credentials
        WHERE project_id = ? AND provider = ? AND credential_type = ?
      `,
      )
      .get(projectId, provider, credentialType);

    if (projectRow) return true;
  }

  // Check global
  const globalRow = db
    .prepare(
      `
      SELECT 1 FROM provider_credentials
      WHERE project_id IS NULL AND provider = ? AND credential_type = ?
    `,
    )
    .get(provider, credentialType);

  return !!globalRow;
}

/**
 * List all credentials for a project (without decrypted values).
 *
 * @param projectId - Project ID or null for global credentials only
 * @returns Array of credential metadata (no values)
 */
export function listCredentials(projectId: string | null): StoredCredential[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `
      SELECT id, project_id, provider, credential_type, label, created_at, updated_at
      FROM provider_credentials
      WHERE project_id = ? OR (project_id IS NULL AND ? IS NULL)
      ORDER BY provider, credential_type
    `,
    )
    .all(projectId, projectId) as Array<{
    id: string;
    project_id: string | null;
    provider: string;
    credential_type: string;
    label: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    provider: row.provider as ProviderType,
    credentialType: row.credential_type as CredentialType,
    label: row.label || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ============================================================================
// Provider Test Functions
// ============================================================================

/**
 * Test Twilio credentials by fetching account info.
 *
 * @param projectId - Project ID to get credentials for (falls back to global)
 * @returns Test result with account info or error
 */
export async function testTwilioCredentials(projectId: string | null): Promise<{
  success: boolean;
  error?: string;
  data?: { friendlyName: string; status: string };
}> {
  const accountSid = getCredential(projectId, "twilio", "account_sid");
  const authToken = getCredential(projectId, "twilio", "auth_token");

  if (!accountSid || !authToken) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  try {
    // Dynamic import to avoid loading twilio at module load time
    const Twilio = (await import("twilio")).default;
    const client = new Twilio(accountSid, authToken);
    const account = await client.api.accounts(accountSid).fetch();

    return {
      success: true,
      data: {
        friendlyName: account.friendlyName,
        status: account.status,
      },
    };
  } catch (error) {
    console.error("[CredentialManager] Twilio test failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Twilio verification failed",
    };
  }
}

/**
 * Test SMTP credentials by verifying connection.
 *
 * @param projectId - Project ID to get credentials for (falls back to global)
 * @returns Test result with success or error
 */
export async function testSmtpCredentials(projectId: string | null): Promise<{
  success: boolean;
  error?: string;
}> {
  const host = getCredential(projectId, "smtp", "host");
  const port = getCredential(projectId, "smtp", "port");
  const user = getCredential(projectId, "smtp", "user");
  const password = getCredential(projectId, "smtp", "password");

  if (!host || !user || !password) {
    return { success: false, error: "SMTP credentials not configured" };
  }

  try {
    // Dynamic import to avoid loading nodemailer at module load time
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port || "587", 10),
      secure: port === "465",
      auth: { user, pass: password },
    });

    await transporter.verify();
    return { success: true };
  } catch (error) {
    console.error("[CredentialManager] SMTP test failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "SMTP verification failed",
    };
  }
}
