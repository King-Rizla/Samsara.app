---
phase: 11-ai-voice-screening
plan: 02
subsystem: voice-settings
tags: [elevenlabs, credentials, screening-criteria, settings-ui, vox-02, vox-04]

# Dependency graph
requires:
  - phase: 11-01
    provides: voiceService, credentialManager elevenlabs support, screening_scripts table
  - phase: 09-communication-infrastructure
    provides: CommunicationSettings pattern, IPC credential handlers
provides:
  - VoiceSettings UI component for ElevenLabs credential configuration
  - ScreeningService for criteria and system prompt management
  - DEFAULT_SCREENING_SYSTEM_PROMPT with VOX-02 and VOX-04 requirements
  - SettingsView combining Communication and Voice tabs
affects: [11-03-transcript-analysis, future-voice-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Screening criteria stored in screening_scripts table"
    - "System prompt override via ElevenLabs overrides.agent.prompt.prompt"
    - "Credential fallback: project-specific -> global for agent_id/phone_number_id"

key-files:
  created:
    - src/main/screeningService.ts
    - src/renderer/components/settings/VoiceSettings.tsx
    - src/renderer/components/settings/SettingsView.tsx
  modified:
    - src/main/voiceService.ts
    - src/main/index.ts
    - src/main/preload.ts

key-decisions:
  - "VOX-02: 5 fixed screening questions baked into DEFAULT_SCREENING_SYSTEM_PROMPT"
  - "VOX-04: Positive close message (recruiter follow-up) in system prompt"
  - "System prompt passed via overrides.agent.prompt.prompt to every call"
  - "SettingsView combines Communication and Voice tabs for project settings"

patterns-established:
  - "Screening criteria: salaryMin/Max, locations, noticePeriod, availability, workAuth"
  - "Tab pattern: SettingsView with tabbed sub-settings components"

# Metrics
duration: 15min
completed: 2026-02-05
---

# Phase 11 Plan 02: Voice Settings and Screening Criteria Summary

**VoiceSettings UI for ElevenLabs credentials plus screening criteria configuration with VOX-02/VOX-04 system prompt**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-05T14:15:00Z
- **Completed:** 2026-02-05T14:30:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Created screeningService.ts with criteria CRUD and DEFAULT_SCREENING_SYSTEM_PROMPT
- VOX-02 requirement: System prompt includes all 5 fixed screening questions
- VOX-04 requirement: System prompt includes positive close about recruiter follow-up
- VoiceSettings.tsx with ElevenLabs credential inputs and Test Connection button
- SettingsView.tsx combining Communication and Voice tabs
- voiceService.ts now loads screening script and passes system prompt to ElevenLabs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create screening service for criteria management** - `cabc0eb` (feat)
2. **Task 2: Create VoiceSettings component** - `abec28b` (feat)
3. **Task 3: Wire screening script to voice service** - `63b8e39` (feat)

## Files Created/Modified

**Created:**

- `src/main/screeningService.ts` - Screening criteria and system prompt management
- `src/renderer/components/settings/VoiceSettings.tsx` - ElevenLabs credentials and screening criteria UI
- `src/renderer/components/settings/SettingsView.tsx` - Tabbed settings combining Communication and Voice

**Modified:**

- `src/main/voiceService.ts` - Import getScreeningScript, pass system prompt override
- `src/main/index.ts` - IPC handlers for screening criteria and ElevenLabs test
- `src/main/preload.ts` - Exposed screening service methods to renderer

## VOX-02 and VOX-04 Compliance

**VOX-02 (5 Fixed Screening Questions):**
The DEFAULT_SCREENING_SYSTEM_PROMPT includes all 5 required questions:

1. "What is your current salary or salary expectation for this role?"
2. "Are you open to working in {{job_location}} or do you have location preferences?"
3. "What is your notice period with your current employer?"
4. "What is your availability for interviews this week or next?"
5. "Are you authorized to work in this location, or would you need visa sponsorship?"

**VOX-04 (Positive Close):**
System prompt includes: "One of our recruiters will be in touch shortly to discuss the role in more detail."

## Decisions Made

- **System prompt override:** Passed via `overrides.agent.prompt.prompt` in ElevenLabs API call to ensure every call uses the screening prompt regardless of agent configuration
- **Criteria injection:** buildDynamicVariables now accepts criteria from screeningService, falling back to call params if provided
- **Settings organization:** SettingsView combines Communication (Twilio/SMTP) and Voice (ElevenLabs) tabs

## Deviations from Plan

None - plan executed exactly as written.

## IPC Handlers Added

| Handler                       | Purpose                                    |
| ----------------------------- | ------------------------------------------ |
| `get-screening-criteria`      | Retrieve criteria for a project            |
| `save-screening-criteria`     | Store/update criteria for a project        |
| `get-screening-script`        | Get full script (criteria + system prompt) |
| `save-screening-script`       | Store script with optional overrides       |
| `test-elevenlabs-credentials` | Test ElevenLabs API connection             |

## Next Phase Readiness

- Voice settings UI complete, credentials can be configured
- Screening criteria can be set per project
- System prompt with VOX-02/VOX-04 is passed to all calls
- Ready for Plan 11-03: Transcript analysis with Claude

---

_Phase: 11-ai-voice-screening_
_Completed: 2026-02-05_
