---
status: draft
created: 2026-08-20
updated: 2026-10-04
sources:
  - prd: ../../../prds/prd-GTDGoalandProjectCreator-2026-08-20/prd.md
  - gtd-method-reference: ../../../docs/gtd-method-reference.md
  - gtd-project-prompt: ../../../docs/GTD PROJECT & NEXT ACTION GENERATOR PROMPT.md
  - master-goal-prompt: ../../../docs/MASTER GOAL → GTD PROJECT SYSTEM PROMPT.md
  - reverse-template: ../../../docs/Reverse Goal setting template.md
---

# Foundation

- **Form factor:** Web — responsive, mobile-first. Single authenticated layout — all features require sign-in.
- **Tech stack:** Next.js 16 (App Router, Node.js runtime), Tailwind CSS v4, Vercel
- **Auth:** Supabase Auth — email + password. No OAuth in v1.
- **Backend:** Supabase (Postgres + Auth + Realtime)
- **UI system:** Custom lightweight components (no framework). Visual identity: `DESIGN.md`
- **Rendering:** `react-markdown` + `remark-gfm` + `rehype-raw` for generated markdown output

## Layout

Single layout: Fixed 240px left sidebar + main content area (max 720px). All routes require authentication. Unauthenticated visitors land on `/sign-in` automatically.

There is no unauthenticated layout. Project Mode generation, goal creation, and all other features require a signed-in account. All generated output saves automatically to Supabase — there are no copy or download actions.

**Critical constraint — AI does not know the user's level.** This is a system-wide invariant. The AI proposes skill frameworks and required levels based on what a successful person needs for a given goal. It never infers, pre-fills, or estimates the user's current ratings. The user owns all self-assessment data — gap ratings, drivers, barriers, and the if–then plan. Any component or flow that appears to pre-fill user-owned data is a design failure.

---

# Information Architecture

## Surfaces

| Surface                            | Auth required | Purpose                                                                                    | Entry point                                                 |
| ---------------------------------- | ------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Sign-in**                        | No            | Email + password sign-in; "Forgot password" link                                           | Direct `/sign-in`; all unauthenticated routes redirect here |
| **Sign-up**                        | No            | Create account (email + password)                                                          | "Create account" link on sign-in page                       |
| **Generation tool** (Project Mode) | Yes           | Single-shot GTD project breakdown — uses Allen's Natural Planning Model; saves to Supabase | `/app/projects/new`                                         |
| **Goal Creation Wizard**           | Yes           | 4-step guided goal + gap analysis + AI generation                                          | "New goal" CTA                                              |
| **Goals list**                     | Yes           | All goals with statuses; entry to goal detail                                              | Sidebar → Goals                                             |
| **Goal detail**                    | Yes           | Full breakdown: projects, gap analysis, monthly check                                      | Goals list row                                              |
| **Focus**                           | Yes           | Vision, Purpose, Principles, and Life Areas with linked work                               | Sidebar / bottom navigation → Focus                         |
| **Project detail**                 | Yes           | Actions list, edit, regenerate                                                             | Goal detail → project                                       |
| **Inbox**                          | Yes           | Frictionless capture + processing                                                          | Sidebar → Inbox; floating capture button                    |
| **Engage**                         | Yes           | Committed next actions across active goals                                                 | Sidebar → Engage (default post-login view)                  |
| **Weekly Review**                  | Yes           | 3-phase guided review: Get Clear / Get Current / Get Creative                              | Sidebar → Weekly Review                                     |
| **Monthly Goal Check**             | Yes           | Per-goal relevance and status check; separate from weekly review                           | Goal detail or review prompt                                |
| **Vault**                          | No            | Experimental encrypted local storage — auth-independent                                    | Header button                                               |
| **Settings**                       | Yes           | Auth, account management                                                                   | Sidebar footer                                              |

## Site Map

```
/sign-in                        ← all unauthenticated visitors land here
/sign-up
/forgot-password

/app (authenticated shell — sidebar present on all routes below)
├── /app/engage                     ← default post-login view
├── /app/inbox
├── /app/focus                      ← Vision, Purpose, Principles, and Life Areas
├── /app/goals
│   ├── /app/goals/new              ← Goal Creation Wizard
│   └── /app/goals/[id]             ← Goal detail
│       └── /app/goals/[id]/projects/[pid]   ← Project detail
├── /app/projects/new               ← Project Mode (single-shot generation, saves to Supabase)
├── /app/review                     ← Weekly Review
├── /app/review/monthly/[goalId]    ← Monthly Goal Check
└── /app/settings
```

## Content Model

**Goal:** goal text · target date (auto: 3 months from creation) · status (Active / Paused / Not now / Someday / Completed / Archived) · skill framework (items with required levels) · user gap ratings · drivers · barriers · if–then plan · linked projects · creation date

