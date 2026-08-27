import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

describe("Page keyboard navigation and accessibility", () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ markdown: "# Generated\n\nSome content" }),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });
    it("tab order follows expected sequence: ModeToggle → Input → Generate button", async () => {
        const user = userEvent.setup();
        render(<Home />);

        // First tab lands on active ModeToggle tab (Goal)
        await user.tab();
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        expect(goalTab).toHaveFocus();

        // Second tab moves to input field (skips inactive tab per WAI-ARIA tablist)
        await user.tab();
        const input = screen.getByRole("textbox");
        expect(input).toHaveFocus();

        // Third tab moves to Generate button
        await user.tab();
        const button = screen.getByRole("button", { name: "Generate" });
        expect(button).toHaveFocus();
    });

    it("arrow keys cycle between tabs within ModeToggle", async () => {
        const user = userEvent.setup();
        render(<Home />);

        // Tab to the active tab (Goal)
        await user.tab();
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        expect(goalTab).toHaveFocus();

        // Press ArrowRight to switch to Project
        await user.keyboard("{ArrowRight}");
        const projectTab = screen.getByRole("tab", { name: "Project" });
        expect(projectTab).toHaveAttribute("aria-selected", "true");
    });

    it("no focus trap — user can tab through entire page", async () => {
        const user = userEvent.setup();
        render(<Home />);

        // Tab through all interactive elements
        await user.tab(); // ModeToggle
        await user.tab(); // Input
        await user.tab(); // Button
        await user.tab(); // Should move past the page (body or document)

        // Confirm no element within main is still focused (no trap)
        const main = screen.getByRole("main");
        expect(main).not.toContainElement(document.activeElement as HTMLElement);
    });

    it("generate button is activatable via keyboard Enter", async () => {
        const user = userEvent.setup();
        render(<Home />);

        // Type something first so button is not aria-disabled
        const input = screen.getByRole("textbox");
        await user.click(input);
        await user.type(input, "Test goal");

        // Tab to button and press Enter
        await user.tab();
        const button = screen.getByRole("button", { name: "Generate" });
        expect(button).toHaveFocus();
        await user.keyboard("{Enter}");

        // No validation error should appear since input is filled
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("generate button is activatable via keyboard Space", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.click(input);
        await user.type(input, "Test goal");

        await user.tab();
        const button = screen.getByRole("button", { name: "Generate" });
        expect(button).toHaveFocus();
        await user.keyboard(" ");

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("all interactive elements have visible focus indicators (class check)", () => {
        render(<Home />);

        // ModeToggle tabs have focus-visible classes
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        expect(goalTab.className).toContain("focus-visible:outline-2");
        expect(goalTab.className).toContain("focus-visible:outline-offset-2");

        // Input has focus ring classes
        const input = screen.getByRole("textbox");
        expect(input.className).toContain("focus:ring-2");

        // Button has focus-visible classes
        const button = screen.getByRole("button", { name: "Generate" });
        expect(button.className).toContain("focus-visible:outline-2");
        expect(button.className).toContain("focus-visible:outline-offset-2");
    });
});
