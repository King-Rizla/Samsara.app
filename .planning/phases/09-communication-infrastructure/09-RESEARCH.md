# Phase 9: Communication Infrastructure - Research

**Researched:** 2026-02-03
**Domain:** SMS/email sending (Twilio, Nodemailer), credential encryption (safeStorage), template engines, delivery tracking, opt-out compliance
**Confidence:** HIGH

## Summary

Phase 9 establishes the communication infrastructure for candidate outreach: configuring SMS (Twilio) and email (SMTP via Nodemailer) providers, creating message templates with variable substitution, sending messages, tracking delivery status, and maintaining a DNC (Do Not Call/Contact) opt-out registry.

This phase builds on the existing architecture patterns established in Phases 4.6 (queue management, push-based IPC), 5 (Python sidecar coordination), and 8 (Samsara Wheel with Outreach section placeholder). The key insight is that **credential storage requires Electron's safeStorage API** in the main process for OS-level encryption, while message sending happens from the main process using standard npm packages (twilio, nodemailer) -- **not Python**.

**Primary recommendation:** Use Electron safeStorage for credential encryption (main process), Twilio npm SDK for SMS, Nodemailer for email, and a simple Mustache-style template engine (or built-in ES6 template literals with a thin wrapper). Delivery status tracking uses **polling** (not webhooks, per CONTEXT.md decision) at 1-minute intervals. DNC registry is a global SQLite table checked upstream in Candidate Search.

## Standard Stack

### Core

| Library             | Version           | Purpose                    | Why Standard                                                                             |
| ------------------- | ----------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `twilio`            | 5.x               | SMS sending via Twilio API | Official Twilio Node.js SDK; TypeScript types included; handles auth, rate limiting      |
| `nodemailer`        | 6.x               | SMTP email sending         | Zero-dependency industry standard; supports OAuth2, TLS; 20M+ weekly downloads           |
| `safeStorage`       | Electron built-in | Credential encryption      | OS-backed keychain (macOS), DPAPI (Windows), libsecret (Linux); no external dependencies |
| `@types/nodemailer` | 6.x               | TypeScript definitions     | DefinitelyTyped; matches nodemailer 6.x                                                  |

### Supporting

| Library               | Version  | Purpose                        | When to Use                                                                              |
| --------------------- | -------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Handlebars            | 4.x      | Template variable substitution | If complex template logic needed (conditionals, loops). Consider simpler approach first. |
| ES6 Template Literals | Built-in | Simple variable substitution   | For basic `{{name}}` style replacement; zero-dependency option                           |

### Alternatives Considered

| Instead of  | Could Use                      | Tradeoff                                                                              |
| ----------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| safeStorage | node-keytar                    | Native module; harder to build cross-platform; safeStorage is built into Electron     |
| safeStorage | electron-store with encryption | Requires key management; safeStorage delegates to OS                                  |
| Twilio SDK  | Direct REST API                | More boilerplate; SDK handles retries, rate limits, TypeScript types                  |
| Nodemailer  | SendGrid SDK                   | Vendor lock-in; Nodemailer is protocol-agnostic (SMTP)                                |
| Handlebars  | Mustache.js                    | Handlebars is superset with helpers; Mustache simpler but less powerful               |
| Polling     | Webhooks                       | Webhooks require public endpoint; polling is simpler for desktop app (per CONTEXT.md) |

**Installation:**

```bash
npm install twilio nodemailer @types/nodemailer
# No additional install for safeStorage - it's built into Electron
```

## Architecture Patterns

### Recommended Project Structure

