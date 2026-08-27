---
baseline_commit: 6f83a39d25307fba2d07e7786772eabaf3c33b4f
---

# Story 2.2: Project Mode Template Engine

Status: done

## Story

As a user,
I want to type my project name and get a GTD project scaffold,
so that I can immediately see the purpose, outcome, and next physical actions for my project.

## Acceptance Criteria

1. **Given** Project mode is active and I have typed a project (e.g., "Personal portfolio website deployed online") **When** I submit the input **Then** a markdown string is generated containing:
   - A project heading with my input text inserted
   - A "Purpose" section describing why this project matters
   - A "Successful Outcome" section describing what "done" looks like
   - An ordered list of micro next actions (physical verbs, immediately executable)

2. **And** the generation is synchronous with no network requests

3. **And** the template function is a pure TypeScript function in `lib/templates/project-template.ts`

4. **And** next actions begin with physical verbs and are visible/concrete

5. **And** actions follow logical order with progressive difficulty

## Tasks / Subtasks

- [x] Task 1: Create Project Template Function (AC: #1, #2, #3)
  - [x] Create `archer/lib/templates/project-template.ts`
  - [x] Define and export function signature: `export function generateProjectTemplate(input: string): string`
  - [x] Function accepts a single string (the user's project text) and returns a markdown string
  - [x] Function is PURE: no side effects, no DOM access, no imports from React/Next.js
  - [x] Function is SYNCHRONOUS: no async, no Promises, no network calls
  - [x] Function is DETERMINISTIC: same input always produces same output

- [x] Task 2: Implement Template Structure (AC: #1, #4, #5)
  - [x] Section 1: `# [User's project text]` — heading with user input as the project title
  - [x] Section 2: `## Purpose` — placeholder text guiding user to describe why this project matters
  - [x] Section 3: `## Successful Outcome` — placeholder text guiding user to describe what "done" looks like in observable terms
  - [x] Section 4: `## Next Actions` — ordered micro next actions as `- [ ]` checkboxes
  - [x] Next actions use physical verbs (Open, Search, Click, Type, Create, Save, Navigate, Write, Read, Complete)
  - [x] Actions follow logical progression from trivially easy → more complex
  - [x] First action feels "almost impossible NOT to do" (e.g., "Open [specific app]")
  - [x] Include 8–10 placeholder next actions covering a reasonable project start sequence
  - [x] Ensure blank line between every block element
  - [x] No trailing whitespace

- [x] Task 3: Ensure GTD Methodology Compliance (AC: #4, #5)
  - [x] Next action placeholders start with physical verbs
  - [x] First action is trivially easy (lowest possible friction)
  - [x] Actions are specific: tool-specific, location-aware
  - [x] Progressive difficulty — each action slightly more complex than the last
  - [x] No vague actions like "Research X" or "Plan Y" — only visible, concrete steps
  - [x] Include a comment at the top of generated output indicating this is a GTD template scaffold

- [x] Task 4: Notion-Optimized Markdown Formatting (AC: #1)
  - [x] Use `#` headings syntax (not underline/setext style)
  - [x] Checkboxes use `- [ ]` format (dash, space, bracket, space, bracket)
  - [x] Blank line between every block element
  - [x] No trailing whitespace
  - [x] No extra blank lines that would create empty Notion blocks
  - [x] Clean line spacing: exactly one blank line between blocks

- [x] Task 5: Integrate Template into Page (AC: #1, #2)
  - [x] Import `generateProjectTemplate` into `app/page.tsx`
  - [x] Modify `handleSubmit` to call `generateProjectTemplate(inputText)` when mode is `'project'`
  - [x] Store the returned markdown string in existing `output` state
  - [x] Verify existing goal mode behavior is preserved
  - [x] Verify mode switch still clears output
  - [x] Verify validation still works in project mode

- [x] Task 6: Write Unit Tests for Template Function (AC: #1, #2, #3, #4, #5)
  - [x] Create `archer/lib/templates/project-template.test.ts`
  - [x] Test: function exists and is exported
  - [x] Test: returns a string
  - [x] Test: returned string contains the input project text
  - [x] Test: returned string contains "Purpose" section
  - [x] Test: returned string contains "Successful Outcome" section
  - [x] Test: returned string contains "Next Actions" section
  - [x] Test: returned string contains checkbox syntax `- [ ]`
  - [x] Test: next actions start with physical verbs
  - [x] Test: is synchronous (no async)
  - [x] Test: is deterministic (same input produces same output)
  - [x] Test: no trailing whitespace on any line
  - [x] Test: blank lines between block elements

- [x] Task 7: Integration Tests (AC: #1, #2)
  - [x] In `app/page.test.tsx`, add test: submitting in Project mode calls `generateProjectTemplate`
  - [x] Test: submitting in Goal mode does NOT call `generateProjectTemplate`
  - [x] Test: mode switch clears output after project generation
  - [x] Verify all existing 92 tests still pass

- [x] Task 8: Build, Lint, and Test Verification
  - [x] `npm run build` exits 0
  - [x] `npm run lint` exits 0
  - [x] `npm run test` — all existing 92 tests pass + new template tests pass
  - [x] No TypeScript errors

## Dev Notes

### Architecture Compliance

- **AD-4**: Template engine as PURE FUNCTION. `(input: string) => string`. No side effects, no DOM access, no React imports. Lives in `lib/templates/`.
- **AD-3**: State management via `useState` in page.tsx. Reuses existing `output` state — no new state needed.
- **Boundary Rule #2**: Template functions are pure — no DOM access, no React imports, no side effects. They live in `lib/` not `components/`.
- **Boundary Rule #1**: Page orchestrates — calls template function, stores result in state.

### Function Signature

```typescript
// lib/templates/project-template.ts

/**
 * Generates a GTD Project Mode markdown template with the user's project inserted.
 * Pure function: no side effects, deterministic, synchronous.
 */
export function generateProjectTemplate(input: string): string {
  // Returns Notion-optimized markdown string
}
```

### Template Output Structure (Exact Format)

The generated markdown MUST follow this exact structure. The user's input is inserted as the project heading. Everything else is scaffold with placeholder content the user fills in:

```markdown
<!-- GTD Project Mode template scaffold — replace placeholders with your own content -->

# [USER_INPUT_INSERTED_HERE]

## Purpose

[Why this project matters — what will completing it enable or change?]

## Successful Outcome

[Describe exactly what "done" looks like in observable, real-world terms. Someone watching should be able to confirm it's complete.]

## Next Actions

- [ ] Open [specific app/tool/browser]
- [ ] Navigate to [specific location or URL]
- [ ] Click [specific button or menu item]
- [ ] Type "[specific text to enter]"
- [ ] Create [specific artifact — file, page, document]
- [ ] Save [with specific name and location]
- [ ] Search "[specific search term]"
- [ ] Read [specific small section or result]
- [ ] Write down [specific small deliverable]
- [ ] Complete [specific tiny verification step]
```

### GTD Methodology Rules (from Source Prompt)

These rules come directly from the GTD PROJECT & NEXT ACTION GENERATOR PROMPT:

1. **Projects are outcome-based** — describe a finished result, NOT an activity
   - The project heading IS the user's input (which should be outcome-based)

2. **Next actions begin with physical verbs** — visible, concrete, immediately executable
   - BAD: "Research X", "Plan Y", "Learn Z"
   - GOOD: "Open YouTube", "Search 'beginner tutorial'", "Click first result"

3. **Principle of least effort** — smallest possible step, reduce friction
   - First action should feel "almost impossible NOT to do"
   - Progressive difficulty (easiest → harder)

4. **Actions are specific** — tool-specific, location-aware
   - Not "Write notes" → "Open Notion", "Click + New Page", "Type 'Project Notes'"

5. **Eliminate ambiguity completely** — every action answers: "What exactly do I physically do next?"

### Page State After This Story

```typescript
// app/page.tsx — expected state after Story 2.2
"use client";

import InputSection from "@/components/InputSection";
import ModeToggle from "@/components/ModeToggle";
import { generateGoalTemplate } from "@/lib/templates/goal-template";
import { generateProjectTemplate } from "@/lib/templates/project-template";
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
    } else {
      setOutput(generateProjectTemplate(inputText));
    }
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
          key={mode}
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
- **Do NOT** modify ModeToggle or InputSection components
- **Do NOT** break existing 92 tests
- **Do NOT** use AI/LLM APIs for generation — this is static template interpolation
- **Do NOT** generate dynamic/contextual content based on the project text — insert the user's text verbatim into the template scaffold heading
- **Do NOT** include tables (unlike Goal Mode) — Project Mode has no capability/resource analysis tables
- **Do NOT** include sub-project sections — Project Mode is flat: one project, one action list
- **Do NOT** add `tailwind.config.ts` — Tailwind v4 CSS-first only
- **Do NOT** use any state management library

### Template Content Clarification

**CRITICAL**: This is NOT an AI-powered generation. The template function:

1. Takes the user's raw input text
2. Inserts it as the `# Project` heading
3. Returns the scaffold with placeholder text for Purpose, Successful Outcome, and Next Actions

The scaffold has fixed structure with instructional placeholder text. The user copies this to Notion and fills in the blanks.

**Key difference from Goal Mode**: Project Mode is SIMPLER — no success criteria checklist, no capability/resource tables, no multiple sub-projects. It's a single project scaffold with one ordered action list.

### Import Path Convention

```typescript
import { generateProjectTemplate } from "@/lib/templates/project-template";
```

### Notion Markdown Compatibility Rules

The output MUST paste correctly into Notion:

- `#` headings → Notion headings (H1, H2)
- `- [ ]` → Notion to-do blocks
- Blank lines between blocks → proper Notion block separation
- No trailing whitespace → no empty blocks in Notion
- No HTML tags → raw markdown only

### Test Infrastructure

From Story 2.1:

- **Framework**: Vitest with jsdom environment
- **Libraries**: @testing-library/react, @testing-library/jest-dom, @testing-library/user-event
- **Config**: `archer/vitest.config.ts`
- **Setup**: `archer/vitest.setup.ts`
- **Script**: `npm run test` (runs `vitest run`)
- **Current count**: 92 tests passing

Template tests are UNIT tests — they don't need React Testing Library. Pure function → pure unit test with Vitest `describe`/`it`/`expect`. Follow the exact same pattern as `goal-template.test.ts`.

### Previous Story Intelligence

From Story 2.1 (current status: review):

- 92 total tests pass across all test files
- `generateGoalTemplate` pattern established: pure function, template literal, no trailing whitespace
- Used `key={mode}` on InputSection for clean validation state reset on mode switch
- Integration test pattern: spy on template module export, verify called/not-called per mode
- `output` state already exists in `page.tsx` — just wire up the project mode branch
- The `handleSubmit` currently only handles goal mode — project mode is a no-op (this is what we're fixing)
- The existing integration test `"does not call generateGoalTemplate in Project mode"` already verifies goal template is NOT called in project mode — the new story mirrors this for project template
- Build produces static export successfully
- No new dependencies needed for this story

### Existing File States (READ BEFORE MODIFYING)

**`app/page.tsx` current state:**

- Has `'use client'` directive
- Imports: `InputSection`, `ModeToggle`, `generateGoalTemplate`, `useState`
- State: `mode`, `inputText`, `output` (all via `useState`)
- `handleModeChange`: sets mode, clears inputText and output
- `handleSubmit`: calls `generateGoalTemplate(inputText)` when `mode === 'goal'` — **no project mode branch yet**
- `key={mode}` on InputSection for clean remount on mode switch
- ESLint warning on unused `output` variable (expected — resolved in Story 2.3 when OutputPanel renders it)

**Changes needed to `page.tsx`:**

- Add import for `generateProjectTemplate`
- Add `else` branch in `handleSubmit` to call `generateProjectTemplate(inputText)` when mode is `'project'`
- That's it — no other changes needed

**`lib/templates/` current state:**

- `goal-template.ts` — fully implemented pure function (reference for pattern)
- `goal-template.test.ts` — 15 unit tests (reference for test pattern)

**New file to create:**

- `lib/templates/project-template.ts` — new pure function
- `lib/templates/project-template.test.ts` — new unit tests

**`app/globals.css`:** Contains all design tokens. DO NOT MODIFY.
**`components/ModeToggle.tsx`:** Fully implemented. DO NOT MODIFY.
**`components/InputSection.tsx`:** Fully implemented. DO NOT MODIFY.

### Verification Checklist

1. `npm run build` exits 0, produces `out/` directory
2. `npm run lint` exits 0, zero errors
3. `npm run test` — all 92 existing tests pass + new template tests pass
4. `generateProjectTemplate("Personal portfolio website deployed online")` returns valid markdown
5. Returned markdown contains the input text verbatim as the `#` heading
6. Returned markdown has `## Purpose` section
7. Returned markdown has `## Successful Outcome` section
8. Returned markdown has `## Next Actions` section with `- [ ]` checkboxes
9. Next actions start with physical verbs
10. Blank lines between all block elements
11. No trailing whitespace on any line
12. Function is pure — no side effects, same input → same output
13. Function is synchronous — no async keyword
14. Page `handleSubmit` now branches: goal → generateGoalTemplate, project → generateProjectTemplate
15. Mode switch still clears output state
16. Existing InputSection validation still works in both modes
17. No TypeScript errors

### References

- [Source: ARCHITECTURE-SPINE.md#Decisions — AD-4: Template Engine as Pure Functions]
- [Source: ARCHITECTURE-SPINE.md#Seed Structure — lib/templates/project-template.ts]
- [Source: ARCHITECTURE-SPINE.md#Boundary Rules — #2: Template functions pure, no DOM]
- [Source: ARCHITECTURE-SPINE.md#Data Flow — User Input → Page State → projectTemplate fn → Markdown String]
- [Source: GTD PROJECT & NEXT ACTION GENERATOR PROMPT — Project structure, action rules, methodology]
- [Source: EXPERIENCE.md#Content Model — Project Mode output: purpose, successful outcome, next actions]
- [Source: EXPERIENCE.md#GTD Template Integrity — Methodology compliance rules]
- [Source: EXPERIENCE.md#Key Flows — Flow 2: Naledi scaffolds a project fast]
- [Source: epics.md#Story 2.2 — All acceptance criteria]
- [Source: epics.md#FR9 — Project Mode template content requirements]
- [Source: epics.md#FR10 — GTD methodology compliance]
- [Source: epics.md#FR11 — Synchronous client-side generation]
- [Source: epics.md#FR12 — User input inserted into template]
- [Source: epics.md#AR3 — Template in lib/templates/, pure TypeScript, deterministic]

## Project Context Reference

### project-context.md Status

`project-context.md` does **NOT exist** in this project. Conventions are derived from the architecture spine, planning artifacts, and established patterns from Stories 1.1–2.1.

### Applicable Conventions from Planning Artifacts

- **Tech Stack**: Next.js 16.3.3, React 19.2.8, Tailwind CSS v4, TypeScript 5.x
- **Template Pattern**: Pure TypeScript function in `lib/templates/`, signature `(input: string) => string`, deterministic, no side effects
- **State Pattern**: `useState` in `page.tsx` only. Existing `output` state reused — no new state needed
- **File Organization**: `lib/templates/project-template.ts` for template logic, `app/page.tsx` adds import + else branch
- **No Libraries**: Zero external template, state, or UI libraries
- **Testing**: Vitest — unit tests for pure functions (no React Testing Library needed for template tests); follow `goal-template.test.ts` pattern exactly
- **Build/Lint**: `npm run build` (static export), `npm run lint` (ESLint), `npm run test` (Vitest)
- **Import Paths**: Use `@/lib/templates/project-template` path alias
- **Markdown Format**: Notion-optimized (`#` headings, `- [ ]` checkboxes, blank line separators, NO tables in Project Mode)
- **No Network**: NFR6 — zero network requests after page load

### Review Findings

- [x] [Review][Decision] Project Mode uses `- [ ]` checkboxes instead of ordered list — RESOLVED: Keep checkboxes. AC wording imprecise; Dev Notes, Goal Mode consistency, and Notion to-do semantics all align on `- [ ]` format. [archer/lib/templates/project-template.ts]
- [x] [Review][Patch] No integration test asserting rendered content inside OutputPanel after generation — FIXED: added 2 integration tests verifying actual template headings/content render in the panel. [archer/app/page.test.tsx]
- [x] [Review][Defer] ModeToggle tabs missing `aria-controls` and `id` attributes — WAI-ARIA tablist pattern recommends `id` on each tab and `aria-controls` pointing to the controlled panel. Not blocking since there are no visible tabpanels in this design (the content area is not formally a tabpanel). [archer/components/ModeToggle.tsx] — deferred, pre-existing pattern decision

## Change Log

- 2026-08-26: Story created — comprehensive developer guide with template structure, GTD methodology rules, integration blueprint, and Notion formatting requirements. Status → ready-for-dev.
- 2026-08-26: Implementation complete — project template function created, integrated into page, 15 new tests (12 unit + 3 integration) all passing. Total suite: 107 tests green. Build and lint pass. Status → review.

## Dev Agent Record

### Implementation Plan

- Created pure template function following exact pattern from `goal-template.ts`
- Template uses string template literal with user input inserted as `#` heading
- Integrated into `page.tsx` with simple `else` branch in `handleSubmit`
- Unit tests cover all ACs: purity, determinism, synchronous, physical verbs, Notion formatting
- Integration tests verify mode-specific routing of template calls

### Completion Notes

- `generateProjectTemplate` is a pure, synchronous, deterministic function — same pattern as goal template
- Template includes GTD comment header, Purpose/Successful Outcome sections, and 10 next actions with progressive difficulty
- Next actions all start with physical verbs: Open, Navigate, Click, Type, Create, Save, Search, Read, Write, Complete
- Page integration: added import + else branch — minimal change, no refactoring needed
- All 107 tests pass (92 existing + 12 unit + 3 integration)
- Build produces static export successfully
- Lint passes with only pre-existing `output` unused warning (resolved in Story 2.3)

## File List

- `archer/lib/templates/project-template.ts` — NEW: pure template function
- `archer/lib/templates/project-template.test.ts` — NEW: 12 unit tests
- `archer/app/page.tsx` — MODIFIED: added import + else branch in handleSubmit
- `archer/app/page.test.tsx` — MODIFIED: added 3 integration tests for project mode
