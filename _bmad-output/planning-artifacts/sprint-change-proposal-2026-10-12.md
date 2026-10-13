# Sprint Change Proposal - 2026-10-12

**Project:** Archer
**User:** Mthizo
**Mode:** Incremental
**Status:** Approved for implementation by Mthizo on 2026-10-12; Correct Course workflow complete
**Scope classification:** Minor - direct adjustment within existing stories

## 1. Issue Summary

During use of Archer, Mthizo identified four gaps:

1. The Projects list cannot be filtered by project status, preventing an Active-only view.
2. Focus lacks a useful linked breadcrumb return path.
3. Engage does not display the weekly priority recorded at review completion.
4. Opening a goal-linked project from Projects offers its parent goal as the breadcrumb return destination rather than the originating Projects list.

Local evidence:

- `app/app/projects/page.tsx` filters `project_search` by search text and parent goal, but not status. Project links omit the existing `from` parameter.
- `app/app/projects/[id]/page.tsx` reads a validated `from` parameter, but falls back to the parent goal/Area when it is absent. Even with an origin, it currently inserts the parent relationship into the trail.
- `app/app/focus/page.tsx` already renders a single non-linked Focus crumb in success and read-error states. The reported absence is therefore treated as a missing useful return trail, not proof that the local component is absent.
- `app/app/engage/page.tsx` loads goals, projects, and actions but does not read weekly snapshots.
- Story 5.5 already saves the closing intention and blocker. Only the intention is requested for Engage.
- The approved 2026-10-07 Get Current/Breadcrumbs proposal promised origin-aware navigation; the Projects-origin and Focus paths need follow-up.

No running-browser reproduction has been performed during this planning workflow. Evidence consists of user reports and local source inspection.

## 2. Impact Analysis

### Epic and Story Impact

| Epic | Stories | Adjustment |
| --- | --- | --- |
| 4: Goal, Project & Action Management | 4.6; 4.3 navigation criteria | Add independent project-status filtering; make project detail return to the actual origin. |
| 8: Someday/Maybe & List Scalability | 8.3 | Preserve status with goal/search/page state; filter before counting and pagination. |
| 7: Focus Horizons & Areas of Focus | 7.2; 7.4 entry link | Add linked Focus breadcrumbs and pass Weekly Review as its origin. |
| 5: Inbox, Engage & Reviews | 5.3; 5.5 | Display the latest completed review's saved priority on Engage. |

No new epic, story renumbering, removed story, or epic resequencing is required. Retain the existing review history and story statuses; approval does not imply implementation is complete. Other remaining epics are not invalidated. Epic 6 export and vault scope are unchanged because no new persisted record is introduced.

### Artifact Conflicts

- PRD: FR95 needs status filtering; FR100 needs a useful Focus return trail; Engage requirements need the saved weekly context alongside, not inside, the action model.
- Epics: extend the acceptance criteria of the existing stories listed above, including URL preservation in 8.3.
- Architecture: clarify origin precedence under AD-8, the read-only snapshot-to-Engage flow under AD-16, and server-side status filtering under AD-23.
- UX: revise Projects List, Focus Page, Project Detail, Engage View, and review-completion behavior in EXPERIENCE.md. Add corresponding restrained control/banner/navigation specifications to DESIGN.md.
- No matching spec document was discovered. AGENTS.md contains Next.js rules but no `bmad:context` block.

### Technical Impact

- Reuse `Breadcrumbs`, `safeFrom`, `labelForPath`, `withFrom`, and the shared list URL helpers.
- Extend the existing Projects filter controls and server query. Do not filter only the current page in the browser.
- Add a bounded, authenticated, RLS-scoped read of the latest snapshot belonging to a completed review. Use a deterministic completion ordering, with a stable tie-breaker. Do not sort by ISO week number alone or restrict to the current calendar week.
- Render the banner independently of action filtering and action-empty states. A snapshot read failure must not block otherwise usable actions or masquerade as no snapshot.
- Keep all user data scoped to the signed-in user. Do not introduce service-role reads, new write endpoints, duplicated commitment data, migrations, or infrastructure changes.
- Verify the saved-date label against the existing completion/snapshot timestamps. Do not label the review's stored week range as the coming week without an explicit mapping.