**Project:** outcome-based name · purpose · successful outcome · status (Active / Paused / Completed / Archived; new projects start Paused) · optional parent goal or direct Life Area · action list · creation date

**Focus profile:** one per user · optional Vision · Purpose · Principles list

**Life Area:** name · optional description · display order · archive timestamp · linked Goals or standalone Projects · never completed

**Action:** verb-first text · status (available / committed / done) · optional context tags (@energy / @location / @tool) · parent project

**Inbox item:** raw text · capture timestamp · processing status (unprocessed / processed / trashed)

**Weekly Review session:** start timestamp · end timestamp · phase progress · completion status · opening retrospective (free text) · closing intention (free text) · closing blocker (free text) · week number · week date range

## Focus Page

The authenticated `/app/focus` view is the home for higher-horizon context and ongoing responsibilities. It contains three editable sections: Vision; Purpose and Principles; and Life Areas. Vision, Purpose, and Principles are user-level context and have no status or target date.

Each Life Area row shows its name, optional description, linked Goals, and standalone Projects. Users can create, edit, reorder with keyboard-accessible controls, and archive Areas. Archived Areas are hidden from new assignment pickers but remain visible on existing linked records; Areas have no Completed state.

Goal-linked Projects inherit the Area shown for their Goal and cannot have a second direct Area assignment. A Project with no Goal may link directly to one Area. The Focus page links to existing Goal and Project detail views rather than duplicating their editors.

---

# Voice and Tone

Microcopy is terse, action-oriented, zero-fluff. Mirrors GTD's execution-first philosophy.

| Context                    | Tone                    | Example                                                            |
| -------------------------- | ----------------------- | ------------------------------------------------------------------ |
| Placeholder text           | Inviting, concrete      | "e.g., Personal portfolio website deployed online"                 |
| Generate button            | Direct                  | "Break it down"                                                    |
| Empty state — Engage       | Honest, brief           | "No committed actions. Open a project and commit one."             |
| Empty state — Goals        | Forward                 | "No goals yet. Start one."                                         |
| Inbox empty                | Earned                  | "Inbox zero."                                                      |
| Error — empty input        | Gentle nudge            | "Enter a project first"                                            |
| Error — generation timeout | Clear + actionable      | "Request timed out. Try again."                                    |
| Error — API key missing    | Specific                | "No API key configured. Add GEMINI_API_KEY to .env.local."         |
| Stuck project              | Direct, not alarming    | "No committed next action — this project is stuck."                |
| Weekly review prompt       | Matter-of-fact          | "Last review: 9 days ago."                                         |
| Wizard step advance        | Confirming              | "Framework ready. Rate yourself."                                  |
| Generation loading         | Calibrated to wait      | "Generating your breakdown…"                                       |
| Sign-in nudge (landing)    | Low-pressure            | "Create an account to start with goals and track your work."       |
| Snapshot opening prompt    | Honest, grounding       | "What actually moved last week? What didn't?"                      |
| Snapshot closing prompt 1  | Focused, action-derived | "What matters most this coming week?"                              |
| Snapshot closing prompt 2  | Direct, no softening    | "What's the main thing that could derail it?"                      |
| Snapshot label guidance    | Brief, non-judgemental  | "Be brief and honest. This isn't a report — it's a reality check." |
| Snapshot — previous shown  | Factual, no framing     | "Last week you said:"                                              |

Brand voice (personality) lives in `DESIGN.md` Brand & Style.

---

# Component Patterns

Behavioral specs only — visual appearance in `DESIGN.md`.Components.

## Mode Toggle

Not used for unauthenticated/authenticated switching — there is no unauthenticated mode. Used in authenticated views where a segmented control is needed (e.g. filtering project statuses, toggling between list and detail view modes).

## Text Input (Project Mode generation)

- Single large input. Placeholder: "e.g., Personal portfolio website deployed online"
- Submit on Enter key (in addition to button).
- Input trimmed on submit; empty blocked with inline validation.
- 500-character UI limit; 2,000-character server-side cap.
- Character count shown when input > 400 characters.

## Generate Button

- Label: "Break it down"
- Disabled + `aria-disabled` when input is empty.
- On submit: transitions to loading state — spinner replaces icon, label becomes "Generating…", button disabled.
- 30-second timeout → error toast with retry.

## Output Panel (Project Mode)

Project Mode generates a single GTD project breakdown using Allen's Natural Planning Model. The output structure is:

1. **Project name** — outcome-based (describes a finished result, not an activity)
2. **Purpose** — why this project matters; what completing it enables (3–4 sentences)
3. **Principles** — the standards and values that must be upheld while executing this project (2–3 constraints: quality bars, ethical lines, working style requirements)
4. **Successful Outcome** — what "done" looks like in observable, real-world terms (2–3 sentences)
5. **Next Actions** — exactly 12, verb-first, specific tool/app/location references, 2–5 minutes each, sequenced

Output panel behavior:

