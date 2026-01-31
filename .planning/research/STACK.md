# Technology Stack: M2 Automated Outreach

**Project:** Samsara - Milestone 2
**Researched:** 2026-01-31
**Research Mode:** Ecosystem (Stack Dimension) -- M2 Additions Only
**Overall confidence:** MEDIUM (web verification tools unavailable; versions based on training data cutoff May 2025 -- verify with `npm info` / `pip index versions` before installing)

---

## Executive Summary

M2 transforms Samsara from a CV processing tool into an automated candidate engagement platform. This requires additions in seven areas: (1) a rich animated wheel navigation, (2) SMS sending, (3) email sending, (4) AI voice calling, (5) system audio recording, (6) call transcription, and (7) ATS browser automation.

The recommended approach uses **Motion** (formerly Framer Motion) for the wheel UI, **Twilio** for SMS, **Nodemailer** for universal email via SMTP, **Bland.ai REST API** for AI voice (no SDK), **Python sidecar with soundcard** for system audio capture, **faster-whisper** for local transcription, and the **already-installed Playwright** for ATS DOM automation. Template management needs no new dependencies.

Total new npm packages: **3** (motion, twilio, nodemailer). Total new Python packages: **4** (soundcard, sounddevice, faster-whisper, pydub). One external binary to bundle: **ffmpeg**.

---

## Recommended Stack Additions

### 1. Samsara Wheel -- Circular Navigation Animation

| Technology                        | Version | Purpose                                                     | Why                                                                                                                                                          |
| --------------------------------- | ------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `motion` (formerly framer-motion) | ^11.x   | Wheel animations: expand, rotate, pulse, radial transitions | Decision already made. Best React animation library -- spring physics, layout animations, gesture support, orchestrated sequences. Nothing else comes close. |

**Confidence:** MEDIUM -- As of early 2025, Framer Motion was transitioning to `motion` on npm. Run `npm info motion` and `npm info framer-motion` to confirm which package name is current.

**Integration:** Pure React renderer addition. No IPC or Python involvement. Install alongside existing Radix UI components.

**What NOT to use:**

- `react-spring` -- less ergonomic for complex orchestrated sequences with staggered children
- CSS-only animations -- insufficient for spring physics, radial layout transitions, gesture-driven interactions
- GSAP -- commercial license concerns, React integration is bolted-on rather than native

---

### 2. SMS Sending

| Technology | Version | Purpose                    | Why                                                                                                   |
| ---------- | ------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `twilio`   | ^5.x    | SMS sending via Twilio API | Industry standard, best documentation, highest deliverability, most recruiters already have accounts. |

**Recommendation: Twilio over MessageBird/Bird**

| Criterion             | Twilio                        | MessageBird (Bird)                      |
| --------------------- | ----------------------------- | --------------------------------------- |
| Node SDK quality      | Excellent, fully typed        | Adequate, less maintained since rebrand |
| Documentation         | Best in class                 | Good but less comprehensive             |
| Pricing               | ~$0.0079/SMS (US)             | ~$0.006/SMS (US)                        |
| Deliverability        | Industry leading              | Good                                    |
| Ecosystem             | Huge (Verify, Lookup, Studio) | Smaller                                 |
| Recruiter familiarity | Very high                     | Lower                                   |

MessageBird is marginally cheaper per message but Twilio wins on SDK quality, documentation, and ecosystem. Since users provide their own API keys, Twilio's ubiquity means they likely already have an account.

**Confidence:** MEDIUM on exact version number. Twilio Node SDK v5 was current as of early 2025.

**Integration:** Electron main process only. Credentials stored encrypted in SQLite. SMS sending must run in main process (not renderer) to avoid CORS issues and keep credentials secure.

```
Renderer -> IPC "sms:send" -> Main process -> Twilio SDK -> Twilio API
                                    |
                              SQLite: log message + delivery status
```

---

### 3. Email Sending

| Technology   | Version | Purpose                               | Why                                                                                                                  |
| ------------ | ------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `nodemailer` | ^6.x    | Email sending via SMTP (any provider) | Universal SMTP support. Users can connect Gmail, Outlook, SendGrid, SES, or any provider. One dependency covers all. |

