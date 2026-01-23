# Architecture Patterns: Electron + Python Sidecar Desktop Apps

**Domain:** Local-first desktop application with Electron frontend and Python sidecar backend
**Researched:** 2026-01-23
**Confidence:** MEDIUM (patterns well-documented but some configuration details vary by version)

## Executive Summary

Electron + Python sidecar architecture combines Electron's cross-platform UI capabilities with Python's rich ecosystem for heavy processing (PDF parsing, NLP). The recommended pattern spawns a bundled Python executable as a child process from Electron's main process, communicating via stdin/stdout JSON messages or a localhost HTTP server. For Samsara's use case (PDF processing, spaCy NLP, <2s response requirement), **python-shell with JSON mode** provides the best balance of simplicity, performance, and bundling ease.

---

## Recommended Architecture

```
+------------------------------------------------------------------+
|                        ELECTRON APP                               |
|                                                                   |
|  +------------------+        IPC        +--------------------+    |
|  |  Renderer        | <--------------->  |  Main Process      |    |
|  |  (React/Vue/     |   ipcRenderer/     |  (Node.js)        |    |
|  |   vanilla)       |   ipcMain          |                    |    |
|  |                  |                    |  - Window mgmt     |    |
|  |  - UI/UX         |                    |  - File dialogs    |    |
|  |  - User input    |                    |  - Python spawn    |    |
|  |  - Display       |                    |  - SQLite access   |    |
|  +------------------+                    +--------------------+    |
|                                                  |                 |
|                                                  | child_process   |
|                                                  | spawn + stdio   |
|                                                  |                 |
+--------------------------------------------------|-----------------+
                                                   |
                                                   v
                                    +-----------------------------+
                                    |      PYTHON SIDECAR         |
                                    |      (Bundled Executable)    |
                                    |                             |
                                    |  - pdfplumber (PDF parsing) |
                                    |  - spaCy (NLP extraction)   |
                                    |  - Business logic           |
                                    |  - JSON stdin/stdout        |
                                    +-----------------------------+
                                                   |
                                                   v
                                    +-----------------------------+
                                    |         SQLite DB           |
                                    |    (shared file access)     |
                                    +-----------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Technology |
|-----------|---------------|-------------------|------------|
| **Renderer Process** | UI rendering, user interaction, display results | Main Process via ipcRenderer | HTML/CSS/JS, React/Vue |
| **Main Process** | Window management, native OS features, Python lifecycle, database access | Renderer via ipcMain, Python via stdio | Node.js, Electron APIs |
| **Python Sidecar** | PDF parsing, NLP processing, resume extraction logic | Main Process via stdin/stdout JSON | Python, pdfplumber, spaCy |
| **SQLite Database** | Persistent storage for resumes, extracted data, settings | Main Process (better-sqlite3) | SQLite file |

### Data Flow

```
User drops PDF file
        |
        v
[Renderer] ---(ipcRenderer.invoke)--> [Main Process]
                                            |
                                            | Reads file from disk
                                            | Spawns/sends to Python
                                            v
                              [Python Sidecar receives JSON via stdin]
                                            |
                                            | pdfplumber extracts text
                                            | spaCy processes NLP
                                            | Returns JSON via stdout
                                            v
                              [Main Process receives JSON result]
                                            |
                                            | Writes to SQLite
                                            | Sends result to renderer
                                            v
                              [Renderer displays results]
```

---

## IPC Patterns: Electron to Python

### Option 1: python-shell + JSON (RECOMMENDED)

**Confidence:** HIGH (verified via npm documentation and multiple tutorials)

Use `python-shell` npm package for stdio-based communication with JSON serialization.

**Pros:**
- Simple setup, minimal boilerplate
- Efficient for request/response patterns
- No network ports to manage
- Easy error handling
- Works well with PyInstaller bundles

**Cons:**
- Not ideal for streaming large data
- Python process must be kept alive for multiple requests (or respawned)

**Implementation Pattern:**

```javascript
// main.js - Electron main process
const { PythonShell } = require('python-shell');
const path = require('path');

