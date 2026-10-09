import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const getUser = vi.fn();
const latestArea = vi.fn();
const insertRow = vi.fn();
const insertSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            order: () => ({ limit: () => latestArea() }),
          }),
        }),
      }),
      insert: (row: unknown) => {
        insertRow(row);
        return { select: () => ({ single: () => insertSingle() }) };
      },
    }),
  }),
}));

function request(body: unknown): Request {
  return new Request("http://localhost/api/areas", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/areas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
    latestArea.mockResolvedValue({ data: [{ sort_order: 3 }], error: null });
    insertSingle.mockResolvedValue({ data: { id: "area-1" }, error: null });
  });

  it("requires authentication and rejects invalid names", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request({ name: "Health" }) as never)).status).toBe(401);
    getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
    expect((await POST(request({ name: " " }) as never)).status).toBe(400);
    expect(insertRow).not.toHaveBeenCalled();
  });

  it("adds an owned Area after active Areas", async () => {
    const response = await POST(
      request({ name: "  Health  ", description: "  Keep well  " }) as never,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "area-1" });
    expect(insertRow).toHaveBeenCalledWith({
      user_id: "owner-1",
      name: "Health",
      description: "Keep well",
      sort_order: 4,
    });
  });

  it("starts at zero when there are no active Areas", async () => {
    latestArea.mockResolvedValue({ data: [], error: null });
    await POST(request({ name: "Health" }) as never);
    expect(insertRow).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 0 }),
    );
  });

  it("does not insert when reading the current order fails", async () => {
    latestArea.mockResolvedValue({ data: null, error: { message: "offline" } });
    const response = await POST(request({ name: "Health" }) as never);
    expect(response.status).toBe(500);
    expect(insertRow).not.toHaveBeenCalled();
  });
});