**Recommendation: Nodemailer over dedicated provider SDKs**

Do NOT install `@sendgrid/mail` or `@aws-sdk/client-ses`. Use Nodemailer with SMTP transport:

| Approach              | Pros                    | Cons                         |
| --------------------- | ----------------------- | ---------------------------- |
| **Nodemailer + SMTP** | Works with ANY provider | Slightly more initial config |
| `@sendgrid/mail`      | Simple API              | Locks to SendGrid only       |
| `@aws-sdk/client-ses` | Direct SES access       | Locks to AWS, massive SDK    |

For a local-first desktop app, users should configure their own SMTP credentials. Nodemailer handles SendGrid SMTP, SES SMTP, Gmail App Passwords, Outlook, and any other provider through a single unified interface.

**Confidence:** HIGH -- Nodemailer is extremely stable. v6.x has been current for years and is the most downloaded email package on npm.

**Integration:** Same pattern as SMS -- main process only, credentials encrypted in SQLite. Use `nodemailer.createTransport()` with user-configured SMTP settings.

---

### 4. AI Voice Calls

| Technology                 | Purpose                | Why                                                                                                                          |
| -------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Bland.ai REST API (no SDK) | AI pre-screening calls | Simplest API for outbound calling. Single POST initiates call with prompt + questions. Built-in recording and transcription. |

**Comparison: Bland.ai vs Vapi vs Retell**

| Criterion            | Bland.ai                      | Vapi                                     | Retell                      |
| -------------------- | ----------------------------- | ---------------------------------------- | --------------------------- |
| Primary use case     | Outbound calling automation   | Voice AI infrastructure                  | Conversational voice agents |
| Outbound call API    | First-class, single REST call | Supported but requires agent setup first | Supported, agent-based      |
| Pricing model        | ~$0.09/min all-inclusive      | ~$0.05/min base + LLM costs              | ~$0.07-0.10/min             |
| Call recording       | Built-in, returns URL         | Built-in                                 | Built-in                    |
| Transcript           | Built-in, structured JSON     | Built-in                                 | Built-in                    |
| SDK needed           | No -- plain REST (fetch)      | `@vapi-ai/server-sdk`                    | `retell-ai-sdk`             |
| Setup complexity     | Lowest                        | Medium                                   | Medium                      |
| Script customization | Prompt + questions as JSON    | Full agent configuration                 | LLM-based agent config      |

**Recommendation: Bland.ai** because:

1. **Simplest API** -- single POST to `/v1/calls` with phone number, prompt, and questions array. No agent creation, no session management.
2. **All-inclusive pricing** -- no surprise LLM costs on top. Vapi's base rate is lower but adds LLM inference costs that can match or exceed Bland.ai's total.
3. **Built-in recording + transcription** -- eliminates needing separate transcription for AI calls.
4. **No SDK dependency** -- use Node's native `fetch()` (available in Electron 40 / Node 20+).

**Confidence:** LOW -- AI voice is the fastest-moving space in this stack. Pricing, API design, and even company viability may have changed since early 2025. **Verify current state of all three providers before committing.** Consider building an abstraction layer so providers can be swapped.

**Integration:**

```
Renderer -> IPC "voice:initiate-call" -> Main process -> fetch() -> Bland.ai API
                                              |
                                        On webhook/poll completion:
                                        - Download recording -> local encrypted storage
                                        - Save transcript -> SQLite
                                        - Update candidate status + screening outcome
```

**No npm package needed.** Store API key encrypted in SQLite settings table.

---

### 5. System Audio Recording

This is the hardest capability in M2. System audio capture is OS-level with no clean cross-platform Node.js solution.

**Recommended approach: Python sidecar extension**

| Platform | Method                           | How It Works                                                                                                           |
| -------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Windows  | WASAPI loopback capture          | Captures audio output device directly. Well-established Windows API. No user setup required.                           |
| macOS    | Virtual audio device + CoreAudio | Requires user to install BlackHole (free, open source) as audio routing device. OS-level restriction -- no workaround. |

