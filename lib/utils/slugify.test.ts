import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify utility", () => {
    it("converts basic text to a slug", () => {
        expect(slugify("Learn Guitar")).toBe("learn-guitar");
    });

    it("strips special characters", () => {
        expect(slugify("My goal: 100% success!!!")).toBe("my-goal-100-success");
    });

    it("collapses consecutive hyphens", () => {
        expect(slugify("hello---world")).toBe("hello-world");
    });

    it("collapses multiple spaces into single hyphens", () => {
        expect(slugify("hello   world")).toBe("hello-world");
    });

    it("trims leading and trailing hyphens", () => {
        expect(slugify("---hello world---")).toBe("hello-world");
    });

    it("returns 'untitled' for empty string", () => {
        expect(slugify("")).toBe("untitled");
    });

    it("returns 'untitled' for whitespace-only input", () => {
        expect(slugify("   ")).toBe("untitled");
    });

    it("returns 'untitled' when all characters are stripped", () => {
        expect(slugify("!!!@@@###")).toBe("untitled");
    });

    it("truncates at word boundary to maxLength (default 50)", () => {
        const longInput = "become a proficient guitarist and master music theory in three months";
        const result = slugify(longInput);
        expect(result.length).toBeLessThanOrEqual(50);
        expect(result).not.toMatch(/-$/); // no trailing hyphen
        // Should truncate at a word boundary
        expect(result).toBe("become-a-proficient-guitarist-and-master-music");
    });

    it("truncates at custom maxLength", () => {
        const result = slugify("learn to play guitar well", 15);
        expect(result.length).toBeLessThanOrEqual(15);
        expect(result).not.toMatch(/-$/);
        expect(result).toBe("learn-to-play");
    });

    it("handles input exactly at maxLength boundary", () => {
        const input = "abcde";
        expect(slugify(input, 5)).toBe("abcde");
    });

    it("no trailing hyphens after truncation", () => {
        const result = slugify("a-b-c-d-e-f-g-h", 5);
        expect(result).not.toMatch(/-$/);
    });

    it("preserves numbers in the slug", () => {
        expect(slugify("3 months to learn 5 songs")).toBe("3-months-to-learn-5-songs");
    });

    it("handles mixed special characters and spaces", () => {
        expect(slugify("Hello, World! @2024")).toBe("hello-world-2024");
    });

    it("generates correct slug for spec example input", () => {
        expect(slugify("Become a proficient guitarist in 3 months")).toBe(
            "become-a-proficient-guitarist-in-3-months"
        );
    });
});
