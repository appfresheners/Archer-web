---
title: "Notion-Optimized Markdown Quality"
type: "feature"
created: "2026-08-27"
status: "draft"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Both templates emit an HTML comment as the first line (`<!-- GTD Goal/Project Mode template scaffold... -->`) which Notion renders as an empty/broken block. The templates also lack a trailing newline, and the ActionBar buttons don't expand to full-width on mobile — all violating the Notion-optimized and UX requirements for Story 3.5.

**Approach:** Remove HTML comments from template output, ensure a trailing newline terminates each template, add `w-full sm:w-auto` to ActionBar buttons for mobile stacking, and add targeted tests validating Notion-specific formatting rules (no HTML comments, table separator rows, trailing newline, full-width mobile buttons).

## Boundaries & Constraints

**Always:**

- Template functions remain pure, deterministic, synchronous — no behavioral changes to generation logic beyond formatting cleanup.
- Markdown must use `#` ATX headings, `- [ ]` checkboxes (space after dash, space inside brackets), `|` pipe tables with header separator rows, and blank lines between every block element.
- No trailing whitespace on any line. Exactly one trailing newline at end of output.
- Project Mode action lists use `- [ ]` checkboxes (not numbered lists).
- ActionBar buttons stack vertically full-width on mobile (<640px), horizontal at ≥640px. Copy first (primary), Download second (secondary outline).

**Ask First:**

- If removing the HTML comment breaks any downstream consumer (test, snapshot, etc.) in a non-obvious way.

**Never:**

- Do not change the structural content of templates (sections, headings, placeholder text).
- Do not modify clipboard, download, or slugify utilities.
- Do not introduce new dependencies.

## I/O & Edge-Case Matrix

| Scenario                    | Input / State          | Expected Output / Behavior                                    | Error Handling |
| --------------------------- | ---------------------- | ------------------------------------------------------------- | -------------- | ---------------------------------------------- | --- |
| Goal template no comment    | Any goal input         | Output starts with `# My 3-Month Goal` (no HTML comment line) | N/A            |
| Project template no comment | Any project input      | Output starts with `# {escaped input}` (no HTML comment line) | N/A            |
| Trailing newline            | Any input, either mode | Output ends with exactly one `\n` character                   | N/A            |
| Table separator format      | Goal template          | All tables have `                                             | ---            | `-style separator row immediately after header | N/A |
| Mobile button width         | Viewport < 640px       | Both ActionBar buttons render full-width (100% of container)  | N/A            |

</frozen-after-approval>

## Code Map

- `archer/lib/templates/goal-template.ts` — MODIFY: remove leading HTML comment line, add trailing `\n` to template literal
- `archer/lib/templates/project-template.ts` — MODIFY: remove leading HTML comment line, add trailing `\n` to template literal
- `archer/lib/templates/goal-template.test.ts` — MODIFY: add tests for no-HTML-comment and trailing newline; add test verifying table separator row pattern
- `archer/lib/templates/project-template.test.ts` — MODIFY: add tests for no-HTML-comment and trailing newline
- `archer/components/ActionBar.tsx` — MODIFY: add `w-full sm:w-auto` to both button classNames (line 88 and 101)
- `archer/components/ActionBar.test.tsx` — MODIFY: add test verifying both buttons have full-width class on mobile

## Tasks & Acceptance

**Execution:**

- [ ] `archer/lib/templates/goal-template.ts` — Remove the opening HTML comment line from template output; append `\n` at end of template literal
- [ ] `archer/lib/templates/project-template.ts` — Remove the opening HTML comment line from template output; append `\n` at end of template literal
- [ ] `archer/components/ActionBar.tsx` — Add `w-full sm:w-auto` class to both Copy and Download buttons for full-width mobile stacking
- [ ] `archer/lib/templates/goal-template.test.ts` — Add tests: output does not contain HTML comments, output ends with single `\n`, table separator rows match `| -+ |` pattern
- [ ] `archer/lib/templates/project-template.test.ts` — Add tests: output does not contain HTML comments, output ends with single `\n`
- [ ] `archer/components/ActionBar.test.tsx` — Add test: both buttons have `w-full` class applied

**Acceptance Criteria:**

- Given a Goal Mode generation, when the raw markdown is inspected, then it starts with `# My 3-Month Goal` (no HTML comment preceding it)
- Given a Project Mode generation, when the raw markdown is inspected, then it starts with `# {user input}` (no HTML comment preceding it)
- Given either mode generation, when the output string is checked, then it ends with exactly one newline character
- Given a Goal Mode generation, when tables are inspected, then every pipe table has a header separator row using `---` between pipes
- Given the ActionBar on mobile (<640px), when buttons render, then they each span the full container width
- Given all existing tests, when test suite runs, then all pass with no regressions

## Spec Change Log

## Design Notes

**HTML comment removal rationale:** Notion treats HTML comments as unrecognized content and renders empty blocks or raw text. Since these are scaffold hints for developers, not end-user content, they belong in code comments (TypeScript), not in the generated output.

**Trailing newline:** POSIX convention and Notion both benefit from a final newline. Without it, some paste contexts concatenate the last line with whatever follows. Adding `\n` at the end of the template literal is the minimal fix.

**Button width on mobile:** The container already uses `flex flex-col` below `sm:`, but flex children don't automatically stretch to full width without `w-full`. Adding `w-full sm:w-auto` ensures proper full-width stacking on mobile while preserving auto-width on desktop.

## Verification

**Commands:**

- `npm run build` -- expected: exits 0, no TypeScript errors
- `npm run lint` -- expected: exits 0, no lint errors
- `npm run test` -- expected: all tests pass including new Notion-format tests
