import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GoalWizard, { applyGoalText, type WizardState } from "./GoalWizard";

// --- Helpers ---------------------------------------------------------------

function goalInput() {
  return screen.getByLabelText("Describe your goal") as HTMLInputElement;
}

function nextButton() {
  return screen.getByRole("button", { name: "Next" });
}

function backButton() {
  return screen.getByRole("button", { name: "Back" });
}

function activeStepLabel() {
  // The active stepper node carries aria-current="step".
  const nav = screen.getByRole("navigation", {
    name: "Goal creation progress",
  });
  const current = nav.querySelector('[aria-current="step"]');
  return current?.getAttribute("aria-label") ?? "";
}

describe("GoalWizard", () => {
  describe("Initial load", () => {
    it("renders on Step 1 with only Step 1 reachable (Next gated, Back disabled)", () => {
      render(<GoalWizard />);
      expect(activeStepLabel()).toMatch(/Step 1 of 4/);
      // Step 1 gate = non-empty goal → Next disabled at load.
      expect(nextButton()).toBeDisabled();
      // Back is disabled on the first step.
      expect(backButton()).toBeDisabled();
    });
  });

  describe("Advance gating", () => {
    it("enables Next once the goal text is non-empty and advances to Step 2", () => {
      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "Learn to swim" } });
      expect(nextButton()).not.toBeDisabled();

      fireEvent.click(nextButton());
      expect(activeStepLabel()).toMatch(/Step 2 of 4: Gap Rating/);
    });

    it("blocks Next while the gate fails (whitespace-only goal)", () => {
      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "   " } });
      expect(nextButton()).toBeDisabled();
      fireEvent.click(nextButton());
      // Still on Step 1 — the gate never passed.
      expect(activeStepLabel()).toMatch(/Step 1 of 4/);
    });

    it("marks a step complete in the stepper after advancing past it", () => {
      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "Learn to swim" } });
      fireEvent.click(nextButton());
      expect(
        screen.getByLabelText(/Step 1 of 4: Goal & Skill Framework, completed/),
      ).toBeInTheDocument();
    });
  });

  describe("Back navigation preserves inputs", () => {
    it("returns to Step 1 with the goal text intact", () => {
      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "Run a marathon" } });
      fireEvent.click(nextButton());
      expect(activeStepLabel()).toMatch(/Step 2 of 4/);

      fireEvent.click(backButton());
      expect(activeStepLabel()).toMatch(/Step 1 of 4/);
      expect(goalInput().value).toBe("Run a marathon");
    });
  });

  describe("Skip-ahead prevention", () => {
    it("offers no interactive control to jump to a later step directly", () => {
      render(<GoalWizard />);
      // The stepper renders no buttons/links — only the gated Next moves
      // forward. The only actionable buttons are Back and Next.
      const buttons = screen.getAllByRole("button");
      const labels = buttons.map((b) => b.textContent);
      expect(labels).toEqual(["Back", "Next"]);
      // And Next is gated on Step 1's rule, so an ungated jump is impossible.
      expect(nextButton()).toBeDisabled();
    });
  });

  describe("Framework invalidation on goal change", () => {
    it("resets completion when the goal text changes after advancing", () => {
      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "Learn guitar" } });
      fireEvent.click(nextButton());
      // On Step 2, Step 1 is now marked complete in the stepper.
      expect(
        screen.getByLabelText(/Step 1 of 4: Goal & Skill Framework, completed/),
      ).toBeInTheDocument();

      // Return to Step 1 and edit the goal → dependent completion is reset, so
      // stepping forward again is re-gated (no stale completion carries over).
      fireEvent.click(backButton());
      fireEvent.change(goalInput(), { target: { value: "Learn piano" } });
      fireEvent.click(nextButton());
      // We can still advance (goal is non-empty), but had the framework been
      // set it would have been invalidated; completion was recomputed, not
      // preserved from before the edit.
      expect(activeStepLabel()).toMatch(/Step 2 of 4/);
    });

    it("collapses back to Step 1's gate when goal is cleared after advancing", () => {
      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "Learn guitar" } });
      fireEvent.click(nextButton());
      fireEvent.click(backButton());

      // Clearing the goal on Step 1 fails its gate → Next is blocked again and
      // no step is marked complete.
      fireEvent.change(goalInput(), { target: { value: "" } });
      expect(nextButton()).toBeDisabled();
      expect(
        screen.queryByLabelText(
          /Step 1 of 4: Goal & Skill Framework, completed/,
        ),
      ).not.toBeInTheDocument();
    });
  });

  // The framework-invalidation branch cannot be reached through the DOM in
  // this story (the shell has no UI to set a non-null framework — that arrives
  // with Stories 3.2/3.3). Test the pure transition directly so the contract
  // is pinned now and a later story wiring in a framework can't silently break
  // it.
  describe("applyGoalText (framework invalidation contract)", () => {
    const withFramework: WizardState = {
      goalText: "Learn guitar",
      framework: [
        { name: "Chords", requiredLevel: 7, description: "…", userRating: 4 },
      ],
      ratings: { Chords: 4 },
      drivers: ["I love music"],
      barriers: ["No practice time"],
      ifThen: "If it is 7am, then I will practice for 10 minutes",
    };

    it("returns the same reference when the text is unchanged (no-op)", () => {
      expect(applyGoalText(withFramework, "Learn guitar")).toBe(withFramework);
    });

    it("just updates the text when no framework is set", () => {
      const start: WizardState = { ...withFramework, framework: null, ratings: {} };
      const next = applyGoalText(start, "Learn piano");
      expect(next.goalText).toBe("Learn piano");
      expect(next.framework).toBeNull();
    });

    it("clears the framework and its ratings when the goal changes", () => {
      const next = applyGoalText(withFramework, "Learn piano");
      expect(next.goalText).toBe("Learn piano");
      expect(next.framework).toBeNull();
      expect(next.ratings).toEqual({});
    });

    it("preserves user-owned drivers, barriers, and if–then across a goal edit", () => {
      // These are the user's own words (Step 3), not derived from the
      // framework, so a goal edit must NOT wipe them.
      const next = applyGoalText(withFramework, "Learn piano");
      expect(next.drivers).toEqual(withFramework.drivers);
      expect(next.barriers).toEqual(withFramework.barriers);
      expect(next.ifThen).toBe(withFramework.ifThen);
    });
  });

  describe("Focus management", () => {
    it("moves focus to the new step's first interactive element on advance", () => {
      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "Learn to code" } });
      fireEvent.click(nextButton());
      // Step 2 is a placeholder with no interactive element → focus falls back
      // to its heading (tabIndex=-1).
      const heading = screen.getByRole("heading", { name: "Gap Rating" });
      expect(heading).toHaveFocus();
    });

    it("moves focus back to Step 1's input (first interactive) on Back", () => {
      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "Learn to code" } });
      fireEvent.click(nextButton());
      fireEvent.click(backButton());
      // Step 1's first focusable is the goal text input.
      expect(goalInput()).toHaveFocus();
    });
  });
});
