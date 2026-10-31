# Sprint Change Proposal - 2026-10-31

**Project:** Archer
**User:** Mthizo
**Mode:** Incremental
**Status:** Approved by Mthizo on 2026-10-31; implementation in progress
**Scope classification:** Moderate - add and track a cross-cutting hardening story before implementation

## 1. Issue Summary

A new requirement requests reusable HTTP instrumentation, Prometheus metrics, production-grade operational logging, and health endpoints for Archer's Next.js API. This is a stakeholder requirement, not a reported production incident; no triggering story ID was supplied.

Local evidence:

- The application uses the root `app/` App Router and Next.js 16.3.3, configured for the Node.js standalone runtime.
- There is no `prom-client` dependency, `/api/metrics` route, health route, Prometheus registry, or existing process/event-loop/GC metric collection.
- There are 19 existing API route modules containing 23 handler exports. All current handlers use POST, PUT, PATCH, or DELETE; future health/metrics routes use GET.
- Existing routes perform their own authentication and use the server Supabase client. The root `proxy.ts` matches `/` and `/app/*`, not `/api/*`.
- Supabase is the app's critical external data dependency. AI provider services are optional to ordinary read/write operation and should not make readiness fail.
- The H-2 provider resilience spec is marked done and frozen after approval. It is not the trigger story and will not be modified.

## 2. Impact Analysis

### Epic and Story Impact

| Epic | Story | Adjustment |
| --- | --- | --- |
| H: Cross-cutting Hardening | Add Story H-5: HTTP Observability and Health Checks | Specify the metrics helper, route coverage, operational endpoints, tests, and documentation. No existing story is replaced or renumbered. |

Epic H remains in progress. Existing H-1 through H-4 tracking and status are preserved; the new story is added as backlog until implementation is approved and scheduled.

### Artifact Conflicts

- **PRD:** NFR6 currently limits outbound requests and prohibits analytics/tracking/data collection; Technical Constraints says “Analytics: None.” The new in-process operational metrics need a narrow, explicit exception. Add FR113 for HTTP metrics and FR114 for health endpoints.
- **Architecture:** AD-22 prohibits third-party telemetry and Boundary Rule 1 says there are no unauthenticated application surfaces. Public `/api/metrics` and health probes need an explicit, limited operational-endpoint exception. AD-7 already provides the required Node.js App Router runtime.
- **Epics:** Add H-5 to Epic H with acceptance criteria. No user-facing feature epic changes.
- **UX:** No UX changes. These are service endpoints, not user-facing surfaces.
- **Frozen H-2 spec:** No changes.
- **Other artifacts:** Implementation documentation will explain wrapper usage, health checks, metric labels, and PromQL. No database migration or monitoring service is proposed.

### Technical Impact

- Install the explicitly required `prom-client`; use its single default registry and process-level singleton initialization so Next.js development reloads do not duplicate metrics.
- Add reusable wrappers for GET, POST, PUT, PATCH, and DELETE route handlers. Preserve the handler response, async behavior, and second App Router context argument; exceptions record 500/unavailable and are rethrown.
- Apply explicit route templates and per-handler expected status codes to all 23 existing handler exports. Templates use bounded identifiers such as `/api/projects/[id]`; raw paths, query strings, user IDs, and request content are excluded from labels.
- Add `/api/metrics` using Prometheus exposition content type, without instrumenting that endpoint. Include the requested request counters, duration histogram, availability counter, and default process/event-loop/GC metrics available from the runtime.
- Add `/api/health`, `/api/health/live`, and `/api/health/ready`. Liveness checks only process availability; readiness performs a bounded, minimal Supabase connectivity check. Health responses reveal only check names and pass/fail status, never credentials, connection strings, or provider error details.
- The health and metrics paths are public scrape/probe endpoints. Keep their output bounded and non-sensitive. Do not add a vendor SDK, outbound metrics exporter, user-identifying labels, or database changes.
- Add focused unit tests with mocked handlers and dependency probes; tests must not require production Supabase or AI services.

