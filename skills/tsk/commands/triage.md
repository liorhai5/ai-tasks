Review all active tasks and suggest next actions. Uses ai-tasks-list and ai-tasks-load.

1. Call ai-tasks-list with no filters to get all tasks (includes updated_at for recency).
2. Analyze the task list through these lenses:
   - **Stale work**: tasks in_progress or blocked with old updated_at — may need a status update or reassignment
   - **Unblocked**: blocked tasks whose dependencies are now done — ready to resume
   - **Quick wins**: high-priority todo items that appear small in scope — clear these first
   - **Priority mismatches**: critical/high items still in todo while medium items are in_progress
   - **Scope flags**: tasks that have been in_progress much longer than similar tasks — may have expanded scope
3. For any task that looks stale or interesting, call ai-tasks-load to check recent updates before judging.
4. Present a prioritized action list: "Here's what I'd suggest working on next, and why."
5. Ask if the user wants to update any tasks based on the triage.