## 3. Recommended Approach

**Direct Adjustment.** Extend existing stories and reuse the existing navigation and snapshot abstractions.

- Estimated effort: Low to medium; approximately 1-2 developer days including focused tests and browser checks. This is a planning estimate, not a committed delivery date.
- Risk: Low overall. Main risks are lost query parameters, parent/origin ambiguity, wrong snapshot ordering, treating read failures as empty data, and mobile text overflow.
- Timeline impact: A small follow-up implementation pass before affected stories are accepted. No strategic replan or change to the core v1 objectives.
- Rollback: Not recommended. Existing functionality is reusable; reverting completed work provides no simplification.
- MVP review: No scope reduction needed. A passive display of user-authored priorities is not a notification or re-engagement system.

Suggested implementation order: status filtering, project-origin breadcrumbs, Focus return trails, then the weekly banner. Implementations can remain locally scoped; final verification includes their combined filtered-list navigation.

## 4. Detailed Change Proposals

The four behavior proposals below were individually approved by Mthizo. The complete proposal, including supporting artifact amendments and developer handoff, was explicitly approved on 2026-10-12. No source or canonical planning artifact has been modified by this proposal.

### P1 - Projects Status Filter

**Stories:** 4.6 acceptance criteria; 8.3 URL/pagination criteria.

**OLD:** Projects supports All projects, a selected goal, or No goal. Search and pagination preserve the goal filter.

**NEW:** Add a separate status selector with All statuses (default), Active, Paused, Someday/Maybe, Completed, and Archived. Status, goal, and text search combine. Apply the status predicate server-side before exact counting and pagination. Preserve status in the URL, search submissions, goal selections, and pagination links. Changing a status or goal filter resets pagination to page 1. Active matches the project's own status, not its parent goal's status, and does not mutate records. Invalid status parameters safely normalize to All statuses. Preserve distinct true-empty, no-match, and read-error states.

**Rationale:** An Active-only view must work over the entire dataset and coexist with existing list controls.

### P2 - Project Breadcrumbs Follow the Origin

**Stories:** 4.3 and 4.6 navigation acceptance criteria.

**OLD:** Projects row links omit an origin. Detail falls back to the parent goal/Area; its current origin-aware trail can still insert the parent before the project.

**NEW:** Projects row links pass the full originating list URL, including status, goal, query, and page. With a valid origin, render Origin > Project; Projects-origin visits render Projects > Project, with Projects linking to that exact list URL. A validated origin takes precedence over the parent relationship. Without a valid origin, retain the existing parent-goal/Area/Projects fallback. Keep the goal association visible in existing detail controls and unchanged in storage. Use the same origin rule in the read-error trail.

**Rationale:** Navigation context and data hierarchy are distinct. A parent goal must not replace the route the user actually came from.

### P3 - Focus Linked Breadcrumbs

**Stories:** 7.2 acceptance criteria; 7.4 Focus entry navigation.

**OLD:** Focus renders only a non-linked Focus crumb.

**NEW:** Default trail: Engage > Focus, with Engage linked to `/app/engage`. When opened from Weekly Review, pass and validate its origin and render Weekly review > Focus with a working return link. Use the existing navigation helpers and shared breadcrumb component. Reject unsafe origins and use the default trail. Render the trail in both normal and read-error states. Returning to the review preserves its existing persisted phase.

**Rationale:** Focus needs a visible return destination, particularly during optional Get Creative review.

### P4 - Weekly Commitment Banner on Engage

**Stories:** 5.3 acceptance criteria; 5.5 completion-to-Engage criteria.

**OLD:** Review completion saves intention and blocker and returns to Engage. Engage displays actions but not the saved intention.

