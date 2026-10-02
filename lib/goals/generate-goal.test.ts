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
    buildUserMessage,
    generateGoal,
    parseJson,
    validate,
    type GenerateGoalPayload,
} from "./generate-goal";

// --- Fixtures --------------------------------------------------------------

function project(overrides: Record<string, unknown> = {}) {
    return {
        name: "Portfolio site live",
        purpose: "Why this matters over four sentences of context.",
        successful_outcome: "Done looks like a shipped, shared site.",
        next_actions: Array.from({ length: 12 }, (_, i) => `Action ${i + 1}`),
        ...overrides,
    };
}

function goalJson(projectCount = 5) {
    return {
        goal_statement: "In 3 months I will have shipped a portfolio.",
        success_criteria: ["Site is live", "3 case studies", "Shared publicly"],
        projects: Array.from({ length: projectCount }, (_, i) =>
            project({ name: `Project ${i + 1}` })
        ),
    };
}

function payload(): GenerateGoalPayload {
    return {
        goal: "Become a confident public speaker",
        why: "I want to share ideas clearly with my community.",
        framework: [
            { name: "Stage confidence", required_level: 9, description: "Calm.", user_rating: 3 },
            { name: "Vocal projection", required_level: 8, description: "Fills a room.", user_rating: 5 },
            { name: "Time management", required_level: 7, description: "Practice.", user_rating: 6 },
        ],
        drivers: ["I love a challenge"],
        barriers: ["I get nervous"],
        ifThen: "If it is 7am, then I will rehearse for 10 minutes",
    };
}

// --- parseJson -------------------------------------------------------------

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

// --- validate --------------------------------------------------------------

describe("validate", () => {
    it("accepts a well-formed breakdown and returns typed shape", () => {
        const result = validate(goalJson(5));
        expect(result.goal_statement).toContain("3 months");
        expect(result.success_criteria).toHaveLength(3);
        expect(result.projects).toHaveLength(5);
        expect(result.projects[0].next_actions).toHaveLength(12);
    });

    it("accepts 6 projects (upper bound)", () => {
        const result = validate(goalJson(6));
        expect(result.projects).toHaveLength(6);
    });

    it("rejects a non-object", () => {
        expect(() => validate("nope")).toThrow();
    });

    it("rejects a missing goal_statement", () => {
        const bad = { ...goalJson(5), goal_statement: "" };
        expect(() => validate(bad)).toThrow(/goal_statement/);
    });

    it("rejects fewer than 3 success criteria", () => {
        const bad = { ...goalJson(5), success_criteria: ["only", "two"] };
        expect(() => validate(bad)).toThrow(/at least 3 success/i);
    });

    it("rejects a missing success_criteria list", () => {
        const bad = { goal_statement: "g", projects: goalJson(5).projects };
        expect(() => validate(bad)).toThrow(/success_criteria/);
    });

    it("rejects a missing projects list", () => {
        const bad = {
            goal_statement: "g",
            success_criteria: ["a", "b", "c"],
        };
        expect(() => validate(bad)).toThrow(/projects/);
    });

    it("rejects fewer than 5 projects", () => {
        expect(() => validate(goalJson(4))).toThrow(/5.*6 projects/);
    });

    it("rejects more than 6 projects", () => {
        expect(() => validate(goalJson(7))).toThrow(/5.*6 projects/);
    });

    it("rejects a project with != 12 next_actions", () => {
        const bad = goalJson(5);
        bad.projects[0].next_actions = Array.from({ length: 11 }, (_, i) => `A${i}`);
        expect(() => validate(bad)).toThrow(/exactly 12 next actions/i);
    });

    it("rejects a project missing its purpose", () => {
        const bad = goalJson(5);
        bad.projects[1] = project({ purpose: "   " }) as never;
        expect(() => validate(bad)).toThrow(/purpose/);
    });

    it("rejects a project that is not an object", () => {
        const bad = goalJson(5);
        (bad.projects as unknown[])[2] = "nope";
        expect(() => validate(bad)).toThrow(/not an object/i);
    });
});

// --- buildUserMessage ------------------------------------------------------

describe("buildUserMessage", () => {
    it("includes the goal, why, gaps, drivers, barriers, and if–then", () => {
        const msg = buildUserMessage(payload());
        expect(msg).toContain("Become a confident public speaker");
        expect(msg).toContain("Why this goal matters to me: I want to share ideas clearly with my community.");
        // Stage confidence: required 9, current 3, gap 6.
        expect(msg).toContain("Stage confidence: required 9, current 3, gap 6");
        expect(msg).toContain("I love a challenge");
        expect(msg).toContain("I get nervous");
        expect(msg).toContain("If it is 7am, then I will rehearse for 10 minutes");
    });
});

// --- generateGoal ----------------------------------------------------------

describe("generateGoal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes the generate prompt + tailored message and returns the validated structure", async () => {
        generate.mockResolvedValue(JSON.stringify(goalJson(5)));
        const result = await generateGoal(payload());
        expect(result.projects).toHaveLength(5);

        const [systemPrompt, userMessage] = generate.mock.calls[0];
        expect(systemPrompt).toContain("goal_statement");
        expect(userMessage).toContain("Become a confident public speaker");
    });

    it("propagates a format error when the model returns non-JSON", async () => {
        generate.mockResolvedValue("Sorry, I cannot do that.");
        await expect(generateGoal(payload())).rejects.toThrow(/JSON/i);
    });

    it("propagates a format error for a wrong project count", async () => {
        generate.mockResolvedValue(JSON.stringify(goalJson(4)));
        await expect(generateGoal(payload())).rejects.toThrow(/5.*6 projects/);
    });
});
