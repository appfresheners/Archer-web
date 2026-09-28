import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// --- Mocks -----------------------------------------------------------------

const getUser = vi.fn();
const generate = vi.fn();

// Supabase insert chain: `from(table).insert(row).select("id").single()`.
// `single` resolves to the row-shaped `{ data, error }` the route reads.
const single = vi.fn();
const insert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({
        auth: { getUser },
        from: (table: string) => ({
            insert: (row: unknown) => {
                insert(table, row);
                return {
                    select: () => ({
                        single: () => single(),
                    }),
                };
            },
        }),
    }),
}));

vi.mock("@/lib/ai", () => ({
    generate: (systemPrompt: string, userMessage: string) =>
        generate(systemPrompt, userMessage),
}));

/** Make the mocked Supabase insert resolve to a saved row with `id`. */
function insertSucceeds(id = "project-1") {
    single.mockResolvedValue({ data: { id }, error: null });
}

/** Make the mocked Supabase insert resolve to an error (no row). */
function insertFails() {
    single.mockResolvedValue({
        data: null,
        error: { message: "insert failed" },
    });
}

// Light `next/server` stand-in: `NextResponse.json(body, init)` returns an
// object exposing the JSON payload and status so we can assert without pulling
// in the full Next runtime.
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
    _body: { id?: string; markdown?: string; error?: string };
    status: number;
};

