import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("prefers-reduced-motion support", () => {
    it("ModeToggle transitions use motion-safe prefix", () => {
        render(<Home />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        const projectTab = screen.getByRole("tab", { name: "Project" });

        expect(goalTab.className).toContain("motion-safe:transition-colors");
        expect(goalTab.className).toContain("motion-safe:duration-150");
        expect(projectTab.className).toContain("motion-safe:transition-colors");
        expect(projectTab.className).toContain("motion-safe:duration-150");
    });

    it("Generate button uses motion-safe transitions when active", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Test goal");

        const button = screen.getByRole("button", { name: "Generate" });
        expect(button.className).toContain("motion-safe:transition-colors");
        expect(button.className).toContain("motion-safe:duration-150");
    });

    it("disabled Generate button has no transitions (correct — no animation needed)", () => {
        render(<Home />);
        const button = screen.getByRole("button", { name: "Generate" });

        // When disabled, button has no transitions — nothing to animate
        expect(button.className).not.toContain("transition-colors");
        expect(button).toHaveAttribute("aria-disabled", "true");
    });

    it("no non-prefixed transition or animation classes exist on interactive elements", () => {
        render(<Home />);
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        const projectTab = screen.getByRole("tab", { name: "Project" });
        const button = screen.getByRole("button", { name: "Generate" });
        const input = screen.getByRole("textbox");

        const elements = [goalTab, projectTab, button, input];

        for (const el of elements) {
            const classes = el.className.split(" ");
            const transitionClasses = classes.filter(
                (c) =>
                    (c.startsWith("transition") || c.startsWith("animate") || c.startsWith("duration")) &&
                    !c.startsWith("motion-safe:") &&
                    !c.startsWith("motion-reduce:")
            );
            expect(transitionClasses).toEqual([]);
        }
    });
});