function findPython() {
  const possibilities = [
    // Packaged app location
    path.join(process.resourcesPath, 'python', 'samsara-backend.exe'),
    path.join(process.resourcesPath, 'python', 'samsara-backend'),
    // Development location
    path.join(__dirname, 'python-dist', 'samsara-backend.exe'),
    path.join(__dirname, 'python-dist', 'samsara-backend'),
  ];

  for (const p of possibilities) {
    if (fs.existsSync(p)) return p;
  }
  // Fallback to system Python for development
  return 'python';
}

const options = {
  mode: 'json',
  pythonPath: findPython(),
  pythonOptions: ['-u'], // unbuffered output
  scriptPath: path.join(__dirname, 'python-src'),
};

// For long-running Python process (connection pool pattern)
let pyshell = null;

function initPython() {
  pyshell = new PythonShell('main.py', options);

  pyshell.on('message', (message) => {
    // Route response to appropriate handler based on message.id
    handlePythonResponse(message);
  });

  pyshell.on('error', (err) => {
    console.error('Python error:', err);
  });
}

function sendToPython(request) {
  return new Promise((resolve, reject) => {
    const id = generateRequestId();
    pendingRequests.set(id, { resolve, reject });
    pyshell.send({ ...request, id });
  });
}
```

```python
# main.py - Python sidecar entry point
import sys
import json
from processor import ResumeProcessor

processor = ResumeProcessor()

def handle_request(request):
    action = request.get('action')

    if action == 'process_resume':
        result = processor.process(request['file_path'])
        return {'id': request['id'], 'success': True, 'data': result}

    elif action == 'health_check':
        return {'id': request['id'], 'success': True, 'status': 'healthy'}

    return {'id': request['id'], 'success': False, 'error': 'Unknown action'}

# Main loop - read JSON from stdin, write JSON to stdout
for line in sys.stdin:
    try:
        request = json.loads(line)
        response = handle_request(request)
        print(json.dumps(response), flush=True)
    except Exception as e:
        print(json.dumps({'error': str(e)}), flush=True)
```

### Option 2: HTTP Localhost Server (Flask)

**Confidence:** MEDIUM (well-documented but more complex setup)

Python runs a Flask server on localhost; Electron makes HTTP requests.

**Pros:**
- Familiar REST API patterns
- Easy debugging (can test with curl/Postman)
- Supports concurrent requests naturally
- Good for complex multi-endpoint APIs

**Cons:**
- Port management complexity
- Firewall/antivirus may block localhost
- Slower than stdio for small payloads
- More complex bundling (Flask dependencies)

**When to use:** Choose HTTP if you need multiple concurrent requests or complex API routing.

### Option 3: ZeroRPC (NOT RECOMMENDED)

**Confidence:** MEDIUM (documented but maintenance concerns)

**Why not recommended:**
- zerorpc-node library hasn't been updated significantly
- Compatibility issues with newer Electron versions
- More complex native module compilation
- Smaller community, less support

---

## Bundling Strategy: Python with Electron

### Recommended Approach: PyInstaller + electron-builder extraResources

**Confidence:** HIGH (verified via official electron-builder docs and Simon Willison's detailed guide)

**Step 1: Create Python Executable with PyInstaller**

```bash
# From project root
cd python-src

pyinstaller --onedir --name samsara-backend main.py \
    --hidden-import pdfplumber \
    --hidden-import pdfminer.six \
    --collect-all pdfplumber \
    --collect-submodules spacy \
    --collect-data spacy \
    --collect-submodules en_core_web_sm \
    --collect-data en_core_web_sm \
    --copy-metadata en_core_web_sm
