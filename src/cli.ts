#!/usr/bin/env node
import { Command } from 'commander';
import { createApp } from './app.js';
import { resolveProject } from './utils/resolve-project.js';

const program = new Command();
const app = createApp();

program
  .name('ai-tasks')
  .description('Personal task coordination service')
  .version('0.1.0');

// --- Project commands ---

const project = program.command('project').description('Manage projects');

project
  .command('add <name> [path]')
  .description('Register a project')
  .action((name: string, path?: string) => {
    try {
      const p = app.projectService.add(name, path);
      if (program.opts().json) {
        console.log(JSON.stringify(p));
      } else {
        console.log(`Added project "${p.name}"${p.path ? ` (${p.path})` : ''}`);
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exitCode = 1;
    }
  });

project
  .command('list')
  .description('List all projects')
  .action(() => {
    const projects = app.projectService.list();
    if (program.opts().json) {
      console.log(JSON.stringify(projects));
      return;
    }
    if (projects.length === 0) {
      console.log('No projects registered.');
      return;
    }
    for (const p of projects) {
      const taskCount = app.projectService.taskCount(p.name);
      console.log(`${p.name.padEnd(20)} ${String(taskCount).padStart(3)} tasks  ${p.path ?? '(no path)'}`);
    }
  });

project
  .command('update <name>')
  .description('Update a project')
  .requiredOption('--path <path>', 'Set project path')
  .action((name: string, opts: { path: string }) => {
    try {
      const p = app.projectService.update(name, opts.path);
      if (program.opts().json) {
        console.log(JSON.stringify(p));
      } else {
        console.log(`Updated project "${p.name}" → ${p.path}`);
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exitCode = 1;
    }
  });

project
  .command('remove <name>')
  .description('Remove a project and all its tasks')
  .action((name: string) => {
    try {
      const taskCount = app.projectService.taskCount(name);
      if (taskCount > 0) {
        console.warn(`⚠ WARNING: Project "${name}" has ${taskCount} task(s). All will be deleted.`);
      }
      const result = app.projectService.remove(name);
      if (program.opts().json) {
        console.log(JSON.stringify({ removed: name, tasksDeleted: result.tasksDeleted }));
      } else {
        console.log(`Removed project "${name}"${result.tasksDeleted > 0 ? ` (${result.tasksDeleted} task(s) deleted)` : ''}`);
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exitCode = 1;
    }
  });

// --- Task commands ---

program
  .command('list')
  .description('List tasks')
  .option('--project <project>', 'Filter by project')
  .option('--status <status>', 'Filter by status (comma-separated)')
  .option('--limit <n>', 'Max results', '50')
  .option('--offset <n>', 'Skip results', '0')
  .action((opts) => {
    const projectName = opts.project ?? resolveProject(app);
    const { tasks, total } = app.taskService.list({
      project: projectName,
      status: opts.status,
      limit: parseInt(opts.limit),
      offset: parseInt(opts.offset)
    });

    if (program.opts().json) {
      console.log(JSON.stringify({ tasks, total }));
      return;
    }

    if (tasks.length === 0) {
      console.log('No tasks found.');
      return;
    }

    // Status summary
    const byStat: Record<string, number> = {};
    tasks.forEach(t => { byStat[t.status] = (byStat[t.status] || 0) + 1; });
    console.log(`${total} task(s): ${Object.entries(byStat).map(([s, n]) => `${n} ${s}`).join(', ')}\n`);

    for (const t of tasks) {
      const proj = t.project.padEnd(14);
      const id = `#${t.id}`.padStart(5);
      const status = `[${t.status}]`.padEnd(14);
      console.log(`${proj} ${id}  ${status} ${t.title}`);
    }
  });

program
  .command('load <id>')
  .description('Load a task with details')
  .option('--full', 'Include all updates, deps, parent')
  .action((id: string, opts) => {
    const loaded = app.taskService.load(parseInt(id), opts.full);
    if (!loaded) {
      console.error(`Task #${id} not found`);
      process.exitCode = 1;
      return;
    }

    if (program.opts().json) {
      console.log(JSON.stringify(loaded));
      return;
    }

    const { task: t, updates, dependencyStatus, parent } = loaded;
    console.log(`#${t.id}: ${t.title}`);
    console.log(`  Project:  ${t.project}`);
    console.log(`  Status:   ${t.status}`);
    console.log(`  Priority: ${t.priority}`);
    if (t.stage) console.log(`  Stage:    ${t.stage}`);
    if (t.assignee) console.log(`  Assignee: ${t.assignee}`);
    if (t.description) console.log(`  Desc:     ${t.description}`);
    if (parent) console.log(`  Parent:   #${parent.id} ${parent.title}`);
    if (dependencyStatus && dependencyStatus.length > 0) {
      console.log(`  Deps:     ${dependencyStatus.map(d => `#${d.id} [${d.status}] ${d.title}`).join(', ')}`);
    }
    if (updates.length > 0) {
      console.log(`  Updates:`);
      for (const u of updates) {
        const actor = u.actor ? ` (${u.actor}${u.provider ? `/${u.provider}` : ''})` : '';
        if (u.field) {
          console.log(`    [${u.created_at}] ${u.field} → ${u.value}${actor}`);
        } else {
          console.log(`    [${u.created_at}] note${actor}: ${u.value}`);
        }
      }
    }
  });

program
  .command('create <title>')
  .description('Create a task')
  .option('--project <project>', 'Project name')
  .option('--priority <priority>', 'low|medium|high|critical')
  .option('--stage <stage>', 'research|design|review|implement|verify|record')
  .option('--parent <id>', 'Parent task ID')
  .option('--depends-on <ids>', 'Comma-separated task IDs')
  .action((title: string, opts) => {
    const projectName = opts.project ?? resolveProject(app);
    if (!projectName) {
      console.error('Error: --project is required (or run from within a registered project path)');
      process.exitCode = 1;
      return;
    }
    try {
      const task = app.taskService.create({
        title,
        project: projectName,
        priority: opts.priority,
        stage: opts.stage,
        parent_id: opts.parent ? parseInt(opts.parent) : undefined,
        depends_on: opts.dependsOn ? opts.dependsOn.split(',').map(Number) : undefined
      });

      const warnings = (task as any).warnings as string[] | undefined;
      if (warnings) {
        for (const w of warnings) console.warn(`Warning: ${w}`);
      }

      if (program.opts().json) {
        console.log(JSON.stringify({ id: task.id, project: task.project, title: task.title, status: task.status }));
      } else {
        console.log(`Created #${task.id} in ${task.project}`);
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exitCode = 1;
    }
  });

program
  .command('update <id>')
  .description('Update a task')
  .option('--status <status>', 'todo|in_progress|blocked|review|done|cancelled')
  .option('--stage <stage>', 'research|design|review|implement|verify|record')
  .option('--priority <priority>', 'low|medium|high|critical')
  .option('--assignee <assignee>', 'Assignee')
  .option('--note <text>', 'Progress note')
  .action((id: string, opts) => {
    try {
      const task = app.taskService.update(parseInt(id), {
        status: opts.status,
        stage: opts.stage,
        priority: opts.priority,
        assignee: opts.assignee,
        note: opts.note,
        actor: 'user'
      });
      if (program.opts().json) {
        console.log(JSON.stringify(task));
      } else {
        console.log(`Updated #${task.id}: [${task.status}] ${task.title}`);
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exitCode = 1;
    }
  });

program
  .command('status')
  .description('Database health and statistics')
  .action(() => {
    const projects = app.projectService.list();
    const { tasks: allTasks, total } = app.taskService.list({ limit: 99999 });
    const byStatus: Record<string, number> = {};
    allTasks.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });

    if (program.opts().json) {
      console.log(JSON.stringify({ dbPath: app.dbPath, projects: projects.length, tasks: total, byStatus }));
      return;
    }

    console.log(`Database: ${app.dbPath}`);
    console.log(`Projects: ${projects.length}`);
    console.log(`Tasks:    ${total}`);
    if (total > 0) {
      console.log(`Status:   ${Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(', ')}`);
    }
  });

program
  .command('mcp')
  .description('Start MCP server (stdio transport)')
  .action(async () => {
    const { startStdioServer } = await import('./mcp/server.js');
    await startStdioServer();
  });

// --- Global options ---

program.option('--json', 'Output as JSON');

program.parse();
