# Epic 8 Context: Someday/Maybe & List Scalability

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give signed-in users one place to review parked work, a distinct Someday status for projects, and usable search and pagination across long lists. This makes deferred work visible without treating it as archived and keeps core lists practical as they grow.

## Stories

- Story 8.1: Someday/Maybe Page
- Story 8.2: Someday Project Status
- Story 8.3: Shared Search and Pagination for Long Lists
- Story 8.4: Searchable Project Picker

## Requirements & Constraints

- The Someday page groups parked inbox items, Someday projects, and Someday goals; show counts and empty states per section. Read failures must remain distinct from empty results. Reactivated items leave the parked list.
- Someday projects are excluded from Engage and stuck detection, included in Get Creative, and retain the existing status badge and data-export shape.
- Projects, Goals, Inbox, and Someday use server-side search and numbered pagination at 20 rows per page. Show result totals, distinguish no search matches from a true empty state, and clamp invalid or out-of-range pages.
- Search is case-insensitive: Projects match project name and parent-goal text; Goals match goal text; Inbox and parked items match raw text.
- Keep every query scoped by RLS. Escape `%` and `_` for `ilike`; never interpolate search text into raw SQL.
- Project assignment in Inbox Clarify and goal detail supports typing to find an eligible project while preserving existing ownership checks and save behavior.

## Technical Decisions

- Server-rendered list pages read `q` and `page`; one `lib/` helper parses/clamps them, escapes `ilike` wildcards, and builds ranged queries with exact counts. Preserve other URL parameters, including the Goals `goal` filter; a new search resets the page to 1.
- Apply Goals status-precedence ordering in the query so it is stable across pages. Compute project and stuck counts only for goals on the current page. Inbox uses a ranged, newest-first query with an exact count.
- Add `someday` to `project_status` through an additive enum migration only; do not change existing rows. Update generated Supabase types and accept the status in validation.
- A shared `SearchableSelect` filters already-loaded project options in the browser, excludes archived/completed projects as before, and adds no API route or write path. Limit rendered matches to 50.

## UX & Interaction Patterns

- Add Someday to the sidebar and make it reachable on mobile without crowding the bottom navigation.
- Search and pagination controls have at least 44px targets. Pagination uses a labeled navigation landmark and `aria-current="page"`; provide a clear-search action for no-match results.
- The picker follows the WAI-ARIA combobox pattern (`role`, expanded state, controls, active descendant, and listbox options), supports Up/Down/Enter/Escape with Tab moving on, announces match counts in a polite live region, and shows no-match and “keep typing” states.

## Cross-Story Dependencies

- Story 8.1 depends on 8.2 for Someday project status and on 8.3 for shared section search/pagination. Reactivating parked inbox items reuses Story 5.6 ownership and route behavior; activating a Someday project returns it to Paused, consistent with Story 4.7.
- Story 8.2 also updates existing project status selectors and Get Creative behavior; Story 6.1 export includes the new status without changing its shape.
- Story 8.4 replaces the project selectors in Inbox Clarify and goal detail while retaining their current ownership, eligibility, and save semantics.
- The planned build order is 8.2, 8.3, then 8.1 and 8.4.