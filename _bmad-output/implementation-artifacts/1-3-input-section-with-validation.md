---
baseline_commit: c9970241e763dd47f736985a64b95166cf7e73b4
---

# Story 1.3: Input Section with Validation

Status: review

## Story

As a user,
I want a text input with helpful placeholder text and clear submission options,
so that I know exactly what to type and how to generate my GTD breakdown.

## Acceptance Criteria

1. **Given** Goal mode is active **When** I view the input field **Then** placeholder text reads "e.g., Become a proficient guitarist in 3 months"
2. **Given** Project mode is active **When** I view the input field **Then** placeholder text reads "e.g., Personal portfolio website deployed online"
3. **Given** the input is empty **When** I view the Generate button **Then** it appears visually muted/disabled with `aria-disabled="true"`
4. **Given** I have typed text in the input **When** I view the Generate button **Then** it appears as a full-width primary blue button, enabled
5. **Given** the input is empty or whitespace-only **When** I click the Generate button or press Enter **Then** inline validation appears: "Enter a goal or project first" **And** no generation occurs
6. **Given** I have typed valid text **When** I press Enter **Then** the form submits (same as clicking the button)
7. **Given** the input field receives focus **When** I inspect the styling **Then** a primary-colored border and soft focus ring appear
8. **Given** any interactive element on the page **When** measured on mobile **Then** touch target is minimum 44×44px

## Tasks / Subtasks

