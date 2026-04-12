# ai-tasks — Personal Task Coordination Service

[Status: implemented]
[Created: 2026-04-12]
[Origin: ai-research design log 026-ai-tasks.md]

## Design Context

This design was developed through multiple sessions in the `ai-research` repo. The full design history, research, and decision rationale lives there:

- **Full design log:** `/Playgrounds/ai-research/.ai/design-logs/026-ai-tasks.md` — all questions, options considered, decisions, and revision history (v0.1–v0.3)
- **Prior design (025):** `/Playgrounds/ai-research/.ai/design-logs/025-omx-inspired-blocks-and-runtime.md` — the original ai-tasks design within the OMX-inspired ecosystem design. 026 supersedes the ai-tasks sections.
- **Landscape research (30+ systems):** `/Playgrounds/ai-research/research/resources/ai-tasks-landscape-research.md` — full survey of MCP task servers, coding agent internals, fleet orchestrators, PM integrations
- **Tool-by-tool deep dive (14 systems):** `/Playgrounds/ai-research/research/resources/agent-task-coordination-landscape.md`

Key external systems that informed this design: Task Orchestrator (jpicklyk), Scopecraft Command, Backlog.md, Beads (Steve Yegge), Overseer, Claude Code Agent Teams, ai-memory.

---

## 1. Problem Statement

I work across 8-12 repositories daily. I use Claude Code, Cursor, and occasionally Codex. I decompose work into tasks mentally, in scattered notes, or in Claude Code's session-scoped TodoWrite. None of this persists. When I resume work the next day, I reconstruct context from memory, git log, and conversation history.

The concrete problems:

1. **Tasks vanish between sessions.** Claude Code's TodoWrite and Agent Teams task lists are session-scoped. When the session ends, the task state is gone.
2. **No cross-repo task view.** I work on ai-memory, ai-research, design-log-guard, ai-skills, ai-gh-pipeline, and others. There is no single place to see "what am I working on across all my projects?"
3. **Agent sessions are disconnected.** When an agent claims a task, starts work, and the session times out, the next session has no record of what was in progress, what was tried, or what blocked.
4. **No structured handoff.** When I switch from Claude Code to Cursor mid-task, or when I hand a task to a background agent, the handoff is verbal/conversational. There is no structured record of "this task is in progress, here's what's been done, here's what's left."
5. **Design-log methodology has no operational arm.** The methodology says "design before implement, approval gates, verify, record." But there is no tool that tracks which stage a task is in, what artifacts are linked, or whether gates were passed.

### What this is NOT

- Not a PM tool. Not Linear, not Jira. Those are team-facing, cloud-hosted, and feature-heavy.
- Not a runtime/orchestrator. Not a process supervisor, worker spawner, or dispatch system.
- Not a replacement for Claude Code Agent Teams. Agent Teams handles in-session coordination. This handles cross-session persistence.
- Not a project management methodology. The methodology lives in ai-compass. This is the data layer that methodology operates on.

### What this IS

A personal, machine-local task coordination service that:

- Lets me and my agents track work across repos and sessions
- Persists task state, progress, dependencies, and session links
- Exposes the same operations to me (CLI) and to agents (MCP + skills)
- Is always running, always available, zero-setup per project
- Follows the ai-memory pattern: one machine, one database, project as a filter

---

## 2. Usage Scenarios

Every design decision below must justify itself against at least one of these scenarios. If a feature doesn't serve a concrete scenario, it doesn't belong in v1.

### S1: Morning Standup With Myself

I open a terminal. I want to see:

```
$ ai-tasks list --status todo,in_progress,blocked,review
ai-memory     #12  [in_progress]  Add project move detection to workspace resolver
ai-memory     #14  [blocked]      Dashboard conversation search filter
ai-research   #3   [review]       ai-tasks landscape research
design-guard  #7   [in_progress]  GitHub Actions agent workflow MVP
ai-skills     #1   [todo]         Extract methodology skill from ai-compass
```

