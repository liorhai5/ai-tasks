import type { AppContext } from '../app.js';

/**
 * Auto-detect project from cwd if inside a registered project path.
 * Returns project name or undefined.
 */
export function resolveProject(app: AppContext): string | undefined {
  const cwd = process.cwd();
  const projects = app.projectService.list();
  for (const p of projects) {
    if (p.path && cwd.startsWith(p.path)) {
      return p.name;
    }
  }
  return undefined;
}
