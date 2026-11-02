---
title: "HTTP Observability and Health Checks"
type: "feature"
created: "2026-10-31"
status: "in-review"
route: "dispatch"
review_loop_iteration: 0
context: []
baseline_commit: "adf2e5a5ad35902e1606ecfada15beb733664a93"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Archer has no Prometheus instrumentation or health endpoints, so API request volume, latency, availability, process health, and critical Supabase readiness cannot be inspected consistently. Current privacy/auth rules also do not explicitly permit public operational endpoints.

**Approach:** Add a reusable, process-local HTTP instrumentation helper and singleton Prometheus default-registry metrics, apply it to every existing API handler with explicit bounded route templates and endpoint-specific expected statuses, and add sanitized health/live/ready endpoints. Update the approved PRD/architecture/Epic H artifacts and document metrics, usage, health checks, and PromQL.

## Boundaries & Constraints

**Always:** Preserve every existing handler response and business behavior; pass the App Router context through unchanged; use `performance.now()`; label only by method, fixed route template, status code, and bounded availability outcome; record thrown errors as 500/unavailable then rethrow; classify expected non-5xx status codes per handler and all 5xx as unavailable; use one registry with registration safe across hot reload; do not instrument `/api/metrics`; use the Prometheus content type; expose only sanitized health results; readiness verifies database connectivity with one bounded `goals.id` query through a server-only Supabase client using `SUPABASE_SERVICE_ROLE_KEY`; this fixed read bypasses RLS and returns no row data; never send a publishable/anon key or user JWT; reject redirects to prevent forwarding the secret; tests use mocks, not production services.

**Never:** Log request bodies, authorization/cookie headers, raw URLs/query strings, user IDs, secrets, or raw dependency errors. Never expose the service-role secret to a client, response, metric, or log. Do not change API contracts, add a monitoring vendor/exporter, create a database migration, or mark AI providers critical for general readiness. Public metrics and health endpoints are the only new unauthenticated operational surfaces.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Expected client response | Wrapped handler returns a configured 4xx | Original response preserved; outcome available | No error log |
| Unexpected server response | Handler returns 5xx | Original response preserved; outcome unavailable | Structured sanitized log |
| Handler throws | Wrapped handler throws | Record 500/unavailable and rethrow | Next.js retains framework error behavior |
| Readiness dependency fails | Supabase probe fails/times out | Ready and aggregate health return 503 with bounded failed check | No sensitive detail returned |

</frozen-after-approval>

## Code Map

- `app/api/**/route.ts` -- 19 existing route modules, 23 handler exports. Wrap every current handler (POST/PUT/PATCH/DELETE), pass through dynamic `context`, define the template and endpoint-specific expected statuses. Existing auth and business logic remain untouched.
- `app/api/metrics/route.ts` -- new GET exposition endpoint; exclude from instrumentation.
- `app/api/health/route.ts`, `app/api/health/live/route.ts`, `app/api/health/ready/route.ts` -- public operational probes; instrument health routes but not metrics.
- `lib/observability/http.ts` -- shared metrics, safe singleton setup, wrapper, and availability classification. Use `prom-client` default `register`; no second registry exists today.
- `lib/observability/health.ts` -- bounded database probe using one `goals.id` read with a server-only service-role Supabase client; redirects are rejected and the secret is not exposed or logged.
- `package.json`, `package-lock.json` -- install and pin only `prom-client`.
- `app/api/**/route.test.ts`, `lib/observability/*.test.ts` -- extend route tests and cover wrapper, health, and metrics without production dependencies.
- `docs/http-observability.md` -- usage, expected statuses, health-check extension, metrics, and PromQL.
- `_bmad-output/planning-artifacts/{prds/prd-GTDGoalandProjectCreator-2026-08-20/prd.md,architecture/architecture-GTDGoalandProjectCreator-2026-08-20/ARCHITECTURE-SPINE.md,epics.md}` and `_bmad-output/implementation-artifacts/{epic-H-context.md,sprint-status.yaml}` -- record approved H-5 scope and narrow operational exceptions. Do not modify the completed/frozen H-2 spec.

## Tasks & Acceptance

**Execution:**
- [x] Add pinned `prom-client`, singleton HTTP counters/histogram, wrapper, route template config, and sanitized structured exception logging.
- [x] Instrument all 23 existing exports with method, fixed template, and per-handler expected statuses; retain response/context behavior; exclude metrics endpoint.
- [x] Add bounded Supabase readiness check and aggregate, live, and ready routes with sanitized JSON and correct 200/503 status.
- [x] Add focused tests for methods, async/context passthrough, expected 4xx, 5xx, thrown errors, duration, dynamic templates, singleton behavior, health success/failure, and metrics exposition.
- [x] Add Prometheus/health documentation and example PromQL for request rate, error rate, average/P95 latency, and endpoint availability.
- [x] Apply approved PRD, architecture, Epic H-5, context, sprint-status, and proposal status updates.

