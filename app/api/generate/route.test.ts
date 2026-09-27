import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// --- Mocks -----------------------------------------------------------------

const getUser = vi.fn();
const generate = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({
        auth: { getUser },
    }),
}));

vi.mock("@/lib/ai", () => ({
    generate: (systemPrompt: string, userMessage: string) =>
        generate(systemPrompt, userMessage),
}));

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

type RouteResponse = { _body: { markdown?: string; error?: string }; status: number };

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
        vi.spyOn(console, "error").mockImplementation(() => {});
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

    it("returns 200 { markdown } on a valid project request", async () => {
        authed();
        generate.mockResolvedValue("# Project\n\n## Purpose\n...");

        const res = await call({ mode: "project", input: "Personal portfolio site" });

        expect(res.status).toBe(200);
        expect(res._body.markdown).toContain("# Project");
        expect(generate).toHaveBeenCalledTimes(1);
        // Project Mode prompt is used and the user input is passed through.
        const [systemPrompt, userMessage] = generate.mock.calls[0];
        expect(systemPrompt).toContain("GTD");
        expect(userMessage).toContain("Personal portfolio site");
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

        const res = await call({ mode: "project", input: "Build a website" });

        expect(res.status).toBe(504);
        expect(res._body.error).toMatch(/timed out|try again/i);
    });

    it("maps an AbortError from the provider to 504", async () => {
        authed();
        const err = new Error("Aborted");
        err.name = "AbortError";
        generate.mockRejectedValue(err);

        const res = await call({ mode: "project", input: "Build a website" });

        expect(res.status).toBe(504);
    });

    it("maps a provider/config error to 500 with an actionable message", async () => {
        authed();
        generate.mockRejectedValue(
            new Error(
                "GEMINI_API_KEY not configured. Add it to your .env.local file."
            )
        );

        const res = await call({ mode: "project", input: "Build a website" });

        expect(res.status).toBe(500);
        expect(res._body.error).toContain(".env.local");
    });

    it("surfaces an empty-AI-response error as 500 (not a silent success)", async () => {
        authed();
        generate.mockRejectedValue(
            new Error("Gemini returned no content. Please try again.")
        );

        const res = await call({ mode: "project", input: "Build a website" });

        expect(res.status).toBe(500);
        expect(res._body.error).toMatch(/no content/i);
    });
});