| Technology             | Version | Purpose                                   | Why                                                                                   |
| ---------------------- | ------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `soundcard` (Python)   | ^0.4.x  | Cross-platform system audio capture       | Wraps WASAPI (Windows) and CoreAudio (macOS). Pure Python on Windows (uses comtypes). |
| `sounddevice` (Python) | ^0.5.x  | Fallback audio capture via PortAudio      | More mature library. Backup if soundcard has issues on specific hardware.             |
| `pydub` (Python)       | ^0.25.x | Audio format conversion (WAV to OGG/OPUS) | Lightweight wrapper around ffmpeg for compression.                                    |
| `ffmpeg` (binary)      | 6.x+    | Audio encoding backend                    | Required by pydub. Must be bundled with PyInstaller distribution.                     |

**Confidence:** HIGH for Windows (WASAPI loopback is rock-solid). LOW for macOS (virtual audio device requirement adds significant user friction).

**Critical macOS limitation:** macOS does not allow applications to capture system audio output without a virtual audio device. This is an OS-level restriction enforced by SIP and audio sandboxing. Users must install BlackHole (free, open source) as a prerequisite. There is NO pure-software workaround. The app should detect this and guide users through setup.

**Integration:**

```
Renderer -> IPC "recording:start" -> Main process -> Python sidecar command
                                                          |
                                                    soundcard: capture to WAV
                                                          |
                                                    pydub: compress to OGG
                                                          |
Renderer <- IPC "recording:status" <- Main process <- file path + duration
```

**Audio format strategy:** Record as WAV (lossless) during capture, then compress to OGG/OPUS for storage. WAV ensures no quality loss during recording; compression runs after recording stops.

**What NOT to use:**

- `desktopCapturer` (Electron) -- captures tab/window audio only, NOT system audio from external apps (Zoom, Teams, phone apps)
- `node-audiorecorder` -- microphone input only, not system output loopback
- Browser `MediaRecorder` API -- same limitation as desktopCapturer
- `electron-media-service` -- media key integration, not audio capture

---

### 6. Call Transcription (Local)

For recruiter call recordings. AI bot calls (Bland.ai) already return transcripts.

| Technology                | Version | Purpose              | Why                                                                                                          |
| ------------------------- | ------- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `faster-whisper` (Python) | ^1.0.x  | Local speech-to-text | 4x faster than OpenAI Whisper on CPU. CTranslate2 backend. Privacy-preserving -- audio never leaves machine. |

**Recommendation: faster-whisper over alternatives**

| Option                       | Speed (CPU) | Quality   | Privacy             | Bundle Size                 |
| ---------------------------- | ----------- | --------- | ------------------- | --------------------------- |
| **faster-whisper** (local)   | Good        | Excellent | Full                | ~75-500MB (model dependent) |
| `openai` Whisper API (cloud) | Fast        | Excellent | Audio sent to cloud | None                        |
| `whisper` original (local)   | Slow        | Excellent | Full                | Heavy (PyTorch ~2GB)        |
| `vosk` (local)               | Fast        | Good      | Full                | ~50MB                       |

For a local-first recruitment app handling candidate PII, local transcription is the correct default. Offer cloud Whisper API as opt-in for users who prefer speed over privacy.

**Confidence:** MEDIUM -- faster-whisper was actively maintained and widely used as of early 2025.

**Model strategy:**

- Bundle `tiny` model (~75MB) as default for quick previews
- Auto-download `small` (~500MB) or `medium` (~1.5GB) on first use for production-quality transcription
- Let user choose model size in settings (speed vs accuracy tradeoff)

**Integration:** Fits existing Python sidecar pattern. Add to PyInstaller bundle. Transcription runs as background task with progress reporting via IPC.

---

### 7. ATS DOM Bridge

| Technology        | Version | Purpose                                 | Why                                                                                                        |
| ----------------- | ------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `playwright-core` | ^1.58.x | Browser automation for ATS form filling | Playwright already installed as devDependency. Use `playwright-core` (no bundled browsers) for production. |

**Recommendation: Playwright over alternatives**

