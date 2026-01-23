# Technology Stack

**Project:** Samsara - Sovereign Recruitment Suite
**Researched:** 2026-01-23
**Research Mode:** Ecosystem (Stack Dimension)

---

## Executive Summary

This stack is optimized for a **local-first, privacy-preserving desktop application** with heavy PDF processing. The architecture uses Electron for the UI shell, Python as a sidecar process for document processing, and SQLite for local persistence. All technologies are selected for offline operation, GDPR compliance (zero data egress), and sub-2-second processing targets.

---

## Recommended Stack

### Desktop Shell (Electron)

| Technology | Version | Purpose | Confidence | Rationale |
|------------|---------|---------|------------|-----------|
| **Electron** | 39.x+ | Desktop app shell | HIGH | Latest stable with Chromium 142, Node 22. Official tool for cross-platform desktop apps. Active development with 6 major releases in 2025. |
| **Electron Forge** | 7.x | Build toolchain | HIGH | Official Electron toolchain. Handles packaging, code signing, and distribution. Supports NSIS installers for Windows context menu integration. |
| **Vite Plugin for Forge** | latest | Build bundler | HIGH | Fast HMR, ES modules. Recommended over Webpack for 2025 projects. Use `@electron-forge/plugin-vite`. Note: Still marked "experimental" as of v7.5.0 but stable in practice. |
| **electron-builder** | 26.x | Packaging (alternative) | MEDIUM | If Forge doesn't meet packaging needs, electron-builder offers more NSIS customization options for shell extension registration. |