```
src/main/
├── credentialManager.ts     # NEW: safeStorage encrypt/decrypt, credential CRUD
├── communicationService.ts  # NEW: SMS/email sending, delivery status polling
├── templateEngine.ts        # NEW: Variable substitution logic
├── database.ts              # MODIFY: Add credential storage tables, DNC registry
├── ipcHandlers.ts           # MODIFY: Add communication IPC handlers (or index.ts)
└── preload.ts               # MODIFY: Expose communication APIs

src/renderer/
├── components/
│   ├── settings/
│   │   └── CommunicationSettings.tsx  # NEW: Credential config UI (tab in project settings)
│   ├── templates/
│   │   ├── TemplateEditor.tsx         # NEW: Side-by-side edit + preview
│   │   ├── TemplateList.tsx           # NEW: Template library
│   │   └── VariableDropdown.tsx       # NEW: Insert variable button
│   └── outreach/
│       ├── OutreachSection.tsx        # NEW: Replace placeholder in wheel
│       ├── CandidateTimeline.tsx      # NEW: Message event timeline
│       └── StatusWheel.tsx            # NEW: Progress indicator per candidate
├── stores/
│   └── communicationStore.ts          # NEW: Templates, credentials status, DNC state
└── types/
    └── communication.ts               # NEW: Message, Template, Credential types
```

### Pattern 1: Credential Encryption with safeStorage

**What:** Encrypt API credentials using OS-native keychain/credential store
**When to use:** Always for storing Twilio auth tokens, SMTP passwords
**Why:** OS handles key management; survives app reinstalls; protected from other apps

```typescript
// src/main/credentialManager.ts
import { safeStorage } from "electron";
import { getDatabase } from "./database";

export interface StoredCredential {
  id: string;
  projectId: string | null; // null = global
  provider: "twilio" | "smtp";
  credentialType: string; // 'api_key', 'auth_token', 'smtp_password'
  label?: string;
}

/**
 * Encrypt and store a credential.
 * safeStorage.encryptString returns a Buffer that can only be decrypted
 * by the same user on the same machine.
 */
export function storeCredential(
  projectId: string | null,
  provider: "twilio" | "smtp",
  credentialType: string,
  plainValue: string,
  label?: string,
): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Encryption not available on this system");
  }

  const encrypted = safeStorage.encryptString(plainValue);
  const encryptedBase64 = encrypted.toString("base64");

  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

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
    encryptedBase64,
    label,
    now,
    now,
  );

  return id;
}

/**
 * Retrieve and decrypt a credential.
 */
export function getCredential(
  projectId: string | null,
  provider: "twilio" | "smtp",
  credentialType: string,
): string | null {
  const db = getDatabase();

  // Try project-specific first, then global
  let row = db
    .prepare(
      `
    SELECT encrypted_value FROM provider_credentials
    WHERE project_id = ? AND provider = ? AND credential_type = ?
  `,
    )
    .get(projectId, provider, credentialType) as
    | { encrypted_value: string }
    | undefined;

  if (!row && projectId) {
    // Fall back to global
    row = db
      .prepare(
        `
      SELECT encrypted_value FROM provider_credentials
      WHERE project_id IS NULL AND provider = ? AND credential_type = ?
    `,
      )
      .get(provider, credentialType) as { encrypted_value: string } | undefined;
  }

  if (!row) return null;

  const encrypted = Buffer.from(row.encrypted_value, "base64");
  return safeStorage.decryptString(encrypted);
}
```

### Pattern 2: Twilio SMS Sending

**What:** Send SMS via Twilio Programmable Messaging API
**When to use:** For SMS outreach to candidates

```typescript
// src/main/communicationService.ts
import Twilio from "twilio";
import { getCredential } from "./credentialManager";
import { getDatabase } from "./database";

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
  error?: string;
}> {
  const accountSid = getCredential(params.projectId, "twilio", "account_sid");
  const authToken = getCredential(params.projectId, "twilio", "auth_token");
  const fromNumber = getCredential(params.projectId, "twilio", "phone_number");

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  const client = new Twilio(accountSid, authToken);

  try {
    const message = await client.messages.create({
      body: params.body,
      from: fromNumber,
      to: params.toPhone,
      // Note: No statusCallback - we poll instead (per CONTEXT.md)
    });

    // Log message to database for cost tracking and status polling
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO messages
      (id, project_id, cv_id, type, direction, status, from_address, to_address, body, template_id, provider_message_id, created_at)
      VALUES (?, ?, ?, 'sms', 'outbound', 'sent', ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      id,
      params.projectId,
      params.cvId,
      fromNumber,
      params.toPhone,
      params.body,
      params.templateId,
      message.sid,
      now,
    );

    return { success: true, messageId: message.sid };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}
```