| Option               | Pros                                                              | Cons                                                                     |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Playwright**       | Already in project, multi-browser, auto-wait, excellent selectors | Needs browser installed                                                  |
| Chrome Extension     | No binary deps, user's auth session inherent                      | Complex to build, Chrome Web Store review, hard to control from Electron |
| Puppeteer            | Similar to Playwright                                             | Chromium-only, Playwright is strictly superior                           |
| Desktop RPA (UiPath) | Powerful                                                          | Heavy, expensive, massive overkill                                       |

**Key insight:** Use `playwright-core` (not `playwright`) for production. Launch with `channel: 'chrome'` to use the user's installed Chrome browser, which:

1. Preserves their ATS login sessions/cookies
2. Avoids bundling 200MB+ Chromium binaries
3. Uses familiar browser the user trusts

**Confidence:** HIGH -- Playwright `^1.58.0` is already in `package.json` as `@playwright/test`.

**Integration:**

```
Renderer -> IPC "ats:fill-form" -> Main process -> playwright-core
                                                       |
                                                  connectOverCDP or launch Chrome
                                                  Navigate to ATS URL
                                                  Fill fields per mapping config (SQLite)
                                                  Screenshot each step for audit
                                                  Report success/failure per field
```

**Install note:** Add `playwright-core` as production dependency (the core library without test runner or bundled browsers). Keep `@playwright/test` as devDependency for E2E tests.

```bash
npm install playwright-core
```

---

### 8. Template Management

**No new dependencies needed.**

Use existing stack:

- **SQLite** (better-sqlite3): Store templates with metadata, per-project scoping
- **React + Radix UI + Tailwind**: Template editor UI
- **Simple regex replacement**: `template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')`

Variable system: `{{candidateName}}`, `{{roleName}}`, `{{companyName}}`, `{{interviewDate}}`, etc.

**What NOT to add:**

- Handlebars / Mustache / EJS -- overkill for 5-10 variable substitutions
- Rich text editor (TipTap, Slate, Draft.js) -- unnecessary for SMS templates and simple HTML emails
- MJML -- email framework for complex marketing layouts, not simple recruitment outreach
- i18n library -- templates ARE the localization (user writes them in whatever language they want)

---

## Full Stack Addition Summary

### npm packages (production dependencies)

```bash
npm install motion twilio nodemailer playwright-core
```

**Total: 4 new packages.**

### Python packages (sidecar -- add to requirements.txt)

```
soundcard>=0.4.0          # System audio capture (WASAPI/CoreAudio)
sounddevice>=0.5.0        # Fallback audio capture (PortAudio)
faster-whisper>=1.0.0     # Local speech-to-text transcription
pydub>=0.25.1             # Audio format conversion
```

**Total: 4 new Python packages.**

### External binaries to bundle (PyInstaller)

| Binary             | Purpose                          | Approx Size |
| ------------------ | -------------------------------- | ----------- |
| ffmpeg             | Audio encoding backend for pydub | ~80MB       |
| Whisper tiny model | Default transcription model      | ~75MB       |

### No SDK needed (use native fetch)

| Service  | Why No SDK                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Bland.ai | Simple REST API. `fetch()` with JSON body is all you need. Adding an SDK creates a dependency on a startup's npm package maintenance. |

---

## Technologies NOT Recommended

| Technology                 | Why Avoid                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@sendgrid/mail`           | Vendor lock-in. Nodemailer covers SendGrid via SMTP plus every other provider.                                      |
| `@aws-sdk/client-ses`      | Massive SDK (100+ packages), vendor lock-in. Nodemailer + SES SMTP is simpler.                                      |
| `messagebird` / `bird` npm | Smaller ecosystem, less recruiter familiarity than Twilio.                                                          |
| `@vapi-ai/server-sdk`      | More complex setup than Bland.ai for outbound-only use case. Consider if inbound/conversational voice needed later. |
| `retell-ai-sdk`            | Mid-range complexity, no clear advantage over Bland.ai for outbound screening.                                      |
| `openai` (for Whisper API) | Sends candidate call audio to cloud. Violates local-first principle. Offer as opt-in only.                          |
| Electron `desktopCapturer` | Cannot capture system audio from external apps (Teams, Zoom). Only captures Electron window audio.                  |
| Puppeteer                  | Chromium-only. Playwright supports all browsers and is already installed.                                           |
| Chrome Extension (for ATS) | High dev cost, Chrome Web Store review delays, difficult Electron integration.                                      |
| GSAP                       | Commercial license ($99+/yr), bolted-on React integration vs Motion's native approach.                              |
| Handlebars/Mustache        | Template engines solving a problem that `String.replace()` handles in 2 lines.                                      |
| `react-spring`             | Less capable than Motion for orchestrated multi-element sequences.                                                  |

---

## Integration Architecture

All new capabilities follow the existing Electron IPC pattern. No architectural changes to the app structure.

```
[Renderer / React]
      |
      | IPC invoke (typed channels)
      v