```

**Important PyInstaller Notes:**
- Use `--onedir` not `--onefile` for faster startup (important for <2s requirement)
- spaCy requires extensive hidden imports and data collection
- Model files (en_core_web_sm) must be explicitly included

**Step 2: Configure electron-builder**

```json
// package.json
{
  "build": {
    "appId": "com.samsara.app",
    "productName": "Samsara",
    "extraResources": [
      {
        "from": "python-dist/samsara-backend",
        "to": "python",
        "filter": ["**/*"]
      }
    ],
    "mac": {
      "target": "dmg",
      "extraResources": [
        {
          "from": "python-dist-mac/samsara-backend",
          "to": "python",
          "filter": ["**/*"]
        }
      ]
    },
    "win": {
      "target": "nsis",
      "extraResources": [
        {
          "from": "python-dist-win/samsara-backend",
          "to": "python",
          "filter": ["**/*"]
        }
      ]
    },
    "asar": true,
    "asarUnpack": []
  }
}
```

**Key Configuration Points:**

| Setting | Value | Reason |
|---------|-------|--------|
| `extraResources` | Python dist folder | Places Python outside asar archive for direct execution |
| `asar` | `true` | Keeps Electron code in asar for performance |
| Platform-specific `extraResources` | Different paths | PyInstaller output differs per platform |

**Step 3: Locate Python at Runtime**

```javascript
// findPython.js
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

function findPython() {
  const isPackaged = app.isPackaged;
  const platform = process.platform;
  const exeName = platform === 'win32' ? 'samsara-backend.exe' : 'samsara-backend';

  const locations = isPackaged
    ? [path.join(process.resourcesPath, 'python', exeName)]
    : [
        path.join(__dirname, '..', 'python-dist', exeName),
        path.join(__dirname, '..', 'python-dist', 'samsara-backend', exeName),
      ];

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return loc;
    }
  }

  throw new Error('Python backend not found');
}

module.exports = { findPython };
```

### Alternative: python-build-standalone

**Confidence:** MEDIUM (documented by Simon Willison for Datasette Desktop)

Instead of PyInstaller, bundle a complete Python interpreter with your scripts:

**Pros:**
- Can install pip packages at runtime
- More flexible for plugin systems
- Smaller initial bundle if not all packages are needed

**Cons:**
- Larger distribution size
- More complex startup (must install deps)
- Not suitable for Samsara (need everything pre-bundled)

---

## SQLite Integration

### Recommendation: better-sqlite3 in Main Process

**Confidence:** HIGH (verified performance claims via npm and dev.to documentation)

```javascript
// database.js - Main process only
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'samsara.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_text TEXT,
    extracted_data JSON
  );

  CREATE INDEX IF NOT EXISTS idx_resumes_file_path ON resumes(file_path);
`);

module.exports = { db };
```

**Why better-sqlite3 over sql.js:**
- 2-10x faster for most operations
- Synchronous API is simpler and actually faster
- SQLite runs in main process, not subject to renderer sandboxing

**Important:** SQLite operations must run in Main Process. Use IPC to communicate with renderer:

```javascript
// main.js
ipcMain.handle('db:insert-resume', async (event, data) => {
  const stmt = db.prepare('INSERT INTO resumes (file_path, file_name, raw_text, extracted_data) VALUES (?, ?, ?, ?)');
  const result = stmt.run(data.filePath, data.fileName, data.rawText, JSON.stringify(data.extractedData));
  return result.lastInsertRowid;
});

ipcMain.handle('db:get-resumes', async () => {
  return db.prepare('SELECT * FROM resumes ORDER BY processed_at DESC').all();
});
```

---

## Process Lifecycle Management

### Python Process Lifecycle

**Confidence:** MEDIUM (documented patterns, but Windows-specific quirks exist)

