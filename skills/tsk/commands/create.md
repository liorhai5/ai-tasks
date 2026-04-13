Create a new task. Parse $ARGUMENTS for the title and any flags.

1. If no project is specified, detect it from the current working directory or ask.
2. Ask the user for any missing details they might want to set: priority, stage, description, dependencies.
3. Call ai-tasks-create with the gathered fields. Set created_by to the current tool (e.g. "claude-code"). Set session_id to the current conversation/session identifier if available.
4. Show the created task confirmation with its ID.
