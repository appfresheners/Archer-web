import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { checkSupabase } = vi.hoisted(() => ({
  checkSupabase: vi.fn(),
}));

vi.mock("@/lib/observability/health", () => ({
  checkSupabase,
}));

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ready when Supabase is available", async () => {
    checkSupabase.mockResolvedValue({ status: "available" });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ready" });
  });

  it("returns 503 when the critical dependency is unavailable", async () => {
    checkSupabase.mockResolvedValue({ status: "unavailable" });

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain('"status":"not_ready"');
    expect(body).not.toContain("database password");
  });
});