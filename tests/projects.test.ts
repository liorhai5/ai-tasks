import { describe, it, expect, beforeEach } from 'vitest';
import { createTempApp } from './test-helpers.js';
import type { AppContext } from '../src/app.js';

describe('ProjectService', () => {
  let app: AppContext;

  beforeEach(() => {
    ({ app } = createTempApp());
  });

  it('adds a project with name only', () => {
    const project = app.projectService.add('ai-memory');
    expect(project.name).toBe('ai-memory');
    expect(project.path).toBeNull();
    expect(project.created_at).toBeTruthy();
  });

  it('adds a project with name and path', () => {
    const project = app.projectService.add('ai-memory', '/Users/test/ai-memory');
    expect(project.name).toBe('ai-memory');
    expect(project.path).toBe('/Users/test/ai-memory');
  });

  it('rejects duplicate project names', () => {
    app.projectService.add('ai-memory');
    expect(() => app.projectService.add('ai-memory')).toThrow();
  });

  it('lists all projects sorted by name', () => {
    app.projectService.add('zebra');
    app.projectService.add('alpha');
    app.projectService.add('middle');
    const projects = app.projectService.list();
    expect(projects.map(p => p.name)).toEqual(['alpha', 'middle', 'zebra']);
  });

  it('updates a project path', () => {
    app.projectService.add('ai-memory');
    const updated = app.projectService.update('ai-memory', '/new/path');
    expect(updated.path).toBe('/new/path');
  });

  it('throws on update of non-existent project', () => {
    expect(() => app.projectService.update('nope', '/path')).toThrow('not found');
  });

  it('removes a project with no tasks', () => {
    app.projectService.add('ai-memory');
    const result = app.projectService.remove('ai-memory');
    expect(result.tasksDeleted).toBe(0);
    expect(app.projectService.list()).toHaveLength(0);
  });

  it('removes a project and cascades its tasks and updates', () => {
    app.projectService.add('ai-memory');
    const task = app.taskService.create({ title: 'test task', project: 'ai-memory' });
    app.taskService.update(task.id, { status: 'in_progress', actor: 'user' });

    const result = app.projectService.remove('ai-memory');
    expect(result.tasksDeleted).toBe(1);
    expect(app.taskService.get(task.id)).toBeUndefined();
  });

  it('throws on remove of non-existent project', () => {
    expect(() => app.projectService.remove('nope')).toThrow('not found');
  });

  it('counts tasks for a project', () => {
    app.projectService.add('ai-memory');
    app.taskService.create({ title: 'task1', project: 'ai-memory' });
    app.taskService.create({ title: 'task2', project: 'ai-memory' });
    expect(app.projectService.taskCount('ai-memory')).toBe(2);
  });
});
