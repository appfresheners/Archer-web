# Sprint Change Proposal - 2026-10-07

**Project:** Archer
**Status:** Approved for implementation (2026-10-07)
**Mode:** Incremental
**Scope classification:** Moderate (new epic and backlog reorganization; no replan, MVP unaffected)
**Change trigger:** The user wants a Someday/Maybe page, a Someday/Maybe project status, search on the Projects and Goals pages, a searchable project picker, and a better way to handle very long Projects and Inbox lists (numbered pagination).

## 1. Issue Summary

This is a new stakeholder requirement plus a usability limit that appears as data grows. It is not a defect.

- No Someday/Maybe page exists. Inbox items clarified as `someday` and Goals with status `someday` appear only inside the Weekly Review (`somedayItems`) and as a goal badge.
- Projects have no Someday status (`ProjectStatus = active | paused | completed | archived`). `isProjectStatus("someday")` is currently asserted false in tests.
- Projects, Goals and Inbox list pages render every row. The Inbox query is unbounded. The Goals page loads all goals, projects and actions and aggregates them in memory.
- Projects and Goals have no search.
- Project pickers are native `<select>` elements: `components/inbox/clarify/ClarifyWizard.tsx` (project link) and `app/app/goals/[id]/AttachProjectControl.tsx`.

Method note: David Allen's GTD defines no formal project statuses. It has a single Someday/Maybe list reviewed under Get Creative. Archer's project statuses, including the Paused-by-default policy, are Archer's own workflow decisions (see `research/domain-david-allen-horizons-and-areas-of-focus-2026-10-04/research.md`). A Someday project status is a deliberate product choice.

## 2. Impact Analysis

### Epic Impact

- No existing epic is invalidated. Epics 4, 5 and 7 are in `review`; this work is additive.
- Add **Epic 8: Someday/Maybe & List Scalability**, scheduled after Epic 7 and before Epic 6. Epic 6 keeps its ID.

### Story Impact

New stories: 8.1 to 8.4 (section 4). No existing story text changes, except that tests asserting `someday` is not a valid project status are updated under 8.2.

### Artifact Conflicts

- PRD: new FR102 to FR106, plus the project status list gains Someday.
- Architecture: `project_status` enum gains `someday`. A shared list-query convention and a `SearchableSelect` pattern are added.
- UX: Someday destination, shared search and pagination pattern, combobox pattern.
- `sprint-status.yaml`: new Epic 8 block.

### Technical Impact

- One additive migration: `ALTER TYPE project_status ADD VALUE 'someday'`. Existing rows are unchanged. Enum value additions are hard to roll back.
- Goals page: the current load-everything-then-aggregate approach must change to a page-scoped read. Paged ordering needs status precedence in the query because `sortGoals` is in-memory only (computed sort column or view; decided in 8.3).
- Inbox query becomes a ranged query with an exact count.
- Engage, stuck detection and goal stuck counts must keep excluding non-active projects, including Someday.
- No new API routes. Search and pagination use server components reading `?q=` and `?page=`.

## 3. Recommended Approach

**Direct Adjustment:** add a new epic with four stories within the existing plan.

- Effort: medium overall (8.1 low-medium, 8.2 low, 8.3 medium, 8.4 low-medium).
- Risk: low to medium. Main risks are the Goals paged sort (8.3), combobox accessibility (8.4), and the mobile nav placement (8.1).
- Rollback: not viable or useful; nothing shipped needs reverting.
- MVP review: not needed; MVP is unaffected.
- Suggested build order: 8.2, then 8.3, then 8.1 and 8.4 in either order.

## 4. Detailed Change Proposals

### 4.1 Epics (`epics.md`)

**Epic List, new entry:**

> ### Epic 8: Someday/Maybe & List Scalability
> A signed-in user can review everything parked as Someday/Maybe in one place, find any goal or project through search, and work through long Inbox, Goals and Projects lists without scrolling through every row.
> **FRs covered:** FR102 to FR106 (new)

**Story 8.1: Someday/Maybe Page**

As a signed-in user, I want a dedicated Someday/Maybe page, so that I can see and revisit everything I have parked.

