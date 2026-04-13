Update a task. Parse $ARGUMENTS for the task ID and any fields or intent.

1. Call ai-tasks-load with the task ID to show current state.
2. Interpret the user's intent from $ARGUMENTS — status change, priority change, progress note, assignee, etc.
3. If the intent is unclear, ask what they want to change.
4. Call ai-tasks-update with the task ID and changes. Set actor to the current tool (e.g. "claude-code"), provider to the current model, and session_id to the current conversation/session identifier if available.
5. Show the updated task summary.
