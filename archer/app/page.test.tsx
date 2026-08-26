import * as goalTemplate from "@/lib/templates/goal-template";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

describe("Home page with ModeToggle integration", () => {
    it("renders the ModeToggle component", () => {
        render(<Home />);
        expect(screen.getByRole("tablist", { name: "Template mode" })).toBeInTheDocument();
    });

    it("defaults to goal mode", () => {
        render(<Home />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        expect(goalTab).toHaveAttribute("aria-selected", "true");
    });

    it("switches mode when clicking Project tab", () => {
        render(<Home />);
        const projectTab = screen.getByRole("tab", { name: "Project" });
        fireEvent.click(projectTab);
        expect(projectTab).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tab", { name: "Goal" })).toHaveAttribute("aria-selected", "false");
    });

    it("clears input text when switching modes", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");
        expect(input).toHaveValue("Learn guitar");

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("preserves existing hero text", () => {
        render(<Home />);
        expect(screen.getByRole("heading", { name: "Archer" })).toBeInTheDocument();
        expect(screen.getByText("Type a goal. Get the next actions.")).toBeInTheDocument();
    });

    it("places toggle below hero text", () => {
        render(<Home />);
        const heading = screen.getByRole("heading", { name: "Archer" });
        const tablist = screen.getByRole("tablist", { name: "Template mode" });
        // Toggle appears after the heading in the DOM
        expect(heading.compareDocumentPosition(tablist)).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING
        );
    });
});

describe("Home page Goal Mode template integration", () => {
    it("calls generateGoalTemplate on submit in Goal mode", async () => {
        const spy = vi.spyOn(goalTemplate, "generateGoalTemplate");
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Become a proficient guitarist in 3 months");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(spy).toHaveBeenCalledWith("Become a proficient guitarist in 3 months");
        spy.mockRestore();
    });

    it("clears output state when mode switches", async () => {
        const spy = vi.spyOn(goalTemplate, "generateGoalTemplate");
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(spy).toHaveBeenCalledTimes(1);

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        // After mode switch, submitting in project mode should not call goal template
        spy.mockClear();
        const inputAfterSwitch = screen.getByRole("textbox");
        await user.type(inputAfterSwitch, "Build a website");
        const submitAfterSwitch = screen.getByRole("button", { name: /generate/i });
        await user.click(submitAfterSwitch);

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it("does not call generateGoalTemplate in Project mode", async () => {
        const spy = vi.spyOn(goalTemplate, "generateGoalTemplate");
        const user = userEvent.setup();
        render(<Home />);

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        const input = screen.getByRole("textbox");
        await user.type(input, "Build a portfolio website");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
