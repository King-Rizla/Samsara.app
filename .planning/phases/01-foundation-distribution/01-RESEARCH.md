# Phase 1: Foundation & Distribution - Research

**Researched:** 2026-01-23
**Domain:** Electron + Python sidecar bundling, code signing, distribution
**Confidence:** HIGH (verified via official documentation and community patterns)

## Summary

Phase 1 establishes the distribution pipeline before any feature development. This is critical because PyInstaller + spaCy bundling and code signing are known failure points that can block releases. The research confirms the recommended approach: Electron Forge with Vite plugin for the shell, PyInstaller `--onedir` for the Python sidecar (NOT `--onefile`), and Azure Trusted Signing for Windows / standard Apple notarization for macOS.

The three planned deliverables (01-01 through 01-03) align well with the technical requirements. Key risks are: spaCy hidden imports are finicky and require explicit flags, macOS Gatekeeper requires signing ALL binaries in PyInstaller output, and Windows SmartScreen reputation takes time to build even with proper signing.

**Primary recommendation:** Build and test the entire distribution pipeline in the first week. Do not write any feature code until a signed build loads spaCy and responds to a health check on clean VMs.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 39.x | Desktop shell | Latest stable with Chromium 142, Node 22. Official cross-platform solution. |
| Electron Forge | 7.x | Build toolchain | Official Electron toolchain. Handles packaging with maker plugins. |
| @electron-forge/plugin-vite | 7.x | Build bundler | Fast HMR, recommended over Webpack. Note: Still "experimental" as of v7.5.0 but stable in practice. |
| electron-forge-maker-nsis | 26.x | Windows installer | NSIS maker for Forge. Supports code signing and electron-updater. |
| PyInstaller | 6.18.x | Python bundling | Standard for bundling Python + deps into distributable. Supports 3.8-3.14. |
| better-sqlite3 | 12.x | SQLite bindings | 11-24x faster than alternatives. Synchronous API is simpler and actually faster. |
| python-shell | 5.x | Node-Python IPC | Simple stdio-based JSON communication. Battle-tested. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @electron/osx-sign | latest | macOS signing | Signs all binaries in app bundle |
| @electron/notarize | latest | macOS notarization | Submits to Apple for notarization |
| electron-rebuild | latest | Native module rebuild | Required for better-sqlite3 |
| spaCy | 3.8.x | NLP (Python) | Entity extraction - preloaded at startup |
| en_core_web_sm | 3.8.x | English NER model | 12MB model, fast inference |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Electron Forge | electron-builder standalone | electron-builder has more NSIS customization but Forge is official toolchain |
| PyInstaller --onedir | PyInstaller --onefile | --onefile has 10-30 second cold start for spaCy (unacceptable) |
| python-shell | FastAPI/HTTP | HTTP adds overhead for local IPC, harder to bundle |
| better-sqlite3 | sql.js | sql.js is in-memory only, no persistence |

**Installation:**

```bash
# Electron shell (Plan 01-01)
npm init electron-app@latest samsara -- --template=vite-typescript
npm install better-sqlite3 python-shell
npm install -D electron-rebuild @electron-forge/maker-nsis

# Python sidecar (Plan 01-02)
pip install spacy==3.8.11 pyinstaller==6.18.0
python -m spacy download en_core_web_sm
```

## Architecture Patterns

### Recommended Project Structure

```
samsara/
├── package.json
├── forge.config.ts              # Electron Forge configuration
├── vite.main.config.ts          # Main process Vite config
├── vite.preload.config.ts       # Preload Vite config
├── vite.renderer.config.ts      # Renderer Vite config
├── src/
│   ├── main/
│   │   ├── index.ts             # Main process entry (MAIN_WINDOW_VITE_DEV_SERVER_URL)
│   │   ├── preload.ts           # Preload script (contextBridge)
│   │   ├── pythonManager.ts     # Python sidecar lifecycle
│   │   └── database.ts          # better-sqlite3 wrapper
│   └── renderer/
│       ├── index.html
│       └── renderer.ts
├── python-src/
│   ├── main.py                  # Python entry point (stdin/stdout JSON)
│   ├── requirements.txt
│   └── samsara.spec             # PyInstaller spec file
├── python-dist/                 # PyInstaller output (gitignored)
├── scripts/
│   ├── build-python.sh          # PyInstaller build script
│   └── build-python.ps1         # Windows version
└── entitlements.plist           # macOS code signing entitlements
```

### Pattern 1: Vite Dev Server URLs for Forge

