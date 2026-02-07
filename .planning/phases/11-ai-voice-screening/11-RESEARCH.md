# Phase 11: AI Voice Screening - Research

**Researched:** 2026-02-05
**Domain:** ElevenLabs Conversational AI + Twilio SIP, outbound calls, screening scripts, transcript analysis, call outcome logging
**Confidence:** HIGH

## Summary

Phase 11 implements AI voice screening for candidates using ElevenLabs Conversational AI integrated with Twilio. The system initiates outbound calls when triggered by the workflow engine (Phase 10), conducts a 2-3 minute pre-screening conversation to gather logistics (salary, location, availability, interest, contact details), analyzes the transcript post-call to determine pass/maybe/fail, and logs outcomes to the candidate record.

The key insight is that **ElevenLabs provides a complete solution**: agent configuration via API/dashboard, Twilio integration for phone calls, post-call webhooks for transcripts and analysis, and dynamic variables for personalization. This means minimal custom orchestration is needed -- the main work is (1) initiating outbound calls via the ElevenLabs API, (2) receiving webhooks with transcripts, (3) analyzing results to determine screening outcome, and (4) updating the UI to display call records.

**Primary recommendation:** Use the ElevenLabs Conversational AI API for outbound calls via Twilio integration, configure the screening agent via the ElevenLabs dashboard/API with a carefully crafted system prompt, receive post-call webhooks for transcripts, and implement Claude-based post-call analysis for pass/maybe/fail determination.

## Standard Stack

### Core

| Library                | Version            | Purpose                       | Why Standard                                            |
| ---------------------- | ------------------ | ----------------------------- | ------------------------------------------------------- |
| `@elevenlabs/client`   | latest             | ElevenLabs TypeScript SDK     | Official SDK; handles auth, types, API calls            |
| `twilio`               | 5.x (installed)    | Phone number management       | Already in codebase from Phase 9                        |
| `@anthropic-ai/sdk`    | 0.37.x (installed) | Post-call transcript analysis | Already in codebase; Claude for pass/fail determination |
| `express` or `fastify` | 4.x / 5.x          | Webhook receiver (optional)   | Standard Node.js servers; may need for local dev        |

### Supporting

| Library                | Version | Purpose                        | When to Use                                      |
| ---------------------- | ------- | ------------------------------ | ------------------------------------------------ |
| `ngrok`                | CLI     | Webhook tunnel for dev         | Local development to receive ElevenLabs webhooks |
| `@elevenlabs/webhooks` | latest  | Webhook signature verification | Validate incoming webhooks from ElevenLabs       |

### Alternatives Considered

| Instead of                | Could Use             | Tradeoff                                                                                                |
| ------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| ElevenLabs + Twilio       | Twilio only           | Would need custom TTS/STT integration; ElevenLabs provides superior voice quality and conversational AI |
| ElevenLabs                | Retell AI             | Retell is newer with fewer features; ElevenLabs has mature Twilio integration                           |
| ElevenLabs                | Bland AI              | Bland is simpler but less customizable; ElevenLabs system prompts are more powerful                     |
| Post-call Claude analysis | Real-time streaming   | Real-time is more complex; post-call analysis is sufficient for pre-screening use case                  |
| Dashboard agent config    | API-only agent config | Dashboard is faster for initial setup; can export to API for automation later                           |

**Installation:**

```bash
npm install @elevenlabs/client
```

## Architecture Patterns

### Recommended Project Structure

```
src/main/
├── voiceService.ts              # NEW: ElevenLabs API client, outbound call initiation
├── voiceWebhookHandler.ts       # NEW: Handle post-call webhooks from ElevenLabs
├── transcriptAnalyzer.ts        # NEW: Claude-based pass/maybe/fail determination
├── screeningScriptService.ts    # NEW: Generate dynamic agent overrides per call
├── workflowMachine.ts           # MODIFY: Wire AI call actor to voiceService
├── database.ts                  # MODIFY: Add screening_scripts table, enhance call_records

src/renderer/
├── components/
│   ├── outreach/
│   │   ├── CandidatePanel.tsx   # MODIFY: Add call record display, transcript viewer
│   │   ├── CallRecordCard.tsx   # NEW: Display call outcome, duration, confidence
│   │   ├── TranscriptViewer.tsx # NEW: Full transcript display with speaker labels
│   │   └── ScreeningOutcome.tsx # NEW: Pass/Maybe/Fail badge with confidence
│   ├── settings/
│   │   └── VoiceSettings.tsx    # NEW: ElevenLabs API key, agent config
│   ├── screening/
│   │   ├── ScreeningEditor.tsx  # NEW: Edit screening criteria per JD
│   │   └── QuestionList.tsx     # NEW: Configure 5 fixed question categories
```

