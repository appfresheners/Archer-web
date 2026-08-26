---
status: draft
created: 2026-08-20
updated: 2026-08-20
sources:
  - brief: ../briefs/brief-GTDGoalandProjectCreator-2026-08-20/brief.md
  - gtd-prompt: ../../../docs/GTD PROJECT & NEXT ACTION GENERATOR PROMPT 35b0181187e4809b89fefd98c65120fd.md
  - master-goal-prompt: ../../../docs/MASTER GOAL → GTD PROJECT SYSTEM PROMPT 35b0181187e480ca84d7f4fb71693b51.md
  - reverse-template: ../../../docs/Reverse Goal setting template 3c20181187e48014b0a7fc3204a76710.md
---

# Foundation

- **Form factor:** Web — responsive, mobile-first, single page
- **Tech stack:** Next.js + Tailwind CSS, static export, Vercel deployment
- **UI system:** Custom lightweight components (no framework). DESIGN.md is the visual identity reference.
- **Visual identity:** See `DESIGN.md`

# Information Architecture

## Surfaces

| Surface         | Purpose                                       | Entry point              |
| --------------- | --------------------------------------------- | ------------------------ |
| Landing / Input | Mode selection + text input + generate        | Direct URL (single page) |
| Output          | Rendered GTD template + copy/download actions | Generate button submit   |

[ASSUMPTION] Single-page app — "Landing" and "Output" are states of the same page, not separate routes. Output replaces or appears below input after generation.

## Site Map

```
/ (single page)
├── Hero: product name + one-line value prop
├── Mode Toggle: Goal │ Project
├── Input Section
│   ├── Text input (contextual placeholder per mode)
│   └── Generate button
├── Output Section (hidden until generated)
│   ├── Rendered markdown template
│   ├── Action bar: Copy Markdown │ Download .md
│   └── Regenerate / Start over link
└── Footer: minimal — "Built with GTD methodology" + optional links
```

## Content Model

**Goal Mode output structure** (derived from MASTER GOAL prompt):

1. 3-Month Goal definition
2. Success criteria (checklist)
3. Capability analysis (table: skill × rating)
4. Resource analysis (table: resource × rating)
5. GTD outcome-based projects (each with purpose + successful outcome)
6. Micro next actions per project

**Project Mode output structure** (derived from GTD PROJECT prompt):

1. Project purpose
2. Successful outcome description
3. Complete set of micro next actions (ordered)

All output is Notion-optimized markdown: `#` headings, `- [ ]` checkboxes, `|` pipe tables.

# Voice and Tone

Microcopy is terse, action-oriented, zero-fluff. Mirrors GTD's execution-first philosophy.

| Context               | Tone               | Example                                           |
| --------------------- | ------------------ | ------------------------------------------------- |
| Placeholder text      | Inviting, concrete | "e.g., Become a proficient guitarist in 3 months" |
| Generate button       | Direct             | "Break it down"                                   |
| Empty state           | Encouraging, brief | "Type a goal. Get the next actions."              |
| Copy confirmation     | Minimal            | "Copied ✓"                                        |
| Download confirmation | Minimal            | "Downloaded ✓"                                    |
| Error (empty input)   | Gentle nudge       | "Enter a goal or project first"                   |
| Example CTA           | Low-key            | "Try an example"                                  |

Brand voice (personality, longer-form copy) lives in DESIGN.md Brand & Style.

# Component Patterns

Behavioral specs only — visual appearance lives in DESIGN.md.Components.

## Mode Toggle

- Two-segment: "Goal" | "Project"
- Default: Goal mode active
- Switching modes clears input and output
- Keyboard: arrow keys cycle, Enter/Space activates
- Announce mode change to screen readers

## Text Input

- Single line, expandable feel (large hit target)
- Placeholder changes per mode:
  - Goal: "e.g., Become a proficient guitarist in 3 months"
  - Project: "e.g., Personal portfolio website deployed online"
- Submit on Enter key (in addition to button click)
- Input trimmed on submit; empty string blocked
- No character limit in MVP1 [ASSUMPTION]

## Generate Button

- Disabled when input is empty (visually muted + `aria-disabled`)
- On click/Enter: immediate template generation (client-side, no network)
- [ASSUMPTION] No loading state needed — generation is synchronous string interpolation

## Output Panel

- Hidden until first generation
- Appears with a subtle entrance (opacity fade, no layout shift)
- Rendered as formatted HTML (not raw markdown) for readability
- Raw markdown accessible via Copy/Download actions

## Action Bar (Copy + Download)

- Appears attached to output panel
- "Copy Markdown" — writes raw `.md` string to clipboard
  - On success: button text → "Copied ✓" (emerald) for 2s, then resets
  - On failure (permissions): fallback — select-all in a textarea modal
- "Download .md" — triggers browser download of a `.md` file
  - Filename: `archer-goal-{sanitized-input-slug}.md` or `archer-project-{slug}.md`
  - On success: button text → "Downloaded ✓" for 2s

## Example Button

- "Try an example" link/button
- Pre-fills input with a curated example per current mode
- Auto-triggers generation so user sees output immediately
- Goal example: "Become a proficient guitarist in 3 months"
- Project example: "Personal portfolio website deployed online"

## Regenerate / Start Over

- Visible after output is shown
- "Start over" clears input + output, returns focus to input
- [ASSUMPTION] "Regenerate" is identical to "Start over" in MVP1 (no AI variation). Could be omitted — just "Start over" suffices.

