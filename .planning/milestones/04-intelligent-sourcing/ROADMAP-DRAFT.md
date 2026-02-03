# Milestone 4: Intelligent Sourcing (DRAFT)

## Overview

This milestone automates the top of the recruitment funnel - from client intake call to a scored, de-duplicated candidate pool. It replaces manual boolean searching and CV library crawling with AI-driven sourcing.

**Vision Reference:** Candidate Flow Steps 1-6, 8 auto-proceed (Stage 1 top)

**Prerequisite:** Milestone 3 complete (Client Coordination)

**Note:** This milestone is sequenced last because it requires the downstream pipeline (formatting, outreach, scheduling) to be operational. Sourcing generates volume; the pipeline must handle it first.

---

## Scope

| Step | Description                               | Automation Level       |
| ---- | ----------------------------------------- | ---------------------- |
| 1    | Client call recording + job description   | User-initiated capture |
| 2    | Distill call + JD into matching criteria  | Full                   |
| 3    | Create booleans, search CV libraries      | Full                   |
| 4    | Download/scrape relevant CVs              | Full                   |
| 5    | De-duplication check                      | Full                   |
| 6    | Browse connected database/ATS for matches | Full                   |
| 8    | Auto-proceed based on score threshold     | Configurable           |

---

## Proposed Phases

### Phase 1: Call Recording & Transcription

**Goal:** Capture client intake calls without joining as a bot

**Success Criteria:**

