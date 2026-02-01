# Phase 14: MVP Packaging & Release - Research

**Researched:** 2026-02-01
**Domain:** Electron packaging, Windows installer, PDF parsing reliability, first-run UX
**Confidence:** HIGH (codebase investigation) / MEDIUM (PDF improvements)

## Summary

Phase 14 ships a distributable Windows installer from v1 code on an `mvp` branch. The codebase already has Electron Forge with MakerSquirrel configured, `electron-squirrel-startup` handling shortcut events, and a PyInstaller spec for the Python sidecar. Four work areas: (1) branch management + installer build, (2) app icon and branding, (3) PDF parsing reliability, (4) first-run onboarding.

Key findings: there is a **path mismatch bug** between `forge.config.ts` (extraResource puts sidecar at `resources/samsara-backend/`) and `pythonManager.ts` (looks for `resources/python/`). DevTools auto-opens in production. No app icon exists. No onboarding/first-run experience exists. PDF parser has no OCR fallback for image-only PDFs.

**Primary recommendation:** Fix the sidecar path mismatch, add a proper `.ico` icon, add OCR fallback via Tesseract for image-only PDFs, improve error recovery in the PDF parser, disable DevTools in production, and add a lightweight first-run onboarding overlay.

## Standard Stack

### Core (already in project)

| Library                          | Version | Purpose                             | Status    |
| -------------------------------- | ------- | ----------------------------------- | --------- |
| `@electron-forge/cli`            | ^7.11.1 | Build & package orchestrator        | Installed |
| `@electron-forge/maker-squirrel` | ^7.11.1 | Windows Squirrel installer          | Installed |
| `electron-squirrel-startup`      | ^1.0.1  | Shortcut creation on install/update | Installed |
| `@electron-forge/plugin-fuses`   | ^7.11.1 | Security fuses at package time      | Installed |
| `PyMuPDF`                        | 1.26.7  | Primary PDF text extraction         | Installed |
| `pdfplumber`                     | 0.11.9  | Table extraction fallback           | Installed |
| `PyInstaller`                    | 6.18.0  | Python sidecar bundling             | Installed |

### Supporting (to add)

| Library                                | Version | Purpose                 | When to Use              |
| -------------------------------------- | ------- | ----------------------- | ------------------------ |
| `electron-icon-maker`                  | latest  | Generate .ico from PNG  | One-time icon generation |
| `pytesseract` or Tesseract via PyMuPDF | -       | OCR for image-only PDFs | PDF parsing fallback     |

### Alternatives Considered

| Instead of          | Could Use          | Tradeoff                                                                           |
| ------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| Squirrel installer  | WiX (maker-wix)    | WiX gives MSI but requires WiX toolset install; Squirrel is already configured     |
| Tesseract OCR       | Docling/LlamaParse | AI-based parsers are more accurate but add cloud dependency or large model bundles |
| electron-icon-maker | GIMP manual export | Manual process; CLI tool is faster for CI                                          |

## Architecture Patterns

### Existing Project Structure (relevant files)

```
forge.config.ts          # Electron Forge config with MakerSquirrel
windowsSign.ts           # Azure Trusted Signing (optional)
src/main/index.ts        # Main process, electron-squirrel-startup at line 57
src/main/pythonManager.ts # Python sidecar spawn, path resolution
python-src/samsara.spec  # PyInstaller spec with hidden imports
python-src/parsers/pdf_parser.py  # PDF parsing with cascading strategy
```

### Pattern 1: Sidecar Path Resolution (BUGFIX NEEDED)

**What:** `extraResource` in forge.config.ts copies `./python-dist/samsara-backend` to `resources/samsara-backend/`, but `pythonManager.ts` line 42 looks for `resources/python/{exeName}`.
**Fix:** Either change `extraResource` to rename the folder, or change `pythonManager.ts` to match the actual output path (`resources/samsara-backend/{exeName}`).

**Current (broken for packaged):**

