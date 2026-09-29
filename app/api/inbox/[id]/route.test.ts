import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "./route";

// --- Mocks -----------------------------------------------------------------

const getUser = vi.fn();
// DELETE chain: from("inbox_items").delete().eq("id",id).eq("user_id",uid)
//   .select("id").maybeSingle()
const deleteMaybeSingle = vi.fn();
// PATCH chain: from("inbox_items").update(patch).eq("id",id).eq("user_id",uid)
//   .select("id").maybeSingle()
const updateMaybeSingle = vi.fn();
const updateSpy = vi.fn();
// Record every .eq(col, val) applied to the inbox_items chain so the test can
// assert the user-scope + unprocessed-guard boundary.
const eqCalls: Array<[string, string]> = [];
// Record the .in(col, values) source-status scope used by the reactivate path.
const inCalls: Array<[string, unknown]> = [];
// Project ownership guard: from("projects").select("id").eq(id).eq(user_id).maybeSingle()
const projectOwnerMaybeSingle = vi.fn();
const projectEqCalls: Array<[string, string]> = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table === "projects") {
        const chain = {
          select: () => chain,
          eq: (col: string, val: string) => {
            projectEqCalls.push([col, val]);
            return chain;
          },
          maybeSingle: () => projectOwnerMaybeSingle(),
        };
        return chain;
      }
      return {
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
        update: (patch: unknown) => {
          updateSpy(patch);
          const chain = {
            eq: (col: string, val: string) => {
              eqCalls.push([col, val]);
              return chain;
            },
            in: (col: string, values: unknown) => {
              inCalls.push([col, values]);
              return chain;
            },
            select: () => ({ maybeSingle: () => updateMaybeSingle() }),
          };
          return chain;
        },
      };
    },
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

const callDelete = (id: string) =>
  DELETE(
    {} as unknown as Parameters<typeof DELETE>[0],
    ctx(id),
  ) as unknown as Promise<RouteResponse>;

function patchReq(body: unknown): Request {
  return new Request("http://localhost/api/inbox/inbox-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
const callPatch = (id: string, body: unknown) =>
  PATCH(patchReq(body) as never, ctx(id)) as unknown as Promise<RouteResponse>;

// --- Tests -----------------------------------------------------------------

describe("/api/inbox/[id] DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => { });
  });

  it("returns 401 when unauthenticated (no delete attempted)", async () => {
    unauthenticated();
    const res = await callDelete("inbox-1");
    expect(res.status).toBe(401);
    expect(deleteMaybeSingle).not.toHaveBeenCalled();
  });

  it("returns 404 when the item is not owned/unknown (!data)", async () => {
    authed();
    deleteMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await callDelete("nope");
    expect(res.status).toBe(404);
  });

  it("returns 500 on a db error", async () => {
    authed();
    deleteMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "delete failed" },
    });
    const res = await callDelete("inbox-1");
    expect(res.status).toBe(500);
  });

  it("returns { id } on success and scopes the delete by id AND user_id", async () => {
    authed();
    deleteMaybeSingle.mockResolvedValue({ data: { id: "inbox-1" }, error: null });

    const res = await callDelete("inbox-1");

    expect(res.status).toBe(200);
    expect(res._body.id).toBe("inbox-1");
    expect(eqCalls).toContainEqual(["id", "inbox-1"]);
    expect(eqCalls).toContainEqual(["user_id", "user-123"]);
  });
});

describe("/api/inbox/[id] PATCH (clarify outcome)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    inCalls.length = 0;
    projectEqCalls.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => { });
    authed();
    updateMaybeSingle.mockResolvedValue({ data: { id: "inbox-1" }, error: null });
    // Default: any looked-up project is owned by the acting user.
    projectOwnerMaybeSingle.mockResolvedValue({ data: { id: "p1" }, error: null });
  });

  it("returns 401 when unauthenticated (no update attempted)", async () => {
    unauthenticated();
    const res = await callPatch("inbox-1", { status: "processed" });
    expect(res.status).toBe(401);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("400s on an invalid/rejected body (unknown status)", async () => {
    const res = await callPatch("inbox-1", { status: "nope" });
    expect(res.status).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  // Story 5.6 reactivate: a someday/reference item → unprocessed. The update
  // clears processed_at + resolved_project_id, is NOT stamped with a new
  // processed_at, and is scoped to a someday/reference source (not unprocessed).
  it("reactivates a someday/reference item to unprocessed (clears resolution, scoped source)", async () => {
    const res = await callPatch("inbox-1", { status: "unprocessed" });
    expect(res.status).toBe(200);
    expect(res._body.id).toBe("inbox-1");
    const patch = updateSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.processing_status).toBe("unprocessed");
    expect(patch.processed_at).toBeNull();
    expect(patch.resolved_project_id).toBeNull();
    // Scoped to the acting user AND a someday/reference source (not unprocessed).
    expect(eqCalls).toContainEqual(["user_id", "user-123"]);
    expect(inCalls).toContainEqual(["processing_status", ["someday", "reference"]]);
  });

  it("404s when reactivating an item that is not a someday/reference source", async () => {
    updateMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await callPatch("inbox-1", { status: "unprocessed" });
    expect(res.status).toBe(404);
  });

  // Matrix: Trash / Someday / Reference / Do-it(processed) all set status +
  // processed_at and leave the inbox.
  it.each(["processed", "trashed", "someday", "reference"] as const)(
    "records terminal status %s with processed_at and returns { id }",
    async (status) => {
      const res = await callPatch("inbox-1", { status });
      expect(res.status).toBe(200);
      expect(res._body.id).toBe("inbox-1");
      const patch = updateSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(patch.processing_status).toBe(status);
      expect(typeof patch.processed_at).toBe("string");
    },
  );

  it("passes an OWNED resolved_project_id through for the multistep link", async () => {
    const pid = "22222222-2222-4222-8222-222222222222";
    await callPatch("inbox-1", { status: "processed", resolved_project_id: pid });
    const patch = updateSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.resolved_project_id).toBe(pid);
    // Ownership was verified, scoped to the acting user.
    expect(projectEqCalls).toContainEqual(["id", pid]);
    expect(projectEqCalls).toContainEqual(["user_id", "user-123"]);
  });

  it("400s (no update) when resolved_project_id is not owned by the user", async () => {
    projectOwnerMaybeSingle.mockResolvedValue({ data: null, error: null });
    const pid = "22222222-2222-4222-8222-222222222222";
    const res = await callPatch("inbox-1", {
      status: "processed",
      resolved_project_id: pid,
    });
    expect(res.status).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("scopes the update by id, user_id AND unprocessed (terminal items cannot be re-processed)", async () => {
    await callPatch("inbox-1", { status: "processed" });
    expect(eqCalls).toContainEqual(["id", "inbox-1"]);
    expect(eqCalls).toContainEqual(["user_id", "user-123"]);
    expect(eqCalls).toContainEqual(["processing_status", "unprocessed"]);
  });

  it("404s when no owned row matches", async () => {
    updateMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await callPatch("nope", { status: "processed" });
    expect(res.status).toBe(404);
  });

  it("500s on a db error", async () => {
    updateMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const res = await callPatch("inbox-1", { status: "processed" });
    expect(res.status).toBe(500);
  });
});