### Pattern 3: Nodemailer SMTP Email Sending

**What:** Send email via SMTP using Nodemailer
**When to use:** For email outreach to candidates

```typescript
// src/main/communicationService.ts (continued)
import nodemailer from "nodemailer";

interface SendEmailParams {
  projectId: string;
  cvId: string;
  toEmail: string;
  subject: string;
  body: string; // HTML or plain text
  templateId?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const smtpHost = getCredential(params.projectId, "smtp", "host");
  const smtpPort = getCredential(params.projectId, "smtp", "port");
  const smtpUser = getCredential(params.projectId, "smtp", "user");
  const smtpPassword = getCredential(params.projectId, "smtp", "password");
  const fromEmail = getCredential(params.projectId, "smtp", "from_email");

  if (!smtpHost || !smtpUser || !smtpPassword) {
    return { success: false, error: "SMTP credentials not configured" };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort || "587", 10),
    secure: smtpPort === "465", // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  try {
    const result = await transporter.sendMail({
      from: fromEmail || smtpUser,
      to: params.toEmail,
      subject: params.subject,
      html: params.body,
      text: params.body.replace(/<[^>]*>/g, ""), // Plain text fallback
    });

    // Log to database
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
      fromEmail,
      params.toEmail,
      params.subject,
      params.body,
      params.templateId,
      result.messageId,
      now,
      now,
    );

    return { success: true, messageId: result.messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}
```

### Pattern 4: Template Variable Substitution

**What:** Replace `{{variable}}` placeholders with candidate/job data
**When to use:** Rendering templates before sending

```typescript
// src/main/templateEngine.ts

export interface TemplateVariables {
  candidate_name: string;
  candidate_first_name: string;
  candidate_email?: string;
  candidate_phone?: string;
  role_title: string;
  company_name: string;
  recruiter_name?: string;
  recruiter_phone?: string;
  recruiter_email?: string;
}

/**
 * Available variables for template authoring.
 * Used by UI to show variable dropdown.
 */
export const AVAILABLE_VARIABLES: {
  key: keyof TemplateVariables;
  label: string;
  example: string;
}[] = [
  { key: "candidate_name", label: "Candidate Name", example: "John Smith" },
  {
    key: "candidate_first_name",
    label: "Candidate First Name",
    example: "John",
  },
  {
    key: "role_title",
    label: "Role Title",
    example: "Senior Software Engineer",
  },
  { key: "company_name", label: "Company Name", example: "TechCorp Ltd" },
  { key: "recruiter_name", label: "Recruiter Name", example: "Jane Doe" },
  {
    key: "recruiter_phone",
    label: "Recruiter Phone",
    example: "+1 555 123 4567",
  },
  {
    key: "recruiter_email",
    label: "Recruiter Email",
    example: "jane@recruit.com",
  },
];

/**
 * Render a template by replacing {{variable}} with values.
 * Returns the rendered string.
 */
export function renderTemplate(
  template: string,
  variables: Partial<TemplateVariables>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key as keyof TemplateVariables];
    return value !== undefined ? String(value) : match; // Keep placeholder if not found
  });
}

/**
 * Preview a template with example data.
 */
export function previewTemplate(template: string): string {
  const exampleData: TemplateVariables = {
    candidate_name: "John Smith",
    candidate_first_name: "John",
    candidate_email: "john.smith@email.com",
    candidate_phone: "+1 555 987 6543",
    role_title: "Senior Software Engineer",
    company_name: "TechCorp Ltd",
    recruiter_name: "Jane Doe",
    recruiter_phone: "+1 555 123 4567",
    recruiter_email: "jane@recruit.com",
  };
  return renderTemplate(template, exampleData);
}
```

