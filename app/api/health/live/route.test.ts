import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { checkProcess, checkSupabase } = vi.hoisted(() => ({
  checkProcess: vi.fn(),
  checkSupabase: vi.fn(),
}));

vi.mock("@/lib/observability/health", () => ({
  checkProcess,
  checkSupabase,
}));

describe("GET /api/health/live", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports process liveness without checking dependencies", async () => {
    checkProcess.mockReturnValue({ status: "available" });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "healthy" });
    expect(checkSupabase).not.toHaveBeenCalled();
  });

  it("returns 503 when the process check is unhealthy", async () => {
    checkProcess.mockReturnValue({ status: "unavailable" });

    const response = await GET();

    expect(response.status).toBe(503);
  });
});