# Architecture Patterns: M2 Automated Outreach

**Domain:** Automated candidate outreach integration into existing Electron + React + Python desktop app
**Researched:** 2026-01-31
**Overall confidence:** MEDIUM (no web search available; based on training data + codebase analysis)

## Existing Architecture Summary

```
Renderer (React + Zustand)        Main Process (Node.js)           Python Sidecar
  MemoryRouter: /, /project/:id     IPC handlers (ipcMain.handle)    PDF parse/extract
  Stores: queue, editor, jd,        SQLite (better-sqlite3, WAL)     NLP extraction
          project, settings, usage   Python lifecycle management       PDF generation
  contextBridge → window.api         Queue manager
```

Current DB schema version: user_version >= 2. Tables: `cvs`, `job_descriptions`, `cv_jd_matches`, `projects`, `app_meta`, `usage_events`. Projects have CVs and JDs with match scores.

Current routing: `MemoryRouter` with 3 routes: `/` (Dashboard), `/project/:id` (ProjectView), `/settings`.

---

## Integration Analysis by Feature

### 1. Samsara Wheel Navigation

**Recommendation: Nested routes under `/project/:id/*`, NOT conditional rendering.**

The current `ProjectView.tsx` is a monolith that switches between QueueTabs, CVEditor, JDPanel, etc. via `viewMode` state. M2 adds outreach, calls, transcripts, ATS -- too many concerns for one component.

**Approach:**

```
/project/:id              → Wheel hub (overview + navigation)
/project/:id/cvs          → Current QueueTabs + CVEditor (M1 functionality)
/project/:id/outreach     → Outreach dashboard, message history
/project/:id/calls        → Call records, transcripts
/project/:id/ats          → ATS field mapping + submission
/project/:id/settings     → Project-level settings (providers, templates)
```

**Implementation:**

- Add `react-router-dom` nested `<Outlet>` inside a new `ProjectLayout.tsx` that renders the wheel + active section
- Wheel is a persistent navigation element within the project layout, not a separate page
- Current ProjectView content moves to `/project/:id/cvs` route
- Each wheel section is a lazy-loaded route component

**Why not conditional rendering:** The outreach section alone will need sub-views (template editor, message history, sequence builder). Routing gives URL state, code splitting, and back/forward navigation for free.

**Existing code impact:** MEDIUM. Refactor `ProjectView.tsx` into `ProjectLayout.tsx` + child routes. Move current content to `CVSection.tsx`. Stores remain unchanged -- they already scope by `projectId`.

---

### 2. SMS/Email Sending

**Recommendation: Electron main process (Node.js), NOT Python sidecar.**

Rationale:

- Node.js has excellent HTTP client support (fetch/undici built-in since Node 18)
- Twilio, SendGrid, and SMTP all have mature Node.js SDKs
- Avoids round-trip through Python IPC for simple REST calls
- Python sidecar should stay focused on NLP/parsing/PDF (its strengths)

**Component ownership:**

```
Main Process:
  src/main/outreach/
    smsProvider.ts      → Twilio/MessageBird abstraction
    emailProvider.ts    → SendGrid/SES/SMTP abstraction
    templateEngine.ts   → Variable substitution (Handlebars or simple mustache)
    outreachManager.ts  → Orchestrates sequences, manages timers

Renderer:
  src/renderer/components/outreach/
    TemplateEditor.tsx
    MessageHistory.tsx
    OutreachDashboard.tsx
  src/renderer/stores/
    outreachStore.ts
```

**API key security:**

- Store encrypted in SQLite using `safeStorage.encryptString()` (Electron API, uses OS keychain under the hood -- DPAPI on Windows, Keychain on macOS)
- Decrypt only in main process at send time
- NEVER expose decrypted keys to renderer via IPC
- Preload exposes only: `window.api.saveProviderCredentials(provider, encrypted)` and `window.api.testProvider(provider)` -- no getCredentials

**IPC additions:**

```typescript
// New IPC channels
'outreach:send-sms'        → { candidateId, templateId } → result
'outreach:send-email'      → { candidateId, templateId } → result
'outreach:test-provider'   → { provider } → { success, error }
'outreach:save-credentials' → { provider, credentials } → result
'outreach:get-templates'   → {} → Template[]
'outreach:save-template'   → Template → result
```

