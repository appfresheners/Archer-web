import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const getUser = vi.fn();
const update = vi.fn();
const eqId = vi.fn();
const eqUser = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      update: (patch: unknown) => {
        update(patch);
        return {
          eq: (column: string, value: string) => {
            if (column === "id") eqId(value);
            if (column === "user_id") eqUser(value);
            return {
              eq: (nextColumn: string, nextValue: string) => {
                if (nextColumn === "id") eqId(nextValue);
                if (nextColumn === "user_id") eqUser(nextValue);
                return { select: () => ({ maybeSingle }) };
              },
              select: () => ({ maybeSingle }),
            };
          },
        };
      },
    }),
  }),
}));

const ctx = (id = "g1") => ({ params: Promise.resolve({ id }) });

describe("POST /api/goals/[id]/monthly-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:34:56.000Z"));
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires authentication", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const response = await POST(new Request("http://localhost", { method: "POST" }), ctx());

    expect(response.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("uses server time and scopes the update to the owner, ignoring client data", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "g1" }, error: null });
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          relevance: "yes",
          last_checked_at: "1999-01-01T00:00:00.000Z",
        }),
      }),
      ctx(),
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ last_checked_at: "2026-10-01T12:34:56.000Z" });
    expect(eqId).toHaveBeenCalledWith("g1");
    expect(eqUser).toHaveBeenCalledWith("u1");
    await expect(response.json()).resolves.toEqual({
      id: "g1",
      last_checked_at: "2026-10-01T12:34:56.000Z",
    });
  });

  it.each([{}, { relevance: "unsure" }])(
    "rejects a missing or invalid relevance answer before updating",
    async (body) => {
      const response = await POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify(body),
        }),
        ctx(),
      );

      expect(response.status).toBe(400);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("returns 404 without changing a missing or unowned goal", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ relevance: "yes" }),
      }),
      ctx(),
    );

    expect(response.status).toBe(404);
  });

  it("returns an error without claiming completion when the update fails", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ relevance: "yes" }),
      }),
      ctx(),
    );

    expect(response.status).toBe(500);
  });
});