import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "./route";

// --- Mocks -----------------------------------------------------------------

const getUser = vi.fn();

// PATCH chain: from("goals").update(patch).eq("id",id).eq("user_id",uid).select("id").maybeSingle()
const goalUpdate = vi.fn();
const goalUpdateMaybeSingle = vi.fn();

// DELETE chains:
//   read goal:     from("goals").select("id").eq("id",id).eq("user_id",uid).maybeSingle()
//   read projects: from("projects").select("id").eq("goal_id",id).eq("user_id",uid)
//   archive projects: from("projects").update({status}).eq("goal_id",id).eq("user_id",uid)
//   archive goal:  from("goals").update({status}).eq("id",id).eq("user_id",uid)
const goalReadMaybeSingle = vi.fn();
const projectsRead = vi.fn();
const projectsArchive = vi.fn();
const goalArchive = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table === "goals") {
        return {
          update: (patch: unknown) => {
            goalUpdate(patch);
            return {
              eq: () => ({
                eq: () => {
                  // PATCH ends with .select().maybeSingle(); DELETE's goal
                  // archive ends at the second .eq() (awaited directly).
                  const archiveResult = goalArchive();
                  const promise = Promise.resolve(archiveResult);
                  return Object.assign(promise, {
                    select: () => ({ maybeSingle: () => goalUpdateMaybeSingle() }),
                  });
                },
              }),
            };
          },
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: () => goalReadMaybeSingle() }) }),
          }),
        };
      }
      // projects
      return {
        update: () => ({ eq: () => ({ eq: () => projectsArchive() }) }),
        select: () => ({ eq: () => ({ eq: () => projectsRead() }) }),
      };
    },
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
    expect(projectsArchive).not.toHaveBeenCalled();
  });

  it("archives the goal and its projects (soft delete cascade)", async () => {
    goalReadMaybeSingle.mockResolvedValue({ data: { id: "g1" }, error: null });
    projectsRead.mockResolvedValue({ data: [{ id: "p1" }, { id: "p2" }], error: null });
    projectsArchive.mockResolvedValue({ error: null });
    goalArchive.mockResolvedValue({ error: null });

    const res = await DELETE({} as never, ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "g1" });
    // Both projects and the goal were archived.
    expect(projectsArchive).toHaveBeenCalledTimes(1);
    expect(goalArchive).toHaveBeenCalledTimes(1);
  });

  it("skips the project archive when the goal has no projects", async () => {
    goalReadMaybeSingle.mockResolvedValue({ data: { id: "g1" }, error: null });
    projectsRead.mockResolvedValue({ data: [], error: null });
    goalArchive.mockResolvedValue({ error: null });

    const res = await DELETE({} as never, ctx());
    expect(res.status).toBe(200);
    expect(projectsArchive).not.toHaveBeenCalled();
    expect(goalArchive).toHaveBeenCalledTimes(1);
  });

  it("500s when the goal archive fails", async () => {
    goalReadMaybeSingle.mockResolvedValue({ data: { id: "g1" }, error: null });
    projectsRead.mockResolvedValue({ data: [], error: null });
    goalArchive.mockResolvedValue({ error: { message: "boom" } });

    const res = await DELETE({} as never, ctx());
    expect(res.status).toBe(500);
  });

  it("500s and does NOT archive the goal when the project archive fails", async () => {
    goalReadMaybeSingle.mockResolvedValue({ data: { id: "g1" }, error: null });
    projectsRead.mockResolvedValue({ data: [{ id: "p1" }], error: null });
    projectsArchive.mockResolvedValue({ error: { message: "boom" } });

    const res = await DELETE({} as never, ctx());
    expect(res.status).toBe(500);
    // Cascade halts before the goal is archived.
    expect(goalArchive).not.toHaveBeenCalled();
  });
});
