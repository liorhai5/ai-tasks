import type Database from 'better-sqlite3';
import type { Project } from '../types.js';

export class ProjectService {
  constructor(private db: Database.Database) {}

  add(name: string, path?: string): Project {
    this.db.prepare('INSERT INTO projects (name, path) VALUES (?, ?)').run(name, path ?? null);
    return this.get(name)!;
  }

  get(name: string): Project | undefined {
    return this.db.prepare('SELECT * FROM projects WHERE name = ?').get(name) as Project | undefined;
  }

  list(): Project[] {
    return this.db.prepare('SELECT * FROM projects ORDER BY name').all() as Project[];
  }

  update(name: string, path: string): Project {
    const existing = this.get(name);
    if (!existing) throw new Error(`Project "${name}" not found`);
    this.db.prepare('UPDATE projects SET path = ? WHERE name = ?').run(path, name);
    return this.get(name)!;
  }

  remove(name: string): { tasksDeleted: number } {
    const existing = this.get(name);
    if (!existing) throw new Error(`Project "${name}" not found`);
    const taskCount = (this.db.prepare('SELECT COUNT(*) as count FROM tasks WHERE project = ?').get(name) as { count: number }).count;
    const deleteAll = this.db.transaction(() => {
      this.db.prepare('DELETE FROM task_updates WHERE task_id IN (SELECT id FROM tasks WHERE project = ?)').run(name);
      this.db.prepare('DELETE FROM tasks WHERE project = ?').run(name);
      this.db.prepare('DELETE FROM projects WHERE name = ?').run(name);
    });
    deleteAll();
    return { tasksDeleted: taskCount };
  }

  taskCount(name: string): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM tasks WHERE project = ?').get(name) as { count: number };
    return row.count;
  }
}
