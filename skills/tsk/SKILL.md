---
name: tsk
description: Track tasks, progress, and dependencies across repos and sessions. Requires ai-tasks MCP server.
argument-hint: "list | load <id> | create <title> | update <id> | triage | decompose <id>"
disable-model-invocation: true
---

# tsk

Requires the ai-tasks MCP server. If tools are unavailable, run:
`npx add-mcp "ai-tasks mcp" -g -n ai-tasks -y`

## Commands

Based on $ARGUMENTS, read and follow the relevant command file:

| Command | File | Purpose |
|---|---|---|
| list | commands/list.md | List tasks across projects with status summary |
| load <id> | commands/load.md | Load a task with full details and history |
| create <title> | commands/create.md | Create a new task interactively |
| update <id> | commands/update.md | Update a task's status, fields, or add a note |
| triage | commands/triage.md | Review all active tasks and suggest next actions |
| decompose <id> | commands/decompose.md | Break a task into subtasks |

If no command matches, show this table and ask what the user needs.
