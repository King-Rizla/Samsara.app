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
const pendingRequests = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
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

export async function startPython(): Promise<void> {
  if (pythonProcess) {
    console.log('Python process already running');
    return;
  }

  const pythonPath = findPythonPath();
  console.log(`Starting Python sidecar: ${pythonPath}`);

  pythonProcess = spawn(pythonPath, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
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
      clearTimeout(pending.timeout);
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

      // Handle request responses
      const pending = pendingRequests.get(response.id);
      if (pending) {
        clearTimeout(pending.timeout);
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

export function sendToPython(request: object, timeoutMs = 30000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!pythonProcess || !pythonProcess.stdin) {
      reject(new Error('Python process not running'));
      return;
    }

    const id = generateRequestId();
    const requestWithId = { ...request, id };

    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Request ${id} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timeout });

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
