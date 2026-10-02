import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoalsPage from "./page";

// --- Mocks -----------------------------------------------------------------
// The page issues three reads, each `.from(table).select(...)` awaited directly:
//   goals.select("id, goal_text, status, target_date, created_at")
//   projects.select("id, goal_id, status")
//   actions.select("project_id, status")

const goalsSelect = vi.fn();
const projectsSelect = vi.fn();
const actionsSelect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "goals") return { select: () => goalsSelect() };
      if (table === "projects") return { select: () => projectsSelect() };
      return { select: () => actionsSelect() };
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

async function renderPage() {
  const ui = await GoalsPage();
  return render(ui);
}

describe("GoalsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectsSelect.mockResolvedValue({ data: [], error: null });
    actionsSelect.mockResolvedValue({ data: [], error: null });
  });

  it("shows the empty state with a wizard link when there are no goals", async () => {
    goalsSelect.mockResolvedValue({ data: [], error: null });

    await renderPage();

    expect(screen.getByText("No goals yet. Start one.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "New goal" });
    expect(link).toHaveAttribute("href", "/app/goals/new");
  });

  it("renders an error state when the goals query errors", async () => {
    goalsSelect.mockResolvedValue({ data: null, error: { message: "boom" } });

    await renderPage();

    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders goal rows sorted Active-first with badge, counts, and chevron link", async () => {
    goalsSelect.mockResolvedValue({
      data: [
        {
          id: "g-completed",
          goal_text: "Ship the archive feature",
          status: "completed",
          target_date: "2026-03-15",
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "g-active",
          goal_text: "Learn to run a marathon",
          status: "active",
          target_date: "2026-12-31",
          created_at: "2026-02-01T00:00:00Z",
        },
      ],
      error: null,
    });
    projectsSelect.mockResolvedValue({
      data: [
        { id: "p1", goal_id: "g-active", status: "active" },
        { id: "p2", goal_id: "g-active", status: "active" },
        { id: "p3", goal_id: "g-completed", status: "completed" },
      ],
      error: null,
    });
    actionsSelect.mockResolvedValue({
      data: [
        // p1 has a committed action → not stuck; p2 has none → stuck.
        { project_id: "p1", status: "committed" },
        { project_id: "p2", status: "available" },
      ],
      error: null,
    });

    await renderPage();

    const links = screen.getAllByRole("link");
    // Header "New goal" + two goal rows.
    const rowLinks = links.filter((l) =>
      l.getAttribute("href")?.startsWith("/app/goals/g-"),
    );
    expect(rowLinks.map((l) => l.getAttribute("href"))).toEqual([
      "/app/goals/g-active",
      "/app/goals/g-completed",
    ]);

    expect(screen.getByText("Learn to run a marathon")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    // g-active has 2 projects; one is stuck.
    expect(screen.getByText("2 projects")).toBeInTheDocument();
    expect(screen.getByText("1 stuck project")).toBeInTheDocument();

    // The header "New goal" control is present (and points at the wizard) when
    // goals exist — not only in the empty state.
    const headerNewGoal = links.find(
      (l) =>
        l.getAttribute("href") === "/app/goals/new" &&
        l.textContent === "New goal",
    );
    expect(headerNewGoal).toBeDefined();
  });
});
