---
title: "Weekly Review Phases — Get Clear, Get Current, Get Creative"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 0
context: []
baseline_commit: "4019be78a750be3f49477c45c2d09acd8d0ae749"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The three middle weekly-review phases (Get Clear, Get Current, Get Creative) are placeholder panels with permissive advance. There is no guided content and no completion gates, so the review does not actually drive the user to inbox-zero and no-stuck-projects.

**Approach:** Fill the three middle phase panels with guided, data-surfaced content and real advance gates, threaded through the existing `ReviewShell`. **Get Clear**: show the unprocessed inbox count, a brain-dump capture, and a link to process items; advance blocked until unprocessed count = 0. **Get Current**: surface each Active project (name, committed action or stuck band, last-updated) with per-project actions — confirm the committed action, commit a new one, or change status (Paused/Archived/Completed); cannot advance past a stuck project; advance blocked until every Active project is reviewed. **Get Creative**: review each Someday/Maybe inbox item (activate/delete/keep), capture "anything missing?", and show a goal-alignment summary across Active goals; advance (to the closing snapshot) allowed once seen. The overall completion gate (already enforced at `snapshot_close` completion, 5.5) is reinforced: block completion until all inbox items are processed and every Active project has a committed action or a changed status.

## Boundaries & Constraints

**Always:**