---

### 3. AI Voice Call Orchestration

**Recommendation: Polling-based, NOT webhook/local server.**

The webhook approach (local HTTP server + ngrok tunnel) is fragile for a desktop app:

- Ngrok adds a dependency, requires account, may be blocked by corporate firewalls
- Local HTTP server conflicts with firewalls, NAT, VPNs
- Tunnel reliability is a support nightmare

**Approach: Polling + provider status API**

All major voice AI providers (Bland.ai, Vapi, Retell) offer:

1. POST to initiate call → returns `call_id`
2. GET `/call/{id}` to check status → returns status, recording URL, transcript

**Implementation:**

```
Main Process:
  src/main/voice/
    voiceProvider.ts    → Provider abstraction (initiate, poll status, get recording)
    callPoller.ts       → setInterval-based polling (every 5s during active calls)
    callManager.ts      → Lifecycle: initiate → poll → download recording → transcribe
```

Poll interval: 5 seconds during active call, stop after terminal state. With a max 30-min call, that is 360 polls -- negligible.

**Provider recommendation:** Vapi or Bland.ai. Both offer:

- REST API for call initiation
- Status polling endpoints
- Recording download
- Transcript retrieval (some providers do this server-side)

**Confidence: LOW** -- Provider API specifics not verified against current docs. Need phase-specific research.

---

### 4. System Audio Capture

**Recommendation: Native addon required. This is the hardest integration point.**

**Windows (WASAPI Loopback):**

- WASAPI loopback capture lets you record system audio output
- Requires a native Node.js addon (N-API/node-addon-api) wrapping WASAPI COM APIs
- No pure-JS solution exists
- Package `node-audio-recorder` or `naudiodon` may provide partial support but are often unmaintained

**macOS (CoreAudio):**

- macOS does NOT allow system audio capture without a virtual audio driver
- Apps like BlackHole or Soundflower install a kernel extension / audio driver
- This is a terrible UX requirement for an Electron app
- Alternative: Use per-app capture via `AudioWorklet` if the call is in-browser

**Cross-platform reality check:**
| Platform | Feasibility | Approach | UX Impact |
|----------|-------------|----------|-----------|
| Windows | MEDIUM | WASAPI loopback via native addon | None (transparent) |
| macOS | LOW | Requires virtual audio driver install | Bad (user must install driver) |

**Recommendation: Deprioritize system audio capture. Instead:**

1. For AI voice calls (Phase 3): Provider handles recording server-side. Download the recording file. No local capture needed.
2. For recruiter calls: If the recruiter uses the app's built-in dialer (WebRTC/SIP in Electron), capture audio at the application level via Web Audio API -- no system capture needed.
3. If system capture is truly needed later: Ship a native addon for Windows only, and require BlackHole on macOS. But treat this as a separate R&D spike.

**Confidence: MEDIUM** -- WASAPI/CoreAudio capabilities are well-known. Specific npm packages not verified.

---

### 5. Call Transcription

**Recommendation: Cloud first (provider-included or Deepgram), local Whisper as optional fallback.**

| Approach                | Latency       | Quality   | Cost                  | Complexity     |
| ----------------------- | ------------- | --------- | --------------------- | -------------- |
| Voice provider built-in | ~0 (included) | Good      | Included in call cost | None           |
| Deepgram/AssemblyAI API | Seconds       | Excellent | ~$0.01/min            | Low (REST API) |
| whisper.cpp local       | Minutes       | Good      | Free                  | HIGH           |

**Why not local-first Whisper:**

- whisper.cpp requires ~1.5GB model file download
- Transcription takes 2-10x real-time on CPU (a 10-min call = 20-100 min)
- GPU acceleration requires CUDA/Metal setup
- The app already makes cloud calls (Twilio, voice AI) -- transcription is not the privacy boundary

**If local transcription is added later:**

- Run as a separate process (not Python sidecar -- it would block parsing)
- Use `whisper.cpp` compiled to a standalone binary, managed like the Python sidecar
- Or use `whisper-node` (Node.js bindings to whisper.cpp) in a worker thread

**Implementation:**

```
Main Process:
  src/main/transcription/
    transcriptionProvider.ts   → Cloud API abstraction
    transcriptionManager.ts    → Queue transcription jobs, store results
```

---

