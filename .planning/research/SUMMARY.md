# Project Research Summary

**Project:** Samsara - Sovereign Recruitment Suite
**Domain:** Local-first desktop CV/resume formatting application with AI parsing
**Researched:** 2026-01-23
**Confidence:** MEDIUM-HIGH

## Executive Summary

Samsara is a desktop application for recruitment agencies that needs to parse, anonymize, and brand CVs while maintaining complete data sovereignty. The research reveals that this is best built as an **Electron + Python sidecar architecture**, where Electron handles the cross-platform UI and Python manages the heavy lifting (PDF parsing with PyMuPDF/pdfplumber, NLP extraction with spaCy, and PDF generation with ReportLab). All data stays local via SQLite with better-sqlite3 bindings.

The recommended approach prioritizes **proving the distribution pipeline first** (PyInstaller bundling, code signing) before building features, as Python bundling with ML dependencies is notoriously problematic. Phase ordering should follow the critical path: establish foundation (Electron shell + Python sidecar + IPC), build single-CV parsing pipeline, add visual editor and anonymization, then scale to bulk processing. The <2 second processing requirement is achievable by preloading spaCy models at startup, using the smaller en_core_web_sm model (12MB), and keeping the Python process alive rather than spawning per-request.

The key risks are: (1) PyInstaller distribution failures with spaCy's complex hidden imports, (2) PDF parsing failing on real-world resumes (two-column layouts, scanned documents), and (3) memory leaks during bulk processing. Mitigation involves testing distribution in Phase 1, building an adversarial resume corpus for Phase 2, and explicit resource cleanup with batch processing in Phase 3. The "sovereign" positioning (local-first, offline, zero data egress) is the primary competitive differentiator and must not be compromised.

## Key Findings

### Recommended Stack

Samsara uses a proven Electron + Python sidecar pattern, communicating via stdin/stdout JSON (python-shell library). Electron 39.x with Forge/Vite provides the modern desktop shell, React 18.x with TypeScript for the UI, and better-sqlite3 for local persistence. Python 3.11/3.12 runs as a bundled PyInstaller executable, using PyMuPDF (fast extraction), pdfplumber (table parsing), spaCy 3.8.x (NER), and ReportLab (PDF generation).

**Core technologies:**
- **Electron 39.x + Forge + Vite**: Cross-platform desktop shell with fast HMR and official build toolchain
- **Python 3.11/3.12 + PyInstaller**: Sidecar runtime for PDF/NLP processing, bundled as standalone executable
- **PyMuPDF 1.26.x + pdfplumber 0.11.x**: Fast PDF extraction (PyMuPDF) + superior table detection (pdfplumber)
- **spaCy 3.8.x (en_core_web_sm)**: Production-grade NLP for entity extraction, 12MB model with <1s inference
- **better-sqlite3 12.6.x**: Fastest Node.js SQLite bindings, synchronous API, 11-24x faster than alternatives
- **ReportLab 4.4.x**: Industry-standard programmatic PDF generation for branded output
- **React 18.x + TypeScript 5.x + Tailwind 3.x**: Modern UI stack with type safety and utility-first styling
- **python-shell 5.x**: Simple stdio-based IPC for Node-Python communication

**Critical version notes:**
- Use Python 3.11 or 3.12 (significant performance gains, avoid 3.10.0 due to PyInstaller bug)
- Use PyInstaller `--onedir` not `--onefile` for faster startup (critical for <2s requirement)
- Electron Forge Vite plugin still marked "experimental" but stable in practice

### Expected Features

Research identifies clear table stakes vs. competitive differentiators for CV formatting tools.

**Must have (table stakes):**
- Multi-format input (PDF, DOCX) - 99%+ of CVs come in these formats
- Contact information extraction (name, email, phone, address) - 95%+ accuracy expected
- Work experience extraction - complex date parsing, company/role disambiguation
- Education extraction - institution, degree, dates, fields of study
- Skills extraction (raw) - fundamental for candidate matching
- Agency branding/templates - logo, colors, fonts customization
- Export to DOCX and PDF - standard output formats
- Basic anonymization (name, contact details) - GDPR compliance
- Manual edit/correction UI - parsing never 100% accurate
- Bulk processing (10-100 CVs) - standard agency workflow

