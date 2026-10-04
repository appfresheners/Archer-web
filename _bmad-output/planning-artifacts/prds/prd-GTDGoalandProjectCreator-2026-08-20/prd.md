---
title: "Archer — GTD Goal & Project Creator PRD"
status: draft
created: 2026-08-20
updated: 2026-10-04
project: GTDGoalandProjectCreator
version: v1-full
---

# Archer — Product Requirements Document

## 1. Overview

Archer is a personal productivity system that takes a user from goal to daily committed action in a single, opinionated tool. It combines GTD (David Allen) with Reverse Goal Setting (Justin Sung) to close the gap between setting a goal and knowing exactly what to do today.

**Core thesis:** The multi-tool productivity stack — a goal in one app, projects in another, tasks in a third — creates a fragmented data model with no enforced connection between them. The weekly review that keeps GTD alive never happens because synchronising everything costs more time than the work itself. Archer eliminates the stack. Goal, gap analysis, projects, actions, and weekly review all live in one place, enforced by one data model, with nothing to synchronise.

**What Archer is not:** An AI assistant. A Notion template. A task manager. A goal tracker. Archer is a system — opinionated by design — that enforces the distinction between a goal, a project, and a next action so the user never has to maintain that distinction manually.

**Current build state:** The AI generation layer (goal/project breakdowns via `/api/generate`) is built and functional. Auth is not yet built — all generation currently requires manual env var configuration. The full system described in this PRD — Supabase Auth (email + password), goal creation wizard with interactive gap analysis, user-owned next action commitment, weekly review UI, inbox capture, full data persistence — remains to be built. **There is no unauthenticated generation path in v1. All generation requires auth and saves to Supabase automatically. Copy Markdown and Download .md actions are removed from the product.**

**Primary user:** Mthizo (solo builder and primary user). Commercial expansion is a future decision.

---

## 2. Goals & Success Metrics

| Goal                    | Metric                                                     | Target                    |
| ----------------------- | ---------------------------------------------------------- | ------------------------- |
| Goal → committed action | Time from new goal to first committed next action          | < 10 minutes              |
| Review completion       | Weekly review completed without abandoning midway          | > 90% of weeks            |
| System integrity        | Active projects with zero committed next actions ("stuck") | 0 at end of weekly review |
| Generation quality      | AI output requires full regeneration (not just editing)    | < 20% of runs             |
| AI reliability          | Successful generation rate (non-timeout, non-error)        | ≥ 95%                     |
| Data safety             | Breakdowns lost due to storage or export failure           | 0                         |

**Counter-metrics:** Completion rate of the gap analysis is not a success metric — users who abandon it are not ready to commit to the goal, and the system does not attempt to recover them. Re-engagement flows and nudge systems are out of scope. The product serves users who are serious; it does not manufacture seriousness.

---

## 3. Target User

**Primary user (current):** Mthizo — solo builder, GTD practitioner, primary user of the system.

**Target user (when opened to others):** Young professional balancing work and personal life. Already motivated to use GTD — not trying to be converted. Currently fragmented across Notion + Todoist + ChatGPT. Pain: the tools don't talk to each other, the weekly review never happens, goals accumulate incomplete projects. Serious about getting things done; not interested in productivity as a hobby.

No personas section — the UX design contract carries named protagonists (Thembi, Sipho) in key flows.

---

## 4. The GTD Loop — System Overview

Archer implements the full GTD loop. Every feature group below maps to a phase of this loop.

```
Capture → Clarify → Organize → Reflect → Engage
```

- **Capture:** Inbox — frictionless raw input, no classification required at entry
- **Clarify:** Goal creation wizard (gap analysis + AI generation); project and action review
- **Organize:** Goal → Project → Action hierarchy, enforced by the data model
- **Reflect:** Weekly review (Get Clear / Get Current / Get Creative) + Monthly goal check (separate flow)
- **Engage:** Daily action view — committed next actions across active projects

---

## 5. Functional Requirements

### FR-Group: Goal Creation Wizard [NOT YET BUILT]

