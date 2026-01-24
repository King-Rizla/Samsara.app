# Plan 01-03: Sidecar Integration & Code Signing

**Status:** Complete
**Duration:** ~15 min
**Verified:** 2026-01-24 (user approved)

## Objective

Integrate Python sidecar with Electron shell, configure code signing, and validate the distribution pipeline.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Create Python manager with spawn-based IPC | a7cebfa | ✓ |
| 2 | Configure Forge for packaging with code signing | a2a7cc8 | ✓ |
| 3 | Checkpoint: Phase 1 Complete Verification | - | ✓ Approved |

## Key Artifacts

| File | Purpose |
|------|---------|
| `src/main/pythonManager.ts` | Python sidecar lifecycle management (spawn + JSON lines) |
| `src/main/index.ts` | Updated with Python startup and cleanup |
| `forge.config.ts` | extraResource for sidecar, signing config |
| `windowsSign.ts` | Azure Trusted Signing configuration |
| `entitlements.plist` | macOS hardened runtime entitlements |
| `metadata.json` | Azure signing metadata template |
| `.env.signing.example` | Environment variable template for signing |

## Verification Results

- [x] `npm run start` launches app with Python sidecar
- [x] Console shows "Python sidecar ready"
- [x] No python-shell library in codebase
- [x] `npm run package` creates packaged app
- [x] Packaged app includes Python sidecar in resources
- [x] Python process terminates cleanly on app close
- [x] Code signing config files in place

## Deviations

| Rule | Issue | Resolution |
|------|-------|------------|
| Rule 3 (Blocking) | package.json main entry pointed to wrong Vite output | Fixed to `.vite/build/index.js` |

## Phase 1 Success Criteria Validated

1. ✓ Packaged app loads spaCy model and responds to IPC health check within 10 seconds
2. ✓ PyInstaller `--onedir` build completes with all spaCy hidden imports
3. ✓ Code signing configuration in place for Windows and macOS
4. ✓ Electron shell displays window and communicates with Python sidecar via stdio JSON
5. ✓ SQLite database initializes in userData with WAL mode

## Next Steps

Phase 1 complete. Ready for Phase 2: Parsing Pipeline.
