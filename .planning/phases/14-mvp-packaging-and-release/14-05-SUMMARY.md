# Phase 14 Plan 05: Landing Page & Deployment Summary

**One-liner:** Created landing page with download link, deployed to Vercel, MVP now live for test users

## What Was Done

### Task 1: GitHub Release Setup

- Created separate repo `Samsara.mvp` for MVP distribution
- Pushed mvp branch code to new repo
- Created GitHub Release `MVP-v0.1.0` with portable ZIP asset
- Download URL: `https://github.com/King-Rizla/Samsara.mvp/releases/download/MVP-v0.1.0/Samsara-win32-x64-1.0.0.zip`

### Task 2: Landing Page Creation

- Created `landing/` folder with static HTML/CSS
- Matched app's terminal dark theme (black bg, purple accents, JetBrains Mono)
- Included:
  - Hero with value props (Zero Latency, Zero Egress, Zero Per-Seat Tax)
  - Download button linked to GitHub Release
  - Features section (CV Parsing, JD Matching, Split-View Editor, Branded Export)
  - Requirements section (Windows 10+, Ollama/OpenAI)
  - Getting Started steps

### Task 3: Vercel Deployment

- Created separate repo `Samsara.landing` for landing page
- Pushed landing page to repo
- Connected Vercel for auto-deployment
- Live URL: https://samsaralanding.vercel.app

## Verification

- ✓ ZIP downloads correctly from GitHub Release (~250MB)
- ✓ Extracted app runs successfully on fresh test
- ✓ No sensitive data bundled (DB stored in user AppData)
- ✓ Landing page loads with all sections
- ✓ Download button links to correct release

## Repos Created

| Repo            | Purpose                 | URL                                           |
| --------------- | ----------------------- | --------------------------------------------- |
| Samsara.mvp     | MVP app code + releases | https://github.com/King-Rizla/Samsara.mvp     |
| Samsara.landing | Landing page (Vercel)   | https://github.com/King-Rizla/Samsara.landing |

## Duration

~20 minutes

## Outcome

**MVP is live.** Test users can visit https://samsaralanding.vercel.app to download Samsara.
