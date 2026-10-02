import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

// --- Mocks -----------------------------------------------------------------
// Supabase chain used by the route:
//   from("review_sessions").update(patch).eq("id").eq("user_id").select(...).maybeSingle()

const getUser = vi.fn();
const updateMaybeSingle = vi.fn();
const reviewUpdate = vi.fn();
const secondEq = vi.fn();
// The `.is(col, val)` applied after the two `.eq()`s — the completed_at guard.
const isCall = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      // Chain: update(patch).eq("id").eq("user_id").is("completed_at", null)
      //   .select(...).maybeSingle()
      update: (patch: unknown) => {
        reviewUpdate(patch);
        return {
          eq: () => ({
            eq: (col: string, val: unknown) => {
              secondEq(col, val);
              return {
                is: (col2: string, val2: unknown) => {
                  isCall(col2, val2);
                  return {
                    select: () => ({ maybeSingle: () => updateMaybeSingle() }),
                  };
                },
              };
            },
          }),
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

type RouteResponse = {
  _body: { id?: string; current_phase?: string; error?: string };
  status: number;
};

function requestWith(body: unknown, opts?: { invalidJson?: boolean }) {
  return {
    json: async () => {
      if (opts?.invalidJson) throw new SyntaxError("bad json");
      return body;
    },
  } as unknown as Parameters<typeof PATCH>[0];
}

const ctx = (id = "rev-1") => ({ params: Promise.resolve({ id }) });

const call = (body: unknown, opts?: { invalidJson?: boolean }, id?: string) =>
  PATCH(requestWith(body, opts), ctx(id)) as unknown as Promise<RouteResponse>;

function authed() {
  getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
}

describe("/api/review/[id] PATCH", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => { });
    authed();
  });

  it("returns 401 and never updates when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await call({ current_phase: "get_current" });
    expect(res.status).toBe(401);
    expect(reviewUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 with no update for invalid JSON", async () => {
    const res = await call(undefined, { invalidJson: true });
    expect(res.status).toBe(400);
    expect(reviewUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 with no update for an invalid phase value", async () => {
    const res = await call({ current_phase: "nope" });
    expect(res.status).toBe(400);
    expect(reviewUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 with no update for the terminal 'complete' phase", async () => {
    const res = await call({ current_phase: "complete" });
    expect(res.status).toBe(400);
    expect(reviewUpdate).not.toHaveBeenCalled();
  });

  it("persists a valid phase transition, scoped to the acting user", async () => {
    updateMaybeSingle.mockResolvedValue({
      data: { id: "rev-1", current_phase: "get_current" },
      error: null,
    });

    const res = await call({ current_phase: "get_current" });

    expect(res.status).toBe(200);
    expect(res._body).toEqual({ id: "rev-1", current_phase: "get_current" });
    expect(reviewUpdate).toHaveBeenCalledWith({ current_phase: "get_current" });
    // The update is scoped by user_id (the second .eq()).
    expect(secondEq).toHaveBeenCalledWith("user_id", "user-123");
    // ...and guarded to not-yet-completed sessions.
    expect(isCall).toHaveBeenCalledWith("completed_at", null);
  });

  it("returns 404 when the session is absent, not owned, OR already completed", async () => {
    // The completed_at IS NULL guard means a completed session matches no row
    // (maybeSingle → null) and therefore cannot be reopened by a phase rewind.
    updateMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await call({ current_phase: "get_clear" });
    expect(res.status).toBe(404);
    expect(isCall).toHaveBeenCalledWith("completed_at", null);
  });

  it("returns 500 on a db error", async () => {
    updateMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await call({ current_phase: "get_clear" });
    expect(res.status).toBe(500);
  });

  // --- Story 5.5: snapshot field persistence -------------------------------

  it("persists the opening retrospective field via the extended validator", async () => {
    updateMaybeSingle.mockResolvedValue({
      data: { id: "rev-1", current_phase: "snapshot_open" },
      error: null,
    });

    const res = await call({ opening_retrospective: "moved a, missed b" });

    expect(res.status).toBe(200);
    expect(reviewUpdate).toHaveBeenCalledWith({
      opening_retrospective: "moved a, missed b",
    });
    expect(secondEq).toHaveBeenCalledWith("user_id", "user-123");
    expect(isCall).toHaveBeenCalledWith("completed_at", null);
  });

  it("persists the closing fields (intention/blocker), including empties for in-progress saves", async () => {
    updateMaybeSingle.mockResolvedValue({
      data: { id: "rev-1", current_phase: "snapshot_close" },
      error: null,
    });

    const res = await call({ closing_intention: "focus", closing_blocker: "" });

    expect(res.status).toBe(200);
    expect(reviewUpdate).toHaveBeenCalledWith({
      closing_intention: "focus",
      closing_blocker: "",
    });
  });

  it("persists a phase + snapshot field together in one PATCH", async () => {
    updateMaybeSingle.mockResolvedValue({
      data: { id: "rev-1", current_phase: "get_clear" },
      error: null,
    });

    const res = await call({
      current_phase: "get_clear",
      opening_retrospective: "done",
    });

    expect(res.status).toBe(200);
    expect(reviewUpdate).toHaveBeenCalledWith({
      current_phase: "get_clear",
      opening_retrospective: "done",
    });
  });
});