I see what's active across all my repos, decide what to work on today, and pick up where I left off.

### S2: Agent Picks Up Where I Left Off

Yesterday I was working on task #12 in ai-memory. Claude Code timed out mid-session. Today I open a new session:

```
Agent calls MCP: ai-tasks-load(12, full=true)
-> #12: "Add project move detection to workspace resolver"
   Status: in_progress
   Updates:
     [2026-04-09 14:30] note (claude-code/claude): "Implemented resolveProjectRoot(), still need test fixtures for moved directories"
     [2026-04-09 14:15] status -> in_progress (claude-code/claude)
   Dependencies: none
   Parent: none
```

The agent has full context to continue -- what was done, what blocked, what was tried.

### S3: I Decompose a Feature Into Tasks

I'm in an IDE with Claude Code. I use the triage skill:

```
/tsk decompose 12
```

The agent reads the task description, understands the project context, and proposes subtasks. After my approval, it creates them with parent_id and depends_on relationships.

### S4: Multi-Agent Parallel Work

I have Claude Code Agent Teams running 3 teammates. Each claims a task via MCP (`ai-tasks-update` with assignee), records progress, and marks complete. The task state survives the session. Tomorrow I see which tasks completed and which need follow-up.

### S5: Design-Log Workflow Tracking

I start a design task. The methodology says: research -> design -> review -> implement -> verify -> record. The task tracks which stage it's in:

```
$ ai-tasks load 3
#3: ai-tasks landscape research
  Project: ai-research
  Stage: design (of: research -> design -> review -> implement -> verify -> record)
  Status: in_progress
```

When I move to "implement" without an approval note, the system can warn (not block -- advisory, not enforcement in v1).

### S6: Quick Capture From Any Context

I'm in the middle of debugging and notice something unrelated that needs fixing:

```
$ ai-tasks create "Fix timezone handling in transcript import" --project ai-memory --priority high
Created #15 in ai-memory
```

Or the agent does it during a session:

```
Agent calls MCP: ai-tasks-create { title: "Refactor test fixtures", project: "ai-memory" }
```

Quick capture, no context switch. Deal with it later.

### S7: End-of-Day Review

```
$ ai-tasks list --status todo,in_progress,blocked,review
```

Shows status summary (counts by status) plus all non-terminal tasks across projects.

### S8: Handoff Between Tools

I start a task in Claude Code, realize I need Cursor's multi-file editing for this one. The task record in ai-tasks is tool-agnostic. Cursor's agent reads the same task via MCP, sees the progress notes from Claude Code, and continues.

---

## 3. Design

### Scope: Machine-Level

Single SQLite database at `~/.ai-tasks/tasks.db`. Machine-level, not per-project. Projects are registered labels, not filesystem boundaries.

Tasks are personal operational state. They belong to the developer, not to the project. Like ai-memory, they live on the machine.

See 026 Q1 for full options analysis and rationale for reversing the prior project-local decision.

### Project Identity: Explicit Registration

```
$ ai-tasks project add ai-memory /Users/liorha/Projects/Wix/Playgrounds/ai-memory
$ ai-tasks project add ai-research    # path can be added later
$ ai-tasks project list
$ ai-tasks project remove ai-research
```

Path is optional -- can be added or changed later. When running CLI from within a registered path, project is auto-detected. MCP tools always take `project` as a parameter.

### Storage Layout

```
~/.ai-tasks/
  tasks.db          # SQLite -- single source of truth
  config.json       # optional user preferences
```

No per-project files. No init needed.

### Schema

Three tables:

#### `projects`

