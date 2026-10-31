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

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkProcess.mockReturnValue({ status: "available" });
    checkSupabase.mockResolvedValue({ status: "available" });
  });

  it("returns healthy status when process and Supabase are available", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "healthy",
      checks: {
        process: { status: "available" },
        supabase: { status: "available" },
      },
    });
  });

  it("returns 503 with sanitized check results when Supabase is unavailable", async () => {
    checkSupabase.mockResolvedValue({ status: "unavailable" });

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain('"status":"unhealthy"');
    expect(body).toContain('"supabase":{"status":"unavailable"}');
    expect(body).not.toContain("connection string");
  });
});