# Epic 2 Context: Project Mode Generation & Structured Persistence

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver an authenticated project-creation flow where a user can generate a depth-appropriate GTD plan or create a project manually, save it to their account, and open its detail view. AI generation establishes shared infrastructure for the goal wizard and makes persisted structured project data, not transient markdown, the source of truth.

## Stories

- Story 2.1: Single Generation Endpoint with Auth & Provider Path (Pattern A)
- Story 2.2: Project Mode Input with Depth Control & Validation
- Story 2.3: Project Mode Generation, Save & Navigation
- Story 2.4: Loading, Timeout & Provider Error Handling
- Story 2.6: Remove Dead Copy/Download Code
- Story 2.7: Manual Project Creation

## Requirements & Constraints

- AI generation requires a signed-in user; reject unauthenticated requests before provider calls. Enforce a 2,000-character server cap and a 500-character UI limit. Block blank input inline and support Enter and button submission.
- Minimal is the default depth; Full GTD is an explicit choice. Minimal contains an outcome-based name, purpose, successful outcome, and exactly 12 sequenced actions. Full GTD adds principles, vision/outcome, ideas, and organizing sections. Validate the structured response before persistence.
- Generated actions must be specific, physical next steps that take 2–5 minutes; use a low-friction first action. Generic filler fails the quality bar.
- Save successful generation before returning the project ID and navigating. No transient unsaved result, markdown output, copy, or download path. Time out after 30 seconds; preserve input and offer retry. Provider errors must clearly explain corrective action, including missing-key guidance.
- Manual mode requires a project name; purpose, successful outcome, and parent goal are optional. Save without calling AI. Verify any selected goal belongs to the signed-in user. Preserve Inbox Clarify linking and completion behavior when creation starts there.
- Keep the flow responsive and keyboard accessible; depth selection must expose its state, meet a 44×44px touch target, and maintain 4.5:1 contrast.

## Technical Decisions

- One authenticated `/api/generate` route serves discriminated generation requests. This epic implements Project Mode; Epic 3 extends the same auth, provider, and timeout path for the wizard. Keep provider credentials server-side and do not stream responses.
- Generate typed structured data, validate it server-side, and persist the project with its ordered action rows. Project Mode may have no parent goal; Supabase row-level security scopes data to its owner.
- Provider and model are environment-configured with no hardcoded fallback. Manual creation uses authenticated `POST /api/projects`, validates inputs and goal ownership, saves a user-owned project, then returns its ID. No schema migration is needed for manual creation.
- Project detail renders from persisted fields and action rows. Remove the old copy/download UI and unused utilities; do not generate or store markdown.

## UX & Interaction Patterns

- At `/app/projects/new`, show the project input, unobtrusive Minimal/Full GTD choice, and “Break it down” button. Show a character count above 400 characters. While generating, disable input and show a spinner with “Generating…”.
- Offer “Generate with AI” by default and “Create manually” as an alternative. Both successful flows navigate to the saved project detail, where the user can continue with actions.

## Cross-Story Dependencies

- Story 2.1 provides the endpoint used by the AI input, generation, and error-handling stories (2.2–2.4); keep shared infrastructure extensible for Epic 3.
- AI persistence and navigation rely on the authenticated app shell and project/action model from Epic 1. Manual creation also relies on that foundation and the project detail/action workflow.
- Story 2.6 is independent; no copy/download path should remain alongside save-before-navigation flows.
