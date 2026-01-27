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

export type QueueStatus = 'queued' | 'submitted' | 'completed' | 'failed';
export type ProcessingStage = 'Queued...' | 'Parsing...' | 'Extracting...' | 'Saving...';

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

export interface QueueStatusUpdate {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  data?: ParsedCV;
  error?: string;
  parseConfidence?: number;
}

// Global window type declarations for Electron IPC API
declare global {
  interface Window {
    api: {
      extractCV: (filePath: string, projectId?: string) => Promise<{ success: boolean; data?: ParsedCV; id?: string; totalTime?: number; error?: string }>;
      getAllCVs: (projectId?: string) => Promise<{ success: boolean; data?: { id: string; file_name: string; file_path?: string; contact_json: string; parse_confidence: number; created_at: string }[]; error?: string }>;
      selectCVFile: () => Promise<{ success: boolean; filePath?: string; fileName?: string; canceled?: boolean }>;
      getCV: (cvId: string) => Promise<{ success: boolean; data?: ParsedCV; error?: string }>;
      updateCVField: (cvId: string, fieldPath: string, value: unknown) => Promise<{ success: boolean; error?: string }>;
      deleteCV: (cvId: string) => Promise<{ success: boolean; error?: string }>;
      reprocessCV: (filePath: string, projectId?: string) => Promise<{ success: boolean; data?: ParsedCV; error?: string }>;

      // Queue operations
      enqueueCV: (fileName: string, filePath: string, projectId?: string) => Promise<{ success: boolean; id?: string; error?: string }>;
      getQueuedCVs: (projectId?: string) => Promise<{ success: boolean; data?: { id: string; file_name: string; file_path: string; status: string; error_message: string | null; created_at: string }[]; error?: string }>;
      onQueueStatusUpdate: (callback: (update: QueueStatusUpdate) => void) => void;
      removeQueueStatusListener: () => void;
    };
    electronFile: {
      getPath: (file: File) => string | null;
    };
  }
}

export {};
