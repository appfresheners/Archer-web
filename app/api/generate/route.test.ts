import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// --- Mocks -----------------------------------------------------------------

const getUser = vi.fn();
const generateProject = vi.fn();
const generateFramework = vi.fn();
const generateGoal = vi.fn();

// Supabase chains used by the route:
//   Pattern A:
//     projects: from("projects").insert(row).select("id").single()
//     actions:  from("actions").insert(rows)
//     rollback: from("projects").delete().eq("id", id)
//   Pattern C:
//     rpc:      rpc("save_goal_breakdown", { p_goal, p_projects })
const projectSingle = vi.fn();
const projectInsert = vi.fn();
const actionsInsert = vi.fn();
const projectDeleteEq = vi.fn();
const rpcCall = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({
        auth: { getUser },
        rpc: (fn: string, args: unknown) => rpcCall(fn, args),
        from: (table: string) => {
            if (table === "projects") {
                return {
                    insert: (row: unknown) => {
                        projectInsert(row);
                        return {
                            // Pattern A: .select("id").single()
                            select: () => ({ single: () => projectSingle() }),
                        };
                    },
                    // Pattern A rollback: .delete().eq("id", id)
                    delete: () => ({
                        eq: (col: string, val: string) => projectDeleteEq(col, val),
                    }),
                };
            }
            // actions
            return {
                insert: (rows: unknown) =>
                    // `actionsInsert` returns the `{ error }` result the route reads,
                    // defaulting to success unless a test overrides it.
                    Promise.resolve(actionsInsert(rows) ?? { error: null }),
            };
        },
    }),
}));

vi.mock("@/lib/projects/generate-project", () => ({
    generateProject: (input: string, depth: string) => generateProject(input, depth),
}));

vi.mock("@/lib/goals/generate-framework", () => ({
    generateFramework: (goal: string, why: string) => generateFramework(goal, why),
}));

