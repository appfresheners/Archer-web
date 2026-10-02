import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH, POST } from "./route";

const getUser = vi.fn();
const projectOwnMaybeSingle = vi.fn();
const maxSort = vi.fn();
const actionInsertSingle = vi.fn();
const actionInsert = vi.fn();
const rpcCall = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc: (fn: string, args: unknown) => rpcCall(fn, args),
    from: (table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: () => projectOwnMaybeSingle() }) }),
          }),
        };
      }
      // actions
      return {
        // append lookup: select("sort_order").eq().order().limit()
        select: () => ({ eq: () => ({ order: () => ({ limit: () => maxSort() }) }) }),
        insert: (row: unknown) => {
          actionInsert(row);
          return { select: () => ({ single: () => actionInsertSingle() }) };
        },
      };
    },
  }),
}));

function req(body: unknown, method: string): Request {
  return new Request("http://localhost/api/projects/p1/actions", {
    method,
    body: JSON.stringify(body),
  });
}
const ctx = (id = "p1") => ({ params: Promise.resolve({ id }) });

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const U3 = "33333333-3333-4333-8333-333333333333";
const U4 = "44444444-4444-4444-8444-444444444444";

describe("POST /api/projects/[id]/actions (add)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    projectOwnMaybeSingle.mockResolvedValue({ data: { id: "p1" }, error: null });
    maxSort.mockResolvedValue({ data: [{ sort_order: 4 }], error: null });
    actionInsertSingle.mockResolvedValue({ data: { id: "a-new" }, error: null });
  });

  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ text: "x" }, "POST") as never, ctx());
    expect(res.status).toBe(401);
  });

  it("400s on empty text", async () => {
    const res = await POST(req({ text: "   " }, "POST") as never, ctx());
    expect(res.status).toBe(400);
    expect(actionInsert).not.toHaveBeenCalled();
  });

  it("404s when the project is not owned", async () => {
    projectOwnMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST(req({ text: "Do it" }, "POST") as never, ctx());
    expect(res.status).toBe(404);
  });

  it("appends a new action with the next sort_order", async () => {
    const res = await POST(req({ text: "Do it" }, "POST") as never, ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "a-new" });
    expect(actionInsert).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: "p1", text: "Do it", sort_order: 5 }),
    );
  });

  it("starts sort_order at 0 for the first action", async () => {
    maxSort.mockResolvedValue({ data: [], error: null });
    await POST(req({ text: "First" }, "POST") as never, ctx());
    expect(actionInsert).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 0 }),
    );
  });
});

describe("PATCH /api/projects/[id]/actions (reorder)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    projectOwnMaybeSingle.mockResolvedValue({ data: { id: "p1" }, error: null });
    rpcCall.mockResolvedValue({ data: null, error: null });
  });

  it("400s on a missing/empty ordered list", async () => {
    const res = await PATCH(req({}, "PATCH") as never, ctx());
    expect(res.status).toBe(400);
  });

  it("rejects a reorder whose set does not match the project's actions (400)", async () => {
    rpcCall.mockResolvedValue({
      data: null,
      error: { message: "mismatch", code: "22000" },
    });
    const res = await PATCH(
      req({ orderedIds: [U1, U2, U4] }, "PATCH") as never,
      ctx(),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a reorder with duplicate ids", async () => {
    const res = await PATCH(
      req({ orderedIds: ["a1", "a1", "a2"] }, "PATCH") as never,
      ctx(),
    );
    expect(res.status).toBe(400);
    expect(rpcCall).not.toHaveBeenCalled();
  });

  it("persists sort_order for an exact-match reorder via one atomic RPC", async () => {
    const res = await PATCH(
      req({ orderedIds: [U3, U1, U2] }, "PATCH") as never,
      ctx(),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    // One RPC call with the project id and the full ordered id list.
    expect(rpcCall).toHaveBeenCalledTimes(1);
    expect(rpcCall).toHaveBeenCalledWith("reorder_project_actions", {
      p_project_id: "p1",
      p_action_ids: [U3, U1, U2],
    });
  });

  it("500s when the reorder RPC fails", async () => {
    rpcCall.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await PATCH(
      req({ orderedIds: [U1, U2, U3] }, "PATCH") as never,
      ctx(),
    );
    expect(res.status).toBe(500);
  });

  it("404s when the reorder RPC reports the project is gone (P0002)", async () => {
    rpcCall.mockResolvedValue({
      data: null,
      error: { message: "gone", code: "P0002" },
    });
    const res = await PATCH(
      req({ orderedIds: [U1, U2, U3] }, "PATCH") as never,
      ctx(),
    );
    expect(res.status).toBe(404);
  });

  it("400s on a non-UUID action id", async () => {
    const res = await PATCH(
      req({ orderedIds: ["not-a-uuid"] }, "PATCH") as never,
      ctx(),
    );
    expect(res.status).toBe(400);
    expect(rpcCall).not.toHaveBeenCalled();
  });
});
