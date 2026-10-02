---
title: "PRFAQ Distillate: GTDGoalandProjectCreator (Archer)"
type: llm-distillate
source: "prfaq-GTDGoalandProjectCreator.md"
created: "2026-09-26"
purpose: "Token-efficient context for downstream PRD creation"
---

## Product Identity

- **Name:** Archer
- **Type:** Personal productivity system (personal tool first, potential commercial product later)
- **Methodology:** GTD (David Allen) + Reverse Goal Setting (Justin Sung) — goal-first GTD with interactive gap analysis
- **Builder:** Mthizo — solo, primary user
- **Stack:** Next.js 16 (App Router, Node.js runtime), Tailwind CSS v4, Supabase (Postgres + Auth + Realtime), Vercel; Gemini `gemini-3.1-flash-lite` (default AI provider), Groq / OpenAI as alternatives
- **Auth:** Email + password via Supabase Auth. No OAuth in v1.
- **Current state:** Working prototype — AI generation route and goal/project templates exist. Auth and full Supabase persistence not yet built. **All generation requires a signed-in account; there is no unauthenticated generation path.** Everything saves to Supabase automatically on generation.

## Target User

- Young professional balancing work and personal life (small family context)
- Already motivated to use GTD — not trying to be converted
- Currently using multiple tools (Notion, Todoist, ChatGPT) that don't talk to each other
- Pain: fragmented data model, no enforced goal→project→action connection, weekly review never happens because maintaining the stack costs too much time
- Persona: serious about their goals, frustrated by tooling, not interested in productivity as a hobby

## Core Product Loop (what Archer IS)