**NEW:** Show a read-only Weekly commitment banner above Engage's action controls containing the priority from the latest completed review and its saved date. Do not show the blocker. Keep the commitment visible until another completed review replaces it; it does not expire at the calendar-week boundary. Display it even when there are no committed actions or a context filter has no matches. Hide it when no completed snapshot exists. For snapshot-read failure, show an explicit non-blocking unavailable state rather than silently hiding it. Draft reviews must not replace the displayed completed commitment. Reuse saved snapshot data and preserve the actual action model.

**Rationale:** Daily work should retain the user's weekly context without creating another plan or another source of truth.

### PRD Amendments

**FR95 - Projects filtering**

- OLD: "The Projects view SHALL support filtering by all projects, a selected goal, or projects with no goal."
- NEW: Retain parent-goal filtering and add independent filtering by All statuses, Active, Paused, Someday/Maybe, Completed, or Archived. Filters SHALL combine with text search, apply before pagination/counting, persist in the URL, and reset pagination when changed.

**FR100 - Focus view**

- OLD: Focus lets the user manage the profile and Areas and see linked Goals and Projects.
- NEW: Retain those capabilities and require a linked return trail: Engage by default, or Weekly Review when opened from that flow, using a validated origin and preserving review progress.

**Engage FR-group - add weekly context clause**

- OLD: FR65-FR68 describe committed actions, context filtering, completion prompting, and stuck projects without a saved weekly-priority display.
- NEW: Engage SHALL display the latest completed review's saved intention as a read-only Weekly commitment banner with its saved date until superseded. The blocker SHALL NOT be displayed. Absence and read failure SHALL be distinct; a snapshot failure SHALL NOT block action use. Committed actions remain the work plan.

**MVP impact:** Small additive usability scope; no change to GTD invariants, auth boundaries, or notification exclusions.

### Architecture Amendments

**AD-8 - navigation context**

- OLD: Defines the authenticated shell; breadcrumb origin precedence is not specified.
- NEW: Add validated same-origin return trails. A valid origin wins over the project parent relationship; absent/unsafe origins use documented fallbacks. Preserve list query state in Projects-origin links.

**AD-16 - review snapshot reuse**

- OLD: Completed snapshots feed the next review's opening display.
- NEW: The same completed snapshot also feeds Engage's read-only weekly banner through a bounded user-scoped read, ordered by review completion. Keep draft/completed and absent/error states distinct; add no write or schema contract.

**AD-23 - list filtering**

- OLD: Server-side `q`/`page` handling, ranged queries with exact counts, and preserved goal filters.
- NEW: Validate the Projects status parameter and combine its predicate with goal/search before counting and ranging. Preserve all list state in links; reset the page when filters change.

**Data-flow update:** Add completed weekly snapshot -> Engage banner to the Weekly Review/Daily Engage diagrams. No new service or storage component.

### UI/UX Amendments

**EXPERIENCE.md**

- Projects List: OLD goal-only filter -> NEW independent goal and status filters that combine with search and preserve the URL.
- Project Detail: OLD parent-based breadcrumb -> NEW Origin > Project when origin is valid, otherwise existing parent fallback.
- Focus Page: OLD no linked return requirement -> NEW Engage > Focus or Weekly review > Focus.
- Engage View: OLD action-only daily surface -> NEW weekly intention banner above controls, independent of action-empty/filter states; distinct unavailable state on snapshot read failure.
- Weekly Snapshot Closing: OLD save and return to Engage -> NEW save and return with the newly completed intention visible in the banner.

**DESIGN.md**

- OLD: No concrete Projects status-filter or Engage weekly-banner specification; Focus has no linked-return specification.
- NEW: Use existing form tokens for a labeled keyboard-operable status selector. Use shared breadcrumb styling and `aria-current="page"`. Render the weekly reminder as a compact, non-alert informational band using existing surface/text tokens, not a modal, decorative card section, or warning. Wrap priority text and date on narrow screens; retain accessible contrast and touch targets on navigation links. Do not introduce new palette, typography, or layout tokens.

## 5. Implementation Handoff

**Recipient:** Developer agent. Final approval obtained; handoff package ready for direct implementation.

