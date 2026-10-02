---
title: "Frictionless Inbox Capture"
type: "feature"
created: "2026-09-28"
status: "done"
review_loop_iteration: 1
context: []
baseline_commit: "af069e219c5c6f95fb65b2763239b23bed28798f"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A signed-in user has no way to capture raw thoughts. The Inbox page is a placeholder `<h1>`, and the persistent floating capture button's `handleCapture` is a documented no-op — so ideas get lost while the user is working in any other view.

**Approach:** Build the Inbox view (auto-focused capture input + a list of captured items with timestamps, Process/Delete controls, and a 7+ day amber flag), add an `/api/inbox` route for create/delete, and wire the existing `FloatingCapture` stub to open a new capture drawer reachable from any authenticated view. Capture stores raw text only — no classification. Processing/clarify is out of scope (Story 5.2).

## Boundaries & Constraints

**Always:**

- Capture accepts raw text (1–2000 chars) with **no required classification** — no project, tag, or AI processing at capture time.
- The capture input on the Inbox page is auto-focused on load; Enter OR a "Capture" button saves.
- The floating capture button + `C` shortcut open a drawer with the text field focused, WITHOUT navigating away from the current view.
- Reuse existing conventions: Supabase server client (`lib/supabase/server.ts`), API-route mutations scoped by `.eq("user_id", userId)` + RLS, client `fetch` + `router.refresh()`, inline `role="alert"` errors (no toast system exists), and the amber warning tokens (`--color-warning` / `bg-warning-subtle`) exactly as `StuckIndicator` uses them.
- Delete sets/uses the existing enum value `'trashed'` semantics; a removed inbox item must not appear in the list. (Hard delete row is acceptable for capture-stage items since no processing links exist yet.)
- The 7+ day flag is computed from `captured_at` vs. now; the row shows an amber "Unprocessed for 7+ days" flag only for `processing_status = 'unprocessed'` items older than 7 days.

**Ask First:**

- Any change to the `inbox_items` schema/migration (the table already exists — do not alter it).
- Introducing a new dependency (date library, drawer/UI library, toast library) — the repo currently has none of these by design.

**Never:**

- Do NOT implement the clarify/processing flow, actionable/non-actionable branching, or `resolved_project_id` assignment (Story 5.2). The "Process" control may exist but only needs to route toward that future flow — for this story it can be a disabled/placeholder affordance or simply navigate to the item; do not build processing logic.
- Do NOT add confetti/celebration to the empty state.
- Do NOT change the `C` shortcut key-handling logic in `FloatingCapture` (it is already correct) — only replace the no-op `handleCapture`.

## I/O & Edge-Case Matrix

| Scenario                       | Input / State                                    | Expected Output / Behavior                                                                                    | Error Handling                                           |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Capture happy path             | Non-empty `raw_text` ≤ 2000 chars, authenticated | POST inserts `inbox_items` row (`user_id`, `raw_text`, defaults); UI clears input, keeps focus, shows new row | N/A                                                      |
| Empty / whitespace text        | `raw_text` trims to ""                           | Save disabled / no request fired                                                                              | Inline: input stays, no error toast needed               |
| Over-length text               | `raw_text` > 2000 chars                          | Rejected before insert                                                                                        | 400 from API; inline `role="alert"` message              |
| Unauthenticated                | No session                                       | 401 from API                                                                                                  | Inline error; (route guard already redirects `/app/*`)   |
| Delete item                    | Valid owned id                                   | Row removed; disappears from list                                                                             | 404 if not owned/unknown; 500 on db error → inline error |
| 7+ day unprocessed item        | `captured_at` > 7 days ago, `unprocessed`        | Row renders amber "Unprocessed for 7+ days" flag                                                              | N/A                                                      |
| Empty inbox                    | Zero rows                                        | Empty state reads "Inbox zero." (no celebration)                                                              | N/A                                                      |
| Drawer capture from other view | `C` / FAB pressed on e.g. /app/goals             | Drawer opens, text field focused, no navigation; save inserts and closes drawer                               | Inline error inside drawer on failure                    |

</frozen-after-approval>

## Code Map

