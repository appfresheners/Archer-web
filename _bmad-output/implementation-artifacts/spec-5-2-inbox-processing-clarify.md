---
title: "Inbox Processing — GTD Clarify Wizard"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 0
context: []
baseline_commit: "1fa1d8fb82827a3ca1056c495b0aad9f7cad2570"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Captured inbox items (Story 5.1) can only be captured and deleted — there is no way to clarify them. The `Process` button is a placeholder that navigates to a non-existent `/app/inbox/[id]` route. GTD requires every item be run through the full clarify/organize decision tree, and the data model cannot yet represent the flow's outcomes (no standalone actions, no waiting/delegated, no scheduled date, no someday/reference inbox states).

**Approach:** Build a guided **Clarify Wizard** at `/app/inbox/[id]` that walks one item through the canonical GTD flow (What is it → Is it actionable? → Multistep project? → <2 min? → Do it / Delegate / Defer→Calendar or Next-action), and extend the schema to hold every outcome. Non-actionable items become `trashed` / `someday` / `reference`. Actionable items either resolve in place (`Do it`), spawn a **standalone** action (`waiting`+delegated_to, `scheduled_for` date, or a plain next action), or route into the existing project creator. Also add goal↔project linking so a project created during clarify can be attached to a goal afterward.

## Boundaries & Constraints

**Always:**

