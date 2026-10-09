import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const getUser = vi.fn();
const latestActive = vi.fn();
const updateRow = vi.fn();
const updateMaybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            order: () => ({ limit: () => latestActive() }),
          }),
        }),
      }),
      update: (patch: unknown) => {
        updateRow(patch);
        return {
          eq: () => ({
            eq: () => ({
              not: () => ({ select: () => ({ maybeSingle: updateMaybeSingle }) }),
              select: () => ({ maybeSingle: updateMaybeSingle }),
            }),
          }),
        };
      },
    }),
  }),
}));

function request(body: unknown): Request {
  return new Request("http://localhost/api/areas/area-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
const context = { params: Promise.resolve({ id: "area-1" }) };

describe("PATCH /api/areas/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
    latestActive.mockResolvedValue({ data: [{ sort_order: 6 }], error: null });
    updateMaybeSingle.mockResolvedValue({ data: { id: "area-1" }, error: null });
  });

  it("requires authentication and rejects invalid edits", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await PATCH(request({ name: "Updated" }) as never, context)).status).toBe(401);
    getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
    expect((await PATCH(request({ name: " " }) as never, context)).status).toBe(400);
    expect(updateRow).not.toHaveBeenCalled();
  });

  it("edits only the owner-scoped Area", async () => {
    const response = await PATCH(
      request({ name: "Health", description: "Wellbeing" }) as never,
      context,
    );
    expect(response.status).toBe(200);
    expect(updateRow).toHaveBeenCalledWith({ name: "Health", description: "Wellbeing" });
  });

  it("archives without deleting the Area", async () => {
    const response = await PATCH(request({ action: "archive" }) as never, context);
    expect(response.status).toBe(200);
    expect(updateRow).toHaveBeenCalledWith({ archived_at: expect.any(String) });
  });

  it("restores an archived Area after active Areas", async () => {
    const response = await PATCH(request({ action: "restore" }) as never, context);
    expect(response.status).toBe(200);
    expect(updateRow).toHaveBeenCalledWith({ archived_at: null, sort_order: 7 });
  });

  it("reports restore ordering and write failures", async () => {
    latestActive.mockResolvedValue({ data: null, error: { message: "offline" } });
    expect((await PATCH(request({ action: "restore" }) as never, context)).status).toBe(500);
    expect(updateRow).not.toHaveBeenCalled();
    latestActive.mockResolvedValue({ data: [], error: null });
    updateMaybeSingle.mockResolvedValue({ data: null, error: { message: "offline" } });
    expect((await PATCH(request({ action: "restore" }) as never, context)).status).toBe(500);
  });

  it("returns not found when the owner-scoped update matches no Area", async () => {
    updateMaybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await PATCH(request({ name: "Health" }) as never, context);
    expect(response.status).toBe(404);
  });
});