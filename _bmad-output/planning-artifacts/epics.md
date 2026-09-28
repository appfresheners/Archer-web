---
stepsCompleted:
  - "step-01-validate-prerequisites"
  - "step-02-design-epics"
  - "step-03-create-stories"
  - "step-04-final-validation"
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-GTDGoalandProjectCreator-2026-08-20/prd.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-GTDGoalandProjectCreator-2026-08-20/ARCHITECTURE-SPINE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-GTDGoalandProjectCreator-2026-08-20/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-GTDGoalandProjectCreator-2026-08-20/EXPERIENCE.md"
supersedes: "_bmad-output/planning-artifacts/epics-superseded-mvp1.md"
---

# GTDGoalandProjectCreator (Archer) - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Archer (GTDGoalandProjectCreator), decomposing the requirements from the v1-full PRD, the Architecture Spine, and the UX design contract (DESIGN.md + EXPERIENCE.md) into implementable stories.

> **Note:** This document supersedes `epics-superseded-mvp1.md`, which described the earlier static-export, no-auth, template-only MVP. The current product is a fully authenticated, Supabase-backed, AI-generation system. The superseded architecture decisions (AD-1 to AD-6, AD-20) and old FR1–FR37 numbering do not apply here.

## Requirements Inventory

### Functional Requirements

**Goal Creation Wizard [NOT YET BUILT]**

FR1: Goal creation SHALL use a wizard stepper with four sequential steps: (1) Goal & Skill Framework, (2) Gap Rating, (3) Drivers & Barriers, (4) Review & Generate.
FR2: The wizard stepper SHALL show the current step and how many remain; completed steps SHALL be visually distinguishable from current and upcoming steps.
FR3: The user SHALL be able to navigate back to a previous step to correct inputs; returning does not discard later inputs unless a change invalidates them (e.g. changing goal text regenerates the skill framework).
FR4: Abandoning the wizard midway SHALL NOT create a goal. No auto-save of partial state, no nudge, no recovery flow.
FR5: The goal text input SHALL accept free-text up to 500 characters (UI-enforced), with a 2,000-character server-side safety cap.
FR6: Submitting an empty or whitespace-only goal text SHALL be blocked with inline validation before advancing from Step 1.
FR7: On goal text submission in Step 1, the app SHALL call the AI to propose a skill/attribute framework: skills, habits, and resources with required level ratings (1–10) and goal-specific descriptions.
FR8: The skill framework SHALL be returned before the user can advance to Step 2; a loading state SHALL be shown during this AI call.
FR9: The user SHALL be able to review the proposed framework, remove irrelevant items, and add their own items before advancing to Step 2.
FR10: For each confirmed framework item, the user SHALL rate their current level (1–10); Gap = Required − Current, shown live as the user rates.
FR11: The AI SHALL NOT infer or pre-fill the user's current ratings; all ratings come from the user.
FR12: The user MAY add their own skill/attribute items in Step 2 if they identify a relevant gap not in the framework.
FR13: The user SHALL identify at least one Driver (internal strength) and at least one Barrier (real obstacle) as free-text entries.
FR14: The AI SHALL NOT infer Drivers or Barriers; all Step 3 content is user-entered.
FR15: The user SHALL provide an if–then plan for their primary barrier: "If [situation], then I will [specific alternative action]."
FR16: Step 4 SHALL display a summary of all inputs from steps 1–3 before generation; the user can return to any previous step to correct.
FR17: On confirmation, the app SHALL call the AI generation endpoint with full structured inputs: goal text, confirmed framework with required levels and user ratings, drivers, barriers, and if–then plan.
FR18: The AI SHALL produce a complete Reverse Goal Setting + GTD breakdown containing: (1) 3-Month Goal statement with target date = 3 months from today, (2) Success criteria (3+ measurable items), (3) Target Profile (framework with required levels + descriptions), (4) Current Profile (same items with user ratings + calculated gaps), (5) Drivers/Resources/Barriers verbatim from Step 3, (6) If–then plan verbatim, (7) Priority gaps (2–3) linked by name to projects, (8) 5–6 outcome-named GTD projects as HTML `<details>/<summary>` accordions, each with Purpose (3–4 sentences), Successful Outcome (2–3 sentences), and 12 micro next actions, (9) Monthly Goal Check section.
FR19: The first two projects SHALL be the ones closing Priority 1 and Priority 2 gaps; their names SHALL match exactly the linked project names in the Priority gaps section.
FR20: All AI-generated content SHALL be specific to the user's goal and gap inputs — real tools, websites, resources. Generic filler is a quality failure.
FR21: All generated next actions SHALL follow GTD rules: begin with a physical verb (Open, Navigate, Click, Type, Create, Save, Search, Read, Write, Complete, Download, Install, Watch, Record, Schedule), reference a specific real tool/app/website/location, and be completable in 2–5 minutes.
FR22: The generation request SHALL time out after 30 seconds with a user-facing error and retry option.
FR23: A loading state SHALL be shown during generation: "Generating your GTD breakdown…".
FR24: If generation fails (timeout or provider error), the wizard SHALL remain at Step 4 with the user's inputs intact so they can retry without re-entering anything.

**Project Mode Generation [AUTH REQUIRED — SAVES TO SUPABASE]**

FR25: Project Mode SHALL present a single text input with placeholder: "e.g., Personal portfolio website deployed online".
FR26: The input SHALL accept free-text up to 500 characters (UI-enforced), with a 2,000-character server-side safety cap.
FR27: Submitting empty or whitespace-only input SHALL be blocked with inline validation.
FR28: The user SHALL be able to submit via Enter key or Generate button.
FR29: On valid submission, the app SHALL POST to `/api/generate` and the AI SHALL produce a project breakdown whose structure depends on a user-selected project depth (see FR29a):

