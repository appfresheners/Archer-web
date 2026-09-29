import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// --- Mocks -----------------------------------------------------------------

const getUser = vi.fn();
// Supabase chain used by the route:
//   from("inbox_items").insert(row).select("id").maybeSingle()
const insertMaybeSingle = vi.fn();
const inboxInsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      insert: (row: unknown) => {
        inboxInsert(row);
        return {
          select: () => ({ maybeSingle: () => insertMaybeSingle() }),
        };
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

function requestWith(body: unknown, opts?: { invalidJson?: boolean }) {
  return {
    json: async () => {
      if (opts?.invalidJson) throw new SyntaxError("Unexpected token");
      return body;
    },
  } as unknown as Parameters<typeof POST>[0];
}

function authed() {
  getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
}
function unauthenticated() {
  getUser.mockResolvedValue({ data: { user: null } });
}
function insertSucceeds(id = "inbox-1") {
  insertMaybeSingle.mockResolvedValue({ data: { id }, error: null });
}

const call = (body: unknown, opts?: { invalidJson?: boolean }) =>
  POST(requestWith(body, opts)) as unknown as Promise<RouteResponse>;

// --- Tests -----------------------------------------------------------------

describe("/api/inbox POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => { });
  });

  it("returns 401 and never inserts when unauthenticated", async () => {
    unauthenticated();
    const res = await call({ raw_text: "Buy milk" });
    expect(res.status).toBe(401);
    expect(inboxInsert).not.toHaveBeenCalled();
  });

  it("treats a Supabase auth failure as unauthenticated (401)", async () => {
    getUser.mockRejectedValue(new Error("network down"));
    const res = await call({ raw_text: "Buy milk" });
    expect(res.status).toBe(401);
    expect(inboxInsert).not.toHaveBeenCalled();
  });

  it("returns 400 with no insert for an invalid JSON body", async () => {
    authed();
    const res = await call(undefined, { invalidJson: true });
    expect(res.status).toBe(400);
    expect(inboxInsert).not.toHaveBeenCalled();
  });

  it("returns 400 with no insert for empty/whitespace text", async () => {
    authed();
    expect((await call({ raw_text: "" })).status).toBe(400);
    expect((await call({ raw_text: "   " })).status).toBe(400);
    expect(inboxInsert).not.toHaveBeenCalled();
  });

  it("returns 400 with no insert when raw_text is missing", async () => {
    authed();
    const res = await call({});
    expect(res.status).toBe(400);
    expect(inboxInsert).not.toHaveBeenCalled();
  });

  it("returns 400 with no insert for over-length text (> 2000 chars)", async () => {
    authed();
    const res = await call({ raw_text: "a".repeat(2001) });
    expect(res.status).toBe(400);
    expect(inboxInsert).not.toHaveBeenCalled();
  });

  it("returns { id } and inserts a row carrying the acting user_id (happy path)", async () => {
    authed();
    insertSucceeds("inbox-happy");

    const res = await call({ raw_text: "  Draft the proposal  " });

    expect(res.status).toBe(200);
    expect(res._body.id).toBe("inbox-happy");

    const row = inboxInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.user_id).toBe("user-123");
    // Text is trimmed before insert; no classification fields.
    expect(row.raw_text).toBe("Draft the proposal");
    expect(row).not.toHaveProperty("processing_status");
    expect(row).not.toHaveProperty("resolved_project_id");
  });

  it("returns 500 and no { id } when the insert errors", async () => {
    authed();
    insertMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "insert failed" },
    });
    const res = await call({ raw_text: "Buy milk" });
    expect(res.status).toBe(500);
    expect(res._body.id).toBeUndefined();
  });

  it("returns 500 and no { id } when the insert returns no row", async () => {
    authed();
    insertMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await call({ raw_text: "Buy milk" });
    expect(res.status).toBe(500);
    expect(res._body.id).toBeUndefined();
  });
});
