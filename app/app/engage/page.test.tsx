import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EngagePage from "./page";

// --- Mocks -----------------------------------------------------------------
// The page issues three parallel reads, each `.from(table).select(...)` awaited:
//   goals.select("id, goal_text, status")
//   projects.select("id, goal_id, name, status")
//   actions.select("id, project_id, text, status, context_tags, time_available_minutes, scheduled_for, sort_order")
// EngageBoard is a client component that uses next/navigation; mock it so the
// server-page render doesn't require a router.

const goalsSelect = vi.fn();
const projectsSelect = vi.fn();
const actionsSelect = vi.fn();
const completedReviewMaybeSingle = vi.fn();
const snapshotMaybeSingle = vi.fn();
const completedReviewOrder = vi.fn();
const snapshotSessionIds = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "goals") return { select: () => goalsSelect() };
      if (table === "projects") return { select: () => projectsSelect() };
      if (table === "review_sessions") {
        return {
          select: () => ({
            not: (column: string, operator: string, value: null) => {
              expect([column, operator, value]).toEqual(["completed_at", "is", null]);
              return {
                order: (column: string, options: { ascending: boolean }) => {
                  completedReviewOrder(column, options);
                  return {
                    order: (tieBreak: string, tieOptions: { ascending: boolean }) => {
                      completedReviewOrder(tieBreak, tieOptions);
                      return {
                        limit: (count: number) => {
                          expect(count).toBe(1);
                          return { maybeSingle: () => completedReviewMaybeSingle() };
                        },
                      };
                    },
                  };
                },
              };
            },
          }),
        };
      }
      if (table === "weekly_snapshots") {
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              expect(column).toBe("review_session_id");
              snapshotSessionIds.push(value);
              return { maybeSingle: () => snapshotMaybeSingle() };
            },
          }),
        };
      }
      return { select: () => actionsSelect() };
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

async function renderPage() {
  const ui = await EngagePage();
  return render(ui);
}

