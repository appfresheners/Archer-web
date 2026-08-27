---
baseline_commit: 95208b54ceb55a2b021c033a34c154a4b88ab041
---

# Story 2.1: Goal Mode Template Engine

Status: done

## Story

As a user,
I want to type my goal and get a full GTD breakdown structure,
so that I can see my big ambition transformed into actionable projects and next actions.

## Acceptance Criteria

1. **Given** Goal mode is active and I have typed a goal (e.g., "Become a proficient guitarist in 3 months") **When** I submit the input **Then** a markdown string is generated containing:
   - A "3-Month Goal" heading with my input text inserted
   - A "Success Criteria" section with checkbox placeholders
   - A "Capability Analysis" section with a table (skill × rating columns)
   - A "Resource Analysis" section with a table (resource × rating columns)
   - GTD outcome-based project sections (each with Purpose + Successful Outcome)
   - Micro next actions per project (beginning with physical verbs)

2. **And** the generation is synchronous with no network requests

3. **And** the template function is a pure TypeScript function in `lib/templates/goal-template.ts`

4. **And** projects are outcome-based (describe a finished result, not an activity)

5. **And** next actions follow the principle of least effort (smallest possible step)

6. **And** the first action per project feels "almost impossible NOT to do"

## Tasks / Subtasks

