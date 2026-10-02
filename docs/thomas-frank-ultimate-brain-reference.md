# Thomas Frank "Ultimate Brain" GTD Notion Template — Reference

The user's current productivity system runs on Thomas Frank's **Ultimate Brain** Notion template (which builds on his simpler **Ultimate Tasks** template). This document captures its structure so Archer's Supabase model can learn from what already works for the user — and improve on the parts Notion databases make rigid.

Sources cited inline (all Thomas Frank's official docs). Quotes kept short and attributed; the rest paraphrased. Content was rephrased for compliance with licensing restrictions.

---

## What it is

Ultimate Brain is a "second brain" Notion template that bundles a task/project manager with notes, goals, and PARA-style organization, and offers an optional **GTD-style processing** workflow via a dedicated **Process page**. Ultimate Tasks is the lighter task/project-only subset. ([Ultimate Brain](https://thomasjfrank.com/brain/), [Task & Project template](https://thomasjfrank.com/templates/task-and-project-notion-template/))

The design principle: a few central databases hold all the data, and every page is just a filtered **linked view** into those databases. ([Databases reference](https://thomasjfrank.com/docs/ultimate-brain/databases/), [Tasks database](https://thomasjfrank.com/docs/ultimate-tasks/databases/tasks/))

---

## The core databases (Ultimate Brain)

From the official databases reference ([link](https://thomasjfrank.com/docs/ultimate-brain/databases/)):

| Database | Stores |
|---|---|
| **Tasks** | All tasks + details: due date, status, Project relation, sub-tasks, recurring settings |
| **Notes** | Notes + tags, URL, type, favorite, attachments |
| **Projects** | Projects + status, related Tasks/Notes, related Tag (e.g. Area), target deadline |
| **Work Sessions** | Time-tracking entries tied to tasks |
| **Tags** | PARA Areas & Resources; general categorization; links to projects/goals/notes |
| **Goals** | Goals + target deadline, related Projects, progress, achieved dates |
| **Milestones** | Milestones + related Goal, target deadline, completion date |
| **People** | Contacts + details, related meeting notes |
| Books / Reading Log / Genres / Recipes / Recipe Tags / Meal Planner | Domain-specific extras (out of scope for Archer) |

**The GTD-relevant spine is: Tasks → Projects → Goals, with Tags providing PARA "Areas."** Milestones sit between Goals and Projects. Relations connect them bidirectionally.

The rollup chain worth noting for Archer:
- **Areas** are modeled as **Tags** (PARA), related to Projects and Goals — not a first-class "Area" database.
- **Goals** relate to **Projects** (and Milestones); goal **progress** is derived.
- **Projects** relate to **Tasks**; project **progress %** is derived from completed tasks.

---

## Tasks database — key properties

From the Tasks database reference ([link](https://thomasjfrank.com/docs/ultimate-tasks/databases/tasks/)) and Ultimate Brain managing-tasks docs:

- **Name** (title) — the task.
- **Status** (Status type) — grouped **To Do / Doing / Done**. Most views render it as a checkbox; checking toggles To Do ↔ Done, Alt+Click reveals "Doing." This is the user's checkbox interaction model.
- **Project** (relation → Projects) — associates a task with a project.
- **Parent Task / Sub-Tasks** (self-relation) — custom sub-task system (not Notion's native sub-items). Changing a sub-task's Project detaches it from its parent.
- **Due** (date) — due date; drives the Today/Scheduled views (filters target the Due end date).
- **Priority** (Status: Low / Medium / High) — only matters in the Priority view by default.
- **Context** (in Ultimate Brain) — tag tasks with contexts like **High/Low Energy, Errand, Social, Home**, etc. Explicitly "designed to support a Getting Things Done (GTD) workflow"; a pre-built **By Context** view lives in the Process (GTD) page's "Do Next" sub-page. ([Managing tasks](https://thomasjfrank.com/docs/ultimate-brain/managing-tasks/))
- **Tags** (select) — special task tags; by default only **"Someday."** Someday tasks appear in the Someday view and are hidden from the Inbox even without a Project.
- **Recurring** — Recur Interval, Recur Unit (Day/Week/Month/Year + month-weekday variants), Days-of-week, and a computed **Next Due** date. Recurring tasks are automated via an external Pipedream workflow.
- **Project Active?** (formula) — true when the task's project status is Doing or Ongoing; used to filter out tasks in not-yet-active projects.
- **Assignee, Created, Edited, Work Sessions** — supporting metadata / time-tracking.

### The Inbox concept (Notion implementation)
A task with **no Project assigned** shows up in the Inbox — unless it's tagged "Someday." So in Ultimate Brain, "unprocessed" ≈ "no project + not someday." Processing a task largely means assigning it a Project (and context/date). ([Tasks database](https://thomasjfrank.com/docs/ultimate-tasks/databases/tasks/), [Managing tasks](https://thomasjfrank.com/docs/ultimate-brain/managing-tasks/))

---

## Projects database — key properties

From the Projects database reference ([link](https://thomasjfrank.com/docs/ultimate-tasks/databases/projects/)):

- **Name** (title).
- **Status** (Status type), grouped:
  - To-do group: **Planned** (intend to do, not started), **On Hold** (started, paused)
  - In-progress group: **Doing** (defined end goal, actively working), **Ongoing** (maintenance/standard-keeping — e.g. a PARA Area's recurring work)
  - Complete group: **Done**
- **Tasks** (relation → Tasks) — the project's tasks.
- **Progress** (formula) — % of related tasks that are Done.
- **Task Count** (formula) — count of active tasks + overdue tasks.
- **Latest Activity** (formula) — most recent edit across the project or its tasks/notes; enables sorting by activity.
- **Archived** (checkbox) — removes it from main views into an Archived view.
- **Target deadline** + relation to a **Tag (Area)** and to **Goals/Milestones** (in Ultimate Brain).

Note the doc's own framing: "Projects are essentially containers for multiple tasks." ([Projects database](https://thomasjfrank.com/docs/ultimate-tasks/databases/projects/)) — This is worth flagging against strict GTD (see contrast below).

---

## The GTD Process page (how GTD is actually practiced here)

Ultimate Brain adds a **Process page** that makes the Tasks and Notes databases GTD-compatible. Its workflow, per the GTD-process doc's own outline ([link](https://thomasjfrank.com/docs/ultimate-brain/gtd-process/)):

- GTD lists/folders: **Inbox, Reference Materials, Someday, Snooze, Next Actions, Projects, Delegated, Calendar.**
- Decision-making flow on each inbox item: **Is this actionable?** → **Is the next action clear/obvious?** → **Two-Minute Rule** → **Calendar vs. Next Actions list.**
- A **"Do Next"** sub-page with a pre-built **By Context** view for the Engage step.
- Distinguishes **Task Intake vs. Task Inbox** and moving tasks between GTD lists.

So the user's real GTD practice includes: an inbox, reference/someday/snooze buckets, a delegated ("waiting for") list, calendar vs. next-actions separation, context-based "Do Next" — the full GTD loop, layered on top of the Notion databases.

---

## How the user's "is next action" checkbox maps here

The user described: each task has an "is next action" checkbox; checked → appears on the Next Actions list. In Ultimate Brain terms this corresponds to the **Status/checkbox + the Next Actions GTD list + the By Context "Do Next" view**. The daily driver is the set of tasks the user has surfaced as next actions, ideally filtered by **Context** (energy/errand/home/etc.).

(See `gtd-method-reference.md` for the verdict: keep the checkbox as the Engage driver, but add a real context dimension and a stuck-project guardrail.)

---

## What Archer should LEARN from this template

Good ideas to carry over:
- **Central databases + filtered views** — one Tasks table, many views (Inbox, Today, By Context, By Project). Maps cleanly to Postgres tables + queries.
- **Context property tuned for GTD** — energy + location/situation tags (High/Low Energy, Errand, Home, Social). Adopt as a customizable `contexts` set.
- **Rich Status groups** — Projects: Planned / On Hold / Doing / Ongoing / Done (note **Ongoing** ≈ a maintenance/Area project that never "completes"). Tasks: To Do / Doing / Done.
- **Derived progress** — project % from completed tasks; goal progress from projects. Cheap to compute in SQL/views.
- **Someday handling** — a flag that pulls an item out of the active flow without deleting it.
- **Recurring tasks** — a real need; Ultimate Brain needs external automation (Pipedream) to do it. Archer can do this natively (a big win over Notion).
- **PARA Areas as the Horizon-2 layer** — Areas (as Tags) → Projects → Goals rollup.

## What Archer can DO BETTER than this template (the user's motivation)

The user is leaving Notion because its databases are rigid. Concrete places Archer can beat it:
- **Native recurring tasks** (no external Pipedream workflow / no third-party automation).
- **Enforced GTD invariants** — e.g. "every active project has ≥1 next action; flag stuck projects." Notion can't enforce this; it relies on the user's discipline in the Weekly Review. Archer can compute and surface it automatically.
- **Areas as a first-class entity**, not overloaded onto a generic Tags database.
- **Auto-surface the next action** when one is checked off (list self-replenishes) — hard to do in Notion, natural in a real backend.
- **AI-generated structured breakdowns** feeding directly into trackable Projects + Next Actions (Archer's original superpower) rather than hand-built project templates.
- **A schema the user can shape to their own GTD**, instead of Notion's fixed property types and view limitations.

## Contrast to hold in mind (Ultimate Brain vs. strict GTD)

- Ultimate Brain calls projects **"containers for tasks."** Strict GTD (per `gtd-method-reference.md`) says projects are **not** containers — the plan is "project support," and only the next action surfaces to a context list. Archer should decide where to sit on this spectrum. Given the user wants it to "follow GTD properly" but "adapt to how I work," a pragmatic middle: a project holds its full task plan (container-like, familiar from Notion) **but** the system distinguishes and surfaces the one (or few) committed **next actions** by context, and flags stuck projects — getting GTD's engage discipline without losing the user's existing mental model.

---

## Sources
- [Ultimate Brain overview](https://thomasjfrank.com/brain/)
- [Databases reference (Ultimate Brain)](https://thomasjfrank.com/docs/ultimate-brain/databases/)
- [Tasks database (Ultimate Tasks)](https://thomasjfrank.com/docs/ultimate-tasks/databases/tasks/)
- [Projects database (Ultimate Tasks)](https://thomasjfrank.com/docs/ultimate-tasks/databases/projects/)
- [Managing tasks / Context property (Ultimate Brain)](https://thomasjfrank.com/docs/ultimate-brain/managing-tasks/)
- [GTD Process page (Ultimate Brain)](https://thomasjfrank.com/docs/ultimate-brain/gtd-process/)