[Electron Main Process]
      |
      |-- twilio SDK -----------> Twilio API ---------> SMS to candidate
      |-- nodemailer ------------> SMTP server --------> Email to candidate
      |-- fetch() ---------------> Bland.ai API -------> AI voice call
      |-- playwright-core -------> Chrome browser -----> ATS form filling
      |-- Python sidecar -------> soundcard ----------> System audio capture
      |                     |---> faster-whisper ------> Transcription
      |                     |---> pydub + ffmpeg ------> Audio compression
      |
      v
[SQLite via better-sqlite3]
  - API credentials (encrypted)
  - Message templates (per-project)
  - Outreach history (SMS, email, call logs)
  - Call recordings (file paths to local encrypted storage)
  - Transcripts (full text, searchable)
  - ATS field mappings (per-vendor configs)
  - Candidate status tracking
```

### Credential Security

All API keys and SMTP credentials:

- Stored encrypted in SQLite (use `crypto.createCipheriv` in main process)
- Never exposed to renderer process via IPC
- Main process acts as secure gateway for all external API calls
- User configures credentials in settings UI; values sent via IPC to main for encryption + storage

### New SQLite Tables Required

```sql
-- Outreach templates
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  type TEXT CHECK(type IN ('sms', 'email', 'call_script')),
  name TEXT NOT NULL,
  subject TEXT,              -- email subject (null for SMS)
  body TEXT NOT NULL,         -- template with {{variables}}
  variables TEXT,             -- JSON array of variable names
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Outreach message log
CREATE TABLE outreach_log (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  project_id TEXT,
  channel TEXT CHECK(channel IN ('sms', 'email', 'voice_call')),
  template_id TEXT,
  status TEXT,                -- sent, delivered, failed, replied
  provider_id TEXT,           -- Twilio SID, Bland.ai call_id, etc.
  content TEXT,               -- rendered message content
  metadata TEXT,              -- JSON: delivery receipts, timestamps
  created_at TEXT DEFAULT (datetime('now'))
);

