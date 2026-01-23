# Domain Pitfalls: Electron + Python Sidecar Desktop Apps

**Domain:** Desktop resume parsing application (Electron frontend, Python sidecar backend)
**Researched:** 2026-01-23
**Overall Confidence:** MEDIUM-HIGH (multiple sources, community-verified patterns)

---

## Critical Pitfalls

Mistakes that cause rewrites, failed releases, or major production issues.

---

### Pitfall 1: Python Distribution Nightmare

**What goes wrong:** The app works perfectly in development but fails catastrophically when distributed. Users get cryptic errors like "Failed to execute script" or the Python sidecar silently fails to start.

**Why it happens:**
- PyInstaller bundles work differently across Windows/macOS
- spaCy models require extensive hidden imports that aren't auto-detected
- Native dependencies (C extensions) may not bundle correctly
- Symbolic links required by onedir builds don't work on all filesystems

**Consequences:**
- App appears to work but NLP features silently fail
- Distribution packages are 2-3x expected size
- macOS notarization rejects unsigned Python binaries
- Users on certain Windows versions get DLL errors

**Prevention:**
1. **Test distribution early (Phase 1):** Build PyInstaller bundle in first week, not last
2. **Use explicit spaCy hidden imports:** Required flags for spaCy 3.x:
   ```
   --hidden-import srsly.msgpack.util
   --hidden-import cymem --hidden-import cymem.cymem
   --hidden-import preshed.maps
   --collect-submodules thinc --collect-data thinc
   --collect-submodules blis
   --collect-submodules spacy --collect-data spacy
   --collect-submodules en_core_web_sm --collect-data en_core_web_sm
   --copy-metadata en_core_web_sm
   --collect-submodules spacy_legacy --copy-metadata spacy_legacy
   ```
3. **Avoid --onefile for spaCy:** Build times become impractical (hours); use --onedir + zip
4. **Sign ALL binaries on macOS:** Not just .app but every executable in the bundle
5. **Test on clean VMs:** Never test distribution only on dev machines

**Detection (warning signs):**
- "Works on my machine" for any Python feature
- PyInstaller build warnings about missing modules
- spaCy load() calls with no error handling
- Distribution tested only after feature complete

**Phase mapping:** Must be addressed in Phase 1 (Foundation). Do not proceed to feature development until distribution pipeline is proven.

