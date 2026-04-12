export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'review' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStage = 'research' | 'design' | 'review' | 'implement' | 'verify' | 'record';

export interface Project {
  name: string;
  path: string | null;
  created_at: string;
}

export interface Task {
  id: number;
  project: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  stage: TaskStage | null;
  parent_id: number | null;
  depends_on: string | null;
  assignee: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TaskUpdate {
  id: number;
  task_id: number;
  field: string | null;
  value: string | null;
  actor: string | null;
  session_id: string | null;
  provider: string | null;
  created_at: string;
}
