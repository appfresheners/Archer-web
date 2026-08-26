import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModeToggle from "./ModeToggle";

describe("ModeToggle keyboard navigation", () => {
    it("calls onModeChange with opposite mode on ArrowRight when goal is active", () => {
        const onModeChange = vi.fn();
        render(<ModeToggle mode="goal" onModeChange={onModeChange} />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        fireEvent.keyDown(goalTab, { key: "ArrowRight" });
        expect(onModeChange).toHaveBeenCalledWith("project");
    });

    it("calls onModeChange with opposite mode on ArrowLeft when project is active", () => {
        const onModeChange = vi.fn();
        render(<ModeToggle mode="project" onModeChange={onModeChange} />);
        const projectTab = screen.getByRole("tab", { name: "Project" });
        fireEvent.keyDown(projectTab, { key: "ArrowLeft" });
        expect(onModeChange).toHaveBeenCalledWith("goal");
    });

    it("calls onModeChange on Enter key", () => {
        const onModeChange = vi.fn();
        render(<ModeToggle mode="goal" onModeChange={onModeChange} />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        fireEvent.keyDown(goalTab, { key: "Enter" });
        expect(onModeChange).toHaveBeenCalledWith("goal");
    });

    it("calls onModeChange on Space key", () => {
        const onModeChange = vi.fn();
        render(<ModeToggle mode="goal" onModeChange={onModeChange} />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        fireEvent.keyDown(goalTab, { key: " " });
        expect(onModeChange).toHaveBeenCalledWith("goal");
    });

    it("prevents default scroll on arrow keys", () => {
        const onModeChange = vi.fn();
        render(<ModeToggle mode="goal" onModeChange={onModeChange} />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        const event = new KeyboardEvent("keydown", {
            key: "ArrowRight",
            bubbles: true,
            cancelable: true,
        });
        const preventDefaultSpy = vi.spyOn(event, "preventDefault");
        goalTab.dispatchEvent(event);
        expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("ArrowLeft on goal tab cycles to project", () => {
        const onModeChange = vi.fn();
        render(<ModeToggle mode="goal" onModeChange={onModeChange} />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        fireEvent.keyDown(goalTab, { key: "ArrowLeft" });
        expect(onModeChange).toHaveBeenCalledWith("project");
    });

    it("ArrowRight on project tab cycles to goal", () => {
        const onModeChange = vi.fn();
        render(<ModeToggle mode="project" onModeChange={onModeChange} />);
        const projectTab = screen.getByRole("tab", { name: "Project" });
        fireEvent.keyDown(projectTab, { key: "ArrowRight" });
        expect(onModeChange).toHaveBeenCalledWith("goal");
    });
});