- **Minimal** (default): (1) Project name as heading (outcome-based), (2) Purpose (3–4 sentences), (3) Successful Outcome (2–3 sentences), (4) exactly 12 sequenced micro next actions following GTD rules (FR21).
- **Full GTD** (Allen's Natural Planning Model, for complex projects that warrant it): (1) Project name as heading (outcome-based), (2) **Purpose and Principles** — why the project is being done, plus the standards/constraints that govern execution, (3) **Vision / Outcome** — what the project looks like when done, (4) **Ideas / Brainstorming** — what is needed to get it done, (5) **Organizing** — how the parts fit together and what matters most, (6) exactly 12 sequenced micro next actions following GTD rules (FR21).

[SCOPE DECISION 2026-09-27: Principles is NOT a standalone required section on every project. Per David Allen, roughly 80% of projects do not need full natural planning — minimal is the default. The full Natural Planning Model (with Purpose & Principles, Vision, Brainstorming, Organizing) is available as an explicit user choice for the projects that need it.]

FR29a: Project Mode SHALL offer a project depth choice — Minimal (Purpose + Outcome + Actions) or Full GTD (full Natural Planning Model per FR29) — with Minimal as the default so the zero-friction one-input flow is preserved. The selected depth SHALL be passed to `/api/generate` and SHALL determine the generated structure and the system prompt used.
FR30: A loading state SHALL be shown during generation; the request SHALL time out after 30 seconds with a user-facing error.
FR31: On successful generation, the project breakdown SHALL be saved automatically to Supabase as a new `projects` row linked to the signed-in user. No copy or download action is shown.

**AI Provider**

FR32: The app SHALL support three AI providers selected via `AI_PROVIDER`: `gemini` (default), `groq`, `openai`.
FR33: Gemini SHALL be the default and recommended provider (`gemini-3.1-flash-lite`, free tier).
FR34: Each provider SHALL use a configurable model via env var (`GEMINI_MODEL`, `GROQ_MODEL`, `OPENAI_MODEL`), no hardcoded fallbacks. Defaults: `gemini-3.1-flash-lite`, `llama-3.1-8b-instant`, `gpt-4o-mini`.
FR35: API keys SHALL be configured via environment variables only (`.env.local`); no in-app key entry UI.
FR36: If the AI provider returns an error, the app SHALL surface a clear, actionable message including guidance for API key misconfiguration.

**Output Display**

FR37: Generated output SHALL render as formatted HTML using `react-markdown` with `remark-gfm` and `rehype-raw` (required for `<details>/<summary>` accordion rendering).
FR38: The output panel SHALL be hidden until first generation and appear with a subtle fade-in (respecting `prefers-reduced-motion`).
FR39: After generation, the viewport SHALL smooth-scroll so the top of the output panel is visible.

**Auth**

FR40: The app SHALL require authentication for ALL features including Project Mode generation; there is no unauthenticated access path. Supabase Auth with email + password is the provider.
FR41: On sign-in, the user's goals, projects, actions, inbox items, and review history SHALL be loaded from Supabase and restored to their last known state.
FR42: Sign-in and sign-up SHALL use email + password only. No magic link, no OAuth in v1.
FR43: Password reset SHALL be available via a "Forgot password" link on the sign-in page, handled by Supabase Auth email flow.

**Goal Management [NOT YET BUILT]**

FR44: A user SHALL be able to create, view, edit, and delete goals; creation uses the Goal Creation Wizard (FR1–FR24).
FR45: Editing a goal SHALL allow changes to goal statement, target date, framework ratings, drivers, barriers, and if–then plan; editing does not auto-regenerate projects — the user triggers regeneration explicitly.
FR46: Deleting a goal SHALL archive all linked projects and actions (soft delete — hidden from active views, retained in the store and in exports).
FR47: Each goal SHALL have a status: Active, Paused, Not now, Someday, Completed, or Archived.
FR48: Changing a goal's status to Paused SHALL remove its linked projects from the Engage view without deleting them.

**Project Management [NOT YET BUILT]**

FR49: Each project SHALL have an outcome-based name, a purpose, a successful outcome (definition of done), a status (Active, Paused, Completed, Archived), and a parent goal.
FR50: A user SHALL be able to edit any part of an AI-generated project: name, purpose, successful outcome, and action list.
FR51: A user SHALL be able to regenerate the AI output for a specific project without affecting other projects; regeneration replaces only the explicitly regenerated project.
FR52: Completing all actions in a project does NOT auto-complete the project — the user confirms completion explicitly.

**Action Management [NOT YET BUILT]**

FR53: Each action SHALL have text (verb-first), status (available, committed, done), and a parent project.
FR54: A user SHALL be able to mark one action per project as their committed next action; only one action per project can be committed at a time.
FR55: Completing a committed action SHALL prompt the user to select the next committed action from that project's remaining available actions.
FR56: Actions MAY carry optional context tags (@energy, @location, @tool) for filtering in Engage; tags are optional and user-defined. [SCOPE DECISION 2026-09-27: context tags are IN SCOPE for v1 — schema column `context_tags text[]` is exposed with add/edit UI on actions and a filter bar in Engage.]
FR57: A user SHALL be able to add, edit, delete, and reorder actions within a project.

**Stuck Project Detection [NOT YET BUILT]**

FR58: A project is "stuck" when it is Active status and has zero committed next actions.
FR59: Stuck projects SHALL be surfaced visibly in the Engage view and flagged explicitly during weekly review; they SHALL NOT be silently hidden.
FR60: The weekly review (Get Current) SHALL not allow proceeding past a stuck project without committing a next action or changing its status to Paused/Someday.

**Inbox (Capture) [NOT YET BUILT]**

FR61: A frictionless inbox SHALL accept raw text capture with no required classification (no project, tag, or AI processing at capture time).
FR62: Inbox items SHALL be processed during Clarify: actionable? If yes — < 2 min (do now) or assign/create project. If no — trash, someday/maybe, or reference.
FR63: The weekly review (Get Clear) SHALL guide the user through processing the inbox to zero; items unprocessed > 7 days SHALL be flagged.
FR64: Inbox capture SHALL be accessible from any view without navigating away — a persistent capture affordance (keyboard shortcut or floating button).

**Engage View (Daily Actions) [NOT YET BUILT]**

FR65: The Engage view SHALL show only committed next actions across all active, non-paused goals and projects — not the full action list, Kanban, or project tree.
FR66: The Engage view SHALL support optional filtering by context tag when actions are tagged.
FR67: Completing an action from Engage SHALL immediately prompt selection of the next committed action from that project, so it never silently goes stuck.
FR68: The Engage view SHALL indicate stuck projects clearly, with a direct path to commit an action or pause the project.

**Weekly Review [NOT YET BUILT]**

FR69: The weekly review SHALL follow GTD's three-phase structure in order: Get Clear (inbox to zero), Get Current (review every active project), Get Creative (Someday/Maybe, goal alignment).
FR70: The weekly review SHALL be guided — the UI surfaces relevant data for each phase rather than a blank page; the user is walked through each step in sequence.
FR71: The weekly review SHALL have no time limit; it is structured but not timed.
FR72: The weekly review SHALL NOT allow completion until all inbox items are processed and all active projects have either a committed next action or a changed status.
FR73: Weekly review progress SHALL be preserved if the user leaves mid-review and returns.
FR74: A timestamp of the last completed weekly review SHALL be visible in the app.

**Monthly Goal Check [NOT YET BUILT — separate flow]**

FR75: The monthly goal check SHALL be a distinct UI flow (not part of weekly review) walking the user through each active goal: still relevant? current status? [SCOPE DECISION 2026-09-27: the monthly check SHALL be prompted, not manual-only — an in-app prompt surfaces when a goal's last check was 30+ days ago (in addition to manual trigger from goal detail). No push notification.]
FR76: The monthly goal check SHALL surface for each goal: active linked projects, stuck projects, and whether a missing project is needed to close a priority gap.
FR77: The user SHALL be able to change any goal's status directly from the monthly goal check flow.

**Data Persistence [NOT YET BUILT]**

FR78: All goals, projects, actions, inbox items, and review history SHALL be persisted to Supabase; no data lost between sessions.
FR79: Data SHALL be backed up by Supabase's built-in backup mechanism (frequency/PITR SLA TBD).
FR80: The user SHALL be able to export all data on demand in a portable format (JSON and/or Markdown), including goals, projects, actions, and review history.
FR81: Archiving a goal or project preserves the data in Supabase; archived data is included in exports.

**Experimental Vault (Saved Breakdowns) [SHIPPED — EXPERIMENTAL]**

FR82: A "Saved breakdowns" button in the header SHALL open the vault view.
FR83: The vault SHALL be passphrase-protected; the user must enter a passphrase to unlock before viewing.
FR84: On successful generation, the app SHALL auto-save the breakdown to the local encrypted vault if a session is unlocked; if absent, a dismissible notice SHALL prompt the user.
FR85: Each saved breakdown SHALL store input text, mode, generation timestamp, and generated markdown.
FR86: From the vault view, the user SHALL be able to restore a breakdown, delete a single breakdown, and clear the entire vault (with confirmation).
FR87: The vault SHALL support export to a downloadable JSON file and import from a previously exported JSON file.
FR88: When unlocked, the user SHALL be able to reveal a portable identity link and QR code carrying the vault unlock key in the URL fragment (generated locally, no server).
FR89: The portable identity link SHALL be scrubbed from the address bar and history immediately after processing on load.
FR90: A security warning SHALL be shown before the portable identity link or QR code is revealed.
FR91: All vault operations (encrypt, decrypt, export, import, QR render) SHALL occur entirely client-side; no vault data transmitted to any server.

**Markdown Format**

FR92: All AI generation SHALL return structured JSON (project name, purpose, successful outcome, the depth-specific Natural Planning fields, and the exactly-12 next actions) that is validated server-side and persisted as structured rows/columns in Supabase. No markdown is generated, parsed, or stored; the app renders every breakdown from the stored structured data.

### NonFunctional Requirements

NFR1 — Performance: LCP < 2s on 4G for initial page load. AI generation latency is provider-dependent (typically 5–20s), covered by the loading state.
NFR2 — Deployment: Vercel with Node.js runtime required for the API route. Not a pure static export.
NFR3 — Responsiveness: Fully functional across mobile (< 640px), tablet (640–1024px), and desktop (> 1024px).
NFR4 — Accessibility: WCAG 2.1 Level AA — full keyboard navigation including wizard steps, screen reader support (ARIA roles, live regions, focus management between steps), minimum 44×44px touch targets, 4.5:1 body / 3:1 large text contrast, respect `prefers-reduced-motion`.
NFR5 — Browser support: Latest two versions of Chrome, Firefox, Safari, and Edge.
NFR6 — Privacy: No cookies (beyond Supabase Auth session), analytics, tracking, or data collection. Only outbound requests: AI generation calls and Supabase read/write. Vault operations are client-side only.
NFR7 — Security (vault): Vault data encrypted with Web Crypto API (AES-GCM, PBKDF2) before localStorage persistence. Passphrase never stored. Portable identity key material scrubbed from address bar immediately.
NFR8 — Error resilience: Missing/invalid API key produces a clear, actionable error with provider key issuance guidance. Generation timeout surfaces a retry option. Wizard retains inputs on failure.
NFR9 — Data integrity: No data loss on reload, crash, or session end (Supabase persistence). Export integrity: every item in the store is present in the export file.

### Additional Requirements

Derived from the Architecture Spine (Decisions, Schema, Boundary Rules).

- AR1 (AD-7): Next.js App Router with Node.js runtime, `output: 'standalone'` in `next.config.ts`; API routes under `app/api/`; auth-gated `/app/*` shell; Next.js middleware enforces auth on all `/app/*` routes.
- AR2 (AD-8): Single authenticated layout — `/app/*` renders the shell (fixed 240px sidebar + max 720px main); `/sign-in`, `/sign-up`, `/forgot-password` render a minimal centred single-column layout (max 480px, no sidebar). No unauthenticated landing page. Root `/` redirects to `/app/engage` if authed, `/sign-in` if not.
- AR3 (AD-5): Tailwind CSS v4, no component library; design tokens from DESIGN.md encoded as CSS-first `@theme` tokens in `globals.css`. Custom components only, in `components/`.
- AR4 (AD-11): Single AI generation endpoint (`app/api/generate/route.ts`), auth-checked on every call (401 if unauthenticated); discriminated request union: Pattern A `{mode:'project', input}` → markdown → saved `projects` row; Pattern B `{mode:'goal', step:'framework', goal}` → framework JSON (no DB write); Pattern C `{mode:'goal', step:'generate', ...}` → full breakdown → saved `goals`+`projects`+`actions`. One auth check, one provider path, one 30s timeout handler; no streaming.
- AR5 (AD-9): Goal → Project → Action hierarchy enforced by the data model via Supabase FK constraints; Project Mode may create a project with a null `goal_id` (the one permitted exception).
- AR6 (AD-10): At most one action per project may be `committed` at a time; committing decommits the prior one. Enforced at the DB layer via `fn_commit_action` trigger, not only in the UI.
- AR7 (AD-13): Supabase Auth email + password only; Next.js middleware checks auth on all `/app/*` routes and redirects unauthenticated requests to `/sign-in`. `lib/supabase/server.ts` in route handlers; `lib/supabase/client.ts` in client components; middleware reads session from Supabase cookie.
- AR8 (AD-14): Six core tables — goals, projects, actions, inbox_items, review_sessions, weekly_snapshots. FK constraints enforce hierarchy; RLS on all tables (default-deny, `user_id = auth.uid()`); every user-owned table carries `user_id uuid references auth.users(id) on delete cascade`. Enum types for statuses. Soft deletes via `status` for goals/projects/actions; inbox items and review sessions may hard-delete. Shared `fn_set_updated_at` trigger. TypeScript types in `lib/supabase/schema.ts` generated from DDL. [SCOPE ADDITIONS 2026-09-27: (a) the `goals` table requires a `last_checked_at timestamptz` column to drive the 30-day monthly-goal-check prompt (FR75); (b) the `projects` table requires a project depth field (e.g. `planning_depth` enum `minimal | full_gtd`, default `minimal`) to persist the FR29a depth choice so re-open/regenerate preserves it. Both extend the spine DDL and should be reflected when the schema is authored.]
- AR9 (AD-15): Wizard state is client-only, not persisted until Step 4 generation succeeds; abandoning discards all state; never written to localStorage or Supabase mid-flow.
- AR10 (AD-16): Weekly review state persisted to Supabase — `review_sessions` row created at start, updated on each phase transition; completion writes closing snapshot to `weekly_snapshots`; opening snapshot reads prior week's `weekly_snapshots` row.
- AR11 (AD-17): Experimental vault (AES-GCM + PBKDF2, localStorage) operates independently of Supabase Auth; `lib/vault/` never imports from `lib/supabase/` and vice versa; all vault ops client-side only.
- AR12 (AD-18): Four responsive breakpoints for the authenticated layout: `<640px` (single-column, bottom nav), `640–768px` (single-column, bottom nav), `768–1024px` (56px icon-only sidebar), `>1024px` (240px full sidebar). Sign-in/up pages: single-column max 480px at all breakpoints. Sidebar collapse is CSS/Tailwind-driven, not JS-toggled.
- AR13 (AD-19): `react-markdown` + `remark-gfm` + `rehype-raw` required wherever AI output renders; `rehype-raw` is mandatory for `<details>/<summary>` accordions; JetBrains Mono for generated content body.
- AR14 (AD-21): Vercel (Node.js runtime). Required env vars: `AI_PROVIDER`, provider model var, provider API key, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (route handlers only). No hardcoded fallbacks; `.env.example` is the canonical list; missing var fails loudly.
- AR15 (AD-22): Accessibility and privacy are component-level invariants — WCAG 2.1 AA per component; no analytics, error monitoring, or third-party telemetry; only outbound requests are AI generation and Supabase reads/writes.
- AR16 (AD-12 / Boundary Rule 6): AI never owns user self-assessment data — gap ratings, drivers, barriers, if–then plan come from user input only; wizard Steps 2–3 receive zero AI input; all sliders start at 5 (neutral), all Step 3 fields blank.
- AR17 (Boundary Rule 3): Generation always writes to Supabase before returning (Patterns A and C); the client receives the row ID and navigates to the saved resource. There is no "display then optionally save" path.
- AR18 (Boundary Rule 9 / AD-10): Stuck detection is always on — any component rendering an Active project with zero committed actions must show the amber stuck indicator; there is no quiet render path.
- AR19 (Superseded cleanup): `ActionBar`, `lib/utils/clipboard.ts`, and `lib/utils/download.ts` exist from the prior build but must not be exposed in any UI surface; they are to be removed in a cleanup pass. No copy or download actions anywhere.
- AR20 (Seed Structure): Route and component layout is defined by the architecture seed structure (`app/sign-in`, `app/sign-up`, `app/forgot-password`, `app/app/{engage,inbox,goals,projects/new,review,settings}`, `components/{auth,authenticated/{wizard,review,engage},shared}`, `lib/{supabase,vault,templates,utils}`, root `middleware.ts`).

### UX Design Requirements

Extracted from the bmad-ux spine pair (DESIGN.md visual identity/tokens + EXPERIENCE.md behavior/flows). Each is scoped to be story-generating.

UX-DR1: Implement the design token system in `globals.css` `@theme` — the full color palette (primary #2563EB and hover/subtle, success #10B981, warning #F59E0B, destructive #EF4444, neutral surfaces, text hierarchy, focus ring #2563EB40, wizard step states, seven status-badge colors), typography (Inter body + JetBrains Mono for output, major-third ×1.25 scale), rounded scale (xs 4px → full pill), and spacing (page-x, section-y, card-p, sidebar-w 240px, content-max 720px).
UX-DR2: Implement the authenticated App Shell — fixed 240px left sidebar (wordmark, nav: Inbox/Goals/Engage/Weekly Review, settings/avatar footer), responsive collapse to 56px icon sidebar (768–1024px) and bottom nav (< 768px), and a persistent floating capture button (`C` shortcut) in all authenticated views.
UX-DR3: Implement the minimal auth layout for `/sign-in`, `/sign-up`, `/forgot-password` — single-column centred, max 480px, no sidebar, security-first register.
UX-DR4: Implement the WizardStepper component — four numbered circles connected by a line, horizontal on desktop / vertical on mobile, complete = emerald + checkmark, active = primary + number, upcoming = gray + muted number; `aria-current="step"`, `aria-label="Step N of 4: …"`, connector fills emerald as steps complete.
UX-DR5: Implement Wizard Step 1 (Goal & Skill Framework) — goal text input (500-char counter), "Continue" → framework AI call with "Building your framework…" loading, reviewable framework list (name + required-level chip + description) with remove (×) and inline "Add item"; "Next: Rate yourself →" enabled only when ≥ 3 items remain.
UX-DR6: Implement Wizard Step 2 (Gap Rating) as the GapSlider component — per-item row: skill name + required-level chip + 1–10 slider + live gap readout ("Gap: N", amber when ≥ 4); all sliders start at 5 (no AI pre-fill); "Add your own item" available; advance when all items touched/confirmed. Slider is `<input type="range">` with `aria-label`, `aria-valuenow/min/max`, `aria-valuetext` ("Current: 6, Gap: 2"), arrow-key adjust.
UX-DR7: Implement Wizard Step 3 (Drivers & Barriers) — three field groups (Drivers multi-value, Barriers multi-value, If–then structured "If **_, then I will _**"), inline label guidance, blank until user types (no AI suggestions); advance requires ≥ 1 driver, ≥ 1 barrier, and a complete if–then.
UX-DR8: Implement Wizard Step 4 (Review & Generate) — full summary of all inputs with gaps highlighted, "Edit" links returning to each step, primary CTA "Generate my breakdown" → AI call with "Generating your GTD breakdown…" (30s), navigate to new Goal detail on success, remain on Step 4 with inputs intact + error toast + "Try again" on failure; abandoning saves nothing.
UX-DR9: Implement the Project Mode input + depth control + Generate button + Output Panel — single input (placeholder "e.g., Personal portfolio website deployed online", 500-char UI cap with counter shown > 400 chars, submit-on-Enter, empty blocked); a project depth control (Minimal default / Full GTD) that stays out of the way of the zero-friction default (FR29a); "Break it down" button with loading/spinner/"Generating…"/disabled and 30s timeout→error toast; output renders via react-markdown + rehype-raw in JetBrains Mono, fade-in (respecting reduced motion), auto-save to Supabase and navigate to Project detail; "Try an example" pre-fills + auto-generates; "Start over" clears and refocuses input. The depth control meets the same WCAG 2.1 AA bar (keyboard, ARIA, 44×44px, contrast) as other controls.
UX-DR10: Implement the Goals List — flat list sorted Active → Paused → Someday/Not now → Completed/Archived, each row: goal text (2-line truncate) + status badge + target date + project count + chevron, inline amber stuck count when > 0, empty state "No goals yet. Start one.", "New goal" button opening the wizard.
UX-DR11: Implement Goal Detail — header (goal text + status badge + target date + Edit menu), collapsible gap-analysis section (priority gaps + framework tables), projects section (project cards), collapsible Monthly Goal Check section, per-project "Regenerate" with confirmation modal before overwrite.
UX-DR12: Implement the ProjectCard and Project Detail — card shows outcome name + status badge + action count + committed-action preview + amber stuck band when Active with no committed action; detail shows breadcrumb, collapsible Purpose/Successful Outcome, action list with per-action Commit (decommits prior), inline "Add action", and "Regenerate project" (confirmation → replaces only this project).
UX-DR13: Implement the ActionItem row and its states — checkbox + action text + context-tag chips (@energy/@location/@tool, add/edit inline; in scope for v1); Available (default border), Committed (primary border + primary-subtle bg, visually unmistakable as the single next action), Done (line-through + muted + checked).
UX-DR14: Implement the StuckIndicator — amber warning band ("No committed next action — this project is stuck." + "Commit one now" CTA), `role="alert"`, shown everywhere an Active project has zero committed actions; never hidden or subtle.
UX-DR15: Implement the Inbox — auto-focused single capture input (Enter or "Capture"), item rows (raw text + timestamp + Process/Delete), inline processing flow (actionable? → < 2 min do-now / assign or create project / trash / someday-maybe / reference), amber flag for items unprocessed > 7 days, and the shared floating capture drawer.
UX-DR16: Implement the Engage View — committed next actions only, grouped by goal (collapsible), each row (action text + context-tag chips + parent project + Done), on Done prompt "What's next for [project]?" with inline commit list (or "mark project complete?" if none left), stuck projects surfaced at group bottom with amber band + "Commit one →", optional context-tag filter bar, empty state "No committed actions. Open a project and commit one." (no celebration).
UX-DR17: Implement the Weekly Review shell and Phase Bar — five beats (Snapshot open → Get Clear → Get Current → Get Creative → Snapshot close), active = primary, complete = emerald, snapshots visually distinct (narrower); cannot skip a phase; progress persisted via Supabase; phase-change announced to screen readers.
UX-DR18: Implement the Weekly Snapshot (opening + closing) — opening shows prior week's closing snapshot read-only ("Last week you said:") + required retrospective prompt ("What actually moved last week? What didn't?"); closing has two required fields ("What matters most this coming week?" and "What's the main thing that could derail it?"), `aria-required`, empty blocks progress; "Complete review" stores the snapshot and returns to Engage.
UX-DR19: Implement the three review phases — Get Clear (brain-dump → inbox, then process inbox to zero; completes at inbox count 0), Get Current (surface each Active project one at a time; confirm/commit/change-status; cannot pass a stuck project unresolved), Get Creative (Someday/Maybe review, "anything missing?" capture, goal alignment check).
UX-DR20: Implement the Monthly Goal Check flow — per-goal, distinct from weekly review: "Is this goal still relevant?" (Yes/No/Changed), status selector, linked-project list with stuck count, "Missing project?" prompt, "Overloaded?" prompt; completes per-goal with no achievement event. Triggered both manually (from goal detail) and by an in-app prompt when a goal's last check was 30+ days ago (no push notification); requires a per-goal `last_checked_at` timestamp to drive the prompt.
UX-DR21: Implement the StatusBadge — inline pill for seven statuses (Active blue, Paused amber-on-subtle, Someday gray outline, Completed emerald-on-subtle, Archived gray, Not now red-on-subtle) using the badge tokens.
UX-DR22: Implement shared primitives — Modal (overlay, focus trap, return focus to trigger; used only for binary/destructive decisions), Toast (success/error accent, aria-live), and confirmation dialogs for destructive actions (delete, clear vault, archive, regenerate).
UX-DR23: Implement the Vault UI (SavedBreakdowns) — header lock icon accessible regardless of auth state, unlock screen (passphrase → decrypt), vault list (input text/mode/timestamp), silent auto-save when unlocked / dismissible "Vault locked" banner when not, per-breakdown Restore/Delete, vault-level Export/Import/Clear-all (confirmation) and Reveal portable identity (behind security-warning modal, URL scrubbed, client-side QR).
UX-DR24: Implement app-wide accessibility floor — full keyboard tab order across every surface, focus management (to output after generation, to first field on wizard step advance, into/out of modals, to next action row after Engage completion), screen-reader support (aria-live output region, stepper aria-current, slider aria-valuetext, stuck `role="alert"`), reduced-motion suppression of all decorative animation, 44×44px minimum touch targets, and inline validation linked via `aria-describedby` (never color-only).
UX-DR25: Enforce GTD Template Integrity as a generation-quality gate — outcome-based project names; depth-aware Project Mode structure (Minimal = Purpose + Successful Outcome + Next Actions; Full GTD = Purpose & Principles → Vision/Outcome → Ideas/Brainstorming → Organizing → Next Actions per FR29); physical-verb tiny (2–5 min) actions referencing real tools; first action lowest-friction; priority gaps linked to projects by exact name; no "Open Notion" references; generation failures surfaced as quality errors, not suppressed.

### FR Coverage Map

| FR    | Epic   | Description                                                                                   |
| ----- | ------ | --------------------------------------------------------------------------------------------- |
| FR32  | Epic 1 | AI provider selection (env-configured)                                                        |
| FR33  | Epic 1 | Gemini default provider                                                                       |
| FR34  | Epic 1 | Configurable model per provider, no fallbacks                                                 |
| FR35  | Epic 1 | API keys via env only                                                                         |
| FR40  | Epic 1 | Auth required for all features                                                                |
| FR41  | Epic 1 | Restore user data on sign-in                                                                  |
| FR42  | Epic 1 | Email + password sign-in/up only                                                              |
| FR43  | Epic 1 | Password reset via Supabase email flow                                                        |
| FR78  | Epic 1 | All data persisted to Supabase                                                                |
| FR79  | Epic 1 | Supabase backup mechanism                                                                     |
| FR25  | Epic 2 | Project Mode single text input                                                                |
| FR26  | Epic 2 | Project Mode 500-char UI / 2000 server cap                                                    |
| FR27  | Epic 2 | Project Mode empty-input validation                                                           |
| FR28  | Epic 2 | Submit via Enter or button                                                                    |
| FR29  | Epic 2 | Project Mode depth-aware breakdown (minimal / full GTD)                                       |
| FR29a | Epic 2 | Project depth choice (minimal default / full GTD)                                             |
| FR30  | Epic 2 | Project Mode loading + 30s timeout                                                            |
| FR31  | Epic 2 | Project Mode auto-saves to Supabase projects row                                              |
| FR36  | Epic 2 | Provider error surfaced with actionable message                                               |
| FR37  | Epic 2 | Structured project detail view renders from stored rows                                       |
| FR38  | —      | Superseded — output-panel fade-in (same-page reveal removed; flow navigates to a detail page) |
| FR39  | —      | Superseded — smooth-scroll to output (same-page reveal removed)                               |
| FR92  | Epic 2 | Structured JSON generation persisted to Supabase (no markdown)                                |
| FR1   | Epic 3 | Four-step wizard stepper                                                                      |
| FR2   | Epic 3 | Stepper progress indication                                                                   |
| FR3   | Epic 3 | Back navigation preserves inputs                                                              |
| FR4   | Epic 3 | Abandon creates no goal                                                                       |
| FR5   | Epic 3 | Goal text 500-char UI / 2000 server cap                                                       |
| FR6   | Epic 3 | Empty goal text blocked                                                                       |
| FR7   | Epic 3 | Step 1 AI skill-framework proposal                                                            |
| FR8   | Epic 3 | Framework returned before Step 2, with loading                                                |
| FR9   | Epic 3 | Review / remove / add framework items                                                         |
| FR10  | Epic 3 | Step 2 per-item rating, live gap                                                              |
| FR11  | Epic 3 | AI never pre-fills ratings                                                                    |
| FR12  | Epic 3 | User can add items in Step 2                                                                  |
| FR13  | Epic 3 | Step 3 drivers + barriers                                                                     |
| FR14  | Epic 3 | AI never infers drivers/barriers                                                              |
| FR15  | Epic 3 | If–then plan                                                                                  |
| FR16  | Epic 3 | Step 4 summary + edit-back                                                                    |
| FR17  | Epic 3 | Step 4 generation with full structured inputs                                                 |
| FR18  | Epic 3 | Full Reverse-Goal-Setting + GTD breakdown                                                     |
| FR19  | Epic 3 | First two projects close priority 1 & 2 gaps, names match                                     |
| FR20  | Epic 3 | Content specific to user inputs (no filler)                                                   |
| FR21  | Epic 3 | GTD next-action rules (shared with Epic 2)                                                    |
| FR22  | Epic 3 | Wizard generation 30s timeout + retry                                                         |
| FR23  | Epic 3 | Wizard generation loading state                                                               |
| FR24  | Epic 3 | Generation failure keeps Step 4 inputs intact                                                 |
| FR44  | Epic 4 | Create / view / edit / delete goals                                                           |
| FR45  | Epic 4 | Edit goal fields; no auto-regenerate                                                          |
| FR46  | Epic 4 | Delete archives linked projects/actions (soft)                                                |
| FR47  | Epic 4 | Goal statuses                                                                                 |
| FR48  | Epic 4 | Paused goal removed from Engage                                                               |
| FR49  | Epic 4 | Project fields + status + parent goal                                                         |
| FR50  | Epic 4 | Edit any part of a generated project                                                          |
| FR51  | Epic 4 | Regenerate a single project                                                                   |
| FR52  | Epic 4 | Explicit project completion                                                                   |
| FR53  | Epic 4 | Action fields + statuses                                                                      |
| FR54  | Epic 4 | One committed action per project                                                              |
| FR55  | Epic 4 | Completing committed action prompts next                                                      |
| FR56  | Epic 4 | Context tags on actions (in scope v1)                                                         |
| FR57  | Epic 4 | Add / edit / delete / reorder actions                                                         |
| FR58  | Epic 4 | Stuck definition (Active + zero committed)                                                    |
| FR59  | Epic 4 | Stuck surfaced, never hidden                                                                  |
| FR61  | Epic 5 | Frictionless inbox capture                                                                    |
| FR62  | Epic 5 | Inbox clarify/processing flow                                                                 |
| FR63  | Epic 5 | Weekly review Get Clear to inbox zero; 7-day flag                                             |
| FR64  | Epic 5 | Persistent capture from any view                                                              |
| FR65  | Epic 5 | Engage shows committed actions only                                                           |
| FR66  | Epic 5 | Engage context-tag filtering                                                                  |
| FR67  | Epic 5 | Complete-in-Engage prompts next committed                                                     |
| FR68  | Epic 5 | Engage surfaces stuck projects                                                                |
| FR60  | Epic 5 | Get Current blocks past a stuck project                                                       |
| FR69  | Epic 5 | Weekly review three-phase order                                                               |
| FR70  | Epic 5 | Guided review, data surfaced per phase                                                        |
| FR71  | Epic 5 | Review not timed                                                                              |
| FR72  | Epic 5 | Review completion gates                                                                       |
| FR73  | Epic 5 | Review progress preserved (Supabase)                                                          |
| FR74  | Epic 5 | Last-review timestamp visible                                                                 |
| FR75  | Epic 5 | Monthly goal check (prompted + manual)                                                        |
| FR76  | Epic 5 | Monthly check surfaces projects/stuck/missing                                                 |
| FR77  | Epic 5 | Change goal status from monthly check                                                         |
| FR80  | Epic 6 | On-demand data export (JSON/Markdown)                                                         |
| FR81  | Epic 6 | Archived data retained + in exports                                                           |
| FR82  | Epic 6 | Vault open button                                                                             |
| FR83  | Epic 6 | Vault passphrase unlock                                                                       |
| FR84  | Epic 6 | Auto-save to vault when unlocked                                                              |
| FR85  | Epic 6 | Vault entry contents                                                                          |
| FR86  | Epic 6 | Restore / delete / clear vault                                                                |
| FR87  | Epic 6 | Vault export / import JSON                                                                    |
| FR88  | Epic 6 | Portable identity link + QR                                                                   |
| FR89  | Epic 6 | Portable identity scrubbed from address bar                                                   |
| FR90  | Epic 6 | Security warning before reveal                                                                |
| FR91  | Epic 6 | All vault ops client-side only                                                                |

**NFR coverage:** NFR2 (Node runtime/Vercel), NFR6 (privacy), NFR7 (vault security), NFR9 (data integrity) anchor in Epic 1 and Epic 6. NFR1 (performance), NFR3 (responsive), NFR4 (accessibility), NFR5 (browser support), NFR8 (error resilience) are cross-cutting — verified within every epic that ships UI, with the baseline established in Epic 1.

**AR coverage:** AR1, AR2, AR3, AR7, AR8, AR12, AR14, AR15, AR20 → Epic 1 (foundation). AR4, AR13, AR16, AR17, AR19, AR25 → Epic 2 (generation endpoint + render stack + dead-code cleanup). AR9, AR16 → Epic 3 (wizard transient state, user-owned data). AR5, AR6, AR18 → Epic 4 (hierarchy, commit trigger, stuck detection). AR10 → Epic 5 (review persistence). AR11 → Epic 6 (vault independence).

## Epic List

### Epic 1: Authenticated Foundation & Persistence Backbone

A user can create an account, sign in with email and password, reset a forgotten password, and land in the authenticated app shell — with their data backed by a fully provisioned, RLS-protected Supabase schema that restores on every sign-in. This epic establishes the standalone, no-unauthenticated-surface foundation every other epic builds on: the Next.js standalone runtime, middleware auth guard, single authenticated layout with responsive sidebar/bottom-nav, Tailwind v4 design tokens, the six-table schema (plus the `last_checked_at` and `planning_depth` additions) with the `fn_commit_action` and `fn_set_updated_at` triggers, the Supabase client/server/middleware wiring, the AI provider configuration layer, and the environment contract.
**FRs covered:** FR32, FR33, FR34, FR35, FR40, FR41, FR42, FR43, FR78, FR79
**NFRs covered:** NFR2, NFR3, NFR4, NFR5, NFR6 (baseline)
**ARs covered:** AR1, AR2, AR3, AR7, AR8, AR12, AR14, AR15, AR20

### Epic 2: Project Mode Generation & Output Rendering

A signed-in user can type a project, choose Minimal or Full-GTD depth, and get a complete GTD project breakdown generated by the AI as structured JSON, saved automatically to Supabase as structured rows, and shown on the new project's detail view. This epic delivers the first end-to-end AI value and builds the shared generation infrastructure the wizard reuses: the single discriminated `/api/generate` endpoint (Pattern A) with one auth check, one provider path, and one 30-second timeout handler; structured JSON generation validated server-side and persisted as `projects` + `actions` rows (no markdown stored); provider-error handling; and the removal of the dead copy/download code from the prior build.
**FRs covered:** FR25, FR26, FR27, FR28, FR29, FR29a, FR30, FR31, FR36, FR37, FR92
**NFRs covered:** NFR1, NFR8
**ARs covered:** AR4, AR13, AR17, AR19, AR25

### Epic 3: Goal Creation Wizard & Gap Analysis

A signed-in user can create a goal through a guided four-step wizard — stating the goal, reviewing an AI-proposed skill framework, rating their own gaps, entering drivers/barriers/if–then, and confirming — after which the AI generates a full Reverse-Goal-Setting + GTD breakdown (goal, success criteria, target/current profiles, priority gaps, 5–6 projects with 12 actions each) saved to Supabase as goals + projects + actions. This epic extends the Epic 2 endpoint with Patterns B and C, and enforces the system-wide invariant that the AI never owns the user's self-assessment data. Wizard state is transient — abandoning creates nothing.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24
**NFRs covered:** NFR1, NFR4, NFR8
**ARs covered:** AR9, AR16

### Epic 4: Goal, Project & Action Management

A signed-in user can manage everything the generators produce: view and edit goals with their gap analysis, change goal and project statuses, edit or regenerate individual projects, and manage actions — add, edit, delete, reorder, tag with context, and commit exactly one next action per project (enforced at the database layer). Stuck projects (Active with zero committed actions) are detected and surfaced with an amber indicator everywhere they appear. This epic turns generated breakdowns into a living, editable system of record over the Goal → Project → Action hierarchy.
**FRs covered:** FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR51, FR52, FR53, FR54, FR55, FR56, FR57, FR58, FR59
**NFRs covered:** NFR3, NFR4, NFR9
**ARs covered:** AR5, AR6, AR18

### Epic 5: The GTD Loop — Inbox, Engage & Reviews

A signed-in user can run the full GTD reflect-and-engage loop: capture raw input to a frictionless inbox from any view, see only their committed next actions in the Engage view (completing one immediately prompts the next so projects never silently go stuck), run a guided three-phase weekly review (Get Clear → Get Current → Get Creative) bookended by opening and closing weekly snapshots that close the loop week-over-week, and run a prompted monthly goal check per goal. Review progress persists to Supabase and survives leaving mid-review. This is the epic that makes Archer a system rather than a generator.
**FRs covered:** FR60, FR61, FR62, FR63, FR64, FR65, FR66, FR67, FR68, FR69, FR70, FR71, FR72, FR73, FR74, FR75, FR76, FR77
**NFRs covered:** NFR3, NFR4
**ARs covered:** AR10

### Epic 6: Data Portability & Experimental Vault

A signed-in user can export all their data on demand in a portable format, with archived items retained and included. Independently, any visitor can use the experimental client-side encrypted vault — passphrase-unlock, auto-save of generated breakdowns, restore/delete/clear, JSON export/import, and a portable-identity link + QR (behind a security warning, scrubbed from the address bar) to carry the vault to another device. All vault operations are client-side only and never touch the server; the vault layer stays fully independent of Supabase.
**FRs covered:** FR80, FR81, FR82, FR83, FR84, FR85, FR86, FR87, FR88, FR89, FR90, FR91
**NFRs covered:** NFR6, NFR7, NFR9
**ARs covered:** AR11

## Epic 1: Authenticated Foundation & Persistence Backbone

A user can create an account, sign in with email and password, reset a forgotten password, and land in the authenticated app shell — with their data backed by a fully provisioned, RLS-protected Supabase schema that restores on every sign-in. This epic establishes the standalone foundation every other epic builds on.

**Relevant UX-DRs:** UX-DR1 (design tokens), UX-DR2 (app shell), UX-DR3 (auth layout), UX-DR24 (accessibility floor baseline).

### Story 1.1: Standalone Next.js Runtime & Design Token Foundation

As a developer,
I want a Next.js App Router project configured for the Node.js standalone runtime with Archer's design tokens in place,
So that every subsequent feature builds on a consistent, deployable foundation with the correct runtime and visual language.

**Acceptance Criteria:**

**Given** a checkout of the project
**When** `npm run build` runs
**Then** the build completes with `output: 'standalone'` configured in `next.config.ts`
**And** no `output: 'export'` (static) configuration is present

**Given** the global stylesheet
**When** `globals.css` is inspected
**Then** the full color palette is defined as Tailwind v4 CSS-first `@theme` tokens (primary #2563EB + hover/subtle, success #10B981, warning #F59E0B, destructive #EF4444, neutral surfaces, text hierarchy, focus ring #2563EB40, wizard step states, seven status-badge colors)
**And** typography tokens are defined (Inter body, JetBrains Mono for output, major-third ×1.25 scale)
**And** the rounded scale (xs 4px → full pill) and spacing tokens (page-x, section-y, card-p, sidebar-w 240px, content-max 720px) are defined
**And** no external UI kit (shadcn, Radix, MUI) or CSS-in-JS library is added

**Given** the deployed app
**When** the initial page loads on 4G
**Then** LCP is under 2 seconds (NFR1 baseline)

### Story 1.2: Supabase Schema, RLS & Database Triggers

As a developer,
I want the complete Supabase schema provisioned with row-level security, enum types, and the required triggers,
So that all user data is persisted safely, scoped per user, and enforces the GTD invariants at the database layer.

**Acceptance Criteria:**

**Given** a migration run against Supabase
**When** the schema is applied
**Then** six tables exist — goals, projects, actions, inbox_items, review_sessions, weekly_snapshots
**And** the goal_status, project_status, action_status, inbox_processing_status, and review_phase enum types are created
**And** the `goals` table includes a `last_checked_at timestamptz` column (for the monthly-check prompt)
**And** the `projects` table includes a `planning_depth` field (enum `minimal | full_gtd`, default `minimal`)

**Given** the hierarchy constraints
**When** the foreign keys are inspected
**Then** an action references a project (`on delete cascade`), a project references a goal (`goal_id` nullable, `on delete set null`), and every user-owned table carries `user_id uuid not null references auth.users(id) on delete cascade`

**Given** RLS is enabled on every table
**When** a user queries any table
**Then** they can read and write only rows where `user_id = auth.uid()`
**And** a table without RLS enabled or without a `user_id` policy is treated as a defect

**Given** the database functions
**When** they are inspected
**Then** `fn_set_updated_at` maintains `updated_at` on update for all tables
**And** `fn_commit_action` runs `BEFORE UPDATE` on `actions` and decommits any other committed action on the same project when one becomes committed

**Given** the DDL
**When** TypeScript types are generated
**Then** `lib/supabase/schema.ts` reflects the schema and is used as the authoritative type source

### Story 1.3: Supabase Client Wiring & Auth Middleware Guard

As a developer,
I want browser and server Supabase clients plus Next.js middleware that guards all authenticated routes,
So that no unauthenticated request can reach any feature and sessions are consistently available across server and client code.

**Acceptance Criteria:**

**Given** the Supabase integration modules
**When** inspected
**Then** `lib/supabase/client.ts` provides a browser client for client components, `lib/supabase/server.ts` provides a server client for route handlers and server components, and `lib/supabase/middleware.ts` provides a session-refresh helper

**Given** a root `middleware.ts`
**When** an unauthenticated request targets any `/app/*` route
**Then** it is redirected to `/sign-in`
**And** the redirect is enforced by middleware, not by individual pages

**Given** the root route `/`
**When** an authenticated user visits it
**Then** they are redirected to `/app/engage`
**And** an unauthenticated user visiting `/` is redirected to `/sign-in`

**Given** the required environment variables are absent
**When** a route handler that depends on one executes
**Then** it fails loudly with a logged error and a user-facing message rather than degrading silently
**And** `.env.example` lists every required variable (`AI_PROVIDER`, provider model var, provider API key, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)

### Story 1.4: Sign Up & Sign In with Email and Password

As a new user,
I want to create an account and sign in with my email and password,
So that I can access Archer and have my work saved to my own account.

**Acceptance Criteria:**

**Given** the `/sign-up` page
**When** I submit a valid email and password
**Then** a Supabase Auth account is created and I am signed in
**And** the page uses the minimal single-column centred layout (max 480px, no sidebar)

**Given** the `/sign-in` page
**When** I submit correct credentials
**Then** I am authenticated and redirected to `/app/engage`

**Given** the `/sign-in` page
**When** I submit incorrect credentials
**Then** a clear inline error is shown and I remain on the page

**Given** either auth form
**When** I inspect the available methods
**Then** only email + password is offered — no magic link and no OAuth providers

**Given** a "Create account" link on the sign-in page
**When** I click it
**Then** I navigate to `/sign-up`

### Story 1.5: Password Reset

As a user who forgot my password,
I want to request a password reset by email,
So that I can regain access to my account without losing my data.

**Acceptance Criteria:**

**Given** the sign-in page
**When** I click "Forgot password"
**Then** I navigate to `/forgot-password` (minimal centred layout)

**Given** the forgot-password form
**When** I submit my email
**Then** Supabase Auth sends a password-reset email
**And** a confirmation message is shown regardless of whether the email exists (no account enumeration)

**Given** I follow the reset link from the email
**When** I set a new password
**Then** the password is updated and I can sign in with it

### Story 1.6: Authenticated App Shell with Responsive Navigation

As a signed-in user,
I want a consistent app shell with navigation that adapts to my device,
So that I can move between Archer's features from any screen size.

**Acceptance Criteria:**

**Given** I am signed in on desktop (> 1024px)
**When** I view any `/app/*` route
**Then** a fixed 240px left sidebar shows the Archer wordmark, primary nav (Inbox, Goals, Engage, Weekly Review), and a settings/avatar footer
**And** the main content area is capped at max 720px
**And** the active nav item uses the primary-subtle background with primary text

**Given** a tablet-landscape viewport (768–1024px)
**When** I view the shell
**Then** the sidebar collapses to a 56px icon-only rail with tooltips

**Given** a viewport under 768px
**When** I view the shell
**Then** navigation is a bottom nav bar (Inbox, Goals, Engage, Review) and the sidebar is not rendered
**And** the collapse behavior is CSS/Tailwind-driven at breakpoints, not JS-toggled state

**Given** any authenticated view
**When** I look for capture
**Then** a persistent floating capture button (keyboard shortcut `C`) is present (its drawer behavior is delivered in Epic 5)

**Given** the shell is navigated by keyboard
**When** I tab through it
**Then** focus order is logical and focus indicators are visible
**And** all interactive elements meet the 44×44px minimum touch target

### Story 1.7: AI Provider Configuration Layer

As a developer,
I want a provider-agnostic AI configuration layer selected by environment variables,
So that generation features can call Gemini, Groq, or OpenAI without hardcoded models or keys.

**Acceptance Criteria:**

**Given** the `AI_PROVIDER` environment variable
**When** it is set to `gemini`, `groq`, or `openai`
**Then** the corresponding provider is selected
**And** when unset, `gemini` is the default

**Given** a selected provider
**When** the model is resolved
**Then** it comes from the provider's model env var (`GEMINI_MODEL` / `GROQ_MODEL` / `OPENAI_MODEL`) with no hardcoded fallback
**And** documented defaults are `gemini-3.1-flash-lite`, `llama-3.1-8b-instant`, `gpt-4o-mini`

**Given** the API keys
**When** the configuration is inspected
**Then** keys are read only from environment variables (`GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY`)
**And** there is no in-app key entry UI

**Given** data restoration on sign-in
**When** a user authenticates
**Then** their goals, projects, actions, inbox items, and review history load from Supabase and reflect their last known state

## Epic 2: Project Mode Generation & Output Rendering

A signed-in user can type a project, choose Minimal or Full-GTD depth, and get a complete GTD project breakdown generated by the AI as structured JSON, saved automatically to Supabase as structured rows — then land on the new project's detail view, which renders the breakdown from the stored structured data.

**Relevant UX-DRs:** UX-DR9 (input + depth control + structured detail view), UX-DR25 (GTD template integrity).

### Story 2.1: Single Generation Endpoint with Auth & Provider Path (Pattern A)

As a developer,
I want a single authenticated `/api/generate` route that handles Project Mode requests,
So that all AI generation flows through one auth check, one provider path, and one timeout handler.

**Acceptance Criteria:**

**Given** the `/api/generate` route handler
**When** a request arrives without a valid Supabase session
**Then** it responds 401 and no AI call is made

**Given** an authenticated request with body `{ mode: 'project', input }`
**When** it is processed
**Then** the handler loads the Project Mode system prompt, calls the configured provider, and applies a 30-second timeout
**And** the response is not streamed

**Given** the endpoint design
**When** inspected
**Then** it is the single route serving all generation patterns (A now; B and C added in Epic 3), sharing one auth check, one provider-selection path, and one timeout handler
**And** components never call an AI provider directly — they call `fetch('/api/generate', ...)`

**Given** a request whose input exceeds the server safety cap
**When** it is processed
**Then** input longer than 2,000 characters is rejected before the AI call

### Story 2.2: Project Mode Input with Depth Control & Validation

As a signed-in user,
I want to enter a project and choose how deep the plan should go,
So that I get either a quick breakdown or a full natural-planning breakdown as the project warrants.

**Acceptance Criteria:**

**Given** the `/app/projects/new` view
**When** it loads
**Then** a single text input shows the placeholder "e.g., Personal portfolio website deployed online"
**And** a project depth control offers Minimal (default) and Full GTD
**And** the depth control does not obstruct the zero-friction default flow

**Given** the input
**When** I type
**Then** it accepts up to 500 characters (UI-enforced) and shows a character count when over 400 characters

**Given** an empty or whitespace-only input
**When** I click "Break it down" or press Enter
**Then** inline validation blocks submission and no generation occurs

**Given** valid input
**When** I press Enter or click the button
**Then** the form submits (Enter and button are equivalent)

**Given** the depth control
**When** inspected for accessibility
**Then** it is keyboard-operable, exposes ARIA state, meets 44×44px, and meets 4.5:1 contrast

### Story 2.3: Project Mode Generation, Save & Navigation

As a signed-in user,
I want my submitted project turned into a saved GTD breakdown,
So that the plan is persisted and I land directly on it.

**Acceptance Criteria:**

**Given** a valid Minimal submission
**When** generation succeeds
**Then** the AI produces Name (outcome-based) + Purpose + Successful Outcome + exactly 12 sequenced micro next actions following GTD rules
**And** the breakdown is saved as a new `projects` row linked to the signed-in user (with `planning_depth = minimal`)
**And** I am navigated to the new Project detail view

**Given** a valid Full GTD submission
**When** generation succeeds
**Then** the AI produces Name + Purpose and Principles + Vision/Outcome + Ideas/Brainstorming + Organizing + exactly 12 micro next actions
**And** the row is saved with `planning_depth = full_gtd`

**Given** the save-before-return rule
**When** generation completes
**Then** the handler writes the Supabase row and returns the row ID before the client navigates
**And** there is no "show output then decide whether to save" path
**And** no copy or download action is offered anywhere

**Given** all generated next actions
**When** inspected
**Then** each begins with a physical verb, references a specific real tool/app/website/location, and is completable in 2–5 minutes
**And** the first action is the lowest-friction possible starting point
**And** no action references "Open Notion" as a destination

### Story 2.4: Loading, Timeout & Provider Error Handling

As a signed-in user,
I want clear feedback while generation runs and when it fails,
So that I am never left staring at a frozen screen.

**Acceptance Criteria:**

**Given** a generation request in flight
**When** I wait
**Then** the button shows a spinner and "Generating…", the input is disabled

**Given** a request that exceeds 30 seconds
**When** the timeout fires
**Then** a user-facing error toast appears with a retry option and my input is preserved

**Given** the provider returns an error
**When** it is surfaced
**Then** the message is clear and actionable, including guidance for API-key misconfiguration (e.g. "No API key configured. Add GEMINI_API_KEY to .env.local.")

> **Story 2.5 removed.** The former "Formatted Output Rendering & Notion-Optimized Markdown" story is obsolete: generation now returns structured JSON persisted as `projects` + `actions` rows, and the project detail view (Story 2.3) renders directly from that structured data. There is no markdown artifact to format, no copy/paste-to-Notion target, and the same-page output panel (fade-in / smooth-scroll) no longer exists — the flow navigates to a dedicated detail page instead.

### Story 2.6: Remove Dead Copy/Download Code

As a developer,
I want the superseded copy/download code removed from the product,
So that no unauthenticated or non-persisted output path exists, matching the current architecture.

**Acceptance Criteria:**

**Given** the codebase from the prior build
**When** the cleanup pass runs
**Then** `ActionBar`, `lib/utils/clipboard.ts`, and `lib/utils/download.ts` are no longer referenced by any UI surface
**And** no "Copy Markdown" or "Download .md" control appears anywhere in the product

**Given** the app after cleanup
**When** the build and existing tests run
**Then** they pass with no references to the removed modules

## Epic 3: Goal Creation Wizard & Gap Analysis

A signed-in user can create a goal through a guided four-step wizard, after which the AI generates a full Reverse-Goal-Setting + GTD breakdown saved to Supabase as goals + projects + actions. The AI never owns the user's self-assessment data, and wizard state is transient.

**Relevant UX-DRs:** UX-DR4 (stepper), UX-DR5 (Step 1), UX-DR6 (Step 2 gap slider), UX-DR7 (Step 3), UX-DR8 (Step 4), UX-DR24 (accessibility), UX-DR25 (template integrity).

### Story 3.1: Wizard Shell & Stepper Navigation

As a signed-in user,
I want a four-step wizard with clear progress and safe back navigation,
So that I always know where I am and can correct earlier inputs without losing later ones.

**Acceptance Criteria:**

**Given** the `/app/goals/new` wizard
**When** it loads
**Then** a stepper shows four steps (Goal & Skill Framework, Gap Rating, Drivers & Barriers, Review & Generate)
**And** the current step, completed steps, and upcoming steps are visually distinct
**And** the stepper is horizontal on desktop and vertical on mobile (< 640px)

**Given** I am on a later step
**When** I navigate back to a previous step
**Then** my later inputs are preserved
**And** if I change the goal text on Step 1, the skill framework is invalidated and must be regenerated

**Given** the wizard
**When** I cannot skip ahead
**Then** each step gates advancement on its own completion rule

**Given** the stepper for accessibility
**When** read by a screen reader
**Then** the active step exposes `aria-current="step"` and each step has a label like "Step 2 of 4: Gap Rating"
**And** focus moves to the first interactive element of a step on advance

### Story 3.2: Framework Generation Endpoint (Pattern B)

As a developer,
I want the generation endpoint to return a skill framework for a goal without writing to the database,
So that the wizard can hold the proposed framework in transient state before the user commits.

**Acceptance Criteria:**

**Given** an authenticated request `{ mode: 'goal', step: 'framework', goal }`
**When** it is processed
**Then** the handler returns a skill/attribute framework as JSON — items with name, required level (1–10), and a goal-specific description
**And** no Supabase row is written for this pattern

**Given** the goal text
**When** it exceeds the server cap
**Then** input longer than 2,000 characters is rejected before the AI call

**Given** this pattern shares the endpoint
**When** inspected
**Then** it reuses the same auth check, provider path, and 30-second timeout as Pattern A

### Story 3.3: Wizard Step 1 — Goal & Skill Framework

As a signed-in user,
I want to state my goal and review an AI-proposed skill framework,
So that my gap analysis is grounded in what success actually requires.

**Acceptance Criteria:**

**Given** Step 1
**When** it loads
**Then** a goal text input accepts up to 500 characters with a live counter

**Given** an empty or whitespace-only goal
**When** I try to continue
**Then** inline validation blocks advancing from Step 1

**Given** valid goal text
**When** I click "Continue"
**Then** a loading state "Building your framework…" shows while the framework is fetched (Pattern B)
**And** the framework must return before I can advance to Step 2

**Given** the returned framework
**When** it renders
**Then** each item shows a skill name, a required-level chip, and a goal-specific description
**And** I can remove irrelevant items and add my own via an inline "Add item" field

**Given** the framework
**When** I try to advance
**Then** "Next: Rate yourself →" is enabled only when at least 3 items remain

### Story 3.4: Wizard Step 2 — Gap Rating

As a signed-in user,
I want to rate myself against each framework item and see my gaps,
So that the breakdown targets my real weaknesses — using only my own ratings.

**Acceptance Criteria:**

**Given** each confirmed framework item
**When** Step 2 renders
**Then** each row shows the skill name, required-level chip, a 1–10 slider, and a live gap readout (Gap = Required − Current)
**And** the gap displays in amber when ≥ 4, neutral otherwise

**Given** the AI-never-pre-fills invariant
**When** Step 2 loads
**Then** every slider starts at 5 (neutral midpoint) with no AI-supplied values

**Given** Step 2
**When** I identify a missing item
**Then** I can add my own skill/attribute item here

**Given** advancement
**When** all items have been touched or explicitly confirmed
**Then** "Next: Drivers & Barriers →" becomes active

**Given** each slider for accessibility
**When** read by a screen reader
**Then** it is an `<input type="range">` with `aria-label`, `aria-valuenow/min/max`, and `aria-valuetext` such as "Current: 6, Gap: 2", adjustable by arrow keys

### Story 3.5: Wizard Step 3 — Drivers, Barriers & If–Then Plan

As a signed-in user,
I want to record my strengths, real obstacles, and an if–then plan,
So that the breakdown reflects my actual situation, entirely in my own words.

**Acceptance Criteria:**

**Given** Step 3
**When** it renders
**Then** three field groups appear — Drivers (multi-value), Barriers (multi-value), and a structured If–then plan ("If **_, then I will _**")
**And** all fields start blank with no AI-suggested content
**And** inline label guidance is shown ("An internal strength already working for you", "What actually gets in the way")

**Given** advancement
**When** I try to proceed
**Then** at least one Driver, at least one Barrier, and a complete If–then plan are required

### Story 3.6: Wizard Step 4 — Review, Generate, Save (Pattern C)

As a signed-in user,
I want to review everything and generate my full breakdown,
So that a complete, saved goal with projects and actions is created from my inputs.

**Acceptance Criteria:**

**Given** Step 4
**When** it renders
**Then** it summarizes all inputs from Steps 1–3 (goal text, framework with required levels and my ratings, gaps highlighted, drivers, barriers, if–then plan)
**And** an "Edit" link beside each section returns to the relevant step

**Given** I confirm with "Generate my breakdown"
**When** the request is sent
**Then** it posts `{ mode: 'goal', step: 'generate', goal, framework, ratings, drivers, barriers, ifThen }` and shows "Generating your GTD breakdown…" with a 30-second timeout

**Given** successful generation
**When** the breakdown returns
**Then** it contains all of: 3-Month Goal statement with target date = 3 months from today; success criteria (3+ measurable items); Target Profile; Current Profile with calculated gaps; Drivers/Resources/Barriers verbatim; if–then plan verbatim; 2–3 priority gaps; 5–6 outcome-named GTD projects as `<details>/<summary>` accordions each with Purpose (3–4 sentences), Successful Outcome (2–3 sentences), and 12 micro next actions; and a Monthly Goal Check section
**And** the first two projects close Priority 1 and Priority 2 gaps, with names matching the linked project names in the Priority section character-for-character
**And** all next actions follow the GTD rules (physical verb, real tool, 2–5 minutes)
**And** the result is written to Supabase as `goals` + `projects` + `actions` rows before I am navigated to the new Goal detail view

**Given** content quality
**When** the breakdown is inspected
**Then** it is specific to my goal and inputs (real tools/websites/resources), with no generic filler

**Given** a timeout or provider error
**When** generation fails
**Then** the wizard remains on Step 4 with all inputs intact, shows an error toast and a "Try again" button, and no goal is created

**Given** I abandon the wizard (close tab or navigate away) at any point before success
**When** the wizard state is checked
**Then** no goal is saved, nothing is written to localStorage or Supabase mid-flow, and there is no recovery or nudge

## Epic 4: Goal, Project & Action Management

A signed-in user can manage everything the generators produce — view and edit goals with their gap analysis, change statuses, edit or regenerate individual projects, and manage actions including committing exactly one next action per project (enforced at the database layer). Stuck projects are detected and surfaced everywhere they appear.

**Relevant UX-DRs:** UX-DR10 (goals list), UX-DR11 (goal detail), UX-DR12 (project card + detail), UX-DR13 (action item + context tags), UX-DR14 (stuck indicator), UX-DR21 (status badge), UX-DR22 (modal/toast/confirmations), UX-DR24 (accessibility).

### Story 4.1: Goals List & Status Badges

As a signed-in user,
I want to see all my goals with their status at a glance,
So that I can find and open any goal quickly.

**Acceptance Criteria:**

**Given** the Goals list
**When** it renders
**Then** goals are sorted Active first (creation date desc), then Paused, then Someday/Not now, then Completed/Archived
**And** each row shows goal text (truncated to 2 lines), a status badge, target date, project count, and a chevron
**And** an amber stuck count is shown inline when a goal has > 0 stuck projects

**Given** the seven statuses
**When** badges render
**Then** Active (blue), Paused (amber-on-subtle), Someday (gray outline), Completed (emerald-on-subtle), Archived (gray), and Not now (red-on-subtle) use the badge tokens

**Given** I have no goals
**When** the list renders
**Then** the empty state reads "No goals yet. Start one." with a control that opens the wizard

**Given** a "New goal" control
**When** I activate it
**Then** the Goal Creation Wizard opens

### Story 4.2: Goal Detail, Edit & Status Changes

As a signed-in user,
I want to view and edit a goal and change its status,
So that my goal stays accurate as my situation changes.

**Acceptance Criteria:**

**Given** a goal detail view
**When** it renders
**Then** the header shows goal text, status badge, target date, and an Edit menu
**And** a collapsible gap-analysis section shows priority gaps and framework tables
**And** the projects section lists the goal's project cards
**And** a collapsible Monthly Goal Check section appears at the bottom

**Given** I edit the goal
**When** I save
**Then** I can change goal statement, target date, framework ratings, drivers, barriers, and if–then plan
**And** editing does not automatically regenerate projects — regeneration is a separate explicit action

**Given** I change the goal's status
**When** I select any of Active/Paused/Not now/Someday/Completed/Archived
**Then** the status persists
**And** setting a goal to Paused removes its linked projects from the Engage view without deleting them

**Given** I delete a goal
**When** I confirm the destructive action in a confirmation dialog
**Then** all linked projects and actions are archived (soft delete), retained in the store, and remain available in exports

### Story 4.3: Project Detail, Edit & Regeneration

As a signed-in user,
I want to view, edit, and optionally regenerate a single project,
So that I can refine the plan without disturbing my other projects.

**Acceptance Criteria:**

**Given** a project detail view
**When** it renders
**Then** it shows the project name, parent-goal breadcrumb, and status badge
**And** Purpose and Successful Outcome are shown as collapsible sections

**Given** an AI-generated project
**When** I edit it
**Then** I can change the name, purpose, successful outcome, and action list

**Given** a project status
**When** I change it
**Then** I can set Active/Paused/Completed/Archived
**And** completing all actions does not auto-complete the project — I confirm completion explicitly

**Given** I regenerate a project
**When** I trigger "Regenerate project"
**Then** a confirmation modal appears before overwriting
**And** on confirm, only this project's AI content is replaced — other projects in the goal are untouched

### Story 4.4: Action Management & Context Tags

As a signed-in user,
I want to add, edit, delete, reorder, and tag the actions in a project,
So that the action list reflects the real work.

**Acceptance Criteria:**

**Given** a project's action list
**When** it renders
**Then** each action shows text, status (available/committed/done), and any context-tag chips

**Given** action management
**When** I operate on actions
**Then** I can add via an inline field, edit text, delete, and reorder actions within the project

**Given** context tags (in scope for v1)
**When** I tag an action
**Then** I can attach optional @energy / @location / @tool tags stored in `context_tags`
**And** tags are optional — an untagged action is valid

**Given** the ActionItem states
**When** rendered
**Then** Available uses a default border, Committed uses primary border + primary-subtle background (unmistakable as the single next action), and Done uses line-through + muted text + checked checkbox

### Story 4.5: Commit a Single Next Action & Stuck Detection

As a signed-in user,
I want exactly one committed next action per project and clear flagging when a project has none,
So that I always know the one thing to do next and no project silently stalls.

**Acceptance Criteria:**

**Given** an available action
**When** I commit it
**Then** it becomes the project's committed action and any previously committed action on that project is decommitted
**And** this single-committed rule is enforced by the `fn_commit_action` database trigger, not only in the UI

**Given** I complete a committed action
**When** I mark it done
**Then** I am prompted to select the next committed action from the project's remaining available actions

**Given** a project that is Active with zero committed actions
**When** it is rendered anywhere
**Then** it shows the amber stuck indicator ("No committed next action — this project is stuck." + "Commit one now")
**And** the indicator uses `role="alert"` and is never hidden or rendered quietly

## Epic 5: The GTD Loop — Inbox, Engage & Reviews

A signed-in user can run the full GTD reflect-and-engage loop: capture to the inbox, engage with committed actions, run a guided three-phase weekly review bookended by weekly snapshots, and run a prompted monthly goal check. Review progress persists to Supabase.

**Relevant UX-DRs:** UX-DR15 (inbox), UX-DR16 (engage), UX-DR17 (review shell + phase bar), UX-DR18 (weekly snapshot), UX-DR19 (three phases), UX-DR20 (monthly check), UX-DR22 (modal/toast), UX-DR24 (accessibility).

### Story 5.1: Frictionless Inbox Capture

As a signed-in user,
I want to capture raw thoughts instantly from anywhere,
So that nothing gets lost while I'm working.

**Acceptance Criteria:**

**Given** the Inbox view
**When** it loads
**Then** an auto-focused single text input accepts raw text with no required classification
**And** pressing Enter or clicking "Capture" saves the item

**Given** any authenticated view
**When** I press `C` or tap the floating capture button
**Then** a capture drawer opens with the text field focused, without navigating away

**Given** captured items
**When** the list renders
**Then** each row shows raw text, a capture timestamp, and Process/Delete controls
**And** items unprocessed for more than 7 days show an amber "Unprocessed for 7+ days" flag

### Story 5.2: Inbox Processing (Clarify)

As a signed-in user,
I want to process each inbox item into the right place,
So that my inbox reaches zero and everything actionable is captured as work.

**Acceptance Criteria:**

**Given** an inbox item
**When** I click "Process"
**Then** an inline flow asks "Is this actionable?" (Yes / No)

**Given** an actionable item
**When** I choose the path
**Then** "< 2 minutes" offers "Do it now" (marks done, no project needed), and "≥ 2 minutes" lets me assign it to an existing project or create a new project
**And** assigning links the item to a project via `resolved_project_id` and marks it processed

**Given** a non-actionable item
**When** I choose the path
**Then** I can Trash it, send it to Someday/Maybe, or mark it Reference

**Given** processing progress
**When** an item is resolved
**Then** its `processing_status` and `processed_at` are updated accordingly

### Story 5.3: Engage View — Committed Actions & Next-Action Prompting

As a signed-in user,
I want a view of only my committed next actions,
So that I know exactly what to do today and no project goes stuck after I finish something.

**Acceptance Criteria:**

**Given** the Engage view
**When** it renders
**Then** it shows only committed next actions across all Active, non-Paused goals and projects — not the full action list, a Kanban board, or a project tree
**And** actions are grouped by goal in collapsible groups, each row showing action text, context-tag chips (if present), parent project name, and a Done button

**Given** I complete an action from Engage
**When** I click Done
**Then** the action is marked done and I am immediately prompted "What's next for [project]?" with an inline list of remaining available actions to commit
**And** if no actions remain, I am offered "mark project complete?"

**Given** context tags exist on actions
**When** I use the optional filter bar
**Then** I can filter by @energy / @location / @tool

**Given** a project that is Active with zero committed actions
**When** Engage renders its goal group
**Then** the stuck project appears at the bottom of the group with an amber band and a "Commit one →" CTA

**Given** everything is caught up
**When** Engage renders
**Then** the empty state reads "No committed actions. Open a project and commit one." with no celebration or confetti

### Story 5.4: Weekly Review Shell, Phase Bar & Persistence

As a signed-in user,
I want a guided weekly review whose progress is saved,
So that I can complete the review in order and resume it if I step away.

**Acceptance Criteria:**

**Given** I start a weekly review
**When** the shell loads
**Then** a phase bar shows five beats — Snapshot (open) → Get Clear → Get Current → Get Creative → Snapshot (close) — with the two snapshot beats visually distinct as bookends
**And** the active beat fills primary, completed beats fill emerald, upcoming are gray
**And** I cannot skip a phase

**Given** a review in progress
**When** I leave mid-review and return
**Then** my phase position and entered data are restored (a `review_sessions` row is created at start and updated on each phase transition)

**Given** the review is not timed
**When** I take as long as I need
**Then** no timer or time limit is imposed

**Given** a phase transition
**When** it occurs
**Then** the new phase name is announced to screen readers

### Story 5.5: Weekly Snapshot — Opening & Closing (Closed Loop)

As a signed-in user,
I want to record what moved last week and what matters next,
So that my system carries honest context from one week to the next.

**Acceptance Criteria:**

**Given** the opening snapshot
**When** a review begins
**Then** the header shows the auto-calculated "Week N · [Mon dd] – [Sun dd]"
**And** the previous week's closing snapshot is shown read-only under "Last week you said:" (if one exists)
**And** a required free-text prompt "What actually moved last week? What didn't?" must be filled (non-empty) before "Start review →" advances

**Given** the closing snapshot at the end of Get Creative
**When** it renders
**Then** two required fields appear: "What matters most this coming week?" and "What's the main thing that could derail it?"
**And** both fields are `aria-required`, and an empty field blocks completion with inline validation

**Given** I complete the review
**When** I click "Complete review"
**Then** the review is marked complete, a `weekly_snapshots` row is written (week number, date range, opening retrospective, closing intention, closing blocker), the sidebar shows "Last review: today", and I am returned to Engage
**And** the closing fields become the "Last week you said:" display at the next review's opening

### Story 5.6: Weekly Review Phases — Get Clear, Get Current, Get Creative

As a signed-in user,
I want each review phase to surface exactly what I need to act on,
So that I finish the review with a clean inbox and no stuck projects.

**Acceptance Criteria:**

**Given** Get Clear
**When** the phase runs
**Then** it offers a brain-dump capture (to inbox) then walks me through processing the inbox one item at a time
**And** the phase completes only when the inbox count reaches zero

**Given** Get Current
**When** the phase runs
**Then** each Active project surfaces one at a time showing name, committed action (or stuck indicator), and last-updated date
**And** for each I must confirm the committed action, commit a new one, or change status (Paused/Someday/Archived)
**And** I cannot advance past a stuck project without resolving it
**And** the phase completes when all Active projects have been reviewed

**Given** Get Creative
**When** the phase runs
**Then** I review each Someday/Maybe item (activate / delete / keep), capture "anything missing?" to the inbox, and run a goal-alignment check across Active goals
**And** the phase does not complete until the closing snapshot (Story 5.5) is filled in

**Given** the review completion gate
**When** I attempt to finish
**Then** completion is blocked until all inbox items are processed and every Active project has either a committed action or a changed status

### Story 5.7: Monthly Goal Check (Prompted & Manual)

As a signed-in user,
I want a per-goal monthly check that reminds me when a goal is overdue for review,
So that goals stay relevant and none quietly drift.

**Acceptance Criteria:**

**Given** the monthly goal check flow at `/app/review/monthly/[goalId]`
**When** it runs for a goal
**Then** it is distinct from the weekly review and asks "Is this goal still relevant?" (Yes / No / Changed)
**And** offers a status selector (Active/Paused/Not now/Someday/Completed/Archived) that I can change directly
**And** lists linked projects with status badges and a stuck count
**And** prompts "Missing project?" (is a priority gap unlinked?) and "Overloaded?" (pause any Active project?)

**Given** the prompt trigger
**When** a goal's `last_checked_at` is 30+ days ago
**Then** an in-app prompt surfaces the monthly check for that goal (no push notification)
**And** the check can also be triggered manually from goal detail
**And** completing the check updates `last_checked_at`

**Given** completion
**When** I finish a goal's check
**Then** it completes per-goal with no achievement event or streak

## Epic 6: Data Portability & Experimental Vault

A signed-in user can export all their data on demand, and any visitor can use the experimental client-side encrypted vault to save, restore, and carry breakdowns across devices. All vault operations are client-side only and independent of Supabase.

**Relevant UX-DRs:** UX-DR23 (vault UI), UX-DR22 (modal/confirmations), UX-DR24 (accessibility).

### Story 6.1: On-Demand Data Export

As a signed-in user,
I want to export all my data in a portable format,
So that I own my data and can recover it independently of the backend.

**Acceptance Criteria:**

**Given** the export control
**When** I request an export
**Then** a portable file (JSON and/or Markdown) is produced containing goals, projects, actions, and review history

**Given** archived items
**When** the export runs
**Then** archived goals and projects are retained in Supabase and included in the export

**Given** export integrity
**When** I inspect the file
**Then** every item present in the data store appears in the export (no silent omissions)

### Story 6.2: Vault Unlock & Auto-Save

As a user,
I want a passphrase-protected local vault that saves my breakdowns,
So that I can keep an encrypted history in my own browser with no account required.

**Acceptance Criteria:**

**Given** the header lock icon
**When** I click it
**Then** the vault view opens regardless of whether I am signed in

**Given** a locked vault
**When** I enter my passphrase
**Then** the vault decrypts and shows saved breakdowns
**And** encryption uses the Web Crypto API (AES-GCM + PBKDF2); the passphrase is never stored

**Given** a successful generation while the vault is unlocked
**When** the breakdown is produced
**Then** it is auto-saved silently to the vault (input text, mode, generation timestamp, generated markdown)
**And** if the vault is locked, a dismissible "Vault locked — breakdown not saved. [Unlock →]" notice is shown

**Given** the vault modules
**When** inspected
**Then** `lib/vault/` never imports from `lib/supabase/` and all operations run client-side with no server transmission

### Story 6.3: Vault Management — Restore, Delete, Clear, Export/Import

As a user,
I want to manage my saved breakdowns and move the vault between files,
So that I control my saved history.

**Acceptance Criteria:**

**Given** a saved breakdown
**When** I act on it
**Then** I can restore it to the output panel or delete it individually

**Given** the whole vault
**When** I choose "Clear all"
**Then** a confirmation dialog appears before the vault is cleared

**Given** vault transfer
**When** I export
**Then** the vault is written to a downloadable JSON file
**And** importing a previously exported JSON file restores/merges its entries

### Story 6.4: Portable Identity Link & QR

As a user,
I want a portable-identity link and QR code to open my vault on another device,
So that I can access my encrypted history without an account or server.

**Acceptance Criteria:**

**Given** an unlocked vault
**When** I choose to reveal the portable identity
**Then** a security-warning modal is shown first, explaining that the link/QR grants vault access and should be stored securely

**Given** I proceed past the warning
**When** the portable identity is revealed
**Then** a link carrying the unlock key in the URL fragment and a client-side-rendered QR code are shown

**Given** the app is opened via a portable-identity link
**When** it loads
**Then** vault access is reconstructed without a password prompt
**And** the key material is scrubbed from the browser address bar and history immediately after processing

**Given** all portable-identity operations
**When** performed
**Then** they occur entirely client-side with no server involvement
