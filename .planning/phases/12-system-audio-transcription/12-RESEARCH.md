# Phase 12: System Audio Recording & Transcription - Research

**Researched:** 2026-02-06
**Domain:** Windows WASAPI audio capture, audio mixing, faster-whisper transcription, Python sidecar integration
**Confidence:** HIGH

## Summary

Phase 12 enables recruiters to record their own calls via system audio capture (Windows WASAPI loopback + microphone) and get local transcriptions attached to candidate records. This complements Phase 11's AI-initiated screening calls by supporting recruiter-initiated calls.

The key technical challenges are:

1. **Dual audio capture** - Recording both system audio (remote party) and microphone (recruiter) simultaneously on Windows
2. **Audio mixing** - Combining two audio streams into a single file suitable for transcription
3. **Local transcription** - Running faster-whisper in the Python sidecar without blocking CV parsing
4. **UI controls** - Floating recording panel with level meter accessible from any wheel section

The recommended stack is **PyAudioWPatch** for WASAPI loopback capture + standard PyAudio for microphone, **NumPy** for audio mixing, and **faster-whisper** for local transcription. This is all Windows-specific and runs entirely on-device.

**Primary recommendation:** Use PyAudioWPatch 0.2.13+ for WASAPI loopback, open two parallel streams (loopback + microphone), mix with NumPy, save as WAV, transcribe with faster-whisper small/base model on CPU. Speaker diarization is possible via WhisperX but adds complexity and HuggingFace token requirement.

## Standard Stack

### Core

| Library          | Version | Purpose                 | Why Standard                                                                |
| ---------------- | ------- | ----------------------- | --------------------------------------------------------------------------- |
| `pyaudiowpatch`  | 0.2.13+ | WASAPI loopback capture | Only maintained PyAudio fork with loopback support; prebuilt Windows wheels |
| `faster-whisper` | 1.2.x   | Local speech-to-text    | 4x faster than OpenAI Whisper; CPU-friendly; no external dependencies       |
| `numpy`          | 1.24+   | Audio mixing/processing | Standard for audio buffer manipulation; already in project                  |

### Supporting

| Library       | Version   | Purpose         | When to Use                                                 |
| ------------- | --------- | --------------- | ----------------------------------------------------------- |
| `wave`        | stdlib    | WAV file I/O    | Write mixed audio to disk; read for transcription           |
| `av`          | (bundled) | Audio decoding  | Bundled with faster-whisper; handles format conversion      |
| `ctranslate2` | 4.x       | Whisper backend | Installed with faster-whisper; provides optimized inference |

### Alternatives Considered

| Instead of        | Could Use            | Tradeoff                                                                                  |
| ----------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| PyAudioWPatch     | sounddevice          | sounddevice lacks WASAPI loopback support                                                 |
| PyAudioWPatch     | soundcard            | Less mature; fewer examples                                                               |
| faster-whisper    | whisper.cpp          | Requires separate binary; harder to integrate with Python sidecar                         |
| faster-whisper    | OpenAI Whisper       | 4x slower; higher memory usage                                                            |
| CPU transcription | GPU transcription    | GPU (CUDA) requires complex PyInstaller bundling; CPU is sufficient for short calls       |
| No diarization    | WhisperX diarization | WhisperX requires HuggingFace token; adds pyannote dependency; overkill for 2-party calls |

**Installation (Python sidecar):**

```bash
pip install pyaudiowpatch faster-whisper numpy
```

## Architecture Patterns

### Recommended Project Structure

```
python-src/
├── main.py                    # MODIFY: Add record_audio, transcribe_audio actions
├── audio/
│   ├── __init__.py
│   ├── capture.py             # NEW: WASAPI loopback + mic capture
│   ├── mixer.py               # NEW: Dual-stream audio mixing
│   └── recorder.py            # NEW: Coordinated recording state machine

src/main/
├── audioRecordingService.ts   # NEW: IPC handlers, recording state, file management
├── transcriptionService.ts    # NEW: Sidecar transcription requests, job queue
├── preload.ts                 # MODIFY: Expose recording APIs

src/renderer/
├── components/
│   ├── recording/
│   │   ├── RecordingPanel.tsx      # NEW: Floating draggable panel
│   │   ├── RecordingControls.tsx   # NEW: Start/stop, level meter
│   │   ├── RecordingTray.tsx       # NEW: Minimized tray icon
│   │   └── CandidateSelect.tsx     # NEW: Attach recording to candidate
│   ├── outreach/
│   │   └── CandidatePanel.tsx      # MODIFY: Show recruiter calls (different color)
├── stores/
│   └── recordingStore.ts           # NEW: Recording state, candidate selection
```