### Change Navigation Checklist

- Trigger and context: **[x] Done** - stakeholder requirement is explicit; no incident or triggering story was provided.
- Epic impact: **[x] Done** - Epic H can absorb a focused H-5 story; no resequencing or removal is needed.
- PRD conflicts: **[x] Done** - NFR6 and “Analytics: None” need the approved operational-metrics exception.
- Architecture conflicts: **[x] Done** - public operational endpoints need a narrow exception to the no-unauthenticated-surface rule.
- UX impact: **[N/A]** - no UI or user flow changes.
- Path forward: **[x] Done** - direct adjustment; rollback and MVP scope reduction are not justified.
- Proposal and handoff: **[x] Done** - drafted below; complete proposal approval is pending.

## 3. Recommended Approach

**Direct adjustment within Epic H.** Add Story H-5 and update the PRD and architecture with the approved narrow operational-endpoint exception. Then implement the story after final proposal approval.

- **Effort:** Medium; approximately 1-2 developer days for 23 handlers, explicit per-route availability maps, health probes, tests, documentation, and full verification. Estimate only; not a delivery commitment.
- **Risk:** Medium. Cross-cutting wrappers touch every API handler; public scrape/probe endpoints add an intentional access-policy exception; expected status codes must remain endpoint-specific. Mitigate with focused route tests, a single registry, static route templates, and sanitized responses/logging.
- **Timeline:** Adds one hardening story to Epic H; no user-facing feature epic needs to move.
- **Rollback:** Not recommended. The missing observability infrastructure is additive, and rolling back existing work does not resolve it.
- **MVP review:** Not needed. Keep the implementation in-process and avoid external telemetry or new database schema.

## 4. Detailed Change Proposals

The PRD, Epic, and Architecture proposals below were individually approved by Mthizo. The complete proposal has not yet received final approval.

### PRD Amendments

**NFR6 — Privacy**

- **OLD:** “No cookies (beyond Supabase Auth session), analytics, tracking, or data collection. The only outbound network requests are: AI generation calls to the configured provider, and Supabase read/write for authenticated users. All vault operations are client-side only.”
- **NEW:** Preserve the no-product-analytics, no-tracking, and no-third-party-telemetry requirements. Permit in-process operational metrics exposed through a Prometheus scrape endpoint. Do not export metrics to an external vendor from the application. Do not include user identifiers, request bodies, raw URLs, query strings, credentials, or other sensitive/high-cardinality values in metric labels or logs. Preserve existing authentication, AI, Supabase, and vault network boundaries otherwise.

**Functional Requirements — add FR113 and FR114**

- **FR113:** The Node.js App Router SHALL expose `/api/metrics` using one Prometheus registry and valid Prometheus content type. It SHALL provide `http_requests_total` and `http_request_duration_seconds` labeled by method, fixed route template, and status code, plus `http_endpoint_requests_total` labeled by method, route template, status code, and outcome (`available` or `unavailable`). Route handlers SHALL declare expected status codes; only unexpected statuses are unavailable. Exceptions are recorded as 500/unavailable. Metrics SHALL not expose high-cardinality or sensitive labels, and `/api/metrics` SHALL not instrument itself.
- **FR114:** The application SHALL expose `/api/health`, `/api/health/live`, and `/api/health/ready`. Liveness SHALL report process availability without dependency checks. Readiness SHALL return 503 when the critical Supabase dependency is unavailable. Health responses SHALL contain only overall status and bounded check results, never secrets or sensitive error details.

**Technical Constraints**

- **OLD:** “Analytics: None”
- **NEW:** “Product analytics: none. Operational metrics: in-process Prometheus registry exposed at `/api/metrics`; no outbound metrics exporter or monitoring SDK.”

**MVP impact:** Additive operational capability; no product analytics, user tracking, schema change, or change to existing API response contracts.

### Epic H Amendment

Add **Story H-5: HTTP Observability and Health Checks**.

