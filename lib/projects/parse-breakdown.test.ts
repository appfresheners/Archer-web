import { describe, expect, it } from "vitest";
import { parseProjectBreakdown } from "./parse-breakdown";

const MINIMAL = `# Personal portfolio website live and shared

## Purpose
This project matters because it establishes an online presence.
It gives potential clients a way to evaluate the work.

## Successful Outcome
The site is deployed and reachable at a public URL, and the link has been shared with at least one person.

## Next Actions
- [ ] Open your browser
- [ ] Navigate to vercel.com
`;

const FULL_GTD = `# Consistent daily writing habit established

## Purpose
Writing daily builds a durable skill and a body of work.

### Principles
- Protect the morning writing block
- Never break the chain twice in a row

## Successful Outcome
A 30-day streak is visible in the tracker and 30 entries exist.

## Ideas / Brainstorming
- Use a physical notebook
- Try dictation on walks

## Organizing
- Setup: tools and environment
- Habit loop: cue, routine, reward

## Next Actions
- [ ] Open Obsidian
`;

describe("parseProjectBreakdown", () => {
  it("extracts name, purpose, and successful outcome from a Minimal breakdown", () => {
    const parsed = parseProjectBreakdown(MINIMAL);

    expect(parsed.name).toBe("Personal portfolio website live and shared");
    expect(parsed.purpose).toContain("establishes an online presence");
    expect(parsed.purpose).toContain("evaluate the work");
    expect(parsed.successful_outcome).toContain("public URL");
    // Body stops before the next section — no "Next Actions" leakage.
    expect(parsed.purpose).not.toContain("Successful Outcome");
    expect(parsed.successful_outcome).not.toContain("Next Actions");
  });

  it("tolerates Full-GTD extra sections and keeps nested ### inside Purpose", () => {
    const parsed = parseProjectBreakdown(FULL_GTD);

    expect(parsed.name).toBe("Consistent daily writing habit established");
    // Nested `### Principles` belongs to the Purpose section body.
    expect(parsed.purpose).toContain("durable skill");
    expect(parsed.purpose).toContain("### Principles");
    expect(parsed.purpose).toContain("Protect the morning writing block");
    // Purpose stops at the next `## ` section (Successful Outcome).
    expect(parsed.purpose).not.toContain("30-day streak");
    expect(parsed.successful_outcome).toContain("30-day streak");
    expect(parsed.successful_outcome).not.toContain("Ideas / Brainstorming");
  });

  it("falls back for a missing H1 and missing sections", () => {
    const parsed = parseProjectBreakdown(
      "Some prose with no headings at all.",
      "Learn to sail"
    );

    expect(parsed.name).toBe("Learn to sail");
    expect(parsed.purpose).toBe("");
    expect(parsed.successful_outcome).toBe("");
  });

  it("uses the default fallback name when no H1 and no fallback provided", () => {
    const parsed = parseProjectBreakdown("## Purpose\nJust a purpose.");

    expect(parsed.name).toBe("Untitled project");
    expect(parsed.purpose).toBe("Just a purpose.");
    expect(parsed.successful_outcome).toBe("");
  });

  it("strips ATX closing hashes from the H1 name", () => {
    const parsed = parseProjectBreakdown("# Portfolio site live ###\n\n## Purpose\nWhy.");
    expect(parsed.name).toBe("Portfolio site live");
  });

  it("clamps a name longer than the 200-char DB limit", () => {
    const longTitle = "A".repeat(250);
    const parsed = parseProjectBreakdown(`# ${longTitle}\n\n## Purpose\nWhy.`);
    expect(parsed.name.length).toBeLessThanOrEqual(200);
    expect(parsed.name.endsWith("…")).toBe(true);
  });
});
