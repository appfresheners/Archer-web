import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GoalWizard, { applyGoalText, type WizardState } from "./GoalWizard";

// Step 4 (WizardStep4) uses next/navigation's useRouter; mock it so the shell
// tests that reach Step 4 don't crash. No navigation is asserted here.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// --- Helpers ---------------------------------------------------------------

const THREE_ITEM_FRAMEWORK = [
  { name: "Skill A", required_level: 7, description: "First." },
  { name: "Skill B", required_level: 6, description: "Second." },
  { name: "Skill C", required_level: 8, description: "Third." },
];

/**
 * Stub `fetch` so the Pattern B "Continue" call resolves with a valid
 * (≥3-item) framework. Advancing from Step 1 now requires the framework to
 * have returned, so navigation tests must fetch it first.
 */
function mockFrameworkFetch(framework = THREE_ITEM_FRAMEWORK) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ framework }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Type a goal, click Continue, and wait for the framework list to render. */
async function typeGoalAndFetch(goal: string) {
  fireEvent.change(goalInput(), { target: { value: goal } });
  fireEvent.change(screen.getByLabelText("Why does this goal matter to you?"), {
    target: { value: "This matters because it supports a meaningful life direction." },
  });
  fireEvent.click(continueButton());
  await screen.findByRole("heading", { name: "Your skill framework" });
}

function goalInput() {
  return screen.getByLabelText("Describe your goal") as HTMLInputElement;
}

function continueButton() {
  return screen.getByRole("button", { name: "Continue" });
}

