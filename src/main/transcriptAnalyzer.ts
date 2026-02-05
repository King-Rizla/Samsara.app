/**
 * Transcript Analyzer - Phase 11 AI Voice Screening
 *
 * Uses Claude to analyze screening call transcripts and determine
 * pass/maybe/fail outcomes based on project screening criteria.
 *
 * Per CONTEXT.md:
 * - Disqualification model (filter out, not filter in)
 * - Key disqualifiers: location mismatch, salary out of range, not interested
 * - Post-call analysis (not real-time)
 */

import Anthropic from "@anthropic-ai/sdk";
import { getCredential } from "./credentialManager";
import {
  getScreeningCriteria,
  type ScreeningCriteria,
} from "./screeningService";

// ============================================================================
// Types
// ============================================================================

export interface ScreeningResult {
  outcome: "pass" | "maybe" | "fail";
  confidence: number; // 0-100
  reasoning: string;
  extractedData: {
    salaryExpectation?: string;
    location?: string;
    availability?: string;
    interestLevel?: string;
    contactPreference?: string;
  };
  disqualifiers: string[];
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Analyze a screening transcript to determine pass/maybe/fail.
 * Uses Claude to extract information and evaluate against criteria.
 *
 * Per CONTEXT.md decisions:
 * - 5 fixed question categories: salary, location, availability, interest, contact
 * - Disqualification model: filter out candidates who don't meet thresholds
 * - pass/maybe/fail outcome structure
 */
export async function analyzeTranscript(
  transcript: string,
  projectId: string,
): Promise<ScreeningResult> {
  // Get API key from credentials (uses 'anthropic' provider)
  const apiKey = getCredential(null, "anthropic", "api_key");

  if (!apiKey) {
    console.warn("[TranscriptAnalyzer] No Anthropic API key, returning maybe");
    return {
      outcome: "maybe",
      confidence: 50,
      reasoning:
        "No API key configured for transcript analysis - requires manual review",
      extractedData: {},
      disqualifiers: [],
    };
  }

  // Get screening criteria for this project
  const criteria = getScreeningCriteria(projectId);

  const client = new Anthropic({ apiKey });

  const systemPrompt = buildSystemPrompt(criteria);
  const userPrompt = buildUserPrompt(transcript);

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse JSON response - handle markdown code blocks
    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7);
    }
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith("```")) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const result = JSON.parse(jsonText) as ScreeningResult;

    // Validate and constrain outcome
    if (!["pass", "maybe", "fail"].includes(result.outcome)) {
      result.outcome = "maybe";
    }
    result.confidence = Math.max(0, Math.min(100, result.confidence || 50));

    // Ensure extractedData and disqualifiers exist
    if (!result.extractedData) {
      result.extractedData = {};
    }
    if (!result.disqualifiers) {
      result.disqualifiers = [];
    }

    console.log(
      `[TranscriptAnalyzer] Analysis complete: ${result.outcome} (${result.confidence}%)`,
    );
    return result;
  } catch (error) {
    console.error("[TranscriptAnalyzer] Analysis failed:", error);
    return {
      outcome: "maybe",
      confidence: 50,
      reasoning: "Analysis failed - requires manual review",
      extractedData: {},
      disqualifiers: [],
    };
  }
}

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Build system prompt for transcript analysis.
 */
function buildSystemPrompt(criteria: ScreeningCriteria): string {
  return `You are analyzing a pre-screening call transcript between a recruitment AI agent and a candidate.

Your task is to:

1. Extract key information from the 5 question categories
2. Identify any disqualifying factors
3. Determine if the candidate should PASS, MAYBE, or FAIL

## Screening Criteria

${criteria.salaryMin || criteria.salaryMax ? `Salary Range: ${criteria.salaryMin ? `Min: ${criteria.salaryMin.toLocaleString()}` : ""} ${criteria.salaryMax ? `Max: ${criteria.salaryMax.toLocaleString()}` : ""}` : "Salary: No specific range set"}
${criteria.locations?.length ? `Allowed Locations: ${criteria.locations.join(", ")}` : "Locations: Any"}
${criteria.noticePeriod ? `Notice Period: ${criteria.noticePeriod}` : ""}
${criteria.requiredAvailability ? `Availability: ${criteria.requiredAvailability}` : ""}
${criteria.workAuthorization ? `Work Authorization: ${criteria.workAuthorization}` : ""}

## Disqualification Reasons

- Salary expectation significantly above range (>20% over max)
- Location mismatch with no willingness to relocate (if locations specified)
- Explicitly not interested in opportunities
- Unavailable for the foreseeable future
- Rude, unresponsive, or hung up during call

## Outcome Definitions

**PASS**: Meets criteria, engaged, interested, no disqualifiers
**MAYBE**: Some uncertainty, partial answers, minor concerns, needs recruiter review
**FAIL**: Clear disqualifier present

When in doubt, lean toward MAYBE - recruiters can make final decisions.

Respond with JSON only. No markdown code blocks.`;
}

/**
 * Build user prompt with transcript.
 */
function buildUserPrompt(transcript: string): string {
  return `Analyze this screening call transcript:

---

${transcript}

---

Return JSON with this exact structure:
{
  "outcome": "pass" | "maybe" | "fail",
  "confidence": number (0-100),
  "reasoning": "Brief explanation of the outcome",
  "extractedData": {
    "salaryExpectation": "string or null - what they said about salary",
    "location": "string or null - their current location",
    "availability": "string or null - when they can start",
    "interestLevel": "string or null - how interested they seemed",
    "contactPreference": "string or null - best way to reach them"
  },
  "disqualifiers": ["list of disqualifying factors if any"]
}`;
}