describe("EngagePage (loader)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    goalsSelect.mockResolvedValue({ data: [], error: null });
    projectsSelect.mockResolvedValue({ data: [], error: null });
    actionsSelect.mockResolvedValue({ data: [], error: null });
    completedReviewMaybeSingle.mockResolvedValue({ data: null, error: null });
    snapshotMaybeSingle.mockResolvedValue({ data: null, error: null });
    snapshotSessionIds.length = 0;
  });

  it("renders the honest empty state when there is nothing committed", async () => {
    await renderPage();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent("Engage");
    expect(
      screen.getByText("No committed actions. Open a project and commit one."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "Weekly commitment" }),
    ).not.toBeInTheDocument();
  });

  it("renders an error state when a read errors (does not throw)", async () => {
    // A rejected read must be caught → error state with Retry, not a crashed route.
    actionsSelect.mockRejectedValue(new Error("boom"));
    await renderPage();
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" }).querySelector('[aria-current="page"]')).toHaveTextContent("Engage");
    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders an error state when a read resolves with an error field", async () => {
    goalsSelect.mockResolvedValue({ data: null, error: { message: "boom" } });
    await renderPage();
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows the latest completed intention and saved date without the blocker", async () => {
    completedReviewMaybeSingle.mockResolvedValue({
      data: { id: "review-latest", completed_at: "2026-10-08T23:30:00Z" },
      error: null,
    });
    snapshotMaybeSingle.mockResolvedValue({
      data: {
        intention: "Ship the next useful change",
        blocker: "Context switching",
        created_at: "2026-10-08T23:30:00Z",
      },
      error: null,
    });

    await renderPage();

    expect(screen.getByRole("complementary", { name: "Weekly commitment" })).toHaveTextContent(
      "Ship the next useful change",
    );
    expect(screen.getByText("Saved Oct 8, 2026")).toBeInTheDocument();
    expect(screen.queryByText("Context switching")).not.toBeInTheDocument();
    expect(completedReviewOrder.mock.calls).toEqual([
      ["completed_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(snapshotSessionIds).toEqual(["review-latest"]);
  });

  it("shows the newer intention after a subsequent review completes", async () => {
    completedReviewMaybeSingle.mockResolvedValue({
      data: { id: "review-old", completed_at: "2025-12-31T23:30:00Z" },
      error: null,
    });
    snapshotMaybeSingle.mockResolvedValue({
      data: {
        intention: "Finish the first milestone",
        blocker: "Old blocker",
        created_at: "2025-12-31T23:30:00Z",
      },
      error: null,
    });

    const firstRender = await renderPage();
    expect(screen.getByText("Finish the first milestone")).toBeInTheDocument();
    firstRender.unmount();

    completedReviewMaybeSingle.mockResolvedValue({
      data: { id: "review-new", completed_at: "2026-01-01T00:30:00Z" },
      error: null,
    });
    snapshotMaybeSingle.mockResolvedValue({
      data: {
        intention: "Start the next milestone",
        blocker: "New blocker",
        created_at: "2026-01-01T00:30:00Z",
      },
      error: null,
    });

    await renderPage();

    expect(screen.getByText("Start the next milestone")).toBeInTheDocument();
    expect(screen.queryByText("Finish the first milestone")).not.toBeInTheDocument();
    expect(screen.getByText("Saved Jan 1, 2026")).toBeInTheDocument();
    expect(snapshotSessionIds).toEqual(["review-old", "review-new"]);
  });

  it("keeps committed actions usable and reports a non-blocking snapshot read failure", async () => {
    completedReviewMaybeSingle.mockResolvedValue({
      data: { id: "review-latest", completed_at: "2026-10-08T23:30:00Z" },
      error: null,
    });
    snapshotMaybeSingle.mockResolvedValue({ data: null, error: { message: "offline" } });
    goalsSelect.mockResolvedValue({
      data: [{ id: "g1", goal_text: "Run a marathon", status: "active" }],
      error: null,
    });
    projectsSelect.mockResolvedValue({
      data: [{ id: "p1", goal_id: "g1", name: "Base training", status: "active" }],
      error: null,
    });
    actionsSelect.mockResolvedValue({
      data: [{
        id: "a1",
        project_id: "p1",
        text: "Book a running coach",
        status: "committed",
        context_tags: [],
        time_available_minutes: 25,
        scheduled_for: null,
        sort_order: 0,
      }],
      error: null,
    });

    await renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Weekly commitment is unavailable");
    expect(screen.getByText("Book a running coach")).toBeInTheDocument();
  });

  it("keeps actions usable when the completed-review lookup fails", async () => {
    completedReviewMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "offline" },
    });
    goalsSelect.mockResolvedValue({
      data: [{ id: "g1", goal_text: "Run a marathon", status: "active" }],
      error: null,
    });
    projectsSelect.mockResolvedValue({
      data: [{ id: "p1", goal_id: "g1", name: "Base training", status: "active" }],
      error: null,
    });
    actionsSelect.mockResolvedValue({
      data: [
        {
          id: "a1",
          project_id: "p1",
          text: "Book a running coach",
          status: "committed",
          context_tags: [],
          time_available_minutes: 25,
          scheduled_for: null,
          sort_order: 0,
        },
      ],
      error: null,
    });

    await renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Weekly commitment is unavailable",
    );
    expect(screen.getByText("Book a running coach")).toBeInTheDocument();
  });

  it("keeps actions usable when the completed-review lookup stalls", async () => {
    vi.useFakeTimers();
    completedReviewMaybeSingle.mockImplementation(() => new Promise(() => {}));
    goalsSelect.mockResolvedValue({
      data: [{ id: "g1", goal_text: "Run a marathon", status: "active" }],
      error: null,
    });
    projectsSelect.mockResolvedValue({
      data: [{ id: "p1", goal_id: "g1", name: "Base training", status: "active" }],
      error: null,
    });
    actionsSelect.mockResolvedValue({
      data: [
        {
          id: "a1",
          project_id: "p1",
          text: "Book a running coach",
          status: "committed",
          context_tags: [],
          time_available_minutes: 25,
          scheduled_for: null,
          sort_order: 0,
        },
      ],
      error: null,
    });

    try {
      const pagePromise = renderPage();
      await vi.advanceTimersByTimeAsync(3_000);
      await pagePromise;

      expect(screen.getByRole("status")).toHaveTextContent(
        "Weekly commitment is unavailable",
      );
      expect(screen.getByText("Book a running coach")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("flows loaded rows through buildEngageModel into grouped board output", async () => {
    goalsSelect.mockResolvedValue({
      data: [{ id: "g1", goal_text: "Run a marathon", status: "active" }],
      error: null,
    });
    projectsSelect.mockResolvedValue({
      data: [{ id: "p1", goal_id: "g1", name: "Base training", status: "active" }],
      error: null,
    });
    actionsSelect.mockResolvedValue({
      data: [
        {
          id: "a1",
          project_id: "p1",
          text: "Book a running coach",
          status: "committed",
          context_tags: [],
          time_available_minutes: 25,
          scheduled_for: null,
          sort_order: 0,
        },
      ],
      error: null,
    });

    await renderPage();

    // The goal group heading and the committed row flow through.
    expect(screen.getByText("Run a marathon")).toBeInTheDocument();
    expect(screen.getByText("Book a running coach")).toBeInTheDocument();
  });
});
