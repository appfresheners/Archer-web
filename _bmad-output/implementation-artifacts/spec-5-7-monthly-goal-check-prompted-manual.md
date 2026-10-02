---
title: 'Monthly Goal Check (Prompted & Manual)'
type: 'feature'
created: '2026-10-01'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []
baseline_commit: '2468bcd669e892b5f6be866b66985a8657338e36'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Goals can quietly become irrelevant or drift without a regular review. The goal detail view currently has only a placeholder for the monthly check, and there is no overdue prompt or completion timestamp update.

**Approach:** Add a distinct per-goal monthly check at `/app/review/monthly/[goalId]`, reachable manually from goal detail and surfaced in-app when due. It reviews relevance, status, linked project health, missing-project and overload prompts, then updates `last_checked_at` on completion without writing an achievement or streak.

## Boundaries & Constraints

**Always:** Use the existing `last_checked_at` column and six `GoalStatus` values; no schema migration is needed for the timestamp. Keep the flow separate from weekly review. Load and mutate only through authenticated, owner-scoped Supabase access. Set the completion timestamp server-side; never trust a client-provided timestamp. Reuse linked-project status and shared stuck detection. Keep the manual entry available from goal detail.

**Never:** Add an achievement event or streak, place the monthly check inside the weekly-review phase sequence, or create an answer-history schema without the human decision recorded below.

**Human decisions:** Show overdue goals in an app-wide authenticated-shell prompt. Prompt Active goals only. For a never-checked goal, use `created_at` as the 30-day baseline. Require one Yes/No/Changed answer before completion; keep it transient, persisting only `last_checked_at`, and let the separate status selector control status. “Missing project?” and “Overloaded?” are reflection prompts only; users make changes through existing screens.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Due goal | Active goal's `last_checked_at`, or `created_at` when null, is at least 30 days old | App-wide prompt lists a link to that goal's monthly check | Prompt load degrades without breaking the authenticated shell |
| Manual start | User opens the check from goal detail | Per-goal flow asks relevance, offers status change, lists linked projects with badges/stuck count, and shows missing-project/overload prompts | Missing or unowned goal is 404 |
| Complete check | User selects Yes/No/Changed and completes the flow | Persist server time to `last_checked_at`; return to a useful goal view; create no achievement/streak | Require an answer; API error leaves timestamp unchanged |
| Update status | User chooses a goal status | Persist through the existing validated owner-scoped goal update path | Inline error; retain current status |

</frozen-after-approval>

## Code Map

- `app/app/layout.tsx` -- authenticated server shell wrapping all `/app/*` routes; load due Active goals here and render the app-wide prompt without changing nav.
- `components/authenticated/` -- existing shell components; add a focused prompt component listing due-goal links with empty/populated-state tests.
- `app/app/goals/[id]/page.tsx` -- `loadGoalDetail` loads a goal and linked projects/actions, derives stuckness, and renders the existing Monthly Goal Check placeholder. Extend it with `last_checked_at` as needed and replace the placeholder with the manual link.
- `app/app/goals/[id]/GoalDetailClient.tsx` -- existing goal status PATCH and `router.refresh()` pattern; preserve existing edit/delete behavior.
- `lib/goals/stuck.ts`, `components/goals/StatusBadge.tsx`, `components/goals/GoalStatusSelect.tsx` -- reuse stuck rules, project/goal badges, and the schema-valid goal status selector.
- `app/api/goals/[id]/route.ts`, `lib/goals/validate.ts` -- owner-scoped update conventions; `sanitizeGoalPatch` intentionally does not accept `last_checked_at`, so completion needs a dedicated server-timestamped path rather than trusting a PATCH body.
- `lib/supabase/schema.ts`, `supabase/migrations/0001_init_schema.sql` -- confirm `last_checked_at` is already nullable timestamp data; no base schema work is required.
- `app/api/goals/[id]/route.test.ts`, `app/app/goals/[id]/page.test.tsx`, `components/goals/GoalRow.test.tsx` -- local Vitest patterns for authenticated API, server page, and goal-row behavior.
- `app/app/review/` -- currently contains weekly-review routes only; do not alter its phase model to host the monthly flow.

## Tasks & Acceptance

