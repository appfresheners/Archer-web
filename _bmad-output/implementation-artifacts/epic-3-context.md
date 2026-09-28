# Epic 3 Context: Goal Creation Wizard & Gap Analysis

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A signed-in user creates a goal through a guided four-step wizard, after which the AI generates a full Reverse-Goal-Setting + GTD breakdown that is saved to Supabase as linked `goals` + `projects` + `actions` rows. The wizard grounds the user's gap analysis in an AI-proposed skill framework, then collects the user's own self-assessment (ratings, drivers, barriers, if–then plan) which the AI never infers or pre-fills. All wizard state is transient in React component state until Step 4 generation succeeds; nothing is persisted mid-flow, and abandoning the wizard creates nothing.

## Stories

- Story 3.1: Wizard Shell & Stepper Navigation
- Story 3.2: Framework Generation Endpoint (Pattern B)
- Story 3.3: Wizard Step 1 — Goal & Skill Framework
- Story 3.4: Wizard Step 2 — Gap Rating
- Story 3.5: Wizard Step 3 — Drivers, Barriers & If–Then Plan
- Story 3.6: Wizard Step 4 — Review, Generate, Save (Pattern C)

## Requirements & Constraints

- The wizard lives at `/app/goals/new` and requires an authenticated session; unauthenticated access is impossible (middleware-enforced).
- The AI owns only the target profile (proposed required levels) and the final breakdown. It never supplies or infers the user's current ratings, drivers, barriers, or if–then content. Any surface that appears to pre-fill user-owned data is a design failure.
- Wizard state is not persisted until a successful Step 4 generation. No `localStorage` write, no partial `goals` row, no auto-save, no recovery/nudge on abandonment.
- Generation always writes to Supabase before returning; there is no "show output, then decide to save" path. On failure the wizard stays on Step 4 with all inputs intact and no goal is created.
- Input caps: goal text accepts up to 500 characters in the UI with a live counter; the framework endpoint rejects goal input longer than 2,000 characters before calling the AI.
- Generated content must be specific to the user's goal and inputs (real tools, sites, resources) with no generic filler, and must satisfy the GTD template integrity rules (see Technical Decisions).
- All interactive components meet WCAG 2.1 AA: full keyboard operation, ARIA roles/live regions, minimum 44×44px touch targets.

## Technical Decisions

- **Single generation endpoint, discriminated request.** All AI generation goes through `app/api/generate/route.ts`. Auth is checked on every call (401 if unauthenticated). One auth check, one provider-selection path, one 30-second timeout handler, no streaming. Provider chosen by `AI_PROVIDER` env var (`gemini` | `groq` | `openai`), default `gemini`. The three patterns differ only in the system prompt loaded and the response shape.
  - **Pattern A** (Project Mode, already built): `{ mode: 'project', input }` → markdown → saved `projects` row.
  - **Pattern B** (this epic, Story 3.2): `{ mode: 'goal', step: 'framework', goal }` → skill framework JSON (items: name, required level 1–10, goal-specific description). No DB write — returned for the wizard to hold in transient state.
  - **Pattern C** (this epic, Story 3.6): `{ mode: 'goal', step: 'generate', goal, framework, ratings, drivers, barriers, ifThen }` → full breakdown markdown → saved as `goals` + `projects` + `actions` rows; client receives IDs and navigates to the new goal.
- **Data model (Goal → Project → Action).** Enforced by Supabase FK constraints with RLS on every table (`user_id = auth.uid()`).
  - `goals`: `goal_text` (1–500 chars), `target_date` (3 months from creation), `status`, `skill_framework` JSONB (`[{name, required_level, description, user_rating}]`), `drivers text[]`, `barriers text[]`, `if_then_plan text`, `breakdown_md`.
  - `projects`: `goal_id` (nullable only for Project Mode), `name`, `purpose`, `successful_outcome`, `status`, `breakdown_md`, `sort_order`.
  - `actions`: `project_id` (required), `text` (1–500), `status` (`available`/`committed`/`done`), `context_tags text[]`, `sort_order`.