**Should have (competitive):**
- Local-first/offline operation - THE core differentiator, addresses data sovereignty
- "Blind Profile" front sheets - unique agency workflow, one-click anonymized summary
- Human-in-the-loop confidence scoring - visual indicators for low-confidence extractions
- Bulk processing (100+ CVs) - higher capacity than competitors (Workable caps at 100)
- Granular anonymization (26+ parameters) - employer names, universities, dates beyond basic name redaction
- Skills taxonomy mapping - normalize "React.js", "ReactJS", "React" to single term (RChilli: 3M+ skills)
- Template library - pre-built professional templates reduce setup time

**Defer (v2+):**
- Multi-language support (start English-only, add 2-3 EU languages based on demand)
- OCR for scanned CVs (nice-to-have, most CVs are native digital)
- LinkedIn profile import (PDF export covers most cases)
- Duplicate detection (conflicts with local-first simplicity)
- ATS/CRM integration (agencies already have investments in Bullhorn, JobAdder)
- AI job matching/ranking (out of scope, requires large datasets)

### Architecture Approach

The architecture uses a clear three-layer model: Electron renderer (UI), Electron main process (orchestration + SQLite), and Python sidecar (processing). IPC flows from renderer through main to Python via stdio JSON messages. Python stays alive for the application lifecycle to avoid spaCy model reload penalties (10-30 seconds). PyInstaller bundles Python with all dependencies as a standalone executable placed in electron-builder's extraResources.

**Major components:**
1. **Electron Renderer (React/TypeScript)** - UI rendering, user interaction, display results. Communicates with main via ipcRenderer.invoke()
2. **Electron Main Process (Node.js)** - Window management, Python lifecycle, SQLite operations, IPC orchestration. Uses ipcMain.handle() + contextBridge for security
3. **Python Sidecar (PyInstaller executable)** - PDF parsing (PyMuPDF/pdfplumber), NLP extraction (spaCy), PDF generation (ReportLab). Listens on stdin, responds via stdout JSON
4. **SQLite Database (better-sqlite3)** - Local persistence for resumes, extracted data, settings. WAL mode for concurrent access. Single file in app.getPath('userData')

**Key patterns:**
- Request/response with correlation IDs for concurrent requests
- Health check on Python startup before accepting user requests
- Graceful degradation if Python crashes (auto-restart with user notification)
- Preload spaCy model at sidecar startup, not per-request
- Batch IPC calls (10-50 file paths) to avoid IPC bottleneck
- Explicit resource cleanup (PDF doc.close(), pdfplumber page.flush_cache())

### Critical Pitfalls

Research identifies six critical pitfalls that would cause rewrites or failed releases if not addressed early.

1. **Python Distribution Nightmare** - PyInstaller bundling with spaCy requires extensive hidden imports that aren't auto-detected. App works in dev but fails in distribution. **Mitigation:** Test PyInstaller build in Phase 1 (first week), use explicit spaCy hidden imports (cymem, preshed, srsly.msgpack.util, etc.), use `--onedir` for faster startup, test on clean VMs, sign all binaries on macOS.

2. **spaCy Model Loading Blocks UI 10-30s** - spaCy models take 10-30 seconds cold start. Users think app is frozen. **Mitigation:** Preload model at sidecar startup, use en_core_web_sm (12MB) not larger models, show loading indicator ("Initializing AI engine..."), disable unused pipeline components (parser, lemmatizer).

3. **PDF Parsing Fails on 30-40% of Real Resumes** - Test data uses clean PDFs, real resumes include two-column layouts, infographics, scanned images, international formats. **Mitigation:** Build adversarial resume corpus (100+ real resumes), use PyMuPDF for speed + pdfplumber for tables, add OCR fallback, implement confidence scoring, cross-field validation.

4. **IPC Bottleneck Kills Bulk Performance** - Single resume parses in 1.5s but 100 resumes takes 10+ minutes due to IPC overhead. **Mitigation:** Batch IPC calls (send 10-50 paths per message), minimize payload size (send paths not contents), use modern Electron (v8 structured clone), profile IPC vs processing separately.

5. **Memory Leaks During Bulk Processing** - Processing 500 resumes causes crash. PDF libraries cache by default, spaCy Doc objects accumulate. **Mitigation:** Explicitly close PDF documents (doc.close()), clear pdfplumber cache (page.flush_cache()), process in chunks of 50 with garbage collection, use generators not lists, monitor memory in CI.