```sql
CREATE TABLE projects (
  name       TEXT PRIMARY KEY,              -- "ai-memory", "ai-research"
  path       TEXT,                          -- optional absolute path
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### `tasks`

```sql
CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project     TEXT NOT NULL REFERENCES projects(name),
  title       TEXT NOT NULL,
  description TEXT,                          -- longer context, acceptance criteria
  status      TEXT NOT NULL DEFAULT 'todo',  -- todo|in_progress|blocked|review|done|cancelled
  priority    TEXT DEFAULT 'medium',         -- low|medium|high|critical
  stage       TEXT,                          -- research|design|review|implement|verify|record
  parent_id   INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  depends_on  TEXT,                          -- JSON array: "[5, 7]", queried via json_each()
  assignee    TEXT,                          -- "user"|"claude-code"|"cursor"|null (idle)
  created_by  TEXT NOT NULL DEFAULT 'user',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### `task_updates`

```sql
CREATE TABLE task_updates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  field       TEXT,           -- "status"|"stage"|"assignee"|"priority"|null for notes
  value       TEXT,           -- new value (field changes) or note content (notes)
  actor       TEXT,           -- "user"|"claude-code"|"cursor" -- which tool/IDE
  session_id  TEXT,           -- IDE session identifier -> links to ai-memory conversation
  provider    TEXT,           -- "claude"|"codex"|"gpt"|"gemini" -- which LLM
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Indexes

```sql
CREATE INDEX idx_tasks_project ON tasks(project);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_project_status ON tasks(project, status);
CREATE INDEX idx_updates_task_id ON task_updates(task_id);
CREATE INDEX idx_updates_session ON task_updates(session_id);
```

#### Connection PRAGMAs

Set per connection: `foreign_keys = ON`, `journal_mode = WAL`, `busy_timeout = 5000`. Same pattern as ai-memory.

#### Schema versioning

`PRAGMA user_version` with ordered migration functions in `src/db/migrations.ts`. On connection open: read version, run migrations above it, set new version.

#### Design notes

- **`field` + `value` pattern:** Every update is "field X changed to value Y by actor Z in session S." A note is `field=null, value="the note text"`. A status change is `field="status", value="in_progress"`. Multiple changes from one operation share `session_id` and `created_at`.
- **`session_id` + `actor` + `provider`:** Loose link to ai-memory conversations. Search ai-memory by the same session_id. No formal FK.
- **Dependencies as JSON array:** `"[5, 7]"` means blocked until tasks 5 and 7 are done. Reverse lookup via `json_each()`: `SELECT t.* FROM tasks t, json_each(t.depends_on) j WHERE j.value = ?`. Dangling dep IDs warn but are allowed (reduces friction).
- **`assignee`:** If null, task is idle. If set, someone's on it. Simpler than a claim/release protocol.
- **`stage` values match methodology:** `research|design|review|implement|verify|record` -- same naming as `/mtg` commands for personal consistency.
- **`updated_at`:** Maintained by application code on every update. Not a trigger.
- **Deletion strategy:** `parent_id` → SET NULL (children promote to top-level). `task_updates` → CASCADE (history deleted with task). Project deletion is application-level: CLI-only with hard warning, cascades tasks + updates in a transaction. MCP does not expose project deletion.
- **Error handling:** Non-existent project → error. Dangling `depends_on` → warn. Updating terminal tasks → allowed freely. Validate at boundaries, fail on clearly wrong input.

### Lifecycle

```
todo -> in_progress -> review -> done
                   \-> blocked -> in_progress (unblocked)
any -> cancelled
done -> todo (reopen)
```

Advisory in v1. No server-enforced gates. Skills advise agents on correct flow. Enforcement can be added later by an ai-runtime layer.

### API Surface

#### MCP Tools (4 tools)

| Tool | Purpose | Parameters | Returns |
|------|---------|------------|---------|
| `ai-tasks-list` | Query tasks with filters | project?, status?, limit, offset | Compact task list + status summary |
| `ai-tasks-load` | Get a single task | task_id, full? (default false) | Default: fields + last 3 updates. `full=true`: all updates + dep status + parent |
| `ai-tasks-create` | Create a task | title, project, description?, priority?, stage?, parent_id?, depends_on? | `{ id, project, title, status }` |
| `ai-tasks-update` | Change fields + optional note | task_id, status?, stage?, priority?, assignee?, title?, description?, depends_on?, note? | Updated task summary |

`ai-tasks-load` with `full=true` is the deep load for session start (~300-800 tokens). Without `full`, it's a quick glance (~100-200 tokens).

`ai-tasks-update` is the single mutation tool. Changes any combination of fields in one call. Optional `note` records free-form progress alongside field changes.

#### CLI

```
ai-tasks project add NAME [PATH]
ai-tasks project list
ai-tasks project update NAME --path PATH
ai-tasks project remove NAME

