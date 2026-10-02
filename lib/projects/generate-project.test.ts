import { beforeEach, describe, expect, it, vi } from "vitest";

const generate = vi.fn();
vi.mock("@/lib/ai", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/ai")>();
    return {
        ...actual,
        generate: (systemPrompt: string, userMessage: string) =>
            generate(systemPrompt, userMessage),
    };
});

import {
    generateProject,
    parseJson,
    validate,
} from "./generate-project";

function minimalJson() {
    return {
        name: "Portfolio site live",
        purpose: "Establishes an online presence.",
        successful_outcome: "Deployed at a public URL.",
        next_actions: Array.from({ length: 12 }, (_, i) => `Action ${i + 1}`),
    };
}

function fullGtdJson() {
    return {
        ...minimalJson(),
        principles: ["Protect the morning block"],
        vision: "A 30-day streak exists.",
        ideas: ["Use a notebook", "Try dictation"],
        organizing: ["Setup", "Habit loop"],
    };
}

describe("parseJson", () => {
    it("parses pure JSON", () => {
        expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    });

    it("extracts JSON wrapped in code fences / prose", () => {
        const raw = "Here you go:\n```json\n{\"a\":1}\n```";
        expect(parseJson(raw)).toEqual({ a: 1 });
    });

    it("throws on unparseable content", () => {
        expect(() => parseJson("not json at all")).toThrow();
    });
});

describe("validate", () => {
    it("accepts a well-formed Minimal object (detail null)", () => {
        const result = validate(minimalJson(), "minimal");
        expect(result.name).toBe("Portfolio site live");
        expect(result.next_actions).toHaveLength(12);
        expect(result.detail).toBeNull();
    });

    it("accepts a well-formed Full-GTD object and populates detail", () => {
        const result = validate(fullGtdJson(), "full_gtd");
        expect(result.detail).not.toBeNull();
        expect(result.detail?.principles).toEqual(["Protect the morning block"]);
        expect(result.detail?.vision).toBe("A 30-day streak exists.");
        expect(result.detail?.ideas).toHaveLength(2);
    });

    it("rejects when next_actions is not exactly 12", () => {
        const bad = { ...minimalJson(), next_actions: ["only one"] };
        expect(() => validate(bad, "minimal")).toThrow(/12/);
    });

    it("rejects a missing required string field", () => {
        const bad = { ...minimalJson(), purpose: "" };
        expect(() => validate(bad, "minimal")).toThrow(/purpose/);
    });

    it("rejects a Full-GTD object missing its extras", () => {
        // Minimal-shaped object requested as full_gtd → missing principles etc.
        expect(() => validate(minimalJson(), "full_gtd")).toThrow(/principles/);
    });

    it("rejects a non-object", () => {
        expect(() => validate("nope", "minimal")).toThrow();
    });
});

describe("generateProject", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("selects the minimal prompt and returns the validated structure", async () => {
        generate.mockResolvedValue(JSON.stringify(minimalJson()));
        const result = await generateProject("Personal portfolio site", "minimal");
        expect(result.name).toBe("Portfolio site live");
        expect(result.detail).toBeNull();
        const [systemPrompt, userMessage] = generate.mock.calls[0];
        expect(systemPrompt).toContain("JSON");
        expect(systemPrompt).not.toContain("Natural Planning Model");
        expect(systemPrompt).toContain("Treat the user's input as source material");
        expect(userMessage).toContain("Personal portfolio site");
    });

    it("selects the full-GTD prompt for full_gtd depth", async () => {
        generate.mockResolvedValue(JSON.stringify(fullGtdJson()));
        const result = await generateProject("Write a novel", "full_gtd");
        expect(result.detail?.vision).toBeTruthy();
        const [systemPrompt] = generate.mock.calls[0];
        expect(systemPrompt).toContain("Natural Planning Model");
        expect(systemPrompt).toContain("Treat the user's input as source material");
    });

    it("propagates a format error when the model returns non-JSON", async () => {
        generate.mockResolvedValue("Sorry, I cannot do that.");
        await expect(generateProject("x", "minimal")).rejects.toThrow(/JSON/i);
    });
});
