import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReviewShell from "./ReviewShell";

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

describe("ReviewShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the phase bar with five beats and the active phase panel", () => {
    render(<ReviewShell sessionId="rev-1" initialPhase="snapshot_open" />);

    const nav = screen.getByRole("navigation", { name: "Weekly review progress" });
    expect(within(nav).getAllByRole("listitem")).toHaveLength(5);

    // Active beat carries aria-current and matches the initial phase.
    expect(
      screen.getByLabelText("Phase 1 of 5: Snapshot open, current"),
    ).toHaveAttribute("aria-current", "step");

    // The placeholder panel for the active phase is shown.
    expect(
      screen.getByRole("heading", { name: "Snapshot open" }),
    ).toBeInTheDocument();
  });

  it("announces the current phase via a polite live region", () => {
    render(<ReviewShell sessionId="rev-1" initialPhase="get_clear" />);
    // The live region text names the phase.
    expect(
      screen.getByText("Phase 2 of 5: Get Clear"),
    ).toBeInTheDocument();
  });

  it("Next persists the next phase (PATCH) and advances the bar", async () => {
    const user = userEvent.setup();
    render(<ReviewShell sessionId="rev-1" initialPhase="get_clear" />);

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = lastCall();
    expect(url).toBe("/api/review/rev-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ current_phase: "get_current" });

    // The bar advances: get_current is now the active beat.
    await waitFor(() =>
      expect(
        screen.getByLabelText("Phase 3 of 5: Get Current, current"),
      ).toHaveAttribute("aria-current", "step"),
    );
    // The prior beat is marked completed.
    expect(
      screen.getByLabelText("Phase 2 of 5: Get Clear, completed"),
    ).toBeInTheDocument();
    // The shell owns phase state locally — it does NOT refresh the server page
    // on a phase change (that would only risk a flicker / re-seed mismatch).
    expect(refresh).not.toHaveBeenCalled();
  });

  it("Back moves to the previous phase (persisting it) without skipping", async () => {
    const user = userEvent.setup();
    render(<ReviewShell sessionId="rev-1" initialPhase="get_current" />);

    await user.click(screen.getByRole("button", { name: "Back" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = lastCall();
    expect(JSON.parse(init.body)).toEqual({ current_phase: "get_clear" });

    await waitFor(() =>
      expect(
        screen.getByLabelText("Phase 2 of 5: Get Clear, current"),
      ).toHaveAttribute("aria-current", "step"),
    );
  });

  it("cannot skip forward: Next only ever advances one beat, disabled at the last", () => {
    render(<ReviewShell sessionId="rev-1" initialPhase="snapshot_close" />);
    // On the final beat there is no next → Next is disabled (no forward jump).
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("disables Back on the first phase (no previous beat)", () => {
    render(<ReviewShell sessionId="rev-1" initialPhase="snapshot_open" />);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("surfaces an inline error and stays on the phase when the PATCH fails", async () => {
    mockFetch(false, { error: "Failed to save the review. Please try again." }, 500);
    const user = userEvent.setup();
    render(<ReviewShell sessionId="rev-1" initialPhase="get_clear" />);

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to save the review. Please try again.",
    );
    // Still on get_clear; did not advance.
    expect(
      screen.getByLabelText("Phase 2 of 5: Get Clear, current"),
    ).toHaveAttribute("aria-current", "step");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders no timer or countdown anywhere (not timed)", () => {
    render(<ReviewShell sessionId="rev-1" initialPhase="get_clear" />);
    expect(screen.queryByText(/timer|countdown|time left|remaining/i)).toBeNull();
  });
});
