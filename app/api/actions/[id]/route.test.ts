import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "./route";

const getUser = vi.fn();
const actionUpdate = vi.fn();
const actionReadMaybeSingle = vi.fn();
const updateMaybeSingle = vi.fn();
const deleteMaybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: () => actionReadMaybeSingle() }) }),
      }),
      update: (patch: unknown) => {
        actionUpdate(patch);
        return {
          eq: () => ({
            eq: () => ({ select: () => ({ maybeSingle: () => updateMaybeSingle() }) }),
          }),
        };
      },
      delete: () => ({
        eq: () => ({
          eq: () => ({ select: () => ({ maybeSingle: () => deleteMaybeSingle() }) }),
        }),
      }),
    }),
  }),
}));

function patchReq(body: unknown): Request {
  return new Request("http://localhost/api/actions/a1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
const ctx = (id = "a1") => ({ params: Promise.resolve({ id }) });

describe("PATCH /api/actions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    actionReadMaybeSingle.mockResolvedValue({
      data: { context_tags: [] },
      error: null,
    });
  });

  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(patchReq({ text: "x" }) as never, ctx());
    expect(res.status).toBe(401);
  });

  it("400s on an invalid patch (committed not allowed here)", async () => {
    const res = await PATCH(patchReq({ status: "committed" }) as never, ctx());
    expect(res.status).toBe(400);
    expect(actionUpdate).not.toHaveBeenCalled();
  });

  it("updates text + tags and returns the id", async () => {
    updateMaybeSingle.mockResolvedValue({ data: { id: "a1" }, error: null });
    const res = await PATCH(
      patchReq({ text: "Renamed", context_tags: ["@energy:low"] }) as never,
      ctx(),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "a1" });
    expect(actionUpdate).toHaveBeenCalledWith({
      text: "Renamed",
      context_tags: ["@energy:low"],
    });
  });

  it("rejects a new free-text context value", async () => {
    const res = await PATCH(
      patchReq({ context_tags: ["@location:my-office"] }) as never,
      ctx(),
    );
    expect(res.status).toBe(400);
    expect(actionUpdate).not.toHaveBeenCalled();
  });

  it("allows an existing legacy tag to remain while adding a fixed option", async () => {
    actionReadMaybeSingle.mockResolvedValue({
      data: { context_tags: ["@tool:laptop"] },
      error: null,
    });
    updateMaybeSingle.mockResolvedValue({ data: { id: "a1" }, error: null });

    const res = await PATCH(
      patchReq({ context_tags: ["@tool:laptop", "@location:office"] }) as never,
      ctx(),
    );

    expect(res.status).toBe(200);
    expect(actionUpdate).toHaveBeenCalledWith({
      context_tags: ["@tool:laptop", "@location:office"],
    });
  });

  it("updates the available minutes through the owned action PATCH", async () => {
    updateMaybeSingle.mockResolvedValue({ data: { id: "a1" }, error: null });
    const res = await PATCH(
      patchReq({ time_available_minutes: 15 }) as never,
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(actionUpdate).toHaveBeenCalledWith({ time_available_minutes: 15 });
  });

  it("toggles completion via status", async () => {
    updateMaybeSingle.mockResolvedValue({ data: { id: "a1" }, error: null });
    const res = await PATCH(patchReq({ status: "done" }) as never, ctx());
    expect(res.status).toBe(200);
    expect(actionUpdate).toHaveBeenCalledWith({ status: "done" });
  });

  it("404s when no owned row matches", async () => {
    updateMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(patchReq({ text: "x" }) as never, ctx());
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/actions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE({} as never, ctx());
    expect(res.status).toBe(401);
  });

  it("deletes an owned action and returns the id", async () => {
    deleteMaybeSingle.mockResolvedValue({ data: { id: "a1" }, error: null });
    const res = await DELETE({} as never, ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "a1" });
  });

  it("404s when the action is absent or not owned", async () => {
    deleteMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await DELETE({} as never, ctx());
    expect(res.status).toBe(404);
  });
});