1. User creates an account (email + password) and signs in
2. User types a goal in plain language
3. Archer proposes the skills/attributes the goal requires (AI-researched)
4. User completes interactive gap analysis — rates themselves on each skill/attribute
5. User adds personal drivers (internal strengths) and barriers (what's actually in the way) — AI cannot infer these
6. Archer generates outcome-named projects and full action lists from the grounded gap inputs — saved automatically to Supabase
7. User reviews AI output, edits directly or regenerates as needed
8. User marks which action in each project is their committed "next action" — user decides, not AI
9. User works through committed next actions; when one is done, they mark the next from that project
10. Weekly review: guided three-phase GTD flow (Get Clear / Get Current / Get Creative) — structured but not timed
11. Monthly goal check: is the goal still relevant? Edit, pause, archive, or close.

## Critical Product Design Decisions (non-negotiable)

- **Auth required for all generation** — there is no unauthenticated generation path. Both goal breakdowns and project breakdowns require a signed-in account. All output saves automatically to Supabase.
- **No copy/download buttons** — generated output is persisted to Supabase. There are no "Copy Markdown" or "Download .md" actions anywhere in the product.
- **AI does NOT infer gaps** — the gap analysis is always interactive. User rates themselves. AI proposes the framework; user owns the assessment and adds drivers/barriers.
- **AI does NOT choose next actions** — AI generates the full action list for a project. User marks which action is "next." Always user-driven.
- **AI does NOT auto-surface the next action** — the user commits manually. The system shows candidates; the user decides.
- **Abandonment of gap analysis = goal not created** — no recovery flow, no nudge system. Seriousness of intent is a precondition.
- **Weekly review has no timer** — guided and structured, but the review takes as long as the user needs.
- **No AI inference anywhere in the core loop** — AI is a research and generation tool; user is the decision-maker throughout.

## V1 Scope (confirmed must-have)

- Email + password auth (Supabase Auth) — required to access any feature
- Interactive gap analysis as part of goal creation (AI proposes skill framework, user rates + adds drivers/barriers)
- AI-generated outcome-named projects with purpose, definition of done, and action list — saved to Supabase automatically
- User-owned next action commitment (mark/unmark per project)
- Regenerate and edit: user can regenerate AI output or edit any part directly
- Goal editing and deletion (deletion archives linked projects and actions)
- Structured weekly review UI (three-phase: Get Clear / Get Current / Get Creative)
- Stuck project detection (active project with zero committed next actions flagged everywhere)
- GTD Inbox — frictionless raw capture, processed during weekly review
- Monthly goal check — distinct UI flow, manually triggered
- Data export on demand (JSON)

## Out of Scope (confirmed)

- No unauthenticated generation path — auth required for all features
- No copy/download buttons — output is persisted to Supabase
- No pricing model at this stage
- No integrations (Notion, Todoist, Google Calendar, etc.) — Archer is the single source of truth
- No re-engagement flows, nudges, or abandonment recovery
- No AI inference of gap analysis inputs
- No AI selection of next actions
- Context-based next action filtering (@energy, @location) — not in v1
- Dark mode, i18n, streaming AI responses — not in v1

## Rejected Framings

- "GTD app with AI" — positions as a feature, not a system
- "AI productivity assistant" — loses the enforcement/invariant story
- Free tier + paid plan — premature; Archer is a personal tool first
- Auto-surface next action — rejected; user owns commitment
- AI-inferred gap analysis — rejected; user owns the gap assessment
- Time-limited weekly review — rejected; structured but not timed

## Competitive Context

- **Notion:** canvas, not a system. Requires learning Notion. Cannot enforce GTD invariants. PARA Areas modeled as Tags (overloaded). Relations drift when life gets busy. Needs external tools (Pipedream) for recurring tasks.
- **Todoist / TickTick:** task managers. No goal → project data model. No gap analysis. No weekly review.
- **OmniFocus / Things 3:** powerful GTD tools but complex setup; no AI generation; no gap analysis; no goal layer.
- **ChatGPT + any task manager:** two tools that don't talk to each other. Plan generated in one place, execution tracked in another. No enforced link.
- **Thomas Frank Ultimate Brain (Notion template):** closest existing system. GTD-compatible. But: needs external Pipedream for recurring tasks, cannot enforce "every project has a next action" invariant, PARA Areas overloaded onto Tags, no AI generation built in. Archer is explicitly designed to beat this template.

## Methodology Sources (inform prompt engineering and system design)

- **David Allen GTD:** Capture → Clarify → Organize → Reflect → Engage. Every active project must have ≥1 next action. Projects are not task containers — plan is support material. Weekly review: Get Clear / Get Current / Get Creative. Context-based action lists. Stuck project = active project with zero next actions.
- **Justin Sung Reverse Goal Setting:** Gap analysis (target profile vs. current profile), priority gaps drive projects, drivers/barriers/if-then plans. 3-month goal horizon. Monthly goal check (Active/Paused/Not now/Someday/Completed/Archived).
- **James Clear Atomic Habits:** Systems over goals — Archer embodies this: the system (GTD loop) is the product, not the goal-setting UI.
- **Cal Newport Slow Productivity (2024):** Do fewer things, work at natural pace, obsess over quality. Validates anti-overwhelm positioning. "Fewer active commitments, higher completion rate."
- **Jake Knapp / John Zeratsky Make Time:** Daily Highlight concept — one meaningful focus per day. Maps to Archer's "committed next action per project" daily view.

## Open Questions / Unknowns

- Domain / deployment: archer.app placeholder in press release. No deployment plan confirmed.

**Resolved:** Wizard API contract — a single `/api/generate` endpoint handles all patterns, discriminated by the request body (`mode` + `step` fields). No separate endpoints.

## Verdict Summary

- **Forged in steel:** problem statement, user-owns-gaps design decision, goal→project→action data model, "serious users only" positioning, auth-required-for-all-generation
- **Resolved since original:** wizard UX designed (EXPERIENCE.md), weekly review UI designed, stuck project detection confirmed v1, inbox confirmed v1, AI provider + model confirmed (Gemini `gemini-3.1-flash-lite` default), auth method confirmed (email + password), copy/download removed, unauthenticated generation removed, wizard API contract resolved (single `/api/generate` endpoint, discriminated by request body)
- **Remaining open:** none blocking implementation
