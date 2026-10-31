---
title: "HTTP Observability and Health Checks"
type: "feature"
created: "2026-10-31"
status: "in-progress"
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

**Always:** Preserve every existing handler response and business behavior; pass the App Router context through unchanged; use `performance.now()`; label only by method, fixed route template, status code, and bounded availability outcome; record thrown errors as 500/unavailable then rethrow; classify expected non-5xx status codes per handler and all 5xx as unavailable; use one registry with registration safe across hot reload; do not instrument `/api/metrics`; use the Prometheus content type; expose only sanitized health results; readiness checks Supabase Auth at `/auth/v1/health` with a bounded timeout and the server-only `SUPABASE_SERVICE_ROLE_KEY` in the `apikey` header; never send a publishable/anon key or user JWT; tests use mocks, not production services.

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
- `lib/observability/health.ts` -- bounded unauthenticated Supabase Auth health probe and injectable fetch seam for tests. Do not send API keys or user tokens.
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
- At the user's direction, readiness uses `GET /auth/v1/health` with only the server-side `SUPABASE_SERVICE_ROLE_KEY` in the `apikey` header and a 2-second abort signal. It sends no publishable/anon key or user JWT and returns only available/unavailable. The secret never reaches the client, response, metrics, or logs. This confirms Supabase Auth service availability, not Postgres or table/RLS access.
- `npm run lint`, `npx tsc --noEmit`, and `npm run build` passed. `npm run test` ran 1,103 tests: 1,102 passed and one unrelated existing `Sidebar.test.tsx` assertion failed because the rendered navigation includes Someday while its expected list does not.
- Focused observability tests passed: 20 tests across the helper, health checks, and route exposition; the singleton-focused helper suite passed 10 tests. Metrics exposition verified the three HTTP names, process/event-loop/GC series, content type, and no self-observation.
- An HTTP smoke request to liveness returned 200. The readiness and aggregate smoke requests returned healthy despite the intended loopback override; Next.js may have retained build-time public Supabase configuration. The server was stopped, and these responses are not treated as dependency-failure verification. Mocked tests cover ready/unready behavior without production services.

## Spec Change Log

- User reported readiness 503 due to unauthenticated access to the RLS-protected `goals` table and directed the check to use a Supabase endpoint that does not require user authentication. Updated readiness to the documented public Supabase Auth `/auth/v1/health` endpoint; this avoids the false RLS failure and explicitly does not claim database-level health.
- User explicitly renegotiated the probe credential rule: use the server-side secret key only, never a publishable/anon key. Readiness now sends `SUPABASE_SERVICE_ROLE_KEY` only as the server-side `apikey` header, with no user JWT and no secret in output/logs/metrics.

## Design Notes

Availability is deliberately status-aware: any 5xx is unavailable even if a route lists it as a known response; configured expected statuses prevent normal auth/validation/not-found results from being mislabeled. Prometheus state is process-local; in serverless or multi-instance deployments each process exposes its own partial view. This change adds no external scraper or durable aggregation.

## Verification

**Commands:**
- `npx tsc --noEmit` -- no type errors.
- `npm run lint` -- clean.
- `npm run test` -- 1,102 passed; one unrelated Sidebar navigation expectation failed.
- `npm run build` -- successful production build.

**Manual checks:**
- Scrape `/api/metrics`; verify metric names, process/event-loop/GC series where supported, and Prometheus content type.
- Exercise `/api/health`, `/api/health/live`, and `/api/health/ready` with mocked dependency states; verify 200/503 and sanitized JSON.
