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

- The Someday page brings together parked inbox items, Someday projects, and Someday goals, with reactivation.
- Someday projects are excluded from Engage and stuck detection and appear on the Someday page and in Get Creative review.
- Projects, Goals, Inbox, and Someday lists support server-side text search and numbered pagination at 20 items per page, with a result count.
- Inbox Clarify and goal-detail project assignment let users find a project by typing.
- Preserve row-level security on every list query. Search terms must not be interpolated into raw SQL.

## Technical Decisions

- List pages read `q` and `page` from the URL. A shared helper parses and clamps these values, escapes `%` and `_` for `ilike`, and supports ranged queries with an exact count.
- Goal ordering must be applied in the query so it remains consistent across pages. Preserve existing URL filters when search or page changes.
- Add `someday` to `project_status` with an additive enum migration; existing rows remain unchanged.
- Project pickers filter already-loaded options in the browser through a shared `SearchableSelect`; no new API route or write path is introduced for picker search.

## UX & Interaction Patterns

- The Someday destination is in the sidebar; on mobile it must be reachable without crowding the bottom navigation.
- Shared search and pagination controls use at least 44px targets, mark the current page with `aria-current="page"`, and distinguish no search matches from a genuinely empty list.
- The project picker follows the WAI-ARIA combobox pattern, supports Up/Down/Enter/Escape, announces match counts politely, caps visible matches at 50, and has a clear no-match state.

## Cross-Story Dependencies

- Story 8.2 adds the project status required by the Someday page and its project actions.
- Story 8.3 provides the shared search and pagination used by the Someday page in Story 8.1.
- Story 8.4 updates the project pickers in Inbox Clarify and goal detail while retaining their existing ownership and save behavior.
- The approved build order is 8.2, 8.3, then 8.1 and 8.4.