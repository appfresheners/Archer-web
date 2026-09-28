import GoalWizard from "@/app/app/goals/new/GoalWizard";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WizardStep2 is driven entirely through the shell's `StepContext`
 * (state + patchState + headingRef). Rendering it through the real `GoalWizard`
 * shell exercises the full Step 2 behavior — including the shell's advance gate
 * that depends on every item having a `user_rating` — the way it runs in
 * production. The I/O matrix rows are covered against the real shell rather than
 * a fake context.
 */

// --- Framework fixtures ----------------------------------------------------

// Required levels chosen so the gap math and amber threshold are exercised:
//   Alpha  req 8, at 5 → gap 3 (neutral)
//   Beta   req 6, at 5 → gap 1 (neutral)
//   Gamma  req 9, at 5 → gap 4 (amber)
const FRAMEWORK = [
  { name: "Alpha", required_level: 8, description: "First." },
  { name: "Beta", required_level: 6, description: "Second." },
  { name: "Gamma", required_level: 9, description: "Third." },
];

function mockFrameworkFetch(framework = FRAMEWORK) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ framework }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// --- Helpers ---------------------------------------------------------------

function goalInput() {
  return screen.getByLabelText("Describe your goal") as HTMLInputElement;
}

function nextButton() {
  return screen.getByRole("button", { name: /^Next/ });
}

function slider(skill: string) {
  return screen.getByLabelText(
    `Your current level for ${skill}`,
  ) as HTMLInputElement;
}