Acceptance Criteria:
- Given the app shell, when I open navigation, then a "Someday" destination routes to `/app/someday`. On mobile it is reachable without crowding the bottom nav (for example a "More" entry); the final choice is made in the story.
- Given the page, when it loads, then it shows three sections: "Parked items" (inbox items with `processing_status = someday`), "Someday projects" (projects with `status = someday`) and "Someday goals" (goals with `status = someday`). Each section shows a count and an empty state.
- Given a parked item, when I choose Reactivate, then it returns to `unprocessed` using the existing Story 5.6 route and ownership rules, and leaves the list.
- Given a Someday project, when I choose Activate, then its status becomes `paused` (consistent with Story 4.7), and I can set it to Active from the project detail.
- Given a Someday goal, when I open it, then I land on the goal detail where status can be changed.
- Given many items, when the page loads, then each section uses the shared search and pagination from Story 8.3.
- Given a read failure, when the page loads, then it shows `ReadErrorState`, not an empty state.

**Story 8.2: Someday Project Status**

As a signed-in user, I want to park a project as Someday/Maybe, so that it leaves my active and paused work without being archived.

Acceptance Criteria:
- Given the database, when the migration runs, then `ALTER TYPE project_status ADD VALUE 'someday'` is applied, existing rows are unchanged, and `lib/supabase/schema.ts` types are updated.
- Given `lib/projects/validate.ts`, when a PATCH sets `status = someday`, then it is accepted; tests that rejected `someday` are updated.
- Given the status selectors (project detail and the Get Current review panel), when I open them, then "Someday/Maybe" is offered.
- Given engage, stuck detection or goal stuck counts, when computed, then a Someday project is excluded, as Paused projects already are, and is never flagged stuck.
- Given the Weekly Review Get Creative phase, when it lists Someday items, then it includes Someday projects.
- Given the Projects list, when it renders, then Someday projects show the existing `StatusBadge`.
- Given data export (Story 6.1), when it runs, then the new status is included with no change to the export shape.

Files affected: new migration, `lib/supabase/schema.ts`, `lib/projects/validate.ts`, `components/projects/ProjectStatusSelect.tsx`, `components/review/phase-panels/GetCurrentPanel.tsx`, `lib/review/reviewData.ts`, and the `lib/engage` and `lib/goals/stuck.ts` tests.

**Story 8.3: Shared Search and Pagination for Long Lists**

As a signed-in user, I want to search and page through my Projects, Goals, Inbox and Someday lists, so that long lists stay usable.

Acceptance Criteria:
- Given the Projects, Goals, Inbox and Someday pages, when they load, then each shows a search field (`?q=`) and numbered pagination (`?page=`) with a fixed page size of 20.
- Given the search field, when I submit a term, then the server filters case-insensitively using `ilike` with escaped `%` and `_` wildcards. Projects match name and parent-goal text; Goals match goal text; Inbox and parked items match raw text.
- Given a search or page change, when the URL updates, then other params (including the existing `?goal=` filter) are preserved. A new search resets `page` to 1.
- Given a page number beyond the last page or invalid, when the page loads, then it clamps to the nearest valid page and does not error.
- Given a search with no results, when the page loads, then it shows "No matches for 'x'" with a Clear search link, distinct from the true empty state.
- Given the lists, when they render, then the page shows a total ("Showing 21-40 of 87"). Pagination is a `<nav aria-label="Pagination">` with `aria-current="page"` on the current page. Controls and the search field are at least 44px tall.
- Given the Goals list, when it computes project and stuck counts, then it reads projects and actions only for the current page of goals.
- Given the Inbox, when it loads, then the unbounded query becomes a ranged query with an exact count, newest first.
- Given an authenticated user, when a list is queried, then RLS still scopes every row and the search term never reaches a raw SQL string.

Technical notes: one shared helper in `lib/` parses and clamps `q` and `page`, builds the range and escapes the pattern; shared `ListSearch` and `Pagination` components live in `components/shared/`. Paged Goals ordering needs status precedence in the query (computed sort column or view), decided in the story.

**Story 8.4: Searchable Project Picker**

As a signed-in user, I want to type to find a project when I assign one, so that I am not scrolling a long dropdown.

Applies to the Inbox Clarify project link (`ClarifyWizard.tsx`) and the goal-detail attach-project control (`AttachProjectControl.tsx`).

