# ai-tasks

Personal, machine-local task coordination service. See [README.md](README.md) for usage and [CONTRIBUTING.md](CONTRIBUTING.md) for project structure and conventions.

## Quick Reference

- **Storage:** `~/.ai-tasks/tasks.db` (SQLite, WAL mode)
- **Build:** `npm run build`
- **Test:** `npm test` (60 tests, vitest)
- **Stack:** TypeScript, Node.js >= 22, better-sqlite3, Commander, MCP SDK
