# Phase 12: System Audio Recording & Transcription - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Recruiters can record their own calls via system audio capture (Windows WASAPI) and get local transcriptions (faster-whisper) attached to candidate records. This covers recruiter-initiated calls — AI-initiated calls and ATS integration are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Recording Controls

- Floating control panel, draggable by user — accessible from any wheel section
- Default expanded, minimizes to side tray (same area as project navigation)
- Quick-open from tray to start recording on the fly
- Simple waveform visualization for audio level meter
- Red pulsing dot indicator when recording is active

### Audio Capture Scope

- Capture both system audio (loopback) AND microphone input
- Mix into single audio file (not separate tracks)
- User must attach recording to candidate OR delete it before starting new recording
- Flow: Record → Stop → Select candidate → Push → Auto-refresh panel → Ready to record again

### Candidate Selection

- Recording panel includes candidate search
- Defaults to current project, can switch project within panel
- Only graduated candidates (in outreach) appear in search
- Can select candidate before OR after recording

### Transcription Workflow

- Transcription starts immediately when recording is pushed to candidate
- Runs in background — user can record new calls concurrently
- Toast notification on completion (no progress bar)
- Toast error + retry button on failure

### Transcript Attachment

- Candidates can have multiple call recordings/transcripts
- AI screening calls and recruiter calls are distinguished by:
  - Color coding (different accent color)
  - Label/badge ("AI Screening" vs "Recruiter Call")
- Speaker diarization if technically feasible (faster-whisper dependent)
- Audio files deleted after successful transcription (save disk space)

### Claude's Discretion

- Exact floating panel dimensions and styling
- Waveform visualization implementation details
- Tray minimize/expand animation
- How to handle edge cases (recording in progress when app closes)
- Diarization fallback if not supported by faster-whisper

</decisions>

<specifics>
## Specific Ideas

- "Should be accessible regardless of where in a project they are" — hence floating panel
- Flow is explicit: record → stop → attach → push → refresh → ready
- No orphan recordings — must attach or delete before next recording
- Keeping audio would take too much space for hundreds of candidates — delete after transcription

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 12-system-audio-transcription_
_Context gathered: 2026-02-05_
