import { describe, expect, it } from "vitest";
import { generateGoalTemplate } from "./goal-template";

describe("generateGoalTemplate", () => {
    const sampleInput = "Become a proficient guitarist in 3 months";
    const output = generateGoalTemplate(sampleInput);

    it("exists and is exported", () => {
        expect(generateGoalTemplate).toBeDefined();
        expect(typeof generateGoalTemplate).toBe("function");
    });

    it("returns a string", () => {
        expect(typeof output).toBe("string");
    });

    it("contains the input goal text", () => {
        expect(output).toContain(sampleInput);
    });

    it("contains '3-Month Goal' heading", () => {
        expect(output).toMatch(/^# My 3-Month Goal$/m);
    });

    it("contains 'I'll know I succeeded when' section", () => {
        expect(output).toMatch(/## I'll know I succeeded when…/);
    });

    it("contains checkbox syntax", () => {
        expect(output).toContain("- [ ]");
    });

    it("contains 'Capabilities they have' section with pipe table", () => {
        expect(output).toMatch(/### Capabilities they have/);
        expect(output).toContain("| What they can do");
        expect(output).toContain("| Target rating (1–10) |");
    });

    it("contains 'Resources they have' section with pipe table", () => {
        expect(output).toMatch(/### Resources they have/);
        expect(output).toContain("| What they have access to");
        expect(output).toContain("| Target rating (1–10) |");
    });

    it("contains 'My Current Profile' section with gap tables", () => {
        expect(output).toMatch(/## My Current Profile/);
        expect(output).toMatch(/### My Capabilities/);
        expect(output).toMatch(/### My Resources/);
        expect(output).toContain("| Gap |");
    });

    it("contains 'What helps and blocks me' section", () => {
        expect(output).toMatch(/## What helps and blocks me\?/);
        expect(output).toMatch(/### Drivers/);
        expect(output).toMatch(/### Barriers/);
        expect(output).toContain("If–then plan");
    });

    it("contains 'Focus on 2–3 biggest gaps' section with priorities", () => {
        expect(output).toMatch(/## Focus on 2–3 biggest gaps/);
        expect(output).toMatch(/### Priority 1/);
        expect(output).toMatch(/### Priority 2/);
        expect(output).toContain("**Project idea:**");
        expect(output).toContain("**First next action:**");
    });

    it("contains 'Link Real Projects' section", () => {
        expect(output).toMatch(/## Link Real Projects/);
        expect(output).toContain("🏗️ Projects");
    });

    it("contains 'Monthly Goal Check' section", () => {
        expect(output).toMatch(/## Monthly Goal Check/);
        expect(output).toContain("Is this goal still relevant?");
    });

    it("contains gap-closing blockers as checkboxes", () => {
        expect(output).toContain("**Clarity**");
        expect(output).toContain("**Consistency**");
        expect(output).toContain("**Access**");
        expect(output).toContain("**Feedback**");
    });

    it("is synchronous (no async)", () => {
        expect(generateGoalTemplate.constructor.name).not.toBe("AsyncFunction");
    });

    it("is deterministic (same input produces same output)", () => {
        const result1 = generateGoalTemplate(sampleInput);
        const result2 = generateGoalTemplate(sampleInput);
        expect(result1).toBe(result2);
    });

    it("has no trailing whitespace on any line", () => {
        const lines = output.split("\n");
        for (const line of lines) {
            expect(line).toBe(line.trimEnd());
        }
    });

    it("has blank lines between block elements", () => {
        const lines = output.split("\n");
        for (let i = 0; i < lines.length - 1; i++) {
            const current = lines[i];
            const next = lines[i + 1];
            if (current.startsWith("#") && next.startsWith("#")) {
                expect.fail(
                    `Consecutive headings without blank line at line ${i + 1}: "${current}" followed by "${next}"`,
                );
            }
        }
    });

    it("does not contain any HTML comments", () => {
        expect(output).not.toMatch(/<!--[\s\S]*?-->/);
    });

    it("ends with exactly one trailing newline", () => {
        expect(output.endsWith("\n")).toBe(true);
        expect(output.endsWith("\n\n")).toBe(false);
    });

    it("table separator rows match pipe-dash pattern", () => {
        const lines = output.split("\n");
        const separatorRows = lines.filter((line) =>
            /^\|[\s-|]+\|$/.test(line)
        );
        expect(separatorRows.length).toBeGreaterThanOrEqual(2);
        for (const row of separatorRows) {
            // Each cell between pipes should contain dashes (with optional spaces)
            const cells = row.split("|").filter((cell) => cell.trim() !== "");
            for (const cell of cells) {
                expect(cell.trim()).toMatch(/^-+$/);
            }
        }
    });
});
