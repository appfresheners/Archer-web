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

    it("disables submit on empty input", () => {
      render(<ProjectModeInput onSubmit={vi.fn()} />);
      expect(
        screen.getByRole("button", { name: /break it down/i }),
      ).toHaveAttribute("aria-disabled", "true");
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
});