- Hidden until first generation; appears with opacity fade-in (respects `prefers-reduced-motion`).
- Renders via `react-markdown` + `rehype-raw`.
- JetBrains Mono for the generated content body.
- On successful generation, the breakdown saves automatically to Supabase and the user is navigated to the new Project detail view. No copy or download actions.
- "Start over" link clears input + output, returns focus to input.
- "Try an example" below input pre-fills and auto-generates.

## Goal Creation Wizard

Four sequential steps. Cannot skip forward. Can navigate back (prior inputs preserved unless goal text changes, which invalidates the framework and requires re-generation of Step 1 output).

### Wizard Step 1 — Goal & Skill Framework

- Large text input for goal (500-char limit with counter).
- "Continue" submits goal text → POST to AI endpoint → loading state ("Building your framework…").
- On response: skill framework renders as a reviewable list. Each item shows: skill name, required level chip, goal-specific description.
- User can: remove irrelevant items (× button), add their own (inline "Add item" field at bottom).
- "Next: Rate yourself →" advances to Step 2 only when at least 3 items remain.

### Wizard Step 2 — Gap Rating

- Per-item row: skill name + required level chip + rating slider (1–10) + live gap calculation.
- Gap shown live as user drags: "Gap: 5" in amber when gap ≥ 4; neutral when gap < 4.
- AI never pre-fills ratings — all sliders start at 5 (neutral midpoint), user adjusts.
- "Add your own item" available here too.
- "Next: Drivers & Barriers →" active when all items have been touched (moved from default 5) or explicitly confirmed.

### Wizard Step 3 — Drivers & Barriers

- Three fields: Drivers (free text, multi-value), Barriers (free text, multi-value), If–then plan (structured: "If **_, then I will _**").
- At least one Driver, one Barrier, and a complete If–then plan required to advance.
- AI never suggests content here — explicitly blank until user types.
- Inline label guidance: "An internal strength already working for you", "What actually gets in the way".

### Wizard Step 4 — Review & Generate

- Summary of all inputs: goal text, framework items with required levels and user ratings (gaps highlighted), drivers, barriers, if–then plan.
- "Edit" link beside each section returns to the relevant step.
- Primary CTA: "Generate my breakdown" → POST to AI with full structured payload → loading state ("Generating your GTD breakdown…", up to 30s).
- On success: navigate to newly created Goal detail view.
- On timeout/error: remain on Step 4 with all inputs intact, error toast, "Try again" button.
- Abandoning wizard (close tab, navigate away) does NOT save a partial goal.

## Goals List

- Flat list, sorted by: Active first (by creation date desc), then Paused, then Someday/Not now, then Completed/Archived.
- Each row: goal text (truncated to 2 lines) · status badge · target date · project count · "→" chevron.
- Stuck project count shown inline in amber if > 0: "2 stuck".
- Empty state: "No goals yet. [Start one →]"
- FAB / "New goal" button in top-right opens wizard.

## Projects List

- Show all projects by default, with a goal filter offering All projects, each available goal, and No goal.
- Selecting a goal filters to projects linked to that goal; No goal filters to projects whose `goal_id` is null.
- Each row shows the project name, status, and parent goal when linked; the filter is keyboard-operable and preserves the selected value in the URL.
- The "New project" control opens the AI/manual creation choice.

## Goal Detail

- Header: goal text + status badge + target date + "Edit" menu.
- The Goal editor offers an optional Life Area selector; the selected Area appears on the detail view.
- Gap analysis section: collapsed by default, expandable — shows priority gaps, framework tables.
- Projects section: list of project cards (see Project Card below).
- Provide an "Attach existing project" control. Selecting a project links it to this goal; if it already belongs to another goal, the user confirms moving the single association.
- Monthly Goal Check section at bottom (collapsed).
- "Regenerate" on a specific project opens confirmation modal before overwriting that project's content.

## Project Card

- Outcome name + status badge + action count + committed action preview (first line, muted).
- Stuck indicator (amber band) when no committed action and status = Active.
- Expand to see full action list inline, or click title to navigate to Project detail.

## Project Detail

- Header: project name + parent Goal or inherited/direct Area breadcrumb + status badge.
- Provide a parent-goal selector that lists the user's goals and a "No goal" option; changes persist immediately and refresh the breadcrumb. A project can link to only one goal.
- When "No goal" is selected, offer an optional direct Area selector. Linking to a Goal clears any direct Area; Goal-linked Projects inherit their Area, with no conflicting second Area assignment.
- Purpose and Successful Outcome sections (collapsible).
- Action list: all actions with status (available / committed / done).
- "Commit" button on each available action sets it as committed (decommits any previous committed action on this project).
- "Add action" inline field at bottom.
- "Regenerate project" button in header overflow menu → confirmation → replaces only this project's AI content.

## Inbox

