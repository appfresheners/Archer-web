import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// --- Mocks -----------------------------------------------------------------
// The route touches two tables:
//   review_sessions (read):   .select(...).eq("id").eq("user_id").is("completed_at", null).maybeSingle()
//   weekly_snapshots (insert): .insert(row)
//   review_sessions (update): .update(patch).eq("id").eq("user_id").is("completed_at", null).select("id").maybeSingle()
// We dispatch by table name and (for review_sessions) by whether .update() was
// called.

const getUser = vi.fn();
const sessionRead = vi.fn(); // resolves the read maybeSingle
const sessionUpdate = vi.fn(); // resolves the update maybeSingle
const snapshotInsert = vi.fn(); // resolves the insert
const updatePatch = vi.fn(); // captures the update patch
const insertRow = vi.fn(); // captures the inserted row
const updateUserEq = vi.fn(); // captures the update's user_id scope

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table === "weekly_snapshots") {
        return {
          insert: (row: unknown) => {
            insertRow(row);
            return snapshotInsert();
          },
        };
      }
      // review_sessions: distinguish read (.select first) from update (.update first)
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({ maybeSingle: () => sessionRead() }),
            }),
          }),
        }),
        update: (patch: unknown) => {
          updatePatch(patch);
          return {
            eq: () => ({
              eq: (col: string, val: unknown) => {
                updateUserEq(col, val);
                return {
                  is: () => ({
                    select: () => ({ maybeSingle: () => sessionUpdate() }),
                  }),
                };
              },
            }),
          };
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

type RouteResponse = {
  _body: { id?: string; error?: string };
  status: number;
};

function requestWith(body: unknown, opts?: { invalidJson?: boolean }) {
  return {
    json: async () => {
      if (opts?.invalidJson) throw new SyntaxError("bad json");
      return body;
    },
  } as unknown as Parameters<typeof POST>[0];
}

const ctx = (id = "rev-1") => ({ params: Promise.resolve({ id }) });

const call = (body: unknown, opts?: { invalidJson?: boolean }, id?: string) =>
  POST(requestWith(body, opts), ctx(id)) as unknown as Promise<RouteResponse>;

function authed() {
  getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
}

const OWNED_SESSION = {
  id: "rev-1",
  week_number: 40,
  week_year: 2026,
  week_start_date: "2026-09-28",
  week_end_date: "2026-10-04",
  opening_retrospective: "moved a, missed b",
};

const VALID_BODY = { intention: "ship v1", blocker: "scope creep" };

describe("/api/review/[id]/complete POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    authed();
    // Default happy-path resolutions; individual tests override.
    sessionRead.mockResolvedValue({ data: OWNED_SESSION, error: null });
    snapshotInsert.mockResolvedValue({ error: null });
    sessionUpdate.mockResolvedValue({ data: { id: "rev-1" }, error: null });
  });

  it("returns 401 and writes nothing when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await call(VALID_BODY);
    expect(res.status).toBe(401);
    expect(insertRow).not.toHaveBeenCalled();
    expect(updatePatch).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await call(undefined, { invalidJson: true });
    expect(res.status).toBe(400);
    expect(insertRow).not.toHaveBeenCalled();
  });

  it("returns 400 when a closing field is missing/empty (no writes)", async () => {
    const res = await call({ intention: "ship", blocker: "  " });
    expect(res.status).toBe(400);
    expect(insertRow).not.toHaveBeenCalled();
    expect(updatePatch).not.toHaveBeenCalled();
  });

  it("returns 404 when the session is unknown / not owned / already completed", async () => {
    sessionRead.mockResolvedValue({ data: null, error: null });
    const res = await call(VALID_BODY);
    expect(res.status).toBe(404);
    // No snapshot written for a non-existent session.
    expect(insertRow).not.toHaveBeenCalled();
  });

  it("returns 500 when the session read errors", async () => {
    sessionRead.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await call(VALID_BODY);
    expect(res.status).toBe(500);
    expect(insertRow).not.toHaveBeenCalled();
  });

  it("writes the immutable snapshot then completes the session, returning { id }", async () => {
    const res = await call(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res._body).toEqual({ id: "rev-1" });

    // Snapshot carries week identity + opening retrospective from the session
    // and the trimmed closing fields from the body.
    expect(insertRow).toHaveBeenCalledWith({
      user_id: "user-123",
      review_session_id: "rev-1",
      week_number: 40,
      week_year: 2026,
      week_start_date: "2026-09-28",
      week_end_date: "2026-10-04",
      intention: "ship v1",
      blocker: "scope creep",
      opening_retrospective: "moved a, missed b",
    });

    // Session marked complete.
    const patch = updatePatch.mock.calls[0][0] as {
      completed_at?: string;
      current_phase?: string;
    };
    expect(patch.current_phase).toBe("complete");
    expect(typeof patch.completed_at).toBe("string");
    // Scoped to the acting user.
    expect(updateUserEq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("trims the closing fields into the snapshot row", async () => {
    await call({ intention: "  focus  ", blocker: "\n distractions " });
    expect(insertRow).toHaveBeenCalledWith(
      expect.objectContaining({ intention: "focus", blocker: "distractions" }),
    );
  });

  it("returns 500 (immutable snapshot recorded) when the session update fails", async () => {
    sessionUpdate.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await call(VALID_BODY);
    expect(res.status).toBe(500);
    // Snapshot was still written first.
    expect(insertRow).toHaveBeenCalled();
  });

  it("tolerates a pre-existing snapshot on retry (23505) and still completes", async () => {
    snapshotInsert.mockResolvedValue({ error: { code: "23505", message: "dup" } });
    const res = await call(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res._body).toEqual({ id: "rev-1" });
    // Proceeded to the session update despite the duplicate snapshot.
    expect(updatePatch).toHaveBeenCalled();
  });

  it("returns 500 on a non-unique snapshot insert error (does not complete)", async () => {
    snapshotInsert.mockResolvedValue({ error: { code: "23503", message: "fk" } });
    const res = await call(VALID_BODY);
    expect(res.status).toBe(500);
    expect(updatePatch).not.toHaveBeenCalled();
  });
});
