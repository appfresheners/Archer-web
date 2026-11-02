import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkProcess, checkSupabase } from "./health";

const { createSupabaseClient, getServiceRoleKey, getSupabaseUrl } = vi.hoisted(() => ({
  createSupabaseClient: vi.fn(),
  getServiceRoleKey: vi.fn(),
  getSupabaseUrl: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createSupabaseClient,
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

  it("checks the database with the server-only secret and a bounded query", async () => {
    const abortSignal = vi.fn().mockResolvedValue({ error: null });
    const limit = vi.fn(() => ({ abortSignal }));
    const select = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ select }));
    createSupabaseClient.mockReturnValue({ from } as never);

    await expect(checkSupabase()).resolves.toEqual({ status: "available" });
    expect(createSupabaseClient).toHaveBeenCalledWith(
      "https://supabase.example.test",
      "server-only-secret",
      expect.objectContaining({
        auth: { autoRefreshToken: false, persistSession: false },
        global: { fetch: expect.any(Function) },
      }),
    );
    const options = vi.mocked(createSupabaseClient).mock.calls[0][2];
    const guardedFetch = options?.global?.fetch as typeof fetch;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await guardedFetch("https://supabase.example.test/rest/v1/goals", {});
    expect(fetchMock).toHaveBeenCalledWith(
      "https://supabase.example.test/rest/v1/goals",
      expect.objectContaining({ cache: "no-store", redirect: "error" }),
    );
    expect(from).toHaveBeenCalledWith("goals");
    expect(select).toHaveBeenCalledWith("id");
    expect(limit).toHaveBeenCalledWith(1);
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("rejects redirects so the service-role secret cannot be forwarded elsewhere", async () => {
    createSupabaseClient.mockReturnValue({
      from: () => ({
        select: () => ({
          limit: () => ({ abortSignal: () => ({ error: null }) }),
        }),
      }),
    } as never);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await checkSupabase();
    const options = vi.mocked(createSupabaseClient).mock.calls[0][2];
    const guardedFetch = options?.global?.fetch as typeof fetch;
    await guardedFetch("https://supabase.example.test/rest/v1/goals", {
      redirect: "follow",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://supabase.example.test/rest/v1/goals",
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("reports an unavailable database query without exposing error details", async () => {
    const abortSignal = vi.fn().mockResolvedValue({ error: { message: "private detail" } });
    createSupabaseClient.mockReturnValue({
      from: () => ({
        select: () => ({
          limit: () => ({ abortSignal }),
        }),
      }),
    } as never);

    await expect(checkSupabase()).resolves.toEqual({ status: "unavailable" });
  });

  it("turns thrown dependency errors into a sanitized unavailable result", async () => {
    createSupabaseClient.mockImplementation(() => {
      throw new Error("secret connection detail");
    });

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