- **Breakdown template integrity (Pattern C output must contain all of):** a 3-Month Goal statement with target date = 3 months from today; 3+ measurable success criteria; a Target Profile (required levels) and a Current Profile with calculated gaps (Gap = Required − Current); drivers/resources/barriers and the if–then plan reproduced verbatim from user input; 2–3 priority gaps; 5–6 outcome-named GTD projects rendered as `<details>/<summary>` accordions, each with Purpose (3–4 sentences), Successful Outcome (2–3 sentences), and 12 micro next actions; and a Monthly Goal Check section. The first two projects must close Priority 1 and 2 gaps, with names matching the linked project names character-for-character. Every next action must follow the GTD rules (physical verb, real tool, 2–5 minutes). The live system prompt for this lives in `docs/MASTER GOAL → GTD PROJECT SYSTEM PROMPT.md` and must stay in sync with `GOAL_SYSTEM_PROMPT` in the route.
- Route handlers use the server-side Supabase client; client components use the browser client. Env vars fail loudly when absent (no hardcoded fallbacks).

## UX & Interaction Patterns

- **Stepper (Story 3.1):** four steps — Goal & Skill Framework, Gap Rating, Drivers & Barriers, Review & Generate. Current, completed, and upcoming steps are visually distinct (complete = emerald fill + checkmark; active = primary fill + number). Horizontal on desktop, vertical on mobile (< 640px). Active step exposes `aria-current="step"` and a label like "Step 2 of 4: Gap Rating"; focus moves to the first interactive element of a step on advance.
- **Step gating:** advancement is gated per step on its own completion rule; users cannot skip ahead. Back navigation preserves later inputs. Changing the goal text on Step 1 invalidates the skill framework, which must be regenerated. Step 1 requires non-empty goal text and at least 3 framework items remaining before continuing; the framework fetch (Pattern B) must return before advancing to Step 2. Step 2 activates advance once every item is touched or explicitly confirmed. Step 3 requires at least one Driver, at least one Barrier, and a complete If–then plan.
- **Gap slider (Step 2):** each row shows skill name, required-level chip, a 1–10 slider, and a live gap readout (Gap = Required − Current); gap displays amber when ≥ 4, neutral otherwise. Every slider starts at 5 (neutral midpoint) with no AI-supplied values. Implemented as `<input type="range">` with `aria-label`, `aria-valuenow/min/max`, and `aria-valuetext` (e.g. "Current: 6, Gap: 2"), adjustable by arrow keys.
- **Step 3 fields:** Drivers (multi-value), Barriers (multi-value), and a structured If–then plan; all start blank with no AI-suggested content, with inline label guidance.
- **Step 4 review:** summarizes all Step 1–3 inputs with gaps highlighted and an "Edit" link beside each section that returns to the relevant step. "Generate my breakdown" shows "Generating your GTD breakdown…" under the 30-second timeout; on error, an error toast plus a "Try again" button with inputs preserved.
- **Transient state:** the wizard is never persisted until Step 4 succeeds; closing the tab or navigating away discards everything with no recovery.

## Cross-Story Dependencies

- **On Epic 1 (auth & database):** the wizard depends on the Supabase Auth boundary and the `goals`/`projects`/`actions` schema, RLS policies, and enum types being in place. Pattern C persistence relies on the FK hierarchy and soft-delete status model.
- **On Epic 2 (Pattern A generation endpoint):** Story 3.2 (Pattern B) and Story 3.6 (Pattern C) extend the same `app/api/generate/route.ts`, reusing its auth check, provider path, and 30-second timeout established by Pattern A.
- **Within the epic:** 3.1 provides the shell/stepper/gating that all step stories plug into. 3.2 (Pattern B endpoint) is a prerequisite for 3.3, which fetches and confirms the framework. 3.3's confirmed framework feeds 3.4's gap ratings. 3.4 and 3.5 supply the ratings/drivers/barriers/if–then that 3.6 sends to Pattern C. 3.6 depends on 3.2–3.5 outputs and on the breakdown template rules to produce and persist the final goal.
