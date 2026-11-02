import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { httpMetrics, metricsRegistry, withHttpMetrics } from "./http";

const metricSample = async (
  name: string,
  route: string,
  statusCode: string,
) => {
  const metric = metricsRegistry.getSingleMetric(name);
  const result = await metric?.get();
  return result?.values.find(
    (sample) =>
      sample.labels.route === route &&
      sample.labels.status_code === statusCode,
  );
};

describe("HTTP instrumentation", () => {
  beforeEach(() => {
    httpMetrics.requests.reset();
    httpMetrics.duration.reset();
    httpMetrics.endpointRequests.reset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["GET", "POST", "PUT", "PATCH", "DELETE"] as const)(
    "supports %s handlers",
    async (method) => {
      const route = `/api/test/${method.toLowerCase()}`;
      const wrapped = withHttpMetrics(
        { method, route, expectedStatusCodes: [200] },
        async () => Response.json({ ok: true }),
      );

      const response = await wrapped();

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect(
        await metricSample("http_requests_total", route, "200"),
      ).toMatchObject({ value: 1 });
      expect(
        await metricSample("http_endpoint_requests_total", route, "200"),
      ).toMatchObject({ value: 1 });
    },
  );

  it("preserves dynamic route context and classifies an expected 4xx as available", async () => {
    const route = "/api/products/[id]";
    const context = { params: Promise.resolve({ id: "product-123" }) };
    const handler = vi.fn(async (_request: Request, receivedContext: typeof context) => {
      expect(receivedContext).toBe(context);
      return new Response("unauthorized", { status: 401 });
    });
    const wrapped = withHttpMetrics(
      { method: "GET", route, expectedStatusCodes: [200, 401] },
      handler,
    );

    const response = await wrapped(
      new Request("https://example.test/api/products/product-123?token=secret"),
      context,
    );

    expect(response.status).toBe(401);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(
      await metricSample("http_endpoint_requests_total", route, "401"),
    ).toMatchObject({ value: 1, labels: { outcome: "available" } });
    const exposition = await metricsRegistry.metrics();
    expect(exposition).toContain('route="/api/products/[id]"');
    expect(exposition).not.toContain("product-123");
    expect(exposition).not.toContain("token=secret");
  });

  it("classifies unexpected 5xx responses as unavailable", async () => {
    const route = "/api/test/failure";
    const wrapped = withHttpMetrics(
      { method: "POST", route, expectedStatusCodes: [200, 500] },
      async () => new Response(null, { status: 503 }),
    );

    const response = await wrapped();

    expect(response.status).toBe(503);
    expect(
      await metricSample("http_endpoint_requests_total", route, "503"),
    ).toMatchObject({ value: 1, labels: { outcome: "unavailable" } });
  });

  it("records duration in seconds", async () => {
    const route = "/api/test/duration";
    const wrapped = withHttpMetrics(
      { method: "GET", route, expectedStatusCodes: [200] },
      async () => Response.json({ ok: true }),
    );

    await wrapped();

    const sample = await metricSample(
      "http_request_duration_seconds",
      route,
      "200",
    );
    expect(sample?.value).toBe(1);
    const exposition = await metricsRegistry.metrics();
    expect(exposition).toMatch(
      /http_request_duration_seconds_sum\{[^\n]*route="\/api\/test\/duration"[^\n]*\} [\d.eE+-]+/,
    );
  });

  it("keeps each custom metric registered once in the default registry", async () => {
    const names = (await metricsRegistry.getMetricsAsJSON()).map(
      (metric) => metric.name,
    );

    for (const name of [
      "http_requests_total",
      "http_request_duration_seconds",
      "http_endpoint_requests_total",
    ]) {
      expect(names.filter((registeredName) => registeredName === name)).toHaveLength(1);
    }
  });

  it("records thrown handlers as 500/unavailable and rethrows", async () => {
    const route = "/api/test/throws";
    const error = new Error("private provider detail");
    const wrapped = withHttpMetrics(
      { method: "PATCH", route, expectedStatusCodes: [200] },
      async () => {
        throw error;
      },
    );

    await expect(wrapped()).rejects.toBe(error);

    expect(
      await metricSample("http_requests_total", route, "500"),
    ).toMatchObject({ value: 1 });
    expect(
      await metricSample("http_endpoint_requests_total", route, "500"),
    ).toMatchObject({ value: 1, labels: { outcome: "unavailable" } });
    const [loggedEvent] = vi.mocked(console.error).mock.calls[0];
    expect(JSON.parse(String(loggedEvent))).toMatchObject({
      route,
      status_code: 500,
      outcome: "unavailable",
      failure_type: "exception",
    });
    expect(loggedEvent).not.toContain("private provider detail");
  });
});