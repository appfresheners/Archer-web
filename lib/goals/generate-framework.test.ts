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

import { generateFramework, parseJson, validate } from "./generate-framework";

function item(overrides: Record<string, unknown> = {}) {
    return {
        name: "Time management",
        required_level: 7,
        description: "Blocks two focused hours a day for this goal.",
        ...overrides,
    };
}

function frameworkJson(count = 5) {
    return {
        framework: Array.from({ length: count }, (_, i) =>
            item({ name: `Skill ${i + 1}` })
        ),
    };
}

describe("parseJson", () => {
    it("parses pure JSON", () => {
        expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    });

    it("extracts JSON wrapped in code fences / prose", () => {
        const raw = 'Here you go:\n```json\n{"a":1}\n```';
        expect(parseJson(raw)).toEqual({ a: 1 });
    });

    it("throws on unparseable content", () => {
        expect(() => parseJson("not json at all")).toThrow(/JSON/i);
    });
});

describe("validate", () => {
    it("accepts a well-formed framework and returns typed items", () => {
        const result = validate(frameworkJson(5));
        expect(result.framework).toHaveLength(5);
        expect(result.framework[0]).toEqual({
            name: "Skill 1",
            required_level: 7,
            description: "Blocks two focused hours a day for this goal.",
        });
    });

    it("never carries a user current-rating field through validation", () => {
        const withRating = {
            framework: [
                item({ user_rating: 4, current_level: 3, importance: 9 }),
                item(),
                item(),
            ],
        };
        const result = validate(withRating);
        for (const fi of result.framework) {
            expect(fi).not.toHaveProperty("user_rating");
            expect(fi).not.toHaveProperty("current_level");
            expect(fi).not.toHaveProperty("importance");
            expect(Object.keys(fi).sort()).toEqual([
                "description",
                "name",
                "required_level",
            ]);
        }
    });

    it("rejects a non-object", () => {
        expect(() => validate("nope")).toThrow();
    });

    it("rejects when framework is missing", () => {
        expect(() => validate({})).toThrow(/framework/);
    });

    it("rejects an empty framework", () => {
        expect(() => validate({ framework: [] })).toThrow(/at least 3/);
    });

    it("rejects fewer than 3 items", () => {
        expect(() => validate(frameworkJson(2))).toThrow(/at least 3/);
    });

    it("rejects more than 12 items", () => {
        expect(() => validate(frameworkJson(13))).toThrow(/at most 12/);
    });

    it("rejects a missing name", () => {
        const bad = {
            framework: [item({ name: "" }), item(), item()],
        };
        expect(() => validate(bad)).toThrow(/name/);
    });

    it("rejects a missing description", () => {
        const bad = {
            framework: [item({ description: "  " }), item(), item()],
        };
        expect(() => validate(bad)).toThrow(/description/);
    });

    it("rejects a non-integer required_level", () => {
        const bad = {
            framework: [item({ required_level: 5.5 }), item(), item()],
        };
        expect(() => validate(bad)).toThrow(/required_level/);
    });

    it("rejects a required_level below 1", () => {
        const bad = {
            framework: [item({ required_level: 0 }), item(), item()],
        };
        expect(() => validate(bad)).toThrow(/required_level/);
    });

    it("rejects a required_level above 10", () => {
        const bad = {
            framework: [item({ required_level: 11 }), item(), item()],
        };
        expect(() => validate(bad)).toThrow(/required_level/);
    });

    it("rejects a required_level that is a string", () => {
        const bad = {
            framework: [item({ required_level: "7" }), item(), item()],
        };
        expect(() => validate(bad)).toThrow(/required_level/);
    });

    it("rejects an item that is not an object", () => {
        const bad = { framework: ["nope", item(), item()] };
        expect(() => validate(bad)).toThrow();
    });
});

describe("generateFramework", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes the framework prompt + goal and returns the validated structure", async () => {
        generate.mockResolvedValue(JSON.stringify(frameworkJson(6)));
        const result = await generateFramework(
            "Become a confident public speaker",
            "I want to share ideas clearly with my community.",
        );
        expect(result.framework).toHaveLength(6);

        const [systemPrompt, userMessage] = generate.mock.calls[0];
        expect(systemPrompt).toContain("required_level");
        expect(systemPrompt).toContain("Reverse Goal Setting");
        expect(userMessage).toContain("Become a confident public speaker");
        expect(userMessage).toContain("Why this goal matters to me");
    });

    it("propagates a format error when the model returns non-JSON", async () => {
        generate.mockResolvedValue("Sorry, I cannot do that.");
        await expect(generateFramework("x", "reason")).rejects.toThrow(/JSON/i);
    });

    it("propagates a format error for an out-of-range level", async () => {
        generate.mockResolvedValue(
            JSON.stringify({
                framework: [item({ required_level: 99 }), item(), item()],
            })
        );
        await expect(generateFramework("x", "reason")).rejects.toThrow(/required_level/);
    });
});
