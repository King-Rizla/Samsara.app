# Samsara

## What This Is

Samsara is a **Sovereign Recruitment Suite**. It is a local-first desktop application that replaces expensive, cloud-hosted SaaS tools (Parsing, Sourcing, Note Taking) with high-performance local automation. By utilizing the user's own CPU and existing access rights, it eliminates "seat taxes," cloud latency, and data privacy risks.

## Strategic Wedge

**The "Formatter" First.**

We attack the "Admin Bottleneck" (Category 1) first.

* **Problem:** Agencies pay $30k+ for DaXtra or ration AllSorted licenses, forcing manual "Shadow Workflows" where recruiters email CVs to admins.

* **Solution:** A $0-latency, drag-and-drop Desktop Formatter installed on *every* recruiter's machine.

## Core Value

**Architecture as the Advantage.**

1. **Zero Latency:** Bulk process 100 CVs in seconds via local CPU (vs. minutes via Cloud Queue).

2. **Zero Egress:** Candidate data never leaves the laptop (GDPR/Defense compliant).

3. **Zero Per-Seat Tax:** We monetize the *Agency*, not the *User*, destroying the "Shadow License" economy.

## Context

- **Target Audience:** Mid-sized agencies (20-100 seats) trapped in "Shadow Workflows."

- **Architecture:** Electron + Local Python Sidecar + SQLite.

- **Business Model:** Agency-wide License (Ubiquitous Install) vs. Per-Seat SaaS.

## Constraints

- **Tech stack**: Electron + Python sidecar + SQLite — local-first architecture is non-negotiable
- **Performance**: < 2 seconds per resume processing on local CPU
- **Privacy**: Zero data egress — candidate data never leaves the machine

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **Formatter First** | Highest friction point; easiest ROI to prove ("4 hours to 4 minutes"). | ✓ Final |
| **Local Processing** | Eliminates server COGS; enables "Zero Latency" bulk actions. | ✓ Final |
| **No Bots** | "Listeners" must record system audio, not join calls as a bot. | ✓ Final |
| **DOM Bridge** | Integration via browser DOM (Frontend) rather than expensive API (Backend). | ✓ Final |

---
*Last updated: 2026-01-23 after initialization*
