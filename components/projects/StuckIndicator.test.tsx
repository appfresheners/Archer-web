import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StuckIndicator from "./StuckIndicator";

describe("StuckIndicator", () => {
  it("announces the stuck message via role=alert with the exact copy", () => {
    render(<StuckIndicator />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "No committed next action — this project is stuck.",
    );
    expect(screen.getByText("Commit one now")).toBeInTheDocument();
  });

  it("falls back to an anchor CTA when no handler is provided", () => {
    render(<StuckIndicator />);
    const cta = screen.getByRole("link", { name: "Commit one now" });
    expect(cta).toHaveAttribute("href", "#actions");
  });

  it("invokes onCommitNow when the CTA is a button", async () => {
    const onCommitNow = vi.fn();
    const user = userEvent.setup();
    render(<StuckIndicator onCommitNow={onCommitNow} />);
    await user.click(screen.getByRole("button", { name: "Commit one now" }));
    expect(onCommitNow).toHaveBeenCalledTimes(1);
  });
});