### Pattern 5: Delivery Status Polling

**What:** Poll Twilio API for message delivery status updates
**When to use:** Background task running every minute (per CONTEXT.md)

```typescript
// src/main/communicationService.ts (continued)
import Twilio from "twilio";

/**
 * Poll Twilio for updated message statuses.
 * Called every 60 seconds from main process.
 */
export async function pollDeliveryStatus(projectId: string): Promise<void> {
  const accountSid = getCredential(projectId, "twilio", "account_sid");
  const authToken = getCredential(projectId, "twilio", "auth_token");

  if (!accountSid || !authToken) return;

  const client = new Twilio(accountSid, authToken);
  const db = getDatabase();

  // Get messages with non-terminal status
  const pendingMessages = db
    .prepare(
      `
    SELECT id, provider_message_id FROM messages
    WHERE project_id = ? AND type = 'sms' AND status IN ('sent', 'queued')
  `,
    )
    .all(projectId) as { id: string; provider_message_id: string }[];

  for (const msg of pendingMessages) {
    try {
      const twilioMsg = await client.messages(msg.provider_message_id).fetch();

      let newStatus: string;
      switch (twilioMsg.status) {
        case "delivered":
          newStatus = "delivered";
          break;
        case "failed":
        case "undelivered":
          newStatus = "failed";
          break;
        default:
          continue; // Still in progress, skip update
      }

      const now = new Date().toISOString();
      db.prepare(
        `
        UPDATE messages SET status = ?, delivered_at = ?, updated_at = ? WHERE id = ?
      `,
      ).run(newStatus, newStatus === "delivered" ? now : null, now, msg.id);
    } catch (error) {
      console.error(`Failed to poll status for message ${msg.id}:`, error);
    }
  }
}

// Start polling interval (call from main process initialization)
let pollingInterval: NodeJS.Timeout | null = null;

export function startDeliveryPolling(projectId: string): void {
  if (pollingInterval) clearInterval(pollingInterval);

  pollingInterval = setInterval(() => {
    pollDeliveryStatus(projectId);
  }, 60000); // Every minute per CONTEXT.md
}

export function stopDeliveryPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
```

### Pattern 6: DNC (Do Not Contact) Registry

**What:** Global registry of phone numbers/emails that must not be contacted
**When to use:** Check before sending any message; flag CVs in Candidate Search

```typescript
// src/main/database.ts additions

// Database schema (add to migration)
/*
CREATE TABLE IF NOT EXISTS dnc_registry (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'phone' | 'email'
  value TEXT NOT NULL UNIQUE,   -- Normalized phone/email
  reason TEXT,                  -- 'opt_out' | 'bounce' | 'manual'
  source_message_id TEXT,       -- If from a STOP reply
  created_at TEXT NOT NULL
);

CREATE INDEX idx_dnc_type_value ON dnc_registry(type, value);
*/

export function addToDNC(
  type: "phone" | "email",
  value: string,
  reason: "opt_out" | "bounce" | "manual",
  sourceMessageId?: string,
): void {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const normalized = normalizeContactValue(type, value);

  db.prepare(
    `
    INSERT OR IGNORE INTO dnc_registry (id, type, value, reason, source_message_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  ).run(id, type, normalized, reason, sourceMessageId, now);
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
  return result.changes > 0;
}