- Single text input at top (auto-focused). Enter or "Capture" button saves. No other fields.
- Items list below: raw text + timestamp + "Process" + "Delete".
- "Process" opens inline processing flow:
  - "Is this actionable?" Yes / No
  - If Yes: < 2 min? → "Do it now" (marks done, no project needed) | ≥ 2 min? → assign to project or create new project
  - If No: Trash / Someday-Maybe / Reference (future feature)
- Items older than 7 days shown with amber flag: "Unprocessed for 7+ days".
- Persistent floating capture button (`C` keyboard shortcut) opens capture drawer from any view.

## Engage View

- Shows only committed next actions across all Active, non-Paused goals.
- Grouped by goal (collapsible groups). Within each group: committed actions from each project.
- Each row: action text · context tag chips (if present) · parent project name · "Done" button.
- Completing an action immediately prompts: "What's next for [project name]?" — inline list of remaining available actions, user taps to commit. If no remaining actions: "No more actions — mark project complete?" option.
- Stuck project indicator: if a project is Active but has no committed action, it appears at the bottom of the goal group with amber stuck band and "Commit one →" CTA.
- Optional filter bar: @energy / @location / @tool context tags.
- Empty state (all caught up): "No committed actions. Open a project and commit one." — no celebration, no confetti.

## Weekly Review

Three-phase guided flow with a Weekly Snapshot bookending it. Phase bar at top tracks progress across four beats: Snapshot (open) → Get Clear → Get Current → Get Creative → Snapshot (close). Cannot skip a phase. Progress preserved if user leaves and returns mid-review (Supabase persistence).

### Weekly Snapshot — Opening (before Get Clear)

The first thing shown when a review begins. Surfaces the previous week's closing snapshot (if one exists) so the user starts with honest context, not a blank slate.

- Header: "Week [N] · [Mon dd] – [Sun dd]" — auto-calculated, not entered by the user.
- Previous week's closing snapshot shown read-only above: the intention and blocker the user wrote last week. Label: "Last week you said:" This is the closed loop — the user sees what they committed to and can honestly assess against it.
- Single prompt: **"What actually moved last week? What didn't?"** — free text, 2–4 sentences. No fields, no checkboxes, no word limit. Honest prose only.
- Label guidance: "Be brief and honest. This isn't a report — it's a reality check before you look at your system."
- Saving the entry and tapping "Start review →" advances to Get Clear. Skipping is not allowed — an empty field blocks progress. One sentence is enough; it just can't be blank.

### Phase 1 — Get Clear

- Step through: "Empty your head" (free text brain-dump capture → goes to inbox), then process inbox to zero.
- Inbox items surface one at a time in processing mode.
- Phase completes only when inbox count = 0.

### Phase 2 — Get Current

- Surface every Active project one at a time.
- Per project: show name + committed action (or stuck indicator) + last-updated date.
- User must do one of: confirm committed action is still valid | commit a new action | change status (Paused / Someday / Archived).
- Cannot advance past a stuck project without resolving it.
- Phase completes when all Active projects have been reviewed.

### Phase 3 — Get Creative

- Someday/Maybe list: surface each item, user can activate (move to Active goal), delete, or keep.
- "Anything missing?" — free text capture for new ideas → inbox.
- Goal alignment check: list Active goals, prompt "Still the right goals for this month?"
- Optional Focus review: show Life Areas and linked work with a "Review Focus" link to `/app/focus`. This is skippable and does not block the phase or review completion; Vision and Purpose do not require weekly edits.
- Phase does NOT complete until the closing snapshot is filled in (see below).

### Weekly Snapshot — Closing (end of Get Creative)

The final step before the review is marked complete. This is the forward-facing half of the snapshot.

Two fields, both required (one sentence minimum each):

1. **"What matters most this coming week?"** — one framing sentence. Not a task list. The user names the _one thing_ that, if it moves, makes the week a success. Example: "Getting the wizard Step 1 AI call wired up and tested." This derives naturally from the committed actions already in Engage — the user is naming the theme, not re-planning.
2. **"What's the main thing that could derail it?"** — the primary blocker. One sentence. Honest. Not aspirational. Example: "I tend to context-switch to easier tasks when the AI integration gets frustrating."

Label guidance for field 1: "Look at your Engage view — what's the committed action that matters most?" Label guidance for field 2: "Not a general blocker — the specific thing most likely to stop this particular week."

Both fields stored as the week's closing snapshot. They become the "Last week you said:" read-only display at the _next_ review's opening.

"Complete review" button enabled only when both fields have content. Tapping it:

- Marks the review complete
- Stores the snapshot (week number, date range, opening retrospective, closing intention, closing blocker)
- Updates sidebar: "Last review: today"
- Returns user to Engage view

**What the Weekly Snapshot is not:** it is not a task list, a goal-setting exercise, or a journaling prompt. It is two pieces of information — what happened, and what matters next — stored so the system has memory across weeks. The committed next actions in Engage remain the actual plan. The snapshot is the human context layer on top.

