import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const getUser = vi.fn();
const actionUpdate = vi.fn();
const updateMaybeSingle = vi.fn();

// from("actions").update({status:'committed'}).eq("id").eq("user_id").select("id").maybeSingle()
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      update: (patch: unknown) => {
        actionUpdate(patch);
        return {
          eq: () => ({
            eq: () => ({ select: () => ({ maybeSingle: () => updateMaybeSingle() }) }),
          }),
        };
      },
    }),
  }),
}));

const ctx = (id = "a1") => ({ params: Promise.resolve({ id }) });

describe("POST /api/actions/[id]/commit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(401);
    expect(actionUpdate).not.toHaveBeenCalled();
  });

  it("commits the owned action (status -> committed) and returns the id", async () => {
    updateMaybeSingle.mockResolvedValue({ data: { id: "a1" }, error: null });
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "a1" });
    // The DB trigger handles decommitting siblings; the route just sets committed.
    expect(actionUpdate).toHaveBeenCalledWith({ status: "committed" });
  });

  it("404s when the action is absent or not owned", async () => {
    updateMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(404);
  });

  it("409s when another action is already committed for the project (unique backstop)", async () => {
    updateMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "duplicate key", code: "23505" },
    });
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "Another action is already committed for this project.",
    });
  });

  it("500s on a db error", async () => {
    updateMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(500);
  });
});