### 6. ATS DOM Bridge

**Recommendation: Chrome extension communicating with Electron via localhost WebSocket.**

Options considered:

| Approach                            | Reliability | Setup                      | ATS Compatibility           |
| ----------------------------------- | ----------- | -------------------------- | --------------------------- |
| Playwright from main process        | HIGH        | Complex (bundled Chromium) | Good but separate browser   |
| Puppeteer controlling user's Chrome | MEDIUM      | Needs debug port           | Good, uses existing session |
| Chrome extension + Electron IPC     | HIGH        | Extension install          | Best -- runs in ATS tab     |

**Why Chrome extension:**

- Runs inside the user's authenticated ATS session (no re-login needed)
- Can read/write DOM directly
- Communicates with Electron via `chrome.runtime.sendNativeMessage()` (Native Messaging) or a localhost WebSocket
- User already has ATS open in Chrome -- extension augments their workflow

**Communication flow:**

```
Electron Main ←→ WebSocket Server (localhost:PORT) ←→ Chrome Extension content script
     ↓                                                        ↓
   SQLite                                               ATS Web Page DOM
  (candidate data)                                    (form fill, submit)
```

**Native Messaging alternative:** More secure but requires registry setup on Windows. WebSocket is simpler for v1.

**Extension architecture:**

```
chrome-extension/
  manifest.json         → permissions for ATS domains
  background.js         → WebSocket client connecting to Electron
  content-scripts/
    bullhorn.js         → Bullhorn-specific selectors and form fill logic
    jobadder.js         → JobAdder-specific
    generic.js          → Fallback with user-configured selectors
  popup.html            → Connection status, manual trigger
```

**Confidence: MEDIUM** -- Pattern is well-established. Specific ATS DOM structures need per-vendor research.

---

### 7. Outreach State Machine

**Recommendation: SQLite-backed state machine in main process with event-driven transitions.**

**States per candidate:**

```
PENDING → OUTREACH_SENT → AWAITING_REPLY → [REPLIED | TIMEOUT]
                                              ↓          ↓
                                         SCHEDULING   AI_CALLING
                                              ↓          ↓
                                         SCHEDULED    SCREENED
                                              ↓          ↓
                                         CALL_DONE    [PASS | FAIL]
                                              ↓          ↓
                                         TRANSCRIBED  REJECTED
                                              ↓
                                         ATS_READY → ATS_SUBMITTED → SENT_TO_CLIENT
```

**Implementation:**

```
Main Process:
  src/main/outreach/
    stateMachine.ts      → Transition rules, validation
    outreachScheduler.ts → Timer-based transitions (timeout → AI_CALLING)
    eventBus.ts          → Internal event emitter for decoupled transitions
```

**Where state lives:** SQLite. Each candidate-in-project gets an `outreach_status` column (or a dedicated `outreach_sequences` table for richer tracking). State transitions are atomic DB updates with timestamps.

**Why not xstate/statecharts:** Overkill for a linear-ish workflow. Simple switch/map of valid transitions is sufficient. If the state machine grows complex later, migrate to xstate.

---

### 8. Data Model -- SQLite Schema Additions

**New tables (migration version 3+):**

