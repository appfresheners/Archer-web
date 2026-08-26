import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModeToggle from "./ModeToggle";

describe("ModeToggle screen reader announcements", () => {
    it("has an aria-live polite region for announcements", () => {
        render(<ModeToggle mode="goal" onModeChange={vi.fn()} />);
        const liveRegion = screen.getByRole("status");
        expect(liveRegion).toHaveAttribute("aria-live", "polite");
    });

    it("does not announce on initial render (no spurious announcement)", () => {
        render(<ModeToggle mode="goal" onModeChange={vi.fn()} />);
        const liveRegion = screen.getByRole("status");
        expect(liveRegion).toHaveTextContent("");
    });

    it("announces goal mode after user interaction", () => {
        const onModeChange = vi.fn();
        const { rerender } = render(<ModeToggle mode="project" onModeChange={onModeChange} />);
        const projectTab = screen.getByRole("tab", { name: "Project" });
        fireEvent.click(projectTab);
        // Simulate parent updating mode back to goal after interaction
        rerender(<ModeToggle mode="goal" onModeChange={onModeChange} />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        fireEvent.click(goalTab);
        rerender(<ModeToggle mode="goal" onModeChange={onModeChange} />);
        const liveRegion = screen.getByRole("status");
        expect(liveRegion).toHaveTextContent("Goal mode selected");
    });

    it("announces project mode after user interaction", () => {
        const onModeChange = vi.fn();
        const { rerender } = render(<ModeToggle mode="goal" onModeChange={onModeChange} />);
        const projectTab = screen.getByRole("tab", { name: "Project" });
        fireEvent.click(projectTab);
        rerender(<ModeToggle mode="project" onModeChange={onModeChange} />);
        const liveRegion = screen.getByRole("status");
        expect(liveRegion).toHaveTextContent("Project mode selected");
    });

    it("the live region is visually hidden (sr-only class)", () => {
        render(<ModeToggle mode="goal" onModeChange={vi.fn()} />);
        const liveRegion = screen.getByRole("status");
        expect(liveRegion.className).toContain("sr-only");
    });

    it("tablist has descriptive aria-label", () => {
        render(<ModeToggle mode="goal" onModeChange={vi.fn()} />);
        const tablist = screen.getByRole("tablist");
        expect(tablist).toHaveAttribute("aria-label", "Template mode");
    });
});
