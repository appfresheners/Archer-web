import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "./route";

// --- Mocks -----------------------------------------------------------------

const getUser = vi.fn();

// PATCH chain: from("goals").update(patch).eq("id",id).eq("user_id",uid).select("id").maybeSingle()
const goalUpdate = vi.fn();
const goalUpdateMaybeSingle = vi.fn();

// DELETE chains:
//   read goal:  from("goals").select("id").eq("id",id).eq("user_id",uid).maybeSingle()
//   archive:    rpc("archive_goal_cascade", { p_goal_id })
const goalReadMaybeSingle = vi.fn();
const rpcCall = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc: (fn: string, args: unknown) => rpcCall(fn, args),
    from: () => ({
      update: (patch: unknown) => {
        goalUpdate(patch);
        return {
          eq: () => ({
            eq: () => ({ select: () => ({ maybeSingle: () => goalUpdateMaybeSingle() }) }),
          }),
        };
      },
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: () => goalReadMaybeSingle() }) }),
      }),
    }),
  }),
}));

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/goals/g1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

const ctx = (id = "g1") => ({ params: Promise.resolve({ id }) });

describe("PATCH /api/goals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(patchRequest({ status: "paused" }) as never, ctx());
    expect(res.status).toBe(401);
  });

  it("400s on an invalid patch (unknown status)", async () => {
    const res = await PATCH(patchRequest({ status: "nope" }) as never, ctx());
    expect(res.status).toBe(400);
    expect(goalUpdate).not.toHaveBeenCalled();
  });

  it("updates a valid patch and returns the id", async () => {
    goalUpdateMaybeSingle.mockResolvedValue({ data: { id: "g1" }, error: null });
    const res = await PATCH(patchRequest({ status: "paused" }) as never, ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "g1" });
    expect(goalUpdate).toHaveBeenCalledWith({ status: "paused" });
  });

  it("404s when no owned row matches", async () => {
    goalUpdateMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(patchRequest({ status: "paused" }) as never, ctx());
    expect(res.status).toBe(404);
  });

  it("500s on a db error", async () => {
    goalUpdateMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const res = await PATCH(patchRequest({ status: "paused" }) as never, ctx());
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/goals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE({} as never, ctx());
    expect(res.status).toBe(401);
  });

  it("404s when the goal is absent or not owned", async () => {
    goalReadMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await DELETE({} as never, ctx());
    expect(res.status).toBe(404);
    expect(rpcCall).not.toHaveBeenCalled();
  });

  it("archives the goal and its projects in one atomic RPC (soft delete cascade)", async () => {
    goalReadMaybeSingle.mockResolvedValue({ data: { id: "g1" }, error: null });
    rpcCall.mockResolvedValue({ data: null, error: null });

    const res = await DELETE({} as never, ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "g1" });
    // The whole cascade (goal + projects) is one RPC call.
    expect(rpcCall).toHaveBeenCalledTimes(1);
    expect(rpcCall).toHaveBeenCalledWith("archive_goal_cascade", { p_goal_id: "g1" });
  });

  it("500s when the archive RPC fails", async () => {
    goalReadMaybeSingle.mockResolvedValue({ data: { id: "g1" }, error: null });
    rpcCall.mockResolvedValue({ data: null, error: { message: "boom" } });

    const res = await DELETE({} as never, ctx());
    expect(res.status).toBe(500);
  });

  it("404s when the archive RPC reports the goal is gone (P0002)", async () => {
    goalReadMaybeSingle.mockResolvedValue({ data: { id: "g1" }, error: null });
    rpcCall.mockResolvedValue({
      data: null,
      error: { message: "gone", code: "P0002" },
    });

    const res = await DELETE({} as never, ctx());
    expect(res.status).toBe(404);
  });

  it("500s when the goal read fails", async () => {
    goalReadMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await DELETE({} as never, ctx());
    expect(res.status).toBe(500);
    expect(rpcCall).not.toHaveBeenCalled();
  });
});
