Break a task into subtasks. Uses ai-tasks-load and ai-tasks-create.

1. Call ai-tasks-load with the task ID from $ARGUMENTS and full=true to understand the task.
2. If the task description references specific files, code, or docs, read them for context. Otherwise, base the breakdown on the title and description alone.
3. Propose a breakdown into 3-7 subtasks following this structure:
   - **Parts**: clear, actionable titles with non-overlapping boundaries. Each subtask should be independently completable.
   - **Dependencies**: which subtasks block which — what can run in parallel vs. what must be sequential.
   - **Decision gates**: open questions that should be resolved before starting a subtask, if any.
   - **Scope flags**: anything that looks deceptively complex or likely to expand.
   - For each subtask: suggested priority and stage.
4. Present the proposed subtasks and ask: "Create these subtasks? [Y/n/edit]"
5. On approval, call ai-tasks-create for each subtask with parent_id set to the original task, appropriate depends_on relationships, and session_id set to the current conversation/session identifier if available.
6. Show the created subtask IDs and dependency graph.