**Acceptance Criteria:**
- Given any existing instrumented route, when called, then its original status, headers, and body are unchanged and exactly one request observation is recorded using the fixed route template.
- Given an expected 4xx response, when classified, then it is available; given an unexpected response or any 5xx, then it is unavailable.
- Given a thrown exception, when the wrapper observes it, then it records 500/unavailable and rethrows it.
- Given `/api/metrics`, when scraped, then all three HTTP metrics and available default process/event-loop/GC metrics are returned with the correct content type and no self-observation.
- Given live/readiness/aggregate health requests, when process and dependency states vary, then liveness checks only the process and readiness/aggregate return 503 for failed Supabase connectivity without sensitive detail.
- Given concurrent/hot-reloaded module initialization, when metrics are registered, then each metric exists once in the default registry.
- Given mocked tests and verification commands, when run, then they pass without contacting production services.

## Implementation Notes

- Pinned `prom-client@15.1.3` as requested. npm reports this release deprecated in favor of `@prometheus-io/client`; retained `prom-client` to follow the approved dependency requirement.
- At the user's direction, readiness uses a server-only Supabase client configured with `SUPABASE_SERVICE_ROLE_KEY` and performs one `goals.id` read limited to one row, with a 2-second abort signal. Supabase client redirects are rejected so the secret is not forwarded to another origin. The result is reduced to available/unavailable; no row data or secret reaches the response, metrics, or logs. The service-role query bypasses RLS and verifies Postgres/Data API connectivity.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `docker compose config -q` passed. `npm run test` ran 1,104 tests: 1,103 passed and one unrelated existing `Sidebar.test.tsx` assertion failed because the rendered navigation includes Someday while its expected list does not.
- Focused observability tests passed: 24 tests across the helper, route coverage, health checks, and exposition. They verify all 26 instrumented methods have fixed templates and exact expected-status maps, along with bounded database probing and redirect rejection. Metrics exposition verified the three HTTP names, process/event-loop/GC series, content type, and no self-observation.
- The pre-database-probe HTTP smoke returned 200 for liveness; its earlier readiness response used the then-current Auth health probe and is not evidence for the final database query. No production database probe was run. Mocked tests cover ready/unready behavior without production services.
- Docker Compose now checks `/api/health/live`, keeping container liveness independent of Supabase readiness. `docker compose config -q` validates the compose file.

## Spec Change Log

- User reported readiness 503 due to unauthenticated access to the RLS-protected `goals` table and directed the check to use a Supabase endpoint that does not require user authentication. The initial implementation used `/auth/v1/health`; review identified that this did not check Postgres, so readiness now makes a bounded service-role database query instead.
- User explicitly renegotiated the probe credential rule: use the server-side secret key only, never a publishable/anon key. Readiness now sends `SUPABASE_SERVICE_ROLE_KEY` only as the server-side `apikey` header, with no user JWT and no secret in output/logs/metrics.
- Implementation review replaced the Auth-only endpoint probe with the service-role Supabase client query. The server client may use the service-role secret for Supabase request authentication; no end-user JWT or publishable/anon key is used, and the secret is never exposed outside the server-side request.
- Review identified that the Auth health endpoint does not test the database required by Archer. Readiness now performs one bounded server-side `goals.id` query using the service-role client, rejects redirects, and documents that the probe bypasses RLS while returning no row data.

## Design Notes

Availability is deliberately status-aware: any 5xx is unavailable even if a route lists it as a known response; configured expected statuses prevent normal auth/validation/not-found results from being mislabeled. Prometheus state is process-local; in serverless or multi-instance deployments each process exposes its own partial view. This change adds no external scraper or durable aggregation.

## Verification

**Commands:**
- `npx tsc --noEmit` -- no type errors.
- `npm run lint` -- clean.
- `npm run test` -- 1,105 passed; one unrelated Sidebar navigation expectation failed (1106 total).
- `npm run build` -- successful production build.

**Manual checks:**
- Scrape `/api/metrics`; verify metric names, process/event-loop/GC series where supported, and Prometheus content type.
- Exercise `/api/health`, `/api/health/live`, and `/api/health/ready` with mocked dependency states; verify 200/503 and sanitized JSON.
