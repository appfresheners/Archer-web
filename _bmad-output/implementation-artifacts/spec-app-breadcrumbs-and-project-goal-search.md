---
title: 'App-Wide Breadcrumbs and Project Goal Search'
type: 'feature'
created: '2026-10-09'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '13e64b9b85dabebdac4269b00a7b6e5dcc692f03'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-07-review-breadcrumbs.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-8-3-shared-search-and-pagination-for-long-lists.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Focus and several other authenticated pages lack the breadcrumb coverage previously requested, while the Projects goal search does not load options like Inbox's single-action project picker.

**Approach:** Ensure every authenticated `/app` page renders one working breadcrumb trail using the existing shared component. Load all RLS-visible goal options for the Projects filter once and search them client-side like Inbox, while retaining project filter and list semantics.

## Boundaries & Constraints

**Always:** Preserve existing breadcrumb trails, origin-aware destinations, and current-page semantics; add breadcrumbs only where absent and do not duplicate them in the shared app shell. Keep all links within valid authenticated app routes. Load all RLS-visible goals once and filter goal candidates in the browser. Preserve RLS, the All/No goal choices, selected-goal filtering, project search, and project-list pagination.

**Never:** Change authentication, database schema, APIs, mutation behavior, or unrelated navigation. Do not change project-list search/pagination while updating the separate goal search.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Top-level app page | User visits Engage, Focus, Goals, Inbox, Projects, Review, Settings, or Someday | Exactly one breadcrumb nav identifies the current page | N/A |
| Nested app page | User visits an existing detail, new, or monthly-review route | Its current trail and destination links remain intact; no second breadcrumb appears | N/A |
| Follow breadcrumb | User activates any breadcrumb link | Navigation reaches the linked authenticated app route | N/A |
| Search goal options | User enters a goal-name query on Projects | Matching goals are discoverable and selecting one applies the existing `goal` filter | Preserve the selected filter and unrelated project URL state |
| No goal matches | Query matches no available goal | Show a clear no-match state; do not alter the applied project filter | N/A |

</frozen-after-approval>

## Code Map

- `components/shared/Breadcrumbs.tsx` -- Reuse the existing accessible breadcrumb nav, ordered list, link styling, and `aria-current="page"`; avoid duplicating it in the shared shell.
- `app/app/engage/page.tsx`, `app/app/focus/page.tsx`, `app/app/goals/page.tsx`, `app/app/inbox/page.tsx`, `app/app/projects/page.tsx`, `app/app/review/page.tsx`, `app/app/settings/page.tsx`, `app/app/someday/page.tsx` -- Top-level authenticated pages currently missing breadcrumbs; add one current-page trail to each.
- `app/app/goals/new/page.tsx`, `app/app/goals/[id]/page.tsx`, `app/app/inbox/[id]/page.tsx`, `app/app/projects/new/page.tsx`, `app/app/projects/[id]/page.tsx`, `app/app/review/monthly/[goalId]/page.tsx` -- Existing breadcrumb trails must remain unchanged and must not be duplicated.
- `app/app/projects/page.tsx` -- `loadProjects` currently fetches selected goal by ID and performs bounded `goalQ`/`goalOptionsPage` exact-count search; keep project-list query, RLS scope, and main pagination intact.
- `app/app/projects/ProjectFilterSelect.tsx` -- Preserve All/No goal, selected-goal application links, unrelated query parameters, and the existing search affordance while changing how goal candidates are supplied/searched per the resolved question.
- `app/app/projects/page.test.tsx`, `app/app/projects/ProjectFilterSelect.test.tsx`, `app/app/focus/page.test.tsx` and existing top-level page tests -- Cover goal loading/search and breadcrumb presence; add focused coverage for any route without an existing test.
- `components/authenticated/Sidebar.tsx`, `components/authenticated/BottomNav.tsx` -- Reuse their established route labels for top-level breadcrumb text; do not change navigation behavior.

## Tasks & Acceptance

**Execution:**
- [x] `app/app/engage/page.tsx`, `app/app/focus/page.tsx`, `app/app/goals/page.tsx`, `app/app/inbox/page.tsx`, `app/app/projects/page.tsx`, `app/app/review/page.tsx`, `app/app/settings/page.tsx`, `app/app/someday/page.tsx` -- Add one current-page breadcrumb to each top-level route without changing page behavior.
- [x] `app/app/projects/page.tsx`, `app/app/projects/ProjectFilterSelect.tsx`, `app/app/projects/page.test.tsx`, `app/app/projects/ProjectFilterSelect.test.tsx` -- Implement the resolved goal-option loading/search behavior and retain goal filter, URL-state, and project-list contracts.
- [x] `app/app/engage/page.test.tsx`, `app/app/focus/page.test.tsx`, `app/app/goals/page.test.tsx`, `app/app/inbox/page.test.tsx`, `app/app/projects/page.test.tsx`, `app/app/review/page.test.tsx`, `app/app/settings/page.test.tsx`, `app/app/someday/page.test.tsx`, `components/shared/Breadcrumbs.test.tsx` -- Verify every top-level route renders exactly one breadcrumb and each link navigates to its intended route.
- [x] `app/app/goals/new/page.test.tsx`, `app/app/goals/[id]/page.test.tsx`, `app/app/inbox/[id]/page.test.tsx`, `app/app/projects/new/page.test.tsx`, `app/app/projects/[id]/page.test.tsx`, `app/app/review/monthly/[goalId]/page.test.tsx` -- Verify existing nested breadcrumb trails and origin destinations remain intact without duplicates.