- [x] Task 1: Create Goal Template Function (AC: #1, #2, #3)
  - [x] Create `lib/templates/goal-template.ts`
  - [x] Define and export function signature: `export function generateGoalTemplate(input: string): string`
  - [x] Function accepts a single string (the user's goal text) and returns a markdown string
  - [x] Function is PURE: no side effects, no DOM access, no imports from React/Next.js
  - [x] Function is SYNCHRONOUS: no async, no Promises, no network calls
  - [x] Function is DETERMINISTIC: same input always produces same output
  - [x] Remove `.gitkeep` from `lib/templates/` after creating the file

- [x] Task 2: Implement Template Structure (AC: #1, #4, #5, #6)
  - [x] Section 1: "# My 3-Month Goal" heading with the user's input inserted below
  - [x] Section 1b: "## I'll know I succeeded when…" with 5 placeholder checkboxes (`- [ ] [Define measurable outcome]`)
  - [x] Section 2: "## What does someone who achieves this easily have?" heading
  - [x] Section 2a: "### Capabilities they have" with pipe table (skill | Rating (1–10)) and 5 placeholder rows
  - [x] Section 2b: "### Resources they have" with pipe table (resource | Rating (1–10)) and 5 placeholder rows
  - [x] Section 3: "## GTD Projects" heading
  - [x] Section 3a: Three outcome-based project subsections, each with:
    - `### [Outcome-based project name placeholder]`
    - `#### Purpose` with placeholder text
    - `#### Successful Outcome` with placeholder text
    - `#### Next Actions` with 5+ micro action checkboxes (`- [ ] [Physical verb action]`)
  - [x] Ensure blank line between every block element (heading, paragraph, list, table)
  - [x] No trailing whitespace or extra newlines

- [x] Task 3: Ensure GTD Methodology Compliance (AC: #4, #5, #6)
  - [x] Project names in placeholders must be outcome-based examples (not activity-based)
  - [x] Next action placeholders must start with physical verbs ("Open", "Type", "Click", "Write", "Search")
  - [x] First action per project must feel trivially easy (e.g., "Open YouTube" not "Research sensors")
  - [x] Actions follow logical progressive order (easiest first, building complexity)
  - [x] Include a comment at the top of generated output indicating this is a GTD template scaffold
  - [x] Placeholder text guides the user to replace with their specific content

- [x] Task 4: Notion-Optimized Markdown Formatting (AC: #1)
  - [x] Use `#` heading syntax (not underline/setext style)
  - [x] Checkboxes use `- [ ]` format (dash, space, bracket, space, bracket)
  - [x] Tables use pipe `|` syntax with header separator row (`| --- | --- |`)
  - [x] Blank line between every block element
  - [x] No trailing whitespace
  - [x] No extra blank lines that would create empty Notion blocks
  - [x] Clean line spacing: exactly one blank line between blocks

- [x] Task 5: Integrate Template into Page (AC: #1, #2)
  - [x] Import `generateGoalTemplate` into `app/page.tsx`
  - [x] Add `output` state: `const [output, setOutput] = useState("")`
  - [x] Modify `handleSubmit` to call `generateGoalTemplate(inputText)` when mode is `'goal'`
  - [x] Store the returned markdown string in `output` state
  - [x] For now, just store the output — rendering is Story 2.3's responsibility
  - [x] Verify existing behavior preserved: mode switch clears output, validation still works
  - [x] Clear `output` state when mode changes (in `handleModeChange`)

- [x] Task 6: Write Unit Tests for Template Function (AC: #1, #2, #3, #4, #5, #6)
  - [x] Create `lib/templates/goal-template.test.ts`
  - [x] Test: function exists and is exported
  - [x] Test: returns a string
  - [x] Test: returned string contains the input goal text
  - [x] Test: returned string contains "3-Month Goal" heading
  - [x] Test: returned string contains "I'll know I succeeded when" section
  - [x] Test: returned string contains checkbox syntax `- [ ]`
  - [x] Test: returned string contains "Capabilities they have" section with pipe table
  - [x] Test: returned string contains "Resources they have" section with pipe table
  - [x] Test: returned string contains at least 3 project sections
  - [x] Test: each project section contains Purpose, Successful Outcome, and Next Actions
  - [x] Test: next actions start with physical verbs (check first action of each project)
  - [x] Test: no network requests (function is synchronous, no async)
  - [x] Test: same input produces same output (deterministic)
  - [x] Test: output has no trailing whitespace on any line
  - [x] Test: blank lines between block elements (no consecutive headings without separator)

- [x] Task 7: Integration Tests (AC: #1, #2)
  - [x] In page test file, test that submitting in Goal mode produces output state
  - [x] Test that output state is cleared on mode switch
  - [x] Test that output state is cleared on "start over" (future-proofing)
  - [x] Verify existing 72 tests still pass

- [x] Task 8: Build, Lint, and Test Verification
  - [x] `npm run build` exits 0
  - [x] `npm run lint` exits 0
  - [x] `npm run test` — all existing 72 tests pass + new template tests pass
  - [x] No TypeScript errors

## Dev Notes

### Architecture Compliance

- **AD-4**: Template engine as PURE FUNCTION. `(input: string) => string`. No side effects, no DOM access, no React imports. Lives in `lib/templates/`.
- **AD-3**: State management via `useState` in page.tsx. New `output` state added alongside existing `mode` and `inputText`.
- **Boundary Rule #2**: Template functions are pure — no DOM access, no React imports, no side effects. They live in `lib/` not `components/`.
- **Boundary Rule #1**: Page orchestrates — calls template function, stores result in state, passes to components.

### Function Signature

```typescript
// lib/templates/goal-template.ts

/**
 * Generates a GTD Goal Mode markdown template with the user's goal inserted.
 * Pure function: no side effects, deterministic, synchronous.
 */
export function generateGoalTemplate(input: string): string {
  // Returns Notion-optimized markdown string
}
```

### Template Output Structure (Exact Format)

The generated markdown MUST follow this exact structure. The user's input is inserted where indicated. Everything else is the scaffold/template with placeholder content the user fills in:

```markdown
# My 3-Month Goal

**{USER_INPUT_INSERTED_HERE}**

## I'll know I succeeded when…

- [ ] [Define a specific, measurable outcome]
- [ ] [Define a concrete ability you can demonstrate]
- [ ] [Define an observable result others can verify]
- [ ] [Define a practical achievement, not theoretical knowledge]
- [ ] [Define a completion milestone with a clear deliverable]

## What does someone who achieves this easily have?

### Capabilities they have

| What they can do                                    | Rating (1–10) |
| --------------------------------------------------- | ------------- |
| [Practical ability related to your goal]            |               |
| [Repeatable execution skill]                        |               |
| [Independent problem-solving in this domain]        |               |
| [Consistent habit or routine]                       |               |
| [Communication or teaching ability related to goal] |               |

### Resources they have

| What they have access to                 | Rating (1–10) |
| ---------------------------------------- | ------------- |
| [Tool, software, or equipment]           |               |
| [Knowledge source or learning material]  |               |
| [Environment or workspace]               |               |
| [Mentor, community, or support system]   |               |
| [Time block or energy management system] |               |

## GTD Projects

### [Outcome-based project name: describe the finished result]

#### Purpose

[Why this project matters for achieving your goal]

#### Successful Outcome

[What "done" looks like — clear, observable, completable]

#### Next Actions

- [ ] Open [specific app/tool/browser]
- [ ] Search "[specific search term related to project]"
- [ ] Read/watch the first [specific small portion]
- [ ] Write down [specific small deliverable]
- [ ] [Next logical micro step]

### [Second outcome-based project name]

#### Purpose

[Why this project matters]

#### Successful Outcome

[What "done" looks like]

#### Next Actions

- [ ] Open [specific app/tool]
- [ ] Create [specific small artifact]
- [ ] Type "[specific content to write]"
- [ ] Save [with specific name/location]
- [ ] [Next logical micro step]

### [Third outcome-based project name]

#### Purpose

[Why this project matters]

#### Successful Outcome

[What "done" looks like]

#### Next Actions

- [ ] Open [specific app/tool]
- [ ] Navigate to [specific location]
- [ ] Click/tap [specific button or link]
- [ ] Complete [specific tiny task]
- [ ] [Next logical micro step]
```

### GTD Methodology Rules (from Source Prompts)

These rules come directly from the MASTER GOAL system prompt and MUST be reflected in placeholder text:

1. **Projects are outcome-based** — describe a finished result, NOT an activity
   - BAD: "Learn Arduino", "Study wiring", "Watch tutorials"
   - GOOD: "Motion detection alarm system successfully working", "Core concepts understood well enough to explain simply"

2. **Next actions begin with physical verbs** — visible, concrete, immediately executable
   - BAD: "Research X", "Create document", "Learn Y"
   - GOOD: "Open YouTube", "Search 'beginner guitar lesson 1'", "Watch first 5 minutes"

3. **Principle of least effort** — smallest possible step, reduce friction
   - First action should feel "almost impossible NOT to do"
   - Progressive difficulty (easiest → harder)

4. **Actions are specific** — tool-specific, location-aware, time-bounded
   - Not "Write notes" → "Open Notion", "Click + New Page", "Type 'Week 1 Notes'"

### Page State After This Story

```typescript
// app/page.tsx — expected state after Story 2.1
"use client";

import InputSection from "@/components/InputSection";
import ModeToggle from "@/components/ModeToggle";
import { generateGoalTemplate } from "@/lib/templates/goal-template";
import { useState } from "react";

export default function Home() {
  const [mode, setMode] = useState<"goal" | "project">("goal");
  const [inputText, setInputText] = useState("");
  const [output, setOutput] = useState("");

  const handleModeChange = (newMode: "goal" | "project") => {
    setMode(newMode);
    setInputText("");
    setOutput("");
  };

  const handleSubmit = () => {
    if (mode === "goal") {
      setOutput(generateGoalTemplate(inputText));
    }
    // Project mode generation added in Story 2.2
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

      {/* OutputPanel rendering added in Story 2.3 */}
    </main>
  );
}
```

### What NOT To Do

- **Do NOT** make the template function async — it's synchronous string interpolation
- **Do NOT** use any template library (Handlebars, Mustache, etc.) — pure string concatenation/template literals
- **Do NOT** make network requests (NFR6: no requests after page load)
- **Do NOT** import React or any DOM APIs in the template file
- **Do NOT** add loading states — generation is instant (FR11)
- **Do NOT** render the output visually yet — OutputPanel is Story 2.3
- **Do NOT** add `tailwind.config.ts` — Tailwind v4 CSS-first only
- **Do NOT** use any state management library
- **Do NOT** modify ModeToggle or InputSection components
- **Do NOT** break existing 72 tests
- **Do NOT** use AI/LLM APIs for generation — this is static template interpolation
- **Do NOT** generate dynamic/contextual content based on the goal text — insert the user's text verbatim into the template scaffold

### Template Content Clarification

**CRITICAL**: This is NOT an AI-powered generation. The template function:

1. Takes the user's raw input text
2. Inserts it into a predefined markdown scaffold at the "3-Month Goal" position
3. Returns the scaffold with placeholder text for the user to fill in

The scaffold has fixed structure but uses instructional placeholder text that guides the user on what to fill in. The user copies this to Notion and fills in the blanks.

The value is: instant GTD-compliant structure that users don't have to build from scratch.

### Import Path Convention

```typescript
import { generateGoalTemplate } from "@/lib/templates/goal-template";
```

### Notion Markdown Compatibility Rules

The output MUST paste correctly into Notion:

- `#` headings → Notion headings (H1, H2, H3)
- `- [ ]` → Notion to-do blocks
- `| pipe | tables |` → Notion tables
- Blank lines between blocks → proper Notion block separation
- No trailing whitespace → no empty blocks in Notion
- No HTML tags → raw markdown only

### Test Infrastructure

From Story 1.4:

- **Framework**: Vitest with jsdom environment
- **Libraries**: @testing-library/react, @testing-library/jest-dom, @testing-library/user-event
- **Config**: `archer/vitest.config.ts`
- **Setup**: `archer/vitest.setup.ts`
- **Script**: `npm run test` (runs `vitest run`)
- **Current count**: 72 tests passing

Template tests are UNIT tests — they don't need React Testing Library. Pure function → pure unit test with Vitest `describe`/`it`/`expect`.

### Previous Story Intelligence

From Story 1.4 (most recent completed):

- 72 total tests pass across all test files
- Build produces static export successfully
- `@testing-library/user-event` was added as dev dependency
- Error text contrast fixed (red-600 → red-700)
- Body has `min-height: 100vh` / `100dvh`
- Focus ring pattern: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]`
- All NFR checks passed (except bundle size slightly over at ~135KB due to Next.js 16 baseline)

### Existing File States (READ BEFORE MODIFYING)

**`app/page.tsx` current state:**

- Has `'use client'` directive
- Imports: `InputSection`, `ModeToggle`, `useState`
- State: `mode` ('goal' | 'project'), `inputText` (string)
- `handleModeChange`: sets mode, clears inputText
- `handleSubmit`: currently `console.log("Submit:", mode, inputText)` — REPLACE THIS
- Renders: `<main>` → hero → ModeToggle → InputSection

**Changes needed to `page.tsx`:**

- Add import for `generateGoalTemplate`
- Add `output` state (string, default "")
- Modify `handleSubmit` to generate output when mode is 'goal'
- Modify `handleModeChange` to also clear `output`
- No visual rendering of output yet (that's Story 2.3)

**`lib/templates/` current state:**

- Contains only `.gitkeep` — DELETE this file after creating `goal-template.ts`

**`app/globals.css`:** Contains all design tokens. DO NOT MODIFY.
**`components/ModeToggle.tsx`:** Fully implemented. DO NOT MODIFY.
**`components/InputSection.tsx`:** Fully implemented. DO NOT MODIFY.

### Verification Checklist

1. `npm run build` exits 0, produces `out/` directory
2. `npm run lint` exits 0, zero errors
3. `npm run test` — all 72 existing tests pass + new template tests pass
4. `generateGoalTemplate("Become a proficient guitarist in 3 months")` returns valid markdown
5. Returned markdown contains the input text verbatim
6. Returned markdown has proper heading hierarchy (# → ## → ### → ####)
7. Returned markdown has `- [ ]` checkbox syntax
8. Returned markdown has pipe tables with header separators
9. Returned markdown has blank lines between all block elements
10. No trailing whitespace on any line
11. Function is pure — no side effects, same input → same output
12. Function is synchronous — no async keyword
13. Page state includes `output` that gets set on submit in goal mode
14. Mode switch clears output state
15. Existing InputSection validation still works (empty input blocked)
16. No TypeScript errors

### References

- [Source: ARCHITECTURE-SPINE.md#Decisions — AD-4: Template Engine as Pure Functions]
- [Source: ARCHITECTURE-SPINE.md#Seed Structure — lib/templates/goal-template.ts]
- [Source: ARCHITECTURE-SPINE.md#Boundary Rules — #2: Template functions pure, no DOM]
- [Source: ARCHITECTURE-SPINE.md#Data Flow — User Input → Page State → goalTemplate fn → Markdown String]
- [Source: MASTER GOAL SYSTEM PROMPT — Full template structure, GTD rules, action format]
- [Source: Reverse Goal setting template — Table structure, success criteria format]
- [Source: EXPERIENCE.md#Content Model — Goal Mode output structure]
- [Source: EXPERIENCE.md#GTD Template Integrity — Methodology compliance rules]
- [Source: EXPERIENCE.md#State Patterns — Empty→Ready→Output state transitions]
- [Source: epics.md#Story 2.1 — All acceptance criteria]
- [Source: epics.md#FR8 — Goal Mode template content requirements]
- [Source: epics.md#FR10 — GTD methodology compliance]
- [Source: epics.md#FR11 — Synchronous client-side generation]
- [Source: epics.md#FR12 — User input inserted into template]
- [Source: epics.md#AR3 — Template in lib/templates/, pure TypeScript, deterministic]

## Project Context Reference

### project-context.md Status

`project-context.md` does **NOT exist** in this project. Conventions are derived from the architecture spine, planning artifacts, and established patterns from Stories 1.1–1.4.

### Applicable Conventions from Planning Artifacts

- **Tech Stack**: Next.js 16.3.3, React 19.2.8, Tailwind CSS v4, TypeScript 5.x
- **Template Pattern**: Pure TypeScript function in `lib/templates/`, signature `(input: string) => string`, deterministic, no side effects
- **State Pattern**: `useState` in `page.tsx` only. New `output` state co-located with `mode` and `inputText`
- **File Organization**: `lib/templates/goal-template.ts` for template logic, `app/page.tsx` for state orchestration
- **No Libraries**: Zero external template, state, or UI libraries
- **Testing**: Vitest — unit tests for pure functions (no React Testing Library needed for template tests)
- **Build/Lint**: `npm run build` (static export), `npm run lint` (ESLint), `npm run test` (Vitest)
- **Import Paths**: Use `@/lib/templates/goal-template` path alias
- **Markdown Format**: Notion-optimized (`#` headings, `- [ ]` checkboxes, `|` pipe tables, blank line separators)
- **No Network**: NFR6 — zero network requests after page load

## Change Log

- 2026-08-26: Story created — comprehensive developer guide with template structure, GTD methodology rules, integration blueprint, and Notion formatting requirements. Status → ready-for-dev.
- 2026-08-27: Implementation complete — all 8 tasks done. Pure template function created, integrated into page, 20 new tests added (15 unit + 3 integration + 2 adjusted existing). Fixed InputSection useEffect anti-pattern with key-based remount. Total: 92 tests passing. Status → review.

## Dev Agent Record

### Implementation Plan

- Created `lib/templates/goal-template.ts` as a pure synchronous function using template literals
- Template follows exact structure from Dev Notes with GTD methodology compliance
- Integrated into `app/page.tsx` with `output` state, `handleModeChange` clears it
- Used `key={mode}` on InputSection to reset validation state on mode switch (eliminated useEffect anti-pattern)
- Wrote 15 unit tests covering purity, determinism, structure, GTD compliance, and formatting
- Wrote 3 integration tests verifying page-level behavior (generate on submit, no-op in project mode, clear on switch)

### Completion Notes

- All acceptance criteria satisfied: synchronous pure function, GTD-compliant structure, Notion-optimized markdown
- Bonus fix: eliminated `useEffect` + `setState` anti-pattern in InputSection using `key` prop remount pattern
- Build: 0 errors, Lint: 0 errors (1 expected warning for unused `output` var pending Story 2.3), Tests: 92/92 pass
- No new dependencies added

## File List

- `archer/lib/templates/goal-template.ts` (new) — pure template function
- `archer/lib/templates/goal-template.test.ts` (new) — 15 unit tests
- `archer/lib/templates/.gitkeep` (deleted) — no longer needed
- `archer/app/page.tsx` (modified) — added output state, generateGoalTemplate import, handleSubmit logic, key prop on InputSection
- `archer/app/page.test.tsx` (modified) — added 3 integration tests, updated imports, fixed stale ref after remount
- `archer/components/InputSection.tsx` (modified) — removed useEffect anti-pattern, validation resets via key-based remount
