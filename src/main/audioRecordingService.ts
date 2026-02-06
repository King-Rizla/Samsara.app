/**
 * Audio Recording Service
 *
 * Manages recording lifecycle via Python sidecar.
 * Handles start/stop recording, attaching to candidates, and audio levels.
 *
 * Flow: idle -> recording -> stopped -> (attach or discard) -> idle
 */
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { sendToPython } from "./pythonManager";
import { getDatabase } from "./database";
import { queueTranscription } from "./transcriptionService";

// Recording states
type RecordingState = "idle" | "recording" | "stopped" | "attaching";

// Recording session data
interface RecordingSession {
  id: string;
  state: RecordingState;
  startedAt: string;
  stoppedAt?: string;
  audioPath?: string;
  durationMs?: number;
}

// Level update from Python
interface LevelUpdate {
  source: "loopback" | "mic";
  level: number;
}

// Current session (singleton)
let currentSession: RecordingSession | null = null;

// Callback for level updates (set by main process to forward to renderer)
let levelCallback:
  | ((levels: { loopback: number; mic: number }) => void)
  | null = null;

// Track levels from both sources
const currentLevels = { loopback: 0, mic: 0 };

/**
 * Get temp directory for recordings.
 * Creates directory if it doesn't exist.
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
 * Returns { success: true, sessionId } on success.
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

  try {
    // Request Python sidecar to start recording
    const result = (await sendToPython(
      {
        action: "start_recording",
        output_path: audioPath,
      },
      5000,
    )) as { success: boolean; session_id?: string; error?: string };

    if (!result || !result.session_id) {
      return {
        success: false,
        error: "Failed to start recording in Python sidecar",
      };
    }

    currentSession = {
      id: sessionId,
      state: "recording",
      startedAt: new Date().toISOString(),
      audioPath,
    };

    console.log(`[Recording] Started session ${sessionId}`);
    return { success: true, sessionId };
  } catch (error) {
    console.error("[Recording] Failed to start:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to start recording",
    };
  }
}

/**
 * Stop recording.
 * Returns { success: true, sessionId, durationMs, audioPath } on success.
 */
export async function stopRecording(): Promise<{
  success: boolean;
  sessionId?: string;
  durationMs?: number;
  audioPath?: string;
  error?: string;
}> {
  if (!currentSession || currentSession.state !== "recording") {
    return { success: false, error: "No recording in progress" };
  }

  try {
    const result = (await sendToPython(
      {
        action: "stop_recording",
      },
      10000,
    )) as {
      success: boolean;
      audio_path?: string;
      duration_ms?: number;
      error?: string;
    };

    if (!result || !result.audio_path) {
      return {
        success: false,
        error: result?.error || "Failed to stop recording",
      };
    }

    currentSession.state = "stopped";
    currentSession.stoppedAt = new Date().toISOString();
    currentSession.durationMs = result.duration_ms;
    currentSession.audioPath = result.audio_path;

    console.log(
      `[Recording] Stopped session ${currentSession.id}, duration: ${result.duration_ms}ms`,
    );

    return {
      success: true,
      sessionId: currentSession.id,
      durationMs: result.duration_ms,
      audioPath: result.audio_path,
    };
  } catch (error) {
    console.error("[Recording] Failed to stop:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to stop recording",
    };
  }
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

  const result: {
    state: RecordingState;
    sessionId?: string;
    startedAt?: string;
    durationMs?: number;
  } = {
    state: currentSession.state,
    sessionId: currentSession.id,
    startedAt: currentSession.startedAt,
  };

  // Calculate current duration if recording
  if (currentSession.state === "recording") {
    const started = new Date(currentSession.startedAt).getTime();
    result.durationMs = Date.now() - started;
  } else if (currentSession.state === "stopped") {
    result.durationMs = currentSession.durationMs;
  }

  return result;
}

/**
 * Attach recording to candidate and queue transcription.
 * Creates call_record in database with type='recruiter', status='pending_transcription'.
 */
export async function attachRecording(
  candidateId: string,
  projectId: string,
): Promise<{
  success: boolean;
  callRecordId?: string;
  error?: string;
}> {
  if (!currentSession || currentSession.state !== "stopped") {
    return { success: false, error: "No stopped recording to attach" };
  }

  if (!currentSession.audioPath || !fs.existsSync(currentSession.audioPath)) {
    return { success: false, error: "Recording file not found" };
  }

  currentSession.state = "attaching";

  try {
    const db = getDatabase();
    const callId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Create call record with pending transcription status
    db.prepare(
      `
      INSERT INTO call_records (
        id, project_id, cv_id, type, status, phone_number, recording_path,
        duration_seconds, started_at, ended_at, created_at,
        transcription_status
      ) VALUES (?, ?, ?, 'recruiter', 'completed', '', ?, ?, ?, ?, ?, 'queued')
    `,
    ).run(
      callId,
      projectId,
      candidateId,
      currentSession.audioPath,
      Math.round((currentSession.durationMs || 0) / 1000),
      currentSession.startedAt,
      currentSession.stoppedAt,
      now,
    );

    console.log(
      `[Recording] Attached recording to candidate ${candidateId}, callRecordId: ${callId}`,
    );

    // Queue transcription job
    queueTranscription({
      callRecordId: callId,
      audioPath: currentSession.audioPath,
      projectId,
      candidateId,
    });

    // Reset session
    currentSession = null;

    return { success: true, callRecordId: callId };
  } catch (error) {
    console.error("[Recording] Failed to attach:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to attach recording",
    };
  }
}

/**
 * Discard current recording without attaching.
 * Deletes audio file and resets session.
 */
export async function discardRecording(): Promise<{ success: boolean }> {
  if (!currentSession) {
    return { success: true };
  }

  // Clean up audio file
  if (currentSession.audioPath && fs.existsSync(currentSession.audioPath)) {
    try {
      fs.unlinkSync(currentSession.audioPath);
      console.log(`[Recording] Deleted temp file: ${currentSession.audioPath}`);
    } catch (e) {
      console.warn("[Recording] Failed to delete temp file:", e);
    }
  }

  currentSession = null;
  return { success: true };
}

/**
 * Check audio device availability.
 * Returns device info from Python sidecar.
 */
export async function checkAudioDevices(): Promise<{
  success: boolean;
  data?: {
    loopback_available: boolean;
    mic_available: boolean;
    loopback_device: string | null;
    mic_device: string | null;
  };
  error?: string;
}> {
  try {
    const result = (await sendToPython(
      {
        action: "check_audio_devices",
      },
      5000,
    )) as {
      loopback_available: boolean;
      mic_available: boolean;
      loopback_device: string | null;
      mic_device: string | null;
    };

    return { success: true, data: result };
  } catch (error) {
    console.error("[Recording] Failed to check devices:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to check audio devices",
    };
  }
}

/**
 * Set callback for audio level updates.
 * Called from main process to forward levels to renderer via IPC.
 */
export function setLevelCallback(
  callback: ((levels: { loopback: number; mic: number }) => void) | null,
): void {
  levelCallback = callback;
}

/**
 * Handle level update from Python sidecar.
 * Called when parsing Python stdout and detecting type: "level" messages.
 */
export function handleLevelUpdate(update: LevelUpdate): void {
  currentLevels[update.source] = update.level;

  if (levelCallback) {
    levelCallback({ ...currentLevels });
  }
}

/**
 * Get current audio levels.
 */
export function getCurrentLevels(): { loopback: number; mic: number } {
  return { ...currentLevels };
}