```sql
-- Provider credentials (encrypted)
CREATE TABLE provider_credentials (
  id TEXT PRIMARY KEY,
  provider_type TEXT NOT NULL,  -- 'twilio', 'sendgrid', 'vapi', etc.
  provider_name TEXT NOT NULL,  -- User-friendly label
  credentials_encrypted BLOB NOT NULL,  -- safeStorage encrypted JSON
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Message templates
CREATE TABLE message_templates (
  id TEXT PRIMARY KEY,
  project_id TEXT,              -- NULL = global template
  name TEXT NOT NULL,
  channel TEXT NOT NULL,        -- 'sms', 'email'
  subject TEXT,                 -- Email subject (NULL for SMS)
  body TEXT NOT NULL,           -- Template body with {{variables}}
  variables_json TEXT,          -- Available variable definitions
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Outreach sequences (one per candidate per project)
CREATE TABLE outreach_sequences (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  cv_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- State machine state
  started_at TEXT,
  completed_at TEXT,
  outcome TEXT,                 -- 'hired', 'rejected', 'withdrawn', etc.
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (cv_id) REFERENCES cvs(id) ON DELETE CASCADE,
  UNIQUE(project_id, cv_id)
);
CREATE INDEX idx_outreach_project ON outreach_sequences(project_id);
CREATE INDEX idx_outreach_status ON outreach_sequences(status);

-- Individual messages sent/received
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL,
  channel TEXT NOT NULL,        -- 'sms', 'email'
  direction TEXT NOT NULL,      -- 'outbound', 'inbound'
  provider_message_id TEXT,     -- External ID from Twilio/SendGrid
  template_id TEXT,
  recipient TEXT NOT NULL,      -- Phone or email
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL,         -- 'queued', 'sent', 'delivered', 'failed', 'received'
  status_detail TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sequence_id) REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL
);
CREATE INDEX idx_messages_sequence ON messages(sequence_id);

-- Call records
CREATE TABLE call_records (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL,
  call_type TEXT NOT NULL,      -- 'ai_screening', 'recruiter'
  provider_call_id TEXT,
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL,         -- 'initiated', 'ringing', 'in_progress', 'completed', 'failed'
  duration_seconds INTEGER,
  recording_path TEXT,          -- Local file path to recording
  screening_outcome TEXT,       -- 'pass', 'fail', 'unclear' (AI calls only)
  screening_confidence REAL,
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sequence_id) REFERENCES outreach_sequences(id) ON DELETE CASCADE
);
CREATE INDEX idx_calls_sequence ON call_records(sequence_id);

-- Transcripts
CREATE TABLE transcripts (
  id TEXT PRIMARY KEY,
  call_record_id TEXT NOT NULL,
  provider TEXT NOT NULL,       -- 'vapi_builtin', 'deepgram', 'whisper_local'
  content TEXT NOT NULL,        -- Full transcript text
  segments_json TEXT,           -- Timestamped segments [{start, end, speaker, text}]
  confidence REAL,
  language TEXT DEFAULT 'en',
  created_at TEXT NOT NULL,
  FOREIGN KEY (call_record_id) REFERENCES call_records(id) ON DELETE CASCADE
);

-- ATS field mappings
CREATE TABLE ats_field_mappings (
  id TEXT PRIMARY KEY,
  ats_vendor TEXT NOT NULL,     -- 'bullhorn', 'jobadder', 'vincere'
  mapping_name TEXT NOT NULL,
  field_map_json TEXT NOT NULL, -- { ats_field: cv_json_path } mapping
  is_default INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ATS submissions
CREATE TABLE ats_submissions (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL,
  ats_vendor TEXT NOT NULL,
  field_mapping_id TEXT,
  status TEXT NOT NULL,         -- 'pending', 'in_progress', 'completed', 'failed'
  submitted_data_json TEXT,
  error_detail TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sequence_id) REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  FOREIGN KEY (field_mapping_id) REFERENCES ats_field_mappings(id) ON DELETE SET NULL
);
```

**Relationship to existing tables:**

```
projects (existing)
  ├── cvs (existing, has project_id)
  │     └── outreach_sequences (NEW, links cv to project outreach)
  │           ├── messages (NEW)
  │           ├── call_records (NEW)
  │           │     └── transcripts (NEW)
  │           └── ats_submissions (NEW)
  ├── job_descriptions (existing)
  ├── message_templates (NEW, optionally scoped to project)
  └── provider_credentials (NEW, global)
      └── ats_field_mappings (NEW, global)
```

---

## New Component Map