- `app/app/inbox/page.tsx` -- placeholder `<h1>Inbox</h1>` to REPLACE with a server component that reads `inbox_items` (via `createClient()`, RLS-scoped, ordered by `captured_at desc`) and renders the capture form + list client component.
- `components/authenticated/FloatingCapture.tsx` -- existing FAB + `C` shortcut (shortcut logic DONE, correct). `handleCapture` is a no-op to REWIRE to open the new capture drawer. Keep `isEditableTarget` guard and modifier/IME handling untouched.
- `app/app/layout.tsx` -- app shell (server) that mounts `<FloatingCapture />` on every `/app/*` view. The global capture drawer must be reachable here so it works from any view; FloatingCapture is the natural owner of the drawer state since it already holds the trigger.
- `components/projects/ActionList.tsx` -- canonical client patterns to MIRROR: `useState` (no form lib), Enter-or-click submit, shared `call(url, method, body)` fetch helper + `router.refresh()`, inline `role="alert" aria-live="assertive"` error div, and the hand-rolled modal idiom (`fixed inset-0 z-50 ... bg-black/40`, `role="dialog"`, `aria-modal`, `tabIndex={-1}`, focus via ref+useEffect, Escape-to-close) to ADAPT into a slide-in drawer with an auto-focused input.
- `app/api/actions/[id]/route.ts` -- representative API-route mutation to MIRROR for inbox: local `getAuthenticatedUserId()` → 401; JSON parse → 400; `.eq("user_id", userId)` + RLS; `.select("id").maybeSingle()`; 404 on `!data`; 500 + `console.error("[api/...]")` on error.
- `components/projects/StuckIndicator.tsx` -- exact amber-band token usage to REUSE for the "Unprocessed for 7+ days" flag: `border-[var(--color-warning)] bg-warning-subtle text-warning`.
- `components/goals/GoalRow.tsx` -- only existing date-format example (`Intl` + UTC to avoid drift); pattern to follow for the capture timestamp + 7-day math (compute inline; no date lib).
- `lib/supabase/schema.ts` -- generated types already include `InboxItem`, `InboxItemInsert`, `InboxItemUpdate`, and `InboxProcessingStatus = 'unprocessed' | 'processed' | 'trashed'`. Import these; do not redefine.
- `app/globals.css` -- `@theme` warning tokens (`--color-warning`, `--color-warning-subtle`) already present; no change needed.

## Tasks & Acceptance

**Execution:**

- [x] `app/api/inbox/route.ts` -- NEW. `POST` inserts an `inbox_items` row for the authenticated user (validate `raw_text`: trim, non-empty, ≤ 2000 chars → 400 otherwise); returns `{ id }`. Mirror auth/error shape from `app/api/actions/[id]/route.ts`.
- [x] `app/api/inbox/[id]/route.ts` -- NEW. `DELETE` removes an owned inbox item (`.eq("id", id).eq("user_id", userId).select("id").maybeSingle()`, 404 if `!data`). Returns `{ id }`.
- [x] `lib/inbox/validate.ts` -- NEW. `sanitizeInboxText(input): string | null` (trim, length bounds) mirroring `lib/actions/validate.ts`; used by the POST route and unit-tested for the I/O matrix edge cases.
- [x] `lib/inbox/overdue.ts` -- NEW. Small pure helper `isUnprocessedOverdue(item, now)` / `daysSince(iso, now)` for the 7+ day threshold; unit-tested (boundary at exactly 7 days).
- [x] `components/inbox/InboxCaptureForm.tsx` -- NEW `"use client"`. Auto-focused input (ref + `autoFocus`), Enter or "Capture" button saves via `fetch('/api/inbox', POST)` then `router.refresh()`; disabled while busy or empty; inline `role="alert"` error. The Enter handler MUST ignore IME composition (`e.nativeEvent.isComposing` / keyCode 229) so a composing Enter never submits.
- [x] `components/inbox/InboxList.tsx` -- NEW `"use client"`. Renders rows (raw text, formatted `captured_at`, Process + Delete controls); amber "Unprocessed for 7+ days" flag via the overdue helper + warning tokens; Delete calls `DELETE /api/inbox/[id]` + `router.refresh()`. "Process" is a placeholder affordance routing toward Story 5.2 (no processing logic). Empty state renders "Inbox zero." The timestamp formatter MUST guard an unparseable/`Invalid Date` value (fall back to the raw string rather than rendering "Invalid Date").
- [x] `app/app/inbox/page.tsx` -- REPLACE placeholder with a server component that loads inbox items (RLS-scoped, `captured_at desc`, try/catch → `[]`) and renders `InboxCaptureForm` + `InboxList`. Keep `metadata`.
- [x] `components/inbox/CaptureDrawer.tsx` -- NEW `"use client"`. Slide-in drawer adapting the ActionList modal idiom: `role="dialog"`, `aria-modal`, auto-focus the text field on open, Escape closes, backdrop click closes. Enter/Capture saves via `POST /api/inbox`, closes on success, inline error on failure. Does not navigate. On close (Escape, backdrop, close button, or successful save) it MUST restore focus to the element that was focused before it opened (the triggering FAB) — capture `document.activeElement` on mount and refocus it on unmount. Full Tab-cycling focus containment is explicitly OUT of scope (deferred to the epic-H shared modal primitive); the Enter IME guard also applies here.
- [x] `components/authenticated/FloatingCapture.tsx` -- REWIRE `handleCapture` to open `CaptureDrawer` (lift drawer open-state into this component). Ignore the `C` shortcut / click when the drawer is already open. Leave the `C`-shortcut key handling, guards, and button markup otherwise unchanged.
- [x] `app/api/inbox/route.test.ts` -- NEW. Route test mocking `lib/supabase/server` (mirror `app/api/generate/route.test.ts` / the Epic 4 `route.test.ts` idiom). Cover the POST matrix rows: 401 when unauthenticated (and no insert), 400 on invalid JSON, 400 when sanitized text is null (empty/whitespace/over-length), `{ id }` on success with the row carrying the acting `user_id`, and 500 when the insert errors/returns no row.
- [x] `app/api/inbox/[id]/route.test.ts` -- NEW. Route test mocking the Supabase delete chain. Cover: 401 unauthenticated, 404 on `!data` (non-owned/unknown id), 500 on db error, `{ id }` on success, AND assert the query is scoped by `.eq("user_id", userId)` (the app-layer half of the cross-user security boundary).
- [x] `components/inbox/InboxList.test.tsx` -- NEW. Render test (mirror `components/projects/ActionList.test.tsx`, mock `next/navigation`): with a fixed `now`, an item > 7 days old shows the amber "Unprocessed for 7+ days" flag and an exactly-7-day item does not; an empty list renders "Inbox zero."; clicking Delete issues `DELETE /api/inbox/[id]` (mock `fetch`).
- [x] `components/inbox/CaptureDrawer.test.tsx` -- NEW. Render test (mock `next/navigation` + `fetch`): opening focuses the input; Enter/Capture POSTs to `/api/inbox` and closes on success; a failed request shows the inline `role="alert"` error and keeps the drawer open; Escape closes; no navigation occurs.
- [x] `components/authenticated/FloatingCapture.test.tsx` -- EXTEND. Keep existing FAB-label and `C`-shortcut assertions; add: triggering capture (click and `C`) renders the drawer (`role="dialog"`), and pressing `C` again while open does not re-trigger. (The `next/navigation` mock is required since the drawer uses `useRouter`.)