- Reuse the existing mutation routes — no new mutation endpoints EXCEPT the one small extension noted below. Commit: `POST /api/actions/[id]/commit`. Project status: `PATCH /api/projects/[id]` (`sanitizeProjectPatch`). Inbox capture: `POST /api/inbox`. Someday delete: `DELETE /api/inbox/[id]`.
- **Get Clear** reuses `InboxCaptureForm` (brain-dump) and links to `/app/inbox` for one-at-a-time processing (there is no embeddable inline clarify flow; do NOT build one here). The inbox-zero gate = count of `inbox_items` with `processing_status = 'unprocessed'` equals 0 (someday/reference/processed/trashed are already out of the inbox). The shell must refetch the count after returning (server data comes from the page loader; a "Refresh" affordance or router.refresh is acceptable).
- **Get Current** surfaces Active projects one at a time (name, the committed action text or the amber `StuckIndicator`, and last-updated date). Per project the user can: confirm (keep the committed action — no mutation), commit a different available action (`/commit`), or change status via `PATCH /api/projects/[id]`. **Project status options are the schema-valid set: Paused, Completed, Archived** (there is NO `someday` ProjectStatus — see Design Notes; the AC's "Someday" maps to Paused for a project). A project is "reviewed" once the user confirms/commits/changes-status for it. Cannot advance past a project that is still stuck (active + zero committed) AND not status-changed — `isProjectStuck` must be false OR its status changed this session.
- **Get Creative** lists Someday/Maybe items = `inbox_items` with `processing_status = 'someday'`. Each: **keep** (no-op), **delete** (`DELETE /api/inbox/[id]`), or **activate** (move back to `unprocessed` so it re-enters the inbox). Also a "anything missing?" capture (reuse `InboxCaptureForm`) and a read-only goal-alignment summary (Active goals with project/stuck counts, derived like the goals list). Get Creative may advance to `snapshot_close` once rendered (its hard gate is the closing snapshot itself, enforced in 5.5).
- **Activate extension (the one allowed new server behavior):** extend `sanitizeInboxProcess` + `PATCH /api/inbox/[id]` to accept `processing_status = 'unprocessed'` (clearing `processed_at`, `resolved_project_id`) so a someday item can be reactivated. Drop the route's `.eq('processing_status','unprocessed')` guard ONLY for this reactivation path, or scope it so an owned `someday`/`reference` item can move to `unprocessed`. Keep the terminal-status behavior intact for the clarify flow. Unit-test the new branch.
- **Advance gates** are added to the shell per middle phase: `getClearGateBlocks` (unprocessed count > 0), `getCurrentGateBlocks` (an unreviewed or still-stuck active project remains). Get Creative has no forward gate (the closing snapshot gate lives in 5.5). Keep the 5.4/5.5 gates (opening retrospective, closing fields) intact.
- **"Reviewed / changed status" tracking** is CLIENT-SIDE per session (a Set of project ids the user acted on), since there is no durable per-project review-state store and `sanitizeReviewPatch` won't persist one. Document that this resets if the user leaves mid-Get-Current (they re-review — acceptable, and safe: the gate errs toward more review, never less).
- Middle panels become props-driven (like the snapshot panels): `loadReviewLanding` (or a dedicated review-data loader) supplies the inbox count, Active projects (name, committed action, available actions, updated_at, stuck), someday items, and Active goals (with counts) to `ReviewShell`, which passes them to the panels.
- Not timed; no-skip preserved; phase announcements preserved; honest copy, no confetti.

**Ask First:**

- Any schema change (none — reuse existing tables; the activate path uses existing columns).
- Building an embeddable inline clarify flow for Get Clear (out of scope — link to /app/inbox instead).
- Persisting per-project review state to the DB (out of scope — client-side session tracking).

**Never:**

- Do NOT add a `someday` ProjectStatus or otherwise change the projects enum.
- Do NOT re-implement the clarify wizard inline; Get Clear links to /app/inbox.
- Do NOT change the snapshot phases (5.5) or the phase bar / navigation model (5.4).
- Do NOT block Get Creative advance on anything (the closing snapshot is the gate, in 5.5).

## I/O & Edge-Case Matrix

| Scenario                                   | Input / State                                  | Expected Output / Behavior                                                                                         | Error Handling     |
| ------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------ |
| Get Clear, inbox not empty                 | N unprocessed items                            | shows count + brain-dump capture + "Process inbox" link to /app/inbox; advance blocked                             | inline hint        |
| Get Clear, inbox zero                      | 0 unprocessed                                  | "Inbox zero." affordance; advance enabled                                                                          | N/A                |
| Get Clear brain-dump                       | type + capture                                 | POST /api/inbox; count refetches                                                                                   | 500 → inline error |
| Get Current, active project with committed | project + committed action                     | shows name, committed action text, updated date; "Confirm" marks reviewed                                          | N/A                |
| Get Current, stuck project                 | active, zero committed                         | amber StuckIndicator; commit an available action OR change status to advance; cannot advance while stuck+unchanged | inline block       |
| Get Current, commit new                    | pick available action                          | POST /commit; project reviewed; not stuck                                                                          | 500 → inline error |
| Get Current, change status                 | choose Paused/Completed/Archived               | PATCH /api/projects/[id]; project reviewed (no longer active → not blocking)                                       | 500 → inline error |
| Get Current complete                       | all active projects reviewed                   | advance to Get Creative enabled                                                                                    | N/A                |
| Get Creative, someday item keep            | leave as someday                               | no mutation                                                                                                        | N/A                |
| Get Creative, someday delete               | delete                                         | DELETE /api/inbox/[id]; item removed                                                                               | 500 → inline error |
| Get Creative, someday activate             | activate                                       | PATCH /api/inbox/[id] status=unprocessed (clears processed_at/resolved_project_id); re-enters inbox                | 500 → inline error |
| Get Creative, anything missing             | capture                                        | POST /api/inbox                                                                                                    | 500 → inline error |
| Get Creative goal alignment                | active goals                                   | read-only list: goal text + project count + stuck count                                                            | N/A                |
| Completion gate                            | inbox not zero OR an active project unreviewed | Complete (5.5) blocked with a clear reason                                                                         | inline             |

</frozen-after-approval>

## Code Map

- `app/app/review/page.tsx` -- EXTEND `loadReviewLanding` to also load the review-data the middle phases need (only when a resumable session exists): unprocessed inbox count; Active projects with `id, name, status, updated_at` + their actions (`id, project_id, text, status`) to derive committed/available/stuck (mirror `loadEngageModel`, but ADD `updated_at` to the projects select); Someday inbox items (`inbox_items` where `processing_status='someday'`); Active goals with project/stuck counts (mirror `loadGoals`). Pass a `reviewData` prop to `ReviewShell`.
- `lib/review/reviewData.ts` (+ `.test.ts`) -- NEW pure builder `buildReviewData(inbox, projects, actions, goals, someday)` → `{ unprocessedCount, currentProjects: [{id,name,updatedAt,committedAction|null,availableActions,isStuck}], somedayItems, goalAlignment: [{id,goalText,projectCount,stuckCount}] }`. Reuse `isProjectStuck`/`countStuckProjects`. Unit-test.
- `components/review/ReviewShell.tsx` -- EXTEND. Accept `reviewData`. Add client-session tracking: `reviewedProjectIds: Set<string>` (a project is reviewed when confirmed/committed/status-changed). Add per-phase gates: `getClearGateBlocks = phase==='get_clear' && unprocessedCount > 0`; `getCurrentGateBlocks = phase==='get_current' && some active project not (reviewed || !isStuck-and-active-changed)`. Extend the Next disabled + `handleNext` guards with these (keep opening/closing gates). Render the three middle panels with props (replace the static `MIDDLE_PHASE_PANELS[phase]` for these phases). After a mutation, refetch via `router.refresh()` (the page re-seeds reviewData); keep the render-time seed-reset pattern for reviewData if needed.
- `components/review/phase-panels/GetClearPanel.tsx` -- NEW `"use client"`. Unprocessed count, brain-dump `InboxCaptureForm`, "Process inbox" link to `/app/inbox`, inbox-zero affordance.
- `components/review/phase-panels/GetCurrentPanel.tsx` -- NEW `"use client"`. One active project at a time (or a list): name, committed action or `StuckIndicator`, last-updated; controls to confirm / commit an available action (`/commit`) / change status (`PATCH /api/projects/[id]`). Marks the project reviewed via a shell callback. Uses `router.refresh()` after mutations.
- `components/review/phase-panels/GetCreativePanel.tsx` -- NEW `"use client"`. Someday items with keep/delete/activate; "anything missing?" capture; read-only goal-alignment summary.
- `components/review/phase-panels/index.tsx` -- keep for any remaining static bits; the three middle panels are now rendered by the shell with props (like the snapshot panels).
- `lib/inbox/process.ts` + `app/api/inbox/[id]/route.ts` -- EXTEND for the ACTIVATE path: `sanitizeInboxProcess` accepts `unprocessed` (and when reactivating, clears `processed_at`/`resolved_project_id`); the PATCH route allows moving an owned `someday`/`reference` item to `unprocessed`. Add tests. Keep the existing terminal-status + unprocessed-only-source behavior for the clarify flow.
- `lib/goals/stuck.ts`, `lib/engage/model.ts`, `app/app/goals/page.tsx` -- REFERENCE patterns for stuck + project/goal aggregation.
- `components/projects/StuckIndicator.tsx`, `ProjectStatusSelect.tsx` -- REUSE.
- `app/api/actions/[id]/commit/route.ts`, `app/api/projects/[id]/route.ts` -- REUSE (no change).

## Tasks & Acceptance

**Execution:**

- [x] `lib/review/reviewData.ts` (+ `.test.ts`) -- pure `buildReviewData`: unprocessed count, current active projects (committed/available/stuck/updatedAt), someday items, goal-alignment. Unit-test each shape + stuck/empty cases.
- [x] `lib/inbox/process.ts` (+ test) -- extend `sanitizeInboxProcess` to accept `unprocessed` (reactivate) and signal clearing `processed_at`/`resolved_project_id`. Unit-test the activate branch + that terminal statuses still work.
- [x] `app/api/inbox/[id]/route.ts` (+ test) -- allow an owned `someday`/`reference` item → `unprocessed` (activate), clearing `processed_at`/`resolved_project_id`; keep terminal-status behavior + ownership guard. Test activate + that a non-owned/unknown id 404s.
- [x] `app/app/review/page.tsx` (+ test) -- extend loader with the review data (guarded to resumable sessions), pass `reviewData` to `ReviewShell`; keep landing behavior.
- [x] `components/review/phase-panels/GetClearPanel.tsx` -- count + brain-dump + process link + inbox-zero.
- [x] `components/review/phase-panels/GetCurrentPanel.tsx` -- per-project review (confirm/commit/status), stuck block, reviewed callback.
- [x] `components/review/phase-panels/GetCreativePanel.tsx` -- someday keep/delete/activate + anything-missing capture + goal-alignment summary.
- [x] `components/review/ReviewShell.tsx` (+ test) -- thread `reviewData`, add client reviewed-project tracking + the two middle-phase gates, render the three panels with props, keep no-skip/not-timed/announce and the 5.4/5.5 gates. Test: Get Clear blocks until inbox zero; Get Current blocks past a stuck/unreviewed project and enables when all reviewed; Get Creative advances freely; mutations fire the right routes.

**Acceptance Criteria:**

- Given Get Clear, when it runs, then it offers a brain-dump capture and a way to process the inbox, and the phase cannot advance until the unprocessed inbox count reaches zero.
- Given Get Current, when it runs, then each Active project surfaces its name, committed action (or stuck indicator), and last-updated date; for each I confirm, commit a new action, or change status; I cannot advance past a stuck project; and the phase completes when all Active projects are reviewed.
- Given Get Creative, when it runs, then I can review each Someday/Maybe item (activate/delete/keep), capture "anything missing?" to the inbox, and see a goal-alignment summary across Active goals.
- Given the completion gate, when I attempt to finish, then completion is blocked until all inbox items are processed and every Active project has a committed action or a changed status.

## Spec Change Log

### 2026-09-28 — review loop (patch, no re-derivation)

- **Triggering findings:** (1) **Completion-gate hole (all three layers):** Get Creative can re-inject `unprocessed` inbox items (the "anything missing?" capture and someday **Activate**) AFTER the Get Clear gate passed, but the completion action only validated the closing fields — so a review could finish with a non-empty inbox, violating the AC ("completion blocked until all inbox items are processed and every active project has a committed action or a changed status"). (2) `GetCurrentPanel`'s single `busyId` disabled EVERY project's controls during one mutation. (3) Per-project controls (Confirm / commit / Pause-Complete-Archive) had identical accessible names, indistinguishable to assistive tech. (4) Missing executed coverage for change-status, Confirm, someday delete, and the loader→buildReviewData integration.
- **Amended (code patches):** Added a client-side **completion gate** in `ReviewShell.handleComplete` — blocks completion (with a specific reason) when `unprocessedCount > 0` OR any active project is stuck-and-unreviewed, reusing the same `anyProjectUnresolved` rule as the Get Current gate. Scoped `GetCurrentPanel` `disabled` to the in-flight project only. Added per-project `aria-label`s to the Confirm / commit / status buttons. Added tests: completion blocked on non-empty inbox, completion blocked on unresolved stuck project, change-status PATCH + gate clear, Confirm (no-mutation) marks reviewed, someday delete DELETE, and a loader-integration test driving `buildReviewData` with real rows through the page.
- **Known-bad state avoided:** Finishing a "weekly review" with a dirty inbox (the invariant the whole flow exists to enforce); a frozen project list during any single mutation; screen-reader-ambiguous per-project actions.
- **KEEP:** The pure `buildReviewData`; the reactivate PATCH (source-scoped to someday/reference, clears processed_at/resolved_project_id); client-side `reviewedProjectIds` session tracking; Get Clear links out to /app/inbox; Paused (not a non-existent "someday") as the project set-aside. Server-side re-enforcement of the completion gate is DEFERRED (ledgered) — the client gate is the primary guard, consistent with the app's client-gate + server-validate posture.

## Design Notes

**"someday" is not a project status.** The projects enum is `active|paused|completed|archived`. The AC lists "Paused/Someday/Archived" for Get Current, but a project cannot be "someday". Get Current offers the schema-valid set (Paused / Completed / Archived); Paused is the closest analogue to "set aside" for a project. (Someday/Maybe lives at the inbox-item and goal level, not the project level.) This is a deliberate, spec-recorded deviation from the AC wording, forced by the data model.

**Get Clear processing links out.** There is no embeddable inline one-at-a-time clarify component; `ClarifyWizard` is a full-page navigate-away flow. Get Clear therefore surfaces the count + brain-dump capture and links to `/app/inbox` (where the user processes items via the existing clarify flow), then returns. The gate reads the server-loaded unprocessed count; a `router.refresh()` / "Recount" affordance updates it after processing. Building an in-shell processor is explicitly out of scope.

**"Changed status" is client-side session state.** There is no durable per-project review-state store, and `projects.updated_at` bumps on ANY edit (and committing an action doesn't touch the project row at all), so it can't cleanly signal "status changed this review". The shell tracks a `Set<projectId>` of projects the user confirmed/committed/status-changed this session. It is not persisted, so leaving mid-Get-Current resets it — the user re-reviews, which errs toward MORE review (safe). The overall completion gate combines the reloaded committed-action state with this client Set.

**Activate path.** Reactivating a someday item (someday → unprocessed) is the one new server behavior. It reuses the existing PATCH route + `sanitizeInboxProcess`, adding `unprocessed` as an accepted target that also clears `processed_at`/`resolved_project_id`. The clarify flow's terminal-only, source-must-be-unprocessed behavior is preserved for its path; this adds a distinct reactivation transition.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: clean.
- `npm run lint` -- expected: clean (watch react-hooks rules in the panels/shell; use render-time seeding, not setState-in-effect).
- `npm test -- --run` -- expected: ALL new/updated tests pass and are executed — `buildReviewData` unit tests, the inbox activate route + sanitizer tests, and the shell/panel tests (Get Clear inbox-zero gate, Get Current stuck/reviewed gate + mutations, Get Creative keep/delete/activate + capture + alignment). Every I/O matrix row covered.
- `npm run build` -- expected: succeeds.

**Manual checks:**

- Run a review: Get Clear won't advance with unprocessed items; process them (via the link) → advance enabled. Get Current shows each active project; a stuck one blocks advance until you commit or change status; all reviewed → advance. Get Creative lets you keep/delete/activate someday items, capture missing thoughts, and see active-goal alignment; advance to the closing snapshot; completion blocked until inbox zero + all active projects handled.

## Suggested Review Order

**The gates (design intent)**

- The shell: Get Clear / Get Current gates + the completion gate reusing `anyProjectUnresolved`.
  [`ReviewShell.tsx:100`](../../components/review/ReviewShell.tsx#L100)

- Pure builder: unprocessed count, current projects (committed/available/stuck), someday, goal alignment.
  [`reviewData.ts:105`](../../lib/review/reviewData.ts#L105)

**The panels**

- Get Current: per-project confirm / commit / status; per-project busy + aria-labels.
  [`GetCurrentPanel.tsx:60`](../../components/review/phase-panels/GetCurrentPanel.tsx#L60)

- Get Creative: someday activate/delete + capture + goal alignment.
  [`GetCreativePanel.tsx:1`](../../components/review/phase-panels/GetCreativePanel.tsx#L1)

- Get Clear: count + brain-dump + process link.
  [`GetClearPanel.tsx:1`](../../components/review/phase-panels/GetClearPanel.tsx#L1)

**Server + loader**

- Reactivate transition (someday/reference → unprocessed) + its source-scope + ownership guards.
  [`route.ts:31`](../../app/api/inbox/[id]/route.ts#L31)

- Loader builds reviewData only for a resumable session.
  [`page.tsx:130`](../../app/app/review/page.tsx#L130)

**Tests (supporting)**

- Shell: gates, completion block, commit/status/confirm, activate/delete.
  [`ReviewShell.test.tsx:1`](../../components/review/ReviewShell.test.tsx#L1)

- Builder matrix + reactivate route + loader integration.
  [`reviewData.test.ts:1`](../../lib/review/reviewData.test.ts#L1)
