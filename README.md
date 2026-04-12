# ai-tasks

Personal, machine-local task coordination service. Tracks tasks, progress, dependencies, and session links across repositories and IDE sessions.

Built for developers who work across multiple repos with AI coding assistants (Claude Code, Cursor, Codex). Tasks persist between sessions — no more reconstructing context from memory and git log.

## Install

```bash
npm install -g ai-tasks
```

Requires Node.js >= 22. The package builds from source on install (`prepack`), so a TypeScript-compatible environment is needed.

## Quick Start

```bash
# Register a project (name + optional path for auto-detection)
ai-tasks project add my-project /path/to/repo

# Create a task in that project
ai-tasks create "Fix timezone handling" --project my-project --priority high

# List tasks across all projects
ai-tasks list

# Update a task with status change + progress note
ai-tasks update 1 --status in_progress --note "Started investigating"

# Load task summary (fields + last 3 updates)
ai-tasks load 1

# Load full details (all updates, dependency status, parent task)
ai-tasks load 1 --full

# Machine-readable output (all commands support --json)
ai-tasks list --json

# Check database health
ai-tasks status
```

## MCP Server

Expose tasks to AI coding assistants via MCP (stdio transport):

```bash
ai-tasks mcp
```

Register with Claude Code:

```bash
claude mcp add ai-tasks -- ai-tasks mcp
```

### MCP Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `ai-tasks-list` | Query tasks with filters | `project?`, `status?`, `limit?`, `offset?` |
| `ai-tasks-load` | Load task with history | `task_id`, `full?` |
| `ai-tasks-create` | Create a task | `title`, `project`, `description?`, `priority?`, `stage?`, `parent_id?`, `depends_on?` |
| `ai-tasks-update` | Update fields + progress note | `task_id`, `status?`, `priority?`, `stage?`, `assignee?`, `note?`, `actor?`, `session_id?`, `provider?` |

MCP tools expose a superset of CLI fields. The `actor`, `session_id`, and `provider` fields are MCP-only — they track which tool, session, and LLM made a change, linking to ai-memory conversations via `session_id`.

## CLI Reference

### Project Commands

```
ai-tasks project add <name> [path]       # Register a project
ai-tasks project list                     # List all projects with task counts
ai-tasks project update <name> --path P   # Update project path
ai-tasks project remove <name>            # Remove project + all its tasks (with warning)
```

### Task Commands

```
ai-tasks list [--project P] [--status S]  # List tasks (status is comma-separated)
ai-tasks load <id> [--full]               # Load task details (--full: all updates + deps + parent)
ai-tasks create <title> [--project P] [--priority P] [--stage S] [--parent ID] [--depends-on "5,7"]
ai-tasks update <id> [--status S] [--stage S] [--priority P] [--assignee A] [--note TEXT]
ai-tasks status                           # Database health
ai-tasks mcp                              # Start MCP server
```

All commands support `--json` for machine-readable output. Project is auto-detected from cwd when inside a registered project path.

### Status Values

`todo` | `in_progress` | `blocked` | `review` | `done` | `cancelled`

### Priority Values

`low` | `medium` | `high` | `critical`

### Stage Values

`research` | `design` | `review` | `implement` | `verify` | `record`

Optional workflow tracking. Map tasks to methodology stages if you follow a structured design-before-implement workflow.

## Storage

Single SQLite database at `~/.ai-tasks/tasks.db`. Machine-level, not per-project. Projects are registered labels, not filesystem boundaries.

```
~/.ai-tasks/
  tasks.db    # Single source of truth
```

## Stack

- TypeScript (ES2022, NodeNext)
- Node.js >= 22
- better-sqlite3 (WAL mode, FK enforcement)
- Commander (CLI)
- @modelcontextprotocol/sdk (MCP, stdio transport)
- vitest (tests)

## Development

```bash
npm install
npm run build
npm test
```

## License

ISC