function normalizeContactValue(type: "phone" | "email", value: string): string {
  if (type === "phone") {
    // Strip non-digits, ensure E.164 format
    return value.replace(/[^\d+]/g, "");
  }
  return value.toLowerCase().trim();
}
```

### Anti-Patterns to Avoid

- **Storing credentials in plain text:** Always use safeStorage; never JSON files or unencrypted SQLite
- **Webhooks for delivery status:** Desktop app can't receive webhooks; use polling per CONTEXT.md
- **Blocking main thread for message sending:** Use async/await; don't block IPC
- **Re-implementing template syntax:** Use established `{{variable}}` pattern or Handlebars; don't invent syntax
- **Ignoring DNC in message flow:** Always check DNC before sending; never skip the check
- **Automatic STOP registration:** Per CONTEXT.md, recruiter reviews and decides; don't auto-add to DNC

## Don't Hand-Roll

| Problem                 | Don't Build            | Use Instead                          | Why                                                  |
| ----------------------- | ---------------------- | ------------------------------------ | ---------------------------------------------------- |
| SMS sending             | Raw HTTP to Twilio API | `twilio` npm package                 | Handles auth, retries, rate limits, TypeScript types |
| Email sending           | Raw SMTP socket        | `nodemailer` package                 | Handles TLS, auth, encoding, attachments             |
| Credential encryption   | Custom AES encryption  | `safeStorage` API                    | OS-backed keychain; key management delegated         |
| Template rendering      | Custom regex parser    | Handlebars or simple `{{}}` replacer | Edge cases with escaping, nested paths               |
| Phone number formatting | String manipulation    | E.164 standard (Twilio expects it)   | International format handling                        |

## Common Pitfalls

### Pitfall 1: safeStorage Unavailable on Linux

**What goes wrong:** `safeStorage.isEncryptionAvailable()` returns false; credentials stored unencrypted
**Why it happens:** Linux requires libsecret and a secret service (gnome-keyring, KWallet)
**How to avoid:** Check `isEncryptionAvailable()` and warn user if false; document Linux requirements
**Warning signs:** Credentials work on macOS/Windows but fail on Linux

### Pitfall 2: Twilio Rate Limiting

**What goes wrong:** Messages fail with 429 Too Many Requests
**Why it happens:** Sending too many messages per second (Twilio limits vary by number type)
**How to avoid:** Implement queue with delay between sends (e.g., 1 second per message)
**Warning signs:** Burst sends failing; error code 21610

### Pitfall 3: SMTP Connection Pooling

**What goes wrong:** Email sending is slow; "ECONNRESET" errors
**Why it happens:** Creating new SMTP connection for each email
**How to avoid:** Use Nodemailer's `pool: true` option; reuse transporter instance
**Warning signs:** First email fast, subsequent slow; connection errors on batch sends

### Pitfall 4: Template Variables Not Replaced

**What goes wrong:** User sees `{{candidate_name}}` in sent message
**Why it happens:** Variable key mismatch; case sensitivity; typo in template
**How to avoid:** Validate templates before saving; show preview with real/example data
**Warning signs:** Preview shows placeholders; complaints from candidates

### Pitfall 5: DNC Check Happens Too Late

**What goes wrong:** Message sent to opted-out contact
**Why it happens:** DNC check in send function but UI already showed candidate as contactable
**How to avoid:** Check DNC upstream in Candidate Search at CV parsing time (per CONTEXT.md)
**Warning signs:** Candidates receiving messages after opting out

### Pitfall 6: Polling Interval Grows Unbounded

**What goes wrong:** Multiple polling intervals running; duplicate status updates
**Why it happens:** Not clearing previous interval when starting new one
**How to avoid:** Store interval ID; clear before starting new; single polling instance
**Warning signs:** Status updates multiple times; high CPU usage

## Code Examples

### Credential Test Verification (IPC Handler)

```typescript
// src/main/index.ts or ipcHandlers.ts
ipcMain.handle("test-twilio-credentials", async (_event, projectId: string) => {
  const accountSid = getCredential(projectId, "twilio", "account_sid");
  const authToken = getCredential(projectId, "twilio", "auth_token");

  if (!accountSid || !authToken) {
    return { success: false, error: "Credentials not found" };
  }

  try {
    const client = new Twilio(accountSid, authToken);
    // Fetch account to verify credentials
    const account = await client.api.accounts(accountSid).fetch();
    return {
      success: true,
      data: {
        friendlyName: account.friendlyName,
        status: account.status,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
});

ipcMain.handle("test-smtp-credentials", async (_event, projectId: string) => {
  const smtpHost = getCredential(projectId, "smtp", "host");
  const smtpPort = getCredential(projectId, "smtp", "port");
  const smtpUser = getCredential(projectId, "smtp", "user");
  const smtpPassword = getCredential(projectId, "smtp", "password");

  if (!smtpHost || !smtpUser || !smtpPassword) {
    return { success: false, error: "Credentials not found" };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort || "587", 10),
    secure: smtpPort === "465",
    auth: { user: smtpUser, pass: smtpPassword },
  });

  try {
    await transporter.verify();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "SMTP verification failed",
    };
  }
});
```

### Template Editor Component Pattern

```typescript
// src/renderer/components/templates/TemplateEditor.tsx
import { useState, useMemo } from 'react';
import { AVAILABLE_VARIABLES } from '../../types/communication';

