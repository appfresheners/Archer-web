import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const UUID = "66666666-6666-4666-8666-666666666666";

const getUser = vi.fn();
const goalsMaybeSingle = vi.fn();
const projectInsert = vi.fn();
const projectInsertSingle = vi.fn();
// Records each `.eq(column, value)` applied to the goals ownership check so the
// tests can assert the guard really scopes by both id AND user_id.
const goalEqCalls: [string, unknown][] = [];

// Mock the server Supabase client with the two chains this route uses:
//   - from("goals").select("id").eq("id",gid).eq("user_id",uid).maybeSingle()
//   - from("projects").insert(row).select("id").single()
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table === "goals") {
        return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              goalEqCalls.push([column, value]);
              return {
                eq: (column2: string, value2: unknown) => {
                  goalEqCalls.push([column2, value2]);
                  return { maybeSingle: () => goalsMaybeSingle() };
                },
              };
            },
          }),
        };
      }
      if (table === "projects") {
        return {
          insert: (row: unknown) => {
            projectInsert(row);
            return {
              select: () => ({ single: () => projectInsertSingle() }),
            };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  }),
}));

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    goalEqCalls.length = 0;
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postReq({ name: "A project" }) as never);
    expect(res.status).toBe(401);
  });

  it("400s on a non-JSON body", async () => {
    const res = await POST(postReq("not json") as never);
    expect(res.status).toBe(400);
  });

  it("400s on an invalid payload (missing name)", async () => {
    const res = await POST(postReq({}) as never);
    expect(res.status).toBe(400);
    expect(projectInsert).not.toHaveBeenCalled();
  });

  it("inserts a goal-less project and returns its id", async () => {
    projectInsertSingle.mockResolvedValue({ data: { id: "p1" }, error: null });
    const res = await POST(
      postReq({
        name: "  Launch a newsletter  ",
        purpose: "Grow an audience",
        successful_outcome: "500 subscribers",
      }) as never,
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "p1" });
    expect(projectInsert).toHaveBeenCalledWith({
      user_id: "u1",
      goal_id: null,
      name: "Launch a newsletter",
      purpose: "Grow an audience",
      successful_outcome: "500 subscribers",
    });
    // No goal ownership check for a goal-less create.
    expect(goalsMaybeSingle).not.toHaveBeenCalled();
  });

  it("verifies goal ownership and inserts with an owned goal_id", async () => {
    goalsMaybeSingle.mockResolvedValue({ data: { id: UUID }, error: null });
    projectInsertSingle.mockResolvedValue({ data: { id: "p1" }, error: null });
    const res = await POST(
      postReq({ name: "A project", goal_id: UUID }) as never,
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "p1" });
    expect(projectInsert).toHaveBeenCalledWith({
      user_id: "u1",
      goal_id: UUID,
      name: "A project",
      purpose: null,
      successful_outcome: null,
    });
    // The ownership guard must scope the lookup by BOTH the supplied goal id
    // and the acting user — this is the cross-owner boundary under test.
    expect(goalEqCalls).toContainEqual(["id", UUID]);
    expect(goalEqCalls).toContainEqual(["user_id", "u1"]);
  });

  it("rejects a foreign/missing goal without inserting", async () => {
    goalsMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST(
      postReq({ name: "A project", goal_id: UUID }) as never,
    );
    expect(res.status).toBe(400);
    expect(projectInsert).not.toHaveBeenCalled();
    expect(goalEqCalls).toContainEqual(["id", UUID]);
    expect(goalEqCalls).toContainEqual(["user_id", "u1"]);
  });

  it("400s (no insert) when an optional field is present but invalid", async () => {
    const nonStringPurpose = await POST(
      postReq({ name: "A project", purpose: 5 }) as never,
    );
    expect(nonStringPurpose.status).toBe(400);
    expect(projectInsert).not.toHaveBeenCalled();

    const badGoal = await POST(
      postReq({ name: "A project", goal_id: "not-a-uuid" }) as never,
    );
    expect(badGoal.status).toBe(400);
    expect(projectInsert).not.toHaveBeenCalled();
    // Invalid optional fields are rejected before any goal ownership lookup.
    expect(goalsMaybeSingle).not.toHaveBeenCalled();
  });

  it("500s when the goal ownership check errors", async () => {
    goalsMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(
      postReq({ name: "A project", goal_id: UUID }) as never,
    );
    expect(res.status).toBe(500);
    expect(projectInsert).not.toHaveBeenCalled();
  });

  it("500s on an insert database error", async () => {
    projectInsertSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(postReq({ name: "A project" }) as never);
    expect(res.status).toBe(500);
  });

  it("500s when the insert returns no row", async () => {
    projectInsertSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST(postReq({ name: "A project" }) as never);
    expect(res.status).toBe(500);
  });
});
