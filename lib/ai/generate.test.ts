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

        it("throws an actionable error on a provider HTTP error (no retry on 4xx)", async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
                json: async () => ({ error: "invalid key" }),
                text: async () => '{"error":"invalid key"}',
                headers: { get: () => null },
            });
            vi.stubGlobal("fetch", fetchMock);

            await expect(generate("system", "user")).rejects.toThrow(
                /Gemini request failed \(HTTP 401\)/
            );
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it("retries a transient 429 and succeeds", async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 429,
                    text: async () => "rate limited",
                    headers: { get: () => null },
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        candidates: [{ content: { parts: [{ text: "recovered" }] } }],
                    }),
                });
            vi.stubGlobal("fetch", fetchMock);

            const result = await generate("system", "user");
            expect(result).toBe("recovered");
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("retries a transient 5xx and succeeds", async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    text: async () => "server error",
                    headers: { get: () => null },
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        candidates: [{ content: { parts: [{ text: "back online" }] } }],
                    }),
                });
            vi.stubGlobal("fetch", fetchMock);

            const result = await generate("system", "user");
            expect(result).toBe("back online");
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("honors Retry-After when retrying a 429", async () => {
            const headersGet = vi.fn(() => "0");
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 429,
                    text: async () => "slow down",
                    headers: { get: headersGet },
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        candidates: [{ content: { parts: [{ text: "ok" }] } }],
                    }),
                });
            vi.stubGlobal("fetch", fetchMock);

            const result = await generate("system", "user");
            expect(result).toBe("ok");
            expect(headersGet).toHaveBeenCalledWith("retry-after");
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("captures a non-JSON provider error body as a diagnostic", async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: false,
                status: 400,
                text: async () => "<html>Bad Request</html>",
                headers: { get: () => null },
            });
            vi.stubGlobal("fetch", fetchMock);

            await expect(generate("system", "user")).rejects.toThrow(/Gemini/);
            const errorSpy = console.error as unknown as ReturnType<typeof vi.fn>;
            expect(errorSpy.mock.calls.flat().join(" ")).toContain("Bad Request");
        });

        it("aborts the upstream fetch when the external signal fires", async () => {
            const controller = new AbortController();
            const fetchMock = vi.fn().mockImplementation(
                (_url: unknown, init: { signal: AbortSignal }) =>
                    new Promise((_resolve, reject) => {
                        init.signal.addEventListener(
                            "abort",
                            () => {
                                const err = new Error("Aborted");
                                err.name = "AbortError";
                                reject(err);
                            },
                            { once: true }
                        );
                    })
            );
            vi.stubGlobal("fetch", fetchMock);

            const promise = generate("system", "user", { signal: controller.signal });
            controller.abort();
            await expect(promise).rejects.toThrow(/timed out/);
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

        it("retries a 5xx and surfaces the error after retries are exhausted", async () => {
            process.env.AI_PROVIDER = "openai";
            process.env.OPENAI_MODEL = "gpt-4o-mini";
            process.env.OPENAI_API_KEY = "okey";

            const fetchMock = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                text: async () => "internal error",
                headers: { get: () => null },
            });
            vi.stubGlobal("fetch", fetchMock);

            await expect(generate("system", "user")).rejects.toThrow(/OpenAI/);
            expect(fetchMock).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
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
