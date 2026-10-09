---
title: '7.2 Focus Page and Area Management'
type: 'feature'
created: '2026-10-04'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'd07b7f459ea565f6079f370a05273f92d9c90c05'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Archer has the persisted Focus profile and Area model, but users have no place to maintain their higher-horizon context or manage ongoing Life Areas.

**Approach:** Add an authenticated Focus page for editing Vision, Purpose, and Principles, managing Areas, and seeing linked Goals and standalone Projects. Use the existing owner-scoped model and established authenticated navigation and mutation patterns.

## Boundaries & Constraints

**Always:** Keep profile and Area data owner-scoped. Areas remain ongoing responsibilities; archive them without hard-deleting rows or detaching existing Goal/Project links. Show archived Areas in a separate section with a Restore action; restoring an Area preserves its links and appends it to the end of the active order. Show each linked record's status and link to its existing detail page. Keep profile fields optional and Principles as a list. Make Area reordering keyboard-operable and persist a valid reorder atomically.

**Never:** Change Story 7.1 tables, constraints, ownership protections, or TypeScript shapes without a demonstrated requirement. Do not implement Goal/Project Area assignment, inherited Area behavior, Get Creative integration, exports, or changes to Goal/Project lifecycle semantics. Never hard-delete an Area.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First profile edit | No profile row exists; user saves valid optional fields | Create the user's one profile row; later edits update it | Invalid fields return a validation error; no partial write |
| Area create/edit | Owned Area or new name and optional description | Persist bounded values; new Areas append to the ordered list | Reject blank/invalid values; foreign IDs cannot be changed |
| Reorder | Full ordered list of owned Area IDs | Persist the new order atomically | Reject duplicates, missing IDs, and foreign IDs without partial writes |
| Archive linked Area | Area has linked Goals or standalone Projects | Mark archived; preserve all links and existing records | Report mutation failure; never fall back to hard delete |
| Restore archived Area | User restores one of their archived Areas | Clear archive state and append it after active Areas without changing links | Reject foreign IDs; report mutation failure |

</frozen-after-approval>

## Code Map

- `components/authenticated/nav-items.ts` -- shared desktop/mobile navigation source; add Focus here.
- `app/app/goals/page.tsx` and `components/goals/GoalRow.tsx` -- authenticated server read, RLS-scoped queries, status and detail-link presentation to adapt for Area roll-ups.
- `app/api/goals/[id]/route.ts` and `lib/goals/validate.ts` -- auth-first mutation, owner guard, bounded server-side validation patterns.
- `components/projects/ActionList.tsx` and `app/api/projects/[id]/actions/route.ts` -- keyboard-operable move controls and full-list reorder contract.
- `supabase/migrations/20261002120000_atomic_writes.sql` -- `reorder_project_actions` transaction and grant pattern; add a narrowly scoped Area reorder function in a new migration.
- `supabase/migrations/20261004082751_focus_profile_areas.sql` and `lib/supabase/schema.ts` -- existing Focus schema and authoritative types; consume them, do not duplicate or weaken them.
- `app/app/layout.test.tsx`, `components/authenticated/Sidebar.test.tsx`, and `components/authenticated/BottomNav.test.tsx` -- authenticated shell and navigation test surfaces.
- `supabase/tests/focus_profile_areas_test.sql` -- pgTAP conventions for ownership, grants, and Area constraints.

## Tasks & Acceptance

**Execution:**
- [x] `lib/focus/validate.ts` and `lib/focus/validate.test.ts` -- validate profile and Area create/update payloads with bounded text and list inputs.
- [x] `app/api/focus/profile/route.ts` and `app/api/focus/profile/route.test.ts` -- save the signed-in user's profile, creating it on first save and rejecting invalid input.
- [x] `app/api/areas/route.ts`, `app/api/areas/[id]/route.ts`, and their route tests -- create, edit, archive, and restore Areas; enforce authenticated ownership and never expose hard-delete.
- [x] `supabase/migrations/20261004120000_reorder_focus_areas.sql` and `lib/supabase/schema.ts` -- add the authenticated atomic Area-reorder RPC and its typed function contract without altering Story 7.1 tables or policies.
- [x] `app/api/areas/reorder/route.ts` and `app/api/areas/reorder/route.test.ts` -- validate and persist a complete ordered list for the signed-in user's active Areas; reject duplicate, missing, or foreign IDs without partial writes.
- [x] `app/app/focus/page.tsx` and `components/focus/` -- render and edit the profile, active and archived Area sections, and linked Goal/standalone Project rows using existing detail links and statuses. Include only Projects with `goal_id IS NULL` in direct Area roll-ups.
- [x] `components/authenticated/nav-items.ts`, `components/authenticated/Sidebar.test.tsx`, `components/authenticated/BottomNav.test.tsx`, and `app/app/focus/page.test.tsx` -- expose Focus in desktop/mobile navigation and cover active state, loading, empty, linked, and error states.
- [x] `supabase/tests/focus_areas_reorder_test.sql` -- verify atomic ordering, owner isolation, and invalid-list rejection for the reorder RPC.