**Acceptance Criteria:**

- Given the Inbox view, when it loads, then a single text input is auto-focused and accepts raw text with no required classification, and pressing Enter or clicking "Capture" saves the item and it appears in the list.
- Given any authenticated view, when I press `C` or tap the floating capture button, then a capture drawer opens with the text field focused and the current page does not navigate; saving adds the item to the inbox.
- Given captured items, when the list renders, then each row shows the raw text, a capture timestamp, and Process/Delete controls; and any unprocessed item older than 7 days shows an amber "Unprocessed for 7+ days" flag.
- Given an empty inbox, when it renders, then it shows "Inbox zero." with no celebration.
- Given a delete, when I remove an item, then it disappears from the list and a non-owned/unknown id yields 404 from the API.

## Spec Change Log

### 2026-09-28 — review loop 1 (bad_spec)

- **Triggering finding:** The verification-gap and edge-case review layers found the change shipped only pure-helper unit tests (validate + overdue), omitting the `route.test.ts` for the POST/DELETE endpoints and the `.test.tsx` for the interactive surfaces that the repo convention (Epics 2–4) mandates. Consequently the DELETE user-scope security boundary and the POST status mapping had zero executed coverage, and the FAB→drawer rewire could regress green. Root cause was outside `<frozen-after-approval>`: the Verification section and Tasks list under-specified test coverage.
- **Amended:** Added explicit test tasks (`app/api/inbox/route.test.ts`, `app/api/inbox/[id]/route.test.ts`, `components/inbox/InboxList.test.tsx`, `components/inbox/CaptureDrawer.test.tsx`, and extension of `components/authenticated/FloatingCapture.test.tsx`), tied each I/O matrix row to an executed test in Verification, and added a Design Note pointing at the repo test idioms. Folded in small robustness requirements the reviewers surfaced: IME-composition guard on Enter (form + drawer), an `Invalid Date` guard in the timestamp formatter, focus-restore-to-opener on drawer close, and ignoring the `C` shortcut when the drawer is already open.
- **Known-bad state avoided:** A DELETE route whose `.eq("user_id", userId)` scope or 404/500 branches could be removed without any executed test failing; a POST whose auth/validation/status mapping was unverified; a drawer rewire that could silently revert to a no-op.
- **KEEP (must survive re-derivation):** The implementation approach was correct and should be reproduced — FloatingCapture owns the drawer open-state (no global provider); server page degrades read failures to `[]`; POST/DELETE mirror `app/api/actions/[id]/route.ts` exactly (auth→401, bad JSON→400, sanitize→400, RLS+`user_id` scope, `.select("id")` + 404 on `!data`, `console.error("[api/inbox …]")`); `sanitizeInboxText` mirrors `lib/actions/validate.ts` (MAX 2000); the overdue boundary is compared in milliseconds so "exactly 7 days" is NOT flagged; amber flag reuses the `StuckIndicator` warning-token pattern; inline `role="alert"` errors (no toast). Full Tab-cycling focus trap stays OUT of scope (deferred to epic-H H-2). Hard delete stays (intentional at capture stage).

