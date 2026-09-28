---
title: "Action Management & Context Tags"
type: "feature"
created: "2026-09-28"
status: "done"
baseline_commit: "5d80f886b33e85e025476386ad46195d5b677aea"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The project detail page shows actions as static, disabled checkboxes. A user cannot add, edit, delete, reorder, or tag the actions in a project, so the action list can't reflect the real work.

**Approach:** Replace the static action list with an interactive, accessible `ActionList` client component. Add authenticated routes to add (with append ordering), edit text, set optional context tags, delete, and reorder actions within a project. Render each action as an `ActionItem` row (checkbox — text — context-tag chips) with the three status treatments (available / committed / done). This story covers add/edit/delete/reorder/tag and the visual states; committing a single next action + stuck detection is Story 4.5.

## Boundaries & Constraints

**Always:** All reads/writes go through the authenticated Supabase clients; RLS enforces ownership. Actions belong to a project; every mutation is scoped by the acting user. Add appends with the next `sort_order`. Reorder persists new `sort_order` values for the affected project's actions. Context tags are OPTIONAL `@energy` / `@location` / `@tool` values stored in `context_tags` (a Postgres text[] of `@key:value` strings); an untagged action is valid. ActionItem states: Available = default border; Committed = primary border + primary-subtle background; Done = line-through + muted text + checked checkbox. Reuse the Epic 4 mutation-route pattern and the `busy`/error conventions. WCAG 2.1 AA on all new UI (keyboard add/edit/delete/reorder, ARIA, 44px targets, contrast).

**Ask First:** Any schema/migration change. Changing `context_tags` storage shape. Free-form tag keys beyond @energy/@location/@tool.

**Never:** No committing / decommitting logic or the single-committed enforcement here (Story 4.5 — rely on the `fn_commit_action` DB trigger there). No stuck detection UI here (4.5). No new server-side storage. Do not hard-delete the whole project. No markdown.

## I/O & Edge-Case Matrix

| Scenario                | Input / State                       | Expected Output / Behavior                                                                  | Error Handling                                 |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Render list             | Project with actions                | Each row: checkbox reflecting status, action text, context-tag chips; correct state styling | N/A                                            |
| Add action              | Non-empty text                      | New action appended with next sort_order, status `available`; list updates                  | 400 empty/too-long; 401; 404 non-owned project |
| Edit action text        | Valid text                          | Text persists                                                                               | 400 invalid; 404 non-owned                     |
| Set context tags        | Valid @key:value list               | Tags persist; untagged (empty) is valid                                                     | 400 invalid tag shape                          |
| Delete action           | Own action id                       | Row removed                                                                                 | 401; 404 non-owned                             |
| Reorder                 | New ordered id list for the project | sort_order persisted to match the new order                                                 | 400 mismatched ids; 404                        |
| Reorder with foreign id | An id not in the project            | Reject without partial write                                                                | 400                                            |
| Empty text add          | "" / whitespace                     | Rejected; nothing added                                                                     | 400                                            |

</frozen-after-approval>

## Code Map

