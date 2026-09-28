import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const getUser = vi.fn();
const projectUpdate = vi.fn();
const projectUpdateMaybeSingle = vi.fn();

// PATCH chain: from("projects").update(patch).eq("id",id).eq("user_id",uid).select("id").maybeSingle()
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      update: (patch: unknown) => {
        projectUpdate(patch);
        return {
          eq: () => ({
            eq: () => ({
              select: () => ({ maybeSingle: () => projectUpdateMaybeSingle() }),
            }),
          }),
        };
      },
    }),
  }),
}));

function patchReq(body: unknown): Request {
  return new Request("http://localhost/api/projects/p1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
const ctx = (id = "p1") => ({ params: Promise.resolve({ id }) });

describe("PATCH /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(patchReq({ status: "paused" }) as never, ctx());
    expect(res.status).toBe(401);
  });

  it("400s on an invalid patch (goal-only status)", async () => {
    const res = await PATCH(patchReq({ status: "someday" }) as never, ctx());
    expect(res.status).toBe(400);
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("updates and returns the id on a valid patch", async () => {
    projectUpdateMaybeSingle.mockResolvedValue({ data: { id: "p1" }, error: null });
    const res = await PATCH(
      patchReq({ name: "Renamed", status: "completed" }) as never,
      ctx(),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "p1" });
    expect(projectUpdate).toHaveBeenCalledWith({
      name: "Renamed",
      status: "completed",
    });
  });

  it("404s when no owned row matches", async () => {
    projectUpdateMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(patchReq({ status: "paused" }) as never, ctx());
    expect(res.status).toBe(404);
  });

  it("500s on a db error", async () => {
    projectUpdateMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const res = await PATCH(patchReq({ status: "paused" }) as never, ctx());
    expect(res.status).toBe(500);
  });
});