**Acceptance Criteria:**
- Given an authenticated user visits `/app/focus`, when their data loads, then the page shows editable Vision, Purpose, Principles, ordered active Areas, and each Area's linked Goals and direct standalone Projects (`goal_id IS NULL`) with status badges and working detail links; archived Areas appear in a separate section.
- Given a user saves valid profile or Area edits, when the write succeeds, then changes persist for that user only and survive refresh; invalid input is rejected without partial updates.
- Given a user reorders active Areas with keyboard-operable controls, when the submitted order contains exactly their active Area IDs, then the new order persists atomically; incomplete, duplicate, or foreign IDs cause no write.
- Given a user archives an Area with linked records, when the archive succeeds, then the Area is retained as archived and existing links remain unchanged; the page never hard-deletes or detaches those records.
- Given a user restores one of their archived Areas, when the restore succeeds, then its links remain unchanged and it appears at the end of the active Area order.
- Given a profile, Area, or linked-record read fails, when the page renders, then it presents the established read-error state without exposing another user's data.

</frozen-after-approval>

## Implementation Notes

- Added the authenticated Focus page with profile editing, ordered active Areas, a separate archived section with Restore, and links to associated Goals and standalone Projects.
- Added owner-scoped profile and Area APIs. Area archive and restore only update the Area row; neither operation deletes Areas or changes linked records.
- Added an invoker-security Area reorder RPC that locks active Area rows, checks the complete ID set, and atomically writes order. Explicitly revoked execution from `anon` and `public`; granted it to `authenticated`.
- Added validator, route, page, navigation, and pgTAP coverage. The first database test run exposed an anonymous RPC grant and an incorrect test plan; both were fixed and the full database suite then passed.

## Verification

**Commands:**
- `npx tsc --noEmit` -- passed.
- `npx vitest run lib/focus/validate.test.ts app/api/focus/profile/route.test.ts app/api/areas/route.test.ts 'app/api/areas/[id]/route.test.ts' app/api/areas/reorder/route.test.ts app/app/focus/page.test.tsx components/authenticated/Sidebar.test.tsx components/authenticated/BottomNav.test.tsx` -- passed, 51 tests across 8 files.
- `npx --yes supabase@latest test db` -- passed, 54 pgTAP assertions across 2 files.
- `npm run lint` -- passed.
- `npm run build` -- passed.

## Spec Change Log

## Review Triage Log

- **low:** Concurrent Area creates can read the same maximum `sort_order` and append with a tie; this needs simultaneous requests and would require a new atomic insert path to prevent.
- **low:** Concurrent Area restores and creates can read the same maximum `sort_order` and append with a tie; the same rare append race would require an additional database mutation surface to prevent.
- **low:** Concurrent create or restore operations can select the same append position; this repeats the two separately reported append-race cases and remains a rare concurrency-only tie without an everyday user impact.
- **low:** Profile text could exceed server validation bounds in the editor, causing a rejected save; client validation now shares the server sanitizer and gives a specific limit message.
- **low:** Area creation used a single-line description input unlike editing, impeding multiline entry; creation now uses a textarea with the same length bound.
- **low:** A successful profile save had no confirmation; the page now announces `Profile saved.` through a polite live region.
- **medium:** Page-level tests did not exercise profile and Area UI mutations, so broken request wiring could pass route tests; added profile-save, Area create/edit/archive/restore, and reorder interaction tests.
- **medium:** The page-level tests did not separately cover profile and Area read failures required by acceptance; added both cases.
- **low:** Linked Goal and Project order depended on the database's unspecified return order; results are now sorted by display name and covered by a page test.
- **low:** The page loads all Areas in two `.in(...)` reads with no explicit cardinality bound; no expected account size or scale failure was demonstrated, and batching/limits would add complexity beyond this focused story, so this is rejected.
- **low:** The RPC's null-user guard lacked a direct test; added an authenticated-role call with no owner claim and verified the `42501` rejection.
- **medium:** No page-level test verified the profile form's endpoint, payload, or successful refresh; added the assertion.
- **medium:** No page-level test verified Area create/edit/archive/restore request payloads; added assertions for all four actions.
- **medium:** No page-level test verified the reorder control's generated full ID order; added a move-down interaction assertion.