```typescript
// pythonManager.ts line 41-42
if (isPackaged) {
  return path.join(process.resourcesPath, "python", exeName); // WRONG
}
```

**Correct:**

```typescript
if (isPackaged) {
  return path.join(process.resourcesPath, "samsara-backend", exeName);
}
```

### Pattern 2: DevTools in Production

**What:** `src/main/index.ts` line 82 calls `mainWindow.webContents.openDevTools()` unconditionally.
**Fix:** Guard with `if (!app.isPackaged)` or remove for MVP.

### Pattern 3: Squirrel Shortcut Lifecycle

**What:** `electron-squirrel-startup` (already imported at line 5 of index.ts) handles `--squirrel-install`, `--squirrel-updated`, `--squirrel-uninstall` events automatically, creating desktop + Start Menu shortcuts.
**No changes needed** for basic shortcut creation -- the module handles it.

### Pattern 4: Icon Configuration

**What:** Icons must be set in TWO places:

1. `packagerConfig.icon` -- embedded in the .exe (no extension needed)
2. `MakerSquirrel` config -- `setupIcon` for the installer .exe

```typescript
// forge.config.ts
const config: ForgeConfig = {
  packagerConfig: {
    icon: "./assets/icon", // Will look for icon.ico on Windows
    // ...
  },
  makers: [
    new MakerSquirrel({
      setupIcon: "./assets/icon.ico",
      // skipUpdateIcon: true,  // Add if "Unable to set icon" error occurs
    }),
  ],
};
```

### Anti-Patterns to Avoid

- **Renaming .png to .ico:** Will cause "Fatal error: Unable to set icon". Must use proper ICO format (256x256 multi-resolution).
- **Forgetting `skipUpdateIcon: true`:** Known Squirrel bug -- add this if icon embedding fails.
- **Hardcoding DevTools open:** Must be conditional on `app.isPackaged`.

## Don't Hand-Roll

| Problem              | Don't Build                    | Use Instead                                     | Why                                                                     |
| -------------------- | ------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------- |
| ICO generation       | Manual Photoshop/GIMP          | `electron-icon-maker` or `png-to-ico` npm       | Need multi-resolution ICO (16,32,48,256)                                |
| Shortcut creation    | Custom Squirrel event handlers | `electron-squirrel-startup` (already installed) | Handles all lifecycle events automatically                              |
| Auto-update          | Custom update logic            | Skip for MVP                                    | Squirrel supports auto-update but not needed for MVP                    |
| OCR for scanned PDFs | Custom image processing        | PyMuPDF built-in OCR or `pytesseract`           | PyMuPDF has Tesseract integration via `page.get_text("text", ocr=True)` |

## Common Pitfalls

### Pitfall 1: Sidecar Path Mismatch

**What goes wrong:** App starts, Python sidecar not found, all CV parsing fails silently.
**Why it happens:** `extraResource` copies folder with its original name but code expects a different path.
**How to avoid:** Verify the path by running `npm run package` and inspecting the output `resources/` folder.
**Warning signs:** "Python sidecar failed to start" in console.

### Pitfall 2: PyInstaller Bundle Missing in Installer

**What goes wrong:** `npm run make` succeeds but installer has no Python sidecar because `python-dist/samsara-backend` doesn't exist at build time.
**Why it happens:** PyInstaller build step not run before `npm run make`.
**How to avoid:** Document build order: (1) `cd python-src && pyinstaller samsara.spec`, (2) `npm run make`. Consider a pre-make script.
**Warning signs:** Small installer size (~50MB instead of ~200MB+).

### Pitfall 3: DevTools Opens for End Users

**What goes wrong:** Users see Chrome DevTools panel on launch.
**Why it happens:** `openDevTools()` called unconditionally in `createWindow()`.
**How to avoid:** Wrap in `if (!app.isPackaged)` check.

### Pitfall 4: Image-Only PDF Fails Silently