```
src/main/
  outreach/
    smsProvider.ts           [NEW] SMS sending abstraction
    emailProvider.ts         [NEW] Email sending abstraction
    templateEngine.ts        [NEW] Variable substitution
    outreachManager.ts       [NEW] Sequence orchestration + timers
    stateMachine.ts          [NEW] State transition logic
  voice/
    voiceProvider.ts         [NEW] Voice AI provider abstraction
    callPoller.ts            [NEW] Active call status polling
    callManager.ts           [NEW] Call lifecycle management
  transcription/
    transcriptionProvider.ts [NEW] Cloud transcription API
  ats/
    atsBridge.ts             [NEW] WebSocket server for extension comms
    fieldMapper.ts           [NEW] CV data → ATS field mapping
  credentials.ts             [NEW] safeStorage encrypt/decrypt
  database.ts                [MODIFIED] Add migration v3 with new tables

src/renderer/
  routes/
    ProjectLayout.tsx        [NEW] Wheel navigation + Outlet
    CVSection.tsx            [NEW] Extracted from current ProjectView
    OutreachSection.tsx      [NEW] Outreach dashboard
    CallsSection.tsx         [NEW] Call records + transcripts
    ATSSection.tsx           [NEW] Field mapping + submission
  components/
    wheel/
      SamsaraWheel.tsx       [NEW] Radial/tab navigation component
    outreach/
      TemplateEditor.tsx     [NEW]
      MessageHistory.tsx     [NEW]
      SequenceTimeline.tsx   [NEW]
    calls/
      CallRecordCard.tsx     [NEW]
      TranscriptViewer.tsx   [NEW]
    ats/
      FieldMappingEditor.tsx [NEW]
      SubmissionPreview.tsx  [NEW]
  stores/
    outreachStore.ts         [NEW] Outreach sequences + messages
    callStore.ts             [NEW] Call records + transcripts
    atsStore.ts              [NEW] ATS mappings + submissions

chrome-extension/            [NEW, separate project]
  manifest.json
  background.js
  content-scripts/
```

---

## Suggested Build Order (Dependency-Based)

```
Phase 1: Navigation + Data Model
  ├── Samsara Wheel / nested routes (enables all subsequent UI)
  ├── DB migration with new tables (enables all data storage)
  └── Credential storage (safeStorage) (enables provider setup)

Phase 2: Communication Infrastructure
  ├── SMS provider integration (depends: credentials, DB)
  ├── Email provider integration (depends: credentials, DB)
  └── Template engine + editor (depends: DB)

Phase 3: Outreach Workflow
  ├── State machine (depends: DB schema)
  ├── Outreach scheduler/timers (depends: state machine, comms)
  └── Outreach dashboard UI (depends: routes, stores)

Phase 4: Voice Integration
  ├── Voice provider integration (depends: credentials)
  ├── Call poller (depends: voice provider)
  └── Transcription (depends: call records)

Phase 5: ATS Bridge
  ├── Field mapping engine (depends: DB, CV data model)
  ├── Chrome extension (depends: field mapping)
  └── WebSocket bridge (depends: extension)

Phase 6: Client Submission
  └── Package + send (depends: ATS, transcripts, branded CV from M1)
```

**Why this order:**

- Phase 1 is pure infrastructure -- no external dependencies, unblocks everything
- Phase 2 is the simplest external integration (REST APIs), validates credential storage
- Phase 3 ties Phase 2 together into workflows
- Phase 4 is the riskiest integration (voice AI), benefits from learning in Phase 2-3
- Phase 5 (ATS) is the most complex (browser extension), deferred until core workflow works
- Phase 6 is glue that depends on everything else

---

## Anti-Patterns to Avoid

### 1. Putting HTTP calls in the Python sidecar

Python sidecar should stay focused on NLP/parsing. Node.js main process handles all network I/O for outreach. Mixing concerns makes the sidecar a monolith.

### 2. Webhook-based architecture for a desktop app

Desktop apps behind NAT/firewalls cannot reliably receive webhooks. Always prefer polling or long-polling for status updates from cloud providers.

### 3. Storing API keys in plaintext

Use Electron's `safeStorage` API which delegates to OS-level credential storage. Never store in settings.json or unencrypted SQLite fields.

### 4. Monolithic ProjectView

The current ProjectView is already getting large. Adding outreach UI into it via conditional rendering will make it unmaintainable. Use nested routes.

### 5. Synchronous state machine transitions

Outreach involves timers (30-min timeout), external API calls, and user input. State transitions must be async and persisted to SQLite so they survive app restarts.

---

## Sources

- Codebase analysis: `src/main/index.ts`, `src/main/database.ts`, `src/main/preload.ts`, `src/renderer/App.tsx`, `src/renderer/routes/ProjectView.tsx`
- `.planning/milestones/02-automated-outreach/ROADMAP-DRAFT.md`
- Training data for: Electron safeStorage API, WASAPI loopback capture, Chrome Native Messaging, voice AI provider patterns
- **Confidence note:** WebSearch was unavailable. Voice AI provider specifics (Vapi, Bland.ai, Retell) and system audio capture npm packages need verification during phase-specific research.
