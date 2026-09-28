import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the correct label for each status", () => {
    const cases = [
      ["active", "Active"],
      ["paused", "Paused"],
      ["not_now", "Not now"],
      ["someday", "Someday"],
      ["completed", "Completed"],
      ["archived", "Archived"],
    ] as const;

    for (const [status, label] of cases) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("applies the primary token classes for active", () => {
    render(<StatusBadge status="active" />);
    const el = screen.getByText("Active");
    expect(el.className).toContain("bg-primary-subtle");
    expect(el.className).toContain("text-primary");
  });

  it("maps every status to its documented token classes", () => {
    const cases = [
      ["active", "Active", ["bg-primary-subtle", "text-primary"]],
      ["paused", "Paused", ["bg-warning-subtle", "text-warning"]],
      ["not_now", "Not now", ["bg-destructive-subtle", "text-destructive"]],
      ["someday", "Someday", ["text-text-secondary"]],
      ["completed", "Completed", ["bg-success-subtle", "text-success"]],
      ["archived", "Archived", ["bg-surface", "text-text-secondary"]],
    ] as const;

    for (const [status, label, classes] of cases) {
      const { unmount } = render(<StatusBadge status={status} />);
      const el = screen.getByText(label);
      for (const cls of classes) {
        expect(el.className).toContain(cls);
      }
      unmount();
    }
  });
});