/** Build a request-shaped object exposing the `json()` the handler reads. */
function requestWith(body: unknown, opts?: { invalidJson?: boolean }) {
    return {
        json: async () => {
            if (opts?.invalidJson) {
                throw new SyntaxError("Unexpected token");
            }
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

const call = (body: unknown, opts?: { invalidJson?: boolean }) =>
    POST(requestWith(body, opts)) as unknown as Promise<RouteResponse>;

// --- Tests -----------------------------------------------------------------

describe("/api/generate route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => { });
    });

    it("returns 401 and never calls the provider when unauthenticated", async () => {
        unauthenticated();

        const res = await call({ mode: "project", input: "Build a website" });

        expect(res.status).toBe(401);
        expect(res._body.error).toBeTruthy();
        expect(generate).not.toHaveBeenCalled();
    });

    it("treats a Supabase auth failure as unauthenticated (401)", async () => {
        getUser.mockRejectedValue(new Error("network down"));

        const res = await call({ mode: "project", input: "Build a website" });

        expect(res.status).toBe(401);
        expect(generate).not.toHaveBeenCalled();
    });

    it("returns 200 { id } on a valid Minimal project request and saves the row", async () => {
        authed();
        generate.mockResolvedValue(
            "# Portfolio site live\n\n## Purpose\nWhy.\n\n## Successful Outcome\nDone."
        );
        insertSucceeds("project-minimal");

        const res = await call({
            mode: "project",
            input: "Personal portfolio site",
            depth: "minimal",
        });

        expect(res.status).toBe(200);
        expect(res._body.id).toBe("project-minimal");
        expect(res._body.markdown).toBeUndefined();
        expect(generate).toHaveBeenCalledTimes(1);

        // Minimal depth selects the Minimal prompt (NOT the Natural Planning
        // Model), and the user input is passed through.
        const [systemPrompt, userMessage] = generate.mock.calls[0];
        expect(systemPrompt).toContain("GTD");
        expect(systemPrompt).not.toContain("Natural Planning Model");
        expect(userMessage).toContain("Personal portfolio site");

        // A row was inserted into `projects` with the request depth.
        expect(insert).toHaveBeenCalledTimes(1);
        const [table, row] = insert.mock.calls[0] as [string, Record<string, unknown>];
        expect(table).toBe("projects");
        expect(row.user_id).toBe("user-123");
        expect(row.planning_depth).toBe("minimal");
        expect(row.goal_id).toBeNull();
        expect(row.name).toBe("Portfolio site live");
        expect(row.breakdown_md).toContain("## Successful Outcome");
    });

    it("selects the Full-GTD prompt and saves planning_depth=full_gtd", async () => {
        authed();
        generate.mockResolvedValue("# Thing\n\n## Purpose\nWhy.");
        insertSucceeds("project-full");

        const res = await call({
            mode: "project",
            input: "Write a novel",
            depth: "full_gtd",
        });

        expect(res.status).toBe(200);
        expect(res._body.id).toBe("project-full");

        const [systemPrompt] = generate.mock.calls[0];
        expect(systemPrompt).toContain("Natural Planning Model");

        const [, row] = insert.mock.calls[0] as [string, Record<string, unknown>];
        expect(row.planning_depth).toBe("full_gtd");
    });

    it("returns 400 with no AI call for a missing depth on a project request", async () => {
        authed();

        const res = await call({ mode: "project", input: "Build a website" });

        expect(res.status).toBe(400);
        expect(generate).not.toHaveBeenCalled();
        expect(insert).not.toHaveBeenCalled();
    });

    it("returns 400 with no AI call for an invalid depth", async () => {
        authed();

        const res = await call({
            mode: "project",
            input: "Build a website",
            depth: "deep",
        });

        expect(res.status).toBe(400);
        expect(generate).not.toHaveBeenCalled();
        expect(insert).not.toHaveBeenCalled();
    });

    it("returns 500 and no { id } when the Supabase insert fails", async () => {
        authed();
        generate.mockResolvedValue("# Project\n\n## Purpose\n...");
        insertFails();

        const res = await call({
            mode: "project",
            input: "Build a website",
            depth: "minimal",
        });

        expect(res.status).toBe(500);
        expect(res._body.id).toBeUndefined();
        expect(res._body.error).toBeTruthy();
        // Generation still happened; only the save failed.
        expect(generate).toHaveBeenCalledTimes(1);
    });

    it("returns 400 and no provider call for empty input", async () => {
        authed();

        const res = await call({ mode: "project", input: "   " });

        expect(res.status).toBe(400);
        expect(generate).not.toHaveBeenCalled();
    });

    it("returns 400 and no provider call for missing input", async () => {
        authed();

        const res = await call({ mode: "project" });

        expect(res.status).toBe(400);
        expect(generate).not.toHaveBeenCalled();
    });

    it("returns 400 and no provider call when input exceeds 2000 chars", async () => {
        authed();

        const res = await call({ mode: "project", input: "a".repeat(2001) });

        expect(res.status).toBe(400);
        expect(generate).not.toHaveBeenCalled();
    });

    it("returns 400 and no provider call for an unknown mode", async () => {
        authed();

        const res = await call({ mode: "goal", input: "Learn guitar" });

        expect(res.status).toBe(400);
        expect(generate).not.toHaveBeenCalled();
    });

    it("returns 400 for a missing mode", async () => {
        authed();

        const res = await call({ input: "Learn guitar" });

        expect(res.status).toBe(400);
        expect(generate).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid JSON body", async () => {
        authed();

        const res = await call(undefined, { invalidJson: true });

        expect(res.status).toBe(400);
        expect(generate).not.toHaveBeenCalled();
    });

    it("maps a provider timeout to 504", async () => {
        authed();
        generate.mockRejectedValue(
            new Error("Gemini request timed out after 30s. Please try again.")
        );

        const res = await call({
            mode: "project",
            input: "Build a website",
            depth: "minimal",
        });

        expect(res.status).toBe(504);
        expect(res._body.error).toMatch(/timed out|try again/i);
    });

    it("maps an AbortError from the provider to 504", async () => {
        authed();
        const err = new Error("Aborted");
        err.name = "AbortError";
        generate.mockRejectedValue(err);

        const res = await call({
            mode: "project",
            input: "Build a website",
            depth: "minimal",
        });

        expect(res.status).toBe(504);
    });

    it("maps a provider/config error to 500 with an actionable message", async () => {
        authed();
        generate.mockRejectedValue(
            new Error(
                "GEMINI_API_KEY not configured. Add it to your .env.local file."
            )
        );

        const res = await call({
            mode: "project",
            input: "Build a website",
            depth: "minimal",
        });

        expect(res.status).toBe(500);
        expect(res._body.error).toContain(".env.local");
    });

    it("surfaces an empty-AI-response error as 500 (not a silent success)", async () => {
        authed();
        generate.mockRejectedValue(
            new Error("Gemini returned no content. Please try again.")
        );

        const res = await call({
            mode: "project",
            input: "Build a website",
            depth: "minimal",
        });

        expect(res.status).toBe(500);
        expect(res._body.error).toMatch(/no content/i);
    });
});
