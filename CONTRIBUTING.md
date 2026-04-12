# Contributing

## Project Structure

```
src/
  app.ts                    # AppContext factory — central service instantiation
  cli.ts                    # CLI entry point (Commander)
  types.ts                  # Shared TypeScript types
  db/
    schema.ts               # SQLite schema (3 tables + indexes)
    connection.ts           # DB connection setup + PRAGMAs
    migrations.ts           # PRAGMA user_version migration runner
  services/
    projects.ts             # Project CRUD + app-level cascade delete
    tasks.ts                # Task CRUD + update log + dependency queries
  mcp/
    server.ts               # MCP stdio server (4 tools, zod validation)
    tools.ts                # MCP tool handler implementations
  utils/
    resolve-project.ts      # Auto-detect project from cwd

tests/
  test-helpers.ts           # createTempApp() — temp-dir SQLite for tests
  schema.test.ts            # Schema, indexes, FK enforcement, cascade behavior
  projects.test.ts          # Project CRUD + cascade delete
  tasks.test.ts             # Task CRUD, update log, dependencies, enum validation
  mcp-tools.test.ts         # MCP tool handlers — happy path + errors
```

## Architecture

Follows the same pattern as [ai-memory](https://github.com/liorhai5/ai-memory):

- **AppContext factory** (`app.ts`) — creates DB + all services, passed to CLI and MCP
- **Service layer** — business logic, validation, transactions
- **CLI and MCP** — parallel interfaces over the same services. MCP exposes a superset of CLI fields (`actor`, `session_id`, `provider`) for agent tracking. This asymmetry is intentional.
- **SQLite** — single file, machine-level, WAL mode, FK enforcement

## Schema

Three tables: `projects`, `tasks`, `task_updates`. See `src/db/schema.ts` for the full DDL.

Key design decisions:
- `depends_on` is a JSON text column queried via `json_each()` — avoids a junction table join for small dependency lists typical of personal use
- `task_updates` is an append-only audit log (field/value/actor/session)
- `updated_at` is application-managed (set in service layer on every update)
- Project deletion is app-level cascade (CLI-only, not exposed via MCP)
- Enum values (status, priority, stage) validated at the service layer

## Schema Versioning

Uses `PRAGMA user_version` with ordered migration functions in `src/db/migrations.ts`. To add a migration:

1. Add a function to the `migrations` array
2. The runner executes migrations above the current `user_version` and increments

## Building and Testing

```bash
npm install
npm run build      # TypeScript → dist/
npm test           # vitest — 60 tests, ~250ms
```

### Writing Tests

Tests use temp-dir SQLite databases via `createTempApp()`. Each test gets a fresh, isolated database:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTempApp } from './test-helpers.js';
import type { AppContext } from '../src/app.js';

describe('my feature', () => {
  let app: AppContext;

  beforeEach(() => {
    ({ app } = createTempApp());
    app.projectService.add('test-project');
  });

  it('does the thing', () => {
    const task = app.taskService.create({ title: 'test', project: 'test-project' });
    expect(task.status).toBe('todo');
  });
});
```

Test files go in `tests/` and must match the pattern `*.test.ts`. Run a single file with:

```bash
npx vitest run tests/tasks.test.ts
```

## Conventions

- ES modules (`"type": "module"`)
- TypeScript strict mode
- All SQL uses parameterized queries (no string interpolation)
- Service-layer validation for enums, existence checks
- Transactions for multi-statement mutations
- `--json` flag on all CLI commands