ai-tasks list [--project P] [--status S]
ai-tasks load ID [--full]
ai-tasks create TITLE [--project P] [--priority P] [--stage S] [--parent ID] [--depends-on "5,7"]
ai-tasks update ID [--status S] [--stage S] [--priority P] [--assignee A] [--note TEXT]
ai-tasks status
ai-tasks mcp
ai-tasks dashboard [--port PORT]           # fast-follow
```

All commands support `--json`. Project auto-detected from cwd when inside a registered path.

#### Skill (`/tsk`)

On-demand command, not always-on injection.

```
/tsk list [--project P] [--status S]     -> ai-tasks-list
/tsk load ID [--full]                     -> ai-tasks-load
/tsk create TITLE                         -> ai-tasks-create (LLM asks for details)
/tsk update ID                            -> ai-tasks-update (LLM interprets intent)
/tsk triage                               -> LLM-powered: reviews list, suggests actions
/tsk decompose ID                         -> LLM-powered: proposes subtasks, creates after approval
```

`triage` and `decompose` are LLM-specific -- they require reasoning that CLI/MCP can't provide.

#### Who uses what

| Actor | Operations | Interface |
|-------|-----------|-----------|
| **Human in IDE** | create, triage, update, decompose, list, load | `/tsk` skill |
| **Human in terminal** | create, list, update, load | CLI |
| **Human in dashboard** | list, load | Web UI (fast-follow) |
| **Execution agent** | load --full (session start), update (progress/status) | MCP tools directly |
| **Future ai-runtime** | list, create, update (assign + session tracking) | MCP or CLI |

### Packaging

| Aspect | Choice |
|--------|--------|
| **Language** | TypeScript (ES2022, NodeNext) |
| **Runtime** | Node.js >= 22 |
| **Database** | better-sqlite3 |
| **CLI framework** | Commander |
| **MCP SDK** | @modelcontextprotocol/sdk (stdio) |
| **Install** | `npm install -g ai-tasks` |
| **MCP registration** | `npx add-mcp "ai-tasks mcp" -g -n ai-tasks -y` |
| **Dashboard** | React + Vite (fast-follow) |

Same stack as ai-memory. Clone ai-memory's project structure, replace the domain model.

### What This Does NOT Do

- Team collaboration -- personal tool, DB is private
- Cloud sync -- machine-local, no auth
- Runtime/orchestration -- does not spawn agents or supervise processes
- PM tool replacement -- does not replace Linear/Jira
- Automatic task creation -- tasks are intentional
- Workflow enforcement -- advisory only in v1
- ai-memory coupling -- loose link via session_id only
- Always-on context injection -- skills are on-demand

---

## 4. Review Q&A

Questions surfaced during design review (2026-04-12).

### Q1: How are dependencies queried? [decided]

`depends_on` stores a JSON array (`"[5, 7]"`). Reverse lookups use SQLite `json_each()`:
```sql
SELECT t.* FROM tasks t, json_each(t.depends_on) j WHERE j.value = ?
```
No junction table — data volumes are small (personal use), and this query is infrequent (triage, not hot path). App code may also parse directly when convenient.

### Q2: What is the FK and deletion strategy? [decided]

Follow ai-memory pattern: `PRAGMA foreign_keys = ON`, `journal_mode = WAL`, `busy_timeout = 5000` per connection.

Deletion behavior:
- `tasks.project → projects.name`: **No DB-level ON DELETE** (FK enforced normally). Deletion handled at application level: CLI prompts with hard warning showing task count, then cascades in a transaction. MCP tools do not expose project deletion. See Q5.
- `tasks.parent_id → tasks.id`: **SET NULL** — deleting a parent promotes children to top-level.
- `task_updates.task_id → tasks.id`: **CASCADE** — update history is metadata; clean up with the task.

### Q3: How is `updated_at` maintained? [decided]

Application code sets `updated_at = datetime('now')` on every update. Same pattern as ai-memory. The task service layer is the single mutation path, so there's one place to set it. Explicit and testable.

### Q4: What does `--active` mean? [decided]

Dropped. The `--status` filter on `list` already supports filtering by any status. `--active` is a UX convenience that can be added later if multi-status filtering proves tedious in practice. No design decision needed — doesn't affect schema or service layer.

### Q5: What is the error handling philosophy? [decided]

- **Create task for non-existent project:** Error. Projects are intentional (explicit registration).
- **`depends_on` references non-existent task ID:** Warn but allow. Store the dependency. Reduces friction — the referenced task may be created shortly after.
- **Update a `done`/`cancelled` task:** Allow freely. Reopening is a valid workflow.
- **Delete project that has tasks:** Allow with hard warning. CLI-only — MCP tools do not expose project deletion. CLI prompts for confirmation showing task count. This overrides the RESTRICT FK from Q2: use application-level cascade (delete tasks + updates in a transaction) rather than DB-level RESTRICT.

General philosophy: validate at boundaries, fail on clearly wrong input (bad project), warn on ambiguous input (dangling dep), allow valid workflows without gates.

### Q6: What is the migration/versioning strategy? [decided]

Use `PRAGMA user_version`. On connection open: read current version, run any migration functions above it in order, set new version. All migrations live in `src/db/migrations.ts` as ordered functions. Cleaner than ai-memory's ad-hoc column checks for a greenfield project.

### Q7: What is the minimum test plan? [decided]

v1 test coverage using vitest + temp-dir SQLite (same as ai-memory's `createTempApp()`):

| Area | Scope |
|---|---|
| Schema | DB creation, tables exist, indexes exist, FK enforcement |
| Project CRUD | add, list, remove (including cascade path) |
| Task CRUD | create, list (with status filter), load (default + full), update (field changes + notes) |
| Update log | Updates appended, load --full returns them in order |
| Dependencies | `json_each()` reverse lookup, warn on dangling dep |
| MCP tools | All 4 tools: list, load, create, update — happy path + error cases |

Not in v1: CLI output formatting, `/tsk` skill tests (LLM-dependent), dashboard.

---

## 5. Verification

Design is successful if:

1. S1 works -- I can see active tasks across all my projects from any terminal
2. S2 works -- an agent can load a task from a prior session with full context via `ai-tasks-load --full`
3. S3 works -- I can decompose work and track dependencies
4. S6 works -- quick capture takes < 5 seconds from CLI or agent
5. The tool feels like a natural extension of ai-memory, not a separate system to learn
6. The `/tsk` skill makes task management natural in IDE sessions
7. The solution is simple enough to build in a focused sprint

---

## 6. Implementation Plan

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Scaffold repo | done | Build system, tsconfig, vitest, package.json |
| 2 | Schema + connection + migrations | done | 3 tables, indexes, PRAGMAs, user_version |
| 3 | Project service + tests | done | CRUD + app-level cascade delete. 10 tests. |
| 4 | Task service + tests | done | CRUD, update log, json_each() deps, error handling. 26 tests. |
| 5 | CLI: project commands | done | add, list, update, remove + auto-detect from cwd |
| 6 | CLI: task commands + status | done | list, load, create, update, status. --json on all. |
| 7 | MCP server + tests | done | 4 tools: list, load, create, update. 15 tests. |
| 8 | MCP stdio entry point | done | stdio transport via `ai-tasks mcp` command |
| 9 | `/tsk` skill | deferred | Fast-follow |
| 10 | Dashboard | deferred | Fast-follow |

---

## 7. Implementation Results

### Files created

```
src/
  app.ts                    # AppContext factory
  cli.ts                    # CLI entry point (Commander)
  types.ts                  # Shared TypeScript types
  db/
    schema.ts               # SQLite schema (3 tables + indexes)
    connection.ts           # DB connection + PRAGMAs
    migrations.ts           # user_version migration runner
  services/
    projects.ts             # Project CRUD + app-level cascade delete
    tasks.ts                # Task CRUD + update log + dependency queries
  mcp/
    server.ts               # MCP stdio server (4 tools)
    tools.ts                # MCP tool handler implementations
  utils/
    resolve-project.ts      # Auto-detect project from cwd

