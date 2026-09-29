import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

// --- Mocks -----------------------------------------------------------------

const getUser = vi.fn();
// Supabase chain used by the route:
//   from("inbox_items").delete().eq("id", id).eq("user_id", userId)
//     .select("id").maybeSingle()
const deleteMaybeSingle = vi.fn();
// Record every .eq(col, val) applied to the delete chain so the test can
// assert the user-scope security boundary.
const eqCalls: Array<[string, string]> = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      delete: () => {
        const chain = {
          eq: (col: string, val: string) => {
            eqCalls.push([col, val]);
            return chain;
          },
          select: () => ({ maybeSingle: () => deleteMaybeSingle() }),
        };
        return chain;
      },
    }),
  }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      _body: body,
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

// --- Helpers ---------------------------------------------------------------

type RouteResponse = {
  _body: { id?: string; error?: string };
  status: number;
};

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function authed() {
  getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
}
function unauthenticated() {
  getUser.mockResolvedValue({ data: { user: null } });
}

const call = (id: string) =>
  DELETE(
    {} as unknown as Parameters<typeof DELETE>[0],
    ctx(id),
  ) as unknown as Promise<RouteResponse>;

// --- Tests -----------------------------------------------------------------

describe("/api/inbox/[id] DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => { });
  });

  it("returns 401 when unauthenticated (no delete attempted)", async () => {
    unauthenticated();
    const res = await call("inbox-1");
    expect(res.status).toBe(401);
    expect(deleteMaybeSingle).not.toHaveBeenCalled();
  });

  it("returns 404 when the item is not owned/unknown (!data)", async () => {
    authed();
    deleteMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await call("nope");
    expect(res.status).toBe(404);
  });

  it("returns 500 on a db error", async () => {
    authed();
    deleteMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "delete failed" },
    });
    const res = await call("inbox-1");
    expect(res.status).toBe(500);
  });

  it("returns { id } on success and scopes the delete by id AND user_id", async () => {
    authed();
    deleteMaybeSingle.mockResolvedValue({ data: { id: "inbox-1" }, error: null });

    const res = await call("inbox-1");

    expect(res.status).toBe(200);
    expect(res._body.id).toBe("inbox-1");
    // App-layer half of the cross-user security boundary: the query is scoped
    // to both the row id and the acting user's id.
    expect(eqCalls).toContainEqual(["id", "inbox-1"]);
    expect(eqCalls).toContainEqual(["user_id", "user-123"]);
  });
});