### Pattern 1: Dual-Stream Audio Capture (Python)

**What:** Capture system audio and microphone simultaneously using two PyAudioWPatch streams
**When to use:** When recording starts
**Source:** [PyAudioWPatch GitHub](https://github.com/s0d3s/PyAudioWPatch)

```python
# python-src/audio/capture.py
import pyaudiowpatch as pyaudio
import numpy as np
import wave
import threading
from typing import Optional, Callable
import time

class DualStreamCapture:
    """
    Captures both WASAPI loopback (system audio) and microphone input.
    Mixes them into a single audio stream for transcription.
    """

    CHUNK = 1024
    FORMAT = pyaudio.paInt16
    CHANNELS = 1  # Mono output for transcription
    RATE = 16000  # Whisper prefers 16kHz

    def __init__(self):
        self.p = pyaudio.PyAudio()
        self.loopback_stream: Optional[pyaudio.Stream] = None
        self.mic_stream: Optional[pyaudio.Stream] = None
        self.is_recording = False
        self.frames = []
        self.lock = threading.Lock()
        self.level_callback: Optional[Callable[[float, float], None]] = None

        # Device indices
        self.loopback_device = None
        self.mic_device = None
        self._discover_devices()

    def _discover_devices(self):
        """Find WASAPI loopback and default microphone devices."""
        try:
            # Get default WASAPI loopback (speaker output)
            self.loopback_device = self.p.get_default_wasapi_loopback()
            print(f"[Capture] Loopback device: {self.loopback_device['name']}")
        except Exception as e:
            print(f"[Capture] No loopback device found: {e}")
            self.loopback_device = None

        # Get default microphone
        try:
            self.mic_device = self.p.get_default_input_device_info()
            print(f"[Capture] Mic device: {self.mic_device['name']}")
        except Exception as e:
            print(f"[Capture] No mic device found: {e}")
            self.mic_device = None

    def start_recording(self, level_callback: Optional[Callable] = None):
        """Start recording from both devices."""
        if self.is_recording:
            return False

        self.level_callback = level_callback
        self.frames = []
        self.is_recording = True

        # Start loopback stream if available
        if self.loopback_device:
            self.loopback_stream = self.p.open(
                format=self.FORMAT,
                channels=self.loopback_device['maxInputChannels'],
                rate=int(self.loopback_device['defaultSampleRate']),
                input=True,
                input_device_index=self.loopback_device['index'],
                frames_per_buffer=self.CHUNK,
                stream_callback=self._loopback_callback
            )

        # Start microphone stream
        if self.mic_device:
            self.mic_stream = self.p.open(
                format=self.FORMAT,
                channels=1,
                rate=self.RATE,
                input=True,
                input_device_index=self.mic_device['index'],
                frames_per_buffer=self.CHUNK,
                stream_callback=self._mic_callback
            )

        return True

    def _loopback_callback(self, in_data, frame_count, time_info, status):
        """Callback for loopback stream - system audio."""
        if self.is_recording:
            # Convert to mono if stereo
            audio_data = np.frombuffer(in_data, dtype=np.int16)
            if self.loopback_device and self.loopback_device['maxInputChannels'] > 1:
                # Average stereo to mono
                audio_data = audio_data.reshape(-1, 2).mean(axis=1).astype(np.int16)

            # Resample if needed (loopback often 44.1kHz/48kHz, Whisper wants 16kHz)
            if self.loopback_device:
                src_rate = int(self.loopback_device['defaultSampleRate'])
                if src_rate != self.RATE:
                    audio_data = self._resample(audio_data, src_rate, self.RATE)

            with self.lock:
                self.frames.append(('loopback', audio_data))

            # Calculate level for UI
            if self.level_callback:
                level = np.abs(audio_data).mean() / 32768.0
                self.level_callback('loopback', level)

        return (None, pyaudio.paContinue)

    def _mic_callback(self, in_data, frame_count, time_info, status):
        """Callback for microphone stream."""
        if self.is_recording:
            audio_data = np.frombuffer(in_data, dtype=np.int16)

            with self.lock:
                self.frames.append(('mic', audio_data))

            if self.level_callback:
                level = np.abs(audio_data).mean() / 32768.0
                self.level_callback('mic', level)

        return (None, pyaudio.paContinue)

    def _resample(self, audio: np.ndarray, src_rate: int, dst_rate: int) -> np.ndarray:
        """Simple linear resampling."""
        duration = len(audio) / src_rate
        target_length = int(duration * dst_rate)
        return np.interp(
            np.linspace(0, len(audio) - 1, target_length),
            np.arange(len(audio)),
            audio
        ).astype(np.int16)

    def stop_recording(self, output_path: str) -> bool:
        """Stop recording and save mixed audio to file."""
        if not self.is_recording:
            return False

        self.is_recording = False

        # Stop streams
        if self.loopback_stream:
            self.loopback_stream.stop_stream()
            self.loopback_stream.close()
        if self.mic_stream:
            self.mic_stream.stop_stream()
            self.mic_stream.close()

        # Mix audio
        mixed = self._mix_frames()
        if mixed is None or len(mixed) == 0:
            return False

        # Save to WAV
        try:
            with wave.open(output_path, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)  # 16-bit
                wf.setframerate(self.RATE)
                wf.writeframes(mixed.tobytes())
            return True
        except Exception as e:
            print(f"[Capture] Failed to save: {e}")
            return False

    def _mix_frames(self) -> Optional[np.ndarray]:
        """Mix loopback and mic frames into single audio stream."""
        with self.lock:
            if not self.frames:
                return None

            # Separate by source
            loopback_frames = [f[1] for f in self.frames if f[0] == 'loopback']
            mic_frames = [f[1] for f in self.frames if f[0] == 'mic']

            # Concatenate each source
            loopback_audio = np.concatenate(loopback_frames) if loopback_frames else np.array([], dtype=np.int16)
            mic_audio = np.concatenate(mic_frames) if mic_frames else np.array([], dtype=np.int16)

            # Align lengths
            max_len = max(len(loopback_audio), len(mic_audio))
            if len(loopback_audio) < max_len:
                loopback_audio = np.pad(loopback_audio, (0, max_len - len(loopback_audio)))
            if len(mic_audio) < max_len:
                mic_audio = np.pad(mic_audio, (0, max_len - len(mic_audio)))

            # Mix (average with clipping prevention)
            mixed = (loopback_audio.astype(np.float32) + mic_audio.astype(np.float32)) / 2
            mixed = np.clip(mixed, -32768, 32767).astype(np.int16)

            return mixed

    def cleanup(self):
        """Release audio resources."""
        if self.p:
            self.p.terminate()
```

### Pattern 2: Faster-Whisper Transcription (Python)

**What:** Transcribe audio file using faster-whisper with VAD filtering
**When to use:** After recording is attached to candidate
**Source:** [faster-whisper GitHub](https://github.com/SYSTRAN/faster-whisper)

```python
# python-src/audio/transcriber.py
from faster_whisper import WhisperModel
from typing import Optional, List, Dict, Any
import os

class LocalTranscriber:
    """
    Local speech-to-text using faster-whisper.
    Runs on CPU for simplicity (no CUDA bundling needed).
    """

    def __init__(self, model_size: str = "small"):
        """
        Initialize transcription model.

        model_size options:
        - "tiny" - Fastest, lowest accuracy (~70% WER reduction vs large)
        - "base" - Good balance for short calls
        - "small" - Recommended for call transcription
        - "medium" - Higher accuracy, slower
        - "large-v3" - Best accuracy, requires more RAM
        """
        self.model_size = model_size
        self.model: Optional[WhisperModel] = None
        self._loaded = False

    def _ensure_loaded(self):
        """Lazy-load model on first use."""
        if self._loaded:
            return

        print(f"[Transcriber] Loading faster-whisper {self.model_size}...")

        # CPU with INT8 quantization for efficiency
        # compute_type options: int8, int8_float16, float16, float32
        self.model = WhisperModel(
            self.model_size,
            device="cpu",
            compute_type="int8",
            download_root=self._get_model_dir()
        )

        self._loaded = True
        print(f"[Transcriber] Model loaded")

    def _get_model_dir(self) -> str:
        """Get model cache directory."""
        # Use app data directory for model storage
        cache_dir = os.environ.get('SAMSARA_MODEL_DIR')
        if cache_dir:
            return cache_dir

        # Fallback to user's home directory
        return os.path.join(os.path.expanduser('~'), '.samsara', 'models')

    def transcribe(self, audio_path: str, language: str = "en") -> Dict[str, Any]:
        """
        Transcribe audio file.

        Returns:
            {
                "text": str,  # Full transcript
                "segments": [{"start": float, "end": float, "text": str}],
                "language": str,
                "duration": float
            }
        """
        self._ensure_loaded()

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        try:
            # Transcribe with VAD filtering to skip silence
            segments, info = self.model.transcribe(
                audio_path,
                beam_size=5,
                language=language,
                vad_filter=True,
                vad_parameters={
                    "min_silence_duration_ms": 500,
                    "speech_pad_ms": 200
                },
                word_timestamps=False,  # Segment-level is enough
                condition_on_previous_text=True
            )

            # Collect segments (generator)
            segment_list = []
            full_text_parts = []

            for segment in segments:
                segment_list.append({
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": segment.text.strip()
                })
                full_text_parts.append(segment.text.strip())

            return {
                "text": " ".join(full_text_parts),
                "segments": segment_list,
                "language": info.language,
                "duration": round(info.duration, 2)
            }

        except Exception as e:
            print(f"[Transcriber] Transcription failed: {e}")
            raise

    def is_available(self) -> bool:
        """Check if transcription is available (model can be loaded)."""
        try:
            self._ensure_loaded()
            return True
        except Exception as e:
            print(f"[Transcriber] Model not available: {e}")
            return False
```

### Pattern 3: Recording State Machine (TypeScript)

**What:** Manage recording lifecycle with clear state transitions
**When to use:** Enforce the flow: Record -> Stop -> Select Candidate -> Push

```typescript
// src/main/audioRecordingService.ts
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { getDatabase } from "./database";
import { sendToSidecar } from "./sidecarManager";
import crypto from "crypto";

type RecordingState = "idle" | "recording" | "stopped" | "attaching";

interface RecordingSession {
  id: string;
  state: RecordingState;
  startedAt: string;
  stoppedAt?: string;
  audioPath?: string;
  candidateId?: string;
  projectId?: string;
}

let currentSession: RecordingSession | null = null;

/**
 * Get temp directory for recordings.
 */
function getTempDir(): string {
  const tempDir = path.join(app.getPath("temp"), "samsara-recordings");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

/**
 * Start recording system audio + microphone.
 */
export async function startRecording(): Promise<{
  success: boolean;
  sessionId?: string;
  error?: string;
}> {
  if (currentSession && currentSession.state === "recording") {
    return { success: false, error: "Recording already in progress" };
  }

  const sessionId = crypto.randomUUID();
  const audioPath = path.join(getTempDir(), `recording-${sessionId}.wav`);

  // Request Python sidecar to start recording
  const result = await sendToSidecar({
    action: "start_recording",
    id: sessionId,
    output_path: audioPath,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error || "Failed to start recording",
    };
  }

  currentSession = {
    id: sessionId,
    state: "recording",
    startedAt: new Date().toISOString(),
    audioPath,
  };

  return { success: true, sessionId };
}

/**
 * Stop recording.
 */
export async function stopRecording(): Promise<{
  success: boolean;
  sessionId?: string;
  error?: string;
}> {
  if (!currentSession || currentSession.state !== "recording") {
    return { success: false, error: "No recording in progress" };
  }

  const result = await sendToSidecar({
    action: "stop_recording",
    id: currentSession.id,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error || "Failed to stop recording",
    };
  }

  currentSession.state = "stopped";
  currentSession.stoppedAt = new Date().toISOString();

  return { success: true, sessionId: currentSession.id };
}

/**
 * Attach recording to candidate and start transcription.
 */
export async function attachRecording(
  candidateId: string,
  projectId: string,
): Promise<{ success: boolean; callRecordId?: string; error?: string }> {
  if (!currentSession || currentSession.state !== "stopped") {
    return { success: false, error: "No stopped recording to attach" };
  }

  if (!currentSession.audioPath || !fs.existsSync(currentSession.audioPath)) {
    return { success: false, error: "Recording file not found" };
  }

  currentSession.state = "attaching";
  currentSession.candidateId = candidateId;
  currentSession.projectId = projectId;

  // Create call record in database
  const db = getDatabase();
  const callId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO call_records (
      id, project_id, cv_id, type, status, recording_path,
      started_at, ended_at, created_at
    ) VALUES (?, ?, ?, 'recruiter', 'transcribing', ?, ?, ?, ?)
  `,
  ).run(
    callId,
    projectId,
    candidateId,
    currentSession.audioPath,
    currentSession.startedAt,
    currentSession.stoppedAt,
    now,
  );

  // Queue transcription (non-blocking)
  queueTranscription(callId, currentSession.audioPath, projectId);

  // Reset session
  const session = currentSession;
  currentSession = null;

  return { success: true, callRecordId: callId };
}

