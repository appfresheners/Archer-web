import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DepthControl from "./DepthControl";

describe("DepthControl", () => {
  it("renders two options with radio semantics inside a radiogroup", () => {
    render(<DepthControl value="minimal" onChange={vi.fn()} />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Minimal" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Full GTD" })).toBeInTheDocument();
  });

  it("reflects the value prop via aria-checked (minimal default)", () => {
    render(<DepthControl value="minimal" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Minimal" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Full GTD" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("reflects the value prop when full_gtd is selected", () => {
    render(<DepthControl value="full_gtd" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Full GTD" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Minimal" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("only the selected option is in the tab order (roving focus)", () => {
    render(<DepthControl value="minimal" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Minimal" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("radio", { name: "Full GTD" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("fires onChange when clicking an option", () => {
    const onChange = vi.fn();
    render(<DepthControl value="minimal" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Full GTD" }));
    expect(onChange).toHaveBeenCalledWith("full_gtd");
  });

  it("moves selection with ArrowRight", () => {
    const onChange = vi.fn();
    render(<DepthControl value="minimal" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "Minimal" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenCalledWith("full_gtd");
  });

  it("moves selection with ArrowLeft", () => {
    const onChange = vi.fn();
    render(<DepthControl value="full_gtd" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "Full GTD" }), {
      key: "ArrowLeft",
    });
    expect(onChange).toHaveBeenCalledWith("minimal");
  });

  it("selects the focused option on Enter and Space", () => {
    const onChange = vi.fn();
    render(<DepthControl value="minimal" onChange={onChange} />);
    const full = screen.getByRole("radio", { name: "Full GTD" });
    fireEvent.keyDown(full, { key: "Enter" });
    fireEvent.keyDown(full, { key: " " });
    expect(onChange).toHaveBeenCalledWith("full_gtd");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("does not fire onChange when disabled", () => {
    const onChange = vi.fn();
    render(<DepthControl value="minimal" onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole("radio", { name: "Full GTD" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("each option meets the 44px minimum touch target", () => {
    render(<DepthControl value="minimal" onChange={vi.fn()} />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.className).toContain("min-h-[44px]");
      expect(radio.className).toContain("min-w-[44px]");
    }
  });
});