As a developer, I want shared HTTP metrics and dependency health probes, so that API availability and operational health can be monitored without adding a third-party telemetry service or changing route contracts.

**Acceptance Criteria:**

- A single process-level Prometheus registry exposes each metric once across development hot reloads, together with the requested process, event-loop, and GC metrics supported by the runtime.
- A reusable async wrapper supports GET, POST, PUT, PATCH, and DELETE; preserves original responses and dynamic route context; and records exceptions as 500/unavailable before rethrowing.
- Request totals and duration histogram use method, explicit fixed route template, and status code. The endpoint availability counter adds outcome, limited to `available` or `unavailable`.
- Each instrumented handler declares its own expected status codes. Expected 4xx responses such as login validation/authentication failures may be available; unexpected 5xx responses are unavailable.
- Every existing API handler (23 current method exports across 19 route modules) is instrumented with its route template and expected statuses. `/api/metrics` is excluded to avoid recursion.
- `/api/metrics` exposes all three HTTP metrics and default process/event-loop/GC metrics using the Prometheus content type.
- `/api/health` returns overall status and checks; `/api/health/live` checks only process availability; `/api/health/ready` checks critical Supabase connectivity and returns 503 when unavailable. No endpoint returns credentials, connection strings, or sensitive provider/database error messages.
- Operational logging is structured and production-appropriate, excludes authorization headers, request bodies, raw query strings, and user IDs, and does not change route response bodies/statuses.
- Tests cover GET, POST, expected 4xx, unexpected 5xx, thrown exceptions, duration, dynamic route templates, health success/failure, and live/readiness behavior using mocks only.
- Documentation covers helper usage, expected status configuration, availability rules, adding health checks, metric names, and PromQL for request rate, error rate, average/P95 latency, and endpoint availability.
- TypeScript, lint, focused/full tests, and production build pass; endpoint checks verify metric names/content type and health status behavior without claiming production-service verification.

### Architecture Amendments

**AD-22 — Privacy and telemetry boundary**

- **OLD:** “No analytics, no tracking, no third-party telemetry. Only outbound network requests: AI generation calls and Supabase reads/writes.”
- **NEW:** Preserve the prohibition on product analytics, tracking, third-party telemetry, and outbound exporters. Permit only bounded in-process Prometheus metrics exposed at `/api/metrics`, with no sensitive/high-cardinality labels, plus sanitized public operational health endpoints.

**Boundary Rule 1 — Authenticated surfaces**

- **OLD:** “No unauthenticated surfaces. Every route except `/sign-in`, `/sign-up`, `/forgot-password` requires a valid Supabase session.”
- **NEW:** Retain authentication for product surfaces and all existing API routes. Add only `/api/metrics`, `/api/health`, `/api/health/live`, and `/api/health/ready` as public operational endpoints. They expose no user data, credentials, raw errors, or identifiers; `/api/metrics` contains bounded aggregate metrics only.

**Seed Structure**

Add `app/api/metrics/route.ts`, `app/api/health/route.ts`, `app/api/health/live/route.ts`, and `app/api/health/ready/route.ts`, plus a reusable helper under `lib/`. Existing route business logic and response contracts remain unchanged.

### UI/UX

No changes proposed. The endpoints have no user-facing screen or workflow.

## 5. Implementation Handoff

**Classification:** Moderate, because a cross-cutting backlog story and explicit privacy/auth exceptions need to be recorded before implementation.

**Recipients:** Product Owner / Developer (same solo project owner may fulfill both roles).

**Responsibilities:**


**Success criteria:** All H-5 acceptance criteria pass; metrics use one registry with bounded labels; all 23 existing handler exports are accounted for; route contracts remain unchanged; health responses remain sanitized; and TypeScript, lint, tests, and build pass. The final implementation report must distinguish local/mock endpoint checks from any production-service checks not run.

**Handoff state:** Approved for implementation. PRD, architecture, Epic H, and sprint-status amendments have been recorded; implementation and verification are in progress.