**What goes wrong:** Scanned PDFs return empty text, extraction "succeeds" but with no data.
**Why it happens:** `check_pdf_readable()` returns `False, "PDF appears to be image-only"` and raises RuntimeError.
**How to avoid:** Add OCR fallback before declaring failure. PyMuPDF supports `page.get_text("text", ocr=True)` with Tesseract installed.
**Warning signs:** High failure rate on scanned/photographed CVs.

### Pitfall 5: Squirrel Icon Cache

**What goes wrong:** Icon appears correct in file explorer but wrong in taskbar/Start Menu.
**Why it happens:** Windows caches icons aggressively.
**How to avoid:** Use `ie4uinit.exe -ClearIconCache` during testing. In production, Squirrel handles this.

### Pitfall 6: asar + native modules

**What goes wrong:** `better-sqlite3` fails to load from asar archive.
**Why it happens:** Native .node modules can't be loaded from asar.
**How to avoid:** `plugin-auto-unpack-natives` is NOT in the current config. Check if `better-sqlite3.node` is auto-unpacked or needs explicit `asarUnpack` config.

## Code Examples

### Icon Setup in forge.config.ts

```typescript
// Source: https://www.electronforge.io/guides/create-and-add-icons
const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: "./assets/icon", // .ico added automatically on Windows
    extraResource: ["./python-dist/samsara-backend"],
  },
  makers: [
    new MakerSquirrel({
      setupIcon: "./assets/icon.ico",
      name: "samsara",
    }),
  ],
};
```

### Conditional DevTools

```typescript
const mainWindow = new BrowserWindow({
  /* ... */
});
if (!app.isPackaged) {
  mainWindow.webContents.openDevTools();
}
```

### PDF OCR Fallback (Python)

```python
# PyMuPDF OCR requires Tesseract installed
# Check if page is image-only, then use OCR
def parse_pdf_with_ocr_fallback(file_path: str) -> ParseResult:
    doc = pymupdf.open(file_path)
    for page in doc:
        text = page.get_text()
        if not text.strip():
            # Image-only page -- try OCR
            try:
                text = page.get_text("text", ocr=True)
            except Exception:
                text = ""  # OCR not available
```

### First-Run Onboarding Detection

```typescript
// Check if this is first launch (no projects exist)
const projects = getAllProjects();
if (projects.length === 0) {
  // Show onboarding overlay or create sample project
}
```

## State of the Art

| Old Approach                   | Current Approach                          | When Changed       | Impact                                       |
| ------------------------------ | ----------------------------------------- | ------------------ | -------------------------------------------- |
| electron-winstaller standalone | @electron-forge/maker-squirrel (wraps it) | Electron Forge v6+ | Integrated into forge pipeline               |
| Manual Squirrel event handling | electron-squirrel-startup module          | ~2020              | One line handles all events                  |
| PyMuPDF `fitz` import          | PyMuPDF `pymupdf` import                  | PyMuPDF 1.24+      | Old `import fitz` still works but deprecated |
| Text-only PDF parsing          | OCR fallback for scanned PDFs             | PyMuPDF 1.23+      | Built-in Tesseract integration               |

## Codebase-Specific Findings

### Build Pipeline Status

- `npm run make` command exists and is wired to `electron-forge make`
- MakerSquirrel is configured with empty options `new MakerSquirrel({})`
- No app icon configured anywhere (no `.ico` file in project)
- `productName` is "Samsara" in package.json (correct)
- Windows signing is configured via Azure Trusted Signing (optional, env-var gated)
- Fuses plugin configured with security-hardened defaults (good for production)

### Python Sidecar Build

- PyInstaller spec exists at `python-src/samsara.spec` with comprehensive hidden imports
- Outputs to `python-dist/samsara-backend/` directory
- Spec includes spaCy, PyMuPDF, pdfplumber, reportlab, openai, and all dependencies
- No automated build script chains PyInstaller + Forge together

