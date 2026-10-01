import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoalDetailPage from "./page";

// --- Mocks -----------------------------------------------------------------

const goalMaybeSingle = vi.fn();
const projectsOrder = vi.fn();
const actionsIn = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "goals") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => goalMaybeSingle() }) }),
        };
      }
      if (table === "projects") {
        return {
          select: () => ({ eq: () => ({ order: () => projectsOrder() }) }),
        };
      }
      return { select: () => ({ in: () => actionsIn() }) };
    },
  }),
}));

class NotFoundError extends Error { }
const notFound = vi.fn(() => {
  throw new NotFoundError("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

// The interactive client header is exercised in its own concerns; stub it so
// the server-page test focuses on the read/render surface.
vi.mock("./GoalDetailClient", () => ({
  default: ({ goal }: { goal: { goal_text: string } }) => (
    <div data-testid="goal-client">{goal.goal_text}</div>
  ),
}));

async function renderPage(id: string) {
  const ui = await GoalDetailPage({ params: Promise.resolve({ id }) });
  return render(ui);
}

describe("GoalDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectsOrder.mockResolvedValue({ data: [], error: null });
    actionsIn.mockResolvedValue({ data: [], error: null });
  });

  it("renders the gap analysis, projects, and Monthly Check when the goal exists", async () => {
    goalMaybeSingle.mockResolvedValue({
      data: {
        id: "g1",
        goal_text: "Run a marathon",
        why: "I want to build confidence and endurance.",
        status: "active",
        target_date: "2026-12-31",
        last_checked_at: null,
        skill_framework: [
          { name: "Pacing", required_level: 9, user_rating: 5, description: "" },
        ],
        drivers: ["health"],
        barriers: ["time"],
        if_then_plan: "If tired, then rest.",
      },
      error: null,
    });
    projectsOrder.mockResolvedValue({
      data: [{ id: "p1", name: "Base training", status: "active", sort_order: 0 }],
      error: null,
    });
    actionsIn.mockResolvedValue({
      data: [{ project_id: "p1", status: "available" }],
      error: null,
    });

    await renderPage("g1");

    expect(screen.getByTestId("goal-client")).toHaveTextContent("Run a marathon");
    expect(screen.getByText("I want to build confidence and endurance.")).toBeInTheDocument();
    expect(screen.getByText("Gap analysis")).toBeInTheDocument();
    expect(screen.getByText("Pacing")).toBeInTheDocument();
    // required 9, rating 5, gap = 4 (unique among the row's cells)
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Base training")).toBeInTheDocument();
    // p1 is active with no committed action → stuck band shows.
    expect(
      screen.getByText("No committed next action — this project is stuck."),
    ).toBeInTheDocument();
    expect(screen.getByText("Monthly Goal Check")).toBeInTheDocument();
    expect(screen.getByText("Last checked: Never")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start monthly goal check" })).toHaveAttribute(
      "href",
      "/app/review/monthly/g1",
    );
  });

  it("calls notFound() when the goal is absent", async () => {
    goalMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(renderPage("missing")).rejects.toBeInstanceOf(NotFoundError);
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("calls notFound() when the goal query errors", async () => {
    goalMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(renderPage("g1")).rejects.toBeInstanceOf(NotFoundError);
  });
});
