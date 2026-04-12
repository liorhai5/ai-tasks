import { describe, it, expect, beforeEach } from 'vitest';
import { createTempApp } from './test-helpers.js';
import type { AppContext } from '../src/app.js';

describe('TaskService', () => {
  let app: AppContext;

  beforeEach(() => {
    ({ app } = createTempApp());
    app.projectService.add('proj1');
    app.projectService.add('proj2');
  });

  describe('create', () => {
    it('creates a basic task', () => {
      const task = app.taskService.create({ title: 'My task', project: 'proj1' });
      expect(task.id).toBeGreaterThan(0);
      expect(task.title).toBe('My task');
      expect(task.project).toBe('proj1');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
    });

    it('creates a task with all optional fields', () => {
      const task = app.taskService.create({
        title: 'Full task',
        project: 'proj1',
        description: 'Details here',
        priority: 'high',
        stage: 'design',
        created_by: 'claude-code'
      });
      expect(task.description).toBe('Details here');
      expect(task.priority).toBe('high');
      expect(task.stage).toBe('design');
      expect(task.created_by).toBe('claude-code');
    });

    it('errors on non-existent project', () => {
      expect(() => app.taskService.create({ title: 'test', project: 'nope' })).toThrow('not found');
    });

    it('rejects invalid priority', () => {
      expect(() => app.taskService.create({ title: 'test', project: 'proj1', priority: 'urgent' })).toThrow('Invalid priority');
    });

    it('rejects invalid stage', () => {
      expect(() => app.taskService.create({ title: 'test', project: 'proj1', stage: 'coding' })).toThrow('Invalid stage');
    });

    it('warns on dangling depends_on but creates the task', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1', depends_on: [999] });
      expect(task.id).toBeGreaterThan(0);
      expect((task as any).warnings).toContain('Dependency task #999 does not exist');
    });

    it('stores depends_on as JSON', () => {
      const t1 = app.taskService.create({ title: 'dep1', project: 'proj1' });
      const t2 = app.taskService.create({ title: 'dep2', project: 'proj1' });
      const task = app.taskService.create({ title: 'main', project: 'proj1', depends_on: [t1.id, t2.id] });
      expect(JSON.parse(task.depends_on!)).toEqual([t1.id, t2.id]);
    });
  });

  describe('list', () => {
    it('lists all tasks', () => {
      app.taskService.create({ title: 'task1', project: 'proj1' });
      app.taskService.create({ title: 'task2', project: 'proj2' });
      const { tasks, total } = app.taskService.list();
      expect(total).toBe(2);
      expect(tasks).toHaveLength(2);
    });

    it('filters by project', () => {
      app.taskService.create({ title: 'task1', project: 'proj1' });
      app.taskService.create({ title: 'task2', project: 'proj2' });
      const { tasks } = app.taskService.list({ project: 'proj1' });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].project).toBe('proj1');
    });

    it('filters by single status', () => {
      const task = app.taskService.create({ title: 'task1', project: 'proj1' });
      app.taskService.update(task.id, { status: 'in_progress' });
      app.taskService.create({ title: 'task2', project: 'proj1' });
      const { tasks } = app.taskService.list({ status: 'todo' });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('task2');
    });

    it('filters by multiple statuses (comma-separated)', () => {
      const t1 = app.taskService.create({ title: 'task1', project: 'proj1' });
      app.taskService.update(t1.id, { status: 'in_progress' });
      app.taskService.create({ title: 'task2', project: 'proj1' });
      const t3 = app.taskService.create({ title: 'task3', project: 'proj1' });
      app.taskService.update(t3.id, { status: 'done' });

      const { tasks } = app.taskService.list({ status: 'todo,in_progress' });
      expect(tasks).toHaveLength(2);
    });

    it('respects limit and offset', () => {
      for (let i = 0; i < 5; i++) {
        app.taskService.create({ title: `task${i}`, project: 'proj1' });
      }
      const { tasks, total } = app.taskService.list({ limit: 2, offset: 1 });
      expect(total).toBe(5);
      expect(tasks).toHaveLength(2);
    });
  });

  describe('load', () => {
    it('returns undefined for non-existent task', () => {
      expect(app.taskService.load(999)).toBeUndefined();
    });

    it('loads task with last 3 updates by default', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      for (let i = 0; i < 5; i++) {
        app.taskService.update(task.id, { note: `note ${i}`, actor: 'user' });
      }
      const loaded = app.taskService.load(task.id)!;
      expect(loaded.task.id).toBe(task.id);
      expect(loaded.updates).toHaveLength(3);
    });

    it('loads all updates with full=true', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      for (let i = 0; i < 5; i++) {
        app.taskService.update(task.id, { note: `note ${i}`, actor: 'user' });
      }
      const loaded = app.taskService.load(task.id, true)!;
      expect(loaded.updates.length).toBeGreaterThanOrEqual(5);
    });

    it('includes dependency status with full=true', () => {
      const dep = app.taskService.create({ title: 'dep', project: 'proj1' });
      app.taskService.update(dep.id, { status: 'done' });
      const task = app.taskService.create({ title: 'main', project: 'proj1', depends_on: [dep.id] });
      const loaded = app.taskService.load(task.id, true)!;
      expect(loaded.dependencyStatus).toHaveLength(1);
      expect(loaded.dependencyStatus![0].status).toBe('done');
    });

    it('handles dangling dependency in full load', () => {
      const task = app.taskService.create({ title: 'main', project: 'proj1', depends_on: [999] });
      const loaded = app.taskService.load(task.id, true)!;
      expect(loaded.dependencyStatus![0].title).toBe('(not found)');
      expect(loaded.dependencyStatus![0].status).toBe('unknown');
    });

    it('includes parent with full=true', () => {
      const parent = app.taskService.create({ title: 'parent', project: 'proj1' });
      const child = app.taskService.create({ title: 'child', project: 'proj1', parent_id: parent.id });
      const loaded = app.taskService.load(child.id, true)!;
      expect(loaded.parent?.id).toBe(parent.id);
    });
  });

  describe('update', () => {
    it('updates status and records in task_updates', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      const updated = app.taskService.update(task.id, { status: 'in_progress', actor: 'claude-code', provider: 'claude' });
      expect(updated.status).toBe('in_progress');

      const loaded = app.taskService.load(task.id)!;
      expect(loaded.updates.some(u => u.field === 'status' && u.value === 'in_progress')).toBe(true);
    });

    it('records a note without field changes', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      app.taskService.update(task.id, { note: 'Progress note here', actor: 'user' });
      const loaded = app.taskService.load(task.id)!;
      expect(loaded.updates.some(u => u.field === null && u.value === 'Progress note here')).toBe(true);
    });

    it('updates multiple fields in one call', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      app.taskService.update(task.id, { status: 'in_progress', priority: 'high', assignee: 'claude-code' });
      const loaded = app.taskService.load(task.id)!;
      expect(loaded.task.status).toBe('in_progress');
      expect(loaded.task.priority).toBe('high');
      expect(loaded.task.assignee).toBe('claude-code');
      expect(loaded.updates.filter(u => u.field !== null)).toHaveLength(3);
    });

    it('allows updating done tasks (reopen)', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      app.taskService.update(task.id, { status: 'done' });
      const reopened = app.taskService.update(task.id, { status: 'todo' });
      expect(reopened.status).toBe('todo');
    });

    it('allows updating cancelled tasks', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      app.taskService.update(task.id, { status: 'cancelled' });
      const updated = app.taskService.update(task.id, { status: 'todo', note: 'Reopening' });
      expect(updated.status).toBe('todo');
    });

    it('throws on non-existent task', () => {
      expect(() => app.taskService.update(999, { status: 'done' })).toThrow('not found');
    });

    it('rejects invalid status', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      expect(() => app.taskService.update(task.id, { status: 'shipped' })).toThrow('Invalid status');
    });

    it('rejects invalid priority on update', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      expect(() => app.taskService.update(task.id, { priority: 'urgent' })).toThrow('Invalid priority');
    });

    it('updates updated_at timestamp', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      const originalUpdatedAt = task.updated_at;
      app.taskService.update(task.id, { note: 'bump' });
      const updated = app.taskService.get(task.id)!;
      expect(updated.updated_at).not.toBe(originalUpdatedAt);
    });
  });

  describe('findDependents', () => {
    it('finds tasks that depend on a given task', () => {
      const dep = app.taskService.create({ title: 'dep', project: 'proj1' });
      app.taskService.create({ title: 'dependent', project: 'proj1', depends_on: [dep.id] });
      app.taskService.create({ title: 'unrelated', project: 'proj1' });

      const dependents = app.taskService.findDependents(dep.id);
      expect(dependents).toHaveLength(1);
      expect(dependents[0].title).toBe('dependent');
    });
  });

  describe('delete', () => {
    it('deletes a task', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      app.taskService.delete(task.id);
      expect(app.taskService.get(task.id)).toBeUndefined();
    });

    it('throws on non-existent task', () => {
      expect(() => app.taskService.delete(999)).toThrow('not found');
    });
  });
});