**What:** Use global variables for HMR support
**When to use:** Loading renderer window in main process
**Example:**
```typescript
// Source: https://www.electronforge.io/config/plugins/vite
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}
```

### Pattern 2: Python Sidecar with Health Check

**What:** Spawn Python at app start, verify readiness before accepting requests
**When to use:** Always - prevents "Python not ready" errors
**Example:**
```typescript
// Source: Architecture patterns from prior research
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';

let pythonProcess: ChildProcess | null = null;
let pythonReady = false;
const pendingRequests = new Map<string, { resolve: Function; reject: Function }>();

function findPythonPath(): string {
  const isPackaged = app.isPackaged;
  const exeName = process.platform === 'win32' ? 'samsara-backend.exe' : 'samsara-backend';

  if (isPackaged) {
    return path.join(process.resourcesPath, 'python', exeName);
  }
  return path.join(__dirname, '..', 'python-dist', 'samsara-backend', exeName);
}

async function startPython(): Promise<void> {
  const pythonPath = findPythonPath();

  pythonProcess = spawn(pythonPath, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const rl = readline.createInterface({ input: pythonProcess.stdout! });
  rl.on('line', (line) => {
    const response = JSON.parse(line);
    const pending = pendingRequests.get(response.id);
    if (pending) {
      pendingRequests.delete(response.id);
      response.success ? pending.resolve(response.data) : pending.reject(new Error(response.error));
    }
  });

  // Health check - 10 second timeout per success criteria
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await sendToPython({ action: 'health_check' }, 500);
      pythonReady = true;
      console.log('Python sidecar ready');
      return;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('Python sidecar failed to start within 10 seconds');
}
```

### Pattern 3: SQLite in userData with WAL

**What:** Initialize SQLite in user-writable location with WAL mode
**When to use:** Database initialization in main process
**Example:**
```typescript
// Source: https://github.com/WiseLibs/better-sqlite3
import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';

const dbPath = path.join(app.getPath('userData'), 'samsara.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');  // NORMAL is safe with WAL

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

export { db, dbPath };
```

### Anti-Patterns to Avoid

- **PyInstaller --onefile for spaCy:** Causes 10-30 second cold start due to extraction. Use --onedir and zip for distribution.
- **Loading spaCy model per-request:** Model loading takes 2-5 seconds. Load once at startup.
- **Running SQLite in renderer process:** Requires disabling context isolation (security risk). Keep in main process.
- **Putting Python in ASAR archive:** Cannot execute files from inside asar. Use extraResources.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Python-Node IPC | Custom socket protocol | python-shell JSON mode | Handles buffering, newlines, encoding edge cases |
| macOS signing | Manual codesign calls | @electron/osx-sign | Handles deep signing, entitlements, hardened runtime |
| Windows installer | Custom NSIS scripts | electron-forge-maker-nsis | Integrates with Forge, handles updates |
| Native module rebuild | Manual node-gyp | electron-rebuild | Auto-detects Electron version, handles ABI |

**Key insight:** The bundling and signing toolchain has many edge cases that are only discovered at distribution time. Use established tools that have already solved these problems.

## Common Pitfalls

### Pitfall 1: spaCy Hidden Imports Not Detected

**What goes wrong:** PyInstaller build succeeds but app crashes on `spacy.load()` with import errors like "No module named 'srsly.msgpack.util'"
**Why it happens:** spaCy uses dynamic imports that PyInstaller's static analysis cannot detect
**How to avoid:** Use explicit hidden imports and collect flags in PyInstaller command:
```bash
pyinstaller --onedir --name samsara-backend main.py \
  --hidden-import srsly.msgpack.util \
  --hidden-import cymem --hidden-import cymem.cymem \
  --hidden-import preshed.maps \
  --collect-submodules thinc --collect-data thinc \
  --collect-submodules blis \
  --collect-submodules spacy --collect-data spacy \
  --collect-submodules en_core_web_sm --collect-data en_core_web_sm \
  --copy-metadata en_core_web_sm \
  --collect-submodules spacy_legacy --copy-metadata spacy_legacy
```
**Warning signs:** Build warnings about missing modules, works in dev but not in packaged app

### Pitfall 2: macOS Gatekeeper Rejects Unsigned Embedded Binaries

**What goes wrong:** App is signed but macOS still shows "damaged" or "unidentified developer" warning
**Why it happens:** PyInstaller output contains multiple executables that all need signing. Apple notarization scans ALL binaries.
**How to avoid:**
1. Sign with `--deep` flag (signs entire bundle recursively)
2. Use hardened runtime with required entitlements:
```xml
<!-- entitlements.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```
3. Use `notarytool` (not deprecated `altool`) for submission
**Warning signs:** "Unable to notarize" errors, Gatekeeper warnings on test machines