- `lib/actions/tags.ts` -- NEW pure helpers: `CONTEXT_TAG_KEYS` (`energy`/`location`/`tool`), `isValidContextTag`, `sanitizeContextTags` (normalize/validate `@key:value` strings, dedupe, reject bad shapes). Unit-tested.
- `lib/actions/validate.ts` -- NEW pure validators: `sanitizeActionText` (1–500), `isActionStatus`, patch sanitizer for `{ text?, context_tags? }`. Unit-tested.
- `app/api/projects/[id]/actions/route.ts` -- NEW: `POST` (add action, append order) and `PATCH` (reorder — accept an ordered array of action ids for THIS project; validate they exactly match the project's action ids; update sort_order). Auth-guarded, scoped by user + project.
- `app/api/actions/[id]/route.ts` -- NEW: `PATCH` (edit text and/or context_tags) and `DELETE`. Auth-guarded, scoped by user; verifies ownership.
- `components/projects/ActionItem.tsx` -- NEW row: checkbox (reflects status; done = checked), text (inline-editable), context-tag chips, edit/delete controls, drag/keyboard reorder affordance. State styling per the matrix.
- `components/projects/ActionList.tsx` -- NEW client component: holds the action list, add field, and reorder controls; calls the routes and `router.refresh()`.
- `components/projects/ContextTagEditor.tsx` -- NEW small control to add/remove @energy/@location/@tool tags on an action.
- `app/app/projects/[id]/page.tsx` -- EDIT: replace the static "Next Actions" `<ul>` of disabled checkboxes with `<ActionList projectId=... actions=... />`; pass `id, text, status, context_tags, sort_order`.
- `lib/supabase/schema.ts` -- import `Action`, `ActionStatus`, `ActionInsert`, `ActionUpdate` (read-only).
- `app/api/goals/[id]/route.ts` -- reference for the mutation-route + auth-guard shape (read-only).

## Tasks & Acceptance

**Execution:**

- [x] `lib/actions/tags.ts` -- add context-tag key set + validate/sanitize helpers -- single source of tag rules.
- [x] `lib/actions/validate.ts` -- add action text + patch validators -- server-side edit safety.
- [x] `app/api/projects/[id]/actions/route.ts` -- add `POST` (add, append) + `PATCH` (reorder, exact-id-set) -- collection mutations.
- [x] `app/api/actions/[id]/route.ts` -- add `PATCH` (text + context_tags) + `DELETE` -- per-action mutations.
- [x] `components/projects/ContextTagEditor.tsx` -- add optional-tag editor (@energy/@location/@tool) -- tagging UI.
- [x] `components/projects/ActionItem.tsx` -- add the row with the three state treatments + edit/delete/tag -- one accessible action row.
- [x] `components/projects/ActionList.tsx` -- add the interactive list: add field + reorder + wiring -- the feature.
- [x] `app/app/projects/[id]/page.tsx` -- replace static checkboxes with `ActionList` -- integrate.
- [x] `lib/actions/tags.test.ts`, `lib/actions/validate.test.ts` -- unit-test the tag + validation I/O matrix -- lock pure logic.
- [x] `app/api/projects/[id]/actions/route.test.ts`, `app/api/actions/[id]/route.test.ts` -- test add/reorder/edit/delete incl. failure paths with mocked Supabase -- lock mutations.
- [x] `components/projects/ActionList.test.tsx` -- test render states, add, edit, delete, reorder interactions -- lock interactivity.

**Acceptance Criteria:**

- Given a project's action list, when it renders, then each action shows text, its status (available/committed/done), and any context-tag chips.
- Given action management, when I operate on actions, then I can add via an inline field, edit text, delete, and reorder actions within the project.
- Given context tags, when I tag an action, then I can attach optional @energy / @location / @tool tags stored in `context_tags`, and an untagged action is valid.
- Given the ActionItem states, when rendered, then Available uses a default border, Committed uses primary border + primary-subtle background, and Done uses line-through + muted text + a checked checkbox.
- Given a reorder with an id that is not part of the project, when submitted, then the server rejects it without a partial write.

## Design Notes

Context tags are `@key:value` strings where key ∈ {energy, location, tool} (e.g. `@energy:high`, `@location:home`). `sanitizeContextTags` lowercases the key, trims the value, rejects unknown keys or malformed entries, and dedupes. An empty/absent list is valid (untagged action).

Reorder contract: the client sends the full ordered list of the project's action ids. The server loads the project's current action ids, verifies the submitted set is exactly equal (same members), and only then writes `sort_order = index` per id — a mismatch (missing/foreign id) is a 400 with no write, so reorder can never drop or adopt an action.

ActionItem "done" toggling flips status available↔done (a plain completion toggle); this story does NOT implement committing (status `committed` is set/enforced in 4.5 via the DB trigger). The committed visual state is still styled here so 4.5 only needs to wire the commit action.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `npm test -- --run lib/actions app/api/actions app/api/projects components/projects` -- expected: new tests pass.

## Suggested Review Order

**Mutation surface**

- Entry point — add (append) + reorder (exact-id-set contract, no partial adopt/drop).
  [`actions/route.ts:52`](../../app/api/projects/[id]/actions/route.ts#L52)
- Per-action edit (text/tags/completion toggle) + delete, scoped by user.
  [`route.ts:31`](../../app/api/actions/[id]/route.ts#L31)

**Pure rules**

- Context-tag validation/normalization (keys energy/location/tool, dedupe).
  [`tags.ts:38`](../../lib/actions/tags.ts#L38)
- Action patch validation (text + tags + available/done toggle; committed rejected).
  [`validate.ts:38`](../../lib/actions/validate.ts#L38)

**Interactive surface**

- Action list: add field, reorder, and per-action mutation wiring.
  [`ActionList.tsx:29`](../../components/projects/ActionList.tsx#L29)
- Action row: checkbox/text/tags/controls + the three state treatments.
  [`ActionItem.tsx:57`](../../components/projects/ActionItem.tsx#L57)
- Optional context-tag editor.
  [`ContextTagEditor.tsx:20`](../../components/projects/ContextTagEditor.tsx#L20)

**Integration + tests (peripheral)**

- Project detail page mounts the interactive list.
  [`page.tsx:1`](../../app/app/projects/[id]/page.tsx#L1)
- List interactions incl. committed styling, inline edit, reorder up/down.
  [`ActionList.test.tsx:1`](../../components/projects/ActionList.test.tsx#L1)
