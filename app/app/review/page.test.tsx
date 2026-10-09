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

// Review-data reads (only when a session is resumable): each is a `.select(...)`
// optionally `.neq(...)`, awaited directly. Rows come from `reviewDataRows` so
// a test can drive buildReviewData through the loader with real data.
const reviewDataSelect = vi.fn();
const reviewDataRows: Record<string, unknown[]> = {};
const reviewDataErrors: Record<string, unknown> = {};

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
      if (
        table === "inbox_items" ||
        table === "projects" ||
        table === "actions" ||
        table === "goals"
      ) {
        // buildReviewData source reads: .select(...) or .select(...).neq(...),
        // awaited directly → resolve to a thenable that also supports .neq().
        // Per-table rows come from `reviewDataRows` so a test can supply data.
        const result = {
          data: reviewDataRows[table] ?? [],
          error: reviewDataErrors[table] ?? null,
        };
        const thenable = {
          neq: () => Promise.resolve(result),
          then: (resolve: (v: typeof result) => unknown) => resolve(result),
        };
        return { select: () => (reviewDataSelect(table), thenable) };
      }
      if (table === "areas_of_focus") {
        const result = {
          data: reviewDataRows[table] ?? [],
          error: reviewDataErrors[table] ?? null,
        };
        return {
          select: () => ({
            order: () => (reviewDataSelect(table), Promise.resolve(result)),
          }),
        };
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
    for (const k of Object.keys(reviewDataRows)) delete reviewDataRows[k];
    for (const k of Object.keys(reviewDataErrors)) delete reviewDataErrors[k];
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
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent("Weekly Review");
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

  it("flows loaded review data through buildReviewData into the shell (Get Creative)", async () => {
    currentMaybeSingle.mockResolvedValue({
      data: {
        id: "rev-1",
        current_phase: "get_creative",
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
    reviewDataRows.inbox_items = [
      { id: "i1", raw_text: "learn to sail", processing_status: "someday" },
    ];
    reviewDataRows.projects = [
      { id: "p1", name: "Fitness plan", status: "active", updated_at: "2026-09-01T00:00:00Z", goal_id: "g1", area_id: null },
    ];
    reviewDataRows.actions = [];
    reviewDataRows.goals = [
      { id: "g1", goal_text: "Get fit", status: "active", area_id: "a1" },
    ];
    reviewDataRows.areas_of_focus = [
      { id: "a1", name: "Health", sort_order: 0, archived_at: null },
    ];

    await renderPage();

    // The five review-data reads ran, and buildReviewData output reached the shell:
    // the someday item + goal-alignment (1 project, 1 stuck) render.
    expect(reviewDataSelect).toHaveBeenCalledWith("inbox_items");
    expect(reviewDataSelect).toHaveBeenCalledWith("projects");
    expect(reviewDataSelect).toHaveBeenCalledWith("areas_of_focus");
    expect(screen.getByText("learn to sail")).toBeInTheDocument();
    expect(screen.getAllByText("Get fit")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Health" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review Focus" })).toHaveAttribute(
      "href",
      "/app/focus",
    );
    expect(screen.getByLabelText("Phase 4 of 5: Get Creative, current")).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("restores Get Creative with the Focus link and reports an Area read failure", async () => {
    currentMaybeSingle.mockResolvedValue({
      data: {
        id: "rev-1",
        current_phase: "get_creative",
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
    reviewDataErrors.areas_of_focus = { message: "offline" };

    await renderPage();

    expect(screen.getByLabelText("Phase 4 of 5: Get Creative, current")).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByRole("link", { name: "Review Focus" })).toHaveAttribute(
      "href",
      "/app/focus",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Life Areas could not be loaded",
    );
    expect(screen.queryByText("No Areas yet.")).not.toBeInTheDocument();
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
