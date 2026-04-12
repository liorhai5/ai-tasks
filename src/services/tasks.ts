import type Database from 'better-sqlite3';
import type { Task, TaskUpdate, TaskStatus, TaskPriority, TaskStage } from '../types.js';

const VALID_STATUSES: Set<string> = new Set(['todo', 'in_progress', 'blocked', 'review', 'done', 'cancelled']);
const VALID_PRIORITIES: Set<string> = new Set(['low', 'medium', 'high', 'critical']);
const VALID_STAGES: Set<string> = new Set(['research', 'design', 'review', 'implement', 'verify', 'record']);

function validateEnum(value: string, allowed: Set<string>, label: string): void {
  if (!allowed.has(value)) {
    throw new Error(`Invalid ${label}: "${value}". Allowed: ${[...allowed].join(', ')}`);
  }
}

export interface CreateTaskInput {
  title: string;
  project: string;
  description?: string;
  priority?: string;
  stage?: string;
  parent_id?: number;
  depends_on?: number[];
  created_by?: string;
}

export interface UpdateTaskInput {
  status?: string;
  stage?: string;
  priority?: string;
  assignee?: string | null;
  title?: string;
  description?: string;
  depends_on?: number[];
  note?: string;
  actor?: string;
  session_id?: string;
  provider?: string;
}

export interface ListTasksInput {
  project?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export class TaskService {
  constructor(private db: Database.Database) {}

  create(input: CreateTaskInput): Task {
    if (input.priority) validateEnum(input.priority, VALID_PRIORITIES, 'priority');
    if (input.stage) validateEnum(input.stage, VALID_STAGES, 'stage');

    const depsJson = input.depends_on ? JSON.stringify(input.depends_on) : null;

    // Validate project exists
    const project = this.db.prepare('SELECT name FROM projects WHERE name = ?').get(input.project);
    if (!project) throw new Error(`Project "${input.project}" not found. Register it first with "ai-tasks project add".`);

    // Warn on dangling depends_on
    const warnings: string[] = [];
    if (input.depends_on) {
      for (const depId of input.depends_on) {
        const exists = this.db.prepare('SELECT id FROM tasks WHERE id = ?').get(depId);
        if (!exists) warnings.push(`Dependency task #${depId} does not exist`);
      }
    }

    const result = this.db.prepare(`
      INSERT INTO tasks (project, title, description, priority, stage, parent_id, depends_on, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.project,
      input.title,
      input.description ?? null,
      input.priority ?? 'medium',
      input.stage ?? null,
      input.parent_id ?? null,
      depsJson,
      input.created_by ?? 'user'
    );

    const task = this.get(Number(result.lastInsertRowid))!;
    if (warnings.length > 0) {
      (task as Task & { warnings?: string[] }).warnings = warnings;
    }
    return task;
  }

  get(id: number): Task | undefined {
    return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
  }

  list(input: ListTasksInput = {}): { tasks: Task[]; total: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (input.project) {
      conditions.push('project = ?');
      params.push(input.project);
    }
    if (input.status) {
      const statuses = input.status.split(',');
      conditions.push(`status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = (this.db.prepare(`SELECT COUNT(*) as count FROM tasks ${where}`).get(...params) as { count: number }).count;

    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const tasks = this.db.prepare(`SELECT * FROM tasks ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as Task[];

    return { tasks, total };
  }

  load(id: number, full = false): { task: Task; updates: TaskUpdate[]; dependencyStatus?: { id: number; title: string; status: string }[]; parent?: Task } | undefined {
    const task = this.get(id);
    if (!task) return undefined;

    let updates: TaskUpdate[];
    if (full) {
      updates = this.db.prepare('SELECT * FROM task_updates WHERE task_id = ? ORDER BY created_at ASC').all(id) as TaskUpdate[];
    } else {
      updates = this.db.prepare('SELECT * FROM task_updates WHERE task_id = ? ORDER BY created_at DESC LIMIT 3').all(id) as TaskUpdate[];
      updates.reverse();
    }

    const result: { task: Task; updates: TaskUpdate[]; dependencyStatus?: { id: number; title: string; status: string }[]; parent?: Task } = { task, updates };

    if (full) {
      if (task.depends_on) {
        const depIds: number[] = JSON.parse(task.depends_on);
        result.dependencyStatus = depIds.map(depId => {
          const dep = this.get(depId);
          return dep
            ? { id: dep.id, title: dep.title, status: dep.status }
            : { id: depId, title: '(not found)', status: 'unknown' };
        });
      }

      if (task.parent_id) {
        result.parent = this.get(task.parent_id) ?? undefined;
      }
    }

    return result;
  }

  update(id: number, input: UpdateTaskInput): Task {
    if (input.status !== undefined) validateEnum(input.status, VALID_STATUSES, 'status');
    if (input.priority !== undefined) validateEnum(input.priority, VALID_PRIORITIES, 'priority');
    if (input.stage !== undefined) validateEnum(input.stage, VALID_STAGES, 'stage');

    const task = this.get(id);
    if (!task) throw new Error(`Task #${id} not found`);

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const sets: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    const fieldChanges: { field: string; value: string }[] = [];

    if (input.status !== undefined) {
      sets.push('status = ?'); params.push(input.status);
      fieldChanges.push({ field: 'status', value: input.status });
    }
    if (input.stage !== undefined) {
      sets.push('stage = ?'); params.push(input.stage);
      fieldChanges.push({ field: 'stage', value: input.stage });
    }
    if (input.priority !== undefined) {
      sets.push('priority = ?'); params.push(input.priority);
      fieldChanges.push({ field: 'priority', value: input.priority });
    }
    if (input.assignee !== undefined) {
      sets.push('assignee = ?'); params.push(input.assignee);
      fieldChanges.push({ field: 'assignee', value: input.assignee ?? 'null' });
    }
    if (input.title !== undefined) {
      sets.push('title = ?'); params.push(input.title);
      fieldChanges.push({ field: 'title', value: input.title });
    }
    if (input.description !== undefined) {
      sets.push('description = ?'); params.push(input.description);
      fieldChanges.push({ field: 'description', value: input.description });
    }
    if (input.depends_on !== undefined) {
      const depsJson = JSON.stringify(input.depends_on);
      sets.push('depends_on = ?'); params.push(depsJson);
      fieldChanges.push({ field: 'depends_on', value: depsJson });
    }

    params.push(id);

    // Atomic: update task + record audit log in one transaction
    const updateStmt = this.db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`);
    const insertUpdate = this.db.prepare(
      'INSERT INTO task_updates (task_id, field, value, actor, session_id, provider, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const applyAll = this.db.transaction(() => {
      updateStmt.run(...params);
      for (const change of fieldChanges) {
        insertUpdate.run(id, change.field, change.value, input.actor ?? null, input.session_id ?? null, input.provider ?? null, now);
      }
      if (input.note) {
        insertUpdate.run(id, null, input.note, input.actor ?? null, input.session_id ?? null, input.provider ?? null, now);
      }
    });
    applyAll();

    return this.get(id)!;
  }

  findDependents(taskId: number): Task[] {
    return this.db.prepare(
      `SELECT t.* FROM tasks t, json_each(t.depends_on) j WHERE j.value = ?`
    ).all(taskId) as Task[];
  }

  delete(id: number): void {
    const task = this.get(id);
    if (!task) throw new Error(`Task #${id} not found`);
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  }
}
