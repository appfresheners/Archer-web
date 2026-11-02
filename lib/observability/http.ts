import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  register,
} from "prom-client";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface HttpMetrics {
  requests: Counter<"method" | "route" | "status_code">;
  duration: Histogram<"method" | "route" | "status_code">;
  endpointRequests: Counter<"method" | "route" | "status_code" | "outcome">;
}

type GlobalWithHttpMetrics = typeof globalThis & {
  __archerHttpMetrics?: HttpMetrics;
};

const globalWithMetrics = globalThis as GlobalWithHttpMetrics;

if (!globalWithMetrics.__archerHttpMetrics) {
  globalWithMetrics.__archerHttpMetrics = {
    requests: new Counter({
      name: "http_requests_total",
      help: "Total HTTP requests handled by instrumented application routes.",
      labelNames: ["method", "route", "status_code"],
    }),
    duration: new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration for instrumented application routes.",
      labelNames: ["method", "route", "status_code"],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    }),
    endpointRequests: new Counter({
      name: "http_endpoint_requests_total",
      help: "HTTP requests grouped by endpoint availability outcome.",
      labelNames: ["method", "route", "status_code", "outcome"],
    }),
  };

  collectDefaultMetrics({ register });
}

export const httpMetrics = globalWithMetrics.__archerHttpMetrics;
export { register as metricsRegistry };

export interface HttpInstrumentationOptions {
  method: HttpMethod;
  route: string;
  expectedStatusCodes: readonly number[];
}

type RouteHandler<Args extends unknown[]> = (
  ...args: Args
) => Response | Promise<Response>;

function observeRequest(
  options: HttpInstrumentationOptions,
  expectedStatusCodes: ReadonlySet<number>,
  statusCode: number,
  durationSeconds: number,
  failureType: "response" | "exception",
): void {
  const status = String(statusCode);
  const outcome =
    statusCode >= 500 || !expectedStatusCodes.has(statusCode)
      ? "unavailable"
      : "available";
  const labels = {
    method: options.method,
    route: options.route,
    status_code: status,
  };

  httpMetrics.requests.inc(labels);
  httpMetrics.duration.observe(labels, durationSeconds);
  httpMetrics.endpointRequests.inc({ ...labels, outcome });

  if (outcome === "unavailable") {
    console.error(
      JSON.stringify({
        event: "http_request_unavailable",
        method: options.method,
        route: options.route,
        status_code: statusCode,
        outcome,
        failure_type: failureType,
      }),
    );
  }
}

export function withHttpMetrics<Args extends unknown[]>(
  options: HttpInstrumentationOptions,
  handler: RouteHandler<Args>,
): (...args: Args) => Promise<Response> {
  const expectedStatusCodes = new Set(options.expectedStatusCodes);

  return async (...args: Args): Promise<Response> => {
    const startedAt = performance.now();

    try {
      const response = await handler(...args);
      observeRequest(
        options,
        expectedStatusCodes,
        response.status,
        (performance.now() - startedAt) / 1000,
        "response",
      );
      return response;
    } catch (error) {
      observeRequest(
        options,
        expectedStatusCodes,
        500,
        (performance.now() - startedAt) / 1000,
        "exception",
      );
      throw error;
    }
  };
}