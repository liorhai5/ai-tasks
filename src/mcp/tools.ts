import type { AppContext } from '../app.js';

export function createToolHandlers(app: AppContext) {
  return {
    'ai-tasks-list': (input: { project?: string; status?: string; limit?: number; offset?: number }) => {
      const { tasks, total } = app.taskService.list({
        project: input.project,
        status: input.status,
        limit: input.limit ?? 50,
        offset: input.offset ?? 0
      });

      const statusSummary: Record<string, number> = {};
      tasks.forEach(t => { statusSummary[t.status] = (statusSummary[t.status] || 0) + 1; });

      return {
        tasks: tasks.map(t => ({
          id: t.id,
          project: t.project,
          title: t.title,
          status: t.status,
          priority: t.priority,
          stage: t.stage,
          assignee: t.assignee
        })),
        total,
        statusSummary
      };
    },

    'ai-tasks-load': (input: { task_id: number; full?: boolean }) => {
      const loaded = app.taskService.load(input.task_id, input.full ?? false);
      if (!loaded) throw new Error(`Task #${input.task_id} not found`);
      return loaded;
    },

    'ai-tasks-create': (input: {
      title: string;
      project: string;
      description?: string;
      priority?: string;
      stage?: string;
      parent_id?: number;
      depends_on?: number[];
      created_by?: string;
    }) => {
      const task = app.taskService.create({
        title: input.title,
        project: input.project,
        description: input.description,
        priority: input.priority,
        stage: input.stage,
        parent_id: input.parent_id,
        depends_on: input.depends_on,
        created_by: input.created_by ?? 'mcp'
      });
      const warnings = (task as any).warnings as string[] | undefined;
      return {
        id: task.id,
        project: task.project,
        title: task.title,
        status: task.status,
        ...(warnings ? { warnings } : {})
      };
    },

    'ai-tasks-update': (input: {
      task_id: number;
      status?: string;
      stage?: string;
      priority?: string;
      assignee?: string;
      title?: string;
      description?: string;
      depends_on?: number[];
      note?: string;
      actor?: string;
      session_id?: string;
      provider?: string;
    }) => {
      const { task_id, ...rest } = input;
      const task = app.taskService.update(task_id, {
        ...rest,
        actor: rest.actor ?? 'mcp'
      });
      return {
        id: task.id,
        project: task.project,
        title: task.title,
        status: task.status,
        priority: task.priority,
        stage: task.stage,
        assignee: task.assignee
      };
    }
  };
}
