import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/metrics", () => {
  it("returns Prometheus metrics without instrumenting itself", async () => {
    const response = await GET();
    const exposition = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(exposition).toContain("http_requests_total");
    expect(exposition).toContain("http_request_duration_seconds");
    expect(exposition).toContain("http_endpoint_requests_total");
    expect(exposition).toContain("process_cpu_user_seconds_total");
    expect(exposition).toContain("nodejs_eventloop_lag_seconds");
    expect(exposition).toContain("nodejs_gc_duration_seconds");
    expect(exposition).not.toContain('route="/api/metrics"');
  });
});