/**
 * Discard current recording without attaching.
 */
export async function discardRecording(): Promise<{ success: boolean }> {
  if (!currentSession) {
    return { success: true };
  }

  // Clean up audio file
  if (currentSession.audioPath && fs.existsSync(currentSession.audioPath)) {
    try {
      fs.unlinkSync(currentSession.audioPath);
    } catch (e) {
      console.warn("[Recording] Failed to delete temp file:", e);
    }
  }

  currentSession = null;
  return { success: true };
}

/**
 * Get current recording state.
 */
export function getRecordingState(): {
  state: RecordingState;
  sessionId?: string;
  startedAt?: string;
  durationMs?: number;
} {
  if (!currentSession) {
    return { state: "idle" };
  }

  const now = new Date().getTime();
  const started = new Date(currentSession.startedAt).getTime();

  return {
    state: currentSession.state,
    sessionId: currentSession.id,
    startedAt: currentSession.startedAt,
    durationMs: now - started,
  };
}
```

### Pattern 4: Floating Recording Panel (React)

**What:** Draggable recording control panel accessible from any wheel section
**When to use:** User wants to record a call

```typescript
// src/renderer/components/recording/RecordingPanel.tsx
import { useState, useEffect, useRef } from 'react';
import { Mic, Square, CheckCircle, X, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useRecordingStore } from '../../stores/recordingStore';
import { CandidateSelect } from './CandidateSelect';
import { WaveformMeter } from './WaveformMeter';
import { cn } from '../../lib/utils';

