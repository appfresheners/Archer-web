import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReviewPage from "./page";

// --- Mocks -----------------------------------------------------------------
// The page issues two reads on `review_sessions` in parallel:
//   current week:   .select(...).eq().eq().maybeSingle()
//   last completed: .select(...).not().order().limit().maybeSingle()
// We distinguish them by which chain method is called first (.eq vs .not).

const currentMaybeSingle = vi.fn();
const lastCompletedMaybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        // current-week chain
        eq: () => ({
          eq: () => ({ maybeSingle: () => currentMaybeSingle() }),
        }),
        // last-completed chain
        not: () => ({
          order: () => ({
            limit: () => ({ maybeSingle: () => lastCompletedMaybeSingle() }),
          }),
        }),
      }),
    }),
  }),
}));

// ReviewShell / StartReview are client components using next/navigation; stub
// the router so they render in the test environment.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

async function renderPage() {
  const ui = await ReviewPage();
  return render(ui);
}

describe("ReviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMaybeSingle.mockResolvedValue({ data: null, error: null });
    lastCompletedMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("shows the Start control when there is no current-week session", async () => {
    await renderPage();
    expect(
      screen.getByRole("button", { name: "Start weekly review" }),
    ).toBeInTheDocument();
  });

  it("renders the ReviewShell seeded at the session's phase for an in-progress session", async () => {
    currentMaybeSingle.mockResolvedValue({
      data: { id: "rev-1", current_phase: "get_current", completed_at: null },
      error: null,
    });

    await renderPage();

    // The phase bar (from ReviewShell) is present and seeded at get_current.
    expect(
      screen.getByRole("navigation", { name: "Weekly review progress" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Phase 3 of 5: Get Current, current"),
    ).toHaveAttribute("aria-current", "step");
    // No Start control while resuming.
    expect(
      screen.queryByRole("button", { name: "Start weekly review" }),
    ).not.toBeInTheDocument();
  });

  it("shows the last-review date on the landing", async () => {
    lastCompletedMaybeSingle.mockResolvedValue({
      data: { completed_at: "2026-09-20T10:00:00Z" },
      error: null,
    });

    await renderPage();

    expect(screen.getByText(/Last review completed/)).toBeInTheDocument();
    expect(screen.getByText(/Sep 20, 2026/)).toBeInTheDocument();
  });

  it("does not reopen a completed current-week review (shows completed landing)", async () => {
    currentMaybeSingle.mockResolvedValue({
      data: {
        id: "rev-done",
        current_phase: "complete",
        completed_at: "2026-09-25T09:00:00Z",
      },
      error: null,
    });
    lastCompletedMaybeSingle.mockResolvedValue({
      data: { completed_at: "2026-09-25T09:00:00Z" },
      error: null,
    });

    await renderPage();

    // No phase bar, no Start control — a completed-state landing instead.
    expect(
      screen.queryByRole("navigation", { name: "Weekly review progress" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start weekly review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/completed this week/i),
    ).toBeInTheDocument();
  });

  it("degrades to a safe landing when the current-week read errors", async () => {
    currentMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });

    await renderPage();

    // Safe landing renders (Start control available); no crash.
    expect(
      screen.getByRole("button", { name: "Start weekly review" }),
    ).toBeInTheDocument();
  });
});