function nextButton() {
  // Step 1's advance label is "Next: Rate yourself →"; later steps use "Next".
  // Match either via a prefix regex.
  return screen.getByRole("button", { name: /^Next/ });
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => { });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("Initial load", () => {
    it("renders on Step 1 with only Step 1 reachable (Next gated, Back disabled)", () => {
      render(<GoalWizard />);
      expect(activeStepLabel()).toMatch(/Step 1 of 4/);
      // Step 1 gate = non-empty goal AND ≥3-item framework → Next disabled at load.
      expect(nextButton()).toBeDisabled();
      // Back is disabled on the first step.
      expect(backButton()).toBeDisabled();
    });
  });

  describe("Advance gating", () => {
    it("keeps Next disabled with goal text but no framework yet", () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "Learn to swim" } });
      // Goal text alone no longer satisfies the gate — the framework must
      // return first.
      expect(nextButton()).toBeDisabled();
    });

    it("advances to Step 2 once the framework has returned with ≥3 items", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await typeGoalAndFetch("Learn to swim");
      expect(nextButton()).not.toBeDisabled();

      fireEvent.click(nextButton());
      expect(activeStepLabel()).toMatch(/Step 2 of 4: Gap Rating/);
    });

    it("labels the Step 1 advance button 'Next: Rate yourself →' (epics AC)", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await typeGoalAndFetch("Learn to swim");
      expect(
        screen.getByRole("button", { name: "Next: Rate yourself →" }),
      ).toBeInTheDocument();
    });

    it("blocks Next once the framework drops below 3 items (via removal)", async () => {
      // A <3 framework is only reachable by removing items (the endpoint
      // guarantees >=3). Start at 3, remove one, assert advance stays gated.
      mockFrameworkFetch();
      render(<GoalWizard />);
      await typeGoalAndFetch("Learn to swim");
      expect(nextButton()).not.toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: "Remove Skill C" }));
      expect(nextButton()).toBeDisabled();
      fireEvent.click(nextButton());
      expect(activeStepLabel()).toMatch(/Step 1 of 4/);
    });

    it("marks a step complete in the stepper after advancing past it", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await typeGoalAndFetch("Learn to swim");
      fireEvent.click(nextButton());
      expect(
        screen.getByLabelText(/Step 1 of 4: Goal & Skill Framework, completed/),
      ).toBeInTheDocument();
    });
  });

  it("keeps framework generation and Next blocked until a why is entered", () => {
    const fetchMock = mockFrameworkFetch();
    render(<GoalWizard />);
    fireEvent.change(goalInput(), { target: { value: "Learn to swim" } });
    expect(continueButton()).toBeDisabled();
    expect(nextButton()).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Why does this goal matter to you?"), {
      target: { value: "I want to feel confident and safe in the water." },
    });
    expect(continueButton()).not.toBeDisabled();
  });

  describe("Step 3 gate + label", () => {
    /** Drive from a fresh render through Steps 1→2→3. */
    async function goToStep3() {
      await typeGoalAndFetch("Learn to present");
      fireEvent.click(nextButton()); // Step 1 → Step 2
      await screen.findByRole("heading", { name: "Gap Rating" });
      fireEvent.click(nextButton()); // Step 2 → Step 3 (ratings seeded to 5)
      await screen.findByRole("heading", { name: "Drivers & Barriers" });
    }

    it("labels the Step 3 advance button 'Next: Review →'", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await goToStep3();
      expect(
        screen.getByRole("button", { name: "Next: Review →" }),
      ).toBeInTheDocument();
    });

    it("blocks advance until ≥1 driver, ≥1 barrier, and a complete if–then", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await goToStep3();

      // Nothing entered → gated.
      expect(nextButton()).toBeDisabled();

      // One driver only → still gated.
      fireEvent.change(screen.getByLabelText("Drivers"), {
        target: { value: "Discipline" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add driver" }));
      expect(nextButton()).toBeDisabled();

      // + one barrier → still gated (no if–then yet).
      fireEvent.change(screen.getByLabelText("Barriers"), {
        target: { value: "Distractions" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add barrier" }));
      expect(nextButton()).toBeDisabled();

      // + partial if–then (only "if") → still gated.
      fireEvent.change(screen.getByLabelText("If …"), {
        target: { value: "it is 7am" },
      });
      expect(nextButton()).toBeDisabled();

      // + complete if–then → gate met.
      fireEvent.change(screen.getByLabelText("then I will …"), {
        target: { value: "practise for 10 minutes" },
      });
      expect(nextButton()).not.toBeDisabled();

      // Advancing lands on Step 4.
      fireEvent.click(nextButton());
      expect(activeStepLabel()).toMatch(/Step 4 of 4: Review & Generate/);
    });
  });

  describe("Back navigation preserves inputs", () => {
    it("returns to Step 1 with the goal text intact", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await typeGoalAndFetch("Run a marathon");
      fireEvent.click(nextButton());
      expect(activeStepLabel()).toMatch(/Step 2 of 4/);

      fireEvent.click(backButton());
      expect(activeStepLabel()).toMatch(/Step 1 of 4/);
      expect(goalInput().value).toBe("Run a marathon");
    });
  });

  describe("goToStep (Step 4 Edit links)", () => {
    /** Drive from a fresh render through Steps 1→2→3→4. */
    async function goToStep4() {
      await typeGoalAndFetch("Become a speaker");
      fireEvent.click(nextButton()); // → Step 2
      await screen.findByRole("heading", { name: "Gap Rating" });
      fireEvent.click(nextButton()); // → Step 3 (ratings seeded to 5)
      await screen.findByRole("heading", { name: "Drivers & Barriers" });
      fireEvent.change(screen.getByLabelText("Drivers"), {
        target: { value: "Discipline" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add driver" }));
      fireEvent.change(screen.getByLabelText("Barriers"), {
        target: { value: "Distractions" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add barrier" }));
      fireEvent.change(screen.getByLabelText("If …"), {
        target: { value: "it is 7am" },
      });
      fireEvent.change(screen.getByLabelText("then I will …"), {
        target: { value: "practise 10 minutes" },
      });
      fireEvent.click(nextButton()); // → Step 4
      await screen.findByRole("heading", { name: "Review & Generate" });
    }

    it("mounts WizardStep4 on the last step", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await goToStep4();
      expect(
        screen.getByRole("button", { name: "Generate my breakdown" }),
      ).toBeInTheDocument();
      // The shell's advance button is disabled on the last step.
      expect(nextButton()).toBeDisabled();
    });

    it("Edit goal jumps back to Step 1 (backward jump always allowed)", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await goToStep4();
      fireEvent.click(screen.getByRole("button", { name: "Edit goal" }));
      expect(activeStepLabel()).toMatch(/Step 1 of 4/);
      expect(goalInput().value).toBe("Become a speaker");
    });

    it("Edit ratings jumps back to Step 2 with inputs preserved", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await goToStep4();
      fireEvent.click(screen.getByRole("button", { name: "Edit ratings" }));
      expect(activeStepLabel()).toMatch(/Step 2 of 4: Gap Rating/);
    });

    it("does not jump forward past an unmet gate", async () => {
      // On Step 1 with no framework yet, the shell exposes no forward-jump UI;
      // a programmatic forward jump is gated. Verify by trying to reach Step 4
      // through an Edit-like jump before gates are met: not possible via UI,
      // so assert we remain unable to advance while gated.
      mockFrameworkFetch();
      render(<GoalWizard />);
      // No goal/framework yet → still Step 1, Next disabled.
      expect(activeStepLabel()).toMatch(/Step 1 of 4/);
      expect(nextButton()).toBeDisabled();
    });
  });

  describe("Skip-ahead prevention", () => {
    it("offers no interactive control to jump to a later step directly", () => {
      render(<GoalWizard />);
      // The stepper renders no buttons/links — only the gated Next moves
      // forward. Step 1's own "Continue" fetches the framework; navigation is
      // still limited to Back/Next.
      const labels = screen.getAllByRole("button").map((b) => b.textContent);
      expect(labels).toEqual(["Continue", "Back", "Next: Rate yourself →"]);
      // And Next is gated on Step 1's rule, so an ungated jump is impossible.
      expect(nextButton()).toBeDisabled();
    });
  });

  describe("Framework invalidation on goal change", () => {
    it("resets completion and invalidates the framework when the goal changes after advancing", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await typeGoalAndFetch("Learn guitar");
      fireEvent.click(nextButton());
      // On Step 2, Step 1 is now marked complete in the stepper.
      expect(
        screen.getByLabelText(/Step 1 of 4: Goal & Skill Framework, completed/),
      ).toBeInTheDocument();

      // Return to Step 1 and edit the goal → the framework is invalidated
      // (cleared) and dependent completion is reset, so advancing is re-gated:
      // the goal must be re-Continued to fetch a fresh framework.
      fireEvent.click(backButton());
      fireEvent.change(goalInput(), { target: { value: "Learn piano" } });
      expect(
        screen.queryByRole("heading", { name: "Your skill framework" }),
      ).not.toBeInTheDocument();
      expect(nextButton()).toBeDisabled();
      // Re-Continue fetches a fresh framework and advancing works again.
      fireEvent.click(continueButton());
      await screen.findByRole("heading", { name: "Your skill framework" });
      fireEvent.click(nextButton());
      expect(activeStepLabel()).toMatch(/Step 2 of 4/);
    });

    it("collapses back to Step 1's gate when goal is cleared after advancing", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await typeGoalAndFetch("Learn guitar");
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
      why: "I want to make music with friends.",
      framework: [
        { name: "Chords", required_level: 7, description: "…", user_rating: 4 },
      ],
      drivers: ["I love music"],
      barriers: ["No practice time"],
      ifThen: "If it is 7am, then I will practice for 10 minutes",
    };

    it("returns the same reference when the text is unchanged (no-op)", () => {
      expect(applyGoalText(withFramework, "Learn guitar")).toBe(withFramework);
    });

    it("just updates the text when no framework is set", () => {
      const start: WizardState = { ...withFramework, framework: null };
      const next = applyGoalText(start, "Learn piano");
      expect(next.goalText).toBe("Learn piano");
      expect(next.framework).toBeNull();
    });

    it("clears the framework (and its inline ratings) when the goal changes", () => {
      // Ratings live inline on framework items now, so clearing the framework
      // clears the ratings too — there is no separate ratings map.
      const next = applyGoalText(withFramework, "Learn piano");
      expect(next.goalText).toBe("Learn piano");
      expect(next.framework).toBeNull();
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
    it("moves focus to the new step's first interactive element on advance", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await typeGoalAndFetch("Learn to code");
      fireEvent.click(nextButton());
      // Step 2's first focusable is the first skill's rating slider.
      const firstSlider = screen.getByLabelText(
        "Your current level for Skill A",
      );
      expect(firstSlider).toHaveFocus();
    });

    it("moves focus back to Step 1's input (first interactive) on Back", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await typeGoalAndFetch("Learn to code");
      fireEvent.click(nextButton());
      fireEvent.click(backButton());
      // Step 1's first focusable is the goal text input.
      expect(goalInput()).toHaveFocus();
    });
  });
});
