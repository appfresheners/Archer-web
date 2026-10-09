---
title: 'Shared Search and Pagination for Long Lists'
type: 'feature'
created: '2026-10-07'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '9d97801b422e8605213a6b926084176081007018'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Projects, Goals, and Inbox load unbounded lists, making items harder to find as data grows. Goals also calculate ordering and counts from all rows, while Inbox has no search or pagination.

**Approach:** Add shared server-side search/pagination utilities and reusable controls for Projects, Goals, and Inbox. Make controls configurable so Story 8.1 can give each Someday section independent search/page state.

## Boundaries & Constraints

**Always:** Use 20-row pages, exact counts, case-insensitive matching, escaped `%` and `_`, and ranged server queries. Preserve RLS, filters, and unrelated URL parameters; new searches start at page 1. Distinguish read failures, empty lists, and no matches. Project-name/parent-goal search uses a read-only `security_invoker` view so both fields can be searched in one ranged query. Never interpolate search text into raw SQL.

**Never:** Create the Someday page or implement its navigation/actions (Story 8.1), implement the project picker (Story 8.4), change filter semantics, add an RPC or write path, or add schema changes beyond the project-search view and its migration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Literal wildcard search | `q` contains `%`, `_`, or `\` | Characters are matched literally | Query failure uses the existing read-error state |
| Invalid or excessive page | Malformed, below 1, or beyond last page | Invalid becomes page 1; excessive clamps to last valid page (page 1 when empty) | No out-of-range error |
| No search matches | Non-empty `q`, exact count is zero | Show `No matches for 'q'` and Clear search, distinct from true empty state | N/A |
| Read fails | A list query returns an error | Preserve the read-error state, not an empty result | Retry remains available |

</frozen-after-approval>

## Code Map

- `app/app/projects/page.tsx` -- `loadProjects` reads all projects/goals; `resolveFilter` validates `?goal=`. Add ranged search while retaining goal filtering, parent labels, and empty-state distinctions.
- `app/app/projects/ProjectFilterSelect.tsx` -- currently replaces the URL; preserve search and unrelated parameters, resetting the page when the goal filter changes.
- `app/app/goals/page.tsx` -- `loadGoals` reads all goals/projects/actions and aggregates counts. Page goals first, then limit supporting reads to current-page goal IDs.
- `lib/goals/sort.ts`, `supabase/migrations/0001_init_schema.sql` -- enum order matches current status precedence; order by status then `created_at DESC` without a migration.
- `lib/supabase/schema.ts`, `supabase/migrations/` -- hand-authored Supabase types and imperative migrations; expose the read-only project search view as a typed relation and preserve underlying RLS.
- `app/app/inbox/page.tsx`, `components/inbox/InboxList.tsx` -- add ranged search to the unprocessed, newest-first query; preserve row actions and the true-empty “Inbox zero” state.
- `components/shared/ReadErrorState.tsx`, `lib/read-result.ts` -- reuse retryable failure UI and the loader result type.
- `app/app/projects/page.test.tsx`, `app/app/goals/page.test.tsx`, `components/inbox/InboxList.test.tsx` -- extend list coverage; add an Inbox page test for query behavior.
- `lib/review/reviewData.ts`, `_bmad-output/planning-artifacts/epics.md` -- Someday items are three distinct sections. Story 8.1 consumes configurable controls; this story does not add that page.

## Tasks & Acceptance

**Execution:**
- [x] `lib/lists/search-pagination.ts`, `lib/lists/search-pagination.test.ts` -- parse/clamp parameters, calculate ranges, escape literal `ilike` patterns, and preserve URL state; cover invalid values, wildcards, empty totals, and clamping.
- [x] `components/shared/ListSearch.tsx`, `components/shared/ListSearch.test.tsx` -- accessible 44px-minimum search control that preserves other parameters and resets its configured page key.
- [x] `components/shared/Pagination.tsx`, `components/shared/Pagination.test.tsx` -- numbered labeled navigation with 44px targets, `aria-current`, result totals, and configurable query keys.
- [x] `supabase/migrations/20261007175108_project_search_view.sql`, `lib/supabase/schema.ts`, `supabase/tests/project_search_view_test.sql` -- add and type a read-only `security_invoker` view for projects with parent-goal text; verify it respects RLS.
- [x] `app/app/projects/page.tsx`, `app/app/projects/page.test.tsx`, `app/app/projects/ProjectFilterSelect.tsx`, `app/app/projects/ProjectFilterSelect.test.tsx` -- ranged exact-count search by project/parent-goal text using the view, preserving the goal filter and URL state.
- [x] `app/app/projects/page.tsx`, `app/app/projects/ProjectFilterSelect.tsx` and tests -- replace the all-goals read with selected-goal ID lookup and bounded, exact-count, 20-row goal-name search; preserve All/No goal and `goal` URL semantics.
- [x] `app/app/goals/page.tsx`, `app/app/goals/page.test.tsx` -- ranged search in status/creation order; load supporting counts only for current-page goal IDs.
- [x] `app/app/inbox/page.tsx`, `app/app/inbox/page.test.tsx` -- ranged exact-count search of unprocessed raw text, newest first; preserve capture, row actions, and read-error behavior.

**Acceptance Criteria:**
- Given Projects, Goals, or Inbox, when a page loads, then it shows a 44px-minimum search field, numbered 20-row pagination, and an exact total; pagination uses `<nav aria-label="Pagination">` and marks the current page with `aria-current="page"`. Controls accept independent parameter keys for Story 8.1 sections.
- Given a search term, when a list is queried, then matching is case-insensitive and literal wildcards do not broaden results; Projects search name/parent goal, Goals search goal text, and Inbox searches unprocessed raw text.
- Given search or page navigation, when the URL changes, then unrelated parameters (including Projects `goal`) persist and new search resets that list to page 1.
- Given the Projects goal filter, when goal options are needed, then the page resolves only the selected goal by ID and searches goal names in bounded exact-count 20-row pages instead of loading every goal.
- Given paged Goals, when counts render, then supporting reads use only current-page goal IDs and order remains Active, Paused, Not now, Someday, Completed, Archived, newest first within each status.
- Given Inbox, when it loads, then its query is exact-count, ranged, unprocessed-only, and newest-first.
- Given any authenticated list query, when it runs, then the server client and RLS scope rows to the signed-in user; read failures use `ReadErrorState`.
- Given a malformed/excessive page, zero-result search, or empty list, when results render, then the page clamps safely and distinguishes no matches from a true empty state with a Clear search action.

## Implementation Notes

Human-approved scope change (2026-10-07): allow a read-only `security_invoker` view and its migration for the cross-table project search. The installed Supabase client documents that `.or()` cannot span parent and referenced tables; the view enables the required OR, exact count, and range in one query while preserving RLS. RPCs and write paths remain out of scope.

User-approved follow-up (2026-10-08): replace the Projects filter's unbounded all-goals option load with selected-goal ID lookup and a separate bounded goal-name search. Keep `goal` filtering semantics and the All/No goal choices; goal candidates use independent `goalQ`/`goalOptionsPage` state.

## Design Notes

`goal_status` declaration order matches `sortGoals`; combine it with descending `created_at` for stable paging without schema changes. Someday controls need distinct query/page keys so one section's search does not affect another.

## Verification

**Commands:**
- `npm test -- lib/lists/search-pagination.test.ts components/shared/ListSearch.test.tsx components/shared/Pagination.test.tsx app/app/projects/page.test.tsx app/app/projects/ProjectFilterSelect.test.tsx app/app/goals/page.test.tsx app/app/inbox/page.test.tsx` -- expected: focused helper, component, and list-page tests pass.
- `npx supabase test db --local supabase/tests/project_search_view_test.sql` -- expected: view privileges, cross-field search, and RLS tests pass.
- `npx tsc --noEmit` -- expected: no TypeScript errors.
- `npm run lint` -- expected: no lint errors in changed files.

## Review Triage Log

- low / patch -- Blind Hunter: a page near `Number.MAX_SAFE_INTEGER` could overflow its range before the exact count was read; `parseListQuery` now caps pages to a safe range, covered by a helper test.
- low / patch -- Blind Hunter: missing exact counts could be mistaken for zero rows; all list loaders now render the read-error state for missing counts, covered by page tests.
- low / patch -- Blind Hunter: Projects still needed its pre-existing goal-filter options without loading all goals; the user approved replacing the unbounded read with ID lookup plus bounded goal search, and tests verify no Goals query occurs without a selected goal or goal-search term.
- low / patch -- Blind Hunter: the Projects test did not exercise escaped wildcard characters in the composed OR filter; it now asserts both searched fields and the escaped term.
- low / patch -- Blind Hunter: the pgTAP search used identical casing; it now queries with mixed case and verifies both fields match.
- low / patch -- Blind Hunter: the Goals page ordering test did not verify the server ordering contract; it now asserts status ascending, creation descending, and ID ascending.
- low / patch -- Blind Hunter: deterministic ID tie-breakers were untested; Projects, Goals, and Inbox tests now assert their ID order.
- false -- Blind Hunter: a project cannot reference another user's goal because `fn_check_project_goal_owner()` rejects that insert with `P0001`; the pgTAP test verifies the guard, and the view uses `security_invoker`.
- low / patch -- Blind Hunter: supporting Projects or Actions read failures lacked Goals-page tests; separate tests now assert each failure renders `ReadErrorState`.
- low / patch -- Edge Case Hunter: `key in updates` dropped URL keys inherited from `Object.prototype`; `Object.hasOwn` now checks only explicit updates, with a `constructor` regression test.
- low / patch -- Edge Case Hunter: Goals rows changing between count and refetch could leave a stale total/page; the loader adopts the refreshed count and reclamps/refetches when needed, covered by a shrinking-count test.
- low / patch -- Edge Case Hunter: Inbox rows changing between count and refetch could leave a stale total/page; the loader now reclamps against the refreshed count, covered by a shrinking-count test.
- low / patch -- Edge Case Hunter: Projects rows changing between count and refetch could leave a stale total/page; the loader now reclamps against the refreshed count, covered by a shrinking-count test.
- low / patch -- Verification Gap Reviewer: Goal status precedence was not asserted by the page test; the ordering fields and directions are now asserted.
- low / patch -- Verification Gap Reviewer: the Projects test only checked that `.or()` ran; it now asserts both name and parent-goal filters plus escaping.