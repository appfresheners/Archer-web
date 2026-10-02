import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const getUser = vi.fn();
const generateProject = vi.fn();

vi.mock("@/lib/projects/generate-project", () => ({
  generateProject: (input: string, depth: string) => generateProject(input, depth),
}));

// Supabase chains used by the regenerate route:
//   read:     from("projects").select().eq("id").eq("user_id").maybeSingle()
//   replace:  rpc("regenerate_project_actions", { p_project_id, p_project, p_actions })
const projectReadMaybeSingle = vi.fn();
const rpcCall = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc: (fn: string, args: unknown) => rpcCall(fn, args),
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: () => projectReadMaybeSingle() }) }),
      }),
    }),
  }),
}));

const ctx = (id = "p1") => ({ params: Promise.resolve({ id }) });

const generated = {
  name: "Fresh name",
  purpose: "Fresh purpose",
  successful_outcome: "Fresh outcome",
  next_actions: Array.from({ length: 12 }, (_, i) => `Action ${i + 1}`),
  detail: null,
};

describe("POST /api/projects/[id]/regenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    projectReadMaybeSingle.mockResolvedValue({
      data: { id: "p1", name: "Old", purpose: "why", planning_depth: "minimal" },
      error: null,
    });
    rpcCall.mockResolvedValue({ data: null, error: null });
    generateProject.mockResolvedValue(generated);
  });

  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(401);
    expect(generateProject).not.toHaveBeenCalled();
  });

  it("404s when the project is absent or not owned", async () => {
    projectReadMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(404);
    expect(generateProject).not.toHaveBeenCalled();
  });

  it("regenerates atomically: replaces AI fields and the 12 actions, returns the id", async () => {
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "p1" });

    // Regeneration used the existing depth and the project name+purpose.
    expect(generateProject).toHaveBeenCalledWith("Old — why", "minimal");

    // One atomic RPC replaces the project fields and its actions.
    expect(rpcCall).toHaveBeenCalledTimes(1);
    const [fn, args] = rpcCall.mock.calls[0] as [
      string,
      { p_project_id: string; p_project: Record<string, unknown>; p_actions: unknown[] },
    ];
    expect(fn).toBe("regenerate_project_actions");
    expect(args.p_project_id).toBe("p1");
    expect(args.p_project).toEqual({
      name: "Fresh name",
      purpose: "Fresh purpose",
      successful_outcome: "Fresh outcome",
      planning_detail: null,
    });
    expect(args.p_actions).toHaveLength(12);
    expect(args.p_actions[0]).toEqual({ text: "Action 1", sort_order: 0 });
  });

  it("maps a generation timeout to 504 and does not touch the project", async () => {
    generateProject.mockRejectedValue(new Error("The request timed out."));
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(504);
    expect(rpcCall).not.toHaveBeenCalled();
  });

  it("500s when the regenerate RPC fails, without any partial write", async () => {
    rpcCall.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(500);
    // Generation ran; the RPC owns atomicity server-side.
    expect(generateProject).toHaveBeenCalled();
    expect(rpcCall).toHaveBeenCalledTimes(1);
  });

  it("404s when the regenerate RPC reports the project is gone (P0002)", async () => {
    rpcCall.mockResolvedValue({
      data: null,
      error: { message: "gone", code: "P0002" },
    });
    const res = await POST({} as never, ctx());
    expect(res.status).toBe(404);
    expect(generateProject).toHaveBeenCalled();
  });
});
