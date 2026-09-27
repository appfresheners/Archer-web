# Epic 1 Context: Authenticated Foundation & Persistence Backbone

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic establishes the standalone, no-unauthenticated-surface foundation every other epic builds on. A user can register, sign in with email and password, reset a forgotten password, and land in the authenticated app shell — with their data backed by a fully provisioned, RLS-protected Supabase schema that restores to its last known state on every sign-in. It stands up the Next.js standalone runtime, the design-token system, the six-table database with its triggers and row-level security, the Supabase client/server/middleware wiring, the auth flows, the responsive app shell, and the provider-agnostic AI configuration layer. Nothing else in the product can be built or trusted until this backbone exists and enforces its invariants at the data layer rather than only in the UI.

## Stories

- Story 1.1: Standalone Next.js Runtime & Design Token Foundation
- Story 1.2: Supabase Schema, RLS & Database Triggers
- Story 1.3: Supabase Client Wiring & Auth Middleware Guard
- Story 1.4: Sign Up & Sign In with Email and Password
- Story 1.5: Password Reset
- Story 1.6: Authenticated App Shell with Responsive Navigation
- Story 1.7: AI Provider Configuration Layer

## Requirements & Constraints

- Authentication is mandatory for every feature. There is no unauthenticated access path and no public landing page. Auth is email + password only — no magic link, no OAuth in v1.
- Password reset is offered from the sign-in page and handled by the Supabase Auth email flow. Reset confirmation must not reveal whether an account exists (no account enumeration).
- On sign-in, the user's goals, projects, actions, inbox items, and review history load from Supabase and reflect their last known state. No data may be lost between sessions.
- Deployment targets a Node.js runtime (not a pure static export); the API route requires it. Initial page load LCP under 2s on 4G.
- Fully responsive across mobile (<640px), tablet (640–1024px), and desktop (>1024px).
- Accessibility floor is WCAG 2.1 AA on every component: full keyboard navigation, visible focus indicators, logical focus order, minimum 44×44px touch targets, 4.5:1 body / 3:1 large-text contrast, and respect for `prefers-reduced-motion`.
- Privacy: no analytics, error monitoring, or third-party telemetry. The only outbound requests are AI generation calls and Supabase reads/writes.
- Environment configuration fails loudly — a missing required variable surfaces a logged error and a user-facing message rather than degrading silently. There are no hardcoded fallbacks; `.env.example` is the canonical list.

## Technical Decisions

- **Runtime & structure:** Next.js App Router with `output: 'standalone'` in `next.config.ts`. Auth-gated routes live under `/app/*`; API routes under `app/api/`. Seed route/component layout: `app/{sign-in,sign-up,forgot-password}`, `app/app/{engage,inbox,goals,projects/new,review,settings}`, `components/{auth,authenticated/{wizard,review,engage},shared}`, `lib/{supabase,vault,templates,utils}`, root `middleware.ts`.
- **Auth guard:** Root `middleware.ts` enforces auth on all `/app/*` routes (redirect unauthenticated to `/sign-in`). Root `/` redirects to `/app/engage` when authed, `/sign-in` when not. Redirection is enforced by middleware, not individual pages.
- **Supabase wiring:** `lib/supabase/client.ts` (browser client for client components), `lib/supabase/server.ts` (server client for route handlers / server components), `lib/supabase/middleware.ts` (session-refresh helper). Middleware reads the session from the Supabase cookie.
- **Styling:** Tailwind CSS v4, no component library and no CSS-in-JS. Design tokens are encoded as CSS-first `@theme` tokens in `globals.css`: full color palette (primary #2563EB + hover/subtle, success #10B981, warning #F59E0B, destructive #EF4444, neutral surfaces, text hierarchy, focus ring #2563EB40, wizard step states, seven status-badge colors), typography (Inter body, JetBrains Mono for generated output, major-third ×1.25 scale), rounded scale (xs 4px → full pill), and spacing (page-x, section-y, card-p, sidebar-w 240px, content-max 720px).
- **Data model (six tables):** goals, projects, actions, inbox_items, review_sessions, weekly_snapshots. Enum types for statuses (goal_status, project_status, action_status, inbox_processing_status, review_phase). FK hierarchy: an action references a project (`on delete cascade`); a project references a goal (`goal_id` nullable, `on delete set null` — the one permitted nullable-goal exception for Project Mode); every user-owned table carries `user_id uuid not null references auth.users(id) on delete cascade`.
- **Schema additions:** `goals.last_checked_at timestamptz` (drives the 30-day monthly-check prompt) and `projects.planning_depth` enum (`minimal | full_gtd`, default `minimal`, persists the depth choice).
- **RLS:** Enabled on every table, default-deny, policy `user_id = auth.uid()` for read and write. A table lacking RLS or a `user_id` policy is a defect.
- **Triggers:** `fn_set_updated_at` maintains `updated_at` on update across tables. `fn_commit_action` runs `BEFORE UPDATE` on `actions` and decommits any other committed action on the same project when one becomes committed — the at-most-one-committed-action-per-project invariant is enforced at the DB layer, not only the UI.
- **Types:** `lib/supabase/schema.ts` is generated from the DDL and is the authoritative TypeScript type source.
- **AI provider layer:** Provider selected by `AI_PROVIDER` (`gemini` default, `groq`, `openai`). Model resolved from the provider's env var (`GEMINI_MODEL` / `GROQ_MODEL` / `OPENAI_MODEL`) with no hardcoded fallback; documented defaults `gemini-3.1-flash-lite`, `llama-3.1-8b-instant`, `gpt-4o-mini`. API keys read only from env (`GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY`); no in-app key entry UI.
- **Env contract:** `AI_PROVIDER`, the selected provider's model var, the provider API key, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (route handlers only).

## UX & Interaction Patterns

- **Auth layout:** `/sign-in`, `/sign-up`, `/forgot-password` use a minimal single-column centred layout, max 480px, no sidebar. Incorrect sign-in credentials show a clear inline error and keep the user on the page. A "Create account" link goes to `/sign-up`; a "Forgot password" link goes to `/forgot-password`.
- **App shell:** Fixed 240px left sidebar (Archer wordmark, primary nav — Inbox, Goals, Engage, Weekly Review — and a settings/avatar footer), with the main content capped at max 720px. The active nav item uses the primary-subtle background with primary text.
- **Responsive navigation:** Sidebar collapses to a 56px icon-only rail with tooltips at 768–1024px; below 768px navigation becomes a bottom nav bar and the sidebar is not rendered. Collapse is CSS/Tailwind-driven at breakpoints, not JS-toggled state.
- **Capture affordance:** A persistent floating capture button (keyboard shortcut `C`) is present in every authenticated view; its drawer behavior is delivered later (Epic 5), so this epic ships the affordance only.

## Cross-Story Dependencies

- Stories 1.4–1.6 depend on the Supabase clients and auth middleware from Story 1.3, which in turn depends on the schema and RLS from Story 1.2.
- Story 1.6's shell and Story 1.4/1.5's auth pages depend on the design tokens and runtime from Story 1.1.
- The data-restoration-on-sign-in behavior (Story 1.7) depends on the schema (1.2) and auth flows (1.4).
- The AI provider layer (1.7) is a prerequisite for generation features in later epics (e.g. the `/api/generate` route in Epic 2). The floating capture button (1.6) is completed by inbox capture in Epic 5.