> Goal creation is a multi-step guided wizard. The wizard is the mechanism that grounds AI output in the user's actual situation. Each step must be completed in sequence before the AI generates a breakdown. Abandoning the wizard does not create a goal.
>
> **Relationship to the existing `/api/generate` route:** The current route accepts a plain-text goal and returns a full breakdown — this was the pre-wizard approach. In the wizard flow, generation (Step 4) calls an updated or new endpoint that accepts structured gap inputs, not raw text alone. The existing route is retained for Project Mode (see FR-Group: Project Mode Generation).

**FR1:** Goal creation SHALL use a wizard stepper with four sequential steps:

1. **Goal & Skill Framework** — user states their goal; AI proposes the skill/attribute framework
2. **Gap Rating** — user rates themselves against each item; user may add their own
3. **Drivers & Barriers** — user identifies internal strengths and real obstacles
4. **Review & Generate** — summary of all inputs; AI generates projects and actions on confirmation

**FR2:** The wizard stepper SHALL show the user which step they are on and how many remain. Completed steps SHALL be visually distinguishable from the current and upcoming steps.

**FR3:** The user SHALL be able to navigate back to a previous step to correct inputs. Returning to a prior step does not discard later inputs unless the user explicitly changes something that invalidates them (e.g. changing the goal text regenerates the skill framework).

**FR4:** Abandoning the wizard midway SHALL NOT create a goal. No auto-save of partial wizard state. No nudge or recovery flow. Seriousness of intent is a precondition.

**FR5:** The goal text input SHALL accept free-text up to 500 characters (UI-enforced). A 2,000-character server-side safety cap applies.

**FR6:** Submitting an empty or whitespace-only goal text SHALL be blocked with inline validation before the wizard advances from Step 1.

#### Step 1 — Goal & Skill Framework

**FR7:** On goal text submission in Step 1, the app SHALL call the AI to propose a skill/attribute framework for the stated goal: the skills, habits, and resources that someone who achieves this goal easily typically has, with required level ratings (1–10) and goal-specific descriptions for each item.

**FR8:** The skill framework SHALL be returned before the user can advance to Step 2. A loading state SHALL be shown during this AI call.

**FR9:** The user SHALL be able to review the proposed framework, remove items they consider irrelevant, and add their own items not proposed by the AI, before advancing to Step 2.

#### Step 2 — Gap Rating

**FR10:** For each item in the confirmed framework, the user SHALL rate their current level (1–10). The gap is calculated as: Gap = Required − Current. The gap SHALL be shown live as the user rates.

**FR11:** The AI SHALL NOT infer or pre-fill the user's current ratings. All ratings come from the user.

**FR12:** The user MAY add their own skill/attribute items in this step if they identify a relevant gap not in the framework.

#### Step 3 — Drivers & Barriers

**FR13:** The user SHALL identify at least one Driver (an internal strength already working for them) and at least one Barrier (what actually gets in the way). These are free-text entries.

**FR14:** The AI SHALL NOT infer Drivers or Barriers from the goal text or gap ratings. All content in this step is user-entered.

**FR15:** The user SHALL provide an if–then plan for their primary barrier: "If [barrier situation], then I will [specific alternative action]."

#### Step 4 — Review & Generate

**FR16:** Step 4 SHALL display a summary of all inputs from steps 1–3 before generation is triggered. The user can return to any previous step to make corrections.

**FR17:** On confirmation, the app SHALL call the AI generation endpoint with the full structured inputs: goal text, confirmed skill framework with required levels and user ratings, drivers, barriers, and if–then plan.

**FR18:** The AI SHALL produce a complete Reverse Goal Setting + GTD breakdown containing all of:

