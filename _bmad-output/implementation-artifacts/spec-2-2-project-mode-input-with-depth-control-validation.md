---
title: "Project Mode Input with Depth Control & Validation"
type: "feature"
created: "2026-09-27"
status: "done"
baseline_commit: "5d43cd2e60d08763327c3533ab9e13c81a838866"
review_loop_iteration: 0
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no authenticated Project Mode entry surface. Story 2.1 built the `/api/generate` endpoint, but a signed-in user has nowhere to type a project, choose a planning depth, and submit it. The route `/app/projects/new` does not exist.

**Approach:** Add the `/app/projects/new` page (inside the authenticated `/app` shell) rendering a client `ProjectModeInput` component: a single text input with the canonical placeholder, a Minimal (default) / Full GTD depth control built as an accessible radio-style toggle, a "Break it down" submit button, inline validation, and a live character counter past 400 chars. This story owns the input surface and all its client-side behavior; it emits a validated `{ input, depth }` to an `onSubmit` handler. The actual generation, save, and navigation are wired in Story 2.3, and loading/error/output rendering in Stories 2.4/2.5 — so the submit handler here is a thin, replaceable seam.

## Boundaries & Constraints

**Always:**

- The page lives at `app/app/projects/new/page.tsx` (a server component with `metadata`) and renders inside the existing authenticated `/app` shell (which already enforces auth). The interactive form is a `"use client"` component.
- A single text input shows the placeholder `e.g., Personal portfolio website deployed online`, accepts up to 500 characters (UI-enforced via `maxLength`), and shows a live character count only when the length is over 400.
- A depth control offers exactly two options — Minimal (default) and Full GTD — and does not obstruct the zero-friction default (a user can type and submit without touching it; Minimal is pre-selected).
- Empty or whitespace-only input blocks submission with inline validation (`role="alert"`), and no submit/generation is triggered.
- Enter (in the text input) and clicking "Break it down" are equivalent submit paths.
- On a valid submit, the component calls its `onSubmit({ input: trimmedInput, depth })` prop with `depth` being `'minimal' | 'full_gtd'` (matching the DB `planning_depth` enum).
- The depth control is keyboard-operable (arrow keys move selection, Enter/Space select), exposes ARIA selection state, each option meets a ≥44×44px target, and text/controls meet ≥4.5:1 contrast (reuse the design tokens).

**Ask First:**

- Wiring the submit to `fetch('/api/generate')`, saving, or navigating — that is Story 2.3. Here `onSubmit` is a prop the page supplies; keep the page's handler a minimal placeholder.

**Never:**

- Do not call `/api/generate`, save to Supabase, or navigate in this story (Stories 2.3+).
- Do not render generated output or a loading spinner as the deliverable of this story (Stories 2.4/2.5); a `disabled` prop is enough to reflect an in-flight state driven by the parent later.
- Do not reuse the MVP1 `components/ModeToggle` (Goal/Project) — this is a depth control, not a mode toggle.
- Do not exceed the two depth options.

## I/O & Edge-Case Matrix

| Scenario                | Input / State                          | Expected Output / Behavior                                    | Error Handling |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------- | -------------- |
| Default load            | page mounts                            | Empty input, Minimal preselected, no counter, button disabled | N/A            |
| Typing under 400        | `input.length <= 400`                  | No character counter shown                                    | N/A            |
| Typing over 400         | `input.length > 400`                   | Live counter shown (e.g. `431 / 500`)                         | N/A            |
| Hit 500 chars           | typing beyond 500                      | Input caps at 500 (maxLength)                                 | N/A            |
| Submit empty            | input empty/whitespace, click or Enter | Inline validation error, `onSubmit` NOT called                | `role="alert"` |
| Valid submit via button | non-empty input, Minimal               | `onSubmit({ input: trimmed, depth: 'minimal' })`              | N/A            |
| Valid submit via Enter  | non-empty input, Full GTD selected     | `onSubmit({ input: trimmed, depth: 'full_gtd' })`             | N/A            |
| Depth keyboard nav      | focus depth control, ArrowRight/Left   | Selection moves, ARIA state updates, focus follows            | N/A            |
| Disabled (in-flight)    | `disabled` prop true                   | Input + button disabled, submit blocked                       | N/A            |

</frozen-after-approval>

## Code Map

- `app/app/projects/new/page.tsx` -- **new.** Server component: exports `metadata` (`title: "New project — Archer"`), renders a heading and the `ProjectModeInput` client component. Mirrors the page shape of `app/app/goals/page.tsx` (metadata + heading) but delegates interaction to the client component. Supplies a minimal `onSubmit` seam (a small client wrapper) that Story 2.3 replaces with generation/save/navigate.
- `components/projects/ProjectModeInput.tsx` -- **new.** `"use client"` form component. Props: `onSubmit: (args: { input: string; depth: PlanningDepth }) => void`, `disabled?: boolean`. Owns local `input` + `depth` state, validation, the character counter (>400), Enter/button submit parity. Mirrors `components/InputSection.tsx` (validation + Enter handling + `useId` label/error wiring) and the button styling from `components/auth/SignInForm.tsx`.
- `components/projects/DepthControl.tsx` -- **new.** `"use client"` accessible two-option control (Minimal | Full GTD). Radiogroup pattern (`role="radiogroup"` + `role="radio"` options, or native `<input type="radio">`), arrow-key navigation, `aria-checked`, ≥44px targets, token-based styling. Structurally informed by `components/ModeToggle.tsx`'s roving-focus keyboard handling but a radio semantics (single-select from a set), NOT a tablist.
- `lib/supabase/schema.ts` -- **read-only.** `PlanningDepth = 'minimal' | 'full_gtd'` — import this type so the emitted `depth` matches the DB enum used by Story 2.3's save.
- `app/globals.css` -- **read-only.** Design tokens (`--color-primary`, `--radius-*`, `--color-focus-ring`, spacing) reused for styling; no new tokens needed.

