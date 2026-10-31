import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkProcess, checkSupabase } from "./health";

const { getServiceRoleKey, getSupabaseUrl } = vi.hoisted(() => ({
  getServiceRoleKey: vi.fn(),
  getSupabaseUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({
  getServiceRoleKey,
  getSupabaseUrl,
}));

describe("health checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseUrl.mockReturnValue("https://supabase.example.test");
    getServiceRoleKey.mockReturnValue("server-only-secret");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports process liveness without calling a dependency", () => {
    expect(checkProcess()).toEqual({ status: "available" });
  });

  it("checks Supabase Auth health with the server-only secret and no user JWT", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await expect(checkSupabase()).resolves.toEqual({ status: "available" });
    expect(fetch).toHaveBeenCalledWith(
      new URL("https://supabase.example.test/auth/v1/health"),
      expect.objectContaining({
        headers: { apikey: "server-only-secret" },
        signal: expect.any(AbortSignal),
        cache: "no-store",
      }),
    );
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).not.toHaveProperty("Authorization");
  });

  it("reports an unavailable Supabase Auth service without response details", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("private detail", { status: 503 }));

    await expect(checkSupabase()).resolves.toEqual({ status: "unavailable" });
  });

  it("turns thrown dependency errors into a sanitized unavailable result", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("secret connection detail"));

    await expect(checkSupabase()).resolves.toEqual({ status: "unavailable" });
  });

  it("reports unavailable when the Supabase URL is not configured", async () => {
    getSupabaseUrl.mockImplementation(() => {
      throw new Error("missing config");
    });

    await expect(checkSupabase()).resolves.toEqual({ status: "unavailable" });
    expect(fetch).not.toHaveBeenCalled();
  });
});