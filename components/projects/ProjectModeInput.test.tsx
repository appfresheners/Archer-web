import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectModeInput from "./ProjectModeInput";

describe("ProjectModeInput", () => {
  const canonicalPlaceholder = "e.g., Personal portfolio website deployed online";

  describe("Default load", () => {
    it("renders the canonical placeholder", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} />);
      expect(
        screen.getByPlaceholderText(canonicalPlaceholder),
      ).toBeInTheDocument();
    });

    it("preselects Minimal depth", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} />);
      expect(screen.getByRole("radio", { name: "Minimal" })).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });

    it("keeps the submit button enabled on empty input (no misleading aria-disabled)", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} />);
      const button = screen.getByRole("button", { name: /break it down/i });
      expect(button).toBeEnabled();
      expect(button).not.toHaveAttribute("aria-disabled");
    });

    it("shows no character counter", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} />);
      expect(screen.queryByText(/\/ 500/)).not.toBeInTheDocument();
    });

    it("input caps at 500 characters via maxLength", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} />);
      expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "500");
    });
  });

  describe("Character counter", () => {
    it("does not show the counter at exactly 400 characters", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} />);
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "a".repeat(400) },
      });
      expect(screen.queryByText(/\/ 500/)).not.toBeInTheDocument();
    });

    it("shows the counter at 401 characters (first over the threshold)", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} />);
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "a".repeat(401) },
      });
      expect(screen.getByText("401 / 500")).toBeInTheDocument();
    });

    it("shows the counter once past 400 characters", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} />);
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "a".repeat(431) },
      });
      expect(screen.getByText("431 / 500")).toBeInTheDocument();
    });
  });

  describe("Validation", () => {
    it("blocks submission on empty input with a role=alert error", () => {
      const onSubmit = vi.fn();
      render(<ProjectModeInput onSubmit={onSubmit} />);
      fireEvent.click(screen.getByRole("button", { name: /break it down/i }));
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("blocks submission on whitespace-only input", () => {
      const onSubmit = vi.fn();
      render(<ProjectModeInput onSubmit={onSubmit} />);
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "   " },
      });
      fireEvent.click(screen.getByRole("button", { name: /break it down/i }));
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("clears the error when the user types", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /break it down/i }));
      expect(screen.getByRole("alert")).toBeInTheDocument();
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "Build a website" },
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Valid submit", () => {
    it("emits trimmed input and default minimal depth via button", () => {
      const onSubmit = vi.fn();
      render(<ProjectModeInput onSubmit={onSubmit} />);
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "  Build a portfolio  " },
      });
      fireEvent.click(screen.getByRole("button", { name: /break it down/i }));
      expect(onSubmit).toHaveBeenCalledWith({
        input: "Build a portfolio",
        depth: "minimal",
      });
    });

    it("emits full_gtd depth after selecting it, via Enter", () => {
      const onSubmit = vi.fn();
      render(<ProjectModeInput onSubmit={onSubmit} />);
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "Launch a newsletter" },
      });
      fireEvent.click(screen.getByRole("radio", { name: "Full GTD" }));
      fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
      expect(onSubmit).toHaveBeenCalledWith({
        input: "Launch a newsletter",
        depth: "full_gtd",
      });
    });

    it("Enter and button are equivalent submit paths", () => {
      const onSubmit = vi.fn();
      render(<ProjectModeInput onSubmit={onSubmit} />);
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "Do a thing" },
      });
      fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
      fireEvent.click(screen.getByRole("button", { name: /break it down/i }));
      expect(onSubmit).toHaveBeenCalledTimes(2);
      expect(onSubmit).toHaveBeenNthCalledWith(1, {
        input: "Do a thing",
        depth: "minimal",
      });
      expect(onSubmit).toHaveBeenNthCalledWith(2, {
        input: "Do a thing",
        depth: "minimal",
      });
    });
  });

  describe("Disabled (in-flight)", () => {
    it("disables input and blocks submit when disabled", () => {
      const onSubmit = vi.fn();
      render(<ProjectModeInput onSubmit={onSubmit} disabled />);
      const input = screen.getByRole("textbox");
      expect(input).toBeDisabled();
      const button = screen.getByRole("button", { name: /break it down/i });
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("blocks the Enter submit path when disabled, even with valid input", () => {
      const onSubmit = vi.fn();
      const { rerender } = render(
        <ProjectModeInput onSubmit={onSubmit} />,
      );
      // Type valid input while enabled, then flip to disabled (mirrors the
      // in-flight state Story 2.3 will drive) and press Enter.
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "Build a website" },
      });
      rerender(<ProjectModeInput onSubmit={onSubmit} disabled />);
      fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("Loading (generation in flight)", () => {
    it("shows a spinner + 'Generating…' and disables the button while loading", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} loading />);
      const button = screen.getByRole("button", { name: /generating/i });
      expect(button).toHaveTextContent("Generating…");
      expect(button).toBeDisabled();
    });

    it("disables the input and depth control while loading", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} loading />);
      expect(screen.getByRole("textbox")).toBeDisabled();
      for (const radio of screen.getAllByRole("radio")) {
        expect(radio).toBeDisabled();
      }
    });

    it("does not clear the input when loading toggles on", () => {
      const { rerender } = render(<ProjectModeInput onSubmit={vi.fn()} />);
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "Build a website" },
      });
      rerender(<ProjectModeInput onSubmit={vi.fn()} loading />);
      expect(screen.getByRole("textbox")).toHaveValue("Build a website");
    });

    it("does not show 'Generating…' when not loading", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} />);
      expect(
        screen.getByRole("button", { name: /break it down/i }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Generating…")).not.toBeInTheDocument();
    });
  });

  describe("Mode selection (Story 2.7)", () => {
    it("defaults to Generate with AI and shows the AI surface", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} onManualSubmit={vi.fn()} />);
      expect(
        screen.getByRole("radio", { name: "Generate with AI" }),
      ).toBeChecked();
      expect(
        screen.getByRole("radio", { name: "Create manually" }),
      ).not.toBeChecked();
      // AI surface is present, manual surface is not.
      expect(
        screen.getByPlaceholderText(canonicalPlaceholder),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /create project/i }),
      ).not.toBeInTheDocument();
    });

    it("switches to the manual form when Create manually is selected", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} onManualSubmit={vi.fn()} />);
      fireEvent.click(screen.getByRole("radio", { name: "Create manually" }));
      expect(
        screen.getByRole("radio", { name: "Create manually" }),
      ).toBeChecked();
      expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /create project/i }),
      ).toBeInTheDocument();
      // AI surface is gone.
      expect(
        screen.queryByPlaceholderText(canonicalPlaceholder),
      ).not.toBeInTheDocument();
    });

    it("seeds the manual name from initialInput (clarify hand-off)", () => {
      render(
        <ProjectModeInput
          onSubmit={vi.fn()}
          onManualSubmit={vi.fn()}
          initialInput="Plan the offsite"
        />,
      );
      fireEvent.click(screen.getByRole("radio", { name: "Create manually" }));
      expect(screen.getByLabelText(/project name/i)).toHaveValue(
        "Plan the offsite",
      );
    });
  });

  describe("Manual submit", () => {
    it("blocks submission on an empty name with a role=alert error", () => {
      const onManualSubmit = vi.fn();
      render(
        <ProjectModeInput onSubmit={vi.fn()} onManualSubmit={onManualSubmit} />,
      );
      fireEvent.click(screen.getByRole("radio", { name: "Create manually" }));
      const button = screen.getByRole("button", { name: /create project/i });
      expect(button).not.toHaveAttribute("aria-disabled");
      fireEvent.click(button);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(onManualSubmit).not.toHaveBeenCalled();
    });

    it("emits trimmed fields with a null goalId when none is selected", () => {
      const onManualSubmit = vi.fn();
      render(
        <ProjectModeInput onSubmit={vi.fn()} onManualSubmit={onManualSubmit} />,
      );
      fireEvent.click(screen.getByRole("radio", { name: "Create manually" }));
      fireEvent.change(screen.getByLabelText(/project name/i), {
        target: { value: "  Launch a newsletter  " },
      });
      fireEvent.change(screen.getByLabelText(/purpose/i), {
        target: { value: "  Grow an audience  " },
      });
      fireEvent.change(screen.getByLabelText(/successful outcome/i), {
        target: { value: "  500 subscribers  " },
      });
      fireEvent.click(screen.getByRole("button", { name: /create project/i }));
      expect(onManualSubmit).toHaveBeenCalledWith({
        name: "Launch a newsletter",
        purpose: "Grow an audience",
        successfulOutcome: "500 subscribers",
        goalId: null,
      });
    });

    it("emits the selected parent goal id", () => {
      const onManualSubmit = vi.fn();
      const goals = [
        { id: "g1", goal_text: "First goal" },
        { id: "g2", goal_text: "Second goal" },
      ];
      render(
        <ProjectModeInput
          onSubmit={vi.fn()}
          onManualSubmit={onManualSubmit}
          goals={goals}
        />,
      );
      fireEvent.click(screen.getByRole("radio", { name: "Create manually" }));
      fireEvent.change(screen.getByLabelText(/project name/i), {
        target: { value: "A project" },
      });
      fireEvent.change(screen.getByLabelText(/parent goal/i), {
        target: { value: "g2" },
      });
      fireEvent.click(screen.getByRole("button", { name: /create project/i }));
      expect(onManualSubmit).toHaveBeenCalledWith({
        name: "A project",
        purpose: "",
        successfulOutcome: "",
        goalId: "g2",
      });
    });

    it("shows 'Saving…' and disables while manualSaving", () => {
      const { rerender } = render(
        <ProjectModeInput onSubmit={vi.fn()} onManualSubmit={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole("radio", { name: "Create manually" }));
      rerender(
        <ProjectModeInput
          onSubmit={vi.fn()}
          onManualSubmit={vi.fn()}
          manualSaving
        />,
      );
      const button = screen.getByRole("button", { name: /saving/i });
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("Saving…");
    });
  });
});
