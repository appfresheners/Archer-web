import GoalWizard from "@/app/app/goals/new/GoalWizard";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { composeIfThen, parseIfThen } from "./WizardStep3";

// Advancing to Step 4 mounts WizardStep4, which uses next/navigation's
// useRouter; mock it so the gate test that lands on Step 4 doesn't crash.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

/**
 * WizardStep3 is driven entirely through the shell's `StepContext`
 * (state + patchState + headingRef). Rendering it through the real `GoalWizard`
 * shell exercises the full Step 3 behavior — including the shell's advance gate
 * (≥1 driver && ≥1 barrier && complete if–then) — the way it runs in
 * production. The I/O matrix rows are covered against the real shell.
 */

// --- Framework fixture (needed to reach Step 3 via Steps 1→2) --------------

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

function whyInput() {
  return screen.getByLabelText(
    "Why does this goal matter to you?",
  ) as HTMLInputElement;
}

function nextButton() {
  return screen.getByRole("button", { name: /^Next/ });
}

function backButton() {
  return screen.getByRole("button", { name: "Back" });
}

/** Drive the shell from a fresh render all the way to Step 3. */
async function goToStep3(framework = FRAMEWORK) {
  mockFrameworkFetch(framework);
  render(<GoalWizard />);
  fireEvent.change(goalInput(), { target: { value: "Learn to present" } });
  fireEvent.change(whyInput(), { target: { value: "To grow." } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Your skill framework" });
  // Step 1 → Step 2.
  fireEvent.click(nextButton());
  await screen.findByRole("heading", { name: "Gap Rating" });
  // Step 2 → Step 3 (all ratings seeded to 5 on entry, so the gate is met).
  fireEvent.click(nextButton());
  await screen.findByRole("heading", { name: "Drivers & Barriers" });
}

function driverInput() {
  return screen.getByLabelText("Drivers") as HTMLInputElement;
}

function barrierInput() {
  return screen.getByLabelText("Barriers") as HTMLInputElement;
}

function addDriver(value: string) {
  fireEvent.change(driverInput(), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Add driver" }));
}

function addBarrier(value: string) {
  fireEvent.change(barrierInput(), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Add barrier" }));
}

/** Click "Add if–then plan" and fill the resulting pair's two inputs. */
function addIfThenPlan(ifValue: string, thenValue: string, planNumber = 1) {
  fireEvent.click(screen.getByRole("button", { name: "Add if–then plan" }));
  const ifInput = screen.getByLabelText(
    `If … (plan ${planNumber})`,
  ) as HTMLInputElement;
  const thenInput = screen.getByLabelText(
    `then I will … (plan ${planNumber})`,
  ) as HTMLInputElement;
  fireEvent.change(ifInput, { target: { value: ifValue } });
  fireEvent.change(thenInput, { target: { value: thenValue } });
  return { ifInput, thenInput };
}

describe("composeIfThen", () => {
  it("composes both non-empty parts with the canonical stable format", () => {
    expect(composeIfThen("it is 7am", "practise for 10 minutes")).toBe(
      "If it is 7am, then I will practise for 10 minutes",
    );
  });

  it("trims each part before composing", () => {
    expect(composeIfThen("  it is 7am  ", "  practise  ")).toBe(
      "If it is 7am, then I will practise",
    );
  });

  it("returns an empty string when either part is missing/whitespace", () => {
    expect(composeIfThen("", "practise")).toBe("");
    expect(composeIfThen("it is 7am", "")).toBe("");
    expect(composeIfThen("   ", "practise")).toBe("");
    expect(composeIfThen("it is 7am", "   ")).toBe("");
    expect(composeIfThen("", "")).toBe("");
  });
});

describe("parseIfThen (inverse of composeIfThen)", () => {
  it("round-trips composed output back into its two halves", () => {
    const composed = composeIfThen("it is 7am", "practise for 10 minutes");
    expect(parseIfThen(composed)).toEqual({
      ifPart: "it is 7am",
      thenPart: "practise for 10 minutes",
    });
  });

  it("returns empty halves for an empty or non-matching string", () => {
    expect(parseIfThen("")).toEqual({ ifPart: "", thenPart: "" });
    expect(parseIfThen("some hand-edited text")).toEqual({
      ifPart: "",
      thenPart: "",
    });
  });
});

describe("WizardStep3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => { });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("Enter Step 3 — three blank groups with guidance", () => {
    it("renders Drivers, Barriers, and an empty If–then group all blank on load", async () => {
      await goToStep3();

      expect(driverInput().value).toBe("");
      expect(barrierInput().value).toBe("");
      // No if–then entries yet; only the Add control.
      expect(
        screen.getByRole("button", { name: "Add if–then plan" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText(/^If … \(plan/),
      ).not.toBeInTheDocument();
    });

    it("shows the inline label guidance for Drivers and Barriers", async () => {
      await goToStep3();
      expect(
        screen.getByText("An internal strength already working for you"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("What actually gets in the way"),
      ).toBeInTheDocument();
    });

    it("no-pre-fill / no-AI-content audit: no list entries and no if–then text on load", async () => {
      await goToStep3();
      // No removable entries exist yet.
      expect(
        screen.queryByRole("button", { name: /^Remove (driver|barrier):/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^Remove if–then:/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Add driver / barrier", () => {
    it("appends a trimmed driver and clears the input", async () => {
      await goToStep3();
      fireEvent.change(driverInput(), { target: { value: "  I stay focused  " } });
      fireEvent.click(screen.getByRole("button", { name: "Add driver" }));

      expect(
        screen.getByRole("button", { name: "Remove driver: I stay focused" }),
      ).toBeInTheDocument();
      expect(driverInput().value).toBe("");
    });

    it("appends a trimmed barrier and clears the input", async () => {
      await goToStep3();
      addBarrier("Busy evenings");
      expect(
        screen.getByRole("button", { name: "Remove barrier: Busy evenings" }),
      ).toBeInTheDocument();
      expect(barrierInput().value).toBe("");
    });

    it("adds a driver on Enter key", async () => {
      await goToStep3();
      fireEvent.change(driverInput(), { target: { value: "Consistency" } });
      fireEvent.keyDown(driverInput(), { key: "Enter" });
      expect(
        screen.getByRole("button", { name: "Remove driver: Consistency" }),
      ).toBeInTheDocument();
    });
  });

  describe("Empty / whitespace add is a no-op", () => {
    it("does not append when the add field is blank or whitespace", async () => {
      await goToStep3();
      // Add button disabled while blank.
      expect(screen.getByRole("button", { name: "Add driver" })).toBeDisabled();

      fireEvent.change(driverInput(), { target: { value: "   " } });
      // Still disabled with only whitespace; clicking is a no-op.
      expect(screen.getByRole("button", { name: "Add driver" })).toBeDisabled();
      fireEvent.keyDown(driverInput(), { key: "Enter" });

      expect(
        screen.queryByRole("button", { name: /^Remove driver:/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Remove entry", () => {
    it("removes a driver and re-evaluates the gate", async () => {
      await goToStep3();
      addDriver("Discipline");
      addBarrier("Distractions");
      addIfThenPlan("it is 7am", "practise for 10 minutes");
      expect(nextButton()).not.toBeDisabled();

      fireEvent.click(
        screen.getByRole("button", { name: "Remove driver: Discipline" }),
      );
      expect(
        screen.queryByRole("button", { name: "Remove driver: Discipline" }),
      ).not.toBeInTheDocument();
      // Gate re-evaluates: no drivers → blocked.
      expect(nextButton()).toBeDisabled();
    });

    it("removes an if–then plan and re-evaluates the gate", async () => {
      await goToStep3();
      addDriver("Discipline");
      addBarrier("Distractions");
      addIfThenPlan("it is 7am", "practise for 10 minutes");
      expect(nextButton()).not.toBeDisabled();

      fireEvent.click(
        screen.getByRole("button", {
          name: "Remove if–then: If it is 7am, then I will practise for 10 minutes",
        }),
      );
      expect(
        screen.queryByRole("button", { name: /^Remove if–then:/ }),
      ).not.toBeInTheDocument();
      // Gate re-evaluates: no if–then plan → blocked.
      expect(nextButton()).toBeDisabled();
    });
  });

  describe("If–then composition", () => {
    it("treats a partial if–then (only 'if') as incomplete → advance blocked", async () => {
      await goToStep3();
      addDriver("Discipline");
      addBarrier("Distractions");
      fireEvent.click(screen.getByRole("button", { name: "Add if–then plan" }));
      fireEvent.change(screen.getByLabelText("If … (plan 1)"), {
        target: { value: "it is 7am" },
      });
      expect(nextButton()).toBeDisabled();
    });

    it("treats a partial if–then (only 'then') as incomplete → advance blocked", async () => {
      await goToStep3();
      addDriver("Discipline");
      addBarrier("Distractions");
      fireEvent.click(screen.getByRole("button", { name: "Add if–then plan" }));
      fireEvent.change(screen.getByLabelText("then I will … (plan 1)"), {
        target: { value: "practise" },
      });
      expect(nextButton()).toBeDisabled();
    });

    it("enables advance once both halves are filled", async () => {
      await goToStep3();
      addDriver("Discipline");
      addBarrier("Distractions");
      addIfThenPlan("it is 7am", "practise for 10 minutes");
      expect(nextButton()).not.toBeDisabled();
    });
  });

  describe("Multiple if–then plans", () => {
    it("adds two plans, composes each in order, and lists both", async () => {
      await goToStep3();
      addIfThenPlan("it is 7am", "practise for 10 minutes");
      addIfThenPlan("I feel distracted", "close every extra tab", 2);

      expect(
        screen.getByRole("button", {
          name: "Remove if–then: If it is 7am, then I will practise for 10 minutes",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Remove if–then: If I feel distracted, then I will close every extra tab",
        }),
      ).toBeInTheDocument();
    });

    it("keeps both plans after removing an unrelated one (order preserved)", async () => {
      await goToStep3();
      addIfThenPlan("it is 7am", "practise for 10 minutes");
      addIfThenPlan("I feel distracted", "close every extra tab", 2);

      fireEvent.click(
        screen.getByRole("button", {
          name: "Remove if–then: If it is 7am, then I will practise for 10 minutes",
        }),
      );

      // The second plan survives and is now the only one.
      expect(
        screen.getByRole("button", {
          name: "Remove if–then: If I feel distracted, then I will close every extra tab",
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: "Remove if–then: If it is 7am, then I will practise for 10 minutes",
        }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Advance gate", () => {
    it("blocks advance until all three (driver, barrier, if–then) are satisfied", async () => {
      await goToStep3();
      // Nothing yet.
      expect(nextButton()).toBeDisabled();

      addDriver("Discipline");
      expect(nextButton()).toBeDisabled();

      addBarrier("Distractions");
      expect(nextButton()).toBeDisabled();

      addIfThenPlan("it is 7am", "practise for 10 minutes");
      expect(nextButton()).not.toBeDisabled();
    });

    it("labels the Step 3 advance button 'Next: Review →'", async () => {
      await goToStep3();
      expect(
        screen.getByRole("button", { name: "Next: Review →" }),
      ).toBeInTheDocument();
    });

    it("advances to Step 4 when the gate is met", async () => {
      await goToStep3();
      addDriver("Discipline");
      addBarrier("Distractions");
      addIfThenPlan("it is 7am", "practise for 10 minutes");
      fireEvent.click(nextButton());
      expect(
        screen.getByRole("heading", { name: "Review & Generate" }),
      ).toBeInTheDocument();
    });
  });

  describe("Back then forward preserves values", () => {
    it("keeps drivers, barriers, and the if–then plan after Back to Step 2 and return", async () => {
      await goToStep3();
      addDriver("Discipline");
      addBarrier("Distractions");
      addIfThenPlan("it is 7am", "practise for 10 minutes");

      // Back to Step 2, then forward again to Step 3.
      fireEvent.click(backButton());
      await screen.findByRole("heading", { name: "Gap Rating" });
      fireEvent.click(nextButton());
      await screen.findByRole("heading", { name: "Drivers & Barriers" });

      // Entries preserved by the shell state.
      expect(
        screen.getByRole("button", { name: "Remove driver: Discipline" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Remove barrier: Distractions" }),
      ).toBeInTheDocument();
      // Composed if–then still satisfies the gate.
      expect(nextButton()).not.toBeDisabled();

      // The if–then INPUT FIELDS are re-hydrated from the composed state (not
      // blank), so re-editing one half can't recompose from an empty other
      // half and silently wipe the saved plan.
      expect(
        (screen.getByLabelText("If … (plan 1)") as HTMLInputElement).value,
      ).toBe("it is 7am");
      expect(
        (screen.getByLabelText("then I will … (plan 1)") as HTMLInputElement).value,
      ).toBe("practise for 10 minutes");

      // And editing just one half after return keeps the other intact.
      fireEvent.change(screen.getByLabelText("If … (plan 1)"), {
        target: { value: "it is 6am" },
      });
      expect(
        (screen.getByLabelText("then I will … (plan 1)") as HTMLInputElement).value,
      ).toBe("practise for 10 minutes");
      expect(nextButton()).not.toBeDisabled();
    });
  });

  describe("Multi-value groups are independent", () => {
    it("keeps drivers and barriers in separate lists", async () => {
      await goToStep3();
      addDriver("Discipline");
      addBarrier("Distractions");

      const driverRemove = screen.getByRole("button", {
        name: "Remove driver: Discipline",
      });
      const barrierRemove = screen.getByRole("button", {
        name: "Remove barrier: Distractions",
      });
      const driverList = driverRemove.closest("ul")!;
      const barrierList = barrierRemove.closest("ul")!;
      expect(driverList).not.toBe(barrierList);
      expect(within(driverList).queryByText("Distractions")).toBeNull();
      expect(within(barrierList).queryByText("Discipline")).toBeNull();
    });
  });
});
