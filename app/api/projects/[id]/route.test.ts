import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const getUser = vi.fn();
const projectUpdate = vi.fn();
const projectUpdateMaybeSingle = vi.fn();
const goalMaybeSingle = vi.fn();
const areaMaybeSingle = vi.fn();
const projectParentMaybeSingle = vi.fn();
const areaEqCalls: [string, unknown][] = [];

// PATCH chain: from("projects").update(patch).eq("id",id).eq("user_id",uid).select("id").maybeSingle()
// Goal ownership chain: from("goals").select("id").eq("id",gid).eq("user_id",uid).maybeSingle()
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table === "goals") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: () => goalMaybeSingle() }),
            }),
          }),
        };
      }
      if (table === "areas_of_focus") {
        return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              areaEqCalls.push([column, value]);
              return {
                eq: (column2: string, value2: unknown) => {
                  areaEqCalls.push([column2, value2]);
                  return { maybeSingle: () => areaMaybeSingle() };
                },
              };
            },
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: () => projectParentMaybeSingle() }) }),
        }),
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
      };
    },
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
    areaEqCalls.length = 0;
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    projectParentMaybeSingle.mockResolvedValue({
      data: { id: "p1", goal_id: null },
      error: null,
    });
  });

  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(patchReq({ status: "paused" }) as never, ctx());
    expect(res.status).toBe(401);
  });

  it("400s on an invalid patch (goal-only status)", async () => {
    const res = await PATCH(patchReq({ status: "not_now" }) as never, ctx());
    expect(res.status).toBe(400);
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("accepts Someday as a project status", async () => {
    projectUpdateMaybeSingle.mockResolvedValue({ data: { id: "p1" }, error: null });
    const res = await PATCH(patchReq({ status: "someday" }) as never, ctx());
    expect(res.status).toBe(200);
    expect(projectUpdate).toHaveBeenCalledWith({ status: "someday" });
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

  it("links the project to a goal via goal_id", async () => {
    projectUpdateMaybeSingle.mockResolvedValue({ data: { id: "p1" }, error: null });
    const gid = "66666666-6666-4666-8666-666666666666";
    goalMaybeSingle.mockResolvedValue({ data: { id: gid }, error: null });
    const res = await PATCH(patchReq({ goal_id: gid }) as never, ctx());
    expect(res.status).toBe(200);
    expect(goalMaybeSingle).toHaveBeenCalled();
    expect(projectUpdate).toHaveBeenCalledWith({ goal_id: gid, area_id: null });
  });

  it("moves an Area-linked Project to a Goal in one update", async () => {
    const goalId = "66666666-6666-4666-8666-666666666666";
    goalMaybeSingle.mockResolvedValue({ data: { id: goalId }, error: null });
    projectParentMaybeSingle.mockResolvedValue({
      data: { id: "p1", goal_id: null, area_id: "area-1" },
      error: null,
    });
    projectUpdateMaybeSingle.mockResolvedValue({ data: { id: "p1" }, error: null });

    const res = await PATCH(patchReq({ goal_id: goalId }) as never, ctx());

    expect(res.status).toBe(200);
    expect(projectUpdate).toHaveBeenCalledTimes(1);
    expect(projectUpdate).toHaveBeenCalledWith({ goal_id: goalId, area_id: null });
  });

  it("assigns an owned Area to a standalone Project", async () => {
    const areaId = "66666666-6666-4666-8666-666666666666";
    areaMaybeSingle.mockResolvedValue({
      data: { id: areaId, archived_at: "2026-10-01T00:00:00Z" },
      error: null,
    });
    projectUpdateMaybeSingle.mockResolvedValue({ data: { id: "p1" }, error: null });

    const res = await PATCH(patchReq({ area_id: areaId }) as never, ctx());

    expect(res.status).toBe(200);
    expect(projectUpdate).toHaveBeenCalledWith({ area_id: areaId });
    expect(areaEqCalls).toContainEqual(["id", areaId]);
    expect(areaEqCalls).toContainEqual(["user_id", "u1"]);
  });

  it("rejects a foreign Area without updating", async () => {
    areaMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(
      patchReq({ area_id: "66666666-6666-4666-8666-666666666666" }) as never,
      ctx(),
    );
    expect(res.status).toBe(404);
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("returns 500 and does not update when the Area ownership query errors", async () => {
    areaMaybeSingle.mockResolvedValue({ data: null, error: { message: "offline" } });
    const res = await PATCH(
      patchReq({ area_id: "66666666-6666-4666-8666-666666666666" }) as never,
      ctx(),
    );
    expect(res.status).toBe(500);
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("does not allow a direct Area on an unchanged Goal-linked Project", async () => {
    projectParentMaybeSingle.mockResolvedValue({
      data: { id: "p1", goal_id: "goal-1" },
      error: null,
    });
    const res = await PATCH(
      patchReq({ area_id: "66666666-6666-4666-8666-666666666666" }) as never,
      ctx(),
    );
    expect(res.status).toBe(400);
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("rejects a foreign goal (404) and writes nothing", async () => {
    const gid = "77777777-7777-4777-8777-777777777777";
    goalMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(patchReq({ goal_id: gid }) as never, ctx());
    expect(res.status).toBe(404);
    expect(goalMaybeSingle).toHaveBeenCalled();
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("500s when the goal ownership check errors", async () => {
    const gid = "88888888-8888-4888-8888-888888888888";
    goalMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const res = await PATCH(patchReq({ goal_id: gid }) as never, ctx());
    expect(res.status).toBe(500);
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("clears the project's goal via goal_id null without an ownership check", async () => {
    projectUpdateMaybeSingle.mockResolvedValue({ data: { id: "p1" }, error: null });
    const res = await PATCH(patchReq({ goal_id: null }) as never, ctx());
    expect(res.status).toBe(200);
    expect(goalMaybeSingle).not.toHaveBeenCalled();
    expect(projectUpdate).toHaveBeenCalledWith({ goal_id: null });
  });

  it("400s on an invalid goal_id (non-uuid)", async () => {
    const res = await PATCH(patchReq({ goal_id: "nope" }) as never, ctx());
    expect(res.status).toBe(400);
    expect(projectUpdate).not.toHaveBeenCalled();
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