**Execution:**
- [x] `lib/goals/monthlyCheck.ts` and test -- implement/test the Active-only 30-day due rule using `last_checked_at ?? created_at`, with deterministic clock inputs and date-boundary coverage.
- [x] `app/app/layout.tsx`, `components/authenticated/MonthlyGoalCheckPrompt.tsx`, and tests -- load due Active goals efficiently and show app-wide links without breaking auth redirects or the shared shell.
- [x] `app/app/review/monthly/[goalId]/page.tsx` and focused component/tests -- load the owned goal, linked projects and action statuses; render the distinct guided check, relevance/status controls, project health, and the decided prompt interactions.
- [x] `app/api/goals/[id]/monthly-check/route.ts` and test -- authenticate, owner-scope the goal update, set `last_checked_at` from server time, and reject missing/unowned goals without accepting a client timestamp.
- [x] `app/app/goals/[id]/page.tsx` and tests -- replace the placeholder with the manual check entry and expose the check timestamp where appropriate.
- [x] Add or update focused tests for due/null boundaries, required transient relevance choice, status changes, reflection-only missing/overload prompts, shell prompt visibility, project/stuck presentation, completion timestamp, and auth/404/error behavior.

**Acceptance Criteria:**
- Given an Active goal whose `last_checked_at` (or `created_at` when never checked) is at least 30 days old, when the user visits any authenticated app route, then an app-wide in-app prompt links to its monthly check without a push notification.
- Given a signed-in user, when they start a check manually from goal detail or from its due prompt, then the distinct per-goal flow asks whether the goal is still relevant (Yes / No / Changed), offers the six valid statuses, lists linked projects with status badges and a stuck count, and presents reflection-only missing-project and overload prompts.
- Given the monthly check, when the user attempts completion without selecting Yes, No, or Changed, then completion is blocked with an inline prompt to choose an answer.
- Given a selected relevance answer or either reflection prompt, when the user completes the check, then no answer history is saved and no project is created or paused by those prompts.
- Given completion of a goal check, when the user finishes, then `last_checked_at` is updated server-side and no achievement event or streak is created.
- Given an unauthenticated user or a goal they do not own, when they load or complete the check, then protected data is not exposed or changed.

## Implementation Notes

## Spec Change Log

## Review Triage Log

- **medium — patch (Blind Hunter):** `POST /api/goals/[id]/monthly-check` updates `last_checked_at` without validating a relevance answer, so a direct request bypasses the required client gate.
- **medium — patch (Edge Case Hunter):** The same completion endpoint accepts a request without a Yes/No/Changed answer and advances the prompt timestamp; this is the same root cause as the Blind Hunter finding.
- **low — rejected (Blind Hunter):** Read errors in the monthly page loader become 404s, but this is an infrequent transient failure and distinguishing server errors needs broader page error handling than the narrow finding warrants.
- **low — rejected (Blind Hunter):** The monthly page loads all action statuses although stuck detection uses only `committed`; current goal/project action lists are small, so the added query filter is not needed to meet the story.
- **low — rejected (Blind Hunter):** `generateMetadata` repeats the full project/action loader, adding work on monthly-check visits without changing behavior; this is a low-impact optimization rather than a story blocker.
- **low — rejected (Blind Hunter):** The app-wide prompt has no cap, but it lists all due goals as requested, and there is no user requirement for truncation; adding a cap could hide overdue goals.
- **low — rejected (Blind Hunter):** Due-goal order is unspecified and no correctness behavior depends on ordering.
- **low — patch (Blind Hunter):** After a missing-answer alert, choosing a relevance radio leaves the stale alert visible until another submit; clear the alert on selection.
- **low — rejected (Blind Hunter):** The reviewer requested recording verification output in the spec; verification was run and this finding's proposed fix edits the spec, which the review workflow explicitly rejects.
- **medium — patch (Verification Gap):** `getMonthlyGoalCheckCutoff` has no fixed-clock assertion, so an incorrect cutoff could pass the existing interval-derived rule tests and the layout regex test.

## Design Notes

The existing goal detail loader already has the linked project and action data needed to compute stuck count. The existing goals list aggregates projects/actions in batches. Prefer those established query patterns; do not introduce an N+1 query per goal. The app-wide prompt belongs in the authenticated shell and should load due-goal identifiers/text in one query. Relevance and reflection responses are deliberately transient.

## Verification

**Commands:**
- `npm test -- --run app/api/goals/[id]/monthly-check/route.test.ts app/app/review/monthly/[goalId]/page.test.tsx app/app/goals/[id]/page.test.tsx` -- expected: focused route and page behavior passes.
- `npx tsc --noEmit` -- expected: no TypeScript errors.
- `npm run lint` -- expected: no lint errors.