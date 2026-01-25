// CV data types matching database schema

export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

export interface WorkEntry {
  company: string;
  position: string;
  start_date?: string;
  end_date?: string;
  description: string;
  highlights: string[];
  confidence: number;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  grade?: string;
  confidence: number;
}

export interface SkillGroup {
  category: string;
  skills: string[];
}

export interface ParsedCV {
  contact: ContactInfo;
  work_history: WorkEntry[];
  education: EducationEntry[];
  skills: SkillGroup[];
  certifications: string[];
  languages: string[];
  other_sections: Record<string, string>;
  raw_text: string;
  section_order: string[];
  parse_confidence: number;
  warnings: string[];
  extract_time_ms?: number;
}

export type QueueStatus = 'submitted' | 'completed' | 'failed';
export type ProcessingStage = 'Parsing...' | 'Extracting...' | 'Saving...';

export interface QueueItem {
  id: string;
  fileName: string;
  fileType: string;  // 'pdf' | 'docx' | 'doc'
  filePath: string;
  status: QueueStatus;
  stage?: ProcessingStage;
  error?: string;
  data?: ParsedCV;
  parseConfidence?: number;
  createdAt: string;
}

// Global window type declarations for Electron IPC API
declare global {
  interface Window {
    api: {
      extractCV: (filePath: string) => Promise<{ success: boolean; data?: ParsedCV; id?: string; totalTime?: number; error?: string }>;
      getAllCVs: () => Promise<{ success: boolean; data?: { id: string; file_name: string; file_path?: string; contact_json: string; parse_confidence: number; created_at: string }[]; error?: string }>;
      selectCVFile: () => Promise<{ success: boolean; filePath?: string; fileName?: string; canceled?: boolean }>;
      getCV: (cvId: string) => Promise<{ success: boolean; data?: ParsedCV; error?: string }>;
      updateCVField: (cvId: string, fieldPath: string, value: unknown) => Promise<{ success: boolean; error?: string }>;
      deleteCV: (cvId: string) => Promise<{ success: boolean; error?: string }>;
      reprocessCV: (filePath: string) => Promise<{ success: boolean; data?: ParsedCV; error?: string }>;
    };
    electronFile: {
      getPath: (file: File) => string | null;
    };
  }
}

export {};