```javascript
// pythonManager.js
const { spawn } = require('child_process');
const { app } = require('electron');
const { findPython } = require('./findPython');

let pythonProcess = null;

function startPython() {
  const pythonPath = findPython();

  pythonProcess = spawn(pythonPath, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true, // Hide console window on Windows
  });

  pythonProcess.stdout.on('data', handlePythonOutput);
  pythonProcess.stderr.on('data', handlePythonError);

  pythonProcess.on('exit', (code) => {
    console.log(`Python exited with code ${code}`);
    pythonProcess = null;
  });
}

function stopPython() {
  if (pythonProcess) {
    // Send shutdown command first
    pythonProcess.stdin.write(JSON.stringify({ action: 'shutdown' }) + '\n');

    // Give it time to clean up, then force kill
    setTimeout(() => {
      if (pythonProcess) {
        pythonProcess.kill('SIGTERM');
        pythonProcess = null;
      }
    }, 1000);
  }
}

// Lifecycle hooks
app.on('ready', startPython);
app.on('will-quit', stopPython);

// Windows-specific: ensure Python dies with Electron
if (process.platform === 'win32') {
  app.on('before-quit', () => {
    if (pythonProcess) {
      // Use taskkill for reliable Windows termination
      spawn('taskkill', ['/pid', pythonProcess.pid.toString(), '/f', '/t']);
    }
  });
}
```

**Windows Gotcha:** On Windows, `process.kill()` may not kill child processes of the Python process. Use `taskkill /t` flag to kill the process tree.

---

## Project Structure

### Recommended Directory Layout

```
samsara/
├── package.json
├── electron-builder.yml          # Build configuration
├── src/
│   ├── main/
│   │   ├── main.js              # Electron main process entry
│   │   ├── preload.js           # Preload script for renderer
│   │   ├── pythonManager.js     # Python lifecycle management
│   │   ├── database.js          # SQLite operations
│   │   └── ipcHandlers.js       # IPC handler registration
│   ├── renderer/
│   │   ├── index.html
│   │   ├── renderer.js          # or React/Vue app
│   │   └── styles.css
│   └── shared/
│       └── types.js             # Shared type definitions
├── python-src/
│   ├── main.py                  # Python entry point
│   ├── processor.py             # Resume processing logic
│   ├── pdf_extractor.py         # pdfplumber wrapper
│   ├── nlp_extractor.py         # spaCy NLP logic
│   └── requirements.txt
├── python-dist/                 # PyInstaller output (gitignored)
├── scripts/
│   ├── build-python.sh          # PyInstaller build script
│   └── build-python.ps1         # Windows version
└── test/
    ├── electron/
    └── python/
```

---

## Patterns to Follow

### Pattern 1: Request-Response with Correlation IDs

**What:** Every message to Python includes a unique ID; responses echo it back.

**Why:** Allows multiple in-flight requests without confusion.

```javascript
// Electron side
const pendingRequests = new Map();

function sendRequest(action, data) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    pendingRequests.set(id, { resolve, reject, timeout: setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Request timeout'));
    }, 30000)});

    pyshell.send({ id, action, ...data });
  });
}

function handleResponse(message) {
  const pending = pendingRequests.get(message.id);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingRequests.delete(message.id);

    if (message.success) {
      pending.resolve(message.data);
    } else {
      pending.reject(new Error(message.error));
    }
  }
}
```

### Pattern 2: Health Check on Startup

**What:** Verify Python backend is responsive before accepting user requests.

```javascript
async function initializePython() {
  startPython();

  // Wait for Python to be ready
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await sendRequest('health_check', {});
      console.log('Python backend ready');
      return;
    } catch {
      await sleep(500);
    }
  }

  throw new Error('Python backend failed to start');
}
```

### Pattern 3: Graceful Degradation

**What:** Handle Python crashes without crashing Electron.

