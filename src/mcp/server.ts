import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createApp } from '../app.js';
import { createToolHandlers } from './tools.js';

export async function startStdioServer(dbPath?: string) {
  const app = createApp(dbPath);
  const handlers = createToolHandlers(app);
  const server = new McpServer({ name: 'ai-tasks', version: '0.1.0' });

  server.tool(
    'ai-tasks-list',
    'List tasks with optional filters. Returns compact task list + status summary.',
    {
      project: z.string().optional().describe('Filter by project name'),
      status: z.string().optional().describe('Filter by status (comma-separated: todo,in_progress,blocked,review,done,cancelled)'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Pagination offset (default 0)')
    },
    async (input) => {
      try {
        const result = handlers['ai-tasks-list'](input);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: e.message }) }], isError: true };
      }
    }
  );

  server.tool(
    'ai-tasks-load',
    'Load a single task with details. Default: task fields + last 3 updates. With full=true: all updates + dependency status + parent task.',
    {
      task_id: z.number().describe('Task ID'),
      full: z.boolean().optional().describe('Include all updates, dependency status, and parent (default false)')
    },
    async (input) => {
      try {
        const result = handlers['ai-tasks-load'](input);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: e.message }) }], isError: true };
      }
    }
  );

  server.tool(
    'ai-tasks-create',
    'Create a new task. Project must be registered first.',
    {
      title: z.string().describe('Task title'),
      project: z.string().describe('Project name (must be registered)'),
      description: z.string().optional().describe('Longer context or acceptance criteria'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Priority (default medium)'),
      stage: z.enum(['research', 'design', 'review', 'implement', 'verify', 'record']).optional().describe('Methodology stage'),
      parent_id: z.number().optional().describe('Parent task ID for subtask hierarchy'),
      depends_on: z.array(z.number()).optional().describe('Task IDs this task depends on'),
      created_by: z.string().optional().describe('Creator identity (default: mcp)')
    },
    async (input) => {
      try {
        const result = handlers['ai-tasks-create'](input);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: e.message }) }], isError: true };
      }
    }
  );

  server.tool(
    'ai-tasks-update',
    'Update a task. Change any combination of fields in one call. Optional note records free-form progress alongside field changes.',
    {
      task_id: z.number().describe('Task ID to update'),
      status: z.enum(['todo', 'in_progress', 'blocked', 'review', 'done', 'cancelled']).optional().describe('New status'),
      stage: z.enum(['research', 'design', 'review', 'implement', 'verify', 'record']).optional().describe('New methodology stage'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('New priority'),
      assignee: z.string().optional().describe('Assignee (omit to leave unchanged)'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      depends_on: z.array(z.number()).optional().describe('New dependency list (replaces existing)'),
      note: z.string().optional().describe('Free-form progress note'),
      actor: z.string().optional().describe('Who is making this change (e.g. claude-code, cursor)'),
      session_id: z.string().optional().describe('IDE session ID (links to ai-memory conversation)'),
      provider: z.string().optional().describe('LLM provider (claude, codex, gpt, gemini)')
    },
    async (input) => {
      try {
        const result = handlers['ai-tasks-update'](input);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: e.message }) }], isError: true };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
