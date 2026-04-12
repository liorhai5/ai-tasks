import type Database from 'better-sqlite3';
import { createDb, getDbPath } from './db/connection.js';
import { ProjectService } from './services/projects.js';
import { TaskService } from './services/tasks.js';

export interface AppContext {
  db: Database.Database;
  dbPath: string;
  projectService: ProjectService;
  taskService: TaskService;
}

export function createApp(dbPath = getDbPath()): AppContext {
  const db = createDb(dbPath);
  const projectService = new ProjectService(db);
  const taskService = new TaskService(db);

  return { db, dbPath, projectService, taskService };
}
