# Release Workflow

## Overview

Samsara uses a two-branch release strategy with separate repos for distribution.

## Repositories

| Repo            | Purpose                     | URL                                           |
| --------------- | --------------------------- | --------------------------------------------- |
| Samsara.app     | Main development            | https://github.com/King-Rizla/Samsara.app     |
| Samsara.mvp     | MVP distribution + releases | https://github.com/King-Rizla/Samsara.mvp     |
| Samsara.landing | Landing page (Vercel)       | https://github.com/King-Rizla/Samsara.landing |

## Branches

```
master ─────────────────────────────────────────►
   │        (main development, M2+ features)
   │
   └── mvp ─────────────────────────────────────►
              (stable release branch)
```

- **master**: Main development branch (M2 Automated Outreach, future features)
- **mvp**: Stable release branch for test users

## Git Remotes (in Samsara.app)

```bash
origin  → https://github.com/King-Rizla/Samsara.app.git
mvp     → https://github.com/King-Rizla/Samsara.mvp.git
```

## Version Numbering

| Change Type   | Version Pattern | Example        |
| ------------- | --------------- | -------------- |
| Hotfix/bugfix | v0.1.x          | v0.1.1, v0.1.2 |
| Feature batch | v0.x.0          | v0.2.0, v0.3.0 |
| Major release | vX.0.0          | v1.0.0         |

---

## Scenario 1: Critical Bug Fix

User reports something broken → fix immediately on `mvp` branch.

```bash
# 1. Switch to mvp branch
git checkout mvp

# 2. Fix the bug
# ... make changes ...

# 3. Commit
git add <files>
git commit -m "fix: description of the bug"

# 4. Push to both repos
git push origin mvp          # Samsara.app (backup)
git push mvp main            # Samsara.mvp (distribution)

# 5. Rebuild the app
npx electron-forge make

# 6. Create new GitHub Release
# Go to: https://github.com/King-Rizla/Samsara.mvp/releases/new
# - Tag: v0.1.1 (increment patch version)
# - Upload: out/make/zip/win32/x64/Samsara-win32-x64-1.0.0.zip
# - Mark as latest release

# 7. Update landing page (if filename changed)
cd landing
# Edit index.html with new download URL
git add . && git commit -m "chore: update download link to v0.1.1"
git push origin master

# 8. Cherry-pick fix to master (so it's not lost)
git checkout master
git cherry-pick <commit-hash>
git push origin master
```

## Scenario 2: Feature Enhancement

Planned improvement developed on master, then merged to mvp when ready.

```bash
# 1. Develop on master
git checkout master
# ... make changes, multiple commits ...
git push origin master

# 2. When ready to release, merge to mvp
git checkout mvp
git merge master
# Resolve any conflicts if needed

# 3. Update version in package.json
# Change "version": "1.0.0" → "1.1.0" (or appropriate)

# 4. Commit version bump
git add package.json
git commit -m "chore: bump version to v0.2.0"

# 5. Push to both repos
git push origin mvp
git push mvp main

# 6. Rebuild and release (same as hotfix steps 5-7)
```

## Scenario 3: Landing Page Only Update

Update copy, styling, or links without app changes.

```bash
cd landing

# Make changes to index.html or style.css
# ...

git add .
git commit -m "chore: update landing page copy"
git push origin master

# Vercel auto-deploys within ~30 seconds
```

---

## Build Commands

```bash
# Development mode
npm start

# Production build (creates out/make/)
npx electron-forge make

# Output locations after build:
# - out/make/zip/win32/x64/Samsara-win32-x64-X.X.X.zip (portable)
# - out/make/squirrel.windows/x64/SamsaraSetup.exe (installer - needs .nupkg)
```

## Release Checklist

Before releasing a new version:

- [ ] All changes committed
- [ ] App tested locally (`npm start`)
- [ ] Production build tested (extract ZIP, run Samsara.exe)
- [ ] Version bumped in package.json
- [ ] Pushed to both repos
- [ ] GitHub Release created with ZIP attached
- [ ] Landing page updated (if needed)
- [ ] Verified download works from landing page

---

## Current State

**Live Version:** MVP v0.1.0
**Landing Page:** https://samsaralanding.vercel.app
**Download:** https://github.com/King-Rizla/Samsara.mvp/releases/download/MVP-v0.1.0/Samsara-win32-x64-1.0.0.zip

---

_Created: 2026-02-03_