## Design Notes

Drawer ownership: `FloatingCapture` already lives in the shell and owns the trigger (button + `C` shortcut), so it is the natural owner of the drawer open-state — this keeps "reachable from any view" true without a global provider. The Inbox page's own capture form is separate from the drawer (the page is already focused for capture); both POST to the same `/api/inbox` and both `router.refresh()`.

7-day math is inclusive-exclusive at the boundary — an item captured exactly 7 days ago is NOT yet flagged; strictly greater than 7 days is flagged. Compute against `Date.now()` on the client (the flag is presentational).

Testing follows the established repo convention: every mutation route ships a `route.test.ts` mocking `lib/supabase/server`, and every interactive surface ships a `.test.tsx` mocking `next/navigation` (+ `fetch` where used). See `app/api/generate/route.test.ts` and `components/projects/ActionList.test.tsx` for the idioms. The route tests are the executed coverage for the DELETE user-scope security boundary and the POST status mapping — do not rely on the pure-helper unit tests alone to cover the routes.

Focus restore vs. focus trap: CaptureDrawer restores focus to its opener on close (small, in scope). A full Tab-cycling focus trap is intentionally NOT built here — it is consolidated into the epic-H shared modal primitive (H-2), consistent with the Epic 4 confirm dialogs.

## Verification

**Commands:**

- `npm run lint` -- expected: no new errors in changed files.
- `npx tsc --noEmit` -- expected: typechecks clean (uses `InboxItem*` aliases from schema).
- `npm test -- --run` -- expected: ALL of the new tests pass and are actually executed (not skipped/filtered): the `sanitizeInboxText` and overdue unit tests, the POST and DELETE route tests, and the InboxList / CaptureDrawer / FloatingCapture component tests. Each I/O & Edge-Case Matrix row must be covered by at least one executed test — the POST/DELETE HTTP rows by the route tests, the flag/empty-state/delete rows by the component tests.
- `npm run build` -- expected: production build succeeds.

**Manual checks:**

- On `/app/inbox`, input is focused on load; capture via Enter and via button both add rows; empty inbox shows "Inbox zero."
- From `/app/goals`, press `C` → drawer opens focused, save adds item, page stays on /app/goals.
- Seed/adjust an item's `captured_at` to > 7 days ago → amber flag appears.

## Suggested Review Order

**Global capture wiring (design intent)**

- Entry point: the FAB now owns drawer open-state and is idempotent while open.
  [`FloatingCapture.tsx:44`](../../components/authenticated/FloatingCapture.tsx#L44)

- The global drawer: focus-restore, reset-on-reopen, IME-guarded Enter, no navigation.
  [`CaptureDrawer.tsx:40`](../../components/inbox/CaptureDrawer.tsx#L40)

**Server surface (security boundaries)**

- DELETE scoped by both id AND user_id (app-layer half of cross-user protection).
  [`route.ts:38`](../../app/api/inbox/[id]/route.ts#L38)

- POST: auth → validate → insert; mirrors the Epic 4 mutation shape.
  [`route.ts:44`](../../app/api/inbox/route.ts#L44)

- Pure, reused validator (1–2000 chars, trim).
  [`validate.ts:15`](../../lib/inbox/validate.ts#L15)

**Inbox page & list**

- Server read degrades to `[]`; excludes trashed; newest first.
  [`page.tsx:19`](../../app/app/inbox/page.tsx#L19)

- Amber 7+ day flag + "Inbox zero." empty state; Invalid-Date guard in formatter.
  [`InboxList.tsx:33`](../../components/inbox/InboxList.tsx#L33)

- Inbox-page capture form (auto-focus, keep-focus-after-save).
  [`InboxCaptureForm.tsx:24`](../../components/inbox/InboxCaptureForm.tsx#L24)

- Overdue boundary compared in ms so "exactly 7 days" is not flagged.
  [`overdue.ts:31`](../../lib/inbox/overdue.ts#L31)

**Tests (supporting)**

- DELETE user-scope assertion.
  [`route.test.ts:98`](../../app/api/inbox/[id]/route.test.ts#L98)

- POST matrix rows.
  [`route.test.ts:1`](../../app/api/inbox/route.test.ts#L1)

- Drawer: focus, save/close, error-keeps-open, reset-on-reopen.
  [`CaptureDrawer.test.tsx:1`](../../components/inbox/CaptureDrawer.test.tsx#L1)

- List: flag boundary, empty state, delete.
  [`InboxList.test.tsx:1`](../../components/inbox/InboxList.test.tsx#L1)
