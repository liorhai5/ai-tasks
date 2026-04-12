import { describe, it, expect, beforeEach } from 'vitest';
import { createTempApp } from './test-helpers.js';
import { createToolHandlers } from '../src/mcp/tools.js';
import type { AppContext } from '../src/app.js';

describe('MCP tool handlers', () => {
  let app: AppContext;
  let handlers: ReturnType<typeof createToolHandlers>;

  beforeEach(() => {
    ({ app } = createTempApp());
    handlers = createToolHandlers(app);
    app.projectService.add('proj1');
  });

  describe('ai-tasks-list', () => {
    it('returns empty list when no tasks', () => {
      const result = handlers['ai-tasks-list']({});
      expect(result.tasks).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('lists tasks with status summary', () => {
      app.taskService.create({ title: 'task1', project: 'proj1' });
      const t2 = app.taskService.create({ title: 'task2', project: 'proj1' });
      app.taskService.update(t2.id, { status: 'in_progress' });

      const result = handlers['ai-tasks-list']({});
      expect(result.tasks).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.statusSummary).toEqual({ todo: 1, in_progress: 1 });
    });

    it('filters by project', () => {
      app.projectService.add('proj2');
      app.taskService.create({ title: 'task1', project: 'proj1' });
      app.taskService.create({ title: 'task2', project: 'proj2' });

      const result = handlers['ai-tasks-list']({ project: 'proj1' });
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].project).toBe('proj1');
    });

    it('returns compact task objects', () => {
      app.taskService.create({ title: 'task1', project: 'proj1', stage: 'design' });
      const result = handlers['ai-tasks-list']({});
      const task = result.tasks[0];
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('status');
      expect(task).not.toHaveProperty('description');
      expect(task).not.toHaveProperty('created_at');
    });
  });

  describe('ai-tasks-load', () => {
    it('loads a task with default updates', () => {
      const created = app.taskService.create({ title: 'test', project: 'proj1' });
      const result = handlers['ai-tasks-load']({ task_id: created.id });
      expect(result.task.id).toBe(created.id);
      expect(result.updates).toBeDefined();
    });

    it('throws on non-existent task', () => {
      expect(() => handlers['ai-tasks-load']({ task_id: 999 })).toThrow('not found');
    });

    it('returns full data with full=true', () => {
      const parent = app.taskService.create({ title: 'parent', project: 'proj1' });
      const dep = app.taskService.create({ title: 'dep', project: 'proj1' });
      const child = app.taskService.create({
        title: 'child', project: 'proj1',
        parent_id: parent.id, depends_on: [dep.id]
      });

      const result = handlers['ai-tasks-load']({ task_id: child.id, full: true });
      expect(result.parent?.id).toBe(parent.id);
      expect(result.dependencyStatus).toHaveLength(1);
      expect(result.dependencyStatus![0].id).toBe(dep.id);
    });
  });

  describe('ai-tasks-create', () => {
    it('creates a task and returns compact result', () => {
      const result = handlers['ai-tasks-create']({ title: 'New task', project: 'proj1' });
      expect(result.id).toBeGreaterThan(0);
      expect(result.title).toBe('New task');
      expect(result.status).toBe('todo');
    });

    it('sets created_by to mcp by default', () => {
      const result = handlers['ai-tasks-create']({ title: 'test', project: 'proj1' });
      const task = app.taskService.get(result.id)!;
      expect(task.created_by).toBe('mcp');
    });

    it('throws on non-existent project', () => {
      expect(() => handlers['ai-tasks-create']({ title: 'test', project: 'nope' })).toThrow('not found');
    });

    it('includes warnings for dangling deps', () => {
      const result = handlers['ai-tasks-create']({ title: 'test', project: 'proj1', depends_on: [999] });
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('Dependency task #999 does not exist');
    });
  });

  describe('ai-tasks-update', () => {
    it('updates status and returns summary', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      const result = handlers['ai-tasks-update']({ task_id: task.id, status: 'in_progress' });
      expect(result.status).toBe('in_progress');
    });

    it('records note with actor defaulting to mcp', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      handlers['ai-tasks-update']({ task_id: task.id, note: 'Progress update' });
      const loaded = app.taskService.load(task.id)!;
      const noteUpdate = loaded.updates.find(u => u.field === null);
      expect(noteUpdate?.value).toBe('Progress update');
      expect(noteUpdate?.actor).toBe('mcp');
    });

    it('throws on non-existent task', () => {
      expect(() => handlers['ai-tasks-update']({ task_id: 999, status: 'done' })).toThrow('not found');
    });

    it('records session_id and provider', () => {
      const task = app.taskService.create({ title: 'test', project: 'proj1' });
      handlers['ai-tasks-update']({
        task_id: task.id,
        status: 'in_progress',
        actor: 'claude-code',
        session_id: 'sess-123',
        provider: 'claude'
      });
      const loaded = app.taskService.load(task.id)!;
      const update = loaded.updates.find(u => u.field === 'status');
      expect(update?.actor).toBe('claude-code');
      expect(update?.session_id).toBe('sess-123');
      expect(update?.provider).toBe('claude');
    });
  });
});