export function RecordingPanel() {
  const {
    state,
    isRecording,
    isPanelExpanded,
    micLevel,
    systemLevel,
    durationMs,
    startRecording,
    stopRecording,
    attachToCandidate,
    discardRecording,
    togglePanel
  } = useRecordingStore();

  // Dragging state
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Format duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Minimized tray view
  if (!isPanelExpanded) {
    return (
      <div
        className={cn(
          "fixed z-50 cursor-move",
          isRecording && "animate-pulse"
        )}
        style={{ left: position.x, top: position.y }}
        onMouseDown={handleMouseDown}
      >
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "h-12 w-12 rounded-full shadow-lg",
            isRecording && "bg-red-500 text-white border-red-500"
          )}
          onClick={togglePanel}
        >
          {isRecording ? (
            <div className="h-3 w-3 bg-white rounded-full animate-pulse" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "fixed z-50 w-80 shadow-xl cursor-move select-none",
        isDragging && "opacity-90"
      )}
      style={{ left: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Mic className="h-4 w-4" />
          Call Recording
          {isRecording && (
            <span className="flex items-center gap-1 text-red-500">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              REC
            </span>
          )}
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={togglePanel}>
          <Minimize2 className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Level Meters */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">System</span>
            <WaveformMeter level={systemLevel} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Mic</span>
            <WaveformMeter level={micLevel} />
          </div>
        </div>

        {/* Duration */}
        {(state === 'recording' || state === 'stopped') && (
          <div className="text-center text-2xl font-mono">
            {formatDuration(durationMs)}
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-2">
          {state === 'idle' && (
            <Button onClick={startRecording} className="bg-red-500 hover:bg-red-600">
              <Mic className="h-4 w-4 mr-2" />
              Start Recording
            </Button>
          )}

          {state === 'recording' && (
            <Button onClick={stopRecording} variant="outline">
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          )}

          {state === 'stopped' && (
            <>
              <Button onClick={discardRecording} variant="outline" className="text-destructive">
                <X className="h-4 w-4 mr-2" />
                Discard
              </Button>
            </>
          )}
        </div>

        {/* Candidate Selection */}
        {state === 'stopped' && (
          <CandidateSelect onSelect={attachToCandidate} />
        )}
      </CardContent>
    </Card>
  );
}
```

### Pattern 5: Simple Waveform Level Meter

**What:** Visual feedback showing audio input levels
**When to use:** During recording to confirm capture is working

```typescript
// src/renderer/components/recording/WaveformMeter.tsx
import { cn } from '../../lib/utils';

interface WaveformMeterProps {
  level: number; // 0-1
  className?: string;
}

export function WaveformMeter({ level, className }: WaveformMeterProps) {
  // Normalize and clamp level
  const normalizedLevel = Math.min(1, Math.max(0, level));
  const percentage = normalizedLevel * 100;

  // Color based on level
  const getColor = () => {
    if (normalizedLevel > 0.8) return 'bg-red-500';
    if (normalizedLevel > 0.5) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={cn("flex-1 h-4 bg-muted rounded overflow-hidden", className)}>
      <div
        className={cn("h-full transition-all duration-75", getColor())}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Recording in renderer process:** All audio capture must happen in main process via sidecar
- **Blocking CV parsing during transcription:** Use separate request queue or background worker
- **GPU-dependent transcription:** Stick to CPU for bundling simplicity
- **Storing recordings permanently:** Delete audio files after successful transcription
- **Real-time transcription during recording:** Post-recording transcription is simpler and sufficient
- **Complex diarization for 2-party calls:** Simple "Recruiter" / "Candidate" labels are enough
- **Starting new recording before attaching previous:** Enforce state machine

## Don't Hand-Roll

| Problem          | Don't Build            | Use Instead               | Why                                               |
| ---------------- | ---------------------- | ------------------------- | ------------------------------------------------- |
| WASAPI loopback  | Custom Win32 API calls | PyAudioWPatch             | Already handles device enumeration, loopback mode |
| Audio resampling | Manual interpolation   | NumPy or scipy.signal     | Edge cases in sample rate conversion              |
| Speech-to-text   | Custom ASR model       | faster-whisper            | Production-quality, optimized inference           |
| VAD filtering    | Silence detection      | faster-whisper vad_filter | Built-in Silero VAD                               |
| Audio file I/O   | Raw binary handling    | wave stdlib               | Handles WAV header format correctly               |

**Key insight:** Audio capture on Windows is notoriously tricky. PyAudioWPatch is the only maintained solution that exposes WASAPI loopback to Python without requiring custom C extensions.

## Common Pitfalls

### Pitfall 1: No Loopback Device Found

**What goes wrong:** `get_default_wasapi_loopback()` returns None or throws
**Why it happens:** Some audio drivers don't expose loopback mode; VMs often lack proper audio
**How to avoid:** Fall back gracefully to mic-only recording; show user-friendly error
**Warning signs:** Works on dev machine but fails in user environment

### Pitfall 2: Sample Rate Mismatch

**What goes wrong:** Mixed audio sounds wrong (chipmunk effect or slow)
**Why it happens:** Loopback device is 44.1kHz/48kHz, mic is 16kHz, Whisper expects 16kHz
**How to avoid:** Resample all audio to 16kHz before mixing; use the resampling code pattern
**Warning signs:** Transcript has many garbled words

### Pitfall 3: Audio Clipping in Mix

**What goes wrong:** Mixed audio is distorted, harsh sounds
**Why it happens:** Two int16 streams added together overflow the int16 range
**How to avoid:** Convert to float32, average (not sum), clip to valid range, convert back
**Warning signs:** Louder sections sound crackly

### Pitfall 4: Transcription Blocking Parser

**What goes wrong:** CV parsing queue stalls while transcribing
**Why it happens:** Python sidecar is single-threaded, long transcription blocks stdin
**How to avoid:** Use separate process for transcription OR implement request prioritization
**Warning signs:** CV extraction times out during transcription

### Pitfall 5: Recording File Left Behind

**What goes wrong:** User's temp directory fills up with WAV files
**Why it happens:** Recording discarded but file not deleted; app crashes mid-recording
**How to avoid:** Clean up temp files on app startup; delete after successful transcription
**Warning signs:** Large temp directory size

### Pitfall 6: Level Meter Not Responding

**What goes wrong:** UI level meter shows 0 even when recording
**Why it happens:** Callback not firing; audio data not flowing; wrong device selected
**How to avoid:** Log callback invocations; verify device selection; test with known audio
**Warning signs:** Recording completes but transcript is empty

### Pitfall 7: PyInstaller Bundle Fails

**What goes wrong:** Bundled app can't find whisper model or PyAudio libraries
**Why it happens:** Hidden imports not collected; DLLs not included
**How to avoid:** Add `--collect-all faster_whisper` and `--collect-all pyaudiowpatch` to PyInstaller
**Warning signs:** `ModuleNotFoundError` or `OSError` on bundled app launch

## Database Schema Additions

```sql
-- Migration v10: Recruiter call recordings

-- Add call type distinction
-- type column already exists: 'screening' for AI calls
-- Add 'recruiter' type for manual recordings

-- Add transcription status tracking
ALTER TABLE call_records ADD COLUMN transcription_status TEXT DEFAULT NULL;
-- Values: NULL (not started), 'queued', 'processing', 'completed', 'failed'

ALTER TABLE call_records ADD COLUMN transcription_error TEXT DEFAULT NULL;
```

## State of the Art

| Old Approach              | Current Approach        | When Changed     | Impact                                         |
| ------------------------- | ----------------------- | ---------------- | ---------------------------------------------- |
| Stereo Mix virtual device | WASAPI loopback         | Windows Vista+   | More reliable, works with modern audio drivers |
| OpenAI Whisper Python     | faster-whisper          | 2023+            | 4x faster, less memory, same accuracy          |
| Real-time transcription   | Post-call transcription | N/A              | Simpler architecture, fewer edge cases         |
| GPU-only Whisper          | CPU INT8 quantization   | CTranslate2 3.x+ | Viable CPU performance for short audio         |

**Deprecated/outdated:**

- `pyaudio` (original): Use `pyaudiowpatch` for loopback support
- `openai-whisper`: Use `faster-whisper` for performance
- `Stereo Mix` device: WASAPI loopback is more reliable

## Open Questions

1. **Transcription blocking CV parsing**
   - What we know: Python sidecar is single stdin loop
   - What's unclear: Best way to handle concurrent requests
   - Recommendation: Implement request priority (CV > transcription) or use ThreadPoolExecutor

2. **Model download timing**
   - What we know: faster-whisper downloads models on first use (~150MB for small)
   - What's unclear: When to trigger download (first recording or app install)
   - Recommendation: Add "Download transcription model" button in settings; show progress

3. **Speaker diarization**
   - What we know: WhisperX provides diarization but requires HuggingFace token
   - What's unclear: Is diarization essential for 2-party calls?
   - Recommendation: Start without diarization; label based on audio source (mic=recruiter, loopback=candidate); add later if needed

4. **Audio quality thresholds**
   - What we know: Poor audio leads to bad transcripts
   - What's unclear: What minimum SNR or level to require
   - Recommendation: Show warning if average level is too low; don't block recording

## Sources

### Primary (HIGH confidence)

- [PyAudioWPatch GitHub](https://github.com/s0d3s/PyAudioWPatch) - WASAPI loopback Python library
- [PyAudioWPatch PyPI](https://pypi.org/project/PyAudioWPatch/) - Installation and version info
- [faster-whisper GitHub](https://github.com/SYSTRAN/faster-whisper) - Local transcription library
- [faster-whisper PyPI](https://pypi.org/project/faster-whisper/) - Version 1.2.x documentation
- Existing codebase: `voiceService.ts`, `transcriptAnalyzer.ts`, `TranscriptViewer.tsx`, `CallRecordCard.tsx`

### Secondary (MEDIUM confidence)

- [WhisperX GitHub](https://github.com/m-bain/whisperX) - Diarization option (if needed later)
- [Microsoft WASAPI Loopback](https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording) - Official Windows documentation
- [Real-time Audio Visualization](https://swharden.com/blog/2016-07-19-realtime-audio-visualization-in-python/) - Level meter patterns

### Tertiary (LOW confidence)

- Community examples of PyAudio dual-stream recording
- Stack Overflow audio mixing patterns

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - PyAudioWPatch and faster-whisper are well-documented, actively maintained
- Architecture: HIGH - Follows existing sidecar patterns; reuses Phase 11 UI components
- Pitfalls: HIGH - Audio capture issues are well-known; documented from official sources
- Dual-stream mixing: MEDIUM - Pattern is straightforward but needs testing on various audio configurations

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (libraries are stable; audio APIs don't change frequently)
