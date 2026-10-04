import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const getUser = vi.fn();
const rpc = vi.fn();
const A1 = "11111111-1111-4111-8111-111111111111";
const A2 = "22222222-2222-4222-8222-222222222222";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, rpc }),
}));

function request(orderedIds: unknown): Request {
  return new Request("http://localhost/api/areas/reorder", {
    method: "PATCH",
    body: JSON.stringify({ orderedIds }),
  });
}

describe("PATCH /api/areas/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("requires authentication", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await PATCH(request([A1]) as never)).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends the complete ordered list through one atomic RPC", async () => {
    const response = await PATCH(request([A2, A1]) as never);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("reorder_areas_of_focus", {
      p_area_ids: [A2, A1],
    });
  });

  it("accepts an empty list for a user with no active Areas", async () => {
    expect((await PATCH(request([]) as never)).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("reorder_areas_of_focus", {
      p_area_ids: [],
    });
  });

  it("rejects duplicate and malformed IDs before the RPC", async () => {
    expect((await PATCH(request([A1, A1]) as never)).status).toBe(400);
    expect((await PATCH(request(["not-a-uuid"]) as never)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects missing or foreign IDs when the database set check fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22000", message: "mismatch" } });
    expect((await PATCH(request([A1]) as never)).status).toBe(400);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("reports unexpected RPC failures", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "offline" } });
    expect((await PATCH(request([A1]) as never)).status).toBe(500);
  });
});