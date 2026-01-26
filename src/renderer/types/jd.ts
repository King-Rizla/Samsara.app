// JD (Job Description) data types for matching

/**
 * A skill requirement extracted from a job description.
 */
export interface SkillRequirement {
  skill: string;
  importance: 'required' | 'preferred' | 'nice-to-have';
  category?: string;
}

/**
 * Full job description with LLM-extracted requirements.
 */
export interface JobDescription {
  id: string;
  title: string;
  company?: string;
  raw_text: string;
  created_at: string;
  updated_at: string;

  // LLM-extracted requirements
  required_skills: SkillRequirement[];
  preferred_skills: SkillRequirement[];
  experience_min?: number;
  experience_max?: number;
  education_level?: string;
  certifications: string[];
}

/**
 * Summary view for JD list (lighter than full JD).
 */
export interface JDSummary {
  id: string;
  title: string;
  company?: string;
  created_at: string;
  required_count: number;
  preferred_count: number;
}

/**
 * Result of matching a CV against a JD.
 */
export interface MatchResult {
  cv_id: string;
  jd_id: string;
  match_score: number;  // 0-100
  matched_skills: string[];
  missing_required: string[];
  missing_preferred: string[];
  calculated_at: string;
}

/**
 * Input data for JD extraction (before ID assigned).
 */
export interface JDExtractionInput {
  title: string;
  company?: string;
  required_skills: SkillRequirement[];
  preferred_skills: SkillRequirement[];
  experience_min?: number;
  experience_max?: number;
  education_level?: string;
  certifications: string[];
}

// Global window type declarations for JD IPC API
declare global {
  interface Window {
    api: Window['api'] & {
      extractJD: (text: string) => Promise<{ success: boolean; data?: JobDescription; error?: string }>;
      getAllJDs: () => Promise<{ success: boolean; data?: JDSummary[]; error?: string }>;
      getJD: (jdId: string) => Promise<{ success: boolean; data?: JobDescription; error?: string }>;
      deleteJD: (jdId: string) => Promise<{ success: boolean; error?: string }>;
      matchCVsToJD: (jdId: string, cvIds: string[]) => Promise<{ success: boolean; results?: MatchResult[]; error?: string }>;
      getMatchResults: (jdId: string) => Promise<{ success: boolean; data?: MatchResult[]; error?: string }>;
    };
  }
}

export {};