1. 3-Month Goal statement (user's goal text, target date calculated as 3 months from today)
2. Success criteria — specific, measurable outcomes (3 items minimum)
3. Target Profile — confirmed skill framework with required levels and goal-specific descriptions
4. Current Profile — same items with user's ratings and calculated gaps (Gap = Required − Current)
5. Drivers, Resources, Barriers — populated verbatim from the user's Step 3 inputs
6. If–then plan — the user's entry verbatim
7. Priority gaps (2–3) — items with highest required level AND widest gap, each linked by name to a project below
8. 5–6 outcome-named GTD projects rendered as HTML accordions (`<details>/<summary>`), each containing: Purpose (3–4 sentences), Successful Outcome (2–3 sentences), 12 micro next actions
9. Monthly Goal Check section

**FR19:** The first two projects SHALL be the ones that close Priority 1 and Priority 2 gaps. Their names SHALL match exactly the linked project names stated in the Priority gaps section above them.

**FR20:** All AI-generated content SHALL be specific to the user's goal and gap inputs — real tools, real websites, real resources. Generic filler is a quality failure.

**FR21:** All generated next actions SHALL follow GTD rules:

- Begin with a physical verb (Open, Navigate, Click, Type, Create, Save, Search, Read, Write, Complete, Download, Install, Watch, Record, Schedule)
- Reference a specific real tool, app, website, or location
- Be completable in 2–5 minutes

**FR22:** The generation request SHALL time out after 30 seconds with a user-facing error and a retry option.

**FR23:** A loading state SHALL be shown during generation with copy appropriate to the wait: "Generating your GTD breakdown…"

**FR24:** If generation fails (timeout or provider error), the wizard SHALL remain at Step 4 with the user's inputs intact so they can retry without re-entering anything.

### FR-Group: Project Mode Generation [AUTH REQUIRED — SAVES TO SUPABASE]

> Project Mode is a single-shot project breakdown. The user enters a project description and the AI generates a complete GTD project breakdown using Allen's Natural Planning Model. Auth is required — output saves directly to Supabase on generation. No copy/download buttons.

**FR25:** Project Mode SHALL present a single text input with placeholder: "e.g., Personal portfolio website deployed online"

**FR26:** The input SHALL accept free-text up to 500 characters (UI-enforced). A 2,000-character server-side safety cap applies.

**FR27:** Submitting empty or whitespace-only input SHALL be blocked with inline validation.

**FR28:** The user SHALL be able to submit via Enter key or Generate button.

**FR29:** On valid submission, the app SHALL POST to `/api/generate` and the AI SHALL produce:

1. Project name as heading
2. Purpose (3–4 sentences)
3. Successful Outcome (2–3 sentences)
4. Exactly 12 specific, sequenced micro next actions following GTD rules (FR21)

**FR30:** A loading state SHALL be shown during generation. The request SHALL time out after 30 seconds with a user-facing error.

**FR31:** On successful generation, the project breakdown SHALL be saved automatically to Supabase as a new `projects` row linked to the signed-in user. No copy or download action is shown.

**FR93:** Project Mode SHALL offer AI generation (the default) or manual project creation. Manual creation SHALL persist a project without making an AI request and navigate to its detail view.

### FR-Group: AI Provider

**FR32:** The app SHALL support three AI providers selected via `AI_PROVIDER` environment variable: `gemini` (default), `groq`, `openai`.

**FR33:** Gemini SHALL be the default and recommended provider (`gemini-3.1-flash-lite`). Free tier via Google AI Studio — sufficient for the wizard's two-call flow (Step 1 framework + Step 4 full breakdown) for a solo user.

**FR34:** Each provider SHALL use a configurable model via environment variable (`GEMINI_MODEL`, `GROQ_MODEL`, `OPENAI_MODEL`). No hardcoded fallbacks — the model env var must be set. Defaults: `gemini-3.1-flash-lite`, `llama-3.1-8b-instant`, `gpt-4o-mini`.

**FR35:** API keys SHALL be configured via environment variables only (`.env.local`). No in-app key entry UI.

**FR36:** If the AI provider returns an error, the app SHALL surface a clear, actionable error message including guidance for API key misconfiguration.

### FR-Group: Output Display

**FR37:** Generated output SHALL render as formatted HTML using `react-markdown` with `remark-gfm` and `rehype-raw` (required for `<details>/<summary>` accordion rendering).

**FR38:** The output panel SHALL be hidden until first generation and appear with a subtle fade-in (respecting `prefers-reduced-motion`).

**FR39:** After generation, the viewport SHALL smooth-scroll so the top of the output panel is visible.

### FR-Group: Auth

**FR40:** The app SHALL require authentication for ALL features including Project Mode generation. There is no unauthenticated access path. Supabase Auth with email + password is the auth provider.

**FR41:** On sign-in, the user's goals, projects, actions, inbox items, and review history SHALL be loaded from Supabase and restored to their last known state.

**FR42:** Sign-in and sign-up SHALL use email + password only. No magic link, no OAuth providers in v1.

**FR43:** Password reset SHALL be available via a "Forgot password" link on the sign-in page, handled by Supabase Auth email flow.

### FR-Group: Goal Management [NOT YET BUILT]

**FR44:** A user SHALL be able to create, view, edit, and delete goals. Creation uses the Goal Creation Wizard (FR1–FR24).

**FR45:** Editing a goal SHALL allow changes to: goal statement, target date, skill framework ratings, drivers, barriers, and if–then plan. Editing ratings or goal text SHALL not automatically regenerate projects — the user triggers regeneration explicitly.

**FR46:** Deleting a goal SHALL archive all linked projects and actions. Archived items are not permanently deleted — they are hidden from active views but retained in the data store and included in exports.

**FR47:** Each goal SHALL have a status: Active, Paused, Not now, Someday, Completed, or Archived.

**FR48:** Changing a goal's status to Paused SHALL remove its linked projects from the Engage view without deleting them.

### FR-Group: Project Management [NOT YET BUILT]

**FR49:** Each project SHALL have: a name (outcome-based), a purpose, a successful outcome (definition of done), a status (Active, Paused, Completed, Archived), and an optional parent goal. A newly created project SHALL default to Paused across manual creation, standalone AI Project Mode, and goal-generated creation. The user activates the project when ready; existing project statuses are unchanged.

**FR50:** A user SHALL be able to edit any part of an AI-generated project: name, purpose, successful outcome, and action list.

**FR51:** A user SHALL be able to regenerate the AI output for a specific project without affecting other projects in the same goal. Regeneration replaces only the explicitly regenerated project.

**FR52:** Completing all actions in a project does not automatically mark the project complete — the user confirms completion explicitly.

**FR94:** A user SHALL be able to set, change, or clear a project's parent goal from project detail, and attach an existing project from goal detail. Each project has at most one parent goal.

**FR95:** The Projects view SHALL support filtering by all projects, a selected goal, or projects with no goal.

### FR-Group: Focus Horizons & Areas of Focus

**FR96:** A user SHALL be able to create, view, and edit one personal Focus profile containing an optional Vision statement, Purpose statement, and Principles list. These fields are context, not dated goals or completable projects.

**FR97:** A user SHALL be able to create, view, edit, reorder, and archive Life Areas of Focus. Each Area SHALL have a name and may have a description. Areas SHALL NOT have a Completed status.

**FR98:** A Goal MAY be linked to one Life Area. An Area may be archived but not completed; existing Goal and Project records retain their current status and meaning.

**FR99:** A Project MAY be linked to a Goal or, when it has no Goal, directly to one Life Area. A Project linked to a Goal SHALL inherit its Area through that Goal and SHALL NOT store a conflicting direct Area assignment.

**FR100:** The authenticated app SHALL provide a Focus view where a user can manage their Focus profile and Areas and see linked Goals and Projects.

**FR101:** The Get Creative phase of the weekly review SHALL offer an optional Focus review entry point. Skipping it SHALL NOT block phase progression or review completion.

### FR-Group: Action Management [NOT YET BUILT]

**FR53:** Each action SHALL have: text (verb-first), status (available, committed, done), and a parent project.

**FR54:** A user SHALL be able to mark one action per project as their committed next action. Only one action per project can be committed at a time.

**FR55:** Completing a committed action SHALL prompt the user to select the next committed action from that project's remaining available actions.

**FR56:** Actions MAY carry optional context tags (@energy, @location, @tool) for filtering in the Engage view. Tags are optional and user-defined — not required at action creation.

**FR57:** A user SHALL be able to add, edit, delete, and reorder actions within a project.

### FR-Group: Stuck Project Detection [NOT YET BUILT]

**FR58:** A project is "stuck" when it is Active status and has zero committed next actions.

**FR59:** Stuck projects SHALL be surfaced visibly in the Engage view and flagged explicitly during the weekly review. They SHALL NOT be silently hidden or treated as normal active projects.

**FR60:** The weekly review (Get Current phase) SHALL not allow the user to proceed past a stuck project without either: committing a next action to it, or changing its status to Paused/Someday.

### FR-Group: Inbox (Capture) [NOT YET BUILT]

**FR61:** A frictionless inbox SHALL accept raw text capture with no required classification. No project assignment, no context tag, no AI processing is required at capture time.

**FR62:** Inbox items SHALL be processed during the Clarify step: is it actionable? If yes — takes < 2 minutes (do it now) or assign to a project/create a new project. If no — trash, someday/maybe, or reference.

**FR63:** The weekly review (Get Clear phase) SHALL guide the user through processing the inbox to zero. Inbox items unprocessed for more than 7 days SHALL be flagged.

**FR64:** Inbox capture SHALL be accessible from any view in the app without navigating away — a persistent capture affordance (keyboard shortcut or floating button).

### FR-Group: Engage View (Daily Actions) [NOT YET BUILT]

**FR65:** The Engage view SHALL show only the committed next actions across all active, non-paused goals and projects — not the full action list, not a Kanban board, not a project tree.

**FR66:** The Engage view SHALL support optional filtering by context tag when actions have been tagged.

**FR67:** Completing an action from the Engage view SHALL immediately prompt the user to select the next committed action from that project, so the project never silently goes stuck.

**FR68:** The Engage view SHALL indicate stuck projects (active, zero committed next action) clearly, with a direct path to commit an action or pause the project.

### FR-Group: Weekly Review [NOT YET BUILT]

**FR69:** The weekly review SHALL follow GTD's three-phase structure in order:

1. **Get Clear** — process inbox to zero, capture anything still in head
2. **Get Current** — review every active project: confirm committed next action, flag stuck projects, update statuses
3. **Get Creative** — review Someday/Maybe list, check goal alignment, identify anything missing

**FR70:** The weekly review SHALL be guided — the UI surfaces the relevant data for each phase rather than presenting a blank page. The user is walked through each step in sequence.

**FR71:** The weekly review SHALL have no time limit. It is structured but not timed.

**FR72:** The weekly review SHALL NOT allow completion until all inbox items are processed and all active projects have either a committed next action or a changed status (Paused/Someday).

**FR73:** Weekly review progress SHALL be preserved if the user leaves mid-review and returns.

**FR74:** A timestamp of the last completed weekly review SHALL be visible in the app.

### FR-Group: Monthly Goal Check [NOT YET BUILT — separate flow from weekly review]

**FR75:** The monthly goal check SHALL be a distinct UI flow (not part of the weekly review). It walks the user through each active goal and asks: Is this goal still relevant? What is its current status?

**FR76:** The monthly goal check SHALL surface for each goal: linked projects currently active, any stuck projects, whether a missing project is needed to close a priority gap.

**FR77:** The user SHALL be able to change any goal's status directly from the monthly goal check flow.

### FR-Group: Data Persistence [NOT YET BUILT]

**FR78:** All Focus profiles, Life Areas, goals, projects, actions, inbox items, and review history SHALL be persisted to Supabase. No data is lost between sessions.

**FR79:** Data SHALL be backed up by Supabase's built-in backup mechanism. Backup frequency and point-in-time recovery SLA to be confirmed during backend setup (see §8 Open Questions).

**FR80:** The user SHALL be able to export all their data on demand in a portable format (JSON and/or Markdown). Export SHALL include Focus profiles, Life Areas, goals, projects, actions, inbox items, and review history.

**FR81:** Archiving a Focus Area, goal, or project preserves the data in Supabase. Archived data is included in exports.

### FR-Group: Experimental Vault (Saved Breakdowns) [SHIPPED — EXPERIMENTAL]

> The experimental vault uses client-side encryption + localStorage. It predates the Supabase persistence layer and operates independently of it. It remains in the product as an extra feature — it will not be removed when the full persistence layer is built.

**FR82:** A "Saved breakdowns" button in the page header SHALL open the vault view.

**FR83:** The vault SHALL be passphrase-protected. The user must enter a passphrase to unlock before viewing saved breakdowns.

**FR84:** On successful AI generation, the app SHALL automatically attempt to save the breakdown to the local encrypted vault if a session is unlocked. If unlocked session is absent, a dismissible notice SHALL prompt the user.

**FR85:** Each saved breakdown SHALL store: input text, mode, generation timestamp, and generated markdown.

**FR86:** From the vault view, the user SHALL be able to: restore a breakdown to the output panel, delete a single breakdown, clear the entire vault (with confirmation dialog).

**FR87:** The vault SHALL support export to a downloadable JSON file and import from a previously exported JSON file.

**FR88 (Portable Identity):** When the vault is unlocked, the user SHALL be able to reveal a portable identity link and QR code carrying the vault unlock key in the URL fragment. Generated locally — no server involvement.

**FR89:** The portable identity link SHALL be scrubbed from the browser address bar and history immediately after being processed on load.

**FR90:** A security warning SHALL be shown before the portable identity link or QR code is revealed.

**FR91:** All vault operations (encrypt, decrypt, export, import, QR render) SHALL occur entirely client-side. No vault data SHALL be transmitted to any server.

### FR-Group: Markdown Format

**FR92:** All AI-generated markdown SHALL be Notion-optimized:

- `#` / `##` / `###` headings for structure
- `- [ ]` checkboxes for success criteria and action items
- `| pipe |` tables for capability/resource analysis
- `<details>/<summary>` HTML accordions for the Projects section
- Clean line spacing for Notion block separation

---

## 6. Non-Functional Requirements

**NFR1 — Performance:** LCP < 2s on 4G for initial page load. AI generation latency is provider-dependent (typically 5–20s) and covered by the loading state.

**NFR2 — Deployment:** Vercel (Node.js runtime required for the API route). Not a pure static export.

**NFR3 — Responsiveness:** Fully functional across mobile (< 640px), tablet (640–1024px), and desktop (> 1024px).

**NFR4 — Accessibility:** WCAG 2.1 Level AA:

- Full keyboard navigation including wizard step navigation
- Screen reader support (ARIA roles, live regions, focus management between wizard steps)
- Minimum 44×44px touch targets
- 4.5:1 contrast ratio for body text, 3:1 for large text
- Respect `prefers-reduced-motion`

**NFR5 — Browser support:** Latest two versions of Chrome, Firefox, Safari, and Edge.

**NFR6 — Privacy:** No cookies, analytics, tracking, or data collection. The only outbound network requests are: AI generation calls to the configured provider, and Supabase read/write for authenticated users. All vault operations are client-side only.

**NFR7 — Security (vault):** Vault data encrypted with Web Crypto API (AES-GCM, PBKDF2 key derivation) before localStorage persistence. Passphrase never stored. Portable identity key material scrubbed from address bar immediately after processing.

**NFR8 — Error resilience:** Missing or invalid API key produces a clear, actionable error with provider key issuance link. Generation timeout surfaces a retry option, not a silent failure. Wizard retains inputs on generation failure.

**NFR9 — Data integrity:** No data loss on browser reload, crash, or session end (Supabase persistence). Export integrity: every item in the data store is present in the export file.

---

## 7. Technical Constraints

| Constraint    | Decision                                                                 |
| ------------- | ------------------------------------------------------------------------ |
| Framework     | Next.js 16 (App Router, Node.js runtime)                                 |
| Styling       | Tailwind CSS v4                                                          |
| Rendering     | react-markdown + remark-gfm + rehype-raw                                 |
| Hosting       | Vercel (free tier)                                                       |
| Backend / DB  | Supabase (Postgres + Realtime + Storage)                                 |
| Auth          | Supabase Auth — email + password only. No OAuth in v1.                   |
| AI (default)  | Google Gemini (`gemini-3.1-flash-lite`, free tier)                       |
| AI (alt)      | Groq (`llama-3.1-8b-instant`) / OpenAI (`gpt-4o-mini`)                   |
| Vault crypto  | Web Crypto API — AES-GCM + PBKDF2 (experimental vault, client-side only) |
| QR generation | `qrcode` library, client-side SVG render only                            |
| Analytics     | None                                                                     |

> **Architecture note:** All generation requires auth. There is no unauthenticated generation path. All output saves to Supabase automatically on generation. Copy Markdown and Download .md actions are removed from the product entirely.

---

## 8. Open Questions

1. **Supabase schema** — the architecture spine defines the six GTD tables plus `focus_profiles` and `areas_of_focus`; migrations and RLS implementation remain to be applied and verified.

2. **Backup / point-in-time recovery** — Supabase free tier has limited PITR. Manual export (FR80) is the acknowledged substitute at this stage. Acceptable recovery window not formally confirmed.

3. **Generation API contract** — RESOLVED. One `/api/generate` route handles all patterns. Project Mode accepts `{ mode: 'project', input, depth, area_id? }`; Goal framework generation remains `{ mode: 'goal', step: 'framework', goal }`; Goal generation accepts `{ mode: 'goal', step: 'generate', goal, framework, ratings, drivers, barriers, ifThen, area_id? }`. Area IDs are association metadata, validated for ownership before provider calls, and not added to the AI prompt. Goal-generated Projects inherit the Goal's Area.

4. **Context tags scope for v1** — FR56 lists `@energy`, `@location`, `@tool` as optional. Confirm in v1 or explicitly defer. Schema column (`context_tags text[]`) is ready.

5. **Monthly goal check trigger** — manually triggered only, or also calendar-prompted after 30 days?

6. **Groq model quality** — `llama-3.1-8b-instant` suitability for the two-call wizard flow (framework + full breakdown) needs evaluation before wizard ships.

---

## 9. Scope

### Built (current state)

- AI-powered GTD breakdown via `/api/generate` — single-shot, plain text input (will be superseded by wizard for Goal Mode; auth required before use)
- Multi-provider AI support (Gemini `gemini-3.1-flash-lite` default, Groq, OpenAI)
- Experimental encrypted local vault — save, restore, delete, clear (FR82–FR91)
- Vault export / import (JSON)
- Portable identity — cross-device vault access via URL fragment + QR

### To be built (v1 completion)

- Supabase Auth — email + password sign-in, sign-up, password reset (FR40–FR43)
- Goal creation wizard with interactive gap analysis (FR1–FR24)
- Supabase backend + schema (FR78–FR81)
- Goal management — create, edit, delete, status (FR44–FR48)
- Project management — edit, regenerate, Paused-by-default creation, status (FR49–FR52)
- Action management — commit, complete, reorder, context tags (FR53–FR57)
- Stuck project detection (FR58–FR60)
- Inbox capture (FR61–FR64)
- Engage view — daily committed actions (FR65–FR68)
- Weekly review UI — three-phase guided flow (FR69–FR74)
- Monthly goal check — separate flow (FR75–FR77)
- Focus Horizons & Areas of Focus — user-level Vision/Purpose/Principles, Life Areas, Goal/Project Area associations, Focus page, and optional Get Creative review (FR96–FR101)
- Data export on demand (FR80)
- Architecture spine initial update ✅ (2026-09-27); Focus/Area extension updated (2026-10-04)

### Explicitly out of scope

- Unauthenticated generation — auth required for all features
- Copy Markdown / Download .md — removed entirely; output persists to Supabase
- Notion API integration
- Calendar integration
- Re-engagement flows, nudge systems, abandonment recovery
- AI inference of gap ratings or barrier content
- AI selection of committed next actions
- Streaming AI responses (generation is single-shot)
- Mobile app (iOS/Android)
- Dark mode
- i18n / multiple languages
- OAuth sign-in (Google, GitHub, etc.) — email + password only in v1
- Pricing model or commercial infrastructure
- Multi-user or team features

---

## 10. Future Vision

Once the v1 system is complete and proven:

- **Streaming responses** — progressive rendering of AI output, reducing perceived generation wait
- **Custom instructions** — user-provided context (role, constraints, timeframe) to tune AI output per goal
- **Notion push** — direct write to a Notion page via the Notion API, eliminating copy/paste
- **Cloud vault sync** — optional encrypted cloud backup (user-owned storage: iCloud, Google Drive) extending the experimental vault beyond a single device
- **Opening to other users** — commercial decision, made only when the system works reliably for the primary user. The combination of GTD enforcement + Reverse Goal Setting gap analysis + user-owned next action commitment + first-class weekly review has no direct competitor.
