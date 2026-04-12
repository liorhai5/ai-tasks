import { describe, it, expect, beforeEach } from 'vitest';
import { createTempApp } from './test-helpers.js';
import type { AppContext } from '../src/app.js';

describe('schema', () => {
  let app: AppContext;

  beforeEach(() => {
    ({ app } = createTempApp());
  });

  it('creates all three tables', () => {
    const tables = app.db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    ).all() as { name: string }[];
    const names = tables.map(t => t.name);
    expect(names).toContain('projects');
    expect(names).toContain('tasks');
    expect(names).toContain('task_updates');
  });

  it('creates all indexes', () => {
    const indexes = app.db.prepare(
      `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name`
    ).all() as { name: string }[];
    const names = indexes.map(i => i.name);
    expect(names).toContain('idx_tasks_project');
    expect(names).toContain('idx_tasks_status');
    expect(names).toContain('idx_tasks_project_status');
    expect(names).toContain('idx_updates_task_id');
    expect(names).toContain('idx_updates_session');
  });

  it('enforces foreign keys', () => {
    expect(() => {
      app.db.prepare('INSERT INTO tasks (project, title) VALUES (?, ?)').run('nonexistent', 'test');
    }).toThrow();
  });

  it('cascades task_updates on task delete', () => {
    app.db.prepare('INSERT INTO projects (name) VALUES (?)').run('test');
    app.db.prepare('INSERT INTO tasks (project, title) VALUES (?, ?)').run('test', 'task1');
    const taskId = (app.db.prepare('SELECT id FROM tasks').get() as { id: number }).id;
    app.db.prepare('INSERT INTO task_updates (task_id, field, value) VALUES (?, ?, ?)').run(taskId, 'status', 'in_progress');

    app.db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);

    const updates = app.db.prepare('SELECT * FROM task_updates WHERE task_id = ?').all(taskId);
    expect(updates).toHaveLength(0);
  });

  it('sets parent_id to null on parent task delete', () => {
    app.db.prepare('INSERT INTO projects (name) VALUES (?)').run('test');
    app.db.prepare('INSERT INTO tasks (project, title) VALUES (?, ?)').run('test', 'parent');
    const parentId = (app.db.prepare('SELECT id FROM tasks').get() as { id: number }).id;
    app.db.prepare('INSERT INTO tasks (project, title, parent_id) VALUES (?, ?, ?)').run('test', 'child', parentId);
    const childId = (app.db.prepare(`SELECT id FROM tasks WHERE title = 'child'`).get() as { id: number }).id;

    app.db.prepare('DELETE FROM tasks WHERE id = ?').run(parentId);

    const child = app.db.prepare('SELECT * FROM tasks WHERE id = ?').get(childId) as { parent_id: number | null };
    expect(child.parent_id).toBeNull();
  });
});
