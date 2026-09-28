import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const getUser = vi.fn();
const generateProject = vi.fn();

vi.mock("@/lib/projects/generate-project", () => ({
  generateProject: (input: string, depth: string) => generateProject(input, depth),
}));

// Supabase chains used by the regenerate route:
//   read:    from("projects").select().eq("id").eq("user_id").maybeSingle()
//   update:  from("projects").update(fields).eq("id").eq("user_id")
//   snapshot:from("actions").select().eq("project_id").order()
//   delete:  from("actions").delete().eq("project_id").eq("user_id")
//   insert:  from("actions").insert(rows)
const projectReadMaybeSingle = vi.fn();
const projectUpdate = vi.fn();
const projectUpdateResult = vi.fn();
const actionsSnapshot = vi.fn();
const actionsDelete = vi.fn();
const actionsInsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: () => projectReadMaybeSingle() }) }),
          }),
          update: (fields: unknown) => {
            projectUpdate(fields);
            return { eq: () => ({ eq: () => projectUpdateResult() }) };
          },
        };
      }
      // actions
      return {
        select: () => ({ eq: () => ({ order: () => actionsSnapshot() }) }),
        delete: () => ({ eq: () => ({ eq: () => actionsDelete() }) }),
        insert: (rows: unknown) => actionsInsert(rows),
      };
    },
  }),
}));

const ctx = (id = "p1") => ({ params: Promise.resolve({ id }) });

const generated = {
  name: "Fresh name",
  purpose: "Fresh purpose",
  successful_outcome: "Fresh outcome",
  next_actions: Array.from({ length: 12 }, (_, i) => `Action ${i + 1}`),
  detail: null,
};

describe("POST /api/projects/[id]/regenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    projectReadMaybeSingle.mockResolvedValue({
      data: { id: "p1", name: "Old", purpose: "why", planning_depth: "minimal" },
      error: null,
    });
    projectUpdateResult.mockResolvedValue({ error: null });
    actionsSnapshot.mockResolvedValue({ data: [], error: null });
    actionsDelete.mockResolvedValue({ error: null });
    actionsInsert.mockResolvedValue({ error: null });
    generateProject.mockResolvedValue(generated);
  });

  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(401);
    expect(generateProject).not.toHaveBeenCalled();
  });

  it("404s when the project is absent or not owned", async () => {
    projectReadMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(404);
    expect(generateProject).not.toHaveBeenCalled();
  });

  it("regenerates: replaces AI fields and the 12 actions, returns the id", async () => {
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "p1" });

    // Regeneration used the existing depth and the project name+purpose.
    expect(generateProject).toHaveBeenCalledWith("Old — why", "minimal");
    // Project AI fields replaced in place.
    expect(projectUpdate).toHaveBeenCalledWith({
      name: "Fresh name",
      purpose: "Fresh purpose",
      successful_outcome: "Fresh outcome",
      planning_detail: null,
    });
    // Actions replaced: delete then insert the new 12.
    expect(actionsDelete).toHaveBeenCalledTimes(1);
    const inserted = actionsInsert.mock.calls[0][0];
    expect(inserted).toHaveLength(12);
    expect(inserted[0]).toMatchObject({ project_id: "p1", sort_order: 0 });
  });

  it("maps a generation timeout to 504 and does not touch the project", async () => {
    generateProject.mockRejectedValue(new Error("The request timed out."));
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(504);
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("500s and does not delete actions when the project update fails", async () => {
    projectUpdateResult.mockResolvedValue({ error: { message: "boom" } });
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(500);
    // Generation ran, but the action delete/insert never happened.
    expect(generateProject).toHaveBeenCalled();
    expect(actionsDelete).not.toHaveBeenCalled();
    expect(actionsInsert).not.toHaveBeenCalled();
  });

  it("500s and does not insert when the action delete fails", async () => {
    actionsDelete.mockResolvedValue({ error: { message: "boom" } });
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(500);
    expect(actionsInsert).not.toHaveBeenCalled();
  });

  it("restores the original actions when the new insert fails", async () => {
    actionsSnapshot.mockResolvedValue({
      data: [
        { text: "Original 1", status: "available", context_tags: [], sort_order: 0 },
      ],
      error: null,
    });
    // First insert (new actions) fails; second insert (restore) succeeds.
    actionsInsert
      .mockResolvedValueOnce({ error: { message: "boom" } })
      .mockResolvedValueOnce({ error: null });

    const res = await POST({} as never, ctx());
    expect(res.status).toBe(500);
    // Attempted the new insert, then restored the originals.
    expect(actionsInsert).toHaveBeenCalledTimes(2);
    const restored = actionsInsert.mock.calls[1][0];
    expect(restored[0]).toMatchObject({ text: "Original 1", sort_order: 0 });
  });
});