```javascript
pythonProcess.on('exit', (code, signal) => {
  if (code !== 0) {
    // Notify renderer of backend failure
    mainWindow.webContents.send('backend:error', {
      message: 'Processing backend crashed. Restarting...',
    });

    // Attempt restart
    setTimeout(startPython, 2000);
  }
});
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Running Python from Renderer Process

**What:** Spawning Python directly from renderer using remote module.

**Why bad:**
- Security risk (renderer should be sandboxed)
- Process lifecycle harder to manage
- Can cause orphan processes

**Instead:** All Python management goes through main process. Renderer uses IPC.

### Anti-Pattern 2: Blocking Main Process with Sync Operations

**What:** Using synchronous file I/O or waiting for Python in main process event handlers.

**Why bad:** Blocks all window rendering, makes app feel frozen.

**Instead:** Use async patterns with promises; show loading states in renderer.

### Anti-Pattern 3: Putting Python in ASAR Archive

**What:** Not excluding Python from asar packing.

**Why bad:** Cannot execute files from inside asar.

**Instead:** Use `extraResources` or `extraFiles` to place Python outside asar.

### Anti-Pattern 4: Using zerorpc in 2025+

**What:** Choosing zerorpc for new projects.

**Why bad:** Library maintenance has stalled; compatibility issues with modern Electron.

**Instead:** Use python-shell (stdio) or Flask HTTP server.

---

## Performance Considerations for <2s Processing

| Factor | Impact | Mitigation |
|--------|--------|------------|
| Python cold start | 1-3s | Keep Python running (don't restart per-request) |
| PyInstaller --onefile | Slower startup (temp extraction) | Use --onedir instead |
| spaCy model loading | 2-5s | Load model once at startup, reuse |
| Large PDF parsing | Variable | Stream progress to UI, use worker pattern |
| SQLite writes | <10ms | Use WAL mode, batch inserts |

**Critical for 2s target:**
1. Pre-warm Python on app startup (not on first request)
2. Load spaCy model during initialization
3. Use `--onedir` PyInstaller output
4. Keep Python process alive between requests

```python
# Preload expensive resources at startup
import spacy
nlp = spacy.load("en_core_web_sm")  # Load once

def process_resume(text):
    doc = nlp(text)  # Uses preloaded model
    # ...
```

---

## Build Order Dependencies

For roadmap phase planning, here's the dependency order:

```
1. Electron Shell (main process, window, basic IPC)
   |
   +--> 2. Python Sidecar (standalone, tested independently)
   |        |
   |        +--> 3. IPC Integration (python-shell communication)
   |
   +--> 2. SQLite Schema (database design)
            |
            +--> 3. Database Integration (better-sqlite3 + IPC)

4. Resume Processing (pdfplumber + spaCy in Python)
   |
   +--> 5. Full Pipeline (end-to-end file -> display)

6. Bundling (PyInstaller + electron-builder)
   |
   +--> 7. Installer (NSIS for Windows, DMG for macOS)
```

**Phase ordering rationale:**
- Electron shell and Python backend can be built in parallel
- IPC integration requires both to be minimally functional
- Bundling should be attempted early to catch platform-specific issues
- Don't leave packaging until the end - it has surprises

---

## Sources

### HIGH Confidence (Official Documentation)
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [electron-builder Configuration](https://www.electron.build/configuration.html)
- [PyInstaller Hooks Documentation](https://pyinstaller.org/en/stable/hooks.html)

### MEDIUM Confidence (Detailed Tutorials, Verified Patterns)
- [Bundling Python inside an Electron app - Simon Willison](https://til.simonwillison.net/electron/python-inside-electron)
- [electron-python-example - fyears](https://github.com/fyears/electron-python-example)
- [Building a deployable Python-Electron App - Andy Bulka](https://medium.com/@abulka/electron-python-4e8c807bfa5e)
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3)
- [spaCy PyInstaller Discussion](https://github.com/explosion/spaCy/discussions/9205)

### LOW Confidence (Community Patterns, May Need Validation)
- [electron-builder extraResources issues](https://github.com/electron-userland/electron-builder/issues/2693)
- [Electron Python IPC patterns - Python.org Discuss](https://discuss.python.org/t/how-to-communicate-between-electron-framework-and-python/48044)