**Acceptance Criteria:**
- Given any authenticated `/app` page, when it renders, then exactly one breadcrumb landmark identifies the current route and any existing parent links remain valid.
- Given a page that already renders breadcrumbs, when it renders after this change, then its existing trail is preserved without a duplicate.
- Given the Projects goal search, when a goal is found and selected, then the existing `goal` filter applies without dropping unrelated URL state or changing project-list pagination.
- Given the Projects goal search has no matches, when results render, then the user sees a distinct no-match state and the applied project filter remains unchanged.

## Implementation Notes

Added page-level breadcrumbs to all eight top-level authenticated routes; existing detail, new, and monthly-review trails remain in place. Projects now loads RLS-visible goal options in 1,000-row transport batches and filters the complete set client-side while preserving selected-goal lookup, All/No goal, and project-list URL behavior. The focused route/filter suite passed 101 tests; `npx tsc --noEmit` and `npm run lint` passed.

Review fixes preserve the Projects list when optional goal-option batches fail, use a stable ID cursor, cap rendered goal suggestions at 50, and clear stale goal-search URL keys. Goal detail, Clarify, project detail, and monthly-check error states now retain their breadcrumbs. Final focused verification passed 104 tests across 16 files, plus TypeScript and lint.

## Spec Change Log

## Review Triage Log

- false -- Blind Hunter: `supabase/.temp/cli-latest` appears in the baseline diff but was already modified before this story; it is unrelated and will remain untouched and excluded from the story commit.
- false -- Blind Hunter: the all-goals preload has no product maximum. This matches the explicit user-approved behavior; requests are fetched in bounded 1,000-row batches, so each Supabase response respects the transport range.
- low / patch -- Blind Hunter: a broad local goal query rendered every match as a link, which could create an unwieldy result list. Cap rendered suggestions at 50 and show a “Keep typing” hint while retaining all loaded options for filtering.
- medium / patch -- Blind Hunter: a goal-options query error returned the full-page error before loading projects, hiding otherwise usable project results. Make goal search failure local to its control and keep project-list reads available.
- medium / patch -- Blind Hunter: clearing local goal-search state left `goalQ` in the URL, so refresh restored the query. Navigate to a URL with only the goal-search keys removed while preserving other state.
- medium / patch -- Blind Hunter: no test covered failure on a later goal batch. Add a later-batch failure test that verifies graceful goal-search failure and preserved project results.
- false -- Blind Hunter: page-level breadcrumb tests do not render the app shell, but `app/app/layout.tsx` contains no breadcrumb; it cannot create a duplicate, so the route tests verify the rendered page contract.
- false -- Blind Hunter: asserting the shared breadcrumb link `href` without simulating a browser click is sufficient for the existing Next `Link` wrapper; its standard anchor behavior is not changed by this work.
- medium / patch -- Edge Case Hunter: offset batches ordered by mutable `goal_text` could shift during a rename and omit or duplicate options. Use an immutable ID cursor for batch loading, then sort the complete in-memory options by name.
- medium / patch -- Edge Case Hunter: goal-detail read failures returned `ReadErrorState` before rendering any breadcrumb. Render its established Goals → Goal trail on the error path.
- medium / patch -- Edge Case Hunter: Clarify read failures returned `ReadErrorState` before rendering any breadcrumb. Render its established Inbox → Clarify trail on the error path.
- medium / patch -- Edge Case Hunter: project-detail read failures returned `ReadErrorState` before rendering any breadcrumb. Render an origin-aware fallback trail on the error path.
- medium / patch -- Edge Case Hunter: monthly-check read failures returned `ReadErrorState` before rendering any breadcrumb. Render its established Goals → Goal → Monthly check trail on the error path.

## Design Notes

The approved 2026-10-07 proposal promised working breadcrumbs on every `/app` sub-page, but the current app shell does not render them globally; page-level use avoids duplicating the origin-aware nested trails. The user chose load-once client-side goal filtering for Projects to match Inbox, accepting replacement of Story 8.3's bounded server-side goal-option query.

## Verification

**Commands:**
- `npm test -- app/app/engage/page.test.tsx app/app/focus/page.test.tsx app/app/goals/page.test.tsx app/app/inbox/page.test.tsx app/app/projects/page.test.tsx app/app/review/page.test.tsx app/app/settings/page.test.tsx app/app/someday/page.test.tsx app/app/goals/new/page.test.tsx 'app/app/goals/[id]/page.test.tsx' 'app/app/inbox/[id]/page.test.tsx' app/app/projects/new/page.test.tsx 'app/app/projects/[id]/page.test.tsx' 'app/app/review/monthly/[goalId]/page.test.tsx' app/app/projects/ProjectFilterSelect.test.tsx components/shared/Breadcrumbs.test.tsx` -- passed: 104 tests across 16 files.
- `npx tsc --noEmit` -- passed: no TypeScript errors.
- `npm run lint` -- passed: no lint errors.