Acceptance Criteria:
- Given either picker, when I open it, then I see a combobox with a text input. Typing filters options case-insensitively by project name, and options show project name plus parent goal.
- Given the option list, when I use the keyboard, then Up and Down move the active option, Enter selects, Escape closes, and Tab moves on. The input follows the WAI-ARIA combobox pattern (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, listbox options), and the match count is announced through a polite live region.
- Given no matches, when I type, then a "No projects match" row is shown.
- Given Clarify, when I choose no project or clear the field, then `project_id` stays `null` as today; selecting a project saves the same `project_id` as the `<select>` did.
- Given the picker data, when it renders, then it filters the already-loaded options in the browser. There is no new API route or write path. Archived and completed projects remain excluded as now. Existing ownership checks on save are unchanged.
- Given a very large option list, when the picker renders, then it shows at most 50 matches with a "Keep typing to narrow results" hint.
- Given the Attach control's "move from another goal" confirmation, when I pick a project that belongs to another goal, then the confirmation still appears and works.
- Given touch targets and focus, when it renders, then inputs and options are at least 44px and use the existing design tokens and clickable-cursor affordance (H-4).

Technical notes: one shared `SearchableSelect` in `components/shared/`, hand-written to avoid a new dependency. Goal pickers and `AreaSelect` are not changed in this story.

### 4.2 PRD (`prds/prd-GTDGoalandProjectCreator-2026-08-20/prd.md`)

OLD: project status list is Active, Paused, Completed, Archived; no Someday page, list search or pagination requirement.

NEW:
- FR102: The system provides a Someday/Maybe page listing parked inbox items, Someday projects and Someday goals, with reactivation.
- FR103: Projects may have status Someday/Maybe alongside Active, Paused, Completed and Archived. A Someday project is excluded from Engage and stuck detection, and appears on the Someday page and in the Get Creative review.
- FR104: The Projects, Goals, Inbox and Someday lists support server-side text search.
- FR105: The same lists paginate at 20 per page with numbered navigation and a result count.
- FR106: The Inbox clarify project link and the goal-detail attach-project control let the user find a project by typing.

Record the design choice that Someday is a status in Archer rather than a separate list as in Allen's model.

### 4.3 Architecture (`architecture/architecture-GTDGoalandProjectCreator-2026-08-20/ARCHITECTURE-SPINE.md`)

OLD: `project_status` has four values; list pages read all rows; pickers are native selects.

NEW:
- `project_status` gains `someday` via an additive enum migration.
- Shared list-query convention: `?q=` and `?page=` parsed and clamped in one helper, `ilike` with escaped wildcards, ranged queries with exact counts, and a computed sort for Goals so ordering survives paging.
- A shared client-side `SearchableSelect` pattern for pickers whose options are already loaded.

### 4.4 UX (`ux-designs/ux-GTDGoalandProjectCreator-2026-08-20/DESIGN.md`, `EXPERIENCE.md`)

OLD: six nav destinations; list pages have no search or pagination; pickers are native selects.

NEW:
- A Someday destination, with mobile placement settled in Story 8.1 ("More" entry as default).
- A shared search field and pagination pattern: 44px targets, `aria-current="page"`, separate "No matches" and true-empty states.
- A combobox pattern for the project picker: keyboard behaviour, live-region match counts, and the 50-result cap with a hint.

### 4.5 Sprint Status (`implementation-artifacts/sprint-status.yaml`)

Add after the Epic 7 block and before Epic 6:

```yaml
  epic-8: backlog
  8-1-someday-maybe-page: backlog
  8-2-someday-project-status: backlog
  8-3-shared-search-and-pagination-for-long-lists: backlog
  8-4-searchable-project-picker: backlog
  epic-8-retrospective: optional
```

## 5. Implementation Handoff

- Scope: Moderate.
- Route to: Product Owner / Developer agents.
- Product Owner: apply the epics, PRD, architecture, UX and sprint-status edits in section 4, and confirm the 8.2, 8.3, 8.1, 8.4 order.
- Developer: implement stories 8.1 to 8.4, running `bmad-build` per story once its story file exists.

Success criteria:
- Someday/Maybe page lists parked items, Someday projects and Someday goals with working reactivation.
- A project can be set to Someday and is excluded from Engage and stuck detection.
- Projects, Goals, Inbox and Someday search server-side and paginate at 20 per page, with state in the URL.
- Both project pickers support type-to-filter with the combobox keyboard pattern.
- Existing behavior and tests for Goal -> Project -> Action, status changes, ownership checks and RLS remain green.