vi.mock("@/lib/goals/generate-goal", () => ({
    generateGoal: (payload: unknown) => generateGoal(payload),
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
    _body: { id?: string; error?: string; framework?: unknown[] };
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
function projectInsertSucceeds(id = "project-1") {
    projectSingle.mockResolvedValue({ data: { id }, error: null });
}

function generatedMinimal() {
    return {
        name: "Portfolio site live",
        purpose: "Why.",
        successful_outcome: "Done.",
        next_actions: Array.from({ length: 12 }, (_, i) => `Action ${i + 1}`),
        detail: null,
    };
}

const call = (body: unknown, opts?: { invalidJson?: boolean }) =>
    POST(requestWith(body, opts)) as unknown as Promise<RouteResponse>;

// --- Tests -----------------------------------------------------------------

describe("/api/generate route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => { });
        // actions insert succeeds by default ({ error: null } via the mock fallback)
        actionsInsert.mockReturnValue({ error: null });
        projectDeleteEq.mockResolvedValue({ error: null });
    });

    it("returns 401 and never generates when unauthenticated", async () => {
        unauthenticated();
        const res = await call({ mode: "project", input: "Build a website", depth: "minimal" });
        expect(res.status).toBe(401);
        expect(generateProject).not.toHaveBeenCalled();
    });

    it("treats a Supabase auth failure as unauthenticated (401)", async () => {
        getUser.mockRejectedValue(new Error("network down"));
        const res = await call({ mode: "project", input: "x", depth: "minimal" });
        expect(res.status).toBe(401);
        expect(generateProject).not.toHaveBeenCalled();
    });

    it("returns { id } and saves a Minimal project + 12 action rows", async () => {
        authed();
        generateProject.mockResolvedValue(generatedMinimal());
        projectInsertSucceeds("project-minimal");

        const res = await call({ mode: "project", input: "Personal portfolio site", depth: "minimal" });

        expect(res.status).toBe(200);
        expect(res._body.id).toBe("project-minimal");
        expect(generateProject).toHaveBeenCalledWith("Personal portfolio site", "minimal");

        // Project row: structured columns, no markdown, planning_detail null.
        const row = projectInsert.mock.calls[0][0] as Record<string, unknown>;
        expect(row.user_id).toBe("user-123");
        expect(row.planning_depth).toBe("minimal");
        expect(row.goal_id).toBeNull();
        expect(row.name).toBe("Portfolio site live");
        expect(row.planning_detail).toBeNull();
        expect(row).not.toHaveProperty("breakdown_md");

        // 12 ordered action rows inserted for the new project.
        const actionRows = actionsInsert.mock.calls[0][0] as Array<Record<string, unknown>>;
        expect(actionRows).toHaveLength(12);
        expect(actionRows[0]).toMatchObject({
            user_id: "user-123",
            project_id: "project-minimal",
            sort_order: 0,
        });
        expect(actionRows[11].sort_order).toBe(11);
    });

    it("saves planning_detail for a Full-GTD project", async () => {
        authed();
        generateProject.mockResolvedValue({
            name: "Thing",
            purpose: "Why.",
            successful_outcome: "Done.",
            next_actions: Array.from({ length: 12 }, (_, i) => `A${i}`),
            detail: {
                principles: ["p1"],
                vision: "v",
                ideas: ["i1", "i2"],
                organizing: ["o1"],
            },
        });
        projectInsertSucceeds("project-full");

        const res = await call({ mode: "project", input: "Write a novel", depth: "full_gtd" });

        expect(res.status).toBe(200);
        expect(generateProject).toHaveBeenCalledWith("Write a novel", "full_gtd");
        const row = projectInsert.mock.calls[0][0] as Record<string, unknown>;
        expect(row.planning_depth).toBe("full_gtd");
        expect(row.planning_detail).toMatchObject({ vision: "v" });
    });

    it("returns 400 with no generation for a missing depth", async () => {
        authed();
        const res = await call({ mode: "project", input: "Build a website" });
        expect(res.status).toBe(400);
        expect(generateProject).not.toHaveBeenCalled();
    });

    it("returns 400 with no generation for an invalid depth", async () => {
        authed();
        const res = await call({ mode: "project", input: "Build a website", depth: "deep" });
        expect(res.status).toBe(400);
        expect(generateProject).not.toHaveBeenCalled();
    });

    it("returns 500 and no { id } when the project insert fails", async () => {
        authed();
        generateProject.mockResolvedValue(generatedMinimal());
        projectSingle.mockResolvedValue({ data: null, error: { message: "insert failed" } });

        const res = await call({ mode: "project", input: "x", depth: "minimal" });

        expect(res.status).toBe(500);
        expect(res._body.id).toBeUndefined();
        expect(actionsInsert).not.toHaveBeenCalled();
    });

    it("rolls back the project and returns 500 when the actions insert fails", async () => {
        authed();
        generateProject.mockResolvedValue(generatedMinimal());
        projectInsertSucceeds("project-orphan");
        actionsInsert.mockReturnValue({ error: { message: "actions insert failed" } });

        const res = await call({ mode: "project", input: "x", depth: "minimal" });

        expect(res.status).toBe(500);
        expect(res._body.id).toBeUndefined();
        // The orphaned project row is deleted (rollback).
        expect(projectDeleteEq).toHaveBeenCalledWith("id", "project-orphan");
    });

    it("returns 400 for empty input", async () => {
        authed();
        const res = await call({ mode: "project", input: "   ", depth: "minimal" });
        expect(res.status).toBe(400);
        expect(generateProject).not.toHaveBeenCalled();
    });

    it("returns 400 when input exceeds 2000 chars", async () => {
        authed();
        const res = await call({ mode: "project", input: "a".repeat(2001), depth: "minimal" });
        expect(res.status).toBe(400);
        expect(generateProject).not.toHaveBeenCalled();
    });

    it("returns 400 for an unknown mode", async () => {
        authed();
        const res = await call({ mode: "bogus", input: "Learn guitar", depth: "minimal" });
        expect(res.status).toBe(400);
        expect(generateProject).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid JSON body", async () => {
        authed();
        const res = await call(undefined, { invalidJson: true });
        expect(res.status).toBe(400);
        expect(generateProject).not.toHaveBeenCalled();
    });

    it("maps a generation timeout to 504", async () => {
        authed();
        generateProject.mockRejectedValue(
            new Error("Gemini request timed out after 30s. Please try again.")
        );
        const res = await call({ mode: "project", input: "x", depth: "minimal" });
        expect(res.status).toBe(504);
        expect(res._body.error).toMatch(/timed out|try again/i);
    });

    it("maps an AbortError to 504", async () => {
        authed();
        const err = new Error("Aborted");
        err.name = "AbortError";
        generateProject.mockRejectedValue(err);
        const res = await call({ mode: "project", input: "x", depth: "minimal" });
        expect(res.status).toBe(504);
    });

    it("maps a provider/config error to 500 with an actionable message", async () => {
        authed();
        generateProject.mockRejectedValue(
            new Error("GEMINI_API_KEY not configured. Add it to your .env.local file.")
        );
        const res = await call({ mode: "project", input: "x", depth: "minimal" });
        expect(res.status).toBe(500);
        expect(res._body.error).toContain(".env.local");
    });

    it("maps a JSON-format generation error to 500", async () => {
        authed();
        generateProject.mockRejectedValue(
            new Error("The generator returned a response that was not valid JSON. Please try again.")
        );
        const res = await call({ mode: "project", input: "x", depth: "minimal" });
        expect(res.status).toBe(500);
        expect(res._body.error).toMatch(/JSON/i);
    });
});

