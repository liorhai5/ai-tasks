import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';

export function createTempApp() {
  const dir = mkdtempSync(join(tmpdir(), 'ai-tasks-'));
  const dbPath = join(dir, 'tasks.db');
  const app = createApp(dbPath);
  return { app, dbPath, dir };
}
