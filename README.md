# ai-tasks

Personal, machine-local task coordination service. Tracks tasks, progress, dependencies, and session links across repositories and IDE sessions.

Built for developers who work across multiple repos with AI coding assistants (Claude Code, Cursor, Codex). Tasks persist between sessions — no more reconstructing context from memory and git log.

## Install

```bash
npm install -g ai-tasks
```

Requires Node.js >= 22.

## Quick Start

```bash
# Register a project
ai-tasks project add my-project /path/to/repo

# Create a task
ai-tasks create "Fix timezone handling" --project my-project --priority high

# List tasks across all projects
ai-tasks list

# Update a task
ai-tasks update 1 --status in_progress --note "Started investigating"

# Load full task details
ai-tasks load 1 --full

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
npx add-mcp "ai-tasks mcp" -g -n ai-tasks -y
```

### MCP Tools

| Tool | Purpose |
|------|---------|
| `ai-tasks-list` | Query tasks with project/status filters, pagination |
| `ai-tasks-load` | Load a task with update history, dependency status, parent |
| `ai-tasks-create` | Create a task (validates project, warns on dangling deps) |
| `ai-tasks-update` | Update fields + optional progress note (atomic with audit log) |

## CLI Reference

### Project Commands

```
ai-tasks project add <name> [path]       # Register a project
ai-tasks project list                     # List all projects
ai-tasks project update <name> --path P   # Update project path
ai-tasks project remove <name>            # Remove project + all its tasks
```

### Task Commands

```
ai-tasks list [--project P] [--status S]  # List tasks (status is comma-separated)
ai-tasks load <id> [--full]               # Load task details
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

### Stage Values (methodology tracking)

`research` | `design` | `review` | `implement` | `verify` | `record`

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
