# Phase 14 Plan 01: Build Configuration Foundation Summary

**One-liner:** Fixed sidecar path mismatch, guarded DevTools, configured asar unpacking for better-sqlite3, and added purple placeholder app icon for Windows packaging.

## Tasks Completed

| #   | Task                      | Commit  | Key Files                                                     |
| --- | ------------------------- | ------- | ------------------------------------------------------------- |
| 1   | Fix build configuration   | 0af2c89 | forge.config.ts, src/main/pythonManager.ts, src/main/index.ts |
| 2   | Generate application icon | 8334e6a | assets/icon.ico, assets/icon.png, assets/icon.svg             |

## Changes Made

### Task 1: Build Configuration Fixes

- **Sidecar path:** Changed `resources/python` to `resources/samsara-backend` in pythonManager.ts to match extraResource output directory name
- **DevTools guard:** Wrapped `openDevTools()` with `if (!app.isPackaged)` so production builds never show DevTools
- **asar unpacking:** Added `asarUnpack: ['**/node_modules/better-sqlite3/**']` so native module loads correctly from packaged app
- **MakerSquirrel:** Added `name: 'samsara'` and `setupIcon: './assets/icon.ico'` for Windows installer branding
- **Icon config:** Added `packagerConfig.icon: './assets/icon'` for app exe icon

### Task 2: Application Icon

- Created purple gradient SVG with "S" letter as placeholder
- Converted to 256x256 PNG via sharp-cli
- Generated multi-resolution ICO (285KB) via png-to-ico

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stashed changes from master carried into mvp branch**

- **Found during:** Task 1 commit
- **Issue:** `git stash` on master + checkout to mvp left unstaged changes; lint-staged stash/restore created an extra commit `bc00c95` between task commits
- **Fix:** Restored unrelated file (python-src/parsers/base.py) before committing. The extra commit exists in history but does not affect correctness.

## Verification

- mvp branch exists at c18b1a5 base commit
- `grep "samsara-backend" src/main/pythonManager.ts` confirms corrected path
- `grep "isPackaged" src/main/index.ts` confirms DevTools guard
- `grep "asarUnpack" forge.config.ts` confirms better-sqlite3 unpacking
- `grep "setupIcon" forge.config.ts` confirms icon config
- assets/icon.ico exists (285KB), assets/icon.png exists (7KB)
- tsc errors are pre-existing react-router type issues, not from our changes

## Duration

~4 minutes

## Next Steps

- 14-02: Test packaging with `npx electron-forge make` and fix any build errors
