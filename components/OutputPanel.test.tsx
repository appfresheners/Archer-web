import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OutputPanel from "./OutputPanel";

const sampleMarkdown = `# Goal Breakdown

## Capability Analysis

| Capability | Current Level | Target Level |
|---|---|---|
| Guitar basics | Beginner | Intermediate |

## Next Actions

- [ ] Buy a guitar
- [ ] Schedule practice time
- [x] Research online courses

Some **bold** and *italic* text.
`;

describe("OutputPanel", () => {
    it("renders without crashing when given valid markdown", () => {
        render(<OutputPanel markdown={sampleMarkdown} />);
        expect(screen.getByRole("region")).toBeInTheDocument();
    });

    it("renders headings from markdown as HTML heading elements", () => {
        render(<OutputPanel markdown={sampleMarkdown} />);
        expect(screen.getByRole("heading", { name: "Goal Breakdown", level: 1 })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Capability Analysis", level: 2 })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Next Actions", level: 2 })).toBeInTheDocument();
    });

    it("renders tables from GFM markdown", () => {
        render(<OutputPanel markdown={sampleMarkdown} />);
        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(screen.getByText("Capability")).toBeInTheDocument();
        expect(screen.getByText("Guitar basics")).toBeInTheDocument();
    });

    it("renders checkboxes from task list syntax", () => {
        render(<OutputPanel markdown={sampleMarkdown} />);
        const checkboxes = screen.getAllByRole("checkbox");
        expect(checkboxes.length).toBe(3);
    });

    it("has role='region' attribute on the container", () => {
        render(<OutputPanel markdown={sampleMarkdown} />);
        const region = screen.getByRole("region");
        expect(region).toBeInTheDocument();
    });

    it("has aria-label='Generated GTD template' on the container", () => {
        render(<OutputPanel markdown={sampleMarkdown} />);
        const region = screen.getByRole("region");
        expect(region).toHaveAttribute("aria-label", "Generated GTD template");
    });

    it("has tabIndex={-1} for programmatic focus", () => {
        render(<OutputPanel markdown={sampleMarkdown} />);
        const region = screen.getByRole("region");
        expect(region).toHaveAttribute("tabindex", "-1");
    });

    it("renders full-width without card container (styling delegated to parent)", () => {
        render(<OutputPanel markdown={sampleMarkdown} />);
        const region = screen.getByRole("region");
        expect(region.className).toContain("focus:outline-none");
    });

    it("renders markdown tables correctly with GFM support", () => {
        render(<OutputPanel markdown={sampleMarkdown} />);
        const table = screen.getByRole("table");
        const headers = table.querySelectorAll("th");
        expect(headers).toHaveLength(3);
        expect(headers[0]).toHaveTextContent("Capability");
        expect(headers[1]).toHaveTextContent("Current Level");
        expect(headers[2]).toHaveTextContent("Target Level");
    });

    it("renders checkboxes from - [ ] syntax as unchecked", () => {
        render(<OutputPanel markdown={sampleMarkdown} />);
        const checkboxes = screen.getAllByRole("checkbox");
        const unchecked = checkboxes.filter(
            (cb) => !(cb as HTMLInputElement).checked
        );
        expect(unchecked.length).toBe(2);
    });

    it("renders checkboxes from - [x] syntax as checked", () => {
        render(<OutputPanel markdown={sampleMarkdown} />);
        const checkboxes = screen.getAllByRole("checkbox");
        const checked = checkboxes.filter(
            (cb) => (cb as HTMLInputElement).checked
        );
        expect(checked.length).toBe(1);
    });
});