interface TemplateEditorProps {
  initialBody: string;
  type: 'sms' | 'email';
  onSave: (body: string) => void;
}

export function TemplateEditor({ initialBody, type, onSave }: TemplateEditorProps) {
  const [body, setBody] = useState(initialBody);

  // Live preview with example data
  const preview = useMemo(() => {
    return body.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const variable = AVAILABLE_VARIABLES.find(v => v.key === key);
      return variable ? variable.example : match;
    });
  }, [body]);

  const insertVariable = (key: string) => {
    // Insert at cursor position or append
    setBody(prev => prev + `{{${key}}}`);
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Editor side */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Template</label>
          <VariableDropdown onInsert={insertVariable} />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full h-64 p-2 border rounded font-mono text-sm"
          placeholder={type === 'sms' ? 'Enter SMS message...' : 'Enter email body...'}
        />
        {type === 'sms' && (
          <p className="text-xs text-muted-foreground">
            {body.length}/160 characters ({Math.ceil(body.length / 160)} SMS segments)
          </p>
        )}
      </div>

      {/* Preview side */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Preview</label>
        <div className="w-full h-64 p-2 border rounded bg-muted/50 overflow-auto">
          <p className="whitespace-pre-wrap text-sm">{preview}</p>
        </div>
      </div>
    </div>
  );
}
```

### Outreach Timeline Component Pattern

```typescript
// src/renderer/components/outreach/CandidateTimeline.tsx
interface TimelineEvent {
  id: string;
  type: 'sms' | 'email' | 'call';
  direction: 'outbound' | 'inbound';
  status: 'sent' | 'delivered' | 'failed' | 'received';
  timestamp: string;
  preview?: string;  // First 50 chars of message
}

interface CandidateTimelineProps {
  events: TimelineEvent[];
}

