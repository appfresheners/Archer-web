import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// --- Mocks -----------------------------------------------------------------

const getUser = vi.fn();
const generateProject = vi.fn();
const generateFramework = vi.fn();

// Supabase chains used by the route:
//   projects: from("projects").insert(row).select("id").single()
//   actions:  from("actions").insert(rows)
//   rollback: from("projects").delete().eq("id", id)
const projectSingle = vi.fn();
const projectInsert = vi.fn();
const actionsInsert = vi.fn();
const projectDeleteEq = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({
        auth: { getUser },
        from: (table: string) => {
            if (table === "projects") {
                return {
                    insert: (row: unknown) => {
                        projectInsert(row);
                        return {
                            select: () => ({ single: () => projectSingle() }),
                        };
                    },
                    delete: () => ({
                        eq: (col: string, val: string) => projectDeleteEq(col, val),
                    }),
                };
            }
            // actions
            return {
                insert: (rows: unknown) => {
                    // `actionsInsert` returns the `{ error }` result the route reads,
                    // defaulting to success unless a test overrides it.
                    return Promise.resolve(actionsInsert(rows) ?? { error: null });
                },
            };
        },
    }),
}));

vi.mock("@/lib/projects/generate-project", () => ({
    generateProject: (input: string, depth: string) => generateProject(input, depth),
}));

vi.mock("@/lib/goals/generate-framework", () => ({
    generateFramework: (goal: string) => generateFramework(goal),
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
        });

        expect(res.status).toBe(200);
        expect(res._body.framework).toHaveLength(3);
        expect(generateFramework).toHaveBeenCalledWith(
            "Become a confident public speaker"
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
        await call({ mode: "goal", step: "framework", goal: "  Run a marathon  " });
        expect(generateFramework).toHaveBeenCalledWith("Run a marathon");
    });

    it("returns 400 for an empty/whitespace goal, before generating", async () => {
        authed();
        const res = await call({ mode: "goal", step: "framework", goal: "   " });
        expect(res.status).toBe(400);
        expect(generateFramework).not.toHaveBeenCalled();
    });

    it("returns 400 for an over-cap goal (>2000 chars), before generating", async () => {
        authed();
        const res = await call({
            mode: "goal",
            step: "framework",
            goal: "a".repeat(2001),
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

    it("returns 400 for the not-yet-supported generate step", async () => {
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
        const res = await call({ mode: "goal", step: "framework", goal: "x" });
        expect(res.status).toBe(504);
    });

    it("maps a framework format error to 500", async () => {
        authed();
        generateFramework.mockRejectedValue(
            new Error("The generator returned a response that was not valid JSON. Please try again.")
        );
        const res = await call({ mode: "goal", step: "framework", goal: "x" });
        expect(res.status).toBe(500);
        expect(res._body.error).toMatch(/JSON/i);
    });

    it("maps a provider/config error to 500 with an actionable message", async () => {
        authed();
        generateFramework.mockRejectedValue(
            new Error("GEMINI_API_KEY not configured. Add it to your .env.local file.")
        );
        const res = await call({ mode: "goal", step: "framework", goal: "x" });
        expect(res.status).toBe(500);
        expect(res._body.error).toContain(".env.local");
    });
});
