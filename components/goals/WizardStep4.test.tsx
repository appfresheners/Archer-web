import GoalWizard from "@/app/app/goals/new/GoalWizard";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WizardStep4 is driven through the real `GoalWizard` shell so its review
 * summary, Edit links (via the shell's gated `goToStep`), and Generate flow are
 * exercised the way they run in production. The Step 1 framework fetch and the
 * Step 4 generate POST both go through the single mocked `fetch`, routed by the
 * request body's `step`.
 */

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

// --- Fixtures --------------------------------------------------------------

const FRAMEWORK = [
  { name: "Alpha", required_level: 8, description: "First." },
  { name: "Beta", required_level: 6, description: "Second." },
  { name: "Gamma", required_level: 9, description: "Third." },
];

type FetchResult = { ok: boolean; status: number; body: unknown };

/**
 * Stub `fetch` so the framework step always returns a valid framework, and the
 * generate step returns whatever `generateResult` describes.
 */
function stubFetch(generateResult: FetchResult) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const parsed = init?.body ? JSON.parse(init.body as string) : {};
    if (parsed.step === "framework") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ framework: FRAMEWORK }),
      };
    }
    // generate step
    return {
      ok: generateResult.ok,
      status: generateResult.status,
      json: async () => generateResult.body,
    };
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

