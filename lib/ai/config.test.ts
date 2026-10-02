import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    getProviderConfig,
    resolveApiKey,
    resolveModel,
    resolveProvider,
} from "./config";

/**
 * Snapshot and restore only the env vars this layer touches, so tests don't
 * leak into each other or the surrounding environment.
 */
const ENV_KEYS = [
    "AI_PROVIDER",
    "GEMINI_MODEL",
    "GROQ_MODEL",
    "OPENAI_MODEL",
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "OPENAI_API_KEY",
    "AI_LOG_LEVEL",
] as const;

describe("lib/ai/config", () => {
    let saved: Record<string, string | undefined>;

    beforeEach(() => {
        saved = {};
        for (const key of ENV_KEYS) {
            saved[key] = process.env[key];
            delete process.env[key];
        }
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "info").mockImplementation(() => {});
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
    });

    describe("resolveProvider", () => {
        it("defaults to gemini when AI_PROVIDER is unset", () => {
            expect(resolveProvider()).toBe("gemini");
        });

        it("defaults to gemini when AI_PROVIDER is empty/whitespace", () => {
            process.env.AI_PROVIDER = "   ";
            expect(resolveProvider()).toBe("gemini");
        });

        it("resolves an explicit provider (groq)", () => {
            process.env.AI_PROVIDER = "groq";
            expect(resolveProvider()).toBe("groq");
        });

        it("resolves openai", () => {
            process.env.AI_PROVIDER = "openai";
            expect(resolveProvider()).toBe("openai");
        });

        it("is case-insensitive", () => {
            process.env.AI_PROVIDER = "GEMINI";
            expect(resolveProvider()).toBe("gemini");
        });

        it("throws a clear error naming the invalid value", () => {
            process.env.AI_PROVIDER = "cohere";
            expect(() => resolveProvider()).toThrow(/cohere/);
        });
    });

    describe("resolveModel", () => {
        it("returns the model from the provider's model env var", () => {
            process.env.GEMINI_MODEL = "gemini-3.1-flash-lite";
            expect(resolveModel("gemini")).toBe("gemini-3.1-flash-lite");
        });

        it("throws naming the variable when the model is unset (no fallback)", () => {
            expect(() => resolveModel("gemini")).toThrow(/GEMINI_MODEL/);
        });

        it("throws for groq when GROQ_MODEL is unset", () => {
            expect(() => resolveModel("groq")).toThrow(/GROQ_MODEL/);
        });

        it("throws for openai when OPENAI_MODEL is unset", () => {
            expect(() => resolveModel("openai")).toThrow(/OPENAI_MODEL/);
        });

        it("treats a whitespace-only model as unset", () => {
            process.env.GROQ_MODEL = "   ";
            expect(() => resolveModel("groq")).toThrow(/GROQ_MODEL/);
        });
    });

    describe("resolveApiKey", () => {
        it("returns the key from the provider's key env var", () => {
            process.env.GEMINI_API_KEY = "secret-key";
            expect(resolveApiKey("gemini")).toBe("secret-key");
        });

        it("throws with issuance guidance when the key is unset", () => {
            expect(() => resolveApiKey("gemini")).toThrow(/GEMINI_API_KEY/);
            expect(() => resolveApiKey("gemini")).toThrow(/aistudio\.google\.com/);
        });

        it("throws with issuance guidance for groq", () => {
            expect(() => resolveApiKey("groq")).toThrow(/console\.groq\.com/);
        });

        it("throws with issuance guidance for openai", () => {
            expect(() => resolveApiKey("openai")).toThrow(
                /platform\.openai\.com/
            );
        });

        it("never logs the key value", () => {
            process.env.GEMINI_API_KEY = "super-secret-value";
            resolveApiKey("gemini");
            const infoSpy = console.info as unknown as ReturnType<typeof vi.fn>;
            const errorSpy = console.error as unknown as ReturnType<typeof vi.fn>;
            const logged = [...infoSpy.mock.calls, ...errorSpy.mock.calls]
                .flat()
                .join(" ");
            expect(logged).not.toContain("super-secret-value");
        });
    });

    describe("getProviderConfig", () => {
        it("composes id, model, key, and endpoint for gemini", () => {
            process.env.AI_PROVIDER = "gemini";
            process.env.GEMINI_MODEL = "gemini-3.1-flash-lite";
            process.env.GEMINI_API_KEY = "gkey";

            const config = getProviderConfig();

            expect(config.id).toBe("gemini");
            expect(config.model).toBe("gemini-3.1-flash-lite");
            expect(config.apiKey).toBe("gkey");
            expect(config.endpoint).toContain(
                "generativelanguage.googleapis.com"
            );
            expect(config.endpoint).toContain("gemini-3.1-flash-lite");
        });

        it("composes config for groq with the shared chat endpoint", () => {
            process.env.AI_PROVIDER = "groq";
            process.env.GROQ_MODEL = "llama-3.1-8b-instant";
            process.env.GROQ_API_KEY = "qkey";

            const config = getProviderConfig();

            expect(config.id).toBe("groq");
            expect(config.model).toBe("llama-3.1-8b-instant");
            expect(config.endpoint).toContain("api.groq.com");
        });

        it("logs only provider id and model, never the key (at info level)", () => {
            process.env.AI_PROVIDER = "gemini";
            process.env.GEMINI_MODEL = "gemini-3.1-flash-lite";
            process.env.GEMINI_API_KEY = "top-secret";
            process.env.AI_LOG_LEVEL = "info";

            getProviderConfig();

            const infoSpy = console.info as unknown as ReturnType<typeof vi.fn>;
            const logged = infoSpy.mock.calls.flat().join(" ");
            expect(logged).toContain("gemini");
            expect(logged).toContain("gemini-3.1-flash-lite");
            expect(logged).not.toContain("top-secret");
        });

        it("is silent by default (warn level)", () => {
            process.env.AI_PROVIDER = "gemini";
            process.env.GEMINI_MODEL = "gemini-3.1-flash-lite";
            process.env.GEMINI_API_KEY = "gkey";

            getProviderConfig();

            const infoSpy = console.info as unknown as ReturnType<typeof vi.fn>;
            expect(infoSpy).not.toHaveBeenCalled();
        });

        it("propagates the missing-model error", () => {
            process.env.AI_PROVIDER = "gemini";
            process.env.GEMINI_API_KEY = "gkey";
            expect(() => getProviderConfig()).toThrow(/GEMINI_MODEL/);
        });
    });
});