/** Drive the shell from a fresh render to Step 2 with the given framework. */
async function goToStep2(framework = FRAMEWORK) {
  mockFrameworkFetch(framework);
  render(<GoalWizard />);
  fireEvent.change(goalInput(), { target: { value: "Learn to present" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Your skill framework" });
  // Advance into Step 2.
  fireEvent.click(nextButton());
  await screen.findByRole("heading", { name: "Gap Rating" });
}

describe("WizardStep2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => { });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("Enter Step 2 — rows render at neutral 5", () => {
    it("renders one row per framework item with name, required chip, slider at 5", async () => {
      await goToStep2();

      expect(screen.getByText("Required: 8")).toBeInTheDocument();
      expect(screen.getByText("Required: 6")).toBeInTheDocument();
      expect(screen.getByText("Required: 9")).toBeInTheDocument();

      // Every slider starts at the neutral midpoint 5 — no AI value, no pre-fill.
      expect(slider("Alpha").value).toBe("5");
      expect(slider("Beta").value).toBe("5");
      expect(slider("Gamma").value).toBe("5");
    });

    it("no-pre-fill audit: no slider shows a value other than 5 on load", async () => {
      await goToStep2();
      const sliders = screen.getAllByRole("slider") as HTMLInputElement[];
      expect(sliders).toHaveLength(3);
      for (const s of sliders) {
        expect(s.value).toBe("5");
      }
    });
  });

  describe("Gap readout + amber threshold", () => {
    it("shows neutral gap for Required 8 at 5 (Gap: 3)", async () => {
      await goToStep2();
      const alphaRow = slider("Alpha").closest("li")!;
      expect(within(alphaRow).getByText("Gap: 3")).toBeInTheDocument();
    });

    it("shows amber gap for Required 9 at 5 (Gap: 4, ≥ 4)", async () => {
      await goToStep2();
      const gammaRow = slider("Gamma").closest("li")!;
      const gapEl = within(gammaRow).getByText("Gap: 4");
      expect(gapEl).toBeInTheDocument();
      expect(gapEl.className).toContain("text-warning");
    });

    it("keeps a gap of 3 neutral (no warning token)", async () => {
      await goToStep2();
      const alphaRow = slider("Alpha").closest("li")!;
      const gapEl = within(alphaRow).getByText("Gap: 3");
      expect(gapEl.className).not.toContain("text-warning");
    });

    it("floors the gap at 0 when the user rates above required", async () => {
      await goToStep2();
      // Beta required 6; rate at 9 → raw gap -3, displayed as Gap: 0.
      fireEvent.change(slider("Beta"), { target: { value: "9" } });
      const betaRow = slider("Beta").closest("li")!;
      expect(within(betaRow).getByText("Gap: 0")).toBeInTheDocument();
    });
  });

  describe("Adjust slider — live readout + aria + stored rating", () => {
    it("updates the current readout, gap, and aria-valuetext on change", async () => {
      await goToStep2();
      const alpha = slider("Alpha"); // required 8
      fireEvent.change(alpha, { target: { value: "6" } });

      expect(alpha.value).toBe("6");
      const alphaRow = alpha.closest("li")!;
      // Gap = 8 - 6 = 2.
      expect(within(alphaRow).getByText("Gap: 2")).toBeInTheDocument();
      expect(within(alphaRow).getByText("Current: 6")).toBeInTheDocument();
      expect(alpha).toHaveAttribute("aria-valuetext", "Current: 6, Gap: 2");
      expect(alpha).toHaveAttribute("aria-valuenow", "6");
    });

    it("crosses into amber when the gap reaches 4 via the slider", async () => {
      await goToStep2();
      const alpha = slider("Alpha"); // required 8
      // Rate at 4 → gap 4 → amber.
      fireEvent.change(alpha, { target: { value: "4" } });
      const alphaRow = alpha.closest("li")!;
      const gapEl = within(alphaRow).getByText("Gap: 4");
      expect(gapEl.className).toContain("text-warning");
    });
  });

  describe("Amber gap has a non-colour signal", () => {
    it("adds '(large gap)' to aria-valuetext and an sr-only note when gap ≥ 4", async () => {
      await goToStep2();
      // Gamma: required 9 at 5 → gap 4 → amber.
      const gamma = slider("Gamma");
      expect(gamma).toHaveAttribute(
        "aria-valuetext",
        "Current: 5, Gap: 4 (large gap)",
      );
      // Neutral gap carries no "(large gap)" suffix.
      expect(slider("Alpha")).toHaveAttribute(
        "aria-valuetext",
        "Current: 5, Gap: 3",
      );
    });
  });

  describe("ARIA range semantics", () => {
    it("exposes range role, label, valuenow/min/max, and valuetext", async () => {
      await goToStep2();
      const alpha = slider("Alpha");
      expect(alpha).toHaveAttribute("type", "range");
      expect(alpha).toHaveAttribute("min", "1");
      expect(alpha).toHaveAttribute("max", "10");
      expect(alpha).toHaveAttribute("aria-label", "Your current level for Alpha");
      expect(alpha).toHaveAttribute("aria-valuemin", "1");
      expect(alpha).toHaveAttribute("aria-valuemax", "10");
      expect(alpha).toHaveAttribute("aria-valuenow", "5");
      expect(alpha).toHaveAttribute("aria-valuetext", "Current: 5, Gap: 3");
    });
  });

  describe("Add item", () => {
    it("appends a user item starting at rating 5 with a user-owned required level", async () => {
      await goToStep2();
      const addInput = screen.getByLabelText("Add a skill") as HTMLInputElement;
      fireEvent.change(addInput, { target: { value: "Delta" } });
      fireEvent.click(screen.getByRole("button", { name: "Add item" }));

      const delta = slider("Delta");
      expect(delta.value).toBe("5");
      // User-added item gets the neutral default required level 5 → gap 0.
      const deltaRow = delta.closest("li")!;
      expect(within(deltaRow).getByText("Required: 5")).toBeInTheDocument();
      expect(within(deltaRow).getByText("Gap: 0")).toBeInTheDocument();
      // Input cleared after adding.
      expect(addInput.value).toBe("");
    });
  });

  describe("Advance gate", () => {
    it("enables Next once every item has a rating (seeded on entry)", async () => {
      await goToStep2();
      // On entry the shell seeds all ratings to 5, so the gate is met without
      // touching any slider (confirmation-at-default).
      expect(nextButton()).not.toBeDisabled();
    });

    it("labels the Step 2 advance button 'Next: Drivers & Barriers →'", async () => {
      await goToStep2();
      expect(
        screen.getByRole("button", { name: "Next: Drivers & Barriers →" }),
      ).toBeInTheDocument();
    });

    it("advances to Step 3 when the gate is met", async () => {
      await goToStep2();
      fireEvent.click(nextButton());
      expect(
        screen.getByRole("heading", { name: "Drivers & Barriers" }),
      ).toBeInTheDocument();
    });
  });

  describe("Back then forward preserves ratings", () => {
    it("keeps an entered rating after going Back to Step 1 and returning", async () => {
      await goToStep2();
      fireEvent.change(slider("Alpha"), { target: { value: "7" } });
      expect(slider("Alpha").value).toBe("7");

      // Back to Step 1 (framework + ratings preserved by the shell), then
      // forward again to Step 2.
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      await screen.findByRole("heading", { name: "Your skill framework" });
      fireEvent.click(nextButton());
      await screen.findByRole("heading", { name: "Gap Rating" });

      expect(slider("Alpha").value).toBe("7");
    });
  });
});
