import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WizardStepper, { type WizardStepperItem } from "./WizardStepper";

const STEPS: WizardStepperItem[] = [
  { id: "goal", label: "Goal & Skill Framework" },
  { id: "gap", label: "Gap Rating" },
  { id: "drivers", label: "Drivers & Barriers" },
  { id: "review", label: "Review & Generate" },
];

function renderStepper(currentIndex: number, completedIndices: number[] = []) {
  return render(
    <WizardStepper
      steps={STEPS}
      currentIndex={currentIndex}
      completedIndices={completedIndices}
    />,
  );
}

describe("WizardStepper", () => {
  it("renders a labelled navigation region with one node per step", () => {
    renderStepper(0);
    const nav = screen.getByRole("navigation", {
      name: "Goal creation progress",
    });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getAllByRole("listitem")).toHaveLength(4);
  });

  it("marks the active step with aria-current='step' and no other", () => {
    renderStepper(1);
    const active = screen.getByLabelText(/Step 2 of 4: Gap Rating/);
    expect(active).toHaveAttribute("aria-current", "step");

    // Only one node is current.
    const currents = screen
      .getAllByRole("listitem")
      .filter((li) => li.getAttribute("aria-current") === "step");
    expect(currents).toHaveLength(1);
  });

  it("labels each node 'Step N of 4: {label}' with a status suffix", () => {
    renderStepper(1, [0]);
    expect(
      screen.getByLabelText("Step 1 of 4: Goal & Skill Framework, completed"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Step 2 of 4: Gap Rating, current step"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Step 3 of 4: Drivers & Barriers, upcoming"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Step 4 of 4: Review & Generate, upcoming"),
    ).toBeInTheDocument();
  });

  it("shows the step number for active and upcoming steps", () => {
    renderStepper(1, [0]);
    // Active step (index 1) shows its number.
    const active = screen.getByLabelText(/Gap Rating, current step/);
    expect(within(active).getByText("2")).toBeInTheDocument();
    // Upcoming step (index 2) shows its number.
    const upcoming = screen.getByLabelText(/Drivers & Barriers, upcoming/);
    expect(within(upcoming).getByText("3")).toBeInTheDocument();
  });

  it("renders a checkmark (not a number) for a completed step", () => {
    renderStepper(1, [0]);
    const complete = screen.getByLabelText(/Goal & Skill Framework, completed/);
    // No visible "1" for the completed step; the checkmark svg replaces it.
    expect(within(complete).queryByText("1")).not.toBeInTheDocument();
    expect(complete.querySelector("svg")).toBeInTheDocument();
  });

  it("treats the active step as current even if also in completedIndices", () => {
    renderStepper(0, [0]);
    const node = screen.getByLabelText(/Goal & Skill Framework/);
    expect(node).toHaveAttribute("aria-current", "step");
    expect(node.getAttribute("aria-label")).toContain("current step");
  });
});
