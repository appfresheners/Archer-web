# GTD Method Reference

A working reference for the Getting Things Done (GTD) methodology, compiled to guide the design of Archer as an active GTD productivity system. Sources are cited inline. Direct quotes are kept short (under 30 words) and attributed; the rest is paraphrased. Content was rephrased for compliance with licensing restrictions.

> Purpose of this file: a single source of truth for "what GTD actually requires," so product/schema decisions can be checked against the real method rather than an approximation.

---

## Core premise

GTD's founding idea, from David Allen: your mind is for having ideas, not holding them. Unrecorded commitments become "open loops" that create low-grade background anxiety and drain focus even when you aren't working on them. The fix is a single trusted external system that captures everything and processes it into concrete next steps, so the brain can stop trying to remember and start doing. ([clickup.com](https://clickup.com/learn/topic/productivity/time-management/gtd/), [obsibrain.com](https://www.obsibrain.com/blog/gtd-workflow-a-practical-guide-to-getting-things-done))

The method rests on moving every item of interest — tasks, info, issues, projects — out of the mind by recording it externally, then breaking each into actionable work items. ([Wikipedia: Getting Things Done](https://en.wikipedia.org/wiki/Getting_Things_Done))

---

## The five stages (the workflow spine)

GTD is a five-step workflow: **Capture → Clarify → Organize → Reflect → Engage**. Each stage has its own rules, and skipping a stage breaks the whole system. ([lifestack.ai](https://lifestack.ai/blog/gtd-flowchart), [taskade.com](https://www.taskade.com/wiki/productivity-methods/getting-things-done-gtd))

### 1. Capture
Collect everything that has your attention into trusted inboxes — nothing stays in your head. First list every place "stuff" arrives (email, physical in-tray, notes, backpack), then habitually drop task-related material into those inboxes. Capture is *not* deciding; you record now and process later. ([gettysburg.edu GTD summary](http://cs.gettysburg.edu/~tneller/resources/gtd/2017-gtd-summary.pdf))

Design implication for Archer: there must be a fast, frictionless **Inbox** where a raw thought is recorded without forcing any classification, project assignment, or AI breakdown up front.

### 2. Clarify
Process each inbox item by asking a fixed sequence of questions. This is the decision tree ([lifestack.ai](https://lifestack.ai/blog/gtd-flowchart), [noisydeadlines.net](https://noisydeadlines.net/gtd-notes-chapter-06-processing-guidelines), [ixcoach.com two-minute rule](https://www.ixcoach.com/practices/getting-things-done/two-minute-rule)):

1. **Is it actionable?** Yes or No.
2. **If NO** → one of: **Trash** (no longer needed), **Reference** (keep as information, not a task), or **Someday/Maybe** (might act on it later, not now).
3. **If YES** → identify the very next physical action. Then:
   - **Two-minute rule:** if the next action takes under ~2 minutes, do it immediately rather than tracking it.
   - **Delegate** if someone else should do it → track on a **Waiting For** list.
   - **Defer** if you'll do it later → put it on a next-actions list (and/or the calendar if it must happen on a specific day/time).
4. **Is it a project?** If the outcome needs more than one action step, record it on the **Projects** list and pull out its next action.

Clarify converts vague inbox items into either non-actionable buckets or a concrete next action described with a clear actionable verb and (in full GTD) a context. ([facilethings clarify stage](https://facilethings.medium.com/the-clarify-stage-of-gtd-explained-22b215fe1031), [facilethings tutorial](https://facilethings.com/learning/en/tutorial/clarifying-what-it-is))

### 3. Organize
Put clarified items where they belong so the right thing is visible at the right moment. The canonical GTD "buckets":
- **Next Actions lists** — organized by **context** (see below).
- **Projects list** — the inventory of outcomes needing more than one step (a list of names, not the plans themselves).
- **Waiting For** — things delegated / awaiting someone else.
- **Calendar** — only for things that must happen on a specific day/time (hard landscape), not a general to-do dumping ground.
- **Someday/Maybe** — things you might do eventually.
- **Reference** — non-actionable information / project support material.

### 4. Reflect (the Weekly Review — GTD's engine)
Lists go stale without regular review, drifting out of sync with reality. The Weekly Review is the habit that keeps the system trusted. It runs in three phases ([ixcoach.com weekly review](https://www.ixcoach.com/practices/the-getting-things-done-weekly-review), [gettingthingsdone.com podcast 43](https://gettingthingsdone.com/2018/08/episode-43-the-power-of-the-gtd-weekly-review/)):

- **Get Clear** — empty every inbox; do a mind sweep so nothing is left uncaptured.
- **Get Current** — review the calendar (past and upcoming), the Waiting For list, and every active project; ensure **each active project has at least one current next action**.
- **Get Creative** — review Someday/Maybe and the higher horizons; add anything new that wants attention.

Allen's framing: a weekly review is a clearing pass — empty what accumulated, look at the next couple of weeks, then think about what's next. It's closer to tidying a workshop than journaling. ([journalinghabit.com](https://journalinghabit.com/weekly-review-template/))

### 5. Engage
Actually do the work — choose what to do now with confidence. Because next actions are pre-clarified and sorted by context, you can pick quickly based on your current context, time available, energy, and priority, instead of re-deciding each time. ([asana.com](https://asana.com/resources/getting-things-done-gtd/), [desmondrivet.com](https://desmondrivet.com/2023/12/05/gtd-org-mode))

Design implication for Archer: the daily home screen is the **Engage** view — the committed / actionable next actions, not the whole universe of tasks.

---

## Next Actions — the precise definition

A next action is, in Allen's words, the most immediate physical, visible activity required to move something toward closure. ([dzombak.com](https://www.dzombak.com/blog/2025/11/not-everything-in-your-todo-list-needs-to-be-a-proper-gtd-next-action/), [facilethings.com](https://facilethings.com/blog/en/the-importance-of-next-actions))

Key properties:
- **Physical & visible** — a concrete thing you can see yourself doing ("Call John re: meeting," not "Set up meeting").
- **Independent** — it cannot depend on any other action being done first. ([facilethings.com](https://facilethings.com/blog/en/the-importance-of-next-actions))
- **Concrete & now-doable** — the next specific thing you can do now to move a project forward. ([facilethings.com clarity](https://facilethings.com/blog/en/the-usefulness-of-clarity-in-the-next-actions))
- **Starts with an action verb** — "Call," "Draft," "Buy," "Search," "Email."

Examples of the distinction ([medium.com](https://medium.com/@bcfinbraten/whats-the-next-action-the-one-question-that-will-improve-productivity-6ad91d9ebbc0)):
- "Fix the car" → not a next action (it's an outcome). Next action: "Call garage X to book a service."
- "Call John" → too vague. Next action: "Call John to propose meeting dates."

---

## Projects vs Next Actions (critical distinction)

From David Allen ([gettingthingsdone.com managing projects](https://gettingthingsdone.com/2010/02/managing-projects-tips-from-david-allen/)):
- **Project** = an outcome that requires more than one action step.
- **Next Action** = the next physical, visible step. Some are tied to a project; some are standalone.

Guidance that directly affects the data model:
- **Each active project should have at least one next action.** A project with **zero** next actions is a **"stuck project."** ([adventuresinwhy.com](https://www.adventuresinwhy.com/post/next-actions/))
- In strict GTD, a project typically surfaces **at most one** next action at a time onto the context lists; the rest of the plan stays in "project support." ([adventuresinwhy.com](https://www.adventuresinwhy.com/post/next-actions/))
- A project is **not a container** for all its tasks. The full outline/plan lives in **project support material**; the next action is distinct and lives on a context list. ([gettingthingsdone.com forum](https://forum.gettingthingsdone.com/threads/projects-are-not-containers.16844/))

### How Allen recommends linking projects and next actions
Park next actions on **context-based lists — not as sub-lists under each project.** Project plans are "project support," a parking lot for future/dependent actions. Software may link a project to its action(s) for display, or you use a shared keyword. The Weekly Review is what keeps projects and their next actions in sync. ([gettingthingsdone.com: linking next actions and projects](https://gettingthingsdone.com/2020/06/the-gtd-approach-to-linking-next-actions-and-projects/))

Benefit of context-sorting: when you have 20 free minutes, you can act quickly by matching actions to the tools/people/places available right now, instead of digging through project material. ([gettingthingsdone.com](https://gettingthingsdone.com/2020/06/the-gtd-approach-to-linking-next-actions-and-projects/))

---

## Contexts

A **context** is the tool, location, person, or situation required to do an action (e.g. @computer, @phone, @errands, @home, @office, @agenda-with-boss). Next actions are bucketed by context so that, when you're in a given context, you can pull up everything doable there and pick one. ([noisydeadlines.net](https://noisydeadlines.net/gtd-notes-chapter-07-the-buckets), [desmondrivet.com](https://desmondrivet.com/2023/12/05/gtd-org-mode), [facedragons.com](https://facedragons.com/productivity/what-are-next-action-lists-in-gtd/))

---

## The 6 Horizons of Focus (altitude model)

GTD frames "work" at six altitudes. Lower levels are execution; higher levels give direction. Getting a level clear usually surfaces new projects and actions. ([gettingthingsdone.com: 6 Horizons of Focus](https://gettingthingsdone.com/2011/01/the-6-horizons-of-focus/))

- **Ground — Calendar / Actions:** the full inventory of current actions and info to do/organize.
- **Horizon 1 — Projects:** all commitments needing more than one step. Most people carry 30–100.
- **Horizon 2 — Areas of Focus & Accountability:** the ~4–7 ongoing roles/responsibilities you're accountable to (these *drive* projects; they don't "complete").
- **Horizon 3 — 1–2 year Goals & Objectives:** where your role/life is heading in 12–18 months.
- **Horizon 4 — 3–5 year Vision:** the longer direction and its influences.
- **Horizon 5 — Purpose & Principles:** why you exist / core values (the biggest picture).

(Allen numbers these Horizon 1–5 plus Ground; some write-ups relabel them 10k–50k feet. Same model.)

Design implication for Archer: goals are **Horizon 3**; the existing "Reverse Goal Setting" 3-month goal is a shorter-horizon variant. **Areas of Focus (Horizon 2)** are an ongoing, never-"done" category distinct from projects — worth modeling separately from goals if the system is to follow GTD properly.

---

## Mapping GTD → Archer data model (design notes)

| GTD concept | Nature | Archer modeling note |
|---|---|---|
| Inbox item | raw, unclarified capture | `inbox_items` — text only, no required classification |
| Next Action | physical, visible, independent, now-doable | `next_actions` — verb-first text, `done` flag, optional context/time/energy |
| Project | outcome needing >1 step | `projects` — name = outcome, holds support/plan; must always expose ≥1 next action or be flagged "stuck" |
| Context | tool/place/person needed | tag on next actions; user-customizable list (@computer, @phone, @errands…) |
| Waiting For | delegated / awaiting others | a state of a next action (or its own list) |
| Calendar item | hard day/time commitment | date-bound next action; keep separate from general list |
| Someday/Maybe | not now, maybe later | a status on projects/actions |
| Area of Focus | ongoing responsibility (Horizon 2) | `areas` — never completes; projects roll up to it |
| Goal | 1–2 yr objective (Horizon 3) | `goals` — projects roll up to it; existing status enum applies |
| Weekly Review | recurring reflect pass | `reviews` — with a stuck-project + inbox-zero checklist |

### Status enum already in Archer
The Reverse Goal Setting template's Monthly Goal Check defines goal statuses: **Active / Paused / Not now / Someday / Completed / Archived** — a ready-made lifecycle for goals (and reusable for projects).

---

## Rules the system must not violate (GTD "correctness" checklist)

1. **Capture is decision-free** — the inbox accepts raw input with no forced classification.
2. **Clarify follows the decision tree** — actionable? → 2-min? → delegate/defer; not-actionable? → trash/reference/someday.
3. **Next actions are physical, visible, independent, verb-first** — never outcomes or multi-step tasks.
4. **Every active project has ≥1 next action** — otherwise flag it "stuck" (surfaced in the Weekly Review).
5. **Projects are not task containers** — the plan is support material; the next action is the thing that surfaces to "do."
6. **Engage is context/time/energy/priority-driven** — the daily view filters, it doesn't dump.
7. **The Weekly Review is a first-class, recurring ritual** — Get Clear → Get Current → Get Creative.
8. **Calendar = hard landscape only** — day/time-specific commitments, not a wishlist.

---

## Evaluating the current Notion "is next action" checkbox (user's approach)

**User's method:** every task has an "is next action" checkbox; checking it surfaces the task on a single global Next Actions list.

**Verdict against GTD:** partially aligned, with two gaps.

- ✅ **Aligned:** it separates "the next thing to do" from the broader pile — that's the core Engage idea, and a manual "commit" flag is a legitimate, simple way to drive the daily list.
- ⚠️ **Gap 1 — no context dimension.** GTD sorts next actions by **context** so you act by what's doable *right now*. A single flat global list ignores context; you can't ask "what can I do @phone with 10 minutes?" A boolean flag alone loses this.
- ⚠️ **Gap 2 — "stuck project" blindness.** A per-task boolean doesn't guarantee **each active project has exactly/at least one** next action. Projects can silently end up with zero flagged actions (stuck) or several competing ones. GTD wants the invariant enforced (ideally one active next action per project) and stuck projects surfaced during the Weekly Review.
- ⚠️ **Minor — flat global list scales poorly.** With 30–100 projects, one undifferentiated Next Actions list gets noisy; context + area/goal roll-up is what keeps Engage fast.

**Recommendation for Archer:** keep the simple "commit / is next action" flag as the driver of the daily Engage view (it matches how the user already works), but add:
- a **context** tag per action (customizable) so Engage can filter by context/time/energy;
- an enforced/surfaced invariant that **each active project has a next action**, with **stuck projects** flagged in the Weekly Review;
- optional **auto-surface**: when a committed action is checked off, offer the project's next candidate action so the daily list self-replenishes.

This preserves the user's mental model while closing the two places where a bare boolean drifts from real GTD.

---

## Sources

- David Allen / official: [6 Horizons of Focus](https://gettingthingsdone.com/2011/01/the-6-horizons-of-focus/), [Linking Next Actions and Projects](https://gettingthingsdone.com/2020/06/the-gtd-approach-to-linking-next-actions-and-projects/), [Managing Projects](https://gettingthingsdone.com/2010/02/managing-projects-tips-from-david-allen/), [Weekly Review (Podcast 43)](https://gettingthingsdone.com/2018/08/episode-43-the-power-of-the-gtd-weekly-review/), [Projects are not containers (forum)](https://forum.gettingthingsdone.com/threads/projects-are-not-containers.16844/)
- Overviews: [ClickUp](https://clickup.com/learn/topic/productivity/time-management/gtd/), [Asana](https://asana.com/resources/getting-things-done-gtd/), [Taskade](https://www.taskade.com/wiki/productivity-methods/getting-things-done-gtd), [Lifestack flowchart](https://lifestack.ai/blog/gtd-flowchart), [Wikipedia](https://en.wikipedia.org/wiki/Getting_Things_Done)
- Next actions & contexts: [FacileThings](https://facilethings.com/blog/en/the-importance-of-next-actions), [Dzombak](https://www.dzombak.com/blog/2025/11/not-everything-in-your-todo-list-needs-to-be-a-proper-gtd-next-action/), [Adventures in Why](https://www.adventuresinwhy.com/post/next-actions/), [Noisy Deadlines ch.7](https://noisydeadlines.net/gtd-notes-chapter-07-the-buckets), [Desmond Rivet / Org mode](https://desmondrivet.com/2023/12/05/gtd-org-mode)
- Clarify & 2-minute rule: [ixcoach two-minute rule](https://www.ixcoach.com/practices/getting-things-done/two-minute-rule), [Noisy Deadlines ch.6](https://noisydeadlines.net/gtd-notes-chapter-06-processing-guidelines), [Getting Your Inbox to Zero (PDF)](https://gettingthingsdone.com/wp-content/uploads/2014/10/2017-Getting-Your-Inbox-to-Zero.pdf)
- Weekly Review: [ixcoach](https://www.ixcoach.com/practices/the-getting-things-done-weekly-review), [journalinghabit template](https://journalinghabit.com/weekly-review-template/)