- [x] Task 1: Create InputSection component file (AC: #1, #2, #3, #4, #7, #8)
  - [x] Create `components/InputSection.tsx`
  - [x] Define props interface: `{ mode: 'goal' | 'project'; inputText: string; onInputChange: (text: string) => void; onSubmit: () => void }`
  - [x] Implement `<input>` element with mode-dependent placeholder text
  - [x] Style input: full-width, `rounded-[var(--radius-sm)]`, `border border-border`, `bg-background`, padding `py-3 px-4`, `text-text-primary`, `placeholder:text-text-muted`
  - [x] Focus state: `focus:border-primary focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:outline-none`
  - [x] Minimum height 44px for touch target compliance
  - [x] Implement Generate button below input — full-width primary style
  - [x] Button enabled state: `bg-primary text-white font-bold hover:bg-primary-hover` with `min-h-[44px]`
  - [x] Button disabled state: `bg-primary/40 text-white/60 cursor-not-allowed` with `aria-disabled="true"` (NOT `disabled` attribute — allows click for validation)
  - [x] Handle `onKeyDown` on input: Enter key triggers `onSubmit`
  - [x] Handle button click: triggers `onSubmit`

- [x] Task 2: Implement inline validation (AC: #5)
  - [x] Add local `useState<string>('')` for `validationError` inside InputSection
  - [x] On submit attempt (Enter or button click): if `inputText.trim() === ''`, set validationError to "Enter a goal or project first"
  - [x] Clear validationError when user starts typing (on any `onInputChange` call)
  - [x] Render error message below input when validationError is non-empty: `<p role="alert" className="text-sm text-red-600 mt-1">{validationError}</p>`
  - [x] Connect input to error via `aria-describedby` pointing to error element id
  - [x] Only call `onSubmit` prop when input is non-empty after trim

- [x] Task 3: Integrate InputSection into page.tsx (AC: #1–#8)
  - [x] Import InputSection into `app/page.tsx`
  - [x] Wire `inputText` state and `setInputText` to InputSection's `onInputChange`
  - [x] Remove the `// eslint-disable-line` comment on `inputText` (no longer unused)
  - [x] Create `handleSubmit` function: for now, `console.log('Submit:', inputText)` (generation in Epic 2)
  - [x] Place InputSection below ModeToggle with `mt-[var(--spacing-section-y)]` spacing
  - [x] Verify existing ModeToggle still clears input on mode change (already wired)

- [x] Task 4: Accessibility and keyboard behavior (AC: #5, #6, #7, #8)
  - [x] Add `<label>` for input field (visually hidden via `sr-only` class): "Enter your {mode}"
  - [x] Ensure tab order: ModeToggle → Input → Generate button (natural DOM order)
  - [x] Verify Enter key submission works without form element wrapping (pure keydown handler)
  - [x] Button uses `type="button"` (not submit) to prevent form behaviors — submit logic is in JS
  - [x] Focus ring uses design token color `--color-focus-ring` (#2563EB40)
  - [x] aria-disabled on button (not HTML disabled) so screen readers still find and announce it

- [x] Task 5: Visual polish and responsive behavior (AC: #7, #8)
  - [x] Input and button fill full container width on all viewports
  - [x] Button text: "Generate" (matches EXPERIENCE.md "Break it down" OR "Generate" — use "Generate" per FR7)
  - [x] Vertical spacing between input and button: `mt-4` (16px)
  - [x] Vertical spacing between validation error and button: error appears between input and button
  - [x] Motion: button hover transition uses `motion-safe:transition-colors motion-safe:duration-150`
  - [x] Test at 375px, 768px, 1440px — all elements accessible, no overflow

- [x] Task 6: Verify build and lint (AC: all)
  - [x] Run `npm run build` — confirm zero errors, static export succeeds
  - [x] Run `npm run lint` — confirm zero ESLint errors
  - [x] Run `npm run test` — confirm all existing tests pass plus new InputSection tests

## Dev Notes

### Architecture Compliance

- **AD-2**: Component lives in `components/InputSection.tsx`. Page orchestrates state.
- **AD-3**: State management is `useState` in `page.tsx`. No external state library. Validation error state is local to InputSection (UI-only concern).
- **AD-5**: Tailwind utility classes only. NO component libraries (no shadcn, Radix, Headless UI, React Aria). The input and button are built from scratch with native HTML elements.
- **Boundary Rule #1**: Components receive props and emit callbacks. InputSection does NOT manage `inputText` state — it receives it and calls `onInputChange`. Validation error is an internal UI concern (acceptable local state).

### Component Interface

```typescript
// components/InputSection.tsx
interface InputSectionProps {
  mode: "goal" | "project";
  inputText: string;
  onInputChange: (text: string) => void;
  onSubmit: () => void;
}
```

### Critical: aria-disabled vs disabled Attribute

Use `aria-disabled="true"` on the button — NOT the HTML `disabled` attribute. Reason:

- HTML `disabled` removes the button from tab order (inaccessible via keyboard)
- HTML `disabled` prevents click events (we need click to trigger validation message)
- `aria-disabled="true"` keeps the button in tab order, announces disabled state, and still fires click events

The button's click handler must check if input is empty and show validation instead of submitting.

### Design Token Usage

```tsx
// Input field
className="w-full rounded-[var(--radius-sm)] border border-border bg-background
  py-3 px-4 text-text-primary placeholder:text-text-muted
  focus:border-primary focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:outline-none
  min-h-[44px]"

// Generate button - enabled
className="w-full min-h-[44px] rounded-[var(--radius-sm)] bg-primary text-white
  font-bold py-3 px-6
  hover:bg-primary-hover motion-safe:transition-colors motion-safe:duration-150
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"

// Generate button - disabled (aria-disabled)
className="w-full min-h-[44px] rounded-[var(--radius-sm)] bg-primary/40 text-white/60
  font-bold py-3 px-6 cursor-not-allowed"

// Validation error
className="text-sm text-red-600 mt-1"
```

### Tailwind v4 Specifics

The project uses Tailwind CSS v4 with CSS-first `@theme` configuration. All design tokens from `app/globals.css` are available as direct utility classes:

- `bg-primary`, `bg-primary-hover`, `bg-background`, `bg-surface`
- `text-text-primary`, `text-text-secondary`, `text-text-muted`
- `border-border`, `border-primary`
- `rounded-[var(--radius-sm)]` for the 6px radius

No `tailwind.config.ts` exists. Do NOT create one.

### Placeholder Text Per Mode

| Mode    | Placeholder                                        |
| ------- | -------------------------------------------------- |
| goal    | "e.g., Become a proficient guitarist in 3 months"  |
| project | "e.g., Personal portfolio website deployed online" |

### Validation Behavior

1. User types nothing, clicks Generate → "Enter a goal or project first" appears below input
2. User types whitespace only, presses Enter → same validation message
3. User starts typing after error → error clears immediately
4. User switches mode → `inputText` is cleared by page.tsx (existing behavior), validation error should also clear
5. Validation error does NOT prevent focus from leaving the input

### Page State After This Story

```tsx
// app/page.tsx — expected state after Story 1.3
"use client";
import { useState } from "react";
import ModeToggle from "@/components/ModeToggle";
import InputSection from "@/components/InputSection";

export default function Home() {
  const [mode, setMode] = useState<"goal" | "project">("goal");
  const [inputText, setInputText] = useState("");

  const handleModeChange = (newMode: "goal" | "project") => {
    setMode(newMode);
    setInputText("");
  };

  const handleSubmit = () => {
    // Story 2.x will implement actual template generation here
    console.log("Submit:", mode, inputText);
  };

  return (
    <main className="mx-auto max-w-[640px] px-[var(--spacing-page-x)] lg:px-[var(--spacing-page-x-lg)] py-[var(--spacing-section-y)]">
      <h1 className="text-[length:var(--font-size-hero)] font-bold text-text-primary">
        Archer
      </h1>
      <p className="mt-2 text-text-secondary">
        Type a goal. Get the next actions.
      </p>

      <div className="mt-[var(--spacing-section-y)] flex justify-center">
        <ModeToggle mode={mode} onModeChange={handleModeChange} />
      </div>

      <div className="mt-[var(--spacing-section-y)]">
        <InputSection
          mode={mode}
          inputText={inputText}
          onInputChange={setInputText}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  );
}
```

### What NOT To Do

- **Do NOT** install any form library (react-hook-form, formik, etc.)
- **Do NOT** use `<form>` element with native submit — use keydown handler + button click
- **Do NOT** use HTML `disabled` attribute on the button — use `aria-disabled`
- **Do NOT** put `inputText` state inside InputSection — it lives in page.tsx
- **Do NOT** add `tailwind.config.ts` — Tailwind v4 CSS-first only
- **Do NOT** use `@apply` — use utility classes directly in JSX
- **Do NOT** add any state management library
- **Do NOT** add any UI component library
- **Do NOT** break existing ModeToggle integration or its test suite
- **Do NOT** use `<textarea>` — this is a single-line `<input type="text">`
- **Do NOT** add character limit or counter — FR5 says no character limit

### Import Path Convention

Use `@/components/InputSection` import path (Next.js `@` path alias configured in tsconfig.json).

### Touch Target Compliance

Both input and button must be minimum 44×44px. With `py-3` (12px each side) + 16px line-height = 40px. Add `min-h-[44px]` to guarantee compliance regardless of content size.

### Previous Story Intelligence

From Story 1.2 implementation:

- ModeToggle is fully implemented with ARIA tablist/tab pattern
- `page.tsx` already has `mode` and `inputText` state — `inputText` is unused (has eslint-disable comment)
- `handleModeChange` already clears `inputText` on mode switch (FR3 compliance)
- Test infrastructure is set up: Vitest + React Testing Library + jest-dom
- `vitest.config.ts` and `vitest.setup.ts` exist in `archer/` directory
- 29 existing tests must continue passing
- Color utilities work directly: `bg-primary`, `text-text-primary`, `border-border` are valid Tailwind v4 classes
- Focus ring pattern: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]`
- Motion safe pattern: `motion-safe:transition-colors motion-safe:duration-150`
- The `sr-only` class is available (built into Tailwind)

### Test Infrastructure

Tests are already set up from Story 1.2:

- **Framework**: Vitest with jsdom environment
- **Libraries**: @testing-library/react, @testing-library/jest-dom
- **Config**: `archer/vitest.config.ts`
- **Setup**: `archer/vitest.setup.ts` (imports jest-dom matchers)
- **Script**: `npm run test` in `archer/package.json`

Write tests for InputSection covering:

- Renders with correct placeholder per mode
- Button shows disabled styling when input empty
- Button shows enabled styling when input has text
- Validation message appears on submit with empty input
- Validation message clears when user types
- Enter key triggers submit
- onSubmit callback fires with valid input
- onSubmit does NOT fire with empty/whitespace input
- aria-disabled attribute present/absent correctly
- Focus ring styling applied on focus

### Existing File States (READ BEFORE MODIFYING)

**`app/page.tsx` current state:**

- Has `'use client'` directive
- Imports `useState` from react and `ModeToggle` from `@/components/ModeToggle`
- Has `mode` state (`'goal' | 'project'`, default `'goal'`)
- Has `inputText` state (string, default `''`) with eslint-disable comment
- Has `handleModeChange` that sets mode and clears inputText
- Renders: `<main>` → hero (h1 + p) → ModeToggle wrapper div

**Changes needed to `page.tsx`:**

- Add import for `InputSection`
- Remove eslint-disable comment from `inputText` line
- Add `handleSubmit` function (no-op for now, console.log placeholder)
- Add InputSection below ModeToggle with section spacing

**`app/globals.css`:** Contains all design tokens. DO NOT MODIFY.

**`components/ModeToggle.tsx`:** Fully implemented. DO NOT MODIFY.

### Verification Checklist

1. `npm run build` exits 0, produces `out/` directory
2. `npm run lint` exits 0, zero errors
3. `npm run test` — all existing 29 tests pass + new InputSection tests pass
4. Input renders with "e.g., Become a proficient guitarist in 3 months" placeholder in Goal mode
5. Switching to Project mode shows "e.g., Personal portfolio website deployed online" placeholder
6. Button appears muted/disabled when input is empty
7. Button appears active primary blue when input has text
8. Clicking Generate with empty input shows "Enter a goal or project first"
9. Pressing Enter with empty input shows same validation message
10. Typing after error clears the validation message
11. Enter key with valid text calls onSubmit
12. Touch targets ≥ 44×44px on both input and button
13. Focus ring visible on input focus
14. `aria-disabled="true"` on button when input empty
15. Screen reader can find and announce the disabled button state
16. All responsive: 375px, 768px, 1440px — no overflow, full-width elements

### References

- [Source: ARCHITECTURE-SPINE.md#Decisions — AD-2, AD-3, AD-5]
- [Source: ARCHITECTURE-SPINE.md#Seed Structure — components/InputSection.tsx]
- [Source: ARCHITECTURE-SPINE.md#Boundary Rules — #1: props in, callbacks out]
- [Source: DESIGN.md#Components#Text Input — padding, border, focus states]
- [Source: DESIGN.md#Components#Generate Button — full-width, disabled state]
- [Source: DESIGN.md#Colors — primary, border, text-muted, focus-ring]
- [Source: DESIGN.md#Shapes — rounded sm (6px) for inputs and buttons]
- [Source: EXPERIENCE.md#Component Patterns#Text Input — placeholder per mode, Enter submit, empty blocked]
- [Source: EXPERIENCE.md#Component Patterns#Generate Button — disabled when empty, aria-disabled]
- [Source: EXPERIENCE.md#Voice and Tone — "Enter a goal or project first" error text]
- [Source: EXPERIENCE.md#Accessibility Floor — tab order, touch targets, contrast]
- [Source: epics.md#Story 1.3 — All acceptance criteria]
- [Source: epics.md#FR4 — Mode-specific placeholder text]
- [Source: epics.md#FR5 — No character limit]
- [Source: epics.md#FR6 — Empty input validation]
- [Source: epics.md#FR7 — Submit via Enter or button]
- [Source: epics.md#UX-DR4 — Text input component specs]
- [Source: epics.md#UX-DR5 — Generate button specs]
- [Source: epics.md#UX-DR9 — Focus management, tab order]
- [Source: epics.md#UX-DR10 — Motion preferences]
- [Source: epics.md#UX-DR11 — Touch targets minimum 44×44px]

## Project Context Reference

### project-context.md Status

`project-context.md` does **NOT exist** in this project. Conventions are derived from the architecture spine, planning artifacts, and established patterns from Stories 1.1 and 1.2.

### Applicable Conventions from Planning Artifacts

- **Tech Stack**: Next.js 16.3.3, React 19.2.8, Tailwind CSS v4, TypeScript
- **Styling**: Tailwind v4 CSS-first `@theme` tokens in `globals.css` — no `tailwind.config.ts`
- **Component Pattern**: Props-in, callbacks-out. State lives in page.tsx only. Local UI state (validation error) acceptable in component.
- **File Organization**: `components/InputSection.tsx` for UI, state in `app/page.tsx`
- **No Libraries**: Zero external UI or form libraries — all custom components
- **Accessibility**: WCAG 2.1 AA, full keyboard nav, aria-disabled pattern, 44×44px targets, 4.5:1 contrast
- **Motion**: Use Tailwind `motion-safe:` / `motion-reduce:` variants for transitions
- **Testing**: Vitest + React Testing Library (already configured from Story 1.2)
- **Build/Lint**: `npm run build` (static export), `npm run lint` (ESLint), `npm run test` (Vitest)
- **Import Paths**: Use `@/components/*` path alias
- **Existing Tests**: 29 tests across 5 files must continue passing

## Change Log

- 2026-08-26: Story created — comprehensive developer guide with component interface, design tokens, validation pattern, and integration blueprint. Status → ready-for-dev.
- 2026-08-27: Story implemented — InputSection component with validation, page integration, 22 new tests passing, build/lint clean. Status → review.

## Dev Agent Record

### Implementation Plan

- RED: Wrote 22 failing tests covering placeholder text, button states, validation, submit behavior, input change, and accessibility
- GREEN: Implemented InputSection.tsx with full props interface, mode-dependent placeholders, aria-disabled pattern, inline validation, Enter key handler
- Integrated into page.tsx: added import, wired state, added handleSubmit placeholder, removed eslint-disable comment
- REFACTOR: Clean component structure with separated concerns (validation state local, input state in parent)

### Completion Notes

All 6 tasks completed successfully:

- InputSection component implements full design token styling, accessibility, and validation
- 51 total tests pass (29 existing + 22 new) — zero regressions
- Build produces static export, lint clean, TypeScript clean
- aria-disabled pattern used (not HTML disabled) for keyboard accessibility
- Touch targets ≥ 44px on both input and button
- Validation clears on typing, shows on empty submit via Enter or button click

## File List

- components/InputSection.tsx (new)
- components/InputSection.test.tsx (new)
- app/page.tsx (modified)
