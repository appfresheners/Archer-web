# Sprint Change Proposal - 2026-10-07 (Get Current + Breadcrumbs)

**Project:** Archer
**Status:** Approved and implemented (2026-10-07)
**Mode:** Incremental
**Scope classification:** Minor (direct implementation by Developer agent)

## 1. Issue Summary

Defects/usability gaps found in the Weekly Review "Get Current" phase and navigation:

- "Confirm next action" only calls `onReviewed(project.id)` (client-side session state). The only visible effect is a small "reviewed" text in the card header, so the click appears to do nothing.
- `GetCurrentPanel` renders every available action of every active project as a button, flooding the page.
- Breadcrumbs exist only on project detail (`app/app/projects/[id]/page.tsx`) and ignore where the user came from. Goal detail, inbox item, monthly review, and the `new` pages have none or ad-hoc "Back" links.

## 2. Impact Analysis

- **Epics:** Epic 5 (Weekly Review, story 5.6 Get Current); navigation cross-cuts Epics 3-5.
- **PRD/Architecture/UX:** No requirement changes. UX gains a consistent breadcrumb pattern.
- **Technical:** `GetCurrentPanel`, `StuckIndicator`, new shared `Breadcrumbs` component and `from` param helper, detail/new pages, related tests.

## 3. Recommended Approach

Direct Adjustment. Low risk, no data-model or API changes.

## 4. Change Proposals

### P1 - Confirm button shows a confirmed state
`components/review/phase-panels/GetCurrentPanel.tsx`
- OLD: Button always reads "Confirm next action"; reviewed state is a faint header suffix.
- NEW: After click the button reads "Confirmed", is disabled with a check, and the card is visibly marked reviewed.

### P2 - Remove inline action list
`components/review/phase-panels/GetCurrentPanel.tsx`
- OLD: Every available action rendered as a commit button.
- NEW: List removed. Stuck projects: "Commit one now" links to `/app/projects/{id}?from=/app/review#actions`. Non-stuck projects: a "Change next action" link to the same target. The commit-via-API handler in the panel is removed.

### P3 - Shared origin-aware breadcrumbs
- New `components/shared/Breadcrumbs.tsx` (`<nav aria-label="Breadcrumb">`, ordered list, last item `aria-current="page"`).
- New `lib/navigation/from.ts`: `safeFrom(value)` accepts only same-origin `/app/...` paths (rejects `//`, schemes, backslashes) and `labelForPath(path)` maps paths to labels (Weekly review, Engage, Inbox, Projects, Goals, Focus).
- Project detail: trail is `Origin (if from) > Goal/Area/Projects > Project`. Without `from`, behaviour matches today.
- Goal detail, inbox item, monthly review, goals/new, projects/new: use `Breadcrumbs`.
- `EngageBoard` "Commit one now" and other project links pass `?from=`.

## 5. Implementation Handoff

Minor: Developer agent implements, updates tests (`GetCurrentPanel`, `StuckIndicator`, project detail page, new helper/component), runs `vitest`, lint, and typecheck.

Success criteria: Confirm click gives visible feedback; Get Current lists no per-action buttons; every `/app` sub-page has a working breadcrumb; coming from the review page, the project breadcrumb returns to the review.
