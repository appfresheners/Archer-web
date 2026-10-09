---
title: 'Someday/Maybe Page'
type: 'feature'
created: '2026-10-08'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '20278da6fa8df390da3fe72d9fab286281f02faa'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Parked inbox items, Someday projects, and Someday goals have no dedicated place to review together, making deferred work hard to find and revisit.

**Approach:** Add an authenticated `/app/someday` page with independently searchable and paginated sections for all three kinds of parked work, plus the existing reactivation/status transitions and links to goal details. Add Someday to desktop navigation; on mobile, keep Inbox, Goals, and Engage directly visible and group Focus, Projects, Weekly Review, and Someday under an accessible More menu.

## Boundaries & Constraints

**Always:** Use server-side reads through the authenticated Supabase client and preserve RLS. Filter each section to its Someday state; use independent search/page URL keys, 20-row ranged queries, exact filtered counts, escaped literal search, stable ordering, and clamped pages. Distinguish empty lists from no search matches and read failures. Reactivate inbox items through the existing Story 5.6 PATCH behavior; activate Someday projects by setting them to Paused through the existing project PATCH route. Link Someday goals to their existing detail page.

**Never:** Add migrations, new API routes, or new dependencies. Change existing Inbox, Goals, Projects, or Weekly Review behavior; alter Story 8.2 status support or Story 8.3 shared search/pagination; add delete or goal-mutation actions to this page; or weaken ownership and RLS checks.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No parked rows | Successful reads return zero rows for a section without a query | Show that section's count as zero and its own empty state | Do not imply a read failure |
| Search has no matches | Section query is non-empty and exact count is zero | Show a search-specific no-match state and clear-search control, distinct from the empty state | Other sections retain their independent search/results |
| Any section read fails | Query errors or exact count is missing | Show retryable `ReadErrorState`; do not render a failed section as empty or present partial counts | Retry refreshes the server page |
| Reactivate parked item | Owned item has `processing_status = someday` | PATCH it to `unprocessed`; successful refresh removes it from the section | Keep the row and show an accessible error if PATCH fails |
| Activate project | Owned project has `status = someday` | PATCH it to `paused`; successful refresh removes it from the section | Keep the row and show an accessible error if PATCH fails |

</frozen-after-approval>

## Code Map

- `_bmad-output/implementation-artifacts/epic-8-context.md` -- primary requirements: three sections, independent list state, RLS, read errors, and Epic 8 cross-story boundaries.
- `app/app/inbox/page.tsx` -- server list loader pattern for `parseListQuery`, ranged exact-count reads, page clamping, and error results.
- `app/app/projects/page.tsx` -- `project_search` supports name and parent-goal text in one escaped OR filter; constrain it to `status = someday` here.
- `app/app/goals/page.tsx` -- stable goal query ordering and page-loader conventions; Someday-only goals need no project/action aggregation.
- `lib/lists/search-pagination.ts`, `components/shared/ListSearch.tsx`, `components/shared/Pagination.tsx` -- reusable page-size, safe search, URL preservation, and configurable independent query/page keys.
- `components/shared/ReadErrorState.tsx` -- retryable page-level read failure UI.
- `components/review/phase-panels/GetCreativePanel.tsx` -- existing inbox reactivation and project activation PATCH payloads, pending/error handling, and refresh behavior.
- `app/api/inbox/[id]/route.ts`, `app/api/projects/[id]/route.ts` -- existing ownership-scoped mutation routes; do not modify.
- `components/goals/StatusBadge.tsx` -- existing Someday status presentation for project and goal rows.
- `components/authenticated/nav-items.ts`, `components/authenticated/Sidebar.tsx`, `components/authenticated/BottomNav.tsx`, `components/authenticated/BottomNav.test.tsx` -- shared desktop navigation and current six-destination mobile bar; retain all desktop links and test the mobile More menu.
- `AGENTS.md` -- before implementation, read the installed Next.js 16.3.3 guides under `node_modules/next/dist/docs/` relevant to the page and navigation APIs.

## Tasks & Acceptance

**Execution:**
- [x] `app/app/someday/page.tsx` -- add metadata and an authenticated server page that loads parked inbox items, Someday projects from `project_search`, and Someday goals with exact counts, independent `q_items/page_items`, `q_projects/page_projects`, and `q_goals/page_goals` keys, 20-row ranges, stable ordering, and clamped pages; render section counts, shared search/pagination, distinct empty/no-match states, project/goal links, and page-level `ReadErrorState` on any read failure.
- [x] `app/app/someday/page.test.tsx` -- cover status filters, independent search/page keys, wildcard escaping, exact counts, page clamping, section empty/no-match distinctions, project/goal links, and failures including missing counts.
- [x] `components/someday/SomedayActions.tsx`, `components/someday/SomedayActions.test.tsx` -- implement accessible pending/error states for the existing inbox and project PATCH payloads; refresh on success and retain the item on failure.
- [x] `components/authenticated/nav-items.ts`, `components/authenticated/BottomNav.tsx`, `components/authenticated/BottomNav.test.tsx` -- register Someday for desktop and implement/test the mobile More menu grouping while keeping Inbox, Goals, and Engage directly visible.

