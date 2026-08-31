---
title: "Complete Reverse Goal Setting Template in Goal Mode Output"
type: "bugfix"
created: "2026-08-28"
status: "done"
route: "one-shot"
---

# Complete Reverse Goal Setting Template in Goal Mode Output

## Intent

**Problem:** The goal mode output only generated Steps 1-2 (Goal + Target Profile) and GTD Projects, missing Steps 3-6 (My Current Profile, Drivers/Barriers, Focus on Biggest Gaps, Link Projects) and the Monthly Goal Check from the source Reverse Goal Setting template.

**Approach:** Updated both the client-side static template (`goal-template.ts`) and the AI generation prompt (`GOAL_SYSTEM_PROMPT` in `route.ts`) to produce the complete 6-step Reverse Goal Setting structure plus the Monthly Goal Check section. Increased max_tokens to 8192 to accommodate the longer output.

## Suggested Review Order

1. [goal-template.ts](../../archer/lib/templates/goal-template.ts) — core change: static template now contains all 6 steps + monthly check
2. [route.ts](../../archer/app/api/generate/route.ts) — AI prompt updated to generate complete template; max_tokens raised to 8192
3. [goal-template.test.ts](../../archer/lib/templates/goal-template.test.ts) — tests updated to validate new sections (Current Profile, Drivers/Barriers, Priorities, Link Projects, Monthly Check)
