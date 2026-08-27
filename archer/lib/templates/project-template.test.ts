import { describe, expect, it } from "vitest";
import { generateProjectTemplate } from "./project-template";

describe("generateProjectTemplate", () => {
    const sampleInput = "Personal portfolio website deployed online";
    const output = generateProjectTemplate(sampleInput);

    it("exists and is exported", () => {
        expect(generateProjectTemplate).toBeDefined();
        expect(typeof generateProjectTemplate).toBe("function");
    });

    it("returns a string", () => {
        expect(typeof output).toBe("string");
    });

    it("contains the input project text as heading", () => {
        expect(output).toMatch(new RegExp(`^# ${sampleInput}$`, "m"));
    });

    it("contains 'Purpose' section", () => {
        expect(output).toMatch(/^## Purpose$/m);
    });

    it("contains 'Successful Outcome' section", () => {
        expect(output).toMatch(/^## Successful Outcome$/m);
    });

    it("contains 'Next Actions' section", () => {
        expect(output).toMatch(/^## Next Actions$/m);
    });

    it("contains checkbox syntax", () => {
        expect(output).toContain("- [ ]");
    });

    it("next actions start with physical verbs", () => {
        const physicalVerbs = [
            "Open",
            "Navigate",
            "Click",
            "Type",
            "Create",
            "Save",
            "Search",
            "Read",
            "Write",
            "Complete",
        ];
        const actionLines = output
            .split("\n")
            .filter((line) => line.match(/^- \[ \] /));

        expect(actionLines.length).toBeGreaterThanOrEqual(8);

        for (const line of actionLines) {
            const actionText = line.replace(/^- \[ \] /, "");
            const startsWithPhysicalVerb = physicalVerbs.some((verb) =>
                actionText.startsWith(verb),
            );
            expect(startsWithPhysicalVerb).toBe(true);
        }
    });

    it("is synchronous (no async)", () => {
        expect(generateProjectTemplate.constructor.name).not.toBe(
            "AsyncFunction",
        );
    });

    it("is deterministic (same input produces same output)", () => {
        const result1 = generateProjectTemplate(sampleInput);
        const result2 = generateProjectTemplate(sampleInput);
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
