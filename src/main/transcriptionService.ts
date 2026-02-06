/**
 * Transcription Service
 *
 * Manages transcription job queue for recruiter call recordings.
 * Processes recordings in background, updates database, and notifies renderer.
 *
 * Flow: queued -> processing -> completed/failed
 */
import { sendToPython } from "./pythonManager";
import { getDatabase } from "./database";
import { BrowserWindow } from "electron";
import * as fs from "fs";
import * as crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

interface TranscriptionJob {
  callRecordId: string;
  audioPath: string;
  projectId: string;
  candidateId: string;
}

interface TranscriptionResult {
  text: string;
  segments: Array<{ start: number; end: number; text: string }>;
  language: string;
  duration: number;
}

// ============================================================================
// Queue State
// ============================================================================

const transcriptionQueue: TranscriptionJob[] = [];
let isProcessing = false;

// ============================================================================
// Public API
// ============================================================================

/**
 * Queue a recording for transcription.
 * Updates call record status to 'queued' immediately.
 */
export async function queueTranscription(job: TranscriptionJob): Promise<void> {
  const db = getDatabase();

  // Update call record status to 'queued'
  db.prepare(
    `
    UPDATE call_records SET transcription_status = 'queued' WHERE id = ?
  `,
  ).run(job.callRecordId);

  transcriptionQueue.push(job);
  console.log(
    `[Transcription] Queued job for call ${job.callRecordId}, queue size: ${transcriptionQueue.length}`,
  );

  // Start processing if not already running
  processQueue();
}

/**
 * Get transcription status for a call record.
 */
export function getTranscriptionStatus(callRecordId: string): string | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `
    SELECT transcription_status FROM call_records WHERE id = ?
  `,
    )
    .get(callRecordId) as { transcription_status: string | null } | undefined;
  return row?.transcription_status ?? null;
}

// ============================================================================
// Queue Processing
// ============================================================================

async function processQueue(): Promise<void> {
  if (isProcessing || transcriptionQueue.length === 0) {
    return;
  }

  isProcessing = true;
  const job = transcriptionQueue.shift()!;

  console.log(`[Transcription] Processing job for call ${job.callRecordId}`);

  try {
    const db = getDatabase();

    // Update status to processing
    db.prepare(
      `
      UPDATE call_records SET transcription_status = 'processing' WHERE id = ?
    `,
    ).run(job.callRecordId);

    // Call Python transcriber (5 minute timeout for long recordings)
    const result = (await sendToPython(
      {
        action: "transcribe_audio",
        audio_path: job.audioPath,
        language: "en",
      },
      300000,
    )) as TranscriptionResult;

    // Store transcript
    const transcriptId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO transcripts (id, call_id, project_id, raw_text, segments_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(
      transcriptId,
      job.callRecordId,
      job.projectId,
      result.text,
      JSON.stringify(result.segments),
      now,
    );

    // Update call record with completion status and duration
    db.prepare(
      `
      UPDATE call_records
      SET transcription_status = 'completed',
          duration_seconds = ?
      WHERE id = ?
    `,
    ).run(Math.round(result.duration), job.callRecordId);

    console.log(
      `[Transcription] Completed for call ${job.callRecordId}, duration: ${result.duration}s`,
    );

    // Delete audio file to save space
    if (fs.existsSync(job.audioPath)) {
      fs.unlinkSync(job.audioPath);
      console.log(`[Transcription] Deleted audio file: ${job.audioPath}`);
    }

    // Notify renderer via IPC
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send("transcription-complete", {
        callRecordId: job.callRecordId,
        candidateId: job.candidateId,
      });
    }
  } catch (error) {
    console.error(
      `[Transcription] Failed for call ${job.callRecordId}:`,
      error,
    );

    const db = getDatabase();
    db.prepare(
      `
      UPDATE call_records
      SET transcription_status = 'failed',
          transcription_error = ?
      WHERE id = ?
    `,
    ).run(String(error), job.callRecordId);

    // Notify renderer of failure
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send("transcription-failed", {
        callRecordId: job.callRecordId,
        candidateId: job.candidateId,
        error: String(error),
      });
    }
  }

  isProcessing = false;

  // Process next in queue
  processQueue();
}
