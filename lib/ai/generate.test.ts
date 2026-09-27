import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generate } from "./generate";

const ENV_KEYS = [
    "AI_PROVIDER",
    "GEMINI_MODEL",
    "GROQ_MODEL",
    "OPENAI_MODEL",
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "OPENAI_API_KEY",
] as const;

describe("lib/ai/generate", () => {
    let saved: Record<string, string | undefined>;

    beforeEach(() => {
        saved = {};
        for (const key of ENV_KEYS) {
            saved[key] = process.env[key];
            delete process.env[key];
        }
        vi.spyOn(console, "error").mockImplementation(() => { });
        vi.spyOn(console, "info").mockImplementation(() => { });
    });

    afterEach(() => {
        for (const key of ENV_KEYS) {
            if (saved[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = saved[key];
            }
        }
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe("gemini", () => {
        beforeEach(() => {
            process.env.AI_PROVIDER = "gemini";
            process.env.GEMINI_MODEL = "gemini-3.1-flash-lite";
            process.env.GEMINI_API_KEY = "gkey";
        });

        it("returns the generated text on success", async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: "hello world" }] } }],
                }),
            });
            vi.stubGlobal("fetch", fetchMock);

            const result = await generate("system", "user");

            expect(result).toBe("hello world");
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toContain("gemini-3.1-flash-lite");
            expect(init.headers["x-goog-api-key"]).toBe("gkey");
        });

        it("throws an actionable error on a provider HTTP error", async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
                json: async () => ({ error: "invalid key" }),
            });
            vi.stubGlobal("fetch", fetchMock);

            await expect(generate("system", "user")).rejects.toThrow(/Gemini/);
            await expect(generate("system", "user")).rejects.toThrow(/401/);
        });

        it("throws a timeout error when the request aborts", async () => {
            const fetchMock = vi.fn().mockImplementation(
                () =>
                    new Promise((_resolve, reject) => {
                        const err = new DOMException("Aborted", "AbortError");
                        reject(err);
                    })
            );
            vi.stubGlobal("fetch", fetchMock);

            await expect(generate("system", "user")).rejects.toThrow(/timed out/);
        });

        it("maps a plain Error named AbortError to a timeout (cross-runtime)", async () => {
            const fetchMock = vi.fn().mockImplementation(
                () =>
                    new Promise((_resolve, reject) => {
                        const err = new Error("Aborted");
                        err.name = "AbortError";
                        reject(err);
                    })
            );
            vi.stubGlobal("fetch", fetchMock);

            await expect(generate("system", "user")).rejects.toThrow(/timed out/);
        });
    });

    describe("openai-compatible (groq/openai)", () => {
        it("sends a bearer token and returns chat content (groq)", async () => {
            process.env.AI_PROVIDER = "groq";
            process.env.GROQ_MODEL = "llama-3.1-8b-instant";
            process.env.GROQ_API_KEY = "qkey";

            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: "chat reply" } }],
                }),
            });
            vi.stubGlobal("fetch", fetchMock);

            const result = await generate("system", "user");

            expect(result).toBe("chat reply");
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toContain("api.groq.com");
            expect(init.headers.Authorization).toBe("Bearer qkey");
            expect(JSON.parse(init.body).model).toBe("llama-3.1-8b-instant");
        });

        it("throws an actionable error for openai HTTP failures", async () => {
            process.env.AI_PROVIDER = "openai";
            process.env.OPENAI_MODEL = "gpt-4o-mini";
            process.env.OPENAI_API_KEY = "okey";

            const fetchMock = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({}),
            });
            vi.stubGlobal("fetch", fetchMock);

            await expect(generate("system", "user")).rejects.toThrow(/OpenAI/);
        });
    });

    describe("empty-but-OK responses are surfaced as errors", () => {
        it("throws when Gemini returns 200 with no text (e.g. safety-blocked)", async () => {
            process.env.AI_PROVIDER = "gemini";
            process.env.GEMINI_MODEL = "gemini-3.1-flash-lite";
            process.env.GEMINI_API_KEY = "gkey";

            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ candidates: [] }),
            });
            vi.stubGlobal("fetch", fetchMock);

            await expect(generate("system", "user")).rejects.toThrow(
                /no content/i
            );
        });

        it("throws when an OpenAI-compatible provider returns 200 with null content", async () => {
            process.env.AI_PROVIDER = "openai";
            process.env.OPENAI_MODEL = "gpt-4o-mini";
            process.env.OPENAI_API_KEY = "okey";

            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: null } }] }),
            });
            vi.stubGlobal("fetch", fetchMock);

            await expect(generate("system", "user")).rejects.toThrow(
                /no content/i
            );
        });
    });

    describe("configuration failures short-circuit before fetch", () => {
        it("throws the missing-model error and never calls fetch", async () => {
            process.env.AI_PROVIDER = "gemini";
            process.env.GEMINI_API_KEY = "gkey";
            const fetchMock = vi.fn();
            vi.stubGlobal("fetch", fetchMock);

            await expect(generate("system", "user")).rejects.toThrow(
                /GEMINI_MODEL/
            );
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("throws the missing-key error and never calls fetch", async () => {
            process.env.AI_PROVIDER = "gemini";
            process.env.GEMINI_MODEL = "gemini-3.1-flash-lite";
            const fetchMock = vi.fn();
            vi.stubGlobal("fetch", fetchMock);

            await expect(generate("system", "user")).rejects.toThrow(
                /GEMINI_API_KEY/
            );
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });
});