# State Patterns

| State          | Visible UI                                                         | Transitions to                                           |
| -------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| **Empty**      | Hero + mode toggle + input (empty) + disabled button + example CTA | Typing → Ready                                           |
| **Ready**      | Input has text + enabled button                                    | Submit → Output                                          |
| **Output**     | Input (populated) + output panel + action bar + start-over link    | Copy → Copied; Download → Downloaded; Start over → Empty |
| **Copied**     | "Copied ✓" button (2s)                                             | Auto-resets → Output                                     |
| **Downloaded** | "Downloaded ✓" button (2s)                                         | Auto-resets → Output                                     |

No loading state, no error state beyond empty-input validation (client-side generation).

# Interaction Primitives

| Interaction | Trigger                   | Response                                                |
| ----------- | ------------------------- | ------------------------------------------------------- |
| Mode switch | Click/tap toggle segment  | Clear input + output; update placeholder; announce mode |
| Type        | Keystrokes in input       | Enable button when non-empty                            |
| Submit      | Enter key or button click | Generate output; scroll to output if below fold         |
| Copy        | Click "Copy Markdown"     | Write to clipboard; swap button label 2s                |
| Download    | Click "Download .md"      | Browser download; swap button label 2s                  |
| Try example | Click example CTA         | Fill input + generate + scroll to output                |
| Start over  | Click link                | Clear all; scroll to top; focus input                   |

Scroll behavior: if output renders below the viewport, smooth-scroll so the top of the output panel is visible.

# Accessibility Floor

- **Keyboard:** Full tab order — mode toggle → input → generate button → output region → copy → download → start over. Arrow keys within mode toggle.
- **Focus management:** After generation, move focus to output panel (`role="region"` with `aria-label="Generated GTD template"`). After "Start over", return focus to input.
- **Screen reader:** Mode toggle uses `role="tablist"` / `role="tab"` with `aria-selected`. Output announced via `aria-live="polite"` region. Button state changes ("Copied ✓") announced.
- **Motion:** Respect `prefers-reduced-motion` — disable fade-in animation.
- **Contrast:** All text meets WCAG 2.1 AA (4.5:1 body, 3:1 large text). Visual specs in DESIGN.md.
- **Touch targets:** Minimum 44×44px for all interactive elements.

# Key Flows

## Flow 1: Thabo breaks down his big goal

Thabo, 28, freelance designer, opens Archer on his phone during a commute. He's been saying "I want to get fit" for months but never starts.

1. Lands on page — sees "Type a goal. Get the next actions." and a big input field. Mode is already on "Goal".
2. Types: "Get consistently fit and healthy in 3 months"
3. Taps "Break it down"
4. **Climax:** Output appears — a full structured template with his goal framed inside: success criteria checkboxes, capability table, resource table, outcome-based projects, micro next actions starting with "Open phone calendar" and "Block 20 minutes tomorrow morning". He feels the path materialize.
5. Taps "Copy Markdown"
6. Sees "Copied ✓" — opens Notion, pastes. Headings, tables, checkboxes render perfectly.
7. Closes Archer. Total time: ~25 seconds.

## Flow 2: Naledi scaffolds a project fast

Naledi, 34, product manager, uses GTD daily but hates manually writing the template structure for every new project.

1. Opens Archer on desktop. Clicks "Project" in the mode toggle.
2. Types: "Q3 product roadmap published and approved by stakeholders"
3. Presses Enter
4. Output: purpose, successful outcome, ordered micro next actions — "Open Google Docs", "Create new document", "Type 'Q3 Roadmap Draft'"…
5. Clicks "Download .md" — file saves.
6. Drags .md into Notion import. Done in 20 seconds.

## Flow 3: First-time visitor uses the example

Kgosi, 22, student, lands on Archer from a tweet. Not sure what it does.

1. Sees the clean page. Reads "Type a goal. Get the next actions."
2. Notices "Try an example" below the input.
3. Clicks it — input fills with "Become a proficient guitarist in 3 months" and output instantly appears.
4. Scrolls through — sees the structure, the micro actions ("Open YouTube", "Search 'beginner guitar lesson 1'", "Watch first 5 minutes").
5. Gets it. Clears, types his own goal. Generates. Copies. Gone.

# GTD Template Integrity

This section is specific to Archer's core value proposition.

The generated templates MUST adhere to David Allen's GTD methodology as encoded in the source prompts:

- Projects are outcome-based (describe a finished result, not an activity)
- Next actions begin with a physical verb
- Next actions are visible, concrete, and immediately executable
- Actions follow the principle of least effort (smallest possible step)
- First action should feel "almost impossible NOT to do"

Template quality is the product. If the generated text doesn't pass these rules, the UX has failed regardless of visual polish.

# Responsive & Platform

| Breakpoint          | Behavior                                                                          |
| ------------------- | --------------------------------------------------------------------------------- |
| < 640px (mobile)    | Full-width content, 16px padding, stacked action buttons, touch-optimized targets |
| 640–1024px (tablet) | Centered content max-640px, comfortable reading width                             |
| > 1024px (desktop)  | Same as tablet — no need for wider; prose-optimized width maintained              |

The app is intentionally narrow. Wider screens just get more whitespace. This keeps output scannable and mirrors the single-column Notion experience where the markdown will ultimately live.

No platform-specific behavior — pure web, progressive enhancement from HTML + CSS. JavaScript enhances (copy to clipboard, download trigger) but core output is rendered HTML.