**The Notion planner problem it solves:** in the screenshot, the same intention paragraph appears in weeks 37, 38, and 39 because the loop was never closed — no retrospective before writing the next intention. The snapshot enforces the loop: you cannot write this week's intention without first recording last week's reality.

Completion: timestamp stored, sidebar shows "Last review: [date]". No badge, no streak counter.

## Monthly Goal Check

Distinct flow from weekly review. Manually triggered from goal detail or prompted inline (no push notification).

Per goal:

1. "Is this goal still relevant?" (Yes / No / Changed)
2. Status selector: Active / Paused / Not now / Someday / Completed / Archived
3. Linked projects: list with status badges, stuck count
4. "Missing project?" — prompt to check if a priority gap has no linked project
5. "Overloaded?" — list Active projects, prompt to pause any

Completes per-goal, not as a batch. No "completion" event — it's a review, not an achievement.

## Vault (Experimental)

- Accessible from header (lock icon) whether authenticated or not.
- Unlock screen: passphrase input → decrypt → vault view.
- Vault view: list of saved breakdowns (input text, mode, timestamp).
- Auto-save: after each successful generation, if vault is unlocked, save silently. If locked: dismissible banner "Vault locked — breakdown not saved. [Unlock →]"
- Per-breakdown actions: Restore to output panel | Delete.
- Vault-level actions: Export JSON | Import JSON | Clear all (confirmation modal) | Reveal portable identity link (behind security warning modal).
- Portable identity: URL fragment carries key material. Processed on load, scrubbed from address bar immediately. QR code rendered client-side.
- All vault operations: fully client-side. Zero server transmission.

---

# State Patterns

## Project Mode generation states

| State          | Visible UI                                             | Transitions to                          |
| -------------- | ------------------------------------------------------ | --------------------------------------- |
| **Empty**      | Input (empty) + disabled button + "Try an example" CTA | Typing → Ready                          |
| **Ready**      | Input has text + enabled button                        | Submit → Generating                     |
| **Generating** | Button spinner + "Generating…" + disabled input        | Success → Saved; Timeout → Error        |
| **Saved**      | Navigate to new Project detail view                    | — (generation complete)                 |
| **Error**      | Error toast + "Try again" button                       | Try again → Generating; Dismiss → Ready |

## Manual project creation states
All newly created projects start Paused across manual, standalone AI, and goal-generated paths. Manual creation and standalone Project Mode may accept an optional direct Life Area when no Goal is selected. Goal-generated Projects inherit their Goal's Area. The user activates a Project when ready; a Goal-linked Project cannot carry a second, conflicting Area.


The project creator offers two explicit paths: "Generate with AI" (selected by default) and "Create manually". Manual mode requires a project name and accepts optional purpose, successful outcome, and parent goal. Saving creates the project without an AI request and navigates to project detail; the user can add and commit actions there. If arriving from Inbox Clarify, manual save also links the new project to the inbox item and marks the item processed, using the same completion behavior as AI creation.

## Wizard states

| State                        | Description                                   |
| ---------------------------- | --------------------------------------------- |
| **Step 1 — Idle**            | Goal input empty, Continue disabled           |
| **Step 1 — Ready**           | Goal text present, Continue enabled           |
| **Step 1 — Loading**         | AI call in flight, "Building your framework…" |
| **Step 1 — Framework ready** | Framework displayed, user reviewing/editing   |
| **Step 2–3**                 | Per-step completion gates enforced            |
| **Step 4 — Idle**            | Summary visible, Generate enabled             |
| **Step 4 — Generating**      | AI call in flight, 30s timeout                |
| **Step 4 — Error**           | Inputs intact, error toast, retry available   |

## Action states

| State         | Meaning                                   | Visual                                       |
| ------------- | ----------------------------------------- | -------------------------------------------- |
| **Available** | In project backlog, not yet committed     | Default border                               |
| **Committed** | The one thing to do next for this project | Primary border + subtle primary bg           |
| **Done**      | Completed                                 | Line-through + muted text + checked checkbox |

## Project states

| Status    | Meaning                                     | Where it appears                      |
| --------- | ------------------------------------------- | ------------------------------------- |
| Active    | In progress, should have a committed action | Goals, Engage, Weekly Review          |
| Paused    | Temporarily on hold                         | Goals list only                       |
| Stuck     | Active + zero committed actions             | Engage, Weekly Review (flagged amber) |
| Completed | Done — user confirmed                       | Goals list, archived section          |
| Archived  | Hidden from active views, retained in data  | Export only (accessible)              |

## Goal statuses

Active · Paused · Not now · Someday · Completed · Archived — same display logic as project statuses. Status changes always explicit (user action), never automatic.

---

# Interaction Primitives

