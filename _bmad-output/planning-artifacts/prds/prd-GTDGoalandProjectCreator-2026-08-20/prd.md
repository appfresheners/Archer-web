---
title: "Archer — GTD Goal & Project Creator PRD"
status: final
created: 2026-08-20
updated: 2026-08-20
project: GTDGoalandProjectCreator
---

# Archer — Product Requirements Document

## 1. Overview

Archer is a free, public, single-page web application that transforms a user-supplied goal or project name into a structured GTD (Getting Things Done) breakdown — ready to copy as Notion-optimized markdown or download as a `.md` file.

**Core thesis:** People know what they want to achieve but freeze when figuring out what to do next. Archer removes that friction with zero setup.

**Product type:** Static client-side web app (no backend, no accounts, no AI in MVP1).

## 2. Goals & Success Metrics

| Goal                 | Metric                                                             | Target                  |
| -------------------- | ------------------------------------------------------------------ | ----------------------- |
| Instant utility      | Time from landing to copied markdown                               | < 30 seconds            |
| Notion compatibility | Markdown renders correctly in Notion (headers, checkboxes, tables) | 100% of output elements |
| Performance          | Largest Contentful Paint                                           | < 1.5s on 3G            |
| Accessibility        | WCAG 2.1 AA compliance                                             | Pass                    |
| Zero cost            | Monthly operational cost                                           | $0 (static hosting)     |

**Counter-metrics:** Template quality must not be sacrificed for speed — if the output doesn't follow GTD principles (outcome-based projects, physical next actions), the product has failed regardless of interaction speed.

## 3. Target Users

**Primary:** People who set goals but stall at execution. They may use Notion or similar tools but freeze at the blank page. They don't need motivation — they need the next physical action spelled out.

**Secondary:** GTD practitioners who want quick project scaffolding without manually writing template structure.

No personas section — the UX design contract carries named protagonists (Thabo, Naledi, Kgosi) in its key flows.

## 4. Functional Requirements

### FR-Group: Mode Selection

**FR1:** The app SHALL provide two modes: Goal Mode and Project Mode, selectable via a segmented toggle control.

**FR2:** Goal Mode SHALL be the default active mode on page load.

**FR3:** Switching modes SHALL clear any existing input text and generated output.

### FR-Group: Input

**FR4:** Each mode SHALL present a single text input field with mode-specific placeholder text.

- Goal Mode: "e.g., Become a proficient guitarist in 3 months"
- Project Mode: "e.g., Personal portfolio website deployed online"

**FR5:** The input SHALL accept free-text entry with no character limit. [ASSUMPTION: No limit in MVP1]

**FR6:** Submitting empty or whitespace-only input SHALL be blocked with inline validation ("Enter a goal or project first").

**FR7:** The user SHALL be able to submit via pressing Enter or clicking the Generate button.

### FR-Group: Template Generation

**FR8:** On valid submission in Goal Mode, the app SHALL generate a structured markdown template containing:

1. 3-Month Goal definition (user's text inserted)
2. Success criteria (checklist placeholders)
3. Capability analysis (table with placeholder rows)
4. Resource analysis (table with placeholder rows)
5. GTD outcome-based projects (placeholder project names with purpose + successful outcome)
6. Micro next actions per project (placeholder actions following GTD rules)

**FR9:** On valid submission in Project Mode, the app SHALL generate a structured markdown template containing:

1. Project purpose (framed around user's text)
2. Successful outcome description
3. Complete set of micro next actions (ordered, placeholder physical verbs)

**FR10:** All generated templates SHALL follow GTD methodology:

- Projects are outcome-based (describe a finished result)
- Next actions begin with a physical verb
- Next actions are visible, concrete, immediately executable
- Actions follow the principle of least effort

**FR11:** Generation SHALL be synchronous client-side string interpolation (no network requests, no loading state).

**FR12:** The user's input text SHALL be inserted into the template at the appropriate structural location (goal definition heading for Goal Mode, project name for Project Mode).

### FR-Group: Output Display

**FR13:** Generated output SHALL render as formatted HTML (not raw markdown) within an output panel below the input.

**FR14:** The output panel SHALL be hidden until first generation and appear with a subtle fade-in (respecting `prefers-reduced-motion`).

**FR15:** After generation, the viewport SHALL smooth-scroll so the top of the output panel is visible.

### FR-Group: Actions (Copy & Download)

**FR16:** A "Copy Markdown" button SHALL write the raw markdown string to the user's clipboard.

- On success: button text changes to "Copied ✓" (emerald color) for 2 seconds, then resets.
- On failure (permissions denied): fallback to a select-all textarea modal.

**FR17:** A "Download .md" button SHALL trigger a browser download of the markdown content.

- Filename format: `archer-goal-{sanitized-slug}.md` or `archer-project-{sanitized-slug}.md`
- On success: button text changes to "Downloaded ✓" for 2 seconds, then resets.

### FR-Group: Example & Reset

**FR18:** A "Try an example" control SHALL pre-fill the input with a curated example for the current mode and auto-trigger generation.

- Goal example: "Become a proficient guitarist in 3 months"
- Project example: "Personal portfolio website deployed online"

**FR19:** A "Start over" control SHALL clear input and output, scroll to top, and return focus to the input field.

### FR-Group: Markdown Format

**FR20:** All generated markdown SHALL be Notion-optimized:

- `#` / `##` / `###` headings for structure
- `- [ ]` checkboxes for success criteria and action items
- `| pipe |` tables for capability/resource analysis
- Clean line spacing for Notion block separation

## 5. Non-Functional Requirements

**NFR1 — Performance:** The app SHALL achieve a Lighthouse performance score ≥ 95 on mobile. LCP < 1.5s, FID < 100ms, CLS < 0.1.

**NFR2 — Static deployment:** The app SHALL be deployable as a fully static site with no server-side runtime. Zero operational cost.

**NFR3 — Responsiveness:** The app SHALL be fully functional across mobile (< 640px), tablet (640–1024px), and desktop (> 1024px) viewports.

**NFR4 — Accessibility:** The app SHALL meet WCAG 2.1 Level AA:

- Full keyboard navigation
- Screen reader support (ARIA roles, live regions)
- Minimum 44×44px touch targets
- 4.5:1 contrast ratio for body text, 3:1 for large text
- Respect `prefers-reduced-motion`

**NFR5 — Browser support:** The app SHALL work in the latest two versions of Chrome, Firefox, Safari, and Edge. Progressive enhancement from HTML + CSS; JavaScript enhances (clipboard, download).

**NFR6 — Privacy:** The app SHALL not use cookies, analytics, tracking, or any data collection. No network requests after initial page load.

**NFR7 — Bundle size:** Total JavaScript bundle SHALL be < 100KB gzipped. [ASSUMPTION]

## 6. Technical Constraints

| Constraint | Decision                   |
| ---------- | -------------------------- |
| Framework  | Next.js (static export)    |
| Styling    | Tailwind CSS               |
| Hosting    | Vercel (free tier, static) |
| Backend    | None — pure client-side    |
| AI/LLM     | Not in MVP1                |
| Auth       | None                       |
| Database   | None                       |
| Analytics  | None                       |

## 7. Scope — What's Explicitly Out

- User accounts or saved history
- AI/LLM-powered generation (future enhancement)
- Notion API integration
- Analytics or tracking
- Monetization
- Dark mode
- Multiple languages / i18n
- Custom template editing
- Sharing / social features

## 8. Open Questions

None remaining for MVP1 scope.

## 9. Future Vision

If Archer proves the interaction model (goal → structured next actions in 30 seconds), the natural evolution is an AI layer that generates personalized GTD breakdowns — real capability analysis, tailored next actions, context-aware suggestions. The templates become structure; AI fills them with intelligence.
