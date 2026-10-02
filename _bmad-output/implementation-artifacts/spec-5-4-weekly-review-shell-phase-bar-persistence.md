---
title: "Weekly Review Shell, Phase Bar & Persistence"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 0
context: []
baseline_commit: "f3a7ccecaa129d68ae7d399fa9d916d62794060b"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/app/review` is a placeholder `<h1>`. There is no weekly review flow, no phase bar, and no persistence — a user cannot run a guided review or resume one after leaving.

**Approach:** Build the weekly review **shell**: a `/app/review` server page that resolves (or creates) the current ISO-week `review_sessions` row, renders the five-beat **phase bar** (Snapshot open → Get Clear → Get Current → Get Creative → Snapshot close, snapshot beats visually distinct as bookends), and drives phase navigation client-side. The current phase and any entered data persist to the `review_sessions` row on every transition, so leaving and returning restores position. Phases cannot be skipped; the review is not timed; each transition announces the new phase to screen readers. This story ships the shell + persistence + navigation with **placeholder phase panels** — the snapshot fields (5.5) and phase content (5.6) fill those panels next.

## Boundaries & Constraints

**Always:**

- One in-progress `review_sessions` row per user per ISO week (the table's `unique (user_id, week_number, week_year)` enforces it). The shell resolves the current week's row, creating it (`current_phase = 'snapshot_open'`, `started_at = now()`, week identity + Monday/Sunday dates) if none exists; a `completed_at`-set row for the current week is treated as done (offer to start is out of scope — just show "last review" state).
- Week identity = ISO week: `week_number` (1–53), `week_year`, `week_start_date` = Monday, `week_end_date` = Sunday. Compute in a pure, unit-tested helper.
- The phase bar shows exactly five beats in order: `snapshot_open` → `get_clear` → `get_current` → `get_creative` → `snapshot_close`. The two snapshot beats are visually distinct (narrower) as bookends. Active beat = `--color-step-active` (primary), completed = `--color-step-complete` (emerald), upcoming = `--color-step-upcoming` (gray).
- Phases advance forward only through the ordered list — **no skipping**. Back to a prior phase is allowed (to review/edit). Advancing persists the new `current_phase` to the row before rendering the next phase.
- Every phase transition announces the new phase name via an `aria-live="polite"` region.
- The review is **not timed** — no timer, no countdown, no time limit anywhere.
- Persistence: a new `PATCH /api/review/[id]` updates `current_phase` (and, in 5.5, snapshot fields). Mirror the established route convention (auth→401, JSON→400, validate→400, RLS+user scope, 404 on `!data`, 500 + console.error). Session creation via `POST /api/review` (idempotent for the current week: return the existing row if present).
- The last completed review's timestamp is visible on the review landing (from the most recent `completed_at` row).
- Placeholder phase panels: each of the five phases renders a titled placeholder that 5.5 (snapshot fields) and 5.6 (Get Clear/Current/Creative content) will replace. The advance gate for this story is permissive (always allowed) EXCEPT the no-skip ordering; 5.5/5.6 tighten the real gates.

**Ask First:**

- Any schema change (none needed — `review_sessions`/`weekly_snapshots` exist in 0001).
- Adding a date library (compute ISO week by hand; no dep).

**Never:**

- Do NOT implement the snapshot field content/validation (Story 5.5) or the Get Clear/Current/Creative phase content + completion gates (Story 5.6) — only the shell, phase bar, navigation, and persistence, with placeholders.
- Do NOT add a timer or any time pressure.
- Do NOT allow skipping forward past an unvisited phase.
- Do NOT write `weekly_snapshots` here (that is the 5.5 completion step).

## I/O & Edge-Case Matrix

| Scenario                  | Input / State                                              | Expected Output / Behavior                                                                                      | Error Handling                    |
| ------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Start a new review        | no session for current ISO week                            | POST creates row (`snapshot_open`, week identity, Mon/Sun dates, started_at); shell renders phase 1             | 500 → inline error                |
| Resume in progress        | row exists, `current_phase='get_current'`, not completed   | shell opens at `get_current` with prior data restored                                                           | read fail → safe landing          |
| Advance a phase           | on `get_clear`, click Next                                 | PATCH `current_phase='get_current'`; phase bar marks get_clear complete (emerald), get_current active (primary) | 500 → inline error, stay on phase |
| Back a phase              | on `get_current`, click Back                               | move to `get_clear` (no persistence needed beyond current_phase); no data loss                                  | N/A                               |
| Attempt skip              | try to jump to `snapshot_close` from `get_clear`           | blocked — cannot advance past the next ordered phase                                                            | N/A                               |
| Phase transition announce | any transition                                             | new phase name announced via aria-live polite region                                                            | N/A                               |
| Not timed                 | any duration                                               | no timer/countdown rendered                                                                                     | N/A                               |
| Completed week            | current-week row has `completed_at`                        | landing shows "last review completed [date]"; does not auto-reopen                                              | N/A                               |
| ISO week boundary         | date is a Sunday / a Jan 1 in ISO week 52/53 of prior year | week_number/week_year/Mon/Sun computed correctly (pure helper, unit-tested)                                     | N/A                               |

</frozen-after-approval>

## Code Map

- `app/app/review/page.tsx` -- REPLACE placeholder. NEW server component: resolve the current ISO week; load the user's current-week `review_sessions` row (RLS-scoped) + the most recent completed row's `completed_at` for the "last review" line. If no current-week row, render a "Start weekly review" entry that POSTs to create one (or create lazily on first load — see Design Notes). Pass the session (or null) + last-completed date to the client shell. try/catch → safe landing.
- `lib/review/week.ts` (+ `.test.ts`) -- NEW pure helpers: `isoWeek(date) → { week_number, week_year }` and `weekBounds(date) → { monday: 'YYYY-MM-DD', sunday: 'YYYY-MM-DD' }`. Unit-test boundaries (Sunday, year-end ISO weeks). No date lib.
- `lib/review/phases.ts` (+ `.test.ts`) -- NEW: the ordered phase list `['snapshot_open','get_clear','get_current','get_creative','snapshot_close']`, labels, `nextPhase`/`prevPhase`/`isBookend` helpers, and `phaseIndex`. Pure, unit-tested. `ReviewPhase` type comes from schema.
- `components/review/PhaseBar.tsx` -- NEW presentational: five beats in order; snapshot beats narrower (bookends); active=step-active, completed=step-complete, upcoming=step-upcoming; accessible labels ("Phase 2 of 5: Get Clear, current"); `<nav aria-label="Weekly review progress">`. Do NOT reuse WizardStepper (different visual: 5 beats, narrower bookends) — but mirror its accessibility idiom (per-node aria-label, aria-current).
- `components/review/ReviewShell.tsx` -- NEW `"use client"`. Owns `current_phase` state (seeded from the session), renders PhaseBar + the active phase's placeholder panel + Back/Next, an `aria-live="polite"` region announcing the phase name on change, and inline `role="alert"` errors. Next persists via `PATCH /api/review/[id]` then advances; Back moves locally (persist current_phase too for resume fidelity). No-skip enforced by only ever moving to `nextPhase`/`prevPhase`. Not timed.
- `components/review/phase-panels/*` -- NEW placeholder panels (one per phase) with a heading + "coming in Story 5.5/5.6" note. Structured so 5.5/5.6 replace the bodies without touching the shell.
- `app/api/review/route.ts` -- NEW `POST`: create-or-return the current-week session for the user (idempotent — if a current-week row exists, return it; else insert with computed week identity + dates). Returns `{ id, current_phase }`.
- `app/api/review/[id]/route.ts` -- NEW `PATCH`: update `current_phase` (validated against the phase enum) for an owned session; 404 if not owned. (5.5 extends this to accept snapshot fields.)
- `lib/review/validate.ts` (+ `.test.ts`) -- NEW `sanitizeReviewPatch(body)`: currently just a valid `current_phase`. Pure, unit-tested. (5.5 extends.)
- `lib/supabase/schema.ts` -- REUSE `ReviewSession*` types + `ReviewPhase`.
- `app/app/goals/page.tsx` / `app/api/actions/[id]/commit/route.ts` -- REFERENCE for loader try/catch and route convention.

## Tasks & Acceptance

**Execution:**

- [x] `lib/review/week.ts` (+ `.test.ts`) -- ISO week number/year + Monday/Sunday bounds, pure; unit-test Sunday and year-boundary cases.
- [x] `lib/review/phases.ts` (+ `.test.ts`) -- ordered phases, labels, next/prev/index/isBookend; unit-test ordering + bookend flags + no-next-past-last.
- [x] `lib/review/validate.ts` (+ `.test.ts`) -- `sanitizeReviewPatch` accepting a valid `current_phase`; reject unknown; unit-test.
- [x] `app/api/review/route.ts` (+ `route.test.ts`) -- `POST` create-or-return current-week session (idempotent); 401/500; returns `{ id, current_phase }`. Test: creates when none, returns existing when present, 401 unauth.
- [x] `app/api/review/[id]/route.ts` (+ `route.test.ts`) -- `PATCH` current_phase, RLS+user scoped, 404 on `!data`, 401/400/500. Test: valid transition persists, invalid phase 400, non-owned 404, user-scope asserted.
- [x] `components/review/PhaseBar.tsx` -- five-beat bar, narrower snapshot bookends, active/complete/upcoming token colors, accessible per-beat labels + aria-current.
- [x] `components/review/ReviewShell.tsx` (+ `.test.tsx`) -- phase state from session; Back/Next (no-skip); PATCH-on-advance + `router.refresh()`; aria-live phase announcement; inline error; not timed. Test: renders active phase, Next persists + advances the bar, Back moves without skipping, cannot skip forward, announces phase.
- [x] `components/review/phase-panels/*.tsx` -- five placeholder panels (heading + note); wired by ReviewShell per phase.
- [x] `app/app/review/page.tsx` -- REPLACE placeholder: resolve current-week session (create-on-start or a Start control), load last-completed timestamp, render ReviewShell (or the start/landing state). Keep `metadata`. try/catch → safe landing. (Add `page.test.tsx` mirroring the goals loader test: renders shell for an in-progress session; shows last-review line.)

**Acceptance Criteria:**

- Given I start a weekly review, when the shell loads, then a phase bar shows five beats (Snapshot open → Get Clear → Get Current → Get Creative → Snapshot close) with the two snapshot beats visually distinct as bookends; the active beat fills primary, completed beats emerald, upcoming gray; and I cannot skip a phase.
- Given a review in progress, when I leave mid-review and return, then my phase position (and entered data, once 5.5/5.6 add fields) is restored — a `review_sessions` row is created at start and updated on each transition.
- Given the review is not timed, when I take as long as I need, then no timer or time limit is imposed.
- Given a phase transition, when it occurs, then the new phase name is announced to screen readers via a polite live region.
- Given a completed current-week review, when I open Review, then the landing shows the last completed review's date and does not silently reopen it.

## Spec Change Log

### 2026-09-28 — review loop (patch, no re-derivation)

- **Triggering findings:** (1) `POST /api/review` did read-then-insert with no unique-violation recovery, so two concurrent Start clicks could 500 the loser instead of honoring the documented idempotency. (2) `PATCH /api/review/[id]` had no `completed_at` guard, so a completed review could be silently reopened by rewinding its phase. (3) `ReviewShell` called `router.refresh()` after each phase change, which re-seeds the server component with a new `initialPhase` that `useState` ignores — a needless flicker/divergence risk since the shell owns phase state locally.
- **Amended (code patches):** POST now catches the Postgres unique violation (`23505`), re-reads, and returns the raced row (true idempotency). PATCH scopes the update to `completed_at IS NULL` (a completed session → 404, cannot be reopened). ReviewShell no longer calls `router.refresh()` on phase change (persist-only; the client owns the phase; resume reads the persisted value on a fresh load). Added tests: POST race-recovery, PATCH completed-guard (+ asserts the `.is("completed_at", null)` scope), and updated the shell test to assert no refresh on advance.
- **Known-bad state avoided:** Idempotency violated under concurrency (spurious 500); a completed review reopened via direct PATCH; phase-state divergence/flicker from an unnecessary refresh.
- **KEEP:** The pure ISO-week helper (Thursday-shift algorithm, UTC-based) and phase helpers (no-skip via next/prev only); the PhaseBar's five-beat + narrower-bookend design and accessibility labels; the live-region announcement rendered from state (no setState-in-effect). Timezone-correct week identity and focus-on-phase-change are DEFERRED (ledgered), not fixed here.

## Design Notes

**Session creation timing.** Two options: (a) create lazily when the page first loads with no current-week row, or (b) show a "Start weekly review" button that POSTs. Prefer (b) — an explicit start avoids creating empty sessions every time a user glances at the page, and it gives a clean landing that also shows the last-review timestamp. The shell renders only once a session exists.

**Phase bar is NOT WizardStepper.** The generic stepper renders equal circles; the phase bar needs five segments with the two snapshot beats visually narrower (bookends) and segment-style fills. Build a dedicated `PhaseBar`, but copy WizardStepper's accessibility contract (per-node `aria-label` with "Phase N of 5: <label>, <status>", `aria-current="step"` on the active beat) so status is conveyed without color.

**No-skip via next/prev only.** The shell never sets an arbitrary phase; it only moves to `nextPhase(current)` or `prevPhase(current)`. Forward jumps are impossible by construction, satisfying "cannot skip a phase" without gate bookkeeping. Real per-phase completion gates arrive with 5.6.

**Persistence contract.** `current_phase` is persisted on every advance (and on back, to keep resume exact). 5.5 will extend `PATCH /api/review/[id]` + `sanitizeReviewPatch` to also persist `opening_retrospective` / `closing_intention` / `closing_blocker`; keep the validator open for that extension.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: clean.
- `npm run lint` -- expected: clean (watch react-hooks rules in ReviewShell; announce via a rendered live region, not a setState-in-effect).
- `npm test -- --run` -- expected: ALL new tests pass and are executed — `week`, `phases`, `validate` unit tests; `POST /api/review` + `PATCH /api/review/[id]` route tests; `ReviewShell` component test; the review page loader test. Every I/O matrix row covered.
- `npm run build` -- expected: succeeds; `/app/review`, `/api/review`, `/api/review/[id]` registered.

**Manual checks:**

- Start a review → phase bar shows five beats, snapshot beats narrower; advance through phases (emerald trail); leave and return → resumes at the same phase; no timer anywhere; a completed week shows the last-review date on the landing.

## Suggested Review Order

**Pure foundations**

- ISO-week identity (Thursday-shift, UTC) + Monday/Sunday bounds.
  [`week.ts:56`](../../lib/review/week.ts#L56)

- Ordered phases + no-skip next/prev + bookend flags.
  [`phases.ts:34`](../../lib/review/phases.ts#L34)

**Persistence (security-relevant guards)**

- POST: idempotent create-or-return + unique-violation race recovery.
  [`route.ts:36`](../../app/api/review/route.ts#L36)

- PATCH: phase persist, scoped to owner AND not-completed (no reopen).
  [`route.ts:60`](../../app/api/review/[id]/route.ts#L60)

- Phase validator (open for 5.5 to extend with snapshot fields).
  [`validate.ts:20`](../../lib/review/validate.ts#L20)

**Shell & bar**

- The shell: no-skip navigation, persist-then-advance, live-region announce, not timed.
  [`ReviewShell.tsx:47`](../../components/review/ReviewShell.tsx#L47)

- Five-beat bar with narrower snapshot bookends + accessible labels.
  [`PhaseBar.tsx:1`](../../components/review/PhaseBar.tsx#L1)

- Server page: resolve current-week session + last-review line; Start control.
  [`page.tsx:1`](../../app/app/review/page.tsx#L1)

**Tests (supporting)**

- POST: create / idempotent / race-recovery / 401 / 500.
  [`route.test.ts:1`](../../app/api/review/route.test.ts#L1)

- PATCH: transition / invalid / not-owned-or-completed 404 / user-scope.
  [`route.test.ts:1`](../../app/api/review/[id]/route.test.ts#L1)

- Shell: five beats, advance, back, no-skip, announce, error, not-timed.
  [`ReviewShell.test.tsx:1`](../../components/review/ReviewShell.test.tsx#L1)
