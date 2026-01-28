import type { JobDescription, MatchResult, SkillRequirement, ExpandedSkill } from '../types/jd';
import type { ParsedCV, SkillGroup } from '../types/cv';
import { normalizeSkill, skillsMatch } from './skillVariants';

/**
 * Flatten CV skills from grouped format into a normalized array.
 */
function flattenCVSkills(skillGroups: SkillGroup[]): string[] {
  const allSkills: string[] = [];

  for (const group of skillGroups) {
    for (const skill of group.skills) {
      allSkills.push(normalizeSkill(skill));
    }
  }

  return allSkills;
}

/**
 * Check if a JD skill requirement is matched by any CV skill.
 * Uses LLM-generated expanded skill variants as primary source,
 * falling back to static skillVariants mapping.
 */
function findMatchingSkill(
  requirement: SkillRequirement,
  cvSkills: string[],
  expandedSkills?: ExpandedSkill[]
): string | null {
  const normalizedReq = normalizeSkill(requirement.skill);

  // Primary: check LLM-generated expanded variants
  if (expandedSkills) {
    const expanded = expandedSkills.find(
      (es) => normalizeSkill(es.skill) === normalizedReq
    );
    if (expanded) {
      const allVariants = [
        normalizeSkill(expanded.skill),
        ...expanded.variants.map(normalizeSkill),
        ...expanded.related_tools.map(normalizeSkill),
      ];
      for (const cvSkill of cvSkills) {
        if (allVariants.includes(cvSkill)) {
          return cvSkill;
        }
      }
    }
  }

  // Fallback: static skill variant matching
  for (const cvSkill of cvSkills) {
    if (skillsMatch(normalizedReq, cvSkill)) {
      return cvSkill;
    }
  }

  return null;
}

/**
 * Calculate match score between a CV and a Job Description.
 *
 * Scoring algorithm:
 * - Required skills: 70% weight
 * - Preferred skills: 30% weight
 *
 * If a category has no requirements, full credit is given for that category.
 *
 * @returns MatchResult with score (0-100) and detailed breakdown
 */
export function calculateMatchScore(
  cv: ParsedCV,
  jd: JobDescription
): MatchResult {
  const cvSkills = flattenCVSkills(cv.skills);
  const expandedSkills = jd.matching_metadata?.expanded_skills;

  const matchedRequired: string[] = [];
  const missingRequired: string[] = [];
  const matchedPreferred: string[] = [];
  const missingPreferred: string[] = [];

  // Check required skills
  for (const req of jd.required_skills) {
    const match = findMatchingSkill(req, cvSkills, expandedSkills);
    if (match) {
      matchedRequired.push(req.skill);
    } else {
      missingRequired.push(req.skill);
    }
  }

  // Check preferred skills
  for (const pref of jd.preferred_skills) {
    const match = findMatchingSkill(pref, cvSkills, expandedSkills);
    if (match) {
      matchedPreferred.push(pref.skill);
    } else {
      missingPreferred.push(pref.skill);
    }
  }

  // Calculate weighted score
  const requiredWeight = 0.7;
  const preferredWeight = 0.3;

  // If no required skills specified, give full credit for required portion
  const requiredScore = jd.required_skills.length > 0
    ? (matchedRequired.length / jd.required_skills.length) * requiredWeight
    : requiredWeight;

  // If no preferred skills specified, give full credit for preferred portion
  const preferredScore = jd.preferred_skills.length > 0
    ? (matchedPreferred.length / jd.preferred_skills.length) * preferredWeight
    : preferredWeight;

  const matchScore = Math.round((requiredScore + preferredScore) * 100);

  return {
    cv_id: '', // Will be set by caller
    jd_id: jd.id,
    match_score: matchScore,
    matched_skills: [...matchedRequired, ...matchedPreferred],
    missing_required: missingRequired,
    missing_preferred: missingPreferred,
    calculated_at: new Date().toISOString(),
  };
}

/**
 * Calculate match scores for multiple CVs against a single JD.
 * Returns results sorted by match score (highest first).
 */
export function calculateBatchMatchScores(
  cvs: Array<{ id: string; cv: ParsedCV }>,
  jd: JobDescription
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const { id, cv } of cvs) {
    const result = calculateMatchScore(cv, jd);
    result.cv_id = id;
    results.push(result);
  }

  // Sort by match score descending
  results.sort((a, b) => b.match_score - a.match_score);

  return results;
}

/**
 * Get a human-readable match quality label.
 */
export function getMatchQuality(score: number): {
  label: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
} {
  if (score >= 75) {
    return { label: 'Strong Match', color: 'green' };
  } else if (score >= 50) {
    return { label: 'Good Match', color: 'yellow' };
  } else if (score >= 25) {
    return { label: 'Partial Match', color: 'orange' };
  } else {
    return { label: 'Weak Match', color: 'red' };
  }
}
