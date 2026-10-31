# HTTP Observability

Archer exposes process-local Prometheus metrics at `GET /api/metrics`. This is a public operational endpoint intended for a Prometheus scraper. The application does not send metrics to an external service. Because counters are in memory, each Node.js process or deployment instance reports its own measurements; aggregate replicas in the scraper.

## Instrument a Route

Wrap the route's existing async handler with `withHttpMetrics` from `@/lib/observability/http`. Set the HTTP method, a fixed route template, and expected status codes explicitly. Pass all handler arguments through so App Router context and promise-based dynamic params remain available.

```ts
import { withHttpMetrics } from "@/lib/observability/http";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getProduct(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return NextResponse.json({ id });
}

export const GET = withHttpMetrics(
  {
    method: "GET",
    route: "/api/products/[id]",
    expectedStatusCodes: [200, 404],
  },
  getProduct,
);
```

Expected statuses are specific to the endpoint contract. For example, login may treat `200`, `400`, `401`, and `422` as expected; resource creation may expect `201`; deletion may expect `200` and `204`. An expected non-5xx response is `available`. Any 5xx is always `unavailable`, even if accidentally listed as expected. A thrown handler error is observed as `500/unavailable` and rethrown, preserving Next.js error handling. The original response body, headers, and status are not rewritten.

Use only fixed route templates such as `/api/projects/[id]`. Never use the request URL, query string, user ID, request body, or other per-request values as a label. The metrics and operational logs contain no credentials or raw exception messages.

`/api/metrics` deliberately does not wrap itself. Its text response uses the Prometheus exposition content type and the same default registry as the HTTP metrics and Node.js default metrics.

## Health Checks

- `GET /api/health/live` checks only whether the application process is alive. It does not call Supabase or another external service.
- `GET /api/health/ready` checks the Supabase Auth service at `/auth/v1/health` with the server-side `SUPABASE_SERVICE_ROLE_KEY` in the `apikey` header and no end-user JWT. Never use a publishable/anon key for this server-side check. The secret is not returned or logged. It returns `503` if the service check fails.
- `GET /api/health` reports both process and Supabase Auth service check results and returns `503` if either is unavailable.

Responses contain an overall status and named `available`/`unavailable` checks only. They do not include credentials, connection strings, or dependency error details.

This check establishes that Supabase Auth is responding; it does not prove that a particular RLS-protected table is readable or independently verify Postgres. To add another critical dependency check, implement a small bounded server-side function in `lib/observability/health.ts` that returns only a status, handles errors internally, and does not expose or log raw error messages. Add it to readiness and aggregate health only if required for core product flows. Keep liveness dependency-free. Add mocked tests for success and failure; tests must not contact production services.

## Metrics

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Total requests to instrumented routes |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Request duration in seconds; buckets `0.01`, `0.025`, `0.05`, `0.1`, `0.25`, `0.5`, `1`, `2.5`, `5` |
| `http_endpoint_requests_total` | Counter | `method`, `route`, `status_code`, `outcome` | Requests grouped by `available` or `unavailable` |

`/api/metrics` also exposes `prom-client` Node.js process, event-loop, and garbage-collection metrics. All application metrics use one process-level default registry and are registered once across development hot reloads.

## PromQL Examples

Request rate across all instrumented routes:

```promql
sum(rate(http_requests_total[5m]))
```

5xx response rate as a share of all requests:

```promql
sum(rate(http_requests_total{status_code=~"5.."}[5m]))
/ sum(rate(http_requests_total[5m]))
```

Average request latency over five minutes:

```promql
sum(rate(http_request_duration_seconds_sum[5m]))
/ sum(rate(http_request_duration_seconds_count[5m]))
```

P95 request latency across routes:

```promql
histogram_quantile(
  0.95,
  sum by (le) (rate(http_request_duration_seconds_bucket[5m]))
)
```

Availability ratio by endpoint:

```promql
sum by (method, route) (
  rate(http_endpoint_requests_total{outcome="available"}[5m])
)
/ sum by (method, route) (rate(http_endpoint_requests_total[5m]))
```