6. **Code Signing and Notarization Block Release** - App is feature-complete but can't ship. macOS Gatekeeper blocks unsigned apps, Windows SmartScreen warns users. **Mitigation:** Set up signing in Phase 1 (not "last step"), sign ALL binaries including PyInstaller output, test notarization weekly, use hardened runtime with required entitlements, budget for certificates (Apple $99/yr, Windows EV $200-500/yr).

## Implications for Roadmap

Based on research, suggested phase structure follows dependencies and risk mitigation:

### Phase 1: Foundation and Distribution
**Rationale:** Prove the hardest part first - Python bundling, distribution, and code signing work before any feature development. This is critical because PyInstaller with spaCy is notorious for distribution failures (Pitfall #1, #6).

**Delivers:**
- Electron shell (main process, window, basic IPC)
- Python sidecar (minimal "hello world" with spaCy)
- PyInstaller build working and tested on clean VM
- Code signing working for both platforms
- SQLite schema designed and better-sqlite3 integrated
- IPC communication proven with health check

**Addresses:** Table stakes infrastructure

**Avoids:** Critical Pitfalls #1 (Python distribution), #6 (code signing), #10 (zombie processes)

**Key validation:** Can distribute a packaged app that loads spaCy model and responds to IPC within 10 seconds

### Phase 2: Single-CV Parsing Pipeline
**Rationale:** Build the core value proposition - parse one CV accurately. Must handle real-world PDF complexity and achieve <2s processing before scaling to bulk. This phase directly addresses the parsing accuracy challenge (Pitfall #3) and spaCy loading performance (Pitfall #2).

**Delivers:**
- PDF text extraction (PyMuPDF + pdfplumber fallback)
- Entity extraction with spaCy (contact, experience, education, skills)
- Confidence scoring per field
- Structured data model saved to SQLite
- Basic React UI showing parsed results

**Uses:** PyMuPDF 1.26.x, pdfplumber 0.11.x, spaCy 3.8.x (en_core_web_sm), better-sqlite3

**Implements:** Python sidecar processing component, SQLite persistence

**Avoids:** Critical Pitfall #2 (spaCy loading blocks UI - preload at startup), #3 (PDF parsing failures - adversarial corpus)

**Key validation:** Parse 100+ diverse resumes (two-column, tables, scanned) with 90%+ accuracy and <2s per resume

### Phase 3: Visual Editor and Manual Corrections
**Rationale:** Parsing is never 100% accurate. Recruiters need to review and correct extractions. This delivers the human-in-the-loop workflow that differentiates Samsara from black-box parsers.

**Delivers:**
- Side-by-side view (original PDF + extracted data)
- Inline editing of parsed fields
- Confidence indicators highlighting low-confidence extractions
- Save corrections back to SQLite
- Re-parse capability

**Addresses:** Must-have feature (manual edit/correction UI), should-have feature (confidence scoring)

**Implements:** Electron renderer UI component, pdf.js for PDF rendering

**Key validation:** Recruiters can correct parsing errors in <30 seconds per resume

### Phase 4: Anonymization and Branding
**Rationale:** Two differentiating features that deliver agency value - blind profiles for DEI compliance and branded output for client presentation. These leverage the structured data from Phase 2.

**Delivers:**
- Basic anonymization (name, email, phone, address redaction)
- Granular anonymization (employer names, universities, dates)
- Agency branding (logo, colors, fonts via theme.json)
- "Blind Profile" front sheet generation (anonymized one-pager)
- Branded PDF export (ReportLab)
- DOCX export

**Uses:** ReportLab 4.4.x for PDF generation

**Addresses:** Must-have features (branding, basic anonymization), should-have features (granular anonymization, blind profiles)

**Implements:** Template engine, anonymization engine in Python

**Key validation:** Generate branded, anonymized CV in <500ms

### Phase 5: Bulk Processing
**Rationale:** Agencies process multiple candidates per role. Bulk must work efficiently without memory leaks or IPC bottlenecks (Pitfalls #4, #5). Only attempt this after single-CV pipeline is rock-solid.

**Delivers:**
- Batch file selection (drag-drop folder, file picker)
- Queue management (track status per file)
- Progress indication (real-time updates to UI)
- Batch IPC (send 10-50 paths per message)
- Memory management (process in chunks, explicit cleanup)
- Error handling (continue processing on individual failures)
- Bulk export

**Addresses:** Must-have feature (bulk processing 10-100 CVs), should-have feature (bulk 100+ CVs)

**Avoids:** Critical Pitfall #4 (IPC bottleneck - batch calls), #5 (memory leaks - chunking + cleanup)

**Key validation:** Process 500 resumes in <15 minutes without memory growth or crashes

### Phase 6: OS Integration and Polish
**Rationale:** Windows shell integration (right-click context menu) and auto-updates are polish features that improve UX but aren't MVP-critical. Defer until core functionality is stable.

**Delivers:**
- Windows context menu ("Open with Samsara")
- File associations (.pdf, .docx)
- NSIS installer customization
- Auto-update (electron-updater)
- Error logging and crash reporting
- Onboarding flow

**Addresses:** Enhancement features

**Avoids:** Moderate Pitfalls #7 (context menu platform differences), #8 (file association complexity), #9 (auto-update failures)

**Key validation:** Right-click context menu works on Windows 10/11, auto-update completes successfully

### Phase Ordering Rationale

- **Phase 1 first because:** Python distribution with ML dependencies is the riskiest part. Must prove before building features. Code signing must be continuous, not a last-minute blocker.

- **Phase 2 before 3-6 because:** All features depend on accurate parsing. No point building UI, anonymization, or bulk processing if core parsing doesn't work on real resumes.

- **Phase 3 before 4 because:** Anonymization and branding require manual review capability. Recruiters need to fix parsing errors before trusting anonymization.

- **Phase 4 before 5 because:** Bulk processing needs single-CV pipeline including anonymization and branding. Don't scale broken workflows.

- **Phase 5 before 6 because:** Bulk is table stakes for agencies; shell integration is enhancement. Deliver core value before polish.

- **Memory/IPC concerns addressed in phases:** Phase 1 establishes IPC pattern, Phase 5 validates scalability with batching and memory management.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2 (Parsing):** Requires spike for PDF edge cases. Build adversarial corpus, test pdfplumber vs PyMuPDF on specific layouts, evaluate OCR integration if scanned PDFs common.

- **Phase 4 (Branding):** May need design research for template system. How to balance flexibility vs. simplicity? Use ReportLab programmatically or HTML-to-PDF (WeasyPrint)?

- **Phase 6 (OS Integration):** Windows registry patterns for shell integration. NSIS scripting for installer customization. Context menu behavior on Windows 11 changed.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Foundation):** Electron + Python sidecar is well-documented. python-shell IPC, PyInstaller bundling, electron-builder config are established patterns.

- **Phase 3 (Visual Editor):** pdf.js rendering + React forms. Standard CRUD patterns. No novel architecture.

- **Phase 5 (Bulk Processing):** Queue management, batching, progress bars are solved problems. Main challenge is validation, not research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified with current versions (Jan 2026). Electron 39.x, Python 3.11/3.12, PyMuPDF 1.26.x, pdfplumber 0.11.x, spaCy 3.8.x, better-sqlite3 12.6.x all confirmed compatible. |
| Features | MEDIUM-HIGH | Competitor analysis from official product pages (DaXtra, Sovren/Textkernel, RChilli, Allsorter, MeVitae, CVBlinder). Table stakes clear, differentiators validated. Some uncertainty on skills taxonomy complexity. |
| Architecture | HIGH | Electron + Python sidecar pattern well-documented via official Electron docs, PyInstaller docs, and detailed tutorials (Simon Willison, Andy Bulka). IPC patterns, process lifecycle, bundling strategy all proven. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls verified from official docs (PyInstaller, Electron, spaCy) and multiple community sources (GitHub issues, Stack Overflow). Confidence scores match source verification (HIGH for official docs, MEDIUM for community patterns). |

**Overall confidence:** MEDIUM-HIGH

Research is comprehensive with verified sources, but some implementation details will need validation during execution (spaCy hidden imports for specific versions, actual PDF parsing accuracy on Samsara's resume corpus, IPC performance benchmarks under load).

### Gaps to Address

**Skills taxonomy mapping (Phase 2-3):** Research shows commercial parsers have 3M+ skills (RChilli), 12K+ unique skills (Textkernel). Building this from scratch is impractical. Need to either: (1) defer to v2, (2) license a skills taxonomy (Lightcast, ESCO), or (3) start with raw extraction + simple normalization. Decision required during Phase 2 planning.

**OCR integration (Phase 2):** Research notes scanned/image PDFs are 10-40% of submissions. PyMuPDF can detect image-only PDFs but doesn't extract text. Need to decide: (1) show error message ("Please provide text PDF"), (2) integrate Tesseract OCR, or (3) use cloud OCR (violates sovereignty). Spike needed in Phase 2 to assess actual scanned PDF percentage in target market.

**Windows 11 context menu changes (Phase 6):** Research notes Windows 11 changed context menu behavior ("Show more options" submenu). Registry approach may differ from Windows 10. Need to test actual behavior on Windows 11 before committing to implementation approach.

**Template system design (Phase 4):** Research shows two paths: (1) ReportLab programmatic generation (full control, steeper learning), (2) HTML-to-PDF with WeasyPrint (easier templating, less control). Decision impacts developer experience and template flexibility. Evaluate during Phase 4 spike.

**Python bundling size (All phases):** PyInstaller onefile with PyMuPDF + spaCy may be 100-200MB. Need to test actual bundle size early (Phase 1) and assess if this is acceptable for desktop distribution. May need to use onedir + installer compression.

## Sources

### Primary (HIGH confidence)
- [Electron Official Documentation](https://www.electronjs.org/docs/latest/) - IPC patterns, process model, code signing
- [PyInstaller Documentation](https://pyinstaller.org/en/stable/) - Bundling strategy, common issues, hidden imports
- [spaCy Documentation](https://spacy.io/usage/) - NLP pipeline, entity extraction, model loading
- [PyMuPDF Documentation](https://pymupdf.readthedocs.io/) - PDF extraction API
- [pdfplumber GitHub](https://github.com/jsvine/pdfplumber) - Table extraction patterns
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) - Performance benchmarks, API patterns
- [electron-builder Configuration](https://www.electron.build/configuration.html) - Packaging, extraResources, signing

### Secondary (MEDIUM confidence)
- [DaXtra Resume Parsing](https://www.daxtra.com/products/resume-parsing-software/) - Feature benchmarks (90% accuracy, 40+ languages)
- [Textkernel Parser](https://www.textkernel.com/products-solutions/parser/) - Skills taxonomy (12K+ skills), OCR add-on
- [RChilli Solutions](https://www.rchilli.com/) - Taxonomy scale (3M+ skills), duplicate detection
- [MeVitae Blind Recruiting](https://www.mevitae.com/blind-recruiting) - Anonymization parameters (26+)
- [CVBlinder](https://www.cvblinder.com/) - Blind profile workflows
- [Simon Willison - Bundling Python in Electron](https://til.simonwillison.net/electron/python-inside-electron) - Distribution patterns
- [MokaHR Resume Parsing Guide 2026](https://www.mokahr.io/articles/en/the-top-resume-parsing-automation-software) - Competitor analysis
- [spaCy PyInstaller Discussion](https://github.com/explosion/spaCy/discussions/9205) - Hidden imports, bundling issues
- [spaCy Performance FAQ](https://github.com/explosion/spaCy/discussions/8402) - Model loading times
- [PyMuPDF Memory Issues](https://github.com/pymupdf/PyMuPDF/issues/714) - Resource cleanup patterns
- [Electron IPC Large Objects](https://github.com/electron/electron/issues/7286) - IPC performance challenges

### Tertiary (LOW confidence, needs validation)
- [AI Resume Parsing Research](https://secondary.ai/blog/recruitment/ai-resume-parsing-ocr-multi-format-extraction-reality-check) - PDF edge case estimates (30-40% failure)
- [PDF Parsing Comparison](https://arxiv.org/html/2410.09871v1) - Library performance comparison
- [Electron Python IPC Patterns](https://discuss.python.org/t/how-to-communicate-between-electron-framework-and-python/48044) - Community patterns

---
*Research completed: 2026-01-23*
*Ready for roadmap: yes*
