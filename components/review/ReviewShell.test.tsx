import type { ReviewShellPhase } from "@/lib/review/phases";
import type { ReviewData } from "@/lib/review/reviewData";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PriorSnapshotDisplay } from "./phase-panels/SnapshotOpenPanel";
import ReviewShell, { type ReviewShellSnapshotInput } from "./ReviewShell";

const EMPTY_REVIEW_DATA: ReviewData = {
  unprocessedCount: 0,
  currentProjects: [],
  somedayItems: [],
  goalAlignment: [],
};

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

function mockFetch(ok = true, body: unknown = { id: "rev-1" }, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function lastCall() {
  return (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
}

const EMPTY_SNAPSHOT: ReviewShellSnapshotInput = {
  opening_retrospective: "",
  closing_intention: "",
  closing_blocker: "",
};

function renderShell(
  overrides: {
    initialPhase?: ReviewShellPhase;
    priorSnapshot?: PriorSnapshotDisplay | null;
    initialSnapshot?: Partial<ReviewShellSnapshotInput>;
    reviewData?: Partial<ReviewData>;
  } = {},
) {
  return render(
    <ReviewShell
      sessionId="rev-1"
      initialPhase={overrides.initialPhase ?? "snapshot_open"}
      weekNumber={40}
      weekStartDate="2026-09-28"
      weekEndDate="2026-10-04"
      priorSnapshot={overrides.priorSnapshot ?? null}
      initialSnapshot={{ ...EMPTY_SNAPSHOT, ...overrides.initialSnapshot }}
      reviewData={{ ...EMPTY_REVIEW_DATA, ...overrides.reviewData }}
    />,
  );
}

describe("ReviewShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the phase bar with five beats and the active phase panel", () => {
    renderShell({ initialPhase: "get_clear" });

    const nav = screen.getByRole("navigation", { name: "Weekly review progress" });
    expect(within(nav).getAllByRole("listitem")).toHaveLength(5);

    expect(
      screen.getByLabelText("Phase 2 of 5: Get Clear, current"),
    ).toHaveAttribute("aria-current", "step");

    // Middle beat placeholder is shown.
    expect(
      screen.getByRole("heading", { name: "Get Clear" }),
    ).toBeInTheDocument();
  });

  it("announces the current phase via a polite live region", () => {
    renderShell({ initialPhase: "get_clear" });
    expect(screen.getByText("Phase 2 of 5: Get Clear")).toBeInTheDocument();
  });

  // --- Opening snapshot (5.5) ----------------------------------------------

  it("renders the opening header 'Week N · Mon dd – Sun dd'", () => {
    renderShell({ initialPhase: "snapshot_open" });
    expect(
      screen.getByRole("heading", { name: /Week 40 · Sep 28 – Oct 04/ }),
    ).toBeInTheDocument();
  });

  it("shows the prior week's closing snapshot read-only under 'Last week you said:'", () => {
    renderShell({
      initialPhase: "snapshot_open",
      priorSnapshot: {
        intention: "ship the beta",
        blocker: "flaky CI",
        opening_retrospective: null,
      },
    });
    expect(screen.getByText("Last week you said:")).toBeInTheDocument();
    expect(screen.getByText("ship the beta")).toBeInTheDocument();
    expect(screen.getByText("flaky CI")).toBeInTheDocument();
  });

  it("shows 'No prior snapshot yet.' when there is no prior snapshot", () => {
    renderShell({ initialPhase: "snapshot_open", priorSnapshot: null });
    expect(screen.getByText("No prior snapshot yet.")).toBeInTheDocument();
  });

  it("shows the prior week's opening retrospective in the closed-loop display", () => {
    renderShell({
      initialPhase: "snapshot_open",
      priorSnapshot: {
        intention: "ship the beta",
        blocker: "flaky CI",
        opening_retrospective: "last week's reflection",
      },
    });
    // The closed loop surfaces last week's retrospective too, not only the
    // intention/blocker.
    expect(screen.getByText("last week's reflection")).toBeInTheDocument();
  });

  it("gates the opening advance until the retrospective is non-empty", async () => {
    const user = userEvent.setup();
    renderShell({ initialPhase: "snapshot_open" });

    // Start disabled with an empty retrospective.
    const start = screen.getByRole("button", { name: "Start review →" });
    expect(start).toBeDisabled();
    expect(
      screen.getByText(/Add a short retrospective/),
    ).toBeInTheDocument();

    // Typing enables it.
    await user.type(
      screen.getByLabelText(/What actually moved last week/),
      "shipped x",
    );
    expect(
      screen.getByRole("button", { name: "Start review →" }),
    ).toBeEnabled();
  });

  it("persists the retrospective on blur (PATCH with the field)", async () => {
    const user = userEvent.setup();
    renderShell({ initialPhase: "snapshot_open" });

    const textarea = screen.getByLabelText(/What actually moved last week/);
    await user.type(textarea, "moved a, missed b");
    await user.tab(); // blur

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/review/rev-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      opening_retrospective: "moved a, missed b",
    });
  });

  it("advances from the opening once the retrospective is present", async () => {
    const user = userEvent.setup();
    renderShell({
      initialPhase: "snapshot_open",
      initialSnapshot: { opening_retrospective: "done" },
    });

    await user.click(screen.getByRole("button", { name: "Start review →" }));

    await waitFor(() =>
      expect(
        screen.getByLabelText("Phase 2 of 5: Get Clear, current"),
      ).toHaveAttribute("aria-current", "step"),
    );
    // The opening advance persists the retrospective ALONGSIDE the phase, so a
    // keyboard/fast activation that skips the blur can't lose the typed text.
    const [, init] = lastCall();
    expect(JSON.parse(init.body)).toEqual({
      current_phase: "get_clear",
      opening_retrospective: "done",
    });
  });

  it("restores the retrospective value from the session (resume)", () => {
    renderShell({
      initialPhase: "snapshot_open",
      initialSnapshot: { opening_retrospective: "restored text" },
    });
    expect(
      screen.getByLabelText(/What actually moved last week/),
    ).toHaveValue("restored text");
  });

  // --- Middle beats: navigation + gates (5.6) ------------------------------

  it("Next persists the next phase (PATCH) and advances the bar", async () => {
    const user = userEvent.setup();
    renderShell({ initialPhase: "get_clear" });

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = lastCall();
    expect(JSON.parse(init.body)).toEqual({ current_phase: "get_current" });

    await waitFor(() =>
      expect(
        screen.getByLabelText("Phase 3 of 5: Get Current, current"),
      ).toHaveAttribute("aria-current", "step"),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("Back moves to the previous phase (persisting it) without skipping", async () => {
    const user = userEvent.setup();
    renderShell({ initialPhase: "get_current" });

    await user.click(screen.getByRole("button", { name: "Back" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = lastCall();
    expect(JSON.parse(init.body)).toEqual({ current_phase: "get_clear" });
  });

  it("disables Back on the first phase (no previous beat)", () => {
    renderShell({ initialPhase: "snapshot_open" });
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("Get Clear blocks advance until the inbox reaches zero", () => {
    renderShell({
      initialPhase: "get_clear",
      reviewData: { unprocessedCount: 3 },
    });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(
      screen.getByText(/reach inbox zero before continuing/i),
    ).toBeInTheDocument();
    // The panel surfaces the count (split across elements) + a process link.
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/items left to process/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Process inbox/i })).toHaveAttribute(
      "href",
      "/app/inbox",
    );
  });

  it("Get Clear enables advance at inbox zero", () => {
    renderShell({
      initialPhase: "get_clear",
      reviewData: { unprocessedCount: 0 },
    });
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.getByText(/Inbox zero/i)).toBeInTheDocument();
  });

  it("Get Current blocks advance while a stuck, unreviewed project remains", () => {
    renderShell({
      initialPhase: "get_current",
      reviewData: {
        currentProjects: [
          {
            id: "p1",
            name: "Blog relaunch",
            updatedAt: "2026-09-20T00:00:00Z",
            committedActionText: null,
            availableActions: [{ id: "a1", text: "Outline the intro" }],
            isStuck: true,
          },
        ],
      },
    });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(
      screen.getByText(/committed action or change its status/i),
    ).toBeInTheDocument();
  });

  it("Get Current: committing an available action clears the block and marks reviewed", async () => {
    const user = userEvent.setup();
    renderShell({
      initialPhase: "get_current",
      reviewData: {
        currentProjects: [
          {
            id: "p1",
            name: "Blog relaunch",
            updatedAt: "2026-09-20T00:00:00Z",
            committedActionText: null,
            availableActions: [{ id: "a1", text: "Outline the intro" }],
            isStuck: true,
          },
        ],
      },
    });

    await user.click(
      screen.getByRole("button", { name: /Commit "Outline the intro"/ }),
    );

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/actions/a1/commit");
    expect(init.method).toBe("POST");
    // Reviewing (via commit) clears the gate even though the reloaded data
    // still shows the project stuck (server refetch happens via router.refresh).
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled(),
    );
  });

  it("Get Current: changing a stuck project's status PATCHes it and clears the block", async () => {
    const user = userEvent.setup();
    renderShell({
      initialPhase: "get_current",
      reviewData: {
        currentProjects: [
          {
            id: "p1",
            name: "Blog relaunch",
            updatedAt: "2026-09-20T00:00:00Z",
            committedActionText: null,
            availableActions: [],
            isStuck: true,
          },
        ],
      },
    });

    // Stuck project with no available actions → only path is a status change.
    await user.click(screen.getByRole("button", { name: "Pause Blog relaunch" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/projects/p1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ status: "paused" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled(),
    );
  });

  it("Get Current: Confirm marks a non-stuck project reviewed without a mutation", async () => {
    const user = userEvent.setup();
    renderShell({
      initialPhase: "get_current",
      reviewData: {
        currentProjects: [
          {
            id: "p1",
            name: "Blog relaunch",
            updatedAt: "2026-09-20T00:00:00Z",
            committedActionText: "Draft the outline",
            availableActions: [],
            isStuck: false,
          },
        ],
      },
    });

    await user.click(
      screen.getByRole("button", { name: /Confirm the next action for Blog relaunch/ }),
    );

    // No network call — confirming keeps the existing committed action.
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText(/· reviewed/)).toBeInTheDocument();
  });

  it("Get Current: an active project with a committed action does not block", () => {
    renderShell({
      initialPhase: "get_current",
      reviewData: {
        currentProjects: [
          {
            id: "p1",
            name: "Blog relaunch",
            updatedAt: "2026-09-20T00:00:00Z",
            committedActionText: "Draft the outline",
            availableActions: [],
            isStuck: false,
          },
        ],
      },
    });
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("Get Creative advances freely (its hard gate is the closing snapshot)", () => {
    renderShell({
      initialPhase: "get_creative",
      reviewData: {
        somedayItems: [{ id: "i1", raw_text: "learn to sail" }],
        goalAlignment: [
          { id: "g1", goalText: "Get fit", projectCount: 2, stuckCount: 1 },
        ],
      },
    });
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.getByText("learn to sail")).toBeInTheDocument();
    expect(screen.getByText("Get fit")).toBeInTheDocument();
  });

  it("Get Creative: activating a someday item PATCHes it to unprocessed", async () => {
    const user = userEvent.setup();
    renderShell({
      initialPhase: "get_creative",
      reviewData: { somedayItems: [{ id: "i1", raw_text: "learn to sail" }] },
    });

    await user.click(screen.getByRole("button", { name: "Activate" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/inbox/i1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ status: "unprocessed" });
  });

  it("Get Creative: deleting a someday item DELETEs it", async () => {
    const user = userEvent.setup();
    renderShell({
      initialPhase: "get_creative",
      reviewData: { somedayItems: [{ id: "i1", raw_text: "learn to sail" }] },
    });

    await user.click(
      screen.getByRole("button", { name: /Delete someday item: learn to sail/ }),
    );

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/inbox/i1");
    expect(init.method).toBe("DELETE");
  });

  // --- Closing snapshot + completion (5.5) ---------------------------------

  it("renders two aria-required closing fields and no plain Next on the closing beat", () => {
    renderShell({ initialPhase: "snapshot_close" });

    const intention = screen.getByLabelText(/What matters most this coming week/);
    const blocker = screen.getByLabelText(/main thing that could derail/);
    expect(intention).toHaveAttribute("aria-required", "true");
    expect(blocker).toHaveAttribute("aria-required", "true");

    // No plain "Next" — the panel's Complete action drives the final beat.
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Complete review" }),
    ).toBeInTheDocument();
  });

  it("blocks completion and reveals inline validation when a closing field is empty", async () => {
    const user = userEvent.setup();
    renderShell({
      initialPhase: "snapshot_close",
      initialSnapshot: { closing_intention: "focus", closing_blocker: "" },
    });

    // The button stays clickable (aria-disabled reflects the incomplete state)
    // so pressing it surfaces the inline validation rather than silently doing
    // nothing.
    const complete = screen.getByRole("button", { name: "Complete review" });
    expect(complete).toHaveAttribute("aria-disabled", "true");

    await user.click(complete);

    // The completion route is NOT called, and the empty blocker field now shows
    // its inline validation wired to aria-invalid.
    expect(fetch).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByText("Name a blocker before completing."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/main thing that could derail/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("completes the review and navigates to Engage when both fields are present", async () => {
    const user = userEvent.setup();
    renderShell({
      initialPhase: "snapshot_close",
      initialSnapshot: {
        closing_intention: "ship v1",
        closing_blocker: "scope creep",
      },
    });

    await user.click(screen.getByRole("button", { name: "Complete review" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/review/rev-1/complete");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      intention: "ship v1",
      blocker: "scope creep",
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/engage"));
  });

  it("blocks completion when the inbox is not empty (e.g. items added in Get Creative)", async () => {
    const user = userEvent.setup();
    renderShell({
      initialPhase: "snapshot_close",
      initialSnapshot: {
        closing_intention: "ship v1",
        closing_blocker: "scope creep",
      },
      reviewData: { unprocessedCount: 2 },
    });

    await user.click(screen.getByRole("button", { name: "Complete review" }));

    // The completion route is NOT called; an inline reason is shown.
    expect(fetch).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/Process every inbox item before completing/i),
    ).toBeInTheDocument();
  });

  it("blocks completion when an active project is still stuck and unreviewed", async () => {
    const user = userEvent.setup();
    renderShell({
      initialPhase: "snapshot_close",
      initialSnapshot: {
        closing_intention: "ship v1",
        closing_blocker: "scope creep",
      },
      reviewData: {
        currentProjects: [
          {
            id: "p1",
            name: "Blog",
            updatedAt: "2026-09-20T00:00:00Z",
            committedActionText: null,
            availableActions: [],
            isStuck: true,
          },
        ],
      },
    });

    await user.click(screen.getByRole("button", { name: "Complete review" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/committed action or change its status before completing/i),
    ).toBeInTheDocument();
  });

  it("surfaces an inline error and stays put when completion fails", async () => {
    mockFetch(false, { error: "Failed to complete the review. Please try again." }, 500);
    const user = userEvent.setup();
    renderShell({
      initialPhase: "snapshot_close",
      initialSnapshot: {
        closing_intention: "ship v1",
        closing_blocker: "scope creep",
      },
    });

    await user.click(screen.getByRole("button", { name: "Complete review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to complete the review. Please try again.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("persists a closing field on blur (PATCH)", async () => {
    const user = userEvent.setup();
    renderShell({ initialPhase: "snapshot_close" });

    const intention = screen.getByLabelText(/What matters most/);
    await user.type(intention, "focus");
    await user.tab();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    // The closing blur persists BOTH fields in one PATCH (no racing requests).
    const bodies = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => JSON.parse(c[1].body),
    );
    expect(bodies).toContainEqual({
      closing_intention: "focus",
      closing_blocker: "",
    });
  });

  // --- Cross-cutting -------------------------------------------------------

  it("surfaces an inline error and stays on the phase when a phase PATCH fails", async () => {
    mockFetch(false, { error: "Failed to save the review. Please try again." }, 500);
    const user = userEvent.setup();
    renderShell({ initialPhase: "get_clear" });

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to save the review. Please try again.",
    );
    expect(
      screen.getByLabelText("Phase 2 of 5: Get Clear, current"),
    ).toHaveAttribute("aria-current", "step");
  });

  it("renders no timer or countdown anywhere (not timed)", () => {
    renderShell({ initialPhase: "get_clear" });
    expect(
      screen.queryByText(/timer|countdown|time left|remaining/i),
    ).toBeNull();
  });
});
