---
title: "Weekly Snapshot — Opening & Closing (Closed Loop)"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 0
context: []
baseline_commit: "9503f374d1027f23242eb6e5b69ee080ced69745"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The weekly review shell (5.4) renders placeholder snapshot panels. There is no opening retrospective, no closing intention/blocker, and no way to complete a review — so the week-over-week "closed loop" (last week's closing snapshot becoming next week's opening context) does not exist.

**Approach:** Fill the two snapshot bookend phases. The **opening** snapshot (`snapshot_open`) shows the auto-calculated "Week N · Mon dd – Sun dd" header, displays the prior week's closing snapshot read-only under "Last week you said:", and requires a non-empty "What actually moved last week? What didn't?" before advancing. The **closing** snapshot (`snapshot_close`) requires two `aria-required` fields — intention and blocker — with inline validation. Completing writes an immutable `weekly_snapshots` row + marks the `review_sessions` row complete, then returns to Engage. Snapshot field values persist to the session as the user types/advances (extending the 5.4 PATCH), so a resumed review restores them.

## Boundaries & Constraints

**Always:**

- Opening header shows "Week {week_number} · {Mon dd} – {Sun dd}" computed from the session's `week_start_date`/`week_end_date` (already stored). Format dates without timezone drift.
- "Last week you said:" shows the PRIOR week's `weekly_snapshots` row (its `intention` + `blocker`, and optionally its `opening_retrospective`) read-only. If no prior snapshot exists, show a gentle "No prior snapshot yet." — never fabricate.
- Opening advance gate: the `snapshot_open` → `get_clear` transition is blocked until `opening_retrospective` is non-empty (trimmed). This tightens the 5.4 permissive gate for this phase only.
- Closing fields: "What matters most this coming week?" (`closing_intention`) and "What's the main thing that could derail it?" (`closing_blocker`). Both `aria-required`; empty (trimmed) blocks completion with inline validation messages.
- Snapshot field values persist to `review_sessions` (`opening_retrospective`, `closing_intention`, `closing_blocker`) via the extended `PATCH /api/review/[id]` (extend `sanitizeReviewPatch`), so leaving mid-review restores them (5.4's persistence contract, now carrying the fields).
- Completion writes an IMMUTABLE `weekly_snapshots` row (`review_session_id`, week identity, `intention`, `blocker`, `opening_retrospective`) AND marks the session `completed_at = now()`, `current_phase = 'complete'`. These two writes happen in one server route so a completed review always has its snapshot. On success, navigate to `/app/engage`.
- After completion the review landing shows "Last review: {date}" (the loader already surfaces `lastCompletedAt` — ensure it reflects the just-completed review).
- Copy stays honest and brief per DESIGN/EXPERIENCE ("This isn't a report — it's a reality check"). No confetti.
- Reuse the 5.4 shell/phase-bar/navigation and the established route + validator conventions. Extend, don't fork.

**Ask First:**

- Any schema change (none — `review_sessions`/`weekly_snapshots` exist in 0001).
- Making the two completion writes a DB transaction/RPC vs. sequential-with-guard (the existing app pattern is sequential; a single route keeps them together — flag if true atomicity is required).

**Never:**

- Do NOT implement the Get Clear/Current/Creative phase CONTENT or their completion gates (Story 5.6) — this story only fills the two snapshot phases + the completion write. The middle phases keep their 5.4 placeholders and permissive advance.
- Do NOT mutate a `weekly_snapshots` row after insert (immutable; the DB has no updated_at for it).
- Do NOT allow completion when either closing field is empty.
- Do NOT block the opening gate on anything except the retrospective being non-empty.

## I/O & Edge-Case Matrix

| Scenario              | Input / State                            | Expected Output / Behavior                                                                                         | Error Handling           |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| Opening header        | session with week identity               | "Week N · Mon dd – Sun dd" rendered                                                                                | N/A                      |
| Prior snapshot exists | prior week `weekly_snapshots` row        | shown read-only under "Last week you said:"                                                                        | N/A                      |
| No prior snapshot     | first-ever review                        | "No prior snapshot yet."                                                                                           | N/A                      |
| Opening gate unmet    | `opening_retrospective` empty/whitespace | "Start review →" disabled; cannot advance                                                                          | inline hint              |
| Opening gate met      | retrospective non-empty                  | PATCH persists it; advance to `get_clear`                                                                          | 500 → inline error       |
| Field persistence     | type retrospective, leave, return        | value restored from session                                                                                        | N/A                      |
| Closing fields empty  | either intention/blocker empty           | "Complete review" blocked; inline `aria-required` validation on the empty field(s)                                 | inline                   |
| Complete review       | both closing fields non-empty            | POST writes immutable `weekly_snapshots` + sets `completed_at`+`current_phase='complete'`; navigate to /app/engage | 500 → inline error, stay |
| Closed loop           | next week's opening                      | this week's closing intention/blocker appear as "Last week you said:"                                              | N/A                      |
| Resume completed      | current-week row completed               | landing shows "Last review: {date}"; no reopen (5.4)                                                               | N/A                      |

</frozen-after-approval>

## Code Map

- `components/review/phase-panels/index.tsx` -- REFACTOR from a static `Record<phase, ReactNode>` to a render approach that passes data + handlers to the snapshot panels. Extract `SnapshotOpenPanel` and `SnapshotClosePanel` into their own files; keep the middle three as placeholders. `ReviewShell` supplies the props.
- `components/review/phase-panels/SnapshotOpenPanel.tsx` -- NEW `"use client"`. Header "Week N · Mon dd – Sun dd"; "Last week you said:" read-only block (prior snapshot or "No prior snapshot yet."); a textarea for `opening_retrospective` (controlled, persisted on change/blur via the shell); the shell's advance is gated on non-empty.
- `components/review/phase-panels/SnapshotClosePanel.tsx` -- NEW `"use client"`. Two `aria-required` textareas (`closing_intention`, `closing_blocker`) with inline validation; a "Complete review" action (enabled only when both non-empty) that calls the completion route.
- `components/review/ReviewShell.tsx` -- EXTEND. Hold snapshot field state (seeded from the session), persist via `PATCH /api/review/[id]` (now accepting the fields). Gate `snapshot_open` advance on non-empty retrospective. On `snapshot_close`, render the complete action instead of a Next that just navigates phases; wire it to the completion route, then `router.push('/app/engage')`. Keep no-skip + not-timed + live-region announce.
- `lib/review/validate.ts` -- EXTEND `sanitizeReviewPatch` to also accept `opening_retrospective`, `closing_intention`, `closing_blocker` (string, trimmed, bounded length e.g. ≤ 2000; empty string allowed for in-progress saves — the GATES enforce non-empty at advance/complete, not the persistence validator). Update its unit test.
- `app/api/review/[id]/route.ts` -- PATCH already flows the validator through; no shape change, just the extended fields. Add tests for persisting the snapshot fields.
- `app/api/review/[id]/complete/route.ts` -- NEW `POST`: for an owned, not-yet-completed session, (1) read the session (week identity, opening_retrospective) — require both closing fields present in the body (validate), (2) INSERT the immutable `weekly_snapshots` row, (3) UPDATE the session `completed_at=now()`, `current_phase='complete'`. Return `{ id }`. 400 if closing fields missing; 404 if not owned / already completed; 500 on db error (if the snapshot insert succeeds but the session update fails, still 500 — see Design Notes). Mirror the route convention.
- `lib/review/complete.ts` (+ `.test.ts`) -- NEW pure `sanitizeReviewComplete(body)`: require non-empty `intention` + `blocker` (trimmed, bounded); return `{ intention, blocker }` or null. Unit-test.
- `app/app/review/page.tsx` -- EXTEND `loadReviewLanding` (or a resume loader) to ALSO load the prior week's `weekly_snapshots` row + the current session's saved snapshot field values, and pass them to `ReviewShell`. Keep the completed-landing + last-review behavior.
- `lib/review/week.ts` -- REUSE for prior-week identity (compute the ISO week of (this week's Monday − 7 days)) to fetch the prior snapshot.
- `lib/supabase/schema.ts` -- REUSE `WeeklySnapshot*`, `ReviewSession*`.
- `components/review/ReviewShell.test.tsx` / `app/app/review/page.test.tsx` -- EXTEND for the new gates + completion.

## Tasks & Acceptance

**Execution:**

- [x] `lib/review/validate.ts` (+ test) -- extend `sanitizeReviewPatch` to accept the three snapshot text fields (bounded; empty allowed for in-progress persistence).
- [x] `lib/review/complete.ts` (+ `.test.ts`) -- `sanitizeReviewComplete`: non-empty trimmed `intention` + `blocker`; reject empties/non-strings.
- [x] `app/api/review/[id]/complete/route.ts` (+ `route.test.ts`) -- POST: owned + not-completed session → INSERT `weekly_snapshots` (week identity from the session, opening_retrospective from the session, intention/blocker from the body) → UPDATE session `completed_at`+`current_phase='complete'`. 400 missing fields, 404 not-owned/completed, 500 db, user-scoped. Test each.
- [x] `app/api/review/[id]/route.ts` (+ test additions) -- confirm PATCH persists the snapshot fields via the extended validator; test.
- [x] `components/review/phase-panels/SnapshotOpenPanel.tsx` -- header, prior-snapshot read-only block, retrospective textarea (controlled + persisted).
- [x] `components/review/phase-panels/SnapshotClosePanel.tsx` -- two aria-required textareas + inline validation + "Complete review".
- [x] `components/review/phase-panels/index.tsx` -- refactor to wire the two snapshot panels with props from the shell; middle three stay placeholders.
- [x] `components/review/ReviewShell.tsx` (+ test) -- snapshot field state seeded from session; persist on change/blur; gate `snapshot_open` advance on non-empty retrospective; on `snapshot_close` render + wire "Complete review" → completion route → `router.push('/app/engage')`; keep no-skip/not-timed/announce.
- [x] `app/app/review/page.tsx` (+ test) -- load prior-week snapshot + session snapshot values; pass to `ReviewShell`; keep landing/last-review behavior.

**Acceptance Criteria:**

- Given the opening snapshot, when a review begins, then the header shows "Week N · Mon dd – Sun dd", the prior week's closing snapshot appears read-only under "Last week you said:" (or a no-prior message), and a non-empty "What actually moved last week? What didn't?" is required before "Start review →" advances.
- Given the closing snapshot at the end of Get Creative, when it renders, then two `aria-required` fields ("What matters most this coming week?" and "What's the main thing that could derail it?") appear, and an empty field blocks completion with inline validation.
- Given I complete the review, when I click "Complete review", then the session is marked complete, an immutable `weekly_snapshots` row is written (week identity, opening retrospective, closing intention, closing blocker), the review landing shows the last-review date, and I am returned to Engage.
- Given the next week's opening, when it renders, then this week's closing intention/blocker appear as the "Last week you said:" display.

## Spec Change Log

### 2026-09-28 — review loop (patch, no re-derivation)

- **Triggering findings:** (1) **Data loss** — the opening retrospective persisted only on textarea blur, while "Start review →" persisted only `current_phase`; a keyboard/fast advance that skipped the blur left the session's `opening_retrospective` stale/empty, and since the completion route reads it from the session (not the client), the immutable `weekly_snapshots` row could capture an empty retrospective. (2) The closing `onCommit` fired two un-awaited concurrent PATCHes that could clobber each other's error state. (3) The closing "Complete review" button was `disabled` when a field was empty, so the AC's "inline validation" (`aria-invalid` + messages) was unreachable — the affordance was dead code.
- **Amended (code patches):** The opening advance now persists `opening_retrospective` in the same PATCH as `current_phase`. The closing blur commits both fields in ONE PATCH. The Complete button stays clickable when empty (only `disabled` while busy; `aria-disabled` reflects incompleteness), so pressing it reveals the inline validation via the shell's existing `showErrors` path. Swapped the panel's hardcoded `2000` for the shared `SNAPSHOT_FIELD_MAX_LENGTH`. Added/updated tests: opening advance persists the retrospective; empty-field completion reveals inline `aria-invalid` validation and does not POST; closing blur sends both fields; prior-week retrospective renders in the closed-loop display; and the prior-week query targets the PRIOR ISO week across a year boundary (frozen clock).
- **Known-bad state avoided:** Silent loss of the opening retrospective in the closed-loop snapshot; racing/clobbering closing PATCHes; an accessibility affordance (inline required-field validation) that could never appear.
- **KEEP:** The completion route's snapshot-first + 23505-retry-tolerant ordering, reading `opening_retrospective` from the OWNED session (never the client); the render-time seed-reset pattern (no setState-in-effect); no-skip + not-timed; the props-driven panels.

## Design Notes

**Panels become props-driven.** 5.4 made `PHASE_PANELS` a static element map. 5.5 needs the snapshot panels to receive the session's field values + change/complete handlers, so refactor to render the active panel with props inside `ReviewShell` (a small map from phase → render function, or an inline switch for the two snapshot phases with the middle three still static placeholders). Keep the change minimal and lint-clean (no setState-in-effect; seed state from props via the render-time pattern if needed).

**Persistence vs. gates.** The PATCH validator accepts empty strings for the snapshot fields (so in-progress typing/blur can save partial input and resume). The NON-EMPTY requirement is enforced by the UI gates (opening advance, closing complete) and re-checked by the completion route (`sanitizeReviewComplete` rejects empty intention/blocker) — never rely on the client alone.

**Completion write ordering + atomicity.** Insert the `weekly_snapshots` row FIRST, then update the session to completed. If the update fails after the insert, return 500; the immutable snapshot exists but the session isn't marked complete — the user can retry, and the completion route must tolerate a pre-existing snapshot for the session (the `weekly_snapshots` unique is per user+week, so a retry insert would 23505 → treat as "snapshot already recorded", proceed to the session update). True single-transaction atomicity would need an RPC — flag under Ask First; otherwise this retry-tolerant ordering is the pattern (consistent with the app's sequential-writes posture and the epic-H atomicity debt).

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: clean.
- `npm run lint` -- expected: clean (watch react-hooks rules in the panels/shell).
- `npm test -- --run` -- expected: ALL new/updated tests pass and are executed — `sanitizeReviewPatch` (snapshot fields), `sanitizeReviewComplete`, the complete route, the PATCH field-persistence, and the shell/panel + page tests (opening gate, closing validation, completion→navigate, prior-snapshot display). Every I/O matrix row covered.
- `npm run build` -- expected: succeeds; `/api/review/[id]/complete` registered.

**Manual checks:**

- Start a review → opening header shows the week; enter the retrospective → Start enabled; advance to the close; leave the closing fields empty → Complete blocked with inline messages; fill both → Complete writes the snapshot, returns to Engage, landing shows last-review; next week's opening shows this week's closing under "Last week you said:".

## Suggested Review Order

**Completion (security + closed loop)**

- The completion route: owned+not-completed guards, snapshot-first, 23505 retry, reads opening_retrospective from the session.
  [`route.ts:52`](../../app/api/review/[id]/complete/route.ts#L52)

- Closing-field gate (pure).
  [`complete.ts:1`](../../lib/review/complete.ts#L1)

- PATCH validator extended for the snapshot fields (empty allowed for in-progress saves).
  [`validate.ts:22`](../../lib/review/validate.ts#L22)

**Shell wiring**

- Snapshot state, opening advance persists the retrospective, closing completion, no-skip.
  [`ReviewShell.tsx:83`](../../components/review/ReviewShell.tsx#L83)

- Opening panel: week header + prior-week read-only "Last week you said:".
  [`SnapshotOpenPanel.tsx:1`](../../components/review/phase-panels/SnapshotOpenPanel.tsx#L1)

- Closing panel: two aria-required fields; Complete stays clickable to reveal inline validation.
  [`SnapshotClosePanel.tsx:1`](../../components/review/phase-panels/SnapshotClosePanel.tsx#L1)

- Loader: prior-week snapshot (ISO week of now−7d) + session snapshot values.
  [`page.tsx:52`](../../app/app/review/page.tsx#L52)

**Tests (supporting)**

- Complete route: guards, snapshot write, retry, 400/404/500.
  [`route.test.ts:1`](../../app/api/review/[id]/complete/route.test.ts#L1)

- Shell: opening gate/persist, closing validation, complete→navigate, prior-retrospective display.
  [`ReviewShell.test.tsx:1`](../../components/review/ReviewShell.test.tsx#L1)

- Loader: prior-week identity across a year boundary.
  [`page.test.tsx:1`](../../app/app/review/page.test.tsx#L1)
