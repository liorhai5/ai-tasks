export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  name       TEXT PRIMARY KEY,
  path       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project     TEXT NOT NULL REFERENCES projects(name),
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'todo',
  priority    TEXT DEFAULT 'medium',
  stage       TEXT,
  parent_id   INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  depends_on  TEXT,
  assignee    TEXT,
  created_by  TEXT NOT NULL DEFAULT 'user',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_updates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  field       TEXT,
  value       TEXT,
  actor       TEXT,
  session_id  TEXT,
  provider    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project, status);
CREATE INDEX IF NOT EXISTS idx_updates_task_id ON task_updates(task_id);
CREATE INDEX IF NOT EXISTS idx_updates_session ON task_updates(session_id);
`;