-- Call recordings
CREATE TABLE recordings (
  id TEXT PRIMARY KEY,
  candidate_id TEXT,
  type TEXT CHECK(type IN ('ai_screening', 'recruiter_call')),
  file_path TEXT NOT NULL,    -- local encrypted file
  duration_seconds INTEGER,
  transcript TEXT,            -- full transcript text
  transcript_segments TEXT,   -- JSON: timestamped segments
  consent_captured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ATS field mappings
CREATE TABLE ats_mappings (
  id TEXT PRIMARY KEY,
  ats_vendor TEXT NOT NULL,   -- bullhorn, jobadder, vincere, etc.
  field_name TEXT NOT NULL,   -- ATS form field identifier
  source_field TEXT NOT NULL, -- Samsara data field (cv.name, cv.email, etc.)
  selector TEXT,              -- DOM selector for Playwright
  field_type TEXT,            -- text, dropdown, checkbox, date
  metadata TEXT,              -- JSON: dropdown options, validation rules
  created_at TEXT DEFAULT (datetime('now'))
);

-- Provider credentials (encrypted)
CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,     -- twilio, smtp, bland_ai
  key_name TEXT NOT NULL,     -- account_sid, auth_token, api_key, etc.
  encrypted_value TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## Phase-Specific Stack Usage

| M2 Phase                              | Stack Additions Used                                                       |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Phase 1: Communication Infrastructure | twilio, nodemailer, SQLite tables (templates, credentials, outreach_log)   |
| Phase 2: Outreach Workflow Engine     | No new deps -- workflow logic in TypeScript, uses Phase 1 infrastructure   |
| Phase 3: AI Voice Integration         | fetch() to Bland.ai, SQLite tables (recordings)                            |
| Phase 4: Recruiter Scheduling Bot     | No new deps -- NLP via existing LLM integration or simple intent matching  |
| Phase 5: Call Recording               | soundcard, sounddevice, pydub, ffmpeg (Python sidecar)                     |
| Phase 6: Call Transcription           | faster-whisper (Python sidecar)                                            |
| Phase 7: ATS DOM Bridge               | playwright-core, SQLite tables (ats_mappings)                              |
| Phase 8: Client Submission            | No new deps -- uses existing email (nodemailer) + PDF generation (from M1) |
| Samsara Wheel (UI)                    | motion -- can be implemented in any phase, independent of backend          |

---

## Confidence Assessment

| Area                                 | Confidence | Notes                                                                                                  |
| ------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------ |
| Motion for wheel animation           | HIGH       | Consensus best React animation library. Verify package name (motion vs framer-motion).                 |
| Twilio for SMS                       | HIGH       | Industry standard, stable SDK.                                                                         |
| Nodemailer for email                 | HIGH       | Extremely stable, universal SMTP support.                                                              |
| Bland.ai for AI voice                | LOW        | Fast-moving space. Verify pricing, API, and company status before committing. Build abstraction layer. |
| soundcard for system audio (Windows) | MEDIUM     | WASAPI loopback is proven. Verify soundcard library maintenance status.                                |
| soundcard for system audio (macOS)   | LOW        | Requires BlackHole virtual device. User friction is high. May need dedicated macOS research.           |
| faster-whisper for transcription     | MEDIUM     | Was actively maintained. Verify current version and CTranslate2 compatibility.                         |
| Playwright for ATS bridge            | HIGH       | Already installed. Well-documented `channel: 'chrome'` feature.                                        |
| Template management (no deps)        | HIGH       | Simple string replacement, no library needed.                                                          |

---

## Open Questions for Phase-Specific Research

1. **Motion package name:** Is it `motion` or still `framer-motion` on npm? Verify with `npm info motion` before install.
2. **Bland.ai current state:** Verify API, pricing, and availability. Also check if Vapi or Retell have improved their outbound-calling simplicity.
3. **macOS audio capture:** Investigate alternatives to BlackHole. Is there a way to streamline the setup? Consider whether macOS recording is MVP or deferred.
4. **faster-whisper model bundling:** How to bundle CTranslate2 models with PyInstaller without bloating the installer? On-demand download may be better.
5. **ffmpeg bundling:** Size impact on PyInstaller distribution. Consider ffmpeg-python vs subprocess calls.
6. **Playwright browser detection:** Verify that `channel: 'chrome'` reliably finds user's Chrome installation on both Windows and macOS.
7. **Credential encryption:** Choose encryption approach -- Node `crypto` module with device-bound key, or OS keychain (Keytar/electron-keychain)?

---

## Sources

### High Confidence (verified from project)

- `package.json`: Electron 40, React 19.2, Playwright ^1.58.0 already installed
- `.planning/milestones/02-automated-outreach/ROADMAP-DRAFT.md`: Phase structure and requirements

### Medium Confidence (training data, stable libraries)

- Nodemailer: https://nodemailer.com/ -- extremely stable, unlikely to have changed
- Twilio Node SDK: https://www.twilio.com/docs/libraries/node
- Playwright: https://playwright.dev/docs/api/class-browsertype#browser-type-launch
- faster-whisper: https://github.com/SYSTRAN/faster-whisper
- soundcard: https://github.com/bastibe/SoundCard

### Low Confidence (training data, fast-moving space -- verify before use)

- Bland.ai: https://docs.bland.ai/ -- API and pricing may have changed
- Vapi: https://docs.vapi.ai/ -- may have improved since training data
- Retell: https://docs.retellai.com/ -- may have improved since training data
- Motion (framer-motion): https://motion.dev/ -- package name transition status unclear
