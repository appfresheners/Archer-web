import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModeToggle from "./ModeToggle";

describe("ModeToggle", () => {
    const defaultProps = {
        mode: "goal" as const,
        onModeChange: vi.fn(),
    };

    it("renders a tablist container with aria-label", () => {
        render(<ModeToggle {...defaultProps} />);
        const tablist = screen.getByRole("tablist", { name: "Template mode" });
        expect(tablist).toBeInTheDocument();
    });

    it("renders Goal and Project tabs", () => {
        render(<ModeToggle {...defaultProps} />);
        expect(screen.getByRole("tab", { name: "Goal" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Project" })).toBeInTheDocument();
    });

    it("marks Goal as selected when mode is goal", () => {
        render(<ModeToggle {...defaultProps} mode="goal" />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        const projectTab = screen.getByRole("tab", { name: "Project" });
        expect(goalTab).toHaveAttribute("aria-selected", "true");
        expect(projectTab).toHaveAttribute("aria-selected", "false");
    });

    it("marks Project as selected when mode is project", () => {
        render(<ModeToggle {...defaultProps} mode="project" />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        const projectTab = screen.getByRole("tab", { name: "Project" });
        expect(goalTab).toHaveAttribute("aria-selected", "false");
        expect(projectTab).toHaveAttribute("aria-selected", "true");
    });

    it("sets tabIndex 0 on active tab and -1 on inactive (roving tabindex)", () => {
        render(<ModeToggle {...defaultProps} mode="goal" />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        const projectTab = screen.getByRole("tab", { name: "Project" });
        expect(goalTab).toHaveAttribute("tabindex", "0");
        expect(projectTab).toHaveAttribute("tabindex", "-1");
    });

    it("applies pill-shaped container styling", () => {
        render(<ModeToggle {...defaultProps} />);
        const tablist = screen.getByRole("tablist", { name: "Template mode" });
        expect(tablist.className).toContain("rounded-full");
    });
});
