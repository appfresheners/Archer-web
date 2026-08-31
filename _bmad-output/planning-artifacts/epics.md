---
stepsCompleted:
  [
    "step-01-validate-prerequisites",
    "step-02-design-epics",
    "step-03-create-stories",
    "step-04-final-validation",
  ]
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-GTDGoalandProjectCreator-2026-08-20/prd.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-GTDGoalandProjectCreator-2026-08-20/ARCHITECTURE-SPINE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-GTDGoalandProjectCreator-2026-08-20/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-GTDGoalandProjectCreator-2026-08-20/EXPERIENCE.md"
extensionInputDocuments:
  - "_bmad-output/brainstorming/brainstorm-archer-features-2026-08-31/.memlog.md"
  - "archer/app/api/generate/route.ts"
  - "archer/app/page.tsx"
epicsAddedPostMvp:
  - "Epic 4: Local-First Goal Persistence & Portability"
  - "Epic 5: Output Control & Motivational Framing"
---

# Archer - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Archer (GTDGoalandProjectCreator), decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: The app SHALL provide two modes: Goal Mode and Project Mode, selectable via a segmented toggle control.
FR2: Goal Mode SHALL be the default active mode on page load.
FR3: Switching modes SHALL clear any existing input text and generated output.
FR4: Each mode SHALL present a single text input field with mode-specific placeholder text (Goal: "e.g., Become a proficient guitarist in 3 months"; Project: "e.g., Personal portfolio website deployed online").
FR5: The input SHALL accept free-text entry with no character limit.
FR6: Submitting empty or whitespace-only input SHALL be blocked with inline validation ("Enter a goal or project first").
FR7: The user SHALL be able to submit via pressing Enter or clicking the Generate button.
FR8: On valid submission in Goal Mode, the app SHALL generate a structured markdown template containing: 3-Month Goal definition, Success criteria checklist, Capability analysis table, Resource analysis table, GTD outcome-based projects, Micro next actions per project.
FR9: On valid submission in Project Mode, the app SHALL generate a structured markdown template containing: Project purpose, Successful outcome description, Complete set of micro next actions.
FR10: All generated templates SHALL follow GTD methodology (outcome-based projects, physical verb actions, principle of least effort).
FR11: Generation SHALL be synchronous client-side string interpolation (no network requests, no loading state).
FR12: The user's input text SHALL be inserted into the template at the appropriate structural location.
FR13: Generated output SHALL render as formatted HTML (not raw markdown) within an output panel.
FR14: The output panel SHALL be hidden until first generation and appear with a subtle fade-in (respecting prefers-reduced-motion).
FR15: After generation, the viewport SHALL smooth-scroll so the top of the output panel is visible.
FR16: A "Copy Markdown" button SHALL write raw markdown to clipboard, with "Copied ✓" confirmation (2s) and fallback on failure.
FR17: A "Download .md" button SHALL trigger browser download with filename format archer-{mode}-{slug}.md, with "Downloaded ✓" confirmation (2s).
FR18: A "Try an example" control SHALL pre-fill input with a curated example for the current mode and auto-trigger generation.
FR19: A "Start over" control SHALL clear input and output, scroll to top, and return focus to the input field.
FR20: All generated markdown SHALL be Notion-optimized (# headings, - [ ] checkboxes, | pipe | tables, clean line spacing).

### NonFunctional Requirements

NFR1: The app SHALL achieve Lighthouse performance score ≥ 95 on mobile. LCP < 1.5s, FID < 100ms, CLS < 0.1.
NFR2: The app SHALL be deployable as a fully static site with no server-side runtime. Zero operational cost.
NFR3: The app SHALL be fully functional across mobile (< 640px), tablet (640–1024px), and desktop (> 1024px) viewports.
NFR4: The app SHALL meet WCAG 2.1 Level AA (keyboard nav, ARIA, 44×44px targets, 4.5:1 contrast, prefers-reduced-motion).
NFR5: The app SHALL work in latest two versions of Chrome, Firefox, Safari, and Edge.
NFR6: The app SHALL not use cookies, analytics, tracking, or any data collection. No network requests after page load.
NFR7: Total JavaScript bundle SHALL be < 100KB gzipped.

### Additional Requirements

- AR1: Project uses Next.js 14+ App Router with static export (`output: 'export'` in next.config.js)
- AR2: Single route architecture — all UI in `app/page.tsx` with `'use client'` directive
- AR3: Template generation implemented as pure TypeScript functions in `lib/templates/` — deterministic, side-effect-free, unit-testable
- AR4: Browser APIs (clipboard, download, scroll) isolated in `lib/utils/` — components never call raw APIs directly
- AR5: Tailwind CSS utility-first styling with design tokens extended in `tailwind.config.ts`
- AR6: No state management libraries — React `useState` co-located in page component
- AR7: Deployment to Vercel free tier serving static `out/` directory
- AR8: Seed structure defines component boundaries: ModeToggle, InputSection, OutputPanel, ActionBar, ExampleButton

### UX Design Requirements

UX-DR1: Implement Inter font family (400/700 weights) with major-third type scale (1.25 ratio) — hero 2.441rem, section 1.953rem, subheading 1.563rem, body 1rem, caption 0.8rem.
UX-DR2: Implement color system as Tailwind config extensions — primary blue-600 (#2563EB), secondary emerald-500 (#10B981), surface gray-50, border gray-200, text-primary gray-900, text-secondary gray-500, focus-ring with 25% opacity.
UX-DR3: Implement ModeToggle component — pill-shaped segmented control with active/inactive states, keyboard arrow navigation, ARIA tablist/tab roles with aria-selected, screen reader announcement on mode change.
UX-DR4: Implement text input component — large hit target, mode-specific placeholder, focus state (primary border + soft ring), submit-on-Enter support.
UX-DR5: Implement Generate button — full-width primary style, disabled state when input empty (visually muted + aria-disabled), activation on click and Enter.
UX-DR6: Implement OutputPanel component — card container with border (no shadow), subtle fade-in entrance animation, role="region" with aria-label, focus moved to panel after generation.
UX-DR7: Implement ActionBar — "Copy Markdown" primary button + "Download .md" secondary outline button, confirmation state swap (text + emerald color) for 2 seconds, aria-live announcement of state changes.
UX-DR8: Implement responsive layout — single-column centered, max-width 640px, mobile 16px padding, desktop 64px breathing room, 64px section vertical rhythm.
UX-DR9: Implement focus management — full tab order (toggle → input → button → output → copy → download → start over), focus moved to output after generation, focus returned to input after "Start over".
UX-DR10: Implement motion preferences — all animations (fade-in, scroll) respect prefers-reduced-motion media query.
UX-DR11: Implement touch targets — all interactive elements minimum 44×44px on mobile.
UX-DR12: Implement "Try an example" control — ghost/text-link style, pre-fills and auto-generates, curated examples per mode.

### FR Coverage Map

| FR   | Epic   | Description                          |
| ---- | ------ | ------------------------------------ |
| FR1  | Epic 1 | Two modes via segmented toggle       |
| FR2  | Epic 1 | Goal Mode default                    |
| FR3  | Epic 1 | Mode switch clears state             |
| FR4  | Epic 1 | Mode-specific placeholder text       |
| FR5  | Epic 1 | No character limit                   |
| FR6  | Epic 1 | Empty input validation               |
| FR7  | Epic 1 | Submit via Enter or button           |
| FR8  | Epic 2 | Goal Mode template generation        |
| FR9  | Epic 2 | Project Mode template generation     |
| FR10 | Epic 2 | GTD methodology compliance           |
| FR11 | Epic 2 | Synchronous client-side generation   |
| FR12 | Epic 2 | User input inserted into template    |
| FR13 | Epic 2 | Output rendered as formatted HTML    |
| FR14 | Epic 2 | Output panel fade-in animation       |
| FR15 | Epic 2 | Smooth-scroll to output              |
| FR16 | Epic 3 | Copy Markdown to clipboard           |
| FR17 | Epic 3 | Download .md file                    |
| FR18 | Epic 3 | Try an example (pre-fill + generate) |
| FR19 | Epic 3 | Start over (clear + reset focus)     |
| FR20 | Epic 3 | Notion-optimized markdown format     |

### Post-MVP Functional Requirements (Epics 4–5)

Derived from the 2026-08-31 feature brainstorm (`_bmad-output/brainstorming/brainstorm-archer-features-2026-08-31/.memlog.md`) and the current implemented codebase (AI-backed `/api/generate`, `useState`-only client, no persistence layer). These extend, and do not replace, FR1–FR20.

**Epic 4 — Local-First Goal Persistence & Portability**

FR21: The app SHALL persist each generated breakdown (input text, mode, generation options, output markdown, timestamp) to an in-browser local vault, with no server-side storage.
FR22: The vault SHALL be encrypted at rest in the browser using a passphrase-derived key, so that raw goal content is not stored in plaintext.
FR23: The user SHALL be able to view a list of their saved breakdowns (most recent first) and re-open any entry to restore its full output.
FR24: The user SHALL be able to delete individual saved breakdowns and clear the entire vault.
FR25: The user SHALL be able to export the entire vault as a single downloadable file that they own.
FR26: The user SHALL be able to import a previously exported vault file, merging or restoring its entries.
FR27: The app SHALL support a passwordless "portable identity" — a saved link and/or QR code that encodes the key material needed to unlock the vault, enabling access from another device without any account or server.
FR28: WHEN a portable-identity link or QR code is used to open the app, THE app SHALL reconstruct access to the vault without requiring a password prompt.
FR29: The app SHALL clearly warn the user that portable-identity links/QR codes grant vault access and SHOULD be stored securely.

**Epic 5 — Output Control & Motivational Framing**

FR30: The app SHALL provide a depth control allowing the user to choose how detailed the generated breakdown is, ranging from a quick short-form breakdown to an exhaustive full breakdown.
FR31: The selected depth SHALL be passed to the generation request and SHALL measurably change the amount of generated content (e.g., number of next actions / sections).
FR32: The app SHALL provide a "GTD strictness" toggle that, when enabled, enforces GTD-purity constraints on the output — next actions begin with physical verbs and project/outcome titles describe finished results rather than activities.
FR33: WHEN GTD strictness is enabled, THE generation request SHALL instruct the model to reject or rewrite non-conforming actions and titles.
FR34: The app SHALL provide a "Why this matters" motivational framing layer rendered at the top of each generated output, connecting the goal/project to its deeper purpose and payoff.
FR35: The user SHALL be able to toggle the "Why this matters" framing on or off, and the setting SHALL be reflected in the generated output.
FR36: Generation options (depth, strictness, framing) SHALL have sensible defaults so a user who ignores them still gets a valid breakdown, preserving the zero-friction one-input-one-button flow.
FR37: Generation options SHALL be persisted with each saved breakdown (see FR21) so re-opening an entry preserves the options used to create it.

### Post-MVP NFRs

NFR8: All persistence, encryption, export/import, and portable-identity features SHALL operate entirely client-side with no new server-side data storage, preserving Archer's no-account, no-tracking commitment.
NFR9: Vault encryption SHALL use a standard, well-reviewed browser primitive (Web Crypto API) rather than a custom cryptographic scheme.
NFR10: Generation-option controls SHALL meet the same WCAG 2.1 AA bar as existing controls (keyboard nav, ARIA, 44×44px targets, contrast, prefers-reduced-motion).

### FR Coverage Map (Epics 4–5)

| FR   | Epic   | Description                                     |
| ---- | ------ | ----------------------------------------------- |
| FR21 | Epic 4 | Persist breakdowns to local vault               |
| FR22 | Epic 4 | Encrypt vault at rest (passphrase-derived key)  |
| FR23 | Epic 4 | List and re-open saved breakdowns               |
| FR24 | Epic 4 | Delete entries / clear vault                    |
| FR25 | Epic 4 | Export vault as a single owned file             |
| FR26 | Epic 4 | Import previously exported vault                |
| FR27 | Epic 4 | Portable identity via saved link / QR           |
| FR28 | Epic 4 | Passwordless unlock from portable identity      |
| FR29 | Epic 4 | Security warning for portable-identity sharing  |
| FR30 | Epic 5 | Depth control (quick ↔ exhaustive)              |
| FR31 | Epic 5 | Depth passed to generation, changes output size |
| FR32 | Epic 5 | GTD strictness toggle                           |
| FR33 | Epic 5 | Strictness enforced in generation request       |
| FR34 | Epic 5 | "Why this matters" framing atop output          |
| FR35 | Epic 5 | Toggle framing on/off                           |
| FR36 | Epic 5 | Sensible option defaults preserve zero-friction |
| FR37 | Epic 5 | Options persisted with saved breakdown          |

## Epic List

### Epic 1: Project Foundation & Core UI Shell

Users can see a polished, accessible landing page with mode selection and input — the app feels real and interactive even before generation works.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7
**NFRs covered:** NFR1, NFR2, NFR3, NFR4, NFR5, NFR7
**ARs covered:** AR1, AR2, AR5, AR6, AR8
**UX-DRs covered:** UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR5, UX-DR8, UX-DR9, UX-DR10, UX-DR11

### Epic 2: Template Generation & Output Display

Users can type a goal or project and instantly see a structured GTD breakdown rendered beautifully on screen.
**FRs covered:** FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15
**ARs covered:** AR3, AR4
**UX-DRs covered:** UX-DR6

### Epic 3: Export Actions & Polish

Users can copy their GTD breakdown as Notion-optimized markdown or download it as a file, plus try examples and reset — the complete user flow.
**FRs covered:** FR16, FR17, FR18, FR19, FR20
**NFRs covered:** NFR6
**ARs covered:** AR4
**UX-DRs covered:** UX-DR7, UX-DR12

### Epic 4: Local-First Goal Persistence & Portability

Users can keep every breakdown they generate, encrypted in their own browser, revisit past goals, and carry their vault to another device — all with no account, no server, and no tracking.
**FRs covered:** FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR29
**NFRs covered:** NFR8, NFR9, NFR10

### Epic 5: Output Control & Motivational Framing

Users can shape the generated breakdown — how deep it goes, how strictly it follows GTD, and whether it opens with a motivational "why this matters" — without losing the zero-friction default flow.
**FRs covered:** FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37
**NFRs covered:** NFR10

## Epic 1: Project Foundation & Core UI Shell

Users can see a polished, accessible landing page with mode selection and input — the app feels real and interactive even before generation works.

### Story 1.1: Next.js Project Scaffold with Design Tokens

As a developer,
I want a working Next.js project with Tailwind configured and Archer's design tokens in place,
So that all subsequent UI work builds on a consistent, deployable foundation.

**Acceptance Criteria:**

**Given** a fresh project setup
**When** `npm run build` executes
**Then** a static `out/` directory is produced with no errors
**And** Tailwind config extends with Archer color palette (primary #2563EB, secondary #10B981, surface, border, text tiers)
**And** Inter font is loaded (400/700 weights)
**And** Typography scale (major-third 1.25) is configured
**And** Spacing tokens (page-x, page-x-lg, section-y) are defined
**And** The page renders a centered single-column layout (max-width 640px)
**And** Responsive padding applies (16px mobile, 64px desktop)
**And** The project deploys successfully to Vercel as a static site

### Story 1.2: Mode Toggle Component

As a user,
I want to switch between Goal and Project modes,
So that I can choose the right template type for my needs.

**Acceptance Criteria:**

**Given** the page has loaded
**When** I view the mode toggle
**Then** it displays as a pill-shaped segmented control with "Goal" and "Project" options
**And** "Goal" is active by default (primary color fill, white text)
**And** "Project" shows inactive state (surface background, muted text)

**Given** I click/tap the "Project" segment
**When** the mode switches
**Then** "Project" becomes active and "Goal" becomes inactive
**And** any existing input text is cleared
**And** the mode change is announced to screen readers

**Given** I focus the toggle with keyboard
**When** I press arrow keys
**Then** the active mode cycles between Goal and Project
**And** Enter/Space activates the focused option

**Given** the toggle is inspected for accessibility
**When** a screen reader reads it
**Then** it uses `role="tablist"` / `role="tab"` with `aria-selected`

### Story 1.3: Input Section with Validation

As a user,
I want a text input with helpful placeholder text and clear submission options,
So that I know exactly what to type and how to generate my GTD breakdown.

**Acceptance Criteria:**

**Given** Goal mode is active
**When** I view the input field
**Then** placeholder text reads "e.g., Become a proficient guitarist in 3 months"

**Given** Project mode is active
**When** I view the input field
**Then** placeholder text reads "e.g., Personal portfolio website deployed online"

**Given** the input is empty
**When** I view the Generate button
**Then** it appears visually muted/disabled with `aria-disabled="true"`

**Given** I have typed text in the input
**When** I view the Generate button
**Then** it appears as a full-width primary blue button, enabled

**Given** the input is empty or whitespace-only
**When** I click the Generate button or press Enter
**Then** inline validation appears: "Enter a goal or project first"
**And** no generation occurs

**Given** I have typed valid text
**When** I press Enter
**Then** the form submits (same as clicking the button)

**Given** the input field receives focus
**When** I inspect the styling
**Then** a primary-colored border and soft focus ring appear

**Given** any interactive element on the page
**When** measured on mobile
**Then** touch target is minimum 44×44px

### Story 1.4: Page Layout, Accessibility & Deployment Verification

As a user,
I want the page to load fast, look polished on any device, and be fully keyboard-navigable,
So that I can use Archer regardless of device, connection speed, or assistive technology.

**Acceptance Criteria:**

**Given** the deployed site
**When** tested with Lighthouse on mobile
**Then** performance score is ≥ 95, LCP < 1.5s, CLS < 0.1

**Given** a mobile viewport (< 640px)
**When** I view the page
**Then** content fills full width with 16px padding, all elements are stacked

**Given** a desktop viewport (> 1024px)
**When** I view the page
**Then** content is centered at max-width 640px with generous whitespace

**Given** I use only keyboard navigation
**When** I tab through the page
**Then** focus order is: mode toggle → input → generate button
**And** focus indicators are clearly visible

**Given** `prefers-reduced-motion` is enabled
**When** any animation would normally play
**Then** it is suppressed

**Given** body text is inspected
**When** contrast ratio is measured
**Then** it meets 4.5:1 minimum (WCAG AA)

**Given** the JavaScript bundle
**When** measured gzipped
**Then** it is < 100KB

## Epic 2: Template Generation & Output Display

Users can type a goal or project and instantly see a structured GTD breakdown rendered beautifully on screen.

### Story 2.1: Goal Mode Template Engine

As a user,
I want to type my goal and get a full GTD breakdown structure,
So that I can see my big ambition transformed into actionable projects and next actions.

**Acceptance Criteria:**

**Given** Goal mode is active and I have typed a goal (e.g., "Become a proficient guitarist in 3 months")
**When** I submit the input
**Then** a markdown string is generated containing:

- A "3-Month Goal" heading with my input text inserted
- A "Success Criteria" section with checkbox placeholders
- A "Capability Analysis" section with a table (skill × rating columns)
- A "Resource Analysis" section with a table (resource × rating columns)
- GTD outcome-based project sections (each with Purpose + Successful Outcome)
- Micro next actions per project (beginning with physical verbs)

**And** the generation is synchronous with no network requests
**And** the template function is a pure TypeScript function in `lib/templates/goal-template.ts`
**And** projects are outcome-based (describe a finished result, not an activity)
**And** next actions follow the principle of least effort (smallest possible step)
**And** the first action per project feels "almost impossible NOT to do"

### Story 2.2: Project Mode Template Engine

As a user,
I want to type my project name and get a GTD project scaffold,
So that I can immediately see the purpose, outcome, and next physical actions for my project.

**Acceptance Criteria:**

**Given** Project mode is active and I have typed a project (e.g., "Personal portfolio website deployed online")
**When** I submit the input
**Then** a markdown string is generated containing:

- A project heading with my input text inserted
- A "Purpose" section describing why this project matters
- A "Successful Outcome" section describing what "done" looks like
- An ordered list of micro next actions (physical verbs, immediately executable)

**And** the generation is synchronous with no network requests
**And** the template function is a pure TypeScript function in `lib/templates/project-template.ts`
**And** next actions begin with physical verbs and are visible/concrete
**And** actions follow logical order with progressive difficulty

### Story 2.3: Output Panel Rendering

As a user,
I want to see my generated GTD breakdown displayed as nicely formatted content,
So that I can read and review the structure before copying or downloading it.

**Acceptance Criteria:**

**Given** a template has been generated
**When** the output panel appears
**Then** the raw markdown is rendered as formatted HTML (headings, tables, checkboxes render visually)
**And** the panel uses a card container with border (no shadow)
**And** the panel appears with a subtle fade-in animation
**And** if `prefers-reduced-motion` is enabled, the fade-in is suppressed

**Given** the output panel has appeared
**When** I inspect accessibility
**Then** the panel has `role="region"` with `aria-label="Generated GTD template"`
**And** focus is programmatically moved to the output panel

**Given** the output renders below the current viewport
**When** generation completes
**Then** the page smooth-scrolls so the top of the output panel is visible

**Given** the output panel is visible
**When** I view it on mobile (< 640px)
**Then** it fills the available width with appropriate padding and remains readable

## Epic 3: Export Actions & Polish

Users can copy their GTD breakdown as Notion-optimized markdown or download it as a file, plus try examples and reset — the complete user flow.

### Story 3.1: Copy Markdown to Clipboard

As a user,
I want to copy my generated GTD breakdown as raw markdown with one click,
So that I can paste it directly into Notion and have it render perfectly.

**Acceptance Criteria:**

**Given** output has been generated and is visible
**When** I click "Copy Markdown"
**Then** the raw markdown string (not HTML) is written to the system clipboard
**And** the button text changes to "Copied ✓" with emerald color
**And** after 2 seconds the button resets to "Copy Markdown"
**And** the state change is announced to screen readers via aria-live

**Given** the browser denies clipboard permissions
**When** I click "Copy Markdown"
**Then** a fallback textarea modal appears with the full markdown pre-selected
**And** I can manually copy the content

**Given** the copied markdown
**When** pasted into Notion
**Then** all headings (`#`, `##`, `###`) render as Notion headings
**And** all checkboxes (`- [ ]`) render as Notion to-do blocks
**And** all pipe tables render as Notion tables
**And** line spacing creates proper block separation

### Story 3.2: Download as Markdown File

As a user,
I want to download my GTD breakdown as a `.md` file,
So that I can import it into Notion or store it for later use.

**Acceptance Criteria:**

**Given** output has been generated and is visible
**When** I click "Download .md"
**Then** the browser triggers a file download
**And** the filename follows the format `archer-goal-{sanitized-slug}.md` (Goal mode) or `archer-project-{sanitized-slug}.md` (Project mode)
**And** the slug is derived from the user's input text (lowercase, hyphens, no special chars)
**And** the button text changes to "Downloaded ✓" for 2 seconds, then resets

**Given** the download utility in `lib/utils/download.ts`
**When** inspected
**Then** it constructs a Blob, creates an object URL, triggers via anchor click, and revokes the URL
**And** no network requests are made (NFR6 compliance)

### Story 3.3: Try an Example

As a first-time visitor,
I want to see a working example with one click,
So that I can understand what Archer does before typing my own goal.

**Acceptance Criteria:**

**Given** I am in Goal mode and no output is visible
**When** I click "Try an example"
**Then** the input is filled with "Become a proficient guitarist in 3 months"
**And** generation is auto-triggered
**And** the output panel appears with the full Goal Mode template
**And** the viewport scrolls to the output

**Given** I am in Project mode
**When** I click "Try an example"
**Then** the input is filled with "Personal portfolio website deployed online"
**And** generation is auto-triggered with the Project Mode template

**Given** the "Try an example" control
**When** inspected visually
**Then** it appears as a subtle ghost/text-link style (not a primary button)
**And** it meets the 44×44px minimum touch target on mobile

### Story 3.4: Start Over

As a user,
I want to clear everything and begin fresh,
So that I can quickly generate another breakdown without refreshing the page.

**Acceptance Criteria:**

**Given** output is currently visible
**When** I click "Start over"
**Then** the input field is cleared
**And** the output panel is hidden
**And** the page scrolls to the top
**And** focus is returned to the input field

**Given** the page is in the Empty state after reset
**When** I inspect the UI
**Then** it is identical to the initial page load state (correct mode still active, placeholder visible, button disabled)

### Story 3.5: Notion-Optimized Markdown Quality

As a user,
I want my generated markdown to be perfectly structured for Notion,
So that every element renders correctly when I paste or import.

**Acceptance Criteria:**

**Given** a Goal Mode generation
**When** the raw markdown is inspected
**Then** headings use `#` syntax (not underline style)
**And** checkboxes use `- [ ]` format (space after dash, space inside brackets)
**And** tables use pipe `|` syntax with header separator row
**And** there is a blank line between each block element (heading, paragraph, list, table)
**And** no trailing whitespace or extra newlines that would create empty Notion blocks

**Given** a Project Mode generation
**When** the raw markdown is inspected
**Then** the same formatting rules apply
**And** the ordered action list uses `- [ ]` checkboxes (not numbered list) for Notion compatibility

**Given** the Action Bar buttons
**When** rendered on mobile (< 640px)
**Then** buttons stack vertically with full width
**And** "Copy Markdown" appears first (primary), "Download .md" second (secondary outline)

## Epic 4: Local-First Goal Persistence & Portability

Users can keep every breakdown they generate, encrypted in their own browser, revisit past goals, and carry their vault to another device — all with no account, no server, and no tracking.

**Context:** Archer currently holds no state between sessions — `page.tsx` uses `useState` only, and a refresh loses everything. This epic introduces the first persistence layer, deliberately local-first and encrypted, to honor the no-account / no-tracking commitment (NFR8) while unlocking a memory the product has never had. Encryption uses the browser-native Web Crypto API (NFR9); no third-party crypto libraries and no server storage.

### Story 4.1: Local Vault Storage Layer

As a user,
I want the breakdowns I generate to be saved in my browser,
So that I don't lose my work when I close the tab or refresh.

**Acceptance Criteria:**

**Given** I have generated a breakdown
**When** generation completes successfully
**Then** an entry is written to a local vault containing the input text, mode, generation options, output markdown, and a creation timestamp
**And** the write happens entirely client-side with no network request to any Archer-owned server (NFR8)

**Given** the vault storage module in `lib/vault/`
**When** inspected
**Then** it exposes pure, testable functions for create / read / list / delete
**And** persistence uses browser storage (localStorage or IndexedDB) with a versioned schema
**And** the module is isolated from React components (consistent with AR4/AR6 layering)

**Given** the browser storage is unavailable or full
**When** a save is attempted
**Then** the failure is handled gracefully with a user-visible message
**And** the current generated output remains usable (save failure never destroys the on-screen result)

### Story 4.2: Vault Encryption at Rest

As a privacy-conscious user,
I want my saved goals encrypted in the browser,
So that my personal ambitions aren't sitting in plaintext on the device.

**Acceptance Criteria:**

**Given** the vault stores an entry
**When** the stored data is inspected in browser dev tools
**Then** the goal/project content and output markdown are encrypted (not human-readable plaintext) (FR22)

**Given** encryption is required
**When** a key is derived
**Then** it is derived from a user passphrase using the Web Crypto API (e.g., PBKDF2/AES-GCM) with a per-vault random salt (NFR9)
**And** no custom or hand-rolled cryptographic scheme is used

**Given** an incorrect passphrase
**When** the user attempts to unlock the vault
**Then** decryption fails cleanly with a clear "couldn't unlock" message and no partial/garbage data is shown

**Given** encryption/decryption logic in `lib/vault/`
**When** inspected
**Then** encrypt and decrypt are covered by unit tests including a round-trip property (decrypt(encrypt(x)) === x) and a wrong-key failure case

### Story 4.3: Saved Breakdowns List & Restore

As a returning user,
I want to see my past breakdowns and re-open any of them,
So that I can pick up a goal I started earlier.

**Acceptance Criteria:**

**Given** I have one or more saved breakdowns
**When** I open the saved-breakdowns view
**Then** entries are listed most-recent-first showing at least the input text, mode, and timestamp (FR23)

**Given** I select a saved entry
**When** it opens
**Then** the full output markdown is restored to the output panel exactly as originally generated
**And** the generation options used to create it are restored (FR37)

**Given** a saved entry
**When** I choose to delete it
**Then** that single entry is removed from the vault (FR24)
**And** the list updates without a full page reload

**Given** I choose to clear the entire vault
**When** I confirm the destructive action
**Then** all entries are removed after an explicit confirmation step
**And** the confirmation clearly states the action cannot be undone

**Given** the saved-breakdowns UI
**When** measured for accessibility
**Then** it meets WCAG 2.1 AA (keyboard nav, ARIA, 44×44px targets, contrast) (NFR10)

### Story 4.4: Vault Export & Import

As a user who owns their data,
I want to export my vault to a file and import it back,
So that I control my own goal history and can back it up or move it.

**Acceptance Criteria:**

**Given** I have a populated vault
**When** I click "Export vault"
**Then** the browser downloads a single file containing the full (encrypted) vault (FR25)
**And** the download uses the existing client-side download utility pattern (no server round-trip)

**Given** a previously exported vault file
**When** I import it
**Then** its entries are restored into the local vault (FR26)
**And** the user is told whether entries were merged with or replaced the current vault
**And** an invalid or corrupt file is rejected with a clear error and no partial import

**Given** export/import logic
**When** inspected
**Then** it is covered by tests including an export→import round-trip that preserves all entries

### Story 4.5: Portable Passwordless Identity (Link + QR)

As a user with more than one device,
I want a saved link or QR code that unlocks my vault elsewhere,
So that I can access my goals on another device without creating an account.

**Acceptance Criteria:**

**Given** I have an encrypted vault
**When** I generate a portable identity
**Then** the app produces a saveable link and a QR code that encode the key material needed to unlock the vault (FR27)
**And** no account, password prompt, or server-side record is created (FR28, NFR8)

**Given** a portable-identity link or QR code
**When** I open Archer with it on another device (with the vault file present/imported)
**Then** the vault is unlocked without a manual passphrase prompt (FR28)

**Given** I am about to generate or copy a portable identity
**When** the control is shown
**Then** a clear security warning states that anyone with the link/QR can unlock the vault and it should be stored securely (FR29)

**Given** the portable-identity encoding
**When** inspected
**Then** key material is carried in a way that is not sent to any Archer-owned server (e.g., URL fragment / locally rendered QR), and this is verified by test or documented threat note

---

## Epic 5: Output Control & Motivational Framing

Users can shape the generated breakdown — how deep it goes, how strictly it follows GTD, and whether it opens with a motivational "why this matters" — without losing the zero-friction default flow.

**Context:** Generation today is a POST to `/api/generate` with `{ input, mode }`, selecting one of two hardcoded system prompts (`GOAL_SYSTEM_PROMPT`, `PROJECT_SYSTEM_PROMPT`). This epic threads three new options through that request and adapts the prompt accordingly. The guiding constraint (FR36): defaults must keep the one-input-one-button experience intact — the controls are progressive, never mandatory. These options also feed the Epic 4 vault (FR37), so the two epics share the generation-options data shape.

### Story 5.1: Generation Options Data Contract & Request Plumbing

As a developer,
I want a single well-defined options object flowing from the UI through the API to prompt selection,
So that depth, strictness, and framing are handled consistently and can be persisted with saved breakdowns.

**Acceptance Criteria:**

**Given** the generate request
**When** the client submits
**Then** the request body carries an `options` object alongside `input` and `mode`, with fields for depth, strictness, and framing (FR30, FR32, FR34)
**And** the `/api/generate` route validates the options and falls back to defaults for any missing/invalid field (FR36)

**Given** no options are supplied (legacy/simple flow)
**When** generation runs
**Then** the app behaves exactly as today with sensible defaults, preserving the zero-friction path (FR36)

**Given** the options shape
**When** defined
**Then** it is a shared TypeScript type reused by the client, the API route, and the Epic 4 vault entry (FR37)

### Story 5.2: Depth Control (Quick ↔ Exhaustive)

As a user,
I want to choose how detailed my breakdown is,
So that I can get a quick starter or a comprehensive plan depending on my needs.

**Acceptance Criteria:**

**Given** the input area
**When** I view the controls
**Then** a depth control lets me choose along a range from quick (short-form) to exhaustive (full breakdown) (FR30)
**And** the default depth reproduces the current output length so existing behavior is unchanged (FR36)

**Given** I select a "quick" depth and generate
**When** the output returns
**Then** it contains measurably less content (e.g., fewer next actions / condensed sections) than the exhaustive depth for the same input (FR31)

**Given** I select "exhaustive" depth and generate
**When** the output returns
**Then** it contains the full detailed breakdown

**Given** the depth control
**When** measured for accessibility
**Then** it meets WCAG 2.1 AA (keyboard operable, labeled, 44×44px target, prefers-reduced-motion respected) (NFR10)

### Story 5.3: GTD Strictness Toggle

As a GTD practitioner,
I want a strictness toggle that enforces GTD purity,
So that every action is a physical verb and every project title describes a finished outcome.

**Acceptance Criteria:**

**Given** the controls
**When** I view them
**Then** a "GTD strictness" toggle is available and is off by default (preserving current behavior) (FR32, FR36)

**Given** strictness is enabled
**When** I generate
**Then** the generation request instructs the model to enforce GTD purity — actions begin with physical verbs, project/outcome titles describe finished results not activities, and non-conforming items are rewritten or rejected (FR33)

**Given** strictness is enabled and output returns
**When** the next actions are inspected
**Then** each next action begins with a physical verb
**And** project/outcome titles are outcome-based (a finished result, not an activity)

**Given** the strictness toggle
**When** measured for accessibility
**Then** it meets WCAG 2.1 AA (NFR10)

### Story 5.4: "Why This Matters" Motivational Framing

As a user who needs a push to start,
I want a short "why this matters" framing at the top of my breakdown,
So that I'm reconnected to the purpose behind the goal before I see the tasks.

**Acceptance Criteria:**

**Given** the controls
**When** I view them
**Then** a "Why this matters" toggle is available with a sensible default (FR34, FR35)

**Given** the framing is enabled
**When** I generate
**Then** the output opens with a concise motivational framing section that connects the goal/project to its deeper purpose and payoff (FR34)
**And** the framing renders at the top of the output panel above the existing structure

**Given** the framing is disabled
**When** I generate
**Then** no framing section appears and the output matches the non-framed structure (FR35)

**Given** the framing section
**When** the markdown is copied/downloaded
**Then** it is included in the exported markdown and remains Notion-optimized (consistent with FR20)

### Story 5.5: Options Surfaced in UI Without Breaking Zero-Friction Flow

As a first-time user,
I want the new controls to stay out of my way until I want them,
So that Archer still feels like one input and one button.

**Acceptance Criteria:**

**Given** a first-time visitor on page load
**When** they view the input area
**Then** the primary path is still a single input plus Generate, with the options presented as secondary/progressive controls that don't dominate the layout (FR36)

**Given** a user changes any option
**When** they generate
**Then** the chosen options are applied and (when the vault exists) persisted with the saved entry (FR37)

**Given** the option controls across mobile / tablet / desktop
**When** viewed
**Then** they remain usable and accessible at all breakpoints (NFR10, consistent with NFR3)

**Given** the full control set
**When** navigated by keyboard
**Then** tab order is logical and every control has a visible focus indicator and accessible label (NFR10)
