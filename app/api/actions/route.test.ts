import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const getUser = vi.fn();
const insertSpy = vi.fn();
const insertSingle = vi.fn();
// Project ownership lookup: from("projects").select("id").eq(id).eq(user_id).maybeSingle()
const projectOwnerMaybeSingle = vi.fn();
const projectEqCalls: Array<[string, string]> = [];

// Chains:
//   from("actions").insert(row).select("id").single()
//   from("projects").select("id").eq("id",..).eq("user_id",..).maybeSingle()  (ownership guard)
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
        insert: (row: unknown) => {
          insertSpy(row);
          return { select: () => ({ single: () => insertSingle() }) };
        },
      };
    },
  }),
}));

const PID = "44444444-4444-4444-8444-444444444444";

function req(body: unknown): Request {
  return new Request("http://localhost/api/actions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
const call = (body: unknown) =>
  POST(req(body) as never) as unknown as Promise<{
    status: number;
    json: () => Promise<{ id?: string; error?: string }>;
  }>;

describe("POST /api/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectEqCalls.length = 0;
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertSingle.mockResolvedValue({ data: { id: "a-new" }, error: null });
    projectOwnerMaybeSingle.mockResolvedValue({ data: { id: PID }, error: null });
    vi.spyOn(console, "error").mockImplementation(() => { });
  });

  it("401s when unauthenticated (no insert attempted)", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await call({ text: "x" });
    expect(res.status).toBe(401);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("400s on an invalid body (empty text)", async () => {
    const res = await call({ text: "   " });
    expect(res.status).toBe(400);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("400s on waiting without delegated_to", async () => {
    const res = await call({ text: "x", status: "waiting" });
    expect(res.status).toBe(400);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("creates a STANDALONE available action (project_id null)", async () => {
    const res = await call({ text: "Call the dentist" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "a-new" });
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        project_id: null,
        text: "Call the dentist",
        status: "available",
        delegated_to: null,
        scheduled_for: null,
      }),
    );
  });

  it("creates a WAITING action with delegated_to", async () => {
    const res = await call({
      text: "Wait on docs",
      status: "waiting",
      delegated_to: "Sam",
    });
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "waiting", delegated_to: "Sam" }),
    );
  });

  it("creates a scheduled (calendar) action with scheduled_for", async () => {
    const res = await call({ text: "Renew passport", scheduled_for: "2026-06-01" });
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ scheduled_for: "2026-06-01", status: "available" }),
    );
  });

  it("creates an action assigned to an OWNED project (project_id uuid)", async () => {
    const res = await call({ text: "Draft spec", project_id: PID });
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: PID }),
    );
    // Ownership was verified, scoped to the acting user.
    expect(projectEqCalls).toContainEqual(["id", PID]);
    expect(projectEqCalls).toContainEqual(["user_id", "u1"]);
  });

  it("400s (and does NOT insert) when project_id is not owned by the user", async () => {
    // Ownership lookup finds no row → the project is not the user's.
    projectOwnerMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await call({ text: "Sneaky", project_id: PID });
    expect(res.status).toBe(400);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("does NOT run an ownership check for a standalone action", async () => {
    await call({ text: "Standalone" });
    expect(projectOwnerMaybeSingle).not.toHaveBeenCalled();
    expect(insertSpy).toHaveBeenCalled();
  });

  it("500s on a db error", async () => {
    insertSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await call({ text: "x" });
    expect(res.status).toBe(500);
  });

  it("500s when no row is returned", async () => {
    insertSingle.mockResolvedValue({ data: null, error: null });
    const res = await call({ text: "x" });
    expect(res.status).toBe(500);
  });
});
