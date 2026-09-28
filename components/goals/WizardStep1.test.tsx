import GoalWizard from "@/app/app/goals/new/GoalWizard";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WizardStep1 is driven entirely through the shell's `StepContext`
 * (state + setGoalText + patchState + headingRef). Rendering it through the
 * real `GoalWizard` shell exercises the full Step 1 behavior — including the
 * shell's advance gate — the way it runs in production, so the advance-gate
 * rows of the I/O matrix are covered faithfully rather than against a fake
 * context.
 */

// next/navigation is not used by Step 1 itself, but GoalWizard's tree stays
// self-contained; no router needed here.

// --- Helpers ---------------------------------------------------------------

function goalInput() {
  return screen.getByLabelText("Describe your goal") as HTMLInputElement;
}

function continueButton() {
  return screen.getByRole("button", { name: "Continue" });
}

function nextButton() {
  // The shell's Step 1 advance label is "Next: Rate yourself →".
  return screen.getByRole("button", { name: /^Next/ });
}

const THREE_ITEM_FRAMEWORK = [
  { name: "Vocal projection", required_level: 7, description: "Project clearly." },
  { name: "Stage presence", required_level: 6, description: "Command the room." },
  { name: "Storytelling", required_level: 8, description: "Structure a narrative." },
];

function mockFrameworkFetch(framework = THREE_ITEM_FRAMEWORK) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ framework }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Type a goal and click Continue; awaits the framework list rendering. */
async function fetchFramework(goal = "Become a confident public speaker") {
  fireEvent.change(goalInput(), { target: { value: goal } });
  fireEvent.click(continueButton());
  await screen.findByRole("heading", { name: "Your skill framework" });
}

