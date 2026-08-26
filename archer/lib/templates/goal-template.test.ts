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
        expect(output).toContain("| Rating (1–10) |");
    });

    it("contains 'Resources they have' section with pipe table", () => {
        expect(output).toMatch(/### Resources they have/);
        expect(output).toContain("| What they have access to");
        expect(output).toContain("| Rating (1–10) |");
    });

    it("contains at least 3 project sections", () => {
        const projectHeadings = output.match(/^### \[/gm);
        expect(projectHeadings).not.toBeNull();
        expect(projectHeadings!.length).toBeGreaterThanOrEqual(3);
    });

    it("each project section contains Purpose, Successful Outcome, and Next Actions", () => {
        const purposeCount = (output.match(/^#### Purpose$/gm) || []).length;
        const outcomeCount = (output.match(/^#### Successful Outcome$/gm) || []).length;
        const actionsCount = (output.match(/^#### Next Actions$/gm) || []).length;

        expect(purposeCount).toBeGreaterThanOrEqual(3);
        expect(outcomeCount).toBeGreaterThanOrEqual(3);
        expect(actionsCount).toBeGreaterThanOrEqual(3);
    });

    it("next actions start with physical verbs", () => {
        const physicalVerbs = [
            "Open",
            "Search",
            "Read",
            "Watch",
            "Write",
            "Type",
            "Click",
            "Save",
            "Navigate",
            "Create",
            "Complete",
            "Tap",
        ];
        const actionLines = output
            .split("\n")
            .filter((line) => line.match(/^- \[ \] /))
            .filter((line) => {
                const afterCheckbox = line.replace(/^- \[ \] /, "");
                return !afterCheckbox.startsWith("[Define") && !afterCheckbox.startsWith("[");
            });

        expect(actionLines.length).toBeGreaterThan(0);

        for (const line of actionLines) {
            const actionText = line.replace(/^- \[ \] /, "");
            const startsWithPhysicalVerb = physicalVerbs.some((verb) =>
                actionText.startsWith(verb),
            );
            expect(startsWithPhysicalVerb).toBe(true);
        }
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
});