### Pitfall 3: Windows SmartScreen Warning Even With Valid Signature

**What goes wrong:** Signed app shows "Windows protected your PC" warning on first install
**Why it happens:** SmartScreen reputation is based on download volume, not just signature validity. New apps have no reputation.
**How to avoid:**
1. Use Azure Trusted Signing (immediate reputation) or EV certificate
2. Accept that standard OV certificates take weeks to build reputation
3. Consider distributing through Microsoft Store for immediate trust
**Warning signs:** Test users reporting SmartScreen warnings, app flagged as "unrecognized"

### Pitfall 4: Python Sidecar Zombie Processes

**What goes wrong:** Python process keeps running after Electron closes. Multiple zombies accumulate.
**Why it happens:** Electron crashes without cleanup, or shutdown handlers not registered
**How to avoid:**
```typescript
// Register cleanup on all exit paths
app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.stdin?.write(JSON.stringify({ action: 'shutdown' }) + '\n');
    setTimeout(() => pythonProcess?.kill('SIGTERM'), 1000);
  }
});

// Windows-specific: kill process tree
if (process.platform === 'win32') {
  app.on('will-quit', () => {
    if (pythonProcess) {
      spawn('taskkill', ['/pid', pythonProcess.pid!.toString(), '/f', '/t']);
    }
  });
}
```
**Warning signs:** Multiple Python processes in task manager, increasing memory usage over time

### Pitfall 5: better-sqlite3 Not Rebuilt for Electron

**What goes wrong:** App crashes on startup with "Module was compiled against a different Node.js version"
**Why it happens:** better-sqlite3 is a native module compiled for system Node, not Electron's Node
**How to avoid:** Run `npx electron-rebuild` after every `npm install`
**Warning signs:** Native module errors in console, works with `node` but not `electron`

## Code Examples

Verified patterns from official sources:

### PyInstaller Spec File for spaCy

```python
# samsara.spec
# Source: https://github.com/explosion/spaCy/discussions/9205

import spacy
spacy_path = spacy.__path__[0]

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        (spacy_path, 'spacy'),
    ],
    hiddenimports=[
        'srsly.msgpack.util',
        'cymem', 'cymem.cymem',
        'preshed.maps',
        'thinc.backends.linalg',
        'blis',
        'spacy.lang.en',
        'spacy_legacy',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

# Collect en_core_web_sm model data
import en_core_web_sm
model_path = en_core_web_sm.__path__[0]
a.datas += Tree(model_path, prefix='en_core_web_sm')

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='samsara-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # UPX often causes issues with spaCy
    console=True,  # Keep console for debugging; remove for production
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='samsara-backend',
)
```

### Python Main Entry Point with Preloaded spaCy

```python
# main.py
# Source: https://github.com/explosion/spaCy/discussions/8402

import sys
import json
import spacy

# Preload model at startup (before accepting requests)
print(json.dumps({"status": "loading_model"}), flush=True)
nlp = spacy.load("en_core_web_sm", disable=["parser", "lemmatizer"])
print(json.dumps({"status": "model_loaded"}), flush=True)

def handle_request(request):
    action = request.get('action')
    request_id = request.get('id', 'unknown')

    if action == 'health_check':
        return {'id': request_id, 'success': True, 'data': {'status': 'healthy', 'model': 'en_core_web_sm'}}

    return {'id': request_id, 'success': False, 'error': f'Unknown action: {action}'}

# Main loop
for line in sys.stdin:
    try:
        request = json.loads(line.strip())
        response = handle_request(request)
        print(json.dumps(response), flush=True)
    except json.JSONDecodeError as e:
        print(json.dumps({'success': False, 'error': f'Invalid JSON: {str(e)}'}), flush=True)
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}), flush=True)
```

### Electron Forge Config with NSIS Maker

