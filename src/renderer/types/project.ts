export interface Project {
  id: string;
  name: string;
  client_name: string | null;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  cv_count: number;
  jd_count: number;
}

export interface CreateProjectInput {
  name: string;
  client_name?: string;
  description?: string;
}