**Confidence:** HIGH (verified via [PyInstaller docs](https://pyinstaller.org/en/stable/common-issues-and-pitfalls.html), [spaCy GitHub discussions](https://github.com/explosion/spaCy/discussions/9205))

---

### Pitfall 2: spaCy Model Loading Blocks UI for 10-30 Seconds

**What goes wrong:** First resume parse takes 10-30 seconds. Users think the app is frozen. They force-quit or report it as broken.

**Why it happens:**
- spaCy models (especially transformers) take 10-30 seconds cold start
- Loading happens synchronously on first `nlp()` call
- Transformer models (en_core_web_trf) are 7+ GB and load even slower
- No visual feedback during model initialization

**Consequences:**
- Users abandon app on first use
- Support tickets about "frozen" application
- Negative reviews citing performance
- < 2 second requirement impossible without mitigation

**Prevention:**
1. **Preload models at sidecar startup:** Load spaCy model before accepting any IPC requests
2. **Use smaller models:** `en_core_web_sm` (12MB) or `en_core_web_md` (40MB) instead of `_lg` (560MB) or `_trf` (438MB + dependencies)
3. **Show loading indicator:** Electron displays "Initializing AI engine..." during Python startup
4. **Disable unused pipeline components:**
   ```python
   nlp = spacy.load("en_core_web_sm", disable=["parser", "lemmatizer"])
   ```
5. **Consider background initialization:** Start Python sidecar immediately on app launch, not on first use

**Detection (warning signs):**
- No startup loading screen in designs
- Using transformer models without explicit justification
- First-parse timing not in acceptance criteria
- spaCy.load() called inside request handler

**Phase mapping:** Architecture decision in Phase 1. Model selection validated in Phase 2 (Core Parsing).

**Confidence:** HIGH (verified via [spaCy performance FAQ](https://github.com/explosion/spaCy/discussions/8402), [spaCy loading issues](https://github.com/explosion/spaCy/issues/281))

---

### Pitfall 3: PDF Parsing Fails on 30-40% of Real-World Resumes

**What goes wrong:** Parser achieves 95% accuracy on test PDFs but fails dramatically on actual user submissions. Recruiters can't use the product for a significant portion of their applicant pool.

**Why it happens:**
- Test data uses clean, well-formatted PDFs
- Real resumes include: two-column layouts, infographics, scanned images, international formats, creative designs
- Field-level accuracy metrics hide candidate-level failures
- Tables, text boxes, and nested layouts scramble reading order

**Consequences:**
- "95% accuracy" means 1 in 20 resumes has critical data missing
- Two-column resumes (extremely common) parse as gibberish
- Scanned/image PDFs extract nothing without OCR
- International formats (German CVs with photos, Japanese rirekisho) completely fail

**Prevention:**
1. **Test with adversarial resume corpus:** Collect 100+ real resumes including:
   - Two-column layouts
   - Infographic/creative designs
   - Scanned PDFs (image-only)
   - International formats
   - Tables for experience/education
2. **Use PyMuPDF for extraction:** Faster, lower memory, better layout handling than pdfplumber for text
3. **Add OCR fallback:** Detect image-only PDFs and route to Tesseract/OCR pipeline
4. **Implement confidence scoring:** Return parse confidence; flag low-confidence for human review
5. **Cross-field validation:** If graduation date is after first job, flag as parsing error

**Detection (warning signs):**
- Only testing with "clean" sample resumes
- No error handling for parse failures
- Single PDF library without fallback
- No OCR integration planned
- Field-level accuracy as only metric

**Phase mapping:** Core challenge for Phase 2 (Resume Parsing). Requires dedicated spike for PDF edge cases.

**Confidence:** HIGH (verified via [AI resume parsing research](https://secondary.ai/blog/recruitment/ai-resume-parsing-ocr-multi-format-extraction-reality-check), [PDF parsing comparison](https://arxiv.org/html/2410.09871v1))

---

### Pitfall 4: IPC Bottleneck Kills Bulk Processing Performance

**What goes wrong:** Single resume parses in 1.5 seconds, but bulk import of 100 resumes takes 10+ minutes instead of expected 2.5 minutes. IPC becomes the bottleneck, not parsing.

**Why it happens:**
- Electron IPC serializes data as JSON (historically slow for large objects)
- Each IPC round-trip adds latency even with V8 structured clone
- Sending full resume text + extracted data back and forth
- No batching - one IPC call per resume

**Consequences:**
- Bulk import feature unusable for agencies with 1000+ resume backlogs
- Users watch progress bar crawl
- CPU sits idle waiting for IPC
- Memory spikes from queued messages

**Prevention:**
1. **Batch IPC calls:** Send 10-50 file paths per IPC message, return batch results
2. **Stream results:** Use streaming/chunked responses for large batches
3. **Minimize payload size:** Send file paths to Python, not file contents; return only structured data
4. **Use modern Electron (v8 serialization):** Electron 6+ uses structured clone, 2x faster
5. **Consider WebSocket for heavy data:** Direct socket connection bypasses IPC limitations
6. **Profile IPC vs processing time:** Measure separately to identify actual bottleneck

**Detection (warning signs):**
- No bulk processing benchmarks in requirements
- Sending file contents over IPC instead of paths
- One IPC call per file in batch operations
- Using synchronous IPC (sendSync)

**Phase mapping:** Architecture decision in Phase 1. Validated in Phase 3 (Bulk Processing).

**Confidence:** MEDIUM-HIGH (verified via [Electron IPC issues](https://github.com/electron/electron/issues/7286), [Electron performance docs](https://www.electronjs.org/docs/latest/tutorial/performance))

---

### Pitfall 5: Memory Leaks During Bulk PDF Processing

**What goes wrong:** Processing 500 resumes causes app to crash or slow to a crawl. Memory usage grows unbounded, eventually hitting system limits.

**Why it happens:**
- PDF libraries (PyMuPDF, pdfplumber) cache parsed data by default
- spaCy Doc objects accumulate in memory
- Python subprocess doesn't release memory back to OS efficiently
- pdfplumber's Page objects cache layout information

**Consequences:**
- App crashes during large imports
- System becomes unresponsive
- Partial imports leave data in inconsistent state
- Users lose trust in bulk features

**Prevention:**
1. **Explicitly close PDF documents:**
   ```python
   doc = fitz.open(path)
   try:
       # process
   finally:
       doc.close()
   ```
2. **Clear pdfplumber cache:** Call `page.flush_cache()` or `page.close()` after each page
3. **Process in chunks:** Parse 50 resumes, force garbage collection, continue
4. **Use generators instead of lists:** Don't accumulate all results in memory
5. **Monitor memory in development:** Add memory profiling to CI/test suite
6. **Set Python subprocess memory limits:** Restart sidecar if memory exceeds threshold

**Detection (warning signs):**
- No memory profiling in test plan
- Using list comprehensions for batch results
- PDF documents opened but never explicitly closed
- No garbage collection calls in batch processing
- pdfplumber used without cache management

**Phase mapping:** Must be tested in Phase 3 (Bulk Processing). Add memory benchmarks to acceptance criteria.

**Confidence:** HIGH (verified via [PyMuPDF memory issues](https://github.com/pymupdf/PyMuPDF/issues/714), [pdfplumber docs](https://github.com/jsvine/pdfplumber))

---

### Pitfall 6: Code Signing and Notarization Failures Block Release

**What goes wrong:** App is feature-complete but can't be distributed. macOS Gatekeeper blocks unsigned apps. Windows SmartScreen warns users away. Release delayed by weeks.

**Why it happens:**
- Code signing treated as "last step" instead of continuous
- Apple notarization rejects apps with unsigned embedded binaries
- PyInstaller output contains unsigned executables (ffmpeg, etc.)
- Hardened runtime breaks Electron functionality
- Windows EV certificates are expensive and complex

**Consequences:**
- App won't run on macOS 10.15+ without scary warnings
- Windows SmartScreen reputation takes weeks to build
- Release blocked at finish line
- Emergency scramble to fix signing issues

**Prevention:**
1. **Set up signing in Phase 1:** Signing must work before any feature development
2. **Sign ALL binaries, not just .app:** Use electron-osx-sign with binaries option
3. **Test notarization weekly:** Don't wait until release
4. **Use hardened runtime correctly:** Add required entitlements:
   ```
   com.apple.security.cs.allow-jit
   com.apple.security.cs.allow-unsigned-executable-memory
   ```
5. **Windows: Use Azure Trusted Signing or DigiCert KeyLocker:** Cloud-based signing works in CI
6. **Budget for certificates:** Apple Developer ($99/yr), Windows EV ($200-500/yr)

**Detection (warning signs):**
- No Apple Developer account set up
- No Windows signing certificate budgeted
- Signing planned for "release phase"
- PyInstaller binaries not inventoried for signing
- electron-builder zip bug not accounted for (unsigned zip on macOS)

**Phase mapping:** Critical infrastructure in Phase 1. Test signing with every PR merge.

**Confidence:** HIGH (verified via [Electron code signing docs](https://www.electronjs.org/docs/latest/tutorial/code-signing), [macOS notarization guide](https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/))

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded user experience.

---

### Pitfall 7: OS-Specific Context Menu Differences

**What goes wrong:** Right-click context menu works on Windows but behaves strangely on macOS, or vice versa. Draggable regions break custom menus on Windows.

**Why it happens:**
- Electron has no built-in context menu - must implement yourself
- Windows draggable regions have special system context menu that can't be overridden
- macOS Services submenu has Electron bugs
- Tray icon right-click triggers click event on some platforms

**Prevention:**
1. **Use electron-context-menu package:** Handles cross-platform differences
2. **Avoid custom context menus in draggable regions on Windows**
3. **Test on both platforms early and often**
4. **Don't rely on right-click for critical functionality:** Always provide menu bar alternative

**Detection (warning signs):**
- Custom context menu implemented from scratch
- Only testing on developer's primary OS
- Right-click as only way to access features
- Draggable title bar with custom menus

**Phase mapping:** Address in Phase 4 (OS Integration). Test matrix must include both platforms.

**Confidence:** MEDIUM (verified via [electron-context-menu](https://github.com/sindresorhus/electron-context-menu), [Electron draggable region issues](https://github.com/electron/electron/issues/24893))

---

### Pitfall 8: Windows File Association and Shell Extension Complexity

**What goes wrong:** "Open with Samsara" context menu option doesn't appear, or appears but doesn't work. File associations break on Windows update.

**Why it happens:**
- Windows registry manipulation required
- Different registry keys for per-user vs per-machine install
- Squirrel installer handles some but not all cases
- ProgId registration must happen before file association

**Prevention:**
1. **Use electron-regedit package:** Handles registry complexity
2. **Register on install AND uninstall:** Clean up registry on uninstall
3. **Use NSIS installer, not Squirrel:** Better file association support
4. **Test with perMachine: true in NSIS config**
5. **Provide fallback:** Drag-and-drop always works even if shell extension fails

**Detection (warning signs):**
- Using Squirrel.Windows (deprecated by electron-builder)
- No registry cleanup in uninstaller
- File association only tested on dev machine
- No fallback for failed shell integration

**Phase mapping:** Phase 4 (OS Integration). Consider it optional for MVP if timeline is tight.

**Confidence:** MEDIUM (verified via [electron-regedit](https://github.com/tympanix/electron-regedit), [electron-builder file association docs](https://www.electron.build/electron-builder.Interface.FileAssociation.html))

---

### Pitfall 9: Auto-Update Failures on Different Platforms

**What goes wrong:** Updates work on macOS but fail silently on Windows. Users stuck on old versions. quitAndInstall() does nothing.

**Why it happens:**
- Squirrel.Windows vs Squirrel.Mac have different behaviors
- Squirrel.Windows requires RELEASES file for delta updates
- First-launch blocks update checks due to file lock
- macOS quitAndInstall() known to fail in some scenarios
- electron-builder has bug causing unsigned zip on macOS

**Prevention:**
1. **Use electron-updater, not built-in autoUpdater:** Better cross-platform support
2. **Use NSIS target on Windows:** Squirrel.Windows not supported by electron-builder
3. **Add 10-second delay on first launch:** Avoid Squirrel.Windows file lock
4. **Test update flow, not just update check:** Actually install update in CI
5. **Provide manual update fallback:** Download link in app for when auto-update fails

**Detection (warning signs):**
- Auto-update only tested on one platform
- Using Squirrel.Windows
- No manual update fallback
- Update tested in dev but not in packaged app
- First-launch update check without delay

**Phase mapping:** Phase 5 (Polish). Auto-update is enhancement, not MVP requirement.

**Confidence:** MEDIUM (verified via [electron-builder auto-update docs](https://www.electron.build/auto-update.html), [Squirrel issues](https://github.com/electron-userland/electron-builder/issues/7356))

---

### Pitfall 10: Python Sidecar Zombie Processes

**What goes wrong:** Electron app closes but Python process keeps running. Multiple zombie sidecars accumulate. System resources consumed by orphaned processes.

**Why it happens:**
- Electron app crashes without clean shutdown
- subprocess.Popen() without proper wait()/communicate()
- No signal handler for graceful termination
- User force-quits app
- IPC connection lost but process not terminated

**Prevention:**
1. **Always wait() or communicate() on subprocess:**
   ```python
   proc = subprocess.Popen(...)
   try:
       outs, errs = proc.communicate(timeout=15)
   except TimeoutExpired:
       proc.kill()
       proc.communicate()
   ```
2. **Register shutdown handler in Electron:**
   ```javascript
   app.on('before-quit', () => pythonProcess.kill());
   app.on('window-all-closed', () => pythonProcess.kill());
   ```
3. **Use process groups:** Kill entire process tree, not just parent
4. **Heartbeat mechanism:** Python sidecar exits if no heartbeat from Electron for 30 seconds
5. **Check for existing instances on startup:** Kill orphaned sidecars before starting new one

**Detection (warning signs):**
- Using Popen without cleanup logic
- No app shutdown handlers
- Process management only tested in happy path
- No orphan detection on startup

**Phase mapping:** Phase 1 (Foundation). Must be in place before IPC implementation.

**Confidence:** MEDIUM-HIGH (verified via [Python subprocess docs](https://docs.python.org/3/library/subprocess.html), [zombie process guide](https://medium.com/naukri-engineering/creating-troubleshooting-the-zombie-process-in-python-f4d89c46a85a))

---

## Minor Pitfalls

Mistakes that cause annoyance but are recoverable.

---

### Pitfall 11: Inconsistent Error Messages Across Languages

**What goes wrong:** Python errors appear as raw stack traces in UI. JavaScript and Python error formats don't match. Users see "undefined" or "None" in error dialogs.

**Prevention:**
1. Define error schema shared between Python and Electron
2. Catch and transform all Python exceptions before IPC response
3. Never expose stack traces to users
4. Log detailed errors server-side, show friendly messages client-side

**Phase mapping:** Phase 2. Error handling standardized early.

---

### Pitfall 12: PDF Library Version Conflicts

**What goes wrong:** PyMuPDF and pdfplumber have incompatible dependencies. Updating one breaks the other. Pip resolver fails.

**Prevention:**
1. Pin exact versions in requirements.txt
2. Use only one PDF library where possible (prefer PyMuPDF)
3. Test dependency resolution in CI on every change
4. Consider separate virtual environments if both needed

**Phase mapping:** Phase 1. Lock dependencies from start.

---

### Pitfall 13: Locale/Encoding Issues with International Resumes

**What goes wrong:** French accented characters appear as garbage. Chinese resumes crash parser. Date formats misinterpreted.

**Prevention:**
1. Force UTF-8 everywhere: `open(file, encoding='utf-8')`
2. Test with international character sets
3. Use dateutil for date parsing, not strptime
4. Handle BOM (byte order mark) in input files

**Phase mapping:** Phase 2. Include international test files in corpus.

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|----------------|------------|
| Phase 1 | Foundation | Python distribution (#1), Code signing (#6), Zombie processes (#10) | Prove distribution pipeline works before features |
| Phase 2 | Core Parsing | spaCy loading (#2), PDF edge cases (#3) | Preload model, adversarial test corpus |
| Phase 3 | Bulk Processing | IPC bottleneck (#4), Memory leaks (#5) | Batch IPC, explicit resource cleanup |
| Phase 4 | OS Integration | Context menus (#7), File associations (#8) | Use electron-context-menu, test both platforms |
| Phase 5 | Polish | Auto-update (#9) | Use electron-updater, test actual update flow |

---

## Sources

### HIGH Confidence (Official Documentation)
- [PyInstaller Common Issues](https://pyinstaller.org/en/stable/common-issues-and-pitfalls.html)
- [Electron Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Python subprocess documentation](https://docs.python.org/3/library/subprocess.html)
- [spaCy Training Pipelines](https://spacy.io/usage/training)

### MEDIUM Confidence (GitHub Issues/Discussions, Multiple Sources)
- [spaCy PyInstaller hidden imports discussion](https://github.com/explosion/spaCy/discussions/9205)
- [spaCy performance FAQ](https://github.com/explosion/spaCy/discussions/8402)
- [PyMuPDF memory leak issues](https://github.com/pymupdf/PyMuPDF/issues/714)
- [Electron IPC large objects](https://github.com/electron/electron/issues/7286)
- [electron-context-menu](https://github.com/sindresorhus/electron-context-menu)
- [electron-regedit](https://github.com/tympanix/electron-regedit)
- [electron-builder auto-update](https://www.electron.build/auto-update.html)

### LOW Confidence (Single Source, Needs Validation)
- [AI resume parsing accuracy research](https://secondary.ai/blog/recruitment/ai-resume-parsing-ocr-multi-format-extraction-reality-check)
- [PDF parsing comparison study](https://arxiv.org/html/2410.09871v1)
