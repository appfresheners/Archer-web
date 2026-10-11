---
title: 'Remove next-action completion prompt'
type: 'bugfix'
created: '2026-10-11'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Completing a committed next action opens a dialog that asks the user to choose another action, interrupting normal completion.

**Approach:** Remove the follow-up dialog and its selection/completion actions. After a successful completion update, refresh the project view without automatically changing project status.

</frozen-after-approval>

## Implementation Notes

- Removed the completion follow-up dialog and refreshed after successful action status updates.
- `/supabase/.temp/` in `.gitignore` already covers `supabase/.temp/cli-latest`; removed the generated file from the Git index and preserved its local copy.

## Review Triage Log

- low: Added coverage for completing the last committed action; it refreshes without opening a dialog or mutating project status.
- low: Strengthened the completion regression assertions to check the former prompt title and completion action remain absent.
- low: Added failed-completion coverage confirming the error is surfaced without refresh or prompt.
- low: Corrected the ignore note to reflect that the tracked CLI state file was removed from the index while its local copy remains.