## Tasks & Acceptance

**Execution:**

- [x] `components/projects/DepthControl.tsx` -- Accessible Minimal/Full-GTD radio-style control: value + onChange props, arrow-key roving selection, `aria-checked`, ≥44px targets, token styling. Minimal is the caller's default.
- [x] `components/projects/ProjectModeInput.tsx` -- The form: text input (placeholder, `maxLength={500}`), live counter when `>400`, `DepthControl` (default `minimal`), "Break it down" button, inline validation (empty/whitespace → `role="alert"`, no submit), Enter=button parity, calls `onSubmit({ input: trimmed, depth })`; honors `disabled`.
- [x] `app/app/projects/new/page.tsx` -- New route page: `metadata` + heading, renders `ProjectModeInput` with a minimal placeholder `onSubmit` seam (client wrapper) for Story 2.3 to replace.
- [x] `components/projects/ProjectModeInput.test.tsx` -- Cover the I/O matrix: default state (Minimal, button disabled), counter shows only over 400, empty/whitespace submit blocked with alert and no `onSubmit`, valid submit via button and via Enter emits `{ input: trimmed, depth }`, depth selection changes emitted depth, disabled blocks submit.
- [x] `components/projects/DepthControl.test.tsx` -- Cover accessibility/behavior: renders two options with radio semantics, default selection reflects value prop, click and ArrowLeft/Right change selection and fire onChange, `aria-checked` tracks selection.

**Acceptance Criteria:**

- Given the `/app/projects/new` view, when it loads, then a single text input shows the placeholder "e.g., Personal portfolio website deployed online", a depth control offers Minimal (default) and Full GTD, and the depth control does not obstruct the zero-friction default flow.
- Given the input, when I type, then it accepts up to 500 characters (UI-enforced) and shows a character count when over 400 characters.
- Given an empty or whitespace-only input, when I click "Break it down" or press Enter, then inline validation blocks submission and no generation occurs.
- Given valid input, when I press Enter or click the button, then the form submits (Enter and button are equivalent).
- Given the depth control, when inspected for accessibility, then it is keyboard-operable, exposes ARIA state, meets 44×44px, and meets 4.5:1 contrast.

## Design Notes

The depth control is single-select from a fixed set → radio semantics, not a tablist (that is the accessibility-correct fix vs. copying `ModeToggle`'s `role="tab"`). Keep `DepthControl` presentational/controlled (value + onChange) so Story 2.3 can lift depth into the generation call without refactoring. Emit `depth` as the DB enum literal (`'minimal' | 'full_gtd'`) directly so no mapping layer is needed at save time. The counter appears only past 400 to keep the default flow visually quiet, per the zero-friction principle.

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: new page + components type-check.
- `npm test` -- expected: new `ProjectModeInput`/`DepthControl` tests pass; existing suite green.
- `npm run lint` -- expected: no new errors.
- `npm run build` -- expected: succeeds; `/app/projects/new` route present; standalone intact.

**Manual checks:**

- Tab to the depth control, use arrow keys — selection and focus move together, `aria-checked` updates.
- Type >400 chars — counter appears; input stops at 500.

## Suggested Review Order

**The form (entry point)**

- Entry point — the input surface: local input/depth state, validation, counter, Enter/button submit parity.
  [`ProjectModeInput.tsx:37`](../../components/projects/ProjectModeInput.tsx#L37)

- Submit gate — empty/whitespace blocks with inline alert; valid submit emits `{ input: trimmed, depth }`.
  [`ProjectModeInput.tsx:59`](../../components/projects/ProjectModeInput.tsx#L59)

- Counter appears only past 400; `aria-describedby` composes counter + error IDs so both are announced.
  [`ProjectModeInput.tsx:91`](../../components/projects/ProjectModeInput.tsx#L91)

**The depth control (accessibility-critical)**

- Radiogroup semantics (not a tablist) — single-select from a fixed set, controlled value/onChange.
  [`DepthControl.tsx:80`](../../components/projects/DepthControl.tsx#L80)

- Keyboard model — directional arrows (Left/Up→Minimal, Right/Down→Full GTD), Enter/Space select, roving focus.
  [`DepthControl.tsx:52`](../../components/projects/DepthControl.tsx#L52)

**Route wiring**

- Server page: metadata + heading inside the authenticated `/app` shell.
  [`page.tsx:8`](../../app/app/projects/new/page.tsx#L8)

- Client seam holding the placeholder `onSubmit` that Story 2.3 replaces with generate/save/navigate.
  [`NewProjectClient.tsx:18`](../../app/app/projects/new/NewProjectClient.tsx#L18)

**Supporting**

- Form behavior coverage incl. counter boundaries (400/401/431) and the disabled Enter-path guard.
  [`ProjectModeInput.test.tsx:1`](../../components/projects/ProjectModeInput.test.tsx#L1)

- Depth control radio/aria/keyboard coverage.
  [`DepthControl.test.tsx:1`](../../components/projects/DepthControl.test.tsx#L1)