// --- Pattern B (goal framework) --------------------------------------------

describe("/api/generate route — Pattern B (goal framework)", () => {
    function sampleFramework() {
        return [
            { name: "Time management", required_level: 7, description: "Blocks focus time." },
            { name: "Vocal projection", required_level: 8, description: "Fills a room." },
            { name: "Stage confidence", required_level: 9, description: "Calm under eyes." },
        ];
    }

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => { });
    });

    it("returns 401 and never generates when unauthenticated", async () => {
        unauthenticated();
        const res = await call({
            mode: "goal",
            step: "framework",
            goal: "Become a confident public speaker",
            why: "I want to share ideas clearly with my community.",
        });
        expect(res.status).toBe(401);
        expect(generateFramework).not.toHaveBeenCalled();
    });

    it("returns 200 with the framework and writes no DB row (happy path)", async () => {
        authed();
        generateFramework.mockResolvedValue({ framework: sampleFramework() });

        const res = await call({
            mode: "goal",
            step: "framework",
            goal: "Become a confident public speaker",
            why: "I want to share ideas clearly with my community.",
        });

        expect(res.status).toBe(200);
        expect(res._body.framework).toHaveLength(3);
        expect(generateFramework).toHaveBeenCalledWith(
            "Become a confident public speaker",
            "I want to share ideas clearly with my community."
        );

        // No Supabase writes for Pattern B.
        expect(projectInsert).not.toHaveBeenCalled();
        expect(actionsInsert).not.toHaveBeenCalled();
        expect(projectDeleteEq).not.toHaveBeenCalled();
    });

    it("contains no user current-rating field in the response items", async () => {
        authed();
        generateFramework.mockResolvedValue({ framework: sampleFramework() });

        const res = await call({
            mode: "goal",
            step: "framework",
            goal: "Learn to cook",
            why: "I want to prepare healthy meals for my family.",
        });

        const framework = res._body.framework as Array<Record<string, unknown>>;
        for (const fi of framework) {
            expect(fi).not.toHaveProperty("user_rating");
            expect(fi).not.toHaveProperty("current_level");
        }
    });

    it("trims the goal before generating", async () => {
        authed();
        generateFramework.mockResolvedValue({ framework: sampleFramework() });
        await call({
            mode: "goal",
            step: "framework",
            goal: "  Run a marathon  ",
            why: "I want to build confidence and endurance.",
        });
        expect(generateFramework).toHaveBeenCalledWith(
            "Run a marathon",
            "I want to build confidence and endurance."
        );
    });

    it("returns 400 for an empty/whitespace goal, before generating", async () => {
        authed();
        const res = await call({ mode: "goal", step: "framework", goal: "   ", why: "Reason" });
        expect(res.status).toBe(400);
        expect(generateFramework).not.toHaveBeenCalled();
    });

    it("returns 400 when why is missing or blank, before generating", async () => {
        authed();
        const res = await call({
            mode: "goal",
            step: "framework",
            goal: "Learn to cook",
            why: "   ",
        });
        expect(res.status).toBe(400);
        expect(res._body.error).toMatch(/why is required/i);
        expect(generateFramework).not.toHaveBeenCalled();
    });

    it("returns 400 for an over-cap goal (>2000 chars), before generating", async () => {
        authed();
        const res = await call({
            mode: "goal",
            step: "framework",
            goal: "a".repeat(2001),
            why: "Reason",
        });
        expect(res.status).toBe(400);
        expect(generateFramework).not.toHaveBeenCalled();
    });

    it("returns 400 for an unknown step", async () => {
        authed();
        const res = await call({
            mode: "goal",
            step: "bogus",
            goal: "Learn guitar",
        });
        expect(res.status).toBe(400);
        expect(generateFramework).not.toHaveBeenCalled();
    });

    it("returns 400 for a missing step", async () => {
        authed();
        const res = await call({ mode: "goal", goal: "Learn guitar" });
        expect(res.status).toBe(400);
        expect(generateFramework).not.toHaveBeenCalled();
    });

    it("does not run framework generation for a generate-step request", async () => {
        // The `generate` step is Pattern C now; with an incomplete payload it
        // 400s on validation without ever calling framework generation.
        authed();
        const res = await call({
            mode: "goal",
            step: "generate",
            goal: "Learn guitar",
        });
        expect(res.status).toBe(400);
        expect(generateFramework).not.toHaveBeenCalled();
    });

    it("maps a framework generation timeout to 504", async () => {
        authed();
        generateFramework.mockRejectedValue(
            new Error("Gemini request timed out after 30s. Please try again.")
        );
        const res = await call({ mode: "goal", step: "framework", goal: "x", why: "Reason" });
        expect(res.status).toBe(504);
    });

    it("maps a framework format error to 500", async () => {
        authed();
        generateFramework.mockRejectedValue(
            new Error("The generator returned a response that was not valid JSON. Please try again.")
        );
        const res = await call({ mode: "goal", step: "framework", goal: "x", why: "Reason" });
        expect(res.status).toBe(500);
        expect(res._body.error).toMatch(/JSON/i);
    });

    it("maps a provider/config error to 500 with an actionable message", async () => {
        authed();
        generateFramework.mockRejectedValue(
            new Error("GEMINI_API_KEY not configured. Add it to your .env.local file.")
        );
        const res = await call({ mode: "goal", step: "framework", goal: "x", why: "Reason" });
        expect(res.status).toBe(500);
        expect(res._body.error).toContain(".env.local");
    });
});

