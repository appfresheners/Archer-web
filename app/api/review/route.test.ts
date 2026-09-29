import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// --- Mocks -----------------------------------------------------------------
// Supabase chains used by the route:
//   read:   from("review_sessions").select(...).eq().eq().eq().maybeSingle()
//   insert: from("review_sessions").insert(row).select(...).maybeSingle()

const getUser = vi.fn();
const readMaybeSingle = vi.fn();
const insertMaybeSingle = vi.fn();
const reviewInsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: () => readMaybeSingle() }),
          }),
        }),
      }),
      insert: (row: unknown) => {
        reviewInsert(row);
        return { select: () => ({ maybeSingle: () => insertMaybeSingle() }) };
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

type RouteResponse = {
  _body: { id?: string; current_phase?: string; error?: string };
  status: number;
};

const call = () => POST() as unknown as Promise<RouteResponse>;

function authed() {
  getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
}

describe("/api/review POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => { });
    authed();
    // Default: no existing row.
    readMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("returns 401 and never inserts when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await call();
    expect(res.status).toBe(401);
    expect(reviewInsert).not.toHaveBeenCalled();
  });

  it("treats a Supabase auth failure as unauthenticated (401)", async () => {
    getUser.mockRejectedValue(new Error("network down"));
    const res = await call();
    expect(res.status).toBe(401);
    expect(reviewInsert).not.toHaveBeenCalled();
  });

  it("creates a snapshot_open session with week identity + Mon/Sun dates when none exists", async () => {
    insertMaybeSingle.mockResolvedValue({
      data: { id: "rev-new", current_phase: "snapshot_open" },
      error: null,
    });

    const res = await call();

    expect(res.status).toBe(200);
    expect(res._body).toEqual({ id: "rev-new", current_phase: "snapshot_open" });

    const row = reviewInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.user_id).toBe("user-123");
    expect(row.current_phase).toBe("snapshot_open");
    // Week identity + bounds are present and well-formed.
    expect(typeof row.week_number).toBe("number");
    expect(typeof row.week_year).toBe("number");
    expect(row.week_start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.week_end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns the existing current-week row without inserting (idempotent)", async () => {
    readMaybeSingle.mockResolvedValue({
      data: { id: "rev-existing", current_phase: "get_current" },
      error: null,
    });

    const res = await call();

    expect(res.status).toBe(200);
    expect(res._body).toEqual({ id: "rev-existing", current_phase: "get_current" });
    expect(reviewInsert).not.toHaveBeenCalled();
  });

  it("returns 500 when the lookup errors", async () => {
    readMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await call();
    expect(res.status).toBe(500);
    expect(reviewInsert).not.toHaveBeenCalled();
  });

  it("returns 500 when the insert errors", async () => {
    insertMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "insert failed" },
    });
    const res = await call();
    expect(res.status).toBe(500);
    expect(res._body.id).toBeUndefined();
  });

  it("returns 500 when the insert returns no row", async () => {
    insertMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await call();
    expect(res.status).toBe(500);
    expect(res._body.id).toBeUndefined();
  });

  it("recovers from a concurrent-insert unique violation by returning the raced row", async () => {
    // First read: no row (this request loses the race). Insert then violates
    // the unique(user_id, week_number, week_year) constraint (Postgres 23505).
    // The route re-reads and returns the row the winner created.
    readMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // initial lookup
      .mockResolvedValueOnce({
        data: { id: "rev-raced", current_phase: "snapshot_open" },
        error: null,
      }); // recovery re-read
    insertMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });

    const res = await call();

    expect(res.status).toBe(200);
    expect(res._body).toEqual({
      id: "rev-raced",
      current_phase: "snapshot_open",
    });
  });
});