**Source:** [Electron Releases](https://releases.electronjs.org/), [Electron Forge Vite Plugin](https://www.electronforge.io/config/plugins/vite)

### Frontend Framework

| Technology | Version | Purpose | Confidence | Rationale |
|------------|---------|---------|------------|-----------|
| **React** | 18.x | UI framework | HIGH | Most mature ecosystem for desktop apps. Component model works well with Electron's multi-window architecture. |
| **TypeScript** | 5.x | Type safety | HIGH | Essential for maintainable desktop apps. Full type coverage for IPC, data models, and Python API contracts. |
| **Tailwind CSS** | 3.x | Styling | HIGH | Utility-first CSS. Fast iteration, consistent design system. Works well with component libraries. |
| **shadcn/ui** | latest | Component library | HIGH | Accessible, customizable components built on Radix UI. Not a dependency but copy-paste components - keeps bundle small. |
| **Zustand** | 5.x | State management | HIGH | Lightweight (1.2kb), minimal boilerplate. Perfect for medium-complexity apps like Samsara. Zustand over Redux for 90% of desktop apps in 2025. |

**Source:** [Zustand Comparison](https://zustand.docs.pmnd.rs/getting-started/comparison), [shadcn/ui](https://ui.shadcn.com/)

### Electron IPC Communication

| Technology | Pattern | Purpose | Confidence | Rationale |
|------------|---------|---------|------------|-----------|
| **ipcMain.handle + ipcRenderer.invoke** | Request/Response | Main process API calls | HIGH | Official recommended pattern since Electron 7. Returns Promise, clean async flow. |
| **contextBridge** | Security | Expose APIs to renderer | HIGH | Required for secure IPC. Never expose raw ipcRenderer. |
| **Preload scripts** | Security | Bridge main/renderer | HIGH | Mandatory with contextIsolation enabled (default since Electron 12). |

**Source:** [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc)

### Python Sidecar (Document Processing)

| Technology | Version | Purpose | Confidence | Rationale |
|------------|---------|---------|------------|-----------|
| **Python** | 3.11 or 3.12 | Sidecar runtime | HIGH | 3.11 has 10-60% performance improvement. 3.12 adds more optimizations. Avoid 3.10.0 (PyInstaller bug). All recommended libraries support 3.9-3.14. |
| **python-shell** | 5.x | Node-Python IPC | MEDIUM | Simple stdio-based communication. JSON mode for structured data. Battle-tested but not heavily maintained. Consider FastAPI/HTTP for complex APIs. |
| **PyInstaller** | 6.18.x | Python bundling | HIGH | Bundle Python + dependencies into single executable. Required for distributing to users without Python installed. Supports 3.8-3.14. |

**Source:** [PyInstaller PyPI](https://pypi.org/project/pyinstaller/), [python-shell npm](https://www.npmjs.com/package/python-shell)

### PDF Processing (Python)

| Technology | Version | Purpose | Confidence | Rationale |
|------------|---------|---------|------------|-----------|
| **PyMuPDF (fitz)** | 1.26.x | Fast PDF extraction | HIGH | Fastest Python PDF library. 10x faster than pdfplumber for bulk extraction. Native bindings to MuPDF. Use for initial text extraction and image rendering. |
| **pdfplumber** | 0.11.x | Table extraction | HIGH | Best-in-class table detection. Use for structured resume sections (work history tables, skills lists). Slower than PyMuPDF but superior table handling. |
| **ReportLab** | 4.4.x | PDF generation | HIGH | Industry standard for programmatic PDF creation. Canvas-based API for precise layout control. Use for branded PDF output. Supports Python 3.9-3.14. |
| **WeasyPrint** | 68.x | HTML-to-PDF | MEDIUM | Alternative to ReportLab if using HTML templates for branded output. Requires Python 3.10+. No JavaScript support. |

**Recommendation:** Use PyMuPDF for initial parsing (speed), pdfplumber for table extraction (accuracy), ReportLab for PDF generation (control).

**Source:** [PyMuPDF PyPI](https://pypi.org/project/pymupdf/), [pdfplumber PyPI](https://pypi.org/project/pdfplumber/), [ReportLab PyPI](https://pypi.org/project/reportlab/)

### NLP / Resume Parsing (Python)

| Technology | Version | Purpose | Confidence | Rationale |
|------------|---------|---------|------------|-----------|
| **spaCy** | 3.8.x | NER, entity extraction | HIGH | Production-grade NLP. Pre-trained models for names, organizations, dates. Fine-tunable for resume-specific entities (skills, job titles). Supports Python 3.9-3.14. |
| **en_core_web_sm** | 3.8.x | English model (small) | HIGH | 12MB model, fast inference. Sufficient for basic NER. Use `en_core_web_trf` (transformer) only if accuracy issues arise. |
| **spacy-resume-ner** | latest | Resume-specific NER | LOW | Community model for resume parsing. Evaluate before adopting - may need custom training. |

**Source:** [spaCy PyPI](https://pypi.org/project/spacy/), [spaCy NER Documentation](https://spacy.io/usage/linguistic-features)

### Database (Local Storage)

| Technology | Version | Purpose | Confidence | Rationale |
|------------|---------|---------|------------|-----------|
| **better-sqlite3** | 12.6.x | SQLite bindings | HIGH | Fastest Node.js SQLite library. Synchronous API (actually faster than async alternatives due to reduced overhead). 11-24x faster than alternatives in benchmarks. |
| **SQLite** | 3.x | Database engine | HIGH | Perfect for local-first apps. Single file, zero config, ACID compliant. Handles concurrent reads well. WAL mode for best write performance. |
| **Drizzle ORM** | 0.36.x | Type-safe queries | MEDIUM | Lightweight ORM with TypeScript inference. Alternative to raw SQL. Optional - raw better-sqlite3 is fine for simpler schemas. |

**Do NOT use:** sql.js (in-memory only, no persistence), node-sqlite3 (async, slower), Sequelize (heavy ORM overhead for local app).

**Source:** [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3), [Local-First Apps 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)

### Windows Shell Integration

| Technology | Purpose | Confidence | Rationale |
|------------|---------|------------|-----------|
| **NSIS Custom Scripts** | Context menu registration | HIGH | electron-builder/Forge use NSIS for Windows installers. Custom `installer.nsh` can write registry keys for shell integration. |
| **Registry paths** | Shell handler | HIGH | `HKEY_CLASSES_ROOT\*\shell\Samsara` for file context menu. `HKEY_CLASSES_ROOT\Directory\shell\Samsara` for folder context menu. |
| **File type associations** | .pdf handling | MEDIUM | Optional: Register as PDF handler. Registry under `HKEY_CLASSES_ROOT\.pdf\OpenWithProgids`. |

**Source:** [electron-builder NSIS](https://www.electron.build/nsis.html), [Microsoft Shell Handlers](https://learn.microsoft.com/en-us/windows/win32/shell/context-menu-handlers)

### PDF Visual Editing (Redaction UI)

| Technology | Version | Purpose | Confidence | Rationale |
|------------|---------|------------|-----------|
| **pdf.js** | 4.x | PDF rendering | HIGH | Mozilla's PDF renderer. Render PDFs in canvas for visual selection. Free, open source. |
| **Custom Canvas Overlay** | - | Redaction selection | MEDIUM | Build redaction selection UI on canvas overlay. Track coordinates, send to Python for actual redaction. |
| **Nutrient SDK** | - | Full-featured PDF editor | LOW | Commercial option if pdf.js insufficient. Includes built-in redaction. Evaluate cost vs. build. |

**Recommendation:** Start with pdf.js + custom canvas overlay. Redaction coordinates sent to Python (PyMuPDF can apply redactions). Only evaluate commercial SDKs if custom solution proves inadequate.

**Source:** [pdf.js](https://mozilla.github.io/pdf.js/), [Nutrient Electron SDK](https://www.nutrient.io/sdk/electron)

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Desktop Framework | Electron | Tauri | Tauri is lighter but Python sidecar integration is better documented for Electron. Tauri's Rust backend doesn't help when heavy processing is in Python anyway. |
| Build Tool | Vite (via Forge) | Webpack | Webpack is slower, more complex config. Vite HMR is near-instant. |
| State Management | Zustand | Redux Toolkit | Redux adds boilerplate without clear benefit for medium app. Zustand handles Samsara's complexity with less code. |
| PDF Parsing | PyMuPDF + pdfplumber | pypdf, PDFMiner | pypdf slower, fewer features. PDFMiner is pdfplumber's base - use pdfplumber for better API. |
| PDF Generation | ReportLab | FPDF2, Pillow | FPDF2 less mature. Pillow can't generate real PDFs. ReportLab is industry standard. |
| Node-Python IPC | python-shell | zerorpc, HTTP/FastAPI | zerorpc has C++ dependencies, harder to bundle. HTTP adds overhead for local IPC. python-shell is simplest for stdio. |
| SQLite Bindings | better-sqlite3 | sql.js, node-sqlite3 | sql.js is in-memory only. node-sqlite3 is async and slower. better-sqlite3 is fastest. |
| NLP | spaCy | NLTK, Transformers | NLTK is slower, less accurate. Transformers overkill for NER - spaCy models are sufficient. |

---

## Version Matrix

All versions verified as of 2026-01-23:

| Package | Verified Version | Python/Node Requirement | Source |
|---------|------------------|-------------------------|--------|
| Electron | 39.x | Node 22.x | [releases.electronjs.org](https://releases.electronjs.org/) |
| better-sqlite3 | 12.6.2 | Node 14.21.1+ | [GitHub](https://github.com/WiseLibs/better-sqlite3) |
| PyMuPDF | 1.26.7 | Python 3.10+ | [PyPI](https://pypi.org/project/pymupdf/) |
| pdfplumber | 0.11.9 | Python 3.8+ | [PyPI](https://pypi.org/project/pdfplumber/) |
| ReportLab | 4.4.9 | Python 3.9+ | [PyPI](https://pypi.org/project/reportlab/) |
| WeasyPrint | 68.0 | Python 3.10+ | [PyPI](https://pypi.org/project/weasyprint/) |
| spaCy | 3.8.11 | Python 3.9+ | [PyPI](https://pypi.org/project/spacy/) |
| PyInstaller | 6.18.0 | Python 3.8-3.14 | [PyPI](https://pypi.org/project/pyinstaller/) |

**Python Version Recommendation:** Use **Python 3.11** or **3.12**. Both are compatible with all libraries. 3.11 has significant performance improvements. Avoid 3.10.0 specifically (PyInstaller bug).

---

## Installation Commands

### Node.js Dependencies

```bash
# Initialize Electron project with Forge + Vite
npm init electron-app@latest samsara -- --template=vite-typescript

# Core dependencies
npm install react react-dom
npm install better-sqlite3
npm install zustand
npm install electron-context-menu  # Optional: in-app context menus
npm install python-shell

# Dev dependencies
npm install -D typescript @types/react @types/react-dom
npm install -D tailwindcss postcss autoprefixer
npm install -D @types/better-sqlite3
npm install -D electron-rebuild  # Rebuild native modules
```

### Python Dependencies

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Core dependencies
pip install pymupdf==1.26.7
pip install pdfplumber==0.11.9
pip install reportlab==4.4.9
pip install spacy==3.8.11
pip install pyinstaller==6.18.0

# Download spaCy model
python -m spacy download en_core_web_sm

# Optional: WeasyPrint for HTML-to-PDF
pip install weasyprint==68.0
```

### Rebuild Native Modules for Electron

```bash
# After npm install, rebuild better-sqlite3 for Electron's Node version
npx electron-rebuild
```

---

## Architecture Implications

### Performance Targets

| Operation | Target | Stack Component | Notes |
|-----------|--------|-----------------|-------|
| PDF parse | < 500ms | PyMuPDF | Fast C bindings |
| Entity extraction | < 1s | spaCy en_core_web_sm | Small model, CPU inference |
| Branded PDF generation | < 500ms | ReportLab | Pre-compiled templates |
| **Total per resume** | **< 2s** | Combined | Meets requirement |

### Data Flow

```
User drops PDF
    |
    v
[Electron Main] --> python-shell --> [Python Sidecar]
    |                                      |
    v                                      v
[better-sqlite3]                    [PyMuPDF: extract]
    |                                      |
    v                                      v
[Local SQLite DB]                   [spaCy: parse entities]
                                          |
                                          v
                                    [ReportLab: generate branded PDF]
                                          |
                                          v
                              [Return to Electron via stdout JSON]
```

### Security Model

- **Context Isolation:** Enabled (Electron default)
- **Node Integration:** Disabled in renderer
- **Preload Scripts:** Required for all main process access
- **IPC Whitelist:** Only expose specific channels via contextBridge
- **Python Sidecar:** Communicates via stdio, no network exposure
- **SQLite:** Local file only, no network sync

---

## What NOT to Use

| Technology | Why Avoid |
|------------|-----------|
| **Tauri** | Python sidecar pattern better documented for Electron. Tauri's Rust backend doesn't help when processing is in Python. |
| **node-sqlite3** | Async API is actually slower due to callback overhead. Use better-sqlite3. |
| **sql.js** | In-memory only, no real persistence. Not suitable for desktop app. |
| **Sequelize/TypeORM** | Heavy ORMs add overhead. better-sqlite3 with raw SQL or Drizzle is sufficient. |
| **zerorpc** | C++ dependencies complicate bundling. python-shell is simpler. |
| **PyPDF2/pypdf** | Slower, fewer features than PyMuPDF. |
| **NLTK** | Slower and less accurate than spaCy for NER. |
| **Redux** | Overkill for Samsara's complexity. Zustand is simpler with same capabilities. |
| **Create React App** | Deprecated. Use Vite. |
| **Webpack** | Slower than Vite, more complex configuration. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Electron + Forge + Vite | HIGH | Official toolchain, well-documented |
| React + TypeScript + Tailwind | HIGH | Standard modern stack |
| better-sqlite3 | HIGH | Benchmarked, widely adopted |
| PyMuPDF + pdfplumber | HIGH | Verified versions, well-documented APIs |
| ReportLab | HIGH | Industry standard, active maintenance |
| spaCy | HIGH | Production-grade, good resume NER support |
| python-shell | MEDIUM | Works but not heavily maintained. May need fallback to HTTP. |
| NSIS shell integration | MEDIUM | Documented but requires custom scripting. Test early. |
| pdf.js + custom redaction UI | MEDIUM | Standard approach but requires custom dev work |

---

## Open Questions for Phase-Specific Research

1. **Python bundling size:** PyInstaller onefile with PyMuPDF + spaCy may be large (100-200MB). Need to test actual bundle size and startup time.

2. **spaCy model selection:** Start with `en_core_web_sm`. May need `en_core_web_md` or custom training if accuracy insufficient for resume entities.

3. **Windows 11 context menu:** Windows 11 has new context menu behavior. May need registry tweaks for "Show more options" visibility.

4. **Hot reload with Python sidecar:** Vite HMR works for renderer, but Python changes require sidecar restart. Consider development workflow.

---

## Sources

### Official Documentation (HIGH confidence)
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Forge NSIS](https://www.electron.build/nsis.html)
- [PyMuPDF Documentation](https://pymupdf.readthedocs.io/)
- [pdfplumber GitHub](https://github.com/jsvine/pdfplumber)
- [spaCy Linguistic Features](https://spacy.io/usage/linguistic-features)
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3)

### Version Verification (HIGH confidence)
- [PyPI - pdfplumber 0.11.9](https://pypi.org/project/pdfplumber/)
- [PyPI - PyMuPDF 1.26.7](https://pypi.org/project/pymupdf/)
- [PyPI - ReportLab 4.4.9](https://pypi.org/project/reportlab/)
- [PyPI - spaCy 3.8.11](https://pypi.org/project/spacy/)
- [PyPI - PyInstaller 6.18.0](https://pypi.org/project/pyinstaller/)
- [PyPI - WeasyPrint 68.0](https://pypi.org/project/weasyprint/)
- [Electron Releases](https://releases.electronjs.org/)

### Ecosystem Research (MEDIUM confidence)
- [Electron vs Tauri 2025](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/)
- [PDF Extractors 2025 Comparison](https://onlyoneaman.medium.com/i-tested-7-python-pdf-extractors-so-you-dont-have-to-2025-edition-c88013922257)
- [Local-First Apps 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [Zustand vs Redux 2025](https://zustand.docs.pmnd.rs/getting-started/comparison)
- [React State Management 2025](https://www.zignuts.com/blog/react-state-management-2025)