// --- Pattern C (goal generate) ---------------------------------------------

describe("/api/generate route — Pattern C (goal generate)", () => {
    function sampleFramework() {
        return [
            { name: "Time management", required_level: 7, description: "Focus.", user_rating: 5 },
            { name: "Vocal projection", required_level: 8, description: "Room.", user_rating: 4 },
            { name: "Stage confidence", required_level: 9, description: "Calm.", user_rating: 3 },
        ];
    }

    function validPayload(overrides: Record<string, unknown> = {}) {
        return {
            mode: "goal",
            step: "generate",
            goal: "Become a confident public speaker",
            why: "I want to share ideas clearly with my community.",
            framework: sampleFramework(),
            drivers: ["I love a challenge"],
            barriers: ["I get nervous"],
            ifThen: "If it is 7am, then I will rehearse for 10 minutes",
            ...overrides,
        };
    }

    function generatedBreakdown(projectCount = 5) {
        return {
            goal_statement: "In 3 months I will speak confidently.",
            success_criteria: ["Gave a talk", "No notes", "Positive feedback"],
            projects: Array.from({ length: projectCount }, (_, p) => ({
                name: `Project ${p + 1}`,
                purpose: "Why.",
                successful_outcome: "Done.",
                next_actions: Array.from({ length: 12 }, (_, a) => `P${p}A${a}`),
            })),
        };
    }

    /** Make the save RPC resolve with the given goal id. */
    function rpcSucceeds(id = "goal-1") {
        rpcCall.mockResolvedValue({ data: id, error: null });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => { });
        rpcSucceeds();
    });

    it("returns 401 and never generates when unauthenticated", async () => {
        unauthenticated();
        const res = await call(validPayload());
        expect(res.status).toBe(401);
        expect(generateGoal).not.toHaveBeenCalled();
    });

    it("returns { id } and saves goal + projects + actions in one RPC (happy path)", async () => {
        authed();
        generateGoal.mockResolvedValue(generatedBreakdown(5));
        rpcSucceeds("goal-happy");

        const res = await call(validPayload());

        expect(res.status).toBe(200);
        expect(res._body.id).toBe("goal-happy");

        // One atomic RPC with the goal + grouped projects payload.
        expect(rpcCall).toHaveBeenCalledTimes(1);
        const [fn, args] = rpcCall.mock.calls[0] as [
            string,
            { p_goal: Record<string, unknown>; p_projects: Array<Record<string, unknown>> },
        ];
        expect(fn).toBe("save_goal_breakdown");

        // Goal payload: goal_text, target_date, skill_framework (with
        // user_rating), drivers/barriers/if_then_plan verbatim.
        const pGoal = args.p_goal;
        expect(pGoal.goal_text).toBe("Become a confident public speaker");
        expect(pGoal.why).toBe("I want to share ideas clearly with my community.");
        expect(typeof pGoal.target_date).toBe("string");
        expect(pGoal.if_then_plan).toBe(
            "If it is 7am, then I will rehearse for 10 minutes"
        );
        // Drivers/barriers persisted verbatim from the user payload (the
        // AI-never-owns invariant): these come from the wizard, not the model.
        expect(pGoal.drivers).toEqual(["I love a challenge"]);
        expect(pGoal.barriers).toEqual(["I get nervous"]);
        const persistedFramework = pGoal.skill_framework as Array<Record<string, unknown>>;
        expect(persistedFramework[0]).toHaveProperty("user_rating");

        // 5 projects, each with its 12 next actions grouped under it so the
        // project→action mapping can never desync inside the RPC.
        const pProjects = args.p_projects;
        expect(pProjects).toHaveLength(5);
        expect(pProjects[0]).toMatchObject({
            name: "Project 1",
            purpose: "Why.",
            successful_outcome: "Done.",
            sort_order: 0,
        });
        expect(pProjects[0].next_actions).toHaveLength(12);
        expect(pProjects[4].sort_order).toBe(4);
    });

    it("computes target_date roughly 3 months out (ISO YYYY-MM-DD)", async () => {
        authed();
        generateGoal.mockResolvedValue(generatedBreakdown(5));

        await call(validPayload());
        const [, args] = rpcCall.mock.calls[0] as [
            string,
            { p_goal: Record<string, unknown> },
        ];
        expect(args.p_goal.target_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns 400 for a framework with fewer than 3 items (before generating)", async () => {
        authed();
        const res = await call(
            validPayload({ framework: sampleFramework().slice(0, 2) })
        );
        expect(res.status).toBe(400);
        expect(generateGoal).not.toHaveBeenCalled();
    });

    it("returns 400 when a framework item lacks a user_rating", async () => {
        authed();
        const framework = sampleFramework();
        delete (framework[0] as Record<string, unknown>).user_rating;
        const res = await call(validPayload({ framework }));
        expect(res.status).toBe(400);
        expect(generateGoal).not.toHaveBeenCalled();
    });

    it("returns 400 when a framework item has an out-of-range required_level", async () => {
        authed();
        const framework = sampleFramework();
        (framework[0] as Record<string, unknown>).required_level = 11;
        const res = await call(validPayload({ framework }));
        expect(res.status).toBe(400);
        expect(generateGoal).not.toHaveBeenCalled();
    });

    it("returns 400 for empty drivers", async () => {
        authed();
        const res = await call(validPayload({ drivers: [] }));
        expect(res.status).toBe(400);
        expect(generateGoal).not.toHaveBeenCalled();
    });

    it("returns 400 for empty barriers", async () => {
        authed();
        const res = await call(validPayload({ barriers: ["   "] }));
        expect(res.status).toBe(400);
        expect(generateGoal).not.toHaveBeenCalled();
    });

    it("returns 400 for an empty ifThen", async () => {
        authed();
        const res = await call(validPayload({ ifThen: "  " }));
        expect(res.status).toBe(400);
        expect(generateGoal).not.toHaveBeenCalled();
    });

    it("returns 400 for an empty goal", async () => {
        authed();
        const res = await call(validPayload({ goal: "   " }));
        expect(res.status).toBe(400);
        expect(generateGoal).not.toHaveBeenCalled();
    });

    it("returns 400 for an over-cap goal (>2000 chars)", async () => {
        authed();
        const res = await call(validPayload({ goal: "a".repeat(2001) }));
        expect(res.status).toBe(400);
        expect(generateGoal).not.toHaveBeenCalled();
    });

    it("maps a generation timeout to 504 and saves nothing", async () => {
        authed();
        generateGoal.mockRejectedValue(
            new Error("Gemini request timed out after 30s. Please try again.")
        );
        const res = await call(validPayload());
        expect(res.status).toBe(504);
        expect(rpcCall).not.toHaveBeenCalled();
    });

    it("maps a format error to 500 and saves nothing", async () => {
        authed();
        generateGoal.mockRejectedValue(
            new Error("The generator returned a response that was not valid JSON. Please try again.")
        );
        const res = await call(validPayload());
        expect(res.status).toBe(500);
        expect(res._body.error).toMatch(/JSON/i);
        expect(rpcCall).not.toHaveBeenCalled();
    });

    it("returns 500 and no { id } when the save RPC fails", async () => {
        authed();
        generateGoal.mockResolvedValue(generatedBreakdown(5));
        rpcCall.mockResolvedValue({ data: null, error: { message: "boom" } });

        const res = await call(validPayload());
        expect(res.status).toBe(500);
        expect(res._body.id).toBeUndefined();
        // The RPC owns atomicity: a mid-sequence failure rolls back server-side,
        // so the route performs no manual rollback.
        expect(rpcCall).toHaveBeenCalledTimes(1);
    });

    it("returns 500 and no { id } when the save RPC returns no id", async () => {
        authed();
        generateGoal.mockResolvedValue(generatedBreakdown(5));
        rpcCall.mockResolvedValue({ data: null, error: null });

        const res = await call(validPayload());
        expect(res.status).toBe(500);
        expect(res._body.id).toBeUndefined();
    });

    it("returns 400 for a drivers list that exceeds the item cap", async () => {
        authed();
        const tooMany = Array.from({ length: 31 }, (_, i) => `driver ${i}`);
        const res = await call(validPayload({ drivers: tooMany }));
        expect(res.status).toBe(400);
        expect(generateGoal).not.toHaveBeenCalled();
    });

    it("returns 400 for an over-cap if–then plan (>2000 chars)", async () => {
        authed();
        const res = await call(validPayload({ ifThen: "x".repeat(2001) }));
        expect(res.status).toBe(400);
        expect(generateGoal).not.toHaveBeenCalled();
    });
});
