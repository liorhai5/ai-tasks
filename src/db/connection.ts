import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { SCHEMA_SQL } from './schema.js';
import { runMigrations } from './migrations.js';

export function getDbPath(): string {
  return process.env.AI_TASKS_DB_PATH || join(homedir(), '.ai-tasks', 'tasks.db');
}

export function createDb(dbPath = getDbPath()): Database.Database {
  if (dbPath !== ':memory:') {
    const dir = dirname(dbPath);
    mkdirSync(dir, { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA_SQL);
  runMigrations(db);
  return db;
}