| Interaction              | Trigger                          | Response                                                          |
| ------------------------ | -------------------------------- | ----------------------------------------------------------------- |
| Submit generation        | Enter or button click            | Generate project breakdown; navigate to Project detail on success |
| Try example              | Click example CTA                | Fill input + generate + navigate to Project detail                |
| Start over               | Click link                       | Clear all; scroll to top; focus input                             |
| Capture (anywhere)       | `C` key or floating button       | Open capture drawer; focus text field                             |
| Commit action            | Click "Commit" on action row     | Set committed; decommit prior committed action                    |
| Complete action          | Click "Done" in Engage           | Mark done; prompt for next committed action                       |
| Wizard back              | Click back button or step circle | Navigate to that step; inputs preserved                           |
| Wizard abandon           | Navigate away                    | Partial state discarded; no goal created                          |
| Vault unlock             | Submit passphrase                | Decrypt; show vault view                                          |
| Portable identity reveal | Click reveal (behind warning)    | Show URL + QR; scrub URL from history                             |
| Filter projects          | Select All, a goal, or No goal   | Update the Projects list to the selected parent-goal scope        |
| Change project goal      | Select a goal or No goal         | Persist the single parent-goal association and refresh breadcrumb |
| Attach project to goal   | Choose an existing project      | Link it to the goal, moving it from any prior goal                |

Scroll behavior: when output renders (Project Mode generation), smooth-scroll so the top of the output panel lands in view before navigation to Project detail. When wizard advances to Step 4, scroll to top of wizard container.

---

# Accessibility Floor

- **Keyboard:** Full tab order across all surfaces. Wizard: Tab through fields; Enter advances when CTA is focused. Gap sliders: arrow keys adjust value. Weekly review: all decisions keyboard-operable.
- **Focus management:**
  - After generation: move focus to output panel (`role="region"`, `aria-label="Generated GTD template"`).
  - After "Start over": return focus to text input.
  - After wizard step advance: move focus to first interactive element of new step.
  - After modal open: trap focus within modal; after close, return to trigger element.
  - After action completion in Engage: return focus to the next action row (or empty state message if last).