/** Drive the shell from a fresh render all the way to Step 4. */
async function goToStep4() {
  // Step 1: goal + framework fetch.
  fireEvent.change(goalInput(), { target: { value: "Become a speaker" } });
  fireEvent.change(screen.getByLabelText("Why does this goal matter to you?"), {
    target: { value: "I want to communicate ideas that matter to my community." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Your skill framework" });
  fireEvent.click(nextButton()); // → Step 2

  // Step 2: ratings seeded to 5 on entry → gate met.
  await screen.findByRole("heading", { name: "Gap Rating" });
  fireEvent.click(nextButton()); // → Step 3

  // Step 3: one driver, one barrier, complete if–then.
  await screen.findByRole("heading", { name: "Drivers & Barriers" });
  fireEvent.change(screen.getByLabelText("Drivers"), {
    target: { value: "Discipline" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add driver" }));
  fireEvent.change(screen.getByLabelText("Barriers"), {
    target: { value: "Distractions" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add barrier" }));
  fireEvent.click(screen.getByRole("button", { name: "Add if–then plan" }));
  fireEvent.change(screen.getByLabelText("If … (plan 1)"), {
    target: { value: "it is 7am" },
  });
  fireEvent.change(screen.getByLabelText("then I will … (plan 1)"), {
    target: { value: "practise for 10 minutes" },
  });
  fireEvent.click(nextButton()); // → Step 4
  await screen.findByRole("heading", { name: "Review & Generate" });
}

function generateButton() {
  return screen.getByRole("button", { name: "Generate my breakdown" });
}

describe("WizardStep4", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("Review render", () => {
    it("summarizes goal, framework with required + rating + gaps, drivers, barriers, and if–then", async () => {
      stubFetch({ ok: true, status: 200, body: { id: "goal-1" } });
      render(<GoalWizard />);
      await goToStep4();

      // Goal text.
      expect(screen.getByText("Become a speaker")).toBeInTheDocument();
      expect(screen.getByText("I want to communicate ideas that matter to my community.")).toBeInTheDocument();

      // Framework rows — required + user rating (seeded 5) + gap.
      const frameworkSection = screen
        .getByRole("heading", { name: "Skill framework" })
        .closest("section")!;
      // Gamma: required 9, rating 5 → gap 4 (amber).
      expect(within(frameworkSection).getByText("Required: 9")).toBeInTheDocument();
      const gammaGap = within(frameworkSection).getByText("Gap: 4");
      expect(gammaGap.className).toContain("text-warning");
      // Alpha: required 8, rating 5 → gap 3 (neutral).
      const alphaGap = within(frameworkSection).getByText("Gap: 3");
      expect(alphaGap.className).not.toContain("text-warning");

      // Drivers / barriers / if–then.
      expect(screen.getByText("Discipline")).toBeInTheDocument();
      expect(screen.getByText("Distractions")).toBeInTheDocument();
      expect(
        screen.getByText("If it is 7am, then I will practise for 10 minutes"),
      ).toBeInTheDocument();
    });

    it("renders an Edit link per section", async () => {
      stubFetch({ ok: true, status: 200, body: { id: "goal-1" } });
      render(<GoalWizard />);
      await goToStep4();

      expect(screen.getByRole("button", { name: "Edit goal" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit ratings" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit drivers" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit barriers" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Edit if–then plan" }),
      ).toBeInTheDocument();
    });
  });

  describe("Edit links → goToStep", () => {
    it("returns to Step 1 (goal) with the goal preserved", async () => {
      stubFetch({ ok: true, status: 200, body: { id: "goal-1" } });
      render(<GoalWizard />);
      await goToStep4();

      fireEvent.click(screen.getByRole("button", { name: "Edit goal" }));
      await screen.findByRole("heading", { name: "Goal & Skill Framework" });
      expect(goalInput().value).toBe("Become a speaker");
    });

    it("returns to Step 3 (drivers) with inputs preserved", async () => {
      stubFetch({ ok: true, status: 200, body: { id: "goal-1" } });
      render(<GoalWizard />);
      await goToStep4();

      fireEvent.click(screen.getByRole("button", { name: "Edit barriers" }));
      await screen.findByRole("heading", { name: "Drivers & Barriers" });
      expect(screen.getByText("Distractions")).toBeInTheDocument();
    });
  });

  describe("Generate — happy path", () => {
    it("posts Pattern C, shows the loading label, then navigates to /app/goals/{id}", async () => {
      const fetchMock = stubFetch({ ok: true, status: 200, body: { id: "goal-42" } });
      render(<GoalWizard />);
      await goToStep4();

      fireEvent.click(generateButton());

      // Loading label appears while in flight.
      expect(
        screen.getByRole("button", { name: "Generating your GTD breakdown…" }),
      ).toBeInTheDocument();

      await waitFor(() => expect(push).toHaveBeenCalledWith("/app/goals/goal-42"));

      // The generate POST carries the Pattern C payload.
      const generateCall = fetchMock.mock.calls.find((c) => {
        const body = JSON.parse((c[1] as RequestInit).body as string);
        return body.step === "generate";
      })!;
      const body = JSON.parse((generateCall[1] as RequestInit).body as string);
      expect(body).toMatchObject({
        mode: "goal",
        step: "generate",
        goal: "Become a speaker",
        why: "I want to communicate ideas that matter to my community.",
        ifThens: ["If it is 7am, then I will practise for 10 minutes"],
      });
      expect(body.framework).toHaveLength(3);
      expect(body.drivers).toEqual(["Discipline"]);
      expect(body.barriers).toEqual(["Distractions"]);
      // Each framework item carries its user_rating (seeded 5).
      expect(body.framework[0].user_rating).toBe(5);
    });

    it("posts the selected Area ID without changing the generation prompt inputs", async () => {
      const fetchMock = stubFetch({ ok: true, status: 200, body: { id: "goal-area" } });
      render(
        <GoalWizard areas={[{ id: "area-1", name: "Health" }]} />,
      );
      await goToStep4();
      fireEvent.change(screen.getByLabelText("Life Area (optional)"), {
        target: { value: "area-1" },
      });
      fireEvent.click(generateButton());

      await waitFor(() => expect(push).toHaveBeenCalledWith("/app/goals/goal-area"));
      const generateCall = fetchMock.mock.calls.find((c) => {
        const body = JSON.parse((c[1] as RequestInit).body as string);
        return body.step === "generate";
      })!;
      const body = JSON.parse((generateCall[1] as RequestInit).body as string);
      expect(body.areaId).toBe("area-1");
    });
  });

  describe("Generate — error path", () => {
    it("stays on Step 4 with an inline alert + Try again, and does not navigate", async () => {
      stubFetch({ ok: false, status: 500, body: { error: "Save failed." } });
      render(<GoalWizard />);
      await goToStep4();

      fireEvent.click(generateButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Save failed.");
      expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
      // Still on Step 4; no navigation.
      expect(
        screen.getByRole("heading", { name: "Review & Generate" }),
      ).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
      // Inputs intact.
      expect(screen.getByText("Discipline")).toBeInTheDocument();
    });

    it("shows a timeout message on 504", async () => {
      stubFetch({
        ok: false,
        status: 504,
        body: { error: "The request timed out after 30 seconds. Please try again." },
      });
      render(<GoalWizard />);
      await goToStep4();

      fireEvent.click(generateButton());
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/timed out/i);
      expect(push).not.toHaveBeenCalled();
    });

    it("re-runs generation with the same payload on Try again", async () => {
      // First attempt fails, second succeeds.
      let attempt = 0;
      const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
        const parsed = init?.body ? JSON.parse(init.body as string) : {};
        if (parsed.step === "framework") {
          return { ok: true, status: 200, json: async () => ({ framework: FRAMEWORK }) };
        }
        attempt += 1;
        if (attempt === 1) {
          return { ok: false, status: 500, json: async () => ({ error: "Save failed." }) };
        }
        return { ok: true, status: 200, json: async () => ({ id: "goal-retry" }) };
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<GoalWizard />);
      await goToStep4();

      fireEvent.click(generateButton());
      await screen.findByRole("button", { name: "Try again" });

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await waitFor(() => expect(push).toHaveBeenCalledWith("/app/goals/goal-retry"));
    });
  });
});
