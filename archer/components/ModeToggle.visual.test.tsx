import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModeToggle from "./ModeToggle";

describe("ModeToggle visual polish and responsive behavior", () => {
    it("toggle container is not full-width (uses inline-flex)", () => {
        render(<ModeToggle mode="goal" onModeChange={vi.fn()} />);
        const tablist = screen.getByRole("tablist");
        expect(tablist.className).toContain("inline-flex");
    });

    it("each tab has minimum 44px height for touch targets", () => {
        render(<ModeToggle mode="goal" onModeChange={vi.fn()} />);
        const tabs = screen.getAllByRole("tab");
        tabs.forEach((tab) => {
            expect(tab.className).toContain("min-h-[44px]");
        });
    });

    it("tabs have focus-visible ring styling", () => {
        render(<ModeToggle mode="goal" onModeChange={vi.fn()} />);
        const tabs = screen.getAllByRole("tab");
        tabs.forEach((tab) => {
            expect(tab.className).toContain("focus-visible:outline-2");
            expect(tab.className).toContain("focus-visible:outline-offset-2");
        });
    });

    it("tabs use motion-safe for transitions (respects prefers-reduced-motion)", () => {
        render(<ModeToggle mode="goal" onModeChange={vi.fn()} />);
        const tabs = screen.getAllByRole("tab");
        tabs.forEach((tab) => {
            expect(tab.className).toContain("motion-safe:transition-colors");
            expect(tab.className).toContain("motion-safe:duration-150");
        });
    });

    it("active tab has correct styling (primary bg, white text, bold)", () => {
        render(<ModeToggle mode="goal" onModeChange={vi.fn()} />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        expect(goalTab.className).toContain("bg-primary");
        expect(goalTab.className).toContain("text-white");
        expect(goalTab.className).toContain("font-bold");
    });

    it("inactive tab has correct styling (transparent bg, secondary text, normal weight)", () => {
        render(<ModeToggle mode="goal" onModeChange={vi.fn()} />);
        const projectTab = screen.getByRole("tab", { name: "Project" });
        expect(projectTab.className).toContain("bg-transparent");
        expect(projectTab.className).toContain("text-text-secondary");
        expect(projectTab.className).toContain("font-normal");
    });
});
