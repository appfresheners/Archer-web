import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH, POST } from "./route";

const getUser = vi.fn();
const projectOwnMaybeSingle = vi.fn();
const maxSort = vi.fn();
const actionInsertSingle = vi.fn();
const actionInsert = vi.fn();
const currentActions = vi.fn();
const reorderUpdate = vi.fn();
const reorderUpdateResult = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
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
        // reorder read: select("id").eq().eq()
        select: (cols: string) => {
          if (cols.includes("sort_order")) {
            return { eq: () => ({ order: () => ({ limit: () => maxSort() }) }) };
          }
          return { eq: () => ({ eq: () => currentActions() }) };
        },
        insert: (row: unknown) => {
          actionInsert(row);
          return { select: () => ({ single: () => actionInsertSingle() }) };
        },
        update: (patch: unknown) => {
          reorderUpdate(patch);
          return { eq: () => ({ eq: () => reorderUpdateResult() }) };
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
    currentActions.mockResolvedValue({
      data: [{ id: "a1" }, { id: "a2" }, { id: "a3" }],
      error: null,
    });
    reorderUpdateResult.mockResolvedValue({ error: null });
  });

  it("400s on a missing/empty ordered list", async () => {
    const res = await PATCH(req({}, "PATCH") as never, ctx());
    expect(res.status).toBe(400);
  });

  it("rejects a reorder whose set does not match the project's actions", async () => {
    const res = await PATCH(
      req({ orderedIds: ["a1", "a2", "foreign"] }, "PATCH") as never,
      ctx(),
    );
    expect(res.status).toBe(400);
    expect(reorderUpdate).not.toHaveBeenCalled();
  });

  it("rejects a reorder with duplicate ids", async () => {
    const res = await PATCH(
      req({ orderedIds: ["a1", "a1", "a2"] }, "PATCH") as never,
      ctx(),
    );
    expect(res.status).toBe(400);
  });

  it("persists sort_order for an exact-match reorder", async () => {
    const res = await PATCH(
      req({ orderedIds: ["a3", "a1", "a2"] }, "PATCH") as never,
      ctx(),
    );
    expect(res.status).toBe(200);
    // One update per action, sort_order = index.
    expect(reorderUpdate).toHaveBeenCalledTimes(3);
    expect(reorderUpdate).toHaveBeenNthCalledWith(1, { sort_order: 0 });
  });

  it("500s if a per-row sort_order update fails mid-loop", async () => {
    reorderUpdateResult
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "boom" } });
    const res = await PATCH(
      req({ orderedIds: ["a1", "a2", "a3"] }, "PATCH") as never,
      ctx(),
    );
    expect(res.status).toBe(500);
  });
});
