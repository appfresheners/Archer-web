import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MonthlyGoalCheckPage from "./page";

const goalMaybeSingle = vi.fn();
const projectsOrder = vi.fn();
const actionsIn = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "goals") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => goalMaybeSingle() }) }) };
      }
      if (table === "projects") {
        return { select: () => ({ eq: () => ({ order: () => projectsOrder() }) }) };
      }
      return { select: () => ({ in: () => actionsIn() }) };
    },
  }),
}));

class NotFoundError extends Error {}
const notFound = vi.fn(() => {
  throw new NotFoundError("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("./MonthlyGoalCheckClient", () => ({
  default: () => <div data-testid="monthly-check-client" />,
}));

async function renderPage(goalId = "g1") {
  const ui = await MonthlyGoalCheckPage({ params: Promise.resolve({ goalId }) });
  return render(ui);
}

describe("MonthlyGoalCheckPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectsOrder.mockResolvedValue({ data: [], error: null });
    actionsIn.mockResolvedValue({ data: [], error: null });
  });

  it("renders an error state when the goal query errors", async () => {
    goalMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await renderPage();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent("Monthly check");
    expect(screen.getByRole("link", { name: "Goals" })).toHaveAttribute("href", "/app/goals");
    expect(screen.getByRole("link", { name: "Goal" })).toHaveAttribute("href", "/app/goals/g1");
    expect(
      screen.getByText("Something went wrong loading this view. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders the goal, all six status choices, and linked project health", async () => {
    goalMaybeSingle.mockResolvedValue({
      data: {
        id: "g1",
        goal_text: "Run a marathon",
        status: "active",
        last_checked_at: null,
        created_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    });
    projectsOrder.mockResolvedValue({
      data: [
        { id: "p1", name: "Base training", status: "active", sort_order: 0 },
        { id: "p2", name: "Completed race plan", status: "completed", sort_order: 1 },
      ],
      error: null,
    });
    actionsIn.mockResolvedValue({
      data: [{ project_id: "p1", status: "available" }],
      error: null,
    });

    await renderPage();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(screen.getAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(1);
    expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent("Monthly check");
    expect(screen.getByRole("link", { name: "Goals" })).toHaveAttribute("href", "/app/goals");
    expect(screen.getByRole("link", { name: "Goal" })).toHaveAttribute("href", "/app/goals/g1");
    expect(screen.getByText("Run a marathon")).toBeInTheDocument();
    expect(screen.getByText("Base training")).toHaveAttribute("href", "/app/projects/p1");
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("1 stuck project")).toBeInTheDocument();
    expect(screen.getByText("Stuck")).toBeInTheDocument();
    expect(screen.getByTestId("monthly-check-client")).toBeInTheDocument();
  });

  it("returns not found for a missing or unowned goal", async () => {
    goalMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(renderPage("missing")).rejects.toBeInstanceOf(NotFoundError);
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});