describe("WizardStep1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => { });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("Idle load", () => {
    it("renders an empty goal input with no counter and Continue/Next disabled", () => {
      render(<GoalWizard />);
      expect(goalInput().value).toBe("");
      expect(screen.queryByText(/\/ 500/)).not.toBeInTheDocument();
      expect(continueButton()).toBeDisabled();
      expect(nextButton()).toBeDisabled();
    });

    it("caps the goal input at 500 characters via maxLength", () => {
      render(<GoalWizard />);
      expect(goalInput()).toHaveAttribute("maxlength", "500");
    });
  });

  describe("Typing + counter", () => {
    it("enables Continue once the goal is non-empty", () => {
      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "Learn to swim" } });
      expect(continueButton()).not.toBeDisabled();
    });

    it("shows no counter at 400 chars and shows it at 401 (first over threshold)", () => {
      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "a".repeat(400) } });
      expect(screen.queryByText(/\/ 500/)).not.toBeInTheDocument();
      fireEvent.change(goalInput(), { target: { value: "a".repeat(401) } });
      expect(screen.getByText("401 / 500")).toBeInTheDocument();
    });
  });

  describe("Empty-goal validation", () => {
    it("blocks Continue on a whitespace-only goal with a role=alert and no fetch", () => {
      const fetchMock = mockFrameworkFetch();
      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "   " } });
      // The Continue button is disabled for empty/whitespace, but the Enter
      // key path is not gated — it reaches the validation branch. Assert the
      // inline alert renders with the message and no fetch fires.
      fireEvent.keyDown(goalInput(), { key: "Enter" });
      expect(screen.getByRole("alert")).toHaveTextContent("Enter a goal first");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("clears the validation alert once the user types a real goal", () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      fireEvent.keyDown(goalInput(), { key: "Enter" });
      expect(screen.getByRole("alert")).toHaveTextContent("Enter a goal first");
      fireEvent.change(goalInput(), { target: { value: "Learn to swim" } });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Continue (happy path)", () => {
    it("shows 'Building your framework…' while in flight, then renders items", async () => {
      let resolveFetch: (v: unknown) => void = () => { };
      const fetchMock = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "Speak in public" } });
      fireEvent.click(continueButton());

      expect(
        screen.getByRole("button", { name: /building your framework/i }),
      ).toBeInTheDocument();

      resolveFetch({
        ok: true,
        status: 200,
        json: async () => ({ framework: THREE_ITEM_FRAMEWORK }),
      });

      await screen.findByRole("heading", { name: "Your skill framework" });
      expect(screen.getByText("Vocal projection")).toBeInTheDocument();
      expect(screen.getByText("Stage presence")).toBeInTheDocument();
      expect(screen.getByText("Storytelling")).toBeInTheDocument();
    });

    it("POSTs Pattern B and renders name + required-level chip + description per item", async () => {
      const fetchMock = mockFrameworkFetch();
      render(<GoalWizard />);
      await fetchFramework("Speak in public");

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/generate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            mode: "goal",
            step: "framework",
            goal: "Speak in public",
          }),
        }),
      );

      expect(screen.getByText("Required level 7")).toBeInTheDocument();
      expect(screen.getByText("Project clearly.")).toBeInTheDocument();
    });

    it("never carries a user rating into the framework, even if the payload includes one", async () => {
      // The AI-never-owns invariant: Step 1 maps only name/required_level/
      // description. A payload polluted with a rating must not leak through —
      // the sentinel rating value must appear nowhere in the rendered list.
      mockFrameworkFetch([
        {
          name: "Vocal projection",
          required_level: 7,
          description: "Project clearly.",
          // @ts-expect-error — simulate a misbehaving payload with a rating.
          user_rating: 99,
          current_level: 88,
        },
        { name: "Stage presence", required_level: 6, description: "Command the room." },
        { name: "Storytelling", required_level: 8, description: "Structure a narrative." },
      ]);
      render(<GoalWizard />);
      await fetchFramework("Speak in public");

      const list = screen.getByRole("heading", {
        name: "Your skill framework",
      }).parentElement?.parentElement;
      expect(list?.textContent).not.toContain("99");
      expect(list?.textContent).not.toContain("88");
    });
  });

  describe("Remove item", () => {
    it("removes an item and re-evaluates the advance gate (<3 blocks Next)", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await fetchFramework();

      // 3 items → Next enabled.
      expect(nextButton()).not.toBeDisabled();

      fireEvent.click(
        screen.getByRole("button", { name: "Remove Stage presence" }),
      );
      expect(screen.queryByText("Stage presence")).not.toBeInTheDocument();

      // Now 2 items remain → Next re-gated (disabled).
      expect(nextButton()).toBeDisabled();
    });
  });

  describe("Add item", () => {
    it("appends a user item with a default required level and keeps the gate satisfied", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await fetchFramework();

      const addInput = screen.getByLabelText("Add a skill") as HTMLInputElement;
      fireEvent.change(addInput, { target: { value: "Breathing technique" } });
      fireEvent.click(screen.getByRole("button", { name: "Add item" }));

      expect(screen.getByText("Breathing technique")).toBeInTheDocument();
      // A user-added item gets the neutral default required level (5).
      expect(screen.getByText("Required level 5")).toBeInTheDocument();
      // Input cleared after adding.
      expect(addInput.value).toBe("");
      // 4 items now → still advanceable.
      expect(nextButton()).not.toBeDisabled();
    });

    it("re-enables the advance gate after removing below 3 then adding back to 3", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await fetchFramework();

      fireEvent.click(
        screen.getByRole("button", { name: "Remove Storytelling" }),
      );
      expect(nextButton()).toBeDisabled();

      const addInput = screen.getByLabelText("Add a skill");
      fireEvent.change(addInput, { target: { value: "Improvisation" } });
      fireEvent.click(screen.getByRole("button", { name: "Add item" }));

      expect(nextButton()).not.toBeDisabled();
    });
  });

  describe("Advance gate", () => {
    it("enables Next only when a framework is present with >= 3 items", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      // Goal typed but not fetched → advance blocked (no framework yet).
      fireEvent.change(goalInput(), { target: { value: "Speak in public" } });
      expect(nextButton()).toBeDisabled();

      await fetchFramework("Speak in public");
      expect(nextButton()).not.toBeDisabled();
    });

    it("blocks Next once the framework drops below 3 items (via removal)", async () => {
      // The endpoint guarantees >=3 items, so the only way to fall below the
      // floor is by removing items. Start at 3, remove one, assert Next re-gates.
      mockFrameworkFetch();
      render(<GoalWizard />);
      await fetchFramework("Speak in public");
      expect(nextButton()).not.toBeDisabled();

      fireEvent.click(
        screen.getByRole("button", { name: "Remove Storytelling" }),
      );
      expect(nextButton()).toBeDisabled();
    });

    it("treats a (defensive) 200 response with fewer than 3 items as an error", async () => {
      mockFrameworkFetch([
        { name: "A", required_level: 5, description: "a" },
        { name: "B", required_level: 5, description: "b" },
      ]);
      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "Speak in public" } });
      fireEvent.click(continueButton());
      // No framework renders; an inline error is shown instead.
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Your skill framework" }),
      ).not.toBeInTheDocument();
      expect(nextButton()).toBeDisabled();
    });
  });

  describe("Error → inline alert + Try again", () => {
    it("shows an inline error on a 504 and Try again re-runs with the same goal", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 504,
          json: async () => ({ error: "The request timed out after 30 seconds." }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ framework: THREE_ITEM_FRAMEWORK }),
        });
      vi.stubGlobal("fetch", fetchMock);

      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "Speak in public" } });
      fireEvent.click(continueButton());

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(/timed out/i),
      );
      // No framework set on error.
      expect(
        screen.queryByRole("heading", { name: "Your skill framework" }),
      ).not.toBeInTheDocument();
      // Goal text preserved.
      expect(goalInput().value).toBe("Speak in public");
      expect(nextButton()).toBeDisabled();

      // Try again re-runs with the same goal and succeeds.
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await screen.findByRole("heading", { name: "Your skill framework" });

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/generate",
        expect.objectContaining({
          body: JSON.stringify({
            mode: "goal",
            step: "framework",
            goal: "Speak in public",
          }),
        }),
      );
    });

    it("surfaces a network error when fetch rejects and sets no framework", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
      vi.stubGlobal("fetch", fetchMock);

      render(<GoalWizard />);
      fireEvent.change(goalInput(), { target: { value: "Speak in public" } });
      fireEvent.click(continueButton());

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          /could not reach the server/i,
        ),
      );
      expect(
        screen.queryByRole("heading", { name: "Your skill framework" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Goal changed after framework", () => {
    it("clears the framework when the goal is edited, requiring a re-Continue", async () => {
      mockFrameworkFetch();
      render(<GoalWizard />);
      await fetchFramework("Speak in public");
      expect(nextButton()).not.toBeDisabled();

      // Editing the goal invalidates the framework (shell contract).
      fireEvent.change(goalInput(), { target: { value: "Speak in public!!" } });
      expect(
        screen.queryByRole("heading", { name: "Your skill framework" }),
      ).not.toBeInTheDocument();
      expect(nextButton()).toBeDisabled();
    });
  });
});
