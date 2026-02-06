---
phase: 12
plan: 01
subsystem: audio-recording
tags: [wasapi, pyaudiowpatch, dual-stream, recording, ipc]

dependency_graph:
  requires: [phase-11]
  provides: [python-audio-capture, electron-recording-service, recording-ipc]
  affects: [12-02]

tech-stack:
  added:
    - pyaudiowpatch: ">=0.2.13"
    - faster-whisper: ">=1.0.0"
  patterns:
    - dual-stream-capture: "WASAPI loopback + mic -> mixed WAV"
    - recording-state-machine: "idle -> recording -> stopped -> idle"
    - level-callback-streaming: "Real-time audio levels via JSON stdout"

file-tracking:
  created:
    - python-src/audio/__init__.py
    - python-src/audio/capture.py
    - python-src/audio/recorder.py
    - src/main/audioRecordingService.ts
  modified:
    - python-src/main.py
    - python-src/requirements.txt
    - src/main/database.ts
    - src/main/index.ts
    - src/main/preload.ts

decisions:
  - key: dual-stream-mixing
    choice: "Average loopback + mic with clipping prevention"
    rationale: "Simple, prevents distortion, both parties audible"
  - key: target-sample-rate
    choice: "16kHz mono"
    rationale: "Whisper optimal input format, reduces file size"
  - key: level-streaming
    choice: "JSON stdout with type='level'"
    rationale: "Non-blocking, fits existing Python IPC pattern"
  - key: session-singleton
    choice: "Module-level recording_session in Python"
    rationale: "Single recording at a time, simple state management"

metrics:
  duration: "9 min"
  completed: "2026-02-06"
---

# Phase 12 Plan 01: Audio Capture Infrastructure - Summary

Python sidecar WASAPI loopback + mic capture with Electron IPC layer for recruiter call recording.

## One-Liner

Dual-stream audio capture via pyaudiowpatch (WASAPI loopback + mic) with 16kHz mono mixing, recording state machine, and Electron IPC handlers for start/stop/attach lifecycle.

## What Was Built

### Python Audio Module (`python-src/audio/`)

1. **DualStreamCapture** (`capture.py`)
   - WASAPI loopback capture via pyaudiowpatch (system audio)
   - Microphone capture via standard PyAudio stream
   - Non-blocking stream_callback mode for both streams
   - Linear resampling from device sample rate to 16kHz
   - Audio mixing: float32 average with int16 clipping
   - level_callback for real-time UI visualization
   - Graceful fallback when loopback unavailable (mic-only mode)

2. **RecordingSession** (`recorder.py`)
   - State machine: idle -> recording -> stopped
   - Session ID generation (UUID)
   - Duration tracking
   - Device availability check
   - Cleanup/reset methods

### Python Sidecar Actions (`main.py`)

- `start_recording`: Start capture with output_path, streams level updates
- `stop_recording`: Stop capture, save WAV, return duration
- `get_recording_state`: Current state, session ID, duration
- `check_audio_devices`: Loopback/mic availability info

### Electron Recording Service (`audioRecordingService.ts`)

- `startRecording()`: Generate session ID, call Python sidecar
- `stopRecording()`: Stop capture, return audio path and duration
- `getRecordingState()`: Current state with live duration
- `attachRecording(candidateId, projectId)`: Create call_record in DB
- `discardRecording()`: Delete temp file, reset session
- `checkAudioDevices()`: Query Python for device info
- Level callback system for forwarding to renderer

### Database Migration v10

```sql
ALTER TABLE call_records ADD COLUMN transcription_status TEXT;
ALTER TABLE call_records ADD COLUMN transcription_error TEXT;
```

### IPC Handlers (6 new endpoints)

| Handler               | Purpose                                |
| --------------------- | -------------------------------------- |
| `start-recording`     | Start WASAPI loopback + mic capture    |
| `stop-recording`      | Stop and save to WAV                   |
| `get-recording-state` | Get current state/duration             |
| `attach-recording`    | Link to candidate, queue transcription |
| `discard-recording`   | Delete temp file                       |
| `check-audio-devices` | Device availability                    |

## Technical Decisions

| Decision        | Choice            | Rationale                                            |
| --------------- | ----------------- | ---------------------------------------------------- |
| Audio library   | pyaudiowpatch     | Only maintained library with WASAPI loopback support |
| Sample rate     | 16kHz mono        | Whisper optimal format, small file size              |
| Mixing strategy | Average (not sum) | Prevents clipping, both parties audible              |
| State machine   | Python-side       | Keeps recording logic with audio capture             |
| Level streaming | JSON type="level" | Fits existing IPC pattern, non-blocking              |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash    | Description                                      |
| ------- | ------------------------------------------------ |
| e6207e0 | Python audio capture module with WASAPI loopback |
| 100b208 | Python sidecar recording actions                 |
| e1e0f45 | Electron recording service and IPC handlers      |

## Verification Results

1. Python imports work:

   ```
   from audio import DualStreamCapture, RecordingSession  # OK
   ```

2. Recording pattern works:

   ```python
   session = RecordingSession()
   session.get_state()  # {'state': 'idle'}
   session.check_devices()  # Device availability
   ```

3. TypeScript compiles: No new errors in modified files

4. IPC handlers registered: `start-recording` handler found in index.ts

## Next Phase Readiness

**Ready for 12-02 (Transcription Integration):**

- [x] Recording produces 16kHz mono WAV (Whisper input format)
- [x] call_records table has transcription_status/transcription_error columns
- [x] attachRecording sets transcription_status='queued'
- [x] Audio file path stored in recording_path column
- [ ] faster-whisper transcription (Plan 02)
- [ ] Transcription job queue (Plan 02)
- [ ] Transcript viewer integration (Plan 02)

**Dependencies:**

- pyaudiowpatch must be installed for actual recording (mocked for imports)
- faster-whisper already added to requirements.txt for Plan 02