**Responsibilities:** Apply the supporting PRD, epic acceptance-criteria, architecture, and UX amendments; implement the four scoped behaviors; add focused tests alongside existing tests; and verify the user-facing flows. Routing is recorded in this document; no Developer agent execution has been started by the Correct Course workflow.

**Next step:** The Developer agent uses this approved proposal as its implementation input, follows the suggested order in Section 3, and verifies every success criterion below before recording implementation completion. No Product Owner backlog reorganization or Product Manager/Architect escalation is required. The 1-2 developer day estimate remains provisional, not a delivery commitment.

**Tracking:** No epic/story additions are proposed, so no new backlog IDs are needed. The four approved follow-up changes are tracked as open Developer action items in `sprint-status.yaml`, preserving existing story statuses. Keep affected work pending verification; record completion in existing story artifacts and sprint tracking only after implementation. Do not mark an entire epic complete for this change.

### Success Criteria and Verification

1. Status: Active-only excludes Paused/Someday/Completed/Archived; goal + status + search intersect correctly across more than 20 records. Exact counts, reset-to-first-page, invalid status, empty/error states, and URL preservation are tested.
2. Project navigation: Goal-linked and standalone projects opened from a filtered Projects list return to the exact list URL. Valid origins suppress the misleading parent-return crumb. Direct visits retain fallback navigation; unsafe origins are rejected. Check success and read-error states.
3. Focus navigation: Default Engage link and Weekly Review origin link work on desktop/mobile, by keyboard, and in read-error states. Returning from optional Focus review restores the current review phase.
4. Banner: Shows the latest completed priority and saved date, hides the blocker, survives reload and week/year boundaries, appears with empty actions, and is replaced after a new review completes. Test no snapshot, draft review, deterministic ordering, user isolation, and non-blocking read failure.
5. Run focused page/component/helper tests for changed behavior, lint and typecheck for the touched implementation, and desktop/mobile browser checks for wrapping, usable controls, and return links. Do not alter unrelated failing tests.

### Checklist Record

- [x] 1.1-1.3: Triggering stories mapped, requirements/gaps classified, user and local-source evidence recorded.
- [x] 2.1-2.5: Existing epics remain viable; affected stories identified; remaining epics/dependencies assessed; no new epic or resequencing required.
- [x] 3.1-3.4: PRD, architecture, UX, tests, tracking, and deployment impact assessed.
- [x] 4.1, 4.4: Direct adjustment evaluated and recommended with effort/risk/timeline caveats.
- [N/A] 4.2-4.3: Rollback and MVP reduction are not warranted.
- [x] 5.1-5.5: Issue, impacts, rationale, action plan, and conditional developer handoff included.
- [x] 6.1-6.2: Proposal completeness and consistency checked against the four individually approved behaviors.
- [x] 6.3: Mthizo explicitly approved the complete proposal for implementation on 2026-10-12.
- [N/A] 6.4: No epic/story additions, removals, or renumbering require tracking entries.
- [x] 6.5: Developer recipient, responsibilities, implementation order, success criteria, and provisional effort estimate finalized in the approved handoff package.

### Approval and Execution Log

- 2026-10-12: Mthizo selected Incremental mode.
- 2026-10-12: Confirmed Focus linked return trail, commitment lifetime until the next completed review, and priority-only banner content.
- 2026-10-12: P2 project-origin breadcrumbs approved individually.
- 2026-10-12: P3 Focus breadcrumbs approved individually.
- 2026-10-12: P4 weekly commitment banner approved individually.
- 2026-10-12: P1 project-status filter approved individually.
- 2026-10-12: Mthizo selected Continue after reading the complete draft.
- 2026-10-12: Mthizo answered yes to explicit complete-proposal implementation approval, including artifact updates and developer handoff.
- 2026-10-12: Minor scope confirmed; finalized proposal routed to the Developer agent through this handoff package. Correct Course workflow complete.
- 2026-10-12: Follow-up tracking corrected: P1-P4 added as open Developer action items in sprint-status.yaml; existing story statuses preserved.
- Implementation and canonical-artifact edits: not started by this workflow.