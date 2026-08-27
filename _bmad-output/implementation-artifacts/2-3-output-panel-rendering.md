---
baseline_commit: 6f83a39d25307fba2d07e7786772eabaf3c33b4f
---

# Story 2.3: Output Panel Rendering

Status: done

## Story

As a user,
I want to see my generated GTD breakdown displayed as nicely formatted content,
so that I can read and review the structure before copying or downloading it.

## Acceptance Criteria

1. **Given** a template has been generated **When** the output panel appears **Then** the raw markdown is rendered as formatted HTML (headings, tables, checkboxes render visually) **And** the panel uses a card container with border (no shadow) **And** the panel appears with a subtle fade-in animation **And** if `prefers-reduced-motion` is enabled, the fade-in is suppressed

2. **Given** the output panel has appeared **When** I inspect accessibility **Then** the panel has `role="region"` with `aria-label="Generated GTD template"` **And** focus is programmatically moved to the output panel

3. **Given** the output renders below the current viewport **When** generation completes **Then** the page smooth-scrolls so the top of the output panel is visible

4. **Given** the output panel is visible **When** I view it on mobile (< 640px) **Then** it fills the available width with appropriate padding and remains readable

## Tasks / Subtasks

- [x] Task 1: Install Markdown Rendering Dependencies (AC: #1)
  - [x] Install `react-markdown` (latest stable, ~v10) as a production dependency
  - [x] Install `remark-gfm` (latest stable, ~v4) as a production dependency
  - [x] Verify `npm run build` still completes — no compatibility issues with Next.js 16 / React 19
  - [x] Verify bundle size impact is acceptable (react-markdown ≈ 5KB gzipped)

- [x] Task 2: Create OutputPanel Component (AC: #1, #2, #4)
  - [x] Create `archer/components/OutputPanel.tsx`
  - [x] Define props interface: `{ markdown: string }`
  - [x] Component receives raw markdown string and renders it as formatted HTML
  - [x] Use `react-markdown` with `remarkGfm` plugin for GFM support (tables, checkboxes)
  - [x] Wrap rendered content in a card container: `surface` background, `border` color border, `rounded-md`, `padding 1.5rem`
  - [x] Apply `role="region"` and `aria-label="Generated GTD template"` to the outer container
  - [x] Add `tabIndex={-1}` to the container so it can receive programmatic focus
  - [x] Add a `ref` for focus management (forwarded from parent or internal useRef)

- [x] Task 3: Implement Fade-In Animation (AC: #1)
  - [x] Use CSS animation: opacity transition from 0 to 1 (duration ~300ms, ease-in-out)
  - [x] Apply via Tailwind class: `animate-fade-in` (define custom keyframe in globals.css or use inline Tailwind arbitrary values)
  - [x] Wrap animation in `@media (prefers-reduced-motion: no-preference)` — if prefers-reduced-motion is enabled, panel appears instantly (no transition)
  - [x] No layout shift — panel mounts with its final dimensions (no height animation)

- [x] Task 4: Style Rendered Markdown Content (AC: #1, #4)
  - [x] Apply prose-like typography styling to rendered HTML inside the panel
  - [x] Headings (`h1`, `h2`, `h3`, `h4`): use appropriate font sizes from design tokens, bold weight, proper spacing
  - [x] Tables: bordered cells, proper alignment, responsive overflow handling (horizontal scroll on mobile)
  - [x] Checkboxes (`input[type="checkbox"]`): rendered as visual checkboxes (read-only, no interaction)
  - [x] Lists: proper indentation and spacing
  - [x] Paragraphs: body text color, 1.6 line-height
  - [x] Ensure all content is readable on mobile (< 640px) — no overflow, proper wrapping
  - [x] Use Tailwind utility classes or a scoped CSS approach (NOT @tailwindcss/typography plugin — keep it custom and minimal)

- [x] Task 5: Integrate OutputPanel into Page (AC: #1, #2, #3)
  - [x] Import `OutputPanel` into `app/page.tsx`
  - [x] Conditionally render: only show when `output` state is non-empty
  - [x] Place below InputSection in the DOM
  - [x] Add a `useRef` for the OutputPanel container
  - [x] After `setOutput(...)` in `handleSubmit`, use `useEffect` to:
    - Move focus to the OutputPanel container (`ref.current?.focus()`)
    - Smooth-scroll to the panel (`ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })`)
  - [x] Respect `prefers-reduced-motion`: if enabled, use `behavior: 'auto'` instead of `'smooth'`
  - [x] Ensure `handleModeChange` still clears output (panel disappears on mode switch)
  - [x] Wrap OutputPanel in a `<div>` with `mt-[var(--spacing-section-y)]` for vertical rhythm

- [x] Task 6: Write Unit Tests for OutputPanel Component (AC: #1, #2, #4)
  - [x] Create `archer/components/OutputPanel.test.tsx`
  - [x] Test: component renders without crashing when given valid markdown
  - [x] Test: rendered output contains expected HTML elements (headings become `<h1>`/`<h2>`, tables become `<table>`, checkboxes become `<input>`)
  - [x] Test: container has `role="region"` attribute
  - [x] Test: container has `aria-label="Generated GTD template"`
  - [x] Test: container has `tabIndex={-1}` for programmatic focus
  - [x] Test: component renders card styling (border, surface background)
  - [x] Test: component renders markdown tables correctly (GFM support)
  - [x] Test: component renders checkboxes from `- [ ]` syntax

- [x] Task 7: Write Integration Tests (AC: #1, #2, #3)
  - [x] In `archer/app/page.test.tsx`, add tests:
  - [x] Test: OutputPanel is NOT rendered when output state is empty (initial load)
  - [x] Test: OutputPanel IS rendered after submitting valid input in Goal mode
  - [x] Test: OutputPanel IS rendered after submitting valid input in Project mode
  - [x] Test: OutputPanel disappears when mode is switched (output cleared)
  - [x] Test: OutputPanel has correct role and aria-label after generation
  - [x] Test: focus moves to OutputPanel after generation (via `document.activeElement`)
  - [x] Verify all existing 107 tests still pass

- [x] Task 8: Build, Lint, and Test Verification
  - [x] `npm run build` exits 0, produces `out/` directory
  - [x] `npm run lint` exits 0, zero errors
  - [x] `npm run test` — all 107 existing tests pass + new tests pass
  - [x] No TypeScript errors
  - [x] Verify OutputPanel renders Goal Mode markdown correctly (headings, tables, checkboxes)
  - [x] Verify OutputPanel renders Project Mode markdown correctly (headings, checkboxes, no tables)

## Dev Notes

### Architecture Compliance

- **AD-4 & Boundary Rule #2**: Template functions remain pure in `lib/templates/` — this story does NOT touch them. OutputPanel only consumes the markdown string they produce.
- **AD-3 & Boundary Rule #1**: Page orchestrates — passes `output` state to OutputPanel as a prop. No state in OutputPanel itself.
- **AD-5**: Styling via Tailwind utility classes. No component library. Custom scoped styles for rendered markdown content.
- **Boundary Rule #3**: Browser APIs (scrollIntoView) called from page component, not from OutputPanel. OutputPanel is a presentational component.
- **Seed Structure**: `components/OutputPanel.tsx` — as defined in the architecture seed.

### New Dependency: react-markdown + remark-gfm

This story introduces the project's first new runtime dependency since the initial scaffold.

**Why react-markdown:**

- FR13 requires rendering markdown as formatted HTML (headings, tables, checkboxes)
- The Goal Mode template contains GFM pipe tables and task list checkboxes
- Pure string-to-HTML approaches (dangerouslySetInnerHTML with a custom parser) would be more code and less safe
- react-markdown is ~5KB gzipped — acceptable within the <100KB bundle budget
- react-markdown v10 is compatible with React 19 and supports ESM

**Install commands:**

```bash
npm install react-markdown remark-gfm
```

**Import pattern:**

```typescript
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
```

**Usage:**

```tsx
<Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
```

### Component Signature

```typescript
// components/OutputPanel.tsx

import { forwardRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface OutputPanelProps {
  markdown: string;
}

const OutputPanel = forwardRef<HTMLDivElement, OutputPanelProps>(
  ({ markdown }, ref) => {
    return (
      <div
        ref={ref}
        role="region"
        aria-label="Generated GTD template"
        tabIndex={-1}
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 motion-safe:animate-fade-in focus:outline-none"
      >
        <div className="output-prose">
          <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
        </div>
      </div>
    );
  }
);

OutputPanel.displayName = "OutputPanel";
export default OutputPanel;
```

### Fade-In Animation

Add to `globals.css`:

```css
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

Use Tailwind's `motion-safe:` variant prefix which respects `prefers-reduced-motion` automatically:

- `motion-safe:animate-fade-in` — applies animation only when user has NOT set reduced motion preference
- When `prefers-reduced-motion: reduce` is active, the panel appears instantly (no animation)

Define the animation in the `@theme` block or as a utility:

```css
@utility animate-fade-in {
  animation: fade-in 300ms ease-in-out;
}
```

**IMPORTANT:** Tailwind v4 uses `@utility` for custom utilities, NOT the old `@layer utilities` pattern. Check what pattern exists in the project and follow it.

### Markdown Prose Styling

Do NOT use `@tailwindcss/typography` plugin (adds weight and is not installed). Instead, create scoped styles for the rendered HTML inside `.output-prose`:

```css
.output-prose h1 {
  font-size: var(--font-size-section);
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  color: var(--color-text-primary);
}
.output-prose h2 {
  font-size: var(--font-size-subheading);
  font-weight: 700;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  color: var(--color-text-primary);
}
.output-prose h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  color: var(--color-text-primary);
}
.output-prose h4 {
  font-size: 1.1rem;
  font-weight: 700;
  margin-top: 0.75rem;
  margin-bottom: 0.25rem;
  color: var(--color-text-primary);
}
.output-prose p {
  margin-bottom: 0.75rem;
  line-height: 1.6;
  color: var(--color-text-primary);
}
.output-prose ul,
.output-prose ol {
  margin-bottom: 0.75rem;
  padding-left: 1.5rem;
}
.output-prose li {
  margin-bottom: 0.25rem;
  line-height: 1.6;
}
.output-prose table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
.output-prose th,
.output-prose td {
  border: 1px solid var(--color-border);
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.output-prose th {
  background: var(--color-surface);
  font-weight: 700;
}
.output-prose input[type="checkbox"] {
  margin-right: 0.5rem;
  pointer-events: none;
}
.output-prose strong {
  font-weight: 700;
}
.output-prose em {
  font-style: italic;
}
```

Place these in `globals.css` AFTER the `@theme` block. This ensures all rendered markdown elements are properly styled without a typography plugin.

For mobile responsiveness on tables, add:

```css
.output-prose table {
  display: block;
  overflow-x: auto;
}
```

### Page Integration Blueprint

```typescript
// app/page.tsx — expected state AFTER Story 2.3
"use client";

import InputSection from "@/components/InputSection";
import ModeToggle from "@/components/ModeToggle";
import OutputPanel from "@/components/OutputPanel";
import { generateGoalTemplate } from "@/lib/templates/goal-template";
import { generateProjectTemplate } from "@/lib/templates/project-template";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [mode, setMode] = useState<"goal" | "project">("goal");
  const [inputText, setInputText] = useState("");
  const [output, setOutput] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  const handleModeChange = (newMode: "goal" | "project") => {
    setMode(newMode);
    setInputText("");
    setOutput("");
  };

  const handleSubmit = () => {
    if (mode === "goal") {
      setOutput(generateGoalTemplate(inputText));
    } else {
      setOutput(generateProjectTemplate(inputText));
    }
  };

  // Focus and scroll to output panel after generation
  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.focus();

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      outputRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    }
  }, [output]);

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
          key={mode}
          mode={mode}
          inputText={inputText}
          onInputChange={setInputText}
          onSubmit={handleSubmit}
        />
      </div>

      {output && (
        <div className="mt-[var(--spacing-section-y)]">
          <OutputPanel ref={outputRef} markdown={output} />
        </div>
      )}
    </main>
  );
}
```

### Key Changes to page.tsx

1. **Add import**: `OutputPanel` from `@/components/OutputPanel`
2. **Add import**: `useEffect`, `useRef` from `react`
3. **Add ref**: `const outputRef = useRef<HTMLDivElement>(null)`
4. **Add useEffect**: focus + scroll logic triggered by `output` state change
5. **Add conditional render**: `{output && <OutputPanel>}` block after InputSection
6. **Resolves lint warning**: `output` variable is now used (was previously unused)

### Focus Management Strategy

- `OutputPanel` has `tabIndex={-1}` — allows programmatic focus but doesn't add to natural tab order
- After generation, `outputRef.current.focus()` moves screen reader cursor to the output region
- The `role="region"` + `aria-label` combo ensures the screen reader announces "Generated GTD template, region" when focused
- Focus is NOT stolen during typing — `useEffect` only fires when `output` changes (i.e., after explicit submit)
- When user clicks "Start over" (future Story 3.4), focus returns to input — but that's not this story's concern

### Scroll Behavior

- `scrollIntoView({ behavior: 'smooth', block: 'start' })` scrolls the output panel's top edge to the viewport top
- Respects `prefers-reduced-motion`: uses `behavior: 'auto'` (instant jump) when reduced motion is preferred
- No scroll happens if panel is already visible (browser handles this natively)
- This satisfies FR15: "the viewport SHALL smooth-scroll so the top of the output panel is visible"

### What NOT To Do

- **Do NOT** add ActionBar (Copy/Download buttons) — that's Epic 3
- **Do NOT** add "Start over" button — that's Story 3.4
- **Do NOT** add "Try an example" button — that's Story 3.3
- **Do NOT** modify template functions — they're done and in review
- **Do NOT** modify ModeToggle or InputSection components
- **Do NOT** add `@tailwindcss/typography` plugin — use custom scoped styles
- **Do NOT** use `dangerouslySetInnerHTML` — use react-markdown for safe rendering
- **Do NOT** add box-shadow to the card — DESIGN.md explicitly says "No box-shadows on cards — borders provide separation"
- **Do NOT** make checkboxes interactive/clickable — they're display-only (`pointer-events: none`)
- **Do NOT** add loading states — generation is synchronous (FR11)
- **Do NOT** use any state management library
- **Do NOT** add `tailwind.config.ts` — Tailwind v4 CSS-first configuration only (all in globals.css)
- **Do NOT** break existing 107 tests

### Existing File States (READ BEFORE MODIFYING)

**`app/page.tsx` current state:**

- Has `'use client'` directive
- Imports: `InputSection`, `ModeToggle`, `generateGoalTemplate`, `generateProjectTemplate`, `useState`
- State: `mode`, `inputText`, `output` (all via `useState`)
- `handleModeChange`: sets mode, clears inputText and output
- `handleSubmit`: calls appropriate template function based on mode
- `key={mode}` on InputSection for clean remount on mode switch
- ESLint warning: `output` is assigned but never read — **this story fixes this**
- No `useEffect` or `useRef` currently imported

**Changes needed to `page.tsx`:**

- Add import for `OutputPanel`
- Add `useEffect`, `useRef` to react import
- Add `outputRef` using `useRef<HTMLDivElement>(null)`
- Add `useEffect` for focus + scroll after output changes
- Add conditional render block for `OutputPanel`

**`app/globals.css` current state:**

- Contains `@import "tailwindcss"`, `@theme` block with design tokens, `body` styles
- NO custom animations or utilities defined yet

**Changes needed to `globals.css`:**

- Add `@keyframes fade-in` animation
- Add `@utility animate-fade-in` (or equivalent Tailwind v4 pattern)
- Add `.output-prose` scoped styles for rendered markdown elements

**New files to create:**

- `components/OutputPanel.tsx` — the new presentational component
- `components/OutputPanel.test.tsx` — unit tests for OutputPanel

**Files NOT to modify:**

- `components/ModeToggle.tsx` — DO NOT MODIFY
- `components/InputSection.tsx` — DO NOT MODIFY
- `lib/templates/goal-template.ts` — DO NOT MODIFY
- `lib/templates/project-template.ts` — DO NOT MODIFY

### Test Infrastructure

From Story 2.2:

- **Framework**: Vitest with jsdom environment
- **Libraries**: @testing-library/react, @testing-library/jest-dom, @testing-library/user-event
- **Config**: `archer/vitest.config.ts`
- **Setup**: `archer/vitest.setup.ts`
- **Script**: `npm run test` (runs `vitest run`)
- **Current count**: 107 tests passing

For OutputPanel unit tests: use `render` from `@testing-library/react`, query the rendered HTML for expected elements.

**Note on react-markdown in tests**: react-markdown renders asynchronously in some configurations. If tests are flaky, ensure the component is properly awaited with `waitFor` or `findBy*` queries. However, with the standard jsdom setup, synchronous rendering typically works.

### Previous Story Intelligence

From Stories 2.1 and 2.2 (both in review):

- 107 total tests pass across all test files
- `output` state already exists in `page.tsx` — set by both goal and project template calls
- `handleModeChange` already clears `output` state
- `key={mode}` on InputSection for clean validation state reset
- Build produces static export successfully — no SSR issues
- The `output` variable lint warning is EXPECTED and will be resolved by this story
- Template functions produce Notion-optimized markdown with `#` headings, `- [ ]` checkboxes, `|` pipe tables
- Goal Mode has tables (Capability Analysis, Resource Analysis); Project Mode does NOT have tables
- Both templates include HTML comments at the top (`<!-- GTD ... template scaffold ... -->`)

### Git Intelligence

Most recent commits:

- `6f83a39` — goal template (Story 2.1 + 2.2 implementation)
- `95208b5` — installing bmad
- `c997024` — installing bmad

Pattern: single commit per story implementation. The project uses a simple linear history on master branch.

### Responsive Considerations

- Output panel inherits the `max-w-[640px]` constraint from the parent `<main>`
- On mobile (< 640px): tables need `overflow-x: auto` to prevent horizontal overflow
- Card padding should be comfortable: `p-6` (24px) matches DESIGN.md's "Card internal: 24px padding"
- The fade-in animation causes no layout shift since the panel has fixed final dimensions

### Bundle Size Impact

Current state: ~135KB gzipped total JS (slightly over the 100KB target due to Next.js 16 baseline).

Adding react-markdown (~5KB gzipped) + remark-gfm (~1-2KB gzipped) = approximately 6-7KB added.

This is acceptable because:

1. The app REQUIRES markdown→HTML rendering (FR13 is non-negotiable)
2. Alternative approaches (custom parser) would add similar or more code
3. Total impact is modest relative to the Next.js runtime baseline

### Verification Checklist

1. `npm install react-markdown remark-gfm` succeeds
2. `npm run build` exits 0, produces `out/` directory
3. `npm run lint` exits 0, zero errors (no more `output` unused warning!)
4. `npm run test` — all 107 existing tests pass + new tests pass
5. OutputPanel renders Goal Mode markdown: headings, tables, checkboxes all display correctly
6. OutputPanel renders Project Mode markdown: headings, checkboxes display correctly
7. Card has border, surface background, rounded corners, no shadow
8. Fade-in animation plays on first appearance
9. Fade-in is suppressed when `prefers-reduced-motion: reduce` is set
10. `role="region"` and `aria-label="Generated GTD template"` present
11. Focus moves to output panel after generation
12. Page smooth-scrolls to output panel after generation
13. Scroll uses `behavior: 'auto'` when reduced motion is preferred
14. Panel disappears when mode is switched
15. Mobile: content is readable, tables scroll horizontally, no overflow
16. No TypeScript errors
17. `tabIndex={-1}` on output container (focusable but not in tab order)

### References

- [Source: ARCHITECTURE-SPINE.md#Seed Structure — components/OutputPanel.tsx]
- [Source: ARCHITECTURE-SPINE.md#Decisions — AD-5: Tailwind CSS, No Component Library]
- [Source: ARCHITECTURE-SPINE.md#Boundary Rules — #1: Page orchestrates, #3: Browser APIs in utils/page]
- [Source: ARCHITECTURE-SPINE.md#Data Flow — Markdown String → Rendered HTML Output]
- [Source: DESIGN.md#Components#Output Panel — Card container, border, no shadow, monospace-adjacent]
- [Source: DESIGN.md#Elevation & Depth — Flat design, no box-shadows on cards]
- [Source: DESIGN.md#Layout & Spacing — Card internal: 24px padding]
- [Source: EXPERIENCE.md#Component Patterns#Output Panel — Hidden until generation, fade-in, formatted HTML]
- [Source: EXPERIENCE.md#Accessibility Floor — role="region", aria-label, focus management, prefers-reduced-motion]
- [Source: EXPERIENCE.md#Interaction Primitives — Scroll to output if below fold]
- [Source: EXPERIENCE.md#State Patterns — Empty→Ready→Output transitions]
- [Source: epics.md#Story 2.3 — All acceptance criteria]
- [Source: epics.md#FR13 — Output rendered as formatted HTML]
- [Source: epics.md#FR14 — Fade-in animation, prefers-reduced-motion]
- [Source: epics.md#FR15 — Smooth-scroll to output panel]
- [Source: epics.md#UX-DR6 — OutputPanel: card, border, fade-in, role=region, aria-label, focus]
- [Source: epics.md#NFR4 — WCAG 2.1 AA, prefers-reduced-motion]

## Project Context Reference

### project-context.md Status

`project-context.md` does **NOT exist** in this project. Conventions are derived from the architecture spine, planning artifacts, and established patterns from Stories 1.1–2.2.

### Applicable Conventions from Planning Artifacts

- **Tech Stack**: Next.js 16.3.3, React 19.2.8, Tailwind CSS v4, TypeScript 5.x
- **New Dependency**: `react-markdown` (v10) + `remark-gfm` (v4) — first new runtime deps added to project
- **Component Pattern**: Presentational component in `components/`, receives props, no internal state. Uses `forwardRef` for parent ref access.
- **State Pattern**: `useState` in `page.tsx` only. Existing `output` state consumed by OutputPanel — no new state needed.
- **Effect Pattern**: `useEffect` in `page.tsx` for side effects (focus management, scrolling). Effects triggered by state changes, not component lifecycle.
- **Styling**: Tailwind v4 CSS-first config in `globals.css`. No `tailwind.config.ts`. Custom utilities via `@utility` directive. Scoped prose styles for rendered markdown.
- **Animation**: `motion-safe:` Tailwind variant for reduced-motion compliance. CSS keyframes in `globals.css`.
- **Testing**: Vitest with jsdom — component tests use `@testing-library/react`. Test rendered HTML output from react-markdown.
- **Build/Lint**: `npm run build` (static export), `npm run lint` (ESLint), `npm run test` (Vitest)
- **Import Paths**: Use `@/components/OutputPanel` path alias
- **Accessibility**: `role="region"`, `aria-label`, `tabIndex={-1}`, programmatic focus, `prefers-reduced-motion` respect
- **No Network**: NFR6 — zero network requests after page load (react-markdown renders client-side, no fetch)

## Dev Agent Record

### Implementation Plan

- Installed `react-markdown` v10.1.0 and `remark-gfm` v4.0.1 as production dependencies
- Created `OutputPanel` as a presentational `forwardRef` component following architecture boundary rules
- Added CSS keyframes + `@utility animate-fade-in` in globals.css using Tailwind v4 pattern
- Used `motion-safe:` Tailwind variant for automatic prefers-reduced-motion compliance
- Added scoped `.output-prose` styles for all rendered markdown elements (headings, tables, lists, checkboxes, paragraphs)
- Integrated OutputPanel into page.tsx with conditional rendering, useEffect for focus/scroll management
- Added `window.matchMedia` mock and `scrollIntoView` mock to vitest.setup.ts for jsdom compatibility

### Completion Notes

- All 8 tasks completed successfully
- 124 tests pass (107 existing + 11 OutputPanel unit tests + 6 integration tests)
- Zero regressions — all existing tests pass unchanged
- Build, lint, and TypeScript all pass cleanly
- The previously unused `output` variable ESLint warning is now resolved
- OutputPanel correctly renders Goal Mode markdown (headings, GFM tables, checkboxes) and Project Mode markdown (headings, checkboxes, no tables)
- Accessibility: role="region", aria-label, tabIndex={-1}, programmatic focus, prefers-reduced-motion respected
- Fade-in animation uses CSS keyframes with motion-safe variant
- Scroll behavior respects reduced motion preference (auto vs smooth)

## File List

- archer/components/OutputPanel.tsx (new)
- archer/components/OutputPanel.test.tsx (new)
- archer/app/page.tsx (modified)
- archer/app/globals.css (modified)
- archer/vitest.setup.ts (modified)
- archer/package.json (modified — added react-markdown, remark-gfm)
- archer/package-lock.json (modified — dependency lockfile updated)

### Review Findings

- [x] [Review][Patch] OutputPanel `animate-fade-in` replays on every re-render — DISMISSED on deeper inspection: animation only plays on mount (component unmounts when output is cleared); same-output-change re-render doesn't replay CSS animations. No fix needed. [archer/components/OutputPanel.tsx]
- [x] [Review][Patch] Template functions don't escape markdown-special characters in user input — FIXED: added `escapeMarkdown()` helper to both template functions. [archer/lib/templates/goal-template.ts, archer/lib/templates/project-template.ts]
- [x] [Review][Patch] Reduced-motion scroll path is never tested — FIXED: added 2 tests verifying `behavior: "auto"` when prefers-reduced-motion matches and `behavior: "smooth"` otherwise. [archer/app/page.test.tsx]
- [x] [Review][Defer] ModeToggle tabs don't handle Home/End keys — WAI-ARIA tablist pattern recommends Home/End for first/last tab navigation. Not critical for a 2-tab toggle. [archer/components/ModeToggle.tsx] — deferred, enhancement

## Change Log

- 2026-08-26: Story created — comprehensive developer guide with component architecture, animation strategy, accessibility patterns, and markdown rendering approach. Status → ready-for-dev.
- 2026-08-26: Story implementation complete — OutputPanel component with markdown rendering, fade-in animation, prose styling, page integration with focus/scroll management, and comprehensive tests (124 total). Status → review.