- **Screen reader:**
  - Output panel: `aria-live="polite"` region; announces when content loads.
  - Wizard stepper: steps have `aria-current="step"` for active; `aria-label="Step 2 of 4: Gap Rating"`.
  - Gap slider: `<input type="range">` with `aria-label`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext` ("Current: 6, Gap: 2").
  - Stuck indicator: `role="alert"` so it announces on appearance.
  - Weekly review phase change: announce phase name on transition. Weekly Snapshot fields: `aria-required="true"`, inline validation message if user attempts to advance with empty field.
- **Motion:** Respect `prefers-reduced-motion` — disable all fade-in, slide, and transition animations. Functional state changes (loading spinner) remain.
- **Contrast:** All text WCAG 2.1 AA minimum (4.5:1 body, 3:1 large text). Visual contrast specs in `DESIGN.md`.
- **Touch targets:** Minimum 44×44px for all interactive elements — buttons, sliders, toggle segments, action row checkboxes, nav items.
- **Pointer affordance:** Enabled links, buttons, selects, checkboxes/radios, disclosure summaries, and custom button-like controls use a pointer cursor; disabled controls use `not-allowed`. Cursor shape supplements, and never replaces, semantic controls, visible focus, and hover/state cues.
- **Error states:** Inline validation messages linked to their input via `aria-describedby`. Never color-only — always paired with text or icon.

---

# Key Flows

## Flow 1 — Thembi creates her first goal through the wizard

Thembi, 31, secondary school teacher, signed up for Archer yesterday. It's 9pm on a Tuesday, kids are in bed. She has a goal she's been saying out loud for months but never acted on.

1. Signs in. Lands on the Engage view — empty. Sidebar shows Goals with a "New goal" button. She clicks it.
2. **Wizard Step 1:** Types "Complete my master's research proposal and submit it to my supervisor within 3 months." Clicks "Continue". Waits 6 seconds. The framework appears: 9 skill items — "Academic writing", "Literature review", "Time blocking", "Research methodology", "Supervisor communication" and more, each with a required level and a goal-specific description of what that level looks like.
3. She reads through. Removes "Statistical analysis" — her research is qualitative, not quantitative. It doesn't apply. Adds her own item: "Managing perfectionism". Clicks "Next: Rate yourself →"
4. **Wizard Step 2:** For each item, she drags the slider to where she honestly is. "Academic writing" — she moves it to 6. Required is 8. Gap: 2, shown in neutral. "Time blocking" — drags to 3. Required is 7. Gap: 4, shown in amber. "Managing perfectionism" — drags to 2. Required: 6. Gap: 4. She goes through all 9 items. The page waits. Nothing is pre-filled.
5. **Wizard Step 3:** Three blank fields. She types into Drivers: "I've already done two years of coursework. I have a supportive supervisor. I work well under self-imposed deadlines." Into Barriers: "I avoid starting writing because I'm afraid it won't be good enough. My evenings are unpredictable with family commitments." If-then: "If I feel too perfectionist to start, then I will open the document and write three bad sentences on purpose."
6. **Wizard Step 4:** Full summary. Everything she entered is displayed back to her — framework, her ratings, her gaps, her drivers and barriers. It looks like her life, not a generic template. She clicks "Generate my breakdown".
7. **Climax:** 14 seconds. She's navigated to her new Goal detail. Six projects. The first is directly linked to "Managing perfectionism" — "Consistent 25-minute writing sessions established". The second links to "Time blocking" — "Weekly writing schedule committed to calendar". She opens the first project. Action 1: "Open Google Calendar". Action 2: "Click on tomorrow morning at 6am". Action 3: "Type 'Research writing — 25 min'". Action 4: "Set event to repeat Mon/Wed/Fri".
8. She opens Engage. One committed action: "Open Google Calendar". She does it. Marks done. Engage prompts: "What's next for Consistent 25-minute writing sessions established?" She commits Action 2. Closes laptop. The system holds her place.
9. Total time: 18 minutes. Entirely her data, entirely her plan.

## Flow 2 — Sipho creates a goal with full gap analysis

Sipho, 27, junior software developer, uses GTD and wants to transition into product management. He's already signed in.

1. Navigates to Goals → "New goal".
2. **Wizard Step 1:** Types "Transition from software developer to product manager role within 3 months." Clicks "Continue". Waits 6 seconds. Framework appears: 8 skills including "Stakeholder communication", "Product sense", "Technical credibility" with required levels and goal-specific descriptions.
3. He removes "Technical credibility" (he already has it at 9 — not a gap). Adds his own: "Interview preparation". Clicks "Next".
4. **Wizard Step 2:** Rates himself on each item. "Stakeholder communication" — drags slider to 3. Gap shows: "Gap: 6" in amber. "Interview preparation" — drags to 2. Gap: 7. Works through all items. All ratings are his, all sliders started at 5 (neutral).
5. **Wizard Step 3:** Drivers: "Strong systems thinking, product curiosity, existing eng credibility." Barriers: "No PM experience on CV, imposter syndrome during interviews." If-then: "If I feel unqualified before an interview, then I will review my wins list for 5 minutes first."
6. **Wizard Step 4:** Reviews the full summary. Looks correct. Clicks "Generate my breakdown".
7. **Climax:** 12 seconds. Navigated to his new Goal detail. He sees 6 projects, first two directly linked to "Interview preparation" and "Stakeholder communication" gaps. Expands the first project — 12 actions starting with "Open Archer", "Navigate to the Goals view", "Create a new note titled 'PM Interview Evidence Bank'", "Write your three best cross-functional wins as bullets."
8. He opens the Engage view. The committed action from Project 1 is waiting: "Open Archer". He marks it done. Engage prompts: "What's next for PM Interview Evidence Bank?" He commits Action 2. Closes laptop. The system holds his place.

## Flow 3 — Naledi does her weekly review

Naledi, 34, product manager, has 6 active goals, 18 projects, 74 actions. It's Sunday morning. Coffee on the desk.

1. Opens Archer. Sidebar shows "Last review: 8 days ago." She clicks Weekly Review.
2. **Weekly Snapshot — Opening:** The header reads "Week 40 · Sep 28 – Oct 4". Below it, her closing snapshot from last week: "Last week you said: _What matters most: Ship the Q3 roadmap draft. Main risk: I'll keep refining instead of sending it._" She reads it. She did send it — finally, on Friday. She types: "Roadmap went out Thursday. The refinement loop was real — I added two more sections before forcing myself to send. Nothing else moved. Inbox hit 47 by Friday."
3. Clicks "Start review →".
4. **Get Clear:** Brain-dump: 4 items floating in her mind → inbox. Inbox now 51 items. Works through them. 41 processed, 6 to Someday-Maybe, 4 trashed. Inbox: zero.
5. **Get Current:** 18 projects surface one at a time. 15 confirmed. 2 stuck. For stuck Project 1: picks "Search LinkedIn for PM communities in Johannesburg" as next action. Stuck Project 2: changes to Paused. One project had a completed committed action — she marks it done, commits next.
6. **Get Creative:** 6 Someday-Maybe items: activates one (new goal: start a mentorship programme), deletes two, keeps three. Captures one new idea ("Run a sprint planning workshop for the team") → inbox. Active goals still right.
7. **Weekly Snapshot — Closing:** Two fields appear. Field 1 — "What matters most this coming week?" She glances at Engage. Three projects have actions due. She types: "Getting the mentorship programme goal through the wizard and committing its first two project actions." Field 2 — "What's the main thing that could derail it?" She types: "Monday and Tuesday are back-to-back meetings — if I don't block Wednesday morning now it won't happen."
8. Clicks "Complete review."
9. **Climax:** Sidebar: "Last review: today." Engage view: 16 committed actions, nothing stuck. Next Sunday, her opening snapshot will show exactly what she wrote today — the loop is closed before she starts again.
10. Total time: 26 minutes.

## Flow 4 — Kgosi uses Project Mode to plan a project

Kgosi, 22, student, found Archer on X. He signs up with his email, confirms it, and signs in.

1. Lands on Engage — empty. Sidebar shows Goals and the "New project" option. He wants to plan a specific project, not set a goal yet. Navigates to `/app/projects/new`.
2. Single text input. Placeholder: "e.g., Personal portfolio website deployed online". Types: "Build and launch a personal portfolio in 2 weeks." Clicks "Break it down". Waits 9 seconds.
3. Saved and navigated to the new Project detail. Project name: "Personal portfolio live at a public URL." Purpose, principles, successful outcome, 12 actions — all there, saved automatically.
4. He opens the project. Action 1: "Open browser." Action 2: "Navigate to github.com." Action 3: "Click Sign up." He commits Action 1. Opens Engage. It's waiting for him.

---

# GTD Template Integrity

This section is specific to Archer's core value proposition and governs AI generation quality.

All AI-generated content MUST adhere to GTD methodology as encoded in the source prompts:

- **AI does not know the user's level.** The wizard exists precisely because the AI cannot infer current capability. AI proposes required levels (what a successful person needs); user provides all current ratings. This constraint must never be violated.
- **Projects are outcome-based:** name describes a finished result, not an activity. "Consistent 30-minute practice habit established" not "Practice guitar."
- **Project template uses Allen's Natural Planning Model:** Purpose → Principles → Successful Outcome → Next Actions. Principles (standards and constraints that govern execution) are a required section, not optional.
- **Next actions begin with a physical verb:** Open, Navigate, Click, Type, Create, Save, Search, Read, Write, Complete, Download, Install, Watch, Record, Schedule.
- **Next actions are tiny (2–5 min):** immediately executable without decision-making.
- **Next actions reference specific real tools:** "Open Google Calendar", "Navigate to GitHub.com" — not "Use a tool" or "Go online".
- **First action feels almost impossible NOT to do:** the lowest-friction possible starting point.
- **Gap analysis is user-owned:** AI proposes framework and required levels; user provides all ratings and all content in Steps 2–3. AI never infers ratings or barriers.
- **Priority gaps link to projects by exact name:** the project name in the breakdown must match the linked project name in the Priority section, character-for-character.
- **No Notion references in generated content:** Archer is the system of record. Generated next actions reference Archer itself or other real tools — never "Open Notion" as a destination for storing Archer's output.

Template quality is the product. If the generated text doesn't follow these rules, the UX has failed regardless of visual polish. Generation failures (generic filler, placeholder text, broken structure, AI-inferred user ratings) are surfaced as a quality error — not suppressed.

---

# Responsive & Platform

| Breakpoint                    | Layout                            | Navigation               | Key adaptations                                                     |
| ----------------------------- | --------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| < 640px (mobile)              | Single column, full-width         | Bottom nav bar (4 icons) | Wizard stepper vertical; gap sliders full-width; action bar stacked |
| 640–768px (tablet portrait)   | Single column, max 640px centered | Bottom nav bar           | Same as mobile                                                      |
| 768–1024px (tablet landscape) | Sidebar (icon-only, 56px) + main  | Sidebar icons + tooltips | Sidebar collapses to icons; main max 720px                          |
| > 1024px (desktop)            | Full sidebar (240px) + main       | Full sidebar with labels | Standard authenticated layout                                       |

All routes are authenticated. Sign-in and sign-up pages use a single-column centered layout (max 480px) regardless of breakpoint.

All interactive elements: minimum 44×44px touch target at every breakpoint.

No platform-specific behavior — pure web, progressive enhancement. JavaScript enhances (AI calls, Supabase sync, vault operations) but the page structure is meaningful without JS.

---

# Inspiration & Anti-patterns

## What Archer takes from

- **Linear:** tool-feel density, no decorative chrome, keyboard-first, information surfaces immediately
- **Things 3:** the distinction between project and action is enforced by the app, not left to the user; the daily view shows only what to do today
- **GTD's own structure:** the system imposes the hierarchy (Goal → Project → Action) so the user never has to maintain it manually

## What Archer deliberately rejects

- **Todoist / Asana gamification:** streaks, completion scores, achievement badges — none of these
- **Headspace / wellness app:** soft gradients, rounded-everything, encouraging copy — Archer is a system, not a mood
- **Notion as system of record:** Notion is a tool for other things; Archer holds the GTD data, the relationships, the weekly review, the committed actions — none of that lives in Notion anymore
- **Static template generation:** the prior approach (raw goal text → AI fills in a template including guessed current ratings) was structurally wrong. The AI does not know where the user is. The wizard replaced it entirely.
- **ChatGPT prompt approach:** powerful but not a system — no persistence, no gap analysis, no user ownership of ratings, no weekly review, no stuck-project detection
