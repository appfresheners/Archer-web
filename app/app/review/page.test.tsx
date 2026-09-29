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
const priorSnapshotMaybeSingle = vi.fn();
// Capture the (col, val) pairs applied to the prior-week weekly_snapshots
// query so a test can assert it targets the PRIOR ISO week, not the current one.
const priorSnapshotEq: Array<[string, unknown]> = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "weekly_snapshots") {
        // prior-week snapshot chain: .select().eq().eq().maybeSingle()
        const chain = {
          select: () => chain,
          eq: (col: string, val: unknown) => {
            priorSnapshotEq.push([col, val]);
            return chain;
          },
          maybeSingle: () => priorSnapshotMaybeSingle(),
        };
        return chain;
      }
      // review_sessions: two chains distinguished by .eq (current) vs .not (last).
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: () => currentMaybeSingle() }),
          }),
          not: () => ({
            order: () => ({
              limit: () => ({ maybeSingle: () => lastCompletedMaybeSingle() }),
            }),
          }),
        }),
      };
    },
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
    priorSnapshotMaybeSingle.mockResolvedValue({ data: null, error: null });
    priorSnapshotEq.length = 0;
  });

  it("queries the PRIOR ISO week for the closed-loop snapshot across a year boundary", async () => {
    // Freeze 'now' to 2026-01-01 (ISO week 1 of 2026). Seven days earlier is
    // 2025-12-25 → ISO week 52 of 2025. The prior-week query must target that,
    // not the current week — a regression to `now` would query week 1/2026.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    try {
      await renderPage();
    } finally {
      vi.useRealTimers();
    }
    expect(priorSnapshotEq).toContainEqual(["week_number", 52]);
    expect(priorSnapshotEq).toContainEqual(["week_year", 2025]);
  });

  it("shows the Start control when there is no current-week session", async () => {
    await renderPage();
    expect(
      screen.getByRole("button", { name: "Start weekly review" }),
    ).toBeInTheDocument();
  });

  it("renders the ReviewShell seeded at the session's phase for an in-progress session", async () => {
    currentMaybeSingle.mockResolvedValue({
      data: {
        id: "rev-1",
        current_phase: "get_current",
        completed_at: null,
        week_number: 40,
        week_start_date: "2026-09-28",
        week_end_date: "2026-10-04",
        opening_retrospective: "moved a",
        closing_intention: null,
        closing_blocker: null,
      },
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

  it("passes the prior week's snapshot to the shell (closed loop) when resuming at the opening", async () => {
    currentMaybeSingle.mockResolvedValue({
      data: {
        id: "rev-1",
        current_phase: "snapshot_open",
        completed_at: null,
        week_number: 40,
        week_start_date: "2026-09-28",
        week_end_date: "2026-10-04",
        opening_retrospective: "",
        closing_intention: null,
        closing_blocker: null,
      },
      error: null,
    });
    priorSnapshotMaybeSingle.mockResolvedValue({
      data: {
        intention: "ship the beta",
        blocker: "flaky CI",
        opening_retrospective: null,
      },
      error: null,
    });

    await renderPage();

    // The opening panel surfaces the prior week's closing snapshot read-only.
    expect(screen.getByText("Last week you said:")).toBeInTheDocument();
    expect(screen.getByText("ship the beta")).toBeInTheDocument();
    expect(screen.getByText("flaky CI")).toBeInTheDocument();
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