```typescript
// forge.config.ts
// Source: https://www.electronforge.io/, https://github.com/felixrieseberg/electron-forge-maker-nsis

import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerNSIS } from 'electron-forge-maker-nsis';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    extraResource: [
      './python-dist/samsara-backend',  // Python sidecar
    ],
    // macOS signing
    osxSign: {
      identity: 'Developer ID Application: Your Name (TEAM_ID)',
      'hardened-runtime': true,
      entitlements: './entitlements.plist',
      'entitlements-inherit': './entitlements.plist',
    },
    osxNotarize: {
      appleId: process.env.APPLE_ID!,
      appleIdPassword: process.env.APPLE_ID_PASSWORD!,
      teamId: process.env.APPLE_TEAM_ID!,
    },
  },
  makers: [
    new MakerNSIS({
      // Windows signing with Azure Trusted Signing
      codesigning: {
        azureSignOptions: {
          endpoint: process.env.AZURE_ENDPOINT!,
          certificateProfileName: process.env.AZURE_CERT_PROFILE!,
          codeSigningAccountName: process.env.AZURE_ACCOUNT!,
        },
      },
    }),
    // macOS DMG
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
      },
    },
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
        { entry: 'src/main/preload.ts', config: 'vite.preload.config.ts' },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.ts' },
      ],
    }),
  ],
};

export default config;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `altool` for notarization | `notarytool` | 2023 | altool deprecated, notarytool is faster |
| Software OV certs for Windows | Azure Trusted Signing or EV | 2024 | Standard OV certs no longer trusted by SmartScreen |
| Squirrel.Windows | NSIS | 2023 | Squirrel deprecated, NSIS recommended |
| Electron Forge Webpack | Electron Forge Vite | 2024 | Vite is faster, better HMR |
| spaCy 2.x bundling | spaCy 3.x with explicit hooks | 2021 | 3.x requires more hidden imports |

**Deprecated/outdated:**
- `altool`: Use `notarytool` instead. Migration required.
- Squirrel.Windows: Deprecated by electron-builder. Use NSIS.
- Software OV certificates: Provide no SmartScreen benefit. Use Azure Trusted Signing or EV.

## Open Questions

Things that couldn't be fully resolved:

1. **Exact PyInstaller bundle size for spaCy en_core_web_sm**
   - What we know: en_core_web_sm is 12MB, but full bundle with dependencies is larger
   - What's unclear: Final --onedir size (estimated 100-200MB based on similar projects)
   - Recommendation: Build and measure in Plan 01-02; optimize later if needed

2. **Windows 11 context menu behavior changes**
   - What we know: Windows 11 has new context menu that hides items under "Show more options"
   - What's unclear: Whether file associations are affected (this is Phase 6 concern)
   - Recommendation: Note for Phase 6 planning; not Phase 1 scope

3. **Vite plugin stability**
   - What we know: Marked "experimental" since v7.5.0
   - What's unclear: Whether breaking changes will affect us
   - Recommendation: Pin version in package.json, test on minor updates

## Sources

### Primary (HIGH confidence)
- [Electron Forge Vite Plugin](https://www.electronforge.io/config/plugins/vite) - Configuration patterns
- [electron-builder Windows Code Signing](https://www.electron.build/code-signing-win.html) - Azure Trusted Signing setup
- [Electron Code Signing Tutorial](https://www.electronjs.org/docs/latest/tutorial/code-signing) - macOS notarization requirements
- [PyInstaller Troubleshooting](https://pyinstaller.org/en/stable/when-things-go-wrong.html) - Debug techniques
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) - WAL mode, performance

### Secondary (MEDIUM confidence)
- [spaCy PyInstaller Discussion #9205](https://github.com/explosion/spaCy/discussions/9205) - Hidden imports list
- [spaCy Performance FAQ #8402](https://github.com/explosion/spaCy/discussions/8402) - Model loading optimization
- [macOS PyInstaller Signing Gist](https://gist.github.com/txoof/0636835d3cc65245c6288b2374799c43) - Entitlements and codesign commands
- [electron-forge-maker-nsis](https://github.com/felixrieseberg/electron-forge-maker-nsis) - NSIS maker for Forge
- [Hendrik Erz Azure Trusted Signing Guide](https://www.hendrik-erz.de/post/code-signing-with-azure-trusted-signing-on-github-actions) - GitHub Actions integration

### Tertiary (LOW confidence)
- [PyInstaller --onedir vs --onefile discussions](https://github.com/orgs/pyinstaller/discussions/8970) - Startup time comparisons
- WebSearch results for ecosystem patterns - Verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All versions verified via official sources (PyPI, npm, Electron releases)
- Architecture: HIGH - Patterns from official Electron docs and established community examples
- Pitfalls: HIGH - Verified via GitHub issues, official troubleshooting docs, and prior project research

**Research date:** 2026-01-23
**Valid until:** 2026-02-23 (30 days - stable domain, but check for Electron/Forge releases)