### PDF Parser Analysis

- Current strategy: PyMuPDF primary, pdfplumber for tables only
- Multi-column detection exists and works
- **No OCR fallback** -- image-only PDFs raise RuntimeError immediately
- **No error recovery** -- if PyMuPDF crashes (segfault known issue), no pdfplumber text fallback
- **No PDF cleaning** -- corrupt/malformed PDFs not cleaned before parsing
- Potential improvements to reduce failure rate:
  1. Add pdfplumber as full text extraction fallback (not just tables)
  2. Add PyMuPDF `doc.tobytes(garbage=3, clean=True)` pre-cleaning step
  3. Add OCR fallback for image-only pages (requires Tesseract bundled or optional)
  4. Better error messages for specific failure modes

### First-Run UX

- No onboarding code exists anywhere in the codebase
- App opens to project list (blank if no projects)
- No sample data, hints, or guided tour

## Open Questions

1. **Tesseract bundling for OCR**
   - What we know: PyMuPDF supports Tesseract OCR natively, but Tesseract must be installed separately (~30MB)
   - What's unclear: Whether to bundle Tesseract in the installer (increases size significantly) or make OCR a graceful degradation
   - Recommendation: Skip Tesseract bundling for MVP. Focus on improving text-extraction reliability with pdfplumber fallback and PDF cleaning. OCR is a future enhancement.

2. **Auto-unpack natives (better-sqlite3)**
   - What we know: `asar: true` is set, `plugin-auto-unpack-natives` is listed in devDeps but NOT in forge.config.ts plugins
   - What's unclear: Whether better-sqlite3.node is being correctly unpacked
   - Recommendation: Test `npm run package` and verify better-sqlite3 works. If not, add `asarUnpack` pattern or enable the plugin.

3. **MVP branch strategy**
   - What we know: Branch from current master (which has M2 Phase 8 work started)
   - What's unclear: Should branch from last v1 commit or from current master?
   - Recommendation: Branch from the v1 tag/commit before M2 work began. The roadmap says "branches from v1 code, not M2."

4. **Code signing for distribution**
   - What we know: Azure Trusted Signing config exists but is env-var gated
   - What's unclear: Whether signing is required for MVP testers (SmartScreen warnings without it)
   - Recommendation: Ship unsigned for internal testers. Document the SmartScreen "More info > Run anyway" flow.

## Sources

### Primary (HIGH confidence)

- Codebase investigation: `forge.config.ts`, `pythonManager.ts`, `pdf_parser.py`, `samsara.spec`, `index.ts`, `package.json`
- [Electron Forge Custom App Icons](https://www.electronforge.io/guides/create-and-add-icons)
- [Electron Forge Squirrel.Windows Maker](https://www.electronforge.io/config/makers/squirrel.windows)

### Secondary (MEDIUM confidence)

- [PyMuPDF OCR Documentation](https://pymupdf.readthedocs.io/en/latest/recipes-ocr.html)
- [PyMuPDF Common Issues](https://pymupdf.readthedocs.io/en/latest/recipes-common-issues-and-their-solutions.html)
- [electron-squirrel-startup npm](https://www.npmjs.com/package/electron-squirrel-startup)

### Tertiary (LOW confidence)

- [2025 PDF Extractor Comparison (Medium)](https://onlyoneaman.medium.com/i-tested-7-python-pdf-extractors-so-you-dont-have-to-2025-edition-c88013922257)
- [PDF Parser Ranking for RAG (Medium)](https://infinityai.medium.com/3-proven-techniques-to-accurately-parse-your-pdfs-2c01c5badb84)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - all libraries already installed, config examined directly
- Architecture: HIGH - codebase paths and configs verified, bugs identified
- Pitfalls: HIGH (codebase bugs) / MEDIUM (PDF improvements)
- PDF reliability: MEDIUM - improvement strategies identified but need testing against actual failure corpus

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (stable domain, Electron Forge doesn't change fast)