1. System audio capture (records what recruiter hears)
2. Microphone capture option (records recruiter's voice too)
3. One-click start/stop recording from Samsara
4. Audio stored locally with project association
5. Transcription via Whisper (local) or cloud API
6. Speaker diarization (client vs recruiter)

**Key Decisions Needed:**

- Local Whisper vs cloud transcription? (Privacy vs accuracy)
- How to handle poor audio quality?
- Consent workflow for recording?

**Technical Notes:**

- Per PROJECT.md: "Listeners must record system audio, not join calls as a bot"
- Must work with any calling software (Teams, Zoom, phone)

---

### Phase 2: Criteria Extraction Engine

**Goal:** Convert call transcript + JD into structured matching criteria

**Success Criteria:**

1. LLM extracts must-have vs nice-to-have requirements
2. Identifies skills, experience levels, certifications
3. Extracts salary expectations, location preferences
4. Captures cultural fit indicators from conversation
5. User can review and adjust extracted criteria
6. Criteria saved as project matching profile

**Key Decisions Needed:**

- Structured schema for criteria? (Reuse JD parsing from M1?)
- How to weight call insights vs written JD?
- Confidence scoring for extracted criteria?

---

### Phase 3: Boolean Query Generator

**Goal:** Automatically generate search queries for CV databases

**Success Criteria:**

1. Generates boolean strings from criteria (AND, OR, NOT)
2. Supports wide/narrow/midline search variants
3. Adapts syntax for different platforms (LinkedIn, job boards)
4. User can preview and edit generated queries
5. Query history saved per project

**Key Decisions Needed:**

- Which platforms to support initially?
- How to handle platform-specific quirks?
- Should AI suggest query refinements based on results?

---

### Phase 4: CV Library Connectors

**Goal:** Search and retrieve CVs from external databases

**Success Criteria:**

1. Integration with major CV databases (CV-Library, Reed, Monster)
2. Integration with LinkedIn (via DOM bridge, not API)
3. Search execution with generated booleans
4. Results preview before bulk download
5. Rate limiting to avoid platform bans
6. Credential management per recruiter

**Key Decisions Needed:**

- Which databases to prioritize?
- How to handle platforms requiring paid access?
- Caching strategy for search results?

**Technical Notes:**

- Per PROJECT.md: "DOM Bridge - Integration via browser DOM (Frontend) rather than expensive API (Backend)"

---

### Phase 5: CV Download & Normalization

**Goal:** Retrieve CVs from search results and prepare for pipeline

**Success Criteria:**

1. Bulk download from search results
2. Handles various formats (PDF, DOCX, HTML profiles)
3. Normalizes to consistent format for parsing
4. Metadata preserved (source, search query, date found)
5. Progress tracking for large batches
6. Error handling for failed downloads

**Key Decisions Needed:**

- Storage strategy for bulk CVs?
- How to handle platform-specific CV formats?
- Retry logic for transient failures?

---

### Phase 6: De-duplication Engine

**Goal:** Identify and merge duplicate candidates

**Success Criteria:**

1. Fuzzy matching on name, email, phone
2. Content similarity detection (same CV, different filename)
3. Cross-source deduplication (same person on multiple platforms)
4. Merge UI for reviewing potential duplicates
5. Master record designation with source tracking
6. Automatic de-dup option for high-confidence matches

**Key Decisions Needed:**

- Similarity threshold for auto-merge?
- How to handle conflicting information across sources?
- De-dup against existing ATS records?

---

### Phase 7: ATS/Database Connector

**Goal:** Search existing company database for matches

**Success Criteria:**

1. Connect to recruiter's existing ATS
2. Search ATS candidates against current criteria
3. Import relevant records into project
4. Avoid duplicating candidates already in ATS
5. Sync status bidirectionally (Samsara <-> ATS)

**Key Decisions Needed:**

- Which ATS systems to prioritize?
- Read-only vs read-write integration?
- How to handle ATS candidates missing from local DB?

---

### Phase 8: Auto-Proceed Configuration

**Goal:** Automatically advance high-scoring candidates

**Success Criteria:**

1. Configurable score threshold per project
2. Candidates above threshold auto-proceed to outreach
3. Candidates below threshold queued for manual review
4. Audit log of auto-proceed decisions
5. Easy override to pause auto-proceed
6. Notification when candidates auto-advance

**Key Decisions Needed:**

- Default threshold? (Or require explicit setting?)
- Should auto-proceed respect working hours?
- Volume limits (max auto-proceed per day)?

---

## Integration Requirements

| Integration         | Purpose                  | Priority |
| ------------------- | ------------------------ | -------- |
| System Audio API    | Call recording           | High     |
| Whisper (local/API) | Transcription            | High     |
| CV-Library API/DOM  | CV search & download     | High     |
| LinkedIn (DOM)      | Profile search           | High     |
| Reed, Monster, etc. | Additional CV sources    | Medium   |
| ATS Connectors      | Existing database search | Medium   |

---

## Data Model Extensions

```
calls
  - id
  - project_id
  - recorded_at
  - duration_seconds
  - audio_path (local)
  - transcript_text
  - transcript_segments[] (with timestamps, speakers)

criteria
  - id
  - project_id
  - source (call, jd, manual)
  - must_have[]
  - nice_to_have[]
  - experience_years_min
  - experience_years_max
  - salary_min
  - salary_max
  - locations[]
  - remote_ok
  - raw_notes

search_queries
  - id
  - project_id
  - criteria_id
  - platform (linkedin, cv-library, etc.)
  - query_string
  - variant (wide, narrow, midline)
  - results_count
  - executed_at

cv_sources
  - cv_id (FK)
  - source_platform
  - source_url
  - downloaded_at
  - search_query_id (FK)

duplicates
  - id
  - master_cv_id
  - duplicate_cv_id
  - confidence
  - match_reasons[]
  - resolved_at
  - resolution (merged, distinct, ignored)
```

---

## Risk Assessment

| Risk                                | Mitigation                                                 |
| ----------------------------------- | ---------------------------------------------------------- |
| Platform ToS violations             | Rate limiting, DOM bridge approach, user's own credentials |
| Poor transcription quality          | Manual correction UI, multiple transcription options       |
| False positive duplicates           | Confidence thresholds, manual review queue                 |
| Sourcing volume overwhelms pipeline | Batch limits, auto-proceed caps                            |
| Boolean queries return poor results | Iterative refinement, user feedback loop                   |

---

## Open Questions

1. Legal implications of scraping CV databases? (User's own subscriptions)
2. How to handle international sourcing (language, data residency)?
3. Should sourcing run continuously or on-demand?
4. Integration with LinkedIn Recruiter vs regular LinkedIn?
5. How to measure sourcing quality (conversion to hire)?

---

## Success Metrics

| Metric                           | Target                    |
| -------------------------------- | ------------------------- |
| Criteria extraction accuracy     | >85% match to manual      |
| Search result relevance          | >70% scorable candidates  |
| De-duplication accuracy          | >95% correct merges       |
| Time from call to candidate pool | <2 hours                  |
| Auto-proceed precision           | >80% proceed to interview |

---

## Why This Milestone is Last

1. **Pipeline must exist first:** Sourcing generates candidate volume. Without formatting, outreach, and scheduling in place, candidates would bottleneck.

2. **Learning from earlier milestones:** Criteria extraction can reuse JD parsing (M1). Outreach patterns inform what makes a "good" sourced candidate.

3. **Highest complexity:** Call recording, multi-platform scraping, and de-duplication are technically challenging. Better to have stable foundation first.

4. **Business value sequence:** Agencies already have candidates (from job boards, referrals). Automating what happens _after_ sourcing delivers immediate value. Sourcing automation is the "cherry on top."

---

_Draft created: 2026-01-28_
_Status: Awaiting Milestone 3 completion_
_Source: .planning/vision/candidate-flow.md_