**Acceptance Criteria:**
- Given authenticated navigation, when opened on desktop, then Someday links to `/app/someday`; on mobile it is reachable through More without adding another crowded bottom-bar destination.
- Given `/app/someday`, when loaded, then it shows Parked items, Someday projects, and Someday goals, each with its exact current-result count and an appropriate empty state.
- Given a parked inbox item, when Reactivate is chosen, then the existing route returns it to unprocessed and it leaves the refreshed list.
- Given a Someday project, when Activate is chosen, then the existing route changes it to Paused and it leaves the refreshed list; its detail link still allows changing it to Active.
- Given a Someday goal, when opened, then its existing goal detail page loads.
- Given many rows, when a section is searched or paged, then it uses shared controls and its URL state does not change another section's query or page.
- Given a read failure in any section, when the page renders, then it shows retryable `ReadErrorState`, never an empty state for failed data.

## Implementation Notes

- Implemented the `/app/someday` page, independent section search/pagination, existing status transitions, and responsive navigation. Hardened page clamping against changing counts and treated missing row data as a read failure.
- Verification on 2026-10-08: focused tests passed (33/33); `npx tsc --noEmit`, implementation ESLint, and test-file ESLint passed. Read the installed Next.js 16.3.3 App Router page, navigation, Server/Client Components, and metadata guides. No live Supabase or browser end-to-end check was run.

## Design Notes

- The mobile More grouping is a deliberate choice for this story: six destinations already occupy the current bottom bar, so adding a seventh direct item would further compress labels and targets. Keep the three frequent workflow destinations visible and move the four secondary destinations into the menu.
- No migration, deletion, deployment, or new service endpoint is planned. User-triggered status changes use existing reversible, ownership-scoped PATCH routes. The implementation footprint is one page, one action component, shared navigation adjustments, and focused tests.

## Review Triage Log

- low / patch -- Blind Hunter: More and its active destination both exposed `aria-current` when expanded; the More button now exposes it only while collapsed, and a test verifies the open-menu current link.
- low / patch -- Blind Hunter: the mobile More disclosure could not close with Escape; Escape now closes it and restores focus to the More button, covered by a keyboard test.
- low / patch -- Blind Hunter: a long unbroken query could overflow the no-match state; the message now allows long words to wrap.
- low / patch -- Blind Hunter: project and goal wildcard escaping lacked call-site coverage; tests now exercise wildcard/backslash/quote project input and wildcard goal input.
- low / patch -- Blind Hunter: pagination tests did not cover count changes during refetch; a changing-count regression test verifies all refetch ranges and the final page.
- low / patch -- Blind Hunter: tests checked only the ID tie-breaker; they now assert the full primary ordering and direction for all three sections.
- low / patch -- Blind Hunter: rejected `fetch` was not tested; a network-failure test verifies the accessible error, enabled retry action, and absence of refresh.
- low / patch -- Blind Hunter: implementation notes omitted verification outcomes; actual focused test, typecheck, and lint results are now recorded above.
- low / patch -- Edge Case Hunter: choosing Inbox, Goals, or Engage could leave More open across navigation; primary links now close it, with a regression test.
- low / patch -- Edge Case Hunter: repeated count shrinkage could leave a stale page number and empty rows; the loader re-clamps up to four reads and returns the retry state if it cannot stabilize, covered by a changing-count test.
- low / patch -- Edge Case Hunter: a successful response with null rows and a positive count could render a misleading empty list; the loader treats missing row data as a read failure, tested for each section.
- low / patch -- Verification Gap Reviewer: network rejection lacked coverage for the user-facing failure path; the added test verifies the generic alert and keeps the action available.
- low / patch -- Verification Gap Reviewer: Someday project search escaping was only exercised with ordinary text; the call-site test now asserts the escaped project OR filter for special characters.

## Verification

**Commands:**
- `npm test -- app/app/someday/page.test.tsx components/someday/SomedayActions.test.tsx components/authenticated/BottomNav.test.tsx` -- expected: focused page, mutation, and navigation tests pass.
- `npx tsc --noEmit` -- expected: no TypeScript errors.
- `npm run lint -- app/app/someday/page.tsx components/someday/SomedayActions.tsx components/authenticated/nav-items.ts components/authenticated/BottomNav.tsx` -- expected: no lint errors in changed implementation files.