export function CandidateTimeline({ events }: CandidateTimelineProps) {
  const statusColors = {
    sent: 'text-blue-500',
    delivered: 'text-green-500',
    failed: 'text-red-500',
    received: 'text-purple-500',
  };

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-3">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full ${statusColors[event.status]} bg-current`} />
            {index < events.length - 1 && (
              <div className="w-0.5 h-full bg-border" />
            )}
          </div>

          {/* Event content */}
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {event.type.toUpperCase()} {event.direction === 'outbound' ? 'sent' : 'received'}
              </span>
              <span className={`text-xs ${statusColors[event.status]}`}>
                {event.status}
              </span>
            </div>
            <time className="text-xs text-muted-foreground">
              {new Date(event.timestamp).toLocaleString()}
            </time>
            {event.preview && (
              <p className="text-sm mt-1 truncate">{event.preview}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Database Schema Additions

```sql
-- Add to migration v6 (Phase 9)

-- DNC Registry (global)
CREATE TABLE IF NOT EXISTS dnc_registry (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'phone' | 'email'
  value TEXT NOT NULL,          -- Normalized phone/email
  reason TEXT NOT NULL,         -- 'opt_out' | 'bounce' | 'manual'
  source_message_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(type, value)
);

CREATE INDEX IF NOT EXISTS idx_dnc_type_value ON dnc_registry(type, value);

-- Global templates (template library)
-- project_id NULL = global template available for copy into projects
ALTER TABLE outreach_templates ADD COLUMN is_global INTEGER DEFAULT 0;

-- Cost tracking for messages (for future billing feature)
ALTER TABLE messages ADD COLUMN cost_cents INTEGER;
ALTER TABLE messages ADD COLUMN currency TEXT DEFAULT 'USD';
```

## State of the Art

| Old Approach                | Current Approach           | When Changed        | Impact                                     |
| --------------------------- | -------------------------- | ------------------- | ------------------------------------------ |
| node-keytar for credentials | Electron safeStorage       | Electron 15+ (2021) | No native module; built into Electron      |
| Webhooks for status         | Polling for desktop apps   | N/A                 | Desktop apps can't receive webhooks easily |
| SendGrid API                | SMTP via Nodemailer        | N/A                 | SMTP is vendor-agnostic; no lock-in        |
| Custom template syntax      | Mustache/Handlebars syntax | N/A                 | Widespread `{{variable}}` convention       |

**Deprecated/outdated:**

- `node-keytar`: Still works but requires native builds; safeStorage is built-in
- `twilio-node` < v4: Use v5.x for latest features and TypeScript support
- Direct REST API calls to Twilio: Use SDK for proper error handling

## Open Questions

1. **SMS character encoding and segments**
   - What we know: Standard SMS is 160 characters; Unicode reduces to 70
   - What's unclear: How to display segment count in real-time preview
   - Recommendation: Show character count and estimated segments in template editor; warn at >3 segments

2. **Email HTML vs plain text templates**
   - What we know: Nodemailer supports both; plain text is auto-generated
   - What's unclear: Whether to provide rich HTML editor or just textarea
   - Recommendation: Start with plain text only; HTML editor is Phase 10+ enhancement

3. **Twilio opt-out handling**
   - What we know: Twilio has Advanced Opt-Out that auto-handles STOP keywords
   - What's unclear: Per CONTEXT.md, recruiter reviews and decides -- how does Twilio's auto-handling fit?
   - Recommendation: Use Twilio's webhook notification for STOP messages; display to recruiter for manual DNC add decision

4. **Global vs per-project DNC**
   - What we know: CONTEXT.md says "Global DNC at company level"
   - What's unclear: Multi-user scenario for v1 (single-user)
   - Recommendation: Single global DNC table for v1; company_id column can be added later for multi-user

## Sources

### Primary (HIGH confidence)

- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage) - Official documentation for credential encryption
- [Twilio Node.js SDK Documentation](https://www.twilio.com/docs/messaging/quickstart) - SMS sending quickstart
- [Nodemailer Documentation](https://nodemailer.com/) - SMTP transport, connection pooling, verify()
- [Handlebars.js](https://handlebarsjs.com/) - Template syntax and expressions
- Project codebase: `src/main/settings.ts`, `src/main/database.ts`, `src/main/preload.ts`

### Secondary (MEDIUM confidence)

- [Twilio Delivery Status Tracking](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status) - Status polling patterns
- [Twilio Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out) - STOP keyword handling
- [TCPA Compliance Guide](https://activeprospect.com/blog/tcpa-text-messages/) - DNC and opt-out requirements
- [freek.dev - Replacing Keytar with safeStorage](https://freek.dev/2103-replacing-keytar-with-electrons-safestorage-in-ray) - Migration patterns

### Tertiary (LOW confidence)

- Various Medium articles on Nodemailer TypeScript setup - Confirmed with official docs

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Twilio SDK and Nodemailer are industry standards; safeStorage is official Electron API
- Architecture: HIGH - Follows established project patterns (IPC, SQLite, push-based updates)
- Pitfalls: MEDIUM - Based on documentation and common issues; some edge cases may emerge
- Compliance: MEDIUM - TCPA rules are evolving; DNC implementation follows CONTEXT.md decisions

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (stable libraries; compliance rules may change)
