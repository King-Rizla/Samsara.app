/**
 * Python Sidecar Manager
 *
 * Spawns and manages the Python backend process.
 * Uses JSON lines over stdin/stdout for IPC - simple and reliable.
 *
 * IMPORTANT: Do NOT use python-shell library. Direct spawn gives more
 * control and is the current recommended pattern.
 */
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import { app } from 'electron';
import * as path from 'path';

let pythonProcess: ChildProcess | null = null;
let pythonReady = false;
let readlineInterface: readline.Interface | null = null;
let currentLLMMode: 'local' | 'cloud' = 'local';
const pendingRequests = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout | null;  // Can be null when no timeout (e.g., extractCV)
  onAck?: (event: string) => void;  // Optional ACK callback
}>();

let requestCounter = 0;

function generateRequestId(): string {
  return `req-${++requestCounter}-${Date.now()}`;
}

function findPythonPath(): string {
  const isPackaged = app.isPackaged;
  const exeName = process.platform === 'win32' ? 'samsara-backend.exe' : 'samsara-backend';

  if (isPackaged) {
    // In packaged app, Python is in resources/python/
    return path.join(process.resourcesPath, 'python', exeName);
  }
  // In development, Python is in python-dist/samsara-backend/
  return path.join(__dirname, '..', '..', 'python-dist', 'samsara-backend', exeName);
}

export async function startPython(mode: 'local' | 'cloud' = 'local', apiKey?: string): Promise<void> {
  if (pythonProcess) {
    console.log('Python process already running');
    return;
  }

  currentLLMMode = mode;
  const pythonPath = findPythonPath();
  console.log(`Starting Python sidecar: ${pythonPath} (mode: ${mode})`);

  // Build environment variables
  const env = { ...process.env };
  env.SAMSARA_LLM_MODE = mode;
  if (mode === 'cloud' && apiKey) {
    env.OPENAI_API_KEY = apiKey;
    console.log('Set OPENAI_API_KEY for Python process (length:', apiKey.length, ')');
  } else if (mode === 'cloud') {
    console.log('WARNING: Cloud mode but no API key provided!');
  }

  pythonProcess = spawn(pythonPath, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    env,
  });

  // Handle stderr for debugging
  pythonProcess.stderr?.on('data', (data: Buffer) => {
    console.error('Python stderr:', data.toString());
  });

  // Handle process exit
  pythonProcess.on('exit', (code, signal) => {
    console.log(`Python process exited: code=${code}, signal=${signal}`);
    pythonProcess = null;
    pythonReady = false;
    readlineInterface = null;

    // Reject all pending requests
    for (const [id, pending] of pendingRequests) {
      if (pending.timeout) clearTimeout(pending.timeout);
      pending.reject(new Error('Python process exited'));
    }
    pendingRequests.clear();
  });

  // Set up readline for JSON line parsing
  readlineInterface = readline.createInterface({
    input: pythonProcess.stdout!,
    crlfDelay: Infinity
  });

  readlineInterface.on('line', (line: string) => {
    try {
      const response = JSON.parse(line);

      // Handle status messages (no request id)
      if (response.status) {
        console.log('Python status:', response.status);
        return;
      }

      // Handle ACK messages - type: 'ack' with event
      // ACK is not the final response - it signals processing has started
      if (response.type === 'ack' && response.id) {
        const pending = pendingRequests.get(response.id);
        if (pending && pending.onAck) {
          pending.onAck(response.event);
        }
        return;  // Keep waiting for final response
      }

      // Handle request responses
      const pending = pendingRequests.get(response.id);
      if (pending) {
        if (pending.timeout) clearTimeout(pending.timeout);
        pendingRequests.delete(response.id);
        if (response.success) {
          pending.resolve(response.data);
        } else {
          pending.reject(new Error(response.error || 'Unknown error'));
        }
      }
    } catch (e) {
      console.error('Invalid JSON from Python:', line);
    }
  });

  // Wait for Python to be ready (health check within 10 seconds per success criteria)
  const startTime = Date.now();
  const maxWaitMs = 10000;
  const retryIntervalMs = 500;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      await sendToPython({ action: 'health_check' }, 1000);
      pythonReady = true;
      console.log('Python sidecar ready');
      return;
    } catch (e) {
      // Keep retrying
      await new Promise(r => setTimeout(r, retryIntervalMs));
    }
  }

  throw new Error('Python sidecar failed to start within 10 seconds');
}

export function sendToPython(
  request: object,
  timeoutMs = 30000,
  onAck?: (event: string) => void  // Optional callback for ACK messages
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!pythonProcess || !pythonProcess.stdin) {
      reject(new Error('Python process not running'));
      return;
    }

    const id = generateRequestId();
    const requestWithId = { ...request, id };

    // Only set timeout if timeoutMs > 0 (0 means no internal timeout)
    const timeout = timeoutMs > 0 ? setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Request ${id} timed out after ${timeoutMs}ms`));
    }, timeoutMs) : null;

    pendingRequests.set(id, { resolve, reject, timeout, onAck });

    pythonProcess.stdin.write(JSON.stringify(requestWithId) + '\n');
  });
}

export function stopPython(): void {
  if (!pythonProcess) return;

  console.log('Stopping Python sidecar...');

  // Send shutdown command
  try {
    pythonProcess.stdin?.write(JSON.stringify({ action: 'shutdown' }) + '\n');
  } catch (e) {
    // Ignore write errors during shutdown
  }

  // Force kill after 2 seconds if still running
  const killTimeout = setTimeout(() => {
    if (pythonProcess) {
      console.log('Force killing Python process');

      // Windows: kill process tree
      if (process.platform === 'win32' && pythonProcess.pid) {
        spawn('taskkill', ['/pid', pythonProcess.pid.toString(), '/f', '/t']);
      } else {
        pythonProcess.kill('SIGKILL');
      }
    }
  }, 2000);

  pythonProcess.on('exit', () => {
    clearTimeout(killTimeout);
  });
}

export function isPythonReady(): boolean {
  return pythonReady;
}

export function getLLMMode(): 'local' | 'cloud' {
  return currentLLMMode;
}

/**
 * Restart Python sidecar with a new LLM mode.
 * Used when user changes settings.
 */
export async function restartWithMode(mode: 'local' | 'cloud', apiKey?: string): Promise<void> {
  console.log(`Restarting Python sidecar with mode: ${mode}`);
  stopPython();

  // Wait for process to fully stop
  await new Promise(resolve => setTimeout(resolve, 1000));

  await startPython(mode, apiKey);
}

/**
 * Extract CV data from a file.
 * Sends extract_cv action to Python sidecar and returns parsed CV.
 *
 * @param filePath - Path to the CV file
 * @param onProcessingStarted - Optional callback fired when Python confirms processing has begun
 *                              This allows QueueManager to start timeout from actual processing start
 */
export async function extractCV(
  filePath: string,
  onProcessingStarted?: () => void
): Promise<unknown> {
  if (!pythonReady) {
    throw new Error('Python sidecar is not ready');
  }

  // Pass 0 for timeout - QueueManager handles timeout after ACK
  // Pass callback that fires when Python sends processing_started ACK
  const result = await sendToPython(
    {
      action: 'extract_cv',
      file_path: filePath
    },
    0,  // No internal timeout - QueueManager manages timeout after ACK
    onProcessingStarted ? (event) => {
      if (event === 'processing_started') {
        onProcessingStarted();
      }
    } : undefined
  );

  return result;
}
