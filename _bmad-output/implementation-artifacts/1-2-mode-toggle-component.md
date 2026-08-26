---
baseline_commit: c997024
---

# Story 1.2: Mode Toggle Component

Status: review

## Story

As a user,
I want to switch between Goal and Project modes,
so that I can choose the right template type for my needs.

## Acceptance Criteria

1. **Given** the page has loaded **When** I view the mode toggle **Then** it displays as a pill-shaped segmented control with "Goal" and "Project" options **And** "Goal" is active by default (primary color fill, white text) **And** "Project" shows inactive state (surface background, muted text)
2. **Given** I click/tap the "Project" segment **When** the mode switches **Then** "Project" becomes active and "Goal" becomes inactive **And** any existing input text is cleared **And** the mode change is announced to screen readers
3. **Given** I focus the toggle with keyboard **When** I press arrow keys **Then** the active mode cycles between Goal and Project **And** Enter/Space activates the focused option
4. **Given** the toggle is inspected for accessibility **When** a screen reader reads it **Then** it uses `role="tablist"` / `role="tab"` with `aria-selected`

## Tasks / Subtasks

- [x] Task 1: Create ModeToggle component file (AC: #1, #4)
  - [x] Create `components/ModeToggle.tsx`
  - [x] Define props interface: `{ mode: 'goal' | 'project'; onModeChange: (mode: 'goal' | 'project') => void }`
  - [x] Implement pill-shaped container with `rounded-full` (9999px radius), surface background, border
  - [x] Implement two segments: "Goal" and "Project" as tab elements
  - [x] Active segment: primary background (#2563EB), white text, font-weight 700
  - [x] Inactive segment: transparent background, text-secondary (#6B7280), font-weight 400
  - [x] Apply `role="tablist"` on container, `role="tab"` on each segment
  - [x] Apply `aria-selected="true"` on active segment, `aria-selected="false"` on inactive
  - [x] Ensure minimum 44×44px touch targets on each segment
  - [x] Add transition on background/color for smooth visual switch (respect prefers-reduced-motion)

- [x] Task 2: Implement keyboard navigation (AC: #3)
  - [x] Add `tabIndex={0}` on the active tab, `tabIndex={-1}` on inactive (roving tabindex pattern)
  - [x] Handle ArrowLeft/ArrowRight to cycle between options
  - [x] Handle Enter/Space to activate the focused option
  - [x] Manage focus movement when arrow keys cycle the selection
  - [x] Prevent default scroll behavior on arrow keys within the tablist

- [x] Task 3: Implement screen reader announcements (AC: #2, #4)
  - [x] Add `aria-live="polite"` region (visually hidden) to announce mode changes
  - [x] On mode change, announce "{Mode} mode selected" to assistive technology
  - [x] Ensure the `aria-label` on the tablist is descriptive: "Template mode"

- [x] Task 4: Integrate ModeToggle into page.tsx (AC: #1, #2)
  - [x] Import ModeToggle into `app/page.tsx`
  - [x] Add `useState<'goal' | 'project'>('goal')` for mode state
  - [x] Add `useState('')` for input text (preparation for Story 1.3)
  - [x] Wire `onModeChange` to set mode AND clear input text
  - [x] Place ModeToggle below the hero text, above where InputSection will go
  - [x] Maintain existing page layout (centered, spacing)

- [x] Task 5: Visual polish and responsive behavior (AC: #1)
  - [x] Ensure toggle fills appropriate width on mobile (not full-width, centered with auto margins)
  - [x] Apply focus-visible ring using focus-ring token (#2563EB40) — `outline` + `outline-offset`
  - [x] Verify color contrast ratios meet WCAG AA (white on #2563EB = 4.56:1 ✓, #6B7280 on #F9FAFB = check)
  - [x] Test with `prefers-reduced-motion`: disable transition when enabled

- [x] Task 6: Verify build and lint (AC: all)
  - [x] Run `npm run build` — confirm zero errors, static export succeeds
  - [x] Run `npm run lint` — confirm zero ESLint errors
  - [x] Visually verify toggle renders correctly at 375px, 768px, 1440px widths

## Dev Notes

### Architecture Compliance

- **AD-2**: Component lives in `components/ModeToggle.tsx`. Page orchestrates state — the toggle receives props and emits callbacks only.
- **AD-3**: State management is `useState` in `page.tsx`. No external state library.
- **AD-5**: Tailwind utility classes only. No component library (NO shadcn, Radix, Headless UI). This toggle is built from scratch.
- **Boundary Rule #1**: Components receive props and emit callbacks. ModeToggle does NOT manage its own state — it receives `mode` and calls `onModeChange`.

### Critical: NO Component Libraries

The architecture explicitly prevents Radix, shadcn, Headless UI, or any external UI library. The tablist/tab ARIA pattern must be implemented manually. Do NOT install any package for this component.

### Component Interface

```typescript
// components/ModeToggle.tsx
interface ModeToggleProps {
  mode: "goal" | "project";
  onModeChange: (mode: "goal" | "project") => void;
}
```

### ARIA Pattern Reference — Tablist

The WAI-ARIA Tabs Pattern specifies:

- Container: `role="tablist"`, `aria-label="Template mode"`
- Each option: `role="tab"`, `aria-selected="true"|"false"`
- Keyboard: Arrow keys move between tabs, Enter/Space activates
- Focus: Roving tabindex — active tab gets `tabIndex={0}`, inactive gets `tabIndex={-1}`
- On activation: move focus to the newly active tab

### Design Token Usage

```tsx
// Active segment
className = "bg-primary text-white font-bold rounded-full px-6 py-2";

// Inactive segment
className =
  "bg-transparent text-text-secondary font-normal rounded-full px-6 py-2";

// Container
className = "inline-flex rounded-full bg-surface border border-border p-1";

// Focus ring (on individual tabs)
className =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]";
```

Note: Tailwind v4 with the `@theme` block means custom colors like `bg-primary`, `text-text-secondary`, `bg-surface`, `border-border` are auto-available as utilities — no need for arbitrary value syntax for these tokens.

### Tailwind v4 Specifics

The project uses Tailwind CSS v4 with CSS-first `@theme` configuration (NOT `tailwind.config.ts`). All design tokens are defined in `app/globals.css` via `@theme { }`. Key implications:

- Custom colors work as direct utility classes: `bg-primary`, `text-text-primary`, `bg-surface`, `border-border`
- Custom spacing: `px-[var(--spacing-page-x)]` or use `spacing-page-x` if configured as a spacing token
- Radius: `rounded-[var(--radius-full)]` or just `rounded-full` (Tailwind built-in is 9999px, same value)
- The `rounded-full` built-in Tailwind class IS sufficient — no need for the custom `--radius-full` token here

### Prefers-Reduced-Motion

```tsx
// Use Tailwind's motion-safe/motion-reduce variants:
className = "motion-safe:transition-colors motion-safe:duration-150";
```

### Screen Reader Announcement Pattern

```tsx
// Visually hidden live region
<div aria-live="polite" className="sr-only">
  {/* Updated dynamically on mode change */}
  {announcement}
</div>
```

The `sr-only` class is built into Tailwind and provides the standard visually-hidden pattern.

### Page State After This Story

```tsx
// app/page.tsx — expected state after Story 1.2
"use client";
import { useState } from "react";
import ModeToggle from "@/components/ModeToggle";

export default function Home() {
  const [mode, setMode] = useState<"goal" | "project">("goal");
  const [inputText, setInputText] = useState("");

  const handleModeChange = (newMode: "goal" | "project") => {
    setMode(newMode);
    setInputText(""); // FR3: switching modes clears input
  };

  return (
    <main className="mx-auto max-w-[640px] px-[var(--spacing-page-x)] lg:px-[var(--spacing-page-x-lg)] py-[var(--spacing-section-y)]">
      <h1 className="text-[length:var(--font-size-hero)] font-bold text-text-primary">
        Archer
      </h1>
      <p className="mt-2 text-text-secondary">
        Type a goal. Get the next actions.
      </p>

      {/* Mode Toggle — 64px section rhythm below hero */}
      <div className="mt-[var(--spacing-section-y)] flex justify-center">
        <ModeToggle mode={mode} onModeChange={handleModeChange} />
      </div>
    </main>
  );
}
```

### What NOT To Do

- **Do NOT** install any UI library (Radix, shadcn, Headless UI, React Aria)
- **Do NOT** use `<button>` inside the tablist — use `<div role="tab">` elements (buttons have implicit roles that conflict)
- **Do NOT** use a `<select>` or dropdown — this is a segmented control (tablist)
- **Do NOT** put state inside the ModeToggle component — state lives in page.tsx
- **Do NOT** add `tailwind.config.ts` — Tailwind v4 CSS-first only
- **Do NOT** use `@apply` — use utility classes directly in JSX
- **Do NOT** add any global state management library
- **Do NOT** break the existing page layout or hero section styling

### Import Path Convention

Use `@/components/ModeToggle` import path (Next.js `@` path alias is configured by default in tsconfig.json from create-next-app).

### Touch Target Compliance

Each tab segment must be at minimum 44×44px. With `px-6 py-2` (24px horizontal, 8px vertical), the text "Goal" at 1rem ≈ 16px line-height + 16px padding = ~32px height. **Increase vertical padding to `py-3`** (12px each side = 24px + 16px = 40px) or use `min-h-[44px]` to guarantee touch target compliance.

Recommended: `min-h-[44px] px-6 py-3 flex items-center justify-center`

### Previous Story Intelligence

From Story 1.1 implementation:

- Project uses Next.js 16.3.3 with React 19.2.8
- Tailwind CSS v4 is configured — uses `@import "tailwindcss"` + `@theme` block in globals.css
- PostCSS config: `postcss.config.mjs` with `@tailwindcss/postcss` plugin
- Page uses `'use client'` directive
- Layout uses `var(--spacing-*)` CSS custom properties with arbitrary value syntax
- Color utilities work directly: `text-text-primary`, `text-text-secondary` are valid Tailwind v4 classes
- `npm run build` produces `out/` directory, `npm run lint` uses ESLint with Next.js plugin
- No `tailwind.config.ts` exists — all config is CSS-first in `@theme`

### Verification Checklist

1. `npm run build` exits 0, produces `out/index.html`
2. `npm run lint` exits 0, zero errors
3. Toggle renders pill-shaped with "Goal" active by default
4. Clicking "Project" switches active state visually
5. Keyboard: Arrow keys cycle between tabs, Enter/Space activates
6. Screen reader: announces mode change via aria-live region
7. Inspect: role="tablist" on container, role="tab" on segments, aria-selected correct
8. Touch targets: each segment ≥ 44×44px
9. prefers-reduced-motion: transitions disabled when motion-reduce active
10. Page responsive at 375px, 768px, 1440px — toggle centered, no overflow

### References

- [Source: ARCHITECTURE-SPINE.md#Decisions — AD-2, AD-3, AD-5]
- [Source: ARCHITECTURE-SPINE.md#Seed Structure — components/ModeToggle.tsx]
- [Source: ARCHITECTURE-SPINE.md#Boundary Rules — #1: props in, callbacks out]
- [Source: DESIGN.md#Components#Mode Toggle — pill shape, active/inactive states]
- [Source: DESIGN.md#Colors — primary, surface, text-secondary, focus-ring tokens]
- [Source: DESIGN.md#Shapes — rounded full for pills/toggles]
- [Source: epics.md#Story 1.2 — Acceptance criteria]
- [Source: epics.md#FR1 — Two modes via segmented toggle]
- [Source: epics.md#FR2 — Goal Mode default]
- [Source: epics.md#FR3 — Mode switch clears state]
- [Source: epics.md#UX-DR3 — ModeToggle component specs]
- [Source: epics.md#UX-DR9 — Focus management, tab order]
- [Source: epics.md#UX-DR10 — Motion preferences]
- [Source: epics.md#UX-DR11 — Touch targets minimum 44×44px]
- [Source: WAI-ARIA Tabs Pattern — tablist/tab roles, roving tabindex]

## Project Context Reference

### project-context.md Status

`project-context.md` does **NOT exist** in this project. Conventions are derived from the architecture spine, planning artifacts, and the established patterns from Story 1.1.

### Applicable Conventions from Planning Artifacts

- **Tech Stack**: Next.js 16.3.3, React 19.2.8, Tailwind CSS v4, TypeScript
- **Styling**: Tailwind v4 CSS-first `@theme` tokens in `globals.css` — no `tailwind.config.ts`
- **Component Pattern**: Props-in, callbacks-out. State lives in page.tsx only.
- **File Organization**: `components/ModeToggle.tsx` for UI, state in `app/page.tsx`
- **No Libraries**: Zero external UI libraries — all custom components
- **Accessibility**: WCAG 2.1 AA, full keyboard nav, ARIA tablist/tab pattern, 44×44px targets
- **Motion**: Use Tailwind `motion-safe:` / `motion-reduce:` variants
- **Build/Lint**: `npm run build` (static export), `npm run lint` (ESLint)
- **Import Paths**: Use `@/components/*` path alias

## Dev Agent Record

### Agent Model Used

Auto (Kiro)

### Debug Log References

- All 29 unit tests pass across 5 test files
- `npm run build` exits 0, static export produces `out/index.html`
- `npm run lint` exits 0, zero errors

### Completion Notes List

- Implemented ModeToggle as a controlled component with props-in/callbacks-out pattern
- Full WAI-ARIA tablist/tab pattern with roving tabindex keyboard navigation
- Screen reader announcements via aria-live polite region with sr-only visually hidden class
- Motion-safe transitions respect prefers-reduced-motion
- 44px minimum touch targets on each segment
- Focus-visible ring using design token color
- Integrated into page.tsx with mode state + inputText state (cleared on mode switch)
- Set up Vitest + React Testing Library test infrastructure for the project
- 29 tests covering: component rendering, ARIA attributes, keyboard nav, screen reader, visual styling, page integration

### File List

- archer/components/ModeToggle.tsx (new) — Pill-shaped segmented toggle with ARIA tablist pattern
- archer/app/page.tsx (modified) — Add mode state, input text state, integrate ModeToggle component
- archer/components/ModeToggle.test.tsx (new) — Unit tests for component rendering and ARIA
- archer/components/ModeToggle.keyboard.test.tsx (new) — Keyboard navigation tests
- archer/components/ModeToggle.a11y.test.tsx (new) — Screen reader announcement tests
- archer/components/ModeToggle.visual.test.tsx (new) — Visual polish and responsive tests
- archer/app/page.test.tsx (new) — Page integration tests
- archer/vitest.config.ts (new) — Vitest configuration with jsdom and React plugin
- archer/vitest.setup.ts (new) — Test setup with jest-dom matchers
- archer/package.json (modified) — Added test script and dev dependencies (vitest, testing-library, jsdom)

## Change Log

- 2026-08-26: Story created — comprehensive developer guide with ARIA pattern, design tokens, and integration blueprint. Status → ready-for-dev.
- 2026-08-26: Implementation complete — ModeToggle component with full ARIA tablist pattern, keyboard nav, screen reader announcements, responsive styling, page integration. 29 tests passing. Status → review.
