# CLAUDE.md

## What This Project Is

A personal, machine-local task coordination service. Tracks tasks, progress, dependencies, and session links across repositories and IDE sessions. Exposed via CLI, MCP, and `/tsk` skill.

- **Storage:** Single SQLite at `~/.ai-tasks/tasks.db`
- **Stack:** TypeScript, Node.js >= 22, better-sqlite3, Commander, MCP SDK (stdio)
- **Pattern:** Follows ai-memory architecture — machine-level DB, project as a filter column

## Design Log

The design log is at `.ai/design-logs/001-ai-tasks-design.md`. Full design history and research context lives in `/Playgrounds/ai-research/.ai/design-logs/026-ai-tasks.md`.

Read the design log before making changes. Follow the methodology: research -> design -> review -> implement -> verify -> record.

## Project Structure (planned)

```
src/
  cli.ts              # CLI entry point (Commander)
  db/
    schema.ts          # SQLite schema (projects, tasks, task_updates)
    migrations.ts      # Schema versioning
  services/
    projects.ts        # Project CRUD
    tasks.ts           # Task CRUD + update log
  mcp/
    server.ts          # MCP server (stdio)
    tools.ts           # 4 MCP tools: list, load, create, update
  types.ts             # Shared types
```

## Commands

```
ai-tasks project add|list|update|remove    # project registry
ai-tasks list|load|create|update           # task operations
ai-tasks status                            # DB health
ai-tasks mcp                               # start MCP server
```