tests/
  test-helpers.ts           # createTempApp() — temp-dir SQLite
  schema.test.ts            # 5 tests: tables, indexes, FK, cascade, SET NULL
  projects.test.ts          # 10 tests: add, list, update, remove, cascade
  tasks.test.ts             # 26 tests: create, list, load, update, delete, deps
  mcp-tools.test.ts         # 15 tests: all 4 MCP tools, happy path + errors

package.json, tsconfig.json, vitest.config.ts, .gitignore
```

### Test results

56 tests, 4 test files, all passing. 253ms total.

### Deviations from plan

- Steps 3-4 (project + task services) were implemented alongside step 2 (schema) since the service layer is thin and natural to write with the schema.
- Steps 5-6 (CLI project + task commands) were implemented in a single file since Commander groups them naturally.
- `--active` dropped from CLI per Q4 decision.
- `assignee` in MCP update tool changed from `z.string().nullable()` to `z.string().optional()` to avoid TypeScript type mismatch.
- `TaskService.delete()` added as internal utility (used by project cascade delete tests). Not exposed via CLI or MCP — not in the design API surface, but useful for service-layer completeness.

### Verification outcomes

| Check | Result |
|---|---|
| Design fidelity | pass |
| Test coverage | pass — 56 tests match Q7 test plan |
| Regressions | pass (greenfield) |
| Simplicity | pass |
| Code style | pass — matches ai-memory patterns |

### Code Review Verified (2026-04-12)

| Dimension | Rating | Notes |
|---|---|---|
| Design fidelity | pass | All §3 decisions implemented |
| Completeness | pass | Steps 1-8 done, 9-10 deferred |
| Deviation detection | pass | Fixed: double query in status cmd, S1/S7 `--active` refs, documented `delete()` |
| Test quality | pass | 56 behavioral tests |
| Regression check | pass | Greenfield |
| Verification criteria | pass | Fixed: scenario examples updated |
| Results accuracy | pass | File list and counts accurate |
| Documentation alignment | pass | CLAUDE.md correct |
| Security | pass | Parameterized SQL, no secrets, zod validates MCP input |

All 3 concerns from initial review resolved. Implementation verified.

---

## 8. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-04-12 | Initial design log for ai-tasks repo. Content derived from ai-research 026-ai-tasks.md (v0.1-v0.3). See that log for full decision history and options analysis. |
| 0.2 | 2026-04-12 | Design review: 5 pass, 2 concern (Risk, Completeness). Added §4 Review Q&A with 7 draft questions: dependency querying, FK/deletion strategy, updated_at maintenance, --active definition, error handling philosophy, migration strategy, test plan. |
| 0.3 | 2026-04-12 | All 7 Q&A questions resolved. Design approved. Second review: all 7 perspectives pass. |
| 1.0 | 2026-04-12 | Implementation complete. 56 tests passing. Steps 1-8 done, steps 9-10 deferred. Status → implemented. |
| 1.1 | 2026-04-12 | Code review: 3 concerns found, all fixed. Double query in status cmd, S1/S7 `--active` refs, undocumented `delete()` method. All 9 dimensions pass. |