- Every processed item ends in exactly one terminal state and gets `processed_at` set (except `trashed`, which is terminal but represents discard): `processed` (actionable resolved), `trashed`, `someday`, or `reference`.
- The wizard reuses the Epic 3 wizard idiom (`components/goals/WizardStepper.tsx` + the `GoalWizard` STEPS/StepContext/advance-back-focus pattern) — do NOT invent a new stepper. Steps are conditional (branching), so the step set is derived from answers, not a fixed linear array.
- New actions created from clarify default to **standalone** (`project_id = null`) unless the user explicitly assigns/creates a project in the flow.
- All new mutations mirror the established route convention: `getAuthenticatedUserId()` → 401; JSON parse → 400; sanitize → 400; `.eq("user_id", userId)` + RLS; `.select("id").maybeSingle()`/`.single()`; 404 on `!data`; 500 + `console.error("[api/...]")`. Pure validators live in `lib/<domain>/validate.ts` and are unit-tested.
- The schema migration is a NEW file `supabase/migrations/0003_gtd_clarify.sql`, idempotent, mirroring the 0002 style. It must NOT edit 0001/0002. Enum `add value` statements must be sequenced so they are committed before any use.
- `schema.ts` is updated in lockstep with the migration (it is the hand-authored source of truth).
- The `<2 min` "Do it" outcome creates NO action/project — it only marks the inbox item `processed`.
- Multistep → route to the existing `/app/projects/new` creator, seeding it with the item's text; on project creation, link the inbox item via `resolved_project_id` and mark it `processed`.
- Goal↔project linking is bidirectional-capable via a project `goal_id` PATCH (change/clear a project's goal). Exposing a full "attach existing projects to a goal" UI on the goal side is allowed but minimal.

**Ask First:**

- Any change to `0001`/`0002` migrations (forbidden — use `0003`).
- Removing or weakening the `fn_commit_action` trigger or any RLS policy.
- Adding a new dependency (no date/drawer/toast lib exists by design).

**Never:**

- Do NOT build a calendar UI. The Calendar branch only stores a `scheduled_for` date on the action (surfaced as a badge).
- Do NOT change `actions.project_id` semantics for existing project-bound actions, or alter how `fn_commit_action` behaves for project-scoped actions.
- Do NOT implement the Engage view (Story 5.3) or the weekly review here. Only note the Engage semantics for standalone/waiting/scheduled actions so 5.3 stays coherent.
- Do NOT auto-generate AI content for the clarify flow — clarify is user-driven decisions, not generation. (Project creation still uses the existing generator when the user chooses the multistep path.)

## I/O & Edge-Case Matrix

| Scenario                                      | Input / State                         | Expected Output / Behavior                                                                                   | Error Handling                             |
| --------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Non-actionable → Trash                        | item, "not actionable" → Trash        | `processing_status='trashed'`, `processed_at` set; leaves inbox                                              | 404 unknown/non-owned; 500 db              |
| Non-actionable → Someday                      | item → Someday/Maybe                  | `processing_status='someday'`, `processed_at` set                                                            | as above                                   |
| Non-actionable → Reference                    | item → Reference                      | `processing_status='reference'`, `processed_at` set                                                          | as above                                   |
| Actionable, <2 min → Do it                    | item, actionable, <2 min              | `processing_status='processed'`, `processed_at` set; NO action created                                       | as above                                   |
| Actionable, ≥2 min → Next action (standalone) | item, defer, no project               | new `actions` row: `project_id=null`, `status='available'`; item `processed` + `resolved_project_id=null`    | 400 invalid text; 500 db                   |
| Actionable → Delegate (Waiting)               | item, delegate, delegated_to name     | new action `status='waiting'`, `delegated_to` set, `project_id=null` default; item `processed`               | 400 if delegated_to empty; 500 db          |
| Actionable → Defer → Calendar                 | item, defer, a date                   | new action `status='available'`, `scheduled_for=<date>`, `project_id=null` default; item `processed`         | 400 invalid date; 500 db                   |
| Actionable → assign existing project          | item, pick project P                  | action created under P (`project_id=P`) OR item linked (`resolved_project_id=P`), item `processed`           | 400 unknown project; 500 db                |
| Actionable → multistep project                | item, "it's a project"                | route to `/app/projects/new` seeded with item text; on create, item `resolved_project_id=<new>`, `processed` | generator errors surfaced by existing flow |
| Link project to goal                          | project P, goal G (or clear)          | `projects.goal_id = G` (or null); PATCH accepts `goal_id`                                                    | 400 unknown goal / bad id; 404 project     |
| Standalone committed action (Engage note)     | action `project_id=null`, `committed` | `fn_commit_action` does not decommit across null-project rows (independent) — documented, not a bug          | N/A                                        |

</frozen-after-approval>

## Code Map

- `supabase/migrations/0003_gtd_clarify.sql` -- NEW. `alter table actions alter column project_id drop not null`; `add column if not exists delegated_to text`, `add column if not exists scheduled_for date`; `alter type action_status add value 'waiting'`; `alter type inbox_processing_status add value 'someday'` + `'reference'`. Guard enum adds (Postgres: `add value` cannot run in a txn with its use — put enum adds in their own statements first). Mirror 0002 header/idempotency style. `fn_commit_action` unchanged (0001:307-319) — null project_id never matches `= new.project_id`, so standalone committed actions are independent (intended).
- `lib/supabase/schema.ts` -- UPDATE in lockstep: `ActionStatus` add `'waiting'`; `InboxProcessingStatus` add `'someday' | 'reference'`; actions Row/Insert/Update `project_id: string | null`, add `delegated_to: string | null`, `scheduled_for: string | null`. Keep the existing `InboxItem*`/`Action*` aliases.
- `components/inbox/InboxList.tsx` -- Process button currently `router.push('/app/inbox/${item.id}')` (placeholder). Keep the navigation target (the route now exists); it becomes the real entry to the wizard. May also show the new terminal statuses if the list later includes them (list currently filters to non-trashed unprocessed-ish; leave list scope as-is).
- `app/app/inbox/[id]/page.tsx` -- NEW server component. Loads the single inbox item (RLS-scoped; 404/`notFound()` if missing or already terminal), loads the user's projects + goals for the pickers, renders `ClarifyWizard`.
- `components/inbox/clarify/ClarifyWizard.tsx` -- NEW `"use client"`. Orchestrates the branching flow using the GoalWizard idiom (state, derived step list, advance/back, `useLayoutEffect` focus mgmt guarded by a one-shot ref). Calls the APIs below; on terminal success navigates back to `/app/inbox`.
- `components/goals/WizardStepper.tsx` -- REUSE the presentational stepper (`steps`, `currentIndex`, `completedIndices`). Its `aria-label` hardcodes "Goal creation progress" — parameterize the label (small prop add) so the clarify flow reads correctly; keep default for goals.
- `app/api/inbox/[id]/route.ts` -- ADD `PATCH`: set `processing_status` (one of `processed|trashed|someday|reference`), `processed_at=now()`, optional `resolved_project_id`. Validate via a new sanitizer. Keep existing `DELETE`.
- `lib/inbox/process.ts` -- NEW pure validator `sanitizeInboxProcess(body)`: allowed status set + optional uuid `resolved_project_id`. Unit-tested.
- `app/api/actions/route.ts` -- NEW `POST`: create a standalone-or-assigned action. Body: `text` (reuse `sanitizeActionText`), optional `project_id` (uuid | null → standalone), `status` (`available|waiting`), optional `delegated_to` (required when `waiting`), optional `scheduled_for` (date). Validate via a new sanitizer; RLS + user scope; if `project_id` present, it is trusted to RLS (owned rows only).
- `lib/actions/create.ts` -- NEW pure validator `sanitizeActionCreate(body)`: composes `sanitizeActionText` + status/delegated_to/scheduled_for/project_id rules. Unit-tested for the matrix rows.
- `lib/actions/validate.ts` -- reference for `sanitizeActionText`/`MAX_ACTION_TEXT` + the status-union pattern; extend `ActionStatus` handling if needed (do not loosen the PATCH commit rule).
- `app/api/projects/[id]/route.ts` + `lib/projects/validate.ts` -- EXTEND `sanitizeProjectPatch` to accept `goal_id` (uuid | null). PATCH already RLS+user scoped. This enables goal↔project linking (change/clear a project's goal).
- `app/app/projects/new/NewProjectClient.tsx` -- REUSE as the multistep target; accept an optional seed (item text via query param, e.g. `?from_inbox=<id>&seed=<text>`), and on successful create call back to link the inbox item (PATCH `/api/inbox/[id]` with `resolved_project_id` + `processed`). Keep its existing generate flow intact.
- `app/app/goals/new/GoalWizard.tsx` -- REFERENCE ONLY for the wizard idiom (STEPS config, StepContext, advance/back/goToStep, focus mgmt). Do not modify.
- `app/app/goals/page.tsx` / `app/app/goals/[id]/page.tsx` -- REFERENCE loaders for the projects/goals picker select shapes.

## Tasks & Acceptance

**Execution:**

- [x] `supabase/migrations/0003_gtd_clarify.sql` -- NEW migration (idempotent, 0002 style): nullable `actions.project_id`; add `actions.delegated_to text`, `actions.scheduled_for date`; extend `action_status` (+`waiting`) and `inbox_processing_status` (+`someday`,+`reference`). Sequence enum `add value` before use. `comment on column` the new columns.
- [x] `lib/supabase/schema.ts` -- Update enums + actions Row/Insert/Update (nullable `project_id`, new `delegated_to`/`scheduled_for`) to mirror 0003 exactly.
- [x] `lib/inbox/process.ts` (+ `.test.ts`) -- `sanitizeInboxProcess`: status ∈ {processed,trashed,someday,reference}; optional uuid `resolved_project_id`; reject others. Unit test each matrix status + bad input.
- [x] `app/api/inbox/[id]/route.ts` -- ADD `PATCH` using `sanitizeInboxProcess`: sets status + `processed_at` (+ `resolved_project_id`), RLS+user scoped, 404 on `!data`. Add `route.test.ts` covering the four terminal statuses, 401, 404, 500, and user-scope.
- [x] `lib/actions/create.ts` (+ `.test.ts`) -- `sanitizeActionCreate`: text (1..500), `project_id` uuid|null, `status` ∈ {available,waiting}, `delegated_to` required non-empty iff `waiting`, `scheduled_for` valid date|null. Unit test standalone / waiting / calendar / assigned + rejections.
- [x] `app/api/actions/route.ts` -- NEW `POST` using `sanitizeActionCreate`; inserts an `actions` row (nullable project_id) for the user; returns `{ id }`. Add `route.test.ts` covering standalone-available, waiting+delegated_to, scheduled_for, assigned-project, 400s, 401, 500.
- [x] `lib/projects/validate.ts` -- EXTEND `sanitizeProjectPatch` to accept `goal_id` (uuid | null). Update its unit test for goal_id set/clear/invalid.
- [x] `app/api/projects/[id]/route.ts` -- ensure PATCH passes `goal_id` through (validator now allows it); add/extend `route.test.ts` for linking + clearing goal_id and rejecting an invalid goal id.
- [x] `components/inbox/clarify/ClarifyWizard.tsx` (+ `.test.tsx`) -- branching wizard: What-is-it → Actionable? (No→Trash/Someday/Reference) → Multistep? (Yes→route to project creator) → <2 min? (Yes→Do it) → Delegate/Defer → (Delegate→waiting+delegated_to | Defer→Calendar date | Next action). Reuses WizardStepper + focus idiom. Each terminal calls the right API then navigates to `/app/inbox`. Test the decision paths and that each fires the correct request.
- [x] `components/goals/WizardStepper.tsx` -- add an optional `ariaLabel` prop (default "Goal creation progress"); pass a clarify-appropriate label from ClarifyWizard. Keep existing goals usage unchanged.
- [x] `app/app/inbox/[id]/page.tsx` -- NEW server component: load the item (RLS; `notFound()` if missing/terminal), load projects + goals for pickers, render `ClarifyWizard`. Add `page.test.tsx` for the not-found and happy render paths if the page has logic worth testing (else rely on component tests).
- [x] `app/app/projects/new/NewProjectClient.tsx` -- accept optional `?from_inbox`/seed; on successful project create, PATCH the inbox item (`resolved_project_id` + `processed`) before/after navigating. Extend its test for the seeded + link path.
- [x] `components/inbox/InboxList.tsx` -- confirm Process navigates to `/app/inbox/[id]` (now real); no logic change beyond enabling it. (Optional) surface someday/reference/processed badges if shown.

**Acceptance Criteria:**

- Given an unprocessed item, when I click Process, then the Clarify Wizard opens at `/app/inbox/[id]` and asks "What is it?" then "Is it actionable?".
- Given a non-actionable item, when I choose Trash / Someday / Reference, then the item's `processing_status` becomes `trashed` / `someday` / `reference` with `processed_at` set, and it leaves the unprocessed inbox.
- Given an actionable item that takes <2 minutes, when I choose "Do it", then the item is marked `processed` and no action or project is created.
- Given an actionable item I delegate, when I enter who I'm waiting on, then a standalone action with `status='waiting'` and `delegated_to` is created and the item is `processed`.
- Given an actionable item I defer to a date, when I pick a date, then a standalone action with `scheduled_for` set is created and the item is `processed`.
- Given an actionable single next action with no project, when I confirm, then a standalone action (`project_id=null`, `available`) is created and the item is `processed`.
- Given an actionable multistep item, when I choose "it's a project", then I'm routed to the project creator seeded with the item text, and on creating the project the item is linked (`resolved_project_id`) and `processed`.
- Given a project (e.g. one just created), when I link it to a goal, then `projects.goal_id` is updated (and can be cleared), via the project PATCH.
- Given the schema migration, when applied, then `actions.project_id` is nullable, `actions` has `delegated_to`/`scheduled_for`, and the `action_status`/`inbox_processing_status` enums include the new values; existing rows are unaffected.

## Spec Change Log

### 2026-09-28 — review loop (patch, no re-derivation)

- **Triggering findings:** All three review layers flagged a cross-owner data-integrity hole and two related gaps. (1) The frozen "Always" bullet said a supplied `project_id` "is trusted to RLS" — but RLS `with check (user_id = auth.uid())` only constrains the row's own owner, and the FK only checks existence, so a user could attach an action (`POST /api/actions`) or link an inbox item (`resolved_project_id` on `PATCH /api/inbox/[id]`) to ANOTHER user's project. (2) The inbox PATCH had no `unprocessed` guard, so a stale/concurrent tab could re-process a terminal item and create duplicate actions. (3) `runCreateThenProcess` could orphan an action (action created, inbox PATCH fails) and duplicate it on retry.
- **Amended (code patches, spec intent unchanged):** Added server-side ownership pre-checks — a supplied `project_id`/`resolved_project_id` must resolve to a project owned by the acting user (else 400) — in both routes. Added `.eq("processing_status", "unprocessed")` to the inbox PATCH scope so terminal items cannot be re-processed. Added a `createdActionRef` guard in `ClarifyWizard` so a retry after an inbox-PATCH failure marks the item processed instead of re-creating the action. Tightened `sanitizeInboxProcess` to reject a `resolved_project_id` paired with a non-`processed` status. Added tests for each: cross-owner rejection (both routes), the unprocessed-scope assertion, the sanitizer rejection, and the orphan-retry single-POST behavior.
- **Known-bad state avoided:** Cross-tenant action↔project / inbox↔project linkage; re-processing terminal items; orphaned/duplicated actions on partial failure.
- **KEEP (survives future work):** The clarify wizard's trail-based state machine reusing the GoalWizard focus idiom; the 0003 migration enum-ordering; standalone-default actions; the mirror-the-actions-route convention. The "trusted to RLS" wording in the frozen Boundaries is superseded by explicit app-layer ownership checks — DO NOT reintroduce blind trust of a client-supplied project id.

## Design Notes

**Branching wizard vs. linear STEPS.** The GoalWizard uses a fixed `STEPS[]`. Clarify is a decision tree, so model it as a small state machine: keep an `answers` object and derive the _current question_ + the _visited trail_ (for the stepper's completed nodes) from it. Reuse GoalWizard's advance/back/focus mechanics but compute the next step from answers rather than `currentIndex+1`. Keep the stepper labels high-level (e.g. "What is it", "Actionable?", "Organize") rather than one node per micro-question, so the indicator stays legible.

**Enum migration ordering.** In Postgres, `ALTER TYPE ... ADD VALUE` cannot be used in the same transaction that then uses the new value. Put the three `add value` statements as their own top-level statements at the start of 0003 (before any DML/columns that reference them). `supabase db push` runs statements individually; if applied via the SQL editor, run the enum adds first. Document this in the migration header.

**Standalone committed actions + Engage (5.3 note).** `fn_commit_action`'s `where project_id = new.project_id` never matches when `project_id` is null (`= NULL` is unknown), so standalone committed actions do not decommit each other — each is independent. That is GTD-correct (single-next-action is a per-project rule). Story 5.3 (Engage) should: show committed actions across active projects AND standalone committed/available actions under an "Anytime / No project" group; EXCLUDE `waiting` actions and future-dated `scheduled_for` actions from the "do now" list. This is a note for 5.3, not built here.

**Golden example — standalone action insert (POST /api/actions):**

```ts
const row: ActionInsert = {
  user_id: userId,
  project_id: patch.project_id ?? null, // standalone by default
  text: patch.text,
  status: patch.status ?? "available", // "waiting" for delegate
  delegated_to: patch.delegated_to ?? null,
  scheduled_for: patch.scheduled_for ?? null,
};
```

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: clean (schema.ts nullable project_id + new fields typecheck across all consumers).
- `npm run lint` -- expected: clean (watch `react-hooks/set-state-in-effect` and `react-hooks/purity` in the wizard).
- `npm test -- --run` -- expected: ALL new tests pass and are executed — `sanitizeInboxProcess`, `sanitizeActionCreate`, `sanitizeProjectPatch` (goal_id), the inbox PATCH / actions POST / projects PATCH route tests, and the ClarifyWizard component test. Every I/O matrix row covered by an executed test.
- `npm run build` -- expected: succeeds; `/app/inbox/[id]`, `/api/actions` registered.

**Manual checks (DB migration):**

- Apply `0003` to a scratch DB (or `supabase db push`): confirm `\d actions` shows `project_id` nullable + `delegated_to`/`scheduled_for`; `\dT+ action_status` and `inbox_processing_status` show the new values; existing rows intact.
- Run the wizard end-to-end for each branch and confirm the resulting rows.

## Suggested Review Order

**Data model foundation (highest leverage)**

- Entry point: the migration that makes standalone actions + GTD outcomes representable.
  [`0003_gtd_clarify.sql:1`](../../supabase/migrations/0003_gtd_clarify.sql#L1)

- TS types updated in lockstep (nullable project_id, waiting, someday/reference, delegated_to, scheduled_for).
  [`schema.ts:31`](../../lib/supabase/schema.ts#L31)

**Security boundaries (review carefully)**

- Cross-owner guard: a supplied project_id must be owned by the user before an action links to it.
  [`route.ts:73`](../../app/api/actions/route.ts#L73)

- Inbox PATCH: ownership guard on resolved_project_id + unprocessed-only scope (no re-processing terminal items).
  [`route.ts:58`](../../app/api/inbox/[id]/route.ts#L58)

**Validators (pure)**

- Action-create rules: standalone default, waiting⇒delegated_to, calendar date, status set.
  [`create.ts:74`](../../lib/actions/create.ts#L74)

- Process rules: terminal status only; resolved_project_id only with `processed`.
  [`process.ts:57`](../../lib/inbox/process.ts#L57)

- Project PATCH now accepts goal_id (link/clear) — goal↔project linking.
  [`validate.ts:32`](../../lib/projects/validate.ts#L32)

**The clarify flow (UI)**

- Branching GTD wizard as a trail-based state machine; orphan-retry guard on create-then-process.
  [`ClarifyWizard.tsx:95`](../../components/inbox/clarify/ClarifyWizard.tsx#L95)

- Server page: loads the item (notFound if missing/terminal) + projects, renders the wizard.
  [`page.tsx:39`](../../app/app/inbox/[id]/page.tsx#L39)

- Multistep hand-off: project creator seeded from the inbox item, links it on create.
  [`NewProjectClient.tsx:1`](../../app/app/projects/new/NewProjectClient.tsx#L1)

**Tests (supporting)**

- Cross-owner rejection + standalone/waiting/calendar/assigned POST.
  [`route.test.ts:1`](../../app/api/actions/route.test.ts#L1)

- Terminal-guard + ownership + terminal statuses on inbox PATCH.
  [`route.test.ts:1`](../../app/api/inbox/[id]/route.test.ts#L1)

- Every wizard branch + orphan-retry single-POST behavior.
  [`ClarifyWizard.test.tsx:1`](../../components/inbox/clarify/ClarifyWizard.test.tsx#L1)
