import * as goalTemplate from "@/lib/templates/goal-template";
import * as projectTemplate from "@/lib/templates/project-template";
import * as clipboardUtil from "@/lib/utils/clipboard";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("@/lib/utils/clipboard", () => ({
    copyToClipboard: vi.fn(),
}));

const mockCopyToClipboard = clipboardUtil.copyToClipboard as ReturnType<typeof vi.fn>;

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

describe("Home page Project Mode template integration", () => {
    it("calls generateProjectTemplate on submit in Project mode", async () => {
        const spy = vi.spyOn(projectTemplate, "generateProjectTemplate");
        const user = userEvent.setup();
        render(<Home />);

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        const input = screen.getByRole("textbox");
        await user.type(input, "Personal portfolio website deployed online");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(spy).toHaveBeenCalledWith("Personal portfolio website deployed online");
        spy.mockRestore();
    });

    it("does not call generateProjectTemplate in Goal mode", async () => {
        const spy = vi.spyOn(projectTemplate, "generateProjectTemplate");
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Become a proficient guitarist");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it("mode switch clears output after project generation", async () => {
        const spy = vi.spyOn(projectTemplate, "generateProjectTemplate");
        const user = userEvent.setup();
        render(<Home />);

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        const input = screen.getByRole("textbox");
        await user.type(input, "Deploy portfolio online");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(spy).toHaveBeenCalledTimes(1);

        // Switch back to goal mode — should clear everything
        const goalTab = screen.getByRole("tab", { name: "Goal" });
        await user.click(goalTab);

        // After mode switch, submitting in goal mode should not call project template
        spy.mockClear();
        const inputAfterSwitch = screen.getByRole("textbox");
        await user.type(inputAfterSwitch, "Learn guitar");
        const submitAfterSwitch = screen.getByRole("button", { name: /generate/i });
        await user.click(submitAfterSwitch);

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe("OutputPanel integration with Home page", () => {
    it("does NOT render OutputPanel when output state is empty (initial load)", () => {
        render(<Home />);
        expect(screen.queryByRole("region", { name: "Generated GTD template" })).not.toBeInTheDocument();
    });

    it("renders OutputPanel after submitting valid input in Goal mode", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar in 3 months");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(screen.getByRole("region", { name: "Generated GTD template" })).toBeInTheDocument();
    });

    it("renders OutputPanel after submitting valid input in Project mode", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        const input = screen.getByRole("textbox");
        await user.type(input, "Build a portfolio website");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(screen.getByRole("region", { name: "Generated GTD template" })).toBeInTheDocument();
    });

    it("OutputPanel disappears when mode is switched (output cleared)", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(screen.getByRole("region", { name: "Generated GTD template" })).toBeInTheDocument();

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        expect(screen.queryByRole("region", { name: "Generated GTD template" })).not.toBeInTheDocument();
    });

    it("OutputPanel has correct role and aria-label after generation", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        const panel = screen.getByRole("region", { name: "Generated GTD template" });
        expect(panel).toHaveAttribute("aria-label", "Generated GTD template");
    });

    it("focus moves to OutputPanel after generation", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        const panel = screen.getByRole("region", { name: "Generated GTD template" });
        expect(document.activeElement).toBe(panel);
    });
});

describe("OutputPanel renders actual template content", () => {
    it("renders Goal Mode heading and user input after generation", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(screen.getByRole("heading", { name: /3-Month Goal/i })).toBeInTheDocument();
        expect(screen.getByText(/Learn guitar/)).toBeInTheDocument();
    });

    it("renders Project Mode heading with user input after generation", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        const input = screen.getByRole("textbox");
        await user.type(input, "Build portfolio");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(screen.getByText(/Build portfolio/)).toBeInTheDocument();
    });
});

describe("Reduced motion scroll behavior", () => {
    afterEach(() => {
        // Restore default matchMedia mock
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: (query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: () => { },
                removeListener: () => { },
                addEventListener: () => { },
                removeEventListener: () => { },
                dispatchEvent: () => false,
            }),
        });
    });

    it("uses behavior 'auto' when prefers-reduced-motion is enabled", async () => {
        const scrollSpy = vi.fn();
        Element.prototype.scrollIntoView = scrollSpy;

        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: (query: string) => ({
                matches: query === "(prefers-reduced-motion: reduce)",
                media: query,
                onchange: null,
                addListener: () => { },
                removeListener: () => { },
                addEventListener: () => { },
                removeEventListener: () => { },
                dispatchEvent: () => false,
            }),
        });

        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(scrollSpy).toHaveBeenCalledWith(
            expect.objectContaining({ behavior: "auto" })
        );

        Element.prototype.scrollIntoView = () => { };
    });

    it("uses behavior 'smooth' when prefers-reduced-motion is not enabled", async () => {
        const scrollSpy = vi.fn();
        Element.prototype.scrollIntoView = scrollSpy;

        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(scrollSpy).toHaveBeenCalledWith(
            expect.objectContaining({ behavior: "smooth" })
        );

        Element.prototype.scrollIntoView = () => { };
    });
});

describe("ActionBar integration with Home page", () => {
    beforeEach(() => {
        mockCopyToClipboard.mockResolvedValue({ success: true });
    });

    afterEach(() => {
        mockCopyToClipboard.mockReset();
    });

    it("does NOT render ActionBar when output is empty (initial load)", () => {
        render(<Home />);
        expect(screen.queryByRole("button", { name: /copy markdown/i })).not.toBeInTheDocument();
    });

    it("renders ActionBar after generating output in Goal mode", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(screen.getByRole("button", { name: /copy markdown/i })).toBeInTheDocument();
    });

    it("renders ActionBar after generating output in Project mode", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        const input = screen.getByRole("textbox");
        await user.type(input, "Build portfolio");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(screen.getByRole("button", { name: /copy markdown/i })).toBeInTheDocument();
    });

    it("copy button triggers clipboard write with raw markdown (not HTML)", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        const copyButton = screen.getByRole("button", { name: /copy markdown/i });
        await user.click(copyButton);

        expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
        const calledWith = mockCopyToClipboard.mock.calls[0][0];
        // Raw markdown contains # headings, not HTML tags
        expect(calledWith).toContain("#");
        expect(calledWith).not.toContain("<h1>");
    });

    it("ActionBar disappears when mode is switched (output cleared)", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const input = screen.getByRole("textbox");
        await user.type(input, "Learn guitar");

        const submitButton = screen.getByRole("button", { name: /generate/i });
        await user.click(submitButton);

        expect(screen.getByRole("button", { name: /copy markdown/i })).toBeInTheDocument();

        const projectTab = screen.getByRole("tab", { name: "Project" });
        await user.click(projectTab);

        expect(screen.queryByRole("button", { name: /copy markdown/i })).not.toBeInTheDocument();
    });
});