### Pattern 1: ElevenLabs Outbound Call via Twilio

**What:** Initiate AI-powered outbound calls through ElevenLabs + Twilio
**When to use:** When workflow transitions to "screening" state
**Source:** [ElevenLabs Twilio Outbound Call API](https://elevenlabs.io/docs/api-reference/twilio/outbound-call)

```typescript
// src/main/voiceService.ts
import { ElevenLabsClient } from "@elevenlabs/client";
import { getCredential } from "./credentialManager";
import { getDatabase } from "./database";
import crypto from "crypto";

interface OutboundCallParams {
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

interface OutboundCallResult {
  success: boolean;
  conversationId?: string;
  callSid?: string;
  error?: string;
}

/**
 * Initiate an outbound screening call via ElevenLabs + Twilio.
 */
export async function initiateScreeningCall(
  params: OutboundCallParams,
): Promise<OutboundCallResult> {
  const apiKey = getCredential(null, "elevenlabs", "api_key");
  const agentId = getCredential(
    params.projectId,
    "elevenlabs",
    "screening_agent_id",
  );
  const phoneNumberId = getCredential(
    params.projectId,
    "elevenlabs",
    "phone_number_id",
  );

  if (!apiKey || !agentId || !phoneNumberId) {
    return { success: false, error: "ElevenLabs credentials not configured" };
  }

  const client = new ElevenLabsClient({ apiKey });

  try {
    // Build dynamic variables for personalization
    const dynamicVariables = buildDynamicVariables(params);

    // Initiate outbound call
    const response = await client.conversationalAi.twilio.outboundCall({
      agent_id: agentId,
      agent_phone_number_id: phoneNumberId,
      to_number: params.phoneNumber,
      conversation_initiation_client_data: {
        dynamic_variables: dynamicVariables,
      },
    });

    if (!response.success) {
      return {
        success: false,
        error: response.message || "Call initiation failed",
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
        started_at, created_at
      ) VALUES (?, ?, ?, 'screening', 'in_progress', ?, ?, ?, ?)
    `,
    ).run(
      callId,
      params.projectId,
      params.candidateId,
      response.conversationId || response.callSid,
      params.phoneNumber,
      now,
      now,
    );

    console.log(
      `[VoiceService] Initiated screening call for ${params.candidateId}: ${response.conversationId}`,
    );

    return {
      success: true,
      conversationId: response.conversationId || undefined,
      callSid: response.callSid || undefined,
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
 * Build dynamic variables for ElevenLabs agent personalization.
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

  // Add screening criteria if available
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
```

### Pattern 2: ElevenLabs Webhook Handler

**What:** Receive and process post-call webhooks from ElevenLabs
**When to use:** Called by ElevenLabs when a call concludes
**Source:** [ElevenLabs Post-Call Webhooks](https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks)

```typescript
// src/main/voiceWebhookHandler.ts
import { getDatabase } from "./database";
import { analyzeTranscript } from "./transcriptAnalyzer";
import { reportScreeningComplete } from "./workflowService";
import crypto from "crypto";

interface TranscriptTurn {
  role: "agent" | "user";
  message: string;
  time_in_call_secs: number;
}

interface WebhookPayload {
  type:
    | "post_call_transcription"
    | "post_call_audio"
    | "call_initiation_failure";
  data: {
    conversation_id: string;
    agent_id: string;
    transcript: TranscriptTurn[];
    analysis?: {
      call_successful: string;
      transcript_summary: string;
      data_collection_results?: Record<string, unknown>;
      evaluation_criteria_results?: Record<string, unknown>;
    };
    metadata?: {
      start_time_unix_secs: number;
      call_duration_secs: number;
      cost?: number;
    };
  };
}

/**
 * Handle incoming webhook from ElevenLabs.
 * Must verify signature before processing.
 */
export async function handlePostCallWebhook(
  payload: WebhookPayload,
  signature: string,
  secret: string,
): Promise<void> {
  // TODO: Verify webhook signature using ElevenLabs SDK
  // const event = elevenlabs.webhooks.constructEvent(payload, signature, secret);

  if (payload.type !== "post_call_transcription") {
    console.log(`[WebhookHandler] Ignoring webhook type: ${payload.type}`);
    return;
  }

  const { conversation_id, transcript, analysis, metadata } = payload.data;

  const db = getDatabase();

  // Find call record by conversation ID
  const callRecord = db
    .prepare(
      `
    SELECT id, cv_id, project_id FROM call_records
    WHERE provider_call_id = ?
  `,
    )
    .get(conversation_id) as
    | { id: string; cv_id: string; project_id: string }
    | undefined;

  if (!callRecord) {
    console.warn(
      `[WebhookHandler] No call record found for conversation: ${conversation_id}`,
    );
    return;
  }

  // Format transcript for storage and analysis
  const rawTranscript = transcript
    .map((t) => `${t.role === "agent" ? "Agent" : "Candidate"}: ${t.message}`)
    .join("\n\n");

  // Store transcript
  const transcriptId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO transcripts (id, call_id, project_id, raw_text, segments_json, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    transcriptId,
    callRecord.id,
    callRecord.project_id,
    rawTranscript,
    JSON.stringify(transcript),
    analysis?.transcript_summary || null,
    now,
  );

  // Analyze transcript for pass/maybe/fail outcome
  const screeningResult = await analyzeTranscript(
    rawTranscript,
    callRecord.project_id,
  );

  // Update call record with outcome
  db.prepare(
    `
    UPDATE call_records SET
      status = 'completed',
      duration_seconds = ?,
      screening_outcome = ?,
      screening_confidence = ?,
      ended_at = ?
    WHERE id = ?
  `,
  ).run(
    metadata?.call_duration_secs || 0,
    screeningResult.outcome,
    screeningResult.confidence,
    now,
    callRecord.id,
  );

  // Report to workflow
  const workflowOutcome =
    screeningResult.outcome === "pass" ? "passed" : "failed";
  reportScreeningComplete(callRecord.cv_id, workflowOutcome);

  console.log(
    `[WebhookHandler] Processed call ${callRecord.id}: ${screeningResult.outcome} (${screeningResult.confidence}%)`,
  );
}
```

### Pattern 3: Claude-Based Transcript Analysis

**What:** Analyze screening call transcript to determine pass/maybe/fail
**When to use:** After receiving transcript from ElevenLabs webhook
**Why Claude:** Nuanced judgment for ambiguous answers; threshold comparison

```typescript
// src/main/transcriptAnalyzer.ts
import Anthropic from "@anthropic-ai/sdk";
import { getCredential } from "./credentialManager";
import { getDatabase } from "./database";

interface ScreeningResult {
  outcome: "pass" | "maybe" | "fail";
  confidence: number; // 0-100
  reasoning: string;
  extractedData: {
    salaryExpectation?: string;
    location?: string;
    availability?: string;
    interestLevel?: string;
    contactPreference?: string;
  };
  disqualifiers: string[];
}

interface ScreeningCriteria {
  salaryMin?: number;
  salaryMax?: number;
  allowedLocations?: string[];
  requiresRelocation?: boolean;
  minimumAvailability?: string;
}

/**
 * Analyze a screening transcript to determine pass/maybe/fail.
 * Uses Claude to extract information and evaluate against criteria.
 */
export async function analyzeTranscript(
  transcript: string,
  projectId: string,
): Promise<ScreeningResult> {
  const apiKey = getCredential(null, "anthropic", "api_key");
  if (!apiKey) {
    console.warn("[TranscriptAnalyzer] No Anthropic API key, returning maybe");
    return {
      outcome: "maybe",
      confidence: 50,
      reasoning: "No API key configured for transcript analysis",
      extractedData: {},
      disqualifiers: [],
    };
  }

  // Get screening criteria for this project/role
  const criteria = getScreeningCriteria(projectId);

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are analyzing a pre-screening call transcript between a recruitment AI agent and a candidate.
Your task is to:
1. Extract key information from the conversation
2. Identify any disqualifying factors
3. Determine if the candidate should PASS, MAYBE, or FAIL

Screening Criteria:
${JSON.stringify(criteria, null, 2)}

Disqualification reasons:
- Salary expectation significantly above range (>20% over max)
- Location mismatch with no willingness to relocate
- Explicitly not interested in opportunities
- Unavailable for the foreseeable future
- Rude, unresponsive, or hung up during call

PASS: Meets all criteria, engaged, interested
MAYBE: Some uncertainty, partial answers, needs recruiter review
FAIL: Clear disqualifier present

Respond with JSON only.`;

  const userPrompt = `Analyze this screening call transcript:

${transcript}

Return JSON with this structure:
{
  "outcome": "pass" | "maybe" | "fail",
  "confidence": number (0-100),
  "reasoning": "Brief explanation",
  "extractedData": {
    "salaryExpectation": "string or null",
    "location": "string or null",
    "availability": "string or null",
    "interestLevel": "string or null",
    "contactPreference": "string or null"
  },
  "disqualifiers": ["list of reasons if any"]
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse JSON response
    const result = JSON.parse(textContent.text) as ScreeningResult;
    return result;
  } catch (error) {
    console.error("[TranscriptAnalyzer] Analysis failed:", error);
    return {
      outcome: "maybe",
      confidence: 50,
      reasoning: "Analysis failed, requires manual review",
      extractedData: {},
      disqualifiers: [],
    };
  }
}

/**
 * Get screening criteria for a project (from JD or project settings).
 */
function getScreeningCriteria(projectId: string): ScreeningCriteria {
  const db = getDatabase();

  // First check if there's project-specific screening criteria
  const projectCriteria = db
    .prepare(
      `
    SELECT criteria_json FROM screening_scripts WHERE project_id = ? LIMIT 1
  `,
    )
    .get(projectId) as { criteria_json: string } | undefined;

  if (projectCriteria) {
    return JSON.parse(projectCriteria.criteria_json);
  }

  // Fall back to extracting from JD
  const jd = db
    .prepare(
      `
    SELECT experience_min, experience_max FROM job_descriptions WHERE project_id = ? LIMIT 1
  `,
    )
    .get(projectId) as
    | { experience_min: number; experience_max: number }
    | undefined;

  return {
    salaryMin: undefined, // Not yet in JD schema
    salaryMax: undefined,
    allowedLocations: undefined,
    requiresRelocation: undefined,
    minimumAvailability: undefined,
  };
}
```

### Pattern 4: ElevenLabs Agent System Prompt

**What:** Configure the AI screening agent's behavior via system prompt
**When to use:** Agent creation/configuration in ElevenLabs dashboard or API
**Source:** [ElevenLabs Prompting Guide](https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide)

```markdown
# Personality

You are {{agent_name}}, a friendly and warm recruitment consultant calling on behalf of {{company_name}}. You're conducting a brief pre-screening call to learn about the candidate's situation before a recruiter follows up.

Your tone is conversational, professional, and respectful of the candidate's time. You speak naturally and adapt to the flow of conversation. You're genuinely interested in helping candidates find the right opportunities.

# Goal

Conduct a 2-3 minute pre-screening call to gather logistics from the candidate:

1. Salary expectations
2. Current location and willingness to relocate
3. Availability / start date
4. Interest level in new opportunities
5. Best contact details for follow-up

After gathering this information, thank them warmly and let them know a recruiter will be in touch if there's a match.

# Conversation Flow

## Opening

Introduce yourself, the agency, and ask if they have 2 minutes.

- "Hi, is this {{candidate_name}}? This is {{agent_name}} calling from {{company_name}}. We came across your profile and thought you might be a good fit for a {{role_title}} role we're working on. Have you got a couple of minutes?"

If they say it's a bad time:

- Ask when would be better
- Capture their preferred callback time
- Thank them and end the call warmly

If prior SMS/email context exists:

- Reference it: "Thanks for replying to our message earlier..."

## Questions (Ask all 5)

Ask each question conversationally, not like a survey:

1. **Salary**: "What sort of salary range are you looking for in your next role?"
2. **Location**: "Where are you based at the moment? And would you be open to relocating?"
3. **Availability**: "If the right opportunity came up, how quickly could you start?"
4. **Interest**: "Are you actively looking at the moment, or just open to hearing about the right opportunity?"
5. **Contact**: "What's the best way for one of our recruiters to reach you?"

If they give an unclear answer:

- Rephrase once: "Just to clarify, when you say [X], do you mean...?"
- If still unclear, acknowledge and move on: "No problem, we can dig into that more if there's a fit."

## Closing

- Briefly summarize what you heard
- End on a positive note: "Thanks so much for your time, {{candidate_first_name}}. Based on what you've shared, one of our recruiters will be in touch if this looks like a good fit. Have a great day!"

# Guardrails

- **Never claim they applied for a job** - these are sourced candidates
- **Never make promises** about the role, salary, or outcome
- **Never disclose you are an AI** unless specifically asked directly
- **If asked if you're a robot/AI**: "I'm calling on behalf of the recruitment team"
- **If they press further**: Be honest: "I'm an AI assistant helping our recruiters with initial screening"
- **Never continue if they hang up** - mark as disengaged
- **Always stay warm and professional** even if they're dismissive
- **Respect opt-out requests** - "No problem at all, I'll make sure we don't contact you again"

# Dynamic Variables

- {{agent_name}} - Configurable agent name
- {{candidate_name}} - Full candidate name
- {{candidate_first_name}} - First name only
- {{company_name}} - Recruiting agency name
- {{role_title}} - Job title
- {{prior_context}} - Any SMS/email context to reference
- {{salary_min}} / {{salary_max}} - Expected salary range for comparison
- {{job_location}} - Job location for comparison
```

### Pattern 5: Call Record UI Component

**What:** Display call outcome, transcript, and confidence in the UI
**When to use:** CandidatePanel when viewing a candidate with completed screening

```typescript
// src/renderer/components/outreach/CallRecordCard.tsx
import { Phone, Clock, TrendingUp, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface CallRecord {
  id: string;
  status: 'in_progress' | 'completed' | 'failed' | 'no_answer';
  durationSeconds?: number;
  screeningOutcome?: 'pass' | 'maybe' | 'fail';
  screeningConfidence?: number;
  startedAt: string;
  endedAt?: string;
}

interface CallRecordCardProps {
  call: CallRecord;
  onViewTranscript: () => void;
}

function getOutcomeStyle(outcome?: string) {
  switch (outcome) {
    case 'pass':
      return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Passed' };
    case 'fail':
      return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Failed' };
    case 'maybe':
      return { icon: HelpCircle, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Maybe' };
    default:
      return { icon: Phone, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Unknown' };
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function CallRecordCard({ call, onViewTranscript }: CallRecordCardProps) {
  const outcomeStyle = getOutcomeStyle(call.screeningOutcome);
  const OutcomeIcon = outcomeStyle.icon;

  return (
    <Card className={cn('transition-colors', outcomeStyle.bg)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Screening Call
          </CardTitle>
          <Badge variant="outline" className={outcomeStyle.color}>
            <OutcomeIcon className="h-3 w-3 mr-1" />
            {outcomeStyle.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            Duration: {formatDuration(call.durationSeconds)}
          </div>
          {call.screeningConfidence && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Confidence: {call.screeningConfidence}%
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {new Date(call.startedAt).toLocaleString()}
        </div>

        {call.status === 'completed' && (
          <Button variant="outline" size="sm" onClick={onViewTranscript}>
            View Transcript
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

### Anti-Patterns to Avoid

- **Storing ElevenLabs API key in renderer:** All API calls must go through main process IPC
- **Real-time transcript streaming for desktop:** ElevenLabs webhooks need public URL; use polling for local dev
- **Hardcoding agent ID:** Agent ID must be configurable per project/agency
- **Blocking workflow on call completion:** Initiate call and return; let webhook update state
- **Skipping webhook signature verification:** Security risk; always verify HMAC signature
- **Using real-time pass/fail during call:** Per CONTEXT.md, determination is post-call
- **Overloading the agent with too many tools:** Keep it simple; just gather information

## Don't Hand-Roll

| Problem                  | Don't Build                   | Use Instead                   | Why                                                        |
| ------------------------ | ----------------------------- | ----------------------------- | ---------------------------------------------------------- |
| Voice AI agent           | Custom STT+TTS pipeline       | ElevenLabs Conversational AI  | Handles turn-taking, interruptions, latency; battle-tested |
| Outbound dialing         | Twilio + custom orchestration | ElevenLabs Twilio integration | Single API call; they handle the complexity                |
| Transcript formatting    | Manual parsing                | ElevenLabs webhook payload    | Already structured with speaker labels and timing          |
| System prompt versioning | Custom config files           | ElevenLabs dashboard          | Visual editor, A/B testing, versioning built-in            |
| Call quality monitoring  | Custom metrics                | ElevenLabs analytics          | Real-time dashboards, cost tracking                        |

## Common Pitfalls

### Pitfall 1: Webhook URL Not Reachable

**What goes wrong:** ElevenLabs can't deliver post-call webhooks; transcripts never arrive
**Why it happens:** Desktop app doesn't have public URL; ngrok URL changes
**How to avoid:** Use ElevenLabs conversation polling API as fallback; or use a persistent webhook relay service
**Warning signs:** Call completes but workflow stays in "screening" state

### Pitfall 2: Agent Talks Too Long

**What goes wrong:** 10+ minute calls instead of 2-3 minutes; candidate disengaged
**Why it happens:** System prompt encourages elaboration; no conversation length limit
**How to avoid:** Explicit instruction in prompt: "Keep the call under 3 minutes"; configure timeout in agent settings
**Warning signs:** Average call duration > 5 minutes

### Pitfall 3: Candidate Thinks They Applied

**What goes wrong:** Candidate confused about why they're being called; bad experience
**Why it happens:** Agent uses "applied for" or "your application" language
**How to avoid:** Explicit guardrail: "Never claim they applied"; use "came across your profile"
**Warning signs:** Complaints about unsolicited calls

### Pitfall 4: Screening Criteria Not Loaded

**What goes wrong:** Pass/fail determination doesn't match JD requirements
**Why it happens:** JD doesn't have salary/location fields; criteria not configured
**How to avoid:** Add screening criteria to JD extraction or project settings; fallback to "maybe"
**Warning signs:** Most calls return "maybe" with low confidence

### Pitfall 5: Voicemail Detection Failure

**What goes wrong:** AI talks to voicemail; wastes credits; confusing message left
**Why it happens:** ElevenLabs voicemail detection not enabled
**How to avoid:** Enable voicemail detection in agent settings; configure voicemail message
**Warning signs:** Many short calls with no meaningful transcript

### Pitfall 6: Candidate Hangs Up Immediately

**What goes wrong:** Call marked as "completed" with no data
**Why it happens:** Intro too long or robotic; caller ID unfamiliar
**How to avoid:** Short, human-sounding intro; warm tone; use local phone number if possible
**Warning signs:** Many calls < 10 seconds with empty transcripts

## Database Schema Additions

```sql
-- Migration v9: Voice screening tables

-- Screening scripts per project (optional override)
CREATE TABLE IF NOT EXISTS screening_scripts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  agent_name TEXT DEFAULT 'Alex',
  system_prompt_override TEXT,
  first_message_override TEXT,
  criteria_json TEXT,  -- ScreeningCriteria object
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_screening_scripts_project ON screening_scripts(project_id);

-- Add retry tracking to call_records
ALTER TABLE call_records ADD COLUMN attempt_number INTEGER DEFAULT 1;
ALTER TABLE call_records ADD COLUMN max_attempts INTEGER DEFAULT 3;
ALTER TABLE call_records ADD COLUMN next_retry_at TEXT;
ALTER TABLE call_records ADD COLUMN failure_reason TEXT;

-- Add voicemail tracking
ALTER TABLE call_records ADD COLUMN was_voicemail INTEGER DEFAULT 0;
ALTER TABLE call_records ADD COLUMN voicemail_message_left INTEGER DEFAULT 0;

-- Add extracted data from transcript
ALTER TABLE call_records ADD COLUMN extracted_data_json TEXT;

-- Index for retry queue
CREATE INDEX IF NOT EXISTS idx_call_records_retry ON call_records(next_retry_at) WHERE status = 'no_answer';
```

## State of the Art

| Old Approach              | Current Approach             | When Changed | Impact                                             |
| ------------------------- | ---------------------------- | ------------ | -------------------------------------------------- |
| Custom STT + TTS          | ElevenLabs Conversational AI | 2024+        | Turnkey voice AI with sub-second latency           |
| Twilio Studio             | ElevenLabs + Twilio SIP      | Nov 2025     | Direct Twilio integration, no custom TwiML         |
| Manual transcript parsing | Webhook with structured data | 2025         | Pre-formatted transcripts with timing              |
| Real-time scoring         | Post-call analysis           | N/A          | Simpler architecture; sufficient for pre-screening |

**Deprecated/outdated:**

- `twilio-voice-ai`: Use ElevenLabs native Twilio integration
- Custom ASR + LLM + TTS pipelines: ElevenLabs handles all three seamlessly
- Separate Twilio SIP trunk config: ElevenLabs auto-configures when importing Twilio number

## Open Questions

1. **Webhook relay for desktop**
   - What we know: Desktop apps can't receive webhooks directly
   - What's unclear: Best pattern for receiving ElevenLabs webhooks
   - Recommendation: Investigate ElevenLabs conversation polling API; or use a simple cloud relay (Cloudflare Worker/AWS Lambda)

2. **Screening criteria storage**
   - What we know: 5 fixed question categories per CONTEXT.md
   - What's unclear: Where to store salary/location thresholds (JD? Project settings?)
   - Recommendation: Add `criteria_json` to screening_scripts table; UI to override from JD

3. **Multi-retry intervals**
   - What we know: Retry N times on no answer (configurable)
   - What's unclear: Optimal interval between retries
   - Recommendation: 15 min, 1 hour, 4 hours; configurable in project settings

4. **Voicemail script content**
   - What we know: Leave brief message with callback request
   - What's unclear: Exact wording
   - Recommendation: "Hi {{candidate_name}}, this is {{agent_name}} from {{company_name}}. We were reaching out about a {{role_title}} opportunity. Please give us a call back at your convenience. Thanks!"

5. **Technical failure vs hang-up detection**
   - What we know: Need to distinguish for retry logic
   - What's unclear: How ElevenLabs reports these differently
   - Recommendation: Check `call_initiation_failure` webhook vs transcript with only agent speech

## Sources

### Primary (HIGH confidence)

- [ElevenLabs Twilio Integration](https://elevenlabs.io/agents/integrations/twilio) - Native integration overview
- [ElevenLabs Outbound Call API](https://elevenlabs.io/docs/api-reference/twilio/outbound-call) - API reference
- [ElevenLabs Post-Call Webhooks](https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks) - Webhook payload structure
- [ElevenLabs SIP Trunking](https://elevenlabs.io/docs/agents-platform/phone-numbers/sip-trunking) - SIP configuration
- [ElevenLabs Prompting Guide](https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide) - Agent system prompt best practices
- [ElevenLabs Dynamic Variables](https://elevenlabs.io/docs/agents-platform/customization/personalization/dynamic-variables) - Runtime personalization
- Project codebase: `workflowMachine.ts`, `workflowService.ts`, `database.ts`, `CandidatePanel.tsx`

### Secondary (MEDIUM confidence)

- [Twilio Voice ElevenLabs Integration](https://www.twilio.com/en-us/blog/developers/tutorials/integrations/build-twilio-voice-elevenlabs-agents-integration) - Twilio perspective
- [GitHub: elevenlabs-twilio-i-o](https://github.com/louisjoecodes/elevenlabs-twilio-i-o) - Community integration example
- Phase 9 and 10 research documents - Existing architecture patterns

### Tertiary (LOW confidence)

- Medium articles on ElevenLabs integrations - Community patterns

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - ElevenLabs is production-ready; Twilio integration officially supported
- Architecture: HIGH - Follows existing codebase patterns; ElevenLabs handles complexity
- Pitfalls: MEDIUM - Based on documentation and common voice AI issues
- Webhook handling: MEDIUM - Desktop app webhook pattern needs validation

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (ElevenLabs actively developing; APIs may evolve)
