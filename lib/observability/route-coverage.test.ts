import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(process.cwd(), "app/api");
const supportedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const expectedStatuses: Record<string, number[]> = {
  "POST /api/actions/[id]/commit": [200, 401, 404, 409],
  "PATCH /api/actions/[id]": [200, 400, 401, 404],
  "DELETE /api/actions/[id]": [200, 401, 404],
  "POST /api/actions": [200, 400, 401],
  "PATCH /api/areas/[id]": [200, 400, 401, 404],
  "PATCH /api/areas/reorder": [200, 400, 401],
  "POST /api/areas": [200, 400, 401],
  "PUT /api/focus/profile": [200, 400, 401],
  "POST /api/generate": [200, 400, 401],
  "POST /api/goals/[id]/monthly-check": [200, 400, 401, 404],
  "PATCH /api/goals/[id]": [200, 400, 401, 404],
  "DELETE /api/goals/[id]": [200, 401, 404],
  "PATCH /api/inbox/[id]": [200, 400, 401, 404],
  "DELETE /api/inbox/[id]": [200, 401, 404],
  "POST /api/inbox": [200, 400, 401],
  "POST /api/projects/[id]/actions": [200, 400, 401, 404],
  "PATCH /api/projects/[id]/actions": [200, 400, 401, 404],
  "POST /api/projects/[id]/regenerate": [200, 401, 404],
  "PATCH /api/projects/[id]": [200, 400, 401, 404],
  "POST /api/projects": [200, 400, 401],
  "POST /api/review/[id]/complete": [200, 400, 401, 404],
  "PATCH /api/review/[id]": [200, 400, 401, 404],
  "POST /api/review": [200, 401],
  "GET /api/health/live": [200],
  "GET /api/health/ready": [200, 503],
  "GET /api/health": [200, 503],
};

function findRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return findRouteFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

describe("API route instrumentation coverage", () => {
  it("wraps every supported route method with a fixed route and explicit expected statuses", () => {
    let instrumentedHandlerCount = 0;
    const routeFiles = findRouteFiles(apiRoot);

    for (const filePath of routeFiles) {
      const relativePath = relative(apiRoot, filePath).replaceAll("\\", "/");
      const source = readFileSync(filePath, "utf8");
      const exports = source.matchAll(
        /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b|export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=/g,
      );

      for (const exportedMethod of exports) {
        const method = exportedMethod[1] ?? exportedMethod[2];
        if (!supportedMethods.has(method)) continue;

        if (relativePath === "metrics/route.ts") {
          expect(source).not.toMatch(/export\s+const\s+GET\s*=\s*withHttpMetrics\(/);
          continue;
        }

        const exportLine = `export const ${method} = withHttpMetrics(`;
        const wrapperStart = source.indexOf(exportLine);
        expect(wrapperStart, `${relativePath} ${method} is instrumented`).toBeGreaterThanOrEqual(0);

        const wrapperEnd = source.indexOf("\n);", wrapperStart);
        expect(wrapperEnd, `${relativePath} ${method} wrapper closes`).toBeGreaterThan(wrapperStart);
        const wrapper = source.slice(wrapperStart, wrapperEnd);
        const route = wrapper.match(/route:\s*["']([^"']+)["']/)?.[1];

        expect(route, `${relativePath} ${method} has a static route template`).toMatch(/^\/api\//);
        expect(route).not.toContain("${");
        const statusList = wrapper.match(/expectedStatusCodes:\s*\[([^\]]+)\]/)?.[1];
        const configuredStatuses = statusList
          ?.split(",")
          .map((statusCode) => Number(statusCode.trim()));
        expect(configuredStatuses, `${method} ${route} expected statuses`).toEqual(
          expectedStatuses[`${method} ${route}`],
        );
        instrumentedHandlerCount += 1;
      }
    }

    expect(instrumentedHandlerCount).toBe(Object.keys(expectedStatuses).length);
  });
});