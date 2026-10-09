import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "./route";

const getUser = vi.fn();
const upsert = vi.fn();
const single = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      upsert: (row: unknown, options: unknown) => {
        upsert(row, options);
        return { select: () => ({ single }) };
      },
    }),
  }),
}));

function request(body: unknown): Request {
  return new Request("http://localhost/api/focus/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

describe("PUT /api/focus/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
    single.mockResolvedValue({ data: { id: "profile-1" }, error: null });
  });

  it("requires an authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const response = await PUT(request({ vision: "A vision" }) as never);
    expect(response.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads without writing", async () => {
    const response = await PUT(request({ vision: "ok", principles: [3] }) as never);
    expect(response.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("creates or updates only the signed-in user's profile", async () => {
    const response = await PUT(
      request({ vision: "  Make a difference ", principles: ["Be kind"] }) as never,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "profile-1" });
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "owner-1",
        vision: "Make a difference",
        purpose: null,
        principles: ["Be kind"],
      },
      { onConflict: "user_id" },
    );
  });

  it("reports persistence errors", async () => {
    single.mockResolvedValue({ data: null, error: { message: "offline" } });
    const response = await PUT(request({}) as never);
    expect(response.status).toBe(